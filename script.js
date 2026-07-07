import {
  buildChecklistShareText,
  classifyHangzhouRisk,
  getLatestObservedPoint,
  haversineDistanceKm,
  typhoonMood
} from './src/typhoon-utils.js';

const appState = {
  data: null,
  map: null,
  stormMarker: null,
  windLayers: [],
  selectedIndex: 0,
  checkedSupplies: new Set()
};

const els = {
  avatar: document.querySelector('.storm-avatar'),
  moodLabel: document.querySelector('#storm-mood-label'),
  riskLabel: document.querySelector('#risk-label'),
  riskSummary: document.querySelector('#risk-summary'),
  heroSummary: document.querySelector('#hero-summary'),
  cityBanter: document.querySelector('#city-banter'),
  distanceValue: document.querySelector('#distance-value'),
  stormLevel: document.querySelector('#storm-level'),
  stormMove: document.querySelector('#storm-move'),
  windPressure: document.querySelector('#wind-pressure'),
  balconyIndex: document.querySelector('#balcony-index'),
  takeoutIndex: document.querySelector('#takeout-index'),
  updatedAt: document.querySelector('#updated-at'),
  dataFreshness: document.querySelector('#data-freshness'),
  timeline: document.querySelector('#timeline'),
  timelineStart: document.querySelector('#timeline-start'),
  timelineEnd: document.querySelector('#timeline-end'),
  activePointLabel: document.querySelector('#active-point-label'),
  activePointDetail: document.querySelector('#active-point-detail'),
  supplyList: document.querySelector('#supply-list'),
  shareText: document.querySelector('#share-text'),
  sourceNote: document.querySelector('#source-note'),
  disclaimer: document.querySelector('#disclaimer'),
  toast: document.querySelector('#toast')
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

    renderStatus();
    renderMap();
    renderTimeline();
    renderChecklist();
    renderNotes();
  } catch (error) {
    showToast(error.message || '台风数据读取失败，请稍后重试。');
    els.riskSummary.textContent = '数据读取失败，请检查 data/typhoon-bavi.json 是否存在。';
  }
}

function renderStatus() {
  const latest = getLatestObservedPoint(appState.data.track);
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, latest);
  const risk = classifyHangzhouRisk({ distanceKm, windSpeedMps: latest.windSpeedMps });
  const mood = typhoonMood(latest.windSpeedMps);

  els.riskLabel.textContent = risk.label;
  els.riskSummary.textContent = `${risk.headline}。${risk.summary}`;
  els.distanceValue.textContent = `${Math.round(distanceKm)} km`;
  els.stormLevel.textContent = latest.level;
  els.stormMove.textContent = latest.movement;
  els.windPressure.textContent = `${latest.windSpeedMps} m/s · ${latest.pressureHpa} hPa`;
  els.updatedAt.textContent = appState.data.meta.displayUpdatedAt;
  els.dataFreshness.textContent = appState.data.meta.dataFreshness;
  els.avatar.dataset.mood = mood;
  els.moodLabel.textContent = moodText(mood);
  els.heroSummary.textContent = heroSummaryText(distanceKm, risk.level);
  els.cityBanter.textContent = cityBanterText(distanceKm, risk.level);
  els.balconyIndex.textContent = balconyIndexText(distanceKm, latest.windSpeedMps);
  els.takeoutIndex.textContent = takeoutIndexText(distanceKm, latest.windSpeedMps);

  updateShareText();
}

