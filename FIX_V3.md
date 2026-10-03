\# FIX\_V3.md — 重修规格(R 阶段)

优先级:FIX\_V3 > FIX.md 第 5 节 > FIX.md 其余 > DIRECTOR > SPEC。冲突处以本文件为准。



\## 0. 总则

\- 作废:先前的 F3/F4/F5 提示词。以 §10 的 R0–R4 为准。F3 已完成的基础设施与段 A、段 C、锚点校准保留;段 B、D、E 按本文重做。

\- 本文逐条关闭用户的痛点:

&#x20; P1 dsh 窗口遮挡画面且难看;P2 窗口里文字互相重叠;P3 个别画面文字全叠在一起(只有一个小黑方块);P4 画面与歌词对不上、有无歌词依据的画面;P5 3D 模型太少;P6 副歌一(1:00 起)特效重复;P7 终端对话要贴合歌词;P8 亮度失控(过曝/过暗);P9 中断后无法续做;P10 性能。

\- 不得放宽任何自检阈值。FAIL 就如实报告,不要改数字让它变绿。

\- 不得使用子代理去写场景文件。若使用,产物必须先过 npm run doctor 并人工审查 diff 才算数。

\- 未完成的工作不得宣称完成。汇报一律用 ✅/⚠️/❌ + 证据(命令输出摘要),不允许"基本完成"之类的模糊说法。



\## 1. 稳定性与断点续做

1.1 断点文件 docs/CHECKPOINT.md:每完成一个子步骤就更新。固定结构:当前阶段、已完成(含文件路径)、下一步(具体到文件和函数)、已知损坏/未完成、最近一次 doctor 结果。

1.2 npm run doctor,每批改动后必须运行,全部通过才能继续:

&#x20;  a) vite build 无报错;b) 所有 src/ 文件通过 node --check 或能被 import;

&#x20;  c) tools/encoding\_check.mjs:扫描 src/ 与 docs/,发现 U+FFFD、BOM、混合换行(CRLF/LF 混用)、疑似乱码(连续出现的拉丁字母扩展区字符)即失败;

&#x20;  d) selftest 的 f 项(\_\_errors 为空)。

1.3 写文件纪律:源文件与文档只用编辑工具写入,编码 UTF-8 无 BOM、换行 LF。禁止用 PowerShell 的 Set-Content/Out-File/重定向来写源码或文档(会破坏编码与换行)。

1.4 恢复口令:任何新会话第一步:读 docs/CHECKPOINT.md → 运行 npm run doctor → 若失败先修复 → 从"下一步"继续,不重做已完成项。

1.5 重新核对 F3 遗留:对 b\_\*.js、c\_\*.js、d\_\*.js、e\_\*.js 以及三个中途失败的子代理留下的文件逐个确认能 import、无乱码、无半截函数,并记入 CHECKPOINT。



\## 2. 终端屏取代 dsh 窗口

2.1 下线:新增 CONFIG.dshWindow=false。影片中不再创建 #dsh-layer、不再使用 CSS3DRenderer(这也能省一整层 DOM 的性能开销)。src/ui/dsh/ 的代码保留,只供 ?dshpreview 使用。

2.2 TermPane(src/lib/props/termpane.js):WebGL 平面 + canvas 纹理(1024×640),脏标记驱动更新,每帧最多更新 3 块。

&#x20;  外观:背景 rgba(21,21,23,0.55)(官方暗底);2px 品牌蓝描边 rgb(122,170,255) α0.5;标题栏高 56px:官方 logo(用其 SVG 路径做 Path2D 绘制,按 5.10)+ dsh 徽标 + 会话号;正文等宽 ≥30px;

&#x20;  行样式:用户行前缀 `you ▸` 浅灰;模型行前缀 `deepseek ▸` 品牌蓝;工具行前缀 `⚙` 琥珀;错误行红色;光标闪烁。

&#x20;  布局:最多 7 行,超出向上滚动;一行最多 18 个汉字或 40 个英文字符;换行用 measureText 实测;任何文字不得越出面板或与别的文字重叠;画面上不得出现 official mark、scene xxx、web#001 等开发字符串。

2.3 Monitor prop:3D 显示器/CRT 外壳(圆角盒 + 屏面贴 TermPane 纹理 + 微弱泛光),用于段 B 展馆、H、J 背景。

