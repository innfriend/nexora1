import React, { useState } from 'react';
import {
  Award,
  Car,
  Check,
  Flame,
  Lock,
  Palette,
  Sparkles,
  Trophy,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  BADGE_CATALOG,
  CAR_CATALOG,
  getEffectiveCarSpecs,
  UNDERGLOW_OPTIONS,
  UPGRADE_DEFS,
  WING_OPTIONS,
} from '../game/garageData';
import {
  buyOrEquipLivery,
  buyOrSelectCar,
  getDriverRankInfo,
  setProfileUnderglow,
  setProfileWingStyle,
  upgradeGaragePart,
} from '../game/progression';
import { CAR_LIVERIES, CarId, PlayerProfile, UpgradeSlot } from '../game/types';

type GarageTab = 'cars' | 'upgrades' | 'customize' | 'career';

interface GarageModalProps {
  profile: PlayerProfile;
  liveryId: string;
  onUpdateProfile: (profile: PlayerProfile) => void;
  onSelectLivery: (liveryId: string) => void;
  onPlayClickSound?: () => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  profile,
  liveryId,
  onUpdateProfile,
  onSelectLivery,
  onPlayClickSound,
  onClose,
}) => {
  const [tab, setTab] = useState<GarageTab>('cars');
  const rank = getDriverRankInfo(profile.xp);
  const specs = getEffectiveCarSpecs(profile);

  const handleCarAction = (carId: CarId) => {
    onPlayClickSound?.();
    const res = buyOrSelectCar(carId);
    if (res.ok) {
      onUpdateProfile(res.profile);
    }
  };

  const handleUpgrade = (slot: UpgradeSlot) => {
    onPlayClickSound?.();
    const res = upgradeGaragePart(slot);
    if (res.ok) {
      onUpdateProfile(res.profile);
    }
  };

  const handleLiveryClick = (targetId: string) => {
    onPlayClickSound?.();
    const res = buyOrEquipLivery(targetId);
    if (res.ok) {
      onUpdateProfile(res.profile);
      onSelectLivery(targetId);
    }
  };

  const handleUnderglow = (id: PlayerProfile['underglowId']) => {
    onPlayClickSound?.();
    const next = setProfileUnderglow(id);
    onUpdateProfile(next);
  };

  const handleWing = (id: PlayerProfile['wingStyle']) => {
    onPlayClickSound?.();
    const next = setProfileWingStyle(id);
    onUpdateProfile(next);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-[#090B10]/88 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="garage-title"
        className="w-full max-w-3xl bg-[#11151E] border border-white/15 rounded-2xl p-5 sm:p-6 space-y-5 my-auto"
      >
        {/* Header with Credits & Rank */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
              <span>{rank.name}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-slate-400">Lv.{rank.levelIndex}</span>
            </div>
            <h2 id="garage-title" className="font-display font-bold text-2xl text-white mt-0.5">
              Nexora Garage &amp; Tuning
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#0B0E14] border border-amber-500/35 rounded-xl px-4 py-2 text-right">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Credits
              </div>
              <div className="font-mono-tabular font-bold text-lg text-amber-400 leading-tight">
                {profile.credits.toLocaleString()} CR
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Garage"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#0B0E14] border border-white/10">
          {([
            { id: 'cars', label: 'Cars', icon: Car },
            { id: 'upgrades', label: 'Upgrades', icon: Wrench },
            { id: 'customize', label: 'Customize', icon: Palette },
            { id: 'career', label: 'Career', icon: Trophy },
          ] as const).map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onPlayClickSound?.();
                  setTab(id);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  active ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Car Dealership */}
        {tab === 'cars' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[56vh] overflow-y-auto pr-1">
            {CAR_CATALOG.map((car) => {
              const owned = profile.unlockedCars.includes(car.id);
              const selected = profile.selectedCarId === car.id;
              const canAfford = profile.credits >= car.priceCredits;

              return (
                <div
                  key={car.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-4 ${
                    selected
                      ? 'bg-orange-600/12 border-orange-500'
                      : 'bg-[#0B0E14] border-white/12'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider">
                          {car.category}
                        </div>
                        <div className="font-display font-bold text-lg text-white mt-0.5">
                          {car.name}
                        </div>
                      </div>
                      <span
                        className="w-6 h-6 rounded-md border border-white/30 shrink-0"
                        style={{ backgroundColor: car.defaultColor }}
                      />
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{car.tagline}</p>

                    <div className="space-y-1.5 pt-1">
                      {[
                        { label: 'Top Speed', val: car.displayRatings.speed },
                        { label: 'Accel', val: car.displayRatings.accel },
                        { label: 'Handling', val: car.displayRatings.handling },
                        { label: 'Nitrous', val: car.displayRatings.nitro },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center gap-2 text-[11px]">
                          <span className="w-16 text-slate-400 shrink-0">{stat.label}</span>
                          <div className="flex-1 h-1.5 rounded-xs bg-white/10 overflow-hidden">
                            <div
                              className={`h-full ${
                                selected ? 'bg-orange-400' : 'bg-slate-200'
                              }`}
                              style={{ width: `${stat.val}%` }}
                            />
                          </div>
                          <span className="w-7 text-right font-mono-tabular font-semibold text-slate-200">
                            {stat.val}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selected ? (
                    <div className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-orange-600/25 border border-orange-500/50 text-xs font-bold text-orange-300">
                      <Check className="w-4 h-4" />
                      <span>Active Vehicle</span>
                    </div>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => handleCarAction(car.id)}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#1A202E] hover:bg-[#232B3D] border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      Drive This Car
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleCarAction(car.id)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Unlock · {car.priceCredits.toLocaleString()} CR</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Performance Upgrades */}
        {tab === 'upgrades' && (
          <div className="space-y-4 max-h-[56vh] overflow-y-auto pr-1">
            {/* Combined Current Car Rating Strip */}
            <div className="bg-[#0B0E14] border border-white/12 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold text-orange-400">
                  Active Chassis Spec
                </div>
                <div className="font-display font-bold text-base text-white">{specs.carName}</div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: 'SPD', val: specs.ratings.speed },
                  { label: 'ACC', val: specs.ratings.accel },
                  { label: 'HDL', val: specs.ratings.handling },
                  { label: 'N2O', val: specs.ratings.nitro },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="text-[10px] text-slate-400">{r.label}</div>
                    <div className="font-mono-tabular font-bold text-base text-white">{r.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {UPGRADE_DEFS.map((u) => {
                const level = profile.upgrades[u.slot] ?? 0;
                const maxed = level >= 3;
                const nextCost = maxed ? 0 : u.stageCosts[level];
                const canAfford = !maxed && profile.credits >= nextCost;

                return (
                  <div
                    key={u.slot}
                    className="bg-[#0B0E14] border border-white/12 rounded-xl p-4 flex flex-col justify-between gap-3.5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display font-bold text-base text-white">{u.name}</div>
                          <div className="text-[11px] font-semibold text-orange-400 mt-0.5">
                            {u.bonusPerStageLabel}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 pt-1" aria-label={`Stage ${level} of 3`}>
                          {[0, 1, 2].map((stageIdx) => (
                            <span
                              key={stageIdx}
                              className={`w-3.5 h-2 rounded-xs ${
                                stageIdx < level ? 'bg-orange-500' : 'bg-white/15'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{u.description}</p>
                    </div>

                    {maxed ? (
                      <div className="py-2.5 px-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-center text-xs font-bold text-emerald-300">
                        STAGE 3 MAXED
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleUpgrade(u.slot)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                          canAfford
                            ? 'bg-orange-600 hover:bg-orange-500 text-white cursor-pointer'
                            : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>
                          Install Stage {level + 1} · {nextCost.toLocaleString()} CR
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Visual Customization */}
        {tab === 'customize' && (
          <div className="space-y-5 max-h-[56vh] overflow-y-auto pr-1">
            {/* Paint Liveries */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Body Paint Liveries
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CAR_LIVERIES.map((liv) => {
                  const unlocked =
                    liv.priceCredits === 0 || profile.unlockedLiveries.includes(liv.id);
                  const active = liveryId === liv.id;
                  const canAfford = profile.credits >= liv.priceCredits;
                  return (
                    <button
                      key={liv.id}
                      type="button"
                      disabled={!unlocked && !canAfford}
                      onClick={() => handleLiveryClick(liv.id)}
                      className={`text-left p-2.5 rounded-xl border transition-colors ${
                        active
                          ? 'bg-orange-600/20 border-orange-500 text-white cursor-pointer'
                          : unlocked
                            ? 'bg-[#0B0E14] border-white/12 text-slate-200 hover:border-white/30 cursor-pointer'
                            : canAfford
                              ? 'bg-[#0B0E14] border-amber-500/40 text-amber-200 hover:border-amber-400 cursor-pointer'
                              : 'bg-[#0B0E14] border-white/8 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span
                          className="w-6 h-6 rounded-md border border-white/30 shrink-0"
                          style={{ backgroundColor: liv.bodyHex }}
                        />
                        {active ? (
                          <Check className="w-4 h-4 text-orange-400" />
                        ) : !unlocked ? (
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                        ) : null}
                      </div>
                      <div className="text-xs font-semibold truncate">{liv.name}</div>
                      <div className="font-mono-tabular text-[10px] text-slate-400 mt-0.5">
                        {unlocked ? (active ? 'Equipped' : 'Owned') : `${liv.priceCredits} CR`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Neon Underglow */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chassis Neon Underglow (Free Switch)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {UNDERGLOW_OPTIONS.map((glow) => {
                  const active = profile.underglowId === glow.id;
                  return (
                    <button
                      key={glow.id}
                      type="button"
                      onClick={() => handleUnderglow(glow.id)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-orange-600/20 border-orange-500 text-white'
                          : 'bg-[#0B0E14] border-white/12 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <div
                        className="h-1.5 w-full rounded-xs mb-2 border border-white/15"
                        style={{ backgroundColor: glow.hex ?? '#1E293B' }}
                      />
                      <div className="text-xs font-semibold truncate">{glow.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rear Wing Aero */}
            <div className="space-y-2.5 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Rear Wing Aero Package
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {WING_OPTIONS.map((w) => {
                  const active = profile.wingStyle === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleWing(w.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-orange-600/20 border-orange-500 text-white'
                          : 'bg-[#0B0E14] border-white/12 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <div className="text-xs font-bold">{w.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{w.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Career & Badges */}
        {tab === 'career' && (
          <div className="space-y-4 max-h-[56vh] overflow-y-auto pr-1">
            <div className="bg-[#0B0E14] border border-white/12 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">Current Driver Rank</div>
                  <div className="font-display font-bold text-xl text-white mt-0.5">
                    {rank.name}
                  </div>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="text-xs text-slate-400">Total XP</div>
                  <div className="font-bold text-lg text-orange-400">
                    {profile.xp.toLocaleString()} XP
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2 w-full rounded-xs bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-orange-500"
                    style={{ width: `${Math.round(rank.progressRatio * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                  <span>{rank.currentMinXp.toLocaleString()} XP</span>
                  <span>
                    {rank.nextRankName
                      ? `Next: ${rank.nextRankName} (${rank.nextMinXp.toLocaleString()} XP)`
                      : 'Maximum Rank Reached'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-white/10 text-center">
                {[
                  { label: 'Circuit Wins', val: profile.stats.circuitWins },
                  { label: 'Perfect Starts', val: profile.stats.perfectLaunches },
                  { label: 'Nitro Boosts', val: profile.stats.nitroTriggers },
                  { label: 'Slipstreams', val: profile.stats.slipstreamPasses },
                  { label: 'Distance', val: `${profile.stats.totalDistanceKm.toFixed(1)} km` },
                ].map((s) => (
                  <div key={s.label} className="bg-[#11151E] border border-white/8 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400">{s.label}</div>
                    <div className="font-mono-tabular font-bold text-sm text-white mt-0.5">
                      {s.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Milestone Badges ({profile.unlockedBadges.length}/{BADGE_CATALOG.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BADGE_CATALOG.map((badge) => {
                  const unlocked = profile.unlockedBadges.includes(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border ${
                        unlocked
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-[#0B0E14] border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {unlocked ? (
                          <Award className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <Flame className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div
                            className={`text-xs font-bold ${
                              unlocked ? 'text-emerald-200' : 'text-white'
                            }`}
                          >
                            {badge.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {badge.description}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`font-mono-tabular text-[11px] font-bold shrink-0 ${
                          unlocked ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {unlocked ? 'Earned' : `+${badge.rewardCredits} CR`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Back to Track
        </button>
      </div>
    </div>
  );
};
