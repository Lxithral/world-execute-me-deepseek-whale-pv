// src/main.js — 启动、控制条、音频时钟、rAF、window.__renderAt(t)、?debug、?selftest
// 唯一时钟 t = audio.currentTime + syncOffset；渲染路径是 f(t) 的纯函数（SPEC §2.1/§2.2）。

import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

import { sync } from './core/sync.js'
import { Clock } from './core/clock.js'
import { Compositor, LOGICAL_W as W, LOGICAL_H as H } from './core/compositor.js'
import { fx, registerImpacts } from './core/fx.js'
import * as ease from './core/ease.js'
import * as rng from './core/rng.js'
import { C, rgba } from './core/palette.js'
import { loadPoints, createPointsLayer } from './whale/points.js'
import { loadMesh, createMeshLayer } from './whale/mesh.js'
import { loadContour, createWireLayer } from './whale/wire.js'
import { loadSprites, drawSprite, standRect } from './whale/sprite.js'
import { createLyrics, drawLyrics } from './lyrics/render.js'
import { drawTopBar, ctxAt, tpsAt, statusAt, MONO } from './ui/dsh.js'
import { SCENES } from './scenes/index.js'

const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')
const SELFTEST = params.has('selftest')

const canvas = document.getElementById('stage')
const errors = (window.__errors = [])

let comp = null
let clock = null
let L = null
let lyricsData = []
let pointsLayer = null
let meshLayer = null
let wireLayer = null
let spritesReady = false
let booted = false

const layerMask = { stage: true, whale: true, ui: true, fx: true, lyrics: true }

/* ------------------------------------------------------------------ *
 * 每帧复用的上下文（避免分配）
 * ------------------------------------------------------------------ */
const ctx = {
  W, H, sync, fx, ease, rng, C, rgba,
  t: 0, lt: 0,
  g: null, gFront: null, gWhale: null, gUI: null,
  three: null,
  whale: null,
  hud: null,
  rect: null,
  spec: new Float32Array(64),
}

function resetWhaleState() {
  return { sprite: null, sprites: null, points: null, mesh: null, wire: null }
}
/* ------------------------------------------------------------------ *
 * 渲染一帧 —— 任意 t 都是纯函数
 * ------------------------------------------------------------------ */
function renderAt(t) {
  if (!comp || !L) return { active: [] }
  comp.clearLayers()
  ctx.t = t
  ctx.g = comp.layers.stageBack.g
  ctx.gFront = comp.layers.stageFront.g
  ctx.gWhale = comp.layers.whale.g
  ctx.gUI = comp.layers.ui.g
  ctx.three = { scene: comp.scene, camera: comp.camera, stage3d: comp.stage3d, whale3d: comp.whale3d }
  // 场景自建的 3D 对象每帧先全部隐藏，由当前活跃场景显式打开
  for (const c of comp.stage3d.children) c.visible = false
  ctx.whale = resetWhaleState()
  ctx.rect = standRect(W, H)
  ctx.hud = { ctxPct: ctxAt(t), tps: tpsAt(t, sync), status: statusAt(t) }
  ctx.overlay = null

  const active = []
  for (const s of SCENES) {
    if (t < s.start || t >= s.end) continue
    active.push(s.id)
    const lt = (t - s.start) / Math.max(1e-6, s.end - s.start)
    ctx.lt = lt
    try {
      s.render(t, lt, ctx)
    } catch (e) {
      reportError(`scene:${s.id}`, e)
      drawErrorBox(ctx.g, s.id, e)
    }
  }

  try {
    applyWhale(t)
    comp.renderThree()
  } catch (e) {
    reportError('three', e)
  }

  try {
    drawHud(comp.layers.ui.g, t)
  } catch (e) {
    reportError('hud', e)
  }

  const fxp = {
    glitch: fx.glitch(t),
    flash: fx.flash(t),
    dispersion: fx.dispersion(t),
    shake: fx.shake(t),
    crtLevel: fx.crt(t).level,
    layers: layerMask,
  }
  let vg = null
  try {
    vg = comp.present(t, fxp)
  } catch (e) {
    reportError('compositor', e)
    return { active }
  }
  if (layerMask.lyrics) {
    try {
      drawLyrics(vg, t, L, { alpha: 1, pulse: sync.pulse(t, 180) })
    } catch (e) {
      reportError('lyrics', e)
    }
  }
  // 片尾字幕等需要在后处理之上显示的内容（仅段 N 使用）：
  // CRT 关机后画面整体被压成一条亮线，字幕必须画在合成本身之上。
  if (layerMask.ui && ctx.overlay) {
    try {
      ctx.overlay(vg, t)
    } catch (e) {
      reportError('overlay', e)
    }
  }
  return { active }
}

