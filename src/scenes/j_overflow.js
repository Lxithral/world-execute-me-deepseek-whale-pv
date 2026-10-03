// src/scenes/j_overflow.js — 段 J 2:09–2:27.9 溢出（纯器乐，红色段）
// DIRECTOR：底色转红警报；KV Cache 内存格：分配→标记→清扫→压缩，旁边滚动 hexdump；
// 窗口无限递归缩放；ctxAt 加速到 100%；2:25 全屏 context limit reached；2:26.5 黑场，
// 红字重新键入 dsh --resume；2:27.8 静默一帧。

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, hexdump, nestedWindow, roundRect, ctxAt } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { kvSchedule } from '../lib/tables.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'

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
    }

    if (!quiet) {      // KV Cache 内存格
      drawKvGrid(g, ctx, t, this.kv, alarm)
      // hexdump
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
      // 窗口无限递归缩放
      drawRecursiveWindows(g, ctx, t, heat)
      // 进度与读数
      drawGauges(g, ctx, t, pct, heat)
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
      const s = typed(RESUME, t, { start: 147.0, cps: 12, seed: 3 })
      if (s) {
        g.font = MONO(46, 700)
        g.fillStyle = C.red
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        const x = W / 2 - 260
        g.fillText('> ' + s, x, H * 0.5)
        const wpx = g.measureText('> ' + s).width
        if (cursorOn(t, { hz: 1.1 })) {
          g.fillStyle = C.red
          g.fillRect(x + wpx + 4, H * 0.5 - 24, 14, 46)
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
function drawKvGrid(g, ctx, t, kv, alarm) {
  const { W, H } = ctx
  const a = span(t, 130.4, 131.2) * (1 - span(t, 145.5, 146.3))
  if (a <= 0.01) return
  const x0 = W * 0.07
  const y0 = H * 0.30
  const cw = (W * 0.48) / KV_COLS
  const ch = (H * 0.42) / KV_ROWS
  g.save()
  g.globalAlpha = a
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  g.fillText('KV cache · alloc → mark → sweep → compact', x0, y0 - 16)
  for (let i = 0; i < kv.length; i++) {
    const c = kv[i]
    const r = Math.floor(i / KV_COLS)
    const cc = i % KV_COLS
    const x = x0 + cc * cw
    const y = y0 + r * ch
    let color = 'rgba(40,44,52,0.9)'
    let label = ''
    if (t >= c.compactT) { color = 'rgba(28,74,52,0.95)'; label = 'C' }
    else if (t >= c.sweepT) { color = 'rgba(80,60,20,0.95)'; label = 'S' }
    else if (t >= c.markT) { color = 'rgba(120,40,40,0.95)'; label = 'M' }
    else if (t >= c.allocT) { color = 'rgba(30,60,90,0.95)'; label = 'A' }
    roundRect(g, x + 2, y + 2, cw - 4, ch - 4, 3)
    g.fillStyle = color
    g.fill()
    g.strokeStyle = rgba(C.red, 0.25 * alarm)
    g.lineWidth = 1
    g.stroke()
    if (label && cw > 22) {
      g.font = MONO(10, 700)
      g.fillStyle = rgba(C.fg, 0.75)
      g.fillText(label, x + 7, y + ch / 2 + 4)
    }
  }
  // 图例
  g.font = MONO(11, 500)
  g.fillStyle = rgba(C.fgDim, 0.85)
  const ly = y0 + KV_ROWS * ch + 22
  const legend = [['A alloc', '#1e3c5a'], ['M mark', '#782828'], ['S sweep', '#503c14'], ['C compact', '#1c4a34']]
  legend.forEach(([txt, col], i) => {
    g.fillStyle = col
    g.fillRect(x0 + i * 130, ly - 9, 14, 11)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.fillText(txt, x0 + i * 130 + 20, ly)
  })
  g.restore()
}

/* ---------------- 无限递归窗口 ---------------- */
function drawRecursiveWindows(g, ctx, t, heat) {
  const { W, H } = ctx
  const a = span(t, 131.6, 132.4) * (1 - span(t, 145.0, 145.8))
  if (a <= 0.01) return
  const n = 7
  const cx = W / 2
  const cy = H * 0.52
  g.save()
  for (let k = 0; k < n; k++) {
    const u = k / n
    const w = W * 0.86 * (1 - u * 0.72)
    const h = H * 0.82 * (1 - u * 0.72)
    g.globalAlpha = a * (0.10 + u * 0.35)
    nestedWindow(g, { x: cx - w / 2, y: cy - h / 2, w, h, depth: k, alpha: 1, label: k === 0 ? 'session #001' : '' })
  }
  g.restore()
}

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
