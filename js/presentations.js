/* ============================================================
   presentations.js — carga de presentaciones externas:

   · Enlaces: Canva, PowerPoint (OneDrive o URL directa a .pptx,
     mediante el visor de Office Online) y Google Slides.
     Se incrustan en un iframe y se navegan con sus controles.

   · Archivos .pptx locales: se renderizan dentro de la app con
     pptx-preview, así los gestos, botones y teclado controlan
     las diapositivas igual que con las imágenes.
   ============================================================ */

const Presentations = (() => {
  const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptx-preview@1.0.7/dist/pptx-preview.umd.js';
  const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src=';

  const el = {};

  // --- Convierte un enlace "para compartir" en su versión incrustable ---
  function normalizeUrl(raw) {
    let url;
    try { url = new URL(raw.trim()); } catch { return null; }

    // Canva: .../design/<id>/<token>/view?embed
    if (url.hostname.endsWith('canva.com') && url.pathname.includes('/design/')) {
      const path = url.pathname.replace(/\/(edit|view|watch)\/?$/, '');
      return `https://www.canva.com${path}/view?embed`;
    }

    // Google Slides: /edit → /embed
    if (url.hostname === 'docs.google.com' && url.pathname.includes('/presentation/')) {
      return url.href.replace(/\/(edit|view|preview|pub).*$/, '/embed');
    }

    // OneDrive compartido: enlace directo de descarga + visor de Office
    if (url.hostname === '1drv.ms' || url.hostname.endsWith('onedrive.live.com')) {
      const encoded = btoa(url.href).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
      const direct = `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`;
      return OFFICE_VIEWER + encodeURIComponent(direct);
    }

    // URL directa a un archivo de PowerPoint → visor de Office
    if (/\.(pptx?|ppsx?)($|[?#])/i.test(url.href)) {
      return OFFICE_VIEWER + encodeURIComponent(url.href);
    }

    // Cualquier otro enlace: incrustarlo tal cual
    return url.href;
  }

  function loadFromUrl(raw) {
    const url = normalizeUrl(raw);
    if (!url) {
      status('⚠ El enlace no es válido. Copia la URL completa (https://…).');
      return;
    }
    Viewer.loadEmbed(url);
    status('');
    close();
  }

  // --- Archivo .pptx local, renderizado con pptx-preview ---
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadPptxFile(file) {
    try {
      status('Cargando el motor de PowerPoint…');
      if (!window.pptxPreview) await loadScript(PPTX_CDN);

      status(`Procesando «${file.name}»…`);
      const stage = document.getElementById('stage');
      const width = Math.max(480, stage.clientWidth - 16);
      const height = Math.max(360, stage.clientHeight - 16);

      // Renderizar en un contenedor fuera de pantalla
      const temp = document.createElement('div');
      temp.style.cssText = 'position:fixed;left:-10000px;top:0;';
      document.body.appendChild(temp);

      const previewer = pptxPreview.init(temp, { width, height });
      await previewer.preview(await file.arrayBuffer());

      const slides = Array.from(temp.querySelectorAll('.pptx-preview-slide-wrapper'));
      if (!slides.length) throw new Error('el archivo no contiene diapositivas legibles');

      Viewer.loadRenderedSlides(slides);
      temp.remove();
      status('');
      close();
    } catch (err) {
      console.error('Presentaciones:', err);
      status(`⚠ No se pudo abrir el archivo (${err.message}). ` +
        'También puedes exportarlo como imágenes desde PowerPoint y usar 🖼 Cargar imágenes.');
    }
  }

  // --- Diálogo ---
  function status(text) { el.status.textContent = text; }
  function open() { el.overlay.classList.remove('hidden'); el.url.focus(); }
  function close() { el.overlay.classList.add('hidden'); }

  function init() {
    el.overlay = document.getElementById('presentation-overlay');
    el.url = document.getElementById('pres-url');
    el.file = document.getElementById('pres-file');
    el.status = document.getElementById('pres-status');

    document.getElementById('btn-presentation').addEventListener('click', open);
    document.getElementById('btn-pres-close').addEventListener('click', close);
    el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) close(); });

    document.getElementById('btn-pres-url').addEventListener('click', () => loadFromUrl(el.url.value));
    el.url.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadFromUrl(el.url.value);
    });

    document.getElementById('btn-pres-file').addEventListener('click', () => el.file.click());
    el.file.addEventListener('change', () => {
      if (el.file.files[0]) loadPptxFile(el.file.files[0]);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { normalizeUrl, loadFromUrl, loadPptxFile };
})();
