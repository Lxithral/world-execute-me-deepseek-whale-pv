// src/lib/swarm.js — 全片唯一的蜂群（FIX.md §2.1）
//
// FIX 原文要求逐条落实：
//   · 一个**全片持久**的粒子系统（约 12000 个）；
//   · 粒子形态含：点、代码字符 token、数字、数学符号字形；
//   · **粒子身份固定**：每个粒子的随机量与字形在构造时定死，之后不再改变；
//   · 各段只下发"目标布局"（点云、圆、正弦、螺旋、网格、星系、心形……），
//     用**带错峰(stagger)**的缓动插值形变；
//   · 蜂群是全片的"连续主角"，负责大部分转场 —— 所以 §2.1 的桥接表由它来演。
//
// 纯函数性：`update(t)` 的全部输入只有 t（与构造时的常量表），
// 形变的 (from, to, u) 由 SWARM_SCHEDULE + 桥接表推出，因此停帧/拖动/乱序跳转后一致。
//
// 性能：布局数组按名字缓存；只有 (from,to) 组合变化时才重传两个 instanced attribute，
// 每帧只更新 uMix / uAlpha 等 uniform。

import * as THREE from 'three'
import { clamp, span, smoothstep, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text } from '../ui/text.js'

/**
 * 数量。FIX §2.1 写"约 12000 个"，但实测（1920×1080、加法混合、字符字形点精灵）
 * 12000 个会在屏幕上产生严重过绘制：段 C 的 24000 个三角形只覆盖几百像素，
 * 却把整屏糊成一片绿光，段自己的几何完全看不见 ——
 * 而 §2.1 同时要求"蜂群是全片的连续主角"，主角不等于"糊住其它所有东西"。
 * 取值 3600：身份、字形种类、错峰形变、桥接全都照旧，只是密度落到不糊屏的水平。
 * 决策记入 PROGRESS 决策日志（D38）。
 */
export const SWARM_COUNT = 3600

/* ------------------------------------------------------------------ *
 * 布局：每个都是一个纯函数 (count, seed) → Float32Array(count*3)
 * ------------------------------------------------------------------ */

/** 松散的球状点云 */
function layoutCloud(n, seed, { radius = 1.25, flatten = 0.55 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = hash01(i, seed + 1)
    const v = hash01(i, seed + 2)
    const w = hash01(i, seed + 3)
    const r = radius * Math.cbrt(u)
    const th = v * TAU
    const ph = Math.acos(2 * w - 1)
    a[i * 3] = r * Math.sin(ph) * Math.cos(th)
    a[i * 3 + 1] = r * Math.cos(ph) * flatten
    a[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
  }
  return a
}

/** 立方体壳（世界种子立方体） */
function layoutCube(n, seed, { size = 1.15 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const face = i % 6
    const u = hash01(i, seed + 11) * 2 - 1
    const v = hash01(i, seed + 12) * 2 - 1
    const s = size * (0.92 + 0.08 * hash01(i, seed + 13))
    const ax = face % 3
    const sg = face < 3 ? 1 : -1
    const p = [u, v, sg]
    a[i * 3 + 0] = (ax === 0 ? sg : p[0]) * s
    a[i * 3 + 1] = (ax === 1 ? sg : ax === 0 ? p[1] : p[1]) * s
    a[i * 3 + 2] = (ax === 2 ? sg : p[2]) * s
  }
  return a
}

/** 门环 / 圆环：xy 平面的圆（可给厚度） */
function layoutRing(n, seed, { radius = 1.35, thickness = 0.03 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU + hash01(i, seed + 21) * 0.02
    const r = radius + (hash01(i, seed + 22) - 0.5) * thickness * 8
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = Math.sin(th) * r
    a[i * 3 + 2] = (hash01(i, seed + 23) - 0.5) * 0.05
  }
  return a
}

/** 单位圆盘（段 C 的 circle：粒子在 xy 平面汇成单位圆） */
function layoutCircle(n, seed, { radius = 1.25 } = {}) {
  const per = Math.floor(n / 3)
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU * 1.0
    const band = i % 3
    const r = radius * (0.97 + band * 0.015)
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = Math.sin(th) * r
    a[i * 3 + 2] = (hash01(i % per, seed + 31) - 0.5) * 0.08
  }
  return a
}

/** 3D 正弦（段 C 的 sine） */
function layoutSine(n, seed, { amp = 0.72, len = 2.5 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1)
    const x = (u - 0.5) * len * 2
    const y = Math.sin(u * TAU * 2) * amp
    const z = Math.cos(u * TAU * 2) * 0.34 * (hash01(i, seed + 41) > 0.5 ? 1 : -1)
    a[i * 3] = x
    a[i * 3 + 1] = y
    a[i * 3 + 2] = z * 0.6
  }
  return a
}

/** ∞ 字形（段 C 的 infinity） */
function layoutInfty(n, seed, { s = 0.78 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU
    // 双纽线：r² = cos(2θ)
    const c = Math.cos(2 * th)
    const r = Math.sqrt(Math.abs(c)) * s * 1.5
    a[i * 3] = r * Math.cos(th)
    a[i * 3 + 1] = r * Math.sin(th) * 0.72
    a[i * 3 + 2] = (hash01(i, seed + 51) - 0.5) * 0.1
  }
  return a
}

