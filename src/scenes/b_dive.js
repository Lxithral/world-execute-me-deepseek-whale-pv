// src/scenes/b_dive.js — 段 B 0:14.5–0:29.7 序曲飞行（纯器乐，3D 重做）
//
// FIX 对本段的要求（逐条落实，行末标注出处）：
//   · §3 段 B：**一条连续相机轨道**飞过一条"深海展馆隧道"，沿途景物按节拍**成排出现**
//     （不要鲸鱼娘到处游荡）。展品顺序固定为：大字号多语言代码墙、3D 公式环、双摆、
//     洛伦兹轨迹管、超立方体、曼德博平面、波包、傅里叶本轮、螺旋星系、黑洞网格、
//     一个很小的心形（伏笔）。
//   · §3 段 B：每个**小节首拍**飞过一道发光门环；标题 world.execute(me); 由乱码**解码**成
//     3D 巨字，出现在 0:20–0:24；0:28.5 相机拉远，所有展品**溶解回蜂群**。
//   · §3 段 B + §2.8：画面密度要满，背景代码与海雪要大、要多（代码墙 fontPx 92，
//     最近一层屏幕上一行 ≈79px；海雪用真实 token 字形，≥26px 等效）。
//   · §5.6 针对本段："深海渐变太暗、靠立绘撑亮度" → 底色提亮到 #0b3a5a→#04202f，
//     加**体积光柱**与**门环自发光**，**不依赖立绘**。
//
// 本文件同时遵守几条全片硬约束：
//   · **不出现鲸鱼娘立绘**：全文件不碰 ctx.whale / sprite 相关 API（§3 段 B 明文要求）。
//   · **主体一律 3D**：所有画面输出都是挂在 ctx.three.stage3d 上的 Three 对象
//     （mesh / InstancedMesh / Points / ShaderMaterial）。Canvas2D 只出现在
//     "文字 → 画布贴图"（经 text() 入口，受 §0.5 字号守卫）与 ?debug 读数里，
//     不再直接往 ctx.g 上画主体。
//   · **时间只来自锚点**：全部事件走 ctx.cues.sec('B', key)（§2.2），展位与门环落在
//     由 sync.beats 构成的节拍网格上，网格相位由 gate1/gate2/gate3 三个锚点标定。
//   · **相机属于 rig.js**：本文件不新建相机；为了把"相机在 t 时刻在哪"写成纯函数，
//     只**只读**引用 rig.js 的 cameraAt()（不改 CAMERA_KEYS，全片硬切仍是 3 处）。
//   · 运动一律走 ease.js 的缓动（§0.6），没有任何线性位移。
//
// 旧文件的"真实计算"按 §5.0（旧场景 = 素材库）迁移并重新做成 3D：
//   · 乱码字形表 GLYPHS、token 词表 TOKEN_WORDS、标题逐字解码的节奏；
//   · 海雪（下落）与"气泡比特"（上浮）两层 GPU 粒子（three_util 的 createField）；
//   · 按起音点/节拍驱动的时序（改写成 §2.2 的锚点 + 节拍网格）。
//   删除：所有 Canvas2D 主体绘制、立绘的 wake/游过、旧线框立方体的爆散。

import * as THREE from 'three'
import { C } from '../core/palette.js'
import { clamp, span, smoothstep, inOutCubic, outBack, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text } from '../ui/text.js'
import { textPlane, glowTube, pxPerUnitAt, createLightRigSafe } from '../lib/scene3d.js'
import { codeWall } from '../lib/codewall.js'
import { createProp } from '../lib/props/index.js'
import { createField } from '../lib/three_util.js'
import { cameraAt, CAMERA_KEYS } from '../core/rig.js'
import { timeline } from './_seg.js'
import { pulseAt } from '../core/impact.js'

const SEG = 'B'
const START = 14.5
const END = 29.7
/** 公式类文字的世界高度：0.15 → 画布字号 81px ≥ §0.5 的 formula 下限 80px */
const FORMULA_H = 0.15
/** 展品标牌（中文名）的世界高度：0.085 → 画布字号 46px ≥ ui 下限 34px */
const PLACARD_H = 0.085

/* ------------------------------------------------------------------ *
 * 0) 迁移来的素材（§5.0：旧段 B 的真实计算照旧沿用）
 * ------------------------------------------------------------------ */

const TITLE = 'world.execute(me);'
/** 乱码解码用的字形表（旧段 B 原样迁移） */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________01'
/** 海雪里飘落的真实 token 字形（旧段 B 的 TOKEN_WORDS 迁移） */
const TOKEN_WORDS = ['fn', 'id', 'kv', 'tok', 'eos', 'log', 'seq', 'attn', 'mask', 'rope', 'ln', 'emb']

/** 3D 公式环上的公式：只放**短**真公式（长公式在环上会互相重叠；字号见 FORMULA_H） */
const RING_FORMULAS = [
  'C = 2πr',
  'F = m·a',
  'e^{iπ}+1=0',
  'E = mc²',
  'Σ1/n²=π²/6',
  '∇·E = ρ/ε₀',
  'a²+b²=c²',
  'lim f = ∞',
  'sin²+cos²=1',
  'd/dx eˣ = eˣ',
]

/** 展品名（展馆标牌；走 text() 的 ui 档） */
// ⚠️ FIX_V4 §0.2：画面上不得出现任何标签或调试名，**包括中文标签**（原文举例正是
// "钟表""开关""环面结""正多面体""终端屏""莫比乌斯带"）。§1.3 也要求删掉展品的全部标签。
// 所以这张表**不再用于绘制**（`buildBay` 已不再被调用）；保留它只是为了记录每件展品
// 在代码里的 key 对应什么中文名，方便日后对照 REVIEW 文档。任何情况下都不要拿它去画字。
const EX_NAMES = {
  formula: '公式环',
  pendulum: '双摆',
  lorenz: '洛伦兹吸引子',
  tesseract: '超立方体',
  mandelbrot: '曼德博集',
  packet: '波包',
  fourier: '傅里叶本轮',
  galaxy: '螺旋星系',
  blackhole: '黑洞 · 引力透镜',
  heart: '心形',
}

/* ------------------------------------------------------------------ *
 * 1) 共享着色器（全部程序生成，不引入外部贴图）
 * ------------------------------------------------------------------ */

/** 深海渐变穹顶：§5.6 指定的 #0b3a5a → #04202f */
const BG_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const BG_FRAG = `
uniform vec3 uTop; uniform vec3 uBot; uniform float uScroll; uniform float uGlow;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBot, uTop, pow(h, 0.85));
  col += uTop * 0.55 * pow(h, 4.0);                                   // 水面方向更亮
  float band = sin(vDir.x * 2.6 + uScroll * 0.06) * sin(vDir.y * 3.1 - uScroll * 0.041);
  col += vec3(0.020, 0.055, 0.080) * max(0.0, band) * h;               // 缓慢游动的亮带
  col += vec3(0.05, 0.11, 0.15) * pow(max(0.0, vDir.y), 6.0) * (0.7 + 0.3 * sin(uScroll * 0.2));
  gl_FragColor = vec4(col * uGlow, 1.0);
}`

const UV_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

/** 体积光柱：软边加色光带，顶部亮、往下淡出（§5.6 点名的"体积光柱"） */
const SHAFT_FRAG = `
uniform vec3 uColor; uniform float uAlpha; uniform float uSoft;
varying vec2 vUv;
void main(){
  float ex = smoothstep(0.0, uSoft, vUv.x) * (1.0 - smoothstep(1.0 - uSoft, 1.0, vUv.x));
  float ey = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.25);
  float a = ex * (0.28 + 0.72 * ey) * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`

/** 辉光盘：以 uR0 为半径的高斯环，带角向不均匀（门环的"电流感"） */
const GLOW_FRAG = `
uniform vec3 uColor; uniform float uAlpha; uniform float uR0; uniform float uW; uniform float uSpin;
varying vec2 vUv;
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float a = exp(-pow(abs(r - uR0) / uW, 1.5));
  float ang = atan(q.y, q.x);
  a *= 0.72 + 0.28 * sin(ang * 6.0 + uSpin);
  a *= uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`

/** 曼德博平面：逃逸时间着色（真实迭代，不是贴图） */
const MANDEL_FRAG = `
uniform vec2 uCenter; uniform float uZoom; uniform float uAlpha;
varying vec2 vUv;
void main(){
  vec2 c = uCenter + (vUv - 0.5) * uZoom * vec2(1.6, 1.0);
  vec2 z = vec2(0.0);
  float it = 0.0;
  for (int i = 0; i < 48; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 64.0) break;
    it += 1.0;
  }
  float m = it / 48.0;
  vec3 col = mix(vec3(0.02, 0.05, 0.11), vec3(0.10, 0.55, 0.85), smoothstep(0.05, 0.5, m));
  col = mix(col, vec3(1.0, 0.80, 0.40), smoothstep(0.55, 0.9, m));
  col = mix(col, vec3(0.92, 0.98, 1.0), smoothstep(0.9, 1.0, m));
  if (it >= 47.5) col = vec3(0.01, 0.02, 0.045);                        // 集合内部
  // ---- §7 段 B：「曼德博平面**限制曝光**」 ----
  // 旧版把逃逸边界的颜色推到 (0.92,0.98,1.0)（近乎纯白），再乘段 B 的高 exposure key
  // （t=20 附近约 1.58）→ 成片过曝。F3 的记录就是「0:20 附近过曝成大片白」。
  // 这里做一次 Reinhard 型**软限幅**：col/(1+col*k)。它对高光的压缩远大于暗部，
  // 所以色相与层次都保留，只是峰值被压下来，不再有纯白块。
  // k 取 0.35（不是 0.85）：§6 除了"过曝 ≤2%"还有**平均亮度 ≥0.10**的下限，
  // 压得太狠会把整段的平均亮度按到线下。k=0.35 把峰值从 0.98 压到 0.73 ——
  // 足够消掉"大片白"，又基本不动中低亮度区域。
  const float MANDEL_EXPO_LIMIT = 0.35;
  col = col / (1.0 + col * MANDEL_EXPO_LIMIT);
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}`

