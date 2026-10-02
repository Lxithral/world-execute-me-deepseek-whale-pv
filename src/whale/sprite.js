// src/whale/sprite.js — 立绘绘制（SPEC §4.4）。
// 变体（去色/着色）在 init 期一次性生成并缓存；渲染期只 drawImage + 少量图元。
// 渲染路径不累积状态：glitch 抖动由 hash(floor(t*30)) 决定。

import { hash01 } from '../core/rng.js'
import { clamp, span } from '../core/ease.js'
import { ROLES, FILES, XFADE } from './exprs.js'

const cache = new Map() // name -> {img, tile}
// 变体缓存：去色用像素处理（保留 alpha，绝不给透明区上色），着色用 source-atop 蒙版。
const variants = new Map()

function baseTile(name) {
  return cache.get(name)?.tile || null
}

/** 去色：向亮度插值，完全保留 alpha */
function makeDesat(name, amount) {
  const tile = baseTile(name)
  if (!tile) return null
  const c = document.createElement('canvas')
  c.width = tile.width
  c.height = tile.height
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(tile, 0, 0)
  const im = g.getImageData(0, 0, c.width, c.height)
  const d = im.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    d[i] += (l - d[i]) * amount
    d[i + 1] += (l - d[i + 1]) * amount
    d[i + 2] += (l - d[i + 2]) * amount
  }
  g.putImageData(im, 0, 0)
  return c
}

/**
 * 取（或生成）一个变体画布：先按需去色，再在「已有像素之上」着色（source-atop），
 * 这样透明区域始终保持透明。
 */
function variant(name, desat = 0, tint = null, tintAmt = 1) {
  const key = `${name}|${desat.toFixed(2)}|${tint || '-'}|${tintAmt.toFixed(2)}`
  const hit = variants.get(key)
  if (hit) return hit
  let src = baseTile(name)
  if (!src) return null
  if (desat > 0) {
    const dk = `${name}|desat|${desat.toFixed(2)}`
    let dc = variants.get(dk)
    if (!dc) {
      dc = makeDesat(name, desat)
      if (dc) variants.set(dk, dc)
    }
    if (dc) src = dc
  }
  if (tint) {
    const c = document.createElement('canvas')
    c.width = src.width
    c.height = src.height
    const g = c.getContext('2d')
    g.drawImage(src, 0, 0)
    g.globalCompositeOperation = 'source-atop'
    g.globalAlpha = clamp(tintAmt)
    g.fillStyle = tint
    g.fillRect(0, 0, c.width, c.height)
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1
    variants.set(key, c)
    return c
  }
  variants.set(key, src)
  return src
}

/** 载入后预热所有角色的变体，避免渲染路径上出现一次性开销 */
function prewarm() {
  for (const role of Object.keys(ROLES)) {
    const s = ROLES[role]
    variant(s.file, s.desat || 0, s.tint || null, s.tintAmt ?? 1)
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`立绘加载失败 ${url}`))
    img.src = url
  })
}

/** 载入全部素材，并按 3D 点云用的工作宽度做一份等比例缩略图 */
export async function loadSprites(base = './whale/', tileW = 720) {
  const names = [...new Set([...Object.values(FILES), 'cat.png'])]
  await Promise.all(
    names.map(async (n) => {
      const img = await loadImage(base + n)
      const th = Math.round((img.height / img.width) * tileW)
      const c = document.createElement('canvas')
      c.width = tileW
      c.height = th
      const g = c.getContext('2d')
      g.imageSmoothingQuality = 'high'
      g.drawImage(img, 0, 0, tileW, th)
      cache.set(n, { img, tile: c, aspect: img.width / img.height })
    })
  )
  prewarm()
  return cache
}

export const ready = () => cache.size > 0
export const aspectOf = (name) => (cache.get(name) || { aspect: 0.5557 }).aspect
/** 取已载入的原图（如 cat.png）；未就绪返回 null */
export const assetImg = (name) => cache.get(name)?.img || null

/** 叠加图元：闭眼睑条 / 悲伤（垂视线 + 泪滴） */
function drawOverlay(g, overlay, r, role) {
  const { x, y, w, h } = r
  if (overlay === 'eyesClosed') {
    // 两条黑色眼睑条，位置取头部（顶部 10%–22%），仅作近似的「闭眼」提示
    g.save()
    g.fillStyle = 'rgba(8,10,14,0.92)'
    const ey = y + h * 0.155
    const ew = w * 0.075
    const eh = Math.max(2, h * 0.007)
    g.fillRect(x + w * 0.46 - ew * 0.5, ey, ew, eh)
    g.fillRect(x + w * 0.60 - ew * 0.5, ey, ew, eh)
    g.restore()
  } else if (overlay === 'sad') {
    g.save()
    // 垂视线：两道浅色斜线
    g.strokeStyle = 'rgba(220,228,240,0.5)'
    g.lineWidth = Math.max(1.5, h * 0.003)
    const ey = y + h * 0.155
    for (const dx of [0.46, 0.60]) {
      g.beginPath()
      g.moveTo(x + w * dx - w * 0.02, ey + h * 0.006)
      g.lineTo(x + w * dx + w * 0.02, ey - h * 0.002)
      g.stroke()
    }
    // 泪滴
    const tx = x + w * 0.455
    const ty = y + h * 0.185
    g.fillStyle = 'rgba(150,220,255,0.85)'
    g.beginPath()
    g.moveTo(tx, ty)
    g.quadraticCurveTo(tx + w * 0.022, ty + h * 0.028, tx, ty + h * 0.045)
    g.quadraticCurveTo(tx - w * 0.022, ty + h * 0.028, tx, ty)
    g.fill()
    g.restore()
  }
}

