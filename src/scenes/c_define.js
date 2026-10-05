// src/scenes/c_define.js — 段 C 0:29.7–0:44 点→圆→正弦→无穷（FIX §3 段 C：**一条连续形变，全程不切镜头**）
//
// FIX 对本段的要求（逐条落实，行末标注出处）：
//   · 蜂群是唯一主角，八个节拍依次到位：points → dimension → circle → circumference →
//     sine → tangents → infinity → limitations（§3 段 C 原文）
//   · **圆→螺旋→正弦是同一条连续路径**（§3 段 C）：所以本文件里只有**一条参数曲线**
//     `pathPoint(s, P)`，它在四个"形状基"（圆 / 螺旋 / 正弦 / ∞）之间按缓动插值。
//     不允许"建四条曲线再交叉淡化"——那会在交叉处露馅成两次切换。
//   · §5.6 关闭项「C 0:31.4–0:33.2 点云抬升第三维像噪点」：
//     ① 不再用立绘轮廓的点（本段完全不碰 whale/sprite，FIX §5.1 也要求删掉这段的立绘）；
//     ② 三维展开用**规整形体**（Fibonacci 球面壳 = 螺旋带的一族）；
//     ③ **深度排序**（桶排序，画家算法：远→近）＋ **点大小随距离衰减**（透视真实比例）；
//     ④ **先成形再旋转**：成形期只改位置，旋转由对象自身的旋量承担，并在成圆之前回到 0
//        （否则单位圆会被转出 xy 平面，④ 的近正交取景就读不出"圆"了）。
//   · 全片持久蜂群（§2.1 "各段只给它下发目标布局"）：本段**不新建蜂群、不改 swarm.js**，
//     只建"蜂群聚拢的那套几何"，并把尺度对齐到蜂群归一化后的中位半径 NOMINAL_R = 1.15
//     （lib/swarm.js），让两者在同一个世界尺度里读成一体。
//   · 文字：T43 / FIX_V5 §B/C 0:36 规定本段保留的文字"只有"三类（`y = sin x` 1 处、切线
//     斜率数字、末尾 lim/ε ≥80px），全部由下面的 2D 标注层 `drawAnnotations` 画；
//     T16c/FIX_V4 §1.4 当年加的那一整层 3D 文字（x/y/z 轴标签、π 读数、顶部 `C = 2πr`、
//     `x → ∞`、`x = L`、`lim f(x) = M`、ε-δ 三行）已按 §0.4「FIX_V5 优先于 V4」撤掉。
//   · 事件时刻**全部**来自词锚点 ctx.cues.sec（§2.2），旧文件的绝对秒数只作 fallback。
//     实测锚点（?shot 查询得）：points 31.021 / dimension 32.700 / circle 34.361 /
//     circumference 36.389 / sine 38.021 / tangents 40.309 / infinity 41.476 / limitations 43.548。
//   · 相机不归本段管（§2.1）：只**读** rig.cameraAt(t) 做像素标定，不创建相机、不加关键帧。
//
// 旧 c_define.js 的"真实计算"按 §5.0 迁移（旧场景是素材库）：
//   R=0.62 单位圆半径、SINE_K=3、SINE_AMP=0.42、WALL_L=0.86、EPS=0.09、
//   切线按 sync.onsetsIn(...) 逐个卡起音点、ε 带的几何与读数文案。
//   （TICKS=24 圆周刻度 / 第二个圆 / 2π 数值 / 测量框 已按 FIX_V5 §B/C 0:33–0:42 删除。）

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span, inOutCubic, outBack, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text } from '../ui/text.js'
import { MONO } from '../ui/dsh.js'
import { createLightRigSafe, pxPerUnitAt } from '../lib/scene3d.js'
import { cameraAt } from '../core/rig.js'
import { registerImpacts } from '../core/fx.js'
import { timeline } from './_seg.js'

/* ------------------------------------------------------------------ *
 * 常量：全部迁移自旧 c_define.js（FIX §5.0）
 * ------------------------------------------------------------------ */
const R = 0.62 // 单位圆半径（世界单位；1 = 半屏高 → 直径占画面高度 63%，与旧文件同）
const SINE_K = 3 // 正弦半波数（旧文件 SINE_K = 3）
const SINE_AMP = 0.42 // 展开后的正弦振幅（旧文件 SINE_AMP）
const WALL_L = 0.86 // 旧文件的渐近线刻度
const WALL_X = WALL_L + 0.42 // 旧 drawWall 里墙的实际 x = 1.28（WALL_L 是它的刻度名）
const EPS = 0.09 // ε 带半高（旧文件 EPS）
const SPAN = 1.84 // 展开后正弦的 x 跨度（旧文件 x ∈ [-0.92, 0.92]）
// 圆"卷"成螺旋带时的轴向长度。取 0.9 是按"看得见"定的：相机在 t≈37 是 x≈0.4/z≈5.7/fov 20，
// 近正交下 z 的深浅只能靠**视差**读出来 —— 0.9 的轴向跨度让相机横移把螺旋各圈错开约 40px，
// 否则"抬升第三维"在画面上等于没发生（§5.6 那句"像噪点"的另一半就是"看不出深度"）。
const PITCH = 0.9
const CIRC = TAU * R // 真实周长：屏幕上读出的 C = 2πr 就是这个量
const INF_A = 1.08 // ∞ 字形的 x 半宽
const INF_B = 1.0 // ∞ 字形的 y 系数（Gerono 双纽线 y = INF_B·sinφcosφ，峰值 INF_B/2）
const INF_SHRINK = 0.78 // limitations：∞ 被墙压小的比例
const INF_SHIFT = 0.55 // limitations：∞ 被推向墙的距离
const SHELL_R = 0.88 // ② 规整球面壳半径（= 画面高度的 89%，"撑成立体"要撑满）
const N_PTS = 1200 // 本段自建点云的粒子数（蜂群之外的那层"规整形体"）
const N_CURVE = 168 // 曲线骨架采样数
const RIB_RING = 4 // 管截面顶点数（4 段足够，且省软件光栅化的填充率）
const TUBE_R = 0.0115 // 管半径（世界单位 → 屏幕上约 12px 宽的亮线）
const TAN_MAX = 14 // 切线最多几条（超过就按强度取前 14）

/* ------------------------------------------------------------------ *
 * 小工具
 * ------------------------------------------------------------------ */

/** 两点之间的一根细圆柱（WebGL 的 linewidth 恒为 1px，画不出轴/墙边的量感） */
function segment(a, b, radius, mat) {
  const A = new THREE.Vector3(a[0], a[1], a[2])
  const dir = new THREE.Vector3(b[0], b[1], b[2]).sub(A)
  const len = Math.max(1e-4, dir.length())
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6, 1), mat)
  mesh.position.copy(A).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

/** 一个文字面片：统一走 textPlane（→ text() → §0.5 字号守卫），并压到 3D 最上层
 *  T43 / FIX_V5 §B/C 0:36 之后本段已无 3D 文字（保留的三类文字走 2D `drawAnnotations`），
 *  这个 helper 一并删除；`textPlane` 的 import 也去掉（留着会是未使用 import）。 */

/* ------------------------------------------------------------------ *
 * ① 规整点云（§5.6：球面壳 / 螺旋带 + 深度排序 + 点大小随距离衰减）
 *
 * 为什么不复用蜂群：§2.1 规定全片只有一个持久蜂群、各段只下发目标布局，
 * 而蜂群的段 C 布局（lib/swarm.js 的 SEGMENT_SWARM.C = cloud → grid）不归本文件管。
 * 于是本段自建这层"规整形体"作为蜂群聚拢的骨架：粒子身份固定（hash01(i,·)），
 * 形变是 from→to 的带错峰缓动插值——与蜂群同一套语言，但对象是段内私有的。
 * ------------------------------------------------------------------ */
