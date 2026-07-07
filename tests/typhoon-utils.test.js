import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChecklistShareText,
  classifyHangzhouRisk,
  deriveBaviRealm,
  deriveHangzhouRealm,
  getImperialArtifacts,
  getLatestObservedPoint,
  haversineDistanceKm,
  typhoonMood
} from '../src/typhoon-utils.js';

test('calculates distance from typhoon point to Hangzhou in kilometers', () => {
  const distance = haversineDistanceKm(
    { lat: 30.2741, lon: 120.1551 },
    { lat: 25.0, lon: 125.0 }
  );

  assert.equal(Math.round(distance), 756);
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
  assert.equal(buildChecklistShareText(['充电宝', '饮用水']), '我已准备：充电宝、饮用水');
  assert.equal(buildChecklistShareText([]), '我已准备：还没勾选物资');
});

test('derives Bavi realm from intensity and Hangzhou distance', () => {
  assert.equal(deriveBaviRealm({ distanceKm: 920, windSpeedMps: 28, pressureHpa: 982 }).name, '东海风君');
  assert.equal(deriveBaviRealm({ distanceKm: 760, windSpeedMps: 48, pressureHpa: 945 }).name, '巴威天尊');
  assert.equal(deriveBaviRealm({ distanceKm: 560, windSpeedMps: 58, pressureHpa: 925 }).name, '归墟帝影');
  assert.equal(deriveBaviRealm({ distanceKm: 230, windSpeedMps: 42, pressureHpa: 960 }).name, '归墟压境');
});

test('derives Hangzhou realm from distance, risk, and defensive checklist progress', () => {
  const watchRealm = deriveHangzhouRealm({
    distanceKm: 1200,
    riskLevel: 'watch',
    completedSupplies: 0,
    totalSupplies: 5
  });

  assert.equal(watchRealm.key, 'lunhai');
  assert.equal(watchRealm.name, '轮海初开');
  assert.equal(watchRealm.stage, 1);
  assert.equal(watchRealm.stability, 0);
  assert.equal(watchRealm.visualClass, 'realm-lunhai');

  assert.equal(
    deriveHangzhouRealm({ distanceKm: 650, riskLevel: 'medium', completedSupplies: 3, totalSupplies: 5 }).name,
    '四极镇城'
  );
  assert.equal(
    deriveHangzhouRealm({ distanceKm: 390, riskLevel: 'medium', completedSupplies: 5, totalSupplies: 5 }).name,
    '化龙守望'
  );
  assert.equal(
    deriveHangzhouRealm({ distanceKm: 220, riskLevel: 'high', completedSupplies: 5, totalSupplies: 5 }).name,
    '仙台临战'
  );
});

test('imperial artifacts define map-first controls and safety tools', () => {
  const artifacts = getImperialArtifacts();

  assert.deepEqual(
    artifacts.map((artifact) => artifact.key),
    ['liangtianchi', 'xihu-map', 'wind-ruler', 'daogong-lamps', 'void-disk', 'tianji-mirror']
  );
  assert.equal(artifacts[0].label, '量天尺');
  assert.equal(artifacts[3].panel, 'checklist');
  assert.equal(artifacts.at(-1).panel, 'trust');
});

test('realms include readable introductions and action meaning', () => {
  const bavi = deriveBaviRealm({ distanceKm: 560, windSpeedMps: 58, pressureHpa: 925 });
  const hangzhou = deriveHangzhouRealm({
    distanceKm: 390,
    riskLevel: 'medium',
    completedSupplies: 5,
    totalSupplies: 5
  });

  assert.equal(typeof bavi.description, 'string');
  assert.equal(typeof bavi.basis, 'string');
  assert.equal(typeof hangzhou.description, 'string');
  assert.equal(typeof hangzhou.advice, 'string');
  assert.match(bavi.description, /巴威|台风|风/);
  assert.match(hangzhou.description, /杭州|西湖|防台/);
});
