import { parseTimelineEntries } from './timeline-parser'
import {
  CV,
  CVSection,
  CVSectionBase,
  CVSectionInput,
  CVStyle,
  DEFAULT_STYLE,
  EducationEntry,
  ExperienceEntry,
  PersonalRow,
  ProjectEntry,
  SectionType,
  SkillGroup,
  TimelineLayout,
} from '@/types/cv'

export type ExperienceEntryModel = ExperienceEntry
export type EducationEntryModel = EducationEntry
export type ProjectEntryModel = ProjectEntry
export type SkillGroupModel = SkillGroup
export type KeyValueModel = PersonalRow

type LegacySection = Partial<CVSectionBase> & {
  id?: string
  type: SectionType
  title?: string
  subtitle?: string
  content?: string
  body?: string
  entries?: unknown
  groups?: unknown
  rows?: unknown
  layout?: TimelineLayout
  photoUrl?: string
  photoAscii?: string
  photoAsciiColors?: string[][]
  photoWidth?: number
  photoHeight?: number
  photoDensity?: number
  photoMode?: 'ascii' | 'image'
  renderMode?: CVSection['renderMode']
  sectionColors?: Partial<CVStyle>
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

function baseSection(input: LegacySection, fallbackTitle: string): CVSectionBase {
  return {
    id: input.id ?? '',
    type: input.type,
    title: input.title ?? fallbackTitle,
    subtitle: input.subtitle ?? '',
    layout: input.layout ?? 'list',
    renderMode: input.renderMode,
    sectionColors: input.sectionColors,
  }
}

function isExperienceEntries(value: unknown): value is ExperienceEntry[] {
  return Array.isArray(value)
}

function isEducationEntries(value: unknown): value is EducationEntry[] {
  return Array.isArray(value)
}

function isProjectEntries(value: unknown): value is ProjectEntry[] {
  return Array.isArray(value)
}

function isSkillGroups(value: unknown): value is SkillGroup[] {
  return Array.isArray(value)
}

function isPersonalRows(value: unknown): value is PersonalRow[] {
  return Array.isArray(value)
}

export function sectionToContent(section: CVSection): string {
  switch (section.type) {
    case 'experience':
      return serializeExperienceContent(section.entries)
    case 'education':
      return serializeEducationContent(section.entries)
    case 'projects':
      return serializeProjectContent(section.entries)
    case 'skills':
      return serializeSkillsContent(section.groups)
    case 'personal':
      return serializeKeyValueContent(section.rows)
    case 'custom':
      return section.body
    case 'photo':
      return ''
  }
}

export function normalizeSection(input: CVSection | LegacySection): CVSection {
  const legacy = input as LegacySection
  const content = legacy.content ?? legacy.body ?? ''

  switch (legacy.type) {
    case 'experience':
      return {
        ...baseSection(legacy, 'Experience'),
        type: 'experience',
        layout: legacy.layout ?? 'vertical',
        entries: isExperienceEntries(legacy.entries) ? legacy.entries : parseExperienceContent(content),
      }
    case 'education':
      return {
        ...baseSection(legacy, 'Education'),
        type: 'education',
        layout: legacy.layout ?? 'vertical',
        entries: isEducationEntries(legacy.entries) ? legacy.entries : parseEducationContent(content),
      }
    case 'projects':
      return {
        ...baseSection(legacy, 'Projects'),
        type: 'projects',
        entries: isProjectEntries(legacy.entries) ? legacy.entries : parseProjectContent(content),
      }
    case 'skills':
      return {
        ...baseSection(legacy, 'Skills'),
        type: 'skills',
        groups: isSkillGroups(legacy.groups) ? legacy.groups : parseSkillsContent(content),
      }
    case 'personal':
      return {
        ...baseSection(legacy, 'Personal Information'),
        type: 'personal',
        rows: isPersonalRows(legacy.rows) ? legacy.rows : parseKeyValueContent(content),
      }
    case 'photo':
      return {
        ...baseSection(legacy, 'Photo'),
        type: 'photo',
        photoUrl: legacy.photoUrl,
        photoAscii: legacy.photoAscii,
        photoAsciiColors: legacy.photoAsciiColors,
        photoWidth: legacy.photoWidth,
        photoHeight: legacy.photoHeight,
        photoDensity: legacy.photoDensity,
        photoMode: legacy.photoMode,
      }
    case 'custom':
    default:
      return {
        ...baseSection({ ...legacy, type: 'custom' }, legacy.title ?? 'Custom Section'),
        type: 'custom',
        body: content,
      }
  }
}

export function normalizeSectionInput(input: CVSectionInput | Omit<LegacySection, 'id'>): CVSectionInput {
  const section = normalizeSection({ id: '', ...input } as LegacySection)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...withoutId } = section
  return withoutId
}

export function legacyContentSection(input: Omit<LegacySection, 'id'>): CVSectionInput {
  return normalizeSectionInput(input)
}

export function normalizeCV(input: Partial<CV> | null | undefined): CV {
  return {
    meta: {
      name: input?.meta?.name ?? 'Your Name',
      title: input?.meta?.title ?? '',
      email: input?.meta?.email ?? '',
      ...(input?.meta ?? {}),
    },
    sections: (input?.sections ?? []).map((section) => normalizeSection(section as CVSection | LegacySection)),
    style: { ...DEFAULT_STYLE, ...(input?.style ?? {}) },
    docMode: input?.docMode ?? 'md',
  }
}
