import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { CV, CVMeta, CVSection, CVStyle, DEFAULT_STYLE, DocMode, SectionType } from '@/types/cv'
import { nanoid } from 'nanoid'

// ─── Reproduce the store logic WITHOUT the persist middleware ──────────────
// This lets us test all mutations in isolation, with a fresh store each test,
// without fighting localStorage or Zustand's persisted-state merge logic.

function sectionDefaults(type: SectionType): Partial<CVSection> {
  switch (type) {
    case 'experience':
      return { title: 'Experience', layout: 'vertical', content: '### Role @ Company | Year–Year\nDescribe your work here.' }
    case 'education':
      return { title: 'Education', layout: 'vertical', content: '### Degree | Institution | Year–Year\nDescribe your studies.' }
    case 'skills':
      return { title: 'Skills', layout: 'list', content: 'Languages:   skill1 · skill2 · skill3\nTools:       tool1 · tool2 · tool3' }
    case 'projects':
      return { title: 'Projects', layout: 'list', content: '### Project Name\nBrief description.' }
    case 'photo':
      return { title: 'Photo', layout: 'list', content: '' }
    case 'personal':
      return { title: 'Personal Information', layout: 'list', content: 'Date of birth: \nNationality: \nGender: ' }
    case 'custom':
    default:
      return { title: 'Custom Section', layout: 'list', content: 'Write anything here.' }
  }
}

const initialMeta: CVMeta = {
  name: 'Test User',
  title: 'Engineer',
  email: 'test@example.com',
}

const initialSection: CVSection = {
  id: 'initial-section',
  type: 'experience',
  title: 'Experience',
  content: '### Dev @ Foo | 2020–2023',
  subtitle: '',
  layout: 'vertical',
}

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

function createTestStore() {
  return create<CVStore>()((set) => ({
    cv: {
      meta: { ...initialMeta },
      sections: [{ ...initialSection }],
      style: { ...DEFAULT_STYLE },
      docMode: 'md',
    },
    selectedSectionId: initialSection.id,

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
  }))
}

// Each test gets a fresh store instance.
let store: ReturnType<typeof createTestStore>

beforeEach(() => {
  store = createTestStore()
})

describe('cv-store: updateMeta', () => {
  it('merges partial meta into existing meta', () => {
    store.getState().updateMeta({ name: 'New Name' })
    const { meta } = store.getState().cv
    expect(meta.name).toBe('New Name')
    // untouched fields remain
    expect(meta.email).toBe('test@example.com')
    expect(meta.title).toBe('Engineer')
  })

  it('can update multiple meta fields at once', () => {
    store.getState().updateMeta({ name: 'Alice', title: 'Architect' })
    const { meta } = store.getState().cv
    expect(meta.name).toBe('Alice')
    expect(meta.title).toBe('Architect')
  })
})