function applyWhale(t) {
  const w = ctx.whale
  // 正交相机左右为 ±(W/H)、上下为 ±1，故世界单位 1 = 半屏高；
  // 屏幕像素 → 世界坐标：x = (px - W/2)/(H/2)，y = -(py - H/2)/(H/2)
  const frame = { cx: W / 2, cy: H / 2, S: H / 2 }
  if (w.sprite && spritesReady) {
    try {
      drawSprite(ctx.gWhale, t, w.sprite)
    } catch (e) {
      reportError('sprite', e)
    }
  }
  if (w.sprites && spritesReady) {
    for (const s of w.sprites) {
      try {
        drawSprite(ctx.gWhale, t, s)
      } catch (e) {
        reportError('sprite', e)
        break
      }
    }
  }
  if (pointsLayer) {
    pointsLayer.object.visible = !!w.points && layerMask.whale
    if (w.points) pointsLayer.update(t, { frame, rect: ctx.rect, ...w.points })
  }
  if (meshLayer) {
    meshLayer.object.visible = !!w.mesh && layerMask.whale
    if (w.mesh) meshLayer.update(t, { frame, rect: ctx.rect, ...w.mesh })
  }
  if (wireLayer) {
    wireLayer.object.visible = !!w.wire && layerMask.whale
    if (w.wire) wireLayer.update(t, { frame, rect: ctx.rect, ...w.wire })
  }
}

function drawHud(g, t) {
  const a = Math.max(0, Math.min(1, fx.crt(t).level))
  drawTopBar(g, W, t, { session: t < 205.96 ? '#001' : '#002', alpha: a, sync })
  // 底部极细进度条
  const dur = clock ? clock.duration : 211.907
  g.save()
  g.globalAlpha = a * 0.5
  g.fillStyle = rgba(C.line, 0.5)
  g.fillRect(0, H - 3, W, 3)
  g.fillStyle = rgba(C.cyan, 0.75)
  g.fillRect(0, H - 3, W * Math.max(0, Math.min(1, t / dur)), 3)
  g.restore()
}

function reportError(where, e) {
  const rec = { where, message: String((e && e.message) || e), stack: e && e.stack, t: ctx.t }
  errors.push(rec)
  console.error('[error]', where, e)
}

function drawErrorBox(g, id, e) {
  g.save()
  g.fillStyle = 'rgba(120,10,10,0.85)'
  g.fillRect(24, H - 130, 760, 96)
  g.strokeStyle = '#ff4d4d'
  g.lineWidth = 2
  g.strokeRect(24, H - 130, 760, 96)
  g.fillStyle = '#fff'
  g.font = MONO(20, 700)
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.fillText(`ERROR · ${id}`, 40, H - 118)
  g.font = MONO(14, 500)
  g.fillText(String((e && e.message) || e).slice(0, 96), 40, H - 92)
  g.restore()
}

/* ------------------------------------------------------------------ *
 * 启动
 * ------------------------------------------------------------------ */
