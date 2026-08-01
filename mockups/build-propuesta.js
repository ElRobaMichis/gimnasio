#!/usr/bin/env node
/* =====================================================================
   Mockup de la propuesta: inventario del gimnasio + calculadora de carga.
   Solo diseño — nada de esto existe todavía en index.html.
   Correr con:  node mockups/build-propuesta.js
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { phone, tabs, svgIcon, doc } = require('./shell');

const { PLATE, num, barbell, dumbbell, plateList, sideText } = require('./shell');

/* tira de carga que se añade a la tarjeta del ejercicio */
function loadStrip(perSide, total, { note = '' } = {}){
  return `
  <button class="load">
    <div class="load-row">
      <span class="load-l">Cargar la barra</span>
      <span class="load-v">${num(total)} kg <span class="chev">›</span></span>
    </div>
    ${barbell(perSide, { h:74, scale:0.62 })}
    <div class="load-row" style="margin-top:8px">
      <span class="load-l">Por lado</span>
      <span class="load-v">${sideText(perSide)}</span>
    </div>
    ${note ? `<div class="why" style="padding-left:0;margin-top:9px">${note}</div>` : ''}
  </button>`;
}

/* ---------- piezas de chrome reusadas ---------- */
const head = (mark, title, goal = 'Hipertrofia') => `
  <div class="head-row"><div class="mark">${mark}</div><div class="goal">${goal}</div></div>
  <div class="title">${title}</div>
  <div class="knurl"></div>`;

const subhead = (back, title, meta, tools = '') => `
  <button class="back">‹ ${back}</button>
  <div class="head-row"><div class="title sm">${title}</div>${tools ? `<div class="tools">${tools}</div>` : ''}</div>
  ${meta ? `<div class="meta">${meta}</div>` : '<div style="height:12px"></div>'}
  <div class="knurl"></div>`;

const sessHead = (meta, { clock = '31:12', rest = null } = {}) => `
  <div class="sess-top">
    <div class="grow">
      <div class="clock">${clock}</div>
      <div class="sess-meta">${meta}</div>
    </div>
    <div class="sess-actions">
      <button class="end">Terminar</button>
      <button class="unitbtn">kg ⇄</button>
    </div>
  </div>
  <button class="${rest ? 'rest on' : 'rest'}">
    <div class="rest-row">
      <span class="rest-l">${rest ? 'Descansando' : 'Descanso'}</span>
      <span class="rest-t">${rest ? rest.t : '2:00'}</span>
    </div>
    <div class="rest-track"><div class="rest-fill" style="width:${rest ? rest.pct : 0}%"></div></div>
  </button>`;

const check = on => `<span class="check${on ? ' on' : ''}">${svgIcon('check')}</span>`;
const qty = n => `<span class="qty"><button>−</button><span>${n}</span><button>+</button></span>`;

const setRow = (i, w, r, rir, state) => `
  <div class="set${state === 'done' ? ' done' : ''}${state === 'now' ? ' now' : ''}">
    <span class="i">${i}</span>
    <span class="cell${state === 'done' ? '' : ' ph'}">${w}</span>
    <span class="cell${state === 'done' ? '' : ' ph'}">${r}</span>
    <span class="cell ph">${rir}</span>
    <span class="ck${state === 'done' ? ' on' : ''}">${svgIcon('check')}</span>
    <span class="xbtn">✕</span>
  </div>`;

const gridH = () => `
  <div class="grid-h"><span>#</span><span>kg</span><span>reps</span><span>rir</span><span></span><span></span></div>`;

/* ---------- pantallas ---------- */
const S = [];
const add = o => S.push(o);

