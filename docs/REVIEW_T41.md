# REVIEW T41 —— 全局面板系统（FIX_V5 §G1）

## 词 → 事件 → 对象
| 词 / 锚点 | 事件 | 对象 |
|---|---|---|
| `F:chat` | 74–88.8s 三行终端 | src/scenes/f_omnipotent.js:60-61 → src/lib/props/termpane.js |
| `G/L` `G/R` | 88.8–103.5s 左右两块 | src/scenes/g_glitch.js:257-260 |
| `H:isolation` / `H:completion` | 103.6–118.5s | src/scenes/h_absence.js:63-72,84-93（tilt 0.22→0.04 @:418） |
| `J` kvFill/limit | 129–147.9s 三块 | src/scenes/j_overflow.js:69-81（tilt ±0.30→±0.04 @:261） |
| 重连 1/5…5/5 | 1:52–1:56 横幅 + 灰窗 | src/ui/dsh.js `reconnectBanner` / src/scenes/h_absence.js:497,566-589 |
| `~/world/system.prompt` | 2:03.2–2:08 石碑 | src/scenes/i_cleanup.js:381-…（行号槽 + 折行 + 淡出） |
| permission / `E_ILLEGAL_ARG` | 2:07.8 / 2:08.8 | src/ui/dsh.js `permissionDialog` / `warningModal` |
| `train · loss` | 2:42.6–2:47 | src/scenes/l_training.js:178-217 |
| `~/world/love.py` | 3:01.8–3:08.4 | src/scenes/m_algebra.js:115-152 |
| handoff / `session #001,#002` | 3:10.4–3:25.9 | src/ui/dsh.js `nestedWindow` + src/scenes/n_handoff.js:113,266,298 |

## 量化（`node .scratch_layers.mjs scan 0.2`：1060 帧，全片）
**31 块面板，失败 0 组**（`?probe=panels` 表见 out/_scan020c.log）。3D 终端屏（纹理层 `tex#67–74`）窗口宽由内容决定 320/394/399/467/475/626/701px（旧代码固定 0.96 世界宽 = 1024px），UV 已收缩到窗口区，正文 `minPad 47.7–48 / 24`；标题栏（chrome，pad 0）`11.1 / 0`。2D 面板 `minPad 24 / 24`（`sysPanel` 29.6 / 24），标题栏 `2.3 / 0`——修前 5 块标题 scope 越界 0.9px（middle 基线画在 `y+titleH/2+0.5`）已改 top 基线。demo 三块另经 `?demo=panes&shot=2` 实测 `w=0.629`、`uv=[0,1,0.655,1,0,0.762,0.655,0.762]`、画布像素和 5.25M/7.58M/3.75M（确已绘制）。
清晰度：`MeshBasicMaterial + toneMapped=false`、纹理 2048×1280、`anisotropy 16`、`mipmap`，独立 `PANEL_LAYER=3` 在 post 之后单独渲染 → 不参与 bloom / 径向模糊 / 色调映射。倾斜：termpane drift ≤2.58°/2.01° + 场景基准 ≤2.29° → 合成 ≤4.87° ≤ 6°。字号：面板文字统一 34px（2D 组件 12–16px、`subtitle` 22px、读数 13px 全部改写）；`drawCodeBlock` 行号槽 74.8px 已让出。
自检：新增 `r2 面板包含`（每 0.5s 全片，文字盒 ⊄ 所属面板 = FAIL）；`?probe=textscan` 顺带输出面板表。

## 6 关键帧（out/t41/）
`t75.0.png` F:chat 终端 · `t90.0.png` G/L+G/R · `t105.0.png` H:isolation · `t131.0.png` J×3 · `t163.5.png` train · loss · `t182.5.png` love.py

## 未做 / 已知
- t=38.2s（段 C）stage 重叠 1 处「2π = 6.2832」∩「y = sin x」→ 属 **T43（段 B/C）**，本轮未动。
- 非面板浮动标注仍 12–24px：f_omnipotent.js:552/566/644、i_cleanup.js:273(`ctx.debug`)/337/350、j_overflow.js:303、l_training.js:619、n_handoff.js:345、h_absence.js:392/478、k_storm.js:331/336(`ctx.debug`)/1007 → 属 §2.3 / **T42**。
- 面板文本仍有中文（demo panes、`handoffCard` 等）→ §G2 / **T42**。
