import { CityCircuit, TrackProjection } from './track';
import { Difficulty, EffectiveCarSpecs, InputState } from './types';

const CAR_HALF_WIDTH = 1.24;
const CAR_HALF_LENGTH = 2.44;
const BARRIER_MARGIN = 0.14;

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
  chassisHeave: number;
  chassisHeaveVel: number;
  roadPitch: number;
  wheelTravel: [number, number, number, number];
  wheelVel: [number, number, number, number];
  prevRoadSlope: number;
  braking: boolean;
  drifting: boolean;
  nitroActive: boolean;
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

  const frontY = circuit.getHeightAtDistance(startDist + 1.42) + circuit.roadSurfaceOffset + 0.004;
  const rearY = circuit.getHeightAtDistance(startDist - 1.38) + circuit.roadSurfaceOffset + 0.004;
  const centerY = sample.position.y + circuit.roadSurfaceOffset + 0.004;

  return {
    id,
    name,
    isPlayer,
    color,
    x: sample.position.x + sample.right.x * col,
    y: Math.max(centerY, (frontY + rearY) * 0.5),
    z: sample.position.z + sample.right.z * col,
    vx: 0,
    vz: 0,
    heading,
    speed: 0,
    steerVisual: 0,
    wheelSpinAngle: 0,
    chassisPitch: 0,
    chassisRoll: 0,
    chassisHeave: 0,
    chassisHeaveVel: 0,
    roadPitch: Math.atan2(rearY - frontY, 2.8),
    wheelTravel: [0, 0, 0, 0],
    wheelVel: [0, 0, 0, 0],
    prevRoadSlope: sample.tangent.y,
    braking: false,
    drifting: false,
    nitroActive: false,
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

function updateVehicleGroundContact(
  v: VehicleState,
  circuit: CityCircuit,
  proj: TrackProjection,
): void {
  const fwdX = Math.sin(v.heading);
  const fwdZ = Math.cos(v.heading);
  const fwdDotTan = fwdX * proj.sample.tangent.x + fwdZ * proj.sample.tangent.z;

  // Raise slightly when tires ride onto raised outer rumble curbs (curb rises +0.03m over asphalt)
  const edgeDist = Math.abs(v.lateralOffset) + 1.1;
  const curbLift =
    edgeDist > circuit.roadHalfWidth
      ? Math.min(0.03, ((edgeDist - circuit.roadHalfWidth) / 0.8) * 0.03)
      : 0;
  const clearance = circuit.roadSurfaceOffset + curbLift + 0.005;

  const yFront = circuit.getHeightAtDistance(proj.sample.distance + 1.42 * fwdDotTan) + clearance;
  const yRear = circuit.getHeightAtDistance(proj.sample.distance - 1.38 * fwdDotTan) + clearance;
  const yCenter = proj.sample.position.y + clearance;

  v.y = Math.max(yCenter, (yFront + yRear) * 0.5);
  v.roadPitch = Math.atan2(yRear - yFront, 2.8);
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
    nitro: false,
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
  specs?: EffectiveCarSpecs,
  slipstreamActive = false,
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

  const speedMult = v.isPlayer && specs ? specs.topSpeedMult : 1.0;
  const accelMult = v.isPlayer && specs ? specs.accelMult : 1.0;
  const handlingMult = v.isPlayer && specs ? specs.handlingMult : 1.0;
  const driftGripMult = v.isPlayer && specs ? specs.driftGripMult : 1.0;
  const nitroBoostMult = v.isPlayer && input.nitro ? 1 + 0.17 * (specs?.nitroPowerMult ?? 1.0) : 1.0;
  const slipstreamMult = v.isPlayer && slipstreamActive ? 1.11 : 1.0;

  const baseTopSpeed = v.isPlayer ? 68.5 : 67.5;
  const topSpeed = baseTopSpeed * speedMult * nitroBoostMult * slipstreamMult;
  const maxReverse = -21;

  v.nitroActive = Boolean(v.isPlayer && input.nitro && !input.brake && forwardVel >= -1);

  let braking = false;
  if ((input.accelerate || v.nitroActive) && !input.brake) {
    // Punchy arcade acceleration curve + Nitrous kick
    const speedRatio = Math.max(0, forwardVel / topSpeed);
    const nitroAccel = v.nitroActive ? 1.56 * (specs?.nitroPowerMult ?? 1.0) : 1.0;
    const draftAccel = slipstreamActive ? 1.14 : 1.0;
    const accel = 29 * accelMult * nitroAccel * draftAccel * (1 - 0.6 * speedRatio * speedRatio);
    forwardVel += accel * dt;
    if (forwardVel > topSpeed) forwardVel = topSpeed;
  } else if (input.brake) {
    if (forwardVel > 1.8) {
      forwardVel = Math.max(0, forwardVel - 46 * handlingMult * dt);
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
    forwardVel *= Math.max(0, 1 - 1.1 * dt);
    braking = true;
  }

  // Speed-sensitive steering scaled by vehicle handling rating
  const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
  const speedAbs = Math.abs(forwardVel);
  const steerEnable = Math.min(1, speedAbs / 3.5);
  const highSpeedDamp = 1 / (1 + speedAbs * (0.014 / handlingMult));
  const handbrakeTurnBoost = input.handbrake ? 1.3 : 1.0;
  const steerDir = forwardVel >= -0.4 ? 1 : -1;
  const maxTurnRate = 2.35 * handlingMult * steerEnable * highSpeedDamp * handbrakeTurnBoost;

  const targetSteerVisual = steerInput * 0.42;
  v.steerVisual += (targetSteerVisual - v.steerVisual) * Math.min(1, dt * 14);

  v.heading += steerInput * steerDir * maxTurnRate * dt;

  // Recompute forward/right vectors after steering rotation
  const nFwdX = Math.sin(v.heading);
  const nFwdZ = Math.cos(v.heading);
  const nRightX = -Math.cos(v.heading);
  const nRightZ = Math.sin(v.heading);

  // Apply lateral tire grip (damps sideways slip; looser during handbrake or Drift Spec)
  const lateralGrip = (input.handbrake ? 2.4 : 9.4) * driftGripMult * (input.handbrake ? 1 : handlingMult);
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

  // Track barrier collision response (full rotated car OBB so corners & wheels never clip wall)
  const { wallImpact, proj: clampedProj } = clampVehicleToCircuitBarrier(v, circuit, proj);

  // Exact dual-axle ground contact so front/rear tires never sink into ramps, crests, or asphalt
  updateVehicleGroundContact(v, circuit, clampedProj);

  // Recompute post-collision forward speed
  v.speed = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
  v.braking = braking;

  // Wheel rotation
  v.wheelSpinAngle += (v.speed / 0.35) * dt;

  // Per-wheel spring-damper compression over road seams, rumble curbs, and ramp transitions
  const bumpPhaseSpeed = Math.min(1, speedAbs / 8);
  const fwdDotTan = Math.sin(v.heading) * clampedProj.sample.tangent.x + Math.cos(v.heading) * clampedProj.sample.tangent.z;
  const rightDotSide = Math.cos(v.heading) * clampedProj.sample.right.x - Math.sin(v.heading) * clampedProj.sample.right.z;
  const onOverpass = clampedProj.sample.position.y > 0.45;
  const distFront = clampedProj.sample.distance + 1.42 * fwdDotTan;
  const distRear = clampedProj.sample.distance - 1.38 * fwdDotTan;

  // Ramp vertical curvature G-load (compresses chassis entering ramps, unloads over crests)
  const slopeRate = (clampedProj.sample.tangent.y - v.prevRoadSlope) / Math.max(0.008, dt);
  v.prevRoadSlope = clampedProj.sample.tangent.y;
  const slopeCompression = Math.max(-1.6, Math.min(1.6, slopeRate * v.speed * 0.045));

  const sampleWheelBump = (axleDist: number, sideSign: 1 | -1): number => {
    if (speedAbs < 1.2) return 0;
    // Bridge expansion joints every 22m (sharper on overpass) + subtle micro-asphalt chatter
    const jointPhase = ((axleDist % 22) + 22) % 22;
    const jointSpike =
      jointPhase < 0.85
        ? Math.sin((jointPhase / 0.85) * Math.PI) * (onOverpass ? 0.046 : 0.026)
        : 0;
    const asphaltRipple =
      Math.max(
        0,
        Math.sin(axleDist * 1.15 + sideSign * 0.7) * 0.006 +
          Math.sin(axleDist * 2.85 + sideSign * 1.4) * 0.004,
      ) * bumpPhaseSpeed;

    // Independent left/right serrated rumble curb detection
    const wheelLat = v.lateralOffset - rightDotSide * sideSign * 0.95;
    let curbBump = 0;
    if (Math.abs(wheelLat) > circuit.roadHalfWidth - 0.15) {
      const curbDepth = Math.min(1, (Math.abs(wheelLat) - (circuit.roadHalfWidth - 0.15)) / 0.65);
      const serration = 0.5 + 0.5 * Math.sin(axleDist * 6.8);
      curbBump = (0.014 + serration * 0.032) * curbDepth * bumpPhaseSpeed;
    }

    return Math.min(0.085, jointSpike * bumpPhaseSpeed + asphaltRipple + curbBump);
  };

  const targetBumps: [number, number, number, number] = [
    sampleWheelBump(distFront, 1), // FL (+x, +z)
    sampleWheelBump(distFront, -1), // FR (-x, +z)
    sampleWheelBump(distRear, 1), // RL (+x, -z)
    sampleWheelBump(distRear, -1), // RR (-x, -z)
  ];

  // Sub-stepped 2nd-order coilover spring-damper ODE (k = 240, c = 21)
  const subDt = dt * 0.5;
  const kWheel = 240;
  const cWheel = 21;
  for (let w = 0; w < 4; w++) {
    let pos = v.wheelTravel[w];
    let vel = v.wheelVel[w];
    const target = targetBumps[w];
    for (let s = 0; s < 2; s++) {
      const accel = (target - pos) * kWheel - vel * cWheel;
      vel += accel * subDt;
      pos += vel * subDt;
    }
    if (pos < 0) {
      pos = 0;
      if (vel < 0) vel *= -0.2;
    } else if (pos > 0.09) {
      pos = 0.09;
      if (vel > 0) vel = 0;
    }
    v.wheelTravel[w] = pos;
    v.wheelVel[w] = vel;
  }

  // Sprung chassis heave reacting to average wheel compression + ramp G-load + impact jolt
  const avgWheelBump =
    (v.wheelTravel[0] + v.wheelTravel[1] + v.wheelTravel[2] + v.wheelTravel[3]) * 0.25;
  const targetHeave =
    avgWheelBump * 0.35 -
    slopeCompression * 0.025 -
    (v.nitroActive ? 0.012 : 0) -
    wallImpact * 0.03;
  const heaveAccel = (targetHeave - v.chassisHeave) * 145 - v.chassisHeaveVel * 14;
  v.chassisHeaveVel += heaveAccel * dt;
  v.chassisHeave = Math.max(-0.058, Math.min(0.038, v.chassisHeave + v.chassisHeaveVel * dt));

  // Visual suspension lean (pitch on throttle/nitro/brake + front-rear bump kick, roll on steer + curb tilt)
  const frontBumpAvg = (v.wheelTravel[0] + v.wheelTravel[1]) * 0.5;
  const rearBumpAvg = (v.wheelTravel[2] + v.wheelTravel[3]) * 0.5;
  const leftBumpAvg = (v.wheelTravel[0] + v.wheelTravel[2]) * 0.5;
  const rightBumpAvg = (v.wheelTravel[1] + v.wheelTravel[3]) * 0.5;
  const bumpPitchKick = (rearBumpAvg - frontBumpAvg) * 0.22;
  const bumpRollKick = (rightBumpAvg - leftBumpAvg) * 0.18;

  const targetPitch =
    (input.brake ? 0.044 : v.nitroActive ? -0.048 : input.accelerate ? -0.026 : 0) +
    bumpPitchKick;
  const targetRoll = -steerInput * Math.min(1, speedAbs / 24) * 0.058 + bumpRollKick;
  v.chassisPitch += (targetPitch - v.chassisPitch) * Math.min(1, dt * 11);
  v.chassisRoll += (targetRoll - v.chassisRoll) * Math.min(1, dt * 11);

  // Drift / skid intensity
  const lateralSlip = Math.abs(lateralVel);
  const drifting = (input.handbrake && speedAbs > 9) || lateralSlip > 5.2;
  v.drifting = drifting;
  const skidIntensity = drifting
    ? Math.min(1, Math.max(lateralSlip / 14, input.handbrake ? 0.65 : 0))
    : 0;

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

export function clampVehicleToCircuitBarrier(
  v: VehicleState,
  circuit: CityCircuit,
  projInput?: TrackProjection,
): { wallImpact: number; proj: TrackProjection } {
  const proj = projInput ?? circuit.getClosestSample(v.x, v.y, v.z, v.trackSampleIndex);
  v.trackSampleIndex = proj.sample.index;
  v.trackDistance = proj.sample.distance;

  const fwdX = Math.sin(v.heading);
  const fwdZ = Math.cos(v.heading);
  const rightX = -Math.cos(v.heading);
  const rightZ = Math.sin(v.heading);

  const lateralExtent =
    Math.abs(fwdX * proj.sample.right.x + fwdZ * proj.sample.right.z) * CAR_HALF_LENGTH +
    Math.abs(rightX * proj.sample.right.x + rightZ * proj.sample.right.z) * CAR_HALF_WIDTH;

  const safeHalfWidth = Math.max(1.2, circuit.barrierHalfWidth - lateralExtent - BARRIER_MARGIN);
  let lat = proj.lateralOffset;
  let wallImpact = 0;

  if (Math.abs(lat) > safeHalfWidth) {
    const sign = Math.sign(lat);
    const excess = Math.abs(lat) - safeHalfWidth;
    v.x -= proj.sample.right.x * sign * excess;
    v.z -= proj.sample.right.z * sign * excess;
    lat = sign * safeHalfWidth;

    const outwardVel = v.vx * (proj.sample.right.x * sign) + v.vz * (proj.sample.right.z * sign);
    if (outwardVel > 0) {
      wallImpact = Math.min(1, outwardVel / 18);
      v.vx -= proj.sample.right.x * sign * outwardVel * 1.32;
      v.vz -= proj.sample.right.z * sign * outwardVel * 1.32;
      v.vx *= 0.86;
      v.vz *= 0.86;
    }

    // Smoothly deflect nose back toward track direction if angled into barrier
    const noseOutwardDot = fwdX * (proj.sample.right.x * sign) + fwdZ * (proj.sample.right.z * sign);
    if (noseOutwardDot > 0.04) {
      const trackTanYaw = Math.atan2(proj.sample.tangent.x, proj.sample.tangent.z);
      const fwdDotTan = fwdX * proj.sample.tangent.x + fwdZ * proj.sample.tangent.z;
      const targetYaw = fwdDotTan >= 0 ? trackTanYaw : trackTanYaw + Math.PI;
      let yawDiff = targetYaw - v.heading;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      v.heading += Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), noseOutwardDot * 0.24);

      const nfX = Math.sin(v.heading);
      const nfZ = Math.cos(v.heading);
      const nrX = -Math.cos(v.heading);
      const nrZ = Math.sin(v.heading);
      const nextExtent =
        Math.abs(nfX * proj.sample.right.x + nfZ * proj.sample.right.z) * CAR_HALF_LENGTH +
        Math.abs(nrX * proj.sample.right.x + nrZ * proj.sample.right.z) * CAR_HALF_WIDTH;
      const nextSafe = Math.max(1.2, circuit.barrierHalfWidth - nextExtent - BARRIER_MARGIN);
      if (Math.abs(lat) > nextSafe) {
        const fixExcess = Math.abs(lat) - nextSafe;
        v.x -= proj.sample.right.x * sign * fixExcess;
        v.z -= proj.sample.right.z * sign * fixExcess;
        lat = sign * nextSafe;
      }
    }
  }

  v.lateralOffset = lat;
  return { wallImpact, proj };
}

export function resolveVehicleCollisions(vehicles: VehicleState[], circuit?: CityCircuit): number {
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

  // Re-enforce barrier clamping & ground contact so car-to-car bumps never push a car out of bounds or below road
  if (circuit) {
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const { wallImpact, proj } = clampVehicleToCircuitBarrier(v, circuit);
      updateVehicleGroundContact(v, circuit, proj);
      if (v.isPlayer && wallImpact > maxImpact) {
        maxImpact = wallImpact;
      }
      v.speed = v.vx * Math.sin(v.heading) + v.vz * Math.cos(v.heading);
    }
  }

  return maxImpact;
}
