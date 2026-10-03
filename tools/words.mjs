// tools/words.mjs — 开发期工具：在给定时间窗里打印真实歌词词时间（用于校准锚点）
// 用法: node tools/words.mjs 44 59
import { readFileSync } from 'node:fs'

const t0 = parseFloat(process.argv[2] || '0')
const t1 = parseFloat(process.argv[3] || '999')
const data = JSON.parse(readFileSync('public/data/lyrics.json', 'utf8'))
const rows = []
for (const s of data) {
  for (const w of s.words) {
    if (w.t >= t0 - 0.4 && w.t <= t1 + 0.4) rows.push({ t: w.t, w: w.w, line: s.i })
  }
}
rows.sort((a, b) => a.t - b.t)
for (const r of rows) console.log(`${r.t.toFixed(3)}\t${r.w}\t#${r.line}`)
console.log(`--- ${rows.length} words in [${t0}, ${t1}] ---`)
