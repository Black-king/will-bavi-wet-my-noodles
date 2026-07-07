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
import { initFx } from './src/fx-particles.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fx = initFx(document.querySelector('#fx-canvas'), { prefersReducedMotion });

const appState = {
  data: null,
  map: null,
  hangzhouMarker: null,
  stormMarker: null,
  stormIconKey: '',
  hangzhouIconKey: '',
  lastDistanceKm: null,
  lastPanAt: 0,
  rulerLine: null,
  rulerLabel: null,
  windLayers: [],
  activePanel: 'distance',
  selectedIndex: 0,
  timelineDragging: false,
  lastRealmKey: '',
  lastBaviRealmKey: '',
  checkedSupplies: new Set(),
  windVisible: false
};

const els = {
  artifactDock: document.querySelector('#artifact-dock'),
  artifactPanel: document.querySelector('#artifact-panel'),
  artifactPanelTitle: document.querySelector('#artifact-panel-title'),
  artifactPanelBody: document.querySelector('#artifact-panel-body'),
  balconyIndex: document.querySelector('#balcony-index'),
  baviRealm: document.querySelector('#bavi-realm'),
  baviRealmDesc: document.querySelector('#bavi-realm-desc'),
  breakthroughBanner: document.querySelector('#breakthrough-banner'),
  breakthroughKicker: document.querySelector('#breakthrough-kicker'),
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
  hangzhouRealmDesc: document.querySelector('#hangzhou-realm-desc'),
  heroSummary: document.querySelector('#hero-summary'),
  riskLabel: document.querySelector('#risk-label'),
  riskSummary: document.querySelector('#risk-summary'),
  realmLore: document.querySelector('#realm-lore'),
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
    appState.lastBaviRealmKey = currentRealms().bavi.key;

    renderDataMode();
    renderArtifactDock();
    renderMap();
    renderTimeline();
    renderChecklist();
    renderNotes();
    renderStatus();
    document.body.classList.add('is-awakened');
    fx.setAmbient(baviAmbientLevel());
    fx.emitBurst(window.innerWidth / 2, window.innerHeight * 0.4, { count: 18, spread: 1.6 });
  } catch (error) {
    document.body.classList.add('is-awakened');
    showToast(error.message || '台风数据读取失败，请稍后重试。');
    setText(els.riskSummary, '数据读取失败，请检查 data/typhoon-bavi.json 是否存在。');
  }
}

function renderDataMode() {
  const mode = appState.data.meta.dataMode || '';
  const isLive = mode.includes('qweather-live');

  const fetchedLabel = appState.data.meta.displayUpdatedAt;
  setText(els.dataModeLabel, isLive ? (fetchedLabel ? `实时数据 | 抓取 ${fetchedLabel}` : '实时数据') : '示例数据');
  els.dataModeLabel.dataset.mode = isLive ? 'live' : 'sample';
}

