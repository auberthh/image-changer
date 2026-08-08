/* ============================================================
   settings.js — configuración: tema, modo oscuro, intervalos
   y mapa de gestos. Todo se guarda en localStorage.
   ============================================================ */

const Settings = (() => {
  const KEY = 'image-changer-settings';

  const defaults = {
    theme: 'theme-98',
    dark: false,
    autoInterval: 4000,
    gestures: {
      handLeft: 'next',
      handRight: 'prev',
      fist: 'flip',
      handsOpen: 'zoom',
      handsClose: 'reset',
    },
  };

  let current = load();

  function load() {
    let loaded;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      loaded = { ...defaults, ...saved, gestures: { ...defaults.gestures, ...(saved && saved.gestures) } };
    } catch {
      loaded = { ...defaults };
    }
    // La URL puede forzar el tema, p. ej. ?theme=theme-modern&dark=1
    const params = new URLSearchParams(location.search);
    const theme = params.get('theme');
    if (theme === 'theme-98' || theme === 'theme-modern') loaded.theme = theme;
    if (params.has('dark')) loaded.dark = params.get('dark') !== '0';
    return loaded;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(current));
  }

  function applyTheme() {
    document.body.classList.remove('theme-98', 'theme-modern', 'dark');
    document.body.classList.add(current.theme);
    if (current.dark) document.body.classList.add('dark');
  }

  function get() { return current; }

  function set(patch) {
    current = { ...current, ...patch, gestures: { ...current.gestures, ...(patch.gestures || {}) } };
    save();
    applyTheme();
  }

  // --- Conexión con el panel de configuración ---
  function initPanel() {
    const overlay = document.getElementById('settings-overlay');
    const open = () => overlay.classList.remove('hidden');
    const close = () => overlay.classList.add('hidden');

    document.getElementById('btn-settings-top').addEventListener('click', open);
    document.getElementById('btn-settings-close').addEventListener('click', close);
    document.getElementById('btn-settings-ok').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Tema
    document.querySelectorAll('input[name="theme"]').forEach((radio) => {
      radio.checked = radio.value === current.theme;
      radio.addEventListener('change', () => set({ theme: radio.value }));
    });

    // Modo oscuro
    const dark = document.getElementById('opt-dark');
    dark.checked = current.dark;
    dark.addEventListener('change', () => set({ dark: dark.checked }));

    // Intervalo del modo automático
    const interval = document.getElementById('opt-interval');
    interval.value = String(current.autoInterval);
    interval.addEventListener('change', () => set({ autoInterval: Number(interval.value) }));

    // Mapa de gestos (lo usará gestures.js en la Fase 2)
    const bind = (id, key) => {
      const sel = document.getElementById(id);
      sel.value = current.gestures[key];
      sel.addEventListener('change', () => set({ gestures: { [key]: sel.value } }));
    };
    bind('opt-gesture-left', 'handLeft');
    bind('opt-gesture-right', 'handRight');
    bind('opt-gesture-fist', 'fist');
    bind('opt-gesture-open', 'handsOpen');
    bind('opt-gesture-close', 'handsClose');
  }

  applyTheme();
  document.addEventListener('DOMContentLoaded', initPanel);

  return { get, set };
})();
