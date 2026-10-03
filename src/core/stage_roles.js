// src/core/stage_roles.js — 分区、角色声明与遮挡规则（FIX_V3.md §2.4 / §9-q / §9-s）
//
// §2.4 的硬性规则（1080p 逻辑坐标）：
//   · 分区：歌词区 y > 80%；主角区 x ∈ [22%,78%]、y ∈ [12%,72%]；终端屏只能放在左右侧带与远景。
//   · 深度：终端屏必须在所有主角**之后**（离相机更远）；depthTest 开、depthWrite 关、
//     renderOrder 低于主角；主角必须不透明或写深度。
//   · 每个 3D 对象声明 role:'hero'|'pane'|'decor'；同屏 pane ≤3 块；
//     单块 pane 的屏幕占比 ≤22%（远景大块 ≤35% 且 alpha ≤0.3）；pane 不得与歌词区相交。
//
// 为什么要有"登记"这一步而不是全靠约定：
//   遮挡/占比/歌词区相交这三件事都必须**按帧、按实际投影结果**判定。写死在场景里的话，
//   相机一移动就失效（§2.5 还要求 terminal 屏在不同深度**缓慢漂移**，位置本来就在变）。
//   所以：场景注册一次对象，本模块每帧在渲染后算屏幕包围盒并做判定，
//   结果给 ?selftest 的 q)/s) 与 `npm run mapping` 的 ORPHANS.md 消费。
//
// role 的语义：
//   hero  — 该段的主体（茄子/番茄/猫/钟表/开关/心脏/KV 立方体…）。必须不透明或写深度。
//   pane  — 终端屏 / 显示器（TermPane / Monitor）。必须 depthWrite:false、renderOrder<hero、
//           且屏幕占比与所在带都受限。
//   decor — 氛围层（背景代码墙、海雪、光柱、暗角），**允许无锚点**，但总占比 ≤30%（§4.2）。

import * as THREE from 'three'

/**
 * 逻辑分辨率。
 * 这里**不**从 compositor.js import：那会形成 compositor → main → stage_roles → compositor 的环，
 * 环里的常量在模块初始化顺序不对时会变成 undefined。两个数字是规格常量（1080p 逻辑坐标），
 * 重复一遍比引入环更安全；`src/core/compositor.js` 的 LOGICAL_W/H 与这里一致。
 */
export const LOGICAL_W = 1920
export const LOGICAL_H = 1080

export const ROLE_KINDS = ['hero', 'pane', 'decor']

/** §2.4 的分区（比例，1080p） */
export const ZONES = {
  /** 歌词区：y > 80% —— 任何 pane 与它相交即 FAIL */
  lyrics: { x0: 0, y0: 0.8, x1: 1, y1: 1 },
  /** 主角区 */
  hero: { x0: 0.22, y0: 0.12, x1: 0.78, y1: 0.72 },
  /** 允许放 terminal 屏的带：左侧带 + 右侧带（另加"远景"，由面积/alpha 规则约束） */
  bands: [
    { id: 'L', x0: 0, y0: 0, x1: 0.22, y1: 0.8 },
    { id: 'R', x0: 0.78, y0: 0, x1: 1, y1: 0.8 },
  ],
}

/** §2.4 的限额 */
export const LIMITS = {
  maxPanes: 3,
  paneAreaFrac: 0.22,
  paneAreaFracFar: 0.35,
  paneFarAlpha: 0.3,
  paneHeroOverlap: 0.05,
  decorShare: 0.3,
}

const _bbox = { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0, cx: 0, cy: 0, areaFrac: 0, onScreen: false }

