/* ============================================================================
   LUX · Comparativa Luminarias 2021 vs 2026
   ============================================================================ */

const APP = window.LUX_CONFIG;

let datos2021 = { type: 'FeatureCollection', features: [] };
let datos2026 = { type: 'FeatureCollection', features: [] };
let map2021, map2026;
let estiloActual = 'satellite';
let sincronizando = false;

const $ = id => document.getElementById(id);

const fmtNum = (n, dec = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/* ── Diagnóstico ──────────────────────────────────────────────────── */
function setDiag(msg, tipo = 'error') {
  const el = $('diagnostico');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = tipo === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(22,163,74,0.92)';
  if (tipo === 'info') setTimeout(() => el.classList.add('hidden'), 3500);
  console.log(`[LUX/${tipo}]`, msg);
}

/* ── Helpers de datos ─────────────────────────────────────────────── */
function getCampo(props, campos, def = null) {
  if (!props || !Array.isArray(campos)) return def;
  for (const c of campos) {
    const v = props[c];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return def;
}

function clasificarTecnologia(valor) {
  const v = String(valor || '').toUpperCase();
  if (v.includes('LED')) return 'LED';
  if (v.includes('SAP') || v.includes('SODIO')) return 'SODIO';
  return 'OTROS';
}

/* ── Expresión de color ───────────────────────────────────────────── */
function colorExpression(anio) {
  const campos = APP.campos[anio].tecnologia;
  const S = APP.simbologia;
  const getTec = ['upcase', ['to-string',
    ['coalesce', ...campos.map(c => ['get', c]), '']
  ]];

  return [
    'case',
    ['in', 'LED', getTec], S.LED,
    ['any', ['in', 'SAP', getTec], ['in', 'SODIO', getTec]], S.SODIO,
    S.OTROS
  ];
}

/* ── Inicialización de mapas ──────────────────────────────────────── */
function initMapas() {
  if (typeof maplibregl === 'undefined') {
    setDiag('MapLibre GL no cargó.');
    return;
  }

  const estilo = APP.estilosMapa[estiloActual];
  const centro = APP.municipio.mapaInicial.center;
  const zoom = APP.municipio.mapaInicial.zoom;

  const navOpts = {
    dragPan: true,
    scrollZoom: { around: 'center' },
    boxZoom: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
    touchPitch: true,
    keyboard: true,
    dragRotate: true,
    pitchWithRotate: true
  };

  map2026 = new maplibregl.Map({
    container: 'map-2026',
    style: estilo,
    center: centro,
    zoom: zoom,
    minZoom: 10,
    maxZoom: 20,
    preserveDrawingBuffer: true,
    interactive: true,
    ...navOpts
  });

  map2021 = new maplibregl.Map({
    container: 'map-2021',
    style: estilo,
    center: centro,
    zoom: zoom,
    minZoom: 10,
    maxZoom: 20,
    preserveDrawingBuffer: true,
    interactive: false
  });

  map2026.on('move', () => {
    if (sincronizando) return;
    sincronizando = true;
    map2021.jumpTo({
      center: map2026.getCenter(),
      zoom: map2026.getZoom(),
      bearing: map2026.getBearing(),
      pitch: map2026.getPitch()
    });
    sincronizando = false;
  });

  map2026.getCanvas().style.cursor = 'grab';
  map2026.on('mousedown', () => { map2026.getCanvas().style.cursor = 'grabbing'; });
  map2026.on('mouseup',   () => { map2026.getCanvas().style.cursor = 'grab'; });

  let cargados = 0;
  const onLoad = () => {
    cargados++;
    if (cargados === 2) {
      setDiag('Descargando datos…', 'info');
      cargarDatos();
    }
  };
  map2021.on('load', onLoad);
  map2026.on('load', onLoad);
}

/* ── Carga de datos y capas ───────────────────────────────────────── */
async function cargarDatos() {
  try {
    const [r1, r2] = await Promise.all([
      fetch(APP.fuentes.luminarias_2021, { cache: 'no-store' }),
      fetch(APP.fuentes.luminarias_2026, { cache: 'no-store' })
    ]);
    if (!r1.ok) throw new Error(`2021: HTTP ${r1.status}`);
    if (!r2.ok) throw new Error(`2026: HTTP ${r2.status}`);

    datos2021 = await r1.json();
    datos2026 = await r2.json();

    const n1 = datos2021.features?.length || 0;
    const n2 = datos2026.features?.length || 0;
    setDiag(`2021: ${fmtNum(n1)} · 2026: ${fmtNum(n2)} luminarias`, 'info');

    map2021.addSource('lum-2021', { type: 'geojson', data: datos2021 });
    map2021.addLayer({
      id: 'lum-2021-layer',
      type: 'circle',
      source: 'lum-2021',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 3.5, 17, 7],
        'circle-color': colorExpression(2021),
        'circle-opacity': 0.9,
        'circle-stroke-width': 0.4,
        'circle-stroke-color': 'rgba(0,0,0,0.5)'
      }
    });

    map2026.addSource('lum-2026', { type: 'geojson', data: datos2026 });
    map2026.addLayer({
      id: 'lum-2026-layer',
      type: 'circle',
      source: 'lum-2026',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 3.5, 17, 7],
        'circle-color': colorExpression(2026),
        'circle-opacity': 0.9,
        'circle-stroke-width': 0.4,
        'circle-stroke-color': 'rgba(0,0,0,0.5)'
      }
    });

    initSwipe();
    calcularKPIs();

  } catch (err) {
    console.error(err);
    setDiag('Error: ' + err.message);
  }
}

