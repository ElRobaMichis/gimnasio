#!/usr/bin/env node
/* =====================================================================
   Mockup: agrupar las rutinas en splits, cambiar de split y saber
   qué toca hoy. Solo diseño.
   Correr con:  node mockups/build-splits.js
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { phone, tabs, svgIcon, doc } = require('./shell');

const head = (title, goal = 'Hipertrofia') => `
  <div class="head-row"><div class="mark">Hierro</div><div class="goal">${goal}</div></div>
  <div class="title">${title}</div>
  <div class="knurl"></div>`;

const subhead = (back, title, meta, tools = '') => `
  <button class="back">‹ ${back}</button>
  <div class="head-row"><div class="title sm">${title}</div>${tools ? `<div class="tools">${tools}</div>` : ''}</div>
  ${meta ? `<div class="meta">${meta}</div>` : '<div style="height:12px"></div>'}
  <div class="knurl"></div>`;

/* un día del split: número, nombre y cuándo lo hiciste */
const day = (n, name, sub, { next = false, arrows = false } = {}) => `
  <button class="rowitem${next ? ' next' : ''}">
    <span class="dayn">${n}</span>
    <span class="grow">
      <span class="row-name" style="display:block">${name}${next ? ' <i class="dot up" style="display:inline-block;margin-left:7px;transform:none"></i>' : ''}</span>
      <span class="row-sub" style="display:block">${sub}</span>
    </span>
    ${ arrows
      ? `<span class="chev" style="font-size:17px">↑</span><span class="chev" style="font-size:17px">↓</span>`
      : '<span class="chev">›</span>' }
  </button>`;

const S = [];
const add = o => S.push(o);

/* ============ 1. el día a día ============ */
add({
  n:'S01', title:'Rutinas · qué toca hoy',
  desc:'Lo que gana la pantalla al agrupar en splits: si la app sabe el orden de tus días, sabe cuál sigue. Deja de ser una lista para pasar a decirte qué hacer. El resto queda igual, ordenado por día.',
  top: head('Rutinas'),
  tabs: tabs('rutinas'),
  main: `
    <div class="today">
      <div class="row" style="justify-content:space-between">
        <span class="load-l">Hoy toca</span>
        <span class="pill">Día 2 de 6</span>
      </div>
      <div class="today-n">Pull</div>
      <div class="row-sub">6 ejercicios · el domingo hiciste Push</div>
      <button class="btn" style="margin-top:15px">Empezar</button>
    </div>

    <div class="sect">Esta semana</div>
    <div class="strip">
      <div><div class="n">3</div><div class="l">Sesiones</div></div>
      <div><div class="n">42</div><div class="l">Series</div></div>
      <div><div class="n">7,4<i>t</i></div><div class="l">Volumen</div></div>
    </div>

    <div class="row" style="justify-content:space-between;margin:26px 0 6px">
      <div class="sect" style="margin:0">PPL · 6 días</div>
      <button class="note-a" style="margin:0">Cambiar ›</button>
    </div>
    ${day(1, 'Push', '6 ejercicios · dom 27 jul')}
    ${day(2, 'Pull', '6 ejercicios · jue 24 jul', { next:true })}
    ${day(3, 'Legs', '5 ejercicios · mié 23 jul')}
    ${day(4, 'Push', '6 ejercicios · lun 21 jul')}
    ${day(5, 'Pull', '6 ejercicios · sáb 19 jul')}
    ${day(6, 'Legs', '5 ejercicios · vie 18 jul')}
    <div style="margin-top:20px"><button class="btn ghost">Agregar día</button></div>
    <div class="hint">El punto verde marca el día que sigue en la rotación. Si te saltas uno no pasa nada:
      se cuenta desde el último que entrenaste, no desde el calendario.</div>`
});

/* ============ 2. cambiar de split ============ */
add({
  n:'S02', title:'Cambiar de split',
  desc:'Aquí vive lo que pediste: los splits guardados no se borran, se apartan. Cambiar de PPL a Upper/Lower y volver dentro de tres meses es un toque, y cada uno conserva sus días tal como los dejaste.',
  top: subhead('Rutinas', 'Splits', '1 en curso · 2 guardados',
    `<button aria-label="Nuevo split">${svgIcon('plus')}</button>`),
  tabs: tabs('rutinas'),
  main: `
    <div class="sect">En curso</div>
    <div class="card" style="border-color:rgba(127,211,168,.3)">
      <div class="card-top">
        <div>
          <div class="ex-title" style="font-size:17px">PPL <i class="dot up" style="display:inline-block;margin-left:6px;transform:none"></i></div>
          <div class="last">6 días · desde el 12 de agosto · 18 sesiones</div>
        </div>
        <div class="chev">›</div>
      </div>
      <div class="steps" style="margin-top:12px">
        <div class="bars"><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i><i></i><i></i></div>
        <div class="steps-v"><b>4</b>/6 días esta vuelta</div>
      </div>
    </div>

    <div class="sect">Guardados</div>
    <button class="rowitem">
      <span class="grow">
        <span class="row-name" style="display:block">Torso / Pierna / Full Body</span>
        <span class="row-sub" style="display:block">3 días · 47 sesiones · hasta el 10 ago</span>
      </span>
      <span class="chev">›</span>
    </button>
    <button class="rowitem">
      <span class="grow">
        <span class="row-name" style="display:block">Upper / Lower</span>
        <span class="row-sub" style="display:block">4 días · 22 sesiones · hasta el 3 may</span>
      </span>
      <span class="chev">›</span>
    </button>

    <div class="note">
      <div class="note-t">Cambiar de split no borra tu progreso</div>
      <div class="note-d">Tus marcas viven en cada ejercicio, no en la rutina. Si el press de banca estaba
        en Torso y ahora está en Push, llega con su historial, su récord y la sugerencia del coach
        exactamente donde la dejaste.</div>
    </div>
    <div style="margin-top:4px"><button class="btn ghost">Nuevo split</button></div>`
});