/* ============ 1. inventario ============ */
add({
  n:'P01', title:'Ajustes · Mi equipo',
  desc:'Una sección nueva en Ajustes. Es lo único que hay que configurar una vez: qué discos, qué barras y qué mancuernas hay en tu gimnasio. Sin esto la app no puede decirte cómo cargar nada.',
  top: head('Hierro', 'Ajustes'),
  tabs: tabs('ajustes'),
  main: `
    <div class="sect">Mi equipo</div>
    <div class="list">
      <button class="line">
        <div><div class="l-t">Discos</div><div class="l-d">7 tipos · 2 pares de cada uno</div></div>
        <div class="l-v">1,25 – 25 kg <span class="chev">›</span></div>
      </button>
      <button class="line">
        <div><div class="l-t">Barras</div><div class="l-d">Olímpica 20 kg por defecto</div></div>
        <div class="l-v">3 <span class="chev">›</span></div>
      </button>
      <button class="line">
        <div><div class="l-t">Mancuernas</div><div class="l-d">De 1 en 1 hasta 24, luego de 2 en 2</div></div>
        <div class="l-v">1 – 40 kg <span class="chev">›</span></div>
      </button>
    </div>
    <div class="hint">Con esto la app te dice exactamente qué discos poner en cada lado, tanto en las series
      de trabajo como en el calentamiento — y redondea las sugerencias a pesos que de verdad puedes armar.</div>

    <div class="sect">Objetivo</div>
    <div class="goals">
      <button class="goal-c on"><div class="g-t">Hipertrofia</div><div class="g-d">8–12 reps</div></button>
      <button class="goal-c"><div class="g-t">Fuerza</div><div class="g-d">4–6 reps</div></button>
      <button class="goal-c"><div class="g-t">Ambas</div><div class="g-d">6–10 reps</div></button>
    </div>`
});

add({
  n:'P02', title:'Discos',
  desc:'La pantalla que pediste. El punto de color es el código internacional (rojo 25, azul 20, amarillo 15, verde 10, blanco 5) para que reconozcas el disco de un vistazo. La cantidad es en pares, que es como se cargan.',
  top: subhead('Mi equipo', 'Discos', '7 tipos · 14 pares en total',
    `<button aria-label="Agregar disco">${svgIcon('plus')}</button>`),
  main: `
    <div class="row" style="justify-content:space-between;margin:18px 0 4px">
      <div class="sect" style="margin:0">Pesos disponibles</div>
      <div class="pill-sw"><button class="on">kg</button><button>lb</button></div>
    </div>
    ${[[25,2,true],[20,2,true],[15,2,true],[10,2,true],[5,3,true],[2.5,2,true],[1.25,1,true],[0.5,0,false]]
      .map(([kg, n, on]) => `
      <div class="line">
        <div class="row grow" style="gap:14px;${on ? '' : 'opacity:.4'}">
          <i class="plate-dot" style="background:${(PLATE[kg] || {}).c || '#4C4F54'}"></i>
          <div>
            <div class="l-t">${num(kg)} kg</div>
            <div class="l-d">${on ? `${n} par${n === 1 ? '' : 'es'} · ${n*2} discos` : 'No lo tienes'}</div>
          </div>
        </div>
        <div class="row" style="flex:none;gap:12px">
          ${on ? qty(n) : ''}
          ${check(on)}
        </div>
      </div>`).join('')}
    <div class="hint">Los pares importan: si solo tienes un par de 20, la app no te propondrá cargar dos por lado.
      El <b>+</b> de arriba sirve para discos raros (fraccionales de 0,25, discos viejos en libras).</div>
    <div class="dock"><button class="btn">Listo</button></div>`
});

add({
  n:'P03', title:'Barras',
  desc:'Cada barra pesa distinto y eso cambia toda la cuenta. La predeterminada se usa cuando el ejercicio no dice otra cosa; en la ficha de cada ejercicio se puede fijar una barra concreta.',
  top: subhead('Mi equipo', 'Barras', '3 de 5 · olímpica por defecto',
    `<button aria-label="Agregar barra">${svgIcon('plus')}</button>`),
  main: `
    <div class="sect">Tus barras</div>
    ${[['Olímpica','20 kg',true,true],['Olímpica corta','15 kg',true,false],['Barra Z','7 kg',true,false],
       ['Barra recta','10 kg',false,false],['Multipower','20 kg',false,false]]
      .map(([name, w, on, def]) => `
      <div class="line">
        <div class="grow" style="${on ? '' : 'opacity:.4'}">
          <div class="l-t">${name} ${def ? '<span class="pill hold">Por defecto</span>' : ''}</div>
          <div class="l-d">${on ? 'Disponible' : 'No la tienes'}</div>
        </div>
        <div class="row" style="flex:none;gap:12px">
          <span class="l-v">${w}</span>
          ${check(on)}
        </div>
      </div>`).join('')}
    <div class="hint">La multipower cuenta aparte porque su barra guiada suele pesar distinto —
      si no sabes cuánto, déjala fuera y anota el peso como si fuera una máquina.</div>
    <div class="dock"><button class="btn">Listo</button></div>`
});

