import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { createTrafficVehicleMesh, TrafficMeshHandles, TrafficVehicleKind } from './trafficModel';
import { InputState } from './types';

export const HIGHWAY_LANE_CENTERS = [-5.4, -1.8, 1.8, 5.4];
const ROAD_WIDTH = 16.4;
const BARRIER_LIMIT_X = 7.35;
const CHUNK_LENGTH = 44;
const CHUNK_COUNT = 12; // 528m active scrolling expressway
const TOTAL_SPAN = CHUNK_LENGTH * CHUNK_COUNT;
const TRAFFIC_COUNT = 16;

interface HighwayChunk {
  group: THREE.Group;
  zBase: number;
}

interface TrafficActor {
  mesh: TrafficMeshHandles;
  lane: number;
  x: number;
  z: number;
  speedMs: number;
  wheelAngle: number;
  nearMissed: boolean;
}

export interface HighwayStepResult {
  score: number;
  distanceKm: number;
  comboMultiplier: number;
  comboTimerRatio: number;
  nearMissCount: number;
  maxCombo: number;
  wallImpact: number;
  skidIntensity: number;
  crashed: boolean;
  eventBanner: string | null;
}

export class HighwayRushWorld {
  public readonly group = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private localTextures: THREE.Texture[] = [];

  private chunks: HighwayChunk[] = [];
  private traffic: TrafficActor[] = [];

  // Player state on expressway (+Z = forward, X = lateral across 4 lanes)
  public playerX = 1.8;
  public playerZ = 0;
  public playerVx = 0;
  public playerSpeed = 0;
  public playerHeading = 0;
  public steerVisual = 0;
  public wheelSpinAngle = 0;
  public chassisPitch = 0;
  public chassisRoll = 0;
  public braking = false;
  public drifting = false;

  // Score & Near-Miss Combo State
  public score = 0;
  public comboMultiplier = 1;
  public comboTimer = 0;
  public readonly comboDuration = 4.0;
  public nearMissCount = 0;
  public maxCombo = 1;
  public crashed = false;

  constructor(textures: ProceduralTextureSet) {
    this.buildEnvironment(textures);
    this.buildTraffic(textures);
    this.reset(false);
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private createHighwayRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1B2029';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle aggregate grain
    for (let i = 0; i < 6500; i++) {
      const shade = 20 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 8})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Outer shoulder solid white lines
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(18, 0, 10, 512);
    ctx.fillRect(484, 0, 10, 512);

    // 4-lane dashed lane dividers (at 25%, 50%, 75%)
    ctx.fillStyle = '#CBD5E1';
    for (let y = 24; y < 512; y += 128) {
      ctx.fillRect(136, y, 7, 62);
      ctx.fillRect(369, y, 7, 62);
    }
    ctx.fillStyle = '#F59E0B';
    for (let y = 24; y < 512; y += 128) {
      ctx.fillRect(252, y, 8, 62);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    tex.needsUpdate = true;
    this.localTextures.push(tex);
    return tex;
  }

