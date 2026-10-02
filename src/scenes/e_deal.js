// src/scenes/e_deal.js — 段 E 0:59–1:14.0 交易（副歌一）
// DIRECTOR：1:00.2 右侧奖励条逐格充能；4D 超立方体旋转投影，每个小节砸入一条 3D 挤出公式
// （softmax / 交叉熵 / 注意力），重拍震屏+色散；1:06.6 她 smile、奖励条打满；
// 1:08.5 巨大 ▶ 描边后闪白；1:10.3–1:14.0 一圈透视网格墙合拢成笼，她换 worried 环顾四周。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, keyframes, TAU, outCubic, outBack, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, rewardBar, roundRect } from '../ui/dsh.js'
import { drawMath, FORMULAS, softmaxFromSpectrum, crossEntropy, attentionFromSpectrum } from '../lib/formula.js'
import { createHypercube } from '../lib/three_util.js'

const SLAM_FORMULAS = [
  { tex: FORMULAS.softmax, label: 'softmax' },
  { tex: FORMULAS.crossentropy, label: 'cross-entropy' },
  { tex: FORMULAS.attention, label: 'attention' },
]
const CELLS = 14

export default {
  id: 'E',
  start: 59.0,
  end: 74.0,
  title: '交易',
  fx: [
    { t: 59.0, kind: 'flash', amount: 0.5, dur: 0.16 },
    { t: 68.5, kind: 'flash', amount: 1.0, dur: 0.26 },
    { t: 68.5, kind: 'shake', amount: 0.85, dur: 0.5 },
    { t: 70.3, kind: 'glitch', amount: 0.5, dur: 0.25 },
    { t: 74.0, kind: 'flash', amount: 0.55, dur: 0.16 },
  ],

  init(ctx) {
    this.cube = createHypercube(0.66, '#c792ea')
    ctx.three.stage3d.add(this.cube.object)
    this.slam = []
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    // 副歌底色：深色 + 中心紫红辉光
    const glow = 0.35 + 0.65 * sync.pulse(t, 260)
    g.fillStyle = mixHex(C.bg0, '#1a1030', 0.5)
    g.fillRect(0, 0, W, H)
    const rg = g.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.46, H * 0.95)
    rg.addColorStop(0, rgba('#7b3fa8', 0.30 * glow))
    rg.addColorStop(0.5, rgba('#3a1f5c', 0.18 * glow))
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
    g.fillStyle = C.bg1
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 4D 超立方体 ----
    const cubeA = span(t, 60.0, 61.2) * (1 - span(t, 69.6, 70.6))
    if (cubeA > 0.01) {
      this.cube.object.visible = true
      this.cube.update(t, { alpha: cubeA * 0.85, spin: 0.42, scale: 0.85 + 0.3 * glow })
    }

    // ---- 每小节砸入一条 3D 挤出公式 ----
    drawSlammedFormulas(g, ctx, t, sync)

    // ---- 右侧奖励条 ----
    const barA = span(t, 60.0, 60.7) * (1 - span(t, 70.0, 70.9))
    if (barA > 0.01) {
      const bx = W - 118
      const by = H * 0.24
      const bh = H * 0.52
      const p = span(t, 60.2, 66.6)
      const filled = Math.round(p * CELLS)
      rewardBar(g, { x: bx, y: by, w: 58, h: bh, cells: CELLS, filled, alpha: barA, t })
      g.save()
      g.globalAlpha = barA
      g.font = MONO(13, 700)
      g.fillStyle = filled >= CELLS ? C.gold : C.fgDim
      g.textAlign = 'center'
      g.textBaseline = 'bottom'
      g.fillText(`reward ${filled}/${CELLS}`, bx + 29, by - 10)
      g.restore()
    }

    // ---- 1:08.5 巨大 ▶ 描边 ----
    const play = span(t, 68.3, 68.9)
    if (play > 0 && t < 70.0) {
      const a = play < 1 ? outCubic(play) : 1 - span(t, 69.1, 69.9)
      const s = 0.6 + 0.4 * outElastic(clamp(play))
      g.save()
      g.globalAlpha = clamp(a)
      g.translate(W / 2, H * 0.46)
      g.scale(s, s)
      g.strokeStyle = C.cyan
      g.lineWidth = 14
      g.lineJoin = 'round'
      g.beginPath()
      g.moveTo(-90, -140)
      g.lineTo(150, 0)
      g.lineTo(-90, 140)
      g.closePath()
      g.stroke()
      g.strokeStyle = rgba('#ffffff', 0.5)
      g.lineWidth = 4
      g.stroke()
      g.restore()
    }

    // ---- 1:10.3–1:14.0 透视网格墙合拢成笼 ----
    const cage = span(t, 70.3, 73.6)
    if (cage > 0.01) drawCage(g, ctx, cage, t, sync)

    // ---- 立绘 ----
    const expr = t < 66.6 ? 'neutral' : t < 70.3 ? 'smile' : 'worried'
    ctx.whale.sprite = {
      expr,
      rect: ctx.rect,
      alpha: 1 - span(t, 73.2, 73.95),
      glitch: 0.08 * sync.pulse(t, 160),
      tint: cage > 0.2 ? '#8f7fd0' : null,
      tintAmt: cage * 0.35,
    }
  },
}

