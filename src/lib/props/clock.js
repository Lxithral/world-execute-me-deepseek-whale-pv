// src/lib/props/clock.js — 3D 钟表（FIX.md §2.7）
//
// FIX 对"指针逻辑"的要求是逐字的：
//   · 3D 圆柱表盘 + 数字 + 时针分针；
//   · **所有指针角度由同一个时间变量 T(分钟) 推导**：
//       分针 = T/60*360°   时针 = T/720*360°
//   · AM→PM 即 T 从 7:00 转到 19:00（T=420 → 1140），背景天空渐变与太阳→月亮同步变化；
//   · 必须自检：**分针转 12 圈时针转 1 圈**。
//
// 旧实现（g_glitch.drawDayNightDial）的错在于：角度由淡入淡出包络推出
// （`spin = inOutCubic(a)*TAU*2.2`），签名里的 t 完全没用 —— 于是进 2.2 圈、出又倒转 2.2 圈，
// 净位移 0，钟表会倒着转回去。这里改成完全由 T 决定，且提供 assertClockRatio() 做机器断言。

import * as THREE from 'three'
import { clamp, TAU } from '../../core/ease.js'
import { applyEnv } from './env.js'
import { text } from '../../ui/text.js'

/** 一天中的分钟数 */
export const MINUTES_PER_DAY = 24 * 60
/** AM 7:00 → PM 19:00（FIX §2.7 指定） */
export const AM_MINUTE = 7 * 60
export const PM_MINUTE = 19 * 60

/** 分针角度（弧度）：T/60*360° */
export const minuteHandAngle = (T) => (T / 60) * TAU
/** 时针角度（弧度）：T/720*360° */
export const hourHandAngle = (T) => (T / 720) * TAU

/**
 * 把 t（歌曲秒）映射到 T（一天中的分钟）。
 * AM→PM 对应 T=420→1140，即 12 小时 = 720 分钟。
 * @param {number} t
 * @param {{t0?:number, t1?:number, from?:number, to?:number}} [o]
 */
export function minuteOfDay(t, o = {}) {
  const { t0 = 94.09, t1 = 95.786, from = AM_MINUTE, to = PM_MINUTE } = o
  const u = clamp((t - t0) / Math.max(1e-6, t1 - t0))
  return from + (to - from) * u
}

/** 表盘数字 1..12 的位置角度（12 在正上方） */
function numeralPositions(r) {
  const out = []
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * TAU
    out.push({ n: i, x: Math.sin(a) * r, y: Math.cos(a) * r, a })
  }
  return out
}

/** 程序生成天空渐变（正午暖色 → 黄昏橙紫 → 夜blue） */
function skyTexture() {
  const w = 8
  const h = 128
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0.0, '#8fd0ff') // 正午高空
  grad.addColorStop(0.42, '#ffd9a0') // 黄昏地平线
  grad.addColorStop(0.62, '#c86a4e')
  grad.addColorStop(0.8, '#3b2a56')
  grad.addColorStop(1.0, '#0a1024') // 夜
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 建立钟表。
 * @param {{renderer?:THREE.WebGLRenderer, radius?:number, numerals?:boolean, sky?:boolean}} [opts]
 */
