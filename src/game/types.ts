export type GameTitle = 'street-racer' | 'highway-rush' | 'drift-king';

export type GameMode = 'circuit' | 'time-trial' | 'free-drive' | 'daily-challenge';

export type TrackLayoutId = 'metro-loop' | 'harbor-sprint' | 'apex-switchback' | 'drift-touge';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type QualityPreset = 'low' | 'medium' | 'high';

export type CameraPreset = 'chase' | 'close' | 'far';

export type TouchControlsMode = 'auto' | 'on' | 'off';

export type GamePhase = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'replay';

export type ReplayCameraMode = 'chase' | 'broadcast' | 'orbit';

export type CarId = 'gt3-r' | 'vortex-rs' | 'spectre-v10' | 'phantom-apex';

export type UpgradeSlot = 'engine' | 'tires' | 'gearbox' | 'nitro';

export type UnderglowId = 'none' | 'orange' | 'cyan' | 'crimson' | 'gold';

export type WingStyleId = 'gt3' | 'drag' | 'twin-track';

export interface ReplayStatus {
  playing: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackSpeed: number;
  cameraMode: ReplayCameraMode;
  recordedInput: InputState;
  speedKmh: number;
  gear: string;
  rpmRatio: number;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  markers: MinimapMarker[];
}

export interface CarLivery {
  id: string;
  name: string;
  bodyHex: string;
  accentHex: string;
  rimHex: string;
  priceCredits: number;
}

export const CAR_LIVERIES: CarLivery[] = [
  {
    id: 'apex-orange',
    name: 'Apex Ember',
    bodyHex: '#E84A1B',
    accentHex: '#1E2430',
    rimHex: '#CBD5E1',
    priceCredits: 0,
  },
  {
    id: 'crimson-gt',
    name: 'Crimson Corsa',
    bodyHex: '#DC2626',
    accentHex: '#18181B',
    rimHex: '#E2E8F0',
    priceCredits: 0,
  },
  {
    id: 'cobalt-pulse',
    name: 'Cobalt Pulse',
    bodyHex: '#2563EB',
    accentHex: '#0F172A',
    rimHex: '#F1F5F9',
    priceCredits: 0,
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    bodyHex: '#1C2029',
    accentHex: '#F59E0B',
    rimHex: '#D97706',
    priceCredits: 0,
  },
  {
    id: 'emerald-spec',
    name: 'Emerald Spec',
    bodyHex: '#059669',
    accentHex: '#0F172A',
    rimHex: '#E2E8F0',
    priceCredits: 450,
  },
  {
    id: 'midnight-violet',
    name: 'Midnight Violet',
    bodyHex: '#6D28D9',
    accentHex: '#111827',
    rimHex: '#38BDF8',
    priceCredits: 600,
  },
  {
    id: 'titanium-frost',
    name: 'Titanium Frost',
    bodyHex: '#94A3B8',
    accentHex: '#0F172A',
    rimHex: '#F97316',
    priceCredits: 750,
  },
  {
    id: 'solar-hyper',
    name: 'Solar Hyper',
    bodyHex: '#F59E0B',
    accentHex: '#111827',
    rimHex: '#0F172A',
    priceCredits: 950,
  },
];

export interface CarSpecDefinition {
  id: CarId;
  name: string;
  category: string;
  tagline: string;
  priceCredits: number;
  defaultColor: string;
  topSpeedMult: number;
  accelMult: number;
  handlingMult: number;
  driftGripMult: number;
  nitroCapacity: number;
  nitroPowerMult: number;
  nitroRefillMult: number;
  displayRatings: {
    speed: number; // 1..100
    accel: number;
    handling: number;
    nitro: number;
  };
}

export interface EffectiveCarSpecs {
  carId: CarId;
  carName: string;
  topSpeedMult: number;
  accelMult: number;
  handlingMult: number;
  driftGripMult: number;
  nitroCapacity: number;
  nitroPowerMult: number;
  nitroRefillMult: number;
  ratings: {
    speed: number;
    accel: number;
    handling: number;
    nitro: number;
  };
}

export interface PlayerProfile {
  credits: number;
  xp: number;
  unlockedCars: CarId[];
  selectedCarId: CarId;
  unlockedLiveries: string[];
  underglowId: UnderglowId;
  wingStyle: WingStyleId;
  upgrades: Record<UpgradeSlot, number>;
  unlockedBadges: string[];
  stats: {
    circuitWins: number;
    perfectLaunches: number;
    nitroTriggers: number;
    slipstreamPasses: number;
    totalDistanceKm: number;
  };
}

