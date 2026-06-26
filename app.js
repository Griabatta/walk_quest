const STORAGE_KEY = 'eveningWalkQuest.history.v4.cozyDetectiveYandex';

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
  caseNumber: document.getElementById('caseNumber'),
  missionTitle: document.getElementById('missionTitle'),
  missionText: document.getElementById('missionText'),
  clueText: document.getElementById('clueText'),
  distanceText: document.getElementById('distanceText'),
  routeDistanceText: document.getElementById('routeDistanceText'),
  winRadiusText: document.getElementById('winRadiusText'),
  stepsText: document.getElementById('stepsText'),
  routeLink: document.getElementById('routeLink'),
  historyList: document.getElementById('historyList'),
  confetti: document.getElementById('confetti'),
  bonusTask: document.getElementById('bonusTask'),
  winMessage: document.getElementById('winMessage')
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
  activeCase: null,
  activeSong: null,
  won: false,
  ymapsReady: false
};

const detectiveCases = [
  {
    title: 'Проверить улику у старой кофейни',
    text: 'Бариста слышал что-то странное вчера вечером. Лучше дойти до места и расспросить его лично.',
    clue: 'Говорят, улика появляется только в закатном свете.'
  },
  {
    title: 'Встретиться с информатором',
    text: 'Информатор согласился выйти на связь только в отмеченной точке. Дойди туда спокойно и без суеты.',
    clue: 'Он обычно ждёт там, где горят самые тёплые окна.'
  },
  {
    title: 'Дело о пропавшем следе',
    text: 'На карте появился след, который ведёт через город. Нужно проверить, куда он приведёт.',
    clue: 'Если увидишь тихий двор или витрину с огоньками — ты на правильном пути.'
  },
  {
    title: 'Тайна городского архива',
    text: 'В старом деле нашлась новая координата. Дойди до неё и поставь отметку в архиве.',
    clue: 'Архив любит тех, кто не сворачивает за пять минут до финала.'
  },
  {
    title: 'Проверка алиби у площади',
    text: 'Один слишком спокойный уголок города требует проверки. Сегодня он станет твоей точкой расследования.',
    clue: 'Главная подсказка — просто продолжать идти.'
  },
  {
    title: 'Операция “Тихий квартал”',
    text: 'Поступил сигнал из тихого квартала. Нужно дойти до зоны и подтвердить, что всё под контролем.',
    clue: 'Самые важные дела иногда выглядят как обычная прогулка.'
  },
  {
    title: 'Секрет старого сквера',
    text: 'Кто-то оставил послание рядом с зелёной зоной. Проверь место и закрой вечернее дело.',
    clue: 'Следи за фонарями: они часто знают больше, чем кажется.'
  },
  {
    title: 'Кодовое имя: Закатный след',
    text: 'Маршрут засекречен, но цель уже отмечена. Дойди до зоны — и дело будет раскрыто.',
    clue: 'Идеальная скорость детектива — та, при которой ещё можно смотреть по сторонам.'
  }
];

const winSongs = [
  'The Paper Kites — Bloom',
  'Djo — End of Beginning',
  'Lord Huron — The Night We Met',
  'Kavinsky — Nightcall',
  'Cigarettes After Sex — Apocalypse',
  'Angus & Julia Stone — Chateau',
  'Fleetwood Mac — Dreams',
  'M83 — Midnight City',
  'AURORA — Runaway',
  'The xx — Intro',
  'Vetusta Morla — Copenhague',
  'Natalia Lafourcade — Hasta la raíz',
  'Zaz — Je veux',
  'Manu Chao — Me gustas tú',
  'Queen — Don’t Stop Me Now'
];

const waterWords = [
  'река', 'речка', 'озеро', 'пруд', 'водоём', 'водоем', 'море', 'залив', 'бухта', 'канал',
  'водохранилище', 'ручей', 'протока', 'набережная реки', 'пляж', 'harbour', 'river', 'lake',
  'pond', 'sea', 'bay', 'canal', 'reservoir', 'stream', 'water'
];

const goodGeocoderKinds = new Set([
  'house', 'street', 'metro', 'district', 'locality', 'area', 'province', 'country', 'vegetation', 'railway', 'station', 'other'
]);

function setStatus(text) {
  if (el.statusText) el.statusText.textContent = text;
}

