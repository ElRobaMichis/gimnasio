#!/usr/bin/env node
/* =====================================================================
   Suite de tests de Hierro — correr con:  node tests/run.js
   Extrae el JS de index.html, simula el entorno del navegador y
   verifica el motor de sugerencias, unidades, edición de historial,
   importación de Hevy y utilidades. Sin dependencias externas.
   NOTA: sin 'use strict' a propósito — el eval() directo en modo sloppy
   filtra las funciones de la app a este scope, que es lo que queremos.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* ---------- stubs de navegador ---------- */
global.localStorage = {
  _d: {},
  getItem(k){ return this._d[k] ?? null; },
  setItem(k, v){ this._d[k] = v; },
  removeItem(k){ delete this._d[k]; }
};
const els = {};
global.document = {
  getElementById(id){
    if(!els[id]) els[id] = { innerHTML:'', style:{}, value:'', click(){}, focus(){}, insertAdjacentHTML(){} };
    return els[id];
  },
  addEventListener(){},
  createElement(){ return { click(){}, remove(){} }; },
  body: { appendChild(){} },
  visibilityState: 'hidden'
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { serviceWorker: { ready: Promise.resolve({
    showNotification(t){ shownNotifications.push(t); return Promise.resolve(); }
  }) } }
});
let shownNotifications = [];
global.Notification = class {
  static permission = 'granted';
  constructor(t){ shownNotifications.push('ctor:' + t); }
};
global.Blob = class { constructor(){} };
global.URL = { createObjectURL(){ return 'blob:x'; }, revokeObjectURL(){} };
/* FileReader que lee el "archivo" como contenido directo (string) */
global.FileReader = class {
  readAsText(content){ this.result = content; this.onload(); }
};
global.window = global;

/* ---------- cargar la app ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code = code
  .replace(/\(function init\(\)\{[\s\S]*?\}\)\(\);/, '')
  .replace(/^\s*'use strict';/, '')
  .replace("let db = load();", 'globalThis.db = load();')
  .replace("let view = { name:'home' };", "globalThis.view = { name:'home' };")
  .replace('let updateReady = false, updateDismissed = false;',
           'globalThis.updateReady = false; globalThis.updateDismissed = false;')
  /* los const del módulo no se filtran del eval: se exponen a propósito */
  + '\nglobalThis.APP_VERSION = APP_VERSION; globalThis.LS_KEY = LS_KEY;';
eval(code);
window.scrollTo = () => {};

/* ---------- mini-framework ---------- */
let pass = 0, fail = 0, section = '';
function suite(name){ section = name; console.log('\n── ' + name + ' ──'); }
function chk(cond, msg){
  if(cond){ pass++; console.log('  OK  ' + msg); }
  else { fail++; console.log('  ❌  ' + msg); }
}
function resetDB(){
  db.routines = []; db.history = []; db.progress = {}; db.exmeta = {}; db.active = null;
  db.settings.goal = 'hipertrofia'; db.settings.unit = 'kg';
  db.settings.fatigueDismissed = null; db.settings.rirDismissed = null;
  dayCounter = 0;
}
let dayCounter = 0;
const S = (w, r, rir) => rir === undefined ? { w, r } : { w, r, rir };
/* sesión reciente (últimos ~4 días) para no activar el ajuste por pausas */
function sess(key, sets, daysAgo){
  const date = daysAgo !== undefined
    ? new Date(Date.now() - daysAgo * 864e5).toISOString()
    : new Date(Date.now() - 4 * 864e5 + (dayCounter++) * 36e5).toISOString();
  const rec = { id: uid(), routineName: 'T', date, duration: 60, entries: [{ key, name: key, sets }] };
  db.history.push(rec);
  db.history.sort((a, b) => a.date < b.date ? -1 : 1);
  updateProgress(key, sets, date);
  return rec;
}

/* =====================================================================
   MOTOR: doble progresión
   ===================================================================== */
suite('Motor — doble progresión');
resetDB();
sess('banca', [S(40,12), S(40,12), S(40,12)]);
let s = computeSuggestion('banca');
chk(s.type === 'up' && s.w === 42.5, 'tope del rango → subir peso (40 → 42,5)');
resetDB();
sess('banca', [S(42.5,9), S(42.5,8), S(42.5,8)]);
s = computeSuggestion('banca');
chk(s.type === 'reps' && s.reps === 10, 'dentro del rango → +1 rep');
resetDB();
sess('banca', [S(40,12), S(40,12)]);            /* base */
sess('banca', [S(42.5,7), S(42.5,6)]);          /* fallo 1 (tras subir) */
s = computeSuggestion('banca');
chk(s.type === 'hold', 'bajo el rango → consolidar');
sess('banca', [S(42.5,7), S(42.5,6)]);          /* fallo 2 */
s = computeSuggestion('banca');
chk(s.type === 'deload' && s.w < 42.5, '2 fallos → deload ~5%');
resetDB();
sess('press', [S(40,12), S(40,12)]);
sess('press', [S(42.5,7), S(42.5,6)]);
chk(Math.abs(db.progress['press'].inc - 0.0175) < 1e-9, 'falla tras subir → incremento adaptativo baja (2,5% → 1,75%)');
resetDB();
const same = [S(30,9), S(30,9)];
sess('curl', same); sess('curl', same); sess('curl', same); sess('curl', same);
s = computeSuggestion('curl');
chk(db.progress['curl'].stall >= 3 && s.sets === 3, 'estancado 3+ sesiones → serie extra');

suite('Motor — tolerancia y consolidación de series');
resetDB();
sess('jalon', [S(40,12), S(40,10), S(40,9), S(40,6)]);
s = computeSuggestion('jalon');
chk(s.type === 'reps', 'con 4+ series la peor no cuenta (12/10/9/[6])');
resetDB();
sess('aperturas', [S(15,12), S(15,10), S(15,6)]);
chk(computeSuggestion('aperturas').type === 'hold', 'con 3 series sigue estricto');
resetDB();
sess('curl polea', [S(10,12), S(10,12), S(10,12), S(10,12), S(10,12), S(10,12)]);
s = computeSuggestion('curl polea');
chk(s.type === 'up' && s.w === 11 && s.sets === 4, '6 series planas al tope → subir peso en 4 series');
resetDB();
sess('remo m', [S(30,10), S(30,10), S(30,9), S(30,10), S(30,10)]);
s = computeSuggestion('remo m');
chk(s.type === 'up' && s.sets === 3 && s.msg.includes('Concentra'), '5 planas en rango → concentrar: más peso, 3 series');
resetDB();
sess('militar', [S(20,12), S(20,10), S(20,8), S(20,7), S(20,6)]);
s = computeSuggestion('militar');
chk(s.type === 'hold' && s.sets === 3, '5 series con derrumbe → mismo peso, 3 series');

suite('Motor — tipos corporal y asistido');
resetDB();
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,12), S(0,12), S(0,12)]);
s = computeSuggestion('dominadas');
chk(s.w === 0 && s.reps === 13, 'corporal al tope → +reps, nunca kg');
resetDB();
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(25,12), S(25,12), S(25,12)]);
s = computeSuggestion('fondos a');
chk(s.type === 'up' && s.w < 25, 'asistido al tope → MENOS ayuda');
sess('fondos a', [S(22.5,9), S(22.5,8), S(22.5,8)]);
chk(db.progress['fondos a'].fail === 0, 'asistido: bajar ayuda sosteniendo rango = éxito');
resetDB();
exMeta('chin a').type = 'asistido';
sess('chin a', [S(2,12), S(2,12)]);
chk(computeSuggestion('chin a').w === 0, 'ayuda ≤2,5 kg al tope → probar sin asistencia');

suite('Motor — RIR');
resetDB();
sess('inclinado', [S(30,12,4), S(30,12,4), S(30,12,3)]);
s = computeSuggestion('inclinado');
chk(s.type === 'up' && s.w > Math.round(30*1.025*2)/2, 'RIR alto al tope → salto mayor');
resetDB();
sess('martillo', [S(12,9,5), S(12,9,4)]);
s = computeSuggestion('martillo');
chk(s.type === 'up' && s.w > 12, 'RIR 4+ dentro del rango → subir ya');
resetDB();
sess('remo b', [S(50,10), S(50,9)]);
chk(computeSuggestion('remo b').type === 'reps', 'sin RIR funciona igual (opcional)');

suite('Motor — vuelta tras pausa');
resetDB();
sess('banca', [S(60,12), S(60,12)], 10);
chk(computeSuggestion('banca').type === 'up', '10 días → progresión normal');
resetDB();
sess('banca', [S(60,12), S(60,12)], 20);
s = computeSuggestion('banca');
chk(s.type === 'back' && s.w === 55, '20 días → -7,5% (60 → 55)');
resetDB();
sess('banca', [S(60,12), S(60,12), S(60,12)], 40);
s = computeSuggestion('banca');
chk(s.type === 'back' && s.w === 50 && s.sets === 2, '40 días → -15% y una serie menos');
resetDB();
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,12)], 30);
chk(computeSuggestion('dominadas').reps === 10, 'corporal 30 días → menos reps objetivo');
resetDB();
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(20,12)], 30);
chk(computeSuggestion('fondos a').w > 20, 'asistido 30 días → MÁS ayuda');

suite('Motor — rango y salto personalizados');
resetDB();
Object.assign(exMeta('plancha'), { lo: 15, hi: 25 });
sess('plancha', [S(10,25), S(10,25)]);
s = computeSuggestion('plancha');
chk(s.type === 'up' && s.reps === 15, 'rango custom 15–25 respetado');
Object.assign(exMeta('gemelos'), { lo: 20, hi: 10 });
chk(effRange('gemelos').hi > effRange('gemelos').lo, 'rango inválido (lo>hi) se corrige');
resetDB();
exMeta('mancuernas').step = 2;
sess('mancuernas', [S(16,12), S(16,12)]);
chk(computeSuggestion('mancuernas').w === 18, 'salto custom 2 kg: 16 → 18');

/* =====================================================================
   UNIDADES kg/lb
   ===================================================================== */
suite('Unidades');
resetDB();
db.settings.unit = 'lb';
db.routines.push({ id:'r1', name:'G', exercises:[{ id:'e1', name:'Bench', key:'bench' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'100', r:'12', rir:'' };
let ent = collectEntries(db.active);
chk(Math.abs(ent[0].sets[0].w - 45.359) < 0.001, '100 lb escritas → 45,359 kg guardados');
chk(fmtW(ent[0].sets[0].w) === '100', 'round-trip exacto: se muestra "100" de vuelta');
finishSession();
s = computeSuggestion('bench');
chk(fmtW(s.w) === '105' && s.msg.includes('lb'), 'sugerencia limpia en discos lb (100 → 105)');
db.settings.unit = 'kg';
chk(computeSuggestion('bench').msg.includes('kg'), 'mismos datos vistos en kg');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'10', rir:'' };
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '44.09', 'cambio a mitad de sesión convierte lo escrito');
setUnit('kg');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta sin deriva');
db.active = null;
chk(Math.abs(epley(60,10) - 80) < 0.01 && epley(0,15) === 0, 'Epley: 60×10 = 80; corporal = 0');

/* =====================================================================
   EDICIÓN DE SESIONES (agregar/quitar series)
   ===================================================================== */
suite('Editar sesión');
resetDB();
let rec = sess('banca', [S(60,10), S(60,10), S(60,9)]);
editSession(rec.id);
chk(window.__edit.entries[0].sets.length === 3, 'modal abre con las 3 series');
editAddSet(0);
chk(window.__edit.entries[0].sets.length === 4 &&
    window.__edit.entries[0].sets[3].w === '60' && window.__edit.entries[0].sets[3].r === '9',
    'agregar serie: prellenada con la última (60×9)');
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets.length === 4, 'la serie agregada quedó guardada');
chk(computeSuggestion('banca').sets === 4, 'el coach ahora sugiere 4 series');

editSession(rec.id);
editRemoveSet(0, 3); editRemoveSet(0, 2);
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets.length === 2, 'quitar series funciona');

resetDB();
rec = sess('sentadilla', [S(300,10), S(100,10)]);   /* 300 = error de dedo */
editSession(rec.id);
editVal(0, 0, 'w', '100');
saveEditedSession();
chk(db.history.find(h => h.id === rec.id).entries[0].sets[0].w === 100, 'corregir un valor (300 → 100)');
chk(computeSuggestion('sentadilla').w <= 105, 'las sugerencias se recalculan con el dato corregido');

/* regresión del bug de lb: guardar SIN tocar no corrompe */
resetDB();
db.settings.unit = 'lb';
rec = sess('squat', [S(42.5,10), S(42.5,9)]);
editSession(rec.id);
saveEditedSession();   /* sin tocar nada */
let w0 = db.history.find(h => h.id === rec.id).entries[0].sets[0].w;
chk(Math.abs(w0 - 42.5) < 0.05, 'lb: guardar sin tocar no re-convierte (queda ' + w0 + ' kg)');
db.settings.unit = 'kg';

/* vaciar un ejercicio lo saca de la sesión; vaciar todo ofrece borrarla */
resetDB();
rec = sess('a', [S(10,10)]);
db.history[0].entries.push({ key:'b', name:'b', sets:[ S(20,8) ] });
editSession(rec.id);
editRemoveSet(0, 0);
saveEditedSession();
chk(db.history[0].entries.length === 1 && db.history[0].entries[0].key === 'b',
    'vaciar un ejercicio lo quita de la sesión');
editSession(rec.id);
editRemoveSet(0, 0);
saveEditedSession();
chk(els['modalhost'].innerHTML.includes('Borrar la sesión'), 'vaciar todo → ofrece borrar la sesión');
window.__confirmFn();
chk(db.history.length === 0, 'confirmar la borra y recalcula');

/* =====================================================================
   IMPORTACIÓN DESDE HEVY
   ===================================================================== */
suite('Importar Hevy');
const CSV_KG = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Bench Press (Barbell)",,"",0,"normal",60,10,,,8
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Bench Press (Barbell)",,"",1,"warmup",20,10,,,
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Pull Up (Assisted)",,"",0,"normal",25,8,,,
"Torso","6 Jul 2026, 17:59","6 Jul 2026, 18:56","","Hanging Leg Raise",,"",0,"normal",,12,,,`;
const CSV_LB = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles","duration_seconds","rpe"
"Upper","5 Jul 2026, 10:00","5 Jul 2026, 11:00","","Bench Press (Barbell)",,"",0,"normal",60,10,,,
"Upper","5 Jul 2026, 10:00","5 Jul 2026, 11:00","","Lat Pulldown (Cable)",,"",0,"normal",80,12,,,`;
resetDB();
importHevy(CSV_KG);
applyHevyImport();
chk(db.history.length === 1 && db.routines.length === 1, 'CSV en kg: 1 sesión, 1 rutina creada');
let e0 = db.history[0].entries.find(e => e.key === 'bench press (barbell)');
chk(e0.sets.length === 1 && e0.sets[0].w === 60 && e0.sets[0].rir === 2, 'warmup omitido; RPE 8 → RIR 2');
chk(exMeta('pull up (assisted)').type === 'asistido', '"(Assisted)" → tipo asistido');
chk(exMeta('hanging leg raise').type === 'corporal', 'sin peso → corporal');
chk(exMeta('hanging leg raise').muscle === 'core', 'grupo muscular adivinado (leg raise → core)');
importHevy(CSV_KG);
chk(els['modalhost'].innerHTML.includes('Nada nuevo'), 're-importar no duplica');

