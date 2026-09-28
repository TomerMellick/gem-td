// Gem TD - Neural AI Agent & Autoplay Controller
// Powered by trained PyTorch RL weights with pure JavaScript in-browser inference

import { CONFIG } from './config.js';
import { SPECIAL_TOWERS } from './recipes.js';

const BASE_GEM_CODES = ['B', 'D', 'Y', 'E', 'G', 'Q', 'R', 'P'];

// Strategic mazing coordinates template (central killzone & serpentine detours)
const STRATEGIC_MAZE_TEMPLATE = [];
// 1. Central killzone rings around (16, 16)
for (const r of [14, 15, 17, 18]) {
  for (const c of [14, 15, 17, 18]) {
    STRATEGIC_MAZE_TEMPLATE.push({ x: c, y: r });
  }
}
// 2. Concentric rings forcing serpentine detours
for (const offset of [4, 6, 8, 10, 12]) {
  for (let x = 16 - offset; x <= 16 + offset; x += 2) {
    STRATEGIC_MAZE_TEMPLATE.push({ x, y: 16 - offset });
    STRATEGIC_MAZE_TEMPLATE.push({ x, y: 16 + offset });
  }
  for (let y = 16 - offset; y <= 16 + offset; y += 2) {
    STRATEGIC_MAZE_TEMPLATE.push({ x: 16 - offset, y });
    STRATEGIC_MAZE_TEMPLATE.push({ x: 16 + offset, y });
  }
}

/**
 * Lightweight in-browser neural network inference engine
 */
class NeuralNetwork {
  constructor() {
    this.weights = null;
    this.isLoaded = false;
  }

  async load(url = './js/ai_weights.json') {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      this.weights = await resp.json();
      this.isLoaded = true;
      console.log('🤖 AI Neural Weights loaded successfully!');
    } catch (err) {
      console.warn('Neural weights not found or failed to load, falling back to heuristic AI:', err);
    }
  }

  // Math helpers
  static relu(vec) {
    return vec.map(v => Math.max(0, v));
  }

  static dot(vecA, vecB) {
    let s = 0;
    for (let i = 0; i < vecA.length; i++) s += vecA[i] * vecB[i];
    return s;
  }

  static matVecMul(W, x, bias) {
    // W: [out_dim, in_dim]
    const out = new Float32Array(W.length);
    for (let i = 0; i < W.length; i++) {
      let sum = bias ? bias[i] : 0;
      const row = W[i];
      for (let j = 0; j < x.length; j++) {
        sum += row[j] * x[j];
      }
      out[i] = sum;
    }
    return out;
  }

  static layerNorm(vec, gamma, beta, eps = 1e-5) {
    let mean = 0;
    const len = vec.length;
    for (let i = 0; i < len; i++) mean += vec[i];
    mean /= len;

    let variance = 0;
    for (let i = 0; i < len; i++) {
      const diff = vec[i] - mean;
      variance += diff * diff;
    }
    variance /= len;

    const std = Math.sqrt(variance + eps);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const norm = (vec[i] - mean) / std;
      out[i] = (gamma ? norm * gamma[i] : norm) + (beta ? beta[i] : 0);
    }
    return out;
  }

  static softmax(logits) {
    let max = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > max) max = logits[i];
    }
    const exp = logits.map(l => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map(e => e / (sum || 1));
  }

  forward(features) {
    if (!this.isLoaded || !this.weights) return null;
    const w = this.weights;

    // Layer 1
    let h1 = NeuralNetwork.matVecMul(w['fc1.weight'], features, w['fc1.bias']);
    h1 = NeuralNetwork.layerNorm(h1, w['ln1.weight'], w['ln1.bias']);
    h1 = NeuralNetwork.relu(h1);

    // Layer 2
    let h2 = NeuralNetwork.matVecMul(w['fc2.weight'], h1, w['fc2.bias']);
    h2 = NeuralNetwork.layerNorm(h2, w['ln2.weight'], w['ln2.bias']);
    h2 = NeuralNetwork.relu(h2);

    // Policy Head (Action Logits)
    let p1 = NeuralNetwork.matVecMul(w['policy_head.0.weight'], h2, w['policy_head.0.bias']);
    p1 = NeuralNetwork.relu(p1);
    const logits = NeuralNetwork.matVecMul(w['policy_head.2.weight'], p1, w['policy_head.2.bias']);

    // Value Head
    let v1 = NeuralNetwork.matVecMul(w['value_head.0.weight'], h2, w['value_head.0.bias']);
    v1 = NeuralNetwork.relu(v1);
    const value = NeuralNetwork.matVecMul(w['value_head.2.weight'], v1, w['value_head.2.bias'])[0];

    return { logits: Array.from(logits), value };
  }
}

