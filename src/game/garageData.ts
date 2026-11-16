import {
  CarId,
  CarSpecDefinition,
  EffectiveCarSpecs,
  PlayerProfile,
  UnderglowId,
  UpgradeSlot,
  WingStyleId,
} from './types';

export const CAR_CATALOG: CarSpecDefinition[] = [
  {
    id: 'gt3-r',
    name: 'Nexora GT3-R',
    category: 'Street GT3',
    tagline: 'Balanced aero chassis built for circuit precision and clean overtakes.',
    priceCredits: 0,
    defaultColor: '#E84A1B',
    topSpeedMult: 1.0,
    accelMult: 1.0,
    handlingMult: 1.0,
    driftGripMult: 1.0,
    nitroCapacity: 100,
    nitroPowerMult: 1.0,
    nitroRefillMult: 1.0,
    displayRatings: {
      speed: 74,
      accel: 72,
      handling: 76,
      nitro: 70,
    },
  },
  {
    id: 'vortex-rs',
    name: 'Vortex Drift RS',
    category: 'Touge Spec',
    tagline: 'Snappy rear-bias balance that holds long slides and recharges nitro fast.',
    priceCredits: 1200,
    defaultColor: '#2563EB',
    topSpeedMult: 0.97,
    accelMult: 1.06,
    handlingMult: 1.1,
    driftGripMult: 0.78,
    nitroCapacity: 115,
    nitroPowerMult: 1.08,
    nitroRefillMult: 1.35,
    displayRatings: {
      speed: 72,
      accel: 80,
      handling: 88,
      nitro: 84,
    },
  },
  {
    id: 'spectre-v10',
    name: 'Spectre V10 Twin-Turbo',
    category: 'Highway Hyper',
    tagline: 'Brutal top-end pull tuned to dominate expressway gaps and long straights.',
    priceCredits: 2600,
    defaultColor: '#DC2626',
    topSpeedMult: 1.11,
    accelMult: 1.13,
    handlingMult: 0.98,
    driftGripMult: 1.04,
    nitroCapacity: 120,
    nitroPowerMult: 1.18,
    nitroRefillMult: 1.1,
    displayRatings: {
      speed: 93,
      accel: 88,
      handling: 74,
      nitro: 86,
    },
  },
  {
    id: 'phantom-apex',
    name: 'Phantom Apex Prototype',
    category: 'Endurance LMP',
    tagline: 'Full-carbon track prototype with blistering corner grip and extended nitrous.',
    priceCredits: 4800,
    defaultColor: '#1C2029',
    topSpeedMult: 1.15,
    accelMult: 1.2,
    handlingMult: 1.16,
    driftGripMult: 1.08,
    nitroCapacity: 135,
    nitroPowerMult: 1.24,
    nitroRefillMult: 1.25,
    displayRatings: {
      speed: 98,
      accel: 96,
      handling: 95,
      nitro: 96,
    },
  },
];

export interface UpgradeDefinition {
  slot: UpgradeSlot;
  name: string;
  description: string;
  stageCosts: [number, number, number];
  bonusPerStageLabel: string;
}

export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    slot: 'engine',
    name: 'Twin-Scroll Turbo',
    description: 'Boosts peak engine horsepower and straight-line top speed.',
    stageCosts: [350, 750, 1400],
    bonusPerStageLabel: '+4% Top Speed & Pull',
  },
  {
    slot: 'tires',
    name: 'Semi-Slick Compound',
    description: 'Increases cornering bite and high-speed stability through chicanes.',
    stageCosts: [300, 650, 1200],
    bonusPerStageLabel: '+5% Cornering Grip',
  },
  {
    slot: 'gearbox',
    name: 'Sequential Gearbox',
    description: 'Shortens shift recovery and sharpens launch & exit acceleration.',
    stageCosts: [320, 700, 1300],
    bonusPerStageLabel: '+5% Launch & Accel',
  },
  {
    slot: 'nitro',
    name: 'Cryo Nitrous Kit',
    description: 'Expands tank pressure, boost thrust, and slipstream/drift recharge rate.',
    stageCosts: [350, 720, 1350],
    bonusPerStageLabel: '+12% Tank & Recharge',
  },
];

