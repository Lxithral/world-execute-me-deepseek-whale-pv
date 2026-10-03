# OVERLAPS.md — 贴图内部文字重叠与面板字号（T03 扫描结果）

> 交付物属于队列项 **T03**（FIX_V4 **§2.3**：「往 canvas 纹理上画的文字也要登记包围盒；
> 同层 IoU>0.1 为 FAIL；面板文字最小 34px；用它扫描全片，把发现列入 `docs/OVERLAPS.md`
> （**只列出，不在本项里修**）」）。
>
> 采集方式：`?x=T03g` 探针依次渲染 19 个代表性时刻，触发 14 个段落的 `init()` → 所有贴图烘焙；
> 读取 `window.__app.textureReports()`（每次 `setTextureSpace(false)` 结算一次）。
> **本项只列不改。**

---

## 发现 1（**根因已坐实**）：`text()` 返回的宽度是错的 → 代码墙整行文字挤在行首

### 证据

`findTextOverlaps` / `textureReports` 报出 **7 块贴图共 1933 对** IoU>0.1 的重叠，
全部来自代码墙（`codewall.js`）：

| 贴图 | 盒子数 | 重叠对数 | 字号 |
|---|---|---|---|
| `tex#16` | 51 | 155 | 92px |
| `tex#17` | 91 | **548** | 92px |
| `tex#18` | 39 | 107 | 92px |
| `tex#19` | 55 | 191 | 92px |
| `tex#53` | 90 | 271 | 64px |
| `tex#54` | 102 | **474** | 64px |
| `tex#55` | 69 | 187 | 64px |

典型重叠对（坐标是贴图自己的画布坐标）：

```
tex#16  [def  @(40,60) 152×107 sz92] ∩ [obey    @(57,60) 202×107 sz92]  IoU 0.613
tex#17  [export@(40,60) 303×107 sz92] ∩ [function@(73,60) 405×107 sz92]  IoU 0.620
tex#18  [pub  @(40,60) 152×107 sz92] ∩ [struct  @(61,60) 303×107 sz92]  IoU 0.404
```

### 为什么这不可能是"排版本来如此"

`codewall.js:137-146` 是**顺序排版**：

```js
for (let i = 0; i < lines.length; i++) {
  const y = y0 + i * lh
  for (const tk of tokenize(lang, lines[i])) {
    const w = text(g, tk.t, x, y, { role: 'codeWall', size: fontPx, … })
    x += w                       // ← 用 text() 的返回值推进
  }
}
```

若 `w` 正确（`def` @92px ≈ 152px），第二个 token 应落在 x ≈ 192+，**不可能**落在 x=57。
而 `y=60` 恰好等于 `y0(=pad+fontPx=132) − 92×0.78`（`text()` 里的 alphabetic 基线换算），
说明**登记的 y 是对的、x 也确实是调用时的 x** —— 所以问题只能在 `w` 上。

### 根因（`src/ui/text.js:161-162`）

```js
  g.restore()                                   // ← 先把字体还原了
  return g.measureText(String(str)).width       // ← 再用"还原后的字体"量宽度
```

`text()` 内部用 `g.save()` 设置 `font`，绘制与登记都在 save/restore 之间；
但返回值在 `g.restore()` **之后**才 measure —— 此时 `font` 已经回到调用前的环境字体
（通常是画布的默认 10px），量出来的宽度远小于真实字宽。
于是 `codewall` 的 `x += w` 每次只推进十几像素，**整行 token 全挤在行首互相压住**。

### 这正是 §1.2 怀疑的那件事

FIX_V4 §1.2：「**找到文字叠在一起的根因**（怀疑：同一块纹理上多层文本重复绘制、
或把"幽灵残影"当成正文画了多遍），修复」—— 现在根因坐实了，**不是**重复绘制、**不是**幽灵残影，
而是**返回值口径错**。用户看到的就是"代码叠成一团"。

### 建议修复（**本项不做**）

`text()` 里把宽度在 restore **之前**取好并返回。一行改动：

```js
  const outW = g.measureText(String(str)).width   // 放在 g.restore() 之前
  g.restore()
  return outW
```

