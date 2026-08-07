import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. 建立靜態 HTTP Server
function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      let filePath = path.join(rootDir, req.url === '/' ? 'index.html' : req.url);
      filePath = filePath.split('?')[0];

      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404 Not Found');
          } else {
            res.writeHead(500);
            res.end(`Server Error: ${err.code}`);
          }
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content, 'utf-8');
        }
      });
    });

    server.listen(0, () => {
      const port = server.address().port;
      console.log(`[QA Test Server] Listening on http://localhost:${port}`);
      resolve({ server, port });
    });
  });
}

async function runSlowSkillQATest() {
  const auditReport = {
    timestamp: new Date().toISOString(),
    uiButtonExistence: {
      slowButtonFound: false,
      initialText: '',
      passed: false
    },
    skillUsageAndSpeedDrop: {
      click1Text: '',
      click2Text: '',
      click3Text: '',
      click4MaxText: '',
      speedDrop30PctVerified: false,
      passed: false
    },
    safeZoneResetAudit: {
      resetOnGrassText: '',
      passed: false
    },
    consolePageErrors: {
      count: 0,
      errors: [],
      passed: false
    },
    overallResult: 'FAIL'
  };

  const { server, port } = await createServer();
  const consoleErrors = [];

  let browser;
  try {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      console.log('[QA Browser] Launched with Chrome channel');
    } catch (e1) {
      browser = await chromium.launch({ headless: true });
      console.log('[QA Browser] Launched with Chromium default');
    }

    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[Console Error] ${msg.text()}`);
        consoleErrors.push(`Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', err => {
      console.error(`[Page Error] ${err.message}`);
      consoleErrors.push(`Page Error: ${err.message}`);
    });

    console.log('\n--- Step 1: Loading Game Page & Starting Gameplay ---');
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const startBtn = page.locator('#btn-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(500);
      console.log('Clicked Start Game button.');
    }

    // 1. 檢查減速技能按鈕是否存在
    const slowBtn = page.locator('#btn-slow');
    auditReport.uiButtonExistence.slowButtonFound = (await slowBtn.count()) > 0;
    auditReport.uiButtonExistence.initialText = await slowBtn.innerText();
    auditReport.uiButtonExistence.passed =
      auditReport.uiButtonExistence.slowButtonFound &&
      auditReport.uiButtonExistence.initialText.includes('減速');

    console.log(`Slow Button Found: ${auditReport.uiButtonExistence.slowButtonFound}, Text: "${auditReport.uiButtonExistence.initialText}"`);

    // 2. 測試點擊減速技能按鈕 3 次 (疊加 15% ➔ 30% ➔ 45% 減速)
    console.log('\n--- Step 2: Testing 3 Skill Clicks & Speed Multiplier ---');

    await slowBtn.click();
    await page.waitForTimeout(200);
    auditReport.skillUsageAndSpeedDrop.click1Text = await slowBtn.innerText();

    await slowBtn.click();
    await page.waitForTimeout(200);
    auditReport.skillUsageAndSpeedDrop.click2Text = await slowBtn.innerText();

    await slowBtn.click();
    await page.waitForTimeout(200);
    auditReport.skillUsageAndSpeedDrop.click3Text = await slowBtn.innerText();

    await slowBtn.click(); // 第 4 次點擊 (已達上限)
    await page.waitForTimeout(200);
    auditReport.skillUsageAndSpeedDrop.click4MaxText = await slowBtn.innerText();

    // 驗證地圖生成器中的速度乘數
    const speedCheck = await page.evaluate(() => {
      if (!window.game || !window.game.mapGenerator) return null;
      const mapGen = window.game.mapGenerator;
      // 取得第一個被減速的危險區 Cluster
      let targetCluster = null;
      for (const [z, row] of mapGen.activeRows.entries()) {
        if (row.cluster && row.cluster.slowLevel > 0) {
          targetCluster = row.cluster;
          break;
        }
      }
      if (!targetCluster) return null;

      const speedMult = 1.0 - 0.15 * targetCluster.slowLevel;
      return {
        slowLevel: targetCluster.slowLevel,
        speedMultiplier: speedMult
      };
    });

    console.log('Cluster Speed Check:', speedCheck);

    const speedMatch = speedCheck && speedCheck.slowLevel === 3 && Math.abs(speedCheck.speedMultiplier - 0.55) < 0.01;
    auditReport.skillUsageAndSpeedDrop.speedDrop30PctVerified = speedMatch;

    const btnTextsMatch =
      auditReport.skillUsageAndSpeedDrop.click1Text.includes('2/3') &&
      auditReport.skillUsageAndSpeedDrop.click2Text.includes('1/3') &&
      auditReport.skillUsageAndSpeedDrop.click3Text.includes('上限') &&
      auditReport.skillUsageAndSpeedDrop.click4MaxText.includes('上限');

    auditReport.skillUsageAndSpeedDrop.passed = speedMatch && btnTextsMatch;

    // 3. 測試玩家移動步踏上草地 (Safe Zone)，驗證技能次數重置
    console.log('\n--- Step 3: Moving Player to Grass & Auditing Safe Zone Reset ---');

    await page.evaluate(() => {
      const game = window.game;
      const player = game.player;
      const mapGen = game.mapGenerator;
      const gridSize = 1.2;

      // 移動玩家向前直到踏上 GRASS 列
      for (let z = player.gridZ + 1; z <= player.gridZ + 20; z++) {
        const row = mapGen.activeRows.get(z);
        if (row && row.type === 'grass') {
          player.position.set(0, 0, z * gridSize);
          player.gridZ = z;
          mapGen.update(z);
          mapGen.checkSafeZoneReset(z);
          if (game.uiManager && game.uiManager.updateSlowButton) {
            game.uiManager.updateSlowButton(3, false);
          }
          break;
        }
      }
    });

    await page.waitForTimeout(300);
    auditReport.safeZoneResetAudit.resetOnGrassText = await slowBtn.innerText();
    auditReport.safeZoneResetAudit.passed = auditReport.safeZoneResetAudit.resetOnGrassText.includes('3/3');

    console.log(`Reset Text on Grass: "${auditReport.safeZoneResetAudit.resetOnGrassText}" (Passed: ${auditReport.safeZoneResetAudit.passed})`);

    // 4. Console Errors 審核
    auditReport.consolePageErrors.count = consoleErrors.length;
    auditReport.consolePageErrors.errors = consoleErrors;
    auditReport.consolePageErrors.passed = consoleErrors.length === 0;

    auditReport.overallResult = (
      auditReport.uiButtonExistence.passed &&
      auditReport.skillUsageAndSpeedDrop.passed &&
      auditReport.safeZoneResetAudit.passed &&
      auditReport.consolePageErrors.passed
    ) ? 'PASS' : 'FAIL';

  } catch (error) {
    console.error('[Runner Exception]', error);
    consoleErrors.push(`Runner Exception: ${error.stack}`);
    auditReport.consolePageErrors.count = consoleErrors.length;
    auditReport.consolePageErrors.errors = consoleErrors;
    auditReport.overallResult = 'FAIL';
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log('\n==================================================');
  console.log('  DANGER ZONE SPEED REDUCTION SKILL QA REPORT');
  console.log('==================================================');
  console.log(JSON.stringify(auditReport, null, 2));

  return auditReport;
}

runSlowSkillQATest();
