// src/scenes/g_glitch.js — 段 G 1:28.8–1:44 切换与恍惚
//
// 规格来源：**FIX_V5 §G（1:29 / 1:33 / 1:34 / 1:40）**。FIX_V3 §7 的「巨大的 3D 开关 + 3D 钟表 +
// 同一 3D 场景两套配色」已被 §G 明确推翻（1:29「删除 3D 大摇杆」、1:34「钟表改为 2D 扁平风格」），
// 因此本文件整体重写为 **2D 矢量**：
//   · 1:29  删 3D 摇杆 / 贯穿左右的"黑条" / 看不清的窗口格；四次 switch（一词一翻）改 2D 矢量，
//           每次一种形式，且外廓 ≥35% 屏宽 —— 胶囊开关(圆形滑块+弹簧位移) · 跷板开关 ·
//           A|B 分段选择器 · 圆形按钮(按下+光环)。
//   · 1:33  删 3×3「Win xx free」窗口格；whatever / 自由 → 发光线条网格(笼)崩断 → 线条散成飘带
//           向四周飞出 + 火花粒子，**不使用文字**。
//   · 1:34  2D 扁平钟表：圆形表盘(r ≈ 0.27H) + 12 刻度 + 12/3/6/9 数字 + 圆头时针/分针 + 中心圆帽；
//           T 从 7:00 扫到 19:00（分针 = T/60×360°、时针 = T/720×360°，保留 12:1 断言）；
//           背景天空渐变（晨→夜，夜里渐显星点），**不画太阳圆盘**。
//   · 1:40  删蓝/橙摇杆与下方长方体；恍惚 = 旋转的螺旋隧道(点状螺旋线) + 中央一个胶囊开关高速抖动；
//           配色按 G6 **只改色相**（本实现 2Hz ≤ 2.5Hz 上限），并保留"画面分身"
//           （同一构图用另一套色相再画一遍 + 横向错位，与原 `disp` 后处理叠加）。
// 保留：L/R 两块终端屏（§G 未要求删除，且 T41/T46 之后已是 34px 可读 —— G1「清晰不了就不放」不适用）。
//   内容改为**台词表的逐字镜像** `dialogueOf('G')`；旧实现里硬编码的两行中文
//   （`都行，听你的。` / `一整天过去了。`）是 T42 英文化时漏掉的残留。
//
// ⚠️ 2D 文字纪律（R5-D5 先例）：本段所有数字/刻度文字都用**裸 `fillText` + 显式 `checkSize`**，
//   不调 `text()` —— `text()` 会把同一个矩形按 role/raw 双重登记，全片扫描会报出 IoU=1 的**假重叠**。
//   因此这些文字的"安全区"由本文件自己保证（见各自的坐标注释 + REVIEW_T47 的实测包围盒）。

import * as THREE from 'three'
import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, TAU, outCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, roundRect } from '../ui/dsh.js'
import { checkSize } from '../ui/text.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'

/* ================================================================== *
 * 指针逻辑（原 T20b 的机器断言口径，§G 1:34 要求"保留 12:1 断言"）
 *
 *   d(分针)/dT = TAU/60   （每 60 分钟一圈）
 *   d(时针)/dT = TAU/720  （每 720 分钟 = 12 小时一圈）
 *   ⇒ ratio = (TAU/720) / (TAU/60) = 1/12 = 0.0833333…
 * 探针用**未取模**的角度在两个 T 上做差分验证（取模后的角度会绕圈，不适合做比值断言）。
 * ================================================================== */
export const CLOCK_RATE_RATIO = (TAU / 720) / (TAU / 60) // = 1/12

/** T（分钟）→ 指针角（弧度，未取模）。§G 1:34 的两条式子的逐字实现。 */
export function clockHands(T) {
  return { minute: (T / 60) * TAU, hour: (T / 720) * TAU }
}

/** §3 段 G：`⚙ clock.set(07:00 → 19:00)` —— 钟表从 7:00 扫到 19:00（一整天过去了） */
export const CLOCK_T0 = 7 * 60
export const CLOCK_T1 = 19 * 60

// 四次开关翻转（FIX_V3 §3 段 G 的词，锚点表给时刻）—— 见 render 里的 flipsAt()。
// 句子时间优先于 DIRECTOR 的绝对秒数（§2.2）。
const FLIP_KEYS = ['flip1', 'flip2', 'flip3', 'flip4']
const FLIP_FALLBACK = [88.8, 90.3, 95.8, 97.7]

