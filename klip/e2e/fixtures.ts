import { test as base, _electron as electron, expect } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'path'

const ROOT = path.join(__dirname, '..')

type TestFixtures = {
  electronApp: ElectronApplication
  window: Page
}

export const test = base.extend<TestFixtures>({
  electronApp: [async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(ROOT, 'out', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        KLIP_E2E: '1',
        // Suppress GPU errors in headless CI environments
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
    })
    await use(app)
    await app.close()
  }, { scope: 'test', timeout: 30_000 }],

  window: [async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('#root > *', { state: 'attached', timeout: 15_000 })
    await use(page)
  }, { scope: 'test' }],
})

export { expect }
export type { ElectronApplication, Page }
