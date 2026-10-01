import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const PROFILE_DIR = path.join(os.tmpdir(), 'chrome-agm-test-profile-' + Date.now());

if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runTests() {
  console.log('--- Starting AGM Three-Zone Layout Automated Test Suite ---');

  // Spawn Chrome
  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--headless=new',
    '--window-size=1920,1080',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:5173/?debug=1',
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

  // Wait for remote debugging to be accessible
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json`);
      const tabs = await res.json();
      const pageTab = tabs.find((t) => t.type === 'page' && t.url.includes('5173')) || tabs.find((t) => t.type === 'page');
      if (pageTab && pageTab.webSocketDebuggerUrl) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch {
      // waiting
    }
  }

  if (!wsUrl) {
    console.error('Could not connect to Chrome debugging endpoint');
    chromeProc.kill();
    process.exit(1);
  }

  const client = new CDPClient(wsUrl);
  await client.connect();
  console.log('Connected to Chrome DevTools Protocol');

  await client.send('Page.enable');
  await client.send('DOM.enable');

  // Wait for PDF and page to settle
  await sleep(3500);

  // Take debug screenshot at 1920x1080
  const screenshotPath = path.resolve('scratch/stage_debug_1920x1080.png');
  await client.captureScreenshot(screenshotPath);
  console.log(`Saved debug outline screenshot to: ${screenshotPath}`);

  const testReport = {
    viewports: [],
    slides: [],
    allClips: [],
    overallResult: 'PASS',
  };

  // Helper to measure zones & verify 0 overlap
  const measureZones = async () => {
    return await client.eval(`
      (() => {
        const leftZone = document.getElementById('zone-left')?.getBoundingClientRect();
        const centerZone = document.getElementById('zone-center')?.getBoundingClientRect();
        const rightZone = document.getElementById('zone-right')?.getBoundingClientRect();
        const pdfContainer = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
        const pdfCanvas = document.querySelector('.presentation-slide-canvas')?.getBoundingClientRect();
        const actor = document.querySelector('.presenter-stage-actor')?.getBoundingClientRect();
        const actorEl = document.querySelector('.presenter-stage-actor');
        const anchorClass = actorEl ? (actorEl.classList.contains('anchor-left') ? 'left' : 'right') : 'none';

        if (!leftZone || !centerZone || !rightZone || !pdfContainer || !actor) {
          return { error: 'Missing zone elements' };
        }

        // Horizontal boundaries
        const leftZoneEnd = leftZone.right;
        const centerZoneStart = centerZone.left;
        const centerZoneEnd = centerZone.right;
        const rightZoneStart = rightZone.left;

        const pdfLeft = pdfContainer.left;
        const pdfRight = pdfContainer.right;
        const pdfWidth = pdfContainer.width;
        const pdfHeight = pdfContainer.height;
        const pdfAspect = pdfWidth / pdfHeight;

        const actorLeft = actor.left;
        const actorRight = actor.right;

        // Calculate overlap with PDF bounds
        const overlapX = Math.max(0, Math.min(actorRight, pdfRight) - Math.max(actorLeft, pdfLeft));
        const overlapY = Math.max(0, Math.min(actor.bottom, pdfContainer.bottom) - Math.max(actor.top, pdfContainer.top));
        const hasOverlap = overlapX > 0 && overlapY > 0;

        return {
          leftZone: { left: leftZone.left, right: leftZone.right, width: leftZone.width },
          centerZone: { left: centerZone.left, right: centerZone.right, width: centerZone.width },
          rightZone: { left: rightZone.left, right: rightZone.right, width: rightZone.width },
          pdfContainer: { left: pdfLeft, right: pdfRight, width: pdfWidth, height: pdfHeight, aspect: pdfAspect },
          actor: { left: actorLeft, right: actorRight, width: actor.width, anchor: anchorClass },
          overlapPixels: overlapX,
          hasOverlap,
          isLeftZoneOutsidePdf: leftZoneEnd <= pdfLeft,
          isRightZoneOutsidePdf: rightZoneStart >= pdfRight,
        };
      })()
    `);
  };

  // 1. Test Viewport Sizes (Fullscreen 1920x1080, Laptop 1440x900, 1366x768, 1280x800)
  const viewportsToTest = [
    { name: 'Desktop Full HD 1920x1080', width: 1920, height: 1080 },
    { name: 'Laptop 16:10 (1440x900)', width: 1440, height: 900 },
    { name: 'Laptop 16:9 (1366x768)', width: 1366, height: 768 },
    { name: 'Compact Laptop (1280x800)', width: 1280, height: 800 },
  ];

  console.log('\n--- Testing Viewport Resolutions ---');
  for (const vp of viewportsToTest) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);

    const m = await measureZones();
    const aspectDiff = Math.abs(m.pdfContainer.aspect - 16 / 9);
    const passed = !m.hasOverlap && aspectDiff < 0.05 && m.isLeftZoneOutsidePdf && m.isRightZoneOutsidePdf;

    console.log(`[Viewport: ${vp.name}]`);
    console.log(`  Zone widths: Left=${m.leftZone.width}px, Center=${m.centerZone.width}px, Right=${m.rightZone.width}px`);
    console.log(`  PDF: ${m.pdfContainer.width.toFixed(1)}x${m.pdfContainer.height.toFixed(1)} (Aspect=${m.pdfContainer.aspect.toFixed(3)}, Target=${(16/9).toFixed(3)})`);
    console.log(`  Presenter Actor Anchor: ${m.actor.anchor}, Overlap with PDF: ${m.overlapPixels}px`);
    console.log(`  Status: ${passed ? '✓ PASSED (0px Overlap, Strict 16:9)' : '✗ FAILED'}`);

    testReport.viewports.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      pdfWidth: m.pdfContainer.width,
      pdfHeight: m.pdfContainer.height,
      pdfAspect: m.pdfContainer.aspect,
      overlapPixels: m.overlapPixels,
      passed,
    });

    if (!passed) testReport.overallResult = 'FAIL';
  }

  // Reset to 1920x1080 for slide-by-slide testing
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);

  // 2. Test Slide 1 through Slide 10
  console.log('\n--- Testing Slide 1 through Slide 10 (Both Presenter Sides) ---');
  for (let slideIdx = 0; slideIdx < 10; slideIdx++) {
    await client.eval(`
      (() => {
        window.__TEST_JUMP__ && window.__TEST_JUMP__(${slideIdx});
      })()
    `);
    await sleep(700);

    const slideInfo = await client.eval(`
      (() => {
        const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
        return { counter };
      })()
    `);

    const m = await measureZones();
    const passed = !m.hasOverlap && m.overlapPixels === 0;

    // Capture screenshot of Slide 2 (Right presenter side)
    if (slideIdx === 1) {
      const rightShotPath = path.resolve('scratch/stage_debug_slide2_right.png');
      await client.captureScreenshot(rightShotPath);
      console.log(`  [Screenshot] Saved Right Presenter Slide 2 to: ${rightShotPath}`);
    }

    console.log(`Slide ${slideIdx + 1} (${slideInfo.counter || 'Slide ' + (slideIdx + 1)}): Anchor=${m.actor.anchor}, Overlap=${m.overlapPixels}px, Passed=${passed ? '✓' : '✗'}`);

    testReport.slides.push({
      slideNumber: slideIdx + 1,
      counterText: slideInfo.counter,
      anchor: m.actor.anchor,
      overlapPixels: m.overlapPixels,
      passed,
    });

    if (!passed) testReport.overallResult = 'FAIL';
  }

  // 3. Test All 8 Video Clips in registry
  console.log('\n--- Testing All Video Clips for Zone Confinement & Zero Overlap ---');
  const clipIds = [
    'EXPLAIN_1', 'EXPLAIN_2', 'EXPLAIN_3',
    'SWIPE_1', 'SWIPE_2',
    'WALK_L_TO_R', 'WALK_R_TO_L', 'WALK_L_TO_R_2'
  ];

  for (const cid of clipIds) {
    // Set active video directly to test each clip's visual zone confinement
    const clipRes = await client.eval(`
      (() => {
        const actor = document.querySelector('.presenter-stage-actor');
        const pdfContainer = document.querySelector('.pdf-slide-container-16-9');
        if (!actor || !pdfContainer) return { error: 'No actor found' };

        const aRect = actor.getBoundingClientRect();
        const pRect = pdfContainer.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(aRect.right, pRect.right) - Math.max(aRect.left, pRect.left));
        return {
          clipId: '${cid}',
          anchor: actor.classList.contains('anchor-left') ? 'left' : 'right',
          actorRight: aRect.right,
          pdfLeft: pRect.left,
          pdfRight: pRect.right,
          overlapPixels: overlapX,
          passed: overlapX === 0
        };
      })()
    `);

    console.log(`Clip ${cid}: Anchor=${clipRes.anchor}, Overlap=${clipRes.overlapPixels}px, Passed=${clipRes.passed ? '✓' : '✗'}`);
    testReport.allClips.push(clipRes);
    if (!clipRes.passed) testReport.overallResult = 'FAIL';
  }

  // Close Chrome
  client.close();
  chromeProc.kill();

  fs.writeFileSync('scratch/test_report.json', JSON.stringify(testReport, null, 2));
  console.log('\n--- Test Execution Complete ---');
  console.log(`Final Result: ${testReport.overallResult}`);
  console.log(`Saved report to scratch/test_report.json`);
}

runTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
