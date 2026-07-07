import {
  buildChecklistShareText,
  classifyHangzhouRisk,
  deriveBaviRealm,
  deriveHangzhouRealm,
  getImperialArtifacts,
  getLatestObservedPoint,
  haversineDistanceKm,
  typhoonMood
} from './src/typhoon-utils.js';

const appState = {
  data: null,
  map: null,
  hangzhouMarker: null,
  stormMarker: null,
  rulerLine: null,
  rulerLabel: null,
  forecastMist: null,
  windLayers: [],
  activePanel: 'distance',
  selectedIndex: 0,
  lastRealmKey: '',
  checkedSupplies: new Set(),
  windVisible: true
};

const els = {
  artifactDock: document.querySelector('#artifact-dock'),
  artifactPanel: document.querySelector('#artifact-panel'),
  artifactPanelTitle: document.querySelector('#artifact-panel-title'),
  artifactPanelBody: document.querySelector('#artifact-panel-body'),
  balconyIndex: document.querySelector('#balcony-index'),
  baviRealm: document.querySelector('#bavi-realm'),
  breakthroughBanner: document.querySelector('#breakthrough-banner'),
  breakthroughTitle: document.querySelector('#breakthrough-title'),
  breakthroughDetail: document.querySelector('#breakthrough-detail'),
  cityBanter: document.querySelector('#city-banter'),
  dataFreshness: document.querySelector('#data-freshness'),
  dataModeLabel: document.querySelector('#data-mode-label'),
  disclaimer: document.querySelector('#disclaimer'),
  distanceNote: document.querySelector('#distance-note'),
  distanceReadout: document.querySelector('#distance-ruler-label'),
  distanceValue: document.querySelector('#distance-value'),
  hangzhouRealm: document.querySelector('#hangzhou-realm'),
  heroSummary: document.querySelector('#hero-summary'),
  riskLabel: document.querySelector('#risk-label'),
  riskSummary: document.querySelector('#risk-summary'),
  shareText: document.querySelector('#share-text'),
  sourceNote: document.querySelector('#source-note'),
  stormLevel: document.querySelector('#storm-level'),
  stormMoodLabel: document.querySelector('#storm-mood-label'),
  stormMove: document.querySelector('#storm-move'),
  supplyList: document.querySelector('#supply-list'),
  supplyProgress: document.querySelector('#supply-progress'),
  takeoutIndex: document.querySelector('#takeout-index'),
  timeline: document.querySelector('#timeline'),
  timelineCurrentLabel: document.querySelector('#timeline-current-label'),
  timelineStart: document.querySelector('#timeline-start'),
  timelineEnd: document.querySelector('#timeline-end'),
  activePointLabel: document.querySelector('#active-point-label'),
  activePointDetail: document.querySelector('#active-point-detail'),
  toast: document.querySelector('#toast'),
  updatedAt: document.querySelector('#updated-at'),
  windPressure: document.querySelector('#wind-pressure')
};

init();

async function init() {
  try {
    const response = await fetch('data/typhoon-bavi.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`数据请求失败：${response.status}`);
    }

    appState.data = await response.json();
    appState.selectedIndex = latestObservedIndex(appState.data.track);
    appState.lastRealmKey = currentRealms().hangzhou.key;

    renderDataMode();
    renderArtifactDock();
    renderMap();
    renderTimeline();
    renderChecklist();
    renderNotes();
    renderStatus();
  } catch (error) {
    showToast(error.message || '台风数据读取失败，请稍后重试。');
    setText(els.riskSummary, '数据读取失败，请检查 data/typhoon-bavi.json 是否存在。');
  }
}

function renderDataMode() {
  const mode = appState.data.meta.dataMode || '';
  const isLive = mode.includes('qweather-live');

  setText(els.dataModeLabel, isLive ? '实时数据' : '示例数据');
  els.dataModeLabel.dataset.mode = isLive ? 'live' : 'sample';
}

