// src/lib/emoji.js — 系统彩色表情包渲染（T10a / FIX_V4 T10 规格）
//
// 规格原文要点：
//   · 「Emoji 用**系统彩色字体**渲染：font-family "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji"；
//      **预渲染 512px 纹理并缓存**」
//   · 「selftest 增加：emoji **没有渲染成豆腐块（≥3 个色相簇）**，否则 FAIL 并报告」
//
// 为什么必须用系统彩色字体：`fillText` 一个 emoji 走的是**字体里的彩色字形**（COLR/CBDT/sbix 表）。
// 如果字体栈里没有 emoji 字体，浏览器会退回到一个**单色方框**（俗称"豆腐块"），
// 那一帧看起来"有个方块"，但完全不是表情包 —— 所以要有可量化的自检来区分这两者。
//
// 自检判据（`emojiHueClusters`）：对画布上 alpha>40 的像素算 HSV 色相，
// 丢掉近灰（饱和度 < 0.18，豆腐块的边框就是近灰），把剩下的投进 12 个色相桶，
// **占彩色像素 ≥2% 的桶**才算一个"色相簇"。豆腐块 → 0 簇；紫色茄子 → 1–2 簇。
// 所以自检看的是**整组 emoji 的并集** ≥3 簇（单看茄子只有紫+绿两种色相，本就不该要求 3 簇）。

/** 系统彩色 emoji 字体栈（顺序按规格给的三个） */
export const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'

/** glyph → { canvas, texture } 缓存（规格要求"预渲染 512px 纹理并缓存"） */
const cache = new Map()

/** 渲染一枚 emoji 到 512×512 画布（透明底、居中、留 6% 边距） */
export function emojiCanvas(glyph, px = 512) {
  const key = `${glyph}@${px}`
  const hit = cache.get(key)
  if (hit) return hit.canvas
  const cv = document.createElement('canvas')
  cv.width = px
  cv.height = px
  const g = cv.getContext('2d')
  g.clearRect(0, 0, px, px)
  g.font = `${Math.round(px * 0.88)}px ${EMOJI_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // 先描一圈浅色底，保证深色 emoji 在暗底上也有轮廓
  g.fillStyle = '#000'
  g.fillText(glyph, px / 2, px * 0.54)
  g.fillStyle = '#fff'
  g.fillText(glyph, px / 2, px * 0.53)
  cache.set(key, { canvas: cv, key })
  return cv
}

/** 取（并缓存）该 emoji 的 THREE 贴图。`THREE` 由调用方传入，避免这里直接依赖 three。 */
export function emojiTexture(THREE, glyph, px = 512) {
  const key = `${glyph}@${px}`
  const hit = cache.get(key)
  if (hit && hit.texture) return hit.texture
  const cv = emojiCanvas(glyph, px)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  cache.set(key, { canvas: cv, texture: tex, key })
  return tex
}

/**
 * 统计一枚 emoji 画布的"色相簇"数（豆腐块会是 0）。
 * @returns {{clusters:number, colored:number, bins:number[]}}
 */
export function emojiHueClusters(canvas) {
  const w = canvas.width
  const h = canvas.height
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data
  const bins = new Array(12).fill(0)
  let colored = 0
  for (let k = 0; k < d.length; k += 4) {
    if (d[k + 3] < 40) continue
    const r = d[k] / 255
    const g = d[k + 1] / 255
    const b = d[k + 2] / 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const sat = mx <= 0 ? 0 : (mx - mn) / mx
    if (sat < 0.18) continue // 近灰 —— 豆腐块的边框就是这一类，丢掉
    let hue
    if (mx === mn) hue = 0
    else if (mx === r) hue = ((g - b) / (mx - mn) + 6) % 6
    else if (mx === g) hue = (b - r) / (mx - mn) + 2
    else hue = (r - g) / (mx - mn) + 4
    bins[Math.floor((hue / 6) * 12) % 12]++
    colored++
  }
  const need = Math.max(1, Math.floor(colored * 0.02))
  const clusters = bins.filter((n) => n >= need).length
  return { clusters, colored, bins }
}

/** 诊断/自检出口：对一组 emoji 给出逐枚簇数与**并集**簇数 */
export function emojiReport(glyphs) {
  const per = []
  const union = new Array(12).fill(0)
  for (const gl of glyphs) {
    const r = emojiHueClusters(emojiCanvas(gl))
    per.push({ glyph: gl, clusters: r.clusters, colored: r.colored })
    for (let i = 0; i < 12; i++) union[i] += r.bins[i]
  }
  let colored = 0
  for (const n of union) colored += n
  const need = Math.max(1, Math.floor(colored * 0.02))
  return { per, unionClusters: union.filter((n) => n >= need).length, colored }
}
