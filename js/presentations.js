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
  const PDF_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
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
    open();   // que el progreso y los errores se vean también al arrastrar
    try {
      const buffer = await file.arrayBuffer();

      // Un .pptx real es un zip y empieza con "PK". Un .ppt antiguo
      // (PowerPoint 97-2003) o un archivo dañado no lo es.
      const head = new Uint8Array(buffer.slice(0, 2));
      if (head[0] !== 0x50 || head[1] !== 0x4B) {
        status('⚠ Este archivo no es un .pptx válido (¿es un .ppt antiguo?). ' +
          'Ábrelo en PowerPoint y usa Guardar como → PDF, y carga ese PDF aquí.');
        return;
      }

      status('Descargando el motor de PowerPoint…');
      if (!window.pptxPreview) {
        try {
          await loadScript(PPTX_CDN);
        } catch {
          status('⚠ No se pudo descargar el motor de PowerPoint. Revisa la ' +
            'conexión a internet (solo se necesita la primera vez).');
          return;
        }
      }

      status(`Procesando «${file.name}»…`);
      const stage = document.getElementById('stage');
      const width = Math.max(480, stage.clientWidth - 16);
      const height = Math.max(360, stage.clientHeight - 16);

      // Renderizar en un contenedor fuera de pantalla
      const temp = document.createElement('div');
      temp.style.cssText = 'position:fixed;left:-10000px;top:0;';
      document.body.appendChild(temp);

      const previewer = pptxPreview.init(temp, { width, height });
      await previewer.preview(buffer);

      const slides = Array.from(temp.querySelectorAll('.pptx-preview-slide-wrapper'));
      if (!slides.length) throw new Error('el archivo no contiene diapositivas legibles');

      Viewer.loadRenderedSlides(slides);
      temp.remove();
      status('');
      close();
    } catch (err) {
      console.error('Presentaciones:', err);
      status('⚠ No se pudo abrir el archivo. ' +
        'Exporta la presentación a PDF y carga ese PDF aquí (copia fiel).');
    }
  }

  // --- Archivo PDF: fidelidad perfecta (las fuentes viajan dentro) ---
  // Cada página se renderiza con pdf.js a una imagen que se convierte en
  // una diapositiva de la app, controlable con gestos, botones y teclado.
  async function loadPdfFile(file) {
    open();   // que el progreso y los errores se vean también al arrastrar
    try {
      status('Descargando el motor de PDF…');
      if (!window.pdfjsLib) {
        try {
          await loadScript(PDF_CDN);
        } catch {
          status('⚠ No se pudo descargar el motor de PDF. Revisa la conexión ' +
            'a internet (solo se necesita la primera vez).');
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      }

      status(`Procesando «${file.name}»…`);
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;

      // Nitidez: se renderiza a ~1,5× la altura del escenario (con tope,
      // para que un PDF largo no agote la memoria)
      const stage = document.getElementById('stage');
      const targetHeight = Math.min(1600, Math.max(720, stage.clientHeight * 1.5));

      const nodes = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        status(`Renderizando diapositiva ${p} de ${pdf.numPages}…`);
        const page = await pdf.getPage(p);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: targetHeight / base.height });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        // Imagen comprimida en lugar del canvas: mucha menos memoria
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        const img = document.createElement('img');
        img.src = URL.createObjectURL(blob);
        img.alt = `Diapositiva ${p}`;
        nodes.push(img);
      }

      Viewer.loadRenderedSlides(nodes);
      status('');
      close();
    } catch (err) {
      console.error('Presentaciones:', err);
      status('⚠ No se pudo abrir el PDF. ¿Está completo y sin contraseña?');
    }
  }

  function loadFile(file) {
    if (/\.pdf$/i.test(file.name)) return loadPdfFile(file);
    return loadPptxFile(file);
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
      if (el.file.files[0]) loadFile(el.file.files[0]);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { normalizeUrl, loadFromUrl, loadFile, loadPptxFile, loadPdfFile };
})();
