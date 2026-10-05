// src/lib/props/monitor.js — 3D 显示器 / CRT 外壳（FIX_V3.md §2.3）
//
// §2.3 原文：「Monitor prop：3D 显示器/CRT 外壳（圆角盒 + 屏面贴 TermPane 纹理 + 微弱泛光），
//             用于段 B 展馆、H、J 背景。」
//
// 它和 TermPane 的分工：
//   · TermPane（`termpane.js`）负责**内容**：2048×1280 canvas（逻辑 1024×640）、逐行排字、窗口
//     尺寸由内容决定（FIX_V5 §G1）、光标。
//   · Monitor（本文件）负责**外壳**：圆角盒机身、屏面把 TermPane 的 mesh 收进来、
//     玻璃反光、边缘泛光、可选底座。
// 于是"一块屏"= createTermPane() + createMonitor({ pane })；画面里想放几块就建几块，
// 但同屏块数与占比由 §2.4 的限额管（`src/core/stage_roles.js`）。
//
// 深度纪律（§2.4）：整机是 pane —— depthWrite 关、depthTest 开、renderOrder < 0，
// 于是它一定会被写深度的主角挡住。外壳自身的机身是**不透明**的（否则半透明机身会把
// 后面的东西透出来、看着像"重影"），只有泛光片是半透明的。
//
// ⚠️ FIX_V5 §G1：TermPane 的窗口尺寸是**内容驱动**的（内容 + 两侧 24px 内边距），会随台词
// 长短变化。因此机身、玻璃、泛光、底座都必须跟着重建 —— 由 `fit()` 完成，并挂在
// `pane.onResize` 上。外壳宽度上限 = 调用点写死的 `width`（构图不变），
// 内容更窄时机身随之收窄（屏面永远填满玻璃，不会出现"小屏浮在大框里"）。

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

  /** 调用点授权的最大机身宽（G1：外壳只许"放大到刚好装下文字"，不许超过构图授权） */
  const capW = width
  /** pane 的初始世界尺寸（TermPane 首帧前是 0.96×0.6）
   *  ⚠️ 必须读 `pane.width` / `pane.height`（取值器，实时值）。TermPane **不暴露**
   *  `worldW`/`worldH` 属性 —— 写 `pane.worldW` 永远是 `undefined`，于是机身被锁在
   *  0.96×0.6 的初值上、从不跟随内容窗口，屏幕上就是「小屏浮在大框里」（G1 违规）。 */
  const initW = pane ? (pane.width || 0.96) : width
  const initH = pane ? (pane.height || width / 1.6) : width / 1.6

  let bodyW = 0
  let bodyH = 0
  let bezelNow = Math.max(0.012, width * 0.022)

  /* ---------- 机身：圆角盒（几何在 fit() 里按内容重建） ---------- */
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: shell === 'crt' ? 0.62 : 0.42,
    metalness: shell === 'crt' ? 0.18 : 0.55,
  })
  const body = new THREE.Mesh(new RoundedBoxGeometry(initW, initH, width * 0.05, 3, initW * 0.06), bodyMat)
  body.name = `${tag}:body`
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
      new THREE.PlaneGeometry(initW, initH),
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
      new THREE.PlaneGeometry(initW, initH),
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
      new THREE.PlaneGeometry(initW * 1.5, initH * 1.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: glow, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending })
    )
    glowMesh.name = `${tag}:glow`
    glowMesh.position.z = -0.002
    glowMesh.renderOrder = -2.5
    grp.add(glowMesh)
  }

  /* ---------- CRT 底座 ---------- */
  let stand = null
  let neck = null
  let foot = null
  if (shell === 'crt') {
    stand = new THREE.Group()
    stand.name = `${tag}:stand`
    neck = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), bodyMat)
    foot = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.02), bodyMat)
    stand.add(neck, foot)
    grp.add(stand)
  }

  /** 换几何：旧的要 dispose，否则每次改台词都漏一份 GPU buffer */
  function swap(mesh, geo, z) {
    if (!mesh) return
    if (mesh.geometry) mesh.geometry.dispose()
    mesh.geometry = geo
    if (z !== undefined) mesh.position.z = z
  }

  /**
   * FIX_V5 §G1：按「内容决定的屏面尺寸」重建外壳。
   * 机身宽 = min(构图授权 capW, 屏面宽) + 两侧 bezel；屏面永远填满玻璃。
   */
  function fit() {
    // ⚠️ `pane.width` / `pane.height` 是取值器（TermPane 没有 worldW/worldH 属性）
    const pw = pane ? Math.max(0.05, pane.width || initW) : initW
    const ph = pane ? Math.max(0.04, pane.height || initH) : initH
    const shellW = Math.min(capW, pw)
    const bz = Math.max(0.012, shellW * 0.022)
    const w = shellW + bz * 2
    const h = ph + bz * 2
    if (Math.abs(w - bodyW) < 1e-4 && Math.abs(h - bodyH) < 1e-4) return
    bodyW = w
    bodyH = h
    bezelNow = bz
    const d = shell === 'crt' ? w * 0.42 : w * 0.05
    swap(body, new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h) * 0.06), -d / 2)
    swap(glareMesh, new THREE.PlaneGeometry(shellW, ph))
    swap(glowMesh, new THREE.PlaneGeometry(w * 1.5, h * 1.6))
    if (!pane) swap(screenMesh, new THREE.PlaneGeometry(shellW, ph))
    if (stand && neck && foot) {
      const rN = shellW * 0.10
      const rN2 = shellW * 0.13
      swap(neck, new THREE.CylinderGeometry(rN, rN2, ph * 0.16, 16))
      neck.position.y = -h / 2 - ph * 0.08
      swap(foot, new RoundedBoxGeometry(shellW * 0.52, ph * 0.05, d * 0.9, 2, Math.max(0.005, ph * 0.02)))
      foot.position.y = -h / 2 - ph * 0.16
      foot.position.z = d * 0.05
    }
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

  // G1：内容改尺寸 → 外壳跟着重建（`onResize` 目前没有别的消费者，见 grep）
  if (pane) pane.onResize = () => fit()
  fit()

  return {
    object: grp,
    body,
    screenMesh,
    stand,
    /** 机身宽（内容驱动，随 fit() 变化） */
    get width() {
      return bodyW || capW
    },
    /** 屏面高（内容驱动） */
    get height() {
      return bodyH || initH
    },
    get bezel() {
      return bezelNow
    },
    shell,
    role,
    /** 屏面 4 角的世界坐标（供覆盖率/遮挡的几何判据） */
    registerWith,
    fit,
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
      const bg = body.geometry
      return {
        shell,
        bodyGeometry: bg.type,
        rounded: (bg.parameters && bg.parameters.radius) > 0,
        bodyRadius: bg.parameters ? bg.parameters.radius : 0,
        segments: bg.parameters ? bg.parameters.segments : 0,
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
        /** G1：屏面（pane 的 mesh）是否正好填满机身内框（同样读取值器，不能读 worldW） */
        screenFillsBody: !!pane && Math.abs((pane.width || 0) - (bodyW - bezelNow * 2)) < 1e-3,
        size: { width: bodyW, height: bodyH, bezel: bezelNow },
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
