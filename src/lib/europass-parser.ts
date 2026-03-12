import { CVLink, CVMeta, CVSection, SectionType } from '@/types/cv'

export interface EuropassImportResult {
  meta: CVMeta
  sections: Omit<CVSection, 'id'>[]
  warnings: string[]
}

// ── DOM helpers ────────────────────────────────────────────────────────────

// First matching element or null
function q(root: Element | Document, sel: string): Element | null {
  return root.querySelector(sel)
}

// textContent of first match, trimmed, or ''
function text(root: Element | Document, sel: string): string {
  return q(root, sel)?.textContent?.trim() ?? ''
}

// Attribute value of first match, or ''
function attr(root: Element | Document, sel: string, attrName: string): string {
  return q(root, sel)?.getAttribute(attrName) ?? ''
}

// 'value' attribute first, then textContent — for <Description value="..."/>
function val(root: Element | Document, sel: string): string {
  const el = q(root, sel)
  if (!el) return ''
  return el.getAttribute('value')?.trim() || el.textContent?.trim() || ''
}

// ── HTML → Markdown helper (client-side, uses DOMParser) ──────────────────

/**
 * Converts a fragment of HTML (as found in EuroPass Description fields) to
 * plain Markdown-compatible text. Handles:
 *   <ul><li> → "- item"
 *   <ol><li> → "1. item"  (approximated with "- " for simplicity)
 *   <strong>/<b> → **text**
 *   <em>/<i>   → *text*
 *   <br>       → newline
 *   HTML entities are decoded via the DOM.
 */
function htmlToMarkdown(raw: string): string {
  if (!raw || typeof document === 'undefined') return raw ?? ''
  // Quick check: if no HTML tags, just decode entities
  if (!/<[a-zA-Z]/.test(raw)) {
    const ta = document.createElement('textarea')
    ta.innerHTML = raw
    return ta.value.trim()
  }

  const div = document.createElement('div')
  div.innerHTML = raw

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? ''
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(walk).join('')

    switch (tag) {
      case 'strong':
      case 'b':
        return `**${children}**`
      case 'em':
      case 'i':
        return `*${children}*`
      case 'br':
        return '\n'
      case 'p':
        return `${children}\n`
      case 'ul':
      case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
        return items.map((li) => `- ${walk(li).trim()}`).join('\n') + '\n'
      }
      case 'li':
        return children
      default:
        return children
    }
  }

  return walk(div).replace(/\n{3,}/g, '\n\n').trim()
}

// ── Period formatting ──────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * In EuroPass XML month values are stored as attributes on the Month element,
 * e.g. <Month month="--06"/> NOT as text content. Year is text content.
 */
function formatPeriod(el: Element | null): string {
  if (!el) return ''

  const fromYear = text(el, 'From Year')
  // Month is an attribute like month="--06" on <Month> element
  const fromMonthAttr = q(el, 'From Month')?.getAttribute('month') ?? ''
  const fromMonthNum = parseInt(fromMonthAttr.replace(/^-+/, ''), 10)

  const toYear = text(el, 'To Year')
  const toMonthEl = q(el, 'To Month')
  const toMonthAttr = toMonthEl?.getAttribute('month') ?? ''
  const toMonthNum = parseInt(toMonthAttr.replace(/^-+/, ''), 10)
  const isCurrent = q(el, 'To Current') !== null

  if (!fromYear) return ''

  const hasFromMonth = fromMonthNum >= 1 && fromMonthNum <= 12
  const from = hasFromMonth
    ? `${MONTHS[fromMonthNum - 1]} ${fromYear}`
    : fromYear

  let to: string
  if (isCurrent) {
    to = 'present'
  } else if (!toYear) {
    return from
  } else {
    const hasToMonth = toMonthNum >= 1 && toMonthNum <= 12
    to = hasToMonth
      ? `${MONTHS[toMonthNum - 1]} ${toYear}`
      : toYear
  }

  return `${from}–${to}`
}

// ── Section builders ───────────────────────────────────────────────────────

