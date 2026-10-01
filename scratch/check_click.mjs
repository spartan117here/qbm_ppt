const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
import('child_process').then(async ({ spawn }) => {
  const p = spawn(CHROME_PATH, ['--remote-debugging-port=9338', '--headless=new', 'http://localhost:5173/']);
  await new Promise(r => setTimeout(r, 2000));
  const res = await fetch('http://localhost:9338/json');
  const tabs = await res.json();
  const tab = tabs.find(t => t.type === 'page' && t.url.includes('5173'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Emulation.setDeviceMetricsOverride', params: { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false } }));
  };
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', data.params.type, data.params.args.map(a => a.value || a.description));
    }
  };

  await new Promise(r => setTimeout(r, 3000));

  // Now trigger click on right side
  console.log('Dispatching click...');
  ws.send(JSON.stringify({
    id: 10,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const stage = document.querySelector('.presentation-stage-container');
        const rect = stage.getBoundingClientRect();
        console.log('Stage rect:', rect.width, rect.height);
        const clickEvent = new MouseEvent('click', {
          clientX: rect.left + rect.width * 0.8,
          clientY: rect.top + rect.height * 0.5,
          bubbles: true,
          cancelable: true,
        });
        stage.dispatchEvent(clickEvent);
      })()`
    }
  }));

  await new Promise(r => setTimeout(r, 1000));

  p.kill();
  process.exit(0);
});
