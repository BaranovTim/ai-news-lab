#!/usr/bin/env node
// Draws an ai-news-lab chart from a small JSON spec, in the graph-paper style.
// Usage: node _style/render.js chart.json chart.png
// Output: a 3200x1800 PNG (1600x900 at 2x). Needs Node and Playwright with Chromium.
// The spec format is in _style/README.md.
const fs = require('fs');
const os = require('os');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error('usage: node _style/render.js chart.json chart.png');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const TYPES = ['bars', 'hbars', 'line', 'numbers'];
function fail(msg) { console.error('chart spec error: ' + msg); process.exit(1); }
if (!TYPES.includes(spec.type)) fail('type must be one of ' + TYPES.join(', '));
if (!spec.title) fail('title is required');
if (spec.type === 'line') {
  if (!Array.isArray(spec.x) || !Array.isArray(spec.series) || !spec.series.length) fail('line needs x and series');
  spec.series.forEach((s, i) => {
    if (!Array.isArray(s.values) || s.values.length !== spec.x.length) fail('series ' + i + ' needs one value per x');
  });
} else {
  if (!Array.isArray(spec.data) || !spec.data.length) fail(spec.type + ' needs data');
  if (spec.type === 'numbers' && spec.data.length > 4) fail('numbers takes at most 4 items');
  if (spec.type === 'bars' && spec.data.length > 7) fail('bars takes at most 7 items, use hbars');
  if (spec.type === 'hbars' && spec.data.length > 10) fail('hbars takes at most 10 items');
}

const FONTS = path.join(__dirname, 'fonts');
const font = (family, weight, file) =>
  `@font-face{font-family:"${family}";font-weight:${weight};src:url("file://${path.join(FONTS, file)}") format("woff2")}`;