async function boot() {
  await document.fonts.ready

  await sync.load('./data/analysis.json')
  lyricsData = await fetch('./data/lyrics.json').then((r) => r.json())

  const [pd, md, cd] = await Promise.all([loadPoints(), loadMesh(), loadContour()])

  comp = new Compositor(canvas)
  pointsLayer = createPointsLayer(pd)
  meshLayer = createMeshLayer(md)
  wireLayer = createWireLayer(cd, { weight: 2 })
  comp.whale3d.add(meshLayer.object, wireLayer.object, pointsLayer.object)
  meshLayer.object.visible = false
  wireLayer.object.visible = false
  pointsLayer.object.visible = false

  try {
    await loadSprites('./whale/')
    spritesReady = true
  } catch (e) {
    reportError('sprites', e)
  }

  L = createLyrics(lyricsData, { W, H })
  // 供场景使用的歌词派生信息（纯数据，渲染期只读）
  const allWords = []
  for (const s of lyricsData) for (const wd of s.words) allWords.push(wd.t)
  allWords.sort((a, b) => a - b)
  ctx.words = Float64Array.from(allWords)
  ctx.lyrics = lyricsData
  ctx.sentenceAt = (t) => {
    let idx = -1
    for (let i = 0; i < lyricsData.length; i++) {
      if (t >= lyricsData[i].t0) idx = i
      else break
    }
    return idx
  }

  // 让场景 init 也能拿到 Three 场景（自建 3D 对象挂在 comp.stage3d 上）
  ctx.three = { scene: comp.scene, camera: comp.camera, stage3d: comp.stage3d, whale3d: comp.whale3d }
  for (const s of SCENES) {
    try {
      if (typeof s.init === 'function') s.init(ctx)
    } catch (e) {
      reportError(`init:${s.id}`, e)
    }
  }
  registerImpacts(SCENES.flatMap((s) => s.fx || []))

  // 音频：优先 FLAC，回退 MP3；都没有则用内置计时器（不黑屏）
  const flac = Object.values(import.meta.glob('../assets/*.flac', { query: '?url', import: 'default', eager: true }))
  const mp3 = Object.values(import.meta.glob('../assets/*.mp3', { query: '?url', import: 'default', eager: true }))
  const songUrl = flac[0] || mp3[0] || null
  clock = new Clock()
  if (songUrl) await clock.init(songUrl)

  booted = true
  window.__renderAt = (t) => renderAt(t)
  window.__ctx = ctx
  window.__app = {
    comp, get clock() { return clock }, get lyrics() { return L }, sync, fx, SCENES, layerMask, errors,
    setPaused: (v) => { renderPaused = !!v },
    /** 供人工/自动检查：把若干时刻渲染成一张接触表画到主画布上 */
    contactSheet(times, cols = 4) {
      renderPaused = true
      const cw = 480
      const chh = 270
      const rows = Math.ceil(times.length / cols)
      const sheet = document.createElement('canvas')
      sheet.width = cols * cw
      sheet.height = rows * chh
      const sg = sheet.getContext('2d')
      sg.fillStyle = '#000'
      sg.fillRect(0, 0, sheet.width, sheet.height)
      times.forEach((tt, i) => {
        renderAt(tt)
        const x = (i % cols) * cw
        const y = Math.floor(i / cols) * chh
        sg.drawImage(canvas, 0, 0, canvas.width, canvas.height, x, y, cw, chh)
        sg.fillStyle = 'rgba(0,0,0,0.62)'
        sg.fillRect(x, y, 96, 17)
        sg.fillStyle = '#00e5ff'
        sg.font = '600 12px monospace'
        sg.fillText(`t=${tt.toFixed(2)}`, x + 4, y + 13)
      })
      const g = canvas.getContext('2d')
      const sc = Math.min(canvas.width / sheet.width, canvas.height / sheet.height)
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.fillStyle = '#000'
      g.fillRect(0, 0, canvas.width, canvas.height)
      g.drawImage(sheet, 0, 0, sheet.width, sheet.height, 0, 0, sheet.width * sc, sheet.height * sc)
      return true
    },
  }

  buildControls()
  if (DEBUG) buildDebugPanel()
  if (SELFTEST) runSelftest()

  requestAnimationFrame(loop)
}