function renderArtifactDock() {
  els.artifactDock.innerHTML = '';

  getImperialArtifacts().forEach((artifact) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'artifact-button';
    button.dataset.panel = artifact.panel;
    button.dataset.visible = artifact.panel === 'wind' ? String(appState.windVisible) : 'true';
    button.title = artifact.summary;
    button.innerHTML = `<span>${artifact.label}</span><small>${artifact.summary}</small>`;
    button.addEventListener('click', () => {
      if (artifact.panel === 'wind') {
        appState.windVisible = !appState.windVisible;
        renderWindCircles(activePoint());
        if (appState.windVisible && appState.windLayers.length === 0) {
          showToast(`${activePoint().label} 这个时点没有风圈数据，拖动时间轴到临近登陆的实况点再试。`);
        } else if (appState.windVisible) {
          focusWindCircles();
        }
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

  appState.map.createPane('rulerPane');
  appState.map.getPane('rulerPane').style.zIndex = 470;

  L.control.zoom({ position: 'bottomleft' }).addTo(appState.map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 12,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(appState.map);

  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxZoom: 12,
    attribution: '&copy; 高德地图'
  })
    .on('tileerror', hideBrokenTile)
    .addTo(appState.map);

  renderTrackLines();
  renderTrackPoints();
  renderHangzhouMarker();

  appState.stormMarker = L.marker(toLatLon(active), {
    icon: baviIcon(currentRealms().bavi, active),
    zIndexOffset: 900
  }).addTo(appState.map);
  bindHoverPopup(appState.stormMarker, pointPopup(active));

  renderWindCircles(active);
  renderDistanceRuler(active);

  const bounds = L.latLngBounds([...track.map(toLatLon), [hangzhou.lat, hangzhou.lon]]);
  fitBattleBounds(bounds);
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

function renderTrackPoints() {
  const seenDays = new Set();

  appState.data.track.forEach((point, index) => {
    const isObserved = point.type === 'observed';

    const marker = L.circleMarker(toLatLon(point), {
      radius: index === appState.selectedIndex ? 7 : 4,
      color: isObserved ? '#efd48a' : '#8fdcff',
      weight: 2,
      fillColor: isObserved ? '#d85f3f' : '#102b42',
      fillOpacity: isObserved ? 0.92 : 0.72,
      className: isObserved ? 'track-point track-point--observed' : 'track-point track-point--forecast'
    })
      .addTo(appState.map)
      .bindPopup(pointPopup(point), { closeButton: false });

    const dayLabel = dayMarkLabel(point);
    if (dayLabel && !seenDays.has(dayLabel.day)) {
      seenDays.add(dayLabel.day);
      marker.bindTooltip(dayLabel.text, {
        permanent: true,
        direction: 'top',
        offset: [0, -6],
        className: `day-label ${isObserved ? 'day-label--observed' : 'day-label--forecast'}`
      });
    }
  });
}

function dayMarkLabel(point) {
  const match = String(point.label || '').match(/^(\d{2})-(\d{2})\s+(\d{2}):/);

  if (!match) {
    return null;
  }

  const [, month, day, hour] = match;
  return { day: `${month}-${day}`, text: `${Number(day)}日${Number(hour)}时` };
}

function renderHangzhouMarker() {
  const realm = currentRealms().hangzhou;
  const { hangzhou } = appState.data;

  appState.hangzhouMarker = L.marker([hangzhou.lat, hangzhou.lon], {
    icon: hangzhouIcon(realm),
    zIndexOffset: 880
  })
    .addTo(appState.map);
  bindHoverPopup(appState.hangzhouMarker, hangzhouPopup(realm));
}

function renderTimeline() {
  const { track } = appState.data;

  els.timeline.max = String(track.length - 1);
  els.timeline.value = String(appState.selectedIndex);
  setText(els.timelineStart, track[0].label);
  setText(els.timelineEnd, track[track.length - 1].label);
  updateForecastSplit();
  updateActivePoint(activePoint(), false);
  updateTimelineProgress();

  els.timeline.addEventListener('input', (event) => {
    setSelectedTimelineIndex(Number(event.target.value), true);
  });
  els.timeline.addEventListener('pointerdown', (event) => {
    appState.timelineDragging = true;
    document.body.classList.add('is-divining');
    els.timeline.setPointerCapture?.(event.pointerId);
    setTimelineFromClientX(event.clientX, true);
  });
  els.timeline.addEventListener('pointermove', (event) => {
    if (!appState.timelineDragging) {
      return;
    }

    setTimelineFromClientX(event.clientX, true);
  });
  window.addEventListener('pointerup', () => {
    appState.timelineDragging = false;
    document.body.classList.remove('is-divining');
  });
  window.addEventListener('pointercancel', () => {
    appState.timelineDragging = false;
    document.body.classList.remove('is-divining');
  });
}

function updateForecastSplit() {
  const { track } = appState.data;
  const firstForecast = track.findIndex((point) => point.type === 'forecast');
  const ratio = firstForecast < 0 ? 1 : firstForecast / Math.max(1, track.length - 1);

  els.timeline.style.setProperty('--timeline-forecast-start', `${(ratio * 100).toFixed(1)}%`);
}

function setSelectedTimelineIndex(index, allowBreakthrough) {
  const max = Number(els.timeline.max || 0);
  const nextIndex = Math.max(0, Math.min(max, Math.round(index)));

  if (nextIndex === appState.selectedIndex && els.timeline.value === String(nextIndex)) {
    return;
  }

  appState.selectedIndex = nextIndex;
  els.timeline.value = String(nextIndex);
  updateActivePoint(activePoint(), allowBreakthrough);
  updateTimelineProgress();
}

function setTimelineFromClientX(clientX, allowBreakthrough) {
  const rect = els.timeline.getBoundingClientRect();
  const max = Number(els.timeline.max || 0);
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const index = Math.round(Math.max(0, Math.min(1, ratio)) * max);

  setSelectedTimelineIndex(index, allowBreakthrough);
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
        const rect = checkbox.getBoundingClientRect();
        fx.emitBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 12 });
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
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const risk = classifyHangzhouRisk({ distanceKm, windSpeedMps: point.windSpeedMps });
  const { bavi, hangzhou } = currentRealms(point);

  setText(els.baviRealm, bavi.name);
  setText(els.hangzhouRealm, hangzhou.name);
  setText(els.baviRealmDesc, bavi.description);
  setText(els.hangzhouRealmDesc, hangzhou.description);
  setText(els.riskLabel, risk.label);
  setText(els.riskSummary, `${risk.headline}。${risk.summary}`);
  animateDistance(els.distanceValue, distanceKm, (km) => `${km} km`);
  setText(els.distanceReadout, `量天尺：${Math.round(distanceKm)} km`);
  appState.lastDistanceKm = distanceKm;
  setText(els.stormLevel, point.level);
  setText(els.stormMove, point.movement || '待确认');
  setText(els.windPressure, `${point.windSpeedMps} m/s | ${point.pressureHpa} hPa`);
  setText(els.updatedAt, selectedPointTimeLabel(point));
  setText(els.dataFreshness, appState.data.meta.dataFreshness);
  setText(els.stormMoodLabel, moodText(typhoonMood(point.windSpeedMps), bavi.name));
  setText(els.realmLore, `${bavi.name}：${bavi.basis}`);
  setText(els.heroSummary, heroSummaryText(distanceKm, bavi, hangzhou));
  setText(els.cityBanter, cityBanterText(hangzhou, risk.level));
  setText(els.balconyIndex, balconyIndexText(distanceKm, point.windSpeedMps));
  setText(els.takeoutIndex, takeoutIndexText(distanceKm, point.windSpeedMps));
  setText(els.distanceNote, distanceNoteText(point));
  document.body.dataset.hangzhouRealm = hangzhou.key;
  document.body.dataset.baviRealm = bavi.key;
  fx.setAmbient(baviAmbientLevel(bavi.key));

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
      weight: circle.key === 'r7' ? 2 : 2.5,
      fillColor: circle.color,
      fillOpacity: circle.key === 'r7' ? 0.12 : 0.16,
      opacity: 0.94,
      className: `wind-circle wind-circle--${circle.key}`
    })
      .addTo(appState.map)
      .bindTooltip(`${circle.label}约 ${radiusKm} km`);

    appState.windLayers.push(layer);
  });
}

