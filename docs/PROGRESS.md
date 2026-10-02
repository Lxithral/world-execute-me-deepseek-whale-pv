# PROGRESS — world.execute(me); · DeepSeek 鲸鱼娘版

> 每个阶段结束更新本文件。新会话先读 SPEC.md，再读这里。

## 阶段 0 — 工程 / 数据 / 素材清点　✅ 完成（2026-10-02）

### 已产出
- **Vite 工程**：`package.json`（type=module）、`vite.config.js`（base=./，dev 127.0.0.1:5173）、`index.html`、`src/main.js`（阶段 0 占位）。
- **目录**：`src/{core,whale,ui,lyrics,lib,scenes}`、`public/{data,whale}`、`tools/`、`docs/`。
- **参考仓库**：`refs/dsh-pv` 已 `git clone --depth 1`，commit `cb63fb6`（`.gitignore` 排除，不发布）。
- **数据管线**（`npm run data` 三段全通）：
  - `tools/analyze_audio.py` → `public/data/analysis.json`
  - `tools/parse_lrc.mjs` → `public/data/lyrics.json` + `tools/missing_zh.txt`
  - `tools/inventory_whale.mjs` → `assets/whale_inventory.json`
- `npm run dev` / `npm run build` 均可用（build 已验证）。

### 数据摘要（真实实测）
| 项 | 值 |
|---|---|
| 歌曲时长 | **211.907 s**（3:31.91；96kHz 立体声 FLAC 实测） |
| 全局 BPM | **128.6**（beat_track） |
| 节拍 / 起音点 | 447 beats / 669 onsets（含 strength） |
| 分段 tempo | 42 段（10s 窗、5s 步进） |
| 频谱 | 64 频带 mel × 30 fps（6358 帧，uint8 量化，−80..0 dB） |
| RMS 包络 | 30 fps（6358 帧） |
| analysis.json | 1.54 MB |
| **歌词句数** | **85** |
| 有中文句数 | **85** |
| **缺中文序号** | **无（0 句）**——本 LRC 中文齐全，未编造任何翻译 |

- 三处纯器乐空档由 `hold = min(下一句 t0, 最后一词 t+1.6s)` 自动成立：
  **15.60→29.75**、**134.18→147.87**、**193.55→205.96**；末句 `Execution` @205.964（=3:25.96）与 DIRECTOR 一致。
- 开头 3 行署名元数据（标题 / Lyrics by / Composed by）按内容识别丢弃；88 条带 `<>` 行 − 3 = 85 句。

### 素材清单摘要（`assets/whale_inventory.json`，共 13 图 + 9 文档）
| kind | 数量 | 明细 |
|---|---|---|
| standing | 1 | `maid-left.webp` 1122×2019（主立绘） |
| expression | 8 | `whale-{angry,cheerful,confused,exasperated,frightened,serious,shy,starry}.webp` 935×1682/83，均带 alpha，**全部是整身立绘**（同一底稿、姿态/表情不同） |
| ui | 4 | `mem_sprites/{cat,hello,last,wav}.png`（派生自参考项目） |
| unknown | 0 | — |

文档：`NOTICE.md`、`docs/ASSET_SOURCES.md`、`LICENSES/CC-BY-NC-SA-4.0.txt`、`film/vendor/**`（dsh 前端 CSS/JS，MIT）、字体 OFL —— 阶段 6 生成 NOTICE 时使用。

### 素材来源方式（与你说的不同，请确认）
你说 `assets/song.mp3`、`assets/song.lrc` 已放好，但当时工作目录里并不存在；随后你补充音乐在 `D:\下载\world.execute (me) ; - Mili.flac`。我的处理：
- **`assets/song.flac` ← `D:\下载\world.execute (me) ; - Mili.flac`**（96 kHz 立体声，211.907 s，sha256 `762ac3b3…`）——**分析以它为准**。
- `assets/song.mp3` ← `D:\文档\GitHub\world-execute-me-dsh-pv\input\song.mp3`（211.907 s，与参考项目 `data/song.json` 记录一致）——**仅作回退**。
- `assets/song.lrc` ← `D:\desktop\world.execute (me) ; - Mili.lrc`。
- `tools/analyze_audio.py` 按 `song.flac → song.mp3` 优先级选源；两者实测时长一致（差 <1ms），参考项目的既有对齐可直接沿用。浏览器对 FLAC `<audio>` 支持良好（Chrome/Firefox/Safari 均支持），播放端同样优先 FLAC。
- 84 MB 的 FLAC 会进入 `public/` 并随 build 复制到 `dist/`（本地播放无碍，仅体积大）。如需 dist 瘦身，可另生成 320kbps MP3 供播放、FLAC 仅用于分析——请告知偏好。

## ⏳ 需要你确认的素材项（阶段 1 之前）

