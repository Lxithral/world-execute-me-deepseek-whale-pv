// 检查：src/ 里有没有"歌词原文"漏到歌词层之外（FIX §6）
// 做法：把歌词每句切成 3-gram（归一化后），再扫 src/ 里所有字符串字面量的 3-gram 交集。
import fs from 'node:fs'
import path from 'node:path'

const lyrics = JSON.parse(fs.readFileSync('public/data/lyrics.json', 'utf8'))
const lines = Object.values(lyrics).map((l) => l.en)
const zh = Object.values(lyrics).map((l) => l.zh)

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim()

const grams = (s, n) => {
  const w = norm(s).split(' ').filter(Boolean)
  const out = new Set()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

const en = new Set()
for (const l of lines) for (const g of grams(l, 3)) en.add(g)
const zhG = new Set()
for (const l of zh) {
  const c = norm(l).replace(/ /g, '')
  for (let i = 0; i + 4 <= c.length; i++) zhG.add(c.slice(i, i + 4))
}

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.js') || e.name.endsWith('.css')) files.push(p)
  }
}
walk('src')

const hits = []
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  // 只扫字符串字面量（'...' / "..." / `...`），排除注释行
  const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g
  let m
  while ((m = re.exec(src)) !== null) {
    const lit = m[2]
    if (lit.length < 6) continue
    const lineNo = src.slice(0, m.index).split('\n').length
    const head = src.split('\n')[lineNo - 1].trim()
    if (head.startsWith('//') || head.startsWith('*') || head.startsWith('/*')) continue
    for (const g of grams(lit, 3)) {
      if (en.has(g)) hits.push({ f, lineNo, g, lit: lit.slice(0, 70) })
    }
    const c = norm(lit).replace(/ /g, '')
    for (let i = 0; i + 4 <= c.length; i++) {
      if (zhG.has(c.slice(i, i + 4))) hits.push({ f, lineNo, g: c.slice(i, i + 4), lit: lit.slice(0, 70) })
    }
  }
}

if (!hits.length) console.log('OK：src/ 的字符串字面量里没有发现 3-gram / 4-gram 级别的歌词原文')
else {
  console.log('发现 %d 处可疑：', hits.length)
  for (const h of hits) console.log(`  ${h.f}:${h.lineNo}  [${h.g}]  ${h.lit}`)
}
