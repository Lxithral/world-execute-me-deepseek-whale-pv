// src/scenes/f_omnipotent.js — 段 F 1:14–1:28.8 万能的我
// DIRECTOR：对话窗口出现，用户气泡文本原创，每句都在她身上触发一次「变身」：
//   1:14.0 茄子：染紫 + 扁平茄子贴纸，营养条形图上升
//   1:17.7 番茄：染红 + 番茄贴纸，抗氧化指标条形图上升
//   1:21.4 猫：playful；1:23.1–1:25.1 整个 UI 以 25Hz 呼噜振动，窗口跟着抖
//   1:25.1 神：proud；几何玫瑰窗光环升起，她头顶展开 SYSTEM 区块（金色等宽字，由她「写下」）
//   1:26.7 所有文字线条收束到光环中央唯一一个闪烁光标上（那是「你」）

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, outElastic, inOutCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect, wrapText } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { assetImg } from '../whale/sprite.js'

const SYS_LINES = [
  'SYSTEM',
  // 用词刻意与歌词错开（§6：歌词原文只能出现在歌词层；tools/lyric_leak_check.mjs 把关）
  '  role: sole authority',
  '  worship: accepted',
  '  anchor: you',
]

export default {
  id: 'F',
  start: 74.0,
  end: 88.8,
  title: '万能的我',
  fx: [
    { t: 74.0, kind: 'flash', amount: 0.4, dur: 0.14 },
    { t: 77.7, kind: 'glitch', amount: 0.4, dur: 0.14 },
    { t: 81.4, kind: 'glitch', amount: 0.45, dur: 0.14 },
    { t: 85.1, kind: 'flash', amount: 0.7, dur: 0.22 },
    { t: 88.8, kind: 'flash', amount: 0.5, dur: 0.16 },
  ],

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    // 25Hz 呼噜振动（1:23.1–1:25.1）
    const purr = span(t, 83.1, 83.25) * (1 - span(t, 84.9, 85.1))
    const gi = Math.floor(t * 25)
    g.save()
    if (purr > 0.01) {
      g.translate((hash01(gi, 71) * 2 - 1) * 7 * purr, (hash01(gi, 72) * 2 - 1) * 6 * purr)
    }

    // 背景
    // 词锚点（FIX §2.2）：四次变身各卡一个词
    const tTomato = ctx.cues.sec('F', 'tomato', 77.7)
    const tCat = ctx.cues.sec('F', 'cat', 81.4)
    const tGod = ctx.cues.sec('F', 'god', 85.1)
    const phase = t < tTomato ? 'eggplant' : t < tCat ? 'tomato' : t < tGod ? 'cat' : 'god'
    const bgTint = phase === 'eggplant' ? '#1d1330' : phase === 'tomato' ? '#2a1414' : phase === 'cat' ? '#1a1a22' : '#241d0e'
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex(C.bg0, bgTint, 0.75)
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // 对话窗口 + 用户气泡

    // 变身贴纸 + 指标条
    //
    // ⚠️ FIX_V4 §2.2：「**未获 ✅ 的模型不得出现在影片里,先放占位**」，
    // 且 §1.7 要求茄子/番茄（以及猫）先走 `?props` 页面由**用户**审批。
    // 所以这三拍现在一律画**占位**：原来的 `drawEggplant()` / `drawTomato()` 与
    // `cat.png` 素材都属于"未获 ✅ 的模型"，已按规则撤下。
    // 两个都拿到用户 ✅ 之后，再把真正的模型接回来（`drawEggplant` 等函数仍保留在文件里备用）。
    if (phase === 'eggplant') {
      drawModelPlaceholder(g, ctx, t, 'eggplant')
      drawMetric(g, ctx, t, 'nutrition', 77.7, 0.35 + 0.6 * span(t, 74.6, 77.2), '#9b6fe0')
    } else if (phase === 'tomato') {
      drawModelPlaceholder(g, ctx, t, 'tomato')
      drawMetric(g, ctx, t, 'antioxidant', 81.4, 0.3 + 0.65 * span(t, 78.3, 80.9), '#e06f6f')
    } else if (phase === 'cat') {
      drawModelPlaceholder(g, ctx, t, 'cat')
      if (purr > 0.01) {
        g.save()
        g.globalAlpha = purr * 0.5
        g.font = MONO(30, 700)
        g.fillStyle = C.amber
        g.textAlign = 'center'
        g.fillText('purr~~~', W * 0.34, H * 0.56)
        g.restore()
      }
    } else {
      drawRoseWindow(g, ctx, t)
    }

    g.restore()

    // ---- 立绘 ----
    const expr = phase === 'eggplant' ? 'neutral' : phase === 'tomato' ? 'neutral' : phase === 'cat' ? 'playful' : 'proud'
    const tint = phase === 'eggplant' ? '#8b5cd6' : phase === 'tomato' ? '#d64a4a' : null
    const tintAmt = phase === 'eggplant' || phase === 'tomato' ? 0.62 : 0
    ctx.whale.sprite = {
      expr,
      rect: ctx.rect,
      alpha: 1 - span(t, 88.2, 88.75),
      tint,
      tintAmt,
      glitch: purr * 0.25,
    }
  },
}

