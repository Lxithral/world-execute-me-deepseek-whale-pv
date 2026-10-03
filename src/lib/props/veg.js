// src/lib/props/veg.js — 茄子 / 番茄（FIX.md §2.7）
//
// 要求逐条落实：
//   · THREE.LatheGeometry 车削，轮廓是一条**点列**（不是贴图）；
//   · MeshPhysicalMaterial（光泽 clearcoat + 清漆）+ 环境贴图 + 轮廓光；
//   · 绿色萼片用小锥体拼成星形，顶上再插一小段果柄；
//   · 缓慢自转（纯函数：角度由 t 推出）。

import * as THREE from 'three'
import { clamp, span, TAU } from '../../core/ease.js'
import { hash01 } from '../../core/rng.js'
import { applyEnv } from './env.js'

/** 采样一条平滑轮廓（Catmull-Rom 经过给定的 (r,y) 控制点） */
function sampleProfile(ctrl, n) {
  const pts = ctrl.map(([r, y]) => new THREE.Vector2(r, y))
  const curve = new THREE.SplineCurve(pts)
  const out = []
  for (let i = 0; i < n; i++) out.push(curve.getPoint(i / (n - 1)))
  // 两端收成极点，保证车削体是闭合的（LatheGeometry 不加端盖）
  out[0].x = 0
  out[out.length - 1].x = 0
  return out
}

/**
 * 茄子轮廓：底端圆钝、腹部最宽、向果柄收细，整体略弯。
 * 控制点 (半径, 高度)，高度范围 -1..1。
 */
const EGGPLANT_PROFILE = [
  [0.0, -1.0],
  [0.30, -0.94],
  [0.52, -0.78],
  [0.60, -0.52],
  [0.60, -0.18],
  [0.53, 0.18],
  [0.40, 0.52],
  [0.27, 0.78],
  [0.19, 0.94],
  [0.0, 1.0],
]

/** 番茄轮廓：扁圆，顶部有一处浅凹（番茄的"蒂窝"） */
const TOMATO_PROFILE = [
  [0.0, -1.0],
  [0.34, -0.97],
  [0.64, -0.84],
  [0.83, -0.56],
  [0.90, -0.18],
  [0.86, 0.20],
  [0.72, 0.52],
  [0.49, 0.74],
  [0.26, 0.83],
  [0.20, 0.88],
  [0.0, 0.86],
]

const SPEC = {
  eggplant: {
    profile: EGGPLANT_PROFILE,
    height: 1.5,
    color: 0x3b1f5e, // 深紫
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    roughness: 0.24,
    bend: 0.16,
    calyxColor: 0x4f8f3a,
    spin: 0.42,
  },
  tomato: {
    profile: TOMATO_PROFILE,
    height: 1.16,
    color: 0xc22a24,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    roughness: 0.3,
    bend: 0.0,
    calyxColor: 0x4f8f3a,
    spin: -0.55,
  },
}

/**
 * 车削出一个果实 + 绿色萼片。
 * @param {'eggplant'|'tomato'} kind
 * @param {{renderer?:THREE.WebGLRenderer, segments?:number, profileSamples?:number, detail?:number}} [opts]
 * @returns {{object:THREE.Group, body:THREE.Mesh, material:THREE.MeshPhysicalMaterial, update:Function, profileY:(v:number)=>number}}
 */
