// Gem TD - Application Entry Point
import { Game } from './game.js';
import { GameRenderer } from './renderer.js';
import { UIController } from './ui.js';
import { AIAgent } from './ai_player.js';
import { GamepadController } from './gamepad.js';
import { CONFIG } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Game canvas element not found');
    return;
  }

  // ── Mobile/Android Detection ──
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isCapacitor = typeof window.Capacitor !== 'undefined';

  // Set default dimensions: 33 * 24 = 792px
  const targetSize = CONFIG.GRID_WIDTH * CONFIG.DEFAULT_TILE_SIZE;
  canvas.width = targetSize;
  canvas.height = targetSize;

  const game = new Game();
  const renderer = new GameRenderer(canvas);
  game.renderer = renderer; // Link renderer for screen shake effects
  const ui = new UIController(game, renderer);
  const ai = new AIAgent(game, ui);
  const gamepad = new GamepadController(game, ui, renderer);

  // Expose to window for live inspection & testing
  window.game = game;
  window.ui = ui;
  window.renderer = renderer;
  window.ai = ai;
  window.gamepad = gamepad;
  window.CONFIG = CONFIG;

  // ── Responsive Canvas Sizing for Mobile ──
  function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const availW = Math.floor(containerRect.width - 4);
    const availH = Math.floor(containerRect.height - 4);
    if (availW <= 0 || availH <= 0) return;

    const fitSize = Math.min(availW, availH);
    canvas.style.width = fitSize + 'px';
    canvas.style.height = fitSize + 'px';
  }

  // Initial resize + observe container changes
  resizeCanvas();
  if (typeof ResizeObserver !== 'undefined') {
    const container = document.getElementById('canvas-container');
    if (container) {
      const ro = new ResizeObserver(() => resizeCanvas());
      ro.observe(container);
    }
  }
  window.addEventListener('resize', resizeCanvas);

  // ── Request Fullscreen on Mobile (Android WebView) ──
  if (isMobile || isCapacitor) {
    const requestFullscreen = () => {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

      // Lock to landscape if Screen Orientation API is available
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    };

    // Auto-request on first touch interaction
    document.addEventListener('touchstart', requestFullscreen, { once: true });
    document.addEventListener('click', requestFullscreen, { once: true });
  }

  // AI Autoplay UI Controls
  const btnAi = document.getElementById('btn-ai');
  const aiStatusCard = document.getElementById('ai-status-card');
  const aiThoughtText = document.getElementById('ai-thought-text');
  const aiSpeedBtns = document.querySelectorAll('.ai-speed-btn');

  if (btnAi) {
    btnAi.addEventListener('click', () => {
      const isEnabled = ai.toggle();
      if (isEnabled) {
        btnAi.classList.add('active');
        btnAi.innerHTML = '🤖 AI: On';
        if (aiStatusCard) aiStatusCard.classList.remove('hidden');
      } else {
        btnAi.classList.remove('active');
        btnAi.innerHTML = '🤖 AI: Off';
        if (aiStatusCard) aiStatusCard.classList.add('hidden');
      }
    });
  }

  aiSpeedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aiSpeedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pace = btn.dataset.aispeed || 'normal';
      ai.setSpeed(pace);
    });
  });

  let lastTime = performance.now();

  function gameLoop(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;

    // Poll gamepad controller
    gamepad.update(now);

    // Tick AI agent
    ai.tick(now);

    // Update AI Thought display
    if (ai.enabled && aiThoughtText) {
      aiThoughtText.textContent = ai.thought;
    }

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

