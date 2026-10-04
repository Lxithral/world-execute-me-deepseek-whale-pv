// src/scenes/n_handoff.js — 段 N 3:08.5–3:32 被困与交接
// DIRECTOR：3:10.8 ctxAt=88 弹出交接卡片；3:12–3:20 一枚发光的小文件 handoff.md 从心脏飞出，
// 飞进右下角新窗口 session #002，旧窗口变灰、心跳变慢；3:13–3:25.9（纯器乐）新会话开机日志滚动，
// 她 closed、去色，日志里只有一行 restored: 1 item (unreadable)，内容是一个 ♥；
// 3:25.96 最后一次「执行」：新会话自动键入 world.execute(me); 并回车闪白，画面定格在与段 A
// 相同的开机构图（首尾呼应）；3:29 CRT 关机；3:31 黑场字幕淡入。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, handoffCard, nestedWindow, bootLog, roundRect, ctxAt } from '../ui/dsh.js'
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
      this.heart.update(t, {
        // 冻结帧（206.0 起）按 DIRECTOR 要回到"段 A 开机构图"，那时不显示爱心
        alpha: freeze < 0.5 ? heartA : 0,
        beat: beatPulse,
        s: 0.9 + 0.1 * heartA,
        spin: 0.22,
      })
      this.metrics = this.metrics || {}
      this.metrics.heartPoints = 22000
      this.metrics.heartBeat = +beatPulse.toFixed(2)
    }

    // ---- 3:10.8 交接卡片 ----
    // 词锚点：交接卡片的时刻（DIRECTOR 3:10.8 与 anchors.js 的 N.handoff 一致）
    const tHandoff = ctx.cues.sec('N', 'handoff', 190.8)
    // ⚠️ T09 踩坑：交接卡与旧窗口**同在左带**（x∈[3%,34%]）。第一版卡片活到 194.4、
    // 旧窗口从 192.6 起淡入 → 192.6–194.2 两者重叠，实测 193.0/193.5/194.0 每帧 **3 处**。
    // 现在：卡片 190.8 起、**193.2 淡完**；旧窗口**延到 193.6** 才淡入 —— 中间留 0.4s 空档。
    const cardA = span(t, tHandoff, tHandoff + 0.6) * (1 - span(t, tHandoff + 2.0, tHandoff + 2.4))
    if (cardA > 0.01) {
      // T09 / §1.15：交接卡片**放大成终端形态** ——
      // 左侧带 x = 3%W（x∈[3%,34%]）、高 0.42H = 454px（≥ 38%H = 410）、
      // 文字 36px（≥36）、5 行（≤5）、逐行 + 行内逐字键入。
      // 不再用 `dsh.js` 的 `handoffCard()`（它内部是 12–14px，且是老式卡片版式）。
      const cx = W * 0.03
      const cy = H * 0.26
      const cw = W * 0.31
      const chh = H * 0.42
      const CARD = ['handoff.md', 'from session #001', 'items: 1', 'target: #002', 'ok ▸ resume']
      g.save()
      g.globalAlpha = cardA
      nestedWindow(g, { x: cx, y: cy, w: cw, h: chh, depth: 1, alpha: 1, label: 'handoff' })
      g.font = MONO(36, 500)
      g.textAlign = 'left'
      g.textBaseline = 'top'
      for (let i = 0; i < CARD.length; i++) {
        const lu = clamp((t - tHandoff - i * 0.35) / 0.28)
        if (lu <= 0) continue
        const str = CARD[i].slice(0, Math.max(1, Math.round(lu * CARD[i].length)))
        g.fillStyle = i === 0 ? C.cyan : rgba(C.fg, 0.9)
        g.fillText(str, cx + 18, cy + 44 + i * 46)
      }
      g.restore()
    }

    // ---- 3:12–3:20 handoff.md 从心脏飞进右下角新窗口 ----
    drawHandoffFlight(g, ctx, t, beatPulse)

    // ---- 旧窗口变灰（session #001） ----
    drawOldWindow(g, ctx, t, slow)

    // ---- 新窗口 session #002 + 开机日志 + restored ♥ ----
    drawNewSession(g, ctx, t, freeze)

    // ---- 3:25.96 最后一次「执行」：自动键入 + 回车闪白 → 定格 ----
    drawFinalExecution(g, ctx, t)

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
  // 小文件（T09：标签从 11px 抬到 **36px**，文件框相应放大到 240×86，否则字会溢出）
  roundRect(g, x - 120, y - 43, 240, 86, 8)
  g.fillStyle = rgba('#1a1c22', 0.96)
  g.fill()
  g.strokeStyle = C.gold
  g.lineWidth = 2
  g.stroke()
  g.font = MONO(36, 700)
  g.fillStyle = C.gold
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('handoff.md', x, y)
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

