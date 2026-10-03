// src/lib/scene3d.js — 逐段 3D 重做的公共构件（FIX.md §3 各段共用）
//
// 为什么单独抽一层：逐段重做会反复需要"把文字做成 3D 面片""线框几何""实例化光点""锁定标定"
// 这几样东西。写在每个场景里会重复 5 遍并各自跑偏；这里统一，并且**统一让文字经 text() 入口**，
// 于是 §0.5 的字号下限对 3D 面片上的文字同样生效（不再有"曲线救国画小字"的空间）。
//
// 所有构件都遵守：
//   · 纯函数：状态只由传入的 t 决定；构造期不读时间；
//   · 不自己管理可见性：由场景每帧显式打开（renderAt 会先把 stage3d 全部隐藏）；
//   · 坐标单位 = 世界单位，且"世界单位 1 = 半屏高"（与 rig.js / 取景约定一致）。

import * as THREE from 'three'
import { text, TEXT_MIN, setTextureSpace, isTextureSpace } from '../ui/text.js'
import { hash01 } from '../core/rng.js'
import { C } from '../core/palette.js'
import { createLightRig } from './props/env.js'

/**
 * 灯光组（转发 props/env 的 createLightRig）。
 * 逐段 3D 重做都要 PBR 可用的环境光 + 主光 + 轮廓光；
 * 放在这里是为了让场景只 import 一个模块，避免每段各自 import 出不一致的写法。
 */
export function createLightRigSafe(opts) {
  return createLightRig(opts)
}

/* ------------------------------------------------------------------ *
 * 1) 文字 → 3D 面片
 * ------------------------------------------------------------------ */

/**
 * 把一段文字画到 canvas 贴图，并返回一个**按世界单位定尺寸**的平面。
 * 字号守卫：`role` 决定下限；canvas 里的 px 值按 (worldHeight / TEXT_REF_UNITS) 反算，
 * 因此"屏幕上的字高"与"3D 世界里的字高"是同一个量，不会出现"数值达标但看上去很小"。
 *
 * @param {string} str
 * @param {{role?:string, color?:string, weight?:number, family?:string,
 *          height?:number, pad?:number, align?:string, letterSpacing?:number,
 *          bg?:string|null, opacity?:number, glow?:number, mono?:boolean}} [o]
 *          height: 世界单位的文字高度（= 一行字的高度，不含留白）
 * @returns {{mesh:THREE.Mesh, texture:THREE.CanvasTexture, width:number, height:number,
 *            setText:Function, dispose:Function}}
 */
