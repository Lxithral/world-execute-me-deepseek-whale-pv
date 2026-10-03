## F0 阶段计划：考据与审计（不改功能代码）

已完成的只读调查已经把两个问题的答案定下来了，下面是结论 + 要落地的两个文档。

---

### 一、官方仓库考据（只读，不装依赖，只克隆+读源码）

`D:\` 已确认，`D:\文档\GitHub` 存在且含 25 个兄弟仓库（LSPosed、cc-switch、world.execute-me 等），确定为目标路径。官方仓库 `deepseek-ai/deepseek-harness` 公开、MIT、描述为 "Everything is a Plugin."。

**要执行的（唯一写盘动作）**：
```bash
git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness "D:/文档/GitHub/deepseek-harness"
```
只读参考，不修改它，也不整包复制进本项目。**不执行 pnpm install / build / dsh web**（按你的选择）。

**已定位到的考据目标（clone 后逐个读）**：

| 内容 | 路径（已通过 GitHub API 确认存在） |
|---|---|
| Web 前端入口 | `apps/web/`（`index.html`、`vite.config.ts`、`src/`） |
| 设计 token / 主题 | `packages/client/ui-theme/src/styles/design-platform.css`（核心）、`base.css`、`brand-font.css`、`corner-shape.css`、`scrollbar.css`、`shiki.css` |
| 品牌字体 | 同目录 `montserrat-*.woff2` + `Montserrat-OFL.txt`（比例无衬线，OFL 可再分发） |
| **logo** | `packages/client/ui-brand-official/src/client/Brand.tsx` —— logo 是**内联 SVG 的 React 组件**，没有独立 .svg 文件；提取方式是读该组件的 SVG path |
| 组件解剖 | `packages/client/ui-chat`、`ui-tool`（工具卡片）、`ui-approval`（权限）、`ui-conversation`、`ui-layout`、`ui-sidebar`、`ui-trajectory`（思考块）、`ui-renderer`、`ui-primitives`、`ui-input-trigger`（composer）、`ui-permission-presets`、`ui-message-feedback` |
| 文档 | 根 `README.md` 的 Web UI guide、`docs/` |

**产出 `docs/DSH_UI_NOTES.md`**，按 FIX §1.5 的 a–f 六节：整体布局与比例 / 亮暗两套 token 原始值 / 各组件解剖 / logo 的确切位置与尺寸 / 动效（加载、流式、光标）/ 哪些艺术夸张哪些必须准确。并附「MIT 片段借用清单」的空表（F1 落地时填，配合 `public/dsh/LICENSE-dsh.txt`）。

---

### 二、审计结论（写入 `docs/AUDIT.md`，不改代码）

**① 0:12 立绘上方「两条黑线」= 我自己加的"近似闭眼"叠加层**

- 角色映射：`src/whale/exprs.js:47` → `closed: { file: whale-cheerful.webp, desat: 0.85, overlay: 'eyesClosed' }`（代码里已标 UNCONFIRMED）
- 绘制处：`src/whale/sprite.js:120-131`，`drawOverlay()` 里**恰好两个 `fillRect`**，色 `rgba(8,10,14,0.92)`，尺寸 `w*0.075 × max(2, h*0.007)`，位置 `x + w*0.46`、`x + w*0.60`，`ey = y + h*0.155`
- 触发：`src/scenes/a_boot.js:84,88`，`spriteA = span(t, 11.25, 12.15)` → 生效窗口 **0:11.26–0:12.15**
- 1920×1080 实测：立绘框 x 1133.9–1746.1、y 162–1263.6；两条黑线各 **45.9×7.7px**，屏幕位置约 **(1392.6, 332.8)** 与 **(1478.3, 332.8)** —— 正好在她头部/脸上
- 已排除其它嫌疑：`drawBootConsole` 在 t=12 时 alpha 已为 0；`fileTree` 只画一条青色高亮；输入框 12.7 才出现
- 同一个 overlay 在**段 N 3:12.4–3:13.4** 会再次出现（`src/scenes/n_handoff.js`，W5 那次的 `closed`）
- **结论**：与任何歌词词/概念都对应不上 → 按 FIX §3 段 A「说不出对应概念就删」应当删除（连同段 N 的复用一并处理）

**② 53 秒「时间隧道只有一小条」= 两个原因叠加**

- **真的时序 bug**：蒙眼黑条没有在时间尺开始前退场。`src/scenes/d_switch.js:92-99`：`blind = span(t,47.9,48.6)*(1-span(t,54.4,55.4))`，在 t=53 时 `blind = 1` → `slit = 1 - 0.82 = 0.18` → `bar = 540*(1-0.18) = 442.8px`，上下各一条 → **可见带只剩 194.4px**（y ∈ [442.8, 637.2]）。而时间尺窗口是 51.4–55.2，整段都被夹在这条缝里
- **实现缺口**：本来就没有"隧道"。`drawTimeline()`（`d_switch.js:190-243`）只是一条 y=669.6 的 2D 轴线（half=844.8、刻度 16px 高、年份字 54px）。y=669.6 已在可见带下沿 637.2 **之外** → 轴线和刻度全被下黑条盖住，只有 54px 年份数字的字形盒顶端（≈589.6–643.6）露进缝里
- **叠加因素**：`dizzy` 在 t=53 满值（`:35`），把背景/示波器/时间尺整体绕画面中心旋转 −7.7° 并放 1.06（`:38-43`，时间尺在 save/restore 内），轴线被推到约 677px，进一步压出视野
- **结论**：既是"黑条退场时序错了"，也是"时间隧道从头到尾只是个 2D 尺"

**③ 歌词「偏上」与「词距过大」**

- **词距过大（已定量）**：`public/data/lyrics.json` 里 **308/403** 个 `words[].w` **自带尾随空格**（如 `"Switch "`），`layout.js:74,89-91` 原样测量与推进，词距就等于空格字形宽度；英文用 **JetBrains Mono**（`layout.js:20-21`，700 字重），空格推进 **0.6em = 29.81px**，FIX §2.5 要求 **0.28em ≈ 14.6px** → **偏宽 2.05×**。根因是等宽字体 + 把 LRC 的空格当间距用
- **偏上（几何上没有能产生"明显偏上"的 bug）**，与 FIX 的偏差只有三处：
  1. 英文基线 `H*0.88 = 950.4px`，FIX 要 `0.885H = 955.8px` → **高 5.4px**（`layout.js:9`）
  2. 字号低于硬下限：英文 **49.68px**（要 ≥52）、中文 **27.32px**（要 ≥30）
  3. 中文行贴在英文基线下方 **52.36px（0.0485H）**，FIX 要 **+0.062H = 66.96px** → **中文行偏高 14.6px**；`layout.js:122` 用的是 `enFont*escape + enFont*zhGap + zhFont*cjkAscent` 这套 em 相对公式，代码里**不存在 `0.062` 这个常量**
  - 另外：全部 85 句 `K=1`、`shift=0`（上移/下移两个保护分支都不触发），位置恒定 0.88H；也排除了"比例当像素""基线当顶边"这两类坐标 bug
- **结论**：按你的答复，以 FIX 规格为准改排版（0.885H、≥52/≥30px、中文 +0.062H、空格 0.28em、英文改比例字体），不再追加坐标 bug 追查

**④ 钟表指针逻辑错误**

- 实现处：`src/scenes/g_glitch.js:161-213` `drawDayNightDial()`，调用点 `:67`（窗口 ≈94.106–96.992s）
- **只有一根针**（`:184-197`），没有时针/分针之分
- 角度**不由时间推导**：`spin = inOutCubic(a) * TAU * 2.2`（`:166`），`a` 是淡入淡出包络 `span(t,94.1,94.7)*(1-span(t,96.2,97.0))`；函数签名里的 `t` 在函数体内**从未被使用**
- 因此 94.1→94.7 **正转 2.2 圈**，96.2→97.0 又**倒转 2.2 圈**，净位移 0（这是最刺眼的一处：钟表会倒着转回去）
- 昼夜两半是**写死**的画布半圆（`:170-177`），不随任何时间量变化；没有天空渐变、没有太阳→月亮
- 24 个刻度（`:204-211`）只有 0.2× 针速，无数字
- 对照 FIX §2.7 的六项要求（单一 T(分钟)、`分针=T/60*360°`、`时针=T/720*360°`、7:00→19:00 即 T=420→1140、天空/日月同步、`分针 12 圈 : 时针 1 圈` 自检不变量）—— **全部缺失**，"12:1" 连成立的前提都没有
- **时序错位**：表盘窗口 94.106–96.992，而 "From AM to PM" 是 t0=94.09、AM@94.314、to@95.01、PM@95.243、hold 到 95.786 → 表盘**比这句多活 1.21s**，一直盖住下一句 "Oh switch my role"（t0=95.786）；且 "AM" 起唱时表盘只有 ~36% 不透明度
- **形态差距**：全 Canvas2D，FIX 要求 3D 圆柱表盘；`src/lib/props/*` 目前不存在（`src/lib/` 只有 code/formula/tables/three_util）

**⑤ 并入既有记录**：把 `docs/PROGRESS.md` 里「仍存在的视觉问题清单（按时间点）」那 14 条一并搬进 AUDIT.md 并逐条补上原因分析（FIX §4 要求"先读其中已记录的未解决问题，并入本清单"）。

---

### 三、交付物

| 文件 | 动作 |
|---|---|
| `D:/文档/GitHub/deepseek-harness/` | 新建（git clone --depth 1，只读参考，不属本项目、不入库） |
| `docs/DSH_UI_NOTES.md` | 新建（FIX §1.5 的 a–f 六节 + MIT 借用清单空表） |
| `docs/AUDIT.md` | 新建（上面 ①–⑤ 全部结论，含 file:line 与像素/角度实测值） |
| 任何 `src/`、`public/`、功能代码 | **不改**（F0 明确要求） |

`docs/PROGRESS.md` 我只在最后追加一行「F0 完成，见 AUDIT.md / DSH_UI_NOTES.md」——如果你希望连这行也不动，我就完全不碰它。

**汇报**：官方界面的布局与 token 摘要、logo 在官方资源里的位置（`Brand.tsx` 内联 SVG）、以及上面 ①–④ 的审计结论。