/** §G 1:29：每个 2D 开关的外廓宽度（屏宽比例）—— 规格下限 0.35 */
const SW_FRAC = 0.42
/** 开关/钟表的中心 y（屏高比例）—— 在两块侧带终端之间，且远离 y>0.8 的歌词区 */
const SW_CY = 0.44
/** §G 1:34：表盘半径 ≈ 0.27H */
const CLOCK_R_FRAC = 0.27
/** §G 1:40 + G6：恍惚的色相交替频率（Hz）—— 上限 2.5 */
const TRANCE_HZ = 2
/** §G 1:33：笼崩断的起点与时长（whatever = 92.963） */
const CAGE_T0 = 92.95
const CAGE_DUR = 0.8

/** 恍惚的两套色相（亮度刻意接近 —— G6 只允许改色相、且摆幅要小） */
const TRANCE_PAL = [
  { key: '#7fe0ff', key2: '#bfe6ff' },
  { key: '#ffb454', key2: '#ffd9a0' },
]

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

  /** 开关次数（偶数 → A，奇数 → B）；四次 2D 开关各用一次，风格不同 */
  flipsAt(t, ctx) {
    let n = 0
    for (const f of this.flipTimes(ctx)) if (t >= f) n++
    return n
  },

  init(ctx) {
    const T = ctx.three
    if (!T || !T.stage3d) return
    // §G：本段已无 3D 主体（摇杆/黑条/3D 钟表全部删除）。保留一个空的分段组，
    // 让 `stage3d` 里仍有 'segG' 这个"段位节点"（其余段同样以 grp 形式挂载）。
    this.grp = new THREE.Group()
    this.grp.name = 'segG'
    T.stage3d.add(this.grp)

    // 两块**可读**的终端屏留在侧带（§G 未要求删除）：内容 = 台词表逐字镜像
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
    this.chatRows = null
    this.lastKeyL = ''
    this.lastKeyR = ''
    this.metrics = { flips: 0, sw: null, cage: null, clock: null, trance: null }
  },

  render(t, lt, ctx) {
    const { g, W, H } = ctx
    const flips = this.flipsAt(t, ctx)
    const tF = this.flipTimes(ctx)
    const tFlip1 = ctx.cues.sec('G', 'flip1', 88.788)
    const tAm0 = ctx.cues.sec('G', 'am', 94.314)
    const tPm0 = ctx.cues.sec('G', 'pm', 95.243)
    const haze = span(t, 99.6, 100.6)
    const collapse = span(t, 103.3, 103.5)

    // ---- 背景：深蓝量子段（T20c 删掉的 2D 波包/放射线螺旋不再回来；§G 1:40 要的是螺旋隧道，见下） ----
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
    } else if (!ctx.bgIs3d) {
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    /* ================= §G 1:34：2D 扁平钟表 + 天空渐变 =================
     * T 从 07:00(=420min) 扫到 19:00(=1140min)：§3 的 `clock.set(07:00 → 19:00)`。
     * 退场比旧实现早（旧：tPm0+1.7 = 96.94）：flip3 的 A|B 开关在 96.2 进场，
     * 两条"巨大"主体不同框（R8-D3）。 */
    const T = CLOCK_T0 + (CLOCK_T1 - CLOCK_T0) * clamp((t - tAm0) / Math.max(0.05, tPm0 - tAm0))
    const hd = clockHands(T)
    const clockA = clamp(span(t, tAm0 - 0.25, tAm0 + 0.35)) * (1 - clamp(span(t, tPm0 + 0.45, tPm0 + 1.05)))
    const ph = clamp((T - CLOCK_T0) / (CLOCK_T1 - CLOCK_T0))
    const dayness = Math.pow(1 - ph, 0.85) // 晨(1) → 夜(0)
    if (clockA > 0.01) {
      drawSky(g, W, H, t, clockA, dayness)
      drawFlatClock(g, W, H, T, clockA)
    }
    this.metrics.clock = {
      T: +T.toFixed(2),
      hour: +hd.hour.toFixed(4),
      minute: +hd.minute.toFixed(4),
      ratio: +((clockHands(T + 1).hour - hd.hour) / (clockHands(T + 1).minute - hd.minute)).toFixed(6),
      dialR: +(CLOCK_R_FRAC * H).toFixed(1),
      a: +clockA.toFixed(3),
      ph: +ph.toFixed(3),
      dayness: +dayness.toFixed(3),
    }

    /* ================= §G 1:33：发光线条网格(笼)崩断 ================= */
    const cageA = clamp(span(t, CAGE_T0 - 0.12, CAGE_T0 + 0.28)) * (1 - clamp(span(t, 93.9, 94.15)))
    if (cageA > 0.01) drawCageBreak(g, W, H, t, cageA)
    this.metrics.cage = {
      u: +clamp((t - CAGE_T0) / CAGE_DUR).toFixed(3),
      a: +cageA.toFixed(3),
      lines: 9,
    }

    /* ================= §G 1:40：恍惚（螺旋隧道 + 中央胶囊抖动 + 画面分身） ================= */
    const tranceA = clamp(span(t, 99.67, 100.3)) * (1 - clamp(span(t, 103.2, 103.42)))
    const pi = Math.floor(Math.max(0, t) * TRANCE_HZ) % 2
    if (tranceA > 0.01) {
      const off = (pi ? 1 : -1) * W * 0.052
      drawTrancePass(g, W, H, t, tranceA, TRANCE_PAL[pi], 0)
      drawTrancePass(g, W, H, t, tranceA * 0.45, TRANCE_PAL[1 - pi], off)
    }
    this.metrics.trance = {
      pal: pi,
      hz: TRANCE_HZ,
      a: +tranceA.toFixed(3),
      ghost: +(tranceA * 0.45).toFixed(3),
      off: +((pi ? 1 : -1) * 0.052).toFixed(3),
      colorA: TRANCE_PAL[pi].key,
      colorB: TRANCE_PAL[1 - pi].key,
    }

    /* ================= §G 1:29：四个 2D 矢量开关（一词一翻） =================
     * 每个开关：外廓 = SW_FRAC(0.42) 屏宽 ≥ 规格下限 0.35；进场 0.25s、退场 0.2s；
     * `u`（弹簧位移）从**进场时刻**算起 —— 前三次进场就在各自的词上（±0.08s），
     * 第四个（圆形按钮）同理；A|B 分期器在"一整天过去了"之后进场（见 R8-D3）。 */
    const SW = [
      { form: 'capsule', a0: tF[0] - 0.08, a1: tF[1] - 0.05 },
      { form: 'seesaw', a0: tF[1] - 0.08, a1: CAGE_T0 - 0.09 },
      { form: 'segmented', a0: tPm0 + 0.96, a1: tF[3] - 0.1 },
      { form: 'button', a0: tF[3] - 0.08, a1: 99.67 },
    ]
    let swOn = null
    for (const s of SW) {
      const a = clamp(span(t, s.a0, s.a0 + 0.25)) * (1 - clamp(span(t, s.a1 - 0.2, s.a1)))
      if (a <= 0.01) continue
      const u = clamp((t - s.a0) / 0.55)
      if (s.form === 'capsule') drawCapsuleSwitch(g, W, H, u, a)
      else if (s.form === 'seesaw') drawSeesawSwitch(g, W, H, u, a)
      else if (s.form === 'segmented') drawSegmentedSwitch(g, W, H, u, a)
      else drawRoundButton(g, W, H, u, a)
      swOn = { form: s.form, u: +u.toFixed(3), a: +a.toFixed(3), frac: SW_FRAC }
    }
    this.metrics.flips = flips
    this.metrics.sw = swOn

    /* ================= 终端屏在侧带（台词表逐字镜像；§3 段 G 的 7 条台词） ================= */
    if (this.paneL && this.paneR) {
      const all = this.chatRows || (this.chatRows = dialogueOf('G'))
      const rowsL = []
      const rowsR = []
      for (const L of all) {
        if (L.kind === 'cursor') continue
        // note 形如 '88.788（句 #39 t0）' / '95.243+0.8'：锚点实测值优先，note 里的数字只作兜底
        const at = ctx.cues.sec('G', L.anchor, parseFloat(L.note) || 0) + (L.offset || 0)
        if (t < at) continue
        const row = { kind: L.kind, text: L.text }
        if (L.side === 'R') rowsR.push(row)
        else rowsL.push(row)
      }
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
      // 位置：**屏幕边缘锚定**（左屏左缘 28px / 右屏右缘 28px，d=2.8）——与段 F 的 pane 同一手法。
      // 段 G 的相机在 88.8–103.5 之间横移（rig 关键帧），若只按 `cam.x ∓ 0.86·halfW` 放世界坐标，
      // 投影会随相机漂移 → 实测 t=93.3/94.6 左屏左缘被切掉约 100px。这里先用老公式取初值，
      // 再按投影差做一步线性修正，把屏幕边缘钉在 28px。
      const cam0 = ctx.three.camera
      const d0 = 2.8
      const halfH0 = d0 * Math.tan(((cam0.fov || 40) * Math.PI) / 180 / 2)
      const halfW0 = halfH0 * (cam0.aspect || 16 / 9)
      const MARGIN = 28
      if (!this._paneV) this._paneV = new THREE.Vector3()
      const v = this._paneV
      for (const [mon, pane, sign] of [
        [this.monL, this.paneL, -1],
        [this.monR, this.paneR, 1],
      ]) {
        const paneW = pane.width || 0.3
        const x0 = cam0.position.x + sign * 0.86 * halfW0
        mon.object.position.set(x0, cam0.position.y, cam0.position.z - d0)
        // 目标：屏缘 28px 处 → 半宽换算成 NDC，再加半个面板宽得到中心 NDC
        const edge = sign * (1 - (2 * MARGIN) / W)
        const target = edge - sign * (paneW * 0.5) / halfW0
        v.copy(mon.object.position).project(cam0)
        mon.object.position.x = x0 + (target - v.x) * halfW0
      }
      this.paneL.tick(t, { appearAt: tFlip1 - 0.4, parallax: { x: 0, y: 0 }, glitch: 0 })
      this.paneR.tick(t, { appearAt: tAm0 - 0.5, parallax: { x: 0, y: 0 }, glitch: 0 })
      this.paneL.flush()
      this.paneR.flush()
      // 在场窗口到坍缩闪白前（99.5 → 103.1）：§3 的 trance1 残影行（101.673）本来永远不出现，
      // 这条窗口让"output slowing down…"真的能被看到（R8-D4）。
      const paneA = clamp(span(t, tFlip1 - 0.4, tFlip1 + 0.2)) * (1 - clamp(span(t, 103.1, 103.35)))
      this.monL.object.visible = paneA > 0.01
      this.monR.object.visible = paneA > 0.01
      this.metrics.paneA = +paneA.toFixed(3)
    }

    // ---- 坍缩亮点（103.3–103.5） ----
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
    // 本段已无自建 3D 资源；终端屏由 props 统一管理（与旧实现一致，不在此处释放）。
    this.chatRows = null
  },
}

