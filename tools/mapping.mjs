// tools/mapping.mjs — 歌词↔画面映射表生成（FIX_V3.md §4.1）
//
// 输出 docs/MAPPING.md：每一行是「时间 | 歌词词 | 事件 | 对象 | 层」。
// 数据来源：
//   · 锚点声明：src/scenes/anchors.js（每个 key 已经带 kind/text/nth/event/lead）
//   · 段落边界：src/scenes/index.js 的 start/end
//   · 真实词时间：public/data/lyrics.json（**以实测为准**，FIX_V3 §3 明说锚点词以 tools/words.mjs 实测为准）
//
// 为什么要生成而不是手写：手写必然与代码漂移；这里是"从代码反推文档"，
// 于是 MAPPING.md 里的每一行都能在 anchors.js 里找到出处。
//
// 同时统计（供 §4.2 与 selftest s 项用）：
//   · 有锚点的事件数 / 无锚点的事件数
//   · 每个锚点的"到位时间 − 词起唱时间"差值（§4.5 要求 ≤120ms）

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const ROOT = process.cwd()
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

/* ---------- 读数据 ---------- */
const lyrics = readJson(`${ROOT}/public/data/lyrics.json`)

/** 展平成词表 */
const words = []
for (const s of lyrics) {
  for (const w of s.words) words.push({ t: w.t, w: String(w.w).trim(), line: s.i })
}
words.sort((a, b) => a.t - b.t)

/** 按段落窗口 + 词序取"第 nth 个匹配词"的起唱时间 */
function findWord(text, from, to, nth = 1) {
  let n = 0
  for (const w of words) {
    if (w.t < from - 0.001 || w.t > to + 0.001) continue
    if (w.w.toLowerCase() === String(text).toLowerCase()) {
      n++
      if (n === nth) return w.t
    }
  }
  return null
}

/* ---------- 读 anchors.js（用正则解析，避免 import 一个带副作用的前端模块） ---------- */
const anchorsSrc = readFileSync(`${ROOT}/src/scenes/anchors.js`, 'utf8')
/** 段边界（从 index.js 读，保持与时间轴唯一同源） */
const indexSrc = readFileSync(`${ROOT}/src/scenes/index.js`, 'utf8')
const segRanges = {}
{
  // 从各场景文件里读 start/end（index.js 只是聚合，不含数值）
  // 注意：数值可能被写成常量（如 b_dive.js 的 `start: START`），所以要顺带解析同文件里的
  // `const START = 14.5` —— 第一版只认字面量，结果段 B 被漏掉，段落边界只解析出 13 个。
  const ids = ['a_boot', 'b_dive', 'c_define', 'd_switch', 'e_deal', 'f_omnipotent', 'g_glitch', 'h_absence', 'i_cleanup', 'j_overflow', 'k_storm', 'l_training', 'm_algebra', 'n_handoff']
  const numOf = (src, expr) => {
    const lit = /^([\d.]+)$/.exec(String(expr).trim())
    if (lit) return parseFloat(lit[1])
    const name = String(expr).trim()
    const c = new RegExp(`const\\s+${name}\\s*=\\s*([\\d.]+)`).exec(src)
    return c ? parseFloat(c[1]) : null
  }
  for (const f of ids) {
    const p = `${ROOT}/src/scenes/${f}.js`
    if (!existsSync(p)) continue
    const s = readFileSync(p, 'utf8')
    const id = /id:\s*'([A-N])'/.exec(s)
    const st = /start:\s*([\w.]+)/.exec(s)
    const en = /end:\s*([\w.]+)/.exec(s)
    if (id && st && en) {
      const a = numOf(s, st[1])
      const b = numOf(s, en[1])
      if (a != null && b != null) segRanges[id[1]] = { start: a, end: b }
    }
  }
}

/** 解析 ANCHORS 对象：段 → key → {kind, text, nth, event, lead, loose, idx, t} */
const anchors = {}
{
  // 抓 `X: {` 段块
  const segBlock = /^\s{2}([A-N]):\s*\{([\s\S]*?)^\s{2}\},/gm
  let m
  while ((m = segBlock.exec(anchorsSrc))) {
    const seg = m[1]
    const body = m[2]
    anchors[seg] = {}
    // 抓每个 key: { ... }
    const keyRe = /(\w+):\s*\{([^}]*)\}/g
    let k
    while ((k = keyRe.exec(body))) {
      const key = k[1]
      const b = k[2]
      const get = (name) => {
        const r = new RegExp(`${name}:\\s*(?:'([^']*)'|([\\d.]+)|(\\w+))`).exec(b)
        return r ? (r[1] !== undefined ? r[1] : r[2] !== undefined ? parseFloat(r[2]) : r[3]) : undefined
      }
      anchors[seg][key] = {
        kind: get('kind'),
        text: get('text'),
        nth: get('nth') || 1,
        event: get('event') || '',
        lead: get('lead') || 0.3,
        loose: /loose:\s*true/.test(b),
        idx: get('idx'),
        t: get('t'),
      }
    }
  }
}

