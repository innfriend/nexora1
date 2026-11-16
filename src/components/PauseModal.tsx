import React from 'react';
import { Film, Home, Play, RotateCcw, Sliders } from 'lucide-react';

interface PauseModalProps {
  canWatchReplay: boolean;
  onResume: () => void;
  onWatchReplay: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  canWatchReplay,
  onResume,
  onWatchReplay,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090B10]/80">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="w-full max-w-sm bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5"
      >
        <div className="text-center">
          <h2 id="pause-title" className="font-display font-bold text-2xl text-white">
            Game Paused
          </h2>
          <p className="text-xs text-slate-400 mt-1">Press Esc to resume driving</p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume</span>
          </button>

          {canWatchReplay && (
            <button
              type="button"
              onClick={onWatchReplay}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
            >
              <Film className="w-4 h-4 text-orange-400" />
              <span>Watch Replay</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/10 text-slate-100 font-semibold transition-colors cursor-pointer"
          >
            <Sliders className="w-4 h-4" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-slate-300 font-semibold transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
