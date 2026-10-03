// src/ui/text.js — 统一的文字绘制入口 + 字号下限守卫（FIX.md §0.5）
//
// FIX.md §0.5 的可读性硬规则（1080p 逻辑坐标）：
//   歌词英文 ≥52px、中文 ≥30px；对话气泡/界面正文 ≥34px；
//   背景装饰代码 ≥26px，代码墙主体 ≥40px；公式 ≥80px；标题 ≥120px。
//   任何"需要观众读懂"的窗口，激活时宽度占画面 ≥45%。
//
// 本模块是唯一入口：`text(...)` 会在绘制前校验字号，低于下限即视为违规。
// 违规处理有两种模式：
//   · 默认（record）：记入 window.__textViolations 并只警告一次 —— 保证影片仍能播放，
//     同时把"哪些地方的字太小"变成可枚举的清单（selftest i) 读它）。
//   · 严格（strict）：直接抛错。FIX 原文要求"直接抛错"，因此严格模式是 selftest i)
//     与 ?strictText=1 时的行为；默认宽松只是为了让 F1 阶段旧画面还能跑起来，
//     逐段重做（P2）完成后应把所有调用切到严格模式。
//
// 决策记录见 docs/PROGRESS.md 的决策日志。

export const TEXT_MIN = {
  lyricEn: 52, // 歌词英文
  lyricZh: 30, // 歌词中文
  ui: 34, // 对话气泡 / 界面正文
  // FIX_V3 §2.2 明确写「正文等宽 ≥30px」。这一档是给 3D 终端屏（TermPane）用的：
  // 它是**等宽终端正文**，不是 UI 正文，所以下限取 30 而不是 34。
  // 注意这不等于放宽 ui 档 —— ui 仍是 34，只是终端屏走自己的档。
  term: 30,
  codeDeco: 26, // 背景装饰代码
  codeWall: 40, // 代码墙主体
  formula: 80, // 公式
  title: 120, // 标题
  label: 22, // 非"需要读懂"的辅助标签（计数、调试读数）——仍设下限，避免小到不可辨
}

let STRICT = false
const violations = []
const warned = new Set()

export function setStrict(v) {
  STRICT = !!v
}
export const isStrict = () => STRICT
export const listViolations = () => violations.slice()
export function resetViolations() {
  violations.length = 0
  warned.clear()
}

/** 校验并记录（返回 true = 合法） */
export function checkSize(role, size, what = '') {
  const min = TEXT_MIN[role] ?? TEXT_MIN.ui
  if (size >= min) return true
  const rec = { role, size: +Number(size).toFixed(2), min, what: String(what).slice(0, 60) }
  violations.push(rec)
  const key = `${role}|${rec.size}|${rec.what}`
  if (!warned.has(key)) {
    warned.add(key)
    console.warn(`[text] ${role} 字号 ${rec.size}px < 下限 ${min}px：${rec.what}`)
  }
  if (STRICT) throw new Error(`[text] ${role} 字号 ${rec.size}px 低于下限 ${min}px（${rec.what}）`)
  return false
}

/**
 * 字体栈（用户 F2a 第 8 条）。
 *
 * 之前这里是 `"Inter", -apple-system, …`，但 Inter **从来没有被加载过**（没有 @font-face、
 * 也没有 @fontsource 依赖），所以那段是"幻觉声明"，实际总是掉到系统无衬线，
 * 而且声明的字栈与官方对不上。现在三支栈全部取自官方 ui-theme：
 *   sans  = --dsw-font-family（官方界面正文，见 docs/DSH_UI_NOTES.md 的 b 节）
 *   brand = --dsw-font-family-brand（'Montserrat' + sans；woff2 已放 public/dsh/fonts）
 *   code  = --ds-font-family-code（官方代码/终端字）
 */
const STACK_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'
const STACK_BRAND = `"Montserrat", ${STACK_SANS}`
const STACK_CODE = '"JetBrains Mono", Consolas, "PingFang SC", "Microsoft YaHei", monospace'

export const FONT = { sans: STACK_SANS, brand: STACK_BRAND, code: STACK_CODE }

