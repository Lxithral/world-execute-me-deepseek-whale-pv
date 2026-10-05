// src/scenes/l_training.js — 段 L 2:42–2:57.4 训练与星系
// DIRECTOR：2:42.7 训练循环（损失曲线带噪声下降）；2:46.3 大爆炸：粒子与公式四散，汇成螺旋星系
// （权重星云）；2:49.99 输入框出现「对方正在输入…」并反复闪现又消失，从不发送；
// 2:51.95 星系聚成公式球；2:53.7–2:57.4 三棱镜色散收尾，白光裂成光谱。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outExpo } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel } from '../ui/dsh.js'
import { beginPanel, endPanel } from '../ui/text.js'
import { drawMath, FORMULAS } from '../lib/formula.js'
import { lossCurve } from '../lib/tables.js'
import { lossCurvePoints } from '../lib/code.js'
import { createField } from '../lib/three_util.js'
import { cursorOn } from '../ui/typing.js'

export default {
  id: 'L',
  start: 162.0,
  end: 177.4,
  title: '训练与星系',
  fx: [
    // FIX_V3 §4.4：任意 6s 窗口内同类效果最多 2 次。原先这里是 flash，于是
    // [161.726, 167.726) 里有 K 段的 flash 161.726 + 本段 162.0 + 166.3 = **3 次**。
    // 段首的强调改成 **disp**：K 段在 161.726/161.75 同时用了 flash、shake、glitch，
    // 所以只有 disp 这一个 kind 不会在同刻撞车（改成 glitch 或 shake 都会让"同类间隔"这条亮起来）。
    // 节拍强调保留，同类计数降到 ≤2。
    { t: 162.0, kind: 'disp', amount: 0.5, dur: 0.6 },
    { t: 166.3, kind: 'flash', amount: 1.0, dur: 0.34 },
    { t: 166.3, kind: 'shake', amount: 0.9, dur: 0.7 },
    { t: 166.3, kind: 'disp', amount: 0.6, dur: 1.2 },
    // ⚠️ T02 / FIX_V4 §2.4 修复（根因）：这里原本是
    //     `{ t: 171.95, kind: 'flash', amount: 0.6, dur: 0.2 }`
    //   也就是 **2:52 那条"背景变灰"**。实测（480×270 口径）：
    //     t=171.9  mean 0.083  主色 0,0,4   flash 0     ← 正常（近黑）
    //     t=172.0  mean 0.444  主色 **112,112,112**     ← 整屏被洗成中性灰
    //     t=172.2  mean 0.082  主色 0,0,4   flash 0     ← 立即恢复
    //   根因**不是**闪白残留 / 曝光曲线 / 合成层 / fog —— 就是这条被声明的 flash 本身：
    //   `amount` 只有 0.6，半强度的白色叠在近黑画面上，出来的是**整屏中性灰**，
    //   读起来完全像"背景色变成了灰色"，而不是一次闪白（用户原话「应是暗色」，
    //   §1.12 也写「此刻整个背景变成了灰色(约 #3a3a3a),应是暗色」）。
    //   所以直接**删除**这一条：2:52 保持暗底。节拍强调由紧随其后的
    //   `{ t: 173.7, kind: 'disp' … }` 承担，这一刻不会变空。
    //   （若你希望这里仍有一次"真正的闪白"，做法是改成 amount 1.0 / dur 0.08 —— 那是纯白且极短，
    //     与"半强度灰洗"是两回事；但它会在自检里按"闪白时刻"被豁免，请告知你要哪种。）
    { t: 173.7, kind: 'disp', amount: 0.8, dur: 1.4 },
    // 177.4 与段 M 的 `m_algebra.js` 在同一时刻各声明了一条 flash：
    // 段界重影（L 到 177.4 结束、M 从 177.4 开始）。按"边界效果归属开启它的那一段"，
    // 删掉本条，保留 M 的那条。
  ],

  init(ctx) {
    this.loss = lossCurve({ steps: 900, seed: 4242 })
    this.galaxy = createField(26000, 1, { seed: 21, color: '#cbb6ff', size: 2.6, turns: 2.1, spin: 0.07 })
    this.galaxy.object.visible = false
    ctx.three.stage3d.add(this.galaxy.object)
    /* T51 / §K/L 2:51：3D 聊天气泡 + 420 粒碎裂粒子（旧 §1.12 实现）整体删除，
       改由 2D 大号终端窗口承担（`drawTerminal()`）。 */
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    // 词锚点：大爆炸 / 输入框 / 公式球 / 棱镜，各卡一句（FIX §3 段 L）
    const tBang = ctx.cues.sec('L', 'give', 166.3)
    const tBall = ctx.cues.sec('L', 'prism', 171.95)
    const bang = span(t, tBang, tBang + 1.1)
    const ball = span(t, tBall, tBall + 1.15)
    // T51 / §K/L 2:56：光路图要「0.8s 入射 + 0.6s 折射 + 1.2s 扇形」≈ 2.5s 全程渐进出现，
    // 而 `trapped`（实测 175.142）到段末 177.4 只剩 2.26s ⇒ 起点提前到公式球收尾之后
    // （tBall + 1.20 = 174.903）。窗口 2.50s，三段与规格一一对应，且与公式球（到 174.853）不重叠。
    const PRISM_T0 = tBall + 1.2
    const prism = span(t, PRISM_T0, 177.4)

    // 底色：训练期冷灰 → 星系期深紫 → 棱镜期渐白
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex(mixHex(C.bg0, '#0b0a18', bang), '#14121c', ball)
      g.fillRect(0, 0, W, H)
      g.fillStyle = rgba(C.bg1, 0.5)
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 2:42.7 损失曲线（真实噪声下降） ----
    const lossA = span(t, 162.5, 163.2) * (1 - span(t, 166.4, 167.2))
    if (lossA > 0.01) drawLossChart(g, ctx, t, this.loss, lossA)

    // ---- 2:46.3 大爆炸：粒子与公式四散 ----
    if (t > 165.9) {
      this.galaxy.object.visible = true
      const spin = prism > 0 ? 0.9 : 0.07
      this.galaxy.update(t, { alpha: clamp(span(t, 166.1, 167.0)) * (1 - prism * 0.5), size: 2.6, spin })
    }
    if (bang > 0) drawBangFormulas(g, ctx, t, bang)

    // ---- 2:49.99–2:51.95 对方的犹豫：大号终端窗口（T51 / §K/L 2:51，取代旧气泡） ----
    const term = drawTerminal(g, ctx, t, tBall)
    this.metrics = this.metrics || {}
    this.metrics.terminal = {
      alpha: +term.alpha.toFixed(2),
      idx: term.idx,
      typed: +term.typed.toFixed(2),
      draft: term.draft,
      boxW: term.boxW,
      on: term.alpha > 0.02,
    }
    // 星系降亮退为背景（§1.12 的效果保留）：终端在场期间把星系调暗
    if (this.galaxy && this.galaxy.object.visible) {
      this.galaxy.object.scale.setScalar(1 - 0.25 * term.alpha)
    }

    // ---- 2:51.95 星系聚成公式球 ----
    if (ball > 0.01) drawFormulaBall(g, ctx, t, ball)

    // ---- 2:56 三棱镜光路（T51 / §K/L 2:56 重做）----
    if (prism > 0.01) this.metrics.prism = drawPrism(g, ctx, t, prism, PRISM_T0)

    // ---- 立绘 ----
    // G1：终端窗口（0.58W 宽、居中）与立绘 rect（x 0.591W–0.909W）必然重叠 —— 0.55W 宽的
    // 窗口放不进「安全区左缘 5% → 立绘左缘 0.591W」这 0.541W 的剩余带宽（见 REVIEW_T51）
    // ⇒ 按 G1「立绘出场期间同侧不放面板」让立绘退场：淡出（0.37s）在终端淡入之前完成，
    // 终端淡出后 0.42s 才淡回来，两者从不同时可见。棱镜期沿用原有的让位窗。
    const hideForTerminal = span(t, 170.35, 170.72) * (1 - span(t, 173.75, 174.12))
    const hideForPrism = span(t, 173.9, 174.6)
    const whaleHide = Math.max(hideForTerminal, hideForPrism)
    ctx.whale.sprite = {
      expr: t < 166.3 ? 'neutral' : 'dazed',
      rect: ctx.rect,
      alpha: (1 - whaleHide) * (1 - span(t, 177.0, 177.38)),
      glitch: 0.12 * sync.pulse(t, 160),
    }
    // 星系期把点云从她身上抽出来汇成旋涡
    if (bang > 0.05 && prism < 0.9) {
      ctx.whale.points = {
        from: 'sprite',
        to: 'galaxy',
        p: clamp(bang),
        stagger: 0.5,
        ease: inOutCubic,
        seed: 5,
        rotY: 0.15 * Math.sin(t * 0.3),
        alpha: (1 - prism) * clamp(bang * 1.4),
        size: 4,
        bulge: 0.2,
      }
    }
  },
}

