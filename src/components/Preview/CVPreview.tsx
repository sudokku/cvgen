'use client'

import { useEffect, useRef } from 'react'
import { CV, CVLink, CVSection, CVStyle, DocMode, LanguageEntry, PersonalRow, ProjectEntry, RenderMode, SkillGroup } from '@/types/cv'
import { TimelineDisplayEntry, TimelineSection } from './TimelineSection'
import { clipAscii } from '@/lib/clip-ascii'
import { AsciiArt } from './AsciiArt'
import { JsonSectionBlock, JKey, JStr, JPunct } from './JsonSectionBlock'
import { sectionToContent } from '@/lib/section-formatting'

interface Props {
  cv: CV
  containerStyle?: React.CSSProperties
}

const decorativeStyle: React.CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
}

function DecorativeText({
  text,
  color,
  weight = 700,
}: {
  text: string
  color: string
  weight?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = text.length * 10
    const height = 16
    const scale = window.devicePixelRatio || 1
    canvas.width = width * scale
    canvas.height = height * scale

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = color
    ctx.font = `${weight} 16px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`
    ctx.textBaseline = 'top'
    ctx.fillText(text, 0, 0)
  }, [color, text, weight])

  return (
    <canvas
      ref={canvasRef}
      role="presentation"
      aria-hidden="true"
      style={{
        ...decorativeStyle,
        display: 'inline-block',
        width: `${text.length * 0.62}em`,
        height: '1em',
        marginRight: '0.25em',
        verticalAlign: '-0.12em',
      }}
    />
  )
}

function Rule({ style, char = '─' }: { style: CVStyle; char?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...decorativeStyle,
        borderTop: `${char === '═' ? 2 : 1}px solid ${style.borderColor}`,
        height: 0,
        width: '100%',
      }}
    />
  )
}

function SectionBlock({ section, style }: { section: CVSection; style: CVStyle }) {
  const effectiveStyle = section.sectionColors
    ? { ...style, ...section.sectionColors }
    : style

  if (section.type === 'photo' && !section.photoUrl && !section.photoAscii) {
    return null
  }

  const isTimeline =
    (section.type === 'experience' || section.type === 'education') &&
    section.layout !== 'list'
  const generatedContent = sectionToContent(section)

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
      <div style={{ marginBottom: '8px', breakAfter: 'avoid', pageBreakAfter: 'avoid' }}>
        <div
          style={{
            fontSize: `${headingSize}px`,
            fontWeight: 700,
            color: effectiveStyle.headingColor,
            letterSpacing: '0.03em',
          }}
        >
          <DecorativeText text="##" color={effectiveStyle.headingColor} />
          {section.title}
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
            <AsciiArt
              ascii={clipAscii(section.photoAscii, (section.photoHeight ?? 40) * (section.photoDensity ?? 1))}
              colors={section.photoAsciiColors}
              baseCols={section.photoWidth ?? 80}
              density={section.photoDensity ?? 1}
              baseFontSize={Math.max(effectiveStyle.fontSize - 3, 8)}
              fallbackColor={effectiveStyle.mutedColor}
              background={effectiveStyle.codeBgColor}
              padding="12px"
              borderRadius="4px"
            />
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
          entries={timelineEntriesForSection(section)}
          layout={section.layout ?? 'vertical'}
          style={effectiveStyle}
        />
      )}

      {/* Plain content — skills */}
      {!isTimeline && section.type !== 'photo' && section.type === 'skills' && (
        <pre style={preStyle}>
          {renderSkillsContent(section.groups, effectiveStyle)}
        </pre>
      )}

      {/* Plain content — personal key/value pairs */}
      {!isTimeline && section.type !== 'photo' && section.type === 'personal' && (
        <pre style={preStyle}>
          {renderKeyValueContent(section.rows, effectiveStyle)}
        </pre>
      )}

      {/* Plain content — projects */}
      {!isTimeline && section.type !== 'photo' && section.type === 'projects' && (
        <pre style={preStyle}>
          {renderProjectsContent(section.entries, effectiveStyle, h3Color)}
        </pre>
      )}

      {/* Plain content — languages */}
      {!isTimeline && section.type !== 'photo' && section.type === 'languages' && (
        <pre style={preStyle}>
          {renderLanguagesContent(section.entries, effectiveStyle)}
        </pre>
      )}

      {/* Plain content — non-skills, non-personal */}
      {!isTimeline && section.type !== 'photo' && section.type !== 'skills' && section.type !== 'personal' && section.type !== 'projects' && section.type !== 'languages' && (
        <pre style={preStyle}>
          {renderInlineMarkdown(generatedContent, effectiveStyle, h3Color)}
        </pre>
      )}
    </div>
  )
}

