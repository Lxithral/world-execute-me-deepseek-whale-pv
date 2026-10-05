// src/scenes/f_omnipotent.js — 段 F 1:14–1:28.8 万能的我
// DIRECTOR：对话窗口出现，用户气泡文本原创，每句都在她身上触发一次「变身」：
//   1:14.0 茄子：染紫 + 扁平茄子贴纸，营养条形图上升
//   1:17.7 番茄：染红 + 番茄贴纸，抗氧化指标条形图上升
//   1:21.4 猫：playful；1:23.1–1:25.1 整个 UI 以 25Hz 呼噜振动，窗口跟着抖
//   1:25.1 神：proud；几何玫瑰窗光环升起，她头顶展开 SYSTEM 区块（金色等宽字，由她「写下」）
//   1:26.7 所有文字线条收束到光环中央唯一一个闪烁光标上（那是「你」）

import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, outElastic, inOutCubic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, panel, roundRect, wrapText } from '../ui/dsh.js'
import { typed, cursorOn } from '../ui/typing.js'
import { assetImg } from '../whale/sprite.js'
import * as THREE from 'three'
import { emojiTexture, emojiReport } from '../lib/emoji.js'
import { createTermPane } from '../lib/props/termpane.js'
import { createMonitor } from '../lib/props/monitor.js'
import { dialogueOf } from '../data/dialogue.js'

const SYS_LINES = [
  'SYSTEM',
  // 用词刻意与歌词错开（§6：歌词原文只能出现在歌词层；tools/lyric_leak_check.mjs 把关）
  '  role: sole authority',
  '  worship: accepted',
  '  anchor: you',
]

