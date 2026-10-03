// tools/dialogue_calib.mjs — 台词表锚点校准（FIX_V3.md §3）
//
// 为什么需要它：§3 要求「锚点词以 tools/words.mjs 实测为准」，而上一轮的
// `src/data/dialogue.js` 里的秒数**不是**实测值（最离谱的差 3.1s，详见注释里的实测对照）。
// 但要注意 words.mjs 打印的是**句子 t0**，不是**词起唱时间** —— 直接照抄那一列就会系统性偏晚。
// 本工具按 `anchors.js` 里声明的 kind/text/nth/loose 语义，去 lyrics.json 里查**真正的词时间**，
// 于是"表里写的"和"实测的"可以直接对齐。
//
// 用法：
//   node tools/dialogue_calib.mjs            # 打印每个台词锚点的实测时间
//   node tools/dialogue_calib.mjs --check    # 额外断言 dialogue.js 引用的锚点 key 都真实存在（退出码非 0 = 有错）

import { readFileSync } from 'node:fs'

const ROOT = process.cwd()
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const lyrics = readJson(`${ROOT}/public/data/lyrics.json`)
/** 节拍/起音点网格（§4.3：纯器乐段用 beat/onset 锚点） */
const analysis = readJson(`${ROOT}/public/data/analysis.json`)

/** 展平成词表（只保留词时间；句子 t0 另有用途） */
const words = []
for (const s of lyrics) {
  for (const w of s.words) words.push({ t: w.t, w: String(w.w).trim(), line: s.i })
}
words.sort((a, b) => a.t - b.t)

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * 与 src/core/cues.js 的 findWord 同语义，但**修掉了宽松匹配的过宽**：
 * cues.js 的 loose 判据是 `got.includes(want) || want.includes(got)`，
 * 于是 `want="nutrient"` 会命中 `got="i"`（"i" 是 "nutrient" 的子串）→ 锚点落到 75.904 的 "I" 上。
 * 实测就是这么错的：`F.nutrient` 解析到 75.904（应是 77.059）、`H.vibrations` 解析到 103.954（应是 106.256）、
 * `I.challenging` 解析到 118.782（应是 125.675）。
 * 这里加**最短长度门槛**：只有当两个串都 ≥ MIN_LOOSE 个字符时才允许包含匹配。
 */
const MIN_LOOSE = 4
function findWord(text, from, to, nth = 1, loose = false) {
  const want = norm(text)
  if (!want) return null
  let n = 0
  for (const w of words) {
    if (w.t < from - 0.001 || w.t > to + 0.001) continue
    const got = norm(w.w)
    if (!got) continue
    const hit = loose
      ? got.length >= MIN_LOOSE && want.length >= MIN_LOOSE && (got.includes(want) || want.includes(got))
      : got === want
    if (!hit) continue
    n++
    if (n === nth) return w
  }
  return null
}

/* ---------- 段边界（与 mapping.mjs 同源解析） ---------- */
const ids = ['a_boot', 'b_dive', 'c_define', 'd_switch', 'e_deal', 'f_omnipotent', 'g_glitch', 'h_absence', 'i_cleanup', 'j_overflow', 'k_storm', 'l_training', 'm_algebra', 'n_handoff']
const segRanges = {}
for (const f of ids) {
  const src = readFileSync(`${ROOT}/src/scenes/${f}.js`, 'utf8')
  const id = /id:\s*'([A-N])'/.exec(src)
  const st = /start:\s*([\w.]+)/.exec(src)
  const en = /end:\s*([\w.]+)/.exec(src)
  if (!id || !st || !en) continue
  const numOf = (expr) => {
    const lit = /^([\d.]+)$/.exec(String(expr).trim())
    if (lit) return parseFloat(lit[1])
    const c = new RegExp(`const\\s+${String(expr).trim()}\\s*=\\s*([\\d.]+)`).exec(src)
    return c ? parseFloat(c[1]) : null
  }
  const a = numOf(st[1])
  const b = numOf(en[1])
  if (a != null && b != null) segRanges[id[1]] = { start: a, end: b }
}

