// Gem TD - Configuration & Game Constants

export const CONFIG = {
  GRID_WIDTH: 33,
  GRID_HEIGHT: 33,
  DEFAULT_TILE_SIZE: 24, // in canvas pixels

  CHECKPOINTS: [
    { id: 0, x: 2, y: 2, name: 'Spawn Portal', color: '#38bdf8' },
    { id: 1, x: 30, y: 2, name: 'Waypoint 1', color: '#f87171' },
    { id: 2, x: 30, y: 30, name: 'Waypoint 2', color: '#4ade80' },
    { id: 3, x: 2, y: 30, name: 'Waypoint 3', color: '#c084fc' },
    { id: 4, x: 16, y: 16, name: 'Gem Castle', color: '#fbbf24' }
  ],

  STARTING_LIVES: 50,
  STARTING_GOLD: 60,
  GEMS_PER_ROUND: 5,
  CREEPS_PER_WAVE: 10,
  SPAWN_INTERVAL_MS: 900,

  // Costs & Gold Sinks
  SLATE_REMOVE_COST: 15,
  REROLL_COST: 20,
  DOWNGRADE_COST: 10,
  MOVE_TOWER_COST: 30,
  HEAL_CASTLE_COST: 60,
  HEAL_CASTLE_AMOUNT: 10,
  MAX_TOWER_RUNES: 3,

  CHANCE_UPGRADES: [
    { level: 1, cost: 0,   chances: [1.00, 0.00, 0.00, 0.00, 0.00], label: 'Level 1: 100% Chipped' },
    { level: 2, cost: 20,  chances: [0.70, 0.30, 0.00, 0.00, 0.00], label: 'Level 2: 70% Chipped, 30% Flawed' },
    { level: 3, cost: 60,  chances: [0.40, 0.45, 0.15, 0.00, 0.00], label: 'Level 3: 40% Chipped, 45% Flawed, 15% Regular' },
    { level: 4, cost: 150, chances: [0.20, 0.35, 0.35, 0.10, 0.00], label: 'Level 4: 20% Chipped, 35% Flawed, 35% Reg, 10% Flawless' },
    { level: 5, cost: 350, chances: [0.10, 0.25, 0.35, 0.25, 0.05], label: 'Level 5: 10% Chipped, 25% Flawed, 35% Reg, 25% Flawless, 5% Perfect' },
    { level: 6, cost: 800, chances: [0.05, 0.15, 0.30, 0.35, 0.15], label: 'Level 6: 5% Chipped, 15% Flawed, 30% Reg, 35% Flawless, 15% Perfect' }
  ]
};

export const TRAP_TYPES = {
  spike: {
    id: 'spike',
    name: 'Caltrop Spikes',
    cost: 20,
    icon: '🗡️',
    color: '#f87171',
    glow: '#ef4444',
    charges: 3,
    triggerRadius: 18,
    effectRadius: 35,
    damage: 350,
    damageType: 'physical',
    description: '3 Charges: Deals 350 physical damage to creeps stepping on it.'
  },
  frost: {
    id: 'frost',
    name: 'Frost Sigil',
    cost: 30,
    icon: '❄️',
    color: '#38bdf8',
    glow: '#0284c7',
    charges: 2,
    triggerRadius: 18,
    effectRadius: 75,
    slowPercent: 0.65,
    slowDuration: 4.5,
    description: '2 Charges: Freezes nearby enemies with a 65% slow for 4.5 seconds.'
  },
  explosive: {
    id: 'explosive',
    name: 'Explosive Mine',
    cost: 45,
    icon: '💣',
    color: '#fb923c',
    glow: '#ea580c',
    charges: 1,
    triggerRadius: 18,
    effectRadius: 85,
    damage: 800,
    damageType: 'magic',
    description: '1 Charge: Detonates a violent blast dealing 800 Magic AoE damage.'
  },
  tar: {
    id: 'tar',
    name: 'Acid Tar Trap',
    cost: 30,
    icon: '🧪',
    color: '#a855f7',
    glow: '#7e22ce',
    charges: 2,
    triggerRadius: 18,
    effectRadius: 65,
    armorReduction: 25,
    slowPercent: 0.35,
    duration: 6.0,
    description: '2 Charges: Strips 25 armor and slows enemies by 35% for 6.0 seconds.'
  },
  stun: {
    id: 'stun',
    name: 'Arcane Snare',
    cost: 40,
    icon: '⚡',
    color: '#fbbf24',
    glow: '#d97706',
    charges: 2,
    triggerRadius: 18,
    effectRadius: 60,
    stunDuration: 2.2,
    description: '2 Charges: Shock traps that paralyze all nearby creeps for 2.2 seconds.'
  }
};

