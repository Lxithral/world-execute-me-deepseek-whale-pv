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
  wireShape,
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
    g.strokeStyle = main ? 'rgba(160,240,255,0.72)' : 'rgba(130,215,255,0.34)'
    g.lineWidth = main ? 3 : 1.6
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, px)
    g.moveTo(0, p)
    g.lineTo(px, p)
    g.stroke()
    g.strokeStyle = 'rgba(40,90,140,0.28)'
    g.lineWidth = main ? 9 : 5
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

    /* ---------- ① 超立方体：巨大化并旋转 ---------- */
    // baseSize 0.30：4D→3D 透视投影在 |w| ≤ ~1.6 时最多把顶点撑到 4.7×size，
    // 再乘上运行时 scale（最大 3.4）得到最大半径 ≈1.0 世界单位 → 直径 ≈2.0 = 画面高的 87%。
    // 这是"巨大化"的量化依据，不是拍脑袋。
    this.cube = createHypercube(0.3, '#c792ea')
    this.grp.add(this.cube.object)

    // 外框：用 scene3d 的 box 线框（12 条细圆柱，比 LineSegments 更能吃光照、更有厚度）
    this.frame = wireShape('box', { size: 0.5, color: 0x7fd8ff, radius: 0.0085 })
    this.grp.add(this.frame.object)

    // 立方体中心的一颗发光核（"交易"的标的物）
    this.coreMat = new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), this.coreMat)
    this.grp.add(this.core)

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
      { o: [0, 0, -1.35], r: [0, 0, 0], rep: [3.0, 2.4] }, // 背墙
      { o: [-1.75, 0, -0.1], r: [0, Math.PI / 2, 0], rep: [2.0, 2.4] }, // 左
      { o: [1.75, 0, -0.1], r: [0, Math.PI / 2, 0], rep: [2.0, 2.4] }, // 右
      { o: [0, -1.3, -0.1], r: [-Math.PI / 2, 0, 0], rep: [3.0, 2.0] }, // 地
      { o: [0, 1.3, -0.1], r: [Math.PI / 2, 0, 0], rep: [3.0, 2.0] }, // 顶
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
      this.grp.add(m)
      this.barCells.push(m)
      this.barMats.push(mat)
    }
    this.barTail = voxelField({ count: 1, cell: 0.11, gap: 0.02 })
    this.grp.add(this.barTail.object)

    /* ---------- ⑧ 支撑结构的线框：立方体外的"交易环" ---------- */
    this.ring = wireShape('torus', { size: 0.72, color: 0x9d7bff, radius: 0.008 })
    this.grp.add(this.ring.object)

    /* ---------- ⑨ 3D 数值读数（softmax / 交叉熵 / 注意力，全部真实计算） ---------- */
    this.num = textPlane('…', { role: 'label', height: 0.055, weight: 500, family: 'code', color: '#9fe8ff' })
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

    /* ================= ① 超立方体巨大化 + 旋转 + 相机绕拍 ================= */
    // 进场：从段首（D→E 的桥接元素就是它）就位；stimulation 处"巨大化"用 inOutExpo 做预备+过冲。
    const cubeIn = clamp(span(t, TL.stimulation.start - 1.5, 61.6))
    const grow = inOutExpo(clamp(span(t, tStim - 0.25, tStim + 1.35)))
    const pop = outBack(clamp(span(t, tStim, tStim + 0.5)))
    const glow = 0.35 + 0.65 * ctx.sync.pulse(t, 260)
    const breathe = 1 + 0.05 * Math.sin(t * 2.3) + 0.06 * glow
    const cubeVis = cubeIn * (1 - span(t, 73.0, 73.95))
    // 0.42 → 2.6：对比 59–62s 的小立方体，"巨大化"在同一段内看得见地发生
    const cubeScale = (0.62 + 2.1 * grow) * (0.92 + 0.16 * pop) * breathe
    this.cube.object.visible = cubeVis > 0.01
    if (this.cube.object.visible) {
      this.cube.update(t, {
        alpha: cubeVis * (0.55 + 0.45 * glow),
        spin: 0.6 + 0.9 * grow,
        scale: cubeScale * (1 + 0.05 * beatKick),
        color: mixHex('#7f5cc8', '#54e0ff', 0.28 + 0.55 * clamp(grow)),
      })
    }
    // 外框：比立方体略大一点，反向自转，给"超立方体"一个可读的实体参照
    this.frame.object.visible = cubeVis > 0.02
    if (this.frame.object.visible) {
      const fs = 0.62 + 1.05 * grow
      this.frame.object.visible = true
      this.frame.object.scale.setScalar(Math.max(0.001, fs * (1 + 0.06 * pop)))
      this.frame.object.rotation.y = -t * (0.35 + 0.5 * grow)
      this.frame.object.rotation.x = Math.sin(t * 0.42) * 0.4
      this.frame.material.opacity = cubeVis * (0.32 + 0.5 * glow)
      this.frame.material.color.set(mixHex('#8fd4ff', '#e0a6ff', 0.3 + 0.4 * clamp(grow)))
    }
    this.core.visible = cubeVis > 0.02
    if (this.core.visible) {
      this.core.scale.setScalar(Math.max(0.001, 0.5 + 2.6 * grow) * (1 + 0.2 * glow))
      this.core.rotation.y = t * 1.1
      this.core.rotation.x = t * 0.7
      this.coreMat.opacity = cubeVis * (0.35 + 0.5 * glow)
    }
    this.ring.object.visible = cubeVis > 0.02
    if (this.ring.object.visible) {
      this.ring.object.visible = true
      this.ring.object.scale.setScalar(Math.max(0.001, 0.7 + 2.2 * grow))
      this.ring.object.rotation.z = t * 0.28
      this.ring.object.rotation.x = Math.PI / 2 + Math.sin(t * 0.3) * 0.35
      this.ring.material.opacity = cubeVis * 0.4 * (0.4 + 0.6 * glow)
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
    for (let k = 0; k < SLAM_FORMULAS.length; k++) {
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
        lab = textPlane(spec.label, { role: 'label', height: 0.055, weight: 700, family: 'code', color: '#ffd479' })
        this.grp.add(lab.mesh)
        this.slams[k].label = lab
      }
      lab.mesh.visible = true
      lab.mesh.position.set(x - entry.width * 0.5 * sc, y - entry.height * 0.5 * sc - 0.055, formZ + 0.01)
      lab.mesh.scale.setScalar(sc)
      lab.material.opacity = alpha
    }

    /* ================= ④ 巨大 3D ▶ + ⑤ 3D 白闪 ================= */
    const pu = clamp(span(t, TL.execution.start, tExec + 0.5))
    const playFade = 1 - span(t, tExec + 1.35, tExec + 1.75)
    const playA = pu > 0 ? clamp(Math.min(1, pu * 3) * playFade) : 0
    this.play.visible = playA > 0.01
    if (this.play.visible) {
      // 弹性入场（§0.6 的过冲）：outElastic 先把 ▶ 弹大再收住
      const s = 0.55 + 0.45 * outElastic(clamp(pu))
      this.play.scale.setScalar(Math.max(0.001, s))
      // 放在立方体之前（z 更大）——▶ 是"播放按钮"，必须压在最前面
      const px = -0.55 - 0.18 * clamp(span(t, tHappy, tExec))
      this.play.position.set(px, 0.03 + (1 - outCubic(clamp(pu))) * -0.4, camZ - 0.95)
      this.play.rotation.y = -0.2 + 0.12 * Math.sin(t * 0.8)
      this.play.rotation.z = Math.sin(t * 0.55) * 0.05
      // 白热：起手 0.12s 全白 → 回到青色描边
      const hot = Math.exp(-Math.pow(pu * 9, 2))
      this.playFace.color.set(0x9fe8ff).lerp(new THREE.Color(0xffffff), hot)
      this.playSide.color.set(0x2b6f92).lerp(new THREE.Color(0xffffff), hot * 0.8)
      this.playFace.opacity = playA * (0.75 + 0.25 * Math.sin(t * 6.1) ** 2)
      this.playSide.opacity = playA * 0.85
    }
    // 闪白：既走 fx（后处理全屏闪白），也放一片 3D 面 —— §3 E 要的是"亮起并闪白"，
    // 3D 的那一片贴在 ▶ 后面，闪的瞬间连几何一起被冲掉，比纯 2D 全屏白更有"体积"。
    const fl = Math.exp(-Math.pow((t - tExec) * 7, 2)) + 0.6 * Math.exp(-Math.pow((t - tExec - 0.22) * 9, 2))
    this.flash.visible = fl > 0.02
    if (this.flash.visible) {
      this.flash.material.opacity = clamp(fl) * 0.85
      this.flash.position.set(this.play.position.x, this.play.position.y, camZ - 0.8)
    }

    /* ================= ⑥ 透视网格墙合拢成玻璃笼 ================= */
    // 桥接 E→F：合拢的玻璃笼变成展示柜（§2.1 桥接表），所以笼必须在段末保持闭合，
    // 由段 F 接着用；这里只负责"从四周合拢"这一段动作。
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
      // 起点 = 基准位 + 沿"从相机指向该墙"的方向再外推一段（于是看起来是从四周收进来的）
      const dx = b[0] - camX * 0.22
      const dy = b[1] - camY * 0.22
      const dz = b[2] - camZ * 0.2
      const L = Math.hypot(dx, dy, dz) || 1
      w.position.set(b[0] + (dx / L) * 1.5 * k, b[1] + (dy / L) * 1.5 * k, b[2] + (dz / L) * 1.5 * k)
      // 朝向固定（不随合拢变化）：面片在自己的法向上平移，所以旋转保持构造时的值即可
      w.rotation.set(w.userData.rot[0], w.userData.rot[1], w.userData.rot[2])
      const pulse = ctx.sync.pulse(t, 200)
      w.material.opacity = wallA * (0.3 + 0.35 * pulse + 0.25 * closeU)
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
    if (this.ring && this.ring.material) this.ring.material.dispose()
    if (this.frame && this.frame.material) this.frame.material.dispose()
  },
}