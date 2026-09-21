import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('report.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        price REAL NOT NULL,
        rating REAL NOT NULL,
        url TEXT
    );
`);

db.exec('DELETE FROM books;');

const rawData = fs.readFileSync('books.json', 'utf-8');
const books = JSON.parse(rawData);

const ratingMap = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
};

const insertBook = db.prepare(`
    INSERT INTO books (title, price, rating, url)
    VALUES (@title, @price, @rating, @url);
`);

const insertMany = db.transaction((bookList) => {
  for (const book of bookList) {
    const numericPrice =
      book.price_gbp ??
      (book.price_text ? parseFloat(book.price_text.replace(/[^0-9.]/g, '')) : 0);

    const numericRating =
      ratingMap[book.rating_text] ?? (Number(book.rating_text) || 0);

    insertBook.run({
      title: book.title,
      price: numericPrice,
      rating: numericRating,
      url: book.product_url || book.url || '',
    });
  }
});

insertMany(books);

const rowCount = db.prepare('SELECT COUNT(*) as total FROM books').get();
console.log(`Seeding completed. Row count ${rowCount.total}`);

db.close();