/* ---------------- 损失曲线 ---------------- */
function drawLossChart(g, ctx, t, loss, a) {
  const { W, H } = ctx
  const x = W * 0.08
  const y = H * 0.20
  const w = W * 0.44
  const h = H * 0.40
  g.save()
  g.globalAlpha = a
  beginPanel(g, { x, y, w, h }, { pad: 24, id: 'lossChart:train · loss', title: 'train · loss' })
  panel(g, x, y, w, h, { title: 'train · loss' })
  g.strokeStyle = rgba(C.line, 0.5)
  g.lineWidth = 1
  for (let i = 1; i < 6; i++) {
    g.beginPath()
    g.moveTo(x + (w * i) / 6, y + 28)
    g.lineTo(x + (w * i) / 6, y + h)
    g.stroke()
  }
  const pts = lossCurvePoints(loss, x + 24, y + 44, w - 48, h - 120)
  const upto = Math.floor(clamp((t - 162.5) / 3.4) * pts.length)
  g.strokeStyle = C.green
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i < upto; i++) {
    i === 0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1])
  }
  g.stroke()
  if (upto > 0 && upto < pts.length) {
    g.fillStyle = C.cyan
    g.beginPath()
    g.arc(pts[upto - 1][0], pts[upto - 1][1], 4, 0, TAU)
    g.fill()
  }
  const cur = loss[Math.max(0, Math.min(loss.length - 1, upto - 1))]
  // T41（FIX_V5 §G1）：面板内文字 30–40px（原 13px），且字盒要留在面板内 ——
  // 34px alphabetic 基线的盒底 = y + 0.38×34 = y+12.9，所以基线上移到 y+h-38（离底 25px）。
  g.font = MONO(34, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(`loss ${cur.toFixed(4)}   step ${upto}`, x + 24, y + h - 38)
  endPanel(g)
  g.restore()
}

