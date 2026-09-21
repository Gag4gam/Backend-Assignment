import Database from 'better-sqlite3';

export function getReportData(dbPath = 'report.db') {
    const db = new Database(dbPath, { readonly: true });

    const { totalBooks} = db
      .prepare('SELECT COUNT(*) as totalBooks FROM books')
        .get();

    const { avgPrice } = db
      .prepare('SELECT ROUND(AVG(price), 2) AS avgPrice FROM books')
      .get();

    const topExpensiveBooks = db
      .prepare(`
        SELECT title, price, rating, url
        FROM books
        ORDER BY price DESC
        LIMIT 5
      `)
      .all();

    const booksPerRating = db
        .prepare(`
            SELECT rating, COUNT(*) as count
            FROM books
            GROUP BY rating
            ORDER BY rating ASC
        `)
        .all();

    const allBooks = db
    .prepare(`
      SELECT id, title, price, rating
      FROM books
      ORDER BY id ASC
    `)
    .all();

    db.close();

    return {
        totalBooks,
        averagePrice: avgPrice,
        topExpensiveBooks,
        booksPerRating,
        allBooks,
    };
}