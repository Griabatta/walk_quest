const STORAGE_KEY = 'eveningWalkQuest.history.v2.yandex';

const el = {
  installBtn: document.getElementById('installBtn'),
  startCard: document.getElementById('startCard'),
  questCard: document.getElementById('questCard'),
  winCard: document.getElementById('winCard'),
  stepsInput: document.getElementById('stepsInput'),
  strideInput: document.getElementById('strideInput'),
  radiusInput: document.getElementById('radiusInput'),
  attemptsInput: document.getElementById('attemptsInput'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  againBtn: document.getElementById('againBtn'),
  centerBtn: document.getElementById('centerBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  statusText: document.getElementById('statusText'),
  iosHint: document.getElementById('iosHint'),
  missionTitle: document.getElementById('missionTitle'),
  missionText: document.getElementById('missionText'),
  distanceText: document.getElementById('distanceText'),
  routeDistanceText: document.getElementById('routeDistanceText'),
  winRadiusText: document.getElementById('winRadiusText'),
  stepsText: document.getElementById('stepsText'),
  routeLink: document.getElementById('routeLink'),
  historyList: document.getElementById('historyList'),
  confetti: document.getElementById('confetti')
};

const state = {
  map: null,
  userPlacemark: null,
  targetPlacemark: null,
  winCircle: null,
  routeObject: null,
  watchId: null,
  current: null,
  target: null,
  routeMeters: null,
  won: false,
  ymapsReady: false
};

const titles = [
  'Тайная точка вечера',
  'Маленькая экспедиция',
  'Прогулочный портал',
  'Маршрут для выдоха',
  'Лунная миссия',
  'Точка “я молодец”'
];

const missionPhrases = [
  'Сегодня цель выбрана картой. Идём спокойно, без гонки — просто доходим до своей точки.',
  'У тебя есть маршрут, вечер и маленький повод выйти из дома. Это уже победа наполовину.',
  'Иди в своём темпе. Приложение засчитает миссию, когда ты окажешься в зоне цели.',
  'Твоя задача простая: дойти до отмеченной зоны и забрать заслуженное “ты молодец”.'
];

function setStatus(text) { el.statusText.textContent = text; }
function formatSteps(n) { return new Intl.NumberFormat('ru-RU').format(Math.round(n)); }
function formatMeters(m) {
  if (!Number.isFinite(m)) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} км` : `${Math.round(m)} м`;
}
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function toRad(v) { return v * Math.PI / 180; }
function toDeg(v) { return v * 180 / Math.PI; }

function haversine(a, b) {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function destinationPoint([lat, lon], meters, bearingDeg) {
  const R = 6371000;
  const bearing = toRad(bearingDeg);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);
  const delta = meters / R;
  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(bearing);
  const phi2 = Math.asin(sinPhi2);
  const y = Math.sin(bearing) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * sinPhi2;
  const lambda2 = lambda1 + Math.atan2(y, x);
  return [toDeg(phi2), ((toDeg(lambda2) + 540) % 360) - 180];
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('На этом устройстве геолокация не поддерживается.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve([pos.coords.latitude, pos.coords.longitude]),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 18000, maximumAge: 8000 }
    );
  });
}

function waitForYmaps() {
  return new Promise((resolve, reject) => {
    if (!window.ymaps) {
      reject(new Error('Яндекс Карты не загрузились. Проверь интернет или ключ API.'));
      return;
    }
    ymaps.ready(() => {
      state.ymapsReady = true;
      resolve();
    });
  });
}

function initMap(center) {
  if (state.map) return;
  state.map = new ymaps.Map('map', {
    center,
    zoom: 15,
    controls: ['zoomControl', 'geolocationControl']
  }, {
    suppressMapOpenBlock: true,
    yandexMapDisablePoiInteractivity: true
  });
}

function clearMapObjects() {
  if (!state.map) return;
  [state.routeObject, state.userPlacemark, state.targetPlacemark, state.winCircle].forEach(obj => {
    if (obj) state.map.geoObjects.remove(obj);
  });
  state.routeObject = null;
  state.userPlacemark = null;
  state.targetPlacemark = null;
  state.winCircle = null;
}

function setUserPlacemark(coords) {
  if (!state.map) return;
  if (!state.userPlacemark) {
    state.userPlacemark = new ymaps.Placemark(coords, { hintContent: 'Ты здесь' }, {
      preset: 'islands#circleIcon',
      iconColor: '#4f7d5a'
    });
    state.map.geoObjects.add(state.userPlacemark);
  } else {
    state.userPlacemark.geometry.setCoordinates(coords);
  }
}

function setTargetObjects(target, radius) {
  state.targetPlacemark = new ymaps.Placemark(target, { hintContent: 'Цель прогулки' }, {
    preset: 'islands#redIcon'
  });
  state.winCircle = new ymaps.Circle([target, radius], {
    hintContent: 'Зона победы'
  }, {
    fillColor: '#4f7d5a33',
    strokeColor: '#4f7d5a',
    strokeOpacity: 0.8,
    strokeWidth: 2
  });
  state.map.geoObjects.add(state.winCircle);
  state.map.geoObjects.add(state.targetPlacemark);
}

async function buildYandexRoute(from, to, options = {}) {
  const route = await ymaps.route([from, to], {
    routingMode: 'pedestrian',
    mapStateAutoApply: false
  });
  const meters = route.getLength();
  if (!Number.isFinite(meters) || meters <= 0) throw new Error('Не удалось получить длину маршрута');
  if (options.addToMap) {
    route.getPaths().options.set({
      strokeColor: '#8b6f47',
      strokeWidth: 5,
      opacity: 0.9
    });
    route.getWayPoints().options.set('visible', false);
    state.map.geoObjects.add(route);
    state.routeObject = route;
  }
  return { route, meters };
}

async function pickRouteByGoal(from, targetMeters, attempts) {
  const candidates = [];
  for (let i = 0; i < attempts; i++) {
    const directDistance = targetMeters * (0.38 + Math.random() * 0.42);
    const bearing = Math.random() * 360;
    candidates.push(destinationPoint(from, directDistance, bearing));
  }

  const results = [];
  for (let i = 0; i < candidates.length; i++) {
    setStatus(`Подбираю пеший маршрут через Яндекс Карты… ${i + 1}/${candidates.length}`);
    try {
      const { route, meters } = await buildYandexRoute(from, candidates[i]);
      const diff = Math.abs(meters - targetMeters);
      results.push({ to: candidates[i], route, meters, diff });
    } catch (error) {
      console.warn('Route candidate failed', error);
    }
  }

  if (!results.length) {
    const fallback = destinationPoint(from, targetMeters * 0.55, Math.random() * 360);
    return { to: fallback, route: null, meters: null, fallback: true };
  }

  results.sort((a, b) => a.diff - b.diff);
  return results[0];
}

function updateDistance() {
  if (!state.current || !state.target) return;
  const radius = Number(el.radiusInput.value);
  const distance = haversine(state.current, state.target);
  const toZone = Math.max(0, distance - radius);
  el.distanceText.textContent = toZone <= 0 ? 'внутри зоны' : formatMeters(toZone);
  if (distance <= radius && !state.won) completeMission();
}

function startWatching() {
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
  if (!navigator.geolocation) return;
  state.watchId = navigator.geolocation.watchPosition(
    pos => {
      state.current = [pos.coords.latitude, pos.coords.longitude];
      setUserPlacemark(state.current);
      updateDistance();
    },
    err => console.warn('watchPosition error', err),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
  );
}

async function startQuest() {
  try {
    state.won = false;
    el.startBtn.disabled = true;
    setStatus('Получаю твоё местоположение…');

    const steps = clamp(Number(el.stepsInput.value) || 4000, 500, 30000);
    const stride = clamp(Number(el.strideInput.value) || 0.65, 0.4, 1);
    const radius = Number(el.radiusInput.value) || 75;
    const attempts = Number(el.attemptsInput.value) || 12;
    const targetMeters = steps * stride;

    await waitForYmaps();
    const current = await getPosition();
    state.current = current;

    el.startCard.classList.add('hidden');
    el.winCard.classList.add('hidden');
    el.questCard.classList.remove('hidden');

    initMap(current);
    clearMapObjects();
    setUserPlacemark(current);

    const picked = await pickRouteByGoal(current, targetMeters, attempts);
    state.target = picked.to;
    state.routeMeters = picked.meters;

    clearMapObjects();
    setUserPlacemark(current);
    setTargetObjects(state.target, radius);

    if (picked.route) {
      picked.route.getPaths().options.set({
        strokeColor: '#8b6f47',
        strokeWidth: 5,
        opacity: 0.9
      });
      picked.route.getWayPoints().options.set('visible', false);
      state.map.geoObjects.add(picked.route);
      state.routeObject = picked.route;
      state.map.setBounds(picked.route.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
    } else {
      state.map.setBounds(ymaps.util.bounds.fromPoints([current, state.target]), { checkZoomRange: true, zoomMargin: 48 });
    }

    const title = randomItem(titles);
    el.missionTitle.textContent = title;
    el.missionText.textContent = picked.fallback
      ? 'Яндекс не смог построить маршрут к случайным точкам, поэтому цель выбрана запасным способом. Дойди до зоны на карте.'
      : randomItem(missionPhrases);
    el.stepsText.textContent = `${formatSteps(steps)} шагов`;
    el.winRadiusText.textContent = `${radius} м`;
    el.routeDistanceText.textContent = picked.meters ? formatMeters(picked.meters) : 'примерно';
    el.routeLink.href = makeYandexRouteLink(current, state.target);

    setStatus('Маршрут готов. Можно идти ✨');
    updateDistance();
    startWatching();
  } catch (error) {
    console.error(error);
    el.startCard.classList.remove('hidden');
    el.questCard.classList.add('hidden');
    setStatus(error.message || 'Не получилось начать миссию. Проверь геолокацию, HTTPS и интернет.');
  } finally {
    el.startBtn.disabled = false;
  }
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function makeYandexRouteLink(from, to) {
  const rtext = `${from[0]},${from[1]}~${to[0]},${to[1]}`;
  return `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`;
}

function completeMission() {
  state.won = true;
  el.winCard.classList.remove('hidden');
  el.winMessage.textContent = `Ты дошла до цели. Маршрут ${state.routeMeters ? formatMeters(state.routeMeters) : 'засчитан'}. Ты молодец 🌙`;
  saveHistory();
  renderHistory();
  celebrate();
  playWinSound();
  if ('vibrate' in navigator) navigator.vibrate([120, 70, 160]);
}

function saveHistory() {
  const items = getHistory();
  items.unshift({
    date: new Date().toISOString(),
    steps: Number(el.stepsInput.value) || 4000,
    radius: Number(el.radiusInput.value) || 75,
    routeMeters: state.routeMeters,
    provider: 'Яндекс Карты'
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function renderHistory() {
  const items = getHistory();
  el.historyList.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = 'Пока прогулок нет. Первая миссия ждёт тебя.';
    el.historyList.append(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    const date = new Date(item.date);
    li.innerHTML = `<strong>${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${formatSteps(item.steps)} шагов</strong>${item.routeMeters ? `Маршрут: ${formatMeters(item.routeMeters)} · ` : ''}Радиус: ${item.radius} м · ${item.provider || 'карта'}`;
    el.historyList.append(li);
  }
}

function celebrate() {
  el.confetti.classList.remove('hidden');
  el.confetti.innerHTML = '';
  const colors = ['#8b6f47', '#4f7d5a', '#d9a650', '#f1e0cb', '#a45b45'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    el.confetti.append(piece);
  }
  setTimeout(() => el.confetti.classList.add('hidden'), 2600);
}

function playWinSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.13 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.13);
      osc.stop(ctx.currentTime + idx * 0.13 + 0.2);
    });
  } catch (error) {
    console.warn('Sound error', error);
  }
}

function setupInstallPrompt() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    el.installBtn.classList.remove('hidden');
  });
  el.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    el.installBtn.classList.add('hidden');
  });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !navigator.standalone) el.iosHint.classList.remove('hidden');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }
}

for (const btn of document.querySelectorAll('.chip')) {
  btn.addEventListener('click', () => { el.stepsInput.value = btn.dataset.steps; });
}
el.startBtn.addEventListener('click', startQuest);
el.resetBtn.addEventListener('click', startQuest);
el.againBtn.addEventListener('click', () => {
  el.winCard.classList.add('hidden');
  el.startCard.classList.remove('hidden');
  el.questCard.classList.add('hidden');
});
el.centerBtn.addEventListener('click', () => {
  if (state.map && state.current) state.map.setCenter(state.current, 16, { duration: 250 });
});
el.clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
});

setupInstallPrompt();
registerServiceWorker();
renderHistory();
