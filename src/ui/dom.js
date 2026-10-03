// src/ui/dom.js — dsh 界面层的 DOM 实现（FIX.md §2.3 + 用户 F2a 反馈）
//
// 落实的要点：
//   · 内容**全部**来自 src/ui/content.js（原创文本，短而完整，不截断）；
//     ?debug 之外不得出现任何调试串（official mark / scene / impact …）。
//   · 上下文占用只有**一个来源**：调用方传进来的 ctxAt(t)；同屏不会出现两个不同的数。
//   · 面板是**半透明玻璃**（backdrop-filter 模糊 + 0.5px 描边），不是实心矩形。
//   · 与 Three 相机联动：applyCamera() 折算成 CSS3D 变换（透视倾斜 rotateY ±8–14° + 轻微漂浮）；
//     入场弹簧过冲、退场溶解，由 src/ui/panels.js 的进度驱动效果实现。
//   · 窗口几何由调用方指定，并强制不进入底部歌词安全区（画面底部 16%），最大高度 ≤ 76%。
//   · 内容由 t 的纯函数驱动，只在变化时写 DOM。

import { clamp, span } from '../core/ease.js'
import { fishLogoSvg } from './logo.js'
import { compose, float, windowFx } from './panels.js'
import {
  BRAND, NAV, SIDEBAR, HEADER, PHASE, THINK, USER, ASSISTANT, TOOLS, NOTICE, MODAL, COMPOSER, COMMAND, RIGHT,
} from './content.js'

export const CONFIG = {
  useOfficialLogo: true, // §5.10：默认使用官方 logo；公开发布可一键关闭
  defaultTheme: 'dark',
}

/** 安全区：歌词占底部 16%，面板不得进入；面板最大高度 76% */
export const SAFE = { bottomFrac: 0.84, maxHeightFrac: 0.76, marginFrac: 0.05 }

/** 界面出现的时刻（§5.3：不常驻） */
export const UI_WINDOWS = [
  { id: 'chat-F', t0: 74.0, t1: 88.8, kind: 'chat', phase: PHASE.chat },
  { id: 'chat-G', t0: 88.8, t1: 103.5, kind: 'chat', phase: PHASE.chat },
  { id: 'chat-H', t0: 103.5, t1: 118.3, kind: 'chat', phase: PHASE.chat, grayAt: 115.3 },
  { id: 'chat-I', t0: 118.3, t1: 129.0, kind: 'chat', phase: PHASE.compact, modalAt: 125.5 },
  { id: 'chat-M', t0: 177.4, t1: 188.5, kind: 'chat', phase: PHASE.chat },
  { id: 'chat-N', t0: 188.5, t1: 211.9, kind: 'chat', phase: PHASE.handoff, handoffAt: 190.8, resumeAt: 205.96 },
]
export const uiVisibleAt = (t) => UI_WINDOWS.some((w) => t >= w.t0 - 0.4 && t <= w.t1 + 0.5)
export const windowAt = (t) => UI_WINDOWS.find((w) => t >= w.t0 - 0.4 && t <= w.t1 + 0.5) || null

/** 聊天窗整体左偏一点，把画面右侧留给鲸鱼娘（几何的默认基准） */
const X_BIAS = -40

/** 窗口几何：聊天窗占画面宽 54%（要求 45–60%）、高度 72%（≤76%）、底边不越过 84% */
export function defaultGeometry(W = 1920, H = 1080, kind = 'chat') {
  if (kind === 'modal') {
    const w = Math.round(W * 0.30) // 弹窗要求 25–35%
    return { w, h: 320, x: Math.round((W - w) / 2), y: Math.round(H * 0.30) }
  }
  const w = Math.round(W * 0.54)
  const h = Math.min(Math.round(H * 0.72), Math.round(H * SAFE.maxHeightFrac))
  const x = Math.round((W - w) / 2) + X_BIAS
  const y = Math.max(Math.round(H * 0.06), Math.round(H * SAFE.bottomFrac) - h - Math.round(H * 0.01))
  return { w, h, x, y, right: 0 }
}