/* ── Swipe nativo ────────────────────────────────────────────────── */
function initSwipe() {
  const container = $('comparison-container');
  const divider = $('swipe-divider');
  const pane2021 = $('map-2021');
  const hint = $('swipe-hint');

  let pct = 50;
  let arrastrando = false;
  let orientacion = 'v';

  const esPortrait = () => window.matchMedia('(orientation: portrait)').matches;

  const aplicarOrientacion = () => {
    orientacion = esPortrait() ? 'h' : 'v';
    container.classList.toggle('orientation-h', orientacion === 'h');
    container.classList.toggle('orientation-v', orientacion === 'v');
    aplicar();
  };

  const aplicar = () => {
    pct = Math.max(0, Math.min(100, pct));

    if (orientacion === 'h') {
      pane2021.style.clipPath = `inset(0 0 ${100 - pct}% 0)`;
      divider.style.top = pct + '%';
      divider.style.left = '';
    } else {
      pane2021.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      divider.style.left = pct + '%';
      divider.style.top = '';
    }
    divider.setAttribute('aria-valuenow', Math.round(pct));
  };

  const desdeEvento = (e) => {
    const rect = container.getBoundingClientRect();
    if (orientacion === 'h') {
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      pct = ((y - rect.top) / rect.height) * 100;
    } else {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      pct = ((x - rect.left) / rect.width) * 100;
    }
    aplicar();
  };

  const ocultarHint = () => {
    if (hint && !hint.classList.contains('fade-out')) {
      hint.classList.add('fade-out');
    }
  };

  const onDown = (e) => {
    arrastrando = true;
    ocultarHint();
    desdeEvento(e);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!arrastrando) return;
    desdeEvento(e);
    e.preventDefault();
  };
  const onUp = () => { arrastrando = false; };

  divider.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  divider.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);

  divider.addEventListener('keydown', (e) => {
    const step = 2;
    if (orientacion === 'v') {
      if (e.key === 'ArrowLeft')  { ocultarHint(); pct -= step; aplicar(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { ocultarHint(); pct += step; aplicar(); e.preventDefault(); }
    } else {
      if (e.key === 'ArrowUp')    { ocultarHint(); pct -= step; aplicar(); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { ocultarHint(); pct += step; aplicar(); e.preventDefault(); }
    }
    if (e.key === 'Home') { ocultarHint(); pct = 0;   aplicar(); e.preventDefault(); }
    if (e.key === 'End')  { ocultarHint(); pct = 100; aplicar(); e.preventDefault(); }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ocultarHint();
  });

  window.addEventListener('resize', aplicarOrientacion);
  window.addEventListener('orientationchange', () => {
    setTimeout(aplicarOrientacion, 100);
  });

  aplicarOrientacion();
  console.log(`[LUX] Swipe adaptativo listo. Orientación: ${orientacion}`);
}

/* ── Análisis y KPIs ─────────────────────────────────────────────── */
function analizar(features, anio) {
  let led = 0, sodio = 0, otros = 0, watts = 0, sinPot = 0;
  const campoTec = APP.campos[anio].tecnologia;
  const campoPot = APP.campos[anio].potencia;

  for (const f of features) {
    const p = f.properties || {};
    const cat = clasificarTecnologia(getCampo(p, campoTec, ''));
    if (cat === 'LED') led++;
    else if (cat === 'SODIO') sodio++;
    else otros++;

    const potRaw = getCampo(p, campoPot, null);
    if (potRaw !== null) {
      const pot = parseFloat(String(potRaw).replace(',', '.'));
      if (!isNaN(pot) && pot > 0) watts += pot;
      else sinPot++;
    } else sinPot++;
  }
  return { total: features.length, led, sodio, otros, watts, kw: watts / 1000, sinPot };
}

function calcularKPIs() {
  const a21 = analizar(datos2021.features || [], 2021);
  const a26 = analizar(datos2026.features || [], 2026);
  const cfg = APP.consumo;

  const pct = (p, t) => t ? ((p / t) * 100).toFixed(1) + '%' : '0%';

  // ── 2021 ──
  $('kpi-total-2021').innerText = fmtNum(a21.total);
  $('kpi-led-2021').innerText   = `${fmtNum(a21.led)} (${pct(a21.led, a21.total)})`;
  $('kpi-sodio-2021').innerText = `${fmtNum(a21.sodio)} (${pct(a21.sodio, a21.total)})`;
  $('kpi-otros-2021').innerText = `${fmtNum(a21.otros)} (${pct(a21.otros, a21.total)})`;
  $('potencia-2021').innerText  = fmtNum(a21.kw, 1) + ' kW';

  // ── 2026 ──
  $('kpi-total-2026').innerText = fmtNum(a26.total);
  $('kpi-led-2026').innerText   = `${fmtNum(a26.led)} (${pct(a26.led, a26.total)})`;
  $('kpi-sodio-2026').innerText = `${fmtNum(a26.sodio)} (${pct(a26.sodio, a26.total)})`;
  $('kpi-otros-2026').innerText = `${fmtNum(a26.otros)} (${pct(a26.otros, a26.total)})`;
  $('potencia-2026').innerText  = fmtNum(a26.kw, 1) + ' kW';

  // ── Consumo mensual ──
  const kwh21 = a21.kw * cfg.horasDiarias * cfg.diasMes;
  const kwh26 = a26.kw * cfg.horasDiarias * cfg.diasMes;
  $('kwh-2021').innerText = fmtNum(kwh21, 0) + ' kWh';
  $('kwh-2026').innerText = fmtNum(kwh26, 0) + ' kWh';

  // ── Barras proporcionales ──
  const pintarBarra = (prefijo, data) => {
    const t = data.total || 1;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = v + '%'; };
    set(`bar-led-${prefijo}`,   (data.led   / t) * 100);
    set(`bar-sodio-${prefijo}`, (data.sodio / t) * 100);
    set(`bar-otros-${prefijo}`, (data.otros / t) * 100);
  };
  pintarBarra('2021', a21);
  pintarBarra('2026', a26);

  // ── Resumen para chip colapsado (mobile) ──
  const sum = $('kpi-summary');
  if (sum) {
    sum.innerHTML = `
      <span class="sum-pill old">
        <span class="dot sm" style="background:#e2f916"></span>
        2021 · ${fmtNum(a21.total)} · ${pct(a21.led, a21.total)} LED
      </span>
      <span class="sum-pill new">
        <span class="dot sm" style="background:#22d3ee"></span>
        2026 · ${fmtNum(a26.total)} · ${pct(a26.led, a26.total)} LED
      </span>
    `;
  }

  // ── Debug ──
  const costoAnual21 = kwh21 * cfg.tarifaKwh * 12;
  const costoAnual26 = kwh26 * cfg.tarifaKwh * 12;

  window.LUX_DEBUG = {
    a21, a26, kwh21, kwh26,
    costoAnual21, costoAnual26,
    ahorroAnual: costoAnual21 - costoAnual26
  };
  console.table({ '2021': a21, '2026': a26 });
}

/* ── Cambio de estilo ─────────────────────────────────────────────── */
function cambiarEstilo(nuevo) {
  estiloActual = nuevo;
  const estilo = APP.estilosMapa[nuevo];
  map2021.setStyle(estilo);
  map2026.setStyle(estilo);
  map2021.once('styledata', () => reinyectar(map2021, 'lum-2021', 'lum-2021-layer', datos2021, 2021));
  map2026.once('styledata', () => reinyectar(map2026, 'lum-2026', 'lum-2026-layer', datos2026, 2026));
}

function reinyectar(map, srcId, layerId, datos, anio) {
  setTimeout(() => {
    if (!map.getSource(srcId)) map.addSource(srcId, { type: 'geojson', data: datos });
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId, type: 'circle', source: srcId,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 3.5, 17, 7],
          'circle-color': colorExpression(anio),
          'circle-opacity': 0.9,
          'circle-stroke-width': 0.4,
          'circle-stroke-color': 'rgba(0,0,0,0.5)'
        }
      });
    }
  }, 150);
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTACIÓN A PDF
   ══════════════════════════════════════════════════════════════════ */

