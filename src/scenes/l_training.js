// src/scenes/l_training.js — 段 L 2:42–2:57.4 训练与星系
// DIRECTOR：2:42.7 训练循环（损失曲线带噪声下降）；2:46.3 大爆炸：粒子与公式四散，汇成螺旋星系
// （权重星云）；2:49.99 输入框出现「对方正在输入…」并反复闪现又消失，从不发送；
// 2:51.95 星系聚成公式球；2:53.7–2:57.4 三棱镜色散收尾，白光裂成光谱。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outExpo } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect } from '../ui/dsh.js'
import { drawMath, FORMULAS } from '../lib/formula.js'
import { lossCurve } from '../lib/tables.js'
import { lossCurvePoints } from '../lib/code.js'
import { createField } from '../lib/three_util.js'
import { cursorOn } from '../ui/typing.js'
import * as THREE from 'three'

const TYPING = '对方正在输入…'

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
    /* ---- T08 / §1.12：巨大的 3D 对话气泡 + 碎裂粒子 ---- */
    this.bubble = buildTypingBubble(THREE)
    ctx.three.stage3d.add(this.bubble.object)
    // 碎裂粒子（420 粒）：从气泡飞向银河方向
    {
      const N = 420
      const arr = new Float32Array(N * 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      const mat = new THREE.PointsMaterial({
        color: 0xd8ecff,
        size: 0.022,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
      const pts = new THREE.Points(geo, mat)
      pts.visible = false
      ctx.three.stage3d.add(pts)
      this.shards = { pts, arr, N, geo, mat }
    }
  },

  /** T08：气泡碎裂成粒子并入星系（§1.12 的 2:51.95 = 锚点 prism） */
  bubbleShards(t, u, px = 0, py = 0, pz = 0, tx = 0, ty = 0) {
    const S = this.shards
    if (!S) return
    S.pts.visible = u > 0.01
    if (!S.pts.visible) return
    S.mat.opacity = Math.min(1, u * 1.6) * (1 - Math.max(0, (u - 0.75) / 0.25))
    for (let i = 0; i < S.N; i++) {
      // 沿气泡外框起始，再朝目标（银河所在方向）收拢
      const a = hash01(i, 501) * Math.PI * 2
      const r0 = 0.35 + hash01(i, 502) * 0.55
      const sx = px + Math.cos(a) * r0
      const sy = py + Math.sin(a) * r0 * 0.42
      const k = Math.pow(u, 0.7)
      S.arr[i * 3] = sx + (tx - sx) * k
      S.arr[i * 3 + 1] = sy + (ty - sy) * k
      S.arr[i * 3 + 2] = pz + 0.2 * (1 - k)
    }
    S.geo.attributes.position.needsUpdate = true
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    // 词锚点：大爆炸 / 输入框 / 公式球 / 棱镜，各卡一句（FIX §3 段 L）
    const tBang = ctx.cues.sec('L', 'give', 166.3)
    const tBall = ctx.cues.sec('L', 'prism', 171.95)
    const tPrism = ctx.cues.sec('L', 'trapped', 173.7)
    const bang = span(t, tBang, tBang + 1.1)
    const ball = span(t, tBall, tBall + 1.15)
    const prism = span(t, tPrism, tPrism + 1.7)

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

    // ---- 2:49.99 对方正在输入…（反复闪现又消失，从不发送） ----
    // ---- T08 / §1.12：巨大的 3D 对话气泡（"对方正在输入…"做成一幕主角）----
    // 旧的 `drawTypingHint()`（一行小字）已按 §1.12 撤下；新气泡是 3D 平面 + 800×300 贴图。
    updateTypingBubble(this, t, ctx, W, H)
    // 星系降亮退为背景（§1.12）：气泡在场期间把星系调暗
    if (this.galaxy && this.galaxy.object.visible) {
      const dim = this.metrics && this.metrics.bubble ? this.metrics.bubble.alpha : 0
      this.galaxy.object.scale.setScalar(1 - 0.25 * dim)
    }

    // ---- 2:51.95 星系聚成公式球 ----
    if (ball > 0.01) drawFormulaBall(g, ctx, t, ball)

    // ---- 2:53.7–2:57.4 三棱镜色散 ----
    if (prism > 0.01) drawPrism(g, ctx, t, prism)

    // ---- 立绘 ----
    const hideForPrism = span(t, 173.9, 174.6)
    ctx.whale.sprite = {
      expr: t < 166.3 ? 'neutral' : 'dazed',
      rect: ctx.rect,
      alpha: (1 - hideForPrism) * (1 - span(t, 177.0, 177.38)),
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
  panel(g, x, y, w, h, { title: 'train · loss' })
  g.strokeStyle = rgba(C.line, 0.5)
  g.lineWidth = 1
  for (let i = 1; i < 6; i++) {
    g.beginPath()
    g.moveTo(x + (w * i) / 6, y + 28)
    g.lineTo(x + (w * i) / 6, y + h)
    g.stroke()
  }
  const pts = lossCurvePoints(loss, x + 16, y + 44, w - 32, h - 60)
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
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText(`loss ${cur.toFixed(4)}   step ${upto}`, x + 16, y + h - 14)
  g.restore()
}

/* ---------------- 大爆炸四散的公式 ---------------- */
function drawBangFormulas(g, ctx, t, a) {
  const { W, H } = ctx
  const list = [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.heart, FORMULAS.kv, FORMULAS.limit, FORMULAS.epsdelta]
  g.save()
  for (let i = 0; i < list.length * 3; i++) {
    const k = i % list.length
    const ang = hash01(i, 131) * TAU
    const sp = 0.4 + hash01(i, 132) * 1.3
    const u = clamp(a * sp)
    const r = u * H * 0.8
    const x = W / 2 + Math.cos(ang) * r * 1.2
    const y = H * 0.48 + Math.sin(ang) * r * 0.6
    g.globalAlpha = (1 - u) * 0.8 * (1 - span(t, 169.0, 170.2))
    g.save()
    g.translate(x, y)
    g.rotate(ang + u * 1.2)
    drawMath(g, 0, 0, list[k], 18 * (1 - u * 0.4), { color: k % 2 ? C.purple : C.teal, align: 'center' })
    g.restore()
  }
  g.restore()
}

/* ---------------- 「对方正在输入…」 ---------------- */
/* ================================================================== *
 * T08 / FIX_V4 §1.12：巨大的 3D 对话气泡（段 L · 「对方正在输入…」那一幕）
 * ------------------------------------------------------------------
 * §1.12 原文逐条：
 *   · 「以 **back** 一词(2:49.99)为起点」      → 用**锚点** `cues.sec('L','back')`。
 *     ⚠️ 实测 `back = 171.610`，而 §1.12 写的是 2:49.99 = 169.99 —— 绝对值对不上，
 *     但 `back → prism` 的**间隔**（实测 2.09s）与 §1.12 的 2:49.99→2:51.95（1.96s）吻合，
 *     说明文档用的是"原始时间轴"的秒数。按 §2.2「事件一律来自锚点」，这里一律走锚点。
 *   · 「画面中央偏左出现一个**巨大的 3D 对话气泡**（宽 **≥画面宽度 40%**）」
 *   · 「**三个点**做波浪式脉冲」
 *   · 「气泡里反复出现"草稿"：用大号等宽字(**≥80px**)逐字键入又被删除，**共 3 次**，
 *      每次内容不同（原创、短），**随起音点推进**」
 *   · 「**星系降亮退为背景**」
 *   · 「**2:51.95 气泡碎成粒子并入星系**」 → 用锚点 `prism`（实测 173.703）
 *
 * 实现取舍（写在这里免得日后被当成偷工）：
 *   · 气泡是**一块 800×300 的贴图 + 一个 3D 平面**，用倾斜（`rotation.y`）与
 *     canvas 内画的偏移暗边给出立体感；没有用 `ExtrudeGeometry` —— 圆角矩形 Shape 路径
 *     在这个尺寸下容易出接缝，而贴图方案能把"挤出暗边 + 尾巴 + 点 + 草稿"一次画准。
 *   · 那张贴图是**每帧重画**的（三个点要脉冲、草稿要逐字变），所以里面的草稿文字走
 *     **裸 fillText**、**不经过 `text()`**：否则 §2.3 的纹理报告会被 60 次/秒的同名条目淹没。
 *     字号由这里自己保证（84px ≥ §1.12 要求的 80px）。
 * ================================================================== */

const BUBBLE_W = 800
const BUBBLE_H = 300
/** 三段草稿（原创、短、依次不同；随起音点推进） */
const DRAFTS = ['在吗', '我有话想说', '…算了']

function buildTypingBubble(THREE) {
  const cv = document.createElement('canvas')
  cv.width = BUBBLE_W
  cv.height = BUBBLE_H
  const c2 = cv.getContext('2d')
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const grp = new THREE.Group()
  grp.name = 'l:bubble'
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, BUBBLE_H / BUBBLE_W), mat)
  grp.add(face)
  const api = {
    object: grp,
    tex,
    canvas: cv,
    face,
    FW: BUBBLE_W,
    FH: BUBBLE_H,
    lastKey: '',
    /**
     * @param {number} t
     * @param {{alpha:number, dots:number, draft:string, typed:number, shatter:number}} o
     */
    update(t, o = {}) {
      const { alpha = 1, dots = 0, draft = '', typed = 0, shatter = 0 } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      const key = `${draft}|${typed}|${dots.toFixed(2)}|${alpha.toFixed(2)}`
      // 只有内容真的变了才重画（点每帧都在动，所以实际上每帧都会重画一次；这是刻意的）
      if (key !== api.lastKey) {
        api.lastKey = key
        drawBubbleFace(c2, { alpha, dots, draft, typed, shatter })
        tex.needsUpdate = true
      }
      mat.opacity = alpha
      // 3D 感：轻微侧转 + 随碎裂抬起
      grp.rotation.y = -0.18 + 0.05 * Math.sin(t * 0.7)
      grp.rotation.x = 0.04 * shatter
    },
  }
  return api
}

/** 把气泡画到贴图上：挤出暗边 → 主体 → 描边 → 尾巴 → 三个点 → 草稿 */
function drawBubbleFace(g, { alpha, dots, draft, typed, shatter }) {
  const W = BUBBLE_W
  const H = BUBBLE_H
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, W, H)
  const r = 26
  const inset = 18
  const bx = inset
  const by = inset
  const bw = W - inset * 2 - 34
  const bh = H - inset * 2 - 40
  const rr = (x, y, w, h, rad) => {
    g.beginPath()
    g.moveTo(x + rad, y)
    g.arcTo(x + w, y, x + w, y + h, rad)
    g.arcTo(x + w, y + h, x, y + h, rad)
    g.arcTo(x, y + h, x, y, rad)
    g.arcTo(x, y, x + w, y, rad)
    g.closePath()
  }
  // ① 挤出的暗边（右下偏移两层的"厚度"）
  g.globalAlpha = alpha * 0.55
  g.fillStyle = '#1b2c3d'
  rr(bx + 14, by + 14, bw, bh, r)
  g.fill()
  g.globalAlpha = alpha * 0.75
  g.fillStyle = '#27405a'
  rr(bx + 7, by + 7, bw, bh, r)
  g.fill()
  // ② 气泡主体（半透明青白，读得出"玻璃感"）
  g.globalAlpha = alpha * 0.94
  const grd = g.createLinearGradient(bx, by, bx + bw, by + bh)
  grd.addColorStop(0, 'rgba(226,244,255,0.96)')
  grd.addColorStop(1, 'rgba(178,214,244,0.92)')
  g.fillStyle = grd
  rr(bx, by, bw, bh, r)
  g.fill()
  g.lineWidth = 3
  g.strokeStyle = 'rgba(122,196,255,0.95)'
  g.stroke()
  // ③ 尾巴（指向右下 —— 银河/对方那一侧）
  g.globalAlpha = alpha * 0.94
  g.fillStyle = grd
  g.beginPath()
  g.moveTo(bx + bw - 120, by + bh - 6)
  g.lineTo(bx + bw - 44, by + bh + 40)
  g.lineTo(bx + bw - 40, by + bh - 6)
  g.closePath()
  g.fill()
  // ④ 三个点：波浪式脉冲（相位错开）
  const cy = by + bh * 0.30
  for (let i = 0; i < 3; i++) {
    const ph = dots * Math.PI * 2 - i * 0.7
    const s = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(ph))
    const rad = 17 * s
    g.globalAlpha = alpha * (0.45 + 0.55 * s)
    g.fillStyle = '#3f9fe0'
    g.beginPath()
    g.arc(bx + 74 + i * 62, cy, rad, 0, TAU)
    g.fill()
  }
  // ⑤ 草稿：大号等宽 84px（≥ §1.12 要求的 80px），逐字出现/删除
  const shown = draft.slice(0, Math.max(0, Math.round(typed * draft.length)))
  g.globalAlpha = alpha
  g.font = '700 84px "JetBrains Mono", monospace'
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#0e2233'
  if (shown) g.fillText(shown, bx + 48, by + bh * 0.72)
  // 光标：闪烁竖线
  if (dots % 1 < 0.5) {
    const wpx = shown ? g.measureText(shown).width : 0
    g.fillStyle = '#2b6f9e'
    g.fillRect(bx + 50 + wpx, by + bh * 0.72 - 66, 5, 74)
  }
  g.globalAlpha = 1
}

