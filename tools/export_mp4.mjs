#!/usr/bin/env node
/**
 * tools/export_mp4.mjs — T40 / FIX_V5 §1：离线逐帧导出 MP4
 *
 * 页面 ?export=1 会：DPR 固定 1.0、关看门狗、开 preserveDrawingBuffer、不加载音频、
 * 隐藏控制条、预热 60 帧 + await document.fonts.ready，然后暴露
 *   window.__exportInfo     { w,h,duration,syncOffset,dpr,renderer,preserveDrawingBuffer,warmup,ready }
 *   window.__exportStart(o) o = { from,to,fps,mb,url,offset,skip }
 *   window.__exportProgress { running,done,error,i,total,skipped,renderMs[],frameMs[],meanMs,etaSec,bytes }
 * 本工具：
 *   1) 起本地 sink（POST /frame?i=..&t=.. ，body = 最终合成画布 PNG）写 ffmpeg stdin；
 *   2) 逐帧取 PNG，按 --chunk 秒分块编码到 out/chunks/c<秒>.mp4（已存在的块跳过 = 断点续做）；
 *   3) concat 所有块并混入 assets/song.mp3（AAC 256k、+faststart）；
 *   4) --verify：把导出 mp4 的某帧与交互页 ?shot= 同一 t 的合成截图像素比对（平均绝对差 ≤1%）。
 * 导出不改变任何画面逻辑。
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { killTree } from './kill_tree.mjs'
import ffmpegStatic from 'ffmpeg-static'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILM_DURATION = 211.907

// ---------------------------------------------------------------- 参数

function parseArgs(argv) {
  const A = {
    fps: 30,
    from: 0,
    to: FILM_DURATION,
    chunk: 10,
    crf: 16,
    preset: 'slow',
    mb: 1,
    frames: 'png',
    'jpeg-q': 0.98,
    scale: '',
    out: 'out/film.mp4',
    url: 'http://127.0.0.1:5173/',
    offset: 0,
    resume: true,
    gpu: true,
    verify: false,
    'verify-frame': null,
    'boot-timeout': 120,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    if (key === 'help' || key === 'h') { A.help = true; continue }
    if (key === 'no-resume') { A.resume = false; continue }
    if (key === 'verify') { A.verify = true; continue }
    if (key === 'software') { A.gpu = false; continue }
    const val = argv[i + 1]
    if (val === undefined || val.startsWith('--')) throw new Error(`参数 --${key} 缺少值`)
    i++
    if (key === 'verify-frame') A[key] = Number(val)
    else if (key === 'jpeg-q') A['jpeg-q'] = Number(val)
    else if (['fps', 'from', 'to', 'chunk', 'crf', 'mb', 'offset', 'boot-timeout'].includes(key)) A[key] = Number(val)
    else A[key] = val
  }
  return A
}

function usage() {
  console.log(`用法：npm run export -- [选项]
  --fps 30|60        帧率（默认 30）
  --from 0           起始秒（含）
  --to 211.907       结束秒（不含）
  --chunk 10         分块秒数（默认 10，一块一个 mp4，已存在的块跳过）
  --crf 16           libx264 CRF（默认 16）
  --preset slow      libx264 preset（默认 slow）
  --mb 1|4           每帧子帧数（快门 180° 平均 = 运动模糊，1 = 关）
  --frames png|jpeg  帧编码（默认 png）。4K（?res=2）下 Chromium 的 PNG 编码 6–11s/帧是唯一瓶颈；
                     jpeg（默认 q0.98，与 PNG 的 PSNR 54.1dB = 视觉无损）只要 0.38s/帧
  --jpeg-q 0.98      --frames jpeg 的质量（0–1）
  --scale WxH        输出放大到该尺寸（lanczos；例如 --res=1.7 渲染后 --scale 3840x2160 = 4K 交付）
  --out out/film.mp4 输出文件
  --url http://127.0.0.1:5173/   页面地址（会自动加 ?export=1）
  --offset 0         时间偏移（= syncOffset，页面内会加到 t 上）
  --no-resume        不跳过已存在的分块（覆盖重做）
  --software         跳过 GPU 优先，直接用 SwiftShader
  --verify           导出后比对 mp4 某一帧与交互页同一 t 的合成截图（参照物取稳态画面：
                     页面 ?shot= 渲染一次后再 __renderAt(t) 一次，原因见 docs/REVIEW_T40.md）
  --verify-frame N   比对第 N 帧（默认中间帧）
  --dump-frames 3,10 把收到的第 3/10 帧原始 PNG 存成 out/_frameN.png（调试用）
  --boot-timeout 120 等 window.__exportInfo 的秒数（GPU 模式）
  --help`)
}

// ---------------------------------------------------------------- 子进程工具

function run(bin, args, opts = {}) {
  return new Promise((res, rej) => {
    const ch = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    let out = ''
    let err = ''
    ch.stdout.on('data', (d) => { out += d })
    ch.stderr.on('data', (d) => { err += d })
    ch.on('error', rej)
    ch.on('close', (code) => code === 0
      ? res({ out, err })
      : rej(new Error(`${bin} 退出码 ${code}\n${err.slice(-4000)}`)))
  })
}

function resolveFfmpeg() {
  if (!ffmpegStatic || !existsSync(ffmpegStatic)) {
    throw new Error('ffmpeg-static 未就绪。请先运行：node node_modules/ffmpeg-static/install.js')
  }
  return ffmpegStatic
}

// ---------------------------------------------------------------- CDP

class CDP {
  constructor(ws) {
    this.ws = ws
    this.seq = 0
    this.pending = new Map()
    this.logs = []
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        clearTimeout(p.timer) // T24：不清 timer 会让进程晚 30 分钟才退出
        if (msg.error) p.rej(new Error(`CDP ${p.method} 错误：${msg.error.message}`))
        else p.res(msg.result)
        return
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails
        this.logs.push('异常: ' + (d?.exception?.description || d?.text || ''))
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        this.logs.push('console.error: ' + (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
      }
    })
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', () => res(), { once: true })
      ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true })
    })
    return new CDP(ws)
  }

  send(method, params = {}, timeoutMs = 1800000) {
    const id = ++this.seq
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        rej(new Error(`CDP ${method} 超时（${timeoutMs}ms）`))
      }, timeoutMs)
      this.pending.set(id, { res, rej, timer, method })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression, { awaitPromise = false, timeoutMs = 1800000 } = {}) {
    const r = await this.send('Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise, userGesture: true }, timeoutMs)
    if (r.exceptionDetails) {
      const d = r.exceptionDetails
      throw new Error('页面求值异常：' + (d.exception?.description || d.text || 'unknown'))
    }
    return r.result?.value
  }

  close() { try { this.ws.close() } catch { /* 已关闭 */ } }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, timeoutMs = 5000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    return await res.json()
  } finally { clearTimeout(timer) }
}

