// src/scenes/c_define.js — 段 C 0:29.7–0:44 自我定义
// DIRECTOR：0:29.7 立绘溶解成点云；0:31.4 抬升第三维、近正交环绕露厚度；0:33.4 聚成单位圆；
// 0:35.0 圆周刻度逐格亮起并读出 2πr；0:37.2 圆展成正弦波；0:38.7 切线沿波逐个落下（卡起音点）；
// 0:40.8 趋向竖直渐近线、冲向无穷画出 ∞；0:42.4 被墙 x=L 与 ε 带截住，标 lim 与 ε-δ。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, keyframes, TAU, inOutCubic, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO } from '../ui/dsh.js'
import { drawMath } from '../lib/formula.js'

const R = 0.62 // 单位圆半径（画面半高的倍数）
const SINE_K = 3
const SINE_AMP = 0.42
const TICKS = 24
const WALL_L = 0.86
const EPS = 0.09

export default {
  id: 'C',
  start: 29.7,
  end: 44.0,
  title: '自我定义',
  fx: [
    { t: 29.7, kind: 'flash', amount: 0.45, dur: 0.16 },
    { t: 33.4, kind: 'flash', amount: 0.25, dur: 0.12 },
    { t: 37.2, kind: 'flash', amount: 0.25, dur: 0.12 },
    { t: 40.8, kind: 'disp', amount: 0.5, dur: 0.4 },
    { t: 42.4, kind: 'glitch', amount: 0.6, dur: 0.18 },
  ],

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    // 深色数学平面背景
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#05070d')
    grad.addColorStop(1, '#0a0f18')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    drawPlane(g, W, H, t)

    // 溶解：立绘淡出、点云淡入
    const spriteA = 1 - span(t, 29.7, 30.4)
    if (spriteA > 0.01) {
      ctx.whale.sprite = { expr: 'neutral', rect: ctx.rect, alpha: spriteA }
    }

    // ---- 点云状态机 ----
    const st = stateAt(t, sync)
    ctx.whale.points = {
      from: st.from,
      to: st.to,
      p: st.p,
      stagger: st.stagger,
      ease: inOutCubic,
      seed: 3,
      rotY: st.rotY,
      rotX: st.rotX,
      zoom: st.zoom,
      offsetX: st.offsetX,
      offsetY: st.offsetY,
      alpha: st.alpha,
      size: st.size,
      bulge: st.bulge,
      baseParams: { aspect: W / H },
      fromParams: st.fromParams,
      toParams: st.toParams,
    }

    // ---- 圆：辅助线 + 圆周刻度 + 2πr ----
    const circA = span(t, 33.1, 33.9) * (1 - span(t, 37.1, 37.6))
    if (circA > 0.01) drawCircleOverlay(g, ctx, t, circA, R)

    // ---- 正弦波：坐标轴 + 切线 ----
    const sineA = span(t, 36.9, 37.6) * (1 - span(t, 41.2, 41.9))
    if (sineA > 0.01) {
      drawSineAxes(g, ctx, sineA)
      const tanA = span(t, 38.6, 39.2) * (1 - span(t, 40.9, 41.6))
      if (tanA > 0.01) drawTangents(g, ctx, t, tanA, sync)
    }

    // ---- 渐近线 / 无穷 / 墙 ----
    const asymA = span(t, 40.7, 41.4) * (1 - span(t, 42.3, 42.9))
    if (asymA > 0.01) {
      const x = W / 2 + WALL_L * (H / 2)
      g.save()
      g.globalAlpha = asymA
      g.setLineDash([10, 8])
      g.strokeStyle = rgba(C.gold, 0.85)
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, H)
      g.stroke()
      g.setLineDash([])
      drawMath(g, x - 14, 70, 'x = L', 24, { color: C.gold, align: 'right', alpha: 1 })
      g.restore()
      g.save()
      g.globalAlpha = asymA * (0.5 + 0.5 * Math.abs(Math.sin(t * 4)))
      drawMath(g, W / 2 - H * 0.34, H * 0.30, FORMULA_INF, 34, { color: C.teal, align: 'center' })
      g.restore()
    }
    const wallA = span(t, 42.35, 42.9)
    if (wallA > 0.01) drawWall(g, ctx, wallA, t, sync)

    // 顶部小字：当前形态
    g.save()
    g.globalAlpha = 0.85
    g.font = MONO(14, 600)
    g.fillStyle = C.fgDim
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.fillText(st.label, 72, 66)
    g.restore()
  },
}