/* ------------------------------------------------------------------ *
 * 主循环
 * ------------------------------------------------------------------ */
let fpsAcc = 0
let fpsFrames = 0
let fpsValue = 0
let lastNow = 0
let primCount = 0
let renderPaused = false // ?selftest 期间暂停主循环，避免与自检抢画布

function loop(now) {
  requestAnimationFrame(loop)
  const dt = lastNow ? (now - lastNow) / 1000 : 0
  lastNow = now
  clock.tick(now)
  const t = clock.t
  if (!renderPaused) {
    try {
      renderAt(t)
    } catch (e) {
      reportError('frame', e)
    }
  }
  fpsAcc += dt
  fpsFrames++
  if (fpsAcc >= 0.5) {
    fpsValue = fpsFrames / fpsAcc
    fpsAcc = 0
    fpsFrames = 0
  }
  primCount =
    (pointsLayer && pointsLayer.object.visible ? 8000 : 0) +
    (meshLayer && meshLayer.object.visible ? 780 : 0) +
    (wireLayer && wireLayer.object.visible ? wireLayer.segCount : 0) +
    comp.stage3d.children.length * 100
  updateReadout(t)
}

/* ------------------------------------------------------------------ *
 * 控制条（DOM，自动隐藏）
 * ------------------------------------------------------------------ */
function buildControls() {
  const bar = document.createElement('div')
  bar.id = 'controls'
  bar.innerHTML = `
    <button data-act="play">▶</button>
    <span class="tc" data-role="time">0:00 / 0:00</span>
    <input type="range" data-role="seek" min="0" max="1000" value="0" step="1" />
    <span class="tc" data-role="off">off 0ms</span>
    <button data-act="full">⛶</button>
  `
  document.body.appendChild(bar)
  const seek = bar.querySelector('[data-role="seek"]')
  const timeEl = bar.querySelector('[data-role="time"]')
  const offEl = bar.querySelector('[data-role="off"]')
  const playBtn = bar.querySelector('[data-act="play"]')
  let dragging = false

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  playBtn.onclick = () => clock.toggle()
  bar.querySelector('[data-act="full"]').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }
  seek.addEventListener('input', () => {
    dragging = true
    clock.seek((seek.value / 1000) * clock.duration)
  })
  seek.addEventListener('change', () => {
    dragging = false
  })

  window.__uiTick = (t) => {
    if (!dragging) seek.value = String(Math.round((t / clock.duration) * 1000))
    timeEl.textContent = `${fmt(t)} / ${fmt(clock.duration)}`
    playBtn.textContent = clock.playing ? '❚❚' : '▶'
    offEl.textContent = `off ${(clock.offset * 1000).toFixed(0)}ms`
  }

  // 自动隐藏
  let hideTimer = 0
  const show = () => {
    bar.classList.add('show')
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => bar.classList.remove('show'), 2600)
  }
  window.addEventListener('mousemove', show)
  show()

  // 键盘
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      clock.toggle()
    } else if (e.code === 'ArrowRight') clock.seekRel(e.shiftKey ? 1 : 5)
    else if (e.code === 'ArrowLeft') clock.seekRel(e.shiftKey ? -1 : -5)
    else if (e.key === 'f' || e.key === 'F') bar.querySelector('[data-act="full"]').click()
    else if (e.key === ',') {
      clock.nudge(e.shiftKey ? -1 : -10)
      show()
    } else if (e.key === '.') {
      clock.nudge(e.shiftKey ? 1 : 10)
      show()
    }
  })

  // 点击画面开始播放（自动播放策略）
  const start = document.createElement('div')
  start.id = 'start'
  start.textContent = clock.hasAudio ? '点击开始播放' : '点击开始（音频不可用，使用内置计时器）'
  document.body.appendChild(start)
  const go = () => {
    start.remove()
    clock.play()
  }
  start.addEventListener('click', go)
  canvas.addEventListener('click', () => {
    if (document.getElementById('start')) go()
    else clock.toggle()
  })
}