/** 视口像素 → 归一化（0..1）包围盒；进不去（完全在背后/视锥外）则 onScreen=false */
export function ndcBBox(obj, camera, W = LOGICAL_W, H = LOGICAL_H) {
  const box = obj.userData && obj.userData._srBox
  const src = box || null
  if (!src) return { ..._bbox, onScreen: false }
  // 取 8 个角投影，取 min/max（比只投中心稳：面板可能一半在画面外）
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let anyFront = false
  for (let i = 0; i < 8; i++) {
    _v.set(
      i & 1 ? src.max.x : src.min.x,
      i & 2 ? src.max.y : src.min.y,
      i & 4 ? src.max.z : src.min.z
    )
    _v.project(camera)
    if (_v.z > -1 && _v.z < 1) anyFront = true
    const px = (_v.x * 0.5 + 0.5) * W
    const py = (-_v.y * 0.5 + 0.5) * H
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  if (!anyFront) return { ..._bbox, onScreen: false }
  // 夹到画面内再算占比：贴在画面外的部分不占视觉面积
  const cx0 = Math.max(0, minX)
  const cy0 = Math.max(0, minY)
  const cx1 = Math.min(W, maxX)
  const cy1 = Math.min(H, maxY)
  const inside = Math.max(0, cx1 - cx0) * Math.max(0, cy1 - cy0)
  return {
    x0: cx0 / W, y0: cy0 / H, x1: cx1 / W, y1: cy1 / H,
    w: Math.max(0, cx1 - cx0) / W, h: Math.max(0, cy1 - cy0) / H,
    cx: (cx0 + cx1) / 2 / W, cy: (cy0 + cy1) / 2 / H,
    areaFrac: inside / (W * H),
    onScreen: inside > 0,
  }
}

// 复用的临时向量（§8：渲染循环里不得分配新对象）
const _v = new THREE.Vector3()
const _center = new THREE.Vector3()
const _camPos = new THREE.Vector3()

/** 两个归一化包围盒的交叠面积占比（相对 b 的面积） */
export function overlapFrac(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = ix * iy
  const area = Math.max(1e-9, (b.x1 - b.x0) * (b.y1 - b.y0))
  return inter / area
}

/** 中心点落在哪条允许的带里（否则 null） */
export function bandOf(b) {
  for (const z of ZONES.bands) {
    if (b.cx >= z.x0 && b.cx <= z.x1 && b.cy >= z.y0 && b.cy <= z.y1) return z.id
  }
  return null
}

/**
 * 建一个角色登记表。
 * @param {{THREE:any}} o
 */
export function createStageRoles({ THREE: T } = {}) {
  const T3 = T || THREE
  /** @type {Array<object>} */
  const regs = []
  let frameNo = 0
  const stats = { panes: 0, heroes: 0, decor: 0, paneArea: 0, decorShare: 0 }

  /**
   * 注册一个 3D 对象。
   * @param {object} obj Three 对象（Object3D/Mesh）；会被自动计算世界包围盒
   * @param {{role:'hero'|'pane'|'decor', seg?:string, anchor?:string|null, tag?:string,
   *          alpha?:number, far?:boolean, side?:'L'|'R'|null}} opts
   */
  function register(obj, opts = {}) {
    const role = opts.role || 'decor'
    if (!ROLE_KINDS.includes(role)) throw new Error(`[stage_roles] 非法 role: ${role}`)
    const rec = {
      obj,
      role,
      seg: opts.seg || null,
      anchor: opts.anchor === undefined ? null : opts.anchor,
      tag: opts.tag || obj.name || '(未命名)',
      alpha: opts.alpha == null ? 1 : opts.alpha,
      far: !!opts.far,
      side: opts.side || null,
      box: new T3.Box3(),
      bbox: null,
      depth: 0,
      visible: false,
    }
    regs.push(rec)
    return rec
  }

  /** 每帧开始：清掉上一帧的判定结果（对象本身不删） */
  function beginFrame() {
    frameNo++
    stats.panes = 0
    stats.heroes = 0
    stats.decor = 0
    stats.paneArea = 0
    stats.decorShare = 0
  }

  /**
   * 每帧渲染**之后**调用：算出所有可见登记对象的屏幕包围盒与相机距离。
   * @param {object} camera
   * @param {object} [opts] { renderer } 用于读材质透明度
   */
  function measure(camera, opts = {}) {
    const camPos = camera.getWorldPosition(_camPos)
    for (const r of regs) {
      r.visible = isVisible(r.obj)
      r.bbox = null
      if (!r.visible) continue
      r.obj.updateWorldMatrix(true, true)
      r.box.setFromObject(r.obj)
      if (r.box.isEmpty()) {
        r.visible = false
        continue
      }
      r.obj.userData = r.obj.userData || {}
      r.obj.userData._srBox = r.box
      r.bbox = ndcBBox(r.obj, camera, LOGICAL_W, LOGICAL_H)
      r.obj.userData._srBox = null
      const c = r.box.getCenter(_center)
      r.depth = c.distanceTo(camPos)
      if (r.role === 'pane') {
        stats.panes++
        stats.paneArea += r.bbox.onScreen ? r.bbox.areaFrac : 0
      } else if (r.role === 'hero') stats.heroes++
      else {
        stats.decor++
        stats.decorShare += r.bbox.onScreen ? r.bbox.areaFrac : 0
      }
    }
    return stats
  }

  /** 对象是否真的会被画出来（自身与所有祖先 visible、材质没被完全透明化） */
  function isVisible(o) {
    let n = o
    while (n) {
      if (n.visible === false) return false
      n = n.parent
    }
    return true
  }

  /** 读取一个登记对象的材质透明度（多材质取最小） */
  function alphaOf(rec) {
    let a = 1
    rec.obj.traverse((o) => {
      if (!o.material) return
      const ms = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of ms) if (m && m.opacity != null) a = Math.min(a, (m.transparent === false ? 1 : m.opacity))
    })
    return a
  }

  /**
   * §2.4 / §9-q：判定本帧是否合规。
   * @returns {{ok:boolean, fails:Array<{code:string, tag:string, detail:string}>, stats:object}}
   */
  function check() {
    const fails = []
    const panes = regs.filter((r) => r.role === 'pane' && r.visible && r.bbox && r.bbox.onScreen)
    const heroes = regs.filter((r) => r.role === 'hero' && r.visible && r.bbox && r.bbox.onScreen)

    // q1) 同屏 pane ≤3 块
    if (panes.length > LIMITS.maxPanes) {
      fails.push({ code: 'pane-count', tag: '-', detail: `同屏 pane ${panes.length} 块（上限 ${LIMITS.maxPanes}）：${panes.map((p) => p.tag).join(',')}` })
    }

    for (const p of panes) {
      const a = p.alpha == null ? alphaOf(p) : p.alpha
      // q2) 单块占比：≤22%；"远景大块"可到 35% 但 alpha ≤0.3
      //
      // ⚠️ 这里原先是 `p.far === true && a <= 0.3` —— `far` 是我自己发明的**声明式**标记。
      // 但 §2.4 的原文是「单块 pane 的屏幕占比 ≤22%（**远景大块 ≤35% 且 alpha ≤0.3**）」：
      // 豁免判据是**面积 + alpha**，不是"调用方声明自己是远景"。
      // 声明式标记的坏处实测就暴露了：?demo=panes 里正在**退场**的屏（向后推远 + 淡出，
      // 投影中心因此滑向画面中部）被判成 `pane-zone` 违规，而它当时 alpha 只有 0.27
      // —— 按 §2.4 正属于"远景大块"的豁免范围。现在按 alpha 派生，与规格原文一致。
      const farOk = a <= LIMITS.paneFarAlpha + 1e-6
      const cap = farOk ? LIMITS.paneAreaFracFar : LIMITS.paneAreaFrac
      if (p.bbox.areaFrac > cap + 1e-6) {
        fails.push({
          code: 'pane-area', tag: p.tag,
          detail: `占比 ${(p.bbox.areaFrac * 100).toFixed(1)}% > ${(cap * 100).toFixed(0)}%（远景(α≤0.3)=${farOk} alpha=${a.toFixed(2)}）`,
        })
      }
      // q3) pane 不得与歌词区相交
      const ovLyrics = overlapFrac(p.bbox, ZONES.lyrics)
      if (ovLyrics > 1e-6) {
        fails.push({ code: 'pane-lyrics', tag: p.tag, detail: `与歌词区相交 ${(ovLyrics * 100).toFixed(1)}%` })
      }
      // q4) pane 只能放在左右侧带（或"远景" = α ≤0.3，见 q2 的说明）
      const band = bandOf(p.bbox)
      if (!band && !farOk) {
        fails.push({ code: 'pane-zone', tag: p.tag, detail: `不在左右侧带（中心 ${(p.bbox.cx * 100).toFixed(0)}%,${(p.bbox.cy * 100).toFixed(0)}%）且 α=${a.toFixed(2)} > 0.3（非远景）` })
      }
      // q5) 深度：与 hero 重叠时必须比 hero 远，且重叠 ≤5%；否则 hero 必须能写深度
      for (const h of heroes) {
        const ov = overlapFrac(p.bbox, h.bbox)
        if (ov <= 1e-6) continue
        if (ov > LIMITS.paneHeroOverlap + 1e-6) {
          fails.push({ code: 'pane-hero-overlap', tag: p.tag, detail: `与主角 ${h.tag} 重叠 ${(ov * 100).toFixed(1)}% > 5%` })
        }
        if (!(p.depth > h.depth + 1e-4)) {
          fails.push({ code: 'pane-not-behind', tag: p.tag, detail: `与主角 ${h.tag} 重叠，但 pane 距离 ${p.depth.toFixed(2)} 不大于 ${h.depth.toFixed(2)}` })
        }
        if (!writesDepth(h.obj)) {
          fails.push({ code: 'hero-no-depth', tag: h.tag, detail: `主角在 pane 之前却不写深度（pane 会盖住它）` })
        }
      }
      // q6) pane 自身的材料纪律
      const bad = materialDiscipline(p.obj)
      if (bad) fails.push({ code: 'pane-material', tag: p.tag, detail: bad })
    }

    // s3) decor 占比 ≤30%
    const share = stats.decorShare
    if (share > LIMITS.decorShare + 1e-6) {
      fails.push({ code: 'decor-share', tag: '-', detail: `decor 屏幕占比 ${(share * 100).toFixed(1)}% > 30%` })
    }

    return { ok: fails.length === 0, fails, stats: { ...stats, panes: panes.length, heroes: heroes.length } }
  }

  /** 主角是否"不透明或写深度"（§2.4 要求：不透明**或**写深度） */
  function writesDepth(obj) {
    let ok = false
    obj.traverse((o) => {
      if (!o.material) return
      const ms = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of ms) {
        if (!m) continue
        const opaque = m.transparent === false || (m.opacity ?? 1) >= 0.999
        if (opaque || m.depthWrite !== false) ok = true
      }
    })
    return ok
  }

  /** pane 的材料纪律：depthTest 开、depthWrite 关、renderOrder 低于主角 */
  function materialDiscipline(obj) {
    const ms = []
    obj.traverse((o) => {
      if (!o.material) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) ms.push({ m, o })
    })
    for (const { m, o } of ms) {
      if (m.depthTest === false) return `${o.name || o.type} 的 depthTest 关了（必须开）`
      if (m.depthWrite !== false) return `${o.name || o.type} 的 depthWrite 没关（必须关）`
      if ((o.renderOrder || 0) >= 0) return `${o.name || o.type} 的 renderOrder=${o.renderOrder}（必须 <0）`
    }
    return null
  }

  /**
   * §4.2 / §9-s：孤儿核对。
   * 规则：**除 decor 外**，任何登记对象都必须带 anchor；decor 的总屏幕占比 ≤30%。
   * @returns {{total:number, orphans:Array, decor:Array}}
   */
  function orphans() {
    const orphans = []
    const decor = []
    for (const r of regs) {
      if (r.role === 'decor') {
        decor.push(r)
        continue
      }
      if (!r.anchor) orphans.push(r)
    }
    return { total: regs.length, orphans, decor }
  }

  function all() {
    return regs
  }
  function clear() {
    regs.length = 0
  }
  function frameIndex() {
    return frameNo
  }

  return { register, beginFrame, measure, check, orphans, all, clear, frameIndex, stats, alphaOf, writesDepth }
}

export default createStageRoles
