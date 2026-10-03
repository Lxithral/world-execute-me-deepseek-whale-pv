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
    const cardA = span(t, tHandoff, tHandoff + 0.6) * (1 - span(t, tHandoff + 2.6, tHandoff + 3.4))
    if (cardA > 0.01) {
      handoffCard(g, { x: W * 0.32, y: H * 0.20, w: 640, alpha: cardA, pct: ctxAt(190.8), t })
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

/* ---------------- 心脏（⚠️ T07 已撤用：见下方说明） ----------------
 * ⚠️ T07 / FIX_V4 §1.14：「**删除右侧红色爱心及其标注（如 heartbeat 读数）**」。
 * 段 N 现在用的是 `src/lib/heart3d.js` 的蓝色 3D 粒子爱心（22000 粒、加法混合、白热核心、
 * 心跳冲击波环、轮廓发光管、火花粒子），与段 M 共用同一份实现。
 * 下面这个 2D `drawHeart()` 已**不再被调用**（含那行 `heartbeat N bpm` 读数）；
 * 保留函数体只是留作记录，**下次清理时整块删除**。任何情况下都不要把它接回画面。
 */
function drawHeart(g, ctx, t, a, beat, bpm) {
  const { W, H } = ctx
  const cx = W * 0.72
  const cy = H * 0.48
  const R = H * 0.16 * (1 + 0.09 * beat)
  g.save()
  g.globalAlpha = a
  g.fillStyle = rgba('#8f2038', 0.9)
  g.beginPath()
  for (let i = 0; i <= 120; i++) {
    const th = (i / 120) * TAU
    const x = 16 * Math.sin(th) ** 3
    const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
    const px = cx + x * (R / 16)
    const py = cy - y * (R / 16)
    i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)
  }
  g.closePath()
  g.fill()
  g.strokeStyle = rgba('#ff8fa3', 0.5 + 0.5 * beat)
  g.lineWidth = 2
  g.stroke()
  g.font = MONO(13, 600)
  g.fillStyle = rgba('#ffb0c0', 0.9)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillText(`heartbeat ${bpm.toFixed(0)} bpm`, cx, cy + R * 1.5)
  g.restore()
}

/* ---------------- handoff.md 飞行 ---------------- */
function drawHandoffFlight(g, ctx, t, beat) {
  const { W, H } = ctx
  const a = span(t, 191.9, 192.4)
  const u = inOutCubic(clamp(span(t, 192.0, 199.6)))
  if (a <= 0.01) return
  const x0 = W * 0.72
  const y0 = H * 0.48
  const x1 = W * 0.80
  const y1 = H * 0.76
  // 弧线路径
  const bend = -H * 0.22 * Math.sin(u * Math.PI)
  const x = x0 + (x1 - x0) * u
  const y = y0 + (y1 - y0) * u + bend
  const arrived = u >= 0.999
  g.save()
  g.globalAlpha = arrived ? 1 - span(t, 200.0, 201.0) : 1
  // 发光
  const rg = g.createRadialGradient(x, y, 0, x, y, 46)
  rg.addColorStop(0, rgba(C.gold, 0.75 + 0.25 * beat))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath()
  g.arc(x, y, 46, 0, TAU)
  g.fill()
  // 小文件
  roundRect(g, x - 34, y - 22, 68, 44, 5)
  g.fillStyle = rgba('#1a1c22', 0.96)
  g.fill()
  g.strokeStyle = C.gold
  g.lineWidth = 1.6
  g.stroke()
  g.font = MONO(11, 700)
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
  const a = span(t, 192.6, 193.6) * (1 - span(t, 205.4, 205.96)) * (1 - span(t, 188.5, 189.2) * 0)
  if (a <= 0.01) return
  const x = W * 0.05
  const y = H * 0.16
  const w = W * 0.30
  const h = H * 0.44
  g.save()
  g.globalAlpha = a
  nestedWindow(g, { x, y, w, h, depth: 0, alpha: 1, label: 'session #001' })
  // 变灰的内容
  const grey = 0.35 + 0.5 * slow
  g.globalAlpha = a * grey
  g.fillStyle = 'rgba(60,64,72,0.85)'
  g.fillRect(x + 8, y + 26, w - 16, h - 34)
  g.globalAlpha = a * 0.8
  g.font = MONO(12, 500)
  g.fillStyle = rgba(C.fgDim, 0.7)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  ;['— — — — —', '— — —', '— — — —', '— —'].forEach((s, i) => g.fillText(s, x + 20, y + 44 + i * 22))
  g.font = MONO(12, 700)
  g.fillStyle = rgba(C.red, 0.7)
  g.fillText('archived', x + 20, y + h - 26)
  g.restore()
}

/* ---------------- 新会话窗口 ---------------- */
function drawNewSession(g, ctx, t, freeze) {
  const { W, H, sync } = ctx
  const a = span(t, 193.2, 194.0) * (1 - freeze * 0.9)
  if (a <= 0.01) return
  const x = W * 0.60
  const y = H * 0.62
  const w = W * 0.36
  const h = H * 0.32
  g.save()
  g.globalAlpha = a
  nestedWindow(g, { x, y, w, h, depth: 1, alpha: 1, label: 'session #002' })
  // 开机日志滚动
  const n = clamp(Math.floor((t - 193.4) / 0.9) + 1, 0, LOG.length)
  const lines = LOG.slice(0, n).map((l, i) => ({
    text: l,
    color: i === LOG.length - 1 ? C.gold : C.fgDim,
  }))
  bootLog(g, { x: x + 14, y: y + 38, lines, alpha: 1, size: 14, lh: 1.7 })
  // 最后一行内容是一个 ♥
  if (n >= LOG.length) {
    const u = span(t, 197.9, 199.0)
    if (u > 0) {
      g.globalAlpha = a * u
      g.font = MONO(30, 700)
      g.fillStyle = C.red
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      g.fillText('♥', x + 34, y + 38 + LOG.length * 14 * 1.7 + 34)
      g.font = MONO(12, 500)
      g.fillStyle = rgba(C.fgDim, 0.8)
      g.fillText('(unreadable)', x + 70, y + 38 + LOG.length * 14 * 1.7 + 34)
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
