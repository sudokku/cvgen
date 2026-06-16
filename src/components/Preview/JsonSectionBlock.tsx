import React from 'react'
import { CVSection, CVStyle } from '@/types/cv'
import {
  parseEducationContent,
  parseExperienceContent,
  parseProjectContent,
  parseSkillsContent,
} from '@/lib/section-formatting'

// ── Token span helpers ──────────────────────────────────────────────────────

export function JKey({ text, style, color }: { text: string; style: CVStyle; color?: string }) {
  return <span style={{ color: color ?? style.jsonKeyColor }}>{'"'}{text}{'"'}</span>
}

export function JStr({ children, style }: { children: React.ReactNode; style: CVStyle }) {
  return <span style={{ color: style.jsonStringColor }}>{children}</span>
}

export function JPunct({ text, style }: { text: string; style: CVStyle }) {
  return <span style={{ color: style.jsonPunctuationColor }}>{text}</span>
}

export function JNum({ value, style }: { value: number; style: CVStyle }) {
  return <span style={{ color: style.jsonNumberColor }}>{value}</span>
}

// ── Inline markdown inside a JSON string value ──────────────────────────────
// Strips ** and ` markers, applies weight/bg but keeps the string color.

function JStringContent({ text, style, color }: { text: string; style: CVStyle; color?: string }) {
  const c = color ?? style.jsonStringColor
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  const tokens: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push(<span key={`t-${last}`} style={{ color: c }}>{text.slice(last, match.index)}</span>)
    }
    if (match[0].startsWith('**')) {
      tokens.push(<span key={`b-${match.index}`} style={{ color: c, fontWeight: 700 }}>{match[2]}</span>)
    } else {
      tokens.push(<span key={`c-${match.index}`} style={{ color: c, backgroundColor: style.codeBgColor, padding: '0 2px', borderRadius: '2px' }}>{match[3]}</span>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    tokens.push(<span key="t-end" style={{ color: c }}>{text.slice(last)}</span>)
  }

  return <>{tokens}</>
}

// A full quoted JSON string with inline markdown support
function JStringValue({ text, style, trailing = '', color }: { text: string; style: CVStyle; trailing?: string; color?: string }) {
  return (
    <span>
      <JPunct text='"' style={style} />
      <JStringContent text={text} style={style} color={color} />
      <JPunct text={`"${trailing}`} style={style} />
    </span>
  )
}

// ── Indentation helper ──────────────────────────────────────────────────────

const I1 = '  '   // 2 spaces
const I2 = '    ' // 4 spaces
const I3 = '      ' // 6 spaces

// ── Line wrappers ───────────────────────────────────────────────────────────

// Structural line: no wrapping (for brackets, keys with objects/arrays)
function Line({ children }: { children: React.ReactNode }) {
  return <div style={{ whiteSpace: 'pre' }}>{children}</div>
}

// Content line: wraps long values, continuation lines align to the indent level
function WrappableLine({ indent = '', children }: { indent?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      paddingLeft: `${indent.length}ch`,
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
    }}>
      {children}
    </div>
  )
}

// ── Section renderers ───────────────────────────────────────────────────────

