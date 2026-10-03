// src/ui/panels.js — 面板动画库（用户 F2a 反馈第 3 条）
//
// 八个效果：enter / exit / shake / glitch / grayscale / smash / tunnel / collapse
//
// 设计要点：
//   · **进度驱动**，不是 CSS keyframes —— 每个效果都是 `(u, opts) → {transform, filter, opacity, vars}`
//     的纯函数，u 由 t 推导。这样暂停、拖动、乱序跳转后动画位置一致（SPEC §2.2）。
//   · 效果之间可叠加：返回的对象由调用方合并（例如 smash 入场 + grayscale 叠加）。
//   · 全部输出 CSS 字符串，DOM 只写一次样式，避免每帧重排多个节点。

import { clamp, span, outBack, outCubic, inCubic, smoothstep, outElastic } from '../core/ease.js'

const R = (v) => `${v.toFixed(2)}`

/** 入场：从接近相机的一侧带过冲弹入（弹簧，过冲 6–8%），并带一点 rotateY */
export function enter(u, { dx = 0, dy = 0 } = {}) {
  const e = outBack(clamp(u))
  const s = 0.9 + 0.1 * e
  const o = clamp(span(u, 0, 0.45))
  return {
    transform: `translate3d(${R(dx * (1 - e))}px, ${R(dy * (1 - e))}px, ${R((1 - e) * -260)}px) rotateY(${R(14 * (1 - e))}deg) scale(${R(s)})`,
    opacity: R(o),
  }
}

/** 退场：溶解（缩小 + 模糊 + 淡出 + 向后退） */
export function exit(u, { dx = 0, dy = 0 } = {}) {
  const e = outCubic(clamp(u))
  return {
    transform: `translate3d(${R(dx * e)}px, ${R(dy * e - 18 * e)}px, ${R(e * 320)}px) scale(${R(1 - 0.1 * e)})`,
    opacity: R(1 - e),
    filter: `blur(${R(e * 9)}px)`,
  }
}

/** 震屏：衰减正弦位移 */
export function shake(u, { amp = 10 } = {}) {
  const a = amp * (1 - clamp(u))
  const ph = u * 34
  return { transform: `translate3d(${R(Math.sin(ph) * a)}px, ${R(Math.sin(ph * 1.37) * a * 0.6)}px, 0)` }
}

/** 故障：切片 + 通道色散（主要是 CSS 变量，供 clip-path 与 text-shadow 用） */
export function glitch(u, { amp = 1 } = {}) {
  const a = amp * (1 - clamp(u))
  const gi = Math.floor(u * 24)
  return {
    vars: {
      '--dsh-glitch': R(a),
      '--dsh-disp': R(a * 1.6),
    },
    transform: `translate3d(${R(((gi % 3) - 1) * a * 6)}px, 0, 0)`,
  }
}

/** 整窗去色（段 H 第⑤次「整扇窗口变灰」用） */
export function grayscale(u, { max = 1 } = {}) {
  const a = clamp(u) * max
  return { filter: `grayscale(${R(a)}) brightness(${R(1 - 0.45 * a)})` }
}

/** 弹窗朝相机砸来：从远处放大冲到眼前并轻微过冲（+ rotateX 一点俯角） */
export function smash(u, { from = 520 } = {}) {
  const e = outBack(clamp(u))
  const z = from * (1 - e)
  return {
    transform: `translate3d(0, 0, ${R(z)}px) rotateX(${R(-12 * (1 - e))}deg) scale(${R(0.72 + 0.28 * e)})`,
    opacity: R(clamp(span(u, 0, 0.35))),
  }
}

/** 嵌套隧道：沿 z 轴一层层冲来（depth 越大越远） */
export function tunnel(u, { depth = 0 } = {}) {
  const e = outCubic(clamp(u))
  const z = -900 * depth + e * (900 * depth + 140)
  const s = 1 / (1 + Math.max(0, -z) / 1400)
  return {
    transform: `translate3d(0, 0, ${R(z)}px) scale(${R(s)})`,
    opacity: R(clamp(span(u, 0, 0.3)) * (1 - 0.15 * depth)),
  }
}

/** 收缩成一点（测量坍缩 / 交接收束用） */
export function collapse(u) {
  const e = inCubic(clamp(u))
  return {
    transform: `scale(${R(1 - 0.985 * e)})`,
    opacity: R(1 - smoothstep(clamp((u - 0.55) / 0.45))),
    filter: `blur(${R(e * 12)}px)`,
  }
}

export const EFFECTS = { enter, exit, shake, glitch, grayscale, smash, tunnel, collapse }

/**
 * 把若干效果按进度合成一份样式（后应用的覆盖前面的 transform/opacity/filter 之外的部分）。
 * list: [{ name, u, opts }]
 */
export function compose(list) {
  const out = { transform: '', opacity: null, filter: null, vars: {} }
  const parts = []
  for (const it of list) {
    if (!it) continue
    const fn = EFFECTS[it.name]
    if (!fn) continue
    const r = fn(it.u, it.opts || {})
    if (r.transform) parts.push(r.transform)
    if (r.opacity != null) out.opacity = r.opacity
    if (r.filter) out.filter = out.filter ? `${out.filter} ${r.filter}` : r.filter
    if (r.vars) Object.assign(out.vars, r.vars)
  }
  out.transform = parts.length ? parts.join(' ') : 'translate3d(0,0,0)'
  return out
}

/**
 * 时间窗包络：给 [t0,t1] 与 enter/exit 时长，返回当前该用哪个效果与进度。
 * 纯函数；窗口之外返回 null。
 */
export function windowFx(t, w, { enterDur = 0.4, exitDur = 0.5 } = {}) {
  if (t < w.t0 - enterDur || t > w.t1 + exitDur) return null
  if (t < w.t0 + enterDur) return { name: 'enter', u: clamp((t - w.t0 + enterDur * 0.35) / enterDur) }
  if (t > w.t1) return { name: 'exit', u: clamp((t - w.t1) / exitDur) }
  return { name: 'enter', u: 1 }
}

/** 轻微漂浮：永远在动的面包板（§0.6 不允许静止镜头/静止面板） */
export function float(t, { amp = 6, speed = 0.35 } = {}) {
  return `translate3d(${R(Math.sin(t * speed) * amp * 0.5)}px, ${R(Math.cos(t * speed * 0.83) * amp)}px, 0)`
}
