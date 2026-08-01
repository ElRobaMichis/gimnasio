#!/usr/bin/env node
/* =====================================================================
   Generador del documento de pantallas de Hierro.
   No dibuja nada a mano: carga el JS real de index.html, siembra datos
   de ejemplo y llama a las mismas funciones de render que usa la app.
   Correr con:  node mockups/build.js   → mockups/estado-actual.html
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { doc: buildDoc, phone: frame } = require('./shell');

/* ---------- stubs mínimos de navegador ---------- */
global.localStorage = {
  _d:{}, getItem(k){ return this._d[k] ?? null; },
  setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; }
};
const els = {};
global.document = {
  getElementById(id){
    if(!els[id]) els[id] = { innerHTML:'', style:{}, className:'', value:'',
      click(){}, focus(){}, insertAdjacentHTML(){}, querySelectorAll(){ return []; } };
    return els[id];
  },
  addEventListener(){},
  createElement(){ return { click(){}, remove(){} }; },
  body:{ appendChild(){} },
  visibilityState:'hidden'
};
Object.defineProperty(globalThis,'navigator',{ configurable:true, value:{} });
global.window = global;
global.window.scrollTo = () => {};
for(const id of ['topbar','main','tabs','modalhost']) document.getElementById(id);

/* ---------- cargar la app ---------- */
const APP = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(APP, 'utf8');
const appCss = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code = code
  .replace(/\(function init\(\)\{[\s\S]*?\}\)\(\);/, '')
  .replace(/^\s*'use strict';/, '')
  .replace('let db = load();', 'globalThis.db = load();')
  .replace("let view = { name:'home' };", "globalThis.view = { name:'home' };")
  /* los const del módulo no se filtran del eval: se exponen a propósito */
  + '\nglobalThis.K = { GOALS, MUSCLES, TIEMPO_RANGE };';
eval(code);

/* ---------- datos de ejemplo ---------- */
/* fechas relativas a hoy: así se llenan las ventanas de 7 y 14 días */
const REF = new Date();
const iso = d => new Date(REF.getTime() - d*864e5).toISOString();
const E = (name, sets) => ({ key: exKey(name), name, sets });