/* ================================================================== *
 *  2D 矢量绘制（§G 1:29 / 1:33 / 1:34 / 1:40）
 * ================================================================== */

/** 单位向量（内部工具） */
function norm(x, y) {
  const d = Math.hypot(x, y) || 1
  return [x / d, y / d]
}

/** 开关的公共几何：外廓 0.42W，中心 (W/2, 0.44H) */
function swBox(W, H, hFrac) {
  const w = SW_FRAC * W
  const h = Math.round(w * hFrac)
  return { w, h, x: (W - w) / 2, y: H * SW_CY - h / 2 }
}

/** §G 1:29 形式一：胶囊开关（圆形滑块 + 弹簧位移） */
function drawCapsuleSwitch(g, W, H, u, a) {
  const { w, h, x, y } = swBox(W, H, 0.26)
  const r = h / 2
  g.save()
  g.globalAlpha = a
  // 轨道
  roundRect(g, x, y, w, h, r)
  g.fillStyle = 'rgba(10,16,26,0.9)'
  g.fill()
  g.strokeStyle = rgba('#7fe0ff', 0.85)
  g.lineWidth = 4
  g.stroke()
  roundRect(g, x + 10, y + 10, w - 20, h - 20, Math.max(4, r - 10))
  g.strokeStyle = rgba('#7fe0ff', 0.25)
  g.lineWidth = 2
  g.stroke()
  // 圆形滑块：outElastic ⇒ 弹簧位移（§0.6 禁线性）
  const e = outElastic(clamp(u))
  const kx = x + r + (w - 2 * r) * e
  const ky = y + r
  const kr = r * 0.86
  const rg = g.createRadialGradient(kx, ky, kr * 0.2, kx, ky, kr * 4)
  rg.addColorStop(0, rgba('#cfefff', 0.55))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath()
  g.arc(kx, ky, kr * 4, 0, TAU)
  g.fill()
  g.beginPath()
  g.arc(kx, ky, kr, 0, TAU)
  g.fillStyle = '#dff2ff'
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 3
  g.stroke()
  // 两端刻度（"开/关"的矢量暗示 —— 不用文字，避免与歌词/终端抢字）
  for (const sx of [x + r, x + w - r]) {
    g.beginPath()
    g.moveTo(sx, y + h + 10)
    g.lineTo(sx, y + h + 30)
    g.strokeStyle = rgba('#7fe0ff', 0.5)
    g.lineWidth = 3
    g.stroke()
  }
  g.restore()
}

