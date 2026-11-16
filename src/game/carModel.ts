import * as THREE from 'three';

export interface SportsCarMeshHandles {
  root: THREE.Group;
  roadAligned: THREE.Group;
  chassis: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelSpins: THREE.Group[];
  brakeLightMat: THREE.MeshStandardMaterial;
  brakeHaloMat: THREE.MeshBasicMaterial;
  exhaustFlameMat: THREE.MeshBasicMaterial;
  exhaustFlames: THREE.Mesh[];
  paintMat: THREE.MeshPhysicalMaterial;
  dispose: () => void;
}

export interface CarMeshOptions {
  bodyColor: string;
  accentColor: string;
  rimColor: string;
  carNumber?: string;
  contactShadowTexture: THREE.Texture;
  carbonTexture?: THREE.Texture;
  tireTexture?: THREE.Texture;
  brakeRotorTexture?: THREE.Texture;
  grilleTexture?: THREE.Texture;
  headlightBeamTexture?: THREE.Texture;
  glowHaloTexture?: THREE.Texture;
  showHeadlightBeams?: boolean;
}

interface BodyStation {
  z: number;
  yFloor: number;
  yWaist: number;
  yShoulder: number;
  yCenter: number;
  wBottom: number;
  wWaist: number;
  wShoulder: number;
}

function createLoftedGtBody(stations: BodyStation[]): THREE.BufferGeometry {
  const ringPts = 12; // 0..11 around closed cross-section
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const yMidTop = (s.yShoulder + s.yCenter) * 0.5 + 0.025;
    const xMidTop = s.wShoulder * 0.54;
    const yBevel = s.yFloor + Math.min(0.085, (s.yWaist - s.yFloor) * 0.38);

    // Order: -X bottom -> up -X side -> across top +Y -> down +X side -> +X bottom -> center bottom
    // Guaranteed outward normals when connected with (v00, v01, v10), (v01, v11, v10)
    const section: Array<[number, number]> = [
      [-s.wBottom, s.yFloor],
      [-s.wWaist * 0.97, yBevel],
      [-s.wWaist, s.yWaist],
      [-s.wShoulder, s.yShoulder],
      [-xMidTop, yMidTop],
      [0, s.yCenter],
      [xMidTop, yMidTop],
      [s.wShoulder, s.yShoulder],
      [s.wWaist, s.yWaist],
      [s.wWaist * 0.97, yBevel],
      [s.wBottom, s.yFloor],
      [0, s.yFloor],
    ];

    const vCoord = (s.z + 2.35) / 4.7;
    for (let j = 0; j < ringPts; j++) {
      const [px, py] = section[j];
      positions.push(px, py, s.z);
      uvs.push(px / 2.2 + 0.5, vCoord);
    }
  }

  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < ringPts; j++) {
      const nextJ = (j + 1) % ringPts;
      const v00 = i * ringPts + j;
      const v01 = i * ringPts + nextJ;
      const v10 = (i + 1) * ringPts + j;
      const v11 = (i + 1) * ringPts + nextJ;
      indices.push(v00, v01, v10, v01, v11, v10);
    }
  }

  // Nose cap (+Z outward)
  const noseCenterIdx = positions.length / 3;
  const f = stations[0];
  positions.push(0, (f.yFloor + f.yCenter) * 0.5, f.z + 0.02);
  uvs.push(0.5, 1.0);
  for (let j = 0; j < ringPts; j++) {
    const nextJ = (j + 1) % ringPts;
    indices.push(noseCenterIdx, nextJ, j);
  }

  // Rear tail cap (-Z outward)
  const lastBase = (stations.length - 1) * ringPts;
  const tailCenterIdx = positions.length / 3;
  const r = stations[stations.length - 1];
  positions.push(0, (r.yFloor + r.yCenter) * 0.5, r.z - 0.015);
  uvs.push(0.5, 0.0);
  for (let j = 0; j < ringPts; j++) {
    const nextJ = (j + 1) % ringPts;
    indices.push(tailCenterIdx, lastBase + j, lastBase + nextJ);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createLoftedCanopy(): THREE.BufferGeometry {
  const stations = [
    { z: 0.96, yBase: 0.72, ySide: 0.75, yTop: 0.77, wBase: 0.68, wTop: 0.52 },
    { z: 0.68, yBase: 0.73, ySide: 0.89, yTop: 0.94, wBase: 0.69, wTop: 0.51 },
    { z: 0.36, yBase: 0.74, ySide: 1.06, yTop: 1.15, wBase: 0.68, wTop: 0.48 },
    { z: 0.02, yBase: 0.74, ySide: 1.13, yTop: 1.22, wBase: 0.67, wTop: 0.47 },
    { z: -0.46, yBase: 0.75, ySide: 1.10, yTop: 1.19, wBase: 0.65, wTop: 0.45 },
    { z: -0.98, yBase: 0.77, ySide: 0.98, yTop: 1.05, wBase: 0.61, wTop: 0.40 },
    { z: -1.48, yBase: 0.79, ySide: 0.86, yTop: 0.91, wBase: 0.54, wTop: 0.34 },
  ];

  const ringPts = 8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const section: Array<[number, number]> = [
      [-s.wBase, s.yBase],
      [-s.wTop, s.ySide],
      [-s.wTop * 0.55, s.yTop - 0.01],
      [0, s.yTop],
      [s.wTop * 0.55, s.yTop - 0.01],
      [s.wTop, s.ySide],
      [s.wBase, s.yBase],
      [0, s.yBase],
    ];
    const vCoord = i / (stations.length - 1);
    for (let j = 0; j < ringPts; j++) {
      const [px, py] = section[j];
      positions.push(px, py, s.z);
      uvs.push(j / ringPts, vCoord);
    }
  }

  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < ringPts; j++) {
      const nextJ = (j + 1) % ringPts;
      const v00 = i * ringPts + j;
      const v01 = i * ringPts + nextJ;
      const v10 = (i + 1) * ringPts + j;
      const v11 = (i + 1) * ringPts + nextJ;
      indices.push(v00, v01, v10, v01, v11, v10);
    }
  }

  const frontC = positions.length / 3;
  positions.push(0, 0.74, 0.97);
  uvs.push(0.5, 0);
  for (let j = 0; j < ringPts; j++) {
    indices.push(frontC, (j + 1) % ringPts, j);
  }

  const lastBase = (stations.length - 1) * ringPts;
  const backC = positions.length / 3;
  positions.push(0, 0.85, -1.49);
  uvs.push(0.5, 1);
  for (let j = 0; j < ringPts; j++) {
    indices.push(backC, lastBase + j, lastBase + ((j + 1) % ringPts));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRaceNumberTexture(carNumber: string, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  // Motorsport number plate backdrop with diagonal slash
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 256, 192);

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 256, 38);
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 38, 256, 8);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEXORA GT3', 128, 20);

  ctx.fillStyle = '#090B10';
  ctx.font = '900 112px sans-serif';
  ctx.fillText(carNumber, 128, 122);

  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 184);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWindshieldBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090B10';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#F97316';
  ctx.fillRect(0, 56, 512, 8);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEXORA MOTORSPORT', 256, 30);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * High-Definition GT3 Endurance Racing Car (Nexora GT3-R)
 * Sculpted lofted Coke-bottle monocoque, flared widebody wheel arches, tinted aerodynamic
 * canopy with visible bucket seats + roll cage + steering wheel, front carbon splitter with
 * tie-rods & dive-plane canards, quad-projector endurance headlights, cambered dual-plane
 * swan-neck GT3 rear wing, 6-fin diffuser + FIA rain light, racing number plates,
 * semi-slick tires, 12-spoke forged center-lock rims, and cross-drilled brake rotors.
 * Local orientation: +Z = forward, +Y = up, +X = left, -X = right.
 */
