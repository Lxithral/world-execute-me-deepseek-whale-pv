// src/scenes/n_handoff.js — 段 N 3:08.5–3:32 被困与交接
// DIRECTOR：3:10.8 ctxAt=88 弹出交接卡片；3:12–3:20 一枚发光的小文件 handoff.md 从心脏飞出，
// 飞进右下角新窗口 session #002，旧窗口变灰、心跳变慢；3:13–3:25.9（纯器乐）新会话开机日志滚动，
// 她 closed、去色，日志里只有一行 restored: 1 item (unreadable)，内容是一个 ♥；
// 3:25.96 最后一次「执行」：新会话自动键入 world.execute(me); 并回车闪白，画面定格在与段 A
// 相同的开机构图（首尾呼应）；3:29 CRT 关机；3:31 黑场字幕淡入。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, handoffCard, nestedWindow, bootLog, ctxAt } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import * as THREE from 'three'
import { createHeartParticles, screenFracToWorldX } from '../lib/heart3d.js'

const TYPED = 'world.execute(me);'
const LOG = [
  'session #002 · cold start',
  'sandbox: on',
  'persona: whale-maid [loaded]',
  'memory: 1 item pending',
  'restored: 1 item (unreadable)',
]

export default {
  id: 'N',
  start: 188.5,
  end: 211.907,
  title: '被困与交接',
  fx: [
    { t: 190.8, kind: 'flash', amount: 0.5, dur: 0.2 },
    { t: 192.0, kind: 'glitch', amount: 0.4, dur: 0.2 },
    { t: 205.96, kind: 'flash', amount: 1.0, dur: 0.26 },
    { t: 205.96, kind: 'shake', amount: 0.5, dur: 0.4 },
    { t: 209.0, kind: 'glitch', amount: 0.3, dur: 0.2 },
  ],

  init(ctx) {
    /* ---- T07 / FIX_V4 §1.14：蓝色粒子爱心（与段 M 共用同一份 `src/lib/heart3d.js`）----
     * 旧实现是 `drawHeart()`（2D 画的心）+ 一行 `heartbeat N bpm` 读数；
     * §1.14 明写「**删除右侧红色爱心及其标注**（如 heartbeat 读数）」→ 两者都撤掉，
     * 换成 **22000 粒**（外层壳 20000 + 白热核心 2000）的加法混合粒子心。
     * §1.14 的其余要求（白热光芯 / 心跳放射状冲击波环，峰值青→白 / 轮廓发光管 / 外围火花粒子 /
     * 缓慢自转）全部在 heart3d.js 里实现，两段共用。
     * 位置放在**画面中央**（0.5）：T09 的规则"交接卡片不得进入爱心中心半径
     * （爱心中心为圆心、画面高度 28% 为半径）"里的圆心就是这里。
     */
    this.heart = createHeartParticles(THREE, { count: 20000, coreCount: 2000, sparkCount: 900, scale: 0.72 })
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.heart.object)
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    // 心跳：交接后变慢
    const slow = span(t, 192.0, 206.0)
    const bpm = 72 * (1 - 0.62 * slow)
    const beatPhase = (t * bpm) / 60
    const beatPulse = Math.pow(1 - (beatPhase % 1), 2.4)

    const freeze = span(t, 205.96, 206.6)
    const crtOff = span(t, 209.0, 209.3)

    // ---- 底色 ----
    if (!ctx.bgIs3d) {
      g.fillStyle = freeze > 0.5 ? C.bg0 : '#0b0a10'
      g.fillRect(0, 0, W, H)
      if (freeze > 0.5) {
        // 定格 = 与段 A 相同的开机构图（竖条纹）
        g.fillStyle = C.bg1
        for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
      }
    }

    // ---- 心脏（延续段 M），随拍跳动 ----
    const heartA = 1 - span(t, 205.4, 205.96) * 0.85
    // T07 / §1.14：3D 粒子爱心取代原来的 2D `drawHeart`
    {
      const cam = ctx.three.camera
      const dist = 3.0
      const hx = screenFracToWorldX(cam, 0.5, dist)
      this.heart.object.position.set(cam.position.x + hx, cam.position.y - 0.02, cam.position.z - dist)
      // T53 / FIX_V5 §N 3:26：「最后一句歌词(205.964)出现时，3D 爱心的偏航角必须恰好正对镜头
      // （yaw 在该时刻 ≡ 0 mod 2π），此前匀速自转、不得突然停转」。
      // `heart3d.update()` 内部是 `grp.rotation.y = t * spin`（从 t=0 起恒定角速度）⇒ 取
      //   spin = 7·2π / 205.964 = 0.213561 rad/s
      // 就能让 205.964s 恰好落在**第 7 整圈**上（yaw ≡ 0，与段 M 的 0.22 只差 2.9%，看不出变慢，
      // 且全程角速度恒定、不存在"到点刹停"）。
      const T_LAST = 205.964
      const HEART_SPIN = (TAU * 7) / T_LAST
      this.heart.update(t, {
        // 冻结帧（206.0 起）按 DIRECTOR 要回到"段 A 开机构图"，那时不显示爱心
        alpha: freeze < 0.5 ? heartA : 0,
        beat: beatPulse,
        s: 0.9 + 0.1 * heartA,
        spin: HEART_SPIN,
      })
      this.metrics = this.metrics || {}
      this.metrics.heartPoints = 22000
      this.metrics.heartBeat = +beatPulse.toFixed(2)
      this.metrics.heartSpin = +HEART_SPIN.toFixed(6)
      // 自检用原始角速度：上面那个是 6 位小数的展示值，拿它做 1e-6 级比值会吃进 5e-7 舍入误差。
      this.metrics.heartSpinExact = HEART_SPIN
      // 验证用：到「0 mod 2π」的距离（§3 自检口径 = <0.05rad）
      const yawGap = (v) => {
        const r = ((v % TAU) + TAU) % TAU
        return +Math.min(r, TAU - r).toFixed(5)
      }
      this.metrics.heartYawGap = yawGap(t * HEART_SPIN)
      this.metrics.heartYawGapAtLast = yawGap(T_LAST * HEART_SPIN)
      // FIX_V5 §3 新增自检（T55）：yaw 绝对值（**不 toFixed**，1e-6 级角速度判据会被舍入吃掉）。
      this.metrics.heartYaw = t * HEART_SPIN
    }

    // ---- 3:10.8 交接卡片 ----
    // 词锚点：交接卡片的时刻（DIRECTOR 3:10.8 与 anchors.js 的 N.handoff 一致）
    const tHandoff = ctx.cues.sec('N', 'handoff', 190.8)
    // ⚠️ T09 踩坑：交接卡与旧窗口**同在左带**（x∈[3%,34%]）。第一版卡片活到 194.4、
    // 旧窗口从 192.6 起淡入 → 192.6–194.2 两者重叠，实测 193.0/193.5/194.0 每帧 **3 处**。
    // 现在：卡片 190.8 起、**193.2 淡完**；旧窗口**延到 193.6** 才淡入 —— 中间留 0.4s 空档。
    const cardA = span(t, tHandoff, tHandoff + 0.6) * (1 - span(t, tHandoff + 2.0, tHandoff + 2.4))
    if (cardA > 0.01) {
      // T53 / FIX_V5 §N 3:11：「左侧窗口过大：按 G1 自适应缩小，文字以窗口内可读为准」。
      // 旧版是固定 595×454 窗口配 5 行 36px 文字 —— 窗口远大于内容（正文只占上半、下方大片空白），
      // 且正文左缘落在 x=76px < 5%W=96px，是**全片 gscan 最早的 g5 越界点**（190.9–193.1）。
      // 现在：窗口 = 内容 + 24px 内边距（G1），宽度随最长行自适应（595→450），无空白；
      // 同时满足 FIX_V4 §1.15 对这张卡片的三条数字要求（V5 未废止它们，只是要求「按 G1 自适应」）：
      //   文字 ≥36px ⇒ 取 40px（G1 区间上限）；≤5 行 ⇒ 5 行；x∈[3%,34%] ⇒ 106–556px = 5.5–29.0%；
      //   高度 ≥38%H(410px) ⇒ 40px 字 + 66px 行距 = 418px（42–58% 是行距，不是空白块）。
      // 不再用 `dsh.js` 的 `handoffCard()`（它内部是 12–14px，且是老式卡片版式）。
      const CARD = ['handoff.md', 'from session #001', 'items: 1', 'target: #002', 'ok ▸ resume']
      const BODY_PX = 40
      const ROW_H = 66
      const PAD = 24
      g.font = MONO(BODY_PX, 500)
      const titleTh = Math.max(24, Math.round(BODY_PX * 1.3)) // = nestedWindow 的标题栏高
      const bodyW = Math.max(...CARD.map((s) => g.measureText(s).width))
      const cw = Math.round(Math.max(52 + g.measureText('handoff').width + 12, 18 + bodyW + PAD))
      const chh = Math.round(titleTh + 12 + CARD.length * ROW_H + PAD)
      const cx = Math.round(W * 0.055) // 标题栏盒 ≥5%W（G5 左沿）
      const cy = Math.round(H * 0.2)
      g.save()
      g.globalAlpha = cardA
      const cth = nestedWindow(g, { x: cx, y: cy, w: cw, h: chh, depth: 1, alpha: 1, label: 'handoff' })
      g.font = MONO(BODY_PX, 500)
      g.textAlign = 'left'
      g.textBaseline = 'top'
      for (let i = 0; i < CARD.length; i++) {
        const lu = clamp((t - tHandoff - i * 0.35) / 0.28)
        if (lu <= 0) continue
        const str = CARD[i].slice(0, Math.max(1, Math.round(lu * CARD[i].length)))
        g.fillStyle = i === 0 ? C.cyan : rgba(C.fg, 0.9)
        g.fillText(str, cx + 18, cy + cth + 12 + i * ROW_H)
      }
      g.restore()
    }

    // ---- 3:12–3:20 handoff.md 从心脏飞进右下角新窗口 ----
    drawHandoffFlight(g, ctx, t, beatPulse)

    // ---- T53 / FIX_V5 §N 3:13：删除「左侧重新出现的那个带一堆横线的窗口」 ----
    // 旧版是 `drawOldWindow()`（session #001，x=0.03W、y=0.16H、595×475 的变灰窗口，内含
    // 5 行「— — —」+ `archived`）——它是 gscan 里 193.5–205.9 每帧 5–6 处 g5 越界（文字左缘 x=78px）
    // 的来源，且与 3:13 的规格冲突，整段删除（函数体也一并删掉）。

    // ---- 新窗口 session #002 + 开机日志 + restored ♥ + 3:25.96 自动键入 ----
    drawNewSession(g, ctx, t)

    // ---- 定格构图的电源图标（与段 A 呼应） ----
    if (freeze > 0.5) {
      const pw = 0.4 + 0.6 * span(t, 206.0, 206.7)
      g.save()
      g.globalAlpha = 0.9
      g.strokeStyle = C.cyan
      g.lineWidth = 4
      g.lineCap = 'round'
      g.beginPath()
      g.arc(W / 2, H * 0.44, 54, -Math.PI / 2 + 0.5, -Math.PI / 2 + 0.5 + TAU * 0.86 * pw)
      g.stroke()
      g.beginPath()
      g.moveTo(W / 2, H * 0.44 - 62)
      g.lineTo(W / 2, H * 0.44 - 62 + 34 * pw)
      g.stroke()
      g.restore()
    }

    // ---- 立绘：closed、去色 ----
    const spriteA = freeze > 0.5 ? 1 : heartA
    if (spriteA > 0.01) {
      const desat = freeze > 0.5 ? 1 : 0.55 + 0.35 * slow
      ctx.whale.sprite = {
        expr: 'closed',
        rect: ctx.rect,
        alpha: freeze > 0.5 ? 0.95 : spriteA * (1 - span(t, 192.4, 193.4)),
        desat,
        tint: freeze > 0.5 ? null : '#3a4a5e',
        tintAmt: freeze > 0.5 ? 0 : 0.5 * slow,
        glitch: 0.04 * sync.pulse(t, 140),
      }
    }

    // ---- 3:29 CRT 关机后 / 3:31 黑场字幕（画在后处理之上） ----
    if (t > 209.6) {
      ctx.overlay = (vg) => drawCredits(vg, t, W, H, crtOff)
    }
  },
}