function updateReadout(t) {
  if (window.__uiTick) window.__uiTick(t)
  if (window.__debugTick) window.__debugTick(t, fpsValue, primCount)
}

/* ------------------------------------------------------------------ *
 * ?debug — 时间轴、段落跳转、图层开关、偏移、onsets 刻度
 * ------------------------------------------------------------------ */
function buildDebugPanel() {
  const wrap = document.createElement('div')
  wrap.id = 'debug'
  const dur = clock.duration
  const strip = document.createElement('canvas')
  strip.width = 960
  strip.height = 26
  const sg = strip.getContext('2d')
  sg.fillStyle = '#14151a'
  sg.fillRect(0, 0, 960, 26)
  const xOf = (t) => (t / dur) * 960
  // 段落
  for (const s of SCENES) {
    sg.fillStyle = 'rgba(0,229,255,0.16)'
    sg.fillRect(xOf(s.start), 0, Math.max(1, xOf(s.end) - xOf(s.start)), 26)
    sg.fillStyle = 'rgba(0,229,255,0.7)'
    sg.fillRect(xOf(s.start), 0, 1, 26)
  }
  // beats / onsets
  for (const b of sync.beats) {
    sg.fillStyle = 'rgba(232,234,238,0.28)'
    sg.fillRect(xOf(b), 20, 1, 6)
  }
  for (const o of sync.onsets) {
    sg.fillStyle = `rgba(255,180,84,${0.25 + o.s * 0.6})`
    sg.fillRect(xOf(o.t), 22 - o.s * 6, 1, 4 + o.s * 6)
  }
  // 歌词刻度
  for (const s of lyricsData) {
    sg.fillStyle = 'rgba(0,229,255,0.9)'
    sg.fillRect(xOf(s.t0), 6, 1, 8)
    sg.fillStyle = 'rgba(0,229,255,0.35)'
    sg.fillRect(xOf(s.t0), 6, Math.max(1, xOf(s.hold) - xOf(s.t0)), 2)
  }

  const jumps = SCENES.map((s) => `<button data-t="${s.start}">${s.id} ${s.start.toFixed(1)}</button>`).join('')
  wrap.innerHTML = `
    <div class="row"><b>?debug</b>
      <span data-role="stat"></span>
      <label><input type="checkbox" data-layer="stage" checked>舞台</label>
      <label><input type="checkbox" data-layer="whale" checked>鲸鱼娘</label>
      <label><input type="checkbox" data-layer="ui" checked>UI</label>
      <label><input type="checkbox" data-layer="fx" checked>FX</label>
      <label><input type="checkbox" data-layer="lyrics" checked>歌词</label>
      <span class="hint">, . 偏移 ±10ms（Shift ±1ms）· ←/→ 5s · 空格 播放</span>
    </div>
    <div class="row jumps">${jumps}</div>
    <div class="row"><input type="range" data-role="dseek" min="0" max="1000" value="0" step="1"></div>
    <div class="row"><canvas data-role="strip" width="960" height="26"></canvas></div>
  `
  document.body.appendChild(wrap)
  wrap.querySelector('[data-role="strip"]').getContext('2d').drawImage(strip, 0, 0)

  const dseek = wrap.querySelector('[data-role="dseek"]')
  let scrubbing = false
  dseek.addEventListener('input', () => {
    scrubbing = true
    clock.seek((dseek.value / 1000) * clock.duration)
  })
  dseek.addEventListener('change', () => (scrubbing = false))
  wrap.querySelectorAll('.jumps button').forEach((b) => {
    b.onclick = () => clock.seek(parseFloat(b.dataset.t) + 0.01)
  })
  wrap.querySelectorAll('[data-layer]').forEach((cb) => {
    cb.onchange = () => (layerMask[cb.dataset.layer] = cb.checked)
  })

  const stat = wrap.querySelector('[data-role="stat"]')
  window.__debugTick = (t, fps, prims) => {
    if (!scrubbing) dseek.value = String(Math.round((t / clock.duration) * 1000))
    const inScenes = SCENES.filter((s) => t >= s.start && t < s.end).map((s) => s.id).join('+') || '—'
    stat.textContent = `t=${t.toFixed(3)}s  ${fps.toFixed(0)}fps  prims=${prims}  scene=${inScenes}  ctx=${ctxAt(t).toFixed(0)}%  tps=${tpsAt(t, sync)}  off=${(clock.offset * 1000).toFixed(0)}ms`
  }
}

