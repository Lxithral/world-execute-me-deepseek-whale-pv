// src/scenes/m_algebra.js — 段 M 2:57.4–3:08.5 爱的代数
// DIRECTOR：对话窗口一条用户提问（原创），她的回答以流式 token 逐字输出，穿插 def love(…) 的原创
// 代码；点云从她身上抽出，汇成心形曲面；心形隐式方程 (x²+9/4·y²+z²−1)³−x²z³−9/80·y²z³=0
// 被挤出成 3D 字；低多边形面片飞入拼成心脏并随拍跳动；她 shy。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect } from '../ui/dsh.js'
import { typed, cursorOn, streamByTokens } from '../ui/typing.js'
import { drawMath, FORMULAS, heartField } from '../lib/formula.js'
import { LOVE_CODE, drawCodeBlock, streamLines } from '../lib/code.js'
import { createMeshLayer } from '../whale/mesh.js'
import * as THREE from 'three'
import { createHeartParticles, screenFracToWorldX } from '../lib/heart3d.js'

export default {
  id: 'M',
  start: 177.4,
  end: 188.5,
  title: '爱的代数',
  fx: [
    { t: 177.4, kind: 'flash', amount: 0.45, dur: 0.16 },
    { t: 182.6, kind: 'flash', amount: 0.5, dur: 0.2 },
    { t: 183.6, kind: 'glitch', amount: 0.4, dur: 0.2 },
    { t: 188.5, kind: 'flash', amount: 0.55, dur: 0.18 },
  ],

  init(ctx) {
    /* ---- T07 / FIX_V4 §1.13：把"低多边形面片心"换成**蓝色（青蓝）3D 粒子爱心** ----
     * 旧实现是 `drawHeartFacets()`（用隐式方程采样出的三角面片拼心）—— §1.13 明写
     * 「删除红色低多边形爱心，以及 M、N 两段里所有的扇形面片的心」。
     * 新爱心是共享库 `src/lib/heart3d.js`（段 N 的延续用同一份），
     * 粒子数 20000（外层壳）+ 2000（白热核心），加法混合、轮廓发光管、心跳冲击波环、火花粒子。
     */
    this.heart = createHeartParticles(THREE, { count: 20000, coreCount: 2000, sparkCount: 900, scale: 0.62 })
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.heart.object)
    this.heartBeat = 0
    this.lastBeatT = -1
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const tHeart = ctx.cues.sec('M', 'question', 182.4)
    const heartA = span(t, tHeart, tHeart + 1.0)
    const beat = 1 + 0.06 * sync.pulse(t, 260)

    // 底色
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex('#0d0b12', '#1a0d16', heartA)
      g.fillRect(0, 0, W, H)
      g.fillStyle = rgba(C.bg1, 0.45)
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 对话窗口 + 流式回答 + 原创代码 ----
    drawLoveCode(g, ctx, t)

    // ---- 点云从她身上抽出，汇成心形曲面 ----
    const pull = span(t, 182.0, 183.6)
    if (pull > 0.01) {
      ctx.whale.points = {
        from: 'sprite',
        to: 'heart',
        p: clamp(pull),
        stagger: 0.45,
        ease: inOutCubic,
        seed: 9,
        alpha: 1 - span(t, 184.9, 185.6) * 0.25,
        size: 4,
        bulge: 0.22,
        toParams: { a: 0.052 * beat, shell: 0.16, rot: 0.02 * Math.sin(t * 0.6) },
      }
    }

    // ---- T07 / §1.13 + §1.14：蓝色（青蓝）3D 粒子爱心 ----
    // 中心 x≈38%（由相机反算世界 x，而不是手调常量）；缓慢自转；随拍心跳；
    // 粒子 20000 + 白热核心 2000，加法混合，轮廓发光管，心跳冲击波环，火花粒子。
    {
      const hb = clamp(sync.pulse(t, 260))
      this.heartBeat = hb
      const cam = ctx.three.camera
      const dist = 3.0
      const hx = screenFracToWorldX(cam, 0.38, dist)
      this.heart.object.position.set(cam.position.x + hx, cam.position.y - 0.02, cam.position.z - dist)
      this.heart.update(t, {
        alpha: heartA,
        beat: hb,
        s: (0.85 + 0.15 * heartA) * (1 + 0.03 * hb),
        spin: 0.22,
      })
      this.metrics = this.metrics || {}
      this.metrics.heartCenterFracX = 0.38
      this.metrics.heartBeat = +hb.toFixed(2)
      this.metrics.heartPoints = 22000
    }

    // ---- 隐式方程挤出成 3D 字 ----
    // ⚠️ T07 / §1.13：字号必须 **≤60px**、半透明。
    // 这里原来是 80px —— 那是按 **FIX_V3 §7 M**「挤出方程字 ≥80px」做的（R0 把 20 改成 80）。
    // **FIX_V4 优先**，§1.13 明确改成「心形方程：字号 **≤60px**，半透明」→ 已下调到 56px。
    drawExtrudedEquation(g, ctx, t, heartA)

    // ---- 立绘（shy） ----
    ctx.whale.sprite = {
      expr: t < 182.4 ? 'neutral' : 'shy',
      rect: ctx.rect,
      alpha: 1 - span(t, 182.6, 183.3),
      glitch: 0.05 * sync.pulse(t, 150),
    }
  },
}

