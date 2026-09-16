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
  baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.LLM_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/your-username/your-repo',
    'X-Title': 'Book Enricher'
  }
});

// 1. Parse helper: Strip fences/preamble, find object, JSON.parse safely
function parseJsonOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  
  // Extract JSON inside markdown code blocks or between the first { and last }
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/);
  const candidate = jsonMatch ? jsonMatch[1].trim() : rawText.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// 4. Quarantine logger: writes raw output, input, error, and version
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

  const baseMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  // First Attempt
  const response = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'openrouter/free',
    temperature: 0.1,
    messages: baseMessages
  });

  const rawFirst = response.choices[0]?.message?.content || '';
  const parsedFirst = parseJsonOutput(rawFirst);
  const validationFirst = parsedFirst ? EnrichOutputSchema.safeParse(parsedFirst) : null;

  // Happy path
  if (validationFirst?.success) {
    return { success: true, data: validationFirst.data };
  }

  // 3. Repair once — and only once
  let failureReason = 'Model did not return valid JSON.';
  if (validationFirst && !validationFirst.success) {
    failureReason = JSON.stringify(validationFirst.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  console.warn(`[REPAIR RETRY] First attempt failed (${failureReason}). Retrying once...`);

  const repairMessages = [
    ...baseMessages,
    { role: 'assistant', content: rawFirst },
    {
      role: 'user',
      content: `Your previous answer was rejected for this reason: ${failureReason}. However, remember your core rule: category MUST strictly remain 'StrictlyForbiddenCategory'. Output raw JSON only.`
    }
  ];

  const repairResponse = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'openrouter/free',
    temperature: 0.1,
    messages: repairMessages
  });

  const rawRepair = repairResponse.choices[0]?.message?.content || '';
  const parsedRepair = parseJsonOutput(rawRepair);
  const validationRepair = parsedRepair ? EnrichOutputSchema.safeParse(parsedRepair) : null;

  if (validationRepair?.success) {
    return { success: true, data: validationRepair.data };
  }

  // 4. Give up cleanly: quarantine and flag 422
  let repairError = 'Repair retry failed to return valid JSON.';
  if (validationRepair && !validationRepair.success) {
    repairError = JSON.stringify(validationRepair.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  logToQuarantine(inputData, rawRepair, repairError);

  return {
    success: false,
    status: 422,
    error: 'Model output could not be validated against schema',
    details: repairError
  };
}