function buildExperience(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const entries = Array.from(doc.querySelectorAll('WorkExperienceList > WorkExperience'))
  if (entries.length === 0) return null

  const blocks = entries.map((entry) => {
    const role = val(entry, 'Position Label') || text(entry, 'Position Label')
    const company = val(entry, 'Employer Name') || text(entry, 'Employer Name')
    const period = formatPeriod(q(entry, 'Period'))
    const rawDesc = val(entry, 'Activities') || text(entry, 'Activities')
    const description = htmlToMarkdown(rawDesc)

    let header = `### ${role || 'Role'}`
    if (company) header += ` @ ${company}`
    if (period) header += ` | ${period}`

    return description ? `${header}\n${description}` : header
  })

  return {
    type: 'experience' as SectionType,
    title: 'Experience',
    subtitle: '',
    content: blocks.join('\n\n'),
    layout: 'vertical',
  }
}

function buildEducation(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const entries = Array.from(doc.querySelectorAll('EducationList > Education'))
  if (entries.length === 0) return null

  const blocks = entries.map((entry) => {
    // <Title> is direct text in EuroPass; NOT <Title><Label>
    const titleEl = q(entry, 'Title')
    const title = titleEl?.textContent?.trim() ?? ''
    const institution = val(entry, 'Organisation Name') || text(entry, 'Organisation Name')
    const period = formatPeriod(q(entry, 'Period'))
    const rawDesc = val(entry, 'Description') || text(entry, 'Description')
    const description = htmlToMarkdown(rawDesc)

    const parts = [title, institution, period].filter(Boolean)
    const header = `### ${parts.join(' | ')}`

    return description ? `${header}\n${description}` : header
  })

  return {
    type: 'education' as SectionType,
    title: 'Education',
    subtitle: '',
    content: blocks.join('\n\n'),
    layout: 'vertical',
  }
}

function buildSkills(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  // Mother tongues — under MotherTongueList > MotherTongue (not Language Label)
  const motherTongues = Array.from(doc.querySelectorAll('MotherTongueList > MotherTongue'))
    .map((el) => {
      const label = val(el, 'Description') || text(el, 'Description')
      return label || null
    })
    .filter(Boolean) as string[]

  // Foreign languages — with CEFR level in parentheses
  const foreignLangs = Array.from(doc.querySelectorAll('ForeignLanguage'))
    .map((el) => {
      const label = val(el, 'Description') || text(el, 'Description')
      if (!label) return null
      // Overall CEFR level
      const cefrCode = attr(el, 'GlobalUnderstanding', 'code')
        || attr(el, 'OverallAssessment', 'code')
        || ''
      const cefr = cefrCode ? `(${cefrCode})` : ''
      return cefr ? `${label} ${cefr}` : label
    })
    .filter(Boolean) as string[]

  // Mother tongues get "(native)" tag
  const allLangs = [
    ...motherTongues.map((l) => `${l} (native)`),
    ...foreignLangs,
  ]

  if (allLangs.length > 0) {
    rows.push(`Languages:   ${allLangs.join(' · ')}`)
  }

  // Computer skills — EuroPass stores these as a single text blob, not a <Skill> list
  const computerDesc = val(doc, 'ComputerSkills Description')
    || text(doc, 'ComputerSkills Description')
    || val(doc, 'Computer Description')
    || text(doc, 'Computer Description')

  if (computerDesc) {
    const items = computerDesc.split(/[,;·]/).map((s) => s.trim()).filter(Boolean)
    if (items.length > 0) {
      rows.push(`Computer:    ${items.join(' · ')}`)
    }
  }

  // Other skills — top-level text blob
  const otherDesc = val(doc, 'Skills Other Description') || text(doc, 'Skills Other Description')
  if (otherDesc) {
    const items = otherDesc.split(/[,;·]/).map((s) => s.trim()).filter(Boolean)
    if (items.length > 0) {
      rows.push(`Other:       ${items.join(' · ')}`)
    }
  }

  if (rows.length === 0) {
    warnings.push('No skills data found in this EuroPass XML.')
    return null
  }

  return {
    type: 'skills' as SectionType,
    title: 'Skills',
    subtitle: '',
    content: rows.join('\n'),
    layout: 'list',
  }
}

function buildSummary(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const rawSummary = val(doc, 'ProfileSummary Description')
    || text(doc, 'ProfileSummary Description')
    || val(doc, 'ProfileSummary')
    || text(doc, 'ProfileSummary')

  if (!rawSummary) return null

  const summary = htmlToMarkdown(rawSummary)

  return {
    type: 'custom' as SectionType,
    title: 'Summary',
    subtitle: '',
    content: summary,
    layout: 'list',
  }
}

