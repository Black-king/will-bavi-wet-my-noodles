const EARTH_RADIUS_KM = 6371;

const HANGZHOU_REALMS = [
  { key: 'lunhai', name: '轮海初开', stage: 1, visualClass: 'realm-lunhai' },
  { key: 'daogong', name: '道宫点灯', stage: 2, visualClass: 'realm-daogong' },
  { key: 'siji', name: '四极镇城', stage: 3, visualClass: 'realm-siji' },
  { key: 'hualong', name: '化龙守望', stage: 4, visualClass: 'realm-hualong' },
  { key: 'xiantai', name: '仙台临战', stage: 5, visualClass: 'realm-xiantai' },
  { key: 'diguan', name: '帝关开阵', stage: 6, visualClass: 'realm-diguan' }
];

const IMPERIAL_ARTIFACTS = [
  {
    key: 'liangtianchi',
    label: '量天尺',
    panel: 'distance',
    summary: '丈量巴威与西湖圣地的距离'
  },
  {
    key: 'xihu-map',
    label: '西湖阵图',
    panel: 'risk',
    summary: '查看杭州当前风险与护城状态'
  },
  {
    key: 'wind-ruler',
    label: '风圈尺',
    panel: 'wind',
    summary: '显隐 7/10/12 级风圈'
  },
  {
    key: 'daogong-lamps',
    label: '道宫五灯',
    panel: 'checklist',
    summary: '点亮防台准备清单'
  },
  {
    key: 'void-disk',
    label: '虚空盘',
    panel: 'timeline',
    summary: '拖动天机推演时间轴'
  },
  {
    key: 'tianji-mirror',
    label: '天机镜',
    panel: 'trust',
    summary: '查看数据来源、更新时间和免责声明'
  }
];

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

export function deriveBaviRealm({ distanceKm, windSpeedMps, pressureHpa }) {
  if (distanceKm <= 260) {
    return {
      key: 'guixu-pressure',
      name: '归墟压境',
      stage: 5,
      visualClass: 'bavi-guixu-pressure'
    };
  }

  if (windSpeedMps >= 56 || pressureHpa <= 930) {
    return {
      key: 'guixu-shadow',
      name: '归墟帝影',
      stage: 4,
      visualClass: 'bavi-guixu-shadow'
    };
  }

  if (windSpeedMps >= 42) {
    return {
      key: 'bavi-tianzun',
      name: '巴威天尊',
      stage: 3,
      visualClass: 'bavi-tianzun'
    };
  }

  if (windSpeedMps >= 25 || distanceKm <= 1000) {
    return {
      key: 'east-sea-lord',
      name: '东海风君',
      stage: 2,
      visualClass: 'bavi-east-sea'
    };
  }

  return {
    key: 'sea-omen',
    name: '海上异象',
    stage: 1,
    visualClass: 'bavi-sea-omen'
  };
}

export function deriveHangzhouRealm({ distanceKm, riskLevel, completedSupplies, totalSupplies }) {
  const stability = totalSupplies > 0 ? Math.round((completedSupplies / totalSupplies) * 100) : 0;
  let realm = HANGZHOU_REALMS[0];

  if (completedSupplies >= 1 || distanceKm <= 1000) {
    realm = HANGZHOU_REALMS[1];
  }

  if (distanceKm <= 700 || completedSupplies >= 3 || riskLevel === 'medium') {
    realm = HANGZHOU_REALMS[2];
  }

  if (distanceKm <= 420 || (riskLevel === 'medium' && stability >= 80)) {
    realm = HANGZHOU_REALMS[3];
  }

  if (distanceKm <= 260 || riskLevel === 'high') {
    realm = HANGZHOU_REALMS[4];
  }

  if (distanceKm <= 140 && stability >= 80) {
    realm = HANGZHOU_REALMS[5];
  }

  return {
    ...realm,
    stability
  };
}

export function getImperialArtifacts() {
  return IMPERIAL_ARTIFACTS.map((artifact) => ({ ...artifact }));
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
