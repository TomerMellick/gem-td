// Gem TD - Entities: Creeps, Towers, Projectiles, Particles, Floating Text
import { CONFIG, QUALITIES, BASE_GEMS } from './config.js';
import { SPECIAL_TOWERS } from './recipes.js';
import { SOUND } from './audio.js';

export class FloatingText {
  constructor(x, y, text, color = '#ffffff', fontSize = 14, isCrit = false) {
    this.x = x + (Math.random() - 0.5) * 12;
    this.y = y;
    this.text = text;
    this.color = color;
    this.fontSize = isCrit ? fontSize * 1.35 : fontSize;
    this.isCrit = isCrit;
    this.alpha = 1.0;
    this.vy = isCrit ? -45 : -30;
    this.vx = (Math.random() - 0.5) * 15;
    this.lifetime = 0.85;
    this.age = 0;
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.alpha = Math.max(0, 1.0 - (this.age / this.lifetime));
    return this.age < this.lifetime;
  }
}

export class Particle {
  constructor(x, y, color = '#ffffff', vx = 0, vy = 0, size = 3, life = 0.4) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.life = life;
    this.age = 0;
    this.alpha = 1.0;
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.alpha = Math.max(0, 1 - (this.age / this.life));
    return this.age < this.life;
  }
}

export class Creep {
  constructor(waveData, spawnPixelX, spawnPixelY, tileSize = CONFIG.DEFAULT_TILE_SIZE) {
    this.id = Math.random().toString(36).substring(2, 9);
    this.wave = waveData.wave;
    this.name = waveData.name;
    this.count = waveData.count;
    this.maxHp = waveData.hp;
    this.hp = waveData.hp;
    this.baseArmor = waveData.armor;
    this.armor = waveData.armor;
    this.baseSpeed = waveData.speed * 48; // speed in pixels per second
    this.speed = this.baseSpeed;
    this.isFlying = !!waveData.isFlying;
    this.isBoss = !!waveData.isBoss;
    this.gold = waveData.gold;
    this.trait = waveData.trait || '';

    this.tileSize = tileSize;
    this.x = spawnPixelX;
    this.y = spawnPixelY;
    this.radius = this.isBoss ? 16 : 10;

    // Movement pathing
    this.currentWaypointIndex = 1; // Creep spawns at WP0, heading to WP1
    this.path = []; // Array of {x, y} in pixel coordinates
    this.pathIndex = 0;
    this.reachedCastle = false;

    // Trait specifics
    this.isMagicImmune = this.trait.includes('Magic Immune');
    this.isPhysicalImmune = this.trait.includes('Physical Immune');
    this.evasionChance = this.trait.includes('Evasion') ? 0.25 : 0;
    this.hasVitality = this.trait.includes('Vitality');
    this.hasRecharge = this.trait.includes('Recharge');
    this.hasKrakenShell = this.trait.includes('Kraken Shell');
    this.shieldHp = this.hasRecharge ? Math.round(this.maxHp * 0.4) : 0;
    this.maxShieldHp = this.shieldHp;
    this.timeSinceLastHit = 0;

    // Debuffs
    this.debuffs = {
      slow: null, // { percent, duration, timer }
      poison: null, // { dps, timer }
      armorShred: null, // { reduction, timer }
      stun: null, // { timer }
      burn: null // { dps, timer }
    };
  }

  setPath(pixelPath) {
    this.path = pixelPath;
    this.pathIndex = 0;
  }

