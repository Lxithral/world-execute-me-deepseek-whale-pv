// src/scenes/k_storm.js — 段 K 2:27.9–2:42 执行风暴（副歌二）
// DIRECTOR：背景是损失函数地形的引力井（时空网格），梯度下降的小球沿螺旋坠入；公式螺旋坠入
// 并被潮汐拉长；速度线、急拉环绕。12 次「执行」各对应一张工具调用卡片飞向她（12 种工具名），
// 每次重拍命中，glitch 与 strained 逐次加重（heat = k/12）。
// 2:38.95 多语言 1–6 计数：六种书写系统的数字依次翻牌；2:41.7 最后一击最大闪白。

import * as THREE from 'three'
import { C, rgba, mixHex } from '../core/palette.js'
import { clamp, span, smoothstep, TAU, outCubic, inOutCubic, outElastic } from '../core/ease.js'
import { hash01 } from '../core/rng.js'
import { MONO, toolCard, roundRect, progressBar } from '../ui/dsh.js'
import { text, setTextureSpace } from '../ui/text.js'
import { drawMath, FORMULAS } from '../lib/formula.js'
import { TOOL_NAMES } from '../lib/code.js'
import { gradientDescent } from '../lib/tables.js'
import { createGridPlane } from '../lib/three_util.js'

/**
 * T00 规格：卡片下方的次级信息 = **语言代码徽标（左）+ 该语言的数字原文（右）**，同一行，≥34px。
 *   1 DE eins · 2 ES dos · 3 FR trois · 4 KO 네 · 5 SV fem · 6 ZH 六
 * 旧的「数字 1–6 + 汉字语言名（德/西/法/韩/瑞典/中）」已按 T00 删除。
 *
 * 第 4 张按 T00 特殊处理：语言拿不准 → 徽标写成 **`KO?`**（问号紧贴 KO 右边、属于徽标的一部分），
 * 数字原文 `네` 后面**不加**问号；「?」用亮黄 `#ffd54f`、字号是 `KO` 的 1.3 倍、带外发光并对起音点脉冲；
 * `KO?` 徽标整体用黄色描边；**卡片外框与其余五张完全一致**（不加虚线、不加右上角徽标）。
 *
 * 判断依据见 `docs/PROGRESS.md` 的决策日志（唱词序列 Ein/Dos/Trois/Ne/Fem/Liu
 * 对应德/西/法/韩/瑞典/中，第 4 个 Ne 判为韩语 넷；**待用户确认**）。
 */
const COUNT_LANGS = [
  { code: 'DE', native: 'eins' },
  { code: 'ES', native: 'dos' },
  { code: 'FR', native: 'trois' },
  { code: 'KO', native: '네' },
  { code: 'SV', native: 'fem' },
  { code: 'ZH', native: '六' },
]

/** 找不到歌词时的兜底唱词（正常情况下一定从 lyrics.json 取到） */
const COUNT_FALLBACK = ['Ein', 'Dos', 'Trois', 'Ne', 'Fem', 'Liu']

