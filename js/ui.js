// Gem TD - User Interface Controller
import { CONFIG, QUALITIES, BASE_GEMS, TRAP_TYPES, RUNE_TYPES } from './config.js';
import { SPECIAL_TOWERS } from './recipes.js';
import { GAME_PHASES } from './game.js';
import { SOUND } from './audio.js';

export class UIController {
  constructor(game, renderer) {
    this.game = game;
    this.renderer = renderer;

    this.lastDockKey = null;
    this.lastInspectorKey = null;

    this.cacheElements();
    this.bindEvents();
    this.renderCodex();
  }

  cacheElements() {
    this.elWave = document.getElementById('hud-wave');
    this.elWaveName = document.getElementById('hud-wave-name');
    this.elLives = document.getElementById('hud-lives');
    this.elGold = document.getElementById('hud-gold');
    this.elScore = document.getElementById('hud-score');
    this.elPhaseBanner = document.getElementById('phase-banner');

    this.elSpeedBtns = document.querySelectorAll('.speed-btn');
    this.elSoundBtn = document.getElementById('btn-sound');
    this.elShopBtn = document.getElementById('btn-shop');
    this.elCodexBtn = document.getElementById('btn-codex');
    this.elHelpBtn = document.getElementById('btn-help');
    this.elRestartBtn = document.getElementById('btn-restart');

    this.elBottomDock = document.getElementById('bottom-dock');
    this.elInspector = document.getElementById('inspector-panel');

    // Modals
    this.modalShop = document.getElementById('modal-shop');
    this.modalCodex = document.getElementById('modal-codex');
    this.modalHelp = document.getElementById('modal-help');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalVictory = document.getElementById('modal-victory');

    this.shopGoldVal = document.getElementById('shop-gold-val');
    this.shopItemsList = document.getElementById('shop-items-list');
    this.shopFilterBtns = document.querySelectorAll('.shop-filter-btn');
    this.activeShopTab = 'all';

    this.codexList = document.getElementById('codex-list');
    this.codexFilterBtns = document.querySelectorAll('.codex-filter-btn');
    this.codexSearch = document.getElementById('codex-search');

    // HUD caching to eliminate DOM layout churn at 60 FPS
    this._lastHudWave = null;
    this._lastHudLives = null;
    this._lastHudGold = null;
    this._lastHudScore = null;
    this._lastHudBanner = null;
  }

