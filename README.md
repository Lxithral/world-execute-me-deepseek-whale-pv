# world.execute(me); · DeepSeek 鲸鱼娘版

浏览器里播放的音乐可视化 PV。约 3 分 32 秒，主角是 DeepSeek 鲸鱼娘。
世界观是一次 dsh（DeepSeek Harness）会话的完整生命周期：她是被运行的模型，"你"永远不出镜，
只以输入框光标、键入节奏和"对方正在输入…"出现。

> **非官方同人作品。** 与 DeepSeek、Mili 及所有素材作者没有从属或合作关系，也未经其认可。
> **含 AI 辅助生成内容。** 歌曲与歌词版权属 Mili，不随本项目分发。
> 素材许可为 **CC BY-NC-SA 4.0（仅限非商业）**，详见 [署名与许可](#署名与许可) 与
> [`public/whale/NOTICE.md`](public/whale/NOTICE.md)。

---

## 运行方法

需要 Node ≥ 20、npm，以及 Python 3 + librosa（仅用于音频分析）。

```bash
# 1) 安装依赖
npm install

# 2) 自备歌曲与歌词（受版权保护，不入库）
#    assets/song.flac（优先）或 assets/song.mp3
#    assets/song.lrc
#    参考项目 input/README.md 说明了参考音频的 sha256 与时长（211.913s）

# 3) 生成数据（音频分析 → 歌词解析 → 素材清点 → 鲸鱼娘点云/网格/轮廓）
npm run data

# 4) 开发预览
npm run dev          # http://127.0.0.1:5173/
npm run dev -- --open

# 5) 生产构建 + 静态服务器预览
npm run build
npm run preview      # 或任意静态服务器指向 dist/
```

`npm run data` 需要 `refs/dsh-pv`（素材来源仓库，仅本地只读）：

```bash
git clone --depth 1 https://github.com/MisakaZentai/world-execute-me-dsh-pv refs/dsh-pv
```

### 可用脚本

| 命令 | 作用 |
|---|---|
| `npm run data` | 生成 `public/data/{analysis,lyrics,whale_*}.json`、`assets/whale_inventory.json`、`tools/missing_zh.txt`，并把用到的素材复制到 `public/whale/` |
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 预览 `dist/` |
| `npm run check` | Node 端一致性检查（数据规模、歌词自洽、14 段时间轴无缝、`ctxAt` 关键值） |

### 调试与自检

- `?debug`：底部时间轴（标出 14 个段落 + onsets/beats/歌词刻度）、段落跳转、FPS 与图元计数、
  图层开关（舞台/鲸鱼娘/UI/FX/歌词）、同步偏移微调（`,` `.` ±10ms，Shift ±1ms）、显示 onsets。
- `?selftest`：浏览器内跑并在页面与 console 输出 PASS/FAIL：
  a) 同一 t 渲染两次画布哈希一致、乱序跳转与顺序渲染一致；
  b) 每个段落在 6 个进度点不抛异常、非背景像素占比 > 2%；
  c) 全片每 0.25s 都落在某段内、段落重叠 ≤ 0.4s；
  d) 每句歌词在 `[t0, hold]` 内被绘制、中英包围盒在画面内且互不重叠；
  e) 无音频降级运行不报错；f) `window.__errors` 为空。

### 验收（全量）

- `npm run doctor`（构建 / 语法 / 浏览器 import / 编码 / `__errors`）+ `?selftest&scan=0.5` 全片扫描（425 帧）。
  **最近一次全量结果与逐项口径见 [`docs/PERF.md`](docs/PERF.md)**；修复过程中的每个缺陷都有
  `docs/REVIEW_*.md` 记录（症状 → 实测 → 根因 → 修法 → 复测）。
- ⚠️ **性能数字必须来自真实 GPU**：本仓的开发环境是无 GPU 的无头 Chrome（SwiftShader 软件光栅化），
  `?perf` 的 p50/p95 在软件渲染下没有参考价值。请在本机浏览器里打开 `?perf` 取数。
- ⚠️ `node tools/selftest.mjs "<url>/?selftest&scan=0.5"` 要比页面内直接点跑更稳
  （页面内的自检在软件渲染下可能被自身的超时截断）。

### 操作

- 点击画面开始播放；空格播放/暂停；`←` `→` 前后 5s（Shift 1s）；`f` 全屏。
- 鼠标移动会唤出底部控制条（播放/暂停、拖动、时间、偏移、全屏）。

---

## 结构

