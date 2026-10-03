// tools/anchor_audit.mjs — 锚点覆盖 / 孤儿元素审计（FIX_V3.md §4.2）
//
// §4.2 原文：
//   「无锚点的元素必须标 decor:true，且只允许是氛围层（背景代码墙、海雪、光柱、暗角），
//     占比 ≤ 主体的 30%。其余孤儿元素一律删除。先输出 docs/ORPHANS.md 列出现有的孤儿元素
//     及处理（删除/补锚点），再动手。」
//
// 所以本工具**只列出、不删除**，产出 `docs/ORPHANS.md`。
//
// 静态可判定的三件事：
//   1. 台词表里每条 `anchor` 是否命中 `anchors.js` 里真实存在的 key（错拼 = 该句永远不出现）；
//   2. 每个段落是否至少有一个锚点（selftest g 的硬要求）；
//   3. 每个**段落文件**里出现的"效果/元素"是否落在该段的锚点时间附近 ——
//      落不到的记为孤儿候选，需要人判"补锚点"还是" 删除"还是"标 decor"。
//
// 第 3 条必须诚实说明口径：源码里的效果是**硬编码秒数或 lt 归一化位置**，
// 真正的运行时归属要看 `registerImpacts` 收进去的 fx 表与场景实际消费的锚点。
// 静态扫描只能给出"候选"，所以 ORPHANS.md 里每条都带**判定依据**与**处理建议**，
// 并由人（或 R1–R3 的逐段重做）最终定案。**不假装它是全自动结论。**

import { readFileSync } from 'node:fs'
import { resolveAnchor, anchors, segRanges, words } from './dialogue_calib.mjs'

const ROOT = process.cwd()
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8')

/* ---------- 1) 段落清单 ---------- */
const SEG_FILES = [
  ['A', 'a_boot'], ['B', 'b_dive'], ['C', 'c_define'], ['D', 'd_switch'], ['E', 'e_deal'],
  ['F', 'f_omnipotent'], ['G', 'g_glitch'], ['H', 'h_absence'], ['I', 'i_cleanup'],
  ['J', 'j_overflow'], ['K', 'k_storm'], ['L', 'l_training'], ['M', 'm_algebra'], ['N', 'n_handoff'],
]

/* ---------- 2) 台词表 ---------- */
const dlgSrc = read('src/data/dialogue.js')
const dlgRefs = []
{
  const re = /\{\s*seg:\s*'([A-N])',\s*anchor:\s*'([^']+)'/g
  let m
  while ((m = re.exec(dlgSrc))) dlgRefs.push({ seg: m[1], key: m[2] })
}

