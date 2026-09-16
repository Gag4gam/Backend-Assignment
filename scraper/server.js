import express from 'express';
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

app.post('/enrich', async (req, res) => {
  // Input validation
  const inputValidation = EnrichInputSchema.safeParse(req.body);

  if (!inputValidation.success) {
    const errorDetails = inputValidation.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));

    return res.status(400).json({
      error: 'Invalid request payload',
      details: errorDetails
    });
  }

  // Stub mode
  if (process.env.LLM_STUB === '1') {
    const validatedStub = EnrichOutputSchema.parse(STUB_RESPONSE);
    return res.status(200).json(validatedStub);
  }

  // Live Model Pipeline (Parse -> Validate -> Repair -> Quarantine)
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
    console.error('Unhandled enrichment failure:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});