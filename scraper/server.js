import express from 'express';
import { EnrichInputSchema, EnrichOutputSchema, STUB_RESPONSE } from './src/llm/schema.js';

const app = express();
app.use(express.json());

// POST /enrich endpoint
app.post('/enrich', (req, res) => {
  // 1. Validate incoming body with Zod
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

  // 2. Stub mode (LLM_STUB=1)
  if (process.env.LLM_STUB === '1') {
    const validatedStub = EnrichOutputSchema.parse(STUB_RESPONSE);
    return res.status(200).json(validatedStub);
  }

  // Real LLM call will be wired in Stage 2
  return res.status(501).json({ message: 'Live model call not wired yet. Set LLM_STUB=1.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});