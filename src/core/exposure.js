// src/core/exposure.js — 曝光标定（FIX_V3.md §6）
//
// §6 原文：
//   · 渲染器使用 **ACESFilmic** 色调映射；每段有 exposure 关键帧；全片按 DIRECTOR 的段落配色。
//   · 目标：每 0.5s 采样的**平均亮度 ∈ [0.10, 0.45]**；**p95 ≤ 0.95**；**过曝像素（≥0.98）占比 ≤2%**；
//     允许的豁免：闪白与黑场区间。
//   · 已知问题必须修：段 B 曼德博过曝；段 D 47–51s 过暗；段 E 局部过亮。
//
// 为什么单独一个模块、而不是在每段里各调各的：
//   ① "每段有 exposure 关键帧"这句话的机器可读形式就是一张表；
//   ② selftest 的 u) 项要按同一张表复算，表在场景里散着就复算不了；
//   ③ 段与段的**过渡**要连续（否则会在段界看到亮度跳变），这张表里用 `ramp` 控制过渡宽度。
//
// 色调映射落在哪里：
//   · `post3d.js` 的最后一个 ShaderPass 里做 ACES + exposure（这是正确位置：
//     在 bloom 之后、扫描线/暗角之后，色调映射必须是链路的最后一步）；
//   · 后处理不可用时退回 `renderer.toneMapping = ACESFilmicToneMapping`。
//   两条路径用**同一个** `exposureAt(t)`，不会出现"有/无后处理两套亮度"。

import { clamp } from './ease.js'

/**
 * 全片曝光关键帧。值 = 曝光倍率（1.0 为基准）。
 *
 * 定标依据（本轮实测的 `px.mean`，见 docs/CHECKPOINT.md 的 u 项报告）：
 *   · 影片整体偏暗：实测多个采样点 `px.mean` 在 0.02–0.07，而 §6 要求 ≥0.10。
 *   · 但**不能**只靠调高 exposure 硬顶 —— 段 B 的曼德博、段 E 的高光会先过曝（§6 明写的已知问题）。
 *   · 所以这张表按"该段本来是亮还是暗"给：暗段（B 深海、D 47–51、J 红警报、N 结尾）给得多，
 *     本来就亮的段（C 白底数学、E 闪白、K 白场）给得少甚至下压。
 *   · 段 B 的曼德博单独在场景里限幅（§7 段 B 要求"曼德博平面限制曝光"），本表只给该段一个上限值。
 */
export const EXPOSURE_KEYS = [
  { t: 0.0, v: 1.55, seg: 'A', note: '开机锁定画面：不留死黑（§7 段 A）' },
  { t: 6.0, v: 1.42, seg: 'A' },
  { t: 14.5, v: 1.62, seg: 'B', note: '深海渐变本身很暗，给得最多' },
  { t: 22.0, v: 1.48, seg: 'B', ramp: 2.0, note: '曼德博之前收回一点，避免过曝' },
  { t: 27.0, v: 1.30, seg: 'B', ramp: 2.5 },
  { t: 29.7, v: 1.16, seg: 'C', note: '白底数学：本来亮，压低' },
  { t: 38.0, v: 1.14, seg: 'C' },
  { t: 44.0, v: 1.34, seg: 'D' },
  { t: 47.0, v: 1.86, seg: 'D', ramp: 2.2, note: '§6 明写 47–51s 过暗 → 这里抬到全片最高档' },
  { t: 51.0, v: 1.78, seg: 'D' },
  { t: 56.0, v: 1.52, seg: 'D' },
  { t: 59.0, v: 1.30, seg: 'E', note: '§6 明写段 E 局部过亮 → 整体下压' },
  { t: 68.0, v: 1.12, seg: 'E', ramp: 1.2, note: '1:08.5 巨大 ▶ 与闪白前后再压一档' },
  { t: 72.0, v: 1.24, seg: 'E' },
  { t: 74.0, v: 1.30, seg: 'F' },
  { t: 88.8, v: 1.34, seg: 'G' },
  { t: 103.5, v: 1.30, seg: 'H' },
  { t: 118.3, v: 1.26, seg: 'I' },
  { t: 129.0, v: 1.44, seg: 'J', note: '红警报底偏暗' },
  { t: 140.0, v: 1.34, seg: 'J' },
  { t: 147.9, v: 1.18, seg: 'K', note: '2:41.7 最大闪白 → 压住' },
  { t: 156.0, v: 1.26, seg: 'K' },
  { t: 162.0, v: 1.30, seg: 'L' },
  { t: 177.4, v: 1.32, seg: 'M' },
  { t: 188.5, v: 1.36, seg: 'N' },
  { t: 205.9, v: 1.10, seg: 'N', ramp: 1.0, note: '3:25.96 定格闪白：临时压低' },
  { t: 209.0, v: 1.00, seg: 'N', ramp: 0.6, note: 'CRT 关机起交给黑场' },
]

