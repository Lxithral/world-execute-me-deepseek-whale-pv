// src/whale/cast.js — 鲸鱼娘出场表（FIX.md §5.1 的硬约束）
//
// FIX.md §5.1 原话要点：
//   · 出场表总计约 27s，**其余时间立绘图层 alpha 必须为 0**；
//   · 每次出场 ≤8s；
//   · 入场弹簧弹入（过冲），退场溶解成点云或被冲击波推出，"不得淡入后一直站着"；
//   · 出场时用的素材由本表指定（W1 cheerful / W2 starry / W3 confused / W4 shy / W5 serious）；
//   · 切换用硬切 + 一帧色散 + 一次小冲击，不做交叉淡化。
//
// 本模块是**权威**：main.js 的 applyWhale() 只认这里的窗口，窗口之外一律不绘制立绘，
// 场景里对 ctx.whale.sprite 的请求在窗口外会被忽略（逐段的立绘代码将在 P2 逐段重做时删除）。

import { clamp, span, outBack, outCubic, smoothstep, TAU } from '../core/ease.js'
import { SOURCE, canHardCut } from './exprs.js'

/**
 * 五个出场窗口。`cxFrac` 是画面横向位置（0..1，指立绘中心），`scale` 相对默认站位高度。
 * 时间取自 FIX.md §5.1（W4 原写 2:57.4–3:06 = 8.6s，超出"每次 ≤8s"，此处收敛到 8.0s，
 * 决策记录见 docs/PROGRESS.md 的决策日志）。
 */
export const APPEARANCES = [
  { id: 'W1', t0: 66.6, t1: 71.0, role: 'cheerful', cxFrac: 0.74, enter: 0.34, exit: 0.5, note: 'happy 起唱处弹入' },
  { id: 'W2', t0: 81.4, t1: 85.0, role: 'starry', cxFrac: 0.70, enter: 0.34, exit: 0.5, note: 'cat 一词处，与猫同框' },
  { id: 'W3', t0: 114.0, t1: 118.3, role: 'confused', cxFrac: 0.63, scale: 0.42, desat: 0.7, dim: 0.55, enter: 0.6, exit: 0.7, note: '孤立：远处小身影' },
  { id: 'W4', t0: 177.4, t1: 185.4, role: 'shy', cxFrac: 0.72, enter: 0.34, exit: 0.5, note: 'love 相关词处，点云从她身上抽出' },
  { id: 'W5', t0: 193.0, t1: 199.0, role: 'serious', cxFrac: 0.875, scale: 0.34, desat: 0.8, dim: 0.6, enter: 0.5, exit: 0.6, note: '新会话里的她：角落、去色压暗' },
]

/** 全片立绘总时长（秒），供自检 o) 用 */
export function totalAppearanceSeconds() {
  return APPEARANCES.reduce((s, w) => s + (w.t1 - w.t0), 0)
}

/**
 * t 时刻的出场状态；不在任何窗口则返回 null（→ 立绘层 alpha 必须为 0）。
 * 返回 { window, role, alpha, scale, cxFrac, desat, dim, phase, lt, justSwitched }
 */
export function castAt(t) {
  for (const w of APPEARANCES) {
    if (t < w.t0 - w.enter || t > w.t1 + w.exit) continue
    const scale0 = w.scale ?? 1
    const desat0 = w.desat ?? 0
    const dim0 = w.dim ?? 1

    // 入场：弹簧过冲（scale 0.86 → 1，过冲 6–8%）
    if (t < w.t0 + w.enter) {
      const u = span(t, w.t0, w.t0 + w.enter)
      return {
        window: w, role: w.role, phase: 'in', lt: 0,
        alpha: clamp(span(t, w.t0 - w.enter * 0.15, w.t0 + w.enter * 0.35)),
        scale: scale0 * (0.86 + 0.14 * outBack(u)),
        cxFrac: w.cxFrac, desat: desat0, dim: dim0,
        justSwitched: false,
      }
    }
    // 退场
    if (t > w.t1) {
      const u = span(t, w.t1, w.t1 + w.exit)
      return {
        window: w, role: w.role, phase: 'out', lt: 1,
        alpha: 1 - outCubic(u),
        scale: scale0 * (1 - 0.1 * u), // 略微收缩，表示"被推出/溶解"
        cxFrac: w.cxFrac + 0.03 * u,
        desat: clamp(desat0 + u * 0.5), dim: dim0 * (1 - 0.6 * u),
        justSwitched: false,
      }
    }
    return {
      window: w, role: w.role, phase: 'hold', lt: span(t, w.t0, w.t1),
      alpha: 1, scale: scale0, cxFrac: w.cxFrac, desat: desat0, dim: dim0,
      justSwitched: false,
    }
  }
  return null
}

/**
 * 场景可选的"出场内的硬切换"：给一串 [[t0, role], ...]（t0 必须落在某个窗口内），
 * 返回 t 时刻该用哪个角色、以及是否处在切换后的头两帧（那时场景应打一帧色散 + 小冲击）。
 * 跨组切换会被拒绝并回退到窗口默认角色（见 exprs.js 的 POSE_GROUPS）。
 */
export function castRoleAt(t, cues) {
  const c = castAt(t)
  if (!c) return { role: null, switched: false, rejected: null }
  let role = c.role
  let switched = false
  let rejected = null
  if (cues && cues.length) {
    for (let i = 0; i < cues.length; i++) {
      if (t < cues[i][0] || cues[i][0] < c.window.t0) continue
      const want = cues[i][1]
      if (!SOURCE[want]) continue
      if (canHardCut(role, want)) {
        role = want
        switched = t - cues[i][0] < 0.034
      } else {
        rejected = { at: cues[i][0], from: role, to: want, reason: '跨姿势组，需先让立绘离场（见 docs/DSH_POSES.md）' }
      }
    }
  }
  return { role, switched, rejected }
}

/** 窗口总数与单次最长时长（供自检 o) 断言） */
export const CAST_SUMMARY = {
  count: APPEARANCES.length,
  total: totalAppearanceSeconds(),
  maxSingle: Math.max(...APPEARANCES.map((w) => w.t1 - w.t0)),
}
