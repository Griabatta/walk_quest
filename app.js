const els = {
  installBtn: document.querySelector('#installBtn'),
  startCard: document.querySelector('#startCard'),
  questCard: document.querySelector('#questCard'),
  winCard: document.querySelector('#winCard'),
  stepsInput: document.querySelector('#stepsInput'),
  strideInput: document.querySelector('#strideInput'),
  radiusInput: document.querySelector('#radiusInput'),
  startBtn: document.querySelector('#startBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  againBtn: document.querySelector('#againBtn'),
  centerBtn: document.querySelector('#centerBtn'),
  statusText: document.querySelector('#statusText'),
  missionTitle: document.querySelector('#missionTitle'),
  missionText: document.querySelector('#missionText'),
  distanceText: document.querySelector('#distanceText'),
  winRadiusText: document.querySelector('#winRadiusText'),
  stepsText: document.querySelector('#stepsText'),
  routeDistanceText: document.querySelector('#routeDistanceText'),
  routeLink: document.querySelector('#routeLink'),
  historyList: document.querySelector('#historyList'),
  clearHistoryBtn: document.querySelector('#clearHistoryBtn'),
  confetti: document.querySelector('#confetti'),
  iosHint: document.querySelector('#iosHint'),
};

const state = {
  map: null,
  userMarker: null,
  targetMarker: null,
  radiusCircle: null,
  routeLine: null,
  fallbackLine: null,
  routeCoordinates: null,
  routeDistance: null,
  routeDuration: null,
  plannedStart: null,
  watchId: null,
  currentPosition: null,
  target: null,
  mission: null,
  completed: false,
};

const missionTitles = [
  'Точка Луны',
  'Место вечернего выдоха',
  'Секретная остановка',
  'Тихий финиш',
  'Зелёная экспедиция',
  'Маршрут заботы о себе',
  'Операция “ещё немного”',
  'Прогулка маленькой героини',
  'Точка “я смогла”',
  'Вечерний портал',
];

const missionTexts = [
  'Сегодня нужно просто дойти до выбранной точки. Без героизма, но с уважением к себе.',
  'Телефон выбрал место, а твоя задача — спокойно дойти и забрать свою маленькую победу.',
  'Маршрут может быть обычным, но миссия всё равно считается важной.',
  'Иди как исследовательница района: без спешки, с любопытством и правом свернуть на красивую улицу.',
  'Твоя цель где-то впереди. Когда окажешься рядом, приложение само поздравит тебя.',
  'Сегодняшний квест не про скорость. Он про то, что ты вышла и уже молодец.',
];

const winMessages = [
  'Ты дошла. Прогулка засчитана. Очень даже молодец ✨',
  'Миссия выполнена. Вечер стал чуть лучше благодаря тебе 🌙',
  'Финиш пойман. Можно гордиться собой без всяких “но”.',
  'Ты выбрала себя и дошла. Это правда считается.',
  'Победа! Маленькая прогулка, большой плюс к заботе о себе.',
];


function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function toDeg(rad) {
  return rad * 180 / Math.PI;
}

function formatMeters(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(2).replace('.', ',')} км`;
}

function formatSteps(steps) {
  return Number(steps).toLocaleString('ru-RU');
}

function haversineDistance(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function destinationPoint(start, distanceMeters, bearingDegrees) {
  const R = 6371000;
  const bearing = toRad(bearingDegrees);
  const lat1 = toRad(start.lat);
  const lng1 = toRad(start.lng);
  const angularDistance = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDeg(lat2),
    lng: ((toDeg(lng2) + 540) % 360) - 180,
  };
}

function generateTarget(position, steps, strideMeters) {
  const desiredWalkDistance = steps * strideMeters;
  // Запасной вариант, если сервер маршрутов временно недоступен.
  const straightLineDistance = clamp(desiredWalkDistance * 0.62, 350, 6500);
  const bearing = Math.random() * 360;
  return destinationPoint(position, straightLineDistance, bearing);
}

function generateRouteCandidates(position, desiredWalkDistance, count = 16) {
  const candidates = [];

  for (let i = 0; i < count; i += 1) {
    const bearing = (Math.random() * 45) + (i * 360 / count);
    const straightDistance = clamp(
      desiredWalkDistance * (0.34 + Math.random() * 0.48),
      250,
      8500
    );
    candidates.push(destinationPoint(position, straightDistance, bearing));
  }

  return candidates.sort(() => Math.random() - 0.5);
}

async function fetchWalkingRoute(start, finish) {
  const coords = `${start.lng},${start.lat};${finish.lng},${finish.lat}`;
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Сервер маршрутов не ответил.');
    const data = await response.json();
    const route = data.routes?.[0];
    const finishWaypoint = data.waypoints?.[1]?.location;

    if (!route?.geometry?.coordinates?.length || !Number.isFinite(route.distance)) {
      throw new Error('Маршрут не найден.');
    }

    return {
      target: finishWaypoint
        ? { lng: finishWaypoint[0], lat: finishWaypoint[1] }
        : finish,
      distance: route.distance,
      duration: route.duration,
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function findRoutedTarget(position, steps, strideMeters) {
  const desiredWalkDistance = steps * strideMeters;
  const candidates = generateRouteCandidates(position, desiredWalkDistance);
  const routes = [];
  const maxAttempts = 12;

  for (let i = 0; i < Math.min(maxAttempts, candidates.length); i += 1) {
    els.statusText.textContent = `Ищу пеший маршрут: вариант ${i + 1} из ${Math.min(maxAttempts, candidates.length)}…`;

    try {
      const route = await fetchWalkingRoute(position, candidates[i]);
      const relativeDiff = Math.abs(route.distance - desiredWalkDistance) / desiredWalkDistance;
      const tooTiny = route.distance < desiredWalkDistance * 0.45;
      const tooHuge = route.distance > desiredWalkDistance * 1.75;
      const penalty = (tooTiny || tooHuge) ? 0.35 : 0;
      routes.push({ ...route, score: relativeDiff + penalty });

      // Если уже нашли почти идеальный вариант, не мучаем сервер лишними запросами.
      if (relativeDiff <= 0.16) break;
    } catch (err) {
      // Просто пробуем следующую точку: для случайного квеста это нормальная ситуация.
    }
  }

  if (routes.length === 0) return null;
  routes.sort((a, b) => a.score - b.score);
  return routes[0];
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Геолокация не поддерживается этим браузером.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  });
}

function initMap(position) {
  if (state.map) return;

  state.map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([position.lat, position.lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(state.map);
}

function updateMap() {
  if (!state.map || !state.currentPosition || !state.target) return;

  const userLatLng = [state.currentPosition.lat, state.currentPosition.lng];
  const targetLatLng = [state.target.lat, state.target.lng];
  const winRadius = Number(els.radiusInput.value);

  if (!state.userMarker) {
    state.userMarker = L.marker(userLatLng, { title: 'Ты здесь' }).addTo(state.map);
  } else {
    state.userMarker.setLatLng(userLatLng);
  }

  if (!state.targetMarker) {
    state.targetMarker = L.marker(targetLatLng, { title: 'Цель прогулки' }).addTo(state.map);
    state.targetMarker.bindPopup('Финишная зона');
  } else {
    state.targetMarker.setLatLng(targetLatLng);
  }

  if (!state.radiusCircle) {
    state.radiusCircle = L.circle(targetLatLng, {
      radius: winRadius,
      weight: 2,
      fillOpacity: 0.14,
    }).addTo(state.map);
  } else {
    state.radiusCircle.setLatLng(targetLatLng);
    state.radiusCircle.setRadius(winRadius);
  }

  if (state.routeCoordinates?.length) {
    if (!state.routeLine) {
      state.routeLine = L.polyline(state.routeCoordinates, {
        weight: 5,
        opacity: 0.82,
      }).addTo(state.map);
    } else {
      state.routeLine.setLatLngs(state.routeCoordinates);
    }

    if (state.fallbackLine) {
      state.map.removeLayer(state.fallbackLine);
      state.fallbackLine = null;
    }
  } else {
    if (!state.fallbackLine) {
      state.fallbackLine = L.polyline([userLatLng, targetLatLng], {
        weight: 3,
        opacity: 0.65,
        dashArray: '8, 10',
      }).addTo(state.map);
    } else {
      state.fallbackLine.setLatLngs([userLatLng, targetLatLng]);
    }

    if (state.routeLine) {
      state.map.removeLayer(state.routeLine);
      state.routeLine = null;
    }
  }
}

function centerMap() {
  if (!state.map || !state.currentPosition || !state.target) return;

  if (state.routeCoordinates?.length) {
    state.map.fitBounds(L.latLngBounds(state.routeCoordinates).pad(0.22));
    return;
  }

  const bounds = L.latLngBounds(
    [state.currentPosition.lat, state.currentPosition.lng],
    [state.target.lat, state.target.lng]
  ).pad(0.35);
  state.map.fitBounds(bounds);
}

function updateRouteLink() {
  if (!state.currentPosition || !state.target) return;
  const origin = `${state.currentPosition.lat},${state.currentPosition.lng}`;
  const destination = `${state.target.lat},${state.target.lng}`;
  els.routeLink.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

function updateStats() {
  if (!state.currentPosition || !state.target) return;
  const distance = haversineDistance(state.currentPosition, state.target);
  const radius = Number(els.radiusInput.value);

  els.distanceText.textContent = formatMeters(distance);
  els.winRadiusText.textContent = `${radius} м`;
  els.routeDistanceText.textContent = state.routeDistance ? formatMeters(state.routeDistance) : 'примерно';

  if (!state.completed && distance <= radius) {
    completeQuest(distance);
  }
}

function startWatching() {
  if (!('geolocation' in navigator)) return;
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);

  state.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      state.currentPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      updateMap();
      updateRouteLink();
      updateStats();
    },
    () => {
      els.statusText.textContent = 'Не получилось обновить геолокацию. Проверь разрешение и GPS.';
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
  );
}

function playWinSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + index * 0.13;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch (err) {
    // Звук не критичен: на некоторых телефонах браузер может его заблокировать.
  }
}

function vibrateWin() {
  if ('vibrate' in navigator) {
    navigator.vibrate([120, 80, 120, 80, 260]);
  }
}

function showConfetti() {
  els.confetti.innerHTML = '';
  els.confetti.classList.remove('hidden');

  for (let i = 0; i < 42; i += 1) {
    const piece = document.createElement('i');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    els.confetti.appendChild(piece);
  }

  window.setTimeout(() => {
    els.confetti.classList.add('hidden');
  }, 2300);
}

function saveHistory(entry) {
  const history = getHistory();
  history.unshift(entry);
  localStorage.setItem('walkQuestHistory', JSON.stringify(history.slice(0, 20)));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('walkQuestHistory')) || [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = getHistory();
  els.historyList.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('li');
    empty.innerHTML = '<strong>Пока прогулок нет</strong><span>Первая миссия появится здесь после победы.</span>';
    els.historyList.appendChild(empty);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    const routePart = item.routeDistance ? ` · маршрут: ${item.routeDistance}` : '';
    li.innerHTML = `<strong>${item.title}</strong><span>${item.date} · ${formatSteps(item.steps)} шагов${routePart} · финиш: ${item.finishDistance}</span>`;
    els.historyList.appendChild(li);
  });
}

function completeQuest(distance) {
  state.completed = true;
  els.winMessage.textContent = randomItem(winMessages);
  els.winCard.classList.remove('hidden');
  els.winCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

  playWinSound();
  vibrateWin();
  showConfetti();

  saveHistory({
    title: state.mission.title,
    steps: Number(els.stepsInput.value),
    routeDistance: state.routeDistance ? formatMeters(state.routeDistance) : 'без маршрута',
    finishDistance: formatMeters(distance),
    date: new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date()),
  });
}

function clearRouteLayers() {
  if (!state.map) return;
  [state.targetMarker, state.radiusCircle, state.routeLine, state.fallbackLine].forEach((layer) => {
    if (layer) state.map.removeLayer(layer);
  });
  state.targetMarker = null;
  state.radiusCircle = null;
  state.routeLine = null;
  state.fallbackLine = null;
}

function setQuestVisible(visible) {
  els.questCard.classList.toggle('hidden', !visible);
  els.winCard.classList.add('hidden');
}

async function startQuest() {
  els.statusText.textContent = 'Определяю, где ты сейчас…';
  els.startBtn.disabled = true;
  els.resetBtn.disabled = true;
  els.startBtn.textContent = 'Выбираю маршрут…';

  try {
    const steps = clamp(Number(els.stepsInput.value) || 4000, 500, 30000);
    const stride = clamp(Number(els.strideInput.value) || 0.65, 0.4, 1);
    els.stepsInput.value = steps;
    els.strideInput.value = stride;

    const position = await getCurrentLocation();
    state.currentPosition = position;
    state.plannedStart = position;
    state.completed = false;
    state.routeCoordinates = null;
    state.routeDistance = null;
    state.routeDuration = null;
    clearRouteLayers();

    const routedTarget = await findRoutedTarget(position, steps, stride);

    if (routedTarget) {
      state.target = routedTarget.target;
      state.routeCoordinates = routedTarget.coordinates;
      state.routeDistance = routedTarget.distance;
      state.routeDuration = routedTarget.duration;
    } else {
      state.target = generateTarget(position, steps, stride);
      state.routeCoordinates = null;
      state.routeDistance = null;
      state.routeDuration = null;
    }

    state.mission = {
      title: randomItem(missionTitles),
      text: routedTarget
        ? `${randomItem(missionTexts)} Маршрут подобран по пешеходным дорожкам примерно под твою цель.`
        : `${randomItem(missionTexts)} Сервер пеших маршрутов не ответил, поэтому цель выбрана запасным способом по примерной дистанции.`,
    };

    els.missionTitle.textContent = state.mission.title;
    els.missionText.textContent = state.mission.text;
    els.stepsText.textContent = formatSteps(steps);
    els.winRadiusText.textContent = `${els.radiusInput.value} м`;
    els.routeDistanceText.textContent = state.routeDistance ? formatMeters(state.routeDistance) : 'примерно';
    els.statusText.textContent = routedTarget
      ? `Миссия запущена. Пеший маршрут: ${formatMeters(state.routeDistance)}.`
      : 'Миссия запущена в запасном режиме.';

    setQuestVisible(true);
    initMap(position);
    setTimeout(() => state.map?.invalidateSize(), 100);
    updateMap();
    updateRouteLink();
    updateStats();
    centerMap();
    startWatching();
  } catch (err) {
    let message = 'Не получилось получить геолокацию.';
    if (err.code === 1) message = 'Геолокация запрещена. Разреши доступ к местоположению в браузере.';
    if (err.code === 2) message = 'Телефон не смог определить местоположение. Проверь GPS.';
    if (err.code === 3) message = 'Геолокация слишком долго не отвечала. Попробуй ещё раз на улице.';
    els.statusText.textContent = message;
  } finally {
    els.startBtn.disabled = false;
    els.resetBtn.disabled = false;
    els.startBtn.textContent = 'Начать миссию';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }
}

function setupInstallPrompt() {
  let deferredPrompt = null;

  if (isIOSDevice() && !isStandaloneMode()) {
    els.iosHint?.classList.remove('hidden');
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.classList.remove('hidden');
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function setupEvents() {
  document.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.stepsInput.value = btn.dataset.steps;
    });
  });

  els.startBtn.addEventListener('click', startQuest);
  els.resetBtn.addEventListener('click', startQuest);
  els.againBtn.addEventListener('click', () => {
    els.winCard.classList.add('hidden');
    startQuest();
  });
  els.centerBtn.addEventListener('click', centerMap);
  els.radiusInput.addEventListener('change', () => {
    updateMap();
    updateStats();
  });
  els.clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('walkQuestHistory');
    renderHistory();
  });
}

registerServiceWorker();
setupInstallPrompt();
setupEvents();
renderHistory();