/** §G 1:29 形式二：跷板开关（绕中心 ±0.22rad，弹簧过冲） */
function drawSeesawSwitch(g, W, H, u, a) {
  const barW = SW_FRAC * W * 0.96
  const barH = Math.round(barW * 0.055)
  const cx = W / 2
  const cy = H * SW_CY
  g.save()
  g.globalAlpha = a
  // 底座（三角支点）
  g.beginPath()
  g.moveTo(cx, cy - 6)
  g.lineTo(cx - 56, cy + 108)
  g.lineTo(cx + 56, cy + 108)
  g.closePath()
  g.fillStyle = 'rgba(10,16,26,0.9)'
  g.fill()
  g.strokeStyle = rgba('#7fe0ff', 0.6)
  g.lineWidth = 3
  g.stroke()
  // 跷板条
  const ang = (outElastic(clamp(u)) - 0.5) * 0.44
  g.save()
  g.translate(cx, cy)
  g.rotate(-ang)
  roundRect(g, -barW / 2, -barH / 2, barW, barH, barH / 2)
  g.fillStyle = '#dfe9f5'
  g.fill()
  g.strokeStyle = rgba('#7fe0ff', 0.9)
  g.lineWidth = 3
  g.stroke()
  for (const s of [-1, 1]) {
    const up = s * ang > 0
    g.beginPath()
    g.arc(s * (barW / 2 - barH), 0, barH * 0.62, 0, TAU)
    g.fillStyle = up ? '#9fe8ff' : '#93a9bd'
    g.fill()
  }
  g.restore()
  // 枢轴圆帽
  g.beginPath()
  g.arc(cx, cy, 30, 0, TAU)
  g.fillStyle = '#cfefff'
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 3
  g.stroke()
  g.restore()
}

