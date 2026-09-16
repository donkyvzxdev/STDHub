import { test, expect } from '@playwright/test'

// Real-click e2e for the study explorer (spec §4, VSCode-style):
// open folder -> expand dir -> open file (preview reused) ->
// double-click pins -> edit dirties -> save persists -> re-read shows it.
// Runs against the REAL production code (WebFileProvider + ExplorerTree +
// EditorView + Monaco) with trusted mouse events, on a stubbed disk.
test('explorer: pasta, arquivo, editar, salvar e reler (cliques reais)', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.addInitScript({ path: './fs-stub.js' })
  await page.goto('/')

  // Guest entry (language pre-seeded as en by the stub).
  await page.getByRole('button', { name: /continue as guest/i }).click()

  const panel = page.getByLabel(/notebook panel/i)
  const appTabs = page.getByRole('tablist', { name: 'STDHub' })
  const fileTabs = page.getByRole('tablist', { name: 'editor-files' })

  // 1. Open folder from the sidebar -> tree appears, Notebook tab reveals.
  await panel.getByRole('button', { name: /open folder/i }).click()
  await expect(panel.getByRole('button', { name: 'matematica' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'fisica.md' })).toBeVisible()
  await expect(appTabs.getByRole('tab', { name: 'Notebook' })).toBeVisible()

  // 2. Single click on a directory expands it.
  await panel.getByRole('button', { name: 'matematica' }).click()
  await expect(panel.getByRole('button', { name: 'algebra.md' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'geo.md' })).toBeVisible()

  // 3. Single click on a file opens it in the editor (ONE preview tab).
  await panel.getByRole('button', { name: 'algebra.md' }).click()
  await expect(fileTabs.getByRole('tab', { name: /algebra\.md/ })).toBeVisible()
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(
    'equacao do 2o grau',
  )

  // 4. Opening another file REPLACES the preview (still a single tab).
  await panel.getByRole('button', { name: 'fisica.md' }).click()
  await expect(fileTabs.getByRole('tab', { name: /fisica\.md/ })).toBeVisible()
  await expect(fileTabs.getByRole('tab')).toHaveCount(1)

  // 5. Double-click pins; the next file then adds a second tab.
  await panel.getByRole('button', { name: 'fisica.md' }).dblclick()
  await panel.getByRole('button', { name: 'algebra.md' }).click()
  await expect(fileTabs.getByRole('tab')).toHaveCount(2)

  // 6. Edit the active file -> dirty dot; save -> persists to disk.
  await fileTabs.getByRole('tab', { name: /algebra\.md/ }).click()
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(
    'equacao do 2o grau',
  )
  // Click the visible code area (like a real user), not Monaco's hidden IME node.
  await page.locator('.monaco-editor .view-lines').click()
  await page.keyboard.type('\n- bhaskara\n')
  await expect(fileTabs.getByRole('tab', { name: /algebra\.md/ })).toContainText(
    '•',
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect
    .poll(async () => {
      const dump = (await page.evaluate(() =>
        (
          window as unknown as { __memfsDump: () => Record<string, string> }
        ).__memfsDump(),
      )) as Record<string, string>
      return dump['estudos/matematica/algebra.md'] ?? ''
    })
    .toContain('bhaskara')

  // 7. Re-read: close the tab, reopen -> saved content is there.
  await fileTabs.getByRole('button', { name: /close algebra\.md/i }).click()
  await expect(fileTabs.getByRole('tab')).toHaveCount(1)
  await panel.getByRole('button', { name: 'algebra.md' }).click()
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(
    'bhaskara',
  )

  expect(pageErrors).toEqual([])
})

test('botão flutuante do notebook abre o painel do terminal', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.addInitScript({ path: './fs-stub.js' })
  await page.goto('/')

  await page.getByRole('button', { name: /continue as guest/i }).click()
  const panel = page.getByLabel(/notebook panel/i)
  await panel.getByRole('button', { name: /open folder/i }).click()
  await expect(panel.getByRole('button', { name: 'matematica' })).toBeVisible()

  // Floating action button at the notebook's bottom-right corner.
  const floating = page.getByRole('button', { name: 'New integrated terminal' })
  // The terminal starts hidden: zero-height slot before the first reveal.
  await expect(page.getByTestId('terminal-bottom-slot')).toBeHidden()
  await floating.click()
  await expect(page.getByTestId('terminal-bottom-slot')).toBeVisible()
  // The floating button hides while the panel is open.
  await expect(floating).toBeHidden()
  // Web build has no PTY backend: an honest notice, no tab, no crash.
  await expect(page.getByText(/needs the desktop app/i)).toBeVisible()

  // The bottom panel resizes by dragging its top handle (real mouse).
  // Let the 300ms open animation settle so the grab coords stay valid.
  await page.waitForTimeout(450)
  const bottom = page.getByTestId('terminal-bottom')
  const heightOf = (): Promise<string> =>
    bottom.evaluate(
      (el) => (el.firstElementChild as HTMLElement).style.height,
    )
  const before = await heightOf()
  const grip = page.getByRole('separator', { name: /resize terminal/i })
  const box = await grip.boundingBox()
  if (!box) throw new Error('resize handle has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 5 })
  await page.mouse.up()
  const after = await heightOf()
  expect(before).toBe('224px')
  expect(Number.parseInt(after, 10)).toBeGreaterThan(
    Number.parseInt(before, 10) + 100,
  )

  expect(pageErrors).toEqual([])
})

test('calculadora funciona de ponta a ponta (cliques reais)', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  await page.addInitScript({ path: './fs-stub.js' })
  await page.goto('/')

  await page.getByRole('button', { name: /continue as guest/i }).click()
  await page
    .getByRole('button', { name: 'Calculator', exact: true })
    .click({ button: 'right' })
  await page.getByRole('menuitem', { name: /open in new tab/i }).click()

  await page.getByRole('textbox', { name: /expression/i }).fill('6*7')
  await expect(page.getByTestId('calc-preview')).toHaveText('42')

  await page.getByRole('button', { name: /scientific/i }).click()
  await expect(
    page.getByRole('button', { name: 'sin(', exact: true }),
  ).toBeVisible()
  await page.getByRole('textbox', { name: /expression/i }).fill('sin(30)')
  await expect(page.getByTestId('calc-preview')).toHaveText('0.5')

  // Dock the calculator tab to the right with real clicks.
  const calcTab = page.getByTestId('shell-tabs').getByRole('tab', {
    name: 'Calculator',
  })
  await calcTab.click({ button: 'right' })
  await page.getByRole('menuitem', { name: /dock to the right/i }).click()
  const dock = page.getByTestId('function-right-slot')
  await expect(dock).toBeVisible()
  await expect(
    dock.getByRole('textbox', { name: /expression/i }),
  ).toBeVisible()

  expect(pageErrors).toEqual([])
})
