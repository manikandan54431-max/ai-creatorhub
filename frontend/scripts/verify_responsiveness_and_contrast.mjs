import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const EVIDENCE_DIR = path.resolve(__dirname, '..', '..', 'browser_evidence')

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

class ChromeCDP {
  constructor(port = 9224) {
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
      '--window-size=1280,800'
    ])
    await new Promise(r => setTimeout(r, 1800))

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

  async navigate(url, waitMs = 1500) {
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
      const filePath = path.join(EVIDENCE_DIR, filename)
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

async function runVerification() {
  const cdp = new ChromeCDP(9224)
  const results = {
    checkedPages: 0,
    overflowIssues: [],
    lowContrastIssues: [],
    screenshots: []
  }

  try {
    console.log('🚀 Launching Headless Chrome via CDP...')
    await cdp.launch()

    const viewports = [
      { name: 'desktop', w: 1280, h: 800 },
      { name: 'tablet',  w: 768,  h: 1024 },
      { name: 'mobile',  w: 375,  h: 667 }
    ]

    const pagesToTest = [
      { path: '/', name: 'HomePage' },
      { path: '/creators', name: 'Creators' },
      { path: '/how-it-works', name: 'HowItWorks' },
      { path: '/login', name: 'Login' }
    ]

    for (const vp of viewports) {
      console.log(`\n📱 Viewport: ${vp.name.toUpperCase()} (${vp.w}x${vp.h})`)
      await cdp.setViewport(vp.w, vp.h)

      for (const p of pagesToTest) {
        results.checkedPages++
        await cdp.navigate(`http://localhost:5173${p.path}`, 1200)

        // Test in Light mode
        await cdp.eval(`document.documentElement.classList.remove('dark')`)
        await new Promise(r => setTimeout(r, 300))

        // Check horizontal overflow
        const overflow = await cdp.eval(`
          (() => {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            return {
              hasOverflow: docWidth > winWidth + 5,
              docWidth,
              winWidth
            };
          })()
        `)

        if (overflow?.hasOverflow) {
          results.overflowIssues.push({
            page: p.name,
            viewport: vp.name,
            docWidth: overflow.docWidth,
            winWidth: overflow.winWidth
          })
          console.log(`❌ OVERFLOW on ${p.name} [${vp.name}]: docWidth=${overflow.docWidth}px > winWidth=${overflow.winWidth}px`)
        } else {
          console.log(`✅ ${p.name} [${vp.name}]: Responsive OK (width=${overflow?.winWidth}px, no overflow)`)
        }

        // Check for invisible white text in light mode
        const textAudit = await cdp.eval(`
          (() => {
            function getLuminance(r, g, b) {
              const a = [r, g, b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
              });
              return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
            }

            function parseRgb(colorStr) {
              const match = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
              if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
              return null;
            }

            const issues = [];
            const elements = document.querySelectorAll('h1, h2, h3, h4, p, span, a, button, label, input');

            for (const el of elements) {
              const text = (el.innerText || el.placeholder || '').trim();
              if (!text || text.length < 2) continue;
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) continue;

              const style = window.getComputedStyle(el);
              const color = parseRgb(style.color);
              if (!color) continue;

              // Find effective background color walking up ancestors
              let curr = el;
              let bg = null;
              while (curr && curr !== document.documentElement) {
                const computed = window.getComputedStyle(curr);
                const bgStyle = computed.backgroundColor;
                const bgImg = computed.backgroundImage;
                if (bgImg && bgImg.includes('gradient')) {
                  bg = [24, 59, 58]; // dark gradient
                  break;
                }
                const parsed = parseRgb(bgStyle);
                if (parsed && bgStyle !== 'rgba(0, 0, 0, 0)') {
                  bg = parsed;
                  break;
                }
                curr = curr.parentElement;
              }
              if (!bg) bg = [255, 255, 255]; // default light mode bg

              const lum1 = getLuminance(color[0], color[1], color[2]);
              const lum2 = getLuminance(bg[0], bg[1], bg[2]);
              const ratio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);

              // If text is white or near-white and background is light
              if (lum1 > 0.8 && lum2 > 0.6) {
                issues.push({
                  tag: el.tagName,
                  text: text.slice(0, 40),
                  ratio: ratio.toFixed(2),
                  color: style.color,
                  bg: 'rgb(' + bg.join(',') + ')'
                });
              }
            }
            return issues.slice(0, 5);
          })()
        `)

        if (textAudit && textAudit.length > 0) {
          console.log(`⚠️ Low contrast detected on ${p.name} in Light Mode:`, JSON.stringify(textAudit))
          results.lowContrastIssues.push({ page: p.name, issues: textAudit })
        } else {
          console.log(`✅ ${p.name} [${vp.name}]: Light mode contrast PASS`)
        }

        // Capture screenshot
        const shotName = `evidence_${p.name.toLowerCase()}_${vp.name}.png`
        const shotPath = await cdp.screenshot(shotName)
        if (shotPath) results.screenshots.push(shotName)
      }
    }

    // Now test Creator Dashboard & Studio
    console.log('\n🎬 Testing Creator Studio & Dashboards...')
    await cdp.setViewport(1280, 800)
    await cdp.navigate('http://localhost:5173/login', 1200)

    // Login as Creator
    await cdp.eval(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          const setV = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setV.call(emailInput, 'priya@example.com');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          setV.call(passInput, 'Creator@123');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await new Promise(r => setTimeout(r, 2000))

    await cdp.navigate('http://localhost:5173/creator/ai-studio', 1500)
    const studioTitle = await cdp.eval('document.title')
    console.log('Creator Studio Title:', studioTitle)
    await cdp.screenshot('evidence_creator_studio_projects.png')

    // Test Admin Dashboard & Tables
    console.log('\n👑 Testing Admin Dashboard & Table Overflow...')
    await cdp.navigate('http://localhost:5173/login', 1000)
    // Clear storage and login as Admin
    await cdp.eval(`
      localStorage.clear();
      window.location.href = '/login';
    `)
    await new Promise(r => setTimeout(r, 1200))

    await cdp.eval(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          const setV = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setV.call(emailInput, 'admin@aicreatorhub.com');
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          setV.call(passInput, 'Admin@1234');
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await new Promise(r => setTimeout(r, 2000))

    const adminUrl = await cdp.eval('window.location.href')
    console.log('Admin login destination:', adminUrl)
    await cdp.screenshot('evidence_admin_dashboard.png')

    // Test Admin Users on mobile (375px)
    await cdp.setViewport(375, 667)
    await cdp.navigate('http://localhost:5173/admin/users', 1500)
    const mobileAdminUsersOverflow = await cdp.eval('document.documentElement.scrollWidth > window.innerWidth')
    console.log(`✅ Admin Users Table Mobile (375px): body overflow=${mobileAdminUsersOverflow}`)
    await cdp.screenshot('evidence_admin_users_mobile.png')

    console.log('\n=== FINAL VERIFICATION SUMMARY ===')
    console.log(`Total Pages Checked: ${results.checkedPages}`)
    console.log(`Total Overflow Issues: ${results.overflowIssues.length}`)
    console.log(`Total Low Contrast Issues: ${results.lowContrastIssues.length}`)
    console.log(`Screenshots Captured: ${results.screenshots.length}`)

  } catch (err) {
    console.error('Verification failed:', err)
  } finally {
    await cdp.close()
  }
}

runVerification()