// ---------------------------------------------------------------- Chrome

function chromeBinary() {
  const cands = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const c of cands) if (c && existsSync(c)) return c
  throw new Error('找不到 Chrome/Edge 可执行文件')
}

/**
 * 起一个 headless Chrome 并导航到 pageUrl，等 readyExpr 为真。
 * 返回 { child, cdp, wins, close() }；失败时抛错并已杀进程。
 */
async function bootChrome({ pageUrl, readyExpr, profile, gpu, bootTimeoutMs }) {
  const bin = chromeBinary()
  const port = 9600 + Math.floor(Math.random() * 300)
  mkdirSync(profile, { recursive: true })
  const args = [
    '--headless=new',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    '--window-size=1920,1080',
    '--user-data-dir=' + profile,
    '--remote-debugging-port=' + port,
  ]
  if (gpu) {
    // FIX_V5 §1：GPU 参数优先
    args.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11',
      '--enable-unsafe-swiftshader')
  } else {
    args.push('--disable-gpu', '--enable-unsafe-swiftshader', '--use-angle=swiftshader')
  }
  args.push('about:blank')
  const child = spawn(bin, args, { stdio: 'ignore', windowsHide: true })
  let cdp = null
  const cleanup = () => { if (cdp) cdp.close(); killTree(child) }
  try {
    // 等 devtools 端口
    let list = null
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      try {
        list = await fetchJson(`http://127.0.0.1:${port}/json/list`)
        if (Array.isArray(list) && list.some((t) => t.type === 'page')) break
      } catch { /* 还没起来 */ }
      list = null
    }
    if (!list) throw new Error(`Chrome devtools 端口 ${port} 未就绪`)
    const page = list.find((t) => t.type === 'page')
    cdp = await CDP.connect(page.webSocketDebuggerUrl)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Page.navigate', { url: pageUrl })
    const deadline = Date.now() + bootTimeoutMs
    let ready = false
    while (Date.now() < deadline) {
      await sleep(500)
      try {
        if (await cdp.evaluate(`!!(${readyExpr})`)) { ready = true; break }
      } catch { /* 导航途中 */ }
    }
    if (!ready) {
      let errs = []
      try { errs = (await cdp.evaluate('window.__errors || []')) || [] } catch { /* ignore */ }
      const tail = [...errs, ...cdp.logs].slice(-6).join('\n  ')
      throw new Error(`等待就绪失败（${bootTimeoutMs}ms）：${readyExpr}\n  页面错误：${tail || '(无)'}`)
    }
    await sleep(800)
    return { child, cdp, port, gpu, close: cleanup }
  } catch (e) {
    cleanup()
    throw e
  }
}

