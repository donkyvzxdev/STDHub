// Mobile beauty check: home with icons + tour overlay, 390px.
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
        JSON.stringify({ onboarded: true, lang: 'pt', tourSeen: false }),
      )
    })
    await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    // Dismiss splash is automatic; tour overlay should be up (welcome).
    await page.getByRole('dialog', { name: /Bem-vindo/ }).waitFor()
    await page.screenshot({ path: 'mobile-tour.png' })
    // Advance to the notebook step (real tab switch + spotlight).
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.getByRole('dialog', { name: /Notebook/ }).waitFor()
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'mobile-tour-notebook.png' })
    console.log(`PAGEERRORS ${JSON.stringify(errors)}`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
