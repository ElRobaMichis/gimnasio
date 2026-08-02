/* =====================================================================
   Andamiaje compartido de los documentos de mockups: toma el CSS real
   de index.html y lo reencuadra dentro de un marco de teléfono.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const APP_HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const appCss = APP_HTML.slice(APP_HTML.indexOf('<style>') + 7, APP_HTML.indexOf('</style>'));

/* mismas reglas de la app, con los selectores de raíz reapuntados al marco */
function frameCss(css){
  return css
    .replace(/\n  html,body\{height:100%\}/, '')
    .replace(/\n  body\{\n(?:[^}]*)\}/, m => m.replace('body{', '.scr{'))
    .replace('#app{', '.appbox{')
    .replace('main{flex:1;padding:0 20px 32px}', '.appbox main{flex:1;padding:0 20px 32px}')
    .replace('max-width:460px;margin:0 auto;min-height:100dvh', 'max-width:none;margin:0;min-height:100%')
    .replace('nav.tabs .inner{max-width:460px', 'nav.tabs .inner{max-width:none');
}

const ICON = {
  routines:'<path d="M4 9v6M8 6v12M16 6v12M20 9v6M8 12h8"/>',
  session:'<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>',
  history:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2M12 19v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1"/>',
  check:'<path d="M4 12.5l5.5 5.5L20 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  deload:'<path d="M12 5v14M12 19l-4-4M12 19l4-4"/>',
  trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  sort:'<path d="M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
};
const svgIcon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

const STATUS = `<div class="status"><span>12:04</span><span class="sig"><b style="height:4px"></b><b style="height:6px"></b><b style="height:8px"></b><b style="height:10px"></b></span></div>`;

function tabs(on){
  const t = (icon, label, key) =>
    `<button class="tab ${on === key ? 'on' : ''}">${svgIcon(icon)}<span>${label}</span></button>`;
  return `<nav class="tabs"><div class="inner">
    ${t('routines','Rutinas','rutinas')}
    ${on === 'sesion' ? t('session','Sesión','sesion') : ''}
    ${t('history','Historial','historial')}
    ${t('settings','Ajustes','ajustes')}
  </div></nav>`;
}

/* un marco. grow = crece si la pantalla es más larga que el teléfono */
function phone(s){
  const grow = s.modal ? '' : ' grow';
  return `
<figure>
  <div class="phone${grow}">
    ${STATUS}
    <div class="scr">
      <div class="appbox">
        <header class="app${s.sticky ? ' sticky' : ''}">${s.top}</header>
        <main>${s.main}</main>
      </div>
      ${s.tabs || ''}
      ${s.modal || ''}
    </div>
  </div>
  <figcaption>
    <div class="cap-n">${s.n}</div>
    <div class="cap-t">${s.title}</div>
    <div class="cap-d">${s.desc}</div>
  </figcaption>
</figure>`;
}

/* ---------- discos: diámetro, grosor y color de código internacional ---------- */
const PLATE = {
  25:   { d:92, t:15, c:'#C0473E', s:'#8E332C' },
  20:   { d:92, t:13, c:'#3C6FA8', s:'#2A5079' },
  15:   { d:84, t:11, c:'#C2963A', s:'#8E6D28' },
  10:   { d:72, t:9,  c:'#4C9970', s:'#356B4F' },
  5:    { d:56, t:8,  c:'#CFCCC4', s:'#94918A' },
  2.5:  { d:44, t:6,  c:'#8B8F96', s:'#63666B' },
  1.25: { d:36, t:5,  c:'#6C7076', s:'#4C4F54' },
};
const num = n => String(n).replace('.', ',');

/* barra vista de frente con los discos de un lado espejados en el otro */
function barbell(perSide, { h = 116, scale = 1, empty = '' } = {}){
  const W = 340, cx = W/2, cy = h/2;
  const collar = 30 * scale;
  let out = '';

  /* eje */
  out += `<rect x="10" y="${cy - 2.5*scale}" width="${W-20}" height="${5*scale}" rx="${2.5*scale}" fill="#6E727A"/>`;
  /* topes internos */
  for(const dir of [-1, 1])
    out += `<rect x="${cx + dir*collar - (dir<0 ? 5*scale : 0)}" y="${cy - 9*scale}" width="${5*scale}" height="${18*scale}" rx="1.5" fill="#8B8F96"/>`;

  for(const dir of [-1, 1]){
    let x = cx + dir*(collar + 3*scale);
    for(const kg of perSide){
      const p = PLATE[kg];
      if(!p) continue;
      const t = p.t*scale, d = p.d*scale;
      const px = dir > 0 ? x : x - t;
      out += `<rect x="${px.toFixed(1)}" y="${(cy - d/2).toFixed(1)}" width="${t.toFixed(1)}" height="${d.toFixed(1)}" rx="${(2.5*scale).toFixed(1)}" fill="${p.c}" stroke="${p.s}" stroke-width="1"/>`;
      x += dir*(t + 2*scale);
    }
    /* seguro */
    const cx2 = dir > 0 ? x : x - 6*scale;
    out += `<rect x="${cx2.toFixed(1)}" y="${(cy - 11*scale).toFixed(1)}" width="${(6*scale).toFixed(1)}" height="${(22*scale).toFixed(1)}" rx="2" fill="#54585E"/>`;
  }
  if(!perSide.length && empty)
    out += `<text x="${cx}" y="${cy - 16*scale}" text-anchor="middle" fill="#5F6268" font-family="IBM Plex Mono, monospace" font-size="${11*scale}">${empty}</text>`;

  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:${h}px;display:block" aria-hidden="true">${out}</svg>`;
}

