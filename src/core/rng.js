// src/core/rng.js — 确定性随机。渲染路径禁止 Math.random；随机一律 hash(seed,index)。
// 使用 Math.imul 保证跨平台 int32 精确一致。

export function hash01(i, seed = 0) {
  let x = (i | 0) ^ Math.imul(seed | 0, 0x9e3779b9)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

export function hash2(x, y, seed = 0) {
  return hash01((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)) | 0, seed)
}

/** 在 [a,b) 内的确定性随机 */
export const range = (i, a, b, seed = 0) => a + (b - a) * hash01(i, seed)
/** 对称抖动 [-a,a] */
export const jitter = (i, a, seed = 0) => (hash01(i, seed) * 2 - 1) * a
/** 从数组中确定性取一个元素 */
export const pick = (arr, i, seed = 0) => arr[Math.min(arr.length - 1, Math.floor(hash01(i, seed) * arr.length))]
/** 两个高斯近似（Irwin–Hall 4 项），返回 [-1,1] 附近 */
export function gauss(i, seed = 0) {
  return (hash01(i * 4 + 0, seed) + hash01(i * 4 + 1, seed) + hash01(i * 4 + 2, seed) + hash01(i * 4 + 3, seed) - 2) / 1.4
}
/** 2D 值噪声，用于有机抖动 */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi, seed)
  const b = hash2(xi + 1, yi, seed)
  const c = hash2(xi, yi + 1, seed)
  const d = hash2(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}
/** 一维值噪声 */
export function noise1(x, seed = 0) {
  const xi = Math.floor(x), xf = x - xi
  const u = xf * xf * (3 - 2 * xf)
  return hash01(xi, seed) * (1 - u) + hash01(xi + 1, seed) * u
}

/** 洗牌式确定性序列：返回 [0,n) 的一个排列（Fisher–Yates，种子固定） */
export function permute(n, seed = 0) {
  const a = new Int32Array(n)
  for (let i = 0; i < n; i++) a[i] = i
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(hash01(i, seed) * (i + 1))
    const t = a[i]; a[i] = a[j]; a[j] = t
  }
  return a
}
