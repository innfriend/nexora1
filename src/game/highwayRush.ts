import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { createTrafficVehicleMesh, TrafficMeshHandles, TrafficVehicleKind } from './trafficModel';
import { EffectiveCarSpecs, InputState } from './types';

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
  oncoming: boolean;
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
  nitroRatio: number;
  nitroActive: boolean;
  oncomingActive: boolean;
  nitroTriggeredNow: boolean;
}

export class HighwayRushWorld {
  public readonly group = new THREE.Group();
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private localTextures: THREE.Texture[] = [];

  private chunks: HighwayChunk[] = [];
  private traffic: TrafficActor[] = [];

  // Player state on expressway (+Z = forward, X = lateral across 4 lanes)
  public playerX = -1.8;
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

  // Nitro state
  public nitroAmount = 100;
  public nitroCapacity = 100;
  public nitroActive = false;
  private wasNitroActive = false;

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

    // 4-lane dashed white dividers + double amber oncoming divider down the center
    ctx.fillStyle = '#CBD5E1';
    for (let y = 24; y < 512; y += 128) {
      ctx.fillRect(136, y, 7, 62);
      ctx.fillRect(369, y, 7, 62);
    }
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(247, 0, 5, 512);
    ctx.fillRect(260, 0, 5, 512);

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
      new THREE.MeshStandardMaterial({
        map: textures.urbanGround,
        roughness: 0.92,
        metalness: 0.08,
      }),
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

