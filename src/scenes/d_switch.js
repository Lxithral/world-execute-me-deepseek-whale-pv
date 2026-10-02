// src/scenes/d_switch.js — 段 D 0:44–0:59 切换与坠入
// DIRECTOR：0:44.5 示波器交流正弦；0:46.1 切直流平线（方波过渡）；0:47.9 蒙眼（暗角收成窄缝 +
// 黑条盖眼 + vision: off）；0:49.8 眩晕（舞台旋转 + 径向模糊 + 立绘扭曲）；0:51.4–0:55.2 时间尺
// 从 2026 回滚到公元前，年份滚动，0:55.2 两端刻度合拢为一点；0:57.2 深度计下潜转深蓝。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, keyframes, TAU, inOutCubic, outCubic, outElastic } from '../core/ease.js'
import { hash01, noise1 } from '../core/rng.js'
import { MONO, panel, roundRect } from '../ui/dsh.js'

export default {
  id: 'D',
  start: 44.0,
  end: 59.0,
  title: '切换与坠入',
  fx: [
    { t: 46.1, kind: 'glitch', amount: 0.45, dur: 0.14 },
    { t: 47.9, kind: 'flash', amount: 0.2, dur: 0.12 },
    { t: 49.8, kind: 'shake', amount: 0.8, dur: 1.4 },
    { t: 49.8, kind: 'disp', amount: 0.55, dur: 1.6 },
    { t: 51.4, kind: 'glitch', amount: 0.5, dur: 0.3 },
    { t: 55.2, kind: 'flash', amount: 0.6, dur: 0.2 },
    { t: 57.2, kind: 'flash', amount: 0.3, dur: 0.2 },
  ],

  init() {
    this.verts = []
    for (let i = 0; i < 14; i++) this.verts.push(i)
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    // ---- 背景：眩晕期整体旋转 ----
    const dizzy = span(t, 49.8, 51.4) * (1 - span(t, 53.6, 54.6))
    const deep = span(t, 57.0, 58.6)
    g.save()
    if (dizzy > 0.01) {
      g.translate(W / 2, H / 2)
      g.rotate(dizzy * 0.24 * Math.sin(t * 2.1) + dizzy * 0.1)
      g.scale(1 + 0.06 * dizzy, 1 + 0.06 * dizzy)
      g.translate(-W / 2, -H / 2)
    }
    const base0 = mixHex(C.bg0, C.sea1, deep)
    const base1 = mixHex(C.bg1, C.sea2, deep * 0.7)
    g.fillStyle = base0
    g.fillRect(-W, -H, W * 3, H * 3)
    g.fillStyle = base1
    for (let x = -W; x < W * 2; x += 8) g.fillRect(x, -H, 4, H * 3)
    // 深海下潜：浮力粒子向下拉出速度线
    if (deep > 0.01) {
      g.save()
      g.globalAlpha = deep * 0.6
      for (let i = 0; i < 70; i++) {
        const x = hash01(i, 31) * W
        const y = ((hash01(i, 32) + t * (0.15 + hash01(i, 33) * 0.4)) % 1.2) * H
        g.fillStyle = rgba('#7fd8ff', 0.25)
        g.fillRect(x, y, 1.6, 26 + hash01(i, 34) * 70)
      }
      g.restore()
    }

    // ---- 示波器面板 ----
    drawScope(g, ctx, t, sync)

    // ---- 时间尺 ----
    drawTimeline(g, ctx, t)
    g.restore()

    // ---- 眩晕径向模糊（用放射线近似，画在旋转之外，避免一起转） ----
    if (dizzy > 0.01) {
      g.save()
      g.globalAlpha = dizzy * 0.5
      for (let i = 0; i < 120; i++) {
        const a = hash01(i, 51) * TAU
        const r0 = H * (0.16 + hash01(i, 52) * 0.2)
        const x0 = W / 2 + Math.cos(a) * r0
        const y0 = H / 2 + Math.sin(a) * r0
        const x1 = W / 2 + Math.cos(a) * H * 1.1
        const y1 = H / 2 + Math.sin(a) * H * 1.1
        g.strokeStyle = rgba('#bfe9ff', 0.05 + hash01(i, 53) * 0.12)
        g.lineWidth = 1 + hash01(i, 54) * 3
        g.beginPath()
        g.moveTo(x0, y0)
        g.lineTo(x1, y1)
        g.stroke()
      }
      g.restore()
    }

    // ---- 蒙眼窄缝 ----
    const blind = span(t, 47.9, 48.6) * (1 - span(t, 54.4, 55.4))
    if (blind > 0.01) {
      const slit = 1 - blind * 0.82
      const bar = (H / 2) * (1 - slit)
      g.save()
      g.fillStyle = 'rgba(0,0,0,0.97)'
      g.fillRect(0, 0, W, bar)
      g.fillRect(0, H - bar, W, bar)
      g.fillStyle = 'rgba(232,234,238,0.5)'
      g.font = MONO(13, 600)
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText('vision: off', 24, H / 2 - bar + 20)
      g.restore()
    }

    // ---- 深度计 ----
    const dpt = span(t, 57.0, 58.8)
    if (dpt > 0.01) drawDepthGauge(g, ctx, dpt, t)

    // ---- 立绘 ----
    const spriteA = 1 - span(t, 55.3, 56.1)
    if (spriteA > 0.01) {
      const expr = t < 47.9 ? 'neutral' : t < 49.8 ? 'worried' : t < 54.6 ? 'dazed' : 'worried'
      const dist = dizzy
      ctx.whale.sprite = {
        expr: expr === 'dazed' ? 'dazed' : expr,
        rect: ctx.rect,
        alpha: spriteA,
        glitch: 0.35 * dist,
        desat: deep * 0.5,
        tint: deep > 0.2 ? '#3d6f9e' : null,
        tintAmt: deep * 0.5,
      }
    }
  },
}

