import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { TrackSample } from './track';
import { createUrbanTreeAssets, UrbanTreeAssetBundle } from './treeModel';

export interface CitySkylinePlacement {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rot: number;
  variant: number; // 0..3 texture style
  archetype: 0 | 1 | 2 | 3; // 0 = Art-Deco Spire, 1 = Slanted Curtain-Wall, 2 = Plaza + HVAC, 3 = Octagonal
}

export interface CityArchitectureBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

const ACCENT_PALETTE = [
  new THREE.Color(0xf97316), // Nexora Racing Orange
  new THREE.Color(0x38bdf8), // Ice Cyan
  new THREE.Color(0xfbbf24), // Warm Gold
  new THREE.Color(0x34d399), // Mint Emerald
  new THREE.Color(0xe2e8f0), // Cool Architectural White
];

const FACADE_TINTS = [
  new THREE.Color(0xffffff),
  new THREE.Color(0xdbeafe),
  new THREE.Color(0xe2e8f0),
  new THREE.Color(0xfde68a),
  new THREE.Color(0xcbd5e1),
];

function createSlantedRoofGeometry(): THREE.ExtrudeGeometry {
  // Unit-ish wedge profile extruded along Z, then centered on X & Z and bottom at Y = 0
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.5, 0.35);
  shape.lineTo(-0.5, 1.0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  geo.translate(0, 0, -0.5);
  geo.computeVertexNormals();
  return geo;
}