describe('cv-store: addSection', () => {
  it('appends a new section to the sections array', () => {
    const before = store.getState().cv.sections.length
    store.getState().addSection('skills')
    expect(store.getState().cv.sections.length).toBe(before + 1)
  })

  it('assigns a unique id to the new section', () => {
    store.getState().addSection('skills')
    store.getState().addSection('projects')
    const sections = store.getState().cv.sections
    const ids = sections.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('sets the new section type correctly', () => {
    store.getState().addSection('education')
    const sections = store.getState().cv.sections
    const added = sections[sections.length - 1]
    expect(added.type).toBe('education')
  })

  it('selects the newly added section', () => {
    store.getState().addSection('skills')
    const sections = store.getState().cv.sections
    const lastId = sections[sections.length - 1].id
    expect(store.getState().selectedSectionId).toBe(lastId)
  })
})

describe('cv-store: deleteSection', () => {
  it('removes the section with the given id', () => {
    store.getState().deleteSection(initialSection.id)
    const remaining = store.getState().cv.sections
    expect(remaining.find((s) => s.id === initialSection.id)).toBeUndefined()
  })

  it('does nothing when the id does not match any section', () => {
    const before = store.getState().cv.sections.length
    store.getState().deleteSection('nonexistent-id')
    expect(store.getState().cv.sections.length).toBe(before)
  })

  it('moves selectedSectionId to the first remaining section when the selected section is deleted', () => {
    // Add a second section so there is something to fall back to.
    store.getState().addSection('skills')
    const secondId = store.getState().cv.sections[1].id

    // Select the first section, then delete it.
    store.getState().selectSection(initialSection.id)
    store.getState().deleteSection(initialSection.id)

    expect(store.getState().selectedSectionId).toBe(secondId)
  })

  it('sets selectedSectionId to null when the last section is deleted', () => {
    store.getState().deleteSection(initialSection.id)
    expect(store.getState().selectedSectionId).toBeNull()
  })
})

describe('cv-store: updateSection', () => {
  it('patches the matching section with provided fields', () => {
    store.getState().updateSection(initialSection.id, { title: 'Work History' })
    const updated = store.getState().cv.sections.find((s) => s.id === initialSection.id)
    expect(updated?.title).toBe('Work History')
  })

  it('does not modify other sections', () => {
    store.getState().addSection('skills')
    const skillsId = store.getState().cv.sections[1].id

    store.getState().updateSection(initialSection.id, { title: 'Changed' })

    const skills = store.getState().cv.sections.find((s) => s.id === skillsId)
    expect(skills?.title).toBe('Skills') // default title from sectionDefaults
  })

  it('preserves existing fields that are not in the patch', () => {
    store.getState().updateSection(initialSection.id, { title: 'Updated Title' })
    const updated = store.getState().cv.sections.find((s) => s.id === initialSection.id)
    expect(updated?.content).toBe(initialSection.content)
    expect(updated?.type).toBe(initialSection.type)
  })
})

describe('cv-store: reorderSections', () => {
  it('reorders sections to match the provided id array', () => {
    store.getState().addSection('skills')
    store.getState().addSection('projects')

    const sections = store.getState().cv.sections
    const [a, b, c] = sections.map((s) => s.id)

    // Reverse the order
    store.getState().reorderSections([c, b, a])

    const reordered = store.getState().cv.sections
    expect(reordered[0].id).toBe(c)
    expect(reordered[1].id).toBe(b)
    expect(reordered[2].id).toBe(a)
  })

  it('drops sections whose ids are not in the provided array', () => {
    store.getState().addSection('skills')
    const sections = store.getState().cv.sections
    const keepId = sections[0].id

    store.getState().reorderSections([keepId])

    expect(store.getState().cv.sections).toHaveLength(1)
    expect(store.getState().cv.sections[0].id).toBe(keepId)
  })
})

describe('cv-store: importCV', () => {
  it('replaces meta with the imported meta', () => {
    const newMeta: CVMeta = { name: 'Imported User', title: 'Designer', email: 'imp@example.com' }
    store.getState().importCV(newMeta, [])
    expect(store.getState().cv.meta).toEqual(newMeta)
  })

  it('replaces sections with materialised versions of the imported sections', () => {
    const newMeta: CVMeta = { name: 'User', title: 'Dev', email: 'u@e.com' }
    const imported: Omit<CVSection, 'id'>[] = [
      { type: 'skills', title: 'Skills', content: 'TypeScript' },
      { type: 'experience', title: 'Experience', content: '### Dev @ Foo | 2020' },
    ]
    store.getState().importCV(newMeta, imported)
    const sections = store.getState().cv.sections
    expect(sections).toHaveLength(2)
    expect(sections[0].title).toBe('Skills')
    expect(sections[1].title).toBe('Experience')
  })

  it('assigns a unique id to each imported section', () => {
    const newMeta: CVMeta = { name: 'U', title: 'T', email: 'u@e.com' }
    const imported: Omit<CVSection, 'id'>[] = [
      { type: 'skills', title: 'Skills', content: 'TS' },
      { type: 'skills', title: 'More Skills', content: 'Go' },
    ]
    store.getState().importCV(newMeta, imported)
    const ids = store.getState().cv.sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('selects the first imported section after import', () => {
    const newMeta: CVMeta = { name: 'U', title: 'T', email: 'u@e.com' }
    const imported: Omit<CVSection, 'id'>[] = [
      { type: 'skills', title: 'Skills', content: 'TS' },
    ]
    store.getState().importCV(newMeta, imported)
    const firstId = store.getState().cv.sections[0].id
    expect(store.getState().selectedSectionId).toBe(firstId)
  })

  it('sets selectedSectionId to null when imported sections are empty', () => {
    const newMeta: CVMeta = { name: 'U', title: 'T', email: 'u@e.com' }
    store.getState().importCV(newMeta, [])
    expect(store.getState().selectedSectionId).toBeNull()
  })
})
