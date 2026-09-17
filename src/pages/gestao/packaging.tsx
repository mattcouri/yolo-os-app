import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { orderedAssetYardLocations } from "@/lib/locations";
import {
  BOX_TYPE_LABEL,
  TRANSIT_COLUMN,
  boxColumnId,
  boxContents,
  canSendToFactory,
  columnLabel,
  isBoxAsset,
  lastActivityAt,
  type BoxType,
} from "@/lib/packaging-board";
import {
  factoryLocation,
  planAssetPlacement,
  resolvedAssetLocationId,
} from "@/lib/operational-assets";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { Asset, AssetStatus, Location, Movement, Product, Stock } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

type FilterId = "all" | "empty" | "dirty" | "full" | "factory" | "transit" | "exception";

const BOX_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: "available", label: "Vazia" },
  { value: "cleaning", label: "Limpeza" },
  { value: "empty_ready_return", label: "Pronta p/ fábrica" },
  { value: "at_factory", label: "Na fábrica" },
  { value: "in_transit", label: "Em trânsito" },
  { value: "with_product", label: "Cheia" },
  { value: "in_use", label: "Em uso" },
  { value: "inspection", label: "Inspeção" },
  { value: "damaged", label: "Danificada" },
];

const GRADE_LABEL: Record<string, string> = {
  AAA: "AAA",
  B: "B",
  C: "C",
  blocked: "Rejeito",
  pending: "Análise",
};

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function boxStatusLabel(status: AssetStatus) {
  return BOX_STATUSES.find((item) => item.value === status)?.label || status;
}

function statusChipClass(status: AssetStatus) {
  if (status === "available" || status === "empty_ready_return") {
    return "border-emerald-400/45 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
  }
  if (status === "cleaning") {
    return "border-amber-400/50 bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  if (status === "with_product" || status === "at_factory") {
    return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
  }
  if (status === "in_transit" || status === "in_use") {
    return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
  }
  if (status === "inspection") {
    return "border-violet-400/45 bg-violet-500/15 text-violet-900 dark:text-violet-200";
  }
  if (status === "damaged") {
    return "border-rose-400/45 bg-rose-500/15 text-rose-900 dark:text-rose-200";
  }
  return "border-border bg-muted text-muted-foreground";
}

function matchesFilter(row: BoxRow, filter: FilterId) {
  if (filter === "all") return true;
  if (filter === "empty") return row.status === "available" || row.status === "empty_ready_return";
  if (filter === "dirty") return row.status === "cleaning";
  if (filter === "full") return row.full;
  if (filter === "factory") return row.status === "at_factory";
  if (filter === "transit") return row.status === "in_transit";
  return row.status === "damaged" || row.status === "inspection";
}

type BoxRow = Asset & {
  type: BoxType;
  typeLabel: string;
  columnId: string;
  locationName: string;
  statusLabel: string;
  full: boolean;
  fillLabel: string;
  lastMoveAt: string;
  search: string;
};

function boardColumns(yardLocations: Location[], rows: BoxRow[]) {
  const yardIds = yardLocations.map((location) => location.id);
  const extra = [...new Set(rows.map((row) => row.columnId))].filter(
    (id) => id && id !== TRANSIT_COLUMN && !yardIds.includes(id)
  );
  return [...yardIds, ...extra, TRANSIT_COLUMN];
}

