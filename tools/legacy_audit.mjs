// tools/legacy_audit.mjs — F3 遗留文件核对（FIX_V3.md §1.5）
//
// 针对 b_*.js / c_*.js / d_*.js / e_*.js 以及"中途失败的子代理留下的文件"，
// 逐个回答四个问题并把结果写成表格（供 CHECKPOINT.md 引用）：
//   1) node --check 通过吗（语法完整、没有半截函数）？
//   2) 文件能被浏览器真正 import 吗（语法过但 import 炸的情况要抓出来）？
//   3) 有没有编码损坏（U+FFFD / BOM / 混合换行 / 拉丁扩展区连续段）？
//   4) 还有没有 Canvas2D 主体绘制残留（FIX 要求逐段重做后画面输出一律 3D/DOM）？
//   5) 有没有明显的半截痕迹：未闭合的函数括号数、TODO/FIXME、以及作者自己写下的
//      "Let me rewrite" 这类子代理中断语（第一轮三个子代理就是这样退出的）。
//
// 用法：node tools/legacy_audit.mjs            （需要 dev server 在 http://127.0.0.1:5173）
//       node tools/legacy_audit.mjs --no-import （跳过浏览器 import 检查）

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const NO_IMPORT = argv.includes('--no-import')
const DEV_URL = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')
const ROOT = process.cwd()

// 待审清单：F3 涉及的五段 + 本轮新增的公共模块 + 子代理可能碰过的文件
const TARGETS = [
  'src/scenes/a_boot.js',
  'src/scenes/b_dive.js',
  'src/scenes/c_define.js',
  'src/scenes/d_switch.js',
  'src/scenes/e_deal.js',
  'src/scenes/_seg.js',
  'src/scenes/anchors.js',
  'src/lib/scene3d.js',
  'src/lib/props/termpane.js',
  'src/lib/codewall.js',
  'src/lib/swarm.js',
  'src/lib/swarm2d.js',
]

const run = (args, opts = {}) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024, ...opts })
  if (r.error) return { code: -1, out: String(r.error.message) }
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

