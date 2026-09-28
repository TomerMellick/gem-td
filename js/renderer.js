// Gem TD - Canvas 2D Game Renderer (Enhanced Visual Effects)
import { CONFIG, QUALITIES, TRAP_TYPES, RUNE_TYPES } from './config.js';
import { TILE_TYPES } from './pathfinding.js';

// Damage type visual definitions for consistent theming
const DAMAGE_TYPE_VISUALS = {
  physical: { color: '#f87171', icon: '⚔', trailColor: '#fca5a5', impactColor: '#dc2626' },
  magic:    { color: '#a855f7', icon: '✦', trailColor: '#c084fc', impactColor: '#7c3aed' },
  lightning:{ color: '#22d3ee', icon: '⚡', trailColor: '#67e8f9', impactColor: '#06b6d4' },
  poison:   { color: '#4ade80', icon: '☠', trailColor: '#86efac', impactColor: '#16a34a' },
  fire:     { color: '#f97316', icon: '🔥', trailColor: '#fdba74', impactColor: '#ea580c' },
  ice:      { color: '#38bdf8', icon: '❄', trailColor: '#7dd3fc', impactColor: '#0284c7' },
  crit:     { color: '#fbbf24', icon: '💥', trailColor: '#fde047', impactColor: '#f59e0b' },
};

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = CONFIG.DEFAULT_TILE_SIZE;
    this.width = canvas.width;
    this.height = canvas.height;
    this.time = 0;

    // View options
    this.showPath = true;
    this.showRanges = true;
    this.showGrid = true;

    // Screen shake state
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.tileSize = width / CONFIG.GRID_WIDTH;
  }

  triggerScreenShake(intensity = 4, duration = 0.15) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = 0;
  }

  render(game, dt) {
    this.time += dt;
    const ctx = this.ctx;

    // Update screen shake
    if (this.shakeDuration > 0) {
      this.shakeTimer += dt;
      if (this.shakeTimer >= this.shakeDuration) {
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      } else {
        const decay = 1 - (this.shakeTimer / this.shakeDuration);
        const intensity = this.shakeIntensity * decay;
        this.shakeOffsetX = (Math.random() - 0.5) * 2 * intensity;
        this.shakeOffsetY = (Math.random() - 0.5) * 2 * intensity;
      }
    }

    // Clear canvas with dark fantasy stone background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

    // Apply screen shake transform
    ctx.save();
    if (this.shakeOffsetX || this.shakeOffsetY) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }

    // Subtle background pattern
    this.drawBackgroundGrid(ctx);

    // Draw waypoints / checkpoints
    this.drawCheckpoints(ctx);

    // Draw full creep path preview
    if (this.showPath && game.fullCreepPath && game.fullCreepPath.length > 1) {
      this.drawPathPreview(ctx, game.fullCreepPath);
    }

    // Draw traps on floor
    this.drawTraps(ctx, game.traps);

    // Draw all placed towers & slates
    this.drawTowersAndSlates(ctx, game);

    // Draw interaction mode overlay or normal hover tile
    if (game.interactionMode) {
      this.drawInteractionMode(ctx, game);
    } else if (game.hoverTile) {
      this.drawHoverTile(ctx, game);
    }

    // Draw selection & aura range
    if (game.selectedTower) {
      this.drawTowerRange(ctx, game.selectedTower);
    }

    // Draw creeps
    this.drawCreeps(ctx, game.creeps);

    // Draw projectiles with damage-type visuals
    this.drawProjectiles(ctx, game.projectiles);

    // Draw lightning arcs
    this.drawLightningArcs(ctx, game.lightningArcs);

    // Draw impact rings
    this.drawImpactRings(ctx, game.impactRings || []);

    // Draw particles
    this.drawParticles(ctx, game.particles);

    // Draw floating text with damage type styling
    this.drawFloatingText(ctx, game.floatingTexts);

    // Restore from screen shake
    ctx.restore();
  }

  drawBackgroundGrid(ctx) {
    const ts = this.tileSize;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1;

    if (this.showGrid) {
      ctx.beginPath();
      for (let x = 0; x <= CONFIG.GRID_WIDTH; x++) {
        ctx.moveTo(x * ts, 0);
        ctx.lineTo(x * ts, CONFIG.GRID_HEIGHT * ts);
      }
      for (let y = 0; y <= CONFIG.GRID_HEIGHT; y++) {
        ctx.moveTo(0, y * ts);
        ctx.lineTo(CONFIG.GRID_WIDTH * ts, y * ts);
      }
      ctx.stroke();
    }
  }

  drawCheckpoints(ctx) {
    const ts = this.tileSize;
    const pulse = Math.sin(this.time * 4) * 0.2 + 0.8;

    for (const cp of CONFIG.CHECKPOINTS) {
      const cx = cp.x * ts + ts / 2;
      const cy = cp.y * ts + ts / 2;

      // Cached glow halo gradient
      if (!this._cpGradients) this._cpGradients = new Map();
      let grad = this._cpGradients.get(cp.id);
      if (!grad) {
        grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, ts * 1.6);
        grad.addColorStop(0, cp.color + 'aa');
        grad.addColorStop(0.7, cp.color + '22');
        grad.addColorStop(1, 'transparent');
        this._cpGradients.set(cp.id, grad);
      }
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Portal Ring
      ctx.strokeStyle = cp.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.65 * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Icon or Castle
      if (cp.id === 4) {
        // Gem Castle
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(cx - 7, cy - 7, 14, 14);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + 9, cy - 5);
        ctx.lineTo(cx - 9, cy - 5);
        ctx.closePath();
        ctx.fill();
      } else {
        // Waypoint portal core
        ctx.fillStyle = cp.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Checkpoint Label
      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = cp.id === 0 ? 'START' : cp.id === 4 ? 'CASTLE' : `WP ${cp.id}`;
      ctx.fillText(label, cx, cy + ts * 0.95);
      ctx.restore();
    }
  }

  drawPathPreview(ctx, path) {
    const ts = this.tileSize;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -this.time * 20;

    ctx.beginPath();
    ctx.moveTo(path[0].x * ts + ts / 2, path[0].y * ts + ts / 2);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * ts + ts / 2, path[i].y * ts + ts / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawTowersAndSlates(ctx, game) {
    const ts = this.tileSize;
    const combinableSet = game.getCombinableTowers();

    // 1. If a combinable tower is currently selected, draw tether lines to its partners
    if (game.selectedTower && combinableSet.has(game.selectedTower)) {
      const combos = game.getCombinationsForTower(game.selectedTower);
      const partnerSet = new Set();
      for (const c of combos) {
        if (c.partnerTowers) {
          for (const p of c.partnerTowers) partnerSet.add(p);
        }
      }

      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.time * 25;

      for (const p of partnerSet) {
        ctx.beginPath();
        ctx.moveTo(game.selectedTower.pixelX, game.selectedTower.pixelY);
        ctx.lineTo(p.pixelX, p.pixelY);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Draw towers and slates using cached entities list
    const entities = game.getAllEntities();
    for (let i = 0; i < entities.length; i++) {
      const tower = entities[i];
      const px = tower.tileX * ts;
      const py = tower.tileY * ts;
      const cx = px + ts / 2;
      const cy = py + ts / 2;

      if (tower.isSlate) {
        this.drawSlate(ctx, px, py, ts);
      } else {
        const isTemp = game.placedGemsThisTurn.includes(tower);
        const isCombinable = combinableSet.has(tower);
        this.drawGemTower(ctx, tower, cx, cy, ts, isTemp, isCombinable);
      }
    }
  }

  drawSlate(ctx, px, py, ts) {
    ctx.save();
    // Granite rock wall with 3D beveling
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);

    // Bevel highlights
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 2, py + 2, ts - 4, 3);
    ctx.fillRect(px + 2, py + 2, 3, ts - 4);

    // Bevel shadow
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + 2, py + ts - 5, ts - 4, 3);
    ctx.fillRect(px + ts - 5, py + 2, 3, ts - 4);

    // Center rune carving
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 5, py + 5, ts - 10, ts - 10);
    ctx.restore();
  }

  drawGemTower(ctx, tower, cx, cy, ts, isTemp, isCombinable) {
    ctx.save();

    const rad = (ts / 2) * 0.78;

    // Pulsing selection ring for newly placed unconfirmed gems
    if (isTemp) {
      const pulse = Math.sin(this.time * 6) * 3;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 4 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Animated combine marker when all recipe/duplicate ingredients are ready on board
    if (isCombinable) {
      const pulse = Math.sin(this.time * 5) * 2;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -this.time * 15;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 5 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Sparkle indicator icon
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✨', cx + rad * 0.7, cy - rad * 0.7);
      ctx.restore();
    }

    // Glow aura for higher quality / special towers
    if (tower.glowColor) {
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad * 1.8);
      grad.addColorStop(0, tower.glowColor + '99');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Quality Tier Ring (Chipped, Flawed, Regular, Flawless, Perfect)
    if (!tower.isSpecial && tower.level) {
      const q = QUALITIES[tower.level];
      if (q) {
        ctx.strokeStyle = q.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (tower.isSpecial) {
      // Golden ornate ring for special towers
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gem Faceted Body (Octagon / Diamond)
    ctx.fillStyle = tower.gemColor;
    ctx.beginPath();
    const sides = tower.isSpecial ? 8 : 6;
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = cx + rad * Math.cos(angle);
      const y = cy + rad * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Darker outline
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(cx - rad * 0.35, cy - rad * 0.35, rad * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Accent facet
    ctx.fillStyle = tower.accentColor;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Short symbol in center
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbol = tower.isSpecial ? tower.name.slice(0, 2).toUpperCase() : (tower.code && tower.level ? `${tower.code}${tower.level}` : '');
    ctx.fillText(symbol, cx, cy);

    // Orbiting socketed runes
    if (tower.runes && tower.runes.length > 0) {
      const runeCount = tower.runes.length;
      for (let i = 0; i < runeCount; i++) {
        const rKey = tower.runes[i];
        const rDef = RUNE_TYPES[rKey];
        if (!rDef) continue;
        const orbitAngle = this.time * 2.5 + (i * 2 * Math.PI) / runeCount;
        const orbitDist = rad + 5.5;
        const rx = cx + orbitDist * Math.cos(orbitAngle);
        const ry = cy + orbitDist * Math.sin(orbitAngle);

        ctx.save();
        ctx.fillStyle = rDef.color;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Tower MVP Crown & Level Badge
    if (tower.mvpLevel && tower.mvpLevel > 0) {
      ctx.save();
      // Radiant golden aura if max MVP rank (10)
      if (tower.mvpLevel >= CONFIG.MVP_MAX_LEVEL) {
        const auraPulse = Math.sin(this.time * 4) * 2;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -this.time * 15;
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 7 + auraPulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      const badgeY = cy - rad - 5;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`👑${tower.mvpLevel}`, cx, badgeY);
      ctx.restore();
    }

    ctx.restore();
  }

  drawTraps(ctx, traps) {
    if (!traps || traps.length === 0) return;
    const ts = this.tileSize;

    for (const trap of traps) {
      const cx = trap.pixelX;
      const cy = trap.pixelY;
      const def = trap.def;
      const pulse = Math.sin(this.time * 4 + trap.tileX) * 0.15 + 0.85;

      ctx.save();
      // Floor glow
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.8);
      grad.addColorStop(0, def.color + '66');
      grad.addColorStop(0.7, def.color + '22');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Rune border sigil
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.lineDashOffset = -this.time * 12;
      ctx.beginPath();
      ctx.arc(cx, cy, (ts * 0.42) * pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Center icon
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, cx, cy);

      // Charge pips underneath
      if (trap.maxCharges > 1) {
        const pipRadius = 1.5;
        const pipSpacing = 5;
        const totalW = (trap.maxCharges - 1) * pipSpacing;
        const startX = cx - totalW / 2;
        const pipY = cy + ts * 0.38;

        for (let c = 0; c < trap.maxCharges; c++) {
          ctx.beginPath();
          ctx.arc(startX + c * pipSpacing, pipY, pipRadius, 0, Math.PI * 2);
          ctx.fillStyle = c < trap.charges ? def.color : '#475569';
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  drawInteractionMode(ctx, game) {
    const mode = game.interactionMode;
    if (!mode) return;
    const ts = this.tileSize;

    if (mode.type === 'MOVE_TOWER') {
      const src = mode.sourceTower;
      if (src) {
        // Source tower highlight ring
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(src.pixelX, src.pixelY, ts * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // If hovered over a tile
        if (game.hoverTile) {
          const { x, y } = game.hoverTile;
          const px = x * ts;
          const py = y * ts;
          const valid = game.canMoveTowerTo(src, x, y);
          const destTower = game.towerGrid[y][x];

          ctx.save();
          ctx.strokeStyle = valid ? '#4ade80' : '#ef4444';
          ctx.fillStyle = valid ? 'rgba(74, 222, 128, 0.25)' : 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 2;
          ctx.fillRect(px, py, ts, ts);
          ctx.strokeRect(px, py, ts, ts);

          // Tether line
          ctx.strokeStyle = valid ? '#4ade80' : '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -this.time * 20;
          ctx.beginPath();
          ctx.moveTo(src.pixelX, src.pixelY);
          ctx.lineTo(px + ts / 2, py + ts / 2);
          ctx.stroke();

          // Action text
          ctx.font = 'bold 11px sans-serif';
          ctx.fillStyle = valid ? '#4ade80' : '#ef4444';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const label = valid ? (destTower && destTower.isSlate ? 'SWAP SLATE 🔀' : 'MOVE HERE 🔀') : 'INVALID';
          ctx.fillText(label, px + ts / 2, py - 4);
          ctx.restore();
        }
      } else {
        // Highlight all eligible active towers to choose which one to move
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
          for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const t = game.towerGrid[y][x];
            if (t && !t.isSlate) {
              ctx.save();
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([3, 3]);
              ctx.lineDashOffset = -this.time * 15;
              ctx.beginPath();
              ctx.arc(t.pixelX, t.pixelY, ts * 0.75, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      if (src) {
        this.drawBannerNotice(ctx, `🔀 RELOCATE TOWER (${CONFIG.MOVE_TOWER_COST}G): Click a Rock Slate (Swap) or Empty Tile. [ESC / Right-Click to Cancel]`);
      } else {
        this.drawBannerNotice(ctx, `🔀 RELOCATE TOWER (${CONFIG.MOVE_TOWER_COST}G): Click an Active Tower to move. [ESC / Right-Click to Cancel]`);
      }
    } else if (mode.type === 'PLACE_TRAP') {
      const def = TRAP_TYPES[mode.trapKey];
      if (def && game.hoverTile) {
        const { x, y } = game.hoverTile;
        const px = x * ts;
        const py = y * ts;
        const cx = px + ts / 2;
        const cy = py + ts / 2;
        const valid = game.canPlaceTrapAt(x, y);

        ctx.save();
        // Effect radius preview
        ctx.fillStyle = valid ? (def.color + '22') : 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = valid ? def.color : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, def.effectRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tile box
        ctx.strokeStyle = valid ? def.color : '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, ts, ts);

        // Icon
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, cx, cy);
        ctx.restore();
      }

      this.drawBannerNotice(ctx, `💣 PLACE ${def ? def.name.toUpperCase() : 'TRAP'} (${def ? def.cost : 0}G): Click on enemy path. [ESC / Right-Click to Cancel]`);
    } else if (mode.type === 'SOCKET_RUNE') {
      const def = RUNE_TYPES[mode.runeKey];

      // Highlight all eligible towers
      for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
          const t = game.towerGrid[y][x];
          if (t && !t.isSlate && t.canSocketRune()) {
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.lineDashOffset = -this.time * 15;
            ctx.beginPath();
            ctx.arc(t.pixelX, t.pixelY, ts * 0.75, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      if (game.hoverTile) {
        const { x, y } = game.hoverTile;
        const t = game.towerGrid[y][x];
        const valid = !!(t && !t.isSlate && t.canSocketRune());

        ctx.save();
        const px = x * ts;
        const py = y * ts;
        ctx.strokeStyle = valid ? (def ? def.color : '#4ade80') : '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, ts, ts);
        ctx.restore();
      }

      this.drawBannerNotice(ctx, `✨ SOCKET ${def ? def.name.toUpperCase() : 'RUNE'} (${def ? def.cost : 0}G): Click an active tower. [ESC / Right-Click to Cancel]`);
    }
  }

  drawBannerNotice(ctx, text) {
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(text).width;
    const bannerW = textW + 30;
    const bannerH = 26;
    const bx = this.width / 2 - bannerW / 2;
    const by = 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(text, this.width / 2, by + bannerH / 2);
    ctx.restore();
  }

  drawHoverTile(ctx, game) {
    const { x, y } = game.hoverTile;
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    ctx.save();
    const canPlace = game.getHoverCanPlace();
    ctx.fillStyle = canPlace ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)';
    ctx.strokeStyle = canPlace ? '#4ade80' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.fillRect(px, py, ts, ts);
    ctx.strokeRect(px, py, ts, ts);
    ctx.restore();
  }

  drawTowerRange(ctx, tower) {
    const cx = tower.pixelX;
    const cy = tower.pixelY;

    ctx.save();
    // Selection ring around tower
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, this.tileSize * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // Attack Range Circle
    const range = tower.getEffectiveRange();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Aura radius if tower has aura
    if (tower.effectRadius && tower.effectRadius > 0) {
      ctx.fillStyle = 'rgba(234, 88, 12, 0.08)';
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.5)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, tower.effectRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // MVP Auras Visualization (Magic Shred & Ally Dmg)
    if (tower.mvpLevel && tower.mvpLevel > 0) {
      // 1. Enemy Magic Shred Aura
      const shredRad = CONFIG.MVP_MAGIC_SHRED_RADIUS;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, shredRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 2. Friendly Ally Damage Aura
      const allyRad = CONFIG.MVP_ALLY_AURA_RADIUS_TILES * CONFIG.DEFAULT_TILE_SIZE + 10;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, allyRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  //  ENHANCED CREEP RENDERING with debuff particle effects
  // ═══════════════════════════════════════════════════════
  drawCreeps(ctx, creeps) {
    for (const creep of creeps) {
      if (creep.hp <= 0) continue;

      ctx.save();
      const cx = creep.x;
      let cy = creep.y;

      // Flying Creep Altitude and Shadow
      if (creep.isFlying) {
        // Shadow on ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, creep.radius * 1.1, creep.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Elevate flying creep
        cy -= 10 + Math.sin(this.time * 6 + creep.wave) * 3;
      }

      // ── Debuff ambient particle effects ──

      // BURN: Flickering fire embers around body
      if (creep.debuffs.burn) {
        const flicker = Math.sin(this.time * 15 + cx) * 0.3 + 0.7;
        ctx.save();
        ctx.globalAlpha = flicker * 0.6;
        // Fire glow under creep
        const fireGrad = ctx.createRadialGradient(cx, cy, creep.radius * 0.3, cx, cy, creep.radius * 2.2);
        fireGrad.addColorStop(0, 'rgba(249, 115, 22, 0.5)');
        fireGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.2)');
        fireGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, creep.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
        // Small flame licks
        for (let f = 0; f < 3; f++) {
          const fAngle = this.time * 8 + f * 2.1;
          const fDist = creep.radius * (0.8 + Math.sin(fAngle * 1.7) * 0.3);
          const fx = cx + Math.cos(fAngle) * fDist;
          const fy = cy + Math.sin(fAngle) * fDist - 3;
          ctx.fillStyle = f % 2 === 0 ? '#f97316' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(fx, fy, 2 + Math.sin(this.time * 20 + f) * 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // POISON: Toxic bubbles floating up
      if (creep.debuffs.poison) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        for (let b = 0; b < 3; b++) {
          const bubblePhase = this.time * 3 + b * 1.3;
          const bubbleY = cy - creep.radius - (bubblePhase % 2) * 8;
          const bubbleX = cx + Math.sin(bubblePhase * 2 + b) * 5;
          const bSize = 1.5 + Math.sin(bubblePhase) * 0.8;
          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bubbleX, bubbleY, bSize, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Green toxic aura
        const toxGrad = ctx.createRadialGradient(cx, cy, creep.radius * 0.5, cx, cy, creep.radius * 1.8);
        toxGrad.addColorStop(0, 'rgba(74, 222, 128, 0.15)');
        toxGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = toxGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, creep.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // SLOW (ICE): Frost crystals and icy shimmer
      if (creep.debuffs.slow) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        // Icy blue aura
        const iceGrad = ctx.createRadialGradient(cx, cy, creep.radius * 0.4, cx, cy, creep.radius * 1.8);
        iceGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        iceGrad.addColorStop(0.7, 'rgba(147, 197, 253, 0.08)');
        iceGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = iceGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, creep.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Small frost crystals
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const angle = this.time * 1.5 + i * Math.PI / 2;
          const dist = creep.radius * 1.1;
          const fx = cx + Math.cos(angle) * dist;
          const fy = cy + Math.sin(angle) * dist;
          // Draw a tiny snowflake cross
          ctx.beginPath();
          ctx.moveTo(fx - 2, fy);
          ctx.lineTo(fx + 2, fy);
          ctx.moveTo(fx, fy - 2);
          ctx.lineTo(fx, fy + 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // STUN: Spinning stars above head
      if (creep.debuffs.stun) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fde047';
        for (let s = 0; s < 3; s++) {
          const starAngle = this.time * 6 + s * (Math.PI * 2 / 3);
          const starDist = creep.radius * 0.9;
          const sx = cx + Math.cos(starAngle) * starDist;
          const sy = cy - creep.radius - 6 + Math.sin(starAngle * 2) * 2;
          this._drawStar(ctx, sx, sy, 3, 5, 2.5);
        }
        ctx.restore();
      }

      // ARMOR SHRED: Red cracks/fracture lines
      if (creep.debuffs.armorShred) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 1;
        for (let c = 0; c < 3; c++) {
          const crackAngle = c * Math.PI * 0.7 + 0.3;
          const inner = creep.radius * 0.4;
          const outer = creep.radius * 1.1;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(crackAngle) * inner, cy + Math.sin(crackAngle) * inner);
          ctx.lineTo(cx + Math.cos(crackAngle + 0.2) * outer, cy + Math.sin(crackAngle + 0.2) * outer);
          ctx.stroke();
        }
        ctx.restore();
      }

      // MAGIC SHRED: Purple arcane spirals
      if (creep.debuffs.magicShred) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1;
        const spiralAngle = this.time * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, creep.radius * 1.3, spiralAngle, spiralAngle + Math.PI * 1.2);
        ctx.stroke();
        ctx.restore();
      }

      // ── Hit flash effect ──
      if (creep._hitFlashTimer && creep._hitFlashTimer > 0) {
        const flashAlpha = Math.min(1, creep._hitFlashTimer * 6);
        ctx.save();
        ctx.globalAlpha = flashAlpha * 0.5;
        const flashColor = creep._hitFlashColor || '#ffffff';
        ctx.fillStyle = flashColor;
        ctx.beginPath();
        ctx.arc(cx, cy, creep.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Creep Body
      let color = creep.isBoss ? '#ef4444' : creep.isFlying ? '#38bdf8' : '#e2e8f0';
      // Tint body slightly for active debuffs (subtle overlay)
      if (creep.debuffs.stun) color = '#fde047';
      else if (creep.debuffs.burn) color = '#fdba74';
      else if (creep.debuffs.poison) color = '#86efac';
      else if (creep.debuffs.slow) color = '#93c5fd';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, creep.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wing animation for flying creeps
      if (creep.isFlying) {
        const wingFlap = Math.sin(this.time * 12) * 6;
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.ellipse(cx - creep.radius - 2, cy + wingFlap, 6, 3, -0.4, 0, Math.PI * 2);
        ctx.ellipse(cx + creep.radius + 2, cy + wingFlap, 6, 3, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Boss Crown
      if (creep.isBoss) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - creep.radius - 2);
        ctx.lineTo(cx - 10, cy - creep.radius - 8);
        ctx.lineTo(cx - 4, cy - creep.radius - 4);
        ctx.lineTo(cx, cy - creep.radius - 10);
        ctx.lineTo(cx + 4, cy - creep.radius - 4);
        ctx.lineTo(cx + 10, cy - creep.radius - 8);
        ctx.lineTo(cx + 8, cy - creep.radius - 2);
        ctx.closePath();
        ctx.fill();
      }

      // Immunity badges
      if (creep.isMagicImmune) {
        ctx.save();
        ctx.font = 'bold 7px sans-serif';
        ctx.fillStyle = '#c084fc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦M', cx + creep.radius + 5, cy);
        ctx.restore();
      }
      if (creep.isPhysicalImmune) {
        ctx.save();
        ctx.font = 'bold 7px sans-serif';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚔P', cx - creep.radius - 5, cy);
        ctx.restore();
      }

      // Health bar above creep
      const barW = creep.radius * 2.4;
      const barH = 4;
      const barX = cx - barW / 2;
      const barY = cy - creep.radius - 8;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barW, barH);

      const hpPercent = Math.max(0, creep.hp / creep.maxHp);
      ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hpPercent, barH);

      // Shield bar (Recharge trait)
      if (creep.maxShieldHp > 0 && creep.shieldHp > 0) {
        const shieldPercent = creep.shieldHp / creep.maxShieldHp;
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(barX, barY - 3, barW * shieldPercent, 2);
      }

      // Active debuff indicator icons below health bar
      const activeDebuffs = [];
      if (creep.debuffs.slow) activeDebuffs.push({ icon: '❄', color: '#38bdf8' });
      if (creep.debuffs.poison) activeDebuffs.push({ icon: '☠', color: '#4ade80' });
      if (creep.debuffs.burn) activeDebuffs.push({ icon: '🔥', color: '#f97316' });
      if (creep.debuffs.stun) activeDebuffs.push({ icon: '⭐', color: '#fde047' });
      if (creep.debuffs.armorShred) activeDebuffs.push({ icon: '🛡', color: '#f87171' });

      if (activeDebuffs.length > 0) {
        const iconSpacing = 8;
        const startIconX = cx - ((activeDebuffs.length - 1) * iconSpacing) / 2;
        ctx.font = '6px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let di = 0; di < activeDebuffs.length; di++) {
          ctx.fillStyle = activeDebuffs[di].color;
          ctx.fillText(activeDebuffs[di].icon, startIconX + di * iconSpacing, cy + creep.radius + 6);
        }
      }

      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  ENHANCED PROJECTILE RENDERING per damage type
  // ═══════════════════════════════════════════════════════
  drawProjectiles(ctx, projectiles) {
    for (const p of projectiles) {
      if (p.isDead) continue;
      ctx.save();

      const isCrit = p.options && p.options.isCrit;
      const hasLightning = p.effects && p.effects.chainLightning;
      const hasPoison = p.effects && p.effects.poison;
      const hasSlow = p.effects && p.effects.slow;
      const hasSplash = p.effects && p.effects.splash;
      const hasCleave = p.effects && p.effects.cleave;
      const hasStun = p.effects && p.effects.stun;

      // Determine visual style based on damage type and effects
      let projColor = p.color;
      let glowColor = p.color;
      let trailColor = p.color + '88';
      let projSize = p.radius;

      if (isCrit) {
        projColor = '#fbbf24';
        glowColor = '#fde047';
        trailColor = 'rgba(251, 191, 36, 0.5)';
        projSize = p.radius * 1.6;
      } else if (hasLightning) {
        projColor = '#22d3ee';
        glowColor = '#67e8f9';
        trailColor = 'rgba(34, 211, 238, 0.4)';
      } else if (hasPoison) {
        projColor = '#4ade80';
        glowColor = '#86efac';
        trailColor = 'rgba(74, 222, 128, 0.4)';
      } else if (hasSlow) {
        projColor = '#38bdf8';
        glowColor = '#7dd3fc';
        trailColor = 'rgba(56, 189, 248, 0.3)';
      } else if (p.damageType === 'magic') {
        projColor = p.color;
        glowColor = '#c084fc';
        trailColor = 'rgba(168, 85, 247, 0.35)';
      }

      // ── Trail effect ──
      if (p._prevX !== undefined) {
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = projSize * 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p._prevX, p._prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      // ── Outer glow bloom ──
      const bloomSize = projSize * (isCrit ? 4.5 : 3);
      const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, bloomSize);
      grad.addColorStop(0, glowColor + 'cc');
      grad.addColorStop(0.3, projColor + '66');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, bloomSize, 0, Math.PI * 2);
      ctx.fill();

      // ── Projectile body shape based on type ──
      if (hasLightning) {
        // Electric bolt shape - small jagged line
        ctx.strokeStyle = '#cffafe';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 3, p.y - 2);
        ctx.lineTo(p.x + 1, p.y);
        ctx.lineTo(p.x - 1, p.y + 1);
        ctx.lineTo(p.x + 3, p.y + 2);
        ctx.stroke();
      } else if (hasSplash) {
        // Fireball - larger glowing sphere
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.arc(p.x, p.y, projSize * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(p.x, p.y, projSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (hasCleave) {
        // Blade/slash projectile - diamond shape
        ctx.fillStyle = projColor;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - projSize * 1.5);
        ctx.lineTo(p.x + projSize, p.y);
        ctx.lineTo(p.x, p.y + projSize * 1.5);
        ctx.lineTo(p.x - projSize, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (hasStun) {
        // Stun projectile - star shape
        ctx.fillStyle = '#fde047';
        this._drawStar(ctx, p.x, p.y, 5, projSize * 1.2, projSize * 0.5);
      } else {
        // Standard glowing orb
        ctx.fillStyle = projColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, projSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, projSize * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Crit sparkle halo
      if (isCrit) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.5;
        const sparkleAngle = this.time * 12;
        for (let i = 0; i < 4; i++) {
          const a = sparkleAngle + i * Math.PI / 2;
          const dist = projSize * 2;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * (dist * 0.5), p.y + Math.sin(a) * (dist * 0.5));
          ctx.lineTo(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
          ctx.stroke();
        }
      }

      // Store position for trail
      p._prevX = p.x;
      p._prevY = p.y;

      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  ENHANCED LIGHTNING ARCS
  // ═══════════════════════════════════════════════════════
  drawLightningArcs(ctx, arcs) {
    if (!arcs || arcs.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';

    for (const arc of arcs) {
      const alpha = Math.min(1, arc.life * 8);

      // 1. Wide outer bloom
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const lx = arc.x1 + (arc.x2 - arc.x1) * t + (i < steps ? (Math.random() - 0.5) * 20 : 0);
        const ly = arc.y1 + (arc.y2 - arc.y1) * t + (i < steps ? (Math.random() - 0.5) * 20 : 0);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();

      // 2. Medium electric halo
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const lx = arc.x1 + (arc.x2 - arc.x1) * t + (i < steps ? (Math.random() - 0.5) * 14 : 0);
        const ly = arc.y1 + (arc.y2 - arc.y1) * t + (i < steps ? (Math.random() - 0.5) * 14 : 0);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();

      // 3. Crisp inner white-cyan core
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ecfeff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const lx = arc.x1 + (arc.x2 - arc.x1) * t + (i < steps ? (Math.random() - 0.5) * 10 : 0);
        const ly = arc.y1 + (arc.y2 - arc.y1) * t + (i < steps ? (Math.random() - 0.5) * 10 : 0);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();

      // 4. Impact sparks at endpoints
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.arc(arc.x2, arc.y2, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════
  //  IMPACT RINGS - expanding ring effects at hit locations
  // ═══════════════════════════════════════════════════════
  drawImpactRings(ctx, rings) {
    if (!rings || rings.length === 0) return;
    for (const ring of rings) {
      const progress = ring.age / ring.life;
      const radius = ring.startRadius + (ring.maxRadius - ring.startRadius) * progress;
      const alpha = (1 - progress) * 0.6;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.max(0.5, 2 * (1 - progress));
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner filled flash (first 30% of life)
      if (progress < 0.3) {
        ctx.globalAlpha = (0.3 - progress) * 1.5;
        ctx.fillStyle = ring.color;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  ENHANCED PARTICLE RENDERING with glow and type shapes
  // ═══════════════════════════════════════════════════════
  drawParticles(ctx, particles) {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;

      if (p.type === 'ember') {
        // Ember: glowing stretched oval
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 1.5, p.size, p.rotation, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'frost_flake') {
        // Snowflake: six-point cross with glow
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3 + p.rotation;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(angle) * p.size * 2, p.y + Math.sin(angle) * p.size * 2);
          ctx.stroke();
        }
      } else if (p.type === 'poison_bubble') {
        // Bubble: hollow circle with highlight
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shock') {
        // Electric spark: jagged line
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.size, p.y);
        ctx.lineTo(p.x - p.size * 0.3, p.y - p.size * 0.7);
        ctx.lineTo(p.x + p.size * 0.3, p.y + p.size * 0.5);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.stroke();
      } else if (p.type === 'ring') {
        // Expanding ring
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, 2 * (1 - p.age / p.life));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        this._drawStar(ctx, p.x, p.y, 5, p.size, p.size * 0.4);
      } else if (p.type === 'smoke') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'slash') {
        // Cleave slash arc
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, p.arcStart, p.arcEnd);
        ctx.stroke();
      } else {
        // Default spark: glowing circle with bloom
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Solid core
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  ENHANCED FLOATING TEXT with damage type icons & style
  // ═══════════════════════════════════════════════════════
  drawFloatingText(ctx, floatingTexts) {
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;

      // Scale bounce on spawn
      const scaleVal = ft.scale || 1;
      ctx.translate(ft.x, ft.y);
      ctx.scale(scaleVal, scaleVal);
      ctx.translate(-ft.x, -ft.y);

      const fontSize = ft.fontSize || 14;
      ctx.font = `${ft.isCrit ? 'bold ' : ''}${fontSize}px sans-serif`;
      ctx.textAlign = 'center';

      // Build display text with type icon
      let displayText = ft.text;
      if (ft.icon) {
        displayText = ft.icon + ' ' + ft.text;
      }

      // Shadow/outline for readability
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(displayText, ft.x, ft.y);

      // Main text color
      ctx.fillStyle = ft.color;
      ctx.fillText(displayText, ft.x, ft.y);

      // Crit extra effects: golden glow halo
      if (ft.isCrit && ft.age < 0.3) {
        ctx.globalAlpha = ft.alpha * (0.3 - ft.age) * 3;
        ctx.fillStyle = '#fde047';
        ctx.font = `bold ${fontSize + 4}px sans-serif`;
        ctx.fillText(displayText, ft.x, ft.y);
      }

      ctx.restore();
    }
  }

  // ── Utility: Draw a star shape ──
  _drawStar(ctx, cx, cy, points, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}
