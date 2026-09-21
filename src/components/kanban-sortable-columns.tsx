import { type HTMLAttributes, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type DragHandle = {
  attributes: HTMLAttributes<HTMLElement>;
  listeners?: HTMLAttributes<HTMLElement>;
};

function SortableColumn({
  id,
  children,
}: {
  id: string;
  children: (handle: DragHandle) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("shrink-0", isDragging && "z-20 opacity-80")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

export function KanbanColumnHandle({ attributes, listeners }: DragHandle) {
  return (
    <button
      type="button"
      className="touch-none rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label="Reordenar coluna"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

export function SortableKanbanColumns({
  columnIds,
  onReorder,
  className,
  children,
}: {
  columnIds: string[];
  onReorder: (ids: string[]) => void;
  className?: string;
  children: (columnId: string, handle: DragHandle) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columnIds.indexOf(String(active.id));
    const newIndex = columnIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(columnIds, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        <div className={cn("-mx-1 flex gap-3 overflow-x-auto px-1 pb-1", className)}>
          {columnIds.map((columnId) => (
            <SortableColumn key={columnId} id={columnId}>
              {(handle) => children(columnId, handle)}
            </SortableColumn>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
