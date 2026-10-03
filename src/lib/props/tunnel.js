// src/lib/props/tunnel.js — 全屏时间隧道（FIX.md §2.7 + §3 段 D）
//
// §2.7：「沿 z 轴的一串环，每环带巨大年份数字(≥200px)，相机高速穿过；
//        AD/BC 词处数字符号翻转、流向反转。」
// §3 D：「全屏时间隧道，年份巨字高速飞过；**修复"只有中间一小条"的 bug，隧道必须占满整个画面**。」
//
// 旧 bug 的成因（已审计在 docs/AUDIT.md）：隧道其实只是一条 2D 轴线 + 刻度，
// 再被"蒙眼黑条"夹成一条缝，所以只剩中间一小条。这里的修法是**结构性**的：
//   ① 一层**实心内壁**（开口圆柱 + BackSide）保证任何时刻画面都被填满，不靠环本身；
//   ② 一串沿 z 高速流动的环（实例化），提供深度与穿越感；
//   ③ 年份巨字用 **billboard 平面 + canvas 贴图（220px）**，始终正对相机；
//   ④ AD/BC 处数字加负号、并整体反向流动。
// 并提供 coverageAt() 供自检：在给定相机参数下检查内壁半径是否覆盖画面四角。

import * as THREE from 'three'
import { clamp, span, TAU } from '../../core/ease.js'
import { hash01 } from '../../core/rng.js'
import { text } from '../../ui/text.js'

const NUMERAL_PX = 220 // FIX §2.7 要求 ≥200px

