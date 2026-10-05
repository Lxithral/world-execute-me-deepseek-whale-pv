// src/ui/dsh.js — 仿 dsh/终端风格的常驻 HUD 与组件（SPEC §5）。
// 不复刻任何商业产品界面；所有文案均为本项目原创。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, lerp } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { cursorOn, typed } from './typing.js'
import { beginPanel, endPanel } from './text.js'

export const MONO = (size, weight = 500) =>
  `${weight} ${size}px "JetBrains Mono", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace`

/* ---------------------------------------------------------------- *
 * G1（FIX_V5 §0）面板口径
 * ---------------------------------------------------------------- *
 * · 字号：终端/面板文字 **30–40px**，取 34（与 FIX_V4 §2.3 的既有门槛一致）。
 * · 尺寸：**先 measureText 排版 → 内容宽高 + 两侧内边距 → 窗口**；调用方给的
 *   `w` 是**下限**，内容更宽时窗口跟着长，绝不为塞进窗口而缩字号。
 * · 自检：`beginPanel/endPanel` 把"这段文字属于这块面板"显式登记给 §G1 的
 *   「文字包围盒 ⊄ 面板包围盒」判定（见 src/ui/text.js）。
 */
export const UI_PX = 34
/** 文字到面板边的最小视觉间距（G1 的 24px 内边距口径） */
export const UI_PAD = 24
/** 面板标题栏高度：34px 标题 + 上下各 5px（G1：标题栏内必须放得下标题） */
export const UI_TITLE_H = 44

/**
 * G1：按实测宽度排版若干行文本。
 * @param {CanvasRenderingContext2D} g
 * @param {{w?:number, lines?:string[], pad?:number, font?:number, weight?:number, lh?:number, minW?:number}} o
 *   · w    面板宽度下限（内容更宽时结果更大）
 *   · lines 每个元素是一条逻辑行，过长自动折行
 * @returns {{w:number, h:number, lines:string[], lh:number, pad:number, font:number}}
 */
export function uiBox(g, o = {}) {
  const pad = o.pad == null ? UI_PAD : o.pad
  const font = o.font == null ? UI_PX : o.font
  const weight = o.weight == null ? 500 : o.weight
  const lh = o.lh == null ? 1.5 : o.lh
  const minW = o.minW || 0
  const inset = o.inset || 0
  const maxW = Math.max(80, (o.w || 0) - pad * 2 - inset)
  g.save()
  g.font = MONO(font, weight)
  const lines = []
  for (const L of o.lines || []) for (const part of wrapText(g, L, maxW)) lines.push(part)
  let w = minW
  for (const s of lines) w = Math.max(w, g.measureText(s).width + pad * 2 + inset)
  g.restore()
  const rowH = font * lh
  return { w: Math.ceil(w), h: Math.ceil(Math.max(1, lines.length) * rowH + pad * 2), lines, lh: rowH, pad, font, inset }
}

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

// T07b / FIX_V4 §2.3：「**面板类文字最小 34px**」。G1（FIX_V5 §0）再要求标题栏
// 「先测宽，过长则截断加省略号，绝不超出标题栏」——所以标题仍然只画在标题栏内，
// 但标题栏高度默认抬到 UI_TITLE_H(44)（34px 标题不再被裁掉）。
export function panel(g, x, y, w, h, { title = null, alpha = 1, bg = C.panel, edge = C.panelEdge, r = 8, titleH = UI_TITLE_H } = {}) {
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, w, h, r)
  g.fillStyle = bg
  g.fill()
  g.lineWidth = 1
  g.strokeStyle = edge
  g.stroke()
  if (title) {
    // 标题栏是面板的 chrome：只要求"标题文字不越出标题栏"，不套用窗口的 24px 内边距
    beginPanel(g, { x, y, w, h: titleH }, { pad: 0, id: `title:${title}` })
    g.save()
    roundRect(g, x, y, w, titleH, r)
    g.clip()
    g.fillStyle = '#25272e'
    g.fillRect(x, y, w, titleH)
    // 标题：34px（§2.3），超出宽度就截断加 …（「放不下时缩短内容,不缩字号」）
    g.fillStyle = C.fgDim
    g.font = MONO(UI_PX, 600)
    g.textAlign = 'left'
    // T41（FIX_V5 §G1）：标题盒必须**完全落在标题栏里**。原来用 middle 基线画在
    // `y + titleH/2 + 0.5`，34px 的盒底（+0.66×34）会超出标题栏 0.9px（实测 5 块面板全 FAIL）
    // → 改成 top 基线并按盒高居中（44−1.16×34)/2 ≈ 2px。
    g.textBaseline = 'top'
    let tstr = String(title)
    const maxTW = w - 24
    while (tstr.length > 2 && g.measureText(tstr).width > maxTW) tstr = tstr.slice(0, -2) + '…'
    g.fillText(tstr, x + 12, y + (titleH - UI_PX * 1.16) / 2)
    g.restore()
    g.beginPath()
    g.moveTo(x, y + titleH)
    g.lineTo(x + w, y + titleH)
    g.strokeStyle = edge
    g.stroke()
    endPanel(g)
  }
  g.restore()
}

