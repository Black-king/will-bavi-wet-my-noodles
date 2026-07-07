# Typhoon Bavi MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Pages friendly MVP for "台风巴威：杭州生存指南" with static JSON data, a Leaflet map, Hangzhou-focused status cards, timeline playback, wind-circle display, and supply checklist.

**Architecture:** The frontend is a static HTML/CSS/JavaScript app. Data is read from `data/typhoon-bavi.json`, normalized by small pure functions in `src/typhoon-utils.js`, and rendered by `script.js`; future QWeather or other API updates only need to emit the same JSON shape.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Leaflet CDN, Node.js built-in `node:test` and `assert` for unit/static tests.

---

### Task 1: Data Utility Layer

**Files:**
- Create: `package.json`
- Create: `src/typhoon-utils.js`
- Create: `tests/typhoon-utils.test.js`

- [ ] **Step 1: Write the failing utility tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLatestObservedPoint,
  haversineDistanceKm,
  classifyHangzhouRisk,
  buildChecklistShareText,
  typhoonMood
} from '../src/typhoon-utils.js';

test('calculates distance from typhoon point to Hangzhou in kilometers', () => {
  const distance = haversineDistanceKm({ lat: 30.2741, lon: 120.1551 }, { lat: 25.0, lon: 125.0 });
  assert.equal(Math.round(distance), 754);
});

test('picks the latest observed point from mixed track data', () => {
  const point = getLatestObservedPoint([
    { type: 'observed', time: '2026-07-07T00:00:00+08:00', windSpeedMps: 42 },
    { type: 'forecast', time: '2026-07-07T12:00:00+08:00', windSpeedMps: 48 },
    { type: 'observed', time: '2026-07-07T06:00:00+08:00', windSpeedMps: 45 }
  ]);
  assert.equal(point.time, '2026-07-07T06:00:00+08:00');
});

test('classifies Hangzhou risk from distance and wind speed', () => {
  assert.equal(classifyHangzhouRisk({ distanceKm: 180, windSpeedMps: 46 }).level, 'high');
  assert.equal(classifyHangzhouRisk({ distanceKm: 520, windSpeedMps: 35 }).level, 'medium');
  assert.equal(classifyHangzhouRisk({ distanceKm: 1100, windSpeedMps: 30 }).level, 'watch');
});

test('maps typhoon mood to wind intensity', () => {
  assert.equal(typhoonMood(28), 'alert');
  assert.equal(typhoonMood(45), 'angry');
  assert.equal(typhoonMood(58), 'furious');
});

test('builds share text from checked supplies', () => {
  const text = buildChecklistShareText(['充电宝', '饮用水'], {
    riskLabel: '较高',
    distanceKm: 520,
    updatedAt: '2026-07-07 18:00'
  });
  assert.match(text, /杭州抗台指数：较高/);
  assert.match(text, /距离杭州约 520 km/);
  assert.match(text, /充电宝、饮用水/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `src/typhoon-utils.js` does not exist.

- [ ] **Step 3: Implement the utility module and test script**

Create `package.json` with `"type": "module"` and `"test": "node --test tests/*.test.js"`.

Implement `src/typhoon-utils.js` with exported pure functions for distance calculation, latest observed point selection, risk classification, mood labels, and checklist share text.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS with all utility tests passing.

### Task 2: Static Data Contract

**Files:**
- Create: `data/typhoon-bavi.json`
- Create: `tests/data-contract.test.js`

- [ ] **Step 1: Write the failing data contract test**

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because `data/typhoon-bavi.json` does not exist.

- [ ] **Step 3: Add sample normalized typhoon data**

Create `data/typhoon-bavi.json` with representative observed and forecast points, wind-circle radii, Hangzhou coordinates, source metadata, and fallback notes. Mark it as sample/live-like data until a real API key is configured.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS with utility and data contract tests passing.

### Task 3: Static App Shell And Rendering

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `script.js`
- Create: `tests/static-app.test.js`

- [ ] **Step 1: Write the failing static app test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('html shell contains required app regions and dependencies', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="map"/);
  assert.match(html, /id="status-panel"/);
  assert.match(html, /id="timeline"/);
  assert.match(html, /id="supply-list"/);
  assert.match(html, /leaflet\.css/);
  assert.match(html, /leaflet\.js/);
  assert.match(html, /script\.js/);
});

test('script reads the normalized JSON and renders core sections', async () => {
  const js = await readFile(new URL('../script.js', import.meta.url), 'utf8');

  assert.match(js, /data\/typhoon-bavi\.json/);
  assert.match(js, /renderStatus/);
  assert.match(js, /renderTimeline/);
  assert.match(js, /renderChecklist/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL because the app shell files do not exist.

- [ ] **Step 3: Implement the static app**

Create `index.html` with a mobile-first layout, Leaflet dependencies, map container, status panel, timeline, checklist, and disclaimer.

Create `style.css` with a storm-map visual language, responsive layout, readable contrast, stable map sizing, and reduced-motion handling.

Create `script.js` to fetch `data/typhoon-bavi.json`, render the map, draw observed and forecast tracks, draw wind circles, render status metrics, implement timeline selection, and implement checklist share text.

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS with utility, data contract, and static app tests passing.

### Task 4: Local Verification

**Files:**
- Modify: none unless verification reveals defects.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run a static local server**

Run: `python -m http.server 4173`

Expected: server starts and app is available at `http://localhost:4173/`.

- [ ] **Step 3: If browser tooling is available, inspect the page**

Verify that the map container is visible, data cards render, timeline moves the active point, and mobile layout does not overlap.

