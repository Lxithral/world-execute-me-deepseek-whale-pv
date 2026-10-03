// src/lib/props/env.js — 3D 物件库的共享环境（FIX.md §2.7 的"环境光 + 轮廓光"）
//
// 为什么需要它：MeshPhysicalMaterial 的"光泽/清漆"是靠**环境反射**才看得出来的。
// 没有 envMap 时，clearcoat 几乎不可见，物件会像塑料片。
// 这里用一张程序生成的等距柱状渐变（天空→地平线→地面 + 一个亮斑当太阳）过 PMREM，
// 得到一张粗糙度响应正确的小环境贴图，成本一次性、可缓存。
//
// 同时提供 `createLightRig()`：环境光 + 主光（key）+ 轮廓光（rim）。
// 轮廓光是 FIX 明确点名的：物件边缘要有一道亮边，才从暗背景里"浮"出来。

import * as THREE from 'three'

let _env = null // 缓存：{ texture, key }，key 用 renderer 的 uuid，避免跨 renderer 复用
let _pmrem = null

/**
 * 程序生成的等距柱状环境贴图（PMREM 之后）。
 * @param {THREE.WebGLRenderer} renderer
 * @param {{top?:string, horizon?:string, bottom?:string, sun?:string}} [colors]
 * @returns {THREE.Texture|null} 失败时返回 null（例如无头环境），调用方需容忍
 */
export function getEnv(renderer, colors = {}) {
  const { top = '#0b1220', horizon = '#2b3f57', bottom = '#05070b', sun = '#fff3d6' } = colors
  const key = `${top}|${horizon}|${bottom}|${sun}`
  if (_env && _env.key === key && _env.texture) return _env.texture
  if (!renderer) return null
  try {
    const w = 512
    const h = 256
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, top)
    grad.addColorStop(0.48, horizon)
    grad.addColorStop(0.52, horizon)
    grad.addColorStop(1, bottom)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
    // 一个柔和亮斑当太阳/天光，给清漆层一个明确的高光源
    const sunGrad = g.createRadialGradient(w * 0.34, h * 0.3, 4, w * 0.34, h * 0.3, h * 0.42)
    sunGrad.addColorStop(0, sun)
    sunGrad.addColorStop(0.35, 'rgba(255,240,210,0.35)')
    sunGrad.addColorStop(1, 'rgba(255,240,210,0)')
    g.fillStyle = sunGrad
    g.fillRect(0, 0, w, h)
    // 一条冷色补光，避免暗面死黑
    const fillGrad = g.createRadialGradient(w * 0.82, h * 0.62, 4, w * 0.82, h * 0.62, h * 0.5)
    fillGrad.addColorStop(0, 'rgba(120,190,255,0.30)')
    fillGrad.addColorStop(1, 'rgba(120,190,255,0)')
    g.fillStyle = fillGrad
    g.fillRect(0, 0, w, h)

    const tex = new THREE.CanvasTexture(cv)
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    _pmrem = _pmrem || new THREE.PMREMGenerator(renderer)
    const rt = _pmrem.fromEquirectangular(tex)
    tex.dispose()
    _env = { key, texture: rt.texture }
    return _env.texture
  } catch (e) {
    console.warn('[props/env] 环境贴图生成失败，回退到纯灯光：', e && e.message)
    return null
  }
}

/**
 * 灯光组：环境光 + 主光 + 轮廓光 + 冷色补光。
 * @param {{keyColor?:string, rimColor?:string, keyIntensity?:number}} [opts]
 * @returns {THREE.Group}
 */
export function createLightRig({ keyColor = '#ffffff', rimColor = '#8fd4ff', keyIntensity = 2.1, ambient = 1.05 } = {}) {
  const grp = new THREE.Group()
  grp.name = 'propsLightRig'

  const amb = new THREE.AmbientLight(0xffffff, ambient)
  grp.add(amb)

  const key = new THREE.DirectionalLight(keyColor, keyIntensity)
  key.position.set(2.4, 3.0, 3.2)
  grp.add(key)

  // 轮廓光：从相机侧后方打，勾出边缘亮线
  const rim = new THREE.DirectionalLight(rimColor, 2.2)
  rim.position.set(-2.8, 1.6, -2.2)
  grp.add(rim)

  const fill = new THREE.PointLight(0x6fa8ff, 9, 14, 2)
  fill.position.set(-1.6, -1.2, 2.4)
  grp.add(fill)

  return grp
}

/**
 * 给一批材质套上环境贴图（建场景时调用一次）。
 * @param {THREE.Material|THREE.Material[]} mats
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyEnv(mats, renderer) {
  const env = getEnv(renderer)
  if (!env) return null
  const list = Array.isArray(mats) ? mats : [mats]
  for (const m of list) {
    if (!m) continue
    m.envMap = env
    if ('envMapIntensity' in m) m.envMapIntensity = 1.45
    m.needsUpdate = true
  }
  return env
}

/** 测试用：清掉缓存（例如 renderer 被重建） */
export function resetEnv() {
  if (_env && _env.texture) _env.texture.dispose()
  _env = null
  if (_pmrem) {
    _pmrem.dispose()
    _pmrem = null
  }
}
