import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/pdf/route'
import { NextRequest } from 'next/server'

// Helper: build a minimal NextRequest for the GET handler.
// The pdf/route GET handler reads req.nextUrl.searchParams.get('id').
function makeGetRequest(id?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/pdf${id ? `?id=${id}` : ''}`)
  return new NextRequest(url)
}

describe('GET /api/pdf', () => {
  it('returns 404 when no id query parameter is provided', async () => {
    const req = makeGetRequest()
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns 404 when an id is provided but has no matching cache entry', async () => {
    const req = makeGetRequest('nonexistent-id-xyz')
    const res = await GET(req)
    expect(res.status).toBe(404)
  })

  it('returns JSON with an error field on 404', async () => {
    const req = makeGetRequest('does-not-exist')
    const res = await GET(req)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })
})

// POST /api/pdf requires puppeteer launching a real browser and navigating to
// a live /print page. This cannot run in the jsdom unit-test environment.
describe('POST /api/pdf', () => {
  it.skip('Requires puppeteer + real browser environment — skipped in unit test run', () => {
    // The POST handler calls puppeteer.launch(), page.goto() against a live
    // Next.js server, and page.pdf(). All of these require a real Chromium
    // install and a running HTTP server, making them unsuitable for the
    // Vitest jsdom runner.
  })
})