resetDB();
importHevy(CSV_LB);
chk(els['modalhost'].innerHTML.includes('libras'), 'CSV en lb: detecta la unidad y avisa');
applyHevyImport();
e0 = db.history[0].entries.find(e => e.key === 'bench press (barbell)');
chk(Math.abs(e0.sets[0].w - 27.216) < 0.01, '60 lb → 27,2 kg canónicos');

/* auto-reparación de un import viejo sin pesos */
resetDB();
db.history.push({ id:'old', hevyKey:'Upper|5 Jul 2026, 10:00', routineId:null, routineName:'Upper',
  date:new Date(2026,6,5,10,0).toISOString(), duration:3600,
  entries:[{ key:'bench press (barbell)', name:'Bench Press (Barbell)', sets:[S(0,10)] }] });
db.exmeta['bench press (barbell)'] = { type:'corporal', lo:null, hi:null, step:null, notes:'', rest:null, muscle:'pecho' };
importHevy(CSV_LB);
chk(els['modalhost'].innerHTML.includes('reparar'), 'sesión corrupta detectada → ofrece reparar');
applyHevyImport();
e0 = db.history.find(h => h.id === 'old').entries[0];
chk(Math.abs(e0.sets[0].w - 27.216) < 0.01 && db.exmeta['bench press (barbell)'].type === 'normal',
    'reparada: pesos restaurados y tipo corregido');

/* =====================================================================
   UTILIDADES
   ===================================================================== */
suite('Utilidades');
resetDB();
const junk = normalize({ routines:'x', history:null, settings:{ goal:'fuerza' } });
chk(Array.isArray(junk.routines) && junk.settings.rest === 'auto' && junk.settings.unit === 'kg',
    'normalize repara un respaldo roto');
db.settings.goal = 'fuerza';
chk(restSecs() === 180, 'descanso auto fuerza = 3:00');
exMeta('sentadilla').rest = 240;
chk(restSecs('sentadilla') === 240 && restSecs('curl') === 180, 'descanso por ejercicio gana al global');
db.settings.goal = 'hipertrofia';

resetDB();
exMeta('press banca').muscle = 'pecho';
exMeta('sentadilla2').muscle = 'pierna'; Object.assign(exMeta('sentadilla2'), { lo:4, hi:6 });
db.routines.push({ id:'r1', name:'F', exercises:[
  { id:'a', name:'Press banca', key:'press banca' },
  { id:'b', name:'Sentadilla2', key:'sentadilla2' }] });
startSession('r1');
db.active.exercises[0].sets[0].w = '60';
db.active.exercises[1].sets[0].w = '100';
let wp = warmupPlan(0);
chk(wp.rows.length === 2 && wp.rows[0].includes('30'), 'calentamiento hipertrofia: 2 escalones (50%, 75%)');
wp = warmupPlan(1);
chk(wp.rows.length === 3 && wp.rows[2].includes('80'), 'calentamiento fuerza: 3 escalones hasta 80%');
db.active = null;

resetDB();
for(const [i, k] of ['a','b','c','d','e'].entries()){
  sess(k, [S(50,10)], 15);
  sess(k, [S(50, i < 3 ? 7 : 11)], 3);
}
let f = systemicFatigue();
chk(f && f.regressed === 3 && f.evaluated === 5, 'fatiga sistémica: 3/5 en retroceso → alerta');
dismissFatigue();
chk(systemicFatigue() === null, 'descartada 10 días');
resetDB();
sess('a', [S(50,10)], 15); sess('a', [S(50,7)], 3);
sess('b', [S(50,10)], 15); sess('b', [S(50,7)], 3);
chk(systemicFatigue() === null, 'muestra chica (2 ejercicios) no alerta');

resetDB();
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Curl', key:'curl' }] });
sess('curl', [S(20,10)]);          /* e1RM 26,7 */
startSession('r1');
db.active.exercises[0].sets[0] = { w:'22', r:'10', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('récord'), 'PR detectado (e1RM 26,7 → 29,3)');

db.settings.notify = 'on';
shownNotifications = [];
startSession('r1');
db.active.start = Date.now() - 16*60*1000;
checkIdleSession();
chk(db.active.idleNotified > 0, 'sesión olvidada 15+ min → recordatorio armado');
db.active = null;

resetDB();
sess('x1', [S(10,10,0), S(10,10,0), S(10,9,0), S(10,9,0)], 2);
sess('x1', [S(10,10,0), S(10,10,0), S(10,9,0), S(10,9,1)], 1);
f = failureHabit();
chk(f && f.failSessions === 2, 'hábito de fallo (RIR 0) en 2 sesiones → aviso');

chk(daysSinceBackup() === null, 'sin respaldo: null');
exportBackup();
chk(daysSinceBackup() === 0, 'exportar registra la fecha');

/* =====================================================================
   LOTE 1: tope de máquina, ejercicios por tiempo, ejercicio en sesión
   ===================================================================== */
suite('Tope de máquina (peso máximo disponible)');
resetDB();
exMeta('crunch maquina').cap = 100;
sess('crunch maquina', [S(95,12), S(95,12), S(95,12)]);
s = computeSuggestion('crunch maquina');
chk(s.type === 'up' && s.w === 97.5, 'bajo el tope: progresión normal (95 → 97,5)');
resetDB();
exMeta('crunch maquina').cap = 101;
sess('crunch maquina', [S(100,12), S(100,12)]);
s = computeSuggestion('crunch maquina');
chk(s.type === 'up' && s.w === 101 && s.msg.includes('tope'), 'salto parcial: clava el último salto en el tope (100 → 101)');
resetDB();
exMeta('press pecho m').cap = 100;
sess('press pecho m', [S(100,12), S(100,12), S(100,12)]);
s = computeSuggestion('press pecho m');
chk(s.type === 'reps' && s.w === 100 && s.reps === 13 && s.msg.includes('Tope'),
    'en el tope + rango lleno → reps abiertas (12 → 13), no kilos imposibles');
sess('press pecho m', [S(100,13,4), S(100,13,4), S(100,13)]);
s = computeSuggestion('press pecho m');
chk(s.w === 100, 'RIR alto en el tope NO dispara subida de peso');
for(let i = 0; i < 4; i++) sess('press pecho m', [S(100,14), S(100,14), S(100,14)]);
s = computeSuggestion('press pecho m');
chk(s.sets === 4, 'estancado en el tope → suma serie (volumen sigue disponible)');

suite('Ejercicios por tiempo');
resetDB();
exMeta('plancha').type = 'tiempo';
chk(effRange('plancha').lo === 20 && effRange('plancha').hi === 45, 'rango por defecto 20–45 s');
sess('plancha', [S(0,45), S(0,45), S(0,45)]);
s = computeSuggestion('plancha');
chk(s.type === 'up' && s.reps === 50 && s.w === 0 && s.msg.includes('s</b>'),
    'tope del rango → +5 s (45 → 50), nunca kg');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,30), S(0,25)]);
s = computeSuggestion('plancha');
chk(s.type === 'reps' && s.reps === 35, 'dentro del rango → +5 s sobre el mejor (30 → 35)');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,15), S(0,12)]);
chk(computeSuggestion('plancha').type === 'hold', 'bajo 20 s → consolidar');
resetDB();
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,40)], 20);
s = computeSuggestion('plancha');
chk(s.type === 'back' && s.reps === 35, 'vuelta tras pausa: 40 s → 35 s (redondeado a 5)');
resetDB();
exMeta('farmer').type = 'tiempo';
sess('farmer', [S(20,45), S(20,45)]);
s = computeSuggestion('farmer');
chk(s.w === 20 && s.reps === 50, 'con lastre: mantiene el peso, suma segundos');
exMeta('plancha').type = 'tiempo';
chk(fmtSet('farmer', {w:20, r:45}) === '20+45s' && fmtSet('plancha', {w:0, r:30}) === '30s',
    'formato: "20+45s" con lastre, "30s" sin él');
chk(bestMetricBefore('farmer') === 45, 'récord por tiempo = mejores segundos');
/* cronómetro de serie: abre modal y cancela sin dejar intervalos vivos */
db.routines.push({ id:'rt', name:'Core', exercises:[{ id:'p1', name:'Plancha', key:'plancha' }] });
startSession('rt');
startSetTimer(0, 0);
chk(els['modalhost'].innerHTML.includes('Prepárate'), 'cronómetro: modal con cuenta de preparación');
stopSetTimer(false);
chk(els['modalhost'].innerHTML === '', 'cancelar cierra sin registrar');
db.active = null;
/* guardar con lastre en blanco → 0 */
exMeta('colgado').type = 'tiempo';
db.routines.push({ id:'rc', name:'C2', exercises:[{ id:'c1', name:'Colgado', key:'colgado' }] });
startSession('rc');
db.active.exercises[0].sets[0] = { w:'', r:'40', rir:'' };
chk(collectEntries(db.active)[0].sets[0].w === 0, 'tiempo: lastre en blanco = 0');
db.active = null;

suite('Agregar ejercicio a media sesión');
resetDB();
sess('press banca', [S(60,10), S(60,10)]);
db.routines.push({ id:'r1', name:'Torso', exercises:[{ id:'a', name:'Remo', key:'remo' }] });
startSession('r1');
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'press banca';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 2, 'ejercicio agregado a la sesión');
chk(db.active.exercises[1].sugg !== null && db.active.exercises[1].sugg.w > 0,
    'trae la progresión del historial (era de otra rutina)');
chk(db.routines[0].exercises.length === 1, '"solo por hoy": la rutina NO cambia');
document.getElementById('sessnewex').value = 'Press Banca';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 2 && els['modalhost'].innerHTML.includes('Ya está'),
    'duplicado bloqueado (ignora mayúsculas)');
window.__keepRoutine = true;
document.getElementById('sessnewex').value = 'Curl bíceps';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 3, 'segundo ejercicio agregado');
chk(db.routines[0].exercises.length === 2 && db.routines[0].exercises[1].key === 'curl biceps',
    '"guardar en rutina": la rutina crece');
const entries2 = (db.active.exercises[1].sets[0] = { w:'62.5', r:'10', rir:'' }, collectEntries(db.active));
chk(entries2.length === 1 && entries2[0].key === 'press banca', 'al guardar solo cuentan las series llenadas');
db.active = null;

/* =====================================================================
   LOTE 2: modo descarga, vs última sesión, PR asistidos, auto-copia
   ===================================================================== */
suite('Modo descarga');
resetDB();
sess('banca', [S(60,12), S(60,12), S(60,12), S(60,12)]);
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,10), S(0,10)]);
exMeta('fondos a').type = 'asistido';
sess('fondos a', [S(20,10), S(20,10)]);
exMeta('plancha').type = 'tiempo';
sess('plancha', [S(0,40), S(0,40)]);
db.routines.push({ id:'r1', name:'Full', exercises:[
  { id:'a', name:'Banca', key:'banca' }, { id:'b', name:'Dominadas', key:'dominadas' },
  { id:'c', name:'Fondos a', key:'fondos a' }, { id:'d', name:'Plancha', key:'plancha' }] });
const incBefore = prog('banca').inc, failBefore = prog('banca').fail;
startSession('r1', true);
chk(db.active.deload === true, 'sesión marcada como descarga');
let dl = db.active.exercises[0].sugg;
chk(dl.msg.includes('Descarga') && dl.w < 62.5 && dl.sets === 2, 'normal: ~-10% de carga y mitad de series (4 → 2)');
chk(db.active.exercises[1].sugg.reps === 8, 'corporal: ~70% del objetivo del coach (11 → 8)');
chk(db.active.exercises[2].sugg.w > 20, 'asistido: MÁS ayuda en descarga');
chk(db.active.exercises[3].sugg.reps % 5 === 0 && db.active.exercises[3].sugg.reps < 45, 'tiempo: segundos reducidos y redondeados a 5');
db.active.exercises[0].sets[0] = { w:'55', r:'8', rir:'' };
db.active.exercises[0].sets[1] = { w:'55', r:'8', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('Descarga guardada'), 'modal propio de descarga');
chk(db.history[db.history.length-1].deload === true, 'guardada con marca de descarga');
chk(prog('banca').inc === incBefore && prog('banca').fail === failBefore, 'NO toca el estado adaptativo');
s = computeSuggestion('banca');
chk(s.w === 62.5, 'la siguiente sugerencia retoma desde la sesión NORMAL (60 → 62,5), no desde la descarga');
chk(systemicFatigue() === null, 'la descarga no dispara la alarma de fatiga');
chk(!els['modalhost'].innerHTML.includes('Nuevo récord') && !els['modalhost'].innerHTML.includes('🏆'),
    'una descarga nunca compite por récords');

suite('vs última sesión (en vivo)');
resetDB();
sess('banca', [S(60,10), S(60,10)]);        /* volumen previo: 1200 */
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Banca', key:'banca' }] });
startSession('r1');
chk(vsLastInfo(0) === null, 'sin series llenadas aún → sin chip');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
let vi = vsLastInfo(0);
chk(vi && vi.pct === 50 && !vi.beat, 'una serie de dos: 50 % del volumen previo');
db.active.exercises[0].sets[1] = { w:'62.5', r:'10', rir:'' };
vi = vsLastInfo(0);
chk(vi && vi.beat && vi.pct > 100, 'al superar el total anterior lo celebra');
db.active = null;
/* corporal compara reps, y asistido no muestra chip */
exMeta('dominadas').type = 'corporal';
sess('dominadas', [S(0,10), S(0,10)]);
db.routines.push({ id:'r2', name:'C', exercises:[{ id:'x', name:'Dominadas', key:'dominadas' }] });
startSession('r2');
db.active.exercises[0].sets[0] = { w:'', r:'21', rir:'' };
vi = vsLastInfo(0);
chk(vi && vi.beat, 'corporal: 21 reps superan las 20 previas');
db.active = null;
exMeta('jalon a').type = 'asistido';
sess('jalon a', [S(30,10)]);
db.routines.push({ id:'r3', name:'A', exercises:[{ id:'y', name:'Jalon a', key:'jalon a' }] });
startSession('r3');
db.active.exercises[0].sets[0] = { w:'25', r:'10', rir:'' };
chk(vsLastInfo(0) === null, 'asistido: sin chip (menos ayuda ≠ menos volumen)');
db.active = null;

