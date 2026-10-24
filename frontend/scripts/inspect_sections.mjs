import { spawn } from 'child_process'

async function inspect() {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,900'
  ])
  await new Promise(r => setTimeout(r, 1500))
  const res = await fetch('http://127.0.0.1:9228/json/new', { method: 'PUT' })
  const page = await res.json()
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(resolve => { ws.onopen = resolve })

  let msgId = 0
  const callbacks = new Map()
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.id && callbacks.has(data.id)) {
      callbacks.get(data.id)(data.result)
      callbacks.delete(data.id)
    }
  }
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = ++msgId
      callbacks.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: 'http://localhost:5173/' })
  await new Promise(r => setTimeout(r, 2000))

  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const sections = Array.from(document.querySelectorAll('section, footer'));
      return sections.map((s, idx) => {
        const rect = s.getBoundingClientRect();
        const inner = s.querySelector('.container-custom');
        const comp = window.getComputedStyle(s);
        const innerComp = inner ? window.getComputedStyle(inner) : null;
        const gridEl = s.querySelector('[style*="grid"]');
        const gridComp = gridEl ? window.getComputedStyle(gridEl) : null;

        return {
          idx,
          tag: s.tagName,
          className: s.className,
          bg: comp.backgroundImage !== 'none' ? comp.backgroundImage : comp.backgroundColor,
          sectionH: Math.round(rect.height),
          sectionW: Math.round(rect.width),
          innerW: inner ? Math.round(inner.getBoundingClientRect().width) : null,
          innerMaxW: innerComp ? innerComp.maxWidth : null,
          gridCols: gridComp ? gridComp.gridTemplateColumns : null,
          textSample: s.innerText.slice(0, 40).replace(/\\n/g, ' ')
        };
      });
    })()`,
    returnByValue: true
  })

  console.log(JSON.stringify(info.result.value, null, 2))
  ws.close()
  proc.kill()
}

inspect().catch(console.error)