/** §G 1:29 形式三：A|B 分段选择器（滑块停在 A 或 B） */
function drawSegmentedSwitch(g, W, H, u, a) {
  const { w, h, x, y } = swBox(W, H, 0.22)
  const half = w / 2
  const pad = 12
  const e = outCubic(clamp(u))
  g.save()
  g.globalAlpha = a
  roundRect(g, x, y, w, h, 16)
  g.fillStyle = 'rgba(10,16,26,0.9)'
  g.fill()
  g.strokeStyle = rgba('#7fe0ff', 0.8)
  g.lineWidth = 4
  g.stroke()
  // 选中块（从 A 滑到 B）
  roundRect(g, x + pad + half * e, y + pad, half - pad * 2, h - pad * 2, 10)
  g.fillStyle = rgba('#7fe0ff', 0.22)
  g.fill()
  g.strokeStyle = rgba('#9fe8ff', 0.9)
  g.lineWidth = 3
  g.stroke()
  // 分隔线
  g.beginPath()
  g.moveTo(x + half, y + 8)
  g.lineTo(x + half, y + h - 8)
  g.strokeStyle = rgba('#7fe0ff', 0.4)
  g.lineWidth = 2
  g.stroke()
  // A / B：裸 fillText + 显式字号守卫（role 'label' 下限 22；40px 也在 §G1 的 30–40 区间内）
  checkSize('label', 40, 'g:segAB')
  g.font = MONO(40, 700)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = e < 0.5 ? '#eaf6ff' : 'rgba(190,210,230,0.55)'
  g.fillText('A', x + half / 2, y + h / 2)
  g.fillStyle = e >= 0.5 ? '#eaf6ff' : 'rgba(190,210,230,0.55)'
  g.fillText('B', x + half + half / 2, y + h / 2)
  g.restore()
}

