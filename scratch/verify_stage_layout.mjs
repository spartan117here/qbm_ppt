import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9226;
const PROFILE_DIR = path.join(os.tmpdir(), 'chrome-layout-test-' + Date.now());

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
    console.log(`Saved screenshot: ${filename}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('=== Verifying AGM Presentation Stage Layout at 1365x768 & 1920x1080 ===');

  // Spawn Chrome with 1365x768
  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--headless=new',
    '--window-size=1365,768',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-gpu',
    '--no-sandbox',
    'http://localhost:5173/',
  ];

  const chromeProc = spawn(CHROME_PATH, chromeArgs, { stdio: 'ignore' });

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
    } catch {}
  }

  if (!wsUrl) {
    console.error('Could not connect to Chrome');
    chromeProc.kill();
    process.exit(1);
  }

  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('DOM.enable');

  // Set Emulated viewport to 1365x768
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1365,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('Waiting for PDF & video to load...');
  await sleep(4000);

  // Measure bounding boxes at 1365x768
  const metrics1365 = await client.eval(`
    (() => {
      const rail = document.getElementById('presenter-rail');
      const viewport = document.getElementById('slide-viewport');
      const pptCanvas = document.querySelector('.presentation-slide-canvas');
      const actorCanvas = document.querySelector('.presenter-output-canvas');
      const container = document.querySelector('.presentation-stage-container');

      const railRect = rail ? rail.getBoundingClientRect() : null;
      const vpRect = viewport ? viewport.getBoundingClientRect() : null;
      const pptRect = pptCanvas ? pptCanvas.getBoundingClientRect() : null;
      const actorRect = actorCanvas ? actorCanvas.getBoundingClientRect() : null;
      const contRect = container ? container.getBoundingClientRect() : null;

      const railStyle = rail ? window.getComputedStyle(rail) : null;
      const contStyle = container ? window.getComputedStyle(container) : null;
      const vpStyle = viewport ? window.getComputedStyle(viewport) : null;

      return {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        container: contRect ? { width: contRect.width, height: contRect.height } : null,
        rail: railRect ? { left: railRect.left, right: railRect.right, width: railRect.width, height: railRect.height } : null,
        slideViewport: vpRect ? { left: vpRect.left, right: vpRect.right, width: vpRect.width, height: vpRect.height } : null,
        pptCanvas: pptRect ? { left: pptRect.left, right: pptRect.right, top: pptRect.top, bottom: pptRect.bottom, width: pptRect.width, height: pptRect.height, aspect: pptRect.width / pptRect.height } : null,
        actorCanvas: actorRect ? { left: actorRect.left, right: actorRect.right, width: actorRect.width, height: actorRect.height } : null,
        styles: {
          railBg: railStyle ? railStyle.backgroundColor : null,
          contBg: contStyle ? contStyle.backgroundColor : null,
          railOverflow: railStyle ? railStyle.overflow : null,
          vpBg: vpStyle ? vpStyle.backgroundColor : null
        }
      };
    })()
  `);

  console.log('--- Metrics at 1365x768 ---');
  console.log(JSON.stringify(metrics1365, null, 2));

  // Compute percentages
  const railPct1365 = (metrics1365.rail.width / metrics1365.windowWidth) * 100;
  const pptVpPct1365 = (metrics1365.slideViewport.width / metrics1365.windowWidth) * 100;
  const pptCanvasPct1365 = (metrics1365.pptCanvas.width / metrics1365.windowWidth) * 100;

  console.log(`Rail width %: ${railPct1365.toFixed(1)}% (Target: ~12-18%)`);
  console.log(`Slide viewport width %: ${pptVpPct1365.toFixed(1)}% (Target: ~82-88%)`);
  console.log(`PPT canvas width %: ${pptCanvasPct1365.toFixed(1)}%`);
  console.log(`PPT Aspect Ratio: ${metrics1365.pptCanvas.aspect.toFixed(4)} (Expected 16:9 = ${(16/9).toFixed(4)})`);
  console.log(`Rail right edge: ${metrics1365.rail.right}px, Slide viewport left edge: ${metrics1365.slideViewport.left}px, PPT canvas left edge: ${metrics1365.pptCanvas.left}px`);
  console.log(`Overlap between Rail and PPT canvas: ${Math.max(0, metrics1365.rail.right - metrics1365.pptCanvas.left)}px`);

  // Screenshot Slide 1 idle at 1365x768
  const shotDir = path.join(process.cwd(), 'scratch');
  const shot1 = path.join(shotDir, 'stage_1365x768_slide1.png');
  await client.captureScreenshot(shot1);

  // Trigger NEXT slide navigation (click right half of stage)
  console.log('Triggering NEXT navigation (click right half)...');
  await client.eval(`
    (() => {
      const stage = document.querySelector('.presentation-stage-container');
      const rect = stage.getBoundingClientRect();
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width * 0.8,
        clientY: rect.top + rect.height * 0.5,
        bubbles: true,
        cancelable: true,
        view: window
      });
      stage.dispatchEvent(clickEvent);
    })()
  `);

  // Wait 1.2s to capture holographic swipe animation
  await sleep(1200);
  const shotSwipeNext = path.join(shotDir, 'stage_1365x768_swipe_next.png');
  await client.captureScreenshot(shotSwipeNext);

  // Wait for slide 2 to settle
  await sleep(4000);
  const shot2 = path.join(shotDir, 'stage_1365x768_slide2.png');
  await client.captureScreenshot(shot2);

  // Trigger PREV slide navigation (click left half of stage)
  console.log('Triggering PREV navigation (click left half)...');
  await client.eval(`
    (() => {
      const stage = document.querySelector('.presentation-stage-container');
      const rect = stage.getBoundingClientRect();
      const clickEvent = new MouseEvent('click', {
        clientX: rect.left + rect.width * 0.3,
        clientY: rect.top + rect.height * 0.5,
        bubbles: true,
        cancelable: true,
        view: window
      });
      stage.dispatchEvent(clickEvent);
    })()
  `);

  // Wait 1.0s to capture swipe reverse animation
  await sleep(1000);
  const shotSwipeRev = path.join(shotDir, 'stage_1365x768_swipe_reverse.png');
  await client.captureScreenshot(shotSwipeRev);

  // Now test 1920x1080 fullscreen
  console.log('\n--- Switching to 1920x1080 ---');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(3500);

  const metrics1920 = await client.eval(`
    (() => {
      const rail = document.getElementById('presenter-rail');
      const viewport = document.getElementById('slide-viewport');
      const pptCanvas = document.querySelector('.presentation-slide-canvas');
      const railRect = rail.getBoundingClientRect();
      const vpRect = viewport.getBoundingClientRect();
      const pptRect = pptCanvas.getBoundingClientRect();
      return {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        rail: { width: railRect.width, right: railRect.right },
        slideViewport: { width: vpRect.width, left: vpRect.left },
        pptCanvas: { width: pptRect.width, height: pptRect.height, left: pptRect.left, right: pptRect.right, aspect: pptRect.width / pptRect.height }
      };
    })()
  `);

  console.log('--- Metrics at 1920x1080 ---');
  console.log(JSON.stringify(metrics1920, null, 2));
  const railPct1920 = (metrics1920.rail.width / metrics1920.windowWidth) * 100;
  const pptVpPct1920 = (metrics1920.slideViewport.width / metrics1920.windowWidth) * 100;
  const pptCanvasPct1920 = (metrics1920.pptCanvas.width / metrics1920.windowWidth) * 100;
  console.log(`Rail width %: ${railPct1920.toFixed(1)}%`);
  console.log(`Slide viewport width %: ${pptVpPct1920.toFixed(1)}%`);
  console.log(`PPT canvas width %: ${pptCanvasPct1920.toFixed(1)}%`);
  console.log(`PPT Aspect Ratio: ${metrics1920.pptCanvas.aspect.toFixed(4)}`);
  console.log(`Overlap between Rail and PPT canvas: ${Math.max(0, metrics1920.rail.right - metrics1920.pptCanvas.left)}px`);

  const shot1920 = path.join(shotDir, 'stage_1920x1080_slide1.png');
  await client.captureScreenshot(shot1920);

  client.close();
  chromeProc.kill();
  console.log('Verification finished successfully!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
