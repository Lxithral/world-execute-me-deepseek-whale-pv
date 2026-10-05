# REVIEW T42 — 全局规则 G2–G6 / G9（FIX_V5.md:11–18、:96）

| 词 / 规则 | 事件 | 对象（文件:行） |
| --- | --- | --- |
| G2 去中文 | 21 条终端台词 + 营养标签 / PURR / 三条律条 / 石碑草稿英文化 | `src/data/dialogue.js:47–142`；`src/scenes/f_omnipotent.js:278,279,403,455`；`src/scenes/i_cleanup.js:417` |
| G2 署名页 | 删「界面致敬 DeepSeek Harness」，另两行英文化（专有人名保留） | `src/scenes/n_handoff.js:371–376` |
| G2 判据 | 白名单只有 `上善`（CC 人名）与 `六`（K 段六语计数卡），**不是**整段时间豁免 | `src/ui/globalrules.js:31–41` |
| G3 判据 | 可见同名 subject >1 = 重名；`textPlane`/`glowTube`/`termpaneMesh` 改逐实例唯一名 | `src/lib/scene3d.js:135,341`；`src/lib/props/termpane.js:139` |
| G4 判据 | 名字含 lever/摇杆 + 「胶囊/细柱 + 端头球」形状签名 | `src/ui/globalrules.js:140–180` |
| G5 判据 | 安全区 [5%,95%]×[8%,80%]，排除 `lyrics`（字幕贴底是设计，G2 也已单独摘出） | `src/ui/globalrules.js:75–103` |
| G6 判据 | 施密特触发数零穿越（裸数零穿越会把粒子闪烁误判成几十 Hz），2s 滑窗取最大 f | `src/ui/globalrules.js` alternationFrequency |
| G9 判据 | 名字含 `sun` + 「圆盘/球 + ≥6 根放射细长件」结构 | `src/ui/globalrules.js:186–214` |
| 自检挂载 | `?selftest` 新增 g2/g3/g4/g5/g6/g9（六条**共用一次**全片扫描）+ `?probe=global&gap=` | `src/main.js:2021–2060,2097–2140,2619` |

## 全片实测（`node .scratch_layers.mjs gscan 0.2`：1060 帧 + 6357 亮度帧，327.8s，1920×1080）
- **PASS g2**（除歌词层无汉字）/ **PASS g3**（0 重名）/ **PASS g6**（最强 2s 窗 0Hz ≤ 2.5Hz，摆幅 0.9209）。
- **FAIL g4** 4 项：`b:pendulum` 14.6–18s、`b:fourier` 18.6–22.4s（段 B → T43）；`g:lever` 89–103.4s（名字+形状双命中，段 G → T47）。
- **FAIL g9** 2 项：`e:orb` 64.8–68.2s、`segE` 69.6–70s（段 E → T45 改奖励折线）。
- **FAIL g5** 1606 帧次越界（332 项 distinct，已排除歌词层；分层 stage 1419 / unknown 187）：C 1、G 6、H 1、I 33、K 50、L 215、M 4、N 22；逐项清单见 `out/_g2diag.json`（`.scratch_safesum.mjs` 复现）。
- 交叉结论：3D `clock.js` 的 `sunMoon` **不在正片渲染树**（只被 `z_demo_f2b` / props 预览页使用）；段 G 的钟表是 `g_glitch.js:167–256` 自建（天空只有两片渐变、无太阳圆盘）。
- 本轮**只改 G2 文案 + G3 命名 + G4 判据**：G4/G5/G9 的「修」按段归属留给 T43/T45/T47/T48/T49/T51/T52/T53，自检照报 FAIL，六个阈值一个没改。
- 回归：`scan 0.2` 全片 1060 帧仍只有 `t=38.2 (C)` 一处重叠（属 T43）；31 块面板 / 失败 0 组（T41 未回退）。

## 关键帧（`out/t42/`）
t77.8 营养标签 · t84.5 PURR · t87.6 三条律条 · t125.6 石碑草稿 · t160.0 六语计数卡（`六`）· t211.3 署名页
