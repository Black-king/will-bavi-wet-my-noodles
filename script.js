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
  distanceValue: document.querySelector('#distance-value'),
  stormLevel: document.querySelector('#storm-level'),
  windPressure: document.querySelector('#wind-pressure'),
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
  els.windPressure.textContent = `${latest.windSpeedMps} m/s · ${latest.pressureHpa} hPa`;
  els.updatedAt.textContent = appState.data.meta.displayUpdatedAt;
  els.dataFreshness.textContent = appState.data.meta.dataFreshness;
  els.avatar.dataset.mood = mood;
  els.moodLabel.textContent = moodText(mood);

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
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })
  })
    .addTo(appState.map)
    .bindPopup('<strong>杭州</strong><br>本页默认观察点');

  appState.stormMarker = L.marker(toLatLon(active), {
    icon: stormIcon(),
    zIndexOffset: 800
  }).addTo(appState.map);

  appState.stormMarker.bindPopup(pointPopup(active)).openPopup();
  renderWindCircles(active);

  const bounds = L.latLngBounds([...observed, ...forecast, [hangzhou.lat, hangzhou.lon]]);
  appState.map.fitBounds(bounds, { padding: [32, 32] });
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
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function pointPopup(point) {
  const typeLabel = point.type === 'observed' ? '实况' : '预报';

  return `<strong>巴威 ${point.label}</strong><br>${typeLabel} · ${point.level}<br>${point.windSpeedMps} m/s · ${point.pressureHpa} hPa`;
}

function moodText(mood) {
  const copy = {
    alert: '巴威正在蓄力',
    angry: '巴威进入暴躁模式',
    furious: '巴威火力全开'
  };

  return copy[mood] || copy.alert;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('is-visible');
  window.setTimeout(() => {
    els.toast.classList.remove('is-visible');
  }, 3600);
}
