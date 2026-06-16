'use client'

import { type ReactNode, useCallback, useRef, useState } from 'react'
import { useCVStore } from '@/store/cv-store'
import { CVSection, CVStyle, RenderMode, SectionType, TimelineLayout } from '@/types/cv'
import { useAsciiGenerator } from '@/lib/use-ascii'
import {
  type EducationEntryModel,
  type ExperienceEntryModel,
  type KeyValueModel,
  type ProjectEntryModel,
  type SkillGroupModel,
  canParseStructuredTimelineContent,
  parseEducationContent,
  parseExperienceContent,
  parseKeyValueContent,
  parseProjectContent,
  parseSkillsContent,
  serializeEducationContent,
  serializeExperienceContent,
  serializeKeyValueContent,
  serializeProjectContent,
  serializeSkillsContent,
} from '@/lib/section-formatting'

const TIMELINE_TYPES: SectionType[] = ['experience', 'education']
const DEFAULT_MAX_COLS = 80
const DEFAULT_MAX_ROWS = 40
const DEFAULT_DENSITY = 2
const fieldClass = 'bg-gray-950 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-gray-600'
const labelClass = 'text-xs font-mono text-gray-500'

const blankExperience: ExperienceEntryModel = { role: '', company: '', period: '', details: [] }
const blankEducation: EducationEntryModel = { degree: '', institution: '', period: '', details: [] }
const blankProject: ProjectEntryModel = { name: '', description: '', stack: [], repo: '' }
const blankSkill: SkillGroupModel = { category: '', items: [] }
const blankKeyValue: KeyValueModel = { key: '', value: '' }

