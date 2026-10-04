// src/core/compositor.js — 单画布合成（SPEC §2.5）。
// 层序：舞台层(Canvas2D + Three) → 鲸鱼娘层 → dsh UI 层 → 后处理 → 歌词层(最后画)。
// 逻辑分辨率 1920×1080；view 画布按 DPR 放大（≤2），歌词在 view 上以设备分辨率绘制，保持清晰。

import * as THREE from 'three'
import { C, rgba } from './palette.js'
import { hash01 } from './rng.js'
import { createPost3D } from './post3d.js'

export const LOGICAL_W = 1920
export const LOGICAL_H = 1080
export const ASPECT = LOGICAL_W / LOGICAL_H

function mkCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export class Compositor {
  constructor(viewCanvas, lyricsCanvas = null) {
    this.view = viewCanvas
    // 歌词层画布：独立于合成链之外，永远最后画、且在所有 DOM 层之上（FIX §6 + 用户 F2a 反馈）
    this.lyricsCanvas = lyricsCanvas || document.getElementById('lyrics')
    if (!this.lyricsCanvas) {
      this.lyricsCanvas = document.createElement('canvas')
      this.lyricsCanvas.id = 'lyrics'
      document.body.appendChild(this.lyricsCanvas)
    }
    this.W = LOGICAL_W
    this.H = LOGICAL_H
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)

    this.layers = {}
    for (const name of ['stageBack', 'stageFront', 'whale', 'ui']) {
      const canvas = mkCanvas(this.W, this.H)
      this.layers[name] = { canvas, g: canvas.getContext('2d') }
    }
    this.comp = mkCanvas(this.W, this.H)
    this.gComp = this.comp.getContext('2d')
    this.post = mkCanvas(this.W, this.H)
    this.gPost = this.post.getContext('2d')

    // 半分辨率辅助缓冲（色散 / 泛光）
    this.halfW = this.W >> 1
    this.halfH = this.H >> 1
    this.scratchA = mkCanvas(this.halfW, this.halfH)
    this.gA = this.scratchA.getContext('2d')
    this.scratchB = mkCanvas(this.halfW, this.halfH)
    this.gB = this.scratchB.getContext('2d')
    this.bloom = mkCanvas(this.W >> 2, this.H >> 2)
    this.gBloom = this.bloom.getContext('2d')

    // Three
    const threeCanvas = mkCanvas(this.W, this.H)
    this.threeCanvas = threeCanvas
    // ---- T01（FIX_V4 §2.5e）：`preserveDrawingBuffer` **只在 ?selftest / ?contact 时开** ----
    // 它的作用是让"渲染完再读回像素"变得确定（合成层要把 WebGL 画布 drawImage 进 2D 层，
    // 自检/联系表还要再读一次）。但常开会让浏览器每帧多留一份后备缓冲、并且禁止某些快速路径，
    // 是明确的耗电项。所以只在需要读回的两个模式里开；其它情况交给默认（false）。
    const q = new URLSearchParams(window.location.search)
    const wantsReadback = q.has('selftest') || q.has('contact')
    this.renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: wantsReadback,
      powerPreference: 'high-performance',
    })
    /** T01：DPR 自适应系数（1 = 全分辨率）。由 main.js 的帧时间看门狗下调。 */
    this.dprScale = 1
    /** T01：`?fps=30` 等帧率上限由 main.js 控制，这里只记录，便于 ?perf 报告 */
    this.preserveDrawingBuffer = wantsReadback
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.W, this.H, false)
    // 3D 现在是**底层**：清屏色必须不透明（背景由 3D 场景/清屏色提供）
    this.renderer.setClearColor(0x0b0d12, 1)
    this.scene = new THREE.Scene()
    // 相机 A：舞台 3D 用透视相机（由 rig.js 的轨道驱动）——layer 1
    this.camera = new THREE.PerspectiveCamera(40, ASPECT, 0.05, 200)
    this.camera.position.set(0, 0, 3.4)
    this.camera.lookAt(0, 0, 0)
    this.camera.layers.set(1)
    // 相机 B：鲸鱼层（点云/网格/轮廓）用正交相机 —— 保持「1 世界单位 = 半屏高」的既有映射
    this.whaleCamera = new THREE.OrthographicCamera(-ASPECT, ASPECT, 1, -1, 0.05, 100)
    this.whaleCamera.position.set(0, 0, 4)
    this.whaleCamera.lookAt(0, 0, 0)
    this.whaleCamera.layers.set(2)
    this.post3d = null
    // 2D 舞台层是否让出背景（F2a）：true = 3D 负责不透明背景，旧 2D 场景不再铺底
    this.bgIs3d = true
    // 3D 画布与 2D 层的合成方式：'over' = 3D 在下、其余 source-over（F2a 后的正确做法）
    // 'lighter' = F2a 之前的加法（仅用于 A/B 对比：加法下比背景暗的物体必然消失）
    this.composite3d = 'over'
    // 关掉自动重置：一帧内有多个 pass，自动重置会让 info 只反映最后一个全屏 quad
    this.renderer.info.autoReset = false
    this.stage3d = new THREE.Group()
    this.whale3d = new THREE.Group()
    this.stage3d.renderOrder = 5
    this.whale3d.renderOrder = 20
    this.scene.add(this.stage3d, this.whale3d)

    // 扫描线图案
    const sc = mkCanvas(1, 3)
    const sg = sc.getContext('2d')
    sg.fillStyle = 'rgba(0,0,0,0.85)'
    sg.fillRect(0, 0, 1, 1)
    this.scanPattern = this.gPost.createPattern(sc, 'repeat')

    this._vignette = null
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  /** view 画布按 DPR 缩放；内部分辨率固定 1920×1080 */
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.view.width = Math.round(this.W * this.dpr)
    this.view.height = Math.round(this.H * this.dpr)
    this.view.style.width = '100vw'
    this.view.style.height = '100vh'
    this.lyricsCanvas.width = this.view.width
    this.lyricsCanvas.height = this.view.height
    this.lyricsCanvas.style.width = '100vw'
    this.lyricsCanvas.style.height = '100vh'
    this._vignette = null
  }

  /** 清空歌词层（每帧在画歌词之前调用） */
  clearLyrics() {
    const g = this.lyricsCanvas.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, this.lyricsCanvas.width, this.lyricsCanvas.height)
    return g
  }

  /** 歌词层的 2D context（已按 DPR 缩放，按 1920×1080 逻辑坐标绘制） */
  lyricsCtx() {
    const g = this.lyricsCanvas.getContext('2d')
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    return g
  }

  /** 每帧开始：清空 2D 层（Three 层在 render 时清） */
  clearLayers() {
    for (const k of ['stageBack', 'stageFront', 'whale', 'ui']) {
      const { g } = this.layers[k]
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, this.W, this.H)
    }
  }

  /** 建立 3D 后处理管线（EffectComposer；失败则自动回退） */
  async setupPost3D() {
    this.post3d = await createPost3D(this.renderer, this.scene, this.camera, {
      width: this.W,
      height: this.H,
      camera2: this.whaleCamera,
    })
    return this.post3d
  }

  /** 渲染 Three 内容：舞台 3D（透视，layer 1）在下，鲸鱼 3D（正交，layer 2）在上 */
  renderThree(t = 0, p = {}) {
    this.renderer.info.reset()
    // 每帧给两组的成员分配图层（场景可能在 init 时新增对象）。
    // 必须 **traverse**：`Object3D.layers` 是逐对象的，只给根节点 set() 的话，
    // 组合式物件（Group 套 Mesh，例如 src/lib/props/*）的子网格会留在 layer 0，
    // 而相机只看 layer 1/2 —— 于是"物件建好了却看不见"。
    for (const c of this.stage3d.children) c.traverse((o) => o.layers.set(1))
    for (const c of this.whale3d.children) c.traverse((o) => o.layers.set(2))
    if (this.post3d && this.post3d.enabled) {
      this.post3d.render(t, p)
      return
    }
    const r = this.renderer
    r.autoClear = true
    r.clear()
    r.render(this.scene, this.camera)
    r.autoClear = false
    r.render(this.scene, this.whaleCamera)
    r.autoClear = true
  }

  /** 合成 5 层 → comp → post（含后处理）→ view。layers 为 ?debug 的图层开关。 */
  /**
   * T01（FIX_V4 §2.5e）：DPR 自适应。
   * 帧时间**连续 1s** 超过 25ms 时由 main.js 调用这里下调系数 —— 降的是 WebGL 层的
   * 内部渲染分辨率（3D 是这一帧里最贵的一块），2D 合成层仍是 1920×1080，
   * 于是画面清晰度只在 3D 层上做取舍，文字/歌词不受影响。
   * @param {number} s 0.6–1
   */
  setDprScale(s) {
    const next = Math.max(0.6, Math.min(1, s))
    if (Math.abs(next - this.dprScale) < 1e-3) return false
    this.dprScale = next
    this.renderer.setPixelRatio(next)
    this.renderer.setSize(this.W, this.H, false)
    return true
  }

  present(t, P = {}) {
    const { W, H } = this
    const L = P.layers || { stage: true, whale: true, ui: true, fx: true, lyrics: true }
    const layerMask_three = P.three !== false
    const gc = this.gComp
    gc.setTransform(1, 0, 0, 1, 0, 0)
    gc.clearRect(0, 0, W, H)
    // 层序（F2a 修正）：**3D 是底层**，它自带不透明背景；2D 舞台与 DOM 层在它之上
    // 一律用 source-over 叠加。若再像之前那样用加法，比背景暗的 3D 物体（深紫茄子、
    // 阴影、黑洞暗面）会被背景"加没"——加法只能变亮，压不暗。
    const drawThree = () => {
      if (layerMask_three === false) return
      gc.globalCompositeOperation = this.composite3d === 'lighter' ? 'lighter' : 'source-over'
      // ⚠️ 必须**显式给出目标尺寸**。没有它时 `drawImage` 按位图的原始像素尺寸画：
    // DPR=1 时位图正好是 1920×1080（看起来"全屏"），但 T01 的 DPR 自适应一旦把
    // `setPixelRatio` 降到 0.6，位图变成 1152×648 —— 3D 层就只铺满**左上角 60%**，
    // 右边和下面是黑的（用户截图里正是这个现象）。
    // 给出 (W,H) 之后位图会被缩放铺满，代价只是低 DPR 下略软 —— 这才是自适应的本意。
    gc.drawImage(this.threeCanvas, 0, 0, this.W, this.H)
      gc.globalCompositeOperation = 'source-over'
    }
    drawThree()
    if (L.stage) {
      gc.drawImage(this.layers.stageBack.canvas, 0, 0)
      gc.drawImage(this.layers.stageFront.canvas, 0, 0)
    }
    if (L.whale) gc.drawImage(this.layers.whale.canvas, 0, 0)
    if (L.ui) gc.drawImage(this.layers.ui.canvas, 0, 0)

    if (L.fx) this.applyPost(t, P)
    else {
      const g = this.gPost
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, W, H)
      g.drawImage(this.comp, 0, 0)
    }

    const vg = this.view.getContext('2d')
    vg.setTransform(1, 0, 0, 1, 0, 0)
    vg.clearRect(0, 0, this.view.width, this.view.height)
    vg.imageSmoothingEnabled = true
    vg.imageSmoothingQuality = 'high'
    vg.drawImage(this.post, 0, 0, this.view.width, this.view.height)
    // 歌词画在**独立的顶层画布**上：这样它必然盖住 DOM 界面层，且不参与后处理（§6）
    this.clearLyrics()
    return this.lyricsCtx()
  }

  applyPost(t, P) {
    const { W, H } = this
    const g = this.gPost
    const comp = this.comp
    const shake = P.shake || 0
    const glitch = P.glitch || 0
    const disp = P.dispersion || 0
    const crt = P.crtLevel == null ? 1 : P.crtLevel
    const flash = P.flash || 0
    const gi = Math.floor(t * 60)

    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, W, H)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'

    const ox = shake ? (hash01(gi, 41) * 2 - 1) * 16 * shake : 0
    const oy = shake ? (hash01(gi, 42) * 2 - 1) * 13 * shake : 0
    const sy = crt < 0.999 ? Math.max(0.004, crt) : 1

    // 基础合成（CRT 展开/收缩 = 垂直方向缩放）
    g.save()
    if (sy !== 1) {
      g.translate(0, H / 2)
      g.scale(1, sy)
      g.translate(0, -H / 2)
    }
    g.drawImage(comp, ox, oy)
    g.restore()

    // 色散：红色与青色副本错位叠加（半分辨率，仅在需要时）
    if (disp > 0.03) {
      const d = 2 + disp * 16
      const drawTinted = (chan, color, alpha, dx) => {
        const a = this.gA
        a.setTransform(1, 0, 0, 1, 0, 0)
        a.globalCompositeOperation = 'source-over'
        a.clearRect(0, 0, this.halfW, this.halfH)
        a.drawImage(comp, 0, 0, this.halfW, this.halfH)
        a.globalCompositeOperation = 'multiply'
        a.fillStyle = color
        a.fillRect(0, 0, this.halfW, this.halfH)
        a.globalCompositeOperation = 'source-over'
        g.save()
        g.globalAlpha = alpha
        g.globalCompositeOperation = 'lighter'
        g.drawImage(this.scratchA, dx, 0, W, H)
        g.restore()
      }
      drawTinted('r', '#ff4d4d', disp * 0.75, d)
      drawTinted('b', '#4dc9ff', disp * 0.75, -d)
    }

    // glitch：水平切片位移 + 白条
    if (glitch > 0.05) {
      const bands = 14
      const bh = Math.ceil(H / bands)
      for (let b = 0; b < bands; b++) {
        if (hash01(gi * 31 + b, 7) > 0.72 - glitch * 0.25) {
          const dx = (hash01(gi * 31 + b, 8) * 2 - 1) * 34 * glitch
          const by = b * bh
          g.drawImage(comp, 0, by, W, bh, dx, by, W, bh)
        }
      }
      for (let k = 0; k < 3; k++) {
        if (hash01(gi * 17 + k, 9) > 0.82 - glitch * 0.3) {
          const yy = hash01(gi * 17 + k, 10) * H
          g.fillStyle = `rgba(255,255,255,${0.5 * glitch})`
          g.fillRect(0, yy, W, 1 + hash01(gi + k, 11) * 3)
        }
      }
    }

    // CRT 亮线（展开/收缩边缘）
    if (sy !== 1) {
      const edge = (H / 2) * (1 - sy)
      g.fillStyle = 'rgba(210,240,255,0.85)'
      g.fillRect(0, edge, W, 2)
      g.fillRect(0, H - edge - 2, W, 2)
      g.fillStyle = 'rgba(120,200,255,0.25)'
      g.fillRect(0, edge + 2, W, 6)
      g.fillRect(0, H - edge - 8, W, 6)
    }

    // 泛光：低分辨率模糊回叠
    const bloomAmt = P.bloom == null ? 0.16 : P.bloom
    if (bloomAmt > 0.001) {
      const bw = this.bloom.width
      const bh2 = this.bloom.height
      const gb = this.gBloom
      gb.setTransform(1, 0, 0, 1, 0, 0)
      gb.clearRect(0, 0, bw, bh2)
      gb.globalCompositeOperation = 'source-over'
      gb.drawImage(comp, 0, 0, bw, bh2)
      g.globalCompositeOperation = 'lighter'
      g.globalAlpha = bloomAmt
      g.drawImage(this.bloom, 0, 0, W, H)
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    }

    // 扫描线（Always 极轻；CRT 期间加强）
    if (this.scanPattern) {
      g.globalAlpha = 0.05 + (sy !== 1 ? 0.22 : 0) + glitch * 0.1
      g.fillStyle = this.scanPattern
      g.fillRect(0, 0, W, H)
      g.globalAlpha = 1
    }

    // 暗角
    if (!this._vignette) {
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.86)
      vg.addColorStop(0, 'rgba(0,0,0,0)')
      vg.addColorStop(1, 'rgba(0,0,0,0.55)')
      this._vignette = vg
    }
    g.fillStyle = this._vignette
    g.fillRect(0, 0, W, H)

    // 闪白
    if (flash > 0.001) {
      g.fillStyle = `rgba(255,255,255,${Math.min(1, flash)})`
      g.fillRect(0, 0, W, H)
    }
  }

  /** 全黑（段 J 黑场 / 段 N 片尾），由场景调用，画在 comp 之前 */
  fadeStage(g, a, color = '#000') {
    g.save()
    g.globalAlpha = a
    g.fillStyle = color
    g.fillRect(0, 0, this.W, this.H)
    g.restore()
  }

  dispose() {
    this.renderer.dispose()
  }
}
