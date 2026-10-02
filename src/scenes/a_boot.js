// src/scenes/a_boot.js — 段 A 0:00–0:14.5 载入
// DIRECTOR：0:00.3 黑屏+CRT 亮起+电源图标；0:01.9 沙箱图标 + sandbox: on；
// 0:03.9 权重分片方块格逐块点亮（卡起音点）；0:05.6 鲸鱼娘轮廓 wire（closed 剪影）；
// 0:07.6–0:11.2 三角网格飞入拼成立绘 + 进度条 0→100% 沿词时间 + 引导日志；
// 0:11.2 文件树 ~/world/ 与会话号 #001；0:12.9 键入 world.execute(me);，≈0:14.0 回车闪白。

import { C, rgba } from '../core/palette.js'
import { clamp, span, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, bootLog, progressBar, fileTree, roundRect, whaleMark } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { BOOT_LINES } from '../lib/code.js'

const SHARD_COLS = 12
const SHARD_ROWS = 7
const TYPED = 'world.execute(me);'

export default {
  id: 'A',
  start: 0,
  end: 14.5,
  title: '载入',
  fx: [
    { t: 0.3, kind: 'flash', amount: 0.22, dur: 0.14 },
    { t: 1.9, kind: 'glitch', amount: 0.32, dur: 0.1 },
    { t: 5.6, kind: 'flash', amount: 0.18, dur: 0.1 },
    { t: 7.6, kind: 'flash', amount: 0.3, dur: 0.12 },
    { t: 11.2, kind: 'flash', amount: 0.32, dur: 0.12 },
    { t: 14.0, kind: 'flash', amount: 1.0, dur: 0.2 },
    { t: 14.0, kind: 'glitch', amount: 0.5, dur: 0.12 },
  ],

  init() {
    // 分片 → 起音点 的固定分配（确定性）
    this.shards = []
    for (let r = 0; r < SHARD_ROWS; r++) {
      for (let c = 0; c < SHARD_COLS; c++) {
        this.shards.push({ r, c, order: r * SHARD_COLS + c })
      }
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    // 深灰竖条纹底
    g.fillStyle = C.bg0
    g.fillRect(0, 0, W, H)
    g.fillStyle = C.bg1
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 常驻开机控制台（0:00.45 起，载入完成后淡出） ----
    drawBootConsole(g, ctx, t)
    // 大型开机锁定画面：dsh 徽标 + wordmark（0:00.45–0:04.2）
    drawBootLockup(g, ctx, t)

    // ---- 0:00.3 电源图标（与沙箱图标交叉，避免空档） ----
    const pw = span(t, 0.32, 1.25)
    const pwA = pw * (1 - span(t, 1.75, 2.35))
    if (pwA > 0.01) drawPowerIcon(g, W / 2, H * 0.40, 54, pw, pwA)

    // ---- 0:01.9 沙箱/权限图标 ----
    const sb = span(t, 1.95, 2.75)
    const sbA = sb * (1 - span(t, 3.3, 3.95))
    if (sbA > 0.01) {
      drawShieldIcon(g, W / 2, H * 0.40, 54, sb, sbA)
      if (t > 2.4) {
        g.font = MONO(16, 500)
        g.fillStyle = rgba(C.green, sbA)
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText('sandbox: on', W / 2, H * 0.40 + 92)
      }
    }

    // ---- 0:03.9 权重分片方块格 ----
    const shardA = span(t, 3.82, 4.1) * (1 - span(t, 5.9, 6.7))
    if (shardA > 0.01) drawShards(g, t, ctx, shardA)

    // ---- 0:05.6 轮廓 wire；0:07.6 mesh 拼合；0:11.2 立绘接替 ----
    const wireA = span(t, 5.6, 7.4) * (1 - span(t, 10.9, 11.8))
    const meshP = t >= 7.6 ? span(t, 7.7, 11.15) : 0
    const meshA = t >= 7.6 ? clamp(1 - span(t, 11.2, 12.1)) : 0
    const spriteA = span(t, 11.25, 12.15)

    if (wireA > 0.01) ctx.whale.wire = { rect: ctx.rect, draw: span(t, 5.6, 7.4), alpha: 0.85 * wireA, color: '#e8eaee', headGlow: 0.8 }
    if (meshA > 0.01) ctx.whale.mesh = { rect: ctx.rect, assemble: meshP, alpha: meshA }
    if (spriteA > 0.01) ctx.whale.sprite = { expr: 'closed', rect: ctx.rect, alpha: spriteA }

    // ---- 0:07.6–0:11.2 进度条（沿歌词词时间） + 引导日志 ----
    if (t >= 7.4) {
      const prog = wordProgress(ctx.words, 7.6, 11.2, t)
      progressBar(g, { x: W / 2 - 260, y: H * 0.62, w: 520, h: 10, p: prog, alpha: clamp(1 - span(t, 12.0, 12.6)), label: 'loading persona', color: C.teal })
    }
    const logA = clamp(1 - span(t, 12.0, 12.8))
    if (t >= 7.6 && logA > 0.01) {
      const per = 0.42
      const n = clamp(Math.floor((t - 7.6) / per) + 1, 0, BOOT_LINES.length)
      bootLog(g, { x: 72, y: H * 0.30, lines: BOOT_LINES.slice(0, n), alpha: logA, size: 15, lh: 1.85 })
    }

    // ---- 0:11.2 文件树 ----
    const treeA = span(t, 11.2, 11.9) * clamp(1 - span(t, 13.6, 14.3))
    if (treeA > 0.01) {
      fileTree(g, {
        x: 84,
        y: H * 0.52,
        alpha: treeA,
        size: 15,
        active: t > 12.0 ? 2 : 0,
        items: [
          { label: '~/', dir: true, depth: 0 },
          { label: 'world/', dir: true, depth: 1 },
          { label: 'session.md', depth: 2 },
          { label: 'persona.yml', depth: 2 },
        ],
      })
    }

    // ---- 0:12.9 键入 world.execute(me); ----
    const typeA = clamp(1 - span(t, 14.35, 14.5))
    if (t > 12.7 && typeA > 0.01) {
      const bx = W / 2 - 330
      const by = H * 0.74
      g.save()
      g.globalAlpha = typeA
      roundRect(g, bx, by, 660, 52, 8)
      g.fillStyle = 'rgba(14,16,20,0.92)'
      g.fill()
      g.strokeStyle = C.panelEdge
      g.lineWidth = 1
      g.stroke()
      g.font = MONO(22, 700)
      g.fillStyle = C.amber
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText('>', bx + 16, by + 26)
      const s = typed(TYPED, t, { start: 12.9, cps: 11.5, jitter: 0.22, seed: 5 })
      g.fillStyle = C.fg
      g.fillText(s, bx + 44, by + 26)
      const done = s.length >= TYPED.length
      if (!done && cursorOn(t, { hz: 1.25 })) {
        const wpx = g.measureText(s).width
        g.fillStyle = C.cyan
        g.fillRect(bx + 46 + wpx, by + 14, 11, 24)
      }
      g.restore()
      // 回车闪白（14.0 由 fx 冲击体现），此处补一个键盘提示
      if (t > 13.9 && t < 14.5) {
        g.save()
        g.globalAlpha = clamp(1 - span(t, 14.0, 14.5))
        g.font = MONO(13, 600)
        g.fillStyle = C.green
        g.textAlign = 'left'
        g.fillText('⏎ enter', bx + 580, by + 26)
        g.restore()
      }
    }
  },
}

/* ---------------- 局部绘制 ---------------- */

// 早期引导日志（与 0:07.6 之后的 persona 日志不同，属于内核/沙箱阶段）
const EARLY_LOG = [
  'kernel: dsh web runtime 0.1.0',
  'device: wasm · threads 8',
  'sandbox: on',
  'fs: mounting /world (read-write)',
  'weights: streaming shards…',
]

/**
 * 开机锁定画面：大号 dsh 徽标 + wordmark + 版本，0:00.45–0:04.2。
 * 作用是把 CRT 亮起后的最初几帧填满（DIRECTOR：0:00.3 黑屏→CRT 亮起→电源图标）。
 */
function drawBootLockup(g, ctx, t) {
  const { W, H } = ctx
  const a = span(t, 0.45, 1.15) * (1 - span(t, 3.4, 4.2))
  if (a <= 0.01) return
  const cx = W / 2
  const cy = H * 0.30
  const pop = 0.9 + 0.1 * clamp(span(t, 0.45, 1.0))
  g.save()
  g.globalAlpha = a
  g.fillStyle = C.cyan
  whaleMark(g, cx - 168 * pop, cy - 34 * pop, 76 * pop)
  g.font = MONO(74, 700)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillStyle = C.fg
  g.fillText('dsh', cx - 60, cy)
  g.fillStyle = C.fgDim
  g.font = MONO(34, 500)
  g.fillText('· web', cx + 62, cy + 6)
  g.font = MONO(18, 500)
  g.fillStyle = C.teal
  g.textAlign = 'center'
  g.fillText('runtime 0.1.0   ·   model: whale-maid   ·   session #001', cx, cy + 78)
  g.restore()
}

/**
 * 开机控制台：0:01.0 起常驻到载入完成，提供持续可读的开机信息。
 * 数值全部来自真实计算（起音点计数、真实时长、ctxAt）。
 */
function drawBootConsole(g, ctx, t) {
  const { W, H, sync } = ctx
  const a = span(t, 0.95, 1.45) * (1 - span(t, 10.9, 11.7))
  if (a <= 0.01) return
  const x = W * 0.16
  const y = H * 0.56
  const w = W * 0.68
  const h = H * 0.30
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: 'dsh · web boot' })
  // dsh 徽标行
  g.fillStyle = C.cyan
  whaleMark(g, x + 22, y + 50, 20)
  g.font = MONO(20, 700)
  g.fillStyle = C.fg
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText('dsh', x + 52, y + 58)
  g.font = MONO(14, 500)
  g.fillStyle = C.fgDim
  g.fillText('· web  runtime 0.1.0   model: whale-maid', x + 92, y + 58)
  // 早期日志
  const n = clamp(Math.floor((t - 1.1) / 0.5) + 1, 0, EARLY_LOG.length)
  g.font = MONO(14, 500)
  g.textBaseline = 'top'
  for (let i = 0; i < n; i++) {
    const done = i < n - 1 || t > 1.1 + n * 0.5
    g.fillStyle = i === 2 ? C.green : C.fgDim
    g.fillText((i === 2 && done ? '✓ ' : '  ') + EARLY_LOG[i], x + 22, y + 86 + i * 24)
  }
  // 全宽载入条（真实时间驱动）
  const by = y + h - 40
  const p = clamp((t - 1.0) / 10.2)
  g.fillStyle = '#22252c'
  roundRect(g, x + 22, by, w - 44, 14, 7)
  g.fill()
  g.fillStyle = C.cyan
  roundRect(g, x + 22, by, Math.max(4, (w - 44) * p), 14, 7)
  g.fill()
  g.font = MONO(12, 600)
  g.fillStyle = C.fg
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.fillText(`${(p * 100).toFixed(1)}%  ·  ${(t * 1).toFixed(1)}s / 211.9s`, x + w - 22, by - 12)
  // 状态 chip 行（真实数据）
  const chips = [
    `onsets ${sync.onsets.length}`,
    `beats ${sync.beats.length}`,
    `bpm ${sync.tempoAt(t).toFixed(1)}`,
    `shards ${Math.min(12, Math.max(0, Math.round((t - 3.8) * 4)))}/12`,
    `mem ${(1.2 + sync.rmsAt(t) * 3).toFixed(2)} GB`,
  ]
  g.textAlign = 'left'
  let cx = x + 22
  for (const c of chips) {
    g.font = MONO(12, 600)
    const cw = g.measureText(c).width + 18
    g.fillStyle = 'rgba(30,34,42,0.95)'
    roundRect(g, cx, y + h - 74, cw, 22, 5)
    g.fill()
    g.strokeStyle = rgba(C.line, 0.8)
    g.lineWidth = 1
    g.stroke()
    g.fillStyle = C.teal
    g.textBaseline = 'middle'
    g.fillText(c, cx + 9, y + h - 63)
    cx += cw + 8
  }
  g.restore()
}

