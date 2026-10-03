// src/ui/props_page.js — `?props` 模型审批页（FIX_V4 §2.2）
//
// §2.2 原文要求：
//   「列出茄子、番茄、猫(以及之后任何 PBR 实体模型),每个都有 **360° 转台**、
//     **线框开关**与**标准灯光**。AI 做完后停下,由用户在 `docs/PROPS_APPROVAL.md`
//     里手写 ✅ 才算通过;**AI 不得自己打勾**。未获 ✅ 的模型不得出现在影片里,先放占位。」
//
// 所以这一页的设计目标只有一个：**让用户能可靠地判断"这个模型够不够好看"**。
//   · 转台：自动慢转 + 可拖动（鼠标左右拖 = 手动转角），保证能看全 360°；
//   · 线框开关：一键切 wireframe，方便看拓扑是否干净（§0.1 的"默认几何体"很好辨认）；
//   · 标准灯光：RoomEnvironment 经 PMREM 作环境光 + 顶光/侧轮廓光/底部补光三点，
//     与 §1.7 的展示要求一致；背景是径向暗渐变 + 圆形反光台座（含翻转副本当倒影）；
//   · 屏幕上**明确写出"未获 ✅ 前不得入片"**，并给出 `docs/PROPS_APPROVAL.md` 的路径，
//     避免把"看起来还行"误当成"已通过"。
//
// 这一页**不参与影片渲染**：它是独立画布 + 独立 renderer，`?props` 路由在 boot() 里
// 提前 return，影片的 rAF 循环不会启动。

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createProp } from '../lib/props/index.js'

/** 本页要审的模型（顺序 = 用户核对顺序）。`label` 只用于**页面 UI**，绝不进影片（§0.2）。 */
const MODELS = [
  { key: 'eggplant', label: '茄子' },
  { key: 'tomato', label: '番茄' },
  { key: 'cat', label: '猫' },
]

