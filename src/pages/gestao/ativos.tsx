import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Package, Shirt, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { orderedAssetYardLocations } from "@/lib/locations";
import {
  categoryLabel,
  isBoxAsset,
  OPERATIONAL_STATUSES,
  planAssetPlacement,
  statusLabel,
} from "@/lib/operational-assets";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { Asset, AssetStatus, Location } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

const STREET_COLUMN = "__street__";
const UNLOCATED_COLUMN = "__none__";

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

function displayStatus(asset: Pick<Asset, "status" | "type">) {
  if (isBoxAsset(asset)) {
    const labels: Partial<Record<AssetStatus, string>> = {
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
    return labels[asset.status] || statusLabel(asset.status);
  }
  return statusLabel(asset.status);
}

type PatioRow = Asset & {
  locationName: string;
  categoryLabel: string;
  statusLabel: string;
  search: string;
  orderLabel: string;
  kind: "equipamento" | "uniforme" | "caixa";
  editable: boolean;
};

function boardColumnId(row: Pick<PatioRow, "location_id" | "status">) {
  if (row.location_id) return row.location_id;
  if (OUT_STATUSES.has(row.status)) return STREET_COLUMN;
  return UNLOCATED_COLUMN;
}

function boardColumns(yardLocations: Location[], rows: PatioRow[]) {
  const used = new Set(rows.map(boardColumnId));
  const extras = [STREET_COLUMN];
  if (used.has(UNLOCATED_COLUMN)) extras.push(UNLOCATED_COLUMN);
  return [...yardLocations.map((location) => location.id), ...extras];
}

function columnTitle(columnId: string, yardLocations: Location[]) {
  if (columnId === STREET_COLUMN) return "Na rua";
  if (columnId === UNLOCATED_COLUMN) return "Sem local";
  return yardLocations.find((location) => location.id === columnId)?.name || "Local";
}

function boxTypeLabel(type: Asset["type"]) {
  if (type === "caixa_preta") return "Caixa preta";
  if (type === "caixa_media") return "Caixa média";
  if (type === "caixa_grande") return "Caixa grande";
  return "Caixa";
}

function patioKind(asset: Pick<Asset, "type" | "category">): PatioRow["kind"] {
  if (isBoxAsset(asset)) return "caixa";
  if (asset.category === "uniforme") return "uniforme";
  return "equipamento";
}

function patioCategory(asset: Pick<Asset, "type" | "category">) {
  if (isBoxAsset(asset)) return boxTypeLabel(asset.type);
  return categoryLabel(asset.category || asset.type);
}

function PatioCard({ row }: { row: PatioRow }) {
  const photo = row.photo_url;
  const Placeholder = row.kind === "uniforme" ? Shirt : row.kind === "caixa" ? Package : Wrench;
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Placeholder className="h-8 w-8 text-muted-foreground/70" />
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
    uniforms,
    uniformCheckouts,
    updateAsset,
    createMovement,
  } = useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const yardLocations = useMemo(() => orderedAssetYardLocations(locations), [locations]);

  const operational = useMemo(
    () => assets.filter((asset) => asset.is_active !== false),
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
    const equipment: PatioRow[] = operational.map((asset) => {
      const locationName = locations.find((location) => location.id === asset.location_id)?.name || "—";
      const category = patioCategory(asset);
      const kind = patioKind(asset);
      const reservation = reservationByAsset.get(asset.id);
      const order = reservation?.orderId
        ? orders.find((item) => item.id === reservation.orderId)
        : asset.category === "uniforme"
          ? orders.find((item) => asset.description?.includes(item.order_number))
          : undefined;
      const orderLabel = order
        ? order.order_number
        : reservation
          ? reservation.holder
          : "";
      return {
        ...asset,
        locationName,
        categoryLabel: category,
        statusLabel: displayStatus(asset),
        orderLabel,
        kind,
        editable: kind !== "caixa",
        search: [asset.code, asset.name, category, locationName, displayStatus(asset), orderLabel]
          .join(" ")
          .toLowerCase(),
      };
    });

    const uniformsOut: PatioRow[] = [];
    for (const checkout of uniformCheckouts) {
      if (checkout.status !== "out") continue;
      const order = orders.find((item) => item.id === checkout.order_id);
      if (!order || order.status === "cancelled" || order.status === "retorno" || order.status === "completed") {
        continue;
      }
      const uniform = uniforms.find((item) => item.id === checkout.uniform_id);
      const qty = Math.max(1, checkout.quantity);
      for (let index = 0; index < qty; index += 1) {
        const base = `${uniform?.name || "Uniforme"} · ${checkout.size}`;
        const name = qty > 1 ? `${base} · ${index + 1}/${qty}` : base;
        const code = qty > 1 ? `UNI-${checkout.size}-${index + 1}` : `UNI-${checkout.size}`;
        uniformsOut.push({
          id: `${checkout.id}:${index}`,
          code,
          name,
          type: "other",
          location_id: null,
          status: "in_use",
          is_active: true,
          created_at: checkout.created_at,
          updated_at: checkout.created_at,
          last_moved_at: checkout.checked_out_at,
          category: "uniforme",
          photo_url: uniform?.photo_url || null,
          locationName: "Na rua",
          categoryLabel: "Uniforme",
          statusLabel: statusLabel("in_use"),
          orderLabel: order.order_number,
          kind: "uniforme",
          editable: false,
          search: [code, name, "uniforme", "na rua", order.order_number].join(" ").toLowerCase(),
        });
      }
    }

    return [...equipment, ...uniformsOut];
  }, [operational, locations, reservationByAsset, orders, uniforms, uniformCheckouts]);

  const listPatio = useMemo(() => patio.filter((row) => row.kind !== "caixa"), [patio]);

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

  const columns = useMemo(() => boardColumns(yardLocations, patio), [yardLocations, patio]);

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
          locations.find((location) => location.id === planned.location_id)?.name || "sem local";
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
          na rua entram automaticamente; no retorno cada peça ganha status e local.
        </p>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {columns.map((columnId) => {
          const cards = patio.filter((row) => boardColumnId(row) === columnId);
          return (
            <section
              key={columnId}
              className="flex w-[16.5rem] shrink-0 flex-col rounded-xl border bg-muted/30"
            >
              <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <h2 className="truncate text-sm font-semibold">{columnTitle(columnId, yardLocations)}</h2>
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
        })}
      </div>

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
                render: (row) => (
                  <select
                    className={selectClass}
                    value={row.location_id || ""}
                    disabled={busyId === row.id || !row.editable}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      void place(row, { locationId: event.target.value || null })
                    }
                  >
                    <option value="">Sem local</option>
                    {yardLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                ),
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
