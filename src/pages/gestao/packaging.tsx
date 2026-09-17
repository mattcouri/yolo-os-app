import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthProfile } from "@/lib/auth";
import {
  BOX_TYPE_LABEL,
  BOX_TYPES,
  FACTORY_COLUMN,
  TRANSIT_COLUMN,
  UNLOCATED_COLUMN,
  boxColumnId,
  boxContents,
  columnLabel,
  daysAging,
  isBoxAsset,
  isFactoryColumn,
  lastActivityAt,
  type BoxType,
} from "@/lib/packaging-board";
import { factoryLocation } from "@/lib/operational-assets";
import { useAppStore } from "@/stores";
import type { Asset, Location, Movement, Product, Stock } from "@/types/database";

const GRADE_LABEL: Record<string, string> = {
  AAA: "AAA",
  B: "B",
  C: "C",
  blocked: "Rejeito",
  pending: "Análise",
};

const STATUS_LABEL: Record<string, string> = {
  available: "Vazia",
  cleaning: "Limpeza",
  empty_ready_return: "Pronta p/ fábrica",
  at_factory: "Na fábrica",
  in_transit: "Em trânsito",
  with_product: "Cheia",
  in_use: "Em uso",
  inspection: "Inspeção",
  damaged: "Danificada",
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function agingLabel(iso?: string | null) {
  const days = daysAging(iso);
  if (days === null) return "—";
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

interface BoxRow {
  id: string;
  asset: Asset;
  type: BoxType;
  typeLabel: string;
  code: string;
  columnId: string;
  locationName: string;
  full: boolean;
  fillLabel: string;
  sku: string;
  grades: string;
  aging: string;
  lastMove: string;
  lastMoveAt: string;
  statusLabel: string;
  search: string;
}

function buildRows(
  assets: Asset[],
  stock: Stock[],
  products: Product[],
  movements: Movement[],
  locations: Location[]
): BoxRow[] {
  return assets
    .filter(isBoxAsset)
    .filter((asset) => asset.is_active)
    .map((asset) => {
      const contents = boxContents(asset, stock, products);
      const lastMoveAt = lastActivityAt(asset, movements);
      const columnId = boxColumnId(asset, locations);
      const locationName = columnLabel(columnId, locations);
      const grades = contents.grades.map((grade) => GRADE_LABEL[grade || ""] || grade).join(", ");
      const fillLabel = contents.full
        ? `${contents.quantity.toLocaleString("pt-BR")} un · ${contents.sku || "SKU"} · ${grades || "—"}`
        : "Vazia";
      return {
        id: asset.id,
        asset,
        type: asset.type,
        typeLabel: BOX_TYPE_LABEL[asset.type],
        code: asset.code,
        columnId,
        locationName,
        full: contents.full,
        fillLabel,
        sku: contents.sku || "—",
        grades: grades || "—",
        aging: agingLabel(lastMoveAt),
        lastMove: formatWhen(lastMoveAt),
        lastMoveAt,
        statusLabel: STATUS_LABEL[asset.status] || asset.status,
        search: `${asset.code} ${locationName} ${contents.sku || ""} ${contents.name || ""} ${grades}`,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "pt-BR"));
}

function kanbanColumns(locations: Location[], rows: BoxRow[]) {
  const used = new Set(rows.map((row) => row.columnId));
  const factory = factoryLocation(locations);
  const factoryCol = factory?.id || FACTORY_COLUMN;
  const extras = [TRANSIT_COLUMN, UNLOCATED_COLUMN].filter((id) => used.has(id));
  const place = locations
    .filter((location) => location.is_active && location.id !== factory?.id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR"))
    .map((location) => location.id);
  return [factoryCol, ...place, ...extras];
}

type BoxTotalRow = {
  id: string;
  type: BoxType;
  typeLabel: string;
  locationId: string;
  locationName: string;
  quantity: number;
  full: number;
  empty: number;
  search: string;
};

function packagingPlaceOptions(locations: Location[]) {
  const factory = factoryLocation(locations);
  return [
    ...(factory ? [factory] : []),
    ...locations
      .filter((location) => location.is_active && location.id !== factory?.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "pt-BR")),
  ];
}

function buildBoxTotals(rows: BoxRow[], locations: Location[]): BoxTotalRow[] {
  return BOX_TYPES.flatMap((type) => {
    const group = rows.filter((row) => row.type === type);
    if (group.length === 0) {
      return [
        {
          id: `${type}:`,
          type,
          typeLabel: BOX_TYPE_LABEL[type],
          locationId: "",
          locationName: "Sem local",
          quantity: 0,
          full: 0,
          empty: 0,
          search: `${BOX_TYPE_LABEL[type]} ${type}`.toLowerCase(),
        },
      ];
    }
    const byLocation = new Map<string, BoxRow[]>();
    for (const row of group) {
      const key = row.columnId === UNLOCATED_COLUMN ? "" : row.columnId;
      const list = byLocation.get(key) || [];
      list.push(row);
      byLocation.set(key, list);
    }
    return [...byLocation.entries()]
      .map(([key, items]) => {
        const locationId = key === FACTORY_COLUMN ? factoryLocation(locations)?.id || FACTORY_COLUMN : key;
        const locationName = key ? columnLabel(key, locations) : "Sem local";
        const full = items.filter((item) => item.full).length;
        return {
          id: `${type}:${key}`,
          type,
          typeLabel: BOX_TYPE_LABEL[type],
          locationId,
          locationName,
          quantity: items.length,
          full,
          empty: items.length - full,
          search: `${BOX_TYPE_LABEL[type]} ${type} ${locationName}`.toLowerCase(),
        };
      })
      .sort((a, b) => a.locationName.localeCompare(b.locationName, "pt-BR"));
  });
}

function BoxQuantityCell({
  row,
  canEdit,
  draft,
  onDraft,
  saving,
  onSave,
}: {
  row: BoxTotalRow;
  canEdit: boolean;
  draft: string;
  onDraft: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  if (!canEdit) return <span>{row.quantity.toLocaleString("pt-BR")}</span>;
  const dirty = draft !== String(row.quantity);
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        type="number"
        min={0}
        step={1}
        className="h-7 w-[5.5rem] text-right text-xs"
        value={draft}
        disabled={saving}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) onSave();
        }}
      />
      <Button
        type="button"
        variant={dirty ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={!dirty || saving}
        onClick={onSave}
      >
        {saving ? "…" : "Salvar"}
      </Button>
    </div>
  );
}

function BoxTotalsTable({ rows, locations }: { rows: BoxRow[]; locations: Location[] }) {
  const { adjustBoxTypeQuantity, moveBoxTypeLocation } = useAppStore();
  const { isAdmin } = useAuthProfile();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totals = useMemo(() => buildBoxTotals(rows, locations), [rows, locations]);
  const placeOptions = useMemo(() => packagingPlaceOptions(locations), [locations]);
  const selectClass = "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

  const save = async (row: BoxTotalRow) => {
    const raw = drafts[row.id] ?? String(row.quantity);
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setError("Informe uma quantidade inteira maior ou igual a zero.");
      return;
    }
    const locationId = locationDrafts[row.id] ?? row.locationId;
    setSavingId(row.id);
    setError(null);
    try {
      await adjustBoxTypeQuantity(row.type, next, locationId || null);
      setDrafts((current) => {
        const { [row.id]: _ignored, ...rest } = current;
        return rest;
      });
      setLocationDrafts((current) => {
        const { [row.id]: _ignored, ...rest } = current;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ajustar a quantidade.");
    } finally {
      setSavingId(null);
    }
  };

  const move = async (row: BoxTotalRow, nextLocationId: string) => {
    if (row.quantity === 0) {
      setLocationDrafts((current) => ({ ...current, [row.id]: nextLocationId }));
      return;
    }
    if (nextLocationId === row.locationId) return;
    setSavingId(row.id);
    setError(null);
    try {
      await moveBoxTypeLocation(row.type, row.locationId || null, nextLocationId || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o local.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Todas as embalagens</CardTitle>
            <CardDescription>
              Quantidade por tipo e local. {isAdmin ? "Admin pode ajustar a quantidade e mudar o local do grupo. Caixas cheias levam o produto junto." : "Somente admin altera quantidade e local."}
            </CardDescription>
          </div>
          <Badge variant="secondary">{totals.reduce((sum, row) => sum + row.quantity, 0)}</Badge>
        </div>
        {error ? <p className="pt-2 text-sm text-destructive">{error}</p> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <DataTable
          data={totals}
          searchKey="search"
          searchPlaceholder="Buscar tipo ou local…"
          emptyMessage="Nenhuma embalagem cadastrada."
          maxHeight="320px"
          columns={[
            {
              key: "typeLabel",
              header: "Tipo",
              sortable: true,
              render: (row) => <span className="font-medium">{row.typeLabel}</span>,
            },
            {
              key: "locationName",
              header: "Local",
              width: "w-56",
              sortable: true,
              render: (row) => {
                const value = locationDrafts[row.id] ?? row.locationId;
                if (!isAdmin) return <span className="text-xs">{row.locationName}</span>;
                return (
                  <select
                    className={selectClass}
                    value={value}
                    disabled={savingId === row.id}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void move(row, event.target.value)}
                  >
                    <option value="">Sem local</option>
                    {value === TRANSIT_COLUMN ? <option value={TRANSIT_COLUMN}>Em trânsito</option> : null}
                    {placeOptions.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                );
              },
            },
            {
              key: "quantity",
              header: "Qtd",
              width: isAdmin ? "w-44" : "w-20",
              sortable: true,
              render: (row) => (
                <BoxQuantityCell
                  row={row}
                  canEdit={isAdmin}
                  draft={drafts[row.id] ?? String(row.quantity)}
                  onDraft={(value) => setDrafts((current) => ({ ...current, [row.id]: value }))}
                  saving={savingId === row.id}
                  onSave={() => void save(row)}
                />
              ),
            },
            {
              key: "full",
              header: "Cheias",
              width: "w-20",
              sortable: true,
              render: (row) => (row.full ? row.full.toLocaleString("pt-BR") : <span className="text-muted-foreground">—</span>),
            },
            {
              key: "empty",
              header: "Vazias",
              width: "w-20",
              sortable: true,
              render: (row) => (row.empty ? row.empty.toLocaleString("pt-BR") : <span className="text-muted-foreground">—</span>),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function PackagingPage() {
  const { assets, stock, products, movements, locations } = useAppStore();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () => buildRows(assets, stock, products, movements, locations),
    [assets, stock, products, movements, locations]
  );
  const filtered = rows.filter((row) => row.search.toLowerCase().includes(search.toLowerCase().trim()));
  const columns = kanbanColumns(locations, filtered);

  const countByType = (type: BoxType) => rows.filter((row) => row.type === type).length;
  const fullCount = rows.filter((row) => row.full).length;
  const factoryCount = rows.filter((row) => isFactoryColumn(row.columnId, locations)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Embalagens</h1>
        <p className="text-muted-foreground">Caixas reutilizáveis: onde estão, vazias ou cheias, e com o quê</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {BOX_TYPES.map((type) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardDescription>{BOX_TYPE_LABEL[type]}</CardDescription>
              <CardTitle className="text-3xl">{countByType(type)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">cadastradas</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cheias / na fábrica</CardDescription>
            <CardTitle className="text-3xl">
              {fullCount} / {factoryCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">com produto · pretas/grandes vazias na fábrica</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar código, local, SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {columns.map((columnId) => {
              const cards = filtered.filter((row) => row.columnId === columnId);
              return (
                <div key={columnId} className="w-72 shrink-0 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-sm truncate">{columnLabel(columnId, locations)}</h3>
                    <Badge variant="secondary">{cards.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {BOX_TYPES.map((type) => {
                      const group = cards.filter((row) => row.type === type);
                      if (group.length === 0) return null;
                      const key = `${columnId}:${type}`;
                      const open = expanded === key;
                      const full = group.filter((row) => row.full).length;
                      return (
                        <Card
                          key={key}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setExpanded(open ? null : key)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">{BOX_TYPE_LABEL[type]}</p>
                                <p className="text-xs text-muted-foreground">
                                  {group.length} · {full} cheia{full === 1 ? "" : "s"} · {group.length - full} vazia
                                  {group.length - full === 1 ? "" : "s"}
                                </p>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                            </div>
                            {open && (
                              <ul className="mt-3 space-y-2 border-t pt-3 text-xs">
                                {group.map((row) => (
                                  <li key={row.id} className="space-y-0.5">
                                    <div className="flex justify-between gap-2 font-mono">
                                      <span>{row.code}</span>
                                      <span className="text-muted-foreground">{row.statusLabel}</span>
                                    </div>
                                    <p className="text-muted-foreground">{row.fillLabel}</p>
                                    <p className="text-muted-foreground">
                                      Último movimento {row.lastMove} · {row.aging}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                    {cards.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma caixa</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <DataTable
            data={filtered}
            maxHeight="70vh"
            emptyMessage="Nenhuma caixa cadastrada."
            columns={[
              { key: "code", header: "Código", sortable: true, render: (row) => <span className="font-mono text-xs">{row.code}</span> },
              { key: "typeLabel", header: "Tipo", sortable: true },
              { key: "locationName", header: "Local", sortable: true },
              { key: "statusLabel", header: "Status", sortable: true },
              {
                key: "full",
                header: "Carga",
                render: (row) => (row.full ? row.fillLabel : "Vazia"),
              },
              { key: "lastMoveAt", header: "Último movimento", sortable: true, render: (row) => row.lastMove },
              { key: "aging", header: "Idade", sortable: true },
            ]}
          />
        </TabsContent>
      </Tabs>

      <BoxTotalsTable rows={rows} locations={locations} />
    </div>
  );
}
