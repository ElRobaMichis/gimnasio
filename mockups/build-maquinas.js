#!/usr/bin/env node
/* =====================================================================
   Mockup: máquinas de verdad — placas en libras, varios puntos de carga
   y la misma máquina repetida. Solo diseño.
   Correr con:  node mockups/build-maquinas.js
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { phone, tabs, svgIcon, doc, PLATE, num, barbell, sideText } = require('./shell');

/* ---------- torre de placas con el pin ---------- */
function stackSVG(sel, total, { h = 150 } = {}){
  const W = 110, n = total, slab = 9, gap = 2.5;
  const top = (h - (n*slab + (n-1)*gap)) / 2;
  let out = `<rect x="${W/2-4}" y="${top-10}" width="8" height="${n*(slab+gap)+14}" rx="3" fill="#2A2D31"/>`;
  for(let i = 0; i < n; i++){
    const y = top + i*(slab+gap);
    const on = i < sel;
    out += `<rect x="18" y="${y}" width="${W-36}" height="${slab}" rx="2.5"
      fill="${on ? '#8B8F96' : '#1B1E22'}" stroke="${on ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.07)'}"/>`;
  }
  /* el pin entra en la última placa levantada */
  const py = top + (sel-1)*(slab+gap) + slab/2;
  out += `<rect x="${W-22}" y="${py-2.5}" width="20" height="5" rx="2.5" fill="#D7A44B"/>`;
  out += `<circle cx="${W-4}" cy="${py}" r="4" fill="#D7A44B"/>`;
  return `<svg viewBox="0 0 ${W} ${h}" style="width:${W}px;height:${h}px;display:block;flex:none" aria-hidden="true">${out}</svg>`;
}

/* ---------- un pitón con sus discos ---------- */
function postSVG(perPost, { h = 92, scale = 1 } = {}){
  const W = 340, cy = h/2;
  /* un pitón es corto: la varilla se dibuja solo lo que hace falta */
  const dims = perPost.map(kg => PLATE[kg] || PLATE[1.25]);
  const load = dims.reduce((a, p) => a + Math.max(p.t*scale, 4) + 2*scale, 0);
  const rod = 8*scale + load + Math.max(6*scale, 4) + 12*scale;
  const groupW = 13 + rod;
  const x0 = (W - groupW) / 2;

  let out = `<rect x="${x0}" y="${cy-34*scale}" width="13" height="${68*scale}" rx="4" fill="#2A2D31"/>`;
  out += `<rect x="${x0+13}" y="${cy-2.5*scale}" width="${rod}" height="${5*scale}" rx="${2.5*scale}" fill="#6E727A"/>`;
  out += `<rect x="${x0+13}" y="${cy-9*scale}" width="${5*scale}" height="${18*scale}" rx="1.5" fill="#8B8F96"/>`;
  let x = x0 + 13 + 8*scale;
  perPost.forEach((kg, i) => {
    const p = dims[i], t = Math.max(p.t*scale, 4), d = p.d*scale;
    out += `<rect x="${x.toFixed(1)}" y="${(cy-d/2).toFixed(1)}" width="${t.toFixed(1)}" height="${d.toFixed(1)}" rx="${(2.5*scale).toFixed(1)}" fill="${p.c}" stroke="rgba(0,0,0,.35)"/>`;
    x += t + 2*scale;
  });
  out += `<rect x="${x.toFixed(1)}" y="${(cy-11*scale).toFixed(1)}" width="${Math.max(6*scale,4).toFixed(1)}" height="${(22*scale).toFixed(1)}" rx="2" fill="#3E4247"/>`;
  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:${h}px;display:block" aria-hidden="true">${out}</svg>`;
}

/* ---------- chrome ---------- */
const sessHead = (meta, clock) => `
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
  <button class="rest">
    <div class="rest-row"><span class="rest-l">Descanso</span><span class="rest-t">2:00</span></div>
    <div class="rest-track"><div class="rest-fill" style="width:0%"></div></div>
  </button>`;

const gridH = u => `
  <div class="grid-h"><span>#</span><span>${u}</span><span>reps</span><span>rir</span><span></span><span></span></div>`;
const setRow = (i, w, r, state) => `
  <div class="set${state === 'now' ? ' now' : ''}">
    <span class="i">${i}</span>
    <span class="cell ph">${w}</span><span class="cell ph">${r}</span><span class="cell ph">1–3</span>
    <span class="ck">${svgIcon('check')}</span><span class="xbtn">✕</span>
  </div>`;
const exActions = () => `
  <div class="ex-actions"><button>+ Serie</button><button>Calentamiento</button><button>Notas</button></div>`;

const S = [];
const add = o => S.push(o);