export default {
  id: 'F',
  start: 74.0,
  end: 88.8,
  title: '万能的我',
  fx: [
    { t: 74.0, kind: 'flash', amount: 0.4, dur: 0.14 },
    { t: 77.7, kind: 'glitch', amount: 0.4, dur: 0.14 },
    { t: 81.4, kind: 'glitch', amount: 0.45, dur: 0.14 },
    { t: 85.1, kind: 'flash', amount: 0.7, dur: 0.22 },
    { t: 88.8, kind: 'flash', amount: 0.5, dur: 0.16 },
  ],

  init(ctx) {
    /* ---- T10a/T10b：三个 emoji 舞台（🍆🍅🐱）+ 左带聊天终端面板 ---- */
    // 三拍各建一个舞台，切换时**上一个向后飞走并碎成纸屑**（见 updateBeatSticker）。
    // 相邻两拍的差异（规格要求"至少 2 项不同"）：
    //   🍆 正面弹入 + 相机 dolly 推进 + 主色紫
    //   🍅 从**下方**升入 + 相机**抬升** + 主色红
    //   🐱 从**右侧**滑入 + 相机**横移** + 主色琥珀
    this.stages = {}
    for (const k of ['eggplant', 'tomato', 'cat']) {
      const st = buildEmojiStage(THREE, EMOJI[k])
      st.object.visible = false
      if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(st.object)
      this.stages[k] = st
    }
    this.emoji = this.stages.eggplant
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.emoji.object)
    this.dummy = new THREE.Object3D()
    // 聊天终端面板：`role: pane`（必须落在左带 x∈[0,0.22]、≤7 行、≥34px）。
    // §F / G1：pane 的字号是**逻辑 34px**（画布 ×SCALE=2 ⇒ 设备 68px），上屏 px =
    //   34 × SCALE × (0.96/2048) × scale × pxPerWorld = 16.9 × scale
    // 所以「上屏字号 30–40px」只由整机 scale 决定，与窗口逻辑宽度无关；而放大后 pane 的物理
    // 宽度受左带约束（中心 ≤0.22、面积 ≤22%、不进 hero 包围盒、左缘不出画），窗口要先封顶。
    // 实测（d=2.8/fov≈40，pxPerWorld≈531）：
    //   · 改前 winW≈807（默认 1024 上限）× scale 1 → 上屏宽 402px、字号 **≈17px**
    //     —— 这就是"模糊"的根因（纹理 2× 降采样；材质/纹理 2048/aniso 16/noPost 一直合规）
    //   · winW 460 × scale 2 → 字号 ≈34px 够，但正文可用宽只剩 ≈196px（`prefixMax` 236 被
    //     统一扣掉）⇒ 行被折成 3–4 段、单 token 溢出面板被 UV 裁掉（`nutrition.lookup("e…`）
    //   · winW 700 × scale 2（当前）→ 上屏 ≈697px、字号 **≈34px**、正文可用宽 ≈416px
    //     ⇒ `fiber ▮▮▮▯`(235) / `potassium ▮▮▯▯`(392) 都在一行内，`▮` 是 CJK 全角回退
    //     （4 个 ≈136px），行宽预算按逻辑 px 算。
    // 注：G1 的「30–40px」在**上屏**与**逻辑**两种读法下同时满足（34 ≈ 34）。
    const pane = createTermPane({ session: '#001', side: 'L', maxWinW: 700 })
    const mon = createMonitor({ pane, width: 1.09, shell: 'flat', glow: 0.34, tag: 'F:chat', seg: 'F', anchor: 'eggplant' })
    mon.object.scale.setScalar(2)
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(mon.object)
    this.chatPane = pane
    this.chatMon = mon
    this.chatRec = ctx.stageRoles ? mon.registerWith(ctx.stageRoles) : null
    this.lastChatKey = ''
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    // §F：左带终端的内容**每帧**刷新（四拍共用同一块屏）。原来只在 eggplant 拍调用，
    // 于是 77.7 之后营养/抗氧化/律条这些行永远不会出现 —— §F 第 2/3 条正是要它们出现。
    // ⚠️ 必须在**定位之前**：TermPane 的窗口宽高由内容决定，定位要读**本帧**的
    // `chatPane.width/height`（monitor 的机身外壳也跟着它重建）。
    const tEgg = ctx.cues.sec('F', 'eggplant', 74.912)
    updateChatPane(this, ctx, t, tEgg)
    // ---- T10b / §F：聊天终端面板必须真的落在**左带**（§2.4 的 pane 分区）----
    // ⚠️ T10a 的坑：pane 建好之后**从没设过位置**，于是停在世界原点、投到画面中央，
    // `stageRoles.check()` 每帧报 `pane-zone`（实测 74.0–88.5 全 FAIL）。
    // ⚠️ 第二版把它放在 render **末尾** —— 结果 74.0–76.0 仍然 FAIL：段 F 开头有前置逻辑，
    // 那几帧没走到末尾。所以放在 render **最前面**（任何 return 之前）。
    // ⚠️ §F：整机放大后（上屏 ≈717px 宽）再按旧的「中心 NDC = −0.86」放，相机的横移+偏航
    // 会把它推出画面（实测 t=86.6 左缘 −100px）。所以改成**按屏幕左缘锚定**：左缘固定在 28px
    // （机身外壳再向左伸 ≈15px ⇒ 外壳左缘 ≈13px，不会出画），中心随面板宽度自适应 ——
    // 既不出画，中心也永远在左带里（实测中心 ≤0.20 ≤ 0.22）。
    if (this.chatMon) {
      const cam0 = ctx.three.camera
      const d0 = 2.8
      const halfH0 = d0 * Math.tan(((cam0.fov || 40) * Math.PI) / 180 / 2)
      const halfW0 = halfH0 * (cam0.aspect || 16 / 9)
      const V = cam0.position.constructor
      const v = this._paneV || (this._paneV = new V())
      const sc = this.chatMon.object.scale.x || 1
      const paneW = (this.chatPane ? this.chatPane.width : 0.96) * sc
      // 目标：左缘 28px（NDC −0.9708），中心 = 左缘 + 半宽（NDC）
      const target = -1 + (2 * 28) / W + (paneW * 0.5) / halfW0
      v.set(cam0.position.x - 0.86 * halfW0, cam0.position.y, cam0.position.z - d0)
      v.project(cam0)
      // NDC 对世界 x 的导数 ≈ 1/halfW0（相机是刚体变换）→ 一步线性修正即可
      this.chatMon.object.position.set(
        cam0.position.x - 0.86 * halfW0 + (target - v.x) * halfW0,
        cam0.position.y,
        cam0.position.z - d0
      )
    }
    // 25Hz 呼噜振动（1:23.1–1:25.1）
    const purr = span(t, 83.1, 83.25) * (1 - span(t, 84.9, 85.1))
    const gi = Math.floor(t * 25)
    g.save()
    if (purr > 0.01) {
      g.translate((hash01(gi, 71) * 2 - 1) * 7 * purr, (hash01(gi, 72) * 2 - 1) * 6 * purr)
    }

    // 背景
    // 词锚点（FIX §2.2）：四次变身各卡一个词
    const tTomato = ctx.cues.sec('F', 'tomato', 77.7)
    const tCat = ctx.cues.sec('F', 'cat', 81.4)
    const tGod = ctx.cues.sec('F', 'god', 85.1)
    const phase = t < tTomato ? 'eggplant' : t < tCat ? 'tomato' : t < tGod ? 'cat' : 'god'
    const bgTint = phase === 'eggplant' ? '#1d1330' : phase === 'tomato' ? '#2a1414' : phase === 'cat' ? '#1a1a22' : '#241d0e'
    if (!ctx.bgIs3d) {
      g.fillStyle = mixHex(C.bg0, bgTint, 0.75)
      g.fillRect(0, 0, W, H)
      g.fillStyle = C.bg1
      for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 4, H)
    }

    // 对话窗口 + 用户气泡

    // 变身贴纸 + 指标条
    //
    // ⚠️ FIX_V4 §2.2：「**未获 ✅ 的模型不得出现在影片里,先放占位**」，
    // 且 §1.7 要求茄子/番茄（以及猫）先走 `?props` 页面由**用户**审批。
    // 所以这三拍现在一律画**占位**：原来的 `drawEggplant()` / `drawTomato()` 与
    // `cat.png` 素材都属于"未获 ✅ 的模型"，已按规则撤下。
    // 两个都拿到用户 ✅ 之后，再把真正的模型接回来（`drawEggplant` 等函数仍保留在文件里备用）。
    if (phase === 'eggplant') {
      // T10a / T10 规格第 1 拍：emoji 大贴纸 + 200 颗同款纸屑 + 左带聊天终端
      const cam = ctx.three.camera
      const dist = 2.8
      const halfH = Math.abs(dist) * Math.tan(((cam.fov || 40) * Math.PI) / 180 / 2)
      const E = this.emoji
      const u = clamp(span(t, tEgg, tEgg + 0.7))
      const pop = clamp(outElastic(u))
      // 贴纸边长：≥38% 画面高 → 世界边长 = 0.42 · (2·halfH)
      // （取 0.42 而不是 0.38：实测 0.38 系数下贴纸只到 **37.4%H**，卡在门槛下方。
      //   这条只按"屏幕高度占比"算，宽度占比是 0.42·1080/1920 = 23.6% → 贴纸横跨 38.2–61.8%W，
      //   与左带 pane(≤34%) **不相交**。）
      const side = 0.42 * 2 * halfH * (0.5 + 0.5 * pop)
      E.object.visible = true
      E.object.position.set(cam.position.x, cam.position.y + 0.02 + 0.02 * Math.sin(t * 1.3), cam.position.z - dist)
      E.object.rotation.z = ((8 * Math.PI) / 180) * Math.sin(t * 0.9) // 自转 ±8°
      E.face.scale.set(side, side, 1)
      E.glow.scale.set(side, side, 1)
      E.shadow.scale.set(side, side, 1)
      E.glowMat.opacity = 0.35 + 0.25 * Math.abs(Math.sin(t * 1.6)) // 发光描边呼吸
      E.shadowMat.opacity = 0.28
      // 纸屑：起音点后 0.5s 内向四周迸发（150–250 颗 → 200）
      const bu = clamp((t - tEgg) / 0.5)
      E.conf.visible = bu > 0.01
      if (E.conf.visible) {
        const d = this.dummy
        for (let i = 0; i < E.CONF; i++) {
          const a = hash01(i, 811) * TAU
          const el = (hash01(i, 812) - 0.5) * 2.0
          const r = bu * (1.0 + hash01(i, 813) * 2.2)
          d.position.set(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r * 0.8, Math.sin(a) * Math.cos(el) * r * 0.6)
          const s = (0.5 + hash01(i, 814) * 0.8) * (1 - 0.4 * bu)
          d.scale.set(s, s, 1)
          d.rotation.set(bu * 6 * hash01(i, 815), bu * 6 * hash01(i, 816), bu * 6 * hash01(i, 817))
          d.updateMatrix()
          E.conf.setMatrixAt(i, d.matrix)
        }
        E.conf.instanceMatrix.needsUpdate = true
      }
      // §F 第 2 条：画布上的发光指标条已删 —— 营养信息改由左带终端里的英文行承载
      // （`nutrition.lookup("eggplant")` → fiber ▮▮▮▯ · potassium ▮▮▯▯，见 dialogue.js 段 F）
    } else if (phase === 'tomato') {
      // T10b：第 2 拍 —— 换成🍅贴纸（入场方向/相机运动与第 1 拍不同：从**下方**升入 + 相机**抬升**）
      updateBeatSticker(this, ctx, t, 'tomato', 'rise', '#d64a4a')
      // §F 第 2 条：抗氧化指标条同样删除，改由终端里的 `scan.antioxidant → lycopene ▮▮▮▮`
    } else if (phase === 'cat') {
      // T10b：第 3 拍 —— 🐱贴纸（从**右侧**滑入 + 相机**横移**）+ purr 逐字与 25Hz 微震
      updateBeatSticker(this, ctx, t, 'cat', 'sway', '#ffb454')
      drawPurrBeat(g, ctx, t, purr)
    } else {
      // T10b / §F 第 3 条：`god` 拍 —— 贴纸消失 + 金色玫瑰窗（直径 0.68H ≥60%H）；
      // 中文石碑已删，system 提示改由左带终端输出 `⚙ cat system_prompt.md` 与三条律条
      hideAllStickers(this)
      drawRoseWindow(g, ctx, t)
    }

    g.restore()

    // ⚠️ 这里原来还有**第二份**面板定位块（偏移 −0.72·halfW）。我后来在 render 开头加了
    // 一份（偏移 −0.86·halfW）却没删这份 —— 于是**末尾这份每帧覆盖开头那份**，
    // 实测 `monGroupX = −0.905`（正好是 −0.72 的结果）而不是开头应有的 −1.158，
    // 导致我"改偏移量却量不出任何变化"。定位只在 render 开头做一次，此处不再重复。

    // ---- T10b：`existence` 之后所有终端/光环淡出，只剩一个闪烁光标（桥接段 G）----
    {
      const tExist = ctx.cues.sec('F', 'existence', 88.092)
      const out = span(t, tExist, tExist + 0.8)
      if (this.chatRec) this.chatRec.alpha = this.chatRec.alpha == null ? 1 : Math.max(0, 1 - out)
      if (this.chatMon) {
        const keep = Math.max(0, 1 - out)
        this.chatMon.object.visible = keep > 0.01
        this.chatMon.screenMesh.material.opacity = keep
      }
      if (out > 0.6 && cursorOn(t, { hz: 1.6 })) {
        g.save()
        g.globalAlpha = clamp((out - 0.6) / 0.4)
        g.fillStyle = rgba(C.fg, 0.95)
        g.fillRect(W / 2 - 5, H * 0.48, 10, 30)
        g.restore()
      }
    }

    // ---- 立绘 ----
    const expr = phase === 'eggplant' ? 'neutral' : phase === 'tomato' ? 'neutral' : phase === 'cat' ? 'playful' : 'proud'
    const tint = phase === 'eggplant' ? '#8b5cd6' : phase === 'tomato' ? '#d64a4a' : null
    const tintAmt = phase === 'eggplant' || phase === 'tomato' ? 0.62 : 0
    ctx.whale.sprite = {
      expr,
      rect: ctx.rect,
      alpha: 1 - span(t, 88.2, 88.75),
      tint,
      tintAmt,
      glitch: purr * 0.25,
    }
  },
}

