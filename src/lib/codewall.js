// src/lib/codewall.js — 代码墙（FIX.md §2.8）
//
// FIX 原文要求逐条落实：
//   · `codeWall({lang, fontPx≥40, layers, speed})` —— 签名照写；
//   · 大字号、带**语法高亮**的**原创**代码绘到 canvas 纹理，贴到 3D 空间里**多层平面**（景深、视差、缓慢滚动）；
//   · 可围成走廊 / 墙面 / 穹顶；
//   · 代码是视觉素材，不是终端：**不画命令提示符、不画日志滚屏**；
//   · 七种语言各自成段。

import * as THREE from 'three'
import { clamp, span, TAU } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { text, TEXT_MIN, setTextureSpace } from '../ui/text.js'
import { LANGS, LANG_COLORS, SNIPPETS, SNIPPET_FILES, KEYWORDS } from './snippets.js'

/** 语法高亮的配色（与 palette 的语系一致：青/紫/绿/琥珀） */
export const SYN_COLORS = {
  kw: '#ff8fc8',
  str: '#8ff0a4',
  num: '#ffd479',
  com: '#5f7d9a',
  fn: '#7fd8ff',
  punct: '#9fb0c4',
  plain: '#d6dee9',
}

/** 极简分词器：字符串 / 注释 / 数字 / 关键字 / 其余 */
export function tokenize(lang, line) {
  const kws = new Set((KEYWORDS[lang] || []).map((k) => k.toLowerCase()))
  const out = []
  let i = 0
  const push = (t, k) => t && out.push({ t, k })
  while (i < line.length) {
    const ch = line[i]
    // 注释
    if ((line.startsWith('--', i) && lang === 'sql') || (ch === '#' && lang === 'python') || (line.startsWith('//', i) && lang !== 'python')) {
      push(line.slice(i), 'com')
      break
    }
    // 字符串
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length && line[j] !== ch) {
        if (line[j] === '\\') j++
        j++
      }
      push(line.slice(i, Math.min(line.length, j + 1)), 'str')
      i = j + 1
      continue
    }
    // 数字
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < line.length && /[0-9a-fA-Fx._eE+-]/.test(line[j])) {
        // 避免把 `x - 1` 里的减号吃进来
        if ((line[j] === '-' || line[j] === '+') && !/[eE]/.test(line[j - 1])) break
        j++
      }
      push(line.slice(i, j), 'num')
      i = j
      continue
    }
    // 标识符 / 关键字
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++
      const word = line.slice(i, j)
      const k = kws.has(word.toLowerCase()) ? 'kw' : line[j] === '(' ? 'fn' : 'plain'
      push(word, k)
      i = j
      continue
    }
    // 其余（含空白与标点）
    let j = i
    while (j < line.length && !/[A-Za-z0-9_"'`#]/.test(line[j]) && !(line.startsWith('--', j) && lang === 'sql')) j++
    if (j === i) j = i + 1
    push(line.slice(i, j), 'punct')
    i = j
  }
  return out
}

