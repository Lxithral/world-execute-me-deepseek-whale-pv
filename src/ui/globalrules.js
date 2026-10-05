/**
 * T42 全局规则判据（FIX_V5 §G2–G6、§G9）
 *
 * 这些规则是**全片**级的，所以判据必须能在「任一帧」上求值，并且要能被两处复用：
 *   · `?selftest` 的 g2/g3/g4/g5/g6/g9 项（`src/main.js`）
 *   · `?probe=global` 全片扫描（同上，供 CI / 人工复核）
 * 因此这里只放**纯函数**：不碰 DOM、不碰 THREE（场景遍历只读对象的公开字段：
 * `name / visible / parent / children / geometry.type`），输入输出都是可 JSON 序列化的普通值。
 *
 * 规则出处（FIX_V5.md:11–18、:96）：
 *   G2 屏幕上除歌词层外不再出现刻意的中文标签与中文对话；结尾署名页删「界面致敬 DeepSeek Harness」。
 *   G3 每个曲线/心形/圆等主体在任一帧只允许存在一份（按对象名统计，重名主体 >1 = FAIL）。
 *   G4 任何带「拨杆 / 摇杆」的 3D 模型不得出现。
 *   G5 所有舞台文字 x∈[5%,95%]、y∈[8%,80%]，不得被边缘裁切。
 *   G6 整屏亮度交替频率 ≤2.5Hz；配色交替只改色相，不得大幅改变亮度。
 *   G9 全片不得出现「太阳」图形（圆盘 + 放射线），按对象名 + 结构检查。
 */

/** 汉字（基本区 + 扩展 A + 兼容区）。注：CJK 标点（、。「」…）不在内，单独由 §G2 的文案判定。 */
export const HAN_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

/** G5 安全区（占画面宽高的比例），与 FIX_V5 §G5 一致。 */
export const SAFE_AREA = { x0: 0.05, x1: 0.95, y0: 0.08, y1: 0.8 }

/** G4 名字判据（形状判据在 leverModels 里另算）。 */
export const LEVER_RE = /lever|joystick|摇杆|拨杆/i

/** G9 名字判据：`sun` 作为名字的一段（`prop:clock:sun`、`sunMoon`、`sunDisc` 都命中）。 */
export const SUN_RE = /(^|[:_.-])sun/i

/**
 * G2 的豁免清单（**文本白名单**，不是整段时间豁免）：
 *   · `上善`：片尾 CC 署名里的**专有人名** —— 「作者名」不是「中文标签/中文对话」；
 *   · `六`：K 段「六种书写系统 1–6」（1 DE eins … 6 ZH 六）计数卡里的汉字数词 —— 那是**内容**
 *     （该拍本身要求并列展示六种文字），不是标签/对话；改成拼音反而丢掉这一拍的设计。
 * 用文本白名单而不是「整段时间豁免」：以后往这些位置再加中文标签仍会被 G2 抓到。
 */
export const G2_ALLOW_TEXT = [/上善/, /^六$/]

/** G6 频率上限（Hz）。 */
export const ALT_FREQ_MAX = 2.5

/** 对象自身与所有祖先都 visible 才算「在画面里」。 */
export function isVisible(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return false
  return true
}

/** 粒子/线条/精灵/灯光/相机/实例化网格都不是「主体」——G3 只统计实打实的网格。 */
export function isSubject(o) {
  if (!o || !o.isObject3D) return false
  if (o.isPoints || o.isLine || o.isLineSegments || o.isSprite || o.isInstancedMesh) return false
  if (o.isLight || o.isCamera) return false
  if (!o.geometry || !o.geometry.type) return false
  return true
}

/**
 * G2：本帧登记的文字包围盒里，除歌词层外还有哪些含汉字（`G2_ALLOW_TEXT` 白名单除外）。
 * `ghost`（§2.8 允许的残影，与主文字同文案）不参与判定。
 */
export function cjkTexts(boxes, { lyricLayers = ['lyrics'], allow = G2_ALLOW_TEXT } = {}) {
  const out = []
  for (const b of boxes) {
    if (b.ghost) continue
    if (lyricLayers.includes(b.layer)) continue
    const text = b.text || ''
    if (!HAN_RE.test(text)) continue
    if (allow.some((re) => re.test(text))) continue
    out.push(b)
  }
  return out
}

/**
 * G5：舞台文字是否越出安全区。
 * `skipLayers` 默认排除 `lyrics`：FIX_V5 §G5 说的是「**舞台**文字」，而歌词是字幕层 ——
 * 它**贴底是设计**（§2.8 的卡拉OK 基线就在 y≈9 成处），G2 也单独把歌词层摘出来了。
 * 判定口径：文字包围盒的四边与 [5%,95%]×[8%,80%] 的差，>0 即越界（含 `ghost` 残影不算）。
 */
