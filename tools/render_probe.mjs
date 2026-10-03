#!/usr/bin/env node
// tools/render_probe.mjs — 开发期工具：连续渲染同一个 t 两次，逐块比较画布差异，定位不确定性的**位置**。
// 用法: node tools/render_probe.mjs --url "http://127.0.0.1:5173/" --t 2.0

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { killTree } from './kill_tree.mjs'

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
].filter(Boolean).find((p) => existsSync(p))
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const url = arg('url', 'http://127.0.0.1:5173/')
const T = parseFloat(arg('t', '2.0'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 10500 + Math.floor(Math.random() * 300)
const profile = join(tmpdir(), 'dshpv-rp-' + randomBytes(4).toString('hex'))
mkdirSync(profile, { recursive: true })
const child = spawn(CHROME, ['--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
  '--no-first-run', '--mute-audio', '--window-size=1280,720', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' })
const cleanup = () => { killTree(child); try { rmSync(profile, { recursive: true, force: true }) } catch (e) {} }

async function main() {
  let list = null
  for (let i = 0; i < 80 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() } catch (e) { await sleep(250) } }
  const page = list.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }) })
  let id = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value }
  await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url })
  for (let i = 0; i < 120; i++) { await sleep(500); if (await evaluate('!!window.__renderAt').catch(() => false)) break }
  await sleep(800)
  const expr = `(() => {
    const W = 1920, H = 1080, COLS = 12, ROWS = 8;
    const cw = Math.floor(W / COLS), chh = Math.floor(H / ROWS);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const grab = () => { g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,H); g.drawImage(document.getElementById('stage'),0,0,W,H); return g.getImageData(0,0,W,H).data };
    window.__renderAt(${T}); const a = new Uint8ClampedArray(grab());
    window.__renderAt(${T}); const b = grab();
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      let diff = 0, tot = 0, maxd = 0;
      for (let y = r*chh; y < (r+1)*chh; y += 2) for (let x = c*cw; x < (c+1)*cw; x += 2) {
        const i = (y*W + x)*4;
        const d = Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
        if (d > 0) diff++;
        if (d > maxd) maxd = d;
        tot++;
      }
      if (diff) cells.push({ r, c, diff, tot, maxd });
    }
    let total = 0; for (let i = 0; i < a.length; i += 4) if (a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) total++;
    return JSON.stringify({ t: ${T}, totalDiff: total, cells: cells.slice(0, 40) });
  })()`
  console.log(await evaluate(expr))
  ws.close(); cleanup()
}
main().catch((e) => { cleanup(); console.error('FAILED:', e.message); process.exit(1) })