// ---------------------------------------------------------------- 本地 sink

function startSink(onFrame) {
  let chain = Promise.resolve()
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return }
    if (req.method !== 'POST' || url.pathname !== '/frame') {
      res.writeHead(404, cors); res.end('not found'); return
    }
    const parts = []
    req.on('data', (c) => parts.push(c))
    req.on('end', () => {
      const buf = Buffer.concat(parts)
      // 页面是 await fetch 逐帧发的；这里再串行化一次，保证写入顺序
      chain = chain.then(() => onFrame(buf, url.searchParams))
      chain.then(
        () => { res.writeHead(204, cors); res.end() },
        (e) => {
          const msg = String((e && e.message) || e)
          console.error('\n[sink 500] ' + msg + '\n' + (e && e.stack ? e.stack.split('\n').slice(1, 4).join('\n') : ''))
          res.writeHead(500, cors); res.end(msg)
        },
      )
    })
  })
  return new Promise((res) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      res({
        port,
        url: `http://127.0.0.1:${port}/frame`,
        close: () => new Promise((r) => server.close(() => r())),
        flush: () => chain,
      })
    })
  })
}

// ---------------------------------------------------------------- 导出主流程

const PROGRESS_EXPR = `(() => {
  const P = window.__exportProgress;
  if (!P) return null;
  const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.round(p / 100 * (s.length - 1)))] };
  const r = P.renderMs, f = P.frameMs, e = P.encodeMs || [], po = P.postMs || [];
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return { running: P.running, done: P.done, error: P.error, i: P.i, total: P.total,
    skipped: P.skipped, bytes: P.bytes, meanMs: P.meanMs, etaSec: P.etaSec,
    n: f.length, renderMean: mean(r), encodeMean: mean(e), postMean: mean(po),
    renderP50: q(r, 50), renderP95: q(r, 95),
    frameMean: mean(f),
    frameP50: q(f, 50), frameP95: q(f, 95) };
})()`

function makePlan(A) {
  const fps = Math.round(A.fps)
  if (!(fps > 0)) throw new Error('--fps 非法')
  const from = Number(A.from)
  const to = Number(A.to)
  if (!(to > from)) throw new Error('--to 必须大于 --from')
  const total = Math.max(0, Math.round((to - from) * fps))
  const framesPerChunk = Math.max(1, Math.round(A.chunk * fps))
  const outFile = resolve(ROOT, A.out)
  const outDir = dirname(outFile)
  const chunksDir = join(outDir, 'chunks')
  const tag = outFile.replace(/\.mp4$/i, '')
  const frames = A.frames === 'jpeg' ? 'jpeg' : 'png'
  const jpegQ = Number(A['jpeg-q'])
  return {
    fps, from, to, total, framesPerChunk, mb: Math.max(1, Math.round(A.mb)),
    chunk: A.chunk, crf: A.crf, preset: A.preset, offset: A.offset,
    frames, jpegQ: Number.isFinite(jpegQ) && jpegQ > 0 && jpegQ <= 1 ? jpegQ : 0.98,
    scale: /^\d+x\d+$/.test(String(A.scale || '')) ? String(A.scale) : '',
    outFile, outDir, chunksDir, tmpVideo: `${tag}._video.mp4`,
    lastCi: Math.ceil(total / framesPerChunk) - 1,
  }
}

const chunkName = (plan, ci) => `c${String(Math.round(plan.from + ci * plan.chunk)).padStart(4, '0')}.mp4`

