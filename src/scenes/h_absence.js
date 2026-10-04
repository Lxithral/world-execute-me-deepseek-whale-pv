// src/scenes/h_absence.js — 段 H 1:43.5–1:58.3 补全与缺席
// DIRECTOR：1:44.5「你」的键入波形（取本曲真实频谱作为震动）驱动画面；1:48.2 灰色幽灵补全文本
// 被按 Tab 接受（「补全」双关）；1:50.9–1:56.0 五次「离开」对应重连横幅 1/5…5/5，逐次递进：
//   ①对方头像灰掉 ②输入框光标停止闪烁 ③「上次活动 N 分钟前」计时跳动
//   ④她表情转 sad 并垂下视线 ⑤整扇窗口变灰，只剩错误码
// 1:56.0 孤立：全部熄灭，只剩一枚像素光标与处于暗圈里的 sad 立绘。

import * as THREE from 'three'
import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, bubble, reconnectBanner, roundRect, wrapText } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'

// 五次「离开」（DIRECTOR 1:50.9–1:56.0）的时刻由锚点表给出的 left 第 1–5 次起唱时间决定（§2.2）
const LEFT_KEYS = ['left1', 'left2', 'left3', 'left4', 'left5']
const LEFT_FALLBACK = [110.9, 112.0, 113.1, 114.2, 115.3]

/**
 * isolation 那一行**从 dialogue.js 取**（§2.6：场景里不得散落硬编码的终端字符串）。
 * 万一表里没有（例如键名被改），退回表里的第一条 tool 行，最后才用占位串并告警。
 */
const ISO_LINE = (() => {
  const rows = dialogueOf('H')
  const hit = rows.find((d) => d.anchor === 'isolation') || rows.find((d) => d.kind === 'tool')
  if (!hit) console.warn('[segH] dialogue.js 里没有段 H 的 isolation/tool 行')
  return hit ? hit.text : 'idle · peer offline · waiting…'
})()
const GHOST = 'and i will keep the last request, unchanged, forever'