  private buildEnvironment(textures: ProceduralTextureSet): void {
    // Twilight sky dome (reusing sky gradient)
    const skyGeo = this.trackGeo(new THREE.SphereGeometry(720, 28, 18));
    const skyMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.sky,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(skyMesh);

    const hwyRoadTex = this.createHighwayRoadTexture();
    const roadMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: hwyRoadTex,
        roughnessMap: textures.asphaltRoughness,
        roughness: 0.6,
        metalness: 0.14,
      }),
    );

    const barrierMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.barrier,
        roughness: 0.78,
        metalness: 0.1,
      }),
    );

    const groundMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0e131b, roughness: 0.95 }),
    );

    const poleMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 }),
    );
    const lampMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.0,
      }),
    );
    const roadGlowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.glowHalo,
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const gantryMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.32 }),
    );
    const gantryAccentMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xf97316,
        emissiveIntensity: 1.5,
      }),
    );

    const bldgMats = textures.buildings.map((bTex) =>
      this.trackMat(
        new THREE.MeshStandardMaterial({
          map: bTex,
          roughness: 0.45,
          metalness: 0.35,
          emissive: 0xffffff,
          emissiveMap: bTex,
          emissiveIntensity: 0.35,
        }),
      ),
    );

    const roadGeo = this.trackGeo(new THREE.PlaneGeometry(ROAD_WIDTH, CHUNK_LENGTH));
    roadGeo.rotateX(-Math.PI / 2);
    const groundGeo = this.trackGeo(new THREE.PlaneGeometry(240, CHUNK_LENGTH));
    groundGeo.rotateX(-Math.PI / 2);
    const wallGeo = this.trackGeo(new THREE.BoxGeometry(0.65, 1.05, CHUNK_LENGTH));
    const poleGeo = this.trackGeo(new THREE.CylinderGeometry(0.11, 0.15, 6.2, 8));
    const lampGeo = this.trackGeo(new THREE.BoxGeometry(1.3, 0.18, 0.45));
    const glowGeo = this.trackGeo(new THREE.PlaneGeometry(11, 11));
    glowGeo.rotateX(-Math.PI / 2);
    const pillarGeo = this.trackGeo(new THREE.BoxGeometry(0.65, 7.2, 0.65));
    const beamGeo = this.trackGeo(new THREE.BoxGeometry(ROAD_WIDTH + 2.6, 1.15, 0.85));
    const stripGeo = this.trackGeo(new THREE.BoxGeometry(ROAD_WIDTH + 1.2, 0.22, 0.92));
    const bldgGeo = this.trackGeo(new THREE.BoxGeometry(1, 1, 1));

    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunkGroup = new THREE.Group();
      const zBase = (i - 2) * CHUNK_LENGTH;
      chunkGroup.position.z = zBase;

      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.position.y = -0.15;
      chunkGroup.add(ground);

      const road = new THREE.Mesh(roadGeo, roadMat);
      road.position.y = 0.01;
      road.receiveShadow = true;
      chunkGroup.add(road);

      [-ROAD_WIDTH * 0.5 - 0.32, ROAD_WIDTH * 0.5 + 0.32].forEach((x) => {
        const wall = new THREE.Mesh(wallGeo, barrierMat);
        wall.position.set(x, 0.52, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        chunkGroup.add(wall);
      });

      // Streetlights on alternating sides
      [-1, 1].forEach((side) => {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(side * (ROAD_WIDTH * 0.5 + 1.1), 3.1, side > 0 ? 0 : CHUNK_LENGTH * 0.5);
        chunkGroup.add(pole);

        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(side * (ROAD_WIDTH * 0.5 + 0.35), 6.1, pole.position.z);
        chunkGroup.add(lamp);

        const glow = new THREE.Mesh(glowGeo, roadGlowMat);
        glow.position.set(side * (ROAD_WIDTH * 0.5 - 2.6), 0.04, pole.position.z);
        chunkGroup.add(glow);
      });

      // Overhead illuminated expressway gantry every 3rd chunk
      if (i % 3 === 0) {
        [-ROAD_WIDTH * 0.5 - 0.95, ROAD_WIDTH * 0.5 + 0.95].forEach((x) => {
          const p = new THREE.Mesh(pillarGeo, gantryMat);
          p.position.set(x, 3.6, 0);
          chunkGroup.add(p);
        });
        const beam = new THREE.Mesh(beamGeo, gantryMat);
        beam.position.set(0, 7.1, 0);
        chunkGroup.add(beam);

        const strip = new THREE.Mesh(stripGeo, gantryAccentMat);
        strip.position.set(0, 7.1, 0);
        chunkGroup.add(strip);
      }

      // Flanking city skyline towers along both sides of the expressway
      [-1, 1].forEach((side, sIdx) => {
        for (let b = 0; b < 2; b++) {
          const h = 28 + ((i * 19 + b * 23 + sIdx * 11) % 62);
          const w = 14 + ((i * 7 + b * 13) % 12);
          const d = 14 + ((i * 11 + b * 5) % 14);
          const xDist = ROAD_WIDTH * 0.5 + 14 + b * 22 + ((i * 5 + sIdx * 9) % 10);
          const zOff = (b - 0.5) * (CHUNK_LENGTH * 0.5);
          const tower = new THREE.Mesh(
            bldgGeo,
            bldgMats[(i + b + sIdx) % bldgMats.length],
          );
          tower.position.set(side * xDist, h * 0.5 - 0.2, zOff);
          tower.scale.set(w, h, d);
          chunkGroup.add(tower);
        }
      });

      this.chunks.push({ group: chunkGroup, zBase });
      this.group.add(chunkGroup);
    }
  }

  private buildTraffic(textures: ProceduralTextureSet): void {
    const kinds: TrafficVehicleKind[] = ['sedan', 'suv', 'sedan', 'van'];
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = createTrafficVehicleMesh(kind, i, textures.contactShadow);
      this.group.add(mesh.root);
      this.traffic.push({
        mesh,
        lane: i % 4,
        x: HIGHWAY_LANE_CENTERS[i % 4],
        z: 65 + i * 26,
        speedMs: 22 + (i % 5) * 2.8,
        wheelAngle: 0,
        nearMissed: false,
      });
    }
  }

  public reset(startingRun: boolean): void {
    this.playerX = HIGHWAY_LANE_CENTERS[2];
    this.playerZ = 0;
    this.playerVx = 0;
    this.playerSpeed = startingRun ? 24 : 46;
    this.playerHeading = 0;
    this.steerVisual = 0;
    this.wheelSpinAngle = 0;
    this.chassisPitch = 0;
    this.chassisRoll = 0;
    this.braking = false;
    this.drifting = false;

    this.score = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.nearMissCount = 0;
    this.maxCombo = 1;
    this.crashed = false;

    this.chunks.forEach((c, idx) => {
      c.zBase = (idx - 2) * CHUNK_LENGTH;
      c.group.position.z = c.zBase;
    });

    // Place initial traffic cleanly ahead with guaranteed open lanes
    this.traffic.forEach((t, idx) => {
      const wave = Math.floor(idx / 3);
      const laneOffset = (idx + wave) % 4;
      t.lane = laneOffset;
      t.x = HIGHWAY_LANE_CENTERS[laneOffset];
      t.z = 75 + idx * 24 + (idx % 3) * 6;
      t.speedMs = 22 + (idx % 4) * 3.0;
      t.nearMissed = false;
      t.mesh.root.position.set(t.x, 0, t.z);
    });
  }

  private findSafeTrafficSpawn(actor: TrafficActor, minZ: number): void {
    // Pick a random lane and Z ahead that avoids overlapping same-lane cars and avoids 4-lane walls
    const speedEscalation = Math.min(10, (this.playerZ / 1000) * 1.4);
    for (let attempt = 0; attempt < 16; attempt++) {
      const candidateLane = Math.floor(Math.random() * 4);
      const candidateZ = minZ + Math.random() * 140;

      let sameLaneBlocked = false;
      const nearbyOccupiedLanes = new Set<number>();

      for (let i = 0; i < this.traffic.length; i++) {
        const other = this.traffic[i];
        if (other === actor) continue;
        const dz = Math.abs(other.z - candidateZ);
        if (other.lane === candidateLane && dz < 26) {
          sameLaneBlocked = true;
          break;
        }
        if (dz < 14) {
          nearbyOccupiedLanes.add(other.lane);
        }
      }

      if (!sameLaneBlocked && nearbyOccupiedLanes.size < 3) {
        actor.lane = candidateLane;
        actor.x = HIGHWAY_LANE_CENTERS[candidateLane];
        actor.z = candidateZ;
        actor.speedMs = 21 + Math.random() * 12 + speedEscalation;
        actor.nearMissed = false;
        return;
      }
    }

    // Safe fallback far ahead
    actor.lane = (actor.lane + 1) % 4;
    actor.x = HIGHWAY_LANE_CENTERS[actor.lane];
    actor.z = minZ + 180;
    actor.speedMs = 24 + speedEscalation;
    actor.nearMissed = false;
  }

  public computeAttractInput(): InputState {
    // Autopilot weaves cleanly around upcoming traffic in menu preview
    let blockedCenter = false;
    let bestLane = 2;
    let bestClearance = -1;

    for (let lane = 0; lane < 4; lane++) {
      const lx = HIGHWAY_LANE_CENTERS[lane];
      let minDist = 200;
      for (let i = 0; i < this.traffic.length; i++) {
        const t = this.traffic[i];
        const dz = t.z - this.playerZ;
        if (dz > -4 && dz < 110 && Math.abs(t.x - lx) < 2.2) {
          if (dz < minDist) minDist = dz;
        }
      }
      if (Math.abs(lx - this.playerX) < 1.8 && minDist < 42) {
        blockedCenter = true;
      }
      if (minDist > bestClearance) {
        bestClearance = minDist;
        bestLane = lane;
      }
    }

    const targetX = blockedCenter ? HIGHWAY_LANE_CENTERS[bestLane] : this.playerX;
    const dx = targetX - this.playerX;
    return {
      accelerate: this.playerSpeed < 54,
      brake: false,
      steerLeft: dx > 0.35,
      steerRight: dx < -0.35,
      handbrake: false,
    };
  }

  public step(input: InputState, dt: number, isActiveGame: boolean): HighwayStepResult {
    let eventBanner: string | null = null;
    let wallImpact = 0;

    // 1. Player forward speed (always rolls forward at >= 18 m/s during rush)
    const minCruise = isActiveGame ? 18 : 34;
    const topSpeed = 79.0; // ~284 km/h
    this.braking = input.brake || input.handbrake;

    if (input.accelerate && !input.brake) {
      const ratio = Math.max(0, this.playerSpeed / topSpeed);
      this.playerSpeed = Math.min(topSpeed, this.playerSpeed + 28 * (1 - 0.58 * ratio * ratio) * dt);
    } else if (input.brake) {
      this.playerSpeed = Math.max(minCruise, this.playerSpeed - 46 * dt);
    } else {
      // Gentle speed-maintaining drag
      this.playerSpeed = Math.max(minCruise, this.playerSpeed - (this.playerSpeed * 0.18 + 1.2) * dt);
    }

    // 2. Crisp lane-weaving lateral physics (+X = left, -X = right)
    const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
    const maxLatSpeed = 13.5 + Math.min(4.5, this.playerSpeed * 0.06);
    const targetVx = steerInput * maxLatSpeed;
    const responsiveness = input.handbrake ? 14 : 11.5;
    this.playerVx += (targetVx - this.playerVx) * Math.min(1, dt * responsiveness);

    this.playerX += this.playerVx * dt;
    this.playerZ += this.playerSpeed * dt;

    // Barrier clamp with gentle rebound
    if (Math.abs(this.playerX) > BARRIER_LIMIT_X) {
      const sign = Math.sign(this.playerX);
      wallImpact = Math.min(1, Math.abs(this.playerVx) / 11);
      this.playerX = sign * BARRIER_LIMIT_X;
      this.playerVx = -sign * Math.abs(this.playerVx) * 0.35;
      this.playerSpeed = Math.max(minCruise, this.playerSpeed * 0.94);
    }

    // Visual chassis dynamics
    const targetHeading = Math.max(-0.28, Math.min(0.28, (this.playerVx / Math.max(20, this.playerSpeed)) * 1.15));
    this.playerHeading += (targetHeading - this.playerHeading) * Math.min(1, dt * 12);
    this.steerVisual += (steerInput * 0.38 - this.steerVisual) * Math.min(1, dt * 14);
    this.wheelSpinAngle += (this.playerSpeed / 0.36) * dt;
    const targetPitch = this.braking ? 0.036 : input.accelerate ? -0.025 : 0;
    const targetRoll = -steerInput * 0.055;
    this.chassisPitch += (targetPitch - this.chassisPitch) * Math.min(1, dt * 10);
    this.chassisRoll += (targetRoll - this.chassisRoll) * Math.min(1, dt * 10);
    this.drifting = input.handbrake && Math.abs(this.playerVx) > 4.5;

    // 3. Recycle scrolling highway chunks seamlessly ahead of player
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.zBase < this.playerZ - CHUNK_LENGTH * 2.5) {
        c.zBase += TOTAL_SPAN;
        c.group.position.z = c.zBase;
      }
    }

    // 4. Step traffic, check near-misses & collisions
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      t.z += t.speedMs * dt;
      t.wheelAngle += (t.speedMs / 0.32) * dt;

      if (t.z < this.playerZ - 32) {
        this.findSafeTrafficSpawn(t, this.playerZ + 170);
      }

      t.mesh.root.position.set(t.x, 0, t.z);
      for (let w = 0; w < t.mesh.wheels.length; w++) {
        t.mesh.wheels[w].rotation.x = t.wheelAngle;
      }

      if (isActiveGame && !this.crashed) {
        const dx = Math.abs(t.x - this.playerX);
        const dz = Math.abs(t.z - this.playerZ);

        // Hard traffic crash hitbox
        if (dx < 1.82 && dz < 3.92) {
          this.crashed = true;
          this.playerSpeed = 0;
          wallImpact = 1.0;
          break;
        }

        // High-speed near-miss detection
        if (!t.nearMissed && dx < 2.95 && dz < 4.5 && this.playerSpeed > 29) {
          t.nearMissed = true;
          this.nearMissCount += 1;
          this.comboMultiplier = Math.min(10, this.comboMultiplier + 1);
          if (this.comboMultiplier > this.maxCombo) {
            this.maxCombo = this.comboMultiplier;
          }
          this.comboTimer = this.comboDuration;
          const bonus = 250 * this.comboMultiplier;
          this.score += bonus;
          eventBanner = `NEAR MISS! +${bonus} (${this.comboMultiplier}x)`;
        }
      }
    }

    // 5. Continuous speed-scaled score & combo decay
    if (isActiveGame && !this.crashed) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.comboTimer = 0;
          this.comboMultiplier = 1;
        }
      }
      const speedBonusRate = Math.max(0, (this.playerSpeed - 18) * 3.8);
      this.score += speedBonusRate * this.comboMultiplier * dt;
    }

    return {
      score: Math.round(this.score),
      distanceKm: this.playerZ / 1000,
      comboMultiplier: this.comboMultiplier,
      comboTimerRatio: this.comboDuration > 0 ? this.comboTimer / this.comboDuration : 0,
      nearMissCount: this.nearMissCount,
      maxCombo: this.maxCombo,
      wallImpact,
      skidIntensity: this.drifting ? 0.65 : 0,
      crashed: this.crashed,
      eventBanner,
    };
  }

  public dispose(): void {
    this.traffic.forEach((t) => t.mesh.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.localTextures.forEach((t) => t.dispose());
  }
}