function dumbbell(kg, { h = 76 } = {}){
  const W = 340, cx = W/2, cy = h/2;
  const d = kg >= 20 ? 56 : kg >= 12 ? 48 : 40;
  const t = 16;
  return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:${h}px;display:block" aria-hidden="true">
    <rect x="${cx-46}" y="${cy-4}" width="92" height="8" rx="4" fill="#6E727A"/>
    ${[-1,1].map(dir => `
      <rect x="${dir>0 ? cx+40 : cx-40-t}" y="${cy-d/2}" width="${t}" height="${d}" rx="4" fill="#8B8F96" stroke="#63666B"/>
      <rect x="${dir>0 ? cx+40+t+2 : cx-42-t*2}" y="${cy-d/2-5}" width="${t}" height="${d+10}" rx="4" fill="#A2A6AC" stroke="#74777C"/>`).join('')}
  </svg>`;
}

/* lista «por lado» con el punto del color de cada disco */
function plateList(perSide){
  const counts = new Map();
  for(const kg of perSide) counts.set(kg, (counts.get(kg) || 0) + 1);
  return [...counts].map(([kg, n]) => `
    <div class="line">
      <div class="row grow" style="gap:13px">
        <i class="plate-dot" style="background:${PLATE[kg].c}"></i>
        <div class="l-t">${num(kg)} kg</div>
      </div>
      <div class="l-v">×${n} <span style="color:var(--dim)">por lado</span></div>
    </div>`).join('');
}
const sideText = perSide => perSide.length
  ? perSide.map(k => `<b>${num(k)}</b>`).join(' + ') + ' kg'
  : '<b>solo la barra</b>';

const DOC_CSS = `
  html,body{height:auto}
  body{
    background:var(--void);color:var(--bone);font-family:var(--sans);font-synthesis:none;
    margin:0;padding:56px 24px 96px;
  }
  .brief{max-width:1240px;margin:0 auto 56px}
  .brief .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--dim);font-weight:600;font-stretch:80%}
  .brief h1{font-size:clamp(38px,7vw,68px);line-height:.94;letter-spacing:-.03em;font-weight:700;font-stretch:118%;margin:14px 0 18px}
  .brief h1 em{font-style:normal;color:var(--dim)}
  .brief p{max-width:62ch;color:var(--ash);font-size:14.5px;line-height:1.6}
  .brief p + p{margin-top:12px}
  .brief code{font-family:var(--mono);font-size:13px;color:var(--bone)}
  .tokens{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
  .token{display:flex;align-items:center;gap:8px;padding:7px 12px 7px 8px;border:1px solid var(--line);border-radius:999px;font-family:var(--mono);font-size:11px;color:var(--ash)}
  .token i{width:13px;height:13px;border-radius:3px;display:block}

  .chapter{max-width:1240px;margin:0 auto 34px;padding-top:26px;border-top:1px solid var(--line)}
  .chapter .k{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
  .chapter h2{font-size:30px;font-weight:700;font-stretch:112%;letter-spacing:-.03em;margin:10px 0 12px}
  .chapter p{max-width:62ch;color:var(--ash);font-size:14px;line-height:1.6}

  .deck{max-width:1240px;margin:0 auto 76px;display:grid;align-items:start;grid-template-columns:repeat(auto-fit,minmax(320px,390px));gap:64px 48px;justify-content:center}
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
  }`;

function doc({ title, extraCss = '', body }){
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${frameCss(appCss)}
${DOC_CSS}
${extraCss}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

module.exports = { appCss, frameCss, phone, tabs, svgIcon, doc, STATUS, ICON,
  PLATE, num, barbell, dumbbell, plateList, sideText };
