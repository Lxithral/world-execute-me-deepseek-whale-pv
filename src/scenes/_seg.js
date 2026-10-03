// src/scenes/_seg.js — 逐段重做的共用契约（FIX.md §3 / §5.0）
//
// 每个段落一个文件，且都遵守同一套约定。这些约定原本散落在各段的注释里，
// 重做时最容易"每段各写一套"，所以抽成一个薄模块：
//
//   1) **演员窗口**：段落边界由 index.js 的 start/end 决定，演员的进出可以超出边界各 ≤1.2s
//      （§5.0）。`win()` 给出"本段演员是否在场"以及一个 0→1 的进出包络。
//   2) **词锚点驱动**：所有事件时刻一律走 `ctx.cues.sec(seg, key, fallback)`，
//      不再写绝对秒数（§2.2）。`cueOf()` 把这一步与"动作提前量 lead"合并。
//   3) **时间线一次性算清**：`timeline()` 把该段所有锚点解析成一个对象，
//      避免在 render 里反复查表（也避免每帧的字符串拼接）。
//   4) **段内主体必须可见**：`ctx.three` 的对象在每帧开头会被 compositor 统一隐藏，
//      所以每个场景必须在 render 里把自建对象显式打开（§F2a 的既有约定）。
//
// 这个模块**不画任何东西**，只做时间与可见性的约定。

import { clamp, span, outBack, inOutCubic } from '../core/ease.js'

/** 演员窗口：允许超出段界各 extend 秒（FIX §5.0 的 ≤1.2s） */
export const ACTOR_EXTEND = 1.2

/**
 * 本段演员的在场包络。
 * @param {number} t
 * @param {number} start 段起点
 * @param {number} end 段终点
 * @param {{in?:number, out?:number, extend?:number}} [o]
 *        in/out: 淡入淡出时长；extend: 允许超出段界的秒数
 * @returns {{a:number, active:boolean}} a=0..1 的包络
 */
export function win(t, start, end, o = {}) {
  const { in: din = 0.5, out = 0.5, extend = ACTOR_EXTEND } = o
  const a = clamp(span(t, start - extend, start - extend + din)) * (1 - clamp(span(t, end + extend - out, end + extend)))
  return { a, active: t >= start - extend && t <= end + extend }
}

/**
 * 锚点解析（带动作提前量）。
 * FIX §2.2：视觉"到位"时间 = 词起唱时间；动作启动 = 提前 0.25–0.4s（预备）。
 * 所以 lead 只影响"动作开始"，不影响"到位"。这里同时返回两个时刻。
 * @param {object} cues ctx.cues
 * @param {string} seg
 * @param {string} key
 * @param {number} fallback
 * @param {number} [lead=0.3]
 */
export function cueOf(cues, seg, key, fallback, lead = 0.3) {
  const t = cues && typeof cues.sec === 'function' ? cues.sec(seg, key, fallback) : fallback
  const hit = Number.isFinite(t) ? t : fallback
  return { t: hit, start: hit - lead, lead }
}

/**
 * 一次性把一个段落的全部锚点解析成对象。
 * @param {object} cues
 * @param {string} seg
 * @param {Record<string, [number, number?]>} spec key → [fallback, lead?]
 * @returns {Record<string, {t:number, start:number, lead:number}>}
 */
export function timeline(cues, seg, spec) {
  const out = {}
  for (const [key, v] of Object.entries(spec)) {
    const [fallback, lead] = v
    out[key] = cueOf(cues, seg, key, fallback, lead == null ? 0.3 : lead)
  }
  return out
}

/**
 * 进出场弹入（带过冲）+ 淡出。§0.6 禁止线性运动、入场必须有预备与过冲。
 * @param {number} u 0..1
 */
export function popIn(u) {
  return Math.max(0, outBack(clamp(u)))
}

/** 缓动别名，供各段统一（避免每段各自 import 一堆） */
export const ease = { span, clamp, outBack, inOutCubic, popIn }
