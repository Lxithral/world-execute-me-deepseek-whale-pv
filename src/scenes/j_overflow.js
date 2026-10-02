// src/scenes/j_overflow.js — 段 J 2:09–2:27.9 溢出（纯器乐，红色段）
// DIRECTOR：底色转红警报；KV Cache 内存格：分配→标记→清扫→压缩，旁边滚动 hexdump；
// 窗口无限递归缩放；ctxAt 加速到 100%；2:25 全屏 context limit reached；2:26.5 黑场，
// 红字重新键入 dsh --resume；2:27.8 静默一帧。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, hexdump, nestedWindow, roundRect, ctxAt } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { kvSchedule } from '../lib/tables.js'

const RESUME = 'dsh --resume'
const KV_COLS = 16
const KV_ROWS = 6

export default {
  id: 'J',
  start: 129.0,
  end: 147.9,
  title: '溢出',
  fx: [
    { t: 129.0, kind: 'flash', amount: 0.6, dur: 0.18 },
    { t: 129.0, kind: 'glitch', amount: 0.5, dur: 0.3 },
    { t: 136.0, kind: 'shake', amount: 0.35, dur: 0.4 },
    { t: 140.0, kind: 'shake', amount: 0.5, dur: 0.4 },
    { t: 145.0, kind: 'flash', amount: 1.0, dur: 0.3 },
    { t: 145.0, kind: 'shake', amount: 0.9, dur: 0.8 },
    { t: 146.5, kind: 'glitch', amount: 0.8, dur: 0.3 },
  ],

  init() {
    this.kv = kvSchedule({ cells: KV_COLS * KV_ROWS, t0: 130.5, t1: 145.0, seed: 77 })
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const black = span(t, 146.5, 146.72)
    const quiet = t >= 147.75 && t < 147.9

    // 红警报底
    const alarm = span(t, 129.0, 131.0)
    const pct = ctxAt(t)
    const heat = clamp((pct - 20) / 80)
    const pulse = 0.5 + 0.5 * Math.sin(t * (3 + heat * 7))
    g.fillStyle = mixHex('#160a0c', '#3a0d10', 0.5 + 0.5 * heat)
    g.fillRect(0, 0, W, H)
    g.fillStyle = rgba(C.red, 0.05 + 0.12 * heat * pulse)
    g.fillRect(0, 0, W, H)
    g.fillStyle = rgba(C.red, 0.13)
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    if (!quiet) {
      // KV Cache 内存格
      drawKvGrid(g, ctx, t, this.kv, alarm)
      // hexdump
      const hdA = span(t, 130.6, 131.4) * (1 - span(t, 145.6, 146.4))
      if (hdA > 0.01) {
        g.save()
        g.globalAlpha = hdA
        hexdump(g, { x: W * 0.63, y: H * 0.30, w: W * 0.32, alpha: 0.9, rows: 16, scroll: t * 26, seed: 5, size: 13 })
        g.font = MONO(12, 600)
        g.fillStyle = C.red
        g.textAlign = 'left'
        g.textBaseline = 'top'
        g.fillText('kv-cache dump  (live)', W * 0.63, H * 0.27)
        g.restore()
      }
      // 窗口无限递归缩放
      drawRecursiveWindows(g, ctx, t, heat)
      // 进度与读数
      drawGauges(g, ctx, t, pct, heat)
    }

    // 2:25 全屏 context limit reached
    const limit = span(t, 144.9, 145.35) * (1 - span(t, 146.05, 146.5))
    if (limit > 0.01) {
      g.save()
      g.globalAlpha = limit
      g.fillStyle = 'rgba(0,0,0,0.72)'
      g.fillRect(0, 0, W, H)
      g.font = MONO(74, 700)
      g.fillStyle = C.red
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('context limit reached', W / 2, H * 0.46)
      g.font = MONO(24, 600)
      g.fillStyle = rgba(C.red, 0.85)
      g.fillText('the session is full.', W / 2, H * 0.56)
      g.restore()
    }

    // 2:26.5 黑场 + 红字重新键入 dsh --resume
    if (black > 0.01) {
      g.save()
      g.globalAlpha = black
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
      const s = typed(RESUME, t, { start: 147.0, cps: 12, seed: 3 })
      if (s) {
        g.font = MONO(46, 700)
        g.fillStyle = C.red
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        const x = W / 2 - 260
        g.fillText('> ' + s, x, H * 0.5)
        const wpx = g.measureText('> ' + s).width
        if (cursorOn(t, { hz: 1.1 })) {
          g.fillStyle = C.red
          g.fillRect(x + wpx + 4, H * 0.5 - 24, 14, 46)
        }
      }
      g.restore()
    }

    // 2:27.8 静默一帧：纯黑（下一段 K 从 147.9 无缝接上）
    if (quiet) {
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
    }
  },
}