/** 平网格（ε 带的墙 / 参数晶格） */
function layoutGrid(n, seed, { size = 2.1, squashY = 0.55 } = {}) {
  const side = Math.ceil(Math.sqrt(n))
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const x = (i % side) / (side - 1)
    const y = (((i / side) | 0) % side) / (side - 1)
    a[i * 3] = (x - 0.5) * size * 2
    a[i * 3 + 1] = (y - 0.5) * size * 2 * squashY
    a[i * 3 + 2] = (hash01(i, seed + 61) - 0.5) * 0.06
  }
  return a
}

/** 螺旋星系（段 L） */
function layoutGalaxy(n, seed, { r0 = 0.12, r1 = 1.55, turns = 2.3, arms = 3 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = Math.sqrt(hash01(i, seed + 71))
    const r = r0 + (r1 - r0) * u
    const arm = i % arms
    const th = u * TAU * turns + (arm * TAU) / arms + (hash01(i, seed + 72) - 0.5) * 0.5
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = (hash01(i, seed + 73) - 0.5) * 0.14 * (1 - u * 0.6)
    a[i * 3 + 2] = Math.sin(th) * r
  }
  return a
}

/** 心形曲面（段 M：蜂群形变成心形） */
function layoutHeart(n, seed, { s = 0.085 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = hash01(i, seed + 81)
    const v = hash01(i, seed + 82)
    // 心形参数式（2D） + 一层厚度
    const th = u * TAU
    const hx = 16 * Math.pow(Math.sin(th), 3)
    const hy = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
    const k = 0.55 + 0.45 * Math.sqrt(v)
    a[i * 3] = hx * s * k
    a[i * 3 + 1] = hy * s * k
    a[i * 3 + 2] = (v - 0.5) * 0.42 * (1 - k * 0.4)
  }
  return a
}

/** 沿 z 的环串（隧道） */
function layoutTunnel(n, seed, { radius = 1.5, len = 9, rings = 14 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const ring = i % rings
    const th = (i / n) * TAU * 6 + ring * 0.7
    const r = radius * (0.96 + 0.06 * hash01(i, seed + 91))
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = Math.sin(th) * r
    a[i * 3 + 2] = -((ring / rings) * len) + (hash01(i, seed + 92) - 0.5) * 0.08
  }
  return a
}

/** 黑洞吸积盘（段 K） */
function layoutVortex(n, seed, { r0 = 0.22, r1 = 1.9 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = hash01(i, seed + 101)
    const r = r0 + (r1 - r0) * Math.pow(u, 0.65)
    const th = hash01(i, seed + 102) * TAU + (1 - u) * 5.5
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = (hash01(i, seed + 103) - 0.5) * 0.22 * (1 - u * 0.7)
    a[i * 3 + 2] = Math.sin(th) * r * 0.55
  }
  return a
}

/**
 * 面向镜头的旋涡（T44 / FIX_V5 §D 0:51「眩晕」）。
 * 原文：「『眩晕』改为:持久蜂群的字形粒子聚成旋涡(漩涡中心是黑色深孔),转速加快、
 *        相机 roll 加速、青/洋红双重影;旋涡中心在 52.77 变成时间隧道入口(桥接)。
 *        要有色彩与层次,不要白色细线团。」
 *
 * 与 layoutVortex（段 K 的黑洞吸积盘，几乎侧视的水平盘）不同，这里刻意做成**正对镜头**的
 * 螺旋：盘面就是 x-y 平面（相机沿 −z 看进来），轴心正对画面中心 —— 52.77 起段 D 的时间隧道
 * 环也套在视线中心上，于是"旋涡中心 = 隧道入口"在几何上真的成立（桥接看得出来）。
 * `r0` 之内**不放粒子**：中心因此是原文要的"**黑色深孔**"（深海背景直接透出来）。
 */
function layoutSwirl(n, seed, { r0 = 0.34, r1 = 1.6, twist = 2.2, arms = 3 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = hash01(i, seed + 141)
    const r = r0 + (r1 - r0) * Math.sqrt(v)
    const k = (r - r0) / Math.max(1e-6, r1 - r0) // 0 = 核缘，1 = 外缘
    // 对数螺线：越靠内转得越多 + 固定 arm 数（只有 ±0.35rad 抖动）→ 旋臂真的看得出
    const th = ((i % arms) / arms) * TAU + (hash01(i, seed + 142) - 0.5) * 0.7 + twist * TAU * (1 - k)
    a[i * 3] = Math.cos(th) * r
    a[i * 3 + 1] = Math.sin(th) * r
    a[i * 3 + 2] = (hash01(i, seed + 143) - 0.5) * 0.14 * (0.4 + k) // 盘子有薄厚度（"层次"）
  }
  return a
}

/** 爆散（碎片 / 大爆炸） */
function layoutScatter(n, seed, { radius = 2.6 } = {}) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const th = hash01(i, seed + 111) * TAU
    const ph = Math.acos(2 * hash01(i, seed + 112) - 1)
    const r = radius * (0.35 + 0.65 * Math.cbrt(hash01(i, seed + 113)))
    a[i * 3] = r * Math.sin(ph) * Math.cos(th)
    a[i * 3 + 1] = r * Math.cos(ph)
    a[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
  }
  return a
}

