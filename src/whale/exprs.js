// src/whale/exprs.js — 情绪角色 → 真实素材映射（SPEC §4.4）
//
// 角色集：closed neutral wake smile worried playful proud dazed sad strained shy calm
// 素材只有 8 张表情 + 1 张主立绘，因此部分角色需要「最接近的表情 + 着色/叠加图形」补足；
// 缺口按 SPEC §4.2 用去色/位移/图元叠加解决，不重绘面部。低置信项见注释 UNCONFIRMED。

import { span } from '../core/ease.js'

/** 交叉淡化时长（SPEC §4.4：80ms） */
export const XFADE = 0.08

/** public/whale/ 下的文件名 */
export const FILES = {
  base: 'maid-left.webp',
  angry: 'whale-angry.webp',
  cheerful: 'whale-cheerful.webp',
  confused: 'whale-confused.webp',
  exasperated: 'whale-exasperated.webp',
  frightened: 'whale-frightened.webp',
  serious: 'whale-serious.webp',
  shy: 'whale-shy.webp',
  starry: 'whale-starry.webp',
}

/**
 * 角色 → { file, desat?, tint?, overlay? }
 * overlay: 'eyesClosed'（黑色眼睑条）| 'sad'（垂视线 + 泪滴）
 */
export const ROLES = {
  // 主立绘本身就是「睁眼、浅笑、一手抬起」，作常态基准
  neutral: { file: FILES.base },
  smile: { file: FILES.cheerful },
  wake: { file: FILES.frightened },
  worried: { file: FILES.confused },
  // whale-starry 是闭眼星光眼 + 举手，最接近俏皮
  playful: { file: FILES.starry },
  // whale-serious 目光坚定、手指向上 → 庄严/神
  proud: { file: FILES.serious },
  // whale-exasperated 半闭眼无奈 → 恍惚
  dazed: { file: FILES.exasperated },
  strained: { file: FILES.angry },
  shy: { file: FILES.shy },
  // 要求「平静收尾」：serious 是唯一沉稳的素材；UNCONFIRMED（无专属平静表情）
  calm: { file: FILES.serious, tint: '#8fa4c8', tintAmt: 0.25 },
  // UNCONFIRMED：没有真正的闭眼中性素材。用闭眼笑的 cheerful 去色 + 黑眼睑条近似，
  // 只用在「开机闭眼 / 交接后闭眼」这些本来就低细节的时刻（剪影/去色/点云）。
  closed: { file: FILES.cheerful, desat: 0.85, overlay: 'eyesClosed' },
  // UNCONFIRMED：没有失落素材。exasperated 去色 + 垂视线 + 泪滴图元。
  sad: { file: FILES.exasperated, desat: 0.75, overlay: 'sad' },
}

export const ROLE_NAMES = Object.keys(ROLES)

/** 角色用的原图名 */
export const fileOf = (role) => (ROLES[role] || ROLES.neutral).file

/**
 * exprAt(t, cues) — 纯函数：给一串 [[t0, role], ...]，返回该时刻的 {from, to, p}
 * p 为交叉淡化进度（0 → 完全 from，1 → 完全 to）。渲染路径不累积状态。
 */
export function exprAt(t, cues) {
  if (!cues || cues.length === 0) return { from: 'neutral', to: 'neutral', p: 1 }
  let idx = -1
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i][0]) idx = i
    else break
  }
  if (idx < 0) return { from: cues[0][1], to: cues[0][1], p: 1 }
  const cur = cues[idx]
  const nxt = cues[idx + 1]
  if (nxt && t >= nxt[0] - XFADE) {
    return { from: cur[1], to: nxt[1], p: span(t, nxt[0] - XFADE, nxt[0]) }
  }
  return { from: cur[1], to: cur[1], p: 1 }
}

/** 便捷：只取当前角色（用于 UI/日志文案） */
export function roleNow(t, cues) {
  const e = exprAt(t, cues)
  return e.p >= 0.5 ? e.to : e.from
}