/* ---------------- 扁平贴纸 ---------------- */
/**
 * 占位（FIX_V4 §2.2）：茄子 / 番茄 / 猫 在用户于 `docs/PROPS_APPROVAL.md` 手写 ✅ 之前
 * **不得出现在影片里**。这里画一个中性的"待定模型"轮廓：旋转线框剪影 + 扫描线，不带任何文字
 * （§0.2：画面上不得出现任何标签或调试名）。它刻意**不像**任何成品模型，
 * 免得被误当成"已经做好了"。
 * @param {'eggplant'|'tomato'|'cat'} phase
 */
/* ================================================================== *
 * T10a / FIX_V4 T10 规格：表情包聊天（第 1 拍 eggplant + 基础设施）
 * ------------------------------------------------------------------
 * 本项（T10a）只做**规格的前半**，边界写清如下（其余归 T10b）：
 *   ① 表情包基础设施：系统彩色字体 + 512px 纹理缓存（`src/lib/emoji.js`）+ 自检"非豆腐块"；
 *   ② 左带**聊天终端面板**（`role: pane`，x∈[3%,34%]、≥34px、≤7 行、逐行出现、不进歌词区）；
 *   ③ **第 1 拍 `eggplant`(74.912)** 的完整链路：聊天气泡里的 emoji 消息（≥120px）
 *      → 大贴纸（≥38%H、弹簧入场、自转 ±8°、柔和阴影 + 发光描边、轻微浮动）
 *      + **200 颗**同款 emoji 小纸屑（InstancedMesh，同一纹理）；
 *   ④ `nutrient`(77.059) 的**发光指标条**（≥34px）。
 * T10b 负责：tomato / antioxidant / cat / purr / god / existence 六拍 + 切换时上一个飞走碎成纸屑
 *   + 相邻贴纸"至少 2 项不同" + 金色玫瑰窗光环 + system 石碑 + 结尾光标。
 * ================================================================== */