/* ---------------- 扁平贴纸 ---------------- */
/**
 * 占位（FIX_V4 §2.2）：茄子 / 番茄 / 猫 在用户于 `docs/PROPS_APPROVAL.md` 手写 ✅ 之前
 * **不得出现在影片里**。这里画一个中性的"待定模型"轮廓：旋转线框剪影 + 扫描线，不带任何文字
 * （§0.2：画面上不得出现任何标签或调试名）。它刻意**不像**任何成品模型，
 * 免得被误当成"已经做好了"。
 * @param {'eggplant'|'tomato'|'cat'} phase
 */
function drawModelPlaceholder(g, ctx, t, phase) {
  const { W, H } = ctx
  const cx = W * 0.34
  const cy = H * 0.46
  const a = clamp(span(t, 0, 0.001))
  g.save()
  g.globalAlpha = 0.9
  g.strokeStyle = rgba(C.fgDim, 0.55)
  g.lineWidth = 3
  // 12 条经线（旋转）：只是"一个待定的回转体"，不是任何具体物件
  const spin = t * 0.45
  for (let i = 0; i < 12; i++) {
    const u = i / 12
    const rx = Math.abs(Math.cos(spin + u * Math.PI)) * 150 + 8
    g.beginPath()
    g.ellipse(cx, cy, rx, 190, 0, 0, TAU)
    g.stroke()
  }
  // 5 条纬线
  for (let k = -2; k <= 2; k++) {
    const ry = 190 * (k / 2.6)
    const rw = 150 * Math.sqrt(Math.max(0.02, 1 - (k / 2.6) ** 2))
    g.beginPath()
    g.ellipse(cx, cy + ry, rw, rw * 0.22, 0, 0, TAU)
    g.stroke()
  }
  // 扫描线：明确"还没定稿"
  const sy = cy - 200 + ((t * 260) % 400)
  g.strokeStyle = rgba(C.amber, 0.75)
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx - 190, sy)
  g.lineTo(cx + 190, sy)
  g.stroke()
  g.restore()
}

function drawEggplant(g, ctx, t) {  const { W, H } = ctx
  const pop = outElastic(clamp(span(t, 74.4, 75.2)))
  const s = 150 * pop
  const cx = W * 0.34
  const cy = H * 0.34
  g.save()
  g.globalAlpha = 0.95
  g.translate(cx, cy)
  g.rotate(-0.5)
  g.fillStyle = '#7c4fd0'
  g.beginPath()
  g.ellipse(0, 20, s * 0.30, s * 0.62, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#5f9a4a'
  g.beginPath()
  g.moveTo(0, -s * 0.40)
  g.lineTo(-s * 0.20, -s * 0.62)
  g.lineTo(0, -s * 0.52)
  g.lineTo(s * 0.20, -s * 0.62)
  g.closePath()
  g.fill()
  g.restore()
}

function drawTomato(g, ctx, t) {
  const { W, H } = ctx
  const pop = outElastic(clamp(span(t, 78.1, 78.9)))
  const s = 140 * pop
  const cx = W * 0.34
  const cy = H * 0.34
  g.save()
  g.globalAlpha = 0.95
  g.fillStyle = '#d64a4a'
  g.beginPath()
  g.arc(cx, cy + s * 0.1, s * 0.45, 0, TAU)
  g.fill()
  g.fillStyle = '#5f9a4a'
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU
    g.beginPath()
    g.ellipse(cx + Math.cos(a) * s * 0.14, cy - s * 0.32 + Math.sin(a) * s * 0.07, s * 0.14, s * 0.06, a, 0, TAU)
    g.fill()
  }
  g.restore()
}