/* ---------- 浏览器 import 结果（一次拿全，避免逐文件起浏览器） ---------- */
let importMap = new Map()
if (!NO_IMPORT) {
  const r = run(
    ['tools/shoot.mjs', '--url', `${DEV_URL}/?probe=modules`, '--eval', 'return JSON.stringify({ modules: window.__moduleReport || [] })'],
    { timeout: 300000 }
  )
  const lines = (r.out || '').split('\n').filter((l) => l.includes('eval =>'))
  const last = lines[lines.length - 1]
  try {
    const parsed = JSON.parse(last.slice(last.indexOf('eval =>') + 7).trim())
    for (const m of parsed.modules || []) {
      // glob 的 key 是 './scenes/a_boot.js'，转成 'src/scenes/a_boot.js'
      importMap.set('src/' + m.path.replace(/^\.\//, ''), m)
    }
  } catch (e) {
    console.log(`[warn] 拿不到浏览器 import 结果：${e.message}`)
  }
}

/**
 * 半截函数检查：花括号配平（粗算）。
 *
 * ⚠️ 这是**参考值，不是判据**：它不完整支持模板字符串与正则字面量，
 * 会把 `${...}`、`/\{/` 之类算歪（实测对 codewall.js 报 +2，而该文件 `node --check` 是过的）。
 * 真正的"语法是否完整"判据是 1) 的 `node --check`；这里只用来提示"人眼去瞄一眼"。
 */
function braceBalance(src) {
  let depth = 0
  let inStr = null
  let inLine = false
  let inBlock = false
  let inTpl = 0
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (inLine) {
      if (c === '\n') inLine = false
      continue
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (inTpl > 0) {
      if (c === '\\') i++
      else if (c === '`') inTpl--
      continue
    }
    if (c === '/' && n === '/') {
      inLine = true
      i++
      continue
    }
    if (c === '/' && n === '*') {
      inBlock = true
      i++
      continue
    }
    if (c === '"' || c === "'") {
      inStr = c
      continue
    }
    if (c === '`') {
      inTpl++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') depth--
  }
  return depth
}

const INTERRUPT_MARKERS = [
  'Let me rewrite',
  'let me rewrite',
  'TODO',
  'FIXME',
  'XXX',
  '待补',
  '半截',
  'unfinished',
]

const rows = []
let hardFail = 0

for (const f of TARGETS) {
  const abs = `${ROOT}/${f}`
  if (!existsSync(abs)) {
    rows.push({ f, check: '—', imp: '—', enc: '—', c2d: '—', note: '文件不存在（尚未创建或尚未重做）' })
    continue
  }
  const buf = readFileSync(abs)
  const src = buf.toString('utf8')

  // 1) node --check
  const c = run(['--check', abs], { timeout: 30000 })
  const check = c.code === 0 ? 'OK' : `FAIL(${(c.out.split('\n').find((l) => /Error/i.test(l)) || '').trim().slice(0, 60)})`
  if (c.code !== 0) hardFail++

  // 2) 浏览器 import
  const m = importMap.get(f)
  const imp = NO_IMPORT ? 'skip' : !importMap.size ? '?' : m ? (m.ok ? 'OK' : `FAIL(${String(m.err).slice(0, 50)})`) : 'NOT-IN-GLOB'
  if (imp.startsWith('FAIL')) hardFail++

  // 3) 编码
  const encIssues = []
  if (src.includes('\uFFFD')) encIssues.push('U+FFFD')
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) encIssues.push('BOM')
  const crlf = (src.match(/\r\n/g) || []).length
  const lfOnly = (src.match(/(?<!\r)\n/g) || []).length
  if (crlf > 0 && lfOnly > 0) encIssues.push('mixed-EOL')
  if (/[\u00c0-\u024f]{2,}/.test(src)) encIssues.push('latin-ext-run')
  const enc = encIssues.length ? `FAIL(${encIssues.join(',')})` : 'OK'
  if (encIssues.length) hardFail++

  // 4) Canvas2D 主体绘制残留
  const c2dCount = (src.match(/g\.(fillText|fillRect|strokeText|strokeRect|beginPath|arc)\s*\(/g) || []).length
  const c2d = c2dCount ? `${c2dCount} 处` : '0'

  // 5) 半截痕迹
  const bal = braceBalance(src)
  const markers = INTERRUPT_MARKERS.filter((k) => src.includes(k))
  const notes = []
  // 括号配平只作提示（不支持模板字符串/正则，会误报）；真正的判据是 node --check
  if (bal !== 0 && check !== 'OK') notes.push(`括号不配平(${bal > 0 ? '+' : ''}${bal})`)
  else if (bal !== 0) notes.push(`括号粗算偏差(${bal > 0 ? '+' : ''}${bal}，参考值)`)
  if (markers.length) notes.push(`含标记:${markers.join('/')}`)

  rows.push({ f, check, imp, enc, c2d, note: notes.join(' ') || (c2dCount ? '有 2D 绘制（需确认是否仅 ?debug）' : '') })
}

/* ---------- 输出 ---------- */
console.log('== F3 遗留文件核对（FIX_V3 §1.5）==')
console.log('| 文件 | node --check | 浏览器 import | 编码 | 2D 绘制残留 | 备注 |')
console.log('|---|---|---|---|---|---|')
for (const r of rows) {
  console.log(`| ${r.f} | ${r.check} | ${r.imp} | ${r.enc} | ${r.c2d} | ${r.note} |`)
}
console.log('')
console.log(`硬失败（语法/import/编码）：${hardFail}`)
if (NO_IMPORT) console.log('注意：本次跳过了浏览器 import 检查（--no-import）')
process.exit(hardFail ? 1 : 0)