export function textPlane(str, o = {}) {
  const {
    role = 'title',
    color = C.fg,
    weight = 700,
    family = 'code',
    height = 0.3,
    pad = 0.18,
    align = 'center',
    bg = null,
    opacity = 1,
    glow = 0,
  } = o
  const min = TEXT_MIN[role] != null ? TEXT_MIN[role] : 22
  // canvas 上的字号：把"世界高度"换算成像素。REF = 1080 逻辑高度的一半（半屏高 = 1 世界单位）。
  const REF = 540
  const fontPx = Math.max(min, Math.round(height * REF))
  if (fontPx < min) throw new Error(`[scene3d] role=${role} 字号 ${fontPx} < 下限 ${min}`)
  const family2 = family === 'code' ? '"JetBrains Mono", monospace' : 'system-ui, sans-serif'
  const font = `${weight} ${fontPx}px ${family2}`
  // 画布按**整串**宽度裁，并且在 setText 时不改变画布尺寸 ——
  // 这样面片的世界尺寸恒定，屏幕上文字的"起点"也不会随键入进度跳动。
  const meas = document.createElement('canvas').getContext('2d')
  meas.font = font
  const lines0 = String(str).split('\n')
  const fullW = Math.max(8, Math.ceil(Math.max(...lines0.map((L) => meas.measureText(L).width))))
  const padPx = Math.max(2, Math.round(fontPx * pad))
  const lineH = Math.ceil(fontPx * 1.18)
  const nLines = () => String(lastStr == null ? str : lastStr).split('\n').length
  const cv = document.createElement('canvas')
  cv.width = fullW + padPx * 2
  cv.height = lineH * lines0.length + Math.round(fontPx * 0.3)
  const g = cv.getContext('2d')
  let lastStr = null
  const paint = (s) => {
    // 这片 canvas 是**贴图**：坐标与屏幕无关，期间必须关闭 §2.8 的屏幕包围盒登记。
    // 否则整片文字会被记在"贴图坐标"上，与屏幕上的其它文字产生大量假重叠
    // （实测：段 D 的年份 billboard、段 E 的公式片，全都报在 (29,40) 处 IoU=1）。
    const prev = isTextureSpace()
    setTextureSpace(true)
    g.clearRect(0, 0, cv.width, cv.height)
    if (bg) {
      g.fillStyle = bg
      g.fillRect(0, 0, cv.width, cv.height)
    }
    if (glow > 0) {
      g.shadowColor = color
      g.shadowBlur = Math.round(fontPx * 0.55 * glow)
    }
    g.font = font
    const lines = String(s).split('\n')
    const y0 = cv.height / 2 - ((lines.length - 1) * lineH) / 2
    for (let i = 0; i < lines.length; i++) {
      // 走统一入口 → 受 §0.5 字号守卫约束（这里已经先做过一次硬校验，text() 再兜一次）
      text(g, lines[i], padPx, y0 + i * lineH, {
        role,
        size: fontPx,
        family,
        weight,
        color,
        align: 'left',
        baseline: 'middle',
        alpha: 1,
      })
    }
    g.shadowBlur = 0
    setTextureSpace(prev)
  }
  paint(str)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  // ⚠️ 世界尺寸必须由 **fontPx** 反算，不能用 canvas 的像素高度 ——
  // canvas 高里含行距与留白，直接拿它当"世界高度"会让每一片文字整体偏大 1.34 倍，
  // 于是"文字的屏幕像素高度"这个量失去意义（§0.5 的换算会跟着一起偏）。
  // worldH = 字面高度（fontPx）折算到世界单位；worldW 按同比例给出整片宽度。
  const unitsPerPx = 1 / REF
  const worldH = fontPx * unitsPerPx
  const worldW = cv.width * unitsPerPx
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: glow > 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), mat)
  mesh.name = `textPlane:${str.slice(0, 18)}`
  mesh.userData.isTextPlane = true

  return {
    mesh,
    texture: tex,
    material: mat,
    width: worldW,
    height: worldH,
    fontPx,
    /**
     * 重画文字（用于"逐字键入"）。
     * 刻意**不用 texture.repeat 裁剪**：那样只能截到字形的中间，屏幕上会看到半个字，
     * 而且面片尺寸与可见文字的比例会随裁剪量变化（实测"world"被拉成一屏宽）。
     * 这里真正重画 canvas，只在字符数变化时调用（1 秒内十几次，开销可忽略）。
     * @param {string} next
     */
    setText(next) {
      const str2 = String(next)
      if (str2 === lastStr) return
      lastStr = str2
      paint(str2)
      tex.needsUpdate = true
    },
    /** 供自检：这一片文字在屏幕上的像素高度（给定"世界单位 1 = pxPerUnit 像素"） */
    pxHeight: (pxPerUnit) => worldH * pxPerUnit,
    dispose() {
      tex.dispose()
      mat.dispose()
      mesh.geometry.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 2) 线框几何（"创建出来"的立方体 / 球 / 环面）
 * ------------------------------------------------------------------ */

/**
 * 线框几何：线段粗细在 WebGL 里不可靠，所以用细圆柱搭边（可控粗细 + 能吃光照）。
 * @param {'box'|'sphere'|'torus'|'cone'} kind
 * @param {{size?:number, color?:string, radius?:number, glow?:boolean, segments?:number}} [o]
 */
export function wireShape(kind, o = {}) {
  const { size = 0.6, color = 0x8fd4ff, radius = 0.008, glow = true, segments = 12 } = o
  const grp = new THREE.Group()
  grp.name = `wire:${kind}`
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  })
  const r = size
  const add = (geo, pos, rot) => {
    const m = new THREE.Mesh(geo, mat)
    if (pos) m.position.set(pos[0], pos[1], pos[2])
    if (rot) m.rotation.set(rot[0], rot[1], rot[2])
    grp.add(m)
    return m
  }
  const cyl = (len, rad = radius) => new THREE.CylinderGeometry(rad, rad, len, 5, 1)

  if (kind === 'box') {
    // 12 条棱
    for (const s of [-1, 1]) {
      add(cyl(2 * r), [0, s * r, s * r], [Math.PI / 2, 0, 0])
      add(cyl(2 * r), [s * r, 0, s * r], [0, 0, Math.PI / 2])
      add(cyl(2 * r), [s * r, s * r, 0], [0, 0, 0])
    }
  } else if (kind === 'sphere') {
    // 经纬线
    const rings = 4
    const merid = 6
    for (let i = 1; i <= rings; i++) {
      const y = -r + (2 * r * i) / (rings + 1)
      const rr = Math.sqrt(Math.max(1e-4, r * r - y * y))
      const t = new THREE.Mesh(new THREE.TorusGeometry(rr, radius, 4, segments * 3), mat)
      t.position.y = y
      t.rotation.x = Math.PI / 2
      grp.add(t)
    }
    for (let i = 0; i < merid; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, radius, 4, segments * 3), mat)
      t.rotation.y = (i / merid) * Math.PI
      grp.add(t)
    }
  } else if (kind === 'torus') {
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.74, r * 0.26, 4, segments * 2), mat)
      t.rotation.y = (i / 4) * Math.PI
      grp.add(t)
    }
  } else if (kind === 'cone') {
    const n = 6
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const len = Math.hypot(r, r)
      const m = add(cyl(len), [Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5])
      m.lookAt(new THREE.Vector3(0, r, 0))
      m.rotateX(Math.PI / 2)
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, radius, 4, segments * 2), mat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -r
    grp.add(ring)
  }
  grp.userData.material = mat
  return { object: grp, material: mat, size }
}

