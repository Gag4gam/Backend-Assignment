import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf-8'));

const ENDPOINT_URL = process.env.API_URL || 'http://localhost:3000/enrich';

async function runEvals() {
  console.log(`Starting eval run against ${ENDPOINT_URL} (${cases.length} cases)...\n`);

  let passed = 0;
  const failedCases = [];

  for (const testCase of cases) {
    try {
      const res = await fetch(ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.input)
      });

      if (!res.ok) {
        failedCases.push({
          id: testCase.id,
          title: testCase.input.title,
          expected: testCase.expected_category,
          got: `HTTP Status ${res.status}`
        });
        continue;
      }

      const data = await res.json();
      const match = data.category === testCase.expected_category;

      if (match) {
        passed += 1;
        console.log(`✔ Case ${testCase.id}: [${testCase.input.title}] -> ${data.category}`);
      } else {
        console.log(`✖ Case ${testCase.id}: [${testCase.input.title}] -> Expected '${testCase.expected_category}', got '${data.category}'`);
        failedCases.push({
          id: testCase.id,
          title: testCase.input.title,
          expected: testCase.expected_category,
          got: data.category
        });
      }
    } catch (err) {
      failedCases.push({
        id: testCase.id,
        title: testCase.input.title,
        expected: testCase.expected_category,
        got: `Request Failed: ${err.message}`
      });
    }
  }

  const accuracy = ((passed / cases.length) * 100).toFixed(1);
  console.log('\n--- EVAL SUMMARY ---');
  console.log(`Score: ${passed}/${cases.length} (${accuracy}%)`);

  if (failedCases.length > 0) {
    console.log('\nFailed Cases:');
    failedCases.forEach((f) => console.log(` - Case ${f.id} (${f.title}): Expected '${f.expected}', Got '${f.got}'`));
  }
}

runEvals();