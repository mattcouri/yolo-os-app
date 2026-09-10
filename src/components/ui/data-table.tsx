import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    width?: string;
    render?: (item: T) => React.ReactNode;
  }[];
  searchPlaceholder?: string;
  searchKey?: keyof T;
  onSearch?: (query: string) => void;
  pageSize?: number;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  searchKey,
  onSearch,
  pageSize = 10,
  emptyMessage = "Nenhum item encontrado.",
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);

  const filteredData = React.useMemo(() => {
    if (!search || !searchKey) return data;
    return data.filter((item) => {
      const value = item[searchKey];
      if (typeof value === "string") {
        return value.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [data, search, searchKey]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
    onSearch?.(value);
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "h-9 px-3 text-left font-medium text-muted-foreground",
                    col.width
                  )}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="h-9 px-3 text-right font-medium text-muted-foreground w-24">
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-16 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="h-11 px-3">
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="h-11 px-3 text-right">{actions(item)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredData.length} {filteredData.length === 1 ? "item" : "itens"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