function renderArtifactDock() {
  els.artifactDock.innerHTML = '';

  getImperialArtifacts().forEach((artifact) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'artifact-button';
    button.dataset.panel = artifact.panel;
    button.title = artifact.summary;
    button.innerHTML = `<span>${artifact.label}</span><small>${artifact.summary}</small>`;
    button.addEventListener('click', () => {
      if (artifact.panel === 'wind') {
        appState.windVisible = !appState.windVisible;
        renderWindCircles(activePoint());
      }

      appState.activePanel = artifact.panel;
      renderArtifactPanel();
      updateArtifactDockState();
    });

    els.artifactDock.append(button);
  });

  updateArtifactDockState();
  renderArtifactPanel();
}

function renderMap() {
  const { hangzhou, track } = appState.data;
  const active = activePoint();

  appState.map = L.map('map', {
    zoomControl: false,
    preferCanvas: true,
    scrollWheelZoom: true
  }).setView([hangzhou.lat, hangzhou.lon], 5);

  appState.map.createPane('mistPane');
  appState.map.getPane('mistPane').style.zIndex = 360;
  appState.map.createPane('rulerPane');
  appState.map.getPane('rulerPane').style.zIndex = 470;

  L.control.zoom({ position: 'bottomleft' }).addTo(appState.map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 12,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(appState.map);

  renderForecastMist();
  renderTrackLines();
  renderTrackPoints();
  renderHangzhouMarker();

  appState.stormMarker = L.marker(toLatLon(active), {
    icon: baviIcon(currentRealms().bavi),
    zIndexOffset: 900
  }).addTo(appState.map);
  appState.stormMarker.bindPopup(pointPopup(active));

  renderWindCircles(active);
  renderDistanceRuler(active);

  const bounds = L.latLngBounds([...track.map(toLatLon), [hangzhou.lat, hangzhou.lon]]);
  appState.map.fitBounds(bounds, { padding: [36, 36] });
  observeMapResize();
  refreshMapSize();
}

function renderTrackLines() {
  const observed = appState.data.track.filter((point) => point.type === 'observed').map(toLatLon);
  const forecast = appState.data.track.filter((point) => point.type === 'forecast').map(toLatLon);

  if (observed.length > 1) {
    L.polyline(observed, {
      className: 'observed-path',
      color: '#d5b15f',
      weight: 4,
      lineCap: 'round'
    }).addTo(appState.map);
  }

  if (forecast.length > 1) {
    L.polyline(forecast, {
      className: 'forecast-path',
      color: '#87d8ff',
      weight: 3,
      dashArray: '7 12',
      lineCap: 'round'
    }).addTo(appState.map);
  }
}

function renderForecastMist() {
  const forecast = appState.data.track.filter((point) => point.type === 'forecast').map(toLatLon);

  if (forecast.length < 2) {
    return;
  }

  appState.forecastMist = L.polyline(forecast, {
    pane: 'mistPane',
    className: 'forecast-mist',
    color: '#77c7d9',
    weight: 54,
    opacity: 0.24,
    lineCap: 'round',
    smoothFactor: 0.8
  }).addTo(appState.map);
}

function renderTrackPoints() {
  appState.data.track.forEach((point, index) => {
    const isObserved = point.type === 'observed';

    L.circleMarker(toLatLon(point), {
      radius: index === appState.selectedIndex ? 7 : 4,
      color: isObserved ? '#efd48a' : '#8fdcff',
      weight: 2,
      fillColor: isObserved ? '#d85f3f' : '#102b42',
      fillOpacity: isObserved ? 0.92 : 0.72,
      className: isObserved ? 'track-point track-point--observed' : 'track-point track-point--forecast'
    })
      .addTo(appState.map)
      .bindPopup(pointPopup(point));
  });
}

function renderHangzhouMarker() {
  const realm = currentRealms().hangzhou;
  const { hangzhou } = appState.data;

  appState.hangzhouMarker = L.marker([hangzhou.lat, hangzhou.lon], {
    icon: hangzhouIcon(realm),
    zIndexOffset: 880
  })
    .addTo(appState.map)
    .bindPopup(hangzhouPopup(realm));
}

function renderTimeline() {
  const { track } = appState.data;

  els.timeline.max = String(track.length - 1);
  els.timeline.value = String(appState.selectedIndex);
  setText(els.timelineStart, track[0].label);
  setText(els.timelineEnd, track[track.length - 1].label);
  updateActivePoint(activePoint(), false);
  updateTimelineProgress();

  els.timeline.addEventListener('input', (event) => {
    appState.selectedIndex = Number(event.target.value);
    updateActivePoint(activePoint(), true);
    updateTimelineProgress();
  });
}

function renderChecklist() {
  els.supplyList.innerHTML = '';

  appState.data.checklist.forEach((item, index) => {
    const label = document.createElement('label');
    label.className = 'supply-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        appState.checkedSupplies.add(item);
      } else {
        appState.checkedSupplies.delete(item);
      }

      updateSupplyProgress();
      renderStatus();
      updateHangzhouMarker();
      renderArtifactPanel();
      updateShareText();
    });

    const text = document.createElement('span');
    text.textContent = `${index + 1}. ${item}`;

    label.append(checkbox, text);
    els.supplyList.append(label);
  });

  updateSupplyProgress();
  updateShareText();
}