/** 黑洞网格：网格线按 1/r² 外推 = 引力透镜；中心是视界阴影 + 光子环 */
const BH_FRAG = `
uniform float uAlpha; uniform float uGrid; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 q = (vUv - 0.5) * vec2(1.62, 1.0);
  float r = length(q) + 1e-4;
  float bend = 0.030 / (r * r + 0.010);
  vec2 q2 = q * (1.0 + bend);
  vec2 g = abs(fract(q2 * uGrid + vec2(0.0, uTime * 0.02)) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));
  float ring = exp(-pow(abs(r - 0.135) / 0.017, 2.0));
  float shadow = smoothstep(0.112, 0.138, r);
  vec3 col = vec3(0.32, 0.70, 1.00) * line * 0.85 + vec3(0.80, 0.92, 1.00) * ring * 1.2;
  col *= shadow;
  col += vec3(0.02, 0.05, 0.09) * (1.0 - shadow);
  float edge = 1.0 - smoothstep(0.40, 0.50, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
  gl_FragColor = vec4(col * uAlpha * edge, uAlpha * edge);
}`

/** 吸积盘：加色椭圆环，切向拖尾由 sin 叠加给出 */
const DISK_FRAG = `
uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float ang = atan(q.y, q.x);
  float swirl = 0.55 + 0.45 * sin(ang * 5.0 - uTime * 2.2 + r * 9.0);
  float a = exp(-pow(abs(r - 0.55) / 0.22, 2.0)) * swirl;
  a *= 1.0 - smoothstep(0.85, 1.0, r);
  a *= uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`

/* ------------------------------------------------------------------ *
 * 2) 纯函数工具：里程 / 节拍网格 / 雾
 * ------------------------------------------------------------------ */

/**
 * 全段总里程（世界单位）。取 52：配合 0.75u+0.25u² 的分配，
 * 相邻展位（每 2 拍）在空间上相距 2.4–4.0 世界单位 —— 一拍一件不会互相穿插。
 */
const TRAVEL_TOTAL = 52

/** 前进里程 D(t)：单调、**带加速**（§0.6 禁线性），前段 ≈2.6、后段 ≈4.2 世界单位/秒 */
function travelAt(t) {
  const u = clamp(span(t, START, END))
  return TRAVEL_TOTAL * (0.75 * u + 0.25 * u * u)
}

/**
 * 段内节拍网格（§2.2：纯器乐段用 beats/onsets 网格 + 段落起止）。
 * 门环相位由 gate1 锚点标定：找与 gate1 最近的拍 → 每 4 拍一小节、每 2 拍一个"展位"。
 * 于是"每小节首拍飞过一道门环"里**没有任何绝对秒数**。
 */
function beatGridOf(sync, start, end, gateT) {
  const all = sync && sync.beats ? sync.beats : null
  const list = []
  if (all && all.length) {
    for (let i = 0; i < all.length; i++) {
      const tt = all[i]
      if (tt < start - 1e-6) continue
      if (tt >= end) break
      list.push({ t: tt, i })
    }
  }
  const mod = (v, m) => ((v % m) + m) % m
  let gateI = list.length ? list[0].i : 0
  if (list.length) {
    let best = Infinity
    for (const b of list) {
      const d = Math.abs(b.t - gateT)
      if (d < best) {
        best = d
        gateI = b.i
      }
    }
  } else {
    // 兜底：sync 还没加载时按 128.6BPM 合成网格（保证 render 不崩，且仍是节拍网格）
    for (let k = 0; start + k * 0.4667 < end; k++) list.push({ t: start + k * 0.4667, i: k })
  }
  const bars = list.filter((b) => mod(b.i - gateI, 4) === 0)
  const slots = list.filter((b) => mod(b.i - gateI, 2) === 0 && b.i >= gateI)
  let sum = 0
  let n = 0
  for (let k = 1; k < list.length; k++) {
    sum += list[k].t - list[k - 1].t
    n++
  }
  return { list, bars, slots, beatDt: n ? sum / n : 0.4667, gateI }
}

/**
 * FIX §3 段 B 的"0:28.5 相机拉远"：它其实**就是 rig.js 里相机开始后拉的那一段**。
 * 这里不写死 28.5，而是从 CAMERA_KEYS 里找出"下一个键的 z 明显变大"（= 开始后拉）的那个键。
 */
function pullBackKeyT(keys, start, end) {
  for (let k = 0; k + 1 < keys.length; k++) {
    const a = keys[k]
    const b = keys[k + 1]
    if (b.pos[2] - a.pos[2] > 0.5 && a.t >= start - 0.8 && a.t <= end) return a.t
  }
  return end - 1.2
}

/** 距离雾：远处淡入、掠过相机时淡出。展品与门环共用 → "一排排从雾里出现" */
function fogAt(dist) {
  return clamp((1 - span(dist, 6.5, 15)) * span(dist, 0.7, 1.5))
}

/** 加色自发光材质（统一 depthWrite=false，避免加法混合把遮挡关系弄乱） */
function addMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

/** 高斯辉光盘（RingGeometry / CircleGeometry 都按外接框给 UV） */
function glowPlane(geo, color, { uR0 = 0, uW = 0.3, alpha = 0.6, spin = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: alpha },
      uR0: { value: uR0 },
      uW: { value: uW },
      uSpin: { value: spin },
    },
    vertexShader: UV_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geo, mat)
}

/* ------------------------------------------------------------------ *
 * 3) 场景构件：穹顶 / 光柱 / 海雪 / 门环 / 展位
 * ------------------------------------------------------------------ */

/** 深海穹顶（BackSide 球）：整屏底色，depthTest=false 永远垫在最底下 */
function buildBackdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color('#0b3a5a') }, // §5.6 指定
      uBot: { value: new THREE.Color('#04202f') }, // §5.6 指定
      uScroll: { value: 0 },
      uGlow: { value: 1 },
    },
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), mat)
  mesh.name = 'b:backdrop'
  mesh.renderOrder = -100
  mesh.frustumCulled = false
  return {
    object: mesh,
    update(t, env) {
      mat.uniforms.uScroll.value = env.D
      // 溶解之后海本身要更亮：蜂群在段 B 只有 alpha 0.16，撑不起亮度（§5.6）
      mat.uniforms.uGlow.value = 1 + 0.18 * env.disE + 0.06 * env.beatPulse
    },
  }
}

/** 体积光柱：9 条加色光带，跟着相机但只吃 0.22 视差（远景比近景流得慢） */
function buildShafts() {
  const grp = new THREE.Group()
  grp.name = 'b:shafts'
  const items = []
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(i % 3 === 0 ? '#9fe4ff' : '#7fd8ff') },
        uAlpha: { value: 0.15 + hash01(i, 301) * 0.15 },
        uSoft: { value: 0.22 + hash01(i, 302) * 0.2 },
      },
      vertexShader: UV_VERT,
      fragmentShader: SHAFT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    const w = 1.6 + hash01(i, 303) * 2.8
    const h = 16 + hash01(i, 304) * 10
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.renderOrder = 3
    m.frustumCulled = false
    grp.add(m)
    items.push({
      mesh: m,
      mat,
      x: (hash01(i, 305) * 2 - 1) * 6.4,
      y: 6.0 + hash01(i, 306) * 3.0,
      z0: hash01(i, 307) * 26,
      tilt: 0.30 + hash01(i, 308) * 0.34,
      roll: (hash01(i, 309) * 2 - 1) * 0.16,
      base: mat.uniforms.uAlpha.value,
    })
  }
  return {
    object: grp,
    update(t, env) {
      for (let i = 0; i < items.length; i++) {
        const s = items[i]
        const z = env.camZ - 1.0 - (((s.z0 + env.D * 0.22) % 26) + 26) % 26
        s.mesh.position.set(s.x + env.camX * 0.35, s.y, z)
        s.mesh.rotation.set(s.tilt, Math.sin(t * 0.07 + i) * 0.06, s.roll + Math.sin(t * 0.11 + i * 2) * 0.03)
        // 呼吸 + 溶解时整体提亮（画面不能变暗，§5.6）
        s.mat.uniforms.uAlpha.value = s.base * (0.75 + 0.25 * Math.sin(t * 0.5 + i * 1.7)) * (1 + 1.6 * env.disE)
      }
    },
  }
}

/** 海雪：下落的海雪 + 上浮的气泡比特（§2.8：下落与上浮并存） */
function buildSnow() {
  const grp = new THREE.Group()
  grp.name = 'b:snow'
  // extent 4.2：贴在相机前 5 个世界单位处，正好铺满画面（更近的话只有中心一小块能看到）
  const down = createField(2600, 0, { seed: 11, color: '#bfe9ff', extent: 4.2, spread: 8.0, fall: 0.13, size: 7.0 })
  const up = createField(1100, 0, { seed: 12, color: '#5fe3c8', extent: 4.2, spread: 8.0, fall: -0.085, size: 5.5 })
  grp.add(down.object, up.object)
  return {
    object: grp,
    update(t, env) {
      grp.position.set(env.camX * 0.5, 0, env.camZ - 5.0)
      const a = 1 - 0.55 * env.disE
      down.update(t, { alpha: 0.55 * a, size: 7.0 + 3.0 * env.beatPulse })
      up.update(t, { alpha: 0.42 * a, size: 5.5 })
    },
  }
}

/**
 * token 字形海雪：把 TOKEN_WORDS 画成小画布贴图（走 text() 的 codeDeco 档 ≥26px），
 * 每个词一个 InstancedMesh。位置全部由 t 解析求出，随里程向相机流动（背景视差 0.38）。
 */