export function fontStack(family = 'sans') {
  if (family === 'code') return STACK_CODE
  if (family === 'brand') return STACK_BRAND
  return STACK_SANS
}

/**
 * text(g, str, x, y, opts) —— 统一的文字绘制
 * opts: { role='ui', size, font, color, align, baseline, alpha, weight, family, shadow, stroke,
 *         layer, ghost }
 *   role 决定字号下限；family ∈ 'sans' | 'brand' | 'code'（默认 sans，比例字体）
 *   layer：本帧的层名（'stage'|'front'|'whale'|'ui'|'lyrics'|'texture'…）。
 *          §2.8 的重叠检测按"同层"比对，所以调用方应当传；不传则记为 'unknown'。
 *   ghost：刻意的残影（§2.8 允许，但每次 ≤120ms、全片 ≤30 次，由 selftest r 统计）。
 */
export function text(g, str, x, y, opts = {}) {
  const {
    role = 'ui',
    size,
    font = null,
    family = 'sans',
    weight = 500,
    color = '#e8eaee',
    align = 'left',
    baseline = 'alphabetic',
    alpha = 1,
    stroke = null,
    shadow = null,
    layer = 'unknown',
    ghost = false,
  } = opts

  const px = size ?? TEXT_MIN[role]
  checkSize(role, px, font ? `${font} :: ${str}` : str)

  const stack = fontStack(family)

  g.save()
  g.globalAlpha *= alpha
  g.font = font || `${weight} ${px}px ${stack}`
  g.textAlign = align
  g.textBaseline = baseline
  if (shadow) {
    g.shadowColor = shadow.color || 'rgba(0,0,0,0.7)'
    g.shadowBlur = shadow.blur ?? 8
  }
  if (stroke) {
    g.lineWidth = stroke.width ?? 4
    g.lineJoin = 'round'
    g.strokeStyle = stroke.color || 'rgba(6,8,12,0.9)'
    g.strokeText(String(str), x, y)
    g.shadowBlur = 0
  }
  g.fillStyle = color
  g.fillText(String(str), x, y)

  // ---- §2.8 / §2.3：登记包围盒（每层每帧）----
  // 只在 alpha 足够大时登记（完全透明的东西没有视觉重叠可言）。
  // T03 起：**纹理空间也登记**，只是层名换成该贴图自己的 `tex#N`，
  // 这样同一块贴图内部的叠字能被查出来，跨贴图的比较仍被 layer 规则挡住（见 textureLayer）。
  const lay = inTextureSpace ? textureLayer(g) : layer
  // T03：**纯空白不登记** —— 空格/换行没有可见墨迹，算进 IoU 只会造假阳性。
  // 实测代码墙把 `" "` 也当 token 画（w=51 @ 92px），于是每行都与前一个词"重叠" IoU 0.33，
  // 2446 对里有绝大多数是这么来的。
  const hasInk = String(str).trim().length > 0
  if (hasInk && alpha > 0.04 && (inTextureSpace || canvasIsOnScreen(g.canvas))) {
    // 顺手把这个 context 标成"屏幕上下文"：之后同一块画布上的**裸 fillText** 也会被登记。
    // ⚠️ 纹理空间**不能**标 —— 那会让贴图的裸 fillText 被当成屏幕文字（第一版的老坑）。
    if (!inTextureSpace) markScreenContext(g, layer)
    const w = g.measureText(String(str)).width
    // 由 align/baseline 反推包围盒左上角（这里必须自己算：canvas 不提供 fillText 的 bbox）
    let bx = x
    if (align === 'center') bx = x - w / 2
    else if (align === 'right' || align === 'end') bx = x - w
    let by = y - px * 0.78 // alphabetic
    if (baseline === 'top') by = y
    else if (baseline === 'middle') by = y - px * 0.5
    else if (baseline === 'bottom') by = y - px
    // 与裸 fillText 走**同一条**登记路径（含当前变换矩阵的换算），否则两条路径的坐标口径会分叉
    recordWithTransform(g, bx, by, w, px * 1.16, { layer: lay, role, text: String(str).slice(0, 24), ghost, size: px })
  }

  g.restore()
  return g.measureText(String(str)).width
}

