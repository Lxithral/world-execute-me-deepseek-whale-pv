// T19b 探针 D：66.0–71.0 @0.1s，用 ?selftest v) 的**完全同一口径**
// （480×270 合成画布含歌词层 + 四角各 48×27 小块），逐点报 corner 与 fx.flash，
// 用来确认"闪面亮着 ⇒ fx.flash>0.02"以及 E3 窗口是否会在更密采样下越界。
const SW = 480, SH = 270;
const cv = document.createElement('canvas');
cv.width = SW; cv.height = SH;
const g = cv.getContext('2d', { willReadFrequently: true });
const comp = window.__app.comp;
const out = [];
const bad = [];
for (let t = 66.0; t <= 71.001; t += 0.1) {
  window.__renderAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SW, SH);
  g.drawImage(document.getElementById('stage'), 0, 0, SW, SH);
  if (comp && comp.lyricsCanvas) g.drawImage(comp.lyricsCanvas, 0, 0, SW, SH);
  const d = g.getImageData(0, 0, SW, SH).data;
  const cw = 48, chh = 27;
  let cs = 0, cn = 0;
  for (const c of [[0, 0], [SW - cw, 0], [0, SH - chh], [SW - cw, SH - chh]]) {
    for (let y = c[1]; y < c[1] + chh; y++) for (let x = c[0]; x < c[0] + cw; x++) {
      const i = (y * SW + x) * 4;
      cs += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      cn++;
    }
  }
  const corner = cs / cn / 255;
  const flash = window.__app.fx.flash(t);
  const ov = window.__app.findTextOverlaps(0.1).total;
  if (corner > 0.12 && flash <= 0.02) bad.push({ t: +t.toFixed(2), corner: +corner.toFixed(4), flash: +flash.toFixed(3) });
  out.push({ t: +t.toFixed(2), corner: +corner.toFixed(4), flash: +flash.toFixed(3), ov: ov, err: window.__errors.length });
}
const maxC = out.reduce((a, b) => (b.corner > a.corner ? b : a));
return JSON.stringify({ viol: bad, maxAll: maxC, n: out.length, ovSum: out.reduce((a, b) => a + b.ov, 0), errSum: out.reduce((a, b) => a + b.err, 0), window: out.filter((x) => x.t >= 69.2 && x.t <= 69.8) });