export function createClock(opts = {}) {
  const { renderer = null, radius = 1.0, numerals = true, sky = true } = opts
  const grp = new THREE.Group()
  grp.name = 'prop:clock'

  // ---- 表盘：圆柱（薄） ----
  const caseMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d2430,
    roughness: 0.35,
    metalness: 0.65,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  })
  applyEnv(caseMat, renderer)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.16, 56, 1), caseMat)
  body.rotation.x = Math.PI / 2
  grp.add(body)

  // 表盘面（自发光底色，保证暗场里也读得清）
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xe9eef6,
    roughness: 0.5,
    clearcoat: 0.6,
    emissive: 0x2a3444,
    emissiveIntensity: 0.6,
  })
  applyEnv(faceMat, renderer)
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 56), faceMat)
  face.position.z = 0.085
  grp.add(face)

  // ---- 12 个数字：canvas 贴图铺到小平面（比逐个建模轻，且是"数字"） ----
  const numeralsGrp = new THREE.Group()
  numeralsGrp.name = 'numerals'
  const numeralMats = []
  if (numerals) {
    for (const { n, x, y } of numeralPositions(radius * 0.72)) {
      const cv = document.createElement('canvas')
      cv.width = 64
      cv.height = 64
      const g = cv.getContext('2d')
      g.clearRect(0, 0, 64, 64)
      // 字号走 text() 的字号守卫（label 档），失败会在 ?strictText=1 下抛错
      text(g, String(n), 32, 32, { role: 'label', size: 40, family: 'sans', weight: 600, color: '#1b2230', align: 'center', baseline: 'middle' })
      const tex = new THREE.CanvasTexture(cv)
      tex.colorSpace = THREE.SRGBColorSpace
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      numeralMats.push(m)
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), m)
      quad.position.set(x, y, 0.09)
      numeralsGrp.add(quad)
    }
  }
  grp.add(numeralsGrp)

  // ---- 刻度（60 格，每 5 格加粗） ----
  const tickGrp = new THREE.Group()
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU
    const major = i % 5 === 0
    const len = major ? 0.11 : 0.05
    const geo = new THREE.PlaneGeometry(major ? 0.022 : 0.011, len)
    const mat = new THREE.MeshBasicMaterial({ color: major ? 0x222a38 : 0x6b7688, transparent: true, opacity: major ? 0.95 : 0.6, depthWrite: false })
    const tick = new THREE.Mesh(geo, mat)
    const r = radius * 0.88
    tick.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.087)
    tick.rotation.z = -a
    tickGrp.add(tick)
  }
  grp.add(tickGrp)

  // ---- 指针：两枚，轴在中心，几何沿 +y 伸出（这样 rotation.z = -角度） ----
  const minuteMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f6fb, roughness: 0.4, metalness: 0.3, clearcoat: 0.8 })
  const hourMat = new THREE.MeshPhysicalMaterial({ color: 0xc9d6ea, roughness: 0.45, metalness: 0.35, clearcoat: 0.6 })
  applyEnv(minuteMat, renderer)
  applyEnv(hourMat, renderer)

  const mkHand = (len, width, mat) => {
    const g = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(width, len, 0.02), mat)
    shaft.position.y = len / 2 - len * 0.12
    g.add(shaft)
    const tail = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, len * 0.2, 0.02), mat)
    tail.position.y = -len * 0.1
    g.add(tail)
    return g
  }
  const minuteHand = mkHand(radius * 0.86, 0.032, minuteMat)
  const hourHand = mkHand(radius * 0.6, 0.048, hourMat)
  minuteHand.position.z = 0.1
  hourHand.position.z = 0.11
  minuteHand.name = 'minuteHand'
  hourHand.name = 'hourHand'
  grp.add(minuteHand)
  grp.add(hourHand)

  // 中心轴帽
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xffd479, roughness: 0.3, metalness: 0.8, clearcoat: 1 })
  )
  cap.rotation.x = Math.PI / 2
  cap.position.z = 0.13
  grp.add(cap)

  // ---- 背景天空（贴在钟表后方的大平面，随 T 同步由日转夜） ----
  let skyMesh = null
  if (sky) {
    const tex = skyTexture()
    skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 5.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false })
    )
    skyMesh.position.z = -2.4
    skyMesh.name = 'clockSky'
  }

  // ---- 太阳 / 月亮：沿一段弧从东到西 ----
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
  const sun = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), sunMat)
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0 })
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.24, 28), moonMat)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), glowMat)
  const bodies = new THREE.Group()
  bodies.name = 'sunMoon'
  bodies.add(glow, sun, moon)
  if (skyMesh) {
    bodies.position.z = -2.2
    grp.add(skyMesh)
    grp.add(bodies)
  }

  /**
   * 每帧更新。**唯一的驱动量是 T（分钟）**，t 只用于把它映射成 T。
   * @param {number} t
   * @param {{T?:number, alpha?:number, spin?:number, skyAlpha?:number}} [o]
   *   T 可直接给（自检/演示用），否则按 §2.7 由 t 映射 AM→PM
   */
  function update(t, o = {}) {
    const { alpha = 1, spin = 0, skyAlpha = 1 } = o
    const T = o.T != null ? o.T : minuteOfDay(t)
    const ma = minuteHandAngle(T)
    const ha = hourHandAngle(T)
    // 几何沿 +y 伸出，rotation.z 顺时针为正 → 取负号
    minuteHand.rotation.z = -ma
    hourHand.rotation.z = -ha
    caseMat.opacity = alpha
    caseMat.transparent = alpha < 0.999
    faceMat.opacity = alpha
    faceMat.transparent = alpha < 0.999
    minuteMat.opacity = alpha
    hourMat.opacity = alpha
    for (const m of numeralMats) m.opacity = alpha
    if (skyMesh) {
      skyMesh.material.opacity = 0.9 * skyAlpha * alpha
      // 日→夜：T=420（7:00）正午偏东，T=1140（19:00）落到西边
      const u = clamp((T - AM_MINUTE) / (PM_MINUTE - AM_MINUTE))
      // 弧线：东（-x）→ 天顶 → 西（+x）
      const ang = Math.PI * (1 - u)
      const R = 2.6
      sun.position.set(Math.cos(ang) * R, Math.sin(ang) * R * 0.62 + 0.2, 0.02)
      glow.position.copy(sun.position)
      glow.scale.setScalar(1 + 0.06 * Math.sin(t * 1.4))
      // 月亮走反向的同一段弧（日落月出）
      const mang = Math.PI * u
      moon.position.set(Math.cos(mang) * R, Math.sin(mang) * R * 0.62 + 0.2, 0.02)
      // 太阳落下时月亮升起
      sunMat.opacity = 1 - clamp((u - 0.72) / 0.28)
      sunMat.transparent = sunMat.opacity < 0.999
      glowMat.opacity = 0.25 * (1 - clamp((u - 0.7) / 0.3))
      moonMat.opacity = clamp((u - 0.68) / 0.32)
    }
    grp.rotation.y = spin
    return { T, minute: ma, hour: ha }
  }

  return {
    object: grp,
    skyMesh,
    bodies,
    face,
    body,
    minuteHand,
    hourHand,
    materials: { caseMat, faceMat, minuteMat, hourMat },
    update,
    /** 表盘数字的 canvas 贴图数量（供自检：必须有 12 个数字） */
    numeralCount: numeralMats.length,
  }
}

