import express from 'express';
import { APIConnectionTimeoutError } from 'openai'; // <-- Add this import
import { EnrichInputSchema, EnrichOutputSchema, STUB_RESPONSE } from './src/llm/schema.js';
import { processEnrichment } from './src/llm/client.js';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`[${req.method}] ${req.originalUrl} -> Status: ${res.statusCode}`);
  });
  next();
});

function getDeterministicFallback(data) {
  const qualityFlags = [];
  if (!data.description || data.description.trim().length === 0) {
    qualityFlags.push('missing_description');
  }

  return {
    category: 'Other',
    summary: `${data.title} is available in the catalogue.`,
    quality_flags: qualityFlags
  };
}

app.post('/enrich', async (req, res) => {
  const inputValidation = EnrichInputSchema.safeParse(req.body);

  if (!inputValidation.success) {
    return res.status(400).json({
      error: 'Invalid request payload',
      details: inputValidation.error.issues
    });
  }

  if (process.env.LLM_ENABLED === 'false') {
    const fallback = getDeterministicFallback(inputValidation.data);
    return res.status(200).json(EnrichOutputSchema.parse(fallback));
  }

  if (process.env.LLM_STUB === '1') {
    return res.status(200).json(EnrichOutputSchema.parse(STUB_RESPONSE));
  }

  try {
    const result = await processEnrichment(inputValidation.data);

    if (!result.success) {
      return res.status(result.status || 422).json({
        error: result.error,
        details: result.details
      });
    }

    return res.status(200).json(result.data);
  } catch (error) {
    // 1. Timeout -> 504 Gateway Timeout
    if (
      error instanceof APIConnectionTimeoutError ||
      error.name === 'APIConnectionTimeoutError' ||
      error.code === 'ETIMEDOUT'
    ) {
      return res.status(504).json({ error: 'LLM provider timed out after 30 seconds' });
    }

    // 2. Auth failure -> 502 Bad Gateway
    if (error.status === 401 || error.status === 403) {
      return res.status(502).json({ error: 'LLM provider authentication failed' });
    }

    // 3. Upstream downtime/rate limit -> 503 Service Unavailable
    if (error.status === 429 || (error.status >= 500 && error.status <= 599)) {
      return res.status(503).json({ error: 'LLM provider temporarily unavailable' });
    }

    console.error('Unhandled enrichment failure:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});