const FORMULA_INF = 'x → ∞'

/** 时间 → 点云形态（纯函数） */
function stateAt(t, sync) {
  const base = {
    from: 'sprite',
    to: 'sprite',
    p: 1,
    stagger: 0.35,
    rotY: 0,
    rotX: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    alpha: 1,
    size: 4,
    bulge: 0.16,
    label: 'points · sprite',
    fromParams: null,
    toParams: null,
  }
  const P = (o) => Object.assign({}, base, o)

  // ① 溶解成点云（29.7–30.5）
  if (t < 30.5) {
    return P({ from: 'sprite', to: 'sprite', p: 1, bulge: 0.4, rotY: -0.25 + 0.25 * span(t, 29.7, 30.5), label: 'points · sprite' })
  }
  // ② 第三维：z 抬升 + 环绕（30.5–33.2）
  if (t < 33.2) {
    const sweep = span(t, 30.6, 32.4) // 0→1 环绕
    const back = span(t, 32.4, 33.2)
    return P({
      from: 'sprite',
      to: 'sprite',
      p: 1,
      rotY: 0.25 + sweep * 0.95 - back * 0.35,
      rotX: 0.06 * Math.sin(sweep * Math.PI),
      zoom: 1 + 0.1 * Math.sin(sweep * Math.PI),
      bulge: 0.1,
      label: 'points · z-thickness · orbiting',
    })
  }
  // ③ 聚成单位圆（33.2–34.5）
  if (t < 34.5) {
    return P({ from: 'sprite', to: 'circle', p: span(t, 33.2, 34.5), stagger: 0.4, bulge: 0.3, label: 'points → circle' })
  }
  // ④ 圆（34.5–37.1）
  if (t < 37.1) {
    return P({
      from: 'circle',
      to: 'circle',
      p: 1,
      rotY: 0.12 * Math.sin((t - 34.5) * 0.5),
      toParams: { r: R, rot: t * 0.05 },
      fromParams: { r: R, rot: t * 0.05 },
      label: 'circle · r = 0.62 · C = 2πr',
    })
  }
  // ⑤ 展开成正弦波（37.1–38.1）
  if (t < 38.1) {
    return P({
      from: 'circle',
      to: 'sine',
      p: span(t, 37.1, 38.1),
      stagger: 0.35,
      bulge: 0.25,
      toParams: { k: SINE_K, amp: SINE_AMP },
      fromParams: { r: R },
      label: 'circle → sine',
    })
  }
  // ⑥ 切线逐条落下（38.1–41.0）：用起音点数决定 segments
  if (t < 41.0) {
    const ons = sync.onsetsIn(38.7, 40.8)
    let n = 0
    for (const o of ons) if (t >= o.t) n++
    const M = Math.max(2, n)
    return P({
      from: 'sine',
      to: 'tangents',
      p: clamp(span(t, 38.1, 40.6)),
      stagger: 0.2,
      bulge: 0.12,
      toParams: { k: SINE_K, amp: SINE_AMP, segments: M, len: 0.34 },
      fromParams: { k: SINE_K, amp: SINE_AMP },
      label: `tangents · ${M} dropped`,
    })
  }
  // ⑦ 冲向无穷（41.0–41.7）
  if (t < 41.7) {
    return P({
      from: 'sine',
      to: 'asymptote',
      p: span(t, 41.0, 41.7),
      stagger: 0.25,
      bulge: 0.5,
      toParams: { E: 0.02 },
      label: 'x → ∞',
    })
  }
  // ⑧ 画出 ∞（41.7–42.4）
  if (t < 42.4) {
    return P({
      from: 'asymptote',
      to: 'lemniscate',
      p: span(t, 41.7, 42.4),
      stagger: 0.3,
      bulge: 0.25,
      toParams: { a: 0.74, rot: 0 },
      fromParams: { E: 0.02 },
      label: 'lemniscate ∞',
    })
  }
  // ⑨ 被墙与 ε 带截住（42.4–44.0）
  const push = span(t, 42.5, 43.4)
  return P({
    from: 'lemniscate',
    to: 'lemniscate',
    p: 1,
    offsetX: push * 0.42,
    zoom: 1 - 0.04 * push,
    rotY: 0.02,
    bulge: 0,
    toParams: { a: 0.74, rot: 0 },
    fromParams: { a: 0.74, rot: 0 },
    label: 'blocked by wall x = L, ε-band',
  })
}

