// src/core/rig.js — 全片唯一的相机轨道（FIX.md §2.1）
//
// FIX.md §2.1 的要求：
//   · 全片只有一个 Three 场景与一个相机；段落不再是"独立画布"，而是"一组演员在该段的进出窗口"；
//   · 相机关键帧轨道（位置、注视点、fov、roll），Catmull-Rom 样条 + 阻尼跟随 + 叠加的抖动层；
//   · 每段只追加关键帧；只有标注 cut:true 的边界允许硬切，且全片不超过 3 处硬切
//     （2:27.9、1:04 附近的冲击点、结尾）；
//   · 相机永远在微动（阻尼漂移），不允许静止镜头超过 1 秒（§0.6）。
//
// 本模块只做"相机的纯函数 f(t)"：给定时间返回相机参数。所有关键帧是常量表，
// 阻尼/抖动都由 t 解析计算，因此暂停、拖动、乱序跳转后画面一致。

import { clamp, span, smoothstep, lerp, TAU } from '../core/ease.js'
import { noise1, noise2 } from '../core/rng.js'

/**
 * 关键帧：{ t, pos:[x,y,z], look:[x,y,z], fov, roll, cut? }
 * pos 单位 = 半屏高（与鲸鱼层的世界单位一致），z 向观众为正。
 * cut:true 表示"到达这一帧时硬切"（不做样条插值）。全片只允许 3 处。
 */
export const CAMERA_KEYS = [
  // A 载入：从极近的正对，缓慢后拉到中景
  { t: 0.0, pos: [0, 0.05, 2.6], look: [0, 0, 0], fov: 34, roll: 0 },
  { t: 8.0, pos: [0.05, 0.02, 3.2], look: [0, 0.02, 0], fov: 36, roll: 0 },
  { t: 14.5, pos: [0, 0, 3.6], look: [0, 0, 0], fov: 40, roll: 0 },
  // B 序曲飞行：沿隧道向前推
  { t: 20.0, pos: [0.1, 0.06, 1.6], look: [0, 0, -2], fov: 52, roll: 0.02 },
  { t: 28.5, pos: [-0.12, -0.04, 0.6], look: [0, 0, -4], fov: 62, roll: -0.03 },
  // C 点→圆→正弦：拉远成近正交（长焦），环绕露厚度
  { t: 29.7, pos: [0, 0, 6.0], look: [0, 0, 0], fov: 18, roll: 0 },
  { t: 33.4, pos: [0.9, 0.25, 5.6], look: [0, 0, 0], fov: 20, roll: 0.03 },
  { t: 40.8, pos: [-0.6, 0.1, 5.8], look: [0, 0, 0], fov: 19, roll: -0.02 },
  // D 切换与坠入：下潜 + roll
  { t: 44.0, pos: [0, 0.1, 4.4], look: [0, 0, 0], fov: 30, roll: 0 },
  { t: 49.8, pos: [0.2, 0.3, 3.4], look: [0.1, -0.1, 0], fov: 38, roll: 0.12 },
  { t: 55.2, pos: [0, -0.5, 3.0], look: [0, -0.3, 0], fov: 44, roll: -0.08 },
  { t: 59.0, pos: [0, -0.8, 2.6], look: [0, -0.4, 0], fov: 48, roll: 0 },
  // E 交易：绕超立方体环拍
  { t: 66.6, pos: [1.4, 0.5, 3.0], look: [0, 0.1, 0], fov: 42, roll: 0.04 },
  { t: 74.0, pos: [0.4, -0.1, 3.4], look: [0, 0, 0], fov: 40, roll: 0 },
  // F 万能的我：正面偏右，看展示柜
  { t: 80.0, pos: [0.3, 0.15, 3.6], look: [0.1, 0.05, 0], fov: 38, roll: 0 },
  { t: 88.8, pos: [0, 0.1, 3.4], look: [0, 0, 0], fov: 38, roll: 0 },
  // G 切换：缓推
  { t: 96.0, pos: [-0.2, 0.2, 3.0], look: [0, 0.1, 0], fov: 40, roll: -0.05 },
  { t: 103.5, pos: [0, 0.3, 2.6], look: [0, 0.1, 0], fov: 44, roll: 0.06 },
  // H 补全与缺席：逐渐后拉（每次失败再拉一段）
  { t: 106.0, pos: [0, 0.1, 3.2], look: [0, 0, 0], fov: 40, roll: 0 },
  { t: 112.0, pos: [0, 0.05, 4.0], look: [0, 0, 0], fov: 38, roll: 0 },
  { t: 118.3, pos: [0, 0, 5.0], look: [0, 0, 0], fov: 34, roll: 0 },
  // I 清理：推向石碑
  { t: 125.7, pos: [0, 0.1, 2.4], look: [0, 0.1, 0], fov: 44, roll: 0 },
  // J 溢出：向内挤压
  { t: 129.0, pos: [0, 0, 3.4], look: [0, 0, 0], fov: 40, roll: 0 },
  { t: 140.0, pos: [0, 0.1, 2.2], look: [0, 0.1, 0], fov: 50, roll: 0.05 },
  { t: 147.9, pos: [0, 0, 2.0], look: [0, 0, 0], fov: 52, roll: 0 },
  // K 执行风暴：进黑洞段，之后快速甩动
  { t: 148.2, pos: [0.6, 0.2, 3.2], look: [0, 0, 0], fov: 56, roll: -0.06 },
  { t: 156.0, pos: [-0.8, -0.3, 2.8], look: [0, 0, 0], fov: 60, roll: 0.1 },
  { t: 162.0, pos: [0.2, 0.1, 3.4], look: [0, 0, 0], fov: 48, roll: 0 },
  // L 训练与星系：拉远看星系
  { t: 168.0, pos: [0, 0.2, 4.6], look: [0, 0.1, 0], fov: 36, roll: 0 },
  { t: 177.4, pos: [0.2, 0.05, 3.6], look: [0.1, 0, 0], fov: 40, roll: 0 },
  // M 爱的代数：推向心脏
  { t: 184.0, pos: [0.5, 0.1, 2.6], look: [0.3, 0.05, 0], fov: 44, roll: 0 },
  { t: 188.5, pos: [0.3, 0.05, 2.8], look: [0.2, 0, 0], fov: 42, roll: 0 },
  // N 被困与交接：缓慢拉远 + 结尾硬切（第 3 处）
  { t: 199.0, pos: [0.2, 0.05, 3.4], look: [0.1, 0, 0], fov: 40, roll: 0 },
  { t: 206.0, pos: [0, 0, 2.8], look: [0, 0, 0], fov: 38, roll: 0 },
  { t: 209.0, pos: [0, 0, 2.6], look: [0, 0, 0], fov: 36, roll: 0 },
]

