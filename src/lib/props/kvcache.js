// src/lib/props/kvcache.js — KV Cache 体素立方体（FIX.md §2.7 + §3 段 J）
//
// §2.7：「16×16×16 的实例化立方体，分配时逐块点亮、回收时被扫走。」
// §3 J：「KV Cache 体素立方体逐块填满，颜色由蓝→橙→红。」
//
// 4096 个实例 × 12 三角形 = 49152 三角形，是"n) 3D 占比"最稳的一块来源。
// 填充顺序用固定哈希排列（不是逐层扫），看起来才像"分配"而不是"灌水"。

import * as THREE from 'three'
import { clamp, span, smoothstep } from '../../core/ease.js'
import { hash01 } from '../../core/rng.js'
import { applyEnv } from './env.js'

const N = 16
const COUNT = N * N * N

/**
 * @param {{renderer?:THREE.WebGLRenderer, n?:number, cell?:number, gap?:number}} [opts]
 */
export function createKVCache(opts = {}) {
  const { renderer = null, n = N, cell = 0.052, gap = 0.012 } = opts
  const count = n * n * n
  const grp = new THREE.Group()
  grp.name = 'prop:kvcache'

  const geo = new THREE.BoxGeometry(cell, cell, cell)
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    emissive: 0x0a1a2a,
    emissiveIntensity: 0.9,
  })
  applyEnv(mat, renderer)

  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
  mesh.name = 'kvVoxels'
  grp.add(mesh)

  // 固定的分配顺序：按哈希排（稳定、可复现），不是逐层扫
  const order = new Uint16Array(count)
  const rank = new Float32Array(count)
  for (let i = 0; i < count; i++) order[i] = i
  // 用 hash 排序键（不改变数组身份，只是排序）
  const keys = new Float32Array(count)
  for (let i = 0; i < count; i++) keys[i] = hash01(i, 4242)
  const idx = Array.from({ length: count }, (_, i) => i).sort((a, b) => keys[a] - keys[b])
  for (let r = 0; r < count; r++) rank[idx[r]] = r / (count - 1)

  // 每个体素的格子坐标
  const half = (n - 1) / 2
  const posOf = (i) => {
    const x = i % n
    const y = ((i / n) | 0) % n
    const z = (i / (n * n)) | 0
    return [(x - half) * (cell + gap), (y - half) * (cell + gap), (z - half) * (cell + gap)]
  }

  const colBlue = new THREE.Color(0x3f7fff)
  const colOrange = new THREE.Color(0xff9a3c)
  const colRed = new THREE.Color(0xff3b30)
  const tmpCol = new THREE.Color()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const p = new THREE.Vector3()

  /**
   * @param {number} t
   * @param {{fill?:number, reclaim?:number, sweep?:number, alpha?:number, pulse?:number}} [o]
   *   fill    0..1 已分配比例
   *   reclaim 0..1 回收比例（从分配顺序的**尾部**开始被扫走）
   *   sweep   0..1 扫描面位置（用于"被扫走"的可视化）：rank > sweep 的体素被压扁
   */
  function update(t, o = {}) {
    const { fill = 0, reclaim = 0, sweep = 1, alpha = 1, pulse = 0 } = o
    mat.opacity = alpha
    mat.transparent = alpha < 0.999
    const hot = clamp(fill) // 整体负载：越高越红
    for (let i = 0; i < count; i++) {
      const r = rank[i]
      const [x, y, z] = posOf(i)
      // 分配：rank < fill 的亮起；回收：从尾部往上退
      const live = r <= fill - reclaim
      const near = live ? clamp(1 - Math.abs(r - (fill - reclaim)) / 0.35) : 0
      // 被扫走的可视化：超过 sweep 的压扁（沿 z 塌陷）
      const swept = r > sweep ? 1 : 0
      const scale = live ? (1 - swept) * (0.9 + 0.25 * near) + 0.06 : 0.001
      p.set(x, y, z * (1 - swept * 0.94))
      s.set(scale * (1 + pulse * 0.12 * near), scale * (1 + pulse * 0.12 * near), scale)
      q.identity()
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      // 颜色：蓝(空) → 橙(半) → 红(满)；越靠近分配前沿越暖
      const local = clamp(hot * 0.55 + near * 0.65)
      if (local < 0.5) tmpCol.copy(colBlue).lerp(colOrange, local / 0.5)
      else tmpCol.copy(colOrange).lerp(colRed, (local - 0.5) / 0.5)
      if (!live) tmpCol.multiplyScalar(0.18)
      mesh.setColorAt(i, tmpCol)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    return { count, live: Math.round(count * clamp(fill - reclaim)) }
  }

  return {
    object: grp,
    mesh,
    material: mat,
    size: n,
    count,
    update,
    /** 供自检：立方体确实是 n×n×n（按几何实例数） */
    report: () => ({ n, count, triangles: count * 12, geometry: 'BoxGeometry', instanced: true }),
  }
}

/** 从段 J 的 0..1 进度推出"填充 → 满载 → 回收"的完整曲线（纯函数） */
export function kvFillAt(t, { t0 = 129.0, t1 = 145.0, reclaimAt = 145.6, reclaimDur = 1.6 } = {}) {
  const fill = clamp(span(t, t0, t1 * 0.98))
  const reclaim = clamp(span(t, reclaimAt, reclaimAt + reclaimDur))
  return { fill, reclaim, sweep: 1 - reclaim * 0.4 }
}

export { smoothstep }