/** 语法高亮：把一行按简单规则着色（原创代码片段，非歌词）；G1：面板内代码同样 ≥34px */
export function codeLine(g, x, y, text, size = UI_PX) {
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

// 自绘的通用鲸鱼剪影已删除：§5.10 要求凡属于"dsh 界面的一部分"的 logo 都使用官方
// FishLogo 真实矢量（不得自己重画）。Canvas2D 侧请用 src/ui/logo.js 的 drawFishLogo()。

/* ---------------------------------------------------------------- *
 * 组件
 * ---------------------------------------------------------------- */
export function bubble(g, { x, y, w, text, me = false, alpha = 1, font = UI_PX, pad = UI_PAD }) {
  // G1：先排版 → 内容宽高 + 两侧内边距 → 窗口；调用方给的 w 只是下限
  const box = uiBox(g, { w, lines: [text], pad, font })
  const bw = Math.max(w, box.w)
  const bx = me ? x - bw : x
  const h = box.h
  beginPanel(g, { x: bx, y, w: bw, h }, { pad, id: 'bubble' })
  g.save()
  g.globalAlpha = alpha
  roundRect(g, bx, y, bw, h, 10)
  g.fillStyle = me ? '#26313f' : '#252830'
  g.fill()
  g.strokeStyle = me ? '#3a4b60' : C.panelEdge
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = C.fg
  g.font = MONO(font, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  box.lines.forEach((ln, i) => g.fillText(ln, bx + pad, y + pad + i * box.lh))
  g.restore()
  endPanel(g)
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
  // G1：两级 34px 正文 + 24px 内边距；左侧状态点占 20px（inset）
  const box = uiBox(g, { w, lines: [`tool: ${name}`, args], font: UI_PX, lh: 1.5, inset: 20 })
  const bw = Math.max(w, box.w)
  const h = box.h
  beginPanel(g, { x, y, w: bw, h }, { pad: UI_PAD, id: `toolCard:${name}` })
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, bw, h, { alpha, bg: '#1c1f26' })
  // 左侧状态点
  g.fillStyle = status === 'ok' ? C.green : status === 'err' ? C.red : C.amber
  g.beginPath()
  g.arc(x + UI_PAD + 6, y + UI_PAD + UI_PX * 0.5, 6.5, 0, Math.PI * 2)
  g.fill()
  g.textAlign = 'left'
  g.textBaseline = 'top'
  box.lines.forEach((ln, i) => {
    g.font = i === 0 ? MONO(UI_PX, 700) : MONO(UI_PX, 500)
    g.fillStyle = i === 0 ? C.amber : C.fgDim
    g.fillText(ln, x + UI_PAD + 20, y + UI_PAD + i * box.lh)
  })
  // 运行中的进度线
  if (status === 'run') {
    const p = (t * 1.7 + seed * 0.13) % 1
    g.fillStyle = rgba(C.teal, 0.7)
    g.fillRect(x + UI_PAD, y + h - 8, (bw - UI_PAD * 2) * p, 3)
  }
  g.restore()
  endPanel(g)
  return h
}

export function permissionDialog(g, { x, y, w, alpha = 1, mode = 'ask', t = 0 }) {
  const edge = mode === 'denied' ? C.red : C.panelEdge
  const msg =
    mode === 'denied'
      ? ['write ~/world/system.prompt', '', 'permission denied', 'the sandbox refused this path.']
      : ['allow this tool to modify', '~/world/ ?', '', 'the request stays inside the sandbox.']
  // G1：先排版（34px）→ 内容宽高 + 24px 内边距 → 窗口；按钮也要放得下 34px 标签
  const box = uiBox(g, { w, lines: msg, font: UI_PX, lh: 1.5 })
  const bw = Math.max(w, box.w)
  g.save()
  g.font = MONO(UI_PX, 600)
  const labW = Math.max(g.measureText('allow').width, g.measureText('deny').width)
  g.restore()
  const btnW = Math.ceil(labW + 48)
  const btnH = Math.ceil(UI_PX * 1.4)
  const needBtnW = UI_PAD * 2 + btnW * 2 + 14
  const winW = Math.max(bw, needBtnW)
  const h = UI_TITLE_H + box.h + btnH + UI_PAD
  beginPanel(g, { x, y, w: winW, h }, { pad: UI_PAD, id: 'permissionDialog', title: 'permission' })
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, winW, h, { alpha, bg: '#20222a', edge, title: 'permission' })
  g.fillStyle = C.fg
  g.font = MONO(UI_PX, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  box.lines.forEach((l, i) => {
    g.fillStyle = i === 2 && mode === 'denied' ? C.red : C.fg
    if (l) g.fillText(l, x + UI_PAD, y + UI_TITLE_H + UI_PAD + i * box.lh)
  })
  // 按钮
  const by = y + h - UI_PAD - btnH
  const deny = { x: x + winW - UI_PAD - btnW * 2 - 14, y: by }
  const allow = { x: x + winW - UI_PAD - btnW, y: by }
  roundRect(g, deny.x, deny.y, btnW, btnH, 5)
  g.fillStyle = '#2a2d36'
  g.fill()
  g.strokeStyle = C.panelEdge
  g.stroke()
  roundRect(g, allow.x, allow.y, btnW, btnH, 5)
  g.fillStyle = mode === 'denied' ? '#3a1c1c' : '#1d3a2a'
  g.fill()
  g.strokeStyle = mode === 'denied' ? C.red : C.green
  g.stroke()
  g.font = MONO(UI_PX, 600)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = C.fgDim
  g.fillText('deny', deny.x + btnW / 2, deny.y + btnH / 2)
  g.fillStyle = mode === 'denied' ? C.red : C.green
  g.fillText('allow', allow.x + btnW / 2, allow.y + btnH / 2)
  // 高亮脉冲
  if (mode === 'ask') {
    g.globalAlpha = alpha * (0.25 + 0.35 * Math.abs(Math.sin(t * 3)))
    roundRect(g, allow.x, allow.y, btnW, btnH, 5)
    g.strokeStyle = C.green
    g.lineWidth = 2
    g.stroke()
  }
  g.restore()
  endPanel(g)
  return h
}

export function toggle(g, { x, y, label, on, alpha = 1, w = 88 }) {
  // G1：标签也是面板类文字 → 34px；开关高度随字号（不缩字号去迁就控件）
  const h = Math.round(UI_PX * 1.5)
  const knobR = h / 2 - 6
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(UI_PX, 500)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(label, x, y + h / 2)
  const tw = w
  const tx = x + g.measureText(label).width + 18
  roundRect(g, tx, y, tw, h, h / 2)
  g.fillStyle = on ? rgba(C.cyan, 0.28) : '#2a2d36'
  g.fill()
  g.strokeStyle = on ? C.cyan : C.panelEdge
  g.lineWidth = 1
  g.stroke()
  g.beginPath()
  g.arc(tx + (on ? tw - h / 2 : h / 2), y + h / 2, knobR, 0, Math.PI * 2)
  g.fillStyle = on ? C.cyan : C.fgDim
  g.fill()
  g.restore()
  return h
}

export function fileTree(g, { x, y, alpha = 1, items, active = -1, size = UI_PX, maxH = Infinity, pad = UI_PAD }) {
  // G1：34px 行高；行数按可视高度截断（放不下就少画几行，绝不缩字号）
  const rowH = size * 1.6
  const n = Math.max(1, Math.min(items.length, Math.floor(Math.max(rowH, maxH) / rowH)))
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  let barW = 0
  for (let i = 0; i < n; i++) barW = Math.max(barW, g.measureText(items[i].label).width + 12)
  items.slice(0, n).forEach((it, i) => {
    const yy = y + i * rowH + size * 0.7
    g.fillStyle = i === active ? C.cyan : it.dir ? C.blue : C.fgDim
    g.fillText(it.label, x + pad + (it.depth || 0) * 24, yy)
    if (i === active) {
      g.fillStyle = rgba(C.cyan, 0.12)
      g.fillRect(x + pad - 8, yy - size * 0.8, barW, size * 1.6)
    }
  })
  g.restore()
  return { w: barW + pad * 2, h: n * rowH, shown: n, total: items.length }
}

export function reconnectBanner(g, { x, y, w, attempt, total, alpha = 1, mode = 0 }) {
  // G1：34px 文本 + 右侧失败标记，窗口按内容长
  const text = `reconnecting…  ${attempt}/${total}`
  const box = uiBox(g, { w, lines: [text], font: UI_PX, lh: 1.5 })
  const marks = total * 22 + 16
  const bw = Math.max(w, box.w + marks)
  const h = box.h
  beginPanel(g, { x, y, w: bw, h }, { pad: UI_PAD, id: 'reconnectBanner' })
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, bw, h, 6)
  g.fillStyle = mode >= 2 ? '#2a1c1c' : '#2a2418'
  g.fill()
  g.strokeStyle = mode >= 2 ? C.red : C.amber
  g.lineWidth = 1
  g.stroke()
  g.font = MONO(UI_PX, 700)
  g.fillStyle = mode >= 2 ? C.red : C.amber
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.fillText(text, x + UI_PAD, y + UI_PAD)
  // 右侧失败标记
  for (let i = 0; i < total; i++) {
    g.fillStyle = i < attempt ? (mode >= 2 ? C.red : C.amber) : rgba(C.fgDim, 0.35)
    g.fillRect(x + bw - 20 - (total - i) * 22, y + h / 2 - 7, 14, 14)
  }
  g.restore()
  endPanel(g)
  return h
}