/* Overlay de progreso */
function mostrarProgreso(msg) {
  let el = $('pdf-progress');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pdf-progress';
    el.className = 'pdf-progress';
    el.innerHTML = `<div class="pdf-spinner"></div><div id="pdf-progress-msg"></div>`;
    document.body.appendChild(el);
  }
  const msgEl = $('pdf-progress-msg');
  if (msgEl) msgEl.textContent = msg;
  el.classList.remove('hidden');
}
function ocultarProgreso() {
  const el = $('pdf-progress');
  if (el) el.classList.add('hidden');
}

/* Captura un mapa MapLibre manteniendo su estado real (zoom, posición, etc.) */
function capturarMapa(idMapa) {
  return new Promise((resolve, reject) => {
    const map = idMapa === 'map-2026' ? map2026 : map2021;
    if (!map) return reject(new Error('Mapa no disponible: ' + idMapa));

    map.once('render', () => {
      requestAnimationFrame(() => {
        const canvas = map.getCanvas();
        try {
          const out = document.createElement('canvas');
          out.width = canvas.width;
          out.height = canvas.height;
          const ctx = out.getContext('2d');
          ctx.drawImage(canvas, 0, 0);
          resolve(out);
        } catch (err) {
          reject(err);
        }
      });
    });
    map.triggerRepaint();
  });
}

