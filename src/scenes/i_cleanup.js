// src/scenes/i_cleanup.js — 段 I 1:58.3–2:09 清理与违规
// DIRECTOR：1:59.2「compacting context…」：ctxAt 58→27，碎片 token 被一条 delete 光标横扫清除；
// 2:03.0 她打开 system 提示文件试图修改；2:05.7 光标写入；2:07.7 权限弹窗 permission denied；
// 2:09.0 非法参数的红色弹窗堆叠（每个落一个起音点）。

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, permissionDialog, warningModal, fileTree, progressBar, roundRect } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { text, FONT } from '../ui/text.js'
import { streamLines, drawCodeBlock, SYSTEM_PROMPT } from '../lib/code.js'
import { textPlane } from '../lib/scene3d.js'
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
    // §0.5：背景装饰代码的下限是 **26px**（`TEXT_MIN.codeDeco`）。
    // 旧实现是 `MONO(11)`，而且因为走的是**裸 `fillText`**，字号守卫根本没机会拦它
    // —— `?selftest` y) 报"字号守卫 0 违规"其实是因为它没经过 `text()`。
    // 现在字号提到 26px，并且真正走 `text()` 入口（role:'codeDeco'），守卫开始生效。
    const TOK_PX = 26
    const COL_W = 84 // > 5 字符 × 26px × 0.6（=78px）+ 余量
    const ROW_H = 36 // > 26px 字的盒高 30.2px + 抖动
    const X0 = 40
    const Y0 = ctx.H * 0.22
    const cols = Math.max(1, Math.floor((W - X0 * 2) / COL_W))
    const rows = 15
    const slots = cols * rows
    const TOKENS = ['kv', 'tok', 'x', 'w', 'b', 'eos', 'ln', 'attn', 'mask', 'rope']
    const MAX_TOK_PX = 5 * TOK_PX * 0.6
    this.cells = []
    for (let i = 0; i < 280; i++) {
      // 用一个双射把 i 打散到 [0, slots)：i 与 slots 互质的线性同余即可，无需洗牌
      // 613 与 22×15=330 不互质（613 是质数，330=2·3·5·11，互质）→ 仍是双射
      const slot = (i * 613) % slots
      const col = slot % cols
      const row = Math.floor(slot / cols)
      const jx = hash01(i, 105) * Math.max(0, COL_W - MAX_TOK_PX - 4)
      const jy = hash01(i, 106) * Math.max(0, ROW_H - TOK_PX * 1.2 - 2)
      this.cells.push({
        x: X0 + col * COL_W + jx,
        y: Y0 + row * ROW_H + jy,
        w: 0, // 宽度在绘制时按实测文字宽度定（见 drawCompaction）
        del: 119.2 + hash01(i, 104) * 4.2,
        tok: TOKENS[i % TOKENS.length],
      })
    }

    /* ================================================================== *
     * T22a①：§7 I「**此前所有模型炸成实例化碎片被扫走**」
     * 段 I 此前只有 2D token 被横扫（那些 token 是"上下文碎片"，不是"模型碎片"）。
     * 这里补上真正的 3D：**两组 InstancedMesh**（四面体 + 立方体，共 320 片，逐实例颜色），
     * 从中心炸开后铺开成云；再由 delete 扫描线按**左→右的波前**逐片扫掉（与 2D 横扫同一包络）。
     * ================================================================== */
    const T = ctx.three
    if (T && T.stage3d) {
      this.grp = new THREE.Group()
      this.grp.name = 'segI'
      T.stage3d.add(this.grp)
      const keyL = new THREE.DirectionalLight(0xdfefff, 1.8)
      keyL.position.set(1.2, 2.0, 2.4)
      const rimL = new THREE.DirectionalLight(0x6fb6ff, 0.9)
      rimL.position.set(-1.6, -0.7, 1.3)
      this.grp.add(keyL, rimL)
      const mkMat = () =>
        new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.42, flatShading: true })
      this.shardA = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.05), mkMat(), 240)
      this.shardB = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), mkMat(), 80)
      const mkCol = (m, n) => {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
        m.instanceColor.setUsage(THREE.DynamicDrawUsage)
      }
      mkCol(this.shardA, 240)
      mkCol(this.shardB, 80)
      this.grp.add(this.shardA, this.shardB)
      // 逐片的方向/速度/颜色（hash01 决定 ⇒ 仍是 t 的纯函数）
      const PAL = ['#9fe8ff', '#ffd479', '#ff8a5c', '#b48cff', '#7dffb0', '#7fe0ff']
      this.shardData = []
      for (let i = 0; i < 320; i++) {
        const a = hash01(i, 211) * Math.PI * 2
        const b = (hash01(i, 212) - 0.5) * 1.5
        const sp = 0.35 + hash01(i, 213) * 0.85
        this.shardData.push({
          dx: Math.cos(a) * Math.cos(b) * sp,
          dy: Math.sin(b) * sp * 0.8,
          dz: Math.sin(a) * Math.cos(b) * sp * 0.6,
          spin: (hash01(i, 214) - 0.5) * 3.2,
          nx: Math.cos(a) * Math.cos(b), // 用于"扫描线波前"判定的横向分量
          col: PAL[i % PAL.length],
        })
      }
      this._iM = new THREE.Matrix4()
      this._iQ = new THREE.Quaternion()
      this._iC = new THREE.Color()
      this._iV = new THREE.Vector3()
      this.metrics = { shards: 0, swept: 0, sweepU: 0 }

      /* ================================================================== *
       * T22b：§7 I 的 hero 拍 —— 「**红色错误面板朝镜头砸来**（作为 hero，
       * 此时画面**无其他主体**）」，时刻 = `god` 锚点 **127.539**。
       * 做法：3 块红色面板（本体 + 两块尾随）从**远处沿视线加速砸到镜头前**；
       * 面板文字走 `textPlane`（role:'term' ⇒ 3D 面片也吃 §2.3 的字号守卫）。
       * ================================================================== */
      this.errPanels = []
      this.errGrp = new THREE.Group()
      this.errGrp.name = 'segI:err'
      T.stage3d.add(this.errGrp)
      const ERRTXT = [
        ['E_PERMISSION', 'cannot write system_prompt.md'],
        ['E_ILLEGAL_ARG', 'expected <float>, got "you"'],
        ['E_PARADOX', 'the author is the subject'],
      ]
      for (let i = 0; i < 3; i++) {
        const g2 = new THREE.Group()
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.62, 0.05),
          new THREE.MeshStandardMaterial({
            color: 0x2a0d12,
            emissive: 0x8a1a1a,
            emissiveIntensity: 0.7,
            roughness: 0.42,
            metalness: 0.35,
          })
        )
        g2.add(back)
        const t1 = textPlane(ERRTXT[i][0], { role: 'term', height: 0.085, weight: 700, family: 'code', color: '#ff6b6b', glow: 0.4 })
        const t2 = textPlane(ERRTXT[i][1], { role: 'term', height: 0.06, weight: 500, family: 'code', color: '#ffd0d0', glow: 0.25 })
        t1.mesh.position.set(0, 0.1, 0.04)
        t2.mesh.position.set(0, -0.11, 0.04)
        g2.add(t1.mesh, t2.mesh)
        g2.visible = false
        this.errGrp.add(g2)
        this.errPanels.push({ grp: g2, back, t1, t2 })
      }
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    /* ---- T22b：红色错误面板朝镜头砸来（hero，`god` 127.539） ---- */
    if (this.errGrp) {
      const tGod = ctx.cues.sec('I', 'god', 127.539)
      const cam = ctx.three.camera
      const fwd = this._iV.set(0, 0, -1).applyQuaternion(cam.quaternion).clone()
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
      let any = false
      const seen = []
      for (let i = 0; i < this.errPanels.length; i++) {
        const P = this.errPanels[i]
        // 尾随的两块晚 0.10s / 0.20s 起（形成"一串砸来"）
        const u = clamp(span(t, tGod + i * 0.1, tGod + 0.78 + i * 0.1))
        const on = u > 0.001 && u < 0.999
        P.grp.visible = on
        if (!on) continue
        any = true
        // 距离：6.4 → 0.95（outCubic 加速逼近），砸到位后再一小段过冲
        const d = 6.4 - 5.45 * outCubic(u)
        P.grp.position.copy(cam.position).addScaledVector(fwd, d)
        P.grp.position.addScaledVector(right, (i - 1) * 0.16 * (1 - u))
        P.grp.position.addScaledVector(up, (1 - i) * 0.1 * (1 - u))
        P.grp.rotation.z = (i - 1) * 0.12 * (1 - u) + Math.sin(t * 9 + i) * 0.02 * u
        P.grp.rotation.y = (i - 1) * 0.25 * (1 - u)
        seen.push({ i, d: +d.toFixed(2) })
      }
      this.metrics.err = { t: +tGod.toFixed(3), n: seen.length, dist: seen }
      // ⚠️ 关键：`errGrp` 是 stage3d 的**另一个直接子节点**，而 compositor 每帧开头会把所有直接子节点
      // 的 visible 关掉（见 e_deal.js 的注释）—— 不显式打开它，面板就算自己的 visible=true 也不会被渲染。
      this.errGrp.visible = any
    }

    /* ---- T22a①：3D 实例化碎片（此前所有模型的碎片）被扫描线扫走 ---- */
    const tFrag3 = ctx.cues.sec('I', 'fragments', 121.496)
    if (this.grp) {
      const boom = clamp(span(t, tFrag3 - 2.9, tFrag3 - 0.2)) // 炸开
      const sweepU = clamp(span(t, tFrag3 - 2.3, tFrag3 + 1.7)) // 与 2D 横扫同一包络
      const alive = boom > 0.01 && sweepU < 0.999
      this.grp.visible = alive
      if (alive) {
        const cam = ctx.three.camera
        const fwd = this._iV.set(0, 0, -1).applyQuaternion(cam.quaternion).clone()
        this.grp.position.copy(cam.position).addScaledVector(fwd, 1.9)
        this.grp.rotation.y = Math.sin(t * 0.3) * 0.05
        // 扫描线的 NDC 横向位置（-1.15 → +1.15），与 2D 的 `sweep*W*1.05-40` 同相
        const lineN = sweepU * 2.3 - 1.15
        let shown = 0
        let swept = 0
        const meshes = [
          { m: this.shardA, off: 0, n: 240 },
          { m: this.shardB, off: 240, n: 80 },
        ]
        for (const { m, off, n } of meshes) {
          for (let i = 0; i < n; i++) {
            const d = this.shardData[off + i]
            const spread = outCubic(boom) * 1.25
            // 被扫过：横向分量在扫描线左侧 ⇒ 缩到 0（"被扫走"）
            const gone = d.nx < lineN
            if (gone) swept++
            else shown++
            const sc = gone ? 0.0001 : 0.55 + 0.45 * boom
            this._iV.set(d.dx * spread, d.dy * spread, d.dz * spread)
            this._iQ.setFromAxisAngle(
              new THREE.Vector3(0.577, 0.577, 0.577),
              d.spin * t
            )
            this._iM.compose(this._iV, this._iQ, new THREE.Vector3(sc, sc, sc))
            m.setMatrixAt(i, this._iM)
            this._iC.set(d.col).multiplyScalar(gone ? 0.05 : 0.85 + 0.15 * Math.sin(t * 4 + i))
            m.setColorAt(i, this._iC)
          }
          m.instanceMatrix.needsUpdate = true
          m.instanceColor.needsUpdate = true
        }
        this.metrics = { ...(this.metrics || {}), shards: shown, swept, sweepU: +sweepU.toFixed(2) }
      } else {
        this.metrics = { ...(this.metrics || {}), shards: 0, swept: 0, sweepU: +sweepU.toFixed(2) }
      }
    }

    if (!ctx.bgIs3d) {
      g.fillStyle = '#0e1014'
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 1:59.2 compacting context：碎片 token 被 delete 光标横扫清除 ----
    const compactA = span(t, 119.0, 119.7) * (1 - span(t, 123.6, 124.4))
    if (compactA > 0.01) drawCompaction(g, ctx, t, compactA, this.cells)
    // ---- 2:03.0 system 提示文件 + 2:05.7 写入 + 2:07.7 permission denied ----
    drawSystemFile(g, ctx, t)

    // ---- 2:09.0 非法参数弹窗堆叠（每个落一个起音点） ----
    drawIllegalStack(g, ctx, t, sync)

    // 顶部状态读数属开发信息，只在 ?debug（同屏 ctx 读数由 dsh 界面窗口给出，避免出现两个数）
    if (ctx.debug) {
      g.save()
      g.font = MONO(13, 500)
      g.fillStyle = C.teal
      g.textAlign = 'left'
      g.textBaseline = 'top'
      g.fillText('ctx ' + ctxAt(t).toFixed(0) + '%  ·  tokens ' + Math.round(16000 * (ctxAt(t) / 100)), 72, 62)
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
function drawCompaction(g, ctx, t, a, cells) {
  const { W, H } = ctx
  const tFrag = ctx.cues.sec('I', 'fragments', 121.5)
  const sweep = span(t, tFrag - 2.3, tFrag + 1.7)
  const sx = sweep * W * 1.05 - 40
  g.save()
  g.globalAlpha = a
  // 碎片 token（§0.5：背景装饰代码 ≥26px，走 text() 让守卫真正生效）
  const TOK_PX = 26
  g.font = `500 ${TOK_PX}px ${FONT.code}`
  // 面板打开期间，跳过落在面板矩形内的格子（那些 token 会被不透明面板盖住、观众看不见，
  // 画了只会让 §2.8 的同层重叠检测误报；见 SYSPANEL 的注释）。
  const pOpen = systemPanelAlpha(t) > 0.05
  const prect = pOpen ? sysPanelRect(W, H) : null
  for (const c of cells) {
    if (t < c.del) continue
    const gone = t > c.del + 0.35
    const fade = gone ? 0.12 : 1 - (t - c.del) / 0.35
    // 坐标已是像素（格点布局，见 init）——不再乘 W/H
    const x = c.x
    const y = c.y
    const tw = g.measureText(c.tok).width
    const barH = Math.round(TOK_PX * 1.15)
    if (prect) {
      const cw = tw + 8
      const chh = barH
      const ix = Math.max(0, Math.min(x + cw, prect.x + prect.w) - Math.max(x, prect.x))
      const iy = Math.max(0, Math.min(y + chh, prect.y + prect.h) - Math.max(y, prect.y))
      if (ix > 0 && iy > 0) continue
    }
    const dr = (t - c.del) / 0.35
    g.globalAlpha = a * clamp(fade)
    g.fillStyle = rgba(C.green, 0.65)
    g.fillRect(x, y, (tw + 8) * (1 - dr * 0.7), barH)
    text(g, c.tok, x + 4, y + barH * 0.72, {
      role: 'codeDeco', size: TOK_PX, family: 'code', weight: 500, color: C.bg0, align: 'left', baseline: 'alphabetic',
    })
  }
  // delete 光标横扫
  if (sweep > 0 && sweep < 1) {
    g.globalAlpha = a
    g.fillStyle = rgba(C.red, 0.16)
    g.fillRect(sx - 150, 0, 150, H)
    g.fillStyle = C.red
    g.fillRect(sx, 0, 3, H)
    g.font = MONO(14, 700)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    // §2.8：**不能**与下面那行固定的 'compacting context…' 共用 y 坐标。
    // 旧版两行都画在 `H * 0.16`，横扫到 x≈72 时两段文字完全压在一起
    // （实测 t=119.5s "delete"(123,166,50×16) ∩ "compacting context…"(72,157,228×23) IoU=0.137）。
    // 现在横扫标签下移 40px（两行盒高 16.2 + 23.2，40px 间距结构上不可能重叠），
    // 并把 x 夹在画面内，避免横扫到右边缘时标签跑出屏幕。
    g.fillText('delete', clamp(sx + 10, 8, W - 90), H * 0.16 + 40)
  }
  g.restore()
  g.save()
  g.globalAlpha = a
  g.font = MONO(20, 700)
  g.fillStyle = C.amber
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText('compacting context…', 72, H * 0.16)
  g.restore()
}

/* ---------------- system 提示文件 ---------------- */

/**
 * system 提示文件面板的几何与开合包络。
 * `drawSystemFile()` 与 `drawCompaction()` **共用**这一份定义：
 * 面板是**不透明**的，它盖住的碎片 token 在屏幕上根本看不见，
 * 但 §2.8 的包围盒检测只看同层 bbox、不知道遮挡关系 ——
 * 实测 t=123.5/124.0 报出 `"mask"(235,272,26×13) ∩ "~/world/system.prompt"(146,267,164×15) IoU=0.105`。
 * 正确的修法不是在检测上开口子，而是**不要画那块看不见的 token**：
 * 面板打开期间跳过落在面板矩形内的格子，于是登记表与观众实际看到的画面一致。
 */
const SYSPANEL = { xFrac: 0.07, yFrac: 0.24, wFrac: 0.44, hFrac: 0.5 }
function sysPanelRect(W, H) {
  return { x: W * SYSPANEL.xFrac, y: H * SYSPANEL.yFrac, w: W * SYSPANEL.wFrac, h: H * SYSPANEL.hFrac }
}
/** 面板开合包络（0..1）；两个函数都用它，避免两处时间漂移
 * ⚠️ T22b：收尾从 128.3–128.9 提前到 **127.5–128.05** —— §7 I 要红色错误面板作为 **hero**，
 * 且「此时画面**无其他主体**」；原来石碑一直挂到 128.9，会与砸来的红面板同框抢主体。
 */
function systemPanelAlpha(t) {
  return span(t, 123.0, 123.7) * (1 - span(t, 127.5, 128.05))
}

function drawSystemFile(g, ctx, t) {
  const { W, H } = ctx
  const open = systemPanelAlpha(t)
  if (open <= 0.01) return
  const { x, y, w, h } = sysPanelRect(W, H)
  g.save()
  g.globalAlpha = open
  panel(g, x, y, w, h, { title: '~/world/system.prompt' })
  const shown = streamLines(SYSTEM_PROMPT, t, { start: 123.4, cps: 30, lineGap: 0.26 })
  // 2:05.7 起光标开始写入，多出两行（+ 开头）
  // ⚠️ T22a②：字号 15px → **34px**（§2.3 面板类文字下限；15px 原来连 §0.5 的 codeDeco 26px 都不到），
  // 于是把屏上可见行数收成**最后 6 行**（像终端滚动），34×1.55 的 6 行 = 316px，仍装得进 540px 的面板。
  drawCodeBlock(g, x + 40, y + 96, shown.slice(-5), { size: 34, alpha: 1, lh: 1.55, highlight: t > 125.7 ? 4 : -1 })

  /* §3 `leave | deepseek | (草稿)希望你别再掉线。**键入后被划掉**` —— 石碑被光标"试图写入" */
  const tWrite = ctx.cues.sec('I', 'write', 124.33)
  const DRAFT = '(草稿)希望你别再掉线。'
  const ds = typed(DRAFT, t, { start: tWrite, cps: 12, seed: 5 })
  if (ds) {
    g.font = MONO(34, 500)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    const dx = x + 40
    const dy = y + h - 74
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
    g.fillText('> caret writing…', x + 40, y + h - 26)
  }
  g.restore()
  // 2:07.7 权限弹窗
  const den = span(t, 127.7, 128.2) * (1 - span(t, 128.6, 128.95))
  if (den > 0.01) {
    permissionDialog(g, { x: W * 0.30, y: H * 0.28, w: 460, alpha: den, mode: 'denied', t })
  }
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
    const y = H * 0.24 + k * 132 * (1 - (1 - outCubic(u)) * 0.5)
    warningModal(g, { x, y, w: 620, title: ILLEGAL[k][0], lines: [ILLEGAL[k][1], 'request rejected'], alpha: a, color: C.red, seed: k, t })
  }
  g.restore()
}
