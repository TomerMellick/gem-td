/**
 * Playwright Program to Deterministically Play Gem TD in the Browser to Wave 25+
 *
 * Usage:
 *   node play_game.js [--target-wave 25] [--seed 1337] [--headed]
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

function getPlaywright() {
  const candidates = [
    path.resolve(__dirname, 'package/index.js'),
    path.resolve(__dirname, 'package'),
    'playwright-core',
    'playwright'
  ];
  for (const c of candidates) {
    try {
      const mod = require(c);
      if (mod && mod.chromium) return mod;
    } catch (e) {}
  }
  throw new Error('Could not resolve Playwright library. Please install playwright or playwright-core.');
}
const playwright = getPlaywright();

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('--live');
const isHeaded = args.includes('--headed') || isWatch;
const speedArg = args.indexOf('--speed');
const GAME_SPEED = speedArg !== -1 && args[speedArg + 1] ? parseFloat(args[speedArg + 1]) : (isWatch ? 2 : 1);
const targetWaveArg = args.indexOf('--target-wave');
const TARGET_WAVE = targetWaveArg !== -1 && args[targetWaveArg + 1] ? parseInt(args[targetWaveArg + 1], 10) : 25;
const seedArg = args.indexOf('--seed');
const SEED = seedArg !== -1 && args[seedArg + 1] ? parseInt(args[seedArg + 1], 10) : 1337;

// MIME types for local static server fallback
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Ensure a local web server is running.
 * Returns the base URL (e.g. http://localhost:8000).
 */
