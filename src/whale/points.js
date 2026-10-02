// src/whale/points.js — 点云（SPEC §4.3/§4.4）。
// 位置在 CPU 上用解析布局算出（≤8000 点，纯函数、每帧可重算），
// 上传到 Three 的 Points；着色器只负责圆形软点和逐点大小/透明度。

import * as THREE from 'three'
import { hash01, gauss } from '../core/rng.js'
import { clamp, lerp, inOutCubic, outCubic } from '../core/ease.js'

const TAU = Math.PI * 2
let DATA = null

/** 载入 whale_points.json */
export async function loadPoints(url = './data/whale_points.json') {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`whale_points.json ${res.status}`)
  DATA = await res.json()
  return DATA
}
export const pointsData = () => DATA
export const count = () => (DATA ? DATA.count : 0)

/* ------------------------------------------------------------------ *
 * 布局：每个都是 (i, N, p) → [x, y, z]，单位 1 = 半屏高，y 向上
 * p 里可带 { frame:{cx,cy,S}, rect, data, ...params }
 * ------------------------------------------------------------------ */
export const LAYOUTS = {
  // 与立绘完全对齐：用于「立绘 ⇄ 点云」溶解。
  // zScale 把 z 压成适度的浮雕厚度（否则环绕时会散成一团）。
  sprite(i, N, p) {
    const d = p.data || DATA
    const r = p.rect
    const f = p.frame
    const zs = p.zScale ?? 0.34
    const px = r.x + d.u[i] * r.w
    const py = r.y + d.v[i] * r.h
    return [(px - f.cx) / f.S, -(py - f.cy) / f.S, ((d.z[i] * r.h) / f.S) * zs]
  },
  circle(i, N, p) {
    const a = (i / N) * TAU + (p.rot || 0)
    const r = p.r ?? 0.62
    return [r * Math.cos(a), r * Math.sin(a), 0]
  },
  sine(i, N, p) {
    const x = -0.92 + 1.84 * (i / N)
    const k = p.k ?? 3
    const amp = p.amp ?? 0.42
    return [x, amp * Math.sin(k * Math.PI * x + (p.phase || 0)), 0]
  },
  // 沿正弦曲线的切线方向铺点（段 C 的「切线」）
  tangents(i, N, p) {
    const M = p.segments ?? 22
    const per = Math.max(2, Math.floor(N / M))
    const k = Math.min(M - 1, Math.floor(i / per))
    const u = ((i % per) + 0.5) / per
    const kk = p.k ?? 3
    const amp = p.amp ?? 0.42
    const x0 = -0.92 + (1.84 * (k + 0.5)) / M
    const y0 = amp * Math.sin(kk * Math.PI * x0)
    const slope = amp * kk * Math.PI * Math.cos(kk * Math.PI * x0)
    const inv = 1 / Math.hypot(1, slope)
    const dx = inv, dy = slope * inv
    const s = (u - 0.5) * (p.len ?? 0.42)
    return [x0 + s * dx, y0 + s * dy, (p.z ?? 0) * (u - 0.5)]
  },
  lemniscate(i, N, p) {
    const a = p.a ?? 0.74
    const th = (i / N) * TAU + (p.rot || 0)
    const den = 1 + Math.sin(th) ** 2
    return [(a * Math.cos(th)) / den, (a * Math.sin(th) * Math.cos(th) * 1.9) / den, 0]
  },
  helix(i, N, p) {
    const turns = p.turns ?? 3
    const th = (i / N) * TAU * turns + (p.rot || 0)
    const r = p.r ?? 0.42
    return [r * Math.cos(th), -0.9 + 1.8 * (i / N), r * Math.sin(th)]
  },
  spiral(i, N, p) {
    const turns = p.turns ?? 4.5
    const u = i / N
    const th = u * TAU * turns + (p.rot || 0)
    const r = (p.r0 ?? 0.04) + (p.r1 ?? 0.98) * u
    return [r * Math.cos(th), r * Math.sin(th), (p.z ?? 0) * u]
  },
  galaxy(i, N, p) {
    const arms = p.arms ?? 3
    const arm = i % arms
    const u = Math.sqrt(hash01(i, 7))
    const r = 0.06 + 0.94 * u
    const th = u * TAU * (p.turns ?? 2.1) + (arm * TAU) / arms + (hash01(i, 8) - 0.5) * 0.35
    const flat = p.flat ?? 0.5
    return [
      r * Math.cos(th) + gauss(i, 9) * 0.03,
      r * Math.sin(th) * flat + gauss(i, 10) * 0.03,
      gauss(i, 11) * 0.1 * (1 - u * 0.5),
    ]
  },
  // 平面心形（段 M 的心形曲面在 z 上鼓起，形成 3D 心）
  heart(i, N, p) {
    const th = (i / N) * TAU + (p.rot || 0)
    const s = p.a ?? 0.052
    const x = 16 * Math.sin(th) ** 3
    const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)
    const nx = x * s
    const ny = y * s
    const shell = p.shell ?? 0.16
    const z = Math.cos(th * 2) * shell * Math.sqrt(Math.max(0, 1 - (nx * nx + ny * ny) / 0.9))
    return [nx, ny, p.flat ? 0 : z]
  },
  grid(i, N, p) {
    const a = p.aspect ?? 1.7778
    const span = p.span ?? 1.5
    const cols = Math.max(1, Math.round(Math.sqrt(N * a)))
    const rows = Math.max(1, Math.ceil(N / cols))
    const c = i % cols
    const r = Math.floor(i / cols)
    return [(-0.5 + (c + 0.5) / cols) * span * a, (0.5 - (r + 0.5) / rows) * span, (p.z ?? 0)]
  },
  scatter(i, N, p) {
    const a = p.aspect ?? 1.7778
    const s = p.spread ?? 1.05
    return [(hash01(i, 21) * 2 - 1) * s * a, (hash01(i, 22) * 2 - 1) * s, (hash01(i, 23) * 2 - 1) * 0.5]
  },
  // 竖直渐近线前的冲散（段 C 结尾）
  asymptote(i, N, p) {
    const x = -0.2 + 1.05 * Math.pow(i / N, 0.35)
    const y = Math.tanh((i / N) * 6 - 3) * 0.85 + (hash01(i, 31) - 0.5) * 0.08
    return [Math.min(x, 0.95), y, (hash01(i, 32) - 0.5) * 0.2]
  },
}

