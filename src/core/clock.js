// src/core/clock.js — 唯一时钟 t = audio.currentTime + syncOffset（SPEC §2.1）。
// 无音频时降级为内置计时器，不得黑屏。

import { sync } from './sync.js'

export class Clock {
  constructor() {
    this.audio = null
    this.hasAudio = false
    this.offset = 0 // 秒
    this.error = null
    this._t = 0
    this._last = 0
    this._playing = false
    this._endHandlers = []
  }

  async init(src, { autoplay = false } = {}) {
    try {
      const a = new Audio()
      a.src = src
      a.preload = 'auto'
      a.crossOrigin = 'anonymous'
      a.addEventListener('ended', () => this._playing = false)
      await new Promise((resolve, reject) => {
        const ok = () => { cleanup(); resolve() }
        const bad = () => { cleanup(); reject(new Error('audio decode/load failed')) }
        const cleanup = () => {
          a.removeEventListener('canplaythrough', ok)
          a.removeEventListener('loadedmetadata', ok)
          a.removeEventListener('error', bad)
        }
        a.addEventListener('canplaythrough', ok, { once: true })
        a.addEventListener('loadedmetadata', ok, { once: true })
        a.addEventListener('error', bad, { once: true })
        a.load()
        setTimeout(ok, 12000) // 大文件兜底：超时也认为可用
      })
      this.audio = a
      this.hasAudio = true
      if (autoplay) await a.play().catch(() => {})
    } catch (e) {
      this.error = e
      this.hasAudio = false
      console.warn('[clock] 音频不可用，降级为内置计时器：', e && e.message)
    }
    return this.hasAudio
  }

  /** 时钟推进（仅在内置计时器模式下使用；由主循环调用，不在渲染路径内） */
  tick(nowMs) {
    if (!this.hasAudio && this._playing) {
      if (!this._last) this._last = nowMs
      this._t += (nowMs - this._last) / 1000
      this._last = nowMs
    }
  }

  get t() {
    if (this.hasAudio) return (this.audio.currentTime || 0) + this.offset
    return this._t + this.offset
  }

  get duration() {
    if (this.hasAudio && isFinite(this.audio.duration) && this.audio.duration > 0) return this.audio.duration
    return sync.duration || 211.907
  }

  get playing() {
    return this.hasAudio ? !this.audio.paused : this._playing
  }

  get muted() {
    return this.hasAudio ? this.audio.muted : false
  }
  set muted(v) {
    if (this.hasAudio) this.audio.muted = v
  }

  play() {
    this._playing = true
    this._last = 0
    if (this.hasAudio) this.audio.play().catch(() => {})
  }
  pause() {
    this._playing = false
    if (this.hasAudio) this.audio.pause()
  }
  toggle() {
    this.playing ? this.pause() : this.play()
  }

  seek(t) {
    const d = this.duration
    const tt = Math.max(0, Math.min(d, t))
    if (this.hasAudio) this.audio.currentTime = Math.max(0, tt - this.offset)
    else this._t = Math.max(0, tt - this.offset)
  }
  seekRel(d) {
    this.seek(this.t + d)
  }

  nudge(ms) {
    this.offset += ms / 1000
  }
  setOffset(ms) {
    this.offset = ms / 1000
  }
}

export default Clock