/** §G 1:29 形式四：圆形按钮（按下 + 光环） */
function drawRoundButton(g, W, H, u, a) {
  const r = (SW_FRAC * W * 0.86) / 2
  const cx = W / 2
  const cy = H * SW_CY
  const e = outCubic(clamp(u))
  g.save()
  g.globalAlpha = a
  // 按下后炸开的两圈光环
  if (e > 0.02) {
    for (let i = 0; i < 2; i++) {
      const p = clamp((e - i * 0.18) / 0.8)
      if (p <= 0) continue
      g.beginPath()
      g.arc(cx, cy, r * (0.9 + 0.55 * p), 0, TAU)
      g.strokeStyle = rgba('#9fe8ff', 0.5 * (1 - p))
      g.lineWidth = 10 * (1 - p) + 2
      g.stroke()
    }
  }
  // 外圈
  g.beginPath()
  g.arc(cx, cy, r, 0, TAU)
  g.fillStyle = 'rgba(10,16,26,0.9)'
  g.fill()
  g.strokeStyle = rgba('#7fe0ff', 0.85)
  g.lineWidth = 5
  g.stroke()
  // 内盘（按下位移）
  g.beginPath()
  g.arc(cx, cy + 10 * e, r * 0.8, 0, TAU)
  g.fillStyle = e > 0.6 ? '#9fe8ff' : '#cfe0ee'
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = 3
  g.stroke()
  g.restore()
}

/** §G 1:33：发光线条网格（笼）崩断 → 飘带四散 + 火花（不使用文字） */
function drawCageBreak(g, W, H, t, a) {
  const u = clamp((t - CAGE_T0) / CAGE_DUR)
  const broken = clamp((u - 0.32) / 0.55)
  const fade = 1 - clamp((u - 0.8) / 0.2)
  const alpha = a * fade
  if (alpha <= 0.01) return
  const cx = W / 2
  const cy = H * SW_CY
  const bw = W * 0.42
  const bh = H * 0.46
  const vib = (1 - broken) * 2.4 * Math.sin(t * 22)
  const V = []
  const Hh = []
  for (let i = 0; i < 5; i++) V.push([cx + (i - 2) * (bw / 4) + vib, cy - bh / 2, cy + bh / 2])
  for (let j = 0; j < 4; j++) Hh.push([cy + (j - 1.5) * (bh / 3.5) + vib * 0.6, cx - bw / 2, cx + bw / 2])
  g.save()
  g.lineCap = 'round'
  // ① 未断：张紧的发光网格
  if (broken < 1) {
    const k = 1 - broken
    g.globalAlpha = alpha * k
    g.strokeStyle = rgba('#7fe0ff', 0.95)
    g.lineWidth = 3
    g.shadowColor = rgba('#7fe0ff', 0.9)
    g.shadowBlur = 22
    for (const [x, y0, y1] of V) {
      g.beginPath()
      g.moveTo(x, y0)
      g.lineTo(x, y1)
      g.stroke()
    }
    for (const [y, x0, x1] of Hh) {
      g.beginPath()
      g.moveTo(x0, y)
      g.lineTo(x1, y)
      g.stroke()
    }
    g.shadowBlur = 0
  }
  // ② 崩断：每根线变飘带，两端沿"从中心向外"的方向飞散 + 绕自身中点弯曲；随后火花四散
  if (broken > 0.01) {
    const e = outCubic(broken)
    g.globalAlpha = alpha
    g.lineWidth = 7
    const ribbon = (ax, ay, bx, by, seed) => {
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const dirA = norm(ax - cx, ay - cy)
      const dirB = norm(bx - cx, by - cy)
      const dA = (90 + 260 * hash01(seed, 31)) * e
      const dB = (90 + 260 * hash01(seed, 32)) * e
      const cxp = mx + (hash01(seed, 7) - 0.5) * Math.abs(bx - ax || by - ay) * 0.5 * e
      const cyp = my + (hash01(seed, 8) - 0.5) * Math.abs(by - ay || bx - ax) * 0.5 * e
      g.beginPath()
      g.moveTo(ax + dirA[0] * dA, ay + dirA[1] * dA)
      g.quadraticCurveTo(cxp, cyp, bx + dirB[0] * dB, by + dirB[1] * dB)
      g.strokeStyle = rgba('#9fe8ff', 0.75 * (1 - 0.35 * broken))
      g.stroke()
    }
    let seed = 0
    for (const [x, y0, y1] of V) ribbon(x, y0, x, y1, seed++)
    for (const [y, x0, x1] of Hh) ribbon(x0, y, x1, y, seed++)
    // 火花粒子
    for (let i = 0; i < 70; i++) {
      const sx = cx + (hash01(i, 41) - 0.5) * bw * 0.9
      const sy = cy + (hash01(i, 42) - 0.5) * bh * 0.9
      const ang = hash01(i, 43) * TAU
      const sp = (60 + 420 * hash01(i, 44)) * e
      g.globalAlpha = alpha * (1 - broken) * (0.4 + 0.6 * hash01(i, 46))
      g.fillStyle = i % 3 === 0 ? '#ffffff' : '#9fe8ff'
      g.beginPath()
      g.arc(sx + Math.cos(ang) * sp, sy + Math.sin(ang) * sp, 1.2 + 2.6 * hash01(i, 45), 0, TAU)
      g.fill()
    }
  }
  g.restore()
}

