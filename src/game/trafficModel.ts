import * as THREE from 'three';

export type TrafficVehicleKind = 'sedan' | 'suv' | 'van';

export interface TrafficMeshHandles {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  dispose: () => void;
}

const TRAFFIC_COLORS = [
  '#CBD5E1',
  '#334155',
  '#1E3A8A',
  '#7F1D1D',
  '#065F46',
  '#92400E',
  '#475569',
];

export function createTrafficVehicleMesh(
  kind: TrafficVehicleKind,
  colorIndex: number,
  contactShadowTexture: THREE.Texture,
): TrafficMeshHandles {
  const root = new THREE.Group();
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

  const paintColor = TRAFFIC_COLORS[colorIndex % TRAFFIC_COLORS.length];
  const bodyMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(paintColor),
      metalness: 0.45,
      roughness: 0.28,
      clearcoat: 0.75,
      clearcoatRoughness: 0.12,
    }),
  );
  const darkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.15 }),
  );
  const glassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x090f1d,
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1.0,
    }),
  );
  const tailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 2.3,
    }),
  );
  const headMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.2,
    }),
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.9 }),
  );

  const length = kind === 'van' ? 4.55 : kind === 'suv' ? 4.35 : 4.20;
  const width = kind === 'van' ? 1.88 : 1.82;
  const bodyH = kind === 'van' ? 1.15 : kind === 'suv' ? 0.72 : 0.56;

  // Lower body shell
  const lowerGeo = trackGeo(new THREE.BoxGeometry(width, bodyH, length));
  const lower = new THREE.Mesh(lowerGeo, bodyMat);
  lower.position.y = 0.28 + bodyH * 0.5;
  lower.castShadow = true;
  lower.receiveShadow = true;
  root.add(lower);

  // Cabin greenhouse
  if (kind === 'van') {
    const roofGeo = trackGeo(new THREE.BoxGeometry(width * 0.94, 0.62, length * 0.72));
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 0.28 + bodyH + 0.28, -0.22);
    roof.castShadow = true;
    root.add(roof);

    const windshieldGeo = trackGeo(new THREE.BoxGeometry(width * 0.88, 0.44, 0.10));
    const ws = new THREE.Mesh(windshieldGeo, glassMat);
    ws.position.set(0, 0.28 + bodyH + 0.22, length * 0.15);
    ws.rotation.x = -0.35;
    root.add(ws);
  } else {
    const cabinW = width * 0.84;
    const cabinH = kind === 'suv' ? 0.52 : 0.44;
    const cabinL = kind === 'suv' ? 2.35 : 1.95;
    const cabinGeo = trackGeo(new THREE.BoxGeometry(cabinW, cabinH, cabinL));
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.28 + bodyH + cabinH * 0.46, -0.18);
    cabin.castShadow = true;
    root.add(cabin);

    const roofCapGeo = trackGeo(new THREE.BoxGeometry(cabinW * 0.92, 0.05, cabinL * 0.72));
    const roofCap = new THREE.Mesh(roofCapGeo, bodyMat);
    roofCap.position.set(0, 0.28 + bodyH + cabinH * 0.93, -0.20);
    root.add(roofCap);
  }

  // Front & Rear Bumpers
  const bumperGeo = trackGeo(new THREE.BoxGeometry(width * 1.01, 0.16, 0.12));
  const frontBumper = new THREE.Mesh(bumperGeo, darkMat);
  frontBumper.position.set(0, 0.28, length * 0.5);
  root.add(frontBumper);
  const rearBumper = new THREE.Mesh(bumperGeo, darkMat);
  rearBumper.position.set(0, 0.28, -length * 0.5);
  root.add(rearBumper);

  // Bright LED Taillights & Headlights for crisp distance readability at 250+ km/h
  const lightGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.12, 0.06));
  [-width * 0.34, width * 0.34].forEach((x) => {
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(x, 0.62, -length * 0.5 - 0.01);
    root.add(tail);

    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(x, 0.56, length * 0.5 + 0.01);
    root.add(head);
  });

  // Wheels
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14));
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const zWheel = length * 0.31;
  const xWheel = width * 0.48;
  [
    [-xWheel, zWheel],
    [xWheel, zWheel],
    [-xWheel, -zWheel],
    [xWheel, -zWheel],
  ].forEach(([x, z]) => {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, 0.32, z);
    root.add(w);
    wheels.push(w);
  });

  // Grounded contact shadow
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(2.4, length + 0.9));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  );
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.03;
  root.add(shadow);

  return {
    root,
    wheels,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
