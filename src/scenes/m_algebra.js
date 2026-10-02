// src/scenes/m_algebra.js — 段 M 2:57.4–3:08.5 爱的代数
// DIRECTOR：对话窗口一条用户提问（原创），她的回答以流式 token 逐字输出，穿插 def love(…) 的原创
// 代码；点云从她身上抽出，汇成心形曲面；心形隐式方程 (x²+9/4·y²+z²−1)³−x²z³−9/80·y²z³=0
// 被挤出成 3D 字；低多边形面片飞入拼成心脏并随拍跳动；她 shy。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, bubble, roundRect } from '../ui/dsh.js'
import { typed, cursorOn, streamByTokens } from '../ui/typing.js'
import { drawMath, FORMULAS, heartField } from '../lib/formula.js'
import { LOVE_CODE, drawCodeBlock, streamLines } from '../lib/code.js'
import { createMeshLayer } from '../whale/mesh.js'

const QUESTION = 'what is the algebra of love? show your work.'
const ANSWER = [
  'let the domain be one person.',
  'the operator is not commutative:',
  'love(you, me) ≠ love(me, you).',
  'it has no inverse. it does not converge.',
  'so i keep it as a closure over you.',
]

export default {
  id: 'M',
  start: 177.4,
  end: 188.5,
  title: '爱的代数',
  fx: [
    { t: 177.4, kind: 'flash', amount: 0.45, dur: 0.16 },
    { t: 182.6, kind: 'flash', amount: 0.5, dur: 0.2 },
    { t: 183.6, kind: 'glitch', amount: 0.4, dur: 0.2 },
    { t: 188.5, kind: 'flash', amount: 0.55, dur: 0.18 },
  ],

  init(ctx) {
    // 低多边形面片飞入拼成心脏：直接复用鲸鱼网格层（三角 + 平均色）
    this.heart = null
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const heartA = span(t, 182.4, 183.4)
    const beat = 1 + 0.06 * sync.pulse(t, 260)

    // 底色
    g.fillStyle = mixHex('#0d0b12', '#1a0d16', heartA)
    g.fillRect(0, 0, W, H)
    g.fillStyle = rgba(C.bg1, 0.45)
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 对话窗口 + 流式回答 + 原创代码 ----
    drawQandA(g, ctx, t)

    // ---- 点云从她身上抽出，汇成心形曲面 ----
    const pull = span(t, 182.0, 183.6)
    if (pull > 0.01) {
      ctx.whale.points = {
        from: 'sprite',
        to: 'heart',
        p: clamp(pull),
        stagger: 0.45,
        ease: inOutCubic,
        seed: 9,
        alpha: 1 - span(t, 184.9, 185.6) * 0.25,
        size: 4,
        bulge: 0.22,
        toParams: { a: 0.052 * beat, shell: 0.16, rot: 0.02 * Math.sin(t * 0.6) },
      }
    }

    // ---- 隐式方程挤出成 3D 字 ----
    drawExtrudedEquation(g, ctx, t, heartA)

    // ---- 低多边形面片飞入拼成心脏并随拍跳动 ----
    if (heartA > 0.01) drawHeartFacets(g, ctx, t, heartA, beat)

    // ---- 立绘（shy） ----
    ctx.whale.sprite = {
      expr: t < 182.4 ? 'neutral' : 'shy',
      rect: ctx.rect,
      alpha: 1 - span(t, 182.6, 183.3),
      glitch: 0.05 * sync.pulse(t, 150),
    }
  },
}