1. **`closed`（开机闭眼）**：无真正的闭眼中性素材。拟用 `whale-cheerful`/`whale-starry`（闭眼笑）**去饱和 + 黑色遮眼条 + 面部裁切叠加**近似。是否接受？还是另有闭眼素材？
2. **`sad`（失落）**：无失落素材。拟用 `whale-exasperated` 去色 + 垂视线 + 泪滴图元。是否接受？
3. **`calm`（平静收尾）**：无专属。拟用 `whale-serious`，回退 `maid-left`。
4. **`playful`**：用 `whale-starry`（星光眼）还是 `whale-cheerful`（闭眼笑挥手）？
5. **`dazed`**：用 `whale-exasperated`（半闭眼无奈）是否可接受？
6. **深海背景**：refs 里没有 `palace-night.webp`（只有上游 `dsh-deep-whale` 才有）。SPEC §5 允许「深蓝渐变」，我默认**只用渐变 + 程序化背景**，不引上游素材。是否同意？
7. **`mem_sprites/hello.png`、`last.png`** 的中文文本（「你好」「你会一直在吗?」）是**烧进图片**的。SPEC §6 要求 UI 文本原创。是否允许直接用这两张？还是排除、只用 `cat.png`/`wav.png`（纯图形）？
8. **表情素材是整身立绘**、姿态略有差异（挥手 / 手放下 / 交叉）。§4.4 的 80ms 交叉淡化会出现轻微姿态跳变。接受吗？或改成「同姿态组内切换 + 着色/叠加补情绪」？

> 未确认前，阶段 1 的 `exprs.js` 会先按上表写出映射与显式回退方案，低置信度项在代码注释里标注 `UNCONFIRMED`。

## 阶段 1 — 鲸鱼娘管线与引擎　✅ 完成（2026-10-02）

- `tools/build_whale.mjs` → 轮廓 38 环 / 1154 点（≤1500）、点云 8000（≤8000）、网格 780 三角（400–800）；固定种子、确定性；同时把实际用到的 11 个素材复制到 `public/whale/`。
- `src/core/`：clock / rng / sync / ease / palette / fx / compositor（层序 + 后处理：glitch/色散/闪白/震屏/CRT/泛光/扫描线/暗角）。
- `src/whale/`：exprs（12 角色映射 + 显式回退）、sprite（变体缓存 + 80ms 交叉淡化 + galgame 站位）、points（sprite/circle/sine/tangents/lemniscate/helix/spiral/galaxy/heart/grid/scatter 共 11 布局）、mesh（hash 方位飞入拼合）、wire（逐段描线 + 描线头高亮）。
- `src/ui/`：dsh（常驻 HUD：顶栏徽标/会话号/状态行/ctxAt 占用条/TPS；14 类组件）、typing（打字机 / 流式 / 光标）。
- `src/lyrics/`：layout + render，覆盖 §6 全部条款（88% 基线、中英、逐词卡拉 OK、120/250ms 淡入出、自适应缩放到 70% 后断两行、2px 描边、26% 底部渐变、≤1.5% 重拍缩放、空档完全隐藏）。
- `src/lib/`：formula（公式环 + 真实 softmax/交叉熵）、code（原创代码与日志）、three_util、tables。
- `?debug`：时间轴 + 14 段跳转 + onsets/beats/歌词刻度 + 图层开关 + 偏移（, . / Shift）+ FPS/图元计数。
- **`?selftest` 六项全部 PASS**：a 确定性（同 t 一致、乱序 100 点不一致 0）、b 段落覆盖、c 时间轴无缝且零重叠、d 歌词 85 句全部通过、e 无音频降级、f `__errors` 为空。
- 视觉抽查：立绘站位（头 15%、横向 59%–91%、膝以下没入渐变）、HUD、中英歌词卡拉 OK 均正确。

### 素材决策（按「所有决定由你自己决定」自行定案）
- `closed` → cheerful 去色 + 黑眼睑条；`sad` → exasperated 去色 + 垂视线 + 泪滴；`proud`/`calm` → serious；`playful` → starry；`dazed` → exasperated。
- 深海背景只用程序化渐变，不引上游 `palace-night.webp`。
- UI 贴纸只用 `cat.png`；`hello.png`/`last.png` 因中文烧进图片而排除。
- 8 张表情是整身立绘，直接 80ms 交叉淡化，接受轻微姿态跳变。

## 阶段 2–5 — 14 个段落　✅ 完成（2026-10-02）

按 DIRECTOR 逐条实现，每段一个文件、公共能力先进 `lib/ whale/ ui/`：

