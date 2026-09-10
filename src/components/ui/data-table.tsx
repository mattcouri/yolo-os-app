import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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
  maxHeight?: string;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
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
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");

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

  const handleSearch = (value: string) => {
    setSearch(value);
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
        <div className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="border-b">
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
                  <th className="h-9 px-3 text-right font-medium text-muted-foreground w-28">
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
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="h-16 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("h-11 px-3", col.width)}>
                        {col.render
                          ? col.render(item)
                          : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                    {actions && (
                      <td className="h-11 px-3 text-right w-28">{actions(item)}</td>
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
