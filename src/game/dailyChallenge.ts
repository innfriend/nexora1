import { formatRaceTime } from './storage';
import { TRACK_LAYOUTS, TrackLayoutConfig } from './trackLayouts';
import { DailyChallengeSnapshot, DailyTaskStatus } from './types';

const DAILY_STORAGE_KEY = 'nexora_street_racer_daily_v1';

interface DailyStorageData {
  lastCompletedDateKey: string | null;
  streakDays: number;
  totalTasksCompleted: number;
  today: {
    dateKey: string;
    completedTaskIds: string[];
    bestLapMs: number | null;
    bestRunMs: number | null;
    attempts: number;
  };
}

export function getTodayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPreviousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function getDayNumberFromKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function getMsUntilNextDay(now = new Date()): number {
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

export function formatCountdownHms(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function roundToHalfSecondMs(rawMs: number): number {
  return Math.round(rawMs / 500) * 500;
}

const DAILY_LAYOUT_IDS = new Set(['metro-loop', 'harbor-sprint', 'apex-switchback']);
const DAILY_ROTATING_LAYOUTS = TRACK_LAYOUTS.filter((l) => DAILY_LAYOUT_IDS.has(l.id));

export function getDailyLayoutForDate(dateKey: string): TrackLayoutConfig {
  const dayNum = getDayNumberFromKey(dateKey);
  const idx =
    ((dayNum % DAILY_ROTATING_LAYOUTS.length) + DAILY_ROTATING_LAYOUTS.length) %
    DAILY_ROTATING_LAYOUTS.length;
  return DAILY_ROTATING_LAYOUTS[idx];
}

function buildDailyTaskTemplates(
  dateKey: string,
  layout: TrackLayoutConfig,
): Array<Omit<DailyTaskStatus, 'completed'>> {
  const dayNum = getDayNumberFromKey(dateKey);
  const fastLapMs = roundToHalfSecondMs((layout.lengthMeters / layout.nominalLapSpeedMs) * 1000);
  const aceLapMs = roundToHalfSecondMs((layout.lengthMeters / layout.aceLapSpeedMs) * 1000);
  const thirdVariant = ((dayNum % 3) + 3) % 3;

  const tasks: Array<Omit<DailyTaskStatus, 'completed'>> = [
    {
      id: `${dateKey}-fast-lap`,
      kind: 'fast-lap',
      title: 'Hot Lap Qualifier',
      description: `Complete any lap under ${formatRaceTime(fastLapMs)}`,
      targetMs: fastLapMs,
    },
    {
      id: `${dateKey}-ace-lap`,
      kind: 'ace-lap',
      title: 'Apex Pro Pace',
      description: `Set a flying lap under ${formatRaceTime(aceLapMs)}`,
      targetMs: aceLapMs,
    },
  ];

  if (thirdVariant === 0) {
    const totalRunMs = roundToHalfSecondMs(fastLapMs * 3 + 2500);
    tasks.push({
      id: `${dateKey}-total-run`,
      kind: 'total-run',
      title: '3-Lap Clock Attack',
      description: `Finish all 3 laps in under ${formatRaceTime(totalRunMs)}`,
      targetMs: totalRunMs,
    });
  } else if (thirdVariant === 1) {
    const sectorSplitMs = roundToHalfSecondMs(aceLapMs * 0.52);
    tasks.push({
      id: `${dateKey}-sector-split`,
      kind: 'sector-split',
      title: 'Sector 1–3 Blitz',
      description: `Reach Checkpoint 3 within ${formatRaceTime(sectorSplitMs)}`,
      targetMs: sectorSplitMs,
    });
  } else {
    const twinLapMs = roundToHalfSecondMs(fastLapMs - 1000);
    tasks.push({
      id: `${dateKey}-double-sub-lap`,
      kind: 'double-sub-lap',
      title: 'Consistent Pace',
      description: `Clock 2 laps under ${formatRaceTime(twinLapMs)} in one run`,
      targetMs: twinLapMs,
    });
  }

  return tasks;
}

function loadRawDailyStorage(dateKey: string): DailyStorageData {
  const prevKey = getPreviousDateKey(dateKey);
  const empty: DailyStorageData = {
    lastCompletedDateKey: null,
    streakDays: 0,
    totalTasksCompleted: 0,
    today: {
      dateKey,
      completedTaskIds: [],
      bestLapMs: null,
      bestRunMs: null,
      attempts: 0,
    },
  };

  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<DailyStorageData>;

    const lastDate = parsed.lastCompletedDateKey ?? null;
    const activeStreak =
      lastDate === dateKey || lastDate === prevKey ? (parsed.streakDays ?? 0) : 0;

    const todayData =
      parsed.today && parsed.today.dateKey === dateKey
        ? {
            dateKey,
            completedTaskIds: Array.isArray(parsed.today.completedTaskIds)
              ? parsed.today.completedTaskIds
              : [],
            bestLapMs: parsed.today.bestLapMs ?? null,
            bestRunMs: parsed.today.bestRunMs ?? null,
            attempts: parsed.today.attempts ?? 0,
          }
        : empty.today;

    return {
      lastCompletedDateKey: lastDate,
      streakDays: activeStreak,
      totalTasksCompleted: parsed.totalTasksCompleted ?? 0,
      today: todayData,
    };
  } catch {
    return empty;
  }
}

function saveRawDailyStorage(data: DailyStorageData): void {
  try {
    window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function getDailyChallengeSnapshot(now = new Date()): DailyChallengeSnapshot {
  const dateKey = getTodayDateKey(now);
  const layout = getDailyLayoutForDate(dateKey);
  const store = loadRawDailyStorage(dateKey);
  const completedSet = new Set(store.today.completedTaskIds);

  const tasks: DailyTaskStatus[] = buildDailyTaskTemplates(dateKey, layout).map((t) => ({
    ...t,
    completed: completedSet.has(t.id),
  }));

  const completedCount = tasks.filter((t) => t.completed).length;

  return {
    dateKey,
    dayNumber: getDayNumberFromKey(dateKey),
    layoutId: layout.id,
    layoutName: layout.name,
    layoutFeature: layout.featureLabel,
    layoutLengthKm: layout.lengthKmLabel,
    tasks,
    bestLapMs: store.today.bestLapMs,
    bestRunMs: store.today.bestRunMs,
    attempts: store.today.attempts,
    completedCount,
    allCompleted: completedCount === tasks.length,
    streakDays: store.streakDays,
    totalTasksCompleted: store.totalTasksCompleted,
  };
}

export function recordDailyAttemptStart(dateKey = getTodayDateKey()): DailyChallengeSnapshot {
  const store = loadRawDailyStorage(dateKey);
  store.today.attempts += 1;
  saveRawDailyStorage(store);
  return getDailyChallengeSnapshot();
}

export function recordDailyProgress(params: {
  dateKey: string;
  completedTaskIds: string[];
  bestLapMs: number | null;
  totalRunMs: number | null;
}): {
  snapshot: DailyChallengeSnapshot;
  newlyCompletedIds: string[];
} {
  const { dateKey, completedTaskIds, bestLapMs, totalRunMs } = params;
  const store = loadRawDailyStorage(dateKey);
  const existingSet = new Set(store.today.completedTaskIds);
  const newlyCompletedIds: string[] = [];

  completedTaskIds.forEach((id) => {
    if (!existingSet.has(id)) {
      existingSet.add(id);
      newlyCompletedIds.push(id);
    }
  });

  if (newlyCompletedIds.length > 0) {
    store.today.completedTaskIds = Array.from(existingSet);
    store.totalTasksCompleted += newlyCompletedIds.length;
    if (store.lastCompletedDateKey !== dateKey) {
      const prevKey = getPreviousDateKey(dateKey);
      store.streakDays = store.lastCompletedDateKey === prevKey ? store.streakDays + 1 : 1;
      store.lastCompletedDateKey = dateKey;
    }
  }

  if (bestLapMs !== null && bestLapMs > 0) {
    if (store.today.bestLapMs === null || bestLapMs < store.today.bestLapMs) {
      store.today.bestLapMs = bestLapMs;
    }
  }

  if (totalRunMs !== null && totalRunMs > 0) {
    if (store.today.bestRunMs === null || totalRunMs < store.today.bestRunMs) {
      store.today.bestRunMs = totalRunMs;
    }
  }

  saveRawDailyStorage(store);
  return {
    snapshot: getDailyChallengeSnapshot(),
    newlyCompletedIds,
  };
}
