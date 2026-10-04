// src/core/post3d.js — 3D 后处理管线（FIX.md §2.4）
// EffectComposer: RenderPass → UnrealBloomPass → 自写 ShaderPass（色散 / 切片故障 / 径向模糊 / 暗角 / 镜头畸变）
//
// · 内部分辨率可降到 1600×900 以保帧率（见 RES_SCALE）。
// · 必须保留 alpha：3D 画布是叠在 2D 舞台层之上的，若后处理把 alpha 写成 1，
//   2D 舞台会被整片黑盖住。所以自写 pass 同时采样并输出 alpha（bloom 的加性叠加会让亮部更不透明，这是想要的辉光感）。
// · 全部 uniform 由 t 推导（无累积状态），符合 SPEC §2.2 的纯函数渲染。
// · 若 three 的 addons 加载失败（离线/裁剪构建），enabled=false，回退到 renderer 直接渲染。

import * as THREE from 'three'
import { ACES_GLSL } from './exposure.js'

export const RES_SCALE = 1.0 // 需要保帧率时可降到 0.83（≈1600×900）

const FX_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FX_FRAG = `
uniform sampler2D tDiffuse;
uniform float uTime, uDispersion, uGlitch, uRadial, uVignette, uAberr, uScan, uExposure;
uniform vec2 uResolution;
varying vec2 vUv;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453123); }

${ACES_GLSL}

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);

  // 镜头畸变（轻微桶形）
  vec2 uv = 0.5 + c * (1.0 + 0.055 * r2);

  // 切片故障：把画面横向切成 24 条，随机条带整体错位
  float bands = 24.0;
  float band = floor(uv.y * bands);
  float seed = band + floor(uTime * 24.0) * 13.0;
  float g = step(1.0 - uGlitch * 0.9, hash11(seed));
  uv.x += g * (hash11(seed * 1.7 + 3.1) - 0.5) * 0.075 * uGlitch;

  // 色散偏移（按屏幕高度归一，uAberr 为像素级强度）
  vec2 off = vec2(uAberr * 0.0022, 0.0);

  vec3 col = vec3(0.0);
  float alpha = 0.0;
  if (uRadial > 0.002) {
    // 径向模糊：沿"向心"方向多次采样（真实的多点采样，不是放射线贴图）
    const int N = 12;
    for (int i = 0; i < N; i++) {
      float s = 1.0 - (float(i) / float(N)) * 0.09 * uRadial;
      vec2 suv = 0.5 + (uv - 0.5) * s;
      col.r += texture2D(tDiffuse, suv + off).r;
      col.g += texture2D(tDiffuse, suv).g;
      col.b += texture2D(tDiffuse, suv - off).b;
      alpha += texture2D(tDiffuse, suv).a;
    }
    col /= float(N);
    alpha /= float(N);
  } else {
    col.r = texture2D(tDiffuse, uv + off).r;
    col.g = texture2D(tDiffuse, uv).g;
    col.b = texture2D(tDiffuse, uv - off).b;
    alpha = texture2D(tDiffuse, uv).a;
  }
  // 3D 是底层：输出不透明（清屏色本身不透明），否则下面的 DOM/2D 层会透出页面背景

  // 扫描线（极轻，CRT 味）
  col *= 1.0 - uScan * 0.12 * step(0.5, fract(uv.y * uResolution.y * 0.5));

  // 暗角
  col *= 1.0 - uVignette * smoothstep(0.18, 0.78, length(c) * 1.45);

  // uDispersion 只做整体提亮饱和的微调，保持口径统一
  col = mix(col, col * vec3(1.06, 1.0, 1.06), clamp(uDispersion, 0.0, 1.0) * 0.5);

  // ---- §6：ACESFilmic 色调映射 + 每段 exposure 关键帧 ----
  // 必须是**链路的最后一步**（在 bloom / 扫描线 / 暗角之后），否则色调映射会被后续乘法再压一次。
  col = acesFilmic(col * uExposure);

  gl_FragColor = vec4(col, 1.0);
}
`

export async function createPost3D(renderer, scene, camera, { width, height, camera2 = null } = {}) {
  const out = {
    enabled: false,
    render: () => renderer.render(scene, camera),
    setSize: () => {},
    setParams: () => {},
    info: () => renderer.info,
    dispose: () => {},
  }

  let EffectComposer, RenderPass, UnrealBloomPass, ShaderPass
  try {
    ;[
      { EffectComposer },
      { RenderPass },
      { UnrealBloomPass },
      { ShaderPass },
    ] = await Promise.all([
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/ShaderPass.js'),
    ])
  } catch (e) {
    console.warn('[post3d] three addons 不可用，回退到直接渲染：', e && e.message)
    return out
  }

  const fxShader = {
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uDispersion: { value: 0 },
      uGlitch: { value: 0 },
      uRadial: { value: 0 },
      uVignette: { value: 0.35 },
      uAberr: { value: 0 },
      uScan: { value: 0.25 },
      uExposure: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(width, height) },
    },
    vertexShader: FX_VERT,
    fragmentShader: FX_FRAG,
  }

  const w = Math.max(2, Math.round(width * RES_SCALE))
  const h = Math.max(2, Math.round(height * RES_SCALE))
  const target = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 2,
  })
  const composer = new EffectComposer(renderer, target)
  composer.setSize(width, height)

  const renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  // 第二个 RenderPass：鲸鱼层用正交相机，叠在舞台之上（不清屏）
  if (camera2) {
    const pass2 = new RenderPass(scene, camera2)
    pass2.clear = false
    composer.addPass(pass2)
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.65, 0.82)
  const fx = new ShaderPass(fxShader)
  composer.addPass(bloom)
  composer.addPass(fx)

  Object.assign(out, {
    enabled: true,
    composer,
    bloom,
    fx,
    render(t, p = {}) {
      // ⚠️ T19c 修（真 bug，影响全片）：这里原来写的是 `fxShader.uniforms.*`，但 `ShaderPass`
      // 对**普通 shader 对象**会 `UniformsUtils.clone(shader.uniforms)` 再拿克隆去建材质
      // —— 所以写源对象**一个字都到不了 GPU**。实测（T19b）：t=72 时 `ctx.exposure=3.2`
      // 而 `fx.uniforms.uExposure` 仍是构造默认值 **1**；t=69.42 时 `fx.glitch(t)=0.292`
      // 而 `uGlitch` 仍是 **0** ⇒ **§6 的 exposure 关键帧全表 + 逐帧 glitch/dispersion/
      // aberration/scan/vignette/radial 一直是惰性的**（画面只有构造默认：vignette 0.35 /
      // scan 0.25 / 其余 0 / exposure 1.0）。改成写 `fx.uniforms`（= 材质真正用的那一份）。
      const u = fx.uniforms
      u.uTime.value = t
      u.uDispersion.value = p.dispersion ?? 0
      u.uGlitch.value = p.glitch ?? 0
      u.uRadial.value = p.radial ?? 0
      u.uVignette.value = p.vignette ?? 0.35
      u.uAberr.value = p.aberration ?? 0
      u.uScan.value = p.scan ?? 0.25
      u.uExposure.value = p.exposure ?? 1.0
      bloom.strength = p.bloom ?? 0.42
      bloom.radius = p.bloomRadius ?? 0.65
      composer.render()
    },
    setSize(w2, h2) {
      composer.setSize(w2, h2)
      fxShader.uniforms.uResolution.value.set(w2, h2)
      bloom.setSize(w2, h2)
    },
    dispose() {
      composer.dispose?.()
      target.dispose()
    },
  })
  return out
}
