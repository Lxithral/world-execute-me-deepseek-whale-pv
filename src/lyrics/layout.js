// src/lyrics/layout.js — 歌词排版（SPEC §6 + FIX.md §2.5 + §5.5）
//
// FIX.md §2.5 / §5.5 的硬规则：
//   · 英文改用**比例字体粗体**（系统 UI 无衬线栈），不再用等宽字体；
//   · 词间距用 measureText 实测，**单个空格宽度固定取 0.28em**（不再沿用 LRC 里空格字形的宽度）；
//   · 英文基线 y = CONFIG.lyricBaseline（默认 0.885H），中文基线 = 英文基线 + 0.062H；
//   · 英文字号 ≥52px、中文字号 ≥30px（1080p 逻辑坐标）；
//   · 上下安全边距 ≥6%，英文宽度 ≤84% 画面宽（超出先缩到 70%，再超则按词断两行）；
//   · 同一时刻只显示一句；句间直接切换；hold 之后完全隐藏。

/** 可用 URL 覆盖的排版常量：?lyricY=0.9 直接改英文基线占画面高的比例 */
export const CONFIG = {
  enFontFrac: 0.046, // 英文字号 = 0.046H，但不低于 enMinPx
  enMinPx: 52, // FIX §2.5：英文 ≥52px
  zhMinPx: 30, // FIX §2.5：中文 ≥30px
  zhFontRatio: 0.55, // 中文 ≈ 英文的 55%（同时受 zhMinPx 下限约束）
  lyricBaseline: 0.885, // FIX §2.5 / §5.5：英文基线 0.885H
  zhOffsetFrac: 0.062, // FIX §2.5：中文基线 = 英文基线 + 0.062H
  spaceEm: 0.28, // FIX §2.5：单个空格宽度 = 0.28em
  maxWidthRatio: 0.84, // 英文宽度上限
  minScale: 0.7, // 先缩到 70%
  marginFrac: 0.06, // 上下安全边距 ≥6%
  maxLines: 2, // 仍超宽则断两行
  zhLh: 1.25, // 中文两行时的行距
  escape: 0.22, // 英文降部比例（用于包围盒）
  cjkAscent: 0.88,
  cjkDescent: 0.12,
  active: 1.06, // 正在唱的词放大
}

