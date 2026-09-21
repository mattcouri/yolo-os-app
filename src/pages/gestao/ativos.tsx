import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KanbanColumnHandle, SortableKanbanColumns } from "@/components/kanban-sortable-columns";
import { DataTable } from "@/components/ui/data-table";
import { applySavedColumnOrder, KANBAN_BOARDS } from "@/lib/kanban-order";
import { locationStoresKind, orderedEquipmentYardLocations } from "@/lib/locations";
import {
  categoryLabel,
  isOperationalAsset,
  OPERATIONAL_STATUSES,
  planAssetPlacement,
  resolvedAssetLocationId,
  statusLabel,
} from "@/lib/operational-assets";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { Asset, AssetStatus, Location } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

const STREET_COLUMN = "__street__";

type FilterId = "all" | "ready" | "dirty" | "out" | "pending" | "exception";

const OUT_STATUSES = new Set<AssetStatus>(["reserved", "in_use", "in_transit"]);
const PENDING_STATUSES = new Set<AssetStatus>(["returned_pending", "inspection"]);
const EXCEPTION_STATUSES = new Set<AssetStatus>(["damaged", "incomplete", "lost", "written_off"]);

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function matchesFilter(status: AssetStatus, filter: FilterId) {
  if (filter === "all") return true;
  if (filter === "ready") return status === "available";
  if (filter === "dirty") return status === "cleaning";
  if (filter === "out") return OUT_STATUSES.has(status);
  if (filter === "pending") return PENDING_STATUSES.has(status);
  return EXCEPTION_STATUSES.has(status);
}

function statusChipClass(status: AssetStatus) {
  if (status === "available" || status === "empty_ready_return") {
    return "border-emerald-400/45 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
  }
  if (status === "cleaning" || status === "maintenance") {
    return "border-amber-400/50 bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  if (status === "with_product" || status === "at_factory") {
    return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
  }
  if (OUT_STATUSES.has(status)) {
    return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
  }
  if (PENDING_STATUSES.has(status)) {
    return "border-violet-400/45 bg-violet-500/15 text-violet-900 dark:text-violet-200";
  }
  if (EXCEPTION_STATUSES.has(status)) {
    return "border-rose-400/45 bg-rose-500/15 text-rose-900 dark:text-rose-200";
  }
  return "border-border bg-muted text-muted-foreground";
}

function displayStatus(asset: Pick<Asset, "status">) {
  return statusLabel(asset.status);
}

type PatioRow = Asset & {
  locationName: string;
  categoryLabel: string;
  statusLabel: string;
  search: string;
  orderLabel: string;
  kind: "equipamento";
  editable: boolean;
};

function boardColumnId(row: Pick<PatioRow, "location_id" | "status">, locations: Location[]) {
  if (OUT_STATUSES.has(row.status)) return STREET_COLUMN;
  return resolvedAssetLocationId(row, locations) || row.location_id || "";
}

function boardColumns(yardLocations: Location[], _rows: PatioRow[]) {
  return [...yardLocations.map((location) => location.id), STREET_COLUMN];
}

function columnTitle(columnId: string, yardLocations: Location[]) {
  if (columnId === STREET_COLUMN) return "Na rua";
  return yardLocations.find((location) => location.id === columnId)?.name || "Local";
}

function patioCategory(asset: Pick<Asset, "type" | "category">) {
  return categoryLabel(asset.category || asset.type);
}

