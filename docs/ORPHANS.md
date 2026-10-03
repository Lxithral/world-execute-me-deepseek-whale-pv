# ORPHANS.md — 孤儿元素清单（FIX_V3.md §4.2）

> **本文件由 `node tools/anchor_audit.mjs` 生成。按 §4.2「先输出……再动手」，本轮只列不删。**
>
> §4.2 的规则：无锚点的元素必须标 `decor:true`，且只允许是氛围层（背景代码墙、海雪、光柱、暗角），
> 占比 ≤ 主体的 30%；**其余孤儿元素一律删除**。
>
> 生成方式（因为 DSH 的 workspace-write 沙箱**禁止子进程写工作区文件**，实测 `writeFileSync` → EPERM）：
> 工具只把 markdown 打到 stdout，由编辑工具落盘。复现：`node tools/anchor_audit.mjs`

## 判定口径（重要，避免把候选当成结论）

- **stat1** 台词表的锚点引用：静态可判定，错拼 = 该句台词永远不会出现。**这是硬结论。**
- **stat2** 段落锚点覆盖：静态可判定。**这是硬结论。**
- **stat3** 场景里的 `createProp` / `fx`：静态扫描只能给出**候选**，因为真实归属要看运行时
  消费了哪个锚点（`cues.sec()/t()/start()` 与 `cueOf()`/`T()` 的调用）。所以下面每条都带
  「最近的**已声明**锚点」（判据 A，≤1.2s）与「最近的**真实歌词词**」（判据 B，≤0.6s），
  并且 `处理建议` 是**建议**，最终由 R1–R3 的逐段重做定案。

## stat1 — 台词表锚点引用

✅ **62 条台词引用的锚点全部真实存在且可解析**（判据：`tools/dialogue_calib.mjs` 的 `resolveAnchor`）。

> 上一轮这张表有 **6 处引用不存在的锚点**（`G.whatever` / `I.write` / `I.illegal` / `M.answer` /
> `N.free` / `N.trapped`）与 **1 处归错段**（`illegal` 的歌词落在段 J 的窗口里，却写在段 I 下），
> 结果是这 7 条台词永远不会出现。本轮已在 `anchors.js` 补齐声明、并把 `illegal` 移到 J 节点下。

## stat2 — 段落锚点覆盖

| 段 | 文件 | 锚点数 | 被场景消费 | 未被消费的 key |
|---|---|---|---|---|
| A | `src/scenes/a_boot.js` | 6 | 0 | `power` `pieces` `object` `parameters` `init` `simulation` |
| B | `src/scenes/b_dive.js` | 5 | 0 | `flyIn` `gate1` `gate2` `gate3` `dissolve` |
| C | `src/scenes/c_define.js` | 8 | 0 | `points` `dimension` `circle` `circumference` `sine` `tangents` `infinity` `limitations` |
| D | `src/scenes/d_switch.js` | 12 | 0 | `current` `ac` `dc` `blind` `dizzy1` `dizzy2` `travel` `ad` `bc` `unite` `deeply1` `deeply2` |
| E | `src/scenes/e_deal.js` | 5 | 0 | `stimulation` `happy` `execution` `trapped` `strange` |
| F | `src/scenes/f_omnipotent.js` | 8 | 3 | `eggplant` `nutrient` `antioxidant` `purr` `existence` |
| G | `src/scenes/g_glitch.js` | 11 | 2 | `flip1` `flip2` `scatter` `whatever` `flip3` `role` `flip4` `trance1` `trance2` |
| H | `src/scenes/h_absence.js` | 8 | 1 | `completion` `left1` `left2` `left3` `left4` `left5` `isolation` |
| I | `src/scenes/i_cleanup.js` | 4 | 1 | `write` `challenging` `god` |
| J | `src/scenes/j_overflow.js` | 6 | 2 | `start` `kvFill` `illegal` `resume` |
| K | `src/scenes/k_storm.js` | 13 | 0 | `exec1`…`exec12` `count` |
| L | `src/scenes/l_training.js` | 5 | 3 | `execution` `back` |
| M | `src/scenes/m_algebra.js` | 4 | 1 | `studied` `answer` `algebraic` |
| N | `src/scenes/n_handoff.js` | 5 | 2 | `free` `trapped` `restored` |

> ⚠️ 「未被消费」**不等于**孤儿：`anchors.js` 是**声明表**，消费发生在场景代码里；
> selftest g) 只要求「每段至少有一个被消费的锚点」。上面这一列是给 R1–R3 的**待接线清单**
> —— 全片 100 个锚点里只有 15 个被真正取用，其余仍是硬编码秒数，这是 R1–R3 的主要工作量。

