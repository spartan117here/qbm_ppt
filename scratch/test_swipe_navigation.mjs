import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9339;
const PROFILE_DIR = path.join(os.tmpdir(), 'chrome-agm-swipe-test-' + Date.now());

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
    this.eventListeners = new Map();
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
        } else if (msg.method) {
          const listeners = this.eventListeners.get(msg.method) || [];
          listeners.forEach((fn) => fn(msg.params));
        }
      };
    });
  }

  on(event, fn) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(fn);
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buffer);
    console.log(`Saved screenshot: ${filename}`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function run() {
  console.log('==================================================');
  console.log('AGM PRESENTER: SWIPE NAVIGATION VERIFICATION TEST');
  console.log('==================================================\n');

  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--window-size=1920,1080',
      '--autoplay-policy=no-user-gesture-required',
      'http://localhost:5173/',
    ],
    { stdio: 'ignore' }
  );

  await sleep(2500);

  try {
    const targetsRes = await fetch(`http://localhost:${DEBUG_PORT}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('5173')) || targets.find((t) => t.type === 'page');

    if (!pageTarget) {
      throw new Error('Could not find Chrome page target');
    }

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    const requestedUrls = [];
    await client.send('Network.enable');
    client.on('Network.requestWillBeSent', (params) => {
      requestedUrls.push(params.request.url);
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });

    console.log('Connected to Chrome via CDP (1920x1080 Viewport Active)');

    // Wait for initial load
    await sleep(3500);

    const artifactDir = 'C:\\Users\\Pothys\\.gemini\\antigravity-ide\\brain\\5495c5d1-b311-4979-8b4a-4cf5b18f5d32';

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Video Pool & Old Video Cleanup Audit
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: VIDEO POOL & OLD ASSET CLEANUP AUDIT ---');
    const poolCheck = await client.evaluate(`(() => {
      const videos = Array.from(document.querySelectorAll('.presenter-video-pool video')).map(v => v.src);
      const oldAssetsFound = videos.filter(s => s.toLowerCase().includes('swipin'));
      const swipeVideos = videos.filter(s => s.includes('/videos/swipe/'));
      return {
        totalPoolVideos: videos.length,
        allVideos: videos,
        oldAssetsFound,
        swipeVideos,
      };
    })()`);

    console.log(`Total preloaded videos in pool: ${poolCheck.totalPoolVideos}`);
    console.log(`Swipe videos in pool:`, poolCheck.swipeVideos);
    console.log(`Old swipe references ('swipin'):`, poolCheck.oldAssetsFound);

    if (poolCheck.oldAssetsFound.length > 0) {
      throw new Error(`FAILURE: Old swipe video found in video pool! ${JSON.stringify(poolCheck.oldAssetsFound)}`);
    }

    const hasNext = poolCheck.swipeVideos.some(s => s.includes('swipe%20next.mp4') || s.includes('swipe next.mp4'));
    const hasReverse = poolCheck.swipeVideos.some(s => s.includes('swipe%20reverse.mp4') || s.includes('swipe reverse.mp4'));

    if (!hasNext || !hasReverse || poolCheck.swipeVideos.length !== 2) {
      throw new Error(`FAILURE: Video pool swipe videos incorrect! Found: ${JSON.stringify(poolCheck.swipeVideos)}`);
    }
    console.log('✓ Video pool strictly contains ONLY `swipe next.mp4` and `swipe reverse.mp4`');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Initial State Verification (Slide 1)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: INITIAL STATE (SLIDE 1) ---');
    const initialState = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      const zl = document.getElementById('zone-left')?.getBoundingClientRect();
      const zc = document.getElementById('zone-center')?.getBoundingClientRect();
      const zr = document.getElementById('zone-right')?.getBoundingClientRect();
      const act = document.querySelector('.presenter-stage-actor')?.getBoundingClientRect();
      const pdf = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
      return {
        state,
        counter,
        zoneLeft: { left: zl?.left, right: zl?.right, width: zl?.width },
        zoneCenter: { left: zc?.left, right: zc?.right, width: zc?.width },
        zoneRight: { left: zr?.left, right: zr?.right, width: zr?.width },
        actor: { left: act?.left, right: act?.right, width: act?.width },
        pdf: { left: pdf?.left, right: pdf?.right, width: pdf?.width },
      };
    })()`);

    console.log(`Initial Counter: "${initialState.counter}"`);
    console.log(`Active Video: ${initialState.state?.activeVideo?.name} (${initialState.state?.activeVideo?.category})`);
    console.log(`Presenter Anchor: ${initialState.state?.currentAnchor}`);
    console.log(`Zone Left: [${initialState.zoneLeft.left} to ${initialState.zoneLeft.right}], Zone Center: [${initialState.zoneCenter.left} to ${initialState.zoneCenter.right}]`);
    console.log(`Actor Position: [${initialState.actor.left} to ${initialState.actor.right}], PDF: [${initialState.pdf.left} to ${initialState.pdf.right}]`);

    const initialOverlap = !(initialState.actor.right <= initialState.pdf.left || initialState.actor.left >= initialState.pdf.right);
    console.log(`Initial Presenter-PDF Overlap: ${initialOverlap ? 'YES (FAIL)' : '0px NO OVERLAP (PASS)'}`);
    if (initialOverlap) throw new Error('Overlap detected on Slide 1!');

    await client.captureScreenshot(path.join(artifactDir, 'test_01_slide1_idle.png'));

    // ─────────────────────────────────────────────────────────────
    // TEST 3: RIGHT CLICK Navigation (Triggers swipe next.mp4)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: RIGHT CLICK FORWARD NAVIGATION (SWIPE NEXT) ---');
    console.log('Clicking right side of screen...');

    await client.evaluate(`(() => {
      const stage = document.querySelector('.presentation-stage-container');
      const rect = stage.getBoundingClientRect();
      const clickX = rect.left + rect.width * 0.8;
      const clickY = rect.top + rect.height * 0.5;
      const clickEvent = new MouseEvent('click', {
        clientX: clickX,
        clientY: clickY,
        bubbles: true,
        cancelable: true,
      });
      stage.dispatchEvent(clickEvent);
    })()`);

    await sleep(200);

    const swipingNextState = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const actor = document.querySelector('.presenter-stage-actor');
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      const pdf = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
      const act = actor?.getBoundingClientRect();
      return {
        state,
        counter,
        actorClass: actor?.className,
        actor: { left: act?.left, right: act?.right },
        pdf: { left: pdf?.left, right: pdf?.right },
      };
    })()`);

    console.log(`State after right click: ${swipingNextState.state?.state}`);
    console.log(`Active Video Name: "${swipingNextState.state?.activeVideo?.name}" (ID: ${swipingNextState.state?.activeVideo?.id})`);
    console.log(`Active Video Src: "${swipingNextState.state?.activeVideo?.src}"`);
    console.log(`Actor Classes: "${swipingNextState.actorClass}"`);
    console.log(`Counter during pre-trigger: "${swipingNextState.counter}" (Slide 1 still visible)`);

    if (swipingNextState.state?.activeVideo?.id !== 'SWIPE_NEXT') {
      throw new Error(`FAILURE: Right click did not activate SWIPE_NEXT! Got: ${swipingNextState.state?.activeVideo?.id}`);
    }
    if (swipingNextState.state?.activeVideo?.name !== 'swipe next.mp4') {
      throw new Error(`FAILURE: Video name is not swipe next.mp4! Got: ${swipingNextState.state?.activeVideo?.name}`);
    }
    console.log('✓ Correct video: `swipe next.mp4` triggered on forward navigation');

    // Check overlap during swipe
    const swipeOverlap = !(swipingNextState.actor.right <= swipingNextState.pdf.left || swipingNextState.actor.left >= swipingNextState.pdf.right);
    console.log(`Swipe Presenter-PDF Overlap: ${swipeOverlap ? 'YES (FAIL)' : '0px NO OVERLAP (PASS)'}`);
    if (swipeOverlap) throw new Error('Overlap detected during swipe next transition!');

    await client.captureScreenshot(path.join(artifactDir, 'test_02_swiping_next_action.png'));

    // Wait for holographic swipe apex (~2.2s from transition start)
    console.log('Waiting for holographic gesture apex (t = 2.2s)...');
    await sleep(2200);
    await client.captureScreenshot(path.join(artifactDir, 'test_02_holographic_apex.png'));

    const postSwipeApex = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      return { state, counter };
    })()`);

    console.log(`Counter at gesture apex: "${postSwipeApex.counter}" (displayedSlideIndex: ${postSwipeApex.state?.displayedSlideIndex})`);
    if (postSwipeApex.counter !== '02 / 10' || postSwipeApex.state?.displayedSlideIndex !== 1) {
      throw new Error(`FAILURE: Slide did not advance to 02 / 10 at 2.2s apex! Got: ${postSwipeApex.counter}`);
    }
    console.log('✓ Slide advanced to 02 / 10 exactly at holographic interaction apex (2.2s)');

    // Wait for swipe clip to end (~1.8s remaining) and settle on Slide 2
    console.log('Waiting for swipe clip to complete and cut to Slide 2 explain video...');
    await sleep(2200);

    const slide2Settled = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      const act = document.querySelector('.presenter-stage-actor')?.getBoundingClientRect();
      const pdf = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
      return {
        state,
        counter,
        actor: { left: act?.left, right: act?.right },
        pdf: { left: pdf?.left, right: pdf?.right },
      };
    })()`);

    console.log(`Slide 2 Settled: State=${slide2Settled.state?.state}, Video=${slide2Settled.state?.activeVideo?.name}, Anchor=${slide2Settled.state?.currentAnchor}`);
    console.log(`Slide 2 Actor: [${slide2Settled.actor.left} to ${slide2Settled.actor.right}], PDF: [${slide2Settled.pdf.left} to ${slide2Settled.pdf.right}]`);

    const slide2Overlap = !(slide2Settled.actor.right <= slide2Settled.pdf.left || slide2Settled.actor.left >= slide2Settled.pdf.right);
    console.log(`Slide 2 Overlap: ${slide2Overlap ? 'YES (FAIL)' : '0px NO OVERLAP (PASS)'}`);
    if (slide2Overlap) throw new Error('Overlap detected on Slide 2!');

    await client.captureScreenshot(path.join(artifactDir, 'test_03_slide2_idle.png'));

    // ─────────────────────────────────────────────────────────────
    // TEST 4: LEFT CLICK Navigation (Triggers swipe reverse.mp4)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: LEFT CLICK BACKWARD NAVIGATION (SWIPE REVERSE) ---');
    console.log('Clicking left side of screen...');

    await client.evaluate(`(() => {
      const stage = document.querySelector('.presentation-stage-container');
      const rect = stage.getBoundingClientRect();
      const clickX = rect.left + rect.width * 0.2;
      const clickY = rect.top + rect.height * 0.5;
      const clickEvent = new MouseEvent('click', {
        clientX: clickX,
        clientY: clickY,
        bubbles: true,
        cancelable: true,
      });
      stage.dispatchEvent(clickEvent);
    })()`);

    await sleep(200);

    const swipingReverseState = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const actor = document.querySelector('.presenter-stage-actor');
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      const pdf = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
      const act = actor?.getBoundingClientRect();
      return {
        state,
        counter,
        actorClass: actor?.className,
        actor: { left: act?.left, right: act?.right },
        pdf: { left: pdf?.left, right: pdf?.right },
      };
    })()`);

    console.log(`State after left click: ${swipingReverseState.state?.state}`);
    console.log(`Active Video Name: "${swipingReverseState.state?.activeVideo?.name}" (ID: ${swipingReverseState.state?.activeVideo?.id})`);
    console.log(`Active Video Src: "${swipingReverseState.state?.activeVideo?.src}"`);
    console.log(`Actor Classes: "${swipingReverseState.actorClass}"`);
    console.log(`Counter during pre-trigger: "${swipingReverseState.counter}" (Slide 2 still visible)`);

    if (swipingReverseState.state?.activeVideo?.id !== 'SWIPE_REVERSE') {
      throw new Error(`FAILURE: Left click did not activate SWIPE_REVERSE! Got: ${swipingReverseState.state?.activeVideo?.id}`);
    }
    if (swipingReverseState.state?.activeVideo?.name !== 'swipe reverse.mp4') {
      throw new Error(`FAILURE: Video name is not swipe reverse.mp4! Got: ${swipingReverseState.state?.activeVideo?.name}`);
    }
    console.log('✓ Correct video: `swipe reverse.mp4` triggered on backward navigation');

    // Check overlap during reverse swipe
    const reverseOverlap = !(swipingReverseState.actor.right <= swipingReverseState.pdf.left || swipingReverseState.actor.left >= swipingReverseState.pdf.right);
    console.log(`Reverse Swipe Presenter-PDF Overlap: ${reverseOverlap ? 'YES (FAIL)' : '0px NO OVERLAP (PASS)'}`);
    if (reverseOverlap) throw new Error('Overlap detected during swipe reverse transition!');

    await client.captureScreenshot(path.join(artifactDir, 'test_04_swiping_reverse_action.png'));

    // Wait for remote button press moment (~1.5s from transition start)
    console.log('Waiting for remote-button press moment (t = 1.5s)...');
    await sleep(1500);
    await client.captureScreenshot(path.join(artifactDir, 'test_04_button_press_moment.png'));

    const postReverseApex = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      return { state, counter };
    })()`);

    console.log(`Counter at button press: "${postReverseApex.counter}" (displayedSlideIndex: ${postReverseApex.state?.displayedSlideIndex})`);
    if (postReverseApex.counter !== '01 / 10' || postReverseApex.state?.displayedSlideIndex !== 0) {
      throw new Error(`FAILURE: Slide did not revert to 01 / 10 at 1.5s button press! Got: ${postReverseApex.counter}`);
    }
    console.log('✓ Slide reverted to 01 / 10 exactly at remote button-press moment (1.5s)');

    // Wait for reverse swipe clip to finish (~2.5s remaining) and settle back on Slide 1
    console.log('Waiting for reverse swipe clip to complete and cut to Slide 1 explain video...');
    await sleep(2600);

    const slide1Returned = await client.evaluate(`(() => {
      const state = window.__AGM_STATE__;
      const counter = document.querySelector('.slide-counter-overlay')?.textContent?.trim();
      const act = document.querySelector('.presenter-stage-actor')?.getBoundingClientRect();
      const pdf = document.querySelector('.pdf-slide-container-16-9')?.getBoundingClientRect();
      return {
        state,
        counter,
        actor: { left: act?.left, right: act?.right },
        pdf: { left: pdf?.left, right: pdf?.right },
      };
    })()`);

    console.log(`Returned to Slide 1: State=${slide1Returned.state?.state}, Video=${slide1Returned.state?.activeVideo?.name}, Anchor=${slide1Returned.state?.currentAnchor}`);
    const returnOverlap = !(slide1Returned.actor.right <= slide1Returned.pdf.left || slide1Returned.actor.left >= slide1Returned.pdf.right);
    console.log(`Slide 1 Return Overlap: ${returnOverlap ? 'YES (FAIL)' : '0px NO OVERLAP (PASS)'}`);
    if (returnOverlap) throw new Error('Overlap detected on return to Slide 1!');

    await client.captureScreenshot(path.join(artifactDir, 'test_05_returned_slide1_idle.png'));

    // ─────────────────────────────────────────────────────────────
    // TEST 5: KEYBOARD NAVIGATION (Right Arrow & Left Arrow)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: KEYBOARD NAVIGATION VALIDATION ---');
    console.log('Dispatching Right Arrow key...');
    await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }))`);
    await sleep(200);

    const keyNextState = await client.evaluate(`(() => window.__AGM_STATE__)()`);
    console.log(`ArrowRight Active Video: ${keyNextState?.activeVideo?.name} (ID: ${keyNextState?.activeVideo?.id})`);
    if (keyNextState?.activeVideo?.id !== 'SWIPE_NEXT') {
      throw new Error(`FAILURE: Right Arrow did not trigger SWIPE_NEXT! Got: ${keyNextState?.activeVideo?.id}`);
    }
    console.log('✓ Right Arrow properly triggers `swipe next.mp4`');

    // Wait for transition to complete to Slide 2
    await sleep(4000);

    console.log('Dispatching Left Arrow key...');
    await client.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true }))`);
    await sleep(200);

    const keyPrevState = await client.evaluate(`(() => window.__AGM_STATE__)()`);
    console.log(`ArrowLeft Active Video: ${keyPrevState?.activeVideo?.name} (ID: ${keyPrevState?.activeVideo?.id})`);
    if (keyPrevState?.activeVideo?.id !== 'SWIPE_REVERSE') {
      throw new Error(`FAILURE: Left Arrow did not trigger SWIPE_REVERSE! Got: ${keyPrevState?.activeVideo?.id}`);
    }
    console.log('✓ Left Arrow properly triggers `swipe reverse.mp4`');

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Zero Network Requests for Old Swipe Videos
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: NETWORK REQUESTS AUDIT ---');
    const oldNetworkRequests = requestedUrls.filter(u => u.toLowerCase().includes('swipin'));
    console.log(`Total HTTP requests made: ${requestedUrls.length}`);
    console.log(`Old swipe video requests ('swipin'): ${oldNetworkRequests.length}`);
    if (oldNetworkRequests.length > 0) {
      throw new Error(`FAILURE: Network requests made for old swipe assets: ${JSON.stringify(oldNetworkRequests)}`);
    }
    console.log('✓ Zero requests for old swipe files (`swipin 1`, `swipin 2`, `swipin 3`)');

    console.log('\n================================================================');
    console.log('SUCCESS! ALL SWIPE NAVIGATION & NON-OVERLAP TESTS PASSED (100%)');
    console.log('================================================================\n');

    client.close();
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exitCode = 1;
  } finally {
    chromeProcess.kill();
    try {
      fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
    } catch (_) {}
  }
}

run();