suite('PR de asistidos');
resetDB();
exMeta('pull up a').type = 'asistido';
sess('pull up a', [S(25,10), S(25,9)]);
db.routines.push({ id:'r1', name:'T', exercises:[{ id:'a', name:'Pull up a', key:'pull up a' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'9', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('récord') && els['modalhost'].innerHTML.includes('20'),
    'menos ayuda sosteniendo el rango = récord (25 → 20)');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'4', rir:'' };   /* bajo el piso del rango */
finishSession();
chk(!els['modalhost'].innerHTML.includes('récord'), 'menos ayuda SIN llegar al rango no cuenta');
startSession('r1');
db.active.exercises[0].sets[0] = { w:'0', r:'8', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('sin asistencia'), 'llegar a 0 kg de ayuda se celebra especial');
db.active = null;

/* =====================================================================
   EQUIPO DEL GIMNASIO Y CALCULADORA DE CARGA
   ===================================================================== */
suite('Equipo — detección por el nombre');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
chk(guessEquip('Squat (Barbell)') === 'barra', 'inglés de Hevy: "(Barbell)" → barra');
chk(guessEquip('Peso muerto rumano con barra') === 'barra', 'español: "con barra" → barra');
chk(guessEquip('Incline Bench Press (Dumbbell)') === 'mancuerna', '"(Dumbbell)" → mancuerna');
chk(guessEquip('Curl con mancuernas') === 'mancuerna', '"con mancuernas" → mancuerna');
chk(guessEquip('Leg Curl (Machine)') === 'placas', '"(Machine)" → torre de placas');
chk(guessEquip('Jalón en polea alta') === 'placas', '"polea" → torre de placas');
chk(guessEquip('Prensa de pierna') === 'discos', '"prensa" → discos que pones tú');
chk(guessEquip('Hack Squat') === 'discos', '"hack" → discos que pones tú');
chk(guessEquip('Smith Machine Squat') === 'barra', 'la multipower se carga con discos: barra gana a máquina');
chk(guessEquip('Sentadilla búlgara') === null, 'sin implemento en el nombre → sin equipo');

suite('Equipo — cargar la barra');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('squat').equip = 'barra';
let l = barLoad('squat', 72.5);
chk(l.bar.kg === 20 && l.total === 72.5 && l.exact, 'barra olímpica: 72,5 se arma exacto');
chk(Math.abs(l.perSide - 26.25) < 1e-9, '26,25 kg por lado');
chk(l.plates.length === 2 && l.plates.includes(25) && l.plates.includes(1.25),
    'elige la combinación con menos discos (25+1,25, no 20+5+1,25)');
l = barLoad('squat', 20);
chk(l.total === 20 && !l.plates.length, 'solo la barra cuando el peso es el de la barra');

/* un solo par de 25 → no puede poner dos por lado */
db.gym.plates = db.gym.plates.filter(p => p.kg === 25 || p.kg === 20);
db.gym.plates.find(p => p.kg === 25).pairs = 1;
db.gym.plates.find(p => p.kg === 20).pairs = 1;
invalidatePlates();
l = barLoad('squat', 110);   /* pediría 45 por lado = 25+20 */
chk(l.total === 110 && l.plates.length === 2, 'con un par de cada uno: 25+20 por lado');
l = barLoad('squat', 120);   /* haría falta 25+25 y solo hay un par */
chk(l.total === 110, 'no propone dos discos de 25 por lado si solo tienes un par');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('squat').equip = 'barra';
db.gym.plates = db.gym.plates.filter(p => p.kg !== 1.25);
invalidatePlates();
chk(plateMinStep(2) === 5, 'sin discos de 1,25 el salto mínimo pasa a 5 kg');
l = barLoad('squat', 72.5);
chk(l.total === 75 && !l.exact, 'lo que no se puede armar sube al más cercano (72,5 → 75)');

suite('Equipo — el coach solo propone pesos que existen');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.plates = db.gym.plates.filter(p => [20,15,10,5].includes(p.kg));
invalidatePlates();
exMeta('sentadilla').equip = 'barra';
sess('sentadilla', [S(60,12), S(60,12), S(60,12)]);
s = computeSuggestion('sentadilla');
chk(effStep('sentadilla', 60) === 10, 'sin discos chicos, el salto automático es el par menor (10 kg)');
chk(s.w === 70, 'el salto respeta lo que se puede armar: 60 → 70');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.plates = db.gym.plates.filter(p => [20,15,10,5,2.5].includes(p.kg));
invalidatePlates();
Object.assign(exMeta('sentadilla'), { equip:'barra', step:2.5 });
sess('sentadilla', [S(60,12), S(60,12), S(60,12)]);
s = computeSuggestion('sentadilla');
chk(s.wanted === 62.5 && s.w === 65, 'el salto pedía 62,5 (no armable) → 65');
chk(s.msg.includes('65') && !s.msg.includes('62,5'), 'el mensaje muestra el peso corregido');
chk(s.why.includes('Con tus discos'), 'y explica por qué cambió');

resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('polea').equip = 'placas';
sess('polea', [S(31,12), S(31,12)]);
s = computeSuggestion('polea');
chk(s.wanted === undefined, 'torre sin configurar: no se toca el peso');

suite('Equipo — mancuernas y barras alternativas');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
chk(nearestDumbbell(19) === 19, 'con la serie completa, 19 existe');
db.gym.dumbbells = db.gym.dumbbells.filter(d => d.kg !== 19);
chk(nearestDumbbell(19) === 20, 'sin el par de 19, lo más cercano por arriba es 20');

suite('Mancuernas — lo que anotas es el total de las dos');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();

let pl;
/* el caso del standing calf raise: 12 kg = dos mancuernas de 6 */
exMeta('calf raise').equip = 'mancuerna';
Object.assign(exMeta('calf raise'), { lo:15, hi:20 });
sess('calf raise', [S(12,20), S(12,20)]);
s = computeSuggestion('calf raise');
chk(s.w === 14, 'de 12 kg (dos de 6) el siguiente escalón es 14 (dos de 7), no 13');
chk(effStep('calf raise', 12) === 2, 'el salto es el hueco del rack × 2 manos');
pl = loadPlan('calf raise', 14);
chk(pl.dumbbell === 7 && pl.points === 2, 'y son dos mancuernas de 7');

/* el caso del incline bench: 20 kg = dos de 10, no dos de 20 */
exMeta('incline db').equip = 'mancuerna';
pl = loadPlan('incline db', 20);
chk(pl.total === 20 && pl.dumbbell === 10, '20 kg anotados = 2 × 10, no 2 × 20');
chk(pl.exact, 'y sale exacto porque el par de 10 existe');

/* totales imposibles se redondean al par que sí existe */
pl = loadPlan('incline db', 13);
chk(pl.total === 14 || pl.total === 12, '13 kg no se puede con dos mancuernas iguales: cae en 12 o 14');
chk(pl.total % 2 === 0, 'los totales con dos manos siempre son pares');

/* a una sola mano el total es la mancuerna */
exMeta('remo una mano').equip = 'mancuerna';
exMeta('remo una mano').points = 1;
pl = loadPlan('remo una mano', 22);
chk(pl.points === 1 && pl.total === 22 && pl.dumbbell === 22, 'a una mano, el total es esa mancuerna');
chk(effStep('remo una mano', 22) === 1, 'y el salto es el hueco del rack, sin multiplicar');

/* sin el par de 7, el coach no lo propone */
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.gym.dumbbells = db.gym.dumbbells.filter(d => d.kg !== 7);
exMeta('calf raise').equip = 'mancuerna';
Object.assign(exMeta('calf raise'), { lo:15, hi:20 });
sess('calf raise', [S(12,20), S(12,20)]);
s = computeSuggestion('calf raise');
chk(s.w === 16, 'sin el par de 7 salta al de 8: 12 → 16');
chk(s.why.includes('mancuernas'), 'y explica que fue por el rack');


resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('curl z').equip = 'barra';
exMeta('curl z').bar = 'ez';
chk(barFor('curl z').kg === 7, 'la barra fijada en el ejercicio gana a la predeterminada');
exMeta('curl z').bar = null;
chk(barFor('curl z').kg === 20, 'sin fijar, se usa la predeterminada');
db.gym.bars.forEach(b => { b.on = false; });
chk(barLoad('curl z', 60) === null, 'sin barras marcadas no se calcula nada (y no revienta)');

suite('Equipo — puntos de carga');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('prensa').equip = 'discos';
exMeta('prensa').points = 4;
chk(plateMinStep(4) === 5, 'con 4 pitones el salto mínimo es 5 kg (un 1,25 en cada uno)');
chk(plateMinStep(2) === 2.5, 'con 2 lados, 2,5 kg');
chk(plateMinStep(1) === 1.25, 'con 1 pitón, un disco suelto: 1,25 kg');
chk(maxPerPoint(2, 4) === 1, 'dos pares (4 discos) solo dan uno por pitón entre cuatro');
chk(maxPerPoint(2, 1) === 4, 'y los cuatro discos caben en un solo pitón');

pl = loadPlan('prensa', 145);
chk(pl.points === 4 && pl.total === 145, 'prensa de 4 pitones: 145 kg exactos');
chk(Math.abs(pl.perPointKg - 36.25) < 1e-9, '36,25 kg en cada pitón');
chk(pl.perPoint.length === 3, 'y son tres discos por pitón (25 + 10 + 1,25)');

exMeta('hipthrust').equip = 'discos';
exMeta('hipthrust').points = 1;
pl = loadPlan('hipthrust', 46.25);
chk(pl.points === 1 && pl.total === 46.25, 'un solo pitón: todo el peso va ahí');
chk(pl.perPoint.reduce((a,b) => a+b, 0) === 46.25, 'los discos suman el total, no la mitad');

exMeta('hipthrust').base = 15;   /* el aparato pesa 15 kg */
pl = loadPlan('hipthrust', 45);
chk(pl.base === 15 && pl.total === 45 && pl.perPointKg === 30, 'el peso del aparato se descuenta de los discos');

suite('Equipo — torres de placas');
const KGxLB = 0.45359237;
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('remo cable').equip = 'placas';
chk(loadPlan('remo cable', 50) === null, 'sin configurar la torre no se calcula nada');
chk(exUnit('remo cable') === 'kg', 'y la unidad sigue siendo la de la app');

Object.assign(exMeta('remo cable').stack, { unit:'lb', step:5, start:10 });
chk(exUnit('remo cable') === 'lb', 'la torre en libras manda sobre la unidad global');
chk(stackPreview('remo cable', 4).join(',') === '10,15,20,25', 'la vista previa sale de 5 en 5 desde 10');
let sn = stackSnap('remo cable', 27.2155);   /* 60 lb */
chk(sn.value === 60 && sn.index === 11, '60 lb es la placa 11');
chk(Math.abs(sn.kg - 27.2155) < 0.001, 'y por dentro se guardan sus kilos exactos');
sn = stackSnap('remo cable', 26);            /* 57,3 lb: entre 55 y 60 */
chk(sn.value === 55, 'un peso intermedio cae en la placa más cercana');
chk(Math.abs(effStep('remo cable', 30) - 5*KGxLB) < 1e-6, 'el salto del coach es el de la torre, en kg');

/* la misma máquina pero en kilos */
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('pulldown').equip = 'placas';
Object.assign(exMeta('pulldown').stack, { unit:'kg', step:5, start:5 });
chk(exUnit('pulldown') === 'kg', 'una torre en kilos se queda en kilos');
chk(stackSnap('pulldown', 47).value === 45, '47 kg cae en la placa de 45');
chk(effStep('pulldown', 40) === 5, 'y el salto del coach es 5 kg');

suite('Equipo — el coach en máquinas de placas');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('remo cable').equip = 'placas';
Object.assign(exMeta('remo cable').stack, { unit:'lb', step:5, start:10 });
const lb55 = Math.round(55 * KGxLB * 1000) / 1000;
sess('remo cable', [S(lb55,12), S(lb55,12), S(lb55,12)]);
s = computeSuggestion('remo cable');
chk(Math.abs(s.w - 60*KGxLB) < 0.001, 'de 55 lb el coach salta a 60 lb, no a un peso imposible');
chk(s.msg.includes('60'), 'y lo dice en libras, como la máquina');
chk(fmtSet('remo cable', { w:lb55, r:12 }) === '55×12', 'el historial de ese ejercicio también va en libras');

suite('Equipo — duplicar para otra máquina');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
Object.assign(exMeta('hip thrust'), { equip:'placas', muscle:'gluteos', lo:8, hi:12 });
db.routines.push({ id:'r1', name:'G', exercises:[{ id:'a', name:'Hip Thrust', key:'hip thrust' }] });
document.getElementById('dupname').value = 'Hip Thrust (Discos)';
window.__dupFrom = 'hip thrust';
doDuplicateEx({ preventDefault(){} });
chk(!!db.exmeta['hip thrust (discos)'], 'se crea el ejercicio nuevo');
chk(exMeta('hip thrust (discos)').muscle === 'gluteos' && exMeta('hip thrust (discos)').lo === 8,
    'hereda grupo muscular y rango de reps');
chk(exMeta('hip thrust (discos)').equip === null, 'pero no el equipo: es otra máquina');
chk(db.routines[0].exercises.length === 2, 'y queda junto al original en la rutina');

suite('Navegación — volver donde te quedaste');
resetDB();
db.routines.push({ id:'r1', name:'T', exercises:[] });
db.routines.push({ id:'r2', name:'P', exercises:[] });
const saltos = [];
window.scrollTo = (x, y) => { saltos.push(y); window.scrollY = y; };
window.scrollY = 0;
go({ name:'home' });
window.scrollY = 640;                       /* bajas hasta el sexto ejercicio */
go({ name:'routine', id:'r1' });
chk(saltos[saltos.length-1] === 0, 'una pantalla nueva empieza arriba');
window.scrollY = 300;
go({ name:'exercise', key:'x', exname:'X', rid:'r1' });
chk(saltos[saltos.length-1] === 0, 'la ficha del ejercicio también');
go({ name:'routine', id:'r1' });
chk(saltos[saltos.length-1] === 300, 'al volver, la rutina retoma donde ibas');
go({ name:'home' });
chk(saltos[saltos.length-1] === 640, 'y el inicio recuerda la suya');
go({ name:'routine', id:'r2' });
chk(saltos[saltos.length-1] === 0, 'cada rutina lleva su propia memoria');
window.scrollTo = () => {};

suite('Mancuernas — el aviso');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
exMeta('press db').equip = 'mancuerna';
chk(weightColLabel('press db', 'normal') === 'kg total', 'la columna del peso avisa: «kg total»');
exMeta('press db').points = 1;
chk(weightColLabel('press db', 'normal') === 'kg', 'a una mano no hace falta: es una sola');
exMeta('press db').points = 2;
exMeta('barra').equip = 'barra';
chk(weightColLabel('barra', 'normal') === 'kg', 'en barra la columna no cambia');
chk(weightColLabel('press db', 'tiempo') === 'lastre', 'los ejercicios por tiempo siguen pidiendo lastre');

chk(dbNoticeHTML('press db').includes('total de las dos'), 'la primera vez sale el aviso completo');
chk(dbNoticeHTML('barra') === '', 'y solo en mancuernas');
dismissDbNotice();
chk(dbNoticeHTML('press db') === '', 'una vez lo descartas, no vuelve');

suite('Splits — migración y rotación');
/* las rutinas viejas, sin split, se agrupan solas al cargar */
db = normalize({ routines:[
  { id:'a', name:'Torso', exercises:[] },
  { id:'b', name:'Pierna', exercises:[] },
  { id:'c', name:'Full Body', exercises:[] } ], history:[] });
chk(db.splits.length === 1 && db.splits[0].active, 'se crea un split y queda en curso');
chk(db.splits[0].name === 'Torso / Pierna / Full Body', 'toma el nombre de tus rutinas');
chk(db.routines.every(r => r.split === db.splits[0].id), 'y todas quedan dentro');

/* la rotación: el siguiente al último entrenado, dando la vuelta */
chk(nextDay().routine.name === 'Torso', 'sin historial, toca el primer día');
db.history.push({ id:'h1', routineId:'b', routineName:'Pierna',
  date:new Date(Date.now() - 2*864e5).toISOString(), duration:60, entries:[] });
let n = nextDay();
chk(n.routine.name === 'Full Body' && n.idx === 2, 'tras Pierna toca Full Body');
chk(n.last.name === 'Pierna' && n.total === 3, 'y dice qué hiciste antes');
db.history.push({ id:'h2', routineId:'c', routineName:'Full Body',
  date:new Date(Date.now() - 864e5).toISOString(), duration:60, entries:[] });
chk(nextDay().routine.name === 'Torso', 'al llegar al final, la rotación da la vuelta');
chk(daysAgoText(new Date(Date.now() - 864e5).toISOString()) === 'ayer', 'el texto del último día');

/* saltarse un día no rompe nada: cuenta desde el último entrenado */
db.history.push({ id:'h3', routineId:'a', routineName:'Torso', date:new Date().toISOString(), duration:60, entries:[] });
chk(nextDay().routine.name === 'Pierna', 'se cuenta desde lo que entrenaste, no del calendario');

suite('Splits — guardar, retomar y mover días');
const spA = db.splits[0].id;
document.getElementById('newsplit').value = 'PPL';
createSplit({ preventDefault(){} });
chk(db.splits.length === 2, 'se crea el split nuevo');
chk(activeSplit().name === 'PPL', 'y queda en curso');
chk(db.splits.find(x => x.id === spA).active === false, 'el anterior pasa a guardados sin perder nada');
chk(splitRoutines(spA).length === 3, 'sus días siguen ahí');
chk(nextDay() === null, 'un split sin días todavía no propone nada');

/* crear un día lo mete en el split en curso */
document.getElementById('newroutine').value = 'Push';
createRoutine({ preventDefault(){} });
chk(splitRoutines(activeSplit().id).length === 1, 'el día nuevo entra en el split en curso');
chk(nextDay().routine.name === 'Push', 'y pasa a ser el que toca');

/* mover un día de un split a otro */
const push = db.routines.find(r => r.name === 'Push');
const torso = db.routines.find(r => r.name === 'Torso');
window.__moveTo = activeSplit().id; window.__moveCopy = false;
doMoveRoutine(torso.id);
chk(torso.split === activeSplit().id, 'mover cambia el día de split');
chk(splitRoutines(spA).length === 2, 'y desaparece del anterior');

/* copiar lo deja en los dos */
window.__moveTo = spA; window.__moveCopy = true;
doMoveRoutine(push.id);
chk(splitRoutines(spA).length === 3, 'copiar añade una copia al destino');
chk(push.split === activeSplit().id, 'y el original se queda donde estaba');

/* retomar el guardado */
activateSplit(spA);
chk(activeSplit().id === spA, 'ponerlo en curso lo devuelve al inicio');
chk(db.splits.filter(x => x.active).length === 1, 'solo uno puede estar en curso');

/* reordenar los días */
const orden = () => splitRoutines(activeSplit().id).map(r => r.name).join(',');
const antes = orden();
moveRoutine(splitRoutines(activeSplit().id)[1].id, -1);
chk(orden() !== antes, 'los días se pueden reordenar');
chk(splitRoutines(activeSplit().id).length === 3, 'sin perder ninguno');

/* borrar un split se lleva sus días pero no el historial */
const nSes = db.history.length;
const otro = db.splits.find(x => !x.active).id;
window.__confirmFn = null;
deleteSplit(otro);
window.__confirmFn();
chk(!db.splits.some(x => x.id === otro), 'el split desaparece');
chk(db.routines.every(r => r.split !== otro), 'y sus días también');
chk(db.history.length === nSes, 'pero el historial queda intacto');

suite('Splits — cada día con lo suyo');
/* dos días con el mismo nombre en splits distintos no se roban sesiones */
resetDB();
db.splits = [{ id:'s1', name:'A', active:true, created:new Date().toISOString() },
             { id:'s2', name:'B', active:false, created:new Date().toISOString() }];
db.routines = [{ id:'ra', name:'Push', split:'s1', exercises:[] },
               { id:'rb', name:'Push', split:'s2', exercises:[] }];
db.history = [{ id:'hx', routineId:'ra', routineName:'Push', date:new Date().toISOString(), duration:60, entries:[] }];
chk(splitSessions('s1').length === 1, 'la sesión cuenta en el split del día que la generó');
chk(splitSessions('s2').length === 0, 'y no en el que solo comparte el nombre');
/* historial sin routineId (importado) sí cae por nombre */
db.history.push({ id:'hy', routineId:null, routineName:'Push', date:new Date().toISOString(), duration:60, entries:[] });
chk(splitSessions('s1').length === 2, 'el historial importado se atribuye por nombre');

suite('Torre de placas — el dibujo no miente');
resetDB();
exMeta('cable').equip = 'placas';
Object.assign(exMeta('cable').stack, { unit:'lb', step:5, start:2.5 });
chk(stackPreview('cable', 4).join(',') === '2.5,7.5,12.5,17.5', 'torre que empieza en 2,5 y sube de 5 en 5');
chk(stackSnap('cable', 17.5 * 0.45359237).index === 4, '17,5 lb es la placa 4');

/* el dibujo tiene que caber entero: si se recorta, el pin parece estar
   en otra placa — que es el fallo que se arregló */
function cabe(sel, total, h){
  const svg = stackSVG(sel, total, { h });
  const ys = [...svg.matchAll(/y="(-?[\d.]+)"[^>]*height="([\d.]+)"/g)];
  return ys.every(m => +m[1] >= -0.5 && +m[1] + +m[2] <= h + 0.5);
}
chk(cabe(4, 12, 104), 'cabe en el alto del calentamiento');
chk(cabe(4, 12, 140), 'cabe en el alto de la sesión');
chk(cabe(11, 15, 190), 'cabe en el alto del detalle');
chk(cabe(20, 24, 96), 'y aguanta torres largas en poco espacio');
chk(cabe(1, 12, 104), 'también con el pin en la primera placa');

/* el pin se dibuja dentro de la placa que toca */
function pinEnPlaca(sel, total, h){
  const svg = stackSVG(sel, total, { h });
  const rects = [...svg.matchAll(/<rect x="18" y="([\d.]+)" width="\d+" height="([\d.]+)"/g)]
    .map(m => [+m[1], +m[1] + +m[2]]);
  const cy = +/circle cx="\d+" cy="([\d.]+)"/.exec(svg)[1];
  const i = rects.findIndex(([a, b]) => cy >= a && cy <= b);
  return i + 1;
}
chk(pinEnPlaca(4, 12, 104) === 4, 'el pin cae en la placa 4, no en otra');
chk(pinEnPlaca(1, 12, 104) === 1, 'y en la 1 cuando toca la primera');
chk(pinEnPlaca(12, 12, 104) === 12, 'y en la última cuando toca el final');

suite('Configurar sin parar la sesión');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
db.routines.push({ id:'r1', name:'Pierna', split:db.splits[0] && db.splits[0].id,
  exercises:[{ id:'a', name:'Leg Press', key:'leg press' }] });
sess('leg press', [S(100,12), S(100,12)]);
startSession('r1');
const sug0 = db.active.exercises[0].sugg.w;
chk(sug0 === 102.5, 'al empezar, sin configurar, sugiere el salto genérico');

/* se abre la ficha desde la sesión y se vuelve a ella */
openExFromSession(0);
chk(view.name === 'exercise' && view.from === 'session', 'la ficha se abre desde la sesión y recuerda el origen');
chk(view.key === 'leg press', 'y es la del ejercicio abierto');

/* configurarlo a media sesión recalcula la sugerencia de hoy */
setExEquip('leg press', 'discos');
setExPoints('leg press', 4);
chk(effPoints('leg press') === 4, 'queda como prensa de 4 pitones');
chk(db.active.exercises[0].sugg.w === 105, 'y la sugerencia de la sesión se recalcula al vuelo (102,5 → 105)');
chk(loadPlan('leg press', db.active.exercises[0].sugg.w).points === 4, 'la carga ya se reparte entre los 4');

/* una torre en libras convierte lo ya escrito */
resetDB();
db.routines.push({ id:'r2', name:'Torso', split:db.splits[0] && db.splits[0].id,
  exercises:[{ id:'b', name:'Cable Row', key:'cable row' }] });
startSession('r2');
db.active.exercises[0].sets[0].w = '20';          /* escrito en kg */
setExEquip('cable row', 'placas');
setExStack('cable row', 'unit', 'lb');
chk(exUnit('cable row') === 'lb', 'el ejercicio pasa a libras');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 44.09) < 0.1,
    'y los 20 kg ya escritos se convierten a 44,09 lb: siguen siendo el mismo peso');
