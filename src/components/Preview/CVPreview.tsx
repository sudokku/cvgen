'use client'

import { CV, CVSection, CVStyle } from '@/types/cv'
import { TimelineSection } from './TimelineSection'
import { clipAscii } from '@/lib/clip-ascii'

interface Props {
  cv: CV
}

function rule(style: CVStyle, char = '─', len = 60): string {
  return char.repeat(len)
}

function PhotoPlaceholder({ cols, rows, style }: { cols: number; rows: number; style: CVStyle }) {
  const inner = '[Photo]'
  const lineWidth = Math.max(cols, inner.length + 4)
  const top = '┌' + '─'.repeat(lineWidth - 2) + '┐'
  const bottom = '└' + '─'.repeat(lineWidth - 2) + '┘'
  const emptyLine = '│' + ' '.repeat(lineWidth - 2) + '│'
  const mid = Math.floor(rows / 2)
  const pad = Math.floor((lineWidth - 2 - inner.length) / 2)
  const centeredLine = '│' + ' '.repeat(pad) + inner + ' '.repeat(lineWidth - 2 - pad - inner.length) + '│'

  const lines = [top]
  for (let i = 1; i < rows - 1; i++) lines.push(i === mid ? centeredLine : emptyLine)
  lines.push(bottom)

  return (
    <pre
      style={{
        fontFamily: 'inherit',
        fontSize: `${Math.max(style.fontSize - 4, 7)}px`,
        lineHeight: 1,
        color: style.borderColor,
        margin: 0,
        whiteSpace: 'pre',
        flexShrink: 0,
      }}
    >
      {lines.join('\n')}
    </pre>
  )
}

