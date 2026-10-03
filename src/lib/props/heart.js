// src/lib/props/heart.js — 低多边形心脏（FIX.md §2.7 + §3 段 M）
//
// §2.7 的「另有…低多边形心脏」，§3 M：「低多边形面片拼成心脏并随拍跳动」。
// 要求：ExtrudeGeometry + flatShading，且**可真实自转**（不是假装在转的贴图）。
//
// 低多边形的关键：ExtrudeGeometry 的 curveSegments 压低（贝塞尔被切成少量直线段），
// 再开 flatShading —— 于是每个面片都清晰可见，而不是一个光滑的心形。

import * as THREE from 'three'
import { clamp, span, TAU } from '../../core/ease.js'
import { applyEnv } from './env.js'

/** 经典心形轮廓（贝塞尔），并做居中/缩放 */
function heartShape(scale = 0.045) {
  const s = new THREE.Shape()
  const x = 0
  const y = 0
  s.moveTo(x + 5 * scale, y + 5 * scale)
  s.bezierCurveTo(x + 5 * scale, y + 5 * scale, x + 4 * scale, y, x, y)
  s.bezierCurveTo(x - 6 * scale, y, x - 6 * scale, y + 7 * scale, x - 6 * scale, y + 7 * scale)
  s.bezierCurveTo(x - 6 * scale, y + 11 * scale, x - 3 * scale, y + 15.4 * scale, x + 5 * scale, y + 19 * scale)
  s.bezierCurveTo(x + 12 * scale, y + 15.4 * scale, x + 16 * scale, y + 11 * scale, x + 16 * scale, y + 7 * scale)
  s.bezierCurveTo(x + 16 * scale, y + 7 * scale, x + 16 * scale, y, x + 10 * scale, y)
  s.bezierCurveTo(x + 7 * scale, y, x + 5 * scale, y + 5 * scale, x + 5 * scale, y + 5 * scale)
  return s
}

/**
 * @param {{renderer?:THREE.WebGLRenderer, curveSegments?:number, depth?:number,
 *          lowPoly?:boolean, color?:number, scale?:number}} [opts]
 */
export function createHeart(opts = {}) {
  const {
    renderer = null,
    curveSegments = 5, // 低多边形：贝塞尔只切 5 段
    depth = 0.42,
    lowPoly = true,
    color = 0xd8354a,
    scale = 1.0,
  } = opts
  const grp = new THREE.Group()
  grp.name = 'prop:heart'

  const shape = heartShape(0.045)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.028,
    bevelSegments: 1, // 低多边形：倒角只切 1 段
    curveSegments,
    steps: 1,
  })
  // 居中：把几何挪到原点，这样自转看起来是绕自身中心
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const cx = (bb.min.x + bb.max.x) / 2
  const cy = (bb.min.y + bb.max.y) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  geo.translate(-cx, -cy, -cz)
  geo.computeVertexNormals()

  const mat = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.2,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xff9aa8),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.28,
    flatShading: lowPoly,
  })
  applyEnv(mat, renderer)

  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'heartMesh'
  grp.add(mesh)

  // 背后的一圈背光（随拍跳动）。
  // 必须比心形本身小、且放在**后面**：第一版给 0.62 的球放在心形正中，
  // 结果整屏是一团暗红雾（加色混合叠在心形上），心形本体反而看不清。
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff5f7a,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), glowMat)
  glow.position.z = -(depth / 2 + 0.06)
  grp.add(glow)

  // 面片数量（供自检 / 报告）
  const triCount = geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
  const positionCount = geo.attributes.position.count

  grp.scale.setScalar(scale)
  // 默认朝向：**正面朝观众**（心形的凹口是识别特征，第一版转了 0.22rad 把凹口转走了，
  // 结果看起来是一块圆角砖）。厚度感由 update() 的缓慢自转提供。
  mesh.rotation.z = Math.PI
  mesh.rotation.y = 0
  mesh.rotation.x = 0

  return {
    object: grp,
    mesh,
    material: mat,
    geometry: geo,
    triangles: triCount,
    vertices: positionCount,
    /**
     * @param {number} t
     * @param {{alpha?:number, beat?:number, spin?:number, pop?:number, tilt?:number}} [o]
     *   beat=0..1 每拍一次的心跳（用双跳包络更自然）
     */
    update(t, o = {}) {
      const { alpha = 1, beat = 0, spin = 0.5, pop = 1, tilt = 0 } = o
      // 真实自转：绕自身的 y 轴，角度由 t 推出
      mesh.rotation.y = t * spin
      // 轻微摆动，避免看起来像静止的贴图
      mesh.rotation.x = Math.sin(t * 0.6) * 0.1 + tilt
      mesh.rotation.z = Math.PI + Math.cos(t * 0.42) * 0.05
      // 心跳：两下（lub-dub）
      const b = clamp(beat)
      const lub = Math.exp(-Math.pow((1 - b) * 3.2, 2))
      const dub = 0.6 * Math.exp(-Math.pow((0.62 - b) * 4.6, 2))
      const s = (0.86 + 0.14 * pop) * (1 + (lub + dub) * 0.16)
      grp.scale.setScalar(s * scale)
      mat.opacity = alpha
      mat.transparent = alpha < 0.999
      glowMat.opacity = (0.1 + (lub + dub) * 0.22) * alpha
      glow.scale.setScalar(1 + (lub + dub) * 0.3)
      return { beat: lub + dub }
    },
    /** 供自检 */
    report: () => ({
      geometry: 'ExtrudeGeometry',
      flatShading: !!mat.flatShading,
      curveSegments,
      bevelSegments: 1,
      triangles: triCount,
      vertices: positionCount,
    }),
  }
}

export { span, TAU }
