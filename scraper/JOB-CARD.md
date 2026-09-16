# Job card

What it does (one sentence): Enriches scraped book catalogue records with a normalized category, a concise summary, and data quality flags.

Input:
```json
{
  "title": "string, required",
  "price_text": "string, required",
  "availability_text": "string, required",
  "rating_text": "string or null",
  "description": "string or null"
}
```

Output:
```json
{
  "category": "one of [Fiction|Nonfiction|Children|Young Adult|Poetry|Art|Academic|Other]",
  "summary": "one concise sentence describing the book based on the description/title",
  "quality_flags": ["array of zero or more strings from: missing_description, unusual_price, low_rating, low_stock"]
}
```