/** 指标条（数值真实：由 RMS 与时间共同决定，不是假仪表） */
function drawMetric(g, ctx, t, label, t0, p, color) {
  const { W, H, sync } = ctx
  const a = span(t, t0 - 0.3, t0 + 0.3) * (1 - span(t, t0 + 2.6, t0 + 3.2))
  if (a <= 0.01) return
  const x = W * 0.08
  const y = H * 0.66
  const rows = 6
  g.save()
  g.globalAlpha = a
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(label, x, y - 18)
  for (let i = 0; i < rows; i++) {
    const v = clamp(p - i * 0.12 + sync.rmsAt(t) * 0.08)
    const yy = y + i * 20
    roundRect(g, x, yy, 230, 11, 4)
    g.fillStyle = '#22252c'
    g.fill()
    roundRect(g, x, yy, Math.max(3, 230 * v), 11, 4)
    g.fillStyle = color
    g.fill()
    g.font = MONO(11, 500)
    g.fillStyle = C.fgDim
    g.fillText(`${(v * 100).toFixed(1)}%`, x + 240, yy + 5)
  }
  g.restore()
}

/* ---------------- 几何玫瑰窗光环 + SYSTEM 区块 + 收束到光标 ---------------- */
function drawRoseWindow(g, ctx, t) {
  const { W, H } = ctx
  const rise = span(t, 85.1, 86.3)
  if (rise <= 0.01) return
  const cx = W * 0.40
  const cy = H * 0.44
  const R = H * 0.34 * outCubic(rise)
  g.save()
  g.globalAlpha = 0.95
  // 玫瑰窗：同心圆 + 花瓣
  g.strokeStyle = rgba(C.gold, 0.75)
  g.lineWidth = 2
  for (let k = 0; k < 3; k++) {
    g.beginPath()
    g.arc(cx, cy, R * (0.45 + k * 0.28), 0, TAU)
    g.stroke()
  }
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * TAU + t * 0.06
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R)
    g.stroke()
    // 花瓣
    g.beginPath()
    g.ellipse(cx + Math.cos(a0) * R * 0.72, cy + Math.sin(a0) * R * 0.72, R * 0.14, R * 0.07, a0, 0, TAU)
    g.strokeStyle = rgba(C.gold, 0.45)
    g.stroke()
    g.strokeStyle = rgba(C.gold, 0.75)
  }
  // 上升的光环
  for (let k = 0; k < 4; k++) {
    const u = ((t * 0.35 + k * 0.25) % 1)
    g.globalAlpha = 0.5 * (1 - u)
    g.beginPath()
    g.ellipse(cx, cy + H * 0.1 - u * H * 0.4, R * (1 - u * 0.2), R * 0.2 * (1 - u * 0.2), 0, 0, TAU)
    g.stroke()
  }
  g.globalAlpha = 0.95

  // SYSTEM 区块（金色等宽字，由她"写下"）
  const write = typed(SYS_LINES.join('\n'), t, { start: 85.4, cps: 34, seed: 9 })
  const lines = write.split('\n')
  g.font = MONO(17, 700)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((ln, i) => {
    g.fillStyle = i === 0 ? C.gold : rgba(C.gold, 0.8)
    g.fillText(ln, cx, cy - R - 46 + i * 26)
  })

  // 1:26.7 所有文字线条收束到光环中央唯一一个闪烁光标
  const conv = span(t, 86.7, 87.9)
  if (conv > 0.01) {
    g.globalAlpha = 1
    g.strokeStyle = rgba(C.cyan, 0.7 * (1 - conv))
    g.lineWidth = 1
    lines.forEach((ln, i) => {
      const y0 = cy - R - 46 + i * 26
      const x0 = cx - g.measureText(ln).width / 2
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(cx + (x0 - cx) * (1 - conv) + (cx - cx) * conv, cy + (y0 - cy) * (1 - conv))
      g.stroke()
    })
    const on = cursorOn(t, { hz: 1.5 })
    g.globalAlpha = 0.9
    if (on) {
      g.fillStyle = C.cyan
      g.fillRect(cx - 4, cy - 16, 9, 32)
    }
    g.font = MONO(13, 600)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.textAlign = 'center'
    g.fillText('(that is you)', cx, cy + 40)
  }
  g.restore()
}