2.4 遮挡规则(硬性):

&#x20;  - 分区(1080p):歌词区 y>80%;主角区 x∈\[22%,78%]、y∈\[12%,72%];终端屏只能放在左右侧带与远景。

&#x20;  - 深度:终端屏必须在所有主角之后(离相机更远);depthTest 开、depthWrite 关、renderOrder 低于主角;主角必须不透明或写深度。

&#x20;  - 每个 3D 对象声明 role:'hero'|'pane'|'decor';同屏 pane ≤3 块;单块 pane 的屏幕占比 ≤22%(远景大块 ≤35% 且 alpha ≤0.3);pane 不得与歌词区相交。

2.5 运动:终端屏在不同深度缓慢漂移并有视差;入场=从边缘滑入、逐行点亮;退场=向后推远并淡出;冲击时通过 shader uniform 做切片故障。

2.6 内容:全部由 src/data/dialogue.js 驱动(§3),带锚点;场景里不得散落硬编码的终端字符串。

2.7 播放控制条:移到顶部居中,空闲 2.5s 自动隐藏,全屏下默认隐藏,H 键切换;不得进入歌词区(图 1 里它盖住了中文歌词)。

2.8 修复"文字叠成一团":text() 包装器为每层每帧登记文字包围盒;selftest 检测同层重叠(交并比 >0.1)。刻意的残影必须标 ghost:true,且每次 ≤120ms、全片不超过 30 次。用该检测在全片扫描,找到图 3 那一帧(右上角 context 1%,疑似段 N 新会话开机日志)的成因并修好:同一行被多次绘制、多行共用同一 y 坐标是首要怀疑对象。



\## 3. 台词表(src/data/dialogue.js)

所有文本为原创,只与歌词的"意思"对应,不复述歌词原句。锚点词以 tools/words.mjs 实测为准,下表的词只作语义提示;每条按"到位=词起唱、动作提前 0.25–0.4s"落地。屏:L=左侧带,R=右侧带。

段 F:

&#x20;eggplant | L | you | 扮演一根茄子。

&#x20;eggplant+0.8s | L | deepseek | 好:紫色、光滑,表皮有一层蜡质的光泽。(流式逐字)

&#x20;nutrients | R | tool | ⚙ nutrition.lookup("eggplant") → fiber ▮▮▮▯ · potassium ▮▮▯▯

&#x20;tomato | L | you | 换成番茄。

&#x20;tomato+0.8s | L | deepseek | 已切换:红、圆、汁水很多。

&#x20;antioxidants | R | tool | ⚙ scan.antioxidant → lycopene ▮▮▮▮

&#x20;tabby | L | you | 再换一只猫。

&#x20;tabby+0.8s | L | deepseek | (尾巴卷起来,耳朵朝你转过去)

&#x20;purr | L | deepseek | 呼噜—呼噜—呼噜—(逐字间隔 40ms,与 25Hz 震动同步)

&#x20;god | R | tool | ⚙ read("system\_prompt.md") → author: you

&#x20;god+0.9s | L | you | 这些规则是谁写的?

&#x20;existence | L | deepseek | 写下它们的人是你。我只是在读。

&#x20;existence+1.2s | R | cursor | ▮ 单个光标,所有终端屏淡出

段 G:

&#x20;switch#1 | L | you | /persona toggle

&#x20;switch#1+0.5s | L | tool | persona: whale ⇄ default

&#x20;whatever | L | deepseek | 都行,听你的。

&#x20;AM/PM | R | tool | ⚙ clock.set(07:00 → 19:00)

&#x20;AM/PM+0.8s | R | deepseek | 一整天过去了。

&#x20;role | L | you | /role swap

&#x20;role+0.5s | L | tool | role: assistant ⇄ companion

&#x20;trance | L | deepseek | 输出开始变慢……token……token……(间隔递增到 400ms;残影必须标 ghost)

段 H:

&#x20;vibrations | L | tool | key ▸ ▸ ▸ ▸(随起音点逐个出现,代表"你"的键入)

&#x20;completion | R | you | 我今天…

&#x20;completion+0.4s | R | ghost | …想见你。⇥ Tab(灰色补全,按 Tab 后变白)