/* ---------- 3) 每个场景文件里的候选元素 ---------- */
/** 从源码里抓"可能是一个元素"的线索：createProp 的种类、被创建的对象名、fx 声明 */
function scanScene(seg, file) {
  const src = read(`src/scenes/${file}.js`)
  const out = { props: [], fx: [], names: [], anchored: new Set(), cuesUsed: [] }

  // createProp('xxx')
  for (const m of src.matchAll(/createProp\(\s*'([a-z]+)'/g)) out.props.push(m[1])
  // 对象命名：mesh.name = '...' / .name = `...`
  for (const m of src.matchAll(/\.name\s*=\s*[`'"]([^`'"]{2,40})[`'"]/g)) out.names.push(m[1])
  // fx 声明表：{ t: 12.3, kind: 'flash', ... }
  for (const m of src.matchAll(/\{\s*t:\s*([\d.]+)\s*,\s*kind:\s*'(\w+)'/g)) out.fx.push({ t: parseFloat(m[1]), kind: m[2] })
  // 场景消费的锚点：cues.sec('X', 'key'...) / cues.t('X', 'key') / timeline/cueOf
  for (const m of src.matchAll(/cues\.(?:sec|t|start)\(\s*'([A-N])'\s*,\s*'(\w+)'/g)) {
    if (m[1] === seg) out.anchored.add(m[2])
  }
  for (const m of src.matchAll(/cueOf\(\s*'(\w+)'/g)) out.anchored.add(m[1])
  for (const m of src.matchAll(/\bT\(\s*'(\w+)'/g)) out.anchored.add(m[1])
  for (const m of src.matchAll(/\.(?:sec|t|start)\(\s*'(\w+)'/g)) out.anchored.add(m[1])
  return out
}

/* ---------- 4) 组装报告 ---------- */
const missingAnchorRefs = []
for (const r of dlgRefs) {
  const res = resolveAnchor(r.seg, r.key)
  if (!res.ok) missingAnchorRefs.push({ ...r, reason: res.reason })
}

const rows = []
const segSummary = []
for (const [seg, file] of SEG_FILES) {
  const keys = Object.keys(anchors[seg] || {})
  const sc = scanScene(seg, file)
  const used = keys.filter((k) => sc.anchored.has(k))
  const unused = keys.filter((k) => !sc.anchored.has(k))
  segSummary.push({ seg, file, keys: keys.length, used: used.length, unused })

  for (const kind of sc.props) {
    rows.push({ seg, file, kind: 'prop', name: kind, evidence: `createProp('${kind}')`, anchor: used[0] || null, verdict: '补锚点' })
  }
  for (const fx of sc.fx) {
    const r0 = segRanges[seg]
    const from = r0 ? r0.start : 0
    const to = r0 ? r0.end : 9999
    // 判据 A：该效果时刻附近有没有**声明过的锚点**
    let best = null
    let bestD = Infinity
    for (const k of keys) {
      const r = resolveAnchor(seg, k)
      if (!r.ok || r.t == null) continue
      const d = Math.abs(r.t - fx.t)
      if (d < bestD) {
        bestD = d
        best = k
      }
    }
    // 判据 B：该效果时刻附近有没有**真实歌词词**
    //   §4.1 要求每个场景事件通过 anchors 声明 {concept, word|beat}。
    //   一个 fx 即使没有"声明过的"锚点，只要它压在真实的词起唱点上，就说明它**可以**补一个 word 锚点；
    //   如果附近连词都没有（纯器乐空档），那它要么该补 beat 锚点，要么就该标 decor / 删除。
    let nearWord = null
    let nearWordD = Infinity
    for (const w of words) {
      if (w.t < from || w.t > to) continue
      const d = Math.abs(w.t - fx.t)
      if (d < nearWordD) {
        nearWordD = d
        nearWord = w
      }
    }
    const wordHit = nearWordD <= 0.6 ? nearWord : null
    // 处理建议：声明锚点 → 已归属；有真实词 → 补 word 锚点；纯器乐空档 → 补 beat 锚点或标 decor/删除
    const verdict = bestD <= 1.2 ? '已归属锚点' : wordHit ? '可补 word 锚点' : '纯器乐空档：补 beat 锚点 / 标 decor / 删除'
    rows.push({
      seg, file, kind: 'fx', name: `${fx.kind}@${fx.t}`,
      evidence: `fx { t: ${fx.t}, kind: '${fx.kind}' }`,
      anchor: bestD <= 1.2 ? best : null,
      near: best != null && Number.isFinite(bestD) ? bestD.toFixed(2) : '—',
      word: wordHit ? `"${wordHit.w.trim()}"@${wordHit.t.toFixed(3)}` : '—',
      orphan: !wordHit,
      verdict,
    })
  }
}

/* ---------- 5) 写 docs/ORPHANS.md ---------- */
const L = []
L.push('# ORPHANS.md — 孤儿元素清单（FIX_V3.md §4.2）')
L.push('')
L.push('> **本文件由 `node tools/anchor_audit.mjs` 生成。按 §4.2「先输出……再动手」，本轮**只列不删**。**')
L.push('>')
L.push('> §4.2 的规则：无锚点的元素必须标 `decor:true`，且只允许是氛围层（背景代码墙、海雪、光柱、暗角），')
L.push('> 占比 ≤ 主体的 30%；**其余孤儿元素一律删除**。')
L.push('')
L.push('## 判定口径（重要，避免把候选当成结论）')
L.push('')
L.push('- **stat1** 台词表的锚点引用：静态可判定，错拼 = 该句台词永远不会出现。**这是硬结论。**')
L.push('- **stat2** 段落锚点覆盖：静态可判定。**这是硬结论。**')
L.push('- **stat3** 场景里的 `createProp` / `fx`：静态扫描只能给出**候选**，因为真实归属要看运行时')
L.push('  消费了哪个锚点（`cues.sec()/t()/start()` 与 `cueOf()`/`T()` 的调用）。所以下面每条都带')
L.push('  「最近的锚点」与「差值」，并且 `处理建议` 是**建议**，最终由 R1–R3 的逐段重做定案。')
L.push('')
L.push('## stat1 — 台词表锚点引用')
L.push('')
if (missingAnchorRefs.length === 0) {
  L.push(`✅ **${dlgRefs.length} 条台词引用的锚点全部真实存在且可解析**（判据：\`tools/dialogue_calib.mjs resolveAnchor\`）。`)
} else {
  L.push(`❌ **${missingAnchorRefs.length} 处引用不存在或不可解析的锚点**（该句台词不会出现）：`)
  L.push('')
  L.push('| 段 | anchor | 原因 | 处理 |')
  L.push('|---|---|---|---|')
  for (const m of missingAnchorRefs) L.push(`| ${m.seg} | \`${m.key}\` | ${m.reason} | 在 anchors.js 补声明，或改台词表的 anchor |`)
}
L.push('')
L.push('## stat2 — 段落锚点覆盖')
L.push('')
L.push('| 段 | 文件 | 锚点数 | 被场景消费 | 未被消费的 key |')
L.push('|---|---|---|---|---|')
for (const s of segSummary) {
  L.push(`| ${s.seg} | \`src/scenes/${s.file}.js\` | ${s.keys} | ${s.used} | ${s.unused.length ? s.unused.map((k) => '`' + k + '`').join(' ') : '—'} |`)
}
L.push('')
L.push('> 「未被消费」不等于孤儿：`anchors.js` 是**声明表**，消费发生在场景代码里；')
L.push('> selftest g) 只要求"每段至少有一个被消费的锚点"。上面这一列是给 R1–R3 的**待接线清单**。')
L.push('')
L.push('## stat3 — 场景元素候选（prop / fx）')
L.push('')
L.push('判据 A = 「最近的**已声明**锚点」（≤1.2s 视为已归属）；判据 B = 「最近的**真实歌词词**」（≤0.6s）。')
L.push('两条都不中的，才是真正需要决策的孤儿。')
L.push('')
L.push('| 段 | 文件 | 类型 | 元素 | 证据 | 最近锚点 | Δ(s) | 最近真实词 | 处理建议 |')
L.push('|---|---|---|---|---|---|---|---|---|')
for (const r of rows) {
  L.push(
    `| ${r.seg} | \`${r.file}.js\` | ${r.kind} | \`${r.name}\` | ${r.evidence} | ` +
      `${r.anchor ? '`' + r.anchor + '`' : '**无**'} | ${r.near || '—'} | ${r.word || '—'} | ${r.verdict} |`
  )
}
L.push('')
const orphanFx = rows.filter((r) => r.kind === 'fx' && r.orphan)
const propsNoAnchor = rows.filter((r) => r.kind === 'prop' && !r.anchor)
L.push('## 汇总')
L.push('')
L.push(`- 台词锚点引用：**${dlgRefs.length}** 条，其中无法解析 **${missingAnchorRefs.length}** 条`)
L.push(`- 段落：**${segSummary.length}** 段；锚点声明 **${segSummary.reduce((a, s) => a + s.keys, 0)}** 个；`)
L.push(`  被场景消费 **${segSummary.reduce((a, s) => a + s.used, 0)}** 个`)
L.push(`- stat3 候选：**${rows.length}** 条`)
L.push(`  · 已归属锚点（Δ≤1.2s）：**${rows.filter((r) => r.verdict === '已归属锚点').length}** 条`)
L.push(`  · 可补 word 锚点（附近 0.6s 内有真实词）：**${rows.filter((r) => r.verdict === '可补 word 锚点').length}** 条`)
L.push(`  · **纯器乐空档（附近无词）＝真正的孤儿候选：${orphanFx.length} 条**`)
L.push(`  · ` + '`createProp` 但该段还没接锚点：' + `**${propsNoAnchor.length}** 条（${propsNoAnchor.map((r) => r.seg + '/' + r.name).join(' ') || '—'}）`)
L.push('')
L.push('### 下一步（按 §4.2 的顺序）')
L.push('')
L.push('1. 先把 stat1 清零（锚点引用错拼是"台词静默消失"，最贵）；')
L.push('2. 再逐段处理 stat3 的孤儿候选：能补锚点的补锚点，属氛围层的标 `decor:true`，其余删除；')
L.push('3. decor 的总屏幕占比 ≤30%，由 selftest s) 与 `?demo=panes` 的登记表实测把关。')
L.push('')

// 写文件纪律（FIX_V3 §1.3 + 本机沙箱事实）：
//   · DSH 的 workspace-write 沙箱**禁止子进程写工作区文件**（实测 `writeFileSync` → EPERM，
//     报 `[sandbox: file access denied under workspace-write mode]`；同一限制也让
//     `vite build` 的 esbuild 服务与 `npm run doctor` 的 spawnSync 拿到 EPERM）。
//   · 所以这里**只把 markdown 打到 stdout**，由调用方（编辑工具 / 外层重定向）落盘：
//       node tools/anchor_audit.mjs > docs/ORPHANS.md      # 控制台重定向（不经子进程）
//   · 这和 §1.3「源文件与文档只用编辑工具写入」是同一个精神：不要让工具自己写文档。
const markdown = L.join('\n')
if (process.argv.includes('--print')) {
  process.stdout.write(markdown)
} else {
  process.stdout.write(markdown)
  process.stderr.write('\n== node tools/anchor_audit.mjs ==\n')
  process.stderr.write(`（markdown 已打到 stdout；落盘请用编辑工具或外层重定向到 docs/ORPHANS.md）\n`)
  process.stderr.write(`台词锚点引用 ${dlgRefs.length} 条（无法解析 ${missingAnchorRefs.length}）\n`)
  process.stderr.write(`段落 ${segSummary.length} 段 / 锚点声明 ${segSummary.reduce((a, s) => a + s.keys, 0)} 个 / 被消费 ${segSummary.reduce((a, s) => a + s.used, 0)} 个\n`)
  process.stderr.write(`stat3 候选 ${rows.length} 条：已归属 ${rows.filter((r) => r.verdict === '已归属锚点').length} / 可补 word 锚点 ${rows.filter((r) => r.verdict === '可补 word 锚点').length} / 纯器乐空档孤儿 ${orphanFx.length}\n`)
  for (const r of orphanFx.slice(0, 20)) process.stderr.write(`  孤儿 ${r.seg} ${r.name}  ← ${r.evidence}\n`)
}
