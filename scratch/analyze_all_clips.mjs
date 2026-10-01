const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
import fs from 'fs';

const clips = [
  { id: 'EXPLAIN_1', src: '/assets/agm/videos/explain/explain 1.mp4', sampleTime: 2.0 },
  { id: 'EXPLAIN_2', src: '/assets/agm/videos/explain/explain 2.mp4', sampleTime: 2.0 },
  { id: 'EXPLAIN_3', src: '/assets/agm/videos/explain/explain 3.mp4', sampleTime: 2.0 },
  { id: 'SWIPE_NEXT', src: '/assets/agm/videos/swipe/swipe next.mp4', sampleTime: 2.2 },
  { id: 'SWIPE_REVERSE', src: '/assets/agm/videos/swipe/swipe reverse.mp4', sampleTime: 1.5 },
  { id: 'WALK_L_TO_R', src: '/assets/agm/videos/walk/walkin left to right.mp4', sampleTime: 1.5 },
  { id: 'WALK_R_TO_L', src: '/assets/agm/videos/walk/walkin right to left.mp4', sampleTime: 1.5 },
  { id: 'WALK_L_TO_R_2', src: '/assets/agm/videos/walk/walkin left to right 2.mp4', sampleTime: 1.5 },
];

import('child_process').then(async ({ spawn }) => {
  const p = spawn(CHROME_PATH, ['--remote-debugging-port=9347', '--headless=new', 'http://localhost:5173/']);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://localhost:9347/json');
  const tabs = await res.json();
  const tab = tabs.find(t => t.type === 'page' && t.url.includes('5173'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const handler = (e) => {
      const data = JSON.parse(e.data);
      if (data.id === id) {
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  const results = {};

  for (const clip of clips) {
    const data = await send('Runtime.evaluate', {
      expression: `(async () => {
        const v = document.createElement('video');
        v.src = '${clip.src}';
        v.muted = true;
        v.preload = 'auto';
        await new Promise(r => v.onloadedmetadata = r);
        v.currentTime = ${clip.sampleTime};
        await new Promise(r => v.onseeked = r);

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(v, 0, 0);

        // Downsample to 480x270 for quick silhouette scanning
        const sCanvas = document.createElement('canvas');
        sCanvas.width = 480;
        sCanvas.height = 270;
        const sCtx = sCanvas.getContext('2d');
        sCtx.drawImage(canvas, 0, 0, 480, 270);
        const imgData = sCtx.getImageData(0, 0, 480, 270).data;

        // Detect non-green pixels (green key approx: G > 100 and G > R*1.2 and G > B*1.2)
        let minX = 480, maxX = 0, minY = 270, maxY = 0;
        let count = 0;

        for (let y = 0; y < 270; y++) {
          for (let x = 0; x < 480; x++) {
            const idx = (y * 480 + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const isGreen = g > 80 && g > r * 1.15 && g > b * 1.15;
            if (!isGreen) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              count++;
            }
          }
        }

        const scale = 1920 / 480;
        return {
          minX: Math.round(minX * scale),
          maxX: Math.round(maxX * scale),
          minY: Math.round(minY * scale),
          maxY: Math.round(maxY * scale),
          width: Math.round((maxX - minX) * scale),
          height: Math.round((maxY - minY) * scale),
          centerX: Math.round(((minX + maxX) / 2) * scale),
          percentCenterX: (((minX + maxX) / 2) / 480 * 100).toFixed(1),
        };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    results[clip.id] = data.result.value;
  }

  console.log('Silhouette Analysis for all clips:');
  console.log(JSON.stringify(results, null, 2));

  p.kill();
  process.exit(0);
});
