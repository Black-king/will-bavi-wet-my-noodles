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
  const text = buildChecklistShareText(['充电宝', '饮用水'], {
    riskLabel: '较高',
    distanceKm: 520,
    updatedAt: '2026-07-07 18:00'
  });

  assert.match(text, /杭州抗台指数：较高/);
  assert.match(text, /距离杭州约 520 km/);
  assert.match(text, /充电宝、饮用水/);
});
