'use client'

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
  return (
    <div>
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1
        const prefix = isLast ? '└─' : '├─'
        const continuation = isLast ? '  ' : '│ '
        const period = entry.period ? ` ${entry.period.padEnd(14)}` : '               '

        return (
          <div key={i} style={{ fontFamily: 'inherit', marginBottom: isLast ? 0 : '2px' }}>
            {/* header line */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ color: style.mutedColor, flexShrink: 0 }}>{prefix}</span>
              {entry.period && (
                <span style={{ color: style.accentColor, flexShrink: 0 }}>{period.trim()}</span>
              )}
              <span style={{ color: style.fgColor, fontWeight: 600 }}>{entry.role}</span>
              {entry.company && (
                <span style={{ color: style.mutedColor }}>@ {entry.company}</span>
              )}
            </div>
            {/* description indented under connector */}
            {entry.description && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <span style={{ color: style.mutedColor, flexShrink: 0 }}>{continuation}</span>
                <span
                  style={{ color: style.mutedColor, whiteSpace: 'pre-wrap', flex: 1 }}
                >
                  {entry.description}
                </span>
              </div>
            )}
            {/* spacing line between entries */}
            {!isLast && (
              <div style={{ color: style.mutedColor }}>{continuation}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
