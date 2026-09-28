// Gem TD - Main Game State Machine & Logic Controller
import { CONFIG, QUALITIES, BASE_GEMS, WAVES, TRAP_TYPES, RUNE_TYPES } from './config.js';
import { SPECIAL_TOWERS, findMatchingRecipes, findDuplicateUpgrades, findCombinationsForTower } from './recipes.js';
import { Pathfinding, TILE_TYPES } from './pathfinding.js';
import { Creep, Tower, Trap, FloatingText, Particle } from './entities.js';
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

    // Traps and interaction mode
    this.traps = [];
    this.interactionMode = null; // null | { type: 'MOVE_TOWER', sourceTower } | { type: 'PLACE_TRAP', trapKey } | { type: 'SOCKET_RUNE', runeKey }
    this.lastWaveMvp = null; // { tower, damage, level, wave }

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
    this.impactRings = [];

    // Renderer reference for screen shake (set by main.js)
    this.renderer = null;

    // Wave spawning state
    this.waveSpawnCount = 0;
    this.waveSpawnTimer = 0;
    this.waveInProgress = false;

    // Cache structures for 60/120 FPS performance
    this._combinableTowers = null;
    this._towerCombinationsCache = new Map();
    this._activeTowers = null;
    this._allEntities = null;
    this._cachedHoverCanPlace = null;
    this._cachedHoverX = -1;
    this._cachedHoverY = -1;
    this.aurasDirty = true;

    // Pathfinding cache
    this.fullCreepPath = [];
    this.updateRoute();
  }

  invalidateTowerCache() {
    this._combinableTowers = null;
    this._towerCombinationsCache.clear();
    this._activeTowers = null;
    this._allEntities = null;
    this._cachedHoverCanPlace = null;
    this.aurasDirty = true;
  }

  _rebuildEntityLists() {
    this._activeTowers = [];
    this._allEntities = [];
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        const tower = this.towerGrid[y][x];
        if (tower) {
          this._allEntities.push(tower);
          if (!tower.isSlate) {
            this._activeTowers.push(tower);
          }
        }
      }
    }
  }

  getAllEntities() {
    if (!this._allEntities) {
      this._rebuildEntityLists();
    }
    return this._allEntities;
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

  getHoverCanPlace() {
    if (!this.hoverTile) return false;
    const { x, y } = this.hoverTile;
    if (this._cachedHoverX === x && this._cachedHoverY === y && this._cachedHoverCanPlace !== null) {
      return this._cachedHoverCanPlace;
    }
    this._cachedHoverX = x;
    this._cachedHoverY = y;
    this._cachedHoverCanPlace = this.canPlaceAt(x, y);
    return this._cachedHoverCanPlace;
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
    this.invalidateTowerCache();
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
    this.invalidateTowerCache();
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
    if (!this._activeTowers) {
      this._rebuildEntityLists();
    }
    return this._activeTowers;
  }

  /**
   * Check matching recipes available with current board & placed gems
   */
  getAvailableRecipes() {
    const allGems = this.getAllGems().filter(t => !t.isSlate);
    const codes = allGems.map(t => t.isSpecial ? t.specialName : (t.code && t.level ? `${t.code}${t.level}` : null)).filter(Boolean);
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
        if (!g || g.isSlate || consumedTowers.includes(g)) return false;
        const code = g.isSpecial ? g.specialName : (g.code && g.level ? `${g.code}${g.level}` : '');
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

    // Create the Special Tower at the target location and inherit highest MVP level from ingredients
    const specialTower = new Tower(targetX, targetY, { specialName: recipeName });
    const maxMvp = Math.max(0, ...consumedTowers.map(c => c.mvpLevel || 0));
    specialTower.mvpLevel = maxMvp;
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
    this.invalidateTowerCache();
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
    this.invalidateTowerCache();
    SOUND.playCombine();
    this.addFloatingText(keepTower.pixelX, keepTower.pixelY - 20, `${keepTower.name}!`, '#fbbf24', 16, true);
    return true;
  }

  /**
   * Get all combinations (special or duplicate) available for a specific tower
   */
  getCombinationsForTower(tower) {
    if (!tower || tower.isSlate) return [];
    if (this._towerCombinationsCache.has(tower)) {
      return this._towerCombinationsCache.get(tower);
    }
    const allGems = this.getAllGems();
    const combos = findCombinationsForTower(tower, allGems);
    this._towerCombinationsCache.set(tower, combos);
    return combos;
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
    if (this._combinableTowers) return this._combinableTowers;
    const allGems = this.getAllGems();
    const set = new Set();
    for (const g of allGems) {
      if (this.getCombinationsForTower(g).length > 0) {
        set.add(g);
      }
    }
    this._combinableTowers = set;
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
      const inheritedMvp = Math.max(tower.mvpLevel || 0, ...partnerTowers.map(p => p.mvpLevel || 0));
      tower.initFromData({ specialName: recipeName });
      tower.mvpLevel = inheritedMvp;
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
      this.invalidateTowerCache();
      SOUND.playCombine();
      this.addFloatingText(tower.pixelX, tower.pixelY - 20, `${recipeName}!`, '#fbbf24', 18, true);
      return true;
    } else if (combination.type === 'duplicate') {
      const { targetLevel, gemCode } = combination;
      const inheritedMvp = Math.max(tower.mvpLevel || 0, ...partnerTowers.map(p => p.mvpLevel || 0));
      tower.initFromData({ code: gemCode, level: targetLevel });
      tower.mvpLevel = inheritedMvp;
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
      this.invalidateTowerCache();
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
    this.invalidateTowerCache();
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

    this.invalidateTowerCache();
    SOUND.playUpgrade();
    return true;
  }

  /**
   * Check if a trap can be placed at (x, y)
   */
  canPlaceTrapAt(x, y) {
    if (!this.pathfinding.isInside(x, y)) return false;
    if (this.pathfinding.isCheckpoint(x, y)) return false;
    if (this.towerGrid[y][x] !== null) return false;
    if (this.traps.some(t => t.tileX === x && t.tileY === y)) return false;
    return true;
  }

  /**
   * Buy and place a trap at (x, y)
   */
  placeTrap(trapKey, x, y) {
    const def = TRAP_TYPES[trapKey];
    if (!def) return false;
    if (this.gold < def.cost) {
      SOUND.playError();
      return false;
    }
    if (!this.canPlaceTrapAt(x, y)) {
      SOUND.playError();
      return false;
    }

    this.gold -= def.cost;
    const trap = new Trap(x, y, def);
    this.traps.push(trap);
    SOUND.playTrapPlace();
    this.addFloatingText(trap.pixelX, trap.pixelY - 15, `${def.name}!`, def.color, 14, true);
    return true;
  }

  /**
   * Check if a tower can be moved
   */
  canMoveTower(tower) {
    return !!(tower && !tower.isSlate);
  }

  /**
   * Check if a tower can be moved to target (x, y)
   */
  canMoveTowerTo(tower, targetX, targetY) {
    if (!this.canMoveTower(tower)) return false;
    if (!this.pathfinding.isInside(targetX, targetY)) return false;
    if (this.pathfinding.isCheckpoint(targetX, targetY)) return false;
    if (tower.tileX === targetX && tower.tileY === targetY) return false;

    const destTower = this.towerGrid[targetY][targetX];
    // Swapping with an existing Rock Slate is always valid and 100% pathing safe!
    if (destTower && destTower.isSlate) return true;

    // Moving to an empty tile:
    if (!destTower && this.grid[targetY][targetX] === TILE_TYPES.EMPTY) {
      return this.pathfinding.canPlaceAt(this.grid, targetX, targetY);
    }

    return false;
  }

  /**
   * Move or swap a tower to target (x, y)
   */
  moveTower(tower, targetX, targetY) {
    if (!this.canMoveTowerTo(tower, targetX, targetY)) {
      SOUND.playError();
      return false;
    }
    if (this.gold < CONFIG.MOVE_TOWER_COST) {
      SOUND.playError();
      return false;
    }

    this.gold -= CONFIG.MOVE_TOWER_COST;
    const oldX = tower.tileX;
    const oldY = tower.tileY;
    const destTower = this.towerGrid[targetY][targetX];

    if (destTower && destTower.isSlate) {
      // Swap positions
      destTower.tileX = oldX;
      destTower.tileY = oldY;
      destTower.pixelX = oldX * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      destTower.pixelY = oldY * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      this.towerGrid[oldY][oldX] = destTower;

      tower.tileX = targetX;
      tower.tileY = targetY;
      tower.pixelX = targetX * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      tower.pixelY = targetY * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      this.towerGrid[targetY][targetX] = tower;
    } else {
      // Empty tile: leave a slate at old position so the maze doesn't get punctured!
      const newSlate = new Tower(oldX, oldY, { isSlate: true });
      this.towerGrid[oldY][oldX] = newSlate;
      this.grid[oldY][oldX] = TILE_TYPES.SLATE;

      tower.tileX = targetX;
      tower.tileY = targetY;
      tower.pixelX = targetX * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      tower.pixelY = targetY * CONFIG.DEFAULT_TILE_SIZE + CONFIG.DEFAULT_TILE_SIZE / 2;
      this.towerGrid[targetY][targetX] = tower;
      this.grid[targetY][targetX] = TILE_TYPES.TOWER;
    }

    this.updateRoute();
    this.invalidateTowerCache();
    SOUND.playTeleport();
    this.addFloatingText(tower.pixelX, tower.pixelY - 20, 'Tower Relocated!', '#fbbf24', 16, true);
    this.selectedTower = tower;
    return true;
  }

  /**
   * Socket a rune into an active tower
   */
  socketRuneToTower(tower, runeKey) {
    if (!tower || tower.isSlate || !tower.canSocketRune()) {
      SOUND.playError();
      return false;
    }
    const def = RUNE_TYPES[runeKey];
    if (!def) return false;
    if (this.gold < def.cost) {
      SOUND.playError();
      return false;
    }

    this.gold -= def.cost;
    tower.socketRune(runeKey);
    this.aurasDirty = true;
    SOUND.playRuneSocket();
    this.addFloatingText(tower.pixelX, tower.pixelY - 20, `${def.name} Socketed!`, def.color, 16, true);
    return true;
  }

  /**
   * Heal the Gem Castle
   */
  healCastle() {
    if (this.gold < CONFIG.HEAL_CASTLE_COST) {
      SOUND.playError();
      return false;
    }
    this.gold -= CONFIG.HEAL_CASTLE_COST;
    this.lives += CONFIG.HEAL_CASTLE_AMOUNT;
    SOUND.playHeal();
    const cp = CONFIG.CHECKPOINTS[4];
    this.addFloatingText(cp.x * CONFIG.DEFAULT_TILE_SIZE + 12, cp.y * CONFIG.DEFAULT_TILE_SIZE, `+${CONFIG.HEAL_CASTLE_AMOUNT} Lives!`, '#4ade80', 18, true);
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

    // Reset wave damage counter on all active towers so every wave's MVP is freshly earned
    const allTowers = this.getAllGems();
    for (const t of allTowers) {
      t.waveDamageDealt = 0;
    }

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

  addFloatingText(x, y, text, color, size, isCrit, type, icon) {
    this.floatingTexts.push(new FloatingText(x, y, text, color, size, isCrit, type || 'physical', icon || ''));
  }

  addExplosionParticle(x, y, radius, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (i * 2 * Math.PI) / 12;
      const speed = 40 + Math.random() * 60;
      const type = Math.random() > 0.5 ? 'ember' : 'spark';
      this.particles.push(new Particle(
        x, y, color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2 + Math.random() * 2, 0.4, type
      ));
    }
  }

  addLightningEffect(x1, y1, x2, y2) {
    this.lightningArcs.push({ x1, y1, x2, y2, life: 0.2 });
    // Shock spark particles at target
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      this.particles.push(new Particle(
        x2, y2, '#67e8f9',
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        2, 0.2, 'shock'
      ));
    }
  }

  // ── Type-specific impact particles ──
  addImpactParticles(x, y, damageType = 'physical', count = 5) {
    const IMPACT_COLORS = {
      physical: ['#f87171', '#fca5a5', '#dc2626'],
      magic:    ['#a855f7', '#c084fc', '#7c3aed'],
      lightning:['#22d3ee', '#67e8f9', '#06b6d4'],
      poison:   ['#4ade80', '#86efac', '#16a34a'],
      fire:     ['#f97316', '#fdba74', '#ea580c'],
      ice:      ['#38bdf8', '#7dd3fc', '#0284c7'],
      crit:     ['#fbbf24', '#fde047', '#f59e0b'],
    };
    const IMPACT_TYPES = {
      physical: 'spark',
      magic: 'star',
      lightning: 'shock',
      poison: 'poison_bubble',
      fire: 'ember',
      ice: 'frost_flake',
      crit: 'star',
    };

    const colors = IMPACT_COLORS[damageType] || IMPACT_COLORS.physical;
    const particleType = IMPACT_TYPES[damageType] || 'spark';

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 70;
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(
        x + (Math.random() - 0.5) * 6,
        y + (Math.random() - 0.5) * 6,
        color,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        1.5 + Math.random() * 2.5,
        0.25 + Math.random() * 0.2,
        particleType
      ));
    }
  }

  // ── Impact ring (expanding circle at hit location) ──
  addImpactRing(x, y, color, maxRadius = 15) {
    this.impactRings.push({
      x, y, color,
      startRadius: 3,
      maxRadius,
      age: 0,
      life: 0.3
    });
  }

  // ── Slash arc particle for cleave ──
  addSlashParticle(x, y, radius, color) {
    const arcStart = Math.random() * Math.PI;
    this.particles.push(new Particle(
      x, y, color, 0, 0, radius * 0.3, 0.3, 'slash', {
        arcStart: arcStart,
        arcEnd: arcStart + Math.PI * 1.2
      }
    ));
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

    // Update impact rings
    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      this.impactRings[i].age += dt;
      if (this.impactRings[i].age >= this.impactRings[i].life) {
        this.impactRings.splice(i, 1);
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

    // Update traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i];
      trap.update(dt);

      if (this.phase === GAME_PHASES.WAVE && trap.canTrigger()) {
        for (const creep of this.creeps) {
          if (creep.hp > 0 && !creep.isFlying) {
            const d = Math.hypot(creep.x - trap.pixelX, creep.y - trap.pixelY);
            if (d <= trap.triggerRadius) {
              trap.trigger(creep, this);
              break;
            }
          }
        }
      }

      if (trap.isDead) {
        this.traps.splice(i, 1);
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

      // Calculate tower auras before attack updates only if layout/runes changed
      if (this.aurasDirty) {
        this.updateTowerAuras();
      }

      // Update active non-slate towers directly
      const activeTowers = this.getAllGems();
      for (let i = 0; i < activeTowers.length; i++) {
        activeTowers[i].update(dt, this.creeps, this);
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

  updateTowerAuras(force = false) {
    if (!this.aurasDirty && !force) return;
    this.aurasDirty = false;

    // Reset aura buffs
    const allTowers = this.getAllGems();
    for (const tower of allTowers) {
      tower.auraSpeedMultiplier = 1.0;
      tower.auraDamageMultiplier = 1.0;
      tower.auraRangeBonus = 0;
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

      // MVP Friendly Towers Damage Aura (2 tiles radius, +3% per level, up to +30% at MVP 10)
      if (src.mvpLevel && src.mvpLevel > 0) {
        const allyBonus = src.mvpLevel * CONFIG.MVP_ALLY_AURA_PER_LEVEL;
        const allyRad = CONFIG.MVP_ALLY_AURA_RADIUS_TILES * CONFIG.DEFAULT_TILE_SIZE + 10;
        for (const target of allTowers) {
          if (target !== src && Math.hypot(target.pixelX - src.pixelX, target.pixelY - src.pixelY) <= allyRad) {
            target.auraDamageMultiplier += allyBonus;
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

    // Calculate Round MVP Tower based on waveDamageDealt
    const activeTowers = this.getAllGems().filter(t => !t.isSlate);
    let mvpTower = null;
    let maxDamage = 0;
    for (const t of activeTowers) {
      if ((t.waveDamageDealt || 0) > maxDamage) {
        maxDamage = t.waveDamageDealt;
        mvpTower = t;
      }
    }

    if (mvpTower && maxDamage > 0) {
      if (mvpTower.mvpLevel < CONFIG.MVP_MAX_LEVEL) {
        mvpTower.mvpLevel++;
      }
      this.lastWaveMvp = {
        tower: mvpTower,
        damage: maxDamage,
        level: mvpTower.mvpLevel,
        wave: this.currentWave
      };
      this.aurasDirty = true;
      SOUND.playMvpAward();
      this.addFloatingText(mvpTower.pixelX, mvpTower.pixelY - 24, `👑 ROUND MVP! (Lvl ${mvpTower.mvpLevel})`, '#fbbf24', 18, true);
      this.addFloatingText(mvpTower.pixelX, mvpTower.pixelY - 8, `${Math.round(maxDamage).toLocaleString()} Dmg`, '#fef08a', 14, false);
    } else {
      this.lastWaveMvp = null;
    }

    if (this.currentWave >= WAVES.length) {
      this.phase = GAME_PHASES.VICTORY;
      return;
    }

    this.currentWave++;
    this.phase = GAME_PHASES.BUILDING;
    this.placedGemsThisTurn = [];
  }
}
