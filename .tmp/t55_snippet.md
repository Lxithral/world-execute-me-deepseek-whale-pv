# T55 §3 新增自检落码片段（等 4K 导出结束后照此改；不改任何阈值/检测器口径）

## 编辑 ① `src/scenes/l_training.js`（`drawPrism`，锚点：`:487 const PC = …` 之后、`:488 const nL` 之前）

old_string（唯一）:
```
  const PC = { x: cx - COS30 * R, y: cy + 0.5 * R } // 左下
  const nL = { x: -COS30, y: -0.5 } // 左面（PC→PA）外法线
```
new_string:
```
  const PC = { x: cx - COS30 * R, y: cy + 0.5 * R } // 左下
  // FIX_V5 §3 新增自检（T55）：等边三角形三边长的相对误差。
  // PA/PB/PC 由 (cx, cy−R) / (cx±COS30·R, cy+0.5R) 构造 ⇒ 三边恒等于 R·√3；
  // 这里只把实测边长暴露给 selftest，不改几何、不改判据。
  const edges = [
    Math.hypot(PA.x - PB.x, PA.y - PB.y),
    Math.hypot(PB.x - PC.x, PB.y - PC.y),
    Math.hypot(PC.x - PA.x, PC.y - PA.y),
  ]
  const eMin = Math.min(edges[0], edges[1], edges[2])
  const eMax = Math.max(edges[0], edges[1], edges[2])
  const eMean = (edges[0] + edges[1] + edges[2]) / 3
  out.edges = edges.map((v) => +v.toFixed(4))
  out.edgeErrPct = +(((eMax - eMin) / eMean) * 100).toFixed(6)
  const nL = { x: -COS30, y: -0.5 } // 左面（PC→PA）外法线
```

## 编辑 ② `src/scenes/n_handoff.js`（心脏 metrics 块，锚点：`:107 this.metrics.heartYawGapAtLast = …` 之后）

old_string（唯一）:
```
      this.metrics.heartYawGap = yawGap(t * HEART_SPIN)
      this.metrics.heartYawGapAtLast = yawGap(T_LAST * HEART_SPIN)
```
new_string:
```
      this.metrics.heartYawGap = yawGap(t * HEART_SPIN)
      this.metrics.heartYawGapAtLast = yawGap(T_LAST * HEART_SPIN)
      // FIX_V5 §3 新增自检（T55）：yaw 绝对值（**不 toFixed**，1e-6 级角速度判据会被舍入吃掉）。
      this.metrics.heartYaw = t * HEART_SPIN
```

## 编辑 ③ `src/core/compositor.js`（CRT 幕布块，锚点：`:382 if (crtCurtain) {`）

old_string（唯一）:
```
    if (crtCurtain) {
      const bandH = Math.max(2, Math.round(H * openCrt))
      const bandY = Math.round((H - bandH) / 2)
      const glow = Math.max(1, Math.min(6, bandH - 2))
```
new_string:
```
    // FIX_V5 §3 自检（T55）用：暴露本帧幕布几何（逻辑像素）与展开度。只读，渲染不消费。
    this.crtBand = null
    if (crtCurtain) {
      const bandH = Math.max(2, Math.round(H * openCrt))
      const bandY = Math.round((H - bandH) / 2)
      const glow = Math.max(1, Math.min(6, bandH - 2))
      this.crtBand = { level: openCrt, bandY, bandH, line: crtLine }
```

## 编辑 ④ `src/main.js`（插入到 `:2730 await yieldNow()` 之后、`:2732 // ---- s) 孤儿元素` 之前）

（正文见下方 fenced block；`z1`/`z2`/`z3` 三条，风格与 g 项一致：`try { … await say(id, ok, detail) } catch { await say(id, false, msg) }` + `await yieldNow()`。）

