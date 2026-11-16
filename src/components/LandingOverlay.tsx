import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Car,
  CheckCircle2,
  ChevronRight,
  Circle,
  Flame,
  Gauge,
  Lock,
  Play,
  ShieldAlert,
  Sliders,
  Trophy,
  Wrench,
  Zap,
} from 'lucide-react';
import { formatCountdownHms, getMsUntilNextDay } from '../game/dailyChallenge';
import { getCarDefinition } from '../game/garageData';
import { getDriverRankInfo } from '../game/progression';
import { formatRaceTime, getBestRaceKey } from '../game/storage';
import { getMinimapPreviewForLayout } from '../game/trackLayouts';
import {
  BestRecords,
  CAR_LIVERIES,
  DailyChallengeSnapshot,
  Difficulty,
  GameMode,
  GameSettings,
  GameTitle,
  PlayerProfile,
} from '../game/types';
import { NexoraLogo } from './NexoraLogo';

interface LandingOverlayProps {
  selectedGame: GameTitle;
  selectedMode: GameMode;
  settings: GameSettings;
  records: BestRecords;
  profile: PlayerProfile;
  dailyChallenge: DailyChallengeSnapshot;
  webglError: string | null;
  fallbackImageSrc: string;
  onSelectGame: (game: GameTitle) => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onSelectLivery: (liveryId: string) => void;
  onStartRace: () => void;
  onOpenGarage: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

const GAME_CATALOG: Array<{
  id: GameTitle;
  name: string;
  shortDesc: string;
  headline: string;
  tagline: string;
  description: string;
  cta: string;
}> = [
  {
    id: 'street-racer',
    name: 'Street Racer',
    shortDesc: 'Circuits & Daily Tasks',
    headline: 'NEXORA STREET RACER',
    tagline: 'OWN THE ROAD.',
    description:
      'Carve through elevated city overpasses, tight underpasses, and sweeping twilight corners in a responsive 3D arcade street racer.',
    cta: 'START RACE',
  },
  {
    id: 'highway-rush',
    name: 'Highway Rush',
    shortDesc: 'Traffic Near-Miss',
    headline: 'NEXORA HIGHWAY RUSH',
    tagline: 'WEAVE THE TRAFFIC.',
    description:
      'Thread four lanes of dense expressway traffic at 280+ km/h. Chain razor-close overtakes up to 10x multiplier—one wreck ends your run.',
    cta: 'START HIGHWAY RUSH',
  },
  {
    id: 'drift-king',
    name: 'Drift King',
    shortDesc: '90s Touge Score Attack',
    headline: 'NEXORA DRIFT KING',
    tagline: 'HOLD THE SLIDE.',
    description:
      'Throw your GT3 sideways down the hairpin touge on a 90-second clock. Clip glowing apex gates to boost multipliers—stay off the walls.',
    cta: 'START DRIFT KING',
  },
];

const MODE_OPTIONS: Array<{
  id: GameMode;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'circuit',
    title: 'Circuit Race',
    subtitle: '3 laps vs 3 AI street rivals',
  },
  {
    id: 'time-trial',
    title: 'Time Trial',
    subtitle: '3-lap solo clock attack',
  },
  {
    id: 'daily-challenge',
    title: 'Daily Challenge',
    subtitle: 'Rotating track & time tasks',
  },
  {
    id: 'free-drive',
    title: 'Free Drive',
    subtitle: 'Open practice around the loop',
  },
];

