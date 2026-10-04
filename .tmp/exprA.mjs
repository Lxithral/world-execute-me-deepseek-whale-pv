// T19b 探针 A：段 E 的 E4/E5 时段 66.0–74.0 @0.2s
// 量：整帧 r/b（红橙 vs 冷蓝）、四角平均亮度、文字重叠、errors、▶ 的 NDC、
//     冲击波环在场数、相机是否在玻璃笼包围盒内。
const W = 1920, H = 1080;
const cv = document.createElement('canvas');
cv.width = W; cv.height = H;
const g = cv.getContext('2d', { willReadFrequently: true });
const S = window.__app.SCENES.find((s) => s.id === 'E');
const out = [];
for (let t = 66.0; t <= 74.001; t += 0.2) {
  window.__renderAt(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.drawImage(document.getElementById('stage'), 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 28) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  const cw = Math.round(W * 0.12), chh = Math.round(H * 0.12);
  let cs = 0, cn = 0;
  for (const c of [[0, 0], [W - cw, 0], [0, H - chh], [W - cw, H - chh]]) {
    for (let y = c[1]; y < c[1] + chh; y += 2) for (let x = c[0]; x < c[0] + cw; x += 2) {
      const i = (y * W + x) * 4;
      cs += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      cn++;
    }
  }
  const ov = window.__app.findTextOverlaps(0.1);
  const cam = window.__ctx.three.camera;
  const nd = S.play.position.clone().project(cam);
  let mn = { x: 1e9, y: 1e9, z: 1e9 }, mx = { x: -1e9, y: -1e9, z: -1e9 };
  let nw = 0;
  for (const w of S.walls) {
    if (!w.visible) continue;
    nw++;
    w.updateMatrixWorld(true);
    const e = w.matrixWorld.elements;
    const hw = w.geometry.parameters.width / 2, hh = w.geometry.parameters.height / 2;
    for (const ab of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = ab[0] * hw, y = ab[1] * hh, z = 0;
      const X = e[0] * x + e[4] * y + e[8] * z + e[12];
      const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
      const Z = e[2] * x + e[6] * y + e[10] * z + e[14];
      mn.x = Math.min(mn.x, X); mx.x = Math.max(mx.x, X);
      mn.y = Math.min(mn.y, Y); mx.y = Math.max(mx.y, Y);
      mn.z = Math.min(mn.z, Z); mx.z = Math.max(mx.z, Z);
    }
  }
  const p = cam.position;
  const inCage = nw > 0 && p.x > mn.x && p.x < mx.x && p.y > mn.y && p.y < mx.y && p.z > mn.z && p.z < mx.z;
  out.push({
    t: +t.toFixed(2),
    R: +(r / n / 255).toFixed(3),
    B: +(b / n / 255).toFixed(3),
    warm: +((r - b) / n / 255).toFixed(3),
    corner: +(cs / cn / 255).toFixed(4),
    ov: ov.total,
    err: window.__errors.length,
    play: S.play.visible ? 1 : 0,
    ndcX: +nd.x.toFixed(2),
    ndcY: +nd.y.toFixed(2),
    shock: S.shocks.filter((s) => s.visible).length,
    inCage: inCage ? 1 : 0,
  });
}
return JSON.stringify(out);