function focusWindCircles() {
  if (!appState.map || appState.windLayers.length === 0) {
    return;
  }

  const { hangzhou } = appState.data;
  const bounds = appState.windLayers[0].getBounds();
  appState.windLayers.slice(1).forEach((layer) => bounds.extend(layer.getBounds()));
  bounds.extend([hangzhou.lat, hangzhou.lon]);
  fitBattleBounds(bounds, { maxZoom: 6 });
}

function fitBattleBounds(bounds, options = {}) {
  appState.map.fitBounds(bounds, {
    paddingTopLeft: [400, 220],
    paddingBottomRight: [118, 156],
    ...options
  });
}

function hideBrokenTile(event) {
  event.tile.style.display = 'none';
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
  const previousBaviRealmKey = appState.lastBaviRealmKey;
  const { bavi, hangzhou } = currentRealms(point);

  setText(els.activePointLabel, `${point.label} | ${point.type === 'observed' ? '实况' : '天机推演'}`);
  setText(els.timelineCurrentLabel, point.type === 'observed' ? '最近实况' : '预报推演');
  els.timelineCurrentLabel.dataset.phase = point.type === 'observed' ? 'observed' : 'forecast';
  setText(
    els.activePointDetail,
    `${point.level}，${point.windSpeedMps} m/s，中心距杭州约 ${Math.round(
      haversineDistanceKm(appState.data.hangzhou, point)
    )} km，移动方向 ${point.movement || '待确认'}。`
  );

  if (appState.stormMarker) {
    appState.stormMarker.setLatLng(toLatLon(point));
    const iconKey = `${bavi.visualClass}|${typhoonMood(point.windSpeedMps)}`;
    if (iconKey !== appState.stormIconKey) {
      appState.stormMarker.setIcon(baviIcon(bavi, point));
      appState.stormIconKey = iconKey;
    }
    appState.stormMarker.setPopupContent(pointPopup(point));
  }

  followActivePoint(point);
  updateHangzhouMarker(hangzhou);
  renderWindCircles(point);
  renderDistanceRuler(point);
  renderStatus();

  if (allowBreakthrough && previousRealmKey && previousRealmKey !== hangzhou.key) {
    triggerBreakthrough(hangzhou, point);
  } else if (allowBreakthrough && previousBaviRealmKey && previousBaviRealmKey !== bavi.key) {
    triggerBaviBreakthrough(bavi, point);
  }

  appState.lastRealmKey = hangzhou.key;
  appState.lastBaviRealmKey = bavi.key;
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

  if (realm.visualClass !== appState.hangzhouIconKey) {
    appState.hangzhouMarker.setIcon(hangzhouIcon(realm));
    appState.hangzhouIconKey = realm.visualClass;
  }
  appState.hangzhouMarker.setPopupContent(hangzhouPopup(realm));
}

