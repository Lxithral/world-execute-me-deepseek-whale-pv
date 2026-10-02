// src/lyrics/render.js — 歌词层（SPEC §6，最后绘制、保持清晰）。
// 同一时刻只显示一句；中英都上屏；英文逐词卡拉 OK；中文随句淡入淡出。
// 本层不参与色散/位移，只允许极轻的重拍缩放（≤1.5%）。

import { C } from '../core/palette.js'
import { clamp, span } from '../core/ease.js'
import { layoutSentence, zhFontStr, RATIO } from './layout.js'

const FADE_IN = 0.12
const FADE_OUT = 0.25
const XFADE = 0.08

export function createLyrics(sentences, { W, H }) {
  const cache = new Map()
  const get = (i) => {
    if (!cache.has(i)) cache.set(i, layoutSentence(measureCtx(), sentences[i], W, H))
    return cache.get(i)
  }
  return { sentences, get, W, H, clear: () => cache.clear() }
}

let _measure = null
function measureCtx() {
  if (!_measure) {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    _measure = c.getContext('2d')
  }
  return _measure
}

/** 句子在 t 时刻的不透明度与原因（hold 之后完全隐藏） */
export function sentenceAlpha(s, nextT0, t) {
  if (t < s.t0) return 0
  const a = span(t, s.t0, s.t0 + FADE_IN)
  const end = s.hold
  const gap = nextT0 - end
  const dur = gap < 0.25 ? 0 : FADE_OUT
  const b = dur <= 0 ? (t <= end ? 1 : 0) : 1 - span(t, end, end + dur)
  return clamp(a * b)
}

/** 当前「正在唱」的词下标（-1 表示还没开始） */
export function activeWordIndex(words, t, hold) {
  let idx = -1
  for (let i = 0; i < words.length; i++) {
    if (t >= words[i].t) idx = i
    else break
  }
  if (idx >= 0 && t > hold) return -1
  return idx
}

/**
 * drawLyrics(g, t, L, opts)
 * L: createLyrics 的返回值；opts: {alpha, pulse}
 */
export function drawLyrics(g, t, L, opts = {}) {
  const { alpha = 1, pulse = 0 } = opts
  const { sentences, W, H } = L
  if (!sentences.length) return { active: -1 }

  // 找到最后一句已开始的
  let idx = -1
  for (let i = 0; i < sentences.length; i++) {
    if (t >= sentences[i].t0) idx = i
    else break
  }
  if (idx < 0) return { active: -1 }

  // 可能同时可见的是 idx 与 idx-1（80ms 交叉淡化）
  const vis = []
  for (const i of [idx - 1, idx]) {
    if (i < 0 || i >= sentences.length) continue
    const s = sentences[i]
    const nextT0 = i + 1 < sentences.length ? sentences[i + 1].t0 : Infinity
    let a = sentenceAlpha(s, nextT0, t)
    if (a <= 0.001) continue
    vis.push({ i, s, a })
  }
  if (!vis.length) return { active: -1 }

  const beatScale = 1 + 0.015 * clamp(pulse)

  // 底部渐变随可见度淡入淡出（空档时完全隐藏，舞台可用满屏）
  const gAlpha = Math.max(...vis.map((v) => v.a))
  drawBottomGradient(g, W, H, gAlpha)

  for (const { i, s, a } of vis) {
    const lay = L.get(i)
    drawOne(g, t, s, lay, a * alpha, beatScale)
  }
  return { active: idx }
}

function drawBottomGradient(g, W, H, a) {
  if (a <= 0.001) return
  const h = H * 0.26
  const grad = g.createLinearGradient(0, H - h, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.55, `rgba(0,0,0,${0.38 * a})`)
  grad.addColorStop(1, `rgba(0,0,0,${0.62 * a})`)
  g.save()
  g.fillStyle = grad
  g.fillRect(0, H - h, W, h)
  g.restore()
}

function drawOne(g, t, s, lay, alpha, beatScale) {
  const aw = activeWordIndex(s.words, t, s.hold)
  g.save()
  g.globalAlpha = alpha
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.lineJoin = 'round'

  // 极轻的重拍缩放（≤1.5%），围绕歌词块中心
  g.translate(0, lay.centerY)
  g.scale(beatScale, beatScale)
  g.translate(0, -lay.centerY)

  // 英文逐词卡拉 OK
  let k = 0
  for (const line of lay.enLines) {
    for (const wd of line.words) {
      const isActive = k === aw
      const sung = k < aw
      const px = wd.x
      const py = line.baseline
      g.save()
      if (isActive) {
        g.translate(px + wd.width / 2, py)
        g.scale(RATIO.active, RATIO.active)
        g.translate(-(px + wd.width / 2), -py)
      }
      g.font = wd.font
      // 2px 深色描边 + 柔和阴影
      g.shadowColor = 'rgba(0,0,0,0.75)'
      g.shadowBlur = 10
      g.lineWidth = 4
      g.strokeStyle = 'rgba(6,8,12,0.9)'
      g.strokeText(wd.w, px, py)
      g.shadowBlur = 0
      g.fillStyle = isActive ? '#ffffff' : sung ? C.cyan : 'rgba(232,234,238,0.55)'
      g.fillText(wd.w, px, py)
      g.restore()
      k++
    }
  }

  // 中文整体淡入淡出（x 已在排版时算好）
  if (lay.zhLines.length) {
    g.font = zhFontStr(lay.zhFont, 500)
    g.textAlign = 'left'
    for (const zl of lay.zhLines) {
      g.shadowColor = 'rgba(0,0,0,0.7)'
      g.shadowBlur = 8
      g.lineWidth = 3
      g.strokeStyle = 'rgba(6,8,12,0.85)'
      g.strokeText(zl.text, zl.x, zl.baseline)
      g.shadowBlur = 0
      g.fillStyle = '#b8bcc4'
      g.fillText(zl.text, zl.x, zl.baseline)
    }
  }
  g.restore()
}
