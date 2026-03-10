'use client'

import React from 'react'
import { parseTimelineEntries } from '@/lib/timeline-parser'
import { CVStyle, TimelineLayout } from '@/types/cv'

interface Props {
  content: string
  layout: TimelineLayout
  style: CVStyle
}

// Wrap a string to lines of at most `width` chars, splitting on spaces.
// Hard-breaks words that are longer than `width`.
function wordWrap(text: string, width: number): string[] {
  const result: string[] = []
  // Split on explicit newlines first (user line breaks / paragraph gaps)
  for (const paragraph of text.split('\n')) {
    const trimmed = paragraph.trimEnd()
    if (!trimmed) {
      result.push('')
      continue
    }
    const words = trimmed.split(' ')
    let line = ''
    for (const word of words) {
      if (!word) continue
      if (!line) {
        line = word
      } else if (line.length + 1 + word.length <= width) {
        line += ' ' + word
      } else {
        result.push(line)
        line = word
      }
    }
    if (line) result.push(line)
  }
  // Trim trailing empty lines
  while (result.length && result[result.length - 1] === '') result.pop()
  return result
}

// A single pre-formatted line: prefix chars + optional styled children
function PreLine({
  prefix,
  prefixColor,
  children,
}: {
  prefix: string
  prefixColor: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ whiteSpace: 'pre' }}>
      <span style={{ color: prefixColor }}>{prefix}</span>
      {children}
    </div>
  )
}

export function TimelineSection({ content, layout, style }: Props) {
  const entries = parseTimelineEntries(content)

  if (layout === 'horizontal') {
    return (
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
          {entries.map((entry, i) => {
            const label = entry.period ? `[${entry.period}]` : `[${entry.role}]`
            const connector = i < entries.length - 1 ? '────────' : ''
            return (
              <span key={i} style={{ color: style.mutedColor }}>
                <span style={{ color: style.accentColor }}>{label}</span>
                {connector}
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '6px' }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ minWidth: '160px', paddingRight: '8px', fontSize: `${style.fontSize}px` }}>
              <div style={{ color: style.fgColor, fontWeight: 600 }}>{entry.role}</div>
              {entry.company && <div style={{ color: style.mutedColor }}>@ {entry.company}</div>}
              {entry.description && (
                <div style={{ color: style.mutedColor, marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                  {entry.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Vertical ASCII tree ────────────────────────────────────────────────────
  //
  // Each entry renders as:
  //   ├─ {period}
  //   │  {role} @ {company}
  //   │
  //   │  {description line 1}
  //   │  {description line 2}
  //   ...
  //   ├─ (next entry)
  //
  // Last entry uses └─ / spaces instead of ├─ / │.
  // Description is pre-wrapped at WRAP_WIDTH chars so every visual line
  // gets its own │  prefix regardless of container width.

  const WRAP_WIDTH = 76 // chars of description text per line (prefix is 3 chars: "│  ")

  return (
    <div style={{ fontSize: `${style.fontSize}px`, lineHeight: 1.6 }}>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        const branch  = isLast ? '└─ ' : '├─ '
        const pipe    = isLast ? '   ' : '│  '
        const descLines = wordWrap(entry.description, WRAP_WIDTH)

        return (
          <div key={i}>
            {/* ├─ period */}
            <PreLine prefix={branch} prefixColor={style.mutedColor}>
              <span style={{ color: style.accentColor }}>{entry.period}</span>
            </PreLine>

            {/* │  role @ company */}
            <PreLine prefix={pipe} prefixColor={style.mutedColor}>
              <span style={{ color: style.fgColor, fontWeight: 600 }}>{entry.role}</span>
              {entry.company && (
                <span style={{ color: style.mutedColor }}> @ {entry.company}</span>
              )}
            </PreLine>

            {/* │  (blank gap before description) */}
            {descLines.length > 0 && (
              <PreLine prefix={pipe} prefixColor={style.mutedColor} />
            )}

            {/* │  description line × N */}
            {descLines.map((l, li) => (
              <PreLine key={li} prefix={pipe} prefixColor={style.mutedColor}>
                {l && <span style={{ color: style.mutedColor }}>{l}</span>}
              </PreLine>
            ))}

            {/* │  trailing gap after description before next entry */}
            {!isLast && (
              <PreLine prefix={pipe} prefixColor={style.mutedColor} />
            )}
          </div>
        )
      })}
    </div>
  )
}
