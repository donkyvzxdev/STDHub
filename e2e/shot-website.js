// One-shot website desktop check: screenshots http://localhost:4173/ in Edge.
const { chromium } = require('@playwright/test')

const EDGE =
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE })
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'website-desktop.png', fullPage: true })
    console.log(`SECTIONS hero=${await page.locator('#top').count()} features=${await page.locator('#features').count()} compare=${await page.locator('#compare').count()} pricing=${await page.locator('#pricing').count()} faq=${await page.locator('#faq').count()} cta=${await page.locator('#get-started').count()}`)
    console.log(`PAGEERRORS ${JSON.stringify(errors)}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
