'use client'

import React from 'react'
import { parseTimelineEntries } from '@/lib/timeline-parser'
import { CVStyle, TimelineLayout } from '@/types/cv'

interface Props {
  content: string
  layout: TimelineLayout
  style: CVStyle
}

export function TimelineSection({ content, layout, style }: Props) {
  const entries = parseTimelineEntries(content)

  if (layout === 'horizontal') {
    // ASCII horizontal: [period]───[period]───[period]
    return (
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        {/* connector line */}
        <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
          {entries.map((entry, i) => {
            const label = entry.period
              ? `[${entry.period}]`
              : `[${entry.role}]`
            const connector = i < entries.length - 1 ? '────────' : ''
            return (
              <span key={i} style={{ color: style.mutedColor }}>
                <span style={{ color: style.accentColor }}>{label}</span>
                {connector}
              </span>
            )
          })}
        </div>
        {/* entries below */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '6px' }}>
          {entries.map((entry, i) => {
            const slotWidth = 160
            return (
              <div
                key={i}
                style={{
                  minWidth: `${slotWidth}px`,
                  paddingRight: '8px',
                  fontSize: `${style.fontSize}px`,
                }}
              >
                <div style={{ color: style.fgColor, fontWeight: 600 }}>{entry.role}</div>
                {entry.company && (
                  <div style={{ color: style.mutedColor }}>@ {entry.company}</div>
                )}
                {entry.description && (
                  <div style={{ color: style.mutedColor, marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                    {entry.description}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // vertical ASCII tree
  const line = (content: React.ReactNode, color = style.mutedColor) => (
    <div style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>
  )

  return (
    <div>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        const prefix = isLast ? '└─' : '├─'
        const descLines = entry.description
          ? entry.description.split('\n').filter((l) => l.trim())
          : []

        return (
          <div key={i}>
            {/* branch symbol */}
            {line(prefix)}

            {/* period */}
            {entry.period && line(entry.period, style.accentColor)}

            {/* role */}
            {line(entry.role, style.fgColor)}

            {/* company */}
            {entry.company && line(`@ ${entry.company}`)}

            {/* description lines, each prefixed with │ */}
            {descLines.length > 0 && (
              <>
                {line('│')}
                {descLines.map((l, li) => (
                  <div key={li} style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ color: style.mutedColor, flexShrink: 0 }}>│</span>
                    <span style={{ color: style.mutedColor, whiteSpace: 'pre-wrap', flex: 1 }}>{l}</span>
                  </div>
                ))}
              </>
            )}

            {/* connector to next entry */}
            {!isLast && line('│')}
          </div>
        )
      })}
    </div>
  )
}