// 三处硬切（FIX §2.1）：每处 = 一个 hold 键（50ms 静止，避免"静止镜头 >1s"）+ 一个 cut 键（跳变）。
// hold 键的值就是切点前一刻的值，cut 键给出全新的机位 —— 这样才是"硬切"而不是"快速摇镜"。
export const CUT_PAIRS = [
  // 1:04 副歌一的冲击点
  { hold: { t: 63.95, pos: [0, -0.85, 2.78], look: [0, -0.42, 0], fov: 47, roll: 0, hold: true },
    cut: { t: 64.0, pos: [1.5, 0.55, 3.05], look: [0, 0.1, 0], fov: 44, roll: 0.05, cut: true } },
  // 2:27.9 溢出→执行风暴
  { hold: { t: 147.85, pos: [0, 0, 2.02], look: [0, 0, 0], fov: 52, roll: 0, hold: true },
    cut: { t: 147.9, pos: [0.7, 0.25, 3.3], look: [0, 0, 0], fov: 56, roll: -0.06, cut: true } },
  // 结尾 CRT 关机
  { hold: { t: 208.95, pos: [0, 0, 2.62], look: [0, 0, 0], fov: 36, roll: 0, hold: true },
    cut: { t: 209.0, pos: [0, 0, 2.6], look: [0, 0, 0], fov: 36, roll: 0, cut: true } },
]

for (const pr of CUT_PAIRS) {
  CAMERA_KEYS.push(pr.hold, pr.cut)
}
CAMERA_KEYS.sort((a, b) => a.t - b.t)

/** 硬切点（≤3 处，FIX §2.1） */
export const CUT_TIMES = CAMERA_KEYS.filter((k) => k.cut).map((k) => k.t)

const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = V.len(a) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
  },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  lerp: (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)],
}

