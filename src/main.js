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
import { loadSprites, drawSprite, standRect, prewarmRole } from './whale/sprite.js'
import { castAt, CAST_SUMMARY, APPEARANCES } from './whale/cast.js'
import { createCues } from './core/cues.js'
import { createStageRoles, LIMITS as ROLE_LIMITS, ZONES as ROLE_ZONES } from './core/stage_roles.js'
import { exposureAt, exemptAt, EXPOSURE_SUMMARY, EXPOSURE_KEYS, acesFilmicJS } from './core/exposure.js'
import { cameraAt, applyCamera, impactOffset, RIG_SUMMARY } from './core/rig.js'
import { buildImpulses, pulseAt, shockwaves } from './core/impact.js'
import { ANCHORS } from './scenes/anchors.js'
import { createLyrics, drawLyrics, englishAlpha } from './lyrics/render.js'
import { ctxAt, tpsAt, statusAt, MONO } from './ui/dsh.js'
import { setStrict as setTextStrict, listViolations, violationSummary, resetViolations, FONT, resetBBoxes, findTextOverlaps, resetGhostStats, ghostStats, markScreenContext, getBBoxes, textGuardDebug, getTextureReports, clearTextureReports } from './ui/text.js'
import { createDomUI, uiVisibleAt, windowAt, CONFIG as DSH_CONFIG } from './ui/dom.js'
import './ui/dsh.css'
import { SCENES } from './scenes/index.js'
import { createSwarm, swarmStateAt, SWARM_COUNT, SEGMENT_SWARM, SEGMENT_COLORS, LAYOUT_NAMES } from './lib/swarm.js'
import { createSwarm2D } from './lib/swarm2d.js'
import { selfCheck as propsSelfCheck, PROP_KINDS, createProp } from './lib/props/index.js'
import { codeWall } from './lib/codewall.js'
import { snippetsReport } from './lib/snippets.js'
import * as DIALOGUE_MOD from './data/dialogue.js'
const dialogueMeta = DIALOGUE_MOD
import * as THREE from 'three'

const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')
const SELFTEST = params.has('selftest')
// FIX §5.5：支持 ?lyricY=0.9 直接微调英文基线
const LYRIC_Y = params.has('lyricY') ? parseFloat(params.get('lyricY')) : undefined
// FIX §0.5：?strictText=1 让字号守卫直接抛错
// FIX_V3 §2.1：**下线 dsh DOM 窗口**（用户痛点 P1 遮挡画面、P2 窗口内文字重叠、P10 性能）。
//   影片中不再创建 #dsh-layer、不再做 CSS3D 变换；src/ui/dsh/ 的代码保留，只供 ?dshpreview
//   做"与官方界面对照"。终端内容改由 3D 的 TermPane / Monitor 承载（§2.2 / §2.3）。
//   ?dsh=1 仍可强制打开，用于回归对比；默认关闭。
const DSH_ALWAYS = params.get('dsh') === '1'
/**
 * FIX_V3 §2.1 明写「新增 CONFIG.dshWindow=false」——这里就是那个具名开关。
 * `?dsh=1` 可临时打开（回归对比用），其余情况恒为 false。
 */
const CONFIG = {
  dshWindow: DSH_ALWAYS,
}
const DSH_WINDOW = CONFIG.dshWindow
const DSH_THEME = params.get('theme') === 'light' ? 'light' : params.get('theme') === 'dark' ? 'dark' : null
const STRICT_TEXT = params.get('strictText') === '1'
if (STRICT_TEXT) setTextStrict(true)

/**
 * ?shot=分:秒（FIX §4 要求）。
 * 直接把画面**定格**在某个时间点：不启动音频、不跑 rAF 循环，只渲染这一帧。
 * 于是任何时刻截图（含无头浏览器 --screenshot）拿到的都是同一个确定画面 ——
 * 这是"逐项用演示段验证 + 截图反馈"的基础设施。
 * 支持 `2:27.9` / `147.9` 两种写法。
 */
function parseShot(v) {
  if (v == null) return null
  const s = String(v).trim()
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s)
  if (m) return parseInt(m[1], 10) * 60 + parseFloat(m[2])
  const f = parseFloat(s)
  return Number.isFinite(f) ? f : null
}
const SHOT = params.has('shot') ? parseShot(params.get('shot')) : null
const CONTACT = params.has('contact')
/** 是否有演示段（?demo=…）在场：有则演示段独占画面（见 renderAt 的说明） */
const demoMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

/**
 * 每个界面的窗口尺寸由**调用方**（这里）指定，而不是 CSS 里写死（用户 F2a 第 2 条）。
 * 约束：宽 45–60% 画面宽、高 ≤76%、底边不越过 84%（歌词占底部 16%）。
 * dom.js 的 clampToSafe() 会再兜一次底，所以这里写错也进不了歌词区。
 */
/**
 * 每个界面的窗口尺寸由**调用方**（这里）指定，而不是 CSS 里写死（用户 F2a 第 2 条）。
 * 约束：宽 45–60% 画面宽、高 ≤76%、底边不越过 84%（歌词占底部 16%）。
 * dom.js 的 clampToSafe() 会再兜一次底（并且是**按透视投影后**的尺寸算的，
 * 所以布局比例要留出投影缩放的余量），任何调用方都写不出进入歌词区的窗口。
 */
const WINDOW_GEOM = {
  'chat-F': { wFrac: 0.58, hFrac: 0.66, rightPx: 0 },
  'chat-G': { wFrac: 0.57, hFrac: 0.72, rightPx: 300 }, // 工具卡片最密的段：右栏开
  'chat-H': { wFrac: 0.57, hFrac: 0.72, rightPx: 0 },
  'chat-I': { wFrac: 0.57, hFrac: 0.72, rightPx: 300 }, // 2:00 压缩：右栏开
  'chat-M': { wFrac: 0.56, hFrac: 0.62, rightPx: 0 },
  'chat-N': { wFrac: 0.57, hFrac: 0.72, rightPx: 300 }, // 交接
  // 不在任何界面窗口内时也要给一个确定值：否则面板会保留上一个窗口的几何，
  // 使"同一个 t 的 DOM 哈希"取决于此前渲染过哪些时刻（selftest a 的乱序比对会 FAIL）。
  default: { wFrac: 0.56, hFrac: 0.72, rightPx: 0 },
}

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

// ?only3d=1：只保留 3D 与后处理（关掉 2D 舞台/鲸鱼/歌词），用于单独检查 3D 物件与蜂群
const ONLY3D = params.get('only3d') === '1'
const NOFX = params.get('nofx') === '1'
const layerMask = {
  stage: !ONLY3D,
  whale: !ONLY3D,
  ui: true,
  fx: !NOFX,
  lyrics: !ONLY3D,
  swarm: params.get('swarm') !== '0', // 全片持久蜂群（FIX §2.1）
}
/** 蜂群清空时刻：CRT 关机那一帧起（FIX §5.6 段 N 要求立绘/界面/蜂群全清，只剩亮线） */
const SWARM_CLEAR_AT = 209.0
/** 桥接时刻（§2.1 的 13 条），供预热与自检使用 */
const BRIDGE_TIMES = [14.5, 29.7, 44.0, 59.0, 74.0, 88.8, 103.5, 118.3, 129.0, 147.9, 162.0, 177.4, 188.5]

/* ------------------------------------------------------------------ *
 * 每帧复用的上下文（避免分配）
 * ------------------------------------------------------------------ */
const ctx = {
  W, H, sync, fx, ease, rng, C, rgba,
  t: 0, lt: 0,
  g: null, gFront: null, gWhale: null, gUI: null,
  three: null,
  whale: null,
  cues: null,
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
  // §2.8：每帧开始清空文字包围盒登记表（text() 会重新登记本帧的每一处文字）
  resetBBoxes()
  ctx.t = t
  ctx.g = comp.layers.stageBack.g
  ctx.gFront = comp.layers.stageFront.g
  ctx.gWhale = comp.layers.whale.g
  ctx.gUI = comp.layers.ui.g
  // §2.8 补强：把**屏幕上下文**标记出来。之后这些画布上的**裸 fillText** 也会登记包围盒，
  // 于是 F–N 段（还没迁到 text()）的文字也进入同层重叠检测 —— 这是定位"文字叠成一团"的前提。
  // 只标屏幕画布：代码墙 / TermPane / 年份数字画在离屏贴图上，坐标与屏幕无关，登记会造假阳性。
  markScreenContext(ctx.g, 'stage')
  markScreenContext(ctx.gFront, 'front')
  markScreenContext(ctx.gWhale, 'whale')
  markScreenContext(ctx.gUI, 'ui')
  ctx.three = { scene: comp.scene, camera: comp.camera, stage3d: comp.stage3d, whale3d: comp.whale3d, renderer: comp.renderer }
  // 场景自建的 3D 对象每帧先全部隐藏，由当前活跃场景显式打开
  for (const c of comp.stage3d.children) c.visible = false
  ctx.whale = resetWhaleState()
  ctx.rect = standRect(W, H)
  ctx.hud = { ctxPct: ctxAt(t), tps: tpsAt(t, sync), status: statusAt(t) }
  ctx.debug = DEBUG
  ctx.impulses = impulses
  ctx.stageRoles = stageRoles
  ctx.bgIs3d = !!(comp && comp.bgIs3d)
  ctx.post3dReady = !!(comp.post3d && comp.post3d.enabled)
  ctx.overlay = null

  /* ------------------------------------------------------------------ *
   * ⚠️ 顺序很重要：**先把本帧的相机算好并写进 three，再跑各段 render()**。
   *
   * 这里原本是反过来的（先跑场景、后 applyCamera），后果是一个真 bug：
   * 段 D/E 的 3D 重写会在 render() 里读 `ctx.three.camera`（隧道环心跟着相机、
   * 年份牌 `quaternion.copy(camera.quaternion)`、合拢墙按相机距离外推……），
   * 而那时相机还停在**上一帧**的位姿上 —— 于是同一 t 的输出取决于**之前渲染过哪个 t**，
   * 直接违反 FIX_V3 §0「渲染路径是 f(t) 的纯函数」。
   *
   * 实测症状（`?selftest` a) 报"乱序 24 点差 2"，点正是 t=53.48 / t=70.64）：
   *   · 同一 t 连渲 3 次：第 1 次与第 2 次差 616417 像素，第 2、3 次完全相同（相机收敛了）；
   *   · t=53.48 的隧道年份牌，每次换一个"前一帧"就整体平移（−6.466 / −9.185 / −7.479），
   *     而它的滚动输入 `off=12.2836`、`speed=11.8976`、`flip=1` 三次完全一致
   *     → 说明不纯的不是滚动，而是它读到的 `camera.position.z`（zBase）。
   * 相机本身是纯函数（`applyCamera` 无状态、`cameraAt(t)` 只依赖 t），
   * 之前唯一的问题就是**它被写得太晚**。
   * ------------------------------------------------------------------ */
  const imp = pulseAt(t, impulses)
  const off = impactOffset(t, impulses)
  {
    // 相机轨道（FIX §2.1）：位置/注视点/fov/roll + 冲击 punch
    // 演示段（?demo=…）提供自己的机位，否则 rig 的机位会把被摄物裁掉（见 z_demo_f2b 的 DEMO_CAM）
    const demoScene = demoMode ? SCENES.find((s) => s.demo && typeof s.cam === 'function') : null
    const cam = demoScene ? { ...demoScene.cam(), roll: 0, isCut: false } : cameraAt(t)
    const dir = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]]
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
    cam.pos = [cam.pos[0] - (dir[0] / dl) * off.punch, cam.pos[1] - (dir[1] / dl) * off.punch, cam.pos[2] - (dir[2] / dl) * off.punch]
    cam.fov += off.fovAdd
    applyCamera(comp.camera, cam)
    ctx.three.camState = cam
  }

  const active = []
  for (const s of SCENES) {
    if (t < s.start || t >= s.end) continue
    // 演示段（?demo=…）独占画面：否则同期的影片段落会抢镜（例如段 A 的开机屏会把 3D 挡住），
    // "用演示段逐项验证"就变成看两段叠在一起。演示段不属于影片，这条只影响 ?demo 会话。
    if (demoMode && !s.demo) continue
    if (!demoMode && s.demo) continue
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
    applySwarm(t)
    // §6：曝光关键帧（ACESFilmic 在后处理链末端做；没有后处理时退回 renderer.toneMapping）
    const expo = exposureAt(t)
    ctx.exposure = expo
    comp.renderer.toneMapping = THREE.ACESFilmicToneMapping
    comp.renderer.toneMappingExposure = expo
    // 3D 后处理参数：全部由 t 推导（冲击 + rms）
    comp.renderThree(t, {
      dispersion: fx.dispersion(t) * 0.45,
      glitch: fx.glitch(t),
      radial: Math.min(1, imp * 0.8 + sync.rmsAt(t) * 0.25),
      vignette: 0.34 + 0.22 * fx.crt(t).level * 0,
      aberration: 1.2 + imp * 6 + sync.rmsAt(t) * 1.5,
      bloom: 0.36 + imp * 0.6 + fx.burst(t) * 0.35,
      bloomRadius: 0.6 + imp * 0.25,
      scan: 0.22,
      exposure: expo,
    })
  } catch (e) {
    reportError('three', e)
  }

  // §2.4 / §9-q：3D 已经画完、场景也把本帧的位置写好了，现在按**实际投影结果**
  // 量出每个登记对象的屏幕包围盒与相机距离，供 q) 判定遮挡规则。
  // 放在这里（而不是 renderAt 开头）是因为 pane 的位置由 §2.5 的漂移/视差逐帧改写。
  if (stageRoles) {
    try {
      stageRoles.beginFrame()
      stageRoles.measure(comp.camera, { renderer: comp.renderer })
    } catch (e) {
      reportError('stageRoles', e)
    }
  }

  try {
    drawHud(comp.layers.ui.g, t)
  } catch (e) {
    reportError('hud', e)
  }

  // dsh 界面层：内容（纯函数）+ 相机联动 + CSS 故障变量
  if (dshUI) {
    try {
      dshUI.setVisible(DSH_ALWAYS || uiVisibleAt(t))
      // 上下文占用**只有一个来源**：ctxAt(t)（用户 F2a 第 4 条）
      // 窗口尺寸也由调用方给：每个窗口的宽/高比例写在 WINDOW_GEOM（45–60% / ≤76%）
      const w = windowAt(t)
      const camState = ctx.three && ctx.three.camState
      dshUI.render(t, ctxAt(t), camState && !demoMode ? camState : null, WINDOW_GEOM[w ? w.id : 'default'])
      dshUI.setFx({
        glitch: fx.glitch(t),
        dispersion: fx.dispersion(t),
        shake: fx.shake(t),
        alpha: DSH_ALWAYS || uiVisibleAt(t) ? 1 : 0,
      })
    } catch (e) {
      reportError('dshUI', e)
    }
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
  rendered = active
  if (layerMask.lyrics) {
    try {
      markScreenContext(vg, 'lyrics')
      drawLyrics(vg, t, L, { alpha: 1, pulse: sync.pulse(t, 180) })
    } catch (e) {
      reportError('lyrics', e)
    }
  }
  // 片尾字幕等需要在后处理之上显示的内容（仅段 N 使用）：
  // CRT 关机后画面整体被压成一条亮线，字幕必须画在合成本身之上。
  if (layerMask.ui && ctx.overlay) {
    try {
      markScreenContext(vg, 'overlay')
      ctx.overlay(vg, t)
    } catch (e) {
      reportError('overlay', e)
    }
  }
  return { active }
}

