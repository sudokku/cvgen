export type RenderMode = 'md' | 'json'
export type DocMode   = 'md' | 'json' | 'per-section'

export type SectionType =
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'photo'
  | 'personal'
  | 'custom'

export interface CVLink {
  label: string
  url: string
}

export type TimelineLayout = 'vertical' | 'horizontal' | 'list'

export interface CVMeta {
  name: string
  title: string
  email: string
  /** @deprecated Use `links` instead */
  github?: string
  /** @deprecated Use `links` instead */
  linkedin?: string
  /** @deprecated Use `links` instead */
  website?: string
  phone?: string
  location?: string
  links?: CVLink[]
  photoUrl?: string
  photoAscii?: string
  photoWidth?: number   // max ASCII cols (default 50); API fits aspect ratio within this bound
  photoHeight?: number  // max ASCII rows (default 25); API fits aspect ratio within this bound
  photoMode?: 'ascii' | 'image'
}

export interface CVSection {
  id: string
  type: SectionType
  title: string
  subtitle?: string
  content: string
  layout?: TimelineLayout
  photoUrl?: string
  photoAscii?: string
  photoWidth?: number   // max ASCII cols (default 80); API fits aspect ratio within this bound
  photoHeight?: number  // max ASCII rows (default 40); API fits aspect ratio within this bound
  photoMode?: 'ascii' | 'image'
  renderMode?: RenderMode  // only used when CV.docMode === 'per-section'
  sectionColors?: Partial<CVStyle>
}

export interface CVStyle {
  fontFamily: string
  fontSize: number       // px
  bgColor: string
  fgColor: string
  mutedColor: string
  accentColor: string
  borderColor: string
  codeBgColor: string
  headingColor: string      // ## Section Title
  subtitleColor: string     // section subtitle line
  periodColor: string       // timeline period tokens
  roleColor: string         // job / degree title
  companyColor: string      // company / institution
  categoryColor: string     // skills category labels
  projectTitleColor: string // project names
  jsonKeyColor: string
  jsonStringColor: string
  jsonNumberColor: string
  jsonPunctuationColor: string
}

export const FONT_OPTIONS = [
  {
    label: 'GitHub Mono (system)',
    value: '"Monaspace Neon", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  {
    label: 'Monaspace Neon',
    value: '"Monaspace Neon", ui-monospace, monospace',
  },
  {
    label: 'Fira Code',
    value: '"Fira Code", ui-monospace, monospace',
  },
  {
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", ui-monospace, monospace',
  },
  {
    label: 'Cascadia Code',
    value: '"Cascadia Code", ui-monospace, monospace',
  },
  {
    label: 'Courier New',
    value: '"Courier New", Courier, monospace',
  },
]

export const STYLE_PRESETS: Record<string, CVStyle> = {
  'github-dark': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    bgColor: '#0d1117',
    fgColor: '#f0f6fc',
    mutedColor: '#9198a1',
    accentColor: '#4493f8',
    borderColor: '#3d444d',
    codeBgColor: '#151b23',
    headingColor: '#f0f6fc',
    subtitleColor: '#9198a1',
    periodColor: '#4493f8',
    roleColor: '#f0f6fc',
    companyColor: '#9198a1',
    categoryColor: '#4493f8',
    projectTitleColor: '#f0f6fc',
    jsonKeyColor: '#79c0ff',
    jsonStringColor: '#a5d6ff',
    jsonNumberColor: '#79c0ff',
    jsonPunctuationColor: '#9198a1',
  },
  'github-light': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    bgColor: '#ffffff',
    fgColor: '#1f2328',
    mutedColor: '#636c76',
    accentColor: '#0969da',
    borderColor: '#d1d9e0',
    codeBgColor: '#f6f8fa',
    headingColor: '#1f2328',
    subtitleColor: '#636c76',
    periodColor: '#0969da',
    roleColor: '#1f2328',
    companyColor: '#636c76',
    categoryColor: '#0969da',
    projectTitleColor: '#1f2328',
    jsonKeyColor: '#0550ae',
    jsonStringColor: '#0a3069',
    jsonNumberColor: '#0550ae',
    jsonPunctuationColor: '#636c76',
  },
  'dracula': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    bgColor: '#282a36',
    fgColor: '#f8f8f2',
    mutedColor: '#6272a4',
    accentColor: '#50fa7b',
    borderColor: '#44475a',
    codeBgColor: '#1e1f29',
    headingColor: '#f8f8f2',
    subtitleColor: '#6272a4',
    periodColor: '#50fa7b',
    roleColor: '#f8f8f2',
    companyColor: '#6272a4',
    categoryColor: '#ff79c6',
    projectTitleColor: '#bd93f9',
    jsonKeyColor: '#8be9fd',
    jsonStringColor: '#f1fa8c',
    jsonNumberColor: '#bd93f9',
    jsonPunctuationColor: '#6272a4',
  },
  'nord': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    bgColor: '#2e3440',
    fgColor: '#eceff4',
    mutedColor: '#7b88a1',
    accentColor: '#88c0d0',
    borderColor: '#3b4252',
    codeBgColor: '#242932',
    headingColor: '#eceff4',
    subtitleColor: '#7b88a1',
    periodColor: '#88c0d0',
    roleColor: '#eceff4',
    companyColor: '#7b88a1',
    categoryColor: '#88c0d0',
    projectTitleColor: '#81a1c1',
    jsonKeyColor: '#81a1c1',
    jsonStringColor: '#a3be8c',
    jsonNumberColor: '#b48ead',
    jsonPunctuationColor: '#7b88a1',
  },
}

export const DEFAULT_STYLE: CVStyle = STYLE_PRESETS['github-dark']

export interface CV {
  meta: CVMeta
  sections: CVSection[]
  style: CVStyle
  docMode: DocMode
}