function renderMap() {
  const { hangzhou, track } = appState.data;
  const active = track[appState.selectedIndex];

  appState.map = L.map('map', {
    zoomControl: false,
    scrollWheelZoom: true
  }).setView([hangzhou.lat, hangzhou.lon], 5);

  L.control.zoom({ position: 'bottomleft' }).addTo(appState.map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(appState.map);

  const observed = track.filter((point) => point.type === 'observed').map(toLatLon);
  const forecast = track.filter((point) => point.type === 'forecast').map(toLatLon);

  L.polyline(observed, {
    color: '#ff6b4a',
    weight: 4,
    lineCap: 'round'
  }).addTo(appState.map);

  L.polyline(forecast, {
    color: '#f5c451',
    weight: 3,
    dashArray: '8 10',
    lineCap: 'round'
  }).addTo(appState.map);

  L.marker([hangzhou.lat, hangzhou.lon], {
    icon: L.divIcon({
      className: '',
      html: '<div class="hangzhou-marker" aria-label="杭州"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })
  })
    .addTo(appState.map)
    .bindPopup('<strong>杭州小队</strong><br>西湖阵地，观察巴威走位');

  appState.stormMarker = L.marker(toLatLon(active), {
    icon: stormIcon(),
    zIndexOffset: 800
  }).addTo(appState.map);

  appState.stormMarker.bindPopup(pointPopup(active)).openPopup();
  renderWindCircles(active);

  const bounds = L.latLngBounds([...observed, ...forecast, [hangzhou.lat, hangzhou.lon]]);
  appState.map.fitBounds(bounds, { padding: [32, 32] });
  observeMapResize();
  refreshMapSize();
}

function renderTimeline() {
  const { track } = appState.data;

  els.timeline.max = String(track.length - 1);
  els.timeline.value = String(appState.selectedIndex);
  els.timelineStart.textContent = track[0].label;
  els.timelineEnd.textContent = track[track.length - 1].label;
  updateActivePoint(track[appState.selectedIndex]);

  els.timeline.addEventListener('input', (event) => {
    appState.selectedIndex = Number(event.target.value);
    const point = track[appState.selectedIndex];
    updateActivePoint(point);

    if (appState.stormMarker) {
      appState.stormMarker.setLatLng(toLatLon(point));
      appState.stormMarker.setPopupContent(pointPopup(point)).openPopup();
      renderWindCircles(point);
    }
  });
}

function renderChecklist() {
  els.supplyList.innerHTML = '';

  appState.data.checklist.forEach((item) => {
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

      updateShareText();
    });

    const text = document.createElement('span');
    text.textContent = item;

    label.append(checkbox, text);
    els.supplyList.append(label);
  });

  updateShareText();
}

function renderNotes() {
  const sourceNames = appState.data.sources.map((source) => source.name).join('、');
  els.sourceNote.textContent = `数据源规划：${sourceNames}。${appState.data.meta.sourceNote}`;
  els.disclaimer.textContent = appState.data.disclaimer;
}

function renderWindCircles(point) {
  appState.windLayers.forEach((layer) => layer.remove());
  appState.windLayers = [];

  const circles = [
    { key: 'r7', color: '#72d6cb', label: '7 级风圈' },
    { key: 'r10', color: '#f5c451', label: '10 级风圈' },
    { key: 'r12', color: '#ff6b4a', label: '12 级风圈' }
  ];

  circles.forEach((circle) => {
    const radiusKm = Number(point.windRadiiKm?.[circle.key] || 0);

    if (radiusKm <= 0) {
      return;
    }

    const layer = L.circle(toLatLon(point), {
      radius: radiusKm * 1000,
      color: circle.color,
      weight: 1,
      fillColor: circle.color,
      fillOpacity: 0.09,
      opacity: 0.72
    })
      .addTo(appState.map)
      .bindTooltip(`${circle.label}约 ${radiusKm} km`);

    appState.windLayers.push(layer);
  });
}

function updateActivePoint(point) {
  const distanceKm = haversineDistanceKm(appState.data.hangzhou, point);
  const typeLabel = point.type === 'observed' ? '实况' : '预报';

  els.activePointLabel.textContent = `${point.label} · ${typeLabel}`;
  els.activePointDetail.textContent = `${point.level}，${point.windSpeedMps} m/s，中心距杭州约 ${Math.round(
    distanceKm
  )} km，移动方向 ${point.movement}。`;
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

function latestObservedIndex(track) {
  const latest = getLatestObservedPoint(track);
  return track.findIndex((point) => point.time === latest.time);
}

function toLatLon(point) {
  return [point.lat, point.lon];
}

function stormIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="storm-marker" aria-label="台风中心"></div>',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
}

function pointPopup(point) {
  const typeLabel = point.type === 'observed' ? '实况' : '预报';

  return `<strong>巴威选手 ${point.label}</strong><br>${typeLabel} · ${point.level}<br>${point.windSpeedMps} m/s · ${point.pressureHpa} hPa`;
}

function moodText(mood) {
  const copy = {
    alert: '巴威正在热身',
    angry: '巴威开始摆脸色',
    furious: '巴威火力全开'
  };

  return copy[mood] || copy.alert;
}

function heroSummaryText(distanceKm, riskLevel) {
  const distance = Math.round(distanceKm);

  if (riskLevel === 'high') {
    return `巴威离杭州约 ${distance} km，杭州小队进入认真防守，阳台杂物请立刻归队。`;
  }

  if (riskLevel === 'medium') {
    return `巴威离杭州约 ${distance} km，暂时不像直冲脸，但杭州小队已经把伞翻出来了。`;
  }

  return `巴威离杭州约 ${distance} km，目前还在远处表演转圈，杭州先保持围观。`;
}

function cityBanterText(distanceKm, riskLevel) {
  if (riskLevel === 'high') {
    return '杭州小队：别看西湖很淡定，阳台已经开始点名了。';
  }

  if (riskLevel === 'medium') {
    return '杭州小队：先把窗户检查一下，别等风来帮你装修。';
  }

  if (distanceKm > 1000) {
    return '杭州小队：巴威还远，西湖边先端起茶杯观察走位。';
  }

  return '杭州小队：距离不算贴脸，但防台清单可以先勾起来。';
}

function balconyIndexText(distanceKm, windSpeedMps) {
  if (distanceKm <= 300 || windSpeedMps >= 50) {
    return '花盆撤退';
  }

  if (distanceKm <= 800 || windSpeedMps >= 36) {
    return '提前收衣';
  }

  return '先看一眼';
}

function takeoutIndexText(distanceKm, windSpeedMps) {
  if (distanceKm <= 250 || windSpeedMps >= 50) {
    return '骑手辛苦';
  }

  if (distanceKm <= 700 || windSpeedMps >= 36) {
    return '谨慎下单';
  }

  return '普通模式';
}

function showToast(message) {
  els.toast.textContent = message;
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
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(refreshMapSize);
    observer.observe(document.querySelector('#map'));
    return;
  }

  window.addEventListener('resize', refreshMapSize);
}
