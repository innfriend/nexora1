import React from 'react';
import { X } from 'lucide-react';
import { NexoraLogo } from './NexoraLogo';

interface ModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<ModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <h2 id="howto-title" className="font-display font-bold text-xl text-white">
            How to Play
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Play"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <h3 className="font-semibold text-white mb-2">Desktop Keyboard Controls</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Accelerate</span>
                <span className="font-mono-tabular font-semibold text-white">W / Up</span>
              </div>
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Brake / Reverse</span>
                <span className="font-mono-tabular font-semibold text-white">S / Down</span>
              </div>
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Steer Left / Right</span>
                <span className="font-mono-tabular font-semibold text-white">A D / Arrows</span>
              </div>
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Handbrake Drift</span>
                <span className="font-mono-tabular font-semibold text-white">Space</span>
              </div>
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Nitrous Boost</span>
                <span className="font-mono-tabular font-semibold text-sky-400">Shift / N</span>
              </div>
              <div className="bg-[#0B0E14] border border-white/10 rounded-lg px-3 py-2 flex justify-between">
                <span className="text-slate-400">Pause / Resume</span>
                <span className="font-mono-tabular font-semibold text-white">Esc</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-1.5">Launch, Nitro &amp; Risk Mechanics</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Feather the throttle during the 3-2-1 countdown to hold RPM inside the green launch zone for an instant start burst and +100 CR. Recharge Nitrous by drifting, drafting AI slipstreams, hitting Drift King apex gates, or daring oncoming expressway lanes.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-1.5">Arcade Games &amp; Garage Career</h3>
            <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
              <p>
                <strong className="text-slate-200">Street Racer:</strong> Clear all checkpoints across 3 laps against AI rivals, chase your live Hologram Ghost in Time Trial, or beat rotating Daily Challenge tasks.
              </p>
              <p>
                <strong className="text-slate-200">Highway Rush:</strong> Weave through 4 lanes of expressway traffic. Cross the double amber line into oncoming traffic for 2x score rate and rapid Nitrous recharge.
              </p>
              <p>
                <strong className="text-slate-200">Drift King:</strong> Hold sideways slides down the Nexora Drift Touge within 90 seconds and clip glowing orange apex gates to climb multipliers and earn Garage Credits.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};

export const AboutModal: React.FC<ModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#090B10]/85 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="w-full max-w-lg bg-[#11151E] border border-white/15 rounded-2xl p-6 space-y-5 my-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <NexoraLogo compact />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close About"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <h2 id="about-title" className="font-display font-bold text-2xl text-white">
            Nexora Games Arcade
          </h2>
          <p>
            <strong>Nexora Games</strong> is an independent, browser-native 3D arcade racing portal built to load instantly with zero downloads. Powered by a shared WebGL engine, PBR GT3 visuals, and procedural audio, it brings three distinct driving challenges to desktop and mobile browsers.
          </p>
          <p className="text-xs text-slate-400">
            Play <strong>Nexora Street Racer</strong> (closed-loop circuits, AI racing, Time Trial, Daily Challenges &amp; Race Replays), <strong>Nexora Highway Rush</strong> (endless 4-lane expressway traffic near-miss scoring), and <strong>Nexora Drift King</strong> (90-second touge score attack with glowing apex clipping zones).
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#1A202E] hover:bg-[#232B3D] border border-white/15 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
