import * as React from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { defaultWidthFromClass, useTableColumnWidths } from "@/lib/table-column-prefs";

const ROW_NUM_KEY = "__rowNum";
const DRAG_KEY = "__drag";
const SELECT_KEY = "__select";
const ACTIONS_KEY = "__actions";

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    width?: string;
    sortable?: boolean;
    align?: "left" | "center" | "right";
    cellAlign?: "left" | "center" | "right";
    render?: (item: T) => React.ReactNode;
  }[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  onSearch?: (query: string) => void;
  maxHeight?: string;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
  actionsHeader?: string;
  showRowNumbers?: boolean;
  onReorder?: (items: T[]) => void;
  draggable?: boolean;
  tableId?: string;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
}

interface SortableRowProps<T> {
  item: T;
  index: number;
  columns: DataTableProps<T>["columns"];
  actions?: DataTableProps<T>["actions"];
  showRowNumbers: boolean;
  draggable: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
}

function SortableRow<T extends { id: string }>({
  item,
  index,
  columns,
  actions,
  showRowNumbers,
  draggable,
  selected,
  onToggleSelect,
}: SortableRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b last:border-0 hover:bg-muted/30 transition-colors",
        isDragging && "bg-muted/50"
      )}
    >
      {draggable && (
        <td className="h-11 px-2 overflow-hidden">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </td>
      )}
      {showRowNumbers && (
        <td className="min-h-11 px-3 py-1.5 text-muted-foreground text-center font-mono text-xs overflow-hidden">
          {index + 1}
        </td>
      )}
      {onToggleSelect && (
        <td className="min-h-11 px-3 py-1.5 text-center overflow-hidden">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={Boolean(selected)}
            onChange={(event) => onToggleSelect(item.id, event.target.checked)}
            aria-label="Selecionar"
          />
        </td>
      )}
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            "min-h-11 px-3 py-1.5 overflow-hidden",
            (col.cellAlign ?? col.align) === "center" && "text-center",
            (col.cellAlign ?? col.align) === "right" && "text-right"
          )}
        >
          {col.render
            ? col.render(item)
            : String((item as Record<string, unknown>)[col.key] ?? "")}
        </td>
      ))}
      {actions && (
        <td className="min-h-11 px-3 py-1.5 text-center whitespace-nowrap overflow-hidden">{actions(item)}</td>
      )}
    </tr>
  );
}

