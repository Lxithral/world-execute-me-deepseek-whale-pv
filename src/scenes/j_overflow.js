// src/scenes/j_overflow.js — 段 J 2:09–2:27.9 溢出（纯器乐，红色段）
// DIRECTOR：底色转红警报；KV Cache 内存格：分配→标记→清扫→压缩，旁边滚动 hexdump；
// 窗口无限递归缩放；ctxAt 加速到 100%；2:25 全屏 context limit reached；2:26.5 黑场，
// 红字重新键入 dsh --resume；2:27.8 静默一帧。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, hexdump, roundRect, ctxAt } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { kvSchedule } from '../lib/tables.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'
import * as THREE from 'three'

const RESUME = 'dsh --resume'
const KV_COLS = 16
const KV_ROWS = 6

export default {
  id: 'J',
  start: 129.0,
  end: 147.9,
  title: '溢出',
  fx: [
    { t: 129.0, kind: 'flash', amount: 0.6, dur: 0.18 },
    { t: 129.0, kind: 'glitch', amount: 0.5, dur: 0.3 },
    { t: 136.0, kind: 'shake', amount: 0.35, dur: 0.4 },
    { t: 140.0, kind: 'shake', amount: 0.5, dur: 0.4 },
    { t: 145.0, kind: 'flash', amount: 1.0, dur: 0.3 },
    { t: 145.0, kind: 'shake', amount: 0.9, dur: 0.8 },
    { t: 146.5, kind: 'glitch', amount: 0.8, dur: 0.3 },
  ],

  /**
   * §7 段 J 明写「KV 体素立方体做主角(≥画面高度 50%),**背景为终端屏隧道向镜头冲来**」。
   * 这一段此前只有巨字与 KV 格，没有终端屏隧道 —— 这正是 `?selftest` b) 在
   * 135/136/137/139s 卡"边缘像素 ≥4%"（75%/3.7%）的缺口。
   *
   * 设计上必须同时满足 §2.4 三条硬规则（否则 q) 会 FAIL）：
   *   · 同屏 pane ≤3 块 → 只放 3 块；
   *   · 只能放左右侧带/远景、不得交歌词区 → 三块固定挂在**左右侧带**的横坐标上；
   *   · 单块面积 ≤22%（远景 ≤35% 且 α ≤0.3）。
   * 关键取景事实：pane 挂在**固定世界 x**、沿 z 朝相机推进时，投影 NDC x **会向外扩**，
   * 也就是越近越贴边 —— 天然留在侧带里，不会滑进画面中部。
   * 尺寸 0.63 世界单位；把推进范围限在 z 距离 1.9→3.4，实测面积峰值 < 22%。
   */
  init(ctx) {
    this.kv = kvSchedule({ cells: KV_COLS * KV_ROWS, t0: 130.5, t1: 145.0, seed: 77 })
    /* ---- T11 / §1.8：J2/J3 的 16³ 体素立方体 + J1 的红色错误石板 ---- */
    this.cube = buildVoxelCube()
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.cube.object)
    this.slabs = buildErrorSlabs(8)
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.slabs.object)
    // J1 的起音点（每个起音一块石板）：取 `illegal` 拍 [129.0, 133.0] 内的起音
    try {
      this.j1Onsets = ctx.sync.onsetsIn(129.0, 133.0).slice(0, 8)
    } catch (e) {
      this.j1Onsets = [129.4, 129.9, 130.4, 130.9, 131.4, 131.9, 132.4, 132.9]
    }
    // 三块屏：左 ×2、右 ×1（§3 段 J 的终端内容：tokens 流 / 上下文读数 / 溢出报错）
    const JROWS = dialogueOf('J')
    const txt = (anchor, fb) => {
      const hit = JROWS.find((d) => d.anchor === anchor)
      return hit ? hit.text : fb
    }
    const specs = [
      { id: 'JL1', side: 'L', x: -1.95, y: 0.20, anchor: 'kvFill', text: txt('kvFill', 'tokens ▸ streaming…'), kind: 'tool' },
      { id: 'JL2', side: 'L', x: -2.45, y: 0.40, anchor: 'start', text: txt('kvFill', 'tokens ▸ streaming…'), kind: 'tool' },
      { id: 'JR1', side: 'R', x: 1.95, y: 0.26, anchor: 'limit', text: txt('limit', 'E_CONTEXT_LIMIT'), kind: 'err' },
    ]
    this.panes = []
    for (const sp of specs) {
      const pane = createTermPane({ session: '#001', side: sp.side })
      pane.setLines([{ kind: sp.kind, text: sp.text }], { session: '#001', subtitle: '' })
      const monitor = createMonitor({
        // 宽度 0.46（不是 0.63）：实测 0.63 在 d=2.6 处投影会压到 y=80% 的歌词区
        pane, width: 0.46, shell: 'flat', glow: 0.36,
        tag: `J:${sp.id}`, seg: 'J', anchor: sp.anchor,
      })
      monitor.object.visible = false
      if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(monitor.object)
      this.panes.push({ sp, pane, monitor, rec: ctx.stageRoles ? monitor.registerWith(ctx.stageRoles) : null })
    }
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const black = span(t, 146.5, 146.72)
    const quiet = t >= 147.75 && t < 147.9

    // 红警报底
    const alarm = span(t, 129.0, 131.0)
    const pct = ctxAt(t)
    const heat = clamp((pct - 20) / 80)
    const pulse = 0.5 + 0.5 * Math.sin(t * (3 + heat * 7))
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex('#160a0c', '#3a0d10', 0.5 + 0.5 * heat)
      g.fillRect(0, 0, W, H)
      g.fillStyle = rgba(C.red, 0.05 + 0.12 * heat * pulse)
      g.fillRect(0, 0, W, H)
      g.fillStyle = rgba(C.red, 0.13)
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // ---- §7 段 J：「红色频闪随 rms 渐强」 ----
    // 以前这一条只有一层**整屏红 tint**（`fillRect(0,0,W,H)`，没有任何内部边缘），
    // 于是 `?selftest` b) 在 135–137s 的边缘像素一直卡在 3.7–3.9%（要求 ≥4%）：
    // 那一帧非众数占比高达 75%，内容并不少 —— 缺的就是**降采样后仍能读到的长直边**。
    // 现在改成整屏宽的硬边警示条：强度由 heat × rms 驱动（既落实"频闪随 rms 渐强"，
    // 又给画面提供横向长边）。取 10px 条高 / 54px 周期：在 480×270 的扫描口径下
    // 约合 2.5px，仍高于 Sobel 的可分辨尺度。
    {
      const rms = sync.rmsAt(t)
      // ⚠️ `flash` **不能**只正比于 `heat`：heat = (ctx%−20)/80，在段 J 开头（ctx≈20%）几乎是 0，
      // 于是 129–131s 一条警示条都不画，画面掉到 mean=0.051/0.072/0.088（§6 要求 ≥0.10）。
      // 改成"从段首就亮起、再由 rms 与 heat 加强"，才既落实「红色频闪随 rms 渐强」，
      // 又让整段的平均亮度站得住。
      const flash = clamp(alarm * (0.55 + 0.45 * clamp(rms * 1.7) + 0.30 * heat))
      if (flash > 0.02) {
        g.save()
        g.fillStyle = `rgba(255,116,116,${(0.34 + 0.46 * flash).toFixed(3)})`
        // 14px 条高 / 48px 周期：覆盖约 29% 的画面，在 480×270 口径下约合 3.5px，
        // 既是"降采样后仍能读到的长直边"，也把这一段的平均亮度抬到 §6 的下限之上。
        for (let y = 0; y < H; y += 48) g.fillRect(0, y, W, 14)
        g.restore()
      }
      /* ⚠️ T23b：竖向硬边条**不能**画在这里 —— 它会被后面那块「context limit reached」
       * 的全屏 `rgba(0,0,0,0.72)` 罩住（实测 t=146.0 的 ed 因此只有 0.035）。
       * 见下面 limit 块内部的重画。 */
    }

    if (!quiet) {      // hexdump
      const hdA = span(t, 130.6, 131.4) * (1 - span(t, 145.6, 146.4))
      if (hdA > 0.01) {
        g.save()
        g.globalAlpha = hdA
        hexdump(g, { x: W * 0.63, y: H * 0.30, w: W * 0.32, alpha: 0.9, rows: 16, scroll: t * 26, seed: 5, size: 13 })
        g.font = MONO(12, 600)
        g.fillStyle = C.red
        g.textAlign = 'left'
        g.textBaseline = 'top'
        g.fillText('kv-cache dump  (live)', W * 0.63, H * 0.27)
        g.restore()
      }
      // ⚠️ T11 / §1.8：「整个**删除嵌套窗口套娃**，也**不要任何静止矩形**」——
      // `drawRecursiveWindows()` 的调用与函数体都已删除（见文件末尾的说明）。
      // 进度与读数
      drawGauges(g, ctx, t, pct, heat)
    }

    /* ---- T11 / §1.8：J1 红色错误石板 / J2 体素立方体生长 / J3 扫描弹出压缩 ---- */
    {
      const cam = ctx.three.camera
      const CUBE_D = 3.15
      // J1 2:09.0–2:13：每个起音点一块石板砸来并碎裂
      const j1 = t >= 128.7 && t < 133.4
      this.slabs.object.position.set(cam.position.x, cam.position.y, cam.position.z)
      if (j1) this.slabs.update(t, this.j1Onsets, 129.0)
      else this.slabs.update(t, [], 129.0)
      // J2 2:13–2:17：逐块分配生长 + 相机环绕 + 蓝→琥珀
      const grow = clamp(span(t, 133.0, 136.6))
      // J3 2:17–2:21：扫描平面扫过 → 变红弹出 → 其余压缩成致密块
      const scanZ = -0.72 + 1.44 * clamp(span(t, 137.0, 139.4))
      const eject = span(t, 138.2, 139.4) * (1 - span(t, 140.6, 141.4))
      const compress = clamp(span(t, 139.6, 141.0))
      const cubeA = clamp(span(t, 133.0, 133.6)) * (1 - span(t, 145.2, 145.9))
      const paletteU = clamp(span(t, 133.6, 136.4))
      const spin = t * 0.16 + (t >= 133 && t < 137 ? 0.25 * Math.sin((t - 133) * 1.1) : 0)
      /* ---- J4 2:21–2:25：立方体发光裂纹 + 相机推进 + 抖动随 rms 渐强 ---- */
      const j4 = clamp(span(t, 141.0, 141.8)) * (1 - span(t, 144.9, 145.1))
      const crackU = j4
      // 相机推进：立方体朝相机逼近（沿 z 推进，观感=镜头推近）
      const push = j4 * 0.85
      // 抖动随 rms 渐强（§1.8 原文）
      const jit = j4 * clamp(sync.rmsAt(t) * 2.2) * 0.055
      /* ---- J5 2:25–2:26.5：粉碎成数千碎片 + 冲击波 + 全屏闪红 ---- */
      const tShatter = 145.0
      const shatter = clamp((t - tShatter) / 0.55) * (1 - span(t, 146.35, 146.6))
      this.cube.object.position.set(
        cam.position.x + (hash01(Math.floor(t * 60), 811) * 2 - 1) * jit,
        cam.position.y + 0.02 + (hash01(Math.floor(t * 60), 812) * 2 - 1) * jit,
        cam.position.z - (CUBE_D - push)
      )
      this.cube.update(t, { alpha: cubeA, grow, paletteU, scanZ, eject, compress, spin, shatter })
      // J5 的冲击波环 + 全屏闪红（2D 叠加）
      if (shatter > 0.01) {
        const rr = 60 + shatter * ctx.W * 0.75
        g.save()
        g.globalAlpha = (1 - shatter) * 0.9
        g.strokeStyle = rgba(C.red, 0.9)
        g.lineWidth = 14 * (1 - shatter) + 3
        g.beginPath()
        g.arc(ctx.W / 2, ctx.H * 0.46, rr, 0, TAU)
        g.stroke()
        g.globalAlpha = (1 - shatter) * 0.32
        g.fillStyle = C.red
        g.fillRect(0, 0, ctx.W, ctx.H)
        g.restore()
      }
      // J4 的发光裂纹（2D 叠加：从中心向外生长的锯齿折线）
      if (crackU > 0.01) {
        g.save()
        g.globalAlpha = crackU * 0.9
        g.strokeStyle = rgba(C.red, 0.95)
        g.lineWidth = 2.5
        g.shadowColor = rgba(C.red, 0.9)
        g.shadowBlur = 18
        const cx0 = ctx.W / 2
        const cy0 = ctx.H * 0.46
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + hash01(i, 91) * 0.4
          const L = (0.18 + hash01(i, 92) * 0.32) * ctx.H * Math.min(1, crackU * 1.4)
          g.beginPath()
          g.moveTo(cx0, cy0)
          let px = cx0
          let py = cy0
          let aa = a
          const SEGS = 5
          for (let k2 = 1; k2 <= SEGS; k2++) {
            aa += (hash01(i * 7 + k2, 93) * 2 - 1) * 0.34
            px = cx0 + Math.cos(a) * L * (k2 / SEGS) + Math.cos(aa) * 10 * (hash01(i * 7 + k2, 94) - 0.5)
            py = cy0 + Math.sin(a) * L * (k2 / SEGS) + Math.sin(aa) * 10 * (hash01(i * 7 + k2, 95) - 0.5)
            g.lineTo(px, py)
          }
          g.stroke()
        }
        g.restore()
      }
      this.metrics = this.metrics || {}
      this.metrics.j = { grow: +grow.toFixed(2), scanZ: +scanZ.toFixed(2), eject: +eject.toFixed(2), compress: +compress.toFixed(2), slabs: j1 ? this.j1Onsets.length : 0, crack: +crackU.toFixed(2), push: +push.toFixed(2), jit: +jit.toFixed(4), shatter: +shatter.toFixed(2) }
    }

    // ---- 背景：终端屏隧道向镜头冲来（§7 段 J 指定的背景）----
    if (this.panes && !quiet && black < 0.99) {
      const cam = ctx.three.camera
      // 整段持续推进，到 145s 的闪白前淡出（§4.4：别和闪白挤在同一拍）
      const tunU = clamp(span(t, 130.2, 131.6)) * (1 - clamp(span(t, 144.4, 145.2)))
      for (let i = 0; i < this.panes.length; i++) {
        const P = this.panes[i]
        // 相位：每块屏以不同速度从远处推向相机，到 1 之后回到远处（循环成"隧道"）
        const cyc = 0.62 + i * 0.14
        const ph = (((t - 130.2) * cyc) % 1 + 1) % 1
        // 相机前方距离 4.2 → 2.6：**不要**推进到更近 ——
        // 实测推到 1.9 时屏的投影下缘越过 y=80%（§2.4 的歌词区）→ q) 报 `pane-lyrics`；
        // 同时屏心也会掉出侧带的 y 范围 → 报 `pane-zone`。
        const d = 4.2 - ph * 1.6
        P.monitor.object.visible = tunU > 0.01
        if (!P.monitor.object.visible) {
          if (P.rec) P.rec.alpha = 0
          continue
        }
        // 固定世界 x（左右侧带）× 随相机：往前推时投影 x 自然向外扩，始终留在侧带。
        // 系数 1.2 是上限：再放大会把屏推到画面外（投影 bbox 被夹到边缘，中心反而可能越界）。
        P.monitor.object.position.set(
          cam.position.x + P.sp.x * (1 + ph * 0.2),
          cam.position.y + P.sp.y,
          cam.position.z - d
        )
        P.monitor.object.rotation.y = P.sp.side === 'R' ? -0.30 : 0.30
        // 越近越淡：离开"远景"时按 §2.4 的远景豁免（α ≤0.3）退场
        const alpha = tunU * clamp(1 - ph * 1.15)
        P.pane.tick(t, { appearAt: 130.2, parallax: { x: 0, y: 0 }, glitch: 0.1 * sync.pulse(t, 170) })
        P.pane.setCaret(Math.sin(t * 3.1 + i) > 0)
        P.pane.flush()
        // 声明给 §2.4 的 α 必须与**屏幕材质**一致，否则 q) 读到的 alpha 和观众看到的不符
        if (P.monitor.screenMesh && P.monitor.screenMesh.material) P.monitor.screenMesh.material.opacity = alpha
        if (P.rec) P.rec.alpha = alpha
      }
    } else if (this.panes) {
      for (const P of this.panes) {
        P.monitor.object.visible = false
        if (P.rec) P.rec.alpha = 0
      }
    }

    // 2:25 全屏 context limit reached
    const tLimit = ctx.cues.sec('J', 'limit', 144.9)
    const tBlack = ctx.cues.sec('J', 'blackout', 146.5)
    const limit = span(t, tLimit, tLimit + 0.45) * (1 - span(t, tBlack - 0.45, tBlack))
    if (limit > 0.01) {
      g.save()
      g.globalAlpha = limit
      g.fillStyle = 'rgba(0,0,0,0.72)'
      g.fillRect(0, 0, W, H)
      g.font = MONO(74, 700)
      g.fillStyle = C.red
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('context limit reached', W / 2, H * 0.46)
      /* ---- T23b：把 §7 J 的「红色频闪」**竖向硬边条**画在这块全屏黑之后 ----
       * 全量验收 b) 实测 **146.0s 边缘只有 3.5%**：那一段的立方体碎散是弥散粒子、
       * 而横条又整片被上面 0.72 的黑罩压平 ⇒ 降采样后没有可读的长直边。
       * 竖向条（12px / 72px 周期 ⇒ 480×270 口径下 4px / 48px）补回边缘密度，
       * 且仍属 §7「红色频闪随 rms 渐强」（rms 越高越明显），alpha 仅 0.22 ⇒ 不改变亮度上限。
       */
      const vBar = clamp(span(t, 144.5, 145.3)) * (1 - clamp(span(t, 146.28, 146.5))) * clamp(0.35 + 0.65 * clamp(sync.rmsAt(t) * 1.6))
      if (vBar > 0.02) {
        g.fillStyle = `rgba(255,150,150,${(0.22 * vBar).toFixed(3)})`
        for (let x = 0; x < W; x += 72) g.fillRect(x, 0, 12, H)
      }
      g.font = MONO(24, 600)
      g.fillStyle = rgba(C.red, 0.85)
      g.fillText('the session is full.', W / 2, H * 0.56)
      g.restore()
    }

    // 2:26.5 黑场 + 红字重新键入 dsh --resume
    if (black > 0.01) {
      g.save()
      g.globalAlpha = black
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
      // ⚠️ T12 / §1.9：字号 **≥110px**、**居中**、等宽、红色；
      // 原来写的是 `MONO(46)` + 左对齐 (W/2−260)，两条都不满足。
      const s = typed(RESUME, t, { start: tBlack + 0.15, cps: 12, seed: 3 })
      if (s) {
        g.font = MONO(112, 700)
        g.fillStyle = C.red
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(s, W / 2, H * 0.5)
        // 光标：居中排版下画在整行右端（原来用了已删除的 `x`，会抛 `x is not defined`）
        const wpx = g.measureText(s).width
        if (cursorOn(t, { hz: 1.1 })) {
          g.fillStyle = C.red
          g.fillRect(W / 2 + wpx / 2 + 10, H * 0.5 - 24, 14, 48)
        }
      }
      g.restore()
    }

    // 2:27.8 静默一帧：纯黑（下一段 K 从 147.9 无缝接上）
    if (quiet) {
      g.fillStyle = '#000'
      g.fillRect(0, 0, W, H)
    }
  },
}