/** 在小节首拍砸入一条带 3D 挤出的公式 */
function drawSlammedFormulas(g, ctx, t, sync) {
  const { W, H } = ctx
  const beats = sync.beats
  const starts = []
  for (let i = 0; i < beats.length; i++) {
    if (i % 4 === 0 && beats[i] >= 60.2 && beats[i] <= 67.0) starts.push(beats[i])
  }
  g.save()
  for (let k = 0; k < starts.length; k++) {
    const t0 = starts[k]
    const u = span(t, t0, t0 + 0.22)
    if (u <= 0) continue
    const fade = 1 - span(t, t0 + 2.4, t0 + 3.1)
    if (fade <= 0.01) continue
    const item = SLAM_FORMULAS[k % SLAM_FORMULAS.length]
    const sc = 0.5 + 0.5 * outBack(clamp(u))
    const yy = H * (0.30 + (k % 3) * 0.14)
    // 每小节往画面中下方推进，制造"砸入"感
    const slide = (1 - outCubic(clamp(u))) * -60
    g.save()
    g.globalAlpha = clamp(fade * u)
    g.translate(W * 0.42, yy + slide)
    g.scale(sc, sc)
    // 3D 挤出：沿对角线重复描边
    g.font = MONO(40, 700)
    const wpx = g.measureText(item.tex).width
    for (let d = 14; d >= 0; d--) {
      const col = d === 0 ? '#ffffff' : mixHex('#2a1f3a', '#7b5cc0', d / 14)
      drawMath(g, -wpx / 2 + d * 0.95, d * 0.95, item.tex, 40, { color: col, alpha: 1 })
    }
    g.font = MONO(13, 700)
    g.fillStyle = C.gold
    g.textAlign = 'left'
    g.fillText(item.label, -wpx / 2, 34)
    g.restore()
  }
  // 右下的真实数值读数（softmax / 交叉熵 / 注意力，全部真实计算）
  const spec = ctx.spec
  sync.spectrumAt(t, spec)
  const p = softmaxFromSpectrum(spec)
  const y = [Math.floor(p[2] * 7), 0, 0, 0, 0, 0, 0, 0]
  const ce = crossEntropy(p, y)
  const att = attentionFromSpectrum(spec, spec)
  g.globalAlpha = 0.9
  g.font = MONO(12, 500)
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillStyle = rgba(C.teal, 0.85)
  g.fillText(`softmax[2] = ${p[2].toFixed(4)}   L = ${ce.toFixed(3)}   QKᵀ/√d = ${att.toFixed(3)}`, W * 0.14, H * 0.90)
  g.restore()
}

/** 透视网格墙合拢成笼 */
function drawCage(g, ctx, p, t, sync) {
  const { W, H } = ctx
  const R = (1 - p) * W * 0.46 + 150
  const cx = W / 2
  const cy = H * 0.48
  g.save()
  g.globalAlpha = p * 0.95
  g.strokeStyle = rgba(C.cyan, 0.55)
  g.lineWidth = 1.2
  const N = 16
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU + t * 0.06
    const x = cx + Math.cos(a) * R
    const depth = (Math.sin(a) + 1) / 2
    const h = H * (0.35 + depth * 0.55)
    const yTop = cy - h / 2
    g.globalAlpha = p * (0.2 + 0.8 * depth)
    g.beginPath()
    g.moveTo(x, yTop)
    g.lineTo(x, yTop + h)
    g.stroke()
  }
  // 环
  for (let r = 0; r < 5; r++) {
    const ry = cy - H * 0.28 + r * (H * 0.14)
    g.globalAlpha = p * 0.4
    g.beginPath()
    g.ellipse(cx, ry, R, R * 0.24, 0, 0, TAU)
    g.stroke()
  }
  // 笼栅格（竖线之间的横线，随重拍闪）
  const pulse = sync.pulse(t, 200)
  g.globalAlpha = p * (0.3 + 0.5 * pulse)
  g.strokeStyle = rgba(C.gold, 0.6)
  g.beginPath()
  g.ellipse(cx, cy, R, R * 0.24, 0, 0, TAU)
  g.stroke()
  g.restore()
}