/* ---------------- 大爆炸四散的公式 ---------------- */
function drawBangFormulas(g, ctx, t, a) {
  const { W, H } = ctx
  const list = [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.heart, FORMULAS.kv, FORMULAS.limit, FORMULAS.epsdelta]
  // T51 / G5：四散的公式会飞过 8%/80% 与左右 5% 的边界（实测 px68/px18 字盒都曾被登记），
  // 这里按「字符串长度 × 字号」保守估半宽半高，把中心夹进安全区。
  const safeL = W * 0.05
  const safeR = W * 0.95
  const safeT = H * 0.08
  const safeB = H * 0.8
  g.save()
  for (let i = 0; i < list.length * 3; i++) {
    const k = i % list.length
    const ang = hash01(i, 131) * TAU
    const sp = 0.4 + hash01(i, 132) * 1.3
    const u = clamp(a * sp)
    const r = u * H * 0.8
    const size = 18 * (1 - u * 0.4)
    const hw = Math.max(24, list[k].length * size * 0.62) / 2 + 6
    const hh = size * 1.2
    // 公式整体是**旋转**后画的：字盒的外接矩形要把旋转算进去，否则长公式（attention ~高 150px）
    // 旋转后会从中心竖直方向甩出 ~80px，中心夹取形同虚设（实测 px12 字盒仍越 8%/80% 边界）。
    const th = ang + u * 1.2
    const extX = Math.abs(Math.cos(th)) * hw + Math.abs(Math.sin(th)) * hh
    const extY = Math.abs(Math.sin(th)) * hw + Math.abs(Math.cos(th)) * hh
    const x = clamp(W / 2 + Math.cos(ang) * r * 1.2, safeL + extX, safeR - extX)
    const y = clamp(H * 0.48 + Math.sin(ang) * r * 0.6, safeT + extY, safeB - extY)
    g.globalAlpha = (1 - u) * 0.8 * (1 - span(t, 169.0, 170.2))
    g.save()
    g.translate(x, y)
    g.rotate(ang + u * 1.2)
    drawMath(g, 0, 0, list[k], size, { color: k % 2 ? C.purple : C.teal, align: 'center' })
    g.restore()
  }
  g.restore()
}