function buildTokenSnow() {
  const grp = new THREE.Group()
  grp.name = 'b:tokensnow'
  const FONT = 64 // 画布字号 64 ≥ codeDeco 下限 26；屏幕上 ≈ 30–45px（§2.8 的"≥26px 等效"）
  const COUNT = 30
  const layers = []
  for (let w = 0; w < TOKEN_WORDS.length; w++) {
    const word = TOKEN_WORDS[w]
    const cv = document.createElement('canvas')
    const gm = cv.getContext('2d')
    gm.font = `500 ${FONT}px "JetBrains Mono", monospace`
    const tw = Math.ceil(gm.measureText(word).width) + 18
    cv.width = tw
    cv.height = Math.ceil(FONT * 1.3)
    const g = cv.getContext('2d')
    // 统一入口 → 受 §0.5 字号守卫（codeDeco ≥26）
    text(g, word, 9, cv.height * 0.66, { role: 'codeDeco', size: FONT, family: 'code', weight: 500, color: '#cfefff' })
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    const wu = cv.width / 540
    const hu = FONT / 540
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.7, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(wu, hu), mat, COUNT)
    mesh.frustumCulled = false
    mesh.renderOrder = 6
    grp.add(mesh)
    layers.push({ mesh, mat, w })
  }
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  return {
    object: grp,
    update(t, env) {
      const a = 1 - 0.7 * env.disE
      grp.position.set(env.camX * 0.45, 0, 0)
      for (const L of layers) {
        L.mat.opacity = 0.7 * a
        for (let j = 0; j < COUNT; j++) {
          const k = L.w * 1000 + j
          const x0 = (hash01(j, 401 + L.w) * 2 - 1) * 5.6
          const up = hash01(k, 402) > 0.78 // 少数上浮
          const fall = (up ? -0.09 : 0.11) * (0.6 + hash01(k, 403) * 0.9)
          const y = (((hash01(j, 404 + L.w) + t * fall) % 1) + 1) % 1
          const yy = -2.9 + y * 5.8
          // z：随里程向相机流动；贴近相机时用窗口函数压成 0，避免"贴脸消失"的跳变
          const zr = (((hash01(k, 405) * 12 + env.D * 0.38) % 12) + 12) % 12
          const z = env.camZ - 1.2 - zr
          const dist = env.camZ - z
          const win = clamp(1 - span(dist, 8.5, 11.5)) * span(dist, 0.6, 1.6)
          const sc = win <= 0.002 ? 0.0008 : win * (0.75 + 0.5 * hash01(k, 406))
          P.set(x0 + env.camX * 0.6, yy, z)
          Q.identity()
          S.set(sc, sc, sc)
          M.compose(P, Q, S)
          L.mesh.setMatrixAt(j, M)
        }
        L.mesh.instanceMatrix.needsUpdate = true
      }
    },
  }
}

/** 发光门环：自发光小环 + 高斯辉光盘 + 12 颗铆钉（§5.6 要求"门环自发光"） */
function buildGate(ringRadius = 2.05) {
  const grp = new THREE.Group()
  grp.name = 'b:gate'
  const coreMat = addMat('#dff6ff', 0.95)
  const core = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.055, 6, 72), coreMat)
  // RingGeometry 的 UV 按**外半径**归一 → 内环位置 uR0 = 内/外
  const halo = glowPlane(new THREE.RingGeometry(ringRadius * 0.45, ringRadius * 1.75, 64, 1), '#7fd8ff', {
    uR0: 1 / 1.75, uW: 0.15, alpha: 0.5,
  })
  halo.renderOrder = 4
  const studMat = addMat('#ffd479', 0.9)
  const studs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.075, 0.3), studMat, 12)
  studs.frustumCulled = false
  const M = new THREE.Matrix4()
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    M.makeTranslation(Math.cos(a) * ringRadius, Math.sin(a) * ringRadius, 0)
    studs.setMatrixAt(i, M)
  }
  studs.instanceMatrix.needsUpdate = true
  grp.add(core, halo, studs)
  return {
    object: grp,
    update(t, env, f, flash) {
      grp.scale.setScalar((1 + flash * 0.5) * (1 + 1.9 * env.disE))
      core.rotation.z = t * 0.22
      halo.rotation.z = -t * 0.13
      coreMat.opacity = (0.72 + 0.28 * env.beatPulse + flash * 0.6) * f
      halo.material.uniforms.uAlpha.value = (0.30 + 0.45 * env.beatPulse + flash * 0.9) * f
      halo.material.uniforms.uSpin.value = t * 1.3
      studMat.opacity = 0.85 * f
    },
  }
}

/** 展位：发光边框 + 灯箱底座 + 展品标牌（"成排出现"里的那一"排"） */
function buildBay(w, h, color, label) {
  const grp = new THREE.Group()
  grp.name = 'b:bay'
  const W = w / 2
  const H = h / 2
  const r = 0.05
  const frame = glowTube(
    [
      [-W + r, -H], [W - r, -H], [W, -H + r], [W, H - r], [W - r, H],
      [-W + r, H], [-W, H - r], [-W, -H + r], [-W + r, -H],
    ],
    { radius: 0.0075, color, tubular: 140 }
  )
  grp.add(frame.object)
  const plinthMat = addMat(color, 0.7)
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.022, 0.16), plinthMat)
  plinth.position.set(0, -H - 0.055, 0)
  grp.add(plinth)
  let placard = null
  if (label) {
    placard = textPlane(label, {
      role: 'ui', height: PLACARD_H, weight: 500, family: 'sans', color: '#d8ecff', glow: 0.3,
    })
    placard.mesh.position.set(0, -H - 0.17, 0.02)
    grp.add(placard.mesh)
  }
  return { object: grp, frame, plinth, placard }
}

/* ------------------------------------------------------------------ *
 * 4) 展品（每件都是真实计算 + 3D 几何）
 * ------------------------------------------------------------------ */

/** ① 3D 公式环：10 条短公式沿圆轨道公转，自身保持水平（旋转的文字读不出来） */
function buildFormulaRing() {
  const grp = new THREE.Group()
  grp.name = 'b:formulaRing'
  const items = []
  const R = 0.95
  for (let i = 0; i < RING_FORMULAS.length; i++) {
    const tp = textPlane(RING_FORMULAS[i], {
      role: 'formula', height: FORMULA_H, weight: 600, family: 'code', color: '#d8f2ff', glow: 0.45,
    })
    grp.add(tp.mesh)
    items.push({ tp, a0: (i / RING_FORMULAS.length) * TAU, z: (i % 2 ? 1 : -1) * 0.34 })
  }
  const ringA = glowTube(
    Array.from({ length: 49 }, (_, k) => {
      const a = (k / 48) * TAU
      return [Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0]
    }),
    { radius: 0.006, color: '#4dd0e1', tubular: 120 }
  )
  const ringB = glowTube(
    Array.from({ length: 49 }, (_, k) => {
      const a = (k / 48) * TAU
      return [Math.cos(a) * 1.36, Math.sin(a) * 1.36, 0]
    }),
    { radius: 0.004, color: '#82aaff', tubular: 120 }
  )
  grp.add(ringA.object, ringB.object)
  return {
    object: grp,
    update(t, env, f) {
      for (const it of items) {
        const a = it.a0 + t * 0.42
        it.tp.mesh.position.set(Math.cos(a) * R, Math.sin(a) * R, it.z + Math.sin(t * 1.1 + it.a0) * 0.05)
        it.tp.mesh.rotation.z = 0
        it.tp.material.opacity = f
      }
      ringA.material.opacity = 0.5 * f
      ringB.material.opacity = 0.32 * f
      grp.rotation.z = t * 0.12
    },
  }
}

/**
 * ② 双摆：RK4 真积分（m1=m2=1, L1=L2=1, g=9.81）预先算成定长轨迹表，
 * 渲染时按 t 取表（仍是 t 的纯函数）。第二摆的轨迹用点阵拖尾显示。
 */
