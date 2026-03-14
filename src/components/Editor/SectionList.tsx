'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { KeyboardSensor } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useCVStore } from '@/store/cv-store'
import { CVSection, SectionType } from '@/types/cv'

const SECTION_ICONS: Record<SectionType, string> = {
  experience: '[exp]',
  education:  '[edu]',
  skills:     '[ski]',
  projects:   '[prj]',
  photo:      '[img]',
  personal:   '[per]',
  custom:     '[---]',
}

const ADD_OPTIONS: { label: string; type: SectionType }[] = [
  { label: 'Experience', type: 'experience' },
  { label: 'Education', type: 'education' },
  { label: 'Skills', type: 'skills' },
  { label: 'Projects', type: 'projects' },
  { label: 'Photo', type: 'photo' },
  { label: 'Personal', type: 'personal' },
  { label: 'Custom', type: 'custom' },
]

function SortableItem({ section, onSelect }: { section: CVSection; onSelect?: () => void }) {
  const { selectedSectionId, selectSection, deleteSection } = useCVStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isSelected = section.id === selectedSectionId

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      }`}
      onClick={() => { selectSection(section.id); onSelect?.() }}
    >
      {/* drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        ⠿
      </span>

      <span className="text-sm flex-shrink-0">
        {SECTION_ICONS[section.type] ?? '📄'}
      </span>

      <span className="text-sm truncate flex-1 font-mono">{section.title}</span>

      <button
        onClick={(e) => {
          e.stopPropagation()
          deleteSection(section.id)
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0 text-xs px-1"
        title="Delete section"
      >
        ✕
      </button>
    </div>
  )
}

export function SectionList({ onSectionSelect }: { onSectionSelect?: () => void } = {}) {
  const { cv, addSection, reorderSections } = useCVStore()
  const { sections } = cv

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id)
      const newIndex = sections.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(sections, oldIndex, newIndex)
      reorderSections(reordered.map((s) => s.id))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableItem key={section.id} section={section} onSelect={onSectionSelect} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Add section */}
      <div className="p-2 border-t border-gray-800">
        <p className="text-xs font-mono text-gray-600 mb-1.5 px-1">Add section</p>
        <div className="grid grid-cols-2 gap-1">
          {ADD_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => addSection(opt.type)}
              className="text-xs font-mono text-gray-500 hover:text-gray-200 hover:bg-gray-800 px-2 py-1 rounded text-left transition-colors border border-transparent hover:border-gray-700"
            >
              {SECTION_ICONS[opt.type]} {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