/* ------------------------------------------------------------------ *
 * §2.8 文字包围盒登记与重叠检测
 * ------------------------------------------------------------------ */

/** 本帧已登记的文字包围盒 */
let bboxes = []
/** ghost 出现的累计帧数（§2.8：每次 ≤120ms、全片 ≤30 次） */
let ghostFrames = 0
let ghostEvents = 0
let lastGhostKey = ''
/**
 * 当前是否在渲染**离屏纹理画布**。
 * 为什么需要这个开关：`text()` 既被用来画屏幕，也被用来画 canvas 贴图
 * （代码墙的字、3D 面板的标题、年份数字…）。后者的坐标是**贴图自己的 1024×640**，
 * 与屏幕坐标毫无关系。第一版把两者一起登记，结果扫描报出
 * "t=20.5 段 B，6 处 title 在 (29,40) 重叠 IoU=1" —— 其实是代码墙在往自己画布上写字，
 * 每行都从 (40, y0) 起笔，看起来像全撞在一起。属**假阳性**，必须排除，
 * 否则 §9-r 会被噪声淹没，真正的重叠反而看不见。
 */
let inTextureSpace = false

/**
 * T03（FIX_V4 §2.3）：**贴图内部的文字重叠必须在"烘焙那一刻"就地判定并留存**。
 *
 * 为什么不能靠 `findTextOverlaps` 事后扫：代码墙 / TermPane / 年份数字这些贴图是
 * **在段落的 init() 里一次性烘焙**的（`renderCodeCanvas()` 等），而 `bboxes` 每帧清空 ——
 * 烘焙时登记的那些盒子在下一帧就没了，全片扫描永远看不到它们。
 * （实测：t=20 时刻只剩 4 个纹理盒，就是"每帧重烘"的那几块；代码墙的字一个都没留下。）
 *
 * 所以 `setTextureSpace(true/false)` 现在成对工作：
 *   · true  → 记下当前 `bboxes` 长度作为起点；
 *   · false → 把这一段（本次烘焙产生的盒子）从帧盒里**摘出来**（避免污染屏幕空间的 §2.8 检查），
 *             就地按贴图分组算"同层 IoU>0.1"、并按 §2.3 检查面板文字下限，
 *             结果累进 `textureReports` 供 `?selftest` / 探针读取。
 */
const textureReports = []
let texSpaceStart = -1
let texSpaceLayer = null

/** 被烘焙期间登记过的文字盒（诊断用） */
export function getTextureReports() {
  return textureReports
}
export function clearTextureReports() {
  textureReports.length = 0
}

/** §2.3：面板类文字最小 34px —— 与 TEXT_MIN.term 同一口径（见 TEXT_MIN 的注释） */
const PANEL_MIN_PX = 34

function finalizeTextureSpace() {
  const start = texSpaceStart
  texSpaceStart = -1
  if (start < 0 || start > bboxes.length) return
  // 本次烘焙产生的盒子从帧盒里摘掉：它们属于贴图坐标系，不该参与屏幕空间的 §2.8 比较
  const slice = bboxes.splice(start)
  if (!slice.length) return
  // 按贴图分组
  const groups = new Map()
  for (const b of slice) {
    if (!groups.has(b.layer)) groups.set(b.layer, [])
    groups.get(b.layer).push(b)
  }
  for (const [layer, arr] of groups) {
    const overlaps = []
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]
      if (a.ghost || a.crosstalk) continue
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j]
        if (b.ghost || b.crosstalk) continue
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
        if (ix <= 0 || iy <= 0) continue
        let inter
        let union
        if (a.quad || b.quad) {
          inter = convexIntersectArea(boxQuad(a), boxQuad(b))
          union = boxArea(a) + boxArea(b) - inter
        } else {
          inter = ix * iy
          union = a.w * a.h + b.w * b.h - inter
        }
        const iou = union > 0 ? inter / union : 0
        if (iou > 0.1) {
          overlaps.push({
            iou: +iou.toFixed(3),
            a: { t: a.text, x: Math.round(a.x), y: Math.round(a.y), w: Math.round(a.w), h: Math.round(a.h), size: a.size },
            b: { t: b.text, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), size: b.size },
          })
        }
      }
    }
    const tooSmall = arr
      .filter((b) => b.size > 0 && b.size < PANEL_MIN_PX && b.role !== 'codeDeco')
      .map((b) => ({ t: b.text, size: b.size, role: b.role }))
    textureReports.push({
      layer,
      boxes: arr.length,
      overlaps: overlaps.length,
      overlapSample: overlaps.slice(0, 6),
      tooSmall: tooSmall.length,
      tooSmallSample: tooSmall.slice(0, 6),
    })
  }
}