/* ------------------------------------------------------------------ *
 * ?selftest
 * ------------------------------------------------------------------ */
function makeHasher(size = 128) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = Math.round((size * H) / W)
  const g = c.getContext('2d', { willReadFrequently: true })
  return { c, g, w: c.width, h: c.height }
}
const HAS = makeHasher()

function hashCanvas() {
  const { g, w, h } = HAS
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, w, h)
  g.drawImage(canvas, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  let h1 = 2166136261
  for (let i = 0; i < d.length; i += 4) {
    h1 ^= d[i]; h1 = Math.imul(h1, 16777619)
    h1 ^= d[i + 1]; h1 = Math.imul(h1, 16777619)
    h1 ^= d[i + 2]; h1 = Math.imul(h1, 16777619)
  }
  return h1 >>> 0
}

/** 非背景像素占比（ui/lyrics/fx 关闭，只看舞台 + 鲸鱼娘）。
 *
 *  「背景」取该帧自身的众数颜色（多数场景是深灰竖条纹 / 深蓝渐变 / 红警报底），
 *  因此这个指标回答的是「这一帧是不是一片死板的纯色」——正是 SPEC §7 b) 想拦住的情况。
 *  阈值 2%。刻意不按「亮度 > x」判定：细线几何（段 C 的点云圆周、段 D 的时间尺）
 *  在降采样后会被稀释，那样会误判成空帧。 */
function stageCoverage() {
  const { g, w, h } = HAS
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, w, h)
  g.drawImage(comp.post, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const n = w * h
  // 6 bit/通道量化：既能容忍渐变噪声，又能分辨 8% 强度的竖条纹
  const key = (i) => ((d[i] >> 2) << 12) | ((d[i + 1] >> 2) << 6) | (d[i + 2] >> 2)
  const hist = new Map()
  for (let i = 0; i < d.length; i += 4) {
    const k = key(i)
    hist.set(k, (hist.get(k) || 0) + 1)
  }
  let bestK = 0
  let bestC = -1
  for (const [k, c] of hist) if (c > bestC) { bestC = c; bestK = k }
  let sr = 0, sg = 0, sb = 0, cnt = 0
  for (let i = 0; i < d.length; i += 4) {
    if (key(i) === bestK) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++ }
  }
  const mr = sr / Math.max(1, cnt)
  const mg = sg / Math.max(1, cnt)
  const mb = sb / Math.max(1, cnt)
  let dev = 0
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - mr) + Math.abs(d[i + 1] - mg) + Math.abs(d[i + 2] - mb) > 10) dev++
  }
  return dev / n
}

