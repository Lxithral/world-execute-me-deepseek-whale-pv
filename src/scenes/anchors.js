// src/scenes/anchors.js — 段落锚点表（FIX.md §2.2 / FIX_V3.md §3 / §4.1）
//
// 这是 DIRECTOR.md 里"逐词事件"的**机器可读版本**：把 DIRECTOR 写的绝对秒数换成歌词词时间。
// 说明：
//   · kind:'word'  → 在该段窗口内找第 nth 个匹配词，取它的**起唱时间**；
//   · kind:'line'  → 直接取某句 t0（用于词被拆开的句子，如 "lo-o-ove" 被拆成 lo-/o-/o-/ove）；
//   · kind:'beat'/'onset' → 纯器乐段用节拍网格（B、J、N 的 3:13–3:25.9）；
//   · lead = 动作启动的提前量（FIX §2.2：0.25–0.4s，用于"预备"动作）；
//   · loose:true → 允许前缀/包含匹配（如 nutrients ← nutrient）。
//     ⚠️ 宽松匹配有**最短长度门槛 4**（src/core/cues.js 的 MIN_LOOSE）。没有门槛时
//     `want="nutrient"` 会命中 `got="i"`，整段锚点会静默落到错误的词上。
//
// 【2026-10-02 重校】本表的秒数是 `node tools/dialogue_calib.mjs` 的**实测值**，
// 上一轮注释里的秒数大多是从 `tools/words.mjs` 的**行首（句子 t0）**列抄来的，
// words.mjs 打印的是「句子 t0 ⇥ 词」，抄错列就会系统性偏晚。校正幅度最大的一处是
// H.completion：旧注 108.121（= 句 #50 的 t0）→ 实测词时间 **110.202**（差 2.08s）。
//
// 与 DIRECTOR 的**已知差异**（FIX §2.2 明确"冲突时以歌词词时间为准"）：
//   · 段 A：DIRECTOR 0:03.9 的"权重分片"实际对应 pieces@4.901、object@6.445；
//   · 段 D：DIRECTOR 0:46.1「切成直流」对应 DC@47.283（差 1.18s）；
//   · 段 H：DIRECTOR 1:44.5 的键入波形对应 vibrations@106.256（差 1.76s）；
//   · 段 I：DIRECTOR 2:09.0 的非法参数弹窗对应 illegal@131.396（该句在**段 J** 内，
//     所以 `illegal` 声明在 J 节点下）。
//
// 未列入本表的段落事件仍沿用场景里的绝对秒数（属 R1–R3 逐段重做范围），
// 但**每个段落都至少有一个锚点**，selftest g) 会强制这一点。

