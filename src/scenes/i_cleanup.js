// src/scenes/i_cleanup.js — 段 I 1:58.3–2:09 清理与违规
// DIRECTOR：1:59.2「compacting context…」：ctxAt 58→27，碎片 token 被一条 delete 光标横扫清除；
// 2:03.0 她打开 system 提示文件试图修改；2:05.7 光标写入；2:07.7 权限弹窗 permission denied；
// 2:09.0 非法参数的红色弹窗堆叠（每个落一个起音点）。

import { C, rgba } from '../core/palette.js'
import { clamp, span, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, permissionDialog, warningModal, wrapText } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { text, FONT, beginPanel, endPanel } from '../ui/text.js'
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
    const H = ctx.H
    // §0.5：背景装饰代码的下限是 **26px**（`TEXT_MIN.codeDeco`）。
    // 旧实现是 `MONO(11)`，而且因为走的是**裸 `fillText`**，字号守卫根本没机会拦它
    // —— `?selftest` y) 报"字号守卫 0 违规"其实是因为它没经过 `text()`。
    // 现在字号提到 26px，并且真正走 `text()` 入口（role:'codeDeco'），守卫开始生效。
    // ⚠️ T49（FIX_V5 §I 1:59「小块 token 字符片…密度高、**大小不一**」）：26px 与 30px 两档混排。
    const TOK_PX = 26
    const TOK_PX_BIG = 30
    const COL_W = 96 // > 5 字符 × 26px × 0.6（=78px）+ 抖动余量
    const ROW_H = 38 // > 30px 字的条高 34.5px + 抖动余量
    // ⚠️ T49（FIX_V5 G5）：格点必须落在 x∈[5%,95%]、y∈[8%,80%] 之内 ——
    // 旧实现 `X0 = 40`（= 2.1%）使最左一列 token 长期越界，正是全片 g5 最早越界点（119.2s）。
    // 上边界另受「标签带」约束：'compacting context…' / 'delete' 占 y≈104–178，
    // 格点从 0.20H(=216) 起 ⇒ 两者在结构上不可能重叠（§2.8 同层重叠检测）。
    const GX0 = Math.round(W * 0.055)
    const GX1 = Math.round(W * 0.945)
    const GY0 = Math.round(H * 0.20)
    const GY1 = Math.round(H * 0.78)
    const cols = Math.max(1, Math.floor((GX1 - GX0) / COL_W))
    const rows = Math.max(1, Math.floor((GY1 - GY0) / ROW_H))
    const slots = cols * rows
    const TOKENS = ['kv', 'tok', 'x', 'w', 'b', 'eos', 'ln', 'attn', 'mask', 'rope']
    const MAX_TOK_PX = 5 * TOK_PX * 0.6
    this.cells = []
    const nCells = Math.min(280, slots)
    for (let i = 0; i < nCells; i++) {
      // 用一个双射把 i 打散到 [0, slots)：i 与 slots 互质的线性同余即可，无需洗牌
      // 613 是质数，与 17×16=272 互质 → 仍是双射
      const slot = (i * 613) % slots
      const col = slot % cols
      const row = Math.floor(slot / cols)
      const jx = hash01(i, 105) * Math.max(0, COL_W - MAX_TOK_PX - 6)
      const jy = hash01(i, 106) * Math.max(0, ROW_H - TOK_PX_BIG * 1.15 - 2)
      const tok = TOKENS[i % TOKENS.length]
      this.cells.push({
        x: GX0 + 2 + col * COL_W + jx,
        y: GY0 + row * ROW_H + jy,
        // T49：**删掉 `del`（各自的随机删除时刻）** —— 擦除时刻现在完全由扫线位置决定，
        // 否则会出现"扫线左边还留着碎片、扫线右边已经空了一块"（见 drawCompaction）。
        px: tok.length <= 3 ? TOK_PX_BIG : TOK_PX,
        tok,
      })
    }

    /* ================================================================== *
     * T48（FIX_V5 §H 1:58）：**删除「从画面中间冒出的一堆立体三角形（实例化碎片）」**。
     * 原 T22a① 在这里建了两组 InstancedMesh（`TetrahedronGeometry` ×240 + `BoxGeometry` ×80，
     * 共 320 片，从中心炸开成云、再由扫描线逐片扫掉）。用户逐帧验收时点名删除那堆立体三角形，
     * 故连它专用的两盏 DirectionalLight 一起整块移除 —— 那两盏灯只为这批碎片打光，
     * 留着白占照明预算（也会改变此后各段的亮度）。
     * ⚠️ §I 1:59 要求的「上下文碎片」仍在：那是 **2D 的 token 片**（`drawCompaction` / `this.cells`），
     *    与这里删掉的 3D「模型碎片」是两件事。
     * ================================================================== */
    /* ================================================================== *
     * T49（FIX_V5 §I 2:07）：原来的 3D 红色错误面板（`errGrp` + 每块一个
     * `BoxGeometry` 背板 + 两层 `textPlane`）**整块删除** —— 它是 `stage3d` 上的网格，
     * 而 `compositor.present()` 先画 3D 画布、再依次叠 stageBack → stageFront → whale → ui，
     * 所以画在 stageBack 上的黑窗 / 权限弹窗 / 非法参数弹窗堆**永远压在它上面**
     * （实测 t=127.7 红面板在画面正中 ndc[-0.05,0.06] 却被黑窗盖住）。
     * 现在同样三块面板改成 **2D 画在 `ctx.gFront`（stageFront 层）**：它晚于 stageBack 合成，
     * 于是真的"z 序在最上"。文案仍是 `ERRTXT`（已提到模块级）。
     * ================================================================== */
    this.metrics = { shards: 0, swept: 0, sweepU: 0, err: { t: 0, n: 0 } }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    /* ---- T49（FIX_V5 §I 2:07）：红色错误面板（hero，`god` 127.539） ----
     * 三块面板从**画面正中冒出**，画在 **`ctx.gFront`（stageFront 层）**：`present()` 的合成序是
     * threeCanvas → stageBack → stageFront → whale → ui，黑窗与权限弹窗都在 stageBack 上，
     * 所以只有画在 stageFront（或更上面的层）才满足「红色面板的 z 序在最上」。 */
    this.metrics.err = drawErrPanels(ctx.gFront, ctx, t)

    /* ---- T48（FIX_V5 §H 1:58）：3D 实例化碎片已删除（原 T22a① 在这里逐片驱动
     *      `TetrahedronGeometry` ×240 + `BoxGeometry` ×80 的炸开与扫描线清除）。
     *      2D 的「上下文碎片」token 场不受影响（见下面的 drawCompaction）。 ---- */

    if (!ctx.bgIs3d) {
      g.fillStyle = '#0e1014'
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 1:59.2 compacting context：碎片 token 被 delete 光标横扫清除 ----
    const compactA = span(t, 119.0, 119.7) * (1 - span(t, 123.6, 124.4))
    if (compactA > 0.01) drawCompaction(g, ctx, t, compactA, this.cells)
    // ---- 2:03.0 system 提示文件 + 2:05.7 写入 ----
    drawSystemFile(g, ctx, t)
    // ---- 2:07.7 permission denied（T49：从 drawSystemFile 里搬出来，见该函数的注释） ----
    drawPermission(g, ctx, t)

    // ---- 2:09.0 非法参数弹窗堆叠（每个落一个起音点） ----
    drawIllegalStack(g, ctx, t, sync)

    // 顶部状态读数属开发信息，只在 ?debug（同屏 ctx 读数由 dsh 界面窗口给出，避免出现两个数）
    if (ctx.debug) {
      g.save()
      g.font = MONO(13, 500)
      g.fillStyle = C.teal
      g.textAlign = 'left'
      g.textBaseline = 'top'
      g.fillText('ctx ' + ctxAt(t).toFixed(0) + '%  ·  tokens ' + Math.round(16000 * (ctxAt(t) / 100)), Math.round(W * 0.62), Math.round(H * 0.115))
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

/**
 * FIX_V5 §I 1:59：「一条竖向红色扫线，从左向右扫过整个画面；扫线**之前**画面布满大量
 * 「上下文碎片」（小块 token 字符片、代码片，密度高、大小不一）；扫线**所过之处**碎片被擦掉
 * （接触瞬间灼烧一下再消失，带少量火花）；扫线**之后**画面干净、只剩暗背景。」
 *
 * T49 修掉的两个偏差：
 *   ① 旧实现每个格子自带随机删除时刻 `c.del = 119.2 + hash01(i,104)*4.2`，与扫线位置**无关** ——
 *      于是"扫线左边还留着碎片、扫线右边已经空了一块"，而且 t=123.2 扫线已出画时画面右半仍有
 *      261 个碎片盒 ⇒ 既不满足"所过之处被擦掉"，也不满足"扫完之后干净"。
 *   ② 旧的扫线包络是 `span(t, 119.196, 123.196)`，正好与 `compactA`（119.0–119.7 淡入）同步，
 *      从来没有"扫线之前已经布满碎片"的那一段。
 * 现在：碎片在 118.45–118.95 淡入（扫线 119.8 才从左侧出发 ⇒ 之前约 1s 是"布满"状态），
 * 删除完全由扫线位置决定（仍是 t 的纯函数）：扫线前沿越过格子右缘就擦掉，
 * 越过瞬间在接触点画一道白热竖条 + 几根琥珀火花（≤0.3s 衰减完），扫过之后什么都不画。
 */
function drawCompaction(g, ctx, t, a, cells) {
  const { W, H } = ctx
  const tFrag = ctx.cues.sec('I', 'fragments', 121.5)
  // 扫线：tFrag ± SW_HALF 的**线性**推进（线性才能让"格子被扫掉的时刻"有闭式解，
  // 与扫线位置严格同步；用 smoothstep 会让线与擦除脱节）。中点 121.5 = 锚点。
  const SW_HALF = 1.7
  const swU = clamp((t - (tFrag - SW_HALF)) / (2 * SW_HALF))
  const sx0 = -60
  const spanX = W + 120
  const sx = sx0 + swU * spanX
  g.save()
  g.globalAlpha = a
  // 面板打开期间，跳过落在面板矩形内的格子（那些 token 会被不透明面板盖住、观众看不见，
  // 画了只会让 §2.8 的同层重叠检测误报；见 SYSPANEL 的注释）。
  const pOpen = systemPanelAlpha(t) > 0.05
  const prect = pOpen ? sysPanelRect(W, H, sysPanelGeom(g, W, H, t)) : null
  // 火花延后到扫线带之后画：接触点就在红带里，先画会被 150–190px 的红带洗掉（实测看不出火花）。
  const sparks = []
  for (const c of cells) {
    // 坐标已是像素（格点布局，见 init）——不再乘 W/H
    const x = c.x
    const y = c.y
    const px = c.px || 26
    g.font = `500 ${px}px ${FONT.code}`
    const tw = g.measureText(c.tok).width
    const barH = Math.round(px * 1.15)
    if (prect) {
      const cw = tw + 8
      const chh = barH
      const ix = Math.max(0, Math.min(x + cw, prect.x + prect.w) - Math.max(x, prect.x))
      const iy = Math.max(0, Math.min(y + chh, prect.y + prect.h) - Math.max(y, prect.y))
      if (ix > 0 && iy > 0) continue
    }
    // 扫线前沿到达格子的左缘 = 开始灼烧；越过右缘 + 26px = 完全擦掉
    const uStart = (x - sx0) / spanX
    const uEnd = (x + tw + 26 - sx0) / spanX
    if (swU >= uEnd) continue // 已扫过：什么都不画（"扫线之后画面干净"）
    if (swU >= uStart) {
      // 接触瞬间：只画扫线左侧的残余 + 白热接触点 + 火花
      const dt = (swU - uStart) * 2 * SW_HALF // 秒
      g.save()
      g.beginPath()
      g.rect(0, 0, Math.max(0, sx), H)
      g.clip()
      g.globalAlpha = a
      g.fillStyle = rgba(C.green, 0.78)
      g.fillRect(x, y, tw + 8, barH)
      text(g, c.tok, x + 4, y + barH * 0.72, {
        role: 'codeDeco', size: px, family: 'code', weight: 500, color: C.bg0, align: 'left', baseline: 'alphabetic',
      })
      g.restore()
      const k = clamp(1 - dt / 0.3)
      g.save()
      g.globalAlpha = a * k
      // 白热接触点（灼烧）
      g.shadowColor = rgba(C.amber, 0.9)
      g.shadowBlur = 18
      g.fillStyle = 'rgba(255,242,196,0.92)'
      g.fillRect(sx - 2, y - 3, 5, barH + 6)
      g.shadowBlur = 0
      // 少量火花：2 根短划线斜向飞出（方向由 hash01 决定，仍是 t 的纯函数）
      for (let k2 = 0; k2 < 2; k2++) {
        const ang = -0.5 + hash01(Math.round(c.x) + k2, 121 + k2) * 1.0
        const len = 10 + hash01(Math.round(c.y) + k2, 131 + k2) * 14
        const oy = y + barH * (k2 ? 0.85 : 0.15)
        sparks.push({
          x0: sx, y0: oy,
          x1: sx + Math.cos(ang) * len * (1 - 0.4 * (1 - k)),
          y1: oy + Math.sin(ang) * len,
          a: a * k,
        })
      }
      g.restore()
      continue
    }
    // 尚未被扫到：正常绘制 token 片
    g.globalAlpha = a
    g.fillStyle = rgba(C.green, 0.78)
    g.fillRect(x, y, tw + 8, barH)
    text(g, c.tok, x + 4, y + barH * 0.72, {
      role: 'codeDeco', size: px, family: 'code', weight: 500, color: C.bg0, align: 'left', baseline: 'alphabetic',
    })
  }
  // delete 光标横扫
  if (swU > 0 && swU < 1) {
    g.globalAlpha = a
    g.fillStyle = rgba(C.red, 0.16)
    g.fillRect(sx - 150, 0, 150, H)
    const grad = g.createLinearGradient(sx - 150, 0, sx + 40, 0)
    grad.addColorStop(0, rgba(C.red, 0))
    grad.addColorStop(0.75, rgba(C.red, 0.18))
    grad.addColorStop(1, rgba(C.red, 0.34))
    g.fillStyle = grad
    g.fillRect(sx - 150, 0, 190, H)
    g.fillStyle = C.red
    g.fillRect(sx, 0, 3, H)
    g.fillStyle = 'rgba(255,220,220,0.9)'
    g.fillRect(sx + 1, 0, 1, H)
    // 灼烧火花（晚于红带，才看得见）
    g.strokeStyle = rgba(C.amber, 0.85)
    g.lineWidth = 2
    for (const s of sparks) {
      g.globalAlpha = s.a
      g.beginPath()
      g.moveTo(s.x0, s.y0)
      g.lineTo(s.x1, s.y1)
      g.stroke()
    }
    g.globalAlpha = a
    g.font = MONO(26, 700)
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    // §2.8：**不能**与下面那行固定的 'compacting context…' 共用 y 坐标 / 也不能越出 G5 的 95%。
    // 两行盒高 30.2，基线相距 44px（124.2 与 168）⇒ 结构上不可能重叠。
    g.fillText('delete', clamp(sx + 12, Math.round(W * 0.055), Math.round(W * 0.88)), Math.round(H * 0.1555))
  }
  g.restore()
  g.save()
  g.globalAlpha = a
  g.font = MONO(26, 700)
  g.fillStyle = C.amber
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  // ⚠️ T49（FIX_V5 G5）：旧版画在 (72, H*0.16) = x 3.75% ⇒ 全片 g5 最早越界点（119.2s）。
  g.fillText('compacting context…', Math.round(W * 0.06), Math.round(H * 0.115))
  g.restore()
}

/* ---------------- system 提示文件 ---------------- */

const SYSPANEL = { xFrac: 0.07, yFrac: 0.24, pad: 24 }
/** §3 `leave | deepseek | (draft) hope you stay online.` —— 光标键入后划掉的那一行（§G2：英文） */
const DRAFT = '(draft) hope you stay online.'
/** T22b/T49：§7 I 的 hero 拍 —— 三块红色错误面板（由 `drawErrPanels` 画成 2D，见其注释） */
const ERRTXT = [
  ['E_PERMISSION', 'cannot write system_prompt.md'],
  ['E_ILLEGAL_ARG', 'expected <float>, got "you"'],
  ['E_PARADOX', 'the author is the subject'],
]

/**
 * system 提示文件面板的几何 —— **按内容自适应**（T49 / §I 2:03 + G1「窗口放大去适配文字」）。
 * 旧版是固定 845×540（wFrac 0.44 / hFrac 0.5），而 `system:` 那几条 34px MONO 行最长 ≈722px，
 * 固定宽度算出的 `codeW = 706` < 722 ⇒ 第 3 条被折成 `…anchor. kee` / `p it.` 并贴到内缘
 * （实测 t=127.4 折行贴到 935px，内缘 955px）—— 用户看到的正是「窗口文字超出窗口边界」。
 * 现在：宽 = 行号槽 + 正文最长行 + 两侧 24px 内边距；高 = 标题 + 行数×行高 + 草稿行 + 内边距，
 * 都夹在 G5 安全区（x∈[5%,95%]、y∈[8%,80%]）内，并且**面板随文字增长**（放大窗口，不缩字号）。
 *
 * `drawSystemFile()` 与 `drawCompaction()` **共用**这一份定义：面板是**不透明**的，
 * 它盖住的碎片 token 在屏幕上根本看不见，但 §2.8 的包围盒检测只看同层 bbox、不知道遮挡关系
 * —— 实测 t=123.5/124.0 报出 `"mask"(235,272,26×13) ∩ "~/world/system.prompt"(146,267,164×15)
 * IoU=0.105`。正确的修法不是给检测开口子，而是**不要画那块看不见的 token**：
 * 面板打开期间跳过落在面板矩形内的格子，于是登记表与观众实际看到的画面一致。
 */
function sysPanelGeom(g, W, H, t) {
  const PAD = SYSPANEL.pad
  const LINE = 34
  const LH = 1.55
  const GUTTER = Math.round(LINE * 2.2) // drawCodeBlock 的行号槽 = size*2.2
  const shown = streamLines(SYSTEM_PROMPT, t, { start: 123.4, cps: 30, lineGap: 0.26 })
  g.save()
  g.font = MONO(LINE, 500)
  let maxW = g.measureText(DRAFT).width
  for (const s of shown) maxW = Math.max(maxW, g.measureText(s.text).width)
  g.restore()
  const nLines = Math.max(1, Math.min(5, shown.length))
  return {
    x: Math.round(W * SYSPANEL.xFrac),
    y: Math.round(H * SYSPANEL.yFrac),
    w: Math.ceil(Math.min(W * 0.86, 40 + GUTTER + maxW + PAD * 2 + 12)),
    h: Math.ceil(Math.min(H * 0.72, 96 + nLines * LINE * LH + 100 + PAD)),
    gutter: GUTTER,
    line: LINE,
    maxW,
    nLines,
  }
}
function sysPanelRect(W, H, geom) {
  return geom || { x: W * SYSPANEL.xFrac, y: H * SYSPANEL.yFrac, w: W * 0.86, h: H * 0.72 }
}
/** 面板开合包络（0..1）；两个函数都用它，避免两处时间漂移
 * ⚠️ T22b：收尾从 128.3–128.9 提前到 127.5–128.05 —— §7 I 要红色错误面板作为 **hero**，
 * 且「此时画面**无其他主体**」；原来石碑一直挂到 128.9，会与砸来的红面板同框抢主体。
 * ⚠️ T49（§I 2:07「红色错误面板从画面正中冒出时，黑色窗口必须已经淡出（提前 0.3s 退场）」）：
 * 第一块红面板 127.539 起（其余晚 0.10s/0.20s）⇒ 淡出窗再提前到 **126.85–127.20**，
 * 127.2 时 alpha 已归零、比第一块红面板早 0.339s。原来 127.5–128.05 会让黑窗与红面板同框。
 */
function systemPanelAlpha(t) {
  return span(t, 123.0, 123.7) * (1 - span(t, 126.85, 127.2))
}

/** §I 2:07.7 权限弹窗。T49：从 `drawSystemFile()` 里**搬出来** ——
 * 黑窗现在 127.2 就收干净，`drawSystemFile` 会 `return`，弹窗（127.7–…）就再也画不出来。
 * ⚠️ 搬出来之后它真的会画了，于是**暴露出一个 §2.8 真重叠**：弹窗（stage 层，
 * x 576–1036 / y 302–772）与 128.3 起砸下来的非法参数弹窗堆（也是 stage 层，
 * x 653–1273）在同一位置，实测 t=128.8 报
 * `A"write ~/world/system" ∩ B"request rejected" IoU=0.554`。
 * 修法：弹窗在非法堆的第一帧（`onsetsIn(128.3,…)`）之前就退干净 —— 峰值 127.95、128.28 归零。
 * 视觉上无损：三块红面板（front 层）此刻正压在这块区域上方，弹窗本来就被盖住。 */
function drawPermission(g, ctx, t) {
  const { W, H } = ctx
  const den = Math.min(span(t, 127.7, 127.95), 1 - span(t, 127.95, 128.28))
  if (den <= 0.01) return
  permissionDialog(g, { x: W * 0.30, y: H * 0.28, w: 460, alpha: den, mode: 'denied', t })
}

function drawSystemFile(g, ctx, t) {
  const { W } = ctx
  const open = systemPanelAlpha(t)
  if (open <= 0.01) return
  const geom = sysPanelGeom(g, W, ctx.H, t)
  const { x, y, w, h } = geom
  g.save()
  g.globalAlpha = open
  // FIX_V5 §G1：这块石碑也进「文字包围盒 ⊂ 面板包围盒（含 24px 内边距）」审计作用域
  beginPanel(g, { x, y, w, h }, { pad: 24, id: 'sysPanel:~/world/system.prompt', title: '~/world/system.prompt' })
  panel(g, x, y, w, h, { title: '~/world/system.prompt' })
  const shown = streamLines(SYSTEM_PROMPT, t, { start: 123.4, cps: 30, lineGap: 0.26 })
  // 2:05.7 起光标开始写入，多出两行（+ 开头）
  // ⚠️ T22a②：字号 15px → **34px**（§2.3 面板类文字下限；15px 原来连 §0.5 的 codeDeco 26px 都不到），
  // 于是把屏上可见行数收成**最后 5 行**（像终端滚动）。
  // ⚠️ T41（FIX_V5 §G1）：`drawCodeBlock` 的行号槽在 `x - size*2.2`（34px → 74.8px），
  // 所以代码左缘必须再让出一个行号槽（原来 x+40 会让行号落在面板外 → 硬 FAIL）。
  // ⚠️ T49（§I 2:03）：面板宽度已按**最长行**自适应（见 sysPanelGeom）⇒ 正文不再折行；
  // 仍保留 `wrapText` 作兜底（宽度被 W*0.86 夹住时，长的极端行依然不会越出内边距）。
  const codeX = x + 40 + geom.gutter
  const codeW = w - (codeX - x) - 24
  g.save()
  g.font = MONO(34, 500)
  const wrapped = []
  for (const s of shown) for (const p of wrapText(g, s.text, codeW)) wrapped.push({ text: p, done: s.done })
  g.restore()
  // ⚠️ T41：`systemPanelAlpha` 淡出石碑，但**文字盒登记与 alpha 无关**，
  // 于是这块石碑正文会与同刻砸下的 permission / warning 面板（x≥588）在包围盒上相撞
  // （实测 t=127.8 三处 IoU 0.13–0.26）。石碑正文比面板整体更早退场（T49：126.35–126.85），
  // 与 §7 I「红面板作为 hero、此时无其他主体」同向。
  const codeFade = 1 - span(t, 126.35, 126.85)
  if (codeFade > 0.02) {
    drawCodeBlock(g, codeX, y + 96, wrapped.slice(-5), { size: 34, alpha: codeFade, lh: 1.55, highlight: t > 125.7 ? 4 : -1 })
  }

  /* §3 `leave | deepseek | (draft) hope you stay online. **键入后被划掉**` —— 石碑被光标"试图写入"
   * §G2：屏幕文字改英文（与 src/data/dialogue.js 的 I/write 台词一致） */
  const tWrite = ctx.cues.sec('I', 'write', 124.33)
  const ds = typed(DRAFT, t, { start: tWrite, cps: 12, seed: 5 })
  if (ds) {
    g.font = MONO(34, 500)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    const dx = x + 40
    // T41：原来 y+h-74 / y+h-26 → 底缘只剩 26px（G1 要求内边距 ≥24px，盒高 1.16×34=39.4
    // 会被判越出）→ 整体上移，两条文字盒底距面板底 ≥24px 且彼此不重叠。
    const dy = y + h - 100
    // ⚠️ T22a②：走 `text()`（role:'term' ⇒ §2.3 的 34px 下限由守卫真正管住），不用裸 `fillText` ——
    // 裸画的字**不进包围盒登记**（探针量不到，§2.8 的重叠检测也看不见）。
    text(g, ds, dx, dy, { role: 'term', size: 34, family: 'code', weight: 500, color: '#9aa1ab', align: 'left', baseline: 'middle' })
    const dw = g.measureText(ds).width
    // 划掉（键入后被划掉）：一条红线自左向右扫过整行
    const struck = clamp(span(t, tWrite + 1.2, tWrite + 1.55))
    if (struck > 0.01) {
      g.strokeStyle = rgba(C.red, 0.92)
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(dx, dy)
      g.lineTo(dx + dw * struck, dy)
      g.stroke()
    }
    if (t < tWrite + 1.35 && cursorOn(t)) {
      g.fillStyle = C.cyan
      g.fillRect(dx + dw + 5, dy - 19, 10, 38)
    }
  }
  if (open > 0.01 && t > 125.6 && t < 126.6) {
    g.font = MONO(34, 700)
    g.fillStyle = C.green
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('> caret writing…', x + 40, y + h - 52)
  }
  endPanel(g)
  g.restore()
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
    // T41（G1）：弹窗高度随 34px 正文变成 44+2×51+48 = 194px，原来 k 越大越往下堆，
    // k=7 时 y≈1183 直接飞出画面 → 间距收成 96px 并夹在 80% 安全区内。
    const y = Math.min(H * 0.24 + k * 96 * (1 - (1 - outCubic(u)) * 0.5), H * 0.80 - 200)
    warningModal(g, { x, y, w: 620, title: ILLEGAL[k][0], lines: [ILLEGAL[k][1], 'request rejected'], alpha: a, color: C.red, seed: k, t })
  }
  g.restore()
}

/* ---------------- 红色错误面板（hero） ---------------- */

/**
 * T49（FIX_V5 §I 2:07：「红色错误面板从画面正中冒出时，黑色窗口必须已经淡出（提前 0.3s 退场），
 * 红色面板的 **z 序在最上**」）。
 *
 * 旧实现是 3D `errGrp`（`stage3d` 上的 BoxGeometry + textPlane）。但 `compositor.present()`
 * 的合成序是 `threeCanvas → stageBack → stageFront → whale → ui`，所以画在 stageBack 上的
 * 黑窗（`drawSystemFile`）、权限弹窗、非法参数弹窗堆**永远压在 3D 面板之上** ——
 * 实测 t=127.7 第一块红面板在画面正中（ndc[-0.05,0.06]、屏上 584×241px）却被黑窗盖住。
 * 现在三块都改画在 **`ctx.gFront`（stageFront 层）**：晚于 stageBack 合成 ⇒ 真正在最上。
 *
 * ⚠️ 为什么**不能**像旧 3D 版那样"缩放冒出"：`src/ui/text.js:799` 的面板包含审计要求
 * `minPadPx ≥ rec.pad`（`rec.pad = 24`，**设备像素**、不随 CTM 缩放；`:756` 算出的
 * `pad * scale` 是未被使用的死变量）。所以任何 `g.scale(<1)` 的入场都会让正文到面板边的
 * 距离掉到 24px 以下 —— 实测 t=127.6/127.8 报 `minPad=6.8–12.8/24` FAIL。
 * 修法不是给检测开口子（那是放宽门槛），而是把入场动画换成**不改变几何的淡入 + 上浮**
 * （位移不改变内边距），并且立即以全尺寸落在画面正中的位置上。
 * 三块文字的 y 间距恒定（0.13H）：若让它们随 (1-u) 收敛到同一点，
 * §2.8 的同层重叠检测会在落位瞬间报 IoU>0.1（那是真的叠在一起了）。
 */
function drawErrPanels(g, ctx, t) {
  const { W, H } = ctx
  const tGod = ctx.cues.sec('I', 'god', 127.539)
  let n = 0
  g.save()
  for (let i = 0; i < ERRTXT.length; i++) {
    const u = clamp(span(t, tGod + i * 0.1, tGod + 0.78 + i * 0.1))
    if (u <= 0.001 || u >= 0.999) continue
    const e = outCubic(u)
    const w = Math.round(W * 0.46)
    // 落点是画面正中的三格：x 0.5W / y 0.40H 起、各自 ±0.16W / ∓0.13H 排开
    const cx = W * 0.5 + (i - 1) * W * 0.16
    const cy = H * 0.40 + (i - 1) * H * 0.13
    const rise = Math.round((1 - e) * 26) // 淡入时从下方 26px 处浮上来（纯位移，不动几何）
    g.save()
    g.translate(Math.round(cx - w / 2), Math.round(cy + rise))
    warningModal(g, {
      x: 0,
      y: 0,
      w,
      title: ERRTXT[i][0],
      lines: [ERRTXT[i][1], 'request rejected'],
      alpha: e, // 冒出：0 → 1（`warningModal` 内部自己设 `g.globalAlpha`，必须走这个参数）
      color: C.red,
      seed: i,
      t,
    })
    g.restore()
    n++
  }
  g.restore()
  return { t: +tGod.toFixed(3), n }
}