/** §G 1:34：天空渐变（晨→夜）+ 夜里渐渐显出的星点（**不画太阳圆盘** —— §E/G9 都禁） */
function drawSky(g, W, H, t, clockA, dayness) {
  g.save()
  const gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, mixHex('#0a1430', '#5fa8e8', dayness))
  gr.addColorStop(0.62, mixHex('#05070f', '#cfe8ff', dayness))
  gr.addColorStop(1, mixHex('#05070f', '#ffb066', dayness * 0.9))
  g.globalAlpha = clockA
  g.fillStyle = gr
  g.fillRect(0, 0, W, H)
  const stars = clockA * (1 - dayness)
  if (stars > 0.01) {
    for (let i = 0; i < 90; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * 2.1 + i * 1.7)
      g.globalAlpha = stars * tw * (0.35 + 0.65 * hash01(i, 14))
      g.fillStyle = '#eaf4ff'
      g.beginPath()
      g.arc(hash01(i, 11) * W, hash01(i, 12) * H * 0.72, 0.9 + 1.5 * hash01(i, 13), 0, TAU)
      g.fill()
    }
  }
  // R8-D6：**两侧带擦成透明**。2D 层（stage）是叠在 3D 画布之上的，而终端屏属于 3D 的
  // PANEL_LAYER pass ⇒ 全屏天空会把两块终端整块盖住（实测 95.5s 终端完全不见、94.6s 只剩 10%）。
  // 2D 层擦除只影响本层像素（下层 3D 照旧透出来），所以用 destination-out 把左右侧带羽化擦掉，
  // 天空仍是全幅渐变，而终端屏保持清晰可读。
  const erase = (x0, x1, stops) => {
    const lg = g.createLinearGradient(x0, 0, x1, 0)
    for (const [p, a] of stops) lg.addColorStop(p, `rgba(0,0,0,${a})`)
    g.fillStyle = lg
    g.fillRect(x0, 0, x1 - x0, H)
  }
  const band = W * 0.30
  g.globalCompositeOperation = 'destination-out'
  g.globalAlpha = 1
  erase(0, band, [
    [0, 1],
    [0.66, 1],
    [1, 0],
  ])
  erase(W - band, W, [
    [0, 0],
    [0.4, 1],
    [1, 1],
  ])
  g.globalCompositeOperation = 'source-over'
  g.restore()
}

