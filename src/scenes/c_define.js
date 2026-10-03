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
//   · 文字一律经 text()/textPlane()（§0.5 字号下限），画布上不写主体画面（FIX §F2a 第 5 条）：
//     本文件 **没有** 任何 `g.fillRect/fillText/arc` —— 唯一的 2D 调用在 ?debug 读数里。
//   · 事件时刻**全部**来自词锚点 ctx.cues.sec（§2.2），旧文件的绝对秒数只作 fallback。
//     实测锚点（?shot 查询得）：points 31.021 / dimension 32.700 / circle 34.361 /
//     circumference 36.389 / sine 38.021 / tangents 40.309 / infinity 41.476 / limitations 43.548。
//   · 相机不归本段管（§2.1）：只**读** rig.cameraAt(t) 做像素标定，不创建相机、不加关键帧。
//
// 旧 c_define.js 的"真实计算"按 §5.0 迁移（旧场景是素材库）：
//   R=0.62 单位圆半径、SINE_K=3、SINE_AMP=0.42、TICKS=24、WALL_L=0.86、EPS=0.09、
//   2πr 的真实周长读数、切线按 sync.onsetsIn(...) 逐个卡起音点、ε 带的几何与读数文案。

import * as THREE from 'three'
import { C } from '../core/palette.js'
import { clamp, span, inOutCubic, outBack, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text } from '../ui/text.js'
import { textPlane, voxelField, createLightRigSafe, pxPerUnitAt } from '../lib/scene3d.js'
import { cameraAt } from '../core/rig.js'
import { registerImpacts } from '../core/fx.js'
import { timeline } from './_seg.js'

/* ------------------------------------------------------------------ *
 * 常量：全部迁移自旧 c_define.js（FIX §5.0）
 * ------------------------------------------------------------------ */
const R = 0.62 // 单位圆半径（世界单位；1 = 半屏高 → 直径占画面高度 63%，与旧文件同）
const SINE_K = 3 // 正弦半波数（旧文件 SINE_K = 3）
const SINE_AMP = 0.42 // 展开后的正弦振幅（旧文件 SINE_AMP）
const TICKS = 24 // 圆周刻度数（旧文件 TICKS）
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

/**
 * 文字面片的世界高度换算。
 * 为什么不是直接给 height：scene3d 的 textPlane 用 `height` 当 **em 高**，
 * 但它的画布高度是 `1.18em×行数 + 0.3em`，整张画布又被贴到高度 = height 的平面上，
 * 于是**观众看到的字高 = height × pxPerUnit ÷ 1.48**。
 * 若按 §0.5 的下限直接填 height（例如 formula 80px → 0.148），屏幕上只有 54px ——
 * "数值达标但看上去很小"正是本项目反复踩的坑。这里按目标屏幕像素反推。
 * @param {number} px 期望的屏幕字高（px，1080p 逻辑坐标）
 */
function txtH(px) {
  return (px / 540) * 1.48
}

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