function renderExperience(section: CVSection, style: CVStyle): React.ReactNode {
  const isEdu = section.type === 'education'
  const entries = isEdu
    ? parseEducationContent(section.content).map((entry) => ({
        primaryKey: 'degree',
        primaryVal: entry.degree,
        secondaryKey: 'institution',
        secondaryVal: entry.institution,
        period: entry.period,
        highlights: entry.details,
      }))
    : parseExperienceContent(section.content).map((entry) => ({
        primaryKey: 'role',
        primaryVal: entry.role,
        secondaryKey: 'company',
        secondaryVal: entry.company,
        period: entry.period,
        highlights: entry.details,
      }))
  const key = isEdu ? 'education' : 'experience'

  return (
    <div>
      <Line><JKey text={key} style={style} /><JPunct text=": [" style={style} /></Line>
      {entries.map((entry, ei) => {
        const isLastEntry = ei === entries.length - 1

        return (
          <div key={ei}>
            <Line>{I1}<JPunct text="{" style={style} /></Line>
            <WrappableLine indent={I2}><JKey text={entry.primaryKey} style={style} /><JPunct text=": " style={style} /><JStringValue text={entry.primaryVal} style={style} trailing="," color={style.roleColor} /></WrappableLine>
            {entry.secondaryVal && (
              <WrappableLine indent={I2}><JKey text={entry.secondaryKey} style={style} /><JPunct text=": " style={style} /><JStringValue text={entry.secondaryVal} style={style} trailing="," color={style.companyColor} /></WrappableLine>
            )}
            {entry.period && (
              <WrappableLine indent={I2}><JKey text="period" style={style} /><JPunct text=": " style={style} /><JStringValue text={entry.period} style={style} trailing={entry.highlights.length ? ',' : ''} color={style.periodColor} /></WrappableLine>
            )}
            {entry.highlights.length > 0 && (
              <>
                <Line>{I2}<JKey text="highlights" style={style} /><JPunct text=": [" style={style} /></Line>
                {entry.highlights.map((h, hi) => (
                  <WrappableLine key={hi} indent={I3}><JStringValue text={h} style={style} trailing={hi < entry.highlights.length - 1 ? ',' : ''} /></WrappableLine>
                ))}
                <Line>{I2}<JPunct text="]" style={style} /></Line>
              </>
            )}
            <Line>{I1}<JPunct text={isLastEntry ? '}' : '},'} style={style} /></Line>
          </div>
        )
      })}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

function renderSkills(section: CVSection, style: CVStyle): React.ReactNode {
  const lines = parseSkillsContent(section.content)
  const allCategorised = lines.length > 0 && lines.every((l) => l.category)

  if (allCategorised) {
    // Render as object: "Languages": ["TS", "Go"]
    return (
      <div>
        <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": {" style={style} /></Line>
        {lines.map((line, li) => {
          const isLast = li === lines.length - 1
          return (
            <div key={li}>
              <Line>{I1}<JKey text={line.category} style={style} color={style.categoryColor} /><JPunct text=": [" style={style} /></Line>
              {line.items.map((item, ii) => (
                <WrappableLine key={ii} indent={I2}><JStringValue text={item} style={style} trailing={ii < line.items.length - 1 ? ',' : ''} /></WrappableLine>
              ))}
              <Line>{I1}<JPunct text={isLast ? ']' : '],'} style={style} /></Line>
            </div>
          )
        })}
        <Line><JPunct text="}" style={style} /></Line>
      </div>
    )
  }

  // Flat array of all items
  const allItems = lines.flatMap((l) => l.items)
  return (
    <div>
      <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": [" style={style} /></Line>
      {allItems.map((item, ii) => (
        <WrappableLine key={ii} indent={I1}><JStringValue text={item} style={style} trailing={ii < allItems.length - 1 ? ',' : ''} /></WrappableLine>
      ))}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

function renderProjects(section: CVSection, style: CVStyle): React.ReactNode {
  const entries = parseProjectContent(section.content)
  if (entries.length === 0) {
    return renderPlain(section, style)
  }

  return (
    <div>
      <Line><JKey text="projects" style={style} /><JPunct text=": [" style={style} /></Line>
      {entries.map((entry, ei) => {
        const isLast = ei === entries.length - 1
        const hasDescription = entry.description.length > 0
        const hasStack = entry.stack.length > 0
        const hasRepo = entry.repo.length > 0

        return (
          <div key={ei}>
            <Line>{I1}<JPunct text="{" style={style} /></Line>
            <WrappableLine indent={I2}>
              <JKey text="name" style={style} /><JPunct text=": " style={style} />
              <JStringValue text={entry.name} style={style} trailing={hasDescription || hasStack || hasRepo ? ',' : ''} color={style.projectTitleColor} />
            </WrappableLine>
            {hasDescription && (
              <WrappableLine indent={I2}>
                <JKey text="description" style={style} /><JPunct text=": " style={style} />
                <JStringValue text={entry.description} style={style} trailing={hasStack || hasRepo ? ',' : ''} />
              </WrappableLine>
            )}
            {hasStack && (
              <WrappableLine indent={I2}>
                <JKey text="stack" style={style} /><JPunct text=": [" style={style} />
                {entry.stack.map((item, si) => (
                  <span key={si}>
                    <JStringValue text={item} style={style} trailing={si < entry.stack.length - 1 ? ', ' : ''} />
                  </span>
                ))}
                <JPunct text={hasRepo ? '],' : ']'} style={style} />
              </WrappableLine>
            )}
            {hasRepo && (
              <WrappableLine indent={I2}>
                <JKey text="repo" style={style} /><JPunct text=": " style={style} />
                <JStringValue text={entry.repo} style={style} />
              </WrappableLine>
            )}
            <Line>{I1}<JPunct text={isLast ? '}' : '},'} style={style} /></Line>
          </div>
        )
      })}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

function renderPhoto(section: CVSection, style: CVStyle): React.ReactNode {
  if (!section.photoUrl) {
    return <Line><JKey text="photo" style={style} /><JPunct text=": " style={style} /><span style={{ color: style.jsonPunctuationColor }}>null</span></Line>
  }
  return (
    <div>
      <Line><JKey text="photo" style={style} /><JPunct text=": {" style={style} /></Line>
      <Line>{I1}<JKey text="ascii" style={style} /><JPunct text=": " style={style} /><span style={{ color: style.jsonNumberColor }}>{section.photoAscii ? 'true' : 'false'}</span><JPunct text="," style={style} /></Line>
      <Line>{I1}<JKey text="cols" style={style} /><JPunct text=": " style={style} /><JNum value={section.photoWidth ?? 80} style={style} /><JPunct text="," style={style} /></Line>
      <Line>{I1}<JKey text="rows" style={style} /><JPunct text=": " style={style} /><JNum value={section.photoHeight ?? 40} style={style} /></Line>
      <Line><JPunct text="}" style={style} /></Line>
    </div>
  )
}

function renderPlain(section: CVSection, style: CVStyle): React.ReactNode {
  const lines = section.content.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    return <WrappableLine><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": " style={style} /><JStringValue text="" style={style} /></WrappableLine>
  }
  if (lines.length === 1) {
    return <WrappableLine><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": " style={style} /><JStringValue text={lines[0]} style={style} /></WrappableLine>
  }
  return (
    <div>
      <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": [" style={style} /></Line>
      {lines.map((line, li) => (
        <WrappableLine key={li} indent={I1}><JStringValue text={line} style={style} trailing={li < lines.length - 1 ? ',' : ''} /></WrappableLine>
      ))}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

// ── Public component ────────────────────────────────────────────────────────

interface Props {
  section: CVSection
  style: CVStyle
  isFirst: boolean
  isLast: boolean
}

export function JsonSectionBlock({ section, style, isFirst, isLast }: Props) {
  const preStyle: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: `${style.fontSize}px`,
    lineHeight: 1.6,
    margin: 0,
    marginBottom: isLast ? 0 : '4px',
  }

  function renderContent() {
    switch (section.type) {
      case 'experience':
      case 'education':
        return renderExperience(section, style)
      case 'skills':
        return renderSkills(section, style)
      case 'projects':
        return renderProjects(section, style)
      case 'photo':
        return renderPhoto(section, style)
      default:
        return renderPlain(section, style)
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {!isFirst && (
        <div style={{ color: style.mutedColor, marginBottom: '4px', whiteSpace: 'pre' }}>
          {'// ' + '─'.repeat(50)}
        </div>
      )}
      <div style={preStyle}>
        {renderContent()}
      </div>
    </div>
  )
}
