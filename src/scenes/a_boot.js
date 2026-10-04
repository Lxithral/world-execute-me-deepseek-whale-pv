// src/scenes/a_boot.js — 段 A 0:00–0:14.5 载入（FIX.md §3 段 A 重做）
//
// FIX 对本段的要求（逐条落实，行末标注出处）：
//   · 删除"三角形网格拼出鲸鱼娘立绘"的整个效果；本段**不出现立绘**（§3 A / §5.1）
//   · 删除 0:12 立绘上方的"两条黑线"（= closed 角色的伪造黑眼睑条，见 §5.1）
//   · 新画面全部是 **3D 世界初始化**（§3 A）：
//       power          CRT 亮起（仅 2 秒）
//       pieces         3D 参数晶格在空间中一格格铺开
//       object         线框立方体 / 球 / 环面被"创建"出来并旋转
//       parameters     数值条在晶格上充能
//       initialisation 初始化完成（晶格整体收束）
//       new world      中心的世界种子立方体发光膨胀
//       simulation     巨大等宽字（≥64px）键入 world.execute(me); 并回车闪白
//   · §5.6 首行：CRT 亮线展开压到 0.25s 内；亮线出现的**同一帧**就有 3D 晶格的微光，不留死黑
//
// 旧文件里的"真实计算"照旧沿用（FIX §5.0 允许迁移）：
//   · 词锚点（ctx.cues）驱动**全部**事件时刻，不再写绝对秒数；
//   · 起音点（sync.onsetsIn）驱动晶格逐格铺开的节拍；
//   · 上下文占用读数取 ctxAt(t)（全片唯一来源）。
// 画面输出全部改 3D：本文件**不再用 Canvas2D 画主体**（只在 ?debug 与 §5.3 允许的
// "A 开场一次 ctx 小字"里用 2D 文字，且都经 text() 的字号守卫）。

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span, outBack } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text, FONT } from '../ui/text.js'
import { textPlane, wireShape, voxelField, createLightRigSafe, pxPerUnitAt } from '../lib/scene3d.js'
import { ctxAt } from '../ui/dsh.js'

const TYPED = 'world.execute\n(me);'
/** 晶格：7×5 = 35 格 */
const LATTICE_C = 7
const LATTICE_R = 5
const LATTICE_N = LATTICE_C * LATTICE_R
const LATTICE_W = 1.8
const LATTICE_H = 1.05
/**
 * 标题文字的世界高度。
 * 取 0.22 是算出来的，不是拍的：相机在 t≈12.9 时 z≈3.62 / fov 39.9°，
 * 标题所在深度 z=0.9 处的可见高 ≈1.97、可见宽 ≈3.51（世界单位）；
 * 换算是 547 px / 世界单位。
 *   · 字面高 0.22 → 屏上 120px，满足 §0.5「标题 ≥120px」；
 *   · 最长一行 `world.execute` 13 字符 × 0.6em × 118px ≈ 1.60 世界单位 = 可见宽的 46%，放得下；
 *   · 文字块中心 y=-0.30 → 底边 y≈-0.50 → 在 1080 上落在 0.855H，**不侵入歌词区（0.885H 以下）**。
 */
const TITLE_H = 0.22

