// src/scenes/k_storm.js — 段 K 2:27.9–2:42 执行风暴（副歌二）
// DIRECTOR：背景是损失函数地形的引力井（时空网格），梯度下降的小球沿螺旋坠入；公式螺旋坠入
// 并被潮汐拉长；速度线、急拉环绕。12 次「执行」各对应一张工具调用卡片飞向她（12 种工具名），
// 每次重拍命中，glitch 与 strained 逐次加重（heat = k/12）。
// 2:38.95 多语言 1–6 计数：六种书写系统的数字依次翻牌；2:41.7 最后一击最大闪白。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, toolCard, roundRect, progressBar } from '../ui/dsh.js'
import { drawMath, FORMULAS } from '../lib/formula.js'
import { TOOL_NAMES } from '../lib/code.js'
import { gradientDescent } from '../lib/tables.js'
import { createGridPlane } from '../lib/three_util.js'

const NUMERALS = [
  ['1', 'latin'],
  ['٢', 'arabic-indic'],
  ['३', 'devanagari'],
  ['四', 'cjk'],
  ['๕', 'thai'],
  ['VI', 'roman'],
]

export default {
  id: 'K',
  start: 147.9,
  end: 162.0,
  title: '执行风暴',
  fx: [
    { t: 147.9, kind: 'flash', amount: 1.0, dur: 0.22 },
    { t: 147.9, kind: 'shake', amount: 0.9, dur: 0.6 },
    { t: 161.726, kind: 'flash', amount: 1.0, dur: 0.42 },
    { t: 161.726, kind: 'shake', amount: 1.0, dur: 0.8 },
    { t: 161.75, kind: 'glitch', amount: 1.0, dur: 0.35 },
  ],

  init(ctx) {
    this.plane = createGridPlane(34, 2.6, '#6f8fae')
    ctx.three.stage3d.add(this.plane.object)
    this.gd = gradientDescent({ steps: 900, lr: 0.055, start: [-1.55, 1.05] })
    // 12 次「执行」的时刻（从歌词真实 word 时间取）
    this.execs = []
    for (const s of ctx.lyrics || []) {
      for (const w of s.words) {
        if (/^execution/i.test(w.w.trim()) && w.t >= 147.9 && w.t <= 162) this.execs.push(w.t)
      }
    }
    // 多语言计数的 6 个时刻（取自 "Ein Dos Trois Ne Fem Liu" 的词时间）
    this.counts = []
    for (const s of ctx.lyrics || []) {
      if (Math.abs(s.t0 - 158.95) < 0.6) for (const w of s.words) this.counts.push(w.t)
    }
    if (this.counts.length < 6) this.counts = [158.95, 159.3, 159.65, 160.0, 160.35, 160.7]
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const k = this.execs.filter((x) => t >= x).length
    const heat = clamp(k / 12)

    // 损失地形底色
    const bg = mixHex('#0a0b12', '#1b0d1a', heat)
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)
    const rg = g.createRadialGradient(W / 2, H * 0.5, 30, W / 2, H * 0.5, H * 1.0)
    rg.addColorStop(0, rgba('#3a1c4a', 0.35 + 0.3 * heat))
    rg.addColorStop(0.6, rgba('#12081c', 0.4))
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)

    // ---- 引力井网格（Three） ----
    const depth = 0.5 + 1.5 * inOutCubic(clamp((t - 147.9) / 14))
    this.plane.object.visible = true
    this.plane.update(t, {
      alpha: 0.55,
      wells: [{ x: 0, y: 0, depth, sigma: 0.45 }],
      perspective: 0.42,
      tScale: 1.4,
    })

    // ---- 速度线 / 急拉环绕 ----
    drawSpeedLines(g, ctx, t, heat)

    // ---- 梯度下降小球沿螺旋坠入（表驱动） ----
    drawDescentBall(g, ctx, t, this.gd, depth)

    // ---- 公式螺旋坠入并被潮汐拉长 ----
    drawTidalFormulas(g, ctx, t, heat)

    // ---- 12 张工具卡片飞向她 ----
    drawToolCards(g, ctx, t, this.execs, heat)

    // ---- 2:38.95 六种书写系统的数字翻牌 ----
    drawNumeralFlips(g, ctx, t, this.counts)

    // ---- 热力读数（真实 heat = k/12） ----
    g.save()
    g.globalAlpha = 0.95
    g.font = MONO(14, 700)
    g.fillStyle = heat > 0.75 ? C.red : C.amber
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    g.fillText(`execution ${k}/12   heat ${(heat * 100).toFixed(0)}%`, 72, H * 0.10)
    progressBar(g, { x: 72, y: H * 0.11 + 10, w: 340, h: 9, p: heat, alpha: 0.95, label: '', color: heat > 0.75 ? C.red : C.cyan })
    g.restore()

    // ---- 立绘：strained 随 heat 加重 ----
    ctx.whale.sprite = {
      expr: heat < 0.08 ? 'wake' : 'strained',
      rect: ctx.rect,
      alpha: 1 - span(t, 161.75, 161.99),
      glitch: 0.5 * heat + 0.12 * sync.pulse(t, 130),
      tint: heat > 0.6 ? '#ff6a6a' : null,
      tintAmt: 0.35 * clamp((heat - 0.6) / 0.4),
    }
  },
}