/**
 * 分块是否「完整且属于本次计划」：mp4 存在、同目录有 .done sidecar，且 sidecar 记的帧数
 * 与本计划该块的应有帧数一致。只按大小判断会把半截图块或「别的区间导出的短块」当成已完成，
 * 所以 sidecar 帧数才是权威标记（换 fps / 换区间后自动重做）。
 */
function chunkDone(plan, ci) {
  const file = join(plan.chunksDir, chunkName(plan, ci))
  if (!existsSync(file) || statSync(file).size <= 1024) return false
  const side = file + '.done'
  if (!existsSync(side)) return false
  const expect = Math.min(plan.framesPerChunk, plan.total - ci * plan.framesPerChunk)
  return Number(readFileSync(side, 'utf8')) === expect
}

/** 已完成的分块 → 需要跳过的帧下标区间（断点续做） */
function existingSkipRanges(plan) {
  const ranges = []
  for (let ci = 0; ci <= plan.lastCi; ci++) {
    if (chunkDone(plan, ci)) {
      ranges.push([ci * plan.framesPerChunk, Math.min(plan.total, (ci + 1) * plan.framesPerChunk)])
    }
  }
  return ranges
}

async function main() {
  const t0 = Date.now()
  const A = parseArgs(process.argv.slice(2))
  if (A.help) { usage(); return }

  const ffmpeg = resolveFfmpeg()
  const plan = makePlan(A)
  mkdirSync(plan.outDir, { recursive: true })
  mkdirSync(plan.chunksDir, { recursive: true })
  const pageUrl = A.url + (A.url.includes('?') ? '&' : '?') + 'export=1'

  // ---- sink + 编码器状态
  const dumpSet = new Set(String(A['dump-frames'] || '').split(',').map((x) => Number(x)).filter((x) => Number.isFinite(x)))
  const enc = { ci: -1, child: null, file: null, frames: 0, stderr: '' }
  const written = []
  let bytesIn = 0
  let framesIn = 0

  const closeChunk = async () => {
    if (!enc.child) return
    const child = enc.child
    const file = enc.file
    const frames = enc.frames
    const stderr = () => enc.stderr
    enc.child = null
    enc.ci = -1
    child.stdin.end()
    const [code] = await once(child, 'close')
    if (code !== 0) throw new Error(`ffmpeg 分块编码失败 ${file} exit=${code}\n${stderr().slice(-2000)}`)
    if (frames > 0) {
      writeFileSync(file + '.done', String(frames))
      if (!written.includes(file)) written.push(file)
      console.log(`  [chunk] ${file.split(/[\\/]/).pop()}  ${frames} 帧  ${(statSync(file).size / 1048576).toFixed(1)}MB`)
    } else {
      rmSync(file, { force: true })
    }
  }

  const openChunk = async (ci) => {
    const file = join(plan.chunksDir, chunkName(plan, ci))
    rmSync(file + '.done', { force: true })
    enc.child = spawn(ffmpeg, [
      '-hide_banner', '-loglevel', 'warning', '-y',
      '-f', 'image2pipe', '-vcodec', plan.frames === 'jpeg' ? 'mjpeg' : 'png',
      '-framerate', String(plan.fps), '-i', 'pipe:0',
      ...(plan.scale ? ['-vf', `scale=${plan.scale}:flags=lanczos`, '-sws_flags', 'lanczos'] : []),
      '-c:v', 'libx264', '-preset', plan.preset, '-crf', String(plan.crf), '-pix_fmt', 'yuv420p',
      file,
    ], { stdio: ['pipe', 'ignore', 'pipe'] })
    enc.stderr = ''
    enc.child.stderr.on('data', (d) => { enc.stderr = (enc.stderr + d).slice(-4000) })
    enc.child.on('error', (e) => { enc.stderr += '\nspawn 错误: ' + e.message })
    enc.ci = ci
    enc.file = file
    enc.frames = 0
  }

  const onFrame = async (buf, sp) => {
    const i = Number(sp.get('i'))
    const ci = Math.floor(i / plan.framesPerChunk)
    if (dumpSet.has(i)) writeFileSync(join(plan.outDir, `_frame${i}.${plan.frames === 'jpeg' ? 'jpg' : 'png'}`), buf)
    if (ci !== enc.ci) {
      await closeChunk()
      await openChunk(ci)
    }
    enc.frames++
    framesIn++
    bytesIn += buf.length
    if (!enc.child.stdin.write(buf)) await once(enc.child.stdin, 'drain') // 反压
  }

  const sink = await startSink(onFrame)
  console.log(`T40 离线导出  fps=${plan.fps}  ${plan.from}s→${plan.to}s  ${plan.total} 帧  mb=${plan.mb}  crf=${plan.crf}  帧编码=${plan.frames}${plan.frames === 'jpeg' ? `(q${plan.jpegQ})` : ''}${plan.scale ? `  放大=${plan.scale}(lanczos)` : ''}`)
  console.log(`  sink   ${sink.url}`)
  console.log(`  页面   ${pageUrl}`)

  let chrome = null
  let info = null
  let progress = null
  try {
    // ---- 起页面：GPU 优先，失败回退软件渲染
    const profile = join(tmpdir(), 'dshpv-export-chrome')
    const readyExpr = 'window.__exportInfo && window.__exportInfo.ready'
    try {
      chrome = await bootChrome({ pageUrl, readyExpr, profile, gpu: A.gpu, bootTimeoutMs: A['boot-timeout'] * 1000 })
    } catch (e) {
      if (!A.gpu) throw e
      console.log(`  [GPU 模式失败] ${e.message.split('\n')[0]}`)
      console.log('  → 回退软件渲染（SwiftShader）')
      await sleep(1500) // 让上一个 Chrome 释放 profile 锁
      chrome = await bootChrome({
        pageUrl, readyExpr, profile: join(tmpdir(), 'dshpv-export-chrome-sw'), gpu: false,
        bootTimeoutMs: Math.max(A['boot-timeout'], 300) * 1000 * 2,
      })
    }
    info = await chrome.cdp.evaluate('window.__exportInfo')
    console.log(`  渲染器 ${info.renderer}  (${chrome.gpu ? 'GPU 优先参数' : 'SwiftShader 参数'})`)
    console.log(`  画布   ${info.w}×${info.h}  DPR=${info.dpr}  preserveDrawingBuffer=${info.preserveDrawingBuffer}  预热=${info.warmup} 帧  duration=${Number(info.duration).toFixed(3)}s`)

    const skip = A.resume ? existingSkipRanges(plan) : []
    if (skip.length) {
      const n = skip.reduce((s, [a, b]) => s + (b - a), 0)
      console.log(`  续做   已有 ${skip.length} 个分块 → 跳过 ${n} 帧`)
    }

    await chrome.cdp.evaluate(`window.__exportStart(${JSON.stringify({
      from: plan.from, to: plan.to, fps: plan.fps, mb: plan.mb,
      url: sink.url, offset: plan.offset, skip,
      frame: plan.frames, quality: plan.jpegQ,
    })})`)

    // ---- 轮询进度
    const startWall = Date.now()
    let lastI = -1
    let lastChange = Date.now()
    let lastPrint = 0
    for (;;) {
      await sleep(250)
      progress = await chrome.cdp.evaluate(PROGRESS_EXPR)
      if (!progress) throw new Error('page 未暴露 window.__exportProgress')
      if (progress.error) throw new Error('页面导出失败：' + progress.error)
      if (progress.i !== lastI) { lastI = progress.i; lastChange = Date.now() }
      const now = Date.now()
      if (now - lastPrint > 2000 || progress.done) {
        lastPrint = now
        const pct = progress.total ? (100 * progress.i / progress.total).toFixed(1) : '100'
        process.stdout.write(`\r  帧 ${String(progress.i).padStart(5)}/${progress.total} (${pct}%)  ` +
          `渲染 ${progress.renderMean ? progress.renderMean.toFixed(0) : '-'}ms  ` +
          `编码 ${progress.encodeMean ? progress.encodeMean.toFixed(0) : '-'}ms  ` +
          `传输 ${progress.postMean ? progress.postMean.toFixed(0) : '-'}ms  ` +
          `帧总 ${progress.frameMean ? progress.frameMean.toFixed(0) : '-'}ms  ` +
          `墙钟 ${((now - startWall) / 1000).toFixed(0)}s  ETA ${progress.etaSec ? progress.etaSec.toFixed(0) : '-'}s   `)
      }
      if (progress.done) break
      if (now - lastChange > 300000) throw new Error(`导出停滞：${Math.round((now - lastChange) / 1000)}s 无新帧`)
      if (now - startWall > 12 * 3600 * 1000) throw new Error('导出超过 12 小时，中止')
    }
    process.stdout.write('\n')
    await sink.flush()
    await closeChunk()
  } finally {
    if (chrome) chrome.close()
    await sink.close()
  }

  // ---- concat + 混音
  const chunkFiles = []
  for (let ci = 0; ci <= plan.lastCi; ci++) {
    if (chunkDone(plan, ci)) chunkFiles.push(chunkName(plan, ci))
  }
  if (!chunkFiles.length) throw new Error('没有任何分块可合成')
  const listFile = join(plan.chunksDir, 'list.txt')
  writeFileSync(listFile, chunkFiles.map((f) => `file '${join(plan.chunksDir, f).replace(/\\/g, '/')}'`).join('\n') + '\n')
  console.log(`  concat ${chunkFiles.length} 块 → ${plan.tmpVideo.split(/[\\/]/).pop()}`)
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', '-f', 'concat', '-safe', '0',
    '-i', listFile, '-c', 'copy', plan.tmpVideo])

  const song = resolve(ROOT, 'assets/song.mp3')
  if (existsSync(song)) {
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y',
      '-i', plan.tmpVideo, '-ss', String(plan.from), '-i', song,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
      '-t', (plan.to - plan.from).toFixed(3), '-movflags', '+faststart',
      plan.outFile])
  } else {
    console.log('  [warn] 缺少 assets/song.mp3，输出无音轨')
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', '-i', plan.tmpVideo,
      '-c', 'copy', '-movflags', '+faststart', plan.outFile])
  }

  // ---- 汇报
  const wall = (Date.now() - t0) / 1000
  const fullFrames = Math.round(FILM_DURATION * plan.fps)
  const frameMean = progress.frameMean || 0
  const renderMean = progress.renderMean || 0
  const size = statSync(plan.outFile).size
  const dur = (progress.total - progress.skipped) / plan.fps
  console.log('\n=== T40 测试片报告 ===')
  console.log(`输出          ${plan.outFile}`)
  console.log(`规格          ${plan.fps}fps  ${info.w}×${info.h}${plan.scale ? `→${plan.scale}(lanczos)` : ''}  crf ${plan.crf} preset ${plan.preset}  mb=${plan.mb}  帧编码=${plan.frames}${plan.frames === 'jpeg' ? `(q${plan.jpegQ})` : ''}  pix_fmt yuv420p  AAC 256k`)
  console.log(`渲染器        ${info.renderer}`)
  console.log(`帧数          区间 ${plan.from}s→${plan.to}s = ${progress.total} 帧（实编 ${progress.total - progress.skipped}，跳过 ${progress.skipped}）`)
  console.log(`每帧渲染      mean ${renderMean.toFixed(1)}ms  p50 ${progress.renderP50}ms  p95 ${progress.renderP95}ms`)
  console.log(`每帧编码      mean ${(progress.encodeMean || 0).toFixed(1)}ms（${plan.frames}）    每帧传输 mean ${(progress.postMean || 0).toFixed(1)}ms（POST→sink→ffmpeg 反压）`)
  console.log(`每帧总耗时    mean ${frameMean.toFixed(1)}ms  p50 ${progress.frameP50}ms  p95 ${progress.frameP95}ms   （渲染+编码+POST）`)
  console.log(`成片时长      ${dur.toFixed(3)}s   大小 ${(size / 1048576).toFixed(2)}MB`)
  console.log(`本次墙钟      ${wall.toFixed(1)}s（含启动/预热/concat/混音）`)
  console.log(`预计全片      ${fullFrames} 帧 × ${frameMean.toFixed(1)}ms ≈ ${(fullFrames * frameMean / 60000).toFixed(1)} 分钟 = ${(fullFrames * frameMean / 3600000).toFixed(2)} 小时`)
  if (plan.mb > 1) {
    console.log(`              （含 ${plan.mb} 子帧/帧的运动模糊成本，已计入上表）`)
  }

  if (A.verify) {
    const vf = Number.isInteger(A['verify-frame']) ? A['verify-frame'] : Math.floor(progress.total / 2)
    await verifyFrame(ffmpeg, plan, A, vf)
  }
}

