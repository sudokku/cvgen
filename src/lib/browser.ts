import type { Browser } from 'puppeteer-core'

export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL_ENV) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
  } else {
    // devDependency: auto-manages Chrome via ~/.cache/puppeteer
    const puppeteer = await import('puppeteer')
    return puppeteer.launch({ headless: true }) as unknown as Browser
  }
}