export default {
  id: 'K',
  start: 147.9,
  end: 162.0,
  title: '执行风暴',
  fx: [
    { t: 147.9, kind: 'flash', amount: 1.0, dur: 0.22 },
    { t: 147.9, kind: 'shake', amount: 0.9, dur: 0.6 },
    // ---- T04 / FIX_V4 §1.10 乐句一（hit1–hit4）：「各自触发 impact」----
    // ⚠️ 不能给 12 次 hit 都挂同一种效果：§4.4 要求「任意 6s 窗口内同类最多 2 次」，
    // 而 hit 间隔约 0.95s（6s 里约 6–7 次）。所以按 **4 循环** 取 kind
    // （burst → disp → ring → glitch），于是任意 6s 窗口里每种最多 2 次。
    // 乐句一这四次正好各用一种，也顺便符合 §1.10「每次 hit 配色强调不同」。
    { t: 148.667, kind: 'burst', amount: 0.75, dur: 0.5 }, // hit1 猛推进奇点 → bloom 迸发 + 冲击波
    { t: 149.67, kind: 'disp', amount: 0.6, dur: 0.4 }, // hit2 90° 甩镜 → 色散
    { t: 150.608, kind: 'ring', amount: 0.8, dur: 0.55 }, // hit3 石板墙被击碎 → 冲击环
    { t: 151.56, kind: 'glitch', amount: 0.55, dur: 0.35 }, // hit4 公式风暴盘旋 → 故障
    // ---- T06 / §1.10 乐句三（hit9–hit12），继续 4 循环 ----
    { t: 156.118, kind: 'burst', amount: 0.7, dur: 0.5 }, // hit9 滑动变焦 → bloom 迸发
    { t: 157.047, kind: 'disp', amount: 0.7, dur: 0.45 }, // hit10 切片故障 → 色散
    { t: 157.966, kind: 'ring', amount: 0.9, dur: 0.6 }, // hit11 超新星 → 冲击环
    { t: 161.726, kind: 'glitch', amount: 0.9, dur: 0.4 }, // hit12 白场前的故障
    { t: 161.726, kind: 'flash', amount: 1.0, dur: 0.42 },
    { t: 161.726, kind: 'shake', amount: 1.0, dur: 0.8 },
  ],

  init(ctx) {
    this.plane = createGridPlane(34, 2.6, '#6f8fae')
    ctx.three.stage3d.add(this.plane.object)
    this.gd = gradientDescent({ steps: 900, lr: 0.055, start: [-1.55, 1.05] })
    // 12 次「执行」的时刻：由锚点表（anchors.js 的 K.exec1..exec12）给出，
    // 而锚点本身解析自歌词里那 12 个 execution 词的起唱时间（FIX §2.2）。
    this.execs = []
    for (let i = 1; i <= 12; i++) {
      const rec = ctx.cues.t('K', `exec${i}`)
      if (rec && rec.t != null) this.execs.push(rec.t)
    }
    if (this.execs.length !== 12) {
      // 兜底：锚点异常时退回直接扫歌词（不应发生）
      this.execs = []
      for (const s of ctx.lyrics || []) {
        for (const w of s.words) {
          if (/^execution/i.test(w.w.trim()) && w.t >= 147.9 && w.t <= 162) this.execs.push(w.t)
        }
      }
    }
    // 多语言计数的 6 个时刻（取自 "Ein Dos Trois Ne Fem Liu" 的词时间）
    this.counts = []
    for (const s of ctx.lyrics || []) {
      if (Math.abs(s.t0 - 158.95) < 0.6) for (const w of s.words) this.counts.push(w.t)
    }
    if (this.counts.length < 6) this.counts = [158.95, 159.3, 159.65, 160.0, 160.35, 160.7]

    /* ---- T04 / §1.10 乐句一：黑洞（奇点 + 光子环 + 吸积盘）与石板墙 ---- */
    this.bh = buildBlackHole()
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.bh.object)
    this.slabs = buildSlabWall(ctx)
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.slabs.object)
    /* ---- T05 / §1.10 乐句二：3D 神经网络 ---- */
    this.net = buildNeuralNet()
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.net.object)
    /* ---- T06 / §1.10 乐句三：工具峡谷（两侧发光终端屏） ---- */
    this.canyon = buildCanyon()
    if (ctx.three && ctx.three.stage3d) ctx.three.stage3d.add(this.canyon.object)
  },

  render(t, lt, ctx) {
    const { g, W, H, sync } = ctx
    const k = this.execs.filter((x) => t >= x).length
    const heat = clamp(k / 12)

    // 损失地形底色
    const bg = mixHex('#0a0b12', '#1b0d1a', heat)
    if (!ctx.bgIs3d) {
      g.fillStyle = bg
      g.fillRect(0, 0, W, H)
    }
    const rg = g.createRadialGradient(W / 2, H * 0.5, 30, W / 2, H * 0.5, H * 1.0)
    rg.addColorStop(0, rgba('#3a1c4a', 0.35 + 0.3 * heat))
    rg.addColorStop(0.6, rgba('#12081c', 0.4))
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, W, H)

    // ---- 引力井网格（Three） ----
    const depth = 0.5 + 1.5 * inOutCubic(clamp((t - 147.9) / 14))
    this.plane.object.visible = true
    this.plane.update(t, {
      alpha: 0.55,
      wells: [{ x: 0, y: 0, depth, sigma: 0.45 }],
      perspective: 0.42,
      tScale: 1.4,
    })

    // ---- 速度线 / 急拉环绕 ----
    drawSpeedLines(g, ctx, t, heat)

    // ---- 梯度下降小球沿螺旋坠入（表驱动） ----
    drawDescentBall(g, ctx, t, this.gd, depth)

    // ---- 公式螺旋坠入并被潮汐拉长 ----
    // 数字翻牌在场时把公式云上移+缩小+淡出，避免两者撞在同一块画面（见 drawTidalFormulas 的说明）。
    // 窗口起点定在 158.5–158.95：让 suppress 在 159.0s 之前就到达 1（原先 158.7–159.1
    // 到 159.0s 才 0.75，压制不够）。
    const flipA = span(t, 158.5, 158.95) * (1 - span(t, 161.3, 161.75))
    drawTidalFormulas(g, ctx, t, heat, flipA)

    // ---- 12 张工具卡片飞入（左带竖排，§7 段 K：工具调用只在侧带）----
    drawToolCards(g, ctx, t, this.execs, heat)

    // ---- 2:38.95 六种书写系统的数字翻牌 ----
    drawNumeralFlips(g, ctx, t, this.counts)

    // ---- T04 / §1.10 乐句一：黑洞 + 四次 hit 各不相同的镜头/效果 ----
    // 相位：乐句一 = exec1..exec4（148.667 / 149.670 / 150.608 / 151.560）
    {
      const E = this.execs
      const p1 = E[0]
      const p2 = E[1]
      const p3 = E[2]
      const p4 = E[3]
      const pEnd = E[4] != null ? E[4] : p4 + 1.0
      const cam = ctx.three.camera
      const seg = (a, b) => (t >= a && t < b ? clamp((t - a) / Math.max(1e-3, b - a)) : 0)
      // hit1 猛推进奇点（乐句一开场 → hit1 结束）
      const rush = t >= 147.9 && t < p2 ? clamp((t - 147.9) / Math.max(1e-3, p2 - 147.9)) : 0
      // hit2 90° 甩镜 + roll
      const whip = seg(p2, p3)
      // hit3 石板墙被击碎
      const smash = seg(p3, p4)
      // hit4 公式风暴绕黑洞盘旋
      const storm = seg(p4, pEnd)
      // 乐句一在场窗口（之后交给乐句二/三）
      const here = t >= 147.9 && t < pEnd
      // 每次 hit 的配色强调不同（§1.10）：hit1 琥珀 / hit2 青 / hit3 红 / hit4 洋红
      const ACCENT = ['#ffb454', '#5fd8ff', '#ff5f6d', '#e06fe0']
      const accIdx = t < p2 ? 0 : t < p3 ? 1 : t < p4 ? 2 : 3
      const accent = ACCENT[accIdx]
      // hit1 的冲击波环（推进到位时刻的脉冲）
      const di = (a) => (t >= a ? Math.exp(-(t - a) * 3.2) : 0)
      const pulse = Math.max(di(p1), di(p2), di(p3), di(p4))
      this.bh.update(t, {
        alpha: here ? 1 : 0,
        heat,
        tint: accent,
        // hit1：沿视线推进（z 往相机方向推）；hit2 之后退回
        diskTilt: whip > 0 ? -1.15 * Math.sin(Math.PI * clamp(whip)) : 0.35 * (1 - rush * 0.5),
        yaw: whip > 0 ? Math.PI * 0.5 * whip : 0,
        roll: whip > 0 ? Math.PI * 0.10 * whip : 0,
      })
      if (here) {
        const zRush = -rush * 1.9 + storm * 0.15
        // hit2 时把黑洞甩到画面一侧，才是"掠过吸积盘侧面"
        const side = whip > 0 ? -0.95 * Math.sin(Math.PI * clamp(whip)) : 0
        this.bh.object.position.set(
          cam.position.x + 0.18 + side,
          cam.position.y + 0.02 + (smash > 0 ? 0.35 * smash : 0),
          cam.position.z - (3.1 + zRush)
        )
        const s = 1 + pulse * 0.10
        this.bh.object.scale.setScalar(s)
      }
      // hit3：石板墙（在黑洞前方偏右展开）
      this.slabs.update(t, smash, here && smash > 0.001 ? 1 : smash > 0 ? 0.9 : 0)
      if (smash > 0.001) {
        this.slabs.object.position.set(cam.position.x + 0.42, cam.position.y + 0.05, cam.position.z - 2.35)
      }
      this.metrics = this.metrics || {}
      this.metrics.phrase = 1
      this.metrics.hits = { rush: +rush.toFixed(2), whip: +whip.toFixed(2), smash: +smash.toFixed(2), storm: +storm.toFixed(2) }
      this.metrics.bhAccent = accent
      this.metrics.bhZ = +(this.bh.object.position.z - cam.position.z).toFixed(2)
      void accent

      /* ---- T05 / §1.10 乐句二（hit5–hit8）：3D 神经网络，与乐句一完全不同的对象/镜头/配色 ---- */
      const p5 = E[4]
      const p6 = E[5]
      const p7 = E[6]
      const p8 = E[7]
      const p9 = E[8] != null ? E[8] : p8 + 1.0
      // hit5 波前穿过各层：沿 z 从最远层扫到最近层
      const wave = seg(p5, p6)
      // hit6 冲进边的隧道
      const tunnelU = seg(p6, p7)
      // hit7 万花筒
      const mirrorU = seg(p7, p8)
      // hit8 节点炸成 token 彩纸 —— ⚠️ 第一版用 seg(p8, p9)（155.22→156.12），
      // 结果爆炸要到窗口最后一刻才成形、随即整组消失，而 T05 的窗口在 155.22 就结束了
      // （实测窗口内 boomMax=0）。压到 0.5s 内成形，并把网络窗口收到 boom 成形之后，
      // 这样"炸成彩纸"这一拍真的看得见，也不会拖进 hit9 的时刻。
      const boom = clamp((t - p8) / 0.5)
      const netEnd = p8 + 0.75
      const inNet = t >= p5 - 0.35 && t < netEnd
      if (inNet) {
        // 分层俯冲：网络整体沿 z 向相机推进（与乐句一"推进奇点"不同的对象与读感）
        const dive = clamp((t - (p5 - 0.35)) / Math.max(1e-3, p9 - (p5 - 0.35)))
        this.net.object.position.set(
          cam.position.x,
          cam.position.y,
          cam.position.z - (4.6 - dive * 2.3)
        )
        // hit7 时轻微 roll 强化万花筒
        this.net.object.rotation.z = mirrorU * 0.22 * Math.sin(t * 0.6)
        // 配色：青绿 → 紫（与乐句一的琥珀/红/洋红完全不同）
        const palA = mirrorU > 0.4 ? '#8a6cff' : '#3fe0c8'
        const palB = '#e8fff8'
        this.net.update(t, {
          alpha: 1,
          // 波前 z 从最远层（-2.64）扫到最近层（0）
          waveZ: -2.64 + (2.64 + 0.35) * wave,
          tunnelU,
          mirrorU,
          explode: boom,
          confettiU: boom,
          baseColor: palA,
          hotColor: palB,
        })
        this.metrics.phrase = 2
        this.metrics.net = {
          wave: +wave.toFixed(2),
          tunnel: +tunnelU.toFixed(2),
          mirror: +mirrorU.toFixed(2),
          boom: +boom.toFixed(2),
        }
      } else {
        this.net.update(t, { alpha: 0 })
        if (t >= p9) {
          this.metrics.phrase = this.metrics.phrase === 2 ? 3 : this.metrics.phrase
        }
      }

      /* ---- T06 / §1.10 乐句三（hit9–hit12）：工具峡谷 ---- */
      const p9t = E[8]
      const p10 = E[9]
      const p11 = E[10]
      const p12 = E[11]
      const inCanyon = t >= p9t - 0.5 && t < 162.0
      // hit9 滑动变焦
      const dolly = seg(p9t, p10)
      // hit10 时间冻结式切片故障
      const freezeGlitch = seg(p10, p11)
      // hit11 超新星 —— ⚠️ 第一版写成 seg(p11, p12)，而 p11→p12 有 3.76s，
      // 于是"超新星"变成一路慢爬到 2:41 的常亮环（实测 nova 在 t=161.0 才到 0.81）。
      // 超新星必须**快**：0.5s 内成形，1.2s 后开始消退。
      const nova = clamp((t - p11) / 0.5) * (1 - span(t, p11 + 1.2, p11 + 2.1))
      // 计数卡（2:38.95–2:41.25）在场时峡谷让位，避免和六张卡抢画面
      const yieldCards = span(t, 158.7, 159.15) * (1 - span(t, 161.15, 161.6))
      if (inCanyon) {
        this.canyon.object.position.set(cam.position.x, cam.position.y, cam.position.z)
        // 峡谷随段推进缓缓前推，读起来是"在通道里前进"
        this.canyon.object.position.z -= 0.35 * clamp((t - p9t) / Math.max(1e-3, 162 - p9t))
        this.canyon.update(t, {
          alpha: (1 - 0.86 * yieldCards) * (1 - 0.9 * nova),
          scroll: 1 - 0.92 * freezeGlitch,
          dolly,
          freeze: freezeGlitch,
        })
        this.metrics.phrase = 3
        this.metrics.canyon = {
          dolly: +dolly.toFixed(2),
          freeze: +freezeGlitch.toFixed(2),
          nova: +nova.toFixed(2),
          yield: +yieldCards.toFixed(2),
        }
        // hit10 / hit11 的 2D 叠加（切片故障、超新星）
        drawSliceGlitch(g, ctx, t, freezeGlitch)
        drawSupernova(g, ctx, t, nova)
      } else {
        this.canyon.update(t, { alpha: 0 })
      }
    }

    g.save()
    g.globalAlpha = 0.95
    g.font = MONO(14, 700)
    g.fillStyle = heat > 0.75 ? C.red : C.amber
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    if (ctx.debug) g.fillText('execution ' + k + '/12   heat ' + (heat * 100).toFixed(0) + '%', 72, H * 0.10)
    if (ctx.debug) progressBar(g, { x: 72, y: H * 0.11 + 10, w: 340, h: 9, p: heat, alpha: 0.95, label: '', color: heat > 0.75 ? C.red : C.cyan })
    g.restore()

    // ---- T04 / §1.10：「**本段不出现立绘**」----
    // 这里原本每帧都在设 `ctx.whale.sprite`（strained，随 heat 加重），与 §1.10 末句直接冲突。
    // 段 K 的强度改由黑洞 / 石板墙 / 公式风暴承担，不再借立绘撑画面。
  },
}