/* ------------------------------------------------------------------ *
 * T51 / §K/L 2:51：大号终端窗口（取代旧的 3D「对方正在输入…」气泡）
 * ------------------------------------------------------------------
 * 规格（FIX_V5 §K/L）：黑底半透明终端窗口，宽 ≥ 画面 55%；提示符行里草稿逐字键入
 * 又删除 3 次（英文短句、≥80px）；下方状态行 `peer typing…` 带闪烁三点；不再使用气泡。
 * 窗口 = [back − 0.83, prism]（锚点实测 171.610 → 173.703，约 2.9s，三段各 ≈0.97s）。
 * 立绘（rect x 0.591W–0.909W，y 0.15H–1.17H）在窗内让位：G1「立绘出场期间同侧不放面板」，
 * 而 0.55W 宽的面板放不进 0.591W 的剩余带宽（见 REVIEW_T51），故终端在场期间立绘退场。
 * ------------------------------------------------------------------ */
/** 三段未发送草稿（英文短句；对方的犹豫，逐字键入后逐字删除） */
const TERM_DRAFTS = ['you there?', 'still here', 'never mind']
const TERM_TITLE = 'dsh · session #001'
const TERM_W_FRAC = 0.58 // ≥ 规格要求的 0.55
const TERM_PX = 84 // ≥ 规格要求的 80px

/* 旧的 T08 气泡实现（buildTypingBubble / drawBubbleFace / updateTypingBubble /
 * drawTypingHint / 420 粒碎裂粒子）已在 T51 按「不再使用气泡」整体删除。 */

/** 黑底半透明终端窗口 */
/**
 * 黑底半透明终端窗口：宽 = 0.58 画面宽（≥ 规格 0.55），居中偏上（y 0.30H–0.58H，
 * 全部落在 G5 的 x∈[5%,95%] / y∈[8%,80%] 安全区内）。
 * 提示符行里草稿**逐字键入又删除 3 次**（英文短句、84px ≥ 规格 80px），
 * 下方状态行 `peer typing` 带闪烁三点；窗口在 [tBall−2.92, tBall]（锚点 back→prism）。
 * @returns {{alpha:number, idx:number, typed:number, draft:string, wFrac:number}}
 */
function drawTerminal(g, ctx, t, tBall) {
  const { W, H } = ctx
  const tIn = tBall - 2.92 // ≈170.78（`back` 锚点实测 171.610）
  const tOut = tBall // ≈173.703（`prism` 锚点实测）
  const a = span(t, tIn, tIn + 0.28) * (1 - span(t, tOut - 0.38, tOut))
  let idx = 0
  let typed = 0
  if (a > 0.01) {
    // 三段草稿平分「窗口完全现身之后 → 开始淡出之前」：≈2.54s / 3 ≈ 0.85s 一段
    const t0 = tIn + 0.28
    const t1 = tOut - 0.1
    const u = clamp((t - t0) / Math.max(0.6, t1 - t0)) * TERM_DRAFTS.length
    idx = Math.min(TERM_DRAFTS.length - 1, Math.max(0, Math.floor(u)))
    const local = u - Math.floor(u)
    // 每段：0–0.46 逐字键入、0.46–0.56 停、0.56–1 逐字删除（删完不留痕，从不发送）
    if (u >= TERM_DRAFTS.length) typed = 0
    else if (local < 0.46) typed = local / 0.46
    else if (local < 0.56) typed = 1
    else typed = Math.max(0, 1 - (local - 0.56) / 0.44)
  }
  const w = Math.round(W * TERM_W_FRAC)
  const h = 300
  const x = Math.round((W - w) / 2)
  const y = Math.round(H * 0.3)
  const draft = TERM_DRAFTS[idx]
  const shown = draft.slice(0, Math.round(typed * draft.length))
  if (a > 0.01) {
    g.save()
    // 面板本身的尺寸/内边距按 G1：内容（84px 草稿 + 状态行）左右各留 ≥24px，
    // 这里给 44px 余量；标题栏由 `panel()` 自己保证不溢出（T41 全局修好的那条）。
    beginPanel(g, { x, y, w, h }, { pad: 24, id: 'l:term' })
    // §K/L 2:51「黑底半透明终端窗口」：面板底色给一点透明度，让身后银河透出来
    // （G1 的清晰度只约束文字与材质，不要求不透明；文字本身仍是不透明的实色描画）。
    panel(g, x, y, w, h, { title: TERM_TITLE, alpha: a, bg: 'rgba(14,17,24,0.86)' })
    const px0 = x + 44
    const py0 = y + h * 0.4
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.globalAlpha = a
    g.font = MONO(TERM_PX, 700)
    g.fillStyle = rgba(C.cyan, 0.95)
    g.fillText('› ', px0, py0)
    const lead = g.measureText('› ').width
    if (shown) {
      g.fillStyle = rgba(C.fg, 0.98)
      g.fillText(shown, px0 + lead, py0)
    }
    // 光标：闪烁方块（跟着草稿走）
    if (cursorOn(t)) {
      const cw = shown ? g.measureText(shown).width : 0
      g.fillStyle = rgba(C.cyan, 0.85)
      g.fillRect(px0 + lead + cw + 6, py0 - TERM_PX * 0.42, 9, TERM_PX * 0.84)
    }
    // 状态行：`peer typing` + 闪烁三点
    g.font = MONO(34, 600)
    g.fillStyle = rgba(C.fgDim, 0.92)
    g.fillText('peer typing', px0, y + h - 52)
    const sw = g.measureText('peer typing').width
    for (let i = 0; i < 3; i++) {
      const ph = 0.5 + 0.5 * Math.sin((t * 2.4 - i * 0.42) * TAU)
      g.globalAlpha = a * (0.22 + 0.78 * ph)
      g.fillStyle = rgba(C.cyan, 0.95)
      g.beginPath()
      g.arc(px0 + sw + 26 + i * 22, y + h - 52, 6, 0, TAU)
      g.fill()
    }
    endPanel(g)
    g.restore()
  }
  return {
    alpha: a,
    idx,
    typed,
    draft,
    wFrac: TERM_W_FRAC,
    x: +(x / W).toFixed(3),
    boxW: +(w / W).toFixed(3),
  }
}

