// Gem TD - Application Entry Point
import { Game } from './game.js';
import { GameRenderer } from './renderer.js';
import { UIController } from './ui.js';
import { CONFIG } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Game canvas element not found');
    return;
  }

  // Set default dimensions: 33 * 24 = 792px
  const targetSize = CONFIG.GRID_WIDTH * CONFIG.DEFAULT_TILE_SIZE;
  canvas.width = targetSize;
  canvas.height = targetSize;

  const game = new Game();
  const renderer = new GameRenderer(canvas);
  const ui = new UIController(game, renderer);

  let lastTime = performance.now();

  function gameLoop(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;

    // Tick game simulation
    game.update(rawDt);

    // Render frame
    renderer.render(game, rawDt);

    // Update UI elements
    ui.update();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
