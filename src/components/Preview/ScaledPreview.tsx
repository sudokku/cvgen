'use client'

import { useEffect, useRef, useState } from 'react'
import { CV } from '@/types/cv'
import { CVPreview } from './CVPreview'

// Must match the maxWidth set on #cv-preview in CVPreview.tsx
const DESIGN_WIDTH = 860
// Padding on each side around the page in the preview panel
const PAGE_PADDING = 24

/**
 * Renders CVPreview at its natural DESIGN_WIDTH, then zooms the whole block
 * to fit the available container width. This guarantees pixel-identical layout
 * at any viewport size — the PDF clone reads #cv-preview before zoom is applied,
 * so exports are always full-resolution.
 */
export function ScaledPreview({ cv }: { cv: CV }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width - PAGE_PADDING * 2
      setZoom(w >= DESIGN_WIDTH ? 1 : w / DESIGN_WIDTH)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', padding: PAGE_PADDING, boxSizing: 'border-box' }}>
      <div style={{ width: DESIGN_WIDTH, zoom, margin: '0 auto' }}>
        <CVPreview cv={cv} />
      </div>
    </div>
  )
}