/* ---------------- KV 内存格 ---------------- */
function drawKvGrid(g, ctx, t, kv, alarm) {
  const { W, H } = ctx
  const a = span(t, 130.4, 131.2) * (1 - span(t, 145.5, 146.3))
  if (a <= 0.01) return
  const x0 = W * 0.07
  const y0 = H * 0.30
  const cw = (W * 0.48) / KV_COLS
  const ch = (H * 0.42) / KV_ROWS
  g.save()
  g.globalAlpha = a
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText('KV cache · alloc → mark → sweep → compact', x0, y0 - 16)
  for (let i = 0; i < kv.length; i++) {
    const c = kv[i]
    const r = Math.floor(i / KV_COLS)
    const cc = i % KV_COLS
    const x = x0 + cc * cw
    const y = y0 + r * ch
    let color = 'rgba(40,44,52,0.9)'
    let label = ''
    if (t >= c.compactT) { color = 'rgba(28,74,52,0.95)'; label = 'C' }
    else if (t >= c.sweepT) { color = 'rgba(80,60,20,0.95)'; label = 'S' }
    else if (t >= c.markT) { color = 'rgba(120,40,40,0.95)'; label = 'M' }
    else if (t >= c.allocT) { color = 'rgba(30,60,90,0.95)'; label = 'A' }
    roundRect(g, x + 2, y + 2, cw - 4, ch - 4, 3)
    g.fillStyle = color
    g.fill()
    g.strokeStyle = rgba(C.red, 0.25 * alarm)
    g.lineWidth = 1
    g.stroke()
    if (label && cw > 22) {
      g.font = MONO(10, 700)
      g.fillStyle = rgba(C.fg, 0.75)
      g.fillText(label, x + 7, y + ch / 2 + 4)
    }
  }
  // 图例
  g.font = MONO(11, 500)
  g.fillStyle = rgba(C.fgDim, 0.85)
  const ly = y0 + KV_ROWS * ch + 22
  const legend = [['A alloc', '#1e3c5a'], ['M mark', '#782828'], ['S sweep', '#503c14'], ['C compact', '#1c4a34']]
  legend.forEach(([txt, col], i) => {
    g.fillStyle = col
    g.fillRect(x0 + i * 130, ly - 9, 14, 11)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.fillText(txt, x0 + i * 130 + 20, ly)
  })
  g.restore()
}

/* ---------------- 无限递归窗口 ---------------- */
function drawRecursiveWindows(g, ctx, t, heat) {
  const { W, H } = ctx
  const a = span(t, 131.6, 132.4) * (1 - span(t, 145.0, 145.8))
  if (a <= 0.01) return
  const n = 7
  const cx = W / 2
  const cy = H * 0.52
  g.save()
  for (let k = 0; k < n; k++) {
    const u = k / n
    const w = W * 0.86 * (1 - u * 0.72)
    const h = H * 0.82 * (1 - u * 0.72)
    g.globalAlpha = a * (0.10 + u * 0.35)
    nestedWindow(g, { x: cx - w / 2, y: cy - h / 2, w, h, depth: k, alpha: 1, label: k === 0 ? 'session #001' : '' })
  }
  g.restore()
}

/* ---------------- 进度与读数 ---------------- */
function drawGauges(g, ctx, t, pct, heat) {
  const { W, H, sync } = ctx
  const a = span(t, 129.0, 129.6)
  if (a <= 0.01) return
  g.save()
  g.globalAlpha = a
  // 上下文占用（真实 ctxAt）
  const bw = W * 0.30
  const bx = W * 0.07
  const by = H * 0.10
  g.font = MONO(15, 700)
  g.fillStyle = C.red
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(`context ${pct.toFixed(0)}%`, bx, by - 8)
  roundRect(g, bx, by, bw, 18, 4)
  g.fillStyle = 'rgba(20,22,26,0.9)'
  g.fill()
  roundRect(g, bx, by, Math.max(4, bw * clamp(pct / 100)), 18, 4)
  g.fillStyle = pct > 92 ? C.red : C.amber
  g.fill()
  if (pct > 92) {
    g.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 9)))
    roundRect(g, bx, by, bw, 18, 4)
    g.strokeStyle = C.red
    g.lineWidth = 2
    g.stroke()
  }
  // 内存读数（真实：由 ctxAt 与 rms 计算）
  g.globalAlpha = a
  g.font = MONO(13, 500)
  g.fillStyle = rgba(C.fgDim, 0.9)
  g.textAlign = 'right'
  g.fillText(
    `kv ${(pct * 0.42).toFixed(1)} GB   growth ${(1.2 + sync.rmsAt(t) * 6).toFixed(2)} GB/s   heat ${(heat * 100).toFixed(0)}%`,
    bx + bw,
    by + 44
  )
  g.restore()
}