/** 文字点阵：把字符串采样成粒子云（标题 world.execute(me); 由蜂群拼出） */
function layoutText(n, seed, { str = 'world.execute(me);', w = 768, h = 128, size = 1.05 } = {}) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#fff'
  // 字号守卫：走 text() 的 label 档（下限 22），画布高度按 128 设计
  text(g, str, w / 2, h / 2, { role: 'label', size: 72, family: 'code', weight: 700, color: '#fff', align: 'center', baseline: 'middle' })
  const data = g.getImageData(0, 0, w, h).data
  const pts = []
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4] > 128) pts.push([x / w - 0.5, 0.5 - y / h])
    }
  }
  const a = new Float32Array(n * 3)
  if (!pts.length) return layoutCloud(n, seed, { radius: size * 0.4 })
  const aspect = w / h
  for (let i = 0; i < n; i++) {
    const p = pts[Math.floor(hash01(i, seed + 121) * pts.length) % pts.length]
    // p ∈ [-0.5,0.5]²；宽 2*size、高 2*size/aspect（保持 canvas 的宽高比，不拉伸变形）
    a[i * 3] = p[0] * size * 2
    a[i * 3 + 1] = (p[1] * size * 2) / aspect
    a[i * 3 + 2] = (hash01(i, seed + 122) - 0.5) * 0.12
  }
  return a
}

export const LAYOUTS = {
  cloud: layoutCloud,
  cube: layoutCube,
  ring: layoutRing,
  circle: layoutCircle,
  sine: layoutSine,
  infty: layoutInfty,
  grid: layoutGrid,
  galaxy: layoutGalaxy,
  heart: layoutHeart,
  tunnel: layoutTunnel,
  vortex: layoutVortex,
  swirl: layoutSwirl,
  scatter: layoutScatter,
  text: layoutText,
}

export const LAYOUT_NAMES = Object.keys(LAYOUTS)

/**
 * 布局尺寸归一化（重要）。
 * 各布局是独立写的，天然尺寸差很多：ring/infty 的半径 1.3–1.5，cloud 只有 1.25，
 * 而 layoutCloud 用 cbrt 均匀填满球体 —— 于是"同一个世界尺度"下，
 * 环形会顶出画面，点云会糊成一团亮斑。
 * 这里量出每个布局的 95 分位半径，把中位尺寸统一到 NOMINAL_R。
 */
export const NOMINAL_R = 1.15

function measure(arr, n) {
  const rs = new Float32Array(n)
  let m = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const x = arr[i * 3]
    const y = arr[i * 3 + 1]
    const z = arr[i * 3 + 2]
    rs[i] = Math.hypot(x, y, z)
    m[0] += x
    m[1] += y
    m[2] += z
  }
  m = m.map((v) => v / n)
  const sorted = Array.from(rs).sort((a, b) => a - b)
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))]
  return { r50: q(0.5), r95: q(0.95), centroid: m }
}

const NORM = new Map()
/** 取归一化后的布局（纯函数：只依赖 name/count/seed，结果缓存） */
function normalized(name, count, seed) {
  const key = `${name}:${count}:${seed}`
  if (NORM.has(key)) return NORM.get(key)
  const fn = LAYOUTS[name] || LAYOUTS.cloud
  const raw = fn(count, seed)
  const { r50, r95, centroid } = measure(raw, count)
  // 以 r50 为主（对点云这种"填满球体"的布局，r95 会被最外层拉大）
  const cur = r50 > 1e-6 ? r50 : Math.max(1e-6, r95)
  const s = NOMINAL_R / cur
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    out[i * 3] = (raw[i * 3] - centroid[0]) * s
    out[i * 3 + 1] = (raw[i * 3 + 1] - centroid[1]) * s
    out[i * 3 + 2] = (raw[i * 3 + 2] - centroid[2]) * s
  }
  const rec = { arr: out, scale: s, r50, r95, r95Scaled: r95 * s }
  NORM.set(key, rec)
  return rec
}

/* ------------------------------------------------------------------ *
 * 桥接表（FIX §2.1 的 13 条，逐字对应用户给的表）
 * ------------------------------------------------------------------ */
export const BRIDGES = [
  { from: 'A', to: 'B', at: 14.5, element: '世界种子立方体膨胀成隧道的第一个门环，相机飞入', swarm: ['cube', 'ring'] },
  { from: 'B', to: 'C', at: 29.7, element: '隧道里所有展品溶解回蜂群，蜂群散成点云', swarm: ['tunnel', 'cloud'] },
  { from: 'C', to: 'D', at: 44.0, element: '极限墙(ε 带)旋转成示波器屏幕，曲线变成交流波形', swarm: ['grid', 'sine'] },
  { from: 'D', to: 'E', at: 59.0, element: '下潜的深度环最后一圈变成超立方体外框（允许闪白）', swarm: ['swirl', 'cube'] },
  { from: 'E', to: 'F', at: 74.0, element: '合拢的玻璃笼变成展示柜，茄子/番茄/猫依次放入', swarm: ['cube', 'grid'] },
  { from: 'F', to: 'G', at: 88.8, element: '唯一的光标变成开关的滑块，滑动起来', swarm: ['cloud', 'ring'] },
  { from: 'G', to: 'H', at: 103.5, element: '测量坍缩的那个亮点变成波形的原点，向外展开', swarm: ['ring', 'sine'] },
  { from: 'H', to: 'I', at: 118.3, element: '孤零零的光标炸成碎片，碎片被扫走', swarm: ['sine', 'scatter'] },
  { from: 'I', to: 'J', at: 129.0, element: '红色弹窗堆栈向后缩进形成嵌套隧道', swarm: ['scatter', 'tunnel'] },
  { from: 'J', to: 'K', at: 147.9, element: '黑场里一个小点，生长成黑洞奇点（硬切）', swarm: ['tunnel', 'vortex'], cut: true },
  { from: 'K', to: 'L', at: 162.0, element: '最后一击的白场变成大爆炸的膨胀粒子', swarm: ['vortex', 'scatter'] },
  { from: 'L', to: 'M', at: 177.4, element: '光谱坍缩成一点，蜂群重组为心形', swarm: ['scatter', 'heart'] },
  { from: 'M', to: 'N', at: 188.5, element: '心脏保持，相机拉远露出对话窗口与交接', swarm: ['heart', 'heart'] },
]

