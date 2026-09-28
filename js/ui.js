// Gem TD - User Interface Controller
import { CONFIG, QUALITIES, BASE_GEMS } from './config.js';
import { SPECIAL_TOWERS } from './recipes.js';
import { GAME_PHASES } from './game.js';
import { SOUND } from './audio.js';

export class UIController {
  constructor(game, renderer) {
    this.game = game;
    this.renderer = renderer;

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
    this.elCodexBtn = document.getElementById('btn-codex');
    this.elHelpBtn = document.getElementById('btn-help');
    this.elRestartBtn = document.getElementById('btn-restart');

    this.elBottomDock = document.getElementById('bottom-dock');
    this.elInspector = document.getElementById('inspector-panel');

    // Modals
    this.modalCodex = document.getElementById('modal-codex');
    this.modalHelp = document.getElementById('modal-help');
    this.modalGameOver = document.getElementById('modal-gameover');
    this.modalVictory = document.getElementById('modal-victory');

    this.codexList = document.getElementById('codex-list');
    this.codexFilterBtns = document.querySelectorAll('.codex-filter-btn');
    this.codexSearch = document.getElementById('codex-search');
  }

  bindEvents() {
    // Canvas click & mousemove
    const canvas = this.renderer.canvas;
    canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
    canvas.addEventListener('mouseleave', () => { this.game.hoverTile = null; });
    canvas.addEventListener('click', (e) => this.onCanvasClick(e));

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
    [this.modalCodex, this.modalHelp, this.modalGameOver, this.modalVictory].forEach(dialog => {
      if (dialog) {
        dialog.addEventListener('click', (e) => {
          const rect = dialog.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          ) {
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
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === '1') {
        this.setSpeed(1);
      } else if (e.key === '2') {
        this.setSpeed(2);
      } else if (e.key === '3') {
        this.setSpeed(4);
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

  onCanvasMouseMove(e) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const scaleX = this.renderer.canvas.width / rect.width;
    const scaleY = this.renderer.canvas.height / rect.height;

    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const tx = Math.floor(mx / this.renderer.tileSize);
    const ty = Math.floor(my / this.renderer.tileSize);

    if (tx >= 0 && tx < CONFIG.GRID_WIDTH && ty >= 0 && ty < CONFIG.GRID_HEIGHT) {
      this.game.hoverTile = { x: tx, y: ty };
    } else {
      this.game.hoverTile = null;
    }
  }

  onCanvasClick(e) {
    SOUND.ensureContext();
    if (!this.game.hoverTile) return;

    const { x, y } = this.game.hoverTile;
    const clickedTower = this.game.towerGrid[y][x];

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

    this.updateInspector();
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
    this.updateBottomDock();
    this.updateInspector();
  }

  updateHUD() {
    this.elWave.textContent = `Wave ${this.game.currentWave} / 50`;
    const waveData = this.game.getWaveData();
    const traitText = waveData.trait ? ` [${waveData.trait}]` : '';
    this.elWaveName.textContent = `${waveData.name}${traitText} • ${waveData.count} creeps`;

    this.elLives.textContent = this.game.lives;
    this.elGold.textContent = this.game.gold;
    this.elScore.textContent = this.game.score;

    // Phase Banner
    if (this.game.phase === GAME_PHASES.BUILDING) {
      const placed = this.game.placedGemsThisTurn.length;
      this.elPhaseBanner.innerHTML = `<span class="badge build">BUILDING</span> Place 5 Gems on the Maze (<strong>${placed} / 5</strong> placed)`;
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      this.elPhaseBanner.innerHTML = `<span class="badge choose">CHOOSING</span> Select 1 Gem to keep as an active tower! The other 4 become Rocks.`;
    } else if (this.game.phase === GAME_PHASES.WAVE) {
      const remaining = this.game.creeps.length;
      this.elPhaseBanner.innerHTML = `<span class="badge wave">COMBAT</span> Wave in progress! (${remaining} enemies remaining)`;
    }
  }

  updateBottomDock() {
    const dock = this.elBottomDock;
    if (!dock) return;

    if (this.game.phase === GAME_PHASES.BUILDING) {
      const placed = this.game.placedGemsThisTurn.length;
      const nextChance = CONFIG.CHANCE_UPGRADES[this.game.chanceLevel];
      const maxChance = this.game.chanceLevel >= CONFIG.CHANCE_UPGRADES.length;

      dock.innerHTML = `
        <div class="dock-row">
          <div class="dock-info">
            <span class="dock-title">Gems Placed This Round: ${placed} / 5</span>
            <span class="dock-desc">Click empty tiles to place gems and build your maze!</span>
          </div>
          <div class="dock-actions">
            <button id="btn-upgrade-chance" class="game-btn primary" ${maxChance || this.game.gold < (nextChance ? nextChance.cost : 999) ? 'disabled' : ''}>
              ⭐ Upgrade Chances (${maxChance ? 'MAX' : `${nextChance.cost} Gold`})
            </button>
          </div>
        </div>
      `;

      const btnUp = document.getElementById('btn-upgrade-chance');
      if (btnUp) {
        btnUp.onclick = () => {
          this.game.upgradeChance();
        };
      }
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      const matchingRecipes = this.game.getAvailableRecipes();
      const duplicateCombines = this.game.getAvailableDuplicateUpgrades();

      let combineButtonsHtml = '';
      if (matchingRecipes.length > 0) {
        combineButtonsHtml += `
          <div class="combine-box">
            <span class="combine-title">✨ Special Tower Available!</span>
            <div class="combine-list">
              ${matchingRecipes.map(m => `
                <button class="game-btn special-craft-btn" data-recipe="${m.name}">
                  Combine ${m.name} (${m.def.tier})
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (duplicateCombines.length > 0) {
        combineButtonsHtml += `
          <div class="combine-box duplicate">
            <span class="combine-title">⭐ Duplicate Upgrade!</span>
            <div class="combine-list">
              ${duplicateCombines.map((u, i) => `
                <button class="game-btn dup-craft-btn" data-dup-idx="${i}">
                  ${u.label}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      const gemCardsHtml = this.game.placedGemsThisTurn.map((gem, idx) => {
        const q = QUALITIES[gem.level] || {};
        return `
          <div class="gem-card ${this.game.selectedTower === gem ? 'selected' : ''}" data-idx="${idx}">
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
            <button class="game-btn keep-btn" data-idx="${idx}">Keep as Tower</button>
          </div>
        `;
      }).join('');

      dock.innerHTML = `
        <div class="choosing-dock">
          ${combineButtonsHtml}
          <div class="gem-cards-container">
            ${gemCardsHtml}
          </div>
          <div class="dock-actions bottom-bar">
            <button id="btn-reroll" class="game-btn secondary" ${this.game.gold < CONFIG.REROLL_COST ? 'disabled' : ''}>
              🎲 Reroll Gems (${CONFIG.REROLL_COST} Gold)
            </button>
          </div>
        </div>
      `;

      // Event handlers for gem cards
      dock.querySelectorAll('.keep-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          const chosen = this.game.placedGemsThisTurn[idx];
          if (chosen) {
            this.game.keepGem(chosen);
          }
        };
      });

      dock.querySelectorAll('.gem-card').forEach(card => {
        card.onclick = () => {
          const idx = parseInt(card.dataset.idx);
          this.game.selectedTower = this.game.placedGemsThisTurn[idx];
        };
      });

      dock.querySelectorAll('.special-craft-btn').forEach(btn => {
        btn.onclick = () => {
          const recipeName = btn.dataset.recipe;
          this.game.craftSpecialTower(recipeName);
        };
      });

      dock.querySelectorAll('.dup-craft-btn').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.dupIdx);
          const up = duplicateCombines[idx];
          if (up) {
            this.game.applyDuplicateUpgrade(up);
          }
        };
      });

      const btnReroll = document.getElementById('btn-reroll');
      if (btnReroll) {
        btnReroll.onclick = () => {
          this.game.rerollPlacedGems();
        };
      }
    } else if (this.game.phase === GAME_PHASES.WAVE) {
      dock.innerHTML = `
        <div class="dock-row wave-status">
          <div class="dock-info">
            <span class="dock-title">Wave in Progress...</span>
            <span class="dock-desc">Towers are defending the castle against the invaders!</span>
          </div>
        </div>
      `;
    }
  }

  updateInspector() {
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
          <button id="btn-demolish-slate" class="game-btn danger" ${this.game.gold < CONFIG.SLATE_REMOVE_COST ? 'disabled' : ''}>
            Demolish (${CONFIG.SLATE_REMOVE_COST} Gold)
          </button>
        </div>
      `;
      const btnDemo = document.getElementById('btn-demolish-slate');
      if (btnDemo) {
        btnDemo.onclick = () => {
          this.game.removeSlate(t.tileX, t.tileY);
        };
      }
      return;
    }

    // Active Gem or Special Tower
    const q = QUALITIES[t.level];
    const tierBadge = t.isSpecial ? `<span class="badge special">${t.tier}</span>` : `<span class="badge tier" style="background: ${q ? q.border : '#334155'}">${q ? q.namePrefix : ''}</span>`;

    panel.innerHTML = `
      <div class="inspector-header">
        <div class="gem-badge" style="background: ${t.gemColor}; border-color: ${t.accentColor}">
          ${t.isSpecial ? t.name.slice(0, 2) : `${t.code}${t.level}`}
        </div>
        <div>
          <h3>${t.name}</h3>
          <div>${tierBadge}</div>
        </div>
      </div>

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
        <div>Total Damage: <strong>${Math.round(t.totalDamageDealt).toLocaleString()}</strong></div>
        <div>Total Kills: <strong>${t.kills}</strong></div>
      </div>
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

    const allGems = this.game ? this.game.getAllGems() : [];
    const ownedCodes = {};
    for (const g of allGems) {
      const code = g.isSpecial ? g.specialName : `${g.code}${g.level}`;
      ownedCodes[code] = (ownedCodes[code] || 0) + 1;
    }

    const filtered = Object.entries(SPECIAL_TOWERS).filter(([name, def]) => {
      if (filter !== 'All' && def.tier !== filter) return false;
      if (query && !name.toLowerCase().includes(query) && !def.description.toLowerCase().includes(query)) return false;
      return true;
    });

    this.codexList.innerHTML = filtered.map(([name, def]) => {
      // Check recipe satisfaction
      const reqCounts = {};
      for (const r of def.recipe) {
        reqCounts[r] = (reqCounts[r] || 0) + 1;
      }
      let canCraft = true;
      for (const [r, needed] of Object.entries(reqCounts)) {
        if ((ownedCodes[r] || 0) < needed) {
          canCraft = false;
          break;
        }
      }

      const recipeBadges = def.recipe.map(r => {
        const has = (ownedCodes[r] || 0) > 0;
        return `<span class="recipe-ingredient ${has ? 'has' : ''}">${r}</span>`;
      }).join(' + ');

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
            ${canCraft ? `<button class="game-btn primary codex-craft-btn" data-craft="${name}">Craft Now</button>` : ''}
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

    this.codexList.querySelectorAll('.codex-craft-btn').forEach(btn => {
      btn.onclick = () => {
        const recipeName = btn.dataset.craft;
        if (this.game.craftSpecialTower(recipeName)) {
          this.modalCodex.close();
        }
      };
    });
  }

  updateCodexMatches() {
    this.filterCodex();
  }
}