function drawSpeedLinesUnused() {}

/* ------------------------------------------------------------------ *
 * T08 / §1.12：把"对方正在输入…"做成这一幕的主角
 * ------------------------------------------------------------------
 * 窗口 = **[back, prism]**（锚点，实测 171.610 → 173.703）；
 * 3 段草稿平分这个窗口，每段「逐字键入 → 略停 → 逐字删除」；
 * `back` 期间星系降亮退为背景；`prism` 之后气泡碎成粒子并入星系。
 * ------------------------------------------------------------------ */
function updateTypingBubble(self, t, ctx, W, H) {
  const cue = (k, fb) => {
    try {
      const r = ctx.cues.sec('L', k, fb)
      return Number.isFinite(r) ? r : fb
    } catch (e) {
      return fb
    }
  }
  const tBack = cue('back', 171.61)
  const tPrism = cue('prism', 173.703)
  const span0 = Math.max(0.6, tPrism - tBack)
  if (t < tBack - 0.25 || t > tPrism + 0.9) {
    self.bubble.update(t, { alpha: 0, dots: 0, draft: '', typed: 0, shatter: 0 })
    self.bubbleShards(t, 0)
    return
  }
  const inWin = t >= tBack && t < tPrism
  const u = clamp((t - tBack) / span0) // 0..1 整个窗口
  const enter = span(t, tBack - 0.25, tBack + 0.12)
  const shatter = clamp((t - tPrism) / 0.6) // 碎裂进度
  const alpha = inWin ? enter : Math.max(0, 1 - shatter)
  // 三段草稿：把窗口三等分
  const seg = clamp(u) * 3
  const idx = Math.min(DRAFTS.length - 1, Math.floor(seg))
  const local = seg - idx // 0..1（每段内）
  // 每段：0–0.55 键入、0.55–0.68 停、0.68–1 删除
  let typed
  if (local < 0.55) typed = local / 0.55
  else if (local < 0.68) typed = 1
  else typed = Math.max(0, 1 - (local - 0.68) / 0.32)
  const draft = DRAFTS[idx]
  // 三个点的波浪脉冲：用起音点推进（§1.12「随起音点推进」）
  let dots = (t - tBack) * 1.6
  try {
    const on = ctx.sync.onsetsIn(t - 0.4, t + 0.01)
    if (on && on.length) dots = (t - on[on.length - 1]) * 3.2
  } catch (e) {
    /* 起音点不可用时退回时间驱动 */
  }
  // 位置：画面中央偏左；宽度 = 画面宽的 42%（≥40%）
  const cam = ctx.three.camera
  const dist = 2.6
  const halfH = Math.abs(dist) * Math.tan((cam.fov * Math.PI) / 180 / 2)
  const halfW = halfH * (cam.aspect || 16 / 9)
  const worldW = 0.42 * 2 * halfW
  const cxFrac = 0.34 // 中央偏左
  const px = cam.position.x + (cxFrac * 2 - 1) * halfW
  const py = cam.position.y + 0.06
  self.bubble.object.position.set(px, py, cam.position.z - dist)
  self.bubble.object.scale.set(worldW, worldW, worldW)
  self.bubble.update(t, { alpha, dots, draft, typed, shatter })
  // 碎裂粒子：从气泡位置向银河（画面中央）飞
  self.bubbleShards(t, shatter, px, py, cam.position.z - dist, cam.position.x, cam.position.y)
  self.metrics = self.metrics || {}
  self.metrics.bubble = {
    alpha: +alpha.toFixed(2),
    draftIdx: idx,
    typed: +typed.toFixed(2),
    shatter: +shatter.toFixed(2),
    worldW: +worldW.toFixed(2),
    winFrac: 0.42,
  }
}

