import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ProceduralTextureSet } from './textures';

export interface UrbanTreeVariant {
  barkGeo: THREE.BufferGeometry;
  canopyGeo: THREE.BufferGeometry;
}

export interface UrbanTreeAssetBundle {
  planterGeo: THREE.BufferGeometry;
  soilGeo: THREE.BufferGeometry;
  planterMat: THREE.MeshStandardMaterial;
  soilMat: THREE.MeshStandardMaterial;
  barkMat: THREE.MeshStandardMaterial;
  canopyMat: THREE.MeshStandardMaterial;
  variants: [UrbanTreeVariant, UrbanTreeVariant];
  leafTintPalette: THREE.Color[];
  dispose: () => void;
}

function mergeNormalizedGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(nonIndexed, false);
  nonIndexed.forEach((g) => g.dispose());
  geos.forEach((g) => g.dispose());
  return merged;
}

/**
 * Generates an organic tapered branch/trunk tube along a 3D Catmull-Rom curve
 * using parallel-transport frames (zero Frenet twisting) and optional root-buttress flare.
 */
function createTaperedBranchGeometry(
  points: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  tubularSegs: number,
  radialSegs: number,
  uvVScale: number,
  flareBase = false,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const prevTan = curve.getTangent(0).normalize();
  const upRef =
    Math.abs(prevTan.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const frameU = new THREE.Vector3().crossVectors(upRef, prevTan).normalize();
  const frameV = new THREE.Vector3().crossVectors(prevTan, frameU).normalize();
  const rotQ = new THREE.Quaternion();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const center = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();

    if (i > 0) {
      rotQ.setFromUnitVectors(prevTan, tan);
      frameU.applyQuaternion(rotQ).normalize();
      frameV.crossVectors(tan, frameU).normalize();
      prevTan.copy(tan);
    }

    // Smooth nonlinear taper + optional 4-lobed root buttress flare near soil line
    const baseRadius = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.78));
    const rootFlare = flareBase && t < 0.24 ? Math.pow(1 - t / 0.24, 2) * 0.44 : 0;

    for (let j = 0; j <= radialSegs; j++) {
      const uFrac = j / radialSegs;
      const theta = uFrac * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Subtle organic bark fluted lobe around root flare
      const lobe = flareBase && t < 0.28 ? 1 + rootFlare * (0.65 + 0.35 * Math.cos(theta * 4 + 0.5)) : 1;
      const rad = baseRadius * lobe;

      const nx = frameU.x * cosT + frameV.x * sinT;
      const ny = frameU.y * cosT + frameV.y * sinT;
      const nz = frameU.z * cosT + frameV.z * sinT;

      positions.push(center.x + nx * rad, center.y + ny * rad, center.z + nz * rad);
      normals.push(nx, ny, nz);
      uvs.push(uFrac, t * uvVScale);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a gently arched botanical leaf-cluster sprig quad (3x3 subdivided)
 * with spherical foliage normal transfer + baked volumetric crown ambient occlusion.
 */
function createCurvedLeafCardGeometry(
  width: number,
  height: number,
  archDepth: number,
  center: THREE.Vector3,
  euler: THREE.Euler,
  crownCenter: THREE.Vector3,
  crownRadius: number,
): THREE.BufferGeometry {
  const segs = 2;
  const geo = new THREE.PlaneGeometry(width, height, segs, segs);
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const normAttr = geo.attributes.normal as THREE.BufferAttribute;

  const q = new THREE.Quaternion().setFromEuler(euler);
  const v = new THREE.Vector3();
  const crownDir = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const colors = new Float32Array(posAttr.count * 3);

  for (let i = 0; i < posAttr.count; i++) {
    const lx = posAttr.getX(i);
    const ly = posAttr.getY(i);

    // Parabolic arch/cup across both axes so card never reads like a rigid flat plane
    const nxFrac = lx / (width * 0.5);
    const nyFrac = ly / (height * 0.5);
    const archZ = -archDepth * (nxFrac * nxFrac * 0.65 + nyFrac * nyFrac * 0.55);

    v.set(lx, ly, archZ).applyQuaternion(q).add(center);
    posAttr.setXYZ(i, v.x, v.y, v.z);

    // Spherical normal transfer: blend outward crown direction + upward sky bias
    crownDir.subVectors(v, crownCenter);
    const distFromCenter = crownDir.length();
    if (distFromCenter > 0.001) {
      crownDir.divideScalar(distFromCenter);
    } else {
      crownDir.set(0, 1, 0);
    }
    crownDir.lerp(upVec, 0.34).normalize();
    normAttr.setXYZ(i, crownDir.x, crownDir.y, crownDir.z);

    // Baked volumetric ambient occlusion: darker deep interior & underside, bright sunward outer tips
    const radialAO = THREE.MathUtils.clamp(distFromCenter / crownRadius, 0.25, 1.12);
    const verticalAO = THREE.MathUtils.clamp((v.y - (crownCenter.y - crownRadius)) / (crownRadius * 2), 0, 1);
    const ao = THREE.MathUtils.clamp(0.42 + radialAO * 0.44 + verticalAO * 0.24, 0.42, 1.08);
    colors[i * 3] = ao * 0.96;
    colors[i * 3 + 1] = ao;
    colors[i * 3 + 2] = ao * 0.94;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildPrecastPlanterGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Lower concrete wall curb
  const baseBody = new THREE.BoxGeometry(2.18, 0.44, 2.18);
  baseBody.translate(0, 0.22, 0);
  geos.push(baseBody);

  // Overhanging chamfered stone coping rim around top edge (4 beveled segments forming a recessed well)
  const rimThickness = 0.24;
  const outer = 2.34;
  const innerOffset = outer * 0.5 - rimThickness * 0.5;
  const rimH = 0.14;
  const rimY = 0.48;

  const frontRim = new THREE.BoxGeometry(outer, rimH, rimThickness);
  frontRim.translate(0, rimY, innerOffset);
  const backRim = new THREE.BoxGeometry(outer, rimH, rimThickness);
  backRim.translate(0, rimY, -innerOffset);
  const leftRim = new THREE.BoxGeometry(rimThickness, rimH, outer - rimThickness * 2);
  leftRim.translate(-innerOffset, rimY, 0);
  const rightRim = new THREE.BoxGeometry(rimThickness, rimH, outer - rimThickness * 2);
  rightRim.translate(innerOffset, rimY, 0);

  geos.push(frontRim, backRim, leftRim, rightRim);
  return mergeNormalizedGeometries(geos);
}

function buildTreeVariant(variantSeed: 0 | 1): UrbanTreeVariant {
  const barkParts: THREE.BufferGeometry[] = [];
  const canopyParts: THREE.BufferGeometry[] = [];

  // Variant 0: Broad Urban Red Oak / Maple Shade Tree
  // Variant 1: Taller Vase-Shaped Boulevard Elm
  const trunkTopY = variantSeed === 0 ? 2.55 : 2.95;
  const leanX = variantSeed === 0 ? 0.09 : -0.08;
  const leanZ = variantSeed === 0 ? -0.06 : 0.08;

  // Main root-flared curved trunk (anchored cleanly inside planter soil at Y = 0.36)
  barkParts.push(
    createTaperedBranchGeometry(
      [
        new THREE.Vector3(0, 0.36, 0),
        new THREE.Vector3(leanX * 0.3, 1.15, leanZ * 0.3),
        new THREE.Vector3(leanX * 0.8, 1.95, leanZ * 0.8),
        new THREE.Vector3(leanX, trunkTopY, leanZ),
      ],
      0.24,
      0.115,
      8,
      9,
      2.2,
      true,
    ),
  );

  interface BoughSpec {
    startFrac: number;
    angle: number;
    reach: number;
    tipY: number;
    subReach: number;
  }

  const boughs: BoughSpec[] =
    variantSeed === 0
      ? [
          { startFrac: 0.72, angle: 0.25, reach: 1.45, tipY: 4.35, subReach: 0.75 },
          { startFrac: 0.78, angle: 1.55, reach: 1.52, tipY: 4.55, subReach: 0.72 },
          { startFrac: 0.84, angle: 2.75, reach: 1.38, tipY: 4.25, subReach: 0.68 },
          { startFrac: 0.88, angle: 4.05, reach: 1.48, tipY: 4.48, subReach: 0.74 },
          { startFrac: 0.94, angle: 5.25, reach: 1.26, tipY: 4.95, subReach: 0.62 },
        ]
      : [
          { startFrac: 0.70, angle: 0.65, reach: 1.25, tipY: 4.95, subReach: 0.68 },
          { startFrac: 0.78, angle: 2.15, reach: 1.32, tipY: 5.15, subReach: 0.70 },
          { startFrac: 0.86, angle: 3.70, reach: 1.28, tipY: 4.88, subReach: 0.66 },
          { startFrac: 0.92, angle: 5.15, reach: 1.18, tipY: 5.32, subReach: 0.64 },
        ];

  const crownCenter = new THREE.Vector3(leanX, variantSeed === 0 ? 4.25 : 4.72, leanZ);
  const crownRadius = variantSeed === 0 ? 2.25 : 2.15;

  // Deterministic pseudo-random for canopy card placement
  let s = variantSeed === 0 ? 4099 : 7919;
  const rng = () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const clusterAnchors: Array<{ pos: THREE.Vector3; radius: number; count: number }> = [];

  boughs.forEach((b, idx) => {
    const startY = THREE.MathUtils.lerp(0.6, trunkTopY, b.startFrac);
    const sx = leanX * b.startFrac;
    const sz = leanZ * b.startFrac;
    const cosA = Math.cos(b.angle);
    const sinA = Math.sin(b.angle);

    const mid = new THREE.Vector3(
      sx + cosA * b.reach * 0.48,
      THREE.MathUtils.lerp(startY, b.tipY, 0.54),
      sz + sinA * b.reach * 0.48,
    );
    const tip = new THREE.Vector3(sx + cosA * b.reach, b.tipY, sz + sinA * b.reach);

    // Primary limb
    barkParts.push(
      createTaperedBranchGeometry(
        [new THREE.Vector3(sx, startY, sz), mid, tip],
        0.088,
        0.028,
        5,
        6,
        1.4,
        false,
      ),
    );
    clusterAnchors.push({ pos: tip.clone(), radius: 0.88, count: 6 });

    // Two secondary forked twigs splitting laterally/upward from each primary bough
    [-0.55, 0.58].forEach((angOffset, subIdx) => {
      const subAng = b.angle + angOffset;
      const subTip = new THREE.Vector3(
        mid.x + Math.cos(subAng) * b.subReach,
        mid.y + 0.62 + subIdx * 0.25,
        mid.z + Math.sin(subAng) * b.subReach,
      );
      barkParts.push(
        createTaperedBranchGeometry(
          [
            mid.clone(),
            mid.clone().lerp(subTip, 0.52).add(new THREE.Vector3(0, 0.12, 0)),
            subTip,
          ],
          0.044,
          0.015,
          3,
          5,
          0.9,
          false,
        ),
      );
      if ((idx + subIdx) % 2 === 0) {
        clusterAnchors.push({ pos: subTip, radius: 0.72, count: 4 });
      }
    });
  });

  // Central leader crown extension + apex cluster
  const apexPos = new THREE.Vector3(leanX, variantSeed === 0 ? 5.15 : 5.75, leanZ);
  barkParts.push(
    createTaperedBranchGeometry(
      [
        new THREE.Vector3(leanX, trunkTopY - 0.15, leanZ),
        new THREE.Vector3(leanX * 1.1, (trunkTopY + apexPos.y) * 0.52, leanZ * 0.9),
        apexPos,
      ],
      0.085,
      0.024,
      4,
      6,
      1.2,
      false,
    ),
  );
  clusterAnchors.push({ pos: apexPos, radius: 0.95, count: 6 });
  clusterAnchors.push({ pos: crownCenter.clone(), radius: 0.85, count: 5 });

  // Populate each limb anchor with crossed, cambered botanical leaf-cluster cards
  clusterAnchors.forEach((anchor) => {
    for (let k = 0; k < anchor.count; k++) {
      const yaw = (k / anchor.count) * Math.PI * 2 + rng() * 0.75;
      const pitch = (rng() - 0.5) * 1.05;
      const roll = (rng() - 0.5) * 0.55;
      const offsetDist = (0.15 + rng() * 0.72) * anchor.radius;
      const offsetVec = new THREE.Vector3(
        Math.cos(yaw) * offsetDist,
        (rng() - 0.42) * anchor.radius * 0.7,
        Math.sin(yaw) * offsetDist,
      );
      const cardCenter = anchor.pos.clone().add(offsetVec);
      const cardW = 1.48 + rng() * 0.52;
      const cardH = 1.38 + rng() * 0.48;

      canopyParts.push(
        createCurvedLeafCardGeometry(
          cardW,
          cardH,
          0.22 + rng() * 0.12,
          cardCenter,
          new THREE.Euler(pitch, yaw, roll),
          crownCenter,
          crownRadius,
        ),
      );
    }
  });

  return {
    barkGeo: mergeNormalizedGeometries(barkParts),
    canopyGeo: mergeNormalizedGeometries(canopyParts),
  };
}

export function createUrbanTreeAssets(textures: ProceduralTextureSet): UrbanTreeAssetBundle {
  const planterGeo = buildPrecastPlanterGeometry();
  const soilGeo = new THREE.PlaneGeometry(1.86, 1.86);
  soilGeo.rotateX(-Math.PI / 2);

  const planterMat = new THREE.MeshStandardMaterial({
    color: 0x3b4557,
    roughness: 0.9,
    metalness: 0.06,
  });

  const soilMat = new THREE.MeshStandardMaterial({
    map: textures.planterSoil,
    roughness: 0.72,
    metalness: 0.34,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: textures.treeBark,
    bumpMap: textures.treeBarkBump,
    bumpScale: 0.08,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.02,
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    map: textures.treeLeafCluster,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.02,
  });

  const variantA = buildTreeVariant(0);
  const variantB = buildTreeVariant(1);

  const leafTintPalette = [
    new THREE.Color(0xd7edd4),
    new THREE.Color(0xc5e3ca),
    new THREE.Color(0xe1ecc9),
    new THREE.Color(0xb8d9bf),
    new THREE.Color(0xd8dfb8),
  ];

  return {
    planterGeo,
    soilGeo,
    planterMat,
    soilMat,
    barkMat,
    canopyMat,
    variants: [variantA, variantB],
    leafTintPalette,
    dispose: () => {
      planterGeo.dispose();
      soilGeo.dispose();
      variantA.barkGeo.dispose();
      variantA.canopyGeo.dispose();
      variantB.barkGeo.dispose();
      variantB.canopyGeo.dispose();
      planterMat.dispose();
      soilMat.dispose();
      barkMat.dispose();
      canopyMat.dispose();
    },
  };
}