add({
  n:'P04', title:'Mancuernas',
  desc:'Casi ningún gimnasio tiene la serie completa. El rango rápido llena la lista de un golpe y luego destildas las que falten — así la app nunca te sugiere una mancuerna que no existe.',
  top: subhead('Mi equipo', 'Mancuernas', '18 pares · 1 – 40 kg',
    `<button aria-label="Agregar mancuerna">${svgIcon('plus')}</button>`),
  main: `
    <div class="sect">Rango rápido</div>
    <div class="list">
      <div class="line"><div class="l-t">Desde</div><div class="l-v"><span class="cell ph" style="width:58px;padding:8px 4px;font-size:13px">1</span> kg</div></div>
      <div class="line"><div class="l-t">Hasta</div><div class="l-v"><span class="cell ph" style="width:58px;padding:8px 4px;font-size:13px">24</span> kg</div></div>
      <div class="line"><div class="l-t">Salto</div><div class="l-v">1 kg <span class="chev">›</span></div></div>
    </div>

    <div class="row" style="justify-content:space-between;margin:26px 0 4px">
      <div class="sect" style="margin:0">Las que tienes</div>
      <div class="pill-sw"><button class="on">kg</button><button>lb</button></div>
    </div>
    ${[[1,true],[2,true],[3,true],[4,true],[5,true],[6,true],[7,false],[8,true],[9,false],[10,true]]
      .map(([kg, on]) => `
      <div class="line">
        <div class="grow" style="${on ? '' : 'opacity:.4'}">
          <div class="l-t">${kg} kg</div>
          <div class="l-d">${on ? '1 par' : 'No lo tienes'}</div>
        </div>
        <div class="row" style="flex:none;gap:12px">${on ? qty(1) : ''}${check(on)}</div>
      </div>`).join('')}
    <div class="hint" style="text-align:center">12 kg · 14 kg · 16 kg · …</div>
    <div class="dock"><button class="btn">Listo</button></div>`
});

/* ============ 2. la calculadora en la sesión ============ */
add({
  n:'P05', title:'Sesión · barra cargada',
  desc:'El corazón de la función. Debajo del veredicto del coach aparece la barra dibujada con los discos de hoy y el desglose por lado. Un vistazo y sabes qué agarrar, sin hacer la cuenta de cabeza.',
  top: sessHead('Pierna · 3 de 8 series', { clock:'18:42', rest:{ t:'1:24', pct:30 } }),
  sticky: true,
  tabs: tabs('sesion'),
  main: `
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Squat <em>(Barbell)</em></div>
        <div class="last">Última · <b>70×9</b> · <b>70×8</b> · <b>70×8</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>72,5 kg × 8</b></div></div>
        <div class="why">Llegaste a 9 reps en todas las series con 70 kg. Toca progresar la carga (~2,5 %).</div>
        ${loadStrip([20, 5, 1.25], 72.5)}
        ${gridH()}
        ${setRow(1, '72,5', '9', '2', 'done')}
        ${setRow(2, '72,5', '8', '1–3', 'now')}
        ${setRow(3, '72,5', '8', '1–3', '')}
        <div class="ex-actions">
          <button>+ Serie</button><button>Calentamiento</button><button>Notas</button>
        </div>
      </div>
      <button class="ex-next">
        <span class="grow">
          <span class="ex-title" style="display:block">Leg Curl <em>(Machine)</em></span>
          <span class="last" style="display:block">Siguiente · <b>35×12</b></span>
        </span>
        <span class="chev">›</span>
      </button>
    </div>`
});

