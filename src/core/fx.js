// src/core/fx.js — 后处理强度。全部由 t 推导（起音点 + 登记的时间表），无跨帧状态。
// SPEC §5：冲击处 glitch 瞬间拉满，60–120ms 衰减；段落切换闪白 80ms；
//           副歌每小节首拍轻闪 0.15。

import { sync } from './sync.js'

const IMPACTS = [] // {t, kind, amount, dur, atk}
let sorted = true

/** kind: 'flash' | 'glitch' | 'shake' | 'disp' */
export function registerImpacts(list) {
  for (const it of list || []) {
    if (!it || typeof it.t !== 'number') continue
    IMPACTS.push({ atk: 0.012, dur: 0.09, amount: 1, kind: 'glitch', ...it })
  }
  sorted = false
}

/** 段落切换闪白（80ms）用的边界时刻 */
export const SECTION_FLASH_DUR = 0.08

// 副歌区间：段 E 0:59–1:14，段 K 2:27.9–2:42
const CHORUS = [
  [59.0, 74.0],
  [147.9, 162.0],
]
function inChorus(t) {
  for (const [a, b] of CHORUS) if (t >= a && t <= b) return true
  return false
}

function envelope(e, dur, atk) {
  if (e < 0 || e > dur) return 0
  return e < atk ? e / atk : (1 - (e - atk) / (dur - atk)) ** 1.4
}

function sumImpacts(t, kind) {
  let v = 0
  for (let i = 0; i < IMPACTS.length; i++) {
    const im = IMPACTS[i]
    if (im.kind !== kind) continue
    const e = t - im.t
    if (e < 0) {
      // 已按 t 升序：还差得远（>0.2s）说明后面都在未来，停止；否则跳过继续
      if (e < -0.2) break
      continue
    }
    if (e <= im.dur) {
      const a = im.amount * envelope(e, im.dur, im.atk)
      if (a > v) v = a
    }
  }
  return v
}
function ensureSorted() {
  if (!sorted) {
    IMPACTS.sort((a, b) => a.t - b.t)
    sorted = true
  }
}

/** 起音点驱动的瞬时 glitch：强起音点贡献，100ms 衰减 */
function onsetGlitch(t) {
  const p = sync.pulse(t, 110)
  return p * p * 0.55
}

/** 副歌小节首拍轻闪 0.15（90ms） */
function barAccent(t) {
  if (!inChorus(t)) return 0
  const i = sync.beatIndex(t)
  if (i < 0 || i % 4 !== 0) return 0
  const e = t - sync.beats[i]
  return e >= 0 && e < 0.09 ? 0.15 * (1 - e / 0.09) : 0
}

export const fx = {
  /** 白闪强度 0..1，80ms 衰减 */
  flash(t) {
    ensureSorted()
    return Math.min(1, sumImpacts(t, 'flash') + barAccent(t))
  },
  /** 故障强度 0..1（白条、RGB 错位、抖动、扫描线） */
  glitch(t) {
    ensureSorted()
    return Math.min(1, onsetGlitch(t) + sumImpacts(t, 'glitch'))
  },
  /** 色散强度 0..1 */
  dispersion(t) {
    ensureSorted()
    return Math.min(1, this.glitch(t) * 0.55 + sumImpacts(t, 'disp'))
  },
  /** 震屏强度 0..1 */
  shake(t) {
    ensureSorted()
    return Math.min(1, sumImpacts(t, 'shake') + this.glitch(t) * 0.3)
  },

  /** CRT 开关：0.30s 亮线展开开机；209.0s 收缩关机（DIRECTOR 段 A / 段 N） */
  crt(t) {
    const open = t >= 0.3 ? Math.min(1, (t - 0.3) / 0.55) : 0
    const close = t >= 209.0 ? Math.min(1, (t - 209.0) / 1.15) : 0
    return { open, close, level: open * (1 - close) }
  },

  /** 全屏黑场由场景自己绘制（段 J 的 2:26.5、段 N 的 3:29 之后），
   *  以免后处理层遮住需要画在黑场之上的元素（红字、片尾字幕）。 */

  impacts: IMPACTS,
  inChorus,
}
export default fx
