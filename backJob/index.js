import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Stage 0: Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});