add({
  n:'P06', title:'Cómo cargar la barra',
  desc:'Al tocar la tira se abre el detalle: la barra en grande, la lista de discos por lado con su color y la cuenta completa. El botón de espejo es para las barras que ya vienen cargadas de la serie anterior.',
  top: sessHead('Pierna · 3 de 8 series', { clock:'18:42' }),
  sticky: true,
  tabs: tabs('sesion'),
  main: `<div style="margin-top:2px"><div class="ex-open"><div class="ex-title">Squat <em>(Barbell)</em></div></div></div>`,
  modal: `<div class="overlay"><div class="modal">
    <h2>Cargar 72,5 kg</h2>
    <p class="muted">Squat (Barbell) · serie de trabajo</p>
    ${barbell([20, 5, 1.25], { h:126 })}
    <div class="sect">Por lado</div>
    <div class="list">${plateList([20, 5, 1.25])}</div>
    <div class="hint">Barra olímpica <b>20</b> + discos <b>52,5</b> (26,25 por lado) = <b>72,5 kg</b>.</div>
    <button class="btn" style="margin-top:18px">Listo</button>
    <button class="btn ghost">Cambiar de barra</button>
  </div></div>`
});

add({
  n:'P07', title:'Calentamiento con carga',
  desc:'Lo que pediste para el calentamiento: cada escalón trae su propia barra dibujada. Se lee de arriba abajo mientras vas sumando discos, y la serie de trabajo cierra en verde.',
  top: sessHead('Pierna · 0 de 8 series', { clock:'02:15' }),
  sticky: true,
  tabs: tabs('sesion'),
  main: `<div style="margin-top:2px"><div class="ex-open"><div class="ex-title">Squat <em>(Barbell)</em></div></div></div>`,
  modal: `<div class="overlay"><div class="modal">
    <h2>Calentamiento — Squat</h2>
    <p class="muted">Escalera calculada desde los 72,5 kg de hoy. Descansa 30–60 s entre escalones
      y mueve el peso con intención de velocidad.</p>
    ${[['Serie 1', '37,5 kg × 6', [5, 2.5, 1.25], false],
       ['Serie 2', '55 kg × 3', [15, 2.5], false],
       ['Trabajo', '72,5 kg × 8', [20, 5, 1.25], true]].map(([lbl, txt, plates, work]) => `
      <div class="warm${work ? ' work' : ''}">
        <div class="load-row">
          <span class="load-l"${work ? ' style="color:var(--up)"' : ''}>${lbl}</span>
          <span class="load-v"><b${work ? ' style="color:var(--up)"' : ''}>${txt}</b></span>
        </div>
        ${barbell(plates, { h:62, scale:0.52 })}
        <div class="load-row"><span class="load-l">Por lado</span><span class="load-v">${sideText(plates)}</span></div>
      </div>`).join('')}
    <div class="hint">No registres estas series en la app — solo las de trabajo.</div>
    <button class="btn" style="margin-top:18px">Listo</button>
  </div></div>`
});

add({
  n:'P08', title:'Cuando no sale exacto',
  desc:'El caso que rompe a las apps que no conocen tu gimnasio. Si el coach pide 63,5 kg y con tus discos no existe, redondea al armable más cercano y lo dice — en vez de mandarte a una cifra imposible.',
  top: sessHead('Pierna · 0 de 8 series', { clock:'04:08' }),
  sticky: true,
  tabs: tabs('sesion'),
  main: `
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Romanian Deadlift <em>(Barbell)</em></div>
        <div class="last">Última · <b>60×10</b> · <b>60×10</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>62,5 kg × 8</b></div></div>
        <div class="why">Llegaste a 10 reps en todas las series con 60 kg. Toca progresar la carga (~2,5 %).</div>
        ${loadStrip([20, 1.25], 62.5, {
          note:'El salto exacto pedía 61,5 kg. Con tus discos lo más cercano por arriba es 62,5 — se ajusta solo.'
        })}
        ${gridH()}
        ${setRow(1, '62,5', '8', '1–3', 'now')}
        ${setRow(2, '62,5', '8', '1–3', '')}
        <div class="ex-actions">
          <button>+ Serie</button><button>Calentamiento</button><button>Notas</button>
        </div>
      </div>
    </div>`
});

