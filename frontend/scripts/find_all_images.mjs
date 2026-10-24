import { spawn } from 'child_process'

async function inspectPages() {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1440,900'
  ])
  await new Promise(r => setTimeout(r, 1500))
  const res = await fetch('http://127.0.0.1:9229/json/new', { method: 'PUT' })
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

  const urls = [
    '/creators',
    '/creators/7',
    '/how-it-works',
    '/about',
    '/blog',
    '/careers',
    '/contact',
    '/support',
    '/help-center',
    '/privacy-policy',
    '/terms-of-service'
  ]

  for (const u of urls) {
    await send('Page.navigate', { url: `http://localhost:5173${u}` })
    await new Promise(r => setTimeout(r, 1500))

    const data = await send('Runtime.evaluate', {
      expression: `(() => {
        // Find all elements with background image or large background sections near bottom
        const all = Array.from(document.querySelectorAll('*'));
        const images = [];
        all.forEach(el => {
          const comp = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (comp.backgroundImage && comp.backgroundImage !== 'none' && !comp.backgroundImage.includes('gradient')) {
            images.push({
              tag: el.tagName,
              className: el.className,
              bgImg: comp.backgroundImage,
              rect: { top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height), width: Math.round(rect.width) }
            });
          }
          if (el.tagName === 'IMG') {
            images.push({
              tag: 'IMG',
              src: el.src,
              rect: { top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height), width: Math.round(rect.width) }
            });
          }
        });
        return {
          url: location.pathname,
          docH: document.documentElement.scrollHeight,
          docW: document.documentElement.scrollWidth,
          images
        };
      })()`,
      returnByValue: true
    })

    console.log(`URL: ${u}`)
    console.log(JSON.stringify(data.result.value, null, 2))
  }

  ws.close()
  proc.kill()
}

inspectPages().catch(console.error)