export function createSportsCarMesh(options: CarMeshOptions): SportsCarMeshHandles {
  const root = new THREE.Group();
  const roadAligned = new THREE.Group();
  root.add(roadAligned);
  const chassis = new THREE.Group();
  roadAligned.add(chassis);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const localTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    localTextures.push(t);
    return t;
  };

  // Calibrated Automotive & Motorsport PBR Materials
  const paintMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(options.bodyColor),
      metalness: 0.74,
      roughness: 0.17,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.96,
    }),
  );

  const stripeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.2,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    }),
  );

  const accentTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.35,
      roughness: 0.28,
    }),
  );

  const carbonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(options.accentColor).lerp(new THREE.Color('#141820'), 0.55),
      map: options.carbonTexture ?? null,
      metalness: 0.28,
      roughness: 0.36,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
    }),
  );

  const darkTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x090b10,
      metalness: 0.2,
      roughness: 0.78,
    }),
  );

  const grilleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e2532,
      map: options.grilleTexture ?? null,
      metalness: 0.4,
      roughness: 0.65,
    }),
  );

  const alloyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0.92,
      roughness: 0.2,
    }),
  );

  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x050a14,
      metalness: 0.12,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      opacity: 0.78,
      transparent: true,
    }),
  );

  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: options.tireTexture ? 0xffffff : 0x15181f,
      map: options.tireTexture ?? null,
      metalness: 0.05,
      roughness: 0.88,
    }),
  );

  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.rimColor),
      metalness: 0.94,
      roughness: 0.15,
    }),
  );

  const centerLockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xea580c,
      metalness: 0.72,
      roughness: 0.22,
    }),
  );

  const discMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: options.brakeRotorTexture ? 0xffffff : 0x94a3b8,
      map: options.brakeRotorTexture ?? null,
      metalness: 0.85,
      roughness: 0.32,
    }),
  );

  const caliperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.45,
      roughness: 0.26,
    }),
  );

  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 3.4,
      roughness: 0.08,
    }),
  );

  const enduranceAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 2.6,
      roughness: 0.1,
    }),
  );

  const brakeLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 1.1,
      roughness: 0.14,
    }),
  );

  const rainLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xef4444,
      emissiveIntensity: 2.4,
      roughness: 0.18,
    }),
  );

  const towHookMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.35,
      roughness: 0.35,
    }),
  );

  const exhaustMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.96,
      roughness: 0.16,
    }),
  );

  // 1. Sculpted Lofted GT3 Monocoque Body Shell (Coke-bottle waist + sloped nose + ducktail)
  const bodyStations: BodyStation[] = [
    { z: 2.30, yFloor: 0.24, yWaist: 0.34, yShoulder: 0.41, yCenter: 0.39, wBottom: 0.62, wWaist: 0.66, wShoulder: 0.56 },
    { z: 2.12, yFloor: 0.22, yWaist: 0.44, yShoulder: 0.54, yCenter: 0.51, wBottom: 0.70, wWaist: 0.73, wShoulder: 0.66 },
    { z: 1.82, yFloor: 0.20, yWaist: 0.52, yShoulder: 0.66, yCenter: 0.60, wBottom: 0.72, wWaist: 0.74, wShoulder: 0.69 },
    { z: 1.42, yFloor: 0.20, yWaist: 0.56, yShoulder: 0.73, yCenter: 0.67, wBottom: 0.70, wWaist: 0.72, wShoulder: 0.68 },
    { z: 1.02, yFloor: 0.20, yWaist: 0.58, yShoulder: 0.75, yCenter: 0.73, wBottom: 0.76, wWaist: 0.82, wShoulder: 0.74 },
    { z: 0.62, yFloor: 0.20, yWaist: 0.59, yShoulder: 0.75, yCenter: 0.75, wBottom: 0.88, wWaist: 0.94, wShoulder: 0.80 },
    { z: 0.10, yFloor: 0.20, yWaist: 0.59, yShoulder: 0.75, yCenter: 0.75, wBottom: 0.87, wWaist: 0.93, wShoulder: 0.78 },
    { z: -0.45, yFloor: 0.20, yWaist: 0.60, yShoulder: 0.77, yCenter: 0.76, wBottom: 0.89, wWaist: 0.95, wShoulder: 0.81 },
    { z: -0.92, yFloor: 0.20, yWaist: 0.62, yShoulder: 0.81, yCenter: 0.79, wBottom: 0.74, wWaist: 0.78, wShoulder: 0.76 },
    { z: -1.38, yFloor: 0.21, yWaist: 0.65, yShoulder: 0.86, yCenter: 0.82, wBottom: 0.72, wWaist: 0.75, wShoulder: 0.74 },
    { z: -1.86, yFloor: 0.23, yWaist: 0.66, yShoulder: 0.87, yCenter: 0.85, wBottom: 0.82, wWaist: 0.88, wShoulder: 0.82 },
    { z: -2.24, yFloor: 0.28, yWaist: 0.64, yShoulder: 0.89, yCenter: 0.88, wBottom: 0.78, wWaist: 0.84, wShoulder: 0.78 },
  ];

  const bodyGeo = trackGeo(createLoftedGtBody(bodyStations));
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassis.add(bodyMesh);

  // 2. Flared Widebody Wheel Arches + Recessed Dark Arch Tubs
  const archTubGeo = trackGeo(
    new THREE.CylinderGeometry(0.45, 0.45, 0.36, 18, 1, false, 0, Math.PI),
  );
  archTubGeo.rotateZ(Math.PI / 2);

  const flareGeo = trackGeo(new THREE.TorusGeometry(0.47, 0.08, 10, 20, Math.PI * 1.08));
  flareGeo.rotateY(Math.PI / 2);
  flareGeo.rotateX(-Math.PI * 0.04);

  const wheelArchConfigs = [
    { x: 0.88, z: 1.42, scaleX: 1.35 },
    { x: -0.88, z: 1.42, scaleX: 1.35 },
    { x: 0.90, z: -1.38, scaleX: 1.48 },
    { x: -0.90, z: -1.38, scaleX: 1.48 },
  ];

  wheelArchConfigs.forEach((cfg) => {
    const tub = new THREE.Mesh(archTubGeo, darkTrimMat);
    tub.position.set(cfg.x > 0 ? cfg.x - 0.05 : cfg.x + 0.05, 0.36, cfg.z);
    chassis.add(tub);

    const flare = new THREE.Mesh(flareGeo, paintMat);
    flare.position.set(cfg.x, 0.36, cfg.z);
    flare.scale.set(cfg.scaleX, 1, 1);
    flare.castShadow = true;
    flare.receiveShadow = true;
    chassis.add(flare);
  });

  // 3. Racing Livery Stripes & Number Plates (unaffected by paint recolor)
  const hoodStripeGeo = trackGeo(new THREE.BoxGeometry(0.13, 0.015, 1.12));
  [-0.12, 0.12].forEach((xPos) => {
    const hStripe = new THREE.Mesh(hoodStripeGeo, stripeMat);
    hStripe.position.set(xPos, 0.635, 1.56);
    hStripe.rotation.x = 0.195;
    chassis.add(hStripe);
  });

  const deckStripeGeo = trackGeo(new THREE.BoxGeometry(0.13, 0.015, 0.72));
  [-0.12, 0.12].forEach((xPos) => {
    const dStripe = new THREE.Mesh(deckStripeGeo, stripeMat);
    dStripe.position.set(xPos, 0.868, -1.86);
    dStripe.rotation.x = -0.07;
    chassis.add(dStripe);
  });

  // Door & Hood Racing Number Plates
  const carNumber = options.carNumber ?? '07';
  const numTex = trackTex(createRaceNumberTexture(carNumber, options.accentColor));
  const numPlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: numTex,
      roughness: 0.35,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const doorPlateGeo = trackGeo(new THREE.PlaneGeometry(0.58, 0.40));
  [-1, 1].forEach((side) => {
    const plate = new THREE.Mesh(doorPlateGeo, numPlateMat);
    plate.position.set(side * 0.945, 0.54, -0.08);
    plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    chassis.add(plate);
  });

  const hoodPlateGeo = trackGeo(new THREE.PlaneGeometry(0.48, 0.36));
  hoodPlateGeo.rotateX(-Math.PI / 2);
  const hoodPlate = new THREE.Mesh(hoodPlateGeo, numPlateMat);
  hoodPlate.position.set(0, 0.605, 1.84);
  hoodPlate.rotation.x = 0.22;
  chassis.add(hoodPlate);

  // 4. Aerodynamic Wraparound Race Canopy + Cockpit Roll Cage + Racing Seats + Roof Scoop
  const canopyGeo = trackGeo(createLoftedCanopy());
  const canopyMesh = new THREE.Mesh(canopyGeo, glassMat);
  canopyMesh.castShadow = true;
  chassis.add(canopyMesh);

  // Windshield Motorsport Sun-Strip Banner
  const bannerTex = trackTex(createWindshieldBannerTexture());
  const bannerMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: bannerTex,
    }),
  );
  const sunStripGeo = trackGeo(new THREE.PlaneGeometry(0.88, 0.12));
  const sunStrip = new THREE.Mesh(sunStripGeo, bannerMat);
  sunStrip.position.set(0, 1.115, 0.42);
  sunStrip.rotation.x = -0.98;
  chassis.add(sunStrip);

  // Visible Interior: Racing Bucket Seats, Roll Cage Hoop, Steering Wheel & Digital Dash
  const seatBackGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.38, 0.11));
  const headrestGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.14, 0.10));
  [-0.27, 0.27].forEach((xPos) => {
    const seat = new THREE.Mesh(seatBackGeo, darkTrimMat);
    seat.position.set(xPos, 0.90, -0.20);
    seat.rotation.x = -0.22;
    chassis.add(seat);

    const bolster = new THREE.Mesh(headrestGeo, accentTrimMat);
    bolster.position.set(xPos, 1.07, -0.24);
    bolster.rotation.x = -0.22;
    chassis.add(bolster);
  });

  // Tubular Steel Roll Cage Hoop
  const cageHoopGeo = trackGeo(new THREE.TorusGeometry(0.38, 0.024, 8, 16, Math.PI));
  const cageHoop = new THREE.Mesh(cageHoopGeo, alloyMat);
  cageHoop.position.set(0, 0.78, -0.32);
  chassis.add(cageHoop);

  const cageBraceGeo = trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.78, 8));
  const cageBrace = new THREE.Mesh(cageBraceGeo, alloyMat);
  cageBrace.position.set(0, 0.96, -0.32);
  cageBrace.rotation.z = 0.86;
  chassis.add(cageBrace);

  // Steering Wheel + Glowing Telemetry Dash (Left-side driver position)
  const wheelRimGeo = trackGeo(new THREE.TorusGeometry(0.11, 0.018, 6, 14));
  const steeringWheel = new THREE.Mesh(wheelRimGeo, carbonMat);
  steeringWheel.position.set(0.27, 0.87, 0.25);
  steeringWheel.rotation.x = -0.35;
  chassis.add(steeringWheel);

  const dashScreenGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.08, 0.03));
  const dashMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  const dashScreen = new THREE.Mesh(dashScreenGeo, dashMat);
  dashScreen.position.set(0.27, 0.89, 0.34);
  dashScreen.rotation.x = -0.45;
  chassis.add(dashScreen);

  // Carbon Roof Skin + Roof Air Scoop + Dorsal Shark Fin
  const roofGeo = trackGeo(new THREE.BoxGeometry(0.88, 0.04, 0.84));
  const roofMesh = new THREE.Mesh(roofGeo, carbonMat);
  roofMesh.position.set(0, 1.215, -0.14);
  chassis.add(roofMesh);

  const scoopShape = new THREE.Shape();
  scoopShape.moveTo(-0.55, 0);
  scoopShape.lineTo(0.28, 0);
  scoopShape.lineTo(0.22, 0.11);
  scoopShape.lineTo(-0.55, 0.03);
  scoopShape.closePath();
  const scoopGeo = trackGeo(
    new THREE.ExtrudeGeometry(scoopShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    }),
  );
  scoopGeo.translate(0, 0, -0.11);
  scoopGeo.rotateY(-Math.PI / 2);
  const scoopMesh = new THREE.Mesh(scoopGeo, carbonMat);
  scoopMesh.position.set(0, 1.22, -0.10);
  chassis.add(scoopMesh);

  const sharkFinShape = new THREE.Shape();
  sharkFinShape.moveTo(-1.02, 0);
  sharkFinShape.lineTo(0, 0.18);
  sharkFinShape.lineTo(0, 0);
  sharkFinShape.closePath();
  const sharkFinGeo = trackGeo(
    new THREE.ExtrudeGeometry(sharkFinShape, { depth: 0.025, bevelEnabled: false }),
  );
  sharkFinGeo.translate(0, 0, -0.0125);
  sharkFinGeo.rotateY(-Math.PI / 2);
  const sharkFin = new THREE.Mesh(sharkFinGeo, carbonMat);
  sharkFin.position.set(0, 0.90, -0.78);
  chassis.add(sharkFin);

  // 5. Aerodynamic Twin-Stalk GT Wing Mirrors
  const mirrorStalkGeo = trackGeo(new THREE.BoxGeometry(0.20, 0.03, 0.045));
  const mirrorCapGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.085, 0.13));
  [-1, 1].forEach((side) => {
    const stalk = new THREE.Mesh(mirrorStalkGeo, carbonMat);
    stalk.position.set(side * 0.82, 0.82, 0.56);
    stalk.rotation.z = side * 0.22;
    chassis.add(stalk);

    const cap = new THREE.Mesh(mirrorCapGeo, paintMat);
    cap.position.set(side * 0.93, 0.86, 0.54);
    cap.rotation.y = side * -0.22;
    chassis.add(cap);
  });

  // 6. GT3 Front Aero Kit: Carbon Splitter, Tie-Rods, Dive Canards, Honeycomb Intake & Tow Hook
  const splitterShape = new THREE.Shape();
  splitterShape.moveTo(-0.98, 0);
  splitterShape.lineTo(0.98, 0);
  splitterShape.lineTo(0.86, 0.36);
  splitterShape.lineTo(0.45, 0.44);
  splitterShape.lineTo(-0.45, 0.44);
  splitterShape.lineTo(-0.86, 0.36);
  splitterShape.closePath();
  const splitterGeo = trackGeo(
    new THREE.ExtrudeGeometry(splitterShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
  );
  splitterGeo.rotateX(Math.PI / 2);
  const splitterMesh = new THREE.Mesh(splitterGeo, carbonMat);
  splitterMesh.position.set(0, 0.21, 2.02);
  chassis.add(splitterMesh);

  // Splitter Endplate Winglets & Brushed Alloy Tie-Rods
  const wingletGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.16, 0.32));
  const tieRodGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 8));
  [-0.96, 0.96].forEach((xPos) => {
    const w = new THREE.Mesh(wingletGeo, carbonMat);
    w.position.set(xPos, 0.25, 2.15);
    chassis.add(w);
  });
  [-0.36, 0.36].forEach((xPos) => {
    const rod = new THREE.Mesh(tieRodGeo, alloyMat);
    rod.position.set(xPos, 0.27, 2.34);
    rod.rotation.x = 0.45;
    chassis.add(rod);
  });

  // Stacked Carbon Front Bumper Dive-Plane Canards
  const canardGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.02, 0.24));
  [-1, 1].forEach((side) => {
    [0.34, 0.44].forEach((yPos, idx) => {
      const canard = new THREE.Mesh(canardGeo, carbonMat);
      canard.position.set(side * (0.76 - idx * 0.02), yPos, 2.04 - idx * 0.05);
      canard.rotation.z = side * -0.28;
      canard.rotation.y = side * 0.25;
      chassis.add(canard);
    });
  });

  // Recessed Honeycomb Front Radiator Grille + Brake Ducts + Front Tow Hook
  const grilleGeo = trackGeo(new THREE.BoxGeometry(1.06, 0.17, 0.10));
  const grille = new THREE.Mesh(grilleGeo, grilleMat);
  grille.position.set(0, 0.30, 2.27);
  chassis.add(grille);

  const brakeDuctGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.10));
  [-0.64, 0.64].forEach((xPos) => {
    const duct = new THREE.Mesh(brakeDuctGeo, grilleMat);
    duct.position.set(xPos, 0.31, 2.19);
    duct.rotation.y = xPos > 0 ? 0.28 : -0.28;
    chassis.add(duct);
  });

  const towRingGeo = trackGeo(new THREE.TorusGeometry(0.055, 0.015, 6, 12));
  towRingGeo.rotateX(Math.PI / 2);
  const frontTow = new THREE.Mesh(towRingGeo, towHookMat);
  frontTow.position.set(0.32, 0.22, 2.41);
  chassis.add(frontTow);

  // Hood Aero Louvers (Slatted Heat Extractors behind hood number plate)
  const louverFrameGeo = trackGeo(new THREE.BoxGeometry(0.66, 0.025, 0.44));
  const louverFrame = new THREE.Mesh(louverFrameGeo, grilleMat);
  louverFrame.position.set(0, 0.692, 1.30);
  louverFrame.rotation.x = 0.162;
  chassis.add(louverFrame);

  const slatGeo = trackGeo(new THREE.BoxGeometry(0.60, 0.022, 0.036));
  for (let s = 0; s < 4; s++) {
    const slat = new THREE.Mesh(slatGeo, carbonMat);
    slat.position.set(0, 0.676 + s * 0.017, 1.44 - s * 0.095);
    slat.rotation.x = 0.42;
    chassis.add(slat);
  }

  // Side Carbon Skirts + Side Brake Intake Scoops
  const skirtGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.065, 2.12));
  const sideBladeGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.32, 0.24));
  [-0.95, 0.95].forEach((xPos) => {
    const skirt = new THREE.Mesh(skirtGeo, carbonMat);
    skirt.position.set(xPos, 0.20, 0.02);
    chassis.add(skirt);

    const blade = new THREE.Mesh(sideBladeGeo, carbonMat);
    blade.position.set(xPos > 0 ? 0.94 : -0.94, 0.50, -0.58);
    blade.rotation.x = 0.25;
    chassis.add(blade);
  });

  // 7. Cambered Dual-Plane Swan-Neck Carbon GT3 Rear Wing
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.18, 0.01);
  wingShape.quadraticCurveTo(0.02, 0.038, -0.18, 0.045);
  wingShape.lineTo(-0.18, 0.02);
  wingShape.quadraticCurveTo(0.02, 0.006, 0.18, -0.012);
  wingShape.closePath();

  const mainWingGeo = trackGeo(
    new THREE.ExtrudeGeometry(wingShape, { depth: 1.92, bevelEnabled: false }),
  );
  mainWingGeo.translate(0, 0, -0.96);
  mainWingGeo.rotateY(-Math.PI / 2);
  const mainWing = new THREE.Mesh(mainWingGeo, carbonMat);
  mainWing.position.set(0, 1.18, -2.08);
  mainWing.castShadow = true;
  chassis.add(mainWing);

  // Upper Gurney Flap Element
  const flapGeo = trackGeo(new THREE.BoxGeometry(1.90, 0.035, 0.12));
  const flap = new THREE.Mesh(flapGeo, carbonMat);
  flap.position.set(0, 1.255, -2.20);
  flap.rotation.x = 0.38;
  chassis.add(flap);

  // Swan-Neck Wing Pylons (arching over top of wing!)
  const pylonShape = new THREE.Shape();
  pylonShape.moveTo(0.28, 0);
  pylonShape.lineTo(0.12, 0);
  pylonShape.lineTo(-0.04, 0.38);
  pylonShape.lineTo(-0.22, 0.38);
  pylonShape.lineTo(-0.22, 0.32);
  pylonShape.lineTo(-0.09, 0.32);
  pylonShape.lineTo(0.04, 0);
  pylonShape.closePath();
  const pylonGeo = trackGeo(
    new THREE.ExtrudeGeometry(pylonShape, { depth: 0.035, bevelEnabled: false }),
  );
  pylonGeo.translate(0, 0, -0.0175);
  pylonGeo.rotateY(-Math.PI / 2);

  [-0.42, 0.42].forEach((xPos) => {
    const pylon = new THREE.Mesh(pylonGeo, alloyMat);
    pylon.position.set(xPos, 0.87, -2.02);
    chassis.add(pylon);
  });

  // Sculpted GT3 Wing Endplates + Accent Stripe
  const endplateShape = new THREE.Shape();
  endplateShape.moveTo(-0.26, -0.14);
  endplateShape.lineTo(0.24, -0.10);
  endplateShape.lineTo(0.22, 0.12);
  endplateShape.lineTo(-0.24, 0.14);
  endplateShape.closePath();
  const endplateGeo = trackGeo(
    new THREE.ExtrudeGeometry(endplateShape, { depth: 0.03, bevelEnabled: false }),
  );
  endplateGeo.translate(0, 0, -0.015);
  endplateGeo.rotateY(-Math.PI / 2);

  const endTrimGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.03, 0.38));
  [-0.96, 0.96].forEach((xPos) => {
    const plate = new THREE.Mesh(endplateGeo, paintMat);
    plate.position.set(xPos, 1.21, -2.10);
    chassis.add(plate);

    const trim = new THREE.Mesh(endTrimGeo, accentTrimMat);
    trim.position.set(xPos > 0 ? xPos + 0.008 : xPos - 0.008, 1.12, -2.10);
    chassis.add(trim);
  });

  // 8. 6-Fin Rear Diffuser, FIA Rain Light, Rear Grille & Rear Tow Hook
  const diffuserBaseGeo = trackGeo(new THREE.BoxGeometry(1.64, 0.14, 0.34));
  const diffuserBase = new THREE.Mesh(diffuserBaseGeo, carbonMat);
  diffuserBase.position.set(0, 0.24, -2.16);
  diffuserBase.rotation.x = -0.16;
  chassis.add(diffuserBase);

  const finBladeGeo = trackGeo(new THREE.BoxGeometry(0.03, 0.18, 0.34));
  [-0.68, -0.41, -0.14, 0.14, 0.41, 0.68].forEach((xPos) => {
    const fin = new THREE.Mesh(finBladeGeo, darkTrimMat);
    fin.position.set(xPos, 0.22, -2.20);
    chassis.add(fin);
  });

  const rearVentGeo = trackGeo(new THREE.BoxGeometry(1.48, 0.16, 0.06));
  const rearVent = new THREE.Mesh(rearVentGeo, grilleMat);
  rearVent.position.set(0, 0.56, -2.23);
  chassis.add(rearVent);

  // Central FIA Red LED Rain Light + Rear Tow Hook
  const rainLightGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.11, 0.05));
  const rainLight = new THREE.Mesh(rainLightGeo, rainLightMat);
  rainLight.position.set(0, 0.33, -2.28);
  chassis.add(rainLight);

  const rearTow = new THREE.Mesh(towRingGeo, towHookMat);
  rearTow.position.set(-0.28, 0.26, -2.31);
  chassis.add(rearTow);

  // 9. Quad-Projector Endurance LED Headlights + DRL Blades
  const headHousingGeo = trackGeo(new THREE.BoxGeometry(0.40, 0.11, 0.16));
  const projectorGeo = trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 12));
  projectorGeo.rotateX(Math.PI / 2);
  const drlBladeGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.025, 0.14));

  [-0.58, 0.58].forEach((xPos) => {
    const yaw = xPos > 0 ? -0.22 : 0.22;
    const housing = new THREE.Mesh(headHousingGeo, darkTrimMat);
    housing.position.set(xPos, 0.48, 2.13);
    housing.rotation.y = yaw;
    chassis.add(housing);

    // Dual projector optics (outer white + inner endurance yellow)
    const outerLens = new THREE.Mesh(projectorGeo, headlightMat);
    outerLens.position.set(xPos + (xPos > 0 ? 0.09 : -0.09), 0.48, 2.19);
    outerLens.rotation.y = yaw;
    chassis.add(outerLens);

    const innerLens = new THREE.Mesh(projectorGeo, enduranceAmberMat);
    innerLens.position.set(xPos + (xPos > 0 ? -0.09 : 0.09), 0.48, 2.21);
    innerLens.rotation.y = yaw;
    chassis.add(innerLens);

    const blade = new THREE.Mesh(drlBladeGeo, headlightMat);
    blade.position.set(xPos, 0.53, 2.14);
    blade.rotation.y = yaw;
    chassis.add(blade);
  });

  // 10. Full-Width 3D LED Taillight Bar + Brake Halo
  const tailHousingGeo = trackGeo(new THREE.BoxGeometry(1.56, 0.12, 0.08));
  const tailHousing = new THREE.Mesh(tailHousingGeo, darkTrimMat);
  tailHousing.position.set(0, 0.74, -2.23);
  chassis.add(tailHousing);

  const tailBarGeo = trackGeo(new THREE.BoxGeometry(1.48, 0.055, 0.09));
  const tailBar = new THREE.Mesh(tailBarGeo, brakeLightMat);
  tailBar.position.set(0, 0.74, -2.24);
  chassis.add(tailBar);

  const thirdBrakeGeo = trackGeo(new THREE.BoxGeometry(0.40, 0.03, 0.06));
  const thirdBrake = new THREE.Mesh(thirdBrakeGeo, brakeLightMat);
  thirdBrake.position.set(0, 0.90, -1.52);
  chassis.add(thirdBrake);

  const brakeHaloMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: options.glowHaloTexture ?? null,
      color: 0xef4444,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  if (options.glowHaloTexture) {
    const haloGeo = trackGeo(new THREE.PlaneGeometry(2.3, 0.75));
    const halo = new THREE.Mesh(haloGeo, brakeHaloMat);
    halo.position.set(0, 0.74, -2.31);
    halo.rotation.y = Math.PI;
    chassis.add(halo);
  }

  // 11. Quad Titanium Exhaust Pipes + Dynamic Throttle Flame Cones
  const pipeGeo = trackGeo(new THREE.CylinderGeometry(0.062, 0.068, 0.22, 16));
  pipeGeo.rotateX(Math.PI / 2);
  const flameGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.36, 10));
  flameGeo.rotateX(-Math.PI / 2);

  const exhaustFlameMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const exhaustFlames: THREE.Mesh[] = [];

  [-0.50, -0.35, 0.35, 0.50].forEach((xPos) => {
    const pipe = new THREE.Mesh(pipeGeo, exhaustMat);
    pipe.position.set(xPos, 0.32, -2.26);
    chassis.add(pipe);

    const flame = new THREE.Mesh(flameGeo, exhaustFlameMat);
    flame.position.set(xPos, 0.32, -2.48);
    flame.visible = false;
    chassis.add(flame);
    exhaustFlames.push(flame);
  });

  // 12. Forward Asphalt Headlight Beam Cones
  if (options.showHeadlightBeams && options.headlightBeamTexture) {
    const beamGeo = trackGeo(new THREE.PlaneGeometry(3.6, 15));
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: options.headlightBeamTexture,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    [-0.62, 0.62].forEach((xPos) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(xPos, 0.06, 9.7);
      roadAligned.add(beam);
    });
  }

  // 13. High-Definition Semi-Slick Tires, 12-Spoke Forged Center-Lock Wheels & Drilled Rotors
  const wheelRadius = 0.36;
  const frontWidth = 0.29;
  const rearWidth = 0.33;
  const rimR = wheelRadius * 0.68;

  const buildTireGeo = (width: number) => {
    const hw = width * 0.5;
    const profile = [
      new THREE.Vector2(rimR, -hw * 0.90),
      new THREE.Vector2(wheelRadius * 0.96, -hw),
      new THREE.Vector2(wheelRadius, -hw * 0.72),
      new THREE.Vector2(wheelRadius, hw * 0.72),
      new THREE.Vector2(wheelRadius * 0.96, hw),
      new THREE.Vector2(rimR, hw * 0.90),
    ];
    const g = trackGeo(new THREE.LatheGeometry(profile, 32));
    g.rotateZ(Math.PI / 2);
    return g;
  };

  const frontTireGeo = buildTireGeo(frontWidth);
  const rearTireGeo = buildTireGeo(rearWidth);

  const rimLipGeo = trackGeo(new THREE.TorusGeometry(rimR * 0.98, 0.022, 8, 28));
  rimLipGeo.rotateY(Math.PI / 2);

  const rimBarrelGeo = trackGeo(
    new THREE.CylinderGeometry(rimR, rimR, 0.25, 24, 1, true),
  );
  rimBarrelGeo.rotateZ(Math.PI / 2);

  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 16));
  hubGeo.rotateZ(Math.PI / 2);

  const centerNutGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.06, 6));
  centerNutGeo.rotateZ(Math.PI / 2);

  // Concave Y-split forged spokes (6 pairs = 12 spokes)
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.028, rimR * 0.95, 0.026));
  const discGeo = trackGeo(new THREE.CylinderGeometry(rimR * 0.80, rimR * 0.80, 0.032, 24));
  discGeo.rotateZ(Math.PI / 2);
  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.095, 0.18, 0.135));

  const frontLeftSteer = new THREE.Group();
  const frontRightSteer = new THREE.Group();
  const wheelSpins: THREE.Group[] = [];

  const wheelConfigs = [
    { x: 0.94, z: 1.42, width: frontWidth, tireGeo: frontTireGeo, steerGroup: frontLeftSteer },
    { x: -0.94, z: 1.42, width: frontWidth, tireGeo: frontTireGeo, steerGroup: frontRightSteer },
    { x: 0.96, z: -1.38, width: rearWidth, tireGeo: rearTireGeo, steerGroup: null },
    { x: -0.96, z: -1.38, width: rearWidth, tireGeo: rearTireGeo, steerGroup: null },
  ];

  wheelConfigs.forEach((cfg) => {
    const mount = new THREE.Group();
    mount.position.set(cfg.x, wheelRadius, cfg.z);
    root.add(mount);

    const spinGroup = new THREE.Group();
    if (cfg.steerGroup) {
      mount.add(cfg.steerGroup);
      cfg.steerGroup.add(spinGroup);
    } else {
      mount.add(spinGroup);
    }

    const tire = new THREE.Mesh(cfg.tireGeo, tireMat);
    tire.castShadow = true;
    spinGroup.add(tire);

    const rimBarrel = new THREE.Mesh(rimBarrelGeo, rimMat);
    spinGroup.add(rimBarrel);

    const sign = cfg.x > 0 ? 1 : -1;
    const faceX = sign * (cfg.width * 0.36);

    const rimLip = new THREE.Mesh(rimLipGeo, rimMat);
    rimLip.position.x = sign * (cfg.width * 0.43);
    spinGroup.add(rimLip);

    const hub = new THREE.Mesh(hubGeo, rimMat);
    hub.position.x = faceX * 0.72;
    spinGroup.add(hub);

    const centerLock = new THREE.Mesh(centerNutGeo, centerLockMat);
    centerLock.position.x = faceX + sign * 0.025;
    spinGroup.add(centerLock);

    // 12-spoke Y-split forged rim spokes
    for (let s = 0; s < 6; s++) {
      const baseAngle = (s * Math.PI * 2) / 6;
      [-0.17, 0.17].forEach((splay) => {
        const angle = baseAngle + splay;
        const spoke = new THREE.Mesh(spokeGeo, rimMat);
        const rMid = rimR * 0.50;
        spoke.position.set(
          faceX,
          Math.cos(angle) * rMid,
          Math.sin(angle) * rMid,
        );
        spoke.rotation.x = angle;
        spoke.rotation.z = sign * -0.14;
        spinGroup.add(spoke);
      });
    }

    // Drilled brake rotor + stationary 6-piston caliper
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.x = sign * -0.02;
    spinGroup.add(disc);

    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(sign * 0.015, 0.05, -0.14);
    if (cfg.steerGroup) {
      cfg.steerGroup.add(caliper);
    } else {
      mount.add(caliper);
    }

    wheelSpins.push(spinGroup);
  });

  // 14. Grounded Contact Shadow Plane
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(3.0, 5.4));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: options.contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    }),
  );
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.035;
  roadAligned.add(shadowPlane);

  return {
    root,
    roadAligned,
    chassis,
    frontLeftSteer,
    frontRightSteer,
    wheelSpins,
    brakeLightMat,
    brakeHaloMat,
    exhaustFlameMat,
    exhaustFlames,
    paintMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      localTextures.forEach((t) => t.dispose());
    },
  };
}
