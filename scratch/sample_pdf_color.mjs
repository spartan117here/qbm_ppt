const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
import('child_process').then(async ({ spawn }) => {
  const p = spawn(CHROME_PATH, ['--remote-debugging-port=9346', '--headless=new', 'http://localhost:5173/']);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://localhost:9346/json');
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

  await new Promise(r => setTimeout(r, 3000));

  const results = [];
  for (let slide = 1; slide <= 5; slide++) {
    await send('Runtime.evaluate', {
      expression: `window.__TEST_JUMP__(${slide - 1})`
    });
    await new Promise(r => setTimeout(r, 500));
    const sample = await send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector('.presentation-slide-canvas');
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const p = ctx.getImageData(30, 30, 1, 1).data;
        const hex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
        return { slide: ${slide}, hex: hex(p[0], p[1], p[2]), rgb: [p[0], p[1], p[2]] };
      })()`,
      returnByValue: true,
    });
    results.push(sample.result.value);
  }

  console.log('Slide background samples:', results);
  p.kill();
  process.exit(0);
});