/** 进入/退出"离屏纹理空间"（画贴图前 raise，画完 clear）。成对使用，见上面的说明。 */
export function setTextureSpace(on) {
  const was = inTextureSpace
  const next = !!on
  if (!was && next) {
    texSpaceStart = bboxes.length
    texSpaceLayer = null
  } else if (was && !next) {
    inTextureSpace = false
    finalizeTextureSpace()
    return
  }
  inTextureSpace = next
}

/**
 * T03（FIX_V4 §2.3）：**贴图内部的文字也要登记包围盒**。
 *
 * 旧实现是「在纹理空间里一律不登记」—— 那确实躲掉了假阳性：不同贴图的坐标互不相关
 * （代码墙的 1536×960、TermPane 的 1024×640…），混在一起算 IoU 只会满屏噪声。
 * 但**同一块贴图内部**的文字当然可能真的叠在一起（同一行被重复绘制、标题压到正文…），
 * 而 §2.3 要的正是把这一类检出来。
 *
 * 做法：给每块画布发一个稳定的层名 `tex#N`。`findTextOverlaps` 里已有
 * 「`a.layer !== b.layer` 就跳过」这条规则，于是比较会**自动限制在同一块贴图内** ——
 * 「同层 IoU>0.1 为 FAIL」的语义正好对上，不必给检测器加特例。
 */
const texIds = new WeakMap()
let texSeq = 0
function textureLayer(g) {
  const cv = g && g.canvas
  if (!cv) return 'tex#?'
  let id = texIds.get(cv)
  if (!id) {
    id = `tex#${++texSeq}`
    texIds.set(cv, id)
  }
  return id
}
/** 诊断用：某块 context 当前归属哪张贴图（?debug / 探针可读） */
export function textureLayerOf(g) {
  return textureLayer(g)
}

export function isTextureSpace() {
  return inTextureSpace
}

/** 诊断用：这块 context 是否已被标记为屏幕上下文、其画布是否判定为"在屏幕上" */
export function textGuardDebug(g) {
  if (!g) return null
  return {
    screen: screenContexts.has(g),
    patched: patched.has(g),
    hasOrig: typeof g.__origFillText === 'function',
    layer: g.__textLayer || null,
    canvasId: (g.canvas && g.canvas.id) || null,
    onScreen: g.canvas ? canvasIsOnScreen(g.canvas) : null,
    connected: g.canvas ? !!g.canvas.isConnected : null,
    offsetParentNull: g.canvas ? g.canvas.offsetParent === null : null,
  }
}

/** 每帧开始时清空（由 main.js 的 renderAt 调用） */
export function resetBBoxes() {
  bboxes.length = 0
}

function recordBBox(b) {
  bboxes.push(b)
  if (b.ghost) {
    const key = `${b.layer}|${b.text}`
    if (key !== lastGhostKey) {
      ghostEvents++
      lastGhostKey = key
    }
    ghostFrames++
  }
}

