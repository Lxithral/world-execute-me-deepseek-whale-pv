// src/whale/wire.js — 轮廓线（SPEC §4.3/§4.4）。
// wire(t, {draw:p})：轮廓逐段描线；draw 0..1 决定画到第几段。
// 用 LineSegments + drawRange 实现渐进描线；weight 用多份微偏移伪造线宽（WebGL 线宽不可靠）。

import * as THREE from 'three'
import { clamp } from '../core/ease.js'

let DATA = null
export async function loadContour(url = './data/whale_contour.json') {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`whale_contour.json ${res.status}`)
  DATA = await res.json()
  return DATA
}
export const contourData = () => DATA

export function createWireLayer(data, { weight = 1 } = {}) {
  DATA = data || DATA
  const loops = DATA.loops
  // 收集线段 [x0,y0,x1,y1]（归一化图像空间，并用 v 的符号无关）
  const segs = []
  for (const l of loops) {
    const n = l.length / 2
    for (let i = 0; i + 1 < n; i++) {
      segs.push([l[i * 2], l[i * 2 + 1], l[(i + 1) * 2], l[(i + 1) * 2 + 1]])
    }
    // 保证闭合
    const a = n - 1
    if (n > 2 && (l[0] !== l[a * 2] || l[1] !== l[a * 2 + 1])) {
      segs.push([l[a * 2], l[a * 2 + 1], l[0], l[1]])
    }
  }
  const segCount = segs.length
  const copies = weight > 1 ? (weight > 2 ? 9 : 4) : 1
  const offs = [[0, 0]]
  if (copies === 4) offs.push([0.0012, 0], [-0.0012, 0], [0, 0.0012])
  if (copies === 9) {
    for (const dx of [-0.0012, 0, 0.0012]) for (const dy of [-0.0012, 0, 0.0012]) offs.push([dx, dy])
  }
  const totalVerts = segCount * 2 * offs.length

  const pos = new Float32Array(totalVerts * 3)
  // 顶点按「段优先、副本在内」排列，drawRange 截断时每段的所有副本一起出现
  const segIndexAttr = new Float32Array(totalVerts)
  let ptr = 0
  for (let s = 0; s < segCount; s++) {
    for (let oi = 0; oi < offs.length; oi++) {
      for (let k = 0; k < 2; k++) {
        segIndexAttr[ptr] = s
        ptr++
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSeg', new THREE.BufferAttribute(segIndexAttr, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#e8eaee') },
      uHead: { value: 0 },
      uAlpha: { value: 1 },
      uGlow: { value: 0 },
    },
    vertexShader: `
      attribute float aSeg;
      uniform float uHead;
      varying float vHot;
      void main(){
        float d = abs(aSeg - uHead);
        vHot = clamp(1.0 - d / 26.0, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; uniform float uGlow;
      varying float vHot;
      void main(){
        vec3 c = mix(uColor, vec3(0.0,0.9,1.0), vHot);
        float a = uAlpha * (0.72 + 0.28*vHot);
        gl_FragColor = vec4(c + vHot*uGlow*vec3(0.2,0.9,1.0), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const object = new THREE.LineSegments(geo, mat)
  object.frustumCulled = false
  object.renderOrder = 19

  let lastKey = ''

  /**
   * update(t, opts): {frame, rect, draw=1, alpha=1, color, headGlow=0, rotY, offsetX, offsetY, zoom}
   */
  function update(t, opts = {}) {
    const {
      frame,
      rect,
      draw = 1,
      alpha = 1,
      color = '#e8eaee',
      headGlow = 0,
      rotY = 0,
      offsetX = 0,
      offsetY = 0,
      zoom = 1,
    } = opts
    if (!frame || !rect) return
    const pa = geo.attributes.position
    const cy = Math.cos(rotY)
    const sy = Math.sin(rotY)
    ptr = 0
    for (let s = 0; s < segCount; s++) {
      const g = segs[s]
      for (let oi = 0; oi < offs.length; oi++) {
        const [dxu, dyu] = offs[oi]
        for (let k = 0; k < 2; k++) {
          const u = g[k * 2] + dxu
          const v = g[k * 2 + 1] + dyu
          const px = rect.x + u * rect.w
          const py = rect.y + v * rect.h
          const x0 = (px - frame.cx) / frame.S
          const y0 = -(py - frame.cy) / frame.S
          const x1 = x0 * cy
          const z1 = -x0 * sy
          pa.array[ptr * 3] = x1 * zoom + offsetX
          pa.array[ptr * 3 + 1] = y0 * zoom + offsetY
          pa.array[ptr * 3 + 2] = z1 * zoom
          ptr++
        }
      }
    }
    pa.needsUpdate = true
    const shown = Math.round(clamp(draw) * segCount)
    geo.setDrawRange(0, shown * 2 * offs.length)
    mat.uniforms.uHead.value = clamp(draw) * segCount
    mat.uniforms.uAlpha.value = alpha
    mat.uniforms.uGlow.value = headGlow
    mat.uniforms.uColor.value.set(color)
  }

  return {
    object,
    material: mat,
    geometry: geo,
    segCount,
    update,
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