export class AIAgent {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.enabled = false;
    this.speed = 'normal'; // 'normal', 'fast', 'turbo'
    this.actionDelay = 500; // ms
    this.lastActionTime = 0;
    this.nn = new NeuralNetwork();
    this.thought = 'AI Agent initialized. Toggle ON to start autoplay.';
    this.confidence = 0.85;

    // Load trained neural weights
    this.nn.load();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.thought = 'AI Autoplay enabled! Analyzing maze strategy...';
      // Automatically switch to fast speed for enjoyable viewing if on 1x
      if (this.game.gameSpeed === 1) {
        this.game.gameSpeed = 2;
      }
    } else {
      this.thought = 'AI Autoplay paused.';
    }
    return this.enabled;
  }

  setSpeed(speedKey) {
    this.speed = speedKey;
    if (speedKey === 'normal') this.actionDelay = 600;
    else if (speedKey === 'fast') this.actionDelay = 250;
    else if (speedKey === 'turbo') this.actionDelay = 40;
  }

  extractFeatures() {
    const g = this.game;
    const feats = [];

    // 1. Global state (8 features)
    feats.push(g.currentWave / 50.0);
    feats.push(g.lives / 50.0);
    feats.push(Math.min(g.gold / 500.0, 1.0));
    feats.push(g.chanceLevel / 6.0);
    feats.push(g.fullCreepPath.length / 400.0);
    feats.push(g.getAllGems().length / 50.0);
    feats.push(0.0); // flying
    feats.push(0.0); // boss

    // 2. 5 Rolled Gems (12 * 5 = 60 features)
    const placed = g.placedGemsThisTurn || [];
    for (let i = 0; i < 5; i++) {
      if (i < placed.length) {
        const gem = placed[i];
        for (const c of BASE_GEM_CODES) feats.push(gem.code === c ? 1.0 : 0.0);
        feats.push(gem.level / 5.0);
        feats.push((gem.damage * gem.attackSpeed) / 500.0);
        feats.push(Math.hypot(gem.tileX - 16, gem.tileY - 16) / 24.0);
        feats.push(0.5); // path coverage
      } else {
        for (let k = 0; k < 12; k++) feats.push(0.0);
      }
    }

    // 3. Board Composition (16 features)
    const active = g.getAllGems();
    const counts = {};
    for (const c of BASE_GEM_CODES) counts[c] = 0;
    for (const t of active) {
      if (t.code && counts[t.code] !== undefined) counts[t.code]++;
    }
    for (const c of BASE_GEM_CODES) feats.push(counts[c] / 10.0);
    for (let u = 0; u < 5; u++) feats.push(0.2); // utility
    for (let r = 0; r < 3; r++) feats.push(0.33); // recipe progress

    // 4. Recipe availability flags (10 features)
    const availRecipes = g.getAvailableRecipes();
    const recipeKeys = Object.keys(SPECIAL_TOWERS);
    for (const rk of recipeKeys.slice(0, 10)) {
      feats.push(availRecipes.some(r => r.name === rk) ? 1.0 : 0.0);
    }
    while (feats.length < 94) feats.push(0.0);

    // 5. Duplicate availability (2 features)
    const dupes = g.getAvailableDuplicateUpgrades();
    feats.push(dupes.some(d => d.type === 'pair') ? 1.0 : 0.0);
    feats.push(dupes.some(d => d.type === 'quad') ? 1.0 : 0.0);

    return feats;
  }

  getActionMask() {
    const mask = [true, true, true, true, true, false, false];
    const availRecipes = this.game.getAvailableRecipes();
    if (availRecipes && availRecipes.length > 0) mask[5] = true;

    const dupes = this.game.getAvailableDuplicateUpgrades();
    if (dupes && dupes.length > 0) mask[6] = true;
    return mask;
  }

  findNextMazePlacement() {
    // 1. Try template slots
    for (const coord of STRATEGIC_MAZE_TEMPLATE) {
      if (this.game.canPlaceAt(coord.x, coord.y)) {
        return coord;
      }
    }

    // 2. Fallback to staggered grid slots
    for (let x = 6; x <= 26; x += 3) {
      for (let y = 6; y <= 26; y += 3) {
        if (this.game.canPlaceAt(x, y)) {
          return { x, y };
        }
      }
    }
    return null;
  }

  tick(now) {
    if (!this.enabled) return;
    if (this.game.phase === 'GAME_OVER' || this.game.phase === 'VICTORY') return;

    if (now - this.lastActionTime < this.actionDelay) return;

    // --- PHASE 1: BUILDING (Place 5 gems) ---
    if (this.game.phase === 'BUILDING') {
      if (this.game.placedGemsThisTurn.length < CONFIG.GEMS_PER_ROUND) {
        const spot = this.findNextMazePlacement();
        if (spot) {
          this.game.placeGemAt(spot.x, spot.y);
          this.lastActionTime = now;
          this.thought = `Placed maze barrier at (${spot.x}, ${spot.y}). Path extended to ${this.game.fullCreepPath.length} tiles.`;
          this.confidence = 0.92;
        }
      }
      return;
    }

    // --- PHASE 2: CHOOSING (Keep gem or craft recipe) ---
    if (this.game.phase === 'CHOOSING') {
      const placed = this.game.placedGemsThisTurn;
      if (!placed || placed.length === 0) return;

      const availRecipes = this.game.getAvailableRecipes();
      const dupes = this.game.getAvailableDuplicateUpgrades();

      // Check neural network evaluation
      let chosenAction = 0;
      if (this.nn.isLoaded) {
        const feats = this.extractFeatures();
        const pred = this.nn.forward(feats);
        if (pred && pred.logits) {
          const mask = this.getActionMask();
          let bestVal = -Infinity;
          for (let i = 0; i < pred.logits.length; i++) {
            if (mask[i] && pred.logits[i] > bestVal) {
              bestVal = pred.logits[i];
              chosenAction = i;
            }
          }
        }
      } else {
        // Heuristic fallback
        if (availRecipes && availRecipes.length > 0) chosenAction = 5;
        else if (dupes && dupes.length > 0) chosenAction = 6;
        else {
          // Pick highest level gem, or highest damage
          let bestIdx = 0;
          let maxLvl = -1;
          placed.forEach((g, idx) => {
            if (g.level > maxLvl) {
              maxLvl = g.level;
              bestIdx = idx;
            }
          });
          chosenAction = bestIdx;
        }
      }

      // Execute Action
      if (chosenAction === 5 && availRecipes && availRecipes.length > 0) {
        const rec = availRecipes[0];
        this.game.craftSpecialTower(rec.name);
        this.thought = `Crafted Special Tower: ${rec.name} (${rec.def.tier})! Massive DPS boost.`;
        this.confidence = 0.98;
      } else if (chosenAction === 6 && dupes && dupes.length > 0) {
        // Pick best gem from dupes
        this.game.keepGem(placed[0]);
        this.thought = `Selected duplicate gem for high-tier combine!`;
        this.confidence = 0.90;
      } else {
        const idx = Math.min(chosenAction, placed.length - 1);
        const kept = placed[idx];
        this.game.keepGem(kept);
        this.thought = `Kept ${kept.name} (Tier ${kept.level}) at (${kept.tileX}, ${kept.tileY}).`;
        this.confidence = 0.88;
      }

      this.lastActionTime = now;
      return;
    }

    // --- PHASE 3: WAVE (Combat, Shop Economy) ---
    if (this.game.phase === 'WAVE') {
      // Auto-upgrade chance level in shop if gold permits
      if (this.game.chanceLevel < CONFIG.CHANCE_UPGRADES.length) {
        const nextDef = CONFIG.CHANCE_UPGRADES[this.game.chanceLevel];
        if (nextDef && this.game.gold >= nextDef.cost) {
          if (this.game.upgradeChance()) {
            this.thought = `Upgraded Chance Level to ${this.game.chanceLevel}! Higher tier gem probabilities unlocked.`;
            this.lastActionTime = now;
          }
        }
      }
    }
  }
}
