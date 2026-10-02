// src/scenes/l_training.js — 段 L 2:42–2:57.4 训练与星系
// DIRECTOR：2:42.7 训练循环（损失曲线带噪声下降）；2:46.3 大爆炸：粒子与公式四散，汇成螺旋星系
// （权重星云）；2:49.99 输入框出现「对方正在输入…」并反复闪现又消失，从不发送；
// 2:51.95 星系聚成公式球；2:53.7–2:57.4 三棱镜色散收尾，白光裂成光谱。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outExpo } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect } from '../ui/dsh.js'
import { drawMath, FORMULAS } from '../lib/formula.js'
import { lossCurve } from '../lib/tables.js'
import { lossCurvePoints } from '../lib/code.js'
import { createField } from '../lib/three_util.js'
import { cursorOn } from '../ui/typing.js'

const TYPING = '对方正在输入…'

export default {
  id: 'L',
  start: 162.0,
  end: 177.4,
  title: '训练与星系',
  fx: [
    { t: 162.0, kind: 'flash', amount: 0.4, dur: 0.16 },
    { t: 166.3, kind: 'flash', amount: 1.0, dur: 0.34 },
    { t: 166.3, kind: 'shake', amount: 0.9, dur: 0.7 },
    { t: 166.3, kind: 'disp', amount: 0.6, dur: 1.2 },
    { t: 171.95, kind: 'flash', amount: 0.6, dur: 0.2 },
    { t: 173.7, kind: 'disp', amount: 0.8, dur: 1.4 },
    { t: 177.4, kind: 'flash', amount: 0.5, dur: 0.18 },
  ],

  init(ctx) {
    this.loss = lossCurve({ steps: 900, seed: 4242 })
    this.galaxy = createField(26000, 1, { seed: 21, color: '#cbb6ff', size: 2.6, turns: 2.1, spin: 0.07 })
    this.galaxy.object.visible = false
    ctx.three.stage3d.add(this.galaxy.object)
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const bang = span(t, 166.3, 167.4)
    const ball = span(t, 171.95, 173.1)
    const prism = span(t, 173.7, 175.4)

    // 底色：训练期冷灰 → 星系期深紫 → 棱镜期渐白
    g.fillStyle = mixHex(mixHex(C.bg0, '#0b0a18', bang), '#14121c', ball)
    g.fillRect(0, 0, W, H)
    g.fillStyle = rgba(C.bg1, 0.5)
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 2:42.7 损失曲线（真实噪声下降） ----
    const lossA = span(t, 162.5, 163.2) * (1 - span(t, 166.4, 167.2))
    if (lossA > 0.01) drawLossChart(g, ctx, t, this.loss, lossA)

    // ---- 2:46.3 大爆炸：粒子与公式四散 ----
    if (t > 165.9) {
      this.galaxy.object.visible = true
      const spin = prism > 0 ? 0.9 : 0.07
      this.galaxy.update(t, { alpha: clamp(span(t, 166.1, 167.0)) * (1 - prism * 0.5), size: 2.6, spin })
    }
    if (bang > 0) drawBangFormulas(g, ctx, t, bang)

    // ---- 2:49.99 对方正在输入…（反复闪现又消失，从不发送） ----
    if (t > 169.6 && t < 172.2) drawTypingHint(g, ctx, t)

    // ---- 2:51.95 星系聚成公式球 ----
    if (ball > 0.01) drawFormulaBall(g, ctx, t, ball)

    // ---- 2:53.7–2:57.4 三棱镜色散 ----
    if (prism > 0.01) drawPrism(g, ctx, t, prism)

    // ---- 立绘 ----
    const hideForPrism = span(t, 173.9, 174.6)
    ctx.whale.sprite = {
      expr: t < 166.3 ? 'neutral' : 'dazed',
      rect: ctx.rect,
      alpha: (1 - hideForPrism) * (1 - span(t, 177.0, 177.38)),
      glitch: 0.12 * sync.pulse(t, 160),
    }
    // 星系期把点云从她身上抽出来汇成旋涡
    if (bang > 0.05 && prism < 0.9) {
      ctx.whale.points = {
        from: 'sprite',
        to: 'galaxy',
        p: clamp(bang),
        stagger: 0.5,
        ease: inOutCubic,
        seed: 5,
        rotY: 0.15 * Math.sin(t * 0.3),
        alpha: (1 - prism) * clamp(bang * 1.4),
        size: 4,
        bulge: 0.2,
      }
    }
  },
}