export const LandingOverlay: React.FC<LandingOverlayProps> = ({
  selectedGame,
  selectedMode,
  settings,
  records,
  profile,
  dailyChallenge,
  webglError,
  fallbackImageSrc,
  onSelectGame,
  onSelectMode,
  onSelectDifficulty,
  onSelectLivery,
  onStartRace,
  onOpenGarage,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenAbout,
}) => {
  const bestRaceKey = getBestRaceKey(selectedMode, settings.difficulty);
  const bestRaceTime = bestRaceKey ? (records[bestRaceKey] as number | null) : null;
  const activeGameMeta =
    GAME_CATALOG.find((g) => g.id === selectedGame) ?? GAME_CATALOG[0];
  const driverRank = getDriverRankInfo(profile.xp);
  const activeCar = getCarDefinition(profile.selectedCarId);

  const [resetCountdown, setResetCountdown] = useState(() =>
    formatCountdownHms(getMsUntilNextDay()),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setResetCountdown(formatCountdownHms(getMsUntilNextDay()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const previewLayoutId =
    selectedGame === 'drift-king' ? 'drift-touge' : dailyChallenge.layoutId;

  const trackPreviewPathD = useMemo(() => {
    const { points, bounds } = getMinimapPreviewForLayout(previewLayoutId);
    if (points.length === 0) return '';
    const pad = 10;
    const w = Math.max(1, bounds.maxX - bounds.minX);
    const h = Math.max(1, bounds.maxZ - bounds.minZ);
    const scale = Math.min((96 - pad * 2) / w, (68 - pad * 2) / h);
    const offX = (96 - w * scale) * 0.5;
    const offY = (68 - h * scale) * 0.5;
    return (
      points
        .map((p, idx) => {
          const x = offX + (p.x - bounds.minX) * scale;
          const y = offY + (p.z - bounds.minZ) * scale;
          return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ') + ' Z'
    );
  }, [previewLayoutId]);

  const primaryCtaLabel =
    selectedGame === 'street-racer' && selectedMode === 'daily-challenge'
      ? 'START DAILY CHALLENGE'
      : activeGameMeta.cta;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between overflow-y-auto">
      {/* Fallback Poster Backdrop if WebGL fails */}
      {webglError && (
        <img
          src={fallbackImageSrc}
          alt="Nexora Games 3D racing"
          referrerPolicy="no-referrer"
          className="fixed inset-0 w-full h-full object-cover -z-10"
        />
      )}

      {/* Measured Dark Gradient Scrim for 4.5:1+ Legibility over live 3D scene */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-r from-[#090B10]/92 via-[#090B10]/68 to-[#090B10]/35 -z-0"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#090B10]/90 via-transparent to-[#090B10]/70 -z-0"
      />

      {/* Top Bar Contract: [Brand wordmark] — [4 concise single-line links] — [1 primary CTA] */}
      <header className="relative z-10 flex items-center justify-between gap-6 px-5 py-4 sm:px-10 sm:py-5 border-b border-white/10 bg-[#090B10]/75">
        <NexoraLogo />

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#game-select"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('game-select')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Arcade Games
          </a>
          <button
            type="button"
            onClick={onOpenGarage}
            className="hover:text-amber-300 text-amber-400 font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Garage
          </button>
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Settings
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onStartRace}
            disabled={Boolean(webglError)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>PLAY NOW</span>
          </button>
        </div>
      </header>

      {/* Main Focal Content */}
      <main className="relative z-10 flex-1 flex items-center px-5 py-5 sm:px-10">
        <div className="w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Left Hero & Multi-Game Launch Panel */}
          <div className="lg:col-span-7 space-y-5">
            {/* 3-Game Switcher */}
            <div id="game-select" className="grid grid-cols-3 gap-2 max-w-xl">
              {GAME_CATALOG.map((g) => {
                const active = selectedGame === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onSelectGame(g.id)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-orange-600 border-orange-400 text-white'
                        : 'bg-[#11151E]/90 border-white/12 text-slate-300 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-display font-bold text-xs sm:text-sm whitespace-nowrap">
                      {g.id === 'street-racer' && <Car className="w-3.5 h-3.5 shrink-0" />}
                      {g.id === 'highway-rush' && <Zap className="w-3.5 h-3.5 shrink-0" />}
                      {g.id === 'drift-king' && <Flame className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{g.name}</span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 truncate ${
                        active ? 'text-orange-100' : 'text-slate-400'
                      }`}
                    >
                      {g.shortDesc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs font-medium text-orange-400 tracking-wide">
                <span>Nexora Games Original</span>
                <span aria-hidden="true">·</span>
                <span>
                  {selectedGame === 'highway-rush'
                    ? '4-Lane Urban Expressway'
                    : selectedGame === 'drift-king'
                      ? 'Nexora Drift Touge'
                      : selectedMode === 'daily-challenge'
                        ? dailyChallenge.layoutName
                        : 'Metropolitan City Circuit'}
                </span>
              </div>

              <h1
                className="font-display font-bold text-4xl sm:text-5xl lg:text-[3.85rem] text-white tracking-tight leading-[1.02]"
                style={{ textWrap: 'balance' }}
              >
                {activeGameMeta.headline}
              </h1>

              <p className="text-lg sm:text-xl font-semibold text-orange-400 tracking-wide">
                {activeGameMeta.tagline}
              </p>

              <p className="max-w-xl text-sm sm:text-base text-slate-300 leading-relaxed">
                {activeGameMeta.description}
              </p>
            </div>

            {webglError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/85 border border-red-500/50 text-sm text-red-100 max-w-xl">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">3D WebGL Unavailable</div>
                  <div className="text-red-200/90 mt-0.5">
                    {webglError} Enable hardware acceleration or try a modern browser to launch the 3D engine.
                  </div>
                </div>
              </div>
            )}

            {/* Mode Selector (Street Racer) or Quick Briefing (Highway Rush / Drift King) */}
            <div className="space-y-3 max-w-xl">
              {selectedGame === 'street-racer' ? (
                <>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Select Race Mode
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {MODE_OPTIONS.map((m) => {
                      const active = selectedMode === m.id;
                      const isDaily = m.id === 'daily-challenge';
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectMode(m.id)}
                          className={`text-left px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                            active
                              ? 'bg-orange-600/20 border-orange-500 text-white'
                              : 'bg-[#11151E]/90 border-white/12 text-slate-300 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-display font-bold text-sm sm:text-base whitespace-nowrap">
                              {m.title}
                            </span>
                            {isDaily && (
                              <span className="font-mono-tabular text-[11px] font-semibold text-orange-400">
                                {dailyChallenge.completedCount}/{dailyChallenge.tasks.length}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {isDaily
                              ? `${dailyChallenge.layoutName} · ${dailyChallenge.layoutLengthKm}`
                              : m.subtitle}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {selectedGame === 'highway-rush' ? (
                    <>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Near Misses</div>
                        <div className="font-display font-bold text-sm text-white mt-0.5">
                          +250 × Combo
                        </div>
                      </div>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Max Multiplier</div>
                        <div className="font-display font-bold text-sm text-orange-400 mt-0.5">
                          Up to 10x
                        </div>
                      </div>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Rule</div>
                        <div className="font-display font-bold text-sm text-white mt-0.5">
                          1 Crash Ends Run
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Time Limit</div>
                        <div className="font-display font-bold text-sm text-white mt-0.5">
                          90 Seconds
                        </div>
                      </div>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Apex Gates</div>
                        <div className="font-display font-bold text-sm text-orange-400 mt-0.5">
                          +450 &amp; +1x
                        </div>
                      </div>
                      <div className="bg-[#11151E]/90 border border-white/12 rounded-xl p-3">
                        <div className="text-[11px] text-slate-400">Risk</div>
                        <div className="font-display font-bold text-sm text-white mt-0.5">
                          Walls Wipe Drift
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* AI Difficulty (Circuit Race) & Livery Picker (All 3 Games) */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                {selectedGame === 'street-racer' && selectedMode === 'circuit' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">AI Pace:</span>
                    <div className="inline-flex p-1 rounded-lg bg-[#11151E] border border-white/10">
                      {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => onSelectDifficulty(d)}
                          className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                            settings.difficulty === d
                              ? 'bg-orange-600 text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-400 font-medium">Car Paint:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {CAR_LIVERIES.map((liv) => {
                      const active = settings.liveryId === liv.id;
                      const unlocked =
                        liv.priceCredits === 0 || profile.unlockedLiveries.includes(liv.id);
                      return (
                        <button
                          key={liv.id}
                          type="button"
                          title={unlocked ? liv.name : `${liv.name} (Unlock in Garage)`}
                          aria-label={`Select ${liv.name} paint`}
                          onClick={() => {
                            if (unlocked) {
                              onSelectLivery(liv.id);
                            } else {
                              onOpenGarage();
                            }
                          }}
                          className={`relative w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-transform cursor-pointer ${
                            active
                              ? 'border-white scale-110'
                              : unlocked
                                ? 'border-white/25 hover:scale-105'
                                : 'border-white/15 opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: liv.bodyHex }}
                        >
                          {!unlocked && <Lock className="w-3 h-3 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Active Driver / Garage Status Strip */}
            <div className="max-w-xl bg-[#11151E]/92 border border-white/12 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-display font-bold text-sm text-white truncate">
                  {activeCar.name}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  · {driverRank.name}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono-tabular text-xs">
                <span className="font-bold text-amber-400">
                  {profile.credits.toLocaleString()} CR
                </span>
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 font-semibold cursor-pointer"
                >
                  <span>Tune &amp; Unlock</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Primary CTA + Quick Action Links */}
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <button
                type="button"
                onClick={onStartRace}
                disabled={Boolean(webglError)}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-display font-bold text-base sm:text-lg tracking-wide transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{primaryCtaLabel}</span>
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onOpenGarage}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#11151E]/90 border border-amber-500/40 hover:border-amber-400 text-sm font-semibold text-amber-300 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Wrench className="w-4 h-4" />
                <span>Garage &amp; Upgrades</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#11151E]/90 border border-white/15 hover:border-white/30 text-sm font-semibold text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-orange-400" />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Right: Game-Specific Records & Overview Card */}
          <div className="lg:col-span-5 lg:justify-self-end w-full max-w-md">
            {selectedGame === 'highway-rush' ? (
              <div className="bg-[#0E121B]/92 border border-orange-500/35 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-orange-400">Endless Arcade</div>
                    <div className="font-display font-bold text-lg text-white">
                      Highway Rush Standings
                    </div>
                  </div>
                  <Gauge className="w-5 h-5 text-orange-400" />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Best Score</div>
                    <div className="font-mono-tabular font-bold text-lg text-orange-400 mt-0.5">
                      {records.highwayBestScore.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Furthest Run</div>
                    <div className="font-mono-tabular font-bold text-lg text-white mt-0.5">
                      {records.highwayBestDistanceKm.toFixed(2)} km
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Runs</div>
                    <div className="font-mono-tabular font-bold text-lg text-white mt-0.5">
                      {records.highwayRuns}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-slate-300">
                  <div className="flex items-center justify-between bg-[#090B10]/85 border border-white/10 rounded-xl px-3.5 py-2.5">
                    <span>Swoop close past traffic (&gt;105 km/h)</span>
                    <span className="font-mono-tabular font-semibold text-orange-400">Near Miss</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#090B10]/85 border border-white/10 rounded-xl px-3.5 py-2.5">
                    <span>Chain passes within 4 seconds</span>
                    <span className="font-mono-tabular font-semibold text-amber-400">Up to 10x</span>
                  </div>
                </div>
              </div>
            ) : selectedGame === 'drift-king' ? (
              <div className="bg-[#0E121B]/92 border border-orange-500/35 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-orange-400">90s Score Attack</div>
                    <div className="font-display font-bold text-lg text-white mt-0.5">
                      Nexora Drift Touge
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Wide Hairpins &amp; Glowing Apex Gates
                    </div>
                  </div>

                  <div className="w-24 h-[68px] rounded-lg bg-[#090B10] border border-white/10 p-1 shrink-0">
                    <svg viewBox="0 0 96 68" className="w-full h-full" aria-label="Drift Touge layout">
                      {trackPreviewPathD && (
                        <>
                          <path
                            d={trackPreviewPathD}
                            fill="none"
                            stroke="#334155"
                            strokeWidth="5"
                            strokeLinejoin="round"
                          />
                          <path
                            d={trackPreviewPathD}
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                        </>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Best Score</div>
                    <div className="font-mono-tabular font-bold text-lg text-orange-400 mt-0.5">
                      {records.driftBestScore.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Peak Chain</div>
                    <div className="font-mono-tabular font-bold text-lg text-white mt-0.5">
                      {records.driftBestCombo > 0 ? `${records.driftBestCombo}x` : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Sessions</div>
                    <div className="font-mono-tabular font-bold text-lg text-white mt-0.5">
                      {records.driftRuns}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-slate-300">
                  <div className="flex items-center justify-between bg-[#090B10]/85 border border-white/10 rounded-xl px-3.5 py-2.5">
                    <span>Tap Space while steering into corners</span>
                    <span className="font-mono-tabular font-semibold text-amber-400">Initiate Slide</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#090B10]/85 border border-white/10 rounded-xl px-3.5 py-2.5">
                    <span>Slide cleanly past orange overhead gates</span>
                    <span className="font-mono-tabular font-semibold text-orange-400">Apex Bonus</span>
                  </div>
                </div>
              </div>
            ) : selectedMode === 'daily-challenge' ? (
              <div className="bg-[#0E121B]/92 border border-orange-500/35 rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Daily Challenge · {dailyChallenge.dateKey}</span>
                    </div>
                    <div className="font-display font-bold text-lg text-white mt-0.5">
                      {dailyChallenge.layoutName}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {dailyChallenge.layoutLengthKm} · {dailyChallenge.layoutFeature}
                    </div>
                  </div>

                  <div className="w-24 h-[68px] rounded-lg bg-[#090B10] border border-white/10 p-1 shrink-0">
                    <svg
                      viewBox="0 0 96 68"
                      className="w-full h-full"
                      aria-label={`${dailyChallenge.layoutName} layout`}
                    >
                      {trackPreviewPathD && (
                        <>
                          <path
                            d={trackPreviewPathD}
                            fill="none"
                            stroke="#334155"
                            strokeWidth="5"
                            strokeLinejoin="round"
                          />
                          <path
                            d={trackPreviewPathD}
                            fill="none"
                            stroke="#F97316"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                        </>
                      )}
                    </svg>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Today&apos;s Tasks</span>
                    <span className="font-mono-tabular">Resets in {resetCountdown}</span>
                  </div>

                  <div className="space-y-2">
                    {dailyChallenge.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 border ${
                          task.completed
                            ? 'bg-emerald-950/35 border-emerald-500/40'
                            : 'bg-[#090B10]/85 border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {task.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div
                              className={`text-xs font-semibold ${
                                task.completed ? 'text-emerald-200' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {task.description}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`font-mono-tabular text-xs font-semibold shrink-0 ${
                            task.completed ? 'text-emerald-400' : 'text-orange-400'
                          }`}
                        >
                          {task.completed ? 'Done' : formatRaceTime(task.targetMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <div className="text-slate-400">Today Best Lap</div>
                    <div className="font-mono-tabular font-bold text-sm text-white mt-0.5">
                      {formatRaceTime(dailyChallenge.bestLapMs)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Best 3-Lap</div>
                    <div className="font-mono-tabular font-bold text-sm text-white mt-0.5">
                      {formatRaceTime(dailyChallenge.bestRunMs)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Daily Streak</div>
                    <div className="font-mono-tabular font-bold text-sm text-orange-400 mt-0.5 inline-flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5" />
                      <span>
                        {dailyChallenge.streakDays}{' '}
                        {dailyChallenge.streakDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0E121B]/90 border border-white/12 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base text-white">
                    Nexora Metro Loop
                  </span>
                  <Trophy className="w-4 h-4 text-orange-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/10">
                  <div>
                    <div className="text-xs text-slate-400">Best Lap</div>
                    <div className="font-mono-tabular font-bold text-lg text-white mt-0.5">
                      {formatRaceTime(records.bestLapMs)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">
                      {selectedMode === 'free-drive' ? 'Races Finished' : 'Best 3-Lap Time'}
                    </div>
                    <div className="font-mono-tabular font-bold text-lg text-orange-400 mt-0.5">
                      {selectedMode === 'free-drive'
                        ? records.racesCompleted
                        : formatRaceTime(bestRaceTime)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
                  <span>Circuit Length · 1.30 km</span>
                  <span>6 Checkpoints · Overpass &amp; Tunnel</span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectMode('daily-challenge')}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#161B26] hover:bg-[#1D2433] border border-orange-500/25 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        Daily Challenge · {dailyChallenge.layoutName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {dailyChallenge.completedCount}/{dailyChallenge.tasks.length} tasks cleared ·
                        Resets in {resetCountdown}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-orange-400 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Quiet Footer with Mobile Nav Links */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-10 border-t border-white/10 bg-[#090B10]/80 text-xs text-slate-400">
        <span>© {new Date().getFullYear()} Nexora Games · Independent Browser Racing</span>
        <div className="flex md:hidden items-center gap-4 text-slate-300">
          <button type="button" onClick={onOpenGarage} className="text-amber-400 font-semibold cursor-pointer">
            Garage
          </button>
          <button type="button" onClick={onOpenHowToPlay} className="hover:text-white cursor-pointer">
            How to Play
          </button>
          <button type="button" onClick={onOpenSettings} className="hover:text-white cursor-pointer">
            Settings
          </button>
          <button type="button" onClick={onOpenAbout} className="hover:text-white cursor-pointer">
            About
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenAbout}
          className="hidden md:inline hover:text-white transition-colors cursor-pointer"
        >
          About Nexora Games
        </button>
      </footer>
    </div>
  );
};