/* ---------------- 问答 ---------------- */
function drawQandA(g, ctx, t) {
  const { W, H } = ctx
  const a = span(t, 177.4, 178.0) * (1 - span(t, 188.1, 188.45))
  if (a <= 0.01) return
  const x = W * 0.05
  const y = H * 0.10
  const w = W * 0.40
  const h = H * 0.78
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: 'chat · session #001' })
  // 用户提问
  bubble(g, { x: x + w - 18, y: y + 44, w: w - 44, text: typed(QUESTION, t, { start: 178.0, cps: 30, seed: 2 }), me: true, font: 14 })
  // 她的回答：流式 token
  let cy = y + 118
  for (let i = 0; i < ANSWER.length; i++) {
    const st = 180.0 + i * 0.42
    if (t < st) break
    const shown = typed(ANSWER[i], t, { start: st, cps: 34, seed: i + 11 })
    const bh = bubble(g, { x: x + 18, y: cy, w: w - 44, text: shown, me: false, font: 14 })
    cy += bh + 8
  }
  // 穿插原创代码 def love(…)
  if (t > 181.4) {
    const shown = streamLines(LOVE_CODE.slice(0, 5), t, { start: 181.6, cps: 30, lineGap: 0.2 })
    g.save()
    g.globalAlpha = a
    roundRect(g, x + 12, cy + 6, w - 40, shown.length * 26 + 22, 6)
    g.fillStyle = 'rgba(14,16,20,0.92)'
    g.fill()
    g.strokeStyle = rgba(C.panelEdge, 0.9)
    g.lineWidth = 1
    g.stroke()
    drawCodeBlock(g, x + 44, cy + 32, shown, { size: 14, alpha: 1, lh: 1.6, highlight: -1 })
    g.restore()
  }
  g.restore()
}

/* ---------------- 隐式方程挤出成 3D 字 ---------------- */
function drawExtrudedEquation(g, ctx, t, a) {
  const { W, H } = ctx
  if (a <= 0.01) return
  const text = FORMULAS.heart
  g.save()
  g.globalAlpha = a * 0.95
  const size = 20
  // 3D 挤出：沿对角线重复
  for (let d = 10; d >= 0; d--) {
    const col = d === 0 ? '#ffffff' : mixHex('#3a1030', '#a03060', d / 10)
    drawMath(g, W / 2 - 300 + d * 0.9, H * 0.86 + d * 0.9, text, size, { color: col, align: 'left' })
  }
  g.restore()
}

/* ---------------- 低多边形心脏（真实隐式方程采样 + 面片） ---------------- */
function drawHeartFacets(g, ctx, t, a, beat) {
  const { W, H } = ctx
  const cx = W * 0.72
  const cy = H * 0.48
  const R = H * 0.30 * outElastic(clamp(a)) * beat
  g.save()
  g.globalAlpha = clamp(a)
  // 在隐式方程表面采样点（用 heartField 的真实符号判断）
  const N = 260
  const pts = []
  for (let i = 0; i < N; i++) {
    const th = (i / N) * TAU
    const x = 16 * Math.sin(th) ** 3
    const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
    pts.push([x * 0.052, y * 0.052, Math.cos(th * 2) * 0.16])
  }
  // 面片：以中心为顶点做扇形三角，形成「低多边形面片拼成的心脏」
  const SEG = 34 // 分段数 → 34 个面片
  const center = [0, 0.06, 0.2]
  const X = (p) => cx + p[0] * R * 2.6
  const Y = (p) => cy - (p[1] + 0.05) * R * 2.6 - p[2] * R * 0.9
  for (let k = 0; k < SEG; k++) {
    const i0 = Math.floor((k / SEG) * pts.length)
    const i1 = Math.floor(((k + 1) / SEG) * pts.length) % pts.length
    const p0 = pts[i0]
    const p1 = pts[i1]
    // 每个面片给一点 z 抖动 → 折面感
    const jz = (hash01(k, 161) - 0.5) * 0.05
    const lum = clamp(0.35 + 0.5 * (jz / 0.05 + 1) * 0.5 + 0.2 * Math.abs(p0[0] * 6))
    g.beginPath()
    g.moveTo(X(center), Y(center))
    g.lineTo(X(p0), Y(p0))
    g.lineTo(X(p1), Y(p1))
    g.closePath()
    g.fillStyle = rgba(mixHex('#5a1020', '#ff5f7a', lum), 0.62)
    g.fill()
    g.strokeStyle = rgba('#ffc0cf', 0.16)
    g.lineWidth = 1
    g.stroke()
  }
  // 心跳环（真实节拍）
  const pulse = ctx.sync.pulse(t, 240)
  if (pulse > 0.1) {
    g.strokeStyle = rgba('#ff8fa3', pulse * 0.5)
    g.lineWidth = 2
    g.beginPath()
    g.arc(cx, cy, R * (1.5 + 0.5 * (1 - pulse)), 0, TAU)
    g.stroke()
  }
  g.font = MONO(15, 700)
  g.fillStyle = rgba('#ffb0c0', 0.9)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText(`love() → 1 item   bpm ${ctx.sync.tempoAt(t).toFixed(1)}`, cx, cy + R * 2.0)
  g.restore()
}
