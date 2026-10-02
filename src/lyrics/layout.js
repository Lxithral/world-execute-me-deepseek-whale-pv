// src/lyrics/layout.js — 歌词排版（SPEC §6）。
// 纯几何计算，结果按句缓存。英文大字在上、中文小字在下，自适应缩放与断行。

export const RATIO = {
  en: 0.046, // 英文字号 ≈ 画面高度 4.6%
  zh: 0.55, // 中文 ≈ 英文的 55%
  minScale: 0.7, // 最多缩到 70%
  maxWidth: 0.84, // 英文宽度上限 84% 画面宽
  enBaseline: 0.88, // 英文基线 88% 画面高
  zhGap: 0.35, // 中英文之间的视觉间距 = 0.35 × 英文字号
  zhLh: 1.25,
  margin: 0.05, // 安全边距
  bottomLimit: 0.95,
  escape: 0.22, // 英文降部比例
  cjkAscent: 0.88,
  cjkDescent: 0.12,
  active: 1.06, // 正在唱的词放大
}

const enFontStr = (px, weight = 700) =>
  `${weight} ${px}px "JetBrains Mono", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", monospace`
const zhFontStr = (px, weight = 500) =>
  `${weight} ${px}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "JetBrains Mono", sans-serif`

/** 把一组词按宽度上限断成最多 maxLines 行（贪心） */
function wrapWords(g, words, maxW, maxLines = 2) {
  const lines = []
  let cur = []
  let w = 0
  for (const wd of words) {
    g.font = wd.font
    const ww = g.measureText(wd.w).width
    if (cur.length && w + ww > maxW && lines.length < maxLines - 1) {
      lines.push(cur)
      cur = [wd]
      w = ww
    } else {
      cur.push(wd)
      w += ww
    }
  }
  if (cur.length) lines.push(cur)
  return lines
}

function lineWidth(g, arr) {
  let w = 0
  for (const wd of arr) {
    g.font = wd.font
    w += g.measureText(wd.w).width
  }
  return w
}

/**
 * layoutSentence(g, sentence, W, H) → 几何描述
 * 返回 { enLines:[[{w,x,font}]], zhLines:[{text,x,font}], enFont, zhFont,
 *        enBaselines:[], zhBaselines:[], bbox:{en,zh}, blockScaleCenter }
 */
export function layoutSentence(g, s, W, H) {
  const maxW = W * RATIO.maxWidth
  let enFont = H * RATIO.en

  // 先量原始宽度，必要时缩字号（最多到 70%）
  g.font = enFontStr(enFont)
  let total = g.measureText(s.en).width
  if (total > maxW) {
    const scale = Math.max(RATIO.minScale, maxW / total)
    enFont = enFont * scale
    g.font = enFontStr(enFont)
    total = g.measureText(s.en).width
  }
  const font = enFontStr(enFont)
  const words = s.words.map((wd) => ({ w: wd.w, t: wd.t, font }))

  // 仍超宽则按词断成两行
  let enLines = [words]
  if (total > maxW) enLines = wrapWords(g, words, maxW, 2)

  const K = enLines.length
  const enBaselines = []
  for (let k = 0; k < K; k++) enBaselines.push(H * RATIO.enBaseline - (K - 1 - k) * enFont * 1.15)

  const enOut = enLines.map((line, k) => {
    const lw = lineWidth(g, line)
    let x = (W - lw) / 2
    const arr = line.map((wd) => {
      g.font = wd.font
      const ww = g.measureText(wd.w).width
      const o = { w: wd.w, t: wd.t, x, width: ww, font: wd.font }
      x += ww
      return o
    })
    return { words: arr, width: lw, baseline: enBaselines[k] }
  })

  // 中文
  const zhFont = enFont * RATIO.zh
  const zhLh = zhFont * RATIO.zhLh
  const zhSrc = s.zh || ''
  let zhLines = []
  if (zhSrc) {
    g.font = zhFontStr(zhFont)
    const zmaxW = W * RATIO.maxWidth
    const zw = g.measureText(zhSrc).width
    if (zw <= zmaxW) zhLines = [zhSrc]
    else {
      // 按字符断行
      const out = []
      let line = ''
      for (const ch of zhSrc) {
        if (g.measureText(line + ch).width > zmaxW && line) {
          out.push(line)
          line = ch
        } else line += ch
      }
      if (line) out.push(line)
      zhLines = out.slice(0, 2)
    }
  }
  const lastEnBaseline = enBaselines[K - 1]
  const zhFirst = lastEnBaseline + enFont * RATIO.escape + enFont * RATIO.zhGap + zhFont * RATIO.cjkAscent
  const zhBaselines = zhLines.map((_, i) => zhFirst + i * zhLh)

  // 底部越界则整体上移
  let shift = 0
  const zhBottom = zhLines.length ? zhBaselines[zhBaselines.length - 1] + zhFont * RATIO.cjkDescent : 0
  const hardBottom = H * RATIO.bottomLimit
  if (zhBottom > hardBottom) shift = hardBottom - zhBottom
  // 顶部越界则整体下移
  const enTop = enBaselines[0] - enFont * 0.78
  if (enTop + shift < H * RATIO.margin) shift = H * RATIO.margin - enTop

  const shiftAll = (arr) => arr.map((v) => v + shift)
  const enBaselinesS = shiftAll(enBaselines)
  const zhBaselinesS = shiftAll(zhBaselines)
  enOut.forEach((l, k) => (l.baseline = enBaselinesS[k]))

  // 中文逐行居中（x 直接算好，渲染层不再测量）
  g.font = zhFontStr(zhFont)
  const zhOut = zhLines.map((text, i) => {
    const width = g.measureText(text).width
    return { text, baseline: zhBaselinesS[i], x: (W - width) / 2, width }
  })

  // bbox
  let enMinX = Infinity, enMaxX = -Infinity
  for (const l of enOut) {
    for (const wd of l.words) {
      if (wd.x < enMinX) enMinX = wd.x
      if (wd.x + wd.width > enMaxX) enMaxX = wd.x + wd.width
    }
  }
  const grow = (RATIO.active - 1) * enFont
  const enBox = {
    x: enMinX - grow / 2,
    y: enBaselinesS[0] - enFont * 0.78 - grow / 2,
    w: enMaxX - enMinX + grow,
    h: enBaselinesS[K - 1] + enFont * RATIO.escape - (enBaselinesS[0] - enFont * 0.78) + grow,
  }
  let zhBox = null
  if (zhOut.length) {
    const zmax = Math.max(...zhOut.map((l) => l.width))
    const zx = (W - zmax) / 2
    zhBox = {
      x: zx,
      y: zhBaselinesS[0] - zhFont * RATIO.cjkAscent,
      w: zmax,
      h:
        zhBaselinesS[zhOut.length - 1] +
        zhFont * RATIO.cjkDescent -
        (zhBaselinesS[0] - zhFont * RATIO.cjkAscent),
    }
  }

  return {
    W,
    H,
    enLines: enOut,
    zhLines: zhOut,
    enFont,
    zhFont,
    zhLh,
    enBaselines: enBaselinesS,
    zhBaselines: zhBaselinesS,
    bbox: { en: enBox, zh: zhBox },
    centerY: (enBox.y + (zhBox ? zhBox.y + zhBox.h : enBox.y + enBox.h)) / 2,
  }
}

export { enFontStr, zhFontStr }
