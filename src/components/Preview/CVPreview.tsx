'use client'

import { CV, CVLink, CVSection, CVStyle, DocMode, RenderMode } from '@/types/cv'
import { TimelineSection } from './TimelineSection'
import { clipAscii } from '@/lib/clip-ascii'
import { JsonSectionBlock, JKey, JStr, JPunct } from './JsonSectionBlock'

interface Props {
  cv: CV
}

function Rule({ style, char = '─' }: { style: CVStyle; char?: string }) {
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', color: style.borderColor, letterSpacing: '-1px' }}>
      {char.repeat(300)}
    </div>
  )
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
  const effectiveStyle = section.sectionColors
    ? { ...style, ...section.sectionColors }
    : style

  const isTimeline =
    (section.type === 'experience' || section.type === 'education') &&
    section.layout !== 'list'

  const headingSize = Math.round(effectiveStyle.fontSize * 1.1)

  const h3Color = section.type === 'projects'
    ? effectiveStyle.projectTitleColor
    : (section.type === 'experience' || section.type === 'education')
    ? effectiveStyle.roleColor
    : effectiveStyle.fgColor

  const preStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: `${effectiveStyle.fontSize}px`,
    color: effectiveStyle.fgColor,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    lineHeight: 1.6,
  }

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Section heading */}
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            fontSize: `${headingSize}px`,
            fontWeight: 700,
            color: effectiveStyle.headingColor,
            letterSpacing: '0.03em',
          }}
        >
          ## {section.title}
        </div>
        {section.subtitle && (
          <div style={{ color: effectiveStyle.subtitleColor, marginTop: '2px' }}>
            {section.subtitle}
          </div>
        )}
        <div style={{ marginTop: '3px' }}>
          <Rule style={effectiveStyle} char="─" />
        </div>
      </div>

      {/* Photo section */}
      {section.type === 'photo' && (
        <div>
          {section.photoMode === 'image' && section.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={section.photoUrl}
              alt="Photo"
              style={{
                maxWidth:  `${Math.round((section.photoWidth  ?? 80) * Math.max(effectiveStyle.fontSize - 3, 8) / 1.7)}px`,
                maxHeight: `${Math.round((section.photoHeight ?? 40) * Math.max(effectiveStyle.fontSize - 3, 8))}px`,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : section.photoAscii ? (
            <pre
              style={{
                fontFamily: 'inherit',
                fontSize: `${Math.max(effectiveStyle.fontSize - 3, 8)}px`,
                lineHeight: 1,
                color: effectiveStyle.mutedColor,
                margin: 0,
                whiteSpace: 'pre',
                backgroundColor: effectiveStyle.codeBgColor,
                padding: '12px',
                borderRadius: '4px',
              }}
            >
              {clipAscii(section.photoAscii, section.photoHeight ?? 40)}
            </pre>
          ) : (
            <span style={{ color: effectiveStyle.mutedColor, fontStyle: 'italic' }}>
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
          style={effectiveStyle}
        />
      )}

      {/* Plain content — skills and personal (both use key:value category rendering) */}
      {!isTimeline && section.type !== 'photo' && (section.type === 'skills' || section.type === 'personal') && (
        <pre style={preStyle}>
          {renderSkillsContent(section.content, effectiveStyle)}
        </pre>
      )}

      {/* Plain content — non-skills, non-personal */}
      {!isTimeline && section.type !== 'photo' && section.type !== 'skills' && section.type !== 'personal' && (
        <pre style={preStyle}>
          {renderInlineMarkdown(section.content, effectiveStyle, h3Color)}
        </pre>
      )}
    </div>
  )
}

/**
 * Skills-specific renderer that colors the category label (text before `:`)
 * with categoryColor.
 */
function renderSkillsContent(content: string, style: CVStyle): React.ReactNode[] {
  const lines = content.split('\n')
  return lines.map((line, li) => {
    const colonIdx = line.indexOf(':')
    const nodes: React.ReactNode[] = []
    if (colonIdx > 0 && !line.startsWith('#')) {
      const category = line.slice(0, colonIdx)
      const rest = line.slice(colonIdx)
      nodes.push(
        <span key="cat" style={{ color: style.categoryColor, fontWeight: 600 }}>{category}</span>,
        <span key="rest" style={{ color: style.fgColor }}>{rest}</span>
      )
    } else {
      nodes.push(...parseInline(line, style))
    }
    return (
      <span key={li}>
        {nodes}
        {li < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

/**
 * Minimal inline markdown renderer that outputs React spans.
 * Handles **bold**, `code`, and preserves everything else as-is.
 * No HTML injection — pure text + spans.
 */
function renderInlineMarkdown(
  text: string,
  style: CVStyle,
  h3Color?: string
): React.ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    const parts = parseInline(line, style, h3Color)
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function parseInline(line: string, style: CVStyle, h3Color?: string): React.ReactNode[] {
  // Handle ### headings
  if (line.startsWith('### ')) {
    return [
      <span key="h3" style={{ color: h3Color ?? style.fgColor, fontWeight: 600 }}>
        {line}
      </span>,
    ]
  }
  if (line.startsWith('## ')) {
    return [
      <span key="h2" style={{ color: style.headingColor, fontWeight: 700 }}>
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

function effectiveMode(docMode: DocMode, section: CVSection): RenderMode {
  if (docMode === 'json') return 'json'
  if (docMode === 'md')   return 'md'
  return section.renderMode ?? 'md'
}

function JsonHeaderBlock({ cv }: { cv: CV }) {
  const { meta, style } = cv
  // Resolve links: new meta.links takes precedence; fall back to deprecated fields
  const resolvedLinks: CVLink[] = meta.links && meta.links.length > 0
    ? meta.links
    : [
        ...(meta.github   ? [{ label: 'github',   url: `https://github.com/${meta.github}` }]        : []),
        ...(meta.linkedin ? [{ label: 'linkedin', url: `https://linkedin.com/in/${meta.linkedin}` }] : []),
        ...(meta.website  ? [{ label: 'website',  url: meta.website }]                               : []),
      ]
  const fields: [string, string][] = [
    ['name',     meta.name],
    ['title',    meta.title],
    ['email',    meta.email],
    ...resolvedLinks.map(({ label, url }) => [label, url] as [string, string]),
    ...(meta.phone    ? [['phone',    meta.phone]    as [string, string]] : []),
    ...(meta.location ? [['location', meta.location] as [string, string]] : []),
  ]

  return (
    <div style={{ marginBottom: '28px', fontFamily: 'inherit', fontSize: `${style.fontSize}px`, lineHeight: 1.6 }}>
      <div style={{ whiteSpace: 'pre' }}><JPunct text="{" style={style} /></div>
      {fields.map(([k, v], i) => (
        <div key={k} style={{ whiteSpace: 'pre' }}>
          {'  '}<JKey text={k} style={style} /><JPunct text=": " style={style} /><JPunct text='"' style={style} /><JStr style={style}>{v}</JStr><JPunct text={i < fields.length - 1 ? '",' : '"'} style={style} />
        </div>
      ))}
      <div style={{ whiteSpace: 'pre' }}><JPunct text="}" style={style} /></div>
      <div style={{ marginTop: '12px' }}>
        <Rule style={style} char="═" />
      </div>
    </div>
  )
}

export function CVPreview({ cv }: Props) {
  const { meta, sections, style } = cv

  // Build link list from meta.links (new) or fall back to deprecated individual fields
  const resolvedLinks: CVLink[] = meta.links && meta.links.length > 0
    ? meta.links
    : [
        ...(meta.github   ? [{ label: `github.com/${meta.github}`,        url: `https://github.com/${meta.github}` }]        : []),
        ...(meta.linkedin ? [{ label: `linkedin.com/in/${meta.linkedin}`, url: `https://linkedin.com/in/${meta.linkedin}` }] : []),
        ...(meta.website  ? [{ label: meta.website,                       url: meta.website.startsWith('http') ? meta.website : `https://${meta.website}` }] : []),
      ]

  const contactLinks: { label: string; href: string }[] = [
    meta.email    ? { label: meta.email,    href: `mailto:${meta.email}` } : null,
    ...resolvedLinks.map(({ label, url }) => ({ label, href: url.startsWith('http') ? url : `https://${url}` })),
    meta.phone    ? { label: meta.phone,    href: `tel:${meta.phone}` }   : null,
    meta.location ? { label: meta.location, href: '' }                     : null,
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
      {cv.docMode === 'json'
        ? <JsonHeaderBlock cv={cv} />
        : <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
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
              {contactLinks.map(({ label, href }, i) =>
                href ? (
                  <a
                    key={i}
                    href={href}
                    target={href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noreferrer"
                    style={{ color: style.accentColor, textDecoration: 'none', letterSpacing: '0.01em' }}
                  >
                    {label}
                  </a>
                ) : (
                  <span key={i} style={{ color: style.mutedColor, letterSpacing: '0.01em' }}>
                    {label}
                  </span>
                )
              )}
            </div>
          </div>{/* end left col */}

          {/* right: photo (image or ASCII) or placeholder */}
          {meta.photoMode === 'image' && meta.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.photoUrl}
              alt="Profile"
              style={{
                maxWidth:  `${Math.round((meta.photoWidth  ?? 50) * Math.max(style.fontSize - 4, 7) / 1.7)}px`,
                maxHeight: `${Math.round((meta.photoHeight ?? 25) * Math.max(style.fontSize - 4, 7))}px`,
                objectFit: 'contain',
                display: 'block',
                flexShrink: 0,
              }}
            />
          ) : meta.photoAscii ? (
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

      </div>
      }

      {/* ── Sections ── */}
      {cv.docMode === 'json' && (
        <div>
          {sections.map((section, i) => (
            <JsonSectionBlock
              key={section.id}
              section={section}
              style={style}
              isFirst={i === 0}
              isLast={i === sections.length - 1}
            />
          ))}
        </div>
      )}
      {cv.docMode !== 'json' && sections.map((section, i) => {
        const mode = effectiveMode(cv.docMode, section)
        return mode === 'json'
          ? <JsonSectionBlock key={section.id} section={section} style={style} isFirst={i === 0} isLast={i === sections.length - 1} />
          : <SectionBlock key={section.id} section={section} style={style} />
      })}
    </div>
  )
}