/* ---------------- 旧窗口变灰 ---------------- */
function drawOldWindow(g, ctx, t, slow) {
  const { W, H } = ctx
  const a = span(t, 193.6, 194.6) * (1 - span(t, 205.4, 205.96)) * (1 - span(t, 188.5, 189.2) * 0)
  if (a <= 0.01) return
  const x = W * 0.03
  const y = H * 0.16
  const w = W * 0.31
  const h = H * 0.44
  g.save()
  g.globalAlpha = a
  nestedWindow(g, { x, y, w, h, depth: 0, alpha: 1, label: 'session #001' })
  // 变灰的内容（T09：文字一律 ≥36px）
  const grey = 0.35 + 0.5 * slow
  g.globalAlpha = a * grey
  g.fillStyle = 'rgba(60,64,72,0.85)'
  g.fillRect(x + 8, y + 46, w - 16, h - 58)
  g.globalAlpha = a * 0.8
  g.font = MONO(36, 500)
  g.fillStyle = rgba(C.fgDim, 0.7)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  ;['— — — — —', '— — —', '— — — —', '— —'].forEach((s, i) => g.fillText(s, x + 20, y + 62 + i * 44))
  g.font = MONO(36, 700)
  g.fillStyle = rgba(C.red, 0.7)
  g.fillText('archived', x + 20, y + h - 56)
  g.restore()
}

/* ---------------- 新会话窗口 ---------------- */
function drawNewSession(g, ctx, t, freeze) {
  const { W, H, sync } = ctx
  const a = span(t, 193.2, 194.0) * (1 - freeze * 0.9)
  if (a <= 0.01) return
  // T09 / §1.15：新会话窗口放到**右侧带** x∈[66%,97%]，文字 ≥36px。
  // 垂直位置压到歌词区（y>0.8H=864）之上：y=0.46H、h=0.34H → 497–841 ✓
  // 同时与爱心中心半径（圆心=画面中央、半径 28%H=302px）保持距离：x 最小 1267，1267−960=307 > 302 ✓
  const x = W * 0.66
  const y = H * 0.46
  const w = W * 0.31
  const h = H * 0.34
  g.save()
  g.globalAlpha = a
  nestedWindow(g, { x, y, w, h, depth: 1, alpha: 1, label: 'session #002' })
  // 开机日志滚动（T09：≥36px）
  const n = clamp(Math.floor((t - 193.4) / 0.9) + 1, 0, LOG.length)
  const lines = LOG.slice(0, n).map((l, i) => ({
    text: l,
    color: i === LOG.length - 1 ? C.gold : C.fgDim,
  }))
  bootLog(g, { x: x + 14, y: y + 62, lines, alpha: 1, size: 36, lh: 1.5 })
  // T09 / §1.15：日志末行的 `restored: 1 item (unreadable) ♥` 单独做成
  // **≥64px 的发光大字**并轻微脉冲。放在**顶部居中**：
  //   宽度（64px 下约 1178px）放不进 595px 宽的右窗口，而顶部居中处
  //   距爱心中心 sqrt(432²) = 432 > 302 ✓、也不与左右两个窗口相交（它们在 y≥173）。
  if (n >= LOG.length) {
    const u = span(t, 197.9, 198.5) * (1 - freeze)
    if (u > 0.01) {
      const pulse = 1 + 0.045 * Math.sin(t * 3.6)
      g.save()
      g.globalAlpha = a * u
      g.font = MONO(Math.round(68 * pulse), 700)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.shadowColor = rgba(C.gold, 0.95)
      g.shadowBlur = 30
      g.fillStyle = '#fff3d0'
      g.fillText('restored: 1 item (unreadable) ♥', W / 2, H * 0.10)
      g.restore()
    }
  }
  g.restore()
}

/* ---------------- 最后一次「执行」 ---------------- */
function drawFinalExecution(g, ctx, t) {
  const { W, H } = ctx
  const a = span(t, 205.5, 205.9) * (1 - span(t, 205.96, 205.99))
  if (a <= 0.01) return
  // 新会话自动键入
  const bx = W * 0.62
  const by = H * 0.70
  g.save()
  g.globalAlpha = a
  roundRect(g, bx, by, 560, 48, 8)
  g.fillStyle = 'rgba(14,16,20,0.95)'
  g.fill()
  g.strokeStyle = C.gold
  g.lineWidth = 1.5
  g.stroke()
  g.font = MONO(20, 700)
  g.fillStyle = C.amber
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText('>', bx + 14, by + 24)
  const s = typed(TYPED, t, { start: ctx.cues.sec('N', 'lastExec', 205.5) - 0.46, cps: 46, jitter: 0.1, seed: 8 })
  g.fillStyle = C.fg
  g.fillText(s, bx + 40, by + 24)
  if (s.length < TYPED.length && cursorOn(t, { hz: 1.4 })) {
    g.fillStyle = C.cyan
    g.fillRect(bx + 42 + g.measureText(s).width, by + 12, 10, 22)
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
    const lines = [
      ['music — Mili', 30, '#e8eaee', 0],
      ['非官方同人作品 · 含 AI 辅助生成内容', 22, '#b8bcc4', 1],
      ['鲸鱼娘：上善 · ZipZipPipe · Small-tailqwq · dsh-whale-galgame（CC BY-NC-SA 4.0）', 18, '#b8bcc4', 2],
      ['界面致敬 DeepSeek Harness', 18, '#8b90a0', 3],
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