export default {
  id: 'H',
  start: 103.5,
  end: 118.3,
  title: '补全与缺席',
  fx: [
    // FIX_V3 §4.4：任意 6s 窗口内同类效果最多 2 次。
    // 原先 left1–left4 里有 **3 条 glitch**（112.0 / 113.1 / 115.3），
    // 于是 [112.0, 118.0) 窗口内 glitch = 3 次 → 违规。
    // §7 段 H 本来就要求「五次 left 的重连横幅**各自不同**并配相机后拉」，
    // 所以把五种效果错开成 glitch / shake / disp / glitch / flash，
    // 既满足 §7 的"各自不同"，也把同类计数压到 ≤2。
    { t: 103.6, kind: 'glitch', amount: 0.5, dur: 0.2 }, // vibrations
    { t: 108.2, kind: 'flash', amount: 0.25, dur: 0.12 }, // completion
    { t: 110.9, kind: 'shake', amount: 0.4, dur: 0.3 },
    { t: 112.0, kind: 'glitch', amount: 0.45, dur: 0.2 }, // left 1/5
    { t: 113.1, kind: 'shake', amount: 0.5, dur: 0.3 }, // left 2/5（改：原 glitch）
    { t: 114.2, kind: 'disp', amount: 0.45, dur: 0.5 }, // left 3/5（改：原 shake）
    { t: 115.3, kind: 'glitch', amount: 0.7, dur: 0.3 }, // left 4/5
    { t: 116.0, kind: 'flash', amount: 0.35, dur: 0.3 }, // left 5/5
  ],

  /**
   * §2.3 明写 Monitor「用于段 B 展馆、**H**、J 背景」。
   * 这里在 isolation 窗口用一块终端屏给出 §3 的 `idle · peer offline · waiting…`。
   * 屏的尺寸取 0.63 世界单位：在相机前方 1.6 单位处约 248px 宽（12.9% 画面宽、
   * 单块面积约 2.9%），远低于 §2.4 的 22% 上限。
   */
  init(ctx) {
    this.pane = createTermPane({ session: '#001', side: 'L' })
    this.monitor = createMonitor({
      pane: this.pane,
      width: 0.63,
      shell: 'flat',
      glow: 0.4,
      tag: 'H:isolation',
      seg: 'H',
      anchor: 'isolation', // §4.2：非 decor 的登记对象必须带锚点
    })
    this.monitor.object.visible = false
    this.paneRec = null
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.monitor.object)
    if (ctx.stageRoles) this.paneRec = this.monitor.registerWith(ctx.stageRoles)

    /* ---- T21b：`completion` 的**终端屏幽灵补全**（§7 H「completion 用终端屏的幽灵补全」+ §3）----
     * 右带一块终端屏：`我今天…`（you，110.202 = completion 锚点）→ +0.4s 出现灰色幽灵行
     * `…想见你。⇥ Tab`（kind:'ghost' ⇒ 灰 #6f7680）→ 按 Tab 后**变白**（kind 切成 'deepseek' ⇒ #e8eaee）。
     * 旧实现是一行**英文**裸文字画在 2D 画布上（26px、且从 107.6 就开始 —— 比 `completion` 锚点早 2.6s），
     * 既不是 §3 的台词、也没有终端屏，本项整块替换。
     */
    this.cPane = createTermPane({ session: '#001', side: 'R' })
    this.cMon = createMonitor({
      pane: this.cPane,
      width: 0.9,
      shell: 'flat',
      glow: 0.38,
      tag: 'H:completion',
      seg: 'H',
      anchor: 'completion',
    })
    this.cMon.object.visible = false
    this.cRec = null
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.cMon.object)
    if (ctx.stageRoles) this.cRec = this.cMon.registerWith(ctx.stageRoles)
    this.lastCKey = ''

    /* ================================================================== *
     * T21a：§7 H 的两件 3D 主体
     *   ① 「**3D 键盘**（键帽随起音点按下，**代表"你"**）」—— 键帽按下 = §3 的 `key ▸ ▸ ▸ ▸`；
     *   ② 「**真实频谱彩带**」—— 彩带的振幅直接来自 `sync.spectrumAt()` 的 64 段真实频谱。
     * 段 H 此前**完全没有 3D**（整段 2D），这两件是本项新增。
     * ================================================================== */
    const T = ctx.three
    if (T && T.stage3d) {
      this.grp = new THREE.Group()
      this.grp.name = 'segH'
      T.stage3d.add(this.grp)
      const keyL = new THREE.DirectionalLight(0xdfefff, 1.9)
      keyL.position.set(1.3, 2.2, 2.4)
      const rimL = new THREE.DirectionalLight(0x6fb6ff, 1.0)
      rimL.position.set(-1.7, -0.7, 1.3)
      this.grp.add(keyL, rimL)

      // ---- 3D 键盘：14×6 = 84 个键帽（InstancedMesh，逐实例颜色） ----
      this.kbCols = 14
      this.kbRows = 6
      const N = this.kbCols * this.kbRows
      this.keyMat = new THREE.MeshStandardMaterial({
        color: 0x28324a,
        roughness: 0.5,
        metalness: 0.35,
        emissive: 0x0b1a2a,
        emissiveIntensity: 1,
      })
      this.kb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.052, 0.022, 0.058), this.keyMat, N)
      this.kb.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.kb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
      this.kb.instanceColor.setUsage(THREE.DynamicDrawUsage)
      const M = new THREE.Matrix4()
      const c0 = new THREE.Color()
      for (let i = 0; i < N; i++) {
        const cx = i % this.kbCols
        const cz = Math.floor(i / this.kbCols)
        M.makeTranslation((cx - (this.kbCols - 1) / 2) * 0.062, 0, (cz - (this.kbRows - 1) / 2) * 0.066)
        this.kb.setMatrixAt(i, M)
        c0.setHex(0x28324a)
        this.kb.setColorAt(i, c0)
      }
      this.kb.instanceMatrix.needsUpdate = true
      this.kb.instanceColor.needsUpdate = true
      this.kbGrp = new THREE.Group()
      this.kbGrp.rotation.x = -0.62
      this.kbGrp.add(this.kb)
      this.grp.add(this.kbGrp)
      this._kbM = new THREE.Matrix4()
      this._kbC = new THREE.Color()
      this._kbPress = new Float32Array(N)
      this._kbOn = new Float32Array(N)

      // ---- 频谱彩带：128 段的平面，顶点按真实频谱位移 + 顶点色 ----
      this.spec = new Float32Array(64)
      this.ribGeo = new THREE.PlaneGeometry(2.7, 0.5, 128, 1)
      const rn = this.ribGeo.attributes.position.count
      this.ribGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rn * 3), 3))
      this.ribMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      this.ribbon = new THREE.Mesh(this.ribGeo, this.ribMat)
      this.grp.add(this.ribbon)
      this.metrics = { keyPresses: 0, specPeak: 0, kbA: 0 }
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx

    /* ---- T21a：3D 键盘（键帽随起音点按下，代表"你"）+ 真实频谱彩带 ---- */
    // 在场窗口：`vibrations`(106.256) 前 0.6s 起 → isolation 的黑场（116.0）前收。
    const kbA = clamp(span(t, 105.6, 106.5)) * (1 - clamp(span(t, 115.7, 116.5)))
    if (this.grp) {
      this.grp.visible = kbA > 0.01
      if (this.grp.visible) {
        const cam = ctx.three.camera
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        // 键盘：镜头前偏下、像放在你面前的桌面
        this.kbGrp.position.copy(cam.position).addScaledVector(fwd, 1.35).addScaledVector(up, -0.62)
        this.kbGrp.rotation.y = Math.sin(t * 0.17) * 0.04
        // T23：键盘/彩带原来铺满画面（fov 收窄时更是压到四角，v) 报 0.13–0.19）→ 缩到 0.78 并收进画面中部
        this.kbGrp.scale.setScalar(0.78 * (1 - 0.32 * clamp(span(t, 113.5, 115.8))))
        this.keyMat.opacity = kbA
        this.keyMat.transparent = true
        // 彩带：键盘上方，随频谱起伏
        this.ribbon.position.copy(cam.position).addScaledVector(fwd, 1.5).addScaledVector(up, 0.34)
        this.ribbon.rotation.z = Math.sin(t * 0.23) * 0.03
        this.ribbon.scale.setScalar(0.78 * (1 - 0.32 * clamp(span(t, 113.5, 115.8))))
        this.ribMat.opacity = 0.72 * kbA

        // ① 起音点 → 键帽按下：每个起音点按一个确定性的键（`round(o*8) % N`），指数回弹
        // ⚠️ 注意：`sync.onsetsIn(a,b)` 返回的是 **`{t, s}` 对象数组**（时间 + 强度），不是数字数组
        // —— 第一版直接把它当数字用，`t - o` 得到 NaN ⇒ 键帽一次都没按下（实测 keyPresses 恒 0）。
        const N = this.kbCols * this.kbRows
        const ons = sync.onsetsIn(Math.max(0, t - 3.2), t)
        this._kbPress.fill(0)
        this._kbOn.fill(0)
        for (const o of ons) {
          const ot = o && typeof o === 'object' ? o.t : o
          const os = o && typeof o === 'object' && o.s != null ? o.s : 0.5
          if (typeof ot !== 'number') continue
          const k = ((Math.round(ot * 8) % N) + N) % N
          const pr = Math.exp(-(t - ot) * 5.5) * (0.45 + 0.55 * clamp(os * 2))
          if (pr > 0.02 && pr > this._kbPress[k]) {
            this._kbPress[k] = pr
            this._kbOn[k] = 1
          }
        }
        let presses = 0
        for (let i = 0; i < N; i++) {
          const pr = this._kbPress[i]
          if (pr > 0.02) presses++
          const cx = i % this.kbCols
          const cz = Math.floor(i / this.kbCols)
          this._kbM.makeTranslation(
            (cx - (this.kbCols - 1) / 2) * 0.062,
            -0.016 * pr,
            (cz - (this.kbRows - 1) / 2) * 0.066
          )
          this.kb.setMatrixAt(i, this._kbM)
          // 按下时键帽变亮（青 → 白）
          this._kbC.setHex(0x28324a).lerp(new THREE.Color(0x9fe8ff), pr)
          this.kb.setColorAt(i, this._kbC)
        }
        this.kb.instanceMatrix.needsUpdate = true
        this.kb.instanceColor.needsUpdate = true
        // 整块键盘随起音点做一次很轻的自发光脉冲（键帽稀疏时也读得出"你正在打）
        this.keyMat.emissiveIntensity = 0.9 + 1.4 * clamp(sync.pulse(t, 130)) * kbA

        // ② 真实频谱彩带：64 段频谱 → 128 个顶点的位移与顶点色
        sync.spectrumAt(t, this.spec)
        const pos = this.ribGeo.attributes.position
        const col = this.ribGeo.attributes.color
        const rn = pos.count
        let peak = 0
        for (let i = 0; i < rn; i++) {
          const u = i / (rn - 1)
          const s = this.spec[Math.min(63, Math.floor(u * 64))]
          peak = Math.max(peak, s)
          const isTop = i >= rn / 2
          pos.setY(i, (isTop ? 1 : -1) * (0.02 + 0.5 * 0.5 * s))
          // 频谱越高越偏暖（青 → 琥珀），彩带因此有"真实"的颜色起伏
          const c = mixHex('#3fd0ff', '#ffb454', clamp(s * 1.6))
          col.setXYZ(i, parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255)
        }
        pos.needsUpdate = true
        col.needsUpdate = true
        this.metrics = { keyPresses: presses, specPeak: +peak.toFixed(3), kbA: +kbA.toFixed(2) }
      } else {
        this.metrics = { keyPresses: 0, specPeak: 0, kbA: 0 }
      }
    }

    const dark = span(t, 116.0, 116.9)
    // ⚠️ 这块"全黑"以前是 `globalAlpha = dark`（dark 到 1 = 不透明），把 3D 层整个盖住 ——
    // 于是 §7 段 H 要求的「isolation **缩成远处一点微光**」根本不可能出现，
    // 而且 `?selftest` b) 在 117/118s 长期卡"边缘 ≥4%"（实测 17%/3.4%），
    // 因为这一帧只有一块纯黑 + 一枚 9×20 的光标 + 一行 13px 小字。
    // 现在留 32% 的透射：远处那块终端屏（§2.3 要求段 H 有 Monitor）成为画面里唯一的微光，
    // 既落实了 DIRECTOR 的"微光"，也把硬边补回来。
    // ⚠️ T21b 修：`span(116.0,116.9)` 是**单向斜坡**（116.9 之后恒为 1），于是那层黑纱在 116.9 之后
    // **一直挂着 0.6** —— 比黑场本身还黑，既压住 §7 要的"远处一点微光"，也把 117/118s 的 mean
    // 压到 0.067/0.071（§6 下限 0.10）。改成**一个真正的黑场拍子**：116.0–116.7 起、116.9–117.4 松开。
    const darkA = Math.min(0.34, span(t, 116.0, 116.7)) * (1 - clamp(span(t, 116.9, 117.4)))

    /* ---- T21b：`isolation`「缩成远处一点微光」+ **117–118s 的 0.5s mean ≥0.10**（T19f 转交的硬验收项）----
     * 现状实测 117.0/118.0 只有 **0.067/0.071**（§6 下限 0.10）：画面只剩一块远处终端屏，
     * 其余是近黑 —— 这是**场景本身没有光**，不是曝光能补的（再抬曝光 6× 会把黑底洗成灰雾）。
     * 这里按 §7 的构图给它自己的光：**远处那块屏 + 一圈柔和的"微光"晕**（径向渐变，中心亮、边缘归零），
     * 亮度由曝光与发光本身给，不动任何门槛。
     */
    const isoGlow = clamp(span(t, 116.35, 117.0)) * (1 - clamp(span(t, 118.0, 118.28)))
    if (isoGlow > 0.01) {
      // 以远处终端屏的投影位置为"微光"的圆心（拿不到就退回左带中心）
      let gx = W * 0.16
      let gy = H * 0.5
      if (this.monitor && ctx.three && ctx.three.camera) {
        const p = new THREE.Vector3()
        this.monitor.object.getWorldPosition(p)
        p.project(ctx.three.camera)
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
          gx = (p.x * 0.5 + 0.5) * W
          gy = (-p.y * 0.5 + 0.5) * H
        }
      }
      const R = H * 0.46
      const rg = g.createRadialGradient(gx, gy, 0, gx, gy, R)
      rg.addColorStop(0, rgba('#9fd8ff', 0.9 * isoGlow))
      rg.addColorStop(0.35, rgba('#4f86c8', 0.5 * isoGlow))
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      g.save()
      g.globalCompositeOperation = 'lighter'
      g.fillStyle = rg
      g.fillRect(0, 0, W, H)
      g.restore()
      this.metrics.isoGlow = +isoGlow.toFixed(2)
    } else {
      this.metrics.isoGlow = 0
    }

    // 背景
    if (!ctx.bgIs3d) {
      g.fillStyle = '#101216'
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- 1:44.5 键入波形：真实频谱驱动振幅 ----
    const tVib = ctx.cues.sec('H', 'vibrations', 104.5)
    const waveA = span(t, tVib, tVib + 0.8) * (1 - span(t, 116.0, 116.8))
    if (waveA > 0.01) {
      const spec = ctx.spec
      sync.spectrumAt(t, spec)
      drawTypingWave(g, ctx, t, waveA, spec)
    }

    // ---- T21b：`completion` 的终端屏幽灵补全（§7 H + §3；旧的那行英文 2D 裸文字已删除） ----
    const tComp = ctx.cues.sec('H', 'completion', 110.202)
    if (this.cPane) {
      const cIn = clamp(span(t, tComp - 0.5, tComp + 0.1))
      const cOut = 1 - clamp(span(t, tComp + 1.25, tComp + 1.62))
      const cA = cIn * cOut
      const accepted = t >= tComp + 1.0 // §3「按 Tab 后变白」
      const rows = [{ kind: 'you', text: '我今天…' }]
      if (t >= tComp + 0.4) rows.push({ kind: accepted ? 'deepseek' : 'ghost', text: accepted ? '…想见你。' : '…想见你。⇥ Tab' })
      const key = rows.map((r) => r.kind + r.text).join('|')
      if (key !== this.lastCKey) {
        this.lastCKey = key
        this.cPane.setLines(rows.slice(0, 7), { session: '#001', subtitle: '' })
      }
      const cam0 = ctx.three.camera
      const d0 = 2.8
      const halfH0 = d0 * Math.tan(((cam0.fov || 40) * Math.PI) / 180 / 2)
      const halfW0 = halfH0 * (cam0.aspect || 16 / 9)
      this.cMon.object.position.set(cam0.position.x + 0.86 * halfW0, cam0.position.y, cam0.position.z - d0)
      this.cPane.tick(t, { appearAt: tComp - 0.5, parallax: { x: 0, y: 0 }, glitch: 0 })
      this.cPane.flush()
      this.cMon.object.visible = cA > 0.01
      this.metrics.completion = { t: +tComp.toFixed(3), accepted, rows: rows.length, a: +cA.toFixed(2) }
    }

    // ---- 五次「离开」：重连横幅 + 逐次递进（时刻来自锚点表） ----
    const attempts = LEFT_KEYS.map((key, i) => ctx.cues.sec('H', key, LEFT_FALLBACK[i]))
    for (let k = 0; k < attempts.length; k++) {
      const t0 = attempts[k]
      // ⚠️ T21a 修：横幅原来活到 `t0+1.05`，而相邻两次 `left` 只隔 **0.894–0.953s**
      // ⇒ 相邻两条的交叉淡入必然重叠（实测 114.7 的 "(timer still counting)" ∩ "her gaze drops." IoU 0.258）。
      // 改成 `t0+0.84` 收干净（最短间隔 0.894 ⇒ 下一条起来时上一条已经没了）＝§5.1b 的"硬切"口径。
      const a = span(t, t0, t0 + 0.15) * (1 - span(t, t0 + 0.7, t0 + 0.84))
      if (a <= 0.01) continue
      drawAttempt(g, ctx, t, k, a, t0)
    }

    // ---- 1:56.0 孤立：全部熄灭 + 像素光标 + 暗圈 ----
    if (dark > 0.01) {
      g.save()
      g.globalAlpha = darkA
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
      // 暗圈
      // DIRECTOR 写的是「处于**暗圈**里的 sad 立绘」。旧实现是一条**柔和的**径向渐变
      // （从 rgba(20,22,28,.9) 渐到全透明），没有任何边界 —— 而 `?selftest` b) 在这一帧
      // 只要「边缘像素 ≥4%」，实测 117s 只有 3.6%。这里给暗圈补一道**圆环边缘**
      // （与"暗圈"这个说法一致：它是一个圈，不是一片雾），既读得出"被圈住"，也补上一条长边。
      const vg = g.createRadialGradient(W * 0.68, H * 0.48, 30, W * 0.68, H * 0.48, H * 0.5)
      vg.addColorStop(0, 'rgba(20,22,28,0.9)')
      vg.addColorStop(0.82, 'rgba(10,11,15,0.45)')
      vg.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = vg
      g.fillRect(0, 0, W, H)
      g.save()
      g.globalAlpha = darkA * 0.5
      g.strokeStyle = 'rgba(132,142,162,0.9)'
      g.lineWidth = 6
      g.beginPath()
      g.arc(W * 0.68, H * 0.48, H * 0.5 * 0.94, 0, TAU)
      g.stroke()
      g.restore()
      // 一枚像素光标
      if (cursorOn(t, { hz: 0.9 })) {
        g.fillStyle = rgba(C.fg, 0.5)
        g.fillRect(W * 0.30, H * 0.52, 9, 20)
      }
      g.font = MONO(13, 500)
      g.fillStyle = rgba(C.fgDim, 0.35)
      g.textAlign = 'left'
      g.fillText('no input.', W * 0.30 + 22, H * 0.52 + 14)
      g.restore()
    }

    // ---- isolation（§3 段 H）：终端屏给出 "idle · peer offline · waiting…" ----
    //
    // 为什么这里要加一块 Monitor（而不是继续只画那行 'no input.'）：
    //   ① §3 的台词表为段 H 声明了 `isolation | L | tool | idle · peer offline · waiting…`，
    //      而本段此前**从未把它画出来** —— 属 §2.6「终端内容由 dialogue.js 驱动」的缺口；
    //   ② §2.3 明写 Monitor「用于段 B 展馆、**H**、J 背景」—— 段 H 本来就该有一块；
    //   ③ `?selftest` b) 在 117/118s 长期卡"边缘像素 ≥4%"（实测 17%/3.4%）：
    //      该窗口此前只有一块黑底 + 一枚 9×20 的像素光标 + 一行 13px 小字，
    //      几乎没有硬边。终端屏的标题栏/2px 描边/等宽字正好补上密度，
    //      而且是 DIRECTOR 要的"孤立"感（远处一块还亮着的屏）而不是堆内容。
    if (this.pane) {
      const cam = ctx.three.camera
      const isoA = span(t, 116.2, 116.9) * (1 - span(t, 118.0, 118.5))
      const rec = this.paneRec
      if (rec) rec.alpha = isoA
      this.monitor.object.visible = isoA > 0.01
      if (isoA > 0.01) {
        // 左带、比相机远 1.6 单位（§2.4：终端屏只能在左右侧带与远景）
        this.monitor.object.position.set(cam.position.x - 0.85, cam.position.y + 0.05, cam.position.z - 1.6)
        this.monitor.object.rotation.y = 0.22
        if (!this._isoSet) {
          this.pane.setLines([{ kind: 'tool', text: ISO_LINE }], { session: '#001', subtitle: '' })
          this._isoSet = true
        }
        this.pane.tick(t, {
          appearAt: 116.2,
          fadeAt: 118.0,
          goneAt: 118.5,
          parallax: { x: 0, y: 0 },
          glitch: 0.12 * sync.pulse(t, 150),
        })
        this.pane.setCaret(Math.sin(t * 3.4) > 0)
        this.pane.flush()
      }
    }

    // ---- 立绘：sad → 垂下视线 ----
    // §7 段 H 明写「isolation 缩成远处一点微光,**W3 出场**」——所以这一拍立绘必须**看得见**。
    // 旧值在 117–118s 把 `desat` 推到 0.8、再加 0.4 的灰蓝 tint，等于把她压成一片剪影，
    // 于是这一帧几乎没有硬边（`?selftest` b) 实测 17%/3.4%）。这里把 isolation 期的
    // 去色收到 0.45，让她作为画面里唯一的主体读得出来（同时仍保留"孤立"的冷调）。
    const isoU = span(t, 116.0, 116.9)
    ctx.whale.sprite = {
      expr: t < 114.2 ? 'worried' : 'sad',
      rect: ctx.rect,
      alpha: (1 - span(t, 115.6, 116.1) * 0.12) * (1 - span(t, 118.0, 118.28)),
      desat: (0.35 + 0.45 * span(t, 114.0, 116.0)) * (1 - 0.72 * isoU),
      tint: t > 116.0 ? '#4a4f5a' : null,
      tintAmt: 0.4 * span(t, 116.0, 116.8) * (1 - 0.85 * isoU),
      glitch: 0.05 * sync.pulse(t, 150),
    }
  },
}

