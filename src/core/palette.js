// src/core/palette.js — 全片配色（SPEC §5 视觉基调）

export const C = {
  // 背景：深灰竖条纹
  bg0: '#16171a',
  bg1: '#1b1c20',
  bgDeep: '#05070d',
  panel: '#1e2026',
  panelEdge: '#2c2f38',
  line: '#3a3f4b',

  // 白色扁平图元
  fg: '#e8eaee',
  fgDim: '#b8bcc4',
  fgFaint: 'rgba(232,234,238,0.55)',

  // 语法高亮
  purple: '#c792ea',
  green: '#a5e075',
  amber: '#ffb454',
  teal: '#4dd0e1',
  blue: '#82aaff',
  pink: '#f07178',

  // 强调
  cyan: '#00e5ff',
  gold: '#ffd54f',
  red: '#ff4d4d',
  redDeep: '#7a1414',

  // 深海
  sea0: '#03121f',
  sea1: '#072a44',
  sea2: '#0d4a6b',
}

/** hex → 'rgba(r,g,b,a)' */
export function rgba(hex, a = 1) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
/** hex → [r,g,b] 0..1 */
export function rgb01(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
/** 线性混两色 hex → hex */
export function mixHex(a, b, t) {
  const A = rgb01(a), B = rgb01(b)
  const c = A.map((v, i) => Math.round((v + (B[i] - v) * Math.max(0, Math.min(1, t))) * 255))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export const HUD = {
  barH: 38,
  pad: 18,
  font: '600 15px "JetBrains Mono", monospace',
}