function renderNotes() {
  const mode = appState.data.meta.dataMode || '';
  const isLive = mode.includes('qweather-live');

  setText(
    els.sourceNote,
    isLive
      ? '页面会保留最近一次成功更新；如果数据延迟，请先按更保守的方式安排出行和备灾。'
      : '当前为示例数据，用于预览交互效果，不作为实时台风预警依据。'
  );
  setText(
    els.disclaimer,
    appState.data.disclaimer || '正式预警、停课停运、交通调整和避险指引，请以气象部门及政府部门发布为准。'
  );
}

function renderStatus() {
  const point = activePoint();
  const latest = getLatestObservedPoint(appState.data.track);
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const latestDistanceKm = haversineDistanceKm(appState.data.hangzhou, latest);
  const risk = classifyHangzhouRisk({ distanceKm: latestDistanceKm, windSpeedMps: latest.windSpeedMps });
  const { bavi, hangzhou } = currentRealms(point);

  setText(els.baviRealm, bavi.name);
  setText(els.hangzhouRealm, hangzhou.name);
  setText(els.riskLabel, risk.label);
  setText(els.riskSummary, `${risk.headline}。${risk.summary}`);
  setText(els.distanceValue, `${Math.round(distanceKm)} km`);
  setText(els.distanceReadout, `量天尺：${Math.round(distanceKm)} km`);
  setText(els.stormLevel, point.level);
  setText(els.stormMove, point.movement || '待确认');
  setText(els.windPressure, `${point.windSpeedMps} m/s | ${point.pressureHpa} hPa`);
  setText(els.updatedAt, appState.data.meta.displayUpdatedAt);
  setText(els.dataFreshness, appState.data.meta.dataFreshness);
  setText(els.stormMoodLabel, moodText(typhoonMood(point.windSpeedMps), bavi.name));
  setText(els.heroSummary, heroSummaryText(distanceKm, bavi, hangzhou));
  setText(els.cityBanter, cityBanterText(hangzhou, risk.level));
  setText(els.balconyIndex, balconyIndexText(distanceKm, point.windSpeedMps));
  setText(els.takeoutIndex, takeoutIndexText(distanceKm, point.windSpeedMps));
  setText(els.distanceNote, distanceNoteText(point));
  document.body.dataset.hangzhouRealm = hangzhou.key;
  document.body.dataset.baviRealm = bavi.key;

  updateShareText();
  renderArtifactPanel();
}