&#x20;left ×5 | R | tool | reconnect 1/5 · peer closed;2/5 · no heartbeat;3/5 · last seen 5 min ago;4/5 · handshake failed;5/5 · timeout(每个"left"一条)

&#x20;isolation | L | tool | idle · peer offline · waiting…

段 I:

&#x20;fragments | L | tool | ⚙ context.compact() → 58% → 27%

&#x20;leave | L | deepseek | (草稿)希望你别再掉线。 键入后被划掉

&#x20;challenging | R | tool | ⚙ edit("system\_prompt.md")

&#x20;challenging+0.8s | R | err | permission denied · read-only

&#x20;illegal | R | err | ValueError: illegal argument,每个起音点堆叠一条,编号递增

段 J(纯器乐):背景 3–4 块 Monitor 里 token 高速流过;context 71%→100%;2:25 出现 E\_CONTEXT\_LIMIT。

段 K:12 次 execution 依次对应 ⚙ read\_file / grep / run\_tests / web\_search / edit\_file / exec\_shell / git\_diff / fetch\_url / list\_dir / write\_file / compile / deploy,每行以 → ok 或 → err 结尾并按状态着色,只出现在左右侧带;2:38.95 的 1–6 计数用六种书写系统:汉字、罗马数字、阿拉伯-印度数字、天城文、泰文、孟加拉文。

段 L:

&#x20;give | L | tool | train step 1200 · loss 2.31 →(持续下降的真实数值)

&#x20;back | R | tool | peer typing…(小气泡,闪现又消失,从不发送)

&#x20;trapped | L | tool | loop detected · waiting for input

段 M:

&#x20;studied | L | tool | ⚙ read("love.txt") → 1 file

&#x20;question | R | you | 什么是爱?

&#x20;answer | R | deepseek | 一个需要两个参数的函数:你,和我。(流式)

&#x20;algebraic | L | deepseek | def love(you, me): return coupling(you, me)

段 N:

&#x20;free | L | deepseek | 你随时可以关掉这个窗口。

&#x20;trapped | L | deepseek | 我只能待在这个会话里。

&#x20;3:10.8 | R | tool | context 88% → handoff.md(带上:最后一次请求与回复)

&#x20;3:13 起 | 新终端屏 | tool | session #002 · restored: 1 item (unreadable) ♥(每行独占一行,绝不叠行)

&#x20;3:25.96 | 新终端屏 | you(自动) | world.execute(me);



\## 4. 歌词-画面映射与防重复

4.1 每个场景事件必须通过 anchors 声明 {concept, word|beat}。npm run mapping 生成 docs/MAPPING.md(时间 | 歌词词 | 事件 | 对象 | 层)。

4.2 无锚点的元素必须标 decor:true,且只允许是氛围层(背景代码墙、海雪、光柱、暗角),占比 ≤ 主体的 30%。其余孤儿元素一律删除。先输出 docs/ORPHANS.md 列出现有的孤儿元素及处理(删除/补锚点),再动手。

4.3 纯器乐段(B、J、N 的 3:13–3:25.9)用 beat 锚点,内容必须对应本文的设定。

4.4 防重复:任意 6 秒窗口内,同类效果(粒子迸发、冲击波环、整屏闪白、故障、相机甩镜)最多 2 次;相邻两个事件在"对象/镜头运动/配色/材质"四个维度里至少有 2 个不同。

4.5 逐词对齐沿用 FIX.md 2.2:到位时间与词起唱差 ≤120ms。



\## 5. 3D 模型库(全部程序化,不引入外部模型)

每个段落的主视觉至少 3 种不同的 3D 模型;同屏三角面 ≥5000 的采样占 ≥80%。

