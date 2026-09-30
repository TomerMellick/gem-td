import { CONFIG } from './config.js';
import { GAME_PHASES } from './game.js';
import { SOUND } from './audio.js';

export class GamepadController {
  constructor(game, ui, renderer) {
    this.game = game;
    this.ui = ui;
    this.renderer = renderer;

    // Grid cursor position (starts in center of 33x33 grid)
    this.cursorX = 16;
    this.cursorY = 16;

    // Flag indicating controller is actively used
    this.isActive = false;

    // Choosing phase selected card index (0 to 4)
    this.chooseCardIndex = 0;

    // Stick repeat timing for responsive, smooth grid navigation
    this.moveRepeatDelay = 220;    // ms initial delay before repeat
    this.moveRepeatInterval = 70;  // ms interval while holding stick/Dpad
    this.lastMoveTime = 0;
    this.lastStepTime = 0;
    this.lastDirection = { dx: 0, dy: 0 };
    this.isHoldingMove = false;

    // Previous frame button states for edge detection (press vs hold)
    this.prevButtons = [];

    // Controller button prompt ribbon element
    this.promptEl = null;

    this.bindEvents();
    this.createPromptBar();
  }

  bindEvents() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('🎮 Gamepad connected:', e.gamepad.id);
      this.isActive = true;
      this.syncHoverTile();
      this.updatePromptBar();
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('🎮 Gamepad disconnected:', e.gamepad.id);
    });

    // Keyboard & D-Pad KeyEvent fallback (Android gamepads often emit standard KeyEvents)
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

      const code = e.keyCode;
      const key = e.key;

      let dx = 0, dy = 0;

      // D-Pad and directional inputs
      if (code === 19 || key === 'ArrowUp' || key === 'w' || key === 'W') {
        dy = -1;
      } else if (code === 20 || key === 'ArrowDown' || key === 's' || key === 'S') {
        dy = 1;
      } else if (code === 21 || key === 'ArrowLeft' || key === 'a' || key === 'A') {
        dx = -1;
      } else if (code === 22 || key === 'ArrowRight' || key === 'd' || key === 'D') {
        dx = 1;
      } else if (code === 96 || code === 23 || code === 66 || key === 'Enter' || key === ' ' || key === 'GamepadA') {
        this.handleButtonA();
        e.preventDefault();
        return;
      } else if (code === 97 || code === 4 || code === 27 || key === 'Escape' || key === 'Backspace' || key === 'GamepadB') {
        this.handleButtonB();
        e.preventDefault();
        return;
      } else if (code === 99 || key === 'x' || key === 'X' || key === 'GamepadX') {
        this.handleButtonX();
        e.preventDefault();
        return;
      } else if (code === 100 || key === 'y' || key === 'Y' || key === 'GamepadY') {
        this.handleButtonY();
        e.preventDefault();
        return;
      } else if (code === 102 || key === 'q' || key === 'Q' || key === 'PageUp') {
        this.handleBumperLeft();
        e.preventDefault();
        return;
      } else if (code === 103 || key === 'e' || key === 'E' || key === 'PageDown') {
        this.handleBumperRight();
        e.preventDefault();
        return;
      } else if (code === 109 || key === 'b' || key === 'B') {
        this.toggleShop();
        e.preventDefault();
        return;
      } else if (code === 108 || code === 82 || key === 'c' || key === 'C') {
        this.toggleCodex();
        e.preventDefault();
        return;
      }

      if (dx !== 0 || dy !== 0) {
        if (document.activeElement && document.activeElement !== document.body && document.activeElement.tagName !== 'INPUT') {
          document.activeElement.blur();
        }
        this.isActive = true;
        this.moveCursor(dx, dy);
        this.updatePromptBar();
        e.preventDefault();
      }
    });
  }

  createPromptBar() {
    let bar = document.getElementById('gamepad-prompt-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'gamepad-prompt-bar';
      bar.className = 'gamepad-prompt-bar hidden';
      const container = document.getElementById('canvas-container') || document.body;
      container.appendChild(bar);
    }
    this.promptEl = bar;
  }

  updatePromptBar() {
    if (!this.promptEl) return;
    if (!this.isActive) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.classList.remove('hidden');

    if (this.game.phase === GAME_PHASES.BUILDING) {
      this.promptEl.innerHTML = `
        <span class="gp-item"><span class="gp-badge">🕹️ D-Pad</span> Move</span>
        <span class="gp-item"><span class="gp-btn a">A</span> Place Gem</span>
        <span class="gp-item"><span class="gp-btn y">Y</span> Upgrade Chances</span>
        <span class="gp-item"><span class="gp-btn shoulder">L1/R1</span> Speed</span>
        <span class="gp-item"><span class="gp-btn menu">Select</span> Shop</span>
      `;
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      this.promptEl.innerHTML = `
        <span class="gp-item"><span class="gp-badge">🕹️ ◄ ►</span> Pick Gem</span>
        <span class="gp-item"><span class="gp-btn a">A</span> Keep Tower</span>
        <span class="gp-item"><span class="gp-btn x">X</span> Combine Special</span>
        <span class="gp-item"><span class="gp-btn y">Y</span> Reroll</span>
        <span class="gp-item"><span class="gp-btn b">B</span> Inspect</span>
      `;
    } else {
      this.promptEl.innerHTML = `
        <span class="gp-item"><span class="gp-badge">🕹️ D-Pad</span> Target</span>
        <span class="gp-item"><span class="gp-btn a">A</span> Inspect Tower</span>
        <span class="gp-item"><span class="gp-btn x">X</span> Demolish/Combine</span>
        <span class="gp-item"><span class="gp-btn y">Y</span> AI Toggle</span>
        <span class="gp-item"><span class="gp-btn shoulder">L1/R1</span> Speed</span>
      `;
    }
  }

  syncHoverTile() {
    this.game.hoverTile = { x: this.cursorX, y: this.cursorY };
    const hoveredTower = this.game.towerGrid[this.cursorY][this.cursorX];
    if (hoveredTower && !this.game.selectedTower) {
      this.renderer.tempHoverRange = hoveredTower;
    } else {
      this.renderer.tempHoverRange = null;
    }
  }

  moveCursor(dx, dy) {
    if (this.game.phase === GAME_PHASES.CHOOSING) {
      // In choosing phase, left/right cycles through the 5 gems
      if (dx !== 0 && this.game.placedGemsThisTurn.length > 0) {
        this.chooseCardIndex = (this.chooseCardIndex + dx + this.game.placedGemsThisTurn.length) % this.game.placedGemsThisTurn.length;
        const chosen = this.game.placedGemsThisTurn[this.chooseCardIndex];
        if (chosen) {
          this.cursorX = chosen.tileX;
          this.cursorY = chosen.tileY;
          this.game.selectedTower = chosen;
          this.syncHoverTile();
          this.ui.invalidateUI();
          SOUND.playClick();
        }
        return;
      }
    }

    // Normal grid navigation
    const nx = Math.max(0, Math.min(CONFIG.GRID_WIDTH - 1, this.cursorX + dx));
    const ny = Math.max(0, Math.min(CONFIG.GRID_HEIGHT - 1, this.cursorY + dy));
    if (nx !== this.cursorX || ny !== this.cursorY) {
      this.cursorX = nx;
      this.cursorY = ny;
      this.syncHoverTile();
      SOUND.playClick();
    }
  }

  isButtonPressed(gp, index) {
    if (!gp || !gp.buttons || !gp.buttons[index]) return false;
    const b = gp.buttons[index];
    return typeof b === 'object' ? b.pressed : b === 1.0;
  }

  isButtonJustPressed(gp, index) {
    const isPressed = this.isButtonPressed(gp, index);
    const wasPressed = !!this.prevButtons[index];
    return isPressed && !wasPressed;
  }

  update(now) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i] && gamepads[i].connected) {
        gp = gamepads[i];
        break;
      }
    }

    if (!gp) return;

    if (!this.isActive) {
      this.isActive = true;
      this.syncHoverTile();
      this.updatePromptBar();
    }

    // 1. Read Left Stick & D-Pad axes
    let dx = 0;
    let dy = 0;
    const deadzone = 0.32;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;

    if (ax < -deadzone) dx = -1;
    else if (ax > deadzone) dx = 1;

    if (ay < -deadzone) dy = -1;
    else if (ay > deadzone) dy = 1;

    // Standard D-Pad buttons: 12=Up, 13=Down, 14=Left, 15=Right
    if (this.isButtonPressed(gp, 12)) dy = -1;
    if (this.isButtonPressed(gp, 13)) dy = 1;
    if (this.isButtonPressed(gp, 14)) dx = -1;
    if (this.isButtonPressed(gp, 15)) dx = 1;

    // Smooth hold-to-repeat motion
    if (dx !== 0 || dy !== 0) {
      if (!this.isHoldingMove || dx !== this.lastDirection.dx || dy !== this.lastDirection.dy) {
        this.moveCursor(dx, dy);
        this.lastDirection = { dx, dy };
        this.lastMoveTime = now;
        this.lastStepTime = now;
        this.isHoldingMove = true;
      } else {
        const timeHeld = now - this.lastMoveTime;
        if (timeHeld >= this.moveRepeatDelay) {
          const stepTime = now - this.lastStepTime;
          if (stepTime >= this.moveRepeatInterval) {
            this.moveCursor(dx, dy);
            this.lastStepTime = now;
          }
        }
      }
    } else {
      this.isHoldingMove = false;
    }

    // 2. Button A: Place / Confirm / Keep
    if (this.isButtonJustPressed(gp, 0)) {
      this.handleButtonA();
    }

    // 3. Button B: Cancel / Deselect / Close Modal
    if (this.isButtonJustPressed(gp, 1)) {
      this.handleButtonB();
    }

    // 4. Button X: Special Combine / Demolish
    if (this.isButtonJustPressed(gp, 2)) {
      this.handleButtonX();
    }

    // 5. Button Y: Upgrade Chances / Reroll / AI Toggle
    if (this.isButtonJustPressed(gp, 3)) {
      this.handleButtonY();
    }

    // 6. L1: Speed Down / Previous Card
    if (this.isButtonJustPressed(gp, 4)) {
      this.handleBumperLeft();
    }

    // 7. R1: Speed Up / Next Card
    if (this.isButtonJustPressed(gp, 5)) {
      this.handleBumperRight();
    }

    // 8. Select / Back (Button 8): Shop Modal
    if (this.isButtonJustPressed(gp, 8)) {
      this.toggleShop();
    }

    // 9. Start / Menu (Button 9): Recipes Codex
    if (this.isButtonJustPressed(gp, 9)) {
      this.toggleCodex();
    }

    // Store button states for edge trigger detection
    this.prevButtons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
  }

  handleButtonA() {
    SOUND.ensureContext();

    // Check open dialogs first
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      const activeBtn = openDialog.querySelector('.shop-buy-btn:not(:disabled), .codex-craft-btn:not(:disabled)');
      if (activeBtn) activeBtn.click();
      return;
    }

    if (this.game.phase === GAME_PHASES.BUILDING) {
      // Place gem at controller cursor tile!
      const placed = this.game.placeGemAt(this.cursorX, this.cursorY);
      if (placed) {
        this.syncHoverTile();
        this.ui.invalidateUI();
        this.updatePromptBar();
      }
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      // Keep selected gem as active tower
      let chosen = this.game.selectedTower;
      if (!chosen || !this.game.placedGemsThisTurn.includes(chosen)) {
        chosen = this.game.placedGemsThisTurn[this.chooseCardIndex] || this.game.placedGemsThisTurn[0];
      }
      if (chosen) {
        this.game.keepGem(chosen);
        this.ui.invalidateUI();
        this.updatePromptBar();
      }
    } else {
      // In combat or idle: select tower under cursor
      const t = this.game.towerGrid[this.cursorY][this.cursorX];
      if (t) {
        this.game.selectedTower = t;
        SOUND.playClick();
      } else {
        this.game.selectedTower = null;
      }
      this.ui.invalidateUI();
    }
  }

  handleButtonB() {
    // 1. Close open modals
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      openDialog.close();
      SOUND.playClick();
      return;
    }

    // 2. Cancel interaction mode
    if (this.game.interactionMode) {
      this.game.interactionMode = null;
      this.ui.invalidateUI();
      SOUND.playClick();
      return;
    }

    // 3. Deselect tower
    if (this.game.selectedTower) {
      this.game.selectedTower = null;
      this.ui.invalidateUI();
      SOUND.playClick();
      return;
    }

    // 4. Toggle Pause
    const newSpeed = this.game.gameSpeed > 0 ? 0 : (this.game.previousSpeed || 1);
    this.ui.setSpeed(newSpeed);
  }

  handleButtonX() {
    SOUND.ensureContext();

    if (this.game.phase === GAME_PHASES.CHOOSING) {
      // 1. Special Recipe Combine
      const recipes = this.game.getAvailableRecipes();
      if (recipes.length > 0) {
        this.game.craftSpecialTower(recipes[0].name);
        this.ui.invalidateUI();
        this.updatePromptBar();
        return;
      }

      // 2. Duplicate Combine
      const dups = this.game.getAvailableDuplicateUpgrades();
      if (dups.length > 0) {
        this.game.applyDuplicateUpgrade(dups[0]);
        this.ui.invalidateUI();
        this.updatePromptBar();
        return;
      }
    } else {
      // If hovering or selected slate: Demolish
      const t = this.game.selectedTower || this.game.towerGrid[this.cursorY][this.cursorX];
      if (t && t.isSlate) {
        if (this.game.gold >= CONFIG.SLATE_REMOVE_COST) {
          this.game.removeSlate(t.tileX, t.tileY);
          this.game.selectedTower = null;
          this.ui.invalidateUI();
        } else {
          SOUND.playError();
        }
      }
    }
  }

  handleButtonY() {
    SOUND.ensureContext();

    if (this.game.phase === GAME_PHASES.BUILDING) {
      // Upgrade chances
      this.game.upgradeChance();
      this.ui.invalidateUI();
    } else if (this.game.phase === GAME_PHASES.CHOOSING) {
      // Reroll gems
      if (this.game.gold >= CONFIG.REROLL_COST) {
        this.game.rerollPlacedGems();
        this.ui.invalidateUI();
      } else {
        SOUND.playError();
      }
    } else {
      // Toggle AI player
      if (window.ai) {
        window.ai.toggle();
        this.ui.invalidateUI();
      }
    }
  }

  handleBumperLeft() {
    if (this.game.phase === GAME_PHASES.CHOOSING) {
      this.moveCursor(-1, 0);
    } else {
      this.cycleSpeed(-1);
    }
  }

  handleBumperRight() {
    if (this.game.phase === GAME_PHASES.CHOOSING) {
      this.moveCursor(1, 0);
    } else {
      this.cycleSpeed(1);
    }
  }

  cycleSpeed(dir) {
    const speeds = [1, 2, 4, 0];
    let curIdx = speeds.indexOf(this.game.gameSpeed);
    if (curIdx === -1) curIdx = 0;
    const nextIdx = (curIdx + dir + speeds.length) % speeds.length;
    this.ui.setSpeed(speeds[nextIdx]);
    SOUND.playClick();
  }

  toggleShop() {
    SOUND.playClick();
    if (this.ui.modalShop) {
      if (this.ui.modalShop.open) {
        this.ui.modalShop.close();
      } else {
        this.ui.openShop();
      }
    }
  }

  toggleCodex() {
    SOUND.playClick();
    if (this.ui.modalCodex) {
      if (this.ui.modalCodex.open) {
        this.ui.modalCodex.close();
      } else {
        this.ui.updateCodexMatches();
        this.ui.modalCodex.showModal();
      }
    }
  }
}