function BoxCard({ row }: { row: BoxRow }) {
  const photo = row.photo_url;
  return (
    <Link
      to={`/gestao/ativos/${row.id}`}
      className="block overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/70" />
          </div>
        )}
        <span
          className={cn(
            "absolute right-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            statusChipClass(row.status)
          )}
        >
          {row.statusLabel}
        </span>
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium leading-tight">{row.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{row.code}</p>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Badge variant="outline" className="h-5 max-w-[70%] truncate text-[10px] font-normal">
            {row.typeLabel}
          </Badge>
          <span className="truncate text-[10px] font-medium text-muted-foreground">
            {row.full ? row.fillLabel : "Vazia"}
          </span>
        </div>
      </div>
    </Link>
  );
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
      const locationName =
        columnId === TRANSIT_COLUMN
          ? "Em trânsito"
          : columnLabel(columnId, locations);
      const grades = contents.grades.map((grade) => GRADE_LABEL[grade || ""] || grade).join(", ");
      const fillLabel = contents.full
        ? `${contents.quantity.toLocaleString("pt-BR")} un · ${contents.sku || "SKU"}${grades ? ` · ${grades}` : ""}`
        : "Vazia";
      const statusText = boxStatusLabel(asset.status);
      return {
        ...asset,
        type: asset.type,
        typeLabel: BOX_TYPE_LABEL[asset.type],
        columnId,
        locationName,
        statusLabel: statusText,
        full: contents.full,
        fillLabel,
        lastMoveAt,
        search: [asset.code, asset.name, BOX_TYPE_LABEL[asset.type], locationName, statusText, fillLabel]
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "pt-BR"));
}

