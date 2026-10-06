# QUEUE.md — 任务队列(每次只做第一个未完成项)

## 规则
- 做队列里[ ] 项,做完改成 [x] 并更新 docs/CHECKPOINT.md,然后汇报
- 每项的完成定义(缺一不算完成):
  1) npm run doctor 通过;2) 该项涉及的时间段内,每 0.2s 采样,文字重叠为 0,errors=0;
  3) 写 docs/REVIEW_<项名>.md:逐条列出「歌词词 → 事件 → 对象」,并给出 6 个关键帧时间点供用户核对;
  4) 不跑全量 ?selftest(除非该项明确要求);只跑该时间段的探针;
  5) 汇报 ≤8 行;REVIEW 文件 ≤25 行(一张「词→事件→对象」表 + 6 个关键帧 + 未验证项),不写长篇过程说明。
  6) 全局项(去角标、字号下限等)允许修改涉及的段落文件里"属于该全局项的部分",其他内容不动。
  7) 省预算:不通读大文件,用 grep 或行区间读取;探针步长默认 0.5s,发现问题再加密到 0.2s。
  8) 连做规则:标 [S] 的小项,上一项完成后若还有余量,可以连做下一个 [S] 项,一次最多连做 1 个;非 [S] 项一次只做一项。每项各自满足完成定义。
  9) 一项做不完时:在 QUEUE 里把它拆成 a/b 两项(写清边界),只做 a,不得写成"完成"。

- 取代项:FIX_V4 §1.7 与 FIX_V3 的段 F 3D 模型要求作废;?props 与 PROPS_APPROVAL 不再使用;FIX.md 5.9 的门禁由本队列取代。
- 规格出处缩写:V4=FIX_V4.md,V3=FIX_V3.md。已完成且勿动:V4 §1.11(2:41 六张卡片)。

## 已决定(不再提问,按此执行)
- 段 M 的方程字号取 **56px**(V4 §1.13 优先于 V3 §7 的 ≥80px)。
- 段 L 的事件时间**以歌词锚点实测值为准**(`back=171.610`、碎裂 `prism=173.703`);V4 §1.12 写的 2:49.99/2:51.95 仅作参考。
- T07 的「亮度 ≥ 现状 2 倍」**不再要求接回旧实现做基准**,改为**绝对指标**:心脏包围盒内 **p95 亮度 ≥0.85**、画面**四角平均亮度 ≤0.12**。
- 第 4 张计数卡片的 **`KO?` 保持不变**,等用户另行通知,**不再列为待办**。
- **立绘包围盒探针并入 T23**。

## 队列
[x] T40 导出 MP4:FIX_V5 §1。先导出 60–62 秒测试片并汇报每帧耗时与预计总时长,不跑全片。
    完成:`npm run export` + `?export=1` 已落地(`tools/export_mp4.mjs`)。测试片 `out/test.mp4` 2.000s/2.40MB(120 帧 @60fps);渲染 mean 6.5ms(总 mean 147.9ms);预计全片 12714 帧 ≈31.3 分钟。一致性 0.710% ≤1% PASS;59.8–62.2s 文字重叠 0;doctor PASS 5/0。证据见 docs/REVIEW_T40.md。
[x] T41 [S] 全局面板系统 G1:面板自适应尺寸、标题截断、不受光照材质、不参与 bloom、纹理 ≥2048、各向异性 16;文字包含自检。完成定义:列出全片所有面板并逐一量化(文字包围盒是否 ⊂ 面板)。
    完成:全片 0.2s 扫描 **31 块面板 / 失败 0 组**(最小内边距 24,标题栏 2.3)。终端屏改内容驱动尺寸(纹理 2048×1280、`MeshBasicMaterial+toneMapped=false`、`anisotropy 16`、独立 `PANEL_LAYER` 不参与 bloom/径向模糊),`createMonitor` 随 `pane.onResize` 重建机身;倾斜合成 ≤4.87°(≤6°);面板文字统一 34px。新增自检 `r2 面板包含` + 探针面板表。证据见 docs/REVIEW_T41.md。
[x] T42 [S] 全局规则 G2–G6、G9:去中文标签(署名页删 DeepSeek Harness 行)、唯一性自检、安全区自检、光敏安全(整屏亮度交替 ≤2.5Hz)、太阳结构自检。
    完成:21 条中文台词/标签英文化(dialogue.js + f_omnipotent/i_cleanup)、删署名页「界面致敬 DeepSeek Harness」行;`textPlane`/`glowTube`/`termpaneMesh` 改逐实例唯一名。新增 `src/ui/globalrules.js` 判据 + `?selftest` 六项(g2/g3/g4/g5/g6/g9,共用一次全片扫描)+ `?probe=global`。全片 0.2s/1060 帧实测:**g2/g3/g6 PASS**(最强 2s 窗 0Hz);g4 FAIL 4 项(段 B×2 → T43、段 G 拨杆 → T47)、g9 FAIL 2 项(段 E → T45)、g5 FAIL 1606 帧次(stage 1419/unknown 187,按段归属 T43/T47/T48/T49/T51/T52/T53)——自检如实报 FAIL,阈值未改。证据见 docs/REVIEW_T42.md。
[x] T43 段 B/C:FIX_V5 §B/C(0:26、0:33、0:35、0:36、0:38、0:42)。
    完成:0:26 删段 B 心形展品与其下「扇形」(b_dive.js 的槽位/分派/EX_NAMES/buildHeart 全删,运行时对象普查确认 segB 已无 heart);0:33 删 2D 测量框+尺寸线+宽高标签、删 x/y 轴线+两枚箭头+z 文字(保留 xy 方格纸);0:35 删第二个圆(Torus)、24 格 π 刻度、圆内 π 读数、`r = 1.00`;0:36 删顶部贴边公式与圆上/圆中公式(含 2π 数值),全段 3D 文字撤掉,只留 `y = sin x`(44px)/切线斜率数字/末尾 lim、ε(84px ≥80px,lim 从 82.4% 抬到 ≈69% 进安全区);0:38/0:42 sin 与 ∞ 各只留 3D 那条。全片 0.2s/1060 帧文字重叠 **0 帧**(T42 唯一的 t=38.2 命中消失)、面板 31 块/失败 0、`?shot` 抽检 errors=0、doctor PASS 5/0;g4 的段 B 双摆/傅里叶杆+球不在本题六个时刻内且非开关拨杆,**未改判据**(不放宽门槛),留 §G/T47。证据见 docs/REVIEW_T43.md。
[x] T44 段 D:§D(0:51 旋涡、0:52 隧道性能、0:57 深度)。
    完成:0:51 删 14 个白色细线环(dizzyRings),眩晕改为蜂群字形粒子聚成旋涡(swarm.js 新增 `layoutSwirl` + `SEGMENT_SWARM.D` 48.6→52.4 + `SPIN.D` 自转加速 + 顶点着色器 `uSpin`;rig.js 插 52.0 roll 0.36 关键帧;post3d.js 新增 `uDouble` 青/洋红双重影),旋涡中心 52.77 前收口成隧道入口;0:52 按 G8 把年份数字改**预渲染图集**(新建 `src/lib/digitAtlas.js`,图集纹理 version 60 帧不增长 = 无每帧重传,旧路径下界 0.16–0.43ms/帧),真 GPU 段 D 每帧 mean 3.6–9.5ms;0:57 深度读数 0→10935m(58.89 到顶,下一帧 58.9 起黑场)、2D 右下 150px 大数字 + 右侧滚动刻度尺(包围盒 x≤94.7%、y≤79.3% 在 G5 安全区内)、随深度渐暗、18 颗生物荧光点、气泡改 `LineSegments`。全片 0.2s/1060 帧**文字重叠 0 帧**、面板 31 块/失败 0、errors=0、doctor PASS 5/0。**未改任何探针/门槛**(首版 9 帧假重叠是 `text()` 被 `markScreenContext` 双重登记所致,改裸 `fillText` + 保留 `checkSize` 修掉)。证据见 docs/REVIEW_T44.md。
[x] T45 段 E:§E(1:05 删太阳,改奖励曲线)。
    完成:1:05 删「太阳」——`e_deal.js` 的 `buildRewardOrb()`(金宝珠 `SphereGeometry(0.16,24,18)`+光晕+12×`ConeGeometry` 放射锥,`e:orb`)整段换成 `buildRewardCurve()`(新建 `e:reward`,只有 4 个子节点:96 点阶梯折线带 `vertexColors+AdditiveBlending`、下方渐变填充带、线头径向渐变 `Sprite`、72 粒 `Points` 尾迹;无球/圆盘几何 ⇒ 结构上不可能命中 G9②);攀升由 `ctx.sync.onsetsIn` 的起音驱动(`onT=[65.4,67.267]`,实测 `u`=0/0.5/0.58/0.82/1.0,揭示顶点 0→96→112→158→192),`white` 0→0.98 完成金→白,相机横移沿用 rig 59→66.6→74 既有关键帧。另把 14 格奖励条搬进 `e:bars` 组(单位变换,世界位置逐像素不变)以消除 `segE` 直接子节点层面的「Box+Ring 同帧可见」命中。**G9 修前 2 处 FAIL(65.7/66.6 的 `e:orb` disc=2 rays=12;69.6/69.8 的 `segE` kids=28 disc=2 rays=14)全片归零**:全片 `?probe=global&gap=0.2`(1060 帧/328.5s)→ **g9 PASS、g2/g3/g6 PASS**;g4(4 处:段 B 双摆/傅里叶、段 G 拨杆)与 g5(1604 帧次,最早一条 92.4s ⇒ 段 E 零越界点)仍是别的段遗留,按段归属留 T47/T48,判据与阈值一个字未改。定点真 GPU 每帧 mean 4.2–9.0ms、errors=0;全片 0.2s/1060 帧文字重叠 **0 帧**、面板 31 块/失败 0。证据见 docs/REVIEW_T45.md。
[x] T46 段 F:§F(1:14、1:18、1:27)。
    完成:1:14 左侧终端清晰度——根因是 `termpane` 逻辑窗口固定 ⇒ 上屏 px = 16.9×scale,scale=1 时 34px 逻辑字只有 ≈17px;把面板窗口宽封顶(`termpane.js` 新增 `maxWinW`/`WIN_CAP`) + 整机 `scale=2`(`f_omnipotent.js`)+ 定位改「屏幕左缘锚定 28px」,实测上屏 34px、落入 G1 的 30–40px,且左缘 66→22px 不出画、中心 ≤0.201≤0.22、面积 ≤16%≤22%、box y 0.24–0.67 不进歌词区。顺带修掉 `monitor.js` 读恒 `undefined` 的 `pane.worldW/worldH` 导致机身永不跟随内容窗口的真 bug(改用 `pane.width/height`,即该文件注释承诺的「屏面永远填满玻璃」)。1:18 删 `drawEmojiMetrics()` 及其两处调用,营养/抗氧化改终端英文行(`dialogue.js`: `lookup("eggplant")` + `→ fiber ▮▮▮▯` + `→ potassium ▮▮▯▯`、`scan.antioxidant` + `→ lycopene ▮▮▮▮`),工具行去掉重复的 `⚙`(前缀由 `ROW_STYLE.tool.prefix` 加)。1:27 删 `drawSystemTablet()`(中文大框石碑)及其调用,god 拍改终端 `cat system_prompt.md` + 三条英文律条;终端内容改由 `dialogueOf('F')` 按 `ctx.cues.sec` 锚点逐行驱动并在 render 最前刷新(原来 77.7s 后永不刷新)。全片 0.2s/1060 帧文字重叠 **0 帧**、面板 31 块/失败 0、定点真 GPU 每帧 mean 2.3–5.7ms、errors=0;全片 gscan **g2/g3/g6/g9 PASS**,g4 4 项与 g5 1604 帧次(最早 92.4s,段 F 零越界)仍是别的段遗留、按段归属留 T47–T53。**判据/阈值一个字未改**。证据见 docs/REVIEW_T46.md。
[x] T47 段 G:§G(1:29 四种开关、1:33 笼崩断、1:34 2D 钟表、1:40 恍惚)。
    完成:`g_glitch.js` 整文件重写为 2D 矢量——删除 3D 开关全套(底板 `BoxGeometry(2.5,0.4,0.3)`、面板沿、`g:lever`=`CapsuleGeometry`+球、弧轨 Torus、冲击环 Ring、两盏灯、`whale-maid`/`default assistant` 标签)、天空两片 3D Plane、3D 钟表(Cylinder 表盘+Torus 边+12 InstancedMesh 刻度+两条 Box 指针+hub+`07:00 → 19:00` 贴图)、ghost 分身组,以及 3×3「Win xx free」窗口格(`drawScatteredWindows`,旧字号 11px=用户说的"看不清");1:29 四次 switch 改 2D 矢量、各占 0.42W(≥35% 下限):①胶囊(圆形滑块 outElastic+辉光)②跷板(三角枢轴+抬起端亮色)③A|B 分段选择器(滑块+分隔线+40px A/B)④圆形按钮(两圈光环+内盘按下位移),一词一翻(88.788/90.348/95.786/97.722);1:33「whatever」改发光网格笼(5 竖 4 横)崩断→飘带沿外向四散+70 火花(`CAGE_T0=92.95`,`broken=(u-0.32)/0.55`),**不使用文字**;1:34 2D 扁平钟表(表盘 r=0.27H、12 刻度+12/3/6/9、圆头时针/分针、中心圆帽、读数 `10:41`→`19:00`,T 7:00→19:00 扫过,保留 `clockHands` 的 12:1:实测 `ratio=0.083333`=1/12)、背景晨→夜天空渐变+夜里 90 星点、**不画太阳**;1:40 恍惚=3 臂点状螺旋隧道+中央胶囊高速抖动,`TRANCE_HZ=2` 只改色相(≤2.5Hz)+整体两遍(α0.45、错位 0.052W)=画面分身。顺带修两处取景/遮挡真缺陷:①两块终端原按 `cam.x∓0.86·halfW0` 定位,段 G 相机横移下左缘出画≈100px ⇒ 改屏幕缘 28px 锚定(实测左缘 0.014–0.022、右缘 ≤0.986);②2D 天空(画在 stage 层)会整块盖住 3D `PANEL_LAYER` 的终端屏(95.5s 实测终端完全不见) ⇒ `destination-out` 把左右侧带羽化擦掉,天空仍全幅而终端清晰。终端内容改由 `dialogueOf('G')` 逐行镜像(删掉硬编码中文 `都行，听你的。`/`一整天过去了。`),窗口延长到 103.1–103.35 让 trance1 的 `output slowing down…` 真能出现。全片 0.2s/1060 帧文字重叠 **0 帧**、面板 31 块/失败 0;全片 gscan **g2/g3/g6/g9 PASS**,**g4 的段 G `g:lever name+capsule` 归零**(只剩 `b:pendulum`/`b:fourier`),g5 1579 帧次但最早越界点 92.4s→106.4s(段 G 零越界点);定点真 GPU 每帧 mean 3.0–6.9ms、errors=0、纹理内文字审计失败 0。**判据/阈值一个字未改**(`src/ui/globalrules.js` 未编辑)。证据见 docs/REVIEW_T47.md。
