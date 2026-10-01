const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
import('child_process').then(async ({ spawn }) => {
  const p = spawn(CHROME_PATH, ['--remote-debugging-port=9340', '--headless=new', 'about:blank']);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://localhost:9340/json');
  const tabs = await res.json();
  const tab = tabs.find(t => t.type === 'page');
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  // Load an HTML page with both videos
  await send('Page.navigate', {
    url: 'http://localhost:5173/'
  });
  await new Promise(r => setTimeout(r, 2500));

  // Inspect video files directly
  const videoDetails = await send('Runtime.evaluate', {
    expression: `(async () => {
      const loadVideo = (src) => new Promise((resolve) => {
        const v = document.createElement('video');
        v.src = src;
        v.muted = true;
        v.preload = 'auto';
        v.onloadedmetadata = () => resolve({ src, duration: v.duration, w: v.videoWidth, h: v.videoHeight });
      });
      const v1 = await loadVideo('/assets/agm/videos/swipe/swipe next.mp4');
      const v2 = await loadVideo('/assets/agm/videos/swipe/swipe reverse.mp4');
      return { v1, v2 };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Video details:', videoDetails.result.value);

  // Capture frame of swipe next at 2.5s
  await send('Runtime.evaluate', {
    expression: `(async () => {
      const v = document.createElement('video');
      v.src = '/assets/agm/videos/swipe/swipe next.mp4';
      v.muted = true;
      document.body.appendChild(v);
      v.currentTime = 2.5;
      await new Promise(r => v.onseeked = r);
      const c = document.createElement('canvas');
      c.width = 1920; c.height = 1080;
      c.id = 'debug-canvas';
      c.style.position = 'fixed';
      c.style.top = '0';
      c.style.left = '0';
      c.style.zIndex = '99999';
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0);
      document.body.appendChild(c);
    })()`,
    awaitPromise: true,
  });

  await new Promise(r => setTimeout(r, 500));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('fs');
  fs.writeFileSync('C:\\Users\\Pothys\\.gemini\\antigravity-ide\\brain\\5495c5d1-b311-4979-8b4a-4cf5b18f5d32\\inspect_swipe_next_2_5s.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved inspect_swipe_next_2_5s.png');

  // Capture frame of swipe reverse at 2.5s
  await send('Runtime.evaluate', {
    expression: `(async () => {
      const v = document.createElement('video');
      v.src = '/assets/agm/videos/swipe/swipe reverse.mp4';
      v.muted = true;
      v.currentTime = 2.5;
      await new Promise(r => v.onseeked = r);
      const c = document.getElementById('debug-canvas');
      const ctx = c.getContext('2d');
      ctx.drawImage(v, 0, 0);
    })()`,
    awaitPromise: true,
  });

  await new Promise(r => setTimeout(r, 500));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:\\Users\\Pothys\\.gemini\\antigravity-ide\\brain\\5495c5d1-b311-4979-8b4a-4cf5b18f5d32\\inspect_swipe_reverse_2_5s.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved inspect_swipe_reverse_2_5s.png');

  p.kill();
  process.exit(0);
});