/* ============ 3. dónde se enchufa ============ */
add({
  n:'P09', title:'Ficha · qué equipo usa',
  desc:'En los ajustes del ejercicio entra una fila nueva. Los importados de Hevy ya traen “(Barbell)” o “(Dumbbell)” en el nombre, así que se detecta solo — la fila está para corregirlo cuando falle.',
  top: `
    <button class="back">‹ Volver</button>
    <div class="title big">Squat</div>
    <div class="title-sub">Barbell</div>
    <div class="knurl"></div>`,
  main: `
    <div class="sect">Ajustes del ejercicio</div>
    <div class="list">
      <div class="line">
        <div><div class="l-t">Equipo</div><div class="l-d">Define si se calcula la carga</div></div>
        <div class="l-v">Barra <span class="chev">›</span></div>
      </div>
      <div class="line">
        <div><div class="l-t">Barra</div><div class="l-d">Olímpica · 20 kg</div></div>
        <div class="l-v">20 kg <span class="chev">›</span></div>
      </div>
      <div class="line"><div class="l-t">Rango de reps</div>
        <div class="l-v"><span class="cell ph" style="width:48px;padding:8px 4px;font-size:13px">8</span>
        <span style="color:var(--dim)">–</span>
        <span class="cell ph" style="width:48px;padding:8px 4px;font-size:13px">12</span></div></div>
      <div class="line"><div class="l-t">Salto mínimo</div><div class="l-v">Auto <span class="chev">›</span></div></div>
      <div class="line"><div class="l-t">Grupo muscular</div><div class="l-v">Pierna <span class="chev">›</span></div></div>
      <div class="line"><div class="l-t">Descanso</div><div class="l-v">3:00 <span class="chev">›</span></div></div>
    </div>
    <div class="hint">Con <b>Equipo · Barra</b>, el salto mínimo pasa a ser el par de discos más pequeño que
      tengas (2 × 1,25 = 2,5 kg): el coach deja de proponer aumentos que no se pueden armar.</div>

    <div class="sect">Cómo se progresa</div>
    <div class="seg4">
      <button class="on">Normal</button><button>Asistido</button><button>Corporal</button><button>Tiempo</button>
    </div>
    <div class="hint">Tú levantas la carga. Progresas subiendo kilos cuando llenas el rango de reps.</div>`
});

add({
  n:'P10', title:'Mancuernas y máquinas',
  desc:'La misma idea sin barra: en mancuernas se redondea al par que existe en tu gimnasio, y en máquinas la app se queda callada porque ahí no hay nada que cargar.',
  top: sessHead('Torso · 2 de 11 series', { clock:'12:30' }),
  sticky: true,
  tabs: tabs('sesion'),
  main: `
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Incline Bench Press <em>(Dumbbell)</em></div>
        <div class="last">Última · <b>18×12</b> · <b>18×12</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>20 kg × 8</b></div></div>
        <button class="load">
          <div class="load-row">
            <span class="load-l">Mancuernas</span>
            <span class="load-v">2 × 20 kg <span class="chev">›</span></span>
          </div>
          ${dumbbell(20)}
          <div class="why" style="padding-left:0;margin-top:6px">El salto exacto pedía 19 kg. Tu gimnasio salta
            de 18 a 20, así que va 20 — y el coach lo cuenta como progreso real.</div>
        </button>
        ${gridH()}
        ${setRow(1, '20', '8', '1–3', 'now')}
        ${setRow(2, '20', '8', '1–3', '')}
        <div class="ex-actions">
          <button>+ Serie</button><button>Calentamiento</button><button>Notas</button>
        </div>
      </div>
      <button class="ex-next">
        <span class="grow">
          <span class="ex-title" style="display:block">Shoulder Press <em>(Machine)</em></span>
          <span class="last" style="display:block">Siguiente · <b>12,3×11</b></span>
        </span>
        <span class="chev">›</span>
      </button>
      <div class="hint">En máquinas no aparece ninguna tira: no hay discos que poner.</div>
    </div>`
});