add({
  n:'S03', title:'Un split guardado',
  desc:'Al abrir uno guardado ves sus días tal como quedaron y cuánto lo entrenaste. Ponerlo en curso es un botón: no se copia ni se duplica nada, simplemente vuelve a ser el que manda en el inicio.',
  top: subhead('Splits', 'Torso / Pierna', 'Guardado · 47 sesiones · hasta el 10 ago',
    `<button aria-label="Reordenar días">${svgIcon('sort')}</button>
     <button aria-label="Duplicar split">${svgIcon('copy')}</button>
     <button aria-label="Borrar split">${svgIcon('trash')}</button>`),
  tabs: tabs('rutinas'),
  main: `
    <div class="sect">Sus días</div>
    ${day(1, 'Torso', '9 ejercicios')}
    ${day(2, 'Pierna', '6 ejercicios')}
    ${day(3, 'Full Body', '6 ejercicios')}

    <div class="sect">Cuánto lo usaste</div>
    <div class="list">
      <div class="line"><div class="l-t">Sesiones</div><div class="l-v">47</div></div>
      <div class="line"><div class="l-t">Del</div><div class="l-v">14 feb al 10 ago</div></div>
      <div class="line"><div class="l-t">Volumen movido</div><div class="l-v">96,4 t</div></div>
    </div>

    <div class="dock">
      <button class="btn">Ponerlo en curso</button>
      <div class="hint" style="text-align:center;margin-top:12px">PPL pasa a guardados. Nada se borra.</div>
    </div>`
});

/* ============ 3. empezar uno nuevo ============ */
add({
  n:'S04', title:'Nuevo split',
  desc:'Sin plantillas: solo el nombre. Los días los creas tú, en el orden que quieras, y ese orden es el que la app usará para decirte qué toca. Nada viene decidido de fábrica.',
  top: subhead('Splits', 'Splits', '1 en curso · 2 guardados'),
  tabs: tabs('rutinas'),
  main: `
    <div class="sect">En curso</div>
    <div class="card"><div class="card-top">
      <div><div class="ex-title" style="font-size:17px">PPL</div>
      <div class="last">3 días · 18 sesiones</div></div><div class="chev">›</div>
    </div></div>`,
  modal: `<div class="overlay"><div class="modal">
    <h2>Nuevo split</h2>
    <p class="muted">Un split es el orden de tus días. Ponle nombre y luego le vas creando los días
      que quieras — sin plantillas ni ataduras.</p>
    <div class="stack">
      <input type="text" value="Upper / Lower">
      <button class="btn">Crear y ponerlo en curso</button>
      <button class="btn ghost">Cancelar</button>
    </div>
    <div class="hint">El que tengas ahora pasa a guardados. Puedes volver a él cuando quieras, y tu
      progreso no se toca: vive en cada ejercicio, no en la rutina.</div>
  </div></div>`
});

add({
  n:'S05', title:'El progreso viaja contigo',
  desc:'La pantalla que responde al miedo de cambiar de split. Primer día del PPL recién creado: el press de banca venía de Torso y llega con sus 18×12, su récord y la sugerencia del coach intactos.',
  top: subhead('Rutinas', 'Push', '6 ejercicios · 8–12 reps · 1–3 RIR',
    `<button aria-label="Reordenar">${svgIcon('sort')}</button>
     <button aria-label="Duplicar">${svgIcon('copy')}</button>
     <button aria-label="Borrar">${svgIcon('trash')}</button>`),
  tabs: tabs('rutinas'),
  main: `
    <div class="note up" style="margin-top:2px">
      <div class="note-t">Split nuevo, progreso de siempre</div>
      <div class="note-d">Estos ejercicios ya los entrenabas en Torso. Traen su historial completo, así que
        el coach sigue exactamente donde iba.</div>
    </div>
    <div class="card">
      <div class="card-top"><div class="ex-title">Incline Bench Press <em>(Dumbbell)</em></div><div class="chev">›</div></div>
      <div class="last">Última · <b>18×12</b> · <b>18×12</b> · <b>18×12</b></div>
      <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>20 kg × 8</b></div></div>
      <div class="steps">
        <div class="bars"><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i></div>
        <div class="steps-v"><b>12</b>/12 · rango lleno</div>
      </div>
    </div>
    <div class="card">
      <div class="card-top"><div class="ex-title">Shoulder Press <em>(Machine)</em></div><div class="chev">›</div></div>
      <div class="last">Última · <b>12,3×8</b> · <b>12,3×10</b></div>
      <div class="verdict"><i class="dot hold"></i><div class="v-text hold">Mismo peso (<b>12,3 kg</b>), apunta a <b>11 reps</b></div></div>
      <div class="steps">
        <div class="bars"><i class="hold"></i><i class="hold"></i><i class="hold"></i><i></i><i></i></div>
        <div class="steps-v"><b>10</b>/12</div>
      </div>
    </div>
    <div class="card">
      <div class="card-top"><div class="ex-title">Lateral Raise <em>(Dumbbell)</em></div><div class="chev">›</div></div>
      <div class="last">Sin registros todavía</div>
      <div class="exnote">Nuevo en este split — la primera sesión marca el punto de partida.</div>
    </div>`
});

