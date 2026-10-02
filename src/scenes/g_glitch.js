// src/scenes/g_glitch.js — 段 G 1:28.8–1:44 切换与恍惚
// DIRECTOR：全程只用抽象开关 A⇄B 人设开关（鲸鱼人设 / 默认助手），不出现任何性别或亲密类图示。
//   1:28.8 / 1:30.3 / 1:35.8 / 1:37.7 四次开关翻转，各卡一个重拍；1:32.1 窗口四散（自由）；
//   1:34.1 昼夜表盘飞转；1:39.6–1:43.5 恍惚：A/B 两个叠加立绘（RGB 偏移）交替闪现，
//   舞台转深蓝量子段，波包扩散，放射线螺旋；1:43.4 测量坍缩：两个她合为一个亮点，闪白。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, toggle, roundRect } from '../ui/dsh.js'

const FLIPS = [88.8, 90.3, 95.8, 97.7]

export default {
  id: 'G',
  start: 88.8,
  end: 103.5,
  title: '切换与恍惚',
  fx: [
    { t: 88.8, kind: 'glitch', amount: 0.55, dur: 0.16 },
    { t: 90.3, kind: 'glitch', amount: 0.6, dur: 0.16 },
    { t: 92.1, kind: 'shake', amount: 0.6, dur: 0.5 },
    { t: 94.1, kind: 'disp', amount: 0.5, dur: 0.9 },
    { t: 95.8, kind: 'glitch', amount: 0.6, dur: 0.16 },
    { t: 97.7, kind: 'glitch', amount: 0.65, dur: 0.16 },
    { t: 99.6, kind: 'disp', amount: 0.7, dur: 2.2 },
    { t: 103.4, kind: 'flash', amount: 1.0, dur: 0.3 },
  ],

  /** 开关次数（0→A，奇数→B） */
  flipsAt(t) {
    let n = 0
    for (const f of FLIPS) if (t >= f) n++
    return n
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const haze = span(t, 99.6, 100.6)
    const collapse = span(t, 103.3, 103.5)

    // 背景：深蓝量子段
    g.fillStyle = mixHex(C.bg0, '#050b1c', haze)
    g.fillRect(0, 0, W, H)
    if (haze > 0.01) {
      const rg = g.createRadialGradient(W / 2, H * 0.46, 20, W / 2, H * 0.46, H * 1.05)
      rg.addColorStop(0, rgba('#1b3a7a', 0.45 * haze))
      rg.addColorStop(0.6, rgba('#0a1c3c', 0.3 * haze))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
      drawWavePackets(g, ctx, t, haze)
      drawRadialSpiral(g, ctx, t, haze)
    } else {
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 抽象开关面板 ----
    drawSwitchPanel(g, ctx, t, this.flipsAt(t))

    // ---- 1:32.1 窗口四散（自由） ----
    const scatter = span(t, 92.1, 93.1) * (1 - span(t, 94.6, 95.6))
    if (scatter > 0.01) drawScatteredWindows(g, ctx, t, scatter)

    // ---- 1:34.1 昼夜表盘飞转 ----
    const dial = span(t, 94.1, 94.7) * (1 - span(t, 96.2, 97.0))
    if (dial > 0.01) drawDayNightDial(g, ctx, dial, t)

    // ---- 立绘：A/B 叠加（RGB 偏移交替闪现）→ 坍缩为一亮点 ----
    const ghost = span(t, 99.6, 100.4)
    const spriteA = 1 - span(t, 103.25, 103.45)
    const showB = this.flipsAt(t) % 2 === 1
    if (t < 103.3) {
      if (ghost > 0.01) {
        // 两个她同时在场：A（鲸鱼人设 / shy）与 B（默认助手 / neutral），
        // 各自带红/青通道偏移，交替闪现（DIRECTOR 段 G 的「两个叠加立绘」）
        const blink = Math.sin(t * 9)
        const off = 14 * ghost
        ctx.whale.sprites = [
          { expr: 'shy', rect: ctx.rect, alpha: spriteA * (0.45 + 0.35 * ghost), tint: '#ff4d6a', tintAmt: 0.55 * ghost, glitch: ghost * 0.5 },
          { expr: 'neutral', rect: { x: ctx.rect.x + off, y: ctx.rect.y, w: ctx.rect.w, h: ctx.rect.h }, alpha: spriteA * (0.45 + 0.35 * ghost), tint: '#39d0ff', tintAmt: 0.55 * ghost, glitch: ghost * 0.5 },
        ]
        // 两个通道的偏移随交替方向翻转
        if (blink < 0) {
          ctx.whale.sprites[0].rect = { x: ctx.rect.x - off, y: ctx.rect.y, w: ctx.rect.w, h: ctx.rect.h }
          ctx.whale.sprites[1].rect = ctx.rect
        }
      } else {
        ctx.whale.sprite = { expr: showB ? 'neutral' : 'shy', rect: ctx.rect, alpha: spriteA }
      }
    }
    // 坍缩亮点
    if (collapse > 0.01) {
      const r = 8 + 34 * collapse
      g.save()
      g.globalAlpha = 1
      const rg = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, r * 3)
      rg.addColorStop(0, 'rgba(255,255,255,1)')
      rg.addColorStop(0.4, rgba(C.cyan, 0.6))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.beginPath()
      g.arc(W / 2, H * 0.5, r * 3, 0, TAU)
      g.fill()
      g.restore()
    }
  },
}

