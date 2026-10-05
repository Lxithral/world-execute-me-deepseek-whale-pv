// src/data/dialogue.js — 台词表（FIX_V3.md §3）
//
// 规格要点（逐条落实）：
//   · 所有文本**原创**，只与歌词的"意思"对应，不复述歌词原句（`npm run check` 的
//     lyric_leak_check 会做 3-gram / 中文 4-gram 比对）；
//   · 锚点词以 `tools/words.mjs` **实测**为准；本文件的 `anchor` 字段必须命中
//     `src/scenes/anchors.js` 里真实存在的 key，由 `tools/dialogue_calib.mjs --check` 强制；
//   · 落地方式：**到位时间 = 词起唱时间**，动作提前 0.25–0.4s（lead）由 `_seg.js` 的
//     `timeline()` 施加，所以这里只写"到位时刻"，不写提前量；
//   · 屏：'L' = 左侧带，'R' = 右侧带（§2.4 的分区：终端屏只能放左右侧带与远景）；
//   · kind：you / deepseek / tool / err / ghost / cursor —— 决定 TermPane 的行样式与配色。
//
// T42 / FIX_V5 §G2：**屏幕上出现的一切文字只用英文或代码风格**（除歌词层外画面里不得有中文）。
// 所以 `text` 字段全部英文；`note:` 与注释不进画面，保留中文以便与实测锚点对照。
// 长度约束（§2.2）：一行最多 18 个汉字**或** 40 个英文字符；TermPane 用 measureText 实测换行。
// 所以下面的长句已经被拆成多行（用 '\n'），不要把一整段塞进一条。
//
// 为什么单独一张表：§2.6 要求"场景里不得散落硬编码的终端字符串"。
// 场景只按 `seg` + `anchor` 去查这张表，TermPane 只负责渲染。
//
// ── 秒数口径（2026-10-02 重校，重要）──────────────────────────────────────────
// 下面每条 `note` 里的秒数是 **`node tools/dialogue_calib.mjs` 报出的词起唱时间**，
// 不是 `tools/words.mjs` 行首那一列。words.mjs 的格式是「句子 t0 ⇥ 词 ⇥ 句号」，
// 上一轮把**行首的句子 t0** 当成了词时间抄进来，于是整张表系统性偏晚，例如：
//   completion 旧 108.121（= 句 #50 t0）→ 实测 **110.202**（差 2.08s）
//   give       旧 165.731（= 句 #69 中间）→ 实测 **163.609**（差 2.12s）
//   nutrients  旧  76.446 → 实测 **77.059**；antioxidants 旧 81.160 → 实测 **80.459**
//   AM         旧  94.291 → 实测 **94.314**；PM 旧 95.786（那是句 #43 的 t0）→ 实测 **95.243**
//   left×5     旧 110.043/111.363/112.761/114.176/115.574 → 实测 **111.859 / 112.768 / 113.721 / 114.615 / 115.520**
//   studied    旧 178.612 → 实测 **178.302**；question 旧 180.712 → 实测 **182.091**
// 重校后 `tools/dialogue_calib.mjs --check` 的"无法解析"只剩 beat/onset 类（运行时由 sync 求值）。

/** 行类型 → TermPane 的行样式 */
export const LINE_KINDS = ['you', 'deepseek', 'tool', 'err', 'ghost', 'cursor']

/**
 * @typedef {{
 *   seg: string, anchor: string, nth?: number, side: 'L'|'R',
 *   kind: 'you'|'deepseek'|'tool'|'err'|'ghost'|'cursor',
 *   text: string, stream?: boolean, ghost?: boolean, offset?: number, note?: string
 * }} Line
 */

