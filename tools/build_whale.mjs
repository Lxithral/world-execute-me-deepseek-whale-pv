#!/usr/bin/env node
// tools/build_whale.mjs -> public/data/whale_{contour,points,mesh}.json
//
// SPEC §4.3：从选定的主立绘产出色轮廓、彩色采样点、三角网格。
// 确定性：固定种子、无 Date/random。
//
// 坐标约定（三个文件一致）：
//   u, v ∈ [0,1]，图像空间，v 向下（0 = 头顶，1 = 脚底）
//   aspect = w / h
//   z 以图像高度为单位（无量纲），便于旋转时呈现厚度
//   颜色 c 打包为 0xRRGGBBAA

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import Delaunator from 'delaunator'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const REF = path.join(ROOT, 'refs', 'dsh-pv')
const SRC = path.join(
  REF,
  'film/third_party_references/whale_maid_expanded_20260926/maid-left.webp'
)
const OUTDIR = path.join(ROOT, 'public', 'data')

const SEED = 20261002
const ALPHA_MIN = 8
const WORK_W = 561 // 工作宽度（约源图一半）；高度按比例
const MAX_CONTOUR = 1500
const MAX_POINTS = 8000
const MIN_TRIS = 400
const MAX_TRIS = 800

// ---------- 确定性随机（与 src/core/rng.js 同源） ----------
function hash01(i, seed = 0) {
  let x = (i | 0) ^ Math.imul(seed | 0, 0x9e3779b9)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

// ---------- marching squares ----------
function marchingSquares(alpha, W, H, thr) {
  const segs = []
  const at = (x, y) => alpha[y * W + x]
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1)
      let idx = 0
      if (tl > thr) idx |= 8
      if (tr > thr) idx |= 4
      if (br > thr) idx |= 2
      if (bl > thr) idx |= 1
      if (idx === 0 || idx === 15) continue
      // 边上的插值点
      const top = () => [x + (thr - tl) / (tr - tl || 1), y]
      const right = () => [x + 1, y + (thr - tr) / (br - tr || 1)]
      const bottom = () => [x + (thr - bl) / (br - bl || 1), y + 1]
      const left = () => [x, y + (thr - tl) / (bl - tl || 1)]
      const push = (a, b) => segs.push([a[0], a[1], b[0], b[1]])
      switch (idx) {
        case 1: push(left(), bottom()); break
        case 2: push(bottom(), right()); break
        case 3: push(left(), right()); break
        case 4: push(right(), top()); break
        case 5: push(left(), top()); push(bottom(), right()); break
        case 6: push(bottom(), top()); break
        case 7: push(left(), top()); break
        case 8: push(top(), left()); break
        case 9: push(top(), bottom()); break
        case 10: push(top(), right()); push(bottom(), left()); break
        case 11: push(top(), right()); break
        case 12: push(right(), left()); break
        case 13: push(right(), bottom()); break
        case 14: push(bottom(), left()); break
      }
    }
  }
  // 把线段缝合成闭合折线
  const key = (x, y) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`
  const map = new Map()
  segs.forEach((s, i) => {
    const a = key(s[0], s[1]), b = key(s[2], s[3])
    if (!map.has(a)) map.set(a, [])
    if (!map.has(b)) map.set(b, [])
    map.get(a).push(i)
    map.get(b).push(i)
  })
  const used = new Uint8Array(segs.length)
  const loops = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const loop = [segs[i][0], segs[i][1], segs[i][2], segs[i][3]]
    const head = key(segs[i][0], segs[i][1])
    let tail = key(segs[i][2], segs[i][3])
    let guard = 0
    while (tail !== head && guard++ < segs.length) {
      const cands = map.get(tail)
      let nxt = -1
      if (cands) for (const c of cands) { if (!used[c]) { nxt = c; break } }
      if (nxt < 0) break
      used[nxt] = 1
      const s = segs[nxt]
      const ka = key(s[0], s[1]), kb = key(s[2], s[3])
      if (ka === tail) { loop.push(s[2], s[3]); tail = kb }
      else { loop.push(s[0], s[1]); tail = ka }
    }
    if (loop.length >= 8) loops.push(loop)
  }
  return loops
}

// ---------- Ramer–Douglas–Peucker ----------
function rdp(pts, eps) {
  if (pts.length < 6) return pts
  const keep = new Uint8Array(pts.length / 2)
  keep[0] = 1
  keep[pts.length / 2 - 1] = 1
  const stack = [[0, pts.length / 2 - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    if (b - a < 2) continue
    const ax = pts[a * 2], ay = pts[a * 2 + 1]
    const bx = pts[b * 2], by = pts[b * 2 + 1]
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let best = -1, bestD = -1
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2], py = pts[i * 2 + 1]
      const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len
      if (d > bestD) { bestD = d; best = i }
    }
    if (bestD > eps) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  const out = []
  for (let i = 0; i < keep.length; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1])
  return out
}

function countPts(loops) {
  return loops.reduce((s, l) => s + l.length / 2, 0)
}

/** 闭合环先去掉重复的收尾点再简化，最后补回收尾点保持闭合 */
function simplifyLoop(l, eps) {
  const n = l.length / 2
  const closed = n > 2 && Math.abs(l[0] - l[(n - 1) * 2]) < 1e-6 && Math.abs(l[1] - l[(n - 1) * 2 + 1]) < 1e-6
  const pts = closed ? l.slice(0, (n - 1) * 2) : l
  let out = rdp(pts, eps)
  if (closed && out.length >= 4) out = out.concat([out[0], out[1]])
  return out
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`缺少主立绘 ${SRC}`)
    process.exit(2)
  }
  const meta = await sharp(SRC).metadata()
  const W = WORK_W
  const H = Math.round((meta.height / meta.width) * W)
  const { data } = await sharp(SRC)
    .resize(W, H, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const aspect = meta.width / meta.height
  const px = (x, y) => {
    const i = (y * W + x) * 4
    return [data[i], data[i + 1], data[i + 2], data[i + 3]]
  }

  // ---------- 1) 轮廓 ----------
  const alpha = new Uint8Array(W * H)
  let opaque = 0
  let lumSum = 0
  const lum = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const a = data[i * 4 + 3]
    alpha[i] = a
    if (a > ALPHA_MIN) {
      opaque++
      const l = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
      lum[i] = l
      lumSum += l
    }
  }
  const meanLum = lumSum / Math.max(1, opaque)

  let loops = marchingSquares(alpha, W, H, ALPHA_MIN)
  loops = loops.filter((l) => l.length / 2 >= 10) // 丢掉噪点/未闭合碎链
  loops.sort((a, b) => b.length - a.length)
  let eps = 0.35
  let simplified = loops.map((l) => simplifyLoop(l, eps))
  let guard = 0
  while (countPts(simplified) > MAX_CONTOUR && eps < 12 && guard++ < 60) {
    eps *= 1.25
    simplified = loops.map((l) => simplifyLoop(l, eps))
  }
  const contourLoops = simplified
    .filter((l) => l.length >= 8)
    .map((l) => Array.from(l, (v, i) => +(v / (i % 2 === 0 ? W : H)).toFixed(5)))
  const contourTotal = countPts(contourLoops)

  // ---------- 2) 点云 ----------
  // 抖动网格采样
  const targetOpaque = Math.min(MAX_POINTS, Math.round(opaque * 0.6))
  const step = Math.max(1, Math.sqrt(opaque / Math.max(1, targetOpaque)))
  const cand = []
  for (let gy = 0, ry = 0; gy < H; gy += step, ry++) {
    for (let gx = 0, rx = 0; gx < W; gx += step, rx++) {
      const cx = gx + (hash01(ry * 7919 + rx, SEED) - 0.5) * step * 0.9
      const cy = gy + (hash01(ry * 7919 + rx + 104729, SEED) - 0.5) * step * 0.9
      const x = Math.max(0, Math.min(W - 1, Math.round(cx)))
      const y = Math.max(0, Math.min(H - 1, Math.round(cy)))
      if (alpha[y * W + x] <= ALPHA_MIN) continue
      cand.push([x, y])
    }
  }
  // 需要时按确定性哈希抽稀，保持覆盖均匀
  let sel = cand
  if (cand.length > MAX_POINTS) {
    sel = cand
      .map((p, i) => [hash01(i, SEED ^ 0x5bd1), p])
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_POINTS)
      .map((e) => e[1])
  }
  sel.sort((a, b) => a[1] - b[1] || a[0] - b[0])

  // 身体中轴与半宽（按行统计不透明范围）
  const rowMin = new Int32Array(H).fill(W)
  const rowMax = new Int32Array(H).fill(-1)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha[y * W + x] > ALPHA_MIN) {
        if (x < rowMin[y]) rowMin[y] = x
        if (x > rowMax[y]) rowMax[y] = x
      }
    }
  }
  const ptsU = [], ptsV = [], ptsZ = [], ptsC = []
  for (const [x, y] of sel) {
    const [r, g, b, a] = px(x, y)
    const lo = rowMin[y], hi = rowMax[y]
    const cx = (lo + hi) / 2
    const halfW = Math.max(1, (hi - lo) / 2)
    const nx = (x - cx) / halfW // -1..1，0 = 中轴
    const thick = Math.sqrt(Math.max(0, 1 - nx * nx)) // 边缘→0，中轴→1
    // 亮度居中：亮=前(+z)，暗=后(−z)；再乘以厚度，使侧影边缘 z→0
    const l = lum[y * W + x] || 0
    const centered = (l - meanLum) / Math.max(0.08, meanLum)
    const jit = (hash01(x * 31 + y, SEED ^ 0x1234) - 0.5) * 0.06
    const z = thick * (centered * 0.5 + jit)
    ptsU.push(+(x / W).toFixed(5))
    ptsV.push(+(y / H).toFixed(5))
    ptsZ.push(+z.toFixed(4))
    ptsC.push(((r << 24) | (g << 16) | (b << 8) | a) >>> 0)
  }

  // ---------- 3) 网格（Delaunay） ----------
  // 轮廓抽稀点 + 内部采样点共同剖分；用重心格点采样做「在形体内」校验，
  // 过滤掉跨越凹形区域的长薄三角；再按密度搜索落到 400–800 个。
  const minEdgeLimit = Math.min(W, H) * 0.11
  const inside = (x, y) => {
    const xi = Math.max(0, Math.min(W - 1, Math.round(x)))
    const yi = Math.max(0, Math.min(H - 1, Math.round(y)))
    return alpha[yi * W + xi] > ALPHA_MIN
  }

  function buildMesh(innerStep) {
    const pts = []
    const seen = new Set()
    const add = (x, y) => {
      const k = `${Math.round(x)},${Math.round(y)}`
      if (seen.has(k)) return
      seen.add(k)
      pts.push([x, y])
    }
    for (const l of contourLoops) {
      const n = l.length / 2
      const stride = Math.max(1, Math.round(n / 80))
      for (let i = 0; i < n; i += stride) add(l[i * 2] * W, l[i * 2 + 1] * H)
    }
    const off = innerStep / 2
    for (let y = off; y < H; y += innerStep) {
      for (let x = off; x < W; x += innerStep) {
        if (inside(x, y)) add(x, y)
      }
    }
    if (pts.length < 4) return []
    const coords = new Float64Array(pts.length * 2)
    pts.forEach((p, i) => { coords[i * 2] = p[0]; coords[i * 2 + 1] = p[1] })
    const tris = new Delaunator(coords).triangles
    const out = []
    const N = 4
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2]
      const ax = coords[a * 2], ay = coords[a * 2 + 1]
      const bx = coords[b * 2], by = coords[b * 2 + 1]
      const cx2 = coords[c * 2], cy2 = coords[c * 2 + 1]
      const maxEdge = Math.max(
        Math.hypot(bx - ax, by - ay),
        Math.hypot(cx2 - bx, cy2 - by),
        Math.hypot(ax - cx2, ay - cy2)
      )
      if (maxEdge > minEdgeLimit) continue
      let tot = 0, ins = 0
      for (let pi = 0; pi <= N; pi++) {
        for (let pj = 0; pj <= N - pi; pj++) {
          const pk = N - pi - pj
          const u = pi / N, v = pj / N, w2 = pk / N
          tot++
          if (inside(ax * u + bx * v + cx2 * w2, ay * u + by * v + cy2 * w2)) ins++
        }
      }
      if (ins / tot < 0.86) continue
      const mx = (ax + bx + cx2) / 3, my = (ay + by + cy2) / 3
      const xi = Math.max(0, Math.min(W - 1, Math.round(mx)))
      const yi = Math.max(0, Math.min(H - 1, Math.round(my)))
      let r = 0, g = 0, bl = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const sx = Math.max(0, Math.min(W - 1, xi + dx))
          const sy = Math.max(0, Math.min(H - 1, yi + dy))
          const o = (sy * W + sx) * 4
          r += data[o]; g += data[o + 1]; bl += data[o + 2]; n++
        }
      }
      // 注意：颜色键用 cr/cg/cb，避免与顶点索引 b 冲突
      out.push({ a, b, c, cr: Math.round(r / n), cg: Math.round(g / n), cb: Math.round(bl / n) })
    }
    return { tris: out, coords }
  }

  // 密度搜索：选一个让有效三角落在 [MIN_TRIS, MAX_TRIS] 的步长
  let mesh = null
  let usedStep = 0
  for (const step of [5, 6, 7, 8, 9, 10, 12, 14, 17, 20, 24, 28, 34]) {
    const m = buildMesh(step)
    const n = m.tris.length
    if (!mesh || Math.abs(n - 620) < Math.abs(mesh.tris.length - 620)) {
      mesh = m
      usedStep = step
    }
    if (n >= MIN_TRIS && n <= MAX_TRIS) { mesh = m; usedStep = step; break }
  }
  const coords = mesh.coords
  let chosen = mesh.tris
  if (chosen.length > MAX_TRIS) {
    chosen = chosen
      .map((t, i) => [hash01(i, SEED ^ 0xbeef), t])
      .sort((p, q) => p[0] - q[0])
      .slice(0, MAX_TRIS)
      .map((e) => e[1])
  }

  const verts = []
  const vIndex = new Map()
  const trisFlat = []
  const triColors = []
  for (const t of chosen) {
    const ids = [t.a, t.b, t.c].map((vi) => {
      if (vIndex.has(vi)) return vIndex.get(vi)
      const id = verts.length / 2
      verts.push(+(coords[vi * 2] / W).toFixed(5), +(coords[vi * 2 + 1] / H).toFixed(5))
      vIndex.set(vi, id)
      return id
    })
    trisFlat.push(ids[0], ids[1], ids[2])
    triColors.push(t.cr, t.cg, t.cb)
  }

  // ---------- 输出 ----------
  fs.mkdirSync(OUTDIR, { recursive: true })
  const common = { src: path.basename(SRC), w: meta.width, h: meta.height, aspect: +aspect.toFixed(5) }
  const contourDoc = {
    ...common,
    note: 'loops 为归一化图像空间折线（u∈[0,1] 向右，v∈[0,1] 向下），每两个数一个点；闭合环。',
    loops: contourLoops,
    totalPoints: contourTotal,
  }
  const pointsDoc = {
    ...common,
    note: 'u,v 归一化图像空间（v 向下）；z 以图像高度为单位（亮度+中轴距离合成厚度）；c 打包 0xRRGGBBAA。索引稳定。',
    count: ptsU.length,
    u: ptsU, v: ptsV, z: ptsZ, c: ptsC,
  }
  const meshDoc = {
    ...common,
    note: 'verts 为归一化图像空间顶点（u,v 交替）；tris 为顶点索引三元组；colors 每三角 r,g,b（0..255）。',
    triangleCount: trisFlat.length / 3,
    vertexCount: verts.length / 2,
    verts, tris: trisFlat, colors: triColors,
  }
  const w = (n, o) => {
    fs.writeFileSync(path.join(OUTDIR, n), JSON.stringify(o, null, 0) + '\n')
    console.log(`  ${n}  ${(fs.statSync(path.join(OUTDIR, n)).size / 1024).toFixed(1)} KB`)
  }
  console.log('[build_whale] 源：' + common.src + `  工作分辨率 ${W}x${H}`)
  console.log(`  轮廓环 ${contourLoops.length} 个 / ${contourTotal} 点（≤${MAX_CONTOUR}）eps=${eps.toFixed(2)}`)
  console.log(`  点云 ${ptsU.length} 点（≤${MAX_POINTS}） 候选 ${cand.length}`)
  console.log(`  网格 ${trisFlat.length / 3} 三角 / ${verts.length / 2} 顶点（目标 ${MIN_TRIS}-${MAX_TRIS}）`)
  w('whale_contour.json', contourDoc)
  w('whale_points.json', pointsDoc)
  w('whale_mesh.json', meshDoc)

  // ---------- 4) 复制实际用到的素材到 public/whale/ ----------
  // 只用主立绘 + 8 表情 + 像素猫贴纸；hello/last 的中文文本烧进图片，与 SPEC §6 冲突，故不用。
  const WHALE_SRC = path.join(REF, 'film/third_party_references/whale_maid_expanded_20260926')
  const MEM_SRC = path.join(REF, 'film/pv_dsh_frontend_20260927/mem_sprites')
  const PUB = path.join(ROOT, 'public', 'whale')
  const EXPR_FILES = [
    'whale-angry.webp',
    'whale-cheerful.webp',
    'whale-confused.webp',
    'whale-exasperated.webp',
    'whale-frightened.webp',
    'whale-serious.webp',
    'whale-shy.webp',
    'whale-starry.webp',
  ]
  const used = [
    [path.join(WHALE_SRC, 'maid-left.webp'), 'maid-left.webp'],
    ...EXPR_FILES.map((f) => [path.join(WHALE_SRC, 'expressions', f), f]),
    [path.join(MEM_SRC, 'cat.png'), 'cat.png'],
  ]
  used.push([path.join(MEM_SRC, 'cat.png'), 'cat.png'])
  fs.mkdirSync(PUB, { recursive: true })
  let copied = 0
  for (const [from, name] of used) {
    if (!fs.existsSync(from)) { console.error(`  ! 缺素材 ${from}`); continue }
    fs.copyFileSync(from, path.join(PUB, name))
    copied++
  }
  console.log(`  public/whale/ 复制 ${copied} 个素材`)
}

main()
