// src/core/compositor.js — 单画布合成（SPEC §2.5）。
// 层序：舞台层(Canvas2D + Three) → 鲸鱼娘层 → dsh UI 层 → 后处理 → 歌词层(最后画)。
// 逻辑分辨率 1920×1080；view 画布按 DPR 放大（≤2），歌词在 view 上以设备分辨率绘制，保持清晰。

import * as THREE from 'three'
import { C, rgba } from './palette.js'
import { hash01 } from './rng.js'

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
  constructor(viewCanvas) {
    this.view = viewCanvas
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
    this.renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      // 需要把 WebGL 画布 drawImage 进 2D 合成层；不保留缓冲会导致读到的内容不确定
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(this.W, this.H, false)
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-ASPECT, ASPECT, 1, -1, 0.05, 100)
    this.camera.position.set(0, 0, 4)
    this.camera.lookAt(0, 0, 0)
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
    this._vignette = null
  }

  /** 每帧开始：清空 2D 层（Three 层在 render 时清） */
  clearLayers() {
    for (const k of ['stageBack', 'stageFront', 'whale', 'ui']) {
      const { g } = this.layers[k]
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, this.W, this.H)
    }
  }

  /** 渲染 Three 内容（舞台 3D + 鲸鱼 3D） */
  renderThree() {
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
  }

  /** 合成 5 层 → comp → post（含后处理）→ view。layers 为 ?debug 的图层开关。 */
  present(t, P = {}) {
    const { W, H } = this
    const L = P.layers || { stage: true, whale: true, ui: true, fx: true, lyrics: true }
    const gc = this.gComp
    gc.setTransform(1, 0, 0, 1, 0, 0)
    gc.clearRect(0, 0, W, H)
    if (L.stage) {
      gc.drawImage(this.layers.stageBack.canvas, 0, 0)
      gc.drawImage(this.threeCanvas, 0, 0)
      gc.drawImage(this.layers.stageFront.canvas, 0, 0)
    } else if (L.whale) {
      gc.drawImage(this.threeCanvas, 0, 0)
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
    // 之后按逻辑坐标绘制（歌词层）
    vg.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    return vg
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