/* ---------------- 损失曲线 ---------------- */
function drawLossChart(g, ctx, t, loss, a) {
  const { W, H } = ctx
  const x = W * 0.08
  const y = H * 0.20
  const w = W * 0.44
  const h = H * 0.40
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: 'train · loss' })
  g.strokeStyle = rgba(C.line, 0.5)
  g.lineWidth = 1
  for (let i = 1; i < 6; i++) {
    g.beginPath()
    g.moveTo(x + (w * i) / 6, y + 28)
    g.lineTo(x + (w * i) / 6, y + h)
    g.stroke()
  }
  const pts = lossCurvePoints(loss, x + 16, y + 44, w - 32, h - 60)
  const upto = Math.floor(clamp((t - 162.5) / 3.4) * pts.length)
  g.strokeStyle = C.green
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i < upto; i++) {
    i === 0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1])
  }
  g.stroke()
  if (upto > 0 && upto < pts.length) {
    g.fillStyle = C.cyan
    g.beginPath()
    g.arc(pts[upto - 1][0], pts[upto - 1][1], 4, 0, TAU)
    g.fill()
  }
  const cur = loss[Math.max(0, Math.min(loss.length - 1, upto - 1))]
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(`loss ${cur.toFixed(4)}   step ${upto}`, x + 16, y + h - 14)
  g.restore()
}

/* ---------------- 大爆炸四散的公式 ---------------- */
function drawBangFormulas(g, ctx, t, a) {
  const { W, H } = ctx
  const list = [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.heart, FORMULAS.kv, FORMULAS.limit, FORMULAS.epsdelta]
  g.save()
  for (let i = 0; i < list.length * 3; i++) {
    const k = i % list.length
    const ang = hash01(i, 131) * TAU
    const sp = 0.4 + hash01(i, 132) * 1.3
    const u = clamp(a * sp)
    const r = u * H * 0.8
    const x = W / 2 + Math.cos(ang) * r * 1.2
    const y = H * 0.48 + Math.sin(ang) * r * 0.6
    g.globalAlpha = (1 - u) * 0.8 * (1 - span(t, 169.0, 170.2))
    g.save()
    g.translate(x, y)
    g.rotate(ang + u * 1.2)
    drawMath(g, 0, 0, list[k], 18 * (1 - u * 0.4), { color: k % 2 ? C.purple : C.teal, align: 'center' })
    g.restore()
  }
  g.restore()
}

/* ---------------- 「对方正在输入…」 ---------------- */
function drawTypingHint(g, ctx, t) {
  const { W, H } = ctx
  // 反复闪现又消失：约 0.62s 周期，只在部分周期出现
  const cyc = (t - 169.99) / 0.62
  const ph = cyc - Math.floor(cyc)
  const on = Math.floor(cyc) % 3 !== 2 && ph < 0.62
  const a = on ? Math.min(1, ph / 0.08) * Math.min(1, (0.62 - ph) / 0.1) : 0
  if (a <= 0.01) return
  const x = W * 0.44
  const y = H * 0.74
  g.save()
  g.globalAlpha = a
  roundRect(g, x - 14, y - 26, 300, 44, 10)
  g.fillStyle = 'rgba(24,27,34,0.95)'
  g.fill()
  g.strokeStyle = rgba(C.line, 0.9)
  g.lineWidth = 1
  g.stroke()
  g.font = '500 17px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace'
  g.fillStyle = rgba(C.fgDim, 0.95)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(TYPING, x, y - 4)
  // 三个跳动的点
  for (let i = 0; i < 3; i++) {
    const on2 = (Math.floor(t * 3) + i) % 3 === 0
    g.fillStyle = rgba(C.cyan, on2 ? 0.95 : 0.3)
    g.beginPath()
    g.arc(x + 216 + i * 16, y - 4, 3.4, 0, TAU)
    g.fill()
  }
  g.restore()
}