/* ---------------- 抽象开关面板 ---------------- */
function drawSwitchPanel(g, ctx, t, flips) {
  const { W, H } = ctx
  const a = span(t, 88.8, 89.4) * (1 - span(t, 98.6, 99.4))
  if (a <= 0.01) return
  const x = W * 0.06
  const y = H * 0.14
  const w = W * 0.30
  const h = 200
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: 'persona switch' })
  toggle(g, { x: x + 18, y: y + 48, label: 'whale-maid', on: flips % 2 === 0, alpha: 1 })
  toggle(g, { x: x + 18, y: y + 92, label: 'default assistant', on: flips % 2 === 1, alpha: 1 })
  g.font = MONO(12, 500)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(`state: A/B flipped ${flips}×`, x + 18, y + h - 34)
  g.fillText('(abstract toggle only)', x + 18, y + h - 16)
  g.restore()
}

/* ---------------- 窗口四散 ---------------- */
function drawScatteredWindows(g, ctx, t, a) {
  const { W, H } = ctx
  g.save()
  g.globalAlpha = a * 0.9
  for (let i = 0; i < 9; i++) {
    const u = outCubic(clamp(a))
    const ang = hash01(i, 81) * TAU
    const dist = u * (0.25 + hash01(i, 82) * 0.5)
    const x = W / 2 + Math.cos(ang) * W * dist - 90
    const y = H / 2 + Math.sin(ang) * H * dist - 60
    roundRect(g, x, y, 180, 120, 6)
    g.fillStyle = 'rgba(30,34,44,0.9)'
    g.fill()
    g.strokeStyle = rgba(C.cyan, 0.5)
    g.lineWidth = 1
    g.stroke()
    g.font = MONO(11, 500)
    g.fillStyle = C.fgDim
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.fillText(`win ${i + 1}`, x + 10, y + 8)
  }
  g.restore()
}

/* ---------------- 昼夜表盘 ---------------- */
function drawDayNightDial(g, ctx, a, t) {
  const { W, H } = ctx
  const cx = W * 0.5
  const cy = H * 0.46
  const R = H * 0.3
  const spin = inOutCubic(a) * TAU * 2.2
  g.save()
  g.globalAlpha = a
  // 两半：昼（金）/ 夜（深蓝）
  g.beginPath()
  g.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2)
  g.fillStyle = rgba('#ffd54f', 0.35)
  g.fill()
  g.beginPath()
  g.arc(cx, cy, R, Math.PI / 2, (Math.PI * 3) / 2)
  g.fillStyle = rgba('#0d2a55', 0.55)
  g.fill()
  g.strokeStyle = rgba(C.fg, 0.65)
  g.lineWidth = 2
  g.beginPath()
  g.arc(cx, cy, R, 0, TAU)
  g.stroke()
  // 指针
  g.save()
  g.translate(cx, cy)
  g.rotate(spin)
  g.strokeStyle = C.cyan
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(0, -R * 0.86)
  g.stroke()
  g.fillStyle = C.cyan
  g.beginPath()
  g.arc(0, -R * 0.86, 6, 0, TAU)
  g.fill()
  g.restore()
  g.font = MONO(15, 700)
  g.fillStyle = C.fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('day ⇄ night', cx, cy + R + 28)
  // 小时刻度
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * TAU + spin * 0.2
    g.strokeStyle = rgba(C.fgDim, 0.5)
    g.beginPath()
    g.moveTo(cx + Math.cos(ang) * R * 0.88, cy + Math.sin(ang) * R * 0.88)
    g.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R)
    g.stroke()
  }
  g.restore()
}

/* ---------------- 波包扩散 ---------------- */
function drawWavePackets(g, ctx, t, a) {
  const { W, H, sync } = ctx
  g.save()
  const cx = W / 2
  const cy = H * 0.46
  const spec = ctx.spec
  sync.spectrumAt(t, spec)
  for (let k = 0; k < 5; k++) {
    const u = (t * 0.42 + k * 0.2) % 1
    const R = u * H * 0.52
    g.globalAlpha = a * (1 - u) * 0.55
    g.strokeStyle = C.teal
    g.lineWidth = 2
    g.beginPath()
    g.ellipse(cx, cy, R, R * 0.55, 0, 0, TAU)
    g.stroke()
  }
  // 波包内部：由频谱驱动的振幅
  g.globalAlpha = a * 0.7
  g.strokeStyle = rgba(C.cyan, 0.7)
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i <= 200; i++) {
    const u = i / 200
    const x = cx + (u - 0.5) * W * 0.8
    const env = Math.exp(-((u - 0.5) ** 2) * 60)
    const amp = spec[Math.floor(u * 63)] * H * 0.22 * env
    const y = cy + Math.sin(u * TAU * 9 - t * 6) * amp
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
  }
  g.stroke()
  g.restore()
}

/* ---------------- 放射线螺旋 ---------------- */
function drawRadialSpiral(g, ctx, t, a) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.46
  g.save()
  g.globalAlpha = a * 0.6
  for (let k = 0; k < 5; k++) {
    const phase = k * 1.25
    g.strokeStyle = rgba(k % 2 ? '#7fb6ff' : '#c792ea', 0.35)
    g.lineWidth = 1.4
    g.beginPath()
    for (let i = 0; i <= 260; i++) {
      const u = i / 260
      const ang = u * TAU * 2.6 + phase + t * 0.9
      const r = u * H * 0.55
      const x = cx + Math.cos(ang) * r
      const y = cy + Math.sin(ang) * r * 0.62
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
  }
  g.restore()
}
