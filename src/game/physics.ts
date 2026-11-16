import { CityCircuit } from './track';
import { Difficulty, InputState } from './types';

export interface VehicleState {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number; // signed forward speed (m/s)
  steerVisual: number;
  wheelSpinAngle: number;
  chassisPitch: number;
  chassisRoll: number;
  roadPitch: number;
  braking: boolean;
  drifting: boolean;
  trackSampleIndex: number;
  trackDistance: number;
  lateralOffset: number;
  lap: number;
  nextCheckpointIndex: number;
  totalProgress: number;
  lapStartTimeMs: number;
  lapTimesMs: number[];
  bestLapMs: number | null;
  finished: boolean;
  finishTimeMs: number | null;
  aiLaneOffset: number;
  aiSpeedSkill: number;
}

export interface StepPhysicsResult {
  wallImpact: number; // 0..1
  skidIntensity: number; // 0..1
  completedLap: boolean;
  completedRace: boolean;
  wrongWay: boolean;
  crossedCheckpointIndex: number | null;
  lastLapDurationMs: number | null;
}

export function createVehicleOnGrid(
  id: string,
  name: string,
  isPlayer: boolean,
  color: string,
  circuit: CityCircuit,
  gridSlot: number,
  aiLaneOffset: number,
  aiSpeedSkill: number,
): VehicleState {
  // Staggered 2-wide starting grid behind the finish line
  const row = Math.floor(gridSlot / 2);
  const col = gridSlot % 2 === 0 ? -3.4 : 3.4;
  const distBehindStart = 7 + row * 9.5;
  const startDist = circuit.totalLength - distBehindStart;
  const sample = circuit.getSampleAtDistance(startDist);
  const heading = Math.atan2(sample.tangent.x, sample.tangent.z);

  return {
    id,
    name,
    isPlayer,
    color,
    x: sample.position.x + sample.right.x * col,
    y: sample.position.y,
    z: sample.position.z + sample.right.z * col,
    vx: 0,
    vz: 0,
    heading,
    speed: 0,
    steerVisual: 0,
    wheelSpinAngle: 0,
    chassisPitch: 0,
    chassisRoll: 0,
    roadPitch: -Math.asin(Math.max(-0.5, Math.min(0.5, sample.tangent.y))),
    braking: false,
    drifting: false,
    trackSampleIndex: sample.index,
    trackDistance: sample.distance,
    lateralOffset: col,
    lap: 1,
    nextCheckpointIndex: 1,
    totalProgress: -distBehindStart,
    lapStartTimeMs: 0,
    lapTimesMs: [],
    bestLapMs: null,
    finished: false,
    finishTimeMs: null,
    aiLaneOffset,
    aiSpeedSkill,
  };
}

export function computeAiInput(
  vehicle: VehicleState,
  circuit: CityCircuit,
  difficulty: Difficulty,
): InputState {
  const speedAbs = Math.abs(vehicle.speed);
  const lookAheadDist = 16 + speedAbs * 0.42;
  const targetSample = circuit.getSampleAtDistance(vehicle.trackDistance + lookAheadDist);
  const farSample = circuit.getSampleAtDistance(vehicle.trackDistance + lookAheadDist + 24);

  const tx = targetSample.position.x + targetSample.right.x * vehicle.aiLaneOffset;
  const tz = targetSample.position.z + targetSample.right.z * vehicle.aiLaneOffset;

  const dx = tx - vehicle.x;
  const dz = tz - vehicle.z;
  const desiredHeading = Math.atan2(dx, dz);

  let angleDiff = desiredHeading - vehicle.heading;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // Measure upcoming corner sharpness
  const cornerDot =
    targetSample.tangent.x * farSample.tangent.x + targetSample.tangent.z * farSample.tangent.z;
  const cornerSeverity = Math.max(0, 1 - cornerDot); // 0 straight, higher = tight bend

  const diffBase = difficulty === 'easy' ? 0.74 : difficulty === 'normal' ? 0.89 : 1.02;
  const maxTargetSpeed = Math.max(22, (64 - cornerSeverity * 92) * diffBase * vehicle.aiSpeedSkill);

  return {
    accelerate: vehicle.speed < maxTargetSpeed && Math.abs(angleDiff) < 0.72,
    brake: vehicle.speed > maxTargetSpeed + 5,
    steerLeft: angleDiff > 0.045,
    steerRight: angleDiff < -0.045,
    handbrake: false,
  };
}