export function buildPropsPage() {
  /* ---------------- 画布 / 渲染器 / 环境 ---------------- */
  const cv = document.createElement('canvas')
  cv.id = 'props-stage'
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block'
  document.body.appendChild(cv)

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  // §6 的曝光链路一致：ACESFilmic；本页固定 1.0，不做段落关键帧
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace

  // §1.7 明确要求「RoomEnvironment 经 PMREM 作环境光」
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  const scene = new THREE.Scene()
  scene.environment = envRT.texture

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 100)
  camera.position.set(0, 0.30, 2.55)
  camera.lookAt(0, 0.02, 0)

  /* ---------------- 背景：径向暗渐变（§1.7「背景径向暗渐变」） ---------------- */
  {
    const g = new THREE.SphereGeometry(30, 24, 16)
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTop: { value: new THREE.Color(0x171b23) }, uBot: { value: new THREE.Color(0x05060a) } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uBot; varying vec3 vD;
        void main(){ float h = clamp(vD.y*0.5+0.5, 0.0, 1.0);
          float r = length(vD.xz);
          vec3 c = mix(uBot, uTop, pow(h, 0.7));
          c *= 1.0 - 0.55*smoothstep(0.25, 0.95, r);   // 越靠边越暗 → 径向暗渐变
          gl_FragColor = vec4(c, 1.0); }`,
    })
    scene.add(new THREE.Mesh(g, m))
  }

  /* ---------------- 三点光（§1.7：顶光 + 侧轮廓光 + 底部补光） ---------------- */
  const key = new THREE.DirectionalLight(0xffffff, 2.1)
  key.position.set(1.6, 2.6, 2.2)
  const rim = new THREE.DirectionalLight(0x9fd8ff, 1.5)
  rim.position.set(-2.4, 1.1, -1.8)
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.75)
  fill.position.set(0.2, -2.2, 1.4)
  scene.add(key, rim, fill, new THREE.AmbientLight(0x223046, 0.5))

  /* ---------------- 圆形反光台座 + 翻转副本当倒影（§1.7） ---------------- */
  const pedestal = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 96),
    new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 0.22, metalness: 0.65 })
  )
  pedestal.rotation.x = -Math.PI / 2
  pedestal.position.y = -0.62
  scene.add(pedestal)

  const pivot = new THREE.Group() // 转台：模型挂在这里
  scene.add(pivot)
  const mirror = new THREE.Group() // 倒影：翻转副本
  scene.add(mirror)

  /* ---------------- 三个模型（一次只显示一个） ---------------- */
  const built = MODELS.map((spec) => {
    const p = createProp(spec.key, { renderer, detail: 'high' })
    // 统一缩放到"占画面约 60% 高"的取景尺度，三个模型才可比
    const box = new THREE.Box3().setFromObject(p.object)
    const size = new THREE.Vector3()
    box.getSize(size)
    const s = 1.15 / Math.max(1e-3, size.y)
    p.object.scale.setScalar(s)
    p.object.position.y = -0.62 + (size.y * s) / 2
    pivot.add(p.object)

    // 倒影：把同一个 object 的**克隆**翻转 180°、压到台座下方、半透明
    const refl = p.object.clone(true)
    refl.scale.multiplyScalar(1)
    refl.position.y = -0.62 - (size.y * s) / 2
    refl.rotation.z = Math.PI
    refl.traverse((o) => {
      if (!o.material) return
      const ms = Array.isArray(o.material) ? o.material : [o.material]
      o.material = ms.map((m) => {
        const c = m.clone()
        c.transparent = true
        c.opacity = Math.min(0.18, (m.opacity ?? 1) * 0.2)
        c.depthWrite = false
        return c
      })
      if (o.material.length === 1) o.material = o.material[0]
    })
    mirror.add(refl)

    return { spec, prop: p, object: p.object, reflection: refl }
  })

  /* ---------------- 状态与页面 UI ---------------- */
  const state = {
    idx: 0,
    spin: true,
    wireframe: false,
    angle: 0,
    dragging: false,
    lastX: 0,
  }

  const ui = document.createElement('div')
  ui.id = 'props-ui'
  ui.style.cssText = [
    'position:fixed;left:14px;top:14px;z-index:10;padding:12px 14px;border-radius:10px',
    'background:rgba(10,12,16,0.86);border:1px solid #2c2f38;color:#e8eaee',
    'font:500 13px/1.5 "JetBrains Mono",monospace;max-width:min(420px,42vw)',
  ].join(';')
  document.body.appendChild(ui)

  const render = () => {
    const cur = built[state.idx]
    ui.innerHTML = `
      <div style="font:700 14px/1.5 'JetBrains Mono',monospace;color:#7aaaff">?props — 模型审批页（FIX_V4 §2.2）</div>
      <div style="margin:8px 0 6px">当前：<b style="color:#fff">${cur.spec.label}</b>
        <span style="color:#8b90a0">（${state.idx + 1}/${MODELS.length}）</span></div>
      <div style="color:#b8bcc4">1 / 2 / 3 = 切模型　·　W = 线框　·　空格 = 自动旋转</div>
      <div style="color:#b8bcc4">鼠标左右拖动 = 手动转角（看全 360°）</div>
      <div style="margin-top:8px;color:#ffd479">状态：<b>未获 ✅</b> —— 在
        <code style="color:#fff">docs/PROPS_APPROVAL.md</code> 里手写 ✅ 之前，
        该模型<b>不得进入影片</b>（段 F 目前只放占位）。</div>
      <div style="margin-top:6px;color:#8b90a0">线框：${state.wireframe ? '开' : '关'}　·　
        自动旋转：${state.spin ? '开' : '关'}　·　转角 ${(state.angle * 180 / Math.PI).toFixed(0)}°</div>
    `
  }

  const refreshVisibility = () => {
    built.forEach((b, i) => {
      const on = i === state.idx
      b.object.visible = on
      b.reflection.visible = on
    })
  }

  const applyWireframe = () => {
    for (const b of built) {
      b.object.traverse((o) => {
        if (!o.material) return
        const ms = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of ms) if ('wireframe' in m) m.wireframe = state.wireframe
      })
    }
  }

  const select = (i) => {
    state.idx = ((i % MODELS.length) + MODELS.length) % MODELS.length
    state.entry = 0 // 入场弹簧重新播一次
    refreshVisibility()
    applyWireframe()
    render()
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === '1') select(0)
    else if (e.key === '2') select(1)
    else if (e.key === '3') select(2)
    else if (e.key === 'w' || e.key === 'W') {
      state.wireframe = !state.wireframe
      applyWireframe()
      render()
    } else if (e.code === 'Space') {
      e.preventDefault()
      state.spin = !state.spin
      render()
    }
  })
  cv.addEventListener('pointerdown', (e) => {
    state.dragging = true
    state.lastX = e.clientX
    cv.setPointerCapture?.(e.pointerId)
  })
  cv.addEventListener('pointermove', (e) => {
    if (!state.dragging) return
    state.angle += (e.clientX - state.lastX) * 0.01
    state.lastX = e.clientX
  })
  cv.addEventListener('pointerup', () => {
    state.dragging = false
  })
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight, false)
  })

  select(0)

  /* ---------------- 循环：慢转 + 轻微上下浮动 + 入场弹簧 ---------------- */
  let last = performance.now()
  const tick = (now) => {
    requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (state.spin && !state.dragging) state.angle += dt * 0.5
    pivot.rotation.y = state.angle
    mirror.rotation.y = state.angle
    // 入场弹簧（§1.7「入场弹簧缩放」）
    state.entry = Math.min(1, (state.entry ?? 0) + dt / 0.45)
    const t = state.entry
    const s = 1 + 0.18 * Math.sin(t * Math.PI * 1.6) * (1 - t) // 轻微过冲
    pivot.scale.setScalar(s)
    mirror.scale.setScalar(s)
    const float = Math.sin(now / 1000 * 0.9) * 0.012
    pivot.position.y = float
    mirror.position.y = float
    renderer.render(scene, camera)
  }
  requestAnimationFrame(tick)

  console.info('[props] 审批页就绪：1/2/3 切模型、W 线框、空格自动旋转、拖动改转角。' +
    '未获 ✅ 前不得入片（docs/PROPS_APPROVAL.md）')
}