/**
 * Skills-specific renderer that colors the category label (text before `:`)
 * with categoryColor.
 */
function timelineEntriesForSection(section: CVSection): TimelineDisplayEntry[] {
  if (section.type === 'experience') {
    return section.entries.map((entry) => ({
      role: entry.role,
      company: entry.company,
      period: entry.period,
      description: entry.details.join('\n'),
    }))
  }
  if (section.type === 'education') {
    return section.entries.map((entry) => ({
      role: entry.degree,
      company: entry.institution,
      period: entry.period,
      description: entry.details.join('\n'),
    }))
  }
  return []
}

function renderSkillsContent(rows: SkillGroup[], style: CVStyle): React.ReactNode[] {
  return rows.map((row, li) => {
    const nodes: React.ReactNode[] = []
    if (row.category) {
      nodes.push(
        <span key="cat" style={{ color: style.categoryColor, fontWeight: 600 }}>{row.category}</span>,
        <span key="colon" style={{ color: style.fgColor }}>:</span>,
        ...row.items.flatMap((item, itemIndex) => [
          itemIndex > 0 ? <span key={`sep-${itemIndex}`} style={{ color: style.fgColor }}> · </span> : <span key="space" style={{ color: style.fgColor }}> </span>,
          ...parseInline(item, style, undefined, `skill-${li}-${itemIndex}`),
        ])
      )
    } else {
      nodes.push(...parseInline(row.items.join(' · '), style, undefined, `skill-${li}`))
    }
    return (
      <span key={li}>
        {nodes}
        {li < rows.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function renderKeyValueContent(rows: PersonalRow[], style: CVStyle): React.ReactNode[] {
  return rows.map((row, li) => (
    <span key={li}>
      {row.key && <span style={{ color: style.categoryColor, fontWeight: 600 }}>{row.key}</span>}
      {row.key && <span style={{ color: style.fgColor }}>:</span>}
      {row.value && <span style={{ color: style.fgColor }}> </span>}
      {row.value && parseInline(row.value, style, undefined, `personal-${li}`)}
      {li < rows.length - 1 ? '\n' : ''}
    </span>
  ))
}

function normalizeHref(url: string): string {
  if (!url.trim()) return ''
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url
  return `https://${url}`
}

function renderProjectRepo(repo: string, style: CVStyle, keyPrefix: string): React.ReactNode {
  const href = normalizeHref(repo)
  if (!href) return null
  return (
    <a
      key={`${keyPrefix}-repo-link`}
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ color: style.accentColor, textDecoration: 'none' }}
    >
      {repo}
    </a>
  )
}

function renderProjectsContent(entries: ProjectEntry[], style: CVStyle, h3Color?: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  entries.forEach((entry, index) => {
    if (index > 0) nodes.push(<span key={`project-gap-${index}`}>{'\n\n'}</span>)

    if (entry.name.trim()) {
      nodes.push(
        <span key={`project-heading-${index}`}>
          {parseInline(`### ${entry.name.trim()}`, style, h3Color, `project-${index}-heading`)}
          {'\n'}
        </span>
      )
    }

    if (entry.description.trim()) {
      nodes.push(
        <span key={`project-description-${index}`}>
          {renderInlineMarkdown(entry.description.trim(), style, h3Color)}
          {'\n'}
        </span>
      )
    }

    const stack = entry.stack.map((item) => item.trim()).filter(Boolean)
    if (stack.length > 0) {
      nodes.push(
        <span key={`project-stack-${index}`}>
          <span style={{ color: style.fgColor, fontWeight: 700 }}>Stack:</span>
          <span style={{ color: style.fgColor }}> </span>
          {stack.flatMap((item, itemIndex) => [
            itemIndex > 0 ? <span key={`project-stack-${index}-sep-${itemIndex}`} style={{ color: style.fgColor }}>, </span> : null,
            ...parseInline(item, style, undefined, `project-stack-${index}-${itemIndex}`),
          ])}
          .
          {'\n'}
        </span>
      )
    }

    if (entry.repo.trim()) {
      nodes.push(
        <span key={`project-repo-${index}`}>
          <span style={{ color: style.fgColor, fontWeight: 700 }}>Repo:</span>
          <span style={{ color: style.fgColor }}> </span>
          {renderProjectRepo(entry.repo.trim(), style, `project-${index}`)}
        </span>
      )
    }
  })

  return nodes
}

function renderLanguagesContent(entries: LanguageEntry[], style: CVStyle): React.ReactNode[] {
  return entries.map((entry, index) => {
    const details = entry.details.map((detail) => detail.trim()).filter(Boolean)
    return (
      <span key={index}>
        <span style={{ fontWeight: 700 }}>
          {entry.language.trim() && (
            <span style={{ color: style.categoryColor }}>{entry.language.trim()}</span>
          )}
          {entry.proficiency.trim() && (
            <>
              <span style={{ color: style.fgColor }}>:</span>
              <span style={{ color: style.fgColor }}> </span>
              {parseInline(entry.proficiency.trim(), style, undefined, `language-${index}-proficiency`)}
            </>
          )}
        </span>
        {details.length > 0 && '\n'}
        {details.map((detail, detailIndex) => (
          <span key={detailIndex}>
            {parseInline(detail, style, undefined, `language-${index}-detail-${detailIndex}`)}
            {detailIndex < details.length - 1 ? '\n' : ''}
          </span>
        ))}
        {index < entries.length - 1 ? '\n' : ''}
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
    const parts = parseInline(line, style, h3Color, `line-${li}`)
    return (
      <span key={li}>
        {parts}
        {li < lines.length - 1 ? '\n' : ''}
      </span>
    )
  })
}

function parseInline(line: string, style: CVStyle, h3Color?: string, keyPrefix = 'inline'): React.ReactNode[] {
  // Handle ### headings
  if (line.startsWith('### ')) {
    return [
      <span key={`${keyPrefix}-h3`} style={{ color: h3Color ?? style.fgColor, fontWeight: 600 }}>
        <DecorativeText text="###" color={h3Color ?? style.fgColor} weight={600} />
        {line.slice(4)}
      </span>,
    ]
  }
  if (line.startsWith('## ')) {
    return [
      <span key={`${keyPrefix}-h2`} style={{ color: style.headingColor, fontWeight: 700 }}>
        <DecorativeText text="##" color={style.headingColor} />
        {line.slice(3)}
      </span>,
    ]
  }
  if (line.startsWith('# ')) {
    return [
      <span key={`${keyPrefix}-h1`} style={{ color: style.fgColor, fontWeight: 700 }}>
        <DecorativeText text="#" color={style.fgColor} />
        {line.slice(2)}
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
        <span key={`${keyPrefix}-t-${last}`} style={{ color: style.fgColor }}>
          {line.slice(last, match.index)}
        </span>
      )
    }
    if (match[0].startsWith('**')) {
      tokens.push(
        <span key={`${keyPrefix}-b-${match.index}`} style={{ color: style.fgColor, fontWeight: 700 }}>
          {match[2]}
        </span>
      )
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

  if (last < line.length) {
    tokens.push(
      <span key={`${keyPrefix}-t-end`} style={{ color: style.fgColor }}>
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

export function CVPreview({ cv, containerStyle }: Props) {
  const { meta, sections, style } = cv
  const visibleSections = sections.filter((section) =>
    section.type !== 'photo' || !!section.photoUrl || !!section.photoAscii
  )

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
        ...containerStyle,
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
              <DecorativeText text="#" color={style.fgColor} />
              {meta.name}
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
            <AsciiArt
              ascii={clipAscii(meta.photoAscii, (meta.photoHeight ?? 25) * (meta.photoDensity ?? 1))}
              colors={meta.photoAsciiColors}
              baseCols={meta.photoWidth ?? 50}
              density={meta.photoDensity ?? 1}
              baseFontSize={Math.max(style.fontSize - 4, 7)}
              fallbackColor={style.mutedColor}
            />
          ) : null}
        </div>{/* end flex row */}

      </div>
      }

      {/* ── Sections ── */}
      {cv.docMode === 'json' && (
        <div>
          {visibleSections.map((section, i) => (
            <JsonSectionBlock
              key={section.id}
              section={section}
              style={style}
              isFirst={i === 0}
              isLast={i === visibleSections.length - 1}
            />
          ))}
        </div>
      )}
      {cv.docMode !== 'json' && visibleSections.map((section, i) => {
        const mode = effectiveMode(cv.docMode, section)
        return mode === 'json'
          ? <JsonSectionBlock key={section.id} section={section} style={style} isFirst={i === 0} isLast={i === visibleSections.length - 1} />
          : <SectionBlock key={section.id} section={section} style={style} />
      })}
    </div>
  )
}
