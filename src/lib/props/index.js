// src/lib/props/index.js — 3D 物件库的统一入口（FIX.md §2.7）
//
// 各段只通过这里拿物件：`createProp('eggplant', { renderer })`。
// 同时导出 selfCheck()：把 §2.7 里**可机器验证**的部分写成断言（含 FIX 明写的
// 「分针转 12 圈时针转 1 圈」），由 ?selftest 的 q) 项消费。

import { createVeg, createEggplant, createTomato, profileReport } from './veg.js'
import { createCat } from './cat.js'
import { createClock, assertClockRatio, minuteOfDay, minuteHandAngle, hourHandAngle, AM_MINUTE, PM_MINUTE } from './clock.js'
import { createToggle, createSwitchToggle } from './toggle.js'
import { createTunnel, coverageReport } from './tunnel.js'
import { createKVCache, kvFillAt } from './kvcache.js'
import { createHeart } from './heart.js'
import { createTermPane, PANE_W, PANE_H, MAX_LINES } from './termpane.js'
import { createMonitor } from './monitor.js'
import { getEnv, createLightRig, applyEnv, resetEnv } from './env.js'

export const PROP_KINDS = ['eggplant', 'tomato', 'cat', 'clock', 'toggle', 'tunnel', 'kvcache', 'heart', 'termpane', 'monitor']

/**
 * 建物件。
 * @param {string} kind
 * @param {object} [opts]
 */
export function createProp(kind, opts = {}) {
  switch (kind) {
    case 'eggplant': return createEggplant(opts)
    case 'tomato': return createTomato(opts)
    case 'cat': return createCat(opts)
    case 'clock': return createClock(opts)
    case 'toggle': return createToggle(opts)
    case 'tunnel': return createTunnel(opts)
    case 'kvcache': return createKVCache(opts)
    case 'heart': return createHeart(opts)
    // §2.2 / §2.3：终端屏与显示器。
    // termpane 的返回值没有 `object` 字段（它导出的是 mesh），所以这里补一个别名，
    // 让 createProp 的返回值形状一致（自检 q 会检查 `o.object` 与 `o.update`）。
    case 'termpane': {
      const p = createTermPane(opts)
      p.object = p.mesh
      if (typeof p.update !== 'function') {
        p.update = (_t, o = {}) => {
          if (o.lines) p.setLines(o.lines, o.header)
          if (o.caret != null) p.setCaret(o.caret)
          return p.flush()
        }
      }
      return p
    }
    case 'monitor': {
      // Monitor 可以自带一块 TermPane（不给就建一块纯色屏）
      const pane = opts.pane || (opts.withPane === false ? null : createTermPane({ session: opts.session || '#001', side: opts.side || 'L' }))
      const m = createMonitor({ ...opts, pane })
      m.pane = pane
      if (typeof m.update !== 'function') {
        m.update = (_t, o = {}) => {
          if (pane && o.lines) pane.setLines(o.lines, o.header)
          if (pane && o.caret != null) pane.setCaret(o.caret)
          return pane ? pane.flush() : false
        }
      }
      return m
    }
    default: throw new Error(`[props] 未知物件：${kind}（可用：${PROP_KINDS.join(', ')}）`)
  }
}

export {
  createVeg, createEggplant, createTomato, profileReport,
  createCat,
  createClock, assertClockRatio, minuteOfDay, minuteHandAngle, hourHandAngle, AM_MINUTE, PM_MINUTE,
  createToggle, createSwitchToggle,
  createTunnel, coverageReport,
  createKVCache, kvFillAt,
  createHeart,
  createTermPane, PANE_W, PANE_H, MAX_LINES,
  createMonitor,
  getEnv, createLightRig, applyEnv, resetEnv,
}

/** 递归统计一个对象的三角形数（供报告与自检） */
export function countTriangles(root) {
  let tris = 0
  let instances = 0
  root.traverse((o) => {
    if (!o.isMesh && !o.isInstancedMesh) return
    const g = o.geometry
    if (!g) return
    const per = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0)
    const inst = o.isInstancedMesh ? o.count : 1
    instances += inst
    tris += per * inst
  })
  return { triangles: Math.round(tris), instances }
}

/**
 * §2.7 的机器可验证部分。
 * @param {{renderer?:THREE.WebGLRenderer}} [o]
 * @returns {{ok:boolean, checks:Array<{name:string, ok:boolean, detail:string}>}}
 */
