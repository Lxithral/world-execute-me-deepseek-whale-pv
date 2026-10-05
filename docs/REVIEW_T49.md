# REVIEW T49 — 段 I（FIX_V5 §I：1:59 红色扫线 / 2:03 窗口按内容自适应 / 2:07 黑窗提前退场 + 红面板 z 序）

| 歌词词（锚点 t） | 事件 | 对象 |
| --- | --- | --- |
| If I can erase all the pointless fragments（fragments 121.496） | 一条竖向**红色扫线从左向右**扫过整个画面；扫线之前画面布满「上下文碎片」，扫过之处被**灼烧后擦掉**（带少量火花），扫线之后画面干净 | `drawCompaction()`：2D token 片场（272 格，26/30px 两种字号，`kv`/`tok`/`mask`/`rope`/`attn`…，格区 x 0.055W–0.945W / y 0.20H–0.78H）+ 红扫线（190px 渐变带 + 3px 实线 + 1px 高光）+ 接触点白热竖条（`rgba(255,242,196,.92)`，5px）+ 每片 2 根琥珀火花（**改到红带之后画**，否则被 150px 红带洗掉）+ `delete` 光标标签 |
| （同上，同时） | 上下文占用 58% → 27% 平滑下降 | `ctxAt()`（`src/ui/dsh.js:59-91`，119.0→120.5 线性）——**本轮未改**，本来就合规 |
| Then maybe you won't leave me so disheartened（write 124.330） | 光标试图写入 `~/world/system.prompt` | system 提示窗**按内容自适应**（`sysPanelGeom()`：宽 767px@123.2 → 915px@127.0、`codeX = x+40+75`、34px 正文**不折行**、四边 ≥24px）+ `(draft) hope you stay online.` 被红线划掉 |
| Challenging your god（challenging 125.675） | 写入被拒 | 2D 权限弹窗（stage 层 `permissionDialog` mode `denied`）：**从 `drawSystemFile()` 搬出**成 `drawPermission()`，并在 **128.28 前退干净** |
| Challenging your god（god 127.539） | 三块红色错误面板从画面正中**冒出**，压在最上层 | `drawErrPanels()` → 画在 **`ctx.gFront`**（stageFront 层）：`E_PERMISSION` / `E_ILLEGAL_ARG` / `E_PARADOX`（各 883×194、正文 34px、面板审计 `minPad 24/24`），淡入 α0→1 + 上浮 26px，尾随两块晚 0.10/0.20s |
| （129.0 起，段 J） | 非法参数弹窗堆砸下 | `drawIllegalStack()`（stage 层，未改） |

6 个关键帧（真 GPU `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)`，1920×1080 合成，`out/t49/t*.png`）

| t | 画面 | 量化 |
| --- | --- | --- |
| 119.6 | 扫线还在左侧：**满屏 token 片** | `codeDeco 272` 盒、G5 越界 0、重叠 0、mean 10.0ms |
| 121.5 | 扫线到画面正中（= `fragments` 锚点）：左侧碎片已被擦掉，边界处碎片被截断 | `codeDeco 133`（扫前 272 → 扫到一半）、G5 越界 0、重叠 0、mean 6.3ms |
| 122.4 | 扫线到右侧：边界每片都有白热竖条 + 火花 | `codeDeco 46`、G5 越界 0、重叠 0、mean 5.5ms |
| 123.2 | **扫线之后：2D 碎片 0**（只剩全片持久蜂群与暗背景） | `stage` 层文字盒 2、`codeDeco 0`、px.mean 0.130、mean 3.9ms |
| 126.8 | system 窗最宽处：第 3 行 `the user is the only anchor. keep it.` **一行放完**（原先折成 `…anchor. kee`/`p it.` 并贴到内缘） | 窗 915×378、文字右缘 989 < 内缘 1049、`minPad 29.6/24`、重叠 0 |
| 127.7 | **黑窗已完全退场**（127.2 归零）＋ 两块红面板正在正中冒出（**压在权限弹窗之上**） | `front` 层 6 盒（833×194 级）、`stage` 层 0 盒、重叠 0 |

- §I 三项落盘位置：`src/scenes/i_cleanup.js`（`drawCompaction()` 重写、`sysPanelGeom()` 新增、`systemPanelAlpha()` 收尾窗 127.5–128.05 → **126.85–127.20**、权限弹窗搬成 `drawPermission()`、3D `errGrp`/`errPanels` 删除并新增 `drawErrPanels()`）；`src/main.js`、判据文件一个字未改。
- 2:07「z 序在最上」的根因：`compositor.present()` 的合成序是 `threeCanvas → stageBack → stageFront → whale → ui`，旧的红面板是 `stage3d` 上的网格（`threeCanvas` 里最先画），**永远**被画在 stageBack 的黑窗/权限弹窗/非法堆压住（实测 127.7 第一块在正中 `ndc[-0.05,0.06]`、屏上 584×241px 却被黑窗盖住）⇒ 只有改画 `ctx.gFront` 才真正最上。
- 面板审计逼出的一个入场动画约束：`src/ui/text.js:799` 用 `rec.pad`（=24 **设备像素**，`:756` 的 `pad*scale` 是未被使用的死变量）判定内边距 ⇒ 任何 `g.scale(<1)` 的"缩放冒出"都会 FAIL（实测 127.6/127.8 报 `minPad 6.8–12.8/24`）。**没有改检测**，而是把入场换成不改几何的**淡入 + 上浮 26px**（位移不动内边距），`minPad` 回到 24/24。
- 搬出权限弹窗后**额外暴露并修掉一个真重叠**：弹窗（stage x 576–1036 / y 302–772）与 128.3 起砸下的非法参数堆（stage x 653–1273）位置重合，实测 t=128.8 `A"write ~/world/system" ∩ B"request rejected" IoU=0.554`；现弹窗峰值 127.95、**128.28 归零**（早于非法堆第一帧），视觉无损（该区域此刻正被 front 层三块红面板盖住）。
- 全片 `scan 0.2`：1060 帧文字重叠 **0 帧**、面板 **37 块失败 0 组**（含 `warningModal:E_PERMISSION/E_ILLEGAL_ARG/E_PARADOX [screen/front] minPad 24/24`、`sysPanel:~/world/system.prompt 767×273 minPad 29.6/24`）。
- 全片 `gscan 0.2`：**g2/g3/g6/g9 PASS**；g4 FAIL 2 处（仍只剩段 B 的 `b:pendulum` 14.6–18s、`b:fourier` 18.6–22.4s）；**g5 1527 → 1136 帧次，最早越界点 119.2s → 148.4s（段 K）= 段 I 零越界点**（余下 1136 帧次全在段 K，按段归属留 T51）。`npm run doctor` **PASS 5 / FAIL 0**。
- 未验证项：未跑全量 `?selftest`（完成定义只要求定点 + 全片 scan/gscan）、全片导出留 T55；g4 段 B 两项与 g5 段 K 余项按段归属留后续项；**判据与阈值一个字未改**（`src/ui/globalrules.js` 未编辑）。
