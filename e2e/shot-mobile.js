// One-shot mobile check: screenshots http://localhost:4174/ in Edge,
// mobile viewport, collects page errors.
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
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'mobile-splash.png' })
    // Dismiss splash -> language step.
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'mobile-lang.png' })
    console.log(`PAGEERRORS ${JSON.stringify(errors)}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