/**
 * 站位（galgame 式，SPEC §4.4）：
 * 立绘底部锚定、头部在画面顶部 12–20%、横向默认 x∈[58%,92%]、膝以下没入歌词区渐变。
 * 返回 {x, y, w, h}（x,y 为左上角，逻辑像素）。
 */
export function standRect(W, H, { cxFrac = 0.75, topFrac = 0.15, heightFrac = 1.02, aspect = 0.5557 } = {}) {
  const h = H * heightFrac
  const w = h * aspect
  return { x: W * cxFrac - w / 2, y: H * topFrac, w, h }
}

/**
 * drawSprite(g, t, opts)
 * opts: {expr, x, y, scale=1, alpha=1, tint, tintAmt, desat, glitch=0, anchor='bottom-center', rect}
 * expr 可为角色名，或 {from,to,p}（用 exprAt 得到）。
 */
export function drawSprite(g, t, opts = {}) {
  const {
    x = 0,
    y = 0,
    scale = 1,
    alpha = 1,
    tint = null,
    tintAmt = 1,
    desat: desatOpt = 0,
    glitch = 0,
    anchor = 'bottom-center',
    rect = null,
    flip = false,
  } = opts

  let from = 'neutral'
  let to = 'neutral'
  let p = 1
  const e = opts.expr
  if (typeof e === 'string') {
    from = to = e
  } else if (e && typeof e === 'object') {
    from = e.from
    to = e.to
    p = clamp(e.p)
  }

  const sFrom = ROLES[from] || ROLES.neutral
  const sTo = ROLES[to] || ROLES.neutral
  const base = cache.get(FILES.base)
  const aspect = base ? base.aspect : 0.5557

  // 尺寸：优先 rect（逻辑像素），否则按 scale 相对画面高度的倍数
  let h, w
  if (rect) {
    h = rect.h
    w = rect.w
  } else {
    h = (g.canvas.height / (g.__dpr || 1)) * (opts.heightFrac || 1.0) * scale
    w = h * aspect
  }

  let ax = x
  let ay = y
  if (rect) {
    // 直接使用给定矩形作为目标框（忽略 anchor 与 x/y）
    ax = rect.x
    ay = rect.y
  } else if (anchor === 'bottom-center') {
    ax = x - w / 2
    ay = y - h
  } else if (anchor === 'center') {
    ax = x - w / 2
    ay = y - h / 2
  } else if (anchor === 'bottom-left') {
    ay = y - h
  }

  // glitch：确定性抖动 + 水平切片
  const gi = Math.floor(t * 30)
  const jx = glitch > 0 ? (hash01(gi, 11) * 2 - 1) * 6 * glitch : 0
  const jy = glitch > 0 ? (hash01(gi, 12) * 2 - 1) * 3 * glitch : 0

  g.save()
  g.globalAlpha = alpha
  g.translate(ax + jx, ay + jy)
  if (flip) {
    g.translate(w, 0)
    g.scale(-1, 1)
  }
  g.imageSmoothingQuality = 'high'

  const tileOf = (spec) =>
    variant(
      spec.file,
      Math.max(spec.desat || 0, desatOpt),
      tint || spec.tint || null,
      tintAmt * (spec.tintAmt ?? 1)
    )

  const drawOne = (spec, a) => {
    const cv = tileOf(spec)
    if (!cv) return
    if (a <= 0) return
    const slice = glitch > 0.25 ? Math.floor(hash01(gi, 21) * 4) : -1
    g.globalAlpha = alpha * a
    if (slice >= 0) {
      // 把立绘横向切成 4 段，随机一段水平错位
      const sh = h / 4
      const off = (hash01(gi, 30 + slice) * 2 - 1) * 26 * glitch
      for (let s = 0; s < 4; s++) {
        const sy = s * sh
        const dx = s === slice ? off : 0
        g.drawImage(cv, 0, sy / h, 1, 1 / 4, dx, sy, w, sh)
      }
    } else {
      g.drawImage(cv, 0, 0, w, h)
    }
  }

  if (p >= 1 || from === to) {
    drawOne(sTo, 1)
    if (sTo.overlay) drawOverlay(g, sTo.overlay, { x: 0, y: 0, w, h }, to)
  } else {
    drawOne(sFrom, 1 - p)
    drawOne(sTo, p)
    if (p > 0.5 && sTo.overlay) drawOverlay(g, sTo.overlay, { x: 0, y: 0, w, h }, to)
  }
  g.restore()
}

/** 调试/自检用：某角色是否可用 */
export const hasRole = (role) => !!ROLES[role]
export { XFADE }
