// src/whale/mesh.js — 三角网格（SPEC §4.3/§4.4）。
// mesh(t, {assemble:p})：三角形从 hash 决定的随机方位飞入并拼成立绘。
// 780 个三角 → 2340 个非索引顶点，位置每帧在 CPU 上算。

import * as THREE from 'three'
import { hash01, gauss } from '../core/rng.js'
import { clamp, lerp, inOutCubic, outCubic } from '../core/ease.js'

let DATA = null
export async function loadMesh(url = './data/whale_mesh.json') {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`whale_mesh.json ${res.status}`)
  DATA = await res.json()
  return DATA
}
export const meshData = () => DATA

export function createMeshLayer(data) {
  DATA = data || DATA
  const triCount = DATA.triangleCount
  const verts = DATA.verts
  const tris = DATA.tris
  const colors = DATA.colors
  const N = triCount * 3

  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const c0 = new THREE.Color()
  for (let k = 0; k < triCount; k++) {
    c0.setRGB(colors[k * 3] / 255, colors[k * 3 + 1] / 255, colors[k * 3 + 2] / 255, THREE.SRGBColorSpace)
    for (let j = 0; j < 3; j++) {
      const vi = k * 3 + j
      col[vi * 3] = c0.r
      col[vi * 3 + 1] = c0.g
      col[vi * 3 + 2] = c0.b
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const object = new THREE.Mesh(geo, mat)
  object.frustumCulled = false
  object.renderOrder = 18

  // 预计算每个三角的「家」坐标（frame 单位）与起飞参数
  const home = new Float32Array(N * 3) // 每顶点
  const triHome = new Float32Array(triCount * 3) // 质心
  const dirX = new Float32Array(triCount)
  const dirY = new Float32Array(triCount)
  const startScale = new Float32Array(triCount)
  const startRot = new Float32Array(triCount)
  const startZ = new Float32Array(triCount)
  let built = false

  function buildHome(frame, rect) {
    for (let k = 0; k < triCount; k++) {
      let cxsum = 0, cysum = 0
      for (let j = 0; j < 3; j++) {
        const vi = tris[k * 3 + j]
        const u = verts[vi * 2]
        const v = verts[vi * 2 + 1]
        const px = rect.x + u * rect.w
        const py = rect.y + v * rect.h
        const x = (px - frame.cx) / frame.S
        const y = -(py - frame.cy) / frame.S
        home[(k * 3 + j) * 3] = x
        home[(k * 3 + j) * 3 + 1] = y
        home[(k * 3 + j) * 3 + 2] = 0
        cxsum += x
        cysum += y
      }
      triHome[k * 3] = cxsum / 3
      triHome[k * 3 + 1] = cysum / 3
      triHome[k * 3 + 2] = 0
      const a = hash01(k, 91) * Math.PI * 2
      const r = 1.1 + hash01(k, 92) * 1.6
      dirX[k] = Math.cos(a) * r
      dirY[k] = Math.sin(a) * r
      startScale[k] = 0.18 + hash01(k, 93) * 0.45
      startRot[k] = (hash01(k, 94) * 2 - 1) * Math.PI * 2.2
      startZ[k] = (hash01(k, 95) * 2 - 1) * 1.4
    }
    built = true
  }

  /**
   * update(t, opts): {assemble=1, frame, rect, alpha=1, scatter=0, ease}
   * assemble 0 → 四散；1 → 拼成。scatter 额外把它们吹散（用于爆散）。
   */
  function update(t, opts = {}) {
    const { frame, rect, alpha = 1, assemble = 1, scatter = 0, ease = inOutCubic } = opts
    if (!frame || !rect) return
    if (!built || frame.cx !== update._cx || frame.cy !== update._cy || frame.S !== update._S || rect.x !== update._rx || rect.w !== update._rw) {
      buildHome(frame, rect)
      update._cx = frame.cx; update._cy = frame.cy; update._S = frame.S
      update._rx = rect.x; update._rw = rect.w; update._ry = rect.y; update._rh = rect.h
    }
    const e = ease(clamp(assemble))
    const pa = geo.attributes.position
    const s = Math.sin, c = Math.cos
    for (let k = 0; k < triCount; k++) {
      const cxT = triHome[k * 3], cyT = triHome[k * 3 + 1]
      const sx = lerp(triHome[k * 3] + dirX[k], cxT, e)
      const sy = lerp(triHome[k * 3 + 1] + dirY[k], cyT, e)
      const sz = lerp(startZ[k], 0, e) + scatter * (0.5 + hash01(k, 96))
      const sc = lerp(startScale[k], 1, e)
      const ang = lerp(startRot[k], 0, e)
      const ca = c(ang), sa = s(ang)
      for (let j = 0; j < 3; j++) {
        const idx = (k * 3 + j) * 3
        const ox = (home[idx] - cxT) * sc
        const oy = (home[idx + 1] - cyT) * sc
        pa.array[idx] = sx + ox * ca - oy * sa
        pa.array[idx + 1] = sy + ox * sa + oy * ca
        pa.array[idx + 2] = sz
      }
    }
    pa.needsUpdate = true
    mat.opacity = alpha * Math.max(0, 1 - scatter * 0.6)
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
