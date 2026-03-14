import { CVLink, CVMeta, CVSection, SectionType } from '@/types/cv'

export interface EuropassImportResult {
  meta: CVMeta
  sections: Omit<CVSection, 'id'>[]
  warnings: string[]
}

// ── DOM helpers ────────────────────────────────────────────────────────────

function q(root: Element | Document, sel: string): Element | null {
  return root.querySelector(sel)
}

function text(root: Element | Document, sel: string): string {
  return q(root, sel)?.textContent?.trim() ?? ''
}

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

function htmlToMarkdown(raw: string): string {
  if (!raw || typeof document === 'undefined') return raw ?? ''
  if (!/<[a-zA-Z]/.test(raw)) {
    const ta = document.createElement('textarea')
    ta.innerHTML = raw
    return ta.value.trim()
  }

  const div = document.createElement('div')
  div.innerHTML = raw

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(walk).join('')
    switch (tag) {
      case 'strong': case 'b': return `**${children}**`
      case 'em': case 'i': return `*${children}*`
      case 'br': return '\n'
      case 'p': return `${children}\n`
      case 'ul': case 'ol': {
        const items = Array.from(el.querySelectorAll(':scope > li'))
        return items.map((li) => `- ${walk(li).trim()}`).join('\n') + '\n'
      }
      case 'li': return children
      default: return children
    }
  }

  return walk(div).replace(/\n{3,}/g, '\n\n').trim()
}

// ── Period formatting ──────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Old SkillsPassport schema period format */
function formatPeriodOld(el: Element | null): string {
  if (!el) return ''

  const fromYear = text(el, 'From Year')
  const fromMonthAttr = q(el, 'From Month')?.getAttribute('month') ?? ''
  const fromMonthNum = parseInt(fromMonthAttr.replace(/^-+/, ''), 10)
  const toYear = text(el, 'To Year')
  const toMonthEl = q(el, 'To Month')
  const toMonthAttr = toMonthEl?.getAttribute('month') ?? ''
  const toMonthNum = parseInt(toMonthAttr.replace(/^-+/, ''), 10)
  const isCurrent = q(el, 'To Current') !== null

  if (!fromYear) return ''

  const hasFromMonth = fromMonthNum >= 1 && fromMonthNum <= 12
  const from = hasFromMonth ? `${MONTHS[fromMonthNum - 1]} ${fromYear}` : fromYear

  if (isCurrent) return `${from}–present`
  if (!toYear) return from
  const hasToMonth = toMonthNum >= 1 && toMonthNum <= 12
  const to = hasToMonth ? `${MONTHS[toMonthNum - 1]} ${toYear}` : toYear
  return `${from}–${to}`
}

/**
 * New Candidate v4 schema period format.
 * Dates are stored in ISO format inside <hr:FormattedDateTime>2022-06-09</hr:FormattedDateTime>.
 * The containing element has children <StartDate> and <EndDate> (or <eures:StartDate>).
 */
