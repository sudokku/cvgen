'use client'

import { useRef, useCallback } from 'react'
import { useCVStore } from '@/store/cv-store'
import { useAsciiGenerator } from '@/lib/use-ascii'
import { CVLink } from '@/types/cv'

const DEFAULT_MAX_COLS = 50
const DEFAULT_MAX_ROWS = 25

export function MetaEditor() {
  const { cv, updateMeta } = useCVStore()
  const { meta } = cv
  const fileRef = useRef<HTMLInputElement>(null)
  const generate = useAsciiGenerator()

  const maxCols = meta.photoWidth ?? DEFAULT_MAX_COLS
  const maxRows = meta.photoHeight ?? DEFAULT_MAX_ROWS

  const field = (
    label: string,
    key: keyof typeof meta,
    placeholder: string,
    type = 'text'
  ) => (
    <label key={String(key)} className="flex flex-col gap-0.5">
      <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={(meta[key] as string) ?? ''}
        onChange={(e) => updateMeta({ [key]: e.target.value })}
        placeholder={placeholder}
        className="bg-transparent border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-400"
      />
    </label>
  )

  const handlePhoto = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(jpe?g|png|webp)$/)) {
        alert('Supported formats: JPG, PNG, WebP.')
        return
      }
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        updateMeta({ photoUrl: dataUrl, photoAscii: undefined })
        const ascii = await generate(dataUrl, { maxCols, maxRows })
        if (ascii) updateMeta({ photoAscii: ascii })
      }
      reader.readAsDataURL(file)
    },
    [updateMeta, generate, maxCols, maxRows]
  )

  const handleMaxColsChange = useCallback(
    async (newMaxCols: number) => {
      updateMeta({ photoWidth: newMaxCols, photoAscii: undefined })
      if (!meta.photoUrl) return
      const ascii = await generate(meta.photoUrl, { maxCols: newMaxCols, maxRows })
      if (ascii) updateMeta({ photoAscii: ascii })
    },
    [meta.photoUrl, maxRows, updateMeta, generate]
  )

  const handleMaxRowsChange = useCallback(
    async (newMaxRows: number) => {
      updateMeta({ photoHeight: newMaxRows, photoAscii: undefined })
      if (!meta.photoUrl) return
      const ascii = await generate(meta.photoUrl, { maxCols, maxRows: newMaxRows })
      if (ascii) updateMeta({ photoAscii: ascii })
    },
    [meta.photoUrl, maxCols, updateMeta, generate]
  )

  // ── Links management ──────────────────────────────────────────────────────
  // Check if old deprecated fields exist and no new links array yet
  const hasDeprecatedFields = !!(meta.github || meta.linkedin || meta.website)
  const hasLinks = (meta.links?.length ?? 0) > 0
  const links: CVLink[] = meta.links ?? []

  function updateLink(index: number, patch: Partial<CVLink>) {
    const next = links.map((l, i) => (i === index ? { ...l, ...patch } : l))
    updateMeta({ links: next })
  }

  function addLink() {
    updateMeta({ links: [...links, { label: '', url: '' }] })
  }

  function removeLink(index: number) {
    updateMeta({ links: links.filter((_, i) => i !== index) })
  }

  function migrateDeprecatedLinks() {
    const migrated: CVLink[] = []
    if (meta.github) migrated.push({ label: 'GitHub', url: `https://github.com/${meta.github}` })
    if (meta.linkedin) migrated.push({ label: 'LinkedIn', url: `https://linkedin.com/in/${meta.linkedin}` })
    if (meta.website) migrated.push({ label: 'Website', url: meta.website })
    updateMeta({ links: migrated, github: undefined, linkedin: undefined, website: undefined })
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">About</p>

      {/* Photo upload */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Photo</span>
        <div className="relative">
          {meta.photoUrl && (
            <button
              onClick={() => updateMeta({ photoUrl: undefined, photoAscii: undefined })}
              className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-gray-800 border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-500 transition-colors text-xs leading-none"
              title="Remove photo"
            >
              ×
            </button>
          )}
          <div
            className="border border-dashed border-gray-700 rounded p-2 text-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handlePhoto(file)
            }}
          >
          {meta.photoUrl ? (
            <div className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={meta.photoUrl} alt="Profile" className="h-16 w-16 object-cover rounded" />
              {meta.photoAscii ? (
                <span className="text-xs text-green-500 font-mono">ASCII ready</span>
              ) : (
                <span className="text-xs text-gray-500 font-mono">Generating...</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-600 font-mono py-2 block">drop JPG or click</span>
          )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhoto(file)
            e.target.value = ''
          }}
        />

        {/* ASCII / Image mode toggle — only when a photo is uploaded */}
        {meta.photoUrl && (
          <div className="flex gap-1 pt-1">
            {(['ascii', 'image'] as const).map((m) => (
              <button
                key={m}
                onClick={() => updateMeta({ photoMode: m })}
                className={`flex-1 px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  (meta.photoMode ?? 'ascii') === m
                    ? 'border-blue-500 text-blue-400 bg-blue-950'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Size controls — always shown so user can set bounds before uploading */}
        <div className="space-y-1.5 pt-1">
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-mono text-gray-500">
              max-width — {maxCols} cols
            </span>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={maxCols}
              onChange={(e) => handleMaxColsChange(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs font-mono text-gray-500">
              max-height — {maxRows} rows
            </span>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              value={maxRows}
              onChange={(e) => handleMaxRowsChange(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>
        </div>
      </div>

      {field('Name', 'name', 'Your Name')}
      {field('Title', 'title', 'Software Engineer')}
      {field('Email', 'email', 'you@example.com', 'email')}
      {field('Phone', 'phone', '+1 234 567 8900', 'tel')}
      {field('Location', 'location', 'City, Country')}

      {/* ── Links ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Links</span>
          <button
            onClick={addLink}
            className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors"
          >
            + add
          </button>
        </div>

        {/* One-time migration prompt */}
        {hasDeprecatedFields && !hasLinks && (
          <div className="rounded border border-yellow-800/60 bg-yellow-950/30 p-2 flex flex-col gap-1.5">
            <p className="text-xs font-mono text-yellow-400/80 leading-relaxed">
              Legacy GitHub / LinkedIn / Website fields detected.
            </p>
            <button
              onClick={migrateDeprecatedLinks}
              className="text-xs font-mono text-yellow-300 hover:text-yellow-200 transition-colors text-left"
            >
              Migrate to links list
            </button>
          </div>
        )}

        {links.map((link, i) => (
          <div key={i} className="flex flex-col gap-0.5 rounded border border-gray-800 p-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
                placeholder="Label"
                className="flex-1 bg-transparent border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-400"
              />
              <button
                onClick={() => removeLink(i)}
                className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-red-400 transition-colors text-xs flex-shrink-0"
                title="Remove link"
              >
                ×
              </button>
            </div>
            <input
              type="url"
              value={link.url}
              onChange={(e) => updateLink(i, { url: e.target.value })}
              placeholder="https://..."
              className="w-full bg-transparent border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-400"
            />
          </div>
        ))}

        {links.length === 0 && !hasDeprecatedFields && (
          <p className="text-xs font-mono text-gray-600">No links. Click + add.</p>
        )}
      </div>
    </div>
  )
}