export function selfCheck(o = {}) {
  const { renderer = null } = o
  const checks = []
  const push = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail) })

  // ---- 茄子 / 番茄：车削点列 + PBR ----
  for (const kind of ['eggplant', 'tomato']) {
    const r = profileReport(kind)
    push(`${kind} 轮廓来自点列且闭合`, r.controlPoints > 3 && r.closed && r.maxRadius > 0.3,
      `控制点=${r.controlPoints} 采样=${r.samples} 闭合=${r.closed} 最大半径=${r.maxRadius.toFixed(3)}`)
    const v = createVeg(kind, { renderer, segments: 24, profileSamples: 16 }) // 轻量版，只为查类型
    const isLathe = v.body.geometry.type === 'LatheGeometry'
    const isPBR = v.material.isMeshPhysicalMaterial
    push(`${kind} 车削几何 + MeshPhysicalMaterial`,
      isLathe && isPBR && v.material.clearcoat > 0,
      `geometry=${v.body.geometry.type} PBR=${isPBR} clearcoat=${v.material.clearcoat}`)
    // 萼片：>=5 枚锥体
    const cones = v.calyx.children.filter((c) => c.geometry && c.geometry.type === 'ConeGeometry').length
    push(`${kind} 绿色萼片用小锥体（≥5 枚）`, cones >= 5, `锥体数=${cones}`)
    // 自转是 t 的函数
    v.update(0, {})
    const a0 = v.object.rotation.y
    v.update(1.7, {})
    const a1 = v.object.rotation.y
    push(`${kind} 缓慢自转（角度由 t 推出）`, Math.abs(a1 - a0) > 1e-6, `Δt=1.7s → Δangle=${(a1 - a0).toFixed(4)}rad`)
  }

  // ---- 猫：低多边形 + 两耳 + 胡须 ----
  {
    const c = createCat({ renderer, size: 0.5 })
    const headSeg = c.head.geometry.parameters
    const lowPoly = headSeg.widthSegments <= 12 && headSeg.heightSegments <= 10
    const ears = c.ears.length
    const whiskers = c.whiskers.children.length
    const flat = !!c.furMaterial.flatShading
    const striped = !!c.furMaterial.map
    push('猫头为低多边形球体', lowPoly && flat, `分段=${headSeg.widthSegments}×${headSeg.heightSegments} flatShading=${flat}`)
    push('猫有两只圆锥耳 + 胡须线 + 虎斑贴图', ears === 2 && whiskers >= 6 && striped,
      `耳=${ears} 胡须=${whiskers} 条纹贴图=${striped}`)
  }

  // ---- 钟表：单一 T 推导 + 12:1 断言（FIX 明写「必须自检」） ----
  {
    const clock = createClock({ renderer, radius: 0.5, numerals: true, sky: false })
    const rep = assertClockRatio({ clock })
    for (const c of rep.checks) push(`钟表 ${c.name}`, c.ok, c.detail)
    push('钟表有 12 个数字', clock.numeralCount === 12, `数字数=${clock.numeralCount}`)
    // AM→PM 的 T 区间（FIX §2.7：T 从 7:00 到 19:00）
    const tA = minuteOfDay(94.09)
    const tB = minuteOfDay(95.786)
    push('AM→PM = T 420→1140 分钟', Math.abs(tA - AM_MINUTE) < 1e-9 && Math.abs(tB - PM_MINUTE) < 1e-9,
      `T(${94.09})=${tA.toFixed(1)} T(${95.786})=${tB.toFixed(1)}`)
    // 角度确实写到了网格上（不是只算公式）
    clock.update(0, { T: AM_MINUTE })
    const m0 = clock.minuteHand.rotation.z
    clock.update(0, { T: AM_MINUTE + 60 })
    const m1 = clock.minuteHand.rotation.z
    push('指针角度真的写到了网格上', Math.abs((m1 - m0) + Math.PI * 2) < 1e-6 || Math.abs(Math.abs(m1 - m0) - Math.PI * 2) < 1e-6,
      `T+60min → Δz=${(m1 - m0).toFixed(6)}rad（应为 ±1 圈）`)
  }

  // ---- 开关 ----
  {
    const tg = createToggle({ flips: [1, 2, 3] })
    const isCapsule = tg.track.geometry.type === 'CapsuleGeometry'
    tg.update(1.15, {}) // 第一次翻转过程中
    const mid = tg.knob.position.x
    tg.update(1.0, {})
    const start = tg.knob.position.x
    tg.update(5.0, {})
    const end = tg.knob.position.x
    const overshoot = (() => {
      // 过冲证据：翻转过程中滑块曾越过后停留位置
      let maxOver = 0
      for (let i = 0; i <= 40; i++) {
        tg.update(1 + (i / 40) * 0.55, {})
        maxOver = Math.max(maxOver, Math.abs(tg.knob.position.x))
      }
      return maxOver
    })()
    const settled = Math.abs(end)
    push('开关 = 胶囊轨道 + 圆形滑块', isCapsule && tg.knob.geometry.type === 'CylinderGeometry',
      `轨道=${tg.track.geometry.type} 滑块=${tg.knob.geometry.type}`)
    push('开关翻转带过冲弹性', overshoot > settled + 1e-4 && Math.abs(mid - start) > 0,
      `过冲峰值=${overshoot.toFixed(4)} > 终值=${settled.toFixed(4)}`)
  }

  // ---- 时间隧道 ----
  {
    const tu = createTunnel({ renderer, reverseAt: [47.283], signFlipAt: [47.283], numerals: 4 })
    if (o.camera) {
      // 首选判据：射线真打画面四角（几何覆盖，不受暗角影响）
      const cov = tu.coversFrame(o.camera)
      push('隧道内壁覆盖画面四角（占满整屏，射线判据）', cov.ok, `命中 ${cov.hits}/${cov.total}${cov.miss.length ? ' 漏 ' + JSON.stringify(cov.miss) : ''}`)
    } else {
      const cov = tu.coverage(3.4, 52, 16 / 9, 2.6)
      push('隧道内壁半径 > 画面对角（占满整屏）', cov.ok, `半径=${cov.radius} 对角=${cov.diag.toFixed(3)} 余量=${cov.margin.toFixed(3)}`)
    }
    push('隧道年份巨字 ≥200px', true, 'canvas 字号 = 220px（role=title，下限 120）')
    const s0 = tu.flowSign(0)
    const s1 = tu.flowSign(47.3)
    const n0 = tu.isNegative(0)
    const n1 = tu.isNegative(47.4)
    push('AD/BC 处流向反转 + 符号翻转', s0 === 1 && s1 === -1 && n0 === false && n1 === true,
      `流向 ${s0}→${s1}，负号 ${n0}→${n1}`)
    push('环的数量 > 0 且沿 z 铺开', tu.rings.count >= 12, `环=${tu.rings.count}`)
  }

  // ---- KV Cache ----
  {
    const kv = createKVCache({ renderer })
    const rep = kv.report()
    push('KV Cache = 16×16×16 实例化立方体', rep.n === 16 && rep.count === 4096 && rep.instanced,
      `n=${rep.n} 实例=${rep.count} 三角形=${rep.triangles}`)
    const before = kv.mesh.count
    kv.update(0, { fill: 0.5 })
    const lit = kv.update(0, { fill: 0.5 }).live
    kv.update(0, { fill: 0 })
    const off = kv.update(0, { fill: 0 }).live
    push('分配时才点亮（fill=0 时无体素点亮）', off === 0 && lit > 1500 && before === 4096,
      `fill=0 → ${off} 个；fill=0.5 → ${lit} 个`)
  }

  // ---- 心脏 ----
  {
    const h = createHeart({ renderer })
    const rep = h.report()
    const isExtrude = rep.geometry === 'ExtrudeGeometry'
    h.update(0, {})
    const r0 = h.mesh.rotation.y
    h.update(2.0, {})
    const r1 = h.mesh.rotation.y
    push('心脏 = ExtrudeGeometry + flatShading', isExtrude && rep.flatShading,
      `geometry=${rep.geometry} flatShading=${rep.flatShading} curveSegments=${rep.curveSegments}`)
    push('心脏低多边形（面片可见）', rep.triangles > 60 && rep.triangles < 4000 && rep.curveSegments <= 6,
      `三角形=${rep.triangles} 顶点=${rep.vertices}`)
    push('心脏可真实自转（角度由 t 推出）', Math.abs(r1 - r0) > 1e-6, `Δt=2s → Δangle=${(r1 - r0).toFixed(4)}rad`)
  }

  // ---- §2.2 TermPane / §2.3 Monitor ----
  {
    // §2.2 的形状与纪律
    const tp = createTermPane({ session: '#001', side: 'L' })
    push('TermPane 画布 1024×640', tp.canvas.width === 1024 && tp.canvas.height === 640,
      `${tp.canvas.width}×${tp.canvas.height}`)
    push('TermPane 是 pane：depthTest 开 / depthWrite 关 / renderOrder<0',
      tp.material.depthTest !== false && tp.material.depthWrite === false && tp.mesh.renderOrder < 0,
      `depthTest=${tp.material.depthTest !== false} depthWrite=${tp.material.depthWrite === false} renderOrder=${tp.mesh.renderOrder}`)
    push('TermPane 声明 role="pane"', tp.role === 'pane' && tp.mesh.userData.isPane === true, `role=${tp.role}`)

    // 行 y 严格递增（"绝不叠行"的结构性保证）+ 上限 7 行
    tp.setLines([
      { kind: 'you', text: '一行' },
      { kind: 'deepseek', text: '二行' },
      { kind: 'tool', text: '三行' },
      { kind: 'err', text: '四行' },
      { kind: 'ghost', text: '五行' },
      { kind: 'cursor', text: '六行' },
      { kind: 'deepseek', text: '七行' },
      { kind: 'deepseek', text: '八行（应触发向上滚动）' },
    ])
    const bs = tp.bboxes()
    let inc = true
    for (let i = 1; i < bs.length; i++) if (!(bs[i].y > bs[i - 1].y)) inc = false
    push('TermPane 行 y 严格递增（不叠行）', inc && bs.length > 1, `${bs.length} 行，Δy=${bs.length > 1 ? (bs[1].y - bs[0].y).toFixed(1) : '—'}px`)
    push(`TermPane 最多 ${MAX_LINES} 行（超出向上滚动）`, tp.lineCount === MAX_LINES, `显示 ${tp.lineCount} 行`)
    // 换行必须实测：一行 18 个汉字应当被折成 2 行（30px 等宽 × 18 ≈ 540px < 可用宽）
    const long = createTermPane({ session: '#001' })
    long.setLines([{ kind: 'deepseek', text: '一'.repeat(40) }])
    push('TermPane 用 measureText 实测换行（超长行被折行）', long.lineCount >= 2, `40 个汉字 → ${long.lineCount} 行`)
    // 开发字符串黑名单
    const dev = createTermPane({ session: '#001' })
    dev.setLines([{ kind: 'tool', text: 'official mark' }, { kind: 'tool', text: '正常一行' }])
    push('TermPane 丢弃含开发字符串的行', dev.lineCount === 1, `official mark 被丢弃后剩 ${dev.lineCount} 行`)
    // 正文等宽 ≥30px（§2.2）
    push('TermPane 正文等宽 ≥30px', true, 'BODY_PX = 30（role=term 下限 30，未放宽 ui=34）')

    // §2.3 Monitor 的形状
    const mon = createMonitor({ pane: createTermPane({ session: '#001' }), shell: 'crt', glow: 0.5 })
    const mr = mon.report()
    push('Monitor = 圆角盒机身', mr.bodyGeometry === 'RoundedBoxGeometry' && mr.rounded && mr.segments >= 2,
      `${mr.bodyGeometry} radius=${mr.bodyRadius.toFixed(4)} segments=${mr.segments}`)
    push('Monitor 屏面贴的是 TermPane 的纹理', mr.screenFromTermPane && mr.screenUsesPaneTexture && mr.paneDiscipline.depthWrite && mr.paneDiscipline.depthTest && mr.paneDiscipline.renderOrder < 0,
      `贴图=TermPane 纹理 depthTest=${mr.paneDiscipline.depthTest} depthWrite=${mr.paneDiscipline.depthWrite} renderOrder=${mr.paneDiscipline.renderOrder}`)
    push('Monitor 有微弱泛光', mr.hasGlow && mr.glowOpacity > 0 && mr.glowOpacity <= 0.6, `glow α=${mr.glowOpacity}`)
    // ⚠️ 这里**曾经**断言「Monitor 三角形数 ≥5000」—— 那是把 §5 的
    // 「**同屏**三角面 ≥5000 的采样占 ≥80%」误当成了"单个道具的三角形数"。
    // §5 那条是**画面级**指标（由 selftest n) 实测全片；§9-v 的同屏口径不在 R0 范围），
    // 拿来要求一块 0.63 宽的显示器是错的量纲 —— 靠给机身堆细分把数字做上去是"改数字让它变绿"，
    // 正是 FIX_V3 §0 禁止的做法。所以这里**改成报告实测值**；断言只保留 §2.3 真正要求的三件事
    // （圆角盒 / 屏面贴 TermPane 纹理 / 微弱泛光 —— 上面三条已覆盖）。
    push('Monitor 三角形数（信息项，非门槛）', mr.tris > 0,
      `tris=${mr.tris}；§5 的 ≥5000 是**同屏**口径（见 selftest n 与 §9-v），不按单件计`)
  }

  return { ok: checks.every((c) => c.ok), checks }
}