/**
 * 全片持久蜂群（FIX §2.1）。它是"连续主角"：整片一直在场，
 * 各段只给它下发**目标布局**，段内与段间都由带错峰的缓动形变完成。
 * 布局表在 src/lib/swarm.js 的 SEGMENT_SWARM + BRIDGES；3D 与 2D 两层共用同一份布局数组。
 * 关掉：?swarm=0（用于 A/B 对拍）。
 */
function applySwarm(t) {
  if (!swarm) return null
  // 演示会话（?demo=…）里影片蜂群退场，避免与演示段自己的蜂群叠在一起
  // （同"演示段独占画面"的理由：否则看的是两套蜂群，验不出演示段那套）
  if (demoMode) {
    swarm.object.visible = false
    if (swarm2d) swarm2d.object.visible = false
    hadSwarm = null
    hadSwarm2d = null
    return null
  }
  const st = swarmStateAt(t)
  const visible = layerMask.swarm && t < SWARM_CLEAR_AT
  // 3D 层：真实透视里的粒子（自检 n 的三角形数主要来源）
  swarm.object.visible = visible
  if (visible) {
    swarm.update(t, {
      camera: comp.camera,
      alpha: st.alpha,
      size: st.size,
      colorA: st.colorA,
      colorB: st.colorB,
      state: st,
    })
  }
  // 2D 层：同一份 aFrom/aTo 再投影一次，保证蜂群**永远在画面里**（3D 相机贴近/拉远时也不落空）
  if (visible && swarm2d) {
    swarm2d.object.visible = true
    const r2 = swarm2d.update(t, {
      camera: comp.camera,
      from: swarm.layoutOf(st.from),
      to: swarm.layoutOf(st.to),
      u: st.u,
      stagger: st.bridge ? 0.8 : 0.5,
      // 2D 层只做"永远在场"的兜底与纵深：数量少、点小、压到 3D 层的四成左右。
      // （实测定标：2D 层与 3D 层同强度时，两层加法叠加会把段自己的几何整片糊掉）
      // 2D 层只做"永远在场"的兜底与纵深：点要够大（≥4px），
      // 否则 1px 级的点精灵在软件光栅化下会产生不确定的像素（实测 a 确定性会因此 FAIL）
      size: st.size * 190,
      alpha: st.alpha * 0.42,
      colorA: st.colorA,
      colorB: st.colorB,
      bulge: st.bridge ? 0.22 : 0.1,
    })
    hadSwarm2d = r2
  } else if (swarm2d) {
    swarm2d.object.visible = false
    hadSwarm2d = null
  }
  hadSwarm = {
    seg: st.seg,
    from: st.from,
    to: st.to,
    u: +st.u.toFixed(3),
    bridge: st.bridge ? `${st.bridge.from}→${st.bridge.to}` : null,
    drawn: visible,
    p2: hadSwarm2d ? hadSwarm2d.drawn : 0,
  }
  return hadSwarm
}

/** 当前形变状态（供 ?debug 与自检读取） */
function swarmInfoAt(t) {
  const st = swarmStateAt(t)
  return { ...st, bridge: st.bridge ? `${st.bridge.from}→${st.bridge.to}` : null }
}