/* ---------------- 公式球 ---------------- */
function drawFormulaBall(g, ctx, t, a) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.48
  const R = H * 0.26 * outCubic(a)
  g.save()
  g.globalAlpha = a * 0.95
  // 经纬线
  g.strokeStyle = rgba(C.teal, 0.55)
  g.lineWidth = 1.2
  for (let k = 0; k < 7; k++) {
    const ph = (k / 7) * Math.PI
    g.beginPath()
    g.ellipse(cx, cy, R * Math.max(0.02, Math.cos(ph - Math.PI / 2)), R, 0, 0, TAU)
    g.stroke()
  }
  for (let k = 0; k < 5; k++) {
    const ph = (k / 5) * Math.PI + t * 0.2
    g.beginPath()
    g.ellipse(cx, cy, R, R * Math.max(0.02, Math.abs(Math.sin(ph))), 0, 0, TAU)
    g.stroke()
  }
  // 球面上的公式
  //
  // ⚠️ §2.8：同层文字不得互相重叠。旧实现把 14 条**长公式**直接撒在半径 R=0.26H 的球面上：
  // 仅 `softmax(z)_i = exp(z_i) / Σ_j exp(z_j)` 一条就 35 字符 ≈ 273px 宽，而整个球盘只有
  // 2R = 560px 宽，14 条横排总宽约 1250px → 必然互相压住。实测 `?selftest` r) 在
  // 174–177s 单帧登记 484 个文字盒、报出 202/86/78 处同层重叠。
  // 现在做两件事：① 只画**朝向观众**的（front > 0.12，背面不再以 0.25 的底 alpha 陪跑）；
  // ② 用估计宽度做**贪心不重叠选择**，能放几条放几条。
  // 选择顺序按 front 降序 —— 纯函数、确定性，不依赖渲染历史（§0 的纯函数要求）。
  const list = [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.heart, FORMULAS.kv]
  const FS = 13
  const cand = []
  for (let i = 0; i < 14; i++) {
    const a1 = hash01(i, 141) * TAU + t * 0.24
    const a2 = (hash01(i, 142) - 0.5) * Math.PI
    const front = Math.cos(a1) * Math.cos(a2)
    if (front <= 0.12) continue
    const text = list[i % list.length]
    cand.push({
      x: cx + Math.cos(a1) * Math.cos(a2) * R,
      y: cy + Math.sin(a2) * R,
      // 等宽栈（JetBrains Mono）每字符约 0.6em；下标/上标标记会被吃掉，所以这是**保守偏大**的估计
      w: FS * 0.6 * text.length,
      h: FS * 1.45,
      front,
      text,
    })
  }
  cand.sort((p, q) => q.front - p.front)
  const kept = []
  for (const c of cand) {
    const r = { x0: c.x - c.w / 2 - 6, y0: c.y - c.h, x1: c.x + c.w / 2 + 6, y1: c.y + 6 }
    let hit = false
    for (const k of kept) {
      if (r.x0 < k.x1 && r.x1 > k.x0 && r.y0 < k.y1 && r.y1 > k.y0) { hit = true; break }
    }
    if (hit) continue
    kept.push(r)
    // `drawMath` 现在是 `globalAlpha *= alpha`，所以这里先设好透明度是有效的
    g.globalAlpha = a * (0.25 + 0.7 * Math.max(0, c.front))
    drawMath(g, c.x, c.y, c.text, FS, { color: C.gold, align: 'center' })
  }
  g.restore()
}

