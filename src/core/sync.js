// src/core/sync.js — 节拍/频谱只读 public/data/analysis.json（SPEC §2.4）。
// 不使用实时 AnalyserNode。所有查询都是 t 的纯函数。

let A = null // analysis.json
let MEL = null // Uint8Array，frames*bands
let RMS = null
let BEATS = null
let ONSETS = null
let TEMPO = null

export const sync = {
  get ready() {
    return !!A
  },
  get analysis() {
    return A
  },
  get duration() {
    return A ? A.duration : 0
  },
  get beats() {
    return BEATS
  },
  get onsets() {
    return ONSETS
  },
  get fps() {
    return A ? A.fps : 30
  },

  async load(url = './data/analysis.json') {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`analysis.json ${res.status}`)
    A = await res.json()
    MEL = Uint8Array.from(A.mel.data)
    RMS = Float32Array.from(A.rms.values)
    BEATS = Float64Array.from(A.beats)
    ONSETS = A.onsets.map((o) => ({ t: o.t, s: o.strength })).sort((a, b) => a.t - b.t)
    TEMPO = A.tempoSegments
    return A
  },

  /** 最后一个 <= t 的 beat 下标；t 早于首个 beat 返回 -1 */
  beatIndex(t) {
    if (!BEATS || BEATS.length === 0) return -1
    let lo = 0, hi = BEATS.length - 1, ans = -1
    while (lo <= hi) {
      const m = (lo + hi) >> 1
      if (BEATS[m] <= t) { ans = m; lo = m + 1 } else hi = m - 1
    }
    return ans
  },

  /** 小节内相位 0..1（按占位 4/4，同类拍之间线性插值） */
  beatPhase(t) {
    const i = this.beatIndex(t)
    if (i < 0) return 0
    const t0 = BEATS[i]
    const t1 = i + 1 < BEATS.length ? BEATS[i + 1] : t0 + 60 / this.tempoAt(t)
    return t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 0
  },

  /** 每 4 拍一小节，返回小节序号（可为负） */
  barIndex(t) {
    const i = this.beatIndex(t)
    return i < 0 ? -1 : Math.floor(i / 4)
  },
  /** 小节内相位 0..1 */
  barPhase(t) {
    const i = this.beatIndex(t)
    if (i < 0) return 0
    const k = i % 4
    const t0 = BEATS[i]
    const t1 = i + 1 < BEATS.length ? BEATS[i + 1] : t0 + 60 / this.tempoAt(t)
    const frac = t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 0
    return (k + frac) / 4
  },

  /** 距上一个 beat 的时间（秒） */
  sinceBeat(t) {
    const i = this.beatIndex(t)
    return i < 0 ? Infinity : t - BEATS[i]
  },

  /** decayMs 窗口内的脉冲强度 0..1：取最近起音/节拍的指数衰减最大值 */
  pulse(t, decayMs = 220) {
    const dur = decayMs / 1000
    let v = 0
    if (ONSETS) {
      for (let i = ONSETS.length - 1; i >= 0; i--) {
        const o = ONSETS[i]
        if (o.t > t) continue
        const e = t - o.t
        if (e > dur) break
        const a = o.s * (1 - e / dur) ** 1.6
        if (a > v) v = a
      }
    }
    if (BEATS) {
      const i = this.beatIndex(t)
      if (i >= 0) {
        const e = t - BEATS[i]
        if (e <= dur) v = Math.max(v, 0.7 * (1 - e / dur) ** 1.6)
      }
    }
    return Math.min(1, v)
  },

  /** 最近的起音点（|dt|<=win 内），否则 null */
  onsetNear(t, win = 0.05) {
    if (!ONSETS || ONSETS.length === 0) return null
    let lo = 0, hi = ONSETS.length - 1, best = null
    while (lo <= hi) {
      const m = (lo + hi) >> 1
      const dt = ONSETS[m].t - t
      if (best === null || Math.abs(dt) < Math.abs(best.dt)) best = { dt, ...ONSETS[m] }
      if (dt < 0) lo = m + 1
      else if (dt > 0) hi = m - 1
      else break
    }
    if (!best) return null
    return Math.abs(best.dt) <= win ? { t: best.t, s: best.s, dt: best.dt } : null
  },

  /** 起音点的绝对时刻表，供场景遍历（如卡点的逐条切线） */
  onsetsIn(t0, t1) {
    if (!ONSETS) return []
    return ONSETS.filter((o) => o.t >= t0 && o.t <= t1)
  },

  tempoAt(t) {
    if (!TEMPO || TEMPO.length === 0) return 120
    for (const s of TEMPO) if (t >= s.t0 && t < s.t1) return s.bpm
    return TEMPO[TEMPO.length - 1].bpm
  },

  /** RMS 0..1，帧间线性插值 */
  rmsAt(t) {
    if (!RMS || RMS.length === 0) return 0
    const f = t * this.fps
    const i = Math.max(0, Math.min(RMS.length - 1, Math.floor(f)))
    const j = Math.min(RMS.length - 1, i + 1)
    const u = Math.max(0, Math.min(1, f - i))
    return RMS[i] * (1 - u) + RMS[j] * u
  },

  /** 64 频带 mel，0..1；out 为可选复用数组（避免每帧分配） */
  spectrumAt(t, out = null) {
    const bands = A ? A.mel.bands : 64
    const dst = out || new Float32Array(bands)
    if (!MEL) return dst
    const frames = A.mel.frames
    const f = t * this.fps
    const i = Math.max(0, Math.min(frames - 1, Math.floor(f)))
    const j = Math.min(frames - 1, i + 1)
    const u = Math.max(0, Math.min(1, f - i))
    for (let b = 0; b < bands; b++) {
      const a = MEL[i * bands + b], c = MEL[j * bands + b]
      dst[b] = (a + (c - a) * u) / 255
    }
    return dst
  },
}

export default sync
