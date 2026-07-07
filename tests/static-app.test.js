import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('html shell exposes map-first fantasy HUD regions', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /id="map"/);
  assert.match(html, /class="app-shell map-first-shell"/);
  assert.match(html, /id="realm-panel"/);
  assert.match(html, /id="realm-toggle"/);
  assert.match(html, /class="realm-panel is-collapsed"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /id="storm-realm-title"/);
  assert.match(html, /id="artifact-dock"/);
  assert.match(html, /id="breakthrough-banner"/);
  assert.match(html, /id="distance-ruler-label"/);
  assert.match(html, /id="timeline"/);
  assert.match(html, /id="supply-list"/);
  assert.match(html, /天命人/);
  assert.match(html, /归墟帝影/);
  assert.match(html, /leaflet\.css/);
  assert.match(html, /leaflet\.js/);
  assert.match(html, /script\.js/);
});

test('script wires realms, imperial artifacts, map overlays, and timeline effects', async () => {
  const js = await readFile(new URL('../script.js', import.meta.url), 'utf8');

  assert.match(js, /data\/typhoon-bavi\.json/);
  assert.match(js, /deriveBaviRealm/);
  assert.match(js, /deriveHangzhouRealm/);
  assert.match(js, /getImperialArtifacts/);
  assert.match(js, /renderArtifactDock/);
  assert.match(js, /renderDistanceRuler/);
  assert.match(js, /triggerBreakthrough/);
  assert.match(js, /setRealmPanelExpanded/);
  assert.match(js, /realmPanelExpanded/);
  assert.match(js, /stormRealmTitle/);
  assert.match(js, /L\.divIcon/);
  assert.match(js, /L\.polyline/);
});

test('css provides premium dark map staging and advanced effects', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /--void/);
  assert.match(css, /\.map-panel[\s\S]*min-height:\s*720px/);
  assert.match(css, /\.realm-panel/);
  assert.match(css, /\.realm-toggle/);
  assert.match(css, /\.realm-panel\.is-collapsed/);
  assert.match(css, /\.artifact-dock/);
  assert.match(css, /\.hangzhou-marker__array/);
  assert.match(css, /--ward-primary/);
  assert.match(css, /--ward-ring/);
  assert.match(css, /\.is-fully-prepped::before/);
  assert.match(css, /@keyframes full-prep-pulse/);
  assert.match(css, /\.bavi-marker__vortex/);
  assert.match(css, /\.bavi-tianzun \.bavi-marker__vortex/);
  assert.match(css, /\.bavi-guixu-shadow \.bavi-marker__vortex/);
  assert.match(css, /\.distance-ruler-label/);
  assert.match(css, /@keyframes array-rotate/);
  assert.match(css, /@keyframes vortex-spin/);
  assert.match(css, /@keyframes breakthrough-flare/);
});

test('map container has stable sizing and Leaflet receives a size refresh', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(css, /#map[\s\S]*height:\s*100%/);
  assert.match(js, /invalidateSize/);
  assert.match(js, /ResizeObserver/);
});

test('safety and data trust remain visible inside the map experience', async () => {
  const [html, js] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="trust-panel"/);
  assert.match(html, /正式预警/);
  assert.match(js, /renderNotes/);
  assert.match(js, /dataFreshness/);
});

