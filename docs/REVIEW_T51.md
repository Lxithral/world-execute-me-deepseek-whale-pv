# REVIEW T51 — 段 K/L（§K/L 2:42 / 2:51 / 2:56，范围 147.9–177.4s）

改：`src/scenes/l_training.js`（气泡→大号终端、棱镜光路全部重写、公式风暴 G5 夹取）、`src/scenes/k_storm.js`（工具卡列/数字卡列/潮汐公式/公式风暴的 G5 夹取）。**判据/阈值一个字未改**（`src/ui/globalrules.js`、`src/ui/text.js`、`tools/selftest.mjs` 均未编辑）。

| 词 | 事件 | 对象/机制 |
| --- | --- | --- |
| 2:42 左上角窗口标题溢出 | 复核结论：**已被 T41 的全局修覆盖**，本次无需改代码。面板审计实测 `title:train · loss` 162.6–167.0s ×23 帧、盒 1、`minPad 2.3/0`（标题栏 `pad:0` 口径）、越界 0；标题文字盒 x 0.086–0.214 / y 0.202–0.239 完全在标题栏内 | `l_training.js:149-193 drawLossChart` + `src/ui/dsh.js:156-194 panel()`（top 基线 + `maxTW=w-24` 截断 + 裁剪） |
| 2:51 聊天气泡 → 大号终端 | 删掉气泡全栈（`TYPING='对方正在输入…'`、中文 `DRAFTS=['在吗','我有话想说','…算了']`、`buildTypingBubble`/`drawBubbleFace`/`drawSpeedLinesUnused`/`updateTypingBubble`/`drawTypingHint`/`bubbleShards`、`init()` 的 3D 面片 + 420 粒 `THREE.Points`）；改 `drawTerminal()`：`beginPanel→panel({title:'dsh · session #001', bg:'rgba(14,17,24,0.86)'})→endPanel`，`TERM_W_FRAC=0.58`（≥0.55，实测 1114px）、高 300、`y=0.30H`（右缘 0.790W / 底 0.578H 全在 G5 内） | `l_training.js:244-331 drawTerminal`；imports 收敛（去 `THREE`/`roundRect`） |
| 2:51 三段草稿逐字键入又删除 | 英文短句 `['you there?','still here','never mind']`，窗 `[tBall−2.92, tBall]`=170.78→173.70 均分三段，每段 `0–0.46 键入 / 0.46–0.56 停 / 0.56–1 删除`；提示符 `MONO(84,700)`（≥80px）+ `cursorOn()` 闪烁方块 | `l_training.js` `TERM_DRAFTS`/`TERM_PX=84` |
| 2:51 状态行 `peer typing` 闪烁三点 | `MONO(34,600)` + 3 个 `arc`，亮度 `0.5+0.5·sin((t·2.4−i·0.42)·TAU)` | 同上 |
| 2:51 立绘不入面板同侧（G1） | 终端在场期间立绘退场：`hideForTerminal = span(170.35,170.72)·(1−span(173.75,174.12))`，与原 `hideForPrism=span(173.9,174.6)` 取 `max`；理由见下 #1 | `l_training.js` render 立绘 alpha |
| 2:56 等边三角形（顶点由计算给出） | `R=H·0.20=216`、`cy=0.44H`：`PA=(cx,cy−R)`、`PB=(cx+√3/2·R, cy+R/2)`、`PC=(cx−√3/2·R, cy+R/2)`；实测三边 **均 374.123px = R√3**（等边 ✓）；外法线 `nL=(−cos30,−0.5)`/`nR=(cos30,−0.5)` | `l_training.js:462-` `drawPrism`（顶点命名 **PA/PB/PC**，见 #2） |
| 2:56 白光从左一段一段画进入射点（≈0.8s） | `beamU=clamp(u/0.78)`；`Ldir` 由 `phi=π/6−θi` 给出（**从左下斜射**，实测入射方向角 1.74°），8 段 dash 逐段补到入射点 `E=PC+0.42(PA−PC)`=(0.4435W, 0.414H)，画满画入射亮点 | 同上 |
| 2:56 玻璃内折射可见（≈0.6s）+ 柯西色散 | `n(λ)=A+B/λ²`（`CAUCHY_A=1.48`、`CAUCHY_B=0.03`）、矢量斯涅尔 `refract()`；`refrU=clamp((u−0.78)/0.58)` 逐波长画入射点→出射点（内部方向角 400nm 1.74° → 700nm −0.82°，**近平行底边略微分色**）+ 入射点径向辉光 | 同上 |
| 2:56 6–7 色扇形（≈1.2s），起点严格落在出射点 | 7 条 `SPECTRUM`（400/440/480/520/570/625/700nm），`fanU=clamp((u−1.36)/1.14)`，每条**从本波长自己的出射点**出发（实测 7 点 x 0.5556–0.5585 / y 0.4112–0.4202，聚在 10px 内）+ 出射亮点；出射方向角 31.30°→18.72°（张角 **12.58°**） | 同上 |
| 2:56 全程渐进、不得一闪而过 | `env=clamp(u/0.25)·fade`（快速进出**包络**，不是 2.5s 慢斜坡）；三段 0.78/0.58/1.14s 串联 = 2.50s，`PRISM_T0=tBall+1.2=174.903` → 177.4 | 同上 + render 的 `PRISM_T0`/`prism` |
| G5 段 K 工具卡标签列 left 1.5–3.1% / px68 `"0"` top 1.0% | `drawToolCards`：`targetX=Math.round(W·0.07)`（原 20）、**去掉 x 抖动**（只留 y `jolt`）、标签 `labelA=clamp((sx+16−(safeL+8))/18)` 配 `globalAlpha≤0.04` 门槛（入场瞬间不登记） | `k_storm.js drawToolCards/drawToolCardLg` |
| G5 段 K 数字卡 `DE` left 3.1% / `六` right 1.0% | `drawNumeralFlips`：`cw=W·0.14`、`gap=(W·0.90−cw·N)/(N−1)`、`x0=W·0.05`（实测卡左缘 96、右缘 ≤1824） | `k_storm.js drawNumeralFlips` |
| G5 段 L 风暴 px12（164.2–169.7）/ 棱镜标注 bottom 86.5% | 都改成**旋转外接矩形**夹取：`extX=|cosθ|·hw+|sinθ|·hh`、`extY=|sinθ|·hw+|cosθ|·hh`，`hw` 由同字号 `measureText`（×1.35 兜 Cambria Math 回退差）+ 24px 得出；棱镜标注 15px@0.86H → **22px@0.765H** + 暗描边 | `k_storm.js drawTidalFormulas`、`l_training.js drawBangFormulas/drawPrism` |