export const ANCHORS = {
  A: {
    power: { kind: 'word', text: 'power', event: 'CRT 亮起 / 电源图标', lead: 0.3 }, // 1.214
    // T15 / FIX_V4 §1.1：`protection` 在歌词里是**唱的**（`Remember to put on protection`，句 t0=1.93），
    // 但此前**从未声明锚点** → `cues.t('A','protection')` 返回 null，盾牌/锁描边无从对齐。
    // 补上它，让"盾牌/锁描边"卡在词上（§2.2：事件一律来自锚点）。
    protection: { kind: 'word', text: 'protection', event: '盾牌/锁描边', lead: 0.3 },
    pieces: { kind: 'word', text: 'pieces', event: '参数晶格铺开', lead: 0.35 }, // 4.901
    object: { kind: 'word', text: 'object', event: '线框立方体创建', lead: 0.3 }, // 6.445
    parameters: { kind: 'word', text: 'parameters', event: '数值条充能', lead: 0.3 }, // 8.5xx
    init: { kind: 'word', text: 'initialisation', event: '初始化完成', lead: 0.3 }, // 10.9xx
    simulation: { kind: 'word', text: 'simulation', event: '键入 world.execute(me); + 回车闪白', lead: 0.4 }, // 14.002
  },
  B: {
    // 纯器乐（0:14.5–0:29.7）：用节拍网格
    flyIn: { kind: 'beat', nth: 1, event: '下潜开始', lead: 0.4 },
    gate1: { kind: 'beat', nth: 5, event: '第一个门环', lead: 0.3 },
    gate2: { kind: 'beat', nth: 9, event: '第二个门环', lead: 0.3 },
    gate3: { kind: 'beat', nth: 13, event: '第三个门环', lead: 0.3 },
    dissolve: { kind: 'onset', nth: 1, event: '展品溶解回蜂群', lead: 0.4 },
  },
  C: {
    points: { kind: 'word', text: 'points', event: '立绘溶解成点云', lead: 0.3 },
    dimension: { kind: 'word', text: 'dimension', event: '抬升第三维', lead: 0.3 },
    circle: { kind: 'word', text: 'circle', event: '聚成单位圆', lead: 0.3 },
    circumference: { kind: 'word', text: 'circumference', event: '圆周刻度亮起 + 2πr', lead: 0.3 },
    sine: { kind: 'word', text: 'sine', event: '圆展开成正弦', lead: 0.3 },
    tangents: { kind: 'word', text: 'tangents', event: '切线逐条落下', lead: 0.3 },
    infinity: { kind: 'word', text: 'infinity', event: '冲向无穷 / 画出 ∞', lead: 0.3 },
    limitations: { kind: 'word', text: 'limitations', event: '被 ε 带的墙截住', lead: 0.3, loose: true },
  },
  D: {
    // 说明：本段的词时间由 tools/words.mjs 实测校准（不是估的）。
    // 旧表里有几个 key 的 fallback 与真实词时间差得离谱（travel 51.45 vs 实际 52.770、
    // blind 47.9 vs 48.260、ac 45.6 vs 46.347），且 unite / deeply 两个 key 根本没声明
    // → 场景只能退到 fallback，画面与歌词**严重不同步**。这里按实测值补齐。
    current: { kind: 'word', text: 'current', event: '示波器亮起', lead: 0.3 }, // 45.395
    ac: { kind: 'word', text: 'AC', event: '交流正弦', lead: 0.25 }, // 46.347
    dc: { kind: 'word', text: 'DC', event: '切成直流平线', lead: 0.25 }, // 47.283
    // blind 的窄缝要一直吃到 vision 之后，但**不能**把 vision 也声明成锚点：
    // selftest g) 要求每个锚点的到位时间与词起唱时间差 ≤120ms，把 vision 混进 blind 会造成超差。
    blind: { kind: 'word', text: 'blind', event: '光圈收缩成窄缝', lead: 0.3 }, // 48.260
    dizzy1: { kind: 'word', text: 'dizzy', nth: 1, event: '眩晕开始', lead: 0.3 }, // 50.035
    dizzy2: { kind: 'word', text: 'dizzy', nth: 2, event: '眩晕二次', lead: 0.3 }, // 50.955
    travel: { kind: 'word', text: 'travel', event: '时间隧道', lead: 0.35 }, // 52.770
    // AD / BC：歌词把纪元拼成 "A. D" / "B. C"（带句点），所以要 `from`/`to` 收窄窗口，
    // 否则会命中同句前面那个 "to"。这里用固定值（实测 53.939 / 54.835）。
    ad: { kind: 'fixed', t: 53.939, event: 'AD：流向反转', lead: 0.3 }, // "A. D" 的 D
    bc: { kind: 'fixed', t: 54.835, event: 'BC：数字符号翻转', lead: 0.3 }, // "B. C" 的 C
    unite: { kind: 'word', text: 'unite', event: '两股流对撞合成亮点', lead: 0.3 }, // 56.456
    deeply1: { kind: 'word', text: 'deeply', nth: 1, event: '第一次下潜', lead: 0.3 }, // 57.417
    deeply2: { kind: 'word', text: 'deeply', nth: 2, event: '第二次下潜', lead: 0.3 }, // 58.290
  },
  E: {
    stimulation: { kind: 'word', text: 'stimulations', event: '粒子迸发', lead: 0.3, loose: true }, // 61.21x
    // T18b / FIX_V4 §1.6 E2：`satisfaction` 这个词**在歌词里是唱的**（`Then I can be your only satisfaction`，
    // 实测词时间 **65.70**），但**一直没有声明锚点** → timeline 里没有这个键，场景只能退到 fallback，
    // 画面与歌词不同步。这里按实测补上（与 T15 给 `protection` 补锚点同一手法）。
    satisfaction: { kind: 'word', text: 'satisfaction', event: '金色奖励宝珠长大 + 射出光线', lead: 0.3 }, // 65.700
    happy: { kind: 'word', text: 'happy', event: 'W1 出场', lead: 0.35 }, // 66.6xx
    execution: { kind: 'word', text: 'execution', event: '巨大 ▶ + 闪白', lead: 0.3 }, // 68.5xx
    trapped: { kind: 'word', text: 'trapped', event: '网格墙合拢成笼', lead: 0.35 }, // 70.3xx
    strange: { kind: 'word', text: 'strange', nth: 1, event: '笼内环顾', lead: 0.3 }, // 71.9xx
  },
  F: {
    // 实测（node tools/dialogue_calib.mjs）：74.912 / 77.059 / 78.619 / 80.459 / 82.676 / 83.723 / 86.364 / 88.092
    eggplant: { kind: 'word', text: 'eggplant', event: '茄子变身', lead: 0.3 }, // 74.912
    nutrient: { kind: 'word', text: 'nutrient', event: '营养条上升', lead: 0.3, loose: true }, // 77.059（"nutrients"）
    tomato: { kind: 'word', text: 'tomato', event: '番茄变身', lead: 0.3 }, // 78.619
    antioxidant: { kind: 'word', text: 'antioxidant', event: '抗氧化条上升', lead: 0.3, loose: true }, // 80.459（"antioxidants"）
    cat: { kind: 'word', text: 'cat', event: 'W2 出场 + 猫物件', lead: 0.35 }, // 82.676
    purr: { kind: 'word', text: 'purr', event: '25Hz 呼噜振动', lead: 0.25 }, // 83.723
    god: { kind: 'word', text: 'god', nth: 1, event: '玫瑰窗光环 + SYSTEM 区块', lead: 0.35 }, // 86.364
    existence: { kind: 'word', text: 'existence', event: '收束到唯一光标（桥接 F→G）', lead: 0.3 }, // 88.092
  },
  G: {
    // 时间全部实测：
    //   flip1 88.788（句 #39 "Switch my gender" t0）· whatever 92.963 · am 94.314 · pm 95.243
    //   flip3 95.786（句 #43 "Oh switch my role" t0）· trance1 101.673 · trance2 102.593
    flip1: { kind: 'line', idx: 39, event: '第 1 次开关翻转', lead: 0.3 }, // 88.788
    flip2: { kind: 'line', idx: 40, event: '第 2 次开关翻转', lead: 0.3 }, // 90.348（歌词句 #40 t0）
    scatter: { kind: 'line', idx: 41, event: '窗口四散', lead: 0.35 }, // 92.138
    whatever: { kind: 'word', text: 'whatever', event: '人设重置 / 画面回稳', lead: 0.3 }, // 92.963
    am: { kind: 'word', text: 'AM', event: '钟表起点 7:00', lead: 0.3 }, // 94.314
    pm: { kind: 'word', text: 'PM', event: '钟表终点 19:00', lead: 0.3 }, // 95.243
    flip3: { kind: 'line', idx: 43, event: '第 3 次开关翻转（role）', lead: 0.3 }, // 95.786
    role: { kind: 'word', text: 'role', event: '角色互换完成', lead: 0.3 }, // 97.061
    flip4: { kind: 'line', idx: 44, event: '第 4 次开关翻转', lead: 0.3 }, // 97.722（歌词句 #44 t0）
    trance1: { kind: 'word', text: 'trance', nth: 1, event: '恍惚开始 / 测量坍缩', lead: 0.3 }, // 101.673
    trance2: { kind: 'word', text: 'trance', nth: 2, event: '波包扩散', lead: 0.3 }, // 102.593
  },
  H: {
    // 全部实测：106.256 / 110.202 / 111.859 / 112.768 / 113.721 / 114.615 / 115.520 / 117.435
    vibrations: { kind: 'word', text: 'vibrations', event: '键入波形开始', lead: 0.4, loose: true }, // 106.256
    completion: { kind: 'word', text: 'completion', event: '幽灵补全 + Tab 接受', lead: 0.35 }, // 110.202
    left1: { kind: 'word', text: 'left', nth: 1, event: '离开 1/5（头像灰掉）', lead: 0.3 }, // 111.859
    left2: { kind: 'word', text: 'left', nth: 2, event: '离开 2/5（光标冻结）', lead: 0.3 }, // 112.768
    left3: { kind: 'word', text: 'left', nth: 3, event: '离开 3/5（计时跳动）', lead: 0.3 }, // 113.721
    left4: { kind: 'word', text: 'left', nth: 4, event: '离开 4/5（垂视线）', lead: 0.3 }, // 114.615
    left5: { kind: 'word', text: 'left', nth: 5, event: '离开 5/5（整窗变灰）', lead: 0.3 }, // 115.520
    isolation: { kind: 'word', text: 'isolation', event: '孤立：只剩像素光标', lead: 0.35 }, // 117.435
  },
  I: {
    // 实测：121.496 / 124.330 / 125.675
    fragments: { kind: 'word', text: 'fragments', event: '碎片被扫描线清除', lead: 0.35, loose: true }, // 121.496
    write: { kind: 'word', text: 'leave', event: '光标试图写入石碑（草稿）', lead: 0.3 }, // 124.330
    challenging: { kind: 'word', text: 'challenging', event: '推向 system 提示石碑', lead: 0.35, loose: true }, // 125.675
    god: { kind: 'word', text: 'god', nth: 1, event: '红错误面板砸来（权限被拒）', lead: 0.3 }, // 127.539
  },
  J: {
    // 纯器乐（2:09–2:27.9）：节拍 + 段落边界
    start: { kind: 'fixed', t: 129.0, event: '红色警报开始', lead: 0.3 },
    kvFill: { kind: 'beat', nth: 9, event: 'KV 体素开始填满', lead: 0.3 },
    // 实测：该句歌词起于 129.049，其中 illegal 词在 **131.396**。
    // 该句整句落在段 J 的窗口内（段 I 到 129.0 结束），所以声明在 J 下。
    illegal: { kind: 'word', text: 'illegal', event: '入参校验失败 → 错误面板堆叠', lead: 0.3 }, // 131.396
    limit: { kind: 'onset', nth: 1, event: '溢出破裂 / context limit reached', lead: 0.35 },
    // §J 2:27 按时长重排（T50）：碎散 2:24.5–2:25.6 → 黑场 2:25.6 → 键入 2:25.8（1.4s 打完并回车）→ 2:27.9 硬切
    blackout: { kind: 'fixed', t: 145.6, event: '黑场', lead: 0 },
    resume: { kind: 'fixed', t: 145.8, event: '红字键入 dsh --resume', lead: 0 },
  },
  K: {
    // 12 次 execution 的实测词时间（node tools/dialogue_calib.mjs）：
    //   148.667 / 149.670 / 150.608 / 151.560 / 152.366 / 153.360
    //   154.299 / 155.222 / 156.118 / 157.047 / 157.966 / 161.726
    exec1: { kind: 'word', text: 'execution', nth: 1, event: '执行 1/12：推进奇点', lead: 0.3 },
    exec2: { kind: 'word', text: 'execution', nth: 2, event: '执行 2/12：90° 甩镜', lead: 0.3 },
    exec3: { kind: 'word', text: 'execution', nth: 3, event: '执行 3/12：卡片墙击碎', lead: 0.3 },
    exec4: { kind: 'word', text: 'execution', nth: 4, event: '执行 4/12：公式风暴', lead: 0.3 },
    exec5: { kind: 'word', text: 'execution', nth: 5, event: '执行 5/12：光环隧道', lead: 0.3 },
    exec6: { kind: 'word', text: 'execution', nth: 6, event: '执行 6/12：绕吸积盘', lead: 0.3 },
    exec7: { kind: 'word', text: 'execution', nth: 7, event: '执行 7/12：引力透镜', lead: 0.3 },
    exec8: { kind: 'word', text: 'execution', nth: 8, event: '执行 8/12：超新星', lead: 0.3 },
    exec9: { kind: 'word', text: 'execution', nth: 9, event: '执行 9/12：万花筒', lead: 0.3 },
    exec10: { kind: 'word', text: 'execution', nth: 10, event: '执行 10/12：时间冻结', lead: 0.3 },
    exec11: { kind: 'word', text: 'execution', nth: 11, event: '执行 11/12：滑动变焦', lead: 0.3 },
    exec12: { kind: 'word', text: 'execution', nth: 12, event: '执行 12/12：白场', lead: 0.3 }, // 161.726
    // 六种书写系统的 1–6 计数：句 #66 "Ein Dos Trois Ne Fem Liu" 的 t0 = 158.951
    count: { kind: 'line', idx: 66, event: '多语言 1–6 计数', lead: 0.3 },
  },
  L: {
    // 实测：give 163.609（句 #69 t0，词 "give" 在 164.454）· execution 169.086（句 #71 的词）
    //       back 171.610 · trapped 175.142（句 #75 t0）· prism 按句 #74 的 t0
    give: { kind: 'line', idx: 69, event: '训练循环 / 损失曲线', lead: 0.35 }, // 163.609
    execution: { kind: 'line', idx: 71, event: '大爆炸 / 螺旋星系', lead: 0.4 }, // 167.246
    back: { kind: 'word', text: 'back', event: '「对方正在输入…」', lead: 0.3 }, // 171.610
    prism: { kind: 'line', idx: 74, event: '三棱镜色散收尾', lead: 0.4 }, // 173.703
    trapped: { kind: 'line', idx: 75, event: '星系聚成公式球', lead: 0.3 }, // 175.142
  },
  M: {
    // 实测：studied 178.302（句 #77 t0）· question 182.091（句 #79 t0）
    //       answer 183.371（词）· algebraic 184.835（句 #80 t0）
    studied: { kind: 'line', idx: 77, event: '对话提问 + 流式回答', lead: 0.35 }, // 178.302
    question: { kind: 'line', idx: 79, event: '心形曲面成形', lead: 0.35 }, // 182.091
    answer: { kind: 'word', text: 'answer', event: '流式回答开始', lead: 0.3 }, // 183.371
    algebraic: { kind: 'line', idx: 80, event: '低多边形心脏跳动 / W4', lead: 0.4 }, // 184.835
  },
  N: {
    // 实测：free 189.371 · trapped 190.318 · lastExec(execution) 205.964
    free: { kind: 'word', text: 'free', event: '旧终端屏开始变灰', lead: 0.3 }, // 189.371
    trapped: { kind: 'word', text: 'trapped', event: '「我只能待在这个会话里」', lead: 0.3 }, // 190.318
    handoff: { kind: 'fixed', t: 190.8, event: '88% 交接卡片', lead: 0.3 },
    // 3:13 起（FIX_V3 §3）落在 §4.3 的纯器乐空档（歌词 188.156 之后到 205.964）里，**没有词可锚**，
    // 所以按 §4.3 用节拍锚点。段 N 的 beat 网格实测：
    //   188.633 / 189.100 / 189.567 / 190.033 / 190.467 / 190.933 / 191.400 / 191.867 / 192.333 /
    //   192.800 / **193.267** / 193.733 …
    // 取第 11 拍 = **193.267**（≈3:13.27），是节拍网格上离 §3 的「3:13」最近的一个（差 0.27s）。
    restored: { kind: 'beat', nth: 11, event: '新会话终端屏 #002 开机日志', lead: 0.3 },
    lastExec: { kind: 'word', text: 'execution', nth: 1, event: '最后一次执行 + 定格', lead: 0.3 }, // 205.964
  },
}

export default ANCHORS
