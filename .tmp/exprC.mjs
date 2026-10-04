// T19b 探针 C：E3 暖色窗口与 E4 交界处的四角亮度 + 闪白豁免（0.2s 以下加密）
const W = 1920, H = 1080;
const cv = document.createElement('canvas');
cv.width = W; cv.height = H;
const g = cv.getContext('2d', { willReadFrequently: true });
const times = [66.8, 67.2, 67.4, 67.5, 67.6, 67.7, 67.8, 68.0, 68.2, 68.6, 69.0, 69.1, 69.2, 69.3, 69.41, 69.5, 69.6, 69.65, 69.7, 69.75, 69.8, 69.9, 70.0];
const out = [];
for (const t of times) {
  window.__renderAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.drawImage(document.getElementById('stage'), 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  let r = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 28) { r += d[i]; b += d[i + 2]; n++; }
  const cw = Math.round(W * 0.12), chh = Math.round(H * 0.12);
  let cs = 0, cn = 0;
  for (const c of [[0, 0], [W - cw, 0], [0, H - chh], [W - cw, H - chh]]) {
    for (let y = c[1]; y < c[1] + chh; y += 2) for (let x = c[0]; x < c[0] + cw; x += 2) {
      const i = (y * W + x) * 4;
      cs += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      cn++;
    }
  }
  out.push({
    t: t,
    warm: +((r - b) / n / 255).toFixed(3),
    corner: +(cs / cn / 255).toFixed(4),
    flash: +window.__app.fx.flash(t).toFixed(3),
    ov: window.__app.findTextOverlaps(0.1).total,
    err: window.__errors.length,
  });
}
return JSON.stringify(out);
