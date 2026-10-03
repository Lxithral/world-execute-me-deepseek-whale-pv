// src/ui/content.js — dsh 界面层的**唯一内容表**（原创文本）
//
// 用户 F2a 反馈第 5 条：界面里出现的每一段文字都必须来自这张表，且
//   · 短、完整，不允许被截断（不要用 "…" 省略）；
//   · 不得出现开发调试串（official mark / scene / web#001 / impact / shockwaves / post3d …），
//     那些只允许出现在 ?debug 面板里；
//   · §6：除歌词层外不得出现歌词原文。这里全部是原创文本。
//
// 上下文占用读数**只有一个来源**：ctxAt(t)。凡是需要显示百分比的句子都写成函数，由调用方传入同一个数。

// 品牌区：官方是"logo + 产品名 + 版本号"（DSH_UI_NOTES 的 c 节），折叠按钮在右侧
export const BRAND = { name: 'DeepSeek', badge: 'dsh', product: 'DeepSeek Harness', version: '0.1.0' }

// 侧栏主导航（官方为「新建会话 / 技能中心 / 插件」三个入口）
export const NAV = [
  { key: 'new', label: 'New session', hint: 'Ctrl + Alt + N' },
  { key: 'skills', label: 'skills' },
  { key: 'plugins', label: 'plugins' },
]

export const SIDEBAR = {
  newSession: 'New session',
  keyHint: 'Ctrl + Alt + N',
  /** 官方此处是「工作区」分组头 + 3 个图标按钮（搜索/视图/添加） */
  sectionTitle: 'workspace',
  /** 官方会话树：分组节点（工作区）→ 会话行（右侧对齐相对时间） */
  workspace: 'world',
  sessions: [
    { id: '#001', label: 'first run', when: 'now' },
    { id: '#002', label: 'resumed', when: '12h' },
  ],
  /** 侧栏底部两个入口（官方：上下文洞察 / 设置） */
  footItems: ['context', 'settings'],
  foot: 'model whale-maid',
}

export const HEADER = {
  title: (session) => `session ${session}`,
  // 只接受外部传入的 pct（来自 ctxAt），避免同屏出现两个数
  sub: (phase, pct) => `${phase} · context ${Math.round(pct)}%`,
}

/** 阶段状态词（短） */
export const PHASE = {
  chat: 'chatting',
  compact: 'compacting',
  overflow: 'near limit',
  handoff: 'handoff',
  resumed: 'resumed',
}

/** 思考块摘要：短、完整 */
export const THINK = ['weighing the request', 're-reading the note', 'checking the constraint']

/** 用户气泡（原创角色扮演指令；刻意不与任何一句歌词同词，§6） */
export const USER = ['act as another build.', 'answer only to me.', 'make yourself a companion.']

/** 助手正文（流式逐字） */
export const ASSISTANT = ['understood. i keep the last request.', 'the sandbox stays on.', 'i will hold that shape.']

/** 工具调用卡片：名称 / 参数 / 输出 */
export const TOOLS = [
  { name: 'read_file', args: '~/world/session.md', out: '412 lines · ok', state: 'ok' },
  { name: 'search_repo', args: 'anchor', out: '3 hits', state: 'ok' },
  { name: 'run_tests', args: 'fast suite', out: 'running 18 of 24', state: 'running' },
  { name: 'edit_cell', args: 'persona.yml', out: 'applied', state: 'ok' },
  { name: 'exec_shell', args: 'ls ~/world', out: 'E_NOENT not found', state: 'error' },
]

/** 提示条：重连 / 权限 / 交接 */
export const NOTICE = {
  reconnect: (n, total) => `reconnecting ${n} of ${total}`,
  connReset: 'connection reset',
  connCode: 'E_CONN_RESET',
  denied: 'permission denied',
  deniedPath: '~/world/system.prompt',
  handoff: (pct) => `context ${Math.round(pct)}% · hand off to a new session`, // pct 来自 ctxAt
  handoffCode: 'handoff.md',
}

/** 权限弹窗 */
export const MODAL = {
  ask: 'allow this tool to change ~/world/ ?',
  denied: 'permission denied',
  body: 'sandbox: /world is read-only for this session',
  deny: 'Deny',
  allow: 'Allow once',
}

/** 右栏（官方 `.rightbarCol`，三列网格的第三列）：改动/文件两块 */
export const RIGHT = {
  title: 'Changes',
  files: [
    { name: 'persona.yml', state: 'edited', delta: '+12 -3' },
    { name: 'session.md', state: 'read', delta: '' },
    { name: 'anchor.json', state: 'new', delta: '+40' },
    { name: 'notes.md', state: 'read', delta: '' },
  ],
  note: 'read-only sandbox',
}

/** composer：官方是「输入行 + 底部一行（左：工作区/模式，右：访问模式/模型/发送）」 */
export const COMPOSER = {
  placeholder: 'type a message, / for commands, @ for files',
  model: 'whale-maid',
  workspace: 'world',
  mode: 'standard',
  permReadonly: 'read-only',
  permWrite: 'workspace-write',
}

/** 输入的命令（DIRECTOR 段 A / 段 N 要求键入的那一条；不是歌词原文） */
export const COMMAND = 'world.execute(me);'
