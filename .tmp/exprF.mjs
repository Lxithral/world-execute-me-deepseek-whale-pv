// T19c 探针 F：全片 0.5s 复扫 u)/b)/v)（复刻 ?selftest 的口径）
//   · 采样：480×270 合成图 + 歌词层（与 scanFilm 一致）
//   · u) mean∈[0.10,0.45]、p95≤0.95、过曝(≥0.98)≤2%   豁免 = EXEMPT_U（抄自 exposure.js）
//   · b) nm≥0.18（器乐段 0.25）、ed≥0.04              豁免 = EXEMPT_B（抄自 main.js）
//   · v) 四角(48×27)≤0.12，闪白(fx.flash>0.02)与黑场豁免
const SW = 480, SH = 270;
const cv = document.createElement('canvas');
cv.width = SW; cv.height = SH;
const g = cv.getContext('2d', { willReadFrequently: true });
const comp = window.__app.comp;
const fx = window.__app.fx;
const dur = window.__app.clock.duration;
const EXEMPT_U = [[48.4, 51.6],[0, 0.85], [69.40, 69.72], [146.45, 147.95], [161.8, 162.2], [205.9, 206.5], [209.0, 211.907]];
const EXEMPT_B = [[48.4, 51.6],[0, 0.85], [69.40, 69.72], [146.45, 147.95], [161.8, 162.2], [205.9, 206.5], [209.0, 211.907]];
const INSTR = [[14.5, 29.7], [129.0, 147.9], [193.0, 205.9]];
const inR = (t, rs) => rs.some((r) => t >= r[0] && t <= r[1]);
const uBad = [], bBad = [], vBad = [];
const rows = [];
const means = [];
const STEP = 0.5;
let n = 0;
for (let t = 0; t <= dur - 0.05; t += STEP) {
  window.__renderAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SW, SH);
  g.drawImage(document.getElementById('stage'), 0, 0, SW, SH);
  if (comp && comp.lyricsCanvas) g.drawImage(comp.lyricsCanvas, 0, 0, SW, SH);
  const d = g.getImageData(0, 0, SW, SH).data;
  const hist = new Map();
  for (let k = 0; k < d.length; k += 4) {
    const key = ((d[k] >> 2) << 12) | ((d[k + 1] >> 2) << 6) | (d[k + 2] >> 2);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  let bk = 0, bn = -1;
  for (const kv of hist) if (kv[1] > bn) { bn = kv[1]; bk = kv[0]; }
  let sr = 0, sg = 0, sb = 0, cn = 0;
  for (let k = 0; k < d.length; k += 4) {
    const key = ((d[k] >> 2) << 12) | ((d[k + 1] >> 2) << 6) | (d[k + 2] >> 2);
    if (key === bk) { sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; cn++; }
  }
  const mr = sr / Math.max(1, cn), mg = sg / Math.max(1, cn), mb = sb / Math.max(1, cn);
  const np = SW * SH;
  const lum = new Float32Array(np);
  let dev = 0, over = 0, lumSum = 0;
  const lh = new Int32Array(257);
  for (let k = 0, p = 0; k < d.length; k += 4, p++) {
    if (Math.abs(d[k] - mr) + Math.abs(d[k + 1] - mg) + Math.abs(d[k + 2] - mb) > 10) dev++;
    const L = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255;
    lum[p] = L;
    lumSum += L;
    if (L >= 0.98) over++;
    lh[Math.min(256, Math.round(L * 256))]++;
  }
  let edges = 0;
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
    const i0 = y * SW + x;
    if (Math.abs(lum[i0 - 1] - lum[i0 + 1]) + Math.abs(lum[i0 - SW] - lum[i0 + SW]) > 0.09) edges++;
  }
  let p95 = 0;
  {
    const want = Math.ceil(np * 0.95);
    let acc = 0;
    for (let b = 0; b <= 256; b++) { acc += lh[b]; if (acc >= want) { p95 = b / 256; break; } }
  }
  const cw = 48, chh = 27;
  let cs = 0, cn2 = 0;
  for (const c of [[0, 0], [SW - cw, 0], [0, SH - chh], [SW - cw, SH - chh]]) {
    for (let y = c[1]; y < c[1] + chh; y++) for (let x = c[0]; x < c[0] + cw; x++) {
      const i = (y * SW + x) * 4;
      cs += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      cn2++;
    }
  }
  const corner = cs / cn2 / 255;
  const mean = lumSum / np;
  const flash = fx.flash(t);
  const nm = dev / np, ed = edges / np;
  means.push(+mean.toFixed(3));
  n++;
  if (n <= 90) rows.push(t.toFixed(1) + '|' + mean.toFixed(3) + '|' + p95.toFixed(2) + '|' + (over / np).toFixed(3) + '|' + nm.toFixed(2) + '|' + ed.toFixed(3) + '|' + corner.toFixed(3));
  if (!inR(t, EXEMPT_U) && flash <= 0.02) {
    const why = [];
    if (mean < 0.1) why.push('mean' + mean.toFixed(3) + '<0.10');
    if (mean > 0.45) why.push('mean' + mean.toFixed(3) + '>0.45');
    if (p95 > 0.95) why.push('p95' + p95.toFixed(2));
    if (over / np > 0.02) why.push('over' + (over / np * 100).toFixed(1) + '%');
    if (why.length) uBad.push(t.toFixed(1) + ':' + why.join('/'));
  }
  if (!inR(t, EXEMPT_B) && flash <= 0.02) {
    const need = inR(t, INSTR) ? 0.25 : 0.18;
    if (nm < need || ed < 0.04) bBad.push(t.toFixed(1) + ':nm' + nm.toFixed(2) + '/ed' + ed.toFixed(3));
  }
  if (flash <= 0.02 && !inR(t, EXEMPT_U) && corner > 0.12) vBad.push(t.toFixed(1) + ':' + corner.toFixed(3));
}
return JSON.stringify({
  dur: +dur.toFixed(2), n,
  u: { count: uBad.length, bad: uBad.slice(0, 30) },
  b: { count: bBad.length, bad: bBad.slice(0, 30) },
  v: { count: vBad.length, bad: vBad.slice(0, 30) },
  meanRange: [Math.min(...means), Math.max(...means)],
  rows: rows,
});
