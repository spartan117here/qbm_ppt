import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = path.join(os.tmpdir(), 'chrome-frames-' + Date.now());

const proc = spawn(CHROME, [
  '--remote-debugging-port=9226',
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  'http://localhost:5173/'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:9226/json');
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
                const sampleVideo = (src) => new Promise(async (resolve) => {
                  const v = document.createElement('video');
                  v.src = src;
                  v.muted = true;
                  v.preload = 'auto';
                  await new Promise(r => { v.onloadeddata = r; });
                  const canvas = document.createElement('canvas');
                  canvas.width = 1920;
                  canvas.height = 1080;
                  const ctx = canvas.getContext('2d');
                  const results = [];
                  for (let t = 0.5; t <= 3.5; t += 0.5) {
                    v.currentTime = t;
                    await new Promise(r => { v.onseeked = r; });
                    ctx.drawImage(v, 0, 0, 1920, 1080);
                    const img = ctx.getImageData(0, 0, 1920, 1080);
                    let minX = 9999, maxX = 0, minY = 9999, maxY = 0;
                    for (let y = 0; y < 1080; y += 10) {
                      for (let x = 0; x < 1920; x += 10) {
                        const idx = (y * 1920 + x) * 4;
                        const r = img.data[idx], g = img.data[idx+1], b = img.data[idx+2];
                        const isGreen = (g > 90 && g > r * 1.15 && g > b * 1.15);
                        if (!isGreen) {
                          if (x < minX) minX = x;
                          if (x > maxX) maxX = x;
                          if (y < minY) minY = y;
                          if (y > maxY) maxY = y;
                        }
                      }
                    }
                    results.push({ t, minX, maxX, minY, maxY, center: ((minX + maxX) / 2).toFixed(0) });
                  }
                  resolve(results);
                });
                return {
                  next: await sampleVideo('/assets/agm/videos/swipe/swipe next.mp4'),
                  reverse: await sampleVideo('/assets/agm/videos/swipe/swipe reverse.mp4')
                };
              })()
            `
          }
        }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.result) {
          console.log('SAMPLE_RESULTS:', JSON.stringify(msg.result.result.value, null, 2));
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
