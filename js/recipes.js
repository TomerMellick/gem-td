// Gem TD - Special Towers & Combination Recipes Database

export const SPECIAL_TOWERS = {
  'Silver': {
    name: 'Silver',
    tier: 'Basic',
    recipe: ['B1', 'D1', 'Y1'],
    damage: 40,
    attackSpeed: 1.0,
    range: 160,
    gemColor: '#cbd5e1',
    accentColor: '#94a3b8',
    glow: '#e2e8f0',
    effect: 'slow',
    effectValue: 0.35, // 35% slow
    effectDuration: 3.5,
    description: 'Slows enemies by 35%. Excellent early game tower.',
    lore: 'A finely refined silver tower emitting a freezing mist.'
  },
  'Malachite': {
    name: 'Malachite',
    tier: 'Basic',
    recipe: ['E1', 'G1', 'Q1'],
    damage: 18,
    attackSpeed: 1.25,
    range: 160,
    gemColor: '#10b981',
    accentColor: '#34d399',
    glow: '#059669',
    effect: 'split',
    effectValue: 4, // attacks up to 4 targets
    description: 'Split Shot: Attacks up to 4 enemies at the same time.',
    lore: 'Ancient malachite stone carved into an arrow battery.'
  },
  'Asteriated Ruby': {
    name: 'Asteriated Ruby',
    tier: 'Basic',
    recipe: ['R2', 'R1', 'P1'],
    damage: 15,
    attackSpeed: 2.0,
    range: 160,
    gemColor: '#ef4444',
    accentColor: '#f87171',
    glow: '#b91c1c',
    effect: 'burn_aura',
    effectValue: 80, // 80 dmg/sec aura
    effectRadius: 160,
    description: 'Burn Aura: Radiates 80 fire damage every second to all nearby enemies.',
    lore: 'A pulsing crimson gem radiating searing heat waves.'
  },
  'Jade': {
    name: 'Jade',
    tier: 'Basic',
    recipe: ['G3', 'E3', 'B2'],
    damage: 25,
    attackSpeed: 2.0,
    range: 190,
    gemColor: '#22c55e',
    accentColor: '#86efac',
    glow: '#15803d',
    effect: 'poison',
    effectValue: 80, // 80 dps poison for 5s
    effectDuration: 5.0,
    description: 'Potent Venom: Enemies suffer 80 poison damage per second for 5 seconds.',
    lore: 'An emerald-like talisman dripping with concentrated serpent venom.'
  },
  'Quartz': {
    name: 'Quartz',
    tier: 'Basic',
    recipe: ['G4', 'R3', 'P2'],
    damage: 35,
    attackSpeed: 1.6,
    range: 150,
    gemColor: '#f472b6',
    accentColor: '#fbcfe8',
    glow: '#db2777',
    effect: 'anti_fly_aura',
    effectValue: { armor: -10, slow: 0.35 },
    effectRadius: 180,
    description: 'Air Disruption Aura: Decreases flying creeps armor by 10 and speed by 35%.',
    lore: 'High-frequency quartz crystal resonance that grounds winged beasts.'
  },
  'Silver Knight': {
    name: 'Silver Knight',
    tier: 'Intermediate',
    recipe: ['Silver', 'Q2', 'R3'],
    damage: 150,
    attackSpeed: 1.25,
    range: 180,
    gemColor: '#94a3b8',
    accentColor: '#f8fafc',
    glow: '#64748b',
    effect: 'cleave_slow',
    effectValue: { cleavePercent: 0.50, cleaveRadius: 100, slow: 0.40 },
    description: 'Cleave & Slow: Deals 50% splash damage around target and slows enemies by 40%.',
    lore: 'An armored sentinel delivering punishing sweeping strikes.'
  },
  'Pink Diamond': {
    name: 'Pink Diamond',
    tier: 'Intermediate',
    recipe: ['D5', 'D3', 'Y3'],
    damage: 280,
    attackSpeed: 1.2,
    range: 180,
    gemColor: '#f43f5e',
    accentColor: '#fda4af',
    glow: '#e11d48',
    effect: 'crit',
    effectValue: { chance: 0.20, multiplier: 5.0 }, // 20% 5x crit
    description: 'Lethal Critical: 20% chance to inflict 5x massive physical critical damage.',
    lore: 'Flawless pink diamond with cut facets sharp enough to pierce stone.'
  },
  'Vivid Malachite': {
    name: 'Vivid Malachite',
    tier: 'Intermediate',
    recipe: ['Malachite', 'D2', 'Y3'],
    damage: 75,
    attackSpeed: 1.4,
    range: 180,
    gemColor: '#059669',
    accentColor: '#6ee7b7',
    glow: '#047857',
    effect: 'split',
    effectValue: 7, // hits up to 7 enemies
    description: 'Enhanced Split: Attacks up to 7 enemies simultaneously with piercing darts.',
    lore: 'Swirling emerald mineral charged with multi-threaded arcane force.'
  },
  'Uranium-238': {
    name: 'Uranium-238',
    tier: 'Intermediate',
    recipe: ['Y5', 'B3', 'E2'],
    damage: 160,
    attackSpeed: 2.0,
    range: 180,
    gemColor: '#84cc16',
    accentColor: '#bef264',
    glow: '#4d7c0f',
    effect: 'split',
    effectValue: 5,
    description: 'Isotope Cannon: Fires high-frequency radioactive bursts hitting 5 enemies.',
    lore: 'A radioactive heavy isotope humming with unstable nuclear energy.'
  },
  'Volcano': {
    name: 'Volcano',
    tier: 'Intermediate',
    recipe: ['Asteriated Ruby', 'R4', 'P3'],
    damage: 30,
    attackSpeed: 2.0,
    range: 180,
    gemColor: '#ea580c',
    accentColor: '#fed7aa',
    glow: '#c2410c',
    effect: 'burn_aura',
    effectValue: 400, // 400 dps aura
    effectRadius: 180,
    description: 'Magma Field Aura: Immolates all nearby enemies for 400 fire damage per second.',
    lore: 'Torn from the mantle of a volcanic caldera, melting the ground around it.'
  },
  'Bloodstone': {
    name: 'Bloodstone',
    tier: 'Intermediate',
    recipe: ['R5', 'Q4', 'P3'],
    damage: 120,
    attackSpeed: 1.1,
    range: 180,
    gemColor: '#991b1b',
    accentColor: '#fca5a5',
    glow: '#7f1d1d',
    effect: 'chain_lightning',
    effectValue: { chance: 0.30, jumps: 5, damage: 350 },
    description: 'Blood Lightning: 30% chance to unleash chain lightning leaping across 5 enemies.',
    lore: 'Forged from coagulated dragon blood and thunderstorm quartz.'
  },
  'Grey Jade': {
    name: 'Grey Jade',
    tier: 'Intermediate',
    recipe: ['Jade', 'B4', 'Q3'],
    damage: 60,
    attackSpeed: 2.0,
    range: 200,
    gemColor: '#64748b',
    accentColor: '#cbd5e1',
    glow: '#475569',
    effect: 'aura_range_poison',
    effectValue: { rangeBonus: 60, poisonDps: 180, duration: 5.0 },
    effectRadius: 160,
    description: 'Overlook Aura: Increases attack range of nearby allied towers by +60. Deals 180 poison DPS.',
    lore: 'Grants keen foresight to nearby guardians.'
  },
  'Gold': {
    name: 'Gold',
    tier: 'Intermediate',
    recipe: ['P5', 'P4', 'D2'],
    damage: 130,
    attackSpeed: 1.25,
    range: 160,
    gemColor: '#eab308',
    accentColor: '#fef08a',
    glow: '#ca8a04',
    effect: 'armor_shred',
    effectValue: 25, // -25 armor
    effectDuration: 5.0,
    description: 'Armor Corrosion: Renders enemy defenses brittle, stripping 25 armor.',
    lore: 'Molten golden alloy that dissolves natural armor.'
  },
  'Dark Emerald': {
    name: 'Dark Emerald',
    tier: 'Intermediate',
    recipe: ['G5', 'B4', 'Y2'],
    damage: 180,
    attackSpeed: 2.0,
    range: 180,
    gemColor: '#064e3b',
    accentColor: '#34d399',
    glow: '#047857',
    effect: 'stun',
    effectValue: { chance: 0.20, duration: 1.2 }, // 20% stun 1.2s
    description: 'Deep Stun: 20% chance on attack to completely stun target for 1.2 seconds.',
    lore: 'A sinister verdant crystal capable of halting charging behemoths.'
  },
  'Paraiba Tourmaline': {
    name: 'Paraiba Tourmaline',
    tier: 'Intermediate',
    recipe: ['Q5', 'E4', 'G2'],
    damage: 100,
    attackSpeed: 1.6,
    range: 160,
    gemColor: '#0284c7',
    accentColor: '#7dd3fc',
    glow: '#0369a1',
    effect: 'armor_aura',
    effectValue: 15, // -15 armor aura
    effectRadius: 170,
    description: 'Decadence Aura: Weakens armor of all nearby enemies within radius by 15.',
    lore: 'Luminous neon blue mineral radiating a weakening geomagnetic field.'
  },
  'Chrysoberyl Cat\'s Eye': {
    name: 'Chrysoberyl Cat\'s Eye',
    tier: 'Intermediate',
    recipe: ['E5', 'D4', 'Q3'],
    damage: 40,
    attackSpeed: 1.0,
    range: 150,
    gemColor: '#eab308',
    accentColor: '#fef9c3',
    glow: '#a16207',
    effect: 'aura_haste_inspire',
    effectValue: { speedBonus: 0.50, damageBonus: 0.40 }, // +50% atk speed & +40% dmg
    effectRadius: 160,
    description: 'Cat\'s Eye Aura: Empowers nearby towers with +50% attack speed and +40% bonus damage.',
    lore: 'A slit-pupil gem that sharpens the instincts of surrounding towers.'
  },
  'Yellow Sapphire': {
    name: 'Yellow Sapphire',
    tier: 'Intermediate',
    recipe: ['B5', 'R4', 'Y4'],
    damage: 70,
    attackSpeed: 1.0,
    range: 170,
    gemColor: '#facc15',
    accentColor: '#fef08a',
    glow: '#ca8a04',
    effect: 'ice_aura',
    effectValue: 0.65, // 65% slow aura
    effectRadius: 170,
    description: 'Glacial Cold Aura: Slows movement speed of all nearby enemies by 65%.',
    lore: 'An icy golden sapphire freezing the air into sub-zero frost.'
  },
  'Uranium-235': {
    name: 'Uranium-235',
    tier: 'Advanced',
    recipe: ['Uranium-238', 'Malachite', 'Vivid Malachite'],
    damage: 380,
    attackSpeed: 2.0,
    range: 200,
    gemColor: '#a3e635',
    accentColor: '#ecfccb',
    glow: '#65a30d',
    effect: 'split',
    effectValue: 10, // attacks 10 enemies
    description: 'Fission Gatling: Emits a relentless barrage striking up to 10 enemies at once.',
    lore: 'Refined weapons-grade fissile material unleashing unstoppable radiation.'
  },
  'Antique Bloodstone': {
    name: 'Antique Bloodstone',
    tier: 'Advanced',
    recipe: ['Bloodstone', 'Volcano', 'R2'],
    damage: 250,
    attackSpeed: 1.25,
    range: 200,
    gemColor: '#b91c1c',
    accentColor: '#fca5a5',
    glow: '#7f1d1d',
    effect: 'forked_lightning_burn',
    effectValue: { chance: 0.35, jumps: 6, damage: 1200, burnDps: 400 },
    effectRadius: 180,
    description: 'Forked Wrath: 35% chance to cast forked lightning (1,200 dmg) + 400 Burn Aura.',
    lore: 'An ancient relic throbbing like a demonic heart, boiling nearby air.'
  },
  'Monkey King Jade': {
    name: 'Monkey King Jade',
    tier: 'Advanced',
    recipe: ['Grey Jade', 'G4', 'P2'],
    damage: 220,
    attackSpeed: 2.0,
    range: 220,
    gemColor: '#15803d',
    accentColor: '#bbf7d0',
    glow: '#166534',
    effect: 'true_strike_aura',
    effectValue: { poisonDps: 300, rangeBonus: 80, trueStrike: true },
    effectRadius: 180,
    description: 'True Strike Aura: Attacks ignore enemy evasion. +80 Range to allies. 300 Poison DPS.',
    lore: 'Blessed with Sun Wukong\'s golden staff, strikes never miss their mark.'
  },
  'Egypt Gold': {
    name: 'Egypt Gold',
    tier: 'Advanced',
    recipe: ['Gold', 'P5', 'Q2'],
    damage: 280,
    attackSpeed: 1.3,
    range: 180,
    gemColor: '#f59e0b',
    accentColor: '#fde68a',
    glow: '#d97706',
    effect: 'corrupt_greed',
    effectValue: { armorReduction: 40, greedChance: 0.15, greedMin: 5, greedMax: 20 },
    description: 'Pharaoh\'s Midas: -40 armor shred + 15% chance to extract 5-20 bonus gold on attack!',
    lore: 'Ancient pharaonic treasury that turns monster blood into glittering coins.'
  },
  'Emerald Golem': {
    name: 'Emerald Golem',
    tier: 'Advanced',
    recipe: ['Dark Emerald', 'Gold', 'D3'],
    damage: 340,
    attackSpeed: 2.0,
    range: 180,
    gemColor: '#047857',
    accentColor: '#6ee7b7',
    glow: '#065f46',
    effect: 'stone_gaze',
    effectValue: { stunChance: 0.25, armorReduction: 25, petrifySlow: 0.75 },
    description: 'Stone Gaze: Stuns for 1.5s (25%), reduces armor by 25, and petrifies enemies with 75% slow.',
    lore: 'A towering stone golem whose mere glare turns flesh into brittle granite.'
  },
  'Huge Pink Diamond': {
    name: 'Huge Pink Diamond',
    tier: 'Advanced',
    recipe: ['Pink Diamond', 'Silver Knight', 'Silver'],
    damage: 650,
    attackSpeed: 1.4,
    range: 220,
    gemColor: '#be185d',
    accentColor: '#fbcfe8',
    glow: '#9d174d',
    effect: 'cleave_crit_slow',
    effectValue: { cleavePercent: 0.60, cleaveRadius: 120, critChance: 0.25, critMultiplier: 5.0, slow: 0.45 },
    description: 'Diamond Shatter: 25% 5x Crit, 60% Cleave AoE, and 45% Movement Slow.',
    lore: 'Colossal gemstone of peerless brilliance delivering earth-shaking impacts.'
  },
  'Agate': {
    name: 'Agate',
    tier: 'Mythic',
    recipe: ['G5', 'E5', 'Q5'],
    damage: 650,
    attackSpeed: 2.5,
    range: 220,
    gemColor: '#0ea5e9',
    accentColor: '#e0f2fe',
    glow: '#0284c7',
    effect: 'split',
    effectValue: 8,
    description: 'Prismatic Ray: Rapidly fires beams hitting up to 8 targets at 2.5 attacks/sec.',
    lore: 'Formed from deep planetary pressure, firing laser-like crystal shafts.'
  },
  'Obsidian': {
    name: 'Obsidian',
    tier: 'Mythic',
    recipe: ['D5', 'B5', 'Y5'],
    damage: 1250,
    attackSpeed: 1.25,
    range: 220,
    gemColor: '#18181b',
    accentColor: '#71717a',
    glow: '#27272a',
    effect: 'cleave_slow',
    effectValue: { cleavePercent: 0.70, cleaveRadius: 150, slow: 0.60 },
    description: 'Abyssal Cataclysm: 70% Pure Cleave in huge radius, slows target by 60%. Enormous 1,250 damage.',
    lore: 'Volcanic glass forged in the underworld, crushing all mortal defenses.'
  },
  'The Burning Stone': {
    name: 'The Burning Stone',
    tier: 'Mythic',
    recipe: ['R5', 'R4', 'P5', 'P4'],
    damage: 100,
    attackSpeed: 2.0,
    range: 180,
    gemColor: '#b91c1c',
    accentColor: '#fef08a',
    glow: '#dc2626',
    effect: 'burn_aura',
    effectValue: 2000, // 2000 dps aura
    effectRadius: 180,
    description: 'Hellfire Inferno: Deals a staggering 2,000 magic damage every second to all nearby enemies!',
    lore: 'A core of eternal hellfire that incinerates anything entering its aura.'
  },
  'Diamond Cullinan': {
    name: 'Diamond Cullinan',
    tier: 'Top',
    recipe: ['D1', 'D2', 'D3', 'D4', 'D5'],
    damage: 3164,
    attackSpeed: 2.0,
    range: 240,
    gemColor: '#ffffff',
    accentColor: '#38bdf8',
    glow: '#67e8f9',
    effect: 'cullinan_strike',
    effectValue: { trueStrike: true, poisonDps: 400, rangeBonus: 100 },
    effectRadius: 200,
    description: 'Great Star of Africa: 3,164 base damage! Never misses, +100 Range aura, 400 Poison DPS.',
    lore: 'The largest gem-quality rough diamond ever found, crowned with celestial power.'
  },
  'Wings Stone': {
    name: 'Wings Stone',
    tier: 'Top',
    recipe: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5'],
    damage: 850,
    attackSpeed: 1.5,
    range: 200,
    gemColor: '#fbbf24',
    accentColor: '#fef3c7',
    glow: '#d97706',
    effect: 'splash',
    effectRadius: 80,
    effectValue: 1.0, // 100% splash damage
    description: 'Wings of Aegis: 100% full area splash damage in 80 radius, shattering swarms.',
    lore: 'Commemorating the legendary champions, bathed in golden immortality.'
  },
  'Ehome': {
    name: 'Ehome',
    tier: 'Top',
    recipe: ['E1', 'E2', 'E3', 'E4', 'E5'],
    damage: 150,
    attackSpeed: 1.0,
    range: 180,
    gemColor: '#10b981',
    accentColor: '#a7f3d0',
    glow: '#059669',
    effect: 'global_speed_aura',
    effectValue: 1.50, // +150% attack speed to ALL towers on map
    description: 'Dynasty Rhythm: Bestows +150% attack speed to EVERY allied tower on the entire battlefield!',
    lore: 'The heartbeat of tactical discipline, turning all towers into rapid cannons.'
  }
};