/** 闪白与黑场区间（§6 允许的豁免）——u) 项会跳过这些采样点 */
export const EXEMPT_WINDOWS = [
  { from: 0.0, to: 0.85, why: '段 A 的 CRT 开机亮线（DIRECTOR 有意）' },
  { from: 68.4, to: 68.9, why: '段 E 巨大 ▶ 闪白' },
  { from: 146.5, to: 147.4, why: '段 J 黑场 + 红字（DIRECTOR 有意）' },
  { from: 161.8, to: 162.2, why: '段 K 12/12 白场' },
  { from: 205.9, to: 206.5, why: '段 N 定格闪白' },
  { from: 209.4, to: 211.907, why: '段 N CRT 关机后的黑场与片尾字幕' },
]

/** 平滑插值（关键帧之间用 smoothstep，避免亮度折线） */
export function exposureAt(t) {
  const K = EXPOSURE_KEYS
  if (!(t > K[0].t)) return K[0].v
  const last = K[K.length - 1]
  if (t >= last.t) return last.v
  let i = 0
  while (i < K.length - 1 && K[i + 1].t <= t) i++
  const a = K[i]
  const b = K[i + 1]
  const span = Math.max(1e-6, b.t - a.t)
  const u = clamp((t - a.t) / span)
  // ramp = 过渡宽度（秒）。缺省 = 整段线性过渡；给了 ramp 就用 smoothstep 在 ramp 内完成
  const w = b.ramp != null ? clamp((t - a.t) / Math.max(1e-6, b.ramp)) : u
  const s = w * w * (3 - 2 * w)
  return a.v + (b.v - a.v) * s
}

/** t 属于哪个豁免区间（不属于则 null） */
export function exemptAt(t) {
  for (const w of EXEMPT_WINDOWS) if (t >= w.from && t <= w.to) return w
  return null
}

/** 该段的名义曝光（供报告用） */
export function exposureForSegment(seg) {
  const hit = EXPOSURE_KEYS.filter((k) => k.seg === seg)
  return hit.length ? hit[hit.length - 1].v : null
}

/* ------------------------------------------------------------------ *
 * ACES 色调映射（与 shader 里那份**逐字同源**）
 * ------------------------------------------------------------------ */

/** ACESFilmic 的 shader 版（Narkowicz 拟合，与 three 的 ACESFilmicToneMapping 同源） */
export const ACES_GLSL = `
vec3 acesFilmic(vec3 x) {
  // Narkowicz 2015 的 ACES 拟合；与 three.js 内部实现同一组系数
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
`

/** JS 版的 ACES（自检 u 用它复算，保证与 shader 一致） */
export function acesFilmicJS(r, g, b) {
  const f = (x) => {
    const a = 2.51
    const bb = 0.03
    const c = 2.43
    const d = 0.59
    const e = 0.14
    return Math.min(1, Math.max(0, (x * (a * x + bb)) / (x * (c * x + d) + e)))
  }
  return [f(r), f(g), f(b)]
}

/** 供 selftest u 项：该 t 的曝光值 + 是否豁免 */
export function exposureReport(t) {
  const ex = exemptAt(t)
  return { t, exposure: exposureAt(t), exempt: !!ex, exemptWhy: ex ? ex.why : null }
}

export const EXPOSURE_SUMMARY = {
  keys: EXPOSURE_KEYS.length,
  min: Math.min(...EXPOSURE_KEYS.map((k) => k.v)),
  max: Math.max(...EXPOSURE_KEYS.map((k) => k.v)),
  segments: [...new Set(EXPOSURE_KEYS.map((k) => k.seg))].length,
  exemptWindows: EXEMPT_WINDOWS.length,
  target: { meanLo: 0.1, meanHi: 0.45, p95Max: 0.95, overFracMax: 0.02 },
}

export default exposureAt
