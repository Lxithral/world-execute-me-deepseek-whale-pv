// src/scenes/z_demo_pane.js — ?demo=panes 演示段（FIX_V3.md §2.2 / §2.3 / §2.4 / §2.5 的验证台）
//
// 为什么需要它：§2.2–§2.5 交付的是"能力"（TermPane / Monitor / 遮挡规则 / 运动），
// 而**真正把它们摆进段 F–N** 是 R1–R3 的工作。没有验证台的话，R0 的这几项
// 只能靠读代码断言，无法证明"同屏 3 块、都在侧带、都在主角之后、不与歌词区相交"。
//
// 这一台刻意把所有约束同时摆出来：
//   · 3 块 Monitor（左右侧带各若干，深度不同 → 有视差、有前后关系）
//   · 1 个 hero（主角区的立方体，不透明、写深度）→ 测"pane 必须在 hero 之后"
//   · 内容全部来自 `src/data/dialogue.js` 的段 N 条目（§2.6：场景里不得散落终端字符串）
//   · 入场滑入 + 逐行点亮 / 退场推远淡出 / 漂移视差 / 冲击切片故障（§2.5）
//   · 每帧把 pane 与 hero 登记进 `src/core/stage_roles.js`，由 ?selftest 的 q) 项判定
//
// 它**不属于影片**（`demo: true`，见 scenes/index.js 的注册与 main.js 的 demoMode 分支）。

import * as THREE from 'three'
import { C, rgba } from '../core/palette.js'
import { clamp, span } from '../core/ease.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'

/**
 * 三块屏的静态布局。
 * 位置按 §2.4 的分区算：x ∈ {±1.45} 落在左右侧带（|x| > 78% 画面宽 ⇒ |x| > 1.497×… 
 * 实测由 stage_roles 的 `bandOf()` 判定，这里只是"意图"，真正的判据在运行时投影结果）。
 * 尺寸 0.63 宽：在相机 z=3.4 下约 248px 宽（12.9% 画面宽）→ 单块面积约 2.9%，远低于 22% 上限。
 */
const PANES = [
  { id: 'L1', session: '#001', side: 'L', x: -1.45, y: 0.18, z: -0.15, anchorIdx: 0, shell: 'flat', role: 'pane' },
  { id: 'L2', session: '#001', side: 'L', x: -1.72, y: -0.30, z: -0.95, anchorIdx: 2, shell: 'crt', role: 'pane' },
  { id: 'R1', session: '#002', side: 'R', x: 1.50, y: 0.10, z: -0.45, anchorIdx: 4, shell: 'flat', role: 'pane' },
]

/** 时间轴（本演示段自己的窗口） */
const T0 = 0
const T_ENTER = 0.6 // 第一块屏入场
const T_ENTER_GAP = 0.45 // 每块屏相隔
const T_EXIT = 5.6 // 开始退场
const T_END = 6.6

/** 取段 N 的台词（§2.6：内容只在 dialogue.js 里） */
const LINES_N = dialogueOf('N')

/** 把一条台词行转成 TermPane 的输入 */
function toRow(d, typedChars) {
  let text = d.text
  if (typedChars != null) text = text.slice(0, typedChars)
  return { kind: d.kind, text, caret: typedChars != null && typedChars < d.text.length }
}

