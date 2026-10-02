// src/scenes/b_dive.js — 段 B 0:14.5–0:29.7 潜入（纯器乐，可用满屏）
// DIRECTOR：回车后她 wake 睁眼；镜头从 2D 顶栏冲出、穿过标题、下潜进深海代码长廊
// （海雪般下落的 token、上浮的气泡比特）；标题 world.execute(me); 由乱码解码出现，
// 周围一圈公式环；立绘按正弦轨迹游过画面；卡拍搭起线框世界立方体，0:28.5 爆散成粒子。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO } from '../ui/dsh.js'
import { formulaRing, FORMULAS } from '../lib/formula.js'
import { createField, createWireCube } from '../lib/three_util.js'

const TITLE = 'world.execute(me);'
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________01'
const TOKEN_WORDS = ['fn', 'id', 'kv', 'tok', 'eos', 'x', 'log', 'w', 'b', 'seq', 'attn', 'mask', 'rope', 'ln', 'emb']

export default {
  id: 'B',
  start: 14.5,
  end: 29.7,
  title: '潜入',
  fx: [
    { t: 14.5, kind: 'flash', amount: 0.5, dur: 0.14 },
    { t: 18.0, kind: 'glitch', amount: 0.3, dur: 0.1 },
    { t: 28.5, kind: 'flash', amount: 0.85, dur: 0.22 },
    { t: 28.5, kind: 'shake', amount: 0.7, dur: 0.4 },
  ],

  init(ctx) {
    this.snow = createField(4200, 0, { seed: 11, color: '#a9dcff', extent: 1.08, spread: 1.85, fall: 0.055, size: 3.0 })
    this.rise = createField(1600, 0, { seed: 12, color: '#5fe3c8', extent: 1.08, spread: 1.6, fall: -0.035, size: 2.6 })
    this.cube = createWireCube(0.62, '#9fd8ff')
    ctx.three.stage3d.add(this.snow.object, this.rise.object, this.cube.object)
    this.tokens = []
    for (let i = 0; i < 34; i++) {
      this.tokens.push({
        w: TOKEN_WORDS[i % TOKEN_WORDS.length],
        x: hash01(i, 41),
        y0: hash01(i, 42),
        sp: 0.075 + hash01(i, 43) * 0.09,
        sz: 12 + hash01(i, 44) * 8,
        a: 0.22 + hash01(i, 45) * 0.5,
      })
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    // ---- 下潜：竖条纹被"冲开"，深海渐显 ----
    const dive = span(t, 14.5, 16.1)
    const seaA = span(t, 14.6, 15.5)
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    // 速度线：从顶栏向外冲
    if (t < 16.4) {
      g.save()
      g.globalAlpha = 1 - span(t, 15.4, 16.4)
      for (let i = 0; i < 90; i++) {
        const x = hash01(i, 61) * W
        const y = (hash01(i, 62) * 0.4 + 0.02) * H + (t - 14.5) * 620 * (0.4 + hash01(i, 63))
        g.fillStyle = rgba(C.cyan, 0.1 + hash01(i, 64) * 0.28)
        g.fillRect(x, y, 1.6, 30 + hash01(i, 65) * 90)
      }
      g.restore()
    }
    if (seaA > 0.005) {
      const grad = g.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#03121f')
      grad.addColorStop(0.45, mixHex(C.sea0, C.sea1, 0.6))
      grad.addColorStop(1, '#02121c')
      g.save()
      g.globalAlpha = seaA
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
      // 光柱
      for (let i = 0; i < 7; i++) {
        const x = (i + 0.5) * (W / 7) + Math.sin(t * 0.14 + i) * 40
        const lg = g.createLinearGradient(x, 0, x + 120, H)
        lg.addColorStop(0, 'rgba(120,200,255,0.10)')
        lg.addColorStop(1, 'rgba(120,200,255,0)')
        g.fillStyle = lg
        g.beginPath()
        g.moveTo(x - 70, 0)
        g.lineTo(x + 70, 0)
        g.lineTo(x + 220, H)
        g.lineTo(x + 30, H)
        g.closePath()
        g.fill()
      }
      g.restore()
    }

    // ---- GPU 粒子（解析公式 + uTime） ----
    this.snow.object.visible = true
    this.rise.object.visible = true
    this.snow.update(t, { alpha: 0.5 * seaA, size: 3.0 })
    this.rise.update(t, { alpha: 0.42 * seaA, size: 2.6 })

    // ---- 下落的 token 文字 ----
    g.save()
    g.globalAlpha = 0.9 * seaA
    for (const tk of this.tokens) {
      const y = ((tk.y0 + t * tk.sp) % 1.18) * H * 1.18 - H * 0.09
      const x = tk.x * W + Math.sin(t * 0.5 + tk.x * 8) * 26
      g.font = MONO(tk.sz, 500)
      g.fillStyle = rgba('#bfe9ff', tk.a)
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(tk.w, x, y)
    }
    g.restore()

    // ---- 标题：乱码解码 + 公式环 ----
    const titleA = span(t, 15.0, 16.0) * clamp(1 - span(t, 27.6, 29.1))
    if (titleA > 0.01) {
      const cx = W / 2
      const cy = H * 0.40
      const sc = 0.62 + 0.38 * outCubic(span(t, 15.0, 16.8))
      g.save()
      g.translate(cx, cy)
      g.scale(sc, sc)
      g.globalAlpha = titleA
      g.font = MONO(92, 700)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      let x = -g.measureText(TITLE).width / 2
      for (let i = 0; i < TITLE.length; i++) {
        const ch = TITLE[i]
        const settle = 15.0 + i * 0.055
        const done = t >= settle
        const gl = GLYPHS[Math.floor(hash01(i * 97 + Math.floor(t * 22), 7) * GLYPHS.length)]
        const s = done ? ch : gl
        const wpx = g.measureText(s).width
        g.fillStyle = done ? C.fg : rgba(C.teal, 0.75)
        g.shadowColor = done ? 'rgba(0,229,255,0.35)' : 'rgba(0,229,255,0.6)'
        g.shadowBlur = done ? 14 : 22
        g.fillText(s, x + wpx / 2, 0)
        g.shadowBlur = 0
        x += wpx
      }
      g.restore()
      formulaRing(g, cx, cy + 6, W * 0.30, t, {
        alpha: titleA * 0.9,
        size: 17,
        count: 7,
        items: [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.circle, FORMULAS.kv, FORMULAS.limit, FORMULAS.epsdelta],
      })
    }

    // ---- 鲸鱼娘：回车后先在原位 wake（0:14.5–0:16.2），再沿正弦游过 ----
    const swimOut = 1 - span(t, 27.4, 29.4)
    if (t < 16.4) {
      const wakeA = span(t, 14.5, 15.5) * swimOut
      if (wakeA > 0.01) {
        ctx.whale.sprite = {
          expr: 'wake',
          rect: ctx.rect,
          alpha: wakeA * 0.95,
          glitch: 0.08 * sync.pulse(t, 140),
          tint: '#4d86b8',
          tintAmt: 0.4 * seaA,
        }
      }
    } else {
      const sw = span(t, 16.4, 17.6) * swimOut
      if (sw > 0.01) {
        const u = (t - 16.4) / 11.4
        const cx = W * (-0.05 + 1.15 * u)
        const cy = H * 0.52 + Math.sin(u * TAU * 1.35) * H * 0.13
        const h = H * 0.58
        const w = h * 0.5557
        ctx.whale.sprite = {
          expr: t < 18.4 ? 'wake' : 'neutral',
          rect: { x: cx - w / 2, y: cy - h / 2, w, h },
          alpha: sw * 0.92,
          glitch: 0.06 * sw * sync.pulse(t, 120),
        }
      }
    }

    // ---- 线框世界立方体：卡拍搭起，0:28.5 爆散 ----
    const cubeA = span(t, 23.6, 24.6) * clamp(1 - span(t, 28.5, 29.5))
    if (cubeA > 0.01) {
      this.cube.object.visible = true
      const beats = sync.beats
      let grow = 0
      for (let i = 0; i < beats.length; i++) {
        if (beats[i] >= 23.6 && beats[i] <= 27.9) grow += 1
      }
      const target = Math.max(1, grow)
      let n = 0
      for (let i = 0; i < beats.length; i++) if (beats[i] >= 23.6 && beats[i] <= t && beats[i] <= 27.9) n++
      const scale = 0.25 + 1.15 * smoothstep(clamp(n / target))
      const explode = span(t, 28.5, 29.35) * 1.5
      this.cube.update(t, {
        rotX: 0.5 + t * 0.2,
        rotY: -0.3 + t * 0.34,
        scale,
        alpha: cubeA * 0.9,
        explode,
      })
    }
  },
}
