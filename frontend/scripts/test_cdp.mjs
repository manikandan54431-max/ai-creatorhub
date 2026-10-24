// Minimal CDP client using Node 24 native WebSocket
import { spawn } from 'child_process'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

class ChromeCDP {
  constructor(port = 9222) {
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
      '--autoplay-policy=no-user-gesture-required',
      '--allow-insecure-localhost'
    ])
    await new Promise(r => setTimeout(r, 1500))

    // Create a new tab via PUT
    const res = await fetch(`http://127.0.0.1:${this.port}/json/new`, { method: 'PUT' })
    const page = await res.json()
    console.log('Opened new tab:', page.id)

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

  async navigate(url) {
    await this.send('Page.navigate', { url })
    await new Promise(r => setTimeout(r, 2000))
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    return res.result?.value
  }

  async close() {
    if (this.ws) this.ws.close()
    if (this.proc) this.proc.kill()
  }
}

async function test() {
  const cdp = new ChromeCDP(9222)
  try {
    await cdp.launch()
    await cdp.navigate('http://localhost:5173/login')
    const title = await cdp.eval('document.title')
    console.log('Page title:', title)
    const url = await cdp.eval('window.location.href')
    console.log('Page URL:', url)
  } catch (err) {
    console.error('CDP error:', err)
  } finally {
    await cdp.close()
  }
}

test()