/** Catmull-Rom：p1→p2 之间插值（p0/p3 为控制点） */
function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u
  const u3 = u2 * u
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3)
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]
}

function keyIndexAt(t) {
  let i = 0
  for (let k = 0; k < CAMERA_KEYS.length; k++) if (CAMERA_KEYS[k].t <= t) i = k
  return i
}

/**
 * 相机状态 = f(t)。返回 { pos, look, fov, roll, isCut }
 * 阻尼漂移 + 抖动层：全部由 t 解析计算（noise1/noise2 是确定性值噪声）。
 */
export function cameraAt(t, { jitter = 1, drift = 1 } = {}) {
  const keys = CAMERA_KEYS
  const i = keyIndexAt(t)
  const k0 = keys[Math.max(0, i - 1)]
  const k1 = keys[i]
  const k2 = keys[Math.min(keys.length - 1, i + 1)]
  const k3 = keys[Math.min(keys.length - 1, i + 2)]

  // hold 键：从它到下一个键之间**不插值**（用于硬切前的短暂静止）
  // cut 键：由 hold 键把机位冻在旧值，越过 cut 键的那一刻跳到新值 → 真正的硬切
  let pos, look, fov, roll, isCut = false
  const span0 = Math.max(1e-6, k2.t - k1.t)
  const u = clamp((t - k1.t) / span0)
  if (k1.hold) {
    pos = k1.pos.slice()
    look = k1.look.slice()
    fov = k1.fov
    roll = k1.roll
  } else {
    pos = catmull(k0.pos, k1.pos, k2.pos, k3.pos, smoothstep(u))
    look = catmull(k0.look, k1.look, k2.look, k3.look, smoothstep(u))
    fov = lerp(k1.fov, k2.fov, smoothstep(u))
    roll = lerp(k1.roll, k2.roll, smoothstep(u))
  }
  if (k2.cut && Math.abs(t - k2.t) < 1 / 60) isCut = true

  // 阻尼漂移：低频慢摆，保证"镜头永远在微动"（振幅很小，不破坏构图）
  const d = drift * 0.012
  pos = V.add(pos, [noise1(t * 0.13, 11) - 0.5, noise1(t * 0.11, 12) - 0.5, 0].map((v) => v * 2 * d))
  look = V.add(look, [(noise1(t * 0.09, 21) - 0.5) * d, (noise1(t * 0.1, 22) - 0.5) * d, 0])

  // 抖动层：高频微抖（同样确定性）
  const j = jitter * 0.0022
  pos = V.add(pos, [(noise2(t * 7.3, 1.7, 31) - 0.5) * j, (noise2(t * 6.9, 3.1, 32) - 0.5) * j, 0])
  roll += (noise1(t * 0.31, 41) - 0.5) * 0.006 * jitter

  return { pos, look, fov: fov + (noise1(t * 0.23, 51) - 0.5) * 0.25 * jitter, roll, isCut }
}

/**
 * impact(strength, kind) —— FIX §2.4 的冲击联动。
 * 返回该时刻的相机附加量（纯函数）：沿视线反向 punch + fov 脉冲（−3° 起，150ms 衰减）。
 * impulses 由 main.js 收集（场景/起音点触发），本函数只负责求值。
 */
export function impactOffset(t, impulses, { decay = 0.15, punch = 0.09, fovPulse = 3 } = {}) {
  let p = 0
  let f = 0
  for (const im of impulses) {
    const e = t - im.t
    if (e < 0 || e > decay * 3) continue
    const a = im.strength * Math.exp(-e / decay)
    p = Math.max(p, a)
    f = Math.max(f, a * fovPulse)
  }
  return { punch: p * punch, fovAdd: -f }
}

/** 把相机状态写进 three 的相机（含 roll） */
export function applyCamera(cam, st) {
  cam.position.set(st.pos[0], st.pos[1], st.pos[2])
  cam.up.set(Math.sin(st.roll), Math.cos(st.roll), 0)
  cam.lookAt(st.look[0], st.look[1], st.look[2])
  cam.fov = st.fov
  cam.updateProjectionMatrix()
  cam.updateMatrixWorld()
}

/** 自检 l)：硬切数量与位置 */
export const RIG_SUMMARY = { cuts: CUT_TIMES, keys: CAMERA_KEYS.length }