setExStack('cable row', 'unit', 'kg');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta a 20 kg');
db.active = null;

suite('Actualizaciones — que se note, pero sin estorbar');
resetDB();
const toast = () => document.getElementById('toasthost').innerHTML;
updateReady = false; updateDismissed = false;
showUpdateToast();
chk(toast() === '', 'sin versión nueva no aparece nada');

updateReady = true;
showUpdateToast();
chk(toast().includes('Versión nueva lista'), 'cuando la hay, sale el aviso abajo');
chk(toast().includes('no se tocan'), 'y tranquiliza sobre los datos');
chk(toast().includes('Actualizar') && toast().includes('Ahora no'), 'con las dos salidas');

/* lo importante: durante una sesión no interrumpe */
db.routines.push({ id:'r1', name:'P', split:(db.splits[0]||{}).id, exercises:[{ id:'a', name:'Sq', key:'sq' }] });
startSession('r1');
showUpdateToast();
chk(toast() === '', 'con una sesión en curso se calla: ahí estorba');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
finishSession();
chk(toast().includes('Versión nueva lista'), 'y aparece en cuanto terminas la sesión');

dismissUpdate();
chk(toast() === '', '«Ahora no» lo quita');
chk(/^\d+\.\d+\.\d+$/.test(APP_VERSION), 'la versión sigue el formato MAYOR.MENOR.PARCHE');
chk(viewSettings().includes(APP_VERSION), 'y ajustes la enseña en el pie');
/* olvidar subir una de las dos es el fallo fácil: la caché quedaría vieja */
const swSrc = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
chk(new RegExp("const CACHE = 'hierro-" + APP_VERSION.replace(/\./g, '\\.') + "'").test(swSrc),
    'y el service worker usa esa misma versión para su caché');
updateReady = false; updateDismissed = false; showUpdateToast();

