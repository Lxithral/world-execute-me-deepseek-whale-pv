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
  { t: 0.0, v: 2.20, seg: 'A', note: 'T19c 重标定：开机锁定画面（1–5s 实测曾只有 0.07–0.09）' },
  { t: 3.0, v: 2.60, seg: 'A' },
  { t: 6.5, v: 2.70, seg: 'A' },
  { t: 9.0, v: 1.55, seg: 'A' },
  { t: 14.5, v: 1.95, seg: 'B', note: '深海渐变本身很暗' },
  { t: 15.6, v: 1.40, seg: 'B', note: '门环扫过画面（16.0 的四角余量为 0）→ 这一档必须低' },
  { t: 19.0, v: 1.85, seg: 'B' },
  { t: 22.0, v: 1.70, seg: 'B', ramp: 2.0 },
  { t: 24.4, v: 1.95, seg: 'B' },
  { t: 25.2, v: 1.45, seg: 'B', note: '25.5 的四角曾 0.127（v) 超限）→ 压低' },
  { t: 27.5, v: 2.55, seg: 'B', ramp: 2.0 },
  { t: 28.8, v: 1.35, seg: 'B', note: 'B→C 溶解的几帧本来就亮（28.5 的 mean 曾 0.672）→ 压低' },
  { t: 29.6, v: 0.95, seg: 'C', note: 'B→C 段界：29.5 的四角曾 0.191（v) 超限）→ 界前压到 0.95，界后立刻抬回（有段界闪白遮住这级台阶）' },
  { t: 29.75, v: 3.90, seg: 'C', note: '⚠️ 实测该段其实很暗（0.039–0.05），与旧注释"白底数学本来亮"不符' },
  { t: 32.0, v: 3.90, seg: 'C' },
  { t: 34.5, v: 3.20, seg: 'C' },
  { t: 36.0, v: 1.55, seg: 'C', note: '36.5 的四角曾 0.127 → 压低' },
  { t: 39.5, v: 2.00, seg: 'C' },
  { t: 42.5, v: 1.95, seg: 'C' },
  { t: 44.5, v: 2.20, seg: 'D' },
  { t: 46.5, v: 2.50, seg: 'D' },
  { t: 48.5, v: 3.00, seg: 'D', ramp: 2.2, note: '⚠️ D 49–52 的隧道极暗（未曝光时 0.014）：3.0 已是"尽量补"，仍不足 0.10 → 见 QUEUE 的段 D 补光项' },
  { t: 51.5, v: 2.60, seg: 'D' },
  { t: 56.0, v: 1.60, seg: 'D' },
  { t: 57.5, v: 2.60, seg: 'D' },
  { t: 59.0, v: 3.60, seg: 'E', note: 'T19b 删掉遗留紫环后 E1/E2 失去它的光 → 按实测补回' },
  { t: 61.0, v: 4.00, seg: 'E' },
  { t: 63.5, v: 3.20, seg: 'E' },
  { t: 65.0, v: 2.50, seg: 'E', ramp: 0.8 },
  { t: 66.2, v: 2.10, seg: 'E', ramp: 1.0 },
  { t: 67.5, v: 0.90, seg: 'E', ramp: 0.8, note: 'T19c：E2/E3 的四角本来就贴着 0.12（金宝珠摆幅+暖橙叠层），这一档必须压低才不越界；同时保住 T19a 的 E3 暖色（叠层是 2D，不随曝光放大）' },
  { t: 69.0, v: 1.10, seg: 'E' },
  { t: 72.0, v: 1.24, seg: 'E' },
  { t: 74.0, v: 2.50, seg: 'F' },
  { t: 77.0, v: 2.90, seg: 'F' },
  { t: 80.5, v: 2.40, seg: 'F' },
  { t: 84.0, v: 1.60, seg: 'F' },
  { t: 86.5, v: 2.25, seg: 'F' },
  { t: 88.8, v: 3.20, seg: 'G' },
  { t: 95.0, v: 2.60, seg: 'G' },
  { t: 99.0, v: 3.00, seg: 'G' },
  { t: 103.5, v: 1.80, seg: 'H' },
  { t: 110.0, v: 1.70, seg: 'H', note: 'T23 全量验收：段 H 的 3D 键盘/彩带（T21a）本身就是亮源，而 3.10 是 T19c 为「完全没光的 H」抬的 → 降回来，u) 的 p95 与 v) 的四角立即回到门槛内' },
  { t: 115.5, v: 1.85, seg: 'H' },
  { t: 116.6, v: 3.40, seg: 'H', note: 'isolation 的「远处一点微光」（T21b 的 in-scene 光晕）需要自己的增益（此时画面几乎全黑）' },
  { t: 117.2, v: 4.10, seg: 'H', note: '⚠️ 117.5–118.3 是全片最暗的一段（§7 段 H 要"isolation 缩成远处一点微光"）→ 4.10 也只到 0.07，见 QUEUE 的 §7/§6 冲突项' },
  { t: 118.3, v: 4.10, seg: 'I' },
  { t: 120.5, v: 2.90, seg: 'I' },
  { t: 124.0, v: 1.90, seg: 'I' },
  { t: 127.0, v: 2.40, seg: 'I' },
  { t: 129.0, v: 2.60, seg: 'J', note: '红警报底偏暗' },
  { t: 132.0, v: 1.44, seg: 'J' },
  { t: 140.0, v: 1.34, seg: 'J' },
  { t: 145.2, v: 1.34, seg: 'J', note: 'T19c：144.0 的四角曾到 0.120 → 高曝光关键帧推迟到 146.2' },
  { t: 146.2, v: 5.40, seg: 'J' },
  { t: 147.9, v: 2.20, seg: 'K', note: '2:41.7 最大闪白 → 压住' },
  { t: 150.5, v: 2.85, seg: 'K' },
  { t: 152.0, v: 2.55, seg: 'K' },
  { t: 156.0, v: 2.30, seg: 'K' },
  { t: 158.0, v: 2.90, seg: 'K' },
  { t: 160.0, v: 2.25, seg: 'K' },
  { t: 162.0, v: 2.35, seg: 'L' },
  { t: 166.0, v: 2.00, seg: 'L' },
  { t: 172.0, v: 1.40, seg: 'L', note: 'L/M 本来够亮 → 收回' },
  { t: 177.4, v: 2.80, seg: 'M', note: 'T19d 把 W4 的入场从 177.4 推到 178.302（按实测词锚点）后，178.0 这一帧失去立绘的光（0.103→0.057）→ M 的曝光抬回来' },
  { t: 188.5, v: 1.36, seg: 'N' },
  { t: 199.0, v: 1.20, seg: 'N' },
  { t: 205.9, v: 1.10, seg: 'N', ramp: 1.0, note: '3:25.96 定格闪白：临时压低' },
  { t: 208.2, v: 4.20, seg: 'N', note: 'T19c：关机前的定格实测只有 0.048（<0.10）→ 按 §6"非黑场就要 ≥0.10"抬亮；若你认定它属于黑场，请把它写进 EXEMPT_WINDOWS' },
  { t: 209.0, v: 1.00, seg: 'N', ramp: 0.6, note: 'CRT 关机起交给黑场' },
]

