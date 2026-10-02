#!/usr/bin/env node
// tools/inventory_whale.mjs  ->  assets/whale_inventory.json
//
// SPEC §4.1：清点参考仓库里的素材，不猜文件名。
//   - 列出每个图像的路径、尺寸、是否带 alpha、alpha 包围盒、文件大小；
//   - 由 AI 依据实际查看结果标注 kind（standing/expression/bg/ui/unknown）与 guessedEmotion；
//   - 拿不准的标 unknown，并在 docs/PROGRESS.md 列出待用户确认。
//
// 同时登记读过的事实来源文件（NOTICE / ASSET_SOURCES / LICENSES / vendor CSS-JS），
// 供阶段 6 生成 public/whale/NOTICE.md 使用。

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const REF = path.join(ROOT, 'refs', 'dsh-pv')
const OUT = path.join(ROOT, 'assets', 'whale_inventory.json')

const ALPHA_MIN = 8 // alpha 大于此值算“不透明”

// —— AI 人工标注表（key = 相对 refs/dsh-pv 的 POSIX 路径）——
// 依据：实际打开图片查看（见 docs/PROGRESS.md 记录）。
// guessedEmotion 用 SPEC §4.4 的角色集：closed neutral wake smile worried
// playful proud dazed sad strained shy calm。
const ANNOTATIONS = {
  'film/third_party_references/whale_maid_expanded_20260926/maid-left.webp': {
    kind: 'standing',
    guessedEmotion: 'neutral',
    role: '主立绘（默认站姿）',
    note: '眼睁开、浅笑、一手抬起；作为 neutral/calm 的基准，也是点云/网格转换的输入。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-angry.webp': {
    kind: 'expression',
    guessedEmotion: 'angry',
    role: 'strained（吃力/愤怒）',
    note: '竖眉、张口、红色发夹。对应角色 strained。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-cheerful.webp': {
    kind: 'expression',
    guessedEmotion: 'cheerful',
    role: 'smile（开心）',
    note: '闭眼笑 + 挥手。对应 smile；也可回退 playful。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-confused.webp': {
    kind: 'expression',
    guessedEmotion: 'confused',
    role: 'worried（担忧）',
    note: '眼睁开、手抚脸、迟疑。对应 worried。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-exasperated.webp': {
    kind: 'expression',
    guessedEmotion: 'exasperated',
    role: 'dazed（恍惚/无奈）',
    note: '半闭眼、无奈。对应 dazed；也是 sad 的近似回退（需降饱和+垂视线处理）。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-frightened.webp': {
    kind: 'expression',
    guessedEmotion: 'frightened',
    role: 'wake（睁眼/惊讶）',
    note: '睁大眼、张口、举手。对应 wake。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-serious.webp': {
    kind: 'expression',
    guessedEmotion: 'serious',
    role: 'proud（庄严/神）/ calm',
    note: '目光坚定、手指向上。对应 proud，兼作 calm 回退。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-shy.webp': {
    kind: 'expression',
    guessedEmotion: 'shy',
    role: 'shy（害羞）',
    note: '脸红、垂目、双手交叠。对应 shy，映射确定。',
  },
  'film/third_party_references/whale_maid_expanded_20260926/expressions/whale-starry.webp': {
    kind: 'expression',
    guessedEmotion: 'starry',
    role: 'playful（俏皮）',
    note: '星光眼、双手举起。对应 playful；也可回退 proud。',
  },
  'film/pv_dsh_frontend_20260927/mem_sprites/cat.png': {
    kind: 'ui',
    guessedEmotion: null,
    role: 'UI 装饰：像素猫贴纸',
    note: '派生自参考项目；段 F「猫」变身可用。',
  },
  'film/pv_dsh_frontend_20260927/mem_sprites/hello.png': {
    kind: 'ui',
    guessedEmotion: null,
    role: 'UI 装饰：对话气泡「你好」',
    note: '派生作品，含中文文本；若用需遵守 SPEC §6（非歌词原创文本）。',
  },
  'film/pv_dsh_frontend_20260927/mem_sprites/last.png': {
    kind: 'ui',
    guessedEmotion: null,
    role: 'UI 装饰：对话气泡「你会一直在吗?」',
    note: '派生作品，含中文文本；语义贴合段 H，但文本是烧进图片的。',
  },
  'film/pv_dsh_frontend_20260927/mem_sprites/wav.png': {
    kind: 'ui',
    guessedEmotion: null,
    role: 'UI 装饰：附件卡片 laugh_….wav',
    note: '派生作品，可作工具调用卡片样式参考。',
  },
}

const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.avif', '.svg'])
const DOC_EXT = new Set(['.css', '.js', '.txt', '.md', '.json'])

function walk(dir, base = dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) out.push(...walk(full, base))
    else out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out
}

async function alphaStats(file) {
  const img = sharp(file, { animated: false })
  const meta = await img.metadata()
  const hasAlpha = !!meta.hasAlpha
  let bbox = null
  let opaqueRatio = null
  if (hasAlpha) {
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height, channels } = info
    let minX = width, minY = height, maxX = -1, maxY = -1, count = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * channels + 3] > ALPHA_MIN) {
          count++
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX >= 0) {
      bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      opaqueRatio = +(count / (width * height)).toFixed(4)
    }
  }
  return { width: meta.width, height: meta.height, hasAlpha, alphaBBox: bbox, opaqueRatio }
}

async function main() {
  if (!fs.existsSync(REF)) {
    console.error(`缺少参考仓库 ${REF}；先执行：git clone --depth 1 https://github.com/MisakaZentai/world-execute-me-dsh-pv refs/dsh-pv`)
    process.exit(2)
  }

  // 清点范围：SPEC §4.1 指定的两处 + 派生 UI 精灵
  const scanDirs = [
    path.join(REF, 'film', 'third_party_references'),
    path.join(REF, 'film', 'vendor'),
    path.join(REF, 'film', 'pv_dsh_frontend_20260927', 'mem_sprites'),
  ]

  const assets = []
  const documents = []
  const unknown = []

  for (const dir of scanDirs) {
    for (const rel of walk(dir, REF)) {
      const full = path.join(REF, rel)
      const ext = path.extname(rel).toLowerCase()
      const bytes = fs.statSync(full).size
      if (IMAGE_EXT.has(ext)) {
        const stats = await alphaStats(full)
        const ann = ANNOTATIONS[rel] || { kind: 'unknown', guessedEmotion: null, role: '', note: '' }
        if (ann.kind === 'unknown') unknown.push(rel)
        assets.push({
          path: rel,
          kind: ann.kind,
          guessedEmotion: ann.guessedEmotion,
          role: ann.role,
          note: ann.note,
          ...stats,
          bytes,
        })
      } else if (DOC_EXT.has(ext)) {
        documents.push({ path: rel, bytes })
      }
    }
  }

  assets.sort((a, b) => a.path.localeCompare(b.path))

  // 依据 SPEC §4.4 角色集，报告每个角色映射到的素材与置信度（低置信度需用户确认）
  const FALLBACKS = {
    closed: { source: 'whale-cheerful / whale-starry（闭眼）+ 去饱和 + 眼罩遮条', confidence: 'low' },
    neutral: { source: 'maid-left', confidence: 'high' },
    wake: { source: 'whale-frightened', confidence: 'high' },
    smile: { source: 'whale-cheerful', confidence: 'high' },
    worried: { source: 'whale-confused', confidence: 'high' },
    playful: { source: 'whale-starry', confidence: 'medium' },
    proud: { source: 'whale-serious', confidence: 'medium' },
    dazed: { source: 'whale-exasperated', confidence: 'medium' },
    sad: { source: 'whale-exasperated + 去色 + 垂视线叠加', confidence: 'low' },
    strained: { source: 'whale-angry', confidence: 'high' },
    shy: { source: 'whale-shy', confidence: 'high' },
    calm: { source: 'whale-serious / maid-left', confidence: 'medium' },
  }

  const payload = {
    generatedAtNote: '由 tools/inventory_whale.mjs 生成；时间戳刻意不写入（保持确定性）',
    source: {
      repo: 'https://github.com/MisakaZentai/world-execute-me-dsh-pv',
      ref: 'refs/dsh-pv',
      license: 'CC BY-NC-SA 4.0（鲸鱼娘美术链）；vendor 下 dsh 前端为 MIT',
    },
    counts: {
      assets: assets.length,
      byKind: assets.reduce((m, a) => ((m[a.kind] = (m[a.kind] || 0) + 1), m), {}),
      documents: documents.length,
      unknown: unknown.length,
    },
    assets,
    documents,
    emotionRoles: FALLBACKS,
    unknown,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')

  console.log(`[inventory_whale] ${OUT}`)
  console.log(`  素材 ${assets.length} 个：${JSON.stringify(payload.counts.byKind)}`)
  for (const a of assets) {
    console.log(
      `    [${a.kind.padEnd(9)}] ${a.guessedEmotion || '-'.padEnd(9)} ${a.width}x${a.height} a=${a.hasAlpha ? 'Y' : 'N'} ` +
        `bbox=${a.alphaBBox ? `${a.alphaBBox.w}x${a.alphaBBox.h}` : '-'} ${(a.bytes / 1024).toFixed(1)}KB  ${a.path}`
    )
  }
  console.log(`  文档 ${documents.length} 个（NOTICE/CSS/JS，见 json）`)
  console.log(`  待确认 unknown：${unknown.length ? unknown.join(', ') : '（无）'}`)
}

main()