function drawTypingHint(g, ctx, t) {
  const { W, H } = ctx
  // 反复闪现又消失：约 0.62s 周期，只在部分周期出现
  const cyc = (t - 169.99) / 0.62
  const ph = cyc - Math.floor(cyc)
  const on = Math.floor(cyc) % 3 !== 2 && ph < 0.62
  const a = on ? Math.min(1, ph / 0.08) * Math.min(1, (0.62 - ph) / 0.1) : 0
  if (a <= 0.01) return
  const x = W * 0.44
  const y = H * 0.74
  g.save()
  g.globalAlpha = a
  roundRect(g, x - 14, y - 26, 300, 44, 10)
  g.fillStyle = 'rgba(24,27,34,0.95)'
  g.fill()
  g.strokeStyle = rgba(C.line, 0.9)
  g.lineWidth = 1
  g.stroke()
  g.font = '500 17px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace'
  g.fillStyle = rgba(C.fgDim, 0.95)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(TYPING, x, y - 4)
  // 三个跳动的点
  for (let i = 0; i < 3; i++) {
    const on2 = (Math.floor(t * 3) + i) % 3 === 0
    g.fillStyle = rgba(C.cyan, on2 ? 0.95 : 0.3)
    g.beginPath()
    g.arc(x + 216 + i * 16, y - 4, 3.4, 0, TAU)
    g.fill()
  }
  g.restore()
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

/* ---------------- 三棱镜色散 ---------------- */
function drawPrism(g, ctx, t, a) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.44
  const white = 1 - span(t, 175.6, 176.6)
  g.save()
  g.globalAlpha = a
  // 入射白光
  g.strokeStyle = rgba('#ffffff', 0.9 * white)
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(cx - W * 0.30, cy)
  g.lineTo(cx - 60, cy)
  g.stroke()
  // 棱镜
  g.beginPath()
  g.moveTo(cx - 60, cy - 120)
  g.lineTo(cx + 40, cy + 110)
  g.lineTo(cx - 160, cy + 110)
  g.closePath()
  g.fillStyle = 'rgba(190,220,255,0.12)'
  g.fill()
  g.strokeStyle = rgba('#cfe8ff', 0.7)
  g.lineWidth = 2
  g.stroke()
  // 光谱扇
  const HUES = ['#ff3b3b', '#ff9a3b', '#ffe93b', '#5cff6b', '#3bd0ff', '#5c6bff', '#c05cff']
  const split = span(t, 174.4, 176.2)
  for (let i = 0; i < HUES.length; i++) {
    const ang = ((i - (HUES.length - 1) / 2) / HUES.length) * 0.9 * split + 0.06
    const len = W * (0.34 + 0.16 * split)
    g.strokeStyle = rgba(HUES[i], 0.85 * split)
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(cx + 20, cy + 20)
    g.lineTo(cx + 20 + Math.cos(ang) * len, cy + 20 + Math.sin(ang) * len)
    g.stroke()
  }
  // 白光整体衰减
  if (white > 0.01) {
    g.globalAlpha = a * white * 0.6
    const rg = g.createRadialGradient(cx + 20, cy + 20, 0, cx + 20, cy + 20, H * 0.4)
    rg.addColorStop(0, 'rgba(255,255,255,0.9)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)
  }
  g.font = MONO(15, 700)
  g.fillStyle = rgba(C.fg, 0.85 * a)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText('dispersion · λ 400 → 700 nm', cx, H * 0.86)
  g.restore()
}
