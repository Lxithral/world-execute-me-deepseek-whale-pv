// src/ui/dsh.js — 仿 dsh/终端风格的常驻 HUD 与组件（SPEC §5）。
// 不复刻任何商业产品界面；所有文案均为本项目原创。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, lerp } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { cursorOn, typed } from './typing.js'

export const MONO = (size, weight = 500) =>
  `${weight} ${size}px "JetBrains Mono", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace`

/* ---------------------------------------------------------------- *
 * 上下文占用 ctxAt(t) —— DIRECTOR 的关键帧，段间缓动
 * ---------------------------------------------------------------- */
// [t, pct]
const CTX_KEYS = [
  [0, 0],
  [14, 6],
  [44, 14],
  [74, 29],
  [104, 44],
  [118, 58],
  [119.0, 58],
  [120.5, 27], // 2:00 压缩：58→27，1.5s
  [129, 33],
  [142, 70],
  [145, 100], // 2:25 溢出
  [146.4, 100],
  [147.4, 20], // 2:26.5 黑场后恢复 20
  [162, 62],
  [177, 78],
  [190.8, 88], // 3:10.8 触发交接
  [205.9, 88], // 3:13–3:25.9 保持 88
  [205.96, 2], // 3:25.9 新会话从 2 起
  [211.9, 2],
]

export function ctxAt(t) {
  if (t <= CTX_KEYS[0][0]) return CTX_KEYS[0][1]
  const n = CTX_KEYS.length
  if (t >= CTX_KEYS[n - 1][0]) return CTX_KEYS[n - 1][1]
  let i = 0
  while (i < n - 2 && t > CTX_KEYS[i + 1][0]) i++
  const [t0, v0] = CTX_KEYS[i]
  const [t1, v1] = CTX_KEYS[i + 1]
  const u = smoothstep((t - t0) / Math.max(1e-6, t1 - t0))
  return v0 + (v1 - v0) * u
}

/** 上下文占用颜色：低青 → 中琥珀 → 高红 */
export function ctxColor(pct) {
  if (pct < 60) return C.cyan
  if (pct < 85) return C.amber
  return C.red
}

/* ---------------------------------------------------------------- *
 * 状态行 / TPS
 * ---------------------------------------------------------------- */
const STATUS_BY_RANGE = [
  [0.0, 3.9, 'boot: loading kernel…'],
  [3.9, 11.2, 'load: weights shard'],
  [11.2, 12.9, 'fs: mkdir ~/world/'],
  [12.9, 14.5, 'awaiting input'],
  [14.5, 29.7, 'thinking…'],
  [29.7, 44.0, 'reasoning: self-definition'],
  [44.0, 59.0, 'tool: oscilloscope.ac'],
  [59.0, 74.0, 'generating…'],
  [74.0, 88.8, 'tool: rp.set_persona'],
  [88.8, 103.5, 'tool: switch.mode'],
  [103.5, 118.3, 'listening…'],
  [118.3, 129.0, 'compacting context…'],
  [129.0, 147.9, 'error: illegal arguments'],
  [147.9, 162.0, 'executing…'],
  [162.0, 177.4, 'training step 1/3'],
  [177.4, 188.5, 'solving: love'],
  [188.5, 205.96, 'handoff: prepare'],
  [205.96, 211.9, 'idle'],
]

export function statusAt(t) {
  for (const [a, b, s] of STATUS_BY_RANGE) if (t >= a && t < b) return s
  return 'idle'
}

/** TPS：由 RMS 包络与起音点驱动，不是假随机 */
export function tpsAt(t, sync) {
  const r = sync ? sync.rmsAt(t) : 0
  const p = sync ? sync.pulse(t, 260) : 0
  const bpm = sync ? sync.tempoAt(t) : 128
  const base = bpm * 0.55
  const v = base + r * 420 + p * 260
  return Math.round(v)
}

/* ---------------------------------------------------------------- *
 * 基础绘制工具
 * ---------------------------------------------------------------- */
export function roundRect(g, x, y, w, h, r = 6) {
  const rr = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + rr, y)
  g.arcTo(x + w, y, x + w, y + h, rr)
  g.arcTo(x + w, y + h, x, y + h, rr)
  g.arcTo(x, y + h, x, y, rr)
  g.arcTo(x, y, x + w, y, rr)
  g.closePath()
}

