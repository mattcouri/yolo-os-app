import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  categoryLabel,
  cleanLocation,
  dirtyLocation,
  isOperationalAsset,
  OPERATIONAL_STATUSES,
  planAssetPlacement,
  statusLabel,
} from "@/lib/operational-assets";
import { useAppStore } from "@/stores";
import type { Asset, AssetStatus } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

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

type PatioRow = Asset & {
  locationName: string;
  categoryLabel: string;
  statusLabel: string;
  search: string;
  orderLabel: string;
  kind: "equipamento" | "uniforme";
  editable: boolean;
};

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

  const dirty = dirtyLocation(locations);
  const clean = cleanLocation(locations);
  const yardLocations = useMemo(() => {
    const rest = locations.filter(
      (location) =>
        location.is_active &&
        location.id !== dirty?.id &&
        location.id !== clean?.id
    );
    return [...(dirty ? [dirty] : []), ...(clean ? [clean] : []), ...rest];
  }, [locations, dirty, clean]);

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
    const equipment: PatioRow[] = operational.map((asset) => {
      const locationName = locations.find((location) => location.id === asset.location_id)?.name || "—";
      const category = categoryLabel(asset.category || asset.type);
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
        statusLabel: statusLabel(asset.status),
        orderLabel,
        kind: asset.category === "uniforme" ? "uniforme" : "equipamento",
        editable: true,
        search: [asset.code, asset.name, category, locationName, statusLabel(asset.status), orderLabel]
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

  const counts = useMemo(() => {
    const inDirty = dirty ? patio.filter((row) => row.location_id === dirty.id).length : 0;
    const inClean = clean ? patio.filter((row) => row.location_id === clean.id).length : 0;
    return {
      all: patio.length,
      ready: patio.filter((row) => row.status === "available").length,
      dirty: patio.filter((row) => row.status === "cleaning").length,
      out: patio.filter((row) => OUT_STATUSES.has(row.status)).length,
      pending: patio.filter((row) => PENDING_STATUSES.has(row.status)).length,
      exception: patio.filter((row) => EXCEPTION_STATUSES.has(row.status)).length,
      inDirty,
      inClean,
    };
  }, [patio, dirty, clean]);

  const rows = useMemo(
    () => patio.filter((row) => matchesFilter(row.status, filter)),
    [patio, filter]
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
          Status operacional e local no pátio, incluindo uniformes. Área suja = para limpar. Área limpa = pronto
          para usar de novo. Uniformes na rua entram automaticamente; no retorno cada peça ganha status e local.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Área limpa</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.inClean}</div>
            <p className="text-xs text-muted-foreground">no local · prontos para sair</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Área suja</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.inDirty}</div>
            <p className="text-xs text-muted-foreground">no local · aguardando limpeza</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Na rua</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.out}</div>
            <p className="text-xs text-muted-foreground">reservados ou em uso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Exceções</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.exception}</div>
            <p className="text-xs text-muted-foreground">danificado, incompleto, perdido</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Pátio</CardTitle>
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