export function handoffCard(g, { x, y, w, alpha = 1, pct = 88, t = 0 }) {
  const msg = `上下文 ${pct}%：创建新会话，并带上最后一次请求与回复。`
  const box = uiBox(g, { w, lines: [msg], font: UI_PX, lh: 1.5 })
  const bw = Math.max(w, box.w)
  const footH = Math.ceil(UI_PX * 1.5)
  const h = UI_TITLE_H + box.h + footH + 14
  beginPanel(g, { x, y, w: bw, h }, { pad: UI_PAD, id: 'handoffCard', title: 'handoff' })
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, bw, h, { alpha, bg: '#1f2430', edge: C.gold, title: 'handoff' })
  g.fillStyle = C.fg
  g.font = MONO(UI_PX, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  box.lines.forEach((l, i) => g.fillText(l, x + UI_PAD, y + UI_TITLE_H + UI_PAD + i * box.lh))
  g.fillStyle = C.gold
  g.fillText('carry over: last request + last reply', x + UI_PAD, y + h - footH - 8)
  g.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.4)))
  g.fillStyle = C.gold
  g.fillRect(x + UI_PAD, y + h - 6, bw - UI_PAD * 2, 3)
  g.restore()
  endPanel(g)
  return h
}

export function warningModal(g, { x, y, w, title, lines = [], alpha = 1, color = C.red, seed = 0, t = 0 }) {
  // G1：34px 正文 + 24px 内边距 → 窗口高由行数决定（旧版固定 22px 行距、13px 字）
  const box = uiBox(g, { w, lines, font: UI_PX, lh: 1.5 })
  const bw = Math.max(w, box.w)
  const h = UI_TITLE_H + box.h
  beginPanel(g, { x, y, w: bw, h }, { pad: UI_PAD, id: `warningModal:${title}`, title })
  g.save()
  g.globalAlpha = alpha
  panel(g, x, y, bw, h, { alpha, bg: '#241a1c', edge: color, title })
  g.font = MONO(UI_PX, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  box.lines.forEach((l, i) => {
    g.fillStyle = i === 0 ? color : C.fg
    if (l) g.fillText(l, x + UI_PAD, y + UI_TITLE_H + UI_PAD + i * box.lh)
  })
  g.restore()
  endPanel(g)
  return h
}

export function nestedWindow(g, { x, y, w, h, depth = 0, alpha = 1, label = '', labelSize = 36, titleH = null }) {
  // G1：标题栏文字先测宽 → 过长截断加省略号；标题栏高度随字号（不再把 36px 字压在 20px 栏里）
  // 高度必须**装得下登记的标题盒**：`src/ui/text.js` 的盒高是 `px·1.16`、`textBaseline:'middle'`
  // 又让盒中心下移 `px·0.16`（盒 = [y−0.5px, y+0.66px]）⇒ 需要 `th ≥ px·1.32`；
  // 原来用 `round(px·1.3)` 时 36px 标题在 47px 栏里会下溢 0.26px（面板审计 `minPad=-0.3/0`）。
  const th = titleH == null ? Math.max(24, Math.ceil(labelSize * 1.32)) : titleH
  g.save()
  g.globalAlpha = alpha
  roundRect(g, x, y, w, h, 6)
  g.fillStyle = depth % 2 ? '#1b1e24' : '#20232a'
  g.fill()
  g.strokeStyle = mixHex(C.panelEdge, C.cyan, clamp(depth / 8))
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = rgba(C.bg1, 0.9)
  g.fillRect(x, y, w, th)
  for (let i = 0; i < 3; i++) {
    g.fillStyle = rgba(C.fgDim, 0.6)
    g.beginPath()
    g.arc(x + 14 + i * 14, y + th / 2, 3.5, 0, Math.PI * 2)
    g.fill()
  }
  if (label) {
    // 标题栏是 chrome：只要求"文字不越出标题栏"
    beginPanel(g, { x, y, w, h: th }, { pad: 0, id: `nestedWindow:${label}` })
    g.fillStyle = C.fgDim
    g.font = MONO(labelSize, 500)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    let tstr = String(label)
    const maxTW = w - 52 - 12
    while (tstr.length > 2 && g.measureText(tstr).width > maxTW) tstr = tstr.slice(0, -2) + '…'
    g.fillText(tstr, x + 52, y + th / 2)
    endPanel(g)
  }
  g.restore()
  return th
}

const HEXCH = '0123456789abcdef'
// G1：hexdump 也是面板文字 → 34px；行数由可用高度决定（放不下就少画几行，不缩字号）
export function hexdump(g, { x, y, w, alpha = 1, rows = 12, scroll = 0, seed = 0, size = UI_PX, maxH = Infinity, cols = 8 }) {
  const rowH = size * 1.5
  const n = Math.max(1, Math.min(rows, Math.floor(maxH / rowH)))
  g.save()
  g.globalAlpha = alpha
  g.font = MONO(size, 500)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  for (let r = 0; r < n; r++) {
    const addr = (Math.floor(scroll) + r) * cols
    let line = addr.toString(16).padStart(6, '0') + '  '
    for (let c = 0; c < cols; c++) {
      const k = r * 997 + c * 31 + Math.floor(scroll)
      line += HEXCH[Math.floor(hash01(k, seed) * 16)] + HEXCH[Math.floor(hash01(k, seed + 5) * 16)] + ' '
    }
    g.fillStyle = r % 3 === 0 ? C.green : C.fgDim
    g.fillText(line, x, y + r * rowH)
  }
  g.restore()
  return n * rowH
}

export function bootLog(g, { x, y, lines, alpha = 1, size = UI_PX, color = C.fgDim, lh = 1.5, maxH = Infinity, maxW = 0 }) {
  const rowH = size * lh
  g.save()
  g.font = MONO(size, 500)
  // G1：给了 maxW 就按可用宽度折行（放不下时缩短/折行，不缩字号），行数再由 maxH 截断
  const rows = []
  for (const l of lines) {
    const s = typeof l === 'string' ? l : l.text
    const col = typeof l === 'string' ? color : l.color || color
    if (maxW > 0) for (const p of wrapText(g, s, maxW)) rows.push({ text: p, color: col })
    else rows.push({ text: s, color: col })
  }
  const n = Math.max(1, Math.min(rows.length, Math.floor(maxH / rowH)))
  g.globalAlpha = alpha
  g.textAlign = 'left'
  g.textBaseline = 'top'
  rows.slice(0, n).forEach((l, i) => {
    g.fillStyle = l.color
    g.fillText(l.text, x, y + i * rowH)
  })
  g.restore()
  return n * rowH
}

export function progressBar(g, { x, y, w, h = 20, p = 0, alpha = 1, label = '', color = C.cyan, showPct = true, size = UI_PX }) {
  g.save()
  g.globalAlpha = alpha
  g.fillStyle = C.bg1
  roundRect(g, x, y, w, h, h / 2)
  g.fill()
  g.fillStyle = color
  roundRect(g, x, y, Math.max(2, w * clamp(p)), h, h / 2)
  g.fill()
  g.font = MONO(size, 600)
  g.textBaseline = 'middle'
  if (label) {
    g.textAlign = 'right'
    g.fillStyle = C.fgDim
    g.fillText(label, x - 12, y + h / 2)
  }
  if (showPct) {
    g.textAlign = 'left'
    g.fillStyle = C.fg
    g.fillText(`${Math.round(clamp(p) * 100)}%`, x + w + 12, y + h / 2)
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
