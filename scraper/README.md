# Scrappy - The Polite Web Scraper

A robust, polite web scraper built in JavaScript (Node.js) that extracts structured book catalogue data from Books to Scrape.

## 1. Target Classification

* **Target Site:** Books to Scrape (`https://books.toscrape.com`)
* **Purpose / Why:** The site is explicitly built as an open sandbox for developers to practice web scraping.
* **Scope:** The first 3 catalogue pages only (60 books total).
* **Data to Collect:** Title, canonical product URL, original price text, cleaned numeric GBP price, availability text, star rating, product description, source page URL, and fetch timestamp.
* **Justification:** Scraping this site is appropriate because it is a dedicated educational sandbox with synthetic data designed specifically for scraper development.
* **Robots.txt Result:** Requested `https://books.toscrape.com/robots.txt` — no robots file found (404).

> "I will not reuse this code on another site without checking its rules and terms first."

---
## 2. Setup & Execution

### Prerequisites & Installation
* **Environment:** Node.js (v18+)

```bash
# Navigate to the scraper directory
cd scraper

# Install dependencies (cheerio, zod)
npm install cheerio
npm install zod
```

Run command:
```bash
node scr/index.js
```

## 3. Record Schema

Each record is validated using Zod before being saved to output/books.json:

```bash
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

## 4. Politeness Rules & Architecture
- Custom User-Agent: Sends a transparent, identifying header (...) so site maintainers can identify the crawler.
- Rate Limiting: Enforces a 600ms pause between real network requests to avoid overloading the server.
- Aggressive Caching: Saves raw HTML responses locally to cache/ (ignored by git). Subsequent executions read directly from disk with zero network overhead.
- Timeouts & Failure Isolation: Every network fetch uses a 10-second abort signal timeout. The scraper retries once on transient network drops or 5xx errors, but skips immediately without retry on 404 or 403 status codes.
- Headless-Free Architecture: The target pages are static server-rendered HTML. Because all required data resides in the initial HTTP response, spawning a headless browser (like Puppeteer or Playwright) would only add unnecessary CPU, memory, and runtime costs.

## 5. Honest Limitations

The parsing selectors depend directly on the current CSS class structure (e.g., .product_main, .star-rating). If the website template or DOM layout updates, the parser will fail validation.

## 6. Execution Proof

```bash
run-report.json:
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
This assignment needed no browser because the target website uses static server-side rendering (SSR).

The data is already in the raw HTML, when the script sends a basic HTTP GET request, the web server returns a complete HTML document that already contains all the book titles, prices, descriptions, ratings, and pagination links


## 7. Web Scrapping Ethics Note

- Its ethically better to use an official API or data dump exists instead of scraping web pages.
- Its never okay to bypass authentication barriers, login gates, paywalls, CAPTCHA's or IP blocks.
- one should colelct only the specific fields necessary for the application, rate-limit your traffic, and honor robots.txt guidelines.