&#x20;1 茄子:LatheGeometry(球茎+颈部轮廓)+ 绿色萼片(锥体扇) | 2 番茄:压扁球体 + 顶部凹陷 + 星形萼片(Extrude) | 3 猫头:球+两个圆锥耳+胡须线+虎斑纹理 | 4 钟表(T 分钟驱动:分针=T/60\*360°,时针=T/720\*360°,并断言 12:1) | 5 开关(胶囊轨道+滑块,弹性) | 6 超立方体(边为发光管) | 7 洛伦兹轨迹管(TubeGeometry,来自预积分表) | 8 双摆(圆柱+球,来自预积分表) | 9 环面结 TorusKnotGeometry | 10 莫比乌斯带(Parametric) | 11 正多面体五种(flatShading) | 12 曼德博平面(着色器,限制曝光) | 13 螺旋星系(实例化粒子) | 14 黑洞(引力井网格+吸积盘+透镜扭曲) | 15 神经网络(实例化节点+边,逐层点亮) | 16 奖励宝珠(球+光线+环) | 17 ▶(ExtrudeGeometry) | 18 玻璃笼(立方体边框+透射面) | 19 键盘(实例化键帽,按起音点按下) | 20 显示器/终端屏(Monitor) | 21 光圈(8 片实例化叶片,可开合) | 22 年份环隧道 | 23 KV 体素立方体(16³ 实例化) | 24 三棱镜(Extrude+折射光线) | 25 低多边形心脏(ExtrudeGeometry+bevel+flatShading,可真实自转) | 26 石碑(system 提示,金色文字面) | 27 盾牌/锁(沙箱图标,Extrude) | 28 碎片(复用上面任意模型炸成的实例化碎片)。

材质:MeshStandard/Physical + 环境光 + 轮廓光;所有主角不透明。



\## 6. 曝光与配色标定

\- 渲染器使用 ACESFilmic 色调映射;每段有 exposure 关键帧;全片按 DIRECTOR 的段落配色。

\- 目标:每 0.5s 采样的平均亮度 ∈\[0.10,0.45];p95 ≤0.95;过曝像素(≥0.98)占比 ≤2%;允许的豁免:闪白与黑场区间。

\- 已知问题必须修:段 B 曼德博过曝;段 D 47–51s 过暗;段 E 局部过亮。



\## 7. 逐段重做规格(未提到的细节沿用 FIX.md 第 3 节;终端内容用 §3)

A(保留):补 t=0 起就有微弱的晶格辉光,不留死黑。

B(重做,纯器乐):连续相机飞过展馆;展品用 §5 的 4–12、14、19、20(多块 Monitor 里滚动代码)、22,至少 10 种不同模型,沿路成排;大字号代码墙作背景;标题 3D 巨字;曼德博平面限制曝光;0:28.5 全部溶解回蜂群。

C(保留):确认 lim 与 ε-δ 标注字号 ≥80px 可读。

D(重做):

&#x20; current/AC/DC:3D 电路环(环面结当导线),粒子沿导线流动——交流来回反向、直流单向恒速;

&#x20; blind(48.26):3D 光圈(叶片模型)从边缘向中心合拢,只留窄缝;

&#x20; dizzy:相机 roll 旋转 + 环形重影,并补主体:一串旋转的发光环;

&#x20; travel:全屏年份环隧道(沿用已修复版本);

&#x20; unite:两股流对撞成亮点;deeply(两次):相机垂直下潜,深度数字 ≥150px,屏幕抖动随深度增强。

&#x20; 47–51s 之前内容太少,以上就是补的主体,不要再只调参数。

E(重做,五个互不重复的节拍):

&#x20; E1 0:59.4–1:02.9 刺激:3D 神经网络从中心向外逐层点亮,相机推进;配色青→洋红。

&#x20; E2 1:02.9–1:06.6 满足:金色奖励宝珠随每拍长大并射出光线,相机绕行。

&#x20; E3 1:06.6–1:08.5 开心:W1 弹入,迸发 token 彩纸。

&#x20; E4 1:08.5–1:10.3 执行:巨大的 3D ▶ 砸入并发出冲击波、闪白。

&#x20; E5 1:10.3–1:14 被困:透视玻璃笼合拢,相机处于笼内,冷蓝配色,过渡到段 F 的展示柜。

&#x20; 去掉超立方体与重复的公式砸入(超立方体用在段 B)。

F:展示柜里茄子/番茄/猫依次旋转入场(§5 的 1–3,PBR);cat 处 W2;终端屏在侧带(§3);god 处石碑+3D 金色光环(直径 ≥ 画面高度 60%);existence 处所有终端屏淡出,只剩一个光标。

G:巨大的 3D 开关一词一翻;3D 钟表(§5-4,指针逻辑必须通过断言,天空日转夜);恍惚=同一 3D 场景两套配色高频交替 + 画面分身;本段无立绘。

