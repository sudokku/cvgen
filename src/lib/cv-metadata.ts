import { CV } from '@/types/cv'
import { parseTimelineEntries } from './timeline-parser'

export function extractKeywords(cv: CV): string[] {
  const { meta, sections } = cv
  const raw: string[] = []

  if (meta.title) raw.push(meta.title)

  for (const section of sections) {
    raw.push(section.title)

    if (section.type === 'skills') {
      const items = section.content.split(/[\n,|•]+/).map((t) => t.replace(/^[^:]+:/, '').trim())
      raw.push(...items)
    }

    if (section.type === 'experience' || section.type === 'education') {
      const entries = parseTimelineEntries(section.content)
      for (const e of entries) {
        if (e.role) raw.push(e.role)
        if (e.company) raw.push(e.company)
      }
    }
  }

  const seen = new Set<string>()
  const result: string[] = []
  for (const kw of raw) {
    const k = kw.trim()
    if (!k || k.length > 50 || seen.has(k)) continue
    seen.add(k)
    result.push(k)
    if (result.length >= 40) break
  }
  return result
}

export function buildXmpString(cv: CV, keywords: string[]): string {
  const { meta } = cv
  const exportedAt = new Date().toISOString()
  const subjectBag = keywords.map((k) => `        <rdf:li>${escapeXml(k)}</rdf:li>`).join('\n')

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:cvgen="https://cvgen.app/ns/1.0/">
      <dc:title>${escapeXml(meta.name)}</dc:title>
      <dc:creator>${escapeXml(meta.name)}</dc:creator>
      <dc:description>${escapeXml(meta.title || '')}</dc:description>
      <dc:subject>
        <rdf:Bag>
${subjectBag}
        </rdf:Bag>
      </dc:subject>
      <cvgen:email>${escapeXml(meta.email || '')}</cvgen:email>
      <cvgen:exportedAt>${exportedAt}</cvgen:exportedAt>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function injectMetadata(pdfBytes: Buffer | Uint8Array, cv: CV): Promise<Uint8Array> {
  const { PDFDocument, PDFName } = await import('pdf-lib')

  const keywords = extractKeywords(cv)
  const doc = await PDFDocument.load(pdfBytes)

  doc.setTitle(cv.meta.name || 'CV')
  doc.setAuthor(cv.meta.name || '')
  doc.setSubject(cv.meta.title || '')
  doc.setKeywords(keywords)
  doc.setProducer('cvgen (pdf-lib)')
  doc.setCreationDate(new Date())
  doc.setModificationDate(new Date())

  // Inject XMP metadata stream
  const xmp = buildXmpString(cv, keywords)
  const xmpBytes = new TextEncoder().encode(xmp)
  const metaStream = doc.context.stream(xmpBytes, {
    Type: 'Metadata',
    Subtype: 'XML',
    Length: xmpBytes.length,
  })
  const metaRef = doc.context.register(metaStream)
  doc.catalog.set(PDFName.of('Metadata'), metaRef)

  // Attach full JSON-LD as embedded file (for AI/bots)
  const { cvToJsonLd } = await import('./cv-to-jsonld')
  const jsonLd = JSON.stringify(cvToJsonLd(cv), null, 2)
  await doc.attach(new TextEncoder().encode(jsonLd), 'cv-metadata.json', {
    mimeType: 'application/ld+json',
    description: 'CV schema.org/Person JSON-LD metadata',
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  // Attach raw CV JSON for round-trip import fidelity
  await doc.attach(new TextEncoder().encode(JSON.stringify(cv)), 'cv-source.json', {
    mimeType: 'application/json',
    description: 'cvgen source CV — full round-trip data',
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  return doc.save()
}