export function panel(g, x, y, w, h, { title = null, alpha = 1, bg = C.panel, edge = C.panelEdge, r = 8, titleH = 28 } = {}) {
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, w, h, r)
  g.fillStyle = bg
  g.fill()
  g.lineWidth = 1
  g.strokeStyle = edge
  g.stroke()
  if (title) {
    g.save()
    roundRect(g, x, y, w, titleH, r)
    g.clip()
    g.fillStyle = '#25272e'
    g.fillRect(x, y, w, titleH)
    g.restore()
    g.beginPath()
    g.moveTo(x, y + titleH)
    g.lineTo(x + w, y + titleH)
    g.strokeStyle = edge
    g.stroke()
    g.fillStyle = C.fgDim
    g.font = MONO(13, 600)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(title, x + 12, y + titleH / 2 + 0.5)
  }
  g.restore()
}

/** 语法高亮：把一行按简单规则着色（原创代码片段，非歌词） */
export function codeLine(g, x, y, text, size = 14) {
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  const re = /(\b(?:def|return|if|else|for|in|while|class|import|from|as|await|async|yield|True|False|None)\b)|(\b\d+(?:\.\d+)?\b)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*$)/g
  let last = 0
  let m
  let cx = x
  const put = (s, color) => {
    g.fillStyle = color
    g.fillText(s, cx, y)
    cx += g.measureText(s).width
  }
  g.fillStyle = C.fg
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) put(text.slice(last, m.index), C.fg)
    const color = m[1] ? C.purple : m[2] ? C.amber : m[3] ? C.green : C.fgDim
    put(m[0], color)
    last = m.index + m[0].length
  }
  if (last < text.length) put(text.slice(last), C.fg)
}

/* ---------------------------------------------------------------- *
 * 常驻顶栏
 * ---------------------------------------------------------------- */
export function drawTopBar(g, W, t, { session = '#001', alpha = 1, sync = null, model = 'whale-maid' } = {}) {
  const h = 38
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = rgba(C.bg0, 0.92)
  g.fillRect(0, 0, W, h)
  g.strokeStyle = C.panelEdge
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(0, h - 0.5)
  g.lineTo(W, h - 0.5)
  g.stroke()

  g.font = MONO(15, 700)
  g.textBaseline = 'middle'
  g.textAlign = 'left'
  // 徽标：通用鲸鱼剪影 + dsh·web
  const bx = 18
  g.fillStyle = C.cyan
  whaleMark(g, bx, h / 2 - 8, 15)
  g.fillStyle = C.fg
  g.fillText('dsh', bx + 22, h / 2 + 0.5)
  g.fillStyle = C.fgDim
  g.font = MONO(13, 500)
  g.fillText('· web', bx + 52, h / 2 + 0.5)
  g.fillStyle = C.amber
  g.font = MONO(14, 700)
  g.fillText(session, bx + 92, h / 2 + 0.5)
  g.fillStyle = C.fgDim
  g.font = MONO(12, 500)
  g.fillText(model, bx + 140, h / 2 + 0.5)

  // 中间：状态行（打字机刷新）
  const status = statusAt(t)
  const cycle = 6.0
  const phase = Math.floor(t / cycle)
  const shown = typed(status, t - phase * cycle, { start: 0, cps: 26, seed: phase & 255 })
  g.textAlign = 'center'
  g.font = MONO(14, 500)
  g.fillStyle = C.teal
  const cx = W / 2
  const dot = cursorOn(t, { hz: 2.2 }) && shown.length < status.length + 6 ? '▌' : ''
  g.fillText(shown + dot, cx, h / 2 + 0.5)

  // 右侧：上下文占用条 + TPS
  const pct = ctxAt(t)
  const barW = 190
  const barH = 12
  const x = W - 18 - barW - 96
  const y = h / 2 - barH / 2
  g.fillStyle = C.bg1
  roundRect(g, x, y, barW, barH, 3)
  g.fill()
  const col = ctxColor(pct)
  g.fillStyle = col
  roundRect(g, x, y, Math.max(2, (barW * clamp(pct / 100)) | 0), barH, 3)
  g.fill()
  // 溢出时闪烁
  if (pct > 92) {
    g.globalAlpha = alpha * (0.35 + 0.65 * Math.abs(Math.sin(t * 9)))
  }
  g.fillStyle = pct > 92 ? C.red : C.fgDim
  g.font = MONO(12, 600)
  g.textAlign = 'right'
  g.fillText(`ctx ${pct.toFixed(0).padStart(3, ' ')}%`, x + barW, h / 2 + 0.5)
  g.globalAlpha = alpha

  const tps = tpsAt(t, sync)
  g.textAlign = 'right'
  g.font = MONO(12, 600)
  g.fillStyle = C.green
  g.fillText(`${String(tps).padStart(3, ' ')} tps`, W - 18, h / 2 + 0.5)
  g.restore()
}