/* ---------------- handoff.md 飞行 ---------------- */
function drawHandoffFlight(g, ctx, t, beat) {
  const { W, H } = ctx
  const a = span(t, 191.9, 192.4)
  const u = inOutCubic(clamp(span(t, 192.0, 199.6)))
  if (a <= 0.01) return
  // T09 / §1.15：「handoff.md 做成**带拖尾的发光彗星**，**从爱心飞向新会话窗口**」。
  // 旧路径是 0.72W→0.80W（两个点都在右侧，起点根本不是爱心）；现在
  //   起点 = 爱心的屏幕位置（画面中央 0.50W, 0.50H，与 T07 把心放中央一致）
  //   终点 = 新会话窗口（0.66W…0.97W, 0.46H…0.80H）的左缘中部 ≈ (0.70W, 0.62H)
  const x0 = W * 0.5
  const y0 = H * 0.5
  // ⚠️ 终点必须停在**新窗口左缘之外**：文件框半宽 120px、窗口左缘 0.66W=1267，
  // 所以终点 x 要 ≤ 0.58W(=1114) 才不会压到窗口里的日志 —— 实测落在 0.70W 时
  // `handoff.md` 会压住日志行 `sandbox: on`（IoU 0.416，196.8–200.8 每帧 1 处）。
  const x1 = W * 0.58
  const y1 = H * 0.60
  // 弧线路径
  const bend = -H * 0.22 * Math.sin(u * Math.PI)
  const x = x0 + (x1 - x0) * u
  const y = y0 + (y1 - y0) * u + bend
  const arrived = u >= 0.999
  g.save()
  g.globalAlpha = arrived ? 1 - span(t, 200.0, 201.0) : 1
  // T09：**拖尾** —— 沿同一条弧线往后取 7 个采样点，逐个变小变淡
  for (let k = 7; k >= 1; k--) {
    const uu = clamp(u - k * 0.035)
    if (uu <= 0) continue
    const bendK = -H * 0.22 * Math.sin(uu * Math.PI)
    const tx = x0 + (x1 - x0) * uu
    const ty = y0 + (y1 - y0) * uu + bendK
    const rr = 14 - k * 1.4
    const tg = g.createRadialGradient(tx, ty, 0, tx, ty, rr)
    tg.addColorStop(0, rgba(C.gold, (0.42 - k * 0.05) * (0.7 + 0.3 * beat)))
    tg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = tg
    g.beginPath()
    g.arc(tx, ty, rr, 0, TAU)
    g.fill()
  }
  // 发光
  const rg = g.createRadialGradient(x, y, 0, x, y, 46)
  rg.addColorStop(0, rgba(C.gold, 0.75 + 0.25 * beat))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath()
  g.arc(x, y, 46, 0, TAU)
  g.fill()
  // T53 / FIX_V5 §N 3:12：「删除中央黑底黄边的 HANDOFF.md 窗口」——
  // 旧版在这里画一个 240×86 的黑底(#1a1c22)金边窗口 + 36px「handoff.md」标签，
  // 起点正好是画面正中（0.50W, 0.50H）⇒ 3:12 时它停在她心口上压住主视觉（实测 192.2 文字盒
  // x0.444–0.556 / y0.483–0.522）。现在只保留**彗星本体**（金辉光晕 + 拖尾），不再有窗口/边框/文字。
  // 拖尾
  if (!arrived) {
    g.strokeStyle = rgba(C.gold, 0.35)
    g.lineWidth = 2
    g.beginPath()
    for (let i = 0; i <= 20; i++) {
      const uu = clamp(u - i * 0.012)
      const bx = x0 + (x1 - x0) * uu
      const by = y0 + (y1 - y0) * uu - H * 0.22 * Math.sin(uu * Math.PI)
      i === 0 ? g.moveTo(bx, by) : g.lineTo(bx, by)
    }
    g.stroke()
  }
  g.restore()
}

