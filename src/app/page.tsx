'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useCVStore } from '@/store/cv-store'
import { MetaEditor } from '@/components/Editor/MetaEditor'
import { SectionEditor } from '@/components/Editor/SectionEditor'
import { StyleEditor } from '@/components/Editor/StyleEditor'
import { CVPreview } from '@/components/Preview/CVPreview'

// dnd-kit generates aria IDs that differ between SSR and client → skip SSR
const SectionList = dynamic(
  () => import('@/components/Editor/SectionList').then((m) => m.SectionList),
  { ssr: false }
)

type SidebarTab = 'sections' | 'meta' | 'style'

export default function Home() {
  const { cv } = useCVStore()
  const [exporting, setExporting] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sections')

  async function exportPDF() {
    setExporting(true)
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cv),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${cv.meta.name.replace(/\s+/g, '_')}_CV.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('PDF export failed. Check console for details.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-200 overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-900">
        <div className="flex border-b border-gray-800 flex-shrink-0">
          {(['sections', 'meta', 'style'] as SidebarTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wide transition-colors ${
                sidebarTab === tab
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {sidebarTab === 'sections' && <SectionList />}
          {sidebarTab === 'meta' && <MetaEditor />}
          {sidebarTab === 'style' && <StyleEditor />}
        </div>
      </aside>

      {/* Center: section editor */}
      <div className="w-80 flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-950">
        <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Editor</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SectionEditor />
        </div>
      </div>

      {/* Right: preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900 flex-shrink-0">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Preview</span>
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="px-3 py-1 text-xs font-mono bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            {exporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
        <div className="flex-1 overflow-auto" style={{ backgroundColor: cv.style.bgColor }}>
          <CVPreview cv={cv} />
        </div>
      </div>
    </div>
  )
}