export const RUNE_TYPES = {
  haste: {
    id: 'haste',
    name: 'Rune of Swiftness',
    cost: 45,
    icon: '⚡',
    color: '#38bdf8',
    speedBonus: 0.35,
    description: '+35% Attack Speed to the socketed tower.'
  },
  ferocity: {
    id: 'ferocity',
    name: 'Rune of Ferocity',
    cost: 60,
    icon: '🔥',
    color: '#f87171',
    damageBonus: 0.40,
    critChance: 0.20,
    critMultiplier: 2.5,
    description: '+40% Base Damage and +20% Critical Strike (2.5x).'
  },
  range: {
    id: 'range',
    name: 'Rune of Eagle Eye',
    cost: 40,
    icon: '🎯',
    color: '#34d399',
    rangeBonus: 50,
    trueStrike: true,
    description: '+50 Attack Range and True Strike (attacks never miss evasion).'
  },
  frost: {
    id: 'frost',
    name: 'Rune of Glaciation',
    cost: 50,
    icon: '❄️',
    color: '#67e8f9',
    slowPercent: 0.35,
    slowDuration: 3.5,
    description: 'Attacks chill targets with a 35% movement slow for 3.5s.'
  },
  venom: {
    id: 'venom',
    name: 'Rune of Venom',
    cost: 55,
    icon: '🧪',
    color: '#4ade80',
    poisonDps: 180,
    poisonDuration: 4.5,
    description: 'Attacks coat enemies in venom dealing 180 Magic Poison DPS.'
  },
  midas: {
    id: 'midas',
    name: 'Rune of Midas',
    cost: 70,
    icon: '🪙',
    color: '#fbbf24',
    bonusGoldChance: 0.25,
    bonusGold: 3,
    description: '25% chance to extract +3 bonus gold on every attack hit.'
  }
};

export const QUALITIES = {
  1: { level: 1, name: 'Chipped', code: '1', color: '#cd7f32', border: '#8c501e', scale: 0.65, ringColor: '#b87333', namePrefix: 'Chipped' },
  2: { level: 2, name: 'Flawed', code: '2', color: '#a0b2c6', border: '#607286', scale: 0.75, ringColor: '#d1d5db', namePrefix: 'Flawed' },
  3: { level: 3, name: 'Regular', code: '3', color: '#ffd700', border: '#b8860b', scale: 0.85, ringColor: '#facc15', namePrefix: 'Regular' },
  4: { level: 4, name: 'Flawless', code: '4', color: '#38bdf8', border: '#0284c7', scale: 0.95, ringColor: '#38bdf8', namePrefix: 'Flawless' },
  5: { level: 5, name: 'Perfect', code: '5', color: '#e879f9', border: '#a855f7', scale: 1.10, ringColor: '#c084fc', glow: true, namePrefix: 'Perfect' }
};

