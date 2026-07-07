import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('html shell contains required app regions and dependencies', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="map"/);
  assert.match(html, /id="status-panel"/);
  assert.match(html, /id="timeline"/);
  assert.match(html, /id="supply-list"/);
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
  assert.match(js, /balcony-index/);
  assert.match(js, /takeout-index/);
});

test('map container has stable sizing and Leaflet receives a size refresh', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(css, /\.map-panel[\s\S]*height:\s*640px/);
  assert.match(css, /#map[\s\S]*height:\s*640px/);
  assert.match(js, /invalidateSize/);
  assert.match(js, /ResizeObserver/);
});

test('local CSS includes Leaflet pane positioning fallback for CDN timing issues', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /\.leaflet-pane,\s*\.leaflet-tile/);
  assert.match(css, /\.leaflet-pane[\s\S]*position:\s*absolute/);
  assert.match(css, /\.leaflet-tile[\s\S]*position:\s*absolute/);
});