suite('Una sesión interrumpida no se pierde');
resetDB();
db.routines.push({ id:'r1', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Squat', key:'squat' }] });
startSession('r1');
db.active.start = Date.now() - 34*60*1000;      /* lleva 34 minutos */
setVal(0, 0, 'w', '60'); setVal(0, 0, 'r', '10'); setVal(0, 0, 'rir', '2');
toggleSetDone(0, 0);
addSet(0);
setVal(0, 1, 'w', '60'); setVal(0, 1, 'r', '9');

/* «se cierra la app o entra una actualización»: se relee lo guardado,
   igual que hace la app al arrancar */
const enDisco = localStorage.getItem(LS_KEY);
db = normalize(JSON.parse(enDisco));
chk(!!db.active, 'al volver a abrir, la sesión sigue en curso');
chk(db.active.routineName === 'Pierna', 'con su rutina');
chk(db.active.exercises[0].sets.length === 2, 'y las series que llevaba');
chk(db.active.exercises[0].sets[0].w === '60' && db.active.exercises[0].sets[0].r === '10',
    'lo escrito, intacto');
chk(db.active.exercises[0].sets[0].done === true, 'incluida la serie que ya había cerrado');
chk(db.active.exercises[0].sets[1].r === '9', 'y la que estaba a medio anotar');
chk(Math.round((Date.now() - db.active.start)/60000) === 34,
    'el cronómetro sigue contando desde que empezó, no desde cero');

/* y se termina y se guarda como si nada hubiera pasado */
finishSession();
chk(db.history.length === 1, 'la sesión se guarda en el historial');
chk(db.history[0].entries[0].sets.length === 2, 'con sus dos series');
chk(db.active === null, 'y deja de estar en curso');

/* =====================================================================
   GIMNASIOS: plantillas de equipo por establecimiento
   ===================================================================== */
suite('Gimnasios — migración desde 1.0');
db = normalize({ routines:[], history:[], settings:{ unit:'lb' },
  gym:{ plates:[{ kg:10, pairs:2, on:true }] },
  exmeta:{ 'remo cable': { type:'normal', lo:null, hi:null, step:null, notes:'', rest:null,
    muscle:null, equip:'placas', bar:null, points:null, base:null,
    stack:{ unit:'lb', step:5, start:10 } } } });
chk(db.gyms.length === 1 && db.gyms[0].name === 'Mi gimnasio', 'el equipo de 1.0 pasa a ser el primer gimnasio');
chk(db.gym.plates.length === 1 && db.gym.plates[0].kg === 10 && db.gym.bars.length > 0,
    'db.gym sigue funcionando: apunta al gimnasio activo');
chk(exUnit('remo cable') === 'lb', 'las máquinas ya configuradas no se tocan');
chk(db.gym.unit === 'lb', 'y el gimnasio recuerda la unidad del usuario');
chk(JSON.parse(JSON.stringify(db)).gym === undefined, 'el respaldo no duplica: el equipo vive en db.gyms');

suite('Gimnasios — la configuración viaja con cada gimnasio');
resetDB();
db.gyms = [normGym({ name:'Forum Buenavista', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
/* el caso real: lateral raise en polea, con la torre en libras */
exMeta('lateral raise polea').equip = 'placas';
Object.assign(exMeta('lateral raise polea').stack, { unit:'lb', step:5, start:5 });
chk(exUnit('lateral raise polea') === 'lb', 'en Forum la máquina va en libras');
const gymA = db.settings.gymId;

/* el gimnasio de la pareja: copia de Forum, y ahí la torre va en kilos */
window.__gymBase = 'copy';
document.getElementById('newgymname').value = 'Gym de mi pareja';
createGym({ preventDefault(){} });
chk(db.gyms.length === 2 && db.gym.name === 'Gym de mi pareja', 'crear un gimnasio te cambia ahí');
const gymB = db.settings.gymId;
chk(exUnit('lateral raise polea') === 'lb', 'la copia arranca igual que el original');
Object.assign(exMeta('lateral raise polea').stack, { unit:'kg', step:5, start:5 });
chk(exUnit('lateral raise polea') === 'kg', 'y se ajusta a la máquina de ese gimnasio');

setActiveGym(gymA);
chk(exUnit('lateral raise polea') === 'lb', 'volver a Forum devuelve las libras — sin reconfigurar nada');
setActiveGym(gymB);
chk(exUnit('lateral raise polea') === 'kg', 'y el otro sigue en kilos');

/* el inventario también es de cada gimnasio */
setActiveGym(gymA);
db.gym.plates = db.gym.plates.filter(p => Math.abs(p.kg - 1.25) > 1e-9); invalidatePlates();
chk(plateMinStep(2) === 5, 'en Forum ya no hay discos de 1,25: salto mínimo 5');
setActiveGym(gymB);
chk(db.gym.plates.some(p => Math.abs(p.kg - 1.25) < 1e-9), 'pero en el otro gimnasio siguen estando');
chk(plateMinStep(2) === 2.5, 'y su salto mínimo no se contagia');

/* cada gimnasio recuerda su unidad de vista */
setUnit('lb');
setActiveGym(gymA);
chk(db.settings.unit === 'kg', 'Forum se ve en kilos');
setActiveGym(gymB);
chk(db.settings.unit === 'lb', 'y el de la pareja en libras: cada uno con la suya');
setUnit('kg');

suite('Gimnasios — cambiar a media sesión');
db.routines.push({ id:'rg', name:'Hombro', split:(db.splits[0]||{}).id,
  exercises:[{ id:'x', name:'Lateral Raise Polea', key:'lateral raise polea' }] });
startSession('rg');
db.active.exercises[0].sets[0].w = '20';          /* escrito con la torre en kg */
setActiveGym(gymA);
chk(exUnit('lateral raise polea') === 'lb', 'en Forum el ejercicio pasa a libras');
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 44.09) < 0.1,
    'los 20 kg ya escritos se convierten a 44,09 lb: el mismo peso');
setActiveGym(gymB);
chk(Math.abs(parseFloat(db.active.exercises[0].sets[0].w) - 20) < 0.01, 'y de vuelta sin deriva');
db.active = null;

suite('Gimnasios — desde cero y perfiles compartibles');
window.__gymBase = 'kg';
document.getElementById('newgymname').value = 'Gym vacío';
createGym({ preventDefault(){} });
chk(db.gym.name === 'Gym vacío' && stackConf('lateral raise polea') === null,
    'desde cero: la torre queda sin configurar');
chk(exMeta('lateral raise polea').equip === 'placas', 'pero el implemento se adivina del nombre («polea»)');

/* compartir el gimnasio de la pareja: el perfil lleva equipo y máquinas */
const prof = gymProfile(gymB);
chk(prof.kind === 'gimnasio' && prof.gym.name === 'Gym de mi pareja', 'el perfil es un .json del gimnasio');
chk(prof.gym.machines['lateral raise polea'].stack.unit === 'kg', 'con la config de sus máquinas');
chk(prof.gym.id === undefined, 'y sin id: al importarlo se genera otro');

/* la pareja lo importa en su app */
const nAntes = db.gyms.length;
window.__gymImport = JSON.parse(JSON.stringify(prof));
applyGymImport();
chk(db.gyms.length === nAntes + 1 && db.gym.name === 'Gym de mi pareja', 'importarlo lo agrega y te cambia ahí');
chk(exUnit('lateral raise polea') === 'kg', 'con las máquinas ya configuradas');

/* el restaurador de respaldos también reconoce un perfil de gimnasio */
importBackup(JSON.stringify(prof));
chk(els['modalhost'].innerHTML.includes('Agregar el gimnasio'), 'importarlo por «Restaurar respaldo» redirige bien');
closeModal();

/* administrar: renombrar y eliminar */
document.getElementById('gymrename').value = 'Smart Fit Coapa';
renameGym({ preventDefault(){} }, db.settings.gymId);
chk(db.gym.name === 'Smart Fit Coapa', 'renombrar el gimnasio');
askDeleteGym(db.settings.gymId);
chk(els['modalhost'].innerHTML.includes('actual'), 'el gimnasio activo no se elimina: pide cambiarte antes');
closeModal();
const otroId = db.gyms.find(g => g.id !== db.settings.gymId).id;
window.__confirmFn = null;
askDeleteGym(otroId);
window.__confirmFn();
chk(!db.gyms.some(g => g.id === otroId), 'uno guardado sí se elimina');
chk(db.gyms.length >= 1 && db.gyms.some(g => g.id === db.settings.gymId), 'y siempre queda un gimnasio activo');

/* =====================================================================
   ACTUALIZAR EN SEGUNDO PLANO: el aviso llega en el gimnasio
   ===================================================================== */
suite('Actualizar en segundo plano — la red lenta ya no lo impide');
/* con la red del gym, el documento se sirve de la copia local pero la
   descarga sigue por detrás; estas piezas tienen que existir en pareja */
chk(swSrc.includes('e.waitUntil(red)'), 'el SW no abandona la descarga cuando gana la copia local');
chk(/servidoDeCopia/.test(swSrc) && swSrc.includes('avisarDocumentoFresco'),
    'y solo avisa cuando el fresco llegó tarde (si llegó a tiempo, ya lo estás viendo)');
chk(/documento-fresco/.test(swSrc) && /documento-fresco/.test(html),
    'el mensaje del SW y el que escucha la app son el mismo');
chk(html.includes("addEventListener('online'"), 'la app también busca versión al recuperar la conexión');
chk(!swSrc.includes('redConPrisa'), 'la carrera vieja (que tiraba la descarga) ya no existe');

/* =====================================================================
   ARREGLOS DE SESIÓN EN CURSO: quitar ejercicios y el default al agregar
   ===================================================================== */
suite('Quitar un ejercicio de la sesión en curso');
resetDB();
db.routines.push({ id:'r1', name:'Torso', split:(db.splits[0]||{}).id, exercises:[
  { id:'a', name:'Banca', key:'banca' }, { id:'b', name:'Remo', key:'remo' }] });
startSession('r1');
/* el que se agregó por error, guardado también en la rutina */
window.__keepRoutine = true;
document.getElementById('sessnewex').value = 'Curl raro';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises.length === 3 && db.routines[0].exercises.length === 3,
    'el error de la pareja: agregado a la sesión Y a la rutina');
removeSessionEx(2);
chk(els['modalhost'].innerHTML.includes('también de la rutina'),
    'como también vive en la rutina, pregunta qué hacer');
doRemoveSessionEx(true);
chk(db.active.exercises.length === 2, 'se quita de la sesión');
chk(db.routines[0].exercises.length === 2 && !db.routines[0].exercises.some(e => e.key === 'curl raro'),
    'y también de la rutina: el error queda deshecho');
/* quitar solo de hoy: la rutina no se toca */
db.active.open = 1;
removeSessionEx(0);
chk(els['modalhost'].innerHTML.includes('Quitar solo de la sesión'), 'ofrece quitarlo solo por hoy');
doRemoveSessionEx(false);
chk(db.active.exercises.length === 1 && db.active.exercises[0].key === 'remo',
    'desaparece de la sesión de hoy');
chk(db.routines[0].exercises.length === 2, 'pero la rutina queda como estaba');
chk(db.active.open === 0, 'y el ejercicio que estaba abierto sigue siendo el mismo');
/* uno que no está en la rutina: sin preguntas de rutina */
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'Face pull';
sessionAddExercise({ preventDefault(){} });
removeSessionEx(1);
chk(!els['modalhost'].innerHTML.includes('también de la rutina'),
    'si no vive en la rutina, no pregunta por ella');
doRemoveSessionEx(false);
chk(db.active.exercises.length === 1, 'y se quita sin más');
db.active = null;

suite('Agregar a media sesión — dos botones, la rutina por defecto');
resetDB();
db.routines.push({ id:'r1', name:'Pull', split:(db.splits[0]||{}).id, exercises:[] });
startSession('r1');
promptAddExercise();
chk(window.__keepRoutine === true, 'el default es guardar en la rutina, no «solo por hoy»');
chk(els['modalhost'].innerHTML.includes('Agregar a la rutina') &&
    els['modalhost'].innerHTML.includes('Solo por hoy'),
    'dos botones explícitos en lugar del switch');
chk(!els['modalhost'].innerHTML.includes('keepRoutineBtn'), 'el switch confuso ya no existe');
chk(els['modalhost'].innerHTML.includes('Pull'), 'el texto dice a qué rutina se guarda');
document.getElementById('sessnewex').value = 'Press militar';
sessionAddExercise({ preventDefault(){} });
chk(db.routines[0].exercises.length === 1 && db.routines[0].exercises[0].key === 'press militar',
    'con el default, el ejercicio queda guardado en la rutina');
db.active = null;

suite('El botón del gimnasio siempre a la vista en la sesión');
/* el caso real: 90 minutos adentro de un gimnasio nuevo, con UN solo
   gimnasio configurado — el botón para crear el segundo tiene que estar
   ahí mismo, en la cabecera de la sesión */
resetDB();
db.gyms = [normGym({ name:'Mi gimnasio', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id, exercises:[] });
startSession('r1');
chk(sessionHeadHTML().includes('Mi gimnasio'), 'con un solo gimnasio el botón sale igual, con su nombre');
chk(sessionHeadHTML().includes('gymPickerModal'), 'y abre el selector, que tiene «Nuevo gimnasio» a un toque');
db.active = null;

/* =====================================================================
   UNIDADES SIN DERIVA: kg → lb → kg tiene que volver exacto
   ===================================================================== */
suite('Unidades — ida y vuelta sin deriva (lo que reportó la pareja)');
resetDB();
db.gyms = [normGym({ name:'Mi gimnasio', unit:'lb' }, 'lb')];
db.settings.gymId = db.gyms[0].id;
invalidatePlates();
db.settings.unit = 'lb';
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Curl', key:'curl' }] });
startSession('r1');
setVal(0, 0, 'w', '10'); setVal(0, 0, 'r', '10');
setUnit('kg');
chk(db.active.exercises[0].sets[0].w === '4.54', '10 lb escritas se ven como 4,54 kg');
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '10', 'y de vuelta son 10 lb exactas (antes quedaban 10,01)');
setUnit('kg'); setUnit('lb'); setUnit('kg'); setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '10', 'ni con varias vueltas seguidas se degrada');
/* re-escribir el peso actualiza el canónico */
setVal(0, 0, 'w', '12');
setUnit('kg');
chk(db.active.exercises[0].sets[0].w === '5.44', 'un valor re-escrito parte de cero: 12 lb → 5,44 kg');
setUnit('lb');
chk(db.active.exercises[0].sets[0].w === '12', 'y también regresa exacto');
/* guardar viendo la otra unidad ya no contamina el historial */
setUnit('kg');
finishSession();
setUnit('lb');
chk(fmtW(db.history[db.history.length-1].entries[0].sets[0].w) === '12',
    'guardado viendo kg, el historial en lb dice 12 — no 12,01');

/* torre de placas: el mismo arreglo al alternar la unidad de la máquina */
startSession('r1');
setVal(0, 0, 'w', '10');
exMeta('curl').equip = 'placas';
setExStack('curl', 'unit', 'kg');
chk(db.active.exercises[0].sets[0].w === '4.54', 'la torre pasa a kg y lo escrito se convierte');
setExStack('curl', 'unit', 'lb');
chk(db.active.exercises[0].sets[0].w === '10', 'torre de vuelta a lb: exacto, sin 10,01');
db.active = null;
exMeta('curl').equip = null;
exMeta('curl').stack = { unit:null, step:null, start:null };

suite('Unidades — el inventario no se corrompe: solo cambia el lente');
setUnit('kg');
db.gym.plates = [10, 20, 2.5, 5].map(kg => ({ kg, pairs:2, on:true }));
invalidatePlates();
setUnit('lb'); setUnit('kg');
chk(db.gym.plates.map(p => p.kg).join(',') === '10,20,2.5,5',
    'alternar unidades jamás reescribe los discos guardados');
/* los decimales que vio la pareja: inventario SEMBRADO en libras, visto en kilos */
db.gym.plates = defaultGym('lb').plates;
invalidatePlates();
chk(fmtW(db.gym.plates[0].kg) === '20,41',
    'un juego sembrado en lb se ve con decimales en kg (un disco de 45 lb SON 20,41 kg): no es corrupción');
/* y su remedio: restaurar el juego estándar en la unidad actual */
window.__confirmFn = null;
askResetGymKind('plates');
window.__confirmFn();
chk(db.gym.plates.map(p => p.kg).join(',') === '25,20,15,10,5,2.5,1.25',
    'restaurar deja el juego estándar limpio en kg');
askResetGymKind('bars');
window.__confirmFn();
chk(db.gym.bars.find(b => b.def).kg === 20, 'las barras también se restauran (olímpica de 20 kg)');

suite('Unidades — el juego estándar intacto sigue a la unidad, solo');
resetDB();
db.gyms = [normGym({ name:'G', unit:'kg' }, 'kg')];
db.settings.gymId = db.gyms[0].id;
db.settings.unit = 'kg'; db.gym.unit = 'kg';
db.gym.plates = defaultGym('kg').plates;
db.gym.bars = defaultGym('kg').bars;
db.gym.dumbbells = defaultGym('kg').dumbbells;
invalidatePlates();
setUnit('lb');
chk(fmtW(db.gym.plates[0].kg) === '45', 'sin tocar nada, en lb aparecen los discos estándar de lb (45…), no 55,12');
chk(fmtW(db.gym.dumbbells[0].kg) === '5', 'y las mancuernas de 5 en 5 lb');
setUnit('kg');
chk(db.gym.plates.map(p => p.kg).join(',') === '25,20,15,10,5,2.5,1.25', 'de regreso, el juego de kg limpio');
setUnit('lb'); setUnit('kg'); setUnit('lb'); setUnit('kg');
chk(db.gym.plates[0].kg === 25, 'infinitas vueltas: siempre limpio, sin botones');
/* un inventario EDITADO no se reemplaza: esos discos existen de verdad */
db.gym.plates.find(p => Math.abs(p.kg - 1.25) < 1e-9).on = false;
setUnit('lb');
chk(Math.abs(db.gym.plates[0].kg - 25) < 1e-9 && fmtW(db.gym.plates[0].kg) === '55,12',
    'editado (destildaste el de 1,25): se conserva y en lb se ve su peso real, 55,12');
setUnit('kg');
chk(db.gym.plates.find(p => Math.abs(p.kg - 1.25) < 1e-9).on === false,
    'y tu edición sigue ahí al volver a kg');

suite('Renombrar splits y días');
resetDB();
db.splits = [{ id:'s1', name:'PPL', active:true, created:new Date().toISOString() }];
db.routines.push({ id:'ra', name:'Armas/Delts', split:'s1', exercises:[] });
db.history.push({ id:'h1', routineId:'ra', routineName:'Armas/Delts',
  date:new Date().toISOString(), duration:60, entries:[] });
/* el caso real: el typo «Armas/Delts» */
startSession('ra');
document.getElementById('routinename').value = 'Arms/Delts';
renameRoutine({ preventDefault(){} }, 'ra');
chk(db.routines[0].name === 'Arms/Delts', 'el día se renombra: adiós «Armas»');
chk(db.active.routineName === 'Arms/Delts', 'la sesión en curso adopta el nombre nuevo');
chk(splitSessions('s1').length === 1, 'el historial no se desengancha: las sesiones van por id, no por nombre');
db.active = null;
/* el split también */
document.getElementById('splitname').value = 'Arnold Split';
renameSplit({ preventDefault(){} }, 's1');
chk(db.splits[0].name === 'Arnold Split', 'el split se renombra');
/* y los botones están donde se esperan, con el lápiz (no el icono de copiar) */
const lapiz = 'M4 20l1-4L16 5l3 3L8 19l-4 1z';
view = { name:'routine', id:'ra' };
chk(routineHeadHTML().includes('promptRenameRoutine') && routineHeadHTML().includes(lapiz),
    'la cabecera del día tiene su botón de renombrar con lápiz');
view = { name:'split', id:'s1' };
const cabSplit = splitHeadHTML();
chk(cabSplit.includes('promptRenameSplit') && cabSplit.includes(lapiz),
    'el del split ya no se disfraza de icono de duplicar');
view = { name:'home' };

/* =====================================================================
   CONFIG POR SPLIT: el mismo ejercicio, reglas distintas por plan
   ===================================================================== */
suite('Config por split — rango, series y descanso propios');
resetDB();
db.splits = [
  { id:'sh', name:'Hipertrofia', active:true,  created:new Date().toISOString(), exconf:{} },
  { id:'sf', name:'Fuerza',      active:false, created:new Date().toISOString(), exconf:{} }];
db.routines = [
  { id:'rh', name:'Torso H', split:'sh', exercises:[{ id:'a', name:'Banca', key:'banca' }] },
  { id:'rf', name:'Torso F', split:'sf', exercises:[{ id:'b', name:'Banca', key:'banca' }] }];
/* en el split de fuerza: 4–6 reps, 2 series y 4:00 de descanso */
db.splits[1].exconf['banca'] = { lo:4, hi:6, sets:2, rest:240 };
sess('banca', [S(60,6), S(60,6), S(60,6)]);   /* historial COMPARTIDO: 60×6 */

view = { name:'routine', id:'rh' };
chk(effRange('banca').lo === 8 && effRange('banca').hi === 12, 'en hipertrofia rige lo general (8–12)');
let sg = computeSuggestion('banca');
chk(sg.type === 'hold' && sg.sets === 3, 'con 6 reps ahí toca consolidar, en sus 3 series');
chk(restSecs('banca') === 90, 'y descansar 1:30 (el general de hipertrofia)');

view = { name:'routine', id:'rf' };
chk(effRange('banca').lo === 4 && effRange('banca').hi === 6, 'en fuerza rigen SUS 4–6');
sg = computeSuggestion('banca');
chk(sg.type === 'up', 'las MISMAS 6 reps ahí son tope del rango → subir peso');
chk(sg.sets === 2, 'en las 2 series fijadas de ese split');
chk(restSecs('banca') === 240, 'con su descanso de 4:00');
chk(exMeta('banca').lo == null && exMeta('banca').hi == null,
    'todo sin tocar la config general del ejercicio');

suite('Config por split — la sesión manda sobre el split en curso');
startSession('rf');                /* sesión del split de fuerza… */
activateSplit('sh');               /* …y a media sesión pones en curso el otro */
chk(effRange('banca').hi === 6, 'la sesión sigue rigiéndose por SU split (fuerza), no por el activo');
db.active.exercises[0].sets[0] = { w:'62.5', r:'6', rir:'' };
finishSession();
chk(prog('banca').fail === 0,
    'al guardar, 6 reps se juzgan con el rango de fuerza (éxito) — no con el 8–12 del split activo');
view = { name:'home' };
chk(effRange('banca').hi === 12, 'sin sesión, vuelve a mandar el split en curso');

suite('Config por split — sobrevive, viaja y muere con su split');
chk(db.splits.find(x => x.id === 'sf').exconf['banca'].lo === 4,
    'cambiar de split en curso no toca la config: vive en su split');
/* copiar un día a otro split lleva su config, sin pisar la del destino */
db.splits.push({ id:'s2', name:'Nuevo', active:false, created:new Date().toISOString(), exconf:{} });
window.__moveTo = 's2'; window.__moveCopy = true;
doMoveRoutine('rf');
chk(db.splits.find(x => x.id === 's2').exconf['banca'].hi === 6,
    'copiar el día lleva la config de sus ejercicios al split destino');
/* borrar el split se lleva su config; lo general queda intacto */
window.__confirmFn = null;
deleteSplit('sf');
window.__confirmFn();
view = { name:'home' };
chk(!db.splits.some(x => x.id === 'sf'), 'el split de fuerza se borra');
chk(effRange('banca').hi === 12 && exMeta('banca').lo == null,
    'banca vuelve a lo general, que nunca se tocó');

/* los inputs de la ficha escriben en el split del contexto */
view = { name:'exercise', key:'banca', exname:'Banca', rid:'rh' };
chk(viewExercise().includes('Personalizar para este split') && !viewExercise().includes('Solo en este split'),
    'sin nada configurado, la ficha solo enseña el botón de personalizar');
view.splitConf = true;   /* lo que hace el botón (openSplitConf), sin el render del stub */
chk(viewExercise().includes('Solo en este split'), 'al tocarlo se despliega la sección del split');
setSplitConf('banca', 'sets', '2');
view = { name:'exercise', key:'banca', exname:'Banca', rid:'rh' };   /* ficha reabierta, sin tocar el botón */
chk(viewExercise().includes('Solo en este split'), 'con algo ya configurado, la sección sale desplegada sola');
setSplitConf('banca', 'sets', '2');
chk(db.splits.find(x => x.id === 'sh').exconf['banca'].sets === 2, 'escribe en el split de la rutina de origen');
setSplitConf('banca', 'sets', '');
chk(!db.splits.find(x => x.id === 'sh').exconf['banca'], 'en blanco, la config vacía se limpia sola');
view = { name:'home' };

/* series fijadas: el coach no suma la serie extra por estancamiento */
resetDB();
db.splits = [{ id:'s1', name:'A', active:true, created:new Date().toISOString(),
  exconf:{ curl: { sets:2 } } }];
const planas = [S(30,9), S(30,9)];
sess('curl', planas); sess('curl', planas); sess('curl', planas); sess('curl', planas);
sg = computeSuggestion('curl');
chk(db.progress['curl'].stall >= 3 && sg.sets === 2,
    'estancado 3+ sesiones, pero las 2 series fijadas se respetan: sin serie extra');

suite('Almacenamiento — tamaño real y cuota');
/* la cuota típica de localStorage es ~5 MB por sitio; medir lo que ocupa todo */
const kb = JSON.stringify(db).length / 1024;
chk(kb < 5000, `los datos actuales ocupan ${Math.round(kb)} KB: sobra sitio (cuota ~5 MB)`);
chk(viewSettings().includes(' KB'), 'ajustes muestra cuánto ocupan tus datos');
/* si el navegador rechazara la escritura, la app no revienta y avisa UNA vez */
const setItemReal = localStorage.setItem;
localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
window.__quotaWarned = false;
let exploto = false;
try{ save(); }catch(e){ exploto = true; }
chk(!exploto, 'save() sobrevive a un QuotaExceededError sin reventar');
chk(els['modalhost'].innerHTML.includes('No se pudo guardar'), 'y avisa que descargues respaldo');
els['modalhost'].innerHTML = '';
save();
chk(els['modalhost'].innerHTML === '' && window.__quotaWarned === true,
    'el aviso sale una sola vez, no en cada tecla');
localStorage.setItem = setItemReal;
save();

/* =====================================================================
   CADA SPLIT PROGRESA POR SU HILO (historial compartido)
   ===================================================================== */
suite('El coach ancla en la última sesión DEL split en contexto');
resetDB();
db.splits = [
  { id:'sA', name:'A', active:true,  created:new Date().toISOString(), exconf:{} },
  { id:'sB', name:'B', active:false, created:new Date().toISOString(), exconf:{ calf: { lo:6, hi:8, sets:1 } } }];
db.routines = [
  { id:'rA', name:'Pierna A', split:'sA', exercises:[{ id:'a', name:'Calf', key:'calf' }] },
  { id:'rB', name:'Pierna B', split:'sB', exercises:[{ id:'b', name:'Calf', key:'calf' }] }];
Object.assign(exMeta('calf'), { lo:15, hi:20, step:2 });
/* historia: 16×15×2 en A (hace 4 días) y luego 18×6 en B (hace 2) */
db.history.push({ id:'h1', routineId:'rA', routineName:'Pierna A',
  date:new Date(Date.now() - 4*864e5).toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(16,15), S(16,15)] }] });