    const podiumMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.buildingPodium,
        roughness: 0.42,
        metalness: 0.35,
        emissive: 0xffe4b5,
        emissiveMap: textures.buildingPodium,
        emissiveIntensity: 0.3,
      }),
    );
    const roofCapMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.75, metalness: 0.4 }),
    );
    const metalTrimMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2a3345, roughness: 0.3, metalness: 0.85 }),
    );
    const crownGlowMats = [0xf97316, 0x38bdf8, 0xfbbf24, 0x34d399].map((hex) =>
      this.trackMat(new THREE.MeshBasicMaterial({ color: hex, toneMapped: false })),
    );
    const bldgMats = textures.buildings.map((bTex, vIdx) =>
      this.trackMat(
        new THREE.MeshStandardMaterial({
          map: bTex,
          emissiveMap: textures.buildingEmissives[vIdx],
          emissive: 0xffffff,
          emissiveIntensity: 0.9,
          roughness: vIdx === 0 || vIdx === 2 ? 0.28 : 0.62,
          metalness: vIdx === 0 || vIdx === 2 ? 0.62 : 0.24,
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
    const octBldgGeo = this.trackGeo(new THREE.CylinderGeometry(0.6, 0.64, 1, 8, 1));
    octBldgGeo.rotateY(Math.PI / 8);
    const spireGeo = this.trackGeo(new THREE.CylinderGeometry(0.06, 0.32, 1, 6));

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

      // Flanking composite architectural skyline towers along both sides of the expressway
      [-1, 1].forEach((side, sIdx) => {
        for (let b = 0; b < 2; b++) {
          const h = 32 + ((i * 19 + b * 23 + sIdx * 11) % 64);
          const w = 14 + ((i * 7 + b * 13) % 12);
          const d = 14 + ((i * 11 + b * 5) % 14);
          const xDist = ROAD_WIDTH * 0.5 + 14 + b * 22 + ((i * 5 + sIdx * 9) % 10);
          const zOff = (b - 0.5) * (CHUNK_LENGTH * 0.5);
          const bx = side * xDist;
          const isOct = (i + b + sIdx) % 4 === 3;
          const podiumH = 7.2 + ((i + b) % 3) * 1.1;
          const shaftH = h * 0.66;
          const crownH = h - shaftH;

          // Street-level retail podium base
          const podium = new THREE.Mesh(isOct ? octBldgGeo : bldgGeo, podiumMat);
          podium.position.set(bx, podiumH * 0.5 - 0.2, zOff);
          podium.scale.set(w * 1.12, podiumH, d * 1.12);
          chunkGroup.add(podium);

          // Main tower shaft
          const matIdx = (i + b + sIdx) % bldgMats.length;
          const shaft = new THREE.Mesh(isOct ? octBldgGeo : bldgGeo, bldgMats[matIdx]);
          shaft.position.set(bx, podiumH + shaftH * 0.5 - 0.25, zOff);
          shaft.scale.set(w, shaftH, d);
          chunkGroup.add(shaft);

          // Upper stepped setback crown
          const crownMat = bldgMats[(matIdx + 1) % bldgMats.length];
          const crown = new THREE.Mesh(isOct ? octBldgGeo : bldgGeo, crownMat);
          const crownY = podiumH + shaftH + crownH * 0.5 - 0.3;
          crown.position.set(bx, crownY, zOff);
          crown.scale.set(w * 0.68, crownH, d * 0.68);
          chunkGroup.add(crown);

          // Dark parapet + glowing architectural crown band + rooftop mechanical unit/spire
          const topY = podiumH + shaftH + crownH - 0.3;
          const parapet = new THREE.Mesh(bldgGeo, roofCapMat);
          parapet.position.set(bx, topY + 0.35, zOff);
          parapet.scale.set(w * 0.73, 0.8, d * 0.73);
          chunkGroup.add(parapet);

          const neonBand = new THREE.Mesh(bldgGeo, crownGlowMats[(i + b + sIdx) % crownGlowMats.length]);
          neonBand.position.set(bx, topY - 0.5, zOff);
          neonBand.scale.set(w * 0.74, 0.38, d * 0.74);
          chunkGroup.add(neonBand);

          if (h > 64 || isOct) {
            const spireH = 10 + ((i + sIdx) % 4) * 3;
            const spire = new THREE.Mesh(spireGeo, metalTrimMat);
            spire.position.set(bx, topY + spireH * 0.5 + 0.6, zOff);
            spire.scale.set(1, spireH, 1);
            chunkGroup.add(spire);
          } else {
            const hvac = new THREE.Mesh(bldgGeo, metalTrimMat);
            hvac.position.set(bx, topY + 1.4, zOff);
            hvac.scale.set(w * 0.34, 1.8, d * 0.34);
            chunkGroup.add(hvac);
          }
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
      const lane = i % 4;
      const oncoming = lane >= 2;
      mesh.root.rotation.y = oncoming ? Math.PI : 0;
      this.traffic.push({
        mesh,
        lane,
        x: HIGHWAY_LANE_CENTERS[lane],
        z: 65 + i * 26,
        speedMs: oncoming ? -(16 + (i % 4) * 2.5) : 22 + (i % 5) * 2.8,
        oncoming,
        wheelAngle: 0,
        nearMissed: false,
      });
    }
  }

  public reset(startingRun: boolean, nitroCapacity = 100): void {
    this.playerX = HIGHWAY_LANE_CENTERS[1];
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

    this.nitroCapacity = nitroCapacity;
    this.nitroAmount = nitroCapacity;
    this.nitroActive = false;
    this.wasNitroActive = false;

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
      const oncoming = laneOffset >= 2;
      t.lane = laneOffset;
      t.oncoming = oncoming;
      t.x = HIGHWAY_LANE_CENTERS[laneOffset];
      t.z = (oncoming ? 140 : 75) + idx * 26 + (idx % 3) * 8;
      t.speedMs = oncoming ? -(16 + (idx % 4) * 2.4) : 22 + (idx % 4) * 3.0;
      t.nearMissed = false;
      t.mesh.root.position.set(t.x, 0, t.z);
      t.mesh.root.rotation.y = oncoming ? Math.PI : 0;
    });
  }

  private findSafeTrafficSpawn(actor: TrafficActor, minZ: number): void {
    const speedEscalation = Math.min(10, (this.playerZ / 1000) * 1.4);
    for (let attempt = 0; attempt < 16; attempt++) {
      const candidateLane = Math.floor(Math.random() * 4);
      const oncoming = candidateLane >= 2;
      const candidateZ = minZ + (oncoming ? 65 : 0) + Math.random() * 160;

      let sameLaneBlocked = false;
      const nearbyOccupiedLanes = new Set<number>();

      for (let i = 0; i < this.traffic.length; i++) {
        const other = this.traffic[i];
        if (other === actor) continue;
        const dz = Math.abs(other.z - candidateZ);
        if (other.lane === candidateLane && dz < (oncoming ? 42 : 26)) {
          sameLaneBlocked = true;
          break;
        }
        if (dz < 16) {
          nearbyOccupiedLanes.add(other.lane);
        }
      }

      if (!sameLaneBlocked && nearbyOccupiedLanes.size < 3) {
        actor.lane = candidateLane;
        actor.oncoming = oncoming;
        actor.x = HIGHWAY_LANE_CENTERS[candidateLane];
        actor.z = candidateZ;
        actor.speedMs = oncoming
          ? -(16 + Math.random() * 9 + speedEscalation * 0.5)
          : 21 + Math.random() * 12 + speedEscalation;
        actor.nearMissed = false;
        actor.mesh.root.rotation.y = oncoming ? Math.PI : 0;
        return;
      }
    }

    const fallbackLane = (actor.lane + 1) % 2; // Safe same-direction fallback lane
    actor.lane = fallbackLane;
    actor.oncoming = false;
    actor.x = HIGHWAY_LANE_CENTERS[fallbackLane];
    actor.z = minZ + 185;
    actor.speedMs = 24 + speedEscalation;
    actor.nearMissed = false;
    actor.mesh.root.rotation.y = 0;
  }

  public computeAttractInput(): InputState {
    // Autopilot weaves cleanly along standard forward lanes (0 & 1) in menu preview
    let blockedCenter = false;
    let bestLane = 1;
    let bestClearance = -1;

    for (let lane = 0; lane < 2; lane++) {
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
      nitro: false,
    };
  }

  public step(
    input: InputState,
    dt: number,
    isActiveGame: boolean,
    specs?: EffectiveCarSpecs,
  ): HighwayStepResult {
    let eventBanner: string | null = null;
    let wallImpact = 0;

    // 1. Nitro activation, drain & passive refill on oncoming risk
    const wantNitro = isActiveGame && !this.crashed && input.nitro && !input.brake && this.nitroAmount > 2;
    this.nitroActive = wantNitro;
    const nitroTriggeredNow = this.nitroActive && !this.wasNitroActive;
    this.wasNitroActive = this.nitroActive;

    if (this.nitroActive) {
      this.nitroAmount = Math.max(0, this.nitroAmount - 26 * dt);
    }

    const oncomingActive = isActiveGame && !this.crashed && this.playerX > 0.25;
    if (oncomingActive && !this.nitroActive) {
      this.nitroAmount = Math.min(
        this.nitroCapacity,
        this.nitroAmount + 9.5 * (specs?.nitroRefillMult ?? 1) * dt,
      );
    }

    // 2. Player forward speed scaled by Garage Upgrades + Nitro Boost
    const minCruise = isActiveGame ? 18 : 34;
    const speedMult = isActiveGame && specs ? specs.topSpeedMult : 1.0;
    const accelMult = isActiveGame && specs ? specs.accelMult : 1.0;
    const handlingMult = isActiveGame && specs ? specs.handlingMult : 1.0;
    const nitroBoostMult = this.nitroActive ? 1 + 0.17 * (specs?.nitroPowerMult ?? 1.0) : 1.0;
    const topSpeed = 79.0 * speedMult * nitroBoostMult; // Up to ~340+ km/h with hypercar + nitro
    this.braking = input.brake || input.handbrake;

    if ((input.accelerate || this.nitroActive) && !input.brake) {
      const ratio = Math.max(0, this.playerSpeed / topSpeed);
      const accelBoost = this.nitroActive ? 1.6 : 1.0;
      this.playerSpeed = Math.min(
        topSpeed,
        this.playerSpeed + 28 * accelMult * accelBoost * (1 - 0.58 * ratio * ratio) * dt,
      );
    } else if (input.brake) {
      this.playerSpeed = Math.max(minCruise, this.playerSpeed - 46 * handlingMult * dt);
    } else {
      this.playerSpeed = Math.max(minCruise, this.playerSpeed - (this.playerSpeed * 0.18 + 1.2) * dt);
    }

    // 3. Crisp lane-weaving lateral physics (+X = left, -X = right)
    const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
    const maxLatSpeed = (13.5 + Math.min(4.5, this.playerSpeed * 0.06)) * handlingMult;
    const targetVx = steerInput * maxLatSpeed;
    const responsiveness = (input.handbrake ? 14 : 11.5) * handlingMult;
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
    const targetHeading = Math.max(
      -0.28,
      Math.min(0.28, (this.playerVx / Math.max(20, this.playerSpeed)) * 1.15),
    );
    this.playerHeading += (targetHeading - this.playerHeading) * Math.min(1, dt * 12);
    this.steerVisual += (steerInput * 0.38 - this.steerVisual) * Math.min(1, dt * 14);
    this.wheelSpinAngle += (this.playerSpeed / 0.36) * dt;
    const targetPitch = this.braking
      ? 0.036
      : this.nitroActive
        ? -0.045
        : input.accelerate
          ? -0.025
          : 0;
    const targetRoll = -steerInput * 0.055;
    this.chassisPitch += (targetPitch - this.chassisPitch) * Math.min(1, dt * 10);
    this.chassisRoll += (targetRoll - this.chassisRoll) * Math.min(1, dt * 10);
    this.drifting = input.handbrake && Math.abs(this.playerVx) > 4.5;

    // 4. Recycle scrolling highway chunks seamlessly ahead of player
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (c.zBase < this.playerZ - CHUNK_LENGTH * 2.5) {
        c.zBase += TOTAL_SPAN;
        c.group.position.z = c.zBase;
      }
    }

    // 5. Step traffic, check near-misses & collisions
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      t.z += t.speedMs * dt;
      t.wheelAngle += (Math.abs(t.speedMs) / 0.32) * dt;

      if (t.z < this.playerZ - 32) {
        this.findSafeTrafficSpawn(t, this.playerZ + 175);
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
          this.nitroActive = false;
          wallImpact = 1.0;
          break;
        }

        // High-speed near-miss detection (+ Nitro Refill + Oncoming 2x Bonus!)
        if (!t.nearMissed && dx < 3.05 && dz < 4.7 && this.playerSpeed > 28) {
          t.nearMissed = true;
          this.nearMissCount += 1;
          this.comboMultiplier = Math.min(10, this.comboMultiplier + 1);
          if (this.comboMultiplier > this.maxCombo) {
            this.maxCombo = this.comboMultiplier;
          }
          this.comboTimer = this.comboDuration;
          const oncomingBonus = t.oncoming ? 2 : 1;
          const bonus = 250 * this.comboMultiplier * oncomingBonus;
          this.score += bonus;

          const nitroGain = (t.oncoming ? 34 : 22) * (specs?.nitroRefillMult ?? 1);
          this.nitroAmount = Math.min(this.nitroCapacity, this.nitroAmount + nitroGain);

          eventBanner = t.oncoming
            ? `ONCOMING PASS! +${bonus} (${this.comboMultiplier}x)`
            : `NEAR MISS! +${bonus} (${this.comboMultiplier}x)`;
        }
      }
    }

    // 6. Continuous speed-scaled score (2x in oncoming lanes!) & combo decay
    if (isActiveGame && !this.crashed) {
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.comboTimer = 0;
          this.comboMultiplier = 1;
        }
      }
      const oncomingMult = oncomingActive ? 2 : 1;
      const speedBonusRate = Math.max(0, (this.playerSpeed - 18) * 3.8);
      this.score += speedBonusRate * this.comboMultiplier * oncomingMult * dt;
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
      nitroRatio: this.nitroCapacity > 0 ? Math.max(0, Math.min(1, this.nitroAmount / this.nitroCapacity)) : 0,
      nitroActive: this.nitroActive,
      oncomingActive,
      nitroTriggeredNow,
    };
  }

  public dispose(): void {
    this.traffic.forEach((t) => t.mesh.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.localTextures.forEach((t) => t.dispose());
  }
}
