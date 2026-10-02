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

/** 按 t 找覆盖它的场景 */
export function scenesAt(t) {
  return SCENES.filter((s) => t >= s.start && t < s.end)
}

export default SCENES
