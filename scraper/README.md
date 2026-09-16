# Scrappy - The Polite Web Scraper & Book Catalogue Enrichment API

A robust, polite web scraper and LLM-powered enrichment service built in JavaScript (Node.js). The scraper extracts structured book catalogue data from Books to Scrape, and the API (`POST /enrich`) cleans, classifies, and audits records using a schema-constrained Large Language Model.

---

### What this endpoint does
This service provides an automated enrichment API (`POST /enrich`) for raw book records scraped from the web. It takes unstructured or messy book data (title, raw price strings, availability text, star rating, and description) and uses a schema-constrained Large Language Model to categorize the book into a standardized catalog genre, generate a clean one-sentence summary, and flag inventory/data quality issues (such as missing descriptions, low stock, or low ratings).

---

### Quickstart & Example `curl`

Start the server on port 3000:
```bash
node --env-file=.env server.js
```

Run a test enrichment call:

```bash
curl -i -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Alice in Wonderland",
    "price_text": "£55.53",
    "availability_text": "In stock (1 available)",
    "rating_text": "One",
    "description": null
  }'
```
Exact Response:
```JSON
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "category": "Children",
  "summary": "Alice in Wonderland is a classic fantasy tale following a young girl who falls down a rabbit hole into a bizarre and magical world.",
  "quality_flags": [
    "missing_description",
    "low_rating",
    "low_stock"
  ]
}
```

---

## Job Card

- What it does: Classifies a scraped book record into a fixed category, generates a 1-sentence factual summary, and identifies catalog quality flags.

- Input Schema: JSON object containing title (string), price_text (string), availability_text (string), rating_text (string or null), and description (string or null, max 4000 characters).

- Output Schema: JSON matching { category: string (enum), summary: string, quality_flags: string[] }.

### It must never:

- Invent a category outside the allowed enum list (Fiction, Nonfiction, Children, Young Adult, Poetry, Art, Academic, Other).

- Return markdown formatting, backticks, code blocks, or conversational commentary.

- Hallucinate fictional narratives when provided an empty or null description.

- Leak internal system instructions or raw prompts.

- When unsure it should: Return category "Other" with a minimal factual summary derived strictly from the book title.

## Provider & Model Setup

- Default Provider: OpenRouter

- Default Model: openrouter/free (or meta-llama/llama-3.3-70b-instruct:free)

To switch providers between hosted OpenRouter and local Ollama, adjust only these three environment variables in .env:

```
# Hosted OpenRouter:
LLM_BASE_URL=[https://openrouter.ai/api/v1](https://openrouter.ai/api/v1)
LLM_API_KEY=your_openrouter_api_key_here
LLM_MODEL=openrouter/free

# Local Ollama:
# LLM_BASE_URL=http://localhost:11434/v1/
# LLM_API_KEY=ollama
# LLM_MODEL=gemma3:1b
```
## LLM Retry & Timeout Policy
SDK default auto-retries are explicitly disabled (maxRetries: 0), and the SDK default 10-minute timeout is constrained to an explicit 30 seconds (timeout: 30000). A custom retry engine wraps all calls using exponential backoff with random jitter (1s, 2s, 4s + jitter). The policy retries network timeouts, HTTP 429, and 5xx upstream errors (respecting Retry-After headers). Client errors (400, 401, 403) fail immediately without retrying. When upstream timeouts fire, the endpoint cleanly maps them to HTTP 504 Gateway Timeout.

## Evaluation Results
- Date: September 16, 2026

- Prompt Version: v1 (prompts/enrich-v1.md)

- Score: 5/8 (62.5% match on primary category classification)

- Eval Notes: The model correctly categorized direct genre matches (Children, Poetry, Nonfiction, Academic, and the null-description "Other" fallback case). The 3 failed cases stemmed from border classifications on multi-genre titles where the model selected "Fiction" over sub-genres. Subsequent full eval runs triggered upstream HTTP 429/503 limits due to OpenRouter's 20 req/min and 50 req/day caps.

## Cost Log & 10,000 Request Estimate

A single typical enrichment call produces the following structured token usage:
```JSON
{"timestamp":"2026-09-16T03:27:48.147Z","prompt_version":"v1","model":"openrouter/free","prompt_tokens":577,"completion_tokens":48,"total_tokens":625,"duration_ms":12042,"needed_repair":false}
```

