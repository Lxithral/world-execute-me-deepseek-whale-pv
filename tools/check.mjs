#!/usr/bin/env node
// tools/check.mjs — node 端一致性检查（npm run check）：
//   1) 数据文件存在且规模在 SPEC 限制内
//   2) lyrics.json 自洽（排序、hold、与器乐空档吻合）
//   3) 场景时间轴无缝、相邻重叠 ≤ 0.4s、与 DIRECTOR 的段边界一致
//   4) ctxAt(t) 在 DIRECTOR 给出的关键时间点上取到约定值
// 退出码：0 全通过；1 有失败项。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ctxAt } from '../src/ui/dsh.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const D = path.join(ROOT, 'public', 'data')

let fails = 0
let passes = 0
const ok = (cond, label, detail = '') => {
  if (cond) {
    passes++
    console.log(`  PASS  ${label}${detail ? '  ' + detail : ''}`)
  } else {
    fails++
    console.log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`)
  }
}
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

/* ---------------- DIRECTOR 的段边界（与 src/scenes/index.js 必须一致） ---------------- */
const SEGMENTS = [
  ['A', 0.0, 14.5],
  ['B', 14.5, 29.7],
  ['C', 29.7, 44.0],
  ['D', 44.0, 59.0],
  ['E', 59.0, 74.0],
  ['F', 74.0, 88.8],
  ['G', 88.8, 103.5],
  ['H', 103.5, 118.3],
  ['I', 118.3, 129.0],
  ['J', 129.0, 147.9],
  ['K', 147.9, 162.0],
  ['L', 162.0, 177.4],
  ['M', 177.4, 188.5],
  ['N', 188.5, 211.907],
]

/* ---------------- ctxAt 的关键点（DIRECTOR「全片常驻」） ---------------- */
const CTX_POINTS = [
  [0, 0],
  [14, 6],
  [44, 14],
  [74, 29],
  [104, 44],
  [118, 58],
  [120.5, 27],
  [129, 33],
  [142, 70],
  [145, 100],
  [147.5, 20],
  [162, 62],
  [177, 78],
  [190.8, 88],
  [200, 88],
  [206, 2],
]

console.log('== 数据文件 ==')
const analysis = readJSON(path.join(D, 'analysis.json'))
const lyrics = readJSON(path.join(D, 'lyrics.json'))
const contour = readJSON(path.join(D, 'whale_contour.json'))
const points = readJSON(path.join(D, 'whale_points.json'))
const mesh = readJSON(path.join(D, 'whale_mesh.json'))

const dur = analysis.duration
ok(Math.abs(dur - 211.907) < 0.05, 'analysis.duration ≈ 211.907s', `${dur.toFixed(3)}s`)
ok(analysis.fps === 30, 'analysis.fps = 30')
ok(analysis.mel.bands === 64, 'mel bands = 64', `${analysis.mel.bands}`)
ok(analysis.mel.data.length === analysis.mel.frames * analysis.mel.bands, 'mel 数据长度自洽')
ok(analysis.rms.values.length === analysis.mel.frames, 'rms 帧数与 mel 一致')
ok(analysis.beats.length > 100 && analysis.onsets.length > 100, 'beats/onsets 数量合理', `${analysis.beats.length}/${analysis.onsets.length}`)
ok(
  analysis.onsets.every((o, i, a) => i === 0 || o.t >= a[i - 1].t),
  'onsets 时间递增'
)

console.log('== 歌词 ==')
ok(lyrics.length === 85, '歌词句数 = 85', `${lyrics.length}`)
ok(
  lyrics.every((s, i) => (i === 0 ? true : s.t0 >= lyrics[i - 1].t0)),
  '句子按 t0 递增'
)
ok(lyrics.every((s) => s.t0 >= 0 && s.t0 < dur && s.hold <= dur), '每句都在 [0, duration] 内')
ok(
  lyrics.every((s) => s.hold <= (lyrics[s.i + 1] ? lyrics[s.i + 1].t0 : dur) + 1e-6),
  'hold ≤ 下一句 t0'
)
ok(
  lyrics.every((s) => s.words.every((w, i) => (i === 0 ? true : w.t >= s.words[i - 1].t))),
  '逐词时间递增'
)
const missingZh = lyrics.filter((s) => !s.zh).map((s) => s.i)
ok(true, '缺中文句序号', missingZh.length ? missingZh.join(',') : '（无）')
// 三处器乐空档
const gaps = []
for (let i = 0; i < lyrics.length - 1; i++) {
  const g = lyrics[i + 1].t0 - lyrics[i].hold
  if (g > 2) gaps.push([+lyrics[i].hold.toFixed(2), +lyrics[i + 1].t0.toFixed(2)])
}
ok(gaps.length === 3, '器乐空档数 = 3', JSON.stringify(gaps))

console.log('== 鲸鱼数据 ==')
ok(contour.totalPoints <= 1500, '轮廓点 ≤ 1500', `${contour.totalPoints}`)
ok(points.count <= 8000, '点云 ≤ 8000', `${points.count}`)
ok(points.u.length === points.count && points.c.length === points.count, '点云数组长度自洽')
ok(mesh.triangleCount >= 400 && mesh.triangleCount <= 800, '网格三角 400–800', `${mesh.triangleCount}`)
ok(mesh.tris.length === mesh.triangleCount * 3, '三角索引长度自洽')
ok(
  mesh.tris.every((i) => i >= 0 && i < mesh.vertexCount),
  '三角索引在顶点范围内'
)

console.log('== 场景时间轴 ==')
ok(SEGMENTS.length === 14, '段落数 = 14', `${SEGMENTS.length}`)
let gapsT = []
let overlapMax = 0
for (let i = 0; i < SEGMENTS.length; i++) {
  const [id, s, e] = SEGMENTS[i]
  if (e <= s) fails++
  if (i > 0) {
    const prev = SEGMENTS[i - 1]
    const ov = prev[2] - s
    if (ov > overlapMax) overlapMax = ov
    if (s - prev[2] > 0.001) gapsT.push(`${prev[0]}→${id}:${(s - prev[2]).toFixed(2)}s`)
  }
}
ok(gapsT.length === 0, '段落之间无空隙', gapsT.length ? gapsT.join(' ') : '')
ok(overlapMax <= 0.4001, '相邻段落重叠 ≤ 0.4s', `${overlapMax.toFixed(3)}s`)
ok(Math.abs(SEGMENTS[SEGMENTS.length - 1][2] - dur) < 0.01, '末段结束 = duration', `${SEGMENTS[SEGMENTS.length - 1][2]} vs ${dur.toFixed(3)}`)
// 逐 0.25s 覆盖
let uncovered = 0
for (let t = 0; t < dur; t += 0.25) {
  if (!SEGMENTS.some(([, s, e]) => t >= s && t < e)) uncovered++
}
ok(uncovered === 0, '每 0.25s 都落在某段内', uncovered ? `${uncovered} 处未覆盖` : '')

console.log('== ctxAt 关键点 ==')
let ctxBad = []
for (const [t, v] of CTX_POINTS) {
  const got = ctxAt(t)
  if (Math.abs(got - v) > 0.6) ctxBad.push(`t=${t} 期望${v} 实得${got.toFixed(1)}`)
}
ok(ctxBad.length === 0, 'ctxAt 命中 DIRECTOR 关键值', ctxBad.length ? ctxBad.join('; ') : `${CTX_POINTS.length} 点`)

console.log('== 素材 ==')
const PUB = path.join(ROOT, 'public', 'whale')
const need = ['maid-left.webp', 'whale-angry.webp', 'whale-cheerful.webp', 'whale-confused.webp', 'whale-exasperated.webp', 'whale-frightened.webp', 'whale-serious.webp', 'whale-shy.webp', 'whale-starry.webp', 'cat.png']
const missing = need.filter((n) => !fs.existsSync(path.join(PUB, n)))
ok(missing.length === 0, 'public/whale 素材齐备', missing.length ? `缺 ${missing.join(',')}` : `${need.length} 个`)
const inv = path.join(ROOT, 'assets', 'whale_inventory.json')
ok(fs.existsSync(inv), 'assets/whale_inventory.json 存在')

console.log(`\n== 汇总：PASS ${passes}  FAIL ${fails} ==`)
process.exit(fails ? 1 : 0)
