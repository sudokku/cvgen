'use client'

import { useRef, useState } from 'react'
import { useCVStore } from '@/store/cv-store'
import { CV, CVMeta, CVSection } from '@/types/cv'

type ReviewPayload =
  | { type: 'cvgen'; cv: CV }
  | { type: 'europass'; meta: CVMeta; sections: CVSection[] }

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading'; filename: string }
  | { phase: 'error'; message: string }
  | { phase: 'review'; payload: ReviewPayload }
  | { phase: 'done' }

function countEntries(content: string): number {
  return (content.match(/^### /gm) ?? []).length
}

const PDF_ACCEPTED = ['.pdf', 'application/pdf']

export function ImportTab() {
  const importCV = useCVStore((s) => s.importCV)
  const replaceCV = useCVStore((s) => s.replaceCV)
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf'

    if (!isPdf) {
      setState({ phase: 'error', message: 'Please select a PDF file (.pdf).' })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setState({ phase: 'error', message: 'PDF file must be 10 MB or smaller.' })
      return
    }

    setState({ phase: 'loading', filename: file.name })

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/import', { method: 'POST', body: formData })

      const body = await res.json().catch(() => ({ error: res.statusText }))

      if (!res.ok) {
        throw new Error(body.error ?? `Server error ${res.status}`)
      }

      if (body.type === 'cvgen') {
        setState({ phase: 'review', payload: { type: 'cvgen', cv: body.cv as CV } })
      } else if (body.type === 'europass') {
        setState({
          phase: 'review',
          payload: {
            type: 'europass',
            meta: body.meta as CVMeta,
            sections: body.sections as CVSection[],
          },
        })
      } else {
        throw new Error('No CV data could be extracted from this PDF.')
      }
    } catch (err) {
      setState({ phase: 'error', message: (err as Error).message })
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function reset() {
    setState({ phase: 'idle' })
  }

  // ── idle ──────────────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-950/20'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <span className="text-2xl select-none">📄</span>
          <span className="text-sm font-mono text-gray-300 text-center">
            Drop a PDF here
          </span>
          <span className="text-xs font-mono text-gray-500 text-center">
            or click to browse
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={PDF_ACCEPTED.join(',')}
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
        <p className="text-xs font-mono text-gray-600 text-center leading-relaxed">
          Imports cvgen and EuroPass PDF exports.
          <br />
          cvgen PDFs restore style, colors and layout.
        </p>
      </div>
    )
  }

  // ── loading ────────────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return (
      <div className="p-4 flex flex-col gap-3 items-center justify-center min-h-[120px]">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-gray-400 text-center">
          Extracting from {state.filename}...
        </p>
      </div>
    )
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="rounded-lg bg-red-950/40 border border-red-800 p-4">
          <p className="text-xs font-mono text-red-400 leading-relaxed">{state.message}</p>
        </div>
        <button
          onClick={reset}
          className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors text-left"
        >
          &larr; Try again
        </button>
      </div>
    )
  }

  // ── done ──────────────────────────────────────────────────────────────────
  if (state.phase === 'done') {
    return (
      <div className="p-4 flex flex-col gap-3">
        <p className="text-sm font-mono text-green-400">Import complete.</p>
        <button
          onClick={reset}
          className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors text-left"
        >
          &larr; Import another file
        </button>
      </div>
    )
  }

  // ── review ────────────────────────────────────────────────────────────────
  const { payload } = state
  const isCvgen = payload.type === 'cvgen'

  const meta = isCvgen ? payload.cv.meta : payload.meta
  const sections = isCvgen ? payload.cv.sections : payload.sections

  const photoSizeKb = meta.photoUrl
    ? Math.round((meta.photoUrl.length * 3) / (4 * 1024))
    : 0

  const metaFields: [string, string | undefined][] = [
    ['name', meta.name],
    ['title', meta.title],
    ['email', meta.email],
    ['phone', meta.phone],
    ['location', meta.location],
  ]

  function handleConfirm() {
    if (isCvgen) {
      replaceCV(payload.cv)
    } else {
      importCV(payload.meta, payload.sections)
    }
    setState({ phase: 'done' })
  }

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto">

      {/* Source badge */}
      <div className="flex items-center gap-2">
        {isCvgen ? (
          <span className="text-xs font-mono bg-green-900/50 text-green-400 border border-green-700/60 px-2 py-0.5 rounded">
            cvgen
          </span>
        ) : (
          <span className="text-xs font-mono bg-blue-900/50 text-blue-400 border border-blue-700/60 px-2 py-0.5 rounded">
            EuroPass
          </span>
        )}
        {isCvgen && (
          <span className="text-xs font-mono text-green-500/80">
            Full fidelity — style, colors and layout preserved
          </span>
        )}
      </div>

      {/* Photo thumbnail */}
      {meta.photoUrl && (
        <div>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">Photo</p>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.photoUrl}
              alt="Profile photo"
              className="h-14 w-14 object-cover rounded border border-gray-700"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-green-400">Photo detected</span>
              <span className="text-xs font-mono text-gray-500">~{photoSizeKb} KB</span>
              {photoSizeKb > 500 && (
                <span className="text-xs font-mono text-yellow-400">Large — consider cropping</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Meta preview */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">Meta</p>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          {metaFields
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex gap-2 px-3 py-1.5 border-b border-gray-800 last:border-0">
                <span className="text-xs font-mono text-gray-500 w-16 flex-shrink-0">{k}</span>
                <span className="text-xs font-mono text-gray-200 truncate">{v}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Links preview */}
      {(meta.links?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
            Links ({meta.links!.length})
          </p>
          <div className="flex flex-col gap-1">
            {meta.links!.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-800 bg-gray-900"
              >
                <span className="text-xs font-mono text-blue-400 flex-shrink-0">{link.label}</span>
                <span className="text-xs font-mono text-gray-500 truncate">{link.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections list */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wide mb-2">
          Sections ({sections.length})
        </p>
        <div className="flex flex-col gap-1">
          {sections.map((sec, i) => {
            const count = countEntries(sec.content)
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded border border-gray-800 bg-gray-900"
              >
                <span className="text-xs font-mono text-blue-500 bg-blue-950/40 px-1.5 py-0.5 rounded flex-shrink-0">
                  {sec.type}
                </span>
                <span className="text-xs font-mono text-gray-200 flex-1 truncate">{sec.title}</span>
                {count > 0 && (
                  <span className="text-xs font-mono text-gray-600 flex-shrink-0">{count} entries</span>
                )}
              </div>
            )
          })}
          {sections.length === 0 && (
            <p className="text-xs font-mono text-gray-600">No sections found.</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          className="flex-1 py-2 text-sm font-mono bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          {isCvgen ? 'Restore CV' : 'Import CV'}
        </button>
        <button
          onClick={reset}
          className="flex-1 py-2 text-sm font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
