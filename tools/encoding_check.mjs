// tools/encoding_check.mjs — 编码与换行守卫（FIX_V3.md §1.2c）
//
// 为什么必须有它：段 D 曾被一次 PowerShell 重写打成"U+FFFD + 换行被吃掉"，
// 那种损坏**能通过 node --check**（注释里的乱码不影响语法），
// 却让文件无法被本项目的编辑工具再打开（read 直接报 invalid UTF-8）。
// 所以语法检查不够，必须单独守编码。
//
// 检查项（任一命中即失败）：
//   1. U+FFFD（替换字符）—— 解码失败的铁证；
//   2. UTF-8 BOM（EF BB BF）—— 本项目要求无 BOM；
//   3. 混合换行（同一文件里既有 CRLF 又有裸 LF）—— 要求统一 LF；
//   4. 疑似乱码：连续出现的拉丁字母扩展区字符（Latin-1 Supplement / Latin Extended-A/B
//      里那些不该出现在中文技术文档中的字符，例如 "Â§" "Ã©" 这种 UTF-8 被当 Latin-1 解的结果）；
//   5. 混入其它编码的典型字节序列（GBK 双字节被当 UTF-8 解出的特征字）。
//
// 用法：node tools/encoding_check.mjs [目录...]   默认扫描 src/ 与 docs/

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = process.cwd()
const TARGETS = process.argv.slice(2).length ? process.argv.slice(2) : ['src', 'docs']
const EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.json', '.md', '.txt', '.yml', '.yaml'])

/** 递归收集文件 */
function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (e) {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      walk(p, out)
    } else if (e.isFile() && EXTS.has(extname(e.name).toLowerCase())) {
      out.push(p)
    }
  }
  return out
}

/**
 * 疑似乱码判定：这些字符是"UTF-8 字节被当成 Latin-1/GBK 解码"后的典型残留。
 * 只统计它们**连续出现**或**与常见标点组成已知错配对**的情况，
 * 避免把合法的法语/德语词（café、Müller）误判。
 */
const MOJIBAKE_PAIRS = [
  'Ã©', 'Ã¨', 'Ã ', 'Ã¢', 'Ã§', 'Ã¼', 'Ã¶', 'Ã¤', 'Ã±',
  'Â§', 'Â°', 'Â±', 'Â«', 'Â»', 'â€', 'â€™', 'â€œ',
  'ï¼', 'ã€', 'å\u0085', 'ç\u009a', 'æ\u0098', 'é\u0087',
]
const CJK_RANGE = /[\u4e00-\u9fff]/
/**
 * 拉丁扩展区的"连续段"才算乱码证据。
 * 单发字符几乎总是合法的：`×`(U+00D7) 就是乘号，在本文档里到处都是。
 * 第一版把"拉丁扩展区字符总数 >24"当判据，结果拿 `×` 把两份文档误判成乱码 ——
 * 阈值本身没错，错在**判据选错了**（应该看连续段，不是看总数）。
 */
const LATIN_EXT_RUN = /[\u00c0-\u024f]{2,}/g

const problems = []
let scanned = 0

for (const target of TARGETS) {
  const abs = join(ROOT, target)
  let st
  try {
    st = statSync(abs)
  } catch (e) {
    problems.push({ file: target, kind: 'missing', detail: '路径不存在' })
    continue
  }
  const files = st.isDirectory() ? walk(abs) : [abs]
  for (const f of files) {
    scanned++
    const buf = readFileSync(f)
    const rel = relative(ROOT, f).replace(/\\/g, '/')
    const raw = buf.toString('utf8')

    // 1. U+FFFD
    const fffd = []
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) === 0xfffd) fffd.push(i)
    }
    if (fffd.length) {
      problems.push({ file: rel, kind: 'U+FFFD', detail: `${fffd.length} 处（首个偏移 ${fffd[0]}）` })
    }

    // 2. BOM
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      problems.push({ file: rel, kind: 'BOM', detail: '文件带 UTF-8 BOM（本项目要求无 BOM）' })
    }

    // 3. 混合换行
    const crlf = (raw.match(/\r\n/g) || []).length
    const lfOnly = (raw.match(/(?<!\r)\n/g) || []).length
    if (crlf > 0 && lfOnly > 0) {
      problems.push({ file: rel, kind: 'mixed-EOL', detail: `CRLF ${crlf} 处 / 裸 LF ${lfOnly} 处` })
    }

    // 4. 乱码字符对
    const hits = MOJIBAKE_PAIRS.filter((p) => raw.includes(p))
    if (hits.length) {
      // 只有在文件里同时存在中文时才算乱码：纯英文文件里 "Ã©" 可能是合法的法语引用
      const hasCJK = CJK_RANGE.test(raw)
      if (hasCJK) {
        problems.push({ file: rel, kind: 'mojibake-pair', detail: `命中 ${hits.slice(0, 4).map((h) => JSON.stringify(h)).join(' ')}` })
      }
    }

    // 5. 拉丁扩展区的**连续段**（乱码的统计特征；单发字符如 × 是合法的）
    const runs = raw.match(LATIN_EXT_RUN) || []
    if (runs.length) {
      problems.push({ file: rel, kind: 'latin-ext-run', detail: `${runs.length} 段连续拉丁扩展区字符：${JSON.stringify(runs.slice(0, 3).join(' '))}` })
    }
  }
}

// 输出
console.log(`== 编码检查 ==  扫描 ${scanned} 个文件`)
if (!problems.length) {
  console.log('PASS  无 U+FFFD / 无 BOM / 换行统一 / 无乱码特征')
  process.exit(0)
}
const byKind = {}
for (const p of problems) byKind[p.kind] = (byKind[p.kind] || 0) + 1
console.log(`FAIL  ${problems.length} 处问题：${Object.entries(byKind).map(([k, n]) => `${k}×${n}`).join(' ')}`)
for (const p of problems.slice(0, 40)) {
  console.log(`  ${p.file}  [${p.kind}]  ${p.detail}`)
}
if (problems.length > 40) console.log(`  … 还有 ${problems.length - 40} 处`)
process.exit(1)