/* ------------------------------------------------------------------ *
 * §2.8 补强：给**裸 `g.fillText(...)`** 也登记包围盒
 * ------------------------------------------------------------------ *
 * 为什么必须补：F–N 段（f_omnipotent … n_handoff）里还有 44 处直接用 `g.fillText`，
 * 它们不经过 `text()`，于是「同层重叠检测」对它们完全是空转 —— 而用户图 3 的
 * "文字叠成一团"正好就发生在段 N。要定位它，就必须先让**所有**屏幕文字都被登记。
 *
 * 做法：把「被标记为屏幕上下文」的 2D context 的 `fillText` 包一层 —— 画完照旧交给
 * 原生 fillText（像素结果一字不改），额外按当前 `font` / `textAlign` / `textBaseline` /
 * `globalAlpha` 算一次包围盒登记。
 *
 * ⚠️ 只对**被显式标记**的 context 生效（`markScreenContext`）。代码墙 / TermPane / 年份数字
 * 那些画在**离屏贴图**上的 canvas 坐标与屏幕无关，登记它们只会制造假阳性
 * （第一版就是栽在这上面，见 `inTextureSpace` 的注释）。
 */
const screenContexts = new WeakSet()
/** 已打补丁的 context（避免重复包装） */
const patched = new WeakSet()

/**
 * 让"当前帧的裸 fillText 都按 ghost/crosstalk 处理"。
 * 给**没有走 `text()` 的**绘制代码用（例如 `src/lyrics/render.js` 直接调 `g.fillText`）：
 *   · `ghost`     —— §2.8 允许的刻意残影（有次数上限，由 selftest r 统计）
 *   · `crosstalk` —— 同一层上**本来就该叠在一起**的东西，显式豁免
 *     （实测用例：相邻两句歌词在边界处交叉淡化，两条英文行落在**同一 baseline** 上，
 *      区间重叠是 DIRECTOR 设计的一部分，不是缺陷）
 */
export function beginFrameTextOptions(opts = {}) {
  const prev = { ghost: _frameGhost, crosstalk: _frameCrosstalk }
  if (opts.ghost !== undefined) _frameGhost = !!opts.ghost
  if (opts.crosstalk !== undefined) _frameCrosstalk = !!opts.crosstalk
  return prev
}
export function endFrameTextOptions(prev) {
  if (!prev) return
  _frameGhost = prev.ghost
  _frameCrosstalk = prev.crosstalk
}
let _frameGhost = false
let _frameCrosstalk = false

/** 把一个 2D context 标记为"屏幕上下文"，并给它的 fillText 打补丁 */
export function markScreenContext(g, layer = 'unknown') {
  if (!g || typeof g.fillText !== 'function') return g
  screenContexts.add(g)
  // 顺带登记它的画布：`canvasIsOnScreen` 只认这份名单（见上面的说明）
  if (g.canvas) screenCanvases.add(g.canvas)
  if (g.__textLayer == null) g.__textLayer = layer
  if (patched.has(g)) return g
  patched.add(g)
  const orig = g.fillText
  g.__origFillText = orig
  g.fillText = function (str, x, y, maxWidth) {
    if (maxWidth === undefined) orig.call(this, str, x, y)
    else orig.call(this, str, x, y, maxWidth)
    // T03：纹理空间也登记（层名 = 该贴图自己的 tex#N）。
    // 非纹理空间则维持原判据：必须是已标记的屏幕 context，且画布确实在屏幕上。
    if (!inTextureSpace) {
      if (!screenContexts.has(this)) return
      // 离屏贴图画布：坐标与屏幕无关，登记只会造假阳性（见 canvasIsOnScreen 的说明）
      if (!canvasIsOnScreen(this.canvas)) return
    }
    const a = this.globalAlpha
    if (!(a > 0.04)) return
    const s = String(str)
    if (!s) return
    // T03：纯空白不登记（同 text() 的理由）
    if (s.trim().length === 0) return
    const px = fontSizeOf(this.font)
    const w = this.measureText(s).width
    let bx = x
    if (this.textAlign === 'center') bx = x - w / 2
    else if (this.textAlign === 'right' || this.textAlign === 'end') bx = x - w
    let by = y - px * 0.78
    if (this.textBaseline === 'top' || this.textBaseline === 'hanging') by = y
    else if (this.textBaseline === 'middle') by = y - px * 0.5
    else if (this.textBaseline === 'bottom' || this.textBaseline === 'ideographic') by = y - px
    recordWithTransform(this, bx, by, w, px * 1.16, {
      layer: inTextureSpace ? textureLayer(this) : this.__textLayer || layer || 'unknown',
      role: 'raw', text: s.slice(0, 24),
      ghost: this.__textGhost === true || _frameGhost,
      crosstalk: this.__textCrosstalk === true || _frameCrosstalk,
      size: px,
    })
  }
  return g
}

