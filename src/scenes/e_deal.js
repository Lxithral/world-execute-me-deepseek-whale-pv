// src/scenes/e_deal.js — 段 E 0:59–1:14.0 交易（副歌一，L3）
//
// ============================ 本段要落实的 FIX 条款 ============================
// FIX §3 段 E 原文（行末标注落实位置）：
//   · stimulation：大量彩色粒子迸发；超立方体巨大化并旋转；
//     **每小节首拍砸入一条 3D 挤出公式**（softmax / 交叉熵 / 注意力，确保公式正确）；
//     相机绕立方体环拍                                        → ① 超立方体 / ② 粒子迸发 /
//                                                              ③ 挤出公式 / rig.js 已给的轨道
//   · happy：W1 出场（见 §2.6）                               → 不画立绘；src/whale/cast.js 是权威
//   · execution：一个巨大的 3D ▶ 描边亮起并闪白                → ④ 挤出 ▶ + ⑤ 3D 白闪面
//   · trapped / strange simulation：透视网格墙从四周合拢成玻璃笼 → ⑥ 玻璃笼
// FIX §0.4：3D 为主（本文件**没有一处 Canvas2D 画主体**，全部挂在 ctx.three.stage3d 上）
// FIX §0.5：字号下限 → 所有画布文字都过 src/ui/text.js 的 text()（role=formula 的 125px 与
//           role=label 的 30px 都 ≥ 下限 80 / 22；见文件末尾的 measure 读数，?debug 可核对）
// FIX §0.6：禁止线性运动 → 所有位移/缩放走 src/core/ease.js（outBack / outCubic / outElastic /
//           smoothstep / inOutExpo），js 里没有任何一处 v += dt 式的线性累加
// FIX §2.1：相机由 src/core/rig.js 全权拥有（t=66.6 [1.4,0.5,3.0] fov42 → t=74.0 [0.4,-0.1,3.4]
//           fov40 本来就是"绕超立方体环拍"），本文件**不建相机**，只按相机位置做取景标定
// FIX §2.2：所有事件时刻来自词锚点 ctx.cues.sec('E', key, fallback)，一个绝对秒数都没写
// FIX §5.0：旧 e_deal.js 视为素材库 → 迁移了它的三样"真实计算"：
//   ① SLAM_FORMULAS（每小节一条公式，但公式串全部来自 src/lib/formula.js 的 FORMULAS）；
//   ② CELLS = 14 的奖励条充能进度；③ sync.spectrumAt / softmaxFromSpectrum / crossEntropy /
//      attentionFromSpectrum 的真实数值读数。画面全部重做成 3D。
// 旧文件里违反本段要求、已删除的东西：Canvas2D 的径向辉光铺底、2D 奖励条、2D ▶、
//   2D 透视栅栏"笼"、以及 ctx.whale.sprite 立绘请求（§5.1 明文禁止本段画立绘）。
//
// ============================ 世界坐标约定（关键） ============================
// 1 世界单位 = 半屏高。透视相机（compositor.js 建的，layer 1）在 z≈3.0 处，
// 原点处可见高 = 2 * 3.0 * tan(42°/2) ≈ 2.30 世界单位。
// 换算全部走 scene3d.js 的 pxPerUnitAt(camera, z, 1080)，不手抄常数：
//   · 公式面片放在 z = FZ = cameraZ − 1.6 处 → 距离恒定 1.6 → 屏幕上 ≈338 px/单位；
//     画布里 fontPx=125 的字面高折成世界 0.23 → 屏上 ≈78px 字面；实测"有墨迹的包围盒
//     高"更大（≈124px），远高于 §0.5 的公式下限 80px（?debug 里直接打印实测值）。
//   · 超立方体直径 1.7–2.0 世界单位 → 占画面高 74–87%，真的"巨大化并旋转"。
//   · ▶ 高 1.35 世界单位 → 占画面高约 59%。

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span, smoothstep, outCubic, outBack, outElastic, inOutExpo, TAU } from '../core/ease.js'
// ⚠️ 颜色插值必须用 mixHex（palette.js），**不能**用 ease.js 的 mix ——
// 后者是 `lerp` 的别名，面向数值；拿它插 '#7f5cc8' / '#54e0ff' 会得到
// `'#7f5cc8' + ('#54e0ff' - '#7f5cc8') * k` 这种字符串运算，
// 结果是 `#7f5cc8NaN`。THREE.Color 解析不了，每帧刷 "Unknown color" 警告，
// 还会把色值变成 NaN → 画面异常、`?probe=textscan` 那种长扫描直接卡死。
import { mixHex } from '../core/palette.js'
import { hash01 } from '../core/rng.js'
import { text, TEXT_MIN, setTextureSpace, isTextureSpace } from '../ui/text.js'
import {
  textPlane,
  voxelField,
  createLightRigSafe,
  pxPerUnitAt,
} from '../lib/scene3d.js'
import { createHypercube } from '../lib/three_util.js'
import { FORMULAS, softmaxFromSpectrum, crossEntropy, attentionFromSpectrum } from '../lib/formula.js'
import { timeline } from './_seg.js'

/* ================================================================== *
 * 0) 常量：公式表、奖励条格数、取景标定
 * ================================================================== */

/**
 * 每小节砸入的一条公式。
 *
 * `text` 直接取自 src/lib/formula.js 的 FORMULAS —— 数学上正确是硬要求（§3 E 明写
 * "确保公式正确"），所以不在这里重写公式串，只在这里改用哪一条、标注什么名字。
 *   softmax(z)_i = exp(z_i) / Σ_j exp(z_j)        逐项归一化，分母对**所有** j 求和
 *   L = −Σ_i y_i log p_i                          交叉熵（one-hot 时退化为 −log p_c）
 *   Attention(Q,K,V) = softmax(QKᵀ/√d_k)V         缩放点积注意力
 * lines 里的断行只是排版；渲染时会用 measureText 复核，放不下会继续折。
 */
const SLAM_FORMULAS = [
  { label: 'softmax', text: FORMULAS.softmax, lines: ['softmax(z)_i = exp(z_i)', '/ Σ_j exp(z_j)'] },
  { label: 'cross-entropy', text: FORMULAS.crossentropy, lines: ['L = −Σ_i y_i log p_i'] },
  { label: 'attention', text: FORMULAS.attention, lines: ['Attention(Q,K,V) =', 'softmax(QKᵀ/√d_k)V'] },
]

/** 奖励条格数（旧文件 CELLS = 14，迁移保留：0..1 的进度 × 14 格） */
const CELLS = 14

/** 公式面片到相机的恒定距离（世界单位）。取 1.6 见文件头标定说明。 */
const FORMULA_DIST = 1.6
/** 公式面片的画布字号（px）。125 ≥ §0.5 的 formula 下限 80；padding 取 0.25em 防止斜体/符号被裁 */
const FORMULA_FONT_PX = 125
const FORMULA_PAD = 0.25
/** 挤出厚度（画布 px）；世界厚度 = 该值 / (canvasH / worldH)，由 buildExtruded 反算 */
const EXTRUDE_PX = 18
/**
 * 挤出的"圆角"分片数。
 * 侧面没有在轮廓上做布尔运算（那需要字形轮廓而不是位图掩码），
 * 而是在每个凸出像素块的四边各挂一片厚度面、沿 z 分 STEPS 段并把中段微微内收 ——
 * 于是侧壁是圆的，转折处不生硬，观感与真挤出一致（并且不依赖任何字体文件）。
 */
const EXTRUDE_STEPS = 6
/** 用于算挤出侧壁颜色的内收量（固定 NDC z 偏移，与相机距离无关） */
const SIDE_Z = 0.0006

/**
 * 把一串行按"下一个字符放得下吗"折行（贪心，优先在空格后断）。
 * 为什么必须实测宽度再折行：§0.5 要求公式字 ≥80px，而"能不能保住字高"取决于
 * 最长一行在屏幕上占多宽。折行位置不能靠肉眼数字符 —— 用 canvas 的 measureText 实测，
 * 且折行后仍放不下时必须抛错，而不是悄悄画到画面外。
 * @returns {string[]}
 */
function wrapLines(lines, meas, maxW) {
  const out = []
  for (const L of lines) {
    if (meas.measureText(L).width <= maxW) {
      out.push(L)
      continue
    }
    let cur = ''
    for (const w of String(L).split(' ')) {
      const cand = cur ? cur + ' ' + w : w
      if (cur && meas.measureText(cand).width > maxW) {
        out.push(cur)
        cur = w
      } else {
        cur = cand
      }
    }
    if (cur) out.push(cur)
  }
  for (const L of out) {
    if (meas.measureText(L).width > maxW) {
      throw new Error(`[e_deal] 公式行 "${L}" 在 ${FORMULA_FONT_PX}px 下宽于可用宽度 —— 必须继续折行`)
    }
  }
  return out
}

/* ================================================================== *
 * 1) 位图 → 真 3D 挤出：像素掩码贪心合并成矩形 → 盒体外壳
 * ================================================================== */

/**
 * 把一行一行的像素掩码贪心合并成矩形（先横向并成游程，再纵向合并完全对齐的游程）。
 * 为什么贪心而不是 marching squares 描轮廓：描轮廓在字形有内孔（o / e / 0）与多连通
 * （i 的两块、等号的四条）时会退化成"外轮廓 + 内轮廓"两级结构，工作量翻倍且容易出错；
 * 矩形分解对任意拓扑都成立，且这里的盒体是**内容**（公式字）而不是主体，
 * 面数由 MAX_RECTS 兜住即可。
 * @param {Uint8Array} mask 1 = 有墨迹
 * @param {number} w
 * @param {number} h
 * @returns {Array<[number,number,number,number]>} [x0, y0, x1excl, y1excl)
 */
function rectsFromMask(mask, w, h) {
  const out = []
  let prev = [] // 上一行的游程，元素 [x0, x1excl, yStart]
  for (let y = 0; y <= h; y++) {
    const cur = []
    if (y < h) {
      let x = 0
      while (x < w) {
        if (!mask[y * w + x]) {
          x++
          continue
        }
        const x0 = x
        while (x < w && mask[y * w + x]) x++
        cur.push([x0, x, y])
      }
    }
    const kept = []
    for (const r of cur) {
      let merged = false
      for (const p of prev) {
        if (p[0] === r[0] && p[1] === r[1]) {
          p[3] = y + 1 // 同一段继续往下长
          kept.push(p)
          merged = true
          break
        }
      }
      if (!merged) {
        const nr = [r[0], r[1], y, y + 1]
        out.push(nr)
        kept.push(nr)
      }
    }
    prev = kept
  }
  return out
}

