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

> ⚠️ 上面这份清单已在 **F0** 中整体迁入 `docs/AUDIT.md`（并逐条补上原因分析）。后续以 AUDIT.md 为准。

---

## F0 — 考据与审计　✅ 完成（2026-10-02，未改任何功能代码）

FIX.md 成为最高优先级文档（FIX.md > DIRECTOR.md > SPEC.md）。

### 1) 官方界面考据

- `D:\` 已确认；`D:\文档\GitHub`（25 个兄弟仓库）为目标路径；官方仓库 `deepseek-ai/deepseek-harness`
  只读克隆到 `D:\文档\GitHub\deepseek-harness`（182 MB / 14104 文件，**未修改、未整包复制进本项目**，未执行 pnpm install/build）。
- 产出 **`docs/DSH_UI_NOTES.md`**（后续所有界面工作的唯一依据）：三列网格与全部列宽常量、
  亮/暗两套完整 token（静态色板 + 别名 + 圆角 + 阴影/高度 + 字体族 + 动效曲线）、
  10 类组件的真实解剖、logo 的确切位置与 SVG path、动效 keyframes 清单、
  「必须准确 / 可以夸张」两组清单、以及 MIT 借用登记表（空表待 F1 填写）。
- 关键发现：
  - **logo 不是独立 svg 文件**，而是组件内联 SVG：`packages/client/ui-primitives/src/FishLogo.tsx`
    （`viewBox 0 0 23.16 17.04`，单 path，`currentColor`）；组合字标在 `BrandWordmark.tsx`（`viewBox 0 0 182 24`）。
    logo **只出现两处**：侧栏（24px，折叠轨道与展开 logoRow）与空白会话 hero（34px）；Web favicon 在
    `apps/web/public/favicon{,-dark}.svg`（50×50）。
  - `BRAND_GUIDELINES.md:9` 明示「DeepSeek Harness」为注册商标；**仓库无任何条款说明 logo 是否被 MIT 覆盖** →
    按 FIX §1.7 处理：只在原位置使用、保留 `useOfficialLogo` 开关、保留非官方声明。
  - 品牌字是 **Montserrat**（OFL）；正文轴 `--dsh-content-font-size` 默认 **14px**；
    圆角 4/8/12/16/20/28；主曲线 `cubic-bezier(0.4,0,0.2,1)`；主要过渡 100/120/150/160/200ms。
  - 官方**没有 "handoff" 界面**，也**没有助手文本的闪烁光标**（只有终端有 1s step-end 闪烁）；
    流式平滑靠「跨三次 rAF 批量发布 + 增量 markdown 冻结 + TextShimmer」。

### 2) 代码审计

产出 **`docs/AUDIT.md`**，四条反馈全部定位到具体代码：

1. **0:12 两条黑线** = `closed` 角色的 `eyesClosed` 叠加层（`src/whale/sprite.js:120-131` 恰好两个 `fillRect`，
   `rgba(8,10,14,0.92)`）。1920×1080 实测：两条各 45.9×7.7px，位于 (1392.6, 332.8) 与 (1478.3, 332.8)，正好在她脸上；
   生效窗口 0:11.26–0:12.15；**段 N 3:12.4–3:13.4 会复现**。与任何歌词概念无关 → 应删。
2. **53 秒只有一小条** = 复合原因：蒙眼黑条 `blind` 在 48.6–54.4 全程满值 → `slit=0.18` → 可见带仅 **194.4px**；
   而「隧道」本身只是 `y=669.6` 的 2D 细尺（刻度 16px），**轴线已在可见带下沿 637.2 之外**，只有 54px 年号数字露进缝里；
   叠加眩晕把整体旋转 −7.7°、放大 1.06 再推低到约 677px。
3. **歌词**：词距 = 等宽字体 0.6em 空格（29.81px），FIX 要 0.28em（14.6px）→ **偏宽 2.05×**（308/403 个词条自带尾随空格）；
   「偏上」在几何上**不成立**——英文基线恒为 88.0%H（FIX 要 88.5%H，差 5.4px）、85 句全部 K=1 且 shift=0、
   无「比例当像素 / 基线当顶边」类 bug；真实偏差是**字号低于硬下限**（英文 49.68 vs ≥52、中文 27.32 vs ≥30）
   与**中文行偏高 14.6px**（+0.0485H vs +0.062H，代码里根本没有 `0.062` 常量）。
4. **钟表指针**：只有一根针；角度由淡入包络 `inOutCubic(a)*792°` 驱动（`t` 参数从未使用）→ 先正转 2.2 圈再**倒转** 2.2 圈；
   昼夜两半写死；无 T(分钟)、无分针/时针、无 7:00→19:00、无天空日月、无「12:1」不变量；
   且窗口 94.106–96.992 比 "From AM to PM"（94.09–95.786）**多活 1.21s**。

另：审计中记录了两个历史坑（透明区被 `saturation/color` 合成填色、WebGL 画布必须 `preserveDrawingBuffer`），
详见 AUDIT.md 末尾。

## 下一步

按 `FIX.md` §5（新增章节）与 §5.7 的 P0 清单继续。

---

## F1（P0）进行中

FIX.md §5.7 的 P0 六项：词锚点 cue、歌词层修复、text() 字号守卫、鲸鱼娘出场表与删伪造、
持久 3D 世界 + 相机轨道 + 冲击后处理、自检门槛（§5.4）。

### 已完成

| 项 | 产物 | 验证 |
|---|---|---|
| **姿态比对**（§5.1a） | `tools/pose_report.mjs` → **`docs/DSH_POSES.md`** | 9 张全部量测：冠部中心 x 总跨度仅 3.3%H（1080p≈36px）、头顶 y 总跨度 1.3%H；分 3 组（6+2+1），`whale-starry` 因双手举在头侧单独成组 |
| **删伪造**（§5.1） | `src/whale/exprs.js`、`src/whale/sprite.js` | 删除角色 `closed`/`sad`/`dazed`/`calm` 与**全部**伪造五官图元（黑眼睑条、垂视线、泪滴）；`drawOverlay()` 整体删除；角色集改为**9 角色 = 9 素材 1:1**（`base`/`angry`/`cheerful`/`confused`/`exasperated`/`frightened`/`serious`/`shy`/`starry`），不再有"用 X 冒充 Y"的映射；保留 `REMOVED_ROLES` 记录每条被删原因 |
| **硬切**（§5.1b） | `src/whale/exprs.js` | 删除 80ms 交叉淡化与 `XFADE`；新增 `roleAt/lastSwitch/justSwitched/canHardCut`（同组才可硬切） |
| **出场表**（§5.1） | **`src/whale/cast.js`** + `main.js` 的 `applyWhale()` | W1–W5 五窗共 **26.3s**（≤36s）、单次最长 **8.0s**（≤8s）；**表外立绘层 alpha 恒为 0**（main.js 只认表，场景请求在窗口外被忽略）；入场弹簧过冲（`outBack`）、退场收缩淡出 + 去色；`castRoleAt()` 会拒绝跨姿势组的硬切 |
| **段 A 删效果**（§3 段 A / §5.1） | `src/scenes/a_boot.js` | 删除该段的 wire 轮廓、mesh 三角拼立绘、closed 立绘 —— **用户反馈的「0:12 两条黑线」已消失**（浏览器实测 t=12 无立绘、无黑线） |
| **歌词层修复**（§2.5 / §5.5） | `src/lyrics/layout.js`、`render.js` | 改比例字体（Inter/系统 UI 栈，非等宽）、52/30px 硬下限、空格固定 0.28em、中文基线严格 +0.062H；英文 **t0−150ms 起淡入**（t0 时 alpha=1）、**中文单独算 alpha**；`CONFIG.lyricBaseline` 默认 0.885 + `?lyricY=` 可调。实测数据已写入 `docs/AUDIT.md` ⑥ |
| **text() 字号守卫**（§0.5） | **`src/ui/text.js`** | 统一入口 + 8 档下限（歌词 52/30、界面正文 34、装饰代码 26、代码墙 40、公式 80、标题 120、辅助标签 22）；默认记录+警告、`?strictText=1` 或 selftest 时抛错；`window.__app.textViolations` 可枚举 |

### P0 全部完成（含最后三项）

| 项 | 产物 | 验证 |
|---|---|---|
| **词锚点系统**（§2.2） | `src/core/cues.js` + `src/scenes/anchors.js`（**91 个锚点**，14 段全覆盖）；四类锚点 `word`/`line`/`beat`/`onset`/`fixed`；每个锚点带 `lead`（动作启动提前量 0.25–0.4s）；`?debug` 增加 cue 面板（列出「计划到位 / 词起唱 / 差值 / 是否已消费 / lead」）；selftest **g)** | **PASS**：91 个锚点全部对齐 ≤120ms，且 14 段每段都有被真正消费的锚点 |
| **持久 3D 世界 + 相机轨道 + 冲击后处理**（§2.1/§2.4） | `src/core/rig.js`（35 个关键帧 + Catmull-Rom + 阻尼漂移 + 抖动层；**硬切 3 处**：1:04 / 2:27.9 / 3:29，用「hold 键 + cut 键」实现真跳变）；`src/core/impact.js`（段落强度等级 L0–L5 + 由 onsets 生成 **95 条冲量**）；`src/core/post3d.js`（EffectComposer: RenderPass×2 → UnrealBloom → 自写 ShaderPass：色散/切片故障/**真径向模糊**/暗角/镜头畸变）；双相机（透视 layer1 舞台 + 正交 layer2 鲸鱼层） | 演示段 **`?demo=1`**（`src/scenes/z_demo3d.js`，不属于影片）实测：**34,858 三角形 / 32 draw call**，门环隧道 + 代码墙 + 蜂群 + 相机穿越 + 冲击联动均正常；`?fx3d=0` 可对拍关闭后处理 |
| **自检门槛收紧**（§5.4）+ **§5.2 音频分发** | 新增一次**全片扫描**（480×270）同时算出 b/m/n 三项指标；`o)` 出场预算与"表外立绘层为空"；`p)` 每句英文在 t0 的 alpha ≥0.9；`b2)` 段渲染不抛异常 | 见下表 |
| **§5.2 音频** | `analyze_audio.py` 改为 **mp3 优先**（实测 44100Hz / 211.907s），并把它复制到 `public/audio/song.mp3`（已 gitignore）；`main.js` 只加载 `./audio/song.mp3`，**删除了 `../assets/*.flac` 的 glob** | **dist = 8.8 MB < 15 MB**；`find dist -iname "*.flac"` 为空；`public/audio/song.mp3` 经 dev server 返回 200 |

### 自检实测结果（`?selftest`，步长 1.0s）

| 项 | 结果 |
|---|---|
| a 确定性 | **PASS**（同 t 两次一致；乱序 24 点不一致 0） |
| b 画面密度 | **FAIL（预期）** 98/213 帧不达标；其中「非众数 <8%」的硬失败 **0 帧** —— 卡住的是**边缘 ≥4%** 这条（例：0s 非众数 45% 但边缘 1.9%）。旧 2D 画面是"颜色变化够、锐利边缘不够"（大面积渐变 + 细描边在 480×270 降采样后被平滑） |
| b2 段落渲染 | **PASS**（14 段 × 3 点无异常） |
| m 运动能量 | **FAIL（预期）** 静止段 1 处：**136–138s**（段 J 的无限递归窗口是静态嵌套矩形） |
| n 3D 占比 | **FAIL（预期）** 0.0%（0/209）—— 影片里目前几乎没有三角面：点云是 Points、网格线是 LineSegments，段 A 的三角拼立绘已按 FIX 删除 |
| o 出场预算 | **PASS**（5 次共 26.3s ≤36s；单次最长 8.0s ≤8s；表外 24 个采样点立绘层为空） |
| p 歌词淡入 | **PASS**（85 句在 t0 的 alpha 均 ≥0.9） |
| c / d / e / f / g | **PASS** |
| `npm run check` | **28 项全部 PASS** |

> **b/m/n 的 FAIL 是预期且必修**：三者的共同根因是"影片画面仍是旧 2D 素材库"，而它们衡量的正是 3D 重写要交付的东西（锐利几何边缘、持续运动、真实三角面）。已按你的要求**不放宽门槛**；这三项要等 P1/P2 的逐段 3D 重做落地后才可能转绿。

### 仍未完成（属 P1/P2，不在 P0 范围）

- **selftest i) 仍是空转**：`text()` 守卫只被歌词与演示段调用，旧场景仍在用裸 `g.fillText`；逐段重做时把文字调用全迁到 `text()` 后 i) 才有效。
- 旧 a–n 场景的**画面**（3D/DOM 重做）、`?debug` 的 `?shot=` / `?contact`、蜂群、3D 物件库、代码墙、dsh 界面 DOM 化 → 按 §5.7 属 P1/P2。
- 段 J 的 136–138s 静止、b) 的边缘密度，都要在逐段重做里解决。

## 决策日志（FIX §5.8 要求）

| # | 决策 | 原因 | 回退方式 |
|---|---|---|---|
| D1 | 立绘角色集改为**9 角色 = 9 素材 1:1**（角色名即素材名），删除 `closed/sad/dazed/calm` 及全部伪造五官 | FIX §5.1 明令；且"用素材 X 冒充情绪 Y"必然导致伪造 | 恢复 `exprs.js` 的 ROLES 映射表即可（旧映射已记在 `REMOVED_ROLES`） |
| D2 | 出场表 W4 由 2:57.4–3:06（8.6s）**收敛到 8.0s**（177.4–185.4） | FIX §5.1 同时要求"每次 ≤8s"，但其表格自身给了 8.6s —— 取更严的硬约束 | 改 `cast.js` 的 APPEARANCES[3].t1 |
| D3 | 歌词英文基线取 **87.47%H** 而非 88.5%H | FIX §2.5 的「0.885H + 中文+0.062H + 底边距≥6%」三者互斥（详见 AUDIT.md ⑥）；把 6% 边距当硬规则 | 抬 `CONFIG.lyricBaseline`，或把 `marginFrac` 降到 0.05 |
| D4 | `text()` 守卫**默认记录而非抛错**，`?strictText=1` 与 selftest 才抛 | 直接抛错会让 F1 阶段旧画面整屏红框、无法播放；记录模式同样能枚举全部违规点 | `setTextStrict(true)` 改为默认 |
| D5 | 立绘出场由 `cast.js` **独占**，忽略场景里的 `ctx.whale.sprite` 请求 | 保证"表外 alpha=0"这条硬约束不被任何一段绕过 | 删掉 `applyWhale()` 里的 cast 分支，恢复读 `ctx.whale.sprite` |
| D6 | 旧场景的立绘/文字代码**保留但失效**，不在此阶段删除 | FIX §5.0 把 a–n 视为"素材库"，逐段重做在 P2；现在删会丢失已算好的真实数值（损失地形、KV 状态机、真实读数等） | P2 逐段重做时一并删除 |
| D7 | g) 除了 FIX 原文的「对齐 ≤120ms」，**额外**要求"每段至少有一个被真正消费的锚点" | 只有对齐要求的话，锚点表自证自洽（时间就是查出来的），会变成空转；消费要求能拦住"场景仍用硬编码秒数" | 删掉 `runSelftest` 里 g) 的 `segsWithoutUsed` 判定 |
| D8 | 锚点表把 DIRECTOR 的绝对秒数换成词时间，已知差异：A `power` 0.32→**1.214**（开场黑由 0.3s 变为约 0.45s，随后 CRT 亮线随 power 词到）、D `DC` 46.1→**47.283**、H `vibrations` 104.5→**106.256**、I `fragments` 119.2→**121.496** | FIX §2.2 明确"DIRECTOR 的绝对秒数只作粗略参考，冲突时以词时间为准" | 在 `anchors.js` 里把对应项改成 `{kind:'fixed', t:…}` |
| D9 | 扫描步长默认 **1.0s**（FIX 原文 0.5s）；`b2)` 每段进度点由 6 降到 3 | 本机 1080p 单帧 0.2–0.7s，0.5s 步长要跑 424 帧（约 5 分钟）。**门槛本身一字未改**；`?selftest&scan=0.5` 可切回原文口径 | 把 `parseFloat(params.get('scan') \|\| '1.0')` 改成 `'0.5'`，`b2` 点数改回 6 |
| D10 | b) 的 Sobel 阈值取 \|∇\| > 0.09（0–1 亮度） | FIX 只写"边缘像素(Sobel)占比 ≥4%"，未给阈值；0.09 约等于 23/255，属"明确可见的边缘" | 改 `scanFilm` 里的 `0.09` |
| D11 | 3D 画布用**加法**（`globalCompositeOperation='lighter'`）叠到 2D 舞台之上 | EffectComposer/UnrealBloom 不保证保留 alpha，用 source-over 会把 2D 舞台整片盖黑（实测 `comp.mean` 从 49 掉到 1.4）；加法下黑色不贡献，且符合"3D 是发光主体" | 改回 source-over 并让 `post3d` 的自写 pass 严格输出 alpha |
| D12 | 硬切用「**hold 键 + cut 键**」实现：cut 前 50ms 用一个 `hold:true` 的键冻结机位，cut 键给出全新机位 → 真跳变；共 3 处（1:04、2:27.9、3:29） | 单纯给关键帧打 `cut` 而让样条插值过去，只是"快速摇镜"不是硬切；而"切前静止"又不能超过 1s（§0.6） | 删 `rig.js` 的 `CUT_PAIRS` 与 `k1.hold` 分支 |
| D13 | FLAC **只作分析备份**，不复制进 `public/`、因此不进 `dist/`；播放只加载 `public/audio/song.mp3`（gitignore） | FIX §5.2 明确要求；且 84MB 的 FLAC 会让 dist 远超 15MB | 改回 `CANDIDATES` 顺序或恢复 `import.meta.glob('../assets/*.flac')` |
| D14 | b/m/n 三项在旧 2D 画面上 **FAIL 且不放宽**（你已确认） | 三者衡量的正是 3D 重做要交付的东西：锐利几何边缘、持续运动、真实三角面 | 无（整改在 P1/P2） |
| D15 | 演示段 `?demo=1` 不进影片、也不参与冲量归属 | FIX §5.7 要求"用演示段验证"，但它覆盖全片会污染段落归属（实测把所有冲量都吃给了 DEMO） | 从 `scenes/index.js` 的注册分支删除 |

F1 已获用户确认

---

## F2a — 合成层修正 + dsh 界面 DOM 化　✅ 完成（2026-10-02）

门禁：本阶段开始前已确认 `docs/PROGRESS.md` 存在用户手写行 **`F1 已获用户确认`**（§5.9）。

### 1) 合成层修正（3D 作为底层）

**问题**：3D 画布此前以「加法合成」叠在 2D 舞台之上 —— 加法只能变亮，比背景暗的 3D 物体
（深紫茄子、阴影、黑洞暗面）会被背景"加没"。

**改法**（三处一起才成立）：
1. `compositor.present()` 层序改为 **3D 底层 → 2D 舞台层 → DOM/鲸鱼/UI**，全部 `source-over`；
   新增 `P.three !== false` 的图层开关。
2. 3D 自己画不透明背景：`renderer.setClearColor(0x0b0d12, 1)`，`post3d` 的自写 pass 输出
   `alpha = 1.0`（底层必须不透明，否则下面的 DOM 会透出页面背景）。
3. **旧 2D 舞台让出背景**：新增 `comp.bgIs3d`（默认 true）→ `ctx.bgIs3d`；14 个旧场景的
   "整屏不透明底 + 竖条纹"全部包进 `if (!ctx.bgIs3d) { … }`（共 16 处），背景交给 3D。

**验收（`?demo=1`，§5.7 要求"用演示段验证"）**：演示段里放了一块**亮灰 3D 背景板**（`0xcfd6dd`，
z=-30）与一个**深紫 3D 车削物体**（`0x2a1040`，z=1.1）+ 一个中灰立方体（`0x6f7a86`）。
- 视觉：深紫物体在亮背景前是**实心暗色剪影**、边缘清晰（t=30/60 截图）；
- 数值：该点合成后 `alpha = 255`（不透明），且明度序 **暗(5.6) < 中灰(33) < 亮背景** 保持成立。

另加 `__app.setComposite3d('over'|'lighter')` 做 A/B。**诚实说明**：在新架构下两种模式**测值相同** ——
因为 3D 现在在最底层，下面没有东西可以"加"。旧 bug 的实质是"2D 不透明底在 3D 之下、3D 又用加法"，
所以修的是**层序 + 2D 让出背景**这两件事，而不是换一个 blend 模式。

### 2) dsh 界面 DOM 化（§2.3）

| 产物 | 说明 |
|---|---|
| `src/ui/dom.js` | 真实 HTML/CSS 的 dsh 界面层：`createDomUI()` / `render(t,ctx)` / `hash()` / `applyCamera()` / `setFx()` / `setTheme()` |
| `src/ui/dsh.css` | 亮/暗两套 token（逐值抄自官方 `ui-theme`，见 `docs/DSH_UI_NOTES.md` b 节）+ 组件样式 |
| `src/ui/logo.js` | 官方 `FishLogo` 真实 path（3448 字符）+ viewBox，供 DOM 内联（§5.10） |
| `public/dsh/logo-fish.svg` | 同上内容的可再分发副本 |
| `public/dsh/LICENSE-dsh.txt` | 官方 MIT 全文（Copyright (c) 2026 DeepSeek） |

**还原内容**：三栏 grid（侧栏 280 / 中栏 minmax(400,1fr) / 右栏 0）；侧栏含官方 logo + `DeepSeek`
+ `dsh` 徽标、New session（38px）、会话列表（#001/#002，激活态）；中栏会话头（标题 + 副行）、
用户气泡（右对齐、`--dsw-specific-bubble`、圆角 20px）、助手正文（左对齐无气泡）、
思考块（`DisclosureRow` 形态 + `TextShimmer` 的 `steps(48)` 扫光）、工具调用卡片（状态点 + 名称 +
args + 输出，`--dsw-alias-markdown-code-block` 底）、上下文占用指示（**官方 ContextMeter 的
14px 圆环 + 百分比**，`stroke-dasharray` + `rotate(-90 7 7)`）、composer（sticky 卡、
逐字键入 + 光标、权限/模型 chip、34px 圆形发送键）、以及重连 / 错误 / 交接三类提示条与权限弹窗。

**几条硬要求的落实**：
- **内容由 t 的纯函数驱动**：`dshScript(t)` 返回整份界面状态；`render()` 用序列化 key 比对，
  只在内容变化时写 DOM（键入进度单独只改一个文本节点，避免整帧重排）。
- **与 Three 相机联动**：`applyCamera()` 把 rig 的相机状态折算成 CSS3D 变换
  （`fit-to-viewport × 小视差` 的 translate/rotateY/rotateX/scale），等价于 CSS3DRenderer
  的效果而不必引入第二套渲染器；窗口位置另按 t 轻微漂移。
- **故障走 CSS 变量**：`--dsh-glitch / --dsh-disp / --dsh-shake / --dsh-alpha` 每帧由 `fx` 写入，
  CSS 用它们做 `clip-path` 切片与通道色散（切片只在 `data-glitch=1` 时生效，否则界面会被永久切开）。
- **selftest a) 对 DOM 层比对 innerHTML 哈希**：新增 `dshUI.hash()` 并在 a) 里比对
  「同 t 两次」与「乱序 12 点」→ **PASS**（同 t 一致；乱序 12 点差 0）。
- **§5.10 logo**：用官方真实 SVG，不做重画；`CONFIG.useOfficialLogo` 默认 **true** 且保留开关；
  只作为"dsh 界面的一部分"出现（侧栏/窗口内），不作为本片标题/片头/片尾标志。
- **§5.3 不常驻**：界面只在声明的时间窗内出现（F/G/H/I/M/N），`?dsh=1` 可强制常显用于验证；
  `?theme=light|dark` 切主题；`?debug` 增加「界面层(DOM)」开关。

### 3) 自检状态（`?selftest`，步长 1.0s）

| 项 | 结果 |
|---|---|
| a 确定性 | **FAIL**：画布乱序 24 点差 **1**（具体时间点已输出：**t=96.37**，段 G 表盘窗口内）；**DOM innerHTML 同 t 一致、乱序 12 点差 0** → DOM 部分达标 |
| b 画面密度 | **FAIL（预期）** 110/213 帧不达标，其中「非众数 <8%」的硬失败 **0 帧**；卡住的仍是**边缘 ≥4%** |
| b2 / c / d / e / f / g / o / p | **PASS** |
| m 运动能量 | **FAIL（预期）** 静止段 1 处：136–142s（段 J 递归窗口静态） |
| n 3D 占比 | **FAIL（预期）** 0/209（影片里仍几乎没有三角面） |
| `npm run check` | 28 项全 PASS |
| dist | **8.8 MB**（<15MB），无 FLAC |

> b 的门槛未动；变化的是**分母**：旧 2D 舞台不再铺不透明底之后，画面颜色方差下降（底色变成 3D 的清屏色），
> 所以不达标帧从 98 升到 110。边缘项依旧是"等 3D 重做"的那一项。

### 仍未完成（属 F2b / P2，按你的指示未开始）

- **a) 的 1/24 点不一致**：t=96.37（段 G，昼夜表盘窗口 94.1–97.0）在乱序序列里与顺序渲染不同，
  但**原地重复渲染是稳定的** → 属"被其它时间点改动的残留状态"。已把具体时间点打进 selftest 输出，
  留 F2b 继续追（见决策日志 D16）。**没有放宽断言**。
- 逐段 3D/DOM 重做、3D 物件库、代码墙、蜂群（P1/P2）；selftest i) 仍是空转（旧场景用裸 `fillText`）。

## F2a 修复轮 — 按用户 8 条反馈整改　✅ 完成（2026-10-02）

> 触发：F2a 演示效果有问题。以下 8 条全部落地，`?demo=1` 与 `?dshpreview` 均已实机验证。

### 1) 层序与安全区

- **歌词层永远最上层**：新增顶层画布 `<canvas id="lyrics">`（`index.html`，`z-index:30`）。
  `Compositor` 接收它，`present()` 末尾返回 `lyricsCtx()`；歌词因此**盖在所有层之上（含 DOM 界面层）**，
  且不参与后处理（§6）。`hashCanvas()` / 扫描也把歌词层算进去。
- DOM 界面层 `#dsh-layer` 固定 `z-index:5`（注释写明低于 30）。
- 安全区：`SAFE = { bottomFrac: 0.84, maxHeightFrac: 0.76 }`；`defaultGeometry()` 按它算窗口，
  再由 `clampToSafe()` 兜底 —— 任何调用方都写不出进入底部 16% 歌词区的窗口。
- **投影修正（重要）**：面板带 CSS3D 透视（`perspective:1600px` + `rotateY ±14°`），近端会被放大。
  只按"布局盒子"卡 76% / 84% 是不够的 —— 实测 t=95 布局 72% 高，
  **投影后量到 81.4% 高、底边 84.3%**，已经压进歌词区。
  现在 `clampToSafe()` 按最坏投影倍率 `PROJ = 1.03/(1-((W/2)sin14°+(H·0.76/2)sin6°)/1600) ≈ 1.13`
  反推**布局**预算，保证**投影后**仍在两条线内；`WINDOW_GEOM` 的宽度也按同样思路留了余量。
- 实机实测（六个界面窗口，投影后的 `getBoundingClientRect`）：

  | 段 | 宽 | 高 | 底边 |
  |---|---|---|---|
  | F | 50.1% | 56.4% | 72.1% |
  | G | 59.2% | 69.0% | 71.9% |
  | H | 51.9% | 58.3% | 70.8% |
  | I | 58.5% | 67.0% | 72.3% |
  | M | 49.3% | 56.6% | 72.4% |
  | N | 50.4% | 56.7% | 68.5% |

  宽 49.3–59.2%（要求 45–60%）、高 ≤69.0%（要求 ≤76%）、底边 ≤72.4%（要求 ≤84%）✅
- 层序实测：`#lyrics` 的 `z-index` 30 > `#dsh-layer` 的 5。

### 2) 3D 悬浮：面板与相机联动 + 玻璃质感

- `applyCamera()` 把相机偏移折成 CSS3D 变换：`rotateY` 幅值**恒定落在 8–14°**（正对时 8°，
  偏得越多越接近 14°），方向跟随相机；另有 `rotateX ±6°` 与轻微漂浮（amp 7px）。
  实测 t=80 得 `rotateY(9.87deg) rotateX(-0.64deg)`。
- 玻璃质感：`color-mix(in srgb, var(--dsw-alias-bg-base) var(--dsh-glass), transparent)` +
  `backdrop-filter: blur(20px) saturate(1.25)` + `0.5px` 描边（亮 72% / 暗 74%），**不是实心矩形**。
- 窗口尺寸由调用方给：`WINDOW_GEOM`（聊天窗 48–58% 宽、≤76% 高；弹窗 30%），
  经 `setGeometry()` 写入并 clamp；`?dshpreview` 用 `chat-G` 的几何。

### 3) 面板动画库（进度驱动，非 CSS keyframes）

`src/ui/panels.js`：`enter`（弹性过冲，`outBack`）、`exit`（溶解）、`shake`、`glitch`、
`grayscale`（整窗去色）、`smash`（弹窗朝相机砸来）、`tunnel`（沿 z 轴嵌套冲来）、`collapse`（收缩成一点），
外加 `compose(list)` / `windowFx(t, w)` / `float(t)`。

### 4) 上下文占用只有一个来源

- 所有读数都取 `ctxAt(t)`：DOM 的 header 与 dock、段 A 的小字、段 J 的中央巨字、交接提示。
- 实测修掉一处真 bug：dock 里写的是 `Math.round(clamp(pct))`，而 `clamp(v,a=0,b=1)` 会把 34 钳成 1
  → 同屏出现 "context 34%" 与 "context 1%" 两个数。改 `clamp(pct, 0, 100)`，现已一致。

### 5) 清理开发字符串 + 唯一内容表

- 内容全部集中到 `src/ui/content.js`（原创英文短句，短而完整、不截断）。
- 只允许在 `?debug` 出现、已收进 `if (ctx.debug)` 的：演示段的 `impact/shockwaves/post3d`、
  段 C 的形态标签、段 A 的遥测 chips 与 `· web` / `runtime … session #001` 行、
  段 I 的 `ctx % / tokens` 读数、段 K 的 `execution k/12 heat`。
- **删掉两处重复的 Canvas2D 对话窗口**（`f_omnipotent.drawChat`、`m_algebra.drawQandA`）：
  它们与 DOM 层 chat-F / chat-M 完全同期，属重复界面；`m_algebra` 保留 `~/world/love.py` 的原创代码块。
- 新增 `tools/lyric_leak_check.mjs`（歌词 3-gram / 中文 4-gram 比对）并接入 `npm run check`：
  实测抓出 `f_omnipotent` 的 `role: the only god` 影射歌词，已改写为 `role: sole authority`。
  另把 `content.js` 的 USER 三条与 `lib/code.js` 原 `USER_LINES`（逐句影射茄子/番茄/猫/神）一并改写/删除。

### 6) 删除常驻顶栏（§5.3）

`drawTopBar()` 从 `src/ui/dsh.js` 删除（Canvas2D 的 dsh 界面按 §2.3 废弃）。
`drawHud()` 只在 §5.3 列出的时刻画：段 A 开场一次、段 J 中央巨字；段 I / 段 N 交给 DOM 窗口。
**顺带修掉一个真 bug**：段 J 的中央巨字调用 `clamp(...)` / `hash01(...)`，
但 main.js 里 ease / rng 是命名空间导入，直接写裸名会抛 `ReferenceError` 并被 try/catch 吞掉
—— 整段巨字从未画出来。改用 `ease.clamp` / `rng.hash01` 后实测有 42,479 个像素 ✅

### 7) `?dshpreview` + 官方实机对照

- 重写 `buildDshPreview()`：并排两块 1920×1080 舞台（左亮右暗），各自挂一棵完整的 `.dsh-root`，
  缩放 0.5 铺满对照页；`?dshpreview` 不启动音频、不跑场景循环。
- 本次把官方仓库**真的跑起来**对照（`pnpm install` → `pnpm build` → `pnpm dsh web`，
  http://127.0.0.1:3080），拿到官方 DOM 快照与截图，逐项差异与修正写入
  `docs/DSH_UI_NOTES.md` 的 **g 节**。据此修正了 10 处（侧栏主导航 / 版本行 / 工作区树 /
  底部入口 / composer 底行顺序 / 右栏开关 / 三列网格行高 / 弹窗归属 / ctx 读数 / 右栏可折叠）。
- 三列布局实测 `grid-template-columns: 280px 534px 300px`（官方 RIGHTBAR_MIN = 300px）。

### 8) 字体

- 真问题：`src/ui/text.js` 的 sans 栈写的是 `"Inter", -apple-system, …`，但 **Inter 从未被加载**
  （无 @font-face、无 @fontsource 依赖）—— 是幻觉声明，实际总掉到系统无衬线，且与官方栈不一致。
- 现在三支栈全部取自官方 ui-theme：`FONT.sans`（= `--dsw-font-family`）、
  `FONT.brand`（`"Montserrat", sans`，woff2 已在 `public/dsh/fonts/`）、`FONT.code`（JetBrains Mono）。
- 开机画面的标志改为**官方 FishLogo 的真实 path**（`drawFishLogo()` 走 Path2D），
  并把自绘的 `whaleMark()` 剪影整个删除（§5.10：不得自己重画、不得当本片自己的片头标志）。
- 上下文读数（段 A 小字、段 J 巨字）改用 `FONT.sans`，不再用终端等宽字。

### 自检实测（`?selftest`，步长 1.0s）

```
PASS  b2 / m / o / p / c / d / e / g / f
FAIL  a 确定性   画布 同 t:一致／乱序 24 点差 1（t=96.37）；DOM innerHTML 同 t:一致／乱序 12 点差 0
FAIL  b 画面密度  112/213 帧不达标（其中 <8% 的硬失败 0 帧）：0s(A) 34%/2.0% 1s(A) 54%/2.2% …
FAIL  n 3D 占比   0.0% 的采样 ≥2000 三角形（0/209）
```

- **a) 的 DOM 部分本轮由 FAIL 转 PASS**（12 点差 0）。原来差 5 点的两个真原因：
  1. `paint()` 的重绘判据（key）漏了 `composer.caret` / `right.files` → 同一 t 的 innerHTML 依赖渲染历史；
  2. 不在任何界面窗口内时不给几何，面板**保留上一个窗口的尺寸** → 同样使哈希依赖历史。
     两处都改成"纯函数化"（整份状态序列化 + `WINDOW_GEOM.default`）。
- **a) 的画布部分仍是 1/24 点**（t=96.37）。本轮把它查清到：这是**段 G 头两次渲染的"读回预热"**，
  从第 3 次起稳定（`three/front/whale/ui` 四层恒定，只有 stage 与歌词层差 188 个**稀疏抗锯齿像素**，
  且与"前一次渲染的是什么"无关）。属浏览器读回层面而非影片状态，**门槛一字未改**，如实记录。
- **b) / n) 保持 FAIL 且不放宽**（决策 D14：这两项衡量的正是 P2 要交付的 3D 重做内容）。
- 另做了一次**全片异常扫描**（0→211.5s，步长 1.0s，共 212 帧）：`window.__errors` 为空。

### 仍未完成（属 F2b / P2，按指示未开始）

- 段内 3D 重做（道具库、钟表、时间隧道）、歌词排版按 FIX §2.5 收口、b/n 两项达标。

## 决策日志追加（F2a）

| # | 决策 | 原因 | 回退方式 |
|---|---|---|---|
| D16 | a) 的 1/24 点不一致**如实报出时间点**（t=96.37）而不是放宽 | §5.9/§5.8：不得放宽 5.4 门槛；且原地重复稳定，说明是顺序相关残留，值得继续追 | 无需回退；F2b 定位到根因后修掉 |
| D17 | 合成层序改为「3D 底层（自带不透明背景）+ 其余 source-over」，旧 2D 场景经 `ctx.bgIs3d` 让出背景 | 加法下暗色 3D 物体必然消失；且 2D 不透明底压在 3D 之下时任何 blend 都救不回来 | 把 `comp.bgIs3d` 设 false 并恢复 `composite3d='lighter'` |
| D18 | 保留 `setComposite3d('over'\|'lighter')` 仅作 A/B，并在报告里说明新架构下两者测值相同 | 避免把"换了 blend 模式"当成修复实质；真正的修复是层序 + 让出背景 | 删掉该方法 |
| D19 | dsh 界面做成**悬浮窗口**（1480×860，占画面 77%）而非整页 | 官方 Web 端是整页；本片里界面必须"悬浮在 3D 空间"（§2.3），整页会完全遮住影片 | 把 `.dsh-frame` 改回 `inset: 0` |
| D20 | 相机联动用「fit-to-viewport × 小视差」的 CSS3D 变换，不引入 CSS3DRenderer | §2.3 允许"或等价"；第二套渲染器会带来相机/尺寸同步的额外风险，而界面始终要可读 | 换成 `three/examples/jsm/renderers/CSS3DRenderer` |
| D21 | DOM 面板文字按 1920 逻辑坐标给（正文 34px、装饰 26px、面板标题 44px） | §0.5 的「标题 ≥120px」针对片内大标题（画布侧）；面板标题属"界面正文"档。已在 DSH_UI_NOTES 的 f 节区分 | 调 `dsh.css` 里的字号 |
| D22 | logo 逐字复制官方 path：`src/ui/logo.js`（内联）+ `public/dsh/logo-fish.svg`（可分发）+ `LICENSE-dsh.txt` | §5.10 要求用真实 SVG、不得重画，并把 SVG 内容复制进 `public/dsh/` 且保留 MIT 声明 | 把 `CONFIG.useOfficialLogo` 设 false |
| D23 | 立绘变体在启动时按出场表全部预热（`prewarmRole`） | 变体是一次性画布缓存；留到某段首次播放才建会让"乱序 vs 顺序"不一致 | 删掉预热循环 |
| D24 | 歌词放在**新增的顶层画布** `#lyrics`，而不是 2D 舞台的某一层 | 只有独立顶层画布才能保证"永远最上层、且盖住 DOM 界面层"，同时不参与后处理（§6 要求歌词不色散） | 把歌词画回 `layers.ui` |
| D25 | DOM 面板的 `rotateY` 幅值**恒定锁在 8–14°**（正对时也给 8°） | 实测相机在段 G 的正对取景只产生 1.9° 倾斜，肉眼等于没有 3D 悬浮感；把幅值映射到要求区间，方向仍跟相机 | 改回"幅值随偏移线性增长" |
| D26 | DOM 面板默认**收起右栏**（`rightPx:0`），段 G / I / N 展开 300px | 官方右栏是**可折叠**第三列、默认收起、开关在顶部 banner（实机对照确认） | 固定展开 300px |
| D27 | 右侧栏内容只放"改动 / 文件"两个真实区块，**不再放第二个 ctx 读数** | 用户第 4 条要求同一画面只能有一个上下文数字；官方右栏本来也不是放占用率的地方 | 在右栏加占用率 |
| D28 | 删除 Canvas2D 的重复对话窗口（`f_omnipotent.drawChat`、`m_algebra.drawQandA`） | 与 DOM 层同期同内容 = 同屏两个 dsh 界面；且其台词逐句影射歌词（违反 §6 与"唯一内容表"） | 保留两个窗口 |
| D29 | 段 J 中央巨字改用 `FONT.sans`；`clamp/hash01` 改命名空间调用 | 前者是与官方字栈一致（第 8 条）；后者是修一个被 try/catch 吞掉的 `ReferenceError`（巨字整段没画出来） | — |
| D30 | 新增 `tools/lyric_leak_check.mjs` 并接入 `npm run check`（歌词 3-gram / 中文 4-gram） | §6 是硬约束，"靠人读一遍"不可持续；实测立刻抓出一处影射 | 去掉这一步 |
| D31 | `src/ui/text.js` 的 sans 栈删掉未加载的 `Inter`，改用官方 `--dsw-font-family` | 未加载的字体名是幻觉声明，且与官方栈不一致（用户第 8 条） | 安装 @fontsource/inter |
| D32 | 品牌区名字用 `FONT.brand`（Montserrat），但**界面正文不用** | 官方实机确认：聊天界面里一处 Montserrat 都没用，它只出现在 DesktopOnboarding；PV 里给"品牌字样"用属官方 token 的本意，记为有意差异 | 全部改成系统栈 |
| D33 | 段 A 开机画面的标志改用官方 `FISH_LOGO_PATH`（Path2D 绘制），删除自绘 `whaleMark` | §5.10 明令不得自己重画，且"不能作为本片自己的片头标志"——这一屏按官方口径算"dsh 客户端的开机画面"，允许出现 logo | 保留自绘剪影 |
| D34 | `clampToSafe()` 按**透视投影后**的尺寸反推布局预算（`PROJ ≈ 1.13`），并据此收紧 `WINDOW_GEOM` 宽度 | 第 1 条要求的 76% / 84% 指的是观众**看到**的窗口；只卡布局盒子时实测投影后 81.4% 高、84.3% 底边，确实压进了歌词区 | 直接按布局尺寸 clamp |
| D35 | `?dshpreview` 用 `chat-G` 的几何（含 300px 右栏），且显式把 `#dsh-stage` 的 transform 置 `none` | 对照页要的是**平铺**的界面，不能带相机透视；同时要能看到官方那套三列布局 | 用默认几何、保留透视 |

F2a 已获用户确认

---

## F2b — 3D 物件库 / 代码墙 / 蜂群与桥接表　✅ 完成（2026-10-02）

门禁：本阶段开始前已确认 `docs/PROGRESS.md` 存在用户手写行 **`F2a 已获用户确认`**（§5.9）。
范围 = FIX §2.7（3D 物件库）、§2.8（代码墙）、§2.1 的蜂群与桥接表实现（§5.7 的 P1）。

### 0) 新增的验证基础设施（本轮最重要的副产物）

| 工具 | 做什么 | 为什么必须有 |
|---|---|---|
| **`tools/shoot.mjs`** | 用 CDP（Chrome DevTools Protocol）驱起无头 Chrome：求值 `window.__probeFrame(t)` 取机器可读状态、并把 `canvas.toDataURL()` 存成 PNG | 无头 Chrome 的 `--screenshot` **抓不到 WebGL 后备缓冲**（实测存下来是全黑），`--dump-dom` 在虚拟时间下又时好时坏（同一命令时而输出时而空）。走 CDP 两条问题一起消失 |
| **`tools/selftest.mjs`** | 驱起 `?selftest` 并把 `__selftestState.lines` 逐行打回终端 | 自检结果原先只能人肉在页面上读；接进命令行才能进 `npm run` 流程。**不改任何门槛**，只是搬运 |
| **`tools/canvas_probe.mjs`** | 把页面上任意 canvas 导出成 PNG（例如某块代码墙的贴图） | 定位"贴图本身是不是就有重影"这类只能看图判断的问题 |
| **`?shot=分:秒`**（FIX §4 要求） | 不启动音频与 rAF，只渲染这一帧 → 截图永远确定 | "用演示段逐项验证 + 截图反馈"的基础设施 |
| **`?contact`**（FIX §4 要求） | 每 5 秒一格，把全片铺成缩略图网格 | 同上 |
| **`?probe=1 / ?probe=objs`** | 把这一帧的图层、三角形数、像素统计、**每个可见网格的世界坐标/透明度/renderOrder** 写进 DOM | 这轮几乎所有 bug 都是靠"把物体坐标打出来"定位的，不是靠猜 |

### 1) 3D 物件库（§2.7）—— `src/lib/props/*`

| 物件 | 实现 | 关键点 |
|---|---|---|
| 茄子 / 番茄 | `THREE.LatheGeometry` 车削（轮廓是**控制点点列**经 Catmull-Rom 采样）+ `MeshPhysicalMaterial`（clearcoat 清漆 + sheen）+ 环境贴图 + 背面放大壳做的**轮廓光**；5 枚锥体拼成绿色萼片 + 果柄；角度由 t 推出缓慢自转 | 两端半径收成 0 以保证车削体闭合；茄子额外做了一次"略弯"的顶点位移 |
| 猫 | 低多边形球（10×7 段）+ flatShading、两个 4 段圆锥耳、**真实线段**胡须、程序生成的虎斑条纹贴图、几何体眼睛/鼻/口鼻 | 全程序生成，无外部素材 |
| 钟表 | 圆柱表盘 + 12 个数字 + 60 格刻度 + 时针/分针 | **所有指针角度由同一个 T（分钟）推导**：分针 `T/60×360°`、时针 `T/720×360°`；AM→PM 即 T 420→1140；天空渐变与日月沿同一段弧交替 |
| 开关 | 胶囊轨道 + 圆形滑块 + 发光内芯 + 光晕，翻转用 `outElastic` 过冲 | 滑块做成 0.82×轨道半径、骑在轨道外侧；`knobOut` 导出"滑块确实凸出于轨道"供自检 |
| 时间隧道 | 实心内壁（开口圆柱 BackSide）+ 一串沿 z 流动的环（实例化）+ **220px** 年份巨字 billboard | 内壁是"占满整屏"的结构性保证，不靠环本身；`coversFrame(camera)` 用**射线打画面四角**做几何判据 |
| KV Cache | 16×16×16 = 4096 个 `InstancedMesh` 立方体（49152 三角形），固定哈希分配顺序，蓝→橙→红，回收时被压扁扫走 | 这是自检 n) 三角形数最稳的一块来源 |
| 低多边形心脏 | `ExtrudeGeometry`（心形贝塞尔轮廓 + bevel，curveSegments=5、bevelSegments=1）+ flatShading；真实自转 | 底稿绕 z 转 180° 让凹口朝上；背面一枚 `<心形` 的背光圆片（不是罩住它的球） |

统一入口 `createProp(kind, opts)`，`PROP_KINDS` 列出全部 8 种；`selfCheck()` 把 §2.7 里**可机器验证**的部分写成断言。
FIX 明写的「**必须自检：分针转 12 圈时针转 1 圈**」由 `assertClockRatio()` 做**四条交叉验证**：
解析式（ΔT=720 分钟）、角速度比、**网格实测**（直接读 `minuteHand.rotation.z` 的增量）、单调性（T 增 → 指针单调正转，专治旧实现"转过去又倒回来"）。

### 2) 代码墙（§2.8）—— `src/lib/codewall.js` + `src/lib/snippets.js`

- `codeWall({lang, fontPx, layers, speed, layout})` 签名照写；`fontPx < 40` **直接抛错**。
- 语法高亮走自写分词器（关键字/字符串/注释/数字/函数名/标点），全部经 `text()` 的 `codeWall` 档（下限 40）绘制。
- 三种布局 `wall / corridor / dome`；canvas 宽高比**严格等于**平面宽高比（`PX_PER_UNIT = 480`），否则字体会被拉伸、字号约定失去意义。
- **七种语言**（python / javascript / rust / go / c / sql / haskell）各 2 段原创代码；`SNIPPET_FILES` 让多层代码墙**每层内容不同**。
- 不画提示符、不画日志滚屏（`report().hasPromptChars === false`）。
- `tools/lyric_leak_check.mjs` 已接进 `npm run check`，新代码同样受"不得与歌词同词"约束。

### 3) 蜂群与桥接表（§2.1）—— `src/lib/swarm.js` + `src/lib/swarm2d.js`

- 一个**全片持久**的实例化粒子系统，粒子身份（`aRand` 抖动相位、`aStagger` 错峰、`aGlyph` 字形格）在构造时定死，之后任何形变都不改。
- 字形图集含**点、代码 token、数字、数学符号**四类（`report().forms`）。
- 13 种布局（cloud/cube/ring/circle/sine/infty/grid/galaxy/heart/tunnel/vortex/scatter/text）；**每种布局都做了尺寸归一化**（量出中位半径并统一到 1.15）——没归一化时环形会顶出画面、点云会糊成一团亮斑。
- 形变带**逐粒子错峰**（顶点着色器里 `w = (uMix - aStagger·s)/(1-s)` + smoothstep），途中向外鼓一点，避免走直线。
- **桥接表 13 条**照 FIX 原表实现（`BRIDGES`），段内形变窗由 `SEGMENT_SWARM` 给出 → 全片 14 段每段都有"目标布局"，段与段之间永远有一次缓动形变，没有"整屏瞬间换场"。
- **在场性**：`main.js` 里 `applySwarm(t)` 每帧驱动，**并且同时画 3D 层与 2D 投影层**（同一份 `layoutOf(from/to)` 数组）。3D 相机在 14 段里从贴近到拉远来回跑，单靠 3D 层会有取景把它推出画面；两层叠加保证"连续主角"不落空，2D 层还提供比点精灵更细的字符字形。
- 段 N 的 CRT 关机那一帧起蜂群清空（§5.6）。

### 4) `?demo=` 演示段（§5.7 要求"每完成一项先用演示段验证"）

`?demo=props | clock | tunnel | kv | heart | wall | swarm | bridges` —— 8 个模式，各自有**自己的机位**（`DEMO_CAM`）。
演示段与影片段落**互斥**（不会两段叠在一起），影片蜂群在演示会话里也退场。

### 5) 自检：新增 q)（并**没有**放宽任何旧门槛）

`q F2b 交付物` = 物件库 `selfCheck()` 全绿 + `createProp` 能建出全部 8 种 + 代码墙字号/层数/语言数/每层内容不同/**每行屏幕高度 ≥40px** + 蜂群身份哈希在 10 个时刻恒为 1 + 布局归一化跨度 <1e-3 + 14 段每段都有合法目标布局 + **每段中点蜂群的屏幕覆盖面积 ≥5%**。

### 5b) 自检实测（`?selftest`，步长 1.0s，`tools/selftest.mjs` 驱起）

```
PASS  a 确定性      画布 同 t:一致／乱序 24 点差 0；DOM innerHTML 同 t:一致／乱序 12 点差 0
FAIL  b 画面密度    52/213 帧不达标（其中 <8% 的硬失败 0 帧）
PASS  b2 段落渲染   14 段 × 3 点无异常
PASS  m 运动能量    213 帧无 ≥1s 静止段
PASS  n 3D 占比     99.5% 的采样 ≥2000 三角形（208/209）
PASS  o 出场预算    共 5 次 26.3s（≤36s）、单次最长 8.0s（≤8s）；表外 24 个采样点立绘层为空
PASS  p 歌词淡入    85 句在 t0 的 alpha 均 ≥0.9
PASS  c 时间轴覆盖  空隙=无；最大重叠=0.00s
PASS  d 歌词层      85 句几何通过，抽样 7 句像素验证
PASS  e 无音频降级  hasAudio=false t=1.00 渲染无异常=true
PASS  g 词锚点      锚点 91 个，全部对齐 ≤120ms，14 段每段都有被消费的锚点
PASS  f 错误表      空
PASS  q F2b 交付物  代码墙 7 层/7 语言/每行 72px；蜂群 3600 粒 / 13 布局 / 13 桥接 /
                    身份 2971311649 / 各段屏幕覆盖 ≥12.4%
```

**n) 由 0.0% → 99.5%**（208/209 帧 ≥2000 三角形）：这正是"3D 占比应开始上升"的预期 ——
蜂群单次绘制就是 7200 个三角形，加上 KV 体素（49152）、车削物件（每个 12462）等。
**门槛一字未改**，是画面真的变成 3D 了。

**m) 由 FAIL → PASS**：136–142s 的静止段消失了（蜂群全程在动，段 J 的递归窗口不再独占画面）。

**a) 由"乱序差 13" → "乱序差 0"**：根因是蜂群布局数组的一次性构建时机（见下表 bug 9），
预热里补上"所有桥接时刻 + 段落中点"后转绿。**没有放宽断言**。
另外把此前挂在鲸鱼层的 **2D 兜底蜂群层默认关闭** ——
它在本机（headless + SwiftShader 软件光栅化）会破坏"同一 t 两次渲染一致"，
自检 a) 因此 FAIL（已排除 uniform/布局数组/点大小/depthTest 四种原因，详见 D39 与 `lib/swarm2d.js` 顶部说明）。
"蜂群全片在场"改由**实测 3D 蜂群的屏幕覆盖面积**保证（各段 ≥12.4%，见 q 的最后一项）。

**b) 仍 FAIL 且不放宽**（决策 D14）：52/213 帧卡在**边缘像素 ≥4%** 这一条，
集中在段 B（0:15–0:20，实测 71–82% 非众数 / 3.4–3.8% 边缘）。
这与 F1/F2a 时的口径完全一致 —— 它衡量的是"锐利几何边缘"，而段 B 的 2D 素材（深海渐变 + 立绘 + 光柱）
本来就是大面积柔和渐变；逐段 3D 重做（F3）才会把它抬起来。
注意"非众数 <8%"的**硬失败仍是 0 帧**，说明没有空画面。

`npm run check`：**29 项全部 PASS**（含 `tools/lyric_leak_check.mjs` 的歌词 3-gram/4-gram 比对）。

### 6) 本轮定位并修掉的真 bug（都写了原因，避免复发）

| # | 现象 | 真因 |
|---|---|---|
| 1 | 演示物件在 1920×1080 上只有十几个像素 | 影片相机 t=0–14.5s 在 z≈2.6–3.6（fov 34–40°），原点处只有 ±1.57×±0.88 世界单位；第一版按"世界单位 1 = 1"摆物件 |
| 2 | 开关的滑块陷进轨道里 | `CapsuleGeometry` 的轴是 +y，只把轨道自己 `rotation.z = π/2`，滑块仍留在世界轴上 → 改成"轨道+内芯放进一个横躺的 Group" |
| 3 | 心脏只是一块圆角砖 / 又一转就只剩一条边 | 心形凹口被 0.22rad 的初始转角转走了；且自转 0.5rad/s 在演示里大半时间都在侧视 → 底稿正面朝观众 |
| 4 | 心脏外面罩着一团暗红雾 | 光晕球半径 0.62，而心形本体只有 0.86 高 → 改成比本体小的背光圆片 |
| 5 | 代码墙的字读不出来（两组代码叠在一起） | 三个原因叠加：① 板子设了 `DoubleSide`，每块把自己的**镜像**又叠了一遍；② 各层用**同一段代码**（`SNIPPETS[lang]`），屏幕上就是"同一句话两个大小"；③ 沿 z 循环的归一化公式 `-(((-z % cycle) + cycle) % cycle)` 把**所有**板子都扔到 -13 那一带，层序全乱 |
| 6 | 代码墙"层层景深"看起来是重影 | 底色带 alpha + 材质 opacity 0.3–0.9 → 每层的字都从前面那层透出来。改成**不透明底色 + 显式 renderOrder + 把明暗烘进 canvas** |
| 7 | 隧道/演示的年份数字、道具在 t<0.85s 被压成一条亮线 | 段 A 的开机 CRT 亮线效果对整屏生效；演示段现在用 `fx.setCrtLevel(1)` 压掉 |
| 8 | 蜂群把段自己的几何整片糊掉 | 12000 粒 + 加法混合 + 字符字形点精灵，过绘制极重。降到 3600 粒、各段 alpha 定标到 0.22–0.36 |
| 9 | 自检 a) 画布一致性从"差 1 点"恶化到"差 13 点" | 蜂群布局数组是一次性构建的，留到某段首次播放才建 → 乱序/顺序渲染拿到不同初始化时机。预热里补上"所有桥接时刻 + 段落中点"跑一遍 |
| 10 | 开发期 dev server 反复崩 | Windows 下写入 `.js` 用"临时文件 + 原子替换"，chokidar 原生监听到 EBUSY 直接崩 → `vite.config.js` 开 `server.watch.usePolling` |

### 7) 仍未完成（属 F3/P2，按指示**未开始**）

- 逐段把 §3.0 的画面重做（3D/DOM），并把 a–n 场景里的文字调用迁到 `text()`（selftest i 目前仍是空转）。
- **b) 的边缘密度**：52/213 帧卡在 ≥4% 这条，集中在段 B。逐段 3D 重做时解决。
- 3D 物件库/代码墙/蜂群**尚未接进各段**：本轮交付的是"库 + 演示段 + 自检 + 全片持久接线"，
  把茄子/番茄/猫/开关/心脏/钟表/隧道/KV **摆进具体段落**是 F3 的逐段工作。

### 8) 本轮交付物清单（供下一轮接手）

```
src/lib/props/{index,veg,cat,clock,toggle,tunnel,kvcache,heart,env}.js   3D 物件库（§2.7）
src/lib/codewall.js  src/lib/snippets.js                                代码墙 + 七语言原创代码（§2.8）
src/lib/swarm.js                                                        持久蜂群 + 13 布局 + 桥接表（§2.1）
src/lib/swarm2d.js                                                      2D 兜底投影层（默认关，见 D46）
src/scenes/z_demo_f2b.js                                                8 个演示模式（不属于影片）
tools/shoot.mjs      CDP 截图 + 机器可读状态（开发期工具）
tools/selftest.mjs   命令行跑 ?selftest（开发期工具）
tools/canvas_probe.mjs  导出页面 canvas 成 PNG（开发期工具）
tools/render_probe.mjs  逐块比较同一 t 两次渲染的差异（开发期工具）
tools/kill_tree.mjs  收尾无头浏览器的**整个进程树**（Chrome 会派生子进程，只杀父进程会留孤儿）
```

URL 开关（全部只影响调试，不影响影片）：
`?demo=props|clock|tunnel|kv|heart|wall|swarm|bridges` ·
`?shot=分:秒` · `?contact[&contactStep=5&contactCols=6]` ·
`?probe=1|objs` · `?swarm=0` · `?swarm2d=1` · `?nofx=1` · `?only3d=1` · `?x=N`（缓存穿透）

## 决策日志追加（F2b）

| # | 决策 | 原因 | 回退方式 |
|---|---|---|---|
| D36 | 演示段（`?demo=`）**独占画面**：同期影片段落与影片蜂群都退场 | 否则"用演示段验证"变成看两段叠在一起（实测段 A 的开机屏会把 3D 全挡住） | 删 `renderAt` 里的 `demoMode` 分支 |
| D37 | 每个演示模式有**自己的机位**（`DEMO_CAM`），覆盖 rig | rig 的机位是给影片构图的，拿它拍 16³ 体素或 5.2 宽的走廊必然被裁 | 删 `z_demo_f2b.cam()` |
| D38 | 蜂群粒数 `SWARM_COUNT` 由 **12000 → 3600** | FIX §2.1 写"约 12000 个"，但实测 12000 粒在 1080p 上过绘制极重，段 C 的整屏被亮斑糊满、段自己的几何完全看不见 —— 而 §2.1 同时要求它是"连续主角"，主角不等于糊住其它一切 | 改回 12000 并同时把各段 alpha 除以 3 |
| D39 | 蜂群**同时**画 3D 层与 2D 投影层（同一份布局数组） | 相机在 14 段里从 z≈0.6 到 z≈6 来回跑，单靠 3D 层会有取景把它推出画面；"连续主角"要求它不落空 | 删 `swarm2d` 的调用 |
| D40 | 代码墙的板子**沿 z 循环但只在自己的层深附近走**（按 z0 求相位） | 原来的 `-(((-z%cycle)+cycle)%cycle)` 把所有层都归到同一段 z 区间，层序全乱、同屏叠字 | 改回原公式 |
| D41 | 代码墙板子**不透明** + 显式 `renderOrder`；景深靠"把明暗烘进 canvas" | 透明材质 + 沿 z 滚动会让 Three.js 的按距离排序与真实远近脱钩，前面那层后面画 → 叠字 | 恢复 `transparent: true` 并自己排序 |
| D42 | 代码墙每层用**不同的代码片段**（`SNIPPET_FILES`，每语言 2 段） | 多层用同一段代码时，屏幕上就是"同一句话两个大小"，读起来是重影不是景深 | 只用 `SNIPPETS[lang]` |
| D43 | 新增 `?shot=分:秒` / `?contact` / `?probe`（FIX §4 要求的前两条） | 无头截图必须**定格**在确定的一帧才能做逐项验证；`?probe` 是本轮所有坐标级 bug 的定位手段 | 删 `parseShot` 与对应分支 |
| D44 | `tools/shoot.mjs` / `selftest.mjs` / `canvas_probe.mjs` 走 **CDP** 而不是 `--screenshot` / `--dump-dom` | 前者抓不到 WebGL 后备缓冲（全黑），后者在虚拟时间下不稳定 | 删这三个工具，回到人工看图 |
| D45 | `vite.config.js` 开 `server.watch.usePolling` | Windows 下写入 `.js` 的原子替换会让原生 watcher 撞 EBUSY 并**让 dev server 崩掉**（本轮崩了 3 次） | 删掉 `watch` 配置 |
| D46 | 蜂群 **2D 兜底投影层默认关闭**（`?swarm2d=1` 可开） | 它在本机（headless + SwiftShader）会破坏"同一 t 两次渲染像素一致"，自检 a) 因此 FAIL。已逐项排除 uniform/布局数组、点大小（放大到 ≥4px 仍不稳定）、depthTest（开关都一样）→ 指向软件光栅化在大量半透明点精灵叠加下的实现差异，不是影片状态问题。**没有放宽 a)**；改为实测 3D 蜂群的屏幕覆盖（各段 ≥12.4%）来保证"全片在场" | 把 `params.get('swarm2d') === '1'` 改成默认 true |
| D47 | 蜂群"在场"的判据 = **投影后 NDC 覆盖面积 ≥5%**（`swarm.screenCoverage()`），而不是"2D 层计数 >0" | 2D 层关掉后需要一个新的、能真正反映"观众看得见"的判据；NDC 面积是几何量，不受亮度/暗角影响 | 换回 2D 层计数 |

F2 已获用户确认

---

## F3 — 逐段 3D 重做（A–E）　⚠️ 部分完成（2026-10-02）

门禁：本阶段开始前已确认 `docs/PROGRESS.md` 存在用户手写行 **`F2 已获用户确认`**（§5.9）。
按 §5.9「一条消息要求多个阶段时，只做编号最小且满足门禁的那一个」执行 **F3（A–E）**，F4/F5 未开始。

### 新增的公共设施

| 文件 | 作用 |
|---|---|
| **`src/lib/scene3d.js`** | 逐段重做共用的 3D 构件：`textPlane()`（文字→3D 面片，**尺寸由 fontPx 反算**并强制走 `text()` 字号守卫）、`wireShape()`、`voxelField()`、`glowTube()`、`pxPerUnitAt()`（世界单位↔像素）、`createLightRigSafe()` |
| **`src/scenes/_seg.js`** | 段落共用契约：`win()` 演员窗口（§5.0 的 ≤1.2s 超界）、`cueOf()/timeline()` 锚点解析（含 §2.2 的动作提前量）、`popIn()` 过冲入场 |
| **`tools/words.mjs`** | 打印给定时间窗内**真实歌词词时间**，用于校准锚点（本轮靠它发现 D 段锚点整体失准） |
| **`tools/kill_tree.mjs`** | 收尾无头浏览器的整个进程树（Chrome 会派生子进程） |

### 逐段状态

| 段 | 文件 | 状态 | 说明 |
|---|---|---|---|
| **A** 0:00–0:14.5 | `a_boot.js` | ✅ **完成** | 全部改 3D：参数晶格（35 格实例化体素，按 `pieces` 锚点一格格铺开、`parameters` 处逐格充能变色）→ 线框立方体/球/环面在 `object` 处被"创建"（白热过冲 + 自转）→ 中心世界种子立方体发光膨胀 → `simulation` 处巨大等宽 3D 字键入 `world.execute(me);`（两行、屏上 122px）→ 回车闪白。**删除**原三角网格拼立绘、closed 立绘与"两条黑线"（§3 A / §5.1）。§5.6 首行已关闭：CRT 亮线同帧即有晶格微光 |
| **B** 0:14.5–0:29.7 | `b_dive.js` | ⚠️ **部分** | 展馆隧道 + 多语言代码墙 + 各展品（公式环/超立方体/曼德博/星系/波包/门环/小爱心）已成 3D 并逐拍出现；0:20 实测 55100 三角形 / 111 draw call。**待修**：曼德博平面在 0:20 附近过曝成大片白 |
| **C** 0:29.7–0:44 | `c_define.js` | ✅ **基本完成** | 坐标轴 + 单位圆 + 3D 正弦管 + 切线（橙）+ `y = sin x` 标注；实测 t=39 构图正确、蜂群铺成背景。**待补**：`lim` / `ε-δ` 标注需逐个确认 |
| **D** 0:44–0:59 | `d_switch.js` | ⚠️ **部分** | 已全部改 3D：示波器（AC 正弦→方波→DC→光柱，波形每帧重算）· 光圈收缩（**删除旧的上下黑条**，改为贴相机前方的圆环，内半径按该深度可见半高换算）· 自建时间隧道（26 个实例化环 + 12 块年份 billboard；实测 t=53.4 铺满整屏、年份可读，流向与符号在 AD/BC 处翻转）· unite 两股流对撞 · 下潜（水体渐暗 + 气泡 + 中央超大深度数字）。**待修**：47–51s（DC 之后到隧道之前）画面过暗 |
| **E** 0:59–1:14 | `e_deal.js` | ⚠️ **部分** | 超立方体 + 粒子迸发 + 挤出公式 + `▶` + 玻璃笼已成 3D；实测 t=62 tris=8202 calls=37。**待修**：部分时刻过亮（t=62 lit=0.87） |

### 本轮修掉的真 bug

| # | 现象 | 真因 |
|---|---|---|
| 1 | 段 A 的键入文字完全不出现 | `simulation` 的词起唱时间是 **14.002s**（段 A 的最后一刻）；按"锚点=动作开始"算，文字要等到 14.0 才出现。改为：**回车闪白落在锚点**、键入从锚点前 1.12s 开始（§2.2 的预备） |
| 2 | 3D 文字平面整体偏大 1.34 倍 | `textPlane()` 把 canvas 像素高度当成了世界高度；canvas 高 = `ceil(fontPx×1.34)`，于是 §0.5 的像素换算跟着一起偏。改为由 `fontPx` 反算世界尺寸 |
| 3 | 键入时 "world" 被拉成一屏宽 | `texture.repeat` 裁剪只能截到字形中间，且面片与可见文字的比例随裁剪量变化。改为**真正重画 canvas**（`setText()`，只在字符数变化时调用） |
| 4 | 段 D 的 travel 段整屏几乎全黑 | ① `createProp('tunnel')` 的"占满整屏"靠一个 z=-span*0.52 的**封底黑圆**（它是为段 B 写的），在段 D 的近距离下直接顶到镜头；② 隧道固定在原点而相机在 x≈±0.6，轴线偏离视线。改为自建"实例化环 + 年份 billboard"，环心跟随相机 |
| 5 | 段 D 的光圈收缩把画面整片吃掉 | `RingGeometry` 的内/外半径烘焙在顶点里，改 `scale` 会连外缘一起缩 → 变成"整块黑板缩小"。改为**每帧重建几何**、外半径固定、只改内半径，并按该深度可见半高换算 |
| 6 | 段 D 的 AD/BC、travel、unite、deeply 全部不同步 | `anchors.js` 的 D 节有 4 个 key 的 fallback 与真实词时间差得离谱（travel 51.45 vs 实际 **52.770**、blind 47.9 vs **48.260**、ac 45.6 vs **46.347**），且 `unite`/`deeply` **根本没声明** → 场景退到 fallback、与歌词严重错位。已用 `tools/words.mjs` 实测值补齐，并新增 `ad`/`bc`（歌词写作 "A. D" / "B. C"，用 fixed 而非词匹配） |
| 7 | 用 PowerShell `Set-Content` 重写 `d_switch.js` 后中文注释变成乱码 | PowerShell 5.1 默认非 UTF-8，`-Raw`/`-NoNewline` 又吃掉了换行。**教训：源文件一律用 write/edit 工具落盘**。该文件已按 write 工具重写恢复 |

### 已知未完成 / 待修（F3 尚未收口）

1. **B / D / E 的画面亮度定标**：B 的曼德博过曝、D 的 47–51s 过暗、E 的部分时刻过亮。
2. **C 的 `lim` / `ε-δ` 标注**需逐个确认（§3 段 C 末尾）。
3. **本轮未跑 `?selftest` 与 `?contact`**：§3 要求"写完一段先在 cue 面板核对锚点差值，再跑 selftest 与 contact"。
   锚点校准已完成（见 bug 6），但**完整自检与 contact 尚未执行**，因此本阶段**不能算验收通过**。
4. **b) 画面密度**是否因这几段的变化而升降，需用 `?selftest` 实测。
5. 三个子代理（B/C/E）在本轮内失败退出，它们留下的文件**未经我逐帧审阅**；上表"部分"的判定基于我自己的探测数据（三角形数、draw call、px.mean、lit、errors）。

### 下一步（F3 收口清单）

1. 按段调亮度：先 `?probe` 量 `px.mean` / `lit`，目标每段中位数 `px.mean` 落在 0.06–0.20、`lit` 落在 0.15–0.60；
2. 补齐 C 的 `lim` / `ε-δ`；
3. 跑 `node tools/selftest.mjs "http://127.0.0.1:5173/?selftest"`，逐条看新增门槛（尤其 b 与 q）；
4. 跑 `?contact` 出全片缩略图网格，肉眼过一遍 A–E；
5. 结果写回本节后再考虑 F4。

R0 已获用户确认

R1 已获用户确认

3D模型都不过关 换为聊天终端里面发送系统自带表情包🍆🍅🐱 并根据歌词自动搭配合适的聊天记录

R2已获用户确认

## 决策日志（FIX_V4 R3 · §1.11 六张计数卡的语言判断 — **待用户确认**）

> §1.11 原文要求：「每张卡片次级信息:数字 1–6 与该语言名的原文标注
> （据我判断依次是德语、西班牙语、法语、韩语、瑞典语、中文;第 4 个不能确定,
> **请在 PROGRESS.md 的决策日志里写出你的判断依据,并让用户确认**）。」

判断对象是 `public/data/lyrics.json` 第 66 句的**实际唱词**（`t0 = 158.951`，正是 §1.11 点名的 2:38.95）：

| # | 唱词 | 词时间(s) | 我的判断 | 该语言原文 | 依据 |
|---|---|---|---|---|---|
| 1 | `Ein` | 158.951 | 德语 | eins | 德语"一" |
| 2 | `Dos` | 159.399 | 西班牙语 | dos | 西语"二" |
| 3 | `Trois` | 159.861 | 法语 | trois | 法语"三" |
| 4 | `Ne` | 160.318 | **韩语（不确定项）** | 넷 | 见下 |
| 5 | `Fem` | 160.800 | 瑞典语 | fem | 瑞典语"五" |
| 6 | `Liu` | 161.254 | 中文 | 六 | 汉语"六" liù |

**第 4 个（`Ne`）判为韩语的推理**：韩语固有数词"四"读 net，罗马化常见 `net`/`ne`，与唱词 `Ne` 最贴合；
日语四是 shi/yon、荷兰语 vier、德语 vier、法语 quatre、意大利语 quattro —— 都不写作 "Ne"，逐个排除。
这样 1–6 恰好是「德/西/法/韩/瑞典/中」六种语言的数词，与 §1.11 的结构吻合。

**需要你做的一件事**：若第 4 个不是韩语，请直接在下面手写更正 —— 代码里对应常量是
`src/scenes/k_storm.js` 的 `COUNT_LANGS`。

**用户确认/更正：**（请在此行手写）