export default {
  id: 'PANE',
  demo: true,
  start: T0,
  end: T_END,
  title: '演示：终端屏 / 显示器 / 遮挡 / 运动',

  /** 演示机位：正视、略微俯视，让三块屏的深度差看得出来 */
  cam() {
    return { pos: [0, 0.05, 3.4], look: [0, 0, 0], fov: 40, roll: 0, isCut: false }
  },

  init(ctx) {
    const T = ctx.three
    this.panes = []
    this.hero = null
    for (let i = 0; i < PANES.length; i++) {
      const spec = PANES[i]
      const pane = createTermPane({ session: spec.session, side: spec.side })
      // §4.2：非 decor 的登记对象**必须带锚点**。这里用该屏所显示的那条台词的锚点 key
      // （内容来自 dialogue.js，锚点来自 anchors.js，两者由 tools/dialogue_calib.mjs 校验一致）。
      const line = LINES_N[Math.min(spec.anchorIdx, LINES_N.length - 1)]
      const monitor = createMonitor({
        pane,
        width: 0.63,
        shell: spec.shell,
        glow: 0.45,
        tag: `demo:${spec.id}`,
        seg: 'N',
        anchor: line ? line.anchor : null,
      })
      monitor.object.position.set(spec.x - monitor.width * 0.0, spec.y, spec.z)
      // 右侧带的屏朝左转一点，做出"围着她"的取景（§2.5 的视差也靠这个放大）
      monitor.object.rotation.y = spec.side === 'R' ? -0.04 : 0.04 // FIX_V5 §G1：倾斜 ≤6°，基准角预算 ≤0.04rad
      monitor.object.name = `segPANE:${spec.id}`
      // 登记进 §2.4 的角色表；anchor 用真实存在的锚点 key（§4.2：除 decor 外必须有锚点）
      const rec = monitor.registerWith(ctx.stageRoles)
      this.panes.push({ spec, pane, monitor, rec, anchor: LINES_N[Math.min(spec.anchorIdx, LINES_N.length - 1)] })
      T.stage3d.add(monitor.object)
    }

    // ---- hero：不透明、写深度的立方体，放在主角区 ----
    const hero = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.62, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x2a1040, roughness: 0.35, metalness: 0.15, transparent: false })
    )
    hero.name = 'segPANE:hero'
    hero.position.set(0, -0.05, 0.55)
    // 轮廓光（§5 的材质要求）
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(0.70, 0.70, 0.70),
      new THREE.MeshBasicMaterial({ color: 0x7aaaff, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false })
    )
    hero.add(rim)
    if (ctx.stageRoles) ctx.stageRoles.register(hero, { role: 'hero', seg: 'PANE', anchor: 'trapped', tag: 'demo:hero' })
    this.hero = hero
    T.stage3d.add(hero)
  },

  render(t, lt, ctx) {
    const T = ctx.three
    if (!this.panes) return
    const dt = 1 / 60

    // ---- hero 呼吸式自转（让它确实"在动"，m) 运动能量也不会把它算成静止）----
    if (this.hero) {
      this.hero.visible = true
      this.hero.rotation.y = t * 0.6
      this.hero.rotation.x = Math.sin(t * 0.8) * 0.25
      this.hero.position.y = -0.05 + Math.sin(t * 1.1) * 0.04
    }

    // ---- 相机视差（§2.5）：把相机的世界位置归一化成 -1..1 交给 TermPane ----
    const cam = T.camera
    const par = { x: clamp(cam.position.x / 2.2, -1, 1), y: clamp(cam.position.y / 1.4, -1, 1) }

    // ---- 冲击强度：切片故障的输入（§2.5）----
    const imp = ctx.impulses ? ctx.impulses : null
    const glitch = imp ? clamp((ctx.pulse || 0) * 1.2) : 0

    let updated = 0
    for (let i = 0; i < this.panes.length; i++) {
      const p = this.panes[i]
      const appearAt = T_ENTER + i * T_ENTER_GAP
      const fadeAt = T_EXIT + i * 0.18
      const goneAt = fadeAt + 0.55

      // ---- §2.6：内容来自 dialogue.js。已"到达"的行逐条累积，最后一条逐字流式 ----
      const arrived = []
      for (let k = 0; k <= p.spec.anchorIdx && k < LINES_N.length; k++) arrived.push(LINES_N[k])
      const rows = []
      let typed = null
      for (let k = 0; k < arrived.length; k++) {
        const d = arrived[k]
        const at = appearAt + 0.25 + k * 0.5
        if (t < at) break
        // 最后一条做逐字流式（§2.2 的"流式逐字"）
        if (k === arrived.length - 1 && d.stream) {
          const chars = Math.floor((t - at) / 0.045)
          typed = Math.max(1, Math.min(d.text.length, chars))
          rows.push(toRow(d, typed))
        } else {
          rows.push(toRow(d, null))
        }
      }
      if (rows.length) p.pane.setLines(rows, { session: p.spec.session, subtitle: '' })

      // ---- §2.5 运动 ----
      p.pane.tick(t, { dt, appearAt, fadeAt, goneAt, parallax: par, glitch })

      // 位置 = 基准 + 漂移 + 入场滑动 + 退场推远
      //
      // ⚠️ 退场时**额外向外滑出**：§2.5 的退场是"向后推远 + 淡出"，但"只向后推"会让
      // 投影中心滑向画面中部（离相机越远、同样 x 的投影越小），于是正在淡出的屏会短暂
      // 越出 §2.4 的左右侧带、被判 `pane-zone`（α 还没降到 0.3 的豁免线以下时）。
      // 侧向滑出既保持了 §2.5 的"推远 + 淡出"，又让屏在淡出期间始终待在各自的侧带里。
      const base = p.spec
      const exitU = Math.max(0, 1 - p.pane.opacity)
      const sideSign = base.side === 'R' ? 1 : -1
      p.monitor.object.position.set(
        base.x + p.pane.drift.x + p.pane.slideOffset() + sideSign * exitU * 1.15,
        base.y + p.pane.drift.y,
        base.z + p.pane.drift.z - p.pane.pushBack()
      )
      p.monitor.object.rotation.y = (base.side === 'R' ? -0.04 : 0.04) + p.pane.drift.rotY
      p.monitor.object.rotation.x = p.pane.drift.rotX
      p.monitor.object.visible = p.pane.visible
      p.pane.setCaret(Math.sin(t * 3.4) > 0)

      // §8：每帧最多更新 3 块文字纹理（本演示段就是 3 块）
      if (p.monitor.object.visible && p.pane.flush() && updated < 3) updated++
      if (p.rec) p.rec.alpha = p.pane.opacity
    }

    // ---- 标题（?debug 之外不画任何开发字符串；这里只画 §2.2 允许的说明性小字）----
    if (ctx.debug) {
      const g = ctx.gFront
      g.save()
      g.globalAlpha = 0.85
      g.font = '600 22px "JetBrains Mono", monospace'
      g.fillStyle = C.cyan
      g.textAlign = 'left'
      g.textBaseline = 'top'
      g.fillText(`demo=panes  monitors=${this.panes.length}  texUpdates=${updated}/frame`, 40, 40)
      g.restore()
    }
  },
}