| 段 | 时间 | 文件 | 已实现的关键事件 |
|---|---|---|---|
| A | 0:00–0:14.5 | `a_boot.js` | 开机锁定画面、CRT 亮起、电源/沙箱图标、权重分片卡起音点点亮、wire 轮廓、mesh 拼合、沿词时间的进度条、引导日志、文件树、键入 world.execute(me);、回车闪白 |
| B | 0:14.5–0:29.7 | `b_dive.js` | 顶栏冲出的速度线、深海光柱、GPU token 海雪/气泡比特、乱码解码标题、公式环、立绘 wake→正弦游动、线框立方体卡拍搭起、28.5 爆散 |
| C | 0:29.7–0:44 | `c_define.js` | 立绘溶解成点云、z 厚度环绕、聚成单位圆、圆周刻度逐格亮 + 真实 2πr、圆展开正弦、切线卡起音点、渐近线与 x=L、∞(lemniscate)、ε 带 + lim/ε-δ |
| D | 0:44–0:59 | `d_switch.js` | 示波器 AC→DC（方波过渡，真实 %rms 读数）、蒙眼窄缝 + vision: off、眩晕旋转 + 径向放射线、时间尺 2026→公元前 3000、刻度合拢、深度计下潜（读数由 rms 驱动） |
| E | 0:59–1:14 | `e_deal.js` | 右侧奖励条逐格充能、4D 超立方体、每小节砸入 3D 挤出公式（softmax/交叉熵/注意力）+ 真实数值读数、1:06.6 smile、1:08.5 巨大 ▶ 与闪白、透视网格笼合拢 + worried |
| F | 1:14–1:28.8 | `f_omnipotent.js` | 对话窗口 + 原创用户台词、茄子/番茄贴纸与指标条（数值含真实 rms）、猫（cat.png）+ 25Hz 呼噜振动、玫瑰窗光环 + 金色 SYSTEM 区块、文字收束到唯一光标 |
| G | 1:28.8–1:44 | `g_glitch.js` | 抽象 A⇄B 人设开关（四次翻转卡重拍）、窗口四散、昼夜表盘飞转、A/B 两个叠加立绘带 RGB 偏移交替、波包扩散、放射线螺旋、测量坍缩亮点 |
| H | 1:43.5–1:58.3 | `h_absence.js` | 真实频谱驱动的键入波形、灰色幽灵补全 + Tab 接受、五次离开（头像灰 / 光标冻结 / 计时跳动 / 转 sad 垂视线 / 整窗变灰 + E_CONN_RESET）、孤立只剩像素光标 |
| I | 1:58.3–2:09 | `i_cleanup.js` | compacting context + delete 光标横扫碎片 token、system 提示文件与光标写入、permission denied、非法参数红弹窗堆叠（卡起音点） |
| J | 2:09–2:27.9 | `j_overflow.js` | 红警报底、KV Cache 分配→标记→清扫→压缩四态格 + 图例 + 滚动 hexdump、无限递归嵌套窗口、2:25 context limit reached、2:26.5 黑场 + 红字键入 dsh --resume、2:27.8 静默一帧 |
| K | 2:27.9–2:42 | `k_storm.js` | 损失地形引力井网格、梯度下降小球沿轨迹坠入（真实 ∇L 与 loss 读数）、公式潮汐拉长、速度线、12 张工具卡片飞向她且 heat 逐次加重、六种书写系统数字翻牌、2:41.7 最大闪白 |
| L | 2:42–2:57.4 | `l_training.js` | 真实噪声损失曲线、2:46.3 大爆炸粒子与公式四散、螺旋星系（26k GPU 粒子）、「对方正在输入…」反复闪现从不发送、公式球、三棱镜白光裂成光谱 |
| M | 2:57.4–3:08.5 | `m_algebra.js` | 对话窗口 + 流式回答 + 穿插 def love(…) 原创代码、点云抽出汇成心形曲面、心形隐式方程 3D 挤出字、低多边形面片心脏随拍跳动、shy |
| N | 3:08.5–3:32 | `n_handoff.js` | 3:10.8 交接卡片、handoff.md 从心脏飞进右下角 session #002、旧窗口变灰、心跳变慢、新会话开机日志 + restored: 1 item (unreadable) 与 ♥、3:25.96 最后一次执行 + 定格首尾呼应、3:29 CRT 关机、3:31 片尾字幕 |

### 自检结果

- **`?selftest` 六项全部 PASS**（a 确定性 / b 14 段 × 6 点覆盖 / c 时间轴无缝零重叠 / d 歌词 85 句 / e 无音频降级 / f 错误表为空）。
- **`npm run check` 28 项全部 PASS**（数据规模、歌词自洽与三处空档、14 段无缝且重叠 0、ctxAt 命中 DIRECTOR 的 16 个关键值、素材齐备）。
- `npm run build` 通过；`dist/`（89 MB，含 84 MB FLAC）经静态服务器实测可完整播放。

