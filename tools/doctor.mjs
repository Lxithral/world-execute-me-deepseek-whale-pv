// tools/doctor.mjs — 每批改动后必须全绿的健康检查（FIX_V3.md §1.2）
//
// 四项：
//   a) `vite build` 无报错；
//   b) src/ 下所有 .js 通过 `node --check`，且能被**真正 import**（语法能过但 import 时炸的模块要抓出来）；
//   c) tools/encoding_check.mjs 通过（U+FFFD / BOM / 混合换行 / 乱码特征）；
//   d) selftest 的 f 项（window.__errors 为空）—— 需要 dev server 在跑。
//
// 设计取舍：
//   · b) 的 import 检查在**浏览器里**做，不在 Node 里做。因为 src/ 里有 CSS import、
//     `import.meta.glob`、以及只在浏览器存在的 DOM API，用 Node import 会得到一堆假失败。
//     所以 b) 的"能 import"= 通过 ?probe=modules 让页面逐个 dynamic import 并回报。
//   · d) 需要 dev server；没有就明确报 SKIP（不算 PASS，也不算 FAIL），避免假装通过。

import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const argv = process.argv.slice(2)
const NO_SERVER = argv.includes('--no-server')
const DEV_URL = (argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')

const results = []
const push = (id, ok, msg, skip = false) => {
  results.push({ id, ok, msg, skip })
  const tag = skip ? 'SKIP' : ok ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${id}  ${msg}`)
}

/**
 * 跑子进程。
 * ⚠️ 教训：第一版用 `shell: true` 跑 `npx vite build` 与 `node -e "..."`，
 * 在 Windows 上 npx 是 .cmd、且 `-e` 的多行脚本经 shell 转发后被拆坏
 * （报 `Cannot find module '...\node:'`）。所以这里**一律不用 shell**，
 * 且把 vite 的入口 .js 直接用 node 跑（等价于 `npx vite`，但完全绕开 .cmd 包装）。
 */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024, ...opts })
  if (r.error) return { code: -1, out: String(r.error.message) }
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

/** 递归列出 src/ 下的 .js */
function listSrc() {
  const out = []
  ;(function w(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) w(p)
      else if (extname(e.name) === '.js') out.push(p)
    }
  })('src')
  return out
}

const VITE_BIN = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js')

console.log('== npm run doctor ==')

/* ---------- a) vite build ---------- */
{
  const r = run(process.execPath, [VITE_BIN, 'build', '--logLevel', 'warn'], { timeout: 900000 })
  const ok = r.code === 0
  push(
    'a vite build',
    ok,
    ok ? '构建通过' : `退出码 ${r.code}：${(r.out || '').split('\n').filter(Boolean).slice(-5).join(' | ')}`
  )
}

/* ---------- b1) node --check 所有 src/ .js ---------- */
{
  const files = listSrc()
  const bad = []
  for (const f of files) {
    const c = run(process.execPath, ['--check', f], { timeout: 30000 })
    if (c.code !== 0) {
      const line = (c.out || '').split('\n').find((l) => /Error/i.test(l)) || 'syntax error'
      bad.push(`${relative(process.cwd(), f).replace(/\\/g, '/')}: ${line.trim()}`)
    }
  }
  push(
    'b1 node --check',
    bad.length === 0,
    bad.length ? `${bad.length}/${files.length} 个文件失败：${bad.slice(0, 3).join(' ; ')}` : `${files.length} 个 src/*.js 全部通过`
  )
}

/* ---------- b2) 浏览器里逐个 import ---------- */
if (NO_SERVER) {
  push('b2 import 检查', true, '--no-server：跳过（未验证）', true)
} else {
  const EVAL = 'return JSON.stringify({ modules: window.__moduleReport || [], url: location.search })'
  const r = run(process.execPath, ['tools/shoot.mjs', '--url', `${DEV_URL}/?probe=modules`, '--eval', EVAL], { timeout: 300000 })
  let parsed = null
  try {
    // shoot.mjs 的输出形态是 `eval => {json}`；挑最后一条 eval 行，避免与 png/其它日志串味
    const lines = (r.out || '').split('\n').filter((l) => l.includes('eval =>'))
    const last = lines[lines.length - 1]
    parsed = last ? JSON.parse(last.slice(last.indexOf('eval =>') + 7).trim()) : null
  } catch (e) {
    parsed = null
  }
  if (!parsed || !parsed.modules || !parsed.modules.length) {
    // 诊断信息：spawnSync 的捕获在本机会受 stdio 限制，所以把关键事实都打出来
    const raw = r.out || ''
    const ev = raw.split('\n').filter((l) => l.includes('eval =>'))
    console.log(`  [diag] exit=${r.code} captured=${raw.length}B evalLines=${ev.length} url=${(parsed && parsed.url) || '?'}`)
    push('b2 import 检查', false, `拿不到模块清单（dev server 未运行？）exit=${r.code} cap=${raw.length}B eval=${ev.length} :: ${raw.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 200)}`)
  } else {
    const failed = parsed.modules.filter((m) => !m.ok)
    push('b2 import 检查', failed.length === 0, failed.length ? `${failed.length} 个模块 import 失败：${failed.slice(0, 4).map((m) => `${m.path}(${m.err})`).join(' ; ')}` : `${parsed.modules.length} 个模块全部可 import`)
  }
}

/* ---------- c) 编码检查 ---------- */
{
  const r = run(process.execPath, ['tools/encoding_check.mjs'], { timeout: 120000 })
  push('c 编码检查', r.code === 0, (r.out || '').split('\n').filter(Boolean).slice(0, 3).join(' | '))
}

/* ---------- d) selftest f) __errors 为空 ---------- */
if (NO_SERVER) {
  push('d __errors 为空', true, '--no-server：跳过（未验证）', true)
} else {
  const r = run(process.execPath, ['tools/shoot.mjs', '--url', `${DEV_URL}/?shot=60`, '--eval',
    'return JSON.stringify((window.__errors||[]).map(e=>e.where+": "+e.message))'], { timeout: 300000 })
  const lines = (r.out || '').split('\n').filter((l) => l.includes('eval =>'))
  const last = lines[lines.length - 1]
  let errs = null
  try {
    errs = last ? JSON.parse(last.slice(last.indexOf('eval =>') + 7).trim()) : null
  } catch (e) {
    errs = null
  }
  if (errs == null) push('d __errors 为空', false, `无法读取 __errors：${(r.out || '').split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 200)}`)
  else push('d __errors 为空', errs.length === 0, errs.length ? `${errs.length} 条：${errs.slice(0, 3).join(' ; ')}` : 'window.__errors 为空')
}

const fails = results.filter((r) => !r.ok && !r.skip)
const skips = results.filter((r) => r.skip)
console.log(`\n== 汇总：PASS ${results.filter((r) => r.ok && !r.skip).length}  FAIL ${fails.length}  SKIP ${skips.length} ==`)
if (fails.length) {
  console.log('未通过：' + fails.map((f) => f.id).join(', '))
  if (skips.length) console.log('（跳过的项：' + skips.map((s) => s.id).join(', ') + ' —— 跳过不等于通过）')
  process.exit(1)
}
if (skips.length) console.log('注意：有跳过的项，不能视为完整通过')
