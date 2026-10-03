#!/usr/bin/env node
// tools/pose_report.mjs — 9 张立绘的姿态比对（FIX.md §5.1a）
//
// 目的：9 张素材是同底稿的整身立绘但姿态不同（挥手/抱臂/手放下…）。硬切换表情时，
// 只有「头部位置最接近」的图之间才不会出现明显的头部位移跳变。本脚本量出每张图的
// 头部包围盒（位置与大小）与肩线，按头部中心 x 与头部宽度聚类，输出 docs/DSH_POSES.md。
//
// 只读 refs/dsh-pv 里的素材；确定性；不修改任何图。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const SRC = path.join(ROOT, 'refs', 'dsh-pv', 'film', 'third_party_references', 'whale_maid_expanded_20260926')
const OUT = path.join(ROOT, 'docs', 'DSH_POSES.md')

const WORK_W = 400 // 分析用宽度：够精确且快
const ALPHA_MIN = 8
const FILES = [
  ['maid-left', path.join(SRC, 'maid-left.webp'), '主立绘（基准）'],
  ...fs
    .readdirSync(path.join(SRC, 'expressions'))
    .filter((f) => f.endsWith('.webp'))
    .sort()
    .map((f) => [f.replace('.webp', ''), path.join(SRC, 'expressions', f), '表情']),
]

/** 逐行 alpha 统计 */
async function analyze(file) {
  const meta = await sharp(file).metadata()
  const W = WORK_W
  const H = Math.round((meta.height / meta.width) * W)
  const { data } = await sharp(file).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  const rowMin = new Int32Array(H).fill(-1)
  const rowMax = new Int32Array(H).fill(-1)
  const rowCount = new Int32Array(H)
  let minX = W, maxX = -1, minY = H, maxY = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > ALPHA_MIN) {
        if (rowMin[y] < 0) rowMin[y] = x
        rowMax[y] = x
        rowCount[y]++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  // 行宽序列
  const rowW = []
  for (let y = 0; y < H; y++) rowW.push(rowMin[y] < 0 ? 0 : rowMax[y] - rowMin[y] + 1)

  // ---- 头部度量：分两步，避免被"举手"干扰 ----
  // ① 冠部（crown）：轮廓最顶部 12% 高度的横带。举手的指尖几乎不会高过头顶，
  //    所以这条带子基本只含头发/头饰，是「头在哪里」最稳的代理量。
  const silH = maxY - minY + 1
  const crownEnd = Math.max(minY + 1, Math.round(minY + silH * 0.12))
  let cMinX = W, cMaxX = -1
  for (let y = minY; y < crownEnd; y++) {
    if (rowMin[y] < 0) continue
    if (rowMin[y] < cMinX) cMinX = rowMin[y]
    if (rowMax[y] > cMaxX) cMaxX = rowMax[y]
  }
  const crown = { x: cMinX, y: minY, w: cMaxX - cMinX + 1, cx: Math.round((cMinX + cMaxX) / 2), end: crownEnd }

  // ② 颈线 = 冠部以下 25% 高度内的最窄行（脖子比头和肩都窄）。拿它当头部下沿。
  let neckY = -1
  let neckW = Infinity
  for (let y = crownEnd; y < Math.min(H, crownEnd + Math.round(silH * 0.25)); y++) {
    if (rowW[y] > 0 && rowW[y] < neckW) {
      neckW = rowW[y]
      neckY = y
    }
  }
  const headBottom = neckY > 0 ? neckY : crownEnd
  let hMinX = W, hMaxX = -1
  for (let y = minY; y < headBottom; y++) {
    if (rowMin[y] < 0) continue
    if (rowMin[y] < hMinX) hMinX = rowMin[y]
    if (rowMax[y] > hMaxX) hMaxX = rowMax[y]
  }
  const head = { x: hMinX, y: minY, w: hMaxX - hMinX + 1, h: headBottom - minY, cx: Math.round((hMinX + hMaxX) / 2) }

  // 肩线 = 颈线以下第一个「行宽 ≥ 颈部 × 2」的行
  let shoulderY = -1
  for (let y = headBottom; y < H; y++) {
    if (rowW[y] >= neckW * 2 && rowW[y] > 0) {
      shoulderY = y
      break
    }
  }

  // ③ 是否举手：头顶以下 45% 高度内的最大行宽明显大于肩宽
  let widestY = minY
  let widest = 0
  for (let y = minY; y < Math.min(H, minY + silH * 0.45); y++) {
    if (rowW[y] > widest) {
      widest = rowW[y]
      widestY = y
    }
  }
  const shoulderW = shoulderY > 0 ? rowW[shoulderY] : widest

  return {
    name: path.basename(file, '.webp'),
    w: meta.width,
    h: meta.height,
    norm: { W, H },
    silH,
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: silH },
    crown,
    head,
    neckY,
    neckW: neckW === Infinity ? 0 : neckW,
    shoulderY,
    shoulderW,
    widest: { y: widestY, w: widest },
    armsUp: shoulderW > 0 ? +(widest / shoulderW).toFixed(2) : 0,
  }
}

