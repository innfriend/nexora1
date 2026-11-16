import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronUp, Flame, OctagonX } from 'lucide-react';
import { InputState } from '../game/types';

interface MobileControlsProps {
  nitroRatio?: number;
  nitroActive?: boolean;
  onInputChange: (next: Partial<InputState>) => void;
}

interface TouchPadProps {
  label: string;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  className: string;
  children: React.ReactNode;
}

const TouchPad: React.FC<TouchPadProps> = ({
  label,
  active,
  onActiveChange,
  className,
  children,
}) => {
  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on synthetic events
    }
    onActiveChange(true);
  };

  const handleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onActiveChange(false);
  };

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={() => onActiveChange(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-control-zone select-none flex flex-col items-center justify-center rounded-xl border transition-transform duration-75 ${
        active ? 'scale-95' : 'scale-100'
      } ${className}`}
    >
      {children}
    </button>
  );
};

export const MobileControls: React.FC<MobileControlsProps> = ({
  nitroRatio = 1,
  nitroActive = false,
  onInputChange,
}) => {
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [gas, setGas] = useState(false);
  const [brake, setBrake] = useState(false);
  const [handbrake, setHandbrake] = useState(false);
  const [nitro, setNitro] = useState(false);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-5 sm:px-6 sm:pb-6 touch-control-zone"
      style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {/* Left Cluster: Steering */}
      <div className="pointer-events-auto flex items-center gap-3">
        <TouchPad
          label="Steer Left"
          active={left}
          onActiveChange={(v) => {
            setLeft(v);
            onInputChange({ steerLeft: v });
          }}
          className={`w-[74px] h-[74px] sm:w-20 sm:h-20 ${
            left
              ? 'bg-orange-500/85 border-orange-300 text-white'
              : 'bg-[#0B0E14]/80 border-white/20 text-slate-100'
          }`}
        >
          <ArrowLeft className="w-7 h-7" />
          <span className="text-[11px] font-semibold tracking-wide mt-0.5">LEFT</span>
        </TouchPad>

        <TouchPad
          label="Steer Right"
          active={right}
          onActiveChange={(v) => {
            setRight(v);
            onInputChange({ steerRight: v });
          }}
          className={`w-[74px] h-[74px] sm:w-20 sm:h-20 ${
            right
              ? 'bg-orange-500/85 border-orange-300 text-white'
              : 'bg-[#0B0E14]/80 border-white/20 text-slate-100'
          }`}
        >
          <ArrowRight className="w-7 h-7" />
          <span className="text-[11px] font-semibold tracking-wide mt-0.5">RIGHT</span>
        </TouchPad>
      </div>

      {/* Right Cluster: Nitro, Drift, Brake/Reverse, Gas */}
      <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
        <div className="flex flex-col items-end gap-2">
          <TouchPad
            label="Nitrous Boost"
            active={nitro || nitroActive}
            onActiveChange={(v) => {
              setNitro(v);
              onInputChange({ nitro: v });
            }}
            className={`w-14 h-12 sm:w-16 sm:h-14 ${
              nitro || nitroActive
                ? 'bg-sky-500 border-sky-200 text-slate-950'
                : nitroRatio > 0.08
                  ? 'bg-[#0B0E14]/85 border-sky-400/50 text-sky-300'
                  : 'bg-[#0B0E14]/70 border-white/10 text-slate-500'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span className="text-[10px] font-bold tracking-wide">NITRO</span>
          </TouchPad>

          <TouchPad
            label="Handbrake Drift"
            active={handbrake}
            onActiveChange={(v) => {
              setHandbrake(v);
              onInputChange({ handbrake: v });
            }}
            className={`w-14 h-12 sm:w-16 sm:h-14 ${
              handbrake
                ? 'bg-amber-500/85 border-amber-300 text-slate-950'
                : 'bg-[#0B0E14]/80 border-white/20 text-slate-200'
            }`}
          >
            <span className="text-[11px] font-bold tracking-wide">DRIFT</span>
          </TouchPad>
        </div>

        <TouchPad
          label="Brake and Reverse"
          active={brake}
          onActiveChange={(v) => {
            setBrake(v);
            onInputChange({ brake: v });
          }}
          className={`w-[66px] h-[74px] sm:w-[74px] sm:h-20 ${
            brake
              ? 'bg-red-600/90 border-red-300 text-white'
              : 'bg-[#0B0E14]/80 border-red-500/40 text-red-200'
          }`}
        >
          <OctagonX className="w-6 h-6" />
          <span className="text-[11px] font-semibold tracking-wide mt-0.5">BRAKE</span>
        </TouchPad>

        <TouchPad
          label="Accelerate"
          active={gas}
          onActiveChange={(v) => {
            setGas(v);
            onInputChange({ accelerate: v });
          }}
          className={`w-[76px] h-[94px] sm:w-22 sm:h-24 ${
            gas
              ? 'bg-orange-500 border-orange-200 text-white'
              : 'bg-orange-600/85 border-orange-400/60 text-white'
          }`}
        >
          <ChevronUp className="w-8 h-8" />
          <span className="text-xs font-bold tracking-wider mt-0.5">GAS</span>
        </TouchPad>
      </div>
    </div>
  );
};
