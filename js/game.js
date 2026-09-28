// Gem TD - Main Game State Machine & Logic Controller
import { CONFIG, QUALITIES, BASE_GEMS, WAVES } from './config.js';
import { SPECIAL_TOWERS, findMatchingRecipes, findDuplicateUpgrades, findCombinationsForTower } from './recipes.js';
import { Pathfinding, TILE_TYPES } from './pathfinding.js';
import { Creep, Tower, FloatingText, Particle } from './entities.js';
import { SOUND } from './audio.js';

export const GAME_PHASES = {
  BUILDING: 'BUILDING',
  CHOOSING: 'CHOOSING',
  WAVE: 'WAVE',
  VICTORY: 'VICTORY',
  GAME_OVER: 'GAME_OVER'
};

export class Game {
  constructor() {
    this.pathfinding = new Pathfinding();
    this.reset();
  }

  reset() {
    this.lives = CONFIG.STARTING_LIVES;
    this.gold = CONFIG.STARTING_GOLD;
    this.currentWave = 1;
    this.chanceLevel = 1;
    this.score = 0;
    this.phase = GAME_PHASES.BUILDING;
    this.gameSpeed = 1; // 1x, 2x, 4x, 0 (paused)
    this.previousSpeed = 1;

    // Grid state
    this.grid = Array.from({ length: CONFIG.GRID_HEIGHT }, () => Array(CONFIG.GRID_WIDTH).fill(TILE_TYPES.EMPTY));
    this.towerGrid = Array.from({ length: CONFIG.GRID_HEIGHT }, () => Array(CONFIG.GRID_WIDTH).fill(null));

    // Initialize checkpoints on grid
    for (const cp of CONFIG.CHECKPOINTS) {
      this.grid[cp.y][cp.x] = TILE_TYPES.CHECKPOINT;
    }

    // Phase state
    this.placedGemsThisTurn = [];
    this.selectedTower = null;
    this.hoverTile = null;

    // Combat collections
    this.creeps = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.lightningArcs = [];

    // Wave spawning state
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveInProgress = false;

    // Pathfinding cache
    this.fullCreepPath = [];
    this.updateRoute();
  }

  updateRoute() {
    const route = this.pathfinding.validateFullRoute(this.grid);
    if (route.valid) {
      this.fullCreepPath = route.fullPath;
      return true;
    }
    return false;
  }

  canPlaceAt(x, y) {
    if (this.phase !== GAME_PHASES.BUILDING) return false;
    if (this.placedGemsThisTurn.length >= CONFIG.GEMS_PER_ROUND) return false;
    return this.pathfinding.canPlaceAt(this.grid, x, y);
  }

  /**
   * Roll a random gem based on current chance upgrades
   */
  rollGem() {
    const gemKeys = Object.keys(BASE_GEMS);
    const code = gemKeys[Math.floor(Math.random() * gemKeys.length)];

    const chances = CONFIG.CHANCE_UPGRADES[this.chanceLevel - 1].chances;
    const rand = Math.random();
    let cumulative = 0;
    let level = 1;

    for (let i = 0; i < chances.length; i++) {
      cumulative += chances[i];
      if (rand <= cumulative) {
        level = i + 1;
        break;
      }
    }

    return { code, level };
  }

  /**
   * Place one of the 5 round gems at (x, y)
   */
  placeGemAt(x, y) {
    if (!this.canPlaceAt(x, y)) {
      SOUND.playError();
      return false;
    }

    const gemData = this.rollGem();
    const tower = new Tower(x, y, gemData);

    this.towerGrid[y][x] = tower;
    this.grid[y][x] = TILE_TYPES.TOWER;
    this.placedGemsThisTurn.push(tower);
    this.selectedTower = tower;

    this.updateRoute();
    SOUND.playGemPlace();

    // Check if 5 gems are placed
    if (this.placedGemsThisTurn.length >= CONFIG.GEMS_PER_ROUND) {
      this.phase = GAME_PHASES.CHOOSING;
    }

    return true;
  }

