# DSH_UI_NOTES.md — 官方 dsh Web 界面考据

> 本文件是后续所有界面工作的**唯一依据**（FIX.md §1.5）。
> 考据对象：`https://github.com/deepseek-ai/deepseek-harness`（MIT，Copyright (c) 2026 DeepSeek）。
> 本地只读副本：`D:\文档\GitHub\deepseek-harness`（`git clone --depth 1`，未修改、未整包复制进本项目）。
> 考据方式：只读源码（未执行 pnpm install / build / dsh web）。所有数值均抄自源文件，标注 `file:line`。
> 版本：克隆时的默认分支 HEAD（14104 个文件，182 MB）。

**重要前提**：官方 `BRAND_GUIDELINES.md:9` 明确「DeepSeek Harness」是 DeepSeek 的注册商标，并要求不得用官方品牌素材暗示官方背书。本项目是非官方同人，logo 只允许出现在官方界面里它原本所在的位置（FIX.md §1.7）。

---

## a) 整体布局

### 外壳：一个三列 CSS Grid

`packages/client/ui-layout/src/client/AppFrame.tsx:265-266` 的行内样式：

```
gridTemplateColumns: `${cols.sidebar}px minmax(${rightbar===0?0:CENTER_MIN}px, 1fr) minmax(0px, ${rightbarMax}px)`
```

容器 `packages/client/ui-layout/src/client/AppFrame.module.css:1-8`：`display:grid; grid-template-rows:100%; height:100%; overflow:hidden`。

DOM 子节点（`AppFrame.tsx:280-301`）：

| # | 节点 | 作用 | 关键 CSS |
|---|---|---|---|
| 1 | `.sidebarCol` | 左栏（`sidebar` slot） | 右发丝线 `border-right: 0.5px solid var(--dsw-alias-border-l3)`（`AppFrame.module.css:63-68`） |
| 2 | `.centerCol` | 主区（`main` slot）= Conversation 或全局面板 | `flex column; min-width:0; overflow:hidden`（`:70-75`） |
| 3 | `.rightbarCol` | 右栏轨道，面板绝对贴右边缘 | `position:relative; overflow:visible`（`:271-275`） |
| 4 | `.overlayLayer` | 覆盖层 | `position:absolute; inset:0; z-index:20; pointer-events:none`（`:277-286`） |
| 5 | `.leadingSeat` | 仅 macOS 折叠态 | `top:11px; left:88px; z-index:15`（`:212-220`） |
| 6 | `DragHandle` ×2 | 拖拽改宽 | `width:8px; margin-left:-4px; cursor:col-resize; z-index:11`（`:228-237`） |

### 列宽常量（`packages/client/ui-layout/src/client/columns.ts`）

| 常量 | 值 | 行 |
|---|---|---|
| `CENTER_MIN` | **400px** | :11 |
| `SIDEBAR_MIN` | **264px** | :13 |
| `SIDEBAR_MAX` | **420px** | :15 |
| `SIDEBAR_DEFAULT` | **280px** | :17 |
| `SIDEBAR_COLLAPSED` | **56px** | :19 |
| `SIDEBAR_AUTO_COLLAPSE` | **1024px**（视口宽） | :23 |
| `RIGHTBAR_MIN` | **300px** | :25 |
| `RIGHTBAR_MAX_RATIO` | **0.7** | :27 |
| `RIGHTBAR_DEFAULT_RATIO` | **0.45**（默认开宽 = 视口 × 0.45） | :29 |

### 左栏内部（`ui-sidebar/src/client/SidebarRoot.module.css`）

- 根 `.root`：`padding: 6px var(--dsh-sidebar-inline-padding)`，`--dsh-sidebar-inline-padding: 12px`（`:9-23`，`SidebarRoot.module.css:10`）
- `.topStrip` 高 **52px**（macOS 拖拽/折叠行）（`:182-194`）
- **`.logoRow` 高 60px；折叠态 36px**（`:220-231`、`:233-241`）← logo 就住在这里
- `.newSession` 按钮高 **38px**，`margin: 0 2px 12px`；折叠 36×36（`:397-418`、`:443-452`）
- `.panelRow` `min-height:36px`（`:483-509`）
- `.regionArea` `flex:1; min-height:0`（会话列表区，`:556-565`）
- `.footArea` `flex:none`（`:575-579`）
- 折叠动画：滑入 + 交叉淡出，150ms（`SidebarRoot.tsx:31`、`SidebarRoot.module.css:136-139`）

### 会话列表（`ui-workspace/src/client/rows/`）

- `.sectionHeader` 高 **36px**（`WorkspaceBrowser.module.css:53-66`）
- `.list` `flex:1; overflow-y:auto; scrollbar-gutter:stable; padding-bottom:16px`（`:358-374`），底部 `.fade` 高 24px（`:329-337`）
- 行高：`.projectRow` **34px**、`.sessionRow` **32px**、`.searchResultRow` `min-height:48px`（`Rows.module.css:99-103,109-113,23-37`）

### 中栏纵向组成（`ui-conversation/src/client/skeleton/`）

| 区域 | 关键值 | 出处 |
|---|---|---|
| Conversation 头部 | `min-height: 76px; padding: 10px 28px 0 20px; border-bottom: 0.5px` | `ConversationRoot.module.css:15-23` |
| 空白会话头部 | `min-height:0; border-bottom:none` | `:31-35` |
| 标题行 | `min-height:30px`；面包屑 `max-width:220px` | `:64-81,125-139` |
| 视图标签条 | `gap:36px; margin-top:10px; padding-left:8px`；标签 13px/16px；激活条高 2px | `:193-238` |
| 正文滚动区 | `.scrollBody` `flex:1; overflow-y:auto; margin-right:2px; scrollbar-gutter:stable` | `:401-416` |
| 消息列 | `.column` `max-width: var(--dsh-chat-content-width); margin:0 auto` | `ui-chat/.../ChatView.module.css:57-63` |
| 正文内边距 | `16px calc(var(--dsh-composer-side-clearance) + 16px)` | `ChatView.module.css:22-34` |
| 内容宽（关键） | `--dsh-chat-content-width: clamp(680px, 列宽*0.64, 920px)`，窄屏退化为 `min(calc(100% - 32px), 920px)` | `ConversationRoot.module.css:384-387,395` |
| Composer 停靠 | `.composerSeat` `position:sticky; bottom:0; z-index:7`，顶部 36px 渐隐 | `:430-453` |
| Composer 卡 | `--dsh-composer-card-max-width = calc(内容宽 + 32px)` | `:388`、`InputBar.module.css:45-77` |
| 输入框高度 | 停靠态 `min-height:36px`；空白页 hero 态 `min-height:52px`；草稿滚动上限 `--dsh-composer-text-max-height: 336px` | `InputBar.module.css:169-185,233-237`、`ConversationRoot.module.css:357` |
| 发送键 | **34×34** 圆形；附件键 28×28 | `InputBar.module.css:372-391,313-326` |
| 上下文占用指示 | 在 composer 卡下方的 `.dock` 里 | `InputBar.tsx:499-504` |