/* ------------------------------------------------------------------ *
 * 点云图层
 * ------------------------------------------------------------------ */
function makeDotTexture(THREE) {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

const VERT = `
attribute float aAlpha;
attribute float aScale;
attribute vec3 aColor;
uniform float uSize;
uniform float uAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha * uAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aScale * uSize;
}
`
const FRAG = `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  float a = t.a * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`

export function createPointsLayer(data) {
  DATA = data || DATA
  const N = DATA.count
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const alp = new Float32Array(N)
  const scl = new Float32Array(N)
  // 颜色按 sRGB 还原（Three r152+ 默认 linear-srgb 工作流下用 setRGB + SRGB 转换）
  const c0 = new THREE.Color()
  for (let i = 0; i < N; i++) {
    const packed = DATA.c[i] >>> 0
    const a = (packed & 255) / 255
    c0.setRGB(((packed >>> 24) & 255) / 255, ((packed >>> 16) & 255) / 255, ((packed >>> 8) & 255) / 255, THREE.SRGBColorSpace)
    col[i * 3] = c0.r
    col[i * 3 + 1] = c0.g
    col[i * 3 + 2] = c0.b
    alp[i] = a
    scl[i] = 1
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1))
  geo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 4.0 },
      uAlpha: { value: 1.0 },
      uMap: { value: makeDotTexture(THREE) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const object = new THREE.Points(geo, mat)
  object.frustumCulled = false
  object.renderOrder = 20

  const bufA = new Float32Array(N * 3)
  const bufB = new Float32Array(N * 3)

  function evalLayout(name, out, p) {
    const fn = LAYOUTS[name] || LAYOUTS.sprite
    for (let i = 0; i < N; i++) {
      const v = fn(i, N, p)
      out[i * 3] = v[0]
      out[i * 3 + 1] = v[1]
      out[i * 3 + 2] = v[2]
    }
  }

  /**
   * update(t, opts)
   * opts: {
   *   from='sprite', to='sprite', p=1, stagger=0.35, ease=inOutCubic, seed=0,
   *   frame:{cx,cy,S}, rect, baseParams, fromParams, toParams,
   *   rotY=0, rotX=0, offsetX=0, offsetY=0, zoom=1,
   *   size=4, alpha=1, depthFade=0.5, bulge=0.18
   * }
   */
  function update(t, opts = {}) {
    const {
      from = 'sprite',
      to = 'sprite',
      p = 1,
      stagger = 0.35,
      ease = inOutCubic,
      seed = 0,
      frame = { cx: 0, cy: 0, S: 540 },
      rotY = 0,
      rotX = 0,
      offsetX = 0,
      offsetY = 0,
      zoom = 1,
      size = 4,
      alpha = 1,
      depthFade = 0.45,
      bulge = 0.16,
    } = opts
    const baseParams = opts.baseParams || {}
    const P = { ...baseParams, frame, rect: opts.rect, data: DATA, aspect: frame.S ? (frame.cx * 2) / (frame.S * 2) : 1.7778 }
    const pFrom = { ...P, ...(opts.fromParams || {}) }
    const pTo = { ...P, ...(opts.toParams || {}) }

    if (from === to || p >= 1) {
      evalLayout(to, bufB, pTo)
      bufA.set(bufB)
    } else {
      evalLayout(from, bufA, pFrom)
      evalLayout(to, bufB, pTo)
    }

    const cy2 = Math.cos(rotY)
    const sy2 = Math.sin(rotY)
    const cx2 = Math.cos(rotX)
    const sx2 = Math.sin(rotX)
    const posAttr = geo.attributes.position
    const sclAttr = geo.attributes.aScale
    const alpAttr = geo.attributes.aAlpha
    const cf = -0.5 // 相机在 +z 看 -z 的补偿，使 z>0 更靠近相机

    for (let i = 0; i < N; i++) {
      const i3 = i * 3
      const d = hash01(i, seed ^ 0x51ed) * stagger
      const u = stagger < 1 ? clamp((p - d) / (1 - stagger)) : clamp(p)
      const e = ease(u)
      let x = lerp(bufA[i3], bufB[i3], e)
      let y = lerp(bufA[i3 + 1], bufB[i3 + 1], e)
      let z = lerp(bufA[i3 + 2], bufB[i3 + 2], e)
      if (bulge > 0 && u > 0 && u < 1) {
        const b = Math.sin(u * Math.PI) * bulge
        x += (hash01(i, seed ^ 1) - 0.5) * b
        y += (hash01(i, seed ^ 2) - 0.5) * b
        z += (hash01(i, seed ^ 3) - 0.5) * b * 2
      }
      // 绕 Y / X 旋转（近正交：只做线性变换）
      let x1 = x * cy2 + z * sy2
      let z1 = -x * sy2 + z * cy2
      let y1 = y * cx2 - z1 * sx2
      let z2 = y * sx2 + z1 * cx2
      x1 = x1 * zoom + offsetX
      y1 = y1 * zoom + offsetY
      z2 = z2 * zoom + cf
      posAttr.array[i3] = x1
      posAttr.array[i3 + 1] = y1
      posAttr.array[i3 + 2] = z2
      // 近处（z 大）更大更亮
      const depth = clamp(0.5 - z2 * depthFade, 0.18, 1.35)
      sclAttr.array[i] = size * depth
      alpAttr.array[i] = clamp(0.55 + (1 - depth) * -0.0 + depth * 0.5)
    }
    posAttr.needsUpdate = true
    sclAttr.needsUpdate = true
    alpAttr.needsUpdate = true
    mat.uniforms.uSize.value = 2.6
    mat.uniforms.uAlpha.value = alpha
  }

  return {
    object,
    material: mat,
    geometry: geo,
    update,
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}

export const LAYOUT_NAMES = Object.keys(LAYOUTS)