/* ---------- CSS nuevo que pediría la función ---------- */
const EXTRA = `
  .plate-dot{width:15px;height:15px;border-radius:50%;flex:none}
  .check{width:23px;height:23px;border-radius:7px;border:1px solid var(--line-2);display:flex;
    align-items:center;justify-content:center;color:transparent;flex:none}
  .check.on{background:var(--bone);border-color:var(--bone);color:#0B0B0D}
  .check svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}
  .qty{display:flex;align-items:center;background:var(--surface-2);border-radius:9px;padding:2px;flex:none}
  .qty button{width:30px;height:28px;display:flex;align-items:center;justify-content:center;
    color:var(--dim);font-family:var(--mono);font-size:15px}
  .qty > span{min-width:22px;text-align:center;font-family:var(--mono);font-size:13px;color:var(--bone)}

  .load{display:block;width:100%;text-align:left;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}
  .load-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .load-l{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .load-v{font-family:var(--mono);font-size:12.5px;color:var(--ash);display:flex;align-items:center;gap:6px}
  .load-v b{color:var(--bone);font-weight:500}
  .load svg{margin:4px 0}

  .warm{border-top:1px solid var(--line);padding:14px 0 4px}
  .warm.work{border-top-color:rgba(127,211,168,.3)}
  .modal .warm:first-of-type{border-top:0;padding-top:4px}

  .cell.ph{color:var(--dim)}
  .set.done .cell{color:var(--ash)}
  .modal .sect:first-of-type{margin-top:22px}`;

const body = `
<header class="brief">
  <div class="eyebrow">Propuesta · calculadora de carga · ${S.length} pantallas</div>
  <h1>Cómo cargar<br><em>la barra</em></h1>
  <p>Dos piezas encadenadas. Primero <b>Mi equipo</b>: qué discos, barras y mancuernas hay en tu gimnasio,
  con la misma lógica de inventario que viste en las capturas. Después la <b>calculadora</b>: en cuanto un
  ejercicio usa barra, la app dibuja cómo cargarla — en las series de trabajo y en cada escalón del
  calentamiento.</p>
  <p>Los discos llevan el color del código internacional porque así los reconoces en el rack, no por
  decorar. Todo lo demás es el mismo lenguaje que ya tiene la app: mono para los datos, punto de color
  para el veredicto, línea de un pixel para separar.</p>
  <div class="tokens">
    <div class="token"><i style="background:#C0473E"></i>25 kg</div>
    <div class="token"><i style="background:#3C6FA8"></i>20 kg</div>
    <div class="token"><i style="background:#C2963A"></i>15 kg</div>
    <div class="token"><i style="background:#4C9970"></i>10 kg</div>
    <div class="token"><i style="background:#CFCCC4"></i>5 kg</div>
    <div class="token"><i style="background:#8B8F96"></i>2,5 kg</div>
    <div class="token"><i style="background:#6C7076"></i>1,25 kg</div>
  </div>
</header>

<div class="chapter">
  <div class="k">01</div>
  <h2>Mi equipo</h2>
  <p>Se configura una vez y vive en Ajustes. Es la parte que copiamos de tus capturas: lista con casilla,
  cantidad y conmutador kg/lb, más un <b>+</b> para lo que se salga del catálogo.</p>
</div>
<div class="deck">${S.slice(0, 4).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">02</div>
  <h2>La calculadora</h2>
  <p>Aparece sola en los ejercicios de barra. Nunca pide una decisión: es información que ya estaba
  implícita en la sugerencia del coach, ahora dibujada.</p>
</div>
<div class="deck">${S.slice(4, 8).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">03</div>
  <h2>Dónde se enchufa</h2>
  <p>Dos sitios más: la ficha del ejercicio gana una fila de equipo, y el resto de material —
  mancuernas y máquinas — se comporta de forma coherente.</p>
</div>
<div class="deck">${S.slice(8).map(phone).join('\n')}</div>`;

const out = path.join(__dirname, 'propuesta-calculadora.html');
fs.writeFileSync(out, doc({ title:'Hierro — propuesta: calculadora de carga', extraCss:EXTRA, body }));
console.log(`${S.length} pantallas → ${path.relative(process.cwd(), out)}`);