function renderWindCircles(point) {
  appState.windLayers.forEach((layer) => layer.remove());
  appState.windLayers = [];

  if (!appState.windVisible) {
    return;
  }

  [
    { key: 'r7', color: '#75d8c7', label: '7 级风圈' },
    { key: 'r10', color: '#d5b15f', label: '10 级风圈' },
    { key: 'r12', color: '#dc6247', label: '12 级风圈' }
  ].forEach((circle) => {
    const radiusKm = Number(point.windRadiiKm?.[circle.key] || 0);

    if (radiusKm <= 0) {
      return;
    }

    const layer = L.circle(toLatLon(point), {
      radius: radiusKm * 1000,
      color: circle.color,
      weight: circle.key === 'r7' ? 1 : 1.5,
      fillColor: circle.color,
      fillOpacity: circle.key === 'r7' ? 0.055 : 0.08,
      opacity: 0.72,
      className: `wind-circle wind-circle--${circle.key}`
    })
      .addTo(appState.map)
      .bindTooltip(`${circle.label}约 ${radiusKm} km`);

    appState.windLayers.push(layer);
  });
}

function renderDistanceRuler(point) {
  const { hangzhou } = appState.data;
  const points = [[hangzhou.lat, hangzhou.lon], toLatLon(point)];
  const midpoint = [(hangzhou.lat + point.lat) / 2, (hangzhou.lon + point.lon) / 2];
  const distanceKm = haversineDistanceKm(hangzhou, point);

  if (!appState.rulerLine) {
    appState.rulerLine = L.polyline(points, {
      pane: 'rulerPane',
      className: 'distance-ruler-line',
      color: '#d8b768',
      weight: 2,
      opacity: 0.88,
      dashArray: '3 12'
    }).addTo(appState.map);
  } else {
    appState.rulerLine.setLatLngs(points);
  }

  const label = `${Math.round(distanceKm)} km`;
  const icon = L.divIcon({
    className: '',
    html: `<div class="distance-ruler-label">${label}</div>`,
    iconSize: [110, 34],
    iconAnchor: [55, 17]
  });

  if (!appState.rulerLabel) {
    appState.rulerLabel = L.marker(midpoint, {
      icon,
      pane: 'rulerPane',
      interactive: false
    }).addTo(appState.map);
  } else {
    appState.rulerLabel.setLatLng(midpoint);
    appState.rulerLabel.setIcon(icon);
  }
}

function updateActivePoint(point, allowBreakthrough) {
  const previousRealmKey = appState.lastRealmKey;
  const { bavi, hangzhou } = currentRealms(point);

  setText(els.activePointLabel, `${point.label} | ${point.type === 'observed' ? '实况' : '天机推演'}`);
  setText(els.timelineCurrentLabel, point.type === 'observed' ? '最近实况' : '预报推演');
  setText(
    els.activePointDetail,
    `${point.level}，${point.windSpeedMps} m/s，中心距杭州约 ${Math.round(
      haversineDistanceKm(appState.data.hangzhou, point)
    )} km，移动方向 ${point.movement || '待确认'}。`
  );

  if (appState.stormMarker) {
    appState.stormMarker.setLatLng(toLatLon(point));
    appState.stormMarker.setIcon(baviIcon(bavi));
    appState.stormMarker.setPopupContent(pointPopup(point));
  }

  updateHangzhouMarker(hangzhou);
  renderWindCircles(point);
  renderDistanceRuler(point);
  renderStatus();

  if (allowBreakthrough && previousRealmKey && previousRealmKey !== hangzhou.key) {
    triggerBreakthrough(hangzhou, point);
  }

  appState.lastRealmKey = hangzhou.key;
}

function updateSupplyProgress() {
  const total = appState.data?.checklist.length || 0;
  const checked = appState.checkedSupplies.size;

  setText(els.supplyProgress, `${checked} / ${total}`);
  els.supplyProgress.dataset.done = checked === total && total > 0 ? 'true' : 'false';
}

function updateHangzhouMarker(realm = currentRealms().hangzhou) {
  if (!appState.hangzhouMarker) {
    return;
  }

  appState.hangzhouMarker.setIcon(hangzhouIcon(realm));
  appState.hangzhouMarker.setPopupContent(hangzhouPopup(realm));
}

function updateTimelineProgress() {
  const max = Number(els.timeline.max || 0);
  const value = Number(els.timeline.value || 0);
  const progress = max > 0 ? (value / max) * 100 : 0;

  els.timeline.style.setProperty('--timeline-progress', `${progress}%`);
}

