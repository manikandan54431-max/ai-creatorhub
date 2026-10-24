import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = path.resolve(__dirname, '..', '..', 'browser_evidence', 'debug')

class ChromeCDP {
  constructor(port = 9226) {
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

  async fullScreenshot(url, filename, width = 1440) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768
    })

    await this.send('Page.navigate', { url })
    await new Promise(r => setTimeout(r, 2500))

    await this.send('Runtime.evaluate', {
      expression: `(() => {
        const s = document.getElementById('splash');
        if (s) s.remove();
      })()`
    })

    const layout = await this.send('Page.getLayoutMetrics')
    const contentSize = layout.contentSize

    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: Math.ceil(contentSize.height),
      deviceScaleFactor: 1,
      mobile: width < 768
    })

    await new Promise(r => setTimeout(r, 500))

    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true
    })

    const filePath = path.join(OUT_DIR, filename)
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'))
    console.log(`Saved full page screenshot: ${filename} (width: ${width}, height: ${contentSize.height})`)
    return filePath
  }

  async close() {
    if (this.ws) this.ws.close()
    if (this.proc) this.proc.kill()
  }
}

async function run() {
  const cdp = new ChromeCDP(9226)
  try {
    await cdp.launch()
    await cdp.fullScreenshot('http://localhost:5173/', 'home_full_desktop.png', 1440)
    await cdp.fullScreenshot('http://localhost:5173/', 'home_full_mobile.png', 390)
    await cdp.fullScreenshot('http://localhost:5173/how-it-works', 'howitworks_full_desktop.png', 1440)
    await cdp.fullScreenshot('http://localhost:5173/about', 'about_full_desktop.png', 1440)
  } finally {
    await cdp.close()
  }
}

run()