/* ---------------- 示波器 ---------------- */
function drawScope(g, ctx, t, sync) {
  const { W, H, spec } = ctx
  const a = 1 - span(t, 46.9, 47.6)
  if (t > 47.6) return
  const x = W * 0.10
  const y = H * 0.14
  const w = W * 0.42
  const h = H * 0.30
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: 'scope · ch1' })
  // 网格
  g.strokeStyle = rgba(C.line, 0.5)
  g.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    g.beginPath()
    g.moveTo(x + (w * i) / 8, y + 28)
    g.lineTo(x + (w * i) / 8, y + h)
    g.stroke()
  }
  for (let i = 1; i < 5; i++) {
    g.beginPath()
    g.moveTo(x, y + 28 + ((h - 28) * i) / 5)
    g.lineTo(x + w, y + 28 + ((h - 28) * i) / 5)
    g.stroke()
  }
  // 波形：AC 正弦 → 方波过渡 → DC 平线
  sync.spectrumAt(t, spec)
  const cy = y + h / 2
  const dcMix = smoothstep(span(t, 45.6, 46.1))
  const sq = Math.sin(span(t, 45.5, 46.1) * Math.PI) // 过渡期的方波强度
  g.strokeStyle = C.green
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i <= 240; i++) {
    const u = i / 240
    const px = x + u * w
    const s = Math.sin(u * TAU * 3 + t * 1.2)
    const sine = s * (h * 0.3)
    const square = Math.sign(s) * (h * 0.3)
    const ac = sine * (1 - sq) + square * sq
    const dc = 0
    const yv = ac * (1 - dcMix) + dc * dcMix
    i === 0 ? g.moveTo(px, cy + yv) : g.lineTo(px, cy + yv)
  }
  g.stroke()
  g.fillStyle = C.fgDim
  g.font = MONO(12, 600)
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  const label = t < 45.6 ? 'AC · 50 Hz' : t < 46.1 ? 'AC → DC' : 'DC · steady'
  g.fillText(label, x + 12, y + h - 10)
  // 实际电平读数（取真实 RMS，不是假数字）
  g.fillStyle = C.amber
  g.fillText(`${(sync.rmsAt(t) * 100).toFixed(1)} %rms`, x + w - 96, y + h - 10)
  g.restore()
}