export const BASE_GEMS = {
  'B': {
    code: 'B',
    name: 'Sapphire',
    gemColor: '#2563eb',
    accentColor: '#93c5fd',
    description: 'Chills targets, reducing enemy movement speed.',
    baseDamage: [0, 8, 20, 50, 120, 300],
    attackSpeed: [0, 1.0, 1.0, 1.0, 1.0, 1.0], // attacks per second
    range: [0, 140, 150, 160, 175, 190],
    effect: 'slow',
    effectValue: [0, 0.20, 0.30, 0.40, 0.50, 0.60], // slow percentage
    effectDuration: [0, 3.0, 3.5, 4.0, 4.5, 5.0] // seconds
  },
  'D': {
    code: 'D',
    name: 'Diamond',
    gemColor: '#f8fafc',
    accentColor: '#38bdf8',
    description: 'High physical single-target piercing damage.',
    baseDamage: [0, 20, 50, 130, 320, 800],
    attackSpeed: [0, 1.1, 1.1, 1.2, 1.25, 1.3],
    range: [0, 150, 160, 175, 190, 210],
    effect: 'pierce'
  },
  'Y': {
    code: 'Y',
    name: 'Topaz',
    gemColor: '#eab308',
    accentColor: '#fef08a',
    description: 'Multi-shot arrows hitting multiple targets simultaneously.',
    baseDamage: [0, 8, 20, 50, 120, 300],
    attackSpeed: [0, 1.0, 1.0, 1.0, 1.0, 1.0],
    range: [0, 140, 150, 160, 175, 190],
    effect: 'multishot',
    effectValue: [0, 2, 3, 4, 5, 6] // targets
  },
  'E': {
    code: 'E',
    name: 'Emerald',
    gemColor: '#16a34a',
    accentColor: '#86efac',
    description: 'Inflicts deadly poison that deals continuous damage over time.',
    baseDamage: [0, 8, 20, 50, 120, 300],
    attackSpeed: [0, 1.0, 1.0, 1.0, 1.0, 1.0],
    range: [0, 140, 150, 160, 175, 190],
    effect: 'poison',
    effectValue: [0, 6, 16, 45, 110, 280], // damage per sec
    effectDuration: [0, 4.0, 4.0, 4.0, 4.5, 5.0]
  },
  'G': {
    code: 'G',
    name: 'Opal',
    gemColor: '#14b8a6',
    accentColor: '#ccfbf1',
    description: 'Emits an attack speed aura buffing all nearby allied towers.',
    baseDamage: [0, 10, 25, 65, 160, 400],
    attackSpeed: [0, 1.0, 1.0, 1.0, 1.0, 1.0],
    range: [0, 130, 140, 150, 165, 180],
    effect: 'aura_speed',
    effectValue: [0, 0.15, 0.25, 0.35, 0.50, 0.70], // +% attack speed
    effectRadius: [0, 110, 120, 135, 150, 170]
  },
  'Q': {
    code: 'Q',
    name: 'Aquamarine',
    gemColor: '#06b6d4',
    accentColor: '#a5f3fc',
    description: 'Rapid-fire hydro bolts with bonus damage against flying units.',
    baseDamage: [0, 7, 18, 45, 110, 270],
    attackSpeed: [0, 2.0, 2.2, 2.4, 2.7, 3.0], // very fast attack speed
    range: [0, 130, 140, 150, 165, 180],
    effect: 'anti_air',
    effectValue: [0, 1.5, 1.75, 2.0, 2.5, 3.0] // damage multiplier vs flying
  },
  'R': {
    code: 'R',
    name: 'Ruby',
    gemColor: '#dc2626',
    accentColor: '#fca5a5',
    description: 'Explosive fiery missiles that deal area of effect (AoE) splash damage.',
    baseDamage: [0, 10, 25, 65, 160, 400],
    attackSpeed: [0, 0.9, 0.9, 0.95, 1.0, 1.05],
    range: [0, 130, 140, 150, 165, 180],
    effect: 'splash',
    effectRadius: [0, 45, 50, 60, 70, 85],
    effectValue: [0, 0.5, 0.5, 0.5, 0.5, 0.5] // % splash damage
  },
  'P': {
    code: 'P',
    name: 'Amethyst',
    gemColor: '#9333ea',
    accentColor: '#d8b4fe',
    description: 'Shatters enemy armor, causing them to take increased damage from all towers.',
    baseDamage: [0, 8, 20, 50, 120, 300],
    attackSpeed: [0, 1.0, 1.0, 1.0, 1.0, 1.0],
    range: [0, 140, 150, 160, 175, 190],
    effect: 'armor_shred',
    effectValue: [0, 2, 4, 7, 11, 16], // armor reduction
    effectDuration: [0, 4.0, 4.0, 4.0, 4.5, 5.0]
  }
};