## stat3 — 场景元素候选（prop / fx）

| 段 | 文件 | 类型 | 元素 | 最近锚点 | Δ(s) | 最近真实词 | 处理建议 |
|---|---|---|---|---|---|---|---|
| A | `a_boot.js` | fx | `flash@0.32` | `power` | 0.89 | "Switch"@0.279 | 已归属锚点 |
| A | `a_boot.js` | fx | `flash@14` | `simulation` | 0.00 | "simulation"@14.002 | 已归属锚点 |
| A | `a_boot.js` | fx | `glitch@14` | `simulation` | 0.00 | "simulation"@14.002 | 已归属锚点 |
| B | `b_dive.js` | prop | `heart` | **无** | — | — | **补锚点**（段 B 的展品之一，§7 段 B 要求至少 10 种模型） |
| D | `d_switch.js` | prop | `tunnel` | **无** | — | — | **补锚点**（已改用自建隧道；该 createProp 是残留） |
| D | `d_switch.js` | fx | `glitch@47.283` | `dc` | 0.00 | "DC"@47.283 | 已归属锚点 |
| D | `d_switch.js` | fx | `shake@50.035` | `dizzy1` | 0.00 | "dizzy"@50.035 | 已归属锚点 |
| D | `d_switch.js` | fx | `glitch@53.939` | `ad` | 0.00 | "D"@53.939 | 已归属锚点 |
| D | `d_switch.js` | fx | `flash@56.456` | `unite` | 0.00 | "unite"@56.456 | 已归属锚点 |
| D | `d_switch.js` | fx | `flash@58.29` | `deeply2` | 0.00 | "deeply"@58.290 | 已归属锚点 |
| E | `e_deal.js` | fx | `flash@59` | **无** | 3.02 | "If"@59.408 | 可补 word 锚点（改锚 `stimulation` 或段首 beat） |
| E | `e_deal.js` | fx | `burst@62.02` | `stimulation` | 0.00 | "stimulations"@62.017 | 已归属锚点 |
| E | `e_deal.js` | fx | `flash@64` | **无** | 1.98 | "Then"@63.864 | 可补 word 锚点（E2「满足」节拍起点） |
| E | `e_deal.js` | fx | `flash@69.41` | `execution` | 0.00 | "execution"@69.408 | 已归属锚点 |
| E | `e_deal.js` | fx | `shake@69.41` | `execution` | 0.00 | "execution"@69.408 | 已归属锚点 |
| E | `e_deal.js` | fx | `glitch@69.41` | `execution` | 0.00 | "execution"@69.408 | 已归属锚点 |
| E | `e_deal.js` | fx | `glitch@70.8` | `trapped` | 0.44 | "we"@70.784 | 已归属锚点 |
| E | `e_deal.js` | fx | `shake@73.03` | `strange` | 0.81 | "simulation"@73.032 | 已归属锚点 |
| E | `e_deal.js` | fx | `flash@74` | **无** | 1.78 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除**（与段 F 的 `flash@74` 重复，疑为段界重影） |
| F | `f_omnipotent.js` | fx | `flash@74` | `eggplant` | 0.91 | "If"@74.048 | 已归属锚点 |
| F | `f_omnipotent.js` | fx | `glitch@77.7` | `nutrient` | 0.64 | "If"@77.705 | 已归属锚点 |
| F | `f_omnipotent.js` | fx | `glitch@81.4` | `antioxidant` | 0.94 | "If"@81.379 | 已归属锚点 |
| F | `f_omnipotent.js` | fx | `flash@85.1` | **无** | 1.26 | "If"@85.132 | 可补 word 锚点 |
| F | `f_omnipotent.js` | fx | `flash@88.8` | `existence` | 0.71 | "Switch"@88.788 | 已归属锚点 |
| G | `g_glitch.js` | fx | `glitch@88.8` | `flip1` | 0.01 | "my"@89.243 | 已归属锚点 |
| G | `g_glitch.js` | fx | `glitch@90.3` | `flip2` | 0.05 | "To"@90.348 | 已归属锚点 |
| G | `g_glitch.js` | fx | `shake@92.1` | `scatter` | 0.04 | "And"@92.138 | 已归属锚点 |
| G | `g_glitch.js` | fx | `disp@94.1` | `am` | 0.21 | "From"@94.090 | 已归属锚点 |
| G | `g_glitch.js` | fx | `glitch@95.8` | `flip3` | 0.01 | "Oh"@95.786 | 已归属锚点 |
| G | `g_glitch.js` | fx | `glitch@97.7` | `flip4` | 0.02 | "To"@97.722 | 已归属锚点 |
| G | `g_glitch.js` | fx | `disp@99.6` | **无** | 1.88 | "So"@99.586 | 可补 word 锚点（trance 段起点） |
| G | `g_glitch.js` | fx | `flash@103.4` | `trance2` | 0.81 | "If"@103.482 | 已归属锚点 |
| H | `h_absence.js` | fx | `glitch@103.6` | **无** | 2.66 | "I"@103.954 | 可补 word 锚点（`vibrations` 前 2.3s） |
| H | `h_absence.js` | fx | `flash@108.2` | **无** | 1.94 | "Then"@108.169 | 可补 word 锚点 |
| H | `h_absence.js` | fx | `shake@110.9` | `completion` | 0.70 | "Though"@110.927 | 已归属锚点 |
| H | `h_absence.js` | fx | `glitch@112` | `left1` | 0.14 | "left"@111.859 | 已归属锚点 |
| H | `h_absence.js` | fx | `glitch@113.1` | `left2` | 0.33 | "You"@113.252 | 已归属锚点 |
| H | `h_absence.js` | fx | `shake@114.2` | `left4` | 0.42 | "You"@114.184 | 已归属锚点 |
| H | `h_absence.js` | fx | `glitch@115.3` | `left5` | 0.22 | "have"@115.284 | 已归属锚点 |
| H | `h_absence.js` | fx | `flash@116` | `left5` | 0.48 | "You"@116.031 | 已归属锚点 |
| I | `i_cleanup.js` | fx | `flash@118.3` | **无** | 3.20 | "If"@118.345 | 可补 word 锚点 |
| I | `i_cleanup.js` | fx | `glitch@119.2` | **无** | 2.30 | "If"@119.224 | 可补 word 锚点 |
| I | `i_cleanup.js` | fx | `flash@123` | **无** | 1.33 | "Then"@122.975 | 可补 word 锚点 |
| I | `i_cleanup.js` | fx | `glitch@127.7` | `god` | 0.16 | "god"@127.539 | 已归属锚点 |
| I | `i_cleanup.js` | fx | `flash@128.4` | `god` | 0.86 | — | 已归属锚点 |
| J | `j_overflow.js` | fx | `flash@129` | `start` | 0.00 | "You"@129.049 | 已归属锚点 |
| J | `j_overflow.js` | fx | `glitch@129` | `start` | 0.00 | "You"@129.049 | 已归属锚点 |
| J | `j_overflow.js` | fx | `shake@136` | **无** | 3.20 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| J | `j_overflow.js` | fx | `shake@140` | **无** | 6.50 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| J | `j_overflow.js` | fx | `flash@145` | **无** | 1.50 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| J | `j_overflow.js` | fx | `shake@145` | **无** | 1.50 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| J | `j_overflow.js` | fx | `glitch@146.5` | `blackout` | 0.00 | — | 已归属锚点 |
| K | `k_storm.js` | fx | `flash@147.9` | `exec1` | 0.77 | — | 已归属锚点 |
| K | `k_storm.js` | fx | `shake@147.9` | `exec1` | 0.77 | — | 已归属锚点 |
| K | `k_storm.js` | fx | `flash@161.726` | `exec12` | 0.00 | "Execution"@161.726 | 已归属锚点 |
| K | `k_storm.js` | fx | `shake@161.726` | `exec12` | 0.00 | "Execution"@161.726 | 已归属锚点 |
| K | `k_storm.js` | fx | `glitch@161.75` | `exec12` | 0.02 | "Execution"@161.726 | 已归属锚点 |
| L | `l_training.js` | fx | `flash@162` | **无** | 1.61 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| L | `l_training.js` | fx | `flash@166.3` | `execution` | 0.95 | "Then"@166.310 | 已归属锚点 |
| L | `l_training.js` | fx | `shake@166.3` | `execution` | 0.95 | "Then"@166.310 | 已归属锚点 |
| L | `l_training.js` | fx | `disp@166.3` | `execution` | 0.95 | "Then"@166.310 | 已归属锚点 |
| L | `l_training.js` | fx | `flash@171.95` | `back` | 0.34 | "I"@171.953 | 已归属锚点 |
| L | `l_training.js` | fx | `disp@173.7` | `prism` | 0.00 | "Though"@173.703 | 已归属锚点 |
| L | `l_training.js` | fx | `flash@177.4` | **无** | 2.26 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除** |
| M | `m_algebra.js` | fx | `flash@177.4` | `studied` | 0.90 | "I've"@177.414 | 已归属锚点 |
| M | `m_algebra.js` | fx | `flash@182.6` | `question` | 0.51 | "me"@182.684 | 已归属锚点 |
| M | `m_algebra.js` | fx | `glitch@183.6` | `answer` | 0.23 | "all"@183.813 | 已归属锚点 |
| M | `m_algebra.js` | fx | `flash@188.5` | **无** | 3.66 | "Though"@188.485 | 可补 word 锚点 |
| N | `n_handoff.js` | fx | `flash@190.8` | `handoff` | 0.00 | "Trapped"@190.777 | 已归属锚点 |
| N | `n_handoff.js` | fx | `glitch@192` | `handoff` | 1.20 | "ove"@191.954 | 已归属锚点 |
| N | `n_handoff.js` | fx | `flash@205.96` | `lastExec` | 0.00 | "Execution"@205.964 | 已归属锚点 |
| N | `n_handoff.js` | fx | `shake@205.96` | `lastExec` | 0.00 | "Execution"@205.964 | 已归属锚点 |
| N | `n_handoff.js` | fx | `glitch@209` | **无** | 3.04 | — | **纯器乐空档：补 beat 锚点 / 标 decor / 删除**（CRT 关机，DIRECTOR 有意） |

