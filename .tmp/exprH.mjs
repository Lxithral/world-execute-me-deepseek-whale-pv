// T19c 探针 H：定位 b) 边缘密度下降的原因 —— 在同一帧上单独打开/关闭刚被激活的后处理参数
const SW = 480, SH = 270;
const cv = document.createElement('canvas');
cv.width = SW; cv.height = SH;
const g = cv.getContext('2d', { willReadFrequently: true });
const comp = window.__app.comp;
const P = window.__app.post3d;
function measure() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SW, SH);
  g.drawImage(document.getElementById('stage'), 0, 0, SW, SH);
  if (comp && comp.lyricsCanvas) g.drawImage(comp.lyricsCanvas, 0, 0, SW, SH);
  const d = g.getImageData(0, 0, SW, SH).data;
  const np = SW * SH;
  const lum = new Float32Array(np);
  let sum = 0;
  for (let k = 0, p = 0; k < d.length; k += 4, p++) {
    lum[p] = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255;
    sum += lum[p];
  }
  let edges = 0;
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
    const i0 = y * SW + x;
    if (Math.abs(lum[i0 - 1] - lum[i0 + 1]) + Math.abs(lum[i0 - SW] - lum[i0 + SW]) > 0.09) edges++;
  }
  return { ed: +(edges / np).toFixed(4), mean: +(sum / np).toFixed(3) };
}
const out = [];
for (const t of [60.0, 92.0, 148.0]) {
  const u = P.fx.uniforms;
  window.__renderAt(t);
  const baseVals = { r: u.uRadial.value, s: u.uScan.value, a: u.uAberr.value, gl: u.uGlitch.value, di: u.uDispersion.value, v: u.uVignette.value, e: u.uExposure.value };
  const row = { t: t, vals: baseVals, base: measure() };
  const again = (patch) => {
    window.__renderAt(t);
    for (const k of Object.keys(patch)) u[k].value = patch[k];
    P.composer.render();
    return measure();
  };
  row.noRadial = again({ uRadial: 0 });
  row.noAberr = again({ uAberr: 0 });
  row.noGlitch = again({ uGlitch: 0 });
  row.scan25 = again({ uScan: 0.25 });
  row.noDisp = again({ uDispersion: 0 });
  row.allOff = again({ uRadial: 0, uAberr: 0, uGlitch: 0, uDispersion: 0, uScan: 0.25 });
  out.push(row);
}
return JSON.stringify(out);
