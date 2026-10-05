# REVIEW T46 — 段 F（FIX_V5 §F：1:14 终端清晰度、1:18 删发光指标条、1:27 删中文石碑）

| 词 | 事件 | 对象（改动处） |
|---|---|---|
| 1:14 | 左侧终端字太小/发糊（34px 逻辑字上屏只有 ≈17px） | `src/lib/props/termpane.js` 加 `maxWinW`（`WIN_CAP` 只封顶窗口宽，不改其它段）；`src/lib/props/monitor.js` 用 `pane.width/height` 取代恒 `undefined` 的 `pane.worldW/worldH`（机身这才真正跟随内容窗口）；`src/scenes/f_omnipotent.js`：`createTermPane({session:'#001',side:'L',maxWinW:700})` + `mon.object.scale.setScalar(2)` + 定位改「屏幕左缘锚定 28px」 |
| 1:18 | 删发光指标条（dietary fiber 0.68 / potassium 0.46 两条圆角横条） | `src/scenes/f_omnipotent.js`：`drawEmojiMetrics()`（原 :272-301，`x=W*0.60,y=H*0.30,MONO(34,600),320×16 roundRect`）与其两处调用（eggplant `tNut`、tomato `antioxidant`）删除，原位留注释；营养/抗氧化改由终端英文行输出 |
| 1:18 | 营养·抗氧化改终端英文行 | `src/data/dialogue.js` 段 F：`lookup("eggplant")\n  → fiber ▮▮▮▯\n  → potassium ▮▮▯▯`、`scan.antioxidant\n  → lycopene ▮▮▮▮`（首部 `⚙` 去掉：`ROW_STYLE.tool.prefix` 已经加，原来屏上是双字形 `⚙ ⚙`） |
| 1:27 | 删中文大框石碑，system 提示改终端 `cat system_prompt.md` | `src/scenes/f_omnipotent.js`：`drawSystemTablet()`（原 :429-459，金边 0.36W×0.30H 三条规条）及 god 拍调用删除，`SYS_LINES` 保留（`drawRoseWindow` 只用它取行宽）；`dialogue.js` god 拍改为 `cat system_prompt.md` + `1./2./3.` 三条英文律条（+0.25/+0.5/+0.75），删 `→ author: you` 行以让 7 行窗口装得下 |
| 全段 | 终端内容改由 dialogue 行驱动、且不再只在 eggplant 拍刷新 | `f_omnipotent.js` `updateChatPane(self,ctx,t,tEgg)` 重写：`dialogueOf('F')` 按 `ctx.cues.sec('F',anchor,note)` + `offset` 逐行出现，跳过 `kind==='cursor'`；调用点从 eggplant 分支移到 render 最前（原来 77.7s 后永不再刷新），先刷新后定位（定位要读本帧 `chatPane.width`） |

## 量化
- **字号模型**：上屏 px = `34(逻辑) × SCALE(2) × (0.96/2048) × scale × pxPerWorld(≈531)` = **16.9 × scale** ⇒ 修前 scale=1 ≈**17px**（"模糊"根因，与材质/纹理/后处理无关：2048 纹理、aniso 16、toneMapped=false、noPost=true 一直合规）；修后 scale=2 ≈**34px**，落在 G1 的 30–40px。
- **面板实测**（`.scratch_t46.mjs`，真 GPU `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11)`）：74.5/77.6/80.6/83.8/86.6/87.3/88.0 → winW=320/691/700/700/700/497/497，上屏=[281,143]/[671,447]/[700,458]/[713,460]/[727,462]/[529,464]/[529,463]；纹理恒 2048×1280。
- **取景**：box 左缘 66/45/36/28/23/22/22px（**全部在画面内**，不再被裁）；中心 ≤386px=**0.201 ≤0.22**（左带）；面积 ≤727×462=16% ≤22%；box y 0.24–0.67 不进歌词区（y>0.8）；右缘 ≤750px=0.391（hero 包围盒左缘 ≈0.42）。
- **tilt** = 面板法线（世界 +z，面板自身 rotation 恒等）与相机视线夹角 = 相机朝原点偏航，同帧**所有**面板同值（74.5 的 6.86° 对所有面板成立），由 rig 相机驱动、T46 未引入；78.2s 起 ≤4.07°。
- 每帧 mean 2.3–5.7ms（含 `gl.finish`，极值 1.8–9.0ms）；全部 `errors=0`；纹理内文字审计 39–44 块**失败 0**、违规 0。
- **全片文字扫描（`scan 0.2`，1060 帧）**：**重叠命中 0 帧**；面板 31 块/**失败 0 组**（F 面板 74–88.2s：盒 16、minPad 48/24、越界 0）。
- 6 关键帧（`out/t46/`）：`t74.5.png`（小面板 + 机身贴合玻璃）、`t77.6.png`（7 行英文 + 两行 `▮` 值行，无指标条、无裁切）、`t80.6.png`（`⚙ scan.antioxidant`/`→ lycopene ▮▮▮▮`，指标条已消失）、`t83.8.png`（猫拍）、`t86.6.png`（`⚙ cat system_prompt.md` 出现、中文石碑已消失）、`t88.0.png`（淡出）。

## 判断与遗留（诚实状态）
- §F 逐条对账：1:14 清晰度 ✓（30–40px、面板=内容+24px 内边距、文字不出窗口）；1:18 指标条 ✓ 删除且营养/抗氧化在终端里；1:27 石碑 ✓ 删除、system 提示改为终端 `cat system_prompt.md` 的英文输出。判据/阈值零改动（`src/ui/globalrules.js` 未编辑，探针只读）。
- 顺带修掉组件自身的真 bug：`src/lib/props/monitor.js` 读的 `pane.worldW/worldH` 恒 `undefined` ⇒ 机身永远按 0.96×0.6 建、内容窗口再小也不收（屏上就是"小屏浮在大框里"），与该文件头注释承诺的「屏面永远填满玻璃」相反；改读 `pane.width/height` 后机身随内容收放。
- 未做：全片导出（T55）；g4 的段 G 拨杆（→T47）与 g5 其余段遗留按段归属留 T47–T53；本段只跑定点 + 全片 textscan，未跑全量 `?selftest`。