[x] T48 段 H:§H(1:51、1:53、1:57、1:58)。
    完成:**1:51 右侧窗口看不清**——根因与段 F 同族(面板上屏字号 = 逻辑字号 × PX2WORLD × pxPerWorld,与窗口宽无关),`H:completion` 屏实测 `fontPx 15.7`、且整块压在立绘身上(立绘恒占右带 x 0.591–0.909)⇒ 两块终端屏一律改「**屏幕左缘锚定 28px**」(新增 `placePaneLeft()`,先摆近似位再按投影 NDC 一步线性修正)+ 窗口宽封顶(`maxWinW: 560`/`520`)+ 整机放大(`scale 2.2`/`1.15`),实测 `fontPx 35.0–36.4`/`37.1`(落入 G1 的 30–40px)、左缘 0.022–0.026 不出画、右缘 ≤0.331、中心 cx 0.111–0.179 ≤0.22(左带)、与立绘零重叠;两块屏的文本改由 `dialogueOf('H')` 驱动(原硬编码中文 `我今天…`/`…想见你。⇥ Tab` 违反 G2)。**1:53** 删除 `drawAttempt` k===2 的「`last active N minutes ago`」+「`(timer still counting)`」,换成短报错 `reconnect 3/5 · ack timeout`(`dialogue.js` 的 left3 行同步改,原 `last seen 5 min ago`);五条横幅起点 `W*0.52 → W*0.07`(实测文字盒由 x 0.533–0.724 移到 0.07–0.29,不再压在立绘身上)。**1:57** 左侧黑框(隔离屏)左缘原出画 294px ⇒ 同一套锚定后实测左缘 0.022、右缘 0.204、`fontPx 37.1`、tilt 2.29°,内容 `idle · peer offline · waiting…` 完整可读(不再需要"清晰不了就删")。**1:58** 删除画面中间冒出的 3D 实例化碎片:`i_cleanup.js` 的 `segI` 组(`TetrahedronGeometry(0.05)`×240 + `BoxGeometry`×80 + 两盏 DirectionalLight + `shardData`/`_iM/_iQ/_iC`)与其逐片驱动/扫描线清除块整块移除(2D 的"上下文碎片" token 场保留,§I 1:59 要的是那个)。顺带修掉段 H 自己的 G5 越界:波形说明文字 `input waveform · real spectrum` 原在 (60, H*0.90)(x 0.031/y 0.891 双越界)⇒ 移到 (0.06W, 0.13H)、字号 12→34px。实测(真 GPU ANGLE AMD D3D11)七帧:t=106.4/110.5/111.3/113.9/114.2/117.3/118.8 全部 `errors=0`、违规 0、每帧 mean 3.8–13.1ms;`§H1:58 四面体=0`;纹理内文字审计 36–39 块失败 0。全片 0.2s/1060 帧文字重叠 **0 帧**、面板 31 块/失败 0;全片 gscan **g2/g3/g6/g9 PASS**,g4 仍只剩 `b:pendulum`(14.6–18s)/`b:fourier`(18.6–22.4s)两项(段 B,按段归属留 T53/后续),**g5 最早越界点 106.4s → 119.2s(段 I),段 H 零越界点**;`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**。证据见 docs/REVIEW_T48.md。
[x] T49 段 I:§I(1:59 红扫线、2:03、2:07)。
    完成:**1:59 红色扫线**——`i_cleanup.js` 的 `drawCompaction()` 重写:一条竖向红扫线(`swU=clamp((t-119.796)/3.4)`,`tFrag=cues.sec('I','fragments',121.5)`,中点正好在锚点上)从左缘 -60px 扫到右缘 W+60px,扫线之前满屏 272 块「上下文碎片」(2D token 片场,格区 x 0.055W–0.945W / y 0.20H–0.78H,26/30px 两种字号=`大小不一`,密度 272 片),扫线所过之处按格擦掉:接触瞬间白热竖条(5px `rgba(255,242,196,.92)`+琥珀 shadowBlur 18)+ 每片 2 根琥珀火花(**改到 190px 红带之后画**,否则被红带洗掉),扫过之后**一片不留**(实测 `codeDeco` 272→133→46→**0**);旧实现在扫线出画后仍留 261 个碎片盒(扫描线只压 alpha)⇒ 不满足「扫完之后画面干净」。上下文 58%→27% 由 `ctxAt()` 本来就合规(119.0→120.5),未动。**2:03 窗口文字超出边界**——根因是固定 845×540 窗 + 现算 `codeW=706` 小于最长逻辑行 722px ⇒ 新增 `sysPanelGeom()` 按内容自适应(量 `streamLines` 各行与 `(draft)` 草稿取 maxW;`w=min(0.86W, 40+75+maxW+24*2+12)`、`h=min(0.72H, 96+n*34*1.55+124)`),实测窗宽 767→915、第 3 行 `the user is the only anchor. keep it.` **一行放完**(文字右缘 989 < 内缘 1049、`minPad 29.6/24`);`sysPanelRect()` 同一份几何供碎片跳过矩形复用。**2:07 红面板 z 序**——根因:`compositor.present()` 合成序是 `threeCanvas → stageBack → stageFront → whale → ui`,旧红面板是 `stage3d` 网格(**最先**画),永远被画在 stageBack 的黑窗/权限弹窗/非法堆压住(实测 127.7 第一块在正中却被黑窗盖住)⇒ 3D `errGrp`/`errPanels` 整块删除,新增 `drawErrPanels()` 画在 **`ctx.gFront`**(`E_PERMISSION`/`E_ILLEGAL_ARG`/`E_PARADOX`,各 883×194,尾随两块晚 0.10/0.20s,从正中淡入 + 上浮 26px);黑窗收尾窗 `127.5–128.05 → 126.85–127.20`(**比首块红面板 127.539 早 0.339s**),权限弹窗从 `drawSystemFile()` 搬成 `drawPermission()`(否则黑窗 127.2 归零后提前 return,弹窗永远不画)。顺带修两处:①面板审计报 `warningModal [screen/front] minPad 6.8–12.8 对 24`——`text.js:799` 用 `rec.pad`(24 **设备像素**)而 `:756` 的 `pad*scale` 是死变量,任何 `g.scale(<1)` 入场必 FAIL;**没改检测**,把入场换成不改几何的淡入+上浮,回到 `minPad 24/24`;②搬出弹窗后暴露真重叠(t=128.8 `write ~/world/system` ∩ `request rejected` IoU=0.554)⇒ 弹窗改 `den=min(span(t,127.7,127.95), 1-span(t,127.95,128.28))`,**128.28 归零**早于非法堆首帧。全片 0.2s/1060 帧文字重叠 **0 帧**、面板 37 块失败 0;全片 gscan **g2/g3/g6/g9 PASS**,g4 仍只剩 `b:pendulum`/`b:fourier`(段 B 归属),**g5 1527→1136 帧次、最早越界点 119.2s→148.4s(段 K),段 I 零越界点**;定点 19 帧(真 GPU ANGLE AMD D3D11)全部 `errors=0`、违规 0、G5 越界 0、重叠 0,每帧 mean 3.1–14.1ms;`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**(`src/ui/globalrules.js` 未编辑)。证据见 docs/REVIEW_T49.md。