async function ensureServer() {
  const isPortOpen = await new Promise(resolve => {
    const req = http.get('http://localhost:8000/index.html', res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });

  if (isPortOpen) {
    console.log('Connected to existing server at http://localhost:8000');
    return { url: 'http://localhost:8000/index.html', server: null };
  }

  // Start internal static server
  const rootDir = __dirname;
  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(rootDir, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  const port = 8085;
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`Started local static server at http://localhost:${port}`);
  return { url: `http://localhost:${port}/index.html`, server };
}

(async () => {
  let localServer = null;
  let browser = null;

  try {
    console.log('====================================================');
    console.log('  GEM TD - DETERMINISTIC PLAYWRIGHT BROWSER AGENT  ');
    console.log(`  Target Wave: >= ${TARGET_WAVE} | Deterministic Seed: ${SEED}`);
    console.log(`  Browser Mode: ${isHeaded ? 'Headed (Visible)' : 'Headless'}`);
    console.log('====================================================\n');

    const { url, server } = await ensureServer();
    localServer = server;

    console.log('Launching browser with Playwright...');
    browser = await playwright.chromium.launch({
      headless: !isHeaded,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 860 }
    });
    const page = await context.newPage();

    // Deterministic PRNG injection via addInitScript
    await page.addInitScript((seedVal) => {
      function sfc32(a, b, c, d) {
        return function() {
          a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
          var t = (a + b | 0) + d | 0;
          d = d + 1 | 0;
          a = b ^ b >>> 9;
          b = c + (c << 3) | 0;
          c = (c << 21 | c >>> 11);
          c = c + t | 0;
          return (t >>> 0) / 4294967296;
        };
      }
      Math.random = sfc32(0x9E3779B9, 0x243F6A88, 0xB7E15162, seedVal);
      console.log(`[INIT] Deterministic Math.random seeded with sfc32 (${seedVal})`);
    }, SEED);

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#game-canvas');
    console.log('Page loaded successfully. Title:', await page.title());

    // Play the game in the browser context
    console.log('\n--- STARTING DETERMINISTIC GAMEPLAY ---');

    const playResult = await page.evaluate(async ({ targetWave, isWatch, gameSpeed }) => {
      const g = window.game;
      const pf = g.pathfinding;

      // Set playback speed
      g.gameSpeed = gameSpeed;
      const fixedDt = 0.033;

      // Smart maze placement helper: maximizes creep path length
      function findBestPlacement() {
        const route = pf.validateFullRoute(g.grid, false);
        const path = route.fullPath;
        let bestCoord = null;
        let bestLen = -1;

        if (path && path.length > 2) {
          for (let i = 1; i < path.length - 1; i++) {
            const pt = path[i];
            if (g.canPlaceAt(pt.x, pt.y)) {
              g.grid[pt.y][pt.x] = 4;
              const r = pf.validateFullRoute(g.grid, false);
              if (r.valid && r.totalLength > bestLen) {
                bestLen = r.totalLength;
                bestCoord = pt;
              }
              g.grid[pt.y][pt.x] = 0;
            }
          }
        }

        if (bestCoord) return bestCoord;

        // Fallback search in central rings
        for (let r = 1; r <= 8; r++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const x = 16 + dx;
              const y = 16 + dy;
              if (g.canPlaceAt(x, y)) return { x, y };
            }
          }
        }

        for (let y = 3; y < 30; y++) {
          for (let x = 3; x < 30; x++) {
            if (g.canPlaceAt(x, y)) return { x, y };
          }
        }
        return null;
      }

      // Smart gem choosing helper
      function chooseBestGem() {
        const placed = g.placedGemsThisTurn;
        if (!placed || placed.length === 0) return null;

        // 1. Check recipes
        const availRecipes = g.getAvailableRecipes();
        if (availRecipes && availRecipes.length > 0) {
          const recName = availRecipes[0].name;
          g.craftSpecialTower(recName);
          return { action: 'recipe', name: recName };
        }

        // 2. Check duplicate combines
        const dupes = g.getAvailableDuplicateUpgrades();
        if (dupes && dupes.length > 0) {
          g.applyDuplicateUpgrade(dupes[0]);
          return { action: 'combine', label: dupes[0].label };
        }

        // 3. Keep highest value gem by tier and priority
        const gemWeights = { 'E': 10, 'B': 9, 'D': 8, 'Q': 8, 'Y': 7, 'R': 6, 'G': 5, 'P': 4 };
        let bestGem = placed[0];
        let bestScore = -1;

        for (const gem of placed) {
          const tier = gem.level || 1;
          const w = (gemWeights[gem.code] || 5);
          const score = tier * 100 + w;
          if (score > bestScore) {
            bestScore = score;
            bestGem = gem;
          }
        }

        g.keepGem(bestGem);
        return { action: 'keep', name: bestGem.name, level: bestGem.level };
      }

      const waveLogs = [];
      const startTime = performance.now();

      while (g.phase !== 'GAME_OVER' && g.phase !== 'VICTORY') {
        // Upgrade chance level in shop whenever gold permits
        while (g.upgradeChance()) {}

        // Castle repair if lives drop
        if (g.lives <= 35 && g.gold >= 60) {
          g.healCastle();
        }

        // Boss wave trap preparation
        const waveData = g.getWaveData();
        if (waveData && waveData.isBoss && g.gold >= 40) {
          const cp = g.pathfinding.checkpoints[4];
          if (g.canPlaceTrapAt(cp.x, cp.y - 1)) {
            g.placeTrap('spike', cp.x, cp.y - 1);
          }
        }

        // 1. BUILDING PHASE: place 5 strategic gems
        if (g.phase === 'BUILDING') {
          if (g.currentWave >= targetWave) {
            break;
          }

          while (g.placedGemsThisTurn.length < 5) {
            const spot = findBestPlacement();
            if (spot) {
              g.placeGemAt(spot.x, spot.y);
              if (isWatch) {
                await new Promise(r => setTimeout(r, 80));
              }
            } else {
              break;
            }
          }
        }

        // 2. CHOOSING PHASE: select best gem/recipe/combine
        if (g.phase === 'CHOOSING') {
          if (isWatch) {
            await new Promise(r => setTimeout(r, 200));
          }
          const decision = chooseBestGem();
          waveLogs.push({
            wave: g.currentWave,
            lives: g.lives,
            gold: g.gold,
            score: g.score,
            pathLength: g.fullCreepPath.length,
            activeTowers: g.getAllGems().length,
            decision
          });
        }

        // 3. WAVE COMBAT
        if (isWatch) {
          // Let regular browser requestAnimationFrame render live combat
          while (g.phase === 'WAVE') {
            await new Promise(r => setTimeout(r, 50));
          }
        } else {
          // Fast-forward headless execution
          let maxCombatTicks = 5000;
          while (g.phase === 'WAVE' && maxCombatTicks-- > 0) {
            g.update(fixedDt);
          }
        }

        // Update UI controller display
        if (window.ui) {
          window.ui.update();
        }

        // Timeout safeguard
        const maxTimeMs = isWatch ? 600000 : 60000;
        if (performance.now() - startTime > maxTimeMs) {
          break;
        }
      }

      return {
        finalWave: g.currentWave,
        phase: g.phase,
        lives: g.lives,
        gold: g.gold,
        score: g.score,
        pathLength: g.fullCreepPath.length,
        activeTowers: g.getAllGems().length,
        waveLogs
      };
    }, { targetWave: TARGET_WAVE, isWatch, gameSpeed: GAME_SPEED });

    // Print detailed wave log
    for (const log of playResult.waveLogs) {
      let actionText = '';
      if (log.decision) {
        if (log.decision.action === 'recipe') actionText = `Crafted Special: ${log.decision.name}`;
        else if (log.decision.action === 'combine') actionText = `Combined: ${log.decision.label}`;
        else actionText = `Kept: ${log.decision.name} (T${log.decision.level})`;
      }
      console.log(`[Wave ${String(log.wave).padStart(2, ' ')}] Lives: ${log.lives} | Gold: ${String(log.gold).padStart(4, ' ')} | Path: ${log.pathLength} tiles | Towers: ${log.activeTowers} | ${actionText}`);
    }

    // Get live DOM state
    const hudWave = await page.$eval('#hud-wave', el => el.textContent.trim());
    const hudLives = await page.$eval('#hud-lives', el => el.textContent.trim());
    const hudGold = await page.$eval('#hud-gold', el => el.textContent.trim());
    const hudScore = await page.$eval('#hud-score', el => el.textContent.trim());

    console.log('\n--- FINAL GAME STATE (DOM HUD) ---');
    console.log(`HUD Wave:         ${hudWave}`);
    console.log(`HUD Lives:        ${hudLives}`);
    console.log(`HUD Gold:         ${hudGold}`);
    console.log(`HUD Score:        ${hudScore}`);
    console.log(`Final Wave Level: ${playResult.finalWave}`);
    console.log(`Full Path Length: ${playResult.pathLength} tiles`);
    console.log(`Active Towers:    ${playResult.activeTowers}`);

    // Take screenshot of Wave 25 state
    const screenshotPath = path.resolve(__dirname, 'wave25_victory.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Verification check
    if (playResult.finalWave >= TARGET_WAVE) {
      console.log('\n====================================================');
      console.log(`🎉 SUCCESS! Reached Wave ${playResult.finalWave} (>= ${TARGET_WAVE}) deterministically!`);
      console.log('====================================================');
      if (isWatch) {
        console.log('\nGame completed. Keeping browser window open for 15 seconds to review...');
        await page.waitForTimeout(15000);
      }
      await browser.close();
      if (localServer) localServer.close();
      process.exit(0);
    } else {
      console.error(`\n❌ FAILED: Final wave was ${playResult.finalWave}, which is less than target ${TARGET_WAVE}.`);
      await browser.close();
      if (localServer) localServer.close();
      process.exit(1);
    }
  } catch (err) {
    console.error('Execution Error:', err);
    if (browser) await browser.close();
    if (localServer) localServer.close();
    process.exit(1);
  }
})();
