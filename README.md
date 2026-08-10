# image-changer

Visor de diapositivas controlado por **gestos, mouse y botones**.
Proyecto de la **Feria STEAM del Liceo de Cervantes — sección informática**.

## Qué hace

- 🖼 Muestra diapositivas (de demostración, tus propias imágenes, archivos de
  PowerPoint o presentaciones de Canva por enlace).
- ⛶ Modo pantalla completa para presentar.
- 🔄 Voltea la pantalla 180° (de arriba abajo y viceversa).
- 🔍 Zoom progresivo (botones, rueda del mouse o, en la Fase 2, abriendo las manos).
- ▶ Modo automático: restablece la vista y avanza solo.
- 🎨 Dos estéticas a elegir: **Windows 98** o **moderna**, ambas con **modo oscuro**.
- 📷 Control por gestos con la cámara (MediaPipe Hands): navegar con una mano,
  zoom progresivo abriendo las dos manos y restablecer cerrándolas.

## Requisitos

- Un navegador moderno: **Chrome** o **Edge** (recomendados), en Windows,
  Android, macOS o Linux.
- Una **webcam** para el control por gestos (opcional: todo funciona también
  con mouse, botones y teclado).
- Internet solo la primera vez (para descargar el modelo de gestos y el motor
  de PowerPoint); después la app funciona sin conexión.

## Cómo ejecutarla en local

La app es una PWA: necesita servirse por HTTP — no abras `index.html`
directamente como archivo, porque el navegador bloquea el service worker
y la cámara.

Con Python instalado:

```
git clone https://github.com/auberthh/image-changer.git
cd image-changer
python -m http.server 8080
```

O con Node.js: `npx serve .`

Luego abre `http://localhost:8080` en Chrome o Edge.

> Para usarla desde **otro dispositivo** (por ejemplo el celular), el
> navegador exige **HTTPS** para la cámara y la instalación. Lo más sencillo
> es publicarla en GitHub Pages (gratis, con HTTPS incluido).

## Cómo instalarla como aplicación

### En Windows (Chrome o Edge)

1. Abre la app en el navegador (local o publicada).
2. Haz clic en el icono **Instalar** (⊕ o un monitor con flecha) que aparece
   a la derecha de la barra de direcciones — o menú ⋯ → *Aplicaciones* →
   *Instalar image-changer*.
3. La app se abre en su propia ventana y queda en el menú Inicio como
   cualquier programa. Se desinstala desde la propia ventana (menú ⋯).

### En Android (Chrome)

1. Abre la dirección de la app publicada (HTTPS).
2. Menú ⋮ → **Añadir a pantalla de inicio** (o el aviso "Instalar app").
3. El icono queda en la pantalla de inicio y se abre a pantalla completa.

### Permiso de cámara

La primera vez que pulses **📷 Gestos** el navegador pedirá permiso para usar
la cámara. Concédelo; puedes revocarlo cuando quieras desde el icono de
candado en la barra de direcciones.

## Controles

| Acción | Botón | Mouse | Teclado |
|---|---|---|---|
| Siguiente diapositiva | Siguiente ▶ | clic borde derecho | → / AvPág |
| Diapositiva anterior | ◀ Anterior | clic borde izquierdo | ← / RePág |
| Voltear pantalla | 🔄 Voltear | — | F |
| Zoom | ➕ / ➖ | rueda del mouse | + / − |
| Restablecer vista | ↺ Restablecer | — | R |
| Modo automático | ▶ Automático | — | A |
| Cargar imágenes | 🖼 Cargar imágenes | arrastrar y soltar | — |
| Cargar presentación | 🔗 Presentación | — | — |
| Pantalla completa | ⛶ Pantalla completa | — | P (salir: Esc) |
| Cámara (gestos) | 📷 Gestos | — | C |

## Presentaciones de PowerPoint y Canva

¿Qué formato conviene? Guía rápida de fidelidad:

