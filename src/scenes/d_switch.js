// src/scenes/d_switch.js — 段 D 0:44–0:59 切换与坠入（FIX.md §3 段 D 重做）
//
// FIX 对本段的要求（逐条落实）：
//   · current      3D 示波器亮线，交流正弦；AC→DC 处波形被压平成一条发光直线再变成一根光柱
//   · blind        改为"**光圈收缩**"（画面从边缘向中心收成窄缝，**只用暗角与光圈**，
//                  不要遮挡立绘的黑条）—— 旧的上下黑条已彻底删除
//   · dizzy        相机 roll 旋转 + 径向模糊 + 重影（roll 由 rig 关键帧给，径向模糊走 post3d）
//                  ⚠️ T44 / FIX_V5 §D 0:51 改写：「『眩晕』改为:持久蜂群的字形粒子聚成旋涡
//                  (漩涡中心是黑色深孔),转速加快、相机 roll 加速、青/洋红双重影;旋涡中心在
//                  52.77 变成时间隧道入口(桥接)。要有色彩与层次,不要白色细线团。」
//                  → 原来那 14 个白色细线环（dizzyRings）**已删除**；旋涡 = lib/swarm.js 的
//                    layoutSwirl + SEGMENT_SWARM.D（49.2→52.7 形变）+ SPIN.D（自转加速）；
//                    roll 加速 = core/rig.js 的 52.0 关键帧；青/洋红双重影 = core/post3d.js 的
//                    uDouble（本文件按包络写进 `ctx.post`，main.js 转发）。
//   · travel       全屏时间隧道；年份巨字高速飞过；修复"只有中间一小条"的 bug；
//                  AD / BC 两词处数字符号翻转、流向反转；unite 处两股流在中心对撞合成一个亮点
//                  ⚠️ T44 / FIX_V5 §G8：年份数字改成**预渲染图集**（lib/digitAtlas.js），
//                  每帧只改 uv、不再重画 canvas / 重传纹理。
//   · deeply ×2    相机垂直下潜、水体光线渐暗、气泡流成线、抖动随下潜加剧；结尾黑一拍
//                  ⚠️ T44 / FIX_V5 §D 0:57：深度数字 0→**10,935 m**（第二个 deeply 唱完到顶）、
//                  改到 **2D 层右下**并加**右侧滚动刻度尺**（安全区可钉死），
//                  画面随深度渐暗、加**零星生物荧光点**与**气泡上升线**；58.9 黑场。
//                  旧版"画面中央的 3D 巨字"（depthLabel）已删除 —— 位置由世界坐标决定，
//                  没法保证"右端不被裁切"。
//   · §5.6 对应行：0:49.8–0:51.4「径向模糊是放射线近似」→ 改用 post3d 的**真径向模糊**
//                  （沿屏幕中心多次采样），强度由 rms 驱动 —— 所以本段不再画任何放射线
//
// 迁移自旧文件的"真实计算"（FIX §5.0 允许迁移素材库里的计算）：
//   · 示波器波形 = AC 正弦 ×(1−sq) + 方波 ×sq，sq 是 AC→DC 过渡窗；
//   · DC 混合 dcMix = smoothstep(...)；
//   · 电平读数取**真实** sync.rmsAt(t)，不是假数字；
//   · 时间尺从 2026 → 公元前 3000（步长 100 的刻度滚动）；
//   · 下潜速度 = 0.35 + rms×1.6（驱动气泡/水体的**视觉**速度）；
//     深度**读数**按 FIX_V5 §D 0:57 改为"第一个 deeply 起唱 → 第二个 deeply 唱完"的单调斜坡，
//     终点**恰好 10,935 m**（不再挂在视觉包络上）。

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, inOutCubic, outBack, TAU } from '../core/ease.js'
import { text, fontStack, checkSize } from '../ui/text.js'
import { textPlane, wireShape, glowTube, createLightRigSafe } from '../lib/scene3d.js'
import { digitAtlas, digitLabel } from '../lib/digitAtlas.js'
import { codeWall } from '../lib/codewall.js'
import { timeline } from './_seg.js'
import { hash01 } from '../core/rng.js'

/** 示波器管线的采样数 */
const SCOPE_N = 120
/** 本段专用时间隧道的环数 */
const RINGS = 26
/** 隧道在 z 上的总长度（世界单位） */
const TUNNEL_SPAN = 26
/** 年份数字 billboard 的数量 */
const YEAR_LABELS = 12