export function createVeg(kind = 'eggplant', opts = {}) {
  const sp = SPEC[kind] || SPEC.eggplant
  const { renderer = null, segments = 72, profileSamples = 44, size = 1 } = opts

  const grp = new THREE.Group()
  grp.name = `prop:${kind}`

  // ---- 果身：LatheGeometry ----
  const geo = new THREE.LatheGeometry(sampleProfile(sp.profile, profileSamples), segments)
  // 略弯：让茄身有一点姿态，不呆板（番茄 bend=0 不受影响）
  if (sp.bend) {
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      p.setX(i, x + sp.bend * (1 - y * y) * 0.5)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  }
  geo.scale(0.62, sp.height / 2, 0.62)

  const mat = new THREE.MeshPhysicalMaterial({
    color: sp.color,
    roughness: sp.roughness,
    metalness: 0.0,
    clearcoat: sp.clearcoat,
    clearcoatRoughness: sp.clearcoatRoughness,
    sheen: kind === 'tomato' ? 0.35 : 0.15,
    sheenColor: new THREE.Color(kind === 'tomato' ? 0xffd9c8 : 0x9f7fd8),
    // 片子整体是暗调，给一点本色自发光，避免物件沉进黑里
    emissive: new THREE.Color(sp.color),
    emissiveIntensity: 0.22,
    flatShading: false,
  })
  applyEnv(mat, renderer)

  const body = new THREE.Mesh(geo, mat)
  body.name = 'vegBody'
  grp.add(body)

  // ---- 萼片：5 枚小锥体拼成星形 + 一小段果柄 ----
  const calyxMat = new THREE.MeshPhysicalMaterial({
    color: sp.calyxColor,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
  })
  applyEnv(calyxMat, renderer)
  const calyx = new THREE.Group()
  calyx.name = 'calyx'
  const leafGeo = new THREE.ConeGeometry(0.075 * 0.62, 0.30 * (sp.height / 1.5), 5, 1)
  const topY = (kind === 'tomato' ? 0.83 : 0.94) * (sp.height / 2)
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * TAU + 0.3
    const leaf = new THREE.Mesh(leafGeo, calyxMat)
    leaf.position.set(Math.cos(ang) * 0.11, topY + 0.02, Math.sin(ang) * 0.11)
    // 向外趴下：绕水平轴倾 62°
    leaf.rotation.set(0, 0, 0)
    leaf.rotateOnAxis(new THREE.Vector3(Math.cos(ang + Math.PI / 2), 0, Math.sin(ang + Math.PI / 2)), 1.08)
    calyx.add(leaf)
  }
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028 * 0.62, 0.036 * 0.62, 0.22 * (sp.height / 1.5), 7),
    calyxMat
  )
  stem.position.set(0, topY + 0.1, 0)
  calyx.add(stem)
  grp.add(calyx)

  // 轮廓光：一圈自发光细边（FIX 点名的"轮廓光"），用背面放大壳实现。
  // 透明度给到 0.34：深紫茄子在暗场里几乎与背景同色，靠这道边才读得出轮廓。
  const rimMat = new THREE.MeshBasicMaterial({
    color: kind === 'tomato' ? 0xff9a7a : 0xc79bff,
    transparent: true,
    opacity: 0.34,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const rim = new THREE.Mesh(geo.clone(), rimMat)
  rim.scale.multiplyScalar(1.035)
  rim.name = 'rim'
  grp.add(rim)

  const profileY = (v) => -sp.height / 2 + clamp(v) * sp.height

  return {
    object: grp,
    body,
    calyx,
    rim,
    material: mat,
    calyxMaterial: calyxMat,
    height: sp.height,
    size,
    profileY,
    /**
     * @param {number} t 歌曲时间
     * @param {{alpha?:number, spin?:number, pop?:number, y?:number}} [o]
     *   pop=0..1 用于入场弹入（过冲后归 1）
     */
    update(t, o = {}) {
      const { alpha = 1, spin = sp.spin, pop = 1, y = 0 } = o
      grp.rotation.y = t * spin
      grp.position.y = y
      // 缩放**只由 size 与 pop 决定**（不读取/覆盖调用方设的 scale，避免两处打架）
      const breathe = 0.72 + 0.28 * pop + 0.012 * Math.sin(t * 0.7) * pop
      grp.scale.setScalar(size * breathe * (0.86 + 0.14 * pop))
      mat.opacity = alpha
      mat.transparent = alpha < 0.999
      calyxMat.opacity = alpha
      calyxMat.transparent = alpha < 0.999
      rimMat.opacity = 0.34 * alpha
      const bob = Math.sin(t * 0.55 + (kind === 'tomato' ? 1.7 : 0)) * 0.02 * pop
      grp.position.y = y + bob
      return grp
    },
  }
}

export const createEggplant = (opts) => createVeg('eggplant', opts)
export const createTomato = (opts) => createVeg('tomato', opts)

/** 供自检：轮廓确实来自点列（控制点数 > 3）且半径在两端收成 0 */
export function profileReport(kind = 'eggplant') {
  const sp = SPEC[kind] || SPEC.eggplant
  const pts = sampleProfile(sp.profile, 44)
  const xs = pts.map((p) => p.x)
  return {
    kind,
    controlPoints: sp.profile.length,
    samples: pts.length,
    closed: Math.abs(xs[0]) < 1e-9 && Math.abs(xs[xs.length - 1]) < 1e-9,
    maxRadius: Math.max(...xs),
    height: sp.height,
    clearcoat: sp.clearcoat,
  }
}