db.history.push({ id:'h2', routineId:'rB', routineName:'Pierna B',
  date:new Date(Date.now() - 2*864e5).toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(18,6)] }] });
view = { name:'routine', id:'rA' };
let sgg = computeSuggestion('calf');
chk(sgg.w === 16 && sgg.sets === 2 && sgg.type === 'reps',
    'en A ancla en SU 16×15: mismo 16 kg y 2 series — ya no «consolida 18»');
view = { name:'routine', id:'rB' };
sgg = computeSuggestion('calf');
chk(sgg.w === 18 && sgg.sets === 1, 'y B sigue su propio hilo desde el 18×6');

suite('Un mes en el otro split — sin castigo por pausa ni saltos de peso');
/* A quedó hace 30 días; B se siguió entrenando (hace 2, ya en 30 kg) */
db.history[0].date = new Date(Date.now() - 30*864e5).toISOString();
db.history[1].entries[0].sets = [S(30,8)];
view = { name:'routine', id:'rA' };
sgg = computeSuggestion('calf');
chk(sgg.type !== 'back', 'volver a A tras un mes NO descuenta por pausa: el movimiento siguió vivo en B');
chk(sgg.w === 16, 'y retoma el hilo de A donde quedó (16 kg) — nunca salta a los 30 de B');
view = { name:'routine', id:'rB' };
chk(computeSuggestion('calf').w > 30 || computeSuggestion('calf').reps > 0, 'B sigue progresando desde sus 30');
/* abandonado en TODOS los splits, la pausa sí aplica */
db.history[1].date = new Date(Date.now() - 30*864e5 + 36e5).toISOString();
view = { name:'routine', id:'rA' };
chk(computeSuggestion('calf').type === 'back', 'un mes sin hacerlo en NINGÚN split → sí es vuelta tras pausa');

suite('Hilos por split — bordes');
/* primera vez en un split nuevo: usa el historial global, no arranca de cero */
db.splits.push({ id:'sC', name:'C', active:false, created:new Date().toISOString(), exconf:{} });
db.routines.push({ id:'rC', name:'Pierna C', split:'sC', exercises:[{ id:'c', name:'Calf', key:'calf' }] });
view = { name:'routine', id:'rC' };
let le = lastEntry('calf');
chk(le !== null && le.entry.sets[0].w === 30, 'un split que nunca lo vio cae al hilo global (la sesión más reciente)');
/* borrar la rutina de B: sus sesiones quedan sin split y solo alimentan el global */
db.routines = db.routines.filter(r => r.id !== 'rB');
view = { name:'routine', id:'rA' };
chk(computeSuggestion('calf') !== null && lastEntry('calf').entry.sets[0].w === 16,
    'borrada la rutina de B, el hilo de A sigue intacto y nada revienta');
/* historial importado (sin routineId) se atribuye por nombre de rutina */
db.history.push({ id:'h3', routineId:null, routineName:'Pierna A',
  date:new Date().toISOString(), duration:60,
  entries:[{ key:'calf', name:'Calf', sets:[S(17,15)] }] });
chk(lastEntry('calf').entry.sets[0].w === 17, 'una sesión importada cuenta en el hilo del día con su nombre');
view = { name:'home' };

/* =====================================================================
   COMPARTIR SPLITS COMPLETOS
   ===================================================================== */
suite('Compartir splits — exportar el plan entero');
resetDB();
db.splits = [{ id:'s1', name:'PPL de regalo', active:true, created:new Date().toISOString(),
  exconf:{ 'lateral raise': { lo:12, hi:20, sets:4 } } }];
db.routines = [
  { id:'r1', name:'Push', split:'s1', exercises:[
    { id:'a', name:'Bench Press (Barbell)', key:'bench press (barbell)' },
    { id:'b', name:'Lateral Raise', key:'lateral raise' }] },
  { id:'r2', name:'Pull', split:'s1', exercises:[{ id:'c', name:'Row', key:'row' }] }];
Object.assign(exMeta('lateral raise'), { muscle:'hombros', equip:'placas' });
Object.assign(exMeta('lateral raise').stack, { unit:'lb', step:5, start:5 });
exMeta('bench press (barbell)').equip = 'barra';
const sprof = splitProfile('s1');
chk(sprof.kind === 'split' && sprof.split.days.length === 2, 'el perfil lleva el split con sus 2 días en orden');
chk(sprof.split.days[0].exercises.length === 2 && sprof.split.days[1].exercises[0].name === 'Row',
    'con los ejercicios de cada día');
chk(sprof.split.exmeta['lateral raise'].stack.unit === 'lb' &&
    sprof.split.exmeta['bench press (barbell)'].equip === 'barra',
    'y la configuración completa de cada ejercicio (equipo, torre…)');
chk(sprof.split.exconf['lateral raise'].sets === 4, 'incluida la config por split (series, rango)');

suite('Compartir splits — la pareja lo importa');
resetDB();
db.splits = [{ id:'viejo', name:'Su split', active:true, created:new Date().toISOString(), exconf:{} }];
exMeta('bench press (barbell)').equip = 'mancuerna';   /* SU config previa: no debe pisarse */
window.__splitImport = JSON.parse(JSON.stringify(sprof));
applySplitImport();
const traido = db.splits.find(x => x.name === 'PPL de regalo');
chk(!!traido && traido.active, 'el split llega y queda en curso');
chk(db.splits.find(x => x.id === 'viejo').active === false, 'el suyo pasa a guardados, no se borra');
chk(splitRoutines(traido.id).length === 2 && splitRoutines(traido.id)[0].exercises.length === 2,
    'días y ejercicios completos');
chk(traido.exconf['lateral raise'].sets === 4, 'la config por split viaja con él');
chk(exMeta('lateral raise').equip === 'placas' && exMeta('lateral raise').stack.unit === 'lb',
    'los ejercicios nuevos llegan configurados (la polea en lb, lista)');
chk(exMeta('bench press (barbell)').equip === 'mancuerna',
    'pero en los que ella ya tenía, SU configuración manda');
chk(nextDay().routine.name === 'Push', 'y el coach ya sabe que hoy toca Push');
/* el restaurador de respaldos también lo reconoce */
importBackup(JSON.stringify(sprof));
chk(els['modalhost'].innerHTML.includes('Agregar el split'), 'importarlo por «Restaurar respaldo» redirige bien');
closeModal();
/* un archivo roto no revienta nada */
importSplitFile('{"kind":"split"}');
chk(els['modalhost'].innerHTML.includes('no válido'), 'un .json incompleto avisa en vez de romper');
closeModal();
importSplitFile('esto no es json');
chk(els['modalhost'].innerHTML.includes('no válido'), 'y uno corrupto también');
closeModal();
/* la lista de splits ofrece importar */
view = { name:'splits' };
chk(viewSplits().includes('importSplitFile') && splitHeadHTML() === '', 'la pantalla de splits tiene el botón de importar');
view = { name:'split', id:traido.id };
chk(splitHeadHTML().includes('exportSplit'), 'y la ficha del split, el de compartir');
view = { name:'home' };

/* =====================================================================
   AL FALLO A PROPÓSITO: el aviso de RIR 0 respeta el programa
   ===================================================================== */
suite('Al fallo a propósito — por split, no global');
resetDB();
db.splits = [
  { id:'mm', name:'Min-Max', active:true,  created:new Date().toISOString(), exconf:{}, failOk:true },
  { id:'nm', name:'Normal',  active:false, created:new Date().toISOString(), exconf:{} }];
