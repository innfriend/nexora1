import {
  BADGE_CATALOG,
  CAR_CATALOG,
  DRIVER_RANKS,
  UPGRADE_DEFS,
} from './garageData';
import {
  CAR_LIVERIES,
  CarId,
  Difficulty,
  GameMode,
  GameTitle,
  PlayerProfile,
  RaceEarningsSummary,
  TrackLayoutId,
  UnderglowId,
  UpgradeSlot,
  WingStyleId,
} from './types';

const PROFILE_KEY = 'nexora_player_profile_v1';
const GHOST_KEY_PREFIX = 'nexora_ghost_lap_v1_';

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  credits: 450,
  xp: 0,
  unlockedCars: ['gt3-r'],
  selectedCarId: 'gt3-r',
  unlockedLiveries: ['apex-orange', 'crimson-gt', 'cobalt-pulse', 'obsidian-gold'],
  underglowId: 'none',
  wingStyle: 'gt3',
  upgrades: {
    engine: 0,
    tires: 0,
    gearbox: 0,
    nitro: 0,
  },
  unlockedBadges: [],
  stats: {
    circuitWins: 0,
    perfectLaunches: 0,
    nitroTriggers: 0,
    slipstreamPasses: 0,
    totalDistanceKm: 0,
  },
};

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return cloneProfile(DEFAULT_PLAYER_PROFILE);
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      ...cloneProfile(DEFAULT_PLAYER_PROFILE),
      ...parsed,
      unlockedCars:
        Array.isArray(parsed.unlockedCars) && parsed.unlockedCars.length > 0
          ? parsed.unlockedCars
          : ['gt3-r'],
      unlockedLiveries:
        Array.isArray(parsed.unlockedLiveries) && parsed.unlockedLiveries.length > 0
          ? parsed.unlockedLiveries
          : [...DEFAULT_PLAYER_PROFILE.unlockedLiveries],
      upgrades: {
        ...DEFAULT_PLAYER_PROFILE.upgrades,
        ...(parsed.upgrades ?? {}),
      },
      unlockedBadges: Array.isArray(parsed.unlockedBadges) ? parsed.unlockedBadges : [],
      stats: {
        ...DEFAULT_PLAYER_PROFILE.stats,
        ...(parsed.stats ?? {}),
      },
    };
  } catch {
    return cloneProfile(DEFAULT_PLAYER_PROFILE);
  }
}

