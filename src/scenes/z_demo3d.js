// src/scenes/z_demo3d.js — 演示段：验证「持久 3D 世界 + 相机轨道 + 冲击后处理」（FIX.md §5.7 的 P0 验证要求）
//
// 只在 `?demo=1` 时注册，不属于影片。它把 FIX §2.1 的架构跑起来：
//   · 一个持久的 3D 世界（门环隧道 + 代码墙 + 蜂群 + 几个道具），全部挂在 stage3d 上；
//   · 相机沿 rig.js 的轨道飞（位置/注视点/fov/roll 全部由 t 推导）；
//   · 冲击由 impact.js 的冲量表驱动（门环脉冲 + 后处理 bloom/色散/径向模糊）。
// 目的是让「相机是否连续、是否有景深、冲击是否联动」可以被肉眼验证。

import * as THREE from 'three'
import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text } from '../ui/text.js'
import { pulseAt, shockwaves } from '../core/impact.js'
import { createField } from '../lib/three_util.js'

const RINGS = 34
const RING_Z0 = 3.0
const RING_GAP = -3.2

export default {
  id: 'DEMO',
  start: 0,
  end: 211.907,
  title: '演示：持久 3D 世界 + 相机轨道 + 冲击',
  demo: true,

  init(ctx) {
    const T = ctx.three
    // ---- 门环隧道（InstancedMesh）----
    const ringGeo = new THREE.TorusGeometry(1.28, 0.022, 8, 64)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    this.rings = new THREE.InstancedMesh(ringGeo, ringMat, RINGS)
    this.rings.frustumCulled = false
    this.ringPhase = new Float32Array(RINGS)
    for (let i = 0; i < RINGS; i++) this.ringPhase[i] = hash01(i, 3)
    T.stage3d.add(this.rings)

    // ---- 蜂群（12000 粒子，解析公式 + uTime）----
    this.swarm = createField(12000, 0, { seed: 77, color: '#9fd0ff', extent: 1.6, spread: 2.2, fall: 0.03, size: 2.4 })
    T.stage3d.add(this.swarm.object)

    // ---- 代码墙（大字号原创代码贴到 3D 平面；字号走 text() 的 codeWall 下限）----
    const LINES = [
      'def love(x, t):',
      '    return remember(x)',
      'KV(t) = KV(t-1) + (k_t, v_t)',
      'Attention(Q,K,V)',
      'L = -sum(y_i * log p_i)',
      'softmax(z)_i',
      'for step in range(N):',
      '    x = x - lr * grad(x)',
      'lim f(x) = M',
      'if t < 1: return x',
    ]
    this.walls = []
    const mkWall = (i, z) => {
      const cw = 1024
      const ch = 640
      const cv = document.createElement('canvas')
      cv.width = cw
      cv.height = ch
      const g = cv.getContext('2d')
      g.fillStyle = 'rgba(6,10,16,1)'
      g.fillRect(0, 0, cw, ch)
      for (let k = 0; k < LINES.length; k++) {
        const col = k % 3 === 0 ? C.teal : k % 3 === 1 ? C.purple : C.green
        text(g, LINES[k], 24, 60 + k * 58, { role: 'codeWall', size: 44, family: 'code', color: col, weight: 500 })
      }
      const tex = new THREE.CanvasTexture(cv)
      tex.needsUpdate = true
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(4.6, 2.9),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })
      )
      m.position.set(i % 2 ? -2.05 : 2.05, 0, z)
      m.rotation.y = (i % 2 ? 1 : -1) * 0.42
      T.stage3d.add(m)
      return m
    }
    for (let i = 0; i < 8; i++) this.walls.push(mkWall(i, RING_Z0 + (i + 0.5) * RING_GAP * 3))

    // ---- 验收用（F2a）：一块**亮**的 3D 背景板 + 一个**深色** 3D 物体 ----
    // 背景板放在隧道深处，保证"亮背景"是 3D 自己画的；深紫物体在近处。
    // 若合成仍用加法，深紫物体会被亮背景加没；改成 3D 在底层 + source-over 后，
    // 它必须保持不透明、边缘清晰。
    this.backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 34),
      new THREE.MeshBasicMaterial({ color: 0xcfd6dd }) // 亮灰（远高于深紫）
    )
    this.backdrop.position.set(0, 0, -30)
    this.backdrop.renderOrder = 1
    T.stage3d.add(this.backdrop)

    this.darkProp = new THREE.Mesh(
      new THREE.LatheGeometry(
        // 车削轮廓：一个扁圆壶形（茄子/暗物体的形状语义）
        Array.from({ length: 14 }, (_, i) => {
          const u = i / 13
          return new THREE.Vector2(0.16 + Math.sin(u * Math.PI) * 0.34, -0.62 + u * 1.28)
        }),
        32
      ),
      new THREE.MeshBasicMaterial({ color: 0x2a1040 }) // 深紫：比亮背景暗得多
    )
    this.darkProp.position.set(-0.55, 0.05, 1.1)
    this.darkProp.renderOrder = 3
    T.stage3d.add(this.darkProp)

    // 一个中间灰度的立方体，方便肉眼比较三档明度
    this.midCube = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x6f7a86 })
    )
    this.midCube.position.set(0.65, -0.1, 1.0)
    this.midCube.renderOrder = 3
    T.stage3d.add(this.midCube)

    this.tmp = new THREE.Vector3()
  },

  render(t, lt, ctx) {
    const T = ctx.three
    // 注意：renderAt 每帧会把 stage3d 的子对象全部 visible=false，场景必须逐帧重新打开
    this.rings.visible = true
    for (const w of this.walls) w.visible = true
    // 验收用物体：固定朝相机、缓慢自转（保持可读）
    this.backdrop.visible = true
    this.darkProp.visible = true
    this.midCube.visible = true
    this.darkProp.rotation.y = t * 0.6
    this.midCube.rotation.set(t * 0.4, t * 0.55, 0)
    const imp = pulseAt(t, ctx.impulses || [])
    const rings = shockwaves(t, ctx.impulses || [])

    // 门环沿 z 循环流动 + 冲击时放大发光
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (let i = 0; i < RINGS; i++) {
      const z = RING_Z0 + ((i * RING_GAP + (t * 0.55) % (RING_GAP * 2)) % (RING_GAP * RINGS))
      const gate = 1 + imp * 0.35 * (1 - this.ringPhase[i] * 0.6)
      p.set(0, 0, z)
      s.set(gate, gate, gate)
      q.identity()
      m.compose(p, q, s)
      this.rings.setMatrixAt(i, m)
    }
    this.rings.instanceMatrix.needsUpdate = true

    // 蜂群：沿隧道流动
    this.swarm.object.visible = true
    this.swarm.update(t, { alpha: 0.5, size: 2.4, spin: 0.02 + imp * 0.2 })

    // 代码墙：随相机前进缓慢滚动
    for (const w of this.walls) w.position.z = RING_Z0 + (((w.position.z - RING_Z0 + t * 0.5) % (RING_GAP * RINGS * 3)) + RING_GAP * RINGS * 3) % (RING_GAP * RINGS * 3)

    // 2D 叠加层：只放最少的说明（演示用），避开画面中心
    // 调试文字只允许出现在 ?debug 里（F2a 第 5 条）
    if (ctx.debug) {
      const g = ctx.g
      g.save()
      g.globalAlpha = 0.9
      text(g, 'impact ' + imp.toFixed(3) + '   shockwaves ' + rings.length + '   post3d ' + (ctx.post3dReady ? 'ON' : 'OFF'), 40, 84, {
        role: 'ui',
        size: 34,
        family: 'code',
        color: C.teal,
      })
      g.restore()
    }
  },
}