/* ---------------- 三棱镜光路（T51 / §K/L 2:56 重做） ----------------
 * 等边三角形：外接圆半径 R，顶点取 −90°/30°/150°（顶点朝上），三边相等（= R√3），
 * 顶点全部由计算给出。
 * 白光从左侧沿固定方向射入左面上的入射点；入射角取**中间波长（550nm）的近最小偏向角**
 * θi = asin(n̄·sin30°)，于是玻璃内的中间波长光线近平行于底边（最小偏向的经典构图）。
 * 折射（空气→玻璃）与出射（玻璃→空气）都用**矢量形式的斯涅尔定律**逐波长解算，
 * 棱镜内因此已略微分色（各波长出射点/出射方向都不同）；折射率用**柯西公式** n(λ)=A+B/λ²。
 * 时间轴（总 2.50s，与规格「约 0.8s / 约 0.6s / 约 1.2s」一一对应，全程渐进出现）：
 *   0.00–0.78 白色入射光一段一段画到入射点
 *   0.78–1.36 玻璃内的折射光路（逐波长、略微分色）
 *   1.36–2.50 右面出射点展开成 7 色扇形（每条色线的起点严格落在本波长的出射点上）
 * ------------------------------------------------------------------ */
const CAUCHY_A = 1.48
const CAUCHY_B = 0.03 // λ 以 µm 计；比真实玻璃大，目的是让 400→700nm 的扇形在画面上读得出来
const SPECTRUM = [
  { nm: 400, hex: '#9a5cff' },
  { nm: 440, hex: '#4b6bff' },
  { nm: 480, hex: '#35c8ff' },
  { nm: 520, hex: '#4bf0a4' },
  { nm: 570, hex: '#ffe45c' },
  { nm: 625, hex: '#ff9a3c' },
  { nm: 700, hex: '#ff4d5e' },
]
const SEG_IN = 0.78
const SEG_REF = 0.58
const SEG_FAN = 1.14
const COS30 = Math.cos(Math.PI / 6)

/** 柯西色散：n(λ) = A + B/λ²（λ 单位 µm） */
const prismIndex = (nm) => CAUCHY_A + CAUCHY_B / Math.pow(nm / 1000, 2)

/** 矢量斯涅尔：d = 单位入射线，nrm = 单位面法线（自动定向），eta = n1/n2；全反射返回 null */
function refract(d, nrm, eta) {
  let nx = nrm.x
  let ny = nrm.y
  let cosi = -(d.x * nx + d.y * ny)
  if (cosi < 0) {
    nx = -nx
    ny = -ny
    cosi = -cosi
  }
  const k = 1 - eta * eta * (1 - cosi * cosi)
  if (k < 0) return null
  const cost = Math.sqrt(k)
  const tx = eta * d.x + (eta * cosi - cost) * nx
  const ty = eta * d.y + (eta * cosi - cost) * ny
  const len = Math.hypot(tx, ty) || 1
  return { x: tx / len, y: ty / len }
}

/** 射线 O + t·d 与线段 P0→P1 的交点参数 t（无交点/在反向延长线上返回 null） */
function hitSeg(o, d, p0, p1) {
  const ex = p1.x - p0.x
  const ey = p1.y - p0.y
  const den = d.x * ey - d.y * ex
  if (Math.abs(den) < 1e-9) return null
  const t = ((p0.x - o.x) * ey - (p0.y - o.y) * ex) / den
  const u = ((o.x - p0.x) * d.y - (o.y - p0.y) * d.x) / -den
  if (!(t > 0) || u < 0 || u > 1) return null
  return t
}