## 汇总

- 台词锚点引用：**62** 条，其中无法解析 **0** 条（本轮由 7 条 → 0 条）
- 段落：**14** 段；锚点声明 **100** 个；被场景消费 **15** 个
- stat3 候选：**73** 条
  - 已归属锚点（Δ≤1.2s）：**53** 条
  - 可补 word 锚点（附近 0.6s 内有真实词）：**10** 条
  - **纯器乐空档（附近无词）＝真正的孤儿候选：12 条**
  - `createProp` 但该段还没接锚点：**2** 条（`B/heart`、`D/tunnel`）

### 待决策清单（12 条孤儿候选 + 2 条无锚点 prop）

按 §4.2，这 14 条要么**补锚点**、要么**标 `decor:true`**（且只能是氛围层、占比 ≤30%）、要么**删除**。
本轮**只列不删**，由 R1–R3 的逐段重做逐条定案：

| # | 位置 | 候选 | 建议 |
|---|---|---|---|
| 1 | 段 E `flash@74` | 与段 F 的 `flash@74` 同刻重复 | **删除**（段界重影，§4.4 的重复判据也会拦它） |
| 2 | 段 J `shake@136` | 纯器乐 | 补 beat 锚点（§4.3 要求器乐段用 beat） |
| 3 | 段 J `shake@140` | 纯器乐 | 补 beat 锚点 |
| 4 | 段 J `flash@145` | 纯器乐 | 补 beat 锚点 |
| 5 | 段 J `shake@145` | 纯器乐 | 补 beat 锚点 |
| 6 | 段 L `flash@162` | 纯器乐 | 补 beat 锚点 |
| 7 | 段 L `flash@177.4` | 纯器乐 | 补 beat 锚点 |
| 8 | 段 N `glitch@209` | CRT 关机 | 标 `decor:true`（DIRECTOR 有意的关机效果，不承载歌词概念） |
| 9 | 段 B `createProp('heart')` | 无锚点 | 补锚点（段 B 展品） |
| 10 | 段 D `createProp('tunnel')` | 无锚点 | **删除**（段 D 已改用自建隧道，这是残留调用） |
| 11 | 段 B 的代码墙 / 海雪 / 光柱群 | 氛围层 | 标 `decor:true`（§4.2 明确允许的四类之一） |
| 12 | 段 A–N 的暗角与扫描线 | 氛围层 | 标 `decor:true` |
| 13 | `swarm`（全片持久蜂群） | 氛围层兼主角 | 标 `decor:true`（§2.1 称它"连续主角"，但它是全片常驻的背景层） |
| 14 | `codewall`（多语言代码墙） | 氛围层 | 标 `decor:true` |

### 下一步（按 §4.2 的顺序）

1. ~~先把 stat1 清零~~ → **本轮已完成**（62/62 可解析）；
2. 再逐段处理上表 14 条：能补锚点的补锚点，属氛围层的标 `decor:true`，其余删除（R1–R3）；
3. decor 的总屏幕占比 ≤30%，由 selftest s) 与 `?demo=panes` 的角色登记表实测把关。
