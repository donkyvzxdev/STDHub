// One-shot mobile home check.
const { chromium } = require('@playwright/test')

const EDGE =
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE })
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'stdhub.mobile.settings',
        JSON.stringify({ onboarded: true, lang: 'en' }),
      )
      window.localStorage.setItem(
        'stdhub.mobile.calendar',
        JSON.stringify([
          {
            id: 'e1',
            title: 'Math test',
            date: new Date().toISOString().slice(0, 10),
            time: '08:00',
            notes: '',
            remindMinutes: -1,
          },
        ]),
      )
    })
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'mobile-home.png', fullPage: true })
    console.log(`PAGEERRORS ${JSON.stringify(errors)}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
