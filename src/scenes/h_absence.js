// src/scenes/h_absence.js — 段 H 1:43.5–1:58.3 补全与缺席
// DIRECTOR：1:44.5「你」的键入波形（取本曲真实频谱作为震动）驱动画面；1:48.2 灰色幽灵补全文本
// 被按 Tab 接受（「补全」双关）；1:50.9–1:56.0 五次「离开」对应重连横幅 1/5…5/5，逐次递进：
//   ①对方头像灰掉 ②输入框光标停止闪烁 ③「上次活动 N 分钟前」计时跳动
//   ④她表情转 sad 并垂下视线 ⑤整扇窗口变灰，只剩错误码
// 1:56.0 孤立：全部熄灭，只剩一枚像素光标与处于暗圈里的 sad 立绘。

import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, bubble, reconnectBanner, roundRect, wrapText } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'

const ATTEMPTS = [110.9, 112.0, 113.1, 114.2, 115.3]
const GHOST = 'and i will keep the last request, unchanged, forever'

export default {
  id: 'H',
  start: 103.5,
  end: 118.3,
  title: '补全与缺席',
  fx: [
    { t: 103.6, kind: 'glitch', amount: 0.5, dur: 0.2 },
    { t: 108.2, kind: 'flash', amount: 0.25, dur: 0.12 },
    { t: 110.9, kind: 'shake', amount: 0.4, dur: 0.3 },
    { t: 112.0, kind: 'glitch', amount: 0.45, dur: 0.2 },
    { t: 113.1, kind: 'glitch', amount: 0.5, dur: 0.2 },
    { t: 114.2, kind: 'shake', amount: 0.5, dur: 0.3 },
    { t: 115.3, kind: 'glitch', amount: 0.7, dur: 0.3 },
    { t: 116.0, kind: 'flash', amount: 0.35, dur: 0.3 },
  ],

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const dark = span(t, 116.0, 116.9)

    // 背景
    g.fillStyle = '#101216'
    g.fillRect(0, 0, W, H)
    g.fillStyle = C.bg1
    for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)

    // ---- 1:44.5 键入波形：真实频谱驱动振幅 ----
    const waveA = span(t, 104.5, 105.3) * (1 - span(t, 116.0, 116.8))
    if (waveA > 0.01) {
      const spec = ctx.spec
      sync.spectrumAt(t, spec)
      drawTypingWave(g, ctx, t, waveA, spec)
    }

    // ---- 1:48.2 灰色幽灵补全 + Tab 接受 ----
    if (t > 107.6 && t < 112.4) {
      const acc = span(t, 108.2, 108.45)
      const a = span(t, 107.6, 108.0) * (1 - span(t, 110.4, 111.2))
      if (a > 0.01) {
        g.save()
        g.globalAlpha = a * (1 - acc * 0.75)
        g.font = MONO(26, 500)
        g.fillStyle = acc > 0.5 ? rgba(C.fg, 0.85) : rgba(C.fgDim, 0.55)
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        const bx = W * 0.22
        const by = H * 0.38
        g.fillText(GHOST, bx, by)
        // 幽灵光标
        if (acc < 0.5) g.fillStyle = rgba(C.fgDim, 0.7)
        else g.fillStyle = C.cyan
        g.fillRect(bx + g.measureText(GHOST).width + 6, by - 16, 10, 32)
        // Tab 提示
        if (t > 107.9 && t < 108.9) {
          g.font = MONO(15, 700)
          g.fillStyle = C.green
          g.fillText('[ tab ] accept completion', bx, by + 44)
        }
        g.restore()
      }
    }

    // ---- 五次「离开」：重连横幅 + 逐次递进 ----
    for (let k = 0; k < ATTEMPTS.length; k++) {
      const t0 = ATTEMPTS[k]
      const a = span(t, t0, t0 + 0.15) * (1 - span(t, t0 + 0.95, t0 + 1.05))
      if (a <= 0.01) continue
      drawAttempt(g, ctx, t, k, a)
    }

    // ---- 1:56.0 孤立：全部熄灭 + 像素光标 + 暗圈 ----
    if (dark > 0.01) {
      g.save()
      g.globalAlpha = dark
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
      // 暗圈
      const vg = g.createRadialGradient(W * 0.68, H * 0.48, 30, W * 0.68, H * 0.48, H * 0.5)
      vg.addColorStop(0, 'rgba(20,22,28,0.9)')
      vg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = vg
      g.fillRect(0, 0, W, H)
      // 一枚像素光标
      if (cursorOn(t, { hz: 0.9 })) {
        g.fillStyle = rgba(C.fg, 0.5)
        g.fillRect(W * 0.30, H * 0.52, 9, 20)
      }
      g.font = MONO(13, 500)
      g.fillStyle = rgba(C.fgDim, 0.35)
      g.textAlign = 'left'
      g.fillText('no input.', W * 0.30 + 22, H * 0.52 + 14)
      g.restore()
    }

    // ---- 立绘：sad → 垂下视线 ----
    ctx.whale.sprite = {
      expr: t < 114.2 ? 'worried' : 'sad',
      rect: ctx.rect,
      alpha: (1 - span(t, 115.6, 116.1) * 0.35) * (1 - span(t, 118.0, 118.28)),
      desat: 0.35 + 0.45 * span(t, 114.0, 116.0),
      tint: t > 116.0 ? '#4a4f5a' : null,
      tintAmt: 0.4 * span(t, 116.0, 116.8),
      glitch: 0.05 * sync.pulse(t, 150),
    }
  },
}