/* ---------------- 2D 辅助绘制 ---------------- */

function drawPlane(g, W, H, t) {
  g.save()
  g.strokeStyle = rgba(C.line, 0.32)
  g.lineWidth = 1
  const step = W / 16
  for (let x = 0; x <= W; x += step) {
    g.beginPath()
    g.moveTo(x, 0)
    g.lineTo(x, H)
    g.stroke()
  }
  for (let y = 0; y <= H; y += step * 0.5625) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  }
  // 坐标轴
  g.strokeStyle = rgba(C.fgDim, 0.5)
  g.lineWidth = 1.6
  g.beginPath()
  g.moveTo(0, H / 2)
  g.lineTo(W, H / 2)
  g.moveTo(W / 2, 0)
  g.lineTo(W / 2, H)
  g.stroke()
  g.restore()
}

const px = (W, H, x, y) => [W / 2 + x * (H / 2), H / 2 - y * (H / 2)]

function drawCircleOverlay(g, ctx, t, a, r) {
  const { W, H } = ctx
  const [cx, cy] = px(W, H, 0, 0)
  const rp = r * (H / 2)
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.fgDim, 0.5)
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(cx, cy, rp, 0, TAU)
  g.stroke()
  // 半径线
  g.strokeStyle = rgba(C.teal, 0.8)
  g.beginPath()
  g.moveTo(cx, cy)
  g.lineTo(cx + rp, cy)
  g.stroke()
  drawMath(g, cx + rp / 2, cy - 14, 'r', 22, { color: C.teal, align: 'center' })

  // 刻度：0:35.0 起逐格亮起
  const reveal = span(t, 35.0, 36.9)
  for (let i = 0; i < TICKS; i++) {
    const on = reveal > 0 && i / TICKS <= reveal
    const ang = -Math.PI / 2 + (i / TICKS) * TAU
    const x1 = cx + Math.cos(ang) * rp
    const y1 = cy + Math.sin(ang) * rp
    const x2 = cx + Math.cos(ang) * (rp + (on ? 16 : 8))
    const y2 = cy + Math.sin(ang) * (rp + (on ? 16 : 8))
    g.strokeStyle = on ? rgba(C.cyan, 0.95) : rgba(C.fgDim, 0.35)
    g.lineWidth = on ? 2.4 : 1
    g.beginPath()
    g.moveTo(x1, y1)
    g.lineTo(x2, y2)
    g.stroke()
    if (on && i % 3 === 0) {
      const label = i === 0 ? '0' : `${i}/12π`
      const lx = cx + Math.cos(ang) * (rp + 46)
      const ly = cy + Math.sin(ang) * (rp + 46)
      g.font = MONO(13, 600)
      g.fillStyle = rgba(C.cyan, 0.9)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(label, lx, ly)
    }
  }
  // 2πr 数值（真实计算）
  const c = 2 * Math.PI * r
  drawMath(g, cx, cy - rp - 62, `C = 2πr = ${c.toFixed(4)}  (r = ${r.toFixed(2)})`, 22, { color: C.fg, align: 'center' })
  g.restore()
}

