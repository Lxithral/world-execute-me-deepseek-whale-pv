// src/scenes/g_glitch.js — 段 G 1:28.8–1:44 切换与恍惚
// FIX_V3 §7 G：「**巨大的 3D 开关一词一翻**；3D 钟表(§5-4,指针逻辑必须通过断言,天空日转夜)；
//              恍惚=同一 3D 场景两套配色高频交替 + 画面分身；**本段无立绘**。」
// FIX_V3 §3 G 台词（本段要逐条出现）：
//   switch#1 | you  ▸ /persona toggle        · switch#1+0.5 | tool ▸ persona: whale ⇄ default
//   whatever | deepseek ▸ 都行,听你的。
//   AM/PM    | tool ▸ ⚙ clock.set(07:00 → 19:00) · AM/PM+0.8 | deepseek ▸ 一整天过去了。
//   role     | you  ▸ /role swap             · role+0.5 | tool ▸ role: assistant ⇄ companion
//
// ⚠️ T20 按**规则 9 拆成三项**（一项做不完）：
//   · **T20a（本项）**= ① **巨大的 3D 开关**（一词一翻，弹簧过冲）② 删掉本段**死掉的立绘代码**
//     （§7 要求"本段无立绘"；实测 whale 层在 88.8–103.5 一直是 0 像素 —— 那些 `ctx.whale.sprite`
//      请求本来就**没有消费者**，因为立绘由 `main.js` 的 `castAt(t)` 权威表统一门控；
//      但留着会误导读成"本段有立绘"）③ 删掉被 3D 开关取代的 **2D 开关面板**。
//   · **T20b** = 3D 钟表（§5-4：表盘 + 时针/分针按 t 分钟驱动，**断言时针 = 分针/12**、天空日转夜）
//     + **终端屏在侧带**（`role: pane`，× §3 的 7 条台词逐条亮起）。
//   · **T20c** = 恍惚（**同一 3D 场景两套配色高频交替 + 画面分身**；现在的 2D 波包/螺旋/四散窗口
//     /昼夜表盘都要 3D 化或删掉 —— 那句 `win N` 的 11px 文字属 §2.3 的字号下限问题，随这一项一起处理）。

import * as THREE from 'three'
import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic, outBack } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, toggle, roundRect } from '../ui/dsh.js'
import { textPlane } from '../lib/scene3d.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'

/* ================================================================== *
 * T20b：3D 钟表（FIX_V3 §5-4 的第 4 件：「T 分钟驱动：**分针 = T/60×360°**、
 * **时针 = T/720×360°**，并**断言 12:1**」）
 *
 * 断言口径（可机器验证，且是"闭式的"）：两条指针的**角速度之比**必须恰好是 1/12 ——
 *   d(分针)/dT = TAU/60   （每 60 分钟一圈）
 *   d(时针)/dT = TAU/720  （每 720 分钟 = 12 小时一圈）
 *   ⇒ ratio = (TAU/720) / (TAU/60) = 1/12 = 0.0833333…
 * 探针用**未取模**的角度在两个 T 上做差分验证（取模后的角度会绕圈，不适合做比值断言）。
 * ================================================================== */
export const CLOCK_RATE_RATIO = (TAU / 720) / (TAU / 60) // = 1/12

/** T（分钟）→ 指针角（弧度，未取模）。§5-4 的两条式子的逐字实现。 */
export function clockHands(T) {
  return { minute: (T / 60) * TAU, hour: (T / 720) * TAU }
}

/** §3 段 G：`⚙ clock.set(07:00 → 19:00)` —— 钟表从 7:00 扫到 19:00（一整天过去了） */
export const CLOCK_T0 = 7 * 60
export const CLOCK_T1 = 19 * 60

// 四次开关翻转（FIX §3 段 G）的时刻由锚点表给出 —— 见 render 里的 flipsAt()。
// 句子时间优先于 DIRECTOR 的绝对秒数（§2.2）。
const FLIP_KEYS = ['flip1', 'flip2', 'flip3', 'flip4']
const FLIP_FALLBACK = [88.8, 90.3, 95.8, 97.7]

