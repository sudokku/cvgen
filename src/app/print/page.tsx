'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CVPreview } from '@/components/Preview/CVPreview'
import { CV } from '@/types/cv'
import { cvToJsonLd } from '@/lib/cv-to-jsonld'
import { extractKeywords } from '@/lib/cv-metadata'

function PrintContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [cv, setCv] = useState<CV | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cv) return

    const nodes: HTMLElement[] = []

    const addMeta = (attrs: Record<string, string>): HTMLMetaElement => {
      const el = document.createElement('meta')
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
      document.head.appendChild(el)
      nodes.push(el)
      return el
    }

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(cvToJsonLd(cv))
    document.head.appendChild(script)
    nodes.push(script)

    addMeta({ name: 'description', content: cv.meta.title ?? '' })
    addMeta({ name: 'author', content: cv.meta.name ?? '' })
    addMeta({ name: 'keywords', content: extractKeywords(cv).join(', ') })
    addMeta({ property: 'og:title', content: cv.meta.name ?? '' })
    addMeta({ property: 'og:description', content: cv.meta.title ?? '' })
    addMeta({ property: 'og:type', content: 'profile' })

    return () => {
      for (const node of nodes) node.remove()
    }
  }, [cv])

  useEffect(() => {
    if (!id) {
      setError('No CV id provided')
      return
    }

    async function fetchCv() {
      const res = await fetch(`/api/pdf?id=${encodeURIComponent(id!)}`)
      if (!res.ok) {
        setError(`Failed to load CV: ${res.status}`)
        return
      }
      const data: CV = await res.json()
      setCv(data)
    }

    fetchCv().catch((e) => setError(String(e)))
  }, [id])

  if (error) {
    return <div style={{ fontFamily: 'monospace', padding: '24px', color: 'red' }}>{error}</div>
  }

  if (!cv) {
    return null
  }

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'Monaspace Neon';
          src: url('/fonts/MonaspaceNeon-Regular.woff2') format('woff2');
          font-weight: 400;
          font-display: block;
        }
        @font-face {
          font-family: 'Monaspace Neon';
          src: url('/fonts/MonaspaceNeon-Bold.woff2') format('woff2');
          font-weight: 700;
          font-display: block;
        }
        @font-face {
          font-family: 'Fira Code';
          src: url('/fonts/FiraCode-Regular.woff2') format('woff2');
          font-weight: 400;
          font-display: block;
        }
        @font-face {
          font-family: 'Fira Code';
          src: url('/fonts/FiraCode-Bold.woff2') format('woff2');
          font-weight: 700;
          font-display: block;
        }
        @font-face {
          font-family: 'JetBrains Mono';
          src: url('/fonts/JetBrainsMono-Regular.woff2') format('woff2');
          font-weight: 400;
          font-display: block;
        }
        @font-face {
          font-family: 'JetBrains Mono';
          src: url('/fonts/JetBrainsMono-Bold.woff2') format('woff2');
          font-weight: 700;
          font-display: block;
        }
        @font-face {
          font-family: 'Cascadia Code';
          src: url('/fonts/CascadiaCode-Regular.woff2') format('woff2');
          font-weight: 400;
          font-display: block;
        }
        @font-face {
          font-family: 'Cascadia Code';
          src: url('/fonts/CascadiaCode-Bold.woff2') format('woff2');
          font-weight: 700;
          font-display: block;
        }
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page { margin: 0; size: A4; }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background: ${cv.style.bgColor};
        }
      `}</style>
      <div style={{ width: '100%', boxSizing: 'border-box' }}>
        <CVPreview cv={cv} containerStyle={{ paddingTop: 0, paddingBottom: 0 }} />
      </div>
      <div id="cv-print-ready" style={{ display: 'none' }} />
    </>
  )
}

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  )
}
