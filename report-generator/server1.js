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

app.post('/reports', async (req, res) => {
  try {
    const data = getReportData();

    const html = generateReportHtml(data);

    const insertStmt = db.prepare('INSERT INTO reports (path) VALUES (?)');
    const result = insertStmt.run('pending');
    const reportId = result.lastInsertRowid;

    const fileName = `${reportId}.pdf`;
    const filePath = path.join(reportsDir, fileName);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
    });
    await browser.close();

    db.prepare('UPDATE reports SET path = ? WHERE id = ?').run(filePath, reportId);

    res.status(201).json({
      id: reportId,
      file: `/reports/${reportId}/file`,
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Falha ao processar o relatório' });
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