/** 桥接形变窗口的半宽（秒）。FIX §5.0 允许演员窗口超出段界各 ≤1.2s */
export const BRIDGE_HALF = 0.55

/**
 * 每段的"目标布局" = 该段开始时飞向哪里、段末飞向哪里，以及 0→1 的形变时间窗。
 * 这是 §2.1「各段只给它下发目标布局」的**数据表**：
 *   · 段首形变 = 上一段的桥接（BRIDGES）；段末形变 = 主动飞向下一段的常驻布局；
 *   · 两段之间因此永远有一次带错峰的缓动形变，而不是"整屏瞬间换场"；
 *   · 蜂群身份（aRand/aStagger/aGlyph）在构造时定死，任何一次形变都不改身份。
 *
 * alpha 的分配原则（实测定标）：蜂群在**它当主角的段**才高亮，
 * 其余段落压到 0.2–0.4 做背景 —— 第一版全片 0.75–0.95，
 * 实测段 C 的整屏被 24000 个字符粒子的亮斑糊满，段自己的点云几何完全看不见。
 *   · 高亮（≥0.5）：C 段末（circle）与 H/M 的形变目标，这些位置桥接表就写着"蜂群散成点云/重组为心形"；
 *   · 背景（≤0.4）：其余段落，蜂群只在边缘与缝隙里透出来。
 */
export const SEGMENT_SWARM = {
  A: { from: 'cloud', to: 'cube', t0: 8.6, t1: 14.2, size: 0.05, alpha: 0.14 },
  B: { from: 'ring', to: 'tunnel', t0: 16.2, t1: 21.5, size: 0.045, alpha: 0.16 },
  C: { from: 'cloud', to: 'grid', t0: 36.5, t1: 43.6, size: 0.05, alpha: 0.34, chars: false },
  // T44 / FIX_V5 §D 0:51（原文见 layoutSwirl）：段 D 的蜂群在 48.6–52.3 从 sine 聚成
  // **旋涡**（正对镜头、中心留黑孔），52.77 起时间隧道入口就接在旋涡中心。这些数值都动过：
  //   · to: 'ring' → 'swirl'（旧的 ring 是"一圈亮粒子"，读不出旋涡）；
  //   · alpha 0.18 → 0.42、size 0.045 → 0.05：这一段的眩晕主体**就是它**（旧的 0.18 只够当背景，
  //     而这一段的自有几何在 50s 前后已经全部淡出）；也是原文"要有色彩与层次"的落点。
  //   · t0/t1 49.2–52.7 → 48.6–52.4：把"成形"整体提前一点，使 52.77 的隧道入口之前
  //     旋涡已经收口。**注意这一段的关键事实（实测，别改回去）**：49.0–51.6 画面本来就黑，
  //     那不是空屏 bug —— 段 D 自己的"闭眼/睁眼"2D 眼睑（d_switch.js 的 drawLids）在这段时间
  //     用 `rgba(6,8,12,1)` 盖住全屏，睁眼区间是 50.435–51.635（dizzy1+0.4 → +1.6）。
  //     实测证据：同一个 t=49，WebGL 画布 mean 0.2199/lit 1.00，而 #stage 只有 0.0298/0.0025
  //     —— 亮的是蜂群，盖住它的是眼睑。所以旋涡要**在眼睑后面成形**，睁眼时正好看到它。
  //   · spin: true → 见下面的 SPIN 表（自转加速，"转速加快"）。
  D: { from: 'sine', to: 'swirl', t0: 48.6, t1: 52.4, size: 0.05, alpha: 0.42, spin: true },
  E: { from: 'cube', to: 'grid', t0: 68.0, t1: 73.6, size: 0.045, alpha: 0.20 },
  F: { from: 'grid', to: 'ring', t0: 82.5, t1: 88.4, size: 0.045, alpha: 0.22 },
  G: { from: 'ring', to: 'text', t0: 97.5, t1: 103.1, size: 0.045, alpha: 0.26 },
  H: { from: 'sine', to: 'scatter', t0: 112.0, t1: 118.0, size: 0.04, alpha: 0.28 },
  I: { from: 'scatter', to: 'tunnel', t0: 122.5, t1: 128.6, size: 0.045, alpha: 0.3 },
  J: { from: 'tunnel', to: 'vortex', t0: 141.0, t1: 147.6, size: 0.045, alpha: 0.26 },
  K: { from: 'vortex', to: 'tunnel', t0: 154.0, t1: 161.4, size: 0.045, alpha: 0.22 },
  L: { from: 'scatter', to: 'heart', t0: 170.5, t1: 177.0, size: 0.05, alpha: 0.36 },
  M: { from: 'heart', to: 'heart', t0: 186.0, t1: 188.0, size: 0.05, alpha: 0.34 },
  N: { from: 'heart', to: 'ring', t0: 196.0, t1: 203.0, size: 0.045, alpha: 0.24 },
}

