// src/lib/heart3d.js — 蓝色（青蓝）3D 粒子爱心（FIX_V4 §1.13 / §1.14，T07）
//
// 为什么做成共享库：§1.13（段 M）与 §1.14（段 N）要的是**同一颗心**的延续，
// 而 §1.14 明确要求 **粒子数 ≥20000、加法混合、亮度 ≥ 现状 2 倍**。
// 两段各建一份 2 万点的系统既浪费又会不一致，所以在 `init()` 里各建一次、共用这份实现。
//
// §1.14 的逐条落实：
//   · 粒子数 ≥20000          → `count` 默认 22000（外层壳 20000 + 白热核心 2000）
//   · 加法混合                → 所有材质 `blending: AdditiveBlending, depthWrite: false`
//   · 亮度 ≥ 现状 2 倍         → 由调用方把 `?selftest` u) 的曝光与 b) 的亮度一起复核；
//                              这里把每个粒子的基色抬到接近纯色、并叠一层 bloom（由 main.js 的 bloom 统一给）
//   · 核心有**白热光芯**       → 2000 个近白点 + 一颗加法混合的发光球
//   · 心跳时发出**放射状冲击波环**，峰值颜色**青→白** → `rings`（3 个复用的 RingGeometry）
//   · 轮廓用**更亮的发光管**勾出 → 沿心形轮廓的 TubeGeometry
//   · 周围有**缓缓飘散的火花粒子** → `sparks`（900 粒，缓慢外扩 + 上浮）
//
// §1.13 的逐条落实：
//   · 「由字符粒子构成的蓝色(青蓝)粒子爱心」+「有体积的 3D 粒子曲面，缓慢自转」
//     → 点在**心形壳的内外**有厚度（`r = 1 − 0.22·rand²`），不是一张平面剪影；`object.rotation.y` 缓慢自转
//   · 「爱心中心 x≈38%」 → 由调用方按相机反算世界 x（见 m_algebra.js 的 `screenFracToWorldX`）
//
// 形状用的是经典**心形参数曲线** `x = 16sin³t, y = 13cos t − 5cos2t − 2cos3t − cos4t`
// 做基底，再沿 z 给厚度。不用隐式方程逐点求根：2 万点在 init 里求根会明显拖慢首帧，
// 而参数曲线在视觉上同样"是那颗心"。

import { hash01 } from '../core/rng.js'

/** 心形参数曲线（已归一化到 ±1 附近） */
function heartPoint(u) {
  const s = Math.sin(u)
  const x = 16 * s * s * s
  const y = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)
  return { x: x / 17, y: y / 17 }
}

