import React from 'react'
import { CVSection, CVStyle } from '@/types/cv'
import { parseTimelineEntries } from '@/lib/timeline-parser'

// ── Token span helpers ──────────────────────────────────────────────────────

export function JKey({ text, style }: { text: string; style: CVStyle }) {
  return <span style={{ color: style.jsonKeyColor }}>"{text}"</span>
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

function JStringContent({ text, style }: { text: string; style: CVStyle }) {
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  const tokens: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push(<span key={`t-${last}`} style={{ color: style.jsonStringColor }}>{text.slice(last, match.index)}</span>)
    }
    if (match[0].startsWith('**')) {
      tokens.push(<span key={`b-${match.index}`} style={{ color: style.jsonStringColor, fontWeight: 700 }}>{match[2]}</span>)
    } else {
      tokens.push(<span key={`c-${match.index}`} style={{ color: style.jsonStringColor, backgroundColor: style.codeBgColor, padding: '0 2px', borderRadius: '2px' }}>{match[3]}</span>)
    }
    last = match.index + match[0].length
  }
  if (last < text.length) {
    tokens.push(<span key="t-end" style={{ color: style.jsonStringColor }}>{text.slice(last)}</span>)
  }

  return <>{tokens}</>
}

// A full quoted JSON string with inline markdown support
function JStringValue({ text, style, trailing = '' }: { text: string; style: CVStyle; trailing?: string }) {
  return (
    <span>
      <JPunct text='"' style={style} />
      <JStringContent text={text} style={style} />
      <JPunct text={`"${trailing}`} style={style} />
    </span>
  )
}

// ── Skills content parser ───────────────────────────────────────────────────
// "Languages: TypeScript · Go · Python" → { category: "Languages", items: ["TypeScript","Go","Python"] }
// Lines without ":" → { items: ["item1","item2"] }

interface SkillLine { category?: string; items: string[] }

function parseSkillLines(content: string): SkillLine[] {
  return content.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        const category = line.slice(0, colonIdx).trim()
        const items = line.slice(colonIdx + 1).split('·').map((s) => s.trim()).filter(Boolean)
        return { category, items }
      }
      const items = line.split('·').map((s) => s.trim()).filter(Boolean)
      return { items }
    })
}

// ── Indentation helper ──────────────────────────────────────────────────────

const I1 = '  '   // 2 spaces
const I2 = '    ' // 4 spaces
const I3 = '      ' // 6 spaces

// ── Section renderers ───────────────────────────────────────────────────────

function renderExperience(section: CVSection, style: CVStyle): React.ReactNode {
  const entries = parseTimelineEntries(section.content)
  const isEdu = section.type === 'education'
  const key = isEdu ? 'education' : 'experience'

  return (
    <div>
      <Line><JKey text={key} style={style} /><JPunct text=": [" style={style} /></Line>
      {entries.map((entry, ei) => {
        const highlights = entry.description
          .split('\n').map((l) => l.trim()).filter(Boolean)
        const isLastEntry = ei === entries.length - 1

        // For education: split "Degree | Institution" from role field
        let primaryKey = 'role'
        let primaryVal = entry.role
        let secondaryKey = 'company'
        let secondaryVal = entry.company

        if (isEdu) {
          const parts = entry.role.split(' | ')
          primaryKey = 'degree'
          primaryVal = parts[0]?.trim() ?? entry.role
          secondaryKey = 'institution'
          secondaryVal = parts[1]?.trim() || entry.company
        }

        return (
          <div key={ei}>
            <Line>{I1}<JPunct text="{" style={style} /></Line>
            <Line>{I2}<JKey text={primaryKey} style={style} /><JPunct text=": " style={style} /><JStringValue text={primaryVal} style={style} trailing="," /></Line>
            {secondaryVal && (
              <Line>{I2}<JKey text={secondaryKey} style={style} /><JPunct text=": " style={style} /><JStringValue text={secondaryVal} style={style} trailing="," /></Line>
            )}
            {entry.period && (
              <Line>{I2}<JKey text="period" style={style} /><JPunct text=": " style={style} /><JStringValue text={entry.period} style={style} trailing={highlights.length ? ',' : ''} /></Line>
            )}
            {highlights.length > 0 && (
              <>
                <Line>{I2}<JKey text="highlights" style={style} /><JPunct text=": [" style={style} /></Line>
                {highlights.map((h, hi) => (
                  <Line key={hi}>{I3}<JStringValue text={h} style={style} trailing={hi < highlights.length - 1 ? ',' : ''} /></Line>
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
  const lines = parseSkillLines(section.content)
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
              <Line>{I1}<JKey text={line.category!} style={style} /><JPunct text=": [" style={style} /></Line>
              {line.items.map((item, ii) => (
                <Line key={ii}>{I2}<JStringValue text={item} style={style} trailing={ii < line.items.length - 1 ? ',' : ''} /></Line>
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
        <Line key={ii}>{I1}<JStringValue text={item} style={style} trailing={ii < allItems.length - 1 ? ',' : ''} /></Line>
      ))}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

function renderProjects(section: CVSection, style: CVStyle): React.ReactNode {
  const entries = parseTimelineEntries(section.content)
  if (entries.length === 0) {
    // Plain content fallback
    return renderPlain(section, style)
  }

  return (
    <div>
      <Line><JKey text="projects" style={style} /><JPunct text=": [" style={style} /></Line>
      {entries.map((entry, ei) => {
        const highlights = entry.description.split('\n').map((l) => l.trim()).filter(Boolean)
        const isLast = ei === entries.length - 1
        return (
          <div key={ei}>
            <Line>{I1}<JPunct text="{" style={style} /></Line>
            <Line>{I2}<JKey text="name" style={style} /><JPunct text=": " style={style} /><JStringValue text={entry.role} style={style} trailing={highlights.length ? ',' : ''} /></Line>
            {highlights.length > 0 && (
              <>
                <Line>{I2}<JKey text="description" style={style} /><JPunct text=": [" style={style} /></Line>
                {highlights.map((h, hi) => (
                  <Line key={hi}>{I3}<JStringValue text={h} style={style} trailing={hi < highlights.length - 1 ? ',' : ''} /></Line>
                ))}
                <Line>{I2}<JPunct text="]" style={style} /></Line>
              </>
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
    return <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": " style={style} /><JStringValue text="" style={style} /></Line>
  }
  if (lines.length === 1) {
    return <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": " style={style} /><JStringValue text={lines[0]} style={style} /></Line>
  }
  return (
    <div>
      <Line><JKey text={section.title.toLowerCase()} style={style} /><JPunct text=": [" style={style} /></Line>
      {lines.map((line, li) => (
        <Line key={li}>{I1}<JStringValue text={line} style={style} trailing={li < lines.length - 1 ? ',' : ''} /></Line>
      ))}
      <Line><JPunct text="]" style={style} /></Line>
    </div>
  )
}

// ── Line wrapper ────────────────────────────────────────────────────────────

function Line({ children }: { children: React.ReactNode }) {
  return <div style={{ whiteSpace: 'pre' }}>{children}</div>
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