db.routines = [
  { id:'rm', name:'Upper MM', split:'mm', exercises:[{ id:'e1', name:'Press', key:'press' }] },
  { id:'rn', name:'Upper N',  split:'nm', exercises:[{ id:'e2', name:'Press', key:'press' }] }];
const rir0 = [S(50,8,0), S(50,8,0), S(50,7,0), S(50,6,0)];
/* tres sesiones al fallo, todas del split marcado */
for(let i = 0; i < 3; i++) db.history.push({ id:'f'+i, routineId:'rm', routineName:'Upper MM',
  date:new Date(Date.now() - (5-i)*864e5).toISOString(), duration:60,
  entries:[{ key:'press', name:'Press', sets:rir0 }] });
chk(failureHabit() === null, 'RIR 0 sistemático en el split marcado NO dispara el regaño: es el programa');
/* el mismo hábito en un split normal sigue protegido */
for(let i = 0; i < 2; i++) db.history.push({ id:'n'+i, routineId:'rn', routineName:'Upper N',
  date:new Date(Date.now() - (2-i)*864e5).toISOString(), duration:60,
  entries:[{ key:'press', name:'Press', sets:rir0 }] });
chk(failureHabit() !== null, 'en un split normal el aviso sigue vivo: la protección no se pierde');

/* la nota al terminar la sesión también respeta la marca */
startSession('rm');
for(let i = 0; i < 4; i++){
  if(!db.active.exercises[0].sets[i]) addSet(0);
  setVal(0, i, 'w', '50'); setVal(0, i, 'r', '8'); setVal(0, i, 'rir', '0');
}
finishSession();
chk(!els['modalhost'].innerHTML.includes('llegaste al fallo'),
    'al guardar una sesión Min-Max, sin sermón por el RIR 0');
closeModal();
startSession('rn');
for(let i = 0; i < 4; i++){
  if(!db.active.exercises[0].sets[i]) addSet(0);
  setVal(0, i, 'w', '50'); setVal(0, i, 'r', '8'); setVal(0, i, 'rir', '0');
}
finishSession();
chk(els['modalhost'].innerHTML.includes('llegaste al fallo'),
    'la misma sesión en el split normal sí recibe la nota educativa');
closeModal();

/* la marca viaja en el perfil compartible */
const pfMM = splitProfile('mm');
chk(pfMM.split.failOk === true, 'el .json del split lleva la marca de fallo a propósito');
db.splits = [{ id:'v', name:'Suyo', active:true, created:new Date().toISOString(), exconf:{} }];
db.routines = []; db.history = [];
window.__splitImport = JSON.parse(JSON.stringify(pfMM));
applySplitImport();
chk(db.splits.find(x => x.name === 'Min-Max').failOk === true, 'y al importarlo se conserva');
/* el toggle en la ficha del split */
view = { name:'split', id: db.splits.find(x => x.name === 'Min-Max').id };
chk(viewSplit().includes('toggleSplitFailOk') && viewSplit().includes('Al fallo a propósito'),
    'la ficha del split tiene el toggle');
view = { name:'home' };

/* =====================================================================
   AJUSTE FINO DE LA TORRE: discos añadidos, palanca o pin giratorio
   ===================================================================== */
suite('Torres con ajuste fino — placa N + extra, no «placa 27»');
resetDB();
db.gym = defaultGym('kg'); invalidatePlates();
/* el jalón al pecho real: 10 en 10 lb desde 10, con dos discos de 5,5 al lado */
exMeta('jalon pecho').equip = 'placas';
Object.assign(exMeta('jalon pecho').stack, { unit:'lb', step:10, start:10, extra:5.5, extraMax:11 });
let snp = stackSnap('jalon pecho', 25.5 * KGxLB);
chk(snp.index === 2 && snp.extra === 5.5 && snp.value === 25.5,
    '25,5 lb = placa 2 (20) + un disco de 5,5 — no una placa inventada');
snp = stackSnap('jalon pecho', 31 * KGxLB);
chk(snp.index === 2 && snp.extra === 11 && snp.value === 31,
    '31 lb = placa 2 + los dos discos (11): el extra puede pasar del salto de la torre');
snp = stackSnap('jalon pecho', 30 * KGxLB);
chk(snp.index === 3 && snp.extra === 0, '30 lb exactas siguen siendo la placa 3 sin extra');
chk(Math.abs(effStep('jalon pecho', 20) - 5.5*KGxLB) < 1e-6,
    'el salto del coach pasa a ser el fino (5,5 lb), no el de la torre (10)');
chk(stackExtraLabel(stackSnap('jalon pecho', 25.5*KGxLB)) === ' + 5,5', 'la etiqueta dice «+ 5,5»');

/* el coach progresa por el salto fino */
sess('jalon pecho', [S(Math.round(20*KGxLB*1000)/1000, 12), S(Math.round(20*KGxLB*1000)/1000, 12)]);
s = computeSuggestion('jalon pecho');
chk(Math.abs(s.w - 25.5*KGxLB) < 0.001, 'de 20 lb el coach salta a 25,5 (placa 2 + disco), no a 30');

/* el pin giratorio: torre de 15 en 15, el pin suma 0, 5 o 10 */
exMeta('prensa sentada').equip = 'placas';
Object.assign(exMeta('prensa sentada').stack, { unit:'kg', step:15, start:15, extra:5, extraMax:10 });
snp = stackSnap('prensa sentada', 35);
chk(snp.index === 2 && snp.extra === 5 && snp.value === 35, '35 kg = placa 2 (30) + pin en 5');
snp = stackSnap('prensa sentada', 40);
chk(snp.index === 2 && snp.extra === 10 && snp.value === 40, '40 kg = placa 2 + pin en 10');
chk(effStep('prensa sentada', 30) === 5, 'y el salto del coach es el del pin (5)');

/* sin «hasta», el máximo es un solo escalón del fino */
exMeta('polea lateral').equip = 'placas';
Object.assign(exMeta('polea lateral').stack, { unit:'kg', step:5, start:5, extra:2.5 });
snp = stackSnap('polea lateral', 12.5);
chk(snp.index === 2 && snp.extra === 2.5, 'palanca de 2,5: placa 2 + 2,5');
chk(stackSnap('polea lateral', 10).extra === 0, 'y los pesos de placa exacta no usan la palanca');

/* sin ajuste fino, todo sigue exactamente igual que antes */
exMeta('remo torre').equip = 'placas';
Object.assign(exMeta('remo torre').stack, { unit:'kg', step:5, start:5 });
snp = stackSnap('remo torre', 27);
chk(snp.index === 5 && snp.value === 25 && snp.extra === 0 && stackExtraLabel(snp) === '',
    'una torre normal ni se entera del cambio');

/* el ajuste fino viaja: foto del gimnasio y perfil de split */
chk(machineSnapshot(exMeta('jalon pecho')).stack.extra === 5.5,
    'la foto por gimnasio guarda el ajuste fino');
db.splits = [{ id:'sf1', name:'S', active:true, created:new Date().toISOString(), exconf:{} }];
db.routines = [{ id:'rf1', name:'D', split:'sf1', exercises:[{ id:'x', name:'Jalon Pecho', key:'jalon pecho' }] }];
const pfx = splitProfile('sf1');
chk(pfx.split.exmeta['jalon pecho'].stack.extra === 5.5, 'y el perfil de split también lo lleva');

/* =====================================================================
   LAS SERIES FIJADAS TAMBIÉN VALEN SIN HISTORIAL (el bug de la pareja)
   ===================================================================== */
suite('Series fijadas — la sesión abre con las filas correctas');
resetDB();
db.splits = [{ id:'sx', name:'Importado', active:true, created:new Date().toISOString(),
  exconf:{ 'back squat': { lo:4, hi:7, sets:3 }, 'hip thrust': { sets:4 } } }];
db.routines = [{ id:'rx', name:'Lower', split:'sx', exercises:[
  { id:'a', name:'Back Squat', key:'back squat' },
  { id:'b', name:'Hip Thrust', key:'hip thrust' },
  { id:'c', name:'Crunch', key:'crunch' }] }];
/* el escenario exacto: split recién importado, CERO historial */
startSession('rx');
chk(db.active.exercises[0].sets.length === 3, 'ejercicio nuevo con 3 series fijadas → 3 filas, no 1');
chk(db.active.exercises[1].sets.length === 4, 'y el de 4 series abre con sus 4 filas');
chk(db.active.exercises[2].sets.length === 1, 'sin series fijadas ni historial, sí queda 1 (como antes)');

/* agregar a media sesión un ejercicio nuevo con series fijadas */
db.splits[0].exconf['face pull'] = { sets:2 };
window.__keepRoutine = false;
document.getElementById('sessnewex').value = 'Face Pull';
sessionAddExercise({ preventDefault(){} });
chk(db.active.exercises[3].sets.length === 2, 'agregado a media sesión también respeta sus 2 series');

/* cambiar las series con la sesión en curso ajusta las filas */
view = { name:'exercise', key:'back squat', exname:'Back Squat', rid:'rx' };
setSplitConf('back squat', 'sets', '2');
chk(db.active.exercises[0].sets.length === 2, 'bajar de 3 a 2 quita la fila vacía sobrante');
setSplitConf('back squat', 'sets', '4');
chk(db.active.exercises[0].sets.length === 4, 'y subir a 4 agrega filas vacías al vuelo');
/* pero lo ya anotado jamás se borra */
db.active.exercises[0].sets[3] = { w:'60', r:'5', rir:'' };
db.active.exercises[0].sets[2] = { w:'60', r:'5', rir:'' };
setSplitConf('back squat', 'sets', '2');
chk(db.active.exercises[0].sets.length === 4, 'bajar a 2 con series anotadas en la 3 y 4 NO las borra');
db.active = null;

/* con historial de 3 series y fijadas 2, la sesión abre con 2 */
db.history.push({ id:'hh', routineId:'rx', routineName:'Lower', date:new Date().toISOString(), duration:60,
  entries:[{ key:'crunch', name:'Crunch', sets:[S(0,12), S(0,12), S(0,12)] }] });
exMeta('crunch').type = 'corporal';
db.splits[0].exconf['crunch'] = { sets:2 };
view = { name:'home' };
startSession('rx');
chk(db.active.exercises[2].sets.length === 2, 'historial de 3 series + fijadas 2 → la sesión abre con 2');
db.active = null;

/* =====================================================================
   APPLE SALUD VÍA ATAJOS
   ===================================================================== */
suite('Apple Salud — el botón, el atajo y su URL');
resetDB();
chk(db.settings.health === 'off', 'apagado por defecto: nadie ve botones que no pidió');
chk(healthShortcutURL(62) === 'shortcuts://run-shortcut?name=Hierro&input=text&text=62',
    'la URL invoca el atajo «Hierro» con los minutos como entrada');
chk(healthBtnHTML(3720) === '', 'con la función apagada, el resumen no enseña el botón');
db.settings.health = 'on';
chk(healthBtnHTML(3720).includes('62 min') && healthBtnHTML(3720).includes('logToHealth(62)'),
    'encendida: botón con los minutos reales de la sesión (62)');