  applyDebuff(type, data) {
    if (this.isMagicImmune && (type === 'slow' || type === 'poison' || type === 'burn')) {
      return;
    }

    if (type === 'slow') {
      if (!this.debuffs.slow || data.percent >= this.debuffs.slow.percent) {
        this.debuffs.slow = { percent: data.percent, timer: data.duration };
      }
    } else if (type === 'poison') {
      if (!this.debuffs.poison || data.dps >= this.debuffs.poison.dps) {
        this.debuffs.poison = { dps: data.dps, timer: data.duration };
      }
    } else if (type === 'armorShred') {
      if (!this.debuffs.armorShred || data.reduction >= this.debuffs.armorShred.reduction) {
        this.debuffs.armorShred = { reduction: data.reduction, timer: data.duration };
      }
    } else if (type === 'stun') {
      this.debuffs.stun = { timer: Math.max(this.debuffs.stun ? this.debuffs.stun.timer : 0, data.duration) };
    } else if (type === 'burn') {
      this.debuffs.burn = { dps: data.dps, timer: 0.25 }; // refreshed each frame aura is active
    }
  }

  takeDamage(amount, damageType = 'physical', options = {}) {
    if (this.hp <= 0) return { actualDamage: 0, killed: false, evaded: false };

    // Check evasion on physical attacks
    if (damageType === 'physical' && this.evasionChance > 0 && !options.trueStrike) {
      if (Math.random() < this.evasionChance) {
        return { actualDamage: 0, killed: false, evaded: true };
      }
    }

    // Check immunities
    if (damageType === 'physical' && this.isPhysicalImmune) {
      return { actualDamage: 0, killed: false, immune: true };
    }
    if (damageType === 'magic' && this.isMagicImmune) {
      return { actualDamage: 0, killed: false, immune: true };
    }

    let finalDamage = amount;

    // Armor reduction for physical damage
    if (damageType === 'physical') {
      const effectiveArmor = Math.max(-50, this.armor);
      let multiplier = 1.0;
      if (effectiveArmor >= 0) {
        multiplier = 1 - (effectiveArmor * 0.05) / (1 + 0.05 * effectiveArmor);
      } else {
        multiplier = 2 - Math.pow(0.95, -effectiveArmor);
      }
      finalDamage = amount * multiplier;

      // Kraken shell flat block
      if (this.hasKrakenShell) {
        finalDamage = Math.max(finalDamage * 0.1, finalDamage - 400);
      }
    }

    finalDamage = Math.max(1, Math.round(finalDamage));
    this.timeSinceLastHit = 0;

    // Absorb with shield first
    if (this.shieldHp > 0) {
      if (this.shieldHp >= finalDamage) {
        this.shieldHp -= finalDamage;
        return { actualDamage: finalDamage, killed: false, shieldHit: true };
      } else {
        finalDamage -= this.shieldHp;
        this.shieldHp = 0;
      }
    }

    this.hp -= finalDamage;
    const killed = this.hp <= 0;
    if (killed) {
      this.hp = 0;
    }

    return { actualDamage: finalDamage, killed, isCrit: !!options.isCrit };
  }