export function PackagingPage() {
  const { assets, stock, products, movements, locations, updateAsset, updateStock, createMovement } =
    useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yardLocations = useMemo(() => orderedAssetYardLocations(locations), [locations]);
  const patio = useMemo(
    () => buildRows(assets, stock, products, movements, locations),
    [assets, stock, products, movements, locations]
  );
  const columns = useMemo(() => boardColumns(yardLocations, patio), [yardLocations, patio]);
  const rows = useMemo(() => patio.filter((row) => matchesFilter(row, filter)), [patio, filter]);

  const counts = useMemo(
    () => ({
      all: patio.length,
      empty: patio.filter((row) => row.status === "available" || row.status === "empty_ready_return").length,
      dirty: patio.filter((row) => row.status === "cleaning").length,
      full: patio.filter((row) => row.full).length,
      factory: patio.filter((row) => row.status === "at_factory").length,
      transit: patio.filter((row) => row.status === "in_transit").length,
      exception: patio.filter((row) => row.status === "damaged" || row.status === "inspection").length,
    }),
    [patio]
  );

  const placeOptions = useMemo(() => {
    const seen = new Set(yardLocations.map((location) => location.id));
    const extras = locations.filter((location) => location.is_active && !seen.has(location.id) && patio.some((row) => row.columnId === location.id));
    return [...yardLocations, ...extras];
  }, [yardLocations, locations, patio]);

  const place = async (row: BoxRow, change: { status?: AssetStatus; locationId?: string | null }) => {
    const hasProduct = stock.some(
      (item) => item.asset_id === row.id && item.quantity > 0 && item.status !== "depleted"
    );
    const factory = factoryLocation(locations);
    const planned = planAssetPlacement(row, change, locations, false);
    if (planned.error) {
      setError(planned.error);
      return;
    }

    let status = planned.status;
    const locationId = planned.location_id;
    if (factory && locationId === factory.id && row.location_id !== factory.id) {
      if (hasProduct || !canSendToFactory(row, stock)) {
        setError(`${row.code} não pode ir à fábrica. Só caixa preta ou grande, vazia, após limpeza.`);
        return;
      }
    }
    if (hasProduct && (status === "cleaning" || status === "at_factory")) {
      setError(`${row.code} está cheia e não pode ir para ${status === "cleaning" ? "área suja" : "fábrica"}.`);
      return;
    }
    if (hasProduct && (status === "available" || status === "empty_ready_return")) {
      status = "with_product";
    }
    if (status === row.status && locationId === row.location_id) return;

    setBusyId(row.id);
    setError(null);
    const now = new Date().toISOString();
    try {
      await updateAsset(row.id, {
        status,
        location_id: locationId,
        last_moved_at: now,
      });
      if (locationId && locationId !== row.location_id) {
        const live = stock.filter(
          (item) => item.asset_id === row.id && item.quantity > 0 && item.status !== "depleted"
        );
        for (const item of live) {
          await updateStock(item.id, { location_id: locationId });
        }
        await createMovement({
          type: "transfer",
          asset_id: row.id,
          from_location_id: row.location_id ?? undefined,
          to_location_id: locationId,
          reason: `${row.code} · ${boxStatusLabel(status)}`,
          notes: locations.find((location) => location.id === locationId)?.name || "pátio",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a caixa.");
    } finally {
      setBusyId(null);
    }
  };

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "empty", label: "Vazia" },
    { id: "dirty", label: "Aguardando limpeza" },
    { id: "full", label: "Cheia" },
    { id: "factory", label: "Fábrica" },
    { id: "transit", label: "Em trânsito" },
    { id: "exception", label: "Exceção" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Embalagens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está em cada local do pátio. Área suja = para limpar. Área limpa = vazia e pronta. Fábrica = pretas e
          grandes vazias no retorno. Status e local são campos separados.
        </p>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {columns.map((columnId) => {
          const cards = patio.filter((row) => row.columnId === columnId);
          return (
            <section
              key={columnId}
              className="flex w-[16.5rem] shrink-0 flex-col rounded-xl border bg-muted/30"
            >
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <h2 className="truncate text-sm font-semibold">
                  {columnId === TRANSIT_COLUMN ? "Em trânsito" : columnLabel(columnId, locations)}
                </h2>
                <Badge variant="secondary">{cards.length}</Badge>
              </header>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <p className="px-1 py-8 text-center text-xs text-muted-foreground">Vazio</p>
                ) : (
                  cards.map((row) => <BoxCard key={row.id} row={row} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Lista</CardTitle>
              <CardDescription>
                Status e local são campos separados. Mover para Área suja marca limpeza; Área limpa marca vazia; Fábrica
                só recebe preta ou grande vazia.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={filter === item.id ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                    {counts[item.id]}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            data={rows}
            searchKey="search"
            searchPlaceholder="Buscar código, tipo, local…"
            emptyMessage="Nenhuma caixa neste filtro."
            maxHeight="calc(100vh - 360px)"
            columns={[
              {
                key: "code",
                header: "ID",
                width: "w-28",
                sortable: true,
                render: (row) => (
                  <div className="min-w-0">
                    <code className="text-xs font-semibold">{row.code}</code>
                    <p className="truncate text-xs font-medium leading-tight">{row.name}</p>
                  </div>
                ),
              },
              {
                key: "typeLabel",
                header: "Tipo",
                width: "w-28",
                sortable: true,
                render: (row) => (
                  <Badge variant="outline" className="text-xs font-normal">
                    {row.typeLabel}
                  </Badge>
                ),
              },
              {
                key: "status",
                header: "Status",
                width: "w-48",
                sortable: true,
                render: (row) => (
                  <select
                    className={selectClass}
                    value={row.status}
                    disabled={busyId === row.id}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void place(row, { status: event.target.value as AssetStatus })}
                  >
                    {BOX_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "locationName",
                header: "Local",
                width: "w-52",
                sortable: true,
                render: (row) => {
                  const value =
                    row.location_id ||
                    (row.status === "in_transit"
                      ? TRANSIT_COLUMN
                      : resolvedAssetLocationId(row, locations) || "");
                  return (
                    <select
                      className={selectClass}
                      value={value}
                      disabled={busyId === row.id}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (!next || next === TRANSIT_COLUMN) return;
                        void place(row, { locationId: next });
                      }}
                    >
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
                key: "fillLabel",
                header: "Carga",
                render: (row) => (
                  <span className="text-xs text-muted-foreground">{row.full ? row.fillLabel : "—"}</span>
                ),
              },
              {
                key: "lastMoveAt",
                header: "Último movimento",
                width: "w-36",
                sortable: true,
                render: (row) => (
                  <span className="text-xs text-muted-foreground">{formatWhen(row.lastMoveAt)}</span>
                ),
              },
            ]}
            actions={(row) => (
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Ficha">
                <Link to={`/gestao/ativos/${row.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
