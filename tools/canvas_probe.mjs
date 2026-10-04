#!/usr/bin/env node
// tools/canvas_probe.mjs — 开发期工具：把页面上某个 canvas（或某个物件的贴图画布）导出成 PNG。
// 用途：定位"贴图本身是不是就有重影"这类只能看图才能判断的问题。
// 用法：
//   node tools/canvas_probe.mjs --url "http://127.0.0.1:5173/?demo=wall&shot=3" \
//     --expr "window.__app.SCENES.find(s=>s.demo).wall.panels[0].texture.image" --out .tmp/panel0.png

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { killTree } from './kill_tree.mjs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => existsSync(p))

function arg(name, dflt = null) {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const url = arg('url')
const expr = arg('expr')
const out = arg('out', '.tmp/canvas-probe.png')
if (!url || !expr) {
  console.error('用法: --url <URL> --expr "<返回 HTMLCanvasElement 的表达式>" [--out x.png]')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 10100 + Math.floor(Math.random() * 300)
// ✅ T24：复用同一个 user-data-dir，且不在本进程里删（见 tools/shoot.mjs 的说明）
const profile = join(tmpdir(), 'dshpv-chrome')
mkdirSync(profile, { recursive: true })
const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--no-first-run', '--mute-audio', '--window-size=1280,720',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' })
const cleanup = () => { killTree(child) }

async function main() {
  let list = null
  for (let i = 0; i < 80 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch (e) { await sleep(250) }
  }
  const page = list.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    // ⚠️ T24 顺手修：原来写 `p.rej(...)`/`p.res(...)`，而 `pending.set` 存的是 `{ resolve, reject }`
    // → 一收到回包就抛 `p.res is not a function`（这个探针此前也跑不通）。
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }
  })
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result?.value
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.navigate', { url })
  for (let i = 0; i < 120; i++) {
    await sleep(500)
    if (await evaluate('!!window.__probeFrame').catch(() => false)) break
  }
  await sleep(600)
  const dataUrl = await evaluate(`(${expr}).toDataURL("image/png")`)
  const p = resolve(out)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log(`png -> ${p} (${Math.round(Buffer.from(dataUrl.split(',')[1], 'base64').length / 1024)} KB)`)
  ws.close(); cleanup()
}
main().catch((e) => { cleanup(); console.error('FAILED:', e.message); process.exit(1) })
