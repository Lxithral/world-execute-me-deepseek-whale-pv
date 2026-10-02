// src/ui/typing.js — 逐字 / 流式文本。全部是 t 的纯函数。

import { hash01 } from '../core/rng.js'
import { clamp, span } from '../core/ease.js'

/**
 * 打字机：从 start 时刻起按 cps 字符/秒显示。
 * jitterAmt 给每个字符一点确定性速度抖动，避免机械均匀。
 */
export function typed(text, t, { start = 0, cps = 24, jitter = 0.35, seed = 7 } = {}) {
  if (t <= start) return ''
  let acc = 0
  let n = 0
  for (let i = 0; i < text.length; i++) {
    const rate = cps * (1 + (hash01(i, seed) * 2 - 1) * jitter)
    acc += 1 / Math.max(1e-6, rate)
    if (t - start >= acc) n = i + 1
    else break
  }
  return text.slice(0, n)
}

/** 是否正在打字（用于光标/状态行） */
export function isTyping(text, t, opts = {}) {
  return typed(text, t, opts).length < text.length
}

/** 按 token 列表流式输出（token 时间来自 words[] 或等间隔） */
export function streamByTokens(tokens, t, { start = 0, cps = 22, gap = 0.05, seed = 3 } = {}) {
  const out = []
  let cur = start
  for (let i = 0; i < tokens.length; i++) {
    const dur = Math.max(0.02, tokens[i].length / cps) + gap * hash01(i, seed)
    if (t >= cur + dur) out.push(tokens[i])
    else if (t >= cur) {
      const part = Math.floor(((t - cur) / dur) * tokens[i].length)
      out.push(tokens[i].slice(0, Math.max(0, part)))
      break
    } else break
    cur += dur
  }
  return out.join('')
}

/** 光标闪烁：t 时刻是否可见（约 1.1Hz 方波上升沿由相位决定） */
export function cursorOn(t, { hz = 1.15, phase = 0, duty = 0.55 } = {}) {
  const x = ((t * hz + phase) % 1 + 1) % 1
  return x < duty
}

/** 光标透明度（含淡出/淡入的柔和边缘） */
export function cursorAlpha(t, opts = {}) {
  const x = ((t * (opts.hz ?? 1.15) + (opts.phase ?? 0)) % 1 + 1) % 1
  const e = 0.03
  return 1 - span(x, (opts.duty ?? 0.55) - e, (opts.duty ?? 0.55) + e)
}

/** 逐行滚动的日志：给定行与每行开始时间，返回当前应显示到最后一行 */
export function logLines(lines, t, { start = 0, perLine = 0.16 } = {}) {
  const n = clamp(Math.floor((t - start) / perLine) + 1, 0, lines.length)
  return lines.slice(0, n)
}

/**
 * 键入波形震动强度（段 H：取本曲真实频谱作为震动）
 * spectrum: Float32Array(64)；返回 0..1
 */
export function shakeFromSpectrum(spectrum) {
  let s = 0
  for (let i = 0; i < spectrum.length; i++) s += spectrum[i]
  return s / spectrum.length
}