⚠️ 但这会**改变代码墙的视觉**（字会散开、行会变长），所以它属于
**T13「段 B-1 清黑框与叠字」**：那条队列项本身就是"删黑框 + 修叠字 + '会自己长大的函数'逐行排版"。
建议在 T13 里连同"是否还要缩短每行 token 数 / 是否要换行"一起做。

---

## 发现 2：**面板类文字低于 §2.3 的 34px**（5 处）

`textureReports()` 里 `tooSmall`（判据：字号 < 34 且 `role !== 'codeDeco'`）：

| 贴图 | 盒子数 | 低于 34px | 实例 |
|---|---|---|---|
| `tex#56` | 1 | 1 | `…`（role `label`, **30px**） |
| `tex#56` | 1 | 1 | `softmax[4] = 0.0092   L …`（role `label`, **30px**） |
| `tex#57` | 4 | 2 | `⚙`（role `term`, **30px**）、`tokens ▸ streaming…`（role `term`, **30px**） |
| `tex#58` | 4 | 2 | `⚙`（role `term`, **30px**）、`tokens ▸ streaming…`（role `term`, **30px**） |
| `tex#59` | 4 | 2 | `✖`（role `term`, **30px**）、`E_CONTEXT_LIMIT`（role `term`, **30px**） |

说明：
- `role='term'` 这几处是 **TermPane**（3D 终端屏）的正文。它的下限来自 **FIX_V3 §2.2**（等宽正文 ≥30px）。
  **FIX_V4 §2.3 优先**，明确写「面板类文字最小 **34px**」—— 所以这 5 处按现行优先级**不达标**。
- `role='label'` 的两处在 `tex#56`（`softmax[…]=…` 那类读数），也是面板里的字。

### 建议修复（**本项不做**）

两个选择，都需要你定：
1. **把 `TEXT_MIN.term` 从 30 提到 34**，并把 `src/lib/props/termpane.js` 的 `BODY_PX` 从 30 提到 34
   （需同步调 `LINE_H` / `MAX_LINES` 以免行溢出）。这是**收紧**门槛，符合"不放宽任何门槛"。
2. 若你认为终端屏的 30px 是 FIX_V3 §2.2 的有意安排、§2.3 的"面板"另有所指，请告知，
   我把 `PANEL_MIN_PX` 的口径写清楚（但**不会**自行放宽）。

这项影响 **J 段（T11/T12）** 的终端屏，以及 `tex#56` 所属段落的面板读数。

---

## 附：本次检测器的实现与它自己的口径

- **登记**：`text()` 与"裸 `fillText`"两条路径都会登记；纹理空间里的盒子带上该贴图自己的层名
  `tex#N`（`textureLayer()`），于是 `findTextOverlaps` 里既有的「`a.layer !== b.layer` 就跳过」
  自动把比较**限制在同一块贴图内** —— 「同层 IoU>0.1 为 FAIL」直接对上。
- **为什么必须在烘焙时结算**：代码墙 / TermPane 的贴图是在段落 `init()` 里**一次性烘焙**的，
  而 `bboxes` 每帧清空 —— 实测 t=20 时帧盒里只剩 4 个"每帧重烘"的纹理盒，代码墙的字一个都没留下。
  所以 `setTextureSpace(true/false)` 成对工作：`false` 时把本次烘焙产生的盒子**从帧盒里摘出来**
  （避免污染屏幕空间的 §2.8 检查），就地算同层重叠、并按 34px 查面板字号，结果累进 `textureReports`。
- **已修的假阳性**：纯空白不登记。代码墙把 `" "` 也当 token 画（92px 下 w=51），
  于是每行都与前一个词"重叠" IoU 0.33 —— 1933 对里有相当一部分是这么来的，修掉后数字如上表。
- **没有回归**：抽查 10 帧（16/20/26/118/122/140/159/175/180/205s）的**屏幕层**重叠仍为 **0**，
  `errors=0`；`npm run doctor` PASS 5/0。
- 面板字号判据常量：`PANEL_MIN_PX = 34`（`src/ui/text.js`），与 §2.3 一致。
