import React from 'react';
import { X } from 'lucide-react';
import {
  CameraPreset,
  CAR_LIVERIES,
  GameSettings,
  QualityPreset,
  TouchControlsMode,
} from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdate,
  onClose,
}) => {
  const update = (patch: Partial<GameSettings>) => {
    onUpdate({ ...settings, ...patch });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <h2 id="settings-title" className="font-display font-bold text-xl text-white">
            Game Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Graphics Quality */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/10">
              {(['low', 'medium', 'high'] as QualityPreset[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => update({ quality: q })}
                  className={`py-2 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    settings.quality === q
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Use Low or Medium for older mobile devices to maximize frame rate.
            </p>
          </div>

          {/* Camera Distance */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Chase Camera Distance
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/10">
              {([
                { id: 'close', label: 'Close' },
                { id: 'chase', label: 'Standard' },
                { id: 'far', label: 'Far' },
              ] as Array<{ id: CameraPreset; label: string }>).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => update({ cameraPreset: c.id })}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    settings.cameraPreset === c.id
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Touch Controls */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              On-Screen Touch Controls
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/10">
              {([
                { id: 'auto', label: 'Auto' },
                { id: 'on', label: 'Always On' },
                { id: 'off', label: 'Off' },
              ] as Array<{ id: TouchControlsMode; label: string }>).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => update({ touchControls: t.id })}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    settings.touchControls === t.id
                      ? 'bg-orange-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Controls */}
          <div className="space-y-2.5 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Game Audio</span>
              <button
                type="button"
                onClick={() => update({ soundEnabled: !settings.soundEnabled })}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  settings.soundEnabled
                    ? 'bg-orange-600 text-white'
                    : 'bg-[#0B0E14] border border-white/15 text-slate-400'
                }`}
              >
                {settings.soundEnabled ? 'Enabled' : 'Muted'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-14">Volume</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.volume * 100)}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
                className="flex-1 accent-orange-500 cursor-pointer"
                aria-label="Master Volume"
              />
              <span className="font-mono-tabular text-xs text-slate-300 w-9 text-right">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </div>

          {/* Paint Livery */}
          <div className="space-y-1.5 pt-1 border-t border-white/10">
            <span className="block text-xs font-semibold text-slate-300">Vehicle Livery</span>
            <div className="grid grid-cols-2 gap-2">
              {CAR_LIVERIES.map((liv) => (
                <button
                  key={liv.id}
                  type="button"
                  onClick={() => update({ liveryId: liv.id })}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    settings.liveryId === liv.id
                      ? 'bg-orange-600/20 border-orange-500 text-white'
                      : 'bg-[#0B0E14] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-sm shrink-0 border border-white/30"
                    style={{ backgroundColor: liv.bodyHex }}
                  />
                  <span className="truncate">{liv.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