function buildDoublePendulum() {
  const grp = new THREE.Group()
  grp.name = 'b:pendulum'
  const DT = 1 / 240
  const N = Math.round(36 / DT)
  const traj = new Float32Array(N * 2)
  {
    let th1 = 2.2
    let th2 = 1.35
    let w1 = 0
    let w2 = 0
    const G = 9.81
    const acc = (a1, a2, v1, v2) => {
      const d = a1 - a2
      const den = 2 - Math.cos(2 * d)
      const n1 = -G * 2 * Math.sin(a1) - G * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * (v2 * v2 + v1 * v1 * Math.cos(d))
      const n2 = 2 * Math.sin(d) * (v1 * v1 * 2 + G * 2 * Math.cos(a1) + v2 * v2 * Math.cos(d))
      return [n1 / den, n2 / den]
    }
    for (let i = 0; i < N; i++) {
      traj[i * 2] = th1
      traj[i * 2 + 1] = th2
      const [k1a, k1b] = acc(th1, th2, w1, w2)
      const [k2a, k2b] = acc(th1 + w1 * DT * 0.5, th2 + w2 * DT * 0.5, w1 + k1a * DT * 0.5, w2 + k1b * DT * 0.5)
      const [k3a, k3b] = acc(th1 + (w1 + k1a * DT * 0.5) * DT * 0.5, th2 + (w2 + k1b * DT * 0.5) * DT * 0.5, w1 + k2a * DT * 0.5, w2 + k2b * DT * 0.5)
      const [k4a, k4b] = acc(th1 + (w1 + k2a * DT * 0.5) * DT, th2 + (w2 + k2b * DT * 0.5) * DT, w1 + k3a * DT, w2 + k3b * DT)
      th1 += (DT / 6) * (w1 + 2 * (w1 + k1a * DT * 0.5) + 2 * (w1 + k2a * DT * 0.5) + (w1 + k3a * DT))
      th2 += (DT / 6) * (w2 + 2 * (w2 + k1b * DT * 0.5) + 2 * (w2 + k2b * DT * 0.5) + (w2 + k3b * DT))
      w1 += (DT / 6) * (k1a + 2 * k2a + 2 * k3a + k4a)
      w2 += (DT / 6) * (k1b + 2 * k2b + 2 * k3b + k4b)
    }
  }
  const SPAN = 0.62 // 摆总长 2 → 1.24 世界单位
  const angleAt = (tt) => {
    const x = (((tt * 0.55) % 36) + 36) % 36
    const i = Math.floor(x / DT)
    const j = Math.min(N - 1, i + 1)
    const u = x / DT - i
    return [traj[i * 2] * (1 - u) + traj[j * 2] * u, traj[i * 2 + 1] * (1 - u) + traj[j * 2 + 1] * u]
  }
  const rodMat = addMat('#9fe4ff', 0.9)
  const rod1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), rodMat)
  const rod2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), rodMat)
  const bob1Mat = addMat('#7fd8ff', 1)
  const bob2Mat = addMat('#ffd479', 1)
  const bob1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), bob1Mat)
  const bob2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), bob2Mat)
  const pivotMat = addMat('#b8bcc4', 0.8)
  const pivot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), pivotMat)
  pivot.position.y = 0.62
  grp.add(rod1, rod2, bob1, bob2, pivot)
  const TRAIL = 46
  const trailMat = addMat('#ffd479', 0.8)
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.021, 6, 5), trailMat, TRAIL)
  trail.frustumCulled = false
  grp.add(trail)
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  const place = (mesh, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0)
    mesh.scale.set(1, Math.max(1e-4, Math.hypot(dx, dy)), 1)
    mesh.rotation.z = Math.atan2(-dx, dy)
  }
  return {
    object: grp,
    update(t, env, f) {
      const [a1, a2] = angleAt(t)
      const x1 = Math.sin(a1) * SPAN
      const y1 = 0.62 - Math.cos(a1) * SPAN
      const x2 = x1 + Math.sin(a2) * SPAN
      const y2 = y1 - Math.cos(a2) * SPAN
      place(rod1, 0, 0.62, x1, y1)
      place(rod2, x1, y1, x2, y2)
      bob1.position.set(x1, y1, 0)
      bob2.position.set(x2, y2, 0)
      for (let i = 0; i < TRAIL; i++) {
        const [b1, b2] = angleAt(t - i * 0.012)
        P.set(Math.sin(b1) * SPAN + Math.sin(b2) * SPAN, 0.62 - Math.cos(b1) * SPAN - Math.cos(b2) * SPAN, 0)
        Q.identity()
        const k = ((1 - i / TRAIL) * f) / 2
        S.set(k, k, k)
        M.compose(P, Q, S)
        trail.setMatrixAt(i, M)
      }
      trail.instanceMatrix.needsUpdate = true
      rodMat.opacity = 0.85 * f
      bob1Mat.opacity = f
      bob2Mat.opacity = f
      pivotMat.opacity = 0.6 * f
      trailMat.opacity = 0.8 * f
    },
  }
}

/** ③ 洛伦兹轨迹管：RK4 积分 Lorenz(σ=10, ρ=28, β=8/3) → 发光管 + 沿线跑的光点 */
function buildLorenz() {
  const grp = new THREE.Group()
  grp.name = 'b:lorenz'
  const DT = 0.004
  const N = 1400
  const raw = []
  {
    let x = 0.1
    let y = 0
    let z = 0
    const f = (x1, y1, z1) => [10 * (y1 - x1), x1 * (28 - z1) - y1, x1 * y1 - (8 / 3) * z1]
    for (let i = 0; i < N; i++) {
      raw.push([x, y, z])
      const [a1, a2, a3] = f(x, y, z)
      const [b1, b2, b3] = f(x + a1 * DT * 0.5, y + a2 * DT * 0.5, z + a3 * DT * 0.5)
      const [c1, c2, c3] = f(x + b1 * DT * 0.5, y + b2 * DT * 0.5, z + b3 * DT * 0.5)
      const [d1, d2, d3] = f(x + c1 * DT, y + c2 * DT, z + c3 * DT)
      x += (DT / 6) * (a1 + 2 * b1 + 2 * c1 + d1)
      y += (DT / 6) * (a2 + 2 * b2 + 2 * c2 + d2)
      z += (DT / 6) * (a3 + 2 * b3 + 2 * c3 + d3)
    }
  }
  // 归一化到世界单位：z 的跨度 0–50 → 1.5 世界单位高
  const S = 1.5 / 52
  const pts = raw.map((p) => [p[0] * S, (p[2] - 25) * S, p[1] * S])
  const tube = glowTube(pts, { radius: 0.0075, color: '#82aaff', tubular: 420 })
  grp.add(tube.object)
  const headMat = addMat('#ffffff', 1)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), headMat)
  grp.add(head)
  return {
    object: grp,
    update(t, env, f) {
      const n = pts.length
      const idx = Math.floor((((t * 190) % n) + n) % n)
      head.position.set(pts[idx][0], pts[idx][1], pts[idx][2])
      head.scale.setScalar(0.8 + 0.5 * env.beatPulse)
      tube.material.opacity = 0.85 * f
      headMat.opacity = f
      grp.rotation.y = t * 0.22
      grp.rotation.x = Math.sin(t * 0.3) * 0.12
    },
  }
}

/**
 * ④ 超立方体：16 顶点 / 32 条棱，4D 旋转 + 4D→3D 透视投影后写成实例化圆柱。
 * （旧段 E 的 createHypercube 用 1px 线；这里换成有粗细的实例化棱，符合"3D 重做"。）
 */
function buildTesseract() {
  const grp = new THREE.Group()
  grp.name = 'b:tesseract'
  const S = 0.5
  const verts = []
  for (let i = 0; i < 16; i++) verts.push([(i & 1 ? S : -S), (i & 2 ? S : -S), (i & 4 ? S : -S), (i & 8 ? S : -S)])
  const edges = []
  for (let i = 0; i < 16; i++) {
    for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b)
      if (j > i) edges.push([i, j])
    }
  }
  const edgeMat = addMat('#c792ea', 0.85)
  const beadMat = addMat('#f0d8ff', 0.95)
  const edgeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5), edgeMat, edges.length)
  const beadMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.034, 0), beadMat, 16)
  edgeMesh.frustumCulled = false
  beadMesh.frustumCulled = false
  grp.add(edgeMesh, beadMesh)
  const proj = new Float32Array(48)
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const Up = new THREE.Vector3(0, 1, 0)
  const Dir = new THREE.Vector3()
  const Scl = new THREE.Vector3()
  const rot = (v, i, j, a) => {
    const c = Math.cos(a)
    const s = Math.sin(a)
    const vi = v[i]
    const vj = v[j]
    v[i] = vi * c - vj * s
    v[j] = vi * s + vj * c
  }
  return {
    object: grp,
    update(t, env, f) {
      const PW = 2.0
      for (let k = 0; k < 16; k++) {
        const v = verts[k].slice()
        rot(v, 0, 3, t * 0.42)
        rot(v, 1, 2, t * 0.31)
        rot(v, 0, 1, t * 0.19)
        const w = PW / (PW + v[3])
        proj[k * 3] = v[0] * w
        proj[k * 3 + 1] = v[1] * w
        proj[k * 3 + 2] = v[2] * w
        P.set(proj[k * 3], proj[k * 3 + 1], proj[k * 3 + 2])
        Q.identity()
        const sc = 0.7 + 0.6 * w
        Scl.set(sc, sc, sc)
        M.compose(P, Q, Scl)
        beadMesh.setMatrixAt(k, M)
      }
      for (let e = 0; e < edges.length; e++) {
        const a = edges[e][0]
        const b = edges[e][1]
        P.set(
          (proj[a * 3] + proj[b * 3]) / 2,
          (proj[a * 3 + 1] + proj[b * 3 + 1]) / 2,
          (proj[a * 3 + 2] + proj[b * 3 + 2]) / 2
        )
        Dir.set(proj[b * 3] - proj[a * 3], proj[b * 3 + 1] - proj[a * 3 + 1], proj[b * 3 + 2] - proj[a * 3 + 2])
        const len = Dir.length() || 1e-4
        Dir.normalize()
        Q.setFromUnitVectors(Up, Dir)
        Scl.set(1, len, 1)
        M.compose(P, Q, Scl)
        edgeMesh.setMatrixAt(e, M)
      }
      edgeMesh.instanceMatrix.needsUpdate = true
      beadMesh.instanceMatrix.needsUpdate = true
      edgeMat.opacity = (0.6 + 0.35 * env.beatPulse) * f
      beadMat.opacity = 0.85 * f
    },
  }
}

/** ⑤ 曼德博平面：逃逸时间着色器，缓慢向"海马谷"推进（真实迭代） */
function buildMandelbrot() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Vector2(-0.743643887037151, 0.13182590420533) },
      uZoom: { value: 0.004 },
      uAlpha: { value: 1 },
    },
    vertexShader: UV_VERT,
    fragmentShader: MANDEL_FRAG,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.06), mat)
  return {
    object: mesh,
    update(t, env, f, local) {
      mat.uniforms.uZoom.value = 0.0055 * Math.exp(-0.45 * clamp(local + 1.3, 0, 4.5))
      mat.uniforms.uAlpha.value = f
    },
  }
}