// 3D 开关的机位：放在相机前方 2.2 单位（投到屏幕上 ≈ 屏高 60% ⇒ "巨大"）
const SW_DIST = 2.2

export default {
  id: 'G',
  start: 88.8,
  end: 103.5,
  title: '切换与恍惚',
  fx: [
    { t: 88.8, kind: 'glitch', amount: 0.55, dur: 0.16 },
    { t: 90.3, kind: 'glitch', amount: 0.6, dur: 0.16 },
    { t: 92.1, kind: 'shake', amount: 0.6, dur: 0.5 },
    { t: 94.1, kind: 'disp', amount: 0.5, dur: 0.9 },
    { t: 95.8, kind: 'glitch', amount: 0.6, dur: 0.16 },
    { t: 97.7, kind: 'glitch', amount: 0.65, dur: 0.16 },
    { t: 99.6, kind: 'disp', amount: 0.7, dur: 2.2 },
    { t: 103.4, kind: 'flash', amount: 1.0, dur: 0.3 },
  ],

  /** 四次翻转的时刻（每帧从锚点表读取，纯函数） */
  flipTimes(ctx) {
    return FLIP_KEYS.map((k, i) => (ctx && ctx.cues ? ctx.cues.sec('G', k, FLIP_FALLBACK[i]) : FLIP_FALLBACK[i]))
  },

  /** 开关次数（0→A，奇数→B） */
  flipsAt(t, ctx) {
    let n = 0
    for (const f of this.flipTimes(ctx)) if (t >= f) n++
    return n
  },

  /* ================= T20a：巨大的 3D 开关（§7 G「一词一翻」） ================= */
  init(ctx) {
    const T = ctx.three
    if (!T || !T.stage3d) return
    this.grp = new THREE.Group()
    this.grp.name = 'segG'
    T.stage3d.add(this.grp)

    // 开关自己带两盏灯（不依赖别段的光照装置，保证换段/换机位后仍读得出形体）
    const key = new THREE.DirectionalLight(0xdfefff, 2.1)
    key.position.set(1.4, 2.0, 2.4)
    const rim = new THREE.DirectionalLight(0x6fb6ff, 1.1)
    rim.position.set(-1.8, -0.6, 1.2)
    this.grp.add(key, rim)

    // 底板：**又宽又扁**的开关面板（"巨大"= 宽度吃掉画面 ~88%，高度只占 ~25%）
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.42, metalness: 0.45 })
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 0.3), baseMat)
    this.grp.add(base)
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.3, metalness: 0.6 })
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.07, 0.36), lipMat)
    lip.position.y = -0.23
    this.grp.add(lip)

    // 拨杆：绕 z 轴在 ±0.44 rad 之间翻，翻转瞬间带弹簧过冲
    this.lever = new THREE.Group()
    this.lever.position.set(0, 0.16, 0.2)
    const metal = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff,
      emissive: 0x2f7fa8,
      emissiveIntensity: 1.35,
      roughness: 0.28,
      metalness: 0.62,
    })
    const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 6, 14), metal)
    stick.position.y = 0.21
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 16), metal)
    knob.position.y = 0.5
    this.lever.add(stick, knob)
    this.grp.add(this.lever)
    this.leverMat = metal

    // 弧轨（加法混合的发光弧）：拨杆扫过的路径 —— 跨在竖直方向两侧
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x7fe0ff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 6, 56, Math.PI * 0.62), arcMat)
    arc.position.set(0, 0.16, 0.201)
    arc.rotation.z = Math.PI * 0.22
    this.grp.add(arc)
    this.arcMat = arcMat

    // 翻转瞬间的冲击光环（加法混合）
    this.pulseMat = new THREE.MeshBasicMaterial({
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.325, 64), this.pulseMat)
    this.pulse.position.set(0, 0.16, 0.23)
    this.pulse.visible = false
    this.grp.add(this.pulse)

    // 两侧标签：whale-maid ⇄ default assistant（role:'label' ⇒ 34px 下限由字号守卫管）
    const lab = (s, col) =>
      textPlane(s, { role: 'label', height: 0.062, weight: 700, family: 'code', color: col, glow: 0.35, align: 'center' })
    this.labA = lab('whale-maid', '#9fe8ff')
    this.labB = lab('default assistant', '#ffd479')
    this.labA.mesh.position.set(-0.62, -0.11, 0.24)
    this.labB.mesh.position.set(0.62, -0.11, 0.24)
    this.grp.add(this.labA.mesh, this.labB.mesh)

    /* ---------- T20b①：天空（昼夜两片，随钟表的分钟数交叉淡入淡出） ---------- */
    const skyGrad = (a, b) => {
      const cv = document.createElement('canvas')
      cv.width = 8
      cv.height = 128
      const c = cv.getContext('2d')
      const gr = c.createLinearGradient(0, 0, 0, 128)
      gr.addColorStop(0, a)
      gr.addColorStop(1, b)
      c.fillStyle = gr
      c.fillRect(0, 0, 8, 128)
      const tx = new THREE.CanvasTexture(cv)
      tx.colorSpace = THREE.SRGBColorSpace
      return tx
    }
    this.skyDayMat = new THREE.MeshBasicMaterial({
      map: skyGrad('#ffb066', '#7fc4ff'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
    this.skyNightMat = new THREE.MeshBasicMaterial({
      map: skyGrad('#0a1430', '#05070f'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
    const skyGeo = new THREE.PlaneGeometry(9, 5.4)
    this.skyDay = new THREE.Mesh(skyGeo, this.skyDayMat)
    this.skyNight = new THREE.Mesh(skyGeo, this.skyNightMat)
    this.skyDay.renderOrder = -5
    this.skyNight.renderOrder = -6
    this.grp.add(this.skyNight, this.skyDay)

    /* ---------- T20b②：3D 钟表（§5-4 第 4 件） ---------- */
    const dialMat = new THREE.MeshStandardMaterial({ color: 0x101a26, roughness: 0.5, metalness: 0.35 })
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 56), dialMat)
    dial.rotation.x = Math.PI / 2
    this.grp.add(dial)
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.012, 6, 64), rimMat)
    this.grp.add(clockRim)
    this.rimMat = rimMat
    // 12 个小时刻度（实例化）
    const tickMat = new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0.85 })
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.075, 0.012), tickMat, 12)
    const M4 = new THREE.Matrix4()
    const Q = new THREE.Quaternion()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      M4.compose(
        new THREE.Vector3(Math.sin(a) * 0.47, Math.cos(a) * 0.47, 0.035),
        Q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -a),
        new THREE.Vector3(1, 1, 1)
      )
      ticks.setMatrixAt(i, M4)
    }
    ticks.instanceMatrix.needsUpdate = true
    this.grp.add(ticks)
    this.ticks = ticks
    // 两条指针（各自一个 pivot，绕 z 轴转）
    const handMat = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 })
    this.handHour = new THREE.Group()
    this.handMin = new THREE.Group()
    const mk = (len, w, col, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.015), handMat(col))
      m.position.y = len / 2 - 0.02 + y
      return m
    }
    this.handHour.add(mk(0.30, 0.045, '#ffd479', 0))
    this.handMin.add(mk(0.46, 0.028, '#9fe8ff', 0))
    this.handHour.position.set(0, 0, 0.05)
    this.handMin.position.set(0, 0, 0.062)
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), handMat('#ffffff'))
    this.grp.add(this.handHour, this.handMin, hub)
    // 钟表整体挂在一个子组上（便于"开关在下方、钟表在上方"的错位）
    this.clockGrp = new THREE.Group()
    this.clockGrp.position.set(0, 0.22, 0)
    // 把表盘相关物件从 grp 挪进 clockGrp（保持其余不动）
    for (const o of [dial, clockRim, ticks, this.handHour, this.handMin, hub]) {
      this.grp.remove(o)
      this.clockGrp.add(o)
    }
    this.grp.add(this.clockGrp)
    // 钟面数字（07 / 19）用文字面片给出"一整天"，字号走 role:'label'
    this.clockLabel = textPlane('07:00 → 19:00', { role: 'label', height: 0.062, weight: 700, family: 'code', color: '#dfefff', glow: 0.3 })
    this.clockLabel.mesh.position.set(0, -0.72, 0.06)
    this.clockGrp.add(this.clockLabel.mesh)

    /* ---------- T20b③：终端屏在侧带（§3 段 G 的 7 条台词，L/R 两个侧带各一块） ---------- */
    const paneL = createTermPane({ session: '#G/L', side: 'L' })
    const monL = createMonitor({ pane: paneL, width: 0.82, shell: 'flat', glow: 0.32, tag: 'G:left', seg: 'G', anchor: 'switch1' })
    const paneR = createTermPane({ session: '#G/R', side: 'R' })
    const monR = createMonitor({ pane: paneR, width: 0.82, shell: 'flat', glow: 0.32, tag: 'G:right', seg: 'G', anchor: 'am' })
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(monL.object, monR.object)
    this.paneL = paneL
    this.paneR = paneR
    this.monL = monL
    this.monR = monR
    this.recL = ctx.stageRoles ? monL.registerWith(ctx.stageRoles) : null
    this.recR = ctx.stageRoles ? monR.registerWith(ctx.stageRoles) : null
    this.lastKeyL = ''
    this.lastKeyR = ''

    /* ---------- T20c：画面分身（同一 3D 场景的第二份，材质各自克隆以便单独染色） ---------- */
    // §7 G：「恍惚 = **同一 3D 场景**两套配色高频交替 + **画面分身**」。
    // 分身就是把**同一个场景**（底板/拨杆/表盘）再挂一份，材质 clone 出来后单独染色与压透明。
    this.ghostGrp = new THREE.Group()
    this.ghostGrp.visible = false
    this.grp.add(this.ghostGrp)
    // 分身只拷贝**开关本体**（底板/拨杆/面板沿）—— 钟表有自己的节拍（94.3–95.2），
    // 不该在恍惚里以"分身的一部分"重新冒出来。
    const ghostSrc = [base, lip, this.lever]
    this.ghostParts = []
    for (const src of ghostSrc) {
      const c = src.clone(true)
      c.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone()
          o.material.transparent = true
          o.material.opacity = 0.5
          o.material.depthWrite = false
          this.ghostParts.push(o.material)
        }
      })
      this.ghostGrp.add(c)
    }

    // 机位上用的暂存（避免每帧新建）
    this._fwd = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._up = new THREE.Vector3()
    this.metrics = { flips: 0, leverZ: 0, switchH: 0 }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const haze = span(t, 99.6, 100.6)
    const collapse = span(t, 103.3, 103.5)

    // ---- T20a：3D 开关（§7「巨大的 3D 开关一词一翻」）----
    const flips = this.flipsAt(t, ctx)
    const times = this.flipTimes(ctx)
    // 开关在场窗口：段首弹入 → 恍惚（99.4）前退场（与 DIRECTOR 的 1:32.1/1:39.6 切点一致）
    const swIn = clamp(span(t, 88.8, 89.5))
    // T20c：§7 G 的恍惚要「**同一 3D 场景**两套配色高频交替」——所以开关**不再在 99.4 退场**，
    // 而是留到测量坍缩（103.4 闪白）才收；恍惚期间它就在原地被两套配色刷。
    const swOut = 1 - clamp(span(t, 103.15, 103.45))
    const swA = swIn * swOut
    if (this.grp) {
      this.grp.visible = true
      const cam = ctx.three.camera
      this._fwd.set(0, 0, -1).applyQuaternion(cam.quaternion)
      this._right.set(1, 0, 0).applyQuaternion(cam.quaternion)
      this._up.set(0, 1, 0).applyQuaternion(cam.quaternion)
      // T20b：钟表在场时把开关**压到画面下方并缩小**，两个"巨大"物件不同框抢中心
      const tAmX = ctx.cues.sec('G', 'am', 94.314)
      const tPmX = ctx.cues.sec('G', 'pm', 95.243)
      const clockPush = clamp(span(t, tAmX - 0.25, tAmX + 0.45)) * (1 - clamp(span(t, tPmX + 0.7, tPmX + 1.5)))
      this.grp.position.copy(cam.position).addScaledVector(this._fwd, SW_DIST)
      this.grp.position.addScaledVector(this._right, -0.05 * Math.sin(t * 0.33))
      this.grp.position.addScaledVector(this._up, -0.34 * clockPush + 0.02 * Math.sin(t * 0.5))
      this.grp.rotation.y = -this._right.x * 0 + Math.sin(t * 0.27) * 0.06
      this.grp.rotation.z = Math.sin(t * 0.21) * 0.035
      // 入场：outBack 过冲弹入（§0.6 禁线性）
      const pop = swIn > 0 ? 0.72 + 0.28 * outBack(clamp(swIn)) : 0.72
      this.grp.scale.setScalar(pop * (1 - 0.25 * clamp(span(t, 98.9, 99.4))) * (1 - 0.22 * clockPush))
      this.grp.visible = swA > 0.01
      // 拨杆：每次翻转从"中位"甩到新的一侧，带弹簧过冲；两次翻转之间缓慢呼吸
      let last = -1e9
      for (const f of times) if (t >= f) last = f
      const u = clamp((t - last) / 0.62)
      const dir = flips % 2 === 0 ? 1 : -1
      const swing = outElastic(clamp(u))
      const breathe = 0.02 * Math.sin(t * 1.7)
      this.lever.rotation.z = dir * 0.44 * swing + breathe
      // 翻转瞬间：金属更亮 + 冲击光环炸开
      const kick = Math.exp(-Math.pow((t - last) * 6, 2))
      this.leverMat.emissiveIntensity = 1.35 + 1.6 * kick
      this.arcMat.opacity = (0.55 + 0.45 * Math.abs(Math.sin(t * 0.9))) * swA
      const pu = clamp(span(t, last, last + 0.5))
      this.pulse.visible = kick > 0.02 && swA > 0.02
      if (this.pulse.visible) {
        this.pulse.scale.setScalar(0.25 + 1.5 * outCubic(pu))
        this.pulseMat.opacity = 0.7 * (1 - pu)
      }
      const litA = flips % 2 === 0 ? 1 : 0.25
      this.labA.material.opacity = swA * litA
      this.labB.material.opacity = swA * (1 - litA) + swA * 0.25
      this.metrics = { flips, leverZ: +this.lever.rotation.z.toFixed(3), switchH: +this.grp.scale.x.toFixed(2) }
    }

    // 背景：深蓝量子段
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex(C.bg0, '#050b1c', haze)
      g.fillRect(0, 0, W, H)
    }
    if (haze > 0.01) {
      const rg = g.createRadialGradient(W / 2, H * 0.46, 20, W / 2, H * 0.46, H * 1.05)
      rg.addColorStop(0, rgba('#1b3a7a', 0.45 * haze))
      rg.addColorStop(0.6, rgba('#0a1c3c', 0.3 * haze))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
      // ⚠️ T20c 删除：原来的 `drawWavePackets()` + `drawRadialSpiral()`（2D 波包/放射线螺旋）
      // 已整段删除 —— §7 G 要求恍惚是「**同一 3D 场景**两套配色高频交替 + 画面分身」，
      // 主体不该是两块 2D 涂鸦；它们的位置由 3D 开关本体 + 分身承担（见下面的 trance 块）。
    } else if (!ctx.bgIs3d) {
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 1:32.1 窗口四散（自由）----
    // T20a：退场提前到 93.85（表盘 93.9 起）—— 两个节拍不同框，避免"窗口文字 ∩ 表盘标签"
    const scatter = span(t, 92.1, 92.8) * (1 - span(t, 93.4, 93.85))
    if (scatter > 0.01) drawScatteredWindows(g, ctx, t, scatter)

    // ---- T20b：终端屏在侧带（§3 段 G 的 7 条台词，L/R 两侧各一块；只显示各自那一侧的行）----
    const tFlip1 = ctx.cues.sec('G', 'flip1', 88.788)
    const tWhatever = ctx.cues.sec('G', 'whatever', 92.963)
    const tAm0 = ctx.cues.sec('G', 'am', 94.314)
    const tPm0 = ctx.cues.sec('G', 'pm', 95.243)
    const tRole = ctx.cues.sec('G', 'role', 97.061)
    if (this.paneL && this.paneR) {
      const rowsL = [{ kind: 'you', text: '/persona toggle' }]
      if (t >= tFlip1 + 0.5) rowsL.push({ kind: 'tool', text: 'persona: whale ⇄ default' })
      if (t >= tWhatever) rowsL.push({ kind: 'deepseek', text: '都行，听你的。' })
      if (t >= tRole) rowsL.push({ kind: 'you', text: '/role swap' })
      if (t >= tRole + 0.5) rowsL.push({ kind: 'tool', text: 'role: assistant ⇄ companion' })
      const rowsR = [{ kind: 'tool', text: '⚙ clock.set(07:00 → 19:00)' }]
      if (t >= tPm0 + 0.8) rowsR.push({ kind: 'deepseek', text: '一整天过去了。' })
      const kL = rowsL.map((r) => r.text).join('|')
      const kR = rowsR.map((r) => r.text).join('|')
      if (kL !== this.lastKeyL) {
        this.lastKeyL = kL
        this.paneL.setLines(rowsL.slice(0, 7), { session: '#G/L', subtitle: '' })
      }
      if (kR !== this.lastKeyR) {
        this.lastKeyR = kR
        this.paneR.setLines(rowsR.slice(0, 7), { session: '#G/R', subtitle: '' })
      }
      // 位置：**只在侧带**（x≈±0.86·halfW，d=2.8）——与段 F 的 pane 同一手法
      const cam0 = ctx.three.camera
      const d0 = 2.8
      const halfH0 = d0 * Math.tan(((cam0.fov || 40) * Math.PI) / 180 / 2)
      const halfW0 = halfH0 * (cam0.aspect || 16 / 9)
      this.monL.object.position.set(cam0.position.x - 0.86 * halfW0, cam0.position.y, cam0.position.z - d0)
      this.monR.object.position.set(cam0.position.x + 0.86 * halfW0, cam0.position.y, cam0.position.z - d0)
      const appearAt = tFlip1 - 0.4
      this.paneL.tick(t, { appearAt, parallax: { x: 0, y: 0 }, glitch: 0 })
      this.paneR.tick(t, { appearAt: tAm0 - 0.5, parallax: { x: 0, y: 0 }, glitch: 0 })
      this.paneL.flush()
      this.paneR.flush()
      const paneA = clamp(span(t, tFlip1 - 0.4, tFlip1 + 0.2)) * (1 - clamp(span(t, 98.9, 99.5)))
      this.monL.object.visible = paneA > 0.01
      this.monR.object.visible = paneA > 0.01
    }

    // ---- T20b：3D 钟表（§5-4：分针 = T/60×360°、时针 = T/720×360°，12:1）----
    // T 从 07:00(=420min) 扫到 19:00(=1140min)：§3 的 `clock.set(07:00 → 19:00)`
    const T = CLOCK_T0 + (CLOCK_T1 - CLOCK_T0) * clamp((t - tAm0) / Math.max(0.05, tPm0 - tAm0))
    const hd = clockHands(T)
    const clockA = clamp(span(t, tAm0 - 0.25, tAm0 + 0.35)) * (1 - clamp(span(t, tPm0 + 0.9, tPm0 + 1.7)))
    if (this.clockGrp) {
      this.clockGrp.visible = clockA > 0.01
      if (this.clockGrp.visible) {
        const cam = ctx.three.camera
        this.clockGrp.parent.position.copy(cam.position).addScaledVector(this._fwd, SW_DIST)
        this.clockGrp.scale.setScalar(0.7 + 0.3 * outBack(clamp(clockA)))
        this.clockGrp.rotation.y = Math.sin(t * 0.3) * 0.12
        this.handMin.rotation.z = -hd.minute
        this.handHour.rotation.z = -hd.hour
        const ph = clamp((T - CLOCK_T0) / (CLOCK_T1 - CLOCK_T0))
        const dayness = Math.sin(Math.PI * ph)
        this.skyDayMat.opacity = clockA * (0.05 + 0.2 * dayness)
        this.skyNightMat.opacity = clockA * (0.32 - 0.18 * dayness)
        this.skyDayMat.color.set(mixHex('#ff9a4a', '#cfe8ff', dayness))
        this.skyDay.position.copy(cam.position).addScaledVector(this._fwd, SW_DIST + 3.4)
        this.skyNight.position.copy(cam.position).addScaledVector(this._fwd, SW_DIST + 3.6)
        this.metrics.clock = { T: +T.toFixed(2), hour: +hd.hour.toFixed(4), minute: +hd.minute.toFixed(4), ratio: +(clockHands(T + 1).hour - hd.hour) / (clockHands(T + 1).minute - hd.minute) }
      } else {
        this.skyDayMat.opacity = 0
        this.skyNightMat.opacity = 0
      }
    }

    // ⚠️ T20b 删除：原来的 2D `drawDayNightDial()`（昼夜两半 + **一根**指针、"day ⇄ night" 文字）
    // 已整段删除 —— §5-4 要的是 **3D 钟表 + 12:1 的指针逻辑**，上面那份实现取代它。

    /* ================= T20c：恍惚（§7 G「**同一 3D 场景**两套配色高频交替 + **画面分身**」） =================
     * 口径：恍惚窗口 = `trance1`(101.673) 前 2s 起（≈99.67，与 DIRECTOR 的 1:39.6 对上）→ 坍缩闪白 103.4。
     * ① **两套配色高频交替**：`pal = floor(t*8) % 2` ⇒ **8 Hz**（"高频"），逐帧把同一批材质刷成
     *    A（青紫：#7fe0ff / #bfe6ff / #2f7fa8）或 B（琥珀红：#ffb454 / #ffd9a0 / #a85a1f）。
     * ② **画面分身**：`this.ghostGrp` 是同一场景（底板/拨杆/表盘）的第二份（材质 clone 过），
     *    用**另一套配色**染色、横向偏移 ±0.32 并随相位轻微错开 —— 读作"两个她/两套世界"。
     */
    const tranceA = clamp(span(t, 99.67, 100.3)) * (1 - clamp(span(t, 103.2, 103.42)))
    if (this.ghostGrp) {
      const PAL = [
        { key: '#7fe0ff', metal: '#bfe6ff', emis: '#2f7fa8', lab: '#9fe8ff' },
        { key: '#ffb454', metal: '#ffd9a0', emis: '#a85a1f', lab: '#ffd479' },
      ]
      const pi = Math.floor(Math.max(0, t) * 8) % 2
      const A = PAL[pi]
      const B = PAL[1 - pi]
      if (tranceA > 0.01) {
        this.leverMat.color.set(A.metal)
        this.leverMat.emissive.set(A.emis)
        this.arcMat.color.set(A.key)
        this.pulseMat.color.set(A.key)
        this.rimMat.color.set(A.key)
        this.labA.material.color.set(A.lab)
        this.labB.material.color.set(A.lab)
      } else {
        this.leverMat.color.set('#bfe6ff')
        this.leverMat.emissive.set('#2f7fa8')
        this.arcMat.color.set('#7fe0ff')
        this.rimMat.color.set('#8fd8ff')
        this.labA.material.color.set('#9fe8ff')
        this.labB.material.color.set('#ffd479')
      }
      this.ghostGrp.visible = tranceA > 0.02
      if (this.ghostGrp.visible) {
        const cam = ctx.three.camera
        this.ghostGrp.position.copy(cam.position).addScaledVector(this._fwd, SW_DIST + 0.06)
        this.ghostGrp.position.addScaledVector(this._right, (pi ? 0.32 : -0.32) * (0.4 + 0.6 * tranceA))
        this.ghostGrp.rotation.z = (pi ? 1 : -1) * 0.05
        this.ghostGrp.scale.setScalar(0.96)
        for (const m of this.ghostParts) {
          if (m.color) m.color.set(B.key)
          if (m.emissive) m.emissive.set(B.emis)
          m.opacity = 0.5 * tranceA
        }
        this.metrics.trance = { pal: pi, hz: 8, a: +tranceA.toFixed(3), ghostOpacity: +(0.5 * tranceA).toFixed(3), colorA: A.key, colorB: B.key, off: +(pi ? 0.32 : -0.32).toFixed(2) }
      } else {
        this.metrics.trance = { pal: pi, hz: 8, a: 0, ghostOpacity: 0, colorA: A.key, colorB: B.key, off: 0 }
      }
    }

    // 坍缩亮点
    if (collapse > 0.01) {
      const r = 8 + 34 * collapse
      g.save()
      g.globalAlpha = 1
      const rg = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, r * 3)
      rg.addColorStop(0, 'rgba(255,255,255,1)')
      rg.addColorStop(0.4, rgba(C.cyan, 0.6))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = rg
      g.beginPath()
      g.arc(W / 2, H * 0.5, r * 3, 0, TAU)
      g.fill()
      g.restore()
    }
  },

  dispose() {
    if (this.leverMat) this.leverMat.dispose()
    if (this.arcMat) this.arcMat.dispose()
    if (this.pulseMat) this.pulseMat.dispose()
    if (this.labA) this.labA.dispose()
    if (this.labB) this.labB.dispose()
  },
}