export const WAVES = [
  { wave: 1, name: 'Frenzied Pig', count: 10, hp: 50, armor: 0, speed: 1.0, isFlying: false, isBoss: false, gold: 1 },
  { wave: 2, name: 'Swift Frog', count: 10, hp: 85, armor: 0, speed: 1.25, isFlying: false, isBoss: false, gold: 1 },
  { wave: 3, name: 'Sturdy Yak', count: 10, hp: 140, armor: 2, speed: 0.9, isFlying: false, isBoss: false, gold: 2 },
  { wave: 4, name: 'Smart Robot', count: 10, hp: 210, armor: 3, speed: 1.0, isFlying: false, isBoss: false, gold: 2 },
  { wave: 5, name: 'Baby Panda', count: 10, hp: 280, armor: 1, speed: 1.15, isFlying: true, isBoss: false, gold: 3, trait: 'Flying' },
  { wave: 6, name: 'Tardy Stump', count: 10, hp: 420, armor: 4, speed: 0.8, isFlying: false, isBoss: false, gold: 3 },
  { wave: 7, name: 'Satisfied Lizard', count: 10, hp: 560, armor: 2, speed: 1.05, isFlying: false, isBoss: false, gold: 3 },
  { wave: 8, name: 'Invisible Spider', count: 10, hp: 700, armor: 2, speed: 1.1, isFlying: false, isBoss: false, gold: 4, trait: 'Vitality' },
  { wave: 9, name: 'Dusky', count: 10, hp: 900, armor: 3, speed: 1.15, isFlying: false, isBoss: false, gold: 4, trait: 'Evasion (20%)' },
  { wave: 10, name: 'Invincible Dog', count: 1, hp: 6500, armor: 6, speed: 0.85, isFlying: false, isBoss: true, gold: 25, trait: 'Boss' },

  { wave: 11, name: 'Wild Sheep', count: 10, hp: 1200, armor: 3, speed: 1.0, isFlying: false, isBoss: false, gold: 5 },
  { wave: 12, name: 'Funny Alpaca', count: 10, hp: 1550, armor: 4, speed: 1.1, isFlying: false, isBoss: false, gold: 5 },
  { wave: 13, name: 'Pig Princess', count: 10, hp: 1950, armor: 5, speed: 1.05, isFlying: false, isBoss: false, gold: 6 },
  { wave: 14, name: 'Bulldog', count: 10, hp: 2400, armor: 6, speed: 0.95, isFlying: false, isBoss: false, gold: 6, trait: 'Refraction' },
  { wave: 15, name: 'Cat & Dog', count: 10, hp: 2900, armor: 3, speed: 1.2, isFlying: true, isBoss: false, gold: 7, trait: 'Flying' },
  { wave: 16, name: 'Young Demon', count: 10, hp: 3500, armor: 5, speed: 1.1, isFlying: false, isBoss: false, gold: 7, trait: 'Magic Immune' },
  { wave: 17, name: 'Belted Chicken', count: 10, hp: 4200, armor: 4, speed: 1.15, isFlying: false, isBoss: false, gold: 8 },
  { wave: 18, name: 'Bajie', count: 10, hp: 5000, armor: 6, speed: 1.0, isFlying: false, isBoss: false, gold: 8 },
  { wave: 19, name: 'Donkeytrio', count: 10, hp: 6000, armor: 5, speed: 1.3, isFlying: false, isBoss: false, gold: 9, trait: 'Rush' },
  { wave: 20, name: 'Shakbag', count: 1, hp: 38000, armor: 10, speed: 0.85, isFlying: false, isBoss: true, gold: 50, trait: 'Boss' },

  { wave: 21, name: 'Crystal Crab', count: 10, hp: 7500, armor: 8, speed: 0.9, isFlying: false, isBoss: false, gold: 10, trait: 'Vitality' },
  { wave: 22, name: 'Lockyaw', count: 10, hp: 9200, armor: 16, speed: 1.0, isFlying: false, isBoss: false, gold: 10, trait: 'High Armor' },
  { wave: 23, name: 'Flopjaw', count: 10, hp: 11000, armor: 6, speed: 1.1, isFlying: false, isBoss: false, gold: 11, trait: 'Physical Immune' },
  { wave: 24, name: 'Mech Donkey', count: 10, hp: 13200, armor: 10, speed: 1.0, isFlying: false, isBoss: false, gold: 12 },
  { wave: 25, name: 'Cosair', count: 10, hp: 15500, armor: 12, speed: 1.2, isFlying: true, isBoss: false, gold: 13, trait: 'Flying / Armored' },
  { wave: 26, name: 'Skateboard Flamingo', count: 10, hp: 18500, armor: 7, speed: 1.35, isFlying: false, isBoss: false, gold: 14, trait: 'Magic Immune' },
  { wave: 27, name: 'LGD Goldfish', count: 10, hp: 22000, armor: 8, speed: 1.15, isFlying: true, isBoss: false, gold: 15, trait: 'Flying / Ethereal' },
  { wave: 28, name: 'Timbersaw', count: 10, hp: 26000, armor: 18, speed: 1.05, isFlying: true, isBoss: false, gold: 16, trait: 'Flying / Reactive Armor' },
  { wave: 29, name: 'VG Fox', count: 10, hp: 31000, armor: 10, speed: 1.3, isFlying: true, isBoss: false, gold: 18, trait: 'Flying / Evasion' },
  { wave: 30, name: 'Carpet Rider', count: 1, hp: 180000, armor: 15, speed: 0.95, isFlying: true, isBoss: true, gold: 100, trait: 'Flying Boss' },

  { wave: 31, name: 'Bookwyrm', count: 10, hp: 38000, armor: 12, speed: 1.1, isFlying: false, isBoss: false, gold: 20, trait: 'Magic Immune' },
  { wave: 32, name: 'Rechargeable Shark', count: 10, hp: 46000, armor: 14, speed: 1.15, isFlying: false, isBoss: false, gold: 22, trait: 'Recharge' },
  { wave: 33, name: 'Ribboned Zombie', count: 10, hp: 55000, armor: 10, speed: 1.0, isFlying: false, isBoss: false, gold: 24, trait: 'Physical Immune' },
  { wave: 34, name: 'Babybloody', count: 10, hp: 66000, armor: 12, speed: 1.3, isFlying: true, isBoss: false, gold: 26, trait: 'Flying / Evasion' },
  { wave: 35, name: 'Black & White Fox', count: 10, hp: 78000, armor: 14, speed: 1.25, isFlying: true, isBoss: false, gold: 28, trait: 'Flying / Magic Immune' },
  { wave: 36, name: 'Jumo', count: 10, hp: 92000, armor: 12, speed: 1.1, isFlying: false, isBoss: false, gold: 30, trait: 'Physical Immune' },
  { wave: 37, name: 'Baeko', count: 10, hp: 108000, armor: 16, speed: 1.2, isFlying: false, isBoss: false, gold: 32 },
  { wave: 38, name: 'Lilnova', count: 10, hp: 126000, armor: 18, speed: 1.15, isFlying: false, isBoss: false, gold: 35, trait: 'Vitality' },
  { wave: 39, name: 'Newt', count: 10, hp: 148000, armor: 20, speed: 1.35, isFlying: true, isBoss: false, gold: 40, trait: 'Flying / Evasion' },
  { wave: 40, name: 'Thrilling Ghost', count: 1, hp: 750000, armor: 25, speed: 0.95, isFlying: true, isBoss: true, gold: 200, trait: 'Flying Boss' },

  { wave: 41, name: 'Azuremir', count: 10, hp: 180000, armor: 22, speed: 1.1, isFlying: false, isBoss: false, gold: 45 },
  { wave: 42, name: 'Kupu', count: 10, hp: 220000, armor: 20, speed: 1.4, isFlying: true, isBoss: false, gold: 50, trait: 'Flying Rush' },
  { wave: 43, name: 'Furry Fish', count: 10, hp: 265000, armor: 24, speed: 1.15, isFlying: false, isBoss: false, gold: 55, trait: 'Evasion / Recharge' },
  { wave: 44, name: 'Shroomy', count: 10, hp: 320000, armor: 22, speed: 1.2, isFlying: false, isBoss: false, gold: 60, trait: 'Magic Immune' },
  { wave: 45, name: 'Chirpy', count: 10, hp: 380000, armor: 25, speed: 1.3, isFlying: true, isBoss: false, gold: 70, trait: 'Flying' },
  { wave: 46, name: 'Boooofus', count: 10, hp: 460000, armor: 20, speed: 1.1, isFlying: false, isBoss: false, gold: 80, trait: 'Physical Immune' },
  { wave: 47, name: 'Crummy', count: 10, hp: 550000, armor: 28, speed: 1.35, isFlying: false, isBoss: false, gold: 90, trait: 'Magic Immune / Rush' },
  { wave: 48, name: 'Wabbit', count: 10, hp: 660000, armor: 26, speed: 1.4, isFlying: true, isBoss: false, gold: 100, trait: 'Flying / Magic Immune' },
  { wave: 49, name: 'Drodo', count: 10, hp: 800000, armor: 32, speed: 1.1, isFlying: false, isBoss: false, gold: 120, trait: 'Kraken Shell' },
  { wave: 50, name: 'Baby Roshan', count: 1, hp: 3500000, armor: 40, speed: 0.9, isFlying: true, isBoss: true, gold: 500, trait: 'FINAL BOSS (Baby Roshan)' }
];