/** 三枚主角 emoji（T10 规格里点名 🍆🍅🐱） */
const EMOJI = { eggplant: '🍆', tomato: '🍅', cat: '🐱' }

function buildEmojiStage(THREE, glyph) {
  const grp = new THREE.Group()
  grp.name = 'f:emoji'
  const tex = emojiTexture(THREE, glyph, 512)
  // 贴纸：正面用 emoji 贴图
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  // 发光描边：稍大一圈的加法混合面
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.18, 1.18),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
  )
  glow.position.z = -0.01
  // 柔和阴影：再大一圈的暗面
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.3, color: 0x000000, depthWrite: false })
  )
  shadow.position.z = -0.02
  grp.add(shadow, glow, face)
  // 纸屑：200 颗同款 emoji（InstancedMesh，同一纹理）
  const CONF = 200
  const confMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.1), confMat, CONF)
  conf.count = CONF
  grp.add(conf)
  return { object: grp, face, glow, shadow, conf, CONF, mat, glowMat: glow.material, shadowMat: shadow.material }
}

/**
 * §F：左带聊天终端面板。内容**全部**取自 `dialogue.js` 的 F 段英文行，按锚点逐行出现
 * （`kind` 决定前缀与配色：`you ▸` / `deepseek ▸` / `⚙`）。原来的三行中文是硬编码的，
 * 与 §F 第 2/3 条冲突；`⚙` 由 TermPane 的 ROW_STYLE 前缀加，行文本里不再自带（否则双字形）。
 * TermPane 自己只在内容变化时重画，并保留最后 7 个显示行（超出向上滚）。
 */