/* ---------------- 窗口四散（T20c 会 3D 化） ----------------
 * ⚠️ T20a：字号抬到 §2.3 的 **34px** 后，原来"从中心向外发散"的布局会让 9 个窗口（连文字）
 * 在动画早期挤在一起（实测 t=92.2 报 5 处重叠、95.2/95.4 与表盘标签重叠）。
 * 改成**按 3×3 格点定位**（格距 640×360 ≫ 窗口 360×200），只做"从中心向外的小幅漂移（±20px）
 * + 逐个点亮"—— 于是相邻窗口的文字**在结构上**不可能相交（与 i_cleanup 的格点做法同一思路）。
 * 同时把它的退场提前到表盘之前（两个 DIRECTOR 节拍不再同框）。
 */
function drawScatteredWindows(g, ctx, t, a) {
  const { W, H } = ctx
  const PW = 360
  const PH = 200
  const cw = W / 3
  const chh = H / 3
  g.save()
  for (let i = 0; i < 9; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const cx = cw * (col + 0.5)
    const cy = chh * (row + 0.5)
    // 逐个点亮（纯函数：每个窗口有自己的起始偏移）
    const st = 92.1 + i * 0.028
    const u = clamp(span(t, st, st + 0.35))
    if (u <= 0.01) continue
    const drift = 20 * (1 - outCubic(u))
    const ang = hash01(i, 81) * TAU
    const x = cx + Math.cos(ang) * drift - PW / 2
    const y = cy + Math.sin(ang) * drift - PH / 2
    g.globalAlpha = a * u
    roundRect(g, x, y, PW, PH, 10)
    g.fillStyle = 'rgba(30,34,44,0.92)'
    g.fill()
    g.strokeStyle = rgba(C.cyan, 0.5)
    g.lineWidth = 1.5
    g.stroke()
    // §2.3 / §0.5：面板类文字下限 34px（旧实现是 11px，低于下限）
    g.font = MONO(34, 500)
    g.fillStyle = C.fgDim
    g.textAlign = 'left'
    g.textBaseline = 'top'
    g.fillText(`win ${i + 1}`, x + 20, y + 22)
    g.fillText('free', x + 20, y + 22 + 48)
  }
  g.restore()
}
