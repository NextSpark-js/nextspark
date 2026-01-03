'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ListData } from './KanbanColumn'

// Export drag handle props type for KanbanColumn
export type DragHandleProps = ReturnType<typeof useSortable>['listeners']

interface SortableListProps {
  list: ListData
  children: (props: { dragHandleProps: DragHandleProps }) => React.ReactNode
  disabled?: boolean
}

export function SortableList({ list, children, disabled = false }: SortableListProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: {
      type: 'list',
      list,
    },
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={isDragging ? 'ring-2 ring-primary/50 rounded-lg' : ''}>
        {children({ dragHandleProps: listeners })}
      </div>
    </div>
  )
}