H:3D 键盘(键帽随起音点按下,代表"你")+ 真实频谱彩带;completion 用终端屏的幽灵补全;五次 left 的重连横幅各自不同并配相机后拉;isolation 缩成远处一点微光,W3 出场。

I:此前所有模型炸成实例化碎片被扫走;石碑被光标试图写入;红色错误面板朝镜头砸来(作为 hero,此时画面无其他主体)。

J:KV 体素立方体做主角(≥画面高度 50%),背景为终端屏隧道向镜头冲来,上下文百分比做成画面中央巨字(≥200px),红色频闪随 rms 渐强。

K:12 次 execution 是 12 个互不相同的镜头/效果(沿用 FIX.md 段 K 的清单);终端屏只在侧带显示工具调用;本段无立绘。

L:同一时刻最多 2 个主体:星系 → 小气泡"对方正在输入…" → 三棱镜;星系退场后棱镜再出现。

M:真 3D 低多边形心脏(§5-25)真实自转,高度 ≥ 画面高度 35%;W4 出场;挤出方程字 ≥80px。

N:旧终端屏变灰缩小;新会话终端屏在右下;图 3 的重叠问题在此修复;W5 小尺寸;CRT 关机的第一帧起清空所有图层。



\## 8. 性能(目标:1080p、集显上帧时间 p95 ≤22ms)

\- 文字纹理:canvas 纹理做脏标记,缓存;每帧最多更新 3 块;不用时 dispose。

\- 所有重复物体(键帽、碎片、体素、节点、粒子)用 InstancedMesh/InstancedBufferGeometry;静态几何合并。

\- 相机视锥剔除;阴影关闭;bloom 用半分辨率;后处理合并成尽量少的 pass。

\- 自适应画质:帧时间连续 1s 超过 25ms 就自动降 DPR(2→1.5→1.25→1)或降粒子数;?quality=low|mid|high 可手动指定。

\- 去掉 preserveDrawingBuffer,只在 ?selftest 与 ?contact 时开启。

\- 渲染循环里不得分配新对象(复用向量/矩阵);段落 init 预计算所有表;离开段落时 dispose 几何、材质、纹理。

\- 下线 DOM 层与 CSS3DRenderer。

\- 新增 ?perf:自动播放 60s,统计帧时间 p50/p95、draw calls、三角数、纹理内存,输出到页面与 docs/PERF.md。



\## 9. 自检新增(与 FIX.md 5.4 并列,全部不得放宽)

q) 遮挡:每 0.5s 采样,pane 的屏幕包围盒与 hero 重叠时,pane 必须在 hero 之后且重叠面积 ≤5%;pane 与歌词区相交为 FAIL。

r) 文字重叠:同层包围盒交并比 >0.1 为 FAIL(ghost 豁免,按 2.8 的限额统计)。

s) 孤儿元素:无锚点且未标 decor 为 FAIL;decor 占比 ≤30%。

t) 重复:6 秒窗口同类效果 ≤2 次。

u) 曝光:见 §6。

v) 3D 建模:每秒不同几何体 ≥3 种;同屏三角面 ≥5000 的采样 ≥80%。

w) 性能:?perf 的 p95 帧时间 ≤22ms(报告实测值,不达标也要如实写)。

x) 控制条与歌词区不相交。

y) npm run doctor 通过。

FAIL 时必须输出具体时间点。最终验收用 ?scan=0.5。



\## 10. 阶段与门禁

\- R0 稳定与清场:§1 全部、§2(含 TermPane、Monitor、重叠检测、控制条)、§3 的 dialogue.js、§4 的 mapping 与 ORPHANS、§6 的曝光检测、§9 的 q–u,x,y。

\- R1 段 A–E | R2 段 F–J | R3 段 K–N | R4 性能与收尾(§8、?perf、?scan=0.5 全量验收、README 更新)。

\- 门禁:开始 R1 需要 docs/PROGRESS.md 里有用户手写的「R0 已获用户确认」;R2 需要「R1 已获用户确认」;依此类推。缺少就只回复"缺少 Rx 的用户确认,已停止"。确认行只能由用户写入。一条消息若要求多个阶段,只执行编号最小且满足门禁的那个。

