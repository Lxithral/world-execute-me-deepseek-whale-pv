// src/lib/three_util.js — 3D/粒子通用件（SPEC §2.3：GPU 粒子用解析公式 + uTime 在着色器里算位置）。
// 所有 update 都是 t 的纯函数；随机一律 hash。

import * as THREE from 'three'
import { hash01 } from '../core/rng.js'
import { clamp, TAU } from '../core/ease.js'

const FIELD_VERT = `
attribute vec3 aData;
attribute vec3 aRand;
uniform float uTime, uMode, uAlpha, uSize, uExtent, uFall, uSpin, uFlatten;
varying float vBright;
void main() {
  vec3 p = aData;
  float bright = 0.55 + 0.45 * aRand.z;
  if (uMode < 0.5) {
    // 0：海雪 / token 下落
    float sp = uFall * (0.5 + aRand.y);
    p.y = mod(aData.y - uTime * sp + uExtent, 2.0 * uExtent) - uExtent;
    p.x = aData.x + sin(uTime * 0.6 + aRand.x * 6.2831) * 0.035;
    bright *= 0.55 + 0.45 * abs(sin(uTime * 1.2 + aRand.x * 12.0));
  } else if (uMode < 1.5) {
    // 1：螺旋星系
    float r = aData.x;
    float th = aData.y + uTime * uSpin + r * 1.6;
    p = vec3(r * cos(th), r * sin(th) * uFlatten, aData.z);
    bright *= 0.7 + 0.5 * (1.0 - r);
  } else {
    // 2：静态星点 + 闪烁
    bright *= 0.45 + 0.55 * abs(sin(uTime * 1.7 + aRand.x * 25.0));
  }
  vBright = bright;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.45 + aRand.z * 1.4);
}
`
const FIELD_FRAG = `
uniform vec3 uColor;
uniform float uAlpha;
varying float vBright;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float m = 1.0 - smoothstep(0.15, 0.5, length(d));
  if (m <= 0.001) discard;
  gl_FragColor = vec4(uColor * vBright, m * uAlpha * vBright);
}
`

/**
 * createField(count, mode, opts)
 * mode: 0 海雪/token 下落 | 1 螺旋星系 | 2 星点
 * 位置全部由着色器用 uTime 解析计算（SPEC §2.3）。
 */