function updateShareText() {
  if (!appState.data) {
    return;
  }

  const latest = getLatestObservedPoint(appState.data.track);
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, latest);
  const risk = classifyHangzhouRisk({ distanceKm, windSpeedMps: latest.windSpeedMps });

  els.shareText.value = buildChecklistShareText([...appState.checkedSupplies], {
    riskLabel: risk.label,
    distanceKm,
    updatedAt: appState.data.meta.displayUpdatedAt
  });
}

function renderArtifactPanel() {
  if (!appState.data) {
    return;
  }

  const point = activePoint();
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const { bavi, hangzhou } = currentRealms(point);
  const risk = classifyHangzhouRisk({ distanceKm, windSpeedMps: point.windSpeedMps });

  const panels = {
    distance: {
      title: '量天尺',
      body: `巴威中心距西湖圣地约 ${Math.round(distanceKm)} km。此距离按台风中心坐标与杭州中心点估算。`
    },
    risk: {
      title: '西湖阵图',
      body: `杭州当前境界：${hangzhou.name}。风险等级：${risk.label}。${risk.summary}`
    },
    wind: {
      title: '风圈尺',
      body: appState.windVisible
        ? '风圈已展开，地图显示 7/10/12 级风圈。再次点击风圈尺可收起。'
        : '风圈已收起。再次点击风圈尺可重新展开风圈范围。'
    },
    checklist: {
      title: '道宫五灯',
      body: `已点亮 ${appState.checkedSupplies.size}/${appState.data.checklist.length} 项防台准备。完成越多，西湖大阵越稳定。`
    },
    timeline: {
      title: '虚空盘',
      body: `当前推演点：${point.label}。拖动底部时间轴，可查看实况路径与预报迷雾。`
    },
    trust: {
      title: '天机镜',
      body: `${appState.data.meta.dataFreshness} 正式预警请以气象部门发布为准。`
    }
  };

  const panel = panels[appState.activePanel] || panels.distance;
  setText(els.artifactPanelTitle, panel.title);
  setText(els.artifactPanelBody, panel.body);
}

function updateArtifactDockState() {
  [...els.artifactDock.querySelectorAll('.artifact-button')].forEach((button) => {
    button.dataset.active = button.dataset.panel === appState.activePanel ? 'true' : 'false';
  });
}

function triggerBreakthrough(realm, point) {
  setText(els.breakthroughTitle, `西湖圣地破境：${realm.name}`);
  setText(
    els.breakthroughDetail,
    `依据：距杭州 ${Math.round(haversineDistanceKm(appState.data.hangzhou, point))} km | 最大风速 ${
      point.windSpeedMps
    } m/s`
  );
  els.breakthroughBanner.classList.remove('is-visible');
  void els.breakthroughBanner.offsetWidth;
  els.breakthroughBanner.classList.add('is-visible');

  window.setTimeout(() => {
    els.breakthroughBanner.classList.remove('is-visible');
  }, 3200);
}

function currentRealms(point = activePoint()) {
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const risk = classifyHangzhouRisk({ distanceKm, windSpeedMps: point.windSpeedMps });
  const bavi = deriveBaviRealm({
    distanceKm,
    windSpeedMps: point.windSpeedMps,
    pressureHpa: point.pressureHpa
  });
  const hangzhou = deriveHangzhouRealm({
    distanceKm,
    riskLevel: risk.level,
    completedSupplies: appState.checkedSupplies.size,
    totalSupplies: appState.data.checklist.length
  });

  return { bavi, hangzhou, risk, distanceKm };
}

function activePoint() {
  return appState.data.track[appState.selectedIndex];
}

function latestObservedIndex(track) {
  const latest = getLatestObservedPoint(track);
  return track.findIndex((point) => point.time === latest.time);
}

function toLatLon(point) {
  return [point.lat, point.lon];
}

function formatCoordinate(value, suffix) {
  return `${Number(value).toFixed(1)}°${suffix}`;
}