export function safeAreaViolations(boxes, W, H, { skipLayers = ['lyrics'] } = {}) {
  const out = []
  for (const b of boxes) {
    if (b.ghost) continue
    if (skipLayers.includes(b.layer)) continue
    const x0 = b.x / W
    const x1 = (b.x + b.w) / W
    const y0 = b.y / H
    const y1 = (b.y + b.h) / H
    const over = []
    if (x0 < SAFE_AREA.x0) over.push(`left ${((SAFE_AREA.x0 - x0) * 100).toFixed(1)}%`)
    if (x1 > SAFE_AREA.x1) over.push(`right ${((x1 - SAFE_AREA.x1) * 100).toFixed(1)}%`)
    if (y0 < SAFE_AREA.y0) over.push(`top ${((SAFE_AREA.y0 - y0) * 100).toFixed(1)}%`)
    if (y1 > SAFE_AREA.y1) over.push(`bottom ${((y1 - SAFE_AREA.y1) * 100).toFixed(1)}%`)
    if (over.length) {
      out.push({
        layer: b.layer, role: b.role, text: b.text,
        x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h),
        fx0: +x0.toFixed(4), fx1: +x1.toFixed(4), fy0: +y0.toFixed(4), fy1: +y1.toFixed(4),
        over,
      })
    }
  }
  return out
}

/**
 * G3：同名「主体」在同一帧里出现 >1 次即重名。
 * 返回按出现次数降序的 `[{ name, count, kinds }]`；空数组 = 唯一。
 */
export function duplicateSubjects(root) {
  const m = new Map()
  root.traverse((o) => {
    if (!o.name || !isSubject(o) || !isVisible(o)) return
    const e = m.get(o.name) || { name: o.name, count: 0, kinds: new Set() }
    e.count++
    e.kinds.add(o.geometry.type)
    m.set(o.name, e)
  })
  return [...m.values()]
    .filter((e) => e.count > 1)
    .map((e) => ({ name: e.name, count: e.count, kinds: [...e.kinds] }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1))
}

const CAPSULE_RE = /Capsule|Cylinder/
const KNOB_RE = /Sphere|Icosahedron|Dodecahedron/

function worldPos(o, out) {
  const e = o.matrixWorld.elements
  out[0] = e[12]
  out[1] = e[13]
  out[2] = e[14]
  return out
}

/**
 * G4：带「拨杆 / 摇杆」的 3D 模型。
 * 两条判据（任一命中即算）：
 *   ① 名字里有 lever / joystick / 摇杆 / 拨杆；
 *   ② 形状签名：一根可见的胶囊/细圆柱（杆），同一父节点下还有一个球状「圆头」落在杆的自由端。
 * ② 是为了抓 g_glitch 那种**没有命名**的摇杆：`this.lever` 是匿名 Group，里面
 * `CapsuleGeometry(0.055,0.42)` 的 stick + 顶端的 knob 球。
 */
export function leverModels(root) {
  const out = []
  const named = new Set()
  const p = [0, 0, 0]
  const q = [0, 0, 0]
  root.traverse((o) => {
    if (!isVisible(o)) return
    if (o.name && LEVER_RE.test(o.name) && !named.has(o)) {
      named.add(o)
      out.push({ name: o.name, geo: o.geometry ? o.geometry.type : 'Group', why: 'name' })
    }
    if (!isSubject(o) || !CAPSULE_RE.test(o.geometry.type) || !o.parent) return
    const pars = o.geometry.parameters || {}
    // 注意 three r180 的 CapsuleGeometry.parameters 是 `height`（不是 `length`）：
    // 旧写法只读 `pars.length` → 胶囊被算成 len=0 而整条跳过（g_glitch 的摇杆就是这么漏掉的）。
    const len =
      pars.length != null
        ? pars.length + 2 * (pars.radius || 0)
        : pars.height != null
          ? pars.height + 2 * (pars.radius || 0)
          : 0
    const rad = pars.radiusTop != null ? Math.max(pars.radiusTop, pars.radiusBottom || 0) : pars.radius || 0
    if (!(len > rad * 2)) return
    worldPos(o, p)
    const e = o.matrixWorld.elements
    const ax = [e[4], e[5], e[6]] // 世界 Y 轴（杆的走向）
    const al = Math.hypot(ax[0], ax[1], ax[2]) || 1
    const tipA = [p[0] + (ax[0] / al) * (len / 2), p[1] + (ax[1] / al) * (len / 2), p[2] + (ax[2] / al) * (len / 2)]
    const tipB = [p[0] - (ax[0] / al) * (len / 2), p[1] - (ax[1] / al) * (len / 2), p[2] - (ax[2] / al) * (len / 2)]
    for (const sib of o.parent.children) {
      if (sib === o || !isVisible(sib) || !sib.geometry || !KNOB_RE.test(sib.geometry.type)) continue
      worldPos(sib, q)
      const dA = Math.hypot(q[0] - tipA[0], q[1] - tipA[1], q[2] - tipA[2])
      const dB = Math.hypot(q[0] - tipB[0], q[1] - tipB[1], q[2] - tipB[2])
      const d = Math.min(dA, dB)
      if (d <= rad * 2 + len * 0.25) {
        out.push({
          name: o.parent.name || o.name || '(unnamed)',
          geo: `${o.geometry.type}+${sib.geometry.type}`,
          why: 'capsule+knob',
          at: [+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3)],
        })
        break
      }
    }
  })
  return out
}