/* ------------------------------------------------------------------ *
 * 3) 实例化光点阵（参数晶格 / 数值条 / 星点都靠它）
 * ------------------------------------------------------------------ */

/**
 * 实例化立方体阵：每个实例可单独设颜色与缩放，用来说明"一格格铺开 / 逐块点亮"。
 * @param {{count?:number, cell?:number, gap?:number, color?:number}} [o]
 */
export function voxelField(o = {}) {
  const { count = 512, cell = 0.05, gap = 0.02 } = o
  const geo = new THREE.BoxGeometry(cell, cell, cell)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    emissive: 0x0a1a2a,
    emissiveIntensity: 1.0,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  mesh.name = 'voxelField'
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const col = new THREE.Color()

  /**
   * @param {(i:number)=>[number,number,number]} posOf
   * @param {(i:number)=>number} showOf 0..1 出现进度（0 = 压成 0）
   * @param {(i:number)=>THREE.Color|number} colorOf
   */
  function update(posOf, showOf, colorOf) {
    for (let i = 0; i < count; i++) {
      const [x, y, z] = posOf(i)
      const k = showOf(i)
      p.set(x, y, z)
      q.identity()
      const sc = k <= 0.001 ? 0.001 : 0.35 + 0.65 * k
      s.set(sc, sc, sc)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      const c = colorOf(i)
      if (typeof c === 'number') col.setHex(c)
      else col.copy(c)
      mesh.setColorAt(i, col)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
  return { object: mesh, mesh, material: mat, count, update }
}

/* ------------------------------------------------------------------ *
 * 4) 3D 示波器 / 曲线
 * ------------------------------------------------------------------ */

/**
 * 由一组 [x,y] 采样点生成一条发光管（用 TubeGeometry，粗细可控、有厚度）。
 * @param {number[][]} pts 世界坐标 [[x,y,z], ...]
 * @param {{radius?:number, color?:number, glow?:boolean, tubular?:number}} [o]
 */
export function glowTube(pts, o = {}) {
  const { radius = 0.012, color = 0x7fd8ff, glow = true, tubular = 220 } = o
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(pts.length * 3)
  for (let i = 0; i < pts.length; i++) {
    pos[i * 3] = pts[i][0]
    pos[i * 3 + 1] = pts[i][1]
    pos[i * 3 + 2] = pts[i][2] || 0
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0)))
  const tube = new THREE.TubeGeometry(curve, tubular, radius, 6, false)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(tube, mat)
  mesh.name = 'glowTube'
  return {
    object: mesh,
    material: mat,
    /** 重算管体（形状随数据变时用） */
    rebuild(next) {
      const c = new THREE.CatmullRomCurve3(next.map((p) => new THREE.Vector3(p[0], p[1], p[2] || 0)))
      mesh.geometry.dispose()
      mesh.geometry = new THREE.TubeGeometry(c, tubular, radius, 6, false)
    },
    dispose() {
      tube.dispose()
      mat.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 5) 标定：屏幕像素 → 世界单位（供自检与"≥Npx"这类硬要求换算）
 * ------------------------------------------------------------------ */

/**
 * 相机在某深度处的"世界单位 → 屏幕像素"比例。
 * 用于把 §0.5 的像素下限换算成 3D 里的世界尺寸，避免"数值达标但看上去很小"。
 * @param {THREE.Camera} camera
 * @param {number} z 目标深度（世界 z）
 * @param {number} screenH 逻辑画面高度（1080）
 */
export function pxPerUnitAt(camera, z, screenH = 1080) {
  const dist = Math.max(0.05, camera.position.z - z)
  const visH = 2 * dist * Math.tan(((camera.fov * Math.PI) / 180) / 2)
  return screenH / visH
}

/* ------------------------------------------------------------------ *
 * 6) 小工具
 * ------------------------------------------------------------------ */

/** 在一条轨道上按给定顺序生成"逐格铺开"的延迟（0..1 归一化位置 + 抖动） */
export function staggerOf(i, n, { seed = 0, jitter = 0.35 } = {}) {
  const base = n <= 1 ? 0 : i / (n - 1)
  return Math.min(1, Math.max(0, base * (1 - jitter) + hash01(i, seed) * jitter))
}

/** 把一串参数 [0..1] 映射成"从中心向外"的铺开顺序 */
export function radialOrder(pos, n, seed = 0) {
  let max = 1e-6
  const d = []
  for (let i = 0; i < n; i++) {
    const p = pos(i)
    const r = Math.hypot(p[0], p[1], p[2] || 0)
    d.push(r)
    if (r > max) max = r
  }
  return (i) => d[i] / max + hash01(i, seed) * 0.06
}

export { TEXT_MIN }
