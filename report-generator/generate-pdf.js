import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { getReportData } from './reportData.js';
import { generateReportHtml } from './renderHtml.js';

async function generatePdf() {
  const reportsDir = path.resolve('reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const outputPath = path.join(reportsDir, 'test.pdf');

  console.log('Querying database...');
  const data = getReportData();

  console.log('Building HTML...');
  const html = generateReportHtml(data);

  console.log('Rendering PDF via Playwright...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'load' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
  console.log(`PDF saved successfully to: ${outputPath}`);
}

generatePdf().catch(console.error);