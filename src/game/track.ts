import * as THREE from 'three';
import { buildArchitecturalSkyline, CitySkylinePlacement } from './cityArchitecture';
import { ProceduralTextureSet } from './textures';
import { getTrackLayoutConfig } from './trackLayouts';
import { TrackLayoutId } from './types';

export interface TrackSample {
  index: number;
  t: number;
  distance: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3; // Horizontal right vector (tangent x up)
  normal: THREE.Vector3; // Surface normal
}

export interface TrackProjection {
  sample: TrackSample;
  lateralOffset: number; // + = right of center, - = left of center
  distanceSq: number;
  headingAngle: number;
}

export interface CityCircuit {
  layoutId: TrackLayoutId;
  layoutName: string;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  roadHalfWidth: number;
  barrierHalfWidth: number;
  checkpointDistances: number[];
  group: THREE.Group;
  getClosestSample: (x: number, y: number, z: number, hintIndex?: number) => TrackProjection;
  getSampleAtDistance: (distance: number) => TrackSample;
  getMinimapPath: () => { points: Array<{ x: number; z: number }>; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } };
  dispose: () => void;
}

const SAMPLE_COUNT = 640;
const ROAD_WIDTH = 18;
const ROAD_HALF_WIDTH = ROAD_WIDTH * 0.5;
const BARRIER_HALF_WIDTH = ROAD_HALF_WIDTH + 0.7;

