import { spawn } from 'child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const proc = spawn(CHROME_PATH, [
  '--remote-debugging-port=9225',
  '--headless=new',
  '--window-size=1365,768',
  '--no-sandbox',
  'http://localhost:5173/'
]);

await new Promise(r => setTimeout(r, 2000));
const res = await fetch('http://localhost:9225/json');
const tabs = await res.json();
const ws = new WebSocket(tabs[0].webSocketDebuggerUrl);
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

const testCss = async (css) => {
  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('.presentation-slide-canvas');
      if (!c) return { error: 'no canvas' };
      c.style.cssText = "${css}";
      const rect = c.getBoundingClientRect();
      return JSON.stringify({ w: rect.width, h: rect.height, ratio: rect.width / rect.height });
    })()`,
    returnByValue: true,
    awaitPromise: true
  });
  return r.result.value;
};

console.log('Test 1 (width: 100%, height: auto, max-height: 100%, aspect-ratio: 16/9):',
  await testCss('width: 100%; height: auto; max-height: 100%; aspect-ratio: 16/9;'));

console.log('Test 2 (width: auto, height: 100%, max-width: 100%, aspect-ratio: 16/9):',
  await testCss('width: auto; height: 100%; max-width: 100%; aspect-ratio: 16/9;'));

console.log('Test 3 (max-width: 100%; max-height: 100%; aspect-ratio: 16/9; width: 100%; height: auto;):',
  await testCss('max-width: 100%; max-height: 100%; aspect-ratio: 16/9; width: 100%; height: auto;'));

console.log('Test 4 (width: min(100%, calc(768px * 16 / 9)); aspect-ratio: 16/9; height: auto; max-height: 100%):',
  await testCss('width: min(100%, calc(100vh * 16 / 9)); height: auto; max-height: 100%; aspect-ratio: 16/9;'));

ws.close();
proc.kill();
