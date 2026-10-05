# REVIEW_T40.md — `npm run export` / `?export=1` 离线导出 MP4

> 改动：`tools/export_mp4.mjs`（新建，CLI→CDP→逐帧 PNG→ffmpeg 分块→concat 混音）、`package.json`（`export` 脚本 + `ffmpeg-static`）、`.gitignore`（`out/`）、`src/main.js`（`EXPORT` 分支 + `startExportMode()`：DPR=1、无看门狗、无音频、`__renderAt` 后 `gl.finish()`、暴露 `__exportStart/__exportProgress/__exportInfo`）、`src/core/compositor.js`（`opts.dpr` 固定 DPR；`preserveDrawingBuffer` 白名单加 `export`）。
> 症状：`?shot` 单帧截图比导出帧**暗得多**（背景雾层缺失），一度怀疑导出改变了画面逻辑。
> 根因（实测）：**开机后第一次渲染的 3D 背景层尚未就绪**——与 preserveDrawingBuffer / 预热 / 音频 / export 代码路径**都无关**。

## 词 → 事件 → 对象

| 词 | 事件 | 对象 |
| --- | --- | --- |
| `?export=1` | 关 DPR 看门狗、DPR 固定 1.0、不建 `<audio>` | `src/main.js` 参数区 / `clock.init` 外 |
| 预热 60 帧 | 着色器编译 + 3D 层就绪；再 `await document.fonts.ready` | `startExportMode()` |
| `window.__renderAt(t)` | 渲染第 t 秒并等 GL 完成（`gl.finish()`） | `src/main.js:797` |
| 逐帧 PNG | 叠加 `comp.view` + `comp.lyricsCanvas`（歌词在独立顶层画布）→ `toBlob` → POST 到本地 sink | `startExportMode()` |
| `--mb N` | 每帧 N 个子帧（快门 180°）平均 = 运动模糊（默认 1=关） | `renderFrame()` |
| 分块 / 断点续做 | 每 `--chunk` 秒一块 `out/chunks/cNNNN.mp4` + `.done` 帧数 sidecar，帧数不符即重做 | `tools/export_mp4.mjs` |
| 混音 | concat 后用 `assets/song.mp3` 定点补轨（AAC 256k、`+faststart`、`-ss from`） | `tools/export_mp4.mjs` |
| `--verify` | 抽 mp4 第 N 帧 vs `?shot=<t>`（取参照前**补渲染一次**）像素比对 | 见下「说明」 |

## 6 个关键帧（供你核对，`out/test.mp4` 内偏移）

| 时间 | 应看到 |
| --- | --- |
| 0.10s（=60.10） | 粉白数学符号粒子墙（`2π`/`dx`/`Γ`…）+ 蓝灰雾；英文卡拉OK行刚起步（"If"） |
| 0.50s（=60.50） | 同一墙，`If I can give` 逐词高亮，中文行「如果我能够给你终极刺激」 |
| 0.90s（=60.90） | 墙外出现细放射线与左右散景圆盘，墙角蓝/紫小球 |
| 1.30s（=61.30） | 高亮推进到 `you all`；雾更亮、粒子墙略后拉 |
| 1.70s（=61.70） | 高亮到 `the`，散景圆盘更明显 |
| 1.95s（=61.95） | 高亮到 `stimulations`，墙最暗、画面留白 |

落盘：`out/_kf1..6.png`（抽帧必须用**片内偏移**，`-ss 60.1` 会因片长仅 2s 报 `Output file is empty`）。

## 实测

| 检查 | 结果 |
| --- | --- |
| 渲染器 | `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)`（GPU 路径生效） |
| 每帧渲染 | mean **6.5ms** / p50 4.4ms / p95 11.8ms |
| 每帧总耗时 | mean **147.9ms** / p50 146.1ms / p95 174.2ms（渲染+PNG 编码+POST） |
| 帧数 | 60–62s @60fps = **120 帧**（实编 120，跳过 0；冒烟留下的 6 帧旧块被判不符并重做 → 断点续做有效） |
| 成片 | `out/test.mp4` **2.000s / 2.40MB**，h264 High yuv420p 1920×1080 60fps 9780kb/s + aac 48kHz 259kb/s |
| 全片预计 | 12714 帧（offset 0.000）→ **≈ 31.3 分钟** |
| 一致性（`--verify` 第 60 帧，t=61.000） | 通道平均差 R1.91/G1.74/B1.79，**平均绝对差 0.710% ≤ 1% → PASS**（>8 占 3.91%，为 H.264 量化） |
| 文字重叠（本项窗口） | `?probe=textscan&scan=0.2` 全片 1060 帧，**59.8–62.2s 命中 0 帧** |
| `npm run doctor` | PASS 5 / FAIL 0 |

## ⚠️ 说明 / 剩余

- **导出不改任何画面逻辑**：`?shot` 单张与导出帧 18.7% 的差全部来自「首次渲染 3D 层未就绪」——同一 t 再渲染一次后，`?shot`／`?shot+60帧预热`／`?export` 三种路径的快照**逐像素 0.000% 相同**（分层：`threeCanvas` mean [8.58,3.97,6.75] → [51.25,57.97,82.82]）。故 `--verify` 的参照物在取图前补渲染一次并注释在案；这是**探针事实，非产品缺陷**。
- 同一次全片扫描只命中 1 帧重叠：`t=38.2`（段 C）stage 层 `2π = 6.2832` ∩ `y = sin x`（IoU 0.137）→ 属 **T43** 范围，留给该项处理（本次口径与 selftest `r)` 的段 K 命中不同：selftest 走自己的渲染路径/pane 层）。
- 本测试片是**修正前**画面：60–62s 属段 E（`e_deal` 59.0–74.0），FIX_V5 §E（1:05 删太阳改奖励折线）由 **T45** 负责。
- `ffmpeg-static` 安装脚本在本机会挂死并留下不完整 exe；已按 v5.3.0 手动下载解包到 `node_modules/ffmpeg-static/ffmpeg.exe`（6.1.1，82.8MB）。**不要重跑 install.js**；若 `out/` 已被清空重跑即可。