/* ---------------- 时间尺 ---------------- */
function drawTimeline(g, ctx, t) {
  const { W, H } = ctx
  const a = span(t, 51.3, 51.9) * (1 - span(t, 56.0, 56.8))
  if (a <= 0.01) return
  const y = H * 0.62
  const half = W * 0.44
  // 2026 → 公元前：0:51.4 起滚，0:55.2 合拢
  const u = inOutCubic(span(t, 51.4, 55.2))
  const year = Math.round(2026 + (-3000 - 2026) * u)
  const converge = span(t, 54.6, 55.2)
  const len = half * (1 - converge * 0.98)
  g.save()
  g.globalAlpha = a
  g.strokeStyle = C.fgDim
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(W / 2 - len, y)
  g.lineTo(W / 2 + len, y)
  g.stroke()
  // 刻度：数字滚动
  const step = 100
  const base = Math.round(year / step) * step
  for (let k = 0; k < 60; k++) {
    const yr = base + k * step
    const off = ((yr - year) / 24) * (W * 0.44)
    const x = W / 2 + off * (1 - converge)
    if (Math.abs(x - W / 2) > len + 20) continue
    g.strokeStyle = rgba(C.fgDim, yr === 0 ? 0.95 : 0.4)
    g.beginPath()
    g.moveTo(x, y - 8)
    g.lineTo(x, y + 8)
    g.stroke()
    if (k % 2 === 0) {
      g.font = MONO(12, 600)
      g.fillStyle = yr < 0 ? C.teal : C.fgDim
      g.textAlign = 'center'
      g.textBaseline = 'top'
      g.fillText(yr <= 0 ? `${-yr} BCE` : `${yr}`, x, y + 12)
    }
  }
  // 当前年份大字
  g.font = MONO(54, 700)
  g.fillStyle = year < 0 ? C.cyan : C.fg
  g.textAlign = 'center'
  g.textBaseline = 'bottom'
  g.fillText(year <= 0 ? `${-year} BCE` : `${year}`, W / 2, y - 26)
  if (converge > 0.4) {
    g.fillStyle = rgba(C.cyan, (converge - 0.4) / 0.6)
    g.beginPath()
    g.arc(W / 2, y, 6 + 20 * converge, 0, TAU)
    g.fill()
  }
  g.restore()
}

/* ---------------- 深度计 ---------------- */
function drawDepthGauge(g, ctx, p, t) {
  const { W, H, sync } = ctx
  const x = W - 96
  const y0 = H * 0.16
  const h = H * 0.6
  g.save()
  g.globalAlpha = p
  roundRect(g, x, y0, 54, h, 8)
  g.fillStyle = 'rgba(10,18,28,0.85)'
  g.fill()
  g.strokeStyle = rgba(C.teal, 0.6)
  g.lineWidth = 1.5
  g.stroke()
  // 刻度
  for (let i = 0; i <= 10; i++) {
    const yy = y0 + (h * i) / 10
    g.strokeStyle = rgba(C.fgDim, 0.45)
    g.beginPath()
    g.moveTo(x + 6, yy)
    g.lineTo(x + 18, yy)
    g.stroke()
    g.font = MONO(10, 500)
    g.fillStyle = rgba(C.fgDim, 0.8)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(`${i * 1000}`, x + 22, yy)
  }
  // 指针（真实读数由 rms 驱动下潜速度）
  const speed = 0.35 + sync.rmsAt(t) * 1.6
  const pos = clamp(p * speed)
  const py = y0 + h * (0.06 + pos * 0.9)
  g.fillStyle = C.cyan
  g.beginPath()
  g.moveTo(x - 6, py)
  g.lineTo(x + 4, py - 7)
  g.lineTo(x + 4, py + 7)
  g.closePath()
  g.fill()
  g.font = MONO(13, 700)
  g.fillStyle = C.cyan
  g.textAlign = 'center'
  g.textBaseline = 'bottom'
  g.fillText(`${Math.round(pos * 11000)} m`, x + 27, y0 - 8)
  g.restore()
}
