import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatRaceTime } from '../game/storage';
import { GameMode, ReplayCameraMode, ReplayStatus } from '../game/types';

interface ReplayOverlayProps {
  mode: GameMode;
  status: ReplayStatus;
  soundEnabled: boolean;
  onTogglePlay: () => void;
  onSeek: (timeMs: number) => void;
  onSetSpeed: (speed: number) => void;
  onSetCameraMode: (cam: ReplayCameraMode) => void;
  onToggleSound: () => void;
  onExitReplay: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2];

const CAMERA_OPTIONS: Array<{ id: ReplayCameraMode; label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'orbit', label: 'Orbit' },
];

export const ReplayOverlay: React.FC<ReplayOverlayProps> = ({
  mode,
  status,
  soundEnabled,
  onTogglePlay,
  onSeek,
  onSetSpeed,
  onSetCameraMode,
  onToggleSound,
  onExitReplay,
}) => {
  const { recordedInput } = status;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* Top Broadcast Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="bg-[#0B0E14]/90 border border-white/12 rounded-xl px-4 py-2.5 flex items-center gap-4">
          <div>
            <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">
              Race Replay
            </div>
            <div className="flex items-center gap-2.5 text-sm font-semibold text-white mt-0.5">
              {mode === 'circuit' && (
                <>
                  <span className="tabular-nums">
                    Pos {status.position} / {status.totalRacers}
                  </span>
                  <span aria-hidden="true" className="text-slate-500">
                    ·
                  </span>
                </>
              )}
              <span>
                {mode === 'free-drive'
                  ? 'Free Drive'
                  : mode === 'daily-challenge'
                    ? `Daily Challenge · Lap ${status.lap} / ${status.totalLaps}`
                    : `Lap ${status.lap} / ${status.totalLaps}`}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-baseline gap-2 border-l border-white/10 pl-4">
            <span className="font-display font-bold text-2xl text-white tabular-nums leading-none">
              {status.speedKmh}
            </span>
            <span className="text-xs text-slate-400">km/h</span>
            <span className="font-display font-bold text-lg text-orange-400 ml-1">
              {status.gear}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute Replay Audio' : 'Unmute Replay Audio'}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#0B0E14]/90 border border-white/12 text-slate-200 hover:bg-slate-800 hover:border-white/25 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5 text-slate-500" />
            )}
          </button>

          <button
            type="button"
            onClick={onExitReplay}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#0B0E14]/90 border border-white/15 hover:bg-orange-600 hover:border-orange-400 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Exit Replay</span>
          </button>
        </div>
      </div>

      {/* Bottom Scrubber & Recorded Input Telemetry Dock */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl bg-[#0B0E14]/92 border border-white/15 rounded-2xl p-3.5 sm:p-4 space-y-3">
        {/* Timeline Scrubber */}
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular text-xs text-white w-16 shrink-0">
            {formatRaceTime(status.currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(100, Math.round(status.durationMs))}
            value={Math.round(status.currentTimeMs)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Replay Timeline Scrubber"
            className="flex-1 accent-orange-500 cursor-pointer h-2"
          />
          <span className="font-mono-tabular text-xs text-slate-400 w-16 text-right shrink-0">
            {formatRaceTime(status.durationMs)}
          </span>
        </div>

        {/* Transport Controls, Camera Switcher, and Recorded Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Play / Restart / Speed */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={status.playing ? 'Pause Replay' : 'Play Replay'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer"
            >
              {status.playing ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSeek(0)}
              title="Restart Replay"
              aria-label="Restart Replay from Start"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#161B26] hover:bg-[#1F2636] border border-white/10 text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="inline-flex p-1 rounded-xl bg-[#161B26] border border-white/10">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onSetSpeed(spd)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular font-semibold transition-colors cursor-pointer ${
                    status.playbackSpeed === spd
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Recorded Player Inputs Telemetry */}
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#11151E] border border-white/10"
            aria-label="Recorded Player Inputs"
          >
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Inputs
            </span>
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${
                recordedInput.steerLeft
                  ? 'bg-orange-600 border-orange-400 text-white'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
              title="Steer Left"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </span>
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${
                recordedInput.accelerate
                  ? 'bg-orange-600 border-orange-400 text-white'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
              title="Accelerate"
            >
              <ChevronUp className="w-4 h-4" />
            </span>
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${
                recordedInput.brake
                  ? 'bg-red-600 border-red-400 text-white'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
              title="Brake / Reverse"
            >
              <ChevronDown className="w-4 h-4" />
            </span>
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${
                recordedInput.steerRight
                  ? 'bg-orange-600 border-orange-400 text-white'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
              title="Steer Right"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            <span
              className={`px-2 h-7 rounded-md flex items-center justify-center border text-[10px] font-bold tracking-wide ${
                recordedInput.handbrake
                  ? 'bg-amber-500 border-amber-300 text-slate-950'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
            >
              DRIFT
            </span>
            <span
              className={`px-2 h-7 rounded-md flex items-center justify-center border text-[10px] font-bold tracking-wide ${
                recordedInput.nitro
                  ? 'bg-sky-400 border-sky-200 text-slate-950'
                  : 'bg-[#090B10] border-white/10 text-slate-500'
              }`}
            >
              N2O
            </span>
          </div>

          {/* Camera Mode Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-[#161B26] border border-white/10">
            {CAMERA_OPTIONS.map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => onSetCameraMode(cam.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  status.cameraMode === cam.id
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
