export type SectionType =
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'photo'
  | 'custom'

export type TimelineLayout = 'vertical' | 'horizontal' | 'list'

export interface CVMeta {
  name: string
  title: string
  email: string
  github?: string
  linkedin?: string
  website?: string
  location?: string
  photoUrl?: string
  photoAscii?: string
  photoWidth?: number   // max ASCII cols (default 50); API fits aspect ratio within this bound
  photoHeight?: number  // max ASCII rows (default 25); API fits aspect ratio within this bound
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
}

export const FONT_OPTIONS = [
  {
    label: 'GitHub Mono (system)',
    value: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
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
  },
}

export const DEFAULT_STYLE: CVStyle = STYLE_PRESETS['github-dark']

export interface CV {
  meta: CVMeta
  sections: CVSection[]
  style: CVStyle
}