function followActivePoint(point) {
  if (!appState.map || prefersReducedMotion) {
    return;
  }

  const target = L.latLng(toLatLon(point));
  if (appState.map.getBounds().pad(-0.18).contains(target)) {
    return;
  }

  const now = Date.now();
  if (appState.timelineDragging && now - appState.lastPanAt < 150) {
    return;
  }

  appState.lastPanAt = now;
  appState.map.panTo(target, { animate: true, duration: 0.6, easeLinearity: 0.3 });
}

function animateDistance(element, targetKm, format) {
  const from = appState.lastDistanceKm;
  const to = Math.round(targetKm);

  if (prefersReducedMotion || from === null || Math.round(from) === to) {
    setText(element, format(to));
    return;
  }

  animateNumber(element, Math.round(from), to, format);
}

function animateNumber(element, from, to, format, duration = 700) {
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    setText(element, format(Math.round(from + (to - from) * eased)));
    if (t < 1) {
      window.requestAnimationFrame(frame);
    }
  }

  window.requestAnimationFrame(frame);
}

function baviAmbientLevel(key = document.body.dataset.baviRealm) {
  const levels = {
    'sea-omen': 0,
    'east-sea-lord': 1,
    'bavi-tianzun': 1,
    'guixu-shadow': 2,
    'guixu-pressure': 3
  };

  return levels[key] ?? 1;
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

  els.shareText.value = buildChecklistShareText([...appState.checkedSupplies]);
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
      body: `巴威中心距西湖圣地约 ${Math.round(distanceKm)} km，连线见地图量天尺。`
    },
    risk: {
      title: '西湖阵图',
      body: `杭州当前境界：${hangzhou.name}。${hangzhou.description} 当前风险：${risk.label}，${risk.summary}`
    },
    wind: {
      title: '风圈尺',
      body: appState.windVisible
        ? '风圈已展开，地图显示 7/10/12 级风圈。再次点击风圈尺可收起。'
        : '风圈已收起。再次点击风圈尺可重新展开风圈范围。'
    },
    checklist: {
      title: '道宫五灯',
      body: `已点亮 ${appState.checkedSupplies.size}/${appState.data.checklist.length} 项防台准备。${hangzhou.advice}`
    },
    timeline: {
      title: '虚空盘',
      body: `当前推演点：${point.label}。拖动底部时间轴，可查看实况路径与预报推演。`
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
    if (button.dataset.panel === 'wind') {
      button.dataset.visible = String(appState.windVisible);
      button.setAttribute('aria-pressed', String(appState.windVisible));
    }
  });
}

function triggerBreakthrough(realm, point) {
  showBreakthroughBanner({
    variant: 'hangzhou',
    kicker: '天机有变',
    title: `西湖圣地破境：${realm.name}`,
    detail: `依据：距杭州 ${Math.round(haversineDistanceKm(appState.data.hangzhou, point))} km | 最大风速 ${
      point.windSpeedMps
    } m/s`,
    palette: ['#f2d98a', '#d8b768', '#fff8df']
  });
}