/** §G 1:34：2D 扁平钟表（表盘 r=0.27H、12 刻度、12/3/6/9、圆头指针、中心圆帽、时间读数） */
function drawFlatClock(g, W, H, T, clockA) {
  const cx = W / 2
  const cy = H * SW_CY
  const R = CLOCK_R_FRAC * H
  const hd = clockHands(T)
  g.save()
  g.globalAlpha = clockA
  // 表盘
  const rg = g.createRadialGradient(cx, cy, R * 0.1, cx, cy, R)
  rg.addColorStop(0, 'rgba(20,32,48,0.92)')
  rg.addColorStop(1, 'rgba(6,10,18,0.92)')
  g.beginPath()
  g.arc(cx, cy, R, 0, TAU)
  g.fillStyle = rg
  g.fill()
  g.strokeStyle = rgba('#8fd8ff', 0.85)
  g.lineWidth = 5
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, R * 0.94, 0, TAU)
  g.strokeStyle = rgba('#8fd8ff', 0.22)
  g.lineWidth = 2
  g.stroke()
  // 12 个刻度（12/3/6/9 加粗加长）
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * TAU
    const big = i % 3 === 0
    const r0 = R * (big ? 0.78 : 0.855)
    const r1 = R * 0.93
    g.beginPath()
    g.moveTo(cx + Math.sin(ang) * r0, cy - Math.cos(ang) * r0)
    g.lineTo(cx + Math.sin(ang) * r1, cy - Math.cos(ang) * r1)
    g.strokeStyle = rgba('#dfefff', big ? 0.95 : 0.6)
    g.lineWidth = big ? 5 : 2.5
    g.stroke()
  }
  // 12/3/6/9 数字（裸 fillText + 字号守卫；位置 x∈[35%,65%]、y∈[26%,62%]，在 G5 安全区内）
  checkSize('label', 34, 'g:clockNum')
  g.font = MONO(34, 600)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#dfefff'
  const num = ['12', '3', '6', '9']
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * TAU
    g.fillText(num[k], cx + Math.sin(ang) * R * 0.66, cy - Math.cos(ang) * R * 0.66)
  }
  // 圆头指针（canvas 的 +θ 就是顺时针；指针几何沿 -y 画出 ⇒ 角度直接取 clockHands）
  const hand = (ang, len, w, col) => {
    g.save()
    g.translate(cx, cy)
    g.rotate(ang)
    g.lineCap = 'round'
    g.lineWidth = w
    g.strokeStyle = col
    g.beginPath()
    g.moveTo(0, len * 0.1)
    g.lineTo(0, -len)
    g.stroke()
    g.restore()
  }
  hand(hd.hour, R * 0.52, 13, '#ffd479')
  hand(hd.minute, R * 0.78, 9, '#9fe8ff')
  // 中心圆帽
  g.beginPath()
  g.arc(cx, cy, 17, 0, TAU)
  g.fillStyle = '#eaf6ff'
  g.fill()
  g.beginPath()
  g.arc(cx, cy, 8, 0, TAU)
  g.fillStyle = '#0b1420'
  g.fill()
  // 当前时间读数（07:00 → 19:00 的扫描；中心 x=50%、中心 y≈75% —— G5 安全区内）
  const hh = Math.floor(T / 60)
  const mm = Math.floor(T % 60)
  checkSize('label', 34, 'g:clockRead')
  g.font = MONO(34, 600)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = 'rgba(234,244,255,0.92)'
  g.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, cx, cy + R + 46)
  g.restore()
}

/** §G 1:40：恍惚的一遍构图 —— 旋转螺旋隧道（点状螺旋线）+ 中央胶囊开关高速抖动
 *  `offX` 用于"画面分身"：第二遍用另一套色相 + 横向错位重画同一构图。 */
function drawTrancePass(g, W, H, t, a, col, offX) {
  const cx = W / 2 + offX
  const cy = H * SW_CY
  const RMAX = H * 0.48
  const spin = 0.9 * t
  const N = 110
  g.save()
  // ① 点状螺旋线（3 臂，随时间一边旋转一边向外流动 —— 读作"隧道"）
  for (let arm = 0; arm < 3; arm++) {
    for (let k = 0; k < N; k++) {
      const f = (k / N + 0.22 * t) % 1
      const r = Math.pow(f, 0.8) * RMAX
      const ang = (arm * TAU) / 3 + k * 0.16 + spin + f * 2.4
      g.globalAlpha = a * (0.18 + 0.82 * f)
      g.fillStyle = k % 7 === 0 ? col.key2 : col.key
      g.beginPath()
      g.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.92, 1.2 + 3.0 * f, 0, TAU)
      g.fill()
    }
  }
  // ② 中央胶囊开关：整体高频抖动 + 滑块来回甩
  const w = W * 0.18
  const h = w * 0.34
  g.globalAlpha = a
  g.save()
  g.translate(cx + 4.5 * Math.sin(t * 37), cy + 3.5 * Math.cos(t * 29))
  g.rotate(0.035 * Math.sin(t * 23))
  roundRect(g, -w / 2, -h / 2, w, h, h / 2)
  g.fillStyle = 'rgba(8,14,22,0.92)'
  g.fill()
  g.strokeStyle = rgba(col.key, 0.95)
  g.lineWidth = 4
  g.stroke()
  const kr = h * 0.42
  const kx = -w / 2 + kr + (w - 2 * kr) * clamp(0.5 + 0.42 * Math.sin(t * 6.5))
  g.beginPath()
  g.arc(kx, 0, kr, 0, TAU)
  g.fillStyle = col.key2
  g.fill()
  g.globalAlpha = a * 0.45
  const halo = g.createRadialGradient(kx, 0, 0, kx, 0, kr * 3.2)
  halo.addColorStop(0, rgba(col.key, 0.9))
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = halo
  g.beginPath()
  g.arc(kx, 0, kr * 3.2, 0, TAU)
  g.fill()
  g.restore()
  g.restore()
}
