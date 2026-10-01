import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = path.join(os.tmpdir(), 'chrome-meta-' + Date.now());

const proc = spawn(CHROME, [
  '--remote-debugging-port=9225',
  `--user-data-dir=${profile}`,
  '--headless=new',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  'http://localhost:5173/'
]);

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:9225/json');
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
                const getMeta = (src) => new Promise(res => {
                  const v = document.createElement('video');
                  v.src = src;
                  v.preload = 'auto';
                  v.onloadedmetadata = () => res({ src, duration: v.duration, width: v.videoWidth, height: v.videoHeight });
                  v.onerror = (e) => res({ src, error: true });
                });
                const n = await getMeta('/assets/agm/videos/swipe/swipe next.mp4');
                const r = await getMeta('/assets/agm/videos/swipe/swipe reverse.mp4');
                return { next: n, reverse: r };
              })()
            `
          }
        }));
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.result) {
          console.log('VIDEO_META:', JSON.stringify(msg.result.result.value, null, 2));
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