/** 通用鲸鱼剪影（不使用任何官方 logo） */
export function whaleMark(g, x, y, s) {
  g.save()
  g.translate(x, y)
  g.beginPath()
  g.moveTo(0.1 * s, 0.55 * s)
  g.bezierCurveTo(0.05 * s, 0.15 * s, 0.45 * s, -0.05 * s, 0.72 * s, 0.12 * s)
  g.bezierCurveTo(0.9 * s, 0.22 * s, 0.98 * s, 0.42 * s, 1.0 * s, 0.62 * s)
  g.bezierCurveTo(0.86 * s, 0.52 * s, 0.72 * s, 0.52 * s, 0.6 * s, 0.62 * s)
  g.bezierCurveTo(0.44 * s, 0.76 * s, 0.2 * s, 0.78 * s, 0.1 * s, 0.55 * s)
  g.closePath()
  g.fill()
  // 尾鳍
  g.beginPath()
  g.moveTo(0.98 * s, 0.62 * s)
  g.quadraticCurveTo(1.18 * s, 0.5 * s, 1.24 * s, 0.72 * s)
  g.quadraticCurveTo(1.1 * s, 0.7 * s, 1.0 * s, 0.78 * s)
  g.closePath()
  g.fill()
  g.restore()
}

/* ---------------------------------------------------------------- *
 * 组件
 * ---------------------------------------------------------------- */
export function bubble(g, { x, y, w, text, me = false, alpha = 1, font = 16, pad = 12 }) {
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(font, 500)
  const lines = wrapText(g, text, w - pad * 2)
  const lh = font * 1.5
  const h = lines.length * lh + pad * 1.4
  const bx = me ? x - w : x
  roundRect(g, bx, y, w, h, 10)
  g.fillStyle = me ? '#26313f' : '#252830'
  g.fill()
  g.strokeStyle = me ? '#3a4b60' : C.panelEdge
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = C.fg
  g.textAlign = 'left'
  g.textBaseline = 'top'
  lines.forEach((ln, i) => g.fillText(ln, bx + pad, y + pad * 0.7 + i * lh))
  g.restore()
  return h
}

export function wrapText(g, text, maxW) {
  const out = []
  const paras = String(text).split('\n')
  for (const para of paras) {
    let line = ''
    for (const ch of para) {
      if (g.measureText(line + ch).width > maxW && line) {
        out.push(line)
        line = ch
      } else line += ch
    }
    out.push(line)
  }
  return out
}

export function toolCard(g, { x, y, w, name, args = '', status = 'ok', alpha = 1, t = 0, seed = 0 }) {
  const h = 62
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, w, h, { alpha, bg: '#1c1f26' })
  // 左侧状态点
  g.fillStyle = status === 'ok' ? C.green : status === 'err' ? C.red : C.amber
  g.beginPath()
  g.arc(x + 16, y + 20, 4.5, 0, Math.PI * 2)
  g.fill()
  g.font = MONO(13, 700)
  g.fillStyle = C.amber
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(`tool: ${name}`, x + 28, y + 20)
  g.font = MONO(12, 500)
  g.fillStyle = C.fgDim
  g.fillText(args, x + 28, y + 42)
  // 运行中的进度线
  if (status === 'run') {
    const p = (t * 1.7 + seed * 0.13) % 1
    g.fillStyle = rgba(C.teal, 0.7)
    g.fillRect(x + 12, y + h - 4, (w - 24) * p, 2)
  }
  g.restore()
}