function formatSteps(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function formatMeters(m) {
  if (!Number.isFinite(m)) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} км` : `${Math.round(m)} м`;
}

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function toRad(v) { return v * Math.PI / 180; }
function toDeg(v) { return v * 180 / Math.PI; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

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
      iconColor: '#315c47'
    });
    state.map.geoObjects.add(state.userPlacemark);
  } else {
    state.userPlacemark.geometry.setCoordinates(coords);
  }
}

function setTargetObjects(target, radius) {
  state.winCircle = new ymaps.Circle([target, radius], {
    hintContent: 'Зона выполнения миссии'
  }, {
    fillColor: '#ffd37a35',
    strokeColor: '#d7a85b',
    strokeOpacity: 0.95,
    strokeWidth: 3
  });
  state.targetPlacemark = new ymaps.Placemark(target, {
    hintContent: 'Точка миссии',
    balloonContent: 'Здесь нужно проверить улику'
  }, {
    preset: 'islands#darkGreenDotIconWithCaption',
    iconColor: '#a34c36'
  });
  state.map.geoObjects.add(state.winCircle);
  state.map.geoObjects.add(state.targetPlacemark);
}

async function getPlaceInfo(coords) {
  try {
    const result = await ymaps.geocode(coords, { results: 1 });
    const first = result.geoObjects.get(0);
    if (!first) return { ok: false, reason: 'no-geocode-result', name: '' };

    const address = first.getAddressLine() || first.properties.get('name') || '';
    const meta = first.properties.get('metaDataProperty.GeocoderMetaData') || {};
    const kind = String(meta.kind || '').toLowerCase();
    const lowerAddress = address.toLowerCase();
    const waterLike = kind === 'hydro' || waterWords.some(word => lowerAddress.includes(word));

    if (waterLike) return { ok: false, reason: 'water', kind, name: address };

    const kindLooksUsable = !kind || goodGeocoderKinds.has(kind) || kind !== 'hydro';
    return { ok: kindLooksUsable, reason: kindLooksUsable ? 'ok' : 'bad-kind', kind, name: address };
  } catch (error) {
    console.warn('Geocode check failed', error);
    return { ok: true, reason: 'geocode-unavailable', name: '' };
  }
}

async function buildYandexRoute(from, to) {
  const route = await ymaps.route([from, to], {
    routingMode: 'pedestrian',
    mapStateAutoApply: false
  });
  const meters = route.getLength();
  if (!Number.isFinite(meters) || meters <= 0) throw new Error('Не удалось получить длину маршрута');
  return { route, meters };
}

function makeCandidatePoints(from, targetMeters, attempts) {
  const candidates = [];
  const count = Math.max(attempts, 12);

  for (let i = 0; i < count; i++) {
    const directDistance = targetMeters * (0.28 + Math.random() * 0.52);
    const bearing = Math.random() * 360;
    candidates.push(destinationPoint(from, directDistance, bearing));
  }

  for (let i = 0; i < 6; i++) {
    const directDistance = Math.max(250, Math.min(targetMeters * (0.18 + Math.random() * 0.22), 1800));
    const bearing = Math.random() * 360;
    candidates.push(destinationPoint(from, directDistance, bearing));
  }

  return candidates;
}

async function pickSafeFallback(from, targetMeters) {
  const fallbackCandidates = makeCandidatePoints(from, Math.min(targetMeters, 1800), 18);
  for (const point of fallbackCandidates) {
    const info = await getPlaceInfo(point);
    if (info.ok) return { to: point, route: null, meters: null, fallback: true, placeInfo: info };
  }

  return {
    to: destinationPoint(from, 300, Math.random() * 360),
    route: null,
    meters: null,
    fallback: true,
    placeInfo: { ok: true, reason: 'last-resort', name: '' }
  };
}

async function pickRouteByGoal(from, targetMeters, attempts) {
  const candidates = makeCandidatePoints(from, targetMeters, attempts);
  const results = [];

  for (let i = 0; i < candidates.length; i++) {
    setStatus(`Ищу закатную улику и пеший маршрут… ${i + 1}/${candidates.length}`);
    try {
      const placeInfo = await getPlaceInfo(candidates[i]);
      if (!placeInfo.ok) continue;

      const { route, meters } = await buildYandexRoute(from, candidates[i]);
      const diff = Math.abs(meters - targetMeters);
      results.push({ to: candidates[i], route, meters, diff, placeInfo });
    } catch (error) {
      console.warn('Route candidate failed', error);
    }
  }

  if (!results.length) return pickSafeFallback(from, targetMeters);

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

function shortPlaceName(placeInfo) {
  const raw = placeInfo?.name || '';
  if (!raw) return '';
  const parts = raw.split(',').map(part => part.trim()).filter(Boolean);
  return parts.slice(-2).join(', ').slice(0, 90);
}

function makeMissionText(caseItem, picked) {
  const place = shortPlaceName(picked.placeInfo);
  const placeText = place ? ` Ориентир: ${place}.` : '';
  return `${caseItem.text}${placeText}`;
}

function makeCaseNumber() {
  return `ДЕЛО №${Math.floor(10 + Math.random() * 89)}`;
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
    if (el.bonusTask) el.bonusTask.classList.add('hidden');

    initMap(current);
    clearMapObjects();
    setUserPlacemark(current);

    const picked = await pickRouteByGoal(current, targetMeters, attempts);
    state.target = picked.to;
    state.routeMeters = picked.meters;
    state.activeCase = randomItem(detectiveCases);
    state.activeSong = randomItem(winSongs);

    clearMapObjects();
    setUserPlacemark(current);

    if (picked.route) {
      picked.route.getPaths().options.set({
        strokeColor: '#ffd37a',
        strokeWidth: 6,
        opacity: 0.95
      });
      picked.route.getWayPoints().options.set('visible', false);
      state.map.geoObjects.add(picked.route);
      state.routeObject = picked.route;
      state.map.setBounds(picked.route.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
    } else {
      state.map.setBounds(ymaps.util.bounds.fromPoints([current, state.target]), { checkZoomRange: true, zoomMargin: 48 });
    }

    setTargetObjects(state.target, radius);

    el.caseNumber.textContent = makeCaseNumber();
    el.missionTitle.textContent = state.activeCase.title;
    el.missionText.textContent = makeMissionText(state.activeCase, picked);
    el.clueText.textContent = state.activeCase.clue;
    el.stepsText.textContent = `${formatSteps(steps)} шагов`;
    el.winRadiusText.textContent = `${radius} м`;
    el.routeDistanceText.textContent = picked.meters ? formatMeters(picked.meters) : 'тайная точка';
    el.routeLink.href = makeYandexRouteLink(current, state.target);

    setStatus('Миссия готова. Можно идти 🕵️‍♀️');
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

function makeYandexRouteLink(from, to) {
  const rtext = `${from[0]},${from[1]}~${to[0]},${to[1]}`;
  return `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`;
}

function completeMission() {
  state.won = true;
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }

  el.questCard.classList.add('hidden');
  el.winCard.classList.remove('hidden');
  el.winMessage.textContent = `Отличная работа, детектив! Ты дошла до точки. Маршрут ${state.routeMeters ? formatMeters(state.routeMeters) : 'засчитан'}, а город стал чуть безопаснее.`;

  if (el.bonusTask) {
    el.bonusTask.innerHTML = `
      <span class="bonus-title">Финальная улика</span>
      <div class="record-row">
        <div class="record-icon" aria-hidden="true"></div>
        <div>
          <strong>Послушай: ${escapeHtml(state.activeSong || randomItem(winSongs))}</strong>
          <small>Иногда лучший способ понять улику — пройтись под хорошую музыку и подумать.</small>
        </div>
      </div>
    `;
    el.bonusTask.classList.remove('hidden');
  }

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
    provider: 'Яндекс Карты',
    caseTitle: state.activeCase?.title || 'Детективная миссия',
    song: state.activeSong || null
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
    const routePart = item.routeMeters ? `Маршрут: ${formatMeters(item.routeMeters)} · ` : '';
    const songPart = item.song ? `<br><span>Финальная песня: ${escapeHtml(item.song)}</span>` : '';
    li.innerHTML = `<strong>${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${escapeHtml(item.caseTitle || 'Миссия')} · ${formatSteps(item.steps)} шагов</strong>${routePart}Радиус: ${item.radius} м · ${item.provider || 'карта'}${songPart}`;
    el.historyList.append(li);
  }
}

function celebrate() {
  el.confetti.classList.remove('hidden');
  el.confetti.innerHTML = '';
  const colors = ['#ffd37a', '#315c47', '#d7a85b', '#f4e4c8', '#a34c36', '#6f7657'];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    el.confetti.append(piece);
  }
  setTimeout(() => el.confetti.classList.add('hidden'), 2700);
}

function playWinSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.2);
    });
  } catch (error) {
    console.warn('Sound error', error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setupInstallPrompt() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (el.installBtn) el.installBtn.classList.remove('hidden');
  });
  if (el.installBtn) {
    el.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      el.installBtn.classList.add('hidden');
    });
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !navigator.standalone && el.iosHint) el.iosHint.classList.remove('hidden');
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
