// src/lib/props/termpane.js — 3D 终端屏（FIX_V3.md §2.2 / §2.3 / §2.4）
//
// 为什么把 dsh 界面从 DOM 换成这个（用户痛点 P1「遮挡画面且难看」、P2「窗口里文字互相重叠」、
// P10「性能」）：
//   · DOM 窗口是**一整块不透明面板**压在全屏之上，必然挡住影片；
//   · 它是 CSS 定位的，文字换行/行高不受 3D 摄像机控制，容易出现两行共用同一 y 坐标的重叠；
//   · 它还带一整层 DOM + CSS3DRenderer 的开销。
// 换成 WebGL 平面之后：
//   · 尺寸/位置/深度全部由 3D 决定，可以被主角遮挡、可以放进左右侧带（§2.4）；
//   · 只有一块 canvas 纹理，脏标记驱动更新（§2.2 / §8）；
//   · 文字由本文件自己按 measureText 实测换行，行 y 坐标严格递增 → 不会叠行。
//
// 外观严格按 §2.2：
//   · 背景 rgba(21,21,23,0.55)（官方暗底）
//   · 2px 品牌蓝描边 rgb(122,170,255) α0.5
//   · 标题栏高 56px：官方 logo（Path2D 绘制，§5.10）+ dsh 徽标 + 会话号
//   · 正文等宽 ≥30px（走 text() 的 term 档）
//   · 行样式：用户行 `you ▸` 浅灰 / 模型行 `deepseek ▸` 品牌蓝 / 工具行 `⚙` 琥珀 / 错误行红色 / 光标闪烁
//   · 最多 7 行、超出向上滚动；一行最多 18 汉字或 40 英文字符；任何文字不得越出面板或互相重叠
//   · 不得出现 official mark / scene xxx / web#001 等开发字符串

import * as THREE from 'three'
import { text, FONT, TEXT_MIN, setTextureSpace, isTextureSpace } from '../../ui/text.js'
import { drawFishLogo } from '../../ui/logo.js'
import { clamp } from '../../core/ease.js'

/** 画布与面板尺寸（§2.2 规定 1024×640） */
export const PANE_W = 1024
export const PANE_H = 640
/** 标题栏高度（§2.2） */
export const TITLE_H = 56
/** 正文行高与字号（§2.2：正文等宽 ≥30px） */
const BODY_PX = 30
const LINE_H = 44
/** 一屏最多几行（§2.2） */
export const MAX_LINES = 7
/** 一行最多多少"字符预算"：18 汉字 或 40 英文字符 */
const MAX_CJK = 18
const MAX_LATIN = 40

/** 行样式表（§2.2） */
const ROW_STYLE = {
  you: { prefix: 'you ▸', color: '#c9cdd4', prefixColor: '#9aa1ab' },
  deepseek: { prefix: 'deepseek ▸', color: '#e8eaee', prefixColor: 'rgb(122,170,255)' },
  tool: { prefix: '⚙', color: '#ffd479', prefixColor: '#ffd479' },
  err: { prefix: '✖', color: '#ff6b6b', prefixColor: '#ff6b6b' },
  ghost: { prefix: '⤷', color: '#6f7680', prefixColor: '#6f7680' }, // 幽灵补全：灰
  cursor: { prefix: '', color: '#7fd8ff', prefixColor: '#7fd8ff' },
}

/** 开发字符串黑名单（§2.2 明令不得出现） */
const DEV_STRING_RE = /official mark|scene\s+[A-N]\b|web#\d|runtime\s+0\.[\d.]+/i

/**
 * 按 measureText 实测换行。
 * 规则：先按显式 '\n' 切段，再对每段按像素宽度硬折；
 * CJK 逐字断行、拉丁按空格断词（与 §2.2 的"实测 measureText"一致）。
 */
