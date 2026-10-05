# REVIEW T48 — 段 H（FIX_V5 §H：1:51 右侧窗口 / 1:53 短报错 + 立绘同侧 / 1:57 左侧黑框 / 1:58 立体三角形碎片）

| 歌词词（锚点 t） | 事件 | 对象 |
| --- | --- | --- |
| （vibrations 106.256） | 「你」在打字 | 3D 键盘（84 键帽 InstancedMesh 随起音点按下）+ 真实频谱彩带；说明文字 `input waveform · real spectrum`（34px，左上 G5 安全区） |
| Though you have left（completion 110.202） | 幽灵补全 → 按 Tab 接受 | `H:completion` 终端屏（**左带**、屏缘 28px 锚定、上屏 35.0–36.4px）：`you ▸ today i…` → `deepseek ▸ …wanted to see you.`（`ghost`→`deepseek` 变白） |
| You have left 111.859 / 112.768 / 113.721 / 114.615 / 115.520 | 五次离开：重连 1/5…5/5 | 2D 重连横幅（34px、`reconnecting…  k/5` + 失败标记）+ 逐次递进：①`peer: grayed out` ②`caret: frozen` ③**`reconnect 3/5 · ack timeout`**（原「last active N minutes ago」已删）④`her gaze drops.` ⑤`E_CONN_RESET 1006` |
| You have left me in isolation 117.435 | 孤立 | `H:isolation` 终端屏（**左带**、屏缘 28px 锚定、上屏 37.1px、tilt 2.29°）：`⚙ idle · peer offline · waiting…` |
| If I can 118.8+ | 此前所有模型炸成碎片 | **3D 实例化碎片已删除**（原 `TetrahedronGeometry`×240 + `BoxGeometry`×80）；只剩蜂群云与 2D「上下文碎片」token 场（§I 1:59） |

6 个关键帧（真 GPU `ANGLE (AMD, AMD Radeon(TM) Graphics … D3D11)`，1920×1080 合成，`out/t48/t*.png`）

| t | 画面 | 量化 |
| --- | --- | --- |
| 106.4 | 键入波形 + 左上说明文字（已进安全区） | 文字盒 x 0.06 / y 0.105；mean 8.5ms；errors=0 |
| 110.5 | 左带补全屏刚出现 `you ▸ today i…` | `winW 324, fontPx 35.0, left 0.024, right 0.198, cx 0.111`；与立绘(0.591–0.909)零重叠 |
| 111.3 | Tab 接受：补全行变白 | `rows=2, accepted=true, fontPx 36.4, left 0.026, right 0.331, cx 0.179` |
| 113.9 | 第 3 次重连：短报错 | 文字盒 `reconnecting…  3/5`(x 0.083) + `reconnect 3/5 · ack timeout`(x 0.07, y 0.296) |
| 117.3 | 孤立屏完整可读 | `winW 320, fontPx 37.1, left 0.022, right 0.204, cx 0.113, tilt 2.29°`；mean 5.2ms |
| 118.8 | 碎片消失后的画面 | `§H1:58 四面体=0`、`I.metrics.shards=0`；mean 3.8ms、px.mean 0.238 |

- 1:51/1:57 的做法：两块屏一律 `placePaneLeft()` 锚在**屏幕左缘 28px**（先摆近似位、投影到 NDC 后一步线性修正）+ 窗口宽封顶（`maxWinW 560/520`）+ 整机放大（`scale 2.2/1.15`）；两者都落在 G1 的 30–40px 与 stage_role 左带（中心 0.111–0.179 ≤ 0.22）。
- 删除项核验：`i_cleanup.js` 的 `segI` 组、两组 InstancedMesh、两盏 DirectionalLight、`shardData`/`_iM/_iQ/_iC` 与其逐片驱动/扫描线块全部移除；`TetrahedronGeometry`/段 I 立方体实例数全片采样点均为 0（grep 另证 `shardA/shardB/metrics.shards` 在本文件外零消费者）。
- 全片 `scan 0.2`：1060 帧文字重叠命中 **0**、面板 31 块失败 **0**；全片 `gscan 0.2`：g2/g3/g6/g9 PASS，g4 仍只剩 `b:pendulum`(14.6–18s)、`b:fourier`(18.6–22.4s) 两项（段 B），**g5 最早越界点 106.4s → 119.2s（段 I）＝段 H 零越界点**；`npm run doctor` PASS 5 / FAIL 0。
- 未验证项：未跑全量 `?selftest`（完成定义只要求定点 + 全片 scan/gscan），全片导出留 T55；g4 的段 B 两项、g5 的段 I 余项按段归属留后续项，**判据与阈值一个字未改**（`src/ui/globalrules.js` 未编辑）。
