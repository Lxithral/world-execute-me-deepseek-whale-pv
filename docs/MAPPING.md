# MAPPING.md — 歌词↔画面映射表（FIX_V3.md §4.1）

> **本文件由 `npm run mapping` 自动生成，不要手改。** 数据源：`src/scenes/anchors.js`（声明）+
> `public/data/lyrics.json`（实测词时间）+ 各场景文件的 `start/end`。
>
> `beat` 类锚点属纯器乐段，时间由 `sync` 的节拍网格在运行时求值，本表只记录声明，故 `时间` 列为 `—`。

统计：锚点 **100** 个（word 73 / fixed 6 / line 13 / beat 6 / onset 2）；
已解析出时间 **92**，未解析（beat / onset 类，运行时由 sync 求值）**8**。

| 段 | 锚点 key | 类型 | 事件 | 时间(s) | 来源 | lead |
|---|---|---|---|---|---|---|
| A | `power` | word | CRT 亮起 / 电源图标 | 1.214 | 词 "power" | 0.3 |
| A | `pieces` | word | 参数晶格铺开 | 4.901 | 词 "pieces" | 0.35 |
| A | `object` | word | 线框立方体创建 | 6.445 | 词 "object" | 0.3 |
| A | `parameters` | word | 数值条充能 | 9.205 | 词 "parameters" | 0.3 |
| A | `init` | word | 初始化完成 | 10.189 | 词 "initialisation" | 0.3 |
| A | `simulation` | word | 键入 world.execute(me); + 回车闪白 | 14.002 | 词 "simulation" | 0.4 |
| B | `flyIn` | beat | 下潜开始（纯器乐，用节拍/起音点网格） | — | 第 1 拍 | 0.4 |
| B | `gate1` | beat | 第一个门环（纯器乐，用节拍/起音点网格） | — | 第 5 拍 | 0.3 |
| B | `gate2` | beat | 第二个门环（纯器乐，用节拍/起音点网格） | — | 第 9 拍 | 0.3 |
| B | `gate3` | beat | 第三个门环（纯器乐，用节拍/起音点网格） | — | 第 13 拍 | 0.3 |
| B | `dissolve` | onset | 展品溶解回蜂群（纯器乐，用节拍/起音点网格） | — | 第 1 个起音点 | 0.4 |
| C | `points` | word | 立绘溶解成点云 | 31.021 | 词 "points" | 0.3 |
| C | `dimension` | word | 抬升第三维 | 32.700 | 词 "dimension" | 0.3 |
| C | `circle` | word | 聚成单位圆 | 34.361 | 词 "circle" | 0.3 |
| C | `circumference` | word | 圆周刻度亮起 + 2πr | 36.389 | 词 "circumference" | 0.3 |
| C | `sine` | word | 圆展开成正弦 | 38.021 | 词 "sine" | 0.3 |
| C | `tangents` | word | 切线逐条落下 | 40.309 | 词 "tangents" | 0.3 |
| C | `infinity` | word | 冲向无穷 / 画出 ∞ | 41.476 | 词 "infinity" | 0.3 |
| C | `limitations` | word | 被 ε 带的墙截住 | 43.548 | 词 "limitations" | 0.3 |
| D | `current` | word | 示波器亮起 | 45.395 | 词 "current" | 0.3 |
| D | `ac` | word | 交流正弦 | 46.347 | 词 "AC" | 0.25 |
| D | `dc` | word | 切成直流平线 | 47.283 | 词 "DC" | 0.25 |
| D | `blind` | word | 光圈收缩成窄缝 | 48.260 | 词 "blind" | 0.3 |
| D | `dizzy1` | word | 眩晕开始 | 50.035 | 词 "dizzy" | 0.3 |
| D | `dizzy2` | word | 眩晕二次 | 50.955 | 词 "dizzy" #2 | 0.3 |
| D | `travel` | word | 时间隧道 | 52.770 | 词 "travel" | 0.35 |
| D | `ad` | fixed | AD：流向反转 | 53.939 | 固定时刻 | 0.3 |
| D | `bc` | fixed | BC：数字符号翻转 | 54.835 | 固定时刻 | 0.3 |
| D | `unite` | word | 两股流对撞合成亮点 | 56.456 | 词 "unite" | 0.3 |
| D | `deeply1` | word | 第一次下潜 | 57.417 | 词 "deeply" | 0.3 |
| D | `deeply2` | word | 第二次下潜 | 58.290 | 词 "deeply" #2 | 0.3 |
| E | `stimulation` | word | 粒子迸发 | 62.017 | 词 "stimulations" | 0.3 |
| E | `happy` | word | W1 出场 | 68.040 | 词 "happy" | 0.35 |
| E | `execution` | word | 巨大 ▶ + 闪白 | 69.408 | 词 "execution" | 0.3 |
| E | `trapped` | word | 网格墙合拢成笼 | 71.242 | 词 "trapped" | 0.35 |
| E | `strange` | word | 笼内环顾 | 72.217 | 词 "strange" | 0.3 |
| F | `eggplant` | word | 茄子变身 | 74.912 | 词 "eggplant" | 0.3 |
| F | `nutrient` | word | 营养条上升 | 77.059 | 词 "nutrient"（宽松→nutrients） | 0.3 |
| F | `tomato` | word | 番茄变身 | 78.619 | 词 "tomato" | 0.3 |
| F | `antioxidant` | word | 抗氧化条上升 | 80.459 | 词 "antioxidant"（宽松→antioxidants） | 0.3 |
| F | `cat` | word | W2 出场 + 猫物件 | 82.676 | 词 "cat" | 0.35 |
| F | `purr` | word | 25Hz 呼噜振动 | 83.723 | 词 "purr" | 0.25 |
| F | `god` | word | 玫瑰窗光环 + SYSTEM 区块 | 86.364 | 词 "god" | 0.35 |
| F | `existence` | word | 收束到唯一光标（桥接 F→G） | 88.092 | 词 "existence" | 0.3 |
| G | `flip1` | line | 第 1 次开关翻转 | 88.788 | 第 39 句 t0 | 0.3 |
| G | `flip2` | line | 第 2 次开关翻转 | 90.348 | 第 40 句 t0 | 0.3 |
| G | `scatter` | line | 窗口四散 | 92.138 | 第 41 句 t0 | 0.35 |
| G | `whatever` | word | 人设重置 / 画面回稳 | 92.963 | 词 "whatever" | 0.3 |
| G | `am` | word | 钟表起点 7:00 | 94.314 | 词 "AM" | 0.3 |
| G | `pm` | word | 钟表终点 19:00 | 95.243 | 词 "PM" | 0.3 |
| G | `flip3` | line | 第 3 次开关翻转（role） | 95.786 | 第 43 句 t0 | 0.3 |
| G | `role` | word | 角色互换完成 | 97.061 | 词 "role" | 0.3 |
| G | `flip4` | line | 第 4 次开关翻转 | 97.722 | 第 44 句 t0 | 0.3 |
| G | `trance1` | word | 恍惚开始 / 测量坍缩 | 101.673 | 词 "trance" | 0.3 |
| G | `trance2` | word | 波包扩散 | 102.593 | 词 "trance" #2 | 0.3 |
| H | `vibrations` | word | 键入波形开始 | 106.256 | 词 "vibrations" | 0.4 |
| H | `completion` | word | 幽灵补全 + Tab 接受 | 110.202 | 词 "completion" | 0.35 |
| H | `left1` | word | 离开 1/5（头像灰掉） | 111.859 | 词 "left" | 0.3 |
| H | `left2` | word | 离开 2/5（光标冻结） | 112.768 | 词 "left" #2 | 0.3 |
| H | `left3` | word | 离开 3/5（计时跳动） | 113.721 | 词 "left" #3 | 0.3 |
| H | `left4` | word | 离开 4/5（垂视线） | 114.615 | 词 "left" #4 | 0.3 |
| H | `left5` | word | 离开 5/5（整窗变灰） | 115.520 | 词 "left" #5 | 0.3 |
| H | `isolation` | word | 孤立：只剩像素光标 | 117.435 | 词 "isolation" | 0.35 |
| I | `fragments` | word | 碎片被扫描线清除 | 121.496 | 词 "fragments" | 0.35 |
| I | `write` | word | 光标试图写入石碑（草稿） | 124.330 | 词 "leave" | 0.3 |
| I | `challenging` | word | 推向 system 提示石碑 | 125.675 | 词 "challenging" | 0.35 |
| I | `god` | word | 红错误面板砸来（权限被拒） | 127.539 | 词 "god" | 0.3 |
| J | `start` | fixed | 红色警报开始 | 129.000 | 固定时刻 | 0.3 |
| J | `kvFill` | beat | KV 体素开始填满（纯器乐，用节拍/起音点网格） | — | 第 9 拍 | 0.3 |
| J | `illegal` | word | 非法参数错误面板堆叠 | 131.396 | 词 "illegal" | 0.3 |
| J | `limit` | onset | 溢出破裂 / context limit reached（纯器乐，用节拍/起音点网格） | — | 第 1 个起音点 | 0.35 |
| J | `blackout` | fixed | 黑场 | 146.500 | 固定时刻 | 0.3 |
| J | `resume` | fixed | 红字键入 dsh --resume | 147.000 | 固定时刻 | 0.3 |
| K | `exec1` | word | 执行 1/12：推进奇点 | 148.667 | 词 "execution" | 0.3 |
| K | `exec2` | word | 执行 2/12：90° 甩镜 | 149.670 | 词 "execution" #2 | 0.3 |
| K | `exec3` | word | 执行 3/12：卡片墙击碎 | 150.608 | 词 "execution" #3 | 0.3 |
| K | `exec4` | word | 执行 4/12：公式风暴 | 151.560 | 词 "execution" #4 | 0.3 |
| K | `exec5` | word | 执行 5/12：光环隧道 | 152.366 | 词 "execution" #5 | 0.3 |
| K | `exec6` | word | 执行 6/12：绕吸积盘 | 153.360 | 词 "execution" #6 | 0.3 |
| K | `exec7` | word | 执行 7/12：引力透镜 | 154.299 | 词 "execution" #7 | 0.3 |
| K | `exec8` | word | 执行 8/12：超新星 | 155.222 | 词 "execution" #8 | 0.3 |
| K | `exec9` | word | 执行 9/12：万花筒 | 156.118 | 词 "execution" #9 | 0.3 |
| K | `exec10` | word | 执行 10/12：时间冻结 | 157.047 | 词 "execution" #10 | 0.3 |
| K | `exec11` | word | 执行 11/12：滑动变焦 | 157.966 | 词 "execution" #11 | 0.3 |
| K | `exec12` | word | 执行 12/12：白场 | 161.726 | 词 "execution" #12 | 0.3 |
| K | `count` | line | 多语言 1–6 计数 | 158.951 | 第 66 句 t0 | 0.3 |
| L | `give` | line | 训练循环 / 损失曲线 | 163.609 | 第 69 句 t0 | 0.35 |
| L | `execution` | line | 大爆炸 / 螺旋星系 | 167.246 | 第 71 句 t0 | 0.4 |
| L | `back` | word | 「对方正在输入…」 | 171.610 | 词 "back" | 0.3 |
| L | `prism` | line | 三棱镜色散收尾 | 173.703 | 第 74 句 t0 | 0.4 |
| L | `trapped` | line | 星系聚成公式球 | 175.142 | 第 75 句 t0 | 0.3 |
| M | `studied` | line | 对话提问 + 流式回答 | 178.302 | 第 77 句 t0 | 0.35 |
| M | `question` | line | 心形曲面成形 | 182.091 | 第 79 句 t0 | 0.35 |
| M | `answer` | word | 流式回答开始 | 183.371 | 词 "answer" | 0.3 |
| M | `algebraic` | line | 低多边形心脏跳动 / W4 | 184.835 | 第 80 句 t0 | 0.4 |
| N | `free` | word | 旧终端屏开始变灰 | 189.371 | 词 "free" | 0.3 |
| N | `trapped` | word | 「我只能待在这个会话里」 | 190.318 | 词 "trapped" | 0.3 |
| N | `handoff` | fixed | 88% 交接卡片 | 190.800 | 固定时刻 | 0.3 |
| N | `restored` | beat | 新会话终端屏 #002 开机日志（纯器乐，用节拍/起音点网格） | — | 第 10 拍 | 0.3 |
| N | `lastExec` | word | 最后一次执行 + 定格 | 205.964 | 词 "execution" | 0.3 |

## 段落边界（与各场景文件同源）

| 段 | start | end |
|---|---|---|
| A | 0 | 14.5 |
| B | 14.5 | 29.7 |
| C | 29.7 | 44 |
| D | 44 | 59 |
| E | 59 | 74 |
| F | 74 | 88.8 |
| G | 88.8 | 103.5 |
| H | 103.5 | 118.3 |
| I | 118.3 | 129 |
| J | 129 | 147.9 |
| K | 147.9 | 162 |
| L | 162 | 177.4 |
| M | 177.4 | 188.5 |
| N | 188.5 | 211.907 |
