import React, { useMemo } from 'react';
import { Camera, CheckCircle2, Circle, Pause, Volume2, VolumeX } from 'lucide-react';
import { formatRaceTime } from '../game/storage';
import { CameraPreset, GameMode, GamePhase, HudTelemetry, InputState } from '../game/types';
import { MobileControls } from './MobileControls';

interface RaceHudProps {
  phase: GamePhase;
  mode: GameMode;
  telemetry: HudTelemetry;
  minimapPath: {
    points: Array<{ x: number; z: number }>;
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  };
  showTouchControls: boolean;
  soundEnabled: boolean;
  cameraPreset: CameraPreset;
  onPause: () => void;
  onToggleSound: () => void;
  onCycleCamera: () => void;
  onTouchInput: (next: Partial<InputState>) => void;
}

function formatOrdinal(pos: number): string {
  if (pos === 1) return '1st';
  if (pos === 2) return '2nd';
  if (pos === 3) return '3rd';
  return `${pos}th`;
}

export const RaceHud: React.FC<RaceHudProps> = ({
  phase,
  mode,
  telemetry,
  minimapPath,
  showTouchControls,
  soundEnabled,
  cameraPreset,
  onPause,
  onToggleSound,
  onCycleCamera,
  onTouchInput,
}) => {
  const mapGeometry = useMemo(() => {
    const { points, bounds } = minimapPath;
    if (points.length === 0) return { pathD: '', project: (_x: number, _z: number) => ({ x: 50, y: 50 }) };

    const pad = 16;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxZ - bounds.minZ);
    const scale = Math.min((120 - pad * 2) / width, (100 - pad * 2) / height);
    const offsetX = (120 - width * scale) * 0.5;
    const offsetY = (100 - height * scale) * 0.5;

    const project = (x: number, z: number) => ({
      x: offsetX + (x - bounds.minX) * scale,
      y: offsetY + (z - bounds.minZ) * scale,
    });

    const d =
      points
        .map((p, idx) => {
          const pt = project(p.x, p.z);
          return `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        })
        .join(' ') + ' Z';

    return { pathD: d, project };
  }, [minimapPath]);

  const cameraLabel = cameraPreset === 'chase' ? 'Chase' : cameraPreset === 'close' ? 'Close' : 'Far';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Game-Specific Primary Counter */}
        {telemetry.gameTitle === 'highway-rush' ? (
          <div className="pointer-events-auto bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2.5 sm:px-4 sm:py-3 min-w-[155px]">
            <div className="text-[11px] font-medium text-slate-400">Score</div>
            <div className="font-mono-tabular font-bold text-xl sm:text-2xl text-white leading-none mt-0.5">
              {(telemetry.score ?? 0).toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-400 font-mono-tabular">
              <span>{(telemetry.distanceKm ?? 0).toFixed(2)} km</span>
              <span className="text-orange-400">{telemetry.nearMissCount ?? 0} passes</span>
            </div>
          </div>
        ) : telemetry.gameTitle === 'drift-king' ? (
          <div className="pointer-events-auto bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2.5 sm:px-4 sm:py-3 min-w-[155px]">
            <div className="text-[11px] font-medium text-slate-400">Banked Score</div>
            <div className="font-mono-tabular font-bold text-xl sm:text-2xl text-white leading-none mt-0.5">
              {(telemetry.score ?? 0).toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-400 font-mono-tabular">
              <span>{telemetry.driftZonesHit ?? 0} apex gates</span>
              <span className="text-amber-400">Drift Touge</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <div className="pointer-events-auto bg-[#0B0E14]/88 border border-white/12 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-[140px]">
              <div className="flex items-baseline gap-3">
                {mode === 'circuit' && (
                  <div>
                    <div className="text-[11px] font-medium text-slate-400">Pos</div>
                    <div className="font-display font-bold text-xl sm:text-2xl text-orange-400 tabular-nums leading-none">
                      {formatOrdinal(telemetry.position)}
                      <span className="text-xs text-slate-400 font-normal"> / {telemetry.totalRacers}</span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {mode === 'free-drive' ? 'Session' : 'Lap'}
                  </div>
                  <div className="font-display font-bold text-xl sm:text-2xl text-white tabular-nums leading-none">
                    {mode === 'free-drive' ? (
                      <span className="text-base sm:text-lg text-slate-100">Free Drive</span>
                    ) : (
                      <>
                        {telemetry.lap}
                        <span className="text-xs text-slate-400 font-normal"> / {telemetry.totalLaps}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {mode !== 'free-drive' && (
                <div className="mt-2 flex items-center gap-1" aria-label="Checkpoint progress">
                  {Array.from({ length: telemetry.totalCheckpoints }).map((_, idx) => {
                    const cleared =
                      telemetry.checkpointIndex === 0
                        ? true
                        : idx < telemetry.checkpointIndex;
                    return (
                      <span
                        key={idx}
                        className={`h-1 flex-1 rounded-xs transition-colors ${
                          cleared ? 'bg-orange-500' : 'bg-white/15'
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily Challenge Live Task Targets */}
            {mode === 'daily-challenge' && telemetry.dailyTasks && telemetry.dailyTasks.length > 0 && (
              <div className="hidden sm:block pointer-events-none bg-[#0B0E14]/88 border border-orange-500/25 rounded-xl px-3.5 py-2.5 max-w-[235px] space-y-1.5">
                <div className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider truncate">
                  Daily · {telemetry.dailyLayoutName ?? 'Challenge'}
                </div>
                {telemetry.dailyTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {task.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          task.completed ? 'text-emerald-300 line-through' : 'text-slate-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <span
                      className={`font-mono-tabular shrink-0 ${
                        task.completed ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {formatRaceTime(task.targetMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Top-Center: Combo / Countdown Clock / Race Timer */}
        {telemetry.gameTitle === 'highway-rush' ? (
          <div className="bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2 sm:px-6 sm:py-2.5 text-center min-w-[150px]">
            <div className="text-[11px] font-medium text-slate-400">Near-Miss Combo</div>
            <div className="font-display font-bold text-xl sm:text-2xl text-orange-400 tabular-nums leading-tight">
              {telemetry.comboMultiplier ?? 1}x
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-xs bg-white/10 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-[width] duration-75"
                style={{ width: `${Math.round((telemetry.comboTimerRatio ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ) : telemetry.gameTitle === 'drift-king' ? (
          <div className="bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2 sm:px-6 sm:py-2.5 text-center min-w-[175px]">
            <div className="text-[11px] font-medium text-slate-400">Time Remaining</div>
            <div
              className={`font-mono-tabular font-bold text-lg sm:text-2xl tracking-tight leading-tight ${
                (telemetry.timeRemainingMs ?? 90000) < 15000 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatRaceTime(telemetry.timeRemainingMs ?? 90000)}
            </div>
            {(telemetry.pendingScore ?? 0) > 0 ? (
              <div className="mt-1 space-y-1">
                <div className="font-mono-tabular text-xs font-bold text-amber-400">
                  +{(telemetry.pendingScore ?? 0).toLocaleString()} × {telemetry.comboMultiplier ?? 1}x
                </div>
                <div className="h-1 w-full rounded-xs bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-75"
                    style={{ width: `${Math.round((telemetry.comboTimerRatio ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-slate-400">Slide to build chain</div>
            )}
          </div>
        ) : (
          <div className="bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2 sm:px-5 sm:py-2.5 text-center">
            <div className="text-[11px] font-medium text-slate-400">
              {mode === 'free-drive' ? 'Drive Time' : 'Race Time'}
            </div>
            <div className="font-mono-tabular font-bold text-lg sm:text-2xl text-white tracking-tight leading-tight">
              {formatRaceTime(telemetry.raceTimeMs)}
            </div>
            {mode !== 'free-drive' && (
              <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono-tabular">
                <span>Lap {formatRaceTime(telemetry.currentLapTimeMs)}</span>
                {telemetry.bestLapTimeMs !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400">Best {formatRaceTime(telemetry.bestLapTimeMs)}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top-Right: Camera, Sound, Pause */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCycleCamera}
            title="Switch Camera View"
            className="hidden sm:inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-[#0B0E14]/88 border border-white/12 text-xs font-medium text-slate-200 hover:bg-slate-800/90 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            <span>{cameraLabel}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#0B0E14]/88 border border-white/12 text-slate-200 hover:bg-slate-800/90 hover:border-white/25 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            aria-label="Pause Game"
            className="inline-flex items-center justify-center gap-1.5 min-w-[44px] h-11 px-3 rounded-xl bg-[#0B0E14]/88 border border-white/15 text-slate-100 hover:bg-orange-600 hover:border-orange-400 transition-colors cursor-pointer"
          >
            <Pause className="w-5 h-5" />
            <span className="hidden md:inline text-xs font-semibold">Pause</span>
          </button>
        </div>
      </div>

      {/* Center Screen Alerts (Countdown, Lap Banner, Wrong Way) */}
      <div className="flex flex-col items-center justify-center gap-3 my-auto">
        {phase === 'countdown' && telemetry.countdownValue > 0 && (
          <div className="bg-[#090B10]/90 border border-orange-500/40 rounded-2xl px-10 py-6 text-center">
            <div className="text-xs font-semibold tracking-widest text-orange-400 uppercase mb-1">
              Get Ready
            </div>
            <div className="font-display font-bold text-7xl sm:text-8xl text-white tabular-nums leading-none">
              {telemetry.countdownValue}
            </div>
          </div>
        )}

        {phase === 'racing' && telemetry.bannerText && (
          <div className="bg-[#090B10]/88 border border-orange-500/45 rounded-xl px-6 py-2.5 text-center">
            <span className="font-display font-bold text-2xl sm:text-4xl tracking-wider text-orange-400">
              {telemetry.bannerText}
            </span>
          </div>
        )}

        {phase === 'racing' && telemetry.wrongWay && (
          <div className="bg-red-950/90 border border-red-500 rounded-xl px-5 py-2 text-center">
            <span className="font-display font-bold text-lg sm:text-xl tracking-wider text-red-200">
              WRONG WAY — TURN AROUND
            </span>
          </div>
        )}
      </div>

      {/* Bottom Telemetry Strip (Moves cleanly above mobile touch pads when active) */}
      <div
        className={`flex items-end justify-between gap-4 ${
          showTouchControls ? 'mb-[108px] sm:mb-[116px]' : ''
        }`}
      >
        {/* Bottom-Left: Circuit Mini-Map (Street Racer & Drift King) or Expressway Badge (Highway Rush) */}
        {telemetry.gameTitle === 'highway-rush' ? (
          <div className="bg-[#0B0E14]/85 border border-white/12 rounded-xl px-3.5 py-2.5 text-xs space-y-1">
            <div className="font-display font-bold text-white">4-Lane Expressway</div>
            <div className="text-slate-400 font-mono-tabular">
              Time: {formatRaceTime(telemetry.raceTimeMs)}
            </div>
          </div>
        ) : (
          <div className="bg-[#0B0E14]/85 border border-white/12 rounded-xl p-2 w-[112px] h-[94px] sm:w-[138px] sm:h-[112px]">
            <svg viewBox="0 0 120 100" className="w-full h-full" aria-label="Circuit Map">
              {mapGeometry.pathD && (
                <>
                  <path
                    d={mapGeometry.pathD}
                    fill="none"
                    stroke="#334155"
                    strokeWidth="7"
                    strokeLinejoin="round"
                  />
                  <path
                    d={mapGeometry.pathD}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                </>
              )}
              {telemetry.markers.map((m) => {
                const pt = mapGeometry.project(m.x, m.z);
                return (
                  <circle
                    key={m.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={m.isPlayer ? 4.8 : 3.4}
                    fill={m.isPlayer ? '#F97316' : m.color}
                    stroke="#090B10"
                    strokeWidth="1.2"
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Desktop Controls Reminder (Discreet, single line, hidden on mobile) */}
        {!showTouchControls && (
          <div className="hidden md:flex items-center gap-3 bg-[#0B0E14]/80 border border-white/10 rounded-lg px-3.5 py-1.5 text-xs text-slate-400">
            <span>WASD / Arrows: Drive</span>
            <span aria-hidden="true">·</span>
            <span>Space: Drift</span>
            <span aria-hidden="true">·</span>
            <span>Esc: Pause</span>
          </div>
        )}

        {/* Digital Speedometer & Gear Gauge */}
        <div className="bg-[#0B0E14]/88 border border-white/12 rounded-xl px-4 py-2.5 sm:px-5 sm:py-3 min-w-[148px] sm:min-w-[176px]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-display font-bold text-4xl sm:text-5xl text-white tabular-nums leading-none">
                {telemetry.speedKmh}
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-1">km/h</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Gear</div>
              <div className="font-display font-bold text-2xl sm:text-3xl text-orange-400 leading-none">
                {telemetry.gear}
              </div>
            </div>
          </div>

          {/* Segmented RPM Bar */}
          <div className="mt-2.5 grid grid-cols-10 gap-1" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, idx) => {
              const threshold = (idx + 1) / 10;
              const active = telemetry.rpmRatio >= threshold - 0.05;
              const colorClass =
                idx >= 8 ? 'bg-red-500' : idx >= 6 ? 'bg-orange-400' : 'bg-slate-100';
              return (
                <div
                  key={idx}
                  className={`h-1.5 rounded-xs ${active ? colorClass : 'bg-white/12'}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Multi-touch Mobile Controls */}
      {showTouchControls && phase !== 'paused' && phase !== 'finished' && (
        <MobileControls onInputChange={onTouchInput} />
      )}
    </div>
  );
};
