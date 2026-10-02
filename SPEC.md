\# world.execute(me); · DeepSeek 鲸鱼娘版 — 技术规格

创意与逐句导演见 DIRECTOR.md;进度记录写在 docs/PROGRESS.md(每个阶段结束必须更新,新会话先读它)。



\## 0. 目标与边界

\- 浏览器播放的音乐可视化 PV,约 3 分 32 秒(时长以音频实测为准)。

\- 主角是 DeepSeek 鲸鱼娘(素材见 §4)。世界观:一次 DeepSeek Harness(下称 dsh)会话的完整生命周期;她是被运行的模型,"你"(用户)永远不出镜,只以输入框光标/键入节奏/"对方正在输入…"出现。

\- 只做网页播放:播放/暂停/拖动/全屏/同步偏移。不做 mp4 导出,不引入 Playwright、ffmpeg。

\- 非官方同人:不使用 DeepSeek 官方 logo 与 wordmark(用通用鲸鱼剪影或直接不用),不暗示官方合作或认可。



\## 1. 技术栈与目录(多文件)

\- Vite + 原生 ES 模块,无框架。three(npm,当前稳定版)。2D 用 Canvas2D。图像处理用 sharp,三角剖分用 delaunator(仅构建期)。

\- Python 仅用于音频分析(librosa);其余全部 Node/JS。

\- 字体:英文 JetBrains Mono(@fontsource 本地打包);中文用系统栈 "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif。启动时 await document.fonts.ready。



&#x20; SPEC.md DIRECTOR.md docs/PROGRESS.md

&#x20; assets/        song.mp3  song.lrc  (用户自备,.gitignore 排除)

&#x20; refs/          dsh-pv/ (git clone 的参考仓库,.gitignore 排除,不随项目发布)

&#x20; tools/         analyze\_audio.py  parse\_lrc.mjs  inventory\_whale.mjs  build\_whale.mjs  check.mjs

&#x20; public/data/   analysis.json  lyrics.json  whale\_points.json  whale\_mesh.json  whale\_contour.json  (生成物)

&#x20; public/whale/  实际用到的素材 + NOTICE.md

&#x20; src/main.js    启动、控制条、音频时钟、rAF、window.\_\_renderAt(t)、?debug、?selftest

&#x20; src/core/      clock.js rng.js sync.js compositor.js fx.js palette.js ease.js

&#x20; src/whale/     sprite.js points.js mesh.js wire.js exprs.js

&#x20; src/ui/        dsh.js(HUD 与 dsh 风格组件) typing.js(逐字/流式) 

&#x20; src/lyrics/    layout.js render.js

&#x20; src/lib/       formula.js code.js three\_util.js tables.js(预计算表)

&#x20; src/scenes/    index.js(注册表) a\_boot.js … n\_handoff.js(与 DIRECTOR 的段 A–N 一一对应)



\## 2. 核心架构(硬性)

1\. 唯一时钟:t = audio.currentTime + syncOffset。无音频时降级为内置计时器,不得黑屏。

2\. 纯函数渲染:任意一帧 = f(t)。渲染路径禁止 Math.random/Date.now/performance.now 与跨帧累积状态;随机一律 hash(seed, index)。目的:暂停/拖动/乱序跳转后画面与顺序播放一致。

3\. 有状态模拟(梯度下降小球、双摆、洛伦兹、KV cache 回收等)在 init 阶段按固定步长离线积分成表,渲染时按 t 查表插值。GPU 粒子用解析公式 + uTime 在着色器里算位置。

4\. 节拍/频谱只读 public/data/analysis.json,不用实时 AnalyserNode:onsets\[{t,strength}]、beats\[]、分段 bpm、rms 包络、64 频带 mel 频谱(30 帧/秒)。sync.js 提供 pulse(t,decayMs)、beatIndex(t)、beatPhase(t)、spectrumAt(t)、onsetNear(t,win)。

5\. 单画布合成,层序固定:舞台层(Canvas2D+Three)→ 鲸鱼娘层 → dsh UI 层 → 后处理(色散/扫描线/泛光/暗角/CRT,强度由 fx.js 给)→ 歌词层(最后画,保持清晰)。逻辑分辨率 1920×1080,等比缩放,DPR 上限 2。

6\. 场景模块导出 { id, start, end, init(ctx), render(t, lt, ctx), dispose() },lt=(t-start)/(end-start)。每个场景文件 ≤ 300 行,公共能力放 lib/ whale/ ui/。场景之间不互相引用。

7\. 容错:单个场景/组件抛异常必须被捕获,记录到 window.\_\_errors,并在该处画红色 ERROR 占位,渲染循环绝不中断。

8\. 性能:粒子总数 ≤ 60000(鲸鱼娘点云 ≤ 8000);曼德博/分形着色器迭代 ≤ 300;集显上 ≥ 30fps。

9\. 密度要有呼吸:重拍处最密,断拍处留白;背景元素整体压到主体之下(主体=鲸鱼娘与当前叙事元素),不要让背景比主体亮。



\## 3. 数据管线