| Formato | ¿Se ve igual al original? | ¿Gestos y botones? |
|---|---|---|
| **PDF** (⭐ recomendado) | Sí, copia fiel — las fuentes viajan dentro | ✅ |
| Imágenes exportadas (PNG/JPG) | Sí, copia fiel | ✅ |
| Archivo .pptx | Aproximada: sin las fuentes originales puede variar | ✅ |
| Enlace incrustado (Canva/OneDrive) | Sí, lo dibuja el servicio original | ❌ (sus controles) |

**El camino recomendado**: exporta a PDF — en PowerPoint *Archivo →
Guardar como → PDF*, en Canva *Compartir → Descargar → PDF estándar* —
y carga ese archivo. Cada página se convierte en una diapositiva idéntica
al original, controlable con gestos.

Botón **🔗 Presentación**, con dos opciones:

- **Enlace**: pega un enlace de **Canva** (Compartir → «Cualquiera con el
  enlace puede ver»), de **PowerPoint en OneDrive**, una URL directa a un
  `.pptx` público, o de **Google Slides**. La app lo convierte a su versión
  incrustable y lo muestra a pantalla completa del escenario.
  *Limitación: las presentaciones incrustadas se navegan con sus propios
  controles; los gestos y botones de la app no pueden entrar en el iframe
  (es una barrera de seguridad del navegador entre dominios).
  💡 Para controlar un diseño de Canva con gestos: descárgalo como .pptx
  (Compartir → Descargar → Microsoft PowerPoint) y cárgalo como archivo.*
- **Archivo .pdf o .pptx** (también arrastrando y soltando): se renderiza
  dentro de la app (PDF con `pdf.js`, pptx con `pptx-preview`), así cada
  diapositiva se convierte en una diapositiva de image-changer y **los
  gestos, botones y teclado sí la controlan**. Requiere internet la primera
  vez para descargar el motor de renderizado.

## Gestos con la cámara

Pulsa **📷 Gestos** y acepta el permiso de cámara. La primera vez descarga el
modelo de MediaPipe Hands (necesita internet); después queda en caché.

| Gesto | Acción (configurable en ⚙) |
|---|---|
| ✋ Mover una mano a la izquierda | Siguiente diapositiva |
| ✋ Mover una mano a la derecha | Diapositiva anterior |
| ✊ Mantener el puño cerrado (una mano, ~1 s) | Voltear pantalla 180° |
| 🙌 Dos manos abiertas, separándolas o juntándolas | Zoom progresivo |
| ✊✊ Mantener los dos puños cerrados (~1 s) | Restablecer vista + modo automático |

Para evitar avances accidentales, después de cada gesto la mano debe
**detenerse un instante** antes de que se acepte el siguiente movimiento,
y hay una pausa de 1,5 s entre gestos.

Consejos: colócate a 0,5–1,5 m de la cámara, con buena luz y las manos dentro
del recuadro de vista previa. El recuadro muestra en verde los puntos que el
modelo detecta en cada mano.

## Estructura

```
image-changer/
├── index.html           → interfaz principal
├── css/
│   ├── base.css         → estructura común
│   ├── theme-98.css     → tema Windows 98 (con variante nocturna)
│   └── theme-modern.css → tema moderno (claro y oscuro)
├── js/
│   ├── settings.js      → tema, modo oscuro y mapa de gestos
│   ├── viewer.js        → diapositivas, volteo, zoom, pantalla completa
│   ├── gestures.js      → gestos con cámara (MediaPipe Hands)
│   └── presentations.js → PowerPoint (.pptx / OneDrive) y Canva por enlace
├── manifest.json        → instalación como app (PWA)
├── sw.js                → funcionamiento sin internet
└── icons/icon.svg       → icono de la app
```

## Tecnologías

- HTML, CSS y JavaScript puros (sin frameworks) — PWA instalable.
- [MediaPipe Hands](https://developers.google.com/mediapipe) (Google) para la
  detección de manos con la cámara.
- [pptx-preview](https://www.npmjs.com/package/pptx-preview) para renderizar
  archivos de PowerPoint en el navegador.

---

Proyecto de la **Feria STEAM del Liceo de Cervantes**, sección informática.
