import { NextRequest, NextResponse } from 'next/server'
import { inflateRawSync, inflateSync } from 'zlib'
import { PDFDocument } from 'pdf-lib'
import type { CV, CVMeta, CVSection } from '@/types/cv'

export const runtime = 'nodejs'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

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
    // ── Step 1: cvgen PDF detection (highest priority) ────────────────────────
    const cvgenResult = await extractCvgenAttachment(buf)
    if (cvgenResult) {
      return NextResponse.json({ type: 'cvgen', cv: cvgenResult })
    }

    // ── Step 2: EuroPass XML detection ────────────────────────────────────────
    const xml = extractXmlFromPdf(buf)
    if (xml) {
      const europassResult = await parseEuropassOnServer(xml)
      if (europassResult) {
        return NextResponse.json({
          type: 'europass',
          meta: europassResult.meta,
          sections: europassResult.sections,
        })
      }
    }

    // ── Step 3: Unsupported format ────────────────────────────────────────────
    return NextResponse.json(
      { error: 'Unsupported PDF format. Only cvgen and EuroPass PDFs are supported.' },
      { status: 422 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse PDF.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}

// ── pdf-lib internal helper ────────────────────────────────────────────────
// lookupMaybe overloads require a type argument; we traverse dynamically so we
// escape via an any cast isolated to this one helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookupAny(context: unknown, ref: unknown): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (context as any).lookup?.(ref) ?? undefined
}

// ── cvgen attachment extractor ─────────────────────────────────────────────

async function extractCvgenAttachment(buf: Buffer): Promise<CV | null> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: true })
  } catch {
    return null
  }

  // pdf-lib does not expose a high-level attachments API; walk the Names tree manually
  const catalog = doc.catalog
  const namesDict = catalog.get(catalog.context.obj('Names'))
  if (!namesDict) return null

  const embeddedFiles = (namesDict as unknown as { get: (k: unknown) => unknown }).get(
    catalog.context.obj('EmbeddedFiles')
  )
  if (!embeddedFiles) return null

  // Resolve indirect references
  const ef = lookupAny(doc.context, embeddedFiles)
  if (!ef) return null

  const kidsOrNames = (ef as unknown as { get: (k: unknown) => unknown }).get(
    doc.context.obj('Names')
  )
  if (!kidsOrNames) return null

  const namesArray = lookupAny(doc.context, kidsOrNames)
  if (!namesArray) return null

  // namesArray is a PDFArray of alternating [name, filespec, name, filespec, ...]
  const arr = namesArray as unknown as { size: () => number; lookup: (i: number) => unknown }
  const len = arr.size()

  for (let i = 0; i < len - 1; i += 2) {
    const nameObj = arr.lookup(i)
    const nameStr = (nameObj as unknown as { decodeText?: () => string; asString?: () => string })
      ?.decodeText?.() ?? (nameObj as unknown as { decodeText?: () => string; asString?: () => string })?.asString?.() ?? ''

    if (nameStr !== 'cv-source.json') continue

    const filespecRef = arr.lookup(i + 1)
    const filespec = lookupAny(doc.context, filespecRef)
    if (!filespec) continue

    const efDict = (filespec as unknown as { get: (k: unknown) => unknown }).get(doc.context.obj('EF'))
    if (!efDict) continue

    const efResolved = lookupAny(doc.context, efDict)
    if (!efResolved) continue

    const fObj = (efResolved as unknown as { get: (k: unknown) => unknown }).get(doc.context.obj('F'))
    if (!fObj) continue

    const embeddedFileStream = lookupAny(doc.context, fObj)
    if (!embeddedFileStream) continue

    const bytes = (embeddedFileStream as unknown as { getContents?: () => Uint8Array; contents?: Uint8Array })
      ?.getContents?.() ?? (embeddedFileStream as unknown as { getContents?: () => Uint8Array; contents?: Uint8Array })?.contents

    if (!bytes) continue

    const json = new TextDecoder().decode(bytes)
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return null
    }

    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'meta' in parsed &&
      'sections' in parsed
    ) {
      return parsed as CV
    }
  }

  return null
}

// ── EuroPass XML parser (server-side, polyfills DOM with jsdom) ───────────

async function parseEuropassOnServer(
  xml: string
): Promise<{ meta: CVMeta; sections: Omit<CVSection, 'id'>[] } | null> {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('')
  const g = globalThis as Record<string, unknown>
  const prev = { DOMParser: g.DOMParser, document: g.document, Node: g.Node }
  g.DOMParser = dom.window.DOMParser
  g.document = dom.window.document
  g.Node = dom.window.Node
  try {
    const { parseEuropassXML } = await import('@/lib/europass-parser')
    const result = parseEuropassXML(xml)
    return { meta: result.meta, sections: result.sections }
  } catch {
    return null
  } finally {
    g.DOMParser = prev.DOMParser
    g.document = prev.document
    g.Node = prev.Node
  }
}

// ── PDF binary XML extractor ───────────────────────────────────────────────

function extractXmlFromPdf(buf: Buffer): string | null {
  const xmlStartByte = findKeyword(buf, '<?xml', 0)
  if (xmlStartByte !== -1) {
    for (const rootTag of ['</Candidate>', '</SkillsPassport>']) {
      const endByte = findKeyword(buf, rootTag, xmlStartByte)
      if (endByte !== -1) {
        return buf.slice(xmlStartByte, endByte + rootTag.length).toString('utf8')
      }
    }
    const raw = buf.toString('latin1')
    const genericEnd = raw.indexOf('</', xmlStartByte + 5)
    if (genericEnd !== -1) {
      const closeTagEnd = raw.indexOf('>', genericEnd)
      if (closeTagEnd !== -1 && closeTagEnd - genericEnd < 60) {
        return buf.slice(xmlStartByte, closeTagEnd + 1).toString('utf8')
      }
    }
  }

  return extractCompressedXmlStream(buf)
}

function extractCompressedXmlStream(buf: Buffer): string | null {
  let offset = 0

  while (offset < buf.length) {
    const streamIdx = findKeyword(buf, 'stream', offset)
    if (streamIdx === -1) break

    let contentStart = streamIdx + 6
    if (buf[contentStart] === 0x0d) contentStart++
    if (buf[contentStart] === 0x0a) contentStart++

    const endStreamIdx = findKeyword(buf, 'endstream', contentStart)
    if (endStreamIdx === -1) break

    const streamData = buf.slice(contentStart, endStreamIdx)
    offset = endStreamIdx + 9

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

