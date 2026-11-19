import * as THREE from 'three';

const MAX_SMOKE_PARTICLES = 220;

interface SmokeSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rot: number;
  rotSpeed: number;
  startScale: number;
  endScale: number;
  baseOpacity: number;
  tintMix: number; // 0 = cool silver-white tire smoke, 1 = cyan-tinted nitrous drift haze
  life: number;
  maxLife: number;
}

export class TireSmokeSystem {
  public readonly mesh: THREE.InstancedMesh;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly metaAttr: THREE.InstancedBufferAttribute;
  private readonly metaArray: Float32Array;
  private readonly slots: SmokeSlot[] = [];
  private cursor = 0;

  constructor(
    smokeTexture: THREE.Texture,
    fogColor: THREE.Color,
    fogDensity: number,
  ) {
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.metaArray = new Float32Array(MAX_SMOKE_PARTICLES * 4);
    this.metaAttr = new THREE.InstancedBufferAttribute(this.metaArray, 4);
    this.metaAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aMeta', this.metaAttr);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: smokeTexture },
        uFogColor: { value: fogColor.clone() },
        uFogDensity: { value: fogDensity },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aMeta; // x=scale, y=rot, z=opacity, w=tintMix
        varying vec2 vUv;
        varying float vOpacity;
        varying float vTintMix;
        varying float vFogDepth;

        void main() {
          vUv = uv;
          vOpacity = aMeta.z;
          vTintMix = aMeta.w;

          if (aMeta.z <= 0.001 || aMeta.x <= 0.001) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            vFogDepth = 0.0;
            return;
          }

          vec3 worldCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float c = cos(aMeta.y);
          float s = sin(aMeta.y);
          vec2 rotated = vec2(
            position.x * c - position.y * s,
            position.x * s + position.y * c
          ) * aMeta.x;

          vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 worldPos = worldCenter + camRight * rotated.x + camUp * rotated.y;

          vec4 mvPos = viewMatrix * vec4(worldPos, 1.0);
          vFogDepth = -mvPos.z;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec2 vUv;
        varying float vOpacity;
        varying float vTintMix;
        varying float vFogDepth;

        void main() {
          vec4 tex = texture2D(uMap, vUv);
          float alpha = tex.a * vOpacity;
          if (alpha <= 0.004) discard;

          vec3 coolSmoke = vec3(0.84, 0.89, 0.96);
          vec3 nitroHaze = vec3(0.45, 0.84, 0.98);
          vec3 smokeCol = tex.rgb * mix(coolSmoke, nitroHaze, vTintMix);

          float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          smokeCol = mix(smokeCol, uFogColor, clamp(fogFactor, 0.0, 1.0));

          gl_FragColor = vec4(smokeCol, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_SMOKE_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;

    const identity = new THREE.Matrix4();
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, identity);
      this.slots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rot: 0,
        rotSpeed: 0,
        startScale: 0.5,
        endScale: 2.4,
        baseOpacity: 0,
        tintMix: 0,
        life: 0,
        maxLife: 0.7,
      });
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    intensity: number,
    nitroTinted = false,
  ): void {
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_SMOKE_PARTICLES;
    const slot = this.slots[idx];

    const clamped = Math.max(0.15, Math.min(1, intensity));
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.rot = Math.random() * Math.PI * 2;
    slot.rotSpeed = (Math.random() - 0.5) * 2.4;
    slot.startScale = 0.46 + clamped * 0.34;
    slot.endScale = 2.0 + clamped * 1.45 + Math.random() * 0.45;
    slot.baseOpacity = 0.24 + clamped * 0.32;
    slot.tintMix = nitroTinted ? 0.55 : 0.0;
    slot.maxLife = 0.52 + clamped * 0.36 + Math.random() * 0.14;
    slot.life = slot.maxLife;
  }

  public update(dt: number): void {
    const matArr = this.mesh.instanceMatrix.array as Float32Array;
    const drag = Math.exp(-3.1 * dt);
    let anyDirty = false;

    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      const s = this.slots[i];
      const metaBase = i * 4;

      if (!s.active) {
        if (this.metaArray[metaBase + 2] !== 0) {
          this.metaArray[metaBase + 2] = 0;
          anyDirty = true;
        }
        continue;
      }

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.metaArray[metaBase] = 0;
        this.metaArray[metaBase + 2] = 0;
        anyDirty = true;
        continue;
      }

      s.vx *= drag;
      s.vz *= drag;
      s.vy = s.vy * Math.exp(-1.1 * dt) + 0.55 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.rot += s.rotSpeed * dt;

      const age = 1 - s.life / s.maxLife;
      const scale = s.startScale + (s.endScale - s.startScale) * Math.pow(age, 0.72);
      // Fast soft fade-in over first 10% of lifetime, then smooth billowing dissipation
      const fadeIn = age < 0.1 ? age / 0.1 : 1;
      const fadeOut = Math.pow(1 - age, 1.35);
      const opacity = s.baseOpacity * fadeIn * fadeOut;

      const matOffset = i * 16;
      matArr[matOffset + 12] = s.x;
      matArr[matOffset + 13] = s.y;
      matArr[matOffset + 14] = s.z;

      this.metaArray[metaBase] = scale;
      this.metaArray[metaBase + 1] = s.rot;
      this.metaArray[metaBase + 2] = opacity;
      this.metaArray[metaBase + 3] = s.tintMix;
      anyDirty = true;
    }

    if (anyDirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.metaAttr.needsUpdate = true;
    }
  }

  public clear(): void {
    for (let i = 0; i < MAX_SMOKE_PARTICLES; i++) {
      this.slots[i].active = false;
      this.metaArray[i * 4] = 0;
      this.metaArray[i * 4 + 2] = 0;
    }
    this.metaAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
