import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('QWeather update script reads credentials from environment only', async () => {
  const script = await readFile(new URL('../scripts/update-qweather-data.js', import.meta.url), 'utf8');

  assert.match(script, /QWEATHER_PROJECT_ID/);
  assert.match(script, /QWEATHER_CREDENTIAL_ID/);
  assert.match(script, /QWEATHER_PRIVATE_KEY/);
  assert.match(script, /data\/typhoon-bavi\.json/);
  assert.doesNotMatch(script, /CHPN57P5YJ/);
});

test('GitHub Actions workflow updates data without exposing QWeather secrets to the frontend', async () => {
  const workflow = await readFile(new URL('../.github/workflows/update-typhoon-data.yml', import.meta.url), 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: '0 \* \* \* \*'/);
  assert.match(workflow, /QWEATHER_PROJECT_ID: \$\{\{ secrets\.QWEATHER_PROJECT_ID \}\}/);
  assert.match(workflow, /QWEATHER_CREDENTIAL_ID: \$\{\{ secrets\.QWEATHER_CREDENTIAL_ID \}\}/);
  assert.match(workflow, /QWEATHER_PRIVATE_KEY: \$\{\{ secrets\.QWEATHER_PRIVATE_KEY \}\}/);
  assert.match(workflow, /node scripts\/update-qweather-data\.js/);
});
