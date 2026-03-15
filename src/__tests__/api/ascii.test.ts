import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/ascii/route'
import { NextRequest } from 'next/server'

// The ASCII route uses sharp for image processing. Sharp is a native Node
// module and works in the Vitest node/jsdom environment.
// We need a minimal valid image as a base64 data URL for happy-path tests.
// We use a 1×1 black pixel PNG encoded inline.
const VALID_1x1_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/ascii', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ascii', () => {
  it('returns 400 when the request body has no dataUrl field', async () => {
    const req = makePostRequest({ palette: 'balanced' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when dataUrl is null', async () => {
    const req = makePostRequest({ dataUrl: null })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when dataUrl does not start with data:image/', async () => {
    const req = makePostRequest({ dataUrl: 'https://example.com/photo.jpg' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns JSON with an error field on 400', async () => {
    const req = makePostRequest({ dataUrl: 'not-a-data-url' })
    const res = await POST(req)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 200 with an ascii field for a valid 1×1 PNG data URL', async () => {
    const req = makePostRequest({ dataUrl: VALID_1x1_PNG_DATA_URL })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('ascii')
    expect(typeof body.ascii).toBe('string')
  })

  it('ascii output is non-empty for a valid image', async () => {
    const req = makePostRequest({ dataUrl: VALID_1x1_PNG_DATA_URL })
    const res = await POST(req)
    const body = await res.json()
    expect(body.ascii.length).toBeGreaterThan(0)
  })

  it('accepts a palette parameter without error', async () => {
    const req = makePostRequest({ dataUrl: VALID_1x1_PNG_DATA_URL, palette: 'standard' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('accepts maxCols and maxRows parameters without error', async () => {
    const req = makePostRequest({ dataUrl: VALID_1x1_PNG_DATA_URL, maxCols: 40, maxRows: 20 })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