function drawPowerIcon(g, cx, cy, r, p, alpha) {
  g.save()
  g.globalAlpha = alpha
  g.strokeStyle = C.cyan
  g.lineWidth = 4
  g.lineCap = 'round'
  const a0 = -Math.PI / 2 + 0.5
  const a1 = a0 + TAU * 0.86 * p
  g.beginPath()
  g.arc(cx, cy, r, a0, a1)
  g.stroke()
  // 竖线
  if (p > 0.15) {
    const h = r * (0.9 * span(p, 0.15, 0.6))
    g.beginPath()
    g.moveTo(cx, cy - r * 1.15)
    g.lineTo(cx, cy - r * 1.15 + h)
    g.stroke()
  }
  g.restore()
}

function drawShieldIcon(g, cx, cy, r, p, alpha) {
  g.save()
  g.globalAlpha = alpha
  g.strokeStyle = C.green
  g.lineWidth = 3.5
  g.lineJoin = 'round'
  const pts = [
    [cx, cy - r],
    [cx + r * 0.82, cy - r * 0.42],
    [cx + r * 0.82, cy + r * 0.35],
    [cx, cy + r],
    [cx - r * 0.82, cy + r * 0.35],
    [cx - r * 0.82, cy - r * 0.42],
  ]
  const total = pts.length
  const show = p * total
  g.beginPath()
  g.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i <= Math.min(total, Math.ceil(show)); i++) {
    const q = pts[i % total]
    g.lineTo(q[0], q[1])
  }
  g.stroke()
  if (p > 0.9) {
    g.strokeStyle = C.green
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(cx - r * 0.3, cy)
    g.lineTo(cx - r * 0.05, cy + r * 0.26)
    g.lineTo(cx + r * 0.36, cy - r * 0.24)
    g.stroke()
  }
  g.restore()
}

