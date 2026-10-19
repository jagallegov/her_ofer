/* ====================================================================== */
/*  Oferta de cupos y docentes ocasionales, Sede Medellín                 */
/*  Universidad Nacional de Colombia                                      */
/*                                                                        */
/*  Seis secciones: oferta de cupos, docentes ocasionales, grupos y        */
/*  ocupación, oferta de 2026-2S, cancelación y pérdida y evolución de    */
/*  resultados académicos. Este archivo    */
/*  se transpila en el navegador con Babel standalone y consulta los      */
/*  datos del objeto global window.OFERTA.                                */
/* ====================================================================== */

const { useState, useMemo, useRef, useEffect, useCallback } = React;

const DEF = window.OFERTA.definiciones;
const X = window.OFERTA.datos;
const C = X.catalogos;
const PER = X.periodos;
const MAT = X.matriculados;

/* Cada tabla se guarda por columnas; se arma un objeto con sus dimensiones y medidas. */
function armar(t, dimensiones) {
  const col = {};
  t.campos.forEach((c, i) => { col[c] = t.filas[i]; });
  const dims = dimensiones.map(k => ({ k, cat: C[k], col: col[k] }));
  return { n: t.filas[0].length, dims, col };
}
const TB = {
  oferta: armar(X.oferta, ['facultad', 'uab', 'obligatoria', 'servicio']),
  grupos: armar(X.grupos, ['facultad', 'uab', 'obligatoria', 'servicio', 'docente']),
  docentes: armar(X.docentes, ['facultad']),
  perdida: armar(X.perdida, ['facultad', 'uab']),
  oferta26: armar(X.oferta26, ['facultad', 'uab', 'obligatoria', 'docente', 'estado']),
  evol: armar(X.evolucion, ['facultad', 'uab', 'obligatoria', 'servicio', 'asignatura'])
};
const NP_EV = 9;     // semestres con resultados: 2022-1S a 2026-1S
const FIL = { facultad: 'Facultad', uab: 'Unidad académica básica', obligatoria: 'Tipo de asignatura',
  servicio: 'Asignaturas de servicio', docente: 'Tipo de docente', estado: 'Estado del grupo',
  asignatura: 'Asignatura' };
const CORTO = { facultad: 'Facultad', uab: 'UAB', obligatoria: 'Tipo', servicio: 'Servicio', docente: 'Docente', estado: 'Estado', asignatura: 'Asignatura' };