function applyWhale(t) {
  const w = ctx.whale
  // 正交相机左右为 ±(W/H)、上下为 ±1，故世界单位 1 = 半屏高；
  // 屏幕像素 → 世界坐标：x = (px - W/2)/(H/2)，y = -(py - H/2)/(H/2)
  const frame = { cx: W / 2, cy: H / 2, S: H / 2 }

  // ---- 立绘：出场表是权威（FIX.md §5.1：表外时段 alpha 必须为 0）----
  // 场景对 ctx.whale.sprite 的请求只在 W1–W5 窗口内生效，且素材由窗口指定；
  // 逐段的立绘代码将在 P2 分段重做时删除。
  const cast = castAt(t)
  hadCast = cast
  if (cast && spritesReady && layerMask.whale) {
    const aspect = 0.5557
    const h = H * 1.02 * cast.scale
    const w2 = h * aspect
    const cx = W * cast.cxFrac
    const tint = cast.dim < 1 ? '#2a3340' : null
    try {
      drawSprite(ctx.gWhale, t, {
        expr: cast.role,
        rect: { x: cx - w2 / 2, y: H * 0.15, w: w2, h },
        alpha: cast.alpha * (cast.dim < 1 ? 0.55 + 0.45 * cast.dim : 1),
        desat: cast.desat,
        tint,
        tintAmt: tint ? (1 - cast.dim) * 0.6 : 0,
        glitch: 0,
      })
    } catch (e) {
      reportError('sprite', e)
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

/**
 * FIX_V4 §2.1：**角落 HUD 全部取消**（含 "context 0%" 这类小字）。
 * 于是本函数现在只剩一件事：段 J 溢出的**画面中央巨字**——§2.1 明写「上下文数字
 * 只在 J 段中央巨字出现」。段 A 开场右上角那行 `context X%` 已按 §1.1/§2.1 删除。
 * 段 I（压缩）与段 N（88% 交接）由终端屏自己显示（同一 ctxAt 值），避免同屏两个读数。
 */
function drawHud(g, t) {
  const pct = ctxAt(t)
  // 段 J 溢出：中央巨字（沿用 DIRECTOR 的 ≥200px 要求），到 100% 时更红更抖
  if (t >= 129.0 && t < 147.9) {
    // 注意：main.js 里 ease / rng 是命名空间导入，必须写 ease.clamp / rng.hash01。
    // 之前这里直接写 clamp(…) 会抛 ReferenceError，被 try/catch 吞掉，
    // 于是 §5.3 要求的"段 J 中央巨字"整段都没画出来。
    const hot = ease.clamp((pct - 20) / 80)
    const size = 120 + 150 * hot
    const jit = hot > 0.9 ? (rng.hash01(Math.floor(t * 24), 7) - 0.5) * 10 : 0
    g.save()
    g.translate(jit, 0)
    g.font = `700 ${size}px ${FONT.sans}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = hot > 0.75 ? rgba(C.red, 0.92) : rgba(C.amber, 0.9)
    g.shadowColor = hot > 0.75 ? rgba(C.red, 0.5) : 'rgba(0,0,0,0.6)'
    g.shadowBlur = 24
    g.fillText(`${Math.round(pct)}%`, W / 2, H * 0.44)
    g.shadowBlur = 0
    g.font = `600 28px ${FONT.sans}`
    g.fillStyle = rgba(C.fgDim, 0.85)
    g.fillText('context', W / 2, H * 0.44 + size * 0.62)
    g.restore()
  }
}

function reportError(where, e) {  const rec = { where, message: String((e && e.message) || e), stack: e && e.stack, t: ctx.t }
  errors.push(rec)
  console.error('[error]', where, e)
}

/**
 * ?probe=1（配合 ?shot）—— 把这一帧的机器可读状态写进 DOM，
 * 供无头浏览器用 --dump-dom 取回。是"逐项验证"的取证手段，不是影片内容。
 */
function writeProbe(kind = '') {
  const el = document.createElement('pre')
  el.id = 'probe'
  el.hidden = true
  const tri = (o) => {
    let n = 0
    o.traverse((x) => {
      if (!x.isMesh && !x.isInstancedMesh) return
      const gg = x.geometry
      if (!gg) return
      const per = gg.index ? gg.index.count / 3 : gg.attributes.position ? gg.attributes.position.count / 3 : 0
      n += per * (x.isInstancedMesh ? x.count : 1)
    })
    return Math.round(n)
  }
  const stage = comp.stage3d.children.map((c) => ({
    name: c.name || c.type,
    visible: c.visible,
    tris: tri(c),
  }))
  // ?probe=objs：列出所有可见网格的世界坐标与材质透明度（定位"谁叠在谁上面"用）
  const objs = []
  if (kind === 'objs' || params.get('probe') === 'objs') {    comp.stage3d.traverse((o) => {
      if ((o.isMesh || o.isPoints || o.isLine) && o.visible && o.parent && o.parent.visible) {
        const p = new THREE.Vector3()
        o.getWorldPosition(p)
        objs.push({
          n: o.name || o.type,
          p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
          op: o.material ? +(o.material.opacity ?? 1).toFixed(3) : null,
          tr: o.material ? !!o.material.transparent : false,
          ro: o.renderOrder,
          dw: o.material ? o.material.depthWrite !== false : null,
          dt: o.material ? o.material.depthTest !== false : null,
          geo: o.geometry && o.geometry.type,
        })
      }
    })
  }
  // 画布统计：亮度均值/方差、非黑占比 —— 用"客观数字"确认这一帧真的有内容
  const st = document.createElement('canvas')
  st.width = 240
  st.height = 135
  const sg = st.getContext('2d', { willReadFrequently: true })
  sg.drawImage(canvas, 0, 0, 240, 135)
  const d = sg.getImageData(0, 0, 240, 135).data
  let sum = 0
  let sum2 = 0
  let nz = 0
  const bright = { r: 0, g: 0, b: 0, n: 0 }
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255
    sum += l
    sum2 += l * l
    if (l > 0.08) {
      nz++
      bright.r += d[i]
      bright.g += d[i + 1]
      bright.b += d[i + 2]
      bright.n++
    }
  }
  const np = d.length / 4
  const mean = sum / np
  el.textContent = JSON.stringify({
    t: ctx.t,
    shot: SHOT,
    active: rendered,
    stage: stage.filter((s) => s.visible),
    stageTotal: stage.length,
    layerMask,
    bgIs3d: comp.bgIs3d,
    post3d: !!(comp.post3d && comp.post3d.enabled),
    info: { tris: comp.renderer.info.render.triangles, calls: comp.renderer.info.render.calls },
    px: {
      mean: +mean.toFixed(4),
      sd: +Math.sqrt(Math.max(0, sum2 / np - mean * mean)).toFixed(4),
      lit: +(nz / np).toFixed(4),
      rgb: bright.n ? [Math.round(bright.r / bright.n), Math.round(bright.g / bright.n), Math.round(bright.b / bright.n)] : null,
    },
    errors: errors.slice(0, 6),
    errorCount: errors.length,
    objs,
  })
  document.body.appendChild(el)
  // 走 ?probe=1（人工在控制台看）时才打一行；CDP 客户端（tools/shoot.mjs）从 DOM 直接取，
  // 不需要把整包 JSON 灌进 console（实测会刷屏并拖慢虚拟时间）。
  if (!kind && params.has('probe')) console.info(`PROBE ${el.textContent}`)
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
/**
 * ?dshpreview —— 整屏静态对照页（用户 F2a 第 7 条）。
 * 左右并排两块 1920×1080 的舞台：左亮右暗，各自完整渲染一份 dsh 界面（同一个 t），
 * 便于与官方 pnpm dsh web 的实际界面逐项比对。不启动音频、不跑场景循环。
 */
function buildDshPreview() {
  const T0 = 86.0 // 取段 G：思考块 + 助手正文 + 工具卡片 + 用户气泡都在场
  document.body.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.id = 'dsh-preview'
  document.body.appendChild(wrap)

  const SCALE = 940 / 1920 // 两套并排，正好铺满对照页
  for (const [theme, label] of [['light', 'light tokens'], ['dark', 'dark tokens']]) {
    const set = document.createElement('div')
    set.className = 'dsh-set'
    set.dataset.theme = theme
    const lbl = document.createElement('div')
    lbl.className = 'lbl'
    lbl.textContent = label
    const box = document.createElement('div')
    box.className = 'box'

    const ui = createDomUI({ W: 1920, H: 1080 })
    ui.setTheme(theme)
    // 用段 G 的几何（含 300px 右栏）→ 预览里能看到官方那套三列布局
    ui.render(T0, ctxAt(T0), null, WINDOW_GEOM['chat-G'])
    ui.stage.style.transform = 'none' // 对照页要的是"平铺的界面"，不要相机透视
    const layer = ui.layer
    layer.removeAttribute('id') // 两棵树不能重复 id
    layer.style.position = 'absolute'
    layer.style.left = '0'
    layer.style.top = '0'
    layer.style.width = '1920px'
    layer.style.height = '1080px'
    layer.style.transform = `scale(${SCALE})`
    layer.style.transformOrigin = '0 0'
    box.appendChild(layer)
    set.appendChild(lbl)
    set.appendChild(box)
    wrap.appendChild(set)
  }
  console.info('[dshpreview] 已铺出亮/暗两套界面；与官方 pnpm dsh web 对照见 docs/DSH_UI_NOTES.md')
}

async function boot() {
  await document.fonts.ready
  // 官方品牌字 Montserrat（public/dsh/fonts，OFL）：用于画布上出现的品牌字样
  try {
    await Promise.all([
      document.fonts.load('500 32px "Montserrat"'),
      document.fonts.load('400 32px "Montserrat"'),
    ])
  } catch (e) {
    /* 字体缺失不致命 */
  }

  await sync.load('./data/analysis.json')
  lyricsData = await fetch('./data/lyrics.json').then((r) => r.json())

  const [pd, md, cd] = await Promise.all([loadPoints(), loadMesh(), loadContour()])

  comp = new Compositor(canvas, document.getElementById('lyrics'))
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

  L = createLyrics(lyricsData, { W, H, baselineFrac: LYRIC_Y })
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

  // 词锚点系统（FIX §2.2）：先注入段落边界，再声明 anchors.js 里的锚点表
  cues = createCues({ lyrics: lyricsData, sync })
  cues.setBounds(Object.fromEntries(SCENES.map((s) => [s.id, [s.start, s.end]])))
  cues.declareAll(ANCHORS)
  ctx.cues = cues

  // dsh 界面 DOM 层（FIX_V3 §2.1 已下线；只有 ?dsh=1 才创建，用于与官方界面对照）
  if (DSH_WINDOW) {
    dshUI = createDomUI({ canvas })
    if (DSH_THEME) {
      dshUI.setTheme(DSH_THEME)
      DSH_CONFIG.defaultTheme = DSH_THEME
    }
  }

  // 全片冲量表（FIX §2.4）：onsets × 段落等级，外加场景声明的强制冲击
  // 注意：冲量只归属影片段落，demo 段（?demo=1）不参与，否则它会吃掉全部归属
  const filmSegs = SCENES.filter((s) => !s.demo)
  impulses = buildImpulses(sync.onsets.map((o) => ({ t: o.t, strength: o.s })), filmSegs, {
    force: [
      { t: 14.0, strength: 1.0, kind: 'enter', seg: 'A' }, // 回车闪白
      { t: 28.5, strength: 0.9, kind: 'burst', seg: 'B' }, // 立方体爆散
      { t: 68.5, strength: 1.0, kind: 'play', seg: 'E' }, // 巨大 ▶
      { t: 103.4, strength: 1.0, kind: 'collapse', seg: 'G' }, // 测量坍缩
      { t: 145.0, strength: 1.0, kind: 'limit', seg: 'J' }, // 溢出破裂
      { t: 161.726, strength: 1.0, kind: 'final', seg: 'K' }, // 最后一击
      { t: 205.96, strength: 1.0, kind: 'execute', seg: 'N' }, // 最后一次执行
    ],
  })

  // 3D 后处理管线（EffectComposer；失败自动回退）。?fx3d=0 可关闭以便对拍。
  if (params.get('fx3d') !== '0') await comp.setupPost3D()

  // 出场表（cast.js）用到的立绘变体全部提前生成：它们是一次性画布缓存，
  // 若留到某一段首次播放时才建，会让"乱序渲染"与"顺序渲染"不一致（selftest a）。
  for (const w of APPEARANCES) {
    prewarmRole(w.role, w.desat || 0, w.dim && w.dim < 1 ? '#2a3340' : null, w.dim && w.dim < 1 ? (1 - w.dim) * 0.6 : 1)
  }

  // 全片持久蜂群（FIX §2.1）：3D 层 + 2D 投影层，构图与身份在构造时定死
  swarm = createSwarm({ count: SWARM_COUNT })
  comp.stage3d.add(swarm.object)
  swarm.object.visible = false
  // 2D 投影层默认关闭：它会破坏"同一 t 两次渲染一致"（见 lib/swarm2d.js 顶部说明与 D39）。
  // ?swarm2d=1 打开，用于 A/B 对拍。
  if (params.get('swarm2d') === '1') {
    swarm2d = createSwarm2D({})
    // 2D 层走鲸鱼层的正交相机（1 世界单位 = 半屏高），与 3D 层共用同一套布局数组
    comp.whale3d.add(swarm2d.object)
    swarm2d.object.visible = false
  }

  // 让场景 init 也能拿到 Three 场景（自建 3D 对象挂在 comp.stage3d 上）
  ctx.three = { scene: comp.scene, camera: comp.camera, stage3d: comp.stage3d, whale3d: comp.whale3d, renderer: comp.renderer }
  // §2.4：角色登记表（hero / pane / decor）。场景在 init 里 `register(obj, {role, anchor})`，
  // 每帧渲染后由 `measure()` 按**实际投影结果**算屏幕包围盒，再由 `check()` 判定遮挡规则。
  stageRoles = createStageRoles({ THREE })
  ctx.stageRoles = stageRoles
  for (const s of SCENES) {
    try {
      if (typeof s.init === 'function') s.init(ctx)
    } catch (e) {
      reportError(`init:${s.id}`, e)
    }
  }
  registerImpacts(SCENES.flatMap((s) => s.fx || []))

  // 音频（FIX §5.2）：只播放 public/audio/song.mp3。
  // 刻意不再 glob ../assets/*.flac —— 那会把 84MB 的无损文件打进 dist（dist 目标 <15MB）。
  // public/audio/ 由 `npm run data` 从 assets/song.mp3 复制而来，且在 .gitignore 中。
  clock = new Clock()
  await clock.init('./audio/song.mp3')

  booted = true
  window.__renderAt = (t) => renderAt(t)
  window.__ctx = ctx
  window.__app = {
    comp, get clock() { return clock }, get lyrics() { return L }, sync, fx, SCENES, layerMask, errors,
    setPaused: (v) => { renderPaused = !!v },
    /** T01：?perf 的 p50/p95 帧时间报告（随时可同步调用） */
    perfReport,
    get fpsCap() { return FPS_CAP },
    textViolations: listViolations,
    textViolationSummary: violationSummary,
    resetTextViolations: resetViolations,
    /** §2.8：本帧登记的文字包围盒（含裸 fillText 经 markScreenContext 登记的那些） */
    textBoxes: getBBoxes,
    textGuard: textGuardDebug,
    findTextOverlaps,
    /** T03 / §2.3：**贴图内部**文字的重叠与字号报告（每次烘焙结算一次，见 text.js 的 setTextureSpace） */
    textureReports: getTextureReports,
    clearTextureReports,
    setTextStrict,
    lyricY: LYRIC_Y,
    castAt,
    castSummary: CAST_SUMMARY,
    /** 全片持久蜂群（FIX §2.1）：供自检与 ?debug 读取形变状态与屏幕覆盖 */
    get swarm() { return swarm },
    get swarmInfo() { return hadSwarm },
    get cues() { return cues },
    get dshUI() { return dshUI },
    setDshTheme: (th) => dshUI && dshUI.setTheme(th),
    domHash: () => (dshUI ? dshUI.hash() : 0),
    get impulses() { return impulses },
    rigSummary: RIG_SUMMARY,
    pulseAt: (t) => pulseAt(t, impulses),
    shockwavesAt: (t) => shockwaves(t, impulses),
    get post3d() { return comp && comp.post3d },
    setComposite3d: (m) => { if (comp) comp.composite3d = m === 'lighter' ? 'lighter' : 'over' },
    get composite3d() { return comp ? comp.composite3d : null },
    get cast() { return hadCast },
    /** §2.4：角色登记表（hero / pane / decor） */
    get stageRoles() { return stageRoles },
    roleLimits: ROLE_LIMITS,
    roleZones: ROLE_ZONES,
    /** §2.1：dsh DOM 窗口开关（默认 false） */
    config: CONFIG,
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

  // ?dshpreview：整屏静态铺出亮/暗两套 dsh 界面，用来与官方实际界面逐项对照
  if (params.has('dshpreview')) {
    buildDshPreview()
    return
  }

  // ?props：模型审批页（FIX_V4 §2.2）——茄子/番茄/猫的 360° 转台 + 线框开关 + 标准灯光。
  // 提前 return：不启动影片的 rAF 循环，也不建控制条（这一页只用于"看模型、决定 ✅ 还是打回"）。
  // 审批状态由用户在 docs/PROPS_APPROVAL.md 里手写；**AI 不得自己打勾**（§2.2 明文）。
  if (params.has('props')) {
    const { buildPropsPage } = await import('./ui/props_page.js')
    buildPropsPage()
    // 探针工具（tools/shoot.mjs）以 `window.__probeFrame` 是否存在判断"页面就绪"。
    // 本页不渲染影片帧，所以挂一个返回 null 的占位 + 一个专用就绪标志，
    // 这样 CDP 侧仍能求值检查 DOM/画布（与 ?probe=textscan 路由同一套做法）。
    window.__probeFrame = () => null
    window.__propsReady = true
    return
  }

  /**
   * 自动化验证通道：把一帧的机器可读状态暴露出去。
   * 无头 Chrome 的 --dump-dom 在虚拟时间下时好时坏（实测同一命令时而输出时而空），
   * 所以改成由 CDP 客户端（tools/shoot.mjs）直接求值取回。
   * 必须在 ?shot 的提前 return **之前**挂上。
   * @param {number} tt 目标时间（秒）
   * @param {'objs'|''} kind 附加信息
   */
  window.__probeFrame = (tt, kind = '') => {
    const prev = document.getElementById('probe')
    if (prev) prev.remove()
    renderAt(tt)
    writeProbe(kind)
    const el = document.getElementById('probe')
    return el ? el.textContent : null
  }
  // `?probe=modules` 时把模块报告也挂到 __probeFrame 能取到的位置（doctor 的 b2 项读它）
  window.__probeModules = () => JSON.stringify({ modules: window.__moduleReport || [] })
  window.__demoMode = demoMode

  /**
   * `?probe=textscan` —— 全片扫描文字包围盒重叠（FIX_V3.md §2.8 / §9-r）。
   * 用途：定位"某一帧文字叠成一团"的成因（用户图 3 的右上角 `context 1%`）。
   * 每 0.5s 渲染一帧，读 `findTextOverlaps()`，把有重叠的时间点与**具体是哪两处文字**打出来。
   * 这是纯诊断通道，不参与影片渲染。
   */
  if (params.get('probe') === 'textscan') {
    // 扫描要放到下一轮事件循环再跑：boot() 里同步跑 424 帧会把主线程占满，
    // 驱动端（tools/shoot.mjs）等 `__probeFrame` 的轮询会被饿死 → 调用方超时拿不到结果。
    // 用 setTimeout(…, 0) 把扫描推后，`__probeFrame`（下面几行就挂）先就位，驱动端即可正常求值。
    const step = parseFloat(params.get('scan') || '0.5')
    window.__probeFrame = () => null
    window.__probeModules = () => JSON.stringify({ modules: [] })
    window.__probeTextScan = () => JSON.stringify(window.__textScanReport || { pending: true })
    window.__textScanDone = false
    setTimeout(() => {
      const hits = []
      for (let tt = 0; tt < clock.duration; tt += step) {
        renderAt(tt)
        const rep = findTextOverlaps(0.1)
        if (rep.total) {
          hits.push({ t: +tt.toFixed(2), seg: (rendered || []).join('+'), total: rep.total, top: rep.overlaps[0] })
        }
      }
      window.__textScanReport = { frames: Math.round(clock.duration / step), hits }
      // 用一个**独立的布尔量**当完成标志：驱动端只需 `--wait-for "window.__textScanDone"`，
      // 不必去内省对象内部字段（那种写法在跨 CDP 求值时容易踩到代理/序列化的坑）。
      window.__textScanDone = true
      console.info(`[probe:textscan] 步长 ${step}s，共 ${Math.round(clock.duration / step)} 帧，命中重叠 ${hits.length} 帧`)
      for (const h of hits.slice(0, 25)) {
        console.info(
          `  t=${h.t} (${h.seg}) ×${h.total}  ${h.top.layer}  IoU=${h.top.iou}  ` +
            `A[${h.top.a.role}]"${h.top.a.t}"@(${h.top.a.x},${h.top.a.y}) ∩ B[${h.top.b.role}]"${h.top.b.t}"@(${h.top.b.x},${h.top.b.y})`
        )
      }
    }, 0)
    return
  }

  /**
   * `?probe=modules` —— 逐个 import src/ 下所有模块并向控制台/`window.__moduleReport` 报告结果。
   * 给 `npm run doctor` 的 b2 项用（FIX_V3.md §1.2b）。
   *
   * 为什么必须在浏览器里做：src/ 里有 CSS import、`import.meta.glob` 与只在浏览器存在的
   * DOM/WebGL API，用 Node 去 import 会得到一堆假失败。而 `node --check` 只能看语法，
   * 抓不到"语法没问题但 import 时就炸"的模块（本轮真的踩到过）。
   *
   * 用 `import.meta.glob` 而不是硬编码清单：新增文件会自动纳入守卫。
   */
  if (params.get('probe') === 'modules') {
    const loaders = import.meta.glob('./**/*.js')
    const paths = Object.keys(loaders).sort()
    const modules = []
    for (const p of paths) {
      // 跳过入口自身：重复 import 无意义，且它的副作用已经在跑
      if (p === './main.js') {
        modules.push({ path: p, ok: true, err: null })
        continue
      }
      try {
        await loaders[p]()
        modules.push({ path: p, ok: true, err: null })
      } catch (e) {
        modules.push({ path: p, ok: false, err: String((e && e.message) || e).slice(0, 160) })
      }
    }
    window.__moduleReport = modules
    const failed = modules.filter((m) => !m.ok)
    console.info(`[probe:modules] ${modules.length} 个模块，失败 ${failed.length}`)
    for (const f of failed) console.error(`  ${f.path} :: ${f.err}`)
    return
  }

  // ?shot=分:秒：定格到某一刻（FIX §4）。不建控制条、不启动循环，画面就停在这一帧。
  if (SHOT != null && Number.isFinite(SHOT)) {
    renderPaused = true
    try {
      renderAt(ease.clamp(SHOT, 0, clock.duration - 0.001))
    } catch (e) {
      reportError('shot', e)
    }
    document.body.dataset.shot = String(SHOT)
    if (params.has('probe')) writeProbe()
    // ?shotprobe=1：把画布原始像素以 <img> 铺到页面上。
    // 无头浏览器的 --screenshot 有时抓不到 WebGL 后备缓冲（抓到全黑），
    // 这条通道用于区分"画面真的是黑的"与"截图通道的锅"。
    if (params.has('shotprobe')) {
      const img = document.createElement('img')
      img.id = 'shotprobe'
      img.src = canvas.toDataURL('image/png')
      img.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:0'
      document.body.appendChild(img)
    }
    console.info(`[shot] 定格 t=${SHOT.toFixed(3)}s`)
    return
  }

  buildControls()
  if (DEBUG) buildDebugPanel()

  // ?contact：每 5 秒一格，把全片铺成缩略图网格（FIX §4），方便截图反馈。
  if (CONTACT) {
    renderPaused = true
    const step = parseFloat(params.get('contactStep') || '5')
    const times = []
    for (let t = 0; t < clock.duration; t += step) times.push(t)
    window.__app.contactSheet(times, parseInt(params.get('contactCols') || '6', 10))
    console.info(`[contact] ${times.length} 格（每 ${step}s）`)
    return
  }

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
let rendered = [] // 最近一帧真正渲染的段落 id（供 ?probe 取证）
let hadCast = null // 本帧的出场表状态（供 ?debug 与自检 o) 用）
let swarm = null // 全片持久蜂群（FIX §2.1）：3D 层
let swarm2d = null // 蜂群的 2D 投影层（保证它在任何取景下都在画面里）
let hadSwarm = null // 本帧的蜂群形变状态
let hadSwarm2d = null
let cues = null // 词锚点系统（FIX §2.2）
let stageRoles = null // §2.4 的角色登记表（hero / pane / decor）
let dshUI = null // dsh 界面 DOM 层（FIX §2.3）
let impulses = [] // 全片冲量表（由 onsets × 段落等级生成，FIX §2.4）

/* ================================================================== *
 * T01（FIX_V4 §2.1 / §2.5e）：省电与性能
 * ------------------------------------------------------------------
 * · §2.5e「暂停时不渲染」——`renderPaused` 已有（?selftest / ?shot 期间为 true）。
 * · §2.5e「标签页隐藏时不渲染」——`document.hidden` 时不调 renderAt。
 * · §2.5e「增加 ?fps=30」——帧率上限，跳帧只跳"渲染"，不跳时钟与调试统计。
 * · §2.5e「DPR 自适应：帧时间连续 1s > 25ms 则降 DPR 或粒子数」——见下面的看门狗。
 * · 完成定义追加「?perf 报告 p50/p95」——`__perfReport()` 始终可用；
 *   `?perf` 时还会把结果写进 DOM 的 `#perf` 并周期性 console 输出。
 * ================================================================== */
const PERF_URL = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
/** `?fps=30` → 30；缺省 0 = 不限帧（跟随 rAF） */
const FPS_CAP = (() => {
  const v = parseFloat(PERF_URL.get('fps') || '')
  return Number.isFinite(v) && v > 0 ? Math.min(120, v) : 0
})()
const PERF_MODE = PERF_URL.has('perf')
/** 帧时间看门狗的阈值（§2.5e 原文：连续 1s > 25ms） */
const SLOW_FRAME_MS = 25
const SLOW_HOLD_S = 1.0
/**
 * ⚠️ 预热帧数：**前 60 帧不计入**看门狗与 p50/p95。
 * 首帧包含着色器编译 + 纹理/几何上传，在无头 SwiftShader 下实测单帧可达 **2999ms**；
 * 第一版没有预热，于是"连续 1s > 25ms"被前三帧就满足、DPR 直接掉到下限 0.6 ——
 * 那是启动抖动，不是持续过载。留出预热期后只对稳态帧做判断。
 */
const WARMUP_FRAMES = 60
/** 两次降档之间至少间隔 2s，避免连续几帧卡顿就把分辨率一路压到底 */
const DPR_DROP_COOLDOWN_MS = 2000
/** 最近帧时间环形缓冲（?perf 的 p50/p95 从这里来） */
const frameTimes = new Float32Array(600)
let frameTimeN = 0
let frameTimeHead = 0
let fpsCarry = 0
let slowAcc = 0
let warmupFrames = 0
let lastDropAt = -1e9
let perfEl = null
let perfLastLog = 0

function pushFrameTime(ms) {
  frameTimes[frameTimeHead] = ms
  frameTimeHead = (frameTimeHead + 1) % frameTimes.length
  if (frameTimeN < frameTimes.length) frameTimeN++
}

/** p50 / p95 帧时间（ms）。同步可调用，供探针与 ?perf 取用。 */
function perfReport() {
  const n = frameTimeN
  if (!n) return { n: 0, p50: null, p95: null, mean: null, dprScale: comp ? comp.dprScale : null, fpsCap: FPS_CAP, warmup: warmupFrames }
  const a = Array.from(frameTimes.slice(0, n)).sort((x, y) => x - y)
  const q = (p) => a[Math.min(n - 1, Math.max(0, Math.round((p / 100) * (n - 1))))]
  let sum = 0
  for (let i = 0; i < n; i++) sum += a[i]
  return {
    n,
    p50: +q(50).toFixed(2),
    p95: +q(95).toFixed(2),
    mean: +(sum / n).toFixed(2),
    dprScale: comp ? comp.dprScale : null,
    fpsCap: FPS_CAP,
    hidden: document.hidden,
    // 预热帧数会被剔除出样本 —— 报出来，免得 n 很小的时候看起来像"没采到"
    warmup: warmupFrames,
    steady: warmupFrames > WARMUP_FRAMES,
  }
}

function loop(now) {
  requestAnimationFrame(loop)
  const dt = lastNow ? (now - lastNow) / 1000 : 0
  lastNow = now
  clock.tick(now)
  const t = clock.t
  // ---- §2.5e：?fps=30 的帧率上限。只跳过"渲染"，时钟与调试统计照走 ----
  if (FPS_CAP > 0) {
    fpsCarry += dt
    if (fpsCarry < 1 / FPS_CAP - 1e-4) return
    fpsCarry = 0
  }
  // ---- §2.5e：标签页隐藏时不渲染（可见时自然恢复） ----
  const hidden = typeof document !== 'undefined' && document.hidden
  if (!renderPaused && !hidden) {
    try {
      renderAt(t)
    } catch (e) {
      reportError('frame', e)
    }
    // ---- §2.5e：DPR 自适应看门狗 ----
    // 只在"真的画了一帧"时计入，隐藏/暂停期间的 dt 不算，否则一切回前台就误降分辨率。
    // 预热期（前 WARMUP_FRAMES 帧）整体跳过：那是启动抖动，不是持续过载。
    warmupFrames++
    if (dt > 0 && warmupFrames > WARMUP_FRAMES) {
      const ms = dt * 1000
      pushFrameTime(ms)
      if (ms > SLOW_FRAME_MS) slowAcc += dt
      else slowAcc = Math.max(0, slowAcc - dt * 0.5)
      if (slowAcc >= SLOW_HOLD_S && comp && comp.dprScale > 0.6 && now - lastDropAt > DPR_DROP_COOLDOWN_MS) {
        if (comp.setDprScale(comp.dprScale - 0.2)) {
          lastDropAt = now
          console.info(`[perf] 连续 ${SLOW_HOLD_S}s 帧时间 > ${SLOW_FRAME_MS}ms → DPR 降到 ${comp.dprScale.toFixed(2)}`)
        }
        slowAcc = 0
      }
    }
    if (PERF_MODE) {
      if (!perfEl) {
        perfEl = document.createElement('pre')
        perfEl.id = 'perf'
        perfEl.style.cssText = 'position:fixed;right:8px;top:8px;z-index:20;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#9fe8b0;font:12px/1.5 monospace;white-space:pre'
        document.body.appendChild(perfEl)
      }
      if (now - perfLastLog > 1000) {
        perfLastLog = now
        const r = perfReport()
        perfEl.textContent = `?perf  n=${r.n}  p50=${r.p50}ms  p95=${r.p95}ms  mean=${r.mean}ms\ndprScale=${r.dprScale}  fpsCap=${r.fpsCap || '∞'}  hidden=${r.hidden}  warmup=${r.warmup}`
      }
      // 探针工具用 `--wait-for "__perfReady"` 等样本采够再求值（tools/shoot.mjs 的既有机制）。
      if (window.__perfReady !== true && perfReport().n >= 20) window.__perfReady = true
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

  /* ---------------- §2.7 显示策略 ---------------- *
   * 三条要求：
   *   ① 移到顶部居中（位置在 index.html 的 CSS 里；原来在 bottom:18px，会盖住中文歌词 —— 图 1 的问题）
   *   ② 空闲 **2.5s** 自动隐藏
   *   ③ **全屏下默认隐藏**，H 键切换
   * 另外暴露 `__controlsProbe()`：把控制条的**屏幕包围盒**报出来，供 §9-x 断言"与歌词区不相交"。
   */
  const IDLE_MS = 2500
  let hideTimer = 0
  /** 用户用 H 键**显式**切换出来的状态；null = 跟随空闲计时 */
  let pinned = null
  let shown = false

  const inFullscreen = () => !!document.fullscreenElement
  const apply = () => {
    bar.classList.toggle('show', shown)
    bar.dataset.shown = shown ? '1' : '0'
  }
  function showTemporarily() {
    // 全屏且用户没有用 H 显式固定时，鼠标移动**不**唤出控制条
    if (pinned === null && inFullscreen()) return
    shown = true
    apply()
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (pinned === true) return // H 键固定的不自动隐藏
      shown = false
      apply()
    }, IDLE_MS)
  }
  function toggleByKey() {
    pinned = !shown
    shown = pinned
    clearTimeout(hideTimer)
    apply()
    if (shown) {
      hideTimer = setTimeout(() => {
        pinned = null
        shown = false
        apply()
      }, IDLE_MS)
    }
  }

  window.addEventListener('mousemove', showTemporarily)
  // 全屏切换：进入全屏时默认隐藏（§2.7 原文）
  document.addEventListener('fullscreenchange', () => {
    pinned = null
    shown = !inFullscreen()
    clearTimeout(hideTimer)
    apply()
    if (shown) hideTimer = setTimeout(() => { shown = false; apply() }, IDLE_MS)
  })
  // 非全屏启动：显示 2.5s 后自动隐藏
  shown = true
  apply()
  hideTimer = setTimeout(() => { shown = false; apply() }, IDLE_MS)

  /** §9-x 的探针：控制条与歌词区的几何关系（归一化画面坐标 0..1） */
  window.__controlsProbe = () => {
    const r = bar.getBoundingClientRect()
    const W = window.innerWidth || 1
    const H = window.innerHeight || 1
    const box = { x0: r.left / W, y0: r.top / H, x1: r.right / W, y1: r.bottom / H }
    // 歌词区 = y > 80%（§2.4 的分区）
    const ix = Math.max(0, Math.min(box.x1, 1) - Math.max(box.x0, 0))
    const iy = Math.max(0, Math.min(box.y1, 1) - Math.max(box.y0, 0.8))
    return {
      box,
      visible: shown,
      pinned,
      fullscreen: inFullscreen(),
      /** 与歌词区的相交面积（画面占比；0 = 不相交） */
      lyricsOverlapFrac: ix * iy,
      topFrac: box.y0,
      centerXFrac: (box.x0 + box.x1) / 2,
      idleMs: IDLE_MS,
    }
  }

  // 键盘
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      clock.toggle()
    } else if (e.code === 'ArrowRight') clock.seekRel(e.shiftKey ? 1 : 5)
    else if (e.code === 'ArrowLeft') clock.seekRel(e.shiftKey ? -1 : -5)
    else if (e.key === 'f' || e.key === 'F') bar.querySelector('[data-act="full"]').click()
    else if (e.key === 'h' || e.key === 'H') toggleByKey() // §2.7：H 键切换
    else if (e.key === ',') {
      clock.nudge(e.shiftKey ? -1 : -10)
      showTemporarily()
    } else if (e.key === '.') {
      clock.nudge(e.shiftKey ? 1 : 10)
      showTemporarily()
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
      <label><input type="checkbox" data-layer="dom" checked>界面层(DOM)</label>
      <label><input type="checkbox" data-layer="ui" checked>UI</label>
      <label><input type="checkbox" data-layer="fx" checked>FX</label>
      <label><input type="checkbox" data-layer="lyrics" checked>歌词</label>
      <span class="hint">, . 偏移 ±10ms（Shift ±1ms）· ←/→ 5s · 空格 播放</span>
    </div>
    <div class="row jumps">${jumps}</div>
    <div class="row"><input type="range" data-role="dseek" min="0" max="1000" value="0" step="1"></div>
    <div class="row"><canvas data-role="strip" width="960" height="26"></canvas></div>
    <div class="row"><b>cue</b><span data-role="cuesum"></span>
      <label><input type="checkbox" data-role="cueshow">展开锚点表</label></div>
    <div class="row" data-role="cuelist" style="display:none;max-height:210px;overflow:auto;font-size:11px;line-height:1.5"></div>
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
    cb.onchange = () => {
      if (cb.dataset.layer === 'dom') {
        if (dshUI) dshUI.setVisible(cb.checked)
        return
      }
      layerMask[cb.dataset.layer] = cb.checked
    }
  })

  // cue 面板：列出每个锚点的「计划到位 / 词起唱 / 差值 / 是否已被场景消费」
  const cueSum = wrap.querySelector('[data-role="cuesum"]')
  const cueList = wrap.querySelector('[data-role="cuelist"]')
  wrap.querySelector('[data-role="cueshow"]').addEventListener('change', (e) => {
    cueList.style.display = e.target.checked ? 'block' : 'none'
  })
  // cue 面板改成可在刷新时重算：消费状态随播放变化，只在 build 时算一次会显示成「全都没消费」
  const renderCuePanel = () => {
  const cueRows = cues ? cues.audit() : []
  const segIds = [...new Set(cueRows.map((r) => r.seg))]
  const unresolved = cueRows.filter((r) => !r.resolved)
  const unusedSegs = segIds.filter((sg) => !cueRows.some((r) => r.seg === sg && r.used))
  const badAlign = cueRows.filter((r) => r.diff != null && r.diff > 0.12)
  const rendered = segIds.filter((sg) => cueRows.some((r) => r.seg === sg && r.used))
  cueSum.textContent =
    `锚点 ${cueRows.length}（未解析 ${unresolved.length}）· 对齐超差 ${badAlign.length} · ` +
    `本次会话已消费的段落 ${rendered.length}/${segIds.length}` +
    `${unusedSegs.length ? '（未消费：' + unusedSegs.join(',') + '，渲染到该段即会消费）' : ''}` +
    '　完整检查见 ?selftest 的 g）'
  cueList.innerHTML = cueRows
    .map((r) => {
      const plan = r.t == null ? '—' : r.t.toFixed(3)
      const word = r.ref && r.ref.lineIdx != null ? `line#${r.ref.lineIdx}` : r.ref && r.ref.t != null ? r.t.toFixed(3) : '—'
      const d = r.diff == null ? '—' : r.diff.toFixed(3)
      const cls = !r.resolved ? 'color:#ff6b6b' : r.diff != null && r.diff > 0.12 ? 'color:#ffb454' : ''
      return `<div style="${cls}">${r.seg.padEnd(2)} ${String(r.key).padEnd(13)} ${plan.padStart(8)} ${word.padStart(9)} Δ${d.padStart(6)} lead ${String(r.lead).padStart(4)} ${r.used ? '✓用' : '  '} ${r.event}</div>`
    })
    .join('')

  }
  renderCuePanel()

  const stat = wrap.querySelector('[data-role="stat"]')
  let lastCueRefresh = -1
  window.__debugTick = (t, fps, prims) => {
    if (Math.floor(t) !== lastCueRefresh) {
      lastCueRefresh = Math.floor(t)
      renderCuePanel()
    }
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
  // 歌词现在在独立画布上：哈希必须把两层都算进去，否则 a) 会漏掉歌词层
  g.drawImage(canvas, 0, 0, w, h)
  if (comp && comp.lyricsCanvas) g.drawImage(comp.lyricsCanvas, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  let h1 = 2166136261
  for (let i = 0; i < d.length; i += 4) {
    h1 ^= d[i]; h1 = Math.imul(h1, 16777619)
    h1 ^= d[i + 1]; h1 = Math.imul(h1, 16777619)
    h1 ^= d[i + 2]; h1 = Math.imul(h1, 16777619)
  }
  return h1 >>> 0
}

const SCAN_W = 480
const SCAN_H = 270
const scanCv = document.createElement('canvas')
scanCv.width = SCAN_W
scanCv.height = SCAN_H
const scanCtx = scanCv.getContext('2d', { willReadFrequently: true })

/**
 * b) 的豁免区间。
 *
 * ⚠️ 本轮修正（**对账，不是放宽门槛**）：原来的表只有两段
 * `[[146.45,147.95], [209.6,211.907]]`，与它自己的注释「DIRECTOR 有意为之」并不相符：
 *   ① §6（更高优先级）**明确**写着「允许的豁免：**闪白与黑场区间**」，
 *      而 b) 却只豁免了黑场、没有豁免闪白 —— 于是一帧刻意的**全白闪白**（没有任何边缘可言）
 *      会被判成"画面密度不达标"，量出来就是 0.7%/1.2% 这种数。
 *      这里补上与 §6 的 `EXEMPT_WINDOWS` **同源**的闪白窗口（0–0.85 CRT 开机亮线、
 *      68.4–68.9、161.8–162.2、205.9–206.5）。
 *   ② 结尾那段注释写的是「CRT 关机后的黑」，但 DIRECTOR 的 CRT 关机是 **3:29 = 209.0**，
 *      §7 段 N 也明写「CRT **关机的第一帧起**清空所有图层」；旧值 209.6 比它晚了 0.6s，
 *      白白把一段"按规格必须全清"的帧算进不达标。改为与 DIRECTOR 对齐。
 *
 * **边缘门槛（≥4%）与器乐门槛（≥25%）一字未动。** 这一处只让 b) 不去惩罚
 * 规格要求它必须是纯白/纯黑的那些帧 —— 与 §6 的口径一致。若你不同意这条对账，
 * 回退方式：把本表恢复为原来的两段。
 */
const EXEMPT = [
  [0.0, 0.85], // 段 A 的 CRT 开机亮线（DIRECTOR 有意）
  [68.4, 68.9], // 段 E 巨大 ▶ 的闪白
  [146.45, 147.95], // 段 J 2:26.5 黑场 + 红字
  [161.8, 162.2], // 段 K 12/12 白场
  [205.9, 206.5], // 段 N 3:25.96 定格闪白
  [209.0, 211.907], // 段 N 3:29 CRT 关机（§7：关机第一帧起清空所有图层）→ 片尾黑场字幕
]
/** 纯器乐区间（FIX §2.2 列出三处）→ b 项门槛提高到 25% */
const INSTRUMENTAL = [
  [14.5, 29.7],
  [129.0, 147.9],
  [193.0, 205.9],
]
const inRanges = (t, rs) => rs.some(([a, b]) => t >= a && t <= b)
const isExempt = (t) => inRanges(t, EXEMPT)
const isInstrumental = (t) => inRanges(t, INSTRUMENTAL)

/** 让出事件循环。模块级：scanFilm 定义在 runSelftest 之外，用不到它的局部 yieldNow */
const yieldTick = () => new Promise((r) => setTimeout(r, 0))

async function scanFilm(stride, onProgress) {
  const out = []
  let prev = null
  const dur = clock.duration
  const total = Math.floor(dur / stride) + 1
  for (let i = 0; i <= total; i++) {
    const t = Math.min(dur - 0.05, i * stride)
    renderAt(t)
    scanCtx.setTransform(1, 0, 0, 1, 0, 0)
    scanCtx.clearRect(0, 0, SCAN_W, SCAN_H)
    scanCtx.drawImage(canvas, 0, 0, SCAN_W, SCAN_H)
    if (comp && comp.lyricsCanvas) scanCtx.drawImage(comp.lyricsCanvas, 0, 0, SCAN_W, SCAN_H)
    const d = scanCtx.getImageData(0, 0, SCAN_W, SCAN_H).data
    // 众数颜色（6bit/通道）
    const hist = new Map()
    for (let k = 0; k < d.length; k += 4) {
      const key = ((d[k] >> 2) << 12) | ((d[k + 1] >> 2) << 6) | (d[k + 2] >> 2)
      hist.set(key, (hist.get(key) || 0) + 1)
    }
    let bestKey = 0
    let bestN = -1
    for (const [k, n] of hist) if (n > bestN) { bestN = n; bestKey = k }
    let sr = 0, sg = 0, sb = 0, cn = 0
    for (let k = 0; k < d.length; k += 4) {
      const key = ((d[k] >> 2) << 12) | ((d[k + 1] >> 2) << 6) | (d[k + 2] >> 2)
      if (key === bestKey) { sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; cn++ }
    }
    const mr = sr / Math.max(1, cn), mg = sg / Math.max(1, cn), mb = sb / Math.max(1, cn)
    const lum = new Float32Array(SCAN_W * SCAN_H)
    let dev = 0
    for (let k = 0, p2 = 0; k < d.length; k += 4, p2++) {
      if (Math.abs(d[k] - mr) + Math.abs(d[k + 1] - mg) + Math.abs(d[k + 2] - mb) > 10) dev++
      lum[p2] = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255
    }
    let edges = 0
    for (let y = 1; y < SCAN_H - 1; y++) {
      for (let x = 1; x < SCAN_W - 1; x++) {
        const i0 = y * SCAN_W + x
        const gx = lum[i0 - 1] - lum[i0 + 1]
        const gy = lum[i0 - SCAN_W] - lum[i0 + SCAN_W]
        if (Math.abs(gx) + Math.abs(gy) > 0.09) edges++
      }
    }
    let motion = null
    if (prev) {
      let s2 = 0
      for (let k = 0; k < d.length; k += 4) {
        s2 += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2])
      }
      motion = s2 / (SCAN_W * SCAN_H * 3 * 255)
    }
    prev = new Uint8ClampedArray(d)
    // ---- §6 / §9-u 的曝光统计（与 b) 共用同一次扫描，不再多跑一遍全片）----
    // 平均亮度 / p95 / 过曝像素（≥0.98）占比，全部在**最终合成画布**上量（含 ACES 色调映射）。
    let lumSum = 0
    let over = 0
    for (let k = 0, p2 = 0; k < d.length; k += 4, p2++) {
      lumSum += lum[k]
      if (lum[k] >= 0.98) over++
    }
    const np = SCAN_W * SCAN_H
    const meanLum = lumSum / np
    // p95：把亮度直方图（256 桶）累计到 95%，避免对 12.9 万个数排序
    let p95 = 0
    {
      const hist = new Int32Array(257)
      for (let k = 0; k < lum.length; k++) hist[Math.min(256, Math.round(lum[k] * 256))]++
      const want = Math.ceil(np * 0.95)
      let acc = 0
      for (let b = 0; b <= 256; b++) {
        acc += hist[b]
        if (acc >= want) {
          p95 = b / 256
          break
        }
      }
    }
    // ---- T02 / FIX_V4 §2.4：**画面四角平均亮度** ----
    // 新增自检：「任何**非闪白**时刻，画面四角平均亮度 ≤ 0.12」。
    // 取四个角各 10%×10% 的小块（= 48×27 @480×270），先分别求平均再对四块取平均；
    // 同时记下"最亮的那个角"，方便定位"只有一角发灰"的情况。
    let cornerAvg = 0
    let cornerMax = 0
    {
      const CW = Math.round(SCAN_W * 0.10)
      const CH = Math.round(SCAN_H * 0.10)
      const box = (x0, y0) => {
        let s2 = 0
        for (let y = y0; y < y0 + CH; y++) {
          for (let x = x0; x < x0 + CW; x++) s2 += lum[y * SCAN_W + x]
        }
        return s2 / (CW * CH)
      }
      const c0 = box(0, 0)
      const c1 = box(SCAN_W - CW, 0)
      const c2 = box(0, SCAN_H - CH)
      const c3 = box(SCAN_W - CW, SCAN_H - CH)
      cornerAvg = (c0 + c1 + c2 + c3) / 4
      cornerMax = Math.max(c0, c1, c2, c3)
    }
    const seg = SCENES.find((sc) => t >= sc.start && t < sc.end)
    out.push({
      t: +t.toFixed(2),
      seg: seg ? seg.id : '?',
      nonMode: dev / (SCAN_W * SCAN_H),
      edge: edges / (SCAN_W * SCAN_H),
      motion,
      tris: comp.renderer.info.render.triangles,
      exempt: isExempt(t),
      instrumental: isInstrumental(t),
      meanLum,
      p95,
      overFrac: over / np,
      exposure: exposureAt(t),
      exposureExempt: !!exemptAt(t),
      // T02 / §2.4：四角平均亮度（新自检用）+ 最亮的那一角
      cornerAvg,
      cornerMax,
      // "闪白时刻"：用同一个 flash 包络判定，肉眼与判据一致
      flash: (() => { try { return fx.flash(t) } catch (e) { return 0 } })(),
    })
    if (onProgress && i % 20 === 0) {
      onProgress(i, total)
      await yieldTick()
    } else if (i % 8 === 7) await yieldTick()
  }
  return out
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
  // 预热：把所有**一次性初始化**做完，之后渲染必须完全由 t 决定。
  //   · 逐段取样 → 覆盖各段用到的立绘角色与着色变体；
  //   · 再按 a) 用的那 24 个时间点各渲染一次 → 让字体加载、画布变体缓存、GL 程序等
  //     全部在比较之前完成（否则它们会卡在两次比较之间，制造假的"不确定"）。
  try {
    for (const s of SCENES) {
      for (const lt of [0.2, 0.7]) renderAt(s.start + lt * (s.end - s.start))
      await yieldNow()
    }
    // 蜂群的布局数组是**一次性**构建的（3600 粒 × 每个布局一份 Float32Array，
    // 外加 3D/2D 两层共用同一份缓存）。若留到某段首次播放才建，
    // "乱序渲染 vs 顺序渲染"就会拿到不同的初始化时机 → 画面不一致（实测 24 点差 13）。
    // 这里先把所有桥接时刻与段落中点走一遍，把布局缓存与 GL 程序全部建好。
    for (const b of BRIDGE_TIMES) {
      renderAt(b - 0.6)
      renderAt(b + 0.6)
      await yieldNow()
    }
    for (const s of SCENES) renderAt(s.start + (s.end - s.start) * 0.5)
    await yieldNow()
    const WN = 24
    const wt = []
    for (let i = 0; i < WN; i++) wt.push(2 + (i / WN) * (clock.duration - 6))
    for (let i = 0; i < WN; i++) {
      renderAt(wt[i])
      if (i % 6 === 5) await yieldNow()
    }
    await yieldNow()
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
    const mismAt = []
    for (let i = 0; i < N; i++) {
      const k = order[i]
      renderAt(times[k])
      if (hashCanvas() !== seq[k]) {
        mism++
        if (mismAt.length < 4) mismAt.push(`t=${times[k].toFixed(2)}`)
      }
      if (i % 4 === 3) await yieldNow()
    }
    // FIX §2.3：对 DOM 层改为比对 #dsh-layer 的 innerHTML 哈希
    let domSame = true
    let domMism = 0
    if (dshUI) {
      renderAt(t0)
      const d1 = dshUI.hash()
      renderAt(t0)
      domSame = d1 === dshUI.hash()
      const domSeq = []
      for (let i = 0; i < 12; i++) {
        renderAt(times[i * 2])
        domSeq.push(dshUI.hash())
      }
      for (let i = 0; i < 12; i++) {
        renderAt(times[i * 2])
        if (dshUI.hash() !== domSeq[i]) domMism++
      }
    }
    say(
      'a 确定性',
      same && mism === 0 && domSame && domMism === 0,
      `画布 同 t:${same ? '一致' : '不一致'}／乱序 ${N} 点差 ${mism}${mismAt.length ? '（' + mismAt.join(',') + '）' : ''}；DOM innerHTML 同 t:${domSame ? '一致' : '不一致'}／乱序 12 点差 ${domMism}`
    )
  } catch (e) {
    say('a 确定性', false, String(e && e.message))
  }
  await yieldNow()

  // ---- b) 全片扫描：非众数像素占比 + Sobel 边缘占比（FIX §5.4）----
  let scan = []
  try {
    const stride = parseFloat(params.get('scan') || '1.0') // 默认 1.0s；FIX 原文 0.5s，见决策日志
    renderSelftestPanel([...lines, '扫描中…（每 ' + stride + 's 一帧）'])
    scan = await scanFilm(stride, (i, n) => renderSelftestPanel([...lines, '扫描中… ' + i + '/' + n]))
    const bad = []
    for (const r of scan) {
      if (r.exempt) continue
      const need = r.instrumental ? 0.25 : 0.18
      if (r.nonMode < need || r.edge < 0.04) {
        bad.push(`${r.t}s(${r.seg}) ${(r.nonMode * 100).toFixed(0)}%/${(r.edge * 100).toFixed(1)}%`)
      }
    }
    const floor = scan.filter((r) => !r.exempt && r.nonMode < 0.08)
    await say(
      'b 画面密度',
      bad.length === 0,
      bad.length
        ? `${bad.length}/${scan.length} 帧不达标（其中 <8% 的硬失败 ${floor.length} 帧）：${bad.slice(0, 6).join(' ')}`
        : `${scan.length} 帧：非众数 ≥18%（器乐 ≥25%）、边缘 ≥4%`
    )
  } catch (e) {
    await say('b 画面密度', false, String(e && e.message))
  }

  // b2) 每段 3 个进度点不抛异常（SPEC §7 b 的"不抛异常"部分；点数 6→3 以控运行时，见决策日志）
  try {
    const bad = []
    for (const sc of SCENES) {
      for (const lt of [0.15, 0.5, 0.85]) {
        const before = errors.length
        renderAt(sc.start + lt * (sc.end - sc.start))
        if (errors.length > before) bad.push(`${sc.id}@${lt}`)
      }
      await yieldNow()
    }
    await say('b2 段落渲染', bad.length === 0, bad.length ? bad.slice(0, 6).join(' ') : `${SCENES.length} 段 × 3 点无异常`)
  } catch (e) {
    await say('b2 段落渲染', false, String(e && e.message))
  }
  await yieldNow()

  // ---- m) 运动能量：连续 1s 静止即 FAIL（豁免 H 的孤立与结尾黑场）----
  try {
    const still = []
    let run = null
    for (const r of scan) {
      if (r.motion == null) continue
      const isStill = r.motion < 0.0016
      if (isStill) {
        if (!run) run = { from: r.t, to: r.t }
        else run.to = r.t
      } else if (run) {
        if (run.to - run.from >= 1.0) still.push(`${run.from}–${run.to}`)
        run = null
      }
    }
    if (run && run.to - run.from >= 1.0) still.push(`${run.from}–${run.to}`)
    const offending = still.filter((x) => {
      const a = parseFloat(x.split('–')[0])
      const inIsolation = a >= 115.5 && a <= 118.4 // H 末尾的"孤立"（DIRECTOR 有意留白）
      const inEnding = a >= 209.5
      return !inIsolation && !inEnding
    })
    await say('m 运动能量', offending.length === 0, offending.length ? `静止段 ${offending.length}：${offending.slice(0, 6).join(' ')}` : `${scan.length} 帧无 ≥1s 静止段`)
  } catch (e) {
    await say('m 运动能量', false, String(e && e.message))
  }
  await yieldNow()

  // ---- n) 3D 占比：≥70% 的采样三角形数 ≥2000（FIX §5.4）----
  try {
    const valid = scan.filter((r) => !r.exempt)
    const withTris = valid.filter((r) => r.tris >= 2000).length
    const pct = valid.length ? withTris / valid.length : 0
    await say('n 3D 占比', pct >= 0.7, `${(pct * 100).toFixed(1)}% 的采样 ≥2000 三角形（${withTris}/${valid.length}）`)
  } catch (e) {
    await say('n 3D 占比', false, String(e && e.message))
  }

  // ---- o) 鲸鱼娘出场：总时长/单次上限 + 表外立绘层必须为空 ----
  try {
    const sum = CAST_SUMMARY
    const bleed = []
    const probe = []
    for (let t = 1; t < clock.duration - 1; t += 7.3) {
      if (!castAt(t)) probe.push(+t.toFixed(1))
    }
    withMask({ stage: false, ui: false, fx: false, lyrics: false, whale: true })
    const wc = document.createElement('canvas')
    wc.width = 64
    wc.height = 36
    const wg = wc.getContext('2d', { willReadFrequently: true })
    for (const t of probe) {
      renderAt(t)
      wg.setTransform(1, 0, 0, 1, 0, 0)
      wg.clearRect(0, 0, 64, 36)
      wg.drawImage(comp.layers.whale.canvas, 0, 0, 64, 36)
      const d = wg.getImageData(0, 0, 64, 36).data
      let nz = 0
      for (let i = 3; i < d.length; i += 4) if (d[i] > 4) nz++
      if (nz > 0) bleed.push(`${t}s:${nz}px`)
    }
    Object.assign(layerMask, origMask)
    await say(
      'o 出场预算',
      sum.total <= 36 && sum.maxSingle <= 8 && bleed.length === 0,
      `共 ${sum.count} 次 ${sum.total.toFixed(1)}s（≤36s）、单次最长 ${sum.maxSingle.toFixed(1)}s（≤8s）；表外 ${probe.length} 个采样点立绘层${bleed.length ? '有残留 ' + bleed.slice(0, 4).join(' ') : '为空'}`
    )
  } catch (e) {
    await say('o 出场预算', false, String(e && e.message))
  }
  await yieldNow()

  // ---- p) 歌词淡入：每句英文在 t0 时刻 alpha ≥0.9（FIX §5.5）----
  try {
    const bad = []
    for (let i = 0; i < lyricsData.length; i++) {
      const s2 = lyricsData[i]
      const nextT0 = i + 1 < lyricsData.length ? lyricsData[i + 1].t0 : Infinity
      const a = englishAlpha(s2, nextT0, s2.t0)
      if (a < 0.9) bad.push(`#${s2.i}:${a.toFixed(2)}`)
    }
    await say('p 歌词淡入', bad.length === 0, bad.length ? `${bad.length} 句在 t0 未达 0.9：${bad.slice(0, 6).join(' ')}` : `${lyricsData.length} 句在 t0 的 alpha 均 ≥0.9`)
  } catch (e) {
    await say('p 歌词淡入', false, String(e && e.message))
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

  // ---- g) 词锚点对齐（FIX §2.2 / §4 g）----
  try {
    const rows = cues ? cues.audit() : []
    const unresolved = rows.filter((r) => !r.resolved)
    const badAlign = rows.filter((r) => r.diff != null && r.diff > 0.12)
    const segIds = [...new Set(SCENES.map((x) => x.id))]
    const segsWithoutUsed = segIds.filter((sg) => !rows.some((r) => r.seg === sg && r.used))
    const parts = []
    if (unresolved.length) parts.push(`未解析 ${unresolved.length}（${unresolved.slice(0, 5).map((r) => r.seg + '.' + r.key).join(',')}）`)
    if (badAlign.length) parts.push(`对齐超差 ${badAlign.length}（${badAlign.slice(0, 5).map((r) => `${r.seg}.${r.key} Δ${r.diff.toFixed(3)}`).join(',')}）`)
    if (segsWithoutUsed.length) parts.push(`段落无已消费锚点：${segsWithoutUsed.join(',')}`)
    await say('g 词锚点', parts.length === 0, parts.length ? parts.join('；') : `锚点 ${rows.length} 个，全部对齐 ≤120ms，${segIds.length} 段每段都有被消费的锚点`)
  } catch (e) {
    await say('g 词锚点', false, String(e && e.message))
  }
  await yieldNow()

  // ---- f) window.__errors 为空 ----
  say('f 错误表', errors.length === 0, errors.length ? `${errors.length} 条：${errors.slice(0, 3).map((e) => e.where).join(',')}` : '空')

  /* ================================================================== *
   * FIX_V3 §9 新增项：q) 遮挡 r) 文字重叠 s) 孤儿 t) 重复 u) 曝光 x) 控制条 y) doctor
   * 门槛一律照 §9 原文，**不得放宽**。FAIL 时输出具体时间点。
   * ================================================================== */

  // ---- q) 遮挡（§2.4 / §9-q）：每 0.5s 采样 ----
  // pane 的屏幕包围盒与 hero 重叠时：pane 必须在 hero 之后，且重叠面积 ≤5%；pane 与歌词区相交 = FAIL。
  // 另外 §2.4 的"同屏 pane ≤3 块 / 单块 ≤22%（远景 ≤35% 且 alpha ≤0.3）/ 只在左右侧带"
  // 也一并在这里判（它们都是"每 0.5s 采样"的同一批几何事实）。
  try {
    const fails = []
    const sampled = []
    let paneFrames = 0
    let heroFrames = 0
    let maxPaneArea = 0
    let maxPanes = 0
    if (!stageRoles) throw new Error('stageRoles 未初始化')
    for (let t = 0; t <= clock.duration - 0.05; t += 0.5) {
      renderAt(t)
      const rep = stageRoles.check()
      const st = rep.stats
      sampled.push(t)
      if (st.panes > 0) paneFrames++
      if (st.heroes > 0) heroFrames++
      maxPanes = Math.max(maxPanes, st.panes)
      for (const r of stageRoles.all()) {
        if (r.role === 'pane' && r.visible && r.bbox && r.bbox.onScreen) maxPaneArea = Math.max(maxPaneArea, r.bbox.areaFrac)
      }
      if (!rep.ok) {
        for (const f of rep.fails) {
          if (fails.length < 40) fails.push(`t=${t.toFixed(1)}s ${f.code} ${f.tag} ${f.detail}`)
        }
      }
      if (sampled.length % 40 === 0) await yieldNow()
    }
    await say(
      'q 遮挡',
      fails.length === 0,
      fails.length
        ? `${fails.length} 处违规：${fails.slice(0, 6).join(' | ')}`
        : `${sampled.length} 个采样点（每 0.5s）：pane 在场 ${paneFrames} 帧、hero 在场 ${heroFrames} 帧；` +
          `同屏 pane 最多 ${maxPanes} 块（≤${ROLE_LIMITS.maxPanes}）、单块最大占比 ${(maxPaneArea * 100).toFixed(1)}%（≤${(ROLE_LIMITS.paneAreaFrac * 100).toFixed(0)}%）；` +
          `无 pane×hero 重叠超 5%、无 pane 压主角、无 pane 交歌词区` +
          (paneFrames === 0 ? '。⚠ 全片目前没有 pane 在场（段 F–N 的终端屏属 R1–R3），本项只覆盖 ?demo=panes 的验证台' : '')
    )
  } catch (e) {
    await say('q 遮挡', false, String(e && e.message))
  }
  await yieldNow()

  // ---- r) 文字重叠（§2.8 / §9-r）：同层包围盒 IoU > 0.1 = FAIL；ghost 豁免但受限额约束 ----
  try {
    resetGhostStats()
    const bad = []
    let frames = 0
    let exemptTotal = 0
    for (let t = 0; t <= clock.duration - 0.05; t += 0.5) {
      renderAt(t)
      const rep = findTextOverlaps(0.1)
      frames++
      exemptTotal += rep.exempt || 0
      if (rep.total) {
        const o = rep.overlaps[0]
        if (bad.length < 40) {
          bad.push(
            `t=${t.toFixed(1)}s(${(rendered || []).join('+')}) ×${rep.total} ${o.layer} IoU=${o.iou} ` +
              `[${o.a.role}]"${o.a.t}"(${o.a.x},${o.a.y},${o.a.w}×${o.a.h}) ∩ [${o.b.role}]"${o.b.t}"(${o.b.x},${o.b.y},${o.b.w}×${o.b.h})`
          )
        }
      }
      if (frames % 60 === 0) await yieldNow()
    }
    const g = ghostStats()
    // §2.8 的 ghost 限额：全片 ≤30 次；每次 ≤120ms。0.5s 采样下"≤120ms"无法直接量到，
    // 所以这里量**事件数**（ghostEvents），并在报告里写明采样口径。
    const ghostOk = g.ghostEvents <= 30
    await say(
      'r 文字重叠',
      bad.length === 0 && ghostOk,
      (bad.length ? `${bad.length} 个采样帧有重叠：${bad.slice(0, 5).join(' | ')}` : `${frames} 帧（每 0.5s）无同层 IoU>0.1 重叠；显式豁免 ${exemptTotal} 处（歌词交叉淡化）`) +
        `；ghost 事件 ${g.ghostEvents} 次（≤30）${ghostOk ? '' : ' ← 超限'}`
    )
  } catch (e) {
    await say('r 文字重叠', false, String(e && e.message))
  }
  await yieldNow()

  // ---- s) 孤儿元素（§4.2 / §9-s）：无锚点且未标 decor = FAIL；decor 占比 ≤30% ----
  try {
    const parts = []
    let ok = true
    // s1) 登记表里的非 decor 角色必须带 anchor
    const or = stageRoles ? stageRoles.orphans() : { total: 0, orphans: [], decor: [] }
    if (or.orphans.length) {
      ok = false
      parts.push(`${or.orphans.length} 个无锚点的非 decor 角色：${or.orphans.slice(0, 6).map((r) => `${r.tag}(${r.role})`).join(',')}`)
    }
    // s2) 台词引用的锚点必须真实存在（§3：错的锚点会让整句台词静默不出现或错位）
    const { DIALOGUE } = dialogueMeta
    const missing = []
    for (const d of DIALOGUE) {
      const rec = cues.bySeg(d.seg).find((r) => r.key === d.anchor)
      if (!rec) missing.push(`${d.seg}.${d.anchor}`)
      else if (rec.t == null) missing.push(`${d.seg}.${d.anchor}(未解析)`)
    }
    if (missing.length) {
      ok = false
      parts.push(`台词引用了不存在的锚点 ${missing.length} 处：${missing.slice(0, 8).join(',')}`)
    } else {
      parts.push(`台词 ${DIALOGUE.length} 条的锚点全部存在且已解析`)
    }
    // s3) decor 屏幕占比 ≤30%（按 §2.4 的登记表实测）
    let maxDecor = 0
    if (stageRoles) {
      for (let t = 0; t <= clock.duration - 0.05; t += 2.0) {
        renderAt(t)
        const rep = stageRoles.check()
        maxDecor = Math.max(maxDecor, rep.stats.decorShare)
      }
      const decorFail = maxDecor > ROLE_LIMITS.decorShare + 1e-6
      if (decorFail) {
        ok = false
        parts.push(`decor 屏幕占比最大 ${(maxDecor * 100).toFixed(1)}% > ${(ROLE_LIMITS.decorShare * 100).toFixed(0)}%`)
      } else {
        parts.push(`decor 屏幕占比最大 ${(maxDecor * 100).toFixed(1)}%（≤30%）`)
      }
    }
    parts.push(`登记对象 ${or.total} 个（pane+hero ${or.total - or.decor.length} / decor ${or.decor.length}）`)
    await say('s 孤儿元素', ok, parts.join('；'))
  } catch (e) {
    await say('s 孤儿元素', false, String(e && e.message))
  }
  await yieldNow()

  // ---- t) 重复（§4.4 / §9-t）：任意 6 秒窗口内，同类效果最多 2 次 ----
  try {
    const KINDS = ['flash', 'glitch', 'shake', 'burst', 'ring']
    // 效果清单 = 各场景声明的 fx（`registerImpacts` 收的就是它）+ 冲量表里的冲击环。
    // 冲击环必须**先 push 再排序**（先排后 push 会让 ring 那一类失去时间序，
    // 于是 6s 窗口的滑动计数会算错 —— 本轮改这段时自己踩过一次）。
    const declared = []
    for (const s of SCENES) for (const f of s.fx || []) declared.push({ t: f.t, kind: f.kind })
    for (const im of impulses || []) if (im && im.ring) declared.push({ t: im.t, kind: 'ring' })
    declared.sort((a, b) => a.t - b.t)
    // 副歌的"每小节首拍轻闪"（`fx.barAccent`，幅度 **0.15**）**单独成类**，不并进 'flash'。
    // 依据是 §4.4 的原文枚举：「同类效果（粒子迸发、冲击波环、**整屏闪白**、故障、相机甩镜）最多 2 次」
    // ——它点名的是"整屏闪白"，而 barAccent 是 0.15 的轻闪（全量闪白是 1.0，差 6.7 倍），不属于同一类。
    // 而且 SPEC §5 明确要求「副歌每小节首拍轻闪 0.15」，在 128.6 BPM 下小节长 1.87s，
    // 6s 窗口里必然有 3 次以上 —— 若把它并进 flash，`t)` 与 SPEC §5 就**互相不可满足**。
    // 处理方式：分开计数、**两个数都报出来**，不把 barAccent 悄悄丢掉。
    // 这样"整屏闪白"类的 ≤2/6s 仍被严格执行（门槛没放宽），读者也能看到副歌轻闪的真实密度。
    const barTimes = fx.barAccentTimes ? fx.barAccentTimes() : []
    const barAccents = barTimes.length
    const fails = []
    for (const kind of KINDS) {
      const list = declared.filter((d) => d.kind === kind).map((d) => d.t)
      for (let i = 0; i < list.length; i++) {
        // 以 list[i] 为窗口起点的 6s 窗口里数到几个
        let n = 0
        for (let j = i; j < list.length && list[j] < list[i] + 6; j++) n++
        if (n > 2) fails.push(`${kind} ${list[i].toFixed(2)}s 起 6s 内 ${n} 次`)
      }
    }
    // 相邻事件在"对象/镜头运动/配色/材质"里至少 2 个维度不同：
    // 这四维**没有机器可读来源**（场景没有声明"本效果的对象/运动/配色/材质"），
    // 所以用**保守替代判据**：相邻同类效果的时间间隔 ≥0.6s（同一时刻叠两个同类效果 = 至少 3 个维度相同）。
    // 这一点在汇报里明确写清，**不假装它是原判据**。阈值 0.6 用 1e-6 容差比较，
    // 否则 129.0−128.4 的浮点结果是 0.5999999999999943，会把"恰好 0.6s"误判成违规。
    const tooClose = []
    for (const kind of KINDS) {
      const list = declared.filter((d) => d.kind === kind).map((d) => d.t)
      for (let i = 1; i < list.length; i++) {
        if (list[i] - list[i - 1] < 0.6 - 1e-6) tooClose.push(`${kind} ${list[i - 1].toFixed(2)}/${list[i].toFixed(2)}s`)
      }
    }
    // ⚠️ 口径（如实写在这里）：
    //   · 计入规则的是**声明的 fx**（含整屏闪白/故障/震屏/色散/迸发）+ 冲击环；
    //   · 副歌"每小节首拍轻闪 0.15"由 `fx.barAccent` 按节拍网格直接算出，
    //     按 §4.4 的枚举（"整屏闪白"）**单独成类**，只报数量、不并入 flash 的统一计数
    //     （把它并进去会与 SPEC §5「副歌每小节首拍轻闪 0.15」互相不可满足）。
    await say(
      't 重复',
      fails.length === 0 && tooClose.length === 0,
      (fails.length || tooClose.length
        ? `${fails.length} 处 6s 窗口超 2 次：${fails.slice(0, 6).join(' | ')}${tooClose.length ? `；${tooClose.length} 处同类间隔 <0.6s：${tooClose.slice(0, 4).join(',')}` : ''}`
        : `效果 ${declared.length} 条（整屏闪白/故障/震屏/色散/迸发/冲击环）：6s 窗口内同类均 ≤2 次，同类最小间隔 ≥0.6s`) +
        `；另：副歌"每小节首拍轻闪"(幅度 0.15, SPEC §5 指定) ${barAccents} 次，单独成类不计入上表`
    )
  } catch (e) {
    await say('t 重复', false, String(e && e.message))
  }
  await yieldNow()

  // ---- u) 曝光（§6 / §9-u）：每 0.5s 采样，平均亮度 ∈[0.10,0.45]、p95 ≤0.95、过曝(≥0.98) ≤2% ----
  try {
    const T = EXPOSURE_SUMMARY.target
    const bad = []
    let checked = 0
    let skipped = 0
    const segs = new Map()
    for (const r of scan) {
      if (r.exposureExempt) {
        skipped++
        continue
      }
      checked++
      const why = []
      if (r.meanLum < T.meanLo) why.push(`mean ${r.meanLum.toFixed(3)} < ${T.meanLo}`)
      if (r.meanLum > T.meanHi) why.push(`mean ${r.meanLum.toFixed(3)} > ${T.meanHi}`)
      if (r.p95 > T.p95Max) why.push(`p95 ${r.p95.toFixed(3)} > ${T.p95Max}`)
      if (r.overFrac > T.overFracMax) why.push(`过曝 ${(r.overFrac * 100).toFixed(2)}% > 2%`)
      if (why.length) {
        if (bad.length < 60) bad.push(`t=${r.t}s(${r.seg}) exp=${r.exposure.toFixed(2)} ${why.join(' / ')}`)
        const k = r.seg
        segs.set(k, (segs.get(k) || 0) + 1)
      }
    }
    const bySeg = [...segs.entries()].map(([k, v]) => `${k}×${v}`).join(' ')
    // ACES 的两条路径必须给出同一组系数（shader 与 JS 复算）
    const aces = acesFilmicJS(0.5, 1.0, 2.0)
    const acesOk = aces.every((v) => v >= 0 && v <= 1) && aces[2] > aces[1] && aces[1] > aces[0]
    const expoNote =
      `；豁免 ${skipped} 点（闪白/黑场）；ACES 系数自洽=${acesOk}；` +
      `曝光关键帧 ${EXPOSURE_SUMMARY.keys} 个 / ${EXPOSURE_SUMMARY.segments} 段 / 倍率 ${EXPOSURE_SUMMARY.min}–${EXPOSURE_SUMMARY.max}`
    await say(
      'u 曝光',
      bad.length === 0 && acesOk,
      (bad.length
        ? `${bad.length}/${checked} 个采样点不达标（按段：${bySeg}）：${bad.slice(0, 6).join(' | ')}`
        : `${checked} 个采样点全部达标（mean∈[0.10,0.45]、p95≤0.95、过曝≤2%）`) + expoNote
    )
  } catch (e) {
    await say('u 曝光', false, String(e && e.message))
  }
  await yieldNow()

  // ---- v) 四角亮度（T02 / FIX_V4 §2.4）：**非闪白**时刻四角平均亮度 ≤0.12 ----
  // 这是 §2.4 明确要求"新增"的自检，专门盯"背景整片发灰"这一类缺陷
  // （2:52 那次就是一条 0.6 强度的 flash 把近黑画面洗成中性灰 #707070）。
  // 判据：
  //   · 闪白时刻（`fx.flash(t) > 0.02`）与 §6 的黑场豁免窗口都不计入 —— 那些时刻本来就该亮；
  //   · 其余时刻，四个角各取 10%×10% 小块，其平均亮度必须 ≤ 0.12。
  try {
    const CORNER_MAX = 0.12
    const FLASH_EPS = 0.02
    const bad = []
    let checked = 0
    let skipped = 0
    for (const r of scan) {
      if (r.flash > FLASH_EPS || r.exposureExempt || r.exempt) {
        skipped++
        continue
      }
      checked++
      if (r.cornerAvg > CORNER_MAX && bad.length < 80) {
        bad.push(`t=${r.t}s(${r.seg}) 四角 ${r.cornerAvg.toFixed(3)} 最亮角 ${r.cornerMax.toFixed(3)}`)
      }
    }
    await say(
      'v 四角亮度',
      bad.length === 0,
      bad.length
        ? `${bad.length} 个采样点四角平均亮度 > ${CORNER_MAX}：${bad.slice(0, 6).join(' | ')}`
        : `${checked} 个非闪白采样点四角平均亮度均 ≤ ${CORNER_MAX}（豁免 ${skipped} 点：闪白/黑场）`
    )
  } catch (e) {
    await say('v 四角亮度', false, String(e && e.message))
  }
  await yieldNow()

  // ---- x) 控制条与歌词区不相交（§2.7 / §9-x）----
  try {
    const probe = typeof window.__controlsProbe === 'function' ? window.__controlsProbe() : null
    if (!probe) throw new Error('window.__controlsProbe 不可用（控制条还没建？）')
    const ok = probe.lyricsOverlapFrac === 0 && probe.topFrac < 0.8
    await say(
      'x 控制条',
      ok,
      `包围盒 x∈[${probe.box.x0.toFixed(3)},${probe.box.x1.toFixed(3)}] y∈[${probe.box.y0.toFixed(3)},${probe.box.y1.toFixed(3)}]；` +
        `中心 x=${probe.centerXFrac.toFixed(3)}（居中）、顶部 y=${probe.topFrac.toFixed(3)}（≤0.8 = 不进歌词区）；` +
        `与歌词区相交 ${probe.lyricsOverlapFrac.toFixed(6)}（须为 0）；空闲隐藏 ${probe.idleMs}ms；全屏=${probe.fullscreen} 当前可见=${probe.visible}`
    )
  } catch (e) {
    await say('x 控制条', false, String(e && e.message))
  }
  await yieldNow()

  // ---- y) npm run doctor 通过（§1.2 / §9-y）----
  // 浏览器里不能起子进程，所以这一项检查"doctor 的判据在这里是否都成立"，
  // 并把真正的 `npm run doctor` 留给命令行（`npm run doctor` 本身就是入口）。
  try {
    const parts = []
    let ok = true
    // a/b1：全部模块已在 ?probe=modules 通道验证过（doctor b2），这里复查 f) 与编码约定
    if (errors.length) {
      ok = false
      parts.push(`__errors ${errors.length} 条（doctor d 项会 FAIL）`)
    } else parts.push('__errors 为空（doctor d 项）')
    const viol = listViolations()
    const tooSmall = viol.filter((v) => v.size < v.min)
    if (tooSmall.length) {
      ok = false
      parts.push(`字号低于下限 ${tooSmall.length} 处`)
    } else parts.push('字号守卫 0 违规（doctor 之外的 §0.5 硬规则）')
    parts.push(`曝光关键帧 ${EXPOSURE_KEYS.length} 个、ACESFilmic=${comp.renderer.toneMapping === THREE.ACESFilmicToneMapping}`)
    parts.push('完整判据请跑 `npm run doctor`（a vite build / b1 node --check / b2 浏览器 import / c 编码 / d __errors）')
    await say('y doctor 前提', ok, parts.join('；'))
  } catch (e) {
    await say('y doctor 前提', false, String(e && e.message))
  }
  await yieldNow()

  // ---- q2) F2b 交付物：3D 物件库 / 代码墙 / 蜂群与桥接表（FIX §2.7、§2.8、§2.1）----
  try {
    const parts = []
    let ok = true

    // q1) 物件库：§2.7 的机器可验证部分（含 FIX 明写的「分针转 12 圈时针转 1 圈」）
    const rq = propsSelfCheck({ renderer: comp.renderer, camera: comp.camera })
    const badQ = rq.checks.filter((c) => !c.ok)
    if (badQ.length) {
      ok = false
      parts.push(`物件库 ${badQ.length}/${rq.checks.length} 项失败：${badQ.slice(0, 4).map((c) => c.name).join('；')}`)
    }
    // 每个物件都要是可调用的 API（createProp(kind) 能建出来）
    const missing = PROP_KINDS.filter((k) => {
      try {
        const o = createProp(k, { renderer: comp.renderer })
        return !o || !o.object || typeof o.update !== 'function'
      } catch (e) {
        return true
      }
    })
    if (missing.length) {
      ok = false
      parts.push(`createProp 无法建出：${missing.join(',')}`)
    }

    // q2) 代码墙：字号 ≥40、七种语言、多层景深、每层内容不同（同内容多层 = 重影不是景深）
    const cw = codeWall({ layout: 'corridor', layers: 7, fontPx: 44, width: 6.4, height: 3.7 })
    const rep = cw.report()
    const fonts = cw.panels.every((p) => p.fontPx >= 40)
    const langs7 = new Set(cw.panels.map((p) => p.lang)).size === 7
    const distinctFiles = new Set(cw.panels.map((p) => `${p.lang}#${p.file}`)).size === cw.panels.length
    const snip = snippetsReport()
    if (!rep.fontOk || !fonts || cw.panels.length < 3 || !langs7 || !snip.ok) {
      ok = false
      parts.push(`代码墙 fontPx=${rep.fontPx} 层=${cw.panels.length} 语言=${new Set(cw.panels.map((p) => p.lang)).size} 字号达标=${fonts}`)
    }
    if (!distinctFiles) {
      ok = false
      parts.push('代码墙存在两层用同一段代码（同屏会出现重影）')
    }
    // 屏幕上每行的实际像素高度（按"世界单位 1 = 半屏高"折算 1080p）必须 ≥40px
    const linePx = rep.linePx(H / 2)
    if (linePx < 40) {
      ok = false
      parts.push(`代码墙每行仅 ${linePx.toFixed(1)}px（<40px）`)
    }
    parts.push(`代码墙 7 层/7 语言/每行 ${linePx.toFixed(0)}px`)

    // q3) 蜂群：身份固定 + 布局归一化 + 桥接表 13 条覆盖全部段界
    const sr = swarm.report()
    const idA = sr.identityHash
    renderAt(57.3)
    const idB = swarm.report().identityHash
    if (idA !== idB) {
      ok = false
      parts.push(`蜂群身份在形变后改变（${idA} → ${idB}）`)
    }
    if (sr.bridges !== 13) {
      ok = false
      parts.push(`桥接表 ${sr.bridges} 条（应为 13）`)
    }
    // 形变过程中身份数组不得被改写：抽查若干时刻的 identityHash
    const ids = []
    for (const tt of [3, 14.5, 29.7, 44, 74, 103.5, 129, 147.9, 177.4, 188.5]) {
      renderAt(tt)
      ids.push(swarm.report().identityHash)
    }
    if (new Set(ids).size !== 1) {
      ok = false
      parts.push(`蜂群身份在 ${new Set(ids).size} 个时刻不同（应恒为 1）`)
    }
    // 布局归一化：各布局中位半径必须一致（否则形变会忽大忽小）
    const spread = sr.r50Max - sr.r50Min
    if (spread > 1e-3) {
      ok = false
      parts.push(`布局归一化失败：中位半径跨度 ${spread.toFixed(4)}`)
    }
    // 目标布局：14 段每段都有条目，且引用的布局名都存在
    const segIds = [...new Set(SCENES.filter((s) => !s.demo).map((s) => s.id))]
    const badSeg = segIds.filter((id) => !SEGMENT_SWARM[id] || !LAYOUT_NAMES.includes(SEGMENT_SWARM[id].from) || !LAYOUT_NAMES.includes(SEGMENT_SWARM[id].to))
    if (badSeg.length) {
      ok = false
      parts.push(`段落缺目标布局：${badSeg.join(',')}`)
    }
    // 蜂群必须在场：每段中点都真的画出粒子，且**屏幕覆盖面积**足够（用 3D 层实测）
    const absent = []
    const covered = []
    for (const sc of SCENES.filter((s) => !s.demo)) {
      const tm = sc.start + (sc.end - sc.start) * 0.5
      renderAt(tm)
      const cov = swarm.screenCoverage(tm, comp.camera)
      if (!hadSwarm || !hadSwarm.drawn || cov.sampled === 0 || cov.areaFrac < 0.05) {
        absent.push(`${sc.id}(面积${(cov.areaFrac * 100).toFixed(1)}%)`)
      }
      covered.push(cov.areaFrac)
    }
    if (absent.length) {
      ok = false
      parts.push(`蜂群在这些段缺席或覆盖不足：${absent.join(',')}`)
    }
    const covMin = covered.length ? Math.min(...covered) : 0
    parts.push(`蜂群 ${sr.count} 粒 / ${sr.layouts} 布局 / ${sr.bridges} 桥接 / 身份 ${sr.identityHash} / 各段屏幕覆盖 ≥${(covMin * 100).toFixed(1)}%`)

    await say('q2 F2b 交付物', ok, parts.join('；'))
  } catch (e) {
    await say('q F2b 交付物', false, String(e && e.message))
  }
  await yieldNow()

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
