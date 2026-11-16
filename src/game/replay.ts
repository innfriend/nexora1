import { VehicleState } from './physics';
import { Difficulty, GameMode, InputState } from './types';

export interface ReplayVehicleSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  steerVisual: number;
  wheelSpinAngle: number;
  chassisPitch: number;
  chassisRoll: number;
  roadPitch: number;
  braking: boolean;
  drifting: boolean;
}

export interface ReplayFrame {
  timeMs: number;
  playerInput: InputState;
  playerLap: number;
  playerPosition: number;
  vehicles: ReplayVehicleSnapshot[];
}

export interface ReplayRecording {
  mode: GameMode;
  difficulty: Difficulty;
  totalLaps: number;
  durationMs: number;
  frames: ReplayFrame[];
}

const SAMPLE_INTERVAL_MS = 33; // ~30 Hz keyframes, interpolated smoothly at 60 FPS
const MAX_FRAMES = 18000; // Up to 10 minutes of racing

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private lastSampleTimeMs = -Infinity;
  private mode: GameMode = 'circuit';
  private difficulty: Difficulty = 'normal';
  private totalLaps = 3;

  public reset(mode: GameMode, difficulty: Difficulty, totalLaps: number): void {
    this.frames = [];
    this.lastSampleTimeMs = -Infinity;
    this.mode = mode;
    this.difficulty = difficulty;
    this.totalLaps = totalLaps;
  }

  public recordFrame(
    timeMs: number,
    playerInput: InputState,
    vehicles: VehicleState[],
    playerLap: number,
    playerPosition: number,
    force = false,
  ): void {
    if (this.frames.length >= MAX_FRAMES) return;
    if (!force && timeMs - this.lastSampleTimeMs < SAMPLE_INTERVAL_MS) return;

    this.lastSampleTimeMs = timeMs;
    this.frames.push({
      timeMs,
      playerInput: {
        accelerate: playerInput.accelerate,
        brake: playerInput.brake,
        steerLeft: playerInput.steerLeft,
        steerRight: playerInput.steerRight,
        handbrake: playerInput.handbrake,
        nitro: Boolean(playerInput.nitro),
      },
      playerLap,
      playerPosition,
      vehicles: vehicles.map((v) => ({
        id: v.id,
        x: v.x,
        y: v.y,
        z: v.z,
        heading: v.heading,
        speed: v.speed,
        steerVisual: v.steerVisual,
        wheelSpinAngle: v.wheelSpinAngle,
        chassisPitch: v.chassisPitch,
        chassisRoll: v.chassisRoll,
        roadPitch: v.roadPitch,
        braking: v.braking,
        drifting: v.drifting,
      })),
    });
  }

  public getFrameCount(): number {
    return this.frames.length;
  }

  public buildRecording(): ReplayRecording | null {
    if (this.frames.length < 2) return null;
    const durationMs = this.frames[this.frames.length - 1].timeMs;
    return {
      mode: this.mode,
      difficulty: this.difficulty,
      totalLaps: this.totalLaps,
      durationMs,
      frames: this.frames.slice(),
    };
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export interface SampledReplayFrame {
  timeMs: number;
  playerInput: InputState;
  playerLap: number;
  playerPosition: number;
  vehicles: ReplayVehicleSnapshot[];
}

export function sampleReplayAtTime(
  recording: ReplayRecording,
  targetTimeMs: number,
): SampledReplayFrame | null {
  const frames = recording.frames;
  if (frames.length === 0) return null;

  const clampedTime = Math.max(0, Math.min(recording.durationMs, targetTimeMs));
  if (frames.length === 1 || clampedTime <= frames[0].timeMs) {
    return frames[0];
  }
  const last = frames[frames.length - 1];
  if (clampedTime >= last.timeMs) {
    return last;
  }

  // Binary search for frame index <= clampedTime
  let lo = 0;
  let hi = frames.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timeMs <= clampedTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = frames[lo];
  const b = frames[hi];
  const span = Math.max(0.001, b.timeMs - a.timeMs);
  const alpha = Math.max(0, Math.min(1, (clampedTime - a.timeMs) / span));

  const vehicles: ReplayVehicleSnapshot[] = a.vehicles.map((va, idx) => {
    const vb = b.vehicles[idx];
    if (!vb || vb.id !== va.id) return va;
    return {
      id: va.id,
      x: lerp(va.x, vb.x, alpha),
      y: lerp(va.y, vb.y, alpha),
      z: lerp(va.z, vb.z, alpha),
      heading: lerpAngle(va.heading, vb.heading, alpha),
      speed: lerp(va.speed, vb.speed, alpha),
      steerVisual: lerp(va.steerVisual, vb.steerVisual, alpha),
      wheelSpinAngle: lerp(va.wheelSpinAngle, vb.wheelSpinAngle, alpha),
      chassisPitch: lerp(va.chassisPitch, vb.chassisPitch, alpha),
      chassisRoll: lerp(va.chassisRoll, vb.chassisRoll, alpha),
      roadPitch: lerp(va.roadPitch, vb.roadPitch, alpha),
      braking: va.braking,
      drifting: va.drifting,
    };
  });

  return {
    timeMs: clampedTime,
    playerInput: a.playerInput,
    playerLap: a.playerLap,
    playerPosition: a.playerPosition,
    vehicles,
  };
}
