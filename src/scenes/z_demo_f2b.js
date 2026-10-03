// src/scenes/z_demo_f2b.js — F2b 演示段：3D 物件库 / 代码墙 / 蜂群（不属于影片）
//
// 只在 `?demo=<mode>` 时注册，用来**逐项肉眼验证 + 机器取证** F2b 的交付物。
// 与 `?shot=分:秒` 配合可定格任意一帧，便于截图反馈。
//
//   props    茄子 · 番茄 · 猫 · 开关 · 心脏 一字排开 + 钟表居中（PBR 是否像 PBR、几何是否是几何）
//   clock    钟表 + 天空：T 从 7:00 扫到 19:00，看指针是否单调正转、日月是否交替
//   tunnel   全屏时间隧道（验证"必须占满整个画面"）
//   kv       KV Cache 16³ 体素：逐块点亮 → 彩色 → 回收被扫走
//   heart    低多边形心脏：真实自转 + 心跳
//   wall     代码墙：七种语言 / 多层景深（验证字号与可读性）
//   swarm    蜂群：依次形变过所有目标布局（验证身份固定 + 错峰形变）
//   bridges  蜂群按**真实桥接表**在段落边界形变（验证 §2.1 的转场）
//
// 取景约定：影片相机由 rig.js 驱动，t=0–14.5s 位于 z≈2.6–3.6（fov 34–40°），
// 因此原点上可见的范围约 2.8×1.6 世界单位。演示物件必须按这个尺度摆 ——
// 第一版把它们放在 z≈0 且缩放到 0.3，结果在 1920×1080 上只有十几个像素。

import * as THREE from 'three'
import { clamp, span, smoothstep, TAU, outBack } from '../core/ease.js'
import { C } from '../core/palette.js'
import { text } from '../ui/text.js'
import { createProp, countTriangles, createLightRig } from '../lib/props/index.js'
import { codeWall } from '../lib/codewall.js'
import { createSwarm, swarmStateAt, LAYOUT_NAMES, BRIDGES } from '../lib/swarm.js'
import { pulseAt } from '../core/impact.js'
import { fx } from '../core/fx.js'

export const F2B_MODES = ['props', 'clock', 'tunnel', 'kv', 'heart', 'wall', 'swarm', 'bridges']

/**
 * 每个演示模式自己的机位。
 * 为什么需要：影片相机由 rig.js 驱动，t=0–14.5s 一直在 z≈2.6–3.6（fov 34–40°），
 * 原点处只能看到约 ±1.57 × ±0.88 世界单位 —— 拿它拍 16³ 体素立方体或 5.2 宽的走廊
 * 必然被裁掉。演示段的职责是"把每一项拍清楚"，所以按被摄物尺寸反算机位：
 *   z = (半宽 / tan(fov/2)) / aspect + margin
 */
const DEMO_CAM = {
  props: { pos: [0, 0.02, 3.0], look: [0, 0, 0], fov: 38 }, // 可见 ±1.85 × ±1.04
  clock: { pos: [0, 0.02, 3.4], look: [0, 0, 0], fov: 40 },
  tunnel: { pos: [0, 0, 3.4], look: [0, 0, -3], fov: 44 },
  kv: { pos: [0, 0, 4.6], look: [0, 0, 0], fov: 40 }, // 可见 ±2.90 × ±1.63
  heart: { pos: [0, 0, 2.3], look: [0, 0, 0], fov: 40 }, // 心高 0.86 → 画面高度 54%
  wall: { pos: [0, 0, 5.6], look: [0, 0, -1], fov: 40 }, // 可见 ±3.53 × ±1.99
  swarm: { pos: [0, 0, 4.0], look: [0, 0, 0], fov: 40 }, // 布局归一化半径 1.15 → 画面高度 70%
  bridges: { pos: [0, 0, 4.0], look: [0, 0, 0], fov: 40 },
}

/** 从 URL 里取演示模式（非 F2b 模式返回 null，交给别的演示段） */
export function f2bMode() {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('demo')
  return F2B_MODES.includes(v) ? v : null
}