function ColumnResizeHandle({
  onResize,
}: {
  onResize: (delta: number, done: boolean) => void;
}) {
  const startX = React.useRef(0);

  const onPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    startX.current = event.clientX;

    const onMove = (moveEvent: PointerEvent) => {
      onResize(moveEvent.clientX - startX.current, false);
    };
    const onUp = (upEvent: PointerEvent) => {
      onResize(upEvent.clientX - startX.current, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <button
      type="button"
      aria-label="Redimensionar coluna"
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      className="absolute right-0 top-0 z-20 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 hover:bg-primary/30 active:bg-primary/50"
    />
  );
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  searchKey,
  onSearch,
  maxHeight = "400px",
  emptyMessage = "Nenhum item encontrado.",
  actions,
  actionsHeader = "Ações",
  showRowNumbers = true,
  onReorder,
  draggable = false,
  tableId,
  selectedIds,
  onSelectedIdsChange,
}: DataTableProps<T>) {
  const location = useLocation();
  const resolvedTableId = React.useMemo(
    () =>
      tableId ||
      `${location.pathname}::${columns.map((col) => col.key).join("|")}::${actions ? "a" : "n"}`,
    [actions, columns, location.pathname, tableId]
  );

  const defaultWidths = React.useMemo(() => {
    const next: Record<string, number> = {};
    if (draggable) next[DRAG_KEY] = 32;
    if (showRowNumbers) next[ROW_NUM_KEY] = 48;
    if (onSelectedIdsChange) next[SELECT_KEY] = 40;
    for (const col of columns) {
      next[col.key] = defaultWidthFromClass(col.width, 160);
    }
    if (actions) next[ACTIONS_KEY] = defaultWidthFromClass("w-28", 112);
    return next;
  }, [actions, columns, draggable, onSelectedIdsChange, showRowNumbers]);

  const { widths, setColumnWidth } = useTableColumnWidths(resolvedTableId, defaultWidths);
  const dragStartWidth = React.useRef<Record<string, number>>({});

  const [search, setSearch] = React.useState("");
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [localData, setLocalData] = React.useState(data);

  React.useEffect(() => {
    setLocalData(data);
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localData.findIndex((item) => item.id === active.id);
      const newIndex = localData.findIndex((item) => item.id === over.id);
      const newData = arrayMove(localData, oldIndex, newIndex);
      setLocalData(newData);
      onReorder?.(newData);
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredData = React.useMemo(() => {
    let result = localData;

    if (search && searchKey) {
      result = result.filter((item) => {
        const value = item[searchKey];
        if (typeof value === "string") {
          return value.toLowerCase().includes(search.toLowerCase());
        }
        return true;
      });
    }

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aValue = (a as Record<string, unknown>)[sortConfig.key];
        const bValue = (b as Record<string, unknown>)[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [localData, search, searchKey, sortConfig]);

  const handleSearch = (value: string) => {
    setSearch(value);
    onSearch?.(value);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 ml-1" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 ml-1" />
    );
  };

  const colKeys = React.useMemo(() => {
    const keys: string[] = [];
    if (draggable) keys.push(DRAG_KEY);
    if (showRowNumbers) keys.push(ROW_NUM_KEY);
    if (onSelectedIdsChange) keys.push(SELECT_KEY);
    keys.push(...columns.map((col) => col.key));
    if (actions) keys.push(ACTIONS_KEY);
    return keys;
  }, [actions, columns, draggable, onSelectedIdsChange, showRowNumbers]);

  const selectedSet = React.useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const visibleIds = filteredData.map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));

  const toggleRow = (id: string, checked: boolean) => {
    if (!onSelectedIdsChange) return;
    const next = new Set(selectedSet);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedIdsChange([...next]);
  };

  const toggleVisible = (checked: boolean) => {
    if (!onSelectedIdsChange) return;
    const next = new Set(selectedSet);
    for (const id of visibleIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onSelectedIdsChange([...next]);
  };

  const tableWidth = colKeys.reduce((sum, key) => sum + (widths[key] ?? defaultWidths[key] ?? 120), 0);

  const handleResize = (key: string, delta: number, done: boolean) => {
    if (dragStartWidth.current[key] == null) {
      dragStartWidth.current[key] = widths[key] ?? defaultWidths[key] ?? 120;
    }
    setColumnWidth(key, dragStartWidth.current[key] + delta, done);
    if (done) {
      delete dragStartWidth.current[key];
    }
  };

  const colgroup = (
    <colgroup>
      {colKeys.map((key) => (
        <col key={key} style={{ width: widths[key] ?? defaultWidths[key] }} />
      ))}
    </colgroup>
  );

  const headerRow = (
    <tr className="border-b">
      {draggable && (
        <th className="relative h-9 px-2">
          <ColumnResizeHandle onResize={(delta, done) => handleResize(DRAG_KEY, delta, done)} />
        </th>
      )}
      {showRowNumbers && (
        <th className="relative h-9 px-3 text-center font-medium text-muted-foreground">
          #
          <ColumnResizeHandle onResize={(delta, done) => handleResize(ROW_NUM_KEY, delta, done)} />
        </th>
      )}
      {onSelectedIdsChange && (
        <th className="relative h-9 px-3 text-center">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={allVisibleSelected}
            ref={(node) => {
              if (node) node.indeterminate = someVisibleSelected && !allVisibleSelected;
            }}
            onChange={(event) => toggleVisible(event.target.checked)}
            aria-label="Selecionar todas"
          />
          <ColumnResizeHandle onResize={(delta, done) => handleResize(SELECT_KEY, delta, done)} />
        </th>
      )}
      {columns.map((col) => (
        <th
          key={col.key}
          className={cn(
            "relative h-9 px-3 font-medium text-muted-foreground whitespace-nowrap",
            col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
            col.sortable !== false && "cursor-pointer hover:text-foreground select-none"
          )}
          onClick={() => col.sortable !== false && handleSort(col.key)}
        >
          <div
            className={cn(
              "flex items-center pr-1",
              col.align === "center" && "justify-center",
              col.align === "right" && "justify-end"
            )}
          >
            {col.header}
            {col.sortable !== false && getSortIcon(col.key)}
          </div>
          <ColumnResizeHandle onResize={(delta, done) => handleResize(col.key, delta, done)} />
        </th>
      ))}
      {actions && (
        <th className="relative h-9 px-3 text-center font-medium text-muted-foreground whitespace-nowrap">
          {actionsHeader}
          <ColumnResizeHandle onResize={(delta, done) => handleResize(ACTIONS_KEY, delta, done)} />
        </th>
      )}
    </tr>
  );

  const bodyRows =
    filteredData.length === 0 ? (
      <tr>
        <td
          colSpan={colKeys.length}
          className="h-16 text-center text-muted-foreground"
        >
          {emptyMessage}
        </td>
      </tr>
    ) : draggable ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredData.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {filteredData.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              index={index}
              columns={columns}
              actions={actions}
              showRowNumbers={showRowNumbers}
              draggable={draggable}
              selected={selectedSet.has(item.id)}
              onToggleSelect={onSelectedIdsChange ? toggleRow : undefined}
            />
          ))}
        </SortableContext>
      </DndContext>
    ) : (
      filteredData.map((item, index) => (
        <tr
          key={item.id}
          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
        >
          {showRowNumbers && (
            <td className="min-h-11 px-3 py-1.5 text-muted-foreground text-center font-mono text-xs overflow-hidden">
              {index + 1}
            </td>
          )}
          {onSelectedIdsChange && (
            <td className="min-h-11 px-3 py-1.5 text-center overflow-hidden">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={selectedSet.has(item.id)}
                onChange={(event) => toggleRow(item.id, event.target.checked)}
                aria-label={`Selecionar ${item.id}`}
              />
            </td>
          )}
          {columns.map((col) => (
            <td
              key={col.key}
              className={cn(
                "min-h-11 px-3 py-1.5 overflow-hidden",
                (col.cellAlign ?? col.align) === "center" && "text-center",
                (col.cellAlign ?? col.align) === "right" && "text-right"
              )}
            >
              {col.render
                ? col.render(item)
                : String((item as Record<string, unknown>)[col.key] ?? "")}
            </td>
          ))}
          {actions && (
            <td className="min-h-11 px-3 py-1.5 text-center whitespace-nowrap overflow-hidden">{actions(item)}</td>
          )}
        </tr>
      ))
    );

  return (
    <div className="space-y-3">
      {(searchKey || onSearch) && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <div className="overflow-auto" style={{ maxHeight }}>
          <table
            className="text-sm"
            style={{ tableLayout: "fixed", width: tableWidth, minWidth: "100%" }}
          >
            {colgroup}
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">{headerRow}</thead>
            <tbody>{bodyRows}</tbody>
          </table>
        </div>
      </div>

      {filteredData.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {filteredData.length} {filteredData.length === 1 ? "item" : "itens"}
        </div>
      )}
    </div>
  );
}