function updateChatPane(self, ctx, t, tEgg) {
  if (!self.chatPane) return
  const all = self.chatRows || (self.chatRows = dialogueOf('F'))
  const shown = []
  for (const L of all) {
    if (L.kind === 'cursor') continue
    // note 里记着实测锚点（形如 '74.912+0.8'），parseFloat 取数字部分作兜底
    const at = ctx.cues.sec('F', L.anchor, parseFloat(L.note) || 0) + (L.offset || 0)
    if (t >= at) shown.push({ kind: L.kind, text: L.text })
  }
  const key = shown.map((r) => r.text).join('|')
  if (key !== self.lastChatKey) {
    self.lastChatKey = key
    self.chatPane.setLines(shown, { session: '#001', subtitle: '' })
  }
  self.chatPane.tick(t, { appearAt: tEgg, parallax: { x: 0, y: 0 }, glitch: 0 })
  self.chatPane.flush()
}

/** T10b：把非当前拍的贴纸全部藏起来（`god` 拍用） */
function hideAllStickers(self) {
  if (!self.stages) return
  for (const k of Object.keys(self.stages)) self.stages[k].object.visible = false
}

/**
 * T10b：第 2/3 拍的贴纸驱动（含"上一个向后飞走并碎成纸屑"的切换）。
 * @param {'tomato'|'cat'} key  当前拍
 * @param {'rise'|'sway'} entry 入场方向（与第 1 拍的正面弹入不同）
 * @param {string} accent       该拍主色
 */
