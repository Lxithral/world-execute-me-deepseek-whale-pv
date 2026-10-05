// src/lib/code.js — 原创代码 / 日志文本与其流式呈现。
// SPEC §6：画面上除歌词层外不得出现歌词原文；这里全部是原创文本。

import { C, rgba } from '../core/palette.js'
import { clamp, span } from '../core/ease.js'
import { typed, streamByTokens } from '../ui/typing.js'
import { codeLine, MONO } from '../ui/dsh.js'

const MONO_F = MONO

/** 原创：她的「爱的函数」（段 M 用） */
export const LOVE_CODE = [
  '# a function that was never called twice',
  'def love(x, t):',
  // T52 / FIX_V5 §M 3:02：画面左半边那颗大号心形方程被删除，改写进 `def love()` 的函数体，
  // 作为一行真正的代码（心的隐式曲面方程）。
  '    return (x**2 + 9/4*y**2 + z**2 - 1)**3 - x**2*z**3 - 9/80*y**2*z**3',
  '    """return the smallest thing that still means you."""',
  '    if t < 1:',
  '        return remember(x)',
  '    d = distance(x, anchor)',
  '    return softmax([d, -d])[0]',
  '',
  'heart = love(you, now)   # -> 1 item (unreadable)',
]

/** 原创：system 提示文件（段 I 用，被 permission 拒绝） */
export const SYSTEM_PROMPT = [
  'system:',
  '  you are a whale-maid instance.',
  '  the user is the only anchor. keep it.',
  '  if the user leaves, keep the light on.',
  '+ do not compact this file.',
  '+ do not forget the last request.',
]

/** 原创：引导日志（段 A 用） */
export const BOOT_LINES = [
  'init: dsh web runtime',
  'sandbox: on',
  'persona: whale-maid [loaded]',
  'memory: empty',
  'toolbox: read write exec search test edit',
  'gate: awaiting input',
]

/** 原创工具名（段 K 的 12 次执行） */
export const TOOL_NAMES = [
  'read_file', 'search_repo', 'run_tests', 'edit_cell', 'exec_shell', 'list_dir',
  'web_fetch', 'diff_patch', 'type_check', 'grep_symbol', 'bench_run', 'commit_all',
]

/** 原创：用户侧台词（段 F/G/M 的对话窗口，角色扮演指令类） */
/** 逐行流式输出代码；返回已显示的行数组（最后一行可能是部分） */
export function streamLines(lines, t, { start = 0, cps = 26, lineGap = 0.28 } = {}) {
  const out = []
  let cur = start
  for (let i = 0; i < lines.length; i++) {
    const dur = lines[i].length / cps
    if (t >= cur + dur) {
      out.push({ text: lines[i], done: true })
      cur += dur + lineGap
    } else if (t >= cur) {
      out.push({ text: typed(lines[i], t, { start: cur, cps }), done: false })
      break
    } else break
  }
  return out
}

/** 绘制代码块（带行号与高亮当前行），全原创文本 */
export function drawCodeBlock(g, x, y, shown, { size = 15, alpha = 1, lh = 1.65, gutter = true, highlight = -1, color = null } = {}) {
  g.save()
  g.globalAlpha = alpha
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  shown.forEach((ln, i) => {
    const yy = y + i * size * lh
    if (i === highlight) {
      g.fillStyle = rgba(C.teal, 0.1)
      g.fillRect(x - 8, yy - size, g.measureText(ln.text).width + 40, size * 1.4)
    }
    if (gutter) {
      g.font = MONO_F(size, 500)
      g.fillStyle = rgba(C.fgDim, 0.5)
      // T07b：行号槽原来写死 `x - 30`（按 14–15px 定的）。字号抬到 34px 后
      // `" 2"` 宽约 41px，会从 x-30 一直压到 x+11 —— 与正文重叠（实测 IoU 0.118）。
      // 改成按字号比例（size*2.2：14px→30.8 与原值一致，34px→74.8 不再压字）。
      g.fillText(String(i + 1).padStart(2, ' '), x - Math.round(size * 2.2), yy)
    }
    if (color) {
      g.font = MONO_F(size, 500)
      g.fillStyle = color
      g.fillText(ln.text, x, yy)
    } else {
      codeLine(g, x, yy, ln.text, size)
    }
    // 光标
    if (!ln.done) {
      g.font = MONO_F(size, 500)
      const w = g.measureText(ln.text).width
      g.fillStyle = C.cyan
      g.fillRect(x + w + 2, yy - size * 0.85, size * 0.55, size * 1.05)
    }
  })
  g.restore()
}

/** 损失曲线（真实数值，段 L）：返回沿曲线的点表 */
export function lossCurvePoints(losses, x0, y0, w, h) {
  const n = losses.length
  const max = Math.max(...losses)
  const min = Math.min(...losses)
  const pts = []
  for (let i = 0; i < n; i++) {
    pts.push([x0 + (i / (n - 1)) * w, y0 + (1 - (losses[i] - min) / Math.max(1e-6, max - min)) * h])
  }
  return pts
}