/** 从 canvas font 串里取字号（`"600 13px JetBrains Mono, monospace"` → 13） */
export function fontSizeOf(font) {
  const m = /(\d+(?:\.\d+)?)px/.exec(String(font || ''))
  return m ? parseFloat(m[1]) : 13
}

/**
 * 这块画布是不是"**最终会出现在屏幕上**的画布"。
 *
 * 为什么不能靠 `offsetParent` 之类去猜：本项目的绘制面**全部是离屏画布**。
 * `src/core/compositor.js` 自己 `createElement('canvas')` 建了
 * `stageBack / stageFront / whale / ui / comp / post` 六块逻辑 1920×1080 画布，
 * 场景程序拿到的 `ctx.g` 就是这些画布的 context；它们**都不在 DOM 里**，
 * 最后由 `present()` 逐层 drawImage 到 `#stage` 与 `#lyrics`。
 * 早先我用 `isConnected && offsetParent !== null` 判断，结论是"全部不在屏幕上"，
 * 于是一次登记都没有 —— 扫描报出 `boxes=0`。
 *
 * 正确做法：**由合成器显式登记哪些画布是屏幕画布**（`markScreenContext` 顺带登记它的 canvas），
 * 只有登记过的画布上画的字才参与 §2.8 的屏幕重叠检测。没登记的一律视为贴图（离屏），
 * 这正好也是我们要的语义：`codewall` / `termpane` / 公式球那些贴图不会被误登记。
 */
const screenCanvases = new WeakSet()
function canvasIsOnScreen(cv2) {
  return !!cv2 && screenCanvases.has(cv2)
}

/**
 * 把**逻辑坐标**的文字包围盒换算到**设备（屏幕画布）坐标**。
 *
 * 为什么必须换算：canvas 的 `fillText(x, y)` 用的是**当前变换矩阵下**的坐标。
 * 歌词层的 `drawOne()` 里有 `g.translate/scale`（重拍缩放 + 当前词放大），
 * 所以同一批 `wd.x` 在两个**不同**的变换状态里画出来，落点其实差了几像素。
 * 第一版没考虑变换，于是登记出来的是"变换前的盒子"，实测在 t=116 报出
 * `"You"@(801,904) ∩ "have"@(717,904) IoU=0.183` —— 而屏幕上这两个词相距很远，
 * 是**假阳性**。假阳性会把 §9-r 淹没，真重叠反而看不见。
 *
 * 另外：**斜排/拉伸的文字必须按"有向盒"（quad）登记**，不能用轴对齐包围盒（AABB）。
 * 这是本轮修段 K 时踩到的硬事实。设某字形未旋转时是 w×h，绕 θ 旋转、沿旋转方向步进 a，
 * 则相邻两个 AABB 的尺寸是 `W = w·cosθ + h·sinθ`、`H = w·sinθ + h·cosθ`，
 * 步进是 `(a·cosθ, a·sinθ)`；要让它们不相交需 `a·cosθ ≥ W` 或 `a·sinθ ≥ H`，
 * 代入 a≥w 后分别等价于 `0 ≥ h·sinθ` 与 `w·sinθ ≥ w·sinθ + h·cosθ`
 * —— **只要 0<θ<90° 就永远不成立**。
 * 也就是说：**斜排的逐字文字，其 AABB 必然互相重叠**，哪怕字形本身排得整整齐齐。
 * `src/scenes/k_storm.js` 的"潮汐拉长的公式"正是「斜排 + `scale(stretch, 1-…)` + 逐字绘制」，
 * 实测在 148–150s 报出 76 处 IoU 0.10–0.28，全部是这一类**假阳性**。
 * 所以：变换含旋转或非等比缩放时，额外记下**四个变换后的角点**与**真实面积**，
 * 重叠检测对这类盒子改用**凸多边形求交**（IoU 阈值仍是 §2.8 的 0.1，**没有放宽**）。
 */