/* ================================================================== *
 * T04 / FIX_V4 §1.10 乐句一（2:27.9–2:31.56）：引力井 + 黑洞
 * ------------------------------------------------------------------
 * 要求逐条：
 *   · 「损失地形引力井」   → 复用既有的 `createGridPlane`（这段本来就有）
 *   · 「黑洞」             → 下面的 buildBlackHole()：奇点 + 光子环 + 吸积盘
 *   · hit1 沿视线猛推进奇点并发出冲击波      → 把黑洞沿 z 推向相机 + 冲击环
 *   · hit2 90° 甩镜 + roll，掠过吸积盘侧面   → 整组 yaw 90° + roll，盘面压到近侧视
 *   · hit3 一面 3D 工具调用石板墙被击碎       → buildSlabWall()：击碎时石板四散
 *   · hit4 公式风暴绕黑洞盘旋并被潮汐拉长     → 见 render 里的 storm 参数
 *   · 「每次 hit 配色强调不同，各自触发 impact」→ render 里按 hit 换 accent，fx 里各挂一种 kind
 *   · 「本段不出现立绘」                      → render 里原有的 ctx.whale.sprite 已删除
 * ================================================================== */

/** 吸积盘：加法混合的旋涡环（程序生成，无贴图） */
function buildBlackHole() {
  const grp = new THREE.Group()
  grp.name = 'k:bh'

  // 奇点（视界）：纯黑球，比盘亮部更黑，才有"洞"的读感
  const sing = new THREE.Mesh(
    new THREE.SphereGeometry(0.30, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  )
  grp.add(sing)

  // 光子环：一圈极亮的细环（加法混合 + 不写深度）
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe6b0,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.014, 10, 128), ringMat)
  grp.add(ring)

  // 吸积盘：RingGeometry + 旋涡着色器（多普勒式一侧增亮）
  const diskMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uTint: { value: new THREE.Color(0xffb454) },
      uAlpha: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vPos;
      void main(){ vUv = uv; vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform float uHeat; uniform vec3 uTint; uniform float uAlpha;
      varying vec2 vUv; varying vec3 vPos;
      void main(){
        // RingGeometry 的 uv.x 是绕圈方向、uv.y 是径向
        float ang = vUv.x * 6.2831853;
        float r = length(vPos.xy);            // 盘面在局部 xy 平面上
        float rn = clamp((r - 0.42) / 1.13, 0.0, 1.0);
        // 旋涡：角向条带随半径扭转
        float swirl = sin(ang * 7.0 - uTime * 2.6 + rn * 9.0);
        float bands = 0.5 + 0.5 * swirl;
        // 径向衰减：内缘热、外缘冷
        float radial = pow(1.0 - rn, 1.6) * smoothstep(0.0, 0.10, rn);
        // 多普勒：一侧增亮（掠盘侧面时最能读出来）
        float doppler = 0.65 + 0.55 * cos(ang - uTime * 0.5);
        vec3 hot = mix(vec3(1.0, 0.92, 0.72), uTint, 0.55);
        vec3 col = mix(uTint * 0.5, hot, radial) * (0.45 + 0.85 * bands) * doppler;
        col *= 0.55 + 0.95 * uHeat;
        gl_FragColor = vec4(col * uAlpha, radial * uAlpha);
      }`,
  })
  const disk = new THREE.Mesh(new THREE.RingGeometry(0.42, 1.55, 160, 10), diskMat)
  disk.rotation.x = -Math.PI / 2
  grp.add(disk)

  const glow = new THREE.PointLight(0xffc070, 1.6, 8, 2)
  grp.add(glow)

  return {
    object: grp,
    singularity: sing,
    ring,
    disk,
    diskMat,
    ringMat,
    update(t, o = {}) {
      const { alpha = 1, heat = 0, tint = null, diskTilt = 0, roll = 0, yaw = 0 } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      if (tint) diskMat.uniforms.uTint.value.set(tint)
      diskMat.uniforms.uTime.value = t
      diskMat.uniforms.uHeat.value = heat
      diskMat.uniforms.uAlpha.value = alpha
      ringMat.opacity = 0.95 * alpha
      sing.material.opacity = 1
      sing.material.transparent = alpha < 0.999
      // hit2：盘面被"掠过侧面"→ 倾角压到近侧视
      disk.rotation.x = -Math.PI / 2 + diskTilt
      ring.rotation.x = diskTilt * 0.6
      grp.rotation.set(0, yaw, roll)
    },
  }
}

/**
 * hit3：「一面 3D 工具调用石板墙被击碎」。
 * 石板 = InstancedMesh（薄板），平时排成一面墙；击碎进度 `u` 把它们沿各自的法线推散 + 翻滚。
 */
function buildSlabWall(ctx) {
  const COLS = 6
  const ROWS = 4
  const N = COLS * ROWS
  const W = 0.42
  const H = 0.30
  const geo = new THREE.BoxGeometry(W, H, 0.045)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6f7f96,
    roughness: 0.55,
    metalness: 0.35,
    emissive: 0x1a2430,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 1,
  })
  const mesh = new THREE.InstancedMesh(geo, mat, N)
  const grp = new THREE.Group()
  grp.name = 'k:slabs'
  grp.add(mesh)
  const dummy = new THREE.Object3D()
  const base = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      const x = (c - (COLS - 1) / 2) * (W * 1.14)
      const y = ((ROWS - 1) / 2 - r) * (H * 1.22)
      base.push({ x, y, spin: hash01(i, 91) * 2 - 1, push: 0.6 + hash01(i, 92) * 0.9 })
    }
  }
  return {
    object: grp,
    mesh,
    /**
     * @param {number} u 击碎进度 0→1
     */
    update(t, u = 0, alpha = 1) {
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      mat.opacity = alpha
      for (let i = 0; i < N; i++) {
        const b = base[i]
        dummy.position.set(b.x * (1 + u * 1.4), b.y + u * u * 0.9 * b.push, u * b.push * 0.9)
        dummy.rotation.set(u * b.spin * 2.2, u * b.spin * 1.6, u * b.spin * 2.6)
        const s = 1 - u * 0.25
        dummy.scale.set(s, s, s)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}

/* ================================================================== *
 * T05 / FIX_V4 §1.10 乐句二（2:31.56–2:35.22）：3D 神经网络
 * ------------------------------------------------------------------
 *   · 「相机潜入**巨大的 3D 神经网络**（分层节点 + 连线）」→ buildNeuralNet()
 *   · hit5 亮色**波前**穿过各层          → `waveZ` 沿 z 扫过，节点按高斯邻近增亮 + 胀大
 *   · hit6 沿一条连线**冲进"边的隧道"**   → 沿主跨层边建 TubeGeometry，`tunnelU` 发光
 *   · hit7 **万花筒镜像**网络            → 3 份镜像副本绕 z 均分旋转叠加
 *   · hit8 节点炸成 **token 彩纸**        → 节点炸散（`explode`）+ 3 组 token 粒子云
 *   · 「与乐句一**完全不同的对象、镜头与配色**」→ 对象=网络（非黑洞/石板）；镜头=分层俯冲（非推进/甩镜）；
 *                                              配色=青绿→紫（非乐句一的琥珀/红/洋红）
 * ================================================================== */

/** 一张只有 token 字形的贴图（给彩纸粒子用）。刻意**不**走 text()：这是装饰粒子，不是面板文字。 */
function tokenSprite(txt, color) {
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 64
  const g = cv.getContext('2d')
  g.clearRect(0, 0, 128, 64)
  g.font = '700 44px "JetBrains Mono", monospace'
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(txt, 64, 34)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** §1.10 乐句二：分层节点 + 连线 + 边隧道 + 万花筒副本 + token 彩纸 */
function buildNeuralNet() {
  const LAYERS = 5
  const PER = 14
  const N = LAYERS * PER
  const grp = new THREE.Group()
  grp.name = 'k:net'

  const pos = []
  for (let l = 0; l < LAYERS; l++) {
    for (let i = 0; i < PER; i++) {
      const a = (i / PER) * TAU + l * 0.38
      const r = 0.34 + hash01(l * 31 + i, 41) * 0.62
      pos.push(
        new THREE.Vector3(
          Math.cos(a) * r,
          Math.sin(a) * r * 0.74,
          -l * 0.66 + (hash01(l * 31 + i, 42) - 0.5) * 0.2
        )
      )
    }
  }

  // 节点：加法混合的实例化小球（波前扫过时逐点增亮）
  const nodeMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    N
  )
  nodeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
  grp.add(nodeMesh)

  // 连线：层内成环 + 跨层两条（"分层节点 + 连线"）
  const idx = []
  for (let l = 0; l < LAYERS; l++) {
    for (let i = 0; i < PER; i++) {
      const a = l * PER + i
      idx.push(a, l * PER + ((i + 1) % PER))
      if (l < LAYERS - 1) {
        idx.push(a, (l + 1) * PER + (i % PER))
        idx.push(a, (l + 1) * PER + ((i + 1) % PER))
      }
    }
  }
  const ePos = new Float32Array(idx.length * 3)
  for (let k = 0; k < idx.length; k++) {
    const p = pos[idx[k]]
    ePos[k * 3] = p.x
    ePos[k * 3 + 1] = p.y
    ePos[k * 3 + 2] = p.z
  }
  const eGeo = new THREE.BufferGeometry()
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3))
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x54e0b8,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const edges = new THREE.LineSegments(eGeo, edgeMat)
  grp.add(edges)

  // hit6：「边的隧道」—— 沿最前一条跨层边做一根发光管
  const a0 = pos[0]
  const a1 = pos[LAYERS * PER - PER]
  const curve = new THREE.CatmullRomCurve3([a0, a0.clone().lerp(a1, 0.33), a0.clone().lerp(a1, 0.66), a1])
  const tunnelMat = new THREE.MeshBasicMaterial({
    color: 0x8affe0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const tunnel = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.055, 10, false), tunnelMat)
  grp.add(tunnel)

  // hit7：万花筒镜像副本（克隆实例网格；clone 自带 instanceMatrix）
  const mirrors = []
  for (let m = 0; m < 3; m++) {
    const mg = new THREE.Group()
    const nm = nodeMesh.clone()
    nm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3)
    const em = new THREE.LineSegments(eGeo, edgeMat.clone())
    mg.add(nm, em)
    mg.visible = false
    mg.userData.nodeMesh = nm
    mg.userData.edges = em
    grp.add(mg)
    mirrors.push(mg)
  }

  // hit8：token 彩纸（3 组 Points，各带一个 token 字形）
  const CONF = [
    { txt: 'fn', color: '#8affe0' },
    { txt: 'kv', color: '#b48cff' },
    { txt: 'tok', color: '#5ce0ff' },
  ]
  const confetti = CONF.map((c, ci) => {
    const COUNT = 140
    const geo2 = new THREE.BufferGeometry()
    const arr = new Float32Array(COUNT * 3)
    geo2.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.075,
      map: tokenSprite(c.txt, c.color),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const pts = new THREE.Points(geo2, mat)
    pts.visible = false
    grp.add(pts)
    return { pts, arr, COUNT, seed: 300 + ci * 17 }
  })

  const dummy = new THREE.Object3D()
  const cBase = new THREE.Color(0x4fd8ff)
  const cHot = new THREE.Color(0xd8fff0)
  const tmp = new THREE.Color()

  return {
    object: grp,
    nodeMesh,
    edges,
    tunnel,
    tunnelMat,
    mirrors,
    confetti,
    pos,
    update(t, o = {}) {
      const {
        alpha = 1,
        waveZ = 99,
        tunnelU = 0,
        mirrorU = 0,
        explode = 0,
        confettiU = 0,
        baseColor = null,
        hotColor = null,
      } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      if (baseColor) cBase.set(baseColor)
      if (hotColor) cHot.set(hotColor)

      for (let i = 0; i < N; i++) {
        const p = pos[i]
        const near = Math.exp(-Math.pow((p.z - waveZ) / 0.2, 2))
        const ex = explode
        dummy.position.set(
          p.x * (1 + ex * 1.7),
          p.y * (1 + ex * 1.4),
          p.z + ex * (0.5 + hash01(i, 55) * 0.9)
        )
        const s = 0.65 + 2.1 * near * (1 - ex) + ex * 0.4
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        nodeMesh.setMatrixAt(i, dummy.matrix)
        tmp.copy(cBase).lerp(cHot, near)
        nodeMesh.setColorAt(i, tmp)
      }
      nodeMesh.instanceMatrix.needsUpdate = true
      if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true
      nodeMesh.material.opacity = 0.95 * alpha
      edgeMat.opacity = (0.3 + 0.45 * (1 - explode)) * alpha

      tunnelMat.opacity = tunnelU * 0.85 * alpha
      tunnel.scale.setScalar(1 - 0.15 * tunnelU)

      const ang = t * 0.35
      for (let m = 0; m < mirrors.length; m++) {
        const mg = mirrors[m]
        mg.visible = mirrorU > 0.01
        if (!mg.visible) continue
        const k2 = (m + 1) / 4
        mg.rotation.z = ang * (m % 2 ? -1 : 1) + Math.PI * k2
        mg.scale.set(m % 2 ? -0.62 : 0.62, 0.62, 0.62)
        mg.userData.nodeMesh.instanceMatrix.array.set(nodeMesh.instanceMatrix.array)
        mg.userData.nodeMesh.instanceMatrix.needsUpdate = true
        if (mg.userData.nodeMesh.instanceColor && nodeMesh.instanceColor) {
          mg.userData.nodeMesh.instanceColor.array.set(nodeMesh.instanceColor.array)
          mg.userData.nodeMesh.instanceColor.needsUpdate = true
        }
        mg.userData.nodeMesh.material.opacity = 0.55 * mirrorU * alpha
        mg.userData.edges.material.opacity = (0.22 + 0.3 * (1 - explode)) * mirrorU * alpha
      }

      for (const c of confetti) {
        c.pts.visible = confettiU > 0.01
        if (!c.pts.visible) continue
        c.pts.material.opacity = Math.min(1, confettiU * 1.4) * alpha
        for (let i = 0; i < c.COUNT; i++) {
          const a = hash01(i, c.seed) * TAU
          const el = (hash01(i, c.seed + 1) - 0.5) * 2.2
          const r = confettiU * (0.6 + hash01(i, c.seed + 2) * 1.9)
          c.arr[i * 3] = Math.cos(a) * Math.cos(el) * r
          c.arr[i * 3 + 1] = Math.sin(el) * r * 0.8
          c.arr[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r * 0.7 - confettiU * 0.4
        }
        c.pts.geometry.attributes.position.needsUpdate = true
      }
    },
  }
}

/* ================================================================== *
 * T06 / FIX_V4 §1.10 乐句三（2:35.22–2:42）：工具峡谷
 * ------------------------------------------------------------------
 *   · 「两侧是高耸的**发光终端屏**组成的峡谷，屏上**滚动**工具调用日志」
 *        → buildCanyon()：左右各 5 块高屏（加法混合 + 边框发光），贴图用 RepeatWrapping
 *          让 `offset.y` 随时间滚动；日志文字走 text()（role 'term'，40px ≥ §2.3 的 34px）
 *   · hit9  滑动变焦（dolly zoom）      → 峡谷 z 压扁 + xy 放大的"眩晕"缩放
 *   · hit10 时间冻结式切片故障碾压        → drawSliceGlitch()：横幅切片错位 + 冻结滚动
 *   · hit11 超新星                     → drawSupernova()：扩张环 + 放射尖刺 + bloom 迸发
 *   · hit12 白场                       → 既有 flash 1.0/0.42s（161.726，即 2:41.7 最大闪白）
 *   · 「与 2:38.95 的六张卡片衔接」      → 计数卡在场期间峡谷整体压暗让位（与工具卡同一处理）
 * ================================================================== */

/** 一张"滚动日志"贴图：几行工具调用日志，字号 40px（≥ §2.3 面板下限 34px） */
function logTexture() {
  const W = 512
  const H = 640
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')
  setTextureSpace(true)
  g.clearRect(0, 0, W, H)
  const LINES = [
    '⚙ search()',
    '⚙ read()',
    '⚙ grep()',
    '⚙ patch()',
    '⚙ run_test()',
    'kv ▸ 42%',
    'tok ▸ 1.2k',
    'eos',
  ]
  for (let i = 0; i < 16; i++) {
    const txt = LINES[i % LINES.length]
    const y = 44 + i * 40
    text(g, txt, 24, y, {
      role: 'term',
      size: 40,
      family: 'code',
      weight: 500,
      color: i % 3 === 0 ? '#9fe8d0' : i % 3 === 1 ? '#7fc8ff' : '#c9a6ff',
      alpha: 0.9,
    })
  }
  setTextureSpace(false)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapT = THREE.RepeatWrapping
  tex.wrapS = THREE.ClampToEdgeWrapping
  return tex
}

/** §1.10 乐句三：两侧发光终端屏组成的峡谷（屏上滚动日志） */
function buildCanyon() {
  const grp = new THREE.Group()
  grp.name = 'k:canyon'
  const base = logTexture()
  const panels = []
  const SIDES = [-1, 1]
  for (const s of SIDES) {
    for (let i = 0; i < 5; i++) {
      const h = 1.55 + (i % 2) * 0.55
      const w = 0.52 + (i % 2) * 0.1
      const map = base.clone()
      map.needsUpdate = true
      map.wrapT = THREE.RepeatWrapping
      map.offset.y = (i * 0.37) % 1
      const mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      const z = -1.1 - i * 1.18
      const x = s * (1.02 + i * 0.16)
      m.position.set(x, 0, z)
      m.rotation.y = -s * 0.40
      grp.add(m)
      // 屏框：一圈细发光管（"发光终端屏"的边界，§1.3 之后段 K 仍允许发光框，
      // 因为 §1.10 明写"发光终端屏"，与 §1.3 段 B"删除外框小道具"是两段不同的要求）
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 1.04, h * 1.03)),
        new THREE.LineBasicMaterial({
          color: 0x8fd8ff,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      frame.position.copy(m.position)
      frame.rotation.copy(m.rotation)
      grp.add(frame)
      panels.push({ m, mat, map, frame, i, side: s })
    }
  }
  return {
    object: grp,
    panels,
    update(t, o = {}) {
      const { alpha = 1, scroll = 1, dolly = 0, freeze = 0 } = o
      grp.visible = alpha > 0.01
      if (!grp.visible) return
      for (const p of panels) {
        // 滚动：冻结（hit10）时把速度压到 0，并叠一点"错位残留"
        p.map.offset.y = (p.map.offset.y - (0.55 * scroll * (1 - freeze)) / 60) % 1
        p.mat.opacity = alpha * (0.55 + 0.4 * (1 - freeze))
        p.frame.material.opacity = alpha * 0.5
      }
      // hit9 滑动变焦：z 压扁、xy 放大 → 通道被"吸"长
      grp.scale.set(1 + dolly * 0.55, 1 + dolly * 0.35, 1 - dolly * 0.42)
    },
  }
}

/** hit10：时间冻结式切片故障碾压（横幅切片错位 + 色偏） */
function drawSliceGlitch(g, ctx, t, u) {
  if (u <= 0.01) return
  const { W, H } = ctx
  const SLICES = 9
  g.save()
  for (let i = 0; i < SLICES; i++) {
    const y = ((i * 137 + Math.floor(t * 9) * 53) % H)
    const h = 10 + ((i * 7) % 26)
    const dx = (hash01(i, 777) * 2 - 1) * 150 * u
    // 错位带：用高亮横幅 + 两侧色偏模拟"切片被推开"
    g.globalAlpha = 0.5 * u
    g.fillStyle = i % 2 ? 'rgba(120,220,255,0.5)' : 'rgba(255,120,180,0.42)'
    g.fillRect(dx, y, W, h)
    g.globalAlpha = 0.25 * u
    g.fillStyle = 'rgba(0,0,0,0.8)'
    g.fillRect(dx + 6, y + 2, W, Math.max(2, h - 6))
  }
  g.restore()
}

/** hit11：超新星（扩张环 + 放射尖刺） */
function drawSupernova(g, ctx, t, u) {
  if (u <= 0.01) return
  const { W, H } = ctx
  const cx = W * 0.5
  const cy = H * 0.46
  const r = 40 + u * H * 1.5
  g.save()
  // 扩张环
  g.globalAlpha = Math.max(0, 1 - u) * 0.95
  g.strokeStyle = rgba(C.amber, 0.95)
  g.lineWidth = 10 * (1 - u) + 2
  g.beginPath()
  g.arc(cx, cy, r, 0, TAU)
  g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(cx, cy, r * 0.78, 0, TAU)
  g.stroke()
  // 放射尖刺
  g.globalAlpha = Math.max(0, 1 - u) * 0.8
  g.strokeStyle = 'rgba(255,235,200,0.9)'
  g.lineWidth = 2
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + u * 0.6
    const r0 = r * 0.5
    const r1 = r * (1.05 + hash01(i, 888) * 0.5)
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    g.stroke()
  }
  g.restore()
}

function drawSpeedLines(g, ctx, t, heat) {
  const { W, H } = ctx
  g.save()
  const gi = Math.floor(t * 30)
  for (let i = 0; i < 130; i++) {
    const a = hash01(i, 111) * TAU
    const r0 = H * (0.10 + hash01(i, 112) * 0.3)
    const sp = 0.5 + hash01(i, 113) * 1.6
    const u = ((t * sp * 0.5 + hash01(i, 114)) % 1)
    const x0 = W / 2 + Math.cos(a) * r0
    const y0 = H / 2 + Math.sin(a) * r0
    const x1 = W / 2 + Math.cos(a) * (r0 + u * H * 0.9)
    const y1 = H / 2 + Math.sin(a) * (r0 + u * H * 0.9)
    g.strokeStyle = rgba(i % 3 === 0 ? C.gold : C.teal, (1 - u) * (0.10 + 0.25 * heat))
    g.lineWidth = 1 + hash01(i, 115) * 2
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  g.restore()
}

/* ---------------- 梯度下降小球 ---------------- */
function drawDescentBall(g, ctx, t, gd, depth) {
  const { W, H } = ctx
  const u = clamp((t - 147.9) / 13)
  const idx = Math.floor(u * (gd.steps - 1))
  const bx = gd.path[idx * 3]
  const by = gd.path[idx * 3 + 1]
  const loss = gd.path[idx * 3 + 2]
  // 映射到屏幕（损失地形的局部坐标）
  const sx = W / 2 + bx * 150
  const sy = H * 0.52 + by * 110 + depth * 26
  // 轨迹
  g.save()
  g.globalAlpha = 0.85
  g.strokeStyle = rgba(C.gold, 0.55)
  g.lineWidth = 2
  g.beginPath()
  const start = Math.max(0, idx - 180)
  for (let i = start; i <= idx; i++) {
    const x = W / 2 + gd.path[i * 3] * 150
    const y = H * 0.52 + gd.path[i * 3 + 1] * 110 + depth * 26
    i === start ? g.moveTo(x, y) : g.lineTo(x, y)
  }
  g.stroke()
  // 小球
  const r = 9 + 5 * Math.abs(Math.sin(t * 5))
  const rg = g.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4)
  rg.addColorStop(0, 'rgba(255,255,255,1)')
  rg.addColorStop(0.4, rgba(C.gold, 0.8))
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = rg
  g.beginPath()
  g.arc(sx, sy, r * 2.4, 0, TAU)
  g.fill()
  // 真实读数
  g.font = MONO(12, 600)
  g.fillStyle = C.gold
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(`∇L step ${idx}   L = ${loss.toFixed(4)}`, sx + 22, sy - 16)
  g.restore()
}

/* ---------------- 潮汐拉长的公式 ----------------
 *
 * `suppress` = 「六种书写系统数字翻牌」的开合包络（0..1）。
 * 翻牌在 y ≈ 0.60H–0.74H 的中央带，而公式云以 (W/2, 0.5H) 为心、半径最大到 0.62H，
 * 两者必然在 158.7–161.75s 撞上 —— `?selftest` r) 实测 t=161 报
 * `v@(1118,745,28×27) ∩ thai@(1133,763,26×13) IoU=0.165`（一个斜排公式字形压到翻牌的书写系统名上）。
 * 修法不是给检测开口子，而是**让两者不同时占据同一块画面**：
 * 翻牌在场时把公式云**整体上移 + 缩小 + 淡出**，让计数那一拍单独成立（§4.4 也要求别堆在一起）。
 */
function drawTidalFormulas(g, ctx, t, heat, suppress = 0) {
  const { W, H } = ctx
  const list = [FORMULAS.softmax, FORMULAS.crossentropy, FORMULAS.attention, FORMULAS.kv, FORMULAS.limit]
  g.save()
  for (let i = 0; i < list.length; i++) {
    const phase = (t * 0.16 + i / list.length) % 1
    const ang = phase * TAU * 1.6 + i * 1.1
    // 半径：被抑制时收到 55%，并把轨道中心上移，避开翻牌所在的 y ≥ 0.60H 带
    const r = (1 - phase) * H * 0.62 * (1 - 0.55 * suppress)
    const x = W / 2 + Math.cos(ang) * r * 1.15
    const yRaw = H * (0.5 - 0.20 * suppress) + Math.sin(ang) * r * 0.5
    // 翻牌在场时（suppress>0）把锚点 y 夹在翻牌带之上。
    const y = suppress > 0.01 ? Math.min(yRaw, H * 0.50) : yRaw
    // ⚠️ 只夹锚点是不够的 —— 实测 159.0s 仍报 `t(1122,749) ∩ thai(1133,763)`。
    // 原因：`drawMath` 把整条公式排在**局部 x 轴**上，而这里先 `scale(stretch, 1-…)`（stretch 最大 3.4）
    // 再 `rotate(ang*0.4)`；当转角接近 90° 时，一条 27 字符的公式（约 27×12×3.4 ≈ 1100px）
    // 会**整条竖过来**、从锚点向上下各铺约 550px —— 于是它必然扫过 y≈763 的书写系统名那一行。
    // 实测该帧 size=20 的旋转盒共 **135 个**（= 5 条公式 × 27 段），y 从 −252 一直到 912，正是这个形状。
    // 所以抑制期必须**一起压缩链长**：把 stretch 收到 30%，跨度降到 ±146px 左右，
    // 配上锚点 y ≤ 0.50H，整条公式就停在 y ≈ [394, 686]，与 763 那一行留出余量。
    const stretchRaw = 1 + phase * 2.4 // 潮汐拉长
    const stretch = suppress > 0.01 ? stretchRaw * (1 - 0.7 * suppress) : stretchRaw
    g.save()
    g.globalAlpha = clamp(0.18 + phase * 0.7) * (0.6 + 0.4 * heat) * (1 - 0.85 * suppress)
    g.translate(x, y)
    g.rotate(ang * 0.4)
    g.scale(stretch, 1 - phase * 0.35)
    drawMath(g, 0, 0, list[i], 20, { color: phase > 0.7 ? C.pink : C.purple, align: 'center' })
    g.restore()
  }
  g.restore()
}

/* ---------------- 工具调用卡片飞入（§7 段 K：工具调用只在**侧带**） ----------------
 *
 * ⚠️ 本轮修的 §2.8 重叠（`?selftest` r) 在 156s 报 IoU 0.475 / 0.647）：
 * 旧实现让 12 张卡片全部飞向同一点 `(W*0.62-160, H*0.42-60)`，只用 `i*14` 做纵向错开 ——
 * 卡片高约 60px、文字框宽 125–187px，14px 的错开根本不够，于是卡片的 `tool:`/`args:` 两行
 * 直接压在一起（实测两张卡的 args 行 y 完全相同、x 只差 43）。
 *
 * 新实现给每张卡一个**固定卡位**：左带竖排（§7 段 K 明写「终端屏只在侧带显示工具调用」，
 * 且「本段无立绘」，所以旧的"飞向她"已无对象）。卡位间距 59px > 卡片内容高度，
 * 于是无论有几张同时在场，文字框都不会相交。
 */
/**
 * T04 / §1.10：段 K 的**大号**工具调用卡片（单行，字号 ≥34px）。
 * 为什么不用 `dsh.js` 的 `toolCard()`：那个组件内部固定 13/12px，是全片 dsh 界面共用的，
 * 改它会波及别处；而 §1.10 只要求段 K 的卡"别小到看不清"。
 * 一行放不下时按实测宽度截断加 `…`，保证不会溢出到中间（黑洞/歌词所在）。
 */
function drawToolCardLg(g, { x, y, w, px, name, ok, accent }) {
  const h = px * 1.45
  roundRect(g, x, y, w, h, 8)
  g.fillStyle = 'rgba(10,14,20,0.55)'
  g.fill()
  g.strokeStyle = rgba(ok ? accent : C.panelEdge, 0.85)
  g.lineWidth = 2
  g.stroke()
  // 左侧强调条
  g.fillStyle = rgba(ok ? C.cyan : C.amber, 0.9)
  g.fillRect(x + 2, y + 2, 5, h - 4)
  const label = `${ok ? '⚙' : '…'} ${name}()`
  g.font = MONO(px, 700)
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillStyle = rgba(C.fg, 0.96)
  let str = label
  const maxW = w - 28
  while (str.length > 4 && g.measureText(str).width > maxW) str = str.slice(0, -2) + '…'
  g.fillText(str, x + 16, y + h / 2)
}

function drawToolCards(g, ctx, t, execs, heat) {
  const { W, H } = ctx
  // §1.11 的六张计数卡（2:38.95）是**满宽**的一排（每张 14.3% 画面宽，第一张从 x≈56 起），
  // 而 §1.10 的工具调用卡住在**左带**（x 40–380）—— 两者在 y≈760 处必然相撞。
  // 实测 161.6s：`tool: commit_all(48,771,125×15) ∩ 1 · eins(56,760,163×39) IoU 0.268`。
  // §1.10 说工具卡"不与黑洞/歌词重叠"、§1.11 说这一拍是计数卡的戏，所以**让工具卡让位**：
  // 计数卡在场期间把工具卡整体淡出（窗口两端各留 0.4s 的斜坡，避免硬切）。
  const yieldToCards = span(t, 158.0, 158.4) * (1 - span(t, 161.75, 162.15))
  if (yieldToCards > 0.995) return
  // 左带：§2.4 的分区是 x ∈ [0, 22%]，卡片宽 396 + 左边距 20 = 416 < 0.22W(=422) 放得下
  // ---- T04 / §1.10：「工具调用卡片字号 **≥34px**（现状左上角的卡片小到看不清）」----
  // 原来走的是 `dsh.js` 的 `toolCard()`，它内部是 13px/12px —— 实测 `textBoxes()` 里
  // `tool: run_test` 就是 13px。那个组件是全片 dsh 界面共用的，直接改它会影响别处，
  // 所以这里按 §1.10 自己画 34px 的单行卡片（只影响段 K）。
  const TOOL_PX = 34
  const targetX = 20
  const cardW = 396
  const slotH = 56
  const yTop = H * 0.10
  g.save()
  for (let i = 0; i < execs.length; i++) {
    const t0 = execs[i]
    const u = span(t, t0 - 0.34, t0)
    const after = t - t0
    if (u <= 0) continue
    const fade = 1 - span(t, t0 + 0.42, t0 + 0.8)
    if (fade <= 0.01) continue
    // 从左侧飞入到自己的卡位（不再全部收敛到同一点）
    const sx = -420 + (targetX + 420) * outCubic(clamp(u))
    const sy = yTop + (i % 12) * slotH
    const jolt = after > 0 && after < 0.25 ? (1 - after / 0.25) * 26 : 0
    g.globalAlpha = clamp(fade) * (1 - yieldToCards)
    g.save()
    g.translate(sx + (hash01(i, 121) * 2 - 1) * jolt, sy + (hash01(i, 122) * 2 - 1) * jolt)
    drawToolCardLg(g, {
      x: 0,
      y: 0,
      w: cardW,
      px: TOOL_PX,
      name: TOOL_NAMES[i % TOOL_NAMES.length],
      ok: after > 0,
      accent: C.cyan,
    })
    // 命中火花
    if (after >= 0 && after < 0.3) {
      const sp = 1 - after / 0.3
      g.fillStyle = rgba(C.cyan, sp * 0.6)
      g.beginPath()
      g.arc(cardW, 26, 8 + 40 * (1 - sp), 0, TAU)
      g.fill()
    }
    g.restore()
  }
  g.restore()
}

/* ---------------- §1.11 六张计数卡片（2:38.95） ----------------
 *
 * §1.11 原文逐条落实：
 *   · 「从 **lyrics.json** 读取该句的六个计数词(按 2:38.95 的词时间)」→ 下面从 `ctx.lyrics`
 *     找 t0 最接近 158.95 的那一句，取它的 `words`。**主字就是歌词里对应唱出的词**
 *     （Ein/Dos/Trois/Ne/Fem/Liu），不是自造的符号。
 *   · 「每个词起唱时翻牌一次,不得提前或滞后」→ 每张卡的 flip 用它自己那个词的 `w.t` 驱动。
 *   · 「次级信息:数字 1–6 与该语言名的原文标注」→ `COUNT_LANGS`（并**删掉**了
 *     latin/arabic-indic/devanagari/cjk/thai/roman 这类书写系统标签）。
 *   · 「卡片做大(每张宽 ≥画面宽度 14%)」→ `cw` 由可用宽算出，实测 275/1920 = **14.3%**。
 *   · 「3D 翻牌」→ 用**梯形透视 + 横向压缩 + 随翻面移动的高光**近似绕竖轴翻转（纯 2D canvas
 *     画不出真 3D，但梯形+高光比单纯 `scaleX` 明确得多）。
 *   · 「配色各异」→ 每张卡一组主色。
 *   · 「随起音点轻微弹跳」→ 每个词起唱后 0.25s 内给一个 outBack 式的位移+缩放。
 *   · §2.3「面板类文字最小 34px」→ 次级行用 **34px**（原来是 11px）。
 */
function drawNumeralFlips(g, ctx, t, counts) {
  const { W, H } = ctx
  const a = span(t, 158.7, 159.1) * (1 - span(t, 161.3, 161.75))
  if (a <= 0.01) return

  // ---- 1) 从 lyrics.json 取这一句的六个唱词（含每个词自己的起唱时间） ----
  let words = null
  const all = ctx.lyrics || []
  if (all.length) {
    let best = null
    let bestD = Infinity
    for (const s of all) {
      const d = Math.abs((s.t0 ?? 1e9) - 158.95)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (best && Array.isArray(best.words) && best.words.length >= COUNT_LANGS.length) {
      words = best.words.slice(0, COUNT_LANGS.length)
    }
  }
  const sung = words ? words.map((w) => String(w.w).trim()) : COUNT_FALLBACK
  // 起唱时间：优先用歌词里的实测词时间；`counts`（锚点驱动）只作兜底
  const onset = (i) => {
    const fromLyrics = words && words[i] && Number.isFinite(words[i].t) ? words[i].t : null
    return fromLyrics != null ? fromLyrics : (counts[i] ?? 158.95 + i * 0.35)
  }

  // ---- 2) 版式：每张 ≥14% 画面宽 ----
  const N = COUNT_LANGS.length
  const gap = W * 0.028
  const cw = (W - gap * (N - 1)) / N // = 275.2 @1920 → 14.3%
  const ch = 190
  const x0 = (W - (cw * N + gap * (N - 1))) / 2
  const y = H * 0.60
  const COLORS = ['#7fd8ff', '#ffd479', '#a5e075', '#ff8fa3', '#c792aa', '#4dd0e1']
  const revealedN = counts.filter((c) => t >= c).length

  g.save()
  for (let i = 0; i < N; i++) {
    const t0 = onset(i)
    const u = clamp(span(t, t0, t0 + 0.26))
    const flip = inOutCubic(u)
    const x = x0 + i * (cw + gap)
    // 起音点轻微弹跳（outBack 式）
    const bump = 1 - clamp(span(t, t0, t0 + 0.25))
    const dy = -6 * Math.sin(bump * Math.PI) * (bump > 0 ? 1 : 0)
    const sc = 1 + 0.04 * Math.sin(bump * Math.PI)

    const sx = Math.max(0.06, Math.abs(Math.cos(flip * Math.PI))) // 0=正面,1=侧面
    const revealed = flip > 0.5
    const skew = (1 - sx) * cw * 0.18 // 侧面时上/下边错开 → 梯形透视

    g.save()
    g.globalAlpha = a
    g.translate(x + cw / 2, y + ch / 2 + dy)
    g.scale(sc, sc)

    // 卡片本体：梯形（±xx 是上下边的半宽差）
    const hw = cw / 2
    const hh = ch / 2
    g.beginPath()
    g.moveTo(-hw * sx + skew, -hh)
    g.lineTo(hw * sx + skew, -hh)
    g.lineTo(hw * sx - skew, hh)
    g.lineTo(-hw * sx - skew, hh)
    g.closePath()
    g.fillStyle = 'rgba(20,17,30,0.94)'
    g.fill()
    g.strokeStyle = rgba(i < revealedN ? COLORS[i % COLORS.length] : C.panelEdge, 0.95)
    g.lineWidth = 3
    g.stroke()
    // 翻面高光：随 sx 移动，制造"金属牌在转"的观感
    const hl = g.createLinearGradient(-hw, 0, hw, 0)
    hl.addColorStop(0, `rgba(255,255,255,${(0.16 * (1 - sx)).toFixed(3)})`)
    hl.addColorStop(0.5, `rgba(255,255,255,${(0.30 * (1 - sx)).toFixed(3)})`)
    hl.addColorStop(1, `rgba(255,255,255,0)`)
    g.fillStyle = hl
    g.fill()

    // 主字 = 歌词里唱出的那个词（未翻到正面时显示背面纹样）
    if (revealed && sx > 0.25) {
      g.save()
      g.scale(sx, 1)
      g.font = MONO(64, 700)
      g.fillStyle = COLORS[i % COLORS.length]
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(sung[i], 0, -26)
      g.restore()
    } else {
      g.strokeStyle = rgba(C.fgDim, 0.5)
      g.lineWidth = 2
      g.beginPath()
      g.arc(0, -26, 22, 0, TAU)
      g.stroke()
    }

    // 次级信息（T00）：语言代码徽标（左）+ 该语言的数字原文（右），同一行，≥34px。
    // 旧的两行（数字 1–6 + 汉字语言名）已删除。
    g.save()
    g.scale(sx, 1)
    const SEC_Y = 56
    const SEC_PX = 34
    const sp = COUNT_LANGS[i]
    const isKO = sp.code === 'KO'
    // 量宽：KO 那张的徽标里还要塞一个 1.3 倍的「?」
    g.font = MONO(SEC_PX, 700)
    const codeW = g.measureText(sp.code).width
    g.font = MONO(SEC_PX * 1.3, 700)
    const qW = isKO ? g.measureText('?').width : 0
    g.font = MONO(SEC_PX, 600)
    const numW = g.measureText(sp.native).width
    const padX = 14
    const badgeW = codeW + qW + padX * 2
    const gap2 = 16
    const totalW = badgeW + gap2 + numW
    const bx = -totalW / 2
    // —— 徽标：实心圆角小标签，深色底 / 亮色字 / 大写等宽，颜色与该卡主色一致 ——
    roundRect(g, bx, SEC_Y - 26, badgeW, 52, 12)
    g.fillStyle = 'rgba(12,12,18,0.92)'
    g.fill()
    g.strokeStyle = isKO ? '#ffd54f' : rgba(COLORS[i % COLORS.length], 0.95)
    g.lineWidth = isKO ? 4 : 2
    g.stroke()
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.font = MONO(SEC_PX, 700)
    g.fillStyle = COLORS[i % COLORS.length]
    g.fillText(sp.code, bx + padX, SEC_Y)
    // —— 第 4 张的「?」：紧贴 KO 右边、1.3 倍、亮黄、外发光、随起音点轻微脉冲 ——
    if (isKO) {
      const since = t - t0
      const pulse = 1 + (since >= 0 && since < 0.5 ? 0.18 * Math.sin(since * 22) : 0)
      g.save()
      g.font = MONO(SEC_PX * 1.3, 700)
      g.shadowColor = '#ffd54f'
      g.shadowBlur = 16
      g.fillStyle = '#ffd54f'
      g.translate(bx + padX + codeW + qW / 2, SEC_Y)
      g.scale(pulse, pulse)
      g.textAlign = 'center'
      g.fillText('?', 0, 0)
      g.restore()
      g.textAlign = 'left'
    }
    // —— 数字原文（右）——
    g.font = MONO(SEC_PX, 600)
    g.fillStyle = rgba(C.fg, 0.95)
    g.fillText(sp.native, bx + badgeW + gap2, SEC_Y)
    g.restore()

    g.restore()
  }
  g.restore()
}
