// src/core/cues.js — 歌词词锚点系统（FIX.md §2.2）
//
// 规则（§2.2 原话）：
//   · 所有非纯器乐段落的事件，一律写成「锚点 + 偏移」；
//   · 视觉「到位」时间 = 该词起唱时间（偏移 0）；动作启动 = 提前 0.25–0.4s（预备）；
//   · DIRECTOR.md 里的绝对秒数只作粗略参考，冲突时以歌词词时间为准；
//   · 纯器乐段落（0:14.5–0:29.7、2:09–2:27.9、3:13–3:25.9）用 beats/onsets 网格 + 段落起止。
//
// 锚点分四类：
//   line   — 直接取某一句的 t0（用于词被拆开的句子，如 "lo-o-ove"）
//   word   — 在指定段的时间窗内找第 nth 个匹配词，取它的起唱时间
//   beat   — 指定段内第 nth 个 beat（器乐段）
//   onset  — 指定段内第 nth 个 onset（器乐段，按强度从高到低取）
//
// 「消费」追踪：场景必须通过 cues.t(seg, key) 取时间，取过就算 consumed。
// selftest g) 会检查 (1) 每个锚点的实际时间与歌词/节拍重查结果差 ≤120ms，
// (2) 每个段落至少有一个**被真正消费**的锚点（防止场景仍用硬编码秒数）。

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * 宽松匹配的最短长度门槛（修 bug，见 docs/CHECKPOINT.md）。
 *
 * 原来的判据是 `got.includes(want) || want.includes(got)`，**没有长度下限** —— 于是
 * `want = "nutrient"` 会命中 `got = "i"`（"i" 是 "nutrient" 的子串）。
 * 实测后果（tools/dialogue_calib.mjs 报出来的）：
 *   F.nutrient    解析到 75.904（词 "I"）/ 应为 77.059（"nutrients"）
 *   H.vibrations  解析到 103.954（词 "I"）/ 应为 106.256（"vibrations"）
 *   I.challenging 解析到 118.782（词 "I"）/ 应为 125.675（"Challenging"）
 * 即：整段锚点会**静默**落到一个错误的词上，而 g) 的对齐断言查不出来（它按同一套规则重查）。
 * 现在要求两个串都 ≥4 字符才允许包含匹配。
 */
const MIN_LOOSE = 4