/* ---------------- 公式球 ---------------- */
function drawFormulaBall(g, ctx, t, a) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.48
  const R = H * 0.26 * outCubic(a)
  g.save()
  g.globalAlpha = a * 0.95
  // 经纬线
  g.strokeStyle = rgba(C.teal, 0.55)
  g.lineWidth = 1.2
  for (let k = 0; k < 7; k++) {
    const ph = (k / 7) * Math.PI
    g.beginPath()
    g.ellipse(cx, cy, R * Math.max(0.02, Math.cos(ph - Math.PI / 2)), R, 0, 0, TAU)
    g.stroke()
  }
  for (let k = 0; k < 5; k++) {
    const ph = (k / 5) * Math.PI + t * 0.2
    g.beginPath()
    g.ellipse(cx, cy, R, R * Math.max(0.02, Math.abs(Math.sin(ph))), 0, 0, TAU)
    g.stroke()
  }
  // 球面上的公式
  const list = [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.heart, FORMULAS.kv]
  for (let i = 0; i < 14; i++) {
    const a1 = hash01(i, 141) * TAU + t * 0.24
    const a2 = (hash01(i, 142) - 0.5) * Math.PI
    const x = cx + Math.cos(a1) * Math.cos(a2) * R
    const y = cy + Math.sin(a2) * R
    const front = Math.cos(a1) * Math.cos(a2)
    g.globalAlpha = a * (0.25 + 0.7 * Math.max(0, front))
    drawMath(g, x, y, list[i % list.length], 13, { color: C.gold, align: 'center' })
  }
  g.restore()
}

/* ---------------- 三棱镜色散 ---------------- */
function drawPrism(g, ctx, t, a) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.44
  const white = 1 - span(t, 175.6, 176.6)
  g.save()
  g.globalAlpha = a
  // 入射白光
  g.strokeStyle = rgba('#ffffff', 0.9 * white)
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(cx - W * 0.30, cy)
  g.lineTo(cx - 60, cy)
  g.stroke()
  // 棱镜
  g.beginPath()
  g.moveTo(cx - 60, cy - 120)
  g.lineTo(cx + 40, cy + 110)
  g.lineTo(cx - 160, cy + 110)
  g.closePath()
  g.fillStyle = 'rgba(190,220,255,0.12)'
  g.fill()
  g.strokeStyle = rgba('#cfe8ff', 0.7)
  g.lineWidth = 2
  g.stroke()
  // 光谱扇
  const HUES = ['#ff3b3b', '#ff9a3b', '#ffe93b', '#5cff6b', '#3bd0ff', '#5c6bff', '#c05cff']
  const split = span(t, 174.4, 176.2)
  for (let i = 0; i < HUES.length; i++) {
    const ang = ((i - (HUES.length - 1) / 2) / HUES.length) * 0.9 * split + 0.06
    const len = W * (0.34 + 0.16 * split)
    g.strokeStyle = rgba(HUES[i], 0.85 * split)
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(cx + 20, cy + 20)
    g.lineTo(cx + 20 + Math.cos(ang) * len, cy + 20 + Math.sin(ang) * len)
    g.stroke()
  }
  // 白光整体衰减
  if (white > 0.01) {
    g.globalAlpha = a * white * 0.6
    const rg = g.createRadialGradient(cx + 20, cy + 20, 0, cx + 20, cy + 20, H * 0.4)
    rg.addColorStop(0, 'rgba(255,255,255,0.9)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  g.font = MONO(15, 700)
  g.fillStyle = rgba(C.fg, 0.85 * a)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText('dispersion · λ 400 → 700 nm', cx, H * 0.86)
  g.restore()
}
