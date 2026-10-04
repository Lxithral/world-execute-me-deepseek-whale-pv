# REVIEW_T16b.md — 段 C「蜂群不使用字符形态」

> 按**规则 9** 从 T16b 再拆：**T16b = ①（蜂群关字形）**；**T16c = ②（8 段形变标注）**，本轮**未做**。
> 改动文件：`src/lib/swarm.js`、`src/main.js`。

## 词 → 事件 → 对象

| §1.4 要求 | 现状调查（本轮新查明） | 改动 | 实测 |
|---|---|---|---|
| 「`points` 一词处画面必须是真正的"**点**"——一片**发光圆点（不是字符）**」 | 段 C 自己的点云本来就是 `THREE.Points`（`makePointCloud` / shader 里 `gl_PointSize`）✓ 是圆点 | 未改（本就满足） | — |
| 「**本段蜂群不使用字符形态**」 | **3D 持久蜂群（`lib/swarm.js`）的每个粒子都是一枚字形**：顶点着色器有 `attribute vec2 aGlyph`，片元 `vUv = aGlyph + uv / uAtlasGrid` 去采样 `glyphAtlas()` 那张图集（含数字、`def/for/lr/…`、`∑∂∇πεθ…`）；而 **2D 蜂群（`lib/swarm2d.js`）是方形 `Points`（点/短横），本来就不是字符**。段 C 的布局 `C:{from:'cloud',to:'grid'}` 当时**没有关字形** | ① `swarm.js` 新增导出 `swarmCharsAt(t)`（读 `SEGMENT_SWARM[segAt(t)].chars`，缺省为 true）；② `SEGMENT_SWARM.C` 加 **`chars: false`**；③ `main.js` 的 `applySwarm` 用它把 **3D 字形层**关掉（`swarm.object.visible = visible && charsOn`，且跳过它的 update），2D 点层保留 | t=**34.0**（段 C）：字形层 `visible = **false**`；t=**20.0**（段 B）：字形层 `visible = **true**`（**别段无回归**） |

## 6 个关键帧

| # | 时间 | 应看到 |
|---|---|---|
| 1 | **31.0s** | `points`：只有**圆点**，画面里**没有任何字符形态的蜂群粒子** |
| 2 | **34.4s** | `circle`：点汇成单位圆，仍无字形粒子 |
| 3 | **36.4s** | `circumference`：亮点绕圈，无字形 |
| 4 | **38.0s** | `sine`：无字形 |
| 5 | **43.5s** | `limitations`：无字形 |
| 6 | **20.0s**（对照） | 段 B：字形蜂群**照旧在场**（证明只对段 C 生效） |

## 实测

| 检查 | 结果 |
|---|---|
| 段 C 字形层可见性（t=34.0） | **false**（关掉） |
| 段 B 字形层可见性（t=20.0，对照） | **true**（无回归） |
| 段 C 30.0–45.6 @0.5s 文字重叠 | **0** |
| `errors` / `doctor` | 0 / **PASS 5-0** |

## ⚠️ 本轮的一个自伤（已修，值得记住）

我本想在 `segAt` 上方插入新函数，第一次编辑把 `export function segAt(t) {` **行尾的换行删掉了**，
函数体首行被拼到同一行。虽然 `node --check` 仍通过（恰好没拼到注释上），但这属于**无意的格式破坏**；
发现后立刻改回多行并补上 `swarmCharsAt`。**教训：用 edit 工具时 `old_string` 不要只带一个"行首+换行"，
要连下一行一起带上，避免把结构拼坏。**

## ⚠️ T16c **未做**（② 8 段形变标注 —— 本轮查明**画面上一个都没有**）

本轮实测：t=**36.5 / 38.0 / 40.5 / 43.5** 四个节拍处，`textBoxes()` 里**只有歌词层**（52px/30px），
**stage 层没有任何标注文字**；`c_define.js` 全文件的 `mkLabel()` **只有 1 处调用**（第 678 行）。
也就是说 §1.4 要求的这些标注目前**全部缺失**，需要在 T16c 里从零补齐：

- `dimension`：测量框 + 宽/高**尺寸线 + 箭头 + 真实刻度数字**
- `circle`：单位圆 `r=1` 与**半径刻度**
- `circumference`：弧展开成直线段并标 **`2π`**（`CIRC = TAU*R` 的真实读数已有）
- `sine`：`y=sin x` 标注
- `tangents`：切线逐条落下并显示**斜率数字**（每条卡一个起音点，`sync.onsetsIn`）
- `infinity`：∞ 拧成流动的标注
- `limitations`：**ε 带与 `lim` 字号 ≥80px**（`EPS=0.09` 的几何已有；**字号未核过**，因为字根本没画）

`t)`/`b)`/`u)` 未复核（留给 T23）；未跑全量 `?selftest`。