  bindEvents() {
    // Canvas click & mousemove
    const canvas = this.renderer.canvas;
    canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
    canvas.addEventListener('mouseleave', () => { this.game.hoverTile = null; });
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.game.interactionMode) {
        this.game.interactionMode = null;
        this.invalidateUI();
      }
    });

    // Permanent event delegation on Bottom Dock
    this.elBottomDock.addEventListener('click', (e) => this.onDockClick(e));
    this.elBottomDock.addEventListener('dblclick', (e) => this.onDockDblClick(e));

    // Permanent event delegation on Inspector Panel
    this.elInspector.addEventListener('click', (e) => this.onInspectorClick(e));

    // Permanent event delegation on Shop & Codex
    if (this.shopItemsList) {
      this.shopItemsList.addEventListener('click', (e) => this.onShopClick(e));
    }
    if (this.codexList) {
      this.codexList.addEventListener('click', (e) => this.onCodexClick(e));
    }

    // Speed controls
    this.elSpeedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        SOUND.playClick();
        const speed = parseFloat(btn.dataset.speed);
        this.setSpeed(speed);
      });
    });

    // Sound toggle
    this.elSoundBtn.addEventListener('click', () => {
      const isMuted = SOUND.toggleMute();
      this.elSoundBtn.textContent = isMuted ? '🔇 Sound: Off' : '🔊 Sound: On';
      this.elSoundBtn.classList.toggle('active', !isMuted);
    });

    // Modals open/close
    this.elShopBtn.addEventListener('click', () => {
      this.openShop();
    });

    this.elCodexBtn.addEventListener('click', () => {
      SOUND.playClick();
      this.updateCodexMatches();
      this.modalCodex.showModal();
    });

    this.elHelpBtn.addEventListener('click', () => {
      SOUND.playClick();
      this.modalHelp.showModal();
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SOUND.playClick();
        const dialog = e.target.closest('dialog');
        if (dialog) dialog.close();
      });
    });

    // Light dismiss on backdrop click
    [this.modalShop, this.modalCodex, this.modalHelp, this.modalGameOver, this.modalVictory].forEach(dialog => {
      if (dialog) {
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) {
            dialog.close();
          }
        });
      }
    });

    // Restart buttons
    document.querySelectorAll('.restart-game-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SOUND.playClick();
        if (this.modalGameOver.open) this.modalGameOver.close();
        if (this.modalVictory.open) this.modalVictory.close();
        this.game.reset();
        this.invalidateUI();
      });
    });

    // Shop tab filters
    this.shopFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        SOUND.playClick();
        this.openShop(btn.dataset.tab || 'all');
      });
    });

    // Codex filters
    this.codexFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.codexFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterCodex();
      });
    });

    if (this.codexSearch) {
      this.codexSearch.addEventListener('input', () => this.filterCodex());
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.game.interactionMode) {
          this.game.interactionMode = null;
          this.invalidateUI();
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === '1') {
        this.setSpeed(1);
      } else if (e.key === '2') {
        this.setSpeed(2);
      } else if (e.key === '3') {
        this.setSpeed(4);
      } else if (e.key === 'b' || e.key === 'B') {
        if (this.modalShop.open) this.modalShop.close();
        else this.openShop();
      } else if (e.key === 'c' || e.key === 'C') {
        if (this.modalCodex.open) this.modalCodex.close();
        else {
          this.updateCodexMatches();
          this.modalCodex.showModal();
        }
      }
    });
  }

  setSpeed(speed) {
    this.game.gameSpeed = speed;
    this.elSpeedBtns.forEach(btn => {
      const bSpeed = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', bSpeed === speed);
    });
  }

  togglePause() {
    if (this.game.gameSpeed === 0) {
      this.setSpeed(this.game.previousSpeed || 1);
    } else {
      this.game.previousSpeed = this.game.gameSpeed;
      this.setSpeed(0);
    }
  }

  getTileAtEvent(e) {
    if (!this.renderer || !this.renderer.canvas) return null;
    const rect = this.renderer.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = this.renderer.canvas.width / rect.width;
    const scaleY = this.renderer.canvas.height / rect.height;

    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const tx = Math.floor(mx / this.renderer.tileSize);
    const ty = Math.floor(my / this.renderer.tileSize);

    if (tx >= 0 && tx < CONFIG.GRID_WIDTH && ty >= 0 && ty < CONFIG.GRID_HEIGHT) {
      return { x: tx, y: ty };
    }
    return null;
  }

  onCanvasMouseMove(e) {
    this.game.hoverTile = this.getTileAtEvent(e);
  }

  onCanvasClick(e) {
    SOUND.ensureContext();
    const tile = this.getTileAtEvent(e) || this.game.hoverTile;
    if (!tile) return;
    this.game.hoverTile = tile;

    const { x, y } = tile;
    const clickedTower = this.game.towerGrid[y][x];

    // Handle special interaction modes (Move Tower, Place Trap, Socket Rune)
    if (this.game.interactionMode) {
      const mode = this.game.interactionMode;
      if (mode.type === 'MOVE_TOWER') {
        if (!mode.sourceTower) {
          if (clickedTower && !clickedTower.isSlate && !this.game.placedGemsThisTurn.includes(clickedTower)) {
            mode.sourceTower = clickedTower;
            this.game.selectedTower = clickedTower;
            SOUND.playClick();
          } else {
            SOUND.playError();
          }
        } else {
          if (this.game.canMoveTowerTo(mode.sourceTower, x, y)) {
            this.game.moveTower(mode.sourceTower, x, y);
            this.game.interactionMode = null;
          } else {
            SOUND.playError();
          }
        }
      } else if (mode.type === 'PLACE_TRAP') {
        if (this.game.canPlaceTrapAt(x, y)) {
          this.game.placeTrap(mode.trapKey, x, y);
          this.game.interactionMode = null;
        } else {
          SOUND.playError();
        }
      } else if (mode.type === 'SOCKET_RUNE') {
        if (clickedTower && !clickedTower.isSlate && !this.game.placedGemsThisTurn.includes(clickedTower) && clickedTower.canSocketRune()) {
          this.game.socketRuneToTower(clickedTower, mode.runeKey);
          this.game.interactionMode = null;
        } else {
          SOUND.playError();
        }
      }
      this.invalidateUI();
      return;
    }

    if (this.game.phase === GAME_PHASES.BUILDING) {
      if (!clickedTower) {
        this.game.placeGemAt(x, y);
      } else {
        this.game.selectedTower = clickedTower;
      }
    } else {
      // Selecting tower or slate to inspect
      this.game.selectedTower = clickedTower;
    }

    this.invalidateUI();
  }

  onDockClick(e) {
    SOUND.ensureContext();

    // 1. Keep as Tower button
    const keepBtn = e.target.closest('.keep-btn');
    if (keepBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(keepBtn.dataset.idx, 10);
      const chosen = this.game.placedGemsThisTurn[idx];
      if (chosen) {
        this.game.keepGem(chosen);
        this.invalidateUI();
      }
      return;
    }

    // 2. Duplicate Combine button (Pair / Quad)
    const dupBtn = e.target.closest('.dup-craft-btn');
    if (dupBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(dupBtn.dataset.dupIdx, 10);
      const combines = this.game.getAvailableDuplicateUpgrades();
      const up = combines[idx];
      if (up) {
        this.game.applyDuplicateUpgrade(up);
        this.invalidateUI();
      }
      return;
    }

    // 3. Special Tower Combine button
    const specBtn = e.target.closest('.special-craft-btn');
    if (specBtn) {
      e.preventDefault();
      e.stopPropagation();
      const recipeName = specBtn.dataset.recipe;
      if (recipeName) {
        this.game.craftSpecialTower(recipeName);
        this.invalidateUI();
      }
      return;
    }

    // 4. Gem card click: select tower to inspect
    const card = e.target.closest('.gem-card');
    if (card) {
      const idx = parseInt(card.dataset.idx, 10);
      const tower = this.game.placedGemsThisTurn[idx];
      if (tower) {
        this.game.selectedTower = tower;
        this.invalidateUI();
      }
      return;
    }

    // 5. Reroll button
    const rerollBtn = e.target.closest('#btn-reroll');
    if (rerollBtn) {
      e.preventDefault();
      this.game.rerollPlacedGems();
      this.invalidateUI();
      return;
    }

    // 6. Upgrade Chance button
    const upChanceBtn = e.target.closest('#btn-upgrade-chance');
    if (upChanceBtn) {
      e.preventDefault();
      this.game.upgradeChance();
      this.invalidateUI();
      return;
    }
  }

  onDockDblClick(e) {
    const card = e.target.closest('.gem-card');
    if (card) {
      const idx = parseInt(card.dataset.idx, 10);
      const chosen = this.game.placedGemsThisTurn[idx];
      if (chosen && this.game.phase === GAME_PHASES.CHOOSING) {
        this.game.keepGem(chosen);
        this.invalidateUI();
      }
    }
  }

  onInspectorClick(e) {
    SOUND.ensureContext();
    const demoBtn = e.target.closest('#btn-demolish-slate');
    if (demoBtn && this.game.selectedTower && this.game.selectedTower.isSlate) {
      e.preventDefault();
      this.game.removeSlate(this.game.selectedTower.tileX, this.game.selectedTower.tileY);
      this.invalidateUI();
      return;
    }

    const keepBtn = e.target.closest('#btn-inspector-keep');
    if (keepBtn) {
      e.preventDefault();
      const idx = parseInt(keepBtn.dataset.idx, 10);
      const chosen = this.game.placedGemsThisTurn[idx];
      if (chosen && this.game.phase === GAME_PHASES.CHOOSING) {
        this.game.keepGem(chosen);
        this.invalidateUI();
      }
      return;
    }

    const combBtn = e.target.closest('.inspector-combine-btn');
    if (combBtn && this.game.selectedTower) {
      e.preventDefault();
      const idx = parseInt(combBtn.dataset.combIdx, 10);
      const combos = this.game.getCombinationsForTower(this.game.selectedTower);
      const chosen = combos[idx];
      if (chosen) {
        this.game.combineAtTower(this.game.selectedTower, chosen);
        this.invalidateUI();
      }
      return;
    }

    const relocateBtn = e.target.closest('#btn-inspector-relocate');
    if (relocateBtn && this.game.selectedTower && !this.game.selectedTower.isSlate) {
      e.preventDefault();
      this.game.interactionMode = { type: 'MOVE_TOWER', sourceTower: this.game.selectedTower };
      this.invalidateUI();
      return;
    }

    const addRuneBtn = e.target.closest('#btn-inspector-add-rune') || e.target.closest('.rune-pill-empty');
    if (addRuneBtn) {
      e.preventDefault();
      this.openShop('runes');
      return;
    }
  }

  onCodexClick(e) {
    const btn = e.target.closest('.codex-craft-btn');
    if (btn) {
      SOUND.ensureContext();
      const recipeName = btn.dataset.craft;
      if (this.game.craftSpecialTower(recipeName)) {
        this.modalCodex.close();
        this.invalidateUI();
      }
    }
  }

  onShopClick(e) {
    const buyBtn = e.target.closest('.shop-buy-btn');
    if (!buyBtn || buyBtn.disabled) return;
    SOUND.ensureContext();
    const action = buyBtn.dataset.action;

    const targetTower = this.game.selectedTower;
    const hasValidTarget = targetTower && !targetTower.isSlate && !this.game.placedGemsThisTurn.includes(targetTower);

    if (action === 'relocate') {
      if (this.game.gold < CONFIG.MOVE_TOWER_COST) {
        SOUND.playError();
        return;
      }
      SOUND.playClick();
      const src = (buyBtn.dataset.mode !== 'pick' && hasValidTarget) ? targetTower : null;
      this.game.interactionMode = { type: 'MOVE_TOWER', sourceTower: src };
      this.modalShop.close();
      this.invalidateUI();
    } else if (action === 'trap') {
      const trapId = buyBtn.dataset.trapId;
      const def = TRAP_TYPES[trapId];
      if (!def || this.game.gold < def.cost) {
        SOUND.playError();
        return;
      }
      SOUND.playClick();
      this.game.interactionMode = { type: 'PLACE_TRAP', trapKey: trapId };
      this.modalShop.close();
      this.invalidateUI();
    } else if (action === 'rune') {
      const runeId = buyBtn.dataset.runeId;
      const def = RUNE_TYPES[runeId];
      if (!def || this.game.gold < def.cost) {
        SOUND.playError();
        return;
      }

      // If user clicked direct socket and we have a valid target tower with available slots:
      if (buyBtn.dataset.mode !== 'pick' && hasValidTarget && targetTower.canSocketRune()) {
        if (this.game.socketRuneToTower(targetTower, runeId)) {
          this.renderShop(this.activeShopTab);
          this.invalidateUI();
          return;
        }
      }

      // Otherwise enter board pick mode
      SOUND.playClick();
      this.game.interactionMode = { type: 'SOCKET_RUNE', runeKey: runeId };
      this.modalShop.close();
      this.invalidateUI();
    } else if (action === 'heal') {
      if (this.game.healCastle()) {
        this.renderShop(this.activeShopTab);
        this.invalidateUI();
      }
    }
  }

  invalidateUI() {
    this.lastDockKey = null;
    this.lastInspectorKey = null;
    if (this.modalCodex && this.modalCodex.open) {
      this.filterCodex();
    }
    if (this.modalShop && this.modalShop.open) {
      this.renderShop();
    }
  }

  getDockKey() {
    const g = this.game;
    if (g.phase === GAME_PHASES.BUILDING) {
      const nextChanceCost = CONFIG.CHANCE_UPGRADES[g.chanceLevel]?.cost || 999999;
      return `BUILDING_${g.placedGemsThisTurn.length}_${g.chanceLevel}_${g.gold >= nextChanceCost}`;
    }
    if (g.phase === GAME_PHASES.CHOOSING) {
      const placedStr = g.placedGemsThisTurn.map(t => `${t.tileX},${t.tileY},${t.code},${t.level}`).join('|');
      const selStr = g.selectedTower ? `${g.selectedTower.tileX},${g.selectedTower.tileY}` : '';
      return `CHOOSING_${placedStr}_${selStr}_${g.gold >= CONFIG.REROLL_COST}`;
    }
    if (g.phase === GAME_PHASES.WAVE) {
      return `WAVE_${g.currentWave}_${g.creeps.length}`;
    }
    return g.phase;
  }

  getInspectorKey() {
    const t = this.game.selectedTower;
    if (!t) return 'none';
    if (t.isSlate) {
      return `slate_${t.tileX}_${t.tileY}_${this.game.gold >= CONFIG.SLATE_REMOVE_COST}`;
    }
    const isTemp = this.game.placedGemsThisTurn.includes(t);
    const combos = this.game.getCombinationsForTower(t);
    const comboKey = combos.map(c => `${c.type}_${c.recipeName || c.targetLevel}_${(c.partnerTowers || []).map(p => `${p.tileX},${p.tileY}`).join('-')}`).join(';');
    const runeKey = (t.runes || []).join(',');
    const modeKey = this.game.interactionMode ? this.game.interactionMode.type : 'none';
    const goldRelocate = this.game.gold >= CONFIG.MOVE_TOWER_COST;
    return `tower_${t.tileX}_${t.tileY}_${t.code}_${t.level}_${t.isSpecial ? t.specialName : ''}_${t.kills}_${Math.floor(t.totalDamageDealt / 50)}_${t.getEffectiveDamage()}_${t.getEffectiveAttackSpeed()}_${t.getEffectiveRange()}_${isTemp}_${this.game.phase}_${comboKey}_${runeKey}_${modeKey}_${goldRelocate}_${t.mvpLevel || 0}_${Math.floor((t.waveDamageDealt || 0) / 25)}`;
  }

  update() {
    // Check game over or victory
    if (this.game.phase === GAME_PHASES.GAME_OVER && !this.modalGameOver.open) {
      document.getElementById('go-wave').textContent = this.game.currentWave;
      document.getElementById('go-score').textContent = this.game.score;
      this.modalGameOver.showModal();
    }
    if (this.game.phase === GAME_PHASES.VICTORY && !this.modalVictory.open) {
      document.getElementById('vic-score').textContent = this.game.score;
      this.modalVictory.showModal();
    }

    this.updateHUD();

    // Re-render dock only when state key changes
    const dockKey = this.getDockKey();
    if (dockKey !== this.lastDockKey) {
      this.lastDockKey = dockKey;
      this.renderBottomDock();
    }

    // Re-render inspector only when state key changes
    const inspectorKey = this.getInspectorKey();
    if (inspectorKey !== this.lastInspectorKey) {
      this.lastInspectorKey = inspectorKey;
      this.renderInspector();
    }
  }

  getWaveThreatSummary(waveData) {
    const threatTags = [];
    if (waveData.isBoss) threatTags.push('Boss');
    if (waveData.isFlying) threatTags.push('Flying');
    if (waveData.trait && waveData.trait.trim()) threatTags.push(waveData.trait);
    return threatTags.length ? threatTags.join(' • ') : 'Standard';
  }

  getRecommendedTowerRole(waveData) {
    if (waveData.isFlying) return 'Anti-Air';
    if (waveData.trait && /magic immune|physical immune/i.test(waveData.trait)) return 'Burst + Debuff';
    if (waveData.isBoss) return 'Burst + Control';
    if (waveData.trait && /evasion|armored|reactive/i.test(waveData.trait)) return 'Burst + Support';
    return 'Balanced';
  }

  updateHUD() {
    const wave = this.game.currentWave;
    if (this._lastHudWave !== wave) {
      this._lastHudWave = wave;
      this.elWave.textContent = `Wave ${wave} / 50`;
      const waveData = this.game.getWaveData();
      const traitText = waveData.trait ? ` [${waveData.trait}]` : '';
      this.elWaveName.textContent = `${waveData.name}${traitText} • ${waveData.count} creeps`;
    }

    const lives = this.game.lives;
    if (this._lastHudLives !== lives) {
      this._lastHudLives = lives;
      this.elLives.textContent = lives;
    }

    const gold = this.game.gold;
    if (this._lastHudGold !== gold) {
      this._lastHudGold = gold;
      this.elGold.textContent = gold;
      if (this.shopGoldVal && this.modalShop && this.modalShop.open) {
        this.shopGoldVal.textContent = gold;
      }
    }

    const score = this.game.score;
    if (this._lastHudScore !== score) {
      this._lastHudScore = score;
      this.elScore.textContent = score;
    }

    // Phase Banner: only re-render if banner content changes
    let bannerHtml = '';
    if (this.game.phase === GAME_PHASES.BUILDING) {
      const placed = this.game.placedGemsThisTurn.length;
      let mvpNotice = '';
      if (this.game.lastWaveMvp) {
        mvpNotice = ` • <span style="color: #fbbf24;">👑 Wave ${this.game.lastWaveMvp.wave} MVP: <strong>${this.game.lastWaveMvp.tower.name}</strong> (${Math.round(this.game.lastWaveMvp.damage).toLocaleString()} dmg)</span>`;
      }
      bannerHtml = `<span class="badge build">BUILDING</span> Place 5 Gems on the Maze (<strong>${placed} / 5</strong> placed)${mvpNotice}`;
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      bannerHtml = `<span class="badge choose">CHOOSING</span> Select 1 Gem to keep as an active tower! The other 4 become Rocks.`;
    } else if (this.game.phase === GAME_PHASES.WAVE) {
      const remaining = this.game.creeps.length;
      bannerHtml = `<span class="badge wave">COMBAT</span> Wave in progress! (${remaining} enemies remaining)`;
    }
    if (this._lastHudBanner !== bannerHtml) {
      this._lastHudBanner = bannerHtml;
      this.elPhaseBanner.innerHTML = bannerHtml;
    }
  }

  renderBottomDock() {
    const dock = this.elBottomDock;
    if (!dock) return;

    const waveData = this.game.getWaveData();
    const specialText = this.getWaveThreatSummary(waveData);
    const recommendedRole = this.getRecommendedTowerRole(waveData);

    if (this.game.phase === GAME_PHASES.BUILDING) {
      const placed = this.game.placedGemsThisTurn.length;
      const nextChance = CONFIG.CHANCE_UPGRADES[this.game.chanceLevel];
      const maxChance = this.game.chanceLevel >= CONFIG.CHANCE_UPGRADES.length;

      dock.innerHTML = `
        <div class="dock-row">
          <div class="dock-info">
            <span class="dock-title">Wave ${this.game.currentWave}: ${waveData.name}</span>
            <div class="wave-stat-strip">
              <span>❤️ HP: ${waveData.hp}</span>
              <span>👥 Amount: ${waveData.count}</span>
              <span>✨ Threat: ${specialText}</span>
              <span>🎯 Counter: ${recommendedRole}</span>
            </div>
            <span class="dock-desc">Gems placed this round: ${placed} / 5 • Click empty tiles to place gems and build your maze!</span>
          </div>
          <div class="dock-actions">
            <button type="button" id="btn-upgrade-chance" class="game-btn primary" ${maxChance || this.game.gold < (nextChance ? nextChance.cost : 999) ? 'disabled' : ''}>
              ⭐ Upgrade Chances (${maxChance ? 'MAX' : `${nextChance.cost} Gold`})
            </button>
          </div>
        </div>
      `;
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      const matchingRecipes = this.game.getAvailableRecipes();
      const duplicateCombines = this.game.getAvailableDuplicateUpgrades();

      let combineHtml = '';
      if (matchingRecipes.length > 0) {
        combineHtml += `
          <div class="combine-box">
            <span class="combine-title">✨ Special Tower!</span>
            <div class="combine-list">
              ${matchingRecipes.map(m => `
                <button type="button" class="game-btn special-craft-btn" data-recipe="${m.name}">
                  Combine ${m.name} (${m.def.tier})
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (duplicateCombines.length > 0) {
        combineHtml += `
          <div class="combine-box duplicate">
            <span class="combine-title">⭐ Duplicate Upgrade!</span>
            <div class="combine-list">
              ${duplicateCombines.map((u, i) => `
                <button type="button" class="game-btn dup-craft-btn" data-dup-idx="${i}">
                  ${u.label}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      const gemCardsHtml = this.game.placedGemsThisTurn.map((gem, idx) => {
        const q = QUALITIES[gem.level] || {};
        const isSelected = this.game.selectedTower === gem;
        return `
          <div class="gem-card ${isSelected ? 'selected' : ''}" data-idx="${idx}">
            <div class="gem-card-header" style="border-color: ${gem.gemColor}">
              <div class="gem-icon-circle" style="background: ${gem.gemColor}; border-color: ${q.border || '#cbd5e1'}">
                ${gem.code}${gem.level}
              </div>
              <div class="gem-card-title">
                <div class="name">${gem.name}</div>
                <div class="quality" style="color: ${q.ringColor || '#cbd5e1'}">${q.namePrefix}</div>
              </div>
            </div>
            <div class="gem-card-stats">
              <div>⚔️ Dmg: <strong>${gem.damage}</strong></div>
              <div>⚡ Spd: <strong>${gem.attackSpeed}/s</strong></div>
              <div>🎯 Rng: <strong>${gem.range}</strong></div>
            </div>
            <div class="gem-card-desc">${gem.description || ''}</div>
            <button type="button" class="game-btn keep-btn" data-idx="${idx}">✓ Keep as Tower</button>
          </div>
        `;
      }).join('');

      dock.innerHTML = `
        <div class="choosing-dock">
          <div class="choosing-top-bar">
            <div class="combine-section">
              ${combineHtml ? combineHtml : '<span class="choose-hint">Select a gem to keep as your active tower (the other 4 become rocks):</span>'}
            </div>
            <div class="dock-actions">
              <button type="button" id="btn-reroll" class="game-btn secondary" ${this.game.gold < CONFIG.REROLL_COST ? 'disabled' : ''}>
                🎲 Reroll Gems (${CONFIG.REROLL_COST} Gold)
              </button>
            </div>
          </div>
          <div class="gem-cards-container">
            ${gemCardsHtml}
          </div>
        </div>
      `;
    } else if (this.game.phase === GAME_PHASES.WAVE) {
      dock.innerHTML = `
        <div class="dock-row wave-status">
          <div class="dock-info">
            <span class="dock-title">Wave ${this.game.currentWave}: ${waveData.name}</span>
            <div class="wave-stat-strip">
              <span>❤️ HP: ${waveData.hp}</span>
              <span>👥 Amount: ${waveData.count}</span>
              <span>✨ Threat: ${specialText}</span>
              <span>🎯 Counter: ${recommendedRole}</span>
            </div>
            <span class="dock-desc">Towers are defending the castle against the invaders!</span>
          </div>
        </div>
      `;
    }
  }

  renderInspector() {
    const panel = this.elInspector;
    if (!panel) return;

    const t = this.game.selectedTower;
    if (!t) {
      panel.innerHTML = `
        <div class="empty-inspector">
          <p>Click any tower, gem, or slate to inspect stats and abilities.</p>
        </div>
      `;
      return;
    }

    if (t.isSlate) {
      panel.innerHTML = `
        <div class="inspector-header">
          <span class="icon">🧱</span>
          <div>
            <h3>Rock Slate</h3>
            <span class="sub">Maze Barrier</span>
          </div>
        </div>
        <p class="desc">A solid granite obstacle that forces ground creeps to navigate around it.</p>
        <div class="actions">
          <button type="button" id="btn-demolish-slate" class="game-btn danger" ${this.game.gold < CONFIG.SLATE_REMOVE_COST ? 'disabled' : ''}>
            Demolish (${CONFIG.SLATE_REMOVE_COST} Gold)
          </button>
        </div>
      `;
      return;
    }

    // Active Gem or Special Tower
    const q = QUALITIES[t.level];
    const tierBadge = t.isSpecial ? `<span class="badge special">${t.tier}</span>` : `<span class="badge tier" style="background: ${q ? q.border : '#334155'}">${q ? q.namePrefix : ''}</span>`;
    const isTempGem = this.game.placedGemsThisTurn.includes(t);
    const canFinalizeRound = this.game.phase === GAME_PHASES.CHOOSING && this.game.placedGemsThisTurn.length >= CONFIG.GEMS_PER_ROUND;
    const isUnconfirmedGem = canFinalizeRound && isTempGem;
    const unconfirmedIdx = isUnconfirmedGem ? this.game.placedGemsThisTurn.indexOf(t) : -1;

    const combinations = this.game.getCombinationsForTower(t);
    let combinationsHtml = '';
    if (canFinalizeRound && combinations.length > 0) {
      combinationsHtml = `
        <div class="combine-ready-section">
          <div class="combine-ready-header">
            <span class="combine-badge-icon">✨</span>
            <div class="combine-ready-text">
              <span class="combine-ready-title">Ready to Combine!</span>
              <span class="combine-ready-hint">Upgrades here. Consumed towers turn into rock slates.</span>
            </div>
          </div>
          <div class="combine-btn-list">
            ${combinations.map((c, idx) => {
              if (c.type === 'special') {
                return `
                  <button type="button" class="game-btn inspector-combine-btn special-combine-btn" data-comb-idx="${idx}">
                    <div class="combine-btn-info">
                      <span class="combine-btn-title">⭐ Combine: ${c.recipeName}</span>
                      <span class="combine-btn-sub">${c.def.tier} • Consumes: ${c.partnerTowers.map(p => p.name).join(' + ')}</span>
                    </div>
                    <span class="combine-btn-action">Combine ➔</span>
                  </button>
                `;
              } else {
                const nextQ = QUALITIES[c.targetLevel];
                const gemName = BASE_GEMS[c.gemCode]?.name || '';
                const nextName = nextQ ? `${nextQ.namePrefix} ${gemName}` : `Tier ${c.targetLevel}`;
                return `
                  <button type="button" class="game-btn inspector-combine-btn dup-combine-btn" data-comb-idx="${idx}">
                    <div class="combine-btn-info">
                      <span class="combine-btn-title">⬆️ ${c.label}</span>
                      <span class="combine-btn-sub">${nextName} • Consumes ${c.partnerTowers.length} ${gemName}</span>
                    </div>
                    <span class="combine-btn-action">Upgrade ➔</span>
                  </button>
                `;
              }
            }).join('')}
          </div>
        </div>
      `;
    } else if (!canFinalizeRound && this.game.phase === GAME_PHASES.BUILDING) {
      combinationsHtml = `
        <div class="combine-ready-section">
          <div class="combine-ready-header">
            <span class="combine-badge-icon">⏳</span>
            <div class="combine-ready-text">
              <span class="combine-ready-title">Finish this round</span>
              <span class="combine-ready-hint">Place all ${CONFIG.GEMS_PER_ROUND} towers before keeping or combining.</span>
            </div>
          </div>
        </div>
      `;
    }

    let runesHtml = '';
    let relocateHtml = '';

    if (!isTempGem) {
      const runes = t.runes || [];
      const runePills = runes.map((runeKey) => {
        const rDef = RUNE_TYPES[runeKey];
        if (!rDef) return '';
        return `
          <div class="rune-pill" style="border-color: ${rDef.color}; background: ${rDef.color}22;" title="${rDef.name}: ${rDef.description}">
            <span class="rune-pill-icon">${rDef.icon}</span>
            <span class="rune-pill-name" style="color: ${rDef.color}">${rDef.name}</span>
          </div>
        `;
      }).join('');

      const emptySlotsCount = Math.max(0, CONFIG.MAX_TOWER_RUNES - runes.length);
      let emptySlotsHtml = '';
      for (let i = 0; i < emptySlotsCount; i++) {
        emptySlotsHtml += `<div class="rune-pill-empty" title="Empty Rune Slot">+ Slot</div>`;
      }

      runesHtml = `
        <div class="inspector-section runes-section">
          <div class="runes-header">
            <h4>Runes (${runes.length}/${CONFIG.MAX_TOWER_RUNES})</h4>
            ${t.canSocketRune() ? `
              <button type="button" id="btn-inspector-add-rune" class="game-btn rune-add-btn" title="Open Rune Shop">
                + Socket Rune
              </button>
            ` : '<span class="runes-max-badge">MAX</span>'}
          </div>
          <div class="runes-pills-list">
            ${runePills}
            ${emptySlotsHtml}
          </div>
        </div>
      `;

      const canAffordRelocate = this.game.gold >= CONFIG.MOVE_TOWER_COST;
      const isRelocating = this.game.interactionMode && this.game.interactionMode.type === 'MOVE_TOWER' && this.game.interactionMode.sourceTower === t;

      relocateHtml = `
        <div class="inspector-section relocate-section">
          <button type="button" id="btn-inspector-relocate" class="game-btn relocate-btn ${isRelocating ? 'active' : ''}" ${canAffordRelocate ? '' : 'disabled'}>
            ${isRelocating ? '🎯 Destination Mode Active' : `🔀 Relocate Tower (${CONFIG.MOVE_TOWER_COST} Gold)`}
          </button>
          <span class="relocate-hint">Swap with any Rock Slate, or move to empty space.</span>
        </div>
      `;
    }

    const mvpLvl = t.mvpLevel || 0;
    const waveDmg = Math.round(t.waveDamageDealt || 0);
    const selfDmgBonus = Math.round(mvpLvl * CONFIG.MVP_SELF_DAMAGE_PER_LEVEL * 100);
    const magicShred = Math.round(mvpLvl * CONFIG.MVP_MAGIC_SHRED_PER_LEVEL * 100);
    const allyAura = Math.round(mvpLvl * CONFIG.MVP_ALLY_AURA_PER_LEVEL * 100);

    let mvpHtml = '';
    if (!isTempGem) {
      mvpHtml = `
        <div class="inspector-section mvp-section ${mvpLvl > 0 ? 'active' : ''}">
          <div class="mvp-header">
            <span class="mvp-crown-icon">${mvpLvl > 0 ? '👑' : '⭐'}</span>
            <div class="mvp-header-text">
              <span class="mvp-title">MVP Status: <strong>${mvpLvl > 0 ? `Level ${mvpLvl} / ${CONFIG.MVP_MAX_LEVEL}` : 'Unranked'}</strong></span>
              <span class="mvp-sub">Round Dmg: <strong>${waveDmg.toLocaleString()}</strong></span>
            </div>
            ${mvpLvl >= CONFIG.MVP_MAX_LEVEL ? '<span class="mvp-badge max">MAX RANK</span>' : (mvpLvl > 0 ? `<span class="mvp-badge rank">MVP ${mvpLvl}</span>` : '<span class="mvp-badge none">UNRANKED</span>')}
          </div>
          ${mvpLvl > 0 ? `
            <div class="mvp-perks-list">
              <div class="mvp-perk">⚔️ Self Damage Bonus: <strong>+${selfDmgBonus}%</strong></div>
              <div class="mvp-perk">🔮 Enemy Magic Res Shred: <strong>-${magicShred}%</strong> (110px)</div>
              <div class="mvp-perk">✨ Ally Damage Aura: <strong>+${allyAura}%</strong> (2 tiles)</div>
            </div>
          ` : `
            <div class="mvp-hint">Top damage dealer in each wave earns an MVP rank (+10% self damage, -7% magic resistance shred aura, +3% ally aura per rank)!</div>
          `}
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="inspector-header">
        <div class="gem-badge" style="background: ${t.gemColor}; border-color: ${t.accentColor}">
          ${t.isSpecial ? t.name.slice(0, 2) : (t.code && t.level ? `${t.code}${t.level}` : '')}
        </div>
        <div>
          <h3>${t.name}</h3>
          <div>${tierBadge}</div>
        </div>
      </div>

      ${combinationsHtml}
      ${mvpHtml}

      <div class="inspector-stats-grid">
        <div class="stat-card">
          <span class="label">Damage</span>
          <span class="val">${t.getEffectiveDamage()}</span>
        </div>
        <div class="stat-card">
          <span class="label">Attack Speed</span>
          <span class="val">${t.getEffectiveAttackSpeed().toFixed(2)}/s</span>
        </div>
        <div class="stat-card">
          <span class="label">Range</span>
          <span class="val">${t.getEffectiveRange()}</span>
        </div>
        <div class="stat-card">
          <span class="label">DPS</span>
          <span class="val">${Math.round(t.getEffectiveDamage() * t.getEffectiveAttackSpeed())}</span>
        </div>
      </div>

      <div class="inspector-section">
        <h4>Ability / Effect</h4>
        <p class="desc">${t.description || 'Deals standard damage.'}</p>
      </div>

      <div class="inspector-section combat-record">
        <div>Round Damage: <strong>${waveDmg.toLocaleString()}</strong></div>
        <div>Total Damage: <strong>${Math.round(t.totalDamageDealt).toLocaleString()}</strong></div>
        <div>Total Kills: <strong>${t.kills}</strong></div>
      </div>

      ${runesHtml}
      ${relocateHtml}

      ${isUnconfirmedGem ? `
        <div class="actions" style="margin-top: 8px;">
          <button type="button" id="btn-inspector-keep" class="game-btn primary keep-btn" data-idx="${unconfirmedIdx}" style="width: 100%; padding: 8px;">
            ✓ Keep as Active Tower
          </button>
        </div>
      ` : (this.game.phase === GAME_PHASES.BUILDING ? `
        <div class="actions" style="margin-top: 8px;">
          <button type="button" class="game-btn primary" disabled style="width: 100%; padding: 8px;">
            Place all ${CONFIG.GEMS_PER_ROUND} towers to choose a keeper
          </button>
        </div>
      ` : '')}
    `;
  }

  renderCodex() {
    if (!this.codexList) return;
    this.filterCodex();
  }

  filterCodex() {
    const activeFilterBtn = document.querySelector('.codex-filter-btn.active');
    const filter = activeFilterBtn ? activeFilterBtn.dataset.tier : 'All';
    const query = this.codexSearch ? this.codexSearch.value.toLowerCase().trim() : '';

    const builtCodes = {};
    const turnCodes = {};

    if (this.game) {
      // 1. Placed this turn (turn options)
      for (const t of this.game.placedGemsThisTurn) {
        if (t && !t.isSlate) {
          const code = t.isSpecial ? t.specialName : (t.code && t.level ? `${t.code}${t.level}` : '');
          if (code) turnCodes[code] = (turnCodes[code] || 0) + 1;
        }
      }

      // 2. Already built towers on board (excluding current unconfirmed placed gems)
      for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
          const tower = this.game.towerGrid[y][x];
          if (tower && !tower.isSlate && !this.game.placedGemsThisTurn.includes(tower)) {
            const code = tower.isSpecial ? tower.specialName : (tower.code && tower.level ? `${tower.code}${tower.level}` : '');
            if (code) builtCodes[code] = (builtCodes[code] || 0) + 1;
          }
        }
      }
    }

    const filtered = Object.entries(SPECIAL_TOWERS).filter(([name, def]) => {
      if (filter !== 'All' && def.tier !== filter) return false;
      if (query && !name.toLowerCase().includes(query) && !def.description.toLowerCase().includes(query)) return false;
      return true;
    });

    this.codexList.innerHTML = filtered.map(([name, def]) => {
      const poolBuilt = { ...builtCodes };
      const poolTurn = { ...turnCodes };

      const recipeBadges = def.recipe.map(r => {
        if ((poolBuilt[r] || 0) > 0) {
          poolBuilt[r]--;
          return `<span class="recipe-ingredient built" title="Already built on board">✓ ${r} (Built)</span>`;
        } else if ((poolTurn[r] || 0) > 0) {
          poolTurn[r]--;
          return `<span class="recipe-ingredient turn-option" title="Placed in current turn">⭐ ${r} (Turn Option)</span>`;
        } else {
          return `<span class="recipe-ingredient missing" title="Missing ingredient">${r}</span>`;
        }
      }).join(' <span class="recipe-plus">+</span> ');

      // Total needed counts
      const reqCounts = {};
      for (const r of def.recipe) {
        reqCounts[r] = (reqCounts[r] || 0) + 1;
      }
      let canCraft = true;
      for (const [r, needed] of Object.entries(reqCounts)) {
        const total = (builtCodes[r] || 0) + (turnCodes[r] || 0);
        if (total < needed) {
          canCraft = false;
          break;
        }
      }

      return `
        <div class="codex-card ${canCraft ? 'can-craft' : ''}">
          <div class="codex-card-header">
            <div class="gem-badge" style="background: ${def.gemColor}; border-color: ${def.accentColor}">
              ${name.slice(0, 2)}
            </div>
            <div class="codex-title">
              <h4>${name}</h4>
              <span class="badge ${def.tier.toLowerCase()}">${def.tier}</span>
            </div>
            ${canCraft ? `<button type="button" class="game-btn primary codex-craft-btn" data-craft="${name}">Craft Now</button>` : ''}
          </div>
          <div class="codex-recipe-row">
            <strong>Recipe:</strong> ${recipeBadges}
          </div>
          <div class="codex-stats">
            <span>⚔️ Dmg: <strong>${def.damage}</strong></span>
            <span>⚡ Spd: <strong>${def.attackSpeed}/s</strong></span>
            <span>🎯 Rng: <strong>${def.range}</strong></span>
          </div>
          <p class="codex-desc">${def.description}</p>
          <p class="codex-lore"><em>"${def.lore || ''}"</em></p>
        </div>
      `;
    }).join('');
  }

  updateCodexMatches() {
    this.filterCodex();
  }

  openShop(tab = 'all') {
    SOUND.playClick();
    this.activeShopTab = tab;
    this.renderShop(tab);
    if (!this.modalShop.open) {
      this.modalShop.showModal();
    }
  }

  renderShop(tab = this.activeShopTab || 'all') {
    this.activeShopTab = tab;
    if (this.shopGoldVal) {
      this.shopGoldVal.textContent = this.game.gold;
    }

    if (this.shopFilterBtns) {
      this.shopFilterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }

    if (!this.shopItemsList) return;

    let itemsHtml = '';
    const gold = this.game.gold;
    const targetTower = this.game.selectedTower;
    const hasValidTarget = targetTower && !targetTower.isSlate && !this.game.placedGemsThisTurn.includes(targetTower);

    // 1. Relocation Card
    if (tab === 'all' || tab === 'relocate') {
      const canAfford = gold >= CONFIG.MOVE_TOWER_COST;
      let relocateBtnHtml = '';
      if (hasValidTarget) {
        relocateBtnHtml = `
          <button type="button" class="game-btn success shop-buy-btn" data-action="relocate" ${canAfford ? '' : 'disabled'}>
            ${canAfford ? `🛒 Buy Relocation for ${targetTower.name} (${CONFIG.MOVE_TOWER_COST}G)` : `🛒 Buy Relocation (Need ${CONFIG.MOVE_TOWER_COST}G • Have ${gold}G)`}
          </button>
          <button type="button" class="game-btn secondary shop-buy-btn" data-action="relocate" data-mode="pick" ${canAfford ? '' : 'disabled'}>
            🎯 Buy & Pick Other Tower (${CONFIG.MOVE_TOWER_COST}G)
          </button>
        `;
      } else {
        relocateBtnHtml = `
          <button type="button" class="game-btn success shop-buy-btn" data-action="relocate" data-mode="pick" ${canAfford ? '' : 'disabled'}>
            ${canAfford ? `🛒 Buy Relocation (${CONFIG.MOVE_TOWER_COST}G - Pick on Board)` : `🛒 Buy Relocation (Need ${CONFIG.MOVE_TOWER_COST}G • Have ${gold}G)`}
          </button>
        `;
      }

      itemsHtml += `
        <div class="shop-card ${canAfford ? 'featured' : ''}">
          <div class="shop-card-header">
            <div class="shop-card-icon">🔀</div>
            <div class="shop-card-titles">
              <div class="shop-card-title-row">
                <span class="shop-card-name">Tower Relocation</span>
                <span class="shop-card-badge">Tactics</span>
              </div>
              <div class="shop-card-price">🪙 ${CONFIG.MOVE_TOWER_COST} Gold</div>
            </div>
          </div>
          <p class="shop-card-desc">Move an active tower to a new tile. Swap with any Rock Slate (100% pathing safe), or move to empty space (leaves a barrier rock in old spot to keep your maze intact).</p>
          <div class="shop-card-stats">Pathing Protected • Maze Maintained</div>
          <div class="shop-card-actions">
            ${relocateBtnHtml}
          </div>
        </div>
      `;
    }

    // 2. Traps Cards
    if (tab === 'all' || tab === 'traps') {
      for (const [key, def] of Object.entries(TRAP_TYPES)) {
        const canAfford = gold >= def.cost;
        const effectDetail = def.damage ? `${def.damage} ${def.damageType} Dmg` : (def.slowPercent ? `${Math.round(def.slowPercent * 100)}% Slow` : (def.stunDuration ? `${def.stunDuration}s Stun` : `${def.armorReduction} Armor Strip`));
        itemsHtml += `
          <div class="shop-card ${canAfford ? 'featured' : ''}">
            <div class="shop-card-header">
              <div class="shop-card-icon" style="background: ${def.color}22; border-color: ${def.color}55;">${def.icon}</div>
              <div class="shop-card-titles">
                <div class="shop-card-title-row">
                  <span class="shop-card-name">${def.name}</span>
                  <span class="shop-card-badge trap">${def.charges} Charge${def.charges > 1 ? 's' : ''}</span>
                </div>
                <div class="shop-card-price">🪙 ${def.cost} Gold</div>
              </div>
            </div>
            <p class="shop-card-desc">${def.description}</p>
            <div class="shop-card-stats">Radius: ${def.effectRadius}px • ${effectDetail}</div>
            <div class="shop-card-actions">
              <button type="button" class="game-btn success shop-buy-btn" data-action="trap" data-trap-id="${key}" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `🛒 Buy & Deploy Trap (${def.cost}G)` : `🛒 Buy Trap (Need ${def.cost}G • Have ${gold}G)`}
              </button>
            </div>
          </div>
        `;
      }
    }

    // 3. Runes Cards
    if (tab === 'all' || tab === 'runes') {
      // Target tower banner at top of runes
      if (hasValidTarget) {
        const canSlot = targetTower.canSocketRune();
        const runesCount = targetTower.runes ? targetTower.runes.length : 0;
        itemsHtml += `
          <div class="shop-target-banner ${canSlot ? 'ready' : 'full'}">
            <div class="shop-target-left">
              <span class="shop-target-icon">🎯</span>
              <div class="shop-target-text">
                <div class="shop-target-title">Target Tower: <strong>${targetTower.name}</strong></div>
                <div class="shop-target-sub">Socketed Runes: <strong>${runesCount} / ${CONFIG.MAX_TOWER_RUNES}</strong></div>
              </div>
            </div>
            ${canSlot ? '<span class="shop-target-badge ready">Ready to Socket</span>' : '<span class="shop-target-badge full">Slots Full (3/3)</span>'}
          </div>
        `;
      } else if (targetTower && this.game.placedGemsThisTurn.includes(targetTower)) {
        itemsHtml += `
          <div class="shop-target-banner empty">
            <div class="shop-target-left">
              <span class="shop-target-icon">⚠️</span>
              <div class="shop-target-text">
                <div class="shop-target-title">Selected Gem is from Current Turn</div>
                <div class="shop-target-sub">Keep this gem to lock it in, or click any rune below to buy and socket into an existing active tower!</div>
              </div>
            </div>
          </div>
        `;
      } else {
        itemsHtml += `
          <div class="shop-target-banner empty">
            <div class="shop-target-left">
              <span class="shop-target-icon">💡</span>
              <div class="shop-target-text">
                <div class="shop-target-title">Targeting: Board Selection Mode</div>
                <div class="shop-target-sub">Click any rune below to buy and pick a tower on the grid, or select an active tower first to socket directly!</div>
              </div>
            </div>
          </div>
        `;
      }

      for (const [key, def] of Object.entries(RUNE_TYPES)) {
        const canAfford = gold >= def.cost;
        const targetCanSlot = hasValidTarget && targetTower.canSocketRune();

        let actionBtnHtml = '';
        if (hasValidTarget) {
          if (!targetCanSlot) {
            actionBtnHtml = `
              <button type="button" class="game-btn secondary shop-buy-btn" disabled>
                🔒 Tower Slots Full (${CONFIG.MAX_TOWER_RUNES}/${CONFIG.MAX_TOWER_RUNES})
              </button>
              <button type="button" class="game-btn success shop-buy-btn" data-action="rune" data-rune-id="${key}" data-mode="pick" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? `🎯 Buy & Pick Other Tower (${def.cost}G)` : `🛒 Buy Rune (Need ${def.cost}G • Have ${gold}G)`}
              </button>
            `;
          } else if (!canAfford) {
            actionBtnHtml = `
              <button type="button" class="game-btn success shop-buy-btn" disabled>
                🛒 Buy Rune (Need ${def.cost}G • Have ${gold}G)
              </button>
            `;
          } else {
            actionBtnHtml = `
              <button type="button" class="game-btn success shop-buy-btn" data-action="rune" data-rune-id="${key}">
                🛒 Buy & Socket into ${targetTower.name} (${def.cost}G)
              </button>
              <button type="button" class="game-btn secondary shop-buy-btn" data-action="rune" data-rune-id="${key}" data-mode="pick">
                🎯 Buy & Pick on Grid (${def.cost}G)
              </button>
            `;
          }
        } else {
          actionBtnHtml = `
            <button type="button" class="game-btn success shop-buy-btn" data-action="rune" data-rune-id="${key}" data-mode="pick" ${canAfford ? '' : 'disabled'}>
              ${canAfford ? `🛒 Buy & Socket (${def.cost}G - Pick Tower)` : `🛒 Buy Rune (Need ${def.cost}G • Have ${gold}G)`}
            </button>
          `;
        }

        itemsHtml += `
          <div class="shop-card ${canAfford ? 'featured' : ''}">
            <div class="shop-card-header">
              <div class="shop-card-icon" style="background: ${def.color}22; border-color: ${def.color}55;">${def.icon}</div>
              <div class="shop-card-titles">
                <div class="shop-card-title-row">
                  <span class="shop-card-name">${def.name}</span>
                  <span class="shop-card-badge rune">Rune</span>
                </div>
                <div class="shop-card-price">🪙 ${def.cost} Gold</div>
              </div>
            </div>
            <p class="shop-card-desc">${def.description}</p>
            <div class="shop-card-stats">Socket Max: ${CONFIG.MAX_TOWER_RUNES} Runes / Tower</div>
            <div class="shop-card-actions">
              ${actionBtnHtml}
            </div>
          </div>
        `;
      }
    }

    // 4. Castle Repair Card
    if (tab === 'all' || tab === 'castle') {
      const canAfford = gold >= CONFIG.HEAL_CASTLE_COST;
      itemsHtml += `
        <div class="shop-card ${canAfford ? 'featured' : ''}">
          <div class="shop-card-header">
            <div class="shop-card-icon" style="background: rgba(74, 222, 128, 0.2); border-color: rgba(74, 222, 128, 0.5);">🏰</div>
            <div class="shop-card-titles">
              <div class="shop-card-title-row">
                <span class="shop-card-name">Fortify Castle</span>
                <span class="shop-card-badge castle">+${CONFIG.HEAL_CASTLE_AMOUNT} Lives</span>
              </div>
              <div class="shop-card-price">🪙 ${CONFIG.HEAL_CASTLE_COST} Gold</div>
            </div>
          </div>
          <p class="shop-card-desc">Repair and reinforce the Gem Castle to restore +${CONFIG.HEAL_CASTLE_AMOUNT} lives! Current castle lives: <strong>${this.game.lives}</strong>. Crucial for surviving high waves and boss leaks.</p>
          <div class="shop-card-stats">Instant Castle Health Recovery</div>
          <div class="shop-card-actions">
            <button type="button" class="game-btn success shop-buy-btn" data-action="heal" ${canAfford ? '' : 'disabled'}>
              ${canAfford ? `🛒 Buy Castle Repair (+${CONFIG.HEAL_CASTLE_AMOUNT} Lives - ${CONFIG.HEAL_CASTLE_COST}G)` : `🛒 Buy Castle Repair (Need ${CONFIG.HEAL_CASTLE_COST}G • Have ${gold}G)`}
            </button>
          </div>
        </div>
      `;
    }

    this.shopItemsList.innerHTML = itemsHtml;
  }
}
