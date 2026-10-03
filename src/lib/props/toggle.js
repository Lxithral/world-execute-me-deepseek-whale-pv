// src/lib/props/toggle.js — 3D 开关（FIX.md §2.7）
//
// "3D 圆角胶囊轨道 + 圆形滑块，发光，翻转带过冲弹性"。
// 翻转的时刻表由调用方给出（§3 段 G：每个 switch 词一次），
// 滑块位置与过冲**完全由 t 推出**，所以停帧、拖动、乱序跳转后状态一致。

import * as THREE from 'three'
import { clamp, span, outElastic, TAU } from '../../core/ease.js'
import { applyEnv } from './env.js'

/**
 * @param {{renderer?:THREE.WebGLRenderer, length?:number, radius?:number, flips?:number[], dur?:number, startOn?:boolean}} [opts]
 *   flips: 翻转时刻（秒）升序数组；每次到达就翻一次（奇偶决定开关）
 */
export function createToggle(opts = {}) {
  const { renderer = null, length = 1.5, radius = 0.34, flips = [], dur = 0.55, startOn = false } = opts
  const grp = new THREE.Group()
  grp.name = 'prop:toggle'

  // 轨道：胶囊横躺（沿 x）。
  // 注意：CapsuleGeometry 的轴是 +y，必须**整体绕 z 转 90°** 才能横躺；
  // 只转轨道本身、让滑块留在世界轴上的写法会让滑块陷进轨道里（第一版实测就是这个 bug）。
  const trackMat = new THREE.MeshPhysicalMaterial({
    color: 0x39506b,
    roughness: 0.32,
    metalness: 0.45,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    emissive: 0x14384f,
    emissiveIntensity: 1.5,
  })
  applyEnv(trackMat, renderer)
  const body = new THREE.Group() // 轨道 + 内芯：一起横躺
  body.rotation.z = Math.PI / 2
  grp.add(body)

  const track = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, 24), trackMat)
  body.add(track)

  // 轨道内发光芯（随开/关变色）
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x2b6f8f, transparent: true, opacity: 0.95 })
  const core = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.62, Math.max(0.01, length - radius * 2.2), 4, 18), coreMat)
  core.position.z = radius * 0.55
  body.add(core)

  // 滑块：圆盘（骑在轨道**上方**，不被埋住；面朝观众）。
  // 半径 0.82×轨道半径：滑块比轨道细一圈，才看得出它是"在轨道上滑动"；
  // 第一版做成 1.12× 直接盖住整条轨道，读不出拨钮。
  // 用无光照材质 + 明确的白色：物理材质在这里会吃掉环境贴图的高光，
  // 实测滑块读成一块"半透明淡紫圆片"。
  const knobMat = new THREE.MeshBasicMaterial({ color: 0xf4f7fc })
  const knobR = radius * 0.82
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(knobR, knobR, radius * 0.4, 32), knobMat)
  knob.rotation.x = Math.PI / 2
  knob.position.z = radius * 0.78
  grp.add(knob)
  // 滑块的边（让圆盘外圈有一道暗线，读得出"这是个圆"）
  const knobRimMat = new THREE.MeshBasicMaterial({ color: 0x8fa2bd })
  const knobRim = new THREE.Mesh(new THREE.TorusGeometry(knobR, radius * 0.06, 6, 28), knobRimMat)
  knobRim.position.y = radius * 0.2
  knob.add(knobRim)

  // 滑块光晕：一层薄薄的前向光斑，半径只略大于滑块（第一版 1.55 倍半径、
  // 又挂在会自转的滑块上，看起来像贴了一张不透明的粉色圆片）
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x7fe6ff,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const halo = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.18, 28), haloMat)
  halo.position.z = radius * 0.3
  knob.add(halo)

  // 两端的标签位（A⇄B 人设开关；文字由调用方用 canvas 贴图挂上去，这里只留锚点）
  const anchorA = new THREE.Object3D()
  anchorA.position.set(-length / 2 - 0.42, 0, 0)
  const anchorB = new THREE.Object3D()
  anchorB.position.set(length / 2 + 0.42, 0, 0)
  grp.add(anchorA, anchorB)

  const xOff = length / 2 - radius * 1.1
  // 滑块自身的 z 偏移（相对 grp）：翻转时只改 x / 绕 z 转，z 不变
  const knobZ = radius * 0.78
  grp.userData.flips = flips.slice()

  /**
   * @param {number} t
   * @param {{alpha?:number, forceOn?:boolean, forceU?:number}} [o]
   * @returns {{on:boolean, u:number, x:number}}
   */
  function update(t, o = {}) {
    const { alpha = 1, forceOn = null, forceU = null } = o
    const list = grp.userData.flips
    let idx = -1
    for (let i = 0; i < list.length; i++) if (t >= list[i]) idx = i
    let on = startOn
    let u = 1
    if (idx >= 0) {
      on = idx % 2 === 0 ? !startOn : startOn
      u = clamp(span(t, list[idx], list[idx] + dur))
    } else {
      u = 1
    }
    if (forceOn != null) on = !!forceOn
    if (forceU != null) u = clamp(forceU)
    // 过冲弹性：滑块冲过目标再弹回
    const e = list.length && idx >= 0 ? outElastic(u) : u
    const from = on ? -xOff : xOff
    const to = on ? xOff : -xOff
    const x = from + (to - from) * e
    knob.position.set(x, 0, knobZ)
    knob.rotation.z = Math.PI * 0.5 * (on ? 1 : 0) * e
    knobMat.opacity = alpha
    knobMat.transparent = alpha < 0.999
    trackMat.opacity = alpha
    trackMat.transparent = alpha < 0.999
    // 开=青，关=暗蓝
    coreMat.color.setHex(on ? 0x36d8a0 : 0x2b6f8f)
    coreMat.opacity = (0.55 + 0.35 * u) * alpha
    haloMat.color.setHex(on ? 0x74ffd8 : 0x7fe6ff)
    haloMat.opacity = (on ? 0.42 : 0.22) * alpha
    halo.scale.setScalar(1 + 0.08 * Math.sin(t * 3.1))
    return { on, u, x }
  }

  return {
    object: grp,
    body,
    track,
    knob,
    halo,
    core,
    anchors: { a: anchorA, b: anchorB },
    materials: { trackMat, knobMat, coreMat, haloMat },
    /** 供自检：滑块是否真的凸出于轨道之外（不要埋在轨道里） */
    knobOut: knob.position.z - radius,
    update,
    length,
    radius,
  }
}

/** 从一组 switch 词的锚点时间建开关（§3 段 G：一词一次，不提前不滞后） */
export function createSwitchToggle(times, opts = {}) {
  return createToggle({ ...opts, flips: times.slice() })
}

export { TAU }