export const UNDERGLOW_OPTIONS: Array<{
  id: UnderglowId;
  name: string;
  hex: string | null;
}> = [
  { id: 'none', name: 'Off', hex: null },
  { id: 'orange', name: 'Apex Orange', hex: '#F97316' },
  { id: 'cyan', name: 'Electric Cyan', hex: '#38BDF8' },
  { id: 'crimson', name: 'Crimson Red', hex: '#EF4444' },
  { id: 'gold', name: 'Solar Gold', hex: '#FACC15' },
];

export const WING_OPTIONS: Array<{
  id: WingStyleId;
  name: string;
  desc: string;
}> = [
  { id: 'gt3', name: 'Swan-Neck GT3', desc: 'Cambered endurance wing' },
  { id: 'drag', name: 'Low-Drag Blade', desc: 'Flush carbon ducktail aero' },
  { id: 'twin-track', name: 'Twin-Plane Pro', desc: 'High-downforce dual deck' },
];

export interface DriverRankInfo {
  name: string;
  minXp: number;
}

export const DRIVER_RANKS: DriverRankInfo[] = [
  { name: 'Rookie', minXp: 0 },
  { name: 'Street Runner', minXp: 400 },
  { name: 'Contender', minXp: 1100 },
  { name: 'Pro Racer', minXp: 2300 },
  { name: 'Night Stalker', minXp: 4200 },
  { name: 'Apex Legend', minXp: 7000 },
];

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  rewardCredits: number;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'first-win',
    name: 'Street Victor',
    description: 'Win 1st place in a 3-lap Circuit Race.',
    rewardCredits: 300,
  },
  {
    id: 'perfect-launch',
    name: 'Hair-Trigger Launch',
    description: 'Nail a Perfect Launch in the green RPM zone at race start.',
    rewardCredits: 200,
  },
  {
    id: 'untouchable-highway',
    name: 'Untouchable',
    description: 'Reach 2.0 km in a single Highway Rush run.',
    rewardCredits: 450,
  },
  {
    id: 'drift-master',
    name: 'Sideways Royalty',
    description: 'Score 15,000+ points in a Drift King session.',
    rewardCredits: 450,
  },
  {
    id: 'nitro-addict',
    name: 'Boost Junkie',
    description: 'Fire Nitrous Boost 15 times across races.',
    rewardCredits: 250,
  },
  {
    id: 'daily-sweep',
    name: 'Daily Sweeper',
    description: 'Complete all 3 Daily Challenge tasks in a single day.',
    rewardCredits: 600,
  },
];

export function getCarDefinition(carId: CarId): CarSpecDefinition {
  return CAR_CATALOG.find((c) => c.id === carId) ?? CAR_CATALOG[0];
}

export function getEffectiveCarSpecs(profile: PlayerProfile): EffectiveCarSpecs {
  const car = getCarDefinition(profile.selectedCarId);
  const engLv = Math.max(0, Math.min(3, profile.upgrades.engine || 0));
  const tireLv = Math.max(0, Math.min(3, profile.upgrades.tires || 0));
  const gearLv = Math.max(0, Math.min(3, profile.upgrades.gearbox || 0));
  const nitroLv = Math.max(0, Math.min(3, profile.upgrades.nitro || 0));

  const topSpeedMult = car.topSpeedMult + engLv * 0.036;
  const accelMult = car.accelMult + engLv * 0.03 + gearLv * 0.05;
  const handlingMult = car.handlingMult + tireLv * 0.055;
  const driftGripMult = car.driftGripMult + tireLv * 0.03;
  const nitroCapacity = car.nitroCapacity + nitroLv * 14;
  const nitroPowerMult = car.nitroPowerMult + nitroLv * 0.06;
  const nitroRefillMult = car.nitroRefillMult + nitroLv * 0.14;

  return {
    carId: car.id,
    carName: car.name,
    topSpeedMult,
    accelMult,
    handlingMult,
    driftGripMult,
    nitroCapacity,
    nitroPowerMult,
    nitroRefillMult,
    ratings: {
      speed: Math.min(100, Math.round(car.displayRatings.speed + engLv * 5)),
      accel: Math.min(100, Math.round(car.displayRatings.accel + (engLv * 3 + gearLv * 5))),
      handling: Math.min(100, Math.round(car.displayRatings.handling + tireLv * 5)),
      nitro: Math.min(100, Math.round(car.displayRatings.nitro + nitroLv * 6)),
    },
  };
}