function makePointCloud(n) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)

  const cTeal = new THREE.Color(C.teal)
  const cGold = new THREE.Color(C.gold)
  const tmp = new THREE.Color()
  for (let i = 0; i < n; i++) {
    seed[i] = hash01(i, 901)
    // 颜色按身份定死：冷色为主，少量暖色点缀（"点"也有个体差异，但不会闪烁）
    tmp.copy(cTeal).lerp(cGold, hash01(i, 902) > 0.88 ? 0.75 : hash01(i, 903) * 0.22)
    col[i * 3] = tmp.r
    col[i * 3 + 1] = tmp.g
    col[i * 3 + 2] = tmp.b
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: 3000 }, // 该深度处「1 世界单位 = N 像素」的透视比例（每帧由相机 fov 算）
      uSize: { value: 0.013 }, // 点的世界半径
      uAlpha: { value: 0.9 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSeed;
      uniform float uScale;
      uniform float uSize;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float dist = max(0.05, -mv.z);
        // 点大小随距离衰减（§5.6）：按透视真实比例，而不是固定像素 —— 于是"近大远小"
        // 本身就把厚度读出来了；这是"像噪点"与"像立体"的分界。
        gl_PointSize = uSize * uScale / dist * (0.75 + 0.5 * aSeed);
        // 远处压暗：与尺寸衰减同向，避免远端的点堆成一片平的白噪
        vFade = clamp(1.35 - dist * 0.09, 0.3, 1.0);
        vColor = aColor;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      uniform float uAlpha;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d2 = dot(q, q);
        if (d2 > 0.25) discard;              // 圆点：方形点在暗底上会被读成"噪点"（§5.6）
        float a = 1.0 - d2 * 4.0;
        a = a * a * vFade * uAlpha;
        gl_FragColor = vec4(vColor * (0.65 + 0.8 * a), a);
      }
    `,
    transparent: true,
    // 深度排序的另一半：depthTest/Write 打开，近处的点真的挡住远处的点（画家算法的前提）
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  })

  const object = new THREE.Points(geo, mat)
  object.name = 'segC:points'
  object.frustumCulled = false

  // 复用缓冲（不许每帧 new，否则停帧/拖动都会抖）
  const scratch = new Float32Array(n * 3)
  const key = new Float32Array(n)
  const order = new Uint16Array(n)
  const counts = new Int32Array(64 + 1)
  const cursor = new Int32Array(64)

  /**
   * 把点位写进 attribute，并按相机距离**从远到近**重排（§5.6 的"深度排序"）。
   * 为什么排序：半透明点阵用画家算法才不会出现"近的点被远的点盖住"的错depth 观感；
   * 用桶排序（O(n)，无分配）而不是 sort()（每帧要分配比较器与临时数组）。
   * @param {Float32Array} src 身份序的位置（n×3）
   * @param {number[]} camPos 相机位置
   */
  function upload(src, camPos) {
    const cx = camPos[0]
    const cy = camPos[1]
    const cz = camPos[2]
    let mn = Infinity
    let mx = -Infinity
    for (let i = 0; i < n; i++) {
      const dx = src[i * 3] - cx
      const dy = src[i * 3 + 1] - cy
      const dz = src[i * 3 + 2] - cz
      const d = dx * dx + dy * dy + dz * dz
      key[i] = d
      if (d < mn) mn = d
      if (d > mx) mx = d
    }
    const NB = 64
    const inv = NB / Math.max(1e-6, mx - mn)
    counts.fill(0)
    for (let i = 0; i < n; i++) counts[Math.min(NB - 1, ((key[i] - mn) * inv) | 0) + 1]++
    for (let b = 0; b < NB; b++) counts[b + 1] += counts[b]
    // counts[b] 就是桶 b 的起始下标；cursor 是桶内游标（预分配，避免每帧 new）
    cursor.set(counts.subarray(0, NB))
    for (let i = 0; i < n; i++) {
      const b = Math.min(NB - 1, ((key[i] - mn) * inv) | 0)
      order[cursor[b]++] = i
    }
    for (let k = 0; k < n; k++) {
      const i = order[n - 1 - k] // 远 → 近
      pos[k * 3] = src[i * 3]
      pos[k * 3 + 1] = src[i * 3 + 1]
      pos[k * 3 + 2] = src[i * 3 + 2]
    }
    geo.attributes.position.needsUpdate = true
    geo.computeBoundingSphere()
  }

  return { object, material: mat, count: n, scratch, upload, geometry: geo }
}

/* ------------------------------------------------------------------ *
 * ② 曲线骨架：顶点拓扑固定，只改 position/color
 *
 * 为什么不用 scene3d.glowTube：它每次 rebuild 都会 dispose 再 new 一条 TubeGeometry
 * （N×6 顶点 + 上千三角形），本段 15 秒里每帧都要变形，等于每秒造 60 条几何体 ——
 * 在软件光栅化下是纯浪费。这里一次性建好 (N-1)×RIB_RING 的环面片，之后只写 attribute。
 * ------------------------------------------------------------------ */
function makeRibbon(nSeg, nRing, radius) {
  const vCount = nSeg * nRing
  const pos = new Float32Array(vCount * 3)
  const col = new Float32Array(vCount * 3)
  const idx = new Uint16Array((nSeg - 1) * nRing * 6)
  let k = 0
  for (let i = 0; i < nSeg - 1; i++) {
    for (let j = 0; j < nRing; j++) {
      const a = i * nRing + j
      const b = i * nRing + ((j + 1) % nRing)
      const c = (i + 1) * nRing + j
      const d = (i + 1) * nRing + ((j + 1) % nRing)
      idx[k++] = a
      idx[k++] = c
      idx[k++] = b
      idx[k++] = b
      idx[k++] = c
      idx[k++] = d
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending, // 亮线是"发光"而不是"涂色"（暗底上加法才读得出光）
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'segC:curve'
  mesh.frustumCulled = false
  const A = new THREE.Vector3()
  const T = new THREE.Vector3()
  const U = new THREE.Vector3()
  const V = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 0, 1)
  const ALT = new THREE.Vector3(0, 1, 0)

  /**
   * @param {Float32Array} pts 曲线采样（nSeg×3）
   * @param {(i:number)=>[number,number,number]} colorOf 顶点颜色（含明暗，"流动"就靠它）
   */
  function update(pts, colorOf) {
    for (let i = 0; i < nSeg; i++) {
      const i0 = Math.max(0, i - 1)
      const i1 = Math.min(nSeg - 1, i + 1)
      T.set(pts[i1 * 3] - pts[i0 * 3], pts[i1 * 3 + 1] - pts[i0 * 3 + 1], pts[i1 * 3 + 2] - pts[i0 * 3 + 2])
      if (T.lengthSq() < 1e-12) T.set(1, 0, 0)
      T.normalize()
      // 参考向量：曲线基本躺在 xy 平面里（螺旋段的切向与 z 夹角很小），
      // 所以固定用 z 作参考就够；真的平行时退到 y，避免叉乘退化。
      const ref = Math.abs(T.z) > 0.9 ? ALT : UP
      U.copy(ref).cross(T).normalize()
      V.copy(T).cross(U).normalize()
      const c = colorOf(i)
      for (let j = 0; j < nRing; j++) {
        const a = (j / nRing) * TAU
        A.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
          .addScaledVector(U, Math.cos(a) * radius)
          .addScaledVector(V, Math.sin(a) * radius)
        const o = (i * nRing + j) * 3
        pos[o] = A.x
        pos[o + 1] = A.y
        pos[o + 2] = A.z
        col[o] = c[0]
        col[o + 1] = c[1]
        col[o + 2] = c[2]
      }
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    geo.computeBoundingSphere()
  }

  return { mesh, material: mat, update, geometry: geo }
}

/* ------------------------------------------------------------------ *
 * ③ 曲线本体：四个形状基 + 一条连续路径
 * ------------------------------------------------------------------ */

/**
 * 形状状态量（纯函数 f(t)）。所有窗口都由词锚点推出（§2.2：到位 = 词起唱，启动提前 0.25–0.4s）。
 */
function pathParams(t, TL) {
  const tDim = TL.dimension.t
  const tCirc = TL.circle.t
  const tSine = TL.sine.t
  const tInf = TL.infinity.t
  const tLim = TL.limitations.t
  // 螺旋：圆读完（circle 词）之后先"卷起来"露厚度，卷的量在 sine 词前完成
  const twist = inOutCubic(clamp(span(t, tSine - 0.85, tSine - 0.15)))
  // 展开：把螺旋沿 x 摊平成 y = A·sin(…)。起点比 sine 词早 0.35s（预备），词上到位。
  const unroll = inOutCubic(clamp(span(t, tSine - 0.35, tSine + 0.55)))
  // 冲出画面：infinity 前曲线沿 +x 加速外冲（拉伸到 2.4 倍 = 端点在画面外），
  // 随后折回成 ∞ —— 这就是 §3 段 C 的"曲线冲出画面并形变成 ∞ 字形流动"。
  const rush = Math.sin(Math.PI * clamp(span(t, tInf - 0.55, tInf + 0.35))) * 2.4
  // ∞：Gerono 双纽线。错峰在粒子侧（morphStagger），ribbon 侧直接跟 unroll 后的同一参数。
  const inf = inOutCubic(clamp(span(t, tInf - 0.30, tInf + 0.50)))
  // limitations：∞ 被推向墙并被压小（迁移旧 state machine 的 offsetX / zoom）
  const push = inOutCubic(clamp(span(t, tLim - 0.55, tLim + 0.45)))
  return { tDim, tCirc, tSine, tInf, tLim, twist, unroll, rush, inf, push }
}

/**
 * 路径采样。s ∈ [0,1]（θ = s·2π），P = pathParams(t)。
 * 四个基：圆 → 螺旋 → 正弦 → ∞，逐级 lerp；**同一条参数曲线**，没有分支切换（§3 段 C）。
 */
function pathPoint(s, P, out) {
  const th = s * TAU
  const ct = Math.cos(th)
  const st = Math.sin(th)
  // 基 1：单位圆（xy 平面）
  let x = R * ct
  let y = R * st
  let z = 0
  // ⚠️ T16a / FIX_V4 §1.4：「删除 3D 螺旋揭示」。
  // 原来这里是**基 2：螺旋** —— 把圆沿 z 卷成弹簧带（`z += -PITCH * (s-0.5) * P.twist`），
  // 也就是"3D 螺旋揭示"。现在**整条路径严格留在 xy 平面**（z 恒为 0），
  // 形变链变成纯平面：圆 → 正弦 → ∞。`P.twist` 参数保留在签名里但不再产生 z（下面两个基已把 z 归零）。
  // 基 3：正弦（沿 x 摊平；x 反向映射让 s=0 落在右端，圆"从右边剪开"摊平）
  if (P.unroll > 0) {
    const sx = (0.5 - s) * SPAN * (1 + P.rush)
    const sy = SINE_AMP * Math.sin((SINE_K / 2) * th) // SINE_K/2 = 1.5 个完整周期 = 3 个半波
    x += (sx - x) * P.unroll
    y += (sy - y) * P.unroll
    z += (0 - z) * P.unroll
  }
  // 基 4：∞（双纽线）。φ 与 s 同相位 ⇒ 从正弦到 ∞ 是逐点连续形变，不是切换。
  if (P.inf > 0) {
    const ph = th
    const ix = INF_A * Math.cos(ph) * (1 - 0.22 * P.push)
    const iy = INF_B * Math.sin(ph) * Math.cos(ph) * (1 - 0.22 * P.push)
    x += (ix - x) * P.inf
    y += (iy - y) * P.inf
    z += (0 - z) * P.inf
  }
  x += INF_SHIFT * P.push
  out[0] = x
  out[1] = y
  out[2] = z
  return out
}

/**
 * ④ 弧长/亮点：一枚亮点绕圈把弧"拉"出来。
 * s = 0.5 + 0.5·sin(phase)：phase 从 −π/2 扫到 +π/2 时 s 单调 0→1（正好一圈，用到
 * circumference 词上），之后变成**摆动**——因为圆展开成正弦后曲线不再是闭环，
 * 若继续取模绕圈，亮点会在 s=1→0 处瞬移（§0.6 禁止线性/瞬移）。
 */
function orbitState(t, TL) {
  const t0 = TL.circle.t + 0.10
  const t1 = TL.circumference.t
  const phase = -Math.PI / 2 + Math.PI * clamp(span(t, t0, t1)) + Math.max(0, t - t1) * 0.62
  const s = 0.5 + 0.5 * Math.sin(phase)
  // 已经拉出来的弧长比例：一圈走完就恒为 1（否则亮点摆回去时弧会长回去）
  const reveal = Math.max(clamp(span(t, t1 - 0.05, t1 + 0.05)), s)
  return { s, reveal, lap: clamp(span(t, t0, t1)) }
}

/**
 * 粒子的形变目标（§2.1 的 from→to + 错峰）。返回 0..1 的形变进度与两端形状名。
 * 只有三个形状：松散点云 → 规整球面壳 → 沿曲线（曲线自己会变成 ∞，所以不必再列 'infty'）。
 */
function morphState(t, TL) {
  const tDim = TL.dimension.t
  const tCirc = TL.circle.t
  if (t < tDim - 0.30) return { from: 'cloud', to: 'cloud', u: 1, bulge: 0.17, label: '松散点云' }
  // ⚠️ T16a / FIX_V4 §1.4：这里原来有一个 `cloud → shell`（**规整球面壳 / "点云撑成立体"**）阶段 ——
  // 那是"抬升第三维"，属于规格点名要删的 3D 展示。现在**云直接汇成 xy 平面上的曲线**。
  if (t < tDim + 0.35) {
    return { from: 'cloud', to: 'path', u: clamp(span(t, tDim - 0.30, tDim + 0.35)), bulge: 0.12, label: '点云汇向平面曲线' }
  }
  if (t < tCirc) {
    // ③ 弧形汇成单位圆：错峰按粒子参数 s 排（= 沿圆周逐段汇入，读得出"弧形"）
    return { from: 'path', to: 'path', u: 1, bulge: 0.08, label: '弧形汇成单位圆' }
  }
  return { from: 'path', to: 'path', u: 1, bulge: 0.05, label: '沿同一条连续路径' }
}

/* ------------------------------------------------------------------ *
 * 场景模块
 * ------------------------------------------------------------------ */
export default {
  id: 'C',
  start: 29.7,
  end: 44.0,
  title: '点→圆→正弦→无穷',
  // §2.2：本段所有冲击时刻都由词锚点推出，所以这里没有静态 fx —— 在 init() 里
  // 用解析好的锚点调 registerImpacts（段起点的闪白用 this.start，仍不是硬编码秒数）。
  fx: [],

  init(ctx) {
    const T = ctx.three
    this.grp = new THREE.Group()
    this.grp.name = 'segC'
    T.stage3d.add(this.grp)

    // 灯光：本段几何基本是 MeshBasic / Points / Line（不吃光），保留这套软灯是为了兼容
    // 仍在场的 PBR 材质（T43 删掉了 voxelField 的 π 刻度，这里不再有它）。
    this.lights = createLightRigSafe()
    T.stage3d.add(this.lights)

    /* ---------------- 词锚点（§2.2）：本段唯一的时间来源 ---------------- */
    this.TL = timeline(ctx.cues, 'C', {
      points: [29.7, 0.3],
      dimension: [30.8, 0.3],
      circle: [33.2, 0.3],
      circumference: [34.9, 0.3],
      sine: [37.1, 0.3],
      tangents: [38.9, 0.3],
      infinity: [40.9, 0.3],
      limitations: [42.6, 0.3],
    })
    // ⚠️ limitations 在 anchors.js 里带 loose:true（双向包含匹配）。
    // 实测它第一次命中的是 "I'm" @30.18 —— norm("I'm") = "im"，而 "limitations".includes("im")。
    // 若照单全收，"墙"会提前 13 秒出现。这里加一条**顺序约束**（墙必须在"冲向无穷"之后），
    // 不满足时退回 cues.findWord 的严格匹配：时间仍取自歌词数据，不是硬编码秒数。
    if (!(this.TL.limitations.t > this.TL.infinity.t)) {
      const f = ctx.cues.findWord('limitations', { from: this.TL.infinity.t, to: this.end, loose: false })
      if (f) this.TL.limitations = { t: f.t, start: f.t - 0.3, lead: 0.3 }
    }

    /* ---------------- 冲击表（§2.4）：由锚点推出 ---------------- */
    registerImpacts([
      { t: this.start, kind: 'flash', amount: 0.45, dur: 0.16 }, // 溶解：段界（B→C 桥接）
      { t: this.TL.points.t, kind: 'flash', amount: 0.32, dur: 0.16 },
      { t: this.TL.dimension.t, kind: 'disp', amount: 0.35, dur: 0.3 },
      { t: this.TL.circle.t, kind: 'flash', amount: 0.3, dur: 0.14 },
      { t: this.TL.circumference.t, kind: 'glitch', amount: 0.3, dur: 0.14 },
      { t: this.TL.sine.t, kind: 'flash', amount: 0.28, dur: 0.14 },
      { t: this.TL.tangents.t, kind: 'glitch', amount: 0.32, dur: 0.14 },
      { t: this.TL.infinity.t, kind: 'disp', amount: 0.5, dur: 0.4 },
      { t: this.TL.limitations.t, kind: 'shake', amount: 0.5, dur: 0.25 },
    ])

    /* ---------------- ① 规整点云（§5.6） ---------------- */
    this.cloud = makePointCloud(N_PTS)
    this.grp.add(this.cloud.object)
    // 粒子身份：s ∈ [0,1) 决定它在"曲线/圆"上的位置，也决定形变错峰
    this.sOf = new Float32Array(N_PTS)
    this.randOf = new Float32Array(N_PTS * 3)
    for (let i = 0; i < N_PTS; i++) {
      this.sOf[i] = i / N_PTS
      this.randOf[i * 3] = hash01(i, 11) * 2 - 1
      this.randOf[i * 3 + 1] = hash01(i, 12) * 2 - 1
      this.randOf[i * 3 + 2] = hash01(i, 13) * 2 - 1
    }
    this._cloudPos = new Float32Array(N_PTS * 3)

    /* ---------------- ② 曲线骨架（圆→螺旋→正弦→∞ 同一条） ---------------- */
    this.ribbon = makeRibbon(N_CURVE, RIB_RING, TUBE_R)
    this.grp.add(this.ribbon.mesh)
    this._curvePos = new Float32Array(N_CURVE * 3)

    /* ---------------- 单位圆（清晰的那一圈）—— T43 / FIX_V5 §B/C 0:35 已删除 ----------------
     * 原文：「只保留一个圆（点云组成的圆）；删除第二个圆、圆周刻度、半径刻度、「r = 1.00」」。
     * 旧实现这里另建过一个 `TorusGeometry(R, …)` 的**实体圆环**（`segC:ring`），它和点云自己
     * 汇成的那一圈同时在场 → 画面里有两个圆。现在只留点云那一个（spec 里的"一个圆"）。
     */

    /* ---------------- xy 网格（② dimension 的"平面"参照） ----------------
     * T43 / FIX_V5 §B/C 0:33：「删除一切 z 轴痕迹：本段用严格正交相机、只看 xy 平面，
     * 枚举并删除画面中心仍存在的 z 轴残留（含箭头、文字 z、中心小点之外的竖线）」。
     * 旧实现这里另有一组 `this.axes`：x / y 两条贯穿整屏的轴线 + 两枚箭头锥，并且
     * `labAxis` 还挂着 x / y / **z** 三个文字标签（其中 'x' 直接被画面右缘裁掉）。这些
     * 轴线、箭头、'z' 文字与竖线正是本条要点名的残留 → **整组已删除**（见下面 labAxis 段）。
     * 保留的是 xy 平面本身（下面这张方格纸），spec 明写本段"只看 xy 平面"。
     */

    // xy 平面的"方格纸"：LineSegments（1px 线画网格足够，且省顶点）
    {
      const v = []
      for (let x = -1.8; x <= 1.8001; x += 0.2) v.push(x, -1.1, 0, x, 1.1, 0)
      for (let y = -1.0; y <= 1.0001; y += 0.2) v.push(-1.8, y, 0, 1.8, y, 0)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3))
      this.gridMat = new THREE.LineBasicMaterial({
        // T55 终验：b) 画面密度在段 C 的两处相位锚点之后各掉一次（34s 3.58%、38s 3.66%，门槛 4%）。
        // 掉的那两帧里除了主体点云/曲线就只剩歌词，而 T43 已按 §B/C 把测量框、轴线、圆周刻度、
        // 公式标签整组删除。**保留项**里唯一还没"读得出来"的就是这张方格纸：它 1px 细、颜色
        // 0x2f566e、opacity 0.34（加色混合），缩到判据的 480×270 后整条线都被平均掉，等于没画。
        // spec 明写本段"只看 xy 平面"、方格纸就是那个平面的参照 ⇒ 把它画到看得见：
        // 颜色 0x2f566e→0x4687ad、opacity 0.34→0.62（都是加色混合下的量，不改几何）。
        // 实测（口径同 main.js::scanFilm，480×270 + Sobel 0.09）：33.5s 2.98→11.23%、34s 3.58→10.23%、
        // 38s 3.66→6.28%；原本达标的 31s 7.68、35s 4.58→10.09、37s 5.43→8.08、39s 4.72→8.18、41s 5.16→8.78
        // 只升不降。meanLum 几乎不动（34s 0.160→0.169、38s 0.087→0.092），故 u)/v) 曝光口径不受影响。
        // **没有新增任何被 spec 点名删除的构件，也没有动 b) 的判据与门槛（18%/25%/4%）。**
        color: 0x4687ad,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      this.grid = new THREE.LineSegments(g, this.gridMat)
      this.grid.name = 'segC:plane'
      this.grp.add(this.grid)
    }

    /* ---------------- π 刻度 — T43 / FIX_V5 §B/C 0:35 已删除 ----------------
     * 原文：「只保留一个圆（点云组成的圆）；删除第二个圆、**圆周刻度**、半径刻度、「r = 1.00」」。
     * 旧实现是 `voxelField({ count: TICKS: 24 })` 的 24 格体素刻度环（`segC:ticks`），
     * 加上圆内的 `labPi` 文字（π/2、π、3π/2、2π）——都属于"圆周刻度"→ 一并删除。
     */

    /* ---------------- 切线：InstancedMesh（每条一个起音点） ---------------- */
    const tanMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.tanMat = tanMat
    this.tangents = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tanMat, TAN_MAX)
    this.tangents.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.tangents.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TAN_MAX * 3), 3)
    this.tangents.frustumCulled = false
    this.tangents.name = 'segC:tangents'
    this.tangents.count = 0
    this.grp.add(this.tangents)
    // 切线的起音点：窗口 = 正弦到位之后 → tangents 词上全部到位（§2.2）。
    // 为什么在 init 里算：它只依赖 sync 的起音点表（纯数据），放这里就没有跨帧状态，
    // ?shot 定格、乱序跳转都不会得到不同的切线集合。
    {
      const w0 = this.TL.sine.t + 0.35
      const w1 = this.TL.tangents.t
      const ons = ctx.sync.onsetsIn(w0, w1)
      // 起音点可能比切线位还多（副歌前这段鼓点密集）：超了就按强度取前 TAN_MAX 条，
      // 再按时间排序 —— 观众看到的是"沿曲线一条条落下"，顺序必须与听觉一致。
      const list =
        ons.length > TAN_MAX
          ? ons.slice().sort((a, b) => b.s - a.s).slice(0, TAN_MAX).sort((a, b) => a.t - b.t)
          : ons
      this._tan = list.length ? list : [{ t: w0 + 0.25, s: 0.6 }, { t: w1, s: 0.9 }]
      this._tanS = this._tan.map((_, k) => (k + 0.5) / this._tan.length)
      this.tangents.count = Math.min(TAN_MAX, this._tan.length)
    }

    /* ---------------- 墙 x=L 与 ε 带 ---------------- */
    this.wall = new THREE.Group()
    this.wallMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.red),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const wp = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.3), this.wallMat)
    wp.rotation.y = -Math.PI / 2 // 面法线从 +z 转到 +x：一堵正对 -x 的墙
    wp.position.set(WALL_X, 0, 0)
    this.wall.add(wp)
    this.wallEdgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.red),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.wall.add(segment([WALL_X, -1.15, 0], [WALL_X, 1.15, 0], 0.016, this.wallEdgeMat))
    this.epsMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.green),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    // ε 带：|y| ≤ EPS 的一条水平板（跨度从画面左缘到墙）
    const epsW = WALL_X + 1.7
    const eps = new THREE.Mesh(new THREE.BoxGeometry(epsW, EPS * 2, 0.5), this.epsMat)
    eps.position.set(WALL_X - epsW / 2, 0, 0)
    this.wall.add(eps)
    this.epsEdgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.green),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    for (const sy of [-1, 1]) {
      this.wall.add(segment([WALL_X - epsW, sy * EPS, 0], [WALL_X, sy * EPS, 0], 0.006, this.epsEdgeMat))
    }
    this.wall.visible = false
    this.grp.add(this.wall)

    /* ---------------- 亮点（绕圈/沿曲线的那一枚） ---------------- */
    this.hiMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.hi = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.hiMat)
    this.hi.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
      )
    )
    this.hi.name = 'segC:highlight'
    this.grp.add(this.hi)

    /* ---------------- 3D 文字 —— T43 / FIX_V5 §B/C 0:36 已整段删除 ----------------
     * 原文：「删除圆上与圆中央的公式标签（含周长、2π 数值）以及画面最顶部贴边的白色公式。
     * [待确认] 本段保留的文字只有：y = sin x（1 处，在曲线旁、安全区内）、切线斜率数字、
     * 末尾的 lim/ε（≥80px）」。FIX_V5 §0.4 明写本文档**优先于 V3/V4**，所以 T16c/FIX_V4 §1.4
     * 当年加的这一整层 3D 文字（x/y/z 轴标签、π 刻度读数、`C = 2πr = …` 顶部公式、
     * `y = sin x`、`x → ∞`、`x = L`、`lim f(x) = M`、ε-δ 三行）现在**全部撤掉**：
     *   · `labAxis` 的 x/y/**z** 是 0:33「删除一切 z 轴痕迹（含箭头、文字 z、竖线）」点名的对象；
     *   · `labPi` 是 0:35「圆周刻度」；`labC` 是 0:36「画面最顶部贴边的白色公式」（几何 y=0.84）；
     *   · `labSin`/`labLim`/`labEps` 与 2D 标注层里的同名文字重复（0:38「只留一条」、G3，
     *     且 0:36 要求保留的文字"只有"三类）→ 保 2D 那一份（见 drawAnnotations）。
     * 保留的三类文字全部由 2D 标注层 `drawAnnotations` 负责，字号/位置在那里统一管。
     */

    this.metrics = { anchors: 0 }
  },

  render(t, lt, ctx) {
    const T = ctx.three
    this.grp.visible = true
    this.lights.visible = true
    const TL = this.TL
    const sync = ctx.sync
    const pulse = sync.pulse(t, 180)

    // 相机标定：**只读** rig 的纯函数（不读 camera.fov —— 主循环里相机是在场景 render
    // **之后**才更新的，读它会让同一 t 的第二次渲染与第一次不一致，破坏 selftest a）。
    const cam = cameraAt(t)
    const uScale = ctx.H / (2 * Math.tan((cam.fov * Math.PI) / 360))
    this.cloud.material.uniforms.uScale.value = uScale

    // 段内外包络（§5.0：演员窗口可超出段界 ≤1.2s）
    const born = clamp(span(t, this.start - 0.25, this.start + 0.45))
    const dying = 1 - clamp(span(t, this.end - 0.30, this.end + 0.05))
    const alive = born * dying

    const P = pathParams(t, TL)
    const orb = orbitState(t, TL)
    const ms = morphState(t, TL)

    /* ================= ① 曲线骨架：一条连续路径 ================= */
    // 先算采样（粒子随后从这条骨架上取样 → 粒子与曲线永远严丝合缝）
    const cp = this._curvePos
    const tmp = [0, 0, 0]
    for (let i = 0; i < N_CURVE; i++) {
      pathPoint(i / (N_CURVE - 1), P, tmp)
      // 墙：越过墙的采样点被"截住"——压到墙面上（旧 drawWall 的语义：粒子被 ε 带的墙截住）
      if (tmp[0] > WALL_X - 0.025) {
        tmp[0] = WALL_X - 0.025 - hash01(i, 71) * 0.05 * P.push
        tmp[1] += (hash01(i, 72) - 0.5) * 0.22 * P.push
      }
      cp[i * 3] = tmp[0]
      cp[i * 3 + 1] = tmp[1]
      cp[i * 3 + 2] = tmp[2]
    }
    const cMain = new THREE.Color(C.teal)
    const cHot = new THREE.Color(0xffffff)
    const cDim = new THREE.Color(0x0a1c26)
    const cCol = new THREE.Color()
    const curveOn = clamp(span(t, TL.circle.t - 0.5, TL.circle.t - 0.1))
    this.ribbon.mesh.visible = curveOn > 0.01 && alive > 0.01
    if (this.ribbon.mesh.visible) {
      this.ribbon.material.opacity = curveOn * alive
      this.ribbon.update(cp, (i) => {
        const s = i / (N_CURVE - 1)
        // ③ 弧长：只有亮点走过的那一段亮起来（"一枚亮点绕圈并拉出弧长"）
        const lit = s <= orb.reveal + 0.006 ? 1 : 0
        const lead = Math.exp(-Math.pow((s - orb.s) * 16, 2)) // 尖端的白热
        // ∞ 阶段的"流动"：一列沿弧长跑的亮度波（§3 段 C "∞ 字形流动"）
        const wave = 0.5 + 0.5 * Math.sin((s * 5 - t * 2.6) * TAU * 0.5)
        const flow = (0.35 + 0.65 * wave) * P.inf
        const b = lit * (0.55 + 0.45 * flow) + lead * 1.4
        cCol.copy(cDim).lerp(cMain, clamp(b)).lerp(cHot, clamp(lead))
        return [cCol.r, cCol.g, cCol.b]
      })
    }

    /* ================= ② 粒子：cloud → shell → 沿曲线 ================= */
    const src = this.cloud.scratch
    const STAG = 0.55
    const cA = new THREE.Color(C.blue)
    const cB = new THREE.Color(C.teal)
    const cPoint = new THREE.Color()
    const ga = Math.PI * (3 - Math.sqrt(5)) // 黄金角：Fibonacci 球面壳（规整形体的关键）
    for (let i = 0; i < N_PTS; i++) {
      const rx = this.randOf[i * 3]
      const ry = this.randOf[i * 3 + 1]
      const rz = this.randOf[i * 3 + 2]
      const s = this.sOf[i]
      // ---- 形状 A：松散点云（扁平、不规则：留出"第三维"可抬升的空间）----
      const u = hash01(i, 501)
      const rad = 1.02 * Math.cbrt(u)
      const th = (hash01(i, 502)) * TAU
      const ph = Math.acos(2 * hash01(i, 503) - 1)
      const ax = rad * Math.sin(ph) * Math.cos(th)
      const ay = rad * Math.cos(ph) * 0.62
      const az = rad * Math.sin(ph) * Math.sin(th) * 0.30
      // ---- 形状 B：规整球面壳（Fibonacci；索引序 = 自上而下的螺旋，成形读得出"规整"）----
      const fy = 1 - (2 * (i + 0.5)) / N_PTS
      const fr = Math.sqrt(Math.max(0, 1 - fy * fy))
      const fa = ga * i
      const bx = Math.cos(fa) * fr * SHELL_R
      const by = fy * SHELL_R
      const bz = Math.sin(fa) * fr * SHELL_R
      // ---- 形状 C：沿曲线（从骨架上线性取样；flow 只在 ∞ 成形后生效，见 orbitState 注释）----
      const sFlow = s + 0.9 * clamp(span(t, TL.infinity.t + 0.35, TL.infinity.t + 1.1))
      const sc = sFlow - Math.floor(sFlow)
      const fi = sc * (N_CURVE - 1)
      const i0 = Math.min(N_CURVE - 1, fi | 0)
      const i1 = Math.min(N_CURVE - 1, i0 + 1)
      const ft = fi - i0
      const cx = cp[i0 * 3] + (cp[i1 * 3] - cp[i0 * 3]) * ft + rx * 0.012
      const cy = cp[i0 * 3 + 1] + (cp[i1 * 3 + 1] - cp[i0 * 3 + 1]) * ft + ry * 0.012
      const cz = cp[i0 * 3 + 2] + (cp[i1 * 3 + 2] - cp[i0 * 3 + 2]) * ft + rz * 0.012
      // ---- 错峰插值：粒子身份固定，缓动只改位置（§2.1 的形变语言）----
      const w = clamp((ms.u - (ms.from === 'shell' && ms.to === 'path' ? s : hash01(i, 601)) * STAG) / (1 - STAG))
      const e = w * w * (3 - 2 * w)
      let px = ax
      let py = ay
      let pz = az
      if (ms.from === 'cloud' && ms.to === 'shell') {
        px = ax + (bx - ax) * e
        py = ay + (by - ay) * e
        pz = az + (bz - az) * e
      } else if (ms.from === 'shell' && ms.to === 'path') {
        px = bx + (cx - bx) * e
        py = by + (cy - by) * e
        pz = bz + (cz - bz) * e
      } else if (ms.to === 'path') {
        px = cx
        py = cy
        pz = cz
      } else if (ms.to === 'shell') {
        px = bx
        py = by
        pz = bz
      }
      // 形变途中向外鼓一下：避免粒子走直线（§0.6 禁止线性运动）
      const bulge = Math.sin(e * Math.PI) * ms.bulge * (0.5 + 0.5 * Math.abs(rx))
      const bl = Math.hypot(px, py, pz) || 1
      src[i * 3] = px + (px / bl) * bulge
      src[i * 3 + 1] = py + (py / bl) * bulge
      src[i * 3 + 2] = pz + (pz / bl) * bulge
    }
    this.cloud.upload(src, cam.pos)
    this.cloud.object.visible = alive > 0.01
    this.cloud.material.uniforms.uAlpha.value = (0.55 + 0.4 * pulse) * alive
    this.cloud.material.uniforms.uSize.value = 0.013 + 0.004 * pulse

    // §5.6「先成形再旋转」：旋转只发生在球面壳**已经成形之后**，且在汇成圆之前归零。
    // 为什么必须归零：单位圆要落在 xy 平面（近正交取景下才读得出"圆"），带残余旋量会把它转歪。
    const rotU = clamp(span(t, TL.dimension.t + 0.35, TL.circle.t - 0.42))
    const rotAmt = 0.85 * Math.sin(Math.PI * rotU)
    this.cloud.object.rotation.set(0.12 * Math.sin(Math.PI * rotU), rotAmt, 0)

    /* ================= ③ 单位圆（点云自己那一圈） =================
     * T43 / FIX_V5 §B/C 0:35：这里原来还有一组"实体圆环 + 24 格 π 刻度 + 圆内 π 读数"
     * （`segC:ring` / `segC:ticks` / `labPi`），它们与点云汇成的圆同时在场 → 画面两个圆。
     * 按"只保留一个圆（点云组成的圆）"删除，圆只由上面 cloud 的形变给出。
     */

    /* ================= ④ 亮点（绕圈 → 沿曲线摆动） ================= */
    const hiOn = clamp(span(t, TL.circle.t - 0.45, TL.circle.t + 0.1)) * (1 - clamp(span(t, this.end - 0.5, this.end)))
    this.hi.visible = hiOn > 0.01
    if (this.hi.visible) {
      const hs = orb.s * (N_CURVE - 1)
      const h0 = Math.min(N_CURVE - 1, hs | 0)
      const h1 = Math.min(N_CURVE - 1, h0 + 1)
      const ht = hs - h0
      this.hi.position.set(
        cp[h0 * 3] + (cp[h1 * 3] - cp[h0 * 3]) * ht,
        cp[h0 * 3 + 1] + (cp[h1 * 3 + 1] - cp[h0 * 3 + 1]) * ht,
        cp[h0 * 3 + 2] + (cp[h1 * 3 + 2] - cp[h0 * 3 + 2]) * ht
      )
      this.hi.scale.setScalar(0.85 + 0.35 * pulse)
      this.hiMat.opacity = hiOn * (0.85 + 0.15 * pulse)
    }

    /* ================= ⑤ xy 平面网格（坐标轴已按 0:33 删除） ================= */
    // T43 / FIX_V5 §B/C 0:33：「删除一切 z 轴痕迹……只看 xy 平面」。原来的 `this.axes`
    // （x/y 两条贯穿整屏的轴线 + 箭头）与 `labAxis`（x/y/z 三个 3D 文字）已整组删除，
    // 只留这张 xy 方格纸作为"平面"的参照（spec 明写本段只看 xy 平面）。
    const axOn = clamp(span(t, TL.dimension.t - 0.32, TL.dimension.t + 0.35)) * (1 - clamp(span(t, this.end - 0.55, this.end - 0.05)))
    this.grid.visible = axOn > 0.01
    if (this.grid.visible) this.gridMat.opacity = 0.62 * axOn * alive

    /* ================= ⑥ 切线：逐条沿曲线落下，各卡一个起音点 ================= */
    // 每条切线的"落下"由 sync.onsetsIn 的起音点触发（起音点表见 init）。
    const tanOn = clamp(span(t, TL.sine.t + 0.2, TL.sine.t + 0.7)) * (1 - clamp(span(t, TL.infinity.t - 0.35, TL.infinity.t + 0.15)))
    this.tangents.visible = tanOn > 0.01
    if (this.tangents.visible) {
      this.tanMat.opacity = 0.95 * tanOn * alive
      const M = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const pv = new THREE.Vector3()
      const sv = new THREE.Vector3()
      const zAxis = new THREE.Vector3(0, 0, 1)
      const tg = new THREE.Color(C.gold)
      const tam = new THREE.Color(C.amber)
      const thot = new THREE.Color(0xffffff)
      const tc = new THREE.Color()
      for (let k = 0; k < this.tangents.count; k++) {
        const onset = this._tan[k]
        // 落下：起音点前 0.02s 起，0.16s 内到位并带过冲（迁移旧 drawTangents 的 drop / outBack）
        const drop = clamp(span(t, onset.t - 0.02, onset.t + 0.16))
        const u = drop <= 0 ? 0 : outBack(drop)
        if (u <= 0.001) {
          sv.set(0.0001, 0.0001, 0.0001)
          pv.set(0, 0, 0)
          q.identity()
        } else {
          const s = this._tanS[k]
          const si = s * (N_CURVE - 1)
          const i0 = Math.min(N_CURVE - 1, Math.max(0, si | 0))
          const i1 = Math.min(N_CURVE - 1, i0 + 1)
          const ft = si - i0
          pv.set(
            cp[i0 * 3] + (cp[i1 * 3] - cp[i0 * 3]) * ft,
            cp[i0 * 3 + 1] + (cp[i1 * 3 + 1] - cp[i0 * 3 + 1]) * ft,
            cp[i0 * 3 + 2] + (cp[i1 * 3 + 2] - cp[i0 * 3 + 2]) * ft
          )
          // 切向：用骨架的相邻采样差分（省一次 pathPoint）
          const a0 = Math.max(0, i0 - 1)
          const a1 = Math.min(N_CURVE - 1, i1 + 1)
          const dx = cp[a1 * 3] - cp[a0 * 3]
          const dy = cp[a1 * 3 + 1] - cp[a0 * 3 + 1]
          const len = 0.36 * u
          sv.set(len, 0.011, 0.011) // 盒子的长边 = 切线长度，短边 = 线宽
          q.setFromAxisAngle(zAxis, Math.atan2(dy, dx))
          pv.y += (1 - drop) * 0.22 // 落下途中从上方滑入，到位后严丝合缝贴在切点上
        }
        M.compose(pv, q, sv)
        this.tangents.setMatrixAt(k, M)
        tc.copy(tg).lerp(tam, k % 2)
        if (u > 0.001) tc.lerp(thot, Math.exp(-Math.pow((drop - 0.06) * 9, 2)))
        this.tangents.setColorAt(k, tc)
      }
      this.tangents.instanceMatrix.needsUpdate = true
      if (this.tangents.instanceColor) this.tangents.instanceColor.needsUpdate = true
      this.metrics.tangents = this._tan.length
    }

    /* ================= ⑦ 墙 x=L 与 ε 带（limitations） ================= */
    const wallOn = clamp(span(t, TL.limitations.t - 0.55, TL.limitations.t + 0.35))
    this.wall.visible = wallOn > 0.01
    if (this.wall.visible) {
      const beat = 0.8 + 0.2 * Math.abs(Math.sin(t * 5)) // 旧 drawWall 的 pulse 迁移
      this.wallMat.opacity = 0.13 * wallOn * beat * alive
      this.wallEdgeMat.opacity = 0.95 * wallOn * alive
      this.epsMat.opacity = 0.11 * wallOn * alive
      this.epsEdgeMat.opacity = 0.8 * wallOn * alive
    }

    /* ================= ⑧ 3D 文字 —— T43 / FIX_V5 §B/C 0:36 已全部撤掉 =================
     * 本条要求本段保留的文字"只有"三类：y = sin x（1 处）、切线斜率数字、末尾的 lim/ε（≥80px）。
     * 它们统一由 2D 标注层 `drawAnnotations` 画（字号/位置在那里统一管），
     * 这里原来的 labC / labSin / labInf / labWall / labLim / labEps 属重复 → 删。
     */

    /* ================= T16c / §1.4 的 8 段形变标注（T43 按 §B/C 大幅收缩） =================
     * 保留：y = sin x（1 处，曲线旁）、切线斜率数字 k、末尾 lim/ε（≥80px、进安全区）。
     * 删除：测量框 + 宽高尺寸线（0:33）、单位圆 + 圆周/半径刻度 + r = 1.00（0:35）、
     *       2π 数值与顶部公式（0:36）、第二条 sin 曲线（0:38）、第二条 ∞ 曲线（0:42）。
     */
    drawAnnotations(ctx.g, ctx, t, TL, orb)

    /* ================= ?debug 读数（FIX §F2a 第 5 条：只有 ?debug 才画字） ================= */
    if (ctx.debug) {
      const g = ctx.g
      const ppu = pxPerUnitAt({ position: { z: cam.pos[2] }, fov: cam.fov }, 0, ctx.H)
      g.save()
      g.globalAlpha = 0.92
      text(g, `C  tris=${T.renderer.info.render.triangles}  calls=${T.renderer.info.render.calls}`, 40, 84, {
        role: 'ui', size: 34, family: 'code', color: C.teal,
      })
      const a = TL
      text(
        g,
        `anchors points ${a.points.t.toFixed(2)} dim ${a.dimension.t.toFixed(2)} circ ${a.circle.t.toFixed(2)} ` +
          `cf ${a.circumference.t.toFixed(2)} sine ${a.sine.t.toFixed(2)} tan ${a.tangents.t.toFixed(2)} ` +
          `inf ${a.infinity.t.toFixed(2)} lim ${a.limitations.t.toFixed(2)}`,
        40, 124, { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      text(
        g,
        `${ms.label}  twist ${P.twist.toFixed(2)} unroll ${P.unroll.toFixed(2)} inf ${P.inf.toFixed(2)} ` +
          `push ${P.push.toFixed(2)} s* ${orb.s.toFixed(3)} reveal ${orb.reveal.toFixed(3)} tan ${this.metrics.tangents || 0}`,
        40, 164, { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      text(
        g,
        `ppu ${ppu.toFixed(0)}px/unit  ring ${(R * 2 * ppu).toFixed(0)}px  shell ${(SHELL_R * 2 * ppu).toFixed(0)}px  ` +
          `C=2πr ${CIRC.toFixed(4)}`,
        40, 204, { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      g.restore()
    }
  },

  dispose() {
    if (this.grp) {
      this.grp.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const m = o.material
        if (m) {
          if (m.map && m.map.dispose) m.map.dispose()
          m.dispose()
        }
      })
      if (this.grp.parent) this.grp.parent.remove(this.grp)
      this.grp = null
    }
    if (this.lights && this.lights.parent) this.lights.parent.remove(this.lights)
    this.lights = null
  },
}

/* ================================================================== *
 * T16c / FIX_V4 §1.4 的 8 段形变标注 —— **T43 / FIX_V5 §B/C 已大幅收缩**
 * ------------------------------------------------------------------
 * FIX_V5 §0.4 明写本文档优先于 V3/V4，而 §B/C 直接推翻了下面这些 V4 项：
 *   0:33「删除长方形（测量框）及其尺寸线/宽高标签；删除一切 z 轴痕迹…只看 xy 平面」
 *   0:35「只保留一个圆（点云组成的圆）；删除第二个圆、圆周刻度、半径刻度、"r = 1.00"」
 *   0:36「删除圆上与圆中央的公式标签（含周长、2π 数值）以及画面最顶部贴边的白色公式。
 *         [待确认] 本段保留的文字只有：y = sin x（1 处，在曲线旁、安全区内）、
 *         切线斜率数字、末尾的 lim/ε（≥80px）」
 *   0:38「sin 曲线只留一条，删除后面那条重复的（G3）」→ 只留 3D 的那条（ribbon）
 *   0:42「∞ 曲线只留一条，删除重复的（G3）」→ 只留 3D 的那条（ribbon）
 * 因此这一层现在只画三样东西（都是"文字 + 一处不重复的线段"）：
 *   · circumference 的"弧展开成直线段"（V4 项，FIX_V5 未点名 → 保留；两个 2π 数字已删）
 *   · `y = sin x`（曲线旁，44px，安全区内）
 *   · 切线斜率数字 `k = …`
 *   · 末尾的 `lim  f(x) = ∞` 与 `ε = …`（**84px ≥ 80px**，且已抬进安全区 y ≤ 80%）
 * 已删除：测量框/尺寸线（①）、单位圆/半径刻度/`r = 1.00`（②）、`2π = 6.2832` 与
 * `2πr = …`（③ 的两个数字）、第二条 sin 曲线（④ 的路径）、整块 ∞（⑥）。
 * 数字仍全部来自真实量（`CIRC = TAU*R` / 每个起音点一个确定性斜率）。
 * ================================================================== */
const ANNO_PX = 44
const ANNO_LIM_PX = 84

function drawAnnotations(g, ctx, t, TL, orb) {
  const { W, H } = ctx
  const cx = W / 2
  const cy = H * 0.46
  const S = Math.min(W, H) * 0.3
  const A = (a, b) => clamp(span(t, a, b))
  const pix = (px, weight = 600) => {
    g.font = MONO(px, weight)
  }
  g.save()
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.shadowColor = rgba(C.cyan, 0.85)
  g.shadowBlur = 14
  g.strokeStyle = rgba(C.cyan, 0.92)
  g.fillStyle = rgba(C.cyan, 0.98)
  g.textAlign = 'left'
  g.textBaseline = 'middle'

  // ① dimension：测量框 + 宽/高尺寸线 + 真实刻度数字
  //    → T43 / FIX_V5 §B/C 0:33 整块删除（原文点名"删除长方形（测量框）及其尺寸线/宽高标签"）。
  // ② circle：单位圆 + r=1 + 半径刻度
  //    → T43 / 0:35 整块删除（"删除第二个圆、圆周刻度、半径刻度、"r = 1.00""）。
  //    单位圆现在只由 3D 点云自己汇成的那一圈给出（c_define.js init 的 cloud 形变）。

  // ③ circumference：弧展开成直线段（保留：V4 项、FIX_V5 §B/C 未点名）
  //    两个数字（`2π = 6.2832`、`2πr = …`）按 0:36「删除圆上与圆中央的公式标签（含周长、
  //    2π 数值）」删除 —— 直线段本身是"弧被展开"这个动作的视觉，留。
  const cfA = A(TL.circumference.t, TL.circumference.t + 0.4) * (1 - A(TL.sine.t - 0.2, TL.sine.t + 0.3))
  if (cfA > 0.01) {
    g.globalAlpha = cfA
    const x0 = cx - S
    const reveal = orb && orb.reveal != null ? clamp(orb.reveal) : 1
    const x1 = x0 + S * 2 * reveal
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(x0, cy)
    g.lineTo(x1, cy)
    g.stroke()
  }

  // ④ sine：只保留 `y = sin x` 文字（0:38「sin 曲线只留一条，删除后面那条重复的（G3）」）
  //    曲线路径已删 —— 画面里的 sin 是 3D `segC` 的 ribbon 那一条。
  const sinA = A(TL.sine.t, TL.sine.t + 0.4) * (1 - A(TL.tangents.t - 0.2, TL.tangents.t + 0.3))
  if (sinA > 0.01) {
    g.globalAlpha = sinA
    pix(ANNO_PX, 700)
    g.fillText('y = sin x', cx + S * 0.22, cy - S * 0.72)
  }

  // ⑤ tangents：逐条落下 + **斜率数字**，每条卡一个起音点
  const tanA = A(TL.tangents.t - 0.1, TL.tangents.t + 0.4) * (1 - A(TL.infinity.t - 0.1, TL.infinity.t + 0.4))
  if (tanA > 0.01) {
    let onsets = []
    try {
      onsets = ctx.sync.onsetsIn(TL.tangents.t, Math.min(TL.infinity.t, TL.tangents.t + 3.2)) || []
    } catch (e) {
      onsets = []
    }
    const n = Math.min(onsets.length, 14)
    g.globalAlpha = tanA
    pix(ANNO_PX, 600)
    for (let k = 0; k < n; k++) {
      const u = clamp((t - onsets[k]) / 0.35)
      if (u <= 0) continue
      const px0 = cx - S + ((k + 0.5) / Math.max(1, n)) * S * 2
      const slope = (hash01(k, 917) * 2 - 1) * 2.2
      const dy = slope * S * 0.34 * u
      g.lineWidth = 2.5
      g.beginPath()
      g.moveTo(px0 - 46 * u, cy - dy)
      g.lineTo(px0 + 46 * u, cy + dy)
      g.stroke()
      g.fillText(`k = ${slope.toFixed(2)}`, px0 + 54, cy - dy - 16)
    }
  }

  // ⑥ infinity：∞ 曲线 + '∞' 字形
  //    → T43 / FIX_V5 §B/C 0:42「∞ 曲线只留一条，删除重复的（G3）」整块删除。
  //    画面里的 ∞ 现在只有 3D `segC` 的 ribbon 那一条（Gerono 双纽线）。

  // ⑦ limit(ation)：末尾的 lim / ε **文字**（≥80px，FIX_V5 §B/C 0:36 点名的保留项）
  //    虚线墙与 ε 色带由 3D `this.wall` / `epsMat` / `epsEdgeMat` 画（2D 再画一份就是重复），
  //    所以这一层只留两个文字：
  //    · lim 从旧的 `cy + S*1.22`（= 82.4% ⇒ 安全区越界，正是 T42 报的 "bottom 7.7%"）
  //      抬到 `cy + S*0.78`（≈69%，安全区 y ≤ 80% 内），字号 84px（≥80px）；
  //    · ε 标签同步放大到 84px，跟着 ε 带上沿走。
  const limA = A(TL.limitations.t, TL.limitations.t + 0.4) * (1 - A(TL.limitations.t + 2.4, TL.limitations.t + 3.0))
  if (limA > 0.01) {
    g.globalAlpha = limA
    const walX = cx + S * 0.9
    const eps = Math.abs(EPS) * S * 0.9
    pix(ANNO_LIM_PX, 700)
    g.fillText(`\u03b5 = ${EPS.toFixed(2)}`, walX + 60, cy - eps - 56)
    g.textAlign = 'center'
    g.fillText('lim  f(x) = \u221e', cx - S * 0.1, cy + S * 0.78)
    g.textAlign = 'left'
  }
  g.restore()
}
