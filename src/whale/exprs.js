// src/whale/exprs.js — 情绪角色 → 真实素材映射（SPEC §4.4 + FIX.md §5.1）
//
// FIX.md §5.1 的硬约束：
//   1. **角色集 = 素材集，9 个角色 1:1 对应 9 张图**，不做任何"情绪名的解释性映射"。
//      原因：可用的只有 9 张整身立绘，任何"用 X 冒充 Y"的映射都会导致我们伪造表情。
//   2. **删除角色 closed / dazed / calm**（无对应素材，此前是靠叠加图元伪造的）。
//   3. **删除全部"伪造五官/遮挡"图元**：黑眼睑条、泪滴、垂视线叠加。曾用于 closed / sad。
//   4. 切换用**硬切 + 一帧色散 + 一次小冲击**，不再做 80ms 交叉淡化（姿态不同的整身立绘
//      淡化会露出"两个身体叠在一起"）。
//
// 因此本文件只做三件事：列出 9 个角色、给出姿势分组（供硬切前判断）、提供逐词的硬切查询。

/** 9 个角色 = 9 张素材，1:1。角色名就是素材名（`base` = 主立绘 maid-left）。 */
export const SOURCE = {
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

/** 已删除的角色与原因（保留记录，避免以后又被"补回来"） */
export const REMOVED_ROLES = {
  closed: '无闭眼素材；此前用 cheerful 去色 + 黑色眼睑条伪造 → FIX.md §5.1 明令删除（用户反馈的 0:12 两条黑线就是它）',
  sad: '无失落素材；此前用 exasperated 去色 + 垂视线 + 泪滴伪造 → 属"伪造五官"，一并删除（孤立场面改用 confused 去饱和）',
  dazed: '无恍惚素材；此前借用 exasperated → FIX.md §5.1 明令删除，需要半闭眼时直接用 exasperated',
  calm: '无平静素材；此前借用 serious → FIX.md §5.1 明令删除，需要沉稳时直接用 serious',
  smile: '改用素材名 cheerful',
  wake: '改用素材名 frightened',
  worried: '改用素材名 confused',
  playful: '改用素材名 starry',
  proud: '改用素材名 serious',
  strained: '改用素材名 angry',
  neutral: '改用素材名 base',
}

export const ROLE_NAMES = Object.keys(SOURCE)
export const fileOf = (role) => SOURCE[role] || SOURCE.base
export const hasRole = (role) => Object.prototype.hasOwnProperty.call(SOURCE, role)

/**
 * 姿势分组（由 `tools/pose_report.mjs` 量出，见 docs/DSH_POSES.md）。
 * 同组内冠部中心 x 相差 ≤1.5%H（1080p ≈16px），可以直接硬切；
 * 跨组切换前必须让立绘离场/被遮挡，否则头部会跳。
 */
export const POSE_GROUPS = [
  ['base', 'frightened', 'angry', 'shy', 'exasperated', 'cheerful'],
  ['confused', 'serious'],
  ['starry'], // 双手举在头侧，冠部被撑宽 → 单独一组
]

const GROUP_OF = (() => {
  const m = new Map()
  POSE_GROUPS.forEach((g, i) => g.forEach((r) => m.set(r, i)))
  return m
})()

/** 两个角色能否直接硬切（同组 = 可以） */
export function canHardCut(a, b) {
  if (a === b) return true
  const ga = GROUP_OF.get(a)
  const gb = GROUP_OF.get(b)
  return ga !== undefined && ga === gb
}

/** 为一串 [[t0, role], ...]（必须按 t0 递增）取 t 时刻的角色：硬切，无过渡 */
export function roleAt(t, cues) {
  if (!cues || cues.length === 0) return 'base'
  let role = cues[0][1]
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i][0]) role = cues[i][1]
    else break
  }
  return role
}

/** t 时刻最近一次切换（用于触发一帧色散 + 小冲击）；没有则 null */
export function lastSwitch(t, cues) {
  if (!cues || cues.length === 0) return null
  let prev = null
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i][0]) prev = i
    else break
  }
  if (prev === null) return null
  if (prev === 0 && t < cues[0][0]) return null
  return { t: cues[prev][0], from: prev > 0 ? cues[prev - 1][1] : cues[prev][1], to: cues[prev][1] }
}

/** 是否正处在切换后的头两帧内（≈34ms @60fps）：用来打一帧色散 + 小冲击 */
export function justSwitched(t, cues, win = 0.034) {
  const s = lastSwitch(t, cues)
  return !!s && s.from !== s.to && t - s.t >= 0 && t - s.t < win
}