function recordWithTransform(g, bx, by, bw, bh, rec) {
  let m = null
  try {
    m = g.getTransform ? g.getTransform() : null
  } catch (e) {
    m = null
  }
  if (!m) {
    recordBBox({ ...rec, x: bx, y: by, w: bw, h: bh, area: bw * bh })
    return
  }
  const { a, b, c, d, e, f } = m
  // "简单变换" = 只有平移与**等比**缩放（旋转 b/c ≠ 0、或 a≠d 的非等比缩放都要走 quad 路径）
  const isSimple = Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9 && Math.abs(a - d) < 1e-9 && a > 0
  if (isSimple) {
    recordBBox({ ...rec, x: bx * a + e, y: by * d + f, w: bw * a, h: bh * d, area: bw * a * (bh * d) })
    return
  }
  // 一般情况：投四角。既给 AABB（兼容既有路径），也给 quad 与**真实面积**
  const xs = [bx, bx + bw, bx, bx + bw]
  const ys = [by, by, by + bh, by + bh]
  const quad = []
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < 4; i++) {
    const px = xs[i] * a + ys[i] * c + e
    const py = xs[i] * b + ys[i] * d + f
    quad.push([px, py])
    if (px < x0) x0 = px
    if (px > x1) x1 = px
    if (py < y0) y0 = py
    if (py > y1) y1 = py
  }
  recordBBox({ ...rec, x: x0, y: y0, w: x1 - x0, h: y1 - y0, area: Math.abs(quadArea(quad)), quad })
}

/** 鞋带公式（有符号面积） */
function quadArea(q) {
  let s = 0
  for (let i = 0; i < q.length; i++) {
    const ax = q[i][0]
    const ay = q[i][1]
    const bx2 = q[(i + 1) % q.length][0]
    const by2 = q[(i + 1) % q.length][1]
    s += ax * by2 - bx2 * ay
  }
  return s / 2
}

/** 规整成逆时针（正面积） */
function ccw(q) {
  return quadArea(q) < 0 ? q.slice().reverse() : q
}

/**
 * 两个**凸**四边形的交面积（Sutherland–Hodgman 裁剪 + 鞋带公式）。
 * 斜排文字用它取真实交叠，而不是"外接盒相交"。阈值不变，只是量得准。
 */
function convexIntersectArea(A, B) {
  let out = ccw(A)
  const clip = ccw(B)
  for (let i = 0; i < clip.length && out.length; i++) {
    const cx1 = clip[i][0]
    const cy1 = clip[i][1]
    const cx2 = clip[(i + 1) % clip.length][0]
    const cy2 = clip[(i + 1) % clip.length][1]
    const ex = cx2 - cx1
    const ey = cy2 - cy1
    // 内侧判据：CCW 多边形边的左侧为内
    const inside = (p) => ex * (p[1] - cy1) - ey * (p[0] - cx1) >= -1e-9
    const next = []
    for (let j = 0; j < out.length; j++) {
      const cur = out[j]
      const prv = out[(j - 1 + out.length) % out.length]
      const cin = inside(cur)
      const pin = inside(prv)
      if (cin) {
        if (!pin) next.push(lineIntersect(prv, cur, [cx1, cy1], [cx2, cy2]))
        next.push(cur)
      } else if (pin) {
        next.push(lineIntersect(prv, cur, [cx1, cy1], [cx2, cy2]))
      }
    }
    out = next
  }
  return out.length >= 3 ? Math.abs(quadArea(out)) : 0
}

/** 线段 p1p2 与 p3p4 的交点（已知相交） */
function lineIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0]
  const d1y = p2[1] - p1[1]
  const d2x = p4[0] - p3[0]
  const d2y = p4[1] - p3[1]
  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) < 1e-12) return p2
  const tt = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / den
  return [p1[0] + d1x * tt, p1[1] + d1y * tt]
}

