import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = path.join(os.tmpdir(), 'chrome-swipe-inspect-' + Date.now());

const proc = spawn(CHROME, [
  '--remote-debugging-port=9227',
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  'http://localhost:5173/'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:9227/json');
    const tabs = await res.json();
    const tab = tabs.find(t => t.type === 'page' && t.url.includes('5173')) || tabs.find(t => t.type === 'page');
    if (tab) {
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            awaitPromise: true,
            returnByValue: true,
            expression: `
              (async () => {
                const captureFrames = async (src, name, times) => {
                  const v = document.createElement('video');
                  v.src = src;
                  v.muted = true;
                  v.preload = 'auto';
                  await new Promise(r => { v.onloadeddata = r; });
                  const c = document.createElement('canvas');
                  c.width = 480;
                  c.height = 270;
                  const ctx = c.getContext('2d');
                  const frames = [];
                  for (const t of times) {
                    v.currentTime = t;
                    await new Promise(r => { v.onseeked = r; });
                    ctx.drawImage(v, 0, 0, 480, 270);
                    frames.push({ t, data: c.toDataURL('image/jpeg', 0.7) });
                  }
                  return frames;
                };
                const nextFrames = await captureFrames('/assets/agm/videos/swipe/swipe next.mp4', 'next', [1.0, 1.5, 1.8, 2.0, 2.2, 2.5, 2.8, 3.0]);
                const revFrames = await captureFrames('/assets/agm/videos/swipe/swipe reverse.mp4', 'rev', [0.8, 1.2, 1.5, 1.8, 2.0, 2.2, 2.5, 2.8]);
                return { nextFrames, revFrames };
              })()
            `
          }
        }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.result && msg.result.result.value) {
          const val = msg.result.result.value;
          if (!fs.existsSync('scratch/swipe_frames')) fs.mkdirSync('scratch/swipe_frames', { recursive: true });
          val.nextFrames.forEach(f => {
            const b64 = f.data.replace(/^data:image\/jpeg;base64,/, '');
            fs.writeFileSync(`scratch/swipe_frames/next_${f.t}s.jpg`, Buffer.from(b64, 'base64'));
          });
          val.revFrames.forEach(f => {
            const b64 = f.data.replace(/^data:image\/jpeg;base64,/, '');
            fs.writeFileSync(`scratch/swipe_frames/rev_${f.t}s.jpg`, Buffer.from(b64, 'base64'));
          });
          console.log('FRAMES_WRITTEN');
          ws.close();
          proc.kill();
          process.exit(0);
        }
      };
    }
  } catch (err) {
    console.error(err);
    proc.kill();
  }
}, 2000);