  /**
   * Player keeps ONE of the 5 newly placed gems as an active tower.
   * The other 4 become rock slates.
   */
  keepGem(chosenTower) {
    if (this.phase !== GAME_PHASES.CHOOSING) return false;
    if (!this.placedGemsThisTurn.includes(chosenTower)) return false;

    // Turn all unchosen newly placed gems into slates
    for (const tower of this.placedGemsThisTurn) {
      if (tower !== chosenTower) {
        tower.turnIntoSlate();
        this.grid[tower.tileY][tower.tileX] = TILE_TYPES.SLATE;
      }
    }

    this.placedGemsThisTurn = [];
    this.selectedTower = chosenTower;
    this.updateRoute();
    SOUND.playKeepGem();
    this.addFloatingText(chosenTower.pixelX, chosenTower.pixelY - 20, `${chosenTower.name}!`, '#38bdf8', 16, true);

    // Start wave
    this.startWave();
    return true;
  }

  /**
   * Get all gems currently on board (for recipe checking)
   */
  getAllGems() {
    const list = [];
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        const tower = this.towerGrid[y][x];
        if (tower && !tower.isSlate) {
          list.push(tower);
        }
      }
    }
    return list;
  }

  /**
   * Check matching recipes available with current board & placed gems
   */
  getAvailableRecipes() {
    const allGems = this.getAllGems();
    const codes = allGems.map(t => t.isSpecial ? t.specialName : `${t.code}${t.level}`);
    return findMatchingRecipes(codes);
  }

  /**
   * Check duplicate upgrades available
   */
  getAvailableDuplicateUpgrades() {
    const allGems = this.getAllGems();
    return findDuplicateUpgrades(allGems);
  }

  /**
   * Craft a special tower recipe
   */
  craftSpecialTower(recipeName, targetTileX, targetTileY) {
    const def = SPECIAL_TOWERS[recipeName];
    if (!def) return false;

    const allGems = this.getAllGems();
    // Gather required ingredient towers
    const reqList = [...def.recipe];
    const consumedTowers = [];

    for (const req of reqList) {
      const idx = allGems.findIndex(g => {
        if (consumedTowers.includes(g)) return false;
        const code = g.isSpecial ? g.specialName : `${g.code}${g.level}`;
        return code === req;
      });

      if (idx === -1) {
        SOUND.playError();
        return false; // Missing ingredients
      }
      consumedTowers.push(allGems[idx]);
    }

    // Determine target location: use passed tile or first consumed tower's location
    let targetX = targetTileX;
    let targetY = targetTileY;
    if (targetX === undefined || targetY === undefined) {
      targetX = consumedTowers[0].tileX;
      targetY = consumedTowers[0].tileY;
    }

    // Turn consumed partner towers into rock slates (except the target tile where the special tower will sit)
    for (const t of consumedTowers) {
      if (t.tileX === targetX && t.tileY === targetY) continue;
      t.turnIntoSlate();
      this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
    }

    // Create the Special Tower at the target location
    const specialTower = new Tower(targetX, targetY, { specialName: recipeName });
    this.towerGrid[targetY][targetX] = specialTower;
    this.grid[targetY][targetX] = TILE_TYPES.TOWER;
    this.selectedTower = specialTower;

    // Any remaining unconfirmed gems this turn become slates
    if (this.phase === GAME_PHASES.CHOOSING || this.phase === GAME_PHASES.BUILDING) {
      for (const t of this.placedGemsThisTurn) {
        if (t !== specialTower && !consumedTowers.includes(t) && this.towerGrid[t.tileY][t.tileX] === t) {
          t.turnIntoSlate();
          this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
        }
      }
      this.placedGemsThisTurn = [];
    }

    this.updateRoute();
    SOUND.playCombine();
    this.addFloatingText(specialTower.pixelX, specialTower.pixelY - 20, `${recipeName}!`, '#fbbf24', 18, true);

    if (this.phase === GAME_PHASES.CHOOSING) {
      this.startWave();
    }

    return true;
  }

  /**
   * Apply duplicate upgrade (pair or quad)
   */
  applyDuplicateUpgrade(upgrade) {
    const { gems, targetLevel, gemCode } = upgrade;
    const keepTower = gems[0];
    const consumed = gems.slice(1);

    // Turn duplicate partner towers into rock slates
    for (const t of consumed) {
      t.turnIntoSlate();
      this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
    }

    keepTower.initFromData({ code: gemCode, level: targetLevel });
    this.selectedTower = keepTower;

    // Remaining placed gems become slates if in choosing phase
    if (this.phase === GAME_PHASES.CHOOSING) {
      for (const t of this.placedGemsThisTurn) {
        if (t !== keepTower && !consumed.includes(t) && this.towerGrid[t.tileY][t.tileX] === t) {
          t.turnIntoSlate();
          this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
        }
      }
      this.placedGemsThisTurn = [];
      this.startWave();
    }

    this.updateRoute();
    SOUND.playCombine();
    this.addFloatingText(keepTower.pixelX, keepTower.pixelY - 20, `${keepTower.name}!`, '#fbbf24', 16, true);
    return true;
  }

  /**
   * Get all combinations (special or duplicate) available for a specific tower
   */
  getCombinationsForTower(tower) {
    if (!tower || tower.isSlate) return [];
    const allGems = this.getAllGems();
    return findCombinationsForTower(tower, allGems);
  }

  /**
   * Check if a tower can be combined into any recipe or duplicate upgrade
   */
  isTowerCombinable(tower) {
    if (!tower || tower.isSlate) return false;
    return this.getCombinationsForTower(tower).length > 0;
  }

  /**
   * Get set of all towers on board that currently have valid combinations
   */
  getCombinableTowers() {
    const allGems = this.getAllGems();
    const set = new Set();
    for (const g of allGems) {
      if (findCombinationsForTower(g, allGems).length > 0) {
        set.add(g);
      }
    }
    return set;
  }

  /**
   * Combine directly at a specific tower:
   * That tower transforms into the new tower at its exact location,
   * and the partner towers turn into stone slates!
   */
  combineAtTower(tower, combination) {
    if (!tower || !combination) return false;

    const { partnerTowers } = combination;

    if (combination.type === 'special') {
      const { recipeName } = combination;
      tower.initFromData({ specialName: recipeName });
      this.selectedTower = tower;

      // Turn partner ingredient towers into stone slates
      for (const p of partnerTowers) {
        p.turnIntoSlate();
        this.grid[p.tileY][p.tileX] = TILE_TYPES.SLATE;
      }

      // If in choosing phase and this turn's gems were involved, finalize unchosen placed gems into stone slates and start wave
      const involvesTurnGem = this.placedGemsThisTurn.includes(tower) || partnerTowers.some(p => this.placedGemsThisTurn.includes(p));
      if (this.phase === GAME_PHASES.CHOOSING && involvesTurnGem) {
        for (const t of this.placedGemsThisTurn) {
          if (t !== tower && !partnerTowers.includes(t) && this.towerGrid[t.tileY][t.tileX] === t) {
            t.turnIntoSlate();
            this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
          }
        }
        this.placedGemsThisTurn = [];
        this.startWave();
      }

      this.updateRoute();
      SOUND.playCombine();
      this.addFloatingText(tower.pixelX, tower.pixelY - 20, `${recipeName}!`, '#fbbf24', 18, true);
      return true;
    } else if (combination.type === 'duplicate') {
      const { targetLevel, gemCode } = combination;
      tower.initFromData({ code: gemCode, level: targetLevel });
      this.selectedTower = tower;

      // Turn partner duplicate towers into stone slates
      for (const p of partnerTowers) {
        p.turnIntoSlate();
        this.grid[p.tileY][p.tileX] = TILE_TYPES.SLATE;
      }

      // If in choosing phase and this turn's gems were involved, finalize unchosen placed gems into stone slates and start wave
      const involvesTurnGem = this.placedGemsThisTurn.includes(tower) || partnerTowers.some(p => this.placedGemsThisTurn.includes(p));
      if (this.phase === GAME_PHASES.CHOOSING && involvesTurnGem) {
        for (const t of this.placedGemsThisTurn) {
          if (t !== tower && !partnerTowers.includes(t) && this.towerGrid[t.tileY][t.tileX] === t) {
            t.turnIntoSlate();
            this.grid[t.tileY][t.tileX] = TILE_TYPES.SLATE;
          }
        }
        this.placedGemsThisTurn = [];
        this.startWave();
      }

      this.updateRoute();
      SOUND.playCombine();
      this.addFloatingText(tower.pixelX, tower.pixelY - 20, `${tower.name}!`, '#fbbf24', 16, true);
      return true;
    }

    return false;
  }

  /**
   * Upgrade chance probabilities
   */
  upgradeChance() {
    if (this.chanceLevel >= CONFIG.CHANCE_UPGRADES.length) return false;
    const nextDef = CONFIG.CHANCE_UPGRADES[this.chanceLevel];
    if (this.gold < nextDef.cost) {
      SOUND.playError();
      return false;
    }

    this.gold -= nextDef.cost;
    this.chanceLevel++;
    SOUND.playUpgrade();
    return true;
  }

  /**
   * Demolish a slate rock to open paths
   */
  removeSlate(x, y) {
    const tower = this.towerGrid[y][x];
    if (!tower || !tower.isSlate) return false;
    if (this.gold < CONFIG.SLATE_REMOVE_COST) {
      SOUND.playError();
      return false;
    }

    this.gold -= CONFIG.SLATE_REMOVE_COST;
    this.towerGrid[y][x] = null;
    this.grid[y][x] = TILE_TYPES.EMPTY;
    this.selectedTower = null;

    this.updateRoute();
    SOUND.playClick();
    return true;
  }

  /**
   * Reroll the 5 placed gems in choosing phase
   */
  rerollPlacedGems() {
    if (this.phase !== GAME_PHASES.CHOOSING) return false;
    if (this.gold < CONFIG.REROLL_COST) {
      SOUND.playError();
      return false;
    }

    this.gold -= CONFIG.REROLL_COST;
    for (const t of this.placedGemsThisTurn) {
      const newGem = this.rollGem();
      t.initFromData(newGem);
    }

    SOUND.playUpgrade();
    return true;
  }

  /**
   * Start Wave
   */
  startWave() {
    if (this.phase === GAME_PHASES.WAVE) return;
    this.phase = GAME_PHASES.WAVE;
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveInProgress = true;
    SOUND.playWaveStart();
  }

  getWaveData() {
    return WAVES[this.currentWave - 1] || WAVES[WAVES.length - 1];
  }

  spawnCreep() {
    const waveData = this.getWaveData();
    const spawnCP = CONFIG.CHECKPOINTS[0];
    const ts = CONFIG.DEFAULT_TILE_SIZE;
    const spawnX = spawnCP.x * ts + ts / 2;
    const spawnY = spawnCP.y * ts + ts / 2;

    const creep = new Creep(waveData, spawnX, spawnY, ts);

    // Compute path points for the creep
    if (creep.isFlying) {
      // Flying creeps fly directly from checkpoint to checkpoint
      const flyPath = [];
      for (const cp of CONFIG.CHECKPOINTS) {
        flyPath.push({ x: cp.x * ts + ts / 2, y: cp.y * ts + ts / 2 });
      }
      creep.setPath(flyPath);
    } else {
      // Ground creeps follow full maze path
      const pixelPath = this.fullCreepPath.map(p => ({
        x: p.x * ts + ts / 2,
        y: p.y * ts + ts / 2
      }));
      creep.setPath(pixelPath);
    }

    this.creeps.push(creep);
    this.waveSpawnCount++;
  }

  onCreepReachedCastle(creep) {
    SOUND.playLifeLost();
    const lifeLoss = creep.isBoss ? 10 : 1;
    this.lives = Math.max(0, this.lives - lifeLoss);

    this.addFloatingText(creep.x, creep.y - 15, `-${lifeLoss} HP`, '#ef4444', 16, true);

    // Remove from creeps
    this.creeps = this.creeps.filter(c => c !== creep);

    if (this.lives <= 0) {
      this.phase = GAME_PHASES.GAME_OVER;
      SOUND.playError();
    }
  }

  onCreepKilled(creep, killerTower = null) {
    SOUND.playKill(creep.isBoss);
    this.gold += creep.gold;
    const pointVal = creep.isBoss ? 250 : 25;
    this.score += pointVal;

    if (killerTower) {
      killerTower.kills++;
    }

    this.addFloatingText(creep.x, creep.y - 12, `+${creep.gold}G`, '#fbbf24', 13);
    this.addExplosionParticle(creep.x, creep.y, creep.radius * 1.5, '#4ade80');

    this.creeps = this.creeps.filter(c => c !== creep);
  }

  addFloatingText(x, y, text, color, size, isCrit) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, size, isCrit));
  }

  addExplosionParticle(x, y, radius, color) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * 2 * Math.PI) / 8;
      const speed = 40 + Math.random() * 50;
      this.particles.push(new Particle(
        x, y, color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        3, 0.35
      ));
    }
  }

  addLightningEffect(x1, y1, x2, y2) {
    this.lightningArcs.push({ x1, y1, x2, y2, life: 0.15 });
  }

  /**
   * Main game logic tick
   */
  update(rawDt) {
    if (this.gameSpeed === 0) return; // Paused
    const dt = Math.min(rawDt, 0.1) * this.gameSpeed;

    // Update lightning arcs
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (!this.particles[i].update(dt)) {
        this.particles.splice(i, 1);
      }
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      if (!this.floatingTexts[i].update(dt)) {
        this.floatingTexts.splice(i, 1);
      }
    }

    if (this.phase === GAME_PHASES.WAVE) {
      const waveData = this.getWaveData();

      // Creep spawning
      if (this.waveSpawnCount < waveData.count) {
        this.waveSpawnTimer += dt;
        if (this.waveSpawnTimer >= CONFIG.SPAWN_INTERVAL_MS / 1000) {
          this.waveSpawnTimer = 0;
          this.spawnCreep();
        }
      }

      // Calculate tower auras before attack updates
      this.updateTowerAuras();

      // Update towers
      for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
          const tower = this.towerGrid[y][x];
          if (tower) {
            tower.update(dt, this.creeps, this);
          }
        }
      }

      // Update creeps
      for (let i = this.creeps.length - 1; i >= 0; i--) {
        const creep = this.creeps[i];
        creep.update(dt, this);
      }

      // Update projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.update(dt, this);
        if (p.isDead) {
          this.projectiles.splice(i, 1);
        }
      }

      // Check wave completion
      if (this.waveSpawnCount >= waveData.count && this.creeps.length === 0) {
        this.completeWave();
      }
    }
  }

  updateTowerAuras() {
    // Reset aura buffs
    const allTowers = [];
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        const tower = this.towerGrid[y][x];
        if (tower && !tower.isSlate) {
          tower.auraSpeedMultiplier = 1.0;
          tower.auraDamageMultiplier = 1.0;
          tower.auraRangeBonus = 0;
          allTowers.push(tower);
        }
      }
    }

    // Apply aura buffs from source towers
    for (const src of allTowers) {
      if (src.effect === 'aura_speed') {
        const bonus = src.effectValue || 0.15;
        for (const target of allTowers) {
          if (target !== src && Math.hypot(target.pixelX - src.pixelX, target.pixelY - src.pixelY) <= src.effectRadius) {
            target.auraSpeedMultiplier += bonus;
          }
        }
      } else if (src.effect === 'global_speed_aura') {
        // Ehome: global +150% attack speed to all towers
        const bonus = src.effectValue || 1.5;
        for (const target of allTowers) {
          target.auraSpeedMultiplier += bonus;
        }
      } else if (src.effect === 'aura_haste_inspire') {
        // Cat's Eye: +50% speed & +40% dmg
        for (const target of allTowers) {
          if (target !== src && Math.hypot(target.pixelX - src.pixelX, target.pixelY - src.pixelY) <= src.effectRadius) {
            target.auraSpeedMultiplier += src.effectValue.speedBonus;
            target.auraDamageMultiplier += src.effectValue.damageBonus;
          }
        }
      } else if (src.effect === 'aura_range_poison') {
        // Grey Jade: +60 range
        for (const target of allTowers) {
          if (target !== src && Math.hypot(target.pixelX - src.pixelX, target.pixelY - src.pixelY) <= src.effectRadius) {
            target.auraRangeBonus += src.effectValue.rangeBonus;
          }
        }
      }
    }
  }

  completeWave() {
    SOUND.playWaveClear();
    const waveBonus = 10 + this.currentWave * 2;
    this.gold += waveBonus;
    this.addFloatingText(this.width / 2 || 400, 200, `Wave ${this.currentWave} Complete! +${waveBonus}G`, '#4ade80', 20, true);

    if (this.currentWave >= WAVES.length) {
      this.phase = GAME_PHASES.VICTORY;
      return;
    }

    this.currentWave++;
    this.phase = GAME_PHASES.BUILDING;
    this.placedGemsThisTurn = [];
  }
}