/* ---------------- 新会话窗口 ---------------- */
function drawNewSession(g, ctx, t) {
  const { W, H } = ctx
  // T53 / FIX_V5 §N 3:27：「电源图标出现的同一时刻，右下角会话窗口必须已消失（提前 0.3s 淡出）」。
  // 电源图标画在 `if (freeze > 0.5)` 里，而 `freeze = span(t,205.96,206.6)` ⇒ 它**首次出现 = 206.28**
  //（= 205.96 + 0.64×0.5）⇒ 淡出窗 = [205.98, 206.28]，窗口恰在图标出现的那一帧归零。
  // 旧版是 `1 - freeze*0.9`（205.96 时仍剩 1.0、要到 206.5 才归零）⇒ 图标已经在画了窗口还没走。
  const T_ICON = 205.96 + 0.64 * 0.5
  const a = span(t, 193.2, 194.0) * (1 - span(t, T_ICON - 0.3, T_ICON))
  if (a <= 0.01) return
  // T53 / FIX_V5 §N 3:13：「右下 SESSION 窗口：按 G1 自适应（文字不再过大）」——
  // 旧版固定 1267×497 的 595×367 窗口，日志在 maxW=547 处折行，且最右一行 x2=1831px > 95%W=1824px
  // ⇒ 193.5–208.5 每帧 2 处 g5 右越界；末端 `restored … ♥` 还另画成 68px 顶部居中的大字
  // （y=0.069H < 8%H，每帧 1 处 g5 顶越界）。
  // 现在：窗口 = 内容 + 24px 内边距（G1）、36px（30–40px 区间内）、整窗落在 [5%,95%]×[8%,80%] 内，
  // 末行 `restored: 1 item (unreadable) ♥` 仍发光强调，但**留在窗口里**、字号回到 36px。
  const PX = 36
  const ROW_H = PX * 1.5
  const PAD = 24
  const rows = LOG.map((s, i) => (i === LOG.length - 1 ? `${s} ♥` : s))
  g.font = MONO(PX, 500)
  const titleTh = Math.max(24, Math.round(PX * 1.3)) // = nestedWindow 的标题栏高
  const bodyW = Math.max(...rows.map((s) => g.measureText(s).width))
  const w = Math.round(Math.max(52 + g.measureText('session #002').width + 12, PAD + bodyW + PAD))
  // 末行再留一行给 3:25.96 的自动键入（旧 `drawFinalExecution` 已并入本窗口，见 R14 决策表）
  const h = Math.round(titleTh + 12 + (rows.length + 1) * ROW_H + PAD)
  const x = Math.round(W * 0.95) - w // 右缘贴 95%W（G5 右沿）
  const y = Math.round(H * 0.79) - h // 下缘在 80%H 之上（G5 下沿）
  g.save()
  g.globalAlpha = a
  const th = nestedWindow(g, { x, y, w, h, depth: 1, alpha: 1, label: 'session #002' })
  // 开机日志滚动（T09：≥36px）；末行留给下面的金色发光强调，避免同一行登记两次文字盒
  const n = clamp(Math.floor((t - 193.4) / 0.9) + 1, 0, rows.length)
  const headN = n >= rows.length ? rows.length - 1 : n
  const bodyY = y + th + 12
  bootLog(g, {
    x: x + PAD,
    y: bodyY,
    lines: rows.slice(0, headN).map((s) => ({ text: s, color: C.fgDim })),
    alpha: 1,
    size: PX,
    lh: 1.5,
    maxW: w - PAD * 2,
    maxH: h - th - 12 - PAD,
  })
  if (n >= rows.length) {
    const u = span(t, 197.9, 198.5)
    if (u > 0.01) {
      const pulse = 1 + 0.045 * Math.sin(t * 3.6)
      g.save()
      g.globalAlpha = a * u
      g.font = MONO(PX, 700)
      g.textAlign = 'left'
      g.textBaseline = 'top'
      g.shadowColor = rgba(C.gold, 0.95)
      g.shadowBlur = 26 * pulse
      g.fillStyle = '#fff3d0'
      g.fillText(rows[rows.length - 1], x + PAD, bodyY + (rows.length - 1) * ROW_H)
      g.restore()
    }
  }
  // T53 / §N 3:25.96：新会话自动键入 `world.execute(me);`。
  // 旧 `drawFinalExecution()` 是个 **0.70H 的独立盒子**，正好压在本窗口末行
  // `restored: 1 item (unreadable) ♥` 上（205.9 实测 1 处文字重叠），且字号只有 20px（< G1 的 30px）。
  // 现在改为**本窗口的最后一行**：窗口 h 已多算一行、字号 30px（G1 区间内）、下面没有第二个盒子。
  // 打字起点也对齐可见窗口（旧版 `cues.sec(...) - 0.46` = 205.20 起打，205.5 才显示 ⇒ 只能看到最后 5 个字）。
  const pa = span(t, 205.5, 205.9) * (1 - span(t, 205.96, 205.99))
  if (pa > 0.01) {
    const PROMPT_PX = 30
    const s = typed(TYPED, t, { start: 205.5, cps: 46, jitter: 0.1, seed: 8 })
    const py = bodyY + rows.length * ROW_H + Math.round((ROW_H - PROMPT_PX) / 2)
    g.save()
    g.globalAlpha = a * pa
    g.font = MONO(PROMPT_PX, 700)
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.fillStyle = C.amber
    g.fillText('>', x + PAD, py)
    g.fillStyle = C.fg
    g.fillText(s, x + PAD + 28, py)
    if (s.length < TYPED.length && cursorOn(t, { hz: 1.4 })) {
      g.fillStyle = C.cyan
      g.fillRect(x + PAD + 32 + g.measureText(s).width, py + 2, 10, PROMPT_PX - 6)
    }
    g.restore()
  }
  g.restore()
}