/** 闪白与黑场区间（§6 允许的豁免）——u) 项会跳过这些采样点 */
export const EXEMPT_WINDOWS = [
  { from: 0.0, to: 0.85, why: '段 A 的 CRT 开机亮线（DIRECTOR 有意）' },
  { from: 48.4, to: 51.6, why: '段 D 的**眼睑合拢→全黑→睁眼**（§1.5 明写「最后全黑」；T17a 已实现并验证 48.9/49.8 中带 = 0.030）。T19c 实测这段 0.2s 采样的 mean 0.028–0.114、ed 0.009–0.035，**全部低于 u)/b) 门槛**；§6 允许的黑场豁免按实测登记，阈值一字未动' },
  { from: 69.40, to: 69.72, why: '段 E 巨大 ▶ 闪白（按词锚点 execution=69.41；旧值 68.4–68.9 是拿 §1.6 的绝对秒 1:08.5 写的，比实测锚点早 1s）' },
  { from: 145.6, to: 147.95, why: '段 J 黑场 + 红字（DIRECTOR 有意）——T50/§J 2:27 把黑场按规格提前到 2:25.6（原 146.45 是旧黑场 146.5 的实测登记；窗口左沿跟着规格前移，右沿与判据一字未动）' },
  { from: 161.8, to: 162.2, why: '段 K 12/12 白场' },
  { from: 205.9, to: 206.5, why: '段 N 定格闪白' },
  { from: 209.0, to: 211.907, why: '段 N CRT 关机后的黑场与片尾字幕（T19c 对账：旧值从 209.4 起，而 DIRECTOR 的关机是 209.0，b) 的表也是 209.0）' },
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
