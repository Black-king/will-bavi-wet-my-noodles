const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(from, to) {
  const fromLat = degreesToRadians(from.lat);
  const toLat = degreesToRadians(to.lat);
  const deltaLat = degreesToRadians(to.lat - from.lat);
  const deltaLon = degreesToRadians(to.lon - from.lon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getLatestObservedPoint(track) {
  return track
    .filter((point) => point.type === 'observed')
    .sort((left, right) => new Date(right.time) - new Date(left.time))[0];
}

export function classifyHangzhouRisk({ distanceKm, windSpeedMps }) {
  if (distanceKm <= 250 || (distanceKm <= 420 && windSpeedMps >= 42)) {
    return {
      level: 'high',
      label: '较高',
      headline: '减少外出，关注官方预警',
      summary: '台风中心距离杭州较近或强度较高，建议提前检查门窗和应急物资。'
    };
  }

  if (distanceKm <= 700 || windSpeedMps >= 33) {
    return {
      level: 'medium',
      label: '中等',
      headline: '提前准备，留意风雨变化',
      summary: '巴威仍可能给杭州带来风雨影响，适合把防台准备提前做完。'
    };
  }

  return {
    level: 'watch',
    label: '关注',
    headline: '保持关注，暂不恐慌',
    summary: '当前距离杭州较远，先关注路径变化和后续预报更新。'
  };
}

export function typhoonMood(windSpeedMps) {
  if (windSpeedMps >= 56) {
    return 'furious';
  }

  if (windSpeedMps >= 42) {
    return 'angry';
  }

  return 'alert';
}

export function buildChecklistShareText(items, status) {
  const supplyText = items.length > 0 ? items.join('、') : '还没勾选物资';

  return [
    `杭州抗台指数：${status.riskLabel}`,
    `巴威距离杭州约 ${Math.round(status.distanceKm)} km`,
    `我已准备：${supplyText}`,
    `更新时间：${status.updatedAt}`,
    '正式预警请以气象部门发布为准。'
  ].join('\n');
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