/* ---------------- 原创代码：def love(…)（对话窗口本身已交给 DOM 层） ---------------- */
function drawLoveCode(g, ctx, t) {
  const { W, H } = ctx
  const a = span(t, 181.4, 181.9) * (1 - span(t, 188.1, 188.45))
  if (a <= 0.01) return
  // T07b / FIX_V4 §2.3：段 M 的对话/代码小窗文字必须 **≥34px**（原来 14px）。
  // 「放不下时缩短内容,不缩字号」→ 把可见行数从 5 减到 **3**，字号抬到 34、行高 1.5。
  // 版式：3×34×1.5 = 153，加标题栏 28 与上下边距 → 面板 h ≈ 235，仍在左栏内、不进歌词区。
  const shown = streamLines(LOVE_CODE.slice(0, 3), t, { start: 181.6, cps: 30, lineGap: 0.2 })
  if (!shown.length) return
  const x = W * 0.05
  const w = W * 0.40
  // ⚠️ 字号抬到 34 后代码窗变高（3×51+58 = 211），原来的 y=0.10H 会让正文底部
  // （≈265）压到 56px 方程的顶部（280）—— 实测 183.4–185.9 每帧 1 处重叠。
  // 按「放不下时缩短内容」的精神把窗口整体上移到 0.04H：窗口 43–254、正文底部 ≈265 < 280 ✓
  const y = H * 0.04
  const h = shown.length * 34 * 1.5 + 58
  g.save()
  g.globalAlpha = a
  panel(g, x, y, w, h, { title: '~/world/love.py' })
  drawCodeBlock(g, x + 24, y + 56, shown, { size: 34, alpha: 1, lh: 1.5, highlight: -1 })
  g.restore()
}

/* ---------------- 隐式方程挤出成 3D 字 ---------------- */
function drawExtrudedEquation(g, ctx, t, a) {
  const { W, H } = ctx
  if (a <= 0.01) return
  // ⚠️ 这里原先有两个真问题：
  //   ① `size = 20` —— §7 段 M 明写「**挤出方程字 ≥80px**」，§0.5 的 formula 档下限也是 80px。
  //      因为走的是 `drawMath`（不是 `text()`），字号守卫根本拦不到它（和段 I 的 token 同一个坑）。
  //   ② 「3D 挤出：沿对角线重复」用 11 次 `drawMath` 把**同一条方程**每次偏 0.9px 画一遍。
  //      §2.8 点名的首要怀疑对象就是"同一行被多次绘制"：11 份几乎重合的文字两两相交，
  //      实测 `?selftest` r) 在 182.5/183.0/183.5s 单帧报 **4104** 处重叠
  //      —— 正好是 C(91,2)，即约 91 个盒子全挤在同一处，IoU 高达 0.8。
  // 修法：方程**只画一次**（并按可用宽度拆成两行），挤出感交给背后一块**非文字的暗色底板**。
  //
  // ⚠️ T07 / FIX_V4 §1.13 改了字号：**≤60px、半透明**。
  //   R0 时按 **FIX_V3 §7 M**「挤出方程字 ≥80px」把它抬到 80；**FIX_V4 优先**，现在取 **56px**。
  //   §1.13 还要求它"放在爱心左上方或沿爱心绕成一圈缓慢转动，不得与立绘、爱心主体、歌词区重叠"：
  //   爱心中心在屏幕 x≈38%、半径约 0.62 世界单位，所以把方程放到**左上**（y0 = 0.30H），
  //   并整体限制在 x < 0.40W 的左栏内，避开爱心与右侧立绘（66–96%）。
  const size = 56
  const lines = ['(x² + 9/4·y² + z² − 1)³', '− x²z³ − 9/80·y²z³ = 0']
  const lh = size * 1.16
  const x0 = W * 0.045
  const y0 = H * 0.30
  g.save()
  g.globalAlpha = a * 0.62 // §1.13「半透明」
  // 挤出底板：斜向叠两层深色板（非文字）
  g.fillStyle = 'rgba(58,16,48,0.55)'
  g.fillRect(x0 - 12, y0 - size * 0.86 - 10, 720, lh + 26)
  g.fillStyle = 'rgba(160,48,96,0.38)'
  g.fillRect(x0 - 5, y0 - size * 0.86 - 4, 706, lh + 14)
  for (let i = 0; i < lines.length; i++) {
    drawMath(g, x0, y0 + i * lh, lines[i], size, { color: i === 0 ? '#ffffff' : '#ffe6f2', align: 'left' })
  }
  g.restore()
}

