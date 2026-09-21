import express from 'express';
import Database from 'better-sqlite3';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { getReportData } from './reportData.js';
import { generateReportHtml } from './renderHtml.js';

const app = express();

const PORT = 3000;

app.use(express.json());

const db = new Database('report.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const reportsDir = path.resolve('reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// POST /reports: Idempotent report generation
app.post('/reports', async (req, res) => {
  try {
    const force = Boolean(req.body?.force);

    // 1. Idempotency check: look for any report generated today
    if (!force) {
      const existingReport = db
        .prepare(`
          SELECT id, path, created_at 
          FROM reports 
          WHERE date(created_at) = date('now')
          ORDER BY id DESC 
          LIMIT 1
        `)
        .get();

      // If already generated today and the file exists on disk, return 200 with the existing report
      if (existingReport && fs.existsSync(existingReport.path)) {
        return res.status(200).json({
          id: existingReport.id,
          file: `/reports/${existingReport.id}/file`,
        });
      }
    }

    // 2. Query and HTML rendering
    const data = getReportData();
    const html = generateReportHtml(data);

    // 3. Reserve a new row in reports
    const insertStmt = db.prepare('INSERT INTO reports (path) VALUES (?)');
    const result = insertStmt.run('pending');
    const reportId = result.lastInsertRowid;

    const fileName = `${reportId}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    // 4. Render with Playwright
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
    });
    await browser.close();

    // 5. Update path and return 201 Created
    db.prepare('UPDATE reports SET path = ? WHERE id = ?').run(filePath, reportId);

    return res.status(201).json({
      id: reportId,
      file: `/reports/${reportId}/file`,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/reports/:id', (req, res) => {
  const row = db
    .prepare('SELECT id, path, created_at FROM reports WHERE id = ?')
    .get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Relatório não encontrado' });
  }

  res.json({
    id: row.id,
    created_at: row.created_at,
    file: `/reports/${row.id}/file`,
  });
});

app.get('/reports/:id/file', (req, res) => {
  const row = db
    .prepare('SELECT path FROM reports WHERE id = ?')
    .get(req.params.id);

  if (!row || !fs.existsSync(row.path)) {
    return res.status(404).json({ error: 'Ficheiro não encontrado' });
  }

  res.sendFile(row.path);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});