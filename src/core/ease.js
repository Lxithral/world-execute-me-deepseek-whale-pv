// src/core/ease.js — 缓动与插值工具。全部纯函数。
// 运动一律缓动（SPEC §5）；禁止线性生硬运动，故 linear 只作内部比较用。

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a))
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v)))
export const mix = lerp

/** 把 t 映射到 [a,b] 区间内的 0→1，区间外截断 */
export const span = (t, a, b) => clamp(invLerp(a, b, t))
/** 在 [a,b] 内 0→1→0 的三角窗 */
export const window01 = (t, a, b) => {
  if (b <= a) return 0
  const u = invLerp(a, b, t)
  return u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) ** 2
}
/** [a,b] 内 1，其余 0；fade 为边缘淡入淡出秒数 */
export const gate = (t, a, b, fade = 0) => {
  if (fade <= 0) return t >= a && t <= b ? 1 : 0
  return Math.min(span(t, a, a + fade), 1 - span(t, b - fade, b))
}

export const linear = (x) => x
export const inQuad = (x) => x * x
export const outQuad = (x) => 1 - (1 - x) * (1 - x)
export const inOutQuad = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
export const inCubic = (x) => x ** 3
export const outCubic = (x) => 1 - (1 - x) ** 3
export const inOutCubic = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
export const inQuart = (x) => x ** 4
export const outQuart = (x) => 1 - (1 - x) ** 4
export const outQuint = (x) => 1 - (1 - x) ** 5
export const inExpo = (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10))
export const outExpo = (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x))
export const inOutExpo = (x) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2
export const outBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2
export const inOutBack = (x) =>
  x < 0.5
    ? (2 * x) ** 2 * (7.189819 * 2 * x - 2.5949095) / 2
    : ((2 * x - 2) ** 2 * (7.189819 * (2 * x - 2) + 2.5949095) + 2) / 2
export const outElastic = (x) => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const c4 = (2 * Math.PI) / 3
  return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}
export const outBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}
export const smoothstep = (x) => {
  x = clamp(x)
  return x * x * (3 - 2 * x)
}
export const smootherstep = (x) => {
  x = clamp(x)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/** 帧率无关的指数趋近：给定 dt 与时间常数 tau，返回 0→1 的进度 */
export const approach = (dt, tau) => (tau <= 0 ? 1 : 1 - Math.exp(-dt / tau))
/** 指数衰减包络：在 [0, dur] 内 1→0；p 控制曲线 */
export const decay = (elapsed, dur, p = 1) => (elapsed <= 0 ? 1 : elapsed >= dur ? 0 : (1 - elapsed / dur) ** p)

export const TAU = Math.PI * 2
export const DEG = Math.PI / 180
export const norm360 = (d) => ((d % 360) + 360) % 360

/**
 * 关键帧插值：keys = [[t0,v0],[t1,v1],...]（t 必须递增）。
 * fn 为段间缓动，默认 smoothstep。t 在两端外取端点值。
 */
export function keyframes(t, keys, fn = smoothstep) {
  const n = keys.length
  if (n === 0) return 0
  if (t <= keys[0][0]) return keys[0][1]
  if (t >= keys[n - 1][0]) return keys[n - 1][1]
  let i = 0
  while (i < n - 2 && t > keys[i + 1][0]) i++
  const [ta, va] = keys[i]
  const [tb, vb] = keys[i + 1]
  const u = tb > ta ? (t - ta) / (tb - ta) : 1
  return va + (vb - va) * fn(u)
}