add({
  n:'S06', title:'Mover un día a otro split',
  desc:'Los días no están casados con su split. Si «Full Body» te sirve también en el nuevo, se mueve o se copia sin tocar su historial. Copiar deja el original donde estaba.',
  top: subhead('Rutinas', 'Full Body', '6 ejercicios · 8–12 reps · 1–3 RIR'),
  tabs: tabs('rutinas'),
  main: `<div style="margin-top:2px">
    <div class="card"><div class="card-top"><div class="ex-title">Squat <em>(Barbell)</em></div><div class="chev">›</div></div></div>
    <div class="card"><div class="card-top"><div class="ex-title">Bench Press <em>(Barbell)</em></div><div class="chev">›</div></div></div>
  </div>`,
  modal: `<div class="overlay"><div class="modal">
    <h2>¿A qué split?</h2>
    <p class="muted">Ahora mismo <b>Full Body</b> vive en Torso / Pierna. Su historial no se toca:
      las sesiones ya guardadas siguen contando igual.</p>
    <div class="stack">
      <button class="opt on"><b>PPL</b><span>En curso · 6 días</span></button>
      <button class="opt"><b>Torso / Pierna</b><span>Guardado · donde está ahora</span></button>
      <button class="opt"><b>Upper / Lower</b><span>Guardado · 4 días</span></button>
    </div>
    <div class="sect">Cómo</div>
    <div class="stack">
      <button class="opt on"><b>Mover</b><span>Deja de estar en Torso / Pierna.</span></button>
      <button class="opt"><b>Copiar</b><span>Queda en los dos, cada uno editable por separado.</span></button>
    </div>
    <button class="btn" style="margin-top:18px">Mover a PPL</button>
    <button class="btn ghost">Cancelar</button>
  </div></div>`
});

const EXTRA = `
  .today{background:var(--surface);border:1px solid var(--line-2);border-radius:16px;padding:16px;margin-top:18px}
  .today-n{font-size:27px;font-weight:700;font-stretch:112%;letter-spacing:-.03em;line-height:1;margin:10px 0 7px}
  .dayn{font-family:var(--mono);font-size:11px;color:var(--dim);width:16px;flex:none}
  .rowitem.next .row-name{color:var(--up)}
  .load-l{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .stack .opt + .opt{margin-top:0}
  .modal .sect:first-of-type{margin-top:22px}`;

const body = `
<header class="brief">
  <div class="eyebrow">Propuesta · splits · ${S.length} pantallas</div>
  <h1>Agrupar los días<br><em>y cambiar de plan</em></h1>
  <p>Tus rutinas dejan de ser una lista suelta y pasan a ser <b>los días de un split</b>. Eso permite lo que
  pediste —guardar Torso/Pierna, montar un PPL y volver cuando quieras— pero además desbloquea algo que
  hoy la app no puede hacer: si conoce el orden de tus días, <b>sabe cuál toca</b>.</p>
  <p>La regla que sostiene todo: <b>el progreso vive en el ejercicio, no en la rutina</b>. Cambiar de split
  no cuesta nada porque el press de banca llega a Push con las mismas marcas que tenía en Torso.</p>
</header>

<div class="chapter">
  <div class="k">01</div>
  <h2>El día a día</h2>
  <p>Lo que ves al abrir la app. Si solo tienes un split, la pantalla es casi la de hoy: una línea con su
  nombre y ya. La diferencia está arriba.</p>
</div>
<div class="deck">${S.slice(0, 1).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">02</div>
  <h2>Guardar y retomar</h2>
  <p>Un split guardado no es un archivo muerto: conserva sus días, sus estadísticas y vuelve a estar en
  curso con un botón.</p>
</div>
<div class="deck">${S.slice(1, 3).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">03</div>
  <h2>Empezar uno nuevo</h2>
  <p>Solo el nombre. Los días los pones tú, en el orden que quieras.</p>
</div>
<div class="deck">${S.slice(3).map(phone).join('\n')}</div>`;

const out = path.join(__dirname, 'propuesta-splits.html');
fs.writeFileSync(out, doc({ title:'Hierro — propuesta: splits', extraCss:EXTRA, body }));
console.log(`${S.length} pantallas → ${path.relative(process.cwd(), out)}`);