export function permissionDialog(g, { x, y, w, alpha = 1, mode = 'ask', t = 0 }) {
  const h = 150
  g.save()
  g.globalAlpha = alpha
  const edge = mode === 'denied' ? C.red : C.panelEdge
  panel(g, x, y, w, h, { alpha, bg: '#20222a', edge, title: 'permission' })
  g.fillStyle = C.fg
  g.font = MONO(14, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  const msg =
    mode === 'denied'
      ? ['write ~/world/system.prompt', '', 'permission denied', 'the sandbox refused this path.']
      : ['allow this tool to modify', '~/world/ ?', '', 'the request stays inside the sandbox.']
  msg.forEach((l, i) => {
    g.fillStyle = i === 2 && mode === 'denied' ? C.red : C.fg
    g.fillText(l, x + 16, y + 42 + i * 22)
  })
  // 按钮
  const by = y + h - 40
  const bw = 86
  const bh = 26
  const deny = { x: x + w - 16 - bw * 2 - 10, y: by }
  const allow = { x: x + w - 16 - bw, y: by }
  roundRect(g, deny.x, deny.y, bw, bh, 5)
  g.fillStyle = '#2a2d36'
  g.fill()
  g.strokeStyle = C.panelEdge
  g.stroke()
  roundRect(g, allow.x, allow.y, bw, bh, 5)
  g.fillStyle = mode === 'denied' ? '#3a1c1c' : '#1d3a2a'
  g.fill()
  g.strokeStyle = mode === 'denied' ? C.red : C.green
  g.stroke()
  g.font = MONO(12, 600)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = C.fgDim
  g.fillText('deny', deny.x + bw / 2, deny.y + bh / 2)
  g.fillStyle = mode === 'denied' ? C.red : C.green
  g.fillText('allow', allow.x + bw / 2, allow.y + bh / 2)
  // 高亮脉冲
  if (mode === 'ask') {
    g.globalAlpha = alpha * (0.25 + 0.35 * Math.abs(Math.sin(t * 3)))
    roundRect(g, allow.x, allow.y, bw, bh, 5)
    g.strokeStyle = C.green
    g.lineWidth = 2
    g.stroke()
  }
  g.restore()
}

export function toggle(g, { x, y, label, on, alpha = 1, w = 46 }) {
  const h = 22
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(13, 500)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(label, x, y + h / 2)
  const tw = w
  const tx = x + g.measureText(label).width + 14
  roundRect(g, tx, y, tw, h, h / 2)
  g.fillStyle = on ? rgba(C.cyan, 0.28) : '#2a2d36'
  g.fill()
  g.strokeStyle = on ? C.cyan : C.panelEdge
  g.lineWidth = 1
  g.stroke()
  g.beginPath()
  g.arc(tx + (on ? tw - h / 2 : h / 2), y + h / 2, h / 2 - 4, 0, Math.PI * 2)
  g.fillStyle = on ? C.cyan : C.fgDim
  g.fill()
  g.restore()
}

export function fileTree(g, { x, y, alpha = 1, items, active = -1, size = 13 }) {
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  items.forEach((it, i) => {
    const yy = y + i * (size * 1.75)
    g.fillStyle = i === active ? C.cyan : it.dir ? C.blue : C.fgDim
    g.fillText(it.label, x + (it.depth || 0) * 16, yy)
    if (i === active) {
      g.fillStyle = rgba(C.cyan, 0.12)
      g.fillRect(x - 6, yy - size * 0.8, 260, size * 1.6)
    }
  })
  g.restore()
}

export function reconnectBanner(g, { x, y, w, attempt, total, alpha = 1, mode = 0 }) {
  const h = 44
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, w, h, 6)
  g.fillStyle = mode >= 2 ? '#2a1c1c' : '#2a2418'
  g.fill()
  g.strokeStyle = mode >= 2 ? C.red : C.amber
  g.lineWidth = 1
  g.stroke()
  g.font = MONO(14, 700)
  g.fillStyle = mode >= 2 ? C.red : C.amber
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(`reconnecting…  ${attempt}/${total}`, x + 14, y + h / 2)
  // 右侧失败标记
  for (let i = 0; i < total; i++) {
    g.fillStyle = i < attempt ? (mode >= 2 ? C.red : C.amber) : rgba(C.fgDim, 0.35)
    g.fillRect(x + w - 20 - (total - i) * 16, y + h / 2 - 5, 10, 10)
  }
  g.restore()
}

export function handoffCard(g, { x, y, w, alpha = 1, pct = 88, t = 0 }) {
  const h = 128
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, w, h, { alpha, bg: '#1f2430', edge: C.gold, title: 'handoff' })
  g.font = MONO(14, 500)
  g.fillStyle = C.fg
  g.textAlign = 'left'
  g.textBaseline = 'top'
  wrapText(g, `上下文 ${pct}%：创建新会话，并带上最后一次请求与回复。`, w - 32).forEach((l, i) =>
    g.fillText(l, x + 16, y + 40 + i * 21)
  )
  g.fillStyle = C.gold
  g.font = MONO(12, 600)
  g.fillText('carry over: last request + last reply', x + 16, y + h - 30)
  g.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.4)))
  g.fillStyle = C.gold
  g.fillRect(x + 16, y + h - 14, w - 32, 2)
  g.restore()
}

