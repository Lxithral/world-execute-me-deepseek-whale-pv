// src/lib/props/monitor.js — 3D 显示器 / CRT 外壳（FIX_V3.md §2.3）
//
// §2.3 原文：「Monitor prop：3D 显示器/CRT 外壳（圆角盒 + 屏面贴 TermPane 纹理 + 微弱泛光），
//             用于段 B 展馆、H、J 背景。」
//
// 它和 TermPane 的分工：
//   · TermPane（`termpane.js`）负责**内容**：1024×640 canvas、逐行排字、7 行、光标。
//   · Monitor（本文件）负责**外壳**：圆角盒机身、屏面把 TermPane 的 mesh 收进来、
//     玻璃反光、边缘泛光、可选底座。
// 于是"一块屏"= createTermPane() + createMonitor({ pane })；画面里想放几块就建几块，
// 但同屏块数与占比由 §2.4 的限额管（`src/core/stage_roles.js`）。
//
// 深度纪律（§2.4）：整机是 pane —— depthWrite 关、depthTest 开、renderOrder < 0，
// 于是它一定会被写深度的主角挡住。外壳自身的机身是**不透明**的（否则半透明机身会把
// 后面的东西透出来、看着像"重影"），只有泛光片是半透明的。

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** 默认尺寸：宽 1.12 世界单位（1 世界单位 = 半屏高 → 1080p 下约 605px 宽） */
const DEFAULT_W = 1.12