/** 把一段代码画成 canvas（带语法高亮），返回 {canvas, texture} */
export function renderCodeCanvas(lang, { fontPx = 44, width = 1536, height = 960, pad = 40, bg = null, bgAlpha = 0.9, dark = 1, alpha = 1, file = 0 } = {}) {
  if (fontPx < TEXT_MIN.codeWall) {
    throw new Error(`[codewall] fontPx=${fontPx} 低于 §0.5 的代码墙下限 ${TEXT_MIN.codeWall}px`)
  }
  // file：同语言的第几个片段。多层代码墙必须每层给**不同**的 file，
  // 否则屏幕上会看到同一句话以两个大小叠在一起（像重影，不像景深）。
  const files = SNIPPET_FILES[lang] || [SNIPPETS[lang] || SNIPPETS.python]
  const lines = files[((file % files.length) + files.length) % files.length]
  // dark：整层的明暗系数（0..1）。**景深必须烘进 canvas**，不能靠材质 color/opacity ——
  // 材质是共享的同一份纹理，改材质会把所有层一起改亮（实测：景深系数被 update() 覆盖成 1，
  // 于是后面所有层的代码都以全亮度透出来，屏幕上两组字叠成一团）。
  const D = Math.max(0, Math.min(1, dark))
  const cv = document.createElement('canvas')
  cv.width = width
  cv.height = height
  const g = cv.getContext('2d')
  g.clearRect(0, 0, width, height)
  if (bg !== false) {
    // 底色**不透明**：这是"层层景深"能成立的前提 ——
    // 近层的暗底把远层**完全挡住**，远层只从更大的边缘透出来，读起来才是纵深。
    // 第一版底色带 alpha、整层再乘 0.3–0.9 的材质 opacity，结果每层的字都从
    // 前面那层透出来，屏幕上两组代码重叠成一团糊（改了六轮才定位到这里）。
    // ⚠️ FIX_V4 §1.2 改判（优先于上面 F2b 的取舍）：
    //   「**删除这个黑色矩形背板**。代码文字直接作为悬浮的发光大字出现,不要不透明底板;
    //     若需要衬底,**最多一层 alpha ≤0.12 的暗色渐变**。」
    //   所以这里不再铺不透明底：只留一层极淡的暗色**渐变**（α 上限 0.12）。
    //   深度感仍旧由"把 dark 烘进**文字颜色**"承担（下面画字时乘 D），
    //   也就是"近层字亮、远层字暗"，不再依赖"近层暗底挡远层"。
    //   ⚠️ 材质必须是 `transparent: true` 才能让这里的 alpha 生效（构造处已设）。
    const BASE_A = Math.max(0, Math.min(0.12, bgAlpha))
    if (BASE_A > 0.001) {
      const grd = g.createLinearGradient(0, 0, 0, height)
      grd.addColorStop(0, `rgba(5,9,15,${(BASE_A * D).toFixed(4)})`)
      grd.addColorStop(1, `rgba(5,9,15,${(BASE_A * 0.35 * D).toFixed(4)})`)
      g.fillStyle = grd
      g.fillRect(0, 0, width, height)
    }
  }
  const lh = Math.round(fontPx * 1.46)
  const y0 = pad + fontPx
  // 这块 canvas 是**贴图**，坐标与屏幕无关 → 期间关闭 §2.8 的屏幕包围盒登记，
  // 否则同一块画布上的每一行都会被记成"在同一处重叠"（第一版就是这样报假阳性的）。
  setTextureSpace(true)
  // 顶部一条细的强调线（是"视觉素材"的版式，不是终端提示符）
  g.strokeStyle = LANG_COLORS[lang] || '#7fd8ff'
  g.globalAlpha = 0.5 * alpha
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(pad, pad * 0.5)
  g.lineTo(pad + 150, pad * 0.5)
  g.stroke()
  g.globalAlpha = 1

  for (let i = 0; i < lines.length; i++) {
    const y = y0 + i * lh
    if (y > height - pad * 0.6) break
    let x = pad
    for (const tk of tokenize(lang, lines[i])) {
      const col = SYN_COLORS[tk.k] || SYN_COLORS.plain
      // 统一走 text() 入口 → 受 §0.5 字号守卫约束（role='codeWall'）；
      // alpha 乘上景深系数 D，远层整体压暗
      const w = text(g, tk.t, x, y, { role: 'codeWall', size: fontPx, family: 'code', weight: 500, color: col, alpha: alpha * D })
      x += w
      if (x > width - pad * 0.4) break
    }
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  // 贴图画完了，恢复屏幕包围盒登记
  setTextureSpace(false)
  // 平面几乎是正对相机的（走廊两侧最多斜 24°），开 mipmap 只会让远处那几层
  // 被降采样成一团模糊的光斑 —— 而"代码要能读"是 §2.8 的硬要求。
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return { canvas: cv, texture: tex, lines: lines.length, fontPx, lh, file }
}

/** 三种布局的平面摆放（单位：世界单位，屏幕半高=1） */
function layoutPlanes(kind, layers) {
  const out = []
  if (kind === 'corridor') {
    // 走廊：《§3 段 B》要的是"大字号多语言代码墙"构成的走廊。
    // 三条硬约束在这里打架，取舍如下：
    //   ① §2.8「代码是视觉素材，要能读」→ 板子必须**大体正对相机**（转成 90° 侧壁后字被压成一条线）；
    //   ② "多层景深"→ 板子必须在不同深度；
    //   ③ 同屏不得出现"两组字叠在一起"（那会被读成重影，而不是景深）。
    // 做法：**每层都按自己的深度缩放到"正好铺满画面"**，并在 x/y 上轻微错开 ——
    // 于是一串板子像走廊里一重重门：每块都填满画面、都清楚，
    // 近层盖住远层（不透明 + 显式 renderOrder），远层只从近层的边缘与缝隙里露出来。
    // x/y 错开量刻意小于"近层比远层多出来的那一圈"，
    // 所以远层在屏幕上永远落在近层的**内部**，绝不会出现两组字并排重叠。
    for (let i = 0; i < layers; i++) {
      const u = layers === 1 ? 0 : i / (layers - 1)
      const z = -0.8 - i * 3.4 // 相机在 z≈5.6 → 距离 6.4 / 9.8 / 13.2 …
      const k = (z - -0.8) / 3.4
      // 按深度等比放大，使屏幕尺寸恒定
      const s = 1 + 0.53 * k
      const side = i === 0 ? 0 : i % 2 === 0 ? 1 : -1
      out.push({
        pos: [side * 0.22 * k, Math.sin(i * 2.1) * 0.1, z],
        rot: [0, side * 0.07, side * 0.02],
        scale: s,
        u,
      })
    }
    return out
  }
  for (let i = 0; i < layers; i++) {
    const u = layers === 1 ? 0 : i / (layers - 1)
    if (kind === 'dome') {
      // 穹顶：绕一圈
      const a = (i / layers) * TAU
      const r = 4.2
      out.push({ pos: [Math.sin(a) * r, 0.25, Math.cos(a) * r], rot: [0, a + Math.PI, 0.04 * Math.sin(i * 1.7)], scale: 0.9, u })
    } else {
      // 墙面：多层景深，交错错位
      out.push({
        pos: [((i % 3) - 1) * 1.9, 0.14 * ((i % 2) * 2 - 1), -1.0 - i * 1.9],
        rot: [0, ((i % 2) * 2 - 1) * 0.16, 0],
        scale: 1.05 - 0.05 * (i % 3),
        u,
      })
    }
  }
  return out
}

/**
 * 画布像素 / 世界单位。选 400 的理由：这个比例下 fontPx=44 的一行 ≈ 0.16 世界单位，
 * 而"世界单位 1 = 半屏高"（1080p 上 540px）→ 屏幕上每行 ≈ 87px，
 * 即使平面被放到很远的层也远高于 §0.5 的「代码墙主体 ≥40px」。
 */
export const PX_PER_UNIT = 480

/**
 * 代码墙。
 * @param {{lang?:string, langs?:string[], fontPx?:number, layers?:number, speed?:number,
 *          layout?:'wall'|'corridor'|'dome', width?:number, height?:number, cycle?:number}} [opts]
 *   lang   单一语言（不给则按 langs 轮换，默认七种语言各自一层）
 *   speed  沿 z 的流动速度（世界单位/秒）
 *   cycle  重复周期（世界单位），平面绕它循环
 */
export function codeWall(opts = {}) {
  const {
    lang = null,
    langs = LANGS,
    fontPx = 52, // FIX §2.8 要求 ≥40（默认给 52，屏幕上一行 ≈ 100px，明确可读）
    layers = 7,
    speed = 0.55,
    layout = 'wall',
    width = 4.6,
    height = 2.9,
    cycle = 13,
  } = opts
  if (fontPx < TEXT_MIN.codeWall) throw new Error(`[codewall] fontPx=${fontPx} < ${TEXT_MIN.codeWall}`)

  const grp = new THREE.Group()
  grp.name = `codeWall:${layout}`

  const slots = layoutPlanes(layout, layers)
  const entries = []
  for (let i = 0; i < slots.length; i++) {
    const L = lang || langs[i % langs.length]
    // 画布宽高比**严格等于**平面宽高比（世界尺度 × PX_PER_UNIT），
    // 否则字体会被拉伸、字号约定也失去意义。
    const wUnits = width * slots[i].scale
    const hUnits = height * slots[i].scale
    const cw = Math.max(256, Math.round(wUnits * PX_PER_UNIT))
    const ch = Math.max(256, Math.round(hUnits * PX_PER_UNIT))
    // 每层换一个代码片段：同内容多层 = 重影，不是景深
    const file = i % ((SNIPPET_FILES[L] && SNIPPET_FILES[L].length) || 1)
    // 底色不透明度按层序递减；**明暗系数也一并烘进 canvas**（暗 = 远）
    const bgAlpha = 0.99 - 0.2 * slots[i].u
    const dark = 1 - 0.62 * slots[i].u
    const { texture, fontPx: fp, lines } = renderCodeCanvas(L, { fontPx, width: cw, height: ch, file, bgAlpha, dark })
    // 每行在**屏幕上**的高度（世界单位）= 行高像素 / PX_PER_UNIT
    const lineUnits = (fp * 1.46) / PX_PER_UNIT
    // 用**普通透明混合**而不是加法：加法下多层叠加会把文字糊成一片（实测读不出代码），
    // 而 §2.8 的"层层景深"要靠明暗差异表达，不是靠亮度累加。
    // 单面渲染：设成 DoubleSide 时每块代码板会把自己的**镜像**再叠一遍
    // （背面被渲染出来），文字直接糊掉 —— 实测第一版就是这样。
    // opacity 提到 0.9 以上：整层的透明度会把"近层挡住远层"这件事废掉（详见 renderCodeCanvas 的注释），
    // 景深交给 canvas 里的底色不透明度 + 这里的明暗系数去做。
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      // ⚠️ 这里曾经是 `transparent: false`，然后在 update() 里**每帧**按 alpha 反写
      // `mat.transparent = alpha < 0.999`。那是个真 bug（FIX_V3 §0「渲染路径必须是 f(t) 的纯函数」）：
      //   · `material.transparent` 会进 three 的**着色器程序缓存键** —— 一旦来回翻转，
      //     同一块板子会在两个程序之间来回切换、反复重编译；
      //   · 重编译那一帧的绘制结果与之后几帧不同 → 实测 `?selftest` a) 在
      //     **t=53.48（段 D 代码墙淡出）与 t=70.64（段 E）** 报出"乱序 24 点差 2"，
      //     且逐帧测量呈现"第 1 次渲染 566419 像素不同、第 2..6 次完全相同"的**一次性初始化**签名。
      // 现在 `transparent` **在构造时定死为 true、之后永不改动**：
      //   · 程序只编译一次，不再有"某一帧迟到"的差异；
      //   · 遮挡仍然正确 —— 真正保证层序的是下面**显式 renderOrder**（近层后画）+ `depthWrite: true`；
      //   · alpha 为 1 时混合结果与原不透明路径逐像素相同（canvas 底色本身不透明）。
      transparent: true,
      opacity: 1,
      depthWrite: true,
      side: THREE.FrontSide,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wUnits, hUnits, 1, 1), mat)
    mesh.position.set(slots[i].pos[0], slots[i].pos[1], slots[i].pos[2])
    mesh.rotation.set(slots[i].rot[0], slots[i].rot[1], slots[i].rot[2])
    mesh.name = `codeWallPanel:${L}`
    // **必须显式给 renderOrder**：这些板子沿 z 循环滚动，Three.js 对透明物体
    // 是按"物体中心到相机的距离"排序的；滚动一旦把 z 折回，排序就和真实远近脱钩，
    // 于是近处的板先画、远处的板后画 —— 屏幕上两组代码直接叠成一团（实测就是这个原因）。
    // 这里按**层序**（u 越小越近）定死顺序：近层后画 → 正确遮挡。
    mesh.renderOrder = 10 + Math.round((1 - slots[i].u) * 10) * 2
    grp.add(mesh)
    entries.push({
      lang: L, file, mesh, mat, texture, z0: slots[i].pos[2], x0: slots[i].pos[0],
      y0: slots[i].pos[1], ry: slots[i].rot[1], u: slots[i].u,
      lines, fontPx: fp, canvas: { w: cw, h: ch }, plane: { w: wUnits, h: hUnits },
      lineUnits,
      // 视差强度：越近的层随相机移动得越多
      parallax: 0.55 - 0.34 * slots[i].u,
    })
  }

  let lastBase = 0
  /**
   * @param {number} t
   * @param {{camera?:THREE.Camera, alpha?:number, speed?:number, tint?:number, parallax?:number}} [o]
   */
  function update(t, o = {}) {
    const { camera = null, alpha = 1, speed: sp = speed, tint = 0, parallax = 1 } = o
    const base = t * sp
    // 相机的横向偏移 → 每层按自己的视差系数反向偏移（近层动得多、远层动得少）
    let camX = 0
    if (camera && parallax) camX = -camera.position.x * 0.18 * parallax
    for (const e of entries) {
      // 沿 z 循环流动（周期 cycle），实现"缓慢滚动"。
      // 正确写法：每层先按自己的 z0 求相位，再在 [z0 - cycle, z0] 里循环 ——
      // 这样每块板都在**自己的层深附近**来回走。
      // 第一版把 z 直接归一化到 [-cycle, 0)，等于把所有板子都扔到 -13 那一带，
      // 层序全乱（近处一块、远处一块同屏，读起来就是两组代码叠在一起）。
      const phase = ((-e.z0 % cycle) + cycle) % cycle
      const z = e.z0 - ((((base + phase) % cycle) + cycle) % cycle)
      e.mesh.position.z = z
      e.mesh.position.x = e.x0 + camX * e.parallax
      // 景深全部烘在 canvas 里（renderCodeCanvas 的 dark）。
      // 这里**只**改 opacity —— 绝不再碰 `e.mat.transparent`
      // （那会让 three 重编译程序、破坏"渲染是 t 的纯函数"，详见构造处的注释）。
      e.mat.opacity = alpha >= 0.999 ? 1 : alpha
    }
    return { layers: entries.length, base, camX }
  }

  return {
    object: grp,
    panels: entries,
    langs: entries.map((e) => e.lang),
    fontPx,
    layout,
    speed,
    update,
    /** 供自检 */
    report: () => ({
      layout,
      fontPx,
      minFontPx: TEXT_MIN.codeWall,
      fontOk: fontPx >= TEXT_MIN.codeWall,
      layers: entries.length,
      langs: entries.map((e) => e.lang),
      triangles: entries.length * 2,
      hasPromptChars: false, // 明确不画提示符/日志滚屏
      /** 每行代码的世界高度（首个平面）；调用方按自己的取景换算屏幕像素 */
      lineUnits: entries.length ? entries[0].lineUnits : 0,
      /** 屏幕像素：给定"世界单位 1 = N 像素"时每行的高度 */
      linePx: (pxPerUnit) => (entries.length ? entries[0].lineUnits * pxPerUnit : 0),
      langsOk: new Set(entries.map((e) => e.lang)).size,
    }),
  }
}

export { LANGS, LANG_COLORS, SNIPPETS }