/** 年份 → canvas 贴图（含 AD/BC 的正负号与纪元后缀） */
function yearTexture(year, { negative = false, palette = null } = {}) {
  const w = 1024
  const h = 384
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  g.clearRect(0, 0, w, h)
  const col = palette || (negative ? '#ff9f6e' : '#a9e6ff')
  const label = negative ? `-${Math.abs(year)}` : `${year}`
  // 字号守卫：role='title' 的下限是 120，这里给 220（FIX 要求 ≥200）
  text(g, label, w / 2, h * 0.52, { role: 'title', size: NUMERAL_PX, family: 'code', weight: 700, color: col, align: 'center', baseline: 'middle' })
  text(g, negative ? 'BC' : 'AD', w / 2, h * 0.86, { role: 'label', size: 44, family: 'code', weight: 600, color: col, align: 'center', baseline: 'middle', alpha: 0.8 })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 内壁的条纹贴图（沿 z 重复，制造高速掠过感） */
function boreTexture({ color = '#2a6f8f', accent = '#7fe6ff' } = {}) {
  const w = 512
  const h = 64
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = 'rgba(13,24,38,1)'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 56; i++) {
    const x = hash01(i, 91) * w
    const len = 2 + hash01(i, 92) * 14
    g.fillStyle = i % 4 === 0 ? accent : color
    g.globalAlpha = 0.3 + hash01(i, 93) * 0.6
    g.fillRect(x, 0, len, h)
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * @param {{renderer?:THREE.WebGLRenderer, radius?:number, rings?:number, span?:number,
 *          reverseAt?:number[], signFlipAt?:number[], startYear?:number, numerals?:number}} [opts]
 *   reverseAt: 流向反转的时刻（§3 段 D 的 AD/BC 词）
 *   signFlipAt: 数字加负号（BC）的时刻
 */
export function createTunnel(opts = {}) {
  const {
    renderer = null,
    radius = 3.0,
    rings = 40,
    span = 26, // 环在 z 上的总长度
    reverseAt = [],
    signFlipAt = [],
    startYear = 2049,
    numerals = 10,
  } = opts

  const grp = new THREE.Group()
  grp.name = 'prop:tunnel'

  // ---- ① 实心内壁：保证"占满整个画面" ----
  const boreTex = boreTexture()
  boreTex.repeat.set(1, 10)
  const boreMat = new THREE.MeshBasicMaterial({
    map: boreTex,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    color: 0x8fd4ff,
  })
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.995, radius * 0.995, span, 48, 1, true), boreMat)
  bore.rotation.x = Math.PI / 2
  bore.name = 'tunnelBore'
  grp.add(bore)

  // 内壁的"底"（远端收束成一点，避免看到开口外的黑）
  const capMat = new THREE.MeshBasicMaterial({ color: 0x05080e, transparent: true, opacity: 0.95, depthWrite: false })
  const cap = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), capMat)
  cap.position.z = -span * 0.52
  grp.add(cap)

  // ---- ② 环：实例化，沿 z 循环流动 ----
  const ringGeo = new THREE.TorusGeometry(radius * 0.985, 0.035, 8, 64)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x9fe4ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, rings)
  ringMesh.frustumCulled = false
  ringMesh.name = 'tunnelRings'
  const phases = new Float32Array(rings)
  for (let i = 0; i < rings; i++) phases[i] = hash01(i, 7)
  grp.add(ringMesh)

  // ---- ③ 年份巨字：billboard ----
  const numeralGroup = new THREE.Group()
  numeralGroup.name = 'tunnelNumerals'
  const numeralSlots = []
  for (let i = 0; i < numerals; i++) {
    const slot = { texAD: null, texBC: null, mat: null, mesh: null, baseYear: startYear + i * 7 }
    slot.texAD = yearTexture(slot.baseYear, { negative: false })
    slot.texBC = yearTexture(slot.baseYear, { negative: true })
    slot.mat = new THREE.MeshBasicMaterial({ map: slot.texAD, transparent: true, opacity: 0.95, depthWrite: false })
    slot.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.75), slot.mat)
    slot.mesh.name = `year:${slot.baseYear}`
    numeralGroup.add(slot.mesh)
    numeralSlots.push(slot)
  }
  grp.add(numeralGroup)

  /** 流向：reverseAt 每命中一次就反向 */
  function flowSign(t) {
    let s = 1
    for (const tt of reverseAt) if (t >= tt) s = -s
    return s
  }
  /** 是否已进入 BC（signFlipAt 命中即加负号） */
  function isNegative(t) {
    let neg = false
    for (const tt of signFlipAt) if (t >= tt) neg = !neg
    return neg
  }

  /**
   * @param {number} t
   * @param {{camera?:THREE.Camera, alpha?:number, speed?:number, rms?:number}} [o]
   */
  function update(t, o = {}) {
    const { camera = null, alpha = 1, speed = 9, rms = 0 } = o
    const dir = flowSign(t)
    const neg = isNegative(t)
    const v = speed * (1 + rms * 1.6)

    // 环：z = 起点 + (i/rings)*span + 时间位移，循环
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const sc = new THREE.Vector3()
    const p = new THREE.Vector3()
    const off = ((t * v * dir) % span + span) % span
    for (let i = 0; i < rings; i++) {
      let z = -span * 0.5 + ((i / rings) * span + off + span) % span
      p.set(0, 0, z)
      const grow = 1 + 0.06 * Math.sin(t * 2.2 + phases[i] * TAU)
      sc.set(grow, grow, 1)
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), t * 0.12 * dir + phases[i] * 0.4)
      m.compose(p, q, sc)
      ringMesh.setMatrixAt(i, m)
    }
    ringMesh.instanceMatrix.needsUpdate = true
    ringMat.opacity = 0.9 * alpha

    // 年份：沿 z 流动 + 始终正对相机。
    // 跨度刻意只占隧道长度的 42% 并把起点前移到 -span*0.14（而不是从 -span*0.5 起）：
    // 远端那个封底圆盖在 z=-span*0.52，若年份铺到那么远就会被封面**切掉一半**
    // （实机实测：数字被画面顶边裁掉、年号与 AD 后缀也被拆开）。
    const z0 = -span * 0.14
    const zSpan = span * 0.42
    for (let i = 0; i < numeralSlots.length; i++) {
      const slot = numeralSlots[i]
      const z = z0 - ((((i / numeralSlots.length) * zSpan + off + zSpan) % zSpan))
      const x = Math.sin(i * 2.1 + t * 0.3) * radius * 0.28
      const y = Math.cos(i * 1.7 + t * 0.25) * radius * 0.2
      slot.mesh.position.set(x, y, z)
      if (camera) slot.mesh.quaternion.copy(camera.quaternion)
      const wantNeg = neg
      const tex = wantNeg ? slot.texBC : slot.texAD
      if (slot.mat.map !== tex) {
        slot.mat.map = tex
        slot.mat.needsUpdate = true
      }
      // 近处淡出，避免糊在镜头上
      const zn = clamp(1 - Math.abs(z - z0) / zSpan)
      slot.mat.opacity = alpha * clamp(1.25 - Math.abs(z) / (span * 0.35)) * (0.4 + 0.6 * zn)
    }

    // 内壁纹理滚动（用 offset 表达"高速掠过"，不移动几何）
    boreTex.offset.y = ((t * v * dir) / span) % 1
    boreMat.opacity = 0.85 * alpha
    capMat.opacity = 0.95 * alpha
    return { dir, negative: neg, off }
  }

  /**
   * 「隧道必须占满整个画面」的可验证判据：从相机出发，向画面四角与四边中点打射线，
   * 每一条都必须打在内壁（bore）上。这是**几何**判据，不受后处理暗角影响。
   * @param {THREE.Camera} camera
   * @returns {{ok:boolean, hits:number, total:number, miss:number[][]}}
   */
  function coversFrame(camera) {
    const rc = new THREE.Raycaster()
    rc.layers.enableAll()
    const ndc = [
      [-1, -1], [1, -1], [-1, 1], [1, 1],
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7],
    ]
    let hits = 0
    const miss = []
    for (const [x, y] of ndc) {
      rc.setFromCamera(new THREE.Vector2(x, y), camera)
      const its = rc.intersectObject(bore, false)
      if (its.length) hits++
      else miss.push([x, y])
    }
    return { ok: hits === ndc.length, hits, total: ndc.length, miss }
  }

  return {
    object: grp,
    bore,
    coversFrame,
    rings: ringMesh,
    numerals: numeralSlots,
    radius,
    span,
    flowSign,
    isNegative,
    update,
    /** 供自检：内壁半径是否覆盖给定相机下的画面四角 */
    coverage: (camPosZ, fovDeg, aspect = 16 / 9, nearZ = 2.6) => coverageReport(radius, camPosZ, fovDeg, aspect, nearZ),
  }
}

/**
 * 覆盖性检查：距相机 nearZ 的横截面上，画面的半高/半宽/对角 —— 内壁半径必须大于对角。
 * 这是"隧道必须占满整个画面"的可验证判据。
 */
export function coverageReport(radius, camPosZ = 3.4, fovDeg = 40, aspect = 16 / 9, nearZ = 2.6) {
  const d = Math.max(0.05, camPosZ - (camPosZ - nearZ)) // = nearZ，保持显式
  const halfH = d * Math.tan(((fovDeg * Math.PI) / 180) / 2)
  const halfW = halfH * aspect
  const diag = Math.hypot(halfW, halfH)
  return {
    radius,
    distance: d,
    halfH,
    halfW,
    diag,
    ok: radius > diag,
    margin: radius - diag,
  }
}