function buildPersonal(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  // Birthdate — from Demographics
  const birthYear = text(doc, 'Demographics Birthdate Year')
  const birthMonthEl = q(doc, 'Demographics Birthdate Month')
  const birthMonthAttr = birthMonthEl?.getAttribute('month') ?? ''
  const birthMonthNum = parseInt(birthMonthAttr.replace(/^-+/, ''), 10)
  const birthDayEl = q(doc, 'Demographics Birthdate Day')
  const birthDayAttr = birthDayEl?.getAttribute('day') ?? ''
  const birthDayNum = parseInt(birthDayAttr.replace(/^-+/, ''), 10)

  if (birthYear) {
    const parts: string[] = []
    if (birthDayNum >= 1 && birthDayNum <= 31) parts.push(String(birthDayNum))
    if (birthMonthNum >= 1 && birthMonthNum <= 12) parts.push(MONTHS[birthMonthNum - 1])
    parts.push(birthYear)
    rows.push(`Date of birth: ${parts.join(' ')}`)
  }

  // Nationality
  const nationality = val(doc, 'Demographics Nationality Description')
    || text(doc, 'Demographics Nationality Description')

  if (nationality) rows.push(`Nationality:   ${nationality}`)

  // Gender
  const gender = val(doc, 'Demographics Gender Description')
    || text(doc, 'Demographics Gender Description')

  if (gender) rows.push(`Gender:        ${gender}`)

  // Title / salutation from PersonName
  const honorific = val(doc, 'PersonName Title') || text(doc, 'PersonName Title')
  if (honorific) rows.push(`Title:         ${honorific}`)

  if (rows.length === 0) return null

  return {
    type: 'personal' as SectionType,
    title: 'Personal Information',
    subtitle: '',
    content: rows.join('\n'),
    layout: 'list',
  }
}

function buildSoftSkills(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const buckets: Array<[string, string]> = [
    ['Communication', 'Communication Description'],
    ['Organisational', 'Organisational Description'],
    ['JobRelated', 'JobRelated Description'],
    ['Other soft', 'Skills Other Description'],
  ]

  const rows: string[] = []
  for (const [label, sel] of buckets) {
    const raw = val(doc, sel) || text(doc, sel)
    if (!raw) continue
    const md = htmlToMarkdown(raw)
    rows.push(`${label}:   ${md.replace(/\n/g, ' ')}`)
  }

  if (rows.length === 0) return null

  return {
    type: 'custom' as SectionType,
    title: 'Soft Skills',
    subtitle: '',
    content: rows.join('\n'),
    layout: 'list',
  }
}

/**
 * Replaces buildProjects. Each Achievement becomes its own section.
 * Code === "Projects" → type = 'projects'; otherwise → type = 'custom', title = code label.
 */
function buildAchievements(doc: Document, warnings: string[]): Omit<CVSection, 'id'>[] {
  const entries = Array.from(doc.querySelectorAll('AchievementList > Achievement'))
  if (entries.length === 0) return []

  // Group by Title Code so entries of the same category land in one section
  const groups = new Map<string, { type: SectionType; title: string; blocks: string[] }>()

  for (const entry of entries) {
    const codeEl = q(entry, 'Title Code')
    const code = codeEl?.getAttribute('code') ?? codeEl?.textContent?.trim() ?? 'achievement'
    const labelEl = q(entry, 'Title Label')
    const sectionTitle = labelEl?.textContent?.trim() || code

    const isProjects = code.toLowerCase() === 'projects'
    const secType: SectionType = isProjects ? 'projects' : 'custom'

    const entryTitle = val(entry, 'Title') || text(entry, 'Title') || sectionTitle
    const rawDesc = val(entry, 'Description') || text(entry, 'Description')
    const description = htmlToMarkdown(rawDesc)

    const block = description
      ? `### ${entryTitle}\n${description}`
      : `### ${entryTitle}`

    const key = code
    if (!groups.has(key)) {
      groups.set(key, { type: secType, title: sectionTitle, blocks: [] })
    }
    groups.get(key)!.blocks.push(block)
  }

  return Array.from(groups.values()).map(({ type, title, blocks }) => ({
    type,
    title,
    subtitle: '',
    content: blocks.join('\n\n'),
    layout: 'list' as const,
  }))
}

// ── Meta builder ───────────────────────────────────────────────────────────

