// src/lib/digitAtlas.js — 预渲染字形图集 + 「只改 UV、不重传纹理」的数字/字母标签
//
// 为什么需要它（FIX_V5 §G8 原文）：
//   「0:52 时空隧道帧数过低——环用 InstancedMesh,数字做成预渲染图集,不得每帧重绘文字纹理。」
//
// 旧实现（段 D 的年份 billboard）走 `scene3d.textPlane()`：每个标签每帧都要 `setText()`，
// 而 `setText()` 会真的**重画 canvas** 并把 `texture.needsUpdate = true` —— 于是每帧 12 次
// canvas 重画 + 12 次纹理重传。0:52 那段正是"数字最多、环最多"的时刻，帧率就是被它拖下去的。
//
// 这里的做法：
//   · 构造期把需要的字形（数字/'-'/'m'/'A'-'D'…）一次性画进**一张**图集纹理（默认 2048×512）；
//   · 每个标签是一块"逐字一个四边形"的自定义 BufferGeometry，顶点位置在构造期定死；
//   · 每帧 `setText()` 只改 `uv` 属性（指向图集里对应字形的格子），**纹理由始至终只上传一次**。
//
// 口径与 `scene3d.textPlane()` 保持一致（世界单位 1 = 540px 字面高、等宽字距），
// 所以把 textPlane 换成 digitLabel 时字号/位置不需要重新标定；`height` 的含义也完全一样。

import * as THREE from 'three'
import { text, setTextureSpace, isTextureSpace, fontStack } from '../ui/text.js'

const REF = 540 // 与 scene3d.textPlane 同一换算基准：半屏高 = 1 世界单位 = 540px 字面高
let seq = 0 // §G3：名字逐实例唯一（同一段文案会造出多块面片）

/**
 * 预渲染字形图集。
 * @param {string} chars 需要的字符（按首次出现顺序排进格子，重复字符共用一格）
 * @param {{fontPx?:number, weight?:number, color?:string, glow?:number, cell?:number, cols?:number,
 *          family?:string, role?:string}} [o]
 * @returns {{texture:THREE.CanvasTexture, width:number, height:number, cell:number, cols:number, rows:number,
 *            fontPx:number, advancePx:number, chars:string, indexOf:Function, dispose:Function}}
 */
export function digitAtlas(chars, o = {}) {
  const {
    fontPx = 190,
    weight = 700,
    color = '#ffffff',
    glow = 0,
    cell = 256,
    cols = 8,
    family = 'code',
    role = 'title',
  } = o
  const list = []
  const index = new Map()
  for (const ch of String(chars)) {
    if (index.has(ch)) continue
    index.set(ch, list.length)
    list.push(ch)
  }
  const rows = Math.max(1, Math.ceil(list.length / cols))
  const cv = document.createElement('canvas')
  cv.width = cols * cell
  cv.height = rows * cell
  const g = cv.getContext('2d')
  g.clearRect(0, 0, cv.width, cv.height)
  // 图集是**贴图**：绘制期间必须关掉屏幕包围盒登记，否则每个字形都会被当成屏幕文字参与重叠自检
  // （scene3d.textPlane 的 paint() 出于同样的理由调 setTextureSpace）。
  const prev = isTextureSpace()
  setTextureSpace(true)
  const font = `${weight} ${fontPx}px ${fontStack(family)}`
  g.font = font
  for (let i = 0; i < list.length; i++) {
    const cx = (i % cols) * cell + cell / 2
    const cy = Math.floor(i / cols) * cell + cell / 2
    if (glow > 0) {
      g.shadowColor = color
      g.shadowBlur = Math.round(fontPx * 0.55 * glow)
    }
    // 走统一入口 → 受 §0.5 字号守卫约束（role 'title' 的下限 120px）
    text(g, list[i], cx, cy, { role, size: fontPx, font, family, weight, color, align: 'center', baseline: 'middle' })
  }
  g.shadowBlur = 0
  setTextureSpace(prev)
  // 等宽字距：同一字体下所有字形共用同一个 advance（'0' 的宽度即字距）
  const advancePx = Math.max(1, g.measureText('0').width)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return {
    texture: tex,
    width: cv.width,
    height: cv.height,
    cell,
    cols,
    rows,
    fontPx,
    advancePx,
    glow,
    chars: list.join(''),
    indexOf: (ch) => (index.has(ch) ? index.get(ch) : -1),
    dispose() {
      tex.dispose()
    },
  }
}

/**
 * 用图集拼一块标签面片。构造期固定 `slots` 个字符位（位置定死），每帧只改 UV：
 *   · 字符数变化时文字**不会跳动**（右对齐时向左生长、居中对齐时向两侧生长）；
 *   · 不足 `slots` 的位把四边形退化成一个点（零面积 → 光栅化阶段直接丢弃）。
 * @param {ReturnType<typeof digitAtlas>} atlas
 * @param {string} str 初始文字
 * @param {{slots?:number, height?:number, align?:'left'|'center'|'right', opacity?:number,
 *          name?:string, toneMapped?:boolean, noPost?:boolean}} [o]
 *   height: 世界单位的字面高度（与 scene3d.textPlane 的 `height` 同口径）
 * @returns {{mesh:THREE.Mesh, material:THREE.MeshBasicMaterial, slots:number, height:number,
 *            setText:Function, setOpacity:Function, pxHeight:Function, dispose:Function}}
 */