export function createCues({ lyrics, sync }) {
  /** @type {Array<object>} */
  const registry = []
  const bySeg = new Map()

  function push(rec) {
    registry.push(rec)
    if (!bySeg.has(rec.seg)) bySeg.set(rec.seg, [])
    bySeg.get(rec.seg).push(rec)
    return rec
  }

  /** 段落时间窗 */
  function winOf(seg, from, to) {
    if (from != null || to != null) return [from ?? -Infinity, to ?? Infinity]
    if (seg && bySeg.has('__bounds__')) {
      const b = bySeg.get('__bounds__').find((x) => x.seg === seg)
      if (b) return [b.t0, b.t1]
    }
    return [-Infinity, Infinity]
  }

  let bounds = {} // segId -> [t0, t1]

  /** 由 main.js 在 init 前注入段落边界，供 word() 在段内查找 */
  function setBounds(map) {
    bounds = map || {}
  }

  /** 某句的 t0 */
  function line(idx) {
    const s = lyrics[idx]
    return s ? s.t0 : null
  }

  /** 在段 [from,to] 内找第 nth 个匹配词 */
  function findWord(text, { from = -Infinity, to = Infinity, nth = 1, loose = false } = {}) {
    const want = norm(text)
    let n = 0
    for (const s of lyrics) {
      for (let wi = 0; wi < s.words.length; wi++) {
        const w = s.words[wi]
        if (w.t < from || w.t > to) continue
        const got = norm(w.w)
        const hit = loose
          ? got.length >= MIN_LOOSE && want.length >= MIN_LOOSE && (got.includes(want) || want.includes(got))
          : got === want
        if (!hit || !got) continue
        n++
        if (n === nth) return { t: w.t, lineIdx: s.i, wordIdx: wi, word: String(w.w).trim() }
      }
    }
    return null
  }

  /** 段内第 nth 个 beat */
  function findBeat(seg, nth = 1) {
    const [a, b] = bounds[seg] || [-Infinity, Infinity]
    const list = sync.beats.filter((t) => t >= a && t < b)
    const capped = nth === -1 ? list[list.length - 1] : list[nth - 1]
    return capped == null ? null : { t: capped }
  }

  /** 段内第 nth 个 onset（按强度降序） */
  function findOnset(seg, nth = 1) {
    const [a, b] = bounds[seg] || [-Infinity, Infinity]
    const list = sync.onsets.filter((o) => o.t >= a && o.t < b).sort((x, y) => y.s - x.s)
    const it = list[nth - 1]
    return it ? { t: it.t, strength: it.s } : null
  }

  /**
   * 声明一个锚点。
   * spec: { kind:'line'|'word'|'beat'|'onset', text?, idx?, nth?, lead?, event?, source? }
   * 返回记录 { seg, key, event, t, start, lead, kind, resolved, ref }
   */
  function declare(seg, key, spec) {
    const lead = spec.lead ?? 0.3
    const [a, b] = bounds[seg] || [-Infinity, Infinity]
    let t = null
    let ref = null
    if (spec.kind === 'line') {
      t = line(spec.idx)
      ref = { lineIdx: spec.idx }
    } else if (spec.kind === 'word') {
      const f = findWord(spec.text, {
        from: spec.from ?? a,
        to: spec.to ?? b,
        nth: spec.nth ?? 1,
        loose: spec.loose === true,
      })
      if (f) {
        t = f.t
        ref = f
      }
    } else if (spec.kind === 'beat') {
      const f = findBeat(seg, spec.nth ?? 1)
      if (f) {
        t = f.t
        ref = f
      }
    } else if (spec.kind === 'onset') {
      const f = findOnset(seg, spec.nth ?? 1)
      if (f) {
        t = f.t
        ref = f
      }
    } else if (spec.kind === 'fixed') {
      // 仅用于段落边界（如段首）——不是词/节拍锚点，不参与 g) 的对齐断言
      t = spec.t
      ref = { fixed: true }
    }
    const rec = {
      seg,
      key,
      event: spec.event || key,
      kind: spec.kind,
      spec,
      t,
      lead,
      start: t == null ? null : Math.max(0, t - lead),
      resolved: t != null,
      used: false,
      ref,
    }
    return push(rec)
  }

  /** 批量声明：table = { seg: { key: spec } } */
  function declareAll(table) {
    for (const [seg, entries] of Object.entries(table)) {
      for (const [key, spec] of Object.entries(entries)) declare(seg, key, spec)
    }
    return registry
  }

  /** 取锚点时间（**消费**）。返回 {t, start, event, seg, key}；未解析返回 null 并记录。 */
  function t(seg, key) {
    const rec = (bySeg.get(seg) || []).find((r) => r.key === key)
    if (!rec) return null
    rec.used = true
    return rec
  }

  /** 只取秒数（未解析时回退 fallback，便于渐进迁移） */
  function sec(seg, key, fallback = 0) {
    const rec = t(seg, key)
    return rec && rec.t != null ? rec.t : fallback
  }

  /** 动作启动时间（锚点 − lead） */
  function start(seg, key, fallback = 0) {
    const rec = t(seg, key)
    return rec && rec.start != null ? rec.start : fallback
  }

  /** g) 的对齐断言数据：重查每个锚点，算出 |t − 重查值| */
  function audit(tol = 0.12) {
    const rows = []
    for (const r of registry) {
      let again = null
      const sp = r.spec || {}
      const [a, b] = bounds[r.seg] || [-Infinity, Infinity]
      if (r.kind === 'line') again = line(sp.idx)
      else if (r.kind === 'word') {
        const f = findWord(sp.text, {
          from: sp.from ?? a,
          to: sp.to ?? b,
          nth: sp.nth ?? 1,
          loose: sp.loose === true,
        })
        again = f ? f.t : null
      } else if (r.kind === 'beat') again = findBeat(r.seg, sp.nth ?? 1)?.t
      else if (r.kind === 'onset') again = findOnset(r.seg, sp.nth ?? 1)?.t
      else if (r.kind === 'fixed') again = sp.t
      const diff = r.t == null || again == null ? null : Math.abs(r.t - again)
      rows.push({ ...r, recheck: again, diff })
    }
    return rows
  }

  return {
    setBounds,
    line,
    findWord,
    findBeat,
    findOnset,
    declare,
    declareAll,
    t,
    sec,
    start,
    all: () => registry,
    bySeg: (seg) => bySeg.get(seg) || [],
    audit,
    get bounds() {
      return bounds
    },
  }
}