function seed(){
  db = normalize({
    settings:{ goal:'hipertrofia', rest:'auto', unit:'kg', screenOn:'on', notify:'on',
               lastBackup: iso(14) },
    routines:[
      { id:'r1', name:'Torso', exercises:[
        {id:'e1',name:'Incline Bench Press (Dumbbell)',key:exKey('Incline Bench Press (Dumbbell)')},
        {id:'e2',name:'Lat Pulldown (Cable)',key:exKey('Lat Pulldown (Cable)')},
        {id:'e3',name:'Shoulder Press (Machine)',key:exKey('Shoulder Press (Machine)')},
        {id:'e4',name:'Chest Supported Row (Dumbbell)',key:exKey('Chest Supported Row (Dumbbell)')},
        {id:'e5',name:'Plancha',key:exKey('Plancha')} ]},
      { id:'r2', name:'Pierna', exercises:[
        {id:'e6',name:'Squat (Barbell)',key:exKey('Squat (Barbell)')},
        {id:'e7',name:'Leg Curl (Machine)',key:exKey('Leg Curl (Machine)')},
        {id:'e8',name:'Hip Thrust (Barbell)',key:exKey('Hip Thrust (Barbell)')} ]},
      { id:'r3', name:'Full Body', exercises:[
        {id:'e9',name:'Pull Up (Assisted)',key:exKey('Pull Up (Assisted)')},
        {id:'e10',name:'Bicep Curl (Dumbbell)',key:exKey('Bicep Curl (Dumbbell)')} ]}
    ],
    history:[
      { id:'h0', routineId:'r1', routineName:'Torso', date:iso(23), duration:1980, entries:[
        E('Incline Bench Press (Dumbbell)',[{w:14,r:10,rir:2},{w:14,r:10,rir:2}]),
        E('Lat Pulldown (Cable)',[{w:27.5,r:9},{w:27.5,r:8}]) ]},
      { id:'h1', routineId:'r1', routineName:'Torso', date:iso(16), duration:1860, entries:[
        E('Incline Bench Press (Dumbbell)',[{w:16,r:11,rir:2},{w:16,r:10,rir:1}]),
        E('Lat Pulldown (Cable)',[{w:29.6,r:8},{w:29.6,r:8}]),
        E('Shoulder Press (Machine)',[{w:12.3,r:8},{w:12.3,r:9}]),
        E('Chest Supported Row (Dumbbell)',[{w:16,r:9},{w:16,r:9}]) ]},
      { id:'h2', routineId:'r2', routineName:'Pierna', date:iso(9), duration:3360, entries:[
        E('Squat (Barbell)',[{w:70,r:9,rir:2},{w:70,r:8,rir:1},{w:70,r:8,rir:1}]),
        E('Leg Curl (Machine)',[{w:35,r:12},{w:35,r:12},{w:35,r:11}]),
        E('Hip Thrust (Barbell)',[{w:80,r:10},{w:80,r:10}]) ]},
      { id:'h2b', routineId:'r2', routineName:'Pierna', date:iso(5), duration:3300, entries:[
        E('Squat (Barbell)',[{w:70,r:9,rir:2},{w:70,r:9,rir:1},{w:70,r:8,rir:1}]),
        E('Leg Curl (Machine)',[{w:35,r:12},{w:35,r:11},{w:35,r:11}]),
        E('Hip Thrust (Barbell)',[{w:80,r:10},{w:80,r:10}]) ]},
      { id:'h3', routineId:'r3', routineName:'Full Body', date:iso(6), duration:3120, entries:[
        E('Pull Up (Assisted)',[{w:25,r:10},{w:25,r:9}]),
        E('Bicep Curl (Dumbbell)',[{w:10,r:12},{w:10,r:11}]) ]},
      { id:'h4', routineId:'r2', routineName:'Pierna', date:iso(3), duration:3360, entries:[
        E('Squat (Barbell)',[{w:72.5,r:9,rir:2},{w:72.5,r:8,rir:1},{w:72.5,r:8,rir:1}]),
        E('Leg Curl (Machine)',[{w:35,r:12},{w:35,r:12},{w:35,r:12}]),
        E('Hip Thrust (Barbell)',[{w:80,r:11},{w:80,r:10}]) ]},
      { id:'h5', routineId:'r1', routineName:'Torso', date:iso(1), duration:1860, entries:[
        E('Incline Bench Press (Dumbbell)',[{w:18,r:12,rir:2},{w:18,r:12,rir:2},{w:18,r:12,rir:1}]),
        E('Lat Pulldown (Cable)',[{w:29.6,r:9},{w:29.6,r:9}]),
        E('Shoulder Press (Machine)',[{w:12.3,r:8},{w:12.3,r:10}]),
        E('Chest Supported Row (Dumbbell)',[{w:16,r:9},{w:16,r:9}]),
        E('Plancha',[{w:0,r:35},{w:0,r:30}]) ]}
    ],
    progress:{}, exmeta:{}, active:null
  });
  migrateTypes();
  exMeta(exKey('Plancha')).type = 'tiempo';
  exMeta(exKey('Pull Up (Assisted)')).type = 'asistido';
  exMeta(exKey('Incline Bench Press (Dumbbell)')).notes = 'Banco en 30°, bajar lento';
  db.progress = {};
  for(const h of db.history) for(const e of h.entries) updateProgress(e.key, e.sets, h.date);
  db.active = null;
  els.modalhost.innerHTML = '';
}

/* ---------- capturar una pantalla ---------- */
function capture(setup){
  seed();
  setup();
  renderTop(); renderTabs();
  const m = db.active && view.name === 'session' ? viewSession()
    : view.name === 'routine'  ? viewRoutine()
    : view.name === 'exercise' ? viewExercise()
    : view.name === 'history'  ? viewHistory()
    : view.name === 'gym'      ? viewGym()
    : view.name === 'settings' ? viewSettings()
    : viewHome();
  return {
    top: els.topbar.innerHTML,
    topClass: els.topbar.className || 'app',
    main: m,
    tabs: els.tabs.innerHTML,
    modal: els.modalhost.innerHTML
  };
}