\### 3.1 tools/analyze\_audio.py → analysis.json

librosa:onset(含 strength)、beat track、分段 tempo、RMS、64 频带 mel 频谱;时长取实测。

(若不想装 librosa,可退化为浏览器端 OfflineAudioContext 在加载时一次性计算同样结构并缓存,但必须在播放前算完。)



\### 3.2 tools/parse\_lrc.mjs → lyrics.json

输入 assets/song.lrc,格式事实:

\- 英文行:行首 \[mm:ss.xxx],后跟逐词时间戳 <mm:ss.xxx>word。

\- 中文行:与对应英文行同一行时间戳,且不含 <> 标签。按时间戳配对。

\- 开头 3 行是署名元数据,识别后丢弃,不当歌词显示。

\- 英文行里每个词的结束时间 = 下一词的开始;最后一词的"下一时间"实为下一行起点,不可信。

输出每句:{ i, t0, words:\[{t,w}], en, zh|null, hold };hold = min(下一句 t0, 最后一词 t + 1.6s)。

这样三处纯器乐空档(约 0:14.5–0:29.7、2:09–2:27.9、3:13–3:25.9)不会让歌词一直挂着。

中文缺失的句子 zh 置 null,不得编造翻译;汇总到 tools/missing\_zh.txt。

成功后打印:总句数、有中文句数、缺中文序号。



\## 4. 鲸鱼娘素材管线

\### 4.1 获取与清点(不要猜文件名)

1\. git clone --depth 1 https://github.com/MisakaZentai/world-execute-me-dsh-pv refs/dsh-pv

2\. 阅读 refs/dsh-pv 的 NOTICE.md、docs/ASSET\_SOURCES.md、LICENSES/,以及 film/third\_party\_references/ 与 film/vendor/ 下所有图片/SVG/CSS。

3\. 写 tools/inventory\_whale.mjs:列出每个图像的路径、尺寸、是否带 alpha、alpha 包围盒、文件大小,输出 assets/whale\_inventory.json。你(AI)据此给每个文件标注 kind(standing 立绘 / expression 表情 / bg 背景 / ui 装饰 / unknown)和 guessedEmotion。拿不准的标 unknown,并在 docs/PROGRESS.md 里列出让用户确认,不要硬编。

4\. 只把实际用到的素材复制到 public/whale/,并生成 public/whale/NOTICE.md,至少包含:

&#x20;  - 署名链:上善(鲸鱼娘原作形象)→ ZipZipPipe(加入 DeepSeek 元素的女仆二设)→ Small-tailqwq / dsh-deep-whale(立绘、深海背景、UI 装饰)→ dsh-whale-galgame(额外表情),经 MisakaZentai/world-execute-me-dsh-pv 取得;

&#x20;  - 许可:CC BY-NC-SA 4.0,仅限非商业;改编部分按同协议分享;

&#x20;  - 本项目对素材做过的改动清单(裁切、缩放、着色、遮罩、点云/网格转换、故障效果);

&#x20;  - 非官方同人声明,与 DeepSeek、Mili 无从属或合作关系。

&#x20;  项目内的美术产出同样标注 CC BY-NC-SA 4.0。歌曲与歌词不随项目分发。



\### 4.2 允许与禁止

\- 允许:裁切、缩放、位移、着色/去色、遮罩、故障/色散、轮廓描线、点云/三角网格转换、叠加图形与文字。

\- 禁止:重绘或改动角色面部与设计;用 AI 重新生成角色;使用 DeepSeek 官方 logo。

\- 需要的情绪表情不存在时,用最接近的表情 + 着色/位移/叠加图形(泪滴、汗滴等简单图元)补足。



\### 4.3 tools/build\_whale.mjs(构建期,确定性,种子固定)

从选定的主立绘产出:

\- whale\_contour.json:alpha 轮廓折线(marching squares,简化后 ≤ 1500 点)。

\- whale\_points.json:≤ 8000 个带颜色的采样点(抖动网格/蓝噪声,固定种子),字段 {x,y,z,r,g,b,a};z 由到身体中轴的距离与亮度合成,使点云旋转时有厚度。点的序号稳定,供形变使用。

\- whale\_mesh.json:约 400–800 个三角形(轮廓点+内部采样点做 Delaunay),每个三角形记录平均色。



\### 4.4 src/whale/ 的 API(全部是 t 的纯函数)

\- drawSprite(g, t, {expr, x, y, scale, alpha, tint, glitch, anchor}):表情在 expr 间 80ms 交叉淡化。

\- exprs.js:情绪角色 → 素材映射表。角色集:closed(闭眼)、neutral、wake(睁眼/惊讶)、smile、worried、playful、proud、dazed、sad、strained、shy、calm。每个角色映射到真实素材,缺的写明回退方案。

\- points(t, {from, to, p, stagger}):每个点按 hash(i) 错开出发,在 from/to 两个目标布局间用缓动插值。目标布局:sprite、circle、sine、tangents、lemniscate、helix、spiral、galaxy、heart、grid、scatter。每个布局是 (i,N,params) → (x,y,z) 的解析函数。

