// T19c 探针 H2：用**给 post3d.render 打补丁**的方式改逐帧参数（这样整条合成链会重跑）
const SW = 480, SH = 270;
const cv = document.createElement('canvas');
cv.width = SW; cv.height = SH;
const g = cv.getContext('2d', { willReadFrequently: true });
const comp = window.__app.comp;
const P = window.__app.post3d;
const orig = P.render.bind(P);
function measure() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SW, SH);
  g.drawImage(document.getElementById('stage'), 0, 0, SW, SH);
  if (comp && comp.lyricsCanvas) g.drawImage(comp.lyricsCanvas, 0, 0, SW, SH);
  const d = g.getImageData(0, 0, SW, SH).data;
  const np = SW * SH;
  const lum = new Float32Array(np);
  let sum = 0;
  const hist = new Map();
  for (let k = 0, p = 0; k < d.length; k += 4, p++) {
    lum[p] = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255;
    sum += lum[p];
    const key = ((d[k] >> 2) << 12) | ((d[k + 1] >> 2) << 6) | (d[k + 2] >> 2);
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  let edges = 0;
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
    const i0 = y * SW + x;
    if (Math.abs(lum[i0 - 1] - lum[i0 + 1]) + Math.abs(lum[i0 - SW] - lum[i0 + SW]) > 0.09) edges++;
  }
  let bn = -1, bk = 0;
  for (const kv of hist) if (kv[1] > bn) { bn = kv[1]; bk = kv[0]; }
  return { ed: +(edges / np).toFixed(4), mean: +(sum / np).toFixed(3), nm: +(1 - bn / np).toFixed(3) };
}
const out = [];
for (const t of [60.0, 92.0, 148.0]) {
  const run = (patch) => {
    P.render = (tt, p) => orig(tt, Object.assign({}, p || {}, patch || {}));
    window.__renderAt(t);
    return measure();
  };
  const row = { t: t, base: run(null) };
  {
    const u = P.fx.uniforms;
    row.vals = { r: +u.uRadial.value.toFixed(3), a: +u.uAberr.value.toFixed(3), g: +u.uGlitch.value.toFixed(3), d: +u.uDispersion.value.toFixed(3), s: +u.uScan.value.toFixed(3), v: +u.uVignette.value.toFixed(3), e: +u.uExposure.value.toFixed(3) };
  }
  row.inert = run({ radial: 0, aberration: 0, glitch: 0, dispersion: 0, scan: 0.25, vignette: 0.35, exposure: 1.0 });
  row.noRadial = run({ radial: 0 });
  row.noAberr = run({ aberration: 0 });
  row.noGlitch = run({ glitch: 0 });
  row.noDisp = run({ dispersion: 0 });
  row.scan25 = run({ scan: 0.25 });
  row.noVig = run({ vignette: 0.35 });
  out.push(row);
}
P.render = orig;
return JSON.stringify(out);
