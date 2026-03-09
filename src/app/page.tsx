'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useCVStore } from '@/store/cv-store'
import { MetaEditor } from '@/components/Editor/MetaEditor'
import { SectionEditor } from '@/components/Editor/SectionEditor'
import { StyleEditor } from '@/components/Editor/StyleEditor'
import { CVPreview } from '@/components/Preview/CVPreview'
import { printCV } from '@/lib/print-cv'

// dnd-kit generates aria IDs that differ between SSR and client → skip SSR
const SectionList = dynamic(
  () => import('@/components/Editor/SectionList').then((m) => m.SectionList),
  { ssr: false }
)

type SidebarTab = 'sections' | 'meta' | 'style'
type MobileTab = 'edit' | 'meta' | 'preview'
type MobileEditView = 'list' | 'editor'
type MobileMetaView = 'meta' | 'style'

export default function Home() {
  const { cv } = useCVStore()

  // Desktop state
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('sections')

  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>('edit')
  const [mobileEditView, setMobileEditView] = useState<MobileEditView>('list')
  const [mobileMetaView, setMobileMetaView] = useState<MobileMetaView>('meta')

  return (
    <div className="h-screen bg-gray-950 text-gray-200 overflow-hidden">

      {/* ── Desktop layout (md+) ─────────────────────────────────────── */}
      <div className="hidden md:flex h-full">
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
              onClick={() => printCV('cv-preview', cv.meta.name || 'CV', cv.style.bgColor)}
              className="px-3 py-1 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Export PDF
            </button>
          </div>
          <div className="flex-1 overflow-auto" style={{ backgroundColor: cv.style.bgColor }}>
            <CVPreview cv={cv} />
          </div>
        </div>
      </div>

      {/* ── Mobile layout (<md) ──────────────────────────────────────── */}
      <div className="flex md:hidden flex-col h-full">

        {/* Content panels */}
        <div className="flex-1 overflow-hidden">

          {/* Edit › Section list */}
          {mobileTab === 'edit' && mobileEditView === 'list' && (
            <div className="flex flex-col h-full bg-gray-900">
              <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Sections</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <SectionList onSectionSelect={() => setMobileEditView('editor')} />
              </div>
            </div>
          )}

          {/* Edit › Section editor */}
          {mobileTab === 'edit' && mobileEditView === 'editor' && (
            <div className="flex flex-col h-full bg-gray-950">
              <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setMobileEditView('list')}
                  className="text-gray-400 hover:text-gray-200 font-mono transition-colors"
                >
                  ←
                </button>
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Editor</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SectionEditor />
              </div>
            </div>
          )}

          {/* Meta › Meta or Style */}
          {mobileTab === 'meta' && (
            <div className="flex flex-col h-full bg-gray-900">
              <div className="flex border-b border-gray-800 flex-shrink-0">
                {(['meta', 'style'] as MobileMetaView[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setMobileMetaView(v)}
                    className={`flex-1 py-2 text-xs font-mono uppercase tracking-wide transition-colors ${
                      mobileMetaView === v
                        ? 'text-white border-b-2 border-blue-500'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {mobileMetaView === 'meta' && <MetaEditor />}
                {mobileMetaView === 'style' && <StyleEditor />}
              </div>
            </div>
          )}

          {/* Preview */}
          {mobileTab === 'preview' && (
            <div className="flex flex-col h-full">
              <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900 flex-shrink-0">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Preview</span>
                <button
                  onClick={() => printCV('cv-preview', cv.meta.name || 'CV', cv.style.bgColor)}
                  className="px-3 py-1 text-xs font-mono bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                >
                  Export PDF
                </button>
              </div>
              <div className="flex-1 overflow-auto" style={{ backgroundColor: cv.style.bgColor }}>
                <CVPreview cv={cv} />
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation */}
        <nav className="flex-shrink-0 flex border-t border-gray-800 bg-gray-900">
          {([
            { id: 'edit',    label: 'Edit'    },
            { id: 'meta',    label: 'Meta'    },
            { id: 'preview', label: 'Preview' },
          ] as { id: MobileTab; label: string }[]).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide transition-colors ${
                mobileTab === id
                  ? 'text-white border-t-2 border-blue-500 -mt-px'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

    </div>
  )
}