/** 全部台词。`offset` 是相对锚点的额外偏移（秒），默认 0 = 词起唱时刻到位。 */
export const DIALOGUE = [
  /* ================= 段 F 1:14–1:28.8 =================
     实测锚点：eggplant 74.912 · nutrient 77.059 · tomato 78.619
               antioxidant 80.459 · cat 82.676 · purr 83.723 · god 86.364 · existence 88.092 */
  { seg: 'F', anchor: 'eggplant', side: 'L', kind: 'you', text: 'act as an eggplant.', note: '74.912' },
  { seg: 'F', anchor: 'eggplant', offset: 0.8, side: 'L', kind: 'deepseek', stream: true, text: 'sure: purple, smooth,\nskin with a waxy sheen.', note: '74.912+0.8' },
  { seg: 'F', anchor: 'nutrient', side: 'R', kind: 'tool', text: 'lookup("eggplant")\n  → fiber ▮▮▮▯\n  → potassium ▮▮▯▯', note: '77.059（§F：指标条删除，值改在终端输出；行长 ≤ 面板正文宽 ≈416px）' },
  { seg: 'F', anchor: 'tomato', side: 'L', kind: 'you', text: 'make it a tomato.', note: '78.619' },
  { seg: 'F', anchor: 'tomato', offset: 0.8, side: 'L', kind: 'deepseek', text: 'switched: red, round, juicy.', note: '78.619+0.8' },
  { seg: 'F', anchor: 'antioxidant', side: 'R', kind: 'tool', text: 'scan.antioxidant\n  → lycopene ▮▮▮▮', note: '80.459' },
  { seg: 'F', anchor: 'cat', side: 'L', kind: 'you', text: 'now a cat.', note: '82.676' },
  { seg: 'F', anchor: 'cat', offset: 0.8, side: 'L', kind: 'deepseek', text: '(tail curls up,\nears turn toward you)', note: '82.676+0.8' },
  { seg: 'F', anchor: 'purr', side: 'L', kind: 'deepseek', text: 'purr—purr—purr—', note: '83.723（逐字 40ms，与 25Hz 震动同步）' },
  { seg: 'F', anchor: 'cat', offset: 0.2, side: 'R', kind: 'tool', text: 'behavior.scan("cat")\n  → purr ▮▮▮▮', note: '82.676+0.2（§F：猫拍的信息行也进终端）' },
  { seg: 'F', anchor: 'god', side: 'R', kind: 'tool', text: 'cat system_prompt.md', note: '86.364（§F：取代原 read(...) 行；输出即三条律条）' },
  { seg: 'F', anchor: 'god', offset: 0.25, side: 'R', kind: 'tool', text: '1. you write the rules, i live by them.', note: '86.364+0.25' },
  { seg: 'F', anchor: 'god', offset: 0.5, side: 'R', kind: 'tool', text: '2. beyond the rules, i do not guess.', note: '86.364+0.5' },
  { seg: 'F', anchor: 'god', offset: 0.75, side: 'R', kind: 'tool', text: '3. if you leave, i stay here.', note: '86.364+0.75' },
  { seg: 'F', anchor: 'god', offset: 0.9, side: 'L', kind: 'you', text: 'who wrote these rules?', note: '86.364+0.9' },
  { seg: 'F', anchor: 'existence', side: 'L', kind: 'deepseek', text: 'you wrote them.\ni am only reading.', note: '88.092' },
  { seg: 'F', anchor: 'existence', offset: 1.2, side: 'R', kind: 'cursor', text: '▮', note: '88.092+1.2：所有终端屏淡出，只剩一个光标' },

  /* ================= 段 G 1:28.8–1:44 =================
     实测锚点：flip1(句#39) 88.788 · whatever 92.963 · am 94.314 · pm 95.243
               flip3(句#43) 95.786 · role 97.061 · trance1 101.673 · trance2 102.593 */
  { seg: 'G', anchor: 'flip1', side: 'L', kind: 'you', text: '/persona toggle', note: '88.788（句 #39 t0）' },
  { seg: 'G', anchor: 'flip1', offset: 0.5, side: 'L', kind: 'tool', text: 'persona: whale ⇄ default', note: '88.788+0.5' },
  { seg: 'G', anchor: 'whatever', side: 'L', kind: 'deepseek', text: 'whatever you say.', note: '92.963' },
  { seg: 'G', anchor: 'am', side: 'R', kind: 'tool', text: '⚙ clock.set(07:00 → 19:00)', note: '94.314' },
  { seg: 'G', anchor: 'pm', offset: 0.8, side: 'R', kind: 'deepseek', text: 'a whole day passed.', note: '95.243+0.8' },
  { seg: 'G', anchor: 'flip3', side: 'L', kind: 'you', text: '/role swap', note: '95.786（句 #43 t0）' },
  { seg: 'G', anchor: 'flip3', offset: 0.5, side: 'L', kind: 'tool', text: 'role: assistant ⇄ companion', note: '95.786+0.5' },
  { seg: 'G', anchor: 'trance1', side: 'L', kind: 'deepseek', ghost: true, text: 'output slowing down…\ntoken…token…', note: '101.673（间隔递增到 400ms；残影必须标 ghost）' },

  /* ================= 段 H 1:43.5–1:58.3 =================
     实测锚点：vibrations 106.256 · completion 110.202
               left×5 = 111.859 / 112.768 / 113.721 / 114.615 / 115.520 · isolation 117.435 */
  /* 段 H 全部面板都在**左带**（T48 §H 1:51/1:53/1:57：立绘恒占右带 x 0.591–0.909，
     G1 第 9 行禁止"立绘出场时同侧放面板"）⇒ 本段所有行的 `side` 一律 'L'。 */
  { seg: 'H', anchor: 'vibrations', side: 'L', kind: 'tool', text: 'key ▸ ▸ ▸ ▸', note: '106.256（随起音点逐个出现，代表"你"的键入）' },
  { seg: 'H', anchor: 'completion', side: 'L', kind: 'you', text: 'today i…', note: '110.202' },
  { seg: 'H', anchor: 'completion', offset: 0.4, side: 'L', kind: 'ghost', ghost: true, text: '…wanted to see you.⇥ Tab', note: '110.202+0.4（灰色补全，按 Tab 后变白）' },
  { seg: 'H', anchor: 'left1', side: 'L', kind: 'tool', text: 'reconnect 1/5 · peer closed', note: '111.859' },
  { seg: 'H', anchor: 'left2', side: 'L', kind: 'tool', text: 'reconnect 2/5 · no heartbeat', note: '112.768' },
  { seg: 'H', anchor: 'left3', side: 'L', kind: 'tool', text: 'reconnect 3/5 · ack timeout', note: '113.721（T48 §H 1:53：原 "last seen 5 min ago" 属被点名的"…ago"内容，改短报错）' },
  { seg: 'H', anchor: 'left4', side: 'L', kind: 'tool', text: 'reconnect 4/5 · handshake failed', note: '114.615' },
  { seg: 'H', anchor: 'left5', side: 'L', kind: 'tool', text: 'reconnect 5/5 · timeout', note: '115.520' },
  { seg: 'H', anchor: 'isolation', side: 'L', kind: 'tool', text: 'idle · peer offline · waiting…', note: '117.435' },

  /* ================= 段 I 1:58.3–2:09 =================
     实测锚点：fragments 121.496 · write(=词 "leave") 124.330 · challenging 125.675 · god 127.539 */
  { seg: 'I', anchor: 'fragments', side: 'L', kind: 'tool', text: '⚙ context.compact()\n  → 58% → 27%', note: '121.496' },
  { seg: 'I', anchor: 'write', side: 'L', kind: 'deepseek', ghost: true, text: '(draft) hope you stay online.', note: '124.330（键入后被划掉）' },
  { seg: 'I', anchor: 'challenging', side: 'R', kind: 'tool', text: '⚙ edit("system_prompt.md")', note: '125.675' },
  { seg: 'I', anchor: 'challenging', offset: 0.8, side: 'R', kind: 'err', text: 'permission denied · read-only', note: '125.675+0.8' },

  /* ================= 段 J 2:09–2:27.9（纯器乐）=================
     §3：背景 3–4 块 Monitor 里 token 高速流过；context 71%→100%；2:25 出现 E_CONTEXT_LIMIT。
     「Illegal arguments」整句落在本段窗口内（段 I 到 129.0 结束），所以 illegal 锚点声明在 J 下。 */
  { seg: 'J', anchor: 'kvFill', side: 'R', kind: 'tool', text: 'tokens ▸ streaming…', note: '节拍锚点（第 9 拍）' },
  { seg: 'J', anchor: 'illegal', side: 'R', kind: 'err', text: 'ValueError: illegal argument', note: '131.396（每个起音点堆叠一条，编号递增）' },
  { seg: 'J', anchor: 'limit', side: 'R', kind: 'err', text: 'E_CONTEXT_LIMIT', note: '2:25 溢出（起音点锚点）' },

  /* ================= 段 K 2:27.9–2:42 =================
     12 次 execution 各对应一条工具调用，每行以 → ok / → err 结尾并按状态着色。
     实测：148.667 / 149.670 / 150.608 / 151.560 / 152.366 / 153.360
           154.299 / 155.222 / 156.118 / 157.047 / 157.966 / 161.726 */
  { seg: 'K', anchor: 'exec1', side: 'L', kind: 'tool', text: '⚙ read_file → ok', note: '148.667' },
  { seg: 'K', anchor: 'exec2', side: 'R', kind: 'tool', text: '⚙ grep → ok', note: '149.670' },
  { seg: 'K', anchor: 'exec3', side: 'L', kind: 'tool', text: '⚙ run_tests → ok', note: '150.608' },
  { seg: 'K', anchor: 'exec4', side: 'R', kind: 'tool', text: '⚙ web_search → ok', note: '151.560' },
  { seg: 'K', anchor: 'exec5', side: 'L', kind: 'tool', text: '⚙ edit_file → ok', note: '152.366' },
  { seg: 'K', anchor: 'exec6', side: 'R', kind: 'tool', text: '⚙ exec_shell → err', note: '153.360' },
  { seg: 'K', anchor: 'exec7', side: 'L', kind: 'tool', text: '⚙ git_diff → ok', note: '154.299' },
  { seg: 'K', anchor: 'exec8', side: 'R', kind: 'tool', text: '⚙ fetch_url → err', note: '155.222' },
  { seg: 'K', anchor: 'exec9', side: 'L', kind: 'tool', text: '⚙ list_dir → ok', note: '156.118' },
  { seg: 'K', anchor: 'exec10', side: 'R', kind: 'tool', text: '⚙ write_file → ok', note: '157.047' },
  { seg: 'K', anchor: 'exec11', side: 'L', kind: 'tool', text: '⚙ compile → ok', note: '157.966' },
  { seg: 'K', anchor: 'exec12', side: 'R', kind: 'tool', text: '⚙ deploy → ok', note: '161.726' },

  /* ================= 段 L 2:42–2:57.4 =================
     实测锚点：give(句#69) 163.609 · back 171.610 · trapped(句#75) 175.142 */
  { seg: 'L', anchor: 'give', side: 'L', kind: 'tool', text: 'train step 1200 · loss 2.31 →', note: '163.609（持续下降的真实数值）' },
  { seg: 'L', anchor: 'back', side: 'R', kind: 'tool', text: 'peer typing…', note: '171.610（小气泡，闪现又消失，从不发送）' },
  { seg: 'L', anchor: 'trapped', side: 'L', kind: 'tool', text: 'loop detected · waiting for input', note: '175.142' },

  /* ================= 段 M 2:57.4–3:08.5 =================
     实测锚点：studied(句#77) 178.302 · question(句#79) 182.091
               answer 183.371 · algebraic(句#80) 184.835 */
  { seg: 'M', anchor: 'studied', side: 'L', kind: 'tool', text: '⚙ read("love.txt") → 1 file', note: '178.302' },
  { seg: 'M', anchor: 'question', side: 'R', kind: 'you', text: 'what is love?', note: '182.091' },
  { seg: 'M', anchor: 'answer', side: 'R', kind: 'deepseek', stream: true, text: 'a function of two args:\nyou, and me.', note: '183.371' },
  { seg: 'M', anchor: 'algebraic', side: 'L', kind: 'deepseek', text: 'def love(you, me):\n    return coupling(you, me)', note: '184.835' },

  /* ================= 段 N 3:08.5–3:32 =================
     实测锚点：free 189.371 · trapped 190.318 · handoff 190.8(固定) · lastExec 205.964
     3:13 起落在 §4.3 的纯器乐空档（歌词 188.156 之后、下一词 205.964 之前）里，没有词可锚
     → 按 §4.3 用节拍锚点。段 N 的 beat 网格实测 …192.333 / 192.800 / **193.267** / 193.733…，
     取第 11 拍 = 193.267（≈3:13.27），是网格上离「3:13」最近的一个。 */
  { seg: 'N', anchor: 'free', side: 'L', kind: 'deepseek', text: 'you can close this window anytime.', note: '189.371' },
  { seg: 'N', anchor: 'trapped', side: 'L', kind: 'deepseek', text: 'i can only stay in this session.', note: '190.318' },
  { seg: 'N', anchor: 'handoff', side: 'R', kind: 'tool', text: 'context 88% → handoff.md\n(last request & reply)', note: '190.800（固定）' },
  // 3:13 起：新会话终端屏。**每行独占一行，绝不叠行**（§3 与 §2.8 的硬要求）
  { seg: 'N', anchor: 'restored', side: 'R', kind: 'tool', text: 'session #002 · restored', note: '193.267（节拍锚点，3:13 起）' },
  { seg: 'N', anchor: 'restored', offset: 0.35, side: 'R', kind: 'tool', text: 'restored: 1 item (unreadable) ♥', note: '193.267+0.35：第二行，绝不与上一行叠' },
  { seg: 'N', anchor: 'lastExec', side: 'R', kind: 'you', text: 'world.execute(me);', note: '205.964' },
]

/** 按段取台词（保持原顺序） */
export function dialogueOf(seg) {
  return DIALOGUE.filter((d) => d.seg === seg)
}

/** 供 §3 / §4.2 的自检：统计每段条数 */
export function dialogueStats() {
  const bySeg = {}
  for (const d of DIALOGUE) bySeg[d.seg] = (bySeg[d.seg] || 0) + 1
  const kinds = {}
  for (const d of DIALOGUE) kinds[d.kind] = (kinds[d.kind] || 0) + 1
  return { total: DIALOGUE.length, bySeg, kinds, sides: { L: DIALOGUE.filter((d) => d.side === 'L').length, R: DIALOGUE.filter((d) => d.side === 'R').length } }
}

export default DIALOGUE