// ---------------------------------------------------------------- 像素一致性校验

async function verifyFrame(ffmpeg, plan, A, idx) {
  const t = plan.from + idx / plan.fps
  const png = join(plan.outDir, `_verify_frame${idx}.png`)
  console.log(`\n=== 一致性校验 ===`)
  console.log(`  取导出 mp4 第 ${idx} 帧（t=${t.toFixed(3)}s）`)
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', plan.outFile,
    '-vf', `select=eq(n\\,${idx})`, '-vsync', '0', '-frames:v', '1', '-f', 'image2', '-vcodec', 'png', png])

  const profile = join(tmpdir(), 'dshpv-export-chrome-sw')
  const pageUrl = A.url + (A.url.includes('?') ? '&' : '?') + 'shot=' + t.toFixed(6)
  await sleep(1000) // 导出用的 Chrome 刚被杀，等它释放 profile 锁
  const chrome = await bootChrome({
    pageUrl, profile, gpu: false, bootTimeoutMs: 300000,
    readyExpr: 'window.__app && window.__app.comp && window.__app.comp.view && window.__app.clock',
  })
  let dataUrl = null
  try {
    // 注意：`?shot=` 只让页面渲染一次，而实测**首次渲染**的 3D 层还没就绪（背景雾层缺失，
    // 全图均值差 ~19%）；同一 t 再渲染一次即与导出帧逐像素一致（证据见 docs/REVIEW_T40.md）。
    // 这里补一次渲染取「稳态画面」，参照物仍完全由交互页自身产生，不经过导出侧代码路径。
    dataUrl = await chrome.cdp.evaluate(`(() => {
      if (window.__renderAt) window.__renderAt(${t.toFixed(6)});
      const W = 1920, H = 1080;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.drawImage(document.getElementById('stage'), 0, 0, W, H);
      g.drawImage(document.getElementById('lyrics'), 0, 0, W, H);
      return c.toDataURL('image/png');
    })()`)
  } finally {
    chrome.close()
  }
  if (!dataUrl || !dataUrl.startsWith('data:image/png')) throw new Error('交互页截图失败')
  const refBuf = Buffer.from(dataUrl.split(',')[1], 'base64')
  const refPng = join(plan.outDir, `_verify_ref${idx}.png`)
  writeFileSync(refPng, refBuf)

  const dec = async (buf) => sharp(buf).resize(1920, 1080, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  const [a, b] = await Promise.all([dec(png), dec(refBuf)])
  if (a.length !== b.length) throw new Error(`尺寸不一致：导出 ${a.length} vs 交互页 ${b.length}`)
  const chMean = (buf) => {
    const s = [0, 0, 0]
    for (let i = 0; i < buf.length; i += 3) { s[0] += buf[i]; s[1] += buf[i + 1]; s[2] += buf[i + 2] }
    const n = buf.length / 3
    return s.map((x) => +(x / n).toFixed(2))
  }
  let sum = 0
  let over8 = 0
  const dch = [0, 0, 0]
  const px = a.length / 3
  for (let i = 0; i < a.length; i += 3) {
    const d0 = Math.abs(a[i] - b[i])
    const d1 = Math.abs(a[i + 1] - b[i + 1])
    const d2 = Math.abs(a[i + 2] - b[i + 2])
    sum += d0 + d1 + d2
    dch[0] += d0
    dch[1] += d1
    dch[2] += d2
    if (Math.max(d0, d1, d2) > 8) over8++
  }
  const meanPct = (sum / a.length) / 255 * 100
  const overPct = over8 / px * 100
  const pass = meanPct <= 1
  console.log(`  导出帧均值    R ${chMean(a)[0]}  G ${chMean(a)[1]}  B ${chMean(a)[2]}`)
  console.log(`  交互页均值    R ${chMean(b)[0]}  G ${chMean(b)[1]}  B ${chMean(b)[2]}`)
  console.log(`  通道平均差    R ${(dch[0] / px).toFixed(2)}  G ${(dch[1] / px).toFixed(2)}  B ${(dch[2] / px).toFixed(2)}`)
  console.log(`  平均绝对差    ${meanPct.toFixed(3)}%  （门槛 ≤1%，FIX_V5 §1）`)
  console.log(`  通道差>8 占比 ${overPct.toFixed(2)}%`)
  console.log(`  比对图        ${png}  vs  ${refPng}`)
  console.log(`  结论          ${pass ? 'PASS 导出画面与交互页同一 t 一致' : 'FAIL 超出 1% 门槛'}`)
  if (!pass) process.exitCode = 1
}

main().catch((e) => {
  console.error('\n[export 失败] ' + (e && e.stack || e))
  process.exitCode = 1
})