/* ---------------- 速度线 ---------------- */
function drawSpeedLines(g, ctx, t, heat) {
  const { W, H } = ctx
  g.save()
  const gi = Math.floor(t * 30)
  for (let i = 0; i < 130; i++) {
    const a = hash01(i, 111) * TAU
    const r0 = H * (0.10 + hash01(i, 112) * 0.3)
    const sp = 0.5 + hash01(i, 113) * 1.6
    const u = ((t * sp * 0.5 + hash01(i, 114)) % 1)
    const x0 = W / 2 + Math.cos(a) * r0
    const y0 = H / 2 + Math.sin(a) * r0
    const x1 = W / 2 + Math.cos(a) * (r0 + u * H * 0.9)
    const y1 = H / 2 + Math.sin(a) * (r0 + u * H * 0.9)
    g.strokeStyle = rgba(i % 3 === 0 ? C.gold : C.teal, (1 - u) * (0.10 + 0.25 * heat))
    g.lineWidth = 1 + hash01(i, 115) * 2
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  g.restore()
}

/* ---------------- 梯度下降小球 ---------------- */
function drawDescentBall(g, ctx, t, gd, depth) {
  const { W, H } = ctx
  const u = clamp((t - 147.9) / 13)
  const idx = Math.floor(u * (gd.steps - 1))
  const bx = gd.path[idx * 3]
  const by = gd.path[idx * 3 + 1]
  const loss = gd.path[idx * 3 + 2]
  // 映射到屏幕（损失地形的局部坐标）
  const sx = W / 2 + bx * 150
  const sy = H * 0.52 + by * 110 + depth * 26
  // 轨迹
  g.save()
  g.globalAlpha = 0.85
  g.strokeStyle = rgba(C.gold, 0.55)
  g.lineWidth = 2
  g.beginPath()
  const start = Math.max(0, idx - 180)
  for (let i = start; i <= idx; i++) {
    const x = W / 2 + gd.path[i * 3] * 150
    const y = H * 0.52 + gd.path[i * 3 + 1] * 110 + depth * 26
    i === start ? g.moveTo(x, y) : g.lineTo(x, y)
  }
  g.stroke()
  // 小球
  const r = 9 + 5 * Math.abs(Math.sin(t * 5))
  const rg = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4)
  rg.addColorStop(0, 'rgba(255,255,255,1)')
  rg.addColorStop(0.4, rgba(C.gold, 0.8))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath()
  g.arc(sx, sy, r * 2.4, 0, TAU)
  g.fill()
  // 真实读数
  g.font = MONO(12, 600)
  g.fillStyle = C.gold
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(`∇L step ${idx}   L = ${loss.toFixed(4)}`, sx + 22, sy - 16)
  g.restore()
}