export function buildArchitecturalSkyline(
  textures: ProceduralTextureSet,
  placements: CitySkylinePlacement[],
  samples: TrackSample[],
  roadHalfWidth: number,
  hasUnderpassTunnel: boolean,
  skylineSeed: number,
): CityArchitectureBuildResult {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let treeAssets: UrbanTreeAssetBundle | null = null;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  let seed = skylineSeed ^ 0x5f3759df;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const octGeo = trackGeo(new THREE.CylinderGeometry(0.62, 0.65, 1, 8, 1));
  octGeo.rotateY(Math.PI / 8);
  const spireGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.36, 1, 6));
  const beaconGeo = trackGeo(new THREE.SphereGeometry(0.38, 8, 6));
  const slantRoofGeo = trackGeo(createSlantedRoofGeometry());

  const dummy = new THREE.Object3D();

  // Compute architectural tier heights per placement
  const enriched = placements.map((p, idx) => {
    const podiumH = 6.2 + rand() * 3.2;
    const setbackRatio = p.archetype === 0 ? 0.56 : 0.68;
    const shaftH = p.h * (p.archetype === 2 ? 0.78 : 0.68);
    const setbackH = p.h - shaftH;
    const accentColor = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
    const facadeTint = FACADE_TINTS[(idx * 3 + p.variant) % FACADE_TINTS.length];
    return {
      ...p,
      podiumH,
      shaftH,
      setbackH,
      setbackRatio,
      accentColor,
      facadeTint,
    };
  });

  // 1. Ground-Level Retail & Granite Lobby Podium Bases (all buildings sit grounded)
  const podiumMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.buildingPodium,
      roughness: 0.42,
      metalness: 0.35,
      emissive: 0xffe4b5,
      emissiveMap: textures.buildingPodium,
      emissiveIntensity: 0.32,
    }),
  );
  const rectPodiums = enriched.filter((b) => b.archetype !== 3);
  if (rectPodiums.length > 0) {
    const podInst = new THREE.InstancedMesh(unitBoxGeo, podiumMat, rectPodiums.length);
    rectPodiums.forEach((b, i) => {
      dummy.position.set(b.x, b.podiumH * 0.5 - 0.25, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w * 1.12, b.podiumH + 0.3, b.d * 1.12);
      dummy.updateMatrix();
      podInst.setMatrixAt(i, dummy.matrix);
    });
    podInst.instanceMatrix.needsUpdate = true;
    podInst.computeBoundingSphere();
    group.add(podInst);
  }

  const octBuildings = enriched.filter((b) => b.archetype === 3);
  if (octBuildings.length > 0) {
    const octPodInst = new THREE.InstancedMesh(octGeo, podiumMat, octBuildings.length);
    octBuildings.forEach((b, i) => {
      dummy.position.set(b.x, b.podiumH * 0.5 - 0.25, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w * 1.08, b.podiumH + 0.3, b.d * 1.08);
      dummy.updateMatrix();
      octPodInst.setMatrixAt(i, dummy.matrix);
    });
    octPodInst.instanceMatrix.needsUpdate = true;
    octPodInst.computeBoundingSphere();
    group.add(octPodInst);
  }

  // 2. Main Tower Shafts (4 Architectural Facade Styles + Separate Window-Only Emissive Maps)
  const towerMats = textures.buildings.map((bTex, vIdx) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        map: bTex,
        emissiveMap: textures.buildingEmissives[vIdx],
        emissive: 0xffffff,
        emissiveIntensity: 0.92,
        roughness: vIdx === 0 || vIdx === 2 ? 0.26 : 0.62,
        metalness: vIdx === 0 || vIdx === 2 ? 0.65 : 0.24,
      }),
    ),
  );

  // Rectangular Main Shafts (Archetypes 0, 1, 2)
  for (let vIdx = 0; vIdx < textures.buildings.length; vIdx++) {
    const batch = rectPodiums.filter((b) => b.variant === vIdx);
    if (batch.length === 0) continue;

    const inst = new THREE.InstancedMesh(unitBoxGeo, towerMats[vIdx], batch.length);
    batch.forEach((b, i) => {
      const startY = b.podiumH - 0.3;
      dummy.position.set(b.x, startY + b.shaftH * 0.5, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w, b.shaftH, b.d);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, b.facadeTint);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // Octagonal Main Shafts + Recessed Upper Observation Tier (Archetype 3)
  if (octBuildings.length > 0) {
    const octMainInst = new THREE.InstancedMesh(octGeo, towerMats[0], octBuildings.length);
    const octCrownInst = new THREE.InstancedMesh(octGeo, towerMats[2], octBuildings.length);
    octBuildings.forEach((b, i) => {
      const startY = b.podiumH - 0.3;
      dummy.position.set(b.x, startY + b.shaftH * 0.5, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w * 0.96, b.shaftH, b.d * 0.96);
      dummy.updateMatrix();
      octMainInst.setMatrixAt(i, dummy.matrix);
      octMainInst.setColorAt(i, b.facadeTint);

      const crownY = startY + b.shaftH - 0.2;
      dummy.position.set(b.x, crownY + b.setbackH * 0.5, b.z);
      dummy.scale.set(b.w * 0.72, b.setbackH, b.d * 0.72);
      dummy.updateMatrix();
      octCrownInst.setMatrixAt(i, dummy.matrix);
      octCrownInst.setColorAt(i, b.facadeTint);
    });
    octMainInst.instanceMatrix.needsUpdate = true;
    octCrownInst.instanceMatrix.needsUpdate = true;
    if (octMainInst.instanceColor) octMainInst.instanceColor.needsUpdate = true;
    if (octCrownInst.instanceColor) octCrownInst.instanceColor.needsUpdate = true;
    octMainInst.computeBoundingSphere();
    octCrownInst.computeBoundingSphere();
    group.add(octMainInst, octCrownInst);
  }

  // 3. Upper Setback Tiers (Stepped Crowns for Archetypes 0 & 2)
  const setbackBatch = rectPodiums.filter((b) => b.archetype === 0 || b.archetype === 2);
  if (setbackBatch.length > 0) {
    const setbackInst = new THREE.InstancedMesh(unitBoxGeo, towerMats[1], setbackBatch.length);
    setbackBatch.forEach((b, i) => {
      const topShaft = b.podiumH - 0.3 + b.shaftH;
      dummy.position.set(b.x, topShaft + b.setbackH * 0.5 - 0.2, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w * b.setbackRatio, b.setbackH, b.d * b.setbackRatio);
      dummy.updateMatrix();
      setbackInst.setMatrixAt(i, dummy.matrix);
      setbackInst.setColorAt(i, b.facadeTint);
    });
    setbackInst.instanceMatrix.needsUpdate = true;
    if (setbackInst.instanceColor) setbackInst.instanceColor.needsUpdate = true;
    setbackInst.computeBoundingSphere();
    group.add(setbackInst);
  }

  // 4. Slanted Glass Penthouse Crowns + Structural Corner Exo-Fins (Archetype 1)
  const slantedBatch = rectPodiums.filter((b) => b.archetype === 1);
  const metalTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2a3345,
      roughness: 0.32,
      metalness: 0.85,
    }),
  );
  const slantGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18253a,
      roughness: 0.16,
      metalness: 0.86,
    }),
  );
  if (slantedBatch.length > 0) {
    const slantInst = new THREE.InstancedMesh(slantRoofGeo, slantGlassMat, slantedBatch.length);
    const finInst = new THREE.InstancedMesh(unitBoxGeo, metalTrimMat, slantedBatch.length * 4);
    let finCursor = 0;

    slantedBatch.forEach((b, i) => {
      const topShaft = b.podiumH - 0.3 + b.shaftH;
      const roofH = Math.max(6, b.setbackH * 0.85);
      dummy.position.set(b.x, topShaft - 0.2, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(b.w * 0.96, roofH, b.d * 0.96);
      dummy.updateMatrix();
      slantInst.setMatrixAt(i, dummy.matrix);
      slantInst.setColorAt(i, b.facadeTint);

      // 4 projecting corner exoskeleton mullions along shaft
      const cosR = Math.cos(b.rot);
      const sinR = Math.sin(b.rot);
      const corners = [
        [-b.w * 0.48, -b.d * 0.48],
        [b.w * 0.48, -b.d * 0.48],
        [-b.w * 0.48, b.d * 0.48],
        [b.w * 0.48, b.d * 0.48],
      ];
      corners.forEach(([lx, lz]) => {
        const wx = b.x + lx * cosR + lz * sinR;
        const wz = b.z - lx * sinR + lz * cosR;
        dummy.position.set(wx, b.podiumH - 0.3 + b.shaftH * 0.5, wz);
        dummy.rotation.set(0, b.rot, 0);
        dummy.scale.set(0.7, b.shaftH + 0.5, 0.7);
        dummy.updateMatrix();
        finInst.setMatrixAt(finCursor++, dummy.matrix);
      });
    });
    slantInst.instanceMatrix.needsUpdate = true;
    finInst.instanceMatrix.needsUpdate = true;
    if (slantInst.instanceColor) slantInst.instanceColor.needsUpdate = true;
    slantInst.computeBoundingSphere();
    finInst.computeBoundingSphere();
    group.add(slantInst, finInst);
  }

  // 5. Parapet Cornices & Rooftop Mechanical Penthouse / HVAC Units
  const darkRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161c28,
      roughness: 0.75,
      metalness: 0.35,
    }),
  );
  const parapetInst = new THREE.InstancedMesh(unitBoxGeo, darkRoofMat, enriched.length);
  const hvacBatch = enriched.filter((b) => b.archetype !== 1);
  const hvacInst = new THREE.InstancedMesh(unitBoxGeo, metalTrimMat, Math.max(1, hvacBatch.length));
  let hvacCursor = 0;
  enriched.forEach((b, i) => {
    const crownTop =
      b.archetype === 1
        ? b.podiumH - 0.3 + b.shaftH
        : b.podiumH - 0.3 + b.shaftH + b.setbackH - 0.2;
    const crownW =
      b.archetype === 1 ? b.w * 1.03 : b.archetype === 3 ? b.w * 0.78 : b.w * b.setbackRatio * 1.06;
    const crownD =
      b.archetype === 1 ? b.d * 1.03 : b.archetype === 3 ? b.d * 0.78 : b.d * b.setbackRatio * 1.06;

    dummy.position.set(b.x, crownTop + 0.35, b.z);
    dummy.rotation.set(0, b.rot, 0);
    dummy.scale.set(crownW, 0.85, crownD);
    dummy.updateMatrix();
    parapetInst.setMatrixAt(i, dummy.matrix);

    if (b.archetype !== 1) {
      dummy.position.set(b.x, crownTop + 1.55, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(crownW * 0.44, 2.1, crownD * 0.44);
      dummy.updateMatrix();
      hvacInst.setMatrixAt(hvacCursor++, dummy.matrix);
    }
  });
  parapetInst.instanceMatrix.needsUpdate = true;
  hvacInst.instanceMatrix.needsUpdate = true;
  parapetInst.computeBoundingSphere();
  hvacInst.computeBoundingSphere();
  group.add(parapetInst, hvacInst);

  // 6. Glowing Architectural Crown Fascia Bands & Rooftop Spires with Aviation Beacons
  const neonCrownMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    }),
  );
  const crownStripInst = new THREE.InstancedMesh(unitBoxGeo, neonCrownMat, enriched.length);
  enriched.forEach((b, i) => {
    const stripY =
      b.archetype === 1
        ? b.podiumH - 0.3 + b.shaftH - 0.55
        : b.podiumH - 0.3 + b.shaftH + b.setbackH - 0.9;
    const stripW =
      b.archetype === 1 ? b.w * 1.04 : b.archetype === 3 ? b.w * 0.79 : b.w * b.setbackRatio * 1.07;
    const stripD =
      b.archetype === 1 ? b.d * 1.04 : b.archetype === 3 ? b.d * 0.79 : b.d * b.setbackRatio * 1.07;

    dummy.position.set(b.x, stripY, b.z);
    dummy.rotation.set(0, b.rot, 0);
    dummy.scale.set(stripW, 0.42, stripD);
    dummy.updateMatrix();
    crownStripInst.setMatrixAt(i, dummy.matrix);
    crownStripInst.setColorAt(i, b.accentColor);
  });
  crownStripInst.instanceMatrix.needsUpdate = true;
  if (crownStripInst.instanceColor) crownStripInst.instanceColor.needsUpdate = true;
  crownStripInst.computeBoundingSphere();
  group.add(crownStripInst);

  // Spires & Aviation Beacons on tall towers (Archetypes 0 & 3 or tallest 40%)
  const spireTowers = enriched.filter(
    (b) => b.archetype === 0 || b.archetype === 3 || b.h > 85,
  );
  if (spireTowers.length > 0) {
    const spireInst = new THREE.InstancedMesh(spireGeo, metalTrimMat, spireTowers.length);
    const beaconMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }));
    const beaconInst = new THREE.InstancedMesh(beaconGeo, beaconMat, spireTowers.length);

    spireTowers.forEach((b, i) => {
      const spireH = 11 + (i % 5) * 3.2;
      const baseTop =
        b.archetype === 1
          ? b.podiumH - 0.3 + b.shaftH + Math.max(6, b.setbackH * 0.85) * 0.65
          : b.podiumH - 0.3 + b.shaftH + b.setbackH + 2.1;

      dummy.position.set(b.x, baseTop + spireH * 0.5, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, spireH, 1);
      dummy.updateMatrix();
      spireInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(b.x, baseTop + spireH + 0.25, b.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      beaconInst.setMatrixAt(i, dummy.matrix);
    });
    spireInst.instanceMatrix.needsUpdate = true;
    beaconInst.instanceMatrix.needsUpdate = true;
    spireInst.computeBoundingSphere();
    beaconInst.computeBoundingSphere();
    group.add(spireInst, beaconInst);
  }

  // 7. Street-Level Urban Boulevard Trees in Concrete Planters + Digital Roadside Totems
  const planterCoords: Array<{ x: number; y: number; z: number; yaw: number; scale: number }> = [];
  const totemCoords: Array<{ x: number; y: number; z: number; yaw: number; color: THREE.Color }> = [];
  const sampleCount = samples.length;

  for (let i = 0; i < 48; i++) {
    const s = samples[Math.floor((i / 48) * sampleCount) % sampleCount];
    // Skip elevated bridge sections and the underpass tunnel area
    if (s.position.y > 0.7) continue;
    if (hasUnderpassTunnel && Math.abs(s.position.x) < 16 && Math.abs(s.position.z) < 28) continue;

    const side = i % 2 === 0 ? 1 : -1;
    const distOut = roadHalfWidth + 3.2 + (i % 3) * 0.6;
    const wx = s.position.x + s.right.x * side * distOut;
    const wz = s.position.z + s.right.z * side * distOut;

    // Ensure tree/totem is not intersecting any other road loop segment
    let clearOfOtherRoad = true;
    for (let k = 0; k < sampleCount; k += 8) {
      const other = samples[k].position;
      const dSq = (wx - other.x) ** 2 + (wz - other.z) ** 2;
      if (dSq < (roadHalfWidth + 2.2) ** 2 && Math.abs(other.y - s.position.y) < 2.5) {
        clearOfOtherRoad = false;
        break;
      }
    }
    if (!clearOfOtherRoad) continue;

    const yaw = Math.atan2(s.tangent.x, s.tangent.z);
    if (i % 5 === 0 && totemCoords.length < 10) {
      totemCoords.push({
        x: wx,
        y: s.position.y,
        z: wz,
        yaw,
        color: ACCENT_PALETTE[totemCoords.length % ACCENT_PALETTE.length],
      });
    } else {
      planterCoords.push({
        x: wx,
        y: s.position.y,
        z: wz,
        yaw,
        scale: 0.85 + (i % 4) * 0.14,
      });
    }
  }

  if (planterCoords.length > 0) {
    treeAssets = createUrbanTreeAssets(textures);
    const canopyDepthMat = trackMat(
      new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: textures.treeLeafCluster,
        alphaTest: 0.4,
      }),
    );

    const planterInst = new THREE.InstancedMesh(
      treeAssets.planterGeo,
      treeAssets.planterMat,
      planterCoords.length,
    );
    const soilInst = new THREE.InstancedMesh(
      treeAssets.soilGeo,
      treeAssets.soilMat,
      planterCoords.length,
    );
    planterInst.castShadow = true;
    planterInst.receiveShadow = true;
    soilInst.receiveShadow = true;

    const groupA: Array<{ p: (typeof planterCoords)[number]; idx: number }> = [];
    const groupB: Array<{ p: (typeof planterCoords)[number]; idx: number }> = [];

    planterCoords.forEach((p, idx) => {
      // Precast concrete planter + recessed cast-iron tree grate
      dummy.position.set(p.x, p.y - 0.12, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      planterInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x, p.y + 0.34, p.z);
      dummy.updateMatrix();
      soilInst.setMatrixAt(idx, dummy.matrix);

      if (idx % 2 === 0) groupA.push({ p, idx });
      else groupB.push({ p, idx });
    });

    planterInst.instanceMatrix.needsUpdate = true;
    soilInst.instanceMatrix.needsUpdate = true;
    planterInst.computeBoundingSphere();
    soilInst.computeBoundingSphere();
    group.add(planterInst, soilInst);

    const spawnSpeciesInstances = (
      items: Array<{ p: (typeof planterCoords)[number]; idx: number }>,
      variantIdx: 0 | 1,
    ) => {
      if (items.length === 0 || !treeAssets) return;
      const variant = treeAssets.variants[variantIdx];
      const barkInst = new THREE.InstancedMesh(variant.barkGeo, treeAssets.barkMat, items.length);
      const canopyInst = new THREE.InstancedMesh(
        variant.canopyGeo,
        treeAssets.canopyMat,
        items.length,
      );
      barkInst.castShadow = true;
      barkInst.receiveShadow = true;
      canopyInst.castShadow = true;
      canopyInst.receiveShadow = true;
      canopyInst.customDepthMaterial = canopyDepthMat;

      items.forEach(({ p, idx }, i) => {
        const yaw = p.yaw + idx * 1.37;
        const leanX = Math.sin(idx * 2.1) * 0.035;
        const leanZ = Math.cos(idx * 1.7) * 0.035;
        const s = p.scale;

        dummy.position.set(p.x, p.y - 0.02, p.z);
        dummy.rotation.set(leanX, yaw, leanZ);
        dummy.scale.set(s, s * (0.96 + (idx % 3) * 0.05), s);
        dummy.updateMatrix();

        barkInst.setMatrixAt(i, dummy.matrix);
        canopyInst.setMatrixAt(i, dummy.matrix);
        canopyInst.setColorAt(
          i,
          treeAssets!.leafTintPalette[idx % treeAssets!.leafTintPalette.length],
        );
      });

      barkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
      barkInst.computeBoundingSphere();
      canopyInst.computeBoundingSphere();
      group.add(barkInst, canopyInst);
    };

    spawnSpeciesInstances(groupA, 0);
    spawnSpeciesInstances(groupB, 1);
  }

  if (totemCoords.length > 0) {
    const totemBaseGeo = trackGeo(new THREE.BoxGeometry(0.95, 5.4, 2.2));
    const totemScreenGeo = trackGeo(new THREE.BoxGeometry(1.06, 3.3, 1.85));
    const totemFrameInst = new THREE.InstancedMesh(totemBaseGeo, darkRoofMat, totemCoords.length);
    const totemScreenInst = new THREE.InstancedMesh(totemScreenGeo, neonCrownMat, totemCoords.length);

    totemCoords.forEach((t, idx) => {
      dummy.position.set(t.x, t.y + 2.5, t.z);
      dummy.rotation.set(0, t.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      totemFrameInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(t.x, t.y + 3.25, t.z);
      dummy.updateMatrix();
      totemScreenInst.setMatrixAt(idx, dummy.matrix);
      totemScreenInst.setColorAt(idx, t.color);
    });
    totemFrameInst.instanceMatrix.needsUpdate = true;
    totemScreenInst.instanceMatrix.needsUpdate = true;
    if (totemScreenInst.instanceColor) totemScreenInst.instanceColor.needsUpdate = true;
    totemFrameInst.computeBoundingSphere();
    totemScreenInst.computeBoundingSphere();
    group.add(totemFrameInst, totemScreenInst);
  }

  return {
    group,
    dispose: () => {
      treeAssets?.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