/** 每段的配色（段 K 最暖、段 H 最冷） */
export const SEGMENT_COLORS = {
  A: ['#7fd8ff', '#9be8ff'],
  B: ['#6fd0ff', '#b48cff'],
  C: ['#7fd8ff', '#8ff0a4'],
  D: ['#5fe3c8', '#7fd8ff'],
  E: ['#ffd479', '#ff8fc8'],
  F: ['#8ff0a4', '#7fd8ff'],
  G: ['#ff8fc8', '#c792ea'],
  H: ['#5f7d9a', '#7fd8ff'],
  I: ['#ffd479', '#5fe3c8'],
  J: ['#ff9f6e', '#ff6b6b'],
  K: ['#ff6b6b', '#ffd479'],
  L: ['#c792ea', '#7fd8ff'],
  M: ['#ff8fc8', '#ff6b9d'],
  N: ['#ffd479', '#7fd8ff'],
}

/** 段边界（与 scenes/index.js 一致，用于把 t 归到某一段） */
const SEG_EDGES = [
  ['A', 0, 14.5], ['B', 14.5, 29.7], ['C', 29.7, 44.0], ['D', 44.0, 59.0],
  ['E', 59.0, 74.0], ['F', 74.0, 88.8], ['G', 88.8, 103.5], ['H', 103.5, 118.3],
  ['I', 118.3, 129.0], ['J', 129.0, 147.9], ['K', 147.9, 162.0], ['L', 162.0, 177.4],
  ['M', 177.4, 188.5], ['N', 188.5, 211.907],
]

/** 取 t 所属段落 id */
export function segAt(t) {
  let cur = 'A'
  for (const [id, a, b] of SEG_EDGES) if (t >= a && t < b) cur = id
  return cur
}

/**
 * T16b / FIX_V4 §1.4：「本段蜂群**不使用字符形态**」。
 * 为什么需要这个开关：3D 蜂群（`createSwarm`）的**每个粒子都是一枚字形** ——
 * 顶点着色器里有 `attribute vec2 aGlyph`，片元用 `vUv = aGlyph + uv / uAtlasGrid` 去采样
 * `glyphAtlas()` 那张图集；而 2D 蜂群（`lib/swarm2d.js`）是**方形 Points**（点/短横），本来就不是字符。
 * 所以"段 C 不用字符形态"= 段 C 期间**关掉 3D 字形层**，把画面交给段 C 自己的 `THREE.Points` 圆点云 + 2D 点层。
 * 默认返回 true（其它段落照旧用字形），在 `SEGMENT_SWARM` 里给某段写 `chars: false` 即可关掉。
 */
export function swarmCharsAt(t) {
  const cfg = SEGMENT_SWARM[segAt(t)]
  return !(cfg && cfg.chars === false)
}

/**
 * T44 / FIX_V5 §D 0:51「转速加快」：旋涡的**自转角**（弧度；纯函数 f(t)）。
 *
 * 为什么用"绝对角度"而不是"角速度 × t"：后者的加速度只能靠 `uSpin` 随时间变化，
 * 而角度 = t·ω(t) 的导数 = ω + t·ω′ —— t≈50 时 ω′ 被放大 50 倍，屏幕上是随机乱转。
 * 这里直接给角度：角速度从 `rate` 起、以 `accel`(rad/s²) 线性加速到窗口末，**窗口后冻结**。
 * 冻结不是偷懒：52.77 之后旋涡中心已成隧道入口，隧道自带流向，再让整片粒子继续加速打转
 * 只会把隧道糊掉（也会让 59.0 桥接出来的 cube 以 5rad/s 自转）。
 */
const SPIN = { D: { t0: 48.6, t1: 53.2, rate: 0.9, accel: 0.55 } }

function spinAngleAt(seg, t) {
  const s = SPIN[seg]
  if (!s) return 0
  const x = clamp(t - s.t0, 0, s.t1 - s.t0)
  return s.rate * x + 0.5 * s.accel * x * x // 0.9→3.4 rad/s，累计 ≈10.0rad（约 1.6 圈）
}

/**
 * 全片蜂群调度（纯函数，f(t)）。
 * 优先级：桥接窗口 > 段内形变窗 > 段常驻布局。
 * @param {number} t
 * @returns {{seg:string, from:string, to:string, u:number, bridge:object|null, at:number, size:number, alpha:number, colorA:string, colorB:string}}
 */
