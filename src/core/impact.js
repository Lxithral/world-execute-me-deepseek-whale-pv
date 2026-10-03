// src/core/impact.js — 冲击等级与冲量（FIX.md §2.4）
//
// FIX §2.4：
//   · impact(strength, kind) 一次触发联动：相机冲击（沿视线反向 punch）、fov 脉冲（−3°→衰减 150ms）、
//     bloom +0.6、色散 +2px、冲击波环、粒子迸发、#dsh-layer 的 CSS 故障；
//   · 触发源：analysis.json 的 onsets，按 strength 分档；各段强度等级：
//     A L0 | B L2(渐强) | C L1 | D L1→L2 | E L3 | F L1 | G L2 | H L1→L0 | I L2 | J L3→L4 | K L4+(全片最强) | L L3 | M L1 | N L1→L0
//
// 本模块只做"从 onsets + 段落等级 → 冲量表"的纯函数换算；求值在 rig.impactOffset / post3d 里。

import { clamp } from './ease.js'

/** 各段的冲击强度等级（0..5） */
export const LEVEL = {
  A: [0, 0], // 段内线性取值（起→止）
  B: [1.2, 2.2],
  C: [1, 1],
  D: [1, 2],
  E: [3, 3],
  F: [1, 1],
  G: [2, 2],
  H: [1, 0.2],
  I: [2, 2],
  J: [3, 4],
  K: [4.6, 5], // 全片最强
  L: [3, 3],
  M: [1, 1],
  N: [1, 0.2],
}

/** 段内按比例插值出该时刻的等级 */
export function levelAt(segId, lt) {
  const L = LEVEL[segId]
  if (!L) return 0
  return L[0] + (L[1] - L[0]) * clamp(lt)
}

/**
 * 由 onsets 生成冲量表（纯函数）。
 * @param onsets [{t,strength}]（来自 analysis.json）
 * @param segs   [{id,start,end}]
 * @param opts   {minGap=0.12, threshold=0.35}
 * @returns [{t, strength:0..1, level, kind}]，按 t 升序
 */
export function buildImpulses(onsets, segs, { minGap = 0.12, threshold = 0.32, force = [] } = {}) {
  const out = []
  let lastT = -Infinity
  for (const o of onsets) {
    if (o.strength < threshold) continue
    if (o.t - lastT < minGap) continue
    const seg = segs.find((s) => o.t >= s.start && o.t < s.end)
    if (!seg) continue
    const lt = (o.t - seg.start) / Math.max(1e-6, seg.end - seg.start)
    const level = levelAt(seg.id, lt)
    if (level <= 0.05) continue
    lastT = o.t
    out.push({
      t: o.t,
      strength: clamp(o.strength * (0.35 + level / 5)),
      level,
      kind: level >= 3.5 ? 'heavy' : level >= 2 ? 'mid' : 'light',
      seg: seg.id,
    })
  }
  // 场景额外声明的强制冲击（如回车的闪白、最后一击）
  for (const f of force) {
    const seg = segs.find((s) => f.t >= s.start && f.t < s.end)
    const lt = seg ? (f.t - seg.start) / Math.max(1e-6, seg.end - seg.start) : 0
    out.push({ t: f.t, strength: clamp(f.strength ?? 1), level: levelAt(seg ? seg.id : '', lt), kind: f.kind || 'forced', seg: seg ? seg.id : '?' })
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

/** 冲击波环：给定 t 与冲量表，返回当前活跃的环（最多 3 个），用于 3D 环或 2D 圆 */
export function shockwaves(t, impulses, { life = 0.55 } = {}) {
  const rings = []
  for (const im of impulses) {
    const e = t - im.t
    if (e < 0 || e > life) continue
    rings.push({ u: e / life, strength: im.strength, level: im.level, t0: im.t })
    if (rings.length >= 3) break
  }
  return rings
}

/** 该时刻的冲击强度（用于 bloom/色散/震屏的统一输入），0..1 */
export function pulseAt(t, impulses, { decay = 0.15 } = {}) {
  let p = 0
  for (const im of impulses) {
    const e = t - im.t
    if (e < 0 || e > decay * 3) continue
    p = Math.max(p, im.strength * Math.exp(-e / decay))
  }
  return clamp(p)
}
