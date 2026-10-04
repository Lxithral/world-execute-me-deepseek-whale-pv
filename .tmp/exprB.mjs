// T19b 探针 B：段 E 全段 59.0–74.0 @0.5s，复刻 ?selftest 的 b) 画面密度与 v) 四角亮度口径
// （480×270 采样 + 歌词层；nm = 非众数占比、ed = 边缘占比、corner = 四角 48×27 平均亮度）
const SW = 480, SH = 270;
const cv = document.createElement('canvas');
cv.width = SW; cv.height = SH;
const g = cv.getContext('2d', { willReadFrequently: true });
const comp = window.__app.comp;
const out = [];
for (let t = 59.0; t <= 74.001; t += 0.5) {
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
  const lum = new Float32Array(SW * SH);
  let dev = 0;
  for (let k = 0, p = 0; k < d.length; k += 4, p++) {
    if (Math.abs(d[k] - mr) + Math.abs(d[k + 1] - mg) + Math.abs(d[k + 2] - mb) > 10) dev++;
    lum[p] = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255;
  }
  let edges = 0;
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
    const i0 = y * SW + x;
    const gx = lum[i0 - 1] - lum[i0 + 1], gy = lum[i0 - SW] - lum[i0 + SW];
    if (Math.abs(gx) + Math.abs(gy) > 0.09) edges++;
  }
  const np = SW * SH;
  let lumSum = 0;
  for (let k = 0; k < lum.length; k++) lumSum += lum[k];
  const cw = 48, chh = 27;
  let cs = 0, cn2 = 0;
  for (const c of [[0, 0], [SW - cw, 0], [0, SH - chh], [SW - cw, SH - chh]]) {
    for (let y = c[1]; y < c[1] + chh; y++) for (let x = c[0]; x < c[0] + cw; x++) {
      const i = (y * SW + x) * 4;
      cs += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      cn2++;
    }
  }
  out.push({
    t: +t.toFixed(2),
    nm: +(dev / np).toFixed(3),
    ed: +(edges / np).toFixed(3),
    mean: +(lumSum / np).toFixed(3),
    corner: +(cs / cn2 / 255).toFixed(4),
    flash: +window.__app.fx.flash(t).toFixed(3),
  });
}
return JSON.stringify(out);
