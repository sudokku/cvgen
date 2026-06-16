import type { Browser } from 'puppeteer-core'
import { existsSync } from 'node:fs'

const LOCAL_BROWSER_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
]

function localExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  return LOCAL_BROWSER_PATHS.find((path) => existsSync(path))
}

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL_ENV) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.launch({
      args: [...chromium.args, '--force-color-profile=srgb'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    // devDependency: auto-manages Chrome via ~/.cache/puppeteer
    const puppeteer = await import('puppeteer')
    return puppeteer.launch({
      headless: true,
      executablePath: localExecutablePath(),
      args: ['--force-color-profile=srgb'],
    }) as unknown as Browser
  }
}
