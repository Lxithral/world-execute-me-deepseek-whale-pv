// src/lib/tables.js — 需要「有状态模拟」的东西，在 init 阶段按固定步长离线积分成表，
// 渲染时按 t 查表插值（SPEC §2.3）。全部确定性。

import { hash01, gauss } from '../core/rng.js'

/** 损失地形（段 K 的引力井 / 段 L 的损失曲线共用） */
export function lossSurface(x, y) {
  return 0.55 * x * x + 1.25 * y * y + 0.28 * Math.sin(2.6 * x) * Math.cos(2.1 * y)
}
export function lossGrad(x, y) {
  return [
    1.1 * x + 0.728 * Math.cos(2.6 * x) * Math.cos(2.1 * y),
    2.5 * y - 0.588 * Math.sin(2.6 * x) * Math.sin(2.1 * y),
  ]
}

/**
 * 梯度下降轨迹：固定步长离线积分。
 * 返回 { path: Float32Array(x,y,loss 三连), steps }
 */
export function gradientDescent({ steps = 900, lr = 0.055, dt = 1 / 60, start = [-1.55, 1.05], momentum = 0.12 } = {}) {
  const path = new Float32Array(steps * 3)
  let x = start[0]
  let y = start[1]
  let vx = 0
  let vy = 0
  for (let i = 0; i < steps; i++) {
    const [gx, gy] = lossGrad(x, y)
    vx = momentum * vx - lr * gx
    vy = momentum * vy - lr * gy
    x += vx * dt * 60
    y += vy * dt * 60
    path[i * 3] = x
    path[i * 3 + 1] = y
    path[i * 3 + 2] = lossSurface(x, y)
  }
  return { path, steps }
}

/** 训练损失曲线：真实噪声下降（不是假随机，种子固定） */
export function lossCurve({ steps = 900, seed = 4242 } = {}) {
  const out = new Float32Array(steps)
  let l = 3.4
  for (let i = 0; i < steps; i++) {
    const u = i / steps
    const target = 0.12 + 2.9 * Math.exp(-3.1 * u)
    l += (target - l) * 0.06
    const noise = (hash01(i, seed) - 0.5) * 0.075 * (1 - u * 0.6)
    out[i] = Math.max(0.05, l + noise + 0.05 * Math.sin(i * 0.37) * (1 - u))
  }
  return out
}

/**
 * KV cache 回收时间表（段 J）：分配 → 标记 → 清扫 → 压缩。
 * 返回每格 { allocT, markT, sweepT, compactT }
 */
export function kvSchedule({ cells = 96, t0 = 129.0, t1 = 147.4, seed = 77 } = {}) {
  const out = []
  const span = t1 - t0
  for (let i = 0; i < cells; i++) {
    const r = hash01(i, seed)
    const allocT = t0 + r * span * 0.55
    const markT = t0 + span * 0.42 + hash01(i, seed + 1) * span * 0.2
    const sweepT = t0 + span * 0.66 + hash01(i, seed + 2) * span * 0.16
    const compactT = t0 + span * 0.84 + hash01(i, seed + 3) * span * 0.12
    out.push({ allocT, markT, sweepT, compactT })
  }
  return out
}

/** 双摆（SPEC §2.3 提到；本项目用于段 D 的眩晕备用，离线积分成表） */
export function doublePendulum({ steps = 1800, dt = 1 / 120, seed = 9 } = {}) {
  const out = new Float32Array(steps * 4)
  let a1 = Math.PI * 0.62 + (hash01(seed, 1) - 0.5) * 0.02
  let a2 = Math.PI * 0.9
  let w1 = 0
  let w2 = 0
  const m1 = 1, m2 = 1, l1 = 1, l2 = 1, g = 9.81
  for (let i = 0; i < steps; i++) {
    const d = a2 - a1
    const den1 = (2 * m1 + m2 - m2 * Math.cos(2 * d))
    const den2 = den1
    const num1 = -g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2) - 2 * Math.sin(d) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(d))
    const num2 = 2 * Math.sin(d) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1) + w2 * w2 * l2 * m2 * Math.cos(d))
    const acc1 = num1 / (l1 * den1)
    const acc2 = num2 / (l2 * den2)
    w1 += acc1 * dt
    w2 += acc2 * dt
    a1 += w1 * dt
    a2 += w2 * dt
    out[i * 4] = a1
    out[i * 4 + 1] = a2
    out[i * 4 + 2] = w1
    out[i * 4 + 3] = w2
  }
  return out
}

/** 按 t 在表里线性插值取一组值 */
export function sampleTable(table, stride, t, duration) {
  const n = table.length / stride
  const u = Math.max(0, Math.min(1, t / duration)) * (n - 1)
  const i = Math.floor(u)
  const j = Math.min(n - 1, i + 1)
  const f = u - i
  const out = []
  for (let k = 0; k < stride; k++) out.push(table[i * stride + k] * (1 - f) + table[j * stride + k] * f)
  return out
}

/** 确定性噪声（供 loss 曲线抖动等使用） */
export const jitterAt = (i, amp, seed = 0) => gauss(i, seed) * amp