/* la gráfica es <canvas>: en el documento se dibuja el mismo trazo en SVG */
function chartSVG(){
  const pts = (window.__chartPts || []).map(p => p.v);
  if(pts.length < 2) return '';
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = (hi - lo) || 1;
  const W = 300, H = 120, padT = 10, padB = 10;
  const X = i => 4 + (W - 12) * i/(pts.length-1);
  const Y = v => padT + (H-padT-padB) * (1 - ((v - lo + span*0.14) / (span*1.28)));
  const line = pts.map((v,i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const dots = pts.map((v,i) => i === pts.length-1 ? ''
    : `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.4" fill="#8B8E94"/>`).join('');
  const last = pts.length-1;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:120px;display:block;overflow:visible">
    ${[0,0.5,1].map(f => `<line x1="0" y1="${(padT+(H-padT-padB)*f).toFixed(1)}" x2="${W}" y2="${(padT+(H-padT-padB)*f).toFixed(1)}" stroke="rgba(255,255,255,.07)" vector-effect="non-scaling-stroke"/>`).join('')}
    <polyline points="${line}" fill="none" stroke="#F3F1EC" stroke-width="1.6"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${dots}
    <circle cx="${X(last).toFixed(1)}" cy="${Y(pts[last]).toFixed(1)}" r="3.6" fill="#F3F1EC"/>
  </svg>`;
}

/* ---------- las pantallas ---------- */
const SCREENS = [];
const add = (n, title, desc, shot, opts) => SCREENS.push({ n, title, desc, shot, ...(opts||{}) });

add('01','Rutinas · inicio',
  'Lo primero al abrir. La tira resume los últimos 7 días y cada rutina es una fila separada por una línea de un pixel. El botón de nueva rutina va en secundario porque no es la acción de todos los días.',
  capture(() => { view = { name:'home' }; }));

add('02','Rutina',
  'El coach ya calculó qué toca en cada ejercicio antes de empezar. Los cinco segmentos son las cinco reps del rango 8–12, llenos con lo de la última sesión: verde solo cuando el rango está lleno y toca subir carga. La descarga vive junto al botón principal.',
  capture(() => { view = { name:'routine', id:'r1' }; }));

add('03','Sesión en curso',
  'Un solo ejercicio abierto a la vez. Los terminados se colapsan con su resumen y palomita, los que faltan muestran la carga que toca. El check cierra la serie y arranca el descanso, que avanza en la barra de la cabecera.',
  capture(() => {
    view = { name:'session' };
    startSession('r1');
    const a = db.active;
    a.exercises[3].sets.forEach((s,i) => { s.w='16'; s.r=String(10-i%2); s.rir='2'; s.done=true; });
    a.exercises[0].sets[0].w='20'; a.exercises[0].sets[0].r='8'; a.exercises[0].sets[0].rir='2';
    a.exercises[0].sets[0].done = true;
    a.open = 0;
  }), { clock:'24:31', rest:{ label:'Descansando', time:'0:34', pct:62, cls:'rest on' } });

add('04','Ficha del ejercicio',
  'Se llega tocando un ejercicio desde su rutina. El equipo baja a segunda línea en gris para que el nombre respire; cada punto de la gráfica es una sesión y el último se resalta. Los modos de progresión son un selector de una línea.',
  capture(() => {
    const r = db.routines[0];
    view = { name:'exercise', key:r.exercises[0].key, exname:r.exercises[0].name, rid:'r1' };
  }), { chart:true });

add('05','Historial',
  'Los grupos se ordenan por volumen, no alfabéticamente, y la barra baja a 3 px: es un indicador, no el protagonista. El verde aparece solo cuando un grupo llega a la zona óptima. Cada sesión se despliega para ver el detalle, editarla o borrarla.',
  capture(() => { view = { name:'history' }; }));

add('06','Ajustes',
  'Objetivo en tres tarjetas cortas, el resto en filas con el control a la derecha. Cada opción conserva una línea de contexto y nada más. El latón marca lo que está encendido.',
  capture(() => { view = { name:'settings' }; }));

add('07','Sesión · ejercicio por tiempo',
  'Los isométricos cambian las columnas: lastre y segundos en vez de kg y reps, y el número de serie se vuelve un ▶ que abre el cronómetro con cuenta regresiva y alarma. Esta además es una sesión de descarga, marcada en la cabecera.',
  capture(() => {
    view = { name:'session' };
    startSession('r1', true);
    db.active.open = 4;
  }), { clock:'12:08' });

add('08','Historial desplegado',
  'Al tocar una sesión se abre el detalle con cada ejercicio y sus series, más editar y borrar. Editar recalcula todas las sugerencias del coach con los datos corregidos.',
  capture(() => { view = { name:'history' }; }), { openDetails:2 });

add('09','Rutina · reordenar',
  'Modo aparte al que se entra desde el icono de la cabecera. Solo nombres y flechas: el orden aquí es el orden en que aparecen durante la sesión.',
  capture(() => { view = { name:'routine', id:'r1', sort:true }; }));

add('10','Primera vez',
  'Sin datos, la app arranca preguntando el objetivo — es lo que define el rango de reps y el descanso de todo lo demás. Detrás, el estado vacío invita a crear la primera rutina.',
  capture(() => {
    db = normalize(null);
    view = { name:'home' };
    els.modalhost.innerHTML = '';
    openModal(`
      <h2>¿Cuál es tu objetivo?</h2>
      <p class="muted">Define el rango de reps y cómo el coach te sugiere progresar. Lo puedes cambiar en Ajustes.</p>
      <div class="stack">
        ${Object.entries(K.GOALS).map(([k,v]) => `
          <button class="opt"><b>${v.label}</b><span>${v.desc}</span></button>`).join('')}
      </div>`);
  }));

add('11','Sesión guardada',
  'Al terminar. Compara contra tu mejor marca histórica y celebra los récords; si la sesión fue mayormente al fallo, lo dice sin regañar. Una descarga nunca compite por récords.',
  capture(() => {
    view = { name:'session' };
    startSession('r1');
    db.active.open = 0;
    els.modalhost.innerHTML = '';
    openModal(`
      <h2>¡Sesión con récord!</h2>
      <p class="muted">54 min 12 s · 11 series.</p>
      <div class="note up" style="margin:0 0 18px">
        <div class="note-t">Nuevos récords</div>
        <div class="note-d">Incline Bench Press (Dumbbell): <b style="color:var(--hold)">28 kg</b> <span class="tiny">(antes 25,2)</span><br>Lat Pulldown (Cable): <b style="color:var(--hold)">42,7 kg</b> <span class="tiny">(antes 38,5)</span></div>
      </div>
      <button class="btn">Ver historial</button>
      <button class="btn ghost">Volver al inicio</button>`);
  }), { clock:'54:12' });

add('12','Calentamiento',
  'Escalera calculada desde el peso de trabajo de hoy. Sabe si el músculo ya viene caliente de un ejercicio anterior de la misma sesión y entonces pide menos series.',
  capture(() => {
    view = { name:'session' };
    startSession('r1');
    db.active.open = 0;
    els.modalhost.innerHTML = '';
    showWarmup(0);
  }), { clock:'24:31' });

add('13','Editar sesión',
  'Corregir un peso, agregar la serie que se olvidó o quitar la que sobra. Al guardar, todo el estado adaptativo del coach se reconstruye desde cero con el historial corregido.',
  capture(() => {
    view = { name:'history' };
    els.modalhost.innerHTML = '';
    editSession('h5');
  }));

add('14','Agregar ejercicio a la sesión',
  'A media sesión, con autocompletado sobre todo lo que ya entrenaste. Si el ejercicio ya se conoce, el coach trae su progresión; el interruptor decide si además se guarda en la rutina.',
  capture(() => {
    view = { name:'session' };
    startSession('r1');
    db.active.open = 0;
    els.modalhost.innerHTML = '';
    promptAddExercise();
    els.modalhost.innerHTML = els.modalhost.innerHTML.replace(
      '<div class="aclist" id="aclist2" style="display:none" role="listbox"></div>',
      `<div class="aclist" role="listbox">
         <button type="button"><span>Chest Supported <b>Row</b> (Dumbbell)</span><span class="from">Torso</span></button>
         <button type="button"><span>Bent Over <b>Row</b> (Barbell)</span><span class="from">historial</span></button>
       </div>`).replace('id="sessnewex" placeholder="Nombre del ejercicio"', 'id="sessnewex" value="row"');
  }), { clock:'31:47' });

add('15','Ajustes · mi equipo',
  'La sección nueva. Es lo único que hay que configurar una vez, y de ahí sale toda la calculadora de carga.',
  capture(() => { view = { name:'settings' }; }), { scroll:true });

add('16','Discos',
  'El punto de color es el código internacional, para reconocer el disco de un vistazo. La cantidad va en pares, que es como se cargan: si solo tienes un par de 20, la app no propondrá dos por lado.',
  capture(() => { view = { name:'gym', kind:'plates' }; }));

add('17','Barras',
  'Cada barra pesa distinto y eso cambia toda la cuenta. La predeterminada se usa cuando el ejercicio no dice otra cosa; en la ficha de cada uno se puede fijar otra.',
  capture(() => { view = { name:'gym', kind:'bars' }; }));

add('18','Mancuernas',
  'El rango rápido llena la lista de un golpe y luego se destildan las que falten — casi ningún gimnasio tiene la serie completa.',
  capture(() => { view = { name:'gym', kind:'dumbbells' }; }));

add('19','Sesión · barra cargada',
  'En cuanto el ejercicio usa barra, bajo el veredicto aparece cómo cargarla: el dibujo con los discos de hoy y el desglose por lado. Un vistazo y sabes qué agarrar.',
  capture(() => {
    view = { name:'session' };
    startSession('r2');
    db.active.open = 0;
  }), { clock:'18:42', rest:{ label:'Descansando', time:'1:24', pct:30, cls:'rest on' } });

add('20','Cómo cargar la barra',
  'Al tocar la tira se abre el detalle: la barra en grande, los discos por lado con su color y la cuenta completa. Desde ahí se puede cambiar de barra sin salir de la sesión.',
  capture(() => {
    view = { name:'session' };
    startSession('r2');
    db.active.open = 0;
    els.modalhost.innerHTML = '';
    showLoad(0);
  }), { clock:'18:42' });

add('21','Calentamiento con carga',
  'Cada escalón trae su propia barra dibujada: se lee de arriba abajo mientras vas sumando discos, y la serie de trabajo cierra en verde. Los escalones también se redondean a pesos armables.',
  capture(() => {
    view = { name:'session' };
    startSession('r2');
    db.active.open = 0;
    els.modalhost.innerHTML = '';
    showWarmup(0);
  }), { clock:'02:15' });

add('22','Ficha · qué equipo usa',
  'Se detecta solo desde el nombre, en inglés (lo que trae Hevy) y en español. La fila está para corregirlo cuando falle, y con “Barra” el salto automático pasa a ser tu par de discos más pequeño.',
  capture(() => {
    const r = db.routines[1];
    view = { name:'exercise', key:r.exercises[0].key, exname:r.exercises[0].name, rid:'r2' };
  }), { chart:true });

add('23','Guía rápida',
  'Cuatro explicaciones cortas desde Ajustes, y las mismas se abren tocando “RIR” o “1RM” allí donde aparecen. Todo el vocabulario de la app se explica sin salir de ella.',
  capture(() => {
    view = { name:'settings' };
    els.modalhost.innerHTML = '';
    rirInfo();
  }));

/* ---------- CSS: mismas reglas, reencuadradas dentro del marco ---------- */
function frameCss(css){
  return css
    .replace(/\n  html,body\{height:100%\}/, '')
    .replace(/\n  body\{\n(?:[^}]*)\}/, m => m.replace('body{', '.scr{'))
    .replace('#app{', '.appbox{')
    .replace('main{flex:1;padding:0 20px 32px}', '.appbox main{flex:1;padding:0 20px 32px}')
    .replace('min-height:100dvh', 'min-height:100%')
    .replace('nav.tabs .inner{max-width:460px', 'nav.tabs .inner{max-width:none')
    .replace('.modal{\n    background:var(--surface)', '.modal{\n    background:var(--surface)')
    .replace('max-width:460px;margin:0 auto;min-height:100%', 'max-width:none;margin:0;min-height:100%');
}

const STATUS = `<div class="status"><span>12:04</span><span class="sig"><b style="height:4px"></b><b style="height:6px"></b><b style="height:8px"></b><b style="height:10px"></b></span></div>`;

function phone(s){
  let main = s.shot.main;
  let top = s.shot.top;
  if(s.chart) main = main.replace(/<canvas id="exchart"[^>]*><\/canvas>/, chartSVG());
  if(s.clock) top = top.replace('id="clock">0:00<', `id="clock">${s.clock}<`);
  if(s.rest){
    top = top.replace('class="rest" id="rest"', `class="${s.rest.cls}" id="rest"`)
             .replace('id="restlabel">Descanso<', `id="restlabel">${s.rest.label}<`)
             .replace(/id="resttime">[^<]*</, `id="resttime">${s.rest.time}<`)
             .replace('class="rest-fill" id="restfill"', `class="rest-fill" id="restfill" style="width:${s.rest.pct}%"`);
  }
  if(s.openDetails != null){
    let i = 0;
    main = main.replace(/<details class="hist">/g, () => (i++ === s.openDetails) ? '<details class="hist" open>' : '<details class="hist">');
  }
  const grow = s.shot.modal ? '' : ' grow';
  return `
<figure>
  <div class="phone${grow}">
    ${STATUS}
    <div class="scr">
      <div class="appbox">
        <header class="${s.shot.topClass}">${top}</header>
        <main>${main}</main>
      </div>
      <nav class="tabs">${s.shot.tabs}</nav>
      ${s.shot.modal}
    </div>
  </div>
  <figcaption>
    <div class="cap-n">${s.n}</div>
    <div class="cap-t">${s.title}</div>
    <div class="cap-d">${s.desc}</div>
  </figcaption>
</figure>`;
}

const doc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hierro — estado actual de las pantallas</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${frameCss(appCss)}

  /* ---------- documento ---------- */
  html,body{height:auto}
  body{
    background:var(--void);color:var(--bone);font-family:var(--sans);font-synthesis:none;
    margin:0;padding:56px 24px 96px;
  }
  .brief{max-width:1240px;margin:0 auto 64px}
  .brief .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--dim);font-weight:600;font-stretch:80%}
  .brief h1{font-size:clamp(38px,7vw,68px);line-height:.94;letter-spacing:-.03em;font-weight:700;font-stretch:118%;margin:14px 0 18px}
  .brief h1 em{font-style:normal;color:var(--dim)}
  .brief p{max-width:60ch;color:var(--ash);font-size:14.5px;line-height:1.6}
  .tokens{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
  .token{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border:1px solid var(--line);border-radius:999px;font-family:var(--mono);font-size:11px;color:var(--ash)}
  .token i{width:13px;height:13px;border-radius:3px;display:block}

  .deck{max-width:1240px;margin:0 auto;display:grid;align-items:start;grid-template-columns:repeat(auto-fit,minmax(320px,390px));gap:64px 48px;justify-content:center}
  figure{margin:0}
  figcaption{margin-top:22px;max-width:390px}
  .cap-n{font-family:var(--mono);font-size:11px;color:var(--dim);letter-spacing:.08em}
  .cap-t{font-size:16px;font-weight:600;letter-spacing:-.01em;margin:6px 0 7px}
  .cap-d{font-size:13px;line-height:1.55;color:var(--ash)}

  .phone{
    width:390px;height:844px;border-radius:46px;overflow:hidden;background:var(--void);
    border:1px solid var(--line-2);position:relative;display:flex;flex-direction:column;
    box-shadow:0 40px 80px -40px #000;transform:translateZ(0);
  }
  /* pantallas más largas que el teléfono: el marco crece en vez de cortarlas.
     En los modales se conserva el alto real, que es donde importa el encuadre. */
  .phone.grow{height:auto;min-height:844px}
  .phone.grow .scr{overflow:visible}
  .phone.grow .appbox{height:auto}
  .status{height:48px;flex:none;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 6px;font-family:var(--mono);font-size:12px;position:relative;z-index:60}
  .status .sig{display:flex;gap:3px;align-items:flex-end}
  .status .sig b{display:block;width:3px;background:var(--bone);border-radius:1px}
  .scr{flex:1;min-height:0;overflow:hidden;position:relative;padding:0}
  .appbox{height:100%;overflow:hidden}
  .phone header.app{padding-top:6px}
  .phone .dock{position:static;margin-top:18px}

  @media(max-width:900px){
    body{padding:36px 16px 72px}
    .deck{gap:52px 0}
    .phone{width:100%;max-width:390px}
    .phone:not(.grow){height:auto;aspect-ratio:390/844}
  }
</style>
</head>
<body>

<header class="brief">
  <div class="eyebrow">Hierro · estado actual · ${SCREENS.length} pantallas</div>
  <h1>Cómo está<br><em>hoy la app</em></h1>
  <p>Cada marco se generó llamando a las funciones de render reales de <code>index.html</code> con datos
  de ejemplo, así que esto es literalmente lo que verías en el teléfono — no un dibujo aparte.
  Sirve de referencia para decidir dónde entra cada función nueva.</p>
  <div class="tokens">
    <div class="token"><i style="background:#08080A;border:1px solid #26272b"></i>#08080A fondo</div>
    <div class="token"><i style="background:#0E0F11"></i>#0E0F11 tarjeta</div>
    <div class="token"><i style="background:#1B1E22"></i>#1B1E22 campo</div>
    <div class="token"><i style="background:#F3F1EC"></i>#F3F1EC hueso</div>
    <div class="token"><i style="background:#7FD3A8"></i>#7FD3A8 subir</div>
    <div class="token"><i style="background:#D7A44B"></i>#D7A44B mantener</div>
  </div>
</header>

<div class="deck">
${SCREENS.map(phone).join('\n')}
</div>

</body>
</html>`;

const out = path.join(__dirname, 'estado-actual.html');
fs.writeFileSync(out, doc);
console.log(`${SCREENS.length} pantallas → ${path.relative(process.cwd(), out)}`);

process.exit(0);