/* ============ 1. cómo se carga ============ */
add({
  n:'E01', title:'Cómo se carga · placas',
  desc:'La fila «Equipo» crece a cinco formas de cargar. “Placas” es la máquina de pin: no hay discos que sumar, sube de golpe en golpe. La lista de abajo es la prueba: si no coincide con lo que ves en la máquina, cambia el salto.',
  top:`
    <button class="back">‹ Volver</button>
    <div class="title big">Seated Cable Row</div>
    <div class="title-sub">Cable</div>
    <div class="knurl"></div>`,
  main:`
    <div class="sect">Cómo se carga</div>
    <div class="stack">
      <button class="opt"><b>Barra</b><span>Una barra con discos a los dos lados.</span></button>
      <button class="opt"><b>Discos</b><span>Máquina o aparato donde tú pones los discos.</span></button>
      <button class="opt on"><b>Placas</b><span>Máquina de pin: eliges una placa y sube de golpe en golpe.</span></button>
      <button class="opt"><b>Mancuernas</b><span>Del rango que tengas en Mi equipo.</span></button>
      <button class="opt"><b>Nada</b><span>Peso corporal o sin carga que calcular.</span></button>
    </div>

    <div class="sect">La torre de esta máquina</div>
    <div class="list">
      <div class="line">
        <div><div class="l-t">Unidad de la máquina</div><div class="l-d">Lo que está escrito en las placas</div></div>
        <div class="pill-sw"><button>kg</button><button class="on">lb</button></div>
      </div>
      <div class="line">
        <div><div class="l-t">Sube de</div><div class="l-d">De una placa a la siguiente</div></div>
        <div class="l-v"><span class="cell ph" style="width:56px;padding:8px 4px;font-size:13px">5</span> lb</div>
      </div>
      <div class="line">
        <div><div class="l-t">Empieza en</div><div class="l-d">La placa más ligera</div></div>
        <div class="l-v"><span class="cell ph" style="width:56px;padding:8px 4px;font-size:13px">10</span> lb</div>
      </div>
    </div>
    <div class="hint">Así queda la torre: <b>10 · 15 · 20 · 25 · 30 · 35 · 40 …</b> lb.
      Compárala con los números de la máquina — si no cuadran, corrige el salto y listo.
      No hace falta saberlo de memoria: se arregla de pie frente al aparato en diez segundos.</div>

    <div class="sect">Y en tu historial</div>
    <div class="hint">Este ejercicio se anota y se muestra en <b>libras</b>, porque es lo que lees en la torre.
      Por dentro se sigue guardando en kilos, así que el volumen semanal y las gráficas siguen cuadrando
      con el resto de la app.</div>`
});

add({
  n:'E02', title:'Cómo se carga · discos',
  desc:'Para lo que cargas tú. La pregunta clave no es cuánto pesa, es dónde van los discos: hay aparatos de un solo lado, barras de dos y prensas de cuatro pitones. Eso cambia la cuenta entera.',
  top:`
    <button class="back">‹ Volver</button>
    <div class="title big">Leg Press</div>
    <div class="title-sub">Máquina de discos</div>
    <div class="knurl"></div>`,
  main:`
    <div class="sect">Cómo se carga</div>
    <div class="stack">
      <button class="opt"><b>Barra</b><span>Una barra con discos a los dos lados.</span></button>
      <button class="opt on"><b>Discos</b><span>Máquina o aparato donde tú pones los discos.</span></button>
      <button class="opt"><b>Placas</b><span>Máquina de pin: eliges una placa y sube de golpe en golpe.</span></button>
    </div>

    <div class="sect">¿Dónde van los discos?</div>
    <div class="stack">
      <button class="opt"><b>En un solo lado</b><span>Un pitón. Todo el peso va ahí.</span></button>
      <button class="opt"><b>En los dos lados</b><span>Lo normal en barras y en la mayoría de aparatos.</span></button>
      <button class="opt on"><b>En cuatro pitones</b><span>Prensas y trineos. El peso se reparte entre los cuatro.</span></button>
    </div>

    <div class="sect">Peso del aparato</div>
    <div class="list">
      <div class="line">
        <div><div class="l-t">El carro vacío pesa</div><div class="l-d">Si no lo sabes, déjalo en blanco</div></div>
        <div class="l-v"><span class="cell ph" style="width:56px;padding:8px 4px;font-size:13px">—</span> kg</div>
      </div>
    </div>
    <div class="hint">Dejarlo en blanco no rompe nada: el coach compara tus series entre sí, así que mientras
      el aparato sea el mismo la progresión sale igual de bien. Solo cambia el número absoluto.</div>`
});