/**
 * G9：「太阳」图形 = 圆盘/球 + 放射线。
 *   ① 名字含 `sun`（`prop:clock:sun` / `sunMoon` / `sunDisc` …）；
 *   ② 结构：同一父节点下有 ≥1 个圆盘/球，且有 ≥6 根锥/盒/柱状「放射线」。
 * ② 抓 e_deal 的 `e:orb`（金宝珠 + 12 根射线锥）。
 */
export function sunStructures(root) {
  const out = []
  const seen = new Set()
  root.traverse((o) => {
    if (!isVisible(o)) return
    if (o.name && SUN_RE.test(o.name) && !seen.has(o.name)) {
      seen.add(o.name)
      out.push({ name: o.name, geo: o.geometry ? o.geometry.type : 'Group', why: 'name' })
    }
  })
  root.traverse((o) => {
    if (!isVisible(o) || !o.children || o.children.length < 7) return
    let disc = 0
    const rays = []
    for (const k of o.children) {
      if (!k.geometry || !isVisible(k)) continue
      const t = k.geometry.type || ''
      if (/^(Circle|Ring|Sphere|Icosahedron|Cylinder)/.test(t)) disc++
      if (/^(Cone|Box|Cylinder)/.test(t)) rays.push(k)
    }
    if (disc >= 1 && rays.length >= 6) {
      const nm = o.name || '(unnamed)'
      if (seen.has(nm)) return
      seen.add(nm)
      out.push({ name: nm, geo: `${disc}disc+${rays.length}rays`, why: 'disc+rays' })
    }
  })
  return out
}

/**
 * G6：整屏亮度序列的交替频率。
 *
 * 做法：**施密特触发**式数穿越——只有幅度超过滞回带（`hyst ×` 全局摆幅）的来回才算一次
 * 交替，否则粒子闪烁那种零均值噪声会被误判成高频（实测裸数零穿越会得出几十 Hz）。
 * 返回值里 `f` 是全片平均交替频率，`maxF`/`maxSwing` 是 2s 滑窗内的最坏值（G6 看这个）。
 */
export function alternationFrequency(series, dt, { winSeconds = 2, hyst = 0.25, minSwing = 0.02 } = {}) {
  const n = series.length
  if (n < 4) return { n, f: 0, maxF: 0, swing: 0, maxSwing: 0, level: 0, cycles: 0 }
  let sum = 0
  let lo = Infinity
  let hi = -Infinity
  for (const v of series) {
    sum += v
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const mean = sum / n
  const swing = hi - lo
  const band = Math.max(swing * hyst, 0.002)
  const state = (v) => (v > mean + band ? 1 : v < mean - band ? -1 : 0)
  let cycles = 0
  let cur = state(series[0])
  if (cur === 0) cur = 1
  for (let i = 1; i < n; i++) {
    const s = state(series[i])
    if (s !== 0 && s !== cur) {
      cycles++
      cur = s
    }
  }
  const span = (n - 1) * dt
  const f = span > 0 ? cycles / 2 / span : 0
  // 2s 滑窗最坏值
  const w = Math.max(4, Math.round(winSeconds / dt))
  let maxF = 0
  let maxSwing = 0
  let worstAt = 0
  for (let i = 0; i + w <= n; i++) {
    let z = 0
    let l = Infinity
    let h = -Infinity
    let c = state(series[i])
    if (c === 0) c = 1
    for (let j = i + 1; j < i + w; j++) {
      const v = series[j]
      if (v < l) l = v
      if (v > h) h = v
      const s = state(v)
      if (s !== 0 && s !== c) {
        z++
        c = s
      }
    }
    const wf = z / 2 / ((w - 1) * dt)
    const ws = h - l
    if (wf > maxF) {
      maxF = wf
      worstAt = i * dt
    }
    if (ws > maxSwing) maxSwing = ws
  }
  // 有效交替 = 摆幅够大且频率超限的事件，供报告定位
  return {
    n,
    dt: +dt.toFixed(5),
    mean: +mean.toFixed(5),
    swing: +swing.toFixed(5),
    f: +f.toFixed(3),
    cycles,
    maxF: +maxF.toFixed(3),
    maxSwing: +maxSwing.toFixed(5),
    worstAt: +worstAt.toFixed(2),
    bigSwing: swing >= minSwing,
  }
}
