#!/usr/bin/env node
// tools/selftest.mjs — 开发期工具：用 CDP 驱起 ?selftest 并把结果打回终端。
// 为什么需要：浏览器里的自检结果原本只能靠人肉在页面上看；接进命令行才能进 `npm run` 流程。
// 不修改任何门槛：它只是把 window.__selftestState.lines 原样打印出来。

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { killTree } from './kill_tree.mjs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => existsSync(p))

const url = process.argv[2] || 'http://127.0.0.1:5173/?selftest'
const timeoutMs = parseInt(process.argv[3] || '2400000', 10)
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9800 + Math.floor(Math.random() * 190)
const profile = join(tmpdir(), 'dshpv-st-' + randomBytes(4).toString('hex'))
mkdirSync(profile, { recursive: true })
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio',
  '--window-size=1280,720', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' })

const cleanup = () => {
  killTree(child)
  try { rmSync(profile, { recursive: true, force: true }) } catch (e) {}
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(m.error.message)) : resolve(m.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('CDP 超时 ' + method)) } }, 300000)
    })
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
}

async function main() {
  let list = null
  for (let i = 0; i < 80 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch (e) { await sleep(250) }
  }
  const page = list.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  const cdp = new CDP(ws)
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url })

  const t0 = Date.now()
  let printed = 0
  while (Date.now() - t0 < timeoutMs) {
    await sleep(2000)
    let snap = null
    try {
      snap = await cdp.evaluate('window.__selftestState ? JSON.stringify({lines: window.__selftestState.lines, done: window.__selftestState.done}) : null')
    } catch (e) { /* 页面还在加载 */ }
    if (!snap) continue
    const st = JSON.parse(snap)
    for (; printed < st.lines.length; printed++) console.log(st.lines[printed])
    if (st.done) {
      const fails = st.lines.filter((l) => l.startsWith('FAIL'))
      console.log(`\n[selftest] ${st.lines.length} 项，FAIL ${fails.length} 项，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      ws.close(); cleanup()
      process.exit(fails.length ? 1 : 0)
    }
  }
  console.error('自检超时')
  ws.close(); cleanup()
  process.exit(1)
}

main().catch((e) => { cleanup(); console.error('FAILED:', e.message); process.exit(1) })
