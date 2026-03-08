/**
 * Parses timeline entries from markdown content.
 * Format: ### Role @ Company | Period\nDescription
 */
export interface TimelineEntry {
  role: string
  company: string
  period: string
  description: string
}

export function parseTimelineEntries(content: string): TimelineEntry[] {
  const blocks = content.split(/(?=^### )/m).filter((b) => b.trim())
  return blocks.map((block) => {
    const lines = block.trim().split('\n')
    const header = lines[0].replace(/^### /, '').trim()
    const description = lines.slice(1).join('\n').trim()

    // Support: "Role @ Company | Period" or "Role | Institution | Period"
    const pipeIdx = header.lastIndexOf('|')
    const period = pipeIdx !== -1 ? header.slice(pipeIdx + 1).trim() : ''
    const rest = pipeIdx !== -1 ? header.slice(0, pipeIdx).trim() : header

    const atIdx = rest.indexOf('@')
    const role = atIdx !== -1 ? rest.slice(0, atIdx).trim() : rest
    const company = atIdx !== -1 ? rest.slice(atIdx + 1).trim() : ''

    return { role, company, period, description }
  })
}
