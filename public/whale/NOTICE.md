# NOTICE — 第三方素材与许可

本项目（`world.execute(me); · DeepSeek 鲸鱼娘版`）是非官方同人作品。
本文件说明 `public/whale/` 下随项目分发的素材的来源、署名链、许可与本项目做过的改动。

## 1. 鲸鱼娘美术（CC BY-NC-SA 4.0）

### 署名链（按 CC BY-NC-SA 4.0 完整保留创作链）

1. **上善**（上善无形）— 鲸鱼娘 / 溟月 角色原作
   Pixiv <https://www.pixiv.net/users/62155430> · Bilibili <https://space.bilibili.com/4456176>
2. **ZipZipPipe** — 加入 DeepSeek 元素的女仆二设
   Pixiv <https://www.pixiv.net/users/18604994> · Bilibili <https://space.bilibili.com/4168597>
   原帖：Pixiv《AI娘化》<https://www.pixiv.net/artworks/148186519>
3. **Small-tailqwq / dsh-deep-whale** — 立绘、深海背景、UI 装饰（`maid-atelier`）
   <https://github.com/Small-tailqwq/dsh-deep-whale>
4. **JAdpp / dsh-whale-galgame** — 八种额外表情
   <https://github.com/JAdpp/dsh-whale-galgame>

本项目经由 **MisakaZentai / world-execute-me-dsh-pv** 取得上述素材：
<https://github.com/MisakaZentai/world-execute-me-dsh-pv>

### 本目录内的文件

| 文件 | 来源 | 说明 |
|---|---|---|
| `maid-left.webp` | `dsh-deep-whale / maid-atelier`（经 dsh-pv 的 `film/third_party_references/`） | 默认站姿主立绘 |
| `whale-angry.webp` | `dsh-whale-galgame` | 表情「愤怒」 |
| `whale-cheerful.webp` | 同上 | 表情「开心」 |
| `whale-confused.webp` | 同上 | 表情「困惑」 |
| `whale-exasperated.webp` | 同上 | 表情「无奈」 |
| `whale-frightened.webp` | 同上 | 表情「惊讶」 |
| `whale-serious.webp` | 同上 | 表情「严肃」 |
| `whale-shy.webp` | 同上 | 表情「害羞」 |
| `whale-starry.webp` | 同上 | 表情「星光眼」 |
| `cat.png` | 参考项目 `film/pv_dsh_frontend_20260927/mem_sprites/`（派生作品） | 像素猫贴纸，用于「猫」变身 |

`public/data/whale_{contour,points,mesh}.json` 由 `maid-left.webp` 在构建期转换而成（见下）。

### 许可

上述素材及其改编部分按 **CC BY-NC-SA 4.0** 使用与分享：

- 使用时必须保留完整署名链；
- **仅限非商业用途**；
- 改编作品必须以同一许可（CC BY-NC-SA 4.0）分享。

许可全文：<https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>
参考项目内副本：`refs/dsh-pv/LICENSES/CC-BY-NC-SA-4.0.txt`

### 本项目对素材做过的改动清单

- **裁切与缩放**：立绘按舞台需要缩放到画面高度约 1.02 倍（工作宽度 720px 的缩略图用于点云取色）。
- **着色 / 去色**：为情绪角色叠加离散色调（紫、红、蓝、灰、金），以及在「闭眼 / 失落 / 交接」时去饱和；透明区域始终保持透明。
- **遮罩与叠加图元**：闭眼时叠加黑色眼睑条；失落时叠加垂视线与泪滴图元；未改动任何角色面部线条。
- **点云 / 三角网格转换**：由 `maid-left.webp` 的 alpha 轮廓经 marching squares 得到轮廓折线（1154 点），抖动网格采样得到 8000 个带色点（z 由到身体中轴距离与亮度合成），Delaunay 剖分得到 780 个带平均色的三角形。
- **故障 / 色散效果**：位移、切片、RGB 错位、闪烁与扫描线等实时后处理（不改变源文件）。
- **像素化**：`cat.png` 以最近邻方式放大绘制（保持像素风）。

以上改动**不包含**对角色面部的重绘，也不包含用 AI 重新生成角色。

### 非官方声明

本项目为非官方同人作品，与 **DeepSeek**、**Mili** 及上述各位作者**没有从属或合作关系**，也未经其认可。
界面仅为对 DeepSeek Harness（dsh）前端风格的**致敬与原创仿作**，未使用 DeepSeek 官方 logo 或 wordmark，也未复刻任何商业产品界面。

## 2. 歌曲与歌词

- 歌曲《world.execute(me);》版权归 **Mili** 所有；歌词版权归词作者（Mili）所有。
- 歌曲音频与歌词**不随本项目分发**：`assets/` 由使用者自备，并已在 `.gitignore` 中排除。
- 本项目的音乐使用遵循 [Mili Copyright Guidelines](https://projectmili.com/copyright-guidelines)：个人非商业二创；全部或部分含 AI 的同人内容**已明确标注**（见项目根 `README.md` 与片尾字幕）。
- 本项目**不授予**音乐或歌词的任何再许可。

## 3. 字体与代码

- **JetBrains Mono**：SIL Open Font License 1.1，经 `@fontsource/jetbrains-mono` 本地打包（`node_modules`，不随源码入库）。
- 中文使用系统字体栈（Microsoft YaHei / PingFang SC / Noto Sans CJK SC），**不分发**字体文件。
- 参考仓库 `refs/dsh-pv` 中的 dsh 前端 CSS/JS 为 MIT（Copyright (c) 2026 DeepSeek），仅作**只读参考**，其代码未复制进本项目。
- 本项目自身的代码与美术产出按 **MIT**（代码）/ **CC BY-NC-SA 4.0**（美术）发布；美术部分沿用上游同协议。

## 4. 商标

品牌名称与商标（DeepSeek、Mili 等）不因本项目的代码或美术许可而授予任何额外权利。
