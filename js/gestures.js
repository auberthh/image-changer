/* ============================================================
   gestures.js — control por gestos con la cámara (Fase 2)

   Usa MediaPipe Hands (Google) para detectar hasta 2 manos con
   21 puntos cada una, directamente en el navegador:

     · Una mano moviéndose a la izquierda / derecha → navegar
     · Dos manos abiertas separándose / juntándose  → zoom progresivo
     · Dos manos cerradas (puños)                   → restablecer + automático

   Las acciones asignadas a cada gesto se leen de Settings.get().gestures
   y se ejecutan a través de la API pública de Viewer.
   ============================================================ */

const Gestures = (() => {
  // La librería se descarga solo al activar la cámara; el service
  // worker la guarda en caché para que después funcione sin internet.
  const HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/';

  // Umbrales de detección (coordenadas normalizadas 0..1)
  const SWIPE_WINDOW_MS = 450;   // ventana de tiempo para medir el movimiento
  const SWIPE_MIN_DX = 0.25;     // desplazamiento mínimo para contar un swipe
  const SWIPE_OPEN_MIN = 1.2;    // la mano debe estar abierta para el swipe
  const COOLDOWN_MS = 1500;      // pausa entre gestos discretos
  const OPEN_RATIO = 1.45;       // dedos estirados respecto a los nudillos
  const CLOSED_RATIO = 1.05;     // dedos recogidos (puño)
  const FIST_HOLD_MS = 700;      // tiempo con el puño cerrado para voltear
  const TWO_FIST_HOLD_MS = 600;  // tiempo con ambos puños para el modo automático
  const PHANTOM_DIST = 0.09;     // dos "manos" más cerca que esto son una duplicada
  const STILL_MS = 250;          // quietud necesaria para rearmar el swipe
  const STILL_DX = 0.05;         // movimiento máximo que cuenta como "quieta"

  const state = {
    active: false,
    loading: false,
    hands: null,
    stream: null,
    busy: false,
    rafId: null,
    trail: [],          // recorrido reciente de la muñeca: {x, t}
    lastGestureAt: -Infinity,
    zoomBase: null,     // {dist, zoom} al iniciar el zoom con dos manos
    armed: true,        // tras un swipe, la mano debe detenerse para rearmar
    fistSince: null,    // instante en que se cerró el puño
    fistDone: false,    // el puño ya disparó; hay que abrir la mano de nuevo
    twoFistSince: null, // instante en que se cerraron ambos puños
  };

  const el = {};

  // Traduce el nombre de una acción configurada a la función del visor
  const actions = {
    'next': () => Viewer.next(),
    'prev': () => Viewer.prev(),
    'flip': () => Viewer.flip(),
    'reset': () => { Viewer.reset(); Viewer.startAuto(); },
    'zoom': () => Viewer.zoomIn(),
    'zoom-out': () => Viewer.zoomOut(),
  };

  function run(actionName) {
    const action = actions[actionName];
    if (action) action();
  }

  function label(text) {
    el.label.textContent = text;
  }

  // --- Carga diferida de MediaPipe Hands ---
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureHands() {
    if (state.hands) return;
    if (!window.Hands) await loadScript(HANDS_CDN + 'hands.js');
    state.hands = new Hands({ locateFile: (file) => HANDS_CDN + file });
    state.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,          // el modelo ligero basta y va fluido
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    state.hands.onResults(onResults);
  }

  // --- Encendido / apagado de la cámara ---
  async function start() {
    if (state.active || state.loading) return;
    state.loading = true;
    el.panel.classList.remove('hidden');
    el.button.classList.add('pressed');
    label('Cargando modelo…');
    try {
      await ensureHands();
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      el.video.srcObject = state.stream;
      await el.video.play();
      state.active = true;
      label('Buscando manos…');
      loop();
    } catch (err) {
      console.error('Gestos:', err);
      label('⚠ Sin acceso a la cámara');
      stopCamera();
    }
    state.loading = false;
  }

  function stop() {
    stopCamera();
    el.panel.classList.add('hidden');
    el.button.classList.remove('pressed');
    label('Cámara apagada');
  }

  function stopCamera() {
    state.active = false;
    cancelAnimationFrame(state.rafId);
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    state.trail = [];
    state.zoomBase = null;
  }

  function toggle() {
    state.active || state.loading ? stop() : start();
  }

  // --- Bucle de análisis: envía cada fotograma a MediaPipe ---
  async function loop() {
    if (!state.active) return;
    if (!state.busy && el.video.readyState >= 2) {
      state.busy = true;
      try { await state.hands.send({ image: el.video }); } catch {}
      state.busy = false;
    }
    state.rafId = requestAnimationFrame(loop);
  }

  // --- Geometría de la mano ---
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

  // Qué tan abierta está la mano: distancia de las puntas de los dedos
  // a la muñeca, comparada con la de los nudillos a la muñeca.
  // ≳1.45 = mano abierta · ≲1.05 = puño cerrado
  function openness(lm) {
    const wrist = lm[0];
    const tips = avg([8, 12, 16, 20].map((i) => dist(lm[i], wrist)));
    const knuckles = avg([5, 9, 13, 17].map((i) => dist(lm[i], wrist)));
    return tips / knuckles;
  }

  function cooldownReady(now) {
    return now - state.lastGestureAt > COOLDOWN_MS;
  }

  function discrete(actionName, text, now) {
    if (!cooldownReady(now)) return false;
    state.lastGestureAt = now;
    state.trail = [];
    state.armed = false;   // exigir que la mano se detenga antes del siguiente
    label(text);
    run(actionName);
    return true;
  }

  // --- Interpretación de los resultados de MediaPipe ---
  function onResults(results) {
    draw(results);
    let hands = results.multiHandLandmarks || [];
    const now = performance.now();
    const gestures = Settings.get().gestures;

    // A veces MediaPipe detecta la misma mano duplicada: dos "manos" con
    // las muñecas casi en el mismo punto se tratan como una sola.
    if (hands.length === 2 && dist(hands[0][0], hands[1][0]) < PHANTOM_DIST) {
      hands = [hands[0]];
    }

    if (hands.length === 2) {
      state.trail = [];
      state.fistSince = null;
      const [a, b] = hands;
      const oa = openness(a);
      const ob = openness(b);

      if (oa > OPEN_RATIO && ob > OPEN_RATIO) {
        // 🙌 Dos manos abiertas
        state.twoFistSince = null;
        if (gestures.handsOpen === 'zoom') {
          // Zoom progresivo: la separación entre las muñecas controla la escala
          const separation = dist(a[0], b[0]);
          if (!state.zoomBase) {
            state.zoomBase = { dist: separation, zoom: Viewer.getZoom() };
          }
          Viewer.setZoom(state.zoomBase.zoom * (separation / state.zoomBase.dist));
          label(`🙌 Zoom ${Math.round(Viewer.getZoom() * 100)}%`);
        } else {
          state.zoomBase = null;
          discrete(gestures.handsOpen, '🙌 Manos abiertas', now);
        }
      } else if (oa < CLOSED_RATIO && ob < CLOSED_RATIO) {
        // ✊✊ Dos puños cerrados: hay que MANTENERLOS un momento — una
        // sola detección ruidosa no debe activar el modo automático
        state.zoomBase = null;
        if (!state.twoFistSince) state.twoFistSince = now;
        if (now - state.twoFistSince > TWO_FIST_HOLD_MS) {
          if (discrete(gestures.handsClose, '✊✊ Manos cerradas', now)) {
            state.twoFistSince = null;
          }
        } else {
          label('✊✊ Mantén los puños…');
        }
      } else {
        state.zoomBase = null;
        state.twoFistSince = null;
        label('🙌 Dos manos detectadas');
      }
      return;
    }

    state.twoFistSince = null;

    state.zoomBase = null;

    if (hands.length === 1) {
      const lm = hands[0];
      const open = openness(lm);

      // ✊ Puño mantenido con una mano → voltear pantalla (configurable)
      if (open < CLOSED_RATIO) {
        state.trail = [];
        if (!state.fistDone) {
          if (!state.fistSince) state.fistSince = now;
          if (now - state.fistSince > FIST_HOLD_MS) {
            // marcarlo como disparado solo si de verdad se ejecutó:
            // hay que abrir la mano para poder repetirlo
            if (discrete(gestures.fist, '✊ Puño — voltear', now)) {
              state.fistDone = true;
            }
          } else {
            label('✊ Mantén el puño…');
          }
        }
        return;
      }
      state.fistSince = null;
      if (open > SWIPE_OPEN_MIN) state.fistDone = false;

      // ✋ Swipe: solo con la mano abierta, para evitar falsos disparos
      if (open < SWIPE_OPEN_MIN) {
        state.trail = [];
        if (cooldownReady(now)) label('✋ Mano detectada');
        return;
      }

      const wrist = lm[0];
      state.trail.push({ x: wrist.x, t: now });
      state.trail = state.trail.filter((p) => now - p.t < SWIPE_WINDOW_MS);
      const dx = wrist.x - state.trail[0].x;
      const span = now - state.trail[0].t;

      // Tras un gesto, la mano debe quedarse quieta un momento: así un
      // movimiento continuo (o el vaivén de ida y vuelta) no encadena
      // varios avances seguidos. La quietud se mide con la dispersión de
      // TODO el recorrido reciente, no solo sus extremos.
      if (!state.armed) {
        const xs = state.trail.map((p) => p.x);
        const spread = Math.max(...xs) - Math.min(...xs);
        if (span >= STILL_MS && spread < STILL_DX) {
          state.armed = true;
          label('✋ Lista para el siguiente gesto');
        } else if (cooldownReady(now)) {
          label('✋ Detén la mano un momento…');
        }
        return;
      }

      if (Math.abs(dx) > SWIPE_MIN_DX && cooldownReady(now)) {
        // La cámara ve en espejo: si la persona mueve la mano hacia SU
        // izquierda, en la imagen la x aumenta.
        if (dx > 0) {
          discrete(gestures.handLeft, '✋ Movimiento a la izquierda', now);
        } else {
          discrete(gestures.handRight, '✋ Movimiento a la derecha', now);
        }
      } else if (cooldownReady(now)) {
        label('✋ Mano detectada');
      }
      return;
    }

    // Sin manos a la vista: reiniciar el estado de los gestos
    state.trail = [];
    state.armed = true;
    state.fistSince = null;
    state.fistDone = false;
    if (cooldownReady(now)) label('Buscando manos…');
  }

  // --- Dibuja la vista previa en espejo con los puntos de las manos ---
  function draw(results) {
    const { canvas, ctx } = el;
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    if (results.image) ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4ade80';
    for (const lm of results.multiHandLandmarks || []) {
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Conexión con la interfaz ---
  function init() {
    el.panel = document.getElementById('camera-panel');
    el.video = document.getElementById('camera-video');
    el.canvas = document.getElementById('camera-canvas');
    el.ctx = el.canvas.getContext('2d');
    el.label = document.getElementById('gesture-label');
    el.button = document.getElementById('btn-camera');

    el.button.addEventListener('click', toggle);
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      if (e.key === 'c' || e.key === 'C') toggle();
    });

    // ?camera=1 en la URL enciende los gestos al cargar (útil en la feria)
    if (new URLSearchParams(location.search).get('camera') === '1') start();
  }

  document.addEventListener('DOMContentLoaded', init);

  // `simulate` inyecta resultados sintéticos — solo para pruebas
  return { start, stop, toggle, run, simulate: onResults };
})();