function PatioCard({ row }: { row: PatioRow }) {
  const photo = row.photo_url;
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Wrench className="h-8 w-8 text-muted-foreground/70" />
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
            {row.categoryLabel}
          </Badge>
          {row.orderLabel ? (
            <span className="truncate text-[10px] font-medium text-muted-foreground">{row.orderLabel}</span>
          ) : null}
        </div>
      </div>
    </>
  );

  const className =
    "block overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md";

  if (row.editable) {
    return (
      <Link to={`/gestao/ativos/${row.id}`} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function AtivosPage() {
  const {
    assets,
    locations,
    orders,
    equipmentReservations,
    updateAsset,
    createMovement,
    kanbanColumnOrders,
    saveKanbanColumnOrder,
  } = useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yardLocations = useMemo(() => orderedEquipmentYardLocations(locations), [locations]);

  const operational = useMemo(
    () => assets.filter((asset) => asset.is_active !== false && isOperationalAsset(asset)),
    [assets]
  );

  const reservationByAsset = useMemo(() => {
    const map = new Map<string, { orderId: string | null; holder: string }>();
    for (const row of equipmentReservations) {
      if (row.status !== "active") continue;
      map.set(row.asset_id, { orderId: row.order_id, holder: row.holder_name });
    }
    return map;
  }, [equipmentReservations]);

  const patio = useMemo<PatioRow[]>(() => {
    return operational.map((asset) => {
      const resolvedId = resolvedAssetLocationId(asset, locations);
      const locationName = OUT_STATUSES.has(asset.status)
        ? "Na rua"
        : locations.find((location) => location.id === resolvedId)?.name || "—";
      const category = patioCategory(asset);
      const reservation = reservationByAsset.get(asset.id);
      const order = reservation?.orderId
        ? orders.find((item) => item.id === reservation.orderId)
        : undefined;
      const orderLabel = order ? order.order_number : reservation ? reservation.holder : "";
      return {
        ...asset,
        locationName,
        categoryLabel: category,
        statusLabel: displayStatus(asset),
        orderLabel,
        kind: "equipamento" as const,
        editable: true,
        search: [asset.code, asset.name, category, locationName, displayStatus(asset), orderLabel]
          .join(" ")
          .toLowerCase(),
      };
    });
  }, [operational, locations, reservationByAsset, orders]);

  const listPatio = patio;

  const counts = useMemo(
    () => ({
      all: listPatio.length,
      ready: listPatio.filter((row) => row.status === "available").length,
      dirty: listPatio.filter((row) => row.status === "cleaning").length,
      out: listPatio.filter((row) => OUT_STATUSES.has(row.status)).length,
      pending: listPatio.filter((row) => PENDING_STATUSES.has(row.status)).length,
      exception: listPatio.filter((row) => EXCEPTION_STATUSES.has(row.status)).length,
    }),
    [listPatio]
  );

  const columns = useMemo(
    () =>
      applySavedColumnOrder(
        boardColumns(yardLocations, patio),
        kanbanColumnOrders[KANBAN_BOARDS.ativos]
      ),
    [yardLocations, patio, kanbanColumnOrders]
  );

  const rows = useMemo(
    () => listPatio.filter((row) => matchesFilter(row.status, filter)),
    [listPatio, filter]
  );

  const place = async (asset: PatioRow, change: { status?: AssetStatus; locationId?: string | null }) => {
    if (!asset.editable) return;
    const reservation = reservationByAsset.get(asset.id);
    const planned = planAssetPlacement(asset, change, locations, Boolean(reservation));
    if (planned.error) {
      setError(planned.error);
      return;
    }
    const dest = planned.location_id
      ? locations.find((location) => location.id === planned.location_id)
      : undefined;
    if (dest && !locationStoresKind(dest, "ativo")) {
      setError("Este local não guarda ativos.");
      return;
    }
    if (planned.status === asset.status && planned.location_id === asset.location_id) return;

    setBusyId(asset.id);
    setError(null);
    const now = new Date().toISOString();
    try {
      await updateAsset(asset.id, {
        status: planned.status,
        location_id: planned.location_id,
        last_moved_at: now,
      });
      if (planned.location_id !== asset.location_id) {
        const toName =
          locations.find((location) => location.id === planned.location_id)?.name ||
          "pátio";
        await createMovement({
          type: "transfer",
          asset_id: asset.id,
          from_location_id: asset.location_id ?? undefined,
          to_location_id: planned.location_id ?? undefined,
          reason: `${asset.code} · ${statusLabel(planned.status)}`,
          notes: toName,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o ativo.");
    } finally {
      setBusyId(null);
    }
  };

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: counts.all },
    { id: "ready", label: "Disponível", count: counts.ready },
    { id: "dirty", label: "Aguardando limpeza", count: counts.dirty },
    { id: "out", label: "Na rua", count: counts.out },
    { id: "pending", label: "Conferência", count: counts.pending },
    { id: "exception", label: "Exceção", count: counts.exception },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ativos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está em cada local do pátio. Área suja = para limpar. Área limpa = pronto para usar de novo. Uniformes
          na rua entram automaticamente a partir do kit; o cadastro consolidado fica em Uniformes.
        </p>
      </div>

      <SortableKanbanColumns
        columnIds={columns}
        onReorder={(ids) => {
          void saveKanbanColumnOrder(KANBAN_BOARDS.ativos, ids);
        }}
      >
        {(columnId, handle) => {
          const cards = patio.filter((row) => boardColumnId(row, locations) === columnId);
          return (
            <section className="flex w-[16.5rem] flex-col rounded-xl border bg-muted/30">
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-1">
                  <KanbanColumnHandle attributes={handle.attributes} listeners={handle.listeners} />
                  <h2 className="truncate text-sm font-semibold">{columnTitle(columnId, yardLocations)}</h2>
                </div>
                <Badge variant="secondary">{cards.length}</Badge>
              </header>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <p className="px-1 py-8 text-center text-xs text-muted-foreground">Vazio</p>
                ) : (
                  cards.map((row) => <PatioCard key={row.id} row={row} />)
                )}
              </div>
            </section>
          );
        }}
      </SortableKanbanColumns>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Lista</CardTitle>
              <CardDescription>
                Status e local são campos separados. Mover para Área suja marca limpeza; Área limpa marca disponível.
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
                    {item.count}
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
            searchPlaceholder="Buscar código, nome, local…"
            emptyMessage="Nenhum ativo neste filtro. Uniformes na rua e equipamentos aparecem juntos aqui."
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
                key: "categoryLabel",
                header: "Tipo",
                width: "w-28",
                sortable: true,
                render: (row) => (
                  <Badge variant="outline" className="text-xs font-normal">
                    {row.categoryLabel}
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
                    disabled={busyId === row.id || !row.editable}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      void place(row, { status: event.target.value as AssetStatus })
                    }
                  >
                    {OPERATIONAL_STATUSES.map((status) => (
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
                    (OUT_STATUSES.has(row.status) ? STREET_COLUMN : resolvedAssetLocationId(row, locations) || "");
                  return (
                  <select
                    className={selectClass}
                    value={value}
                    disabled={busyId === row.id || !row.editable}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (!next || next === STREET_COLUMN) return;
                      void place(row, { locationId: next });
                    }}
                  >
                    {value === STREET_COLUMN ? <option value={STREET_COLUMN}>Na rua</option> : null}
                    {yardLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  );
                },
              },
              {
                key: "orderLabel",
                header: "Pedido",
                width: "w-28",
                render: (row) =>
                  row.orderLabel ? (
                    <span className="text-xs font-medium">{row.orderLabel}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
              {
                key: "last_moved_at",
                header: "Último movimento",
                width: "w-36",
                sortable: true,
                render: (row) => (
                  <span className="text-xs text-muted-foreground">{formatWhen(row.last_moved_at)}</span>
                ),
              },
            ]}
            actions={(row) =>
              row.editable ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Ficha">
                  <Link to={`/gestao/ativos/${row.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