/** 纯函数：t + ctxAt → 整份界面状态（内容全部取自 content.js） */
export function dshScript(t, ctxPct = 0) {
  const win = windowAt(t) || UI_WINDOWS[0]
  const resumed = win.resumeAt != null && t >= win.resumeAt
  const session = resumed ? SIDEBAR.sessions[1].id : SIDEBAR.sessions[0].id
  const seq = clamp(Math.floor((t - 74) / 4.4), 0, ASSISTANT.length - 1)
  const toolN = clamp(Math.floor((t - 74.6) / 2.6) + 1, 1, TOOLS.length)
  const leftN = t >= 111.8 ? clamp(Math.floor((t - 111.8) / 1.05) + 1, 1, 5) : 0
  const charN = Math.floor(clamp((t % 4.4) / 4.4) * 22)

  let notice = null
  if (leftN > 0) {
    notice = leftN >= 5
      ? { kind: 'err', code: NOTICE.connCode, text: NOTICE.connReset }
      : { kind: 'warn', code: '', text: NOTICE.reconnect(leftN, 5) }
  } else if (win.modalAt != null && t >= win.modalAt) {
    notice = { kind: 'err', code: '', text: NOTICE.denied }
  } else if (win.handoffAt != null && t >= win.handoffAt) {
    notice = { kind: 'handoff', code: NOTICE.handoffCode, text: NOTICE.handoff(ctxPct) }
  }

  return {
    session,
    title: HEADER.title(session),
    sub: HEADER.sub(win.phase, ctxPct), // 唯一数值来源：ctxAt
    sessions: SIDEBAR.sessions.map((s) => ({ ...s, active: s.id === session })),
    think: THINK[clamp(Math.floor((t - 75) / 3), 0, THINK.length - 1)],
    thinkRunning: t < 90,
    user: USER[clamp(Math.floor((t - 74) / 4.4), 0, USER.length - 1)],
    userShown: (USER[clamp(Math.floor((t - 74) / 4.4), 0, USER.length - 1)] || '').slice(0, charN),
    assistant: ASSISTANT[seq].slice(0, Math.floor(span(t % 4.4, 0, 2.4) * ASSISTANT[seq].length) + 1),
    tools: TOOLS.slice(0, toolN),
    notice,
    modal: { show: win.modalAt != null && t >= win.modalAt && t < win.t1, denied: t >= (win.modalAt || 0) + 2.2 },
    composer: {
      text: (t >= 12.9 && t < 15) || t >= 205.5 ? COMMAND : '',
      typing: (t >= 12.9 && t < 14.2) || (t >= 205.5 && t < 205.96),
      caret: Math.floor(t * 2.3) % 2 === 0,
      perm: win.modalAt != null && t >= win.modalAt ? COMPOSER.permReadonly : COMPOSER.permWrite,
    },
    /** 右栏（三列网格的第三列）：改动逐条累积，仍是 t 的纯函数 */
    right: {
      title: RIGHT.title,
      note: RIGHT.note,
      files: RIGHT.files.slice(0, clamp(Math.floor((t - 74) / 3) + 2, 1, RIGHT.files.length)),
    },
    /** H 段第⑤次失败起整窗去色 */
    gray: win.grayAt != null && t >= win.grayAt ? clamp((t - win.grayAt) / 1.2) : 0,
  }
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

export function createDomUI({ W = 1920, H = 1080, geometry = {} } = {}) {
  const layer = document.createElement('div')
  layer.id = 'dsh-layer'
  // token/布局作用域是 .dsh-root（不是 id），?dshpreview 才能并排挂亮、暗两棵树
  layer.className = 'dsh-root'
  if (CONFIG.defaultTheme === 'dark') layer.dataset.dsDarkTheme = ''
  const stage = document.createElement('div')
  stage.id = 'dsh-stage'
  layer.appendChild(stage)
  document.body.appendChild(layer)

  const logo = CONFIG.useOfficialLogo ? fishLogoSvg(34) : ''
  const geo = {
    chat: { ...defaultGeometry(W, H, 'chat'), ...(geometry.chat || {}) },
    modal: { ...defaultGeometry(W, H, 'modal'), ...(geometry.modal || {}) },
  }

  stage.innerHTML = `
  <div class="dsh-frame" data-r="frame">
    <aside class="dsh-sidebar">
      <div class="dsh-brand">
        <div class="mark">${logo}</div>
        <div class="txt"><div class="name">${BRAND.name}</div><div class="ver">${BRAND.product} ${BRAND.version}</div></div>
        <span class="collapse" aria-hidden="true"></span>
      </div>
      <div class="dsh-nav">
        ${NAV.map((n) => `<div class="dsh-navitem${n.key === 'new' ? ' primary' : ''}"><span class="ic ${n.key}"></span><span class="lb">${n.label}</span>${n.hint ? `<span class="kb">${n.hint}</span>` : ''}</div>`).join('')}
      </div>
      <div class="dsh-sectitle"><span>${SIDEBAR.sectionTitle}</span><span class="tools"><i></i><i></i><i></i></span></div>
      <div class="dsh-tree">
        <div class="dsh-ws"><span class="folder"></span><span class="nm">${SIDEBAR.workspace}</span></div>
        <div class="dsh-sessions" data-r="sessions"></div>
      </div>
      <div class="dsh-side-foot">
        ${SIDEBAR.footItems.map((f) => `<div class="dsh-footitem"><span class="ic"></span><span>${f}</span></div>`).join('')}
        <div class="dsh-model">${SIDEBAR.foot}</div>
      </div>
    </aside>
    <section class="dsh-center">
      <header class="dsh-header">
        <div class="meta"><div class="title" data-r="title"></div><div class="sub" data-r="sub"></div></div>
        <span class="rail-toggle" title="右侧栏"></span>
      </header>
      <div class="dsh-transcript" data-r="transcript"></div>
      <div class="dsh-composer">
        <div class="dsh-card">
          <div class="dsh-input" data-r="input"></div>
          <div class="dsh-crow">
            <span class="dsh-chip"><span class="ws"></span>${COMPOSER.workspace}</span>
            <span class="dsh-chip">${COMPOSER.mode}</span>
            <span class="dsh-spacer"></span>
            <span class="dsh-chip right" data-r="perm"></span>
            <span class="dsh-chip right model" data-r="model"></span>
            <span class="dsh-send">↑</span>
          </div>
        </div>
        <div class="dsh-dock"><span class="dsh-ctx" data-r="ctx"></span></div>
      </div>
    </section>
    <aside class="dsh-rightbar" data-r="rightbar">
      <div class="dsh-rbtitle" data-r="rbtitle"></div>
      <div class="dsh-rbrows" data-r="rbrows"></div>
      <div class="dsh-rbnote" data-r="rbnote"></div>
    </aside>
  </div>
  <div class="dsh-modalwrap" data-r="modalwrap" style="display:none">
    <div class="dsh-modal" data-r="modal">
      <div class="strip"><span class="state"></span><span data-r="modaltext"></span></div>
      <div class="body">${MODAL.body}</div>
      <div class="acts"><span class="dsh-btn">${MODAL.deny}</span><span class="dsh-btn primary">${MODAL.allow}</span></div>
    </div>
  </div>`

  const q = (r) => stage.querySelector(`[data-r="${r}"]`)
  const refs = {
    frame: q('frame'), sessions: q('sessions'), title: q('title'), sub: q('sub'),
    transcript: q('transcript'), input: q('input'), perm: q('perm'), model: null, ctx: q('ctx'),
    modalwrap: q('modalwrap'), modaltext: q('modaltext'), modal: q('modal'),
    rbtitle: q('rbtitle'), rbrows: q('rbrows'), rbnote: q('rbnote'),
  }
  // 模型 chip 有自己的 data-r（不再用"第二个 .dsh-chip"这种脆弱的假设：
  // 底部行现在是 工作区 / 模式 / 访问模式 / 模型 / 发送，位置会变）
  refs.model = q('model')
  if (refs.model) refs.model.textContent = COMPOSER.model

  const applyGeom = () => {
    const g = geo.chat
    refs.frame.style.width = `${g.w}px`
    refs.frame.style.height = `${g.h}px`
    refs.frame.style.left = `${g.x}px`
    refs.frame.style.top = `${g.y}px`
    // 第三列（官方 .rightbarCol，最小 300px）：宽度 0 时整列不显示
    const rw = g.right || 0
    refs.frame.style.setProperty('--dsh-right-w', `${rw}px`)
    refs.frame.dataset.right = rw > 40 ? '1' : '0'
    if (refs.modalwrap) {
      // 权限弹窗是"这个窗口"的弹窗：居中于窗口，而不是居中于整个舞台
      refs.modalwrap.style.left = `${g.x}px`
      refs.modalwrap.style.top = `${g.y}px`
      refs.modalwrap.style.width = `${g.w}px`
      refs.modalwrap.style.height = `${g.h}px`
    }
    if (refs.modal) {
      refs.modal.style.width = `${geo.modal.w}px`
      refs.modal.style.maxHeight = `${Math.round(H * SAFE.maxHeightFrac)}px`
    }
  }
  /**
   * 安全区约束（用户 F2a 第 1 条）：可见窗口高度 ≤ 76% 画面、底边不越过 84%（歌词占底部 16%）。
   *
   * 关键点：面板是**带 CSS3D 透视**的（`#dsh-root` 的 perspective:1600px + rotateY ±14°/rotateX ±6°），
   * 近端会被放大。所以按"布局盒子"卡 76%/84% 是不够的——实测 t=95 布局 72% 高，
   * 投影后量到 **81.4% 高、底边 84.3%**，已经压进歌词区。
   * 这里按最坏情况的投影放大倍率反推布局预算，保证**投影后**仍在两条线内。
   */
  const PERSPECTIVE = 1600 // 与 dsh.css 的 #dsh-root perspective 一致
  const MAX_YAW = 14
  const MAX_PITCH = 6
  const ZOOM_MAX = 1.03 // applyCamera 的 scale(fit*zoom)，zoom ≤ 1.1 但实际 fov ≈ 37–40
  const projMag = (w, h) => {
    const off =
      (w / 2) * Math.sin((MAX_YAW * Math.PI) / 180) + (h / 2) * Math.sin((MAX_PITCH * Math.PI) / 180)
    return ZOOM_MAX / Math.max(0.5, 1 - off / PERSPECTIVE)
  }
  // 用最大允许高度估算倍率（高度越大倍率越大），得到保守但确定的预算
  const PROJ = projMag(W, H * SAFE.maxHeightFrac)

  const clampToSafe = (r) => {
    const w = clamp(Math.round(r.w), 240, W)
    const hMax = Math.floor((H * SAFE.maxHeightFrac) / PROJ)
    const h = clamp(Math.round(r.h), 200, hMax)
    const x = clamp(Math.round(r.x), 0, W - w)
    // 底边：投影后最下端 = y + h + (h/2)*(PROJ-1) ≤ 0.84H
    const yMax = Math.floor(H * SAFE.bottomFrac - h - (h / 2) * (PROJ - 1))
    const y = clamp(Math.round(r.y), 0, Math.max(0, yMax))
    return { w, h, x, y, right: Math.max(0, Math.round(r.right || 0)) }
  }

  // 构造时就用同一套预算（默认几何也必须是安全的）
  geo.chat = clampToSafe({ ...defaultGeometry(W, H, 'chat') })
  geo.modal = clampToSafe({ ...defaultGeometry(W, H, 'modal') })
  applyGeom()
  const setGeometry = (kind = 'chat', rect = null) => {
    if (!rect) return geo[kind] || geo.chat
    const g = { ...(geo[kind] || geo.chat) }
    if (rect.wFrac != null) g.w = W * rect.wFrac
    if (rect.hFrac != null) g.h = H * rect.hFrac
    if (rect.rightPx != null) g.right = rect.rightPx // 0 = 收起第三列
    if (g.w == null) g.w = defaultGeometry(W, H, kind).w
    // 只给比例时保持"水平居中 + 左偏、底边贴住安全区"的基准
    if (rect.x != null) g.x = rect.x
    else if (rect.wFrac != null) g.x = Math.round((W - g.w) / 2) + X_BIAS
    if (rect.hFrac != null) g.y = Math.round(H * SAFE.bottomFrac) - g.h - Math.round(H * 0.01)
    geo[kind] = clampToSafe(g)
    applyGeom()
    return geo[kind]
  }

  let lastKey = ''
  let visible = null
  let lastT = 0
  let lastGeom = null

  // 重绘判据 = **paint() 会写进 DOM 的全部状态** + 特效键。
  // 之前是手挑字段，漏了 composer.caret 与 right.files：carate 的奇偶一变而 key 不变时
  // 就不会重绘，于是"同一个 t 的 innerHTML"取决于此前渲染过哪些帧（selftest a 的
  // DOM 哈希乱序比对因此 FAIL）。改成整份状态序列化，彻底消除这类顺序依赖。
  const keyOf = (s, fxKey) => JSON.stringify([s, fxKey])

  function paint(s) {
    refs.title.textContent = s.title
    refs.sub.textContent = s.sub
    refs.sessions.innerHTML = s.sessions
      .map((x) => `<div class="dsh-session ${x.active ? 'active' : ''}"><span class="dot"></span><span class="sid">${esc(x.id)}</span><span class="slabel">${esc(x.label)}</span><span class="when">${esc(x.when)}</span></div>`)
      .join('')
    const rows = []
    if (s.userShown) rows.push(`<div class="dsh-userrow"><div class="dsh-bubble">${esc(s.userShown)}</div></div>`)
    rows.push(`<div class="dsh-disclosure" data-state="${s.thinkRunning ? 'running' : 'ok'}"><span class="ico"></span><span class="sum">${esc(s.think)}</span></div>`)
    if (s.assistant) rows.push(`<div class="dsh-assistant">${esc(s.assistant)}</div>`)
    for (const tl of s.tools) {
      rows.push(`<div class="dsh-tool" data-state="${tl.state}"><div class="row1"><span class="state"></span><span class="name">${esc(tl.name)}</span></div><div class="args">${esc(tl.args)}</div><div class="out">${esc(tl.out)}</div></div>`)
    }
    if (s.notice) rows.push(`<div class="dsh-notice ${s.notice.kind}">${s.notice.code ? `<span class="code">${esc(s.notice.code)}</span>` : ''}<span>${esc(s.notice.text)}</span></div>`)
    refs.transcript.innerHTML = rows.slice(-8).join('')

    const c = s.composer
    refs.input.innerHTML = c.text
      ? `<span>${esc(c.text)}</span>${c.caret ? '<span class="caret"></span>' : ''}`
      : `<span class="ph">${COMPOSER.placeholder}</span>${c.caret ? '<span class="caret"></span>' : ''}`
    refs.perm.textContent = c.perm
    refs.rbtitle.textContent = s.right.title
    refs.rbnote.textContent = s.right.note
    refs.rbrows.innerHTML = s.right.files
      .map((f) => `<div class="dsh-rbrow" data-state="${f.state}"><span class="st"></span><span class="nm">${esc(f.name)}</span><span class="dl">${esc(f.delta)}</span></div>`)
      .join('')
    refs.modalwrap.style.display = s.modal.show ? 'flex' : 'none'
    if (s.modal.show) refs.modaltext.textContent = s.modal.denied ? MODAL.denied : MODAL.ask
  }

  function paintCtx(pct) {
    const R = 5.5
    const C = 2 * Math.PI * R
    refs.ctx.className = 'dsh-ctx' + (pct > 85 ? ' hot' : '')
    refs.ctx.innerHTML =
      `<svg viewBox="0 0 14 14"><circle class="track" cx="7" cy="7" r="${R}"></circle>` +
      `<circle class="fill" cx="7" cy="7" r="${R}" stroke-dasharray="${(clamp(pct / 100) * C).toFixed(2)} ${C.toFixed(2)}"></circle></svg>` +
      `<span>context ${Math.round(clamp(pct, 0, 100))}%</span>`
  }

  return {
    layer,
    stage,
    geometry: geo,
    SAFE,
    setGeometry,
    get html() { return stage.innerHTML },
    hash() {
      const s = stage.innerHTML
      let h = 2166136261
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
      return h >>> 0
    },
    setTheme(theme) {
      if (theme === 'dark') layer.dataset.dsDarkTheme = ''
      else delete layer.dataset.dsDarkTheme
      CONFIG.defaultTheme = theme
    },
    /**
     * 与相机联动：把相机相对注视点的偏移折成 CSS3D 变换。
     * 用户 F2a 第 2 条要求"透视倾斜 rotateY ±8–14°"，所以偏航幅值**恒定落在 8–14°**：
     * 相机偏得越多越接近 14°，正对时也保留 8° 的基础倾角（面板始终是一块悬浮的 3D 平面）。
     * 方向跟随相机，因此镜头绕行时面板会真的跟着转。
     */
    applyCamera(st) {
      const fit = Math.min(window.innerWidth / W, window.innerHeight / H)
      const s0 = st || { pos: [0, 0, 3], look: [0, 0, 0], fov: 40 }
      const raw = (s0.pos[0] - s0.look[0]) * 9
      const mag = clamp(Math.abs(raw) / 6) // 0..1
      const yaw = (raw < 0 ? -1 : 1) * (8 + 6 * mag) // 幅值恒在 8–14°
      const pitch = clamp(-(s0.pos[1] - s0.look[1]) * 6, -6, 6)
      const zoom = clamp(38 / (s0.fov || 40), 0.96, 1.1)
      stage.style.transform =
        `rotateY(${yaw.toFixed(2)}deg) rotateX(${pitch.toFixed(2)}deg) scale(${(fit * zoom).toFixed(4)})`
      return { yaw, pitch, fit }
    },
    /** 面板效果组合（enter/exit/shake/glitch/grayscale/smash/tunnel/collapse） */
    applyEffects(list, { floatAmp = 7 } = {}) {
      const fx = compose(list || [])
      refs.frame.style.transform = `${fx.transform} ${floatAmp ? float(lastT, { amp: floatAmp }) : ''}`.trim()
      refs.frame.style.opacity = fx.opacity == null ? '1' : fx.opacity
      refs.frame.style.filter = fx.filter || ''
      for (const [k, v] of Object.entries(fx.vars || {})) layer.style.setProperty(k, v)
    },
    setFx({ glitch = 0, dispersion = 0, shake = 0, alpha = 1 }) {
      layer.style.setProperty('--dsh-glitch', glitch.toFixed(3))
      layer.style.setProperty('--dsh-disp', dispersion.toFixed(3))
      layer.style.setProperty('--dsh-shake', shake.toFixed(3))
      layer.style.setProperty('--dsh-alpha', alpha.toFixed(3))
      if (glitch > 0.25) layer.dataset.glitch = '1'
      else delete layer.dataset.glitch
    },
    setVisible(v) {
      if (v === visible) return
      visible = v
      layer.style.display = v ? 'block' : 'none'
    },
    render(t, ctxPct = 0, camState = null, geom = null) {
      lastT = t
      // 窗口尺寸由调用方给（比例或像素），只在变化时写
      if (geom && geom !== lastGeom) {
        lastGeom = geom
        setGeometry(geom.kind || 'chat', geom)
      }
      const win = windowAt(t)
      const s = dshScript(t, ctxPct)
      const wfx = windowFx(t, win || UI_WINDOWS[0])
      const fxKey = wfx ? `${wfx.name}:${wfx.u.toFixed(2)}:${s.gray > 0 ? 'g' : ''}` : 'none'
      const key = keyOf(s, fxKey)
      if (key !== lastKey) { lastKey = key; paint(s) }
      paintCtx(ctxPct)
      const list = []
      if (wfx) list.push(wfx)
      if (s.gray > 0) list.push({ name: 'grayscale', u: s.gray })
      this.applyEffects(list)
      // 弹窗的"砸向相机"作用在弹窗自己身上，不要加到整窗。
      // 注意：**即使不显示也要把内联样式写成确定值**——否则这些 inline style 会保留
      // 上一次显示时的残留，混进 stage.innerHTML，使"同一个 t 的哈希"依赖渲染历史
      // （selftest a 的 DOM 哈希比对就是这么被抓出来的）。
      {
        const mu = s.modal.show ? clamp(span(t, win.modalAt, win.modalAt + 0.45)) : 0
        const fx = compose([{ name: 'smash', u: mu }])
        refs.modal.style.transform = fx.transform
        refs.modal.style.opacity = fx.opacity == null ? '1' : fx.opacity
      }
      if (camState) this.applyCamera(camState)
    },
  }
}
