const playwright = require('../package');

(async () => {
  try {
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:8000/index.html');
    console.log('Page loaded, title:', await page.title());

    const btnAi = await page.$('#btn-ai');
    console.log('Found AI button:', !!btnAi);
    await btnAi.click();
    console.log('Clicked AI button!');

    // Wait 4.5 seconds to let AI place gems and select tower
    await page.waitForTimeout(4500);

    const thought = await page.$eval('#ai-thought-text', el => el.textContent);
    console.log('AI Thought:', thought);

    const wave = await page.$eval('#hud-wave', el => el.textContent);
    console.log('Wave HUD:', wave);

    const gamePhase = await page.evaluate(() => window.game.phase);
    console.log('Game Phase:', gamePhase);

    const activeTowers = await page.evaluate(() => window.game.getAllGems().length);
    console.log('Active towers on board:', activeTowers);

    const pathLength = await page.evaluate(() => window.game.fullCreepPath.length);
    console.log('Full Creep Path length:', pathLength);

    await browser.close();
    console.log('TEST COMPLETE: SUCCESS!');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
})();