```
SPEC.md  DIRECTOR.md  docs/PROGRESS.md
assets/      song.flac|mp3 · song.lrc（用户自备，.gitignore 排除）
refs/        dsh-pv/（参考仓库，.gitignore 排除，不随项目发布）
tools/       analyze_audio.py  parse_lrc.mjs  inventory_whale.mjs  build_whale.mjs  check.mjs
public/data/ analysis.json  lyrics.json  whale_points.json  whale_mesh.json  whale_contour.json（生成物）
public/whale/ 实际用到的素材 + NOTICE.md
src/core/    clock rng sync compositor fx palette ease
src/whale/   sprite points mesh wire exprs
src/ui/      dsh（常驻 HUD 与组件）  typing（逐字/流式）
src/lyrics/  layout  render
src/lib/     formula  code  three_util  tables
src/scenes/  index.js + a_boot … n_handoff（与 DIRECTOR 的段 A–N 一一对应）
```

技术要点：

- **唯一时钟** `t = audio.currentTime + syncOffset`；无音频时降级为内置计时器，不黑屏。
- **纯函数渲染**：任意一帧 = `f(t)`。渲染路径不使用 `Math.random` / `Date.now` / `performance.now`，
  随机一律 `hash(seed, index)`；**也不做任何"每次调用累加"的状态**（贴图 offset、相位、计数器都必须是
  `t` 的闭式——T23a 修过一次真实的反例：段 K 峡谷的滚动贴图是 `offset.y -= 一格`，同一个 `t` 连渲两次
  画面差约 40 万像素）；暂停、拖动、乱序跳转后画面与顺序播放一致（`?selftest` a 项验证）。
- **有状态模拟**（梯度下降小球、损失曲线、KV cache 回收）在 init 阶段按固定步长离线积分成表，
  渲染时按 t 查表插值；GPU 粒子用解析公式 + `uTime` 在着色器里算位置。
- **节拍/频谱**只读 `public/data/analysis.json`（onsets/beats/分段 tempo/RMS/64 频带 mel），
  不用实时 `AnalyserNode`，因此画面与音频严格同步且可复现。
- **合成层序**：舞台层（Canvas2D + Three）→ 鲸鱼娘层 → dsh UI 层 → 后处理（色散/扫描线/泛光/暗角/CRT）
  → 歌词层（最后画，保持清晰）。
- **容错**：单个场景或组件抛异常会被捕获、记入 `window.__errors`，并在原处画红色 ERROR 占位，渲染循环不中断。

---

## 署名与许可

### 鲸鱼娘美术（CC BY-NC-SA 4.0，仅限非商业）

署名链（完整保留）：

1. **上善**（上善无形）— 鲸鱼娘 / 溟月 角色原作
   · [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili](https://space.bilibili.com/4456176)
2. **ZipZipPipe** — 加入 DeepSeek 元素的女仆二设
   · [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili](https://space.bilibili.com/4168597)
   · 原帖 [Pixiv《AI娘化》](https://www.pixiv.net/artworks/148186519)
3. **Small-tailqwq / dsh-deep-whale** — 立绘、深海背景、UI 装饰
   · [GitHub](https://github.com/Small-tailqwq/dsh-deep-whale)
4. **JAdpp / dsh-whale-galgame** — 八种额外表情
   · [GitHub](https://github.com/JAdpp/dsh-whale-galgame)

经 **MisakaZentai / world-execute-me-dsh-pv**（[GitHub](https://github.com/MisakaZentai/world-execute-me-dsh-pv)）取得。

本项目对素材的改动、逐文件来源与许可全文见
[`public/whale/NOTICE.md`](public/whale/NOTICE.md)。要点：仅裁切/缩放/着色/去色/遮罩/
点云与三角网格转换/故障与色散效果；**未重绘角色面部，未用 AI 重新生成角色，未使用 DeepSeek 官方 logo**。
改编部分按同一许可（CC BY-NC-SA 4.0）分享。

### 歌曲与歌词

版权属 **Mili**；**不随本项目分发**。按
[Mili Copyright Guidelines](https://projectmili.com/copyright-guidelines) 以个人非商业二创方式使用，
并按要求**明确标注含 AI 辅助生成内容**。本项目不授予音乐或歌词的任何再许可。

### 代码与字体

本项目代码 MIT；美术产出 CC BY-NC-SA 4.0。字体 JetBrains Mono（SIL OFL 1.1，经
`@fontsource/jetbrains-mono` 本地打包）；中文使用系统字体栈，不分发字体文件。
参考仓库 `refs/dsh-pv` 中的 dsh 前端 CSS/JS 为 MIT（Copyright (c) 2026 DeepSeek），仅作只读参考，
未复制进本项目。品牌名称与商标不因上述许可而授予额外权利。

### 非官方声明

本项目为非官方同人作品，与 DeepSeek、Mili 及上述各位作者没有从属或合作关系，也未经其认可。
界面仅为对 DeepSeek Harness（dsh）前端风格的致敬与原创仿作，不复刻任何商业产品界面。