function formatPeriodV4(periodEl: Element | null, isCurrentEl: Element | null): string {
  if (!periodEl) return ''

  function parseDateEl(el: Element | null): string {
    if (!el) return ''
    // Works for both <StartDate> and <eures:StartDate>
    const dtEl =
      el.querySelector('FormattedDateTime') ??
      Array.from(el.children).find(c => c.localName === 'FormattedDateTime') ?? null
    const raw = dtEl?.textContent?.trim() ?? ''
    if (!raw) return ''
    // ISO date: YYYY-MM-DD or YYYY-MM or YYYY
    const parts = raw.split('-')
    if (parts.length >= 2) {
      const year = parts[0]
      const month = parseInt(parts[1], 10)
      if (month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${year}`
      return year
    }
    return parts[0]
  }

  // Try both namespace variants for start/end
  const startEl =
    periodEl.querySelector('StartDate') ??
    Array.from(periodEl.children).find(c => c.localName === 'StartDate') ?? null
  const endEl =
    periodEl.querySelector('EndDate') ??
    Array.from(periodEl.children).find(c => c.localName === 'EndDate') ?? null

  const from = parseDateEl(startEl)
  if (!from) return ''

  // Check for current indicator inside the period or passed separately
  const currentEl =
    isCurrentEl ??
    periodEl.querySelector('CurrentIndicator') ??
    Array.from(periodEl.querySelectorAll('*')).find(e => e.localName === 'CurrentIndicator') ?? null
  const isCurrent = currentEl?.textContent?.trim().toLowerCase() === 'true'

  if (isCurrent) return `${from}–present`
  const to = parseDateEl(endEl)
  if (!to) return from
  return `${from}–${to}`
}

// ── Link inference ─────────────────────────────────────────────────────────

function inferLinkLabel(url: string, useCode: string): string {
  if (useCode && useCode.toLowerCase() !== 'other') {
    return useCode.charAt(0).toUpperCase() + useCode.slice(1).toLowerCase()
  }
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    if (hostname.includes('github.com')) return 'GitHub'
    if (hostname.includes('linkedin.com')) return 'LinkedIn'
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'Twitter'
    if (hostname.includes('gitlab.com')) return 'GitLab'
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// OLD SCHEMA — EuroPass SkillsPassport XML
// ══════════════════════════════════════════════════════════════════════════════

function buildExperienceOld(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const entries = Array.from(doc.querySelectorAll('WorkExperienceList > WorkExperience'))
  if (entries.length === 0) return null

  const blocks = entries.map((entry) => {
    const role = val(entry, 'Position Label') || text(entry, 'Position Label')
    const company = val(entry, 'Employer Name') || text(entry, 'Employer Name')
    const period = formatPeriodOld(q(entry, 'Period'))
    const rawDesc = val(entry, 'Activities') || text(entry, 'Activities')
    const description = htmlToMarkdown(rawDesc)

    let header = `### ${role || 'Role'}`
    if (company) header += ` @ ${company}`
    if (period) header += ` | ${period}`
    return description ? `${header}\n${description}` : header
  })

  return { type: 'experience', title: 'Experience', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildEducationOld(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const entries = Array.from(doc.querySelectorAll('EducationList > Education'))
  if (entries.length === 0) return null

  const blocks = entries.map((entry) => {
    const titleEl = q(entry, 'Title')
    const title = titleEl?.textContent?.trim() ?? ''
    const institution = val(entry, 'Organisation Name') || text(entry, 'Organisation Name')
    const period = formatPeriodOld(q(entry, 'Period'))
    const rawDesc = val(entry, 'Description') || text(entry, 'Description')
    const description = htmlToMarkdown(rawDesc)
    const parts = [title, institution, period].filter(Boolean)
    const header = `### ${parts.join(' | ')}`
    return description ? `${header}\n${description}` : header
  })

  return { type: 'education', title: 'Education', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildSkillsOld(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  const motherTongues = Array.from(doc.querySelectorAll('MotherTongueList > MotherTongue'))
    .map((el) => val(el, 'Description') || text(el, 'Description') || null)
    .filter(Boolean) as string[]

  const foreignLangs = Array.from(doc.querySelectorAll('ForeignLanguage'))
    .map((el) => {
      const label = val(el, 'Description') || text(el, 'Description')
      if (!label) return null
      const cefrCode = attr(el, 'GlobalUnderstanding', 'code') || attr(el, 'OverallAssessment', 'code') || ''
      return cefrCode ? `${label} (${cefrCode})` : label
    })
    .filter(Boolean) as string[]

  const allLangs = [...motherTongues.map(l => `${l} (native)`), ...foreignLangs]
  if (allLangs.length > 0) rows.push(`Languages:   ${allLangs.join(' · ')}`)

  const computerDesc = val(doc, 'ComputerSkills Description') || text(doc, 'ComputerSkills Description')
    || val(doc, 'Computer Description') || text(doc, 'Computer Description')
  if (computerDesc) {
    const items = computerDesc.split(/[,;·]/).map(s => s.trim()).filter(Boolean)
    if (items.length > 0) rows.push(`Computer:    ${items.join(' · ')}`)
  }

  const otherDesc = val(doc, 'Skills Other Description') || text(doc, 'Skills Other Description')
  if (otherDesc) {
    const items = otherDesc.split(/[,;·]/).map(s => s.trim()).filter(Boolean)
    if (items.length > 0) rows.push(`Other:       ${items.join(' · ')}`)
  }

  if (rows.length === 0) {
    warnings.push('No skills data found in this EuroPass XML.')
    return null
  }
  return { type: 'skills', title: 'Skills', subtitle: '', content: rows.join('\n'), layout: 'list' }
}

function buildSummaryOld(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const rawSummary = val(doc, 'ProfileSummary Description') || text(doc, 'ProfileSummary Description')
    || val(doc, 'ProfileSummary') || text(doc, 'ProfileSummary')
  if (!rawSummary) return null
  return { type: 'custom', title: 'Summary', subtitle: '', content: htmlToMarkdown(rawSummary), layout: 'list' }
}

function buildPersonalOld(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  const birthYear = text(doc, 'Demographics Birthdate Year')
  const birthMonthAttr = q(doc, 'Demographics Birthdate Month')?.getAttribute('month') ?? ''
  const birthMonthNum = parseInt(birthMonthAttr.replace(/^-+/, ''), 10)
  const birthDayAttr = q(doc, 'Demographics Birthdate Day')?.getAttribute('day') ?? ''
  const birthDayNum = parseInt(birthDayAttr.replace(/^-+/, ''), 10)

  if (birthYear) {
    const parts: string[] = []
    if (birthDayNum >= 1 && birthDayNum <= 31) parts.push(String(birthDayNum))
    if (birthMonthNum >= 1 && birthMonthNum <= 12) parts.push(MONTHS[birthMonthNum - 1])
    parts.push(birthYear)
    rows.push(`Date of birth: ${parts.join(' ')}`)
  }

  const nationality = val(doc, 'Demographics Nationality Description') || text(doc, 'Demographics Nationality Description')
  if (nationality) rows.push(`Nationality:   ${nationality}`)

  const gender = val(doc, 'Demographics Gender Description') || text(doc, 'Demographics Gender Description')
  if (gender) rows.push(`Gender:        ${gender}`)

  if (rows.length === 0) return null
  return { type: 'personal', title: 'Personal Information', subtitle: '', content: rows.join('\n'), layout: 'list' }
}

function buildSoftSkillsOld(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
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
  return { type: 'custom', title: 'Soft Skills', subtitle: '', content: rows.join('\n'), layout: 'list' }
}

function buildAchievementsOld(doc: Document, _warnings: string[]): Omit<CVSection, 'id'>[] {
  const entries = Array.from(doc.querySelectorAll('AchievementList > Achievement'))
  if (entries.length === 0) return []

  const groups = new Map<string, { type: SectionType; title: string; blocks: string[] }>()

  for (const entry of entries) {
    const codeEl = q(entry, 'Title Code')
    const code = codeEl?.getAttribute('code') ?? codeEl?.textContent?.trim() ?? 'achievement'
    const sectionTitle = q(entry, 'Title Label')?.textContent?.trim() || code
    const isProjects = code.toLowerCase() === 'projects'
    const secType: SectionType = isProjects ? 'projects' : 'custom'
    const entryTitle = val(entry, 'Title') || text(entry, 'Title') || sectionTitle
    const rawDesc = val(entry, 'Description') || text(entry, 'Description')
    const block = rawDesc ? `### ${entryTitle}\n${htmlToMarkdown(rawDesc)}` : `### ${entryTitle}`
    if (!groups.has(code)) groups.set(code, { type: secType, title: sectionTitle, blocks: [] })
    groups.get(code)!.blocks.push(block)
  }

  return Array.from(groups.values()).map(({ type, title, blocks }) => ({
    type, title, subtitle: '', content: blocks.join('\n\n'), layout: 'list' as const,
  }))
}

function buildMetaOld(doc: Document, warnings: string[]): CVMeta {
  const firstName = text(doc, 'FirstName')
  const surname = text(doc, 'Surname')
  const name = [firstName, surname].filter(Boolean).join(' ')
  const title = val(doc, 'Headline Description') || text(doc, 'Headline Description')
  const email = attr(doc, 'Email Contact', 'value') || text(doc, 'Email Contact')
  const phone = attr(doc, 'Telephone Contact', 'value') || text(doc, 'Telephone Contact')
  const municipality = text(doc, 'Municipality')
  const country = text(doc, 'Country Label')
  const location = [municipality, country].filter(Boolean).join(', ')

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

  const links: CVLink[] = []
  for (const ws of Array.from(doc.querySelectorAll('WebsiteList > Website'))) {
    const url = ws.getAttribute('linkTo') || ws.getAttribute('value') || text(ws, 'Contact')
    if (!url) continue
    const useCode = ws.getAttribute('use') || attr(ws, 'Use', 'code') || ''
    links.push({ label: inferLinkLabel(url, useCode), url })
  }
  if (links.length === 0) {
    const singleWebsite = attr(doc, 'Website Contact', 'linkTo') || attr(doc, 'Website Contact', 'value')
    if (singleWebsite) links.push({ label: inferLinkLabel(singleWebsite, ''), url: singleWebsite })
  }

  const meta: CVMeta = { name: name || 'Your Name', title: title || '', email: email || '' }
  if (phone) meta.phone = phone
  if (location) meta.location = location
  if (links.length > 0) meta.links = links
  if (photoUrl) { meta.photoUrl = photoUrl; meta.photoMode = 'image' }
  return meta
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW SCHEMA — EuroPass Candidate v4 (HR-XML 3.0, schema version 4.0)
//
// Root element: <Candidate xmlns="http://www.europass.eu/1.0" ...>
// Key paths (all elements are in either the default ns or a prefixed ns):
//
//   Personal:
//     CandidatePerson > PersonName > oa:GivenName
//     CandidatePerson > PersonName > hr:FamilyName
//     CandidatePerson > hr:BirthDate          (ISO date string)
//     CandidatePerson > PrimaryLanguageCode   (ISO 639-2 code, native language)
//     CandidatePerson > Communication[ChannelCode=Email] > oa:URI
//     CandidatePerson > Communication[ChannelCode=Telephone] > oa:DialNumber
//     CandidatePerson > Communication[ChannelCode=Social Media] > oa:URI + UseCode
//     CandidatePerson > Communication > Address > oa:CityName, CountryCode
//
//   Profile:
//     CandidateProfile > hr:ExecutiveSummary  (HTML-encoded)
//
//   Experience:
//     CandidateProfile > EmploymentHistory > EmployerHistory[]
//       hr:OrganizationName
//       PositionHistory > PositionTitle
//       PositionHistory > eures:EmploymentPeriod > eures:StartDate / eures:EndDate
//         > hr:FormattedDateTime (ISO date)
//       PositionHistory > hr:CurrentIndicator (true/false)
//       PositionHistory > oa:Description (HTML-encoded)
//
//   Education:
//     CandidateProfile > EducationHistory > EducationOrganizationAttendance[]
//       hr:OrganizationName
//       EducationDegree > hr:DegreeName
//       AttendancePeriod > StartDate / EndDate > hr:FormattedDateTime
//
//   Languages (PersonQualifications):
//     CandidateProfile > PersonQualifications > PersonCompetency[]
//       where hr:TaxonomyID = "language"
//       CompetencyID (ISO 639-2 or BCP47 code)
//       eures:CompetencyDimension[hr:CompetencyDimensionTypeCode] > eures:Score > hr:ScoreText (CEFR)
//     CandidatePerson > PrimaryLanguageCode = native language code
//
//   Digital Skills:
//     CandidateProfile > DigitalSkills > DigitalSkillsGroup[]
//       Title (group label, optional)
//       DigitalSkill[] (text content)
//     PersonQualifications > PersonCompetency[hr:TaxonomyID=Digital_Skill]
//       hr:CompetencyName
//
//   Photo:
//     CandidateProfile > eures:Attachment > oa:EmbeddedData
//       Contains a data URI: "data:image/png;base64,..."
// ══════════════════════════════════════════════════════════════════════════════

/**
 * querySelector that works across namespace prefixes by matching localName.
 * EuroPass Candidate XML uses mixed namespaces (hr:, oa:, eures:) that
 * CSS selectors cannot address portably across all DOMParser implementations.
 */
function qLocal(root: Element | Document, ...localNames: string[]): Element | null {
  // BFS through the tree matching local names in order
  let current: Element[] = root.nodeType === 9 /* Document */
    ? [((root as Document).documentElement)]
    : [root as Element]

  for (const name of localNames) {
    const next: Element[] = []
    const queue = [...current]
    let found: Element | null = null
    while (queue.length > 0) {
      const el = queue.shift()!
      for (const child of Array.from(el.children)) {
        if (child.localName === name) {
          found = child
          break
        }
        queue.push(child)
      }
      if (found) break
    }
    if (!found) return null
    current = [found]
  }
  return current[0] ?? null
}

function qAllLocal(root: Element | Document, localName: string): Element[] {
  const result: Element[] = []
  const queue: Element[] = root.nodeType === 9
    ? [((root as Document).documentElement)]
    : [root as Element]
  while (queue.length > 0) {
    const el = queue.shift()!
    if (el.localName === localName) result.push(el)
    for (const child of Array.from(el.children)) queue.push(child)
  }
  return result
}

function textLocal(root: Element | Document, ...path: string[]): string {
  return qLocal(root, ...path)?.textContent?.trim() ?? ''
}

/** ISO 639-2 trigraph → English language name */
const ISO639_2: Record<string, string> = {
  rum: 'Romanian', ron: 'Romanian', eng: 'English', fra: 'French', deu: 'German',
  spa: 'Spanish', ita: 'Italian', por: 'Portuguese', nld: 'Dutch', rus: 'Russian',
  pol: 'Polish', ces: 'Czech', slk: 'Slovak', hun: 'Hungarian', ron2: 'Romanian',
  bul: 'Bulgarian', hrv: 'Croatian', srp: 'Serbian', ukr: 'Ukrainian', tur: 'Turkish',
  ara: 'Arabic', zho: 'Chinese', jpn: 'Japanese', kor: 'Korean', hin: 'Hindi',
  swe: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish',
}

function isoToLangName(code: string): string {
  return ISO639_2[code.toLowerCase()] ?? code.toUpperCase()
}

function buildMetaV4(doc: Document, warnings: string[]): CVMeta {
  // Name
  const givenName = textLocal(doc, 'CandidatePerson', 'PersonName', 'GivenName')
    || textLocal(doc, 'PersonName', 'GivenName')
  const familyName = textLocal(doc, 'CandidatePerson', 'PersonName', 'FamilyName')
    || textLocal(doc, 'PersonName', 'FamilyName')
  const name = [givenName, familyName].filter(Boolean).join(' ')

  // Contact info — iterate all Communication elements under CandidatePerson
  const candidatePerson = qLocal(doc, 'CandidatePerson') ?? doc.documentElement
  const communications = qAllLocal(candidatePerson, 'Communication')

  let email = ''
  let phone = ''
  let city = ''
  let countryCode = ''
  const links: CVLink[] = []

  for (const comm of communications) {
    const channelCode = Array.from(comm.children).find(c => c.localName === 'ChannelCode')?.textContent?.trim() ?? ''
    const uri = Array.from(comm.children).find(c => c.localName === 'URI')?.textContent?.trim() ?? ''
    const useCode = Array.from(comm.children).find(c => c.localName === 'UseCode')?.textContent?.trim() ?? ''
    const otherTitle = Array.from(comm.children).find(c => c.localName === 'OtherTitle')?.textContent?.trim() ?? ''

    if (channelCode === 'Email' && uri && !email) {
      email = uri
    } else if (channelCode === 'Telephone') {
      const dialNumber = Array.from(comm.children).find(c => c.localName === 'DialNumber')?.textContent?.trim() ?? ''
      const countryDialing = Array.from(comm.children).find(c => c.localName === 'CountryDialing')?.textContent?.trim() ?? ''
      if (dialNumber && !phone) {
        phone = countryDialing ? `+${countryDialing}${dialNumber}` : dialNumber
      }
    } else if (channelCode === 'Social Media' && uri) {
      const label = useCode && useCode !== 'other'
        ? inferLinkLabel(uri, useCode)
        : (otherTitle || inferLinkLabel(uri, ''))
      links.push({ label, url: uri })
    } else if (channelCode === 'Web' && uri) {
      links.push({ label: inferLinkLabel(uri, ''), url: uri })
    } else if (channelCode === '' || channelCode === undefined) {
      // May be an address block
      const addrEl = Array.from(comm.children).find(c => c.localName === 'Address')
      if (addrEl) {
        city = Array.from(addrEl.children).find(c => c.localName === 'CityName')?.textContent?.trim() ?? city
        countryCode = Array.from(addrEl.children).find(c => c.localName === 'CountryCode')?.textContent?.trim() ?? countryCode
      }
    }
  }

  // Location from address
  const location = city || ''

  // Photo — stored as a data URI in eures:Attachment > oa:EmbeddedData
  let photoUrl: string | undefined
  const embeddedData = qLocal(doc, 'Attachment', 'EmbeddedData') ??
    qLocal(doc, 'eures:Attachment', 'oa:EmbeddedData')
  const rawEmbedded = embeddedData?.textContent?.trim()
  if (rawEmbedded) {
    // Could be a bare data URI or base64-encoded data URI
    if (rawEmbedded.startsWith('data:')) {
      photoUrl = rawEmbedded
    } else {
      // Try decoding as base64 to get the data URI
      try {
        const decoded = Buffer.from(rawEmbedded, 'base64').toString('utf8')
        if (decoded.startsWith('data:')) photoUrl = decoded
      } catch { /* ignore */ }
    }
    if (photoUrl) {
      const approxBytes = photoUrl.length * 0.75
      if (approxBytes > 500 * 1024) {
        warnings.push(`Photo data is large (~${Math.round(approxBytes / 1024)} KB). Consider cropping before re-import.`)
      }
    }
  }

  const meta: CVMeta = { name: name || 'Your Name', title: '', email: email || '' }
  if (phone) meta.phone = phone
  if (location) meta.location = location
  if (links.length > 0) meta.links = links
  if (photoUrl) { meta.photoUrl = photoUrl; meta.photoMode = 'image' }
  return meta
}

function buildSummaryV4(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const rawSummary = textLocal(doc, 'CandidateProfile', 'ExecutiveSummary')
    || textLocal(doc, 'ExecutiveSummary')
  if (!rawSummary) return null
  return { type: 'custom', title: 'Summary', subtitle: '', content: htmlToMarkdown(rawSummary), layout: 'list' }
}

function buildExperienceV4(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const employerHistories = qAllLocal(doc, 'EmployerHistory')
  if (employerHistories.length === 0) return null

  const blocks = employerHistories.map((employer) => {
    const company = Array.from(employer.children).find(c => c.localName === 'OrganizationName')?.textContent?.trim()
      ?? qAllLocal(employer, 'OrganizationName')[0]?.textContent?.trim() ?? ''

    const positionHistory = Array.from(employer.children).find(c => c.localName === 'PositionHistory')
      ?? qAllLocal(employer, 'PositionHistory')[0]
    if (!positionHistory) {
      return company ? `### Role @ ${company}` : null
    }

    const role = Array.from(positionHistory.children).find(c => c.localName === 'PositionTitle')?.textContent?.trim() ?? ''

    // Employment period
    const empPeriodEl = Array.from(positionHistory.children).find(c => c.localName === 'EmploymentPeriod')
      ?? qAllLocal(positionHistory, 'EmploymentPeriod')[0]
    const currentEl = empPeriodEl
      ? (Array.from(empPeriodEl.children).find(c => c.localName === 'CurrentIndicator') ??
         qAllLocal(empPeriodEl, 'CurrentIndicator')[0])
      : null
    const period = empPeriodEl ? formatPeriodV4(empPeriodEl, currentEl ?? null) : ''

    // Description — oa:Description with HTML-encoded content
    const descEl = Array.from(positionHistory.children).find(c => c.localName === 'Description')
    const rawDesc = descEl?.textContent?.trim() ?? ''
    const description = htmlToMarkdown(rawDesc)

    let header = `### ${role || 'Role'}`
    if (company) header += ` @ ${company}`
    if (period) header += ` | ${period}`
    return description ? `${header}\n${description}` : header
  }).filter(Boolean) as string[]

  if (blocks.length === 0) return null
  return { type: 'experience', title: 'Experience', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildEducationV4(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const attendances = qAllLocal(doc, 'EducationOrganizationAttendance')
  if (attendances.length === 0) return null

  const blocks = attendances.map((att) => {
    const institution = Array.from(att.children).find(c => c.localName === 'OrganizationName')?.textContent?.trim()
      ?? qAllLocal(att, 'OrganizationName')[0]?.textContent?.trim() ?? ''

    const degreeEl = qAllLocal(att, 'EducationDegree')[0]
    const degree = degreeEl
      ? (Array.from(degreeEl.children).find(c => c.localName === 'DegreeName')?.textContent?.trim()
         ?? qAllLocal(degreeEl, 'DegreeName')[0]?.textContent?.trim() ?? '')
      : ''

    const attendancePeriod = Array.from(att.children).find(c => c.localName === 'AttendancePeriod')
    const period = attendancePeriod ? formatPeriodV4(attendancePeriod, null) : ''

    const parts = [degree, institution, period].filter(Boolean)
    if (parts.length === 0) return null
    return `### ${parts.join(' | ')}`
  }).filter(Boolean) as string[]

  if (blocks.length === 0) return null
  return { type: 'education', title: 'Education', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildSkillsV4(doc: Document, warnings: string[]): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  // Languages — PersonCompetency elements with TaxonomyID = "language"
  const nativeLangCode = textLocal(doc, 'CandidatePerson', 'PrimaryLanguageCode')
    || textLocal(doc, 'PrimaryLanguageCode')

  const langCompetencies = qAllLocal(doc, 'PersonCompetency').filter(pc => {
    const taxId = Array.from(pc.children).find(c => c.localName === 'TaxonomyID')?.textContent?.trim() ?? ''
    return taxId.toLowerCase() === 'language'
  })

  const langParts: string[] = []
  if (nativeLangCode) {
    langParts.push(`${isoToLangName(nativeLangCode)} (native)`)
  }

  for (const pc of langCompetencies) {
    const langCode = Array.from(pc.children).find(c => c.localName === 'CompetencyID')?.textContent?.trim() ?? ''
    if (!langCode) continue
    if (nativeLangCode && langCode.toLowerCase() === nativeLangCode.toLowerCase()) continue

    // Find overall CEFR — best score across all dimensions
    const dimensions = qAllLocal(pc, 'CompetencyDimension')
    const scores = dimensions.map(dim => {
      const scoreEl = Array.from(dim.children).find(c => c.localName === 'Score')
      return (scoreEl ? Array.from(scoreEl.children).find(c => c.localName === 'ScoreText')?.textContent?.trim() : null) ?? ''
    }).filter(Boolean)

    const langName = isoToLangName(langCode)
    if (scores.length > 0) {
      // Use first score as representative overall level
      langParts.push(`${langName} (${scores[0]})`)
    } else {
      langParts.push(langName)
    }
  }

  if (langParts.length > 0) rows.push(`Languages:   ${langParts.join(' · ')}`)

  // Digital skills — DigitalSkillsGroup (groups with optional Title)
  const digitalGroups = qAllLocal(doc, 'DigitalSkillsGroup')
  if (digitalGroups.length > 0) {
    for (const group of digitalGroups) {
      const groupTitle = Array.from(group.children).find(c => c.localName === 'Title')?.textContent?.trim() ?? ''
      const skills = Array.from(group.children)
        .filter(c => c.localName === 'DigitalSkill')
        .map(c => c.textContent?.trim() ?? '')
        .filter(Boolean)
      if (skills.length > 0) {
        const label = groupTitle || 'Digital'
        rows.push(`${label}:${' '.repeat(Math.max(1, 13 - label.length))}${skills.join(' · ')}`)
      }
    }
  }

  // Digital skills stored as PersonCompetency with TaxonomyID = Digital_Skill (FFGG variant)
  const digitalCompetencies = qAllLocal(doc, 'PersonCompetency').filter(pc => {
    const taxId = Array.from(pc.children).find(c => c.localName === 'TaxonomyID')?.textContent?.trim() ?? ''
    return taxId.toLowerCase().replace(/[-_]/g, '') === 'digitalskill'
  })
  if (digitalCompetencies.length > 0 && digitalGroups.length === 0) {
    const skillNames = digitalCompetencies
      .map(pc => Array.from(pc.children).find(c => c.localName === 'CompetencyName')?.textContent?.trim() ?? '')
      .filter(Boolean)
    if (skillNames.length > 0) rows.push(`Digital:     ${skillNames.join(' · ')}`)
  }

  if (rows.length === 0) {
    warnings.push('No skills data found in this EuroPass XML.')
    return null
  }

  return { type: 'skills', title: 'Skills', subtitle: '', content: rows.join('\n'), layout: 'list' }
}

function buildProjectsV4(doc: Document, _warnings: string[]): Omit<CVSection, 'id'> | null {
  const projects = qAllLocal(doc, 'Project')
  if (projects.length === 0) return null

  const blocks = projects.map((project) => {
    const titleEl = Array.from(project.children).find(c => c.localName === 'Title')
    const descEl = Array.from(project.children).find(c => c.localName === 'Description')
    const linkEl = Array.from(project.children).find(c => c.localName === 'Link')

    const title = titleEl?.textContent?.trim() || 'Project'
    const rawDesc = descEl?.textContent?.trim() ?? ''
    const description = htmlToMarkdown(rawDesc)
    const link = linkEl?.textContent?.trim() ?? ''

    const header = `### ${title}`
    const parts: string[] = []
    if (description) parts.push(description)
    if (link) parts.push(`Link: ${link}`)
    return parts.length > 0 ? `${header}\n${parts.join('\n')}` : header
  })

  if (blocks.length === 0) return null
  return { type: 'projects', title: 'Projects', subtitle: '', content: blocks.join('\n\n'), layout: 'list' }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEXT PARSER — for PDFs with no embedded XML (pdfjs text extraction fallback)
//
// The pdfjs text extraction of EuroPass PDFs produces text with clear section
// headers in ALL CAPS: WORK EXPERIENCE, EDUCATION & TRAINING, LANGUAGE SKILLS,
// SKILLS, ABOUT MYSELF, etc.
//
// Each work experience entry has the pattern:
//   DD/MM/YYYY - DD/MM/YYYY - CITY, COUNTRY
//   JOB TITLE
//   COMPANY NAME
//   Description text
//
// Education entries:
//   DD/MM/YYYY - DD/MM/YYYY - CITY, COUNTRY
//   DEGREE NAME - INSTITUTION NAME
//
// Languages:
//   Mother tongue(s): LANGUAGE
//   Then a table of LANGUAGE CEF_SCORES
//
// Skills:
//   Group label
//   skill1 | skill2 | ...
// ══════════════════════════════════════════════════════════════════════════════

const DATE_RANGE_RE = /^(\d{2}\/\d{2}\/\d{4})\s*-\s*(?:(\d{2}\/\d{2}\/\d{4})|CURRENT)\s*(?:-\s*.+)?$/i

function parseDateRange(line: string): { from: string; to: string } | null {
  const m = line.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*((?:\d{2}\/\d{2}\/\d{4})|CURRENT)/i)
  if (!m) return null
  return { from: m[1], to: m[2] }
}

function formatDateDMY(dmy: string): string {
  // DD/MM/YYYY → "Mon YYYY"
  const parts = dmy.split('/')
  if (parts.length < 3) return dmy
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const year = parts[2]
  if (month < 1 || month > 12) return year
  return `${MONTHS[month - 1]} ${year}`
}

function formatDateRangeText(from: string, to: string): string {
  const f = formatDateDMY(from)
  if (to.toUpperCase() === 'CURRENT') return `${f}–present`
  return `${f}–${formatDateDMY(to)}`
}

/**
 * Split the PDF text into sections by ALL-CAPS headers.
 * Returns a map of header name → lines in that section.
 */
function splitTextIntoSections(fullText: string): Map<string, string[]> {
  // Known EuroPass section headers
  const SECTION_HEADERS = [
    'WORK EXPERIENCE',
    'EDUCATION AND TRAINING',
    'EDUCATION & TRAINING',
    'LANGUAGE SKILLS',
    'SKILLS',
    'ABOUT MYSELF',
    'PERSONAL INFORMATION',
    'ADDITIONAL INFORMATION',
    'DIGITAL SKILLS',
    'COMMUNICATION SKILLS',
    'ORGANISATIONAL SKILLS',
    'JOB-RELATED SKILLS',
    'ACHIEVEMENTS',
  ]

  const sections = new Map<string, string[]>()
  const lines = fullText.split(/\n+/).map(l => l.trim()).filter(Boolean)

  let currentSection = '__header__'
  sections.set(currentSection, [])

  for (const line of lines) {
    const upper = line.toUpperCase().replace(/\s+/g, ' ').trim()
    const matchedHeader = SECTION_HEADERS.find(h => upper === h || upper.startsWith(h + ' '))
    if (matchedHeader) {
      currentSection = matchedHeader
      if (!sections.has(currentSection)) sections.set(currentSection, [])
    } else {
      sections.get(currentSection)!.push(line)
    }
  }

  return sections
}

function buildMetaFromText(headerLines: string[], warnings: string[]): CVMeta {
  // The header section contains: Name, then contact info fields like:
  // "Date of birth:   20/05/2000 |   Nationality:   Moldovan |   Gender:   Male |   Phone:   (+40) 743798001 (Mobile) |   Email address:   foo@bar.com"
  const meta: CVMeta = { name: '', title: '', email: '' }

  // Join and split by common separators
  const headerText = headerLines.join(' ')

  // Name is usually the first thing before any field labels
  const firstFieldIdx = headerText.search(/Date of birth:|Email|Phone:|Address:|Nationality:|Gender:/)
  if (firstFieldIdx > 0) {
    meta.name = headerText.slice(0, firstFieldIdx).trim()
  } else if (headerLines.length > 0) {
    meta.name = headerLines[0]
  }

  // Extract fields from "Label:   value |  " pattern
  const fieldPattern = /([A-Za-z][A-Za-z ]+?):\s+([^|]+?)(?:\s*\||$)/g
  let m: RegExpExecArray | null
  const links: CVLink[] = []

  while ((m = fieldPattern.exec(headerText)) !== null) {
    const label = m[1].trim().toLowerCase()
    const value = m[2].trim()

    if (label.includes('email')) {
      if (!meta.email) meta.email = value
    } else if (label === 'phone') {
      meta.phone = value.replace(/\s*\(.*?\)\s*$/g, '').trim()
    } else if (label === 'address') {
      // strip postal code at start if present
      meta.location = value.replace(/^\d[\d\s]*,\s*/, '').trim()
    } else if (/linkedin/i.test(label) || /github/i.test(label) || /facebook/i.test(label)) {
      links.push({ label: m[1].trim(), url: value })
    } else if (value.startsWith('http')) {
      links.push({ label: m[1].trim(), url: value })
    }
  }

  if (links.length > 0) meta.links = links
  if (!meta.name) warnings.push('Could not detect name from PDF text.')
  return meta
}

function buildExperienceFromText(lines: string[]): Omit<CVSection, 'id'> | null {
  if (lines.length === 0) return null

  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const dateRange = parseDateRange(line)
    if (dateRange) {
      const period = formatDateRangeText(dateRange.from, dateRange.to)
      i++
      // Next line should be job title (ALL CAPS in EuroPass)
      const role = i < lines.length ? lines[i++] : ''
      // Next line should be company name
      const company = i < lines.length ? lines[i++] : ''
      // Remaining lines until next date range are description
      const descLines: string[] = []
      while (i < lines.length && !parseDateRange(lines[i])) {
        // Skip "Department: ... | Email: ... | Website: ..." type meta lines
        if (!/^(Department|Email|Website|Address):\s/i.test(lines[i])) {
          descLines.push(lines[i])
        }
        i++
      }
      const description = descLines.join(' ').trim()
      let header = `### ${role || 'Role'}`
      if (company) header += ` @ ${company}`
      if (period) header += ` | ${period}`
      blocks.push(description ? `${header}\n${description}` : header)
    } else {
      i++
    }
  }

  if (blocks.length === 0) return null
  return { type: 'experience', title: 'Experience', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildEducationFromText(lines: string[]): Omit<CVSection, 'id'> | null {
  if (lines.length === 0) return null

  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const dateRange = parseDateRange(line)
    if (dateRange) {
      const period = formatDateRangeText(dateRange.from, dateRange.to)
      i++
      // Next line is "DEGREE - INSTITUTION" or just institution
      const degreeAndInst = i < lines.length ? lines[i++] : ''
      // Skip any follow-up detail lines
      while (i < lines.length && !parseDateRange(lines[i])) i++
      // Split degree and institution (some use " - " separator)
      const parts = degreeAndInst.split(' - ')
      const degree = parts[0]?.trim() ?? ''
      const institution = parts.slice(1).join(' - ').trim()
      const headerParts = [degree, institution, period].filter(Boolean)
      blocks.push(`### ${headerParts.join(' | ')}`)
    } else {
      i++
    }
  }

  if (blocks.length === 0) return null
  return { type: 'education', title: 'Education', subtitle: '', content: blocks.join('\n\n'), layout: 'vertical' }
}

function buildSkillsFromText(
  langLines: string[],
  skillsLines: string[],
): Omit<CVSection, 'id'> | null {
  const rows: string[] = []

  // Language skills section
  if (langLines.length > 0) {
    const motherTongueMatch = langLines.join(' ').match(/Mother tongue[^:]*:\s+([A-Z][A-Za-z]+(?:\s*,\s*[A-Z][A-Za-z]+)*)/i)
    const motherTongues = motherTongueMatch ? motherTongueMatch[1].split(',').map(s => s.trim()) : []

    // Foreign languages follow — each looks like "LANGUAGE  CEF  CEF  ..."
    // The EuroPass text format is: WRITING  UNDERSTANDING  SPEAKING headers, then rows
    const foreignLangs: string[] = []
    let sawHeader = false
    for (const line of langLines) {
      if (/WRITING|UNDERSTANDING|SPEAKING|Listening|Reading|Spoken/i.test(line)) {
        sawHeader = true
        continue
      }
      if (!sawHeader) continue
      // A language line starts with a language name followed by CEFR codes
      const langMatch = line.match(/^([A-Z][A-Za-z]+(?:\s[A-Za-z]+)?)\s+((?:[A-C][12]\s*)+)/)
      if (langMatch) {
        const lang = langMatch[1]
        // First CEFR code as overall level
        const cefrMatch = langMatch[2].trim().match(/[A-C][12]/)
        const cefr = cefrMatch ? cefrMatch[0] : ''
        foreignLangs.push(cefr ? `${lang} (${cefr})` : lang)
      }
    }

    const allLangs = [
      ...motherTongues.map(l => `${l} (native)`),
      ...foreignLangs,
    ]
    if (allLangs.length > 0) rows.push(`Languages:   ${allLangs.join(' · ')}`)
  }

  // Skills section — group label followed by "skill1 | skill2 | ..." lines
  if (skillsLines.length > 0) {
    let currentGroup = ''
    for (const line of skillsLines) {
      // Pipe-separated skills line
      if (line.includes(' | ') || line.includes('|')) {
        const skills = line.split('|').map(s => s.trim()).filter(Boolean)
        if (skills.length > 1) {
          const label = currentGroup || 'Skills'
          rows.push(`${label}:${' '.repeat(Math.max(1, 13 - label.length))}${skills.join(' · ')}`)
          currentGroup = ''
          continue
        }
      }
      // Short line without pipe = group label
      if (line.length < 60 && !line.includes(':')) {
        currentGroup = line
      }
    }
  }

  if (rows.length === 0) return null
  return { type: 'skills', title: 'Skills', subtitle: '', content: rows.join('\n'), layout: 'list' }
}

function buildSummaryFromText(lines: string[]): Omit<CVSection, 'id'> | null {
  const content = lines.join('\n').trim()
  if (!content) return null
  return { type: 'custom', title: 'Summary', subtitle: '', content, layout: 'list' }
}

// ══════════════════════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════════════════════

export function parseEuropassXML(xmlString: string): EuropassImportResult {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml')

  const parseError = doc.querySelector('parseerror') ?? doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid XML: ${parseError.textContent?.trim().split('\n')[0] ?? 'parse failed'}`)
  }

  const warnings: string[] = []
  const rootName = doc.documentElement.localName

  // Detect schema version
  const isCandidate = rootName === 'Candidate'
  const isSkillsPassport = rootName === 'SkillsPassport'

  if (!isCandidate && !isSkillsPassport) {
    warnings.push(`Root element is <${rootName}>, expected <Candidate> or <SkillsPassport>. Will attempt import anyway.`)
  }

  const sections: Omit<CVSection, 'id'>[] = []
  let meta: CVMeta

  if (isCandidate || (!isSkillsPassport && isCandidate)) {
    // New EuroPass Candidate v4 schema
    meta = buildMetaV4(doc, warnings)

    const summary = buildSummaryV4(doc, warnings)
    if (summary) sections.push(summary)

    const experience = buildExperienceV4(doc, warnings)
    if (experience) sections.push(experience)

    const education = buildEducationV4(doc, warnings)
    if (education) sections.push(education)

    const skills = buildSkillsV4(doc, warnings)
    if (skills) sections.push(skills)

    const projects = buildProjectsV4(doc, warnings)
    if (projects) sections.push(projects)
  } else {
    // Legacy SkillsPassport schema
    meta = buildMetaOld(doc, warnings)

    const summary = buildSummaryOld(doc, warnings)
    if (summary) sections.push(summary)

    const personal = buildPersonalOld(doc, warnings)
    if (personal) sections.push(personal)

    const experience = buildExperienceOld(doc, warnings)
    if (experience) sections.push(experience)

    const education = buildEducationOld(doc, warnings)
    if (education) sections.push(education)

    const skills = buildSkillsOld(doc, warnings)
    if (skills) sections.push(skills)

    const softSkills = buildSoftSkillsOld(doc, warnings)
    if (softSkills) sections.push(softSkills)

    const achievements = buildAchievementsOld(doc, warnings)
    sections.push(...achievements)
  }

  if (sections.length === 0) {
    warnings.push('No sections could be extracted from this XML file.')
  }

  return { meta, sections, warnings }
}

/**
 * Parses pdfjs-extracted text from a EuroPass PDF that has no embedded XML.
 * The text is structured with ALL-CAPS section headers.
 */
export function parseEuropassText(text: string): EuropassImportResult {
  const warnings: string[] = []
  const sections = splitTextIntoSections(text)

  const headerLines = sections.get('__header__') ?? []
  const meta = buildMetaFromText(headerLines, warnings)

  const cvSections: Omit<CVSection, 'id'>[] = []

  const aboutLines = sections.get('ABOUT MYSELF') ?? []
  const summarySection = buildSummaryFromText(aboutLines)
  if (summarySection) cvSections.push(summarySection)

  const expLines = sections.get('WORK EXPERIENCE') ?? []
  const expSection = buildExperienceFromText(expLines)
  if (expSection) cvSections.push(expSection)

  const eduLines = sections.get('EDUCATION AND TRAINING') ?? sections.get('EDUCATION & TRAINING') ?? []
  const eduSection = buildEducationFromText(eduLines)
  if (eduSection) cvSections.push(eduSection)

  const langLines = sections.get('LANGUAGE SKILLS') ?? []
  const skillsLines = sections.get('SKILLS') ?? []
  const skillsSection = buildSkillsFromText(langLines, skillsLines)
  if (skillsSection) cvSections.push(skillsSection)

  if (cvSections.length === 0) {
    warnings.push('Could not extract structured sections from this PDF. The text may not follow the standard EuroPass layout.')
  }

  return { meta, sections: cvSections, warnings }
}
