import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('typhoon data exposes the fields the frontend needs', async () => {
  const raw = await readFile(new URL('../data/typhoon-bavi.json', import.meta.url), 'utf8');
  const data = JSON.parse(raw);

  assert.equal(data.meta.currentStormName, '巴威');
  assert.equal(data.meta.year, 2026);
  assert.equal(data.meta.isLiveLike, true);
  assert.ok(data.sources.length >= 1);
  assert.ok(data.track.some((point) => point.type === 'observed'));
  assert.ok(data.track.some((point) => point.type === 'forecast'));
  assert.ok(data.track.every((point) => typeof point.lat === 'number' && typeof point.lon === 'number'));
  assert.ok(data.hangzhou.lat);
  assert.ok(data.hangzhou.lon);
});