chk(healthBtnHTML(20).includes('logToHealth(1)'), 'una sesión cortísima redondea a mínimo 1 min');
/* el resumen de sesión lo incluye */
db.routines.push({ id:'r1', name:'T', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Curl', key:'curl' }] });
startSession('r1');
db.active.exercises[0].sets[0] = { w:'20', r:'10', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('Guardar en Apple Salud'), 'el resumen al terminar trae el botón');
closeModal();
/* y la descarga también (una descarga sigue siendo entrenamiento) */
startSession('r1', true);
db.active.exercises[0].sets[0] = { w:'18', r:'8', rir:'' };
finishSession();
chk(els['modalhost'].innerHTML.includes('Guardar en Apple Salud'), 'el resumen de descarga también');
closeModal();
/* ajustes: toggle + guía */
view = { name:'settings' };
chk(viewSettings().includes('toggleHealth') && viewSettings().includes('healthInfo()'),
    'ajustes tiene el toggle y la guía del atajo');
db.settings.health = 'off';
chk(!viewSettings().includes('healthInfo()'), 'apagado, la guía se esconde');
/* la guía describe los Atajos reales de iOS 26: Sustraer + Fecha/Duración */
healthInfo();
const guia = els['modalhost'].innerHTML;
chk(guia.includes('Sustraer') && guia.includes('Duración') && guia.includes('Fecha ajustada'),
    'la guía usa los nombres reales de iOS 26 (Sustraer, Fecha, Duración)');
chk(guia.includes('Recibir') && guia.includes('Texto'),
    'y avisa de marcar Texto en el bloque «Recibir» para que entre el dato');
chk(guia.includes('0 km') && guia.includes('NO las dejes en blanco'),
    'y exige Calorías/Distancia con valor: en blanco la acción falla (verificado en iPhone real)');
closeModal();
view = { name:'home' };

/* =====================================================================
   CIERRE DE SESIÓN: el titular y su recibo
   ===================================================================== */
suite('Cierre — el titular siempre tiene noticia que dar');
resetDB();
db.settings.health = 'off';
db.routines.push({ id:'rf', name:'Torso', split:(db.splits[0]||{}).id, exercises:[
  { id:'a', name:'Curl', key:'curl' }, { id:'b', name:'Press', key:'press' }] });
/* dos récords el mismo día: gana el titular la mejora MAYOR, no la primera */
sess('curl',  [S(20,10)]);          /* e1RM 26,7 */
sess('press', [S(50,10)]);          /* e1RM 66,7 */
startSession('rf');
db.active.exercises[0].sets[0] = { w:'21', r:'10', rir:'' };   /* +5 %  */
db.active.exercises[1].sets[0] = { w:'60', r:'10', rir:'' };   /* +20 % */
finishSession();
let fin = els['modalhost'].innerHTML;
chk(fin.includes('Nuevo récord · Press'), 'el titular es el récord con mayor mejora (Press, +20 %)');
chk(fin.includes('También hoy') && fin.includes('Curl'), 'el otro récord baja a «También hoy»');
chk(fin.includes('1RM estimado') && fin.includes('sobre tu marca'), 'la cifra viene explicada');
chk(fin.includes('<svg') && fin.includes('polyline'), 'y con su curva de progresión');
chk(fin.includes('El detalle') && fin.includes('Total movido'), 'debajo, el recibo con su total');
chk(fin.includes('fin-mark'), 'los ejercicios con récord van marcados en el recibo');
chk(fin.includes('Ver historial') && fin.includes('Listo'), 'las salidas siguen a mano');
closeModal();

suite('Cierre — sin récord manda el peso movido');
resetDB();
db.settings.health = 'off';
db.routines.push({ id:'rv', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Sentadilla', key:'sentadilla' }] });
startSession('rv');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
addSet(0);
db.active.exercises[0].sets[1] = { w:'60', r:'10', rir:'' };
finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('Peso movido') && fin.includes(fmtInt(1200)), '1 200 kg movidos como titular');
chk(!fin.includes('récord'), 'y ni se menciona la palabra récord: hoy no tocaba');
chk(fin.includes('Tu primera vez de este día'), 'sin sesión previa, lo dice en vez de comparar');
closeModal();
/* la segunda vez ya hay contra qué medirse: mismo peso, una serie más
   (subir el peso sería récord y el titular pasaría a ser ese) */
startSession('rv');
db.active.exercises[0].sets[0] = { w:'60', r:'10', rir:'' };
addSet(0); db.active.exercises[0].sets[1] = { w:'60', r:'10', rir:'' };
addSet(0); db.active.exercises[0].sets[2] = { w:'60', r:'10', rir:'' };
finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('+' + fmtInt(600)) && fin.includes('anterior'),
    'compara contra tu Pierna anterior (1 200 → 1 800 kg)');
chk(!fin.includes('récord'), 'más volumen sin más peso no es récord, y no se inventa uno');
closeModal();

suite('Cierre — casos que no son kilos');
chk(entryVolume('sentadilla', [S(60,10)]) === 600, 'volumen = peso × reps');
exMeta('dominadas').type = 'corporal';
exMeta('fondos a').type = 'asistido';
exMeta('plancha').type = 'tiempo';
chk(entryVolume('fondos a', [S(25,10)]) === 0, 'en asistidos los kg son ayuda: no cuentan como volumen');
chk(entryVolume('plancha', [S(0,45)]) === 0, 'y en los de tiempo las «reps» son segundos');
/* una sesión solo de peso corporal tiene titular igual: reps */
resetDB();
db.settings.health = 'off';
exMeta('dominadas').type = 'corporal';
db.routines.push({ id:'rc', name:'Core', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Dominadas', key:'dominadas' }] });
startSession('rc');
db.active.exercises[0].sets[0] = { w:'', r:'12', rir:'' };
finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('12') && fin.includes('reps') && fin.includes('Total de reps'),
    'sin peso que sumar, el titular y el total van en reps');
closeModal();

suite('Cierre — descarga y Apple Salud');
resetDB();
db.routines.push({ id:'rd', name:'Full', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Banca', key:'banca' }] });
sess('banca', [S(60,12), S(60,12)]);
db.settings.health = 'on';
startSession('rd', true);
db.active.exercises[0].sets[0] = { w:'55', r:'8', rir:'' };
finishSession();
fin = els['modalhost'].innerHTML;
chk(fin.includes('Descarga guardada') && !fin.includes('Nuevo récord'), 'la descarga tiene su propio encabezado');
chk(!fin.includes('polyline'), 'y sin curva: bajar el peso a propósito no es una caída que enseñar');
chk(fmtDurShort(3140) === '52 min' && fmtDurShort(3852) === '1 h 4 min', 'el pie no dice «52 min 0 s»');
chk(fin.includes('Guardar en Apple Salud') && fin.includes('btn health'),
    'el botón de Salud sale en ámbar, ya no camuflado');
closeModal();
db.settings.health = 'off';

suite('Cierre — la curva');
chk(sparkSVG([1], '#D7A44B') === '', 'con un solo punto no se dibuja nada');
chk(sparkSVG([1,2,3], '#D7A44B').includes('circle'), 'con dos o más, línea y punto final marcado');
chk(fmtInt(8528) === '8 528' && fmtInt(950) === '950', 'los miles se separan con espacio fino');

/* =====================================================================
   HISTORIAL: el panel arriba, el diario abajo
   ===================================================================== */
suite('Historial — récords guardados con la sesión');
resetDB();
db.routines.push({ id:'rh', name:'Torso', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Banca', key:'banca' }] });
sess('banca', [S(60,10)]);
startSession('rh');
db.active.exercises[0].sets[0] = { w:'65', r:'10', rir:'' };
finishSession(); closeModal();
let ult = db.history[db.history.length-1];
chk(Array.isArray(ult.prs) && ult.prs.length === 1 && ult.prs[0].key === 'banca',
    'la sesión guarda SUS récords: el historial ya no tiene que recalcularlos');
chk(ult.prs[0].now > ult.prs[0].prev, 'con la marca nueva y la anterior');
/* el historial viejo se repara solo, en una pasada */
db.history.forEach(h => { delete h.prs; });
migratePRs();
chk(db.history.every(h => Array.isArray(h.prs)), 'migratePRs deja todas las sesiones con su lista');
chk(db.history[db.history.length-1].prs.length === 1, 'y reconstruye el récord que hubo');
chk(db.history[0].prs.length === 0, 'la primera vez de un ejercicio no es récord: no hay contra qué');

suite('Historial — el panel');
resetDB();
db.routines.push({ id:'rp', name:'Pierna', split:(db.splits[0]||{}).id,
  exercises:[{ id:'a', name:'Sentadilla', key:'sentadilla' }] });
for(let i = 6; i >= 0; i--) sess('sentadilla', [S(60+i, 10), S(60+i, 10)], i*7 + 2);
view = { name:'history' };
let pan = histPanelHTML();
chk(pan.includes('Peso movido') && pan.includes('semana en curso'), 'el titular es la semana en curso');
chk(pan.includes('hp-bars') && (pan.match(/<span class="(now)?"/g)||[]).length >= 8,
    'con las últimas 9 semanas en barras');
chk(pan.includes('class="now"'), 'y la semana en curso va punteada: aún no termina');
chk(pan.includes('Tu fuerza') && pan.includes('sentadilla') && pan.includes('polyline'),
    'debajo, tus levantamientos con su curva de 1RM');
chk(pan.includes('openExerciseByKey'), 'y cada uno lleva a su ficha');
/* semanas y volúmenes */
const wv = weeklyVolumes(9);
chk(wv.length === 9 && wv[8].current === true, 'weeklyVolumes: 8 cerradas + la que corre');
chk(weekStart('2026-08-26T12:00:00Z').getDay() === 1, 'la semana empieza en lunes');
chk(weekLabel(weekStart(new Date())) === 'Esta semana', 'la semana actual se llama por su nombre');

suite('Historial — el diario');
const dia = histDiaryHTML();
chk(dia.includes('hd-wk') && dia.includes('sesi'), 'las sesiones van agrupadas por semana con su resumen');
chk(nSesiones(1) === '1 sesión' && nSesiones(3) === '3 sesiones', 'y el singular lleva su acento');
chk(dia.includes('hd-row') && dia.includes('class="d"'), 'cada sesión es una fila con su día del mes');
chk(dia.includes('fin-row') && dia.includes('fin-sets'), 'y al abrirla, el mismo recibo del cierre');
chk(dia.includes('Editar sesión') && dia.includes('class="dz"'),
    'editar es botón y borrar es enlace: no compiten');
/* regresión: la clase «pr» global (el 1RM de la ficha) es display:flex y
   partía el <details> en dos columnas — el detalle salía al lado, no debajo */
resetDB();
db.history.push({ id:'hx', routineId:'rz', routineName:'T', date:new Date().toISOString(),
  duration:3600, entries:[{ key:'banca', name:'Banca', sets:[S(60,10)] }],
  prs:[{ key:'banca', name:'Banca', now:80, prev:75, unit:'kg', assist:false }] });
const fila = histRowHTML(db.history[0]);
chk(fila.includes('class="hd is-pr"') && !fila.includes('class="hd pr"'),
    'la sesión con récord NO usa la clase global «pr»: el detalle va debajo, no al lado');
chk(receiptHTML(db.history[0].entries, new Set(['banca'])).includes('fin-row is-pr'),
    'y el recibo tampoco');
/* saber si está abierta o cerrada, y dónde acaba cada una */
chk(fila.includes('hd-cv'), 'cada fila lleva su galón: se ve si está plegada o abierta');
const hoja = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
chk(hoja.includes('details.hd[open]{') && hoja.includes('border-radius:14px'),
    'abierta se vuelve tarjeta con borde: con tres abiertas no se mezclan');
chk(hoja.includes('details.hd[open] .hd-cv{transform:rotate(90deg)'), 'y el galón gira al abrir');
chk(hoja.includes('prefers-reduced-motion') , 'con su respeto al movimiento reducido');
/* las semanas se nombran por distancia, con sus fechas debajo */
const hace3 = weekStart(new Date(Date.now() - 21*864e5));
chk(weekLabel(hace3) === 'Hace 3 semanas', 'una semana vieja dice a cuánto está');
chk(weekLabel(weekStart(new Date(Date.now() - 7*864e5))) === 'Semana pasada', 'y la anterior, por su nombre');
chk(/\d/.test(weekRange(hace3)) && weekRange(hace3).includes('–'), 'debajo van las fechas exactas');
/* las series se agrupan por peso */
chk(setsLine('sentadilla', [S(60,10), S(60,10), S(60,9)]) === '60 × 10 · 10 · 9',
    '«60 × 10 · 10 · 9» en vez de repetir el peso tres veces');
chk(setsLine('sentadilla', [S(60,10), S(50,12)]).includes('60 × 10') &&
    setsLine('sentadilla', [S(60,10), S(50,12)]).includes('50 × 12'),
    'si el peso cambia, se abre otro grupo');
chk(setsLine('sentadilla', [S(60,10,2), S(60,9,1)]).includes('RIR 2·1'), 'el RIR se anota si lo registraste');
exMeta('domin').type = 'corporal';
chk(setsLine('domin', [S(0,12), S(0,11)]) === '12 · 11 reps', 'en peso corporal manda la rep, no el cero');

suite('Historial — no se dibuja lo que no cabe');
resetDB();
db.routines.push({ id:'rq', name:'T', split:(db.splits[0]||{}).id, exercises:[] });
for(let i = 0; i < 45; i++) sess('press', [S(50,10)], 60 - i);
view = { name:'history' };
chk((histDiaryHTML().match(/details class="hd/g)||[]).length === 40,
    'de entrada se pintan 40 sesiones, no 400');
chk(histDiaryHTML().includes('Ver 5 sesiones más'), 'y un botón para traer las que faltan');
moreHistory();
chk((histDiaryHTML().match(/details class="hd/g)||[]).length === 45, 'que las trae');
view = { name:'home' };

suite('Máquinas de discos con peso propio — anotas solo los discos');
resetDB();
exMeta('remomaq').equip = 'discos';
exMeta('remomaq').points = 2;
exMeta('remomaq').base = 11.3;
chk(discosOffset('remomaq') === 11.3, 'el peso del aparato anotado se vuelve el offset');
chk(Math.abs(typedToKg('remomaq', 30) - 41.3) < 1e-9, 'teclear 30 son 41,3 kg reales (30 + 11,3 del carro)');
chk(Math.abs(kgToTyped('remomaq', 41.3) - 30) < 1e-9, 'y 41,3 reales se enseñan como 30 al teclear');
chk(kgToTyped('remomaq', 5) === 0, 'un histórico menor que el aparato no produce discos negativos');
/* sin base anotada, nada cambia */
exMeta('jalonx').equip = 'discos';
chk(discosOffset('jalonx') === 0 && typedToKg('jalonx', 30) === 30,
    'sin peso de aparato anotado, lo tecleado sigue siendo el total');
/* en asistidos el número es AYUDA, no carga: el offset no aplica */
exMeta('fondasist').equip = 'discos'; exMeta('fondasist').base = 20; exMeta('fondasist').type = 'asistido';
chk(discosOffset('fondasist') === 0, 'en asistidos no se suma nada: ahí se anota la ayuda');

/* al guardar la sesión, el historial recibe el peso real */
db.active = { routineId:'', routineName:'X', start: Date.now(), exercises:[
  { key:'remomaq', name:'Remo en máquina', sugg:null, sets:[{ w:'30', r:'10', rir:'2' }] }
]};
let entD = collectEntries(db.active);
chk(Math.abs(entD[0].sets[0].w - 41.3) < 1e-9, 'la serie tecleada como 30 se guarda como 41,3');
db.active.exercises[0].sets = [{ w:'0', r:'10', rir:'' }];
entD = collectEntries(db.active);
chk(Math.abs(entD[0].sets[0].w - 11.3) < 1e-9, 'teclear 0 guarda el aparato vacío (11,3)');
/* y si hubo conversión de unidad, el offset se suma sobre el canónico */
db.active.exercises[0].sets = [{ w:'22.05', wkg: 10, r:'8', rir:'' }];
entD = collectEntries(db.active);
chk(Math.abs(entD[0].sets[0].w - 21.3) < 1e-9, 'con kg canónicos (conversión de unidad) el offset se suma igual');

/* el chip de volumen compara peras con peras */
sess('remomaq', [S(41.3, 10)], 7);
db.active.exercises[0].sets = [{ w:'30', r:'10', rir:'' }];
const viD = vsLastInfo(0);
chk(viD && viD.pct === 100, 'volumen vs última sesión: 30 tecleado hoy = 41,3 guardado ayer (100 %)');

/* el caso reportado: base 11,3, cargó 15 por lado, tecleó 30 */
db.gym.plates = [
  { kg:20, pairs:2, on:true }, { kg:10, pairs:2, on:true },
  { kg:5, pairs:2, on:true }, { kg:2.5, pairs:2, on:true }
];
invalidatePlates();
const twD = targetWeight(db.active.exercises[0]);
chk(Math.abs(twD - 41.3) < 1e-9, 'el objetivo de carga parte del peso real');
const lpD = loadPlan('remomaq', twD);
chk(lpD && Math.abs(lpD.perPointKg - 15) < 1e-9 && lpD.exact,
    'y la calculadora dice 15 por lado EXACTOS — ya no «10 por lado ≈ 31,3»');
const stripD = loadStripHTML(0);
chk(stripD.includes('Anotas (solo discos)') && stripD.includes('>30 kg<'),
    'la tira de carga enseña también lo que se anota: 30');

/* la sugerencia del coach se guarda real pero se teclea sin la base */
db.active.exercises[0].sugg = { w:41.3, reps:8, sets:3, type:'up', msg:'', why:'' };
const rowD = setRowHTML(0, 0, { w:'', r:'', rir:'' }, db.active.exercises[0].sugg, 'normal');
chk(rowD.includes('placeholder="30"'), 'el placeholder de la serie sugiere 30, listo para teclear');
chk(weightColLabel('remomaq', 'normal') === 'kg discos', 'la columna avisa: ahí van solo los discos');

/* el aviso de una sola vez */
const noticeD = dbNoticeHTML('remomaq');
chk(noticeD.includes('Anota solo los discos') && noticeD.includes('11,3'),
    'la primera vez sale el aviso con el peso del aparato');
db.settings.discosNoticeSeen = new Date().toISOString();
chk(dbNoticeHTML('remomaq') === '', 'y una vez entendido, no vuelve');
delete db.settings.discosNoticeSeen;

/* el calentamiento también parte del peso real */
const wpD = warmupPlan(0);
chk(wpD && Math.abs(wpD.W - 41.3) < 1e-9, 'la escalera de calentamiento se calcula sobre 41,3, no sobre 30');

/* en libras, el puente respeta la unidad activa */
db.settings.unit = 'lb';
exMeta('pressLb').equip = 'discos';
exMeta('pressLb').base = toKg(10);   /* el aparato pesa 10 lb */
chk(Math.abs(fromKgEx('pressLb', kgToTyped('pressLb', typedToKg('pressLb', 30))) - 30) < 0.01,
    'teclear 30 lb y volver da 30 lb, sin arrastre');
chk(fmtWEx('pressLb', typedToKg('pressLb', 30)) === '40', '30 lb en discos + 10 lb de aparato = 40 lb reales');
db.settings.unit = 'kg';
db.active = null;

/* ---------- resultado ---------- */
console.log('\n' + '='.repeat(50));
console.log(fail === 0 ? `TODOS LOS TESTS OK (${pass})` : `${fail} FALLOS de ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