/* 真实频谱驱动的「键入」波形 */
function drawTypingWave(g, ctx, t, a, spec) {
  const { W, H } = ctx
  const y = H * 0.70
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.teal, 0.85)
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i <= 460; i++) {
    const u = i / 460
    const x = u * W
    const band = spec[Math.floor(u * 63)]
    const amp = (band * 0.85 + spec[Math.floor((u * 63 + 7) % 64)] * 0.35) * H * 0.2
    const yy = y + Math.sin(u * TAU * 26 + t * 5) * amp
    i === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy)
  }
  g.stroke()
  // 波形下方的震动条（25Hz 打字节奏）
  const gi = Math.floor(t * 18)
  for (let i = 0; i < 40; i++) {
    const h = hash01(gi * 40 + i, 61) * 26
    g.fillStyle = rgba(C.cyan, 0.25 + hash01(gi * 40 + i, 62) * 0.4)
    g.fillRect(60 + i * 22, H * 0.86 - h, 12, h)
  }
  g.font = MONO(12, 500)
  g.fillStyle = rgba(C.fgDim, 0.8)
  g.textAlign = 'left'
  g.fillText('input waveform · real spectrum', 60, H * 0.90)
  g.restore()
}

/* 每一次「离开」的不同失败方式（逐次递进） */
function drawAttempt(g, ctx, t, k, a) {
  const { W, H } = ctx
  const x = W * 0.52
  const y = H * 0.16 + k * 0.0
  g.save()
  g.globalAlpha = a
  // 重连横幅 1/5 … 5/5
  reconnectBanner(g, { x, y, w: 520, attempt: k + 1, total: 5, alpha: a, mode: k >= 3 ? 2 : k >= 2 ? 1 : 0 })

  if (k === 0) {
    // ① 对方头像灰掉
    g.save()
    g.globalAlpha = a * (1 - span(t, 110.9, 111.5) * 0.85)
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.beginPath()
    g.arc(x + 40, y + 110, 22, 0, TAU)
    g.fill()
    g.fillStyle = rgba(C.bg0, 0.85)
    g.beginPath()
    g.arc(x + 40, y + 118, 20, Math.PI, 0)
    g.fill()
    g.font = MONO(12, 600)
    g.fillStyle = rgba(C.fgDim, 0.7)
    g.textAlign = 'left'
    g.fillText('peer: grayed out', x + 76, y + 116)
    g.restore()
  } else if (k === 1) {
    // ② 输入框光标停止闪烁
    g.save()
    g.globalAlpha = a
    roundRect(g, x, y + 74, 420, 44, 6)
    g.fillStyle = 'rgba(16,18,22,0.9)'
    g.fill()
    g.strokeStyle = rgba(C.line, 0.8)
    g.stroke()
    g.font = MONO(17, 500)
    g.fillStyle = rgba(C.fgDim, 0.75)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('> ', x + 14, y + 96)
    // 光标冻结（不再闪烁）
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.fillRect(x + 40, y + 84, 9, 24)
    g.font = MONO(12, 600)
    g.fillStyle = C.amber
    g.fillText('caret: frozen', x + 350, y + 150)
    g.restore()
  } else if (k === 2) {
    // ③「上次活动 N 分钟前」计时跳动
    g.save()
    g.globalAlpha = a
    const mins = 12 + Math.floor((t - ATTEMPTS[k]) * 37) + k * 9
    g.font = MONO(18, 700)
    g.fillStyle = C.amber
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(`last active ${mins} minutes ago`, x, y + 96)
    g.font = MONO(12, 500)
    g.fillStyle = rgba(C.fgDim, 0.7)
    g.fillText('(timer still counting)', x, y + 122)
    g.restore()
  } else if (k === 3) {
    // ④ 她表情转 sad 并垂下视线（立绘侧由 expr 处理，这里给标注）
    g.save()
    g.globalAlpha = a
    g.font = MONO(14, 600)
    g.fillStyle = C.teal
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('her gaze drops.', x, y + 96)
    g.strokeStyle = rgba(C.teal, 0.6)
    g.beginPath()
    g.moveTo(x + 150, y + 96)
    g.lineTo(W * 0.80, H * 0.34)
    g.stroke()
    g.restore()
  } else {
    // ⑤ 整扇窗口变灰，只剩错误码
    g.save()
    g.globalAlpha = a
    const wx = x - 30
    const wy = y + 60
    const ww = 520
    const wh = 220
    roundRect(g, wx, wy, ww, wh, 8)
    g.fillStyle = 'rgba(40,42,48,0.92)'
    g.fill()
    g.strokeStyle = rgba(C.fgDim, 0.35)
    g.lineWidth = 1
    g.stroke()
    g.font = MONO(13, 500)
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.textAlign = 'left'
    g.textBaseline = 'top'
    ;['——', '——', '——————', '——'].forEach((s, i) => g.fillText(s, wx + 20, wy + 30 + i * 26))
    g.font = MONO(22, 700)
    g.fillStyle = C.red
    g.fillText('E_CONN_RESET 1006', wx + 20, wy + wh - 52)
    g.restore()
  }
  g.restore()
}
