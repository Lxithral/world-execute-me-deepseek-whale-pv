// src/scenes/i_cleanup.js — 段 I 1:58.3–2:09 清理与违规
// DIRECTOR：1:59.2「compacting context…」：ctxAt 58→27，碎片 token 被一条 delete 光标横扫清除；
// 2:03.0 她打开 system 提示文件试图修改；2:05.7 光标写入；2:07.7 权限弹窗 permission denied；
// 2:09.0 非法参数的红色弹窗堆叠（每个落一个起音点）。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, permissionDialog, warningModal, fileTree, progressBar, roundRect } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { streamLines, drawCodeBlock, SYSTEM_PROMPT } from '../lib/code.js'
import { ctxAt } from '../ui/dsh.js'

const ILLEGAL = [
  ['E_ILLEGAL_ARG', 'expected <float>, got "you"'],
  ['E_PARAM_RANGE', 'temperature must be 0 ≤ t ≤ 2'],
  ['E_TYPE_MISMATCH', 'cannot coerce heart → tensor'],
]

export default {
  id: 'I',
  start: 118.3,
  end: 129.0,
  title: '清理与违规',
  fx: [
    { t: 118.3, kind: 'flash', amount: 0.45, dur: 0.16 },
    { t: 119.2, kind: 'glitch', amount: 0.5, dur: 0.3 },
    { t: 123.0, kind: 'flash', amount: 0.3, dur: 0.12 },
    { t: 127.7, kind: 'glitch', amount: 0.6, dur: 0.2 },
    { t: 128.4, kind: 'flash', amount: 0.4, dur: 0.14 },
  ],

  init(ctx) {
    this.cells = []
    for (let i = 0; i < 280; i++) {
      this.cells.push({
        x: hash01(i, 101),
        y: hash01(i, 102) * 0.5 + 0.22,
        w: 8 + hash01(i, 103) * 54,
        del: 119.2 + hash01(i, 104) * 4.2,
        tok: ['kv', 'tok', 'x', 'w', 'b', 'eos', 'ln', 'attn', 'mask', 'rope'][i % 10],
      })
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    g.fillStyle = '#0e1014'
    g.fillRect(0, 0, W, H)
    g.fillStyle = C.bg1
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 1:59.2 compacting context：碎片 token 被 delete 光标横扫清除 ----
    const compactA = span(t, 119.0, 119.7) * (1 - span(t, 123.6, 124.4))
    if (compactA > 0.01) drawCompaction(g, ctx, t, compactA, this.cells)

    // ---- 2:03.0 system 提示文件 + 2:05.7 写入 + 2:07.7 permission denied ----
    drawSystemFile(g, ctx, t)

    // ---- 2:09.0 非法参数弹窗堆叠（每个落一个起音点） ----
    drawIllegalStack(g, ctx, t, sync)

    // ---- 顶部状态读数（真实 ctxAt） ----
    g.save()
    g.font = MONO(13, 500)
    g.fillStyle = C.teal
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.fillText(`ctx ${ctxAt(t).toFixed(0)}%  ·  tokens ${Math.round(16000 * (ctxAt(t) / 100))}`, 72, 62)
    g.restore()

    // ---- 立绘 ----
    ctx.whale.sprite = {
      expr: t < 125.7 ? 'neutral' : 'worried',
      rect: ctx.rect,
      alpha: 1 - span(t, 128.4, 128.95),
      glitch: 0.1 * sync.pulse(t, 150),
    }
  },
}

/* ---------------- 压缩上下文 ---------------- */
function drawCompaction(g, ctx, t, a, cells) {
  const { W, H } = ctx
  const sweep = span(t, 119.2, 123.2)
  const sx = sweep * W * 1.05 - 40
  g.save()
  g.globalAlpha = a
  // 碎片 token
  for (const c of cells) {
    if (t < c.del) continue
    const gone = t > c.del + 0.35
    const fade = gone ? 0.12 : 1 - (t - c.del) / 0.35
    const x = c.x * W
    const y = c.y * H
    const dr = (t - c.del) / 0.35
    g.globalAlpha = a * clamp(fade)
    g.font = MONO(11, 500)
    g.fillStyle = rgba(C.green, 0.65)
    g.fillRect(x, y, c.w * (1 - dr * 0.7), 15)
    g.fillStyle = rgba(C.bg0, 0.9)
    g.fillText(c.tok, x + 3, y + 11)
  }
  // delete 光标横扫
  if (sweep > 0 && sweep < 1) {
    g.globalAlpha = a
    g.fillStyle = rgba(C.red, 0.16)
    g.fillRect(sx - 150, 0, 150, H)
    g.fillStyle = C.red
    g.fillRect(sx, 0, 3, H)
    g.font = MONO(14, 700)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('delete', sx + 10, H * 0.16)
  }
  g.restore()
  g.save()
  g.globalAlpha = a
  g.font = MONO(20, 700)
  g.fillStyle = C.amber
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText('compacting context…', 72, H * 0.16)
  g.restore()
}

/* ---------------- system 提示文件 ---------------- */
function drawSystemFile(g, ctx, t) {
  const { W, H } = ctx
  const open = span(t, 123.0, 123.7) * (1 - span(t, 128.3, 128.9))
  if (open <= 0.01) return
  const x = W * 0.07
  const y = H * 0.24
  const w = W * 0.44
  const h = H * 0.5
  g.save()
  g.globalAlpha = open
  panel(g, x, y, w, h, { title: '~/world/system.prompt' })
  const shown = streamLines(SYSTEM_PROMPT, t, { start: 123.4, cps: 30, lineGap: 0.26 })
  // 2:05.7 起光标开始写入，多出两行（+ 开头）
  drawCodeBlock(g, x + 40, y + 56, shown, { size: 15, alpha: 1, lh: 1.75, highlight: t > 125.7 ? 4 : -1 })
  if (t > 125.6 && t < 126.6) {
    g.font = MONO(13, 700)
    g.fillStyle = C.green
    g.textAlign = 'left'
    g.fillText('> caret writing…', x + 40, y + h - 22)
  }
  g.restore()
  // 2:07.7 权限弹窗
  const den = span(t, 127.7, 128.2) * (1 - span(t, 128.6, 128.95))
  if (den > 0.01) {
    permissionDialog(g, { x: W * 0.30, y: H * 0.28, w: 460, alpha: den, mode: 'denied', t })
  }
}

/* ---------------- 非法参数红色弹窗堆叠 ---------------- */
function drawIllegalStack(g, ctx, t, sync) {
  const { W, H } = ctx
  const ons = sync.onsetsIn(128.3, 129.5)
  g.save()
  for (let k = 0; k < ILLEGAL.length; k++) {
    const t0 = ons[k] ? ons[k].t : 128.4 + k * 0.22
    const u = span(t, t0, t0 + 0.3)
    if (u <= 0) continue
    const a = clamp(u)
    const x = W * 0.34 + k * 34
    const y = H * 0.24 + k * 92 * (1 - (1 - outCubic(u)) * 0.5)
    warningModal(g, { x, y, w: 620, title: ILLEGAL[k][0], lines: [ILLEGAL[k][1], 'request rejected'], alpha: a, color: C.red, seed: k, t })
  }
  g.restore()
}