export function createCityCircuit(
  textures: ProceduralTextureSet,
  layoutId: TrackLayoutId = 'metro-loop',
): CityCircuit {
  const layoutConfig = getTrackLayoutConfig(layoutId);
  const curve = new THREE.CatmullRomCurve3(layoutConfig.controlPoints, true, 'centripetal', 0.5);
  const totalLength = curve.getLength();

  const samples: TrackSample[] = [];
  const worldUp = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
    const right = new THREE.Vector3().crossVectors(flatTangent, worldUp).normalize();
    const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();
    samples.push({
      index: i,
      t,
      distance: t * totalLength,
      position,
      tangent,
      right,
      normal,
    });
  }

  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Twilight Sky Dome
  const skyGeo = trackGeo(new THREE.SphereGeometry(680, 32, 20));
  const skyMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.sky,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  group.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Base Urban City-Block Ground Plane (below road level so road never Z-fights)
  const groundGeo = trackGeo(new THREE.PlaneGeometry(1100, 1100));
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.urbanGround,
      roughness: 0.92,
      metalness: 0.08,
    }),
  );
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.18;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // 3. Build Closed-Loop Asphalt Ribbon, Raised Curbs, & Concrete Barriers
  const buildRibbon = (
    halfWidthStart: number,
    halfWidthEnd: number,
    heightOffsetStart: number,
    heightOffsetEnd: number,
    uRepeat: number,
    vScale: number,
    DoubleSided = false,
  ): THREE.BufferGeometry => {
    const pos: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const s = samples[i % SAMPLE_COUNT];
      const v = (i / SAMPLE_COUNT) * totalLength * vScale;

      const pLeft = s.position
        .clone()
        .addScaledVector(s.right, halfWidthStart)
        .addScaledVector(worldUp, heightOffsetStart);
      const pRight = s.position
        .clone()
        .addScaledVector(s.right, halfWidthEnd)
        .addScaledVector(worldUp, heightOffsetEnd);

      pos.push(pLeft.x, pLeft.y, pLeft.z, pRight.x, pRight.y, pRight.z);
      uvs.push(0, v, uRepeat, v);

      if (i < SAMPLE_COUNT) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
        if (DoubleSided) {
          indices.push(a, c, b, b, c, d);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return trackGeo(geo);
  };

  // Main Asphalt Surface with linear roughness map for realistic twilight reflections
  const roadGeo = buildRibbon(-ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.02, 0.02, 1, 0.08, false);
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.asphalt,
      roughnessMap: textures.asphaltRoughness,
      roughness: 0.62,
      metalness: 0.14,
    }),
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Bridge underside deck slab (for realism when driving underneath)
  const deckUnderGeo = buildRibbon(-ROAD_HALF_WIDTH - 1.1, ROAD_HALF_WIDTH + 1.1, -0.55, -0.55, 1, 0.05, true);
  const deckUnderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.15,
    }),
  );
  group.add(new THREE.Mesh(deckUnderGeo, deckUnderMat));

  // Left & Right Curbs
  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.curb,
      roughness: 0.65,
      metalness: 0.05,
    }),
  );
  const leftCurbGeo = buildRibbon(-ROAD_HALF_WIDTH - 0.8, -ROAD_HALF_WIDTH + 0.05, 0.05, 0.03, 1, 0.25);
  const rightCurbGeo = buildRibbon(ROAD_HALF_WIDTH - 0.05, ROAD_HALF_WIDTH + 0.8, 0.03, 0.05, 1, 0.25);
  const leftCurb = new THREE.Mesh(leftCurbGeo, curbMat);
  const rightCurb = new THREE.Mesh(rightCurbGeo, curbMat);
  leftCurb.receiveShadow = true;
  rightCurb.receiveShadow = true;
  group.add(leftCurb, rightCurb);

  // Left & Right Concrete Jersey Barrier Walls (Extruded vertical walls)
  const barrierMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.barrier,
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
  );

  const buildBarrierWall = (sideSign: -1 | 1): THREE.BufferGeometry => {
    const xOffsetInner = sideSign * BARRIER_HALF_WIDTH;
    const xOffsetOuter = sideSign * (BARRIER_HALF_WIDTH + 0.45);
    const wallHeight = 1.05;
    const pos: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const s = samples[i % SAMPLE_COUNT];
      const v = (i / SAMPLE_COUNT) * totalLength * 0.22;

      const b0 = s.position.clone().addScaledVector(s.right, xOffsetInner).addScaledVector(worldUp, -0.5);
      const t0 = s.position.clone().addScaledVector(s.right, xOffsetInner).addScaledVector(worldUp, wallHeight);
      const t1 = s.position.clone().addScaledVector(s.right, xOffsetOuter).addScaledVector(worldUp, wallHeight);
      const b1 = s.position.clone().addScaledVector(s.right, xOffsetOuter).addScaledVector(worldUp, -0.5);

      pos.push(
        b0.x, b0.y, b0.z,
        t0.x, t0.y, t0.z,
        t1.x, t1.y, t1.z,
        b1.x, b1.y, b1.z,
      );
      uvs.push(v, 0, v, 1, v, 0.2, v, 0);

      if (i < SAMPLE_COUNT) {
        const base = i * 4;
        const next = (i + 1) * 4;
        // Inner face
        indices.push(base, base + 1, next, base + 1, next + 1, next);
        // Top cap
        indices.push(base + 1, base + 2, next + 1, base + 2, next + 2, next + 1);
        // Outer face
        indices.push(base + 2, base + 3, next + 2, base + 3, next + 3, next + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return trackGeo(geo);
  };

  const leftWall = new THREE.Mesh(buildBarrierWall(-1), barrierMat);
  const rightWall = new THREE.Mesh(buildBarrierWall(1), barrierMat);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(leftWall, rightWall);

  // 4. Start / Finish Line Strip & Illuminated Gantry
  const startSample = samples[0];
  const sfStripGeo = trackGeo(new THREE.PlaneGeometry(ROAD_WIDTH, 4.2));
  sfStripGeo.rotateX(-Math.PI / 2);
  const sfStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.startFinish,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const sfStrip = new THREE.Mesh(sfStripGeo, sfStripMat);
  sfStrip.position.copy(startSample.position).add(new THREE.Vector3(0, 0.05, 0));
  sfStrip.rotation.y = Math.atan2(startSample.tangent.x, startSample.tangent.z);
  group.add(sfStrip);

  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(startSample.position);
  gantryGroup.rotation.y = Math.atan2(startSample.tangent.x, startSample.tangent.z);

  const gantryPillarMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 }),
  );
  const gantryAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 1.4,
      roughness: 0.25,
    }),
  );

  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.9, 7.6, 0.9));
  [-ROAD_HALF_WIDTH - 1.2, ROAD_HALF_WIDTH + 1.2].forEach((x) => {
    const pillar = new THREE.Mesh(pillarGeo, gantryPillarMat);
    pillar.position.set(x, 3.8, 0);
    pillar.castShadow = true;
    gantryGroup.add(pillar);
  });

  const crossBeamGeo = trackGeo(new THREE.BoxGeometry(ROAD_WIDTH + 3.4, 1.4, 1.1));
  const crossBeam = new THREE.Mesh(crossBeamGeo, gantryPillarMat);
  crossBeam.position.set(0, 7.3, 0);
  crossBeam.castShadow = true;
  gantryGroup.add(crossBeam);

  const lightStripGeo = trackGeo(new THREE.BoxGeometry(ROAD_WIDTH + 1.4, 0.25, 1.18));
  const lightStrip = new THREE.Mesh(lightStripGeo, gantryAccentMat);
  lightStrip.position.set(0, 7.3, 0);
  gantryGroup.add(lightStrip);
  group.add(gantryGroup);

  // 5. Bridge Piers & Conditional Underpass Tunnel Portal Structure
  const pierGeo = trackGeo(new THREE.BoxGeometry(1.6, 7.2, 2.2));
  layoutConfig.pierTValues.forEach((t) => {
    const s = samples[Math.floor(t * SAMPLE_COUNT) % SAMPLE_COUNT];
    if (s.position.y > 2.0) {
      [-ROAD_HALF_WIDTH + 0.5, ROAD_HALF_WIDTH - 0.5].forEach((offset) => {
        const p = s.position.clone().addScaledVector(s.right, offset);
        // On Metro Loop, avoid placing piers inside the lower underpass road around x = 0
        if (!layoutConfig.hasUnderpassTunnel || Math.abs(p.x) > 13) {
          const pier = new THREE.Mesh(pierGeo, gantryPillarMat);
          pier.position.set(p.x, (s.position.y - 0.4) * 0.5, p.z);
          pier.scale.y = (s.position.y + 0.4) / 7.2;
          pier.castShadow = true;
          group.add(pier);
        }
      });
    }
  });

  if (layoutConfig.hasUnderpassTunnel) {
    // Underpass Tunnel Side Walls & LED strips around (0, 0, -24..+24)
    const tunnelWallGeo = trackGeo(new THREE.BoxGeometry(1.4, 5.6, 36));
    const tunnelMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e2532, roughness: 0.75, metalness: 0.2 }),
    );
    [-10.4, 10.4].forEach((x) => {
      const wall = new THREE.Mesh(tunnelWallGeo, tunnelMat);
      wall.position.set(x, 2.8, 0);
      wall.receiveShadow = true;
      group.add(wall);
    });
    const tunnelLedGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.18, 34));
    const tunnelLedMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.8 }),
    );
    [-9.6, 9.6].forEach((x) => {
      const led = new THREE.Mesh(tunnelLedGeo, tunnelLedMat);
      led.position.set(x, 4.6, 0);
      group.add(led);
    });
  }

  // 6. Ordered Checkpoints (6 total: index 0 is finish line, 1..5 around the track)
  const numCheckpoints = 6;
  const checkpointDistances: number[] = [];
  const cpPillarGeo = trackGeo(new THREE.BoxGeometry(0.45, 4.6, 0.45));
  const cpBeamGeo = trackGeo(new THREE.BoxGeometry(ROAD_WIDTH + 2.2, 0.28, 0.35));
  const isDriftTrack = layoutConfig.id === 'drift-touge';
  const cpMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isDriftTrack ? 0xf97316 : 0x38bdf8,
      emissive: isDriftTrack ? 0xea580c : 0x0ea5e9,
      emissiveIntensity: isDriftTrack ? 1.6 : 1.1,
      roughness: 0.3,
    }),
  );

  for (let i = 0; i < numCheckpoints; i++) {
    const dist = (i / numCheckpoints) * totalLength;
    checkpointDistances.push(dist);
    if (i > 0) {
      const s = samples[Math.floor((i / numCheckpoints) * SAMPLE_COUNT) % SAMPLE_COUNT];
      const arch = new THREE.Group();
      arch.position.copy(s.position);
      arch.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);

      [-ROAD_HALF_WIDTH - 1.1, ROAD_HALF_WIDTH + 1.1].forEach((x) => {
        const p = new THREE.Mesh(cpPillarGeo, gantryPillarMat);
        p.position.set(x, 2.3, 0);
        arch.add(p);
      });
      const beam = new THREE.Mesh(cpBeamGeo, cpMat);
      beam.position.set(0, 4.7, 0);
      arch.add(beam);
      group.add(arch);
    }
  }

  // 7. Instanced Streetlights along outer track edge
  const poleCount = 44;
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 6.2, 8));
  const lampHeadGeo = trackGeo(new THREE.BoxGeometry(1.3, 0.18, 0.45));
  const poleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 }),
  );
  const lampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
    }),
  );

  const polesInst = new THREE.InstancedMesh(poleGeo, poleMat, poleCount);
  const lampsInst = new THREE.InstancedMesh(lampHeadGeo, lampMat, poleCount);
  const roadGlowGeo = trackGeo(new THREE.PlaneGeometry(11, 11));
  roadGlowGeo.rotateX(-Math.PI / 2);
  const roadGlowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.glowHalo,
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const roadGlowInst = new THREE.InstancedMesh(roadGlowGeo, roadGlowMat, poleCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < poleCount; i++) {
    const s = samples[Math.floor((i / poleCount) * SAMPLE_COUNT) % SAMPLE_COUNT];
    const side = i % 2 === 0 ? 1 : -1;
    const basePos = s.position.clone().addScaledVector(s.right, side * (BARRIER_HALF_WIDTH + 0.9));
    const yaw = Math.atan2(s.right.x * -side, s.right.z * -side);

    dummy.position.set(basePos.x, basePos.y + 3.1, basePos.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    polesInst.setMatrixAt(i, dummy.matrix);

    const headPos = basePos.clone().addScaledVector(s.right, -side * 0.65);
    dummy.position.set(headPos.x, basePos.y + 6.1, headPos.z);
    dummy.updateMatrix();
    lampsInst.setMatrixAt(i, dummy.matrix);

    const glowPos = basePos.clone().addScaledVector(s.right, -side * 3.8);
    dummy.position.set(glowPos.x, basePos.y + 0.055, glowPos.z);
    dummy.quaternion.setFromUnitVectors(worldUp, s.normal);
    dummy.updateMatrix();
    roadGlowInst.setMatrixAt(i, dummy.matrix);
    dummy.quaternion.identity();
  }
  polesInst.instanceMatrix.needsUpdate = true;
  lampsInst.instanceMatrix.needsUpdate = true;
  roadGlowInst.instanceMatrix.needsUpdate = true;
  polesInst.computeBoundingSphere();
  lampsInst.computeBoundingSphere();
  roadGlowInst.computeBoundingSphere();
  group.add(polesInst, lampsInst, roadGlowInst);

  // 8. Instanced Metropolitan Skyscrapers (guaranteed clear of all track segments!)
  const isClearOfTrack = (x: number, z: number, minDist: number): boolean => {
    const minSq = minDist * minDist;
    for (let i = 0; i < SAMPLE_COUNT; i += 2) {
      const p = samples[i].position;
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz < minSq) return false;
    }
    return true;
  };

  // Deterministic pseudo-random generator for consistent city skyline per layout
  let seed = layoutConfig.skylineSeed;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const placements: CitySkylinePlacement[] = [];
  for (let attempt = 0; attempt < 900 && placements.length < 115; attempt++) {
    const angle = rand() * Math.PI * 2;
    const radius = 35 + rand() * 290;
    const x = Math.cos(angle) * radius * 1.15;
    const z = Math.sin(angle) * radius * 1.15;
    const w = 14 + rand() * 20;
    const d = 14 + rand() * 20;
    const clearance = Math.max(w, d) * 0.72 + ROAD_HALF_WIDTH + 10;

    if (!isClearOfTrack(x, z, clearance)) continue;

    // Avoid overlapping already placed buildings
    let overlaps = false;
    for (let j = 0; j < placements.length; j++) {
      const b = placements[j];
      const distSq = (x - b.x) ** 2 + (z - b.z) ** 2;
      const minB = (Math.max(w, d) + Math.max(b.w, b.d)) * 0.62;
      if (distSq < minB * minB) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    const h = 30 + rand() * 92;
    placements.push({
      x,
      z,
      w,
      h,
      d,
      rot: Math.floor(rand() * 4) * (Math.PI / 2),
      variant: attempt % textures.buildings.length,
      archetype: (placements.length % 4) as 0 | 1 | 2 | 3,
    });
  }

  const cityArch = buildArchitecturalSkyline(
    textures,
    placements,
    samples,
    ROAD_HALF_WIDTH,
    layoutConfig.hasUnderpassTunnel,
    layoutConfig.skylineSeed,
  );
  group.add(cityArch.group);

  // Track query functions
  const getClosestSample = (x: number, y: number, z: number, hintIndex?: number): TrackProjection => {
    let bestSample = samples[0];
    let bestDistSq = Infinity;

    if (hintIndex !== undefined) {
      const windowRadius = 32;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = ((hintIndex + offset) % SAMPLE_COUNT + SAMPLE_COUNT) % SAMPLE_COUNT;
        const s = samples[idx];
        const dx = x - s.position.x;
        const dy = y - s.position.y;
        const dz = z - s.position.z;
        // Weight Y strongly so overpass and underpass never confuse each other
        const distSq = dx * dx + dz * dz + dy * dy * 4.0;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestSample = s;
        }
      }
    }

    // Fallback global search if car jumped or no hint
    if (hintIndex === undefined || bestDistSq > 900) {
      bestDistSq = Infinity;
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const s = samples[i];
        const dx = x - s.position.x;
        const dy = y - s.position.y;
        const dz = z - s.position.z;
        const distSq = dx * dx + dz * dz + dy * dy * 4.0;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestSample = s;
        }
      }
    }

    const relX = x - bestSample.position.x;
    const relZ = z - bestSample.position.z;
    const lateralOffset = relX * bestSample.right.x + relZ * bestSample.right.z;
    const headingAngle = Math.atan2(bestSample.tangent.x, bestSample.tangent.z);

    return {
      sample: bestSample,
      lateralOffset,
      distanceSq: bestDistSq,
      headingAngle,
    };
  };

  const getSampleAtDistance = (distance: number): TrackSample => {
    const wrapped = ((distance % totalLength) + totalLength) % totalLength;
    const idx = Math.floor((wrapped / totalLength) * SAMPLE_COUNT) % SAMPLE_COUNT;
    return samples[idx];
  };

  const getMinimapPath = () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const points: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < SAMPLE_COUNT; i += 4) {
      const p = samples[i].position;
      points.push({ x: p.x, z: p.z });
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    return { points, bounds: { minX, maxX, minZ, maxZ } };
  };

  return {
    layoutId: layoutConfig.id,
    layoutName: layoutConfig.name,
    curve,
    samples,
    totalLength,
    roadHalfWidth: ROAD_HALF_WIDTH,
    barrierHalfWidth: BARRIER_HALF_WIDTH,
    checkpointDistances,
    group,
    getClosestSample,
    getSampleAtDistance,
    getMinimapPath,
    dispose: () => {
      cityArch.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
