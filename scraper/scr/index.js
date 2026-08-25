import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { z } from 'zod';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '..', 'cache');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

const START_URL = 'https://books.toscrape.com/catalogue/page-1.html';
const MAX_PAGES = 3;
const REQUEST_DELAY_MS = 600;

const HEADERS = {
  'User-Agent': 'FlyRankInternship-A5/1.0 (+https://github.com/your-username/your-repo)'
};

// --- Zod Schema Definition ---
const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url().startsWith('https://'),
  price_text: z.string().min(1),
  price_gbp: z.number().positive(),
  availability_text: z.string().min(1),
  rating_text: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  source_page: z.string().url().startsWith('https://'),
  fetched_at: z.string().min(1)
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate a unique, safe filename for each page/product URL
function getCacheFilePath(url) {
  const parsed = new URL(url);
  const sanitized = parsed.pathname
    .replace(/^\/+/g, '')
    .replace(/\/+/g, '_');
  return path.join(CACHE_DIR, `${sanitized || 'index'}.html`);
}

// Fetch with cache & rate limiting
async function fetchPage(url) {
  const cachePath = getCacheFilePath(url);

  // 1. Local cache hit
  if (fs.existsSync(cachePath)) {
    const html = fs.readFileSync(cachePath, 'utf-8');
    const size = Buffer.byteLength(html, 'utf-8');
    console.log(`CACHE HIT - ${url} - Size: ${size} bytes`);
    return { html, fetchedAt: fs.statSync(cachePath).mtime.toISOString() };
  }

  // 2. Network request delay
  await sleep(REQUEST_DELAY_MS);

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000)
    });

    if (response.status !== 200) {
      console.error(`FETCH FAILED - Status: ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const fetchedAt = new Date().toISOString();

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, html, 'utf-8');

    const size = Buffer.byteLength(html, 'utf-8');
    console.log(`FETCH - Status: ${response.status} OK - ${url} - Size: ${size} bytes`);
    return { html, fetchedAt };
  } catch (error) {
    console.error(`FETCH FAILED: ${error.message}`);
    return null;
  }
}

// Parse book data from product detail page
function parseAndCleanBookDetail(html, productUrl, sourcePage, fetchedAt) {
  const $ = cheerio.load(html);
  const productMain = $('.product_main');

  const title = productMain.find('h1').text().trim();
  const priceText = productMain.find('p.price_color').text().trim();

  const numericPriceMatch = priceText.match(/([\d.]+)/);
  const priceGbp = numericPriceMatch ? parseFloat(numericPriceMatch[0]) : null;


  const availabilityText = productMain.find('p.instock.availability').text().replace(/\s+/g, ' ').trim();

  const starClasses = productMain.find('p.star-rating').attr('class') || '';
  const ratingMatch = starClasses.split(/\s+/).find((cls) => cls !== 'star-rating');
  const ratingText = ratingMatch || null;

  const descriptionElem = $('#product_description + p');
  const description = descriptionElem.length > 0 ? descriptionElem.text().trim() : null;

  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    price_gbp: priceGbp,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: fetchedAt
  };
}

async function scrap() {
  let currentUrl = START_URL;
  let pagesVisited = 0;
  const discoveredEntries = [];

  while (currentUrl && pagesVisited < MAX_PAGES) {
    const result = await fetchPage(currentUrl);
    if (!result) break;

    pagesVisited += 1;
    const $ = cheerio.load(result.html);

    $('article.product_pod h3 a').each((_, elem) => {
      const relativeHref = $(elem).attr('href');
      if (relativeHref) {
        const absoluteUrl = new URL(relativeHref, currentUrl).href;
        discoveredEntries.push({
          productUrl: absoluteUrl,
          sourcePage: currentUrl
        });
      }
    });

    const nextHref = $('li.next a').attr('href');
    if (nextHref && pagesVisited < MAX_PAGES) {
      currentUrl = new URL(nextHref, currentUrl).href;
    } else {
      currentUrl = null;
    }
  }

  // Deduplicate discovered URLs while retaining first encountered source_page
  const uniqueMap = new Map();
  for (const entry of discoveredEntries) {
    if (!uniqueMap.has(entry.productUrl)) {
      uniqueMap.set(entry.productUrl, entry.sourcePage);
    }
  }

  const validRecords = [];
  const errorRecords = [];

  for (const [productUrl, sourcePage] of uniqueMap.entries()) {
    const pageResult = await fetchPage(productUrl);
    if (!pageResult) {
        errorRecords.push({ url: productUrl, error: 'Failed to fetch page' });
        continue;
    }

    const rawRecord = parseAndCleanBookDetail(pageResult.html, productUrl, sourcePage, pageResult.fetchedAt);

    const validation = BookSchema.safeParse(rawRecord);
    if (validation.success) {
      validRecords.push(validation.data);
    } else {
        errorRecords.push({
            raw: rawRecord,
            errors: validation.error.format()
        });
    }
}
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'books.json'), JSON.stringify(validRecords, null, 2), 'utf-8');

  if (errorRecords.length > 0) {
    fs.writeFileSync(path.join(OUTPUT_DIR, 'errors.json'), JSON.stringify(errorRecords, null, 2), 'utf-8');
  }

  console.log(`\n--- CHECKPOINT RESULT ---`);
  console.log(`books.json count: ${validRecords.length}`);
  console.log(`errors.json count: ${errorRecords.length}`);
}

scrap();