```js
  // ---- T55) FIX_V5 §3 新增自检：棱镜三边 / 心脏 yaw / CRT 纵横比 ----
  // 三项判据逐字取自 FIX_V5 §3：「棱镜三边长相对误差 <0.5%」「心脏 yaw(205.964) mod 2π <0.05rad」
  // 「CRT 开关机帧中画面内容的纵横比不变(G7)」。只读既有实现暴露的 metrics/幕布几何，
  // 不改任何检测器口径，也不动上面的 g2–g9。
  try {
    const lsc = SCENES.find((s) => s.id === 'L')
    renderAt(175.3) // 棱镜在场（173.15→177.40，env=1/fade=1），此时 metrics.prism 才会被写
    const pr = lsc && lsc.metrics && lsc.metrics.prism
    const eErr = pr ? pr.edgeErrPct : undefined
    await say(
      'z1 棱镜三边',
      typeof eErr === 'number' && Number.isFinite(eErr) && eErr < 0.5,
      pr && pr.edges
        ? `t=175.3 三边 ${pr.edges.map((v) => v.toFixed(1)).join(' / ')}px，相对误差 ${eErr}%（判据 <0.5%）`
        : '拿不到 metrics.prism（棱镜未绘制？）'
    )
  } catch (e) {
    await say('z1 棱镜三边', false, String(e && e.message))
  }
  await yieldNow()

  try {
    const nsc = SCENES.find((s) => s.id === 'N')
    const yawAt = (t) => {
      renderAt(t)
      return nsc && nsc.metrics ? nsc.metrics.heartYaw : NaN
    }
    const y0 = yawAt(200.0)
    const y1 = yawAt(203.0)
    const y2 = yawAt(205.9)
    renderAt(205.964)
    const spin = nsc && nsc.metrics ? nsc.metrics.heartSpin : NaN
    const gap = nsc && nsc.metrics ? nsc.metrics.heartYawGapAtLast : NaN
    const w1 = (y1 - y0) / 3.0
    const w2 = (y2 - y1) / 2.9
    // 匀速 = 三段采样间的角速度恒等于声明的 HEART_SPIN（既不停转也没有顿帧）
    const uniform =
      [w1, w2, spin].every((v) => Number.isFinite(v)) &&
      Math.abs(w1 - spin) < 1e-6 &&
      Math.abs(w2 - spin) < 1e-6 &&
      Math.abs(w1 - w2) < 1e-6
    await say(
      'z2 心脏 yaw',
      uniform && Number.isFinite(gap) && gap < 0.05,
      `yaw(205.964) 距 2π 整数倍 ${Number.isFinite(gap) ? gap.toFixed(5) : 'NaN'}rad（判据 <0.05）；` +
        `角速度 ${w1.toFixed(6)} / ${w2.toFixed(6)} vs HEART_SPIN ${Number.isFinite(spin) ? spin.toFixed(6) : 'NaN'} rad·s⁻¹ ⇒ 匀速 ${uniform ? '是' : '否'}`
    )
  } catch (e) {
    await say('z2 心脏 yaw', false, String(e && e.message))
  }
  await yieldNow()

  try {
    // G7 判别法：自然帧的可见带 vs 全开参考帧**同一行区间**（裁剪 ⇒ 只差扫描线/亮线）
    // 对比 vs 全开参考帧**纵向压进带内**（= 旧压扁行为）⇒ 前者必须明显更小。
    const sc = canvas.height / comp.H
    const gw = canvas.width
    const scratch = document.createElement('canvas')
    const sg = scratch.getContext('2d', { willReadFrequently: true })
    const rowDiff = (x, y, n) => {
      let s = 0
      for (let i = 0; i < n; i++) s += Math.abs(x[i] - y[i])
      return s / n
    }
    const ratios = []
    const parts = []
    for (const t of [0.5, 0.7, 209.4, 209.8]) {
      fx.setCrtLevel(null)
      renderAt(t)
      const band = comp.crtBand
      if (!band || !(band.level > 0) || band.level >= 1) {
        parts.push(`t=${t} 无幕布`)
        continue
      }
      const y0dev = Math.round(band.bandY * sc)
      const hdev = Math.max(2, Math.round(band.bandH * sc))
      const pad = Math.max(1, Math.round(8 * sc))
      const nat = grab(y0dev, hdev)
      // 全开参考帧
      fx.setCrtLevel(1)
      renderAt(t)
      const refRows = grab(y0dev, hdev)
      scratch.width = gw
      scratch.height = hdev
      sg.setTransform(1, 0, 0, 1, 0, 0)
      sg.clearRect(0, 0, gw, hdev)
      sg.drawImage(canvas, 0, 0, gw, canvas.height, 0, 0, gw, hdev) // 全帧压进带内
      const squashed = sg.getImageData(0, 0, gw, hdev).data
      let dSame = 0
      let dScale = 0
      let n = 0
      const rowBytes = gw * 4
      for (let j = pad; j < hdev - pad; j++) {
        const off = j * rowBytes + pad * 4
        const len = (gw - pad * 2) * 4
        dSame += rowDiff(nat, refRows, 0) // placeholder（下面用真实切片）
        dScale += 0
        n++
      }
      ratios.push(0)
      parts.push(`t=${t} level=${band.level.toFixed(3)}`)
    }
    fx.setCrtLevel(null)
    await say('z3 CRT 纵横比', false, parts.join('；'))
  } catch (e) {
    fx.setCrtLevel(null)
    await say('z3 CRT 纵横比', false, String(e && e.message))
  }
  await yieldNow()
```

> ⚠️ 上面 z3 里的逐行累加（`dSame += rowDiff(nat, refRows, 0)` 等）是**占位骨架**，落码时必须写成按行真实切片：
> `const o = j * rowBytes + pad * 4, len = (gw - pad * 2) * 4`；
> `for (let k = 0; k < len; k++) { dSame += Math.abs(nat[o + k] - refRows[o + k]); dScale += Math.abs(nat[o + k] - squashed[o + k]) }`；
> `n += len`；最后 `const dSameM = dSame / n, dScaleM = dScale / n, ratio = dScaleM / Math.max(1e-6, dSameM)`；
> 判据 = 四个 t 都 `ratio > 1`（T54 探针实测 1.95–6.59），detail 里报每个 t 的 `diffSame/diffScale/ratio`。
> `grab` 需在循环外定义：`const grab = (y0, h) => { scratch.width = gw; scratch.height = h; sg.setTransform(1,0,0,1,0,0); sg.clearRect(0,0,gw,h); sg.drawImage(canvas, 0, y0, gw, h, 0, 0, gw, h); return sg.getImageData(0,0,gw,h).data }`。
> 注意 `scratch`/`sg` 同时被 `grab` 与压扁参考复用 ⇒ 调用顺序必须是 nat → refRows → squashed，且每次 `getImageData` 后立刻算差或复制（`new Uint8ClampedArray(...)`），否则被下一次 `width` 赋值清空。**落码时改为三张独立 scratch 画布**（nat/ref/squash）避免这个坑。
