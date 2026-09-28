// Gem TD - Canvas 2D Game Renderer
import { CONFIG, QUALITIES } from './config.js';
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

    // Draw all placed towers & slates
    this.drawTowersAndSlates(ctx, game);

    // Draw hovered tile preview
    if (game.hoverTile) {
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

      // Glow halo
      ctx.save();
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, ts * 1.6);
      grad.addColorStop(0, cp.color + 'aa');
      grad.addColorStop(0.7, cp.color + '22');
      grad.addColorStop(1, 'transparent');
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

    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
        const tower = game.towerGrid[y][x];
        if (!tower) continue;

        const px = x * ts;
        const py = y * ts;
        const cx = px + ts / 2;
        const cy = py + ts / 2;

        if (tower.isSlate) {
          this.drawSlate(ctx, px, py, ts);
        } else {
          const isTemp = game.placedGemsThisTurn.includes(tower);
          this.drawGemTower(ctx, tower, cx, cy, ts, isTemp);
        }
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

  drawGemTower(ctx, tower, cx, cy, ts, isTemp) {
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
    const symbol = tower.isSpecial ? tower.name.slice(0, 2).toUpperCase() : `${tower.code}${tower.level}`;
    ctx.fillText(symbol, cx, cy);

    ctx.restore();
  }

  drawHoverTile(ctx, game) {
    const { x, y } = game.hoverTile;
    const ts = this.tileSize;
    const px = x * ts;
    const py = y * ts;

    ctx.save();
    const canPlace = game.canPlaceAt(x, y);
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
    ctx.save();
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;

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
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