/* 真实频谱驱动的「键入」波形 */
function drawTypingWave(g, ctx, t, a, spec) {
  const { W, H } = ctx
  const y = H * 0.70
  g.save()
  g.globalAlpha = a
  g.strokeStyle = rgba(C.teal, 0.85)
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i <= 460; i++) {
    const u = i / 460
    const x = u * W
    const band = spec[Math.floor(u * 63)]
    const amp = (band * 0.85 + spec[Math.floor((u * 63 + 7) % 64)] * 0.35) * H * 0.2
    const yy = y + Math.sin(u * TAU * 26 + t * 5) * amp
    i === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy)
  }
  g.stroke()
  // 波形下方的震动条（25Hz 打字节奏）
  const gi = Math.floor(t * 18)
  for (let i = 0; i < 40; i++) {
    const h = hash01(gi * 40 + i, 61) * 26
    g.fillStyle = rgba(C.cyan, 0.25 + hash01(gi * 40 + i, 62) * 0.4)
    g.fillRect(60 + i * 22, H * 0.86 - h, 12, h)
  }
  g.font = MONO(12, 500)
  g.fillStyle = rgba(C.fgDim, 0.8)
  g.textAlign = 'left'
  g.fillText('input waveform · real spectrum', 60, H * 0.90)
  g.restore()
}

