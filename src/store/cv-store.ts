import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CV, CVMeta, CVSection, CVStyle, DEFAULT_STYLE, DocMode, SectionType } from '@/types/cv'
import { nanoid } from 'nanoid'

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
    content: `### Senior Engineer @ Acme Corp | 2022–present\nLed backend infrastructure team. Built distributed caching layer with Go and Redis.\n\n### Engineer @ Beta Ltd | 2019–2022\nFull-stack development with React and Node.js. Owned CI/CD pipeline migration.`,
    layout: 'vertical',
  },
  {
    id: nanoid(),
    type: 'education',
    title: 'Education',
    subtitle: '',
    content: `### BSc Computer Science | State University | 2015–2019\nGraduated with honours. Thesis on distributed systems.`,
    layout: 'vertical',
  },
  {
    id: nanoid(),
    type: 'skills',
    title: 'Skills',
    subtitle: '',
    content: `Languages:   TypeScript · Go · Python · Rust\nFrameworks:  Next.js · React · Gin · FastAPI\nInfra:       Docker · Kubernetes · AWS · Terraform`,
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
  importCV: (meta: CVMeta, sections: Omit<CVSection, 'id'>[]) => void
}

function sectionDefaults(type: SectionType): Partial<CVSection> {
  switch (type) {
    case 'experience':
      return { title: 'Experience', layout: 'vertical', content: '### Role @ Company | Year–Year\nDescribe your work here.' }
    case 'education':
      return { title: 'Education', layout: 'vertical', content: '### Degree | Institution | Year–Year\nDescribe your studies.' }
    case 'skills':
      return { title: 'Skills', layout: 'list', content: 'Languages:   skill1 · skill2 · skill3\nTools:       tool1 · tool2 · tool3' }
    case 'projects':
      return { title: 'Projects', layout: 'list', content: '### Project Name\nBrief description of what you built. Stack: TypeScript, React, Node.js' }
    case 'photo':
      return { title: 'Photo', layout: 'list', content: '' }
    case 'personal':
      return { title: 'Personal Information', layout: 'list', content: 'Date of birth: \nNationality: \nGender: ' }
    case 'custom':
      return { title: 'Custom Section', layout: 'list', content: 'Write anything here.' }
    default:
      return { title: 'Section', layout: 'list', content: '' }
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
        const newSection: CVSection = {
          id: nanoid(),
          type,
          content: '',
          subtitle: '',
          ...sectionDefaults(type),
        } as CVSection
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
            sections: s.cv.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
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
            ...sec,
          }))
          return {
            cv: { ...s.cv, meta, sections: materialisedSections },
            selectedSectionId: materialisedSections[0]?.id ?? null,
          }
        }),
    }),
    {
      name: 'cvgen-store',
      // Merge persisted data with current defaults so new fields (e.g. style) never come back undefined
      merge: (persisted: unknown, current: CVStore) => {
        const p = persisted as Partial<CVStore> & { cv?: Partial<CV> }
        return {
          ...current,
          ...p,
          cv: {
            ...current.cv,
            ...(p.cv ?? {}),
            docMode: p.cv?.docMode ?? 'md',
            style: { ...DEFAULT_STYLE, ...(p.cv?.style ?? {}) },
          },
        }
      },
    }
  )
)
