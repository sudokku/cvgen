'use client'

import { useCVStore } from '@/store/cv-store'
import { CVStyle, DocMode, FONT_OPTIONS, STYLE_PRESETS } from '@/types/cv'

export function StyleEditor() {
  const { cv, updateStyle, updateDocMode } = useCVStore()
  const { style } = cv
  const docMode = cv.docMode

  const colorField = (label: string, key: keyof CVStyle) => (
    <label className="flex items-center justify-between gap-2" key={key}>
      <span className="text-xs font-mono text-gray-400 truncate">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={style[key] as string}
          onChange={(e) => updateStyle({ [key]: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer border border-gray-700 bg-transparent p-0"
        />
        <input
          type="text"
          value={style[key] as string}
          onChange={(e) => updateStyle({ [key]: e.target.value })}
          className="w-20 bg-transparent border border-gray-700 rounded px-1.5 py-0.5 text-xs font-mono text-gray-300 focus:outline-none focus:border-gray-500"
          spellCheck={false}
        />
      </div>
    </label>
  )

  return (
    <div className="p-3 space-y-4 overflow-y-auto h-full">
      {/* Render mode */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Render Mode</p>
        <div className="flex gap-1">
          {(['md', 'json', 'per-section'] as DocMode[]).map((m) => (
            <button
              key={m}
              onClick={() => updateDocMode(m)}
              className={`flex-1 px-2 py-1 rounded text-xs font-mono border transition-colors ${
                docMode === m
                  ? 'border-blue-500 text-blue-400 bg-blue-950'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Presets</p>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => updateStyle(preset)}
              className="text-xs font-mono text-gray-400 hover:text-gray-100 hover:bg-gray-800 px-2 py-1 rounded text-left border border-transparent hover:border-gray-700 transition-colors"
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Font family */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Font</p>
        <select
          value={style.fontFamily}
          onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-300 focus:outline-none focus:border-gray-500"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600 mt-1">
          Note: custom fonts (Monaspace, Fira Code, etc.) must be installed on your system.
        </p>
      </div>

      {/* Font size */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">
          Size — {style.fontSize}px
        </p>
        <input
          type="range"
          min={10}
          max={18}
          value={style.fontSize}
          onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Colors */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Colors</p>
        <div className="space-y-2">
          {colorField('background', 'bgColor')}
          {colorField('text', 'fgColor')}
          {colorField('muted', 'mutedColor')}
          {colorField('accent / link', 'accentColor')}
          {colorField('border', 'borderColor')}
          {colorField('code bg', 'codeBgColor')}
        </div>
      </div>

      {/* JSON colors — only shown when relevant */}
      {(docMode === 'json' || docMode === 'per-section') && (
        <div>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">JSON Colors</p>
          <div className="space-y-2">
            {colorField('key', 'jsonKeyColor')}
            {colorField('string', 'jsonStringColor')}
            {colorField('number', 'jsonNumberColor')}
            {colorField('punctuation', 'jsonPunctuationColor')}
          </div>
        </div>
      )}

      {/* Semantic Colors */}
      <div>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1.5">Semantic Colors</p>
        <div className="space-y-2">
          {colorField('heading', 'headingColor')}
          {colorField('subtitle', 'subtitleColor')}
          {colorField('period', 'periodColor')}
          {colorField('role / degree', 'roleColor')}
          {colorField('company', 'companyColor')}
          {colorField('category', 'categoryColor')}
          {colorField('project title', 'projectTitleColor')}
        </div>
      </div>
    </div>
  )
}
