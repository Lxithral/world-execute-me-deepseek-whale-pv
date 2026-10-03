// src/lib/props/cat.js — 低多边形猫头（FIX.md §2.7）
//
// 组成严格按 FIX：**球体 + 两个圆锥耳 + 胡须线 + 虎斑条纹贴图**。
// 低多边形的做法：球体段数压到 10×7 并开 flatShading，让它明确是"面片"而不是光滑球；
// 条纹用程序生成的 canvas 贴图（横向虎斑），不用任何外部素材。
// 另加最小限度的眼睛与鼻子（同为保证"一眼是猫"），全部是几何体，不是平面贴图。

import * as THREE from 'three'
import { clamp, span, TAU } from '../../core/ease.js'
import { hash01 } from '../../core/rng.js'
import { applyEnv } from './env.js'

/** 程序生成虎斑条纹贴图（球面 UV：u 绕圈、v 从下到上） */
function tabbyTexture({ base = '#c9a06a', stripe = '#5e412a', dark = '#2a1d13' } = {}) {
  const w = 256
  const h = 128
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const g = cv.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  // 背脊一条深色带 + 两侧横向短条纹（虎斑）
  g.fillStyle = dark
  g.fillRect(0, h * 0.06, w, h * 0.16)
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * w + hash01(i, 31) * 6
    const yTop = h * 0.2 + hash01(i, 32) * h * 0.12
    const len = h * (0.16 + hash01(i, 33) * 0.22)
    g.strokeStyle = stripe
    g.lineWidth = 3 + hash01(i, 34) * 4
    g.beginPath()
    g.moveTo(x, yTop)
    g.quadraticCurveTo(x + 8, yTop + len * 0.5, x - 5, yTop + len)
    g.stroke()
    g.beginPath()
    g.moveTo(x, h - yTop)
    g.quadraticCurveTo(x + 8, h - yTop - len * 0.5, x - 5, h - yTop - len)
    g.stroke()
  }
  // 下颚/口鼻提亮
  const grad = g.createLinearGradient(0, h * 0.62, 0, h)
  grad.addColorStop(0, 'rgba(255,246,226,0)')
  grad.addColorStop(1, 'rgba(255,246,226,0.85)')
  g.fillStyle = grad
  g.fillRect(0, h * 0.62, w, h * 0.38)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.repeat.set(2, 1)
  return tex
}

/**
 * 低多边形猫头。
 * @param {{renderer?:THREE.WebGLRenderer, size?:number, stripes?:boolean}} [opts]
 */
export function createCat(opts = {}) {
  const { renderer = null, size = 1.0 } = opts
  const grp = new THREE.Group()
  grp.name = 'prop:cat'

  const tex = tabbyTexture()
  const furMat = new THREE.MeshPhysicalMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
    flatShading: true, // 低多边形：保留面片感
    clearcoat: 0.12,
    emissive: new THREE.Color(0x3a2a1a),
    emissiveIntensity: 0.3,
  })
  applyEnv(furMat, renderer)

  // ---- 头：低段数球体 ----
  const headGeo = new THREE.SphereGeometry(0.5, 10, 7)
  headGeo.scale(1.06, 0.94, 0.98)
  const head = new THREE.Mesh(headGeo, furMat)
  head.name = 'catHead'
  grp.add(head)

  // 口鼻：一个小圆锥，进一步强化"猫"
  const muzzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.17, 0.2, 6, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xf6e6cc, roughness: 0.8, flatShading: true })
  )
  muzzle.rotation.x = Math.PI / 2
  muzzle.position.set(0, -0.1, 0.46)
  grp.add(muzzle)

  // ---- 耳朵：两个圆锥（低多边形 4 段，明确的面片） ----
  const earMat = new THREE.MeshPhysicalMaterial({ color: 0x8a6440, roughness: 0.75, flatShading: true, side: THREE.DoubleSide })
  applyEnv(earMat, renderer)
  const earGeo = new THREE.ConeGeometry(0.17, 0.3, 4, 1)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, earMat)
    ear.position.set(sx * 0.26, 0.42, 0.02)
    ear.rotation.z = -sx * 0.28
    ear.rotation.y = sx * 0.5
    grp.add(ear)
  }

  // ---- 眼睛 / 鼻子（几何体，非贴图） ----
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x14351f, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })
  applyEnv(eyeMat, renderer)
  const eyeGeo = new THREE.SphereGeometry(0.072, 10, 8)
  const eyes = []
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(sx * 0.19, 0.06, 0.43)
    grp.add(eye)
    eyes.push(eye)
    // 瞳孔反光
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    spark.position.set(sx * 0.19 + 0.025, 0.09, 0.47)
    grp.add(spark)
  }
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.07, 4, 1),
    new THREE.MeshPhysicalMaterial({ color: 0xd98d9a, roughness: 0.5, flatShading: true })
  )
  nose.rotation.x = -Math.PI / 2
  nose.position.set(0, -0.045, 0.55)
  grp.add(nose)

  // ---- 胡须：真实线段 ----
  const whiskerMat = new THREE.LineBasicMaterial({ color: 0xf2ead8, transparent: true, opacity: 0.85 })
  const whiskers = new THREE.Group()
  whiskers.name = 'whiskers'
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = -0.02 - i * 0.055
      const pts = [
        new THREE.Vector3(sx * 0.16, y, 0.48),
        new THREE.Vector3(sx * 0.42, y + 0.02 - i * 0.01, 0.44),
        new THREE.Vector3(sx * 0.66, y + 0.01 - i * 0.03, 0.34),
      ]
      const curve = new THREE.CatmullRomCurve3(pts)
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(10))
      whiskers.add(new THREE.Line(geo, whiskerMat))
    }
  }
  grp.add(whiskers)

  grp.scale.setScalar(size)

  return {
    object: grp,
    head,
    ears: grp.children.filter((c) => c.geometry === earGeo),
    eyes,
    whiskers,
    furMaterial: furMat,
    triangleHint: 10 * 7 * 2 + 4 * 2 + 6 * 2, // 头 + 耳 + 口鼻的近似面数（供自检参考）
    /**
     * @param {number} t
     * @param {{alpha?:number, purr?:number, pop?:number, look?:number}} [o]
     *   purr=0..1 时整头以 25Hz 微震（§3 段 F 的 purr 词）
     */
    update(t, o = {}) {
      const { alpha = 1, purr = 0, pop = 1, look = 0 } = o
      grp.rotation.y = look * 0.5 + Math.sin(t * 0.5) * 0.12
      const s = (0.9 + 0.1 * pop) * size
      grp.scale.setScalar(s)
      // 25Hz 微震：由 t 直接算出，仍是纯函数
      const q = purr * 0.02
      grp.position.y = Math.sin(t * TAU * 25) * q
      grp.position.x = Math.cos(t * TAU * 25 + 1.1) * q * 0.6
      grp.rotation.z = purr * 0.03 * Math.sin(t * TAU * 25)
      furMat.opacity = alpha
      furMat.transparent = alpha < 0.999
      whiskerMat.opacity = 0.85 * alpha
      for (const e of eyes) {
        e.scale.setScalar(1 - purr * 0.55) // purr 时眯眼
      }
      return grp
    },
  }
}