export function createMonitor(opts = {}) {
  const {
    pane = null,
    width = DEFAULT_W,
    /** 'crt' = 厚机身 + 凸屏 + 底座；'flat' = 现代平板 */
    shell = 'flat',
    /** 泛光强度（0 = 关） */
    glow = 0.5,
    /** 玻璃反光（一道斜向高光） */
    glare = true,
    /** 机身配色 */
    bodyColor = 0x151517,
    /** 是否登记进 §2.4 的角色表（false 用于纯装饰） */
    register = true,
    role = 'pane',
    seg = null,
    anchor = null,
    tag = 'monitor',
  } = opts

  const grp = new THREE.Group()
  grp.name = `monitor:${tag}`

  // 屏面比例：优先用 TermPane 的（1024×640 = 1.6），否则 16:10
  const aspect = pane ? pane.width / pane.height : 1.6
  const screenH = width / aspect
  const bezel = Math.max(0.012, width * 0.022)
  const bodyW = width + bezel * 2
  const bodyH = screenH + bezel * 2
  const bodyD = shell === 'crt' ? width * 0.42 : width * 0.05

  /* ---------- 机身：圆角盒 ---------- */
  const radius = Math.min(bodyW, bodyH) * 0.06
  const bodyGeo = new RoundedBoxGeometry(bodyW, bodyH, bodyD, 3, radius)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: shell === 'crt' ? 0.62 : 0.42,
    metalness: shell === 'crt' ? 0.18 : 0.55,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.name = `${tag}:body`
  body.position.z = -bodyD / 2
  // 机身不透明 → 写深度（§2.4 的"主角必须不透明或写深度"是给 hero 的，
  // 但 pane 的机身同样应当参与深度，否则同一块屏的玻璃与屏面会互相穿）
  grp.add(body)

  /* ---------- 屏面：把 TermPane 的 mesh 收进来 ---------- */
  let screenMesh = null
  if (pane) {
    screenMesh = pane.mesh
    screenMesh.position.set(0, 0, 0.0015)
    // pane.mesh 已按 §2.4 设好 depthWrite:false / depthTest:true / renderOrder:-2；
    // 收进机身之后仍保持这套设置（Monitor 不改它，避免两条路径的纪律分叉）
    grp.add(screenMesh)
  } else {
    // 没有 TermPane 时给一块纯色屏（用于"关机/无信号"的显示器）
    screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, screenH),
      new THREE.MeshBasicMaterial({ color: 0x0a0c10, transparent: true, opacity: 0.9, depthWrite: false, depthTest: true })
    )
    screenMesh.name = `${tag}:screen`
    screenMesh.renderOrder = -2
    screenMesh.userData.role = role
    screenMesh.userData.isPane = true
    grp.add(screenMesh)
  }

  /* ---------- 玻璃反光 ---------- */
  let glareMesh = null
  if (glare) {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 160
    const g = cv.getContext('2d')
    const grd = g.createLinearGradient(0, 0, 256, 160)
    grd.addColorStop(0.0, 'rgba(255,255,255,0.00)')
    grd.addColorStop(0.36, 'rgba(255,255,255,0.10)')
    grd.addColorStop(0.46, 'rgba(255,255,255,0.02)')
    grd.addColorStop(1.0, 'rgba(255,255,255,0.00)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 160)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    glareMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, screenH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending })
    )
    glareMesh.name = `${tag}:glare`
    glareMesh.position.z = 0.004
    glareMesh.renderOrder = -1.5
    grp.add(glareMesh)
  }

  /* ---------- 微弱泛光 ---------- */
  let glowMesh = null
  if (glow > 0) {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 256
    const g = cv.getContext('2d')
    const grd = g.createRadialGradient(128, 128, 24, 128, 128, 128)
    grd.addColorStop(0, 'rgba(122,170,255,0.55)')
    grd.addColorStop(0.55, 'rgba(122,170,255,0.16)')
    grd.addColorStop(1, 'rgba(122,170,255,0.0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    glowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bodyW * 1.5, bodyH * 1.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: glow, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending })
    )
    glowMesh.name = `${tag}:glow`
    glowMesh.position.z = -0.002
    glowMesh.renderOrder = -2.5
    grp.add(glowMesh)
  }

  /* ---------- CRT 底座 ---------- */
  let stand = null
  if (shell === 'crt') {
    stand = new THREE.Group()
    stand.name = `${tag}:stand`
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.10, width * 0.13, screenH * 0.16, 16),
      bodyMat
    )
    neck.position.y = -bodyH / 2 - screenH * 0.08
    const foot = new THREE.Mesh(
      new RoundedBoxGeometry(width * 0.52, screenH * 0.05, bodyD * 0.9, 2, screenH * 0.02),
      bodyMat
    )
    foot.position.y = -bodyH / 2 - screenH * 0.16
    foot.position.z = bodyD * 0.05
    stand.add(neck, foot)
    grp.add(stand)
  }

  grp.userData.role = role
  grp.userData.isPane = role === 'pane'

  /* ---------- 登记（§2.4） ---------- */
  let rec = null
  function registerWith(roles) {
    if (!register || !roles) return null
    // ⚠️ 登记的是**屏面**（`screenMesh`）而不是整机 Group。两个原因：
    //   1) §2.4 的限额说的是「单块 pane 的**屏幕**占比」—— 量的就该是显示面，不是机身外框；
    //   2) §2.4 的材质纪律（depthTest 开 / depthWrite 关 / renderOrder<0）只对**屏面**成立。
    //      机身（`RoundedBoxGeometry` 的不透明外壳）本来就该写深度 —— 一台显示器是实体；
    //      "它挡不住主角"这件事由「pane 必须比 hero 更远」那条规则保证，不靠禁止机身写深度。
    // 早先登记整机时，`stage_roles.check()` 会把机身的 MeshStandardMaterial 也按屏面纪律判，
    // 于是 ?demo=panes 每次都报 3×`pane-material` —— 那是**判据用错了对象**，不是画面有问题。
    rec = roles.register(screenMesh, {
      role,
      seg,
      anchor,
      tag,
      // pane 的"名义 alpha"由屏面材质决定；泛光/反光不计入（它们是加法混合的溢出光）
      alpha: (screenMesh.material && screenMesh.material.transparent) ? (screenMesh.material.opacity ?? 1) : 1,
      far: opts.far === true,
    })
    return rec
  }

  return {
    object: grp,
    body,
    screenMesh,
    stand,
    width,
    height: screenH,
    bezel,
    shell,
    role,
    /** 屏面 4 角的世界坐标（供覆盖率/遮挡的几何判据） */
    registerWith,
    get record() {
      return rec
    },
    /** 电源灯闪一下（纯装饰，不改几何） */
    setPower(on) {
      if (glowMesh) glowMesh.material.opacity = on ? glow : 0
      if (screenMesh && screenMesh.material) screenMesh.material.opacity = on ? 1 : 0.18
    },
    /** 供自检：这块屏确实是"圆角盒 + 屏面贴 TermPane 纹理 + 微弱泛光" */
    report() {
      return {
        shell,
        bodyGeometry: bodyGeo.type,
        rounded: (bodyGeo.parameters && bodyGeo.parameters.radius) > 0,
        bodyRadius: bodyGeo.parameters ? bodyGeo.parameters.radius : 0,
        segments: bodyGeo.parameters ? bodyGeo.parameters.segments : 0,
        screenFromTermPane: !!pane,
        screenUsesPaneTexture: !!(pane && screenMesh.material && screenMesh.material.map === pane.texture),
        hasGlow: !!glowMesh,
        glowOpacity: glowMesh ? glowMesh.material.opacity : 0,
        hasGlare: !!glareMesh,
        hasStand: !!stand,
        paneDiscipline: screenMesh
          ? {
            depthTest: screenMesh.material.depthTest !== false,
            depthWrite: screenMesh.material.depthWrite === false,
            renderOrder: screenMesh.renderOrder,
          }
          : null,
        tris: countTris(grp),
      }
    },
    dispose() {
      grp.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of ms) {
            if (m.map && m.map !== (pane && pane.texture)) m.map.dispose()
            m.dispose()
          }
        }
      })
    },
  }
}

function countTris(root) {
  let n = 0
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return
    const g = o.geometry
    if (!g) return
    const per = g.index ? g.index.count / 3 : g.attributes.position ? g.attributes.position.count / 3 : 0
    n += per * (o.isInstancedMesh ? o.count : 1)
  })
  return Math.round(n)
}

export default createMonitor
