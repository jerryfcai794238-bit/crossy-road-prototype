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

async function runNoConsecutiveLilyPadQATest() {
  const auditReport = {
    timestamp: new Date().toISOString(),
    mapGeneration: {
      highestZGenerated: 0,
      targetZ: 150,
      passed: false
    },
    consecutiveLilyPadAudit: {
      consecutiveLilyPadPairsFound: 0,
      maxConsecutiveLilyPadCount: 0,
      passed: false
    },
    multiRiverSectionAudit: {
      totalMultiRiverSections: 0,
      allLilyPadMultiRiverSections: 0,
      sectionDetails: [],
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

    // 2. 模擬玩家向前移動生成 150+ 層地圖 (Z: 0 -> 160)
    console.log('\n--- Step 2: Generating 150+ map layers & auditing river rows ---');

    const testExecution = await page.evaluate(async () => {
      if (!window.game || !window.game.mapGenerator) return null;
      const game = window.game;
      const mapGen = game.mapGenerator;
      const player = game.player;
      const gridSize = 1.2;

      const sampledRowsMap = new Map();

      // 從 Z = 0 移動前進至 Z = 160
      for (let z = 0; z <= 160; z++) {
        player.position.z = z * gridSize;
        player.gridZ = z;
        player.targetGridZ = z;
        player.isDead = false;
        player.isJumping = false;

        mapGen.update(z);

        const activeRows = mapGen.getActiveRows();
        activeRows.forEach((row, rZ) => {
          if (row.type === 'river') {
            const logsData = (row.logs || []).map(l => ({
              isStationary: l.isStationary === true,
              length: l.length || 1,
              x: l.mesh ? l.mesh.position.x : 0
            }));

            const isLily = row.isLilyPadRow === true || row.isPureLilyPadRow === true || logsData.some(l => l.isStationary);

            sampledRowsMap.set(rZ, {
              z: rZ,
              type: row.type,
              isLilyPadRow: isLily,
              isMovingLogRow: !isLily,
              logs: logsData
            });
          }
        });
      }

      return {
        highestZ: mapGen.highestZGenerated,
        riverRows: Array.from(sampledRowsMap.values()).sort((a, b) => a.z - b.z)
      };
    });

    if (!testExecution) {
      throw new Error('Failed to evaluate game state.');
    }

    auditReport.mapGeneration.highestZGenerated = testExecution.highestZ;
    auditReport.mapGeneration.passed = testExecution.highestZ >= 150;

    const riverRows = testExecution.riverRows;
    const riverMap = new Map();
    riverRows.forEach(r => riverMap.set(r.z, r));

    // 1. 檢查連續相鄰睡蓮列 (consecutive lily pad rows)
    let consecutiveLilyPadPairs = 0;
    let maxConsecutiveLily = 0;
    let currentConsecutive = 0;

    for (let i = 0; i < riverRows.length; i++) {
      const r = riverRows[i];
      if (r.isLilyPadRow) {
        if (i > 0 && riverRows[i - 1].isLilyPadRow && riverRows[i - 1].z === r.z - 1) {
          currentConsecutive++;
          consecutiveLilyPadPairs++;
          console.error(`[FAIL] Consecutive Lily Pad Rows detected at z=${r.z - 1} and z=${r.z}!`);
        } else {
          currentConsecutive = 1;
        }
        if (currentConsecutive > maxConsecutiveLily) {
          maxConsecutiveLily = currentConsecutive;
        }
      } else {
        currentConsecutive = 0;
      }
    }

    auditReport.consecutiveLilyPadAudit.consecutiveLilyPadPairsFound = consecutiveLilyPadPairs;
    auditReport.consecutiveLilyPadAudit.maxConsecutiveLilyPadCount = maxConsecutiveLily;
    auditReport.consecutiveLilyPadAudit.passed = consecutiveLilyPadPairs === 0 && maxConsecutiveLily <= 1;

    // 2. 將連續的河流列分組為「河道區域 Section」，審核多連河道全睡蓮情況
    const riverSections = [];
    let currentSection = [];

    for (let i = 0; i < riverRows.length; i++) {
      const row = riverRows[i];
      if (currentSection.length === 0) {
        currentSection.push(row);
      } else {
        const lastRow = currentSection[currentSection.length - 1];
        if (row.z === lastRow.z + 1) {
          currentSection.push(row);
        } else {
          riverSections.push([...currentSection]);
          currentSection = [row];
        }
      }
    }
    if (currentSection.length > 0) {
      riverSections.push(currentSection);
    }

    let totalMultiSections = 0;
    let allLilyPadMultiSections = 0;
    const sectionDetails = [];

    riverSections.forEach((sec, idx) => {
      const startZ = sec[0].z;
      const endZ = sec[sec.length - 1].z;
      const rowCount = sec.length;

      const lilyCount = sec.filter(r => r.isLilyPadRow).length;
      const movingCount = sec.filter(r => r.isMovingLogRow).length;

      const isAllLilyPad = rowCount >= 2 && lilyCount === rowCount;

      if (rowCount >= 2) {
        totalMultiSections++;
        if (isAllLilyPad) {
          allLilyPadMultiSections++;
          console.error(`[FAIL] Multi-river section (Z=${startZ}~${endZ}, rows=${rowCount}) is 100% Lily Pads!`);
        }
      }

      sectionDetails.push({
        sectionIndex: idx + 1,
        startZ,
        endZ,
        rowCount,
        lilyCount,
        movingCount,
        isAllLilyPad,
        pass: !isAllLilyPad
      });
    });

    auditReport.multiRiverSectionAudit.totalMultiRiverSections = totalMultiSections;
    auditReport.multiRiverSectionAudit.allLilyPadMultiRiverSections = allLilyPadMultiSections;
    auditReport.multiRiverSectionAudit.sectionDetails = sectionDetails;
    auditReport.multiRiverSectionAudit.passed = allLilyPadMultiSections === 0;

    auditReport.consolePageErrors.count = consoleErrors.length;
    auditReport.consolePageErrors.errors = consoleErrors;
    auditReport.consolePageErrors.passed = consoleErrors.length === 0;

    auditReport.overallResult = (
      auditReport.mapGeneration.passed &&
      auditReport.consecutiveLilyPadAudit.passed &&
      auditReport.multiRiverSectionAudit.passed &&
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
  console.log('  NO CONSECUTIVE LILY-PAD ROWS QA REPORT');
  console.log('==================================================');
  console.log(JSON.stringify(auditReport, null, 2));

  return auditReport;
}

runNoConsecutiveLilyPadQATest();