/* Genera el PDF */
async function generarPDF({ titulo, notas, conKpis, conMapas }) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF no está disponible');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  mostrarProgreso('Capturando mapas…');

  const canvas2026 = conMapas ? await capturarMapa('map-2026') : null;
  const canvas2021 = conMapas ? await capturarMapa('map-2021') : null;

  mostrarProgreso('Armando PDF…');

  let y = M;

  // ── Encabezado ──
  doc.setFillColor(250, 115, 19);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(titulo, M, 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  doc.text(fecha, W - M, 10.5, { align: 'right' });
  y = 24;

  // ── KPIs ──
  if (conKpis && window.LUX_DEBUG) {
    const { a21, a26, kwh21, kwh26 } = window.LUX_DEBUG;
    const pct = (p, t) => t ? ((p / t) * 100).toFixed(1) + '%' : '0%';

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Resumen comparativo', M, y);
    y += 6;

    const colW = (W - M * 2) / 3;
    const rows = [
      ['Métrica', '2021', '2026'],
      ['Total luminarias', fmtNum(a21.total), fmtNum(a26.total)],
      ['LED', `${fmtNum(a21.led)} (${pct(a21.led, a21.total)})`, `${fmtNum(a26.led)} (${pct(a26.led, a26.total)})`],
      ['Sodio / SAP', `${fmtNum(a21.sodio)} (${pct(a21.sodio, a21.total)})`, `${fmtNum(a26.sodio)} (${pct(a26.sodio, a26.total)})`],
      ['Otros', `${fmtNum(a21.otros)} (${pct(a21.otros, a21.total)})`, `${fmtNum(a26.otros)} (${pct(a26.otros, a26.total)})`],
      ['Potencia total', fmtNum(a21.kw, 1) + ' kW', fmtNum(a26.kw, 1) + ' kW'],
      ['Consumo mensual', fmtNum(kwh21, 0) + ' kWh', fmtNum(kwh26, 0) + ' kWh']
    ];

    doc.setFontSize(8.5);
    let rowY = y + 4;
    rows.forEach((r, i) => {
      const isHeader = i === 0;
      if (isHeader) {
        doc.setFillColor(241, 245, 249);
        doc.rect(M, rowY - 4, W - M * 2, 6, 'F');
      }
      doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
      doc.setTextColor(isHeader ? 15 : 71, isHeader ? 23 : 85, isHeader ? 42 : 105);
      r.forEach((cell, j) => {
        const x = M + j * colW + 2;
        doc.text(String(cell), x, rowY);
      });
      if (i > 0) {
        doc.setDrawColor(226, 232, 240);
        doc.line(M, rowY + 1.5, W - M, rowY + 1.5);
      }
      rowY += 6;
    });
    y = rowY + 4;
  }

  // ── Mapas (uno debajo del otro) ──
  if (conMapas && canvas2021 && canvas2026) {
    const mapW = W - M * 2;
    const ratio = canvas2021.height / canvas2021.width;
    const mapH = mapW * ratio;

    if (y + 6 + mapH > H - M - 20) {
      doc.addPage();
      y = M;
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Mapa comparativo', M, y);
    y += 5;

    // 2021
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(202, 138, 4);
    doc.text('2021', M, y);
    y += 2;
    doc.addImage(canvas2021.toDataURL('image/jpeg', 0.88), 'JPEG', M, y, mapW, mapH);
    y += mapH + 6;

    // Verificar espacio para el segundo mapa
    if (y + 4 + mapH > H - M - 20) {
      doc.addPage();
      y = M;
    }

    // 2026
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(6, 182, 212);
    doc.text('2026', M, y);
    y += 2;
    doc.addImage(canvas2026.toDataURL('image/jpeg', 0.88), 'JPEG', M, y, mapW, mapH);
    y += mapH + 4;
  }

  // ── Notas / Observaciones ──
  if (notas) {
    const espaciado = y + 30 > H - M ? 12 : 6;
    if (y + espaciado + 20 > H - M) {
      doc.addPage();
      y = M;
    } else {
      y += espaciado;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Observaciones', M, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const lineas = doc.splitTextToSize(notas, W - M * 2 - 4);
    doc.text(lineas, M, y);
  }

  // ── Pie de página ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Reconversión LED Rivadavia', M, H - 6);
    doc.text(`Página ${i} / ${totalPages}`, W - M, H - 6, { align: 'right' });
  }

  ocultarProgreso();

  const nombre = `informe-led-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(nombre);
}

/* ── Init PDF (modal) ─────────────────────────────────────────────── */
function initPDF() {
  const modal     = $('pdf-modal');
  const btnOpen   = $('btn-pdf');
  const btnClose  = $('pdf-modal-close');
  const btnCancel = $('pdf-cancel');
  const btnGen    = $('pdf-generate');
  const backdrop  = modal?.querySelector('.pdf-modal-backdrop');

  if (!modal || !btnOpen || !btnGen) {
    console.warn('[LUX] Modal PDF no encontrado en el DOM');
    return;
  }

  const abrir  = () => modal.classList.remove('hidden');
  const cerrar = () => modal.classList.add('hidden');

  btnOpen.addEventListener('click', abrir);
  btnClose?.addEventListener('click', cerrar);
  btnCancel?.addEventListener('click', cerrar);
  backdrop?.addEventListener('click', cerrar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrar();
  });

  btnGen.addEventListener('click', async () => {
    btnGen.disabled = true;
    const originalHTML = btnGen.innerHTML;
    btnGen.innerHTML = 'Generando…';
    try {
      await generarPDF({
        titulo:   $('pdf-title').value.trim() || 'Reconversión LED · Rivadavia',
        notas:    $('pdf-notes').value.trim(),
        conKpis:  $('pdf-include-kpis').checked,
        conMapas: $('pdf-include-maps').checked
      });
      cerrar();
    } catch (err) {
      console.error(err);
      setDiag('Error al generar PDF: ' + err.message);
      ocultarProgreso();
    } finally {
      btnGen.disabled = false;
      btnGen.innerHTML = originalHTML;
    }
  });
}

/* ── UI ───────────────────────────────────────────────────────────── */
function initUI() {
  const html = document.documentElement;

  const aplicarTema = (modo) => {
    if (modo === 'light') html.classList.remove('dark');
    else html.classList.add('dark');
  };

  $('map-style-select').addEventListener('change', e => {
    const val = e.target.value;
    if (val === 'satellite') {
      html.classList.remove('dark');
      cambiarEstilo('satellite');
    } else {
      aplicarTema(val);
      cambiarEstilo(val);
    }
  });

  $('theme-toggle').addEventListener('click', () => {
    const esDark = !html.classList.contains('dark');
    aplicarTema(esDark ? 'dark' : 'light');
    const nuevoEstilo = esDark ? 'dark' : 'light';
    $('map-style-select').value = nuevoEstilo;
    cambiarEstilo(nuevoEstilo);
  });

  // ── Toggle KPIs (mobile) ──
  const kpiToggle = $('kpi-toggle');
  const kpiStrip  = $('kpi-strip');
  if (kpiToggle && kpiStrip) {
    kpiToggle.addEventListener('click', () => {
      const expanded = kpiStrip.classList.toggle('expanded');
      kpiToggle.setAttribute('aria-expanded', expanded);
    });
  }

  // ── PDF ──
  initPDF();
}

/* ── Arranque ─────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  initMapas();
  initUI();
});
