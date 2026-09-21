export function generateReportHtml(data) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const topBooksRows = data.topExpensiveBooks
    .map(
      (b) => `
      <tr>
        <td>${b.title}</td>
        <td>£${b.price.toFixed(2)}</td>
        <td>${'★'.repeat(b.rating)}${'☆'.repeat(5 - b.rating)}</td>
      </tr>`
    )
    .join('');

  const allBooksRows = data.allBooks
  .map(
    (b, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${b.title}</td>
      <td>£${b.price.toFixed(2)}</td>
      <td>${b.rating} / 5</td>
    </tr>`
  )
  .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bookstore Inventory Report</title>
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }

    h1 {
      margin: 0 0 4px 0;
      color: #0f172a;
      font-size: 24px;
    }

    .date {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 24px;
    }

    .stats-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
    }

    .stat-card {
      flex: 1;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }

    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }

    h2 {
      font-size: 16px;
      color: #1e293b;
      margin: 24px 0 12px 0;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12px;
    }

    th {
      background-color: #f1f5f9;
      color: #475569;
      text-align: left;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }

    td {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
    }

    /* Print pagination rules to avoid sliced rows and repeat headers */
    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <h1>Bookstore Inventory Report</h1>
  <div class="date">Generated on ${today}</div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Books</div>
      <div class="stat-value">${data.totalBooks}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Average Price</div>
      <div class="stat-value">£${data.averagePrice.toFixed(2)}</div>
    </div>
  </div>

  <h2>Top 5 Most Expensive Books</h2>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th style="width: 100px;">Price</th>
        <th style="width: 120px;">Rating</th>
      </tr>
    </thead>
    <tbody>
      ${topBooksRows}
    </tbody>
  </table>

  <h2>Full Catalogue (${data.totalBooks} Books)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Title</th>
        <th style="width: 100px;">Price</th>
        <th style="width: 80px;">Rating</th>
      </tr>
    </thead>
    <tbody>
      ${allBooksRows}
    </tbody>
  </table>
</body>
</html>`;
}