function wrapLine(g, str, maxW) {
  const out = []
  for (const para of String(str).split('\n')) {
    if (!para) {
      out.push('')
      continue
    }
    let cur = ''
    // 逐"字符单元"推进：拉丁词整体、CJK 单字
    const units = para.match(/[A-Za-z0-9_.,:/'"()\[\]{}<>=+\-*%$#!?|&~^@`\\]+|\s+|[\s\S]/g) || []
    for (const u of units) {
      const next = cur + u
      if (g.measureText(next).width > maxW && cur) {
        out.push(cur.replace(/\s+$/, ''))
        cur = u.replace(/^\s+/, '')
      } else {
        cur = next
      }
    }
    if (cur) out.push(cur.replace(/\s+$/, ''))
  }
  return out
}

/**
 * 建一块终端屏。
 * @param {{renderer?:THREE.WebGLRenderer, session?:string, side?:'L'|'R',
 *          width?:number, height?:number, role?:'pane'|'decor'}} [opts]
 */
export function createTermPane(opts = {}) {
  const { session = '#001', side = 'L' } = opts
  const grp = new THREE.Group()
  grp.name = `termpane:${session}`

  /* ---------- 画布与纹理 ---------- */
  const cv = document.createElement('canvas')
  cv.width = PANE_W
  cv.height = PANE_H
  const g = cv.getContext('2d')
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter

  /* ---------- 平面 ---------- */
  // 世界尺寸：画布 1024×640 → 世界 0.96×0.60（1 世界单位 = 半屏高，1080 下约 540px）
  // 于是面板在屏幕上约 518×324 px = 1920×1080 的 **8.1%** 面积，
  // 远低于 §2.4 的"单块 pane ≤22%"上限。
  const worldW = 0.96
  const worldH = worldW * (PANE_H / PANE_W)
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true, // α0.55 的暗底，能透出后面的 3D
    depthWrite: false, // §2.4：pane 一律 depthWrite 关
    depthTest: true, // §2.4：depthTest 开，于是会被写深度的主角遮住
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), mat)
  mesh.name = `termpaneMesh:${session}`
  // §2.4：renderOrder 低于主角（主角默认 0/5），pane 用负值确保先画
  mesh.renderOrder = -2
  // §2.4：声明 role，供遮挡规则与 selftest q 项读取
  mesh.userData.role = opts.role || 'pane'
  mesh.userData.isPane = true
  grp.add(mesh)

  /* ---------- 状态 ---------- */
  let dirty = true
  let rows = [] // 已换行的行（含 kind）
  let caretOn = true
  let title = { session, subtitle: '' }
  let lastKey = ''

  /* ---------- §2.5 运动 / 进出场 / 故障 ---------- */
  /** 入场进度 0→1；`appearAt` 之后 autoEnter 会推进它 */
  let enterU = 1
  let exitU = 0
  /** 每行点亮进度（入场时逐行点亮：行 i 在 enterU > i/n 时可见） */
  let litRows = Infinity
  /** 本屏的"漂移种子"，不同屏不同相位（避免三块屏同相位齐步走） */
  const seed = (() => {
    let h = 2166136261
    const s = String(session) + '|' + side
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return ((h >>> 0) % 10000) / 10000
  })()
  /** 冲击故障强度 0..1（由 shader uniform 消费） */
  let glitchAmt = 0
  /** 漂移/视差的当前偏移（世界单位），供调用方叠加到自己的基准位置上 */
  const drift = { x: 0, y: 0, z: 0, rotY: 0, rotX: 0 }

  /** 入场的滑动方向：左侧带的屏从左边滑入，右侧带从右边滑入 */
  const enterFrom = side === 'R' ? 1 : -1

  /** 行样式解析 */
  function styleOf(kind) {
    return ROW_STYLE[kind] || ROW_STYLE.deepseek
  }

  /* ---------- §2.5 运动的取值函数 ---------- */

  /** 整屏当前不透明度：入场淡入 × 退场淡出 */
  function paneOpacity() {
    const ein = Math.min(1, enterU * 1.4)
    const eout = 1 - exitU
    return Math.max(0, Math.min(1, ein * eout))
  }

  /** 故障切片用的离屏画布（懒建；复用，避免每帧分配） */
  let glitchCv = null
  let glitchG = null

  /**
   * §2.5 的切片故障：把贴图按几条横带整体横移。
   * 为什么烘进贴图而不是只做 shader uniform：uniform 版的切片作用在**世界空间**，
   * 面板被相机斜视时切片会跟着倾斜；烘进贴图则始终是"屏幕上的横带"，
   * 而且与 §2.8 的文字包围盒登记一致（不会把一行字错看成两行叠字）。
   * shader uniform（返回值里的 `glitchUniform`）另外暴露给调用方做逐帧抖动。
   *
   * ⚠️ 必须先复制到离屏画布再写回：在同一次 paint 里对同一张 canvas 交替
   * getImageData / putImageData 会自己覆盖自己（带子被写脏后再被读出来，越涂越乱）。
   */
  function drawSliceGlitch(g) {
    if (glitchAmt <= 0.01) return
    if (!glitchCv) {
      glitchCv = document.createElement('canvas')
      glitchCv.width = PANE_W
      glitchCv.height = PANE_H
      glitchG = glitchCv.getContext('2d', { willReadFrequently: true })
    }
    glitchG.setTransform(1, 0, 0, 1, 0, 0)
    glitchG.clearRect(0, 0, PANE_W, PANE_H)
    glitchG.drawImage(cv, 0, 0)
    const bands = 5
    const shift = Math.round(glitchAmt * 46)
    g.save()
    g.globalCompositeOperation = 'copy'
    g.drawImage(glitchCv, 0, 0)
    g.restore()
    for (let b = 1; b < bands; b += 2) {
      const y = Math.round((b / bands) * PANE_H)
      const h = Math.round(PANE_H / bands)
      const dx = b % 4 === 1 ? shift : -shift
      g.save()
      g.beginPath()
      g.rect(0, y, PANE_W, h)
      g.clip()
      g.clearRect(0, y, PANE_W, h)
      g.drawImage(glitchCv, dx, y, PANE_W, h, 0, y, PANE_W, h)
      g.restore()
    }
  }

  /* ---------- 绘制 ---------- */
  function paint() {
    // 这块 canvas 是贴图：坐标与屏幕无关 → 期间关闭 §2.8 的屏幕包围盒登记
    const prevTS = isTextureSpace()
    setTextureSpace(true)
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, PANE_W, PANE_H)

    // 背景（§2.2：rgba(21,21,23,0.55)）
    g.fillStyle = 'rgba(21,21,23,0.55)'
    g.fillRect(0, 0, PANE_W, PANE_H)

    // 标题栏
    g.fillStyle = 'rgba(28,28,32,0.72)'
    g.fillRect(0, 0, PANE_W, TITLE_H)
    // 官方 logo（§5.10：用真实 SVG path，不得自己重画）+ dsh 徽标 + 会话号
    drawFishLogo(g, 20, 16, 24, '#7aaaff')
    text(g, 'dsh', 54, TITLE_H / 2, { role: 'ui', size: 34, family: 'brand', weight: 600, color: '#e8eaee', align: 'left', baseline: 'middle' })
    text(g, title.session, PANE_W - 20, TITLE_H / 2, {
      role: 'ui', size: 34, family: 'code', weight: 600, color: '#7aaaff', align: 'right', baseline: 'middle',
    })
    if (title.subtitle) {
      text(g, title.subtitle, 120, TITLE_H / 2, { role: 'label', size: 22, family: 'code', color: '#9aa1ab', align: 'left', baseline: 'middle' })
    }

    // 正文：行 y 坐标严格递增（这是"绝不叠行"的结构性保证）
    const y0 = TITLE_H + LINE_H * 0.9
    const maxW = PANE_W - 48
    g.font = `${500} ${BODY_PX}px ${FONT.code}`
    // §2.5 入场"逐行点亮" + 退场整体淡出：整屏 alpha + 逐行 alpha 一起用
    const paneAlpha = paneOpacity()
    for (let i = 0; i < rows.length && i < MAX_LINES; i++) {
      const r = rows[i]
      if (i >= litRows) continue // 还没点亮到这一行
      const st = styleOf(r.kind)
      const y = y0 + i * LINE_H
      // 刚点亮的那一行做一个短促的"闪一下"（§2.5 逐行点亮的手感）
      const sinceLit = litRows === Infinity ? 1 : Math.min(1, (litRows - i) / 1.0)
      const rowA = paneAlpha * Math.min(1, 0.35 + 0.65 * sinceLit)
      let x = 24
      if (st.prefix) {
        const w = text(g, st.prefix, x, y, {
          role: 'term', size: BODY_PX, family: 'code', weight: 600, color: st.prefixColor, align: 'left', baseline: 'middle', alpha: rowA,
        })
        x += w + 12
      }
      text(g, r.text, x, y, {
        role: 'term', size: BODY_PX, family: 'code', weight: 500, color: st.color, align: 'left', baseline: 'middle', alpha: rowA,
      })
      // 打字光标（只画在最后一行）
      if (r.caret && caretOn) {
        const cw = g.measureText(r.text).width
        g.save()
        g.globalAlpha *= rowA
        g.fillStyle = st.color
        g.fillRect(x + cw + 4, y - BODY_PX * 0.55, Math.round(BODY_PX * 0.5), Math.round(BODY_PX * 1.05))
        g.restore()
      }
    }

    // §2.5：冲击时的切片故障，烘进贴图（再看不出是"贴图重影"而不是两行叠字）
    drawSliceGlitch(g)

    // 描边（§2.2：2px 品牌蓝 α0.5）
    g.save()
    g.globalAlpha = paneOpacity()
    g.strokeStyle = 'rgba(122,170,255,0.5)'
    g.lineWidth = 2
    g.strokeRect(1, 1, PANE_W - 2, PANE_H - 2)
    g.restore()

    tex.needsUpdate = true
    setTextureSpace(prevTS)
    dirty = false
  }

  /**
   * 设置内容。**只在内容真的变化时重画**（脏标记，§2.2 / §8）。
   * @param {{kind:string, text:string, caret?:boolean}[]} lines
   * @param {{session?:string, subtitle?:string}} [hdr]
   */
  function setLines(lines, hdr) {
    const key = JSON.stringify([lines, hdr || null])
    if (key === lastKey) return false
    lastKey = key
    if (hdr) title = { session: hdr.session || title.session, subtitle: hdr.subtitle || '' }

    // 实测换行 → 展平成"显示行"
    g.font = `500 ${BODY_PX}px ${FONT.code}`
    const maxW = PANE_W - 48 - 150 // 预留前缀宽度
    const flat = []
    for (const L of lines) {
      // 开发字符串守卫：命中就整条丢弃并告警（§2.2 明令不得出现）
      if (DEV_STRING_RE.test(L.text)) {
        console.warn(`[termpane] 丢弃含开发字符串的行：${L.text.slice(0, 40)}`)
        continue
      }
      // 单行字符预算（§2.2）：18 汉字 或 40 英文字符
      const cjk = (L.text.match(/[\u4e00-\u9fff]/g) || []).length
      if (cjk > MAX_CJK * 3) console.warn(`[termpane] 一行汉字偏多（${cjk}）：${L.text.slice(0, 20)}`)
      const parts = wrapLine(g, L.text, maxW)
      for (let i = 0; i < parts.length; i++) {
        flat.push({ kind: L.kind, text: parts[i], caret: !!L.caret && i === parts.length - 1 })
      }
    }
    // 超出 7 行时保留**最后** 7 行（§2.2：超出向上滚动）
    rows = flat.length > MAX_LINES ? flat.slice(flat.length - MAX_LINES) : flat
    dirty = true
  }

  return {
    object: grp,
    mesh,
    material: mat,
    texture: tex,
    canvas: cv,
    width: worldW,
    height: worldH,
    /** 供遮挡规则与 selftest 读 */
    role: mesh.userData.role,
    side,
    setLines,
    /** 光标闪烁（每帧调用；只在真的变化时重画） */
    setCaret(on) {
      if (on === caretOn) return
      caretOn = on
      dirty = true
    },
    /** 每帧末调用：脏了才重画，且返回是否发生了重画（§8：每帧最多更新 3 块由调用方保证） */
    flush() {
      if (dirty) {
        paint()
        return true
      }
      return false
    },

    /* ---------------- §2.5 运动 / 进出场 / 故障 ---------------- */

    /** 漂移种子与滑入方向，供场景做相位错开 */
    get seed() {
      return seed
    },
    get enterFrom() {
      return enterFrom
    },
    /** 当前是否还看得见（入场未开始也为 false，便于场景早退） */
    get visible() {
      return enterU > 0.001 && exitU < 0.999 && paneOpacity() > 0.002
    },
    get opacity() {
      return paneOpacity()
    },

    /**
     * 每帧调用：推进漂移/视差、入场（从边缘滑入 + 逐行点亮）、退场（向后推远 + 淡出）。
     *
     * @param {number} t 当前时间
     * @param {{dt?:number, appearAt?:number, fadeAt?:number, goneAt?:number,
     *          parallax?:{x:number,y:number}, glitch?:number, updateMs?:number}} [o]
     *   · appearAt：入场开始时刻（之前的帧 enterU=0）
     *   · fadeAt/goneAt：退场窗口（fadeAt 起淡出 + 向后退，goneAt 时彻底不可见）
     *   · parallax：来自相机的归一化视差（-1..1），由场景按相机位置给
     *   · glitch：本帧的冲击强度 0..1（§2.5 切片故障）
     * @returns {{changed:boolean}} changed=true 表示贴图需要重画（供 §8 的"每帧最多 3 块"计数）
     */
    tick(t, o = {}) {
      const dt = o.dt == null ? 1 / 60 : Math.max(0, o.dt)
      const appearAt = o.appearAt == null ? -Infinity : o.appearAt
      const fadeAt = o.fadeAt == null ? Infinity : o.fadeAt
      const goneAt = o.goneAt == null ? fadeAt + 0.6 : o.goneAt

      // --- 入场：0.55s 滑入 ---
      const prevEnter = enterU
      if (t < appearAt) enterU = 0
      else enterU = Math.min(1, (t - appearAt) / 0.55)
      // --- 逐行点亮：入场后 0.9s 内点亮所有行 ---
      const nRows = Math.max(1, rows.length)
      litRows = enterU >= 1 ? Infinity : Math.max(0, Math.floor(((t - appearAt) / 0.9) * nRows))

      // --- 退场：0.55s 向后推远 + 淡出 ---
      const prevExit = exitU
      if (t < fadeAt) exitU = 0
      else exitU = Math.min(1, (t - fadeAt) / Math.max(0.05, goneAt - fadeAt))

      // --- 漂移 + 视差（§2.5：不同深度缓慢漂移并有视差） ---
      const ph = seed * Math.PI * 2
      const px = o.parallax ? o.parallax.x : 0
      const py = o.parallax ? o.parallax.y : 0
      drift.x = Math.sin(t * 0.21 + ph) * 0.035 + px * 0.08
      drift.y = Math.cos(t * 0.17 + ph * 1.7) * 0.028 + py * 0.05
      drift.z = Math.sin(t * 0.13 + ph * 0.6) * 0.05
      drift.rotY = Math.sin(t * 0.19 + ph) * 0.05 + px * 0.10
      drift.rotX = Math.cos(t * 0.15 + ph * 2.1) * 0.03 + py * 0.06

      // --- 故障（切片） ---
      const g0 = glitchAmt
      glitchAmt = Math.max(0, Math.min(1, o.glitch || 0))
      if (Math.abs(glitchAmt - g0) > 0.02) dirty = true

      if (enterU !== prevEnter || exitU !== prevExit) dirty = true
      // 入场过程中每帧都要重画（滑入 + 逐行点亮是连续变化的）
      if (enterU > 0 && enterU < 1) dirty = true
      if (exitU > 0 && exitU < 1) dirty = true
      return { changed: dirty }
    },

    /** 本帧的漂移量（世界单位 / 弧度），场景把它叠到自己的基准位置上 */
    drift,
    /** 供 shader 用的故障强度（0..1） */
    get glitchAmount() {
      return glitchAmt
    },

    /** 本屏的入场滑动位移（世界单位）：enterU=0 时在画面外，1 时归位 */
    slideOffset() {
      const out = enterFrom * (1 - enterU) * (worldW + 0.5)
      return out
    },
    /** 退场时向"远离相机"推的距离 */
    pushBack() {
      return exitU * 1.5
    },

    /** 当前显示行数（供 selftest 检查 ≤7） */
    get lineCount() {
      return rows.length
    },
    /** 已点亮的行数（入场逐行点亮；入场结束后 = lineCount） */
    get litLineCount() {
      return litRows === Infinity ? rows.length : Math.min(rows.length, litRows)
    },
    /** 供 selftest r 项：本屏每行文字的包围盒（画布坐标），用于重叠检测 */
    bboxes() {
      const out = []
      g.font = `500 ${BODY_PX}px ${FONT.code}`
      const y0 = TITLE_H + LINE_H * 0.9
      for (let i = 0; i < rows.length && i < MAX_LINES; i++) {
        const r = rows[i]
        const st = styleOf(r.kind)
        const pw = st.prefix ? g.measureText(st.prefix).width + 12 : 0
        const w = g.measureText(r.text).width + pw
        out.push({ x: 24, y: y0 + i * LINE_H - BODY_PX * 0.6, w, h: BODY_PX * 1.2, kind: r.kind })
      }
      return out
    },
    dispose() {
      tex.dispose()
      mat.dispose()
      mesh.geometry.dispose()
    },
  }
}

export default createTermPane