> 注意：**非 macOS 没有跨列的全宽顶栏**。只有 macOS 的 `shell.leading` 座位和 Windows 标题栏行（`AppFrame.module.css:25-55,212-220`）。我们的 PV 若需要"顶栏"，属于**艺术夸张**（见 f 节）。

### 折叠/拖拽行为

- 拖拽改宽：左栏 264–420；右栏 300–`视口*0.7`（`columns.ts:53,57`）
- 视口 < 1024 自动折叠左栏（`columns.ts:23`）
- 视口 < 768 右栏自动全屏（`SidebarRight.tsx:362`）
- 只有"离散切换"才过渡：`.frame[data-animating] { transition: grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out) }`（`AppFrame.module.css:15-23`）；拖拽中无过渡
- 全面支持 `prefers-reduced-motion`（`AppFrame.module.css:57-61,258-262` 等）

### 启动方式

- 默认地址 **http://127.0.0.1:3080**（`README.md`；默认值定义 `packages/bundle/web-app/cordis.patch.yml:173-174`）
- npm：`npx @deepseek-ai/dsh web`；源码：`pnpm install && pnpm run build && pnpm dsh web`
- 开发（含客户端重建）：`pnpm run dev:web -- --no-open --port 3081`（`package.json:207`、`docs/development.md:164,169`）

---

## b) 设计 token（亮/暗两套，抄自源文件）

### 结构

- `packages/client/ui-theme/src/styles/base.css` — 字体族、圆角、动效曲线（`:root`）
- `packages/client/ui-theme/src/styles/design-platform.css` — 静态色板 + 别名 token（408 行，383 个 `--dsw-*`）
- `packages/client/ui-theme/src/styles/gradient-shadow-text.css` — 阴影/高度、markdown 字号
- 主题切换靠 `body[data-ds-dark-theme]`（`design-platform.css:85`、`:284`），**不是** `prefers-color-scheme`

### 圆角与动效曲线（`base.css:12-25`）

```css
--ds-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ds-transition-duration: 0.2s;
--ds-transition-duration-fast: 0.1s;
--ds-transition-duration-slow: 0.3s;
--dsw-radius-xs: 4px;  --dsw-radius-sm: 8px;   --dsw-radius-md: 12px;
--dsw-radius-lg: 16px; --dsw-radius-xl: 20px;  --dsw-radius-panel: 28px;
```

### 字体族（`base.css:7-11`）

```css
--dsw-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
  'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
--dsw-font-family-brand: 'Montserrat', var(--dsw-font-family);
--ds-font-family-code: 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas,
  'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei';
```

- 品牌字 **Montserrat**（OFL，`ui-theme/src/styles/montserrat-{light,regular,medium}.woff2`，声明于 `brand-font.css`，权重 300/400/500，`font-display:swap`）
- 正文字号轴：`--dsh-content-font-size`（默认 **14px**），派生
  `--dsh-content-font-delta: calc(var(--dsh-content-font-size, 14px) - 14px)`，
  `--dsh-content-font-size-secondary: min(calc(size - 1px), max(13px, calc(size - 2px)))`（`gradient-shadow-text.css:57-58`）
- 代码字体栈**刻意不带裸 `monospace` 尾巴**（注释：Windows 中文会掉到 SimSun，`base.css:2-4`）

### 静态色板（亮暗**相同**，`design-platform.css:4-83` 与 `:85-164` 是同一份值）

| 组 | token | 值 |
|---|---|---|
| neutral-bluish | `00 / 50 / 60 / 75 / 100 / 150 / 200 / 300 / 400 / 500 / 600 / 700 / 750 / 800 / 850 / 875 / 900 / 950 / 1000` | `rgb(255,255,255)` / `249,250,251` / `245,246,247` / `241,243,245` / `235,238,242` / `233,236,242` / `225,229,238` / `207,211,214` / `173,178,184` / `151,157,166` / `129,133,140` / `97,102,107` / `67,69,74` / `53,54,56` / `44,44,46` / `35,35,36` / `27,27,28` / `21,21,23` / `15,17,21` |
| **deepseek**（品牌蓝） | `50 / 100 / 200 / 300 / 400 / 450 / 500 / 600` | `237,243,254` / `228,237,253` / `211,226,255` / `183,200,254` / **`122,170,255`** / **`86,134,254`** / `65,118,230` / `72,104,178` |
| blue | `50 / 50p / 75 / 100 / 300 / 400 / 450 / 500 / 600` | `239,246,255` / `234,243,255` / `229,240,255` / `219,234,254` / `147,197,253` / `96,165,250` / `77,147,248` / `59,130,246` / `37,99,235` |
| green | `100 / 400 / 500` | `230,250,237` / `78,209,126` / `34,197,94` |
| amber | `100 / 400 / 500 / 600` | `254,245,231` / `247,173,49` / `245,158,11` / `221,134,41` |
| red | `50 / 100 / 400 / 500 / 600` | `254,242,242` / `254,226,226` / `242,90,90` / `239,68,68` / `236,19,19` |
| neutral(纯灰) | `50 / 100 / … / 1000` | `250,250,250` / `245,245,245` / … / `0,0,0` |

> 品牌蓝要用的两个值：亮色主题 `--dsw-static-deepseek-500: rgb(65,118,230)`；暗色 `--dsw-static-deepseek-400: rgb(122,170,255)`（官网 favicon 用的是 `#4D6BFE`，见 d 节）。

### 别名 token 对照表（亮 → 暗）

