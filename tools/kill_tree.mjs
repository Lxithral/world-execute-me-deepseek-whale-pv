// tools/kill_tree.mjs — 收尾无头浏览器的**整个进程树**（开发期工具）
//
// 为什么不能只用 child.kill()：Chrome 会派生 gpu-process / renderer / utility 等子进程，
// 只杀父进程会留下孤儿进程（实测跑几十次截图后会攒下一把 chrome.exe）。
// Windows 上用 taskkill /T 才能整棵树一起收；POSIX 上退化为 kill 进程组。
//
// ⚠️ 只用于我们自己 spawn 的、带 `--headless=new` 与临时 `--user-data-dir` 的实例。
// **绝不能**拿去杀用户正在用的 Chrome —— 那会关掉他的浏览器窗口。

import { execFileSync } from 'node:child_process'

/**
 * @param {import('node:child_process').ChildProcess} child spawn() 出来的子进程
 */
export function killTree(child) {
  if (!child || child.exitCode != null || child.killed) {
    // 已经退出：仍然按 pid 兜一次（子进程可能还活着）
  }
  const pid = child && child.pid
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGKILL')
    }
  } catch (e) {
    // taskkill 在进程已消失时返回非 0，属正常
    try {
      child.kill('SIGKILL')
    } catch (e2) {
      /* ignore */
    }
  }
}

export default killTree