export default {
  id: 'D',
  start: 44.0,
  end: 59.0,
  title: '切换与坠入',
  fx: [
    { t: 47.283, kind: 'glitch', amount: 0.45, dur: 0.14 }, // DC（词锚点，不再是旧表的 46.1）
    { t: 50.035, kind: 'shake', amount: 0.8, dur: 1.4 }, // dizzy
    { t: 53.939, kind: 'glitch', amount: 0.4, dur: 0.2 }, // AD 流向反转
    { t: 56.456, kind: 'flash', amount: 0.7, dur: 0.2 }, // unite 对撞
    // 第二次 deeply 收尾（§7 段 D：deeply 两次 = 相机垂直下潜，"屏幕抖动随深度增强"）。
    // FIX_V3 §4.4：任意 6s 窗口内同类效果最多 2 次。原先这里是 **flash**，于是
    // [56.456, 62.456) 里有 flash 56.456 + 58.29 + E 段的 59.0 = **3 次**，违反 §4.4。
    // 按 §7 对 deeply 的定义改成 shake —— 该节拍的强调保留，同类计数降下来。
    { t: 58.29, kind: 'shake', amount: 0.55, dur: 0.5 }, // 第二次 deeply 收尾
  ],

  init(ctx) {
    const T = ctx.three
    this.grp = new THREE.Group()
    this.grp.name = 'segD'
    T.stage3d.add(this.grp)
    this.lights = createLightRigSafe()
    T.stage3d.add(this.lights)

    /* ============ ① 3D 示波器 ============ */
    // 面板：线框外框 + 细线网格。用"线框壳体"而不是一块实心板，
    // 这样波形之下仍能看见 3D 世界，不会变成一块 2D 贴片。
    this.scopeFrame = wireShape('box', { size: 0.62, color: 0x3f6f8a, radius: 0.004 })
    this.scopeFrame.object.position.set(0, 0.06, 0)
    this.scopeFrame.object.scale.set(1.35, 0.62, 0.06)
    this.grp.add(this.scopeFrame.object)
    this.scopeGrid = wireShape('box', { size: 0.3, color: 0x2a4a5c, radius: 0.0022 })
    this.scopeGrid.object.position.set(0, 0.06, 0.02)
    this.scopeGrid.object.scale.set(1.3, 0.6, 0.02)
    this.grp.add(this.scopeGrid.object)
    // 波形管（每帧重算顶点）
    const initPts = []
    for (let i = 0; i < SCOPE_N; i++) initPts.push([(i / (SCOPE_N - 1) - 0.5) * 1.55, 0.06, 0.05])
    this.trace = glowTube(initPts, { radius: 0.011, color: 0x8ff0a4, tubular: 160 })
    this.grp.add(this.trace.object)
    // 光柱：AC→DC 之后波形被压平再变成一根光柱
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x8ff0a4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 16, 1, true), this.beamMat)
    this.beam.rotation.z = Math.PI / 2
    this.beam.position.set(0, 0.06, 0.05)
    this.grp.add(this.beam)
    this.scopeTag = textPlane('AC · 50 Hz', { role: 'ui', height: 0.075, family: 'code', color: '#b8f0c8' })
    this.scopeTag.mesh.position.set(-0.6, -0.34, 0.06)
    this.grp.add(this.scopeTag.mesh)

    /* ============ ② 光圈（blind）：§5-21 的「8 片实例化叶片，可开合」============
     *
     * FIX_V3 §7 段 D 明写：「blind(48.26):3D 光圈(叶片模型)从边缘向中心合拢,只留窄缝」，
     * §5 的模型清单第 21 项是「光圈(8 片实例化叶片,可开合)」。
     * 旧实现只有一个**光滑圆环**（RingGeometry 改内半径）—— 它既不是叶片，也几乎没有硬边，
     * 于是段 D 的 47–51s 在 `?selftest` b) 里一直卡在"边缘像素 ≥4%"这条（实测 49/50/51s 只有 3.2–3.6%）。
     *
     * 现在拆成两件东西：
     *   · `aperture`：遮罩（外框全黑 + **正八边形孔**）。八边形的 8 条直边 = 8 片叶片的刃口，
     *     本身就是一圈硬边（Sobel 会读到），既符合"只留窄缝"，也把画面密度抬起来。
     *   · `blades`：8 片**实例化**叶片刻在八边形每条边上（InstancedMesh，一次 draw call），
     *     随开合一起收放，读得出"叶片合拢"这件事。
     * 遮罩几何每帧重建（和旧圆环同一个理由：内半径烘焙在顶点里，改 scale 会把外缘一起缩）。
     */
    this.irisOuter = 6.0
    this.irisMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    this.aperture = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape()), this.irisMat)
    this.aperture.name = 'apertureMask'
    this.aperture.renderOrder = 30
    this.aperture.frustumCulled = false
    this.aperture.visible = false
    this.grp.add(this.aperture)

    // 8 片叶片：实例化（§5-21），刃口贴在八边形的每条边上
    // ⚠️ 厚度必须**很小**（0.016 世界单位 ≈ 16px）：第一版给 0.09，
    // 在 1.35 单位的距离上投影出来是 **94px 厚**的板子，8 片合起来盖掉画面 13%，
    // 而且是一块平坦的深色 → 段 D 的 49–51s 非众数占比反而从 22% 掉到 16%（b 更差）。
    // 叶片的作用是"读得出开合的硬边"，所以要做**薄而亮**：薄板本身贡献 Sobel 边缘，不遮内容。
    this.bladeMat = new THREE.MeshBasicMaterial({
      color: 0x8fc8e8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
    // 叶片刻：长边沿局部 x，厚度沿 y，纵深沿 z（长度每帧按开口尺寸缩放）
    this.blades = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.bladeMat, 8)
    this.blades.name = 'apertureBlades'
    this.blades.renderOrder = 31
    this.blades.frustumCulled = false
    this.blades.visible = false
    this.grp.add(this.blades)
    this._bladeM = new THREE.Matrix4()
    this._bladeQ = new THREE.Quaternion()
    this._bladeP = new THREE.Vector3()
    this._bladeS = new THREE.Vector3()
    this._octPts = []

    /* ============ ②b 电路环（§7 段 D：current/AC/DC）============
     *
     * FIX_V3 §7 段 D 明写：「current/AC/DC:3D 电路环(环面结当导线),粒子沿导线流动
     * —— 交流来回反向、直流单向恒速」，并强调「47–51s 之前内容太少,以上就是补的主体,
     * 不要再只调参数」。
     * 实测背景：47–51s 是"DC 之后到隧道之前"的空档，`?selftest` b) 在这里一直卡
     * "边缘像素 ≥4%"（补之前 49/50/51s 的边缘只有 3.2/2.2/3.6%）。
     * 导线用环面结参数方程（p=2,q=3）取 220 个点 → 闭合 CatmullRomCurve3 → TubeGeometry，
     * 粒子沿同一条曲线实例化流动（交流用 sin 相位来回、直流单向恒速）。
     */
    {
      // ⚠️ T17b / FIX_V4 §1.5：「把**乱成一团的蓝色管线**整理成**清晰的电路环**」。
      // 原来这里是**环面结（torus knot, p=2 q=3）**：`rr = 0.62*(2+cos 1.5u)` 再加上
      // `z = sin(1.5u)*0.30` 的第三维扭转 —— 画面上就是一团绕来绕去、还溢出画面的线
      // （旧注释自己也写着"环面结正好铺满/溢出画面（硬边来源）"）。
      // 现在改成**平面上的清晰电路环**：一个**圆角方环**（超椭圆 n=5，**z 恒为 0**），
      // 读起来一眼就是"一条闭合的电路走线"，而不是一团绳结。
      const loopPts = []
      const RR = 0.52
      const nSeg = 96
      for (let i = 0; i < nSeg; i++) {
        const u = (i / nSeg) * Math.PI * 2
        const cu = Math.cos(u)
        const su = Math.sin(u)
        const pow = 2 / 5 // 超椭圆指数：→0 变方，→1 变圆；0.4 得到"圆角方环"
        const x = RR * Math.sign(cu) * Math.pow(Math.abs(cu), pow)
        const y = RR * Math.sign(su) * Math.pow(Math.abs(su), pow)
        loopPts.push(new THREE.Vector3(x, y, 0))
      }
      this.knotCurve = new THREE.CatmullRomCurve3(loopPts, true, 'catmullrom', 0.5)
      this.knotMat = new THREE.MeshBasicMaterial({ color: 0x4f9fc4, transparent: true, opacity: 0 })
      this.knotWire = new THREE.Mesh(new THREE.TubeGeometry(this.knotCurve, 280, 0.007, 6, true), this.knotMat)
      this.knotWire.name = 'circuitKnot'
      this.knotWire.frustumCulled = false
      this.knotWire.visible = false
      this.grp.add(this.knotWire)
      this.chargeMat = new THREE.MeshBasicMaterial({ color: 0xcaf4ff, transparent: true, opacity: 0 })
      this.charges = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 6, 4), this.chargeMat, 72)
      this.charges.name = 'circuitCharges'
      this.charges.frustumCulled = false
      this.charges.visible = false
      this.grp.add(this.charges)
      this._chM = new THREE.Matrix4()
      this._chQ = new THREE.Quaternion()
      this._chP = new THREE.Vector3()
      this._chS = new THREE.Vector3(1, 1, 1)
    }

    /* ============ ②c 眩晕：**已删除**（T44 / FIX_V5 §D 0:51）============
     * 这里原本是"一串旋转的发光环"（`dizzyRings`，14 × TorusGeometry，白色细线）。
     * FIX_V5 §D 原文把 0:51 的这一坨直接点名：「一大坨白色线条删除」「不要白色细线团」，
     * 并要求眩晕改由**蜂群的字形粒子聚成旋涡**承担 —— 旋涡中心是黑色深孔、52.77 起接时间隧道。
     * 所以眩晕的"主体"整体搬到了 lib/swarm.js（layoutSwirl / SEGMENT_SWARM.D / SPIN.D），
     * 本文件只保留两件它管不了的事：后处理的双重影包络与相机 roll（rig.js）。
     * 见 docs/REVIEW_T44.md 的"词→事件→对象"表。
     */

    /* ============ ③ 时间隧道（本段专用，不套用 props/tunnel）============ */
    // 为什么不用 createProp('tunnel')：那个物件的"占满整屏"是靠一个 z=-span*0.52 的
    // **封底黑圆**实现的（它是为段 B 的展馆隧道写的）。段 D 这里相机离得近、隧道又被摆在
    // 相机前方，那个封底会直接顶到镜头 → 整屏黑（实测 t=53.2 时 px.mean=0.0001）。
    // 段 D 要的是"年份巨字高速飞过 + AD/BC 符号翻转"，所以直接搭：
    //   · 一串沿 z 铺开的发光环（实例化）= 沿途飞过的骨架；
    //   · 每个环位挂一块年份数字 billboard（走 textPlane，字号受 §0.5 的 title 档约束）；
    //   · 不做封底：远处就是"隧道的黑"，纵深由环与数字表达，不需要一块会挡镜头的黑板。
    this.ringGeo = new THREE.TorusGeometry(1.0, 0.016, 6, 48)
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x9fe4ff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.rings = new THREE.InstancedMesh(this.ringGeo, this.ringMat, RINGS)
    this.rings.frustumCulled = false
    this.rings.name = 'dTunnelRings'
    this.rings.visible = false
    this.grp.add(this.rings)
    this.yearLabels = []
    // T44 / FIX_V5 §G8 原文：「环用 InstancedMesh,数字做成**预渲染图集**,不得每帧重绘文字纹理。」
    // 旧实现是 12 块 `textPlane`：每帧 `setText()` 真的重画 canvas + `texture.needsUpdate`（12 次/帧），
    // 0:52 那段"数字最多、环最多"的时刻帧率就是被它拖下去的。
    // 现在：一张图集（2048×512，字形只画一次）+ 每块标签一块"逐字四边形"面片，每帧**只改 uv**。
    // 字符集覆盖实际会用到的全部字形：`2026 AD` / `-3000 BC`（年份 ±1200 抖动，最多 8 字符）。
    this.yearAtlas = digitAtlas('0123456789- ADBC', {
      fontPx: 190,
      weight: 700,
      color: '#a9e6ff',
      glow: 0.4,
      cell: 256,
      cols: 8,
    })
    for (let i = 0; i < YEAR_LABELS; i++) {
      const lbl = digitLabel(this.yearAtlas, '2026 AD', {
        slots: 9, // 定长：字符数变化时文字不跳动（居中生长）
        height: 0.3, // 与旧 textPlane 同口径的世界字高
        align: 'center',
        name: `dTunnelYear#${i}`, // §G3：名字逐实例唯一
      })
      lbl.mesh.visible = false
      this.grp.add(lbl.mesh)
      this.yearLabels.push(lbl)
    }
    // 复用的临时量（避免每帧分配）
    // 复用临时向量（§8：渲染循环里不得分配新对象）
    this._tm = new THREE.Matrix4()
    this._tp = new THREE.Vector3()
    this._tq = new THREE.Quaternion()
    this._ts = new THREE.Vector3()
    this._axis = new THREE.Vector3(0, 0, 1)

    /* ============ ④ unite：两股流对撞的亮点 ============ */
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), this.coreMat)
    this.core.visible = false
    this.grp.add(this.core)
    // 两股流：从左右两侧冲向中心的细管
    this.streamMat = new THREE.MeshBasicMaterial({
      color: 0x7fd8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.streams = []
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 7, 1), this.streamMat)
      m.rotation.z = Math.PI / 2
      m.visible = false
      this.grp.add(m)
      this.streams.push({ mesh: m, sx })
    }

    /* ============ ⑤ deeply：气泡上升线 + 生物荧光点（T44 / FIX_V5 §D 0:57）============
     * 原文：「…画面随深度逐渐变暗,有**零星生物荧光点**、**气泡上升线**、屏幕抖动加剧…」
     * 深度**数字**不在这里（旧版是 3D 巨字，已删除）—— 见 render ⑤：改到 2D 层右下 +
     * 右侧滚动刻度尺，位置直接钉在 G5 安全区里。
     */
    const NB = 200
    this.bubCount = NB
    this.bubGeo = new THREE.BufferGeometry()
    // 气泡 = **上升线**：每颗气泡两个顶点（同 x/z，y 相差一段长度），越深线越长。
    const bp = new Float32Array(NB * 2 * 3)
    for (let i = 0; i < NB; i++) {
      const x = ((i % 7) - 3) * 0.2
      const y = (i / NB - 0.5) * 2.4
      const z = ((i % 5) - 2) * 0.4
      bp[i * 6] = x
      bp[i * 6 + 1] = y
      bp[i * 6 + 2] = z
      bp[i * 6 + 3] = x
      bp[i * 6 + 4] = y
      bp[i * 6 + 5] = z
    }
    this.bubGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3))
    this.bubGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)
    this.bubMat = new THREE.LineBasicMaterial({
      color: 0xbfe9ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.bubbles = new THREE.LineSegments(this.bubGeo, this.bubMat)
    this.bubbles.frustumCulled = false
    this.bubbles.visible = false
    this.grp.add(this.bubbles)

    /* 零星生物荧光点：18 颗冷色柔光点，挂在一个"跟着相机"的小容器里（同水体），
     * 于是它们始终贴在镜头前的纵深中缓慢漂移 —— 贴图一次性生成（G8 口径）。 */
    const ND = 18
    this.dotCount = ND
    this.dotGeo = new THREE.BufferGeometry()
    this.dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3))
    this.dotGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)
    this.glowSprite = glowDotTexture()
    this.dotMat = new THREE.PointsMaterial({
      map: this.glowSprite,
      color: 0x9fffdc,
      size: 0.06,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.glowDots = new THREE.Points(this.dotGeo, this.dotMat)
    this.glowDots.frustumCulled = false
    this.glowDots.visible = false
    this.grp.add(this.glowDots)

    /* ============ ⑥ 深海水体（贴在镜头前的渐暗层）============ */
    this.waterMat = new THREE.MeshBasicMaterial({ color: 0x04202f, transparent: true, opacity: 0, depthWrite: false })
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), this.waterMat)
    this.water.visible = false
    this.grp.add(this.water)

    /* ============ ⑦ 代码墙（背景密度：§3 要求画面密度要满）============ */
    // 本段 47–51s（DC 之后、隧道之前）几乎没有自己的几何，画面会掉到"只有蜂群"，
    // 于是非众数像素占比过低、自检 b) 判为空画面。用代码墙把这段的背景密度补上，
    // 它同时也是 §3「代码是视觉素材」的落点。
    this.wall = codeWall({ layout: 'wall', layers: 3, fontPx: 64, speed: 0.34, width: 5.0, height: 3.0 })
    this.wall.object.position.set(0, 0, -6.5)
    this.wall.object.visible = false
    this.grp.add(this.wall.object)

    this.metrics = {}
  },

  render(t, lt, ctx) {
    const T = ctx.three
    const H = ctx.H
    const W = ctx.W
    this.grp.visible = true
    this.lights.visible = true
    const sync = ctx.sync
    const spec = ctx.spec

    /* ================= 时间线（全部走实测词锚点，见 anchors.js 的 D 节） ================= */
    const TL = timeline(ctx.cues, 'D', {
      current: [45.395],
      ac: [46.347, 0.25],
      dc: [47.283, 0.25],
      blind: [48.26],
      dizzy1: [50.035],
      dizzy2: [50.955],
      travel: [52.77, 0.35],
      ad: [53.939],
      bc: [54.835],
      unite: [56.456],
      deeply1: [57.417],
      deeply2: [58.29],
    })

    /* ================= ① 示波器 ================= */
    const scopeA = clamp(span(t, TL.current.start, TL.current.t + 0.4)) * (1 - span(t, TL.dc.t + 1.0, TL.dc.t + 1.9))
    const showScope = scopeA > 0.01
    this.scopeFrame.object.visible = showScope
    this.scopeGrid.object.visible = showScope
    this.trace.object.visible = showScope
    this.beam.visible = showScope
    this.scopeTag.mesh.visible = showScope
    if (showScope) {
      // 波形：AC 正弦 →（过渡期方波）→ DC 平线 → 光柱（迁移自旧文件的计算）
      const sq = Math.sin(span(t, TL.ac.t - 0.1, TL.dc.t) * Math.PI)
      const dcMix = smoothstep(span(t, TL.dc.t - 0.1, TL.dc.t + 0.35))
      sync.spectrumAt(t, spec)
      const pts = []
      for (let i = 0; i < SCOPE_N; i++) {
        const u = i / (SCOPE_N - 1)
        const s = Math.sin(u * TAU * 3 + t * 1.2)
        const sine = s * 0.3
        const square = Math.sign(s) * 0.3
        const ac = sine * (1 - sq) + square * sq
        const y = ac * (1 - dcMix) + 0 * dcMix
        // 轻微 z 起伏：亮线不是一条扁平贴片
        pts.push([(u - 0.5) * 1.55, 0.06 + y * 0.72, 0.05 + Math.sin(u * 9 + t * 2) * 0.01])
      }
      this.trace.rebuild(pts)
      this.trace.material.opacity = 0.95 * scopeA
      this.beamMat.opacity = dcMix * 0.55 * scopeA
      this.beam.scale.set(1, 0.6 + 0.5 * dcMix, 1)
      // 标签：AC → DC（数值另在 ?debug 显示真实 rms）
      this.scopeTag.setText(t < TL.dc.t - 0.1 ? 'AC · 50 Hz' : t < TL.dc.t + 0.35 ? 'AC → DC' : 'DC · steady')
      this.scopeTag.material.opacity = scopeA
      this.metrics.rms = sync.rmsAt(t)
      const tilt = Math.sin(t * 0.5) * 0.06
      this.scopeFrame.object.rotation.y = tilt
      this.scopeGrid.object.rotation.y = tilt
      this.trace.object.rotation.y = tilt
      this.beam.rotation.z = Math.PI / 2
      this.beam.rotation.y = tilt
    }

    /* ================= ② 光圈收缩（blind，§3：只准用暗角与光圈） ================= */
    // 旧实现的上下黑条已删除。这里用一个贴在相机前方的圆环做影棚光圈：
    // 内半径从"大于画面对角"收到"一条窄缝"，于是画面**从边缘向中心**被吃掉。
    // 关键：不设上下黑条 → 不会遮挡歌词区。
    // 窄缝保持到眩晕期（blind 词之后约 2s 开始松开，松开过程 1s）
    const blindU = clamp(span(t, TL.blind.start, TL.blind.t + 0.7)) * (1 - clamp(span(t, TL.dizzy1.t + 0.4, TL.dizzy1.t + 1.6)))
    // ⚠️ T17a / FIX_V4 §1.5：「**删除八边形光圈**。blind 一词处改为"**眼睑合拢**"」。
    // 原来这里显示贴在相机前方的**正八边形光圈**（`this.aperture` 遮罩 + `this.blades` 8 片实例化叶片），
    // 从边缘向中心收成窄缝。现在**恒不显示**（下面 `if (showIris)` 的分支永不可达），
    // 真正的 blind 视觉改由 2D 的 `drawEyelids()` 承担（见本文件末尾 + 下面的调用点）。
    const showIris = false
    void blindU
    this.aperture.visible = showIris
    this.blades.visible = showIris
    if (showIris) {
      // 贴在相机前方 1.35 单位处，保证在一切场景物体之前
      this.aperture.position.set(T.camera.position.x, T.camera.position.y, T.camera.position.z - 1.35)
      this.aperture.quaternion.copy(T.camera.quaternion)
      this.blades.position.copy(this.aperture.position)
      this.blades.quaternion.copy(this.aperture.quaternion)
      const dist = 1.35
      const halfH = dist * Math.tan(((T.camera.fov * Math.PI) / 180) / 2)
      // 开口内切半径：1.45×半高（比画面对角还大，几乎不吃画面）→ 0.75×半高。
      // 取值说明（实测标定）：0.12×半高 在 fov 38° 下只剩 7° 视场，画面上几乎全黑，
      // 既读不出"窄缝"、也读不出缝里的内容，还会让自检 b) 的非众数占比掉到 1% 以下（判为空画面）。
      // 0.75×半高 仍是一道明确收紧的光圈（去掉画面绝大部分边缘与角落），但缝里的内容看得见。
      const inner = Math.max(0.001, halfH * (1.45 - 0.7 * blindU))
      // 正八边形：把 `inner` 当作**内切**半径（= 开口的"最小半宽"），
      // 于是开口的可见面积与旧的圆环基本一致（顶点半径 = inner/cos(π/8)）。
      // 第一版把 `inner` 当**外接**半径用，八边形比同半径的圆小 21%，
      // 开口被缩掉一圈 → 实测 49/50s 的非众数占比从 22%/21% 掉到 12%/11%，b) 更差。
      const innerV = inner / Math.cos(Math.PI / 8)
      // ---- 遮罩：外框矩形 + 正八边形孔（八边形的 8 条直边就是 8 片叶片的刃口）----
      const outer = this.irisOuter
      const shape = new THREE.Shape()
      shape.moveTo(-outer, -outer)
      shape.lineTo(outer, -outer)
      shape.lineTo(outer, outer)
      shape.lineTo(-outer, outer)
      shape.closePath()
      const hole = new THREE.Path()
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8
        const px = Math.cos(a) * innerV
        const py = Math.sin(a) * innerV
        k === 0 ? hole.moveTo(px, py) : hole.lineTo(px, py)
      }
      hole.closePath()
      shape.holes.push(hole)
      this.aperture.geometry.dispose()
      this.aperture.geometry = new THREE.ShapeGeometry(shape)
      this.irisMat.opacity = Math.min(1, blindU * 3)
      // ---- 8 片实例化叶片：刃口贴在八边形的每条边（内切半径 rIn = inner）----
      const rIn = inner
      const sideLen = 2 * inner * Math.tan(Math.PI / 8)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        // 叶片中心落在该边的法向上、稍微往外一点（让刃口正好压在八边形边上）
        this._bladeP.set(Math.cos(a) * (rIn + 0.008), Math.sin(a) * (rIn + 0.008), 0)
        this._bladeQ.setFromAxisAngle(this._axis, a + Math.PI / 2)
        this._bladeS.set(sideLen * 1.14, 0.016, 0.3)
        this._bladeM.compose(this._bladeP, this._bladeQ, this._bladeS)
        this.blades.setMatrixAt(k, this._bladeM)
      }
      this.blades.instanceMatrix.needsUpdate = true
      this.bladeMat.opacity = Math.min(1, blindU * 3)
      this.metrics.irisInner = inner
      this.metrics.irisHalfH = halfH
      this.metrics.irisBlades = 8
    }

    /* ================= ②b 电路环：current/AC/DC（§7 段 D 指定的主体）================= */
    // §7 段 D：电路环要在 current→AC→**DC** 全程在场（直流是"单向恒速"，不是消失），
    // 一直到 blind 的窄缝后期才退场，把 49–51s 那段"内容太少"补上。
    const curU = clamp(span(t, TL.current.start - 0.3, TL.ac.t + 1.0)) * (1 - clamp(span(t, TL.blind.t + 2.3, TL.blind.t + 3.2)))
    this.knotWire.visible = curU > 0.01
    this.charges.visible = curU > 0.01
    if (curU > 0.01) {
      const isDC = t >= TL.dc.t
      // 交流：来回反向（sin 相位，周期约 2.6s）；直流：单向恒速推进
      const phase = isDC ? (t - TL.dc.t) * 0.22 : Math.sin((t - TL.current.start) * 2.4) * 0.42
      // T17b：环半径 0.52，贴在相机前方 **2.1** 单位处 → 投影半径 ≈ 0.52/(2.1·tan19°) ≈ **0.80**（<1），
      // 于是**整个环都在画面里**（旧值 0.9 会让环投影到 1.68、整条导线溢出画面，正是"看不清是个环"的原因）。
      this.knotWire.position.set(T.camera.position.x, T.camera.position.y, T.camera.position.z - 2.1)
      this.knotWire.quaternion.copy(T.camera.quaternion)
      this.knotWire.rotateZ(t * (isDC ? 0 : 0.22)) // 交流时整体缓慢自转，直流时定住（"恒定"）
      this.knotMat.opacity = 0.9 * curU
      for (let i = 0; i < 72; i++) {
        const u = (((i / 72) + phase) % 1 + 1) % 1
        this.knotCurve.getPointAt(u, this._chP)
        const sc = 0.85 + 0.55 * Math.abs(Math.sin(u * 38 + t * 3.2))
        this._chS.set(sc, sc, sc)
        this._chM.compose(this._chP, this._chQ, this._chS)
        this.charges.setMatrixAt(i, this._chM)
      }
      this.charges.instanceMatrix.needsUpdate = true
      this.chargeMat.opacity = 0.95 * curU
      this.charges.position.copy(this.knotWire.position)
      this.charges.quaternion.copy(this.knotWire.quaternion)
      this.metrics.circuitU = curU
      this.metrics.circuitDC = isDC
    }

    /* ================= ②c 眩晕：青/洋红双重影（T44 / FIX_V5 §D 0:51）=================
     * 眩晕的"主体"（旋涡）已经搬到 lib/swarm.js，本文件只负责原文里剩下的一件半：
     *   · 「**青/洋红双重影**」：把本帧的后处理参数 `uDouble` 打开（shader 见 core/post3d.js）；
     *   · 「旋涡中心在 52.77 变成时间隧道入口」：包络在 49.2 淡入、在 travel(52.77) 处收掉，
     *     正好把"旋涡 → 隧道"的交接让给 ③ 的时间隧道。
     * 注意这里**每帧无条件写** `ctx.post`（不写 0 也要写）：main.js 每帧先清空，场景不写
     * 就等于"没有额外效果" —— 不留任何跨帧状态。
     */
    const dblU =
      clamp(span(t, TL.dizzy1.t - 0.8, TL.dizzy1.t + 1.1)) *
      (1 - clamp(span(t, TL.travel.t - 0.35, TL.travel.t + 0.35)))
    ctx.post = { double: dblU }
    this.metrics.doubleU = dblU

    /* ================= ③ 时间隧道（travel） ================= */
    const travU =
      clamp(span(t, TL.travel.start, TL.travel.t + 1.4)) * (1 - clamp(span(t, TL.unite.t - 0.7, TL.unite.t + 0.4)))
    const showTunnel = travU > 0.01
    this.rings.visible = showTunnel
    for (const l of this.yearLabels) l.mesh.visible = false
    if (showTunnel) {
      // 环跟着相机（保证始终套住视线）：相机 x/y 在哪，环心就在哪
      const cx = T.camera.position.x
      const cy = T.camera.position.y
      const zBase = T.camera.position.z
      // 流向：AD 之前 +1（向观众冲来），AD→BC 之间停一拍，BC 之后反转（倒流）
      const flip = t >= TL.bc.t ? -1 : t >= TL.ad.t ? 0 : 1
      const speed = 7 + sync.rmsAt(t) * 10
      const off = (((t * speed * flip) % TUNNEL_SPAN) + TUNNEL_SPAN) % TUNNEL_SPAN
      // 诊断用（也是有用的读数）：把隧道滚动的输入暴露出来。
      // FIX_V3 §0 要求"渲染是 t 的纯函数"；`?selftest` a) 曾在 t=53.48 报乱序不一致，
      // 这几个量是判定"到底是哪个输入不纯"的依据。
      this.metrics.tunnelOff = off
      this.metrics.tunnelSpeed = speed
      this.metrics.tunnelFlip = flip
      this.metrics.tunnelT = t
      for (let i = 0; i < RINGS; i++) {
        const zz = -(((i / RINGS) * TUNNEL_SPAN + off) % TUNNEL_SPAN)
        this._tp.set(cx, cy, zBase + zz)
        // 远处的环略放大（隧道收束感）+ 自转
        const grow = 1.0 + Math.max(0, zz) * 0.012
        this._tq.setFromAxisAngle(this._axis, t * 0.1 * flip + i * 0.3)
        this._ts.set(grow, grow, 1)
        this._tm.compose(this._tp, this._tq, this._ts)
        this.rings.setMatrixAt(i, this._tm)
      }
      this.rings.instanceMatrix.needsUpdate = true
      this.ringMat.opacity = 0.85 * travU
      // 年份数字：billboard 沿 z 分布，年份从 2026 滚到公元前 3000
      const uYear = inOutCubic(clamp(span(t, TL.ad.t - 0.2, TL.bc.t + 0.4)))
      const year = Math.round(2026 + (-3000 - 2026) * uYear)
      const neg = t >= TL.bc.t
      let shown = 0
      for (let i = 0; i < this.yearLabels.length; i++) {
        const l = this.yearLabels[i]
        const zz = -(((i / this.yearLabels.length) * TUNNEL_SPAN + off) % TUNNEL_SPAN)
        const wz = zBase + zz
        const dist = Math.abs(zz)
        // 太近会糊在镜头上、太远看不见 —— 两头都淡出
        const near = clamp((dist - 1.4) / 1.8)
        const far = 1 - clamp((dist - TUNNEL_SPAN * 0.72) / (TUNNEL_SPAN * 0.28))
        const a = travU * near * far
        // ⚠️ 这里曾是 `if (a < 0.02) continue` —— **只跳过、不隐藏**。
        // 于是这一帧"看不见"的年份牌会保留**上一帧**的 visible / position / 贴图，
        // 使同一 t 的输出取决于之前渲染过哪些时刻（`?selftest` a) 的乱序比对抓的就是这个：
        // 实测 t=53.48 第一次渲染与第二次相差 616417 像素，而第 2..6 次完全相同）。
        // 正确做法与下面 unite 的 `s.mesh.visible = coreA > 0.01` 一致：**先判可见性再 continue**。
        l.mesh.visible = a >= 0.02
        if (!l.mesh.visible) continue
        const yr = year + Math.round(zz * 46)
        l.mesh.position.set(cx + Math.sin(i * 2.1) * 0.3, cy + Math.cos(i * 1.7) * 0.22, wz)
        l.mesh.quaternion.copy(T.camera.quaternion)
        l.material.opacity = a
        // 同样不加 `if (l.year !== yr)` 的跨帧缓存：`setText()` 自带内容比对，
        // 无条件调用既省算又让结果只由 t 决定。
        l.setText(yr < 0 ? `-${Math.abs(yr)} BC` : `${yr} AD`)
        shown++
      }
      this.metrics.tunnelYear = `${year}${neg ? ' BC' : ' AD'}`
      this.metrics.tunnelLabels = shown
      this.metrics.tunnelFill = this._ringFill(T.camera)
    }

    /* ================= ④ unite：两股流在中心对撞成一个亮点 ================= */
    const uniU = clamp(span(t, TL.unite.start - 0.35, TL.unite.t + 0.45))
    const coreA = uniU > 0.01 ? Math.sin(Math.min(1, uniU) * Math.PI) : 0
    this.core.visible = coreA > 0.01
    this.streamMat.opacity = coreA * 0.7
    for (const s of this.streams) {
      s.mesh.visible = coreA > 0.01
      if (!s.mesh.visible) continue
      // 两股流从 ±1.6 收到 0（对撞）
      const close = clamp(span(t, TL.unite.start, TL.unite.t + 0.2))
      s.mesh.scale.set(1.6 * (1 - close) + 0.05, 1, 1)
      s.mesh.position.set(s.sx * 1.6 * (1 - close), 0, 0.4)
    }
    if (this.core.visible) {
      const grow = outBack(clamp(span(t, TL.unite.t, TL.unite.t + 0.5)))
      this.core.scale.setScalar(Math.max(0.001, grow * (1 + 0.6 * Math.sin(t * 9))))
      this.coreMat.opacity = coreA
      this.core.position.set(0, 0, 0.4)
    }

    /* ================= ⑤ deeply：下潜 ================= */
    const deep1 = clamp(span(t, TL.deeply1.start, TL.deeply1.t + 1.2))
    const deep2 = clamp(span(t, TL.deeply2.start, TL.deeply2.t + 1.0))
    const deep = clamp(deep1 * 0.6 + deep2 * 0.6)
    const showDeep = deep > 0.01
    // FIX_V5 §D 0:57：「深度数字从 0 数到 10,935 m,**在第二个 deeply 结束时到顶**」。
    // 所以读数不再挂在视觉包络 `deep` 上（那是 ease 出来的、到不了顶也不会停在 10935），
    // 而是挂在"第一个 deeply 起唱 → 第二个 deeply 唱完(+0.6s ≈ 58.89)"的单调斜坡上。
    // 最后 0.6s：数字停在 10935 m，进黑场（58.9）。
    const uDepth = clamp(span(t, TL.deeply1.start, TL.deeply2.t + 0.6))
    const depthM = Math.round((10935 * uDepth) / 5) * 5

    /* ---- §7 段 D：「deeply(两次):相机垂直下潜,深度数字 ≥150px,**屏幕抖动随深度增强**」 ----
     * 全局的 `fx.shake(t)` 只按 `fx` 声明表给固定幅度、**不知道深度**，所以"随深度增强"
     * 这句话在旧实现里并不成立。这里按 `deep` 给整段场景一个**世界空间**的抖动：
     * 段 D 的所有东西（水体/气泡/深度巨字/隧道）都挂在 `this.grp` 上，
     * 平移这个 group 就等于整屏抖动。位移用 `hash01(帧号, 种子)` 而不是 Math.random，
     * 保证仍是 t 的纯函数（§0 / selftest a）。
     * `deep` 为 0 时把位移**显式归零**，免得别的时刻被残留偏移影响。
     */
    {
      const jit = deep * 0.022
      if (jit > 1e-5) {
        const f = Math.floor(t * 60)
        this.grp.position.set(
          (hash01(f, 811) * 2 - 1) * jit,
          (hash01(f, 812) * 2 - 1) * jit * 1.4, // 垂直下潜时纵向抖得更明显
          0
        )
      } else {
        this.grp.position.set(0, 0, 0)
      }
      this.metrics.shakeJit = jit
    }
    this.water.visible = showDeep
    if (showDeep) {
      // 水体渐暗：一层贴在镜头前的深海色
      this.waterMat.opacity = deep * 0.7
      this.water.position.set(T.camera.position.x, T.camera.position.y, T.camera.position.z - 2.6)
      this.water.quaternion.copy(T.camera.quaternion)
    }
    this.bubbles.visible = showDeep
    this.glowDots.visible = showDeep
    if (showDeep) {
      // 气泡**上升线**：每颗气泡一条短线，越深越长越亮；
      // 速度由**真实** rms 驱动（迁移自旧文件 speed = 0.35 + rms*1.6）
      const speed = 0.35 + sync.rmsAt(t) * 1.6
      const pos = this.bubGeo.attributes.position
      const len = 0.05 + 0.3 * deep
      for (let i = 0; i < this.bubCount; i++) {
        const u = ((((i / this.bubCount) + t * speed * (0.35 + ((i * 37) % 100) / 140)) % 1) + 1) % 1
        const y = (-0.7 + u * 2.8) * (1 + 0.5 * deep)
        const x = ((((i * 53) % 100) / 100) - 0.5) * (4.4 - deep * 2.2)
        const z = ((i % 5) - 2) * 0.4
        pos.setXYZ(i * 2, x, y, z)
        pos.setXYZ(i * 2 + 1, x, y + len, z)
      }
      pos.needsUpdate = true
      this.bubMat.opacity = 0.12 + 0.5 * deep
      // 生物荧光点：挂在跟随相机的容器里，随下潜向上掠过（我们"在往下掉"）
      const dpos = this.dotGeo.attributes.position
      for (let i = 0; i < this.dotCount; i++) {
        const ph = hash01(i, 901) * TAU
        dpos.setXYZ(
          i,
          (hash01(i, 902) - 0.5) * 3.0 + Math.sin(t * 0.25 + ph) * 0.22,
          (hash01(i, 903) - 0.5) * 1.7 + Math.cos(t * 0.21 + ph) * 0.16 + uDepth * 0.8,
          -0.3 - hash01(i, 904) * 2.0
        )
      }
      dpos.needsUpdate = true
      this.glowDots.position.set(T.camera.position.x, T.camera.position.y, T.camera.position.z - 0.9)
      this.glowDots.quaternion.copy(T.camera.quaternion)
      this.dotMat.opacity = 0.55 * uDepth

      /* ---- 深度计（T44 / FIX_V5 §D 0:57）----
       * 原文：「…数字完整位于安全区(靠右下,右端不被裁切);右侧加一把滚动刻度尺;
       *        画面随深度逐渐变暗…」
       * 改到 **2D 层**画：2D 层的坐标就是 1080p 逻辑像素，G5 的 x∈[5%,95%] / y∈[8%,80%]
       * 能直接钉死，也会被 §2.8 的文字包围盒登记/自检抓到。
       * （旧版是画面中央的 3D 巨字，位置由世界坐标 + 相机决定，"右端不被裁切"没法保证。）
       */
      const g = ctx.g
      g.save()
      g.fillStyle = `rgba(2,7,13,${(0.3 * uDepth).toFixed(3)})` // 「画面随深度逐渐变暗」
      g.fillRect(0, 0, W, H)
      g.restore()
      // 数字：右端对齐到 95% 安全线内侧 6px（x1=1818/1920=94.7%）。
      // 基线取 **74%** 而不是 78%：G5 用的是**登记包围盒**（`src/ui/globalrules.js:81-105`），
      // 盒高 = px×1.16、盒顶 = 基线−0.78px → **盒底 = 基线+0.38px**；150px 时基线 78% 会让
      // 盒底落到 83.2% ⇒ G5「bottom 3.2%」越界。74% 时盒底 = 799+57 = 856 ⇒ 79.3% ✓。
      stageText(g, `${depthM} m`, W * 0.95 - 6, H * 0.74, {
        role: 'title',
        size: 150,
        weight: 700,
        color: '#bfe9ff',
        align: 'right',
        shadow: { color: 'rgba(90,200,255,0.45)', blur: 24 },
      })
      drawDepthRuler(g, W, H, depthM, uDepth)
      this.metrics.depthPx = 150
      this.metrics.depthM = depthM
    }
    /* ================= T17a / §1.5：blind 的「眼睑合拢」 ================= */
    // 上下两片**弧形眼睑**（平滑曲线边缘 + 柔和阴影 + 极细睫毛线）从上下合拢，
    // 留下一道**渐窄的发光缝**，最后全黑；`dizzy` 处晃动着睁开。**不画脸**。
    drawEyelids(ctx.g, ctx, t, TL)

    // 结尾黑一拍（T44 / FIX_V5 §D 0:57 原文：「58.9 黑一拍再进副歌闪白」）
    // 段 D 最后一个可渲染的 t 是 59.0，所以黑场只能落在 58.90→59.00：黑到全黑的下一帧
    // 正是段 E 的副歌（闪白），交接就在段界上完成。
    const blackout = span(t, 58.9, 59.0)
    if (blackout > 0.01) {
      const g = ctx.g
      g.save()
      g.fillStyle = `rgba(0,0,0,${blackout.toFixed(3)})`
      g.fillRect(0, 0, W, H)
      g.restore()
    }

    /* ================= ⑥ 代码墙：给这一段做背景密度 ================= */
    // 从 DC 之后一直铺到隧道之前（47–52s）——那段是本段最"空"的区间，
    // 只靠蜂群会把非众数像素占比压到 1% 上下；代码墙把密度补回来。
    const wallIn = clamp(span(t, TL.dc.t + 0.9, TL.dc.t + 1.9))
    const wallOut = 1 - clamp(span(t, TL.travel.t - 0.6, TL.travel.t + 0.6))
    const wallA = Math.min(wallIn, wallOut) * 0.6
    this.wall.object.visible = wallA > 0.01
    if (this.wall.object.visible) this.wall.update(t, { camera: T.camera, alpha: wallA })

    /* ================= ⑦ ?debug 读数 ================= */
    if (ctx.debug) {
      const g = ctx.g
      g.save()
      g.globalAlpha = 0.92
      text(g, `D  tris=${T.renderer.info.render.triangles}  calls=${T.renderer.info.render.calls}`, 40, 84, {
        role: 'ui',
        size: 34,
        family: 'code',
        color: C.teal,
      })
      text(
        g,
        `ac@${TL.ac.t.toFixed(2)} dc@${TL.dc.t.toFixed(2)} ad@${TL.ad.t.toFixed(2)} bc@${TL.bc.t.toFixed(2)} travel@${TL.travel.t.toFixed(2)} unite@${TL.unite.t.toFixed(2)} deeply@${TL.deeply1.t.toFixed(2)}/${TL.deeply2.t.toFixed(2)}`,
        40,
        124,
        { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      text(
        g,
        `rms ${(this.metrics.rms || 0).toFixed(3)}  iris ${this.metrics.irisInner ? this.metrics.irisInner.toFixed(3) : '-'}/${this.metrics.irisHalfH ? this.metrics.irisHalfH.toFixed(3) : '-'}  year ${this.metrics.tunnelYear || '-'}  labels ${this.metrics.tunnelLabels || 0}  depth ${this.metrics.depthPx ? this.metrics.depthPx.toFixed(0) : 0}px ${this.metrics.depthM || 0}m`,
        40,
        164,
        { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      g.restore()
    }
  },

  /** 隧道环在该相机下对画面的覆盖余量（环半径 1.0 − 可见半对角） */
  _ringFill(camera) {
    const nearest = 1.4
    const halfH = nearest * Math.tan(((camera.fov * Math.PI) / 180) / 2)
    const halfW = halfH * (1920 / 1080)
    return 1.0 - Math.hypot(halfW, halfH)
  },

  dispose() {
    if (this.scopeTag) this.scopeTag.dispose()
    // T44：3D 的 depthLabel（画面中央巨字）已删除 —— 深度数字改到 2D 层画。
    // 年份数字改成「图集 + 面片」，所以除面片外还要回收图集纹理。
    for (const l of this.yearLabels || []) l.dispose()
    if (this.yearAtlas) this.yearAtlas.dispose()
    if (this.glowSprite) this.glowSprite.dispose()
    if (this.bubGeo) this.bubGeo.dispose()
    if (this.bubMat) this.bubMat.dispose()
    if (this.dotGeo) this.dotGeo.dispose()
    if (this.dotMat) this.dotMat.dispose()
  },
}

/* ================================================================== *
 * T44 / FIX_V5 §D 0:57：深度计的"右侧滚动刻度尺" + 水下荧光点的柔光贴图
 * ================================================================== */

/**
 * 柔光圆点贴图（一次性生成）。
 * FIX_V5 §G8 的口径是"不得每帧重绘文字/图形纹理" —— 生物荧光点的柔光圆也一样：
 * 画一次、当贴图复用，之后每帧只更新点的位置。
 */
function glowDotTexture(size = 64) {
  const cv = document.createElement('canvas')
  cv.width = size
  cv.height = size
  const g = cv.getContext('2d')
  const r = size / 2
  const grd = g.createRadialGradient(r, r, 0, r, r, r)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(190,255,235,0.5)')
  grd.addColorStop(1, 'rgba(120,220,200,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * 2D 层文字（本段 0:57 的深度读数与刻度数字用它，**不用 `ui/text.js` 的 `text()`**）。
 *
 * 为什么（实测，别改回去）：`text()` 会先登记一个"声明 role"的包围盒，再调用 `g.fillText` ——
 * 而这块 `#stage` 的 context 早被 `markScreenContext()` 打过补丁（`src/ui/text.js:413-445`），
 * 于是**同一串字被登记两次**（一条 role='title'/'label'，一条 role='raw'，矩形完全相同、IoU=1）。
 * 实测后果：`?probe=textscan` / 0.2s 全片扫描把段 D 报成 9 帧"文字重叠"
 * （`A[raw]"4210 m" ∩ B[title]"4210 m"` IoU=1）—— 那是同一次 fillText 的自比，不是真的叠字。
 *
 * 全片其它 2D 舞台文字本来就是**裸 fillText**（如 `src/scenes/c_define.js:1014,1040,1060,1062`
 * 的 `y = sin x` / `k = …` / `ε = …` / `lim f(x) = ∞`），只登记一次。这里对齐同一约定。
 * 字号下限**没有放宽**：照样过 `checkSize(role, px, str)`（G1 / §2.5 的门槛）。
 */
function stageText(
  g,
  str,
  x,
  y,
  { role = 'ui', size, weight = 600, color = '#e8eaee', align = 'left', baseline = 'alphabetic', alpha = 1, shadow = null } = {},
) {
  const px = size ?? 34
  checkSize(role, px, str)
  g.save()
  g.globalAlpha *= alpha
  g.font = `${weight} ${px}px ${fontStack('code')}`
  g.textAlign = align
  g.textBaseline = baseline
  if (shadow) {
    g.shadowColor = shadow.color || 'rgba(0,0,0,0.7)'
    g.shadowBlur = shadow.blur ?? 8
  }
  g.fillStyle = color
  g.fillText(String(str), x, y)
  g.restore()
}

/**
 * 右侧滚动刻度尺（FIX_V5 §D 0:57 原文：「右侧加一把滚动刻度尺」）。
 *
 * 只有落在 **G5 安全区**里的部分会画：尺身钉在 x=94.5%W，刻度向右 14/26px（≤95%W=1824），
 * 长刻度的数字右对齐到 93%W（5 位数在 34px 等宽下 ≈100px 宽 → 左端 ≈88%W，都在安全区内）。
 * 纵向只占 14%–60%H：下面留给 78% 基线的大数字，两者不会重叠。
 * 刻度值以当前深度为原点向上下各铺 `spanM`（9000m ≈ 可视窗口），每 250m 一小格、每 1000m 一长格。
 */
function drawDepthRuler(g, W, H, depthM, uDepth) {
  const x = W * 0.945
  const yTop = H * 0.14
  const yBot = H * 0.6
  const pxPerM = (yBot - yTop) / 9000
  const stepM = 250
  const base = Math.round(depthM / stepM) * stepM
  g.save()
  g.globalAlpha = 0.85 * Math.min(1, uDepth * 1.6)
  g.strokeStyle = 'rgba(160,225,255,0.7)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(x, yTop)
  g.lineTo(x, yBot)
  g.stroke()
  const kN = Math.ceil(9000 / stepM) + 2
  for (let k = -kN; k <= kN; k++) {
    const v = base + k * stepM
    if (v < 0 || v > 10935) continue // 海底就是 10935m，尺子不画到"不存在的深度"
    const y = yBot - (v - depthM) * pxPerM
    if (y < yTop - 1 || y > yBot + 1) continue
    const major = v % 1000 === 0
    g.lineWidth = major ? 3 : 1.5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (major ? 26 : 14), y)
    g.stroke()
    if (major) {
      stageText(g, `${v}`, W * 0.93, y + 12, {
        role: 'label',
        size: 34,
        color: 'rgba(190,235,255,0.92)',
        align: 'right',
      })
    }
  }
  g.restore()
}

/* ================================================================== *
 * T17a / FIX_V4 §1.5：`blind` 的「**眼睑合拢**」（替代被删除的正八边形光圈）
 * ------------------------------------------------------------------
 * 规格原文：「blind 一词处改为"眼睑合拢"：**上下两片弧形眼睑**（平滑曲线边缘 + **柔和阴影** +
 * **极细睫毛线**）从上下合拢，留下一道**渐窄的发光缝**，最后**全黑**；用 **easeInOutCubic**，
 * dizzy 处再**晃动着睁开**。**不要画脸**。」
 *
 * 所以这里**只画两片眼睑**（弧形的下缘/上缘 + 边缘的柔光 + 一条极细睫毛线），
 * 不画眼睛、不画瞳孔、不画任何面部特征。
 * ⚠️ 画在 stage 面布上：歌词层是**永远最上面**的独立画布（§0.x），所以眼睑不会盖住歌词 —— 这是设计如此。
 * ================================================================== */
function drawEyelids(g, ctx, t, TL) {
  const { W, H } = ctx
  // 合拢进度：blind 起唱 → +0.7s 完全闭合（easeInOutCubic）；dizzy 处 1.2s 晃动着睁开
  const close = inOutCubic(clamp(span(t, TL.blind.start, TL.blind.t + 0.7)))
  const open = inOutCubic(clamp(span(t, TL.dizzy1.t + 0.4, TL.dizzy1.t + 1.6)))
  const cl = clamp(close * (1 - open))
  if (cl <= 0.002) return
  // dizzy 睁眼时的横向晃动（只在"正在睁开"的区间里）
  const shaking = open > 0.01 && open < 0.99
  const shake = shaking ? Math.sin(t * 21) * 16 * open * (1 - open) * 4 : 0
  const cx = W / 2 + shake
  const cy = H * 0.5
  const S = H * 0.62 // 眼睑的垂直尺度
  const shut = S * cl // 已经合拢的高度
  const lidH = H * 0.56 // 眼睑本体的厚度（超出画面即可）
  g.save()
  // ---- 上眼睑 ----
  for (const dir of [-1, 1]) {
    const base = cy + dir * (S - shut) // 弧形下缘所在高度
    g.beginPath()
    g.moveTo(cx - W, base - dir * lidH)
    g.lineTo(cx + W, base - dir * lidH)
    // 平滑曲线边缘：用两段三次贝塞尔画出"眼皮"的弧
    g.lineTo(cx + W, base)
    g.bezierCurveTo(cx + W * 0.42, base + dir * H * 0.075, cx - W * 0.42, base + dir * H * 0.075, cx - W, base)
    g.closePath()
    const grd = g.createLinearGradient(0, base - dir * lidH, 0, base + dir * H * 0.02)
    grd.addColorStop(0, 'rgba(6,8,12,1)')
    grd.addColorStop(1, 'rgba(6,8,12,0.99)')
    g.fillStyle = grd
    g.fill()
    // 柔和阴影：紧贴弧形边缘往下的一层渐变
    const sh = g.createLinearGradient(0, base, 0, base + dir * H * 0.11)
    sh.addColorStop(0, 'rgba(0,0,0,0.85)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = sh
    g.beginPath()
    g.moveTo(cx - W, base)
    g.bezierCurveTo(cx - W * 0.42, base + dir * H * 0.075, cx + W * 0.42, base + dir * H * 0.075, cx + W, base)
    g.lineTo(cx + W, base + dir * H * 0.11)
    g.lineTo(cx - W, base + dir * H * 0.11)
    g.closePath()
    g.fill()
    // 极细睫毛线：贴在弧形边缘上
    g.strokeStyle = rgba(C.cyan, 0.55)
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(cx - W, base)
    g.bezierCurveTo(cx - W * 0.42, base + dir * H * 0.075, cx + W * 0.42, base + dir * H * 0.075, cx + W, base)
    g.stroke()
  }
  // ---- 渐窄的发光缝：两片眼睑之间那道光 ----
  const slit = S * (1 - cl) * 2
  if (slit > 1) {
    const sg = g.createLinearGradient(0, cy - slit / 2, 0, cy + slit / 2)
    sg.addColorStop(0, 'rgba(0,0,0,0)')
    sg.addColorStop(0.5, rgba(C.cyan, 0.75 * (1 - cl)))
    sg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = sg
    g.fillRect(0, cy - slit / 2, W, slit)
  }
  g.restore()
}