/* ---------- 解析 anchors.js（正则，避免 import 前端模块） ---------- */
const anchorsSrc = readFileSync(`${ROOT}/src/scenes/anchors.js`, 'utf8')
const anchors = {}
{
  const segBlock = /^\s{2}([A-N]):\s*\{([\s\S]*?)^\s{2}\},/gm
  let m
  while ((m = segBlock.exec(anchorsSrc))) {
    const seg = m[1]
    anchors[seg] = {}
    const keyRe = /(\w+):\s*\{([^}]*)\}/g
    let k
    while ((k = keyRe.exec(m[2]))) {
      const b = k[2]
      const get = (name) => {
        const r = new RegExp(`${name}:\\s*(?:'([^']*)'|([\\d.]+)|(\\w+))`).exec(b)
        return r ? (r[1] !== undefined ? r[1] : r[2] !== undefined ? parseFloat(r[2]) : r[3]) : undefined
      }
      anchors[seg][k[1]] = {
        kind: get('kind'),
        text: get('text'),
        nth: get('nth') || 1,
        event: get('event') || '',
        lead: get('lead') || 0.3,
        loose: /loose:\s*true/.test(b),
        idx: get('idx') != null ? parseInt(get('idx'), 10) : undefined,
        t: get('t') != null ? parseFloat(get('t')) : undefined,
      }
    }
  }
}

/** 解析某锚点的**实测时间**；beat/onset 需要 sync，这里返回 null 并注明 */
export function resolveAnchor(seg, key) {
  const a = anchors[seg] && anchors[seg][key]
  if (!a) return { ok: false, reason: '锚点不存在' }
  const r = segRanges[seg]
  const from = r ? r.start : 0
  const to = r ? r.end : 9999
  if (a.kind === 'word') {
    const w = findWord(a.text, from, to, a.nth, a.loose)
    if (!w) return { ok: false, reason: `段窗口 [${from},${to}] 内找不到词 "${a.text}"#${a.nth}` }
    return { ok: true, t: w.t, via: `词 "${w.w}" #${w.line}` }
  }
  if (a.kind === 'line') {
    const s = lyrics.find((x) => x.i === a.idx)
    if (!s) return { ok: false, reason: `没有第 ${a.idx} 句` }
    return { ok: true, t: s.t0, via: `句 #${a.idx} t0` }
  }
  if (a.kind === 'fixed') return { ok: true, t: a.t, via: '固定时刻' }
  if (a.kind === 'beat') {
    const list = analysis.beats.filter((t) => t >= from && t < to)
    const v = list[(a.nth || 1) - 1]
    return v == null ? { ok: false, reason: `段窗口 [${from},${to}] 内只有 ${list.length} 拍` } : { ok: true, t: v, via: `第 ${a.nth} 拍（共 ${list.length}）` }
  }
  if (a.kind === 'onset') {
    const list = (analysis.onsets || []).map((o) => (typeof o === 'number' ? { t: o, s: 1 } : o)).filter((o) => o.t >= from && o.t < to).sort((x, y) => y.s - x.s)
    const v = list[(a.nth || 1) - 1]
    return v == null ? { ok: false, reason: `段窗口 [${from},${to}] 内没有起音点` } : { ok: true, t: v.t, via: `第 ${a.nth} 强起音点（共 ${list.length}）` }
  }
  return { ok: false, reason: `${a.kind} 类未知` }
}

/* ---------- 解析 dialogue.js 里引用的 (seg, anchor) ---------- */
const dlgSrc = readFileSync(`${ROOT}/src/data/dialogue.js`, 'utf8')
const refs = []
{
  const re = /\{\s*seg:\s*'([A-N])',\s*anchor:\s*'([^']+)'/g
  let m
  while ((m = re.exec(dlgSrc))) refs.push({ seg: m[1], key: m[2] })
}

if (process.argv.includes('--check') || process.argv.length <= 2) {
  console.log('== dialogue.js 锚点校准 ==')
  console.log(`台词条数（按 seg+anchor 计）：${refs.length}`)
  const missing = []
  const rows = []
  for (const r of refs) {
    const res = resolveAnchor(r.seg, r.key)
    if (!res.ok) missing.push({ ...r, reason: res.reason })
    rows.push({ ...r, ...res })
  }
  for (const r of rows) {
    console.log(
      `  ${r.seg}.${r.key.padEnd(14)} ${r.ok ? r.t.toFixed(3).padStart(8) : '       —'}  ${r.ok ? r.via : '⚠ ' + r.reason}`
    )
  }
  console.log('')
  console.log(`--- 无法解析的引用：${missing.length} ---`)
  for (const m of missing) console.log(`  ⚠ ${m.seg}.${m.key} —— ${m.reason}`)
  if (process.argv.includes('--check') && missing.length) process.exit(1)
}

/** 汇总：段 → key → 实测时间（供 mapping.mjs / ORPHANS.md 复用） */
export function allAnchors() {
  const out = {}
  for (const seg of Object.keys(anchors)) {
    out[seg] = {}
    for (const key of Object.keys(anchors[seg])) out[seg][key] = { spec: anchors[seg][key], ...resolveAnchor(seg, key) }
  }
  return out
}
export { anchors, segRanges, words }
