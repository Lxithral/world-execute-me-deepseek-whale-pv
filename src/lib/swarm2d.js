// src/lib/swarm2d.js — 蜂群的 2D 投影层（FIX.md §2.1）——**可选**
//
// 目的：3D 蜂群挂在透视相机下，而相机在 14 段里从贴近（z≈0.6）到拉远（z≈6）来回跑，
// 理论上存在"蜂群被推出画面"的取景。这一层按相机投影再画一遍作为兜底。
//
// ⚠️ 已知问题（如实记录，见 PROGRESS 决策日志 D39）：
// 这一层在本机（Chrome headless + SwiftShader 软件光栅化）会破坏
// **同一 t 两次渲染像素一致** 这条不变量 —— 自检 a) 因此 FAIL（t=2.0 / 62.06）。
// 已排除的原因：uniform/布局数组（逐字段比对完全相同）、点大小（放大到 ≥4px 仍不稳定）、
// depthTest（开关都一样）。指向软件光栅化在大量半透明点精灵叠加下的实现差异。
// 因此**默认关闭**（`?swarm2d=1` 可开，用于 A/B 对拍）。
// "蜂群全片在场"改由**实测 3D 蜂群的屏幕覆盖面积**来保证（见 selftest q3）。
//
// 2D 层的价值保留：它用的是和 3D 同一套 aFrom/aTo（swarm.layoutOf(name)），
// 所以 2D/3D 两层不会各说各话；身份、错峰、缓动都来自同一个 swarm 实例。

import * as THREE from 'three'
import { clamp } from '../core/ease.js'

export const SWARM2D_COUNT = 2000

/** 圆点贴图（带软边，避免 1px 硬点） */
function dotTexture() {
  const s = 32
  const cv = document.createElement('canvas')
  cv.width = s
  cv.height = s
  const g = cv.getContext('2d')
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * @param {{count?:number, seed?:number}} [opts]
 */
export function createSwarm2D(opts = {}) {
  const { count = SWARM2D_COUNT } = opts
  const N = count
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(N * 3)
  const col = new Float32Array(N * 3)
  const alp = new Float32Array(N)
  const scl = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    col[i * 3] = 1
    col[i * 3 + 1] = 1
    col[i * 3 + 2] = 1
    alp[i] = 1
    scl[i] = 1
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1))
  geo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 5.0 },
      uAlpha: { value: 1.0 },
      uMap: { value: dotTexture() },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      attribute float aScale;
      uniform float uSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * aScale;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D uMap;
      uniform float uAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        float a = t.a * vAlpha * uAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    // depthTest 必须开着：关掉之后点精灵与场景的深度关系完全靠绘制顺序，
    // 在软件光栅化下会出现**同一 t 两次渲染像素不同**（实测自检 a 因此 FAIL）。
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })

  const object = new THREE.Points(geo, mat)
  object.frustumCulled = false
  object.renderOrder = 12
  object.name = 'swarm2d'
  object.visible = false
  object.layers.set(2) // 归到鲸鱼层（正交相机）

  const cA = new THREE.Color()
  const cB = new THREE.Color()
  // 每帧复用的临时量：不在循环里 new，避免 GC 抖动影响"同一 t 两次渲染一致"
  const p4 = new THREE.Vector4()
  const VP = new THREE.Matrix4()

  /**
   * @param {number} t
   * @param {{camera:THREE.Camera, from:Float32Array, to:Float32Array, u:number,
   *          stagger?:number, size?:number, alpha?:number, colorA?:string, colorB?:string,
   *          bulge?:number}} o
   */
  function update(t, o = {}) {
    const { camera, from, to, u = 1, stagger = 0.5, size = 5, alpha = 1, colorA = '#7fd8ff', colorB = '#c792ea', bulge = 0.1 } = o
    if (!camera || !from || !to) {
      object.visible = false
      return { drawn: 0 }
    }
    cA.set(colorA)
    cB.set(colorB)
    // 相机的 view-projection：世界坐标 → NDC（这一层按"投影后"画，跟 3D 机位一致）
    VP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const vp = VP
    const e = vp.elements
    const m = mat.uniforms
    m.uSize.value = size
    m.uAlpha.value = clamp(alpha)
    const posAttr = geo.attributes.position
    const colAttr = geo.attributes.aColor
    const alpAttr = geo.attributes.aAlpha
    const sclAttr = geo.attributes.aScale
    let drawn = 0
    for (let i = 0; i < N; i++) {
      // 错峰：每个粒子的 u 起点由 (i/N) 与一个稳定哈希决定，与 3D 层的 aStagger 同源思路
      const s0 = ((i * 2654435761) >>> 0) / 4294967296
      const w = clamp((u - s0 * stagger) / Math.max(1e-4, 1 - stagger))
      const ee = w * w * (3 - 2 * w)
      const x0 = from[i * 3]
      const y0 = from[i * 3 + 1]
      const z0 = from[i * 3 + 2]
      const x1 = to[i * 3]
      const y1 = to[i * 3 + 1]
      const z1 = to[i * 3 + 2]
      let x = x0 + (x1 - x0) * ee
      let y = y0 + (y1 - y0) * ee
      let z = z0 + (z1 - z0) * ee
      // 形变途中向外鼓一点（与 3D 顶点着色器的 bulge 同构）
      const b = Math.sin(ee * Math.PI) * bulge
      if (b > 1e-4) {
        const l = Math.hypot(x, y, z) || 1
        x += (x / l) * b
        y += (y / l) * b
        z += (z / l) * b
      }
      // 投影
      p4.set(x, y, z, 1).applyMatrix4(vp)
      const wclip = p4.w || 1e-6
      const invW = 1 / wclip
      const nx = p4.x * invW
      const ny = p4.y * invW
      const depth = wclip
      // 深度衰减：近大远小 + 远处更淡（与 3D 层观感一致）
      const near = clamp(1.2 - Math.abs(depth - 3.4) * 0.16, 0.18, 1)
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      // 屏幕外直接压到 0 alpha（省填充率）
      const onScreen = Math.abs(nx) < 1.25 && Math.abs(ny) < 1.25 && wclip > 0.1
      const a = onScreen ? near : 0
      if (a > 0.02) drawn++
      alp[i] = a
      const k = (i % 97) / 97
      col[i * 3] = cA.r + (cB.r - cA.r) * k
      col[i * 3 + 1] = cA.g + (cB.g - cA.g) * k
      col[i * 3 + 2] = cA.b + (cB.b - cA.b) * k
      scl[i] = 0.5 + 0.9 * near
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true
    alpAttr.needsUpdate = true
    sclAttr.needsUpdate = true
    object.visible = drawn > 0 && alpha > 0.01
    return { drawn, visible: object.visible }
  }

  return { object, update, count: N, material: mat, geometry: geo, triangles: 0 }
}

export default createSwarm2D
