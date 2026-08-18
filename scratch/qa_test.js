import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 靜態 HTTP Server
function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(requestPath);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
        return;
      }
      const filePath = path.resolve(rootDir, `.${decodedPath}`);
      if (!filePath.startsWith(`${rootDir}${path.sep}`)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

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

async function runQAAudit() {
  const auditReport = {
    timestamp: new Date().toISOString(),
    gamePageLoaded: false,
    gddPageLoaded: false,
    gameLobbyUiCheck: false,
    casualGuideFlowCheck: false,
    gameplayStarted: false,
    canvasInitialized: false,
    consoleErrors: [],
    overallResult: 'FAIL'
  };

  const { server, port } = await createServer();
  let browser;

  try {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      console.log('[QA Browser] Launched Chrome');
    } catch {
      browser = await chromium.launch({ headless: true });
      console.log('[QA Browser] Launched Chromium');
    }

    const page = await browser.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[Console Error] ${msg.text()}`);
        auditReport.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      console.error(`[Page Error] ${err.message}`);
      auditReport.consoleErrors.push(err.message);
    });

    // 1. 驗證 GDD 開發文件頁面
    console.log('\n--- Step 1: Auditing Development Documentation (docs/過馬路GDD.html) ---');
    await page.goto(`http://localhost:${port}/docs/過馬路GDD.html`, { waitUntil: 'domcontentloaded' });
    const gddTitle = await page.title();
    const tocExists = (await page.locator('.toc').count()) > 0;
    auditReport.gddPageLoaded = gddTitle.includes('遊戲設計文件') && tocExists;
    console.log(`GDD Title: "${gddTitle}", TOC Present: ${tocExists}`);

    // 2. 驗證 3D 遊戲頁面
    console.log('\n--- Step 2: Auditing Game Prototype Page (index.html) ---');
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    auditReport.gamePageLoaded = true;

    // 3. 驗證大廳 UI (模式選擇、 Start 按鈕)
    const lobbyCard = page.locator('.lobby-card');
    const startBtn = page.locator('#btn-start');
    const modeCards = page.locator('.mode-card');

    auditReport.gameLobbyUiCheck = (await lobbyCard.isVisible()) && (await startBtn.isVisible()) && (await modeCards.count()) >= 2;
    console.log(`Lobby Card Visible: ${await lobbyCard.isVisible()}, Start Btn Visible: ${await startBtn.isVisible()}, Modes Count: ${await modeCards.count()}`);

    // 4. 驗證首次休閒模式圖卡；第 3 張才可開始遊戲
    const guideOverlay = page.locator('#casual-guide-overlay');
    const guideBack = page.locator('#btn-guide-back');
    const guideNext = page.locator('#btn-guide-next');
    const guideOpen = await guideOverlay.isVisible();
    const firstCardValid = guideOpen && (await guideNext.innerText()) === '下一步' && !(await guideBack.isVisible());
    await guideNext.click();
    const secondCardValid = (await guideNext.innerText()) === '下一步' && (await guideBack.isVisible());
    await guideNext.click();
    const thirdCardValid = (await guideNext.innerText()) === '開始遊戲' && (await guideBack.isVisible());
    auditReport.casualGuideFlowCheck = firstCardValid && secondCardValid && thirdCardValid;
    console.log(`Guide Flow: first=${firstCardValid}, second=${secondCardValid}, third=${thirdCardValid}`);

    // 5. 第 3 張開始遊戲後驗證 3D Canvas 容器
    await guideNext.click();
    await page.waitForTimeout(1500);
    const canvasContainer = page.locator('#canvas-container');
    const canvasEl = page.locator('canvas');
    auditReport.gameplayStarted = !(await lobbyCard.isVisible()) && !(await guideOverlay.isVisible());
    auditReport.canvasInitialized = (await canvasContainer.isVisible()) || (await canvasEl.count()) > 0;
    console.log(`Gameplay Overlay Hidden: ${auditReport.gameplayStarted}, Canvas Element Present: ${auditReport.canvasInitialized}`);

    if (auditReport.gddPageLoaded && auditReport.gamePageLoaded && auditReport.gameLobbyUiCheck && auditReport.casualGuideFlowCheck && auditReport.gameplayStarted && auditReport.consoleErrors.length === 0) {
      auditReport.overallResult = 'PASS';
    }
  } catch (err) {
    console.error(`[Runner Error] ${err.stack || err.message}`);
    auditReport.consoleErrors.push(err.message);
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log('\n==================================================');
  console.log('            QA AUDIT FINAL REPORT');
  console.log('==================================================');
  console.log(JSON.stringify(auditReport, null, 2));

  if (auditReport.overallResult !== 'PASS') {
    process.exit(1);
  }
}

runQAAudit();