/** 一个文字面片：统一走 textPlane（→ text() → §0.5 字号守卫），并压到 3D 最上层 */
function mkLabel(str, role, px, color, glow = 0.45, weight = 700) {
  const p = textPlane(str, { role, height: txtH(px), color, glow, weight, family: 'code' })
  p.mesh.renderOrder = 30
  p.material.depthTest = false // 读数必须永远可读：曲线/蜂群从它后面过也不许遮字
  p.mesh.visible = false
  return p
}

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
  // 基 2：螺旋（把圆沿 z 卷成弹簧带：x/y 仍是圆，z 与 s 成正比 ⇒ 一条真正的螺旋线）。
  // 轴向以原点为中心（s−0.5），这样螺旋从"平铺的圆"卷起来时不会整体往观众身后跑。
  if (P.twist > 0) z += -PITCH * (s - 0.5) * P.twist
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
  if (t < tDim + 0.35) {
    // ② 抬升第三维：云 → 规整球面壳（§5.6：规整形体，不是噪点）
    return { from: 'cloud', to: 'shell', u: clamp(span(t, tDim - 0.30, tDim + 0.35)), bulge: 0.1, label: '点云撑成立体（球面壳）' }
  }
  if (t < tCirc - 0.42) return { from: 'shell', to: 'shell', u: 1, bulge: 0.06, label: '立体 · 先成形再旋转' }
  if (t < tCirc) {
    // ③ 弧形汇成单位圆：错峰按粒子参数 s 排（= 沿圆周逐段汇入，读得出"弧形"）
    return { from: 'shell', to: 'path', u: clamp(span(t, tCirc - 0.42, tCirc)), bulge: 0.16, label: '弧形汇成单位圆' }
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

    // voxelField（π 刻度）是 PBR 材质，需要环境光+主光+轮廓光（§2.7）
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

    /* ---------------- 单位圆（清晰的那一圈） ---------------- */
    this.ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(C.teal),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0085, 6, 200), this.ringMat)
    this.ring.name = 'segC:ring'
    this.grp.add(this.ring)

    /* ---------------- 坐标轴 + xy 网格（② dimension"出现 x/y/z 坐标轴"） ---------------- */
    const axMat = new THREE.MeshBasicMaterial({
      color: 0x86b6d8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.axisMat = axMat
    this.axes = new THREE.Group()
    const AX = [
      [[-1.12, 0, 0], [1.52, 0, 0]],
      [[0, -0.98, 0], [0, 0.98, 0]],
      [[0, 0, -0.62], [0, 0, 0.66]],
    ]
    for (const [a, b] of AX) this.axes.add(segment(a, b, 0.0072, axMat))
    // 箭头：x / y / z 的正向各一个锥
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xbfe4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.coneMat = coneMat
    const heads = [
      [[1.52, 0, 0], [0, 0, -1]],
      [[0, 0.98, 0], [0, 0, 0]],
      [[0, 0, 0.66], [1, 0, 0]],
    ]
    for (const [p, rot] of heads) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 8), coneMat)
      cone.position.set(p[0], p[1], p[2])
      // ConeGeometry 默认朝 +y：x 轴转到 +x，z 轴转到 +z
      if (rot[1] === -1) cone.rotation.z = -Math.PI / 2
      if (rot[0] === 1) cone.rotation.x = Math.PI / 2
      this.axes.add(cone)
    }
    this.grp.add(this.axes)

    // xy 平面的"方格纸"：LineSegments（1px 线画网格足够，且省顶点）
    {
      const v = []
      for (let x = -1.8; x <= 1.8001; x += 0.2) v.push(x, -1.1, 0, x, 1.1, 0)
      for (let y = -1.0; y <= 1.0001; y += 0.2) v.push(-1.8, y, 0, 1.8, y, 0)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3))
      this.gridMat = new THREE.LineBasicMaterial({
        color: 0x2f566e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      this.grid = new THREE.LineSegments(g, this.gridMat)
      this.grid.name = 'segC:plane'
      this.grp.add(this.grid)
    }

    /* ---------------- π 刻度（24 格，逐格点亮） ---------------- */
    this.ticks = voxelField({ count: TICKS, cell: 0.03, gap: 0 })
    this.grp.add(this.ticks.object)

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

    /* ---------------- 3D 文字（全部经 textPlane → text() → §0.5 守卫） ---------------- */
    const L = (str, role, px, color, glow) => {
      const p = mkLabel(str, role, px, color, glow)
      this.grp.add(p.mesh)
      return p
    }
    this.labAxis = [
      { p: L('x', 'ui', 34, C.fgDim), at: [1.60, 0.07, 0], show: 'dim' },
      { p: L('y', 'ui', 34, C.fgDim), at: [0.07, 1.05, 0], show: 'dim' },
      { p: L('z', 'ui', 34, C.fgDim), at: [0.09, 0.06, 0.74], show: 'dim' },
    ]
    // π 刻度读数：放在圆**内侧** r=0.42。为什么不在外侧：外侧下端的字会落进歌词带
    // （0.885H = 世界 y ≈ −0.76），而内侧四个方向的字最高只到 |y| = 0.42，安全且仍与刻度对齐。
    this.labPi = [
      { p: L('π/2', 'label', 26, C.cyan), at: [0, 0.42, 0.02] },
      { p: L('π', 'label', 26, C.cyan), at: [-0.44, 0, 0.02] },
      { p: L('3π/2', 'label', 26, C.cyan), at: [0, -0.42, 0.02] },
      { p: L('2π', 'label', 26, C.cyan), at: [0.44, 0, 0.02] },
    ]
    // 真实计算：屏幕上读出的周长就是 2πr（§"出现的数字必须来自真实计算"）
    this.labC = L(`C = 2πr = ${CIRC.toFixed(4)}  (r = ${R.toFixed(2)})`, 'formula', 80, C.fg)
    this.labC.mesh.position.set(0, 0.84, 0.34)
    this.labSin = L('y = sin x', 'ui', 34, C.teal)
    this.labInf = L('x → ∞', 'formula', 80, C.teal)
    this.labInf.mesh.position.set(-1.20, 0.80, 0.34)
    this.labWall = L('x = L', 'ui', 34, C.red)
    this.labWall.mesh.position.set(WALL_X - 0.34, 0.88, 0.34)
    this.labLim = L('lim f(x) = M', 'formula', 80, C.green)
    this.labLim.mesh.position.set(0.35, 0.72, 0.34)
    // ε-δ 定义拆三行：单行 25 字符按 80px 要 1700px 宽，会横穿整个 ∞；
    // 拆行后每行 ≤ 1.6 世界单位，正好落在画面左栏（右栏留给墙与 ∞）。
    this.labEps = [
      L('∀ε>0 ∃δ>0', 'formula', 80, C.green),
      L('0<|x−L|<δ ⇒', 'formula', 80, C.green),
      L('|f(x)−M|<ε', 'formula', 80, C.green),
    ]
    this.labEps[0].mesh.position.set(-0.98, 0.44, 0.34)
    this.labEps[1].mesh.position.set(-0.84, 0.22, 0.34)
    this.labEps[2].mesh.position.set(-0.90, 0.00, 0.34)

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

    /* ================= ③ 单位圆 + π 刻度 ================= */
    const ringOn = clamp(span(t, TL.circle.t - 0.35, TL.circle.t + 0.05)) * (1 - clamp(span(t, TL.sine.t - 0.5, TL.sine.t + 0.3)))
    this.ring.visible = ringOn > 0.01
    if (this.ring.visible) {
      this.ringMat.opacity = ringOn * 0.95 * alive
      this.ring.scale.setScalar(0.9 + 0.1 * outBack(clamp(span(t, TL.circle.t - 0.35, TL.circle.t + 0.25))))
    }

    const tickOn = clamp(span(t, TL.circle.t - 0.15, TL.circle.t + 0.3))
    this.ticks.object.visible = tickOn > 0.01 && alive > 0.01
    if (this.ticks.object.visible) {
      this.ticks.material.opacity = clamp(tickOn * 0.95)
      this.ticks.update(
        (i) => {
          const a = (i / TICKS) * TAU
          const rr = R + 0.035 + (i % 3 === 0 ? 0.012 : 0)
          return [Math.cos(a) * rr, Math.sin(a) * rr, 0]
        },
        // 逐格亮起：亮点绕到时那一格才亮（§3 段 C "π 刻度逐格亮起"）
        (i) => (i / TICKS <= orb.reveal + 1e-6 ? 1 : 0.12),
        (i) => {
          const on = i / TICKS <= orb.reveal + 1e-6
          return on ? (i % 3 === 0 ? 0x8ff0a4 : 0x00e5ff) : 0x0d2230
        }
      )
    }
    for (const l of this.labPi) {
      l.p.mesh.visible = tickOn > 0.01 && alive > 0.01
      l.p.material.opacity = tickOn * 0.9 * alive
    }

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

    /* ================= ⑤ 坐标轴 / 网格 / 原点 ================= */
    const axOn = clamp(span(t, TL.dimension.t - 0.32, TL.dimension.t + 0.35)) * (1 - clamp(span(t, this.end - 0.55, this.end - 0.05)))
    this.axes.visible = axOn > 0.01
    this.grid.visible = axOn > 0.01
    if (this.axes.visible) {
      this.axisMat.opacity = 0.75 * axOn * alive
      this.coneMat.opacity = 0.95 * axOn * alive
      this.gridMat.opacity = 0.34 * axOn * alive
    }
    for (const l of this.labAxis) {
      l.p.mesh.visible = axOn > 0.01 && alive > 0.01
      l.p.material.opacity = axOn * 0.85 * alive
      l.p.mesh.position.set(l.at[0], l.at[1], l.at[2])
    }

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

    /* ================= ⑧ 文字（§0.5 字号；位置随状态走） ================= */
    const labOn = (p, a) => {
      p.mesh.visible = a > 0.01
      if (a > 0.01) p.material.opacity = clamp(a)
    }
    // 2πr：circle/circumference 两拍出现（真实周长读数）
    const cOn = clamp(span(t, TL.circumference.t - 0.55, TL.circumference.t - 0.05)) * (1 - clamp(span(t, TL.sine.t + 0.2, TL.sine.t + 0.8)))
    labOn(this.labC, cOn * alive * 0.95)
    // y = sin x：正弦到位后出现，跟随波峰位置
    const sinOn = clamp(span(t, TL.sine.t - 0.1, TL.sine.t + 0.5)) * (1 - clamp(span(t, TL.infinity.t - 0.2, TL.infinity.t + 0.4)))
    labOn(this.labSin, sinOn * alive)
    if (sinOn > 0.01) this.labSin.mesh.position.set(-0.62, SINE_AMP * 0.98 + 0.16, 0.34)
    // x → ∞：冲向无穷时出现（本段读数的"无穷"那一半）
    const infOn = clamp(span(t, TL.infinity.t - 0.25, TL.infinity.t + 0.35)) * (1 - clamp(span(t, TL.limitations.t - 0.2, TL.limitations.t + 0.4)))
    labOn(this.labInf, infOn * alive)
    if (infOn > 0.01) {
      this.labInf.mesh.position.set(-1.20, 0.80 + 0.03 * Math.sin(t * 3), 0.34)
    }
    // lim f(x) = M 与 ε-δ：墙出现后一直读到段末
    const limOn = clamp(span(t, TL.limitations.t - 0.45, TL.limitations.t + 0.25))
    labOn(this.labWall, wallOn * alive * 0.95)
    labOn(this.labLim, limOn * alive)
    if (limOn > 0.01) this.labLim.mesh.position.set(0.35, 0.72 + 0.012 * Math.sin(t * 2.2), 0.34)
    for (let i = 0; i < this.labEps.length; i++) {
      labOn(this.labEps[i], (limOn - i * 0.12) * alive)
    }

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
          `C=2πr ${CIRC.toFixed(4)}  wpp ${((this.labC.width / this.labC.mesh.scale.x) * ppu / 1.48).toFixed(0)}px wide`,
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