export interface RaceEarningsSummary {
  creditsEarned: number;
  xpEarned: number;
  breakdown: Array<{ label: string; credits: number }>;
  newlyUnlockedBadges: string[];
  previousXp: number;
  newXp: number;
  previousRank: string;
  newRank: string;
  leveledUp: boolean;
}

export interface GameSettings {
  quality: QualityPreset;
  soundEnabled: boolean;
  volume: number; // 0 to 1
  cameraPreset: CameraPreset;
  touchControls: TouchControlsMode;
  liveryId: string;
  difficulty: Difficulty;
}

export interface InputState {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
  nitro: boolean;
}

export interface MinimapMarker {
  id: string;
  x: number;
  z: number;
  heading: number;
  isPlayer: boolean;
  color: string;
}

export type DailyTaskKind =
  | 'fast-lap'
  | 'ace-lap'
  | 'sector-split'
  | 'total-run'
  | 'double-sub-lap';

export interface DailyTaskStatus {
  id: string;
  kind: DailyTaskKind;
  title: string;
  description: string;
  targetMs: number;
  completed: boolean;
}

export interface DailyChallengeSnapshot {
  dateKey: string;
  dayNumber: number;
  layoutId: TrackLayoutId;
  layoutName: string;
  layoutFeature: string;
  layoutLengthKm: string;
  tasks: DailyTaskStatus[];
  bestLapMs: number | null;
  bestRunMs: number | null;
  attempts: number;
  completedCount: number;
  allCompleted: boolean;
  streakDays: number;
  totalTasksCompleted: number;
}

export interface HudTelemetry {
  gameTitle: GameTitle;
  speedKmh: number;
  rpmRatio: number; // 0..1
  gear: string; // 'R', 'N', '1'..'6'
  lap: number;
  totalLaps: number;
  checkpointIndex: number;
  totalCheckpoints: number;
  raceTimeMs: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number | null;
  position: number;
  totalRacers: number;
  countdownValue: number; // 3, 2, 1, 0 (GO)
  wrongWay: boolean;
  drifting: boolean;
  bannerText: string | null;
  markers: MinimapMarker[];
  dailyTasks?: DailyTaskStatus[];
  dailyLayoutName?: string;
  // Arcade telemetry (Highway Rush & Drift King)
  score?: number;
  pendingScore?: number;
  comboMultiplier?: number;
  comboTimerRatio?: number;
  nearMissCount?: number;
  distanceKm?: number;
  timeRemainingMs?: number;
  driftZonesHit?: number;
  // Addictive Risk-Reward & Timing telemetry
  nitroRatio: number; // 0..1
  nitroActive: boolean;
  slipstreamActive: boolean;
  oncomingActive?: boolean;
  launchGauge?: number; // 0..1 during countdown
  launchZone?: [number, number];
  splitDeltaMs?: number | null;
  splitDeltaSeq?: number;
  ghostActive?: boolean;
}

export interface RaceStanding {
  id: string;
  name: string;
  isPlayer: boolean;
  position: number;
  finishTimeMs: number | null;
  bestLapMs: number | null;
  color: string;
}

export interface DailyChallengeResultSummary {
  dateKey: string;
  layoutName: string;
  tasks: DailyTaskStatus[];
  newlyCompletedIds: string[];
  streakDays: number;
}

export interface RaceResult {
  gameTitle: GameTitle;
  mode: GameMode;
  difficulty: Difficulty;
  totalTimeMs: number;
  lapTimesMs: number[];
  bestLapMs: number | null;
  previousBestRaceMs: number | null;
  previousBestLapMs: number | null;
  isNewBestRace: boolean;
  isNewBestLap: boolean;
  position: number;
  totalRacers: number;
  standings: RaceStanding[];
  hasReplay: boolean;
  dailySummary?: DailyChallengeResultSummary;
  earnings?: RaceEarningsSummary;
  // Arcade result fields (Highway Rush & Drift King)
  score?: number;
  previousBestScore?: number | null;
  isNewBestScore?: boolean;
  distanceKm?: number;
  nearMissCount?: number;
  maxCombo?: number;
  bestSingleDrift?: number;
  driftZonesHit?: number;
  driftGrade?: 'S' | 'A' | 'B' | 'C';
}

export interface BestRecords {
  bestLapMs: number | null;
  bestTimeTrialMs: number | null;
  bestCircuitEasyMs: number | null;
  bestCircuitNormalMs: number | null;
  bestCircuitHardMs: number | null;
  racesCompleted: number;
  highwayBestScore: number;
  highwayBestDistanceKm: number;
  highwayRuns: number;
  driftBestScore: number;
  driftBestCombo: number;
  driftRuns: number;
}