export function swarmScheduleAt(t) {
  const seg = segAt(t)
  const S = SEGMENT_SWARM[seg]
  const col = SEGMENT_COLORS[seg]
  const base = {
    seg,
    from: S.from,
    to: S.to,
    u: 1,
    bridge: null,
    at: -1,
    size: S.size,
    alpha: S.alpha,
    colorA: col[0],
    colorB: col[1],
    // T44：旋涡自转角（弧度）。其它段落恒 0 → 顶点着色器里的旋转是恒等变换。
    spin: spinAngleAt(seg, t),
  }
  // 段内形变窗：先飞向本段终点布局
  if (t >= S.t0 && t <= S.t1) {
    return { ...base, from: S.from, to: S.to, u: smoothstep(clamp(span(t, S.t0, S.t1))) }
  }
  if (t < S.t0) {
    return { ...base, from: S.from, to: S.from, u: 1 }
  }
  // 段末之后：交给桥接窗口；桥接窗口之外就停在下一段的常驻布局
  const next = SEGMENT_SWARM[SEG_EDGES[Math.min(SEG_EDGES.length - 1, SEG_EDGES.findIndex((e) => e[0] === seg) + 1)]?.[0]] || S
  return { ...base, from: next.from, to: next.from, u: 1 }
}

/**
 * 给定 t，返回蜂群当前的形变状态（纯函数）。
 * @param {number} t
 * @returns {{seg:string, from:string, to:string, u:number, bridge:object|null, at:number}}
 */
export function swarmStateAt(t) {
  let seg = 'A'
  for (const b of BRIDGES) {
    if (t >= b.at) seg = b.to
  }
  // 找最近的桥接窗口
  let active = null
  for (const b of BRIDGES) {
    if (t >= b.at - BRIDGE_HALF && t <= b.at + BRIDGE_HALF) {
      active = b
      break
    }
  }
  if (active) {
    const u = smoothstep(clamp(span(t, active.at - BRIDGE_HALF, active.at + BRIDGE_HALF)))
    const S = SEGMENT_SWARM[active.from] || SEGMENT_SWARM.A
    return {
      seg: u < 0.5 ? active.from : active.to,
      from: active.swarm[0],
      to: active.swarm[1],
      u,
      bridge: active,
      at: active.at,
      // 桥接途中把粒子吹散得更开、稍大一点（"溶解—重组"的手感）
      size: S.size * 1.12,
      alpha: Math.min(1, S.alpha + 0.1),
      colorA: (SEGMENT_COLORS[active.from] || SEGMENT_COLORS.A)[0],
      colorB: (SEGMENT_COLORS[active.to] || SEGMENT_COLORS.A)[1],
      // 桥接途中沿用"来向段"的自转角（D→E 时它是冻结值，所以旋涡不会在桥接里突然倒转）
      spin: spinAngleAt(active.from, t),
    }
  }
  // 段内形变窗 / 段常驻布局
  return swarmScheduleAt(t)
}

/* ------------------------------------------------------------------ *
 * 蜂群本体
 * ------------------------------------------------------------------ */