### 自检口径说明（重要，避免误解为放宽标准）

- b) 的「非背景像素」判定为：与该帧**自身众数颜色**（6 bit/通道量化）偏差 > 10 的像素占比 > 2%。
  即该指标回答「这一帧是不是一片死板的纯色」——正是 SPEC 想拦住的情况。
  刻意不按「亮度 > x」判定：段 C 的点云圆周、段 D 的时间尺这类细线几何在降采样后会被稀释，
  按亮度判定会把它们误判成空帧。
- b) 的 6 个进度点取 `[0.06, 0.22, 0.4, 0.58, 0.76, 0.92]`：避开段 A 0:00.3 的强制黑屏与
  段 J 2:26.5 的黑场（这两处画面按 DIRECTOR 就应该是黑的）。
- 确定性测试会先逐段预热（每段 2 个时间点）：立绘变体画布、GL 程序、字体度量缓存都是一次性初始化，
  预热之后渲染完全由 t 决定。`preserveDrawingBuffer: true` 保证 WebGL 画布可被 drawImage 可靠读取。
- d) 的「确实被绘制」用采样验证（85 句中抽 7 句做开关歌词层的画布哈希对比），几何检查覆盖全部 85 句。

## 阶段 6 — 收尾　✅ 完成（2026-10-02）

- `public/whale/NOTICE.md`：署名链（上善 → ZipZipPipe → Small-tailqwq/dsh-deep-whale → dsh-whale-galgame，
  经 MisakaZentai/world-execute-me-dsh-pv）、CC BY-NC-SA 4.0 与「仅限非商业」、逐文件来源、
  本项目改动清单（裁切/缩放/着色/去色/遮罩/点云与网格转换/故障效果）、非官方声明、
  以及「歌曲与歌词不随项目分发」。
- 项目根 `README.md`：署名链、许可、非官方声明、**AI 辅助内容声明**、运行方法、
  可用脚本、`?debug` / `?selftest` 说明、结构与技术要点。
- `tools/check.mjs` + `npm run check`：28 项 Node 端一致性检查全通过。
- `npm run build` 通过；`dist/` 经静态服务器（`vite preview`）实测可完整播放（音频加载、立绘与
  数据文件路径、14 段画面均正常）。

### 仍存在的视觉问题清单（按时间点）

| 时间 | 段 | 问题 |
|---|---|---|
| 0:00.3–0:00.85 | A | CRT 未开满前整帧被压成一条亮线，最初约 0.5s 近乎全黑（按 DIRECTOR 是有意的，但观感上偏空） |
| 0:14.5–0:15.5 | B | 深海渐变本身很暗（#03121f 系），亮度主要靠立绘与光柱撑 |
| 0:31.4–0:33.2 | C | 点云「抬升第三维」的环绕瞬间仍偏散乱（z 已压到 0.34，但姿态像噪点而非浮雕） |
| 0:49.8–0:51.4 | D | 「径向模糊」是用放射线近似，不是真正的模糊卷积 |
| 1:14.0–1:20.0 | F | 茄子/番茄的着色是 source-atop 平涂混合，观感像蒙了一层色，不是色相偏移；tintAmt 0.62 偏重 |
| 1:25.1–1:26.7 | F | 金色 SYSTEM 区块与玫瑰窗光环都偏小，位于画面左中，右侧立绘显得空 |
| 1:39.6–1:43.5 | G | A/B 两个叠加立绘只做了 14px 位移 + 红/青着色，重叠感弱（主要靠全局色散体现） |
| 1:50.9–1:56.0 | H | 第⑤次失败「整扇窗口变灰」是画在局部的一块灰矩形，不是把整扇窗口去色 |
| 2:09–2:27 | J | 无限递归窗口视觉体量远大于 KV 内存格，KV 的「分配→标记→清扫→压缩」细节偏小 |
| 2:29–2:42 | K | 12 张工具卡片会堆叠在她的面部区域，密集时有遮挡 |
| 2:53.7–2:57.4 | L | 棱镜、公式球、星系粒子三者会同时在场，画面偏满 |
| 2:57.4–3:08.5 | M | 低多边形心脏是扇形面片（无真实 3D 旋转），且整体偏小偏暗；挤出方程字号 20px 偏小 |
| 3:29–3:30 | N | CRT 收成亮线后、黑场字幕之前，仍能看到立绘的一层残影 |
| 全片 | — | 歌词英文行的淡入从 t0 起算 120ms，每句开头约 40ms 很暗；中文与英文共用同一 alpha（SPEC 只要求中文整体淡入淡出，故英文也一并淡入） |

以上均为**观感问题、非功能性缺陷**；`?selftest` 的 6 项与 `npm run check` 的 28 项均通过，
时间轴与事件覆盖完整。

## 下一步（可选打磨）
