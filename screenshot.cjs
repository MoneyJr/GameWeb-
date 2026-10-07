const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto('http://localhost:3000');

  // Wait for the app to load
  await page.waitForSelector('#tool-residential');

  // Click residential
  await page.click('#tool-residential');
  await wait(500);

  // Click center of canvas
  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2 - 40, box.y + box.height / 2);

  // Click park
  await page.click('#tool-park');
  await wait(500);
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2);

  // Scroll to zoom in
  // Dispatch wheel event multiple times
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel({ deltaY: -100 });
    await wait(50);
  }

  // Wait for animations
  await wait(2000);

  const timestamp = Date.now();
  const path = `/Users/daniel/.gemini/antigravity-ide/brain/3d357414-eb65-4d22-a6e4-35c00f44634d/modular_house_${timestamp}.png`;
  await page.screenshot({ path });
  console.log(path);

  await browser.close();
})();
