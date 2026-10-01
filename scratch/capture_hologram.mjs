import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const proc = spawn(CHROME_PATH, [
  '--remote-debugging-port=9228',
  '--headless=new',
  '--window-size=1365,768',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu',
  '--no-sandbox',
  'http://localhost:5173/'
]);

await new Promise(r => setTimeout(r, 2000));
const res = await fetch('http://localhost:9228/json');
const tabs = await res.json();
const tab = tabs.find(t => t.type === 'page' && t.url.includes('5173')) || tabs[0];
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

let id = 1;
const send = (m, p) => new Promise(r => {
  const cur = id++;
  const h = (e) => {
    const d = JSON.parse(e.data);
    if (d.id === cur) { ws.removeEventListener('message', h); r(d.result); }
  };
  ws.addEventListener('message', h);
  ws.send(JSON.stringify({ id: cur, method: m, params: p }));
});

await send('Page.enable', {});
await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 768, deviceScaleFactor: 1, mobile: false });
await new Promise(r => setTimeout(r, 3500));

// Click to trigger next
await send('Runtime.evaluate', {
  expression: `(() => {
    const s = document.querySelector('.presentation-stage-container');
    const r = s.getBoundingClientRect();
    s.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.8, clientY: r.top + r.height * 0.5, bubbles: true }));
  })()`,
  returnByValue: true
});

// Wait 2.2 seconds for the holographic screen
await new Promise(r => setTimeout(r, 2200));

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('scratch/stage_1365x768_hologram_2_2s.png', Buffer.from(shot.data, 'base64'));
console.log('Saved hologram screenshot');

ws.close();
proc.kill();