test('desktop layout keeps map HUD compact instead of covering the stage', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(css, /\.app-shell[\s\S]*width:\s*100%/);
  assert.doesNotMatch(css, /\.app-shell[\s\S]*width:\s*min\(1680px,\s*100%\)/);
  assert.match(css, /\.battle-stage[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*344px/);
  assert.match(css, /\.map-panel[\s\S]*height:\s*calc\(100dvh - 20px\)/);
  assert.match(css, /\.realm-panel[\s\S]*width:\s*min\(360px,\s*calc\(100% - 112px\)\)/);
  assert.match(css, /\.realm-panel h1[\s\S]*font-size:\s*var\(--fs-hero\)/);
  assert.match(css, /\.realm-panel h1[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.realm-panel h1[\s\S]*text-wrap:\s*balance/);
  assert.match(css, /\.realm-grid[\s\S]*display:\s*grid/);
  assert.match(css, /\.distance-readout[\s\S]*display:\s*none/);
  assert.match(css, /\.artifact-dock[\s\S]*width:\s*72px/);
  assert.match(css, /\.artifact-button small[\s\S]*display:\s*none/);
  assert.match(css, /\.side-card h2[\s\S]*font-size:\s*var\(--fs-title\)/);
});

test('overhauled presentation layer ships atmosphere, particles, and motion tokens', async () => {
  const [html, css, js] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="atmosphere"/);
  assert.match(html, /id="fx-canvas"/);
  assert.match(html, /class="timeline-ticks"/);
  assert.match(html, /fonts\.loli\.net/);
  assert.match(css, /--dur-ritual/);
  assert.match(css, /--font-display/);
  assert.match(css, /@keyframes lamp-ignite/);
  assert.match(css, /@keyframes mote-orbit/);
  assert.match(css, /data-mood="furious"/);
  assert.match(css, /body\.is-divining/);
  assert.match(css, /body\.is-awakened/);
  assert.match(js, /data-mood/);
  assert.match(js, /is-awakened/);
  assert.match(js, /is-divining/);
  assert.match(js, /animateNumber/);
  assert.match(js, /fx-particles\.js/);
});

test('realm introductions are rendered in the HUD and side panels', async () => {
  const [html, js, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(html, /id="hangzhou-realm-desc"/);
  assert.match(html, /id="bavi-realm-desc"/);
  assert.match(html, /id="realm-lore"/);
  assert.match(js, /hangzhouRealmDesc/);
  assert.match(js, /baviRealmDesc/);
  assert.match(js, /realmLore/);
  assert.match(js, /description/);
  assert.match(css, /\.realm-lore/);
});

test('map uses Chinese labels and marker hover popups for realm details', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(js, /webrd0\{s\}\.is\.autonavi\.com/);
  assert.match(js, /lang=zh_cn/);
  assert.match(js, /dark_nolabels/);
  assert.match(js, /tileerror/);
  assert.match(js, /hideBrokenTile/);
  assert.match(js, /bindHoverPopup/);
  assert.match(js, /openPopup/);
  assert.match(js, /closePopup/);
  assert.match(css, /\.leaflet-tile[\s\S]*filter:/);
});

test('timeline-driven status uses the selected point instead of the latest point', async () => {
  const js = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const renderStatusBody = js.match(/function renderStatus\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';

  assert.doesNotMatch(renderStatusBody, /getLatestObservedPoint/);
  assert.match(renderStatusBody, /classifyHangzhouRisk\(\{\s*distanceKm,\s*windSpeedMps:\s*point\.windSpeedMps\s*\}\)/);
  assert.match(renderStatusBody, /selectedPointTimeLabel\(point\)/);
  assert.match(renderStatusBody, /balconyIndexText\(distanceKm,\s*point\.windSpeedMps,\s*hangzhou\)/);
  assert.match(renderStatusBody, /takeoutIndexText\(distanceKm,\s*point\.windSpeedMps,\s*hangzhou\)/);
  assert.match(js, /setTimelineFromClientX/);
  assert.match(js, /pointerdown/);
  assert.match(js, /pointermove/);
});

test('wind ruler toggle has visible circle styling and semantic button state', async () => {
  const [js, css] = await Promise.all([
    readFile(new URL('../script.js', import.meta.url), 'utf8'),
    readFile(new URL('../style.css', import.meta.url), 'utf8')
  ]);

  assert.match(js, /button\.dataset\.visible/);
  assert.match(js, /fitBounds/);
  assert.match(js, /fitBattleBounds/);
  assert.match(js, /paddingTopLeft:\s*\[400,\s*220\]/);
  assert.match(js, /bounds\.extend\(\[hangzhou\.lat,\s*hangzhou\.lon\]\)/);
  assert.match(css, /\.wind-circle[\s\S]*drop-shadow\(0 0 18px/);
});