function inferLinkLabel(url: string, useCode: string): string {
  if (useCode && useCode.toLowerCase() !== 'other') {
    // Capitalise the code nicely
    return useCode.charAt(0).toUpperCase() + useCode.slice(1).toLowerCase()
  }
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    if (hostname.includes('github.com')) return 'GitHub'
    if (hostname.includes('linkedin.com')) return 'LinkedIn'
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'Twitter'
    if (hostname.includes('gitlab.com')) return 'GitLab'
    // Strip www. and use hostname as label
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function buildMeta(doc: Document, warnings: string[]): CVMeta {
  const firstName = text(doc, 'FirstName')
  const surname = text(doc, 'Surname')
  const name = [firstName, surname].filter(Boolean).join(' ')

  const title = val(doc, 'Headline Description') || text(doc, 'Headline Description')
  const email = attr(doc, 'Email Contact', 'value') || text(doc, 'Email Contact')
  const phone = attr(doc, 'Telephone Contact', 'value') || text(doc, 'Telephone Contact')

  const municipality = text(doc, 'Municipality')
  const country = text(doc, 'Country Label')
  const location = [municipality, country].filter(Boolean).join(', ')

  // Photo — <Photo MimeType="image/jpeg"><Data>base64...</Data></Photo>
  const photoMimeType = attr(doc, 'Photo', 'mimeType') || text(doc, 'Photo MimeType')
  const photoData = text(doc, 'Photo Data') || val(doc, 'Photo Data')
  let photoUrl: string | undefined
  if (photoData) {
    const mime = photoMimeType || 'image/jpeg'
    const dataStr = photoData.replace(/\s/g, '')
    photoUrl = `data:${mime};base64,${dataStr}`
    const approxBytes = (dataStr.length * 3) / 4
    if (approxBytes > 500 * 1024) {
      warnings.push(`Photo data is large (~${Math.round(approxBytes / 1024)} KB). Consider cropping before re-import.`)
    }
  }

  // WebsiteList → links[]
  const links: CVLink[] = []
  const websiteEls = Array.from(doc.querySelectorAll('WebsiteList > Website'))
  for (const ws of websiteEls) {
    const url = ws.getAttribute('linkTo') || ws.getAttribute('value') || text(ws, 'Contact')
    if (!url) continue
    const useCode = ws.getAttribute('use') || attr(ws, 'Use', 'code') || ''
    const label = inferLinkLabel(url, useCode)
    links.push({ label, url })
  }
  // Single website contact fallback (older schema)
  if (links.length === 0) {
    const singleWebsite = attr(doc, 'Website Contact', 'linkTo') || attr(doc, 'Website Contact', 'value')
    if (singleWebsite) {
      links.push({ label: inferLinkLabel(singleWebsite, ''), url: singleWebsite })
    }
  }

  const meta: CVMeta = {
    name: name || 'Your Name',
    title: title || '',
    email: email || '',
  }

  if (phone) meta.phone = phone
  if (location) meta.location = location
  if (links.length > 0) meta.links = links
  if (photoUrl) {
    meta.photoUrl = photoUrl
    meta.photoMode = 'image'
  }

  return meta
}

// ── Public API ─────────────────────────────────────────────────────────────

export function parseEuropassXML(xmlString: string): EuropassImportResult {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent?.trim().split('\n')[0] ?? 'parse failed'}`)
  }

  const warnings: string[] = []

  if (doc.documentElement.localName !== 'SkillsPassport') {
    warnings.push(`Root element is <${doc.documentElement.localName}>, expected <SkillsPassport>. Will attempt import anyway.`)
  }

  const meta = buildMeta(doc, warnings)

  const sections: Omit<CVSection, 'id'>[] = []

  // Section order: Summary → Personal → Experience → Education → Skills → Soft Skills → Achievements
  const summary = buildSummary(doc, warnings)
  if (summary) sections.push(summary)

  const personal = buildPersonal(doc, warnings)
  if (personal) sections.push(personal)

  const experience = buildExperience(doc, warnings)
  if (experience) sections.push(experience)

  const education = buildEducation(doc, warnings)
  if (education) sections.push(education)

  const skills = buildSkills(doc, warnings)
  if (skills) sections.push(skills)

  const softSkills = buildSoftSkills(doc, warnings)
  if (softSkills) sections.push(softSkills)

  const achievements = buildAchievements(doc, warnings)
  sections.push(...achievements)

  if (sections.length === 0) {
    warnings.push('No sections could be extracted from this XML file.')
  }

  return { meta, sections, warnings }
}
