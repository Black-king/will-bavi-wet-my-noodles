import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('html shell contains required app regions and dependencies', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="map"/);
  assert.match(html, /class="app-shell map-first-shell"/);
  assert.match(html, /id="status-panel"/);
  assert.match(html, /id="data-mode-label"/);
  assert.match(html, /id="timeline"/);
  assert.match(html, /id="supply-list"/);
  assert.match(html, /id="supply-progress"/);
  assert.match(html, /class="share-preview"/);
  assert.match(html, /id="hangzhou-squad"/);
  assert.match(html, /id="bavi-player"/);
  assert.match(html, /杭州小队/);
  assert.match(html, /巴威选手/);
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
  assert.match(js, /updateSupplyProgress/);
  assert.match(js, /balcony-index/);
  assert.match(js, /takeout-index/);
  assert.match(js, /renderDataMode/);
  assert.match(js, /updateTimelineProgress/);
});

test('map-first layout makes the path map the primary first-screen surface', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /\.battle-stage[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*340px/);
  assert.match(css, /\.map-panel[\s\S]*height:\s*min\(calc\(100dvh - 40px\),\s*780px\)/);
  assert.match(css, /\.compact-brief[\s\S]*font-size:\s*clamp\(1\.5rem,\s*3vw,\s*2\.35rem\)/);
});

test('supply checklist is styled as a compact task card instead of a large form', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /\.receipt-note[\s\S]*background:[\s\S]*linear-gradient\(145deg/);
  assert.match(css, /\.supply-list[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.supply-item input:checked \+ span/);
  assert.match(css, /\.share-preview/);
});

test('safety note is user-facing and does not expose implementation source names', async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(html, /class="fine-print trust-note"/);
  assert.match(html, /class="trust-stack"/);
  assert.doesNotMatch(js, /Tropical Cyclone API|中央气象台台风网|数据源规划|sourceNames/);
  assert.match(css, /\.trust-stack/);
  assert.match(css, /\.trust-item--primary/);
});

test('map legend exposes exact route data instead of only symbolic labels', async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="observed-route-detail"/);
  assert.match(html, /id="forecast-route-detail"/);
  assert.match(html, /id="active-coord-detail"/);
  assert.match(js, /renderRouteData/);
  assert.match(js, /L\.circleMarker/);
  assert.match(js, /formatCoordinate/);
  assert.match(css, /\.route-data-grid/);
});

test('distance metric is presented as an estimate with data-mode context', async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="distance-note"/);
  assert.match(html, /估算距离/);
  assert.match(js, /renderDistanceNote/);
  assert.match(js, /中心坐标/);
  assert.match(js, /示例数据/);
  assert.match(css, /\.metric-note/);
});

test('storm center marker is a comic character with layered motion', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(js, /storm-marker__face/);
  assert.match(js, /storm-marker__eye/);
  assert.match(js, /iconSize:\s*\[72,\s*72\]/);
  assert.match(css, /\.storm-marker__ring/);
  assert.match(css, /@keyframes storm-hover/);
  assert.match(css, /@keyframes storm-glare/);
});

test('map container has stable sizing and Leaflet receives a size refresh', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(css, /\.map-panel[\s\S]*height:\s*min\(calc\(100dvh - 40px\),\s*780px\)/);
  assert.match(css, /#map[\s\S]*height:\s*100%/);
  assert.match(js, /invalidateSize/);
  assert.match(js, /ResizeObserver/);
});

test('local CSS includes Leaflet pane positioning fallback for CDN timing issues', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /\.leaflet-pane,\s*\.leaflet-tile/);
  assert.match(css, /\.leaflet-pane[\s\S]*position:\s*absolute/);
  assert.match(css, /\.leaflet-tile[\s\S]*position:\s*absolute/);
});