/** ⑥ 波包：高斯包络 × 余弦载波（真实表达式），用点阵显示振幅 */
function buildPacket() {
  const grp = new THREE.Group()
  grp.name = 'b:packet'
  const N = 88
  const beadMat = addMat('#a5e075', 0.95)
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 6, 5), beadMat, N)
  beads.frustumCulled = false
  grp.add(beads)
  const axisMat = addMat('#5f7d9a', 0.7)
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.9, 4), axisMat)
  axis.rotation.z = Math.PI / 2
  grp.add(axis)
  const label = textPlane('A·e^{−(x−vt)²/2σ²}·cos(kx−ωt)', {
    role: 'formula', height: 0.155, weight: 600, family: 'code', color: '#cdf3a8', glow: 0.35,
  })
  label.mesh.position.set(0, -0.66, 0.05)
  grp.add(label.mesh)
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  return {
    object: grp,
    update(t, env, f) {
      const A = 0.42
      const sig = 0.30
      const k = 15
      const w = 8.4
      const v = 0.62
      const x0 = -1.35 + ((((t * v) % 2.7) + 2.7) % 2.7)
      for (let i = 0; i < N; i++) {
        const x = -1.42 + (i / (N - 1)) * 2.84
        const envl = Math.exp(-((x - x0) * (x - x0)) / (2 * sig * sig))
        const y = A * envl * Math.cos(k * x - w * t)
        const sc = 0.25 + 1.15 * envl
        P.set(x, y, 0)
        Q.identity()
        S.set(sc, sc, sc)
        M.compose(P, Q, S)
        beads.setMatrixAt(i, M)
      }
      beads.instanceMatrix.needsUpdate = true
      beadMat.opacity = (0.55 + 0.4 * env.beatPulse) * f
      axisMat.opacity = 0.45 * f
      label.material.opacity = f
    },
  }
}

/**
 * ⑦ 傅里叶本轮：方波的傅里叶级数（奇数谐波 r_n = 4/(πn)）。
 * 上半部是**本轮链**（每个谐波一个圆 + 连杆），下半部是同一个级数展开成
 * "幅值–相位"曲线：y = Σ r_n sin(nωt)，也就是被逼近出来的方波；
 * 一颗游标同时扫过曲线，把两半的关系讲清楚。
 */
function buildFourier() {
  const grp = new THREE.Group()
  grp.name = 'b:fourier'
  const HARMS = [1, 3, 5, 7, 9]
  const R0 = 4 / Math.PI
  const rad = (n) => (R0 / n) * 0.19
  const sq = (a) => {
    let s = 0
    for (const n of HARMS) s += R0 / n * Math.sin(n * a)
    return s
  }
  const rings = []
  const rods = []
  for (let i = 0; i < HARMS.length; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad(HARMS[i]), 0.005, 4, 40), addMat('#4dd0e1', 0.55))
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 4), addMat('#8fd4ff', 0.8))
    grp.add(ring, rod)
    rings.push(ring)
    rods.push(rod)
  }
  const CURVE = 170
  const curveMat = addMat('#ffd479', 0.9)
  const curve = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 5, 4), curveMat, CURVE)
  curve.frustumCulled = false
  grp.add(curve)
  const headMat = addMat('#ffffff', 1)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), headMat)
  grp.add(head)
  const penMat = addMat('#ffffff', 1)
  const pen = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), penMat)
  grp.add(pen)
  const label = textPlane('Σ 4/(πn)·sin(nωt)   n = 1,3,5,7,9', {
    role: 'formula', height: 0.15, weight: 600, family: 'code', color: '#bfe9ff', glow: 0.3,
  })
  label.mesh.position.set(0, -0.78, 0.05)
  grp.add(label.mesh)
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  const placeRod = (mesh, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0)
    mesh.scale.set(1, Math.max(1e-4, Math.hypot(dx, dy)), 1)
    mesh.rotation.z = Math.atan2(-dx, dy)
  }
  const CHAIN_Y = 0.34
  const GRAPH_Y = -0.42
  const GRAPH_A = 0.2
  return {
    object: grp,
    update(t, env, f) {
      const a0 = t * 1.15
      let cx = 0
      let cy = 0
      for (let i = 0; i < HARMS.length; i++) {
        const n = HARMS[i]
        const r = rad(n)
        const a = n * a0
        const nx = cx + r * Math.cos(a)
        const ny = cy + r * Math.sin(a)
        rings[i].position.set(cx, CHAIN_Y + cy, 0)
        placeRod(rods[i], cx, CHAIN_Y + cy, nx, CHAIN_Y + ny)
        cx = nx
        cy = ny
      }
      pen.position.set(cx, CHAIN_Y + cy, 0.01)
      for (let i = 0; i < CURVE; i++) {
        const a = (i / (CURVE - 1)) * TAU
        P.set(-1.32 + (i / (CURVE - 1)) * 2.64, GRAPH_Y + GRAPH_A * sq(a), 0)
        Q.identity()
        S.set(0.75, 0.75, 0.75)
        M.compose(P, Q, S)
        curve.setMatrixAt(i, M)
      }
      curve.instanceMatrix.needsUpdate = true
      const ph = ((a0 % TAU) + TAU) % TAU
      head.position.set(-1.32 + (ph / TAU) * 2.64, GRAPH_Y + GRAPH_A * sq(ph), 0.01)
      curveMat.opacity = 0.8 * f
      headMat.opacity = f
      penMat.opacity = f
      for (const r of rings) r.material.opacity = 0.45 * f
      for (const r of rods) r.material.opacity = 0.65 * f
      label.material.opacity = f
      grp.scale.setScalar(0.98)
    },
  }
}

/** ⑧ 螺旋星系：对数螺旋 + 差异自转（ω ∝ 1/(r+0.22)），实例化点阵 */
function buildGalaxy() {
  const grp = new THREE.Group()
  grp.name = 'b:galaxy'
  const N = 760
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 5, 4), addMat('#b48cff', 0.95), N)
  mesh.frustumCulled = false
  grp.add(mesh)
  const core = glowPlane(new THREE.CircleGeometry(0.5, 32), '#ffe6b0', { uR0: 0, uW: 0.45, alpha: 0.6 })
  grp.add(core)
  const col = new THREE.Color()
  const base = []
  for (let i = 0; i < N; i++) {
    const arm = i % 3
    const u = Math.pow(hash01(i, 501), 0.62)
    const r = 0.09 + u
    const th = arm * (TAU / 3) + Math.log(r / 0.09) * 2.35 + (hash01(i, 502) - 0.5) * 0.42
    base.push({ r, th, y: (hash01(i, 503) - 0.5) * 0.13 * (1 - u * 0.55), s: 0.5 + hash01(i, 504) * 1.1 })
    // 内核暖白 → 外臂紫蓝
    col.setHSL(0.09 + 0.62 * Math.pow(u, 0.7), 0.55 + 0.3 * u, 0.72 - 0.22 * u)
    mesh.setColorAt(i, col)
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  return {
    object: grp,
    update(t, env, f) {
      grp.scale.setScalar(1.42)
      for (let i = 0; i < N; i++) {
        const b = base[i]
        const th = b.th + t * (0.62 / (b.r + 0.22))
        P.set(Math.cos(th) * b.r, b.y, Math.sin(th) * b.r)
        Q.identity()
        const s = b.s * (0.7 + 0.5 * env.beatPulse)
        S.set(s, s, s)
        M.compose(P, Q, S)
        mesh.setMatrixAt(i, M)
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.material.opacity = 0.85 * f
      core.material.uniforms.uAlpha.value = (0.4 + 0.3 * env.beatPulse) * f
      grp.rotation.set(-0.42, 0, 0.18)
    },
  }
}

/** ⑨ 黑洞网格：引力透镜扭曲的网格 + 视界阴影 + 吸积盘 + 喷流 */
function buildBlackHole() {
  const grp = new THREE.Group()
  grp.name = 'b:blackhole'
  const gridMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 }, uGrid: { value: 9.0 }, uTime: { value: 0 } },
    vertexShader: UV_VERT,
    fragmentShader: BH_FRAG,
    transparent: true,
    depthWrite: false,
  })
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.06), gridMat)
  grid.renderOrder = 2
  grp.add(grid)
  const diskMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffb454') }, uAlpha: { value: 0.9 }, uTime: { value: 0 } },
    vertexShader: UV_VERT,
    fragmentShader: DISK_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.72), diskMat)
  disk.position.z = 0.02
  disk.rotation.x = -0.28
  grp.add(disk)
  const jetMat = addMat('#9fe4ff', 0.4)
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.075, 1.5, 8, 1, true), jetMat)
  jet.position.set(0, 0.85, 0)
  grp.add(jet)
  const jet2 = new THREE.Mesh(new THREE.ConeGeometry(0.075, 1.5, 8, 1, true), jetMat)
  jet2.position.y = -0.85
  jet2.rotation.z = Math.PI
  grp.add(jet2)
  const label = textPlane('r_s = 2GM/c²', {
    role: 'formula', height: FORMULA_H, weight: 600, family: 'code', color: '#ffd9a0', glow: 0.35,
  })
  label.mesh.position.set(0, -0.8, 0.05)
  grp.add(label.mesh)
  return {
    object: grp,
    update(t, env, f) {
      gridMat.uniforms.uAlpha.value = f
      gridMat.uniforms.uTime.value = t
      diskMat.uniforms.uAlpha.value = (0.7 + 0.3 * env.beatPulse) * f
      diskMat.uniforms.uTime.value = t
      jetMat.opacity = 0.26 * f
      label.material.opacity = f
      grp.rotation.z = t * 0.06
      grp.rotation.y = Math.sin(t * 0.24) * 0.16
    },
  }
}

/**
 * ⑩ 很小的心形（§3 段 B 的"伏笔"）：复用物件库的低多边形心脏（§2.7），
 * 刻意做小（心高 ≈0.15 世界单位），用一盏聚光 + 光圈把它从黑暗里点出来。
 */