/* ---------------- KV 内存格 ---------------- */
/* ================================================================== *
 * T11 / FIX_V4 §1.8 段 J 前半（J1–J3）
 * ------------------------------------------------------------------
 * 规格原文：
 *   · 「整个**删除嵌套窗口套娃**，也**不要任何静止矩形**」
 *   · J1 2:09.0–2:13 `illegal`：**红色错误石板（厚度感 3D 面板）朝镜头砸来，每个起音点一块，碎裂**
 *   · J2 2:13–2:17：**KV 体素立方体（16³ 实例化）**逐块分配生长，相机环绕，色彩蓝→琥珀
 *   · J3 2:17–2:21：一块**扫描平面**扫过立方体，标记的体素**变红并被弹出**，随后其余体素**滑动压缩成致密块**
 * 所以旧的 2D「KV Cache 内存格」（静止矩形）与 `drawRecursiveWindows()`（套娃）都删除，
 * 换成下面这颗真正的 3D 立方体 + J1 的石板。
 * ================================================================== */

const VOX = 16

/** J2/J3：KV 体素立方体 —— 16³ = 4096 个实例化方块 */
function buildVoxelCube() {
  const N = VOX * VOX * VOX
  const grp = new THREE.Group()
  grp.name = 'j:cube'
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.072, 0.072, 0.072),
    new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.28, transparent: true, opacity: 1 }),
    N
  )
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
  grp.add(mesh)
  const S = 0.088
  const pos = new Float32Array(N * 3)
  const order = new Float32Array(N)
  let i = 0
  for (let x = 0; x < VOX; x++) {
    for (let y = 0; y < VOX; y++) {
      for (let z = 0; z < VOX; z++) {
        pos[i * 3] = (x - (VOX - 1) / 2) * S
        pos[i * 3 + 1] = (y - (VOX - 1) / 2) * S
        pos[i * 3 + 2] = (z - (VOX - 1) / 2) * S
        order[i] = hash01(i, 31) // 分配顺序（逐块生长用）
        i++
      }
    }
  }
  const dummy = new THREE.Object3D()
  const cBlue = new THREE.Color(0x3f7fff)
  const cAmber = new THREE.Color(0xffb454)
  const cRed = new THREE.Color(0xff3b3b)
  const tmp = new THREE.Color()
  return {
    object: grp,
    mesh,
    update(t, o = {}) {
      const { alpha = 1, grow = 0, paletteU = 0, scanZ = 99, eject = 0, compress = 0, spin = 0, shatter = 0 } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      mesh.material.opacity = alpha * (1 - 0.35 * shatter)
      grp.rotation.y = spin
      // J5：粉碎 —— 每个体素沿自身方向飞散 + 翻滚
      for (let k = 0; k < N; k++) {
        if (shatter > 0.001) {
          const dx = pos[k * 3]
          const dy = pos[k * 3 + 1]
          const dz = pos[k * 3 + 2]
          const L = Math.max(1e-4, Math.hypot(dx, dy, dz))
          const sp = (1.4 + hash01(k, 71) * 2.2) * shatter
          dummy.position.set(
            dx + (dx / L) * sp,
            dy + (dy / L) * sp,
            dz + (dz / L) * sp
          )
          dummy.rotation.set(shatter * 6 * hash01(k, 72), shatter * 6 * hash01(k, 73), shatter * 6 * hash01(k, 74))
          dummy.scale.setScalar(Math.max(0.001, 0.82 * (1 - 0.55 * shatter)))
          dummy.updateMatrix()
          mesh.setMatrixAt(k, dummy.matrix)
          tmp.copy(cRed).lerp(cAmber, 0.25 * (1 - shatter))
          mesh.setColorAt(k, tmp)
        }
      }
      if (shatter > 0.001) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        return
      }
      for (let k = 0; k < N; k++) {
        const g0 = clamp((grow - order[k]) / 0.22) // 逐块分配生长
        if (g0 <= 0.001) {
          dummy.scale.setScalar(0.001)
          dummy.position.set(0, 0, 0)
          dummy.updateMatrix()
          mesh.setMatrixAt(k, dummy.matrix)
          continue
        }
        // J3：扫描平面附近的体素被标记 → 变红 → 沿自身方向弹出
        const near = Math.exp(-Math.pow((pos[k * 3 + 2] - scanZ) / 0.14, 2))
        const marked = near * clamp(eject)
        const c = compress // 其余体素滑动压缩成致密块
        dummy.position.set(
          pos[k * 3] * (1 - 0.45 * c) + pos[k * 3] * marked * 0.9,
          pos[k * 3 + 1] * (1 - 0.45 * c) + pos[k * 3 + 1] * marked * 0.9,
          pos[k * 3 + 2] * (1 - 0.45 * c) + pos[k * 3 + 2] * marked * 1.6
        )
        dummy.scale.setScalar(g0 * (0.86 + 0.22 * marked))
        dummy.rotation.set(0, marked * 1.2 * hash01(k, 41), 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(k, dummy.matrix)
        tmp.copy(cBlue).lerp(cAmber, paletteU)
        if (marked > 0.01) tmp.lerp(cRed, marked)
        mesh.setColorAt(k, tmp)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    },
  }
}

