import { parseTimelineEntries } from './timeline-parser'

export interface ExperienceEntryModel {
  role: string
  company: string
  period: string
  details: string[]
}

export interface EducationEntryModel {
  degree: string
  institution: string
  period: string
  details: string[]
}

export interface ProjectEntryModel {
  name: string
  description: string
  stack: string[]
  repo: string
}

export interface SkillGroupModel {
  category: string
  items: string[]
}

export interface KeyValueModel {
  key: string
  value: string
}

function nonEmptyLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function joinDetails(details: string[]): string {
  return details.map((line) => line.trim()).filter(Boolean).join('\n')
}

function serializeBlocks(blocks: string[]): string {
  return blocks.map((block) => block.trim()).filter(Boolean).join('\n\n')
}

function hasTimelineHeading(content: string): boolean {
  return /^###\s+/m.test(content)
}

export function canParseStructuredTimelineContent(content: string): boolean {
  return content.trim() === '' || hasTimelineHeading(content)
}

function splitList(value: string): string[] {
  return value
    .split(/[·,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function extractInlineField(
  lines: string[],
  labels: string[]
): { value: string; remainingLines: string[] } {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const fieldPattern = new RegExp(`\\b(${labelPattern}):\\s*(.*)$`, 'i')
  let value = ''
  const remainingLines: string[] = []

  for (const line of lines) {
    const match = line.match(fieldPattern)
    if (!match || match.index === undefined) {
      remainingLines.push(line)
      continue
    }

    const before = line.slice(0, match.index).trim()
    if (before) remainingLines.push(before)
    value = match[2].trim()
  }

  return { value, remainingLines }
}

export function parseExperienceContent(content: string): ExperienceEntryModel[] {
  return parseTimelineEntries(content).map((entry) => ({
    role: entry.role,
    company: entry.company,
    period: entry.period,
    details: nonEmptyLines(entry.description),
  }))
}

export function serializeExperienceContent(entries: ExperienceEntryModel[]): string {
  return serializeBlocks(entries.map((entry) => {
    const role = entry.role.trim()
    const company = entry.company.trim()
    const period = entry.period.trim()
    const title = `${role}${company ? ` @ ${company}` : ''}${period ? ` | ${period}` : ''}`.trim()
    const details = joinDetails(entry.details)
    if (!title && !details) return ''
    return details ? `### ${title}\n${details}` : `### ${title}`
  }))
}

export function parseEducationContent(content: string): EducationEntryModel[] {
  return parseTimelineEntries(content).map((entry) => {
    const parts = entry.role.split(' | ')
    return {
      degree: parts[0]?.trim() ?? entry.role,
      institution: (parts[1]?.trim() || entry.company).trim(),
      period: entry.period,
      details: nonEmptyLines(entry.description),
    }
  })
}

export function serializeEducationContent(entries: EducationEntryModel[]): string {
  return serializeBlocks(entries.map((entry) => {
    const header = [entry.degree, entry.institution, entry.period]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' | ')
    const details = joinDetails(entry.details)
    if (!header && !details) return ''
    return details ? `### ${header}\n${details}` : `### ${header}`
  }))
}

export function parseProjectContent(content: string): ProjectEntryModel[] {
  return parseTimelineEntries(content).map((entry) => {
    const lines = nonEmptyLines(entry.description)
    const repoResult = extractInlineField(lines, ['Repo', 'Link'])
    const stackResult = extractInlineField(repoResult.remainingLines, ['Stack'])
    const description = stackResult.remainingLines.join('\n')
    return {
      name: entry.role,
      description,
      stack: stackResult.value ? splitList(stackResult.value.replace(/\.$/, '')) : [],
      repo: repoResult.value,
    }
  })
}

export function serializeProjectContent(entries: ProjectEntryModel[]): string {
  return serializeBlocks(entries.map((entry) => {
    const lines = nonEmptyLines(entry.description)
    if (entry.stack.length > 0) lines.push(`Stack: ${entry.stack.map((item) => item.trim()).filter(Boolean).join(', ')}.`)
    if (entry.repo.trim()) lines.push(`Repo: ${entry.repo.trim()}`)
    if (!entry.name.trim() && lines.length === 0) return ''
    return lines.length > 0 ? `### ${entry.name.trim()}\n${lines.join('\n')}` : `### ${entry.name.trim()}`
  }))
}

export function parseSkillsContent(content: string): SkillGroupModel[] {
  return nonEmptyLines(content).map((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) {
      return {
        category: '',
        items: splitList(line),
      }
    }
    return {
      category: line.slice(0, colonIdx).trim(),
      items: splitList(line.slice(colonIdx + 1)),
    }
  })
}

export function serializeSkillsContent(groups: SkillGroupModel[]): string {
  return groups.map((group) => {
    const items = group.items.map((item) => item.trim()).filter(Boolean).join(' · ')
    return group.category.trim() ? `${group.category.trim()}:   ${items}` : items
  }).filter(Boolean).join('\n')
}

export function parseKeyValueContent(content: string): KeyValueModel[] {
  return nonEmptyLines(content).map((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return { key: line, value: '' }
    return {
      key: line.slice(0, colonIdx).trim(),
      value: line.slice(colonIdx + 1).trim(),
    }
  })
}

export function serializeKeyValueContent(rows: KeyValueModel[]): string {
  return rows
    .map((row) => row.key.trim() ? `${row.key.trim()}: ${row.value.trim()}` : row.value.trim())
    .filter(Boolean)
    .join('\n')
}