/* ============ 2. en la sesión ============ */
add({
  n:'E03', title:'Sesión · torre en libras',
  desc:'La app deja de traducir. Escribes 60 porque es lo que dice la placa, y la sugerencia viene en libras con el salto real de la máquina. El dibujo de la torre te dice dónde va el pin.',
  top: sessHead('Torso · 4 de 12 series', '22:10'),
  sticky:true, tabs: tabs('sesion'),
  main:`
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Seated Cable Row <em>(Cable)</em> <span class="pill">lb</span></div>
        <div class="last">Última · <b>55×12 lb</b> · <b>55×12 lb</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube una placa: <b>60 lb × 8</b></div></div>
        <div class="why">Llegaste a 12 reps con 55 lb. La torre sube de 5 en 5, así que el siguiente escalón es 60.</div>
        <button class="load">
          <div class="load-row">
            <span class="load-l">Pon el pin en</span>
            <span class="load-v">Placa 11 · <b>60 lb</b> <span class="chev">›</span></span>
          </div>
          <div style="display:flex;justify-content:center;padding:10px 0 2px">${stackSVG(11, 15)}</div>
        </button>
        ${gridH('lb')}
        ${setRow(1, '60', '8', 'now')}
        ${setRow(2, '60', '8', '')}
        ${setRow(3, '60', '8', '')}
        ${exActions()}
      </div>
    </div>
    <div class="hint">La pastilla <b>lb</b> junto al nombre recuerda que este ejercicio va en la unidad de su
      máquina, aunque el resto de la app esté en kilos.</div>`
});

add({
  n:'E04', title:'Sesión · prensa de 4 pitones',
  desc:'Lo importante no es el total, es cuánto va en cada pitón. Se dibuja un pitón — el que tienes delante — y se dice cuántas veces repetirlo. Mucho más claro que dibujar los cuatro.',
  top: sessHead('Pierna · 2 de 9 series', '14:35'),
  sticky:true, tabs: tabs('sesion'),
  main:`
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Leg Press <em>(Machine)</em></div>
        <div class="last">Última · <b>140×10</b> · <b>140×10</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>145 kg × 8</b></div></div>
        <div class="why">Llegaste a 10 reps en todas las series con 140 kg. Con cuatro pitones el salto más
          pequeño que puedes armar es 5 kg: un disco de 1,25 en cada uno, y necesitas dos pares.</div>
        <button class="load">
          <div class="load-row">
            <span class="load-l">En cada pitón</span>
            <span class="load-v">${sideText([25, 10, 1.25])} <span class="chev">›</span></span>
          </div>
          ${postSVG([25, 10, 1.25], { h:84, scale:0.72 })}
          <div class="load-row" style="margin-top:6px">
            <span class="load-l">Son 4 pitones</span>
            <span class="load-v">4 × 36,25 = <b>145 kg</b></span>
          </div>
        </button>
        ${gridH('kg')}
        ${setRow(1, '145', '8', 'now')}
        ${setRow(2, '145', '8', '')}
        ${exActions()}
      </div>
    </div>`
});

add({
  n:'E05', title:'Sesión · un solo lado',
  desc:'El hip thrust de discos de tu gimnasio solo se carga por la derecha. Con un punto de carga la cuenta es directa y el dibujo enseña el pitón tal como lo ves.',
  top: sessHead('Glúteo · 0 de 6 series', '03:20'),
  sticky:true, tabs: tabs('sesion'),
  main:`
    <div style="margin-top:2px">
      <div class="ex-open">
        <div class="ex-title">Hip Thrust <em>(Discos)</em></div>
        <div class="last">Última · <b>45×12</b> · <b>45×12</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>46,25 kg × 8</b></div></div>
        <div class="why">Con un solo pitón, el salto más pequeño es un disco suelto: 1,25 kg. Es el aparato
          que más fino progresa de todo tu gimnasio.</div>
        <button class="load">
          <div class="load-row">
            <span class="load-l">Todo en el lado derecho</span>
            <span class="load-v">${sideText([25, 20, 1.25])} <span class="chev">›</span></span>
          </div>
          ${postSVG([25, 20, 1.25], { h:84, scale:0.72 })}
        </button>
        ${gridH('kg')}
        ${setRow(1, '46,25', '8', 'now')}
        ${setRow(2, '46,25', '8', '')}
        ${exActions()}
      </div>
    </div>
    <div class="hint">Si el aparato tiene peso propio y lo sabes, se suma; si no, da igual — el coach compara
      tus series contra sí mismas.</div>`
});