const pct = (v, total) => (v / total) * 100

async function main() {
  const out = []
  for (const [name, file, kind] of FILES) {
    if (!fs.existsSync(file)) {
      console.error(`缺素材 ${file}`)
      process.exit(2)
    }
    const r = await analyze(file)
    r.kind = kind
    out.push(r)
  }
  const base = out[0]
  const NW = base.norm.W

  // 归一化到「图像高度」= 1，便于跨分辨率比较
  const n = (v, H) => +(v / H).toFixed(4)

  // 以 maid-left 为基准算头部中心偏移与尺寸比（一律归一化到图像高度）
  for (const r of out) {
    r.crownCxNorm = n(r.crown.cx, r.norm.H)
    r.crownWNorm = n(r.crown.w, r.norm.H)
    r.headTopNorm = n(r.head.y, r.norm.H)
    r.headWNorm = n(r.head.w, r.norm.H)
    r.headHNorm = n(r.head.h, r.norm.H)
    r.neckNorm = n(r.neckY, r.norm.H)
    r.shoulderNorm = n(r.shoulderY, r.norm.H)
    r.dCx = +(r.crownCxNorm - base.crownCxNorm).toFixed(4)
    r.dTop = +(r.headTopNorm - base.headTopNorm).toFixed(4)
    r.dW = +(r.headWNorm - base.headWNorm).toFixed(4)
  }

  // 聚类：冠部中心 x 相差 ≤ 1.5%H（1080p 上约 16px）。用绝对阈值而不是比例，
  // 因为"能不能硬切"取决于屏幕上的绝对位移，与图像本身的头宽无关。
  const TOL = 0.015
  const groups = []
  for (const r of out.slice().sort((a, b) => Math.abs(a.dCx) - Math.abs(b.dCx) || a.name.localeCompare(b.name))) {
    let g = groups.find((gg) => Math.abs(gg.cx - r.crownCxNorm) <= TOL)
    if (!g) {
      g = { cx: r.crownCxNorm, members: [] }
      groups.push(g)
    }
    g.members.push(r)
  }
  groups.sort((a, b) => b.members.length - a.members.length)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const L = []
  L.push('# DSH_POSES.md — 9 张立绘的姿态比对（FIX.md §5.1a）')
  L.push('')
  L.push('> 由 `tools/pose_report.mjs` 生成（`node tools/pose_report.mjs`）。只读素材，确定性。')
  L.push('> 目的：9 张是同底稿的整身立绘但**姿态不同**，硬切换表情时只有「头部位置最接近」的图之间才不会出现明显头部位移跳变。')
  L.push('')
  L.push('## 方法')
  L.push('')
  L.push(`- 分析分辨率：宽 ${NW}px（源图按比例缩放），alpha 阈值 ${ALPHA_MIN}。`)
  L.push('- **冠部（crown）**：轮廓最顶部 12% 高度的横带。举手的指尖几乎不会高过头顶，所以这条带子基本只含头发/头饰 —— 它是「头在哪里」最稳的代理量，也是本表分组的依据。')
  L.push('- **颈线**：冠部以下 25% 高度内的最窄行（脖子比头和肩都窄），头部包围盒 = 头顶到颈线。')
  L.push('- **肩线**：颈线以下第一个行宽 ≥ 颈部 × 2 的行。')
  L.push('- **举手比**：头顶以下 45% 高度内的最大行宽 ÷ 肩宽；> 1.3 视为「有抬手」。')
  L.push('- 所有尺寸归一化到**图像高度 = 1**（含 x 方向），因此可直接与画面高度相乘（1080p 时 1%H = 10.8px）。')
  L.push(`- 聚类容差：冠部中心 x 相差 ≤ ${(TOL * 100).toFixed(1)}%H（1080p 约 ${(TOL * 1080).toFixed(0)}px）。用**绝对阈值**而不是比例，因为"能不能硬切"取决于屏幕上的绝对位移。`)
  L.push('- 注意：`whale-starry` 双手举在头两侧，冠部横带把双手也框了进去（冠部宽 26.9%H vs 其余 17–20%H），所以它的冠部中心 x 会偏外 —— 这是真实的姿态差异，不是测量误差。')
  L.push('')
  L.push('## 逐图实测')
  L.push('')
  L.push('| 素材 | 源尺寸 | 冠部中心 x | 冠部宽 | 头顶 y | 头宽 | 头高 | 肩线 y | 举手比 | Δ冠部cx | Δ头顶 |')
  L.push('|---|---|---|---|---|---|---|---|---|---|---|')
  for (const r of out) {
    L.push(
      `| \`${r.name}\` | ${r.w}×${r.h} | **${(r.crownCxNorm * 100).toFixed(1)}%H** | ${(r.crownWNorm * 100).toFixed(1)}%H | ` +
        `${(r.headTopNorm * 100).toFixed(1)}%H | ${(r.headWNorm * 100).toFixed(1)}%H | ${(r.headHNorm * 100).toFixed(1)}%H | ` +
        `${r.shoulderY > 0 ? (r.shoulderNorm * 100).toFixed(1) + '%H' : 'n/a'} | ${r.armsUp.toFixed(2)} | ` +
        `${fmtSigned(r.dCx * 100)}%H | ${fmtSigned(r.dTop * 100)}%H |`
    )
  }
  L.push('')
  L.push('## 分组（硬切只在组内进行）')
  L.push('')
  groups.forEach((g, i) => {
    const names = g.members.map((m) => `\`${m.name}\``).join('、')
    const maxD = Math.max(...g.members.map((m) => Math.abs(m.dCx)))
    L.push(`${i + 1}. **组 ${i + 1}**（${g.members.length} 张，头部中心 ≈ ${(g.cx * 100).toFixed(1)}%H，组内最大 Δcx = ${(maxD * 100).toFixed(2)}%H）：${names}`)
  })
  L.push('')
  L.push('## 结论与用法')
  L.push('')
  const alone = groups.filter((g) => g.members.length === 1).map((g) => g.members[0].name)
  const spread = Math.max(...out.map((r) => r.crownCxNorm)) - Math.min(...out.map((r) => r.crownCxNorm))
  const topSpread = Math.max(...out.map((r) => r.headTopNorm)) - Math.min(...out.map((r) => r.headTopNorm))
  L.push(`- 9 张的**冠部中心 x 总跨度只有 ${(spread * 100).toFixed(1)}%H**（1080p 约 ${(spread * 1080).toFixed(0)}px），**头顶 y 总跨度 ${(topSpread * 100).toFixed(1)}%H**（约 ${(topSpread * 1080).toFixed(0)}px）。`)
  L.push(`- 因此共 **${groups.length} 组**：${groups.map((g, i) => `组 ${i + 1} 有 ${g.members.length} 张`).join('、')}。单张成组的：${alone.length ? alone.map((x) => `\`${x}\``).join('、') : '（无）'}。`)
  L.push('')
  L.push('**可执行的换表情规则**：')
  L.push('')
  L.push(`1. **大组内可自由硬切**：${groups[0].members.map((m) => `\`${m.name}\``).join('、')}。头部位置差异 ≤ ${(TOL * 100).toFixed(1)}%H，硬切时头部不跳，只会看到手臂姿态变化（这是允许的）。`)
  if (alone.length) {
    L.push(`2. **${alone.map((x) => `\`${x}\``).join('、')} 单独成组**：头部位置偏外 ${(Math.abs(groups.find((g) => g.members[0].name === alone[0]).cx - groups[0].cx) * 100).toFixed(1)}%H${alone[0] === 'whale-starry' ? '（双手举在头侧，冠部被撑宽）' : ''}。要用它必须先让立绘离场或处于被遮挡/溶解状态，再换进来；不要在画面中央直接切。`)
  }
  L.push(`3. 每次出场最多换 2 次（FIX.md §5.1b）；切换用**硬切 + 一帧色散 + 一次小冲击**，不要用淡化。`)
  L.push('4. 立绘一律**底部锚定**（`standRect` 已如此），这样上面那点头顶差异不会再被放大。')
  L.push('')
  L.push('> 本表由脚本生成，换素材请重跑 `node tools/pose_report.mjs`，不要手改数值。')
  L.push('')
  fs.writeFileSync(OUT, L.join('\n'))

  console.log(`[pose_report] ${OUT}`)
  console.log(`  分析 ${out.length} 张，分组 ${groups.length} 组`)
  for (const [i, g] of groups.entries()) {
    console.log(`  组${i + 1} (cx=${(g.cx * 100).toFixed(1)}%H, ${g.members.length} 张): ${g.members.map((m) => m.name).join(', ')}`)
  }
}

function fmtSigned(v) {
  const s = v.toFixed(2)
  return v > 0 ? `+${s}` : s
}

main()