  update(dt, game) {
    if (this.hp <= 0 || this.reachedCastle) return;

    this.timeSinceLastHit += dt;

    // Vitality trait: passive HP regeneration
    if (this.hasVitality) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.04 * dt);
    }

    // Recharge trait: recover shield if out of combat for 2.5s
    if (this.hasRecharge && this.timeSinceLastHit > 2.5 && this.shieldHp < this.maxShieldHp) {
      this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + this.maxShieldHp * 0.25 * dt);
    }

    // Update debuffs
    let currentSpeed = this.baseSpeed;
    let armorOffset = 0;

    if (this.debuffs.stun) {
      this.debuffs.stun.timer -= dt;
      if (this.debuffs.stun.timer <= 0) {
        this.debuffs.stun = null;
      } else {
        currentSpeed = 0; // Stunned!
      }
    }

    if (this.debuffs.slow && currentSpeed > 0) {
      this.debuffs.slow.timer -= dt;
      currentSpeed *= Math.max(0.15, 1 - this.debuffs.slow.percent);
      if (this.debuffs.slow.timer <= 0) {
        this.debuffs.slow = null;
      }
    }

    if (this.debuffs.armorShred) {
      this.debuffs.armorShred.timer -= dt;
      armorOffset -= this.debuffs.armorShred.reduction;
      if (this.debuffs.armorShred.timer <= 0) {
        this.debuffs.armorShred = null;
      }
    }

    // Poison DPS tick
    if (this.debuffs.poison) {
      this.debuffs.poison.timer -= dt;
      const poisonDmg = this.debuffs.poison.dps * dt;
      const res = this.takeDamage(poisonDmg, 'magic');
      if (res.killed) {
        game.onCreepKilled(this);
        return;
      }
      if (this.debuffs.poison.timer <= 0) {
        this.debuffs.poison = null;
      }
    }

    // Burn aura DPS tick
    if (this.debuffs.burn) {
      this.debuffs.burn.timer -= dt;
      const burnDmg = this.debuffs.burn.dps * dt;
      const res = this.takeDamage(burnDmg, 'magic');
      if (res.killed) {
        game.onCreepKilled(this);
        return;
      }
      if (this.debuffs.burn.timer <= 0) {
        this.debuffs.burn = null;
      }
    }

    this.armor = this.baseArmor + armorOffset;
    this.speed = currentSpeed;

    if (this.speed <= 0) return;

    // Movement along path
    if (this.path && this.pathIndex < this.path.length) {
      const targetPoint = this.path[this.pathIndex];
      const dx = targetPoint.x - this.x;
      const dy = targetPoint.y - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;

      if (dist <= step) {
        this.x = targetPoint.x;
        this.y = targetPoint.y;
        this.pathIndex++;

        // If creep finished full path to the castle
        if (this.pathIndex >= this.path.length) {
          this.reachedCastle = true;
          game.onCreepReachedCastle(this);
        }
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    }
  }
}

export class Projectile {
  constructor(options) {
    this.x = options.startX;
    this.y = options.startY;
    this.startX = options.startX;
    this.startY = options.startY;
    this.target = options.target;
    this.source = options.source;
    this.damage = options.damage;
    this.damageType = options.damageType || 'physical';
    this.speed = options.speed || 480;
    this.color = options.color || '#fbbf24';
    this.radius = options.radius || 4;
    this.effects = options.effects || {};
    this.options = options.options || {};
    this.isDead = false;
  }

