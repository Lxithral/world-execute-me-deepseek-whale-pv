// src/lib/formula.js — 公式绘制与真实数值计算。
// 只放有把握的公式（DIRECTOR 段 B）；画面上出现的数字必须来自真实计算。

import { C, rgba } from '../core/palette.js'
import { clamp, span, lerp } from '../core/ease.js'
import { hash01 } from '../core/rng.js'

const F = (size, weight = 500) =>
  `${weight} ${size}px "JetBrains Mono", "Cambria Math", "Microsoft YaHei", monospace`

/** 支持的公式（纯文本 + 上下标标记） */
export const FORMULAS = {
  softmax: 'softmax(z)_i = exp(z_i) / Σ_j exp(z_j)',
  attention: 'Attention(Q,K,V) = softmax(QKᵀ/√d_k)V',
  crossentropy: 'L = −Σ_i y_i log p_i',
  heart: '(x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0',
  limit: 'lim_{x→L} f(x) = ∞',
  epsdelta: '∀ε>0 ∃δ>0: 0<|x−L|<δ ⇒ |f(x)−M|<ε',
  circle: 'C = 2πr',
  kv: 'KV(t) = KV(t−1) ⊕ (k_t, v_t)',
}

/**
 * 画一行「数学文本」，支持 _{...} 下标与 ^{...} 上标（用较小字号）。
 * g: 2D context
 */
export function drawMath(g, x, y, text, size = 22, { color = C.fg, alpha = 1, align = 'left' } = {}) {
  g.save()
  g.globalAlpha = alpha
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  const seg = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if ((c === '_' || c === '^') && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2)
      if (end > 0) {
        seg.push({ t: text.slice(i + 2, end), sup: c === '^' })
        i = end + 1
        continue
      }
    }
    seg.push({ t: c, sup: null })
    i++
  }
  const widths = seg.map((s) => {
    g.font = F(s.sup === null ? size : size * 0.68, 500)
    return g.measureText(s.t).width
  })
  const total = widths.reduce((a, b) => a + b, 0)
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  seg.forEach((s, k) => {
    g.font = F(s.sup === null ? size : size * 0.68, 500)
    g.fillStyle = s.sup === null ? color : rgba(color, 0.85)
    const dy = s.sup === true ? -size * 0.42 : s.sup === false ? size * 0.24 : 0
    g.fillText(s.t, cx, y + dy)
    cx += widths[k]
  })
  g.restore()
  return total
}

/** 公式环：一圈公式缓慢环绕（段 B） */
export function formulaRing(g, cx, cy, r, t, { alpha = 1, items = null, size = 20, count = 7, tilt = 0.36 } = {}) {
  const list = items || [FORMULAS.softmax, FORMULAS.attention, FORMULAS.crossentropy, FORMULAS.circle, FORMULAS.limit, FORMULAS.kv, FORMULAS.epsdelta]
  g.save()
  g.globalAlpha = alpha
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + t * 0.16
    const x = cx + Math.cos(a) * r
    const yy = cy + Math.sin(a) * r * tilt
    const depth = (Math.sin(a) + 1) / 2 // 0 后 1 前
    g.globalAlpha = alpha * (0.28 + 0.72 * depth)
    drawMath(g, x, yy, list[k % list.length], size * (0.82 + 0.35 * depth), { color: depth > 0.6 ? C.teal : C.fgDim, align: 'center', alpha: 1 })
  }
  g.restore()
}

/* ---------------- 真实数值计算（用于 HUD/图表上的数字） ---------------- */

export function softmax(z) {
  const m = Math.max(...z)
  const e = z.map((v) => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

export function crossEntropy(p, y) {
  let l = 0
  for (let i = 0; i < p.length; i++) l -= y[i] * Math.log(Math.max(1e-9, p[i]))
  return l
}

/** 用频谱的 64 频带折叠成 8 个 logits，再算 softmax（数字真实） */
export function softmaxFromSpectrum(spectrum, gain = 3.2) {
  const bins = new Array(8).fill(0)
  for (let i = 0; i < spectrum.length; i++) bins[Math.floor((i / spectrum.length) * 8)] += spectrum[i]
  const z = bins.map((v) => v * gain)
  return softmax(z)
}

/** 注意力分数：QKᵀ/√d_k 的示意（用频谱作为 Q、上一帧频谱作为 K 的确定性替代） */
export function attentionFromSpectrum(sq, sk, dim = 8) {
  let dot = 0
  const n = Math.min(sq.length, sk.length)
  for (let i = 0; i < n; i++) dot += sq[i] * sk[i]
  return dot / Math.sqrt(dim)
}

/** 心形隐式方程求值（段 M：把公式挤出成 3D 字时用于判定） */
export function heartField(x, y, z) {
  const a = x * x + 2.25 * y * y + z * z - 1
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z
}
