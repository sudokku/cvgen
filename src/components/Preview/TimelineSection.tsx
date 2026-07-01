'use client'

import React from 'react'
import { CVStyle, TimelineLayout } from '@/types/cv'

export interface TimelineDisplayEntry {
  role: string
  company: string
  period: string
  description: string
}

interface Props {
  entries: TimelineDisplayEntry[]
  layout: TimelineLayout
  style: CVStyle
}

const decorativeStyle: React.CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

function TimelinePrefix({ prefix, color }: { prefix: string; color: string }) {
  const isBranch = prefix.startsWith('├') || prefix.startsWith('└')
  const isLastBranch = prefix.startsWith('└')
  const isPipe = prefix.startsWith('│')

  return (
    <span
      aria-hidden="true"
      style={{
        ...decorativeStyle,
        display: 'inline-block',
        position: 'relative',
        width: '3ch',
        height: '1.6em',
        verticalAlign: 'top',
      }}
    >
      {(isPipe || isBranch) && (
        <span
          style={{
            position: 'absolute',
            left: '0.38ch',
            top: isLastBranch ? 0 : 0,
            bottom: isLastBranch ? '50%' : 0,
            borderLeft: `1px solid ${color}`,
          }}
        />
      )}
      {isBranch && (
        <span
          style={{
            position: 'absolute',
            left: '0.38ch',
            top: '50%',
            width: '1.15ch',
            borderTop: `1px solid ${color}`,
          }}
        />
      )}
    </span>
  )
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
      <TimelinePrefix prefix={prefix} color={prefixColor} />
      {children}
    </div>
  )
}

function InlineText({ text, style, color, keyPrefix = 'inline' }: { text: string; style: CVStyle; color?: string; keyPrefix?: string }) {
  const baseColor = color ?? style.fgColor
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  const tokens: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push(<span key={`${keyPrefix}-t-${last}`} style={{ color: baseColor }}>{text.slice(last, match.index)}</span>)
    }
    if (match[0].startsWith('**')) {
      tokens.push(<span key={`${keyPrefix}-b-${match.index}`} style={{ color: baseColor, fontWeight: 700 }}>{match[2]}</span>)
    } else {
      tokens.push(
        <span
          key={`${keyPrefix}-c-${match.index}`}
          style={{
            color: style.accentColor,
            backgroundColor: style.codeBgColor,
            padding: '0 3px',
            borderRadius: '3px',
          }}
        >
          {match[3]}
        </span>
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    tokens.push(<span key={`${keyPrefix}-t-end`} style={{ color: baseColor }}>{text.slice(last)}</span>)
  }

  return <>{tokens}</>
}

export function TimelineSection({ entries, layout, style }: Props) {
  if (layout === 'horizontal') {
    return (
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
          {entries.map((entry, i) => {
            const label = entry.period ? `[${entry.period}]` : `[${entry.role}]`
            const connector = i < entries.length - 1 ? '────────' : ''
            return (
              <span key={i} style={{ color: style.mutedColor }}>
                <span style={{ color: style.periodColor }}>{label}</span>
                {connector && (
                  <span
                    aria-hidden="true"
                    style={{
                      ...decorativeStyle,
                      display: 'inline-block',
                      width: '8ch',
                      borderTop: `1px solid ${style.mutedColor}`,
                      verticalAlign: 'middle',
                    }}
                  />
                )}
              </span>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: '6px' }}>
          {entries.map((entry, i) => (
            <div key={i} style={{ minWidth: '160px', paddingRight: '8px', fontSize: `${style.fontSize}px` }}>
              <div style={{ color: style.roleColor, fontWeight: 600 }}>{entry.role}</div>
              {entry.company && <div style={{ color: style.companyColor }}>@ {entry.company}</div>}
              {entry.description && (
                <div style={{ color: style.mutedColor, marginTop: '2px', whiteSpace: 'pre-wrap' }}>
                  <InlineText text={entry.description} style={style} color={style.mutedColor} keyPrefix={`horizontal-${i}`} />
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
          <div key={i} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            {/* ├─ period */}
            <PreLine prefix={branch} prefixColor={style.mutedColor}>
              <span style={{ color: style.periodColor }}>{entry.period}</span>
            </PreLine>

            {/* │  role @ company */}
            <PreLine prefix={pipe} prefixColor={style.mutedColor}>
              <span style={{ color: style.roleColor, fontWeight: 600 }}>{entry.role}</span>
              {entry.company && (
                <span style={{ color: style.companyColor }}> @ {entry.company}</span>
              )}
            </PreLine>

            {/* │  description line × N */}
            {descLines.map((l, li) => (
              <PreLine key={li} prefix={pipe} prefixColor={style.mutedColor}>
                {l && <InlineText text={l} style={style} color={style.mutedColor} keyPrefix={`vertical-${i}-${li}`} />}
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