/**
 * 自动断言（FIX §2.7 明写"必须自检：分针转 12 圈时针转 1 圈"）。
 * 用解析式与"实际给到网格上的角度"两条路径交叉验证，避免只测公式不测实现。
 * @param {{clock?:object, from?:number, to?:number}} [o]
 * @returns {{ok:boolean, checks:Array<{name:string, ok:boolean, detail:string}>}}
 */
export function assertClockRatio(o = {}) {
  const { clock = null, from = AM_MINUTE, to = PM_MINUTE } = o
  const checks = []
  // 1) 解析式：T 走 720 分钟，时针正好 1 圈、分针正好 12 圈
  const dT = 720
  const dHour = hourHandAngle(from + dT) - hourHandAngle(from)
  const dMin = minuteHandAngle(from + dT) - minuteHandAngle(from)
  const turnsMin = dMin / TAU
  const turnsHour = dHour / TAU
  checks.push({
    name: '解析式 720 分钟 = 分针 12 圈 / 时针 1 圈',
    ok: Math.abs(turnsMin - 12) < 1e-9 && Math.abs(turnsHour - 1) < 1e-9,
    detail: `Δ分针=${turnsMin.toFixed(12)} 圈，Δ时针=${turnsHour.toFixed(12)} 圈`,
  })
  // 2) 比率：分针速度 / 时针速度 = 12
  const ratio = minuteHandAngle(1) / hourHandAngle(1)
  checks.push({
    name: '分针 : 时针 角速度比 = 12 : 1',
    ok: Math.abs(ratio - 12) < 1e-12,
    detail: `比值=${ratio.toFixed(12)}`,
  })
  // 3) 实测：若给了 clock 实例，直接读网格的 rotation.z（测的是"真的写到网格上了"）
  if (clock) {
    const before = { m: clock.minuteHand.rotation.z, h: clock.hourHand.rotation.z }
    clock.update(0, { T: from })
    const a = { m: clock.minuteHand.rotation.z, h: clock.hourHand.rotation.z }
    clock.update(0, { T: from + dT })
    const b = { m: clock.minuteHand.rotation.z, h: clock.hourHand.rotation.z }
    const rMin = Math.abs((b.m - a.m) / TAU)
    const rHour = Math.abs((b.h - a.h) / TAU)
    checks.push({
      name: '网格实测：分针 12 圈 / 时针 1 圈',
      ok: Math.abs(rMin - 12) < 1e-6 && Math.abs(rHour - 1) < 1e-6,
      detail: `网格 Δ分针=${rMin.toFixed(6)} 圈，Δ时针=${rHour.toFixed(6)} 圈`,
    })
    // 恢复
    clock.update(0, { T: from })
    clock.minuteHand.rotation.z = before.m
    clock.hourHand.rotation.z = before.h
  }
  // 4) 单调性：T 增大时分针不停转（旧实现的 bug 是"倒着转回去"）
  let mono = true
  let prev = minuteHandAngle(from)
  let acc = 0
  for (let i = 1; i <= 240; i++) {
    const cur = minuteHandAngle(from + (720 * i) / 240)
    const d = cur - prev
    if (d <= 0) mono = false
    acc += d
    prev = cur
  }
  checks.push({
    name: 'T 单调增 → 指针单调正转（不会倒转回去）',
    ok: mono && Math.abs(acc / TAU - 12) < 1e-9,
    detail: `累计 ${(acc / TAU).toFixed(9)} 圈，单调=${mono}`,
  })
  return { ok: checks.every((c) => c.ok), checks }
}
