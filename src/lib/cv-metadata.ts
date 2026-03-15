import { PDFDocument } from 'pdf-lib'
import type { CV } from '@/types/cv'

export async function injectMetadata(pdfBuffer: Buffer, cv: CV): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer)

  doc.setAuthor(cv.meta.name)
  doc.setTitle(`${cv.meta.name} — ${cv.meta.title}`)
  doc.setSubject(cv.meta.title)
  doc.setCreator('cvgen')
  doc.setProducer('cvgen / pdf-lib')

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: cv.meta.name,
    jobTitle: cv.meta.title,
    email: cv.meta.email,
    ...(cv.meta.phone ? { telephone: cv.meta.phone } : {}),
    ...(cv.meta.location ? { address: cv.meta.location } : {}),
  }

  await doc.attach(
    new TextEncoder().encode(JSON.stringify(jsonLd, null, 2)),
    'cv-metadata.json',
    {
      mimeType: 'application/json',
      description: 'cvgen JSON-LD metadata',
      creationDate: new Date(),
      modificationDate: new Date(),
    }
  )

  await doc.attach(
    new TextEncoder().encode(JSON.stringify(cv)),
    'cv-source.json',
    {
      mimeType: 'application/json',
      description: 'cvgen source CV — full round-trip data',
      creationDate: new Date(),
      modificationDate: new Date(),
    }
  )

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
