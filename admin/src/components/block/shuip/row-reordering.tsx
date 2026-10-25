import { createContext, useContext, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Row } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface RowReordering<TData> {
  disabled?: boolean;
  getRowLabel: (row: TData) => string;
  onReorder: (orderedIds: string[]) => void;
}

export function RowReorderingBoundary<TData>({
  rows,
  config,
  disabled,
  children,
}: {
  rows: Row<TData>[];
  config: RowReordering<TData>;
  disabled: boolean;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const label = (id: string | number) => {
    const row = rows.find((row) => row.id === String(id));
    return row ? config.getRowLabel(row.original) : String(id);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) =>
        args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)
      }
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `بدأ نقل ${label(active.id)}.`,
          onDragOver: ({ over }) =>
            over
              ? `الموضع ${rows.findIndex((row) => row.id === String(over.id)) + 1}.`
              : "خارج الجدول؛ لن يتغير الترتيب.",
          onDragEnd: ({ over }) =>
            over ? "اكتملت معاينة النقل." : "أُلغي النقل خارج الجدول.",
          onDragCancel: () => "أُلغي نقل الصف.",
        },
        screenReaderInstructions: {
          draggable:
            "اضغط المسافة لبدء النقل، والأسهم لتغيير الموضع، والمسافة للتأكيد أو Escape للإلغاء.",
        },
      }}
      onDragEnd={({ active, over }) => {
        if (disabled || !over || active.id === over.id) return;
        const ids = rows.map((row) => row.id);
        const from = ids.indexOf(String(active.id)),
          to = ids.indexOf(String(over.id));
        if (from < 0 || to < 0 || new Set(ids).size !== ids.length) return;
        ids.splice(to, 0, ...ids.splice(from, 1));
        config.onReorder(ids);
      }}
    >
      <SortableContext
        items={rows.map((row) => row.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}
const HandleContext = createContext<ReturnType<typeof useSortable> | null>(
  null,
);
export function SortableDataRow({
  id,
  disabled,
  children,
  onClick,
  selected,
  clickable,
}: {
  id: string;
  disabled: boolean;
  children: ReactNode;
  onClick?: () => void;
  selected: boolean;
  clickable: boolean;
}) {
  const sortable = useSortable({ id, disabled });
  return (
    <HandleContext.Provider value={sortable}>
      <TableRow
        ref={sortable.setNodeRef}
        data-state={selected ? "selected" : undefined}
        onClick={onClick}
        className={cn(
          clickable && "cursor-pointer",
          sortable.isDragging && "relative z-10 bg-muted shadow-lg",
        )}
        style={{
          transform: CSS.Transform.toString(
            sortable.transform ? { ...sortable.transform, x: 0 } : null,
          ),
          transition: sortable.transition,
        }}
      >
        {children}
      </TableRow>
    </HandleContext.Provider>
  );
}
export function DataTableDragHandle({
  label,
  disabled,
}: {
  label: string;
  disabled: boolean;
}) {
  const sortable = useContext(HandleContext);
  if (!sortable) return null;
  return (
    <Button
      ref={sortable.setActivatorNodeRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      className="touch-none cursor-grab active:cursor-grabbing"
      disabled={disabled}
      aria-label={`نقل ${label}`}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical />
    </Button>
  );
}