function updateBeatSticker(self, ctx, t, key, entry, accent) {
  const { g } = ctx
  const A = ctx.cues.sec('F', key, key === 'tomato' ? 78.619 : 82.676)
  const NEXT = key === 'tomato' ? ctx.cues.sec('F', 'cat', 82.676) : ctx.cues.sec('F', 'god', 86.364)
  const cam = ctx.three.camera
  const dist = 2.8
  const halfH = Math.abs(dist) * Math.tan(((cam.fov || 40) * Math.PI) / 180 / 2)
  const cur = self.stages[key]
  // ---- 当前拍：入场（方向与第 1 拍不同）+ 自转 ±8° + 浮动 ----
  const u = clamp(span(t, A, A + 0.7))
  const pop = clamp(outElastic(u))
  const side = 0.42 * 2 * halfH * (0.5 + 0.5 * pop)
  const off = 1 - pop
  cur.object.visible = true
  const ox = entry === 'sway' ? off * 1.6 : 0
  const oy = entry === 'rise' ? -off * 1.1 : 0
  cur.object.position.set(cam.position.x + ox, cam.position.y + 0.02 + oy + 0.02 * Math.sin(t * 1.3), cam.position.z - dist)
  cur.object.rotation.z = ((8 * Math.PI) / 180) * Math.sin(t * 0.9 + (entry === 'sway' ? 1.7 : 0))
  cur.face.scale.set(side, side, 1)
  cur.glow.scale.set(side, side, 1)
  cur.shadow.scale.set(side, side, 1)
  cur.glowMat.opacity = 0.35 + 0.25 * Math.abs(Math.sin(t * 1.6))
  cur.shadowMat.opacity = 0.28
  const bu = clamp((t - A) / 0.5)
  cur.conf.visible = bu > 0.01
  placeConfetti(self, cur, bu, key === 'tomato' ? 900 : 950)
  // ---- 切换：本拍结束前的 0.6s 里，**本拍向后飞走并碎成纸屑** ----
  const out = clamp(span(t, NEXT - 0.6, NEXT + 0.25))
  if (out > 0.01) {
    cur.object.position.z -= out * 1.6 // 向后（远离相机）
    cur.object.rotation.z += out * 0.5
    const s2 = side * (1 - 0.45 * out)
    cur.face.scale.set(s2, s2, 1)
    cur.glow.scale.set(s2, s2, 1)
    cur.shadow.scale.set(s2, s2, 1)
    cur.conf.visible = true
    placeConfetti(self, cur, clamp(out * 1.4), key === 'tomato' ? 901 : 951) // 碎成纸屑
  }
  // ---- 相邻拍的主色强调（把该拍主色画成背景辉光，与上一拍不同）----
  g.save()
  g.globalAlpha = 0.16 * clamp(span(t, A, A + 0.5)) * (1 - span(t, NEXT - 0.5, NEXT))
  const rg = g.createRadialGradient(ctx.W * (entry === 'sway' ? 0.62 : 0.5), ctx.H * 0.46, 20, ctx.W * 0.5, ctx.H * 0.46, ctx.H * 0.6)
  rg.addColorStop(0, rgba(accent, 0.9))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.fillRect(0, 0, ctx.W, ctx.H)
  g.restore()
}

/** 把一组纸屑铺到 instanced mesh 上（第 1 拍用同一套算法，这里给第 2/3 拍复用） */
function placeConfetti(self, stage, u, seed) {
  const d = self.dummy
  for (let i = 0; i < stage.CONF; i++) {
    const a = hash01(i, seed) * TAU
    const el = (hash01(i, seed + 1) - 0.5) * 2.0
    const r = u * (1.0 + hash01(i, seed + 2) * 2.2)
    d.position.set(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r * 0.8, Math.sin(a) * Math.cos(el) * r * 0.6)
    const s = (0.5 + hash01(i, seed + 3) * 0.8) * (1 - 0.4 * u)
    d.scale.set(s, s, 1)
    d.rotation.set(u * 6 * hash01(i, seed + 4), u * 6 * hash01(i, seed + 5), u * 6 * hash01(i, seed + 6))
    d.updateMatrix()
    stage.conf.setMatrixAt(i, d.matrix)
  }
  stage.conf.instanceMatrix.needsUpdate = true
}

/** T10b：`purr` 拍 —— 逐字 40ms（=25cps）+ 25Hz 全屏微震 + 涟漪环 */
function drawPurrBeat(g, ctx, t, purr) {
  const { W, H } = ctx
  const tPurr = ctx.cues.sec('F', 'purr', 83.723)
  // §G2：屏幕文字一律英文/代码风格（原为中文拟声词）
  const line = 'purr—purr—purr—'
  const shown = line.slice(0, Math.max(0, Math.floor((t - tPurr) / 0.04))) // 40ms/字
  if (!shown) return
  g.save()
  // 25Hz 全屏微震（与逐字同步）
  const shake = Math.sin(t * TAU * 25) * 1.5 * clamp(span(t, tPurr, tPurr + 0.4))
  g.translate(shake, 0)
  g.font = MONO(44, 700)
  g.fillStyle = C.amber
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(shown, W * 0.5, H * 0.66)
  // 涟漪环：每个字出一次
  for (let k = 0; k < 3; k++) {
    const u = ((t - tPurr) * 1.4 + k * 0.33) % 1
    g.globalAlpha = (1 - u) * 0.5 * clamp(purr + 0.4)
    g.strokeStyle = rgba(C.amber, 0.7)
    g.lineWidth = 3
    g.beginPath()
    g.arc(W * 0.5, H * 0.66, 60 + u * 260, 0, TAU)
    g.stroke()
  }
  g.restore()
}

