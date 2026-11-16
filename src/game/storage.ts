import { BestRecords, Difficulty, GameMode, GameSettings } from './types';

const SETTINGS_KEY = 'nexora_street_racer_settings_v1';
const RECORDS_KEY = 'nexora_street_racer_records_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  soundEnabled: true,
  volume: 0.75,
  cameraPreset: 'chase',
  touchControls: 'auto',
  liveryId: 'apex-orange',
  difficulty: 'normal',
};

export const DEFAULT_RECORDS: BestRecords = {
  bestLapMs: null,
  bestTimeTrialMs: null,
  bestCircuitEasyMs: null,
  bestCircuitNormalMs: null,
  bestCircuitHardMs: null,
  racesCompleted: 0,
  highwayBestScore: 0,
  highwayBestDistanceKm: 0,
  highwayRuns: 0,
  driftBestScore: 0,
  driftBestCombo: 0,
  driftRuns: 0,
};

export function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

export function loadRecords(): BestRecords {
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...DEFAULT_RECORDS };
    const parsed = JSON.parse(raw) as Partial<BestRecords>;
    return {
      ...DEFAULT_RECORDS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_RECORDS };
  }
}

export function getBestRaceKey(mode: GameMode, difficulty: Difficulty): keyof BestRecords | null {
  if (mode === 'time-trial') return 'bestTimeTrialMs';
  if (mode === 'circuit') {
    if (difficulty === 'easy') return 'bestCircuitEasyMs';
    if (difficulty === 'normal') return 'bestCircuitNormalMs';
    return 'bestCircuitHardMs';
  }
  return null;
}

export function recordRaceCompletion(
  mode: GameMode,
  difficulty: Difficulty,
  totalTimeMs: number,
  bestLapInRaceMs: number | null,
): {
  records: BestRecords;
  previousBestRaceMs: number | null;
  previousBestLapMs: number | null;
  isNewBestRace: boolean;
  isNewBestLap: boolean;
} {
  const current = loadRecords();
  const raceKey = getBestRaceKey(mode, difficulty);
  const previousBestRaceMs = raceKey ? (current[raceKey] as number | null) : null;
  const previousBestLapMs = current.bestLapMs;

  let isNewBestRace = false;
  let isNewBestLap = false;

  const updated: BestRecords = {
    ...current,
    racesCompleted: current.racesCompleted + 1,
  };

  if (raceKey && totalTimeMs > 0) {
    if (previousBestRaceMs === null || totalTimeMs < previousBestRaceMs) {
      (updated[raceKey] as number | null) = totalTimeMs;
      isNewBestRace = true;
    }
  }

  if (bestLapInRaceMs !== null && bestLapInRaceMs > 0 && mode !== 'daily-challenge') {
    if (previousBestLapMs === null || bestLapInRaceMs < previousBestLapMs) {
      updated.bestLapMs = bestLapInRaceMs;
      isNewBestLap = true;
    }
  }

  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  return {
    records: updated,
    previousBestRaceMs,
    previousBestLapMs,
    isNewBestRace,
    isNewBestLap,
  };
}

export function recordHighwayRushRun(
  score: number,
  distanceKm: number,
): {
  records: BestRecords;
  previousBestScore: number;
  isNewBestScore: boolean;
} {
  const current = loadRecords();
  const previousBestScore = current.highwayBestScore;
  const isNewBestScore = score > previousBestScore;
  const updated: BestRecords = {
    ...current,
    highwayBestScore: Math.max(previousBestScore, Math.round(score)),
    highwayBestDistanceKm: Math.max(current.highwayBestDistanceKm, Number(distanceKm.toFixed(2))),
    highwayRuns: current.highwayRuns + 1,
  };
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return { records: updated, previousBestScore, isNewBestScore };
}

export function recordDriftKingRun(
  score: number,
  maxCombo: number,
): {
  records: BestRecords;
  previousBestScore: number;
  isNewBestScore: boolean;
} {
  const current = loadRecords();
  const previousBestScore = current.driftBestScore;
  const isNewBestScore = score > previousBestScore;
  const updated: BestRecords = {
    ...current,
    driftBestScore: Math.max(previousBestScore, Math.round(score)),
    driftBestCombo: Math.max(current.driftBestCombo, maxCombo),
    driftRuns: current.driftRuns + 1,
  };
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return { records: updated, previousBestScore, isNewBestScore };
}

export function formatRaceTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '--:--.--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