export function digitLabel(atlas, str, o = {}) {
  const {
    slots = 12,
    height = 0.3,
    align = 'center',
    opacity = 1,
    name = null,
    toneMapped = true,
    noPost = false,
  } = o
  const upp = height / atlas.fontPx // 世界单位 / 图集像素
  const qw = atlas.advancePx * upp // 每格的宽 = 等宽字距
  const qh = atlas.fontPx * 1.3 * upp // 每格的高（含一点上下留白，与 UV 的竖带一致）
  const pos = new Float32Array(slots * 4 * 3)
  const uv = new Float32Array(slots * 4 * 2)
  const idx = new Uint16Array(slots * 6)
  for (let i = 0; i < slots; i++) {
    const xc =
      align === 'right'
        ? (i - slots + 0.5) * qw
        : align === 'left'
          ? (i + 0.5) * qw
          : (i - (slots - 1) / 2) * qw
    const x0 = xc - qw / 2
    const x1 = xc + qw / 2
    const y0 = -qh / 2
    const y1 = qh / 2
    const b = i * 4
    pos[b * 3] = x0
    pos[b * 3 + 1] = y0
    pos[(b + 1) * 3] = x1
    pos[(b + 1) * 3 + 1] = y0
    pos[(b + 2) * 3] = x0
    pos[(b + 2) * 3 + 1] = y1
    pos[(b + 3) * 3] = x1
    pos[(b + 3) * 3 + 1] = y1
    const ib = i * 6
    idx[ib] = b
    idx[ib + 1] = b + 1
    idx[ib + 2] = b + 2
    idx[ib + 3] = b + 2
    idx[ib + 4] = b + 1
    idx[ib + 5] = b + 3
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const uvAttr = new THREE.BufferAttribute(uv, 2)
  uvAttr.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('uv', uvAttr)
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.max(0.01, slots * qw))
  const mat = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    // 与 scene3d.textPlane 同一约定：图集里烤了 glow（发光）就用加色混合，否则普通混合
    blending: atlas.glow > 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name || `digitLabel:${String(str).slice(0, 12)}#${++seq}`
  mesh.userData.isDigitLabel = true
  mesh.userData.noPost = !!noPost
  mesh.frustumCulled = false

  const halfU = atlas.advancePx / 2 / atlas.width
  const halfV = (atlas.fontPx * 0.65) / atlas.height
  let last = null
  /** 每帧只改 uv：把每个字符位指向图集里对应字形那一格（未用的位退化成零面积） */
  function setText(next) {
    const s = String(next)
    if (s === last) return
    last = s
    const L = Math.min(s.length, slots)
    const off = align === 'right' ? slots - L : align === 'center' ? Math.floor((slots - L) / 2) : 0
    for (let i = 0; i < slots; i++) {
      const k = i - off
      const ch = k >= 0 && k < L ? s[k] : null
      const ci = ch == null ? -1 : atlas.indexOf(ch)
      const b = i * 4
      if (ci < 0) {
        // 零面积：四个顶点同一个 uv 点，光栅化阶段直接丢掉
        for (let v = 0; v < 4; v++) {
          uv[(b + v) * 2] = 0
          uv[(b + v) * 2 + 1] = 0
        }
        continue
      }
      const col = ci % atlas.cols
      const row = Math.floor(ci / atlas.cols)
      const cx = (col + 0.5) / atlas.cols
      const cyTop = (row + 0.5) / atlas.rows // canvas 行号（自上而下）
      const u0 = cx - halfU
      const u1 = cx + halfU
      // three 的 CanvasTexture 默认 flipY=true → v=0 在图像底部
      const vTop = 1 - (cyTop - halfV)
      const vBot = 1 - (cyTop + halfV)
      uv[b * 2] = u0
      uv[b * 2 + 1] = vBot
      uv[(b + 1) * 2] = u1
      uv[(b + 1) * 2 + 1] = vBot
      uv[(b + 2) * 2] = u0
      uv[(b + 2) * 2 + 1] = vTop
      uv[(b + 3) * 2] = u1
      uv[(b + 3) * 2 + 1] = vTop
    }
    uvAttr.needsUpdate = true
  }
  setText(str)

  return {
    mesh,
    material: mat,
    slots,
    height,
    setText,
    setOpacity: (a) => {
      mat.opacity = a
    },
    /** 供自检：这一片文字在屏幕上的像素高度（给定"世界单位 1 = pxPerUnit 像素"） */
    pxHeight: (pxPerUnit) => qh * pxPerUnit,
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