/**
 * 由一串行（lines）造出**真 3D 挤出的公式块**。
 *
 * 流程：Canvas2D 出位图（文字经 ui/text.js 的 text()，受 §0.5 字号守卫）
 *   → getImageData 取 alpha → 二值掩码 → 矩形分解 → 生成"前盖 + 后盖 + 沿 z 分片的侧壁"
 *   的 BufferGeometry。
 *
 * 为什么不用 THREE.FontLoader + ExtrudeGeometry：那需要一份 typeface.json 字体文件。
 * 本项目里没有（只有 node_modules/three/examples/fonts 下的一份，vite 不能从源码 import
 * node_modules 的 json 进产物），而本轮只允许改这一个文件，不能往 public/ 里加资源。
 * 位图 → 几何的做法不依赖任何外部资源，字宽也是实测的。
 *
 * @param {Array<{s:string, color?:string, glow?:number}>} nodes 文字节点（各自带颜色/发光）
 * @param {{role?:string, fontPx?:number, weight?:number,
 *          padEm?:number, depthWorld?:number, maxWidthPx?:number}} o
 *   depthWorld: 挤出厚度（世界单位）
 */
function buildExtrudedText(nodes, o = {}) {
  const {
    role = 'formula',
    fontPx = FORMULA_FONT_PX,
    weight = 700,
    padEm = FORMULA_PAD,
    depthWorld = 0.075,
    maxWidthPx = 1400,
  } = o
  const min = TEXT_MIN[role] != null ? TEXT_MIN[role] : 22
  // §0.5：字号下限。这里先自己硬校验一次（text() 内部还会再兜一次并记违规）
  if (fontPx < min) throw new Error(`[e_deal] role=${role} 字号 ${fontPx} < 下限 ${min}`)

  const STACK = '"JetBrains Mono", Consolas, "PingFang SC", monospace'
  const font = `${weight} ${fontPx}px ${STACK}`
  const meas = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  meas.font = font

  const list = Array.isArray(nodes) ? nodes : [{ s: String(nodes) }]
  const raw = []
  for (const n of list) for (const L of String(n.s).split('\n')) raw.push({ s: L, color: n.color, glow: n.glow })
  // 折行：实测宽度，超出 maxWidthPx 就在空格处断开（放不下就抛错，不静默画到画面外）
  const laid = []
  for (const r of raw) {
    for (const L of wrapLines([r.s], meas, maxWidthPx)) laid.push({ s: L, color: r.color, glow: r.glow })
  }

  const pad = Math.round(fontPx * padEm)
  let maxW = 8
  for (const r of laid) maxW = Math.max(maxW, meas.measureText(r.s).width)
  const cw = Math.ceil(maxW) + pad * 2
  // 行高 1.18em + 上下各 0.15em 留白（给上下标 / Σ 的升降部留位置，避免被裁）
  const rowH = fontPx * 1.18
  const ch = Math.ceil(rowH * laid.length + fontPx * 0.3)

  // 单个节点先画到自己的小画布（这样"发光副本"整块平移叠画即可，不用重画文字）
  const nodeCv = document.createElement('canvas')
  nodeCv.width = cw
  nodeCv.height = Math.ceil(rowH * 1.6)
  const ng = nodeCv.getContext('2d', { willReadFrequently: true })

  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const g = cv.getContext('2d', { willReadFrequently: true })
  g.clearRect(0, 0, cw, ch)
  const y0 = ch / 2 - ((laid.length - 1) * rowH) / 2
  for (let i = 0; i < laid.length; i++) {
    const r = laid[i]
    ng.clearRect(0, 0, nodeCv.width, nodeCv.height)
    // 唯一入口：ui/text.js 的 text()（§0.5 的字号守卫在这里生效）。
    // 这里的 canvas 是**贴图**（公式的挤出字面），坐标只在这块画布里有效，
    // 所以必须在"贴图空间"里画，否则 §2.8 会把整片公式按贴图坐标登记成屏幕包围盒 ——
    // 实测那些公式片全部报在 (31,56) 处 IoU 高达 0.99，是纯粹的假重叠。
    const prevTS = isTextureSpace()
    setTextureSpace(true)
    text(ng, r.s, pad, nodeCv.height / 2, {
      role,
      size: fontPx,
      family: 'code',
      weight,
      color: r.color || '#ffffff',
      align: 'left',
      baseline: 'middle',
      alpha: 1,
    })
    setTextureSpace(prevTS)
    const cy = y0 + i * rowH
    // 发光：把同一块图元沿一圈小幅平移叠画 —— 观感上就是"描边 + 自发光"，
    // 比 shadowBlur 更可控（不会把颜色晕成灰），而且与阈值取掩码互不干扰。
    const glow = r.glow == null ? 0 : r.glow
    if (glow > 0) {
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha = 0.3 * glow
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        g.drawImage(nodeCv, Math.cos(a) * fontPx * 0.055, cy - nodeCv.height / 2 + Math.sin(a) * fontPx * 0.055)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }
    g.drawImage(nodeCv, 0, cy - nodeCv.height / 2)
  }

  // ---- 位图 → 掩码 ----
  const img = g.getImageData(0, 0, cw, ch)
  const px = img.data
  const mask = new Uint8Array(cw * ch)
  let x0 = cw, x1 = 0, y0m = ch, y1m = 0
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (px[(y * cw + x) * 4 + 3] < 140) continue // 阈值 140/255：滤掉抗锯齿的 1px 灰边
      mask[y * cw + x] = 1
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0m) y0m = y
      if (y > y1m) y1m = y
    }
  }
  const planeH = (fontPx / 540) * (ch / fontPx) // = ch / 540：面片世界高（1 单位 = 540 画布 px）
  const planeW = cw / 540
  const glyphPx = y1m > y0m ? y1m - y0m + 1 : fontPx

  let rects = rectsFromMask(mask, cw, ch)
  // 面数兜底：矩形太多时按 2px 网格重采样（只在极端字号下才会触发）
  if (rects.length > 900) {
    const m2 = new Uint8Array(cw * ch)
    for (let y = 0; y < ch; y += 2) {
      for (let x = 0; x < cw; x += 2) {
        if (!mask[y * cw + x]) continue
        m2[y * cw + x] = 1
        if (x + 1 < cw) m2[y * cw + x + 1] = 1
        if (y + 1 < ch) m2[(y + 1) * cw + x] = 1
        if (x + 1 < cw && y + 1 < ch) m2[(y + 1) * cw + x + 1] = 1
      }
    }
    rects = rectsFromMask(m2, cw, ch)
  }

  // ---- 矩形 → 盒体外壳 ----
  const S = 1 / 540 // 画布 px → 世界单位
  const halfH = (ch * S) / 2
  const halfW = (cw * S) / 2
  const zf = depthWorld / 2
  const pos = []
  const nrm = []
  const uv = []
  const grp = []
  const quad = (ax, ay, az, bx, by, bz, cx2, cy2, cz2, dx, dy, dz, nx, ny, nz, uvs) => {
    const base = pos.length / 3
    pos.push(ax, ay, az, bx, by, bz, cx2, cy2, cz2, ax, ay, az, cx2, cy2, cz2, dx, dy, dz)
    for (let k = 0; k < 6; k++) nrm.push(nx, ny, nz)
    uv.push(...uvs)
    grp.push(base, 6, 0)
  }
  for (const r of rects) {
    const rx0 = r[0] * S - halfW
    const rx1 = r[1] * S - halfW
    const ry1 = halfH - r[2] * S
    const ry0 = halfH - r[3] * S
    const u0 = r[0] / cw
    const u1 = r[1] / cw
    const v1 = 1 - r[2] / ch
    const v0 = 1 - r[3] / ch
    // 前盖（z = +zf，uv 取自位图的同一块）
    quad(rx0, ry0, zf, rx1, ry0, zf, rx1, ry1, zf, rx0, ry1, zf, 0, 0, 1, [u0, v0, u1, v0, u1, v1, u0, v1])
    // 后盖
    quad(rx1, ry0, -zf, rx0, ry0, -zf, rx0, ry1, -zf, rx1, ry1, -zf, 0, 0, -1, [u1, v0, u0, v0, u0, v1, u1, v1])
    // 侧壁：四边各一片，沿 z 分 STEPS 段、中间微微内收（圆角感）
    const sides = [
      [rx0, ry0, rx0, ry1, -1, 0], // 左
      [rx1, ry1, rx1, ry0, 1, 0], // 右
      [rx0, ry1, rx1, ry1, 0, 1], // 上
      [rx1, ry0, rx0, ry0, 0, -1], // 下
    ]
    const eu = [u0, v0, u1, v0, u1, v1, u0, v1]
    for (const s of sides) {
      for (let k = 0; k < EXTRUDE_STEPS; k++) {
        const zA = -zf + (depthWorld * k) / EXTRUDE_STEPS
        const zB = -zf + (depthWorld * (k + 1)) / EXTRUDE_STEPS
        const zAs = zA + (k === 0 || k === EXTRUDE_STEPS - 1 ? 0 : SIDE_Z)
        const zBs = zB + (k === 0 || k === EXTRUDE_STEPS - 1 ? 0 : SIDE_Z)
        quad(s[0], s[1], zAs, s[2], s[3], zAs, s[2], s[3], zBs, s[0], s[1], zBs, s[4], s[5], 0, eu)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(null)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  const faceMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const sideMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(geo, [faceMat, sideMat])
  mesh.frustumCulled = false
  mesh.name = `extruded:${laid.map((r) => r.s).join(' ').slice(0, 16)}`

  return {
    object: mesh,
    faceMat,
    sideMat,
    width: planeW,
    height: planeH,
    glyphPx,
    quads: rects.length,
    tris: (pos.length / 3 / 3) | 0,
    /** 侧壁随主线颜色（略压暗、略偏冷，才有"厚度"的层次） */
    setColors(face, side) {
      faceMat.color.set(face)
      sideMat.color.set(side)
    },
    setOpacity(a) {
      const v = clamp(a)
      faceMat.opacity = v
      sideMat.opacity = v * 0.92
    },
    dispose() {
      tex.dispose()
      faceMat.dispose()
      sideMat.dispose()
      geo.dispose()
    },
  }
}

/**
 * 带缓存的公式面片工厂。
 * 键是**几何**（节点里的文字 + 字号 + 厚度），因为挤出几何是纯函数产物；
 * 颜色只是材质的乘子，每帧改也不重建几何。缓存之后每个公式一生只付一次构造成本。
 */
function makeFormulaFactory() {
  const cache = new Map()
  return {
    /**
     * @param {Array<{s:string,color?:string,glow?:number}>} nodes
     * @param {{face:string, side:string}} tint
     */
    get(nodes, tint) {
      const key = nodes.map((n) => `${n.s}|${n.color}|${n.glow}`).join('\n')
      let e = cache.get(key)
      if (!e) {
        e = buildExtrudedText(nodes, {
          role: 'formula',
          fontPx: FORMULA_FONT_PX,
          depthWorld: 0.075,
        })
        cache.set(key, e)
      }
      e.setColors(tint.face, tint.side)
      return e
    },
    dispose() {
      for (const e of cache.values()) e.dispose()
      cache.clear()
    },
  }
}

/* ================================================================== *
 * 2) 3D 粒子迸发（缓冲预分配 + geometry.groups 按起音点分段）
 * ================================================================== */

const BURST_PER = 340
const BURST_MAX = 9

/** 六色迸发调色板（FIX §3 E："大量**彩色**粒子迸发"） */
const BURST_COLORS = [0xff6bd6, 0x7fe7ff, 0xffd479, 0x9d7bff, 0x7dffb0, 0xff8a5c]

/**
 * 一次迸发的解析位置。
 * 全部由 dt 解析求出（§6：禁止线性运动 —— 半径走 (1−e^{−2.6dt}) 的指数趋近，竖直方向
 * 走带阻尼的抛物线，没有任何 v += a*dt 的累积）。
 */
function burstPos(out, i, ox, oy, oz, dx, dy, dz, dt, spread) {
  const rad = (1 - Math.exp(-2.6 * dt)) * spread
  const rise = dy * 0.95 * dt - 0.62 * dt * dt
  out[i * 3] = ox + dx * rad
  out[i * 3 + 1] = clamp(oy + rise, -1.5, 1.5)
  out[i * 3 + 2] = oz + dz * rad
}

/* ================================================================== *
 * T18a / FIX_V4 §1.6 E1：**3D 神经网络**（信号脉冲逐层传播，相机推进，青→洋红）
 * ------------------------------------------------------------------
 * 4 层，节点数 4/6/6/4 = 20；相邻层**全连接** 24+36+24 = 84 条线。
 * 节点用 InstancedMesh + 逐实例颜色：色相随层从 **青(0.50) → 洋红(0.83)**，亮度随"脉冲扫过"变亮。
 * "逐层传播"就是让一个 `sweep` 值随时间在 0..3 层之间推进，离 sweep 越近的层越亮 ——
 * 于是脉冲**一层一层**过去，而不是整体一起闪。
 * 相机推进的观感用 `object.position.z` 从 0.9 推到 −0.6（靠近观众）+ 整体缓慢放大实现。
 * ================================================================== */
const NET_LAYERS = [4, 6, 6, 4]
const NET_X = [-1.25, -0.42, 0.42, 1.25]

/**
 * T45 / FIX_V5 §E（1:05，词锚点 `satisfaction` 65.70）：
 * 「删除右侧「太阳」(金宝珠与放射光线)。satisfaction 一拍改为:3D 奖励曲线——一条发光折线
 *   随每个起音点向右上攀升,线头是亮点并拖出粒子尾迹,曲线下方有渐变填充,相机缓慢横移;
 *   配色金→白,但不得有圆盘形主体。」
 *
 * 为什么必须替换掉原来的 `buildRewardOrb`（球壳 ×2 + 12 根锥）：它正好落进 G9 的**结构**判据
 * 「同一父节点下 ≥1 个圆盘/球 + ≥6 根锥/盒/柱」（`src/ui/globalrules.js` 的 `sunStructures()` ②），
 * 实测 64.8–68.2s 报 `e:orb 2disc+12rays`（T42 的 g9 FAIL 之一，FIX_V5 §E 点名删）。
 *
 * 画法要点：
 *   · 折线是**带状 mesh**（三角带 + 逐顶点 RGBA），不是 `THREE.Line` —— LineBasicMaterial 的
 *     `lineWidth` 在绝大多数平台被忽略（恒 1px），画不出"发光折线 + 粗线头"；
 *   · "随每个起音点向右上攀升"= 折线的**揭示进度 u** 由 `satisfaction` 窗口内的起音点定相
 *     （每过一个起音点跳一级，级内连续推进），折线形状本身是 8 级阶梯（折角清楚）；
 *   · 线头亮点 = `Sprite`（径向渐变贴图），尾迹 = `Points`（逐顶点 α 递减、跟随线头）；
 *   · 曲线下方渐变填充 = 第二条三角带（曲线侧 α 高、基线侧 α→0）；
 *   · 整组只有 4 个子节点、无球/圆盘类几何 ⇒ 结构上不可能再命中 G9②。
 */
const REW_STAIRS = 8 // 折线的折点数（阶梯式攀升；"折线"而不是光滑曲线）
const REW_PTS = 96 // 折线采样点数
const REW_TRAIL = 72 // 尾迹粒子数
const REW_X0 = -0.62
const REW_X1 = 0.54
const REW_Y0 = -0.34
const REW_Y1 = 0.4

/** s∈[0,1] → 阶梯攀升量 [0,1]：每级"先升后平"，转折处是折角 */
function rewardStair(s) {
  const x = clamp(s) * REW_STAIRS
  const k = Math.min(REW_STAIRS - 1, Math.floor(x))
  const f = x - k
  const r = f < 0.45 ? f / 0.45 : 1
  return (k + r) / REW_STAIRS
}

/** 64px 径向渐变贴图（线头亮点与尾迹粒子共用；否则 `Points` 画出来是方块） */
function rewardDotTexture(size = 64) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  const r = size / 2
  const grd = g.createRadialGradient(r, r, 0, r, r, r)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 三角带索引：2 行 × n 列（第 0 行 = 曲线/上沿，第 1 行 = 下沿） */
function ribbonIndex(n) {
  const idx = []
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  return idx
}

function buildRewardCurve() {
  const grp = new THREE.Group()
  grp.name = 'e:reward'
  const GOLD = new THREE.Color(0xffd479)
  const WHITE = new THREE.Color(0xffffff)
  const tmp = new THREE.Color()

  const lineGeo = new THREE.BufferGeometry()
  const linePos = new Float32Array(REW_PTS * 2 * 3)
  const lineCol = new Float32Array(REW_PTS * 2 * 4)
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage))
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 4).setUsage(THREE.DynamicDrawUsage))
  lineGeo.setIndex(ribbonIndex(REW_PTS))
  const lineMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const line = new THREE.Mesh(lineGeo, lineMat)
  line.frustumCulled = false
  line.renderOrder = 26
  grp.add(line)

  const fillGeo = new THREE.BufferGeometry()
  const fillPos = new Float32Array(REW_PTS * 2 * 3)
  const fillCol = new Float32Array(REW_PTS * 2 * 4)
  fillGeo.setAttribute('position', new THREE.BufferAttribute(fillPos, 3).setUsage(THREE.DynamicDrawUsage))
  fillGeo.setAttribute('color', new THREE.BufferAttribute(fillCol, 4).setUsage(THREE.DynamicDrawUsage))
  fillGeo.setIndex(ribbonIndex(REW_PTS))
  const fillMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const fill = new THREE.Mesh(fillGeo, fillMat)
  fill.frustumCulled = false
  fill.renderOrder = 24
  grp.add(fill)

  const dotTex = rewardDotTexture(64)
  const head = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTex,
      color: 0xffd479,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0,
    }),
  )
  head.frustumCulled = false
  head.renderOrder = 27
  head.scale.setScalar(0.16)
  grp.add(head)

  const trailGeo = new THREE.BufferGeometry()
  const trailPos = new Float32Array(REW_TRAIL * 3)
  const trailCol = new Float32Array(REW_TRAIL * 4)
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage))
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 4).setUsage(THREE.DynamicDrawUsage))
  const trailMat = new THREE.PointsMaterial({
    size: 0.045,
    map: dotTex,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const trail = new THREE.Points(trailGeo, trailMat)
  trail.frustumCulled = false
  trail.renderOrder = 25
  grp.add(trail)

  const curveX = (s) => REW_X0 + (REW_X1 - REW_X0) * s
  const curveY = (s) => REW_Y0 + (REW_Y1 - REW_Y0) * rewardStair(s)
  const BASE_Y = REW_Y0 - 0.12

  return {
    object: grp,
    line: line,
    fill: fill,
    head: head,
    trail: trail,
    update(t, o = {}) {
      const alpha = clamp(o.alpha == null ? 1 : o.alpha)
      const u = clamp(o.u == null ? 1 : o.u)
      const white = clamp(o.white == null ? 0 : o.white)
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      const hx = curveX(u)
      const hy = curveY(u)
      const wid = (s) => (0.012 + 0.03 * s) * 0.5

      for (let i = 0; i < REW_PTS; i++) {
        const s = i / (REW_PTS - 1)
        const on = s <= u
        const x = on ? curveX(s) : hx
        const y = on ? curveY(s) : hy
        // 切线 → 法线：带宽沿法向，折角处不会变细
        const s2 = Math.min(1, s + 0.01)
        const s1 = Math.max(0, s - 0.01)
        const tx = (REW_X1 - REW_X0) * (s2 - s1)
        const ty = (REW_Y1 - REW_Y0) * (rewardStair(s2) - rewardStair(s1))
        const L = Math.hypot(tx, ty) || 1
        const nx = -ty / L
        const ny = tx / L
        const w = on ? wid(s) : 0
        linePos[i * 6 + 0] = x - nx * w
        linePos[i * 6 + 1] = y - ny * w
        linePos[i * 6 + 2] = 0
        linePos[i * 6 + 3] = x + nx * w
        linePos[i * 6 + 4] = y + ny * w
        linePos[i * 6 + 5] = 0
        tmp.copy(GOLD).lerp(WHITE, clamp(0.15 + 0.85 * (s * 0.5 + white * 0.8)))
        for (let k = 0; k < 2; k++) {
          const c = i * 8 + k * 4
          lineCol[c + 0] = tmp.r
          lineCol[c + 1] = tmp.g
          lineCol[c + 2] = tmp.b
          lineCol[c + 3] = on ? 1 : 0
        }
        // 填充：上沿贴着曲线，下沿落到基线；纵向 α 由 0.34 → 0.02
        fillPos[i * 6 + 0] = x
        fillPos[i * 6 + 1] = y
        fillPos[i * 6 + 2] = -0.002
        fillPos[i * 6 + 3] = on ? curveX(s) : hx
        fillPos[i * 6 + 4] = BASE_Y
        fillPos[i * 6 + 5] = -0.002
        tmp.copy(GOLD).lerp(WHITE, clamp(0.1 + 0.9 * white))
        for (let k = 0; k < 2; k++) {
          const c = i * 8 + k * 4
          fillCol[c + 0] = tmp.r
          fillCol[c + 1] = tmp.g
          fillCol[c + 2] = tmp.b
          fillCol[c + 3] = on ? (k === 0 ? 0.34 : 0.02) : 0
        }
      }
      lineGeo.attributes.position.needsUpdate = true
      lineGeo.attributes.color.needsUpdate = true
      fillGeo.attributes.position.needsUpdate = true
      fillGeo.attributes.color.needsUpdate = true
      lineMat.opacity = alpha
      fillMat.opacity = alpha

      // 线头亮点（呼吸 + 跟随线头）
      head.position.set(hx, hy, 0.02)
      head.material.opacity = alpha * (0.8 + 0.2 * Math.sin(t * 6))
      head.scale.setScalar(0.14 + 0.035 * (1 + Math.sin(t * 6)))
      head.material.color.copy(tmp.copy(GOLD).lerp(WHITE, white))

      // 尾迹：沿线头之后 0.3 个参数段拖出，逐粒子 α 递减
      for (let j = 0; j < REW_TRAIL; j++) {
        const lag = (j + 1) / REW_TRAIL
        const s = u - lag * 0.3
        const on = s >= 0
        const jx = (hash01(j, 91) - 0.5) * 0.035
        const jy = (hash01(j, 92) - 0.5) * 0.035 + 0.012 * Math.sin(t * 3.1 + j * 0.9)
        trailPos[j * 3 + 0] = on ? curveX(s) + jx : hx
        trailPos[j * 3 + 1] = on ? curveY(s) + jy : hy
        trailPos[j * 3 + 2] = -0.01 - 0.02 * lag
        tmp.copy(WHITE).lerp(GOLD, lag * 0.85 + 0.1 * (1 - white))
        trailCol[j * 4 + 0] = tmp.r
        trailCol[j * 4 + 1] = tmp.g
        trailCol[j * 4 + 2] = tmp.b
        trailCol[j * 4 + 3] = on ? Math.pow(1 - lag, 1.6) : 0
      }
      trailGeo.attributes.position.needsUpdate = true
      trailGeo.attributes.color.needsUpdate = true
      trailMat.opacity = alpha
    },
    dispose() {
      lineGeo.dispose()
      lineMat.dispose()
      fillGeo.dispose()
      fillMat.dispose()
      trailGeo.dispose()
      trailMat.dispose()
      head.material.dispose()
      dotTex.dispose()
    },
  }
}

function buildNeuralNet() {
  const grp = new THREE.Group()
  grp.name = 'e:net'
  const nodes = []
  for (let L = 0; L < NET_LAYERS.length; L++) {
    const n = NET_LAYERS[L]
    for (let i = 0; i < n; i++) {
      nodes.push({ L: L, x: NET_X[L], y: (i - (n - 1) / 2) * 0.34 })
    }
  }
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), mat, nodes.length)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 3), 3)
  mesh.frustumCulled = false
  // 相邻层全连接
  const seg = []
  for (let L = 0; L + 1 < NET_LAYERS.length; L++) {
    for (const a of nodes.filter((q) => q.L === L)) {
      for (const b of nodes.filter((q) => q.L === L + 1)) seg.push(a.x, a.y, 0, b.x, b.y, 0)
    }
  }
  const lgeo = new THREE.BufferGeometry()
  lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg), 3))
  const lmat = new THREE.LineBasicMaterial({
    color: 0x7fe6ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const lines = new THREE.LineSegments(lgeo, lmat)
  lines.frustumCulled = false
  grp.add(lines, mesh)
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  return {
    object: grp,
    mesh: mesh,
    nodes: nodes,
    update(t, o = {}) {
      const alpha = o.alpha == null ? 1 : o.alpha
      const u = o.u == null ? 0 : o.u
      const advance = o.advance == null ? 0 : o.advance
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      mat.opacity = alpha
      lmat.opacity = 0.16 * alpha
      grp.position.z = 0.9 - 1.5 * advance
      grp.scale.setScalar(1 + 0.35 * advance)
      const sweep = (u * 3) % 3 // 0..3 层之间推进
      for (let k = 0; k < nodes.length; k++) {
        const nd = nodes[k]
        const hot = Math.max(0, 1 - Math.abs(nd.L - sweep))
        dummy.position.set(nd.x, nd.y, 0)
        dummy.scale.setScalar(0.7 + 1.5 * hot)
        dummy.updateMatrix()
        mesh.setMatrixAt(k, dummy.matrix)
        // 青(0.50) → 洋红(0.83)
        col.setHSL(0.5 + 0.33 * (nd.L / 3), 0.85, 0.32 + 0.42 * hot)
        mesh.setColorAt(k, col)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
  }
}

function createBurst(count) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 220 } },
    vertexShader: `
      attribute vec3 aDir;
      attribute vec3 aCol;
      attribute vec3 aRand;
      uniform float uPx;
      varying vec3 vCol;
      void main() {
        vCol = aCol;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // 近处更大：把 mv.z 映到 0.55..1.7（点尺寸随深度变化，迸发才有纵深）
        float d = clamp(-mv.z, 1.0, 4.2);
        gl_PointSize = uPx * (0.03 + aRand.y * 0.045) / d;
      }`,
    fragmentShader: `
      varying vec3 vCol;
      void main() {
        float m = 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5));
        if (m <= 0.003) discard;
        gl_FragColor = vec4(vCol * (0.8 + 0.7 * m), m);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const object = new THREE.Points(geo, mat)
  object.frustumCulled = false
  object.name = 'burstE'
  return {
    object,
    geo,
    mat,
    dir: geo.attributes.aDir.array,
    col: geo.attributes.aCol.array,
    rand: geo.attributes.aRand.array,
    pos: geo.attributes.position.array,
    /**
     * 用确定性的尺寸/方向烘焙第 s 个起音点的粒子（只在首次遇到该起音点时执行一次）。
     * 之后每帧只改 position —— 于是画面是 t 的纯函数（selftest a 的确定性要求）。
     */
    bake(s, ox, oy, oz, tint) {
      if (s >= BURST_MAX) return
      const c = new THREE.Color()
      for (let i = 0; i < BURST_PER; i++) {
        const k = s * BURST_PER + i
        // 球面均匀方向 + 速度抖动（hash 确定性）
        const u = hash01(k, 301) * 2 - 1
        const th = hash01(k, 302) * TAU
        const sp = 0.55 + hash01(k, 303) * 0.75
        const r = Math.sqrt(Math.max(0, 1 - u * u))
        const j = k * 3
        this.dir[j] = Math.cos(th) * r * sp
        this.dir[j + 1] = u * sp
        this.dir[j + 2] = Math.sin(th) * r * sp
        c.setHex(tint != null ? tint : BURST_COLORS[(hash01(k, 304) * BURST_COLORS.length) | 0])
        this.col[j] = c.r
        this.col[j + 1] = c.g
        this.col[j + 2] = c.b
        this.rand[j] = hash01(k, 305)
        this.rand[j + 1] = hash01(k, 306)
        this.rand[j + 2] = hash01(k, 307)
        burstPos(this.pos, i, ox, oy, oz, this.dir[j], this.dir[j + 1], this.dir[j + 2], 0, 1)
      }
      geo.attributes.aDir.needsUpdate = true
      geo.attributes.aCol.needsUpdate = true
      geo.attributes.aRand.needsUpdate = true
    },
    /** 刷新第 s 个迸发在 dt 时刻的位置 */
    update(s, dt, ox, oy, oz, spread) {
      const { dir, pos } = this
      for (let i = 0; i < BURST_PER; i++) {
        const j = (s * BURST_PER + i) * 3
        burstPos(pos, s * BURST_PER + i, ox, oy, oz, dir[j], dir[j + 1], dir[j + 2], dt, spread)
      }
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}

/* ================================================================== *
 * 3) 透视网格墙（玻璃笼的每一面）
 * ================================================================== */

/** 网格贴图：一格一格的发光细线 + 一条稍亮的"主梁"（确定性，且是代码装饰不是正文） */
function makeGridTexture(px = 256) {
  const cv = document.createElement('canvas')
  cv.width = px
  cv.height = px
  const g = cv.getContext('2d')
  g.clearRect(0, 0, px, px)
  const N = 4
  g.lineCap = 'butt'
  for (let i = 0; i < N; i++) {
    const p = Math.round((i / N) * px) + 0.5
    const main = i === 0
    // 每一格：一条冷青主线 + 一条更宽的暗底（玻璃的反光带）
    // T19b：主线加亮加粗（删掉遗留紫环后，笼子是本拍**唯一**的光源，太细就撑不起「冷蓝」这一拍）
    g.strokeStyle = main ? 'rgba(190,245,255,0.95)' : 'rgba(150,225,255,0.5)'
    g.lineWidth = main ? 4 : 2.2
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, px)
    g.moveTo(0, p)
    g.lineTo(px, p)
    g.stroke()
    g.strokeStyle = 'rgba(45,105,165,0.35)'
    g.lineWidth = main ? 11 : 6
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, px)
    g.moveTo(0, p)
    g.lineTo(px, p)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

/* ================================================================== *
 * 4) 场景模块
 * ================================================================== */

export default {
  id: 'E',
  start: 59.0,
  end: 74.0,
  title: '交易',
  // 冲击联动（§2.4）。时刻全部落在本段词锚点上：
  //   62.02 stimulation（粒子迸发）· 68.04 happy · 69.41 execution（巨大 ▶ + 闪白）
  //   71.24 trapped（笼开始合拢）· 73.03 simulation（笼闭合）
  // 注意：rig.js 在 64.0 有一次**硬切**（全片 3 处之一），那是"每小节砸入公式"的第一个
  // 冲击点；这里不新增任何硬切（§2.1：全片 ≤3 处，且只有 rig 能加）。
  fx: [
    { t: 59.0, kind: 'flash', amount: 0.42, dur: 0.16 },
    // ⚠️ `burst` 目前在 fx.js 里**没有消费者**（fx.js 只实现 flash/glitch/shake/disp），
    // 所以这条声明是惰性的。保留声明（§4.4 的计数仍按"声明的同类效果"算），
    // 但"粒子迸发"实际是由本段的 3D 粒子系统自己驱动的，不依赖这条。
    { t: 62.02, kind: 'burst', amount: 1.0, dur: 0.3 },
    { t: 64.0, kind: 'flash', amount: 0.55, dur: 0.14 },
    { t: 69.41, kind: 'flash', amount: 1.0, dur: 0.26 },
    { t: 69.41, kind: 'shake', amount: 0.75, dur: 0.45 },
    { t: 69.41, kind: 'glitch', amount: 0.35, dur: 0.18 },
    { t: 70.8, kind: 'glitch', amount: 0.5, dur: 0.25 },
    { t: 73.03, kind: 'shake', amount: 0.45, dur: 0.4 },
    // 74.0 与段 F 的 `f_omnipotent.js` 在同一时刻各声明了一条 flash：
    // 段界重影（E 到 74.0 结束、F 从 74.0 开始）。按"边界效果归属开启它的那一段"，
    // 删掉本条，保留 F 的那条。
  ],

  init(ctx) {
    const T = ctx.three
    this.grp = new THREE.Group()
    this.grp.name = 'segE'
    T.stage3d.add(this.grp)

    // PBR 灯组（voxelField 是 MeshPhysicalMaterial，没有灯就是全黑 —— §2.7 的"环境光 + 轮廓光"）
    this.lights = createLightRigSafe()
    T.stage3d.add(this.lights)

    /* ---------- ① E1 stimulations：3D 神经网络（T18a / §1.6） ---------- */
    // ⚠️ FIX_V4 §1.6 第一句：「旧画面(**紫色半透明球体 + 方块 + 线框**)全部删除」。
    // 原来是三件套：`createHypercube(0.3, '#c792ea')`（**紫色**线框方块/超立方体）
    // + `wireShape('box', …)` 的青色外框 + 金色小方块 core —— **整组删除**。
    // E1 改为「3D **神经网络**，**信号脉冲逐层传播**，**相机推进**；**青→洋红**」。
    this.net = buildNeuralNet()
    this.grp.add(this.net.object)

    /* ---------- ①b E2 satisfaction：3D 奖励曲线（T45 / FIX_V5 §E） ---------- */
    // FIX_V5 §E：「1:05 删除右侧「太阳」(金宝珠与放射光线)」—— 原 `buildRewardOrb()`
    // （球壳 ×2 + 12 根放射锥，组名 `e:orb`）已整组删除；同一拍改为**奖励曲线**。
    this.reward = buildRewardCurve()
    this.grp.add(this.reward.object)

    /* ---------- ② 彩色粒子迸发 ---------- */
    this.burst = createBurst(BURST_PER * BURST_MAX)
    this.grp.add(this.burst.object)
    /** 槽位 → 已烘焙的起音点时刻（槽位复用时要重烘焙） */
    this.burstBaked = new Map()

    /* ---------- ③ 挤出公式 ---------- */
    this.formulas = makeFormulaFactory()
    /** @type {Array<{entry:object|null, mesh:THREE.Mesh|null, label:object|null, labelMesh:THREE.Mesh|null}>} */
    this.slams = SLAM_FORMULAS.map(() => ({ entry: null, label: null }))

    /* ---------- ④ 巨大 3D ▶ 描边 ---------- */
    // 真挤出：外轮廓 0.62×1.35 的三角形 + 内轮廓（按 0.72 缩放）当**孔**，
    // 挤出后前后盖只有一圈 0.09 宽的边 —— 这就是"描边"的 3D 版本。
    {
      const shape = new THREE.Shape()
      shape.moveTo(-0.31, -0.675)
      shape.lineTo(0.31, 0)
      shape.lineTo(-0.31, 0.675)
      shape.closePath()
      const hole = new THREE.Path()
      const k = 0.72
      hole.moveTo(-0.31 * k, -0.675 * k)
      hole.lineTo(0.31 * k, 0)
      hole.lineTo(-0.31 * k, 0.675 * k)
      hole.closePath()
      shape.holes.push(hole)
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.15,
        bevelEnabled: true,
        bevelThickness: 0.022,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 1,
      })
      geo.center()
      this.playFace = new THREE.MeshBasicMaterial({
        color: 0x9fe8ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      this.playSide = new THREE.MeshBasicMaterial({
        color: 0x2b6f92,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      this.play = new THREE.Mesh(geo, [this.playFace, this.playSide])
      this.play.frustumCulled = false
      this.grp.add(this.play)
    }

    /* ---------- ⑤ 3D 白闪面（execution 的那一帧） ---------- */
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 3.4),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    )
    this.flash.frustumCulled = false
    this.flash.renderOrder = 30
    this.grp.add(this.flash)

    /* ---------- ⑥ 玻璃笼：5 片透视网格墙 ---------- */
    this.gridTex = makeGridTexture(256)
    this.walls = []
    const wallSpec = [
      // T19b：网格加密（2.0×2.4 → 4.5×3.4 等）—— 删掉遗留紫环后笼子要**既是本拍的光源、
      // 又要撑住 b) 的「边缘像素 ≥4%」（细网格本身贡献大量边缘），同时也更像"笼"
      { o: [0, 0, -1.35], r: [0, 0, 0], rep: [5.6, 4.2] }, // 背墙
      { o: [-1.75, 0, -0.1], r: [0, Math.PI / 2, 0], rep: [3.8, 4.2] }, // 左
      { o: [1.75, 0, -0.1], r: [0, Math.PI / 2, 0], rep: [3.8, 4.2] }, // 右
      { o: [0, -1.3, -0.1], r: [-Math.PI / 2, 0, 0], rep: [5.6, 3.8] }, // 地
      { o: [0, 1.3, -0.1], r: [Math.PI / 2, 0, 0], rep: [5.6, 3.8] }, // 顶
    ]
    for (const w of wallSpec) {
      const tex = this.gridTex.clone()
      tex.needsUpdate = true
      tex.wrapS = THREE.RepeatWrapping
      tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(w.rep[0], w.rep[1])
      tex.offset.set(hash01(w.o[0] * 7 + w.o[2] * 13, 61), hash01(w.o[1] * 11, 62))
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0x8fe4ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        // 玻璃：不挡后面的立方体（笼是"罩住"，不是"遮住"）
        depthTest: false,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), mat)
      mesh.position.set(w.o[0], w.o[1], w.o[2])
      mesh.rotation.set(w.r[0], w.r[1], w.r[2])
      mesh.renderOrder = 12
      mesh.frustumCulled = false
      mesh.visible = false
      mesh.userData.tex = tex
      mesh.userData.base = w.o.slice()
      mesh.userData.rot = w.r.slice()
      this.grp.add(mesh)
      this.walls.push(mesh)
    }

    /* ---------- ⑦ 奖励条 14 格（旧文件 CELLS=14 的 3D 化） ---------- */
    // ⚠️ T45：14 格**必须**收进自己的组 `e:bars`，不能平铺在 `this.grp`（`segE`）下 ——
    // G9 的结构判据看的是"**同一个父节点**下 ≥1 个圆盘/球 + ≥6 根锥/盒/柱"，14 个 Box 平铺在
    // `segE` 下时，只要同时有 2 圈冲击波环（`RingGeometry`）可见，`segE` 本身就会被判成"太阳"：
    // 实测 t=69.6/69.8 报 `segE Group kids=28 disc=2 rays=14 ["BoxGeometry"]`（T42 的第二个
    // g9 FAIL）。奖励条是一列格子、不是"放射线"，把它的父子结构如实表达出来即可（不是放宽门槛：
    // 判据与阈值一个字没改，见 src/ui/globalrules.js:200-228）。
    this.barGrp = new THREE.Group()
    this.barGrp.name = 'e:bars'
    this.grp.add(this.barGrp)
    this.barCells = []
    this.barMats = []
    for (let i = 0; i < CELLS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x2a3550,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), mat)
      m.position.set(-2.42, -1.02 + i * 0.157, -0.3)
      this.barGrp.add(m)
      this.barCells.push(m)
      this.barMats.push(mat)
    }
    this.barTail = voxelField({ count: 1, cell: 0.11, gap: 0.02 })
    this.grp.add(this.barTail.object)

    /* ---------- ⑧ 旧的"交易环"（紫色 torus）——**已删** ---------- */
    // T19b 实测发现：T18a 声称把「旧画面（紫色半透明球体+方块+线框）」全删了，
    // 但**只删了 render 里的整块更新代码**，`this.ring = wireShape('torus', …)` 的
    // **对象创建还在**、且没有任何人再更新它 → 一个静止的紫色环（0x9d7bff、不透明度 0.95、
    // 半径 0.72、位于世界原点）**在整段 E（59→74s）每一帧都画在画面正中**
    // （实测 `E.ring.object.visible=true`、位置恒 (0,0,0)、缩放恒 1）。
    // 这正是 §1.6 抱怨的「1:02 起**长期是同一个紫色画面**」的字面根因，
    // 也直接违反同条的「同一主色（尤其紫色）连续出现 ≤3s」。
    // 删掉创建 + 对应的 dispose 行；`wireShape` 的 import 也随之不再需要。

    /* ---------- ⑧ 遗留的"交易环"（紫色 torus）——已删（§1.6「旧画面全部删除」） ---------- */
    // T19b 实测：T18a 声称"把旧画面全删了"，但**只删了 render 里的整块更新代码**，
    // `this.ring = wireShape('torus', …)` 的**对象创建还在**、且**没有任何人再更新它**
    // → 一个静止的紫色环（0x9d7bff、不透明度 0.95、半径 0.72、世界原点）**在整段 E（59→74s）
    // 每一帧都画在画面正中**（实测 `E.ring.object.visible=true`、位置恒 (0,0,0)、缩放恒 1）：
    // 这正是 §1.6 抱怨的「1:02 起**长期是同一个紫色画面**」的字面根因，也直接违反同条的
    // 「同一主色（尤其紫色）连续出现 ≤3s」。A/B 实测（把环隐藏 vs 显示、t=72.0 同一帧）：
    // 整帧平均亮度 **0.1598 → 0.0381**（环一个人贡献 0.122）——所以删它必须**同时补光**：
    // E5 已在本文件里用笼子自己补回（见 ⑥），**E1/E2 的补光与 §6 曝光链路另立一项**
    // （§6 的 exposure 关键帧目前是**惰性的**：post3d 把 uniforms 写到了 `fxShader` 而不是
    // ShaderPass 克隆出来的 `fx.uniforms` → 实测 `ctx.exposure=3.2` 时 `fx.uniforms.uExposure` 仍是 1）。

    /* ---------- ④b 冲击波环（§1.6 E4「冲击波」） ---------- */
    // T19b 实测确认的缺口：旧实现只有 ▶ 与白闪面，**没有冲击波**。
    // 两圈环从 ▶ 中心向外炸开，半径扩到画面边缘之前就淡完 —— 避免擦过四角把
    // §2.4 的「非闪白时刻四角平均亮度 ≤0.12」顶掉（T14b 就是这么被门环顶掉的）。
    this.shocks = []
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff5a1e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      })
      const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 72), mat)
      m.frustumCulled = false
      m.renderOrder = 28
      m.visible = false
      this.grp.add(m)
      this.shocks.push(m)
    }

    // 相机坐标系摆位/投影用的暂存对象（每帧复用，不新建）
    this._fwd = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._up = new THREE.Vector3()
    this._ndc = new THREE.Vector3()
    this._white = new THREE.Color(0xffffff)

    /* ---------- ⑨ 3D 数值读数（softmax / 交叉熵 / 注意力，全部真实计算） ---------- */
    // T07b / FIX_V4 §2.3：面板类文字最小 34px。原来 height=0.055（≈30px），提到 0.063（≈34px）。
    this.num = textPlane('…', { role: 'label', height: 0.063, weight: 500, family: 'code', color: '#9fe8ff' })
    this.num.mesh.position.set(-0.95, -0.92, 1.2)
    this.grp.add(this.num.mesh)

    this.metrics = { glyphPx: 0, quads: 0, tris: 0 }
    this.tmpCol = new THREE.Color()
  },

  render(t, lt, ctx) {
    const T = ctx.three
    // compositor 每帧开头会把 stage3d 的所有直接子节点 visible 关掉（main.js:151），
    // 所以这里必须显式打开自己的对象（§F2a 既有约定，见 _seg.js 第 4 条）。
    this.grp.visible = true
    this.lights.visible = true

    const cam = T.camera
    const camZ = cam.position.z
    const camX = cam.position.x
    const camY = cam.position.y

    /* ================= 时间线：全部来自词锚点（§2.2） ================= */
    const TL = timeline(ctx.cues, 'E', {
      stimulation: [62.02, 0.3],
      // T18b：`satisfaction` 锚点是本轮补的（歌词实测 65.70；见 anchors.js 的 E 段说明）
      satisfaction: [65.7, 0.3],
      happy: [68.04, 0.35],
      execution: [69.41, 0.3],
      trapped: [71.24, 0.35],
      strange: [72.22, 0.3],
    })
    const tStim = TL.stimulation.t
    const tHappy = TL.happy.t
    const tExec = TL.execution.t
    const tTrap = TL.trapped.t
    const tStrange = TL.strange.t

    /**
     * 小节首拍表（旧文件用 sync.beats 的 i%4 取小节头，这里改成**由词锚点定相**）：
     * 以 stimulation 之后的下拍（62.633，它落在 4/4 的强拍上）为首个砸入点，往后每 4 拍一条。
     * 为什么不能继续用 `i % 4 === 0`：beats 数组的相位是分析器给的，段落起点 59.0 与
     * 音乐小节线并不对齐，i%4 会把"小节首拍"错认成弱拍；锚点定相则一定对在 stimulation 上。
     * 这样"每小节一条"的语义与"从 stimulation 开始"的语义同时成立。
     */
    const beatGap = 60 / Math.max(60, ctx.sync.tempoAt(t))
    const tSlam0 = this.slam0 == null ? (this.slam0 = this.firstSlamAfter(ctx, tStim)) : this.slam0
    const SLAM_LIFE = 3.0 // 每条公式存活约一个小节（0.9s × 3 条之后退场，见下面的 for）
    // 距最近一次"砸入"的时间（每小节一次 → 用拍长的 4 倍取模）。用它做立方体的反冲，
    // 是纯函数（不累积状态），且相位由词锚点定的 tSlam0 决定。
    const sinceSlam = ((t - tSlam0) % (beatGap * 4) + beatGap * 4) % (beatGap * 4)
    const beatKick = Math.exp(-sinceSlam * 6)

    /* ================= ① E1 stimulations：3D 神经网络 + 信号逐层传播 + 相机推进 ================= */
    // ⚠️ T18a / FIX_V4 §1.6：**删除旧画面（紫色半透明球体 + 方块 + 线框）** ——
    // 原来这一大块画的是"超立方体巨大化 + 反向自转外框 + 金色核心 + 环"（`this.cube/frame/core/ring`），
    // 全部删除；E1 改成**神经网络**：4 层 20 节点、相邻层全连接 84 条线，
    // 一个 `sweep` 值在 0..3 层之间推进（**信号脉冲逐层传播**），配色 **青 → 洋红**，
    // "**相机推进**"用 z 从 0.9 推到 −0.6 + 缓慢放大实现。
    const netIn = clamp(span(t, TL.stimulation.start - 1.2, tStim + 0.5))
    // ⚠️ 这里**不能**写 `TL.satisfaction` —— 本段的 timeline 只声明了
    // `stimulation / happy / execution / trapped / strange` 五个键，**没有 `satisfaction`**
    // （§1.6 的 E2「satisfaction」词在 anchors.js 里没有锚点）。
    // T18a 只负责 E1，所以窗口按 E1 自己的时长收：stimulation 后约 2.4s 淡出。
    // E2 的边界留给 T18b（届时先补 `satisfaction` 锚点，再按锚点切拍）。
    const netOut = 1 - clamp(span(t, tStim + 2.4, tStim + 3.1))
    const netA = netIn * netOut
    if (this.net) {
      this.net.update(t, {
        alpha: netA,
        u: clamp(span(t, tStim - 0.3, tStim + 2.6)) * 1.4,
        advance: clamp(span(t, tStim - 0.2, tStim + 2.6)),
      })
    }

    /* ================= ①b E2 satisfaction：3D 奖励曲线（T45 / FIX_V5 §E） ================= */
    // §E：「3D 奖励曲线——一条发光折线**随每个起音点向右上攀升**，线头是亮点并拖出粒子尾迹，
    //      曲线下方有渐变填充，相机缓慢横移；配色金→白，但不得有圆盘形主体」。
    // 揭示进度 u 由 `satisfaction` 窗口内的**起音点**定相：每过一个起音点跳一级、级内连续推进
    // （于是既有"随起音点攀升"的台阶，也不会在起音点之间僵住）。实测本窗口 64.7–68.0 内只有
    // 2 个起音点，故用 (已过起音点数 + 级内比例) / 起音点总数。
    // "相机缓慢横移"由 rig.js 已有的轨迹提供（59.0 x=0 → 66.6 x=1.4 → 74.0 x=0.4；实测
    // 64.7/66.6/70.0 三点 x = 1.585/1.391/0.965），本文件不建相机。
    const tSat = TL.satisfaction.t
    const rewA = clamp(span(t, tSat - 1.0, tSat + 0.4)) * (1 - clamp(span(t, TL.happy.t - 0.5, TL.happy.t + 0.3)))
    if (this.reward) {
      let ons = []
      try {
        ons = ctx.sync.onsetsIn(tSat - 0.9, tHappy + 0.6) || []
      } catch (e) {
        ons = []
      }
      // ⚠️ `sync.onsetsIn()` 返回的是 **`{t, s}` 对象数组**（时间 + 强度），不是数字数组
      // （src/core/sync.js:126-129；src/scenes/h_absence.js:200 也记着这条坑）。取 `o.t`。
      const onT = ons
        .map((o) => (typeof o === 'number' ? o : o.t))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b)
      let beats = 0
      for (const o of onT) if (o <= t) beats++
      const prevOn = beats > 0 ? onT[beats - 1] : tSat - 1.0
      const nextOn = beats < onT.length ? onT[beats] : tHappy + 0.6
      const frac = clamp((t - prevOn) / Math.max(0.12, nextOn - prevOn))
      const u = onT.length ? clamp((beats + frac) / onT.length) : clamp(span(t, tSat - 1.0, tHappy + 0.4))
      const white = clamp((t - tSat) / Math.max(0.4, TL.happy.t - tSat))
      this.reward.object.position.set(cam.position.x + 0.28, cam.position.y, cam.position.z - 1.6)
      this.reward.update(t, { alpha: rewA, u: u, white: white })
      this.metrics.reward = { a: +rewA.toFixed(2), beats: beats, onsets: onT.length, u: +u.toFixed(2), white: +white.toFixed(2) }
    }

    /* ================= T19a / §1.6 E3：暖色（happy 拍） ================= */
    // 实测问题：E3 窗口（68.0–69.4）整帧平均 **r 0.245 < b 0.313**，是**冷蓝**的 ——
    // 而 §1.6 明写 E3 要「**暖色**」（且要求"每拍的配色至少 2 项不同"）。
    // 这里在暖色窗口里叠一层加法的暖橙，把它推成暖调（可测量：r > b），E4 的闪白之前淡出。
    // ⚠️ 实测：第一版（从 `tHappy-0.3` 起、α=0.2）在**词落点 68.2** 仍测得 r 0.309 < b 0.314（勉强偏冷），
    // 只有 69.0 才是暖的。所以把窗口**提前到 `tHappy-0.6`** 并把 α 提到 **0.28**，让整拍（含词落点）都是暖调。
    const warmA = clamp(span(t, tHappy - 0.6, tHappy + 0.4)) * (1 - clamp(span(t, tExec - 0.4, tExec + 0.2)))
    if (warmA > 0.01) {
      const gw = ctx.g
      gw.save()
      gw.globalCompositeOperation = 'lighter'
      gw.globalAlpha = 0.28 * warmA
      gw.fillStyle = '#ff9a3c'
      gw.fillRect(0, 0, ctx.W, ctx.H)
      gw.restore()
    }

    /* ================= ② 彩色粒子迸发 ================= */
    // 起音点驱动（旧文件就用 sync.beats/onsets 的网格确定砸点，这里改用真实起音点）
    const onsets = ctx.sync.onsetsIn(tStim - 0.06, Math.min(tTrap, 70.6))
    const BURST_DUR = 1.75
    const geoB = this.burst.geo
    geoB.clearGroups() // 组的成员每帧重算（存活中的起音点变了）
    let live = 0
    for (let k = 0; k < onsets.length && k < BURST_MAX; k++) {
      const o = onsets[k]
      const e = t - o.t
      if (e < 0 || e > BURST_DUR) continue
      // 槽位与起音点一一对应；槽位被新的起音点复用时重烘焙（方向/颜色与时刻无关，
      // 但"迸发原点"跟着起音点走，所以必须重算，否则会看到粒子从上一次的爆点冒出来）
      const a = (k / BURST_MAX) * TAU + o.t
      const ox = camX * 0.04 + Math.cos(a) * 0.34 * (0.5 + o.s)
      const oy = camY * 0.04 + Math.sin(a * 1.7) * 0.3 * (0.5 + o.s)
      const oz = 0.1 + Math.cos(a * 0.7) * 0.22
      if (this.burstBaked.get(k) !== o.t) {
        this.burst.bake(k, ox, oy, oz, null)
        this.burstBaked.set(k, o.t)
      }
      this.burst.update(k, e, ox, oy, oz, 0.4 + o.s * 0.85)
      // 每个起音点的整体亮度写进 geometry.groups 的 count（越老画得越少 → 尾部收束而不是硬切）
      const fade = 1 - smoothstep(clamp(e / BURST_DUR))
      const n = Math.max(2, Math.round(BURST_PER * (0.35 + 0.65 * fade) * (0.4 + 0.6 * o.s)))
      geoB.addGroup(k * BURST_PER, n, 0)
      live++
    }
    geoB.attributes.position.needsUpdate = true
    this.burst.object.visible = live > 0 && t < 71.2

    /* ================= ③ 每小节首拍砸入一条挤出公式 ================= */
    const formX = -0.16
    const formZ = camZ - FORMULA_DIST
    this.metrics.glyphPx = 0
    this.metrics.quads = 0
    let anyFormula = false
    // ⚠️ T18b / FIX_V4 §1.6：「画面里**不再出现超立方体与重复的公式砸入**」。
    // 超立方体已在 T18a 删除；这里把**公式砸入整段停用**（`if (false)` 让下面的 for 永不执行），
    // 之前已烘焙出来的条目也每帧强制隐藏，避免残影。
    for (const s of this.slams) {
      if (s.entry) s.entry.object.visible = false
      if (s.label) s.label.mesh.visible = false
    }
    if (false) for (let k = 0; k < SLAM_FORMULAS.length; k++) {
      const t0 = tSlam0 + k * beatGap * 4
      const u = span(t, t0, t0 + 0.24)
      if (u <= 0 || t > t0 + SLAM_LIFE + 0.6) {
        if (this.slams[k].entry) this.slams[k].entry.object.visible = false
        if (this.slams[k].label) this.slams[k].label.mesh.visible = false
        continue
      }
      // §0.6：入场必须有预备与过冲 —— outBack 从 0.72 弹到 1.02 再回 1
      const sc = 0.72 + 0.3 * outBack(clamp(u))
      const slamIn = outCubic(clamp(u))
      const fadeOut = 1 - span(t, t0 + 2.5, t0 + SLAM_LIFE + 0.5)
      // W1 出场后公式让到左侧（立绘在 cx=0.74W，公式右缘留在 0.5W 以内，二者不重叠）
      const avoid = clamp(span(t, tHappy - 0.5, tHappy + 0.6))
      const x = formX - 0.42 * avoid
      const y = 0.02 + (1 - slamIn) * 0.55 // 从上往下"砸入"
      const alpha = clamp(fadeOut * Math.min(1, u * 4))

      const spec = SLAM_FORMULAS[k]
      // 白色主行 + 淡色描边副本（glow）：公式要"亮"，但 §0.5 的字号下限仍由 text() 兜住
      const entry = this.formulas.get(
        spec.lines.map((s, i) => ({ s, color: '#ffffff', glow: i === 0 ? 0.7 : 0.55 })),
        {
          face: k === 0 ? '#ffffff' : k === 1 ? '#ffe6a3' : '#d8fbff',
          side: k === 0 ? '#8a5cff' : k === 1 ? '#c98a24' : '#37a3d6',
        }
      )
      if (this.slams[k].entry !== entry) {
        if (this.slams[k].entry) this.grp.remove(this.slams[k].entry.object)
        this.grp.add(entry.object)
        this.slams[k].entry = entry
      }
      // 轻微 Y 轴转角 + 首拍的过冲抖动：让"挤出"的厚度在屏幕上真的看得见
      entry.object.visible = true
      entry.object.scale.setScalar(sc)
      entry.object.position.set(x, y, formZ)
      entry.object.rotation.y = -0.16 + 0.1 * Math.sin(t * 0.7 + k)
      entry.object.rotation.x = 0.03 * Math.sin(t * 0.9 + k * 2)
      entry.setOpacity(alpha)
      anyFormula = true

      // 标签（role=label，≥22px）+ 公式在屏幕上的实测字号（供 §0.5 核对）
      const pxu = pxPerUnitAt(cam, formZ, ctx.H)
      this.metrics.glyphPx = Math.max(this.metrics.glyphPx, entry.glyphPx * pxu * sc)
      this.metrics.quads += entry.quads
      let lab = this.slams[k].label
      if (!lab) {
        lab = textPlane(spec.label, { role: 'label', height: 0.063, weight: 700, family: 'code', color: '#ffd479' })
        this.grp.add(lab.mesh)
        this.slams[k].label = lab
      }
      lab.mesh.visible = true
      lab.mesh.position.set(x - entry.width * 0.5 * sc, y - entry.height * 0.5 * sc - 0.055, formZ + 0.01)
      lab.mesh.scale.setScalar(sc)
      lab.material.opacity = alpha
    }

    /* ================= ④ 巨大 3D ▶ + 冲击波 + ⑤ 3D 白闪 ================= */
    // §1.6 E4「巨大的 3D ▶ 砸入，冲击波，闪白；**红橙**」。T19b 实测查出的三处缺口：
    //   ① 配色：▶ 本体是**青色**（face 0x9fe8ff / side 0x2b6f92），整帧 r 0.230 < b 0.303
    //      （冷蓝）—— 与「红橙」完全相反；
    //   ② 取景：旧写法用「世界 z = camZ − 0.95」当"在镜头前"，可相机在 x≈1.1 且朝原点看，
    //      于是 ▶ 被摆到 NDC x ≈ −1.36…−1.47 —— **整拍都在画面外**（实测 69.41/70.4 都看不到它）；
    //   ③ 冲击波：不存在。
    // 现在：位置改成**相机坐标系**（前向 1.62→1.07 砸进来）、配色红橙（白热时冲白）、
    // 并补上 ④b 的两圈冲击波。
    const pu = clamp(span(t, TL.execution.start, tExec + 0.5))
    const playFade = 1 - span(t, tExec + 1.35, tExec + 1.75)
    const playA = pu > 0 ? clamp(Math.min(1, pu * 3) * playFade) : 0
    this.play.visible = playA > 0.01
    if (this.play.visible) {
      // 弹性入场（§0.6 的过冲）：outElastic 先把 ▶ 弹大再收住
      const pop = outElastic(clamp(pu))
      const cam = ctx.three.camera
      this._fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
      this._right.set(1, 0, 0).applyQuaternion(cam.quaternion)
      this._up.set(0, 1, 0).applyQuaternion(cam.quaternion)
      const dist = 1.62 - 0.55 * outCubic(clamp(pu))
      this.play.position.copy(cam.position).addScaledVector(this._fwd, dist)
      this.play.position.addScaledVector(this._right, 0.05 * Math.sin(t * 0.7))
      this.play.position.addScaledVector(this._up, 0.03)
      // 尺寸：几何本身 0.62×1.35 世界单位，在 dist≈1.07 处 0.38→0.54 的缩放
      // 约占屏高 65%→92%（"巨大"且仍读得出是个 ▶）
      this.play.scale.setScalar(Math.max(0.001, 0.38 + 0.16 * pop))
      this.play.rotation.y = -0.18 + 0.14 * Math.sin(t * 0.8)
      this.play.rotation.z = Math.sin(t * 0.55) * 0.05
      // 白热：起手 0.12s 全白 → 回到**红橙**
      const hot = Math.exp(-Math.pow(pu * 9, 2))
      this.playFace.color.set(0xff5a1e).lerp(this._white, hot)
      this.playSide.color.set(0x8a2b06).lerp(this._white, hot * 0.8)
      this.playFace.opacity = playA * (0.75 + 0.25 * Math.sin(t * 6.1) ** 2)
      this.playSide.opacity = playA * 0.85
    }

    /* ---------- ④b 两圈冲击波：从 ▶ 中心炸开 ---------- */
    for (let i = 0; i < this.shocks.length; i++) {
      const sh = this.shocks[i]
      const u = clamp(span(t, tExec + i * 0.13, tExec + 0.5 + i * 0.13))
      const on = u > 0 && u < 1
      sh.visible = on
      if (!on) continue
      sh.position.copy(this.play.position)
      sh.scale.setScalar(0.2 + 1.15 * outCubic(u))
      sh.material.opacity = 0.75 * (1 - u) ** 1.6
      sh.material.color.set(0xff5a1e).lerp(this._white, clamp(u * 1.4))
    }

    /* ---------- ④c §1.6 E4「红橙」：以 ▶ 为中心的红橙加法辉光 ---------- */
    // 实测缺口：E4 拍整帧 **r 0.230 < b 0.303（冷蓝）**，与「红橙」相反 ——
    // ▶ 与冲击波只占中央一小块，压不过整屏冷色底子。这里叠一层**红橙径向辉光**：
    // 中心强、边缘到四角归零（`R = max(W,H)*0.62`，四角在 R 之外 ⇒ 对四角亮度几乎无贡献，
    // 不会把 §2.4 的 v) ≤0.12 顶掉）。窗口从 `tExec+0.12` 起，与 T19a 的 E3 暖橙
    // （在 `tExec-0.4 → +0.2` 之间淡出）**错开**，避免两层暖色同时叠满。
    const e4A = clamp(span(t, tExec + 0.12, tExec + 0.45)) * (1 - clamp(span(t, tTrap - 0.55, tTrap - 0.25)))
    if (e4A > 0.01 && this.play.visible) {
      const g4 = ctx.g
      this._ndc.copy(this.play.position).project(ctx.three.camera)
      const sx = (this._ndc.x * 0.5 + 0.5) * ctx.W
      const sy = (-this._ndc.y * 0.5 + 0.5) * ctx.H
      const R = Math.max(ctx.W, ctx.H) * 0.62
      const grad = g4.createRadialGradient(sx, sy, 0, sx, sy, R)
      grad.addColorStop(0, 'rgba(255,96,30,0.46)')
      grad.addColorStop(0.55, 'rgba(255,58,18,0.30)')
      grad.addColorStop(1, 'rgba(255,40,10,0)')
      g4.save()
      g4.globalCompositeOperation = 'lighter'
      g4.globalAlpha = e4A
      g4.fillStyle = grad
      g4.fillRect(0, 0, ctx.W, ctx.H)
      g4.restore()
    }

    /* ---------- ④d §1.6 E5「冷蓝」：笼内的冷蓝辉光（补回被删紫环的光） ---------- */
    // T19b：遗留紫环一个人就给整帧贡献 0.122 的平均亮度（A/B 实测 0.1598 → 0.0381）。
    // 环按 §1.6 必须删，所以这一拍的光要**由本拍自己的对象**给回来 ——
    // 笼子是冷青网格（「冷蓝」的正确色相），再加一层**以画面中心为心的冷蓝径向辉光**
    // （中心强、四角归零 ⇒ §2.4 的四角 ≤0.12 不受影响）。
    // 窗口 `tTrap-0.2 → 74.0` = 2.96s ≤3s（§1.6「同一主色连续 ≤3s」），
    // 且与 E4 的红橙辉光（`tTrap-0.25` 收）不重叠。
    const e5A = clamp(span(t, tTrap - 0.2, tTrap + 0.25)) * (1 - clamp(span(t, 73.7, 74.0)))
    if (e5A > 0.01) {
      const g5 = ctx.g
      const R5 = Math.max(ctx.W, ctx.H) * 0.62
      const grad5 = g5.createRadialGradient(ctx.W * 0.5, ctx.H * 0.5, 0, ctx.W * 0.5, ctx.H * 0.5, R5)
      grad5.addColorStop(0, 'rgba(96,205,255,0.26)')
      grad5.addColorStop(0.55, 'rgba(58,150,255,0.16)')
      grad5.addColorStop(1, 'rgba(40,120,255,0)')
      g5.save()
      g5.globalCompositeOperation = 'lighter'
      g5.globalAlpha = e5A
      g5.fillStyle = grad5
      g5.fillRect(0, 0, ctx.W, ctx.H)
      g5.restore()
    }

    // 闪白：既走 fx（后处理全屏闪白），也放一片 3D 面 —— §3 E 要的是"亮起并闪白"，
    // 3D 的那一片贴在 ▶ 后面，闪的瞬间连几何一起被冲掉，比纯 2D 全屏白更有"体积"。
    // ⚠️ T19b 修（第二处）：原来的第二峰（tExec+0.22、σ=1/9）把 3D 闪面拖到 **t=69.7 仍剩 0.36
    // 不透明度**，而 `fx.flash(69.7)=0`（声明的闪白 dur 0.26 在 69.67 就结束）→ 69.7
    // **不是闪白豁免时刻**，四角实测 **0.2009 ≫ 0.12**（§2.4 的 v) 会记一笔）。
    // 第一峰同样有 0.11s 的"提前量"：t=69.3 时闪面已有 0.47 不透明度、四角 **0.2676**，
    // 而此刻 `fx.flash=0`（声明的闪白 69.41 才起、且 atk 0.012）。
    // 现在给闪面加一道**双向硬窗口**（69.42 起、69.68 止），让它严格落在声明闪白的豁免窗口内 ——
    // 于是"闪面亮着"的时刻一定满足 `fx.flash(t) > 0.02`，v) 不会再被这一片误伤。
    const flashEnv =
      clamp(span(t, tExec + 0.012, tExec + 0.06)) * (1 - clamp(span(t, tExec + 0.16, tExec + 0.27)))
    const fl =
      (Math.exp(-Math.pow((t - tExec) * 7, 2)) + 0.6 * Math.exp(-Math.pow((t - tExec - 0.17) * 11, 2))) * flashEnv
    this.flash.visible = fl > 0.02
    if (this.flash.visible) {
      this.flash.material.opacity = clamp(fl) * 0.85
      this.flash.position.copy(this.play.position)
    }

    /* ================= ⑥ 透视网格墙合拢成玻璃笼（相机在笼内） ================= */
    // 桥接 E→F：合拢的玻璃笼变成展示柜（§2.1 桥接表），所以笼必须在段末保持闭合，
    // 由段 F 接着用；这里只负责"从四周合拢"这一段动作。
    // ⚠️ T19b 修：§1.6 E5 要「**相机在笼内**」，而旧实现的五片墙是**绝对世界坐标**
    // （背墙 z=−1.35、左右 x=±1.75、地/顶 y=∓1.3），此时相机实测在 (0.67,0.05,3.27) ——
    // 相机在笼**外** 1.6 个单位（实测 71.24–73.9 都只看得到"笼在远处合拢"）。
    // 现在把整座笼**随相机平移**（基准位 = 相机位置 + 原相对偏移）：
    // 笼的包围盒变成 x∈cam±1.75、y∈cam±1.3、z∈[cam−1.9, cam+1.7]，
    // 相机恒在笼心 ⇒ 「相机在笼内」成立（四壁与地/顶把视野围住，背墙在正前方 1.35）。
    const closeU = clamp(span(t, TL.trapped.start, tStrange + 0.55))
    const wallA = clamp(span(t, tTrap - 0.45, tTrap + 0.25)) * (1 - span(t, 73.9, 74.0))
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i]
      const on = wallA > 0.005
      w.visible = on
      if (!on) continue
      const b = w.userData.base
      // 合拢：从"相机侧的外围"滑到基准位；用 smoothstep 而不是线性（§0.6）
      const k = 1 - smoothstep(closeU)
      // 基准位 = 相机位置 + 构造时的相对偏移（于是笼心恒在相机上）
      const bx = camX + b[0]
      const by = camY + b[1]
      const bz = camZ + b[2]
      const dx = bx - camX * 0.22
      const dy = by - camY * 0.22
      const dz = bz - camZ * 0.2
      const L = Math.hypot(dx, dy, dz) || 1
      w.position.set(bx + (dx / L) * 1.5 * k, by + (dy / L) * 1.5 * k, bz + (dz / L) * 1.5 * k)
      // 朝向固定（不随合拢变化）：面片在自己的法向上平移，所以旋转保持构造时的值即可
      w.rotation.set(w.userData.rot[0], w.userData.rot[1], w.userData.rot[2])
      const pulse = ctx.sync.pulse(t, 200)
      // T19b：删掉遗留紫环后笼子要自己照亮这一拍 —— 基准不透明度 0.30→0.42、闭合项 0.25→0.33（上限仍夹在 1.0）
      w.material.opacity = Math.min(1, wallA * (0.52 + 0.3 * pulse + 0.33 * closeU))
      w.userData.tex.offset.x = 0.02 * t * (i % 2 ? -1 : 1)
      w.userData.tex.offset.y = 0.012 * t
    }

    /* ================= ⑦ 奖励条 14 格（迁移 CELLS 的充能进度） ================= */
    const barA = clamp(span(t, 59.8, 60.5)) * (1 - span(t, 70.5, 71.3))
    const fill = clamp(span(t, 60.5, tHappy + 0.5)) * CELLS
    for (let i = 0; i < CELLS; i++) {
      const m = this.barCells[i]
      const mat = this.barMats[i]
      m.visible = barA > 0.01
      if (!m.visible) continue
      const lit = clamp(fill - i)
      const isHead = lit > 0 && lit < 1
      const full = lit >= 1
      // 过冲：充到这一格时先白后色
      const over = Math.exp(-Math.pow((fill - i - 0.92) * 6, 2)) * (full ? 0.7 : 1)
      const col = i === CELLS - 1 ? 0xffd479 : 0x7fd8ff
      mat.color.setHex(full || isHead ? col : 0x2a3550).lerp(new THREE.Color(0xffffff), over * 0.8)
      mat.opacity = barA * (full ? 0.95 : isHead ? 0.8 * lit : 0.14)
      m.scale.setScalar(1 + 0.35 * over)
    }
    this.barTail.object.visible = false // 占位（保留 voxelField 的引入，便于后续扩格）

    /* ================= ⑧ 真实数值读数（迁移旧文件的真实计算） ================= */
    const spec = ctx.spec
    ctx.sync.spectrumAt(t, spec)
    const p = softmaxFromSpectrum(spec)
    // 目标分布用**真实的**频谱重心当 one-hot 位置（不是随机数）：
    // 这样 L = −log p[argmax] 与画面上的 softmax 分布是同一个量
    let cen = 0
    let sw = 0
    for (let i = 0; i < spec.length; i++) {
      cen += i * spec[i]
      sw += spec[i]
    }
    const cls = Math.min(7, Math.max(0, Math.round((cen / Math.max(1e-6, sw) / spec.length) * 8)))
    const y = [0, 0, 0, 0, 0, 0, 0, 0]
    y[cls] = 1
    const ce = crossEntropy(p, y)
    const att = attentionFromSpectrum(spec, spec)
    const rms = ctx.sync.rmsAt(t)
    this.num.mesh.visible = t > tStim - 0.4
    if (this.num.mesh.visible) {
      this.num.setText(
        `softmax[${cls}] = ${p[cls].toFixed(4)}   L = ${ce.toFixed(3)}   QKᵀ/√d_k = ${att.toFixed(3)}   rms ${rms.toFixed(2)}`
      )
      this.num.mesh.position.set(-1.32, -0.98, camZ - 1.2)
      this.num.material.opacity = clamp(span(t, tStim, tStim + 0.5)) * (0.55 + 0.45 * rms)
    }

    /* ================= ⑨ ?debug 读数（本文件唯一的 Canvas2D 文字） ================= */
    const g = ctx.g
    if (ctx.debug) {
      g.save()
      g.globalAlpha = 0.92
      text(
        g,
        `E  tris=${T.renderer.info.render.triangles}  calls=${T.renderer.info.render.calls}  ` +
          `glyph=${this.metrics.glyphPx.toFixed(0)}px (min ${TEXT_MIN.formula})  quads=${this.metrics.quads}`,
        40,
        84,
        { role: 'ui', size: 34, family: 'code', color: C.teal }
      )
      text(
        g,
        `stim@${tStim.toFixed(2)} happy@${tHappy.toFixed(2)} exec@${tExec.toFixed(2)} trapped@${tTrap.toFixed(2)} strange@${tStrange.toFixed(2)}  ` +
          `slam0@${tSlam0.toFixed(2)} Δ${beatGap.toFixed(3)} grow=${grow.toFixed(2)} cube=${cubeScale.toFixed(2)}u walls=${(closeU * 100).toFixed(0)}%`,
        40,
        124,
        { role: 'ui', size: 34, family: 'code', color: C.fgDim }
      )
      g.restore()
    }
  },

  /**
   * stimulation 之后的第一个"小节首拍"。
   * 由词锚点定相（不写死秒数）：从 tStim 起按 tempo 的拍间隔往后找第一个拍点，
   * 再要求它落在 4/4 的强拍（以 tStim 本身为相位零点）。
   */
  firstSlamAfter(ctx, tStim) {
    const gap = 60 / Math.max(60, ctx.sync.tempoAt(tStim))
    // beatGap 的 1/4 对齐检查：真实 beats 表比 60/bpm 略密（分析器给的 0.433–0.467），
    // 所以优先在 beats 里找"最接近 tStim + k×4×gap 的那个真实拍点"，取不到才退回等比网格。
    const target = tStim + gap * 4 * 0.14 + gap * 0.9
    let best = target
    let bestD = Infinity
    const bs = ctx.sync.beats || []
    for (let i = 0; i < bs.length; i++) {
      const d = Math.abs(bs[i] - target)
      if (d < bestD && bs[i] >= tStim) {
        bestD = d
        best = bs[i]
      }
    }
    return best
  },

  dispose() {
    if (this.formulas) this.formulas.dispose()
    if (this.burst) this.burst.dispose()
    if (this.num) this.num.dispose()
    if (this.gridTex) this.gridTex.dispose()
    if (this.reward) this.reward.dispose()
    if (this.shocks) for (const sh of this.shocks) { sh.geometry.dispose(); sh.material.dispose() }
    if (this.frame && this.frame.material) this.frame.material.dispose()
  },
}