\- mesh(t, {assemble:p}):三角形从 hash 决定的随机方位飞入并拼成立绘。wire(t,{draw:p}):轮廓逐段描线。

\- 站位(galgame 式):立绘底部锚定,头部在画面顶部 12–20% 处,膝以下被歌词区的暗色渐变吞没;横向默认在 x∈\[58%,92%],可按段落移位/放大。



\## 5. 画面框架

\- 常驻 HUD(src/ui/dsh.js,仿 dsh/终端风格,不复刻任何商业产品界面):

&#x20; 顶栏左:dsh · web 徽标 + 会话号 #001;中:状态行(thinking… / tool: xxx / idle,打字机刷新);右:上下文占用条(百分比+进度)与 TPS 读数。

&#x20; 上下文占用 ctxAt(t) 由 DIRECTOR.md 给出的关键帧分段缓动生成;TPS 由 rms 包络与起音点驱动,不能是假随机。

\- dsh 风格组件:对话窗口(气泡、逐字流式)、工具调用卡片、权限弹窗、开关(toggle)、文件树、重连横幅、交接(handoff)卡片、警告弹窗、嵌套窗口、hexdump、引导日志。

\- 视觉基调:深灰竖条纹背景(#16171a/#1b1c20,4px 交替)、白色扁平图元;语法高亮紫#c792ea 绿#a5e075 琥珀#ffb454 青#4dd0e1;强调色青#00e5ff 与金#ffd54f;深海段用深蓝渐变;临界段红;片尾纯黑。

\- fx.js:glitch(intensity)(白条、RGB 错位、抖动、扫描线)、flash(amount)、crt(open|close)、shake(amount)。冲击处 glitch 瞬间拉满,60–120ms 衰减;段落切换闪白 80ms;副歌每小节首拍轻闪 0.15。

\- 所有键入、闪光、物体生成、震屏都挂在 onsets/beats 上;运动一律缓动,禁止线性生硬运动。



\## 6. 歌词层(必须完整,每一句都上屏,中英都要)

\- 位置:水平居中,英文基线约在画面高度 88%;整体安全边距 ≥ 5%。

\- 英文:大字,约画面高度 4.6%(1080p 约 50px),JetBrains Mono 粗体,在上。

\- 中文:小字,约英文的 55%,浅灰 #b8bcc4,在英文正下方,行距约英文字号的 0.35 倍。

\- 英文逐词卡拉 OK:已唱词用强调色青 #00e5ff,正在唱的词亮白并放大 1.06,未唱词白色 55% 透明度。词时间取 words\[]。

\- 中文随句整体淡入淡出(淡入 120ms,淡出 250ms)。

\- 可读性:2px 深色描边 + 柔和阴影,下方叠 0→60% 黑色渐变(高约 26% 画面)。

\- 自适应:英文宽度超过 84% 画面宽先缩字号(最多到 70%),仍超过则按词断成两行,中文同理。

\- 同一时刻只显示一句;句间交叉淡化 80ms;间隔 < 0.25s 时直接切换。hold 之后到下一句 t0 前,歌词层完全隐藏,舞台可用满屏。

\- 歌词层不参与色散/位移,只允许极轻的重拍缩放 ≤ 1.5%。

\- 画面上除歌词层外,不得出现歌词原文;UI 里的对话、日志、代码都用原创文本。



\## 7. 调试与自检(取代导出)

\- ?debug:底部时间轴拖动条(标出 14 个段落与歌词刻度)、段落跳转列表、FPS 与图元计数、图层开关(舞台/鲸鱼娘/UI/FX/歌词)、同步偏移微调(,/. 键 ±10ms,Shift ±1ms)、显示 onsets 刻度。

\- ?selftest:浏览器内跑并在页面与 console 输出 PASS/FAIL:

&#x20; a) 同一 t 渲染两次画布哈希一致;乱序跳转 100 个时间点与顺序渲染一致;

&#x20; b) 每个段落在 6 个进度点不抛异常、非背景像素占比 > 2%;

&#x20; c) 全片每 0.25s 都落在某个段落内,段落重叠 ≤ 0.4s;

&#x20; d) lyrics.json 每一句在 \[t0,hold] 内都被绘制,中英文包围盒在画面内且互不重叠;

&#x20; e) 无音频降级运行不报错;f) window.\_\_errors 为空。

\- 命令:npm run data(生成 analysis/lyrics/whale 数据) | npm run dev | npm run build | npm run check(node 端检查:数据与 DIRECTOR 时间轴一致性)。



\## 8. 工作纪律

\- 每个阶段先读本文件,再读 DIRECTOR.md 中被点名的段落;不要通读无关段落。

\- 写完一个段落立即在 ?debug 的该段落范围自检,通过再写下一个;不要回头重写已通过的文件。

\- 不得留 TODO、占位、"此处略";凡画面上出现的数字都必须来自真实计算,不做假仪表。

\- 每个阶段结束更新 docs/PROGRESS.md:已完成、未解决、下一步、需要用户确认的素材项。汇报不超过 10 行。

