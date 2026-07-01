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

type InlineSegmentKind = 'text' | 'bold' | 'code'

interface InlineSegment {
  text: string
  kind: InlineSegmentKind
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

function parseInlineSegments(text: string): InlineSegment[] {
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  const segments: InlineSegment[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), kind: 'text' })
    }
    if (match[0].startsWith('**')) {
      segments.push({ text: match[2], kind: 'bold' })
    } else {
      segments.push({ text: match[3], kind: 'code' })
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last), kind: 'text' })
  }

  return segments
}

function renderInlineSegments(
  segments: InlineSegment[],
  style: CVStyle,
  color?: string,
  keyPrefix = 'inline'
): React.ReactNode {
  const baseColor = color ?? style.fgColor
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'bold') {
          return <span key={`${keyPrefix}-b-${index}`} style={{ color: baseColor, fontWeight: 700 }}>{segment.text}</span>
        }
        if (segment.kind === 'code') {
          return (
            <span
              key={`${keyPrefix}-c-${index}`}
              style={{
                color: style.accentColor,
                backgroundColor: style.codeBgColor,
                padding: '0 3px',
                borderRadius: '3px',
              }}
            >
              {segment.text}
            </span>
          )
        }
        return <span key={`${keyPrefix}-t-${index}`} style={{ color: baseColor }}>{segment.text}</span>
      })}
    </>
  )
}

function InlineText({ text, style, color, keyPrefix = 'inline' }: { text: string; style: CVStyle; color?: string; keyPrefix?: string }) {
  return <>{renderInlineSegments(parseInlineSegments(text), style, color, keyPrefix)}</>
}

function appendSegment(line: InlineSegment[], text: string, kind: InlineSegmentKind) {
  if (!text) return
  const previous = line[line.length - 1]
  if (previous?.kind === kind) {
    previous.text += text
  } else {
    line.push({ text, kind })
  }
}

function wrapInlineMarkdown(text: string, width: number): InlineSegment[][] {
  const result: InlineSegment[][] = []

  for (const paragraph of text.split('\n')) {
    const trimmed = paragraph.trimEnd()
    if (!trimmed) {
      result.push([])
      continue
    }

    let line: InlineSegment[] = []
    let lineLength = 0
    let pendingSpace = false

    const pushLine = () => {
      result.push(line)
      line = []
      lineLength = 0
      pendingSpace = false
    }

    for (const segment of parseInlineSegments(trimmed)) {
      const pieces = segment.text.split(/(\s+)/)
      for (const piece of pieces) {
        if (!piece) continue
        if (/^\s+$/.test(piece)) {
          pendingSpace = lineLength > 0
          continue
        }

        let word = piece
        const spaceLength = pendingSpace && lineLength > 0 ? 1 : 0
        if (lineLength > 0 && lineLength + spaceLength + word.length > width) {
          pushLine()
        } else if (spaceLength) {
          appendSegment(line, ' ', segment.kind)
          lineLength += 1
        }

        while (word.length > 0) {
          const available = width - lineLength
          if (available <= 0) {
            pushLine()
            continue
          }

          const chunk = word.slice(0, available)
          appendSegment(line, chunk, segment.kind)
          lineLength += chunk.length
          word = word.slice(chunk.length)

          if (word.length > 0) pushLine()
        }

        pendingSpace = false
      }
    }

    if (line.length > 0) result.push(line)
  }

  while (result.length && result[result.length - 1].length === 0) result.pop()
  return result
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
        const descLines = wrapInlineMarkdown(entry.description, WRAP_WIDTH)

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
            {descLines.map((line, li) => (
              <PreLine key={li} prefix={pipe} prefixColor={style.mutedColor}>
                {line.length > 0 && renderInlineSegments(line, style, style.mutedColor, `vertical-${i}-${li}`)}
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