function triggerBaviBreakthrough(realm, point) {
  showBreakthroughBanner({
    variant: 'bavi',
    kicker: '归墟异动',
    title: `巴威晋阶：${realm.name}`,
    detail: `依据：最大风速 ${point.windSpeedMps} m/s | 中心气压 ${point.pressureHpa} hPa`,
    palette: ['#dc6247', '#c2402a', '#f2d98a']
  });
}

function showBreakthroughBanner({ variant, kicker, title, detail, palette }) {
  els.breakthroughBanner.dataset.variant = variant;
  setText(els.breakthroughKicker, kicker);
  setText(els.breakthroughTitle, title);
  setText(els.breakthroughDetail, detail);
  els.breakthroughBanner.classList.remove('is-visible');
  void els.breakthroughBanner.offsetWidth;
  els.breakthroughBanner.classList.add('is-visible');
  document.body.dataset.realmShift = 'true';
  fx.emitBurst(window.innerWidth / 2, window.innerHeight / 2, { count: 26, spread: 2.2, palette });

  window.setTimeout(() => {
    delete document.body.dataset.realmShift;
  }, 1400);
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

function bindHoverPopup(layer, content) {
  layer.bindPopup(content, {
    closeButton: false,
    autoPan: false,
    className: 'realm-popup'
  });
  layer.on('mouseover', () => layer.openPopup());
  layer.on('mouseout', () => layer.closePopup());
  const element = layer.getElement?.();
  element?.addEventListener('mouseenter', () => layer.openPopup());
  element?.addEventListener('mouseleave', () => layer.closePopup());
  return layer;
}

function hangzhouIcon(realm) {
  return L.divIcon({
    className: '',
    html: `
      <div class="hangzhou-marker ${realm.visualClass}" aria-label="西湖圣地">
        <div class="hangzhou-marker__array"></div>
        <div class="hangzhou-marker__array hangzhou-marker__array--mid"></div>
        <div class="hangzhou-marker__array hangzhou-marker__array--core"></div>
        <div class="hangzhou-marker__lotus"></div>
        <strong>杭</strong>
      </div>
    `,
    iconSize: [112, 112],
    iconAnchor: [56, 56]
  });
}

function baviIcon(realm, point = activePoint()) {
  const mood = typhoonMood(point.windSpeedMps);

  return L.divIcon({
    className: '',
    html: `
      <div class="bavi-marker ${realm.visualClass}" data-mood="${mood}" aria-label="巴威中心">
        <div class="bavi-marker__wake"></div>
        <div class="bavi-marker__arms bavi-marker__arms--outer"></div>
        <div class="bavi-marker__arms bavi-marker__arms--mid"></div>
        <div class="bavi-marker__vortex"></div>
        <div class="bavi-marker__sigil"></div>
        <div class="bavi-marker__ring"></div>
        <div class="bavi-marker__eye"></div>
        <div class="bavi-marker__motes">
          <i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i><i style="--i:3"></i><i style="--i:4"></i>
        </div>
      </div>
    `,
    iconSize: [120, 120],
    iconAnchor: [60, 60]
  });
}

function pointPopup(point) {
  const typeLabel = point.type === 'observed' ? '实况' : '预报';
  const coordinate = `${formatCoordinate(point.lat, 'N')} ${formatCoordinate(point.lon, 'E')}`;
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const bavi = deriveBaviRealm({
    distanceKm,
    windSpeedMps: point.windSpeedMps,
    pressureHpa: point.pressureHpa
  });

  return `<strong>巴威 BAVI | ${bavi.name}</strong><br>${bavi.description}<br>${point.label} | ${typeLabel}<br>${point.level}<br>${coordinate}<br>距杭州约 ${Math.round(distanceKm)} km<br>${point.windSpeedMps} m/s | ${point.pressureHpa} hPa`;
}

function hangzhouPopup(realm) {
  const point = activePoint();
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);

  return `<strong>西湖圣地 | ${realm.name}</strong><br>${realm.description}<br>${point.label} 视角：巴威距杭州约 ${Math.round(distanceKm)} km<br>护城大阵稳定度 ${realm.stability}%<br>${realm.advice}<br>正式预警请以气象部门发布为准。`;
}

function selectedPointTimeLabel(point) {
  return `${point.label} | ${point.type === 'observed' ? '实况点' : '预报点'}`;
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
  return hangzhou.advice;
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
  const typeLabel = point.type === 'observed' ? '实况中心' : '预报中心';

  return `按${typeLabel}到杭州中心点直线估算`;
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