  update(dt, game) {
    if (this.isDead) return;

    // If target died or reached castle, travel towards its last position or destroy
    const tx = this.target && this.target.hp > 0 ? this.target.x : this.lastTargetX;
    const ty = this.target && this.target.hp > 0 ? this.target.y : this.lastTargetY;

    if (tx === undefined) {
      this.isDead = true;
      return;
    }

    this.lastTargetX = tx;
    this.lastTargetY = ty;

    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= step || dist < 6) {
      this.hit(game);
      this.isDead = true;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  hit(game) {
    if (!this.target || this.target.hp <= 0) return;

    const res = this.target.takeDamage(this.damage, this.damageType, this.options);

    if (res.evaded) {
      game.addFloatingText(this.target.x, this.target.y - 12, 'MISS', '#94a3b8', 13);
      return;
    }

    if (res.immune) {
      game.addFloatingText(this.target.x, this.target.y - 12, 'IMMUNE', '#f87171', 13);
      return;
    }

    SOUND.playHit(res.isCrit);

    // Record damage & kill on source tower
    if (this.source) {
      this.source.totalDamageDealt += res.actualDamage;
    }

    // Floating combat text
    const text = Math.round(res.actualDamage);
    let color = '#ffffff';
    if (res.isCrit) color = '#fbbf24';
    else if (this.damageType === 'magic') color = '#a855f7';
    else if (this.effects.poison) color = '#4ade80';
    else if (this.effects.slow) color = '#38bdf8';

    game.addFloatingText(this.target.x, this.target.y - 10, text.toString(), color, 14, res.isCrit);

    // Apply primary debuffs to target
    if (this.effects.slow) {
      this.target.applyDebuff('slow', this.effects.slow);
    }
    if (this.effects.poison) {
      this.target.applyDebuff('poison', this.effects.poison);
    }
    if (this.effects.armorShred) {
      this.target.applyDebuff('armorShred', this.effects.armorShred);
    }
    if (this.effects.stun) {
      this.target.applyDebuff('stun', this.effects.stun);
    }

    // Splash damage
    if (this.effects.splash) {
      SOUND.playExplosion();
      const splashRad = this.effects.splash.radius;
      const splashDmg = this.damage * this.effects.splash.ratio;
      game.addExplosionParticle(this.target.x, this.target.y, splashRad, this.color);

      for (const creep of game.creeps) {
        if (creep.id !== this.target.id && creep.hp > 0) {
          const d = Math.hypot(creep.x - this.target.x, creep.y - this.target.y);
          if (d <= splashRad) {
            const sRes = creep.takeDamage(splashDmg, this.damageType, this.options);
            if (this.source) this.source.totalDamageDealt += sRes.actualDamage;
            if (sRes.killed) game.onCreepKilled(creep, this.source);
          }
        }
      }
    }

    // Cleave damage
    if (this.effects.cleave) {
      const cleaveRad = this.effects.cleave.radius;
      const cleaveDmg = this.damage * this.effects.cleave.percent;
      for (const creep of game.creeps) {
        if (creep.id !== this.target.id && creep.hp > 0) {
          const d = Math.hypot(creep.x - this.target.x, creep.y - this.target.y);
          if (d <= cleaveRad) {
            const cRes = creep.takeDamage(cleaveDmg, 'physical', this.options);
            if (this.source) this.source.totalDamageDealt += cRes.actualDamage;
            if (this.effects.slow) creep.applyDebuff('slow', this.effects.slow);
            if (cRes.killed) game.onCreepKilled(creep, this.source);
          }
        }
      }
    }

    // Chain lightning
    if (this.effects.chainLightning) {
      SOUND.playLightning();
      let currentCreep = this.target;
      const hitIds = new Set([this.target.id]);
      let jumpsLeft = this.effects.chainLightning.jumps;
      const jumpDmg = this.effects.chainLightning.damage;

      while (jumpsLeft > 0) {
        // Find closest creep not yet hit
        let nextCreep = null;
        let minDist = 180;
        for (const c of game.creeps) {
          if (!hitIds.has(c.id) && c.hp > 0) {
            const d = Math.hypot(c.x - currentCreep.x, c.y - currentCreep.y);
            if (d < minDist) {
              minDist = d;
              nextCreep = c;
            }
          }
        }

        if (nextCreep) {
          game.addLightningEffect(currentCreep.x, currentCreep.y, nextCreep.x, nextCreep.y);
          const lRes = nextCreep.takeDamage(jumpDmg, 'magic');
          game.addFloatingText(nextCreep.x, nextCreep.y - 10, Math.round(lRes.actualDamage).toString(), '#67e8f9', 14);
          if (this.source) this.source.totalDamageDealt += lRes.actualDamage;
          if (lRes.killed) game.onCreepKilled(nextCreep, this.source);
          hitIds.add(nextCreep.id);
          currentCreep = nextCreep;
          jumpsLeft--;
        } else {
          break;
        }
      }
    }

    // Greed gold extraction (Egypt Gold)
    if (this.effects.greedChance && Math.random() < this.effects.greedChance) {
      const bonusGold = Math.floor(Math.random() * (this.effects.greedMax - this.effects.greedMin + 1)) + this.effects.greedMin;
      game.gold += bonusGold;
      game.addFloatingText(this.target.x, this.target.y - 25, `+${bonusGold}G (Greed)`, '#fbbf24', 15);
      SOUND.playKill();
    }

    if (res.killed) {
      game.onCreepKilled(this.target, this.source);
    }
  }
}

export class Tower {
  constructor(tileX, tileY, gemData, tileSize = CONFIG.DEFAULT_TILE_SIZE) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.pixelX = tileX * tileSize + tileSize / 2;
    this.pixelY = tileY * tileSize + tileSize / 2;
    this.tileSize = tileSize;