export function createField(count, mode = 0, { seed = 1, color = '#8fd4ff', extent = 1.05, spread = 1.9, flatten = 0.5, fall = 0.05, spin = 0.06, turns = 2.2, size = 3 } = {}) {
  const geo = new THREE.BufferGeometry()
  const data = new Float32Array(count * 3)
  const rand = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    if (mode === 1) {
      const u = Math.sqrt(hash01(i, seed))
      const r = 0.08 + 0.98 * u
      const arm = i % 3
      data[i * 3] = r
      data[i * 3 + 1] = u * TAU * turns + (arm * TAU) / 3 + (hash01(i, seed + 1) - 0.5) * 0.4
      data[i * 3 + 2] = (hash01(i, seed + 2) * 2 - 1) * 0.12 * (1 - u * 0.5)
    } else {
      data[i * 3] = (hash01(i, seed + 3) * 2 - 1) * spread
      data[i * 3 + 1] = (hash01(i, seed + 4) * 2 - 1) * extent
      data[i * 3 + 2] = (hash01(i, seed + 5) * 2 - 1) * 0.6
    }
    rand[i * 3] = hash01(i, seed + 6)
    rand[i * 3 + 1] = hash01(i, seed + 7)
    rand[i * 3 + 2] = hash01(i, seed + 8)
  }
  geo.setAttribute('position', new THREE.BufferAttribute(data.slice(), 3)) // 占位，真实位置在着色器算
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 3))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: mode },
      uAlpha: { value: 1 },
      uSize: { value: size },
      uExtent: { value: extent },
      uFall: { value: fall },
      uSpin: { value: spin },
      uFlatten: { value: flatten },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const object = new THREE.Points(geo, mat)
  object.frustumCulled = false
  object.renderOrder = 8

  return {
    object,
    material: mat,
    update(t, { alpha = 1, size: sz = null, color = null, spin = null } = {}) {
      mat.uniforms.uTime.value = t
      mat.uniforms.uAlpha.value = alpha
      if (sz != null) mat.uniforms.uSize.value = sz
      if (spin != null) mat.uniforms.uSpin.value = spin
      if (color) mat.uniforms.uColor.value.set(color)
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 线框立方体（段 B 的线框世界）
 * ------------------------------------------------------------------ */
export function createWireCube(size = 1.2, color = '#8fd4ff') {
  const g = new THREE.BufferGeometry()
  const v = []
  const s = size
  const pts = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  ]
  const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
  for (const [a, b] of E) v.push(...pts[a], ...pts[b])
  const pos = new Float32Array(v.length)
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4)
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  const object = new THREE.LineSegments(g, m)
  object.frustumCulled = false
  object.renderOrder = 7
  const base = v
  return {
    object,
    update(t, { rotX = 0, rotY = 0, scale = 1, alpha = 1, explode = 0 } = {}) {
      const cx = Math.cos(rotX), sx = Math.sin(rotX)
      const cy = Math.cos(rotY), sy = Math.sin(rotY)
      const pa = g.attributes.position
      for (let i = 0; i < base.length; i += 3) {
        let x = base[i] * scale
        let y = base[i + 1] * scale
        let z = base[i + 2] * scale
        if (explode > 0) {
          const k = (i / 3) | 0
          x += (hash01(k, 71) - 0.5) * explode * 2
          y += (hash01(k, 72) - 0.5) * explode * 2
          z += (hash01(k, 73) - 0.5) * explode * 2
        }
        let y1 = y * cx - z * sx
        let z1 = y * sx + z * cx
        let x1 = x * cy + z1 * sy
        const z2 = -x * sy + z1 * cy
        pa.array[i] = x1
        pa.array[i + 1] = y1
        pa.array[i + 2] = z2
      }
      pa.needsUpdate = true
      m.opacity = clamp(alpha)
    },
    dispose() {
      g.dispose(); m.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 可形变网格平面（段 K 的损失地形引力井）
 * ------------------------------------------------------------------ */
export function createGridPlane(n = 34, size = 2.6, color = '#5f7d9a') {
  const g = new THREE.BufferGeometry()
  const segs = []
  const idx = (i, j) => i * (n + 1) + j
  for (let i = 0; i <= n; i++) for (let j = 0; j < n; j++) segs.push([idx(i, j), idx(i, j + 1)])
  for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) segs.push([idx(i, j), idx(i + 1, j)])
  const count = (n + 1) * (n + 1)
  const pos = new Float32Array(count * 3)
  const lines = new Float32Array(segs.length * 2 * 3)
  g.setAttribute('position', new THREE.BufferAttribute(lines, 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  const object = new THREE.LineSegments(g, m)
  object.frustumCulled = false
  object.renderOrder = 6
  const grid = new Float32Array(count * 3)
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const k = idx(i, j)
      grid[k * 3] = (-0.5 + i / n) * size * 1.7
      grid[k * 3 + 1] = (-0.5 + j / n) * size * 0.95
      grid[k * 3 + 2] = 0
    }
  }
  return {
    object,
    update(t, { alpha = 1, wells = [], perspective = 0.42, tScale = 1 } = {}) {
      const pa = g.attributes.position
      const zs = new Float32Array(count)
      for (let k = 0; k < count; k++) {
        const x = grid[k * 3]
        const y = grid[k * 3 + 1]
        let z = -0.55
        for (const w of wells) {
          const dx = x - w.x
          const dy = y - w.y
          const r2 = dx * dx + dy * dy
          z -= w.depth * Math.exp(-r2 / Math.max(0.02, w.sigma * w.sigma))
        }
        z += Math.sin(x * 3 + t * tScale) * 0.02 + Math.cos(y * 4 - t * tScale * 0.7) * 0.02
        zs[k] = z
      }
      // 透视：越靠"近"（z 大）越大
      let p = 0
      for (const [a, b] of segs) {
        for (const k of [a, b]) {
          const x = grid[k * 3]
          const y = grid[k * 3 + 1]
          const z = zs[k]
          const s = 1 + z * perspective
          pa.array[p++] = x * s
          pa.array[p++] = y * s * 0.62
          pa.array[p++] = z
        }
      }
      pa.needsUpdate = true
      m.opacity = clamp(alpha)
    },
    dispose() {
      g.dispose(); m.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * 4D 超立方体投影（段 E）
 * ------------------------------------------------------------------ */
export function createHypercube(size = 0.72, color = '#c792ea') {
  const verts4 = []
  for (let i = 0; i < 16; i++) {
    verts4.push([(i & 1 ? size : -size), (i & 2 ? size : -size), (i & 4 ? size : -size), (i & 8 ? size : -size)])
  }
  const edges = []
  for (let i = 0; i < 16; i++) {
    for (let b = 0; b < 4; b++) {
      const j = i ^ (1 << b)
      if (j > i) edges.push([i, j])
    }
  }
  const g = new THREE.BufferGeometry()
  const pos = new Float32Array(edges.length * 2 * 3)
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6)
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
  const object = new THREE.LineSegments(g, m)
  object.frustumCulled = false
  object.renderOrder = 7

  function rot(v, i, j, a) {
    const c = Math.cos(a), s = Math.sin(a)
    const vi = v[i], vj = v[j]
    v[i] = vi * c - vj * s
    v[j] = vi * s + vj * c
  }
  return {
    object,
    update(t, { alpha = 1, spin = 0.3, scale = 1, color: col = null } = {}) {
      const pa = g.attributes.position
      let p = 0
      const pw = 1.6 // 4D → 3D 投影距离
      for (const [a, b] of edges) {
        for (const k of [a, b]) {
          const v = verts4[k].slice()
          rot(v, 0, 3, t * spin * 0.7)
          rot(v, 1, 2, t * spin * 0.5)
          rot(v, 0, 1, t * spin * 0.31)
          // 透视投影 4D→3D
          const w = pw / (pw + v[3])
          pa.array[p++] = v[0] * w * scale
          pa.array[p++] = v[1] * w * scale
          pa.array[p++] = v[2] * w * scale
        }
      }
      pa.needsUpdate = true
      m.opacity = clamp(alpha)
      if (col) m.color.set(col)
    },
    dispose() {
      g.dispose(); m.dispose()
    },
  }
}

/** 清空并释放一个 group 里的所有自建图层 */
export function disposeGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child)
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
      else child.material.dispose()
    }
  }
}
