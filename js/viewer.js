/* ============================================================
   viewer.js — el corazón de image-changer:
   diapositivas, volteo de pantalla, zoom y modo automático.
   Controlable con botones, mouse, teclado y (Fase 2) gestos.
   ============================================================ */

const Viewer = (() => {
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.15;

  const container = document.getElementById('slide-container');

  const state = {
    index: 0,
    zoom: 1,
    flipped: false,   // false = normal, true = girada 180°
    auto: false,
    autoTimer: null,
    embedMode: false, // presentación incrustada (iframe de otro dominio)
  };

  const slides = () => Array.from(container.querySelectorAll('.slide'));

  // --- Transformación: volteo + zoom en una sola operación ---
  function applyTransform() {
    const angle = state.flipped ? 180 : 0;
    container.style.transform = `rotate(${angle}deg) scale(${state.zoom})`;
    updateStatus();
  }

  function updateStatus() {
    const all = slides();
    document.getElementById('status-slide').textContent = state.embedMode
      ? 'Presentación incrustada — usa sus propios controles'
      : `Diapositiva ${state.index + 1} / ${all.length}`;
    document.getElementById('status-zoom').textContent =
      `Zoom: ${Math.round(state.zoom * 100)}%`;
    document.getElementById('status-flip').textContent =
      `Orientación: ${state.flipped ? 'volteada 180°' : 'normal'}`;
    document.getElementById('status-mode').textContent =
      `Modo: ${state.auto ? 'automático' : 'manual'}`;
  }

  // --- Navegación ---
  function show(index) {
    const all = slides();
    if (!all.length) return;
    state.index = (index + all.length) % all.length;
    all.forEach((s, i) => s.classList.toggle('active', i === state.index));
    updateStatus();
  }

  function next() { show(state.index + 1); }
  function prev() { show(state.index - 1); }

  // --- Volteo de pantalla ---
  function flip() {
    state.flipped = !state.flipped;
    applyTransform();
  }

  // --- Zoom progresivo ---
  function zoomIn(step = ZOOM_STEP)  { setZoom(state.zoom + step); }
  function zoomOut(step = ZOOM_STEP) { setZoom(state.zoom - step); }

  function setZoom(value) {
    state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    applyTransform();
  }

  // --- Restablecer vista ---
  function reset() {
    state.zoom = 1;
    state.flipped = false;
    applyTransform();
  }

  // --- Modo automático (restablece la vista y avanza solo) ---
  function startAuto() {
    stopAuto();
    reset();
    state.auto = true;
    state.autoTimer = setInterval(next, Settings.get().autoInterval);
    document.getElementById('btn-auto').classList.add('pressed');
    document.getElementById('btn-auto').textContent = '⏸ Automático';
    updateStatus();
  }

  function stopAuto() {
    clearInterval(state.autoTimer);
    state.auto = false;
    document.getElementById('btn-auto').classList.remove('pressed');
    document.getElementById('btn-auto').textContent = '▶ Automático';
    updateStatus();
  }

  function toggleAuto() { state.auto ? stopAuto() : startAuto(); }

  // --- Pantalla completa (modo presentación) ---
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById('stage').requestFullscreen();
    }
  }

  // Con un embed las zonas laterales estorban (tapan el iframe y no hay
  // más diapositivas que pasar): se ocultan mientras dure.
  function setEmbedMode(on) {
    state.embedMode = on;
    document.getElementById('stage').classList.toggle('embed-mode', on);
  }

  // --- Cargar imágenes del usuario ---
  function loadImages(files) {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setEmbedMode(false);
    container.innerHTML = '';
    images.forEach((file, i) => {
      const section = document.createElement('section');
      section.className = 'slide';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      section.appendChild(img);
      container.appendChild(section);
    });
    show(0);
  }

  // --- Presentación incrustada por enlace (Canva, Office, Google Slides) ---
  function loadEmbed(url) {
    setEmbedMode(true);
    container.innerHTML = '';
    const section = document.createElement('section');
    section.className = 'slide slide-embed';
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = 'fullscreen';
    iframe.setAttribute('allowfullscreen', '');
    section.appendChild(iframe);
    container.appendChild(section);
    show(0);
  }

  // --- Diapositivas ya renderizadas (archivo .pptx) ---
  function loadRenderedSlides(nodes) {
    setEmbedMode(false);
    container.innerHTML = '';
    nodes.forEach((node) => {
      const section = document.createElement('section');
      section.className = 'slide slide-pptx';
      section.appendChild(node);
      container.appendChild(section);
    });
    show(0);
  }

  // --- Controles: botones, mouse y teclado ---
  function init() {
    show(0);
    applyTransform();

    // Botones de la barra
    document.getElementById('btn-prev').addEventListener('click', prev);
    document.getElementById('btn-next').addEventListener('click', next);
    document.getElementById('btn-flip').addEventListener('click', flip);
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoomOut());
    document.getElementById('btn-reset').addEventListener('click', reset);
    document.getElementById('btn-auto').addEventListener('click', toggleAuto);

    // Pantalla completa
    const btnFullscreen = document.getElementById('btn-fullscreen');
    btnFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      btnFullscreen.classList.toggle('pressed', !!document.fullscreenElement);
    });

    // Zonas de clic en los bordes del escenario
    document.getElementById('zone-prev').addEventListener('click', prev);
    document.getElementById('zone-next').addEventListener('click', next);

    // Rueda del mouse sobre el escenario = zoom progresivo
    document.getElementById('stage').addEventListener('wheel', (e) => {
      e.preventDefault();
      e.deltaY < 0 ? zoomIn(0.08) : zoomOut(0.08);
    }, { passive: false });

    // Teclado
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown': next(); break;
        case 'ArrowLeft':
        case 'PageUp': prev(); break;
        case '+':
        case '=': zoomIn(); break;
        case '-': zoomOut(); break;
        case 'f':
        case 'F': flip(); break;
        case 'r':
        case 'R': reset(); break;
        case 'a':
        case 'A': toggleAuto(); break;
        case 'p':
        case 'P': toggleFullscreen(); break;
      }
    });

    // Cargar imágenes propias
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-load').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => loadImages(fileInput.files));

    // También por arrastrar y soltar
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      loadImages(e.dataTransfer.files);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // API pública — la usan gestures.js (cámara) y presentations.js
  return {
    next, prev, flip, zoomIn, zoomOut, setZoom, reset,
    startAuto, stopAuto, toggleAuto, toggleFullscreen,
    loadEmbed, loadRenderedSlides,
    getZoom: () => state.zoom,
  };
})();
