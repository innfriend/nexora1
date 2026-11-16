import React from 'react';
import {
  Award,
  CheckCircle2,
  Circle,
  Film,
  Flame,
  Home,
  RotateCcw,
  Trophy,
  Wrench,
} from 'lucide-react';
import { BADGE_CATALOG } from '../game/garageData';
import { formatRaceTime } from '../game/storage';
import { RaceEarningsSummary, RaceResult } from '../game/types';

interface ResultsModalProps {
  result: RaceResult;
  onWatchReplay: () => void;
  onOpenGarage: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

const EarningsCard: React.FC<{ earnings?: RaceEarningsSummary }> = ({ earnings }) => {
  if (!earnings) return null;
  return (
    <div className="bg-[#0B0E14] border border-amber-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            Garage Payout &amp; XP
          </div>
          <div className="text-xs text-slate-300 mt-0.5">
            {earnings.leveledUp ? (
              <span className="font-bold text-emerald-400">
                RANK UP: {earnings.previousRank} → {earnings.newRank}
              </span>
            ) : (
              <span>Driver Rank: {earnings.newRank}</span>
            )}
          </div>
        </div>
        <div className="text-right font-mono-tabular">
          <div className="font-bold text-lg text-amber-400">
            +{earnings.creditsEarned.toLocaleString()} CR
          </div>
          <div className="text-[11px] text-sky-400 font-semibold">
            +{earnings.xpEarned.toLocaleString()} XP
          </div>
        </div>
      </div>

      {earnings.breakdown.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-white/10 text-[11px]">
          {earnings.breakdown.map((b, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-slate-300">
              <span className="truncate">{b.label}</span>
              <span className="font-mono-tabular text-amber-300 shrink-0">+{b.credits}</span>
            </div>
          ))}
        </div>
      )}

      {earnings.newlyUnlockedBadges.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-1">
          {earnings.newlyUnlockedBadges.map((bId) => {
            const badge = BADGE_CATALOG.find((b) => b.id === bId);
            if (!badge) return null;
            return (
              <div
                key={bId}
                className="flex items-center justify-between gap-2 text-xs font-semibold text-emerald-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Badge Unlocked: {badge.name}</span>
                </span>
                <span className="font-mono-tabular">+{badge.rewardCredits} CR</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function positionText(pos: number): string {
  if (pos === 1) return '1st Place';
  if (pos === 2) return '2nd Place';
  if (pos === 3) return '3rd Place';
  return `${pos}th Place`;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  result,
  onWatchReplay,
  onOpenGarage,
  onRestart,
  onMainMenu,
}) => {
  if (result.gameTitle === 'highway-rush') {
    const score = result.score ?? 0;
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-title"
          className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs font-medium text-orange-400">Nexora Highway Rush</div>
              <h2 id="results-title" className="font-display font-bold text-3xl text-white mt-0.5">
                {result.isNewBestScore ? 'New High Score!' : 'Run Finished'}
              </h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
              <Award className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Final Score</span>
              {result.isNewBestScore && (
                <span className="font-semibold text-orange-400">Personal Record</span>
              )}
            </div>
            <div className="font-mono-tabular font-bold text-3xl text-white mt-1">
              {score.toLocaleString()}
            </div>
            {result.previousBestScore !== undefined && result.previousBestScore !== null && result.previousBestScore > 0 && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                Previous Best: {result.previousBestScore.toLocaleString()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Distance</div>
              <div className="font-mono-tabular font-bold text-lg text-white mt-1">
                {(result.distanceKm ?? 0).toFixed(2)} km
              </div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Near Misses</div>
              <div className="font-mono-tabular font-bold text-lg text-orange-400 mt-1">
                {result.nearMissCount ?? 0}
              </div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Peak Combo</div>
              <div className="font-mono-tabular font-bold text-lg text-amber-400 mt-1">
                {result.maxCombo ?? 1}x
              </div>
            </div>
          </div>

          <EarningsCard earnings={result.earnings} />

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onOpenGarage}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Garage &amp; Upgrades</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Run Again</span>
              </button>

              <button
                type="button"
                onClick={onMainMenu}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (result.gameTitle === 'drift-king') {
    const score = result.score ?? 0;
    const grade = result.driftGrade ?? 'C';
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-title"
          className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="text-xs font-medium text-orange-400">Nexora Drift King · 90s Session</div>
              <h2 id="results-title" className="font-display font-bold text-3xl text-white mt-0.5">
                {result.isNewBestScore ? 'New Drift Record!' : 'Session Complete'}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center font-display font-bold text-2xl text-amber-400 shrink-0">
              {grade}
            </div>
          </div>

          <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Drift Score</span>
              {result.isNewBestScore && (
                <span className="font-semibold text-orange-400">Personal Record</span>
              )}
            </div>
            <div className="font-mono-tabular font-bold text-3xl text-white mt-1">
              {score.toLocaleString()}
            </div>
            {result.previousBestScore !== undefined && result.previousBestScore !== null && result.previousBestScore > 0 && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                Previous Best: {result.previousBestScore.toLocaleString()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Best Single Drift</div>
              <div className="font-mono-tabular font-bold text-lg text-white mt-1">
                {(result.bestSingleDrift ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Apex Gates</div>
              <div className="font-mono-tabular font-bold text-lg text-orange-400 mt-1">
                {result.driftZonesHit ?? 0}
              </div>
            </div>
            <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400">Max Multiplier</div>
              <div className="font-mono-tabular font-bold text-lg text-amber-400 mt-1">
                {result.maxCombo ?? 1}x
              </div>
            </div>
          </div>

          <EarningsCard earnings={result.earnings} />

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={onOpenGarage}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Garage &amp; Upgrades</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onRestart}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Drift Again</span>
              </button>

              <button
                type="button"
                onClick={onMainMenu}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Main Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const modeLabel =
    result.mode === 'circuit'
      ? `Circuit Race · ${result.difficulty.charAt(0).toUpperCase() + result.difficulty.slice(1)} AI`
      : result.mode === 'daily-challenge'
        ? `Daily Challenge · ${result.dailySummary?.layoutName ?? 'Rotating Circuit'}`
        : 'Time Trial';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-title"
        className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-medium text-orange-400">{modeLabel}</div>
            <h2 id="results-title" className="font-display font-bold text-3xl text-white mt-0.5">
              {result.mode === 'circuit' ? positionText(result.position) : 'Race Complete'}
            </h2>
          </div>
          <div className="w-11 h-11 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* Time Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Final Time</span>
              {result.isNewBestRace && (
                <span className="font-semibold text-orange-400">New Best</span>
              )}
            </div>
            <div className="font-mono-tabular font-bold text-2xl text-white mt-1">
              {formatRaceTime(result.totalTimeMs)}
            </div>
            {result.previousBestRaceMs !== null && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                Prev Best: {formatRaceTime(result.previousBestRaceMs)}
              </div>
            )}
          </div>

          <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Best Lap</span>
              {result.isNewBestLap && (
                <span className="font-semibold text-amber-400">Track Record</span>
              )}
            </div>
            <div className="font-mono-tabular font-bold text-2xl text-amber-400 mt-1">
              {formatRaceTime(result.bestLapMs)}
            </div>
            {result.previousBestLapMs !== null && (
              <div className="text-[11px] text-slate-400 mt-1 font-mono-tabular">
                Record: {formatRaceTime(result.previousBestLapMs)}
              </div>
            )}
          </div>
        </div>

        {/* Lap Breakdown */}
        {result.lapTimesMs.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Lap Splits
            </div>
            <div className="grid grid-cols-3 gap-2">
              {result.lapTimesMs.map((lapMs, idx) => (
                <div
                  key={idx}
                  className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 text-center"
                >
                  <div className="text-[11px] text-slate-400">Lap {idx + 1}</div>
                  <div className="font-mono-tabular text-sm font-semibold text-white mt-0.5">
                    {formatRaceTime(lapMs)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standings in Circuit Race */}
        {result.mode === 'circuit' && result.standings.length > 1 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Race Standings
            </div>
            <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-[#0B0E14] overflow-hidden">
              {result.standings.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-3.5 py-2.5 text-sm ${
                    s.isPlayer ? 'bg-orange-600/15 text-white font-semibold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-xs text-slate-400 w-4">
                      {s.position}.
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.name}</span>
                  </div>
                  <span className="font-mono-tabular text-xs text-slate-300">
                    {s.finishTimeMs !== null ? formatRaceTime(s.finishTimeMs) : 'Running'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Challenge Tasks Breakdown */}
        {result.mode === 'daily-challenge' && result.dailySummary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Daily Challenge Tasks
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400">
                <Flame className="w-3.5 h-3.5" />
                <span>
                  {result.dailySummary.streakDays}{' '}
                  {result.dailySummary.streakDays === 1 ? 'day streak' : 'days streak'}
                </span>
              </span>
            </div>

            <div className="space-y-2">
              {result.dailySummary.tasks.map((task) => {
                const clearedThisRun = result.dailySummary!.newlyCompletedIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border ${
                      task.completed
                        ? 'bg-emerald-950/35 border-emerald-500/40'
                        : 'bg-[#0B0E14] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-semibold ${
                            task.completed ? 'text-emerald-200' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {task.description}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`font-mono-tabular text-xs font-semibold shrink-0 ${
                        clearedThisRun
                          ? 'text-orange-400'
                          : task.completed
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {clearedThisRun
                        ? 'Cleared!'
                        : task.completed
                          ? 'Completed'
                          : formatRaceTime(task.targetMs)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <EarningsCard earnings={result.earnings} />

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {result.hasReplay && (
              <button
                type="button"
                onClick={onWatchReplay}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>Watch Replay</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenGarage}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold transition-colors cursor-pointer ${
                !result.hasReplay ? 'sm:col-span-2' : ''
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Garage &amp; Upgrades</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onRestart}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-colors cursor-pointer ${
                result.hasReplay
                  ? 'bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart</span>
            </button>

            <button
              type="button"
              onClick={onMainMenu}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
