import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const SpeedMotionBlurShader = {
  name: 'SpeedMotionBlurShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.0 },
    uNitroFactor: { value: 0.0 },
    uLateralBlur: { value: 0.0 },
    uFocusCenter: { value: new THREE.Vector2(0.5, 0.43) },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uNitroFactor;
    uniform float uLateralBlur;
    uniform vec2 uFocusCenter;
    uniform float uAspect;

    float interleavedGradientNoise(vec2 fragCoord) {
      vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
      return fract(magic.z * fract(dot(fragCoord, magic.xy)));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (uIntensity <= 0.0005 && abs(uLateralBlur) <= 0.0005) {
        gl_FragColor = base;
        return;
      }

      vec2 toCenter = vUv - uFocusCenter;
      vec2 aspectVec = vec2(toCenter.x * uAspect, toCenter.y);
      float dist = length(aspectVec);

      // Keep hero car & immediate track apex sharp while streaking peripheral edges
      float radialMask = smoothstep(0.15, 0.78, dist);
      vec2 radialDir = dist > 0.0001 ? (toCenter / dist) : vec2(0.0);

      vec2 blurVec =
        radialDir * (uIntensity * radialMask) +
        vec2(uLateralBlur * 0.014 * radialMask, 0.0);

      float rawLen = length(blurVec);
      if (rawLen <= 0.0002) {
        gl_FragColor = base;
        return;
      }

      float clampedLen = min(rawLen, 0.072);
      vec2 stepVec = (blurVec / rawLen) * clampedLen;

      const int SAMPLES = 12;
      float jitter = interleavedGradientNoise(gl_FragCoord.xy) - 0.5;
      vec3 accum = vec3(0.0);
      float totalWeight = 0.0;

      for (int i = 0; i < SAMPLES; i++) {
        float t = clamp((float(i) + jitter) / float(SAMPLES - 1), 0.0, 1.0);
        vec2 sampleUv = clamp(vUv - stepVec * t, vec2(0.001), vec2(0.999));
        float w = 1.0 - t * 0.55;
        accum += texture2D(tDiffuse, sampleUv).rgb * w;
        totalWeight += w;
      }

      vec3 blurred = accum / max(totalWeight, 0.0001);

      // Subtle Nitrous peripheral chromatic split at high velocity
      if (uNitroFactor > 0.01 && radialMask > 0.05) {
        vec2 chromaShift = radialDir * (0.0052 * uNitroFactor * radialMask);
        float rEdge = texture2D(tDiffuse, clamp(vUv + chromaShift, vec2(0.001), vec2(0.999))).r;
        float bEdge = texture2D(tDiffuse, clamp(vUv - chromaShift, vec2(0.001), vec2(0.999))).b;
        float chromaMix = 0.55 * uNitroFactor * radialMask;
        blurred.r = mix(blurred.r, rEdge, chromaMix);
        blurred.b = mix(blurred.b, bEdge, chromaMix);
      }

      gl_FragColor = vec4(blurred, base.a);
    }
  `,
};

export interface MotionBlurPipeline {
  composer: EffectComposer;
  motionBlurPass: ShaderPass;
  update: (params: {
    speedMs: number;
    nitroActive: boolean;
    lateralRate: number;
    focusX: number;
    focusY: number;
    enabled: boolean;
    dt: number;
  }) => void;
  setSize: (width: number, height: number, pixelRatio: number) => void;
  render: () => void;
  dispose: () => void;
}

export function createMotionBlurPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  pixelRatio: number,
  msaaSamples: number,
): MotionBlurPipeline {
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.max(1, Math.floor(width * pixelRatio)),
    Math.max(1, Math.floor(height * pixelRatio)),
    {
      type: THREE.HalfFloatType,
      samples: msaaSamples,
    },
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const motionBlurPass = new ShaderPass(SpeedMotionBlurShader);
  motionBlurPass.material.uniforms.uAspect.value = width / Math.max(1, height);
  composer.addPass(motionBlurPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  let currentIntensity = 0;
  let currentNitro = 0;
  let currentLateral = 0;

  return {
    composer,
    motionBlurPass,
    update: ({ speedMs, nitroActive, lateralRate, focusX, focusY, enabled, dt }) => {
      const speedKmh = Math.abs(speedMs) * 3.6;
      const speedNorm = enabled ? THREE.MathUtils.clamp((speedKmh - 65) / 225, 0, 1) : 0;
      const targetNitro = enabled && nitroActive ? 1 : 0;
      const targetIntensity = enabled
        ? Math.pow(speedNorm, 1.3) * 0.048 + targetNitro * 0.024
        : 0;
      const targetLateral = enabled ? THREE.MathUtils.clamp(lateralRate * speedNorm, -1, 1) : 0;

      currentIntensity = THREE.MathUtils.damp(currentIntensity, targetIntensity, 8.5, dt);
      currentNitro = THREE.MathUtils.damp(currentNitro, targetNitro, 7.5, dt);
      currentLateral = THREE.MathUtils.damp(currentLateral, targetLateral, 9.0, dt);

      const u = motionBlurPass.material.uniforms;
      u.uIntensity.value = currentIntensity;
      u.uNitroFactor.value = currentNitro;
      u.uLateralBlur.value = currentLateral;
      u.uFocusCenter.value.set(
        THREE.MathUtils.clamp(focusX, 0.25, 0.75),
        THREE.MathUtils.clamp(focusY, 0.25, 0.65),
      );
    },
    setSize: (w, h, pr) => {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      motionBlurPass.material.uniforms.uAspect.value = w / Math.max(1, h);
    },
    render: () => {
      composer.render();
    },
    dispose: () => {
      renderTarget.dispose();
      motionBlurPass.dispose();
      outputPass.dispose();
      composer.dispose();
    },
  };
}
