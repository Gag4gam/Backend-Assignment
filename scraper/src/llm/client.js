import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { EnrichOutputSchema } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, '../../prompts/enrich-v1.md');
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const QUARANTINE_PATH = path.join(LOGS_DIR, 'quarantine.jsonl');

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || '[https://openrouter.ai/api/v1](https://openrouter.ai/api/v1)',
  apiKey: process.env.LLM_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': '[https://github.com/Gag4gam/Backend-Assignment](https://github.com/Gag4gam/Backend-Assignment)',
    'X-Title': 'Book Enricher'
  }
});

// Helper to strip markdown code blocks and extract raw JSON
function extractJson(rawText) {
  if (!rawText) return null;
  // Match text inside ```json ... ``` or extract the outer braces { ... }
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/);
  const candidate = jsonMatch ? jsonMatch[1] : rawText.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// Log unrecoverable failures to quarantine
function logToQuarantine(inputData, rawOutput, error) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: 'v1',
    input: inputData,
    raw_output: rawOutput,
    error: error
  };
  fs.appendFileSync(QUARANTINE_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function processEnrichment(inputData) {
  const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  const userContent = JSON.stringify(inputData);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  // 1. Initial LLM Call
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'openrouter/free',
    temperature: 0.1,
    messages
  });

  const rawFirst = response.choices[0]?.message?.content || '';
  const parsedFirst = extractJson(rawFirst);
  const validFirst = parsedFirst ? EnrichOutputSchema.safeParse(parsedFirst) : null;

  if (validFirst?.success) {
    return { success: true, data: validFirst.data };
  }

  // 2. Repair Attempt (Once and only once)
  const validationError = validFirst ? JSON.stringify(validFirst.error.format()) : 'Failed to parse JSON';
  console.warn(`[REPAIR TRIGGERED] First attempt failed. Error: ${validationError}`);

  const repairMessages = [
    ...messages,
    { role: 'assistant', content: rawFirst },
    {
      role: 'user',
      content: `Your previous answer was rejected for this reason: ${validationError}. Return only corrected JSON matching the schema.`
    }
  ];

  const repairResponse = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'openrouter/free',
    temperature: 0.1,
    messages: repairMessages
  });

  const rawRepair = repairResponse.choices[0]?.message?.content || '';
  const parsedRepair = extractJson(rawRepair);
  const validRepair = parsedRepair ? EnrichOutputSchema.safeParse(parsedRepair) : null;

  if (validRepair?.success) {
    return { success: true, data: validRepair.data };
  }

 // 3. Complete Failure: Quarantine
  let finalError = 'Repair failed to yield valid JSON';
  if (validRepair && !validRepair.success && validRepair.error) {
    finalError = JSON.stringify(validRepair.error.format());
  } else if (!validRepair) {
    finalError = 'Failed to extract JSON from repair output';
  } else {
    finalError = 'Output rejected by validation rules';
  }

  logToQuarantine(inputData, rawRepair || rawFirst, finalError);

  return {
    success: false,
    status: 422,
    error: 'Model output could not be validated against schema',
    details: finalError
  };
}