export function stepVehiclePhysics(
  v: VehicleState,
  input: InputState,
  circuit: CityCircuit,
  dt: number,
  raceElapsedMs: number,
  totalLaps: number,
  isLapTrackingMode: boolean,
): StepPhysicsResult {
  const prevDist = v.trackDistance;

  const fwdX = Math.sin(v.heading);
  const fwdZ = Math.cos(v.heading);
  // Right vector = forward x up = (-cos, 0, sin)
  const rightX = -Math.cos(v.heading);
  const rightZ = Math.sin(v.heading);

  // Decompose current velocity into local forward & lateral components
  let forwardVel = v.vx * fwdX + v.vz * fwdZ;
  let lateralVel = v.vx * rightX + v.vz * rightZ;

  const topSpeed = v.isPlayer ? 68.5 : 67.5; // ~246 km/h
  const maxReverse = -21;

  let braking = false;
  if (input.accelerate && !input.brake) {
    // Punchy arcade acceleration curve
    const speedRatio = Math.max(0, forwardVel / topSpeed);
    const accel = 29 * (1 - 0.62 * speedRatio * speedRatio);
    forwardVel += accel * dt;
    if (forwardVel > topSpeed) forwardVel = topSpeed;
  } else if (input.brake) {
    if (forwardVel > 1.8) {
      forwardVel = Math.max(0, forwardVel - 46 * dt);
      braking = true;
    } else {
      forwardVel = Math.max(maxReverse, forwardVel - 22 * dt);
      braking = true;
    }
  } else {
    // Natural coasting drag
    const drag = forwardVel * 0.48 + Math.sign(forwardVel) * 1.4;
    if (Math.abs(drag * dt) >= Math.abs(forwardVel)) {
      forwardVel = 0;
    } else {
      forwardVel -= drag * dt;
    }
  }

  // Handbrake slows slightly and loosens rear lateral grip
  if (input.handbrake && Math.abs(forwardVel) > 2) {
    forwardVel *= Math.max(0, 1 - 1.15 * dt);
    braking = true;
  }

  // Speed-sensitive steering
  const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
  const speedAbs = Math.abs(forwardVel);
  const steerEnable = Math.min(1, speedAbs / 3.5);
  const highSpeedDamp = 1 / (1 + speedAbs * 0.014);
  const handbrakeTurnBoost = input.handbrake ? 1.28 : 1.0;
  const steerDir = forwardVel >= -0.4 ? 1 : -1;
  const maxTurnRate = 2.35 * steerEnable * highSpeedDamp * handbrakeTurnBoost;

  const targetSteerVisual = steerInput * 0.42;
  v.steerVisual += (targetSteerVisual - v.steerVisual) * Math.min(1, dt * 14);

  v.heading += steerInput * steerDir * maxTurnRate * dt;

  // Recompute forward/right vectors after steering rotation
  const nFwdX = Math.sin(v.heading);
  const nFwdZ = Math.cos(v.heading);
  const nRightX = -Math.cos(v.heading);
  const nRightZ = Math.sin(v.heading);

  // Apply lateral tire grip (damps sideways slip; looser during handbrake)
  const lateralGrip = input.handbrake ? 2.6 : 9.4;
  lateralVel *= Math.exp(-lateralGrip * dt);

  // Reconstruct world horizontal velocity
  v.vx = nFwdX * forwardVel + nRightX * lateralVel;
  v.vz = nFwdZ * forwardVel + nRightZ * lateralVel;

  // Integrate position
  v.x += v.vx * dt;
  v.z += v.vz * dt;

  // Project onto closed-loop circuit using hint index (handles overpass/underpass cleanly!)
  const proj = circuit.getClosestSample(v.x, v.y, v.z, v.trackSampleIndex);
  v.trackSampleIndex = proj.sample.index;
  v.trackDistance = proj.sample.distance;
  v.y += (proj.sample.position.y - v.y) * Math.min(1, dt * 24);

  // Road pitch angle for visual slope alignment
  const targetRoadPitch = -Math.asin(Math.max(-0.45, Math.min(0.45, proj.sample.tangent.y)));
  v.roadPitch += (targetRoadPitch - v.roadPitch) * Math.min(1, dt * 12);

  // Track barrier collision response
  let wallImpact = 0;
  const safeHalfWidth = circuit.barrierHalfWidth - 1.15;
  let lat = proj.lateralOffset;

  if (Math.abs(lat) > safeHalfWidth) {
    const sign = Math.sign(lat);
    const excess = Math.abs(lat) - safeHalfWidth;
    // Push car cleanly inside barrier
    v.x -= proj.sample.right.x * sign * excess;
    v.z -= proj.sample.right.z * sign * excess;
    lat = sign * safeHalfWidth;

    // Reflect velocity moving outward into the barrier
    const outwardVel = v.vx * (proj.sample.right.x * sign) + v.vz * (proj.sample.right.z * sign);
    if (outwardVel > 0) {
      wallImpact = Math.min(1, outwardVel / 18);
      v.vx -= proj.sample.right.x * sign * outwardVel * 1.32;
      v.vz -= proj.sample.right.z * sign * outwardVel * 1.32;
      // Friction scrub on barrier graze
      v.vx *= 0.86;
      v.vz *= 0.86;
    }
  }
  v.lateralOffset = lat;

  // Recompute post-collision forward speed
  v.speed = v.vx * nFwdX + v.vz * nFwdZ;
  v.braking = braking;

  // Visual suspension lean (pitch on throttle/brake, roll on steer/lateral)
  const targetPitch = input.brake ? 0.04 : input.accelerate ? -0.025 : 0;
  const targetRoll = -steerInput * Math.min(1, speedAbs / 24) * 0.055;
  v.chassisPitch += (targetPitch - v.chassisPitch) * Math.min(1, dt * 10);
  v.chassisRoll += (targetRoll - v.chassisRoll) * Math.min(1, dt * 10);

  // Wheel rotation
  v.wheelSpinAngle += (v.speed / 0.35) * dt;

  // Drift / skid intensity
  const lateralSlip = Math.abs(lateralVel);
  const drifting = (input.handbrake && speedAbs > 9) || lateralSlip > 5.2;
  v.drifting = drifting;
  const skidIntensity = drifting ? Math.min(1, Math.max(lateralSlip / 14, input.handbrake ? 0.65 : 0)) : 0;

  // Wrong-way detection
  const headingDotTrack = nFwdX * proj.sample.tangent.x + nFwdZ * proj.sample.tangent.z;
  const wrongWay = headingDotTrack < -0.35 && v.speed > 4.5;

  // Ordered Checkpoint & Lap Tracking
  let completedLap = false;
  let completedRace = false;
  let crossedCheckpointIndex: number | null = null;
  let lastLapDurationMs: number | null = null;

  if (isLapTrackingMode && !v.finished) {
    const cpCount = circuit.checkpointDistances.length;
    if (v.nextCheckpointIndex > 0 && v.nextCheckpointIndex < cpCount) {
      const targetCpDist = circuit.checkpointDistances[v.nextCheckpointIndex];
      if (v.trackDistance >= targetCpDist && v.trackDistance < targetCpDist + 110) {
        crossedCheckpointIndex = v.nextCheckpointIndex;
        v.nextCheckpointIndex = (v.nextCheckpointIndex + 1) % cpCount;
      }
    } else if (v.nextCheckpointIndex === 0) {
      // Cleared all intermediate checkpoints; detect forward crossing of Finish Line (t = 0)
      const wrappedForward =
        prevDist > circuit.totalLength * 0.78 && v.trackDistance < circuit.totalLength * 0.22;
      if (wrappedForward) {
        const lapDuration = raceElapsedMs - v.lapStartTimeMs;
        if (lapDuration > 4000) {
          lastLapDurationMs = lapDuration;
          v.lapTimesMs.push(lapDuration);
          if (v.bestLapMs === null || lapDuration < v.bestLapMs) {
            v.bestLapMs = lapDuration;
          }
          v.lapStartTimeMs = raceElapsedMs;
          completedLap = true;

          if (v.lap >= totalLaps) {
            v.finished = true;
            v.finishTimeMs = raceElapsedMs;
            completedRace = true;
          } else {
            v.lap += 1;
            v.nextCheckpointIndex = 1;
          }
        }
      }
    }
  }

  // Continuous race progress metric for live standings (handles pre-start negative distance cleanly)
  if (v.finished) {
    v.totalProgress = totalLaps * circuit.totalLength + 100000 - (v.finishTimeMs ?? 0) * 0.001;
  } else if (v.lap === 1 && v.nextCheckpointIndex === 1 && v.trackDistance > circuit.totalLength * 0.85) {
    // Still behind the start line on launch
    v.totalProgress = v.trackDistance - circuit.totalLength;
  } else {
    v.totalProgress = (v.lap - 1) * circuit.totalLength + v.trackDistance;
  }

  return {
    wallImpact,
    skidIntensity,
    completedLap,
    completedRace,
    wrongWay,
    crossedCheckpointIndex,
    lastLapDurationMs,
  };
}

export function resolveVehicleCollisions(vehicles: VehicleState[]): number {
  let maxImpact = 0;
  const minDist = 2.65;
  const minDistSq = minDist * minDist;

  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i];
      const b = vehicles[j];
      if (Math.abs(a.y - b.y) > 2.2) continue;

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.0001 && distSq < minDistSq) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) * 0.5;

        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;

        const relVx = b.vx - a.vx;
        const relVz = b.vz - a.vz;
        const relNormal = relVx * nx + relVz * nz;
        if (relNormal < 0) {
          const impulse = -relNormal * 0.68;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;

          if (a.isPlayer || b.isPlayer) {
            maxImpact = Math.max(maxImpact, Math.min(1, Math.abs(relNormal) / 14));
          }
        }
      }
    }
  }
  return maxImpact;
}
