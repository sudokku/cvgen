'use client'

import { useRef, useCallback } from 'react'
import { useCVStore } from '@/store/cv-store'
import { useAsciiGenerator } from '@/lib/use-ascii'

const DEFAULT_WIDTH = 50
const DEFAULT_HEIGHT = 25

export function MetaEditor() {
  const { cv, updateMeta } = useCVStore()
  const { meta } = cv
  const fileRef = useRef<HTMLInputElement>(null)
  const generate = useAsciiGenerator()

  const width = meta.photoWidth ?? DEFAULT_WIDTH
  const height = meta.photoHeight ?? DEFAULT_HEIGHT

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
    async (file: File, cols = DEFAULT_WIDTH) => {
      if (!file.type.match(/^image\/jpe?g$/)) {
        alert('Only JPG/JPEG images are supported (no transparent backgrounds).')
        return
      }
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        updateMeta({ photoUrl: dataUrl, photoAscii: undefined })
        const ascii = await generate(dataUrl, { cols })
        if (ascii) updateMeta({ photoAscii: ascii })
      }
      reader.readAsDataURL(file)
    },
    [updateMeta, generate]
  )

  const handleWidthChange = useCallback(
    async (newWidth: number) => {
      updateMeta({ photoWidth: newWidth })
      if (!meta.photoUrl) return
      updateMeta({ photoAscii: undefined })
      const ascii = await generate(meta.photoUrl, { cols: newWidth })
      if (ascii) updateMeta({ photoAscii: ascii })
    },
    [meta.photoUrl, updateMeta, generate]
  )

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">About</p>

      {/* Photo upload */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Photo</span>
        <div
          className="border border-dashed border-gray-700 rounded p-2 text-center cursor-pointer hover:border-gray-500 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) handlePhoto(file, width)
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
            <span className="text-xs text-gray-600 font-mono">drop JPG or click</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhoto(file, width)
            e.target.value = ''
          }}
        />

        {/* Size controls — only shown once a photo is uploaded */}
        {meta.photoUrl && (
          <div className="space-y-1.5 pt-1">
            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-gray-500">
                width — {width} cols
              </span>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={width}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-gray-500">
                height — {height} rows
              </span>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={height}
                onChange={(e) => updateMeta({ photoHeight: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </label>
            <button
              onClick={() => updateMeta({ photoUrl: undefined, photoAscii: undefined })}
              className="text-xs font-mono text-gray-600 hover:text-red-400 transition-colors"
            >
              remove photo
            </button>
          </div>
        )}
      </div>

      {field('Name', 'name', 'Your Name')}
      {field('Title', 'title', 'Software Engineer')}
      {field('Email', 'email', 'you@example.com', 'email')}
      {field('GitHub', 'github', 'username')}
      {field('LinkedIn', 'linkedin', 'username')}
      {field('Website', 'website', 'https://yoursite.com')}
      {field('Location', 'location', 'City, Country')}
    </div>
  )
}
