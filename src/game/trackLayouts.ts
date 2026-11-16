import * as THREE from 'three';
import { TrackLayoutId } from './types';

export interface TrackLayoutConfig {
  id: TrackLayoutId;
  name: string;
  featureLabel: string;
  hasUnderpassTunnel: boolean;
  pierTValues: number[];
  skylineSeed: number;
  nominalLapSpeedMs: number;
  aceLapSpeedMs: number;
  controlPoints: THREE.Vector3[];
  lengthMeters: number;
  lengthKmLabel: string;
}

interface RawLayoutSpec {
  id: TrackLayoutId;
  name: string;
  featureLabel: string;
  hasUnderpassTunnel: boolean;
  pierTValues: number[];
  skylineSeed: number;
  nominalLapSpeedMs: number;
  aceLapSpeedMs: number;
  controlPoints: Array<[number, number, number]>;
}

const RAW_LAYOUTS: RawLayoutSpec[] = [
  {
    id: 'metro-loop',
    name: 'Nexora Metro Loop',
    featureLabel: 'Overpass & Tunnel',
    hasUnderpassTunnel: true,
    pierTValues: [0.72, 0.78, 0.82],
    skylineSeed: 4219,
    nominalLapSpeedMs: 44.5,
    aceLapSpeedMs: 50.0,
    controlPoints: [
      [-135, 0, -25],
      [-135, 0, 78],
      [-85, 0, 142],
      [-20, 0, 120],
      [0, 0, 56],
      [0, 0, -56],
      [46, 0, -126],
      [126, 0, -110],
      [156, 0, -25],
      [124, 0.6, 65],
      [58, 6.1, 10],
      [0, 6.8, 0],
      [-58, 6.1, -10],
      [-96, 0.6, -86],
      [-135, 0, -86],
    ],
  },
  {
    id: 'harbor-sprint',
    name: 'Harbor Skyline GP',
    featureLabel: 'High-Speed Flyover',
    hasUnderpassTunnel: false,
    pierTValues: [0.58, 0.64, 0.7],
    skylineSeed: 7331,
    nominalLapSpeedMs: 47.0,
    aceLapSpeedMs: 52.5,
    controlPoints: [
      [-155, 0, -40],
      [-155, 0, 95],
      [-110, 0, 155],
      [-20, 0, 155],
      [40, 0, 105],
      [95, 0, 130],
      [160, 0, 85],
      [165, 1.5, -10],
      [135, 5.2, -95],
      [55, 4.8, -145],
      [-35, 0.8, -135],
      [-110, 0, -140],
      [-155, 0, -105],
    ],
  },
  {
    id: 'apex-switchback',
    name: 'Apex Switchback',
    featureLabel: 'Technical S-Bends',
    hasUnderpassTunnel: false,
    pierTValues: [0.66, 0.72, 0.77],
    skylineSeed: 9187,
    nominalLapSpeedMs: 41.5,
    aceLapSpeedMs: 46.5,
    controlPoints: [
      [-125, 0, -30],
      [-125, 0, 65],
      [-70, 0, 125],
      [5, 0, 85],
      [65, 0, 120],
      [135, 0, 75],
      [120, 0, -15],
      [155, 1.2, -90],
      [85, 4.6, -140],
      [10, 2.2, -105],
      [-55, 0, -135],
      [-125, 0, -95],
    ],
  },
  {
    id: 'drift-touge',
    name: 'Nexora Drift Touge',
    featureLabel: 'Wide Hairpins & S-Sweeps',
    hasUnderpassTunnel: false,
    pierTValues: [],
    skylineSeed: 6151,
    nominalLapSpeedMs: 40.0,
    aceLapSpeedMs: 45.0,
    controlPoints: [
      [-130, 0, -20],
      [-130, 0, 75],
      [-75, 0, 145],
      [15, 0, 125],
      [65, 0, 65],
      [140, 0, 95],
      [165, 0, 10],
      [110, 0, -75],
      [40, 1.5, -135],
      [-55, 0.8, -145],
      [-130, 0, -100],
    ],
  },
];

export const TRACK_LAYOUTS: TrackLayoutConfig[] = RAW_LAYOUTS.map((spec) => {
  const controlPoints = spec.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
  const lengthMeters = curve.getLength();
  return {
    id: spec.id,
    name: spec.name,
    featureLabel: spec.featureLabel,
    hasUnderpassTunnel: spec.hasUnderpassTunnel,
    pierTValues: spec.pierTValues,
    skylineSeed: spec.skylineSeed,
    nominalLapSpeedMs: spec.nominalLapSpeedMs,
    aceLapSpeedMs: spec.aceLapSpeedMs,
    controlPoints,
    lengthMeters,
    lengthKmLabel: `${(lengthMeters / 1000).toFixed(2)} km`,
  };
});

export function getTrackLayoutConfig(layoutId: TrackLayoutId): TrackLayoutConfig {
  return TRACK_LAYOUTS.find((l) => l.id === layoutId) ?? TRACK_LAYOUTS[0];
}

export function getMinimapPreviewForLayout(layoutId: TrackLayoutId): {
  points: Array<{ x: number; z: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
} {
  const cfg = getTrackLayoutConfig(layoutId);
  const curve = new THREE.CatmullRomCurve3(cfg.controlPoints, true, 'centripetal', 0.5);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const points: Array<{ x: number; z: number }> = [];
  const count = 120;
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(i / count);
    points.push({ x: p.x, z: p.z });
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { points, bounds: { minX, maxX, minZ, maxZ } };
}