function cloneProfile(p: PlayerProfile): PlayerProfile {
  return {
    ...p,
    unlockedCars: [...p.unlockedCars],
    unlockedLiveries: [...p.unlockedLiveries],
    upgrades: { ...p.upgrades },
    unlockedBadges: [...p.unlockedBadges],
    stats: { ...p.stats },
  };
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function getDriverRankInfo(xp: number): {
  name: string;
  levelIndex: number;
  nextRankName: string | null;
  currentMinXp: number;
  nextMinXp: number;
  progressRatio: number;
} {
  let idx = 0;
  for (let i = 0; i < DRIVER_RANKS.length; i++) {
    if (xp >= DRIVER_RANKS[i].minXp) {
      idx = i;
    }
  }
  const current = DRIVER_RANKS[idx];
  const next = DRIVER_RANKS[idx + 1] ?? null;
  if (!next) {
    return {
      name: current.name,
      levelIndex: idx + 1,
      nextRankName: null,
      currentMinXp: current.minXp,
      nextMinXp: current.minXp,
      progressRatio: 1,
    };
  }
  const span = Math.max(1, next.minXp - current.minXp);
  return {
    name: current.name,
    levelIndex: idx + 1,
    nextRankName: next.name,
    currentMinXp: current.minXp,
    nextMinXp: next.minXp,
    progressRatio: Math.max(0, Math.min(1, (xp - current.minXp) / span)),
  };
}

export function buyOrSelectCar(carId: CarId): { ok: boolean; profile: PlayerProfile } {
  const profile = loadPlayerProfile();
  if (profile.unlockedCars.includes(carId)) {
    profile.selectedCarId = carId;
    savePlayerProfile(profile);
    return { ok: true, profile };
  }
  const spec = CAR_CATALOG.find((c) => c.id === carId);
  if (!spec || profile.credits < spec.priceCredits) {
    return { ok: false, profile };
  }
  profile.credits -= spec.priceCredits;
  profile.unlockedCars.push(carId);
  profile.selectedCarId = carId;
  savePlayerProfile(profile);
  return { ok: true, profile };
}

export function upgradeGaragePart(slot: UpgradeSlot): { ok: boolean; profile: PlayerProfile } {
  const profile = loadPlayerProfile();
  const currentLv = profile.upgrades[slot] ?? 0;
  if (currentLv >= 3) return { ok: false, profile };
  const def = UPGRADE_DEFS.find((u) => u.slot === slot);
  if (!def) return { ok: false, profile };
  const cost = def.stageCosts[currentLv];
  if (profile.credits < cost) return { ok: false, profile };

  profile.credits -= cost;
  profile.upgrades[slot] = currentLv + 1;
  savePlayerProfile(profile);
  return { ok: true, profile };
}

export function buyOrEquipLivery(liveryId: string): { ok: boolean; profile: PlayerProfile } {
  const profile = loadPlayerProfile();
  if (profile.unlockedLiveries.includes(liveryId)) {
    return { ok: true, profile };
  }
  const livery = CAR_LIVERIES.find((l) => l.id === liveryId);
  if (!livery || profile.credits < livery.priceCredits) {
    return { ok: false, profile };
  }
  profile.credits -= livery.priceCredits;
  profile.unlockedLiveries.push(liveryId);
  savePlayerProfile(profile);
  return { ok: true, profile };
}

export function setProfileUnderglow(underglowId: UnderglowId): PlayerProfile {
  const profile = loadPlayerProfile();
  profile.underglowId = underglowId;
  savePlayerProfile(profile);
  return profile;
}

export function setProfileWingStyle(wingStyle: WingStyleId): PlayerProfile {
  const profile = loadPlayerProfile();
  profile.wingStyle = wingStyle;
  savePlayerProfile(profile);
  return profile;
}

export interface AwardRunInput {
  gameTitle: GameTitle;
  mode: GameMode;
  difficulty: Difficulty;
  position: number;
  isNewBestRace: boolean;
  isNewBestLap: boolean;
  isNewBestScore: boolean;
  score: number;
  distanceKm: number;
  nearMissCount: number;
  perfectLaunch: boolean;
  nitroActivationsInRun: number;
  slipstreamPassesInRun: number;
  dailyTasksClearedInRun: number;
  allDailyTasksCleared: boolean;
}

export function awardRunProgression(input: AwardRunInput): {
  profile: PlayerProfile;
  earnings: RaceEarningsSummary;
} {
  const profile = loadPlayerProfile();
  const previousXp = profile.xp;
  const previousRank = getDriverRankInfo(previousXp).name;

  const breakdown: Array<{ label: string; credits: number }> = [];
  let creditsEarned = 0;
  let xpEarned = 0;

  if (input.gameTitle === 'street-racer') {
    const base = 180;
    creditsEarned += base;
    xpEarned += 90;
    breakdown.push({ label: 'Race Completion', credits: base });

    if (input.mode === 'circuit') {
      const diffMult = input.difficulty === 'hard' ? 1.4 : input.difficulty === 'normal' ? 1.15 : 1.0;
      const posBonusRaw =
        input.position === 1 ? 260 : input.position === 2 ? 160 : input.position === 3 ? 95 : 40;
      const posBonus = Math.round(posBonusRaw * diffMult);
      creditsEarned += posBonus;
      xpEarned += input.position === 1 ? 140 : 70;
      breakdown.push({ label: `P${input.position} Finish (${input.difficulty})`, credits: posBonus });
      if (input.position === 1) {
        profile.stats.circuitWins += 1;
      }
    }

    if (input.isNewBestRace || input.isNewBestLap) {
      const recBonus = 120;
      creditsEarned += recBonus;
      xpEarned += 65;
      breakdown.push({ label: 'New Track Record', credits: recBonus });
    }

    if (input.dailyTasksClearedInRun > 0) {
      const dailyBonus = input.dailyTasksClearedInRun * 220;
      creditsEarned += dailyBonus;
      xpEarned += input.dailyTasksClearedInRun * 110;
      breakdown.push({
        label: `Daily Tasks (${input.dailyTasksClearedInRun})`,
        credits: dailyBonus,
      });
    }
  } else if (input.gameTitle === 'highway-rush') {
    const scorePay = Math.max(80, Math.min(900, Math.round(input.score / 28)));
    creditsEarned += scorePay;
    xpEarned += Math.max(70, Math.round(scorePay * 0.65));
    breakdown.push({ label: 'Expressway Score Purse', credits: scorePay });

    if (input.nearMissCount > 0) {
      const passBonus = Math.min(450, input.nearMissCount * 15);
      creditsEarned += passBonus;
      xpEarned += input.nearMissCount * 6;
      breakdown.push({ label: `Near Misses (${input.nearMissCount})`, credits: passBonus });
    }
    if (input.isNewBestScore) {
      creditsEarned += 150;
      xpEarned += 75;
      breakdown.push({ label: 'New High Score', credits: 150 });
    }
  } else {
    const driftPay = Math.max(90, Math.min(850, Math.round(input.score / 32)));
    creditsEarned += driftPay;
    xpEarned += Math.max(75, Math.round(driftPay * 0.65));
    breakdown.push({ label: 'Drift Score Purse', credits: driftPay });

    if (input.isNewBestScore) {
      creditsEarned += 160;
      xpEarned += 80;
      breakdown.push({ label: 'New Drift Record', credits: 160 });
    }
  }

  if (input.perfectLaunch) {
    creditsEarned += 100;
    xpEarned += 45;
    profile.stats.perfectLaunches += 1;
    breakdown.push({ label: 'Perfect Launch Start', credits: 100 });
  }

  if (input.slipstreamPassesInRun > 0) {
    const draftBonus = Math.min(200, input.slipstreamPassesInRun * 35);
    creditsEarned += draftBonus;
    xpEarned += input.slipstreamPassesInRun * 15;
    profile.stats.slipstreamPasses += input.slipstreamPassesInRun;
    breakdown.push({ label: 'Slipstream Drafting', credits: draftBonus });
  }

  profile.stats.nitroTriggers += input.nitroActivationsInRun;
  profile.stats.totalDistanceKm = Number(
    (profile.stats.totalDistanceKm + Math.max(0, input.distanceKm)).toFixed(2),
  );

  // Check Milestone Badges
  const newlyUnlockedBadges: string[] = [];
  const tryUnlock = (badgeId: string, condition: boolean) => {
    if (!condition || profile.unlockedBadges.includes(badgeId)) return;
    const badge = BADGE_CATALOG.find((b) => b.id === badgeId);
    if (!badge) return;
    profile.unlockedBadges.push(badgeId);
    newlyUnlockedBadges.push(badgeId);
    creditsEarned += badge.rewardCredits;
    xpEarned += 120;
    breakdown.push({ label: `Badge: ${badge.name}`, credits: badge.rewardCredits });
  };

  tryUnlock('first-win', input.gameTitle === 'street-racer' && input.mode === 'circuit' && input.position === 1);
  tryUnlock('perfect-launch', profile.stats.perfectLaunches >= 1);
  tryUnlock('untouchable-highway', input.gameTitle === 'highway-rush' && input.distanceKm >= 2.0);
  tryUnlock('drift-master', input.gameTitle === 'drift-king' && input.score >= 15000);
  tryUnlock('nitro-addict', profile.stats.nitroTriggers >= 15);
  tryUnlock('daily-sweep', input.allDailyTasksCleared);

  profile.credits += creditsEarned;
  profile.xp += xpEarned;
  savePlayerProfile(profile);

  const newRank = getDriverRankInfo(profile.xp).name;

  return {
    profile,
    earnings: {
      creditsEarned,
      xpEarned,
      breakdown,
      newlyUnlockedBadges,
      previousXp,
      newXp: profile.xp,
      previousRank,
      newRank,
      leveledUp: newRank !== previousRank,
    },
  };
}

// ============================================================================
// Live Ghost Lap Recording & Sampling (Time Trial & Daily Challenge)
// ============================================================================

export interface GhostSample {
  t: number; // lap elapsed ms
  x: number;
  y: number;
  z: number;
  h: number; // heading
  s: number; // steerVisual
  w: number; // wheelSpinAngle
}

export interface LapGhostData {
  layoutId: TrackLayoutId;
  lapTimeMs: number;
  checkpointSplitsMs: number[]; // index 1..N-1 elapsed ms at checkpoint
  samples: GhostSample[];
}

export function loadGhostForLayout(layoutId: TrackLayoutId): LapGhostData | null {
  try {
    const raw = window.localStorage.getItem(`${GHOST_KEY_PREFIX}${layoutId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LapGhostData;
    if (!parsed || !Array.isArray(parsed.samples) || parsed.samples.length < 2) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveBestGhostForLayout(ghost: LapGhostData): boolean {
  try {
    const existing = loadGhostForLayout(ghost.layoutId);
    if (existing && existing.lapTimeMs <= ghost.lapTimeMs) {
      return false;
    }
    window.localStorage.setItem(`${GHOST_KEY_PREFIX}${ghost.layoutId}`, JSON.stringify(ghost));
    return true;
  } catch {
    return false;
  }
}

export function sampleGhostAtTime(
  ghost: LapGhostData,
  lapElapsedMs: number,
): { x: number; y: number; z: number; heading: number; steerVisual: number; wheelSpinAngle: number } | null {
  const samples = ghost.samples;
  if (samples.length === 0) return null;
  if (lapElapsedMs <= samples[0].t) {
    const s = samples[0];
    return { x: s.x, y: s.y, z: s.z, heading: s.h, steerVisual: s.s, wheelSpinAngle: s.w };
  }
  const last = samples[samples.length - 1];
  if (lapElapsedMs >= last.t) {
    return { x: last.x, y: last.y, z: last.z, heading: last.h, steerVisual: last.s, wheelSpinAngle: last.w };
  }

  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= lapElapsedMs) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = Math.max(1, b.t - a.t);
  const alpha = Math.max(0, Math.min(1, (lapElapsedMs - a.t) / span));

  let diffH = b.h - a.h;
  while (diffH > Math.PI) diffH -= Math.PI * 2;
  while (diffH < -Math.PI) diffH += Math.PI * 2;

  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
    heading: a.h + diffH * alpha,
    steerVisual: a.s + (b.s - a.s) * alpha,
    wheelSpinAngle: a.w + (b.w - a.w) * alpha,
  };
}
