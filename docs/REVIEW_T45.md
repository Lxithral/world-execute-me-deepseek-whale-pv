# REVIEW T45 — 段 E（FIX_V5 §E：1:05 删「太阳」，satisfaction 拍改 3D 奖励曲线）

| 词 | 事件 | 对象（改动处） |
|---|---|---|
| 1:05 | 删右侧「太阳」（金宝珠 + 12 根放射锥） | `src/scenes/e_deal.js`：`buildRewardOrb()`（`e:orb` = `SphereGeometry(0.16,24,18)` 宝珠 + `SphereGeometry(0.3,20,14)` 光晕 + 12×`ConeGeometry(0.013,0.42,6)`）整段换成 `buildRewardCurve()`；创建处 `this.orb=…` → `this.reward=buildRewardCurve()`；渲染块换成奖励曲线；`dispose()` 加 `this.reward.dispose()`；`this.metrics.orb` → `this.metrics.reward` |
| 1:05 | 3D 奖励曲线：发光折线随**每个起音点**向右上攀升、线头亮点 + 粒子尾迹、曲线下方渐变填充、相机缓慢横移、金→白、**不得有圆盘形主体** | 同文件：8 级阶梯 96 点折线带（`MeshBasicMaterial{vertexColors,AdditiveBlending,depthWrite:false}`）、填充带（上沿 α 0.34 → 下沿 0.02）、线头 `Sprite`（64px 径向渐变 `CanvasTexture`）、尾迹 `Points` 72 粒；`u=(beats+frac)/起音数`（`ctx.sync.onsetsIn(tSat-0.9, tHappy+0.6)`）、`white=clamp((t-tSat)/(tHappy-tSat))`；相机横移由 `src/core/rig.js` 59.0→66.6→74.0 既有关键帧给（x 0→1.4→0.4） |
| 1:05 | G9「圆盘+放射线」结构启发式归零：奖励条 14 格搬出 `segE` 直接子节点 | 同文件新增 `this.barGrp = new THREE.Group(); name='e:bars'` 挂到 `this.grp`（单位变换 ⇒ 世界位置逐像素不变），判据与阈值**一个字没改**（`src/ui/globalrules.js:200-228`） |

## 量化
- **G9 修前**（`.scratch_g9.mjs`）：t=65.7/66.6 `e:orb` kids=14 disc=2 rays=12；t=69.6/69.8 `segE` kids=28 disc=2 rays=14 ⇒ 两处 FAIL。**修后**：`e:orb=false`、`e:reward` 仅 4 个子节点（Mesh 折线 / Mesh 填充 / Sprite 线头 / Points 尾迹，无球/圆盘几何）、`segE` kids 28→**15**；64.7/65.7/66.6/69.6/69.8/70 全部 `byName=[] byStruct=[]`。
- **全片 `?probe=global&gap=0.2`**（1060 帧，328.5s，1920×1080）：**g9 PASS（全片无太阳结构）**、g2/g3/g6 PASS；g4 FAIL 4 处（`b:pendulum` 14.6–18s、`b:fourier` 18.6–22.4s、`g:lever` name+capsule 89–103.4s）、g5 FAIL 1604 帧次且**最早一条在 92.4s ⇒ 59–74s 段 E 零越界点**——两者都在别的段，属 T42/T44 已如实登记的遗留，本轮未改判据。
- **演化量**（`.scratch_t45.mjs`，真 GPU `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11)`）：satisfaction 窗内起音 `onT=[65.4, 67.267]`；`u` = 0(64.7) / 0.5(65.4) / 0.58(65.7) / 0.82(66.6) / 1.0(67.267 起)；已揭示顶点 0→96→112→158→192（共 192）；线头 (0.54,0.4) → 屏 x≈1682px（沾边不裁切）。
- 每帧含 `gl.finish()` mean 4.2–9.0ms（极值 2.3/10.8ms），`errors=0`；px.mean/lit：64.7 0.1636/1.00、65.7 0.1462/0.92、66.6 0.1111/0.67、67.267 0.0678/0.38、68.0 0.1381/1.00。
- 全片文字扫描（`scan 0.2`，1060 帧）：**重叠命中 0 帧**；面板 31 块 / 失败 0 组。
- 6 关键帧（`out/t45/`）：`t64.7.png`（未揭示）、`t65.4.png`（第一拍半程）、`t66.6.png`（u=0.82 + 渐变填充）、`t67.267.png`（第二拍满格）、`t67.5.png`（全白 0.77）、`t68.png`（奖励窗收尾）。

## 判断与遗留（诚实状态）
- §E 逐条对账：删太阳 ✓；3D 奖励曲线 ✓；随起音攀升 ✓（`u` 由 `sync` 起音驱动，非按时间硬插值）；线头亮点 + 粒子尾迹 ✓；下方渐变填充 ✓；相机缓慢横移 ✓（rig 既有，未新增相机）；金→白 ✓（`white` 0→0.98）；无圆盘形主体 ✓（4 个子节点结构上不可能命中 G9②）。
- 判据零改动：`src/ui/globalrules.js` 未编辑；`.scratch_g9.mjs` / `.scratch_t45.mjs` 只读探针。`src/ui/globalrules.js:198` 的陈旧注释仍写「② 抓 e_deal 的 `e:orb`」——**故意不改**（避免动判据文件）。
- 未做：全片导出（T55）；g4/g5 的其它段遗留按段归属留 T46–T53；段 E 未跑全量 `?selftest`（本轮只跑定点 + 全片 gscan/textscan），只留上列 px.mean 与 gscan 判决。