/* ============ 3. la misma máquina, dos veces ============ */
add({
  n:'E06', title:'Dos máquinas, dos ejercicios',
  desc:'El hip thrust de cable y el de discos no son el mismo ejercicio: ni pesan lo mismo ni progresan igual. Se separan, y «Duplicar para otra máquina» lo hace en un toque sin mezclar historiales.',
  top:`
    <button class="back">‹ Rutinas</button>
    <div class="head-row"><div class="title sm">Glúteo</div></div>
    <div class="meta">4 ejercicios · 8–12 reps · 1–3 RIR</div>
    <div class="knurl"></div>`,
  tabs: tabs('rutinas'),
  main:`
    <div style="margin-top:2px">
      <div class="card">
        <div class="card-top"><div class="ex-title">Hip Thrust <em>(Cable)</em> <span class="pill">lb</span></div><div class="chev">›</div></div>
        <div class="last">Última · <b>90×12 lb</b> · <b>90×12 lb</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube una placa: <b>100 lb × 8</b></div></div>
        <div class="steps"><div class="bars"><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i></div><div class="steps-v"><b>12</b>/12 · rango lleno</div></div>
      </div>
      <div class="card">
        <div class="card-top"><div class="ex-title">Hip Thrust <em>(Discos)</em></div><div class="chev">›</div></div>
        <div class="last">Última · <b>45×12</b> · <b>45×12</b></div>
        <div class="verdict"><i class="dot up"></i><div class="v-text up">Sube el peso: <b>46,25 kg × 8</b></div></div>
        <div class="steps"><div class="bars"><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i><i class="up"></i></div><div class="steps-v"><b>12</b>/12 · rango lleno</div></div>
      </div>
    </div>
    <div class="hint">Cada uno lleva su propia progresión, su propia unidad y su propio dibujo. Mezclarlos
      daría saltos absurdos: 90 en la de cable no es 90 en la de discos.</div>`,
  modal:`<div class="overlay"><div class="modal">
    <h2>Duplicar para otra máquina</h2>
    <p class="muted">Crea un ejercicio aparte partiendo de <b>Hip Thrust</b>. Empieza sin historial:
      son aparatos distintos y sus pesos no se pueden comparar.</p>
    <div class="field"><span>Nombre</span>
      <input type="text" value="Hip Thrust (Discos)"></div>
    <div class="hint">Se copian el rango de reps, el grupo muscular y el descanso. Lo que cambies después
      en uno no toca al otro.</div>
    <button class="btn" style="margin-top:18px">Crear</button>
    <button class="btn ghost">Cancelar</button>
  </div></div>`
});

const EXTRA = `
  .plate-dot{width:15px;height:15px;border-radius:50%;flex:none}
  .load{display:block;width:100%;text-align:left;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}
  .load-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .load-l{font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
  .load-v{font-family:var(--mono);font-size:12.5px;color:var(--ash);display:flex;align-items:center;gap:6px}
  .load-v b{color:var(--bone);font-weight:500}
  .load svg{margin:4px 0}
  .cell.ph{color:var(--dim)}
  .modal .sect:first-of-type{margin-top:22px}
  .stack .opt + .opt{margin-top:0}`;

const body = `
<header class="brief">
  <div class="eyebrow">Propuesta · máquinas de verdad · ${S.length} pantallas</div>
  <h1>Torres, pitones<br><em>y libras sueltas</em></h1>
  <p>Tres casos que el modelo actual no cubre. Uno: hay máquinas cuya torre sube de 5 en 5 <b>libras</b>
  aunque la app esté en kilos. Dos: los discos no siempre van a dos lados — hay aparatos de un solo pitón
  y prensas de cuatro. Tres: el mismo ejercicio puede existir en dos máquinas que no se parecen en nada.</p>
  <p>La respuesta a los tres es la misma pregunta, hecha una vez por ejercicio: <b>cómo se carga esto</b>.
  De ahí salen la unidad, el salto real y el dibujo.</p>
</header>

<div class="chapter">
  <div class="k">01</div>
  <h2>Cómo se carga</h2>
  <p>La fila «Equipo» de la ficha crece a cinco formas de cargar, y cada una pregunta solo lo suyo.
  Nada hay que saberlo de memoria: se ajusta de pie frente a la máquina.</p>
</div>
<div class="deck">${S.slice(0, 2).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">02</div>
  <h2>En la sesión</h2>
  <p>Cada forma de cargar trae su propio dibujo. Ninguna te obliga a hacer una cuenta de cabeza.</p>
</div>
<div class="deck">${S.slice(2, 5).map(phone).join('\n')}</div>

<div class="chapter">
  <div class="k">03</div>
  <h2>La misma máquina, dos veces</h2>
  <p>Cuando el gimnasio tiene dos versiones del mismo ejercicio, lo correcto es separarlas —
  y hacerlo fácil.</p>
</div>
<div class="deck">${S.slice(5).map(phone).join('\n')}</div>`;

const out = path.join(__dirname, 'propuesta-maquinas.html');
fs.writeFileSync(out, doc({ title:'Hierro — propuesta: máquinas de verdad', extraCss:EXTRA, body }));
console.log(`${S.length} pantallas → ${path.relative(process.cwd(), out)}`);