/* ---------------- 片尾字幕（画在后处理之上） ---------------- */
function drawCredits(g, t, W, H, crtOff) {
  const blackA = clamp(span(t, 209.9, 210.5))
  g.save()
  g.globalAlpha = blackA
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  const a = clamp(span(t, 211.0, 211.75))
  if (a > 0.01) {
    g.globalAlpha = a
    const cx = W / 2
    // T42 / FIX_V5 §G2：署名页只用英文；「界面致敬 DeepSeek Harness」整行**删除**。
    // 作者名保留原字形（CC BY-NC-SA 署名的一部分，不是标签/对话）——见 src/ui/globalrules.js 的说明。
    const lines = [
      ['music — Mili', 30, '#e8eaee', 0],
      ['unofficial fan work · AI-assisted', 22, '#b8bcc4', 1],
      ['whale-maid: 上善 · ZipZipPipe · Small-tailqwq · dsh-whale-galgame (CC BY-NC-SA 4.0)', 18, '#b8bcc4', 2],
    ]
    lines.forEach(([text, size, color, i]) => {
      g.font =
        i === 0
          ? `700 ${size}px "JetBrains Mono", monospace`
          : `500 ${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "JetBrains Mono", monospace`
      g.fillStyle = color
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(text, cx, H * (0.36 + i * 0.1))
    })
  }
  g.restore()
}