async function runSelftest() {
  renderPaused = true
  await new Promise((r) => setTimeout(r, 30))
  const lines = []
  const st = (window.__selftestState = { lines, done: false })
  const yieldNow = () => new Promise((r) => setTimeout(r, 0))
  const say = (id, ok, msg = '') => {
    const s = `${ok ? 'PASS' : 'FAIL'}  ${id}${msg ? '  ' + msg : ''}`
    lines.push(s)
    console.log(s)
    renderSelftestPanel(lines)
  }

  const origMask = { ...layerMask }
  const withMask = (patch) => Object.assign(layerMask, { stage: true, whale: true, ui: true, fx: true, lyrics: true }, patch)

  // 预热：一次性资源初始化（立绘变体画布、GL 程序、字体度量缓存）。
  // 这不是跨帧状态，只是首帧的一次性准备；预热之后渲染必须完全由 t 决定。
  // 逐段取样，覆盖各段用到的全部立绘角色与着色变体（一次性生成后即缓存）
  try {
    for (const s of SCENES) {
      for (const lt of [0.2, 0.7]) {
        renderAt(s.start + lt * (s.end - s.start))
      }
      await yieldNow()
    }
  } catch (e) {
    say('预热', false, String(e && e.message))
  }
  await yieldNow()

  // ---- a) 确定性 ----
  try {
    const t0 = 42.5
    renderAt(t0)
    const h1 = hashCanvas()
    renderAt(t0)
    const h2 = hashCanvas()
    const same = h1 === h2

    const N = 24
    const times = []
    for (let i = 0; i < N; i++) times.push(2 + (i / N) * (clock.duration - 6))
    const seq = []
    for (let i = 0; i < N; i++) {
      renderAt(times[i])
      seq.push(hashCanvas())
      if (i % 4 === 3) await yieldNow()
    }
    const order = rng.permute(N, 20261002)
    let mism = 0
    for (let i = 0; i < N; i++) {
      const k = order[i]
      renderAt(times[k])
      if (hashCanvas() !== seq[k]) mism++
      if (i % 4 === 3) await yieldNow()
    }
    say('a 确定性', same && mism === 0, `同 t 两次:${same ? '一致' : '不一致'}；乱序 ${N} 点不一致数=${mism}`)
  } catch (e) {
    say('a 确定性', false, String(e && e.message))
  }
  await yieldNow()

  // ---- b) 每段 6 个进度点不抛异常、非背景像素 > 2% ----
  try {
    const bad = []
    for (const s of SCENES) {
      // 0.94 会落进 DIRECTOR 强制的黑场（段 J 2:26.5、段 N 3:29 之后），故取 0.92
      for (const lt of [0.06, 0.22, 0.4, 0.58, 0.76, 0.92]) {
        const t = s.start + lt * (s.end - s.start)
        const before = errors.length
        withMask({ ui: false, lyrics: false, fx: false })
        renderAt(t)
        const cov = stageCoverage()
        Object.assign(layerMask, origMask)
        const threw = errors.length > before
        if (threw || cov <= 0.02) bad.push(`${s.id}@${lt}:${threw ? 'throw' : ''}${cov <= 0.02 ? `cov=${(cov * 100).toFixed(1)}%` : ''}`)
      }
      await yieldNow()
    }
    say('b 段落覆盖', bad.length === 0, bad.length ? bad.slice(0, 6).join(' ') : `${SCENES.length} 段落 × 6 点`)
  } catch (e) {
    say('b 段落覆盖', false, String(e && e.message))
  }
  await yieldNow()

  // ---- c) 时间轴覆盖与重叠 ----
  try {
    const dur = clock.duration
    const gaps = []
    let overlapMax = 0
    let overlapTime = 0
    let lastCount = 0
    let runStart = 0
    for (let t = 0; t <= dur; t += 0.25) {
      const n = SCENES.filter((s) => t >= s.start && t < s.end).length
      if (n === 0) gaps.push(t.toFixed(2))
      if (n > 1) overlapTime += 0.25
      if (n > lastCount) runStart = t
      if (n <= 1 && lastCount > 1) overlapMax = Math.max(overlapMax, t - runStart)
      lastCount = n
    }
    const lastEnd = Math.max(...SCENES.map((s) => s.end))
    if (dur - lastEnd > 0.26) gaps.push(`末尾至 ${dur.toFixed(2)}`)
    const ok = gaps.length === 0 && overlapMax <= 0.4
    say('c 时间轴覆盖', ok, `空隙=${gaps.length ? gaps.slice(0, 5).join(',') : '无'}；最大重叠=${overlapMax.toFixed(2)}s；重叠总时长=${overlapTime.toFixed(2)}s`)
  } catch (e) {
    say('c 时间轴覆盖', false, String(e && e.message))
  }
  await yieldNow()

  // ---- d) 每句歌词几何在画面内且中英不重叠；抽样做像素级「确实画上去」验证 ----
  try {
    const bad = []
    const stride = Math.max(1, Math.floor(lyricsData.length / 6))
    let sampled = 0
    for (let i = 0; i < lyricsData.length; i++) {
      const s = lyricsData[i]
      const lay = L.get(s.i)
      const { en, zh } = lay.bbox
      const inside = en.x >= 0 && en.y >= 0 && en.x + en.w <= W && en.y + en.h <= H
      const zinside = !zh || (zh.x >= 0 && zh.y >= 0 && zh.x + zh.w <= W && zh.y + zh.h <= H)
      const overlap = zh ? !(en.y + en.h <= zh.y + 0.5 || zh.y + zh.h <= en.y + 0.5) : false
      let drawn = true
      if (i % stride === 0) {
        const mid = s.t0 + Math.min(0.3, Math.max(0.06, (s.hold - s.t0) * 0.5))
        withMask({ lyrics: true })
        renderAt(mid)
        const hOn = hashCanvas()
        withMask({ lyrics: false })
        renderAt(mid)
        const hOff = hashCanvas()
        Object.assign(layerMask, origMask)
        drawn = hOn !== hOff
        sampled++
      }
      if (!inside || !zinside || overlap || !drawn) {
        bad.push(`#${s.i}${!inside ? ' en越界' : ''}${!zinside ? ' zh越界' : ''}${overlap ? ' 重叠' : ''}${!drawn ? ' 未绘制' : ''}`)
      }
      if (i % 10 === 9) await yieldNow()
    }
    say('d 歌词层', bad.length === 0, bad.length ? `${bad.length} 句有问题：${bad.slice(0, 5).join(' ')}` : `${lyricsData.length} 句几何通过，抽样 ${sampled} 句像素验证`)
  } catch (e) {
    say('d 歌词层', false, String(e && e.message))
  }
  await yieldNow()

  // ---- e) 无音频降级 ----
  try {
    const c2 = new Clock()
    await c2.init('./__definitely_missing_audio__.flac')
    const okNoAudio = c2.hasAudio === false
    c2.play()
    c2.tick(0)
    c2.tick(1000)
    c2.tick(2000)
    const advanced = c2.t > 0.9
    const before = errors.length
    renderAt(c2.t)
    const noThrow = errors.length === before
    say('e 无音频降级', okNoAudio && advanced && noThrow, `hasAudio=${c2.hasAudio} t=${c2.t.toFixed(2)} 渲染无异常=${noThrow}`)
  } catch (e) {
    say('e 无音频降级', false, String(e && e.message))
  }
  await yieldNow()

  // ---- f) window.__errors 为空 ----
  say('f 错误表', errors.length === 0, errors.length ? `${errors.length} 条：${errors.slice(0, 3).map((e) => e.where).join(',')}` : '空')

  Object.assign(layerMask, origMask)
  renderAt(clock.t)
  renderPaused = false
  st.done = true
  console.log('[selftest] 完成')
}

let renderSelftestPanel = () => {}

boot().catch((e) => {
  console.error('[boot] 失败', e)
  errors.push({ where: 'boot', message: String((e && e.message) || e) })
  const pre = document.createElement('pre')
  pre.id = 'selftest'
  pre.textContent = `BOOT FAILED\n${e && e.stack ? e.stack : e}`
  document.body.appendChild(pre)
})
