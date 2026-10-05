# REVIEW T43 — 段 B/C（FIX_V5 §B/C：0:26 / 0:33 / 0:35 / 0:36 / 0:38 / 0:42）

| 词 | 事件 | 对象（改动处） |
|---|---|---|
| 0:26 | 删红色爱心与其下方「扇形」（= 心下的 CircleGeometry 泛光片 + ConeGeometry 光柱）；段 B 不再有心形 | `src/scenes/b_dive.js` 的 PLAN 槽位 / BUILD 分派 / `EX_NAMES.heart` / `buildHeart()`（整段删除，留 T43 注释） |
| 0:33 | 删测量框 + 宽高尺寸线 + `w =` / `h =` 标签 | `src/scenes/c_define.js` `drawAnnotations` ①（整块删） |
| 0:33 | 删一切 z 轴痕迹：x/y 贯穿整屏的轴线 + 两枚箭头锥 + x/y/**z** 三个 3D 文字（'x' 原本被右缘裁切） | `c_define.js` `this.axes`（轴线+Cone 箭头）与 `labAxis` 整组删；**保留** xy 方格纸 `segC:plane`（spec"只看 xy 平面"的参照） |
| 0:35 | 删第二个圆、圆周刻度、半径刻度、`r = 1.00` | `c_define.js` `segC:ring`(TorusGeometry) / `segC:ticks`(voxelField×24) / `labPi` / `drawAnnotations` ② 整块删；圆只由点云 `segC:points` 的形变给出 |
| 0:36 | 删顶部贴边白色公式与圆上/圆中公式（含周长、2π 数值）；只留 `y = sin x` 1 处、切线斜率数字、末尾 lim/ε(≥80px) | `c_define.js` `labC`/`labSin`/`labInf`/`labWall`/`labLim`/`labEps` 与 ③ 的 `2π = 6.2832`、`2πr = …` 全删；lim 由 `cy+S*1.22`(82.4%，T42 报 bottom 7.7%) 抬到 `cy+S*0.78`(≈69%)，lim 与 ε 均 84px |
| 0:38 | sin 曲线只留一条（G3） | 删 `drawAnnotations` ④ 的 96 段路径；画面里只剩 3D `segC:curve` 那条 |
| 0:42 | ∞ 曲线只留一条（G3） | 删 `drawAnnotations` ⑥（Gerono 120 段 + '∞' 字形）；只剩 3D 那条 |

## 量化（`node .scratch_layers.mjs scan 0.2` → `out/_scan020_t43.log`）
- **全片 1060 帧（0.2s 步长）文字重叠命中 0 帧**（T42 时唯一的 `t=38.2 2π = 6.2832 ∩ y = sin x` 随两处删除消失）；59.8–62.2s 命中 0；面板 **31 块 / 失败 0 组**。
- `?shot` 抽检 `errors=0`：t=26.5(B)、33.6、38.2、43.8(C)；segC tris 降到 1858（去掉刻度环/实体圆/12 个文字面片后）。
- 运行时对象普查（t=26.5 页内 traverse stage3d，179 个命名对象）：segB = formula/pendulum/lorenz/tesseract/mandelbrot/packet/fourier/galaxy/blackhole/waveint/gate/backdrop/shafts/snow/tokensnow/vitrines —— **无 heart**；segC = points/curve/plane/tangents/highlight —— **无 ring / ticks / 文字面片**。
- 6 关键帧：`out/t43/after_26.5.png`（B，无爱心）、`after_33.6.png`（无测量框/轴/箭头/z 字）、`after_35.0.png`（一个圆 + 亮点）、`after_37.6.png`（无 2π 数字）、`after_41.5.png`（单条 sin/∞ 路径）、`after_43.8.png`（lim 84px 进安全区、ε 84px）；before 对照 4 张同目录。

## 判断与遗留（诚实状态）
- **保留**（§B/C 未点名）：xy 方格纸、③ 的「弧展开成直线段」（V4 项，两个 2π 数字已删）、2D 切线线段（其斜率数字在保留清单内）。
- **不改探针**：T42 的 g4 命中 `b:pendulum` / `b:fourier` 在 0:14.6–0:22.4，不在本题点名的六个时刻内，且它们是双摆/傅里叶本轮的「杆+球」而非开关拨杆 → 本轮不删几何、**也不改 `leverModels` 判据**（改判据等于放宽 G4 门槛），留待 §G/T47 按 §G 的开关形态统一判定。
- 段 M/N 的 `heart3d`（蓝色粒子爱心，`src/lib/heart3d.js`）属 FIX_V5 §E/§H 范围，本轮未动。