export default {
  id: 'A',
  start: 0,
  end: 14.5,
  title: '载入',
  fx: [
    { t: 0.32, kind: 'flash', amount: 0.2, dur: 0.1 }, // CRT 亮线
    { t: 14.0, kind: 'flash', amount: 1.0, dur: 0.2 }, // 回车闪白
    { t: 14.0, kind: 'glitch', amount: 0.5, dur: 0.12 },
  ],

  init(ctx) {
    const T = ctx.three
    this.grp = new THREE.Group()
    this.grp.name = 'segA'
    T.stage3d.add(this.grp)
    this.lights = createLightRigSafe()
    T.stage3d.add(this.lights)

    /* ---- 参数晶格 ---- */
    this.field = voxelField({ count: LATTICE_N, cell: 0.085, gap: 0.055 })
    this.grp.add(this.field.object)
    this.cellPos = (i) => {
      const c = i % LATTICE_C
      const r = Math.floor(i / LATTICE_C)
      const x = (c / (LATTICE_C - 1) - 0.5) * LATTICE_W
      const y = (0.5 - r / (LATTICE_R - 1)) * LATTICE_H
      const z = Math.sin(r * 1.7 + c * 0.9) * 0.1
      return [x, y, z]
    }
    // 铺开顺序：从中心向外（radialOrder 的等价物，写成定型数组以便与起音点对齐）
    this.order = new Float32Array(LATTICE_N)
    {
      let dmax = 1e-6
      const d = new Float32Array(LATTICE_N)
      for (let i = 0; i < LATTICE_N; i++) {
        const [x, y] = this.cellPos(i)
        d[i] = Math.hypot(x, y)
        if (d[i] > dmax) dmax = d[i]
      }
      for (let i = 0; i < LATTICE_N; i++) this.order[i] = d[i] / dmax + hash01(i, 91) * 0.05
      let m = 1e-6
      for (let i = 0; i < LATTICE_N; i++) if (this.order[i] > m) m = this.order[i]
      for (let i = 0; i < LATTICE_N; i++) this.order[i] /= m
    }

    /* ---- 三个线框几何 ---- */
    const shapes = [
      ['box', -0.63, 0.06, 0x8fd4ff, 0.24],
      ['sphere', 0.0, 0.08, 0xc792ea, 0.22],
      ['torus', 0.63, 0.06, 0x8ff0a4, 0.22],
    ]
    this.shapes = shapes.map(([kind, x, y, color, size]) => {
      const w = wireShape(kind, { size, color, radius: 0.0065 })
      w.object.position.set(x, y, 0.34)
      this.grp.add(w.object)
      return { ...w, kind, hex: color, baseSize: size }
    })

    /* ---- 世界种子立方体 ---- */
    this.seedMat = new THREE.MeshBasicMaterial({
      color: 0xffd479,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.seed = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), this.seedMat)
    this.seed.position.set(0, 0.02, 0.66)
    this.grp.add(this.seed)
    this.seed.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.11, 0.11),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
      )
    )

    /* ---- 巨大等宽字（整串一次成图）+ 3D 光标 ---- */
    this.title = textPlane(TYPED, {
      role: 'title',
      height: TITLE_H,
      weight: 700,
      family: 'code',
      color: '#eaf6ff',
      glow: 0.5,
    })
    this.title.mesh.position.set(0, -0.3, 0.9)
    this.grp.add(this.title.mesh)
    this.caret = new THREE.Mesh(
      new THREE.PlaneGeometry(0.016, TITLE_H * 0.8),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    this.caret.position.set(0, -0.3, 0.92)
    this.grp.add(this.caret)

    this.metrics = { tris: 0 }
    /* ---- T15 / §1.1：电源线（折线 + 电流脉冲 + 3D 插头 + 火花）---- */
    this.cord = buildPowerCord()
    this.grp.add(this.cord.object)
  },

  render(t, lt, ctx) {
    const T = ctx.three
    this.grp.visible = true
    this.lights.visible = true
    const cue = (k, d) => ctx.cues.sec('A', k, d)

    /* ================= 时间线（全部走词锚点） ================= */
    const tPower = cue('power', 0.32)
    // T15 / §1.1：`protection`（歌词 `Remember to put on protection`，本轮补的锚点）
    const tProtect = cue('protection', 2.1)
    // ⚠️ 这里必须**自己再取一次** `pieces`：这个块的物理位置在外层 `const tPieces` **之前**，
    // 直接引用它会 `Cannot access 'tPieces' before initialization`（TDZ）→ 段 A 每帧抛错。
    const tPiecesA = cue('pieces', 4.9)
    /* ---- T15 / §1.1：电源线那一拍 ----
     * 折线从左缘伸进来（u 0→1 约 0.9s），插头在末段与插座对接（≈u 0.92）→ 火花迸发。 */
    if (this.cord) {
      const u = clamp(span(t, tPower - 0.15, tPower + 0.95))
      const alpha = clamp(span(t, tPower - 0.15, tPower + 0.2)) * (1 - span(t, tPiecesA - 0.2, tPiecesA + 0.45))
      const spark = span(t, tPower + 0.72, tPower + 0.88) * (1 - span(t, tPower + 1.25, tPower + 1.6))
      this.cord.update(t, { u: u, alpha: alpha, spark: spark })
    }
    // 巨大的电源符号（直径 0.34H ≥0.30H）与 protection 的盾牌/锁
    // ⚠️ 必须用 `ctx.g`：这一段在 render 里位于局部 `const g` **之前**，直接用 `g` 会
    // `Cannot access 'g' before initialization`（TDZ）。
    drawPowerSymbol(ctx.g, ctx, t, clamp(span(t, tPower, tPower + 0.35)) * (1 - span(t, tPower + 1.5, tPower + 2.0)))
    drawProtection(ctx.g, ctx, t, clamp(span(t, tProtect, tProtect + 0.35)) * (1 - span(t, tPiecesA - 0.2, tPiecesA + 0.3)))
    const tPieces = cue('pieces', 4.9)
    const tObject = cue('object', 6.44)
    const tParams = cue('parameters', tObject + 1.3)
    const tInit = cue('init', tParams + 1.1)
    const tSeed = cue('newWorld', NaN)
    const tSeedUse = Number.isFinite(tSeed) ? tSeed : Math.max(tObject + 0.9, tInit + 0.2)
    // simulation 的词起唱时间是 14.002s —— 也就是段 A 的最后一刻。
    // FIX §2.2：视觉"到位"时间 = 词起唱时间，动作启动 = 提前 0.25–0.4s（预备）。
    // 所以"打完 + 回车"落在 14.00，"开始键入"落在它前面（12.9 左右），两者都锚在同一个词上。
    const tEnter = cue('simulation', 14.0)
    const tType = tEnter - 1.12

    /* ================= ① 参数晶格：一格格铺开 ================= */
    // FIX_V3 §7 段 A：「A(保留):补 **t=0 起**就有微弱的晶格辉光,不留死黑」。
    // ⚠️ 旧实现把微光**整个**挂在 `tPower`（power 词 ≈1.214s）之后：
    //    `fadeIn = span(t, tPower-0.02, tPower+0.6) * 0.05`，
    //    而 `litAt(i)` 又要等 `spreadU`（pieces@4.901）—— 于是 t=0–1.19 这 1.2 秒里
    //    35 格的强度**恒为 0**，正是 §7 A 点名的"死黑"。
    // 现在给一个**从 t=0 就在**的地板 `floorGlow`。量级刻意压到 0.022：
    // 它只负责"不留死黑"，远低于 pieces 铺开时的 0.6+，所以"一格格铺开"的信息量不受影响。
    // 同样乘 `dimOut`，段末该收的时候一起收。
    const floorGlow = 0.022
    const fadeIn = clamp(span(t, tPower - 0.02, tPower + 0.6)) * 0.05
    const spreadU = clamp(span(t, tPieces - 0.35, tPieces + 2.3))
    const chargeU = clamp(span(t, tParams - 0.3, tParams + 1.4))
    const dimOut = 1 - clamp(span(t, 13.2, 14.4))

    const litAt = (i) => {
      const o = this.order[i]
      const s = clamp((spreadU * 1.22 - o) / 0.3)
      if (s <= 0) return 0
      const charged = clamp((chargeU * 1.18 - o) / 0.32)
      // 充能时有一次"数值条"过冲
      const over = Math.exp(-Math.pow((charged - 0.94) * 7, 2)) * 0.35
      return clamp((s * (0.6 + 0.4 * charged) + over) * dimOut)
    }
    const tmpCol = new THREE.Color()
    const colTeal = new THREE.Color(0x7fd8ff)
    const colAmber = new THREE.Color(0xffd479)
    this.field.update(
      (i) => this.cellPos(i),
      // 微光也逐格抖一点：整片同时亮起会看起来像"一开始就有晶格"。
      // `floorGlow` 是 t=0 起就在的地板（§7 段 A：不留死黑），`fadeIn` 是 power 词处的加强。
      (i) => litAt(i) + (floorGlow + fadeIn) * (0.5 + 0.5 * hash01(i, 17)) * dimOut,
      (i) => {
        const o = this.order[i]
        const charged = clamp((chargeU * 1.18 - o) / 0.32)
        tmpCol.copy(colTeal).lerp(colAmber, charged * 0.85)
        return tmpCol
      }
    )
    this.field.object.visible = true
    this.field.material.opacity = clamp(dimOut + 0.02)

    /* ================= ② 三个线框几何被"创建" ================= */
    const shapeU = clamp(span(t, tObject - 0.35, tObject + 1.5))
    for (let k = 0; k < this.shapes.length; k++) {
      const sh = this.shapes[k]
      const delay = k * 0.15
      const u = clamp((shapeU - delay) / Math.max(1e-4, 1 - delay))
      sh.object.visible = u > 0.002 && dimOut > 0.01
      if (!sh.object.visible) continue
      const pop = outBack(u)
      sh.object.scale.setScalar(Math.max(0.001, pop * (0.92 + 0.08 * Math.sin(t * 1.1 + k))))
      sh.object.rotation.y = t * (0.55 + k * 0.13)
      sh.object.rotation.x = Math.sin(t * 0.6 + k * 1.7) * 0.3
      // 创建瞬间白热
      const hot = Math.exp(-Math.pow((u - 0.05) * 9, 2))
      sh.material.color.setHex(sh.hex).lerp(new THREE.Color(0xffffff), hot)
      sh.material.opacity = 0.95 * u * dimOut
    }

    /* ================= ③ 世界种子立方体：发光膨胀 ================= */
    const seedU = clamp(span(t, tSeedUse - 0.3, tSeedUse + 1.5))
    this.seed.visible = seedU > 0.002 && dimOut > 0.01
    if (this.seed.visible) {
      const grow = outBack(seedU)
      const breathe = 1 + 0.09 * Math.sin(t * 2.6)
      this.seed.scale.setScalar(Math.max(0.001, grow * 1.4 * breathe))
      this.seed.rotation.y = t * 0.7
      this.seed.rotation.x = t * 0.42
      this.seedMat.opacity = (0.45 + 0.4 * Math.sin(t * 3.1)) * seedU * dimOut
    }

    /* ================= ④ 巨大等宽字：键入 world.execute(me); ================= */
    const typeAlpha = clamp(span(t, tType - 0.35, tType + 0.3)) * (1 - span(t, 14.34, 14.5))
    const typeVisible = typeAlpha > 0.01
    this.title.mesh.visible = typeVisible
    if (typeVisible) {
      // 逐字：真正重画 canvas（不用贴图裁剪，见 scene3d.setText 的说明）。
      // 面片世界尺寸恒定，所以文字从**左端**稳定地往右长；面片左端对齐到 -full/2。
      const n = clamp(Math.floor((t - tType) * 12.5), 0, TYPED.length)
      const frac = n / TYPED.length
      this.title.setText(TYPED.slice(0, n))
      this.title.material.opacity = typeAlpha
      const pop = outBack(clamp(span(t, tType - 0.35, tType + 0.45)))
      this.title.mesh.scale.set(1, 0.95 + 0.05 * pop, 1)
      const full = this.title.width
      this.title.mesh.position.x = -full * 0.5
      // 光标贴在已键入位置
      const done = n >= TYPED.length
      const caretOn = done ? (t > 13.95 ? (t * 2) % 1 < 0.5 : true) : (t * 1.25) % 1 < 0.62
      this.caret.visible = caretOn
      if (caretOn) {
        this.caret.material.opacity = typeAlpha
        // 光标只贴第一行（多行文字里逐字光标跟第一行最自然）
        const firstLineW = full * ((n <= 13 ? n : 13) / 13)
        this.caret.position.x = -full * 0.5 + Math.min(firstLineW, full) + 0.02
        this.caret.position.y = -0.3 + (n > 13 ? -TITLE_H * 0.62 : 0)
      }
      // 文字平面高度换算成屏幕上像素（供 ?debug 核对 §0.5 的 ≥64px 要求）
      this.metrics.titlePx = this.title.pxHeight(pxPerUnitAt(T.camera, 0.9, ctx.H))
      this.metrics.typed = n
    } else {
      this.caret.visible = false
    }

    /* ================= ⑤ ?debug / §5.3 允许的开场读数 ================= */
    const g = ctx.g
    if (ctx.debug) {
      g.save()
      g.globalAlpha = 0.92
      text(g, `A  tris=${T.renderer.info.render.triangles}  calls=${T.renderer.info.render.calls}`, 40, 84, {
        role: 'ui', size: 34, family: 'code', color: C.teal,
      })
      text(
        g,
        `spread ${(spreadU * 100).toFixed(0)}%  charge ${(chargeU * 100).toFixed(0)}%  title ${(this.metrics.titlePx || 0).toFixed(0)}px  power@${tPower.toFixed(2)} pieces@${tPieces.toFixed(2)} object@${tObject.toFixed(2)} type@${tType.toFixed(2)}`,
        40,
        124,
        { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      g.restore()
    }
    // ⚠️ 这里原本还有一段「A 开场一次的上下文占用小字」（t∈[0.6,3.4)、右上角 `context X%`）。
    // 它和 `src/main.js` 的 `drawHud()` 里那段是**同一份东西画了两遍**（同样的时间窗、
    // 同样的 (W−48, 0.1H)、同样的 34px）。FIX_V4 §2.1 明写「**角落 HUD 全部取消**
    // （包括 "context 0%" 之类）」、§1.1 也点名「取消右上角的 "context 0%" 等角落小字」，
    // 所以两处都已删除。上下文数字按 §2.1 只在**段 J 的中央巨字**出现。
  },

  dispose() {
    if (this.title) this.title.dispose()
  },
}

/* ================================================================== *
 * T15 / FIX_V4 §1.1：`Switch on the power line` 那一拍
 * ------------------------------------------------------------------
 *   · 「一条**粗发光折线从画面左缘伸入，途经晶格格点**」→ 4 点折线 + TubeGeometry
 *   · 「**电流脉冲（亮点+拖尾）沿线奔跑**」→ 亮球 + 3 段递减拖尾，沿 `curve.getPointAt(u)` 跑
 *   · 「末端是 **3D 电源插头**，与插座对接的瞬间**火花迸发**」→ 插头（体+两脚）+ 插座 + 火花 Points
 *   · 「同一时刻画面中央用发光管描出**巨大的电源符号**（圆环缺口+竖线），高度 ≥ 画面高度 30%」
 *     → `drawPowerSymbol()`：直径 0.34H（≥0.30H）
 *   · 其余概念：`pieces`/`object`/`parameters`/`init`/`new world`/`simulation` 早有；
 *     本轮补齐 §1.1 点名的 `protection` = **盾牌 + 锁描边**，并给它补上缺失的锚点。
 * ================================================================== */

function buildPowerCord() {
  const grp = new THREE.Group()
  grp.name = 'a:cord'
  // 折线：从左缘（画外）伸入，经过两个晶格格点附近，末端在中心左侧
  const pts = [
    new THREE.Vector3(-3.4, 0.42, 0.15),
    new THREE.Vector3(-2.05, 0.1, 0.1),
    new THREE.Vector3(-1.05, -0.2, 0.05),
    new THREE.Vector3(-0.22, 0.02, 0.0),
  ]
  const curve = new THREE.CatmullRomCurve3(pts)
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.024, 8, false), tubeMat)
  grp.add(tube)
  // 电流脉冲：亮点 + 3 段拖尾
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), pulseMat)
  grp.add(pulse)
  const tail = []
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 - i * 0.007, 10, 8), pulseMat.clone())
    grp.add(m)
    tail.push(m)
  }
  // 3D 插头（体 + 两脚）+ 插座
  const plug = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.2), new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: 0.4, metalness: 0.3 }))
  plug.add(body)
  for (const s of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.12), new THREE.MeshStandardMaterial({ color: 0xffd479, metalness: 0.8, roughness: 0.25 }))
    prong.position.set(s * 0.045, 0, 0.15)
    plug.add(prong)
  }
  grp.add(plug)
  const socketAt = pts[3].clone().add(new THREE.Vector3(0, 0, 0.22))
  const socket = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a3546, roughness: 0.6, metalness: 0.4 }))
  socket.position.copy(socketAt)
  grp.add(socket)
  // 火花（对接瞬间迸发）
  const SN = 90
  const sGeo = new THREE.BufferGeometry()
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3))
  const sparks = new THREE.Points(
    sGeo,
    new THREE.PointsMaterial({ color: 0xffe6a8, size: 0.03, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
  )
  grp.add(sparks)
  const plugged = socketAt.clone().add(new THREE.Vector3(0, 0, -0.13))
  return {
    object: grp,
    update(t, o = {}) {
      const u = clamp(o.u == null ? 0 : o.u)
      const alpha = o.alpha == null ? 1 : o.alpha
      const spark = o.spark == null ? 0 : o.spark
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      tubeMat.opacity = 0.95 * alpha
      const pk = clamp((u - 0.18) / 0.82)
      const toSock = pk > 0.92
      const head = curve.getPointAt(pk)
      plug.position.copy(toSock ? plugged : head)
      plug.rotation.y = (1 - pk) * 0.9
      body.material.opacity = alpha
      pulse.position.copy(plug.position)
      pulseMat.opacity = alpha * (0.6 + 0.4 * Math.sin(t * 22))
      for (let i = 0; i < tail.length; i++) {
        tail[i].position.copy(toSock ? plugged : curve.getPointAt(Math.max(0, pk - (i + 1) * 0.05)))
        tail[i].material.opacity = alpha * (0.45 - i * 0.12)
      }
      sparks.material.opacity = spark * 0.95
      const arr = sGeo.attributes.position.array
      for (let i = 0; i < SN; i++) {
        const a2 = hash01(i, 611) * Math.PI * 2
        const el = (hash01(i, 612) - 0.5) * 2
        const r = spark * (0.08 + hash01(i, 613) * 0.42)
        arr[i * 3] = socketAt.x + Math.cos(a2) * Math.cos(el) * r
        arr[i * 3 + 1] = socketAt.y + Math.sin(el) * r
        arr[i * 3 + 2] = socketAt.z + Math.sin(a2) * Math.cos(el) * r * 0.7
      }
      sGeo.attributes.position.needsUpdate = true
    },
  }
}

/** §1.1：画面中央的巨大电源符号（圆环缺口 + 竖线），直径 0.34H ≥ 0.30H */
function drawPowerSymbol(g, ctx, t, a) {
  if (a <= 0.01) return
  const { W, H } = ctx
  const R = H * 0.17
  const cx = W / 2
  const cy = H * 0.44
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.cyan, 0.95)
  g.shadowColor = rgba(C.cyan, 0.9)
  g.shadowBlur = 26
  g.lineWidth = Math.max(4, H * 0.006)
  g.lineCap = 'round'
  g.beginPath()
  g.arc(cx, cy, R, -Math.PI / 2 + 0.42, -Math.PI / 2 - 0.42 + Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.moveTo(cx, cy - R * 1.06)
  g.lineTo(cx, cy - R * 0.34)
  g.stroke()
  g.restore()
}

/** §1.1：`protection` = 盾牌 + 锁描边 */
function drawProtection(g, ctx, t, a) {
  if (a <= 0.01) return
  const { W, H } = ctx
  const cx = W * 0.5
  const cy = H * 0.44
  const R = H * 0.14
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.cyan, 0.9)
  g.shadowColor = rgba(C.cyan, 0.8)
  g.shadowBlur = 22
  g.lineWidth = Math.max(3, H * 0.005)
  g.beginPath()
  g.moveTo(cx, cy - R * 1.15)
  g.lineTo(cx + R * 0.92, cy - R * 0.55)
  g.lineTo(cx + R * 0.78, cy + R * 0.55)
  g.lineTo(cx, cy + R * 1.15)
  g.lineTo(cx - R * 0.78, cy + R * 0.55)
  g.lineTo(cx - R * 0.92, cy - R * 0.55)
  g.closePath()
  g.stroke()
  g.strokeRect(cx - R * 0.3, cy - R * 0.02, R * 0.6, R * 0.48)
  g.beginPath()
  g.arc(cx, cy - R * 0.02, R * 0.21, Math.PI, 0)
  g.stroke()
  g.restore()
}