export function SectionEditor() {
  const { cv, selectedSectionId, updateSection } = useCVStore()
  const docMode = cv.docMode
  const section = cv.sections.find((s) => s.id === selectedSectionId)
  const fileRef = useRef<HTMLInputElement>(null)
  const generate = useAsciiGenerator()
  const [colorsOpen, setColorsOpen] = useState(false)

  const update = useCallback(
    (patch: Partial<CVSection>) => {
      if (section) updateSection(section.id, patch)
    },
    [section, updateSection]
  )

  const maxCols = section?.photoWidth ?? DEFAULT_MAX_COLS
  const maxRows = section?.photoHeight ?? DEFAULT_MAX_ROWS
  const density = section?.photoDensity ?? DEFAULT_DENSITY
  const photoUrl = section?.photoUrl

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(jpe?g|png|webp)$/)) {
        alert('Supported formats: JPG, PNG, WebP.')
        return
      }
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        update({ photoUrl: dataUrl, photoAscii: undefined, photoAsciiColors: undefined })
        const result = await generate(dataUrl, { maxCols: maxCols * density, maxRows: maxRows * density })
        if (result) update({ photoAscii: result.ascii, photoAsciiColors: result.colors })
      }
      reader.readAsDataURL(file)
    },
    [update, generate, maxCols, maxRows, density]
  )

  const handleMaxColsChange = useCallback(
    async (newMaxCols: number) => {
      update({ photoWidth: newMaxCols, photoAscii: undefined, photoAsciiColors: undefined })
      if (!photoUrl) return
      const result = await generate(photoUrl, { maxCols: newMaxCols * density, maxRows: maxRows * density })
      if (result) update({ photoAscii: result.ascii, photoAsciiColors: result.colors })
    },
    [photoUrl, maxRows, density, update, generate]
  )

  const handleMaxRowsChange = useCallback(
    async (newMaxRows: number) => {
      update({ photoHeight: newMaxRows, photoAscii: undefined, photoAsciiColors: undefined })
      if (!photoUrl) return
      const result = await generate(photoUrl, { maxCols: maxCols * density, maxRows: newMaxRows * density })
      if (result) update({ photoAscii: result.ascii, photoAsciiColors: result.colors })
    },
    [photoUrl, maxCols, density, update, generate]
  )

  const handleDensityChange = useCallback(
    async (newDensity: number) => {
      update({ photoDensity: newDensity, photoAscii: undefined, photoAsciiColors: undefined })
      if (!photoUrl) return
      const result = await generate(photoUrl, { maxCols: maxCols * newDensity, maxRows: maxRows * newDensity })
      if (result) update({ photoAscii: result.ascii, photoAsciiColors: result.colors })
    },
    [photoUrl, maxCols, maxRows, update, generate]
  )

  if (!section) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Select a section to edit
      </div>
    )
  }

  const canUseTimeline = TIMELINE_TYPES.includes(section.type)
  const hasColorOverrides = !!(section.sectionColors && Object.keys(section.sectionColors).length > 0)

  const sectionColorField = (label: string, key: keyof CVStyle) => {
    const isOverridden = section.sectionColors?.[key] !== undefined
    const value = (section.sectionColors?.[key] as string) ?? (cv.style[key] as string)
    return (
      <label key={key} className="flex items-center justify-between gap-2">
        <span className={`text-xs font-mono truncate ${isOverridden ? 'text-blue-400' : 'text-gray-500'}`}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="color"
            value={value}
            onChange={(e) => update({ sectionColors: { ...section.sectionColors, [key]: e.target.value } })}
            className="w-6 h-6 rounded cursor-pointer border border-gray-700 bg-transparent p-0"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => update({ sectionColors: { ...section.sectionColors, [key]: e.target.value } })}
            className="w-20 bg-transparent border border-gray-700 rounded px-1.5 py-0.5 text-xs font-mono text-gray-300 focus:outline-none focus:border-gray-500"
            spellCheck={false}
          />
          <button
            onClick={() => {
              const newColors = { ...section.sectionColors }
              delete (newColors as Record<string, unknown>)[key as string]
              const hasKeys = Object.keys(newColors).length > 0
              update({ sectionColors: hasKeys ? newColors : undefined })
            }}
            disabled={!isOverridden}
            className="w-4 h-4 flex items-center justify-center text-xs text-gray-600 hover:text-red-400 disabled:opacity-0 transition-colors"
            title="Reset to global"
          >
            ×
          </button>
        </div>
      </label>
    )
  }

  const renderEntryActions = (onAdd: () => void) => (
    <button
      onClick={onAdd}
      className="text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors"
    >
      + add entry
    </button>
  )

  const renderExperienceControls = () => {
    const entries = parseExperienceContent(section.content)
    const editable = entries.length > 0 ? entries : [blankExperience]
    const commit = (next: ExperienceEntryModel[]) => update({ content: serializeExperienceContent(next) })
    return (
      <StructuredPanel title="Experience fields" addButton={renderEntryActions(() => commit([...editable, { role: 'Role', company: 'Company', period: 'Year-Year', details: [] }]))}>
        {editable.map((entry, index) => (
          <div key={index} className="rounded border border-gray-800 p-2 space-y-2">
            <div className="grid grid-cols-1 gap-2">
              <Field label="Job title" value={entry.role} onChange={(role) => commit(editAt(editable, index, { role }))} />
              <Field label="Company" value={entry.company} onChange={(company) => commit(editAt(editable, index, { company }))} />
              <Field label="Period" value={entry.period} onChange={(period) => commit(editAt(editable, index, { period }))} />
              <TextAreaField label="Details" value={entry.details.join('\n')} onChange={(details) => commit(editAt(editable, index, { details: details.split('\n') }))} />
            </div>
            {editable.length > 1 && <RemoveButton onClick={() => commit(editable.filter((_, i) => i !== index))} />}
          </div>
        ))}
      </StructuredPanel>
    )
  }

  const renderEducationControls = () => {
    const entries = parseEducationContent(section.content)
    const editable = entries.length > 0 ? entries : [blankEducation]
    const commit = (next: EducationEntryModel[]) => update({ content: serializeEducationContent(next) })
    return (
      <StructuredPanel title="Education fields" addButton={renderEntryActions(() => commit([...editable, { degree: 'Degree', institution: 'Institution', period: 'Year-Year', details: [] }]))}>
        {editable.map((entry, index) => (
          <div key={index} className="rounded border border-gray-800 p-2 space-y-2">
            <Field label="Degree" value={entry.degree} onChange={(degree) => commit(editAt(editable, index, { degree }))} />
            <Field label="Institution" value={entry.institution} onChange={(institution) => commit(editAt(editable, index, { institution }))} />
            <Field label="Period" value={entry.period} onChange={(period) => commit(editAt(editable, index, { period }))} />
            <TextAreaField label="Details" value={entry.details.join('\n')} onChange={(details) => commit(editAt(editable, index, { details: details.split('\n') }))} />
            {editable.length > 1 && <RemoveButton onClick={() => commit(editable.filter((_, i) => i !== index))} />}
          </div>
        ))}
      </StructuredPanel>
    )
  }

  const renderProjectControls = () => {
    const entries = parseProjectContent(section.content)
    const editable = entries.length > 0 ? entries : [blankProject]
    const commit = (next: ProjectEntryModel[]) => update({ content: serializeProjectContent(next) })
    return (
      <StructuredPanel title="Project fields" addButton={renderEntryActions(() => commit([...editable, { name: 'Project Name', description: '', stack: [], repo: '' }]))}>
        {editable.map((entry, index) => (
          <div key={index} className="rounded border border-gray-800 p-2 space-y-2">
            <Field label="Name" value={entry.name} onChange={(name) => commit(editAt(editable, index, { name }))} />
            <TextAreaField label="Description" value={entry.description} onChange={(description) => commit(editAt(editable, index, { description }))} />
            <Field label="Stack" value={entry.stack.join(', ')} onChange={(stack) => commit(editAt(editable, index, { stack: stack.split(',').map((item) => item.trim()) }))} />
            <Field label="Repo / link" value={entry.repo} onChange={(repo) => commit(editAt(editable, index, { repo }))} />
            {editable.length > 1 && <RemoveButton onClick={() => commit(editable.filter((_, i) => i !== index))} />}
          </div>
        ))}
      </StructuredPanel>
    )
  }

  const renderSkillsControls = () => {
    const groups = parseSkillsContent(section.content)
    const editable = groups.length > 0 ? groups : [blankSkill]
    const commit = (next: SkillGroupModel[]) => update({ content: serializeSkillsContent(next) })
    return (
      <StructuredPanel title="Skill groups" addButton={renderEntryActions(() => commit([...editable, { category: 'Category', items: [] }]))}>
        {editable.map((group, index) => (
          <div key={index} className="rounded border border-gray-800 p-2 space-y-2">
            <Field label="Category" value={group.category} onChange={(category) => commit(editAt(editable, index, { category }))} />
            <Field label="Items" value={group.items.join(' · ')} onChange={(items) => commit(editAt(editable, index, { items: items.split('·').map((item) => item.trim()) }))} />
            {editable.length > 1 && <RemoveButton onClick={() => commit(editable.filter((_, i) => i !== index))} />}
          </div>
        ))}
      </StructuredPanel>
    )
  }

  const renderPersonalControls = () => {
    const rows = parseKeyValueContent(section.content)
    const editable = rows.length > 0 ? rows : [blankKeyValue]
    const commit = (next: KeyValueModel[]) => update({ content: serializeKeyValueContent(next) })
    return (
      <StructuredPanel title="Personal fields" addButton={renderEntryActions(() => commit([...editable, { key: 'Field', value: '' }]))}>
        {editable.map((row, index) => (
          <div key={index} className="rounded border border-gray-800 p-2 space-y-2">
            <Field label="Label" value={row.key} onChange={(key) => commit(editAt(editable, index, { key }))} />
            <Field label="Value" value={row.value} onChange={(value) => commit(editAt(editable, index, { value }))} />
            {editable.length > 1 && <RemoveButton onClick={() => commit(editable.filter((_, i) => i !== index))} />}
          </div>
        ))}
      </StructuredPanel>
    )
  }

  const renderStructuredControls = () => {
    switch (section.type) {
      case 'experience':
        return canParseStructuredTimelineContent(section.content) ? renderExperienceControls() : null
      case 'education':
        return canParseStructuredTimelineContent(section.content) ? renderEducationControls() : null
      case 'projects':
        return canParseStructuredTimelineContent(section.content) ? renderProjectControls() : null
      case 'skills':
        return renderSkillsControls()
      case 'personal':
        return renderPersonalControls()
      default:
        return null
    }
  }

  return (
    <div className="p-3 space-y-3">
      {/* Section fields */}
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

      {/* Per-section render mode — only in per-section doc mode */}
      {docMode === 'per-section' && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-wide">Render</span>
          <div className="flex gap-2">
            {(['md', 'json'] as RenderMode[]).map((m) => (
              <button
                key={m}
                onClick={() => update({ renderMode: m })}
                className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                  (section.renderMode ?? 'md') === m
                    ? 'border-blue-500 text-blue-400 bg-blue-950'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Content area */}
      {section.type === 'photo' ? (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handlePhotoUpload(file)
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
              <div className="flex flex-col items-center justify-center gap-1 py-6">
                <p className="text-gray-500 text-xs font-mono">Drop photo here or click</p>
                <p className="text-gray-600 text-xs font-mono">JPG/JPEG only</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePhotoUpload(file)
                e.target.value = ''
              }}
            />
          </div>

          {/* ASCII / Image mode toggle — only when a photo is uploaded */}
          {section.photoUrl && (
            <div className="flex gap-1">
              {(['ascii', 'image'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update({ photoMode: m })}
                  className={`flex-1 px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                    (section.photoMode ?? 'ascii') === m
                      ? 'border-blue-500 text-blue-400 bg-blue-950'
                      : 'border-gray-700 text-gray-500 hover:border-gray-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Size controls */}
          <div className="space-y-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-gray-500">max-width — {maxCols} cols</span>
              <input
                type="range"
                min={20}
                max={120}
                step={5}
                value={maxCols}
                onChange={(e) => handleMaxColsChange(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-gray-500">max-height — {maxRows} rows</span>
              <input
                type="range"
                min={5}
                max={80}
                step={1}
                value={maxRows}
                onChange={(e) => handleMaxRowsChange(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </label>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-mono text-gray-500">density — {density}x</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDensityChange(d)}
                    className={`flex-1 px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
                      density === d
                        ? 'border-blue-500 text-blue-400 bg-blue-950'
                        : 'border-gray-700 text-gray-500 hover:border-gray-500'
                    }`}
                  >
                    {d}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ASCII preview */}
          {section.photoAscii && (
            <div className="max-h-48 overflow-auto">
              <pre
                className="font-mono whitespace-pre"
                style={{ fontSize: `${Math.max(4, 10 / density)}px`, lineHeight: 1, color: '#4ade80' }}
              >
                {section.photoAscii}
              </pre>
            </div>
          )}
          {section.photoUrl && !section.photoAscii && (
            <p className="text-xs text-gray-500 italic">Generating ASCII art...</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {renderStructuredControls()}
          {canUseTimeline && section.layout !== 'list' && (
            <p className="text-xs text-gray-600 font-mono mb-2">
              Format: <code className="text-gray-500">### Role @ Company | Period</code>
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">Source</span>
            <textarea
              value={section.content}
              onChange={(e) => update({ content: e.target.value })}
              className="w-full min-h-[180px] bg-gray-950 border border-gray-800 rounded p-2 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-gray-600 placeholder-gray-700"
              placeholder="Write markdown content here..."
              spellCheck={false}
            />
          </label>
        </div>
      )}

      {/* Collapsible Colors panel */}
      <div className="border-t border-gray-800 pt-3">
        <button
          onClick={() => setColorsOpen(!colorsOpen)}
          className="flex items-center justify-between w-full mb-1"
        >
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Colors {hasColorOverrides ? <span className="text-blue-400">●</span> : ''}
          </span>
          <span className="text-gray-600 text-xs">{colorsOpen ? '▲' : '▼'}</span>
        </button>
        {colorsOpen && (
          <div className="space-y-2 mt-1">
            {hasColorOverrides && (
              <button
                onClick={() => update({ sectionColors: undefined })}
                className="text-xs font-mono text-red-500 hover:text-red-400 transition-colors"
              >
                reset all to global
              </button>
            )}
            {sectionColorField('heading', 'headingColor')}
            {sectionColorField('subtitle', 'subtitleColor')}
            {sectionColorField('text', 'fgColor')}
            {sectionColorField('muted', 'mutedColor')}
            {sectionColorField('accent', 'accentColor')}
            {sectionColorField('period', 'periodColor')}
            {sectionColorField('role / degree', 'roleColor')}
            {sectionColorField('company', 'companyColor')}
            {sectionColorField('category', 'categoryColor')}
            {sectionColorField('project title', 'projectTitleColor')}
          </div>
        )}
      </div>
    </div>
  )
}

function StructuredPanel({
  title,
  addButton,
  children,
}: {
  title: string
  addButton: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded border border-gray-800 bg-gray-950/40 p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">{title}</span>
        {addButton}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={labelClass}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={labelClass}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} min-h-20 resize-y`} />
    </label>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs font-mono text-red-500 hover:text-red-400 transition-colors">
      remove
    </button>
  )
}

function editAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item))
}