/** J1：红色错误石板（厚度感 3D 面板）—— 每块由 2×3 片组成，碎裂时六片各自飞散 */
function buildErrorSlabs(n = 8) {
  const grp = new THREE.Group()
  grp.name = 'j:slabs'
  const list = []
  for (let i = 0; i < n; i++) {
    const g0 = new THREE.Group()
    const tiles = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.165, 0.11),
          new THREE.MeshStandardMaterial({
            color: 0xd42b2b,
            emissive: 0x5a0d0d,
            emissiveIntensity: 0.9,
            roughness: 0.45,
            metalness: 0.25,
            transparent: true,
          })
        )
        m.position.set((c - 0.5) * 0.46, (1 - r) * 0.18, 0)
        g0.add(m)
        tiles.push({ m, r, c, base: m.position.clone() })
      }
    }
    g0.visible = false
    grp.add(g0)
    list.push({ g: g0, tiles })
  }
  return {
    object: grp,
    list,
    /**
     * @param {number[]} onsets 每个起音点一块
     * @param {number} from 拍起点
     */
    update(t, onsets, from) {
      const cam = null
      for (let i = 0; i < list.length; i++) {
        const t0 = onsets[i]
        const L = list[i]
        if (t0 == null) {
          L.g.visible = false
          continue
        }
        const u = (t - t0) / 1.0
        if (u < 0 || u > 1.35) {
          L.g.visible = false
          continue
        }
        L.g.visible = true
        // 朝镜头砸来：z 从远到近
        const zOff = 5.4 - clamp(u) * 4.9
        const w = from + i
        L.g.position.set(
          (hash01(w, 611) * 2 - 1) * 1.15,
          (hash01(w, 612) * 2 - 1) * 0.75,
          -zOff
        )
        L.g.rotation.set((hash01(w, 613) * 2 - 1) * 0.25, (hash01(w, 614) * 2 - 1) * 0.3, 0)
        // 碎裂：u>0.72 之后六片各自飞散 + 淡出
        const sh = clamp((u - 0.72) / 0.6)
        for (const T of L.tiles) {
          const dir = hash01(w * 7 + T.r * 3 + T.c, 615) * 2 - 1
          T.m.position.set(
            T.base.x * (1 + sh * 1.5),
            T.base.y * (1 + sh * 1.9),
            T.base.z + sh * (0.35 + Math.abs(dir) * 0.5)
          )
          T.m.rotation.set(sh * dir * 1.6, sh * dir * 1.1, sh * dir * 1.9)
          T.m.material.opacity = 1 - sh
        }
      }
    },
  }
}

