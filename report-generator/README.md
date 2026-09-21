# Bookstore PDF Report Service

## Overview
A lightweight PDF report generation pipeline built with Node.js, Express, SQLite (`better-sqlite3`), and Playwright. The service queries aggregated book inventory data, renders it into an HTML template with print-safe pagination CSS, compiles it into a downloadable PDF via headless Chromium, and exposes the workflow over an idempotent REST API.

---

## Dataset
* **The Bookstore:** 60 validated book records previously scraped from `books.toscrape.com` stored in `books.json`.
* Fields tracked in SQLite: `id`, `title`, `price`, `rating`, and `url`.

---

## How to Run

### 1. Prerequisites & Installation

```bash
npm install
npx playwright install chromium
```

### 2. Seed the Database

```bash
node seed.js
```

> Wipes any prior rows and seeds report.db cleanly with the records from books.json.

### 3. Start API server

```bash
npm start
```

> The server listens on http://localhost:3000.

## Aggregation SQL

The report is computed using 4 SQL aggregation queries:

```SQL
-- 1. Total number of books
SELECT COUNT(*) AS totalBooks FROM books;

-- 2. Average price across all books
SELECT ROUND(AVG(price), 2) AS avgPrice FROM books;

-- 3. Top 5 most expensive books
SELECT title, price, rating, url
FROM books
ORDER BY price DESC
LIMIT 5;

-- 4. Number of books per star rating
SELECT rating, COUNT(*) AS count
FROM books
GROUP BY rating
ORDER BY rating ASC;
```

## POST -> Download Proof

### 1. Request Report Generator

```Bash
curl -i -X POST http://localhost:3000/reports
```

Output:

```HTTP
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"id":1,"file":"/reports/1/file"}
```
### 2. Download the Generated File

```Bashcurl -o my-report.pdf http://localhost:3000/reports/1/file
```

(The binary PDF is streamed from disk and saved as my-report.pdf, complete with clean page breaks and repeating table headers).

## REFLECTIONS
> This work should be moved out of the request cycle and into a background job queue as soon as multiple users generate reports concurrently or when rendering exceeds 2–3 seconds, preventing blocked server threads and HTTP request timeouts.

> This daily check protects against accidental double-submissions caused by repeated clicks, client retries, or multiple workers requesting duplicate resources for the same day. In real-world systems, omitting an idempotency check can cost money by triggering duplicate payment gateway charges or dispatching duplicate paid transactional emails/SMS to customers.

## Report Preview