    this.isSlate = false;
    this.isSpecial = false;
    this.specialName = '';
    this.tier = '';
    this.code = '';
    this.level = 1;
    this.name = '';

    this.damage = 0;
    this.attackSpeed = 1.0;
    this.range = 140;
    this.effect = '';
    this.effectValue = null;
    this.effectRadius = 0;
    this.effectDuration = 0;
    this.gemColor = '#94a3b8';
    this.accentColor = '#cbd5e1';
    this.glowColor = null;

    this.cooldown = 0;
    this.totalDamageDealt = 0;
    this.kills = 0;

    // Temporary buffs from ally auras
    this.auraSpeedMultiplier = 1.0;
    this.auraDamageMultiplier = 1.0;
    this.auraRangeBonus = 0;

    if (gemData) {
      this.initFromData(gemData);
    }
  }

  initFromData(gemData) {
    if (gemData.isSlate) {
      this.isSlate = true;
      this.name = 'Rock Slate';
      this.gemColor = '#475569';
      this.accentColor = '#64748b';
      return;
    }

    if (gemData.specialName && SPECIAL_TOWERS[gemData.specialName]) {
      this.isSpecial = true;
      this.specialName = gemData.specialName;
      const def = SPECIAL_TOWERS[gemData.specialName];
      this.name = def.name;
      this.tier = def.tier;
      this.damage = def.damage;
      this.attackSpeed = def.attackSpeed;
      this.range = def.range;
      this.effect = def.effect;
      this.effectValue = def.effectValue;
      this.effectRadius = def.effectRadius || 0;
      this.effectDuration = def.effectDuration || 0;
      this.gemColor = def.gemColor;
      this.accentColor = def.accentColor;
      this.glowColor = def.glow;
      this.description = def.description;
      return;
    }

    // Base Gem
    this.code = gemData.code;
    this.level = gemData.level || 1;
    const baseDef = BASE_GEMS[this.code];
    const qualityDef = QUALITIES[this.level];

    this.name = `${qualityDef.namePrefix} ${baseDef.name}`;
    this.damage = baseDef.baseDamage[this.level];
    this.attackSpeed = baseDef.attackSpeed[this.level];
    this.range = baseDef.range[this.level];
    this.effect = baseDef.effect;
    this.effectValue = baseDef.effectValue ? baseDef.effectValue[this.level] : null;
    this.effectRadius = baseDef.effectRadius ? baseDef.effectRadius[this.level] : 0;
    this.effectDuration = baseDef.effectDuration ? baseDef.effectDuration[this.level] : 0;
    this.gemColor = baseDef.gemColor;
    this.accentColor = baseDef.accentColor;
    this.glowColor = qualityDef.glow ? qualityDef.ringColor : null;
    this.description = baseDef.description;
  }

  turnIntoSlate() {
    this.isSlate = true;
    this.isSpecial = false;
    this.code = '';
    this.name = 'Rock Slate';
    this.gemColor = '#475569';
    this.accentColor = '#64748b';
    this.glowColor = null;
    this.damage = 0;
  }

  getEffectiveDamage() {
    return Math.round(this.damage * this.auraDamageMultiplier);
  }

  getEffectiveAttackSpeed() {
    return this.attackSpeed * this.auraSpeedMultiplier;
  }

  getEffectiveRange() {
    return this.range + this.auraRangeBonus;
  }