function drawSineAxes(g, ctx, a) {
  const { W, H } = ctx
  const [x0] = px(W, H, -0.95, 0)
  const [x1] = px(W, H, 0.95, 0)
  const [, y0] = px(W, H, 0, 0)
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.fgDim, 0.45)
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(x0, y0)
  g.lineTo(x1, y0)
  g.stroke()
  // 正弦参考曲线
  g.strokeStyle = rgba(C.teal, 0.55)
  g.lineWidth = 1.4
  g.beginPath()
  for (let i = 0; i <= 120; i++) {
    const x = -0.92 + (1.84 * i) / 120
    const y = SINE_AMP * Math.sin(SINE_K * Math.PI * x)
    const [sx, sy] = px(W, H, x, y)
    i === 0 ? g.moveTo(sx, sy) : g.lineTo(sx, sy)
  }
  g.stroke()
  drawMath(g, x1 + 8, y0 + 6, 'y = sin x', 20, { color: C.teal })
  g.restore()
}

function drawTangents(g, ctx, t, a, sync) {
  const { W, H } = ctx
  const ons = sync.onsetsIn(38.7, 40.8)
  const M = Math.max(2, ons.length)
  g.save()
  g.globalAlpha = a
  for (let k = 0; k < M; k++) {
    const o = ons[k] || { t: 38.7 + k * 0.09 }
    const drop = span(t, o.t - 0.02, o.t + 0.16)
    if (drop <= 0) continue
    const x0 = -0.92 + (1.84 * (k + 0.5)) / M
    const y0 = SINE_AMP * Math.sin(SINE_K * Math.PI * x0)
    const slope = SINE_AMP * SINE_K * Math.PI * Math.cos(SINE_K * Math.PI * x0)
    const L = 0.34 * drop
    const inv = 1 / Math.hypot(1, slope)
    const dx = inv
    const dy = slope * inv
    const [ax, ay] = px(W, H, x0 - L * dx, y0 - L * dy)
    const [bx, by] = px(W, H, x0 + L * dx, y0 + L * dy)
    g.strokeStyle = rgba(k % 2 ? C.amber : C.gold, 0.55 + 0.45 * drop)
    g.lineWidth = 1 + 1.6 * drop
    g.beginPath()
    g.moveTo(ax, ay)
    g.lineTo(bx, by)
    g.stroke()
    const [mx, my] = px(W, H, x0, y0)
    g.fillStyle = C.cyan
    g.fillRect(mx - 2.5, my - 2.5, 5, 5)
    g.font = MONO(11, 600)
    g.fillStyle = rgba(C.amber, 0.9)
    g.textAlign = 'left'
    g.fillText(`k=${slope.toFixed(2)}`, bx + 4, by)
  }
  g.restore()
}

function drawWall(g, ctx, a, t, sync) {
  const { W, H } = ctx
  const L = WALL_L + 0.42
  const [wx] = px(W, H, L, 0)
  const [, yc] = px(W, H, 0, 0)
  const ePix = EPS * (H / 2)
  g.save()
  g.globalAlpha = a
  // ε 带
  g.fillStyle = rgba(C.green, 0.14)
  g.fillRect(0, yc - ePix, W, ePix * 2)
  g.strokeStyle = rgba(C.green, 0.7)
  g.setLineDash([6, 6])
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(0, yc - ePix)
  g.lineTo(W, yc - ePix)
  g.moveTo(0, yc + ePix)
  g.lineTo(W, yc + ePix)
  g.stroke()
  g.setLineDash([])
  // 墙
  const pulse = 0.75 + 0.25 * Math.abs(Math.sin(t * 5))
  g.fillStyle = rgba(C.red, 0.16 * pulse)
  g.fillRect(wx, 0, W - wx, H)
  g.strokeStyle = rgba(C.red, 0.95)
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(wx, 0)
  g.lineTo(wx, H)
  g.stroke()
  drawMath(g, wx + 14, 70, 'x = L', 26, { color: C.red })
  drawMath(g, W / 2 - 120, yc - ePix - 44, 'lim f(x) = M', 24, { color: C.green })
  drawMath(g, W / 2 - 120, yc + ePix + 52, '∀ε>0 ∃δ>0 : 0<|x−L|<δ ⇒ |f(x)−M|<ε', 18, { color: C.green })
  g.restore()
}
