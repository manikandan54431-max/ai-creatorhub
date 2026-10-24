import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = path.resolve(__dirname, '..', '..', 'browser_evidence', 'debug')

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

class ChromeCDP {
  constructor(port = 9225) {
    this.port = port
    this.proc = null
    this.ws = null
    this.msgId = 0
    this.callbacks = new Map()
  }

  async launch() {
    this.proc = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-insecure-localhost',
      '--window-size=1440,900'
    ])
    await new Promise(r => setTimeout(r, 2000))

    const res = await fetch(`http://127.0.0.1:${this.port}/json/new`, { method: 'PUT' })
    const page = await res.json()
    this.ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id)
        this.callbacks.delete(data.id)
        if (data.error) reject(data.error)
        else resolve(data.result)
      }
    }

    await this.send('Page.enable')
    await this.send('Runtime.enable')
    await this.send('DOM.enable')
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId
      this.callbacks.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    })
  }

  async navigate(url, waitMs = 2500) {
    await this.send('Page.navigate', { url })
    await new Promise(r => setTimeout(r, waitMs))
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    return res.result?.value
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' })
    if (res?.data) {
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
      return filePath
    }
    return null
  }

  async close() {
    if (this.ws) this.ws.close()
    if (this.proc) this.proc.kill()
  }
}

async function run() {
  const cdp = new ChromeCDP(9225)
  try {
    console.log('Launching Chrome...')
    await cdp.launch()

    const pages = [
      { path: '/', name: 'home' },
      { path: '/how-it-works', name: 'howitworks' },
      { path: '/about', name: 'about' },
      { path: '/creators', name: 'creators' },
      { path: '/contact', name: 'contact' },
      { path: '/careers', name: 'careers' }
    ]

    for (const p of pages) {
      // 1. Desktop 1440
      await cdp.setViewport(1440, 900)
      await cdp.navigate(`http://localhost:5173${p.path}`, 2500)

      // Ensure splash is removed
      await cdp.eval(`(() => {
        const s = document.getElementById('splash');
        if (s) s.remove();
      })()`)

      // Capture top
      await cdp.screenshot(`${p.name}_desktop_top.png`)

      // Scroll to bottom
      await cdp.eval(`window.scrollTo(0, document.body.scrollHeight)`)
      await new Promise(r => setTimeout(r, 600))
      await cdp.screenshot(`${p.name}_desktop_bottom.png`)

      // Inspect sections near bottom and their layout/width
      const bottomInfo = await cdp.eval(`(() => {
        const sections = Array.from(document.querySelectorAll('section, footer, div[style*="background"], div[class*="container"]'));
        const docWidth = document.documentElement.clientWidth;
        const results = [];
        sections.slice(-6).forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          const comp = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            className: el.className,
            width: rect.width,
            docWidth: docWidth,
            maxWidth: comp.maxWidth,
            display: comp.display,
            flexDirection: comp.flexDirection,
            gridTemplateColumns: comp.gridTemplateColumns,
            backgroundImage: comp.backgroundImage,
            backgroundSize: comp.backgroundSize,
            backgroundPosition: comp.backgroundPosition,
            margin: comp.margin,
            padding: comp.padding
          });
        });
        return results;
      })()`)

      console.log(`\n=== PAGE: ${p.name} (Desktop 1440px) ===`)
      console.log(JSON.stringify(bottomInfo, null, 2))

      // 2. Mobile 390
      await cdp.setViewport(390, 844)
      await new Promise(r => setTimeout(r, 600))
      await cdp.screenshot(`${p.name}_mobile_bottom.png`)
    }

    console.log('Inspection completed!')
  } catch (err) {
    console.error('Error during inspection:', err)
  } finally {
    await cdp.close()
  }
}

run()