  update(dt, creeps, game) {
    if (this.isSlate) return;

    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    // Aura handling
    if ((this.effect === 'burn_aura' || this.effect === 'forked_lightning_burn') && this.effectRadius > 0) {
      const burnDps = typeof this.effectValue === 'number' ? this.effectValue : (this.effectValue.burnDps || 80);
      for (const creep of creeps) {
        if (creep.hp > 0) {
          const d = Math.hypot(creep.x - this.pixelX, creep.y - this.pixelY);
          if (d <= this.effectRadius) {
            creep.applyDebuff('burn', { dps: burnDps });
          }
        }
      }
    }

    if (this.effect === 'ice_aura' && this.effectRadius > 0) {
      for (const creep of creeps) {
        if (creep.hp > 0) {
          const d = Math.hypot(creep.x - this.pixelX, creep.y - this.pixelY);
          if (d <= this.effectRadius) {
            creep.applyDebuff('slow', { percent: this.effectValue, duration: 0.25 });
          }
        }
      }
    }

    if (this.effect === 'anti_fly_aura' && this.effectRadius > 0) {
      for (const creep of creeps) {
        if (creep.hp > 0 && creep.isFlying) {
          const d = Math.hypot(creep.x - this.pixelX, creep.y - this.pixelY);
          if (d <= this.effectRadius) {
            creep.applyDebuff('armorShred', { reduction: Math.abs(this.effectValue.armor), duration: 0.25 });
            creep.applyDebuff('slow', { percent: this.effectValue.slow, duration: 0.25 });
          }
        }
      }
    }

    if (this.effect === 'armor_aura' && this.effectRadius > 0) {
      for (const creep of creeps) {
        if (creep.hp > 0) {
          const d = Math.hypot(creep.x - this.pixelX, creep.y - this.pixelY);
          if (d <= this.effectRadius) {
            creep.applyDebuff('armorShred', { reduction: this.effectValue, duration: 0.25 });
          }
        }
      }
    }

    // Can attack if ready
    if (this.cooldown <= 0 && this.damage > 0) {
      this.acquireAndAttack(creeps, game);
    }
  }

  acquireAndAttack(creeps, game) {
    const range = this.getEffectiveRange();
    const inRange = [];

    for (const creep of creeps) {
      if (creep.hp > 0) {
        const d = Math.hypot(creep.x - this.pixelX, creep.y - this.pixelY);
        if (d <= range) {
          inRange.push({ creep, dist: d });
        }
      }
    }

    if (inRange.length === 0) return;

    // Prioritize flying for anti-air (Aquamarine), bosses, or closest to castle
    inRange.sort((a, b) => {
      if (this.effect === 'anti_air') {
        if (a.creep.isFlying && !b.creep.isFlying) return -1;
        if (!a.creep.isFlying && b.creep.isFlying) return 1;
      }
      if (a.creep.isBoss !== b.creep.isBoss) {
        return a.creep.isBoss ? -1 : 1;
      }
      return b.creep.pathIndex - a.creep.pathIndex; // further along path
    });

    const numTargets = this.getTargetCount();
    const targets = inRange.slice(0, numTargets);

    for (const item of targets) {
      this.fireAt(item.creep, game);
    }

    // Reset cooldown based on effective attack speed
    const effectiveAtkSpd = Math.max(0.2, this.getEffectiveAttackSpeed());
    this.cooldown = 1.0 / effectiveAtkSpd;
  }

  getTargetCount() {
    if (this.effect === 'multishot' || this.effect === 'split') {
      return typeof this.effectValue === 'number' ? this.effectValue : 4;
    }
    return 1;
  }

