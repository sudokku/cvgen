import { NextRequest, NextResponse } from 'next/server'
import { inflateRawSync, inflateSync } from 'zlib'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * POST /api/import
 * Accepts FormData with a `file` field containing a EuroPass PDF.
 *
 * Returns one of:
 *   { xml: string }   — when an embedded XML attachment was found and extracted
 *   { text: string }  — when no embedded XML was found but the PDF has extractable text
 *
 * Two EuroPass PDF variants exist in the wild:
 *   1. PDFs with an embedded attachment.xml (SkillsPassport or Candidate schema)
 *      → extracted directly from the raw PDF binary (no worker needed)
 *   2. Fully compressed PDFs with no embedded XML (new EuroPass builder as of 2024)
 *      → text extracted with pdfjs-dist; caller parses the structured text
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
    // ── Step 1: try to extract embedded XML ──────────────────────────────────
    const xml = extractXmlFromPdf(buf)
    if (xml) {
      return NextResponse.json({ xml })
    }

    // ── Step 2: fall back to pdfjs text extraction ───────────────────────────
    const text = await extractTextFromPdf(buf)
    if (text && text.trim().length > 100) {
      return NextResponse.json({ text })
    }

    return NextResponse.json(
      { error: 'Could not extract any CV data from this PDF. Please make sure it is a EuroPass PDF.' },
      { status: 422 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse PDF.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

// ── PDF binary XML extractor ───────────────────────────────────────────────

/**
 * Extracts embedded EuroPass XML from a PDF buffer.
 *
 * Handles both:
 *   - Old format: <SkillsPassport> root element
 *   - New format: <Candidate> root element (EuroPass v4 / HR-XML 3.0)
 *
 * Strategy:
 *   1. Look for <?xml in raw bytes — most EuroPass PDFs store the XML uncompressed.
 *      Byte-level search is used so that the result can be decoded as UTF-8 (not
 *      latin1). Decoding as latin1 was the previous bug: multi-byte UTF-8 sequences
 *      (e.g. Romanian ș = 0xC8 0x99) produced U+0099, a C1 control character that is
 *      illegal in XML 1.0 and caused the browser's DOMParser to reject the document.
 *   2. Fall back to decompressing FlateDecode streams (pdf-lib PDFs use this).
 */
function extractXmlFromPdf(buf: Buffer): string | null {
  // All search strings are ASCII so findKeyword (byte-level) works for both paths.
  const xmlStartByte = findKeyword(buf, '<?xml', 0)
  if (xmlStartByte !== -1) {
    for (const rootTag of ['</Candidate>', '</SkillsPassport>']) {
      const endByte = findKeyword(buf, rootTag, xmlStartByte)
      if (endByte !== -1) {
        // Decode the slice as UTF-8 to preserve non-ASCII characters correctly.
        return buf.slice(xmlStartByte, endByte + rootTag.length).toString('utf8')
      }
    }
    // Fallback: try a generic close tag within a short window of the <?xml start.
    // latin1 is safe here because we only look at ASCII tag names.
    const raw = buf.toString('latin1')
    const genericEnd = raw.indexOf('</', xmlStartByte + 5)
    if (genericEnd !== -1) {
      const closeTagEnd = raw.indexOf('>', genericEnd)
      if (closeTagEnd !== -1 && closeTagEnd - genericEnd < 60) {
        return buf.slice(xmlStartByte, closeTagEnd + 1).toString('utf8')
      }
    }
  }

  // Try compressed streams — iterate over all "stream ... endstream" blocks
  return extractCompressedXmlStream(buf)
}

function extractCompressedXmlStream(buf: Buffer): string | null {
  let offset = 0

  while (offset < buf.length) {
    const streamIdx = findKeyword(buf, 'stream', offset)
    if (streamIdx === -1) break

    let contentStart = streamIdx + 6 // length of 'stream'
    if (buf[contentStart] === 0x0d) contentStart++ // \r
    if (buf[contentStart] === 0x0a) contentStart++ // \n

    const endStreamIdx = findKeyword(buf, 'endstream', contentStart)
    if (endStreamIdx === -1) break

    const streamData = buf.slice(contentStart, endStreamIdx)
    offset = endStreamIdx + 9 // length of 'endstream'

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
  const raw = tryParseXml(data.toString('utf8'))
  if (raw) return raw

  try {
    const decompressed = inflateSync(data)
    const result = tryParseXml(decompressed.toString('utf8'))
    if (result) return result
  } catch { /* not valid zlib */ }

  try {
    const decompressed = inflateRawSync(data)
    const result = tryParseXml(decompressed.toString('utf8'))
    if (result) return result
  } catch { /* not valid deflate */ }

  return null
}

function tryParseXml(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('<?xml') && !trimmed.includes('<SkillsPassport') && !trimmed.includes('<Candidate ')) {
    return null
  }

  const start = trimmed.indexOf('<?xml') !== -1 ? trimmed.indexOf('<?xml') : 0

  for (const rootTag of ['</Candidate>', '</SkillsPassport>']) {
    const end = trimmed.lastIndexOf(rootTag)
    if (end !== -1) {
      return trimmed.slice(start, end + rootTag.length)
    }
  }
  return null
}

// ── PDF text extractor (pdfjs-dist fallback) ───────────────────────────────

/**
 * Extracts plain text from a PDF using pdfjs-dist (legacy Node.js build).
 * Used as a fallback when no embedded XML is found.
 * Returns concatenated text from all pages, separated by newlines.
 */
async function extractTextFromPdf(buf: Buffer): Promise<string> {
  // pdfjs-dist requires DOMMatrix and other browser APIs. Polyfill minimally.
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix === 'undefined') {
    ;(globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    }
  }
  if (typeof (globalThis as Record<string, unknown>).ImageData === 'undefined') {
    ;(globalThis as Record<string, unknown>).ImageData = class ImageData {
      width: number; height: number; data: Uint8ClampedArray
      constructor(w: number, h: number) {
        this.width = w; this.height = h
        this.data = new Uint8ClampedArray(w * h * 4)
      }
    }
  }
  if (typeof (globalThis as Record<string, unknown>).Path2D === 'undefined') {
    ;(globalThis as Record<string, unknown>).Path2D = class Path2D {}
  }

  // Dynamic import to avoid issues when XML extraction succeeds (no need to load pdfjs)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
  const getDocument = (pdfjsLib as unknown as { getDocument: typeof import('pdfjs-dist').getDocument }).getDocument

  const task = getDocument({ data: new Uint8Array(buf), disableFontFace: true, verbosity: 0 })
  const pdfDoc = await task.promise

  const pages: string[] = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = (textContent.items as Array<{ str: string }>)
      .map(item => item.str)
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n\n')
}
