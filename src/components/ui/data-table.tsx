import * as React from "react";
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

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    width?: string;
    sortable?: boolean;
    render?: (item: T) => React.ReactNode;
  }[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  onSearch?: (query: string) => void;
  maxHeight?: string;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
  showRowNumbers?: boolean;
  onReorder?: (items: T[]) => void;
  draggable?: boolean;
}

interface SortableRowProps<T> {
  item: T;
  index: number;
  columns: DataTableProps<T>["columns"];
  actions?: DataTableProps<T>["actions"];
  showRowNumbers: boolean;
  draggable: boolean;
}

function SortableRow<T extends { id: string }>({
  item,
  index,
  columns,
  actions,
  showRowNumbers,
  draggable,
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
        <td className="h-11 px-2 w-8">
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
        <td className="h-11 px-3 w-12 text-muted-foreground text-center font-mono text-xs">
          {index + 1}
        </td>
      )}
      {columns.map((col) => (
        <td key={col.key} className={cn("h-11 px-3", col.width)}>
          {col.render
            ? col.render(item)
            : String((item as Record<string, unknown>)[col.key] ?? "")}
        </td>
      ))}
      {actions && (
        <td className="h-11 px-3 text-right whitespace-nowrap">{actions(item)}</td>
      )}
    </tr>
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
  showRowNumbers = true,
  onReorder,
  draggable = false,
}: DataTableProps<T>) {
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
        <div className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="border-b">
                {draggable && (
                  <th className="h-9 px-2 w-8"></th>
                )}
                {showRowNumbers && (
                  <th className="h-9 px-3 text-center font-medium text-muted-foreground w-12">
                    #
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "h-9 px-3 text-left font-medium text-muted-foreground",
                      col.width,
                      col.sortable !== false && "cursor-pointer hover:text-foreground select-none"
                    )}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <div className="flex items-center">
                      {col.header}
                      {col.sortable !== false && getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                {actions && (
                  <th className="h-9 px-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
          </table>
        </div>
        <div 
          className="overflow-y-auto" 
          style={{ maxHeight }}
        >
          <table className="w-full text-sm">
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0) + (showRowNumbers ? 1 : 0) + (draggable ? 1 : 0)}
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
                      <td className="h-11 px-3 w-12 text-muted-foreground text-center font-mono text-xs">
                        {index + 1}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn("h-11 px-3", col.width)}>
                        {col.render
                          ? col.render(item)
                          : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                    {actions && (
                      <td className="h-11 px-3 text-right whitespace-nowrap">{actions(item)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
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