const css = `
${font('Instrument Sans', 400, 'instrument-sans-latin-400-normal.woff2')}
${font('Instrument Sans', 500, 'instrument-sans-latin-500-normal.woff2')}
${font('Instrument Sans', 600, 'instrument-sans-latin-600-normal.woff2')}
${font('JetBrains Mono', 700, 'jetbrains-mono-latin-700-normal.woff2')}
${font('IBM Plex Mono', 400, 'ibm-plex-mono-latin-400-normal.woff2')}
${font('IBM Plex Mono', 500, 'ibm-plex-mono-latin-500-normal.woff2')}
:root{--ink:#17255E;--ink2:#4C5A8A;--soft:#8A94BA;--pen:#D7263D;--paper:#FFFFFF;--grid:#DCE4F0;--grid2:#EEF2F8}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1600px;height:900px;overflow:hidden}
body{background-color:var(--paper);background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px),linear-gradient(var(--grid2) 1px,transparent 1px),linear-gradient(90deg,var(--grid2) 1px,transparent 1px);background-size:150px 150px,150px 150px,30px 30px,30px 30px;background-position:-1px -1px;color:var(--ink);font-family:"Instrument Sans",sans-serif;padding:56px 90px 50px;display:flex;flex-direction:column;position:relative}
.tag{font:500 20px "IBM Plex Mono",monospace;letter-spacing:.05em;background:var(--paper);align-self:flex-start;padding:6px 10px;border:2px solid var(--ink)}
h1{font-weight:600;font-size:56px;letter-spacing:-.02em;line-height:1.06;margin-top:26px;max-width:1150px}
.sub{font-size:27px;color:var(--ink2);margin-top:12px}
.plot{position:relative;flex:1;min-height:0;margin-top:36px}
.foot{display:flex;justify-content:space-between;gap:40px;font:400 19px "IBM Plex Mono",monospace;color:var(--ink2);margin-top:22px}
.num{font:700 46px "JetBrains Mono",monospace;white-space:nowrap}
.solid{background:var(--ink)}
.hatch{background:repeating-linear-gradient(135deg,var(--ink) 0 3px,transparent 3px 14px);border:3px solid var(--ink)}
/* bars */
.bars{position:absolute;inset:0 0 54px 0;display:flex;align-items:flex-end;gap:var(--gap);padding-left:30px;border-bottom:3px solid var(--ink)}
.col{display:flex;flex-direction:column;align-items:center;gap:12px;width:var(--colw)}
.col .bar{width:100%}
.col .hatch{border-bottom:0}
.xlabels{position:absolute;left:0;right:0;bottom:0;display:flex;gap:var(--gap);padding-left:30px}
.xlabels span{width:var(--colw);text-align:center;font-size:28px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* hbars */
.hbars{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:var(--rowgap)}
.hrow{display:grid;grid-template-columns:var(--labw) 1fr;align-items:center;gap:26px}
.hrow .lab{font-size:var(--labsize);font-weight:500;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{display:flex;align-items:center;gap:20px;border-left:3px solid var(--ink);height:var(--barh)}
.track .bar{height:100%}
.track .hatch{border-left:0}
.hrow .num{font-size:var(--numsize)}
/* numbers */
.cards{--bigsize:96px;position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-start;gap:48px}
.card{display:flex;flex-direction:column;gap:14px;padding:30px 34px;min-width:260px;border:3px solid var(--ink);background:var(--paper)}
.card.on{background:var(--ink);color:var(--paper)}
.card .lab{font-size:28px;font-weight:500}
.card .big{font:700 var(--bigsize) "JetBrains Mono",monospace;letter-spacing:-.02em;line-height:1}
.card .small{font:400 21px "IBM Plex Mono",monospace;opacity:.85}
/* line */
svg.line text{font-family:"IBM Plex Mono",monospace}
/* pen note */
.note{position:absolute;font:500 26px "IBM Plex Mono",monospace;color:var(--pen);white-space:nowrap}
svg.arrow{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
`;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dec = Number.isInteger(spec.decimals) ? spec.decimals : null;
function fmt(v) {
  const d = dec != null ? dec : (Number.isInteger(v) ? 0 : 1);
  return (spec.prefix || '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (spec.suffix || '');
}
function hiIndex(items, val) {
  const i = items.findIndex(d => d.highlight);
  if (i >= 0) return i;
  let best = 0;
  items.forEach((d, j) => { if (val(d) > val(items[best])) best = j; });
  return best;
}

let plot = '';
let hi = 0;
if (spec.type === 'bars') {
  hi = hiIndex(spec.data, d => d.value);
  plot = `<div class="bars">${spec.data.map((d, i) => `<div class="col"><span class="num">${esc(fmt(d.value))}</span><div class="bar ${i === hi ? 'solid' : 'hatch'}" data-v="${Number(d.value)}" data-i="${i}"></div></div>`).join('')}</div>
  <div class="xlabels">${spec.data.map(d => `<span>${esc(d.label)}</span>`).join('')}</div>`;
} else if (spec.type === 'hbars') {
  hi = hiIndex(spec.data, d => d.value);
  plot = `<div class="hbars">${spec.data.map((d, i) => `<div class="hrow"><span class="lab">${esc(d.label)}</span><div class="track"><div class="bar ${i === hi ? 'solid' : 'hatch'}" data-v="${Number(d.value)}" data-i="${i}"></div><span class="num" data-i="${i}">${esc(fmt(d.value))}</span></div></div>`).join('')}</div>`;
} else if (spec.type === 'numbers') {
  hi = hiIndex(spec.data, d => d.value);
  plot = `<div class="cards">${spec.data.map((d, i) => `<div class="card ${i === hi ? 'on' : ''}" data-i="${i}"><span class="lab">${esc(d.label)}</span><span class="big">${esc(d.display || fmt(d.value))}</span>${d.sub ? `<span class="small">${esc(d.sub)}</span>` : ''}</div>`).join('')}</div>`;
} else {
  hi = Math.max(0, spec.series.findIndex(s => s.highlight));
  plot = `<svg class="line" width="100%" height="100%"></svg>`;
}

const note = spec.note && spec.note.text ? spec.note : null;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<span class="tag">TEST ${esc(spec.test || '000')} · AI-NEWS-LAB</span>
<h1>${esc(spec.title)}</h1>
${spec.subtitle ? `<p class="sub">${esc(spec.subtitle)}</p>` : ''}
<div class="plot" id="plot">${plot}${note ? `<span class="note" id="note">${esc(note.text)}</span><svg class="arrow" id="arrow"></svg>` : ''}</div>
<div class="foot"><span>${spec.source ? 'source: ' + esc(spec.source) : ''}</span><span>github.com/BaranovTim/ai-news-lab</span></div>
</body></html>`;

// Runs inside the page after fonts load: sizes everything to the space left and draws the pen note.
function layout({ spec, hi }) {
  const $ = s => document.querySelector(s);
  const plot = $('#plot');
  const h1 = $('h1');
  for (let size = 56; h1.getBoundingClientRect().height > 2.2 * size * 1.06 && size > 40; size -= 2) h1.style.fontSize = size + 'px';
  const P = plot.getBoundingClientRect();
  let anchor = null; // the point the pen note points at, in plot coordinates

  if (spec.type === 'bars') {
    const n = spec.data.length;
    const gap = n <= 3 ? 90 : n <= 5 ? 56 : 36;
    const colw = Math.min(250, (P.width - 30 - gap * (n - 1)) / n);
    plot.style.setProperty('--gap', gap + 'px');
    plot.style.setProperty('--colw', colw + 'px');
    const max = Math.max(...spec.data.map(d => d.value), 0) || 1;
    const room = P.height - 54 - 76;
    document.querySelectorAll('.col .bar').forEach(b => { const v = +b.dataset.v; b.style.height = (v > 0 ? Math.max(4, v / max * room) : 0) + 'px'; });
    const bars = [...document.querySelectorAll('.col .bar')].map(b => b.getBoundingClientRect());
    const r = bars[hi];
    const rightTops = bars.slice(hi + 1).map(q => q.top - P.top - 70);
    anchor = { x: r.right - P.left + 8, y: r.top - P.top + Math.min(70, r.height / 2), mode: 'side', prefer: 'right', ceil: rightTops.length ? Math.min(...rightTops) : Infinity };
  } else if (spec.type === 'hbars') {
    const n = spec.data.length;
    const rowgap = n <= 3 ? 30 : n <= 6 ? 18 : 10;
    const barh = Math.min(74, (P.height - rowgap * (n - 1)) / n);
    plot.style.setProperty('--rowgap', rowgap + 'px');
    plot.style.setProperty('--barh', barh + 'px');
    plot.style.setProperty('--labsize', Math.min(32, barh * 0.6) + 'px');
    plot.style.setProperty('--numsize', Math.min(44, barh * 0.7) + 'px');
    const labw = Math.min(420, Math.max(...[...document.querySelectorAll('.hrow .lab')].map(e => e.scrollWidth)) + 4);
    plot.style.setProperty('--labw', labw + 'px');
    const track = document.querySelector('.track').getBoundingClientRect();
    const max = Math.max(...spec.data.map(d => d.value), 0) || 1;
    const room = track.width - 200;
    document.querySelectorAll('.track .bar').forEach(b => { const v = +b.dataset.v; b.style.width = (v > 0 ? Math.max(4, v / max * room) : 0) + 'px'; });
    const nums = [...document.querySelectorAll('.track .num')].map(e => e.getBoundingClientRect());
    const r = nums[hi];
    anchor = { x: r.left + r.width / 2 - P.left, y: r.bottom - P.top + 6, mode: 'hbars',
      rows: nums.map(q => ({ right: q.right - P.left, cy: q.top + q.height / 2 - P.top })) };
  } else if (spec.type === 'numbers') {
    const n = spec.data.length;
    plot.style.setProperty('--bigsize', (n <= 2 ? 120 : n === 3 ? 96 : 76) + 'px');
    const r = document.querySelector(`.card[data-i="${hi}"]`).getBoundingClientRect();
    anchor = { x: r.left + r.width * 0.72 - P.left, y: r.top - P.top - 10, mode: 'above' };
  } else {
    const svg = document.querySelector('svg.line');
    const W = P.width, H = P.height;
    const R = 300, T = 20, B = 50;
    const all = spec.series.flatMap(s => s.values);
    let lo = Math.min(...all, 0), hiV = Math.max(...all);
    if (hiV === lo) hiV = lo + 1;
    const step = Math.pow(10, Math.floor(Math.log10((hiV - lo) / 4)));
    const nice = [1, 2, 2.5, 5, 10].map(m => m * step).find(s => (hiV - lo) / s <= 5);
    const top = Math.ceil(hiV / nice) * nice, bot = Math.floor(lo / nice) * nice;
    const fmtT = v => (spec.prefix || '') + Number(Math.round(v * 1e6) / 1e6).toLocaleString('en-US', { maximumFractionDigits: spec.decimals != null ? spec.decimals : 1 }) + (spec.suffix || '');
    const ticks = [];
    for (let v = bot; v <= top + 1e-9; v += nice) ticks.push(v);
    const L = 34 + Math.max(...ticks.map(v => fmtT(v).length)) * 12.5;
    const X = i => L + (spec.x.length === 1 ? 0 : i / (spec.x.length - 1)) * (W - L - R);
    const Y = v => T + (1 - (v - bot) / (top - bot)) * (H - T - B);
    const fmtV = v => (spec.prefix || '') + Number(v).toLocaleString('en-US', { maximumFractionDigits: spec.decimals != null ? spec.decimals : 1 }) + (spec.suffix || '');
    let out = '';
    ticks.forEach(v => { out += `<text x="${L - 14}" y="${Y(v) + 7}" text-anchor="end" font-size="20" fill="#4C5A8A">${fmtT(v)}</text>`; });
    out += `<line x1="${L}" y1="${H - B}" x2="${W - R + 20}" y2="${H - B}" stroke="#17255E" stroke-width="3"/>`;
    out += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#17255E" stroke-width="3"/>`;
    const every = Math.ceil(spec.x.length / 7);
    const show = spec.x.map((_, i) => i).filter(i => i % every === 0);
    const last = spec.x.length - 1;
    if (show[show.length - 1] !== last) { if (last - show[show.length - 1] < every * 0.75) show.pop(); show.push(last); }
    show.forEach(i => { out += `<text x="${X(i)}" y="${H - B + 34}" text-anchor="middle" font-size="20" fill="#4C5A8A">${String(spec.x[i]).replace(/[&<>]/g, '')}</text>`; });
    const ends = [];
    spec.series.forEach((s, j) => {
      const on = j === hi;
      const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      out += `<polyline points="${pts}" fill="none" stroke="${on ? '#17255E' : '#8A94BA'}" stroke-width="${on ? 5 : 3}" stroke-linejoin="round" stroke-linecap="round"${on ? '' : ' stroke-dasharray="10 8"'}/>`;
      const lx = X(s.values.length - 1), ly = Y(s.values[s.values.length - 1]);
      out += `<circle cx="${lx}" cy="${ly}" r="${on ? 8 : 6}" fill="${on ? '#17255E' : '#8A94BA'}"/>`;
      ends.push({ j, y: ly, label: String(s.label).replace(/[&<>]/g, ''), v: fmtV(s.values[s.values.length - 1]), on });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 34) ends[k].y = ends[k - 1].y + 34;
    ends.forEach(e => {
      out += `<text x="${W - R + 40}" y="${e.y + 8}" font-size="24" font-weight="${e.on ? 700 : 400}" fill="${e.on ? '#17255E' : '#4C5A8A'}" style="font-family:'Instrument Sans'">${e.label} <tspan style="font-family:'IBM Plex Mono'" font-size="21">${e.v}</tspan></text>`;
    });
    svg.innerHTML = out;
    const s = spec.series[hi], k = typeof (spec.note && spec.note.at) === 'number' ? spec.note.at : s.values.length - 1;
    anchor = { x: X(k) - 10, y: Y(s.values[k]) + 10, mode: 'side', prefer: 'left' };
  }

  const noteEl = document.querySelector('#note');
  if (noteEl && anchor) {
    const nr = noteEl.getBoundingClientRect(), nw = nr.width, nh = nr.height;
    const ex = anchor.x, ey = anchor.y;
    let nx, ny, sx, sy;
    if (anchor.mode === 'hbars') {
      // Sit next to the nearest row that leaves room on its right, and point back at the key value.
      const order = anchor.rows.map((_, k) => k).filter(k => k !== hi).sort((a, b) => Math.abs(a - hi) - Math.abs(b - hi));
      const k = order.find(j => anchor.rows[j].right + 90 + nw <= P.width);
      if (k !== undefined) { nx = Math.max(anchor.rows[k].right + 90, Math.min(P.width - nw, ex + 60)); ny = anchor.rows[k].cy - nh / 2; }
      else { nx = Math.max(0, P.width - nw); ny = Math.min(P.height - nh, ey + 40); }
      sx = nx - 12; sy = ny + nh / 2;
    } else if (anchor.mode === 'above') {
      nx = Math.min(P.width - nw, ex + 70); ny = Math.max(0, ey - nh - 70);
      sx = nx - 12; sy = ny + nh / 2;
    } else {
      let side = anchor.prefer || 'right';
      nx = side === 'right' ? ex + 150 : ex - 150 - nw;
      if (side === 'right' && nx + nw > P.width) { side = 'left'; nx = ex - 150 - nw; }
      if (side === 'left' && nx < 0) { side = 'right'; nx = ex + 150; }
      ny = ey - 44;
      if (anchor.ceil !== undefined && ny + nh > anchor.ceil) ny = anchor.ceil - nh;
      ny = Math.max(0, Math.min(P.height - nh - 60, ny));
      sx = side === 'right' ? nx - 12 : nx + nw + 12; sy = ny + nh / 2;
    }
    noteEl.style.left = nx + 'px';
    noteEl.style.top = ny + 'px';
    let cx = ex + (sx - ex) * 0.55, cy = sy;
    if (anchor.mode === 'hbars' && ey < ny) { sx = nx + Math.min(60, nw * 0.2); sy = ny - 12; cx = ex; cy = sy - 10; }
    const ang = Math.atan2(ey - cy, ex - cx);
    const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
    const head = `M${ex + 17 * Math.cos(a1)} ${ey + 17 * Math.sin(a1)} L${ex} ${ey} L${ex + 17 * Math.cos(a2)} ${ey + 17 * Math.sin(a2)}`;
    document.querySelector('#arrow').innerHTML =
      `<path d="M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}" stroke="#D7263D" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<path d="${head}" stroke="#D7263D" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // Report anything that spills out of the canvas so the caller can fix the spec.
  const spill = [...document.querySelectorAll('h1,.sub,.num,.lab,.note,.big,.foot span')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.right > 1600 - 40 || r.bottom > 900 - 20 || e.scrollWidth > e.clientWidth + 2;
  }).map(e => e.className || e.tagName);
  return spill;
}

(async () => {
  const tmp = path.join(os.tmpdir(), 'ainl-chart-' + process.pid + '.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  const spill = await page.evaluate(layout, { spec, hi });
  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(() => [...document.fonts].filter(x => x.status === 'error').map(x => x.family + ' ' + x.weight));
  await page.screenshot({ path: outPath });
  await browser.close();
  fs.unlinkSync(tmp);
  if (missing.length) console.warn('warning: fonts not loaded: ' + missing.join(', '));
  if (spill.length) console.warn('warning: text may be cut off or too wide: ' + spill.join(', ') + '. Shorten labels or the title.');
  console.log('saved ' + outPath);
})();
