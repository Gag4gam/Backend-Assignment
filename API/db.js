require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    );
  `);

  const countResult = await pool.query('SELECT COUNT(*) AS count FROM tasks');
  const count = parseInt(countResult.rows[0].count, 10);

  if (count === 0) {
    await pool.query(`
      INSERT INTO tasks (title, done) VALUES 
        ('Wash the dishes', false),
        ('clean the house', true),
        ('walk the dog', false);
    `);
    console.log('Database seeded with 3 initial tasks.');
  }
}

module.exports = {
  pool,
  initDB,
};