export default {
  id: 'DEMO_F2B',
  start: 0,
  end: 211.907,
  title: 'F2b 演示：物件库 / 代码墙 / 蜂群',
  demo: true,

  init(ctx) {
    this.mode = f2bMode() || 'props'
    // metrics 先建好：init 中途抛错时 render 也不该再抛第二个错
    this.metrics = { triangles: 0, drawCalls: 0, mode: this.mode }
    const T = ctx.three
    const renderer = T.renderer || null

    // 灯光与环境（PBR 需要；Basic 材质不受影响）
    this.lights = createLightRig()
    T.stage3d.add(this.lights)

    this.items = []
    const add = (o) => {
      T.stage3d.add(o)
      return o
    }

    if (this.mode === 'props' || this.mode === 'clock') {
      // 钟表居中偏上，其余一字排开在下半幅（避开底部 16% 歌词安全区）。
      // 尺寸按 DEMO_CAM.props 的取景算：可见 ±1.85 × ±1.04，世界单位 1 ≈ 519 屏幕像素。
      const skyOn = this.mode === 'clock'
      this.clock = createProp('clock', { renderer, radius: 0.58, numerals: true, sky: skyOn })
      this.clock.object.position.set(0, 0.6, -0.6)
      add(this.clock.object)

      if (this.mode === 'props') {
        // 行宽 2.6 世界单位 = 画面宽的 70%；物件高 0.65–0.75（画面高的 31–36%）
        const row = [
          ['eggplant', -1.16, { size: 0.56, y: -0.2 }],
          ['tomato', -0.62, { size: 0.52, y: -0.22 }],
          ['cat', -0.06, { size: 0.54, y: -0.16 }],
          ['toggle', 0.6, { length: 0.6, radius: 0.15, flips: [2.0, 4.0, 6.0, 8.0], startOn: false, y: -0.44 }],
          ['heart', 1.02, { scale: 0.56, y: -0.22 }],
        ]
        for (const [kind, x, o] of row) {
          const { y, ...rest } = o
          const p = createProp(kind, { renderer, ...rest })
          p.object.position.set(x, y, 0)
          add(p.object)
          this.items.push({ kind, p, x, y })
        }
      }
    } else if (this.mode === 'tunnel') {
      this.tunnel = createProp('tunnel', {
        renderer,
        radius: 3.0,
        rings: 44,
        span: 28,
        reverseAt: [6, 18],
        signFlipAt: [12],
        numerals: 12,
      })
      add(this.tunnel.object)
    } else if (this.mode === 'kv') {
      this.kv = createProp('kvcache', { renderer })
      this.kv.object.position.set(0, 0, 0)
      // 16³ × 0.064 = 1.02 世界单位；放大 1.28 → 高 1.31 ≈ 画面高度 40%（可见 ±1.63）
      this.kv.object.scale.setScalar(1.28)
      add(this.kv.object)
    } else if (this.mode === 'heart') {
      this.heart = createProp('heart', { renderer, scale: 1.0 })
      this.heart.object.position.set(0, 0, 0)
      add(this.heart.object)
    } else if (this.mode === 'wall') {
      // 相机退到 z=5.6 → 可见 ±3.53 × ±1.99（世界单位）。
      // 只放**一面**代码墙（7 种语言 = 7 层，正对相机、近大远小）。
      // 早先在同一片屏幕上叠了"走廊 + 侧墙"两套代码，两层不同的代码同屏重叠 →
      // 读出来是重影而不是景深（实测两行都读不出来）。景深交给同一面墙的 7 层去做。
      // 相机退到 z=5.6（可见 ±3.53 × ±1.99）。最近那层 5.0×2.9 在 z≈-0.9 处正好铺满画面，
      // 字号 96 → 每行 ≈ (96×1.46/480)×234 世界→像素 ≈ 68px，远高于 §0.5 的 ≥40px。
      this.wall = codeWall({ layout: 'corridor', layers: 6, fontPx: 96, speed: 0.6, width: 5.0, height: 2.9, cycle: 16 })
      add(this.wall.object)
    } else if (this.mode === 'swarm' || this.mode === 'bridges') {
      // 演示用轻量蜂群（影片里是 SWARM_COUNT 粒；演示只需看清布局与形变）
      this.swarm = createSwarm({ count: 900, size: 0.05 })
      add(this.swarm.object)
    }

    this.tmp = new THREE.Vector3()
    // 演示段压掉开机 CRT 亮线（否则 t<0.85s 的画面被整屏压成一条亮线）
    fx.setCrtLevel(1)
  },

  /** 演示段自己的机位（main.js 在 demo 模式下用它取代 rig） */
  cam() {
    const c = DEMO_CAM[this.mode] || DEMO_CAM.props
    return { pos: c.pos.slice(), look: c.look.slice(), fov: c.fov }
  },

  render(t, lt, ctx) {
    // renderAt 每帧会把 stage3d 的子对象全部 visible=false，本段要逐帧重新打开
    this.lights.visible = true
    for (const it of this.items) it.p.object.visible = true
    if (this.clock) this.clock.object.visible = true
    if (this.tunnel) this.tunnel.object.visible = true
    if (this.kv) this.kv.object.visible = true
    if (this.heart) this.heart.object.visible = true
    if (this.wall) this.wall.object.visible = true
    if (this.swarm) this.swarm.object.visible = true

    const imp = pulseAt(t, ctx.impulses || [])
    const beatU = clamp((t % 0.4666) / 0.4666) // 128.6 BPM 的一拍

    if (this.mode === 'props' || this.mode === 'clock') {
      // 展示用：T 每 24s 走完 12 小时（只为看得清指针）
      const T = 420 + ((t % 24) / 24) * 720
      this.clock.update(t, { T, skyAlpha: this.mode === 'clock' ? 1 : 0 })
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i]
        // 错峰弹入（带过冲），前 3s 内全部到位
        const pop = outBack(clamp(span(t, 0.35 + i * 0.26, 1.25 + i * 0.26)))
        it.p.object.position.y = it.y
        if (it.kind === 'toggle') it.p.update(t, { alpha: 1 })
        else if (it.kind === 'heart') it.p.update(t, { alpha: 1, beat: beatU, spin: 0.5 })
        else it.p.update(t, { alpha: 1, pop })
      }
    } else if (this.mode === 'tunnel') {
      this.tunnel.update(t, { camera: ctx.three.camera, alpha: 1, speed: 11, rms: 0.25 })
    } else if (this.mode === 'kv') {
      // 8s 填满 → 停 2s → 2s 回收，循环
      const cyc = (t % 22) / 22
      const fill = clamp(span(cyc, 0.0, 0.42))
      const reclaim = clamp(span(cyc, 0.6, 0.86))
      const out = this.kv.update(t, { fill, reclaim, sweep: 1 - reclaim * 0.5, alpha: 1, pulse: imp })
      this.metrics.live = out.live
      this.kv.object.rotation.y = t * 0.28
    } else if (this.mode === 'heart') {
      this.heart.update(t, { alpha: 1, beat: beatU, spin: 0.55, pop: 1 })
    } else if (this.mode === 'wall') {
      this.wall.update(t, { camera: ctx.three.camera, alpha: 1 })
    } else if (this.mode === 'swarm') {
      // 每个布局停 3s，用 1.2s 形变过去
      const per = 4.2
      const i = Math.floor(t / per) % LAYOUT_NAMES.length
      const u = clamp(span(t % per, 3.0, 4.2))
      const from = LAYOUT_NAMES[i]
      const to = LAYOUT_NAMES[(i + 1) % LAYOUT_NAMES.length]
      this.swarm.update(t, {
        camera: ctx.three.camera, alpha: 0.95, size: 0.05,
        state: { from, to, u, bridge: { element: 'demo' }, at: 0, seg: 'demo' },
      })
      this.metrics.from = from
      this.metrics.to = to
      this.metrics.u = +u.toFixed(3)
    } else if (this.mode === 'bridges') {
      // 真实桥接表：把全片 212s 压到 40s 循环
      const tt = (t % 40) * (211.907 / 40)
      const st = swarmStateAt(tt)
      this.swarm.update(t, { camera: ctx.three.camera, alpha: 0.95, size: 0.05, state: st })
      this.metrics.bridge = st.bridge ? `${st.bridge.from}→${st.bridge.to} u=${st.u.toFixed(2)}` : `段 ${st.seg}`
    }

    // 指标（供 evaluate 读取；不画在画面上）
    const info = ctx.three.renderer && ctx.three.renderer.info
    this.metrics.triangles = info ? info.render.triangles : 0
    this.metrics.drawCalls = info ? info.render.calls : 0
    if (ctx.three.__demoMetrics) Object.assign(ctx.three.__demoMetrics, this.metrics)
    else ctx.three.__demoMetrics = { ...this.metrics }

    if (ctx.debug) {
      const g = ctx.g
      g.save()
      g.globalAlpha = 0.9
      text(g, `demo=${this.mode}  tris=${this.metrics.triangles}  calls=${this.metrics.drawCalls}`, 40, 84, {
        role: 'ui', size: 34, family: 'code', color: C.teal,
      })
      if (this.metrics.bridge) text(g, this.metrics.bridge, 40, 124, { role: 'ui', size: 34, family: 'code', color: C.fgDim })
      if (this.metrics.from) text(g, `${this.metrics.from} → ${this.metrics.to}  u=${this.metrics.u}`, 40, 124, { role: 'ui', size: 34, family: 'code', color: C.fgDim })
      g.restore()
    }
  },

  /** 供自动验证：本演示段一共放了多少三角形 */
  report() {
    return { mode: this.mode, metrics: this.metrics }
  },
}

export { countTriangles, smoothstep, TAU, BRIDGES }