/* ------------------------------------------------------------ formatos */
const fEnt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const vacio = v => v === null || v === undefined || (typeof v === 'number' && isNaN(v));
const num = v => (vacio(v) ? '—' : fEnt.format(Math.round(v)));
const dec = (v, n = 1) => (vacio(v) ? '—' : (n === 1 ? f1.format(v) : v.toFixed(n).replace('.', ',')));
const pct = (v, n = 1) => (vacio(v) ? '—' : dec(v, n) + '%');
const pts = v => (vacio(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + dec(Math.abs(v)));
const sgn = (v, n = 1) => (vacio(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + dec(Math.abs(v), n) + '%');
const cortoDim = d => CORTO[d] || d;

const clave = t =>
  't-' + String(t).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SECCIONES = [
  { id: 'oferta', rotulo: 'Oferta de cupos', filtros: ['facultad', 'uab', 'obligatoria', 'servicio'], tabla: 'oferta' },
  { id: 'docentes', rotulo: 'Docentes ocasionales', filtros: ['facultad'], tabla: 'docentes' },
  { id: 'grupos', rotulo: 'Grupos y ocupación', filtros: ['facultad', 'uab', 'obligatoria', 'servicio'], tabla: 'grupos' },
  { id: 'oferta26', rotulo: 'Oferta de 2026-2S', filtros: ['facultad', 'uab', 'obligatoria', 'docente'], tabla: 'oferta26' },
  { id: 'cancelacion', rotulo: 'Cancelación y pérdida', filtros: ['facultad', 'uab'], tabla: 'perdida' },
  { id: 'evolucion', rotulo: 'Evolución de resultados académicos', filtros: ['facultad', 'uab', 'obligatoria', 'servicio', 'asignatura'], tabla: 'evol' }
];

/* ==================================================================== */
/*  Motor de consulta                                                    */
/* ==================================================================== */

function crearConsulta(seleccion, tabla) {
  const DIMS = tabla.dims, NF = tabla.n, DIM = {};
  DIMS.forEach(d => { DIM[d.k] = d; });
  const sel = {};
  DIMS.forEach(d => {
    const lista = seleccion[d.k];
    if (lista && lista.length) {
      const m = {};
      lista.forEach(c => { const i = d.cat.indexOf(c); if (i >= 0) m[i] = true; });
      sel[d.k] = m;
    }
  });
  const pasa = (i, omitir) => {
    for (let k = 0; k < DIMS.length; k++) {
      const d = DIMS[k];
      if (d.k === omitir) continue;
      const s = sel[d.k];
      if (s && !s[d.col[i]]) return false;
    }
    return true;
  };
  const filtrar = omitir => {
    const f = [];
    for (let i = 0; i < NF; i++) if (pasa(i, omitir)) f.push(i);
    return f;
  };
  const filas = filtrar(null);
  const opciones = dim => {
    const d = DIM[dim];
    const hay = {};
    for (let i = 0; i < NF; i++) if (pasa(i, dim)) hay[d.col[i]] = true;
    return d.cat.filter((c, j) => hay[j]);
  };
  return { filas, filtrar, opciones };
}

/** Suma de una medida de una tabla sobre las filas indicadas, con una condición opcional. */
const sumar = (T, filas, med, cond) => {
  const m = T.col[med]; let s = 0;
  for (let j = 0; j < filas.length; j++) { const i = filas[j]; if (!cond || cond(i)) s += m[i]; }
  return s;
};
const razon = (a, b, k = 100) => (b ? k * a / b : null);
const IDX = (k, nombre) => C[k].indexOf(nombre);

/** Valores por periodo de una función de las filas de ese periodo. */
const porPeriodo = (T, filas, f) => {
  const g = PER.map(() => []);
  const col = T.col.periodo;
  filas.forEach(i => { g[col[i]].push(i); });
  return g.map((fs, p) => (fs.length ? f(fs, p) : null));
};

/** Ventanas de comparación entre UAB: promedio por semestre de cada par de periodos. */
const VA = [1, 2], VB = [7, 8];
const NOM_VA = '2022-2S y 2023-1S', NOM_VB = '2025-2S y 2026-1S';
const enVentana = (T, v) => i => v.indexOf(T.col.periodo[i]) >= 0;

function Tarjeta({ titulo, accion, children }) {
  return (
    <section className="dsh-card">
      <div className="dsh-card-h">
        <h2>{titulo}</h2>
        {accion || null}
      </div>
      <div className="dsh-cuerpo">{children}</div>
    </section>
  );
}

function descargarCsv(nombreArchivo, encabezados, filas) {
  const celda = v => {
    if (vacio(v)) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const t = String(v);
    return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const texto = [encabezados].concat(filas).map(f => f.map(celda).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nombreArchivo = partes =>
  partes.filter(Boolean).map(clave).join('_').replace(/^t-/, '').replace(/_t-/g, '_');

const TIPO_LETRA = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function descargarPng(ec, nombreSalida, titulo) {
  const pr = 3;
  const base = ec.getDataURL({ type: 'png', pixelRatio: pr, backgroundColor: '#fff' });
  const img = new Image();
  img.onload = function () {
    const cabecera = 74 * pr, pie = 34 * pr, margen = 20 * pr;
    const lienzo = document.createElement('canvas');
    lienzo.width = img.width;
    lienzo.height = img.height + cabecera + pie;
    const c = lienzo.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, lienzo.width, lienzo.height);
    c.textBaseline = 'middle';
    c.fillStyle = '#242627';
    c.font = '600 ' + 15 * pr + 'px ' + TIPO_LETRA;
    c.fillText(titulo, margen, 30 * pr);
    c.fillStyle = '#677d29';
    c.font = '600 ' + 10 * pr + 'px ' + TIPO_LETRA;
    c.fillText('Universidad Nacional de Colombia · Sede Medellín', margen, 54 * pr);
    c.strokeStyle = '#dcdcdc';
    c.lineWidth = 1 * pr;
    c.beginPath();
    c.moveTo(margen, cabecera - 6 * pr);
    c.lineTo(lienzo.width - margen, cabecera - 6 * pr);
    c.stroke();
    c.drawImage(img, 0, cabecera);
    c.fillStyle = '#a2a3a4';
    c.font = 10 * pr + 'px ' + TIPO_LETRA;
    c.fillText(DEF.fuenteCorta, margen, img.height + cabecera + pie / 2);
    const a = document.createElement('a');
    a.href = lienzo.toDataURL('image/png');
    a.download = nombreSalida + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  img.src = base;
}

function Descargas({ csv, instancia, nombre, titulo, extra }) {
  return (
    <span className="dsh-acc">
      {extra || null}
      {csv ? (
        <button type="button" className="dsh-ico" title="Descargar los datos agregados en CSV"
          aria-label="Descargar los datos agregados en CSV"
          onClick={() => { const d = csv(); if (d) descargarCsv(nombre, d.encabezados, d.filas); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4L12 13.2V3h0ZM5 18h14v2H5v-2Z" />
          </svg>
        </button>
      ) : null}
      {instancia ? (
        <button type="button" className="dsh-ico" title="Descargar el gráfico en PNG"
          aria-label="Descargar el gráfico en PNG"
          onClick={() => { const ec = instancia.current; if (ec) descargarPng(ec, nombre, titulo); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 12h14l-4.5-6-3.5 4.5-2.2-2.7L5 17Zm3.2-6.4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

const MARGEN_EJE = 34;
const ALTO_LINEA_LEYENDA = 24;
const HOLGURA_LEYENDA = 10;

let medidor = null;
function anchoTexto(texto, fuente) {
  if (!medidor) {
    const lienzo = document.createElement('canvas');
    medidor = lienzo.getContext ? lienzo.getContext('2d') : null;
  }
  if (!medidor) return String(texto).length * 7;
  medidor.font = fuente;
  return medidor.measureText(String(texto)).width;
}

function ajustarLeyenda(inst, opcion) {
  if (!inst || !opcion || !opcion.rotulosLeyenda || !opcion.rotulosLeyenda.length) return;
  if (typeof inst.getWidth !== 'function') return;
  const disponible = Math.max(200, inst.getWidth() * 0.90 - 32);
  const fuente = '11px ' + TIPO_LETRA;
  const anchos = opcion.rotulosLeyenda.map(n => (11 + 5 + anchoTexto(n, fuente)) * 1.12);
  let lineas = 1;
  let usado = 0;
  anchos.forEach(a => {
    const necesita = usado ? usado + 18 + a : a;
    if (necesita > disponible && usado > 0) { lineas += 1; usado = a; }
    else { usado = necesita; }
  });
  inst.setOption({
    grid: { bottom: MARGEN_EJE + lineas * ALTO_LINEA_LEYENDA + HOLGURA_LEYENDA + (opcion.__extraX || 0) }
  });
}

/** Evita que las etiquetas de datos y de los ejes se crucen entre sí o con las barras vecinas:
 *  gira las etiquetas de las barras verticales agrupadas cuando no caben a lo ancho, oculta las etiquetas
 *  de los segmentos apilados demasiado pequeños, gira las del eje de categorías si no caben y deja el
 *  margen necesario para las etiquetas que sobresalen del área de trazado. */
function evitarCruces(inst, op) {
  try {
    if (!inst || !op || !Array.isArray(op.series) || typeof inst.getWidth !== 'function') return;
    const barras = op.series.filter(s => s.type === 'bar');
    if (!barras.length) return;
    const vertical = op.xAxis && op.xAxis.type === 'category';
    const horizontal = op.yAxis && op.yAxis.type === 'category';
    if (!vertical && !horizontal) return;
    const val = v => (v && typeof v === 'object' ? v.value : v);
    const ancho = inst.getWidth(), alto = inst.getHeight();
    const gAct = ((inst.getOption() || {}).grid || [{}])[0] || {};
    const num0 = (a, b) => (typeof a === 'number' ? a : b);
    const gl = num0(gAct.left, 60), gr = num0(gAct.right, 26), gb = num0(gAct.bottom, 60);
    const og = op.grid || {};
    const gt0 = num0(og.top, 36), gr0 = num0(og.right, 26);
    const plotW = ancho - gl - gr, plotH = alto - gt0 - gb;
    const apilado = barras.some(s => s.stack);
    const datosCat = (vertical ? op.xAxis.data : op.yAxis.data) || [];
    const cats = datosCat.length || 1;
    const textoEtq = (s, v) => {
      const f = s.label && s.label.formatter;
      if (typeof f === 'function') return String(f({ value: v, name: '', seriesName: s.name }));
      return v === null || v === undefined ? '' : String(v);
    };
    const fuenteEtq = s => ((s.label && s.label.fontSize) || 9) + 'px ' + TIPO_LETRA;
    const parche = op.series.map(() => null);
    const grid = { top: gt0, right: gr0 };
    const ejeX = {};
    let extremo = null;
    if (apilado) {
      try {
        const eje = inst.getModel().getComponent(vertical ? 'yAxis' : 'xAxis', 0).axis;
        extremo = eje.scale.getExtent();
      } catch (e) { extremo = null; }
    }
    /* Eje de categorías vertical: las etiquetas se giran si no caben a lo ancho de cada categoría. */
    let extraX = 0;
    if (vertical) {
      const fe = ((op.xAxis.axisLabel && op.xAxis.axisLabel.fontSize) || 9) + 'px ' + TIPO_LETRA;
      const wx = datosCat.reduce((a, t) => Math.max(a, anchoTexto(String(t), fe)), 0);
      const banda = plotW / cats;
      if (wx > banda - 6) { ejeX.rotate = 35; extraX = Math.ceil(wx * 0.58); } else { ejeX.rotate = 0; }
    }
    op.__extraX = extraX;
    op.series.forEach((s, i) => {
      if (s.type !== 'bar' || !s.label || !s.label.show) return;
      const datos = (s.data || []).map(val);
      const textos = datos.map(v => (v === null || v === undefined ? '' : textoEtq(s, v)));
      const fs = s.label.fontSize || 9;
      const wmax = textos.reduce((a, t) => Math.max(a, t ? anchoTexto(t, fuenteEtq(s)) : 0), 0);
      const n = barras.length;
      const banda = (vertical ? plotW : plotH) / cats;
      if (apilado) {
        if (!extremo) return;
        const span = (extremo[1] - extremo[0]) || 1;
        const orig = s.label.formatter;
        const largo = vertical ? plotH : plotW;
        let anchoBarra = banda * 0.8;
        if (s.barMaxWidth) anchoBarra = Math.min(anchoBarra, s.barMaxWidth);
        const girar = vertical && wmax + 4 > anchoBarra;
        parche[i] = { rotate: girar ? 90 : 0, formatter: p => {
          const v = val(p.value);
          const t = typeof orig === 'function' ? String(orig(p)) : String(v);
          if (v === null || v === undefined || !t) return '';
          const px = Math.abs(v) / span * largo;
          const necesita = vertical ? (girar ? anchoTexto(t, fs + 'px ' + TIPO_LETRA) + 8 : fs + 4)
            : anchoTexto(t, fs + 'px ' + TIPO_LETRA) + 8;
          return px >= necesita ? t : '';
        } };
        return;
      }
      if (vertical) {
        let porBarra = banda * 0.8 / (n + 0.3 * (n - 1));
        if (s.barMaxWidth) porBarra = Math.min(porBarra, s.barMaxWidth);
        const base = { show: true, rotate: 0, position: s.label.position || 'top',
          align: s.label.align || 'center', verticalAlign: s.label.verticalAlign || 'bottom',
          distance: typeof s.label.distance === 'number' ? s.label.distance : 5 };
        if (porBarra < wmax + 3) {
          if (porBarra < fs) { base.show = false; }
          else {
            Object.assign(base, { rotate: 90, position: 'top', align: 'left', verticalAlign: 'middle', distance: 5 });
            grid.top = Math.max(grid.top, Math.ceil(wmax) + 14);
          }
        }
        parche[i] = base;
      } else {
        grid.right = Math.max(grid.right, Math.ceil(wmax) + 14);
      }
    });
    const series = op.series.map((s, i) => (parche[i]
      ? { name: s.name, type: s.type, label: parche[i] } : { name: s.name, type: s.type }));
    const cambio = { grid: grid, series: series };
    if (vertical) cambio.xAxis = { axisLabel: ejeX };
    inst.setOption(cambio);
  } catch (e) { /* la presentación no debe fallar por el ajuste de etiquetas */ }
}

function ajustarGrafico(inst, opcion) {
  const antes = (opcion && opcion.__extraX) || 0;
  ajustarLeyenda(inst, opcion);
  evitarCruces(inst, opcion);
  if (opcion && (opcion.__extraX || 0) !== antes) ajustarLeyenda(inst, opcion);
}

/** Evita combinar verde y ocre en una misma gráfica: con solo esos dos colores, el verde pasa a gris;
 *  con un tercer color, el verde pasa a gris claro. */
function armonizar(op) {
  if (!op || !Array.isArray(op.series)) return op;
  const VERDES = ['#677d29', '#a9d12c'], OCRE = '#eaad13', GRIS = '#464646', NEUTRO = '#a2a3a4';
  const sitios = [];
  const ver = (o, k) => { if (o && typeof o[k] === 'string') sitios.push([o, k, o[k].toLowerCase()]); };
  op.series.forEach(s => {
    ver(s.itemStyle, 'color');
    ver(s.lineStyle, 'color');
    if (Array.isArray(s.data)) s.data.forEach(d => { if (d && typeof d === 'object') ver(d.itemStyle, 'color'); });
  });
  const set = new Set(sitios.map(x => x[2]));
  const verdes = VERDES.filter(c => set.has(c));
  if (!set.has(OCRE) || !verdes.length) return op;
  const otros = set.size - verdes.length - 1;
  let cambio = null;
  if (otros === 0) cambio = verdes.length === 1 ? [verdes[0], GRIS] : [OCRE, GRIS];
  else if (set.size <= 3 && verdes.length === 1 && !set.has(NEUTRO)) cambio = [verdes[0], NEUTRO];
  if (!cambio) return op;
  sitios.forEach(x => { if (x[2] === cambio[0]) x[0][x[1]] = cambio[1]; });
  return op;
}

function Grafico({ opcion, alto, instancia, alSeleccionar, altoLienzo }) {
  const caja = useRef(null);
  const inst = useRef(null);
  const cb = useRef(alSeleccionar);
  cb.current = alSeleccionar;
  const opcionRef = useRef(opcion);
  opcionRef.current = opcion;

  useEffect(() => {
    if (!window.echarts || !caja.current) return undefined;
    inst.current = window.echarts.init(caja.current, null, { renderer: 'canvas' });
    if (instancia) instancia.current = inst.current;
    inst.current.on('click', p => { if (cb.current) cb.current(p.name, p); });
    const redimensionar = () => {
      if (!inst.current) return;
      inst.current.resize();
      ajustarGrafico(inst.current, opcionRef.current);
    };
    let obs = null;
    if (window.ResizeObserver) {
      obs = new window.ResizeObserver(redimensionar);
      obs.observe(caja.current);
    }
    window.addEventListener('resize', redimensionar);
    return () => {
      window.removeEventListener('resize', redimensionar);
      if (obs) obs.disconnect();
      if (inst.current) inst.current.dispose();
      inst.current = null;
      if (instancia) instancia.current = null;
    };
  }, []);

  useEffect(() => {
    if (inst.current && opcion) {
      armonizar(opcion);
      inst.current.setOption(opcion, true);
      ajustarGrafico(inst.current, opcion);
    }
  }, [opcion]);

  useEffect(() => { if (inst.current) inst.current.resize(); }, [altoLienzo]);

  if (!window.echarts) {
    return <p className="dsh-vacio">Los gráficos no están disponibles en esta sesión.</p>;
  }
  const estilo = { cursor: alSeleccionar ? 'pointer' : 'default' };
  if (altoLienzo) estilo.height = altoLienzo + 'px';
  return (
    <div className="dsh-scroll">
      <div ref={caja} className={'dsh-grafico ' + (alto || '')} style={estilo} />
    </div>
  );
}

function TarjetaGrafico({ titulo, alto, opcion, csv, archivo, alSeleccionar,
  altoLienzo, extra }) {
  const instancia = useRef(null);
  return (
    <Tarjeta titulo={titulo}
      accion={<Descargas csv={csv} instancia={instancia} nombre={archivo}
        titulo={titulo} extra={extra} />}>
      {opcion
        ? <Grafico opcion={opcion} alto={alto} instancia={instancia}
            alSeleccionar={alSeleccionar} altoLienzo={altoLienzo} />
        : <p className="dsh-vacio">Sin datos para la selección vigente.</p>}
    </Tarjeta>
  );
}

function Segmento({ etiqueta, opciones, valor, onCambio }) {
  return (
    <div className="dsh-segmento compacto" role="group" aria-label={etiqueta}>
      {opciones.map(o => (
        <button key={o.valor} type="button" aria-pressed={valor === o.valor}
          onClick={() => onCambio(o.valor)}>{o.texto}</button>
      ))}
    </div>
  );
}

function Tabla({ columnas, filas, ordenInicial, alSeleccionar, altura }) {
  const [orden, setOrden] = useState(ordenInicial || { col: 0, asc: true });
  const ordenadas = useMemo(() => {
    const c = columnas[orden.col];
    const copia = filas.slice();
    copia.sort((a, b) => {
      const va = c.val(a), vb = c.val(b);
      if (vacio(va)) return 1;
      if (vacio(vb)) return -1;
      const r = typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb;
      return orden.asc ? r : -r;
    });
    return copia;
  }, [columnas, filas, orden]);

  const clic = i => setOrden(o =>
    (o.col === i ? { col: i, asc: !o.asc } : { col: i, asc: !columnas[i].num }));

  if (!filas.length) {
    return <p className="dsh-vacio">Sin registros para la selección vigente.</p>;
  }
  return (
    <div className="dsh-tabla-wrap" style={{ maxHeight: altura || 430 }}>
      <table className="dsh-tabla">
        {columnas.some(c => c.ancho) ? (
          <colgroup>
            {columnas.map(c => <col key={c.tit} style={c.ancho ? { width: c.ancho } : undefined} />)}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={c.tit} className={(c.fija ? 'fija' : '') + (c.num ? ' num' : '') + (c.izq ? ' izq' : '')}
                onClick={() => clic(i)}>
                {c.tit}
                {orden.col === i ? <span className="ord"> {orden.asc ? '▲' : '▼'}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f, i) => (
            <tr key={i} style={alSeleccionar ? { cursor: 'pointer' } : null}
              onClick={() => alSeleccionar && alSeleccionar(f)}>
              {columnas.map(c => (
                <td key={c.tit} className={(c.fija ? 'fija' : '') + (c.num ? ' num' : '') + (c.izq ? ' izq' : '')}>
                  {c.txt(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ icono, fondo, etiqueta, valor }) {
  return (
    <div className="dsh-kpi">
      <span className="dsh-kpi-ic" style={{ background: fondo }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={icono} /></svg>
      </span>
      <span>
        <span className="dsh-kpi-lab">{etiqueta}</span>
        <span className="dsh-kpi-val">{valor}</span>
      </span>
    </div>
  );
}

const IC = {
  visto: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  equis: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z',
  circulo: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-5h2v2h-2v-2Zm0-8h2v6h-2V7Z',
  tasa: 'M3.5 18.5 9 13l4 4 7.5-7.5-1.4-1.4L13 14.2l-4-4-6.9 6.9 1.4 1.4Z',
  doc: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v1.6H8V12Zm0 3.4h8V17H8v-1.6Z',
  malla: 'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z',
  persona: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z'
};
/* ==================================================================== */
/*  Opciones de los gráficos                                             */
/* ==================================================================== */

const baseOpcion = () => ({
  textStyle: { fontFamily: TIPO_LETRA, fontSize: 11, color: '#4e5254' },
  animationDuration: 350,
  grid: { left: 66, right: 26, top: 42,
    bottom: MARGEN_EJE + ALTO_LINEA_LEYENDA + HOLGURA_LEYENDA },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#ffffff', borderColor: '#dcdcdc', borderWidth: 1,
    textStyle: { color: '#242627', fontSize: 11, fontFamily: TIPO_LETRA },
    axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(103,125,41,.06)' } }
  },
  legend: {
    top: null, bottom: 6, left: 'center', width: '94%',
    type: 'plain', orient: 'horizontal', icon: 'roundRect',
    itemWidth: 11, itemHeight: 11, itemGap: 18, padding: [2, 6],
    textStyle: { color: '#4e5254', fontSize: 11 }
  }
});

const ejeValor = (formato, nombre, extra) => Object.assign({
  type: 'value',
  name: nombre || '', nameLocation: 'middle',
  nameTextStyle: { color: '#4e5254', fontSize: 11 },
  axisLine: { show: false }, axisTick: { show: false },
  splitLine: { show: false },
  axisLabel: { color: '#4e5254', fontSize: 9, formatter: formato || (v => fEnt.format(v)) }
}, extra || {});

const ejeCategoria = (datos, extra) => Object.assign({
  type: 'category', data: datos,
  axisLine: { lineStyle: { color: '#dcdcdc' } },
  axisTick: { show: false },
  axisLabel: { color: '#4e5254', fontSize: 9, interval: 0 }
}, extra || {});

/** Descarta las series sin valores visibles (menos del 0,5% del total). */
function soloConValor(series) {
  const val = v => (v && typeof v === 'object' ? v.value : v);
  const sumaAbs = s => s.datos.reduce((a, v) => a + Math.abs(val(v) || 0), 0);
  const total = series.reduce((a, s) => a + sumaAbs(s), 0);
  return series.filter(s => sumaAbs(s) > 0 && sumaAbs(s) >= 0.005 * total);
}

/** Barras verticales por período, simples o apiladas. */
function opcionPeriodos(periodos, series, o) {
  o = o || {};
  const op = baseOpcion();
  op.grid = { left: 62, right: 26, top: 36, bottom: MARGEN_EJE + ALTO_LINEA_LEYENDA + HOLGURA_LEYENDA };
  op.xAxis = ejeCategoria(periodos);
  op.yAxis = ejeValor(o.formatoEje, o.nombreEje, Object.assign(
    { nameGap: 46 }, o.pct ? { max: 100 } : {}));
  if (o.formatoTooltip) op.tooltip.valueFormatter = o.formatoTooltip;
  if (o.tooltipPct) {
    op.tooltip.formatter = ps => {
      const t = ps[0].axisValueLabel;
      return '<b>' + t + '</b><br/>' + ps.map(p =>
        p.marker + p.seriesName + ': ' + pct(p.value) +
        ' (' + num(o.conteos[p.seriesName][p.dataIndex]) + ')').join('<br/>');
    };
  }
  if (!o.todas) series = soloConValor(series);
  op.series = series.map(s => Object.assign({
    name: s.nombre, type: s.tipo || 'bar', data: s.datos,
    stack: o.apilado ? 'a' : undefined, barMaxWidth: 34,
    itemStyle: { color: s.color }
  }, s.extra || {}));
  op.rotulosLeyenda = series.map(s => s.nombre);
  if (series.length < 2) op.legend = { show: false };
  return op;
}

/** Barras horizontales por categoría, simples o apiladas. */
function opcionCategorias(nombres, series, o) {
  o = o || {};
  const op = baseOpcion();
  const ancho = nombres.reduce((a, n) => Math.max(a, String(n).length), 0);
  op.grid = { left: Math.min(260, 24 + ancho * 5.6), right: 52, top: 14,
    bottom: series.length > 1 ? MARGEN_EJE + 10 : 28 };
  op.xAxis = ejeValor(o.formatoEje, '', Object.assign({ nameGap: 0 }, o.pct ? { max: 100 } : {}));
  op.yAxis = ejeCategoria(nombres, { inverse: true });
  /* Los nombres largos se recortan con puntos suspensivos en lugar de salirse del gráfico. */
  op.yAxis.axisLabel = Object.assign({}, op.yAxis.axisLabel, { width: op.grid.left - 22, overflow: 'truncate', ellipsis: '…' });
  if (o.formatoTooltip) op.tooltip.valueFormatter = o.formatoTooltip;
  if (o.tooltipPct) {
    op.tooltip.formatter = ps => {
      const t = ps[0].axisValueLabel;
      return '<b>' + t + '</b><br/>' + ps.map(p =>
        p.marker + p.seriesName + ': ' + pct(p.value) +
        ' (' + num(o.conteos[p.seriesName][p.dataIndex]) + ')').join('<br/>');
    };
  }
  series = soloConValor(series);
  op.series = series.map(s => ({
    name: s.nombre, type: 'bar', stack: o.apilado ? 'a' : undefined,
    data: s.datos, barMaxWidth: 22, itemStyle: { color: s.color },
    label: o.etiquetas ? { show: true, position: 'right', color: '#242627', fontSize: 9,
      formatter: p => (o.fmtEtiqueta ? o.fmtEtiqueta(p.value) : fEnt.format(p.value)) } : undefined
  }));
  op.rotulosLeyenda = series.map(s => s.nombre);
  if (series.length < 2) op.legend = { show: false };
  return op;
}

function Seleccion({ seleccion, quitar, limpiar }) {
  const fichas = [];
  Object.keys(seleccion).forEach(d => {
    (seleccion[d] || []).forEach(c => fichas.push({ dim: d, cat: c }));
  });
  if (!fichas.length) return null;
  return (
    <div className="dsh-seleccion">
      <b>Selección activa:</b>
      {fichas.map(f => (
        <button key={f.dim + '|' + f.cat} type="button" className="dsh-quitar"
          onClick={() => quitar(f.dim, f.cat)}>
          {cortoDim(f.dim)}: {f.cat}
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="dsh-limpiar-sel" onClick={limpiar}>Quitar todo</button>
    </div>
  );
}

/** Búsqueda por texto con lista de sugerencias, para dimensiones con cientos de categorías. */
function CampoBuscar({ dim, Q, seleccion, fijar }) {
  const vigentes = Q.opciones(dim);
  const elegida = (seleccion[dim] || [])[0] || '';
  const [texto, setTexto] = useState(elegida);
  useEffect(() => { setTexto(elegida); }, [elegida]);
  const cambiar = e => {
    const t = e.target.value;
    setTexto(t);
    if (!t) fijar(dim, []);
    else if (vigentes.indexOf(t) >= 0) fijar(dim, [t]);
  };
  const id = 'sugerencias-' + dim;
  return (
    <React.Fragment>
      <input type="text" className="dsh-select dsh-buscar" list={id} value={texto} onChange={cambiar}
        placeholder={'Todas las asignaturas: ' + fEnt.format(vigentes.length) + '. Escriba el nombre o el código'}
        autoComplete="off" spellCheck="false" />
      <datalist id={id}>
        {vigentes.map(c => <option key={c} value={c} />)}
      </datalist>
    </React.Fragment>
  );
}

function Filtros({ filtros, seleccion, fijar, limpiar, Q }) {
  const unico = dim => {
    if (dim === 'asignatura') return <CampoBuscar dim={dim} Q={Q} seleccion={seleccion} fijar={fijar} />;
    const vigentes = Q.opciones(dim);
    const elegida = (seleccion[dim] || [])[0];
    const lista = elegida && vigentes.indexOf(elegida) < 0 ? [elegida].concat(vigentes) : vigentes;
    return (
      <select className="dsh-select" value={elegida || ''}
        onChange={e => fijar(dim, e.target.value ? [e.target.value] : [])}>
        <option value="">Todas ({lista.length})</option>
        {lista.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  };
  return (
    <section className="dsh-filtros" aria-label="Filtros">
      <div className={'dsh-grid-f f-' + (filtros.length > 4 ? 5 : filtros.length > 3 ? 4 : 3)}>
        {filtros.map(d => (
          <div className={'dsh-campo' + (d === 'asignatura' ? ' ancho' : '')} key={d}>
            <span className="dsh-leyenda">{FIL[d]}</span>
            {unico(d)}
          </div>
        ))}
      </div>
      <div className="dsh-acciones">
        <button className="dsh-btn" type="button" onClick={limpiar}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z" />
          </svg>
          Borrar los filtros
        </button>
      </div>
    </section>
  );
}

/* ==================================================================== */
/*  Aplicación                                                           */
/* ==================================================================== */

const COLOR = { verde: '#677d29', ocre: '#EAAD13', gris: '#464646', lima: '#A9D12C', neutro: '#a2a3a4', negro: '#1D1D1B' };
const COL_TIP = [COLOR.gris, COLOR.ocre, COLOR.lima, COLOR.verde, COLOR.neutro];
const ejePct = v => v + '%';
const ES_VICE = n => /^(Vicedecanatura|Dirección)/.test(n);
const SIN_ASIG = 'Docente ocasional';

function pick(sel, claves) {
  const o = {};
  claves.forEach(k => { if (sel[k] && sel[k].length) o[k] = sel[k]; });
  return o;
}

function App() {
  const [tab, setTab] = useState(0);
  const sec = SECCIONES[tab];
  const [seleccion, setSeleccion] = useState({});
  const [medidaEv, setMedidaEv] = useState('ini');
  const refsTab = useRef([]);
  const sel = pick(seleccion, sec.filtros);
  const firma = JSON.stringify(sel) + '|' + tab;
  const QT = useMemo(() => {
    const o = {};
    Object.keys(TB).forEach(k => { o[k] = crearConsulta(sel, TB[k]); });
    return o;
  }, [firma]);
  const Q = QT[sec.tabla];

  const fijar = useCallback((dim, valores) => {
    setSeleccion(s => {
      const n = Object.assign({}, s);
      if (!valores || !valores.length) delete n[dim]; else n[dim] = valores;
      return n;
    });
  }, []);
  const alternar = useCallback((dim, categoria) => {
    setSeleccion(s => {
      const n = Object.assign({}, s);
      const actual = (n[dim] || []).slice();
      const i = actual.indexOf(categoria);
      if (i >= 0) actual.splice(i, 1); else actual.push(categoria);
      if (!actual.length) delete n[dim]; else n[dim] = actual;
      return n;
    });
  }, []);
  const teclas = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : SECCIONES.length - 1)) % SECCIONES.length;
    setTab(n);
    if (refsTab.current[n]) refsTab.current[n].focus();
  };
  useEffect(() => {
    const raiz = document.getElementById('root');
    if (raiz) raiz.dataset.montado = '1';
  }, []);

  const nSede = IDX('facultad', 'Sede Medellín');
  const nPeriodo = PER.length;
  const PU = PER.indexOf('2026-1S');     // último semestre con asignación de docentes completa
  const P_ULT = PER.indexOf('2026-2S');

  /* ---------------------------------------------- utilidades de gráficos */
  const serieP = (nombre, color, datos, extra) => Object.assign({ nombre, color, datos, extra }, {});
  const etq = (fmt, color, pos) => ({ label: { show: true, position: pos || 'top', fontSize: 9, color: color || '#242627',
    formatter: p => (vacio(p.value) ? '' : fmt(p.value)) } });
  const graficoPeriodos = (series, o) => {
    o = o || {};
    const op = opcionPeriodos(PER, series.map(s => ({ nombre: s.nombre, color: s.color, datos: s.datos,
      extra: o.etiquetas ? etq(o.fmt, s.colorEtq, o.apilado ? 'inside' : 'top') : undefined })),
      { formatoEje: o.fmtEje || (o.pct ? ejePct : undefined), nombreEje: o.nombreEje, apilado: o.apilado,
        formatoTooltip: v => (vacio(v) ? 'Sin dato' : o.fmt(v)) });
    if (!o.apilado) op.series.forEach(s => { s.barMaxWidth = series.length > 1 ? 22 : 34; });
    return { opcion: op,
      csv: () => ({ encabezados: ['Período'].concat(series.map(s => s.nombre)),
        filas: PER.map((p, i) => [p].concat(series.map(s => s.datos[i]))) }) };
  };
  const graficoUab = (items, series, o) => {
    const nombres = items.map(g => g.nombre);
    const op = opcionCategorias(nombres, series.map(s => ({ nombre: s.nombre, color: s.color, datos: items.map(g => s.f(g)) })),
      { formatoEje: o.fmtEje, formatoTooltip: v => (vacio(v) ? 'Sin dato' : o.fmt(v)), etiquetas: true, fmtEtiqueta: v => o.fmt(v), pct: o.pct });
    op.series.forEach(s => { s.barMaxWidth = series.length > 1 ? 14 : 18; s.barGap = '8%'; });
    const lineas = series.length > 1 ? 1.15 : 0.8;
    return { opcion: op, altoLienzo: nombres.length > 5 ? 90 + nombres.length * (series.length > 2 ? 64 : series.length > 1 ? 50 : 32) : null,
      csv: () => ({ encabezados: ['Unidad académica básica'].concat(series.map(s => s.nombre)),
        filas: items.map(g => [g.nombre].concat(series.map(s => s.f(g)))) }),
      alSeleccionar: n => alternar('uab', n) };
  };
  /* Agrega medidas por UAB en dos ventanas de periodos, promedio por semestre. */
  const porUabVentanas = (T, filas, medidas, va, vb) => {
    const m = {};
    const U = T.col.uab, P = T.col.periodo;
    filas.forEach(i => {
      const w = va.indexOf(P[i]) >= 0 ? 'a' : vb.indexOf(P[i]) >= 0 ? 'b' : null;
      if (!w) return;
      const k = U[i];
      m[k] = m[k] || { a: {}, b: {} };
      medidas.forEach(d => { m[k][w][d] = (m[k][w][d] || 0) + T.col[d][i]; });
    });
    return Object.keys(m).map(k => ({ nombre: C.uab[k], a: m[k].a, b: m[k].b }))
      .filter(g => !ES_VICE(g.nombre) && g.nombre !== 'Sin dato');
  };

  /* ================================================== 1. Oferta de cupos */
  const s1 = useMemo(() => {
    const T = TB.oferta, QQ = QT.oferta;
    const iO = IDX('obligatoria', 'Obligatoria'), iN = IDX('obligatoria', 'No obligatoria');
    const cO = i => T.col.obligatoria[i] === iO, cN = i => T.col.obligatoria[i] === iN;
    const dO = porPeriodo(T, QQ.filas, fs => sumar(T, fs, 'cupos', cO));
    const dN = porPeriodo(T, QQ.filas, fs => sumar(T, fs, 'cupos', cN));
    const cupos = graficoPeriodos([serieP('Asignaturas obligatorias', COLOR.verde, dO), serieP('Otras asignaturas', COLOR.ocre, dN)],
      { apilado: true, etiquetas: true, fmt: v => num(v), nombreEje: 'Cupos ofertados' });
    cupos.opcion.series[0].label.color = '#ffffff';
    cupos.opcion.series[1].label.color = '#242627';

    /* Sede completa, sin filtros */
    const todo = Array.from({ length: T.n }, (_, i) => i);
    const tot = porPeriodo(T, todo, fs => sumar(T, fs, 'cupos'));
    const cpe = tot.map((v, p) => (v && MAT[p] ? v / MAT[p] : null));
    const porEst = graficoPeriodos([serieP('Cupos por estudiante matriculado', COLOR.gris, cpe)],
      { etiquetas: true, fmt: v => dec(v), nombreEje: 'Cupos por estudiante' });

    /* Variación de cupos en obligatorias por UAB */
    const filasO = QQ.filtrar('obligatoria').filter(cO);
    const us = porUabVentanas(T, filasO, ['cupos', 'asig'], VA, VB)
      .map(g => ({ nombre: g.nombre, ca: (g.a.cupos || 0) / 2, cb: (g.b.cupos || 0) / 2, aa: (g.a.asig || 0) / 2, ab: (g.b.asig || 0) / 2 }))
      .filter(g => g.ca >= 200).map(g => Object.assign(g, { vc: razon(g.cb - g.ca, g.ca), va: razon(g.ab - g.aa, g.aa) }))
      .sort((a, b) => a.vc - b.vc);
    const varUab = graficoUab(us, [{ nombre: 'Variación de los cupos en obligatorias', color: COLOR.ocre, f: g => g.vc }],
      { fmt: v => sgn(v), fmtEje: v => v + '%' });
    varUab.opcion.series[0].itemStyle = { color: p => (p.value < 0 ? COLOR.ocre : COLOR.gris) };
    varUab.opcion.xAxis.max = null;

    const sa = sumar(T, filasO.filter(enVentana(T, VA)), 'cupos') / 2, sb = sumar(T, filasO.filter(enVentana(T, VB)), 'cupos') / 2;
    const sTa = sumar(T, QQ.filas.filter(enVentana(T, VA)), 'cupos') / 2, sTb = sumar(T, QQ.filas.filter(enVentana(T, VB)), 'cupos') / 2;
    return { cupos, porEst, varUab, us, vObl: razon(sb - sa, sa), vTot: razon(sTb - sTa, sTa), tot, cpe };
  }, [QT]);

  /* ============================================ 2. Docentes ocasionales */
  const s2 = useMemo(() => {
    const T = TB.docentes, TG = TB.grupos, QD = QT.docentes, QG = QT.grupos;
    const nombresTip = C.tipologia;
    const tipD = k => i => T.col.tipologia[i] === k;
    const sD = nombresTip.map((n, k) => serieP(n, COL_TIP[k], porPeriodo(T, QD.filas, fs => sumar(T, fs, 'docentes', tipD(k))).map(v => v || 0)));
    const docs = graficoPeriodos(sD, { apilado: true, etiquetas: true, fmt: v => num(v), nombreEje: 'Docentes ocasionales' });
    docs.opcion.series.forEach((s, i) => { s.label.color = (i === 0 || i === 3) ? '#ffffff' : '#242627'; if (s.data.every(v => v < 8)) s.label.show = false; });
    const sV = nombresTip.map((n, k) => serieP(n, COL_TIP[k], porPeriodo(T, QD.filas, fs => sumar(T, fs, 'valor', tipD(k))).map(v => v || 0)));
    const valor = graficoPeriodos(sV, { apilado: true, fmt: v => num(v), nombreEje: 'Millones de pesos corrientes' });

    /* Participación en grupos y cupos */
    const iOc = IDX('docente', 'Docente ocasional');
    const cOc = i => TG.col.docente[i] === iOc;
    const ocCup = porPeriodo(TG, QG.filas, fs => sumar(TG, fs, 'cupos', cOc));
    const ocCupT = porPeriodo(TG, QG.filas, fs => sumar(TG, fs, 'cupos_t', cOc));
    const totCup = porPeriodo(TG, QG.filas, fs => sumar(TG, fs, 'cupos'));
    const ocGr = porPeriodo(TG, QG.filas, fs => sumar(TG, fs, 'grupos', cOc));
    const totGr = porPeriodo(TG, QG.filas, fs => sumar(TG, fs, 'grupos'));
    const mask = (arr) => arr.map((v, p) => (p === P_ULT ? null : v));
    const pCup = mask(ocCup.map((v, p) => (totCup[p] ? razon(v, totCup[p]) : null)));
    const pGr = mask(ocGr.map((v, p) => (totGr[p] ? razon(v, totGr[p]) : null)));
    const part = graficoPeriodos([serieP('Cupos', COLOR.verde, pCup), serieP('Grupos', COLOR.ocre, pGr)],
      { etiquetas: true, fmt: v => pct(v, 1), fmtEje: ejePct, nombreEje: 'Participación de los docentes ocasionales' });

    /* Valor por cupo dictado */
    const valTot = porPeriodo(T, QD.filas, fs => sumar(T, fs, 'valor'));
    const vpc = mask(valTot.map((v, p) => (ocCupT[p] ? v * 1000 / ocCupT[p] : null)));
    const valCupo = graficoPeriodos([serieP('Valor por cupo dictado por docentes ocasionales', COLOR.ocre, vpc)],
      { etiquetas: true, fmt: v => num(v), nombreEje: 'Miles de pesos corrientes por cupo' });
    valCupo.opcion.tooltip.formatter = ps => '<b>' + ps[0].axisValueLabel + '</b><br/>' + (vacio(ps[0].value) ? 'Sin dato' :
      'Valor por cupo: ' + num(ps[0].value) + ' mil pesos<br/>Cupos dictados: ' + num(ocCupT[ps[0].dataIndex]));

    /* Peso por UAB */
    const filasU = QG.filtrar(null);
    const us = porUabVentanas(TG, filasU, ['cupos'], VA, VB);
    const peso = {};
    const accum = (w, cond) => TG.col.uab; // marcador
    const mO = {};
    filasU.forEach(i => {
      const p = TG.col.periodo[i]; const w = VA.indexOf(p) >= 0 ? 'a' : VB.indexOf(p) >= 0 ? 'b' : null;
      if (!w) return;
      const k = C.uab[TG.col.uab[i]]; mO[k] = mO[k] || { a: 0, b: 0, ta: 0, tb: 0 };
      mO[k]['t' + w] += TG.col.cupos[i]; if (cOc(i)) mO[k][w] += TG.col.cupos[i];
    });
    const lista = Object.keys(mO).filter(k => !ES_VICE(k) && k !== 'Sin dato' && mO[k].tb / 2 >= 500)
      .map(k => ({ nombre: k, a: razon(mO[k].a, mO[k].ta), b: razon(mO[k].b, mO[k].tb) }))
      .sort((x, y) => y.b - x.b);
    const pesoU = graficoUab(lista, [
      { nombre: 'Cupos dictados por docentes ocasionales, ' + NOM_VA, color: COLOR.verde, f: g => g.a },
      { nombre: 'Cupos dictados por docentes ocasionales, ' + NOM_VB, color: COLOR.ocre, f: g => g.b }],
      { fmt: v => pct(v, 0), fmtEje: ejePct, pct: true });
    const docUlt = sumar(T, QD.filas.filter(i => T.col.periodo[i] === P_ULT), 'docentes');
    const docObl = sumar(T, QD.filas.filter(i => T.col.periodo[i] === P_ULT && T.col.tipologia[i] === 0), 'docentes');
    const valUlt = valTot[P_ULT];
    return { docs, valor, part, valCupo, pesoU, docUlt, docObl, valUlt, pCup, vpc, ocCup, valTot };
  }, [QT]);

  /* ============================================== 3. Grupos y ocupación */
  const s3 = useMemo(() => {
    const T = TB.grupos, QQ = QT.grupos;
    const iOc = IDX('docente', 'Docente ocasional'), iOt = IDX('docente', 'Otros docentes');
    const cOc = i => T.col.docente[i] === iOc, cOt = i => T.col.docente[i] === iOt;
    const mask = arr => arr.map((v, p) => (p === P_ULT ? null : v));
    const med = (cond, f) => mask(porPeriodo(T, QQ.filas, fs => f(fs, cond)));
    const g = cond => fs => sumar(T, fs, 'grupos', cond);
    const cupGr = c => med(c, (fs, cd) => razon(sumar(T, fs, 'cupos', cd), sumar(T, fs, 'grupos', cd), 1));
    const insGr = c => med(c, (fs, cd) => razon(sumar(T, fs, 'ins', cd), sumar(T, fs, 'grupos', cd), 1));
    const ocu = c => med(c, (fs, cd) => razon(sumar(T, fs, 'ins', cd), sumar(T, fs, 'cupos', cd)));
    const peq = c => med(c, (fs, cd) => razon(sumar(T, fs, 'peq', cd), sumar(T, fs, 'grupos', cd)));
    const dos = (fn, fmt, nombreEje, ext) => graficoPeriodos([serieP('Docentes ocasionales', COLOR.ocre, fn(cOc)), serieP('Otros docentes', COLOR.gris, fn(cOt))],
      Object.assign({ etiquetas: true, fmt, nombreEje }, ext || {}));
    const cupos = dos(cupGr, v => dec(v), 'Cupos por grupo');
    const inscr = dos(insGr, v => dec(v), 'Inscritos por grupo');
    const ocup = dos(ocu, v => pct(v, 0), 'Ocupación de los cupos', { fmtEje: ejePct });
    const pequ = dos(peq, v => pct(v, 0), 'Grupos con menos de 10 inscritos', { fmtEje: ejePct });

    /* Detalle por UAB, semestre 2026-1S */
    const fU = QQ.filas.filter(i => T.col.periodo[i] === PU);
    const m = {};
    fU.forEach(i => {
      const k = T.col.uab[i]; m[k] = m[k] || { g: 0, c: 0, n: 0, gO: 0, cO: 0, nO: 0, pO: 0, pT: 0 };
      const r = m[k]; r.g += T.col.grupos[i]; r.c += T.col.cupos[i]; r.n += T.col.ins[i]; r.pT += T.col.peq[i];
      if (cOc(i)) { r.gO += T.col.grupos[i]; r.cO += T.col.cupos[i]; r.nO += T.col.ins[i]; r.pO += T.col.peq[i]; }
    });
    const filas = Object.keys(m).map(k => Object.assign({ nombre: C.uab[k] }, m[k]))
      .filter(r => r.nombre !== 'Sin dato').map(r => Object.assign(r, { ocu: razon(r.n, r.c), pc: razon(r.cO, r.c), pq: razon(r.pT, r.g) }));
    const tot = ((fs) => ({ g: sumar(T, fs, 'grupos'), c: sumar(T, fs, 'cupos'), n: sumar(T, fs, 'ins'), gO: sumar(T, fs, 'grupos', cOc), cO: sumar(T, fs, 'cupos', cOc),
      nO: sumar(T, fs, 'ins', cOc), pO: sumar(T, fs, 'peq', cOc), pT: sumar(T, fs, 'peq') }))(fU);
    const gOtros = tot.g - tot.gO;
    return { cupos, inscr, ocup, pequ, filas, tot, gOtros };
  }, [QT]);

  /* ===================================================== 4. Oferta de 2026-2S */
  const s4 = useMemo(() => {
    const T = TB.oferta26, QQ = QT.oferta26;
    const col = T.col, F = QQ.filas;
    const S = (m, c) => sumar(T, F, m, c);
    const iL = IDX('estado', 'Lleno'), iC = IDX('estado', 'Con cupos'), iP = IDX('estado', 'Menos de 10');
    const cap19 = S('cap19'), cap12 = S('cap12'), cnue = S('cnue'), ampl = S('ampl'), redu = S('redu'), ccer = S('ccer');

    const nombres = ['Oferta al 19 de agosto', 'Grupos nuevos', 'Ampliación de grupos', 'Reducción de grupos', 'Grupos cerrados', 'Oferta al 12 de septiembre'];
    const vals = [cap19, cnue, ampl, -redu, -ccer, cap12];
    const op = opcionCategorias(nombres, [{ nombre: 'Cupos', color: COLOR.verde, datos: vals }],
      { formatoTooltip: v => num(v), etiquetas: true, fmtEtiqueta: v => (v > 0 && vals.indexOf(v) > 0 && vals.indexOf(v) < 5 ? '+' : '') + num(v) });
    op.series[0].data = vals.map((v, i) => ({ value: v, itemStyle: { color: (i === 0 || i === 5) ? COLOR.gris : v >= 0 ? COLOR.verde : COLOR.neutro } }));
    op.series[0].barMaxWidth = 22;
    const cambio = { opcion: op, csv: () => ({ encabezados: ['Concepto', 'Cupos'], filas: nombres.map((n, i) => [n, vals[i]]) }) };

    /* por UAB */
    const m = {};
    F.forEach(i => {
      const k = col.uab[i]; m[k] = m[k] || { c19: 0, c12: 0, mat: 0, disp: 0, i29: 0, g12: 0, L: 0, Cc: 0, P: 0 };
      const r = m[k]; r.c19 += col.cap19[i]; r.c12 += col.cap12[i]; r.mat += col.mat12[i]; r.disp += col.disp[i]; r.i29 += col.ins29e[i]; r.g12 += col.g12[i];
      if (col.estado[i] === iL) r.L += col.g12[i]; if (col.estado[i] === iC) r.Cc += col.g12[i]; if (col.estado[i] === iP) r.P += col.g12[i];
    });
    const us = Object.keys(m).map(k => Object.assign({ nombre: C.uab[k] }, m[k])).filter(r => r.nombre !== 'Sin dato' && !ES_VICE(r.nombre))
      .map(r => Object.assign(r, { add: r.c12 - r.c19, addp: razon(r.c12 - r.c19, r.c19), oi: razon(r.i29, r.c19), of: razon(r.mat, r.c12),
        gg: r.L + r.Cc + r.P, pl: razon(r.L, r.L + r.Cc + r.P), pc: razon(r.Cc, r.L + r.Cc + r.P), pp: razon(r.P, r.L + r.Cc + r.P) }));
    const mayores = us.filter(r => r.c12 >= 500).sort((a, b) => b.add - a.add);
    const anadidos = graficoUab(mayores, [
      { nombre: 'Cupos añadidos entre el 19 de agosto y el 12 de septiembre', color: COLOR.verde, f: r => r.add },
      { nombre: 'Cupos libres al 12 de septiembre', color: COLOR.ocre, f: r => r.disp }],
      { fmt: v => num(v), fmtEje: v => num(v) });
    const ocup = graficoUab(mayores.slice().sort((a, b) => b.of - a.of), [
      { nombre: 'Cierre de la jornada regular', color: COLOR.verde, f: r => r.oi },
      { nombre: 'Corte final', color: COLOR.ocre, f: r => r.of }],
      { fmt: v => pct(v, 0), fmtEje: ejePct });

    /* estado de los grupos */
    const est = (cond) => { const L = S('g12', i => cond(i) && col.estado[i] === iL), Cc = S('g12', i => cond(i) && col.estado[i] === iC), P = S('g12', i => cond(i) && col.estado[i] === iP), t = L + Cc + P;
      return [razon(L, t), razon(Cc, t), razon(P, t), t]; };
    const iOc = IDX('docente', 'Docente ocasional'), iOt = IDX('docente', 'Otros docentes'), iOb = IDX('obligatoria', 'Obligatoria'), iNo = IDX('obligatoria', 'No obligatoria');
    const cats = [['Todos los grupos', () => true], ['Docentes ocasionales', i => col.docente[i] === iOc], ['Otros docentes', i => col.docente[i] === iOt],
      ['Asignaturas obligatorias', i => col.obligatoria[i] === iOb], ['Otras asignaturas', i => col.obligatoria[i] === iNo]];
    const rs = cats.map(c => est(c[1]));
    const op2 = opcionCategorias(cats.map(c => c[0]), [
      { nombre: 'Lleno', color: COLOR.verde, datos: rs.map(r => r[0] || 0) },
      { nombre: 'Con cupos', color: COLOR.lima, datos: rs.map(r => r[1] || 0) },
      { nombre: 'Menos de 10 matriculados', color: COLOR.ocre, datos: rs.map(r => r[2] || 0) }],
      { apilado: true, pct: true, formatoEje: ejePct, formatoTooltip: v => pct(v) });
    op2.series.forEach(s => { s.label = { show: true, position: 'inside', fontSize: 9, color: '#242627', formatter: p => (p.value >= 5 ? pct(p.value, 0) : '') }; });
    op2.series[0].label.color = '#ffffff';
    const estados = { opcion: op2, csv: () => ({ encabezados: ['Grupos', 'Lleno', 'Con cupos', 'Menos de 10 matriculados', 'Grupos con 5 cupos o más'],
      filas: cats.map((c, i) => [c[0]].concat(rs[i])) }) };
    const gr = us.filter(r => r.gg >= 25).sort((a, b) => b.pl - a.pl);
    const estUab = graficoUab(gr, [
      { nombre: 'Lleno', color: COLOR.verde, f: r => r.pl }, { nombre: 'Menos de 10 matriculados', color: COLOR.ocre, f: r => r.pp }],
      { fmt: v => pct(v, 0), fmtEje: ejePct, pct: true });
    const oi = razon(S('ins29e'), cap19), of = razon(S('mat12'), cap12);
    return { cambio, anadidos, ocup, estados, estUab, cap19, cap12, cnue, disp: S('disp'), nue: S('nue'), oi, of, rs };
  }, [QT]);

  /* ================================================ 5. Cancelación y pérdida */
  const s5 = useMemo(() => {
    const T = TB.oferta, QQ = QT.oferta, TP = TB.perdida, QP = QT.perdida;
    const iO = IDX('obligatoria', 'Obligatoria'), iS = IDX('servicio', 'De servicio');
    const cnl = (cond) => porPeriodo(T, QQ.filas, fs => razon(sumar(T, fs, 'can', cond), sumar(T, fs, 'ini', cond))).map((v, p) => (p >= 1 && p <= 7 ? v : null));
    const sC = [serieP('Toda la oferta', COLOR.gris, cnl()), serieP('Asignaturas obligatorias', COLOR.verde, cnl(i => T.col.obligatoria[i] === iO)),
      serieP('Asignaturas de servicio', COLOR.ocre, cnl(i => T.col.servicio[i] === iS))];
    const cancel = graficoPeriodos(sC, { etiquetas: true, fmt: v => dec(v), nombreEje: 'Cancelaciones por cada 100 inscritos iniciales' });
    cancel.opcion.series.forEach(s => { s.label.fontSize = 9; });

    const TD = TB.docentes;
    const todoD = Array.from({ length: TD.n }, (_, i) => i);
    const valTot = porPeriodo(TD, todoD, fs => sumar(TD, fs, 'valor'));
    const vpe = valTot.map((v, p) => (v && MAT[p] ? v * 1000 / MAT[p] : null));
    const valEst = graficoPeriodos([serieP('Valor por estudiante matriculado', COLOR.ocre, vpe)],
      { etiquetas: true, fmt: v => num(v), nombreEje: 'Miles de pesos corrientes por estudiante' });

    /* cancelación por UAB */
    const VB2 = [6, 7];
    const us = porUabVentanas(T, QQ.filas, ['can', 'ini'], VA, VB2)
      .filter(g => (g.a.ini || 0) >= 600)
      .map(g => ({ nombre: g.nombre, ra: razon(g.a.can || 0, g.a.ini), rb: razon(g.b.can || 0, g.b.ini || 0), nb: g.b.ini || 0 }))
      .filter(g => g.rb !== null).sort((x, y) => y.rb - x.rb);
    const canUab = graficoUab(us, [
      { nombre: 'Cancelación, ' + NOM_VA, color: COLOR.verde, f: g => g.ra },
      { nombre: 'Cancelación, 2025-1S y 2025-2S', color: COLOR.ocre, f: g => g.rb }],
      { fmt: v => dec(v), fmtEje: v => v + '%' });

    /* pérdida */
    const iOc = IDX('docente', 'Docente ocasional'), iOt = IDX('docente', 'Otros docentes'), iM = IDX('mismaasig', 'Misma asignatura');
    const perd = (cd, extra) => porPeriodo(TP, QP.filas, fs => { const f2 = extra ? fs.filter(extra) : fs; return razon(sumar(TP, f2, 'perd', cd), sumar(TP, f2, 'n', cd)); });
    const cOc = i => TP.col.docente[i] === iOc, cOt = i => TP.col.docente[i] === iOt;
    const mism = i => TP.col.mismaasig[i] === iM;
    const pAll = [serieP('Docentes ocasionales', COLOR.ocre, perd(cOc)), serieP('Otros docentes', COLOR.gris, perd(cOt))];
    const pMis = [serieP('Docentes ocasionales', COLOR.ocre, perd(cOc, mism)), serieP('Otros docentes', COLOR.gris, perd(cOt, mism))];
    const perdida = graficoPeriodos(pAll, { etiquetas: true, fmt: v => dec(v), nombreEje: 'Tasa de pérdida (%)' });
    const perdidaM = graficoPeriodos(pMis, { etiquetas: true, fmt: v => dec(v), nombreEje: 'Tasa de pérdida (%)' });
    [perdida, perdidaM].forEach(g => g.opcion.series.forEach(s => { s.label.fontSize = 9; }));
    return { cancel, valEst, canUab, perdida, perdidaM, sC, vpe, pAll, pMis };
  }, [QT]);

  /* ================================================ 6. Evolución de resultados académicos */
  const s6 = useMemo(() => {
    const T = TB.evol, filas = QT.evol.filas;
    const PE = PER.slice(0, NP_EV);
    const ini = [], can = [], fin = [], nOf = [];
    for (let p = 0; p < NP_EV; p++) {
      const ci = T.col['ini' + p], cc = T.col['can' + p];
      let a = 0, c = 0, n = 0;
      for (let j = 0; j < filas.length; j++) {
        const i = filas[j];
        if (ci[i] >= 0) { a += ci[i]; c += Math.max(cc[i], 0); n++; }
      }
      ini.push(n ? a : null); can.push(n ? c : null); fin.push(n ? a - c : null); nOf.push(n);
    }
    const tasa = ini.map((a, p) => (a ? 100 * can[p] / a : null));
    const lineas = (series, nombreEje, desdeCero) => {
      const op = opcionPeriodos(PE, series.map(s => ({ nombre: s.nombre, color: s.color, datos: s.datos, tipo: 'line',
        extra: { smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 2.6, color: s.color },
          label: { show: true, position: s.pos, fontSize: 9, color: '#242627', distance: 8,
            formatter: q => (vacio(q.value) ? '' : num(q.value)) } } })),
        { formatoEje: v => fEnt.format(v), nombreEje, todas: true,
          formatoTooltip: v => (vacio(v) ? 'Sin dato' : num(v)) });
      /* Eje con marcas redondas, sin valores negativos y con holgura para las etiquetas. */
      const vals = [].concat.apply([], series.map(s => s.datos)).filter(v => !vacio(v));
      if (vals.length) {
        const lo = desdeCero ? 0 : Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        const rango = Math.max(hi - lo, Math.abs(hi) * 0.1, 4);
        const aprox = rango * 1.3 / 5, mag = Math.pow(10, Math.floor(Math.log10(aprox)));
        const paso = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(x => x >= aprox));
        op.yAxis.interval = paso;
        op.yAxis.min = desdeCero ? 0 : Math.max(0, Math.floor((lo - rango * 0.18) / paso) * paso);
        op.yAxis.max = Math.ceil((hi + rango * 0.18) / paso) * paso;
      }
      return { opcion: op,
        csv: () => ({ encabezados: ['Semestre'].concat(series.map(s => s.nombre)),
          filas: PE.map((q, p) => [q].concat(series.map(s => s.datos[p]))) }) };
    };
    const gA = lineas([
      { nombre: 'Inscritos iniciales', color: COLOR.gris, datos: ini, pos: 'top' },
      { nombre: 'Matrícula final', color: COLOR.lima, datos: fin, pos: 'bottom' }], 'Estudiantes');
    const gB = lineas([{ nombre: 'Cancelaciones', color: COLOR.ocre, datos: can, pos: 'top' }], 'Cancelaciones', true);
    const colsP = [
      { tit: 'Semestre', fija: true, val: f => f.q, txt: f => f.q },
      { tit: 'Asignaturas ofrecidas', num: 1, val: f => f.n, txt: f => num(f.n) },
      { tit: 'Inscritos iniciales', num: 1, val: f => f.a, txt: f => num(f.a) },
      { tit: 'Cancelaciones', num: 1, val: f => f.c, txt: f => num(f.c) },
      { tit: 'Matrícula final', num: 1, val: f => f.m, txt: f => num(f.m) },
      { tit: 'Porcentaje de cancelación', num: 1, val: f => f.t, txt: f => pct(f.t) }
    ];
    const filasP = PE.map((q, p) => ({ q, n: nOf[p], a: ini[p], c: can[p], m: fin[p], t: tasa[p] }));
    return { ini, can, fin, tasa, gA, gB, colsP, filasP, PE };
  }, [QT]);

  const MED_EV = { ini: 'Inscritos iniciales', can: 'Cancelaciones', fin: 'Matrícula final' };
  const filasA = useMemo(() => {
    const T = TB.evol;
    return QT.evol.filas.map(i => {
      const v = [];
      for (let p = 0; p < NP_EV; p++) {
        const a = T.col['ini' + p][i], c = Math.max(T.col['can' + p][i], 0);
        v.push(a < 0 ? null : medidaEv === 'ini' ? a : medidaEv === 'can' ? c : a - c);
      }
      return { nombre: C.asignatura[T.col.asignatura[i]], uab: C.uab[T.col.uab[i]], v };
    });
  }, [QT, medidaEv]);
  const colsA = [
    { tit: 'Asignatura', fija: true, izq: true, ancho: 300, val: f => f.nombre, txt: f => f.nombre },
    { tit: 'Unidad académica básica', izq: true, ancho: 170, val: f => f.uab, txt: f => f.uab }
  ].concat(PER.slice(0, NP_EV).map((q, p) => ({ tit: q, num: 1, val: f => f.v[p], txt: f => num(f.v[p]) })));
  const elegirAsignatura = f => {
    const actual = (seleccion.asignatura || [])[0];
    fijar('asignatura', actual === f.nombre ? [] : [f.nombre]);
  };

  /* ------------------------------------------------------------ tablas */
  const colsOferta = [
    { tit: 'Unidad académica básica', fija: true, val: f => f.nombre, txt: f => f.nombre },
    { tit: 'Asignaturas 2022-23', num: 1, val: f => f.aa, txt: f => num(f.aa) },
    { tit: 'Asignaturas 2025-26', num: 1, val: f => f.ab, txt: f => num(f.ab) },
    { tit: 'Variación de asignaturas', num: 1, val: f => f.va, txt: f => sgn(f.va) },
    { tit: 'Cupos 2022-23', num: 1, val: f => f.ca, txt: f => num(f.ca) },
    { tit: 'Cupos 2025-26', num: 1, val: f => f.cb, txt: f => num(f.cb) },
    { tit: 'Variación de cupos', num: 1, val: f => f.vc, txt: f => sgn(f.vc) }
  ];
  const colsGrupos = [
    { tit: 'Unidad académica básica', fija: true, val: f => f.nombre, txt: f => f.nombre },
    { tit: 'Grupos', num: 1, val: f => f.g, txt: f => num(f.g) },
    { tit: 'Cupos', num: 1, val: f => f.c, txt: f => num(f.c) },
    { tit: 'Ocupación', num: 1, val: f => f.ocu, txt: f => pct(f.ocu) },
    { tit: 'Cupos con docentes ocasionales', num: 1, val: f => f.pc, txt: f => pct(f.pc) },
    { tit: 'Grupos con menos de 10 inscritos', num: 1, val: f => f.pq, txt: f => pct(f.pq) }
  ];

  const sinDatos = !Q.filas.length;
  const op = o => (sinDatos ? null : o);
  const arch = [sec.id];
  const tarjeta = (titulo, g, nombre, extra) => (
    <TarjetaGrafico titulo={titulo} opcion={op(g.opcion)} csv={g.csv}
      alSeleccionar={g.alSeleccionar} altoLienzo={g.altoLienzo}
      archivo={nombreArchivo(arch.concat([nombre]))} {...(extra || {})} />
  );
  const tablaTarjeta = (titulo, cols, filas, nombre, orden, clic) => (
    <Tarjeta titulo={titulo}
      accion={<Descargas csv={() => ({ encabezados: cols.map(c => c.tit),
        filas: filas.map(f => cols.map(c => c.val(f))) })}
        nombre={nombreArchivo(arch.concat([nombre]))} />}>
      <Tabla columnas={cols} filas={filas} ordenInicial={orden} alSeleccionar={clic} altura={400} />
    </Tarjeta>
  );

  const v = (x, p) => (x ? x[p] : null);
  const tarjetas = {
    oferta: [
      [IC.malla, 'var(--dsh-primary)', 'Cupos ofertados 2026-1S', num(v(s1.tot, PU) === null ? null : sumar(TB.oferta, QT.oferta.filas.filter(i => TB.oferta.col.periodo[i] === PU), 'cupos')), 'Con los filtros vigentes'],
      [IC.persona, 'var(--dsh-azul)', 'Estudiantes matriculados 2026-1S', num(MAT[PU]), 'Sede Medellín'],
      [IC.tasa, 'var(--dsh-punto)', 'Cupos por estudiante matriculado 2026-1S', dec(s1.cpe[PU]), dec(s1.cpe[0]) + ' en 2022-1S, Sede Medellín'],
      [IC.malla, 'var(--dsh-cancelada)', 'Variación de cupos en obligatorias', sgn(s1.vObl)],
      [IC.tasa, 'var(--dsh-aprobada)', 'Variación de cupos de toda la oferta', sgn(s1.vTot)]
    ],
    docentes: [
      [IC.persona, 'var(--dsh-primary)', 'Docentes ocasionales 2026-2S', num(s2.docUlt), 'Vinculados en el semestre'],
      [IC.doc, 'var(--dsh-azul)', 'En asignaturas obligatorias', pct(razon(s2.docObl, s2.docUlt)), num(s2.docObl) + ' docentes'],
      [IC.tasa, 'var(--dsh-aprobada)', 'Valor de la vinculación 2026-2S', num(s2.valUlt) + ' millones', 'Pesos corrientes'],
      [IC.malla, 'var(--dsh-cancelada)', 'Cupos dictados 2026-1S', pct(s2.pCup[PU]), 'De los cupos con grupos de 5 cupos o más'],
      [IC.tasa, 'var(--dsh-punto)', 'Valor por cupo dictado 2026-1S', num(s2.vpc[PU]) + ' mil', dec(s2.vpc[0], 0) + ' mil en 2022-1S']
    ],
    grupos: [
      [IC.malla, 'var(--dsh-primary)', 'Grupos 2026-1S', num(s3.tot.g), num(s3.tot.gO) + ' con docentes ocasionales'],
      [IC.tasa, 'var(--dsh-punto)', 'Cupos con docentes ocasionales', pct(s3.tot.c ? razon(s3.tot.cO, s3.tot.c) : null), num(s3.tot.cO) + ' cupos'],
      [IC.persona, 'var(--dsh-azul)', 'Cupos por grupo, docentes ocasionales', dec(razon(s3.tot.cO, s3.tot.gO, 1)), dec(razon(s3.tot.c - s3.tot.cO, s3.gOtros, 1)) + ' en los demás grupos'],
      [IC.tasa, 'var(--dsh-aprobada)', 'Ocupación, docentes ocasionales', pct(razon(s3.tot.nO, s3.tot.cO)), pct(razon(s3.tot.n - s3.tot.nO, s3.tot.c - s3.tot.cO)) + ' en los demás grupos'],
      [IC.circulo, 'var(--dsh-cancelada)', 'Grupos con menos de 10 inscritos', pct(razon(s3.tot.pO, s3.tot.gO)), pct(razon(s3.tot.pT - s3.tot.pO, s3.gOtros)) + ' en los demás grupos']
    ],
    oferta26: [
      [IC.malla, 'var(--dsh-primary)', 'Cupos al 19 de agosto', num(s4.cap19), 'Antes de las citas'],
      [IC.tasa, 'var(--dsh-punto)', 'Cupos al 12 de septiembre', num(s4.cap12), sgn(razon(s4.cap12 - s4.cap19, s4.cap19)) + ' frente al 19 de agosto'],
      [IC.doc, 'var(--dsh-azul)', 'Grupos nuevos', num(s4.nue), num(s4.cnue) + ' cupos'],
      [IC.tasa, 'var(--dsh-aprobada)', 'Ocupación al 12 de septiembre', pct(s4.of), pct(s4.oi) + ' al cierre de la jornada'],
      [IC.circulo, 'var(--dsh-cancelada)', 'Cupos libres', num(s4.disp), 'Al 12 de septiembre']
    ],
    cancelacion: [
      [IC.tasa, 'var(--dsh-primary)', 'Cancelación 2025-2S', pct(v(s5.sC[0].datos, 7)), 'Toda la oferta'],
      [IC.tasa, 'var(--dsh-aprobada)', 'Cancelación en servicio 2025-2S', pct(v(s5.sC[2].datos, 7)), pct(v(s5.sC[2].datos, 1)) + ' en 2022-2S'],
      [IC.persona, 'var(--dsh-azul)', 'Valor por estudiante 2026-1S', num(s5.vpe[PU]) + ' mil', num(s5.vpe[0]) + ' mil en 2022-1S, Sede'],
      [IC.circulo, 'var(--dsh-cancelada)', 'Pérdida, docentes ocasionales 2026-1S', pct(s5.pAll[0].datos[PU]), pct(s5.pAll[1].datos[PU]) + ' con otros docentes'],
      [IC.malla, 'var(--dsh-punto)', 'Pérdida en la misma asignatura 2026-1S', pct(s5.pMis[0].datos[PU]), pct(s5.pMis[1].datos[PU]) + ' con otros docentes']
    ],
    evolucion: [
      [IC.persona, 'var(--dsh-primary)', 'Inscritos iniciales 2026-1S', num(s6.ini[NP_EV - 1])],
      [IC.circulo, 'var(--dsh-cancelada)', 'Cancelaciones 2026-1S', num(s6.can[NP_EV - 1])],
      [IC.doc, 'var(--dsh-azul)', 'Matrícula final 2026-1S', num(s6.fin[NP_EV - 1])],
      [IC.tasa, 'var(--dsh-punto)', 'Porcentaje de cancelación 2026-1S', pct(s6.tasa[NP_EV - 1])],
      [IC.malla, 'var(--dsh-aprobada)', 'Variación de la matrícula final desde 2022-1S',
        sgn(vacio(s6.fin[NP_EV - 1]) || vacio(s6.fin[0]) ? null : razon(s6.fin[NP_EV - 1] - s6.fin[0], s6.fin[0]))]
    ]
  }[sec.id];

  return (
    <React.Fragment>
      <div className="dsh-tabs" role="tablist" aria-label="Secciones del tablero">
        {SECCIONES.map((p, i) => (
          <button key={p.id} ref={el => (refsTab.current[i] = el)}
            className="dsh-tab" role="tab" id={'tab-' + p.id}
            aria-controls={'panel-' + p.id} aria-selected={i === tab}
            onClick={() => setTab(i)} onKeyDown={e => teclas(e, i)}>
            {p.rotulo}
          </button>
        ))}
      </div>

      <Filtros filtros={sec.filtros} seleccion={sel} fijar={fijar} limpiar={() => setSeleccion({})} Q={Q} />
      <Seleccion seleccion={sel} quitar={alternar} limpiar={() => setSeleccion({})} />

      <section className="dsh-kpis" aria-label="Indicadores">
        {tarjetas.map((t, i) => (
          <Kpi key={i} icono={t[0]} fondo={t[1]} etiqueta={t[2]} valor={t[3]} />
        ))}
      </section>

      <div id={'panel-' + sec.id} role="tabpanel" aria-labelledby={'tab-' + sec.id}>
        {sec.id === 'oferta' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Cupos ofertados por semestre', s1.cupos, 'cupos')}
              {tarjeta('Cupos ofertados por estudiante matriculado en la Sede Medellín', s1.porEst, 'cupos-por-estudiante')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Variación de los cupos en asignaturas obligatorias por UAB, ' + NOM_VB + ' frente a ' + NOM_VA, s1.varUab, 'variacion-uab')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tablaTarjeta('Detalle de las asignaturas obligatorias por UAB, promedio por semestre de 2022-23 con ' + NOM_VA + ' y de 2025-26 con ' + NOM_VB, colsOferta, s1.us, 'detalle-uab',
                { col: 4, asc: false }, f => alternar('uab', f.nombre))}
            </div>
          </React.Fragment>
        ) : null}

        {sec.id === 'docentes' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Docentes ocasionales según la tipología predominante de sus asignaturas', s2.docs, 'docentes')}
              {tarjeta('Valor de la vinculación según la tipología de las asignaturas, en millones de pesos', s2.valor, 'valor')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Participación de los docentes ocasionales en los grupos y en los cupos', s2.part, 'participacion')}
              {tarjeta('Valor por cupo dictado por docentes ocasionales, en miles de pesos', s2.valCupo, 'valor-cupo')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Cupos dictados por docentes ocasionales por UAB con 500 o más cupos', s2.pesoU, 'uab')}
            </div>
          </React.Fragment>
        ) : null}

        {sec.id === 'grupos' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Cupos por grupo según el tipo de docente', s3.cupos, 'cupos-grupo')}
              {tarjeta('Inscritos por grupo según el tipo de docente', s3.inscr, 'inscritos-grupo')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Ocupación de los cupos según el tipo de docente', s3.ocup, 'ocupacion')}
              {tarjeta('Grupos con menos de 10 inscritos según el tipo de docente', s3.pequ, 'grupos-pequenos')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tablaTarjeta('Grupos y ocupación por UAB en 2026-1S', colsGrupos, s3.filas, 'detalle-uab',
                { col: 2, asc: false }, f => alternar('uab', f.nombre))}
            </div>
          </React.Fragment>
        ) : null}

        {sec.id === 'oferta26' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Cambio de la oferta en cupos entre el 19 de agosto y el 12 de septiembre', s4.cambio, 'cambio')}
              {tarjeta('Porcentaje de grupos con 5 cupos o más según su estado al 12 de septiembre', s4.estados, 'estado')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Cupos añadidos y cupos libres por UAB con 500 o más cupos', s4.anadidos, 'anadidos')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Ocupación de los cupos al cierre de la jornada regular y al corte final por UAB', s4.ocup, 'ocupacion')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Grupos llenos y con menos de 10 matriculados por UAB con 25 o más grupos', s4.estUab, 'estado-uab')}
            </div>
          </React.Fragment>
        ) : null}

        {sec.id === 'cancelacion' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Cancelación después de la apertura del acta', s5.cancel, 'cancelacion')}
              {tarjeta('Valor de la vinculación por estudiante matriculado en la Sede Medellín', s5.valEst, 'valor-estudiante')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Tasa de pérdida en pregrado según el tipo de docente', s5.perdida, 'perdida')}
              {tarjeta('Tasa de pérdida en las asignaturas con grupos de ambos tipos de docente', s5.perdidaM, 'perdida-misma-asignatura')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tarjeta('Cancelación por UAB con 600 o más inscritos iniciales', s5.canUab, 'cancelacion-uab')}
            </div>
          </React.Fragment>
        ) : null}

        {sec.id === 'evolucion' ? (
          <React.Fragment>
            <div className="dsh-mosaico dsh-mosaico-2">
              {tarjeta('Inscritos iniciales y matrícula final por semestre', s6.gA, 'inscritos-matricula')}
              {tarjeta('Cancelaciones por semestre', s6.gB, 'cancelaciones')}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              {tablaTarjeta('Resultados por semestre de las asignaturas seleccionadas', s6.colsP, s6.filasP, 'semestres', { col: 0, asc: true })}
            </div>
            <div className="dsh-mosaico dsh-mosaico-1">
              <Tarjeta titulo={MED_EV[medidaEv] + ' por asignatura y semestre'}
                accion={<Descargas
                  extra={<Segmento etiqueta="Medida" valor={medidaEv} onCambio={setMedidaEv}
                    opciones={[{ valor: 'ini', texto: 'Inscritos iniciales' }, { valor: 'can', texto: 'Cancelaciones' }, { valor: 'fin', texto: 'Matrícula final' }]} />}
                  csv={() => ({ encabezados: colsA.map(c => c.tit), filas: filasA.map(f => colsA.map(c => c.val(f))) })}
                  nombre={nombreArchivo(arch.concat(['asignaturas', medidaEv]))} />}>
                <Tabla columnas={colsA} filas={filasA} ordenInicial={{ col: 2 + NP_EV - 1, asc: false }}
                  alSeleccionar={elegirAsignatura} altura={460} />
              </Tarjeta>
            </div>
          </React.Fragment>
        ) : null}
      </div>

      <p className="dsh-nota">{DEF.nota}</p>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
