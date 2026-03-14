export const runtime = 'nodejs'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { CV } from '@/types/cv'
import { injectMetadata } from '@/lib/cv-metadata'

interface CacheEntry {
  cv: CV
  expiresAt: number
}

const cvCache = new Map<string, CacheEntry>()

function evictExpired() {
  const now = Date.now()
  for (const [key, entry] of cvCache.entries()) {
    if (entry.expiresAt < now) cvCache.delete(key)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.cv) {
    return NextResponse.json({ error: 'Missing cv field' }, { status: 400 })
  }

  const cv: CV = body.cv
  evictExpired()

  const id = nanoid()
  cvCache.set(id, { cv, expiresAt: Date.now() + 60_000 })

  const baseUrl = req.nextUrl.origin
  const printUrl = `${baseUrl}/print?id=${id}`

  let puppeteer: typeof import('puppeteer')
  try {
    puppeteer = await import('puppeteer')
  } catch {
    cvCache.delete(id)
    return NextResponse.json(
      { error: 'puppeteer not available', hint: 'npm install puppeteer' },
      { status: 500 }
    )
  }

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 25_000 })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
    await browser.close()
    browser = undefined

    const enriched = await injectMetadata(pdfBuffer, cv)

    const filename = `${(cv.meta.name || 'CV').replace(/[^a-z0-9]/gi, '_')}.pdf`
    return new NextResponse(Buffer.from(enriched), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    console.error('[pdf/route] puppeteer error:', err)
    return NextResponse.json(
      {
        error: 'PDF generation failed',
        detail: String(err),
        hint: 'Use the Quick Print button as a fallback',
      },
      { status: 500 }
    )
  } finally {
    cvCache.delete(id)
  }
}

// Internal endpoint: /api/pdf/cv?id=<uuid>
// Used by the /print page to retrieve the cached CV JSON.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const entry = cvCache.get(id)
  if (!entry || entry.expiresAt < Date.now()) {
    return NextResponse.json({ error: 'Not found or expired' }, { status: 404 })
  }
  return NextResponse.json(entry.cv)
}