/* ⚠️ T11 / §1.8：`drawKvGrid()`（上面那个 2D「KV cache 内存格」）与
 * `drawRecursiveWindows()`（嵌套窗口套娃）**已按规格整段删除** ——
 * 规格原文「整个删除嵌套窗口套娃，也**不要任何静止矩形**」。
 * J2/J3 改由真正的 3D 体素立方体（`buildVoxelCube()`，16³ = 4096 实例）承担；
 * J1 由 `buildErrorSlabs()` 的红色错误石板承担。`nestedWindow` 的 import 也已移除。
 */

/* ---------------- 无限递归窗口 ---------------- */
/* ---------------- 进度与读数 ---------------- */
function drawGauges(g, ctx, t, pct, heat) {
  const { W, H, sync } = ctx
  const a = span(t, 129.0, 129.6)
  if (a <= 0.01) return
  g.save()
  g.globalAlpha = a
  // ⚠️ T01 / FIX_V4 §2.1：「**取消所有角落 HUD（含 "context N%"）**」。
  // 这里原本画的是画面**左上角**的一整套常驻读数：
  //   `context ${pct}%`（15px）@ (W*0.07, H*0.10) + 一条 ctx 进度条
  //   + 内存读数 `kv … GB  growth … GB/s  heat …%`（13px,右对齐到 x=W*0.37）
  // 实测它在 t=131–146.2 一直存在（`textBoxes()` 里抓到 `context 35%/49%/68%/100%` @ (134,88) sz15）。
  // 它既属 §2.1 明令取消的角落 HUD，字号（15px / 13px）又低于 §0.5 的下限，所以整块删除。
  // 上下文数字按 §2.1 只在**段 J 的中央巨字**出现 —— 那一个由 main.js 的 `drawHud()` 画（209px ≥200）。
  g.restore()
  return
}