function buildHeart(renderer) {
  const grp = new THREE.Group()
  grp.name = 'b:heart'
  const heart = createProp('heart', { renderer, scale: 0.17 })
  grp.add(heart.object)
  const pool = glowPlane(new THREE.CircleGeometry(0.17, 24), '#ff8fa3', { uR0: 0, uW: 0.5, alpha: 0.7 })
  pool.rotation.x = -Math.PI / 2
  pool.position.y = -0.2
  grp.add(pool)
  const beamMat = addMat('#ff9aa8', 0.2)
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.55, 12, 1, true), beamMat)
  beam.position.y = -0.28
  grp.add(beam)
  const label = textPlane('♥', { role: 'label', height: 0.07, weight: 700, family: 'sans', color: '#ffb8c6', glow: 0.4 })
  label.mesh.position.set(0, 0.26, 0)
  grp.add(label.mesh)
  return {
    object: grp,
    update(t, env, f) {
      heart.update(t, { alpha: f, beat: env.beatPulse, spin: 0.6, pop: 0.8 })
      pool.material.uniforms.uAlpha.value = 0.45 * f
      beamMat.opacity = 0.16 * f
      label.material.opacity = f
    },
  }
}

/**
 * 伴展柜：每个展位两侧再摆一排小灯箱（"成排出现"里的第二排）。
 * 全部 24 个实例只用两个 InstancedMesh 承载。
 */
function buildVitrines(slots, camZAt) {
  const grp = new THREE.Group()
  grp.name = 'b:vitrines'
  const N = slots.length * 2
  const casesMat = addMat('#7fd8ff', 0.5)
  const beadsMat = addMat('#ffd479', 0.95)
  const cases = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), casesMat, N)
  const beads = new THREE.InstancedMesh(new THREE.TorusGeometry(0.075, 0.022, 4, 12), beadsMat, N)
  cases.frustumCulled = false
  beads.frustumCulled = false
  grp.add(cases, beads)
  const M = new THREE.Matrix4()
  const P = new THREE.Vector3()
  const Q = new THREE.Quaternion()
  const S = new THREE.Vector3()
  const AXIS_Y = new THREE.Vector3(0, 1, 0)
  const items = []
  for (let s = 0; s < slots.length; s++) {
    for (let k = 0; k < 2; k++) {
      const idx = s * 2 + k
      const side = k === 0 ? -1 : 1
      items.push({
        base: camZAt(slots[s].t) - (2.7 + hash01(idx, 603) * 0.5) - travelAt(slots[s].t),
        lane: side * (0.98 + hash01(idx, 601) * 0.25),
        yy: -0.42 + hash01(idx, 602) * 0.18,
        sp: 0.8 + hash01(idx, 604) * 1.8,
      })
    }
  }
  return {
    object: grp,
    update(t, env) {
      for (let n = 0; n < items.length; n++) {
        const it = items[n]
        const z = it.base + env.D
        const dist = env.camZ - z
        const f = fogAt(dist)
        if (f <= 0.004) {
          S.set(0.0008, 0.0008, 0.0008)
          P.set(it.lane, it.yy, z)
          Q.identity()
          M.compose(P, Q, S)
          cases.setMatrixAt(n, M)
          beads.setMatrixAt(n, M)
          continue
        }
        P.set(it.lane + env.camX * 0.4, it.yy, z)
        Q.identity()
        S.set(f, f, f)
        M.compose(P, Q, S)
        cases.setMatrixAt(n, M)
        P.set(it.lane + env.camX * 0.4, it.yy + 0.03, z + 0.02)
        const bs = f * (0.8 + 0.35 * Math.sin(t * it.sp + n))
        S.set(bs, bs, bs)
        Q.setFromAxisAngle(AXIS_Y, t * it.sp)
        M.compose(P, Q, S)
        beads.setMatrixAt(n, M)
      }
      cases.instanceMatrix.needsUpdate = true
      beads.instanceMatrix.needsUpdate = true
      casesMat.opacity = 0.4 * (1 - env.disE)
      beadsMat.opacity = 0.85 * (1 - env.disE)
    },
  }
}

/* ------------------------------------------------------------------ *
 * 5) 场景
 * ------------------------------------------------------------------ */

/* ================================================================== *
 * ⚠️ 已作废：§5 的 4 / 5 / 9 / 10 / 11 / 20 六件展品（clock / toggle / torusknot /
 * mobius / platonic / monitor）
 * ------------------------------------------------------------------
 * 这六件是上一轮按 **FIX_V3 §7 B**「展品用 §5 的 4–12、14、19、20、22，至少 10 种
 * 不同模型」补的。**FIX_V4 §1.3 已明令删除它们**（"删除展馆里那排带橙/青外框的小道具
 * （钟表、开关、环面结、莫比乌斯带、正多面体、终端屏）以及它们的全部标签"），
 * §0.4 又规定 FIX_V4 取代 FIX_V3 §7 中 B 的描述 —— 也就是那条"≥10 种"的要求**已作废**。
 * 现在 `PLAN` / `BUILD` 都不再引用这六个函数；它们仅作**死代码**留在此处，
 * 目的是保留"曾经这么做、为什么撤掉"的记录。下一次清理时整块删除。
 * ================================================================== */

/** §5-4 钟表：分针/时针由同一个 T 推导（props 的 assertClockRatio 保证 12:1） */
function buildClockExhibit(renderer) {
  const p = createProp('clock', { renderer, radius: 0.22, numerals: true, sky: false })
  return { object: p.object, update: (t) => p.update(t, { alpha: 1 }) }
}

/** §5-5 开关：胶囊轨道 + 滑块，翻转走 outElastic 过冲 */
function buildToggleExhibit(renderer) {
  const p = createProp('toggle', { renderer, flips: [16.4, 19.8, 23.2, 26.6] })
  p.object.scale.setScalar(0.55)
  return { object: p.object, update: (t) => p.update(t, { alpha: 1 }) }
}

/**
 * §5-20 显示器 / 终端屏：屏面里是**滚动代码**（§7 B 原文点名「多块 Monitor 里滚动代码」）。
 * 台词的换行由 TermPane 自己按 measureText 实测处理；这里只喂短行。
 */
function buildMonitorExhibit(renderer) {
  const p = createProp('monitor', { renderer, session: '#001', side: 'L', width: 0.44 })
  const LINES = ['fn tick() {', '  kv.put(k, v);', '  emit(eos);', 'tok ▸ ok']
  return {
    object: p.object,
    update: (t) => {
      // 逐行"滚动"：行数随时间增长并循环
      const n = 1 + Math.floor((t * 1.9) % LINES.length)
      p.update(t, {
        lines: LINES.slice(0, Math.max(1, Math.min(LINES.length, n))).map((s, i) => ({
          kind: i === LINES.length - 1 ? 'tool' : 'deepseek',
          text: s,
        })),
        caret: true,
      })
    },
  }
}

/** §5-9 环面结（p=2,q=3）：真实 TorusKnotGeometry + PBR 材质 */
function buildTorusKnotExhibit() {
  const mesh = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.19, 0.055, 140, 18, 2, 3),
    new THREE.MeshStandardMaterial({ color: 0x82aaff, roughness: 0.26, metalness: 0.42, emissive: 0x14304f, emissiveIntensity: 0.6 })
  )
  const grp = new THREE.Group()
  grp.add(mesh)
  return {
    object: grp,
    update: (t) => {
      mesh.rotation.set(t * 0.33, t * 0.51, t * 0.19)
    },
  }
}

/**
 * §5-10 莫比乌斯带（参数化）。
 * u∈[0,2π) 绕一圈、v 横跨带面；半径里含 `v·cos(u/2)` 这一项 —— 走到半圈时带面翻面，
 * 于是只有一个面。非可定向面没有一致的朝向，所以法线用近似式 + `DoubleSide`。
 */
function buildMobiusExhibit() {
  const N = 110
  const M = 6
  const w = 0.10
  const R = 0.21
  const pos = []
  const nor = []
  const uv = []
  const idx = []
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * TAU
    const cu = Math.cos(u)
    const su = Math.sin(u)
    const ch = Math.cos(u / 2)
    const sh = Math.sin(u / 2)
    for (let j = 0; j <= M; j++) {
      const v = (j / M - 0.5) * 2 * w
      const r = R + v * ch
      pos.push(r * cu, r * su, v * sh)
      nor.push(cu * ch, su * ch, sh)
      uv.push(i / N, j / M)
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j
      const b = a + M + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x4dd0e1, roughness: 0.3, metalness: 0.38, side: THREE.DoubleSide, emissive: 0x0d3038, emissiveIntensity: 0.5 })
  )
  const grp = new THREE.Group()
  grp.add(mesh)
  return {
    object: grp,
    update: (t) => {
      mesh.rotation.set(0.85 + Math.sin(t * 0.3) * 0.18, t * 0.4, t * 0.12)
    },
  }
}

/** §5-11 正多面体五种（flatShading）：正四面体 / 立方体 / 正八面体 / 正十二面体 / 正二十面体 */
function buildPlatonicExhibit() {
  const grp = new THREE.Group()
  const COLORS = [0x4dd0e1, 0x7fd8ff, 0x82aaff, 0xc792ea, 0xa5e075]
  const geos = [
    new THREE.TetrahedronGeometry(0.085),
    new THREE.BoxGeometry(0.115, 0.115, 0.115),
    new THREE.OctahedronGeometry(0.09),
    new THREE.DodecahedronGeometry(0.082),
    new THREE.IcosahedronGeometry(0.082),
  ]
  const meshes = geos.map((geo, i) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: COLORS[i], roughness: 0.34, metalness: 0.26, flatShading: true })
    )
    const a = (i / geos.length) * TAU
    m.position.set(Math.cos(a) * 0.17, Math.sin(a * 1.3) * 0.06, Math.sin(a) * 0.13)
    grp.add(m)
    return m
  })
  return {
    object: grp,
    update: (t) => {
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].rotation.set(t * (0.30 + i * 0.07), t * (0.42 - i * 0.05), t * 0.21)
      }
    },
  }
}