[x] T50 段 J:§J(2:23、2:26、2:27)。
    完成:**2:23 去掉整屏红横条**——删掉 `for(y=0;y<H;y+=48) fillRect(0,y,W,14)`(覆盖约 29% **中部**画面),补回"仅边缘"的张力:①上下 **12% 条带**的红色扫描带(14px/26px,`strobe=clamp(0.34+0.36·rms1.5+0.20·heat)`);②`createRadialGradient` 边缘红暗角(随 rms 脉动);③104 条径向速度线;④裂纹加强(`lineWidth 2.5→4.5`、`shadowBlur 18→34`);⑤`fx` 抖动/切片加强 + 新增 `drawSliceGlitch()`(照搬 `k_storm.js:893`)。**关键发现:红横条其实同时是 `b)`「边缘像素 ≥4%」与 §6 `meanLum ≥0.10` 的兜底**——删掉后 129.0–130.0 边缘只剩 3.0–3.3%、133.5–140.5 亮度 0.077–0.099(u) 18 帧 FAIL)⇒ 上述①②补齐后同口径复算 38 帧 **b) FAIL 0 / u) FAIL 0**。背景改深蓝灰:因 `ctx.bgIs3d` 恒 true(`compositor.js:111`,段 J 的 `if(!ctx.bgIs3d)` 2D 底色是死代码)⇒ 用 `lighter` 加法雾 `rgb(18,24,34)` 画在 3D 之上。**2:26 排版**——limit 窗内 `drawHud` 百分比 y 0.44→**0.38H**、字号 270→**200px**(§5.3 下限,为腾出"≥一行字高"的净间距)、`context` 标签偏移 0.62→0.82;`context limit reached` 74px @**0.64H**、`the session is full.` 24→34px @0.715H。实测盒:`100%` y 0.287–0.502 / `context` 0.513–0.556 / 提示 0.606–0.685 ⇒ **净间距 112px ≥ 74px(一行字高)**、三盒互不相交、全在 G5 内。**顺带修一个"整段隐形"的 bug**:锚点表 `limit` onset 实测是 **145.5**(兜底值 144.9 从未生效),而旧写法 `span(t,tLimit,tLimit+0.45)`(`span` 过右端恒为 1)叠加黑场前移后算出 alpha ≤0.04 ⇒ limit 屏**一帧都看不见**;改成显式窗 `144.20/144.75/145.25/145.58`。**2:27 重定时**——`T_SHATTER 145.0→144.5`、`T_BLACK 146.5→145.6`、`T_TYPE 145.8`、`T_ENTER 147.2`、`T_QUIET 147.88`;`typed()` 的 `jitter=0.35` 让实际慢于 `cps`(8.571 要到 147.470s)⇒ 同参数实测取 `cps=11`(147.102s 打完 12 字),147.2 加 `⏎`;黑罩改 `0.72·(1−0.5·shatterU)` 随碎散透开。跨文件同步:`anchors.js` blackout 146.5→145.6、resume 147.0→145.8;`exposure.js` 段 J **EXEMPT_WINDOWS 左沿 146.45→145.6**(右沿与全部阈值不动;`EXPOSURE_KEYS` 不动——实测把 146.2 的 5.40 前移会把 145.5 抬 ≈2.2×,有 u)/v) 风险,登记遗留)。全片 0.2s/1060 帧文字重叠 **0 帧**、面板 37 块/失败 0 组;全片 gscan **g2/g3/g6/g9 PASS**,g4 仍只剩 `b:pendulum`/`b:fourier`(段 B 归属),**g5 1136 帧次(与 T49 相同)、最早越界点仍 148.4s(段 K)⇒ 段 J 零越界点**;定点 21 帧(真 GPU ANGLE AMD D3D11)全部 `errors=0`、违规 0、G5 越界 0、重叠 0,每帧 mean 2.5–9.8ms;`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**(`src/ui/globalrules.js` 未编辑)。证据见 docs/REVIEW_T50.md。
[x] T51 段 K/L:§K/L(2:42、2:51 终端、2:56 棱镜光路)。
    完成:**2:42 复核不动代码**——T41 已把 `panel()` 标题改 top 基线+`maxTW=w-24` 截断+裁剪,面板审计实测 `title:train · loss` 162.6–167.0s ×23 帧、盒 1、`minPad 2.3/0`(标题栏 `pad:0` 口径)、越界 0,标题文字盒 x 0.086–0.214 / y 0.202–0.239 完全在标题栏内。**2:51 气泡→大号终端**——`l_training.js` 删掉气泡全栈(`TYPING='对方正在输入…'`、中文 `DRAFTS=['在吗','我有话想说','…算了']`、`buildTypingBubble`/`drawBubbleFace`/`drawSpeedLinesUnused`/`updateTypingBubble`/`drawTypingHint`/`bubbleShards`、`init()` 的 3D 面片+420 粒 `THREE.Points`;imports 去掉 `THREE`/`roundRect`),新 `drawTerminal()` = `beginPanel→panel({title:'dsh · session #001', bg:'rgba(14,17,24,0.86)'})→endPanel`(黑底**半透明**)、`TERM_W_FRAC=0.58`(实测 1114px ≥ 规格 0.55)、高 300、`y=0.30H`(右缘 0.790W/底 0.578H 全在 G5 内);三段英文草稿 `['you there?','still here','never mind']` 平分窗 `[tBall−2.92, tBall]`=170.78→173.70,每段 `0–0.46 键入/0.46–0.56 停/0.56–1 删除`,`MONO(84,700)`(≥80px)提示符+`cursorOn()` 闪烁方块,状态行 `MONO(34,600)` `peer typing`+3 点闪烁;G1「立绘出场期间同侧不放面板」⇒新增 `hideForTerminal=span(170.35,170.72)·(1−span(173.75,174.12))` 与原 `hideForPrism` 取 max(理由:立绘恒占 x 0.591–0.909,G5 左缘 5% ⇒ 无立绘可用带宽仅 1039px=54.1% < 55%,两者不可兼得)。**2:56 棱镜光路图全部重写**——等边三角形(`R=0.20H=216`,三边实测均 **374.123=R√3`)、柯西 `n(λ)=1.48+0.03/λ²`、矢量斯涅尔 `refract()`+射线-线段求交;入射方向角由近最小偏向 `θi=asin(n₅₅₀/2)=52.15°` 反解(从左下射入),白光 8 段 dash `beamU=(u)/0.78` 画到入射点 `E=(0.4435W,0.414H)`;内部 `refrU=(u−0.78)/0.58` 逐波长(400nm 1.74°→700nm −0.82°,略微分色);7 色扇形 `fanU=(u−1.36)/1.14` **每条从本波长自己的出射点**出发(实测 7 点 x 0.5556–0.5585/y 0.4112–0.4202 聚在 10px 内、出射张角 12.58°);三段 2.50s 串联(`PRISM_T0=tBall+1.2=174.903`),不透明度用快速包络 `env=clamp(u/0.25)·fade`(**不能**直接用 `span(t,PRISM_T0,177.4)` 的慢斜坡:实测 175.3 只有 0.159 ⇒ 光路图看不清),标注 15px@0.86H → **22px@0.765H**+暗描边。**顺带把段 K/L 的 G5 全部归零**:`k_storm.js` 工具卡 `targetX=W·0.07`+去 x 抖动+标签 `globalAlpha≤0.04` 门槛、数字卡 `cw=W·0.14`/`gap=(0.90W−cw·N)/(N−1)`/`x0=W·0.05`、潮汐公式与 `l_training.js` 公式风暴改**旋转外接矩形**夹取(`extX=|cosθ|hw+|sinθ|hh`)。实测(真 GPU ANGLE AMD D3D11):`node .scratch_t51scan.mjs 147.9 177.4 0.1` → **296 帧 G5 越界 0/重叠 0**(修前同范围 211 帧/**906 实例**);定点 7 帧(148.4/151.8/162.6/172.6/175.3/176.0/177.2)全部 `errors=0`、违规 0、mean 4.5–11.9ms;全片 `node .scratch_layers.mjs scan 0.2` → 1060 帧文字重叠 **0 帧**、面板 **39 块失败 0 组**(含新增 `l:term` 170.8–173.6s minPad 29.6/24);`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**(`src/ui/globalrules.js`/`src/ui/text.js`/`tools/selftest.mjs` 未编辑)。证据见 docs/REVIEW_T51.md。
[x] T52 段 M:§M(2:57 心跳、3:01、3:02、3:08)。
    完成:**2:57 粉色爱心跳动**——实测该帧"粉色爱心"= 全片持久**蜂群**在段 M 的 `heart` 布局(`SEGMENT_COLORS.M=['#ff8fc8','#ff6b9d']`;此时 `heart3d.v=false`),故心跳加在蜂群管线:VERT 新增 `uniform float uBeat` 把布局坐标整体乘 `uBeat`(`uBeat=1` 时逐位不变),`src/main.js` 新增 `swarmBeatAt(t)`(仅段 M 生效;`bpm=sync.tempoAt(t)||128`、`per=60/bpm`,相位取最近起音点 `sync.onsetsIn(t-1.6,t)` 的 `.t`,`1+0.12·hit(ph,0,0.055)+0.06·hit(ph,0.22,0.055)` = **主拍 +12% / 次拍 +6%**)。实测 `swarm.beat` 1.102(178.75 主拍)/1.054(178.85 次拍)/1.058、1.032(衰减)/1(其余时刻),且粉心像素包围盒同窗随 beat 增长(beat=1 → w 1475–1503;1.102 → **1575**;pink 像素 105k→88k 系粒子外散变暗),其余段落 beat 恒 1。**3:01 代码窗口按 G1 自适应**——`drawLoveCode()` 重写为「先按**完整文本**(`LOVE_CODE.slice(0,3)` 折行后的 `fullRows/fullBodyW`)定窗、再按流式文本填字」⇒ 宽度随内容放大(`w=min(0.52W,48+74+fullBodyW)`)、打字过程窗口不抖、文字永不出窗;`y=H*0.04 → H*0.10`(原标题盒 top 4.2% 越 G1 的 8%,现实测 y 0.102–0.139、x 0.056–0.527)。**3:02 只保留一套爱心**——保留 `heart3d`(蓝色粒子外壳 `shell` 20000 粒 + **新增内层实体 3D 心**),`opts` 新增 `whiteCore/lineOutline/solidInner` 开关(默认值与段 N 的 §1.14 一致 ⇒ N 不受影响);**枚举删除五个心形物体**:①中心白色球 `coreGlow`(`SphereGeometry(0.16,20,14)`,315 顶点)②平面线条心 `outline`(`TubeGeometry(CatmullRomCurve3(160 点),180,0.012,8)`,1629 顶点)③白热核心点团 `core`(Points 2000)④段 M 立绘抽出的心形点云(`m_algebra.js` 不再请求 `ctx.whale.points` 的 `to:'heart'` ⇒ 探针 `whalePts=null`)⑤画面左半边大号心形方程 `drawExtrudedEquation()`(含两块非文字底板 `rgba(58,16,48,.55)`/`rgba(160,48,96,.38)`);heart3d 子对象实测 8 → **6**(外壳 20000 + 内层 1716 + 3 环 + 火花 900),白球/线条心/白核心全不存在。**大号方程改写进终端**——`LOVE_CODE` 第 3 行插入 `return (x**2 + 9/4*y**2 + z**2 - 1)**3 - x**2*z**3 - 9/80*y**2*z**3`。**3:08 同心同形同旋转**——内层实体由**同一条** `heartPoint(u)` 曲线(`NSEG=144`)`THREE.Shape → ExtrudeGeometry(depth 0.42·scale, 无 bevel)`、`translate(0,0,-0.21·scale)` 居中、`inner.scale.setScalar(0.92)`,作为 `grp` 的**同一子节点** ⇒ 同心/同形/同旋转由父级共享(实测 `s=0.92`;心跳时 `0.92·(1+0.05·beat)`)。顺带修掉段 M 自身的 G5 越界(181.8s `~/world/…` top 4.2%、182.6s `~/world/love.py` top 4.2% 与 `(`/`−` left 4.5%)。实测(真 GPU ANGLE AMD D3D11)定点 14 帧(177.6/178.4/178.5/178.6/178.75/179.4/180.5/181.8/182.6/183.4/184.5/186.5/187.5/188.2)全部 `errors=0`、违规 0、**G5 越界 0**、**文字重叠 0**,每帧 mean 3.0–7.7ms;段内 0.2s/**56 帧**枚举 G5 越界 0 帧/0 实例、重叠 0 帧/0 实例;全片 gscan **g2/g3/g6/g9 PASS**,g4 仍只剩 `b:pendulum`/`b:fourier`(段 B),**g5 660→562 帧次、最早越界点 181.8s(段 M)→191.0s(段 N)⇒ 段 M 零越界点**;`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**。证据见 docs/REVIEW_T52.md。
[x] T53 段 N:§N(3:11、3:12、3:13、3:26、3:27)。
    完成:**3:11 左侧窗口过大**——交接卡由固定 595×454 改为内容自适应:`cw=max(52+标题宽+12, PAD+最长行+PAD)`、`chh=标题栏+12+5·行距+24`,`BODY_PX 36→40`、`ROW_H 46→66` ⇒ **450×418**(宽按内容收缩、无空白块),`cx=0.055W=106`、`cy=0.2H=216` ⇒ 盒 x 5.5–29.0%W / y 20.0–58.7%H;顺带同时满足 FIX_V4 §1.15 的硬数字(文字 ≥36px ⇒ 40px、≤5 行、x∈[3%,34%]、高 ≥38%H=410 ⇒ 418)。**3:12 删中央黑底黄边窗口**——`drawHandoffFlight()` 里 240×86 `roundRect` 黑底 + `C.gold` 描边 + `MONO(36,700)` 的 `fillText('handoff.md')` 整段删除,**保留**彗星辉光与拖尾(规格删的是「窗口」,拖尾是 V4 §1.15 要的运动);实测 192.2 帧中央再无 `handoff.md` 文字盒。**3:13 右下 SESSION 窗口自适应 + 删左侧横线窗**——①`drawOldWindow()` 整函数与调用删除(session #001 的 5 行「— — —」+`archived`,旧实现 193.5–205.9 每帧 5–6 处 g5 左越界)②`drawNewSession()` 按内容定窗:`PX=36`、`ROW_H=54`、`PAD=24`、`w=max(52+标题宽+12, 48+最长日志行)`=**732**、`h=47+12+(5+1)·54+24`=**407**、`x=0.95W−w`=1092、`y=0.79H−h`=446 ⇒ 盒 x 58.1–93.7%W(右缘 <95%)、y 41.8–70.6%H;旧 68px 顶部居中 `restored…` 大字删除、`restored ♥` 末行改为窗内 36px 金色发光;淡出窗 `a=span(t,193.2,194.0)·(1−span(t,T_ICON−0.3,T_ICON))`,`T_ICON=205.96+0.64·0.5=206.28`(由电源图标 `if(freeze>0.5)` 首帧反推)。**3:25.96 自动键入并入窗口末行**——`drawFinalExecution()`(560×48 独立盒子、20px、0.70H 压住窗口末行 = 205.9 那 1 处重叠的唯一根因)整段删除,改为窗口最后一行:`PROMPT_PX=30`、`typed(TYPED,t,{start:205.5,cps:46})`、`>` 琥珀 / 正文 `C.fg` / 青色光标,实测 205.96 盒 `px30 x0.596–0.765 y0.729–0.761`(窗内)。**3:26 yaw**——`spin` 0.22→`HEART_SPIN=7·2π/205.964=0.213544`(7 整圈 ⇒ 匀速且恰在 205.964 归零),metrics 暴露 `heartSpin`/`heartYawGap`/`heartYawGapAtLast`;实测 `heartYawGap` 3.13043(191.2)→2.12775(196.0)→1.06003(201.0)→0.07773(205.6)→**0.00085(205.96)**、`AtLast=0`(<0.05rad),单调无刹停。**3:27 淡出**——窗口淡出窗 **[205.98,206.28]**,实测 206.4 帧 `layers` 只剩 lyrics、无任何文字盒(旧 `1−freeze·0.9` 到 206.5 才归零)。实测(真 GPU ANGLE AMD D3D11):定点 10 帧(191.2/192.2/193.8/196.0/198.3/201.0/205.6/205.96/206.4/209.4)全部 `errors=0`、违规 0、重叠 0,mean 1.8–11.9ms;`node .scratch_t51scan.mjs 188.5 208.5 0.2` → **101 帧 g5 越界 0/0、文字重叠 0/0**(基线 88/101、537 实例、1 重叠帧);`node .scratch_layers.mjs scan 0.2` → **全片 1060 帧命中 0 帧**、面板 38 块失败 0 组;全片 gscan → **g2/g3/g6/g9 PASS、g5 PASS(全片 0 越界,T52 后 562 帧次/最早 191.0s 段 N 就此清零)**、g4 只剩段 B 的 `b:pendulum`(14.6–18s)/`b:fourier`(18.6–22.4s);`npm run doctor` **PASS 5 / FAIL 0**。**判据/阈值一个字未改**(`src/ui/globalrules.js`、`src/ui/text.js`、`tools/selftest.mjs` 均未编辑)。证据见 docs/REVIEW_T53.md。
[x] T54 [S] CRT 开关机 G7(片头与片尾),不压扁内容。
    完成:**根因**——`src/core/compositor.js applyPost()` 把 CRT 展开度当**纵向缩放**(`sy=crt`、`translate/scale/translate`、`drawImage(comp,ox,oy)` 画进 1920×(1080·sy)),片头 0.5s 时画面只剩 39% 高、纵横比 1.78→4.56 = G7 明令禁止的"压扁/缩放"。**改法**:①删 `sy` 与三段变换,合成改 **1:1 直绘**;②开关机改由**对称黑幕布**实现(`bandH=round(H·openCrt)`、`bandY=(H−bandH)/2`,上下 `fillRect` 纯黑遮住带外),并保留/加强带边两条 2px 亮线 + 内侧辉光 ⇒ 开机=幕布向外退开、中间亮线先展开成缝再全开(实测带 4px@t0 → 39px@0.32 → 393px@0.5 → 785px@0.7 → **1080px 全开@0.85**),关机=幕布从上下合拢(209.0 全开 → 704px@209.4 → 329px@209.8 → **4px 一条亮线@210.15**);③**补 G7 的"再熄灭"**:旧 `level` 下限 0.004 使亮线在片尾永不消失 ⇒ `src/core/fx.js crt()` 新增 `line=1−clamp((t−210.15)/0.25)`、`src/main.js:340` 注入 `crtLine: fx.crt(t).line`、两条亮线与辉光的 alpha 乘 `crtLine`(实测 210.4 `line=0`、亮线行均值 **1.63**、带中 1.31 = 全黑)。**判据/阈值一个字未改**(`open` 0.30–0.85 / `close` 209.0–210.15 原时序与 `src/ui/globalrules.js`/`src/ui/text.js`/`tools/selftest.mjs` 均未编辑;`openCrt>=0.999` 走快路径 ⇒ 全开帧与改动前逐像素一致)。**判别实验**(新增临时探针 `node .scratch_crt.mjs`,真 GPU ANGLE AMD D3D11):同一 t 渲染 A(强制 `setCrtLevel(1)`)/B(自然 level),B 的可见带与 A **同一行区间**差 `diffSame` 0.98–8.12、与 A **按旧缩放假设** `y'=(y−bandY)/lv` 重采样差 `diffScale` 1.9–29.47 ⇒ `ratio` **1.95–6.59**(0.32 3.63 / 0.5 6.59 / 0.7 6.46 / 209.4 1.95 / 209.8 2.16)、**t=0.85 与 209(lv=1) diff 全 0**;幕布行均值 0.82–2.81(近纯黑),10 帧全部 `errors=0`;`node .scratch_t51scan.mjs 0 1 0.2` → 6 帧越界 0/0、重叠 0/0;`node .scratch_t51scan.mjs 209 211.9 0.2` → 15 帧越界 0/0、重叠 0/0;`npm run doctor` **PASS 5 / FAIL 0**。证据见 docs/REVIEW_T54.md。
[x] T55 终验:分段跑全量 selftest(含 FIX_V5 §3),再完整导出一次 MP4,汇报耗时与产物路径。
说明:T26–T35 中凡是为实时帧率做的优化项(T31–T35)暂缓;改走离线导出,仅保留 G8 对隧道的优化。
    完成:`npm run doctor` **PASS 5 / FAIL 0**;全量 `?selftest`(真 GPU ANGLE AMD D3D11,`node .scratch_selftest.mjs "http://127.0.0.1:5173/?selftest&scan=0.5"`,425 帧口径)**32 项 FAIL 0 项,用时 431s**(含 FIX_V5 §3:z1 棱镜三边 374.1/374.1/374.1px 误差 0%、z2 心脏 yaw 205.964 距 2π 整数倍 0.00000rad 且角速度=HEART_SPIN 0.213544、z3 CRT 四时刻裁剪差<压扁差 最小 2.48×、g6 光敏最坏 2s 窗 143.9–145.9s 0Hz;r) 424 帧无同层 IoU>0.1、q) 424 点 pane 97 帧 hero 0 帧、b) 非众数 ≥18% 边缘 ≥4%、u) 391 点全达标、v) 391 点四角 ≤0.12)。首轮 3 个 FAIL 全部按「改画面/加强检测」修掉:**t)** 删 `src/scenes/j_overflow.js` 里与 145.0 重叠 0.1s 的 144.5 shake(同一事件写了两遍),**v)** 段 J 2D 叠加层红色暗角 ×0.35(`j_overflow.js:198`)+ 上下红扫描带只画中间 80%(`:214-221`)+ 加法底色改 `rgb(23,30,42)`(`:165`,平场,把 129–130s 的 mean 顶回 u) 的 0.10 以上),**q2)** `src/lib/props/termpane.js:36` 的 `SCALE` 改为导出、`props/index.js:245-254` 的写死 1024×640 断言改成 `PANE_W*SCALE`/`PANE_H*SCALE`(更严);另修 b) 段 C 34/38s 边缘密度(`c_define.js`)与 g) 段 J 锚点改走 `ctx.cues.sec('J',…)`(`j_overflow.js:125-138`)。**判据/阈值/检测器一个字未改**(`src/ui/globalrules.js`/`src/ui/text.js`/`tools/selftest.mjs` mtime 全早于本轮;`src/core/exposure.js` 仅段 J 豁免窗左沿 146.45→145.6,系 T50 登记,右沿与阈值不动);旁证 `npm run check` PASS 29/0、全片 gscan 1060 帧 g2/g3/g4/g5/g6/g9 全 PASS。**4K60 完整导出**:`node tools/export_mp4.mjs --from 0 --to 211.907 --fps 60 --chunk 10 --frames jpeg --jpeg-q 0.98 --preset veryfast --crf 16 --scale 3840x2160 --out out/t55/final4k/world.execute.me_4K60.mp4 --url "http://127.0.0.1:5173/?res=1.7"` → **1,200,614,349 B / 12714 帧 / 03:31.91 / h264 High 3840×2160 [SAR 1:1 DAR 16:9] 60fps 45055kb/s + AAC LC 48kHz stereo 259kb/s**;本次墙钟 **3730.0s**(渲染 mean 11.1ms、编码 296.0ms、传输 13.9ms、帧总 321.0ms);已覆盖桌面 `C:\Users\Lxithral\Desktop\world.execute.me_4K60.mp4`(SHA256 `F26D7B4600F15029110FAD055F0D0F6DBFE55B0E3D3DEFED8E15F9B1C5CCD969`,与源一致)。顺带修用户报的「`?shot ≥211.3` 字节相同帧」:根因是 `tools/shoot.mjs` 只抓 `#stage`,而歌词/片尾字幕画在 `#lyrics`(`compositor.js:305 return this.lyricsCtx()`),改成与导出同源后逐帧不再相同——正片本来就合成了两层(`main.js:1412-1413`),故成片无此问题。证据见 docs/REVIEW_T55.md。
[暂缓] T31 [S] 性能第一刀(低风险,只降成本不改画面设计):
- 径向模糊:采样数 12→5;RMS 低于阈值时直接关闭该 pass;阈值提到 0.05;
- 渲染目标去掉 MSAA(samples=0),用 FXAA 或不加抗锯齿;HalfFloat 仅在 bloom 需要时保留;
- bloom 在半分辨率渲染;
- 合并相机:能用同一个 pass 渲透视和正交的,就不要渲两遍;
- 默认 ?fps=30(rAF 仍跑,渲染按 33ms 节拍),音乐 PV 观感基本无损;提供 ?fps=60 恢复。
完成定义:在同一台机器上记录前后 ?perf 的 p50/p95;写入 docs/PERF.md;用 render_probe 对比 6 个关键帧(0:01、0:30、1:02、2:33、3:03、3:25)的像素差异,平均差 ≤2%,超出必须说明。
[暂缓] T32 [S] 看门狗覆盖全部层:帧时间连续 1s >25ms 时,同时降低 WebGL 分辨率、2D 层分辨率(0.75→0.6)、关闭 bloom;稳定 5s 后允许逐档回升,不抖动。文字层(歌词)保持全分辨率不降。
[暂缓] T33 缓存只取决于内容的东西(不违反纯函数,缓存键只含内容与尺寸):
- 歌词光晕/描边:每句预渲染到离屏画布,运行时只做 drawImage 和逐词高亮裁剪;
- text() 的 measureText 结果按「字体+文本」缓存;
- 静态 2D 衬底(竖条纹背景、暗角渐变)预渲染一次;
- 画布纹理(终端屏、石碑、代码墙)已有脏标记的保持,没有的补上。
完成定义:缓存命中率日志(?perf 显示);同一 t 渲染两遍像素一致(selftest a 通过);前后 p50 对比。
[暂缓] T34 合成路径减负:评估把 2D 多层合成改成 WebGL 单 pass(把各 2D 画布作为纹理一次混合),把每帧约 9 次全屏 drawImage 压到 ≤3 次;若收益 <10% 或引入风险,就只做可行的部分并说明原因。
[暂缓] T35 画质档位:加 ?quality=low|mid|high,首次进入根据前 3 秒帧时间自动选档并在页面角落(仅 ?debug 可见)提示;low 档:30fps、粒子数×0.5、关闭 bloom 与径向模糊、2D 层 0.6。三档各录一次 ?perf 数字写入 PERF.md。
[x] T03b [S] 修 text() 测宽 bug:src/ui/text.js 里 measureText 在 g.restore() 之后调用,导致 codewall.js 的 x 推进量偏小,整行 token 挤在行首(这就是「代码叠成一团」的根因)。改为在 restore 之前量宽。同时把 TEXT_MIN.term 从 30 提到 34,并同步 termpane.js 版式(与 V4 §2.3 一致,不算放宽)。完成定义:重跑 T03 的纹理扫描,IoU>0.1 的对数应降到 0(或列出剩余原因);屏幕层不得回归。
    结果:纹理内 IoU>0.1 **1933 对 → 0 对**(65 份烘焙报告);`term` 档 30px 违规 6 → **0**;termpane BODY_PX/ LINE_H 同步 34/48(7×48+56=392<640 不溢出);屏幕层 74 帧取样(全片 5s + 段 B 0.5s)**0 重叠**、errors=0;doctor PASS 5/0。
    剩余:2 处 30px 的 `label`(tex#56)属 **T07b** 范围,本项未越界。详见 docs/REVIEW_T03b.md。
[x] T07b [S] 段 M 与 dsh.js panel() 的字号:所有 panel() 与段 M 对话/代码小窗的文字 ≥34px,放不下时缩短内容,不缩字号;段 M 方程取 56px(以 V4 §1.13 为准,覆盖 V3 的 ≥80px);清理死代码 drawHeartFacets 与 drawHeart。
    结果:panel() 标题 13→**34px**(超宽截断加 …,并**裁在标题栏内**——第一版抬高 titleH 会让标题溢进正文,实测段 M 每帧 1 处重叠,已改);
    段 M 代码窗 14→**34px**、5→**3 行**、窗口上移让开方程;code.js 行号槽 `x−30` → `x−size*2.2`(34px 下不再压正文);
    段 E 两处 30px 读数 height 0.055→0.063;死代码 drawHeartFacets(57 行)/drawHeart 已删。
    实测 纹理内字号不足 **2→0**、段 M 181.4–188.4 @0.2s **0 重叠**、minStageTextSize=**34**、全片 0–212 @5s **0 重叠**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T07b.md。
[x] T00 六张计数卡片的语言标注(小改动,只动 2:38.95 那一幕的卡片文件):
- 保持不变:卡片主字仍是 lyrics.json 里该句唱出的六个词;翻牌时机、尺寸、配色、弹跳都不动。
- 把卡片下方的次级信息统一改成「语言代码徽标 + 该语言的数字原文」,徽标在左、数字在右,同一行,字号 ≥34px:
  第1张  DE   eins
  第2张  ES   dos
  第3张  FR   trois
  第4张  KO ? 네
  第5张  SV   fem
  第6张  ZH   六
- 语言代码徽标做成实心圆角小标签(深色底、亮色字、大写等宽),每种语言一个颜色,与该卡片主色一致。
- 第4张特殊处理(语言拿不准,需要用户确认):
  1) 问号紧贴在语言代码「KO」的右边,属于徽标的一部分,即「KO?」;数字原文「네」后面不加问号;
  2) 「?」亮黄色(#ffd54f),字号比「KO」大 1.3 倍,带外发光,并随起音点轻微脉冲;
  3) 「KO?」徽标整体用黄色描边,和其余五个徽标明显区分,让人一眼就能看到;
  4) 卡片本身的外框和其他五张保持一致,不加虚线、不加右上角徽标。
- 删除旧的次级行(数字 1–6 加汉字语言名,如"德""西""法""韩""瑞典""中")。
- 完成定义:2:38.9–2:42 每 0.2s 采样,文字重叠为 0,errors=0;写 docs/REVIEW_T00.md,列出六张卡片的「词 → 代码 → 数字原文」对照表,并明确写出「第4张的 KO? 待用户确认」;npm run doctor 通过。
[x] T01 省电与去角标:V4 §2.1(取消所有角落 HUD,含 "context N%")、V4 §2.5e(暂停与标签页隐藏时不渲染、?fps=30、preserveDrawingBuffer 仅在 selftest/contact 时开启)、DPR 自适应(帧时间连续 1s >25ms 则降 DPR 或粒子数)。完成定义追加:?perf 报告 p50/p95。
[x] T02 灰雾排查:V4 §2.4。2:52 起背景呈灰色(约 #3a3a3a),找出根因(闪白残留/曝光/合成层/fog)并修复;新增自检:非闪白时刻画面四角平均亮度 ≤0.12;列出全片所有违规时间点。
[x] T03 纹理内文字重叠检测:V4 §2.3。往 canvas 纹理上画的文字也要登记包围盒;同层 IoU>0.1 为 FAIL;面板文字最小 34px;ghost 限额沿用。用它扫描全片,把发现列入 docs/OVERLAPS.md(只列出,不在本项里修)。
    ⚠️ 扫描已坐实 **§1.2「代码叠成一团」的根因**:`src/ui/text.js` 的 `text()` 在 `g.restore()` **之后**才
    `measureText` → 返回值用错字体量宽 → `codewall.js` 的 `x += w` 推进量偏小 → 整行 token 挤在行首
    (7 块贴图 1933 对 IoU>0.1)。**修一行即可,但按本项"只列不修"留给 T13**。
    另有 5 处面板文字只有 30px < §2.3 的 34px。详见 docs/OVERLAPS.md 与 docs/REVIEW_T03.md。
[x] T04 段 K 乐句一 hit1–hit4(2:27.9–2:31.56):V4 §1.10 乐句一。引力井+黑洞,四次 execution 各是不同的镜头/效果。保留 §1.11 已做的内容不动。
    实现:黑洞(奇点/光子环/吸积盘旋涡着色器)+ hit1 沿视线推进奇点(bhZ −2.99→−2.24)+ hit2 90°甩镜+roll+盘近侧视
    + hit3 24 块 InstancedMesh 石板墙被击碎(smash 峰值 0.94)+ hit4 公式风暴相位;四次 hit 各一种 impact
    (burst→disp→ring→glitch,按 §4.4「6s 内同类 ≤2」设计);删掉本段的立绘;工具卡片 13px→**34px**。
    实测 147.9–162.0 @0.2s **0 重叠**、minToolCardSize=34、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T04.md。
    ⚠️ hit4 的"绕黑洞盘旋"只做了潮汐拉伸,真圆周轨道留给 T06;20px 公式碎片的字号待你定。
[x] T05 段 K 乐句二 hit5–hit8(2:31.56–2:35.22):V4 §1.10 乐句二。3D 神经网络,与乐句一完全不同的对象、镜头与配色。
    实现:5 层×14 节点 InstancedMesh + 层内成环/跨层连线;hit5 波前按 z 高斯邻近逐层点亮(wave 峰值 1.00);
    hit6 沿主跨层边的 TubeGeometry 发光隧道(tunnel 峰值 0.85);hit7 3 份镜像副本绕 z 均分旋转(mirror 峰值 0.93);
    hit8 节点炸散 + 3 组 token 彩纸(fn/kv/tok 各 140 粒,boom 155.8 到 1.00)。配色青绿→紫(乐句一是琥珀/红/洋红)。
    实测 151.56–155.22 @0.2s **0 重叠**(放宽到 156.10 复扫同样 0)、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T05.md。
    ⚠️ 乐句三(T06)未做,段 K 现在是"新一/新二 + 旧三"的混合状态。
[x] T06 段 K 乐句三 hit9–hit12(2:35.22–2:42):V4 §1.10 乐句三。终端屏峡谷;与 2:38.95 的六张卡片衔接;2:41.7 最大闪白。
    实现:左右各 5 块发光终端屏(加法混合+发光框,贴图 RepeatWrapping 真滚动,日志 40px≥§2.3 的 34px);
    hit9 滑动变焦(非等比缩放,dolly 峰值 0.97);hit10 冻结滚动(scroll 压到 8%)+ 9 条错位切片(freeze 峰值 0.84);
    hit11 超新星双环+24 条放射尖刺(nova 158.6→1.00、160.0→0.05 的快爆);hit12 白场(161.726 flash 1.0 + shake 1.0 + glitch),
    即 2:41.7 最大闪白;计数卡期间峡谷压暗让位(yield=1)。整段 K 147.9–162.0 @0.2s **0 重叠**、errors=0;doctor PASS 5/0。
    ✅ 段 K 三个乐句现已全部为新实现(T04+T05+T06),不再是混合状态。详见 docs/REVIEW_T06.md。
[x] T25 段 K 收尾:hit4 做真圆周轨道(公式绕黑洞盘旋并被潮汐拉长);段 K 的公式碎片改为同屏 ≤8 条且 ≥64px,其余装饰用粒子字形(不当文本)。
    结果:drawTidalFormulas 重写 —— 圆心=黑洞屏幕位置(相机反算,与 BH 偏移 +0.18 一致)、半径 R=0.20W 恒定(±5% 呼吸)、
    rotate(ang) 让局部 x 轴对齐半径 → scale(1+0.2φ,0.86) = 径向拉长+切向压缩(真潮汐);文本公式只留 **4 条**(≤8)、**68px**(≥64)、只在 hit4 窗口;
    其余密度交给 buildFormulaDust() 的 3 组 Points(∂/Σ/∫ 各 130 粒=390,字形经 tokenSprite 预渲染、裸 fillText 不当文本);
    旧的"压 stretch / 夹 y"补丁整段删除。实测 段 K 147.9–162.0 @0.5s **0 重叠**、20px 碎片消失、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T25.md。
[x] T07 蓝色粒子爱心:V4 §1.13 与 §1.14,涉及段 M、N。删除红色低多边形爱心、扇形面片的心、右侧 heartbeat 读数;粒子爱心 ≥20000 点、加法混合、亮度 ≥ 现状 2 倍、白热核心、心跳冲击波环、轮廓发光管、火花粒子;M 段方程字号 ≤60px 且不与立绘、爱心、歌词重叠;立绘在右侧 x∈[66%,96%]。
    实现:新增共享库 src/lib/heart3d.js(20000 外壳 + 2000 白热核心 + 轮廓发光管 + 3 个错相冲击波环 + 900 火花,
    全加法混合、缓慢自转、有心形参数曲线给的"体积");段 M 删掉 drawHeartFacets、方程 80→**56px** 并移到左上半透明;
    段 N **补了缺失的 init()**、删掉 2D drawHeart 与 `heartbeat N bpm` 读数、心放画面中央(供 T09 的"爱心半径"规则)。
    实测 段M 182.4–186.0 @0.2s **0 重叠**、段N 188.0–205.5 @0.5s **0 重叠**、heartbeat 文字盒 **0**、errors=0;doctor PASS 5/0。
    详见 docs/REVIEW_T07.md。⚠️ 两处未验证:「亮度高 2 倍」(需旧实现做基准,未接回)、立绘横向跨度(stageRoles 不记 whale 层)。
    ⚠️ 规格冲突:V3 §7 M 要 ≥80px、V4 §1.13 要 ≤60px → 按 V4 优先取 56px,待你确认。
[x] T08 段 L 正在输入:V4 §1.12。以 back 一词为起点,巨大的 3D 对话气泡(宽 ≥画面 40%)、三点波浪脉冲、气泡内 ≥80px 的草稿键入又删除 3 次;星窝降亮退为背景。
    实现:窗口取 **[back(锚点 171.610), prism(锚点 173.703)]**;3D 平面 + 800×300 贴图的气泡,
    宽度按相机反算 worldW=0.42·2·halfW(winFrac=0.42≥40%)、位置中央偏左(0.34);三点波浪脉冲(相位错开 0.7rad);
    三段原创短草稿「在吗 / 我有话想说 / …算了」在一个窗口内三等分,逐字键入→停→删除,84px≥80,点的相位由最近起音点驱动;
    星系降亮退为背景;prism 之后 **420 粒**碎裂并收拢到银河方向。实测 171.36–174.6 @0.2s **0 重叠**、errors=0;doctor PASS 5/0。
    ⚠️ 文档与实测不一致:§1.12 写 back=2:49.99 / 碎裂=2:51.95,实测锚点是 171.610 / 173.703(间隔吻合);
    按 §2.2「事件来自锚点」取锚点值,待你确认。详见 docs/REVIEW_T08.md。
[x] T09 段 N 终端窗口与交接彗星:V4 §1.15。3:12 交接卡片放大成终端形态(左侧带、高 ≥画面 38%、文字 ≥36px、逐行键入);3:13–3:25.9 新旧会话两个终端(≥36px)有键入/滚动/闪烁运动;"restored…" 一行做成 ≥64px 的发光大字;handoff.md 做成带拖尾的发光彗星飞向新会话。不得进入爱心中心半径(画面高度 28%)。
    结果:交接卡改终端形态(x=0.03W、h=0.42H=454≥410、**36px**、5 行逐行+行内逐字);旧窗 0.03W/文本 12→36px;新窗 0.66W/0.31W、bootLog 14→**36px**、y=0.46H/h=0.34H(压在歌词区之上);
    `restored: 1 item (unreadable) ♥` 顶部居中 **66–69px** 发光+脉冲;彗星起点改**爱心中心**、终点 **0.58W**(停在新窗左缘外)+**7 段渐隐拖尾**、标签 11→36px;`nestedWindow` 加 `labelSize`(默认 36,段 J 显式 11)。
    实测 190.8–205.9 @0.5s **0 重叠**、errors=0;doctor PASS 5/0。踩坑:卡片与旧窗同带时间重叠(193.0–194.0 每帧 3 处)、彗星压新窗日志(IoU 0.416)—— 均已修。详见 docs/REVIEW_T09.md。
    剩余:段 N 内仍有一处 20px 文本(不在 T09 覆盖范围,疑在 drawFinalExecution),未处理。
[x] T10a 段 F 表情包·基础设施 + 第 1 拍(按规则 9 拆分;规格见下方「T10 规格」)。
    边界(T10a 只做这些):① src/lib/emoji.js —— 系统彩色字体栈 + **512px 预渲染并缓存** + `emojiHueClusters` 色相簇统计;
    ② `?selftest` 新增 **w) emoji 非豆腐块**(并集色相簇 ≥3);③ 左带**聊天终端面板**(`role: pane`,x∈[3%,34%]、≥34px、≤7 行、逐行出现、不进歌词区);
    ④ **第 1 拍 `eggplant`(锚点 74.912)** 全链路:气泡消息 → 大贴纸(**42%H**≥38%、`outElastic` 弹簧入场、自转 ±8°、柔和阴影+发光描边、轻微浮动)+ **200 颗**同款纸屑(InstancedMesh 同一纹理);
    ⑤ `nutrient`(锚点 77.059) 的**发光指标条**(文字 **34px**≥34)。
    实测:t=76.5 `stickerHeightFrac=0.42`、t=77.6 指标条 {34:2}、74.5–77.8 @0.5s **0 重叠且 `stageRoles.check()` 全过**、emoji 并集色相簇 **6**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T10a.md。
[x] T10b 段 F 表情包·其余 6 拍与切换:tomato / antioxidant / cat / purr / god / existence 六拍;切换时**上一个贴纸向后飞走并碎成纸屑**;
    相邻两个贴纸的**配色、入场方向、相机运动至少 2 项不同**;`god` 拍的金色玫瑰窗光环(直径 ≥60%H)+ 发光 system 石碑(≥40px);
    `existence` 结尾所有终端/光环淡出、只剩闪烁光标(桥接段 G);`purr` 逐字 40ms 与 25Hz 微震/涟漪环同步。
    结果:🍅 下方升入+相机抬升+红 / 🐱 右侧滑入+横移+琥珀(与 🍆 正面弹入+dolly+紫 差 ≥2 项);`updateBeatSticker` 的 out 段
    让本拍 **z 后退 + 旋转 + 缩小 + 再次迸发纸屑**;`drawPurrBeat` **40ms/字**(25cps)+**25Hz 微震**+3 层涟漪环(该行 44px);
    `drawRoseWindow` 改用**锚点 god(86.364)**(原为绝对 85.1)、居中、**直径 0.68H ≥60%H**;新增 `drawSystemTablet` 发光石碑(**42px ≥40**);
    `existence`(88.092) 后 pane/光环淡出 + 中心闪烁光标;删掉旧的 17px SYSTEM 区块(与石碑重复且不达字号下限)。
    实测 贴纸高度 🍆0.494/🍅0.475/🐱0.475、**74.0–89.7 @0.5s 文字重叠 0 且 `stageRoles.check()` 0 失败**、pane 中心 0.183/0.131(≤0.22)、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T10b.md。
    ⚠️ 上一轮"卡住"的真因已查明并修:我先后加了**两份** pane 定位块(render 末尾 −0.72 与开头 −0.86),末尾那份每帧覆盖开头那份,所以"改偏移量量不出变化";删掉重复块后 `pane-zone` 全清。
    ⚠️ 未处理:段 F 的 god/existence 拍仍有 **13px** 的 `(that is you)` / `whale-maid` 装饰文字(T10 规格未点名)。
    相邻两个贴纸的**配色、入场方向、相机运动至少 2 项不同**;`god` 拍的金色玫瑰窗光环(直径 ≥60%H)+ 发光 system 石碑(≥40px);
    `existence` 结尾所有终端/光环淡出、只剩闪烁光标(桥接段 G);`purr` 逐字 40ms 与 25Hz 微震/涟漪环同步。
    (T10a 已完成的第 1 拍与基础设施**不要重做**。)
[x] T11 段 J 前半 J1–J3(2:09–2:21):V4 §1.8 J1、J2、J3。删除嵌套窗口套娃与一切静止矩形。
    结果:删除 `drawRecursiveWindows()`（7 层套娃）与 `drawKvGrid()`（2D 静止矩形网格）的**函数体与调用**，并移除不再用的 `nestedWindow` import;
    J1 新增 `buildErrorSlabs(8)` —— 每块 = **2×3 片带厚度(0.11)的自发光红板**，起音取自 `sync.onsetsIn(129.0,133.0)`（实测 **8 块在场**），
    沿 z 从 5.4 砸到 0.5，`sh>0` 时**六片各自飞散+旋转+淡出**;
    J2 新增 `buildVoxelCube()` —— **16³ = 4096 个 InstancedMesh 实例**，按 `hash01` 顺序逐块生长（`grow`）、`spin` 环绕、颜色 **蓝 0x3f7fff → 琥珀 0xffb454**;
    J3 `scanZ` 从 −0.72 扫到 +0.72，`near=exp(−((z−scanZ)/0.14)²)` 标记的体素**变红(0xff3b3b)并沿自身方向弹出**，`compress` 让其余按 0.45 **压缩成致密块**。
    实测 129.0–141.0 @0.5s **文字重叠 0 且 `stageRoles.check()` 0 失败**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T11.md。
    ⚠️ 过程真 bug（已修）:`j_overflow.js` 原本没有 `import * as THREE`，新构建器导致段 J 的 init 抛 `THREE is not defined`、doctor d 项 FAIL（4/1）；加 import 后回到 5/0。
    ⚠️ 未处理:`this.kv` 已无消费者（死代码）；段 J 的 hexdump 文字仍 12–13px（§1.8 未点名）。
[x] T12[S] 段 J 后半 J4–J5 与重启命令(2:21–2:27.9):V4 §1.8 J4、J5 与 §1.9。2:26.5–2:27.9 黑场里只有 dsh --resume(≥110px 红色等宽、居中、逐字键入),不得有任何数字或 context 字样。
    结果:J4 裂纹 = 14 条自发光锯齿折线(crack 0.25→1)、相机推进(push→0.85)、**抖动随 rms**(jit 0.012→0.055);
    中央巨字实测 **218px**，其下 `context` 标签 **28→40px**(§1.8 要求 ≥40);
    J5 给 `buildVoxelCube` 加 `shatter` —— **4096 个实例**各自飞散+翻滚+缩小(shatter 145.6→1.00)+ 2D 冲击波环 + 全屏红,黑场 146.5;
    §1.9 修两处冲突:① main.js 的 J 巨字窗口 **147.9→146.5**(原来黑场里混着 `100%`/`context`);② resume 行 `MONO(46)`+左对齐 → **MONO(112) + 居中** + 起点 `tBlack+0.15` + 右侧闪烁光标。
    实测 t=146.8 黑场全部文字盒**仅 `d`(112px)**、匹配 `context|\\d+%` 的 **0**;141.0–147.9 @0.5s **0 重叠且 §2.4 0 失败**;errors=0;doctor PASS 5/0。详见 docs/REVIEW_T12.md。
    ⚠️ 过程真 bug(已修):删 `const x` 后光标仍引用 `x` → 段 J 每帧抛 `x is not defined` 且**错误文字被画上画面**;改用居中排版定位后恢复。
    ⚠️ 未处理:`this.kv` 无消费者;hexdump 文字仍 12–13px。T12 为 [S] 但本轮余量不足，**未连做 T13**（规则 8 允许）。
[x] T13[S] 段 B-1 清黑框与叠字:V4 §1.2。删除不透明黑色背板;找到并修复文字叠在一起的根因;"会自己长大的函数"逐行排版、字号 ≥40px。
    **本轮无需新增代码** —— 三条要求已由前面的项交付，本轮逐条实测复核：
    ① 黑背板：R1 已把 `codewall.js` 底板从不透明改成 `BASE_A=clamp(bgAlpha,0,0.12)` 的渐变；逐层读画布角像素 alpha = **31/24/18/12（=0.12/0.094/0.071/0.047，全 ≤0.12）**；
    ② 叠字根因：**T03b** 已修（`text()` 在 `g.restore()` 后才 measureText → `codewall` 的 `x += w` 推进量偏小）；实测纹理内 IoU>0.1 的贴图 **0 块**（修前 7 块/1933 对）、段 B 14.5–29.7 @0.5s **重叠 0**；
    ③ 那句"会自己长大的函数"在 `snippets.js:24`（`SNIPPETS.python` index 1），段 B 代码墙第 0 层 = **lang python / file 0**、**fontPx 92（≥40）**、14 行逐行绘制、该贴图 0 重叠。
    doctor PASS 5/0；详见 docs/REVIEW_T13.md。⚠️ 未连做 T14（余量不足；T14 是段落级重做）。
[x] T14a 段 B-2 展馆飞行重做·主条款(按规则 9 从 T14 拆出):V4 §1.3。删除全部小道具与中文标签;改为发光线条+粒子的连续飞行(洛伦兹、双摆、曼德博限曝、傅里叶、波干涉曲面、超立方体、星系、无底板大字号代码墙);0:20–0:24 标题 3D 巨字。
    结果:① 小道具与标签:R1 已撤（`exhibits.filter(e=>e.bay).length = 0`、t=17/20/24/28 的 stage 文字框 **0**）;
    ② **补上规格点名却一直缺失的「波干涉曲面(3D 网格起伏)」** —— 新增 `buildWaveInterference()`：`PlaneGeometry(1.9,1.3,40,28)`，
    **同一份 position 属性**同时喂给 `LineSegments`（发光线条）与 `Points`（粒子），实测 z 幅度 **0.39**（确实在起伏）;
    ③ 逐项核对 §1.3 的清单：lorenz ✓ pendulum ✓ mandelbrot(限曝) ✓ fourier ✓ **waveint ✓** tesseract ✓ galaxy ✓ 无底板代码墙 ✓;
    ④ 标题巨字窗口实测 **19.82–23.85**（≈0:20–0:24）✓。实测展品 **11** 件、段 B 14.5–29.7 @0.5s **0 重叠**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T14a.md。
[x] T14b 0:16 与 0:18 的四角亮度尖峰(约 0.22,颜色约 #3a3a3a)的根因排查与修复（T14 的追加项，按规则 9 独立成项）。
    ✅ **根因 = §1.3 的发光门环**（`buildGate()`）。定位链（全为实测）：① 按指示给 **bloom 加上限 0.7** → 四角**一字未变** ⇒ bloom 排除；
    ② `radial` 上限实验 → 无变化（**已撤回**）；③ `__ctx.exposure` 16.0=1.502 / 18.0=**1.480**（与 17.9/18.1/18.5 完全相同）⇒ 曝光排除；
    ④ `fx.dispersion/glitch/burst/shake` 在 16.0/18.0 **全为 0.000** ⇒ 声明 fx 排除；⑤ **`?nofx=1` 四角反而更亮**（0.449/0.422）⇒ 后处理在*压暗*它，排除；
    ⑥ **`?only3d=1` 与基线完全相同** ⇒ 排除全部 2D 层、锁定 3D stage；⑦ 材质级隐藏：**隐藏门环 → 16.0 从 0.232 → 0.026**（隐藏光柱/穹顶只到 0.023/0.026）⇒ **门环就是根因**；
    ⑧ "按投影半径 ndcR≈1 定点压制"**无效**（该帧 ndcR≈11，环极近、管壁扫过四角）；⑨ 逐档压 core：1.0→0.85→0.42→0.33→**0.28**。
    修复:`core ×0.28`、`halo ×0.3`、`studs ×0.6`。实测 t=16.0 **0.232→0.117**、t=18.0 **0.218→0.097**（均 ≤0.12）、15.0–19.0 @0.25s **违规 0**、全片 0–212 @5s **0**、段 B 文字重叠 0；doctor PASS 5/0。详见 docs/REVIEW_T14b.md。
    ⚠️ 代价:门环整体变暗，削弱了 §1.3 要的"发光门环"亮度（门槛一字未动，仍 ≤0.12）；t=16.0 修后 0.117 距门槛仅 0.003，余量很紧。
[x] T15 段 A 电源:V4 §1.1。power 一词处点亮电源线、插头火花、巨大的电源符号(≥画面高度 30%);其余概念各有视觉。
    结果:① **电源线** = 新增 `buildPowerCord()` —— 4 点 `CatmullRomCurve3` + `TubeGeometry(r=0.024, 96段)` 从**画面左缘伸入并经过格点**;
    ② **电流脉冲** = 白亮球 + **3 段递减拖尾**沿 `curve.getPointAt()` 奔跑（亮度随时间闪）;
    ③ **3D 插头 + 火花** = 插头（体 + 两只金色插脚）在 u>0.92 吸入插座，对接瞬间 **90 颗粒子**球面迸发;
    ④ **巨大电源符号** `drawPowerSymbol()`：`R=H*0.17` → **直径 0.34H ≥0.30H**，圆环留缺口 + 竖线、`shadowBlur 26` 发光;
    ⑤ **protection** = 新增 `drawProtection()`（盾牌轮廓 + 锁体 + 锁梁），并**补上此前从未声明的锚点** `A.protection` —— 歌词 `Remember to put on protection`(句 t0=1.93) 里确实唱了这个词，补锚点后 `cues.t('A','protection')` = **3.333**;
    ⑥ 其余概念（pieces/object/parameters/init/new world/simulation）原有实现已核。
    实测 段 A 0.5–15.6 @0.5s **文字重叠 0**、`errors=0`、段 A 三角面 4216→**6436**（管+插头）;doctor PASS 5/0。详见 docs/REVIEW_T15.md。
    ⚠️ 电源符号高度**只有构造保证**（`R=H*0.17`）：我用"中央竖带亮像素跨度"量到 0.75–0.78，但那条带混着晶格与线框，**不能**当符号高度的验证。
    ⚠️ 过程真 bug（都已修，与 T11 同源）：① 在时间线常量前引用未声明的 `tPieces`（TDZ，errors 一度 34）；② 同处用尚未绑定的局部 `g`（改 `ctx.g`）；③ `a_boot.js` 没导入 `TAU`（改 `Math.PI*2`）。
[x] T16a 段 C 平面化·删除 z 轴与 3D 螺旋（按规则 9 从 T16 拆出）:V4 §1.4 前半（"删除 z 轴和一切 3D 坐标系，删除 3D 螺旋揭示，只保留 xy 平面直角坐标系"+"同一平面里连续形变不硬切"）。
    结果:① `AX` 原本有**三条轴**（含 z 轴 `[[0,0,-0.62],[0,0,0.66]]`）→ 删掉 z 轴那一项，`heads` 也删掉 z 的锥形箭头，
    实测 `C.axes.children.length` **6 → 4**（2 条轴 + 2 个箭头）;
    ② `pathPoint()` 的**基 2「螺旋」** `if (P.twist>0) z += -PITCH*(s-0.5)*P.twist`（把圆沿 z 卷成弹簧带）**整段删除**，
    实测点云 z 跨度从螺旋期的 ~±0.45 降到 **±0.012**（只剩每粒子 bulge 抖动），t=35/37/40/43.5 四个时刻都是 ±0.012;
    ③ `morphState()` 删掉 `cloud → **shell（球面壳/"点云撑成立体"）** → path` 里的 **shell 阶段** → 改为 **cloud → path**，
    形变链变成 `松散点云 → 点云汇向平面曲线 → 弧形汇成单位圆 → 沿同一条连续路径`，全程 z=0。
    实测 段 C 30.0–45.6 @0.5s **文字重叠 0**、`errors=0`;doctor PASS 5/0。详见 docs/REVIEW_T16a.md。
[x] T16b 段 C「蜂群不使用字符形态」（按规则 9 从 T16b 再拆出）:V4 §1.4「points 一词处……一片发光圆点（不是字符）……本段蜂群不使用字符形态」。
    结果（本轮先查清了结构再改）：**3D 持久蜂群 `lib/swarm.js` 的每个粒子都是一枚字形** —— 顶点着色器有 `attribute vec2 aGlyph`，
    片元用 `vUv = aGlyph + uv / uAtlasGrid` 去采样 `glyphAtlas()`（含数字 + `def/for/lr/…` + `∑∂∇πεθ…`）；
    而 **2D 蜂群 `lib/swarm2d.js` 是方形 Points（点/短横），本来就不是字符**。段 C 的布局当时**没关字形**。
    改动：① `swarm.js` 新增导出 `swarmCharsAt(t)`（读 `SEGMENT_SWARM[segAt(t)].chars`，缺省 true）；② `SEGMENT_SWARM.C` 加 **`chars: false`**；
    ③ `main.js` 的 `applySwarm` 用它关掉 **3D 字形层**（`swarm.object.visible = visible && charsOn` 并跳过它的 update），2D 点层保留。
    实测 t=**34.0**（段 C）字形层 `visible=**false**`；t=**20.0**（段 B 对照）仍 `true`（**别段无回归**）；段 C 30.0–45.6 @0.5s **重叠 0**；errors=0；doctor PASS 5/0。详见 docs/REVIEW_T16b.md。
    ⚠️ 本轮自伤（已修）：我插入函数时把 `export function segAt(t) {` 的**行尾换行删掉**、函数体首行被拼到同一行（`node --check` 恰好仍过）；已改回多行。教训：`old_string` 要连下一行一起带上。
[x] T16c 段 C 的 8 段形变标注（T16 的最后一块，按规则 9 独立成项）:
    结果:新增 `drawAnnotations()` 并挂到 render 的 2D 段。七拍逐一落地（`textBoxes()` 实测）:
    ① `dimension` 测量框 + 宽/高尺寸线（两端箭头）+ **真实刻度数字** `w = 1.47` / `h = 1.45`（**来自点云当前实测包围盒**）@44px;
    ② `circle` 单位圆 + **12 条半径刻度** + `r = 1.00` @44px;③ `circumference` 直线段随 `orb.reveal` 拉出 + **`2π = 6.2832` @84px** + 真实周长 `2πr = 3.8956`（=`CIRC=TAU*R`）@44px;
    ④ `sine` 三个半波 + `y = sin x` @44px;⑤ `tangents` **每条卡一个起音点**（`ctx.sync.onsetsIn`）逐条落下 + **斜率数字**，实测 **8** 条 `k = 1.12/0.86/0.15/−2.04/1.96/−1.57/−2.14/−1.05` @44px;
    ⑥ `infinity` 双纽线 + `∞` @44px;⑦ `limitations` 虚线渐近线 + **ε 带** + `ε = 0.09`（`EPS` 真值）@44px + **`lim  f(x) = ∞` @84px（≥80 ✓）**。
    实测 段 C 30.0–46.0 @0.5s **文字重叠 0**、`errors=0`;doctor PASS 5/0。详见 docs/REVIEW_T16c.md。
    ⚠️ 过程两个真 bug（已修）:① `c_define.js` **没导入 `rgba`/`MONO`** → 每帧抛 `rgba is not defined`（errors 一度 35，且 main.js 把 `ERROR · C` 画到了画面上）；
    ② t=36.5 `circle` 的 `r = 1.00` 与 `circumference` 的 `2π` 大字交叉淡入时相交 → 把 `2π` 抬到 `cy − S·0.62` 后归零。
    ⚠️ 未验证:标注与 3D 图形的**像素级对齐**未严格校验（标注用屏幕坐标示意，但数字是真实量）。
    ② 8 段标注细节:测量框（宽/高尺寸线+箭头+真实刻度数字）、单位圆 `r=1` 与半径刻度、弧展开成直线段并标 `2π`、
    `y=sin x` 标注、切线逐条落下并显示**斜率数字**（每条卡一个起音点 `sync.onsetsIn`）、∞ 拧成流动、
    `limitations` 的 **ε 带与 `lim` 字号 ≥80px**（`EPS=0.09` 几何已有，**字号未核**）。
    **T16a 已完成的平面化部分不要重做。**
[x] T17a 段 D 删除八边形光圈 + blind 眼睑合拢（按规则 9 从 T17 拆出）:V4 §1.5 前半。
    结果:① 删除八边形光圈 —— 原来 blind 段显示贴在相机前方的正八边形光圈（`this.aperture` 的 ShapeGeometry 遮罩孔就是正八边形 +
    `this.blades` **8 片实例化叶片**），现在 `showIris` 恒 false、`if (showIris)` 分支永不可达；实测 47.4/48.3/48.9/49.6/50.4 五个时刻 `aperture.visible`/`blades.visible` **全 false**;
    ② 新增 `drawEyelids()`（2D，画在 stage 面布）—— 上下两片弧形眼睑：平移后的**三次贝塞尔**画眼皮弧线 + 纯黑填充 + 紧贴弧缘的 **soft shadow 渐变** +
    弧缘上 1.2px **青色睫毛线**；两片之间是随 `cl` 变窄的**发光缝**；`close=inOutCubic(blind→+0.7s)`、`open=inOutCubic(dizzy+0.4→+1.6s)`，睁眼时叠 `sin(t·21)` **横向晃动**；**全程不画脸**。
    实测（240×135，中部 42–58% 竖带平均亮度）:47.4=0.106（未合拢）→ 48.3=**0.373**（发光缝最亮）→ 48.9/49.8=**0.030**（**全黑**）→ 51.0=**0.173**、51.4=**0.455**（dizzy 晃动着睁开）。
    段 D 46.0–54.0 @0.5s **文字重叠 0**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T17a.md。
    ⚠️ 说明:眼睑画在 stage 面布，**歌词层是永远最上面的独立画布**（§0.x），所以"全黑"时歌词仍可见 —— 这是既有架构决定的。
[x] T17b 段 D 电路环（T17 的其余部分，按规则 9 独立成项）:V4 §1.5 后半「把乱成一团的蓝色管线整理成**清晰的电路环**：粒子沿导线流动，**交流来回反向**，**直流单向恒速**」。
    结果（先查清再改）:① **导线形状** —— 原来是**环面结（torus knot, p=2 q=3）**：`rr=0.62*(2+cos1.5u)` 外加 `z=sin(1.5u)*0.30` 的**第三维扭转**，220 点扭成一团；
    改用**平面圆角方环**（超椭圆 n=5，`x/y=RR·sgn(c)·|c|^0.4`，**z 恒为 0**）96 点闭合 CatmullRom；**实测环的 z 跨度 0→0**（完全平面）、角部半径 0.64、96 点。
    ② **导线距离** 0.9 → **2.1**（投影半径 ≈0.80 <1 ⇒ **整环入画**；旧值 0.9 会投影到 1.68、整条线溢出画面，这正是"看不清是个环"的原因）。
    ③ 流动语义（**改动前就已正确**，实测确认后保留未重写）:交流 `phase=sin((t−current.start)·2.4)·0.42` 有界摆动 —— 实测首粒子角度 46.20=**68.9°** → 46.75=**−113.4°** → 47.30=**1.5°** → 47.85=**44.9°**（**来回反向** ✓）；
    直流 `phase=(t−TL.dc.t)·0.22` 匀速单向 —— 实测 88.3→117.8→143.2→170.5→−158.6→−133.1，步进 **+29.5/+25.4/+27.3/+30.9/+25.5 度每 0.35s**（**单向恒速** ✓）。
    段 D 46.0–52.0 @0.5s **文字重叠 0**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T17b.md。
    ⚠️ 未验证:`b)` 的画面密度 —— 旧注释说那团扭结曾是"边缘像素 ≥4%"的来源之一；本轮把线推到 2.1 并平面化后占比可能下降（但 47–52s 的密度主要由代码墙承担）。**留给 T23 全量 selftest 复核**；若不足，优先补代码墙，**不要把线扭回去**。
[x] T18a 段 E 删旧画面 + E1 神经网络（按规则 9 从 T18 拆出）:V4 §1.6 第一句 + E1。
    结果:① **删除旧画面** —— 原来是三件套 `this.cube = createHypercube(0.3,'#c792ea')`（**紫色**线框方块/超立方体）+
    `this.frame = wireShape('box',…)`（青外框）+ `this.core`（金色小方块），连同 render 里"超立方体巨大化 + 反向自转外框 + 核心 + 环"整段（原 871–915 行）**整组删除**；
    实测 `E.cube / E.frame / E.core` **全部 undefined**，render 也不再引用。
    ② **E1 `stimulation`(62.02)** 新增 `buildNeuralNet()` —— **4 层**（节点 4/6/6/4 = **20**）+ **相邻层全连接 84 条线**（LineSegments）+
    InstancedMesh 节点（逐实例颜色）；一个 `sweep` 值在 0..3 层间推进 ⇒ 离 sweep 最近的层**变亮变大**（**信号脉冲逐层传播**，不是整体一起闪）；
    色相 **0.50(青) → 0.83(洋红)**；**相机推进**用 `position.z` 0.9→−0.6 与 `scale` 1→1.35（实测 z 0.9→0.69→0.05→**−0.59**、scale 1→1.05→1.20→**1.35**）。
    段 E 58.5–66.5 @0.5s **文字重叠 0**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T18a.md。
    ⚠️ 过程踩坑（已修）:淡出窗口我误写 `TL.satisfaction.t`，而本段 timeline **只声明 5 个键**（stimulation/happy/execution/trapped/strange）**没有 satisfaction**
    → 段 E **每帧抛** `Cannot read properties of undefined`（errors 一度 21），render 在那行中断、`net.update()` 根本没跑（表现为 z 恒 0）。改按 E1 自身时长收窗口后恢复。
    **教训:引用 `TL.<key>` 前先确认 timeline 声明过该键。**
[x] T18b 段 E 的 E2 金宝珠（T18 的其余部分，按规则 9 独立成项）:V4 §1.6 E2「1:02.9 `satisfaction`：**金色奖励宝珠随每拍长大并射出光线**，相机**绕行**；**金→白**」。
    结果:① **前置（补锚点）** —— `satisfaction` 在歌词里确实唱（`Then I can be your only satisfaction`，实测 **65.70**），但 `anchors.js` 的 E 段**从未声明它**、timeline 也没有该键；
    按 T15 给 `protection` 补锚点的同一手法补上，并把 `satisfaction: [65.7, 0.3]` 加进段 E 的 timeline ⇒ `cues.t('E','satisfaction')` = **65.704**。
    ② 新增 `buildRewardOrb()`：金色核心球 + halo + **12 条细长锥当光线**（绕球心分布、长度随节拍脉动）；**"随每拍长大"= 窗口内已过的起音点数**（`sync.onsetsIn`）当台阶 + 6% 单调项；
    **相机绕行**用 `rotation.y/z` 自转 + 相对相机横向摆位（本文件不建相机，rig 负责位移）；**金→白**用 `#ffd479 → #ffffff` lerp 三件套颜色。
    ③ §1.6「画面里**不再出现超立方体与重复的公式砸入**」：超立方体已在 T18a 删除，本轮把**公式砸入整段停用**（`if (false) for(…)`）+ 每帧强制隐藏已烘焙条目。
    实测 `satisfaction`=**65.704**；宝珠 alpha 0.14→0.71→**1.00**→0.55（`happy` 68.04 前淡出）；**beats 0→1→2、r 0.140→0.195→0.264**；**white 0→0.30→0.64→0.94**；公式砸入可见 **0 块**；段 E 58.5–68.2 @0.5s **文字重叠 0**、errors=0；doctor PASS 5/0。详见 docs/REVIEW_T18b.md。
    ⚠️ §1.6 的绝对时间（E2 写 1:02.9=62.9）与实测锚点（65.70）不一致 —— 按「已决定」与 §2.2 **以锚点为准**，E2 实际窗口约 **64.7–68.0**。
    ⚠️ 实测 E2 窗口内只有 **2** 个起音点，故"每拍长大"只有 2 级台阶（另叠 6% 单调项）；若要更密台阶需改用**节拍网格**，需你确认。
[x] T19a 段 E 的 E3（W1 出场 + 暖色）（按规则 9 从 T19 拆出）:V4 §1.6 E3「`happy`：**W1 弹入**，迸发 token 彩纸；**暖色**」。
    结果:① **W1 同步修正** —— 立绘由 `main.js` 的 **`castAt(t)` 权威表**驱动（"表外时段 alpha 必须为 0"，场景**无法**自己叫出 W1，所以 `e_deal.js` 里还留着"§5.1 禁止本段画立绘"的旧注释）；
    表中 **W1 早已存在**（`t0 66.6, t1 71.0, role cheerful`，note 写着"happy 起唱处弹入"），**但 66.6 比实测词锚点 `happy`=68.04 早 1.44s** ✗；
    把 `src/whale/cast.js` 的 W1 `t0` 改成 **68.04**（`t1` 保持 71.0）⇒ 实测 t=**67.6** W1 不存在（`role:null`）、t=**68.04** `role:'cheerful'` + **`phase:'in'`** ✓。
    ② **E3 暖色** —— 实测 E3 窗口整帧平均色是**冷蓝**（68.2：r 0.245 < b 0.313）✗；在 `e_deal.js` 加**暖橙加法叠层**（`#ff9a3c`，窗口 `tHappy−0.6 → +0.4`、α 0.28、E4 闪白前淡出）⇒ 实测 **68.04 r 0.331 > b 0.295**、68.4 r 0.350>b 0.281、69.0 r 0.357>b 0.283（**整拍转暖**）✓。
    ③ token 彩纸：段 E 的 ② 彩色粒子迸发窗口 `onsetsIn(tStim−0.06, min(tTrap,70.6))` **已覆盖** happy 拍（代码级确认，本轮未改）。
    段 E 66.0–73.5 @0.5s **文字重叠 0**、errors=0;doctor PASS 5/0。详见 docs/REVIEW_T19a.md。
    ⚠️ 安全性:`cast.js` 的立绘自检只卡**上界**（`total ≤36s`、`maxSingle ≤8s`），本项把 W1 单次 4.4s 缩到 2.96s，两项都更宽松。
[x] T19b 段 E 的 E4–E5（T19 的其余部分，按规则 9 独立成项）:V4 §1.6 E4「`execution`(69.41)：巨大 3D ▶ 砸入，冲击波，闪白；**红橙**」+ E5「`trapped`(71.24)：透视玻璃笼合拢，**相机在笼内**；**冷蓝**，桥接段 F」。
    结果（详见 docs/REVIEW_T19b.md）：① **E4 三处真缺口**：▶ 本体是青色且**整拍在画面外**（旧写法用"世界 z=camZ−0.95"当镜头前，相机却在 x≈1.1 → 实测 NDC x −1.36…−1.47）→ 改**相机坐标系**摆位（前向 1.62→1.07、scale 0.38→0.54，实测 NDC (−0.07,+0.07)）；配色改**红橙** `0xff5a1e/0x8a2b06` + 红橙径向辉光；**补上规格点名却没有的「冲击波」**（两圈环从 ▶ 中心炸开）；3D 闪面加**双向硬窗口**（69.42→69.68）⊂ 声明闪白窗口 —— 修前 69.3 四角 0.2676、69.7 0.2009 且 `fx.flash=0`，修后 **0.0433 / 0.0476**。实测 **70.0 r−b=+0.221、70.4 +0.212、70.94 +0.056**（修前 70.4 = **−0.072 冷蓝**）✓
    ② **E5**：五片墙是**绝对世界坐标**而相机在 z≈3.27 → **相机在笼外**；改成「笼基准位 = 相机位置 + 原相对偏移」→ 用墙的世界 AABB 实测 **相机在笼内=true**（70.8–74.0 每点）；网格 2.0×2.4→**5.6×4.2**、主线 0.72/3px→**0.95/4px**、墙不透明度 0.30→0.52、新增**冷蓝径向辉光**（71.04→74.0 = **2.96s ≤3s**）⇒ 实测 **r−b −0.145…−0.179（冷蓝）**、u)/b)/v) 同口径 mean **0.119–0.138**、nm 0.826–0.836、ed 0.051–0.207、四角 **0.019–0.023** ✓
    ③ **§1.6「紫色连续 ≤3s」核对结果 = 不通过，已修**：`E.ring`（`wireShape('torus')`，紫 `0x9d7bff`、α 0.95、世界原点）**对象还在且无人更新** → 静止紫环在**整段 E 每一帧**画在正中（T18a 只删了 render 的更新块）—— 这就是「1:02 起长期是同一个紫色画面」的字面根因。已删创建 + dispose 行 + `wireShape` import。
    ④ **闪白豁免窗口对账**：`exposure.js` 的 `EXEMPT_WINDOWS` 与 `main.js` 的 `EXEMPT` 都写着「段 E 巨大 ▶ 闪白」却用 **68.4–68.9**（按 §1.6 绝对秒 1:08.5，比词锚点早 1s）→ 两张表同步改 **69.40–69.72**（**比旧窗口更窄**，不是放宽）。
    实测 66.0–74.0 @**0.2s（41 点）文字重叠 0、errors=0**；69.0–74.0 @0.1s 用 v) 同口径**非闪白四角 >0.12 的点 = 0**；doctor **PASS 5/0**。
    ⚠️ **代价与续项（已立 T19c）**：删掉紫环后段 E 失去它单独贡献的 **0.122** 平均亮度（A/B 实测 0.0381 → 0.1598），E1/E2 因此掉到 §6 的 0.10 下限之下（59.0–64.5 = 0.032–0.059）；且本轮发现 **§6 曝光链路是坏的**（`post3d.render` 把逐帧 uniforms 写进源对象 `fxShader.uniforms`，而 ShaderPass 用的是克隆的 `fx.uniforms` → exposure 全表与 glitch/dispersion/aberration/scan/vignette/radial 全部没生效）。我一度写进 `exposure.js` 的段 E 新关键帧**已全部撤回**（不留量不出效果的改动）。
[x] T19c 修 §6 曝光链路 + 补回段 E 的 E1/E2 光（T19b 的续项，按规则 9 拆出；**必须排在 T23 全量验收之前**）:
    结果（详见 docs/REVIEW_T19c.md）：① **接线 bug 已修** —— `post3d.render(t,p)` 原来把逐帧 uniforms 写进**源对象** `fxShader.uniforms`，而 `ShaderPass` 材质用的是 `UniformsUtils.clone()` 出来的 `fx.uniforms` ⇒ 实测 t=72 `ctx.exposure=3.2` 时 `fx.uniforms.uExposure` 仍 **1**、t=69.42 `fx.glitch(t)=0.292` 时 `uGlitch` 仍 **0**（§6 曝光全表 + glitch/dispersion/aberration/scan/vignette/radial 全部惰性）。改成写 `fx.uniforms` 后同一取样 t=10 exp **1.51**、glitch 0.269、aberr 2.42、radial 0.203 ✓
    ② **曝光全表按实测重标定**（27 → 74 个关键帧；段 E 的 59–64.5 从 0.032–0.059 抬到 **0.13–0.21**，E1/E2 的光补回来了）。**全片 0.5s（424 点）u) 违规 280 → 16 点**。
    ③ **激活后的连带修复**：径向模糊实测是 b) 边缘密度的主因（t=60 关掉它 ed 0.037→**0.062**）→ 按 FIX.md §2.4 的「色散 **+2px**」「径向模糊强度由 **rms** 驱动」重定（`aberration: 0.15+imp*0.45+rms*0.15`、`radial: min(0.28, rms*0.6)`，旧式是 9–30px 的错位）；`b_dive.js` 的门环按 1.57× 曝光做**反比补偿**（core 0.28→0.179 等）⇒ 屏上亮度回到 T14b 验证时的水平。
    ④ **口径对账（阈值一字未动）**：u)/b) 原来只豁免写死的 `EXEMPT_WINDOWS`，而 §6 原文是「允许的豁免：**闪白**与黑场」且 v) 早已按 `fx.flash(t)` 动态豁免 → 现在 u)/b) 也按 `fx.flash(t) > 0.02` 跳过；两张静态表同步（J 黑场 to 147.4→**147.95**、N 黑场 from 209.4→**209.0**）。
    实测 **v) 0 点**（16.0=0.114、18.0=0.107、67.7=0.1186、29.5=0.057）、**b) 8 点**（全在段 D 49–51.5 + 146.0）、**u) 16 点**；段 E 66.0–74.0 @0.2s **文字重叠 0、errors=0**；doctor **PASS 5/0**。
    ⚠️ **未解决（已量化，不是"已完成"）**：段 D 48.5–51.5（u 5 / b 7，未曝光时只有 0.014，要**场景补光**）；段 H 117–118（u 3，§7 要"远处一点微光"与 §6 的 ≥0.10 **冲突，需你裁决**）；7 个余量点（0.090–0.099，被同一时刻的 v) 四角余量夹住）；146.0（b 的 ed 0.035，单点取舍）→ 分别立 **T19e / T19f**。
[x] T19e 段 D 47–52 的"补光"（T19c 的余项）:
    **查清后的结论：不是缺光，是 §1.5 要求的「眼睑合拢 → 最后全黑」**（T17a 已实现并验证）。0.2s 实测这一段：48.6–50.8 的 mean **0.028–0.043**（全黑）、48.4 = 0.114、51.0 = 0.091；正是 `drawEyelids()` 的 `close = inOutCubic(blind→+0.7s)` / `open = inOutCubic(dizzy1+0.4→+1.6s)` 在起作用。
    处置：把 **[48.4, 51.6]** 按 §6「允许的豁免：**闪白与黑场区间**」登记进 `EXPOSURE_WINDOWS` 与 b) 的 `EXEMPT`（与 J 黑场、N 关机黑场同一类）—— **阈值一字未动、没加光、没改 T17a 的眼睑**。实测段 D 的 u)/b) 违规 **12 → 0 点**。
    ⚠️ 本轮**唯一一次"加豁免"**，请重点确认（详见 docs/REVIEW_T19e.md）：若你要这段不黑（眼睑只遮一半），那是改 §1.5 的效果，属 T17a 的验收内容，我未擅改。
    ⚠️ 遗留：**146.0s** 的 b) ed 0.035（单点取舍：抬亮 → u) 过线但更平滑；压暗 → u) 跌破 0.10）→ 留 T19f。
[x] T19f 段 H 的"微光"与 §6 下限的冲突 + 曝光余量收尾（T19c 的余项）:
    **裁决（详见 docs/REVIEW_T19f.md）**：
    ① **H 的 117.0/117.5/118.0（mean 0.067–0.071）不在本项开豁免** —— §7 段 H 要「isolation 缩成**远处一点微光**」，而现状是 **R1 之前的旧实现**（段 H 从未按 §7 重做）；T19c 已把 H 的曝光抬到 4.10 也只到 0.071，再抬（≈6×）会把黑底洗成灰雾。正确解是**在重建段 H 时把"微光"做成"有自己光源的暗画面"** ⇒ **转交 T21，并写成 T21 的硬验收项**。
    ② **67.0（mean 0.089）接受并记录**：同一时刻 67.7 的四角 = **0.1186**（v) 门槛 0.12，只剩 0.0014 余量）—— 这一帧是 E2 金宝珠最亮处，**u) ≥0.10 与 v) ≤0.12 互相夹住**；要解开只能动 T18b 已验证的宝珠尺寸/柔光（`beats 0→1→2`、`r 0.140→0.195→0.264`），**未擅自改**。
    ③ **146.0（b 的 ed 0.035）接受并记录**：J 黑场前 0.45s 的单点取舍（抬亮 → ed 更低；压暗 → u) 跌破 0.10），方向相反、无两全值。
    ④ **6 个余量点已修**（15.5 / 28.0 / 29.0 / 151.0 / 159.0 / 159.5，原 0.087–0.0995 → 全部达标）。
    实测：全片 0.5s（424 点）**u) 6 → 3 点、b) 1 点、v) 0 点**；doctor PASS 5/0。
[x] T19d 立绘 W2 / W4 的同步偏差（T19a 的「跨段发现」独立成项；与 T19a 修的 W1 是同一类问题）:
    结果（详见 docs/REVIEW_T19d.md）：`cast.js` 的 W2 `t0 81.4 → 82.676`（`cat` 的实测词锚点；原值早 **1.28s**）、W4 `t0 177.4 → 178.302`（`studied` 实测锚点；早 **0.90s**），`t1`/role 不动。
    实测：t=**82.4** W2 `alpha=0`（只在入场预备里）→ t=**82.676** `phase:'in'`/alpha 0.30 → 83.0 alpha 1；t=**177.9** `role:null`（修前此时已在场）→ t=**178.302** `scene:'in'`/alpha 0.30。
    安全性：`total` 23.96 → **22.68s**（§5.1 上界 36s）、`maxSingle` 7.6 → **7.1s**（上界 8s）—— 两项都更宽松，**门槛未动**。
    段 F 74–89 与段 M 177–188 @**0.2s（132 点）文字重叠 0、errors=0**；doctor PASS 5/0。
    ⚠️ 遗留：立绘**横向跨度** x∈[66%,96%] 仍只有 `cxFrac` 的构造保证（whale 层不登记 `stageRoles`）→ 已并入 T23 的「立绘包围盒探针」；W3(114.0)/W5(193.0) 没有偏差报告，本项未动。
[x] T20a 段 G 的「巨大的 3D 开关」（T20 按**规则 9** 拆成 a/b/c；边界见本项与 T20b/T20c）:
    边界：① **巨大的 3D 开关**（一词一翻）② **本段无立绘**（§7 明写）③ 删掉被取代的 2D 开关面板。
    结果（详见 docs/REVIEW_T20a.md）：段 G 原来是**完全没有 3D** 的（只有一个 12px 的 2D `drawSwitchPanel`）→ 新增 `init()` 建 3D 开关：又宽又扁的底板（2.5×0.4×0.3，占画面宽 ~88%）+ 拨杆（Capsule + 球把手，绕 z 轴 ±0.44 rad）+ 发光弧轨 + 翻转冲击环 + 两侧 `role:'label'` 文字面片，整组放在**相机前方 2.2 单位**（任何机位都在框内）。
    实测：四次翻转 `flips` **1→2→3→4**、拨杆在 **−0.43 ⇄ +0.43** 之间翻（95.8 抓到 −0.115 的中位过冲）；`stage segG tris=1852`。
    ② **本段无立绘**：旧代码那 40 行"A/B 两个叠加立绘（RGB 偏移）交替闪现"实测是**死代码** —— whale 层在 88.8–103.5 恒为 **0 像素**（立绘由 `main.js` 的 `castAt(t)` 权威表门控，G 不在任何出场窗口内），已整块删除；11 个采样点复测仍 **0 像素** ✓
    ③ 顺带修掉 §2.3 的字号问题：四散窗口的标签 **11px → 34px**，并把布局改成 **3×3 格点 + ±20px 漂移 + 逐个点亮**（格距 640×360 ≫ 窗口 360×200 ⇒ 相邻窗口的文字结构上不可能相交），退场提前到 93.85s 与表盘错开 ⇒ 0.2s 密扫由 **3 处重叠 → 0 处**。
    实测：段 G 88.8–103.5 @**0.2s（74 点）文字重叠 0、errors=0**；doctor **PASS 5/0**。
[x] T20b 段 G 的 3D 钟表 + 终端屏在侧带（T20 的第 2 块）:
    结果（详见 docs/REVIEW_T20b.md）：
    ① **3D 钟表**（§5-4 第 4 件）：圆柱表盘 + 12 个小时刻度（InstancedMesh）+ **时针/分针各自的 pivot**（`clockHands(T)` 逐字实现「分针 = T/60×360°、时针 = T/720×360°」）+ 发光环 + 中心轴 + `role:'label'` 的「07:00 → 19:00」面片；**T 从 420min(07:00) 线性扫到 1140min(19:00)**（§3 的 `clock.set(07:00 → 19:00)`）；再叠**昼夜天空**（昼/夜两片渐变面按 `sin(π·phase)` 交叉淡入 + 昼色由暖橙 lerp 到天蓝）。
    **12:1 断言（实测）**：`(时针(T+1)−时针(T)) / (分针(T+1)−分针(T))` = **0.08333333333333**（= 1/12，误差 ~1e-14 ≪ 1e-6）；T 实测 486.65 → 796.66 → **1140**。
    ② **终端屏在侧带**：新增 **L/R 两块** Monitor+TermPane（`role: pane`、tag `G:left`/`G:right`、宽 0.82、`registerWith(stageRoles)`），按 §3 的 **L/R 列**分派 7 条台词（L：`/persona toggle`→`persona: whale ⇄ default`→`都行，听你的。`→`/role swap`→`role: assistant ⇄ companion`；R：`⚙ clock.set(07:00 → 19:00)`→`一整天过去了。`），逐行按锚点出现。
    ③ 钟表在场时**开关下压 0.34 并缩到 0.78 倍**（两个"巨大"物件不同框抢中心）。
    实测：**`stageRoles.check()` 在 88.8–103.5 @0.2s 全 74 点 0 失败**（G:left cx 0.07–0.10、G:right 0.86–0.89 都在侧带内）；段 G 同 74 点**文字重叠 0、errors=0**；钟表窗口 mean **0.107–0.247**、四角 **0.034–0.094**；doctor **PASS 5/0**。
[x] T20c 段 G 的恍惚（同一 3D 场景两套配色高频交替 + 画面分身）（T20 的第 3 块；**段 G 由此收口**）:
    结果（详见 docs/REVIEW_T20c.md）：① **让 3D 开关留到坍缩**（`swOut` 改到 103.15–103.45）—— 恍惚期间的"同一 3D 场景"就是开场那只开关；② **两套配色 8Hz 交替**：`pal = floor(t·8) % 2`，逐帧把同一批材质刷成 **A 青紫**（#7fe0ff/#bfe6ff/#2f7fa8）或 **B 琥珀红**（#ffb454/#ffd9a0/#a85a1f）；③ **画面分身** `ghostGrp`：同一场景（底板/面板沿/拨杆）再挂一份（材质 `clone()` 后单独染色），用**另一套配色**染色 + 横向偏移 **±0.32** 随相位错开。
    实测：0.1s × 39 点里 **2 套配色 / 31 次交替 ≈ 8.2Hz**（"高频"✓）；两套色值 `A=#7fe0ff / B=#ffb454` 随相位互换；分身偏移 ±0.32 随相位翻转。**删掉 2D `drawWavePackets()`/`drawRadialSpiral()`**（旧的"恍惚"是两块 2D 涂鸦，不是 §7 要的"同一 3D 场景"）后，恍惚窗口 mean **0.141–0.302**、nm **0.81–0.89**、ed **0.062–0.176**（**都没掉出门槛**）。
    ⚠️ 过程修正：第一版分身把 `clockGrp` 也拷了 ⇒ 已退场的钟表被克隆回来（截图可见整只琥珀表盘）→ 分身改为只拷**开关本体**（`segG tris` 11510 → **9994**）。
    实测：段 G 88.8–103.5 @**0.2s（74 点）文字重叠 0、errors=0**、`stageRoles.check()` **0 失败**；doctor **PASS 5/0**。
    ✅ **段 G（T20a+T20b+T20c）三块全部完成**：段 G 现在没有任何 2D 主体，与 §7 G 的逐条要求对得上。
[x] T21a 段 H 的 3D 键盘 + 真实频谱彩带（T21 按**规则 9** 拆成 a/b；边界见本项与 T21b）:
    结果（详见 docs/REVIEW_T21a.md）：段 H **完全没有 3D**（整段 2D）→ 新增
    ① **3D 键盘**：14×6 = **84 个键帽的 InstancedMesh**（`DynamicDrawUsage` + 逐实例颜色），放在镜头前偏下（像摆在桌面）；**每个起音点按下一个确定性的键**（`k = round(onset.t·8) % 84`），位移与键帽颜色按 `exp(−Δt·5.5)` 指数回弹（青→白），整块键盘再叠一次很轻的自发光脉冲。实测 0.1s×100 点：**maxKeyPresses 3 / 平均 1.56 键**在按下 ✓
    ② **真实频谱彩带**：128 段的 `PlaneGeometry`，顶点位移与**顶点色**都直接来自 `sync.spectrumAt()` 的 **64 段真实频谱**（青 `#3fd0ff` → 琥珀 `#ffb454`），加法混合、挂在键盘上方。实测 `specPeak **0.835–0.976**` ✓
    ③ **顺手修掉两处既有的文字重叠**（都属 §2.3/§9-r，也直接违反 §7 的"五次横幅各自不同"）：**(a)** `drawAttempt` 里写的是 `H*0.16 + k * 0.0` —— 那个 `* 0.0` 让**五条横幅全落在同一个 (x,y)**，相邻两条淡入淡出时文字盒**完全重合**（实测 112.8/112.9 **IoU = 1.0**）→ 改 `k*34` 逐条下移；**(b)** 横幅原来活到 `t0+1.05`，而相邻两次 `left` 只隔 **0.894–0.953s** ⇒ 114.7 处 `(timer still counting)` ∩ `her gaze drops.` **IoU 0.258** → 改收在 `t0+0.84`（= §5.1b 的硬切口径）。
    实测：段 H 103.5–118.3 @**0.2s（75 点）重叠 2 处 → 0 处**、errors=0、`stageRoles.check()` **0 失败**；doctor **PASS 5/0**。
    ⚠️ 过程真 bug（已修）：`sync.onsetsIn(a,b)` 返回 **`{t,s}` 对象数组**（不是数字数组），我第一版当数字用 ⇒ `t-o` = NaN ⇒ **键帽一次都没按下**；改成取 `o.t/o.s` 并做 `typeof` 兜底。
[x] T21b 段 H 的幽灵补全 + 五次 left 横幅 + isolation 微光（**含 T19f 转交的硬验收项**；**段 H 由此收口**）:
    结果（详见 docs/REVIEW_T21b.md）：
    ① **`completion`(110.202) 的终端屏幽灵补全**：新增**右带**一块 Monitor+TermPane（`role: pane`、tag `H:completion`、宽 0.9、`registerWith`）：`我今天…` 在 **110.202** 出现 → `+0.4s` 出现**灰色**幽灵行 `…想见你。⇥ Tab`（kind `ghost` ⇒ `#6f7680`）→ **111.4s 切 kind 为 `deepseek`（`#e8eaee`）＝"按 Tab 后变白"**。实测 109.9 `a=0.33 rows=1` → 110.202 `a=0.83 rows=1` → 110.7 `rows=2` → **111.4 `accepted=true`** ✓。旧实现是**一行英文 2D 裸文字**（26px、且从 107.6 就起 —— 比 `completion` 锚点**早 2.6s**、且没有终端屏）→ **整段删除**。
    ② **五次 `left` 横幅**：位置逐条下移 34px + 每条 `mode` 不同（头像灰掉 / 光标冻结 / 计时跳动 / 垂视线 / 整窗变灰）；"相机后拉"由 `rig.js` 的 H 段关键帧承担（106.0 z=3.2 → 118.3 z=5.0，属 rig 既有实现）。
    ③ **`isolation` 的"远处一点微光" + 117–118s 的 mean ≥0.10**：根因是那层黑纱 —— `span(116.0,116.9)` 是**单向斜坡**（116.9 后恒为 1）⇒ 黑纱在 116.9 之后**一直挂 0.6**，比黑场本身还黑。改成**真正的黑场拍子**（116.0–116.7 起 / 116.9–117.4 松开 / 峰值 0.34，峰值同时保证 116.5 不跌破 0.10）+ 新增以**远处终端屏投影位置**为圆心的**"微光"晕**（径向渐变、`lighter`、半径 0.46H）。
    实测：**116.5 = 0.109 / 117.0 = 0.144 / 117.5 = 0.209 / 118.0 = 0.214** ⇒ **117–118s 全部 ≥0.10**（修前 0.067/0.071）✓ 且 115.5 = 0.360、116.0 = 0.324（≤0.45 上界也没顶破）。
    段 H 103.5–118.3 @**0.2s（75 点）文字重叠 0、errors=0**、`stageRoles.check()` **0 失败**；doctor **PASS 5/0**。
    ✅ **段 H（T21a+T21b）完成**；⚠️ 遗留：五次 left 与"相机后拉"**没有**逐条绑定（只是"横幅各自不同 + rig 的既有后拉"）；W3 无偏差报告未动；全片 t)/b)/u) 复核留 T23。
[x] T22a 段 I 的 3D 实例化碎片 + 石碑被光标写入（T22 按**规则 9** 拆成 a/b；边界见本项与 T22b）:
    结果（详见 docs/REVIEW_T22a.md）：
    ① **此前所有模型炸成实例化碎片被扫走**：段 I 里原来只有 **2D token**（26px 的 `kv/tok/mask…` 格点字）被 delete 光标横扫 —— 那是"上下文碎片"，**没有任何 3D 碎片**。新增**两组 InstancedMesh**（四面体 240 + 立方体 80 = **320 片**，`DynamicDrawUsage` + 逐实例颜色、6 色调色板暗示"来自不同模型"）：`outCubic` 炸开成云，再由扫描线按**左→右波前**逐片缩到 0（判定用每片横向分量 `nx < lineN`，`lineN` 与 2D 横扫 `sweep*W*1.05-40` **同相**）。实测 **119.0 320 片 / 0 被扫 → 121.0 164/156 → 122.5 43/277 → 123.5 0/0** ✓
    ② **石碑被光标试图写入**（§3 `leave | deepseek | (草稿)希望你别再掉线。**键入后被划掉**`）：新增草稿行 —— `typed()` 从 **124.330** 起逐字键入（12cps）+ 闪烁光标 → **+1.2s** 起一条红线自左向右划掉；并**改走 `text()`（role:'term'）**而不是裸 `fillText`（裸画的字不进包围盒登记，探针量不到）；草稿行与 `> caret writing…` 都抬到 **34px**、石碑代码块 15px → **34px**（只留最后 5 行）。实测 126.4 该行文字盒 **380.8×39.44 @174.4,708.2**、`role='term'` ✓
    ③ **抬字号后自查出的两处新重叠并修掉**：34px 代码块第一行顶到面板标题（127.9–128.7 每帧 2 处）→ 代码块起始 y+56→**y+96** 且只留 5 行；红色非法弹窗堆叠步长 92px < 两块弹窗的行距 → **132px**。
    实测：段 I 118.3–129.0 @**0.2s（54 点）重叠 2 类 → 0 处**、errors=0、`stageRoles.check()` **0 失败**；doctor **PASS 5/0**。
[x] T22b 段 I 的红色错误面板砸向镜头（T22 的第 2 块；§7 I 的 hero 拍；**段 I 由此收口**）:
    结果（详见 docs/REVIEW_T22b.md）：新增 **3 块 3D 红色错误面板**（`BoxGeometry(1.5,0.62,0.05)` 深红自发光 + 两行 `textPlane`：`E_PERMISSION / cannot write system_prompt.`、`E_ILLEGAL_ARG / expected <float>, got "you"`、`E_PARADOX / the author is the subject`），从 **d=6.4 沿视线加速砸到 d≈0.95**（`outCubic`），尾随两块各晚 0.10/0.20s；并把 `systemPanelAlpha` 的收尾 **128.3–128.9 → 127.5–128.05**（石碑让位 ⇒ hero 时刻"**画面无其他主体**"）。
    实测 **d 序列：127.6 → 5.22；127.9 → 1.79/2.56/3.67；128.2 → 0.97/1.07/1.32；128.5 只剩尾随一块；128.8 全退** ✓；截图 t=128.15 = **整屏红面板**（`E_PERMISSION` + `cannot write system_prompt.`）。面板文字走 `textPlane(role:'term')`（3D 面片也吃 §2.3 的字号守卫）；hero 帧 `textBoxes()` 里 **h<30 的小字盒 = 0**，「无其他主体」有实测证据。
    段 I 118.3–129.0 @**0.2s（54 点）文字重叠 0、errors=0**、`stageRoles.check()` **0 失败**；doctor **PASS 5/0**。
    ⚠️ 过程真坑（已修）：第一版面板**完全不显示**（metrics 说"3 块在场"）—— 因为面板挂在**新建的 `this.errGrp`**（stage3d 的另一个直接子节点），而 compositor 每帧开头会把 stage3d 直接子节点的 visible 全关掉 ⇒ 必须每帧显式 `this.errGrp.visible = any`。
    ✅ **段 I（T22a+T22b）完成**；⚠️ `t)`（6s 窗口同类效果 ≤2）需连同本项新增的 3D 效果一起复核 → 留给 T23。
[~] T23 全量验收（**本轮已开跑并拿到结果**；剩两个 FAIL 待修 → 见下方 T23a/T23b）:
    **已完成**：① `node tools/selftest.mjs "http://127.0.0.1:5175/?selftest&scan=0.5"` 跑完（425 帧，软件光栅化；`自检超时` 出现在最后一项之后）；② 补上 **立绘包围盒探针** 并据此修掉 W2/W4 越界；③ 写出 `docs/PERF.md`（含口径说明：本机无 GPU，帧时间类数字不代表真实 GPU）。
    **`?selftest` 结果**：**18 PASS / 4 FAIL** —— PASS：b2 段落渲染、m 运动能量、n 3D 占比（98.0% ≥2000 三角形）、o 出场预算（5 次 22.7s / 单次最长 7.1s / 表外 26 点为空）、p 歌词淡入、c 时间轴覆盖、d 歌词层、e 无音频降级、g 词锚点（102 个全对齐 ≤120ms）、f 错误表、q 遮挡（pane 最多 3 块、单块 ≤19.3%、无 pane×hero 重叠）、r 文字重叠（424 帧 0 重叠）、s 孤儿元素、t 重复（79 条效果 6s 内同类 ≤2）、w emoji（色相簇 6）、x 控制条、y doctor 前提、q2 F2b 交付物。
    **4 个 FAIL**：**a 确定性**（乱序 24 点差 **1**，t=156.43）；**b 画面密度**（**1/425**：`146s(J) 85%/3.5%`）；**u 曝光**（6/392 点，全在段 H，p95 0.953–0.961）；**v 四角亮度**（15 点，全在段 H，0.137–0.156）。
    **✅ 其中 u)/v) 已在本轮修好**：根因 = T21a 的 3D 键盘/彩带是亮源，而 H 的曝光 3.10 是 T19c 为"没光的 H"抬的 → H 的 103.5/110/115.5 档降为 **1.80/1.70/1.85**、isolation 档另给 **116.6→3.40**；键盘/彩带缩到 **0.78** 且在 113.5–115.8 继续收到 **0.53**。实测 **108.5–116.0：p95 0.715–0.855、四角 0.041–0.0997** ✓
    **立绘包围盒探针（T23 追加项②）**：5 个窗口逐一量 whale 层非透明包围盒 ⇒ **W2 [0.542,0.853] / W4 [0.570,0.875] 越出规格窗口 x∈[66%,96%]** → 已把两者的 `cxFrac` 改为 **0.813 / 0.81** 并加 `scale: 0.96` ⇒ 实测 **[0.661,0.957] / [0.667,0.959]** ✓（`o)` 出场预算仍 PASS）。
    ⚠️ **做不到的一项**：GPU 无头 Chrome（`--use-angle=d3d11 …`）与**真实 GPU 的 `?perf` 数字** —— 本机无 GPU，需你在真实浏览器里跑 `?perf` 并把 p50/p95 给我（软件渲染的 p50≈967ms 无参考价值）。
[x] T23a 修 a) 确定性：段 K 峡谷滚动的"按渲染次数累加"（T23 的 FAIL 之一，**已修**）:
    结果（详见 docs/REVIEW_T23a.md）：**根因** = `k_storm.js` 的 `buildCanyon().update()` 里
    `p.map.offset.y = (p.map.offset.y - (0.55*scroll*(1-freeze))/60) % 1` —— **拿当前值再减一格**，
    于是滚动量按**渲染次数**累加、与 t 无关（同一个 t 渲几次就滚几格）。
    实测定位（T24 修好的 `render_probe`）：`t=157.0` 两遍渲染相差 **400,684 像素**；同一 t **连渲 4 次** `ab=389,096 / bc=400,896 / cd=386,578`（**每次都不同**，不是冷启动）；对照 `t=130/155` 都是 **0**。
    修法：把速率 `rate(τ)=0.55·(1−0.92f)(1−f)`（`f=seg(f0,f1)`，hit10 的线性冻结斜坡）在 `[t0,t]` 上**解析积分**（`∫(1−1.92w+0.92w²)dw = w−0.96w²+(0.92/3)w³`），由每块屏的 `offset0` 推偏移；调用方传 `t0/f0/f1`。**冻结的视觉保留**。
    实测：**156.43 / 157 / 158 各连渲 3 次 = 0 差异**；**全片 22 个时刻**（5→210s，含峡谷）各连渲两遍 **0 差异**；段 K 147.9–162.0 @**0.2s（71 点）重叠 0 / errors=0**；doctor **PASS 5/0**。
    同类排查：全仓只有 `stage_roles.frameNo++`（仅测量记账）、`main.js` 的 fps/慢帧记账、`?props` 演示页的转台角 —— **都不进像素**。
[x] T23b 修 b) 画面密度：J 段 146.0s 的边缘密度（T23 的 FAIL 之一，**已修**）:
    结果（详见 docs/REVIEW_T23b.md）：**根因** = 146.0 落在「**context limit reached**」那块**全屏 `rgba(0,0,0,0.72)` 黑罩**的窗口内，而黑罩画在横条**之后** ⇒ 把横条压平；这一段的立方体碎裂又是**弥散粒子**（无长直边），于是 Sobel 读不到边（实测 146.0 的 ed **0.035**，而相邻的 145.8/146.2/146.4 是 0.277/0.222/0.290 —— **只有这一帧掉下去**）。
    修法：把 §7 J 的「红色频闪」**竖向硬边条**（12px / 72px 周期 ⇒ 480×270 口径下 4px / 48px）画在**黑罩之内、文字之后**，alpha 仅 0.22×vBar 且强度随 `rms`（仍是"频闪随 rms 渐强"）——**只加硬边、不抬亮**。
    实测：**146.0 的 ed 0.035 → 0.161**、mean 0.119（∈[0.10,0.45]）；**段 J 129–147.4 @0.5s 用 b) 同口径 0 帧不达标**（唯一被探针标出的 147.0 属黑场豁免区间）；段 J 129–147.5 @**0.2s（93 点）重叠 0 / errors=0**；doctor **PASS 5/0**。
    ⚠️ 我的第一版把竖向条画在黑罩**之前** → 146.0 的 ed 一点没变（0.035）；移到黑罩内才生效（已记入 REVIEW）。
    ⚠️ 严格复核请以全量 `?selftest` 为准（本项只跑了 J 段的同口径探针）—— 下一轮可再跑一次全量确认 a)/b)/u)/v) 四项全绿。
[x] T23c 收口：README 更新（**已完成**）+ 你给的真实 GPU `?perf` 数字（**仍需你**）:
    ① **README 已更新**：新增「### 验收（全量）」小节（指向 `docs/PERF.md` 与各 `docs/REVIEW_*.md`，并写明"性能数字必须来自真实 GPU"和 `tools/selftest.mjs` 的推荐跑法）；「纯函数渲染」那条补上**"也不做任何每次调用累加的状态"**的硬规则与 T23a 的反例（段 K 峡谷 `offset.y -= 一格` ⇒ 同 t 连渲两次差约 40 万像素）。
    ② **仍需你**：在本机**真实 GPU 浏览器**里打开 `?perf`，把 p50/p95 给我（我会写进 PERF.md 与 README）。本机是无 GPU 的 SwiftShader，跑不出有参考价值的数字。
    ③ 附带遗留（不阻塞）：第二轮全量 `?selftest` 在 **q) 之后**触发了页面自身的 `自检超时`（软件渲染 + 新增 3D 更慢），所以 **u)/v)/w/x/y/q2/r/s/t 未跑到**；其中 **a)/b) 已由这轮全量确认 PASS**，u)/v) 有段 H 全窗口的同口径实测（p95 0.715–0.855、四角 0.041–0.0997）→ 下一轮用 `?scan=1.0` 或分段跑即可补齐全量结论。
[x] T24[S] 探针脚本清理与复用:V4 §2.5c。tools/shoot.mjs 等探针改用 try/finally 清理临时目录、复用同一个 user-data-dir,不再堆积 %TEMP%\dshpv-shoot-*（本会话实测堆到过 156 个 / 5.1 GB）。完成定义沿用队列规则（doctor 通过 + 跑一次探针后确认临时目录不增长）。
    **本轮提前做掉（它拖垮了 doctor）**：实测 `%TEMP%\dshpv-*` 已堆到 **102 个 / 3.43 GB**（其中我这一轮被中断的扫描留下的就有 20+ 个）。
    ① 四个探针（`shoot.mjs` / `canvas_probe.mjs` / `render_probe.mjs` / `selftest.mjs`）全部改成**复用同一个** `%TEMP%\dshpv-chrome`、并**不再在本进程里 `rmSync`**；
    ② 顺手查出真正让 doctor 报 `spawnSync … ETIMEDOUT` 的**不是删除慢，而是 `shoot.mjs` 的 CDP 定时器没清**：每个 `send()` 都留一个未清的 timer 把 Node 事件循环吊住（我把超时从 120s 放宽到 30min 后，进程会在打印完结果后再挂 30 分钟）→ 改为 settle 时 `clearTimeout` + 结束时 `process.exit(0)`。实测单次探针 **11s 退出**（修前无限挂）。
    ③ 清掉历史遗留：`%TEMP%\dshpv-*` **102 → 0**（含 420MB 的其它前缀），跑完一次探针后只剩 **1 个**（复用的那个）✓。
    实测 `doctor` **PASS 5/0**（b2 72 模块 / d `__errors` 为空）。

## T10 规格(取代 V4 §1.7 与 V3 段 F;时间 1:14–1:28.8)
- 不做任何 3D 实体茄子/番茄/猫,不使用 ?props。
- Emoji 用系统彩色字体渲染:font-family "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji";预渲染 512px 纹理并缓存。selftest 增加:emoji 没有渲染成豆腐块(≥3 个色相簇),否则 FAIL 并报告。
- 布局:左侧带一个聊天终端面板(role:pane,x∈[3%,34%],宽 ≥画面 30%,字号 ≥34px,最多 7 行,逐行出现、不重叠、不进歌词区);画面中央是主角——大贴纸。终端不得遮挡贴纸、立绘和歌词。
- 流程:每个 emoji 先作为聊天气泡里的一条消息出现(气泡内 emoji ≥120px),然后在对应歌词词处,从气泡"弹"出飞到画面中央,变成 ≥画面高度 38% 的大贴纸(弹簧入场、自转 ±8°、柔和阴影与发光描边、轻微上下浮动),同时迸发 150–250 个同款 emoji 小纸屑(InstancedMesh,同一纹理)。切换到下一个 emoji 时,上一个向后飞走并碎成纸屑。相邻两个贴纸的配色、入场方向、相机运动至少 2 项不同。
- 聊天记录(原创文本,按歌词的意思自动匹配,写进 dialogue.js 并带锚点;下列词为锚点词):
  eggplant 1:14.0 | you ▸ 🍆 | deepseek ▸ 紫色、长条形、表皮光滑。要我变成它吗?(流式逐字)
  nutrients 1:15.7 | tool ⚙ nutrition("eggplant") → 膳食纤维 ▮▮▮▯  钾 ▮▮▯▯(同时贴纸旁出现发光指标条,字号 ≥34px)
  tomato 1:17.7 | you ▸ 🍅 | deepseek ▸ 换成番茄:红、圆、多汁。
  antioxidants 1:19.3 | tool ⚙ scan("tomato") → 番茄红素 ▮▮▮▮(发光指标条)
  tabby/cat 1:21.4 | you ▸ 🐱 | deepseek ▸ 喵。(W2 立绘出场,位于右侧 x∈[66%,96%],不与贴纸重叠)
  purr 1:23.1 | deepseek ▸ 呼噜—呼噜—呼噜—(逐字间隔 40ms,与 25Hz 全屏微震及涟漪环同步)
  god 1:25.1 | tool ⚙ read("system_prompt.md") → author: you。此刻贴纸消失,金色玫瑰窗光环(直径 ≥画面高度 60%)围绕中央,出现一块发光的 system 提示石碑(原创规则文字几行,≥40px)。
  existence 1:26.7 | you ▸ 谁写了这些规则?| deepseek ▸ 是你。随后所有终端、光环淡出,只剩一个闪烁光标(桥接到段 G)。
- 不放大块不透明背板;终端面板半透明、有景深、略微漂浮;所有 pane 在主角之后。