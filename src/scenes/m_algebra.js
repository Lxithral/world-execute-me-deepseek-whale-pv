// src/scenes/m_algebra.js — 段 M 2:57.4–3:08.5 爱的代数
// DIRECTOR：对话窗口一条用户提问（原创），她的回答以流式 token 逐字输出，穿插 def love(…) 的原创
// 代码；她 shy。
// T52 / FIX_V5 §M：①2:57 段 M 的粉色蜂群爱心按「咚咚」两拍心跳缩放（在 swarm.js / main.js 里）；
//   ②3:01 代码窗口按 G1 自适应并整体下移到安全区内；③3:02 只保留一套爱心
//   （heart3d 的蓝色粒子外壳 + 同形状内层实体 3D 心），删除画面左半边那颗大号心形方程
//   —— 方程改写成 `def love()` 函数体里的一行代码（见 src/lib/code.js 的 LOVE_CODE）；
//   ④3:08 内层 0.92 缩放、与外壳同父级（同心 / 同形 / 同旋转）。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect, wrapText } from '../ui/dsh.js'
import { typed, cursorOn, streamByTokens } from '../ui/typing.js'
import { LOVE_CODE, drawCodeBlock, streamLines } from '../lib/code.js'
import { beginPanel, endPanel } from '../ui/text.js'
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
     * 新爱心是共享库 `src/lib/heart3d.js`（段 N 的延续用同一份），粒子数 20000（外层壳）。
     * T52 / FIX_V5 §M 3:02 + 3:08：段 M 关掉"白热核心点团 / 中心的白色球 / 平面线条心"，
     * 改成同一父级下的**内层实体 3D 心**（`solidInner`，缩放 0.92）⇒ 只保留一套爱心。
     */
    this.heart = createHeartParticles(THREE, {
      count: 20000,
      coreCount: 2000,
      sparkCount: 900,
      scale: 0.62,
      whiteCore: false,
      lineOutline: false,
      solidInner: true,
    })
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.heart.object)
    this.heartBeat = 0
    this.lastBeatT = -1
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const tHeart = ctx.cues.sec('M', 'question', 182.4)
    const heartA = span(t, tHeart, tHeart + 1.0)

    // 底色
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex('#0d0b12', '#1a0d16', heartA)
      g.fillRect(0, 0, W, H)
      g.fillStyle = rgba(C.bg1, 0.45)
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 对话窗口 + 流式回答 + 原创代码 ----
    drawLoveCode(g, ctx, t)

    // ---- T52 / §M 3:02：不再让立绘点云汇成**第二颗心** ----
    // 原实现在这里请求 `ctx.whale.points = {from:'sprite', to:'heart', …}`，
    // 于是 3:02 那一刻画面里同时有：立绘抽出的心形点云 + heart3d 的粒子心 + 蜂群粉色心。
    // 「只保留一套爱心」⇒ 撤掉这条请求（她按 `ctx.whale.sprite.alpha` 正常淡出）。

    // ---- T07 / §1.13 + §1.14：蓝色（青蓝）3D 粒子爱心 ----
    // 中心 x≈38%（由相机反算世界 x，而不是手调常量）；缓慢自转；随拍心跳；
    // 外层壳 20000 粒（加法混合）+ §M 3:08 的内层实体心（0.92）+ 心跳冲击波环 + 火花粒子。
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
      this.metrics.heartPoints = 20000
      // T52 / §M 3:08：内层与外壳同父级、相对缩放 0.92（探针据此复核"同心同形同旋转"）
      this.metrics.heartInnerScale = 0.92
      this.metrics.heartChildren = this.heart.object.children.map((o) => o.type + ':' + (o.geometry ? o.geometry.type : ''))
    }

    // ---- T52 / §M 3:02：画面左半边那颗"挤出成 3D 字"的大号心形方程已删除 ----
    // 它的两条内容 `(x² + 9/4·y² + z² − 1)³` / `− x²z³ − 9/80·y²z³ = 0` 现在作为
    // `def love()` 函数体里的一行代码出现在左上代码窗（`src/lib/code.js` 的 LOVE_CODE）。
    // 原来那两块非文字的暗色底板（`rgba(58,16,48,0.55)` / `rgba(160,48,96,0.38)`）随之删除。

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
  // T41（FIX_V5 §G1）：`drawCodeBlock` 的行号槽 = size*2.2 = 74.8px，落在 `x - 74.8`；
  //   所以要让出槽位 + 按剩余宽度折行 + 窗口按内容定宽。
  // T52 / FIX_V5 §M 3:01 + 3:02：
  //   · 窗口整体下移到 `y = 0.10H`。原来 `y = 0.04H` 时标题盒 top 只有 **4.2%**，
  //     违反 G1 安全区（top ≥ 8%）；现在标题盒 top ≈ 10%，正文底 ≈ 0.34H，两侧都不越界。
  //   · `def love()` 的函数体里多了 3:02 要求的**一行心形方程**（73 字），折行后共 4 行；
  //     窗口尺寸按**完整文本**算（不随流式抖动），保证「文字不得大于窗口」。
  const GUTTER = Math.round(34 * 2.2)
  const x = W * 0.05
  const maxW = W * 0.52
  const codeW = maxW - 24 - GUTTER - 24
  const LINES = LOVE_CODE.slice(0, 3)
  g.save()
  g.font = MONO(34, 500)
  const fullRows = []
  for (const s of LINES) for (const p of wrapText(g, s, codeW)) fullRows.push(p)
  let fullBodyW = 0
  for (const r of fullRows) fullBodyW = Math.max(fullBodyW, g.measureText(r).width)
  const shown = streamLines(LINES, t, { start: 181.6, cps: 30, lineGap: 0.2 })
  const rows = []
  for (const s of shown) for (const p of wrapText(g, s.text, codeW)) rows.push({ text: p, done: s.done })
  g.restore()
  if (!shown.length) return
  const w = Math.min(maxW, 24 + GUTTER + fullBodyW + 24)
  const y = H * 0.10
  const h = fullRows.length * 34 * 1.5 + 58
  g.save()
  g.globalAlpha = a
  beginPanel(g, { x, y, w, h }, { pad: 24, id: 'loveCode:~/world/love.py', title: '~/world/love.py' })
  panel(g, x, y, w, h, { title: '~/world/love.py' })
  drawCodeBlock(g, x + 24 + GUTTER, y + 72, rows.slice(0, fullRows.length), { size: 34, alpha: 1, lh: 1.5, highlight: -1 })
  endPanel(g)
  g.restore()
}

