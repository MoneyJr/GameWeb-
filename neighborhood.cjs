const puppeteer = require('puppeteer');
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto('http://localhost:3000');

  // Wait for the app to load
  await page.waitForSelector('#tool-road');

  const canvas = await page.$('canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Let's assume each tile in screen space is roughly 25-35 pixels at zoom=90? 
  // We can just click around.
  // L-shaped road
  await page.click('#tool-road');
  await wait(200);
  // Center is (0,0)
  for(let i=0; i<=3; i++) {
    await page.mouse.click(cx + i*30, cy + i*15); // very rough isometric offset
    await wait(100);
  }
  for(let i=1; i<=3; i++) {
    await page.mouse.click(cx - i*30, cy + i*15);
    await wait(100);
  }

  // Houses
  await page.click('#tool-residential');
  await wait(200);
  for(let i=1; i<=4; i++) {
    await page.mouse.click(cx + i*30, cy + i*15 - 30);
    await wait(100);
  }
  for(let i=1; i<=3; i++) {
    await page.mouse.click(cx - i*30, cy + i*15 - 30);
    await wait(100);
  }

  // City Hall
  await page.click('#tool-city-hall');
  await wait(200);
  await page.mouse.click(cx, cy - 40);

  // Pan the camera a bit to frame it nicely
  // Wait, panning might require middle mouse button. 
  // MapControls is configured for MIDDLE mouse panning, or LEFT if cursor tool.
  await page.click('#tool-cursor');
  await wait(200);
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cx, cy + 100);
  await page.mouse.up({ button: 'left' });

  await wait(2000);

  const timestamp = Date.now();
  const path = `/Users/daniel/.gemini/antigravity-ide/brain/3d357414-eb65-4d22-a6e4-35c00f44634d/cityrt_neighborhood_${timestamp}.png`;
  await page.screenshot({ path });
  console.log(path);

  await browser.close();
})();
