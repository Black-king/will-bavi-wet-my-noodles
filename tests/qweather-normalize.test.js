import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  createQWeatherJwt,
  normalizeQWeatherData,
  pickCurrentBaviStorm
} from '../src/qweather-normalize.js';

test('createQWeatherJwt signs an EdDSA token with QWeather project claims', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  const token = createQWeatherJwt({
    projectId: 'PROJECT_123',
    credentialId: 'CRED_456',
    privateKeyPem,
    nowSeconds: 1783420800,
    ttlSeconds: 900
  });

  const [headerPart, payloadPart, signaturePart] = token.split('.');
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));

  assert.equal(header.alg, 'EdDSA');
  assert.equal(header.kid, 'CRED_456');
  assert.equal(payload.sub, 'PROJECT_123');
  assert.equal(payload.iat, 1783420800);
  assert.equal(payload.exp, 1783421700);
  assert.ok(signaturePart.length > 40);
});

test('pickCurrentBaviStorm prefers the active 2026 Bavi record over historical matches', () => {
  const storm = pickCurrentBaviStorm([
    { id: '2020-old', name: '巴威', englishName: 'Bavi', year: 2020, isActive: false },
    { id: '2026-other', name: 'Other', year: 2026, isActive: true },
    { id: '2026-bavi', name: '巴威', englishName: 'Bavi', year: 2026, isActive: true }
  ], 2026);

  assert.equal(storm.id, '2026-bavi');
});

test('normalizeQWeatherData keeps the frontend JSON contract stable', () => {
  const data = normalizeQWeatherData({
    storm: {
      id: '2026-bavi',
      name: '巴威',
      englishName: 'Bavi',
      year: 2026,
      basin: 'NP',
      isActive: true
    },
    observedTrack: [
      {
        time: '2026-07-07T18:00+08:00',
        lat: '18.7',
        lon: '137.4',
        type: '超强台风',
        windSpeed: '56',
        pressure: '930',
        moveDir: '西北',
        radius7: '360',
        radius10: '180',
        radius12: '90'
      }
    ],
    forecastTrack: [
      {
        fxTime: '2026-07-08T18:00+08:00',
        latitude: 21.4,
        longitude: 132.1,
        level: '强台风',
        windSpeedMps: 48,
        pressureHpa: 945
      }
    ],
    updatedAt: '2026-07-07T18:05:00+08:00'
  });

  assert.equal(data.meta.currentStormName, '巴威');
  assert.equal(data.meta.englishName, 'Bavi');
  assert.equal(data.meta.stormId, '2026-bavi');
  assert.equal(data.meta.dataMode, 'qweather-live');
  assert.equal(data.track.length, 2);
  assert.equal(data.track[0].type, 'observed');
  assert.equal(data.track[0].windRadiiKm.r7, 360);
  assert.equal(data.track[1].type, 'forecast');
  assert.equal(data.track[1].label, '07-08 18:00');
  assert.deepEqual(data.checklist, ['照明电力', '饮水食物', '常用药', '门窗检查', '阳台收纳']);
  assert.match(data.disclaimer, /正式预警/);
});
