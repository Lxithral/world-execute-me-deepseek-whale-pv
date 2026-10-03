// src/scenes/i_cleanup.js — 段 I 1:58.3–2:09 清理与违规
// DIRECTOR：1:59.2「compacting context…」：ctxAt 58→27，碎片 token 被一条 delete 光标横扫清除；
// 2:03.0 她打开 system 提示文件试图修改；2:05.7 光标写入；2:07.7 权限弹窗 permission denied；
// 2:09.0 非法参数的红色弹窗堆叠（每个落一个起音点）。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, permissionDialog, warningModal, fileTree, progressBar, roundRect } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { text, FONT } from '../ui/text.js'
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
    // ---- 碎片 token 场（FIX_V3 §2.8：**必须是互不重叠的格点**）----
    //
    // 旧实现用 `hash01(i,101)` / `hash01(i,102)` 在整屏上直接撒 280 个点，再用 MONO(11) 写 token。
    // 单字符约 6.6px、最长 token 4 字符约 26px，于是 280 个 26×13 的盒子撒在 1920×540 上必然互相压住。
    // `?probe=textscan` 在 120.5–124s 实测报出：
    //   "ln"(1821,297,13×13) ∩ "eos"(1827,301,20×13)  IoU=0.174
    //   "mask"(535,484,26×13) ∩ "rope"(554,485,26×13) IoU=0.151
    // 正是 §2.8 点名的两个首要怀疑对象（"同一行被多次绘制 / 多行共用同一 y 坐标"）的同类成因。
    //
    // 改成格点布局：列距 > 最长 token 宽 + 抖动上限，于是相邻格子**在结构上**不可能重叠。
    // 仍用 hash01 决定"取哪些格子 / 格子内怎么抖"，所以结果依旧是 t 的纯函数（selftest a 不变）。
    const W = ctx.W
    // §0.5：背景装饰代码的下限是 **26px**（`TEXT_MIN.codeDeco`）。
    // 旧实现是 `MONO(11)`，而且因为走的是**裸 `fillText`**，字号守卫根本没机会拦它
    // —— `?selftest` y) 报"字号守卫 0 违规"其实是因为它没经过 `text()`。
    // 现在字号提到 26px，并且真正走 `text()` 入口（role:'codeDeco'），守卫开始生效。
    const TOK_PX = 26
    const COL_W = 84 // > 5 字符 × 26px × 0.6（=78px）+ 余量
    const ROW_H = 36 // > 26px 字的盒高 30.2px + 抖动
    const X0 = 40
    const Y0 = ctx.H * 0.22
    const cols = Math.max(1, Math.floor((W - X0 * 2) / COL_W))
    const rows = 15
    const slots = cols * rows
    const TOKENS = ['kv', 'tok', 'x', 'w', 'b', 'eos', 'ln', 'attn', 'mask', 'rope']
    const MAX_TOK_PX = 5 * TOK_PX * 0.6
    this.cells = []
    for (let i = 0; i < 280; i++) {
      // 用一个双射把 i 打散到 [0, slots)：i 与 slots 互质的线性同余即可，无需洗牌
      // 613 与 22×15=330 不互质（613 是质数，330=2·3·5·11，互质）→ 仍是双射
      const slot = (i * 613) % slots
      const col = slot % cols
      const row = Math.floor(slot / cols)
      const jx = hash01(i, 105) * Math.max(0, COL_W - MAX_TOK_PX - 4)
      const jy = hash01(i, 106) * Math.max(0, ROW_H - TOK_PX * 1.2 - 2)
      this.cells.push({
        x: X0 + col * COL_W + jx,
        y: Y0 + row * ROW_H + jy,
        w: 0, // 宽度在绘制时按实测文字宽度定（见 drawCompaction）
        del: 119.2 + hash01(i, 104) * 4.2,
        tok: TOKENS[i % TOKENS.length],
      })
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    if (!ctx.bgIs3d) {
      g.fillStyle = '#0e1014'
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 1:59.2 compacting context：碎片 token 被 delete 光标横扫清除 ----
    const compactA = span(t, 119.0, 119.7) * (1 - span(t, 123.6, 124.4))
    if (compactA > 0.01) drawCompaction(g, ctx, t, compactA, this.cells)
    // ---- 2:03.0 system 提示文件 + 2:05.7 写入 + 2:07.7 permission denied ----
    drawSystemFile(g, ctx, t)

    // ---- 2:09.0 非法参数弹窗堆叠（每个落一个起音点） ----
    drawIllegalStack(g, ctx, t, sync)

    // 顶部状态读数属开发信息，只在 ?debug（同屏 ctx 读数由 dsh 界面窗口给出，避免出现两个数）
    if (ctx.debug) {
      g.save()
      g.font = MONO(13, 500)
      g.fillStyle = C.teal
      g.textAlign = 'left'
      g.textBaseline = 'top'
      g.fillText('ctx ' + ctxAt(t).toFixed(0) + '%  ·  tokens ' + Math.round(16000 * (ctxAt(t) / 100)), 72, 62)
      g.restore()
    }

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
  const tFrag = ctx.cues.sec('I', 'fragments', 121.5)
  const sweep = span(t, tFrag - 2.3, tFrag + 1.7)
  const sx = sweep * W * 1.05 - 40
  g.save()
  g.globalAlpha = a
  // 碎片 token（§0.5：背景装饰代码 ≥26px，走 text() 让守卫真正生效）
  const TOK_PX = 26
  g.font = `500 ${TOK_PX}px ${FONT.code}`
  // 面板打开期间，跳过落在面板矩形内的格子（那些 token 会被不透明面板盖住、观众看不见，
  // 画了只会让 §2.8 的同层重叠检测误报；见 SYSPANEL 的注释）。
  const pOpen = systemPanelAlpha(t) > 0.05
  const prect = pOpen ? sysPanelRect(W, H) : null
  for (const c of cells) {
    if (t < c.del) continue
    const gone = t > c.del + 0.35
    const fade = gone ? 0.12 : 1 - (t - c.del) / 0.35
    // 坐标已是像素（格点布局，见 init）——不再乘 W/H
    const x = c.x
    const y = c.y
    const tw = g.measureText(c.tok).width
    const barH = Math.round(TOK_PX * 1.15)
    if (prect) {
      const cw = tw + 8
      const chh = barH
      const ix = Math.max(0, Math.min(x + cw, prect.x + prect.w) - Math.max(x, prect.x))
      const iy = Math.max(0, Math.min(y + chh, prect.y + prect.h) - Math.max(y, prect.y))
      if (ix > 0 && iy > 0) continue
    }
    const dr = (t - c.del) / 0.35
    g.globalAlpha = a * clamp(fade)
    g.fillStyle = rgba(C.green, 0.65)
    g.fillRect(x, y, (tw + 8) * (1 - dr * 0.7), barH)
    text(g, c.tok, x + 4, y + barH * 0.72, {
      role: 'codeDeco', size: TOK_PX, family: 'code', weight: 500, color: C.bg0, align: 'left', baseline: 'alphabetic',
    })
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
    // §2.8：**不能**与下面那行固定的 'compacting context…' 共用 y 坐标。
    // 旧版两行都画在 `H * 0.16`，横扫到 x≈72 时两段文字完全压在一起
    // （实测 t=119.5s "delete"(123,166,50×16) ∩ "compacting context…"(72,157,228×23) IoU=0.137）。
    // 现在横扫标签下移 40px（两行盒高 16.2 + 23.2，40px 间距结构上不可能重叠），
    // 并把 x 夹在画面内，避免横扫到右边缘时标签跑出屏幕。
    g.fillText('delete', clamp(sx + 10, 8, W - 90), H * 0.16 + 40)
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

/**
 * system 提示文件面板的几何与开合包络。
 * `drawSystemFile()` 与 `drawCompaction()` **共用**这一份定义：
 * 面板是**不透明**的，它盖住的碎片 token 在屏幕上根本看不见，
 * 但 §2.8 的包围盒检测只看同层 bbox、不知道遮挡关系 ——
 * 实测 t=123.5/124.0 报出 `"mask"(235,272,26×13) ∩ "~/world/system.prompt"(146,267,164×15) IoU=0.105`。
 * 正确的修法不是在检测上开口子，而是**不要画那块看不见的 token**：
 * 面板打开期间跳过落在面板矩形内的格子，于是登记表与观众实际看到的画面一致。
 */
const SYSPANEL = { xFrac: 0.07, yFrac: 0.24, wFrac: 0.44, hFrac: 0.5 }
function sysPanelRect(W, H) {
  return { x: W * SYSPANEL.xFrac, y: H * SYSPANEL.yFrac, w: W * SYSPANEL.wFrac, h: H * SYSPANEL.hFrac }
}
/** 面板开合包络（0..1）；两个函数都用它，避免两处时间漂移 */
function systemPanelAlpha(t) {
  return span(t, 123.0, 123.7) * (1 - span(t, 128.3, 128.9))
}

function drawSystemFile(g, ctx, t) {
  const { W, H } = ctx
  const open = systemPanelAlpha(t)
  if (open <= 0.01) return
  const { x, y, w, h } = sysPanelRect(W, H)
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
