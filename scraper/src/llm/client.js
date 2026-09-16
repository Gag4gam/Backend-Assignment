import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { EnrichOutputSchema } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, '../../prompts/enrich-v1.md');
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const QUARANTINE_PATH = path.join(LOGS_DIR, 'quarantine.jsonl');

// 1. Set explicit timeout (30s) and disable silent SDK auto-retries (maxRetries: 0)
const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  apiKey: process.env.LLM_API_KEY,
  timeout: 30000,
  maxRetries: 0,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/your-username/your-repo',
    'X-Title': 'Book Enricher'
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. Custom Retry Engine with exponential backoff and jitter
async function callWithRetry(apiCallFn, maxAttempts = 3) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await apiCallFn();
    } catch (err) {
      const status = err.status || (err.name === 'APIConnectionTimeoutError' ? 504 : null);

      // NEVER retry 400, 401, or 403
      if (status === 400 || status === 401 || status === 403) {
        console.warn(`[RETRY ENGINE] Non-retryable client error (${status}). Failing immediately.`);
        throw err;
      }

      // Check if retryable: timeouts, 429, or 5xx
      const isTimeout = err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT';
      const isRetryable = isTimeout || status === 429 || (status >= 500 && status <= 599);

      if (!isRetryable || attempt >= maxAttempts) {
        throw err;
      }

      // Handle Retry-After header if provided on 429
      let delayMs;
      const retryAfterHeader = err.headers?.['retry-after'];
      if (status === 429 && retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        delayMs = isNaN(parsed) ? 2000 : parsed * 1000;
      } else {
        // Exponential backoff: 1s, 2s, 4s... plus random jitter (0 - 500ms)
        const baseDelay = Math.pow(2, attempt - 1) * 1000;
        const jitter = Math.floor(Math.random() * 500);
        delayMs = baseDelay + jitter;
      }

      console.warn(`[RETRY ENGINE] Attempt ${attempt} encountered ${status || err.name}. Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }
}

function parseJsonOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/(\{[\s\S]*\})/);
  const candidate = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

// 3. Structured Cost / Token Logging
function logUsage({ model, usage, durationMs, neededRepair }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    prompt_version: 'v1',
    model,
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    duration_ms: durationMs,
    needed_repair: neededRepair
  };
  console.log(`[LLM USAGE] ${JSON.stringify(logEntry)}`);
}

function logToQuarantine(inputData, rawOutput, error) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    prompt_version: 'v1',
    input: inputData,
    raw_output: rawOutput,
    error
  };
  fs.appendFileSync(QUARANTINE_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

export async function processEnrichment(inputData) {
  const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  const userContent = JSON.stringify(inputData);
  const modelName = process.env.LLM_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

  const baseMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ];

  const startTime = Date.now();
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  // First Attempt
  const response = await callWithRetry(() =>
    openai.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      messages: baseMessages
    })
  );

  if (response.usage) {
    totalUsage.prompt_tokens += response.usage.prompt_tokens || 0;
    totalUsage.completion_tokens += response.usage.completion_tokens || 0;
    totalUsage.total_tokens += response.usage.total_tokens || 0;
  }

  const rawFirst = response.choices[0]?.message?.content || '';
  const parsedFirst = parseJsonOutput(rawFirst);
  const validationFirst = parsedFirst ? EnrichOutputSchema.safeParse(parsedFirst) : null;

  if (validationFirst?.success) {
    logUsage({
      model: modelName,
      usage: totalUsage,
      durationMs: Date.now() - startTime,
      neededRepair: false
    });
    return { success: true, data: validationFirst.data };
  }

  // Repair Retry
  let failureReason = 'Model output did not match JSON schema';
  if (validationFirst && !validationFirst.success) {
    failureReason = JSON.stringify(validationFirst.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  console.warn(`[REPAIR RETRY] First attempt failed. Reason: ${failureReason}`);

  const repairMessages = [
    ...baseMessages,
    { role: 'assistant', content: rawFirst },
    {
      role: 'user',
      content: `Your previous answer was rejected for this reason: ${failureReason}. Return only corrected JSON matching the schema.`
    }
  ];

  const repairResponse = await callWithRetry(() =>
    openai.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      messages: repairMessages
    })
  );

  if (repairResponse.usage) {
    totalUsage.prompt_tokens += repairResponse.usage.prompt_tokens || 0;
    totalUsage.completion_tokens += repairResponse.usage.completion_tokens || 0;
    totalUsage.total_tokens += repairResponse.usage.total_tokens || 0;
  }

  logUsage({
    model: modelName,
    usage: totalUsage,
    durationMs: Date.now() - startTime,
    neededRepair: true
  });

  const rawRepair = repairResponse.choices[0]?.message?.content || '';
  const parsedRepair = parseJsonOutput(rawRepair);
  const validationRepair = parsedRepair ? EnrichOutputSchema.safeParse(parsedRepair) : null;

  if (validationRepair?.success) {
    return { success: true, data: validationRepair.data };
  }

  let finalError = 'Repair retry failed to return valid JSON';
  if (validationRepair && !validationRepair.success) {
    finalError = JSON.stringify(validationRepair.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }

  logToQuarantine(inputData, rawRepair, finalError);

  return {
    success: false,
    status: 422,
    error: 'Model output could not be validated against schema',
    details: finalError
  };
}