| token | 亮色（`:166-282`） | 暗色（`:284-398`） |
|---|---|---|
| `--dsw-alias-bg-base` | `--dsw-static-neutral-bluish-00`（白） | `--dsw-static-neutral-bluish-950` = `rgb(21,21,23)` |
| `--dsw-alias-bg-layer-1` | `bluish-00` | `bluish-875` = `rgb(35,35,36)` |
| `--dsw-alias-bg-layer-2` | `bluish-00` | `bluish-850` = `rgb(44,44,46)` |
| `--dsw-alias-bg-layer-3` | `bluish-00` | `bluish-800` = `rgb(53,54,56)` |
| `--dsw-alias-border-l1` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` |
| `--dsw-alias-border-l2` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.12)` |
| `--dsw-alias-border-l3` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.16)` |
| `--dsw-alias-border-l4` | `rgba(0,0,0,0.16)` | `rgba(255,255,255,0.2)` |
| `--dsw-alias-label-primary` | `bluish-1000` = `rgb(15,17,21)` | `bluish-50` = `rgb(249,250,251)` |
| `--dsw-alias-label-secondary` | `bluish-700` | `bluish-300` |
| `--dsw-alias-label-tertiary` | `bluish-600` | `bluish-400` |
| `--dsw-alias-label-caption` | `bluish-400` | `bluish-600` |
| `--dsw-alias-label-shimmer` | `color-mix(neutral-1000 30%, transparent)` | `color-mix(neutral-00 45%, transparent)` |
| `--dsw-alias-button-primary-fill` | `= brand-primary` = `bluish-1000`（近黑） | `= brand-primary` = `bluish-50`（近白） |
| `--dsw-alias-button-info-fill` | `deepseek-500` = `rgb(65,118,230)` | `deepseek-400` = `rgb(122,170,255)` |
| `--dsw-alias-state-business-primary` | `deepseek-500` | `deepseek-400` |
| `--dsw-alias-state-error-primary` | `red-600` = `rgb(236,19,19)` | `red-400` = `rgb(242,90,90)` |
| `--dsw-alias-state-warn-primary` | `amber-500` = `rgb(245,158,11)` | 同 |
| `--dsw-alias-state-warn-label` | `amber-600` = `rgb(221,134,41)` | 同 |
| `--dsw-alias-state-warn-secondary` | `amber-400` = `rgb(247,173,49)` | 同 |
| `--dsw-alias-state-warn-tertiary` | `amber-100` = `rgb(254,245,231)` | `amber-900` = `rgb(39,36,31)` |
| `--dsw-alias-state-success-primary` | `green-500` = `rgb(34,197,94)` | 同 |
| `--dsw-alias-state-success-tertiary` | `green-100` | `green-900` = `rgb(35,60,44)` |
| `--dsw-specific-bubble`（**用户气泡**） | `deepseek-50` = `rgb(237,243,254)` | `bluish-850` = `rgb(44,44,46)` |
| `--dsw-specific-bubble-highlight` | `deepseek-200` | `bluish-750` |
| `--dsw-specific-input-major`（**composer 卡**） | `bluish-00`（白） | `bluish-850` |
| `--dsw-specific-selector` | `bluish-60` | `bluish-800` |
| `--dsw-specific-sidebar-fill` | `bluish-50` | `bluish-900` |
| `--dsw-specific-sidebar-nav-item-active` | `bluish-100` | `bluish-750` |
| `--dsw-specific-menu` | `rgba(248,249,250,0.58)` | `rgba(67,69,74,0.45)`（macOS 强制 0.94，`:402-408`） |
| `--dsw-alias-markdown-code-block`（**代码块底**） | `bluish-50` | `bluish-900` = `rgb(27,27,28)` |
| `--dsw-alias-markdown-inline-code` | `neutral-50` | `neutral-800` |
| `--dsw-alias-toast-bg` | `bluish-800` | `bluish-750` |
| `--dsw-alias-tooltip-bg` | `bluish-850` | `bluish-750` |
| `--dsw-alias-interactive-bg-hover` | `rgba(38,49,72,0.06)` | `rgba(255,255,255,0.08)` |
| `--dsw-alias-interactive-bg-active` | `rgba(38,49,72,0.1)` | `rgba(255,255,255,0.14)` |
| `--dsw-alias-code-diff-added / -deleted` | `green-500-a08` / `red-600-a08` | `green-500-a12` / `red-400-a12` |
| `--dsw-alias-bg-skeleton` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.08)` |

### 阴影与高度（`gradient-shadow-text.css:5-39`）

```css
--dsw-shadow-lv1: 0 2px 4px 0 rgba(0,0,0,0.05);
--dsw-shadow-lv1-blur: 0 4px 12px 0 rgba(0,0,0,0.02);
--dsw-shadow-lv2: 0 4px 12px 0 rgba(0,0,0,0.02), 0 2px 8px 0 rgba(0,0,0,0.04);
--dsw-elevation-stroke: 0 0 0 0.5px var(--dsw-elevation-stroke-color);   /* 描边承担分离 */
--dsw-elevation-panel:     stroke, 0 3px 8px rgba(0,0,0,0.03), 0 0 16px rgba(0,0,0,0.02);
--dsw-elevation-prominent: stroke, 0 3px 8px rgba(0,0,0,0.04), 0 0 20px rgba(0,0,0,0.05);
--dsw-elevation-soft:      stroke, 0 4px 16px rgba(0,0,0,0.03), 0 0 24px rgba(0,0,0,0.03);
```

默认描边色 `--dsw-elevation-stroke-color: var(--dsw-alias-border-l4)`（亮）/ `var(--dsw-alias-border-l3)`（暗），组件按所处层级重绑（如 composer 卡绑 `border-l2`、菜单绑 `border-l1`）。

### Markdown 字号（`gradient-shadow-text.css:61+`）

`H1 700 21px/30px`、`H2 700 19px/28px`、`H3 700 18px/26px`、`H4 600 14px/24px`（均带 `+ var(--dsh-content-font-delta)`）。

---

## c) 组件解剖

共性：全部用 **CSS Modules** + 别名 CSS 变量；没有 Tailwind；没有"成功/失败状态图标集"（状态靠颜色、TextShimmer、隐藏的 SR 文案表达）。

### 1. 消息（`ui-chat`）

容器链：`ChatView` → `.frame > .root > .scroll > .column[data-chat-flow]`（`chat/ChatView.tsx:229-309`）。相邻节点间距 `--dsh-chat-flow-gap`：默认 **6px**，一条回复之后 **12px**，回合处理头前后 **16px**（`ChatView.module.css:68-95`）。

**用户消息**（`chat/MessageItem.tsx:161-234`、`MessageItem.module.css`）

```
div.userRow[data-pending-steering?][data-submission-echo?]
  div.userStack                    → align-items:flex-end; gap:6px
    div.attachmentRow              → 图片 / span.fileCard
    div.bubble                     → bg var(--dsw-specific-bubble); radius var(--dsw-radius-xl);
                                     padding:10px 16px; font-size:var(--dsh-content-font-size,14px);
                                     line-height:calc(22px + delta); color:var(--dsw-alias-label-primary)
                                     white-space:pre-wrap
    div.referenceSummary
```
`.userStack` 宽 `min(内容宽*0.702, 82%)`。文件卡 `flex:0 0 240px; min-height:64px; padding:8px 12px; border:0.5px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-xl)`，图标 28px。

**助手消息**（`chat/AssistantMarkdown.tsx:54-152`）**没有气泡**，左对齐整宽；`.root` 14px/`calc(24px + delta)`；`.body` `flex column; gap:16px`；块类型 = 文本 / 推理行 / 图片 / 工具行。中断时 `.stopped` 是 11px/18 的行内小标。

**操作行**（`chat/MessageIconActions.module.css`）：高 `calc(28px + delta)`，`gap:8px`；每个按钮 **28×28**、`border-radius: var(--dsw-radius-sm)`、字形 15px（助手行 17px）；复制成功换勾 1 秒。

### 2. 思考块（`ui-chat/chat/ReasoningRow.tsx`）

```
div.root[data-variant=think][data-state=running|ok][data-expanded?]
  DisclosureRow → div.row[data-disclosure-row][data-expandable?]
      span.leading   (IconThinkOutlineRegular size=14；hover 交叉淡化为 chevron)
      TextShimmer
      span.separator (2×2 点) + span.summary (13px/20，ellipsis)
  (展开) div.thinkBody → MarkdownText，padding: 4px 0 4px calc(22px + delta)
```
折叠态高度 `calc(24px + var(--dsh-content-font-delta))` 且 `contain:size layout`；**流式时右侧 48px 遮罩**（`mask-image: linear-gradient(to right, black calc(100% - 48px), transparent)`），**没有光标闪烁**；展开后头部 `position:sticky; top:0; z-index:1; background:var(--dsw-alias-bg-base)`。

### 3. 工具调用卡片（`ui-tool`）

```
div.callRow[data-chat-call-id]
  span.visuallyHidden
  DisclosureRow
    div.row  → [16px leading] gap6 [title 13px] gap8 [2×2 点] gap8 [summary 13px/24 ellipsis]
  (展开) div.bodyWrap → askQuestion/terminal/diff/read/image/search/web/details/IN-OUT 择一
```
- 嵌套调用：`div.subCalls { gap:4px; margin:4px 0 2px 22px; padding-left:8px; border-left:0.5px solid var(--dsw-alias-border-l2) }`
- 状态枚举 `'preparing' | 'running' | 'ok' | 'error' | 'stopped'`（`models/tool-call-model.ts:18`）；`preparing` 不可展开；`running` 用 TextShimmer；错误摘要 `color:var(--dsw-alias-state-error-primary)`；停止 `--dsw-alias-state-warn-label`
- IN/OUT 兜底卡：`border:0.5px solid var(--dsw-alias-border-l1); border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-markdown-code-block)`；`.ioSection` 网格 `max-content 1fr`、`padding:12px 16px; max-height:150px; overflow-y:auto`
- 滚动上限：代码体 **260px**、终端输出 **224px**

### 4. 权限 / 审批（`ui-approval`、`ui-permission-presets`）

```
div.root[data-approval-key][aria-busy]
  div.card      → border:1px solid var(--dsw-alias-state-warn-secondary);
                  border-radius:var(--dsw-radius-xl); background:var(--dsw-specific-input-major);
                  box-shadow:var(--dsw-shadow-lv2)
    div.strip   → StateDot(warning|ongoing) + 等待文案；bg warn-tertiary，13px/18
    div.body    → headline 15px/24 wt500；command 代码 13px/20
    div.actionRow → 右对齐 gap8 padding 14px 16px；outline=拒绝 / primary=允许一次
```
键盘：`Enter` = allow once，`Escape` = reject。预设选择器 `PermissionSelect` 触发键高 **28px**、`max-width:220px`、字 13px/20 wt500；容器宽 < 460px 时隐藏文字标签。

### 5. 上下文占用指示（`ui-conversation/.../ContextMeter.tsx`）

- 形态：**环形进度**（`viewBox 0 0 14 14`，`RADIUS=5.5`，`stroke-dasharray` 按百分比，`rotate(-90 7 7)`）+ 百分比文字
- 触发键：`padding:1px 8px; gap:6px; border-radius:var(--dsw-radius-sm)`，字 `--dsh-content-font-size-secondary`，`font-variant-numeric: tabular-nums`
- 轨道 `--dsw-alias-border-l3`，进度 `--dsw-alias-label-tertiary`，`stroke-width:2`
- 展开面板：`width:min(264px, 100vw - 24px); padding:12px; border-radius:var(--dsw-radius-lg); background:var(--dsw-specific-menu); box-shadow:var(--dsw-elevation-prominent); z-index:1100`
- 分段条高 **4px**、`border-radius:999px`、段间隙 1px；颜色：system `--dsw-static-neutral-bluish-400`、tools `rgb(167,139,250)`、messages `--dsw-static-blue-450`
- 数值：`percent = min(100, round(usedTokens / contextWindow * 100))`

### 6. 重连 / 错误提示

- `ConnectionIndicator`（`ui-primitives`）：三态 `disconnected | connecting | recovered`；`display:inline-grid; grid-template-columns:14px max-content; column-gap:4px; height:28px; padding:0 8px; border-radius:var(--dsw-radius-sm); font-size:12px; font-weight:500`；告警底 `warn-tertiary`，成功底 `success-tertiary`；进入 150ms，退出 `EXIT_MS=150`
- 回合失败行：`grid-template-columns: 10px minmax(0,1fr) auto; gap:8px`，标题 `--dsw-alias-state-error-primary` wt600
- Toast（`ui-primitives/Toast`）：`position:fixed; top:40px; z-index:1100; padding:12px 16px; border-radius:var(--dsw-radius-lg); font-size:14px/22; box-shadow:var(--dsw-shadow-lv3)`；BOTH 主题都是深底；默认停留 **3000ms** + **1000ms** 淡出
- composer 内联提示：`padding:4px 8px; border-radius:var(--dsw-radius-md); background:var(--dsw-alias-interactive-bg-hover); font-size:12px/18`

### 7. 会话交接 / 压缩 / 新会话

- **官方没有 "handoff" 界面**（全仓 grep `handoff` 只命中注释与测试名）。我们的"交接卡片"属于**艺术夸张**。
- 压缩标记（`ui-chat/chat/CompactionItem.tsx`）：`button.compactionButton`（高 `calc(24px + delta)`）＝ 图标（hover 交叉淡化为 chevron）+ 标题 + 2×2 点 + 省略号摘要；展开 `div.compactionBody` 渲染 Markdown；**这是我们"上下文将满 → 压缩"最接近的官方原型**。
- 新会话：侧栏 `.newSession` 按钮（高 38px，`border:0.5px solid var(--dsw-alias-border-l3); border-radius:var(--dsw-radius-md); font-size:14px/22 wt500`，折叠为 36px 图标）+ 空白会话 hero（鱼标记 + 26px/32 wt500 标题 + 工作区 chip）。

### 8. 反馈行（`ui-message-feedback`）

两个 **28×28** 按钮（赞/踩）插入助手操作行，`border-radius:var(--dsw-radius-sm)`，字形 15px，禁用 `opacity:.4`。弹窗 `width:min(488px,100%); border-radius:var(--dsw-radius-panel); gap:38px`；分类 chip 高 28px；`textarea` `min-height:116px; max-height:280px`；提交键 44px 通栏。

### 9. Composer / 输入框（`ui-conversation` + `ui-attachment` + `ui-input-trigger`）

```
div.root(.hero)
  Toast / div.notice
  div.card[data-composer-card]
    div.overlayAnchor
    div.accessory
    ComposerAttachments
    DraftEditor: div.scroll > div.grow > contenteditable.input + span.placeholder
    div.row
      div.tools: button.add(28×28 圆) + 隐藏 file input + div.modes
      div.trailing: standardControls(input.right + model) + activity + button.primary(34×34 圆)
  div.dock: composer.dock slot + ContextMeter
```
- 卡：`gap:12px; padding-top:8px; border-radius:var(--dsw-radius-panel); background:var(--dsw-specific-input-major); box-shadow:var(--dsw-elevation-soft); font-size:var(--dsh-content-font-size,14px)`
- 输入区：`caret-color: var(--dsw-alias-state-business-primary)` ← **官方唯一的"光标色"来源，没有闪烁动画**
- 发送键：`34×34; border-radius:999px; background:var(--dsw-alias-button-info-fill); color:#fff; transform:translateY(-2px); disabled opacity:.4`；运行中显示 16px 方块（停止）
- 附件轨道：`.rail { gap:10px; overflow-x:auto; scrollbar-width:none }`；文件卡 **240×64**；图片缩略 **64×64**（radius xl）
- 斜杠/`@` 菜单：`position:absolute; bottom:calc(100% + 4px); z-index:100; max-height:400px; padding:4px`；条目 `min-height:34px; padding:6px 8px; border-radius:var(--dsw-radius-md); font-size:13px/20`
- `ui-reference` 包**没有组件**（只有 index/locales）；引用 chip 实际在 `ui-conversation/.../ReferenceChip.tsx`：`inline-flex; gap:3px; max-width:240px; color:var(--dsw-alias-state-business-primary)`

### 10. 基础件（`ui-primitives`）

| 组件 | 关键值 |
|---|---|
| `Button` | `gap:4px; border-radius:var(--dsw-radius-md); padding:0 14px; font-size:14px/22`；`.md` 36px、`.sm` 28px/12px/`radius-sm`；变体 primary / ghost / outline(0.5px border-l3) / toolbar |
| `DisclosureRow` | 折叠行通用件：`height:calc(24px + delta)`、`[16px leading] gap6 [13px/24 title]`；**思考块、工具卡、命令卡、上下文注入都用它** |
| `Tooltip` | `padding:3px 7px; border-radius:var(--dsw-radius-sm); background:var(--dsw-alias-tooltip-bg); font-size:13px/20; max-width:50vw`；进入 150ms |
| `Pill` | `height:24px; padding:0 8px; border-radius:999px; font-size:12px/18; background:var(--dsw-alias-bg-layer-2)` |
| `Tag` | `padding:1px 8px; border-radius:999px; font-size:11px/17 wt500`；状态色是 10–12% `color-mix` |
| `StateDot` | 状态点：`done/warning/ongoing/error/idle`；默认边长 14（ongoing）/10；**ongoing 就是全站唯一的 spinner** |
| `Modal` | `width:min(380px,100%); border-radius:var(--dsw-radius-panel); background:var(--dsw-alias-bg-layer-2); gap:20px`；标题 16px/24 wt500 |
| `TextShimmer` | 流式高亮：`1.5s + 0.3s delay`，`steps(48,end)`，`linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%)` |
| 滚动条 | 无组件；全局皮肤 `scrollbar.css`：`--dsh-scrollbar-width:5px`，thumb `border-radius:999px` |
| 图标 | 无通用 `<Icon>`；每个图标是独立组件，`IconProps { size?, className? }`，`currentColor` |

---

## d) logo 与图标

### 真实资源位置（**不是**独立 .svg，而是内联 SVG 的 React 组件）

| 资产 | 位置 | 形态 |
|---|---|---|
| **鲸鱼标记 `FishLogo`** | `packages/client/ui-primitives/src/FishLogo.tsx` | 单 `<path>`，`viewBox 0 0 23.16 17.04`，`fill="currentColor"`，`aria-hidden`，`size` 默认 **24**（宽 px，高 = 24×17.04/23.16 ≈ 17.66） |
| **组合字标 `BrandWordmark`** | `packages/client/ui-primitives/src/BrandWordmark.tsx` | 一个 SVG 含：鲸鱼 + "DeepSeek" 10 段字形 path + `rect x=129.348 y=5.5 w=52 h=14 rx=2` 徽标内含 "dsh" 挖空字。`viewBox 0 0 182 24`（`includeMark=false` 时为 `26 0 156 24`）；默认 `size=24, includeMark=true` |
| 官方品牌插件 | `packages/client/ui-brand-official/src/client/{Brand.tsx,index.ts}` | 只是把上面两个注册进 slot：`sidebar.brand.mark` / `sidebar.brand.name`；且仅在 `DSH_CLIENT_BUILD_PROFILE === 'official'` 时生效 |
| favicon（Web） | `apps/web/public/favicon.svg`（黑）、`favicon-dark.svg`（白） | **50×50**，单 path，几何与 `FISH_LOGO_PATH` 相同（精度不同） |
| favicon / 字标（官网） | `website/public/favicon.svg`（`fill="#4D6BFE"`）、`website/public/wordmark.svg`（143×23） | 官网用品牌蓝 `#4D6BFE` |
| 桌面图标 | `apps/desktop/resources/icon{,-macos,-windows}.svg` + png/ico | 1104×1104 / 1024×1024 圆角方，鲸鱼填充渐变 `#1C2434 → #0F1115` |
| 启动页 | `packages/client/web/src/boot-page.ts:37` | **不用鲸鱼**，是文字 `HARNESS`（`letter-spacing:0.08em`） |

### `FISH_LOGO_PATH`（逐字抄自 `FishLogo.tsx:7`）

```
M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746L11.1749 14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z
```

字标的 10 段 "DeepSeek" 字形 path 与徽标内 "dsh" 字形 path 同理抄自 `BrandWordmark.tsx:27-47`（10+7 段，较长，需要时按行号取；`<defs>` 在 `:49-56`，两个 `clipPath`：`dsh-wordmark-whale-clip`、`dsh-wordmark-badge-clip`）。

### logo 在界面里出现的位置与尺寸（**只有两处渲染面**）

| 位置 | 渲染尺寸 | 出处 |
|---|---|---|
| 侧栏折叠态轨道按钮（`railMark`） | **24px** | `ui-sidebar/src/client/SidebarRoot.tsx:188-189` |
| 侧栏展开态 `.logoRow`（同时是新会话快捷区/窗口拖拽区，行高 60px） | **24px**，右侧跟随 `brandName` 槽 | `SidebarRoot.tsx:216,225,227-238` |
| 空白会话 hero 的鱼 | **34px**（34×25），hover 时游动 | `ui-conversation/.../EmptyHero.tsx:148-149`；`ui-brand-official/src/client/index.ts:11-13` 说明官方构建**不注册**该槽，保持 fallback |

### 商标与许可（务必遵守）

- `LICENSE:1-3`：MIT，`Copyright (c) 2026 DeepSeek`；正文**没有**商标/品牌素材的例外条款。
- `THIRD_PARTY_NOTICES.md:6`：只说第三方依赖各自许可，**没有任何 logo/商标条目**。
- `BRAND_GUIDELINES.md:7-10`（`.zh.md:7-10`）：
  - 允许用**描述性文字**说明关系（如 "built on DeepSeek Harness"）；
  - 项目名里若需要体现生态关联，用缩写 **"DSH"**；
  - **不得**在项目名里使用完整商标 "DeepSeek Harness"（明示为注册商标）；
  - 不得用官方品牌素材暗示官方背书/合作/授权。
- 结论：**"logo 是否被 MIT 覆盖"在仓库里没有明文**，只有商标条款与使用限制。本项目因此按 FIX.md §1.7 处理：logo **只出现在它原本所在的位置**（界面侧栏/hero），不做成影片自己的标志，保留 `useOfficialLogo` 开关与 README 的非官方声明。

---

## e) 动效

### 时长与曲线（`base.css:12-15`）

`--ds-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)`；duration `0.2s` / fast `0.1s` / slow `0.3s`。

最常用的 `transition`（全仓 `packages/client/**/*.css` 计数）：

| 声明 | 出现次数 |
|---|---|
| `opacity 100ms ease` | 10 |
| `transform 120ms ease` | 9 |
| `color 100ms ease` | 8 |
| `transform 160ms ease` | 3 |
| `opacity 0.2s ease-in-out` | 3 |
| `background-color 120ms ease` / `border-color 120ms ease` | 各 3 |
| `transform 120ms var(--ds-ease-in-out)` | 2 |
| `transition: none`（几乎全在 `prefers-reduced-motion` 块里） | 26 |

### 关键 keyframes（可直接抄）

| 用途 | 定义 | 出处 |
|---|---|---|
| 流式 shimmer 扫过 | `.sweep/.highlight { animation-duration:1.5s; animation-delay:0.3s; animation-timing-function:steps(48,end); animation-iteration-count:infinite }`；遮罩 `linear-gradient(105deg, transparent 0%, black 40% 60%, transparent 100%)`；`dsh-row-shimmer-sweep: 0%{translateX(-100%)} → 66.6667%,100%{translateX(100%)}` | `TextShimmer.module.css:34-77` |
| 运行中转圈（全站唯一 spinner） | `dsh-state-dot-spin { to { transform: rotate(360deg) } }` 1.5s linear；`dsh-state-dot-dash { 0%{dasharray:12 150;offset:0} 50%{24 150;-6} 100%{12 150} }` 1.5s ease-in-out | `StateDot.module.css:37-95` |
| 骨架脉冲（4 处复用同一形状） | `0%{opacity:1} 40%{opacity:.6} 80%,100%{opacity:1}`，`2s cubic-bezier(0.36,0,0.64,1) infinite` | `WorkspaceBrowser.module.css:436-440`、`MenuView.module.css:220-224` 等 |
| 侧栏轨道滑入 | `rail-in { from { opacity:0; transform: translateX(49px) } }`，`150ms var(--ds-ease-in-out) backwards` | `SidebarRoot.module.css:159-171` |
| 淡入 | `wide-in { from { opacity:0 } }`，`200ms var(--ds-ease-in-out)` | `SidebarRoot.module.css:146-148,347` |
| Toast 进出 | 进 `translate(-50%,-6px) → (-50%,0)`；出 `to { opacity:0; visibility:hidden }`；`1000ms ease var(--dsh-toast-hold,3000ms) forwards` | `Toast.module.css:76-99` |
| 输入待处理 | `input-pending { opacity:0.35 → 1 }`，`1s ease-in-out infinite alternate` | `InputBar.module.css:157-163` |
| 终端光标（唯一闪烁光标） | `terminal-cursor-blink { 0%{bg:var(--terminal-cursor)} 50%{bg:var(--terminal-cursor-cell-background)} }`，`1s step-end infinite`，**仅终端** | `ui-sidebar-terminal/src/client/terminal.module.css:19` |
| hero 鱼游动 | `hero-fish-swim { 0%,100%{transform:none} 35%{rotate(-4deg) translate(-0.4px,-0.9px)} 70%{rotate(1.6deg) translate(0.3px,0.2px)} }`，`1.6s ease-in-out infinite`，仅 hover + 非 reduced-motion | `HeroShell.module.css:101-119` |
| 启动页进度环 | `spin { to { transform: rotate(360deg) } }` 0.8s linear；进度用 JS 变量 `--dsh-boot-arc`（72deg→288deg） | `boot-page.module.css:45-70`、`boot-page.ts:99-102` |

### 流式输出的真实做法（重要）

- **没有**逐词打字机节流，也**没有**助手文本的光标闪烁（markdown 渲染器里 grep caret/cursor/blink 为空）。
- 平滑靠两件事：
  1. **帧批量发布**：`ui-conversation/src/client/conversation/assembly.ts:140-157` 的 `publish()` 在 `'animation-frame'` 模式下**连续跨三次 rAF** 才 flush（注释："Cross three paint opportunities before publishing high-frequency stream updates"），期间合并更新；`store/src/index.ts:71-88` 的 `rafBatch(notify)` 把订阅通知合并到一帧一次。
  2. **增量 markdown 冻结**：`ui-primitives/src/markdown/incremental.ts` 只重解析尾部；`MarkdownText.tsx:66-147` 把"除最后两块"缓存成不变的 React 元素，每帧只重解析尾巴。
- 结论：要"看起来像官方"，做法是**批量 + 冻结 + shimmer**，而不是逐字符 setTimeout。

---

## f) 哪些要艺术夸张、哪些必须准确

### 必须准确（照抄数值，别自由发挥）

1. **三列网格与列宽**：264–420（默认 280）／中栏 `minmax(400px,1fr)`／右栏 300–70% 且默认 45%；折叠轨道 56px；< 1024 自动折叠。
2. **圆角体系**：4 / 8 / 12 / 16 / 20 / 28，以及 `999px` 用于胶囊与圆形按钮。
3. **字号与行高**：正文 14px/`calc(22px+delta)`（气泡）、助手 14px/`calc(24px+delta)`、折叠行 `calc(24px+delta)`、次要 `13px/20`、附件卡 240×64、按钮 md 36px / sm 28px、发送键 34×34、操作键 28×28。
4. **颜色语义**：`specific-bubble` 用户气泡、`specific-input-major` composer 卡、`markdown-code-block` 代码底、`state-business-primary` = 品牌蓝（深度求索蓝 65,118,230 / 122,170,255）、warn = amber、error = red、`label-*` 三级文字。亮暗两套必须各自取值，不能只做一套。
5. **描边优先于阴影**：分离靠 `0 0 0 0.5px` 描边（`elevation-stroke`），阴影非常轻。这是官方观感的关键，别加厚重投影。
6. **暗色用的是 `data-ds-dark-theme` 而非系统偏好**，且暗色底 `rgb(21,21,23)`，不是纯黑。
7. **logo 的真实形状与位置**：`FishLogo` 的 path 逐字使用；只出现在侧栏（24px）与空白 hero（34px）这两个原位置。
8. **动效曲线**：`cubic-bezier(0.4,0,0.2,1)`；100/120/150/160/200ms 的常规档位；shimmer 的 `1.5s + 0.3s delay + steps(48)`；状态 spinner `1.5s`。
9. **键盘语义**：审批 `Enter`=allow once、`Escape`=reject。

### 可以（也应该）艺术夸张

1. **全宽顶栏**：官方 Web 版**没有**跨列顶栏（只有 macOS 标题栏座位）。我们 PV 的"顶栏 HUD"是虚构，允许存在，但应当明确它是"dsh 客户端风格"的原创仿作，不复刻任何商业产品。
2. **会话交接卡片（handoff）**：官方**不存在**。措辞必须原创（FIX.md 段 N 已规定），形态可借 `ApprovalPanel` 的卡结构（描边 + warn 色条 + 标题 + 正文 + 按钮行）。
3. **上下文占用的巨大化**：官方是 14px 圆环 + 13px 百分比；PV 里放大成画面主元素是必要的艺术处理（FIX.md §3 段 J 要求 ≥200px 巨字）。
4. **工具调用卡片墙 / 卡片飞入**：官方是列表行；PV 里做成 3D 卡片是夸张。
5. **代码墙**：官方代码块最大 260px 滚动、`markdown-code-block` 底；PV 里做成大字号 3D 长廊是夸张，但字体族与语法高亮配色应沿用代码字体栈与官方色板。
6. **振动/故障/色散/径向模糊**：官方只有 150ms 级淡入与 shimmer；PV 的强度必须自己定（FIX.md §2.4 已规定）。
7. **鲸鱼娘本身**：官方界面里只有 24px/34px 的鱼形 logo，没有角色立绘。立绘是我们完全新增的内容。
8. **窗口套娃/终端滚屏**：官方有终端（含闪烁光标）与侧栏面板，但 PV 里"无限递归窗口"是夸张；且 FIX.md §0.2 要求**减少**终端元素。

---

---

## g) 实机对照：官方 `pnpm dsh web` 与本项目 `?dshpreview`（F2a 第 7 条）

F2a 期间实际把官方仓库跑起来了，不是只读源码：

```bash
cd "D:/文档/GitHub/deepseek-harness"
npx pnpm install          # 首次
npx pnpm build            # 必须先构建：apps/web 与各 client 包的 lib/*.js 不在仓库里
npx pnpm dsh web --no-open
# → dsh web: http://127.0.0.1:3080/?token=...
```

实测结论（1920×1080，浅色，官方 0.2.0-rc.2）：

* 页面根节点是 `<html lang="zh-CN" data-ds-theme-source="system" style="color-scheme: light">`；
  **暗色不是靠 `data-ds-dark-theme` 在 html 上切换**，而是 `data-ds-theme-source` + `color-scheme`。
  本项目的 DOM 层沿用 `#dsh-layer[data-ds-dark-theme]` 这一套（见 b 节 token 抄写），
  是**为 PV 而定的实现**，与官方开关方式不同但不影响观感 —— 记为已知差异。
* `body` 正文字体 = 系统无衬线栈，与本项目 `--dsw-font-family` 一致；
  **整个聊天界面里没有一处用 Montserrat**（`--dsw-font-family-brand` 只出现在
  `ui-settings-account/DesktopOnboarding.module.css`）。本项目把品牌区名字用 Montserrat，
  属于"品牌字样"用法（官方 token 就是这么定义的），记为**有意的差异**。
* 侧栏真实结构（来自官方 DOM 快照，非推测）：

  | 位置 | 官方元素 |
  |---|---|
  | 品牌区 | `button "新建会话"` 内含产品名 `DSH 本地构建` + 版本号 `0.2.0-rc.2-639ed01`；右侧 `button "收起侧边栏"` |
  | 主导航 | `button "新建会话"`（带 `Ctrl + Alt + N` 快捷键提示）、`button "技能中心"`、`navigation "全局面板" > button "插件"` |
  | 分组头 | `工作区` + 三个图标按钮：`搜索会话` / `视图选项` / `添加工作区` |
  | 会话树 | `tree "会话"`：`treeitem "desktop" [expanded]`、`treeitem "新会话" [selected]`、`treeitem "只回复ok" + 右侧相对时间 "12小时"` |
  | 底部 | `button "上下文洞察"`、`button "设置"` |
  | 中栏顶部 | `banner` + `button "打开右侧边栏"`（**没有**跨列顶栏） |
  | hero | `探索未至之境` + `预览版` |
  | composer | `button "选择工作区"`、`button "标准模式"`、`textbox`（占位符 `描述你想要构建的内容, / 调用指令, @ 文件或对话`）、`button "添加文件或调用指令"`、`button "访问模式，当前：完全权限"`、`button "选择模型，当前 DeepSeek-V41-Flash，推理等级 Max"`、`button "发送消息" [disabled]` |

* **右侧栏默认收起**，开关在顶部 banner 里 —— 印证"右栏是可折叠第三列"，本项目因此把它做成
  `--dsh-right-w`（0 = 收起，300px = 展开），由调用方按窗口指定。

### 逐项差异与修正（本轮已落地）

| # | 差异 | 修正 |
|---|---|---|
| 1 | 侧栏缺主导航（官方有 新会话 / 技能中心 / 插件） | 加 `.dsh-nav` 三个入口；"New session" 带 `Ctrl + Alt + N` 快捷键提示 |
| 2 | 品牌区只有"名字 + 徽章"，官方是"名字 + 版本行" | 改成 `DeepSeek` + `DeepSeek Harness 0.1.0` 两行，并在右侧加折叠按钮图形 |
| 3 | 会话是平铺列表，官方是 分组头 + 工作区节点 + 会话行（右侧相对时间） | 改成 `workspace` 分组头（带 3 个图标）+ `world` 工作区行 + 缩进的会话行（`now` / `12h`） |
| 4 | 侧栏底部只有一个模型名 | 加 `context` / `settings` 两个入口行，模型名保留在最下 |
| 5 | composer 是"占位符 + 一行 chip（访问模式、模型、发送）"，顺序与官方不符 | 改成官方顺序：左 `world` / `standard`，右侧 `workspace-write` / `whale-maid` / 圆形发送按钮 |
| 6 | 中栏顶部没有"打开右侧边栏"按钮 | header 右侧加 `.rail-toggle` |
| 7 | 右栏固定不出现 | 右栏由 `WINDOW_GEOM.*.rightPx` 决定（段 G/I/N 展开 300px，其余收起），与官方一致 |
| 8 | 会话窗口内容被自身布局挤出（composer 整块消失） | `.dsh-frame` 网格行改 `minmax(0, 1fr)`，是**真 bug**，与官方对照时才发现 |
| 9 | 权限弹窗居中于整个舞台 | 改成居中于"该窗口"（官方弹窗属于主区） |
| 10 | 上下文读数出现两个不同的数（header 34% / dock 1%） | dock 的 `clamp(pct)` 误用了 `clamp(v,a=0,b=1)`，实为钳到 1；改 `clamp(pct,0,100)` |

### 仍然有意的差异（不改）

1. **文案全部原创英文短句**：官方是中文长句与真实快捷键说明；PV 里必须短、完整、可读
   （用户 F2a 第 5 条），内容集中在 `src/ui/content.js` 一张表里。
2. **本地化**：官方 `data-ds-theme-source` 机制不采用（见上）。
3. **hero 区**：官方有 `探索未至之境 / 预览版` 欢迎块；PV 的对应位置始终有对话内容，不画 hero。
4. **比例**：官方窗口铺满视口；PV 里是一个占画面 45–60% 宽的**悬浮玻璃面板**（FIX §2.3 要求）。


---

## 附：MIT 片段借用清单（F1 落地时填写）

借用官方 MIT 代码/资源时，必须逐条登记到本表，并在 `public/dsh/LICENSE-dsh.txt` 保留 MIT 声明与版权行，同时记入 `public/whale/NOTICE.md` 的改动清单（FIX.md §1.6）。

| # | 借用的东西 | 官方路径 | 用途（本项目位置） | 是否逐字复制 | 改动说明 |
|---|---|---|---|---|---|
| 1 | `FISH_LOGO_PATH` + viewBox `0 0 23.16 17.04` | `packages/client/ui-primitives/src/FishLogo.tsx` | DOM 侧栏品牌区；Canvas 开机画面的标志（`src/ui/logo.js` 的 `fishLogoSvg()` / `drawFishLogo()`） | 是 | 无（path 逐字复制） |
| 2 | Montserrat `montserrat-{regular,medium,light}.woff2` + `Montserrat-OFL.txt` | `packages/client/ui-theme/src/styles/` | 品牌字样（`public/dsh/fonts/`，CSS `@font-face`） | 是 | 无（OFL 允许再分发） |
| 3 | `--dsw-*` 亮/暗 token 取值 | `packages/client/ui-theme/src/styles/{base,design-platform}.css` | `src/ui/dsh.css` 的 token 块 | 取值逐条抄写 | 只取本项目用到的子集 |
| 4 | 字体栈 `--dsw-font-family` / `--ds-font-family-code` | 同上 | `src/ui/text.js` 的 `FONT`、`src/ui/dsh.css` | 是 | 去掉未加载的 `Inter`（见决策日志） |

> 授权依据：`LICENSE`（MIT, Copyright (c) 2026 DeepSeek）。品牌名称与商标不随 MIT 授予（`BRAND_GUIDELINES.md:9`），非官方声明必须保留。
