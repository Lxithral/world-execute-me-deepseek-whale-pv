#!/usr/bin/env node
// tools/shoot.mjs — 开发期验证工具（不是交付物，不进 dist）
//
// 无头 Chrome 的 --screenshot 抓不到 WebGL 后备缓冲（实测抓到全黑），
// --dump-dom 在虚拟时间下又时好时坏。所以这里用 CDP（Chrome DevTools Protocol）直连：
//   · 启动 headless Chrome（SwiftShader 软件渲染）
//   · 连 WebSocket 到页面 target
//   · 用 Runtime.evaluate 调 window.__probeFrame(t) 拿机器可读状态
//   · 用 canvas.toDataURL() 取**真实合成结果**并存成 PNG
//
// 用法：
//   node tools/shoot.mjs --url "http://127.0.0.1:5173/?demo=props&shot=4" --out .tmp/props.png
//   node tools/shoot.mjs --url "..." --probe objs --json
//   node tools/shoot.mjs --url "..." --eval "window.__app.post3d.enabled"
//
// 依赖：Node 22+ 内置 WebSocket（本项目 Node 24）。只用内置模块。

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { killTree } from './kill_tree.mjs'

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean)

function parseArgs(argv) {
  const out = { url: null, out: null, probe: '', eval: null, json: false, timeout: 90000, width: 1920, height: 1080, port: 0 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--url') out.url = argv[++i]
    else if (a === '--out') out.out = argv[++i]
    else if (a === '--probe') out.probe = argv[++i] || '1'
    else if (a === '--eval') out.eval = argv[++i]
    else if (a === '--json') out.json = true
    else if (a === '--wait-for') out.waitFor = argv[++i]
    else if (a === '--timeout') out.timeout = parseInt(argv[++i], 10)
    else if (a === '--width') out.width = parseInt(argv[++i], 10)
    else if (a === '--height') out.height = parseInt(argv[++i], 10)
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return await r.json()
    } catch (e) {
      /* 还没起来 */
    }
    await sleep(250)
  }
  throw new Error(`CDP 端点无响应：${url}`)
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.logs = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else res(msg.result)
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.logs.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.logs.push('EXCEPTION ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text))
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, reject) => {
      // ⚠️ T24：这个定时器必须**在 settle 时清掉**。原来不清 → 每个 send() 都留一个
      // 未清的 timer，Node 的事件循环因此一直活着（我把超时从 120s 放宽到 30min 之后，
      // 进程会在打印完结果后再挂 30 分钟，doctor 的 b2/d 直接报 `spawnSync … ETIMEDOUT`）。
      const t = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时：${method}`))
        }
        // T19c：全片扫描（~424 帧 × SwiftShader）远超过原来的 120s，单个 Runtime.evaluate
        // 会被这里误杀。放宽到 30 分钟；短探针不受影响（它们本来就秒回）。
      }, 1800000)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(t); res(v) },
        reject: (e) => { clearTimeout(t); reject(e) },
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expr, { awaitPromise = false } = {}) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise,
      userGesture: true,
    })
    if (r.exceptionDetails) {
      throw new Error('求值异常：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    }
    return r.result?.value
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.url) {
    console.error('用法：node tools/shoot.mjs --url <URL> [--out x.png] [--probe objs] [--eval "expr"] [--json]')
    process.exit(2)
  }
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
  if (!chrome) {
    console.error('找不到 Chrome/Edge')
    process.exit(2)
  }
  const port = args.port || 9300 + Math.floor(Math.random() * 500)
  // ✅ T24：「探针脚本清理与复用」。原来每次运行都新建一个**随机** profile、结束时 `rmSync` 删掉 ——
  // 实测这条链有两个问题：① 被中断（例如全片扫描时被 kill）就留下一个 30–50MB 的
  // `%TEMP%\dshpv-shoot-*`，本会话实测堆到 **102 个 / 3.43 GB**；② `rmSync` 一个刚被 Chrome
  // 写过的目录在本机上偶尔会**卡住几分钟**（doctor 的 b2/d 因此报 `spawnSync … ETIMEDOUT`）。
  // 现在**复用同一个 user-data-dir**、并且**不在本进程里删它** —— 目录长期只有一个。
  const profile = join(tmpdir(), 'dshpv-chrome')
  mkdirSync(profile, { recursive: true })

  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      `--window-size=${args.width},${args.height}`,
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  const cleanup = () => {
    // T24：只杀进程，**不删** 复用的 profile（见上面的说明）
    killTree(child)
  }

  try {
    const list = await fetchJson(`http://127.0.0.1:${port}/json/list`)
    const page = list.find((t) => t.type === 'page')
    if (!page) throw new Error('没有 page target')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    const cdp = new CDP(ws)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Page.navigate', { url: args.url })

    // 等页面就绪。
    // 就绪判据：`__probeFrame` 存在，**或者**调用方给了 --wait-for（有些诊断通道
    // ——例如 ?probe=textscan—— 在 boot 里提前 return，本来就不会挂 __probeFrame，
    // 它只用 --wait-for 指定的那个全局量表示"我好了"）。
    const deadline = Date.now() + args.timeout
    let ready = false
    while (Date.now() < deadline) {
      await sleep(400)
      try {
        ready = args.waitFor
          ? await cdp.evaluate(`!!(window.__probeFrame) || !!(${args.waitFor})`)
          : await cdp.evaluate('!!(window.__probeFrame)')
      } catch (e) {
        ready = false
      }
      if (ready) break
    }
    if (!ready) {
      const errs = await cdp.evaluate('JSON.stringify(window.__errors || [])').catch(() => '[]')
      const hasApp = await cdp.evaluate('!!window.__app').catch(() => false)
      const dom = await cdp.evaluate('document.body ? document.body.innerHTML.slice(0, 300) : "no body"').catch(() => '?')
      console.error('logs:\n' + cdp.logs.slice(-14).join('\n'))
      throw new Error('页面未就绪（__probeFrame 未挂载）hasApp=' + hasApp + ' errors=' + errs + '\nDOM: ' + dom)
    }
    // 字体与首帧稳定
    await sleep(400)

    /**
     * --wait-for "<expr>"：轮询直到表达式返回真值（最多 120s）。
     * 用于那些**异步**才能出结果的探针（例如 ?probe=textscan 把 424 帧的扫描推到
     * setTimeout 里跑，避免占满主线程饿死本驱动的轮询）。
     */
    if (args.waitFor) {
      const t0 = Date.now()
      let okWait = false
      while (Date.now() - t0 < 120000) {
        try {
          if (await cdp.evaluate(`!!(${args.waitFor})`)) { okWait = true; break }
        } catch (e) { /* 还没就绪 */ }
        await sleep(500)
      }
      if (!okWait) throw new Error(`--wait-for 超时：${args.waitFor}`)
    }

    let result = null
    if (args.probe !== null) {
      const kind = args.probe === '1' ? '' : args.probe
      const raw = await cdp.evaluate(`window.__probeFrame(${probeTime(args.url)}, ${JSON.stringify(kind)})`)
      result = raw ? JSON.parse(raw) : null
    }
    if (args.eval) {
      const v = await cdp.evaluate(`(() => { ${args.eval} })()`)
      // 已经是字符串就原样打印，避免双重 JSON.stringify（那会把整个 JSON 变成带 \" 的字面量，
      // 调用方再 JSON.parse 一次只会拿到字符串而不是对象 —— doctor 的 b2 项就是这么被坑到的）
      const shown = typeof v === 'string' ? v : JSON.stringify(v)
      console.log('eval =>', shown)
    }
    if (args.out) {
      // T55 修正：截图必须与**成片**同源。导出路径（src/main.js:1412-1413）是
      // `comp.view`（#stage）之上再叠 `comp.lyricsCanvas`（#lyrics）；只抓 #stage 会漏掉
      // **整个歌词层与片尾字幕层**。症状就是用户报的那条：`?shot=211.0/211.3/…/211.9`
      // 九张截图逐字节相同（269193B，全是黑场 + 一处暗残影），而正片里字幕明明在淡入
      // （实测 .tmp/m211.0→211.6 三帧不同、字幕像素 0.47–0.51%；#lyrics 亮像素 0 → 9483 → 10099 → 10115）。
      const dataUrl = await cdp.evaluate(`(() => {
        const s = document.getElementById('stage')
        const l = document.getElementById('lyrics')
        const c = document.createElement('canvas')
        c.width = s.width
        c.height = s.height
        const g = c.getContext('2d')
        g.globalAlpha = 1
        g.globalCompositeOperation = 'source-over'
        g.drawImage(s, 0, 0, c.width, c.height)
        if (l) g.drawImage(l, 0, 0, c.width, c.height)
        return c.toDataURL('image/png')
      })()`)
      const b64 = dataUrl.split(',')[1]
      const outPath = resolve(args.out)
      mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, Buffer.from(b64, 'base64'))
      console.log(`png -> ${outPath} (${Math.round(Buffer.from(b64, 'base64').length / 1024)} KB)`)
    }
    if (result) {
      if (args.json) console.log(JSON.stringify(result))
      else {
        const r = result
        console.log(
          `t=${r.t} active=${(r.active || []).join(',')} tris=${r.info.tris} calls=${r.info.calls} px.mean=${r.px.mean} lit=${r.px.lit} errors=${r.errorCount}`
        )
        for (const s of r.stage || []) console.log(`   stage ${s.name} tris=${s.tris}`)
        for (const o of r.objs || []) console.log(`   ${o.n} pos=(${o.p.join(',')}) op=${o.op} tr=${o.tr}`)
        for (const c of r.checks || []) console.log(`   ${c.ok ? 'PASS' : 'FAIL'} ${c.name} :: ${c.detail}`)
        for (const row of r.rows || []) console.log(`   ${JSON.stringify(row)}`)
      }
    }
    const errs = await cdp.evaluate('JSON.stringify((window.__errors||[]).map(e=>e.where+": "+e.message))')
    const parsed = JSON.parse(errs)
    if (parsed.length) console.log('页面错误：', parsed.join(' | '))
    for (const l of cdp.logs.filter((x) => /error|EXCEPTION|WARN/i.test(x)).slice(0, 10)) console.log('   log:', l)
    ws.close()
    cleanup()
    // T24：显式退出，别让残留的 timer / socket 把进程吊住（doctor 的 spawnSync 会因此超时）
    process.exit(0)
  } catch (e) {
    cleanup()
    console.error('FAILED:', e.message)
    process.exit(1)
  }
}

/** 从 URL 的 ?shot= 取时间，默认 3 */
function probeTime(url) {
  const m = /[?&]shot=([^&]+)/.exec(url)
  if (!m) return 3
  const s = decodeURIComponent(m[1])
  const mm = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s)
  if (mm) return parseInt(mm[1], 10) * 60 + parseFloat(mm[2])
  const f = parseFloat(s)
  return Number.isFinite(f) ? f : 3
}

main()