/* ---------------- 潮汐拉长的公式 ---------------- */
function drawTidalFormulas(g, ctx, t, heat) {
  const { W, H } = ctx
  const list = [FORMULAS.softmax, FORMULAS.crossentropy, FORMULAS.attention, FORMULAS.kv, FORMULAS.limit]
  g.save()
  for (let i = 0; i < list.length; i++) {
    const phase = (t * 0.16 + i / list.length) % 1
    const ang = phase * TAU * 1.6 + i * 1.1
    const r = (1 - phase) * H * 0.62
    const x = W / 2 + Math.cos(ang) * r * 1.15
    const y = H * 0.5 + Math.sin(ang) * r * 0.5
    const stretch = 1 + phase * 2.4 // 潮汐拉长
    g.save()
    g.globalAlpha = clamp(0.18 + phase * 0.7) * (0.6 + 0.4 * heat)
    g.translate(x, y)
    g.rotate(ang * 0.4)
    g.scale(stretch, 1 - phase * 0.35)
    drawMath(g, 0, 0, list[i], 20, { color: phase > 0.7 ? C.pink : C.purple, align: 'center' })
    g.restore()
  }
  g.restore()
}

/* ---------------- 工具调用卡片飞向她 ---------------- */
function drawToolCards(g, ctx, t, execs, heat) {
  const { W, H } = ctx
  const targetX = W * 0.62
  const targetY = H * 0.42
  g.save()
  for (let i = 0; i < execs.length; i++) {
    const t0 = execs[i]
    const u = span(t, t0 - 0.34, t0)
    const after = t - t0
    if (u <= 0) continue
    const fade = 1 - span(t, t0 + 0.42, t0 + 0.8)
    if (fade <= 0.01) continue
    // 从左上飞入
    const sx = -260 + (targetX - 160) * outCubic(clamp(u))
    const sy = H * 0.06 + (targetY - 60 - H * 0.06) * outCubic(clamp(u)) + i * 14
    const jolt = after > 0 && after < 0.25 ? (1 - after / 0.25) * 26 : 0
    g.globalAlpha = clamp(fade)
    g.save()
    g.translate(sx + (hash01(i, 121) * 2 - 1) * jolt, sy + (hash01(i, 122) * 2 - 1) * jolt)
    toolCard(g, {
      x: 0,
      y: 0,
      w: 340,
      name: TOOL_NAMES[i % TOOL_NAMES.length],
      args: i % 2 ? 'args: {"path":"~/world"}' : 'args: {"q":"last request"}',
      status: after > 0 ? 'ok' : 'run',
      alpha: 1,
      t,
      seed: i,
    })
    // 命中火花
    if (after >= 0 && after < 0.3) {
      const sp = 1 - after / 0.3
      g.fillStyle = rgba(C.cyan, sp * 0.6)
      g.beginPath()
      g.arc(340, 30, 8 + 40 * (1 - sp), 0, TAU)
      g.fill()
    }
    g.restore()
  }
  g.restore()
}

/* ---------------- 六种书写系统数字翻牌 ---------------- */
function drawNumeralFlips(g, ctx, t, counts) {
  const { W, H } = ctx
  const a = span(t, 158.7, 159.1) * (1 - span(t, 161.3, 161.75))
  if (a <= 0.01) return
  const cw = 116
  const total = NUMERALS.length
  const x0 = W / 2 - (total * (cw + 12)) / 2
  const y = H * 0.60
  g.save()
  for (let i = 0; i < total; i++) {
    const t0 = counts[i] ?? 158.95 + i * 0.35
    const u = span(t, t0, t0 + 0.26)
    const flip = i < counts.length ? inOutCubic(clamp(u)) : 1
    const x = x0 + i * (cw + 12)
    g.globalAlpha = a
    // 卡片
    roundRect(g, x, y, cw, 138, 8)
    g.fillStyle = 'rgba(24,20,34,0.92)'
    g.fill()
    g.strokeStyle = rgba(i < counts.filter((c) => t >= c).length ? C.gold : C.panelEdge, 0.9)
    g.lineWidth = 2
    g.stroke()
    // 翻牌：前半段压缩，后半段展开（用横向缩放模拟）
    const sx = Math.abs(Math.cos(flip * Math.PI))
    g.save()
    g.translate(x + cw / 2, y + 69)
    g.scale(Math.max(0.04, sx), 1)
    const revealed = flip > 0.5
    g.font = MONO(64, 700)
    g.fillStyle = revealed ? C.gold : rgba(C.fgDim, 0.4)
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(revealed ? NUMERALS[i][0] : '?', 0, -8)
    g.restore()
    g.font = MONO(11, 600)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.fillText(NUMERALS[i][1], x + cw / 2, y + 124)
  }
  g.restore()
}