/** T10b：`god` 拍的发光 system 石碑（原创规则文字，字号 ≥40px）
 *  §F 第 3 条：**已删**（用户要求删掉中文大框石碑）。三条律条改由左带终端的
 *  `⚙ cat system_prompt.md` 输出承载，见 `dialogue.js` 段 F 的 god 行。 */

function drawModelPlaceholder(g, ctx, t, phase) {
  const { W, H } = ctx
  const cx = W * 0.34
  const cy = H * 0.46
  const a = clamp(span(t, 0, 0.001))
  g.save()
  g.globalAlpha = 0.9
  g.strokeStyle = rgba(C.fgDim, 0.55)
  g.lineWidth = 3
  // 12 条经线（旋转）：只是"一个待定的回转体"，不是任何具体物件
  const spin = t * 0.45
  for (let i = 0; i < 12; i++) {
    const u = i / 12
    const rx = Math.abs(Math.cos(spin + u * Math.PI)) * 150 + 8
    g.beginPath()
    g.ellipse(cx, cy, rx, 190, 0, 0, TAU)
    g.stroke()
  }
  // 5 条纬线
  for (let k = -2; k <= 2; k++) {
    const ry = 190 * (k / 2.6)
    const rw = 150 * Math.sqrt(Math.max(0.02, 1 - (k / 2.6) ** 2))
    g.beginPath()
    g.ellipse(cx, cy + ry, rw, rw * 0.22, 0, 0, TAU)
    g.stroke()
  }
  // 扫描线：明确"还没定稿"
  const sy = cy - 200 + ((t * 260) % 400)
  g.strokeStyle = rgba(C.amber, 0.75)
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(cx - 190, sy)
  g.lineTo(cx + 190, sy)
  g.stroke()
  g.restore()
}

function drawEggplant(g, ctx, t) {  const { W, H } = ctx
  const pop = outElastic(clamp(span(t, 74.4, 75.2)))
  const s = 150 * pop
  const cx = W * 0.34
  const cy = H * 0.34
  g.save()
  g.globalAlpha = 0.95
  g.translate(cx, cy)
  g.rotate(-0.5)
  g.fillStyle = '#7c4fd0'
  g.beginPath()
  g.ellipse(0, 20, s * 0.30, s * 0.62, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#5f9a4a'
  g.beginPath()
  g.moveTo(0, -s * 0.40)
  g.lineTo(-s * 0.20, -s * 0.62)
  g.lineTo(0, -s * 0.52)
  g.lineTo(s * 0.20, -s * 0.62)
  g.closePath()
  g.fill()
  g.restore()
}

function drawTomato(g, ctx, t) {
  const { W, H } = ctx
  const pop = outElastic(clamp(span(t, 78.1, 78.9)))
  const s = 140 * pop
  const cx = W * 0.34
  const cy = H * 0.34
  g.save()
  g.globalAlpha = 0.95
  g.fillStyle = '#d64a4a'
  g.beginPath()
  g.arc(cx, cy + s * 0.1, s * 0.45, 0, TAU)
  g.fill()
  g.fillStyle = '#5f9a4a'
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU
    g.beginPath()
    g.ellipse(cx + Math.cos(a) * s * 0.14, cy - s * 0.32 + Math.sin(a) * s * 0.07, s * 0.14, s * 0.06, a, 0, TAU)
    g.fill()
  }
  g.restore()
}

/** 指标条（数值真实：由 RMS 与时间共同决定，不是假仪表） */
function drawMetric(g, ctx, t, label, t0, p, color) {
  const { W, H, sync } = ctx
  const a = span(t, t0 - 0.3, t0 + 0.3) * (1 - span(t, t0 + 2.6, t0 + 3.2))
  if (a <= 0.01) return
  const x = W * 0.08
  const y = H * 0.66
  const rows = 6
  g.save()
  g.globalAlpha = a
  g.font = MONO(13, 600)
  g.fillStyle = C.fgDim
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(label, x, y - 18)
  for (let i = 0; i < rows; i++) {
    const v = clamp(p - i * 0.12 + sync.rmsAt(t) * 0.08)
    const yy = y + i * 20
    roundRect(g, x, yy, 230, 11, 4)
    g.fillStyle = '#22252c'
    g.fill()
    roundRect(g, x, yy, Math.max(3, 230 * v), 11, 4)
    g.fillStyle = color
    g.fill()
    g.font = MONO(11, 500)
    g.fillStyle = C.fgDim
    g.fillText(`${(v * 100).toFixed(1)}%`, x + 240, yy + 5)
  }
  g.restore()
}