  fireAt(creep, game) {
    let damage = this.getEffectiveDamage();
    let damageType = 'physical';
    const projectileEffects = {};
    const projectileOptions = {};

    // Anti-Air multiplier
    if (this.effect === 'anti_air' && creep.isFlying) {
      const mult = typeof this.effectValue === 'number' ? this.effectValue : 2.0;
      damage *= mult;
    }

    // Critical Strike (Pink Diamond, Huge Pink Diamond)
    if (this.effect === 'crit' || this.effect === 'cleave_crit_slow') {
      const critChance = this.effectValue.chance || this.effectValue.critChance || 0.2;
      const critMultiplier = this.effectValue.multiplier || this.effectValue.critMultiplier || 5.0;
      if (Math.random() < critChance) {
        damage *= critMultiplier;
        projectileOptions.isCrit = true;
      }
    }

    // Pierce / True Strike (Cullinan, Monkey King Jade)
    if (this.effect === 'pierce' || this.effect === 'cullinan_strike' || this.effect === 'true_strike_aura') {
      projectileOptions.trueStrike = true;
    }

    // Status debuffs
    if (this.effect === 'slow') {
      projectileEffects.slow = { percent: this.effectValue, duration: this.effectDuration || 3.5 };
    }
    if (this.effect === 'poison') {
      projectileEffects.poison = { dps: this.effectValue, duration: this.effectDuration || 4.0 };
    }
    if (this.effect === 'armor_shred') {
      projectileEffects.armorShred = { reduction: this.effectValue, duration: this.effectDuration || 4.0 };
    }
    if (this.effect === 'stun') {
      const chance = this.effectValue.chance || 0.20;
      if (Math.random() < chance) {
        projectileEffects.stun = { duration: this.effectValue.duration || 1.2 };
      }
    }
    if (this.effect === 'stone_gaze') {
      if (Math.random() < (this.effectValue.stunChance || 0.25)) {
        projectileEffects.stun = { duration: 1.5 };
      }
      projectileEffects.armorShred = { reduction: this.effectValue.armorReduction || 25, duration: 4.0 };
      projectileEffects.slow = { percent: this.effectValue.petrifySlow || 0.75, duration: 2.0 };
    }
    if (this.effect === 'splash') {
      projectileEffects.splash = { radius: this.effectRadius || 50, ratio: typeof this.effectValue === 'number' ? this.effectValue : 0.5 };
    }
    if (this.effect === 'cleave_slow' || this.effect === 'cleave_crit_slow') {
      projectileEffects.cleave = { radius: this.effectValue.cleaveRadius || 120, percent: this.effectValue.cleavePercent || 0.5 };
      projectileEffects.slow = { percent: this.effectValue.slow || 0.40, duration: 3.0 };
    }
    if (this.effect === 'chain_lightning' || this.effect === 'forked_lightning_burn') {
      if (Math.random() < (this.effectValue.chance || 0.30)) {
        projectileEffects.chainLightning = { jumps: this.effectValue.jumps || 5, damage: this.effectValue.damage || 350 };
      }
    }
    if (this.effect === 'corrupt_greed') {
      projectileEffects.armorShred = { reduction: this.effectValue.armorReduction, duration: 4.0 };
      projectileEffects.greedChance = this.effectValue.greedChance;
      projectileEffects.greedMin = this.effectValue.greedMin;
      projectileEffects.greedMax = this.effectValue.greedMax;
    }
    if (this.effect === 'cullinan_strike') {
      projectileEffects.poison = { dps: this.effectValue.poisonDps, duration: 5.0 };
    }
    if (this.effect === 'aura_range_poison' && this.effectValue && this.effectValue.poisonDps) {
      projectileEffects.poison = { dps: this.effectValue.poisonDps, duration: this.effectValue.duration || 5.0 };
    }
    if (this.effect === 'true_strike_aura' && this.effectValue && this.effectValue.poisonDps) {
      projectileEffects.poison = { dps: this.effectValue.poisonDps, duration: 5.0 };
    }

    SOUND.playShoot(this.effect);

    game.projectiles.push(new Projectile({
      startX: this.pixelX,
      startY: this.pixelY,
      target: creep,
      source: this,
      damage: Math.round(damage),
      damageType,
      speed: 550,
      color: this.gemColor,
      radius: this.isSpecial ? 6 : 4,
      effects: projectileEffects,
      options: projectileOptions
    }));
  }
}
