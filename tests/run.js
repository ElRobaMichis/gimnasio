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
  .replace("let view = { name:'home' };", "globalThis.view = { name:'home' };");
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
exMeta('press mancuerna').equip = 'mancuerna';
sess('press mancuerna', [S(18,12), S(18,12)]);
s = computeSuggestion('press mancuerna');
chk(s.w === 20 && s.wanted === 19, 'la sugerencia salta al par que sí tienes (19 → 20)');

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

let pl = loadPlan('prensa', 145);
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

/* ---------- resultado ---------- */
console.log('\n' + '='.repeat(50));
console.log(fail === 0 ? `TODOS LOS TESTS OK (${pass})` : `${fail} FALLOS de ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
