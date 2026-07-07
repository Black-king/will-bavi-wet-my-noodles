import { createPrivateKey, sign } from 'node:crypto';

const DEFAULT_CHECKLIST = ['充电宝', '饮用水', '手电筒', '常用药', '窗户检查', '阳台收纳', '简易食品'];

export function createQWeatherJwt({
  projectId,
  credentialId,
  privateKeyPem,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 900
}) {
  assertNonEmpty(projectId, 'projectId');
  assertNonEmpty(credentialId, 'credentialId');
  assertNonEmpty(privateKeyPem, 'privateKeyPem');

  const header = {
    alg: 'EdDSA',
    kid: credentialId
  };
  const payload = {
    sub: projectId,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = createPrivateKey(privateKeyPem);
  const signature = sign(null, Buffer.from(signingInput), key).toString('base64url');

  return `${signingInput}.${signature}`;
}

export function pickCurrentBaviStorm(storms, year = new Date().getFullYear()) {
  const matches = asArray(storms).filter((storm) => {
    const nameText = [
      storm.name,
      storm.stormName,
      storm.cnName,
      storm.zhName,
      storm.englishName,
      storm.enName
    ].filter(Boolean).join(' ').toLowerCase();

    return nameText.includes('bavi') || nameText.includes('巴威');
  });

  return matches.sort((left, right) => scoreStorm(right, year) - scoreStorm(left, year))[0] ?? null;
}

export function normalizeQWeatherData({
  storm,
  observedTrack,
  forecastTrack = [],
  updatedAt = new Date().toISOString()
}) {
  if (!storm) {
    throw new Error('Cannot normalize QWeather data without a storm record.');
  }

  const normalizedObserved = asArray(observedTrack).map((point) => normalizeTrackPoint(point, 'observed'));
  const normalizedForecast = asArray(forecastTrack).map((point) => normalizeTrackPoint(point, 'forecast'));
  const track = [...normalizedObserved, ...normalizedForecast].filter((point) => (
    Number.isFinite(point.lat) && Number.isFinite(point.lon) && point.time
  ));

  if (!track.some((point) => point.type === 'observed')) {
    throw new Error('QWeather response did not include usable observed track points.');
  }

  return {
    meta: {
      currentStormName: firstText(storm.name, storm.stormName, storm.cnName, storm.zhName, '巴威'),
      englishName: firstText(storm.englishName, storm.enName, 'Bavi'),
      stormId: firstText(storm.id, storm.stormId, storm.stormid, storm.tcid),
      year: numberValue(storm.year) ?? new Date(updatedAt).getFullYear(),
      basin: firstText(storm.basin, 'NP'),
      isActive: booleanValue(storm.isActive ?? storm.active ?? storm.status, true),
      isLiveLike: true,
      dataMode: 'qweather-live',
      updatedAt,
      displayUpdatedAt: formatDisplayTime(updatedAt),
      dataFreshness: 'GitHub Actions 已接入 QWeather，页面展示最近一次成功更新的数据。',
      sourceNote: '数据来自 QWeather Tropical Cyclone API，正式预警请以气象部门发布为准。'
    },
    hangzhou: {
      name: '杭州',
      lat: 30.2741,
      lon: 120.1551
    },
    sources: [
      {
        name: 'QWeather Tropical Cyclone API',
        role: 'primary-live',
        url: 'https://dev.qweather.com/docs/api/tropical-cyclone/storm-list/'
      },
      {
        name: '中央气象台台风网',
        role: 'authority-reference',
        url: 'https://typhoon.nmc.cn/web.html'
      }
    ],
    track,
    checklist: DEFAULT_CHECKLIST,
    disclaimer: '本页面用于互动展示和生活提醒，正式预警、避险指引和灾害信息请以气象部门及政府部门发布为准。'
  };
}

export function extractStormList(payload) {
  return asArray(payload?.storm ?? payload?.stormList ?? payload?.storms ?? payload?.data);
}

export function extractObservedTrack(payload) {
  return asArray(payload?.track ?? payload?.tracks ?? payload?.storm?.track ?? payload?.data?.track ?? payload?.data);
}

export function extractForecastTrack(payload) {
  return asArray(payload?.forecast ?? payload?.forecasts ?? payload?.storm?.forecast ?? payload?.data?.forecast ?? payload?.data);
}

function normalizeTrackPoint(point, type) {
  const time = firstText(point.time, point.fxTime, point.obsTime, point.pubTime, point.updateTime);
  const level = firstText(point.level, point.type, point.category, point.stormType, '台风');

  return {
    type,
    time,
    label: formatTrackLabel(time),
    lat: numberValue(point.lat ?? point.latitude),
    lon: numberValue(point.lon ?? point.lng ?? point.longitude),
    level,
    windSpeedMps: numberValue(point.windSpeedMps ?? point.windSpeed ?? point.wind ?? point.speed) ?? 0,
    pressureHpa: numberValue(point.pressureHpa ?? point.pressure ?? point.press) ?? 0,
    movement: firstText(point.movement, point.moveDir, point.moveDirection, point.dir, '暂无'),
    windRadiiKm: {
      r7: numberValue(point.radius7 ?? point.r7 ?? point.windRadius7 ?? point.radii7) ?? 0,
      r10: numberValue(point.radius10 ?? point.r10 ?? point.windRadius10 ?? point.radii10) ?? 0,
      r12: numberValue(point.radius12 ?? point.r12 ?? point.windRadius12 ?? point.radii12) ?? 0
    }
  };
}

function scoreStorm(storm, year) {
  const stormYear = numberValue(storm.year);
  const yearScore = stormYear === year ? 100 : stormYear ? Math.max(0, 50 - Math.abs(year - stormYear)) : 0;
  const activeScore = booleanValue(storm.isActive ?? storm.active ?? storm.status, false) ? 25 : 0;
  return yearScore + activeScore;
}

function formatTrackLabel(time) {
  if (!time) {
    return '时间未知';
  }

  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return time;
  }

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const part = (type) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function formatDisplayTime(time) {
  const label = formatTrackLabel(time);
  const date = new Date(time);
  const year = Number.isNaN(date.getTime())
    ? new Date().getFullYear()
    : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(date);
  return `${year}-${label}`;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function booleanValue(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'active', 'on', 'yes', '生效', '活跃'].includes(value.toLowerCase());
  }

  return fallback;
}

function assertNonEmpty(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
}