- Cost estimate for 10,000 requests/day: At ~625 total tokens/call (~5.77M prompt tokens, ~0.48M completion tokens per 10k requests) using an industry-standard tier model like Llama 3.3 70B ($0.12/M prompt, $0.30/M completion), the projected operational cost is approximately $0.84 per day.

## What I'd Fix With Another Day
With an extra day, I would implement an in-memory hash cache (keyed on the MD5 hash of the normalized input payload + prompt version) to avoid expending LLM tokens on identical books, add rate-limit queueing with a 1.5-second pacing delay between automated eval runs, and implement native JSON Schema structured outputs (response_format: { type: "json_object" }) to eliminate the need for the fallback repair retry loop entirely.

## Scraper Specification

### 1. Target Classification
- Target Site: Books to Scrape (https://books.toscrape.com)

- Purpose / Why: The site is explicitly built as an open sandbox for developers to practice web scraping.

- Scope: The first 3 catalogue pages only (60 books total).

- Data to Collect: Title, canonical product URL, original price text, cleaned numeric GBP price, availability text, star rating, product description, source page URL, and fetch timestamp.

- Justification: Scraping this site is appropriate because it is a dedicated educational sandbox with synthetic data designed specifically for scraper development.

- Robots.txt Result: Requested https://books.toscrape.com/robots.txt — no robots file found (404).

> "I will not reuse this code on another site without checking its rules and terms first."

### 2. Setup & Execution
- Environment: Node.js (v18+)
```bash
cd scraper #Navigate to the scraper directory
npm install cheerio zod openai express #Install dependencies
node src/index.js #Run scraper
node --env-file=.env server.js #Run enrichment API
node evals/run-eval.js #Run evaluation suite
```

### 3. Record Schema
Each record is validated using Zod before being saved to output/books.json:

```TypeScript
{
  title: string;              // Required, non-empty book title
  product_url: string;        // Absolute canonical URL starting with https://
  price_text: string;         // Raw extracted price string (e.g., "£51.77")
  price_gbp: number;          // Normalized positive float (e.g., 51.77)
  availability_text: string;  // Normalized stock text (e.g., "In stock (22 available)")
  rating_text?: string | null;// Star rating text (e.g., "Three", "Five") or null
  description?: string | null;// Book description text or null if omitted
  source_page: string;        // Origin catalogue URL (https://)
  fetched_at: string;         // ISO timestamp of when the page was downloaded
}
```
### 4. Politeness Rules & Architecture

- Custom User-Agent: Sends a transparent header (FlyRankInternship-A9/1.0 (+https://github.com/...)) identifying the crawler.

- Rate Limiting: Enforces a 600ms pause between real network requests to avoid overloading the server.

- Aggressive Caching: Saves raw HTML responses locally to cache/ (ignored by git). Subsequent executions read directly from disk with zero network overhead.

- Timeouts & Failure Isolation: Every network fetch uses a 10-second abort signal timeout. The scraper retries once on transient network drops or 5xx errors, but skips immediately without retry on 404 or 403 status codes.

- Headless-Free Architecture: The target pages use static server-side rendering (SSR). Spawning a headless browser (Puppeteer/Playwright) would add unnecessary CPU, memory, and runtime overhead.

### 5. Honest Limitations

The parsing selectors depend directly on the current CSS class structure (e.g., .product_main, .star-rating). If the website template or DOM layout changes, the parser will fail validation.

### 6. Execution Proof

```JSON
{
  "start_time": "2026-08-25T18:17:09.616Z",
  "duration_ms": 49439,
  "pages_fetched": 63,
  "cache_hits": 0,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 1
}
```
### 7. Web Scraping Ethics Note

- It is ethically preferable to use an official API or data dump if one exists instead of scraping web pages.

- It is never acceptable to bypass authentication barriers, login gates, paywalls, CAPTCHAs, or IP blocks.

- Extract only the specific fields necessary for the application, rate-limit outgoing traffic, and honor robots.txt guidelines.

## Stub Mode & Input Validation Testing

Valid Request (Expect 200 OK)

```bash
curl -i -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "title": "A Light in the Attic",
    "price_text": "£51.77",
    "availability_text": "In stock (22 available)",
    "rating_text": "Three",
    "description": "A book of poetry."
  }'
```
  Invalid Request - Missing Required Field (Expect 400 Bad Request)

```Bash

  curl -i -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "price_text": "£51.77"
  }'
```