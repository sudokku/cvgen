import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CV, CVMeta, CVSection, CVSectionInput, CVStyle, DEFAULT_STYLE, DocMode, SectionType } from '@/types/cv'
import { nanoid } from 'nanoid'
import { normalizeCV, normalizeSection, normalizeSectionInput } from '@/lib/section-formatting'

const defaultMeta: CVMeta = {
  name: 'Your Name',
  title: 'Software Engineer',
  email: 'you@example.com',
  github: 'yourgithub',
  location: 'City, Country',
}

const defaultSections: CVSection[] = [
  {
    id: nanoid(),
    type: 'experience',
    title: 'Experience',
    subtitle: '',
    entries: [
      {
        role: 'Senior Engineer',
        company: 'Acme Corp',
        period: '2022–present',
        details: [
          'Led backend infrastructure team. Built distributed caching layer with Go and Redis.',
        ],
      },
      {
        role: 'Engineer',
        company: 'Beta Ltd',
        period: '2019–2022',
        details: [
          'Full-stack development with React and Node.js. Owned CI/CD pipeline migration.',
        ],
      },
    ],
    layout: 'vertical',
  },
  {
    id: nanoid(),
    type: 'education',
    title: 'Education',
    subtitle: '',
    entries: [
      {
        degree: 'BSc Computer Science',
        institution: 'State University',
        period: '2015–2019',
        details: ['Graduated with honours. Thesis on distributed systems.'],
      },
    ],
    layout: 'vertical',
  },
  {
    id: nanoid(),
    type: 'skills',
    title: 'Skills',
    subtitle: '',
    groups: [
      { category: 'Languages', items: ['TypeScript', 'Go', 'Python', 'Rust'] },
      { category: 'Frameworks', items: ['Next.js', 'React', 'Gin', 'FastAPI'] },
      { category: 'Infra', items: ['Docker', 'Kubernetes', 'AWS', 'Terraform'] },
    ],
    layout: 'list',
  },
]

interface CVStore {
  cv: CV
  selectedSectionId: string | null
  updateMeta: (meta: Partial<CVMeta>) => void
  updateStyle: (style: Partial<CVStyle>) => void
  addSection: (type: SectionType) => void
  deleteSection: (id: string) => void
  updateSection: (id: string, patch: Partial<CVSection>) => void
  reorderSections: (ids: string[]) => void
  selectSection: (id: string | null) => void
  updateDocMode: (mode: DocMode) => void
  importCV: (meta: CVMeta, sections: CVSectionInput[]) => void
  replaceCV: (cv: CV) => void
}

function sectionDefaults(type: SectionType): CVSectionInput {
  switch (type) {
    case 'experience':
      return { type, title: 'Experience', subtitle: '', layout: 'vertical', entries: [{ role: 'Role', company: 'Company', period: 'Year–Year', details: ['Describe your work here.'] }] }
    case 'education':
      return { type, title: 'Education', subtitle: '', layout: 'vertical', entries: [{ degree: 'Degree', institution: 'Institution', period: 'Year–Year', details: ['Describe your studies.'] }] }
    case 'skills':
      return { type, title: 'Skills', subtitle: '', layout: 'list', groups: [{ category: 'Languages', items: ['skill1', 'skill2', 'skill3'] }, { category: 'Tools', items: ['tool1', 'tool2', 'tool3'] }] }
    case 'projects':
      return { type, title: 'Projects', subtitle: '', layout: 'list', entries: [{ name: 'Project Name', description: 'Brief description of what you built.', stack: ['TypeScript', 'React', 'Node.js'], repo: '' }] }
    case 'photo':
      return { type, title: 'Photo', subtitle: '', layout: 'list' }
    case 'personal':
      return { type, title: 'Personal Information', subtitle: '', layout: 'list', rows: [{ key: 'Date of birth', value: '' }, { key: 'Nationality', value: '' }, { key: 'Gender', value: '' }] }
    case 'custom':
      return { type, title: 'Custom Section', subtitle: '', layout: 'list', body: 'Write anything here.' }
    default:
      return { type: 'custom', title: 'Section', subtitle: '', layout: 'list', body: '' }
  }
}

export const useCVStore = create<CVStore>()(
  persist(
    (set) => ({
      cv: { meta: defaultMeta, sections: defaultSections, style: DEFAULT_STYLE, docMode: 'md' },
      selectedSectionId: defaultSections[0].id,

      updateMeta: (meta) =>
        set((s) => ({ cv: { ...s.cv, meta: { ...s.cv.meta, ...meta } } })),

      updateStyle: (style) =>
        set((s) => ({ cv: { ...s.cv, style: { ...s.cv.style, ...style } } })),

      addSection: (type) => {
        const newSection = normalizeSection({
          id: nanoid(),
          ...sectionDefaults(type),
        })
        set((s) => ({
          cv: { ...s.cv, sections: [...s.cv.sections, newSection] },
          selectedSectionId: newSection.id,
        }))
      },

      deleteSection: (id) =>
        set((s) => {
          const sections = s.cv.sections.filter((sec) => sec.id !== id)
          const selectedSectionId =
            s.selectedSectionId === id ? (sections[0]?.id ?? null) : s.selectedSectionId
          return { cv: { ...s.cv, sections }, selectedSectionId }
        }),

      updateSection: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            sections: s.cv.sections.map((sec) => (sec.id === id ? ({ ...sec, ...patch } as CVSection) : sec)),
          },
        })),

      reorderSections: (ids) =>
        set((s) => {
          const map = new Map(s.cv.sections.map((sec) => [sec.id, sec]))
          return { cv: { ...s.cv, sections: ids.map((id) => map.get(id)!).filter(Boolean) } }
        }),

      selectSection: (id) => set({ selectedSectionId: id }),

      updateDocMode: (mode) =>
        set((s) => ({ cv: { ...s.cv, docMode: mode } })),

      importCV: (meta, sections) =>
        set((s) => {
          const materialisedSections: CVSection[] = sections.map((sec) => ({
            id: nanoid(),
            subtitle: '',
            layout: 'list',
            ...normalizeSectionInput(sec),
          }))
          return {
            cv: { ...s.cv, meta, sections: materialisedSections },
            selectedSectionId: materialisedSections[0]?.id ?? null,
          }
        }),

      replaceCV: (cv) =>
        set(() => {
          const normalized = normalizeCV(cv)
          return {
            cv: normalized,
            selectedSectionId: normalized.sections[0]?.id ?? null,
          }
        }),
    }),
    {
      name: 'cvgen-store',
      // Merge persisted data with current defaults so new fields (e.g. style) never come back undefined
      merge: (persisted: unknown, current: CVStore) => {
        const p = persisted as Partial<CVStore> & { cv?: Partial<CV> }
        const normalizedCV = normalizeCV({
          ...current.cv,
          ...(p.cv ?? {}),
          docMode: p.cv?.docMode ?? 'md',
          style: { ...DEFAULT_STYLE, ...(p.cv?.style ?? {}) },
        })
        return {
          ...current,
          ...p,
          cv: normalizedCV,
        }
      },
    }
  )
)