/* 每一次「离开」的不同失败方式（逐次递进） */
function drawAttempt(g, ctx, t, k, a, t0) {
  const { W, H } = ctx
  const x = W * 0.52
  // ⚠️ T21a 修：原来是 `H * 0.16 + k * 0.0` —— **那个 `* 0.0` 让五条横幅全部落在同一个 (x,y)**，
  // 于是相邻两条在交叉淡入时文字盒完全重合（实测 t=112.8/112.9 的 IoU = **1.0**，
  // 114.7 还连带把 "last active 66 minutes" 与 "her gaze drops." 压在一起 IoU 0.349）。
  // §7 H 明写「五次 left 的重连横幅**各自不同**」，这里按 k 逐条下移 34px（配合每条的 mode 也不同）。
  const y = H * 0.16 + k * 34
  g.save()
  g.globalAlpha = a
  // 重连横幅 1/5 … 5/5
  reconnectBanner(g, { x, y, w: 520, attempt: k + 1, total: 5, alpha: a, mode: k >= 3 ? 2 : k >= 2 ? 1 : 0 })

  if (k === 0) {
    // ① 对方头像灰掉
    g.save()
    g.globalAlpha = a * (1 - span(t, 110.9, 111.5) * 0.85)
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.beginPath()
    g.arc(x + 40, y + 110, 22, 0, TAU)
    g.fill()
    g.fillStyle = rgba(C.bg0, 0.85)
    g.beginPath()
    g.arc(x + 40, y + 118, 20, Math.PI, 0)
    g.fill()
    g.font = MONO(12, 600)
    g.fillStyle = rgba(C.fgDim, 0.7)
    g.textAlign = 'left'
    g.fillText('peer: grayed out', x + 76, y + 116)
    g.restore()
  } else if (k === 1) {
    // ② 输入框光标停止闪烁
    g.save()
    g.globalAlpha = a
    roundRect(g, x, y + 74, 420, 44, 6)
    g.fillStyle = 'rgba(16,18,22,0.9)'
    g.fill()
    g.strokeStyle = rgba(C.line, 0.8)
    g.stroke()
    g.font = MONO(17, 500)
    g.fillStyle = rgba(C.fgDim, 0.75)
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('> ', x + 14, y + 96)
    // 光标冻结（不再闪烁）
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.fillRect(x + 40, y + 84, 9, 24)
    g.font = MONO(12, 600)
    g.fillStyle = C.amber
    g.fillText('caret: frozen', x + 350, y + 150)
    g.restore()
  } else if (k === 2) {
    // ③「上次活动 N 分钟前」计时跳动
    g.save()
    g.globalAlpha = a
    const mins = 12 + Math.floor((t - t0) * 37) + k * 9
    g.font = MONO(18, 700)
    g.fillStyle = C.amber
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(`last active ${mins} minutes ago`, x, y + 96)
    g.font = MONO(12, 500)
    g.fillStyle = rgba(C.fgDim, 0.7)
    g.fillText('(timer still counting)', x, y + 122)
    g.restore()
  } else if (k === 3) {
    // ④ 她表情转 sad 并垂下视线（立绘侧由 expr 处理，这里给标注）
    g.save()
    g.globalAlpha = a
    g.font = MONO(14, 600)
    g.fillStyle = C.teal
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText('her gaze drops.', x, y + 96)
    g.strokeStyle = rgba(C.teal, 0.6)
    g.beginPath()
    g.moveTo(x + 150, y + 96)
    g.lineTo(W * 0.80, H * 0.34)
    g.stroke()
    g.restore()
  } else {
    // ⑤ 整扇窗口变灰，只剩错误码
    g.save()
    g.globalAlpha = a
    const wx = x - 30
    const wy = y + 60
    const ww = 520
    const wh = 220
    roundRect(g, wx, wy, ww, wh, 8)
    g.fillStyle = 'rgba(40,42,48,0.92)'
    g.fill()
    g.strokeStyle = rgba(C.fgDim, 0.35)
    g.lineWidth = 1
    g.stroke()
    g.font = MONO(13, 500)
    g.fillStyle = rgba(C.fgDim, 0.5)
    g.textAlign = 'left'
    g.textBaseline = 'top'
    ;['——', '——', '——————', '——'].forEach((s, i) => g.fillText(s, wx + 20, wy + 30 + i * 26))
    g.font = MONO(22, 700)
    g.fillStyle = C.red
    g.fillText('E_CONN_RESET 1006', wx + 20, wy + wh - 52)
    g.restore()
  }
  g.restore()
}