export function warningModal(g, { x, y, w, title, lines = [], alpha = 1, color = C.red, seed = 0, t = 0 }) {
  const h = 44 + lines.length * 22 + 18
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, w, h, { alpha, bg: '#241a1c', edge: color, title })
  g.font = MONO(13, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  lines.forEach((l, i) => {
    g.fillStyle = i === 0 ? color : C.fg
    g.fillText(l, x + 16, y + 40 + i * 22)
  })
  g.restore()
  return h
}

export function nestedWindow(g, { x, y, w, h, depth = 0, alpha = 1, label = '' }) {
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, w, h, 6)
  g.fillStyle = depth % 2 ? '#1b1e24' : '#20232a'
  g.fill()
  g.strokeStyle = mixHex(C.panelEdge, C.cyan, clamp(depth / 8))
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = rgba(C.bg1, 0.9)
  g.fillRect(x, y, w, 20)
  for (let i = 0; i < 3; i++) {
    g.fillStyle = rgba(C.fgDim, 0.6)
    g.beginPath()
    g.arc(x + 10 + i * 11, y + 10, 3, 0, Math.PI * 2)
    g.fill()
  }
  if (label) {
    g.fillStyle = C.fgDim
    g.font = MONO(11, 500)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(label, x + 44, y + 10)
  }
  g.restore()
}

const HEXCH = '0123456789abcdef'
export function hexdump(g, { x, y, w, alpha = 1, rows = 12, scroll = 0, seed = 0, size = 12 }) {
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  const cols = 8
  for (let r = 0; r < rows; r++) {
    const addr = (Math.floor(scroll) + r) * cols
    let line = addr.toString(16).padStart(6, '0') + '  '
    for (let c = 0; c < cols; c++) {
      const k = r * 997 + c * 31 + Math.floor(scroll)
      line += HEXCH[Math.floor(hash01(k, seed) * 16)] + HEXCH[Math.floor(hash01(k, seed + 5) * 16)] + ' '
    }
    g.fillStyle = r % 3 === 0 ? C.green : C.fgDim
    g.fillText(line, x, y + r * (size * 1.5))
  }
  g.restore()
}

export function bootLog(g, { x, y, lines, alpha = 1, size = 13, color = C.fgDim, lh = 1.7 }) {
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  lines.forEach((l, i) => {
    g.fillStyle = typeof l === 'string' ? color : l.color || color
    g.fillText(typeof l === 'string' ? l : l.text, x, y + i * size * lh)
  })
  g.restore()
}

export function progressBar(g, { x, y, w, h = 10, p = 0, alpha = 1, label = '', color = C.cyan, showPct = true }) {
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = C.bg1
  roundRect(g, x, y, w, h, h / 2)
  g.fill()
  g.fillStyle = color
  roundRect(g, x, y, Math.max(2, w * clamp(p)), h, h / 2)
  g.fill()
  g.font = MONO(12, 600)
  g.textBaseline = 'middle'
  if (label) {
    g.textAlign = 'right'
    g.fillStyle = C.fgDim
    g.fillText(label, x - 10, y + h / 2)
  }
  if (showPct) {
    g.textAlign = 'left'
    g.fillStyle = C.fg
    g.fillText(`${Math.round(clamp(p) * 100)}%`, x + w + 10, y + h / 2)
  }
  g.restore()
}

export function rewardBar(g, { x, y, w, h = 220, cells = 14, filled = 0, alpha = 1, t = 0 }) {
  g.save()
  g.globalAlpha = alpha
  const cw = w - 4
  const ch = (h - (cells - 1) * 4) / cells
  for (let i = 0; i < cells; i++) {
    const yy = y + h - (i + 1) * ch - i * 4
    roundRect(g, x + 2, yy, cw, ch, 3)
    const on = i < filled
    g.fillStyle = on ? (i > cells * 0.8 ? C.gold : C.cyan) : '#22252c'
    g.fill()
    g.strokeStyle = C.panelEdge
    g.lineWidth = 1
    g.stroke()
  }
  // 顶部溢出光晕
  if (filled >= cells) {
    g.globalAlpha = alpha * (0.3 + 0.4 * Math.abs(Math.sin(t * 6)))
    g.fillStyle = C.gold
    g.fillRect(x, y - 6, w, 4)
  }
  g.restore()
}

export function cursorBlock(g, x, y, w, h, on, color = C.cyan) {
  if (!on) return
  g.save()
  g.fillStyle = color
  g.fillRect(x, y, w, h)
  g.restore()
}

export { cursorOn, typed, span, lerp }