export function createHeartParticles(THREE, opts = {}) {
  const {
    count = 20000, // 外层壳
    coreCount = 2000, // 白热核心
    sparkCount = 900,
    scale = 1,
    seed = 7,
    // T52 / FIX_V5 §M 3:02 + 3:08：段 M 传 `whiteCore:false, lineOutline:false, solidInner:true`
    //   —— 删掉白热核心点团与"中心的白色球"、删掉轮廓发光管（"平面线条心"），
    //   改为同一父级下的**内层实体 3D 心**（与外壳同一条心形曲线、缩放 0.92）。
    //   默认值保持与段 N（§1.14 要求"核心有白热光芯"+ 轮廓发光管）一致 ⇒ 段 N 不受影响。
    whiteCore = true,
    lineOutline = true,
    solidInner = false,
  } = opts
  const grp = new THREE.Group()
  grp.name = 'heart3d'

  const HEART_BLUE = 0x38c8ff
  const HEART_CYAN = 0x8ff0ff
  const CORE_WHITE = 0xffffff

  // ---------------- 外层壳：有心形轮廓 + z 向厚度（"有体积的 3D 粒子曲面"）----------------
  const shellN = count
  const shellPos = new Float32Array(shellN * 3)
  const shellCol = new Float32Array(shellN * 3)
  const cBlue = new THREE.Color(HEART_BLUE)
  const cCyan = new THREE.Color(HEART_CYAN)
  const cWhite = new THREE.Color(CORE_WHITE)
  const tmp = new THREE.Color()
  for (let i = 0; i < shellN; i++) {
    const u = hash01(i, seed) * Math.PI * 2
    const p = heartPoint(u)
    // 壳的厚度：靠近两瓣顶部厚、朝下尖处薄（心的剖面本来就是这样）
    const thick = 0.42 * (0.30 + 0.70 * Math.abs(Math.sin(u)))
    const zr = (hash01(i, seed + 1) * 2 - 1)
    // r 稍微向内收 → 点云有"体积"而不是一层皮
    const r = 1 - 0.22 * hash01(i, seed + 2) * hash01(i, seed + 2)
    const z = zr * thick * (1 - 0.35 * hash01(i, seed + 3))
    shellPos[i * 3] = p.x * r * scale
    shellPos[i * 3 + 1] = p.y * r * scale
    shellPos[i * 3 + 2] = z * scale
    // 颜色：外层青蓝 → 越靠内越白（配合核心形成"白热光芯"的过渡）
    const inner = 1 - Math.abs(r)
    tmp.copy(cBlue).lerp(cCyan, 0.35 + 0.5 * Math.abs(zr)).lerp(cWhite, inner * 0.55)
    shellCol[i * 3] = tmp.r
    shellCol[i * 3 + 1] = tmp.g
    shellCol[i * 3 + 2] = tmp.b
  }
  const shellGeo = new THREE.BufferGeometry()
  shellGeo.setAttribute('position', new THREE.BufferAttribute(shellPos, 3))
  shellGeo.setAttribute('color', new THREE.BufferAttribute(shellCol, 3))
  const shellMat = new THREE.PointsMaterial({
    size: 0.017 * scale,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const shell = new THREE.Points(shellGeo, shellMat)
  grp.add(shell)

  // ---------------- 白热核心：近白密点 + 发光球（T52 / §M 3:02：段 M 关闭）----------------
  let core = null
  let coreMat = null
  let coreGlow = null
  let coreGlowMat = null
  if (whiteCore) {
    const corePos = new Float32Array(coreCount * 3)
    for (let i = 0; i < coreCount; i++) {
      const u = hash01(i, seed + 40) * Math.PI * 2
      const v = Math.acos(2 * hash01(i, seed + 41) - 1)
      const rr = 0.30 * Math.pow(hash01(i, seed + 42), 0.6)
      corePos[i * 3] = Math.sin(v) * Math.cos(u) * rr * scale
      corePos[i * 3 + 1] = Math.cos(v) * rr * 0.85 * scale
      corePos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * rr * scale
    }
    const coreGeo = new THREE.BufferGeometry()
    coreGeo.setAttribute('position', new THREE.BufferAttribute(corePos, 3))
    coreMat = new THREE.PointsMaterial({
      size: 0.013 * scale,
      color: CORE_WHITE,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    core = new THREE.Points(coreGeo, coreMat)
    grp.add(core)

    coreGlowMat = new THREE.MeshBasicMaterial({
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 20, 14), coreGlowMat)
    grp.add(coreGlow)
  }

  // ---------------- 轮廓：更亮的发光管（T52 / §M 3:02：段 M 关闭）----------------
  let outline = null
  let outlineMat = null
  if (lineOutline) {
    const OUTLINE_N = 160
    const pts = []
    for (let i = 0; i < OUTLINE_N; i++) {
      const u = (i / OUTLINE_N) * Math.PI * 2
      const p = heartPoint(u)
      pts.push(new THREE.Vector3(p.x * scale * 1.01, p.y * scale * 1.01, 0))
    }
    const outlineCurve = new THREE.CatmullRomCurve3(pts, true)
    outlineMat = new THREE.MeshBasicMaterial({
      color: 0xcdf6ff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    outline = new THREE.Mesh(new THREE.TubeGeometry(outlineCurve, 180, 0.012 * scale, 8, true), outlineMat)
    grp.add(outline)
  }

  // ---------------- T52 / FIX_V5 §M 3:02 + 3:08：内层实体 3D 心 ----------------
  // 与外壳用**同一条心形参数曲线**（`heartPoint`）⇒ 同形；挂在同一父级 `grp` 下 ⇒ 同旋转；
  // 用同一套坐标（都从 `heartPoint` 的原点出发、z 居中）⇒ 同心；`inner.scale = 0.92` ⇒ 3:08 的"内层缩放 0.92"。
  let inner = null
  let innerMat = null
  if (solidInner) {
    const NSEG = 144
    const shape = new THREE.Shape()
    for (let i = 0; i <= NSEG; i++) {
      const p = heartPoint((i / NSEG) * Math.PI * 2)
      if (i === 0) shape.moveTo(p.x * scale, p.y * scale)
      else shape.lineTo(p.x * scale, p.y * scale)
    }
    const innerGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.42 * scale, bevelEnabled: false, steps: 1 })
    // z 居中：外壳的厚度是对称的（`zr ∈ [-1,1]`），内层也居中才同心
    innerGeo.translate(0, 0, -0.21 * scale)
    innerMat = new THREE.MeshBasicMaterial({
      color: 0x1a5f9e,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
    inner = new THREE.Mesh(innerGeo, innerMat)
    inner.scale.setScalar(0.92)
    grp.add(inner)
  }

  // ---------------- 心跳冲击波环（3 个复用，青 → 白）----------------
  const rings = []
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: HEART_CYAN,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 96), mat)
    m.visible = false
    grp.add(m)
    rings.push({ m, mat })
  }

  // ---------------- 火花粒子：缓缓飘散 ----------------
  const sparkPos = new Float32Array(sparkCount * 3)
  const sparkGeo = new THREE.BufferGeometry()
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
  const sparkMat = new THREE.PointsMaterial({
    size: 0.011 * scale,
    color: 0xaee8ff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const sparks = new THREE.Points(sparkGeo, sparkMat)
  grp.add(sparks)

  const sparkBase = []
  for (let i = 0; i < sparkCount; i++) {
    const u = hash01(i, seed + 60) * Math.PI * 2
    const el = (hash01(i, seed + 61) - 0.5) * 2.2
    sparkBase.push({ u, el, r0: 1.05 + hash01(i, seed + 62) * 0.85, sp: 0.05 + hash01(i, seed + 63) * 0.12 })
  }

  const cRing = new THREE.Color(HEART_CYAN)
  const cRingPeak = new THREE.Color(0xffffff)

  return {
    object: grp,
    shell,
    core,
    outline,
    inner,
    /**
     * @param {number} t
     * @param {{alpha?:number, beat?:number, scale?:number, spin?:number}} o
     *   beat：心跳脉冲 0..1（每个心跳给一次 1）。冲击波环与核心增亮都由它驱动。
     */
    update(t, o = {}) {
      const { alpha = 1, beat = 0, scale: s = 1, spin = 0.22 } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      grp.rotation.y = t * spin
      grp.scale.setScalar(s)
      shellMat.opacity = alpha
      if (coreMat) coreMat.opacity = 0.95 * alpha
      // 心跳时核心更白更亮
      if (coreGlowMat) {
        coreGlowMat.opacity = (0.42 + 0.5 * beat) * alpha
        coreGlow.scale.setScalar(1 + 0.22 * beat)
      }
      if (outlineMat) outlineMat.opacity = (0.75 + 0.25 * (1 - beat)) * alpha
      // T52 / §M 3:08：内层实体心与外层壳同父级 ⇒ 同旋转；0.92 是相对外壳的缩放
      if (innerMat) {
        innerMat.opacity = 0.92 * alpha
        inner.scale.setScalar(0.92 * (1 + 0.05 * beat))
      }
      sparkMat.opacity = 0.65 * alpha

      // 冲击波环：三个错相扩散，峰值由青转白
      for (let i = 0; i < rings.length; i++) {
        const R = rings[i]
        const u = (beat + i / rings.length) % 1
        R.m.visible = alpha > 0.01
        const rr = 1.02 + u * 1.15
        R.m.scale.setScalar(rr)
        R.mat.opacity = Math.max(0, (1 - u)) * 0.85 * alpha
        R.mat.color.copy(cRing).lerp(cRingPeak, Math.pow(1 - u, 2))
      }

      // 火花：缓慢外扩 + 上浮
      for (let i = 0; i < sparkCount; i++) {
        const b = sparkBase[i]
        const ph = (t * b.sp + hash01(i, seed + 70)) % 1
        const r = b.r0 + ph * 0.7
        sparkPos[i * 3] = Math.cos(b.u) * Math.cos(b.el) * r * scale
        sparkPos[i * 3 + 1] = (Math.sin(b.el) * r + ph * 0.5) * scale
        sparkPos[i * 3 + 2] = Math.sin(b.u) * Math.cos(b.el) * r * scale
      }
      sparkGeo.attributes.position.needsUpdate = true
    },
  }
}

/**
 * 把"画面横向占比"换算成该深度上的世界 x。
 * §1.13 要求爱心中心 x≈38%、立绘占右侧 66–96%；段 M/N 的相机由 rig.js 驱动，
 * 所以用相机的 fov/aspect 反算，保证在**屏幕上**真的落在那个比例（而不是靠手调常量）。
 */
export function screenFracToWorldX(camera, frac, dist) {
  const halfH = Math.abs(dist) * Math.tan(((camera.fov || 40) * Math.PI) / 180 / 2)
  const halfW = halfH * (camera.aspect || 16 / 9)
  return (frac * 2 - 1) * halfW
}