export default {  id: 'B',
  start: START,
  end: END,
  title: '序曲飞行',
  /** 冲击提示：时刻全部在 init() 里用锚点结果**覆写**（不写绝对秒数，§2.2） */
  fx: [],

  init(ctx) {
    const T = ctx.three
    const renderer = T.renderer || null
    this.metrics = { tris: 0, calls: 0, titlePx: 0 }
    this.grp = new THREE.Group()
    this.grp.name = 'segB'
    T.stage3d.add(this.grp)
    // 心形（PBR）需要灯光与轮廓光；Basic 材质不受影响（§2.7）
    this.lights = createLightRigSafe()
    T.stage3d.add(this.lights)

    /* ---------- 时间线：锚点 → 秒（§2.2） ---------- */
    // fallback 只在锚点未解析时兜底；实际时间以歌词/节拍为准
    const tl = timeline(ctx.cues, SEG, {
      flyIn: [14.667, 0.4],
      gate1: [16.5, 0.3],
      gate2: [18.333, 0.3],
      gate3: [20.167, 0.3],
      dissolve: [28.467, 0.4],
    })
    this.tl = tl
    const grid = beatGridOf(ctx.sync, START, END, tl.gate1.t)
    this.grid = grid
    const barLen = 4 * grid.beatDt

    // 溶解时刻：FIX §3 B 的"0:28.5 相机拉远"就是 rig 的后拉键；对齐到最近的节拍节点
    // （得到 28.467，与 0:28.5 差 33ms）。
    const pullT = pullBackKeyT(CAMERA_KEYS, START, END)
    let tDissolve = pullT
    let bestD = Infinity
    for (const b of grid.list) {
      const d = Math.abs(b.t - pullT)
      if (d < bestD) {
        bestD = d
        tDissolve = b.t
      }
    }
    this.tDissolve = tDissolve

    /* ---------- 展位表（顺序 = §3 段 B 的展品顺序） ---------- */
    const slot = (k) => grid.slots[Math.min(grid.slots.length - 1, Math.max(0, k))]
    const camZAt = (tt) => cameraAt(tt).pos[2]
    const PLAN = [
      // key,        展位序号, 到达距离, 车道 x, 展位尺寸, 颜色
      ['formula', 0, 2.55, 0.0, [2.7, 1.9], '#4dd0e1'],
      ['pendulum', 1, 3.0, -0.42, [2.5, 1.85], '#7fd8ff'],
      ['lorenz', 2, 3.0, 0.44, [2.5, 1.85], '#82aaff'],
      ['tesseract', 3, 2.95, -0.4, [2.5, 1.85], '#c792ea'],
      ['mandelbrot', 4, 3.3, 0.34, [3.5, 2.2], '#ffb454'],
      ['packet', 5, 2.75, -0.32, [3.3, 1.75], '#a5e075'],
      ['fourier', 6, 2.9, 0.4, [2.6, 1.9], '#4dd0e1'],
      ['galaxy', 7, 3.35, -0.3, [3.4, 2.3], '#b48cff'],
      ['blackhole', 8, 3.35, 0.28, [3.5, 2.3], '#ffb454'],
      ['heart', 11, 2.15, 0.3, [1.5, 1.3], '#ff8fa3'],
      // ⚠️ FIX_V4 §1.3 明令删除下面这排（我上一轮按 FIX_V3 §7 B 的"§5 编号模型 ≥10 种"加的
      //   clock / toggle / torusknot / mobius / platonic / monitor 六件），
      //   并明确「**删除展馆里那排带橙/青外框的小道具**（钟表、开关、环面结、莫比乌斯带、
      //   正多面体、终端屏）**以及它们的全部标签**」。§0.4 又规定 FIX_V4 取代 FIX_V3 §7 中 B 的描述，
      //   所以"≥10 种 §5 模型"这条要求**已作废**，那六件连同下面的外框/基座/中文标牌一起撤掉。
      //   §1.3 的新方向是"发光线条+粒子"的数据可视化飞行，不要塑料质感实体小道具。
    ]
    const BUILD = {
      formula: buildFormulaRing,
      pendulum: buildDoublePendulum,
      lorenz: buildLorenz,
      tesseract: buildTesseract,
      mandelbrot: buildMandelbrot,
      packet: buildPacket,
      fourier: buildFourier,
      galaxy: buildGalaxy,
      blackhole: buildBlackHole,
      heart: () => buildHeart(renderer),
    }
    this.exhibits = []
    for (let n = 0; n < PLAN.length; n++) {
      const [key, k, dArrive, lane, [bw, bh], color] = PLAN[n]
      const s = slot(k)
      const group = new THREE.Group()
      group.name = `b:ex:${key}`
      // ⚠️ FIX_V4 §1.3 + §0.2：**不再建展位外框 / 基座 / 中文标牌**。
      //   旧实现通过 `buildBay(bw, bh, color, EX_NAMES[key])` 给每件展品套一圈橙/青发光外框、
      //   一个实体基座、一块中文标牌（"钟表""开关""洛伦兹吸引子"…）。§1.3 要求
      //   「删除…带橙/青外框的小道具以及它们的**全部标签**」并改成"发光线条+粒子"的可视化；
      //   §0.2 更直接：画面上不得出现任何标签或调试名，**包括中文标签**。
      //   所以这里连 `bay` 一起撤掉，`bw/bh/color` 只保留在 PLAN 里作为构图记录。
      const inner = BUILD[key]()
      group.add(inner.object)
      this.grp.add(group)
      this.exhibits.push({
        key,
        group,
        inner,
        bay: null, // §1.3：无外框/基座/标牌
        lane,
        laneY: 0.02,
        dir: [hash01(n, 701) * 2 - 1, hash01(n, 702) * 2 - 1],
        base: camZAt(s.t) - dArrive - travelAt(s.t),
        arrive: s.t,
      })
    }

    /* ---------- 门环：每小节首拍一道（§3 段 B） ---------- */
    this.gates = []
    for (const b of grid.bars) {
      if (b.t >= tDissolve) continue
      const g = buildGate()
      this.grp.add(g.object)
      this.gates.push({ ...g, t0: b.t, base: camZAt(b.t) - 1.15 - travelAt(b.t) })
    }

    /* ---------- 大字号多语言代码墙（§2.8） ---------- */
    // fontPx 92：最近一层（d≈4.5）每行 ≈79px、最远一层（d≈8.3）≈43px，都高于
    // §0.5 的"代码墙主体 ≥40px"，并且屏幕上真的读得出（?debug 会打印实测值）。
    this.wall = codeWall({
      layout: 'wall', layers: 4, fontPx: 92, width: 4.6, height: 2.6, speed: 0.16, cycle: 14,
    })
    // 走廊里各层横向错开太多会变成"两面墙重叠"（codewall.js 顶部记录过这个坑）：
    // 这里只留 ±0.55 的错位，让四层读起来是**同一条隧道尽头**的景深。
    for (let i = 0; i < this.wall.panels.length; i++) {
      const e = this.wall.panels[i]
      e.x0 = ((i % 3) - 1) * 0.55
      e.mesh.position.y = ((i % 2) * 2 - 1) * 0.16
    }
    this.grp.add(this.wall.object)

    /* ---------- 背景 / 光柱 / 海雪 / 伴展柜 ---------- */
    this.backdrop = buildBackdrop()
    this.shafts = buildShafts()
    this.snow = buildSnow()
    this.tokenSnow = buildTokenSnow()
    this.vitrines = buildVitrines(grid.slots.slice(0, 12), camZAt)
    this.grp.add(this.backdrop.object, this.shafts.object, this.snow.object, this.tokenSnow.object, this.vitrines.object)

    /* ---------- 标题：乱码解码成 3D 巨字 ---------- */
    // 世界高度 0.30 → 画布字号 162px（≥ title 的下限 120px）；悬停距离 2.2–2.5 世界单位时
    // 屏幕上 ≈128–150px，§0.5 的"标题 ≥120px"在**屏幕上**也满足。
    this.title = textPlane(TITLE, {
      role: 'title', height: 0.30, weight: 700, family: 'code', color: '#eaf6ff', glow: 0.5,
    })
    // depthTest=false + 高 renderOrder：标题是"目的地"，必须永远读得到（不能被代码墙挡住）
    this.title.material.depthTest = false
    this.title.mesh.renderOrder = 60
    this.title.mesh.frustumCulled = false
    this.grp.add(this.title.mesh)
    // 厚度：3 层错位的"文字板"，靠相机 roll/漂移产生真实视差 → 3D 巨字，而不是一张贴纸
    this.titleSlab = []
    for (let i = 0; i < 3; i++) {
      const tp = textPlane(TITLE, {
        role: 'title', height: 0.30, weight: 700, family: 'code', color: '#7fd8ff', glow: 0.2,
      })
      tp.material.depthTest = false
      tp.mesh.renderOrder = 58 - i
      tp.mesh.frustumCulled = false
      this.titleSlab.push(tp)
      this.grp.add(tp.mesh)
    }
    this.titleBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.014, 0.014), addMat('#7fd8ff', 0.9))
    this.titleBar.material.depthTest = false
    this.titleBar.renderOrder = 59
    this.titleBar.frustumCulled = false
    this.grp.add(this.titleBar)
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.6), addMat('#ffffff', 0.5))
    this.scan.material.depthTest = false
    this.scan.renderOrder = 61
    this.scan.frustumCulled = false
    this.grp.add(this.scan)

    // 标题窗口：gate3 那一小节起，持续两个小节 —— 即 FIX §3 B 的 0:20–0:24（20.17–23.90）
    this.tTitle0 = tl.gate3.t - 0.35
    this.tTitle1 = tl.gate3.t + 2 * barLen

    /* ---------- fx：用锚点结果覆写（§2.2：不写绝对秒数） ---------- */
    this.fx = [
      { t: tl.flyIn.t, kind: 'flash', amount: 0.45, dur: 0.16 },
      // 锚点表里 dissolve 解析到的是段内**最强起音**（15.10，下潜重击）：
      // §2.2 说冲突时以节拍/词时间为准，而 §3 B 要求的 0:28.5 属于"相机拉远"，
      // 已经由 rig 的后拉键 + 节拍网格给出（tDissolve），所以这里把 dissolve 锚点
      // 用在它真正对应的那一下重击上，不浪费这个锚点。
      { t: tl.dissolve.t, kind: 'glitch', amount: 0.35, dur: 0.14 },
      { t: tDissolve, kind: 'flash', amount: 0.7, dur: 0.22 },
      { t: tDissolve, kind: 'shake', amount: 0.6, dur: 0.4 },
    ]
    this.gateFlash = (t) => {
      // 门环穿过相机那一瞬的额外亮度（由"到达时刻"直接算，不需要事件表）
      let f = 0
      for (const g of this.gates) {
        const e = t - g.t0
        if (e < 0 || e > 0.4) continue
        const a = Math.exp(-e / 0.11)
        if (a > f) f = a
      }
      return f
    }
  },

  render(t, lt, ctx) {
    const cam = cameraAt(t) // 只读引用 rig：把"相机在哪"变成 t 的纯函数
    const camZ = cam.pos[2]
    const fov = cam.fov
    const camX = cam.pos[0]
    const D = travelAt(t)
    const dis = clamp(span(t, this.tDissolve - 0.1, this.tDissolve + 1.05))
    const disE = inOutCubic(dis)
    const beatPulse = ctx.sync && ctx.sync.pulse ? ctx.sync.pulse(t, 220) : 0
    const imp = pulseAt(t, ctx.impulses || [])
    const env = {
      camZ, camX, fov, D, dis, disE, beatPulse, imp, t,
      ppuOf: (z) => pxPerUnitAt({ position: { z: camZ }, fov }, z, ctx.H),
    }
    // renderAt 每帧会把 stage3d 的直接子对象全部隐藏，本段要逐帧重新打开
    this.grp.visible = true
    this.lights.visible = true

    /* ---------------- ① 背景（穹顶 + 体积光柱） ---------------- */
    this.backdrop.object.visible = true
    this.backdrop.update(t, env)
    this.shafts.object.visible = true
    this.shafts.update(t, env)

    /* ---------------- ② 代码墙（隧道尽头的多语言代码） ---------------- */
    this.wall.object.visible = dis < 0.98
    if (this.wall.object.visible) {
      // 相对相机保持固定距离：它是"馆的尽头"，不是掠过的道具
      this.wall.object.position.set(camX * 0.25, -0.03, camZ - 3.5)
      this.wall.update(t, {
        camera: { position: { x: camX } },
        alpha: clamp(1 - span(dis, 0.15, 0.95)),
      })
    }

    /* ---------------- ③ 海雪 / token 字形雪 ---------------- */
    this.snow.object.visible = true
    this.snow.update(t, env)
    this.tokenSnow.object.visible = true
    this.tokenSnow.update(t, env)

    /* ---------------- ④ 门环（每小节首拍一道，自发光） ---------------- */
    const gflash = this.gateFlash(t)
    for (const gate of this.gates) {
      const z = gate.base + D
      const dist = camZ - z
      const far = 1 - span(dist, 7.5, 12.5) // 从雾里淡入
      const near = span(dist, -1.0, 0.6) // 冲过相机之后才淡出
      const f = clamp(far * near) * (1 - disE)
      const vis = f > 0.004 && dist < 13
      gate.object.visible = vis
      if (!vis) continue
      gate.object.position.set(camX * 0.5, 0, z)
      const fl = Math.abs(t - gate.t0) < 0.35 ? gflash : 0
      gate.update(t, env, f, fl)
    }

    /* ---------------- ⑤ 展品（含展位 / 标牌 / 溶解） ---------------- */
    for (const ex of this.exhibits) {
      const z = ex.base + D
      const dist = camZ - z
      const f = fogAt(dist) * (1 - disE)
      const vis = f > 0.005 && dist < 16
      ex.group.visible = vis
      if (!vis) continue
      // 溶解：原地缩小 + 沿各自方向散开（§3 段 B "所有展品溶解回蜂群"）
      ex.group.position.set(
        ex.lane + ex.dir[0] * disE * 2.6 + camX * 0.35,
        ex.laneY + ex.dir[1] * disE * 2.2,
        z
      )
      ex.group.scale.setScalar(Math.max(0.001, 1 - 0.92 * disE))
      ex.inner.update(t, env, f, t - ex.arrive)
      // §1.3：`bay` 已撤（无外框/基座/标牌），这里保持判空以防将来加回
      if (ex.bay) {
        ex.bay.frame.material.opacity = 0.5 * f
        ex.bay.plinth.material.opacity = 0.5 * f
        if (ex.bay.placard) ex.bay.placard.material.opacity = f
      }
    }

    /* ---------------- ⑥ 伴展柜（成排出现的第二排） ---------------- */
    this.vitrines.object.visible = disE < 0.995
    if (this.vitrines.object.visible) this.vitrines.update(t, env)

    /* ---------------- ⑦ 标题：乱码解码成 3D 巨字 ---------------- */
    const tt0 = this.tTitle0
    const tt1 = this.tTitle1
    const u = clamp(span(t, tt0, tt1))
    const titleOn = t >= tt0 - 0.05 && t <= tt1 + 0.45
    this.title.mesh.visible = titleOn
    for (const tp of this.titleSlab) tp.mesh.visible = titleOn
    this.titleBar.visible = titleOn
    if (titleOn) {
      // 距离剖面：远处开始解码 → 悬停（保证屏幕上 ≥120px）→ 结尾穿过相机
      const dT =
        8.4 -
        2.9 * smoothstep(clamp(u / 0.2)) -
        0.3 * smoothstep(clamp((u - 0.35) / 0.45)) -
        2.4 * smoothstep(clamp((u - 0.8) / 0.2))
      const zT = camZ - dT
      const alpha = clamp(span(t, tt0, tt0 + 0.25)) * (1 - clamp(span(t, tt1 - 0.1, tt1 + 0.45)))
      // 逐字解码（迁移旧段 B：settle 之前显示 GLYPHS 里的随机字形）
      let out = ''
      let settled = 0
      for (let i = 0; i < TITLE.length; i++) {
        const settle = tt0 + 0.12 + i * 0.055
        if (t >= settle) {
          out += TITLE[i]
          settled++
        } else {
          out += GLYPHS[Math.floor(hash01(i * 97 + Math.floor(t * 22), 7) * GLYPHS.length)]
        }
      }
      this.title.setText(out)
      for (const tp of this.titleSlab) tp.setText(out)
      const done = settled / TITLE.length
      const pop = outBack(clamp(span(t, tt0 - 0.05, tt0 + 0.5)))
      this.title.mesh.position.set(camX * 0.3, 0.06, zT)
      this.title.mesh.scale.set(1, 0.94 + 0.06 * pop, 1)
      this.title.material.opacity = alpha
      for (let i = 0; i < this.titleSlab.length; i++) {
        const tp = this.titleSlab[i]
        tp.mesh.position.set(camX * 0.3, 0.06, zT - 0.05 * (i + 1))
        tp.mesh.scale.copy(this.title.mesh.scale)
        tp.material.opacity = alpha * (0.34 - 0.09 * i)
      }
      // 解码进度光条（宽度 = 已解码比例）
      this.titleBar.position.set(camX * 0.3, -0.17, zT + 0.02)
      this.titleBar.scale.set(Math.max(0.001, this.title.width * done * 1.02), 1, 1)
      this.titleBar.material.opacity = alpha * 0.7
      // 横扫亮带（解码期间）
      const sweep = (t * 0.9) % 1
      this.scan.visible = done < 0.999
      if (this.scan.visible) {
        this.scan.position.set(camX * 0.3 + (sweep - 0.5) * this.title.width, 0.06, zT + 0.01)
        this.scan.scale.set(1, 1, 1)
        this.scan.material.opacity = 0.4 * alpha * Math.max(0, 1 - Math.abs(sweep - 0.5) * 1.4)
      }
      this.metrics.titlePx = this.title.pxHeight(env.ppuOf(zT))
    } else {
      this.scan.visible = false
      this.metrics.titlePx = 0
    }

    /* ---------------- ⑧ ?debug 读数 ---------------- */
    if (ctx.debug) {
      const g2 = ctx.g
      let vis = 0
      for (const ex of this.exhibits) if (ex.group.visible) vis++
      let gvis = 0
      for (const gt of this.gates) if (gt.object.visible) gvis++
      const wallPx = this.wall.panels.length ? this.wall.panels[0].lineUnits * env.ppuOf(camZ - 4.5) : 0
      const px = (ex) => env.ppuOf(ex.base + D)
      g2.save()
      g2.globalAlpha = 0.92
      text(g2, `B  tris=${ctx.three.renderer.info.render.triangles}  calls=${ctx.three.renderer.info.render.calls}`, 40, 84, {
        role: 'ui', size: 34, family: 'code', color: C.teal,
      })
      text(
        g2,
        `camZ ${camZ.toFixed(2)} fov ${fov.toFixed(1)} D ${D.toFixed(1)} beat ${beatPulse.toFixed(2)} imp ${imp.toFixed(2)} dis ${dis.toFixed(2)}`,
        40, 124, { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      text(
        g2,
        `ex ${vis}/${this.exhibits.length} gates ${gvis}/${this.gates.length} wallLine ${wallPx.toFixed(0)}px title ${this.metrics.titlePx.toFixed(0)}px`,
        40, 164, { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      let line = ''
      for (const ex of this.exhibits) line += `${ex.key}@${(camZ - (ex.base + D)).toFixed(1)}(${px(ex).toFixed(0)}) `
      text(g2, line, 40, 204, { role: 'ui', size: 34, family: 'code', color: C.fgDim })
      g2.restore()
    }
  },

  dispose() {
    if (this.grp && this.grp.parent) this.grp.parent.remove(this.grp)
    if (this.lights && this.lights.parent) this.lights.parent.remove(this.lights)
  },
}