/**
 * Check if the given collection of gem codes satisfies a recipe
 * @param {Array<string>} availableGemCodes e.g. ['B1', 'D1', 'Y1', 'R1', 'E2']
 * @returns {Array<object>} list of matchable special towers
 */
export function findMatchingRecipes(availableGemCodes) {
  const matches = [];
  const counts = {};
  for (const code of availableGemCodes) {
    counts[code] = (counts[code] || 0) + 1;
  }

  for (const [name, def] of Object.entries(SPECIAL_TOWERS)) {
    const reqCounts = {};
    for (const req of def.recipe) {
      reqCounts[req] = (reqCounts[req] || 0) + 1;
    }

    let possible = true;
    for (const [req, needed] of Object.entries(reqCounts)) {
      if ((counts[req] || 0) < needed) {
        possible = false;
        break;
      }
    }

    if (possible) {
      matches.push({ name, def });
    }
  }

  return matches;
}

/**
 * Check for duplicate upgrades (2 of same gem & tier -> tier+1; 4 of same -> tier+2)
 * @param {Array<object>} placedGems array of gem objects with { code, level }
 * @returns {Array<object>} list of available duplicate upgrades
 */
export function findDuplicateUpgrades(placedGems) {
  const upgrades = [];
  const map = {};

  for (const gem of placedGems) {
    if (!gem.code || !gem.level || gem.level >= 5) continue;
    const key = `${gem.code}${gem.level}`;
    if (!map[key]) map[key] = [];
    map[key].push(gem);
  }

  for (const [key, list] of Object.entries(map)) {
    const sample = list[0];
    if (list.length >= 4 && sample.level <= 3) {
      upgrades.push({
        type: 'quad',
        gemCode: sample.code,
        currentLevel: sample.level,
        targetLevel: sample.level + 2,
        gems: list.slice(0, 4),
        label: `Quad Combine: 4x ${sample.name} ${sample.level} → Tier ${sample.level + 2}`
      });
    } else if (list.length >= 2 && sample.level <= 4) {
      upgrades.push({
        type: 'pair',
        gemCode: sample.code,
        currentLevel: sample.level,
        targetLevel: sample.level + 1,
        gems: list.slice(0, 2),
        label: `Pair Combine: 2x ${sample.name} ${sample.level} → Tier ${sample.level + 1}`
      });
    }
  }

  return upgrades;
}