证据（真 GPU `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)`）：`node .scratch_t51scan.mjs 147.9 177.4 0.1` → **296 帧：G5 越界 0 帧/0 实例、文字重叠 0 帧/0 实例**（修前同范围 = 211 帧 / **906 实例**，K 工具卡 left、`DE`/`六`/`Ein`、px68 `0` top、L 风暴 px12、棱镜标注 bottom 全在其中）；定点 7 帧（148.4/151.8/162.6/172.6/175.3/176.0/177.2）全部 `errors=0`、违规 0、G5 0、重叠 0，每帧 mean **4.5–11.9ms**（含 `gl.finish`）；全片 `node .scratch_layers.mjs scan 0.2` → 1060 帧文字重叠 **0 帧**、面板 **39 块失败 0 组**（新增 `title:dsh · session #001`/`l:term` 170.8–173.6s ×15 帧、盒 4、`minPad 29.6/24`、越界 0、矩形 1114×300）；`npm run doctor` → **PASS 5 / FAIL 0**（b1 75 / b2 74 / c 144）。**注**：全片 `scan=0.2` 只跑"文本重叠 + 面板审计"（判据公开的独立通道），不是 `?selftest`；段 K/L 的 g5 由上面 296 帧枚举直接归零。
关键帧（`out/t51/t<t>.png`）：**148.4** K 工具卡列 x≥96 入场、mean 4.6ms；**151.8** 数字卡 `DE` 列 x 0.05–0.81W、25 个舞台盒 0 越界（修前 `DE` left 3.1% / `"0"` top 1.0%）；**162.6** `train · loss` 标题盒 y 0.202–0.239 在标题栏内、`loss 2.9590 step 26` y 0.54–0.577、面板 `minPad 24/24`；**172.6** 终端 `dsh · session #001` + `› stil|` + `peer typing ●●●`，`terminal={alpha:1,idx:1,typed:0.42,draft:'still here',boxW:0.58}`，立绘已退场；**175.3** `beamU=0.509`（白光画到一半、等边三角形可见、`prism.a=1`）；**176.0** `beamU=1,refrU=0.547`（玻璃内逐波长光路）；**177.2** `fanU=0.822`（7 色扇形从各自出射点展开 + 标注 @0.765H）。

1. **0.55W 的终端放不进「立绘 + G5」剩下的带宽 ⇒ 立绘让位**：立绘 rect 恒占 x 0.591–0.909（y 0.15–1.17），G5 又要求舞台文字左缘 ≥5%W ⇒ 无立绘时可用带宽只有 1135−96=1039px=**54.1% < 55%**。"宽 ≥55%"与 G1"立绘出场期间同侧不放面板"在本拍无法同时满足，故按 G1 让立绘在终端窗内退场，终端取 58%。两段淡变窗（170.35–170.72 / 173.75–174.12）与原 `hideForPrism` 不重叠。
2. **`const C` 遮蔽调色板**：顶点若命名 `A/B/C`，函数内 `const C` 会遮蔽 palette 的 `C` ⇒ `rgba(C.fg,…)` 变 `rgba(undefined,…)` → `Cannot read properties of undefined (reading 'replace')`（栈指当时 580 行；靠探针新增的 `__errors` 栈打印才抓到）。改名 **PA/PB/PC** 并留注释防复发。
3. **`a` 不能当"元素不透明度"**：`a`（=`span(t,PRISM_T0,177.4)`）是整段 2.5s 慢斜坡，入射/折射阶段只有 0.16–0.55 ⇒ 175.3 截图几乎只剩银河、光路图看不清。改成快速包络 `env=clamp(u/0.25)·fade`，三段动画自己负责"渐进出现"；同帧 `prism.a` 0.159 → **1**。
4. **旋转公式的夹取必须用外接矩形**：只按半宽夹中心时，长公式（attention ≈150px）旋转后竖直方向甩出 ~80px，字盒照样越 8%/80%（修前 164.2–169.7 共 58 帧 / 508 实例）；改 `extX/extY` 后归零。
5. **2:42 只做复核、不改代码**：T41 已把标题改 top 基线 + 截断 + 裁剪，全片 39 块面板 0 失败、标题盒实测在标题栏内；按"不放宽门槛、也不动不该动的"原则留证即可。性能：棱镜帧曾 mean 18.3ms（全屏径向渐变）⇒ 只填渐变覆盖的方形区域后 175.3 由 18.3→**11.7ms**，画面不变。
