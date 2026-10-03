// src/scenes/index.js — 场景注册表。与 DIRECTOR 的段 A–N 一一对应。
//
// 每个场景导出 { id, start, end, title, wip?, init(ctx), render(t, lt, ctx), dispose(), fx? }
// 场景之间不互相引用；公共能力放在 lib/ whale/ ui/。
// 段落边界按 DIRECTOR，且相邻段落不重叠（自检 c 要求重叠 ≤ 0.4s）。

import aBoot from './a_boot.js'
import bDive from './b_dive.js'
import cDefine from './c_define.js'
import dSwitch from './d_switch.js'
import eDeal from './e_deal.js'
import fOmnipotent from './f_omnipotent.js'
import gGlitch from './g_glitch.js'
import hAbsence from './h_absence.js'
import iCleanup from './i_cleanup.js'
import jOverflow from './j_overflow.js'
import kStorm from './k_storm.js'
import lTraining from './l_training.js'
import mAlgebra from './m_algebra.js'
import nHandoff from './n_handoff.js'

export const SCENES = [
  aBoot, bDive, cDefine, dSwitch, eDeal, fOmnipotent, gGlitch,
  hAbsence, iCleanup, jOverflow, kStorm, lTraining, mAlgebra, nHandoff,
].sort((a, b) => a.start - b.start)

// ?demo=1（FIX §5.7 的 P0 验证）：注册演示段，用来肉眼检查
// 「持久 3D 世界 + 相机轨道 + 冲击后处理」。它覆盖全片，不属于影片内容。
// ?demo=props|clock|tunnel|kv|heart|wall|swarm|bridges（F2b）：注册物件库/代码墙/蜂群的演示段。
// ?demo=panes（FIX_V3 §2.2–§2.5）：注册终端屏/显示器/遮挡/运动的验证台。
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')) {
  const q = new URLSearchParams(location.search)
  if (q.get('demo') === 'panes') {
    const { default: demoPane } = await import('./z_demo_pane.js')
    SCENES.push(demoPane)
  } else {
    const { default: demo3d } = await import('./z_demo3d.js')
    const { default: demoF2b } = await import('./z_demo_f2b.js')
    const { f2bMode } = await import('./z_demo_f2b.js')
    SCENES.push(f2bMode() ? demoF2b : demo3d)
  }
  SCENES.sort((a, b) => a.start - b.start)
}

/** 按 t 找覆盖它的场景 */
export function scenesAt(t) {
  return SCENES.filter((s) => t >= s.start && t < s.end)
}

export default SCENES