function SectionBlock({ section, style }: { section: CVSection; style: CVStyle }) {
  const isTimeline =
    (section.type === 'experience' || section.type === 'education') &&
    section.layout !== 'list'

  const headingSize = Math.round(style.fontSize * 1.1)

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Section heading */}
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            fontSize: `${headingSize}px`,
            fontWeight: 700,
            color: style.fgColor,
            letterSpacing: '0.03em',
          }}
        >
          ## {section.title}
        </div>
        {section.subtitle && (
          <div style={{ color: style.mutedColor, marginTop: '2px' }}>
            {section.subtitle}
          </div>
        )}
        <div style={{ color: style.borderColor, marginTop: '3px', letterSpacing: '-1px' }}>
          {rule(style, '─', 56)}
        </div>
      </div>

      {/* Photo section */}
      {section.type === 'photo' && (
        <div>
          {section.photoAscii ? (
            <pre
              style={{
                fontFamily: 'inherit',
                fontSize: `${Math.max(style.fontSize - 3, 8)}px`,
                lineHeight: 1,
                color: style.mutedColor,
                margin: 0,
                whiteSpace: 'pre',
                backgroundColor: style.codeBgColor,
                padding: '12px',
                borderRadius: '4px',
              }}
            >
              {clipAscii(section.photoAscii, section.photoHeight ?? 40)}
            </pre>
          ) : (
            <span style={{ color: style.mutedColor, fontStyle: 'italic' }}>
              {`<!-- upload a photo to generate ASCII art -->`}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      {isTimeline && (
        <TimelineSection
          content={section.content}
          layout={section.layout ?? 'vertical'}
          style={style}
        />
      )}

      {/* Plain content (pre-formatted, markdown-raw) */}
      {!isTimeline && section.type !== 'photo' && (
        <pre
          style={{
            fontFamily: 'inherit',
            fontSize: `${style.fontSize}px`,
            color: style.fgColor,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {renderInlineMarkdown(section.content, style)}
        </pre>
      )}
    </div>
  )
}

/**
 * Minimal inline markdown renderer that outputs React spans.
 * Handles **bold**, `code`, and preserves everything else as-is.
 * No HTML injection — pure text + spans.
 */
function renderInlineMarkdown(
  text: string,
  style: CVStyle
): React.ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    const parts = parseInline(line, style)
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function parseInline(line: string, style: CVStyle): React.ReactNode[] {
  // Handle ### headings
  if (line.startsWith('### ')) {
    return [
      <span key="h3" style={{ color: style.fgColor, fontWeight: 600 }}>
        {line}
      </span>,
    ]
  }
  if (line.startsWith('## ')) {
    return [
      <span key="h2" style={{ color: style.fgColor, fontWeight: 700 }}>
        {line}
      </span>,
    ]
  }
  if (line.startsWith('# ')) {
    return [
      <span key="h1" style={{ color: style.fgColor, fontWeight: 700 }}>
        {line}
      </span>,
    ]
  }

  // tokenize **bold** and `code`
  const tokens: React.ReactNode[] = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) {
      tokens.push(
        <span key={`t-${last}`} style={{ color: style.fgColor }}>
          {line.slice(last, match.index)}
        </span>
      )
    }
    if (match[0].startsWith('**')) {
      tokens.push(
        <span key={`b-${match.index}`} style={{ color: style.fgColor, fontWeight: 700 }}>
          {match[2]}
        </span>
      )
    } else {
      tokens.push(
        <span
          key={`c-${match.index}`}
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

  if (last < line.length) {
    tokens.push(
      <span key={`t-end`} style={{ color: style.fgColor }}>
        {line.slice(last)}
      </span>
    )
  }

  return tokens
}

export function CVPreview({ cv }: Props) {
  const { meta, sections, style } = cv

  const contactLinks: { label: string; href: string }[] = [
    meta.email    ? { label: meta.email,                           href: `mailto:${meta.email}` }                          : null,
    meta.github   ? { label: `github.com/${meta.github}`,         href: `https://github.com/${meta.github}` }             : null,
    meta.linkedin ? { label: `linkedin.com/in/${meta.linkedin}`,  href: `https://linkedin.com/in/${meta.linkedin}` }      : null,
    meta.website  ? { label: meta.website,                        href: meta.website.startsWith('http') ? meta.website : `https://${meta.website}` } : null,
    meta.location ? { label: meta.location,                       href: '' }                                               : null,
  ].filter(Boolean) as { label: string; href: string }[]

  return (
    <div
      id="cv-preview"
      style={{
        fontFamily: style.fontFamily,
        fontSize: `${style.fontSize}px`,
        backgroundColor: style.bgColor,
        color: style.fgColor,
        padding: '40px 48px',
        minHeight: '100%',
        lineHeight: 1.6,
        maxWidth: '860px',
        margin: '0 auto',
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* left: name + contact */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: `${Math.round(style.fontSize * 2)}px`,
                fontWeight: 700,
                color: style.fgColor,
                letterSpacing: '0.02em',
              }}
            >
              # {meta.name}
            </div>

            {meta.title && (
              <div
                style={{
                  fontSize: `${Math.round(style.fontSize * 1.3)}px`,
                  color: style.mutedColor,
                  marginTop: '4px',
                }}
              >
                {meta.title}
              </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {contactLinks.map(({ label, href }) =>
                href ? (
                  <a
                    key={label}
                    href={href}
                    target={href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noreferrer"
                    style={{ color: style.accentColor, textDecoration: 'none', letterSpacing: '0.01em' }}
                  >
                    {label}
                  </a>
                ) : (
                  <span key={label} style={{ color: style.mutedColor, letterSpacing: '0.01em' }}>
                    {label}
                  </span>
                )
              )}
            </div>
          </div>{/* end left col */}

          {/* right: ASCII photo or placeholder */}
          {meta.photoAscii ? (
            <pre
              style={{
                fontFamily: 'inherit',
                fontSize: `${Math.max(style.fontSize - 4, 7)}px`,
                lineHeight: 1,
                color: style.mutedColor,
                margin: 0,
                whiteSpace: 'pre',
                flexShrink: 0,
              }}
            >
              {clipAscii(meta.photoAscii, meta.photoHeight ?? 25)}
            </pre>
          ) : (
            <PhotoPlaceholder
              cols={meta.photoWidth ?? 25}
              rows={meta.photoHeight ?? 25}
              style={style}
            />
          )}
        </div>{/* end flex row */}

        <div
          style={{
            marginTop: '12px',
            color: style.borderColor,
            letterSpacing: '-1px',
          }}
        >
          {rule(style, '═', 60)}
        </div>
      </div>

      {/* ── Sections ── */}
      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} style={style} />
      ))}
    </div>
  )
}