/** 盒子 → 凸四边形（无 quad 时取 AABB 的四角） */
function boxQuad(b) {
  if (b.quad) return b.quad
  return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
}
function boxArea(b) {
  return b.area != null ? b.area : b.w * b.h
}

/** 供 selftest / ?debug 读取本帧的包围盒 */
export function getBBoxes() {
  return bboxes
}

/**
 * 同层重叠检测（§2.8）：交并比 > 0.1 即视为重叠。
 * 刻意**按层**比对：不同层的文字本来就该叠在一起（例如歌词画在 UI 之上）。
 *
 * 两类**显式豁免**（都必须由调用方主动声明，不是自动放过）：
 *   · `ghost`     —— §2.8 允许的残影；次数有硬上限（每次 ≤120ms、全片 ≤30 次），由 r) 统计。
 *   · `crosstalk` —— 同一层上本来就该叠在一起的内容。实测用例：相邻两句歌词在边界处
 *     交叉淡化（`drawLyrics` 同时画 `idx-1` 与 `idx`），两条英文行落在**同一 baseline** 上，
 *     区间必然重叠；这是 DIRECTOR 设计的一部分，不是"文字叠成一团"。
 *     ⚠️ 只标**正在淡出的那一句**（英文 alpha < 1 且不是当前句），不整段豁免。
 * @param {number} [iouLimit=0.1]
 * @returns {{overlaps:Array, total:number, ghostFrames:number, ghostEvents:number, exempt:number}}
 */
export function findTextOverlaps(iouLimit = 0.1) {
  const overlaps = []
  let exempt = 0
  const skip = (b) => b.ghost || b.crosstalk
  for (let i = 0; i < bboxes.length; i++) {
    const a = bboxes[i]
    if (skip(a)) {
      exempt++
      continue
    }
    for (let j = i + 1; j < bboxes.length; j++) {
      const b = bboxes[j]
      if (skip(b)) continue
      if (a.layer !== b.layer) continue
      // 先用 AABB 快速排除（有向盒的 AABB 是它的外接盒 → 不相交则必然不相交）
      const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
      const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      if (ix <= 0 || iy <= 0) continue
      // 至少一方是**有向盒**（斜排/非等比缩放）时，用凸多边形求交算**真实**交叠面积；
      // 否则沿用 AABB。阈值不变（§2.8 的 0.1），只是斜排文字不再被外接盒误判。
      let inter
      let union
      if (a.quad || b.quad) {
        inter = convexIntersectArea(boxQuad(a), boxQuad(b))
        union = boxArea(a) + boxArea(b) - inter
      } else {
        inter = ix * iy
        union = a.w * a.h + b.w * b.h - inter
      }
      const iou = union > 0 ? inter / union : 0
      if (iou > iouLimit) {
        overlaps.push({
          layer: a.layer,
          iou: +iou.toFixed(3),
          a: { t: a.text, x: Math.round(a.x), y: Math.round(a.y), w: Math.round(a.w), h: Math.round(a.h), role: a.role, size: a.size, rotated: !!a.quad },
          b: { t: b.text, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), role: b.role, size: b.size, rotated: !!b.quad },
        })
      }
    }
  }
  // 同一对来回报很多次时截断，避免刷屏
  return { overlaps: overlaps.slice(0, 60), total: overlaps.length, ghostFrames, ghostEvents, exempt }
}

/** ghost 统计复位（selftest 开头调用） */
export function resetGhostStats() {
  ghostFrames = 0
  ghostEvents = 0
  lastGhostKey = ''
}
export function ghostStats() {
  return { ghostFrames, ghostEvents }
}

/** ?debug / ?selftest 用的违规摘要 */
export function violationSummary() {
  if (!violations.length) return '无'
  const byRole = {}
  for (const v of violations) byRole[v.role] = (byRole[v.role] || 0) + 1
  return Object.entries(byRole)
    .map(([r, n]) => `${r}×${n}`)
    .join(' ')
}