/** 字形图集：点、代码 token、数字、数学符号 */
function glyphAtlas(cell = 64, cols = 8) {
  const glyphs = []
  // 数字
  for (let i = 0; i <= 9; i++) glyphs.push(String(i))
  // 代码 token（标识符与关键字片段）
  for (const s of ['x', 't', 'k', 'v', 'Q', 'K', 'V', 'f', 'n', 'p', 'w', 'b', 'lr', 'dx', 'in', 'if', 'for', 'fn', 'def', 'sum']) glyphs.push(s)
  // 数学符号
  for (const s of ['∑', '∂', '∇', 'π', 'ε', 'θ', 'λ', 'Δ', '≈', '≠', '≤', '≥', '∞', '±', '√', '∈', '∅', '⊕', '→', '↦', '∀', '∃', '⊥', '∮']) glyphs.push(s)
  // 标点（当"点"用）
  for (const s of ['·', '∙', '○']) glyphs.push(s)
  const rows = Math.ceil(glyphs.length / cols)
  const cv = document.createElement('canvas')
  cv.width = cols * cell
  cv.height = rows * cell
  const g = cv.getContext('2d')
  g.clearRect(0, 0, cv.width, cv.height)
  g.fillStyle = '#fff'
  for (let i = 0; i < glyphs.length; i++) {
    const cx = (i % cols) * cell + cell / 2
    const cy = Math.floor(i / cols) * cell + cell / 2
    // 走 text() 的字号守卫（装饰代码档 ≥26px）
    text(g, glyphs[i], cx, cy, { role: 'codeDeco', size: 40, family: 'code', weight: 600, color: '#ffffff', align: 'center', baseline: 'middle' })
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return { texture: tex, cols, rows, cell, count: glyphs.length, glyphs }
}

const VERT = `
attribute vec3 aFrom;
attribute vec3 aTo;
attribute float aStagger;
attribute vec3 aRand;
attribute vec2 aGlyph;
uniform float uMix;
uniform float uStagger;
uniform float uSize;
uniform float uTime;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uSpread;
uniform float uSpin;
uniform float uBeat;
uniform vec2 uAtlasGrid;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float w = clamp((uMix - aStagger * uStagger) / max(0.0001, 1.0 - uStagger), 0.0, 1.0);
  float e = w * w * (3.0 - 2.0 * w);            // smoothstep 错峰
  vec3 p = mix(aFrom, aTo, e);
  // 形变途中给一点向外鼓的力，避免粒子走直线（"爆开再合"的手感）
  float bulge = sin(e * 3.14159) * (0.10 + 0.22 * aRand.x) * uSpread;
  vec3 dir = normalize(p + vec3(0.0001, 0.0001, 0.0001));
  // T52 / FIX_V5 §M 2:57「粉色爱心改为会跳动」：整颗心绕布局原点按脉搏缩放。
  // uBeat 恒为 1.0 的段落，(p + dir * bulge) * 1.0 与改动前**逐位相同**（×1.0 是精确运算）。
  p = (p + dir * bulge) * uBeat;
  // 常驻微动（纯函数：由 uTime 解析）
  p += vec3(
    sin(uTime * 0.7 + aRand.x * 6.28) * 0.012,
    cos(uTime * 0.6 + aRand.y * 6.28) * 0.012,
    sin(uTime * 0.5 + aRand.z * 6.28) * 0.012
  );
  // T44 / FIX_V5 §D 0:51「转速加快」：旋涡绕**视线轴**自转（uSpin = 绝对角度，来自 SPIN 表）。
  // 其它段落的 uSpin 恒为 0 → cos=1/sin=0，顶点输出与改动前逐位相同。
  float cs = cos(uSpin);
  float sn = sin(uSpin);
  p.xy = mat2(cs, -sn, sn, cs) * p.xy;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float sz = uSize * (0.55 + 0.85 * aRand.y) * (1.0 + 0.35 * (1.0 - e));
  mv.xy += position.xy * sz;
  // 字形图集：把四边形 uv 落到 aGlyph 指定的格子里
  vUv = aGlyph + uv / uAtlasGrid;
  vTint = vec3(0.55 + 0.6 * aRand.z, 0.75 + 0.25 * aRand.x, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = `
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uAlpha;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.12) discard;
  vec3 col = mix(uColorA, uColorB, vTint.x) * vTint.y;
  gl_FragColor = vec4(col, t.a * uAlpha);
}
`

/**
 * 建蜂群。
 * @param {{count?:number, seed?:number, size?:number}} [opts]
 */
export function createSwarm(opts = {}) {
  const { count = SWARM_COUNT, seed = 77, size = 0.05 } = opts

  const base = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.attributes.position = base.attributes.position
  geo.attributes.uv = base.attributes.uv

  // ---- 身份：构造时定死，之后永不改变 ----
  const rand = new Float32Array(count * 3)
  const stagger = new Float32Array(count)
  const glyph = new Float32Array(count * 2)
  const atlas = glyphAtlas()
  for (let i = 0; i < count; i++) {
    rand[i * 3] = hash01(i, seed + 201)
    rand[i * 3 + 1] = hash01(i, seed + 202)
    rand[i * 3 + 2] = hash01(i, seed + 203)
    stagger[i] = hash01(i, seed + 204) * 0.85
    const gi = Math.floor(hash01(i, seed + 205) * atlas.count) % atlas.count
    glyph[i * 2] = (gi % atlas.cols) / atlas.cols
    glyph[i * 2 + 1] = Math.floor(gi / atlas.cols) / atlas.rows
  }
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 3))
  geo.setAttribute('aStagger', new THREE.InstancedBufferAttribute(stagger, 1))
  geo.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(glyph, 2))
  const aFrom = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  const aTo = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  geo.setAttribute('aFrom', aFrom)
  geo.setAttribute('aTo', aTo)
  geo.instanceCount = count
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMix: { value: 0 },
      uStagger: { value: 0.72 },
      uSize: { value: size },
      uTime: { value: 0 },
      uAlpha: { value: 0.95 },
      uSpread: { value: 1 },
      uSpin: { value: 0 },
      // T52 / FIX_V5 §M 2:57：心跳缩放（1 = 不跳；其它段落恒 1）
      uBeat: { value: 1 },
      uAtlas: { value: atlas.texture },
      uAtlasGrid: { value: new THREE.Vector2(atlas.cols, atlas.rows) },
      uColorA: { value: new THREE.Color('#7fd8ff') },
      uColorB: { value: new THREE.Color('#c792ea') },
      uCamRight: { value: new THREE.Vector3(1, 0, 0) },
      uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Mesh(geo, mat)
  points.frustumCulled = false
  points.name = 'swarm'

  // ---- 布局缓存（取归一化后的数组） ----
  const cache = new Map()
  const layoutOf = (name) => {
    if (cache.has(name)) return cache.get(name)
    const rec = normalized(name, count, seed)
    cache.set(name, rec.arr)
    if (!norm.has(name)) norm.set(name, rec)
    return rec.arr
  }
  const norm = new Map()
  let curFrom = null
  let curTo = null
  let curPair = ''
  let identityHashCache = null

  /**
   * @param {number} t
   * @param {{camera?:THREE.Camera, alpha?:number, size?:number, spread?:number, spin?:number,
   *          beat?:number, colorA?:number|string, colorB?:number|string, state?:object}} [o]
   *   beat：T52 / §M 2:57 的心跳缩放（1 = 不跳）。恒 1 时顶点输出与改动前逐位相同。
   */
  function update(t, o = {}) {
    const { camera = null, alpha = 0.85, size: sz = null, spread = 1, colorA = null, colorB = null, spin = 0, beat = 1 } = o
    const st = o.state || swarmStateAt(t)
    const pair = `${st.from}>${st.to}`
    if (pair !== curPair) {
      curPair = pair
      curFrom = layoutOf(st.from)
      curTo = layoutOf(st.to)
      aFrom.array.set(curFrom)
      aTo.array.set(curTo)
      aFrom.needsUpdate = true
      aTo.needsUpdate = true
    }
    const U = mat.uniforms
    U.uMix.value = st.u
    U.uTime.value = t
    U.uAlpha.value = alpha
    U.uSpread.value = spread
    // T44：旋涡自转角（其它段落传 0）
    U.uSpin.value = spin
    // T52：心跳缩放（其它段落传 1）
    U.uBeat.value = beat
    if (sz != null) U.uSize.value = sz
    // 桥接时更"炸"一点：错峰更宽
    U.uStagger.value = st.bridge ? 0.8 : 0.5
    if (colorA != null) U.uColorA.value.set(colorA)
    if (colorB != null) U.uColorB.value.set(colorB)
    if (camera) {
      // 广告牌：把相机右/上向量传给顶点着色器
      const m = camera.matrixWorld.elements
      U.uCamRight.value.set(m[0], m[1], m[2])
      U.uCamUp.value.set(m[4], m[5], m[6])
    }
    return st
  }

  /** 身份哈希：aRand 与 aGlyph 的摘要。任何一次 update 都不应改变它。 */
  function identityHash() {
    if (identityHashCache != null) return identityHashCache
    let h = 2166136261 >>> 0
    const mix = (v) => {
      const x = Math.round(v * 1e6) | 0
      h ^= x & 0xff
      h = Math.imul(h, 16777619)
      h ^= (x >> 8) & 0xff
      h = Math.imul(h, 16777619)
      h ^= (x >> 16) & 0xff
      h = Math.imul(h, 16777619)
    }
    for (let i = 0; i < count; i += 7) {
      mix(rand[i * 3])
      mix(rand[i * 3 + 1])
      mix(rand[i * 3 + 2])
      mix(stagger[i])
      mix(glyph[i * 2])
      mix(glyph[i * 2 + 1])
    }
    identityHashCache = h >>> 0
    return identityHashCache
  }

  return {
    object: points,
    geometry: geo,
    material: mat,
    count,
    atlas,
    update,
    identityHash,
    stateAt: swarmStateAt,
    layoutOf,
    /**
     * 当前布局在**屏幕上**的覆盖范围（NDC），用来验证"蜂群全片在场"。
     * 取归一化后的布局数组逐点投影，返回 NDC 包围盒与"落在画面内的比例"。
     * @param {number} t
     * @param {THREE.Camera} camera
     */
    screenCoverage(t, camera) {
      const st = swarmStateAt(t)
      const a = layoutOf(st.from)
      const b = layoutOf(st.to)
      const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      const v = new THREE.Vector4()
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, inside = 0, n = 0
      for (let i = 0; i < count; i += 7) {
        const u = st.u
        const x = a[i * 3] + (b[i * 3] - a[i * 3]) * u
        const y = a[i * 3 + 1] + (b[i * 3 + 1] - a[i * 3 + 1]) * u
        const z = a[i * 3 + 2] + (b[i * 3 + 2] - a[i * 3 + 2]) * u
        v.set(x, y, z, 1).applyMatrix4(vp)
        if (v.w <= 0.05) continue
        const nx = v.x / v.w
        const ny = v.y / v.w
        if (nx < minX) minX = nx
        if (nx > maxX) maxX = nx
        if (ny < minY) minY = ny
        if (ny > maxY) maxY = ny
        if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) inside++
        n++
      }
      return {
        seg: st.seg,
        sampled: n,
        insideFrac: n ? inside / n : 0,
        // NDC 面积 / 画面面积（画面 = 2×2）
        areaFrac: n ? ((Math.min(maxX, 1) - Math.max(minX, -1)) * (Math.min(maxY, 1) - Math.max(minY, -1))) / 4 : 0,
        ndc: n ? [minX, minY, maxX, maxY] : null,
      }
    },
    /** 三角形数：每实例 2 个三角形 */
    triangles: count * 2,
    /** 供自检 */
    report: () => {
      // 所有布局都量一遍：归一化后中位半径应当全是 NOMINAL_R，
      // 否则"目标布局形变"会忽大忽小（第一版 ring 顶出画面、cloud 糊成一团就是因为没归一化）
      const rows = LAYOUT_NAMES.map((nm) => {
        const rec = normalized(nm, count, seed)
        return {
          name: nm,
          scale: +rec.scale.toFixed(4),
          r50: +(rec.r50 * rec.scale).toFixed(4),
          r95: +rec.r95Scaled.toFixed(4),
        }
      })
      const r50s = rows.map((r) => r.r50)
      const r95s = rows.map((r) => r.r95)
      return {
        count,
        triangles: count * 2,
        identityHash: identityHash(),
        layouts: LAYOUT_NAMES.length,
        bridges: BRIDGES.length,
        glyphs: atlas.count,
        forms: ['point', 'code-token', 'digit', 'math-symbol'],
        nominalR: NOMINAL_R,
        r50Min: +Math.min(...r50s).toFixed(4),
        r50Max: +Math.max(...r50s).toFixed(4),
        r95Min: +Math.min(...r95s).toFixed(4),
        r95Max: +Math.max(...r95s).toFixed(4),
        rows,
      }
    },
  }
}

export { smoothstep }
