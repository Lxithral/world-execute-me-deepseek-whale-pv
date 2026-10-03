// src/lyrics/render.js — 歌词层（SPEC §6 + FIX.md §2.5 / §5.5）
// 最后绘制、保持清晰、不参与色散；只允许极轻的重拍缩放（≤1.5%）。
//
// FIX §5.5：
//   · 英文在 t0−150ms 开始淡入，**t0 时刻 alpha ≥0.9**（并保留逐词卡拉 OK 高亮）；
//   · 中文**单独计算 alpha**，随句淡入淡出。
// 因此本文件不再用"整句一个 alpha"同时管中英。

import { C } from '../core/palette.js'
import { clamp, span } from '../core/ease.js'
import { layoutSentence, enFontStr, zhFontStr, CONFIG } from './layout.js'
import { beginFrameTextOptions, endFrameTextOptions } from '../ui/text.js'

export const FADE = {
  enIn: 0.15, // 英文：t0−150ms 起淡入
  enInDone: 0.02, // 到 t0−20ms 就满，保证 t0 时 alpha ≥0.9
  out: 0.25, // 淡出 250ms
  zhIn: 0.12, // 中文自己的淡入
  zhOut: 0.25,
  zhLead: 0.1, // 中文比英文稍晚起（错开一点点，读起来更清楚）
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

/** 布局缓存（按句 + 基线参数） */
export function createLyrics(sentences, { W, H, baselineFrac, spaceEm } = {}) {
  const cache = new Map()
  const key = (i) => `${i}|${baselineFrac ?? ''}|${spaceEm ?? ''}`
  const get = (i) => {
    const k = key(i)
    if (!cache.has(k)) cache.set(k, layoutSentence(measureCtx(), sentences[i], W, H, { baselineFrac, spaceEm }))
    return cache.get(k)
  }
  return { sentences, get, W, H, baselineFrac, spaceEm, clear: () => cache.clear() }
}

/** 英文 alpha：t0−150ms 起淡入，t0 时 ≥0.9；hold 后淡出 */
export function englishAlpha(s, nextT0, t) {
  if (t < s.t0 - FADE.enIn) return 0
  const a = span(t, s.t0 - FADE.enIn, s.t0 - FADE.enInDone)
  const gap = nextT0 - s.hold
  const dur = gap < 0.25 ? 0 : FADE.out
  const b = dur <= 0 ? (t <= s.hold ? 1 : 0) : 1 - span(t, s.hold, s.hold + dur)
  return clamp(a * b)
}

/** 中文 alpha：自己的包络，随句淡入淡出 */
export function chineseAlpha(s, nextT0, t) {
  if (!s.zh) return 0
  const a = span(t, s.t0 + FADE.zhLead, s.t0 + FADE.zhLead + FADE.zhIn)
  const gap = nextT0 - s.hold
  const dur = gap < 0.25 ? 0 : FADE.zhOut
  const b = dur <= 0 ? (t <= s.hold ? 1 : 0) : 1 - span(t, s.hold, s.hold + dur)
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

/** 画出某一帧的歌词层；返回 {active} 便于自检 */
export function drawLyrics(g, t, L, opts = {}) {
  const { alpha = 1, pulse = 0 } = opts
  const { sentences, W, H } = L
  if (!sentences.length) return { active: -1 }

  let idx = -1
  for (let i = 0; i < sentences.length; i++) {
    if (t >= sentences[i].t0 - FADE.enIn) idx = i
    else break
  }
  if (idx < 0) return { active: -1 }

  const vis = []
  for (const i of [idx - 1, idx]) {
    if (i < 0 || i >= sentences.length) continue
    const s = sentences[i]
    const nextT0 = i + 1 < sentences.length ? sentences[i + 1].t0 : Infinity
    const ae = englishAlpha(s, nextT0, t)
    const az = chineseAlpha(s, nextT0, t)
    if (ae <= 0.001 && az <= 0.001) continue
    vis.push({ i, s, ae, az })
  }
  if (!vis.length) return { active: -1 }

  const beatScale = 1 + 0.015 * clamp(pulse)
  drawBottomGradient(g, W, H, Math.max(...vis.map((v) => Math.max(v.ae, v.az))))

  for (const { i, s, ae, az } of vis) {
    // 正在淡出的那一句（不是当前句）标 crosstalk —— 它与当前句在同一 baseline 上交叉淡化
    drawOne(g, t, s, L.get(i), ae * alpha, az * alpha, beatScale, i !== idx)
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

function drawOne(g, t, s, lay, aEn, aZh, beatScale, crosstalk = false) {
  const aw = activeWordIndex(s.words, t, s.hold)
  // §2.8：相邻两句在边界处**交叉淡化**时，两条英文行落在同一 baseline 上，
  // 区间重叠是 DIRECTOR 设计的一部分 → 显式标 crosstalk 豁免重叠检测。
  // 只标"正在淡出的那一句"（`crosstalk=true` 由 drawLyrics 传进来），不整段豁免。
  const prevOpt = beginFrameTextOptions({ crosstalk })

  if (aEn > 0.001) {
    g.save()
    g.globalAlpha = aEn
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.lineJoin = 'round'
    g.translate(0, lay.centerY)
    g.scale(beatScale, beatScale)
    g.translate(0, -lay.centerY)

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
          g.scale(CONFIG.active, CONFIG.active)
          g.translate(-(px + wd.width / 2), -py)
        }
        g.font = enFontStr(lay.enFont)
        // 2px 深色描边 + 柔和阴影（可读性硬规则）
        g.shadowColor = 'rgba(0,0,0,0.75)'
        g.shadowBlur = 12
        g.lineWidth = 4
        g.strokeStyle = 'rgba(6,8,12,0.9)'
        g.strokeText(wd.text, px, py)
        g.shadowBlur = 0
        g.fillStyle = isActive ? '#ffffff' : sung ? C.cyan : 'rgba(255,255,255,0.55)'
        g.fillText(wd.text, px, py)
        g.restore()
        k++
      }
    }
    g.restore()
  }

  if (aZh > 0.001 && lay.zhLines.length) {
    g.save()
    g.globalAlpha = aZh
    g.font = zhFontStr(lay.zhFont, 500)
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
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
    g.restore()
  }
  endFrameTextOptions(prevOpt)
}
