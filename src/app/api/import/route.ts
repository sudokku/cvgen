import { NextRequest, NextResponse } from 'next/server'
import { inflateRawSync, inflateSync } from 'zlib'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * POST /api/import
 * Accepts FormData with a `file` field containing a EuroPass PDF.
 * Extracts the embedded XML attachment and returns { xml: string }.
 *
 * EuroPass PDFs embed the SkillsPassport XML as a named embedded file.
 * We parse the raw PDF binary to locate and decode this stream.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit.' }, { status: 413 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)

  // Verify PDF magic bytes
  if (!buf.slice(0, 5).toString('ascii').startsWith('%PDF-')) {
    return NextResponse.json({ error: 'File does not appear to be a valid PDF.' }, { status: 400 })
  }

  try {
    const xml = extractXmlFromPdf(buf)
    if (!xml) {
      return NextResponse.json(
        { error: 'No embedded XML attachment found in this PDF. Please export a EuroPass SkillsPassport XML directly.' },
        { status: 422 }
      )
    }
    return NextResponse.json({ xml })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse PDF.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

// ── PDF binary parser ──────────────────────────────────────────────────────

/**
 * Extracts the first XML-looking embedded stream from a PDF buffer.
 *
 * Strategy:
 * 1. Look for stream objects that contain XML content (<?xml or <SkillsPassport).
 * 2. Handle FlateDecode (zlib) compressed streams.
 * 3. Return the first match.
 *
 * This covers the common EuroPass PDF structure where the SkillsPassport XML
 * is stored as an embedded file stream, typically FlateDecode compressed.
 */
function extractXmlFromPdf(buf: Buffer): string | null {
  // First, try to find uncompressed XML directly in the buffer
  // (some EuroPass variants don't compress the XML stream)
  const raw = buf.toString('latin1')

  // Look for <?xml ... <SkillsPassport markers in plaintext
  const xmlStart = raw.indexOf('<?xml')
  if (xmlStart !== -1) {
    // Find the end — look for </SkillsPassport> or end of stream
    const spEnd = raw.indexOf('</SkillsPassport>', xmlStart)
    if (spEnd !== -1) {
      const xmlFragment = raw.slice(xmlStart, spEnd + '</SkillsPassport>'.length)
      return xmlFragment
    }
    // Try without namespace suffix
    const genericEnd = raw.indexOf('</SkillsPassport', xmlStart)
    if (genericEnd !== -1) {
      const closeTag = raw.indexOf('>', genericEnd)
      if (closeTag !== -1) {
        return raw.slice(xmlStart, closeTag + 1)
      }
    }
  }

  // Try compressed streams — iterate over all "stream ... endstream" blocks
  return extractCompressedXmlStream(buf)
}

function extractCompressedXmlStream(buf: Buffer): string | null {
  let offset = 0

  while (offset < buf.length) {
    // Find next "stream\r\n" or "stream\n"
    const streamIdx = findKeyword(buf, 'stream', offset)
    if (streamIdx === -1) break

    // The stream content starts after the newline following "stream"
    let contentStart = streamIdx + 6 // length of 'stream'
    if (buf[contentStart] === 0x0d) contentStart++ // \r
    if (buf[contentStart] === 0x0a) contentStart++ // \n

    // Find "endstream"
    const endStreamIdx = findKeyword(buf, 'endstream', contentStart)
    if (endStreamIdx === -1) break

    const streamData = buf.slice(contentStart, endStreamIdx)
    offset = endStreamIdx + 9 // length of 'endstream'

    // Try to decompress and check for XML
    const xml = tryDecodeAsXml(streamData)
    if (xml) return xml
  }

  return null
}

function findKeyword(buf: Buffer, keyword: string, fromOffset: number): number {
  const kw = Buffer.from(keyword, 'ascii')
  for (let i = fromOffset; i <= buf.length - kw.length; i++) {
    let match = true
    for (let j = 0; j < kw.length; j++) {
      if (buf[i + j] !== kw[j]) { match = false; break }
    }
    if (match) return i
  }
  return -1
}

function tryDecodeAsXml(data: Buffer): string | null {
  // Try raw (uncompressed) first
  const raw = tryParseXml(data.toString('utf8'))
  if (raw) return raw

  // Try FlateDecode (zlib deflate)
  try {
    const decompressed = inflateSync(data)
    const text = decompressed.toString('utf8')
    const result = tryParseXml(text)
    if (result) return result
  } catch {
    // Not valid zlib with header
  }

  // Try raw deflate (no zlib header)
  try {
    const decompressed = inflateRawSync(data)
    const text = decompressed.toString('utf8')
    const result = tryParseXml(text)
    if (result) return result
  } catch {
    // Not valid deflate
  }

  return null
}

function tryParseXml(text: string): string | null {
  const trimmed = text.trim()
  if (
    (trimmed.startsWith('<?xml') || trimmed.includes('<SkillsPassport')) &&
    trimmed.includes('</SkillsPassport')
  ) {
    // Extract from start of <?xml or <SkillsPassport
    const start = trimmed.indexOf('<?xml') !== -1
      ? trimmed.indexOf('<?xml')
      : trimmed.indexOf('<SkillsPassport')
    const end = trimmed.lastIndexOf('</SkillsPassport')
    if (end !== -1) {
      const closeTagEnd = trimmed.indexOf('>', end)
      if (closeTagEnd !== -1) {
        return trimmed.slice(start, closeTagEnd + 1)
      }
    }
    return trimmed.slice(start)
  }
  return null
}
