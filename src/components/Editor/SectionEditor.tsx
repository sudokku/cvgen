'use client'

import { useCallback, useRef } from 'react'
import { useCVStore } from '@/store/cv-store'
import { CVSection, SectionType, TimelineLayout } from '@/types/cv'
import { useAsciiGenerator } from '@/lib/use-ascii'

const TIMELINE_TYPES: SectionType[] = ['experience', 'education']
const DEFAULT_WIDTH = 80
const DEFAULT_HEIGHT = 40

export function SectionEditor() {
  const { cv, selectedSectionId, updateSection } = useCVStore()
  const section = cv.sections.find((s) => s.id === selectedSectionId)
  const fileRef = useRef<HTMLInputElement>(null)
  const generate = useAsciiGenerator()

  const update = useCallback(
    (patch: Partial<CVSection>) => {
      if (section) updateSection(section.id, patch)
    },
    [section, updateSection]
  )

  const width = section?.photoWidth ?? DEFAULT_WIDTH
  const height = section?.photoHeight ?? DEFAULT_HEIGHT

  const handlePhotoUpload = useCallback(
    async (file: File, cols = DEFAULT_WIDTH) => {
      if (!file.type.match(/^image\/jpe?g$/)) {
        alert('Only JPG/JPEG images are supported (no transparent backgrounds).')
        return
      }
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        update({ photoUrl: dataUrl, photoAscii: undefined })
        const ascii = await generate(dataUrl, { cols })
        if (ascii) update({ photoAscii: ascii })
      }
      reader.readAsDataURL(file)
    },
    [update, generate]
  )

  const handleWidthChange = useCallback(
    async (newWidth: number) => {
      update({ photoWidth: newWidth })
      if (!section?.photoUrl) return
      update({ photoAscii: undefined })
      const ascii = await generate(section.photoUrl, { cols: newWidth })
      if (ascii) update({ photoAscii: ascii })
    },
    [section?.photoUrl, update, generate]
  )

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select a section to edit
      </div>
    )
  }

  const canUseTimeline = TIMELINE_TYPES.includes(section.type)

  return (
    <div className="flex flex-col h-full">
      {/* Section fields */}
      <div className="p-3 border-b border-gray-800 space-y-2 flex-shrink-0">
        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Title</span>
          <input
            value={section.title}
            onChange={(e) => update({ title: e.target.value })}
            className="bg-transparent border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-400"
          />
        </label>

        <label className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Subtitle</span>
          <input
            value={section.subtitle ?? ''}
            onChange={(e) => update({ subtitle: e.target.value })}
            placeholder="Optional subtitle"
            className="bg-transparent border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-400"
          />
        </label>

        {canUseTimeline && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Layout</span>
            <div className="flex gap-2">
              {(['vertical', 'horizontal', 'list'] as TimelineLayout[]).map((l) => (
                <button
                  key={l}
                  onClick={() => update({ layout: l })}
                  className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                    section.layout === l
                      ? 'border-blue-500 text-blue-400 bg-blue-950'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      {section.type === 'photo' ? (
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors flex-shrink-0"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handlePhotoUpload(file, width)
            }}
          >
            {section.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.photoUrl}
                alt="Uploaded"
                className="max-h-24 mx-auto rounded object-cover"
              />
            ) : (
              <>
                <p className="text-gray-500 text-sm">Drop photo here or click to upload</p>
                <p className="text-gray-600 text-xs mt-1">JPG/JPEG only</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePhotoUpload(file, width)
                e.target.value = ''
              }}
            />
          </div>

          {/* Size controls */}
          {section.photoUrl && (
            <div className="space-y-2 flex-shrink-0">
              <label className="flex flex-col gap-0.5">
                <span className="text-xs font-mono text-gray-500">width — {width} cols</span>
                <input
                  type="range"
                  min={20}
                  max={120}
                  step={5}
                  value={width}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-xs font-mono text-gray-500">height — {height} rows</span>
                <input
                  type="range"
                  min={5}
                  max={80}
                  step={1}
                  value={height}
                  onChange={(e) => update({ photoHeight: Number(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </label>
            </div>
          )}

          {/* ASCII preview */}
          {section.photoAscii && (
            <div className="flex-1 overflow-auto">
              <pre className="text-xs leading-none text-green-400 font-mono whitespace-pre">
                {section.photoAscii}
              </pre>
            </div>
          )}
          {section.photoUrl && !section.photoAscii && (
            <p className="text-xs text-gray-500 italic">Generating ASCII art...</p>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col p-3">
          {canUseTimeline && section.layout !== 'list' && (
            <p className="text-xs text-gray-600 font-mono mb-2">
              Format: <code className="text-gray-500">### Role @ Company | Period</code>
            </p>
          )}
          <textarea
            value={section.content}
            onChange={(e) => update({ content: e.target.value })}
            className="flex-1 bg-gray-950 border border-gray-800 rounded p-2 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-gray-600 placeholder-gray-700"
            placeholder="Write markdown content here..."
            spellCheck={false}
          />
        </div>
      )}
    </div>
  )
}
