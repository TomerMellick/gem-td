// Gem TD - Canvas 2D Game Renderer
import { CONFIG, QUALITIES, TRAP_TYPES, RUNE_TYPES } from './config.js';
import { TILE_TYPES } from './pathfinding.js';

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
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    this.tileSize = width / CONFIG.GRID_WIDTH;
  }

  render(game, dt) {
    this.time += dt;
    const ctx = this.ctx;

    // Clear canvas with dark fantasy stone background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

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

    // Draw projectiles
    this.drawProjectiles(ctx, game.projectiles);

    // Draw lightning arcs
    this.drawLightningArcs(ctx, game.lightningArcs);

    // Draw particles
    this.drawParticles(ctx, game.particles);

    // Draw floating text
    this.drawFloatingText(ctx, game.floatingTexts);
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

      // Creep Body
      let color = creep.isBoss ? '#ef4444' : creep.isFlying ? '#38bdf8' : '#e2e8f0';
      if (creep.debuffs.slow) color = '#93c5fd';
      if (creep.debuffs.poison) color = '#86efac';
      if (creep.debuffs.burn) color = '#fdba74';

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

      ctx.restore();
    }
  }

  drawProjectiles(ctx, projectiles) {
    for (const p of projectiles) {
      if (p.isDead) continue;
      ctx.save();

      // Glowing projectile
      const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, p.color);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawLightningArcs(ctx, arcs) {
    if (!arcs || arcs.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';

    // 1. Soft outer bloom
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 5;
    for (const arc of arcs) {
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const lx = arc.x1 + (arc.x2 - arc.x1) * t + (i < steps ? (Math.random() - 0.5) * 16 : 0);
        const ly = arc.y1 + (arc.y2 - arc.y1) * t + (i < steps ? (Math.random() - 0.5) * 16 : 0);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }

    // 2. Crisp inner electrical core
    ctx.strokeStyle = '#cffafe';
    ctx.lineWidth = 2;
    for (const arc of arcs) {
      ctx.beginPath();
      ctx.moveTo(arc.x1, arc.y1);
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const lx = arc.x1 + (arc.x2 - arc.x1) * t + (i < steps ? (Math.random() - 0.5) * 16 : 0);
        const ly = arc.y1 + (arc.y2 - arc.y1) * t + (i < steps ? (Math.random() - 0.5) * 16 : 0);
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawParticles(ctx, particles) {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawFloatingText(ctx, floatingTexts) {
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `${ft.isCrit ? 'bold' : ''} ${ft.fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      // Crisp outline without software shadow blur
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