/** 比例字体栈（英文歌词）：系统 UI 无衬线，粗体 */
const EN_STACK = `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif`
const ZH_STACK = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, "Segoe UI", sans-serif`

export const enFontStr = (px, weight = 700) => `${weight} ${px}px ${EN_STACK}`
export const zhFontStr = (px, weight = 500) => `${weight} ${px}px ${ZH_STACK}`

/** 词条的可显示文本（去掉 LRC 自带的尾随空格）与是否需要补一个 0.28em 间距 */
function tokenize(s) {
  return s.words.map((wd) => {
    const raw = String(wd.w)
    const trimmed = raw.replace(/\s+$/, '')
    return { t: wd.t, text: trimmed === '' ? ' ' : trimmed, gap: /\s$/.test(raw) || trimmed === '' }
  })
}

/** 一行词的像素宽度：所有 token 宽度 + 每个 token 后（除最后一个）的 0.28em 间距 */
function lineWidthOf(g, tokens, fontPx) {
  const space = fontPx * CONFIG.spaceEm
  let w = 0
  tokens.forEach((tk, i) => {
    g.font = enFontStr(fontPx)
    w += g.measureText(tk.text).width
    if (i < tokens.length - 1 && tk.gap) w += space
  })
  return w
}

/** 贪心断行：最多 CONFIG.maxLines 行 */
function wrap(g, tokens, maxW, fontPx) {
  const space = fontPx * CONFIG.spaceEm
  const lines = []
  let cur = []
  let w = 0
  for (const tk of tokens) {
    g.font = enFontStr(fontPx)
    const tw = g.measureText(tk.text).width
    const add = cur.length && tk.gap ? space + tw : tw
    if (cur.length && w + add > maxW && lines.length < CONFIG.maxLines - 1) {
      lines.push(cur)
      cur = [tk]
      w = tw
    } else {
      cur.push(tk)
      w += add
    }
  }
  if (cur.length) lines.push(cur)
  return lines
}

/**
 * layoutSentence(g, s, W, H, opts) → 几何描述
 * opts: { baselineFrac, spaceEm }（可由 ?lyricY= 覆盖）
 */
export function layoutSentence(g, s, W, H, opts = {}) {
  const baselineFrac = opts.baselineFrac ?? CONFIG.lyricBaseline
  const spaceEm = opts.spaceEm ?? CONFIG.spaceEm
  const cfg = { ...CONFIG, spaceEm }
  const maxW = W * CONFIG.maxWidthRatio

  // ---- 字号（带硬下限）----
  let enFont = Math.max(CONFIG.enMinPx, H * CONFIG.enFontFrac)
  let zhFont = Math.max(CONFIG.zhMinPx, enFont * CONFIG.zhFontRatio)
  const tokens = tokenize(s)

  // 宽度超限：先缩到 70%，再超则断行
  g.font = enFontStr(enFont)
  let total = lineWidthOf(g, tokens, enFont)
  if (total > maxW) {
    const scale = Math.max(CONFIG.minScale, maxW / total)
    enFont = Math.max(CONFIG.enMinPx * CONFIG.minScale, enFont * scale)
    zhFont = Math.max(CONFIG.zhMinPx * CONFIG.minScale, enFont * CONFIG.zhFontRatio)
    total = lineWidthOf(g, tokens, enFont)
  }
  let enLines = [tokens]
  if (total > maxW) enLines = wrap(g, tokens, maxW, enFont)

  // ---- 垂直位置 ----
  // 目标：英文基线 = baselineFrac*H；中文基线 = 英文基线 + 0.062H。
  // 底部安全边距是硬规则（≥6%），若两者冲突则以边距为准并把整块上移，
  // 因此实际基线可能略高于目标值（由 selftest h 的「≥0.80H」兜住下界）。
  const zhOffset = H * CONFIG.zhOffsetFrac
  const hardBottom = H * (1 - CONFIG.marginFrac)
  const K = enLines.length
  const lineStack = (K - 1) * enFont * 1.15
  const baselineTarget = H * baselineFrac
  const zhNeeded = zhOffset + (s.zh ? zhFont * CONFIG.cjkDescent : 0)
  const maxBaselineByMargin = hardBottom - lineStack - zhNeeded
  const clamped = Math.min(baselineTarget, maxBaselineByMargin)
  const topLimit = H * CONFIG.marginFrac + enFont * 0.78
  const baseline = Math.max(topLimit, clamped)
  const clampedByMargin = clamped < baselineTarget - 1e-6

  const enBaselines = []
  for (let k = 0; k < K; k++) enBaselines.push(baseline - (K - 1 - k) * enFont * 1.15)

  const space = enFont * spaceEm
  const enOut = enLines.map((line, k) => {
    const lw = lineWidthOf(g, line, enFont)
    let x = (W - lw) / 2
    const arr = line.map((tk, i) => {
      g.font = enFontStr(enFont)
      const tw = g.measureText(tk.text).width
      const o = { text: tk.text, t: tk.t, x, width: tw }
      x += tw + (i < line.length - 1 && tk.gap ? space : 0)
      return o
    })
    return { words: arr, width: lw, baseline: enBaselines[k] }
  })

  // ---- 中文 ----
  const zhOut = []
  if (s.zh) {
    g.font = zhFontStr(zhFont)
    const zmaxW = W * CONFIG.maxWidthRatio
    let zlines = [s.zh]
    if (g.measureText(s.zh).width > zmaxW) {
      const out = []
      let line = ''
      for (const ch of s.zh) {
        if (g.measureText(line + ch).width > zmaxW && line) {
          out.push(line)
          line = ch
        } else line += ch
      }
      if (line) out.push(line)
      zlines = out.slice(0, CONFIG.maxLines)
    }
    const zhFirst = enBaselines[K - 1] + zhOffset
    zlines.forEach((text, i) => {
      g.font = zhFontStr(zhFont)
      const width = g.measureText(text).width
      zhOut.push({ text, baseline: zhFirst + i * zhFont * CONFIG.zhLh, x: (W - width) / 2, width })
    })
  }

  // ---- 包围盒（含正在唱的词放大 6%）----
  let enMinX = Infinity, enMaxX = -Infinity
  for (const l of enOut) {
    for (const wd of l.words) {
      if (wd.x < enMinX) enMinX = wd.x
      if (wd.x + wd.width > enMaxX) enMaxX = wd.x + wd.width
    }
  }
  const grow = (CONFIG.active - 1) * enFont
  const enBox = {
    x: enMinX - grow / 2,
    y: enBaselines[0] - enFont * 0.78 - grow / 2,
    w: enMaxX - enMinX + grow,
    h: enBaselines[K - 1] + enFont * CONFIG.escape - (enBaselines[0] - enFont * 0.78) + grow,
  }
  let zhBox = null
  if (zhOut.length) {
    const zmax = Math.max(...zhOut.map((l) => l.width))
    zhBox = {
      x: (W - zmax) / 2,
      y: zhOut[0].baseline - zhFont * CONFIG.cjkAscent,
      w: zmax,
      h: zhOut[zhOut.length - 1].baseline + zhFont * CONFIG.cjkDescent - (zhOut[0].baseline - zhFont * CONFIG.cjkAscent),
    }
  }

  return {
    W, H,
    enLines: enOut,
    zhLines: zhOut,
    enFont,
    zhFont,
    enBaselines,
    zhBaselines: zhOut.map((l) => l.baseline),
    bbox: { en: enBox, zh: zhBox },
    centerY: (enBox.y + (zhBox ? zhBox.y + zhBox.h : enBox.y + enBox.h)) / 2,
    // 供审计/自检读出的实际值
    metrics: {
      baselineFracTarget: baselineFrac,
      baselineFracActual: +(enBaselines[0] / H).toFixed(4),
      clampedByMargin,
      marginLimitFrac: +(maxBaselineByMargin / H).toFixed(4),
      zhOffsetFracActual: zhOut.length ? +((zhOut[0].baseline - enBaselines[0]) / H).toFixed(4) : 0,
      spacePx: +(enFont * spaceEm).toFixed(2),
      spaceEm,
      enFont: +enFont.toFixed(2),
      zhFont: +zhFont.toFixed(2),
      enLineCount: K,
    },
  }
}
