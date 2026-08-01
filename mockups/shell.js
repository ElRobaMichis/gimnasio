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

module.exports = { appCss, frameCss, phone, tabs, svgIcon, doc, STATUS, ICON };