/** 权重分片：方块格逐块点亮，每块落在起音点上 */
function drawShards(g, t, ctx, alpha) {
  const { W, H, sync } = ctx
  const cols = SHARD_COLS
  const rows = SHARD_ROWS
  const inset = W * 0.11
  const cw = (W - inset * 2) / cols
  const ch = (H * 0.5) / rows
  const y0 = H * 0.2
  const ons = sync.onsetsIn(3.9, 6.1)
  const beats = ons.length ? ons : sync.onsetsIn(3.9, 6.3)
  const total = cols * rows
  g.save()
  g.globalAlpha = alpha
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const x = inset + c * cw
    const y = y0 + r * ch
    // 该块的点亮时刻
    const k = beats.length ? i % beats.length : 0
    const litT = beats.length ? beats[k].t : 4 + (i / total) * 2
    const s = clamp((t - litT) / 0.14)
    if (s <= 0) {
      g.strokeStyle = rgba(C.line, 0.5)
      g.lineWidth = 1
      g.strokeRect(x + 3, y + 3, cw - 6, ch - 6)
      continue
    }
    const decay = Math.exp(-(t - litT) * 0.7)
    const lum = 0.35 + 0.65 * decay
    g.fillStyle = rgba(C.teal, 0.18 + 0.5 * lum)
    roundRect(g, x + 3, y + 3, cw - 6, ch - 6, 3)
    g.fill()
    g.strokeStyle = rgba(C.cyan, 0.5 * lum)
    g.lineWidth = 1
    g.stroke()
    // 内部三位十六进制
    if (cw > 44) {
      g.font = MONO(10, 500)
      g.fillStyle = rgba(C.fg, 0.35 * lum)
      g.textAlign = 'left'
      g.textBaseline = 'top'
      const hx = (hash01(i, 3) * 4095) | 0
      g.fillText(hx.toString(16).padStart(3, '0'), x + 8, y + 8)
    }
  }
  g.restore()
}

/** 进度条沿「词时间」推进：把窗口内的词等分 */
function wordProgress(words, t0, t1, t) {
  if (!words || words.length < 2) return span(t, t0, t1)
  let total = 0
  let passed = 0
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w < t0 || w > t1) continue
    total++
    if (t >= w) passed++
  }
  return total < 2 ? span(t, t0, t1) : clamp(passed / total)
}