function drawPrism(g, ctx, t, a, t0) {
  const { W, H } = ctx
  const fade = 1 - span(t, 177.28, 177.4)
  const out = { a: +a.toFixed(3), beamU: 0, refrU: 0, fanU: 0, thetaDeg: 0, entry: null, exits: [] }
  if (a <= 0.01 || fade <= 0.01) return out
  const u = Math.max(0, t - t0)
  // `a` 是「这一段在场」的 0→1 斜坡（整段 2.5s 才到 1），不能直接当不透明度用 ——
  // 否则入射/折射阶段只有 ~0.3–0.55 的亮度，光路图几乎看不见。这里改成快速进出的包络：
  // 0.25s 淡入、最后 0.12s 淡出，中间恒为 1（三段动画自身负责「渐进出现」）。
  const env = clamp(u / 0.25) * fade
  const beamU = clamp(u / SEG_IN)
  const refrU = clamp((u - SEG_IN) / SEG_REF)
  const fanU = clamp((u - SEG_IN - SEG_REF) / SEG_FAN)
  const cx = W / 2
  const cy = H * 0.44
  const R = H * 0.2
  // 顶点用 PA/PB/PC 命名：**不能**叫 A/B/C —— `C` 是本文件从 palette 导入的调色板对象，
  // 局部 `const C` 会遮蔽它（曾经导致 `rgba(C.fg, …)` 抛 undefined.replace）。
  const PA = { x: cx, y: cy - R } // 顶点（朝上）
  const PB = { x: cx + COS30 * R, y: cy + 0.5 * R } // 右下
  const PC = { x: cx - COS30 * R, y: cy + 0.5 * R } // 左下
  // FIX_V5 §3 新增自检（T55）：等边三角形三边长的相对误差。
  // PA/PB/PC 由 (cx, cy−R) / (cx±COS30·R, cy+0.5R) 构造 ⇒ 三边恒等于 R·√3；
  // 这里只把实测边长暴露给 selftest，不改几何、不改判据。
  const edges = [
    Math.hypot(PA.x - PB.x, PA.y - PB.y),
    Math.hypot(PB.x - PC.x, PB.y - PC.y),
    Math.hypot(PC.x - PA.x, PC.y - PA.y),
  ]
  const eMin = Math.min(edges[0], edges[1], edges[2])
  const eMax = Math.max(edges[0], edges[1], edges[2])
  const eMean = (edges[0] + edges[1] + edges[2]) / 3
  out.edges = edges.map((v) => +v.toFixed(4))
  out.edgeErrPct = +(((eMax - eMin) / eMean) * 100).toFixed(6)
  const nL = { x: -COS30, y: -0.5 } // 左面（PC→PA）外法线
  const nR = { x: COS30, y: -0.5 } // 右面（PA→PB）外法线
  // 中间波长（550nm）的近最小偏向角，以及对应的入射方向角（左面法线相位 = 30°）
  const nMid = prismIndex(550)
  const thetaI = Math.asin(clamp(nMid * 0.5, -1, 1))
  const phi = Math.PI / 6 - thetaI
  const Ldir = { x: Math.cos(phi), y: Math.sin(phi) }
  // 入射点：左面参数 s = 0.42（E_y = cy − 0.13R；近最小偏向时出射点与之关于竖轴镜像）
  const E = { x: PC.x + 0.42 * (PA.x - PC.x), y: PC.y + 0.42 * (PA.y - PC.y) }
  // 逐波长：折射 → 右面出射点 → 出射方向
  const rays = []
  for (const sp of SPECTRUM) {
    const n = prismIndex(sp.nm)
    const T1 = refract(Ldir, nL, 1 / n)
    if (!T1) continue
    const hit = hitSeg(E, T1, PA, PB)
    if (hit == null) continue
    const P = { x: E.x + T1.x * hit, y: E.y + T1.y * hit }
    const T2 = refract(T1, nR, n)
    if (!T2) continue // 全反射（本几何下不会发生；真发生就跳过这条色线）
    rays.push({ nm: sp.nm, hex: sp.hex, T1, P, T2 })
  }
  out.a = +env.toFixed(3)
  out.beamU = +beamU.toFixed(3)
  out.refrU = +refrU.toFixed(3)
  out.fanU = +fanU.toFixed(3)
  out.thetaDeg = +((thetaI * 180) / Math.PI).toFixed(2)
  out.entry = [+(E.x / W).toFixed(4), +(E.y / H).toFixed(4)]
  out.exits = rays.map((r) => [+(r.P.x / W).toFixed(4), +(r.P.y / H).toFixed(4)])
  g.save()
  // ① 棱镜本体（等边三角形）
  g.beginPath()
  g.moveTo(PA.x, PA.y)
  g.lineTo(PB.x, PB.y)
  g.lineTo(PC.x, PC.y)
  g.closePath()
  g.fillStyle = 'rgba(190,220,255,0.12)'
  g.fill()
  g.strokeStyle = rgba('#cfe8ff', 0.85)
  g.lineWidth = 3
  g.stroke()
  // ② 入射白光：一段一段画到入射点（0 → 0.78s），画满后保持
  const bl = W * 0.34
  const B0 = { x: E.x - Ldir.x * bl, y: E.y - Ldir.y * bl }
  const DASH = 8
  const drawn = beamU * DASH
  g.lineCap = 'butt'
  g.strokeStyle = rgba('#ffffff', 0.92 * env)
  g.lineWidth = 5
  for (let i = 0; i < DASH; i++) {
    const f = clamp(drawn - i) // 本段的完成度
    if (f <= 0) break
    const s0 = i / DASH
    const s1 = s0 + f / DASH
    g.beginPath()
    g.moveTo(B0.x + (E.x - B0.x) * s0, B0.y + (E.y - B0.y) * s0)
    g.lineTo(B0.x + (E.x - B0.x) * s1, B0.y + (E.y - B0.y) * s1)
    g.stroke()
  }
  if (beamU >= 1) {
    g.fillStyle = rgba('#ffffff', 0.95 * env)
    g.beginPath()
    g.arc(E.x, E.y, 5.5, 0, TAU)
    g.fill()
  }
  // 玻璃内的辉光：把入射点与出射点连成一束
  if (refrU > 0.01) {
    const mid = rays.length ? rays[Math.floor(rays.length / 2)].P : E
    const gl = g.createRadialGradient(E.x, E.y, 0, E.x, E.y, H * 0.34)
    gl.addColorStop(0, `rgba(226,240,255,${(0.30 * refrU * (1 - 0.6 * fanU) * env * 1.5).toFixed(3)})`)
    gl.addColorStop(1, 'rgba(226,240,255,0)')
    g.fillStyle = gl
    // 只填渐变覆盖的方形区域（半径外 alpha=0），避免每帧全屏 fillRect（实测省 ~5ms/帧）
    const gr = H * 0.34
    g.fillRect(E.x - gr, E.y - gr, gr * 2, gr * 2)
    void mid
  }
  // ③ 玻璃内的折射光路（逐波长、略微分色；0.78 → 1.36s 渐进）
  if (refrU > 0.01) {
    for (const r of rays) {
      const L = Math.hypot(r.P.x - E.x, r.P.y - E.y) * refrU
      g.strokeStyle = rgba(r.hex, 0.7 * env)
      g.lineWidth = 3.4
      g.beginPath()
      g.moveTo(E.x, E.y)
      g.lineTo(E.x + r.T1.x * L, E.y + r.T1.y * L)
      g.stroke()
    }
  }
  // ④ 7 色扇形：每条色线**从本波长自己的出射点**出发（1.36 → 2.50s 渐进展开）
  if (fanU > 0.01) {
    const len = W * (0.10 + 0.34 * fanU)
    for (const r of rays) {
      g.strokeStyle = rgba(r.hex, 0.88 * env * clamp(fanU * 1.6))
      g.lineWidth = 5.4
      g.beginPath()
      g.moveTo(r.P.x, r.P.y)
      g.lineTo(r.P.x + r.T2.x * len, r.P.y + r.T2.y * len)
      g.stroke()
      // 出射点上的亮点，强调「起点严格落在出射点上」
      g.fillStyle = rgba(r.hex, 0.95 * env * clamp(fanU * 1.6))
      g.beginPath()
      g.arc(r.P.x, r.P.y, 4.2, 0, TAU)
      g.fill()
    }
  }
  // ⑤ 标注（G5：整体落在 y ≤ 0.80H 的安全区内，不再画到 0.86H）
  g.font = MONO(22, 600)
  g.fillStyle = rgba(C.fg, 0.9 * env * clamp(0.25 + fanU))
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // 标注压在很亮的银河上，加一层暗描边保证看得清（G1 的"看不清就别取巧"）
  g.shadowColor = 'rgba(0,0,0,0.9)'
  g.shadowBlur = 10
  g.fillText('dispersion · 400 → 700 nm · n = A + B/λ²', cx, H * 0.765)
  g.shadowBlur = 0
  g.restore()
  return out
}