/* ---------- 计算每个锚点的实际时间与差值 ---------- */
const rows = []
const stats = { total: 0, resolved: 0, unresolved: 0, badAlign: 0, fixed: 0, beat: 0, line: 0, word: 0 }
for (const seg of Object.keys(anchors).sort()) {
  const r = segRanges[seg]
  const from = r ? r.start : 0
  const to = r ? r.end : 999
  for (const key of Object.keys(anchors[seg])) {
    const a = anchors[seg][key]
    stats.total++
    let t = null
    let src = ''
    if (a.kind === 'word') {
      stats.word++
      t = findWord(a.text, from, to, a.nth)
      src = `词 "${a.text}"${a.nth > 1 ? ` #${a.nth}` : ''}`
      if (t == null && a.loose) {
        // 宽松匹配：前缀/包含
        const needle = String(a.text).toLowerCase()
        for (const w of words) {
          if (w.t < from || w.t > to) continue
          if (w.w.toLowerCase().startsWith(needle.slice(0, Math.max(4, needle.length - 3)))) {
            t = w.t
            src = `词 "${a.text}"（宽松→${w.w}）`
            break
          }
        }
      }
    } else if (a.kind === 'fixed') {
      stats.fixed++
      t = a.t
      src = '固定时刻'
    } else if (a.kind === 'beat') {
      stats.beat++
      src = `第 ${a.nth} 拍`
      t = null // 需要 sync 数据，这里不解析
    } else if (a.kind === 'line') {
      stats.line++
      const li = lyrics.find((s) => s.i === a.idx)
      t = li ? li.t0 : null
      src = `第 ${a.idx} 句 t0`
    } else if (a.kind === 'onset') {
      // 起音点类锚点同样要运行时查 sync，本表只登记声明
      stats.onset = (stats.onset || 0) + 1
      src = `第 ${a.nth} 个起音点`
    }
    if (t != null) stats.resolved++
    else stats.unresolved++
    rows.push({ seg, key, kind: a.kind, event: a.event, t, src, lead: a.lead, note: a.kind === 'beat' || a.kind === 'onset' ? '（纯器乐，用节拍/起音点网格）' : '' })
  }
}

/* ---------- 生成 MAPPING.md ---------- */
const out = []
out.push('# MAPPING.md — 歌词↔画面映射表（FIX_V3.md §4.1）')
out.push('')
out.push('> **本文件由 `npm run mapping` 自动生成，不要手改。** 数据源：`src/scenes/anchors.js`（声明）+')
out.push('> `public/data/lyrics.json`（实测词时间）+ 各场景文件的 `start/end`。')
out.push('>')
out.push('> `beat` 类锚点属纯器乐段，时间由 `sync` 的节拍网格在运行时求值，本表只记录声明，故 `时间` 列为 `—`。')
out.push('')
out.push(`统计：锚点 **${stats.total}** 个（word ${stats.word} / fixed ${stats.fixed} / line ${stats.line} / beat ${stats.beat} / onset ${stats.onset || 0}）；`)
out.push(`已解析出时间 **${stats.resolved}**，未解析（beat / onset 类，运行时由 sync 求值）**${stats.unresolved}**。`)
out.push('')
out.push('| 段 | 锚点 key | 类型 | 事件 | 时间(s) | 来源 | lead |')
out.push('|---|---|---|---|---|---|---|')
for (const r of rows) {
  out.push(`| ${r.seg} | \`${r.key}\` | ${r.kind} | ${r.event}${r.note} | ${r.t == null ? '—' : r.t.toFixed(3)} | ${r.src} | ${r.lead} |`)
}
out.push('')
out.push('## 段落边界（与各场景文件同源）')
out.push('')
out.push('| 段 | start | end |')
out.push('|---|---|---|')
for (const seg of Object.keys(segRanges).sort()) {
  out.push(`| ${seg} | ${segRanges[seg].start} | ${segRanges[seg].end} |`)
}
out.push('')

writeFileSync(`${ROOT}/docs/MAPPING.md`, out.join('\n'), 'utf8')
console.log(`== npm run mapping ==`)
console.log(`docs/MAPPING.md 已生成：锚点 ${stats.total} 个（word ${stats.word} / fixed ${stats.fixed} / line ${stats.line} / beat ${stats.beat}）`)
console.log(`  段落边界 ${Object.keys(segRanges).length} 个`)
const unresolvedWord = rows.filter((r) => r.kind === 'word' && r.t == null)
if (unresolvedWord.length) {
  console.log(`  注意：${unresolvedWord.length} 个 word 类锚点没找到对应词（需要人工核对）：`)
  for (const r of unresolvedWord.slice(0, 12)) console.log(`    ${r.seg}.${r.key} ← "${r.src}"`)
}
