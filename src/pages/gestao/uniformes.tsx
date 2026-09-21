import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KanbanColumnHandle, SortableKanbanColumns } from "@/components/kanban-sortable-columns";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applySavedColumnOrder, KANBAN_BOARDS } from "@/lib/kanban-order";
import { isSalaTradeLocation, orderedUniformYardLocations } from "@/lib/locations";
import { UNIFORM_SIZES, UNIFORM_STREET_COLUMN, availableForSize, stockQtyAt } from "@/lib/uniforms";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { Location, Order, Uniform, UniformCheckout, UniformSize, UniformStock } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

type FilterId = "all" | "ready" | "out";
type PlaceId = "yard" | "street";

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusChipClass(place: PlaceId, dirty: boolean) {
  if (place === "street") {
    return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
  }
  if (dirty) {
    return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  return "border-emerald-400/45 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
}

function isOpenStreetOrder(order?: Order) {
  if (!order) return false;
  return order.status !== "cancelled" && order.status !== "retorno" && order.status !== "completed";
}

type PatioRow = {
  id: string;
  uniformId: string;
  uniformName: string;
  code: string;
  name: string;
  size: UniformSize;
  photo_url: string | null;
  columnId: string;
  locationName: string;
  statusLabel: string;
  place: PlaceId;
  dirty: boolean;
  checkoutId: string | null;
  orderLabel: string;
  lastMovedAt: string | null;
  search: string;
};

type TypeGroup = {
  id: string;
  uniformId: string;
  uniformName: string;
  size: UniformSize;
  columnId: string;
  quantity: number;
  photo_url: string | null;
  place: PlaceId;
  dirty: boolean;
  orderLabels: string[];
  items: PatioRow[];
};

function groupByTypeSize(cards: PatioRow[]): TypeGroup[] {
  const groups = new Map<string, PatioRow[]>();
  for (const row of cards) {
    const key = `${row.uniformId}::${row.size}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([, items]) => {
      const sorted = [...items].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
      const sample = sorted[0];
      const orderLabels = [...new Set(sorted.map((item) => item.orderLabel).filter(Boolean))];
      return {
        id: `${sample.columnId}::${sample.uniformId}::${sample.size}`,
        uniformId: sample.uniformId,
        uniformName: sample.uniformName,
        size: sample.size,
        columnId: sample.columnId,
        quantity: sorted.length,
        photo_url: sample.photo_url,
        place: sample.place,
        dirty: sample.dirty,
        orderLabels,
        items: sorted,
      };
    })
    .sort(
      (a, b) =>
        a.uniformName.localeCompare(b.uniformName, "pt-BR") ||
        UNIFORM_SIZES.indexOf(a.size) - UNIFORM_SIZES.indexOf(b.size)
    );
}

function boardColumns(yardLocations: Location[]) {
  return [...yardLocations.map((location) => location.id), UNIFORM_STREET_COLUMN];
}

function columnTitle(columnId: string, yardLocations: Location[]) {
  if (columnId === UNIFORM_STREET_COLUMN) return "Na rua";
  return yardLocations.find((location) => location.id === columnId)?.name || "Local";
}

function UniformCard({ group, onOpen }: { group: TypeGroup; onOpen: () => void }) {
  const photo = group.photo_url;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Shirt className="h-8 w-8 text-muted-foreground/70" />
          </div>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-md border bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold leading-tight">
          {group.quantity} un
        </span>
        <span
          className={cn(
            "absolute left-1.5 top-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            statusChipClass(group.place, group.dirty)
          )}
        >
          {group.size}
        </span>
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="truncate text-sm font-medium leading-tight">{group.uniformName}</p>
        <p className="text-[11px] text-muted-foreground">
          {group.quantity} {group.quantity === 1 ? "peça" : "peças"} neste local · {group.size}
        </p>
        {group.place === "street" && group.orderLabels.length > 0 ? (
          <p className="truncate text-[10px] font-medium text-muted-foreground">
            {group.orderLabels.join(", ")}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {group.place === "street" ? "Na rua" : group.dirty ? "Área suja" : "Sala Trade"}
          </p>
        )}
      </div>
    </button>
  );
}

function qtyInYard(
  uniform: Uniform,
  size: UniformSize,
  locationId: string,
  stock: UniformStock[],
  checkouts: UniformCheckout[],
  fallbackId: string
) {
  const placed = stock.filter((row) => row.uniform_id === uniform.id && row.size === size);
  const available = availableForSize(uniform, size, checkouts);
  const placedSum = placed.reduce((sum, row) => sum + row.quantity, 0);
  if (placedSum === 0 && available > 0 && locationId === fallbackId) return available;
  return stockQtyAt(stock, uniform.id, size, locationId);
}

function buildRows(
  uniforms: Uniform[],
  checkouts: UniformCheckout[],
  stock: UniformStock[],
  orders: Order[],
  yards: Location[]
): PatioRow[] {
  const fallbackId = yards.find((location) => isSalaTradeLocation(location))?.id || yards[0]?.id || "";
  const rows: PatioRow[] = [];

  for (const uniform of uniforms.filter((item) => item.is_active !== false)) {
    for (const size of UNIFORM_SIZES) {
      for (const yard of yards) {
        const quantity = qtyInYard(uniform, size, yard.id, stock, checkouts, fallbackId);
        const dirty = yard.system_key === "asset_dirty";
        for (let index = 0; index < quantity; index += 1) {
          const code = quantity > 1 ? `UNI-${size}-${index + 1}` : `UNI-${size}`;
          const name = `${uniform.name} · ${size}`;
          rows.push({
            id: `${uniform.id}:${size}:${yard.id}:${index}`,
            uniformId: uniform.id,
            uniformName: uniform.name,
            code,
            name,
            size,
            photo_url: uniform.photo_url,
            columnId: yard.id,
            locationName: yard.name,
            statusLabel: "Disponível",
            place: "yard",
            dirty,
            checkoutId: null,
            orderLabel: "",
            lastMovedAt: uniform.updated_at,
            search: [code, name, size, yard.name, "disponível"].join(" ").toLowerCase(),
          });
        }
      }
    }
  }

  for (const checkout of checkouts) {
    if (checkout.status !== "out") continue;
    const order = checkout.order_id ? orders.find((item) => item.id === checkout.order_id) : undefined;
    if (checkout.order_id && !isOpenStreetOrder(order)) continue;
    const uniform = uniforms.find((item) => item.id === checkout.uniform_id);
    const qty = Math.max(1, checkout.quantity);
    for (let index = 0; index < qty; index += 1) {
      const base = `${uniform?.name || "Uniforme"} · ${checkout.size}`;
      const name = qty > 1 ? `${base} · ${index + 1}/${qty}` : base;
      const code = qty > 1 ? `UNI-${checkout.size}-${index + 1}` : `UNI-${checkout.size}`;
      rows.push({
        id: `${checkout.id}:${index}`,
        uniformId: checkout.uniform_id,
        uniformName: uniform?.name || "Uniforme",
        code,
        name,
        size: checkout.size,
        photo_url: uniform?.photo_url || null,
        columnId: UNIFORM_STREET_COLUMN,
        locationName: "Na rua",
        statusLabel: "Na rua",
        place: "street",
        dirty: false,
        checkoutId: checkout.id,
        orderLabel: order?.order_number || "",
        lastMovedAt: checkout.checked_out_at,
        search: [code, name, checkout.size, "na rua", order?.order_number || ""].join(" ").toLowerCase(),
      });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.code.localeCompare(b.code, "pt-BR"));
}

export function UniformesPage() {
  const {
    uniforms,
    uniformCheckouts,
    uniformStock,
    orders,
    locations,
    moveUniformUnit,
    seedUniformStockIfNeeded,
    kanbanColumnOrders,
    saveKanbanColumnOrder,
  } = useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [openGroup, setOpenGroup] = useState<TypeGroup | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void seedUniformStockIfNeeded();
  }, [seedUniformStockIfNeeded]);

  const yardLocations = useMemo(() => orderedUniformYardLocations(locations), [locations]);
  const patio = useMemo(
    () => buildRows(uniforms, uniformCheckouts, uniformStock, orders, yardLocations),
    [uniforms, uniformCheckouts, uniformStock, orders, locations, yardLocations]
  );
  const columns = useMemo(
    () => applySavedColumnOrder(boardColumns(yardLocations), kanbanColumnOrders[KANBAN_BOARDS.uniformes]),
    [yardLocations, kanbanColumnOrders]
  );
  const rows = useMemo(
    () =>
      patio.filter((row) =>
        filter === "all" ? true : filter === "ready" ? row.place === "yard" : row.place === "street"
      ),
    [patio, filter]
  );
  const counts = useMemo(
    () => ({
      all: patio.length,
      ready: patio.filter((row) => row.place === "yard").length,
      out: patio.filter((row) => row.place === "street").length,
    }),
    [patio]
  );

  const place = async (row: PatioRow, nextColumn: string) => {
    if (!nextColumn || nextColumn === row.columnId) return;
    setBusyId(row.id);
    setError(null);
    try {
      await moveUniformUnit({
        uniformId: row.uniformId,
        size: row.size,
        fromColumn: row.columnId,
        toColumn: nextColumn,
        checkoutId: row.checkoutId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível mover o uniforme.");
    } finally {
      setBusyId(null);
    }
  };

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "ready", label: "Disponível" },
    { id: "out", label: "Na rua" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uniformes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uniformes ficam na Área suja, na Sala Trade ou na rua. Cadastro consolidado por tamanho fica em{" "}
          <Link to="/gestao/settings" className="underline underline-offset-2">
            Cadastros · Uniformes
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <SortableKanbanColumns
        columnIds={columns}
        onReorder={(ids) => {
          void saveKanbanColumnOrder(KANBAN_BOARDS.uniformes, ids);
        }}
      >
        {(columnId, handle) => {
          const cards = patio.filter((row) => row.columnId === columnId);
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
                  groupByTypeSize(cards).map((group) => (
                    <UniformCard key={group.id} group={group} onOpen={() => setOpenGroup(group)} />
                  ))
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
                Mover status ou local atualiza o pátio. Na rua = saiu em pedido ou foi enviado pela lista.
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
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            data={rows}
            searchKey="search"
            searchPlaceholder="Buscar uniforme, tamanho, pedido…"
            emptyMessage="Nenhum uniforme neste filtro."
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
                key: "size",
                header: "Tipo",
                width: "w-28",
                sortable: true,
                render: (row) => (
                  <Badge variant="outline" className="text-xs font-normal">
                    {row.size}
                  </Badge>
                ),
              },
              {
                key: "statusLabel",
                header: "Status",
                width: "w-48",
                sortable: true,
                render: (row) => (
                  <select
                    className={selectClass}
                    value={row.place}
                    disabled={busyId === row.id}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const next = event.target.value as PlaceId;
                      if (next === "street") {
                        void place(row, UNIFORM_STREET_COLUMN);
                        return;
                      }
                      const home =
                        yardLocations.find((location) => isSalaTradeLocation(location))?.id ||
                        yardLocations[0]?.id ||
                        "";
                      void place(row, row.place === "yard" ? row.columnId : home);
                    }}
                  >
                    <option value="yard">Disponível</option>
                    <option value="street">Na rua</option>
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
                    value={row.columnId}
                    disabled={busyId === row.id}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => void place(row, event.target.value)}
                  >
                    {yardLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                    <option value={UNIFORM_STREET_COLUMN}>Na rua</option>
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
                key: "lastMovedAt",
                header: "Último movimento",
                width: "w-36",
                sortable: true,
                render: (row) => (
                  <span className="text-xs text-muted-foreground">{formatWhen(row.lastMovedAt)}</span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(openGroup)} onOpenChange={(open) => !open && setOpenGroup(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {openGroup?.uniformName} · {openGroup?.size} ·{" "}
              {openGroup ? columnTitle(openGroup.columnId, yardLocations) : ""}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {openGroup?.quantity} {openGroup?.quantity === 1 ? "peça" : "peças"} neste local.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <DataTable
              tableId={`gestao-uniformes-kanban::${openGroup?.id || ""}`}
              data={openGroup?.items || []}
              searchKey="search"
              searchPlaceholder="Buscar peça, pedido…"
              emptyMessage="Nenhuma peça neste local."
              maxHeight="50vh"
              columns={[
                {
                  key: "code",
                  header: "ID",
                  width: "w-32",
                  render: (row) => (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{row.code}</code>
                  ),
                },
                {
                  key: "size",
                  header: "Tamanho",
                  width: "w-24",
                  render: (row) => (
                    <Badge variant="outline" className="text-xs font-normal">
                      {row.size}
                    </Badge>
                  ),
                },
                {
                  key: "statusLabel",
                  header: "Status",
                  width: "w-32",
                  render: (row) => (
                    <Badge variant="outline" className="text-xs font-normal">
                      {row.statusLabel}
                    </Badge>
                  ),
                },
                {
                  key: "orderLabel",
                  header: "Pedido",
                  render: (row) =>
                    row.orderLabel ? (
                      <span className="text-xs font-medium">{row.orderLabel}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    ),
                },
              ]}
            />
          </div>
          <DialogFooter>
            <Button type="button" className="h-9" onClick={() => setOpenGroup(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