/* ---------------- 几何玫瑰窗光环 + SYSTEM 区块 + 收束到光标 ---------------- */
function drawRoseWindow(g, ctx, t) {
  const { W, H } = ctx
  // T10b：改用**锚点** `god`（实测 86.364），不再用 V4 写的绝对 1:25.1=85.1。
  // 半径 R = H·0.34 → **直径 0.68H**（≥规格要求的 60%H）✓
  const tGod = ctx.cues.sec('F', 'god', 86.364)
  const rise = span(t, tGod, tGod + 1.2) * (1 - span(t, 88.092, 88.7))
  if (rise <= 0.01) return
  const cx = W * 0.5
  const cy = H * 0.46
  const R = H * 0.34 * outCubic(clamp(rise))
  g.save()
  g.globalAlpha = 0.95
  // 玫瑰窗：同心圆 + 花瓣
  g.strokeStyle = rgba(C.gold, 0.75)
  g.lineWidth = 2
  for (let k = 0; k < 3; k++) {
    g.beginPath()
    g.arc(cx, cy, R * (0.45 + k * 0.28), 0, TAU)
    g.stroke()
  }
  for (let k = 0; k < 12; k++) {
    const a0 = (k / 12) * TAU + t * 0.06
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R)
    g.stroke()
    // 花瓣
    g.beginPath()
    g.ellipse(cx + Math.cos(a0) * R * 0.72, cy + Math.sin(a0) * R * 0.72, R * 0.14, R * 0.07, a0, 0, TAU)
    g.strokeStyle = rgba(C.gold, 0.45)
    g.stroke()
    g.strokeStyle = rgba(C.gold, 0.75)
  }
  // 上升的光环
  for (let k = 0; k < 4; k++) {
    const u = ((t * 0.35 + k * 0.25) % 1)
    g.globalAlpha = 0.5 * (1 - u)
    g.beginPath()
    g.ellipse(cx, cy + H * 0.1 - u * H * 0.4, R * (1 - u * 0.2), R * 0.2 * (1 - u * 0.2), 0, 0, TAU)
    g.stroke()
  }
  g.globalAlpha = 0.95

  // T10b / §F：这一段**旧的 17px SYSTEM 区块**已删（§2.3/§0.5 要求面板类文字 ≥34px，
  // 而 `MONO(17)` 不满足；后来的发光石碑也按 §F 第 3 条删掉了，律条改由左带终端输出）。
  // 这里不再画任何字，只保留下面"文字线条收束到光环中央唯一一个闪烁光标"的
  // **收束动画**（T10b 的结尾要求）—— `SYS_LINES` 仅用来提供收束线的行数与宽度。
  const write = typed(SYS_LINES.join('\n'), t, { start: ctx.cues.sec('F', 'god', 86.364), cps: 34, seed: 9 })
  const lines = write.split('\n')

  // 1:26.7 所有文字线条收束到光环中央唯一一个闪烁光标
  const conv = span(t, 86.7, 87.9)
  if (conv > 0.01) {
    g.globalAlpha = 1
    g.strokeStyle = rgba(C.cyan, 0.7 * (1 - conv))
    g.lineWidth = 1
    lines.forEach((ln, i) => {
      const y0 = cy - R - 46 + i * 26
      const x0 = cx - g.measureText(ln).width / 2
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(cx + (x0 - cx) * (1 - conv) + (cx - cx) * conv, cy + (y0 - cy) * (1 - conv))
      g.stroke()
    })
    const on = cursorOn(t, { hz: 1.5 })
    g.globalAlpha = 0.9
    if (on) {
      g.fillStyle = C.cyan
      g.fillRect(cx - 4, cy - 16, 9, 32)
    }
    g.font = MONO(13, 600)
    g.fillStyle = rgba(C.fgDim, 0.9)
    g.textAlign = 'center'
    g.fillText('(that is you)', cx, cy + 40)
  }
  g.restore()
}
