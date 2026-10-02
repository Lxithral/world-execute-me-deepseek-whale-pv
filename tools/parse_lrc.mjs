#!/usr/bin/env node
// tools/parse_lrc.mjs  ->  public/data/lyrics.json
//
// SPEC §3.2 的输入格式事实：
//   - 英文行：[mm:ss.xxx] 打头，后跟逐词时间戳 <mm:ss.xxx>word
//   - 中文行：与对应英文行同一行时间戳，且不含 <> 标签；按时间戳配对
//   - 开头署名元数据（标题 / Lyrics by / Composed by）识别后丢弃
//   - 英文行每个词的结束时间 = 下一词的开始；最后一词的“下一时间”其实是下一行起点，不可信
//   - hold = min(下一句 t0, 最后一词 t + 1.6s)
//
// 输出每句：{ i, t0, words:[{t,w}], en, zh|null, hold }
// 缺中文的句子 zh 置 null，不编造翻译；序号汇总到 tools/missing_zh.txt

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const LRC = path.join(ROOT, 'assets', 'song.lrc')
const OUT = path.join(ROOT, 'public', 'data', 'lyrics.json')
const MISSING = path.join(HERE, 'missing_zh.txt')

const LINE_TAG = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/
const WORD_TAG = /<(\d{1,3}):(\d{2}(?:\.\d{1,3})?)>/g
const HOLD_TAIL = 1.6

const META = [
  /^world\.execute\(me\)\s*;\s*-\s*mili$/i,
  /^lyrics\s+by\b/i,
  /^composed\s+by\b/i,
  /^arranged\s+by\b/i,
]

function toSeconds(mm, ss) {
  return parseInt(mm, 10) * 60 + parseFloat(ss)
}

function parseWords(body) {
  // 返回 [{t,w}]：每个 <ts> 之后的文本归它所有；行尾最后一个 <ts> 后面为空，只作边界
  const marks = []
  WORD_TAG.lastIndex = 0
  let m
  while ((m = WORD_TAG.exec(body)) !== null) {
    marks.push({ t: toSeconds(m[1], m[2]), start: m.index, end: WORD_TAG.lastIndex })
  }
  if (marks.length === 0) return null
  const words = []
  for (let k = 0; k < marks.length; k++) {
    const text = body.slice(marks[k].end, k + 1 < marks.length ? marks[k + 1].start : body.length)
    if (text.length === 0) continue
    words.push({ t: marks[k].t, w: text })
  }
  return words.length ? words : null
}

function main() {
  if (!fs.existsSync(LRC)) {
    console.error(`缺少 ${LRC}`)
    process.exit(2)
  }
  const raw = fs.readFileSync(LRC, 'utf8').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/)

  // 1) 逐行解析
  const parsed = []
  for (const line of lines) {
    const lm = line.match(LINE_TAG)
    if (!lm || lm.index !== 0) continue // 没有行首时间戳的行直接丢（空行 / 注释）
    const t0 = toSeconds(lm[1], lm[2])
    const body = line.slice(lm[0].length)
    const words = parseWords(body)
    const plain = body.replace(WORD_TAG, '').trim()
    parsed.push({ t0, body, words, plain })
  }

  // 2) 丢弃署名元数据（按内容识别，不盲删前 3 行）
  const content = parsed.filter((p) => {
    const text = (p.plain || (p.words ? p.words.map((w) => w.w).join('') : '')).trim()
    return !META.some((re) => re.test(text))
  })

  // 3) 按行首时间戳分组配对：带 <> 的是英文，无 <> 的是中文
  const groups = new Map()
  for (const p of content) {
    const key = p.t0.toFixed(3)
    if (!groups.has(key)) groups.set(key, { t0: p.t0, ens: [], zhs: [] })
    const g = groups.get(key)
    if (p.words) g.ens.push(p)
    else if (p.plain) g.zhs.push(p.plain)
  }

  // 4) 排序成句
  const sentences = [...groups.values()]
    .sort((a, b) => a.t0 - b.t0)
    .map((g) => {
      const en = g.ens.sort((a, b) => b.words.length - a.words.length)[0]
      const words = en ? en.words : []
      const enText = words.map((w) => w.w).join('').trim()
      return { t0: g.t0, words, en: enText, zh: g.zhs.length ? g.zhs.join(' / ') : null }
    })
    .filter((s) => s.en)

  // 5) hold
  const out = sentences.map((s, i) => {
    const nextT0 = i + 1 < sentences.length ? sentences[i + 1].t0 : Infinity
    const lastWordT = s.words.length ? s.words[s.words.length - 1].t : s.t0
    const hold = Math.min(nextT0, lastWordT + HOLD_TAIL)
    return { i, t0: +s.t0.toFixed(4), words: s.words, en: s.en, zh: s.zh, hold: +hold.toFixed(4) }
  })

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + '\n')

  const missing = out.filter((s) => !s.zh)
  fs.writeFileSync(
    MISSING,
    missing.map((s) => `${s.i}\t${s.t0.toFixed(3)}\t${s.en}`).join('\n') + (missing.length ? '\n' : '')
  )

  console.log(`[parse_lrc] ${OUT}`)
  console.log(`  总句数     ${out.length}`)
  console.log(`  有中文句数 ${out.length - missing.length}`)
  console.log(`  缺中文序号 ${missing.length ? missing.map((s) => s.i).join(', ') : '（无）'}`)
  if (missing.length) console.log(`  明细       ${MISSING}`)
}

main()