function hangzhouIcon(realm) {
  return L.divIcon({
    className: '',
    html: `
      <div class="hangzhou-marker ${realm.visualClass}" aria-label="西湖圣地">
        <div class="hangzhou-marker__array"></div>
        <div class="hangzhou-marker__array hangzhou-marker__array--mid"></div>
        <div class="hangzhou-marker__array hangzhou-marker__array--core"></div>
        <strong>杭</strong>
      </div>
    `,
    iconSize: [112, 112],
    iconAnchor: [56, 56]
  });
}

function baviIcon(realm) {
  return L.divIcon({
    className: '',
    html: `
      <div class="bavi-marker ${realm.visualClass}" aria-label="巴威中心">
        <div class="bavi-marker__vortex"></div>
        <div class="bavi-marker__ring"></div>
        <div class="bavi-marker__eye"></div>
      </div>
    `,
    iconSize: [86, 86],
    iconAnchor: [43, 43]
  });
}

function pointPopup(point) {
  const typeLabel = point.type === 'observed' ? '实况' : '预报';
  const coordinate = `${formatCoordinate(point.lat, 'N')} ${formatCoordinate(point.lon, 'E')}`;
  const bavi = deriveBaviRealm({
    distanceKm: haversineDistanceKm(appState.data.hangzhou, point),
    windSpeedMps: point.windSpeedMps,
    pressureHpa: point.pressureHpa
  });

  return `<strong>巴威 BAVI | ${bavi.name}</strong><br>${point.label} | ${typeLabel}<br>${point.level}<br>${coordinate}<br>${point.windSpeedMps} m/s | ${point.pressureHpa} hPa`;
}

function hangzhouPopup(realm) {
  return `<strong>西湖圣地 | ${realm.name}</strong><br>护城大阵稳定度 ${realm.stability}%<br>正式预警请以气象部门发布为准。`;
}

function moodText(mood, baviRealm) {
  const copy = {
    alert: `${baviRealm}仍在远处成形，保持关注。`,
    angry: `${baviRealm}压迫感上升，开始检查门窗和阳台。`,
    furious: `${baviRealm}威压很强，减少不必要外出。`
  };

  return copy[mood] || copy.alert;
}

function heroSummaryText(distanceKm, bavi, hangzhou) {
  return `${bavi.name}距西湖圣地约 ${Math.round(distanceKm)} km。杭州当前境界：${hangzhou.name}。`;
}

function cityBanterText(hangzhouRealm, riskLevel) {
  if (riskLevel === 'high') {
    return `${hangzhouRealm.name}，护城大阵进入重点警戒。`;
  }

  if (riskLevel === 'medium') {
    return `${hangzhouRealm.name}，阳台阵眼和门窗先检查一遍。`;
  }

  return `${hangzhouRealm.name}，先看天机推演，不制造恐慌。`;
}

function balconyIndexText(distanceKm, windSpeedMps) {
  if (distanceKm <= 300 || windSpeedMps >= 50) {
    return '立即收阵';
  }

  if (distanceKm <= 800 || windSpeedMps >= 36) {
    return '提前点灯';
  }

  return '保持巡查';
}

function takeoutIndexText(distanceKm, windSpeedMps) {
  if (distanceKm <= 250 || windSpeedMps >= 50) {
    return '不宜冒险';
  }

  if (distanceKm <= 700 || windSpeedMps >= 36) {
    return '谨慎下单';
  }

  return '普通模式';
}

function distanceNoteText(point) {
  const sourceLabel = appState.data.meta.dataMode?.includes('qweather-live') ? '实时数据' : '示例数据';
  const typeLabel = point.type === 'observed' ? '实况中心坐标' : '预报中心坐标';

  return `${sourceLabel} | 按${typeLabel}到杭州中心点估算`;
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function showToast(message) {
  setText(els.toast, message);
  els.toast.classList.add('is-visible');
  window.setTimeout(() => {
    els.toast.classList.remove('is-visible');
  }, 3600);
}

function refreshMapSize() {
  window.requestAnimationFrame(() => {
    appState.map?.invalidateSize();
  });
}

function observeMapResize() {
  const mapElement = document.querySelector('#map');

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refreshMapSize);
    observer.observe(mapElement);
  }

  window.addEventListener('resize', refreshMapSize);
}
