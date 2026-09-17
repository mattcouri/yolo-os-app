import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shirt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { orderedAssetYardLocations } from "@/lib/locations";
import { cleanLocation } from "@/lib/operational-assets";
import { UNIFORM_SIZES, availableForSize } from "@/lib/uniforms";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import type { Location, Order, Uniform, UniformCheckout, UniformSize } from "@/types/database";

const selectClass =
  "h-8 w-full max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs";

const STREET_COLUMN = "__street__";

type FilterId = "all" | "ready" | "out";
type PlaceId = "home" | "street";

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function statusChipClass(place: PlaceId) {
  if (place === "home") {
    return "border-emerald-400/45 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
  }
  return "border-sky-400/45 bg-sky-500/15 text-sky-900 dark:text-sky-200";
}

function isOpenStreetOrder(order?: Order) {
  if (!order) return false;
  return order.status !== "cancelled" && order.status !== "retorno" && order.status !== "completed";
}

type PatioRow = {
  id: string;
  code: string;
  name: string;
  size: UniformSize;
  photo_url: string | null;
  columnId: string;
  locationName: string;
  statusLabel: string;
  place: PlaceId;
  orderLabel: string;
  lastMovedAt: string | null;
  search: string;
};

function homeColumnId(locations: Location[]) {
  return cleanLocation(locations)?.id || orderedAssetYardLocations(locations)[0]?.id || "";
}

function boardColumns(yardLocations: Location[]) {
  return [...yardLocations.map((location) => location.id), STREET_COLUMN];
}

function columnTitle(columnId: string, yardLocations: Location[]) {
  if (columnId === STREET_COLUMN) return "Na rua";
  return yardLocations.find((location) => location.id === columnId)?.name || "Local";
}

function UniformCard({ row }: { row: PatioRow }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card text-left shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {row.photo_url ? (
          <img src={row.photo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Shirt className="h-8 w-8 text-muted-foreground/70" />
          </div>
        )}
        <span
          className={cn(
            "absolute right-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            statusChipClass(row.place)
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
            {row.size}
          </Badge>
          {row.orderLabel ? (
            <span className="truncate text-[10px] font-medium text-muted-foreground">{row.orderLabel}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildRows(
  uniforms: Uniform[],
  checkouts: UniformCheckout[],
  orders: Order[],
  locations: Location[]
): PatioRow[] {
  const homeId = homeColumnId(locations);
  const homeName = locations.find((location) => location.id === homeId)?.name || "Área limpa";
  const rows: PatioRow[] = [];

  for (const uniform of uniforms.filter((item) => item.is_active !== false)) {
    for (const size of UNIFORM_SIZES) {
      const available = availableForSize(uniform, size, checkouts);
      for (let index = 0; index < available; index += 1) {
        const code = available > 1 ? `UNI-${size}-${index + 1}` : `UNI-${size}`;
        const name = `${uniform.name} · ${size}`;
        rows.push({
          id: `${uniform.id}:${size}:in:${index}`,
          code,
          name,
          size,
          photo_url: uniform.photo_url,
          columnId: homeId,
          locationName: homeName,
          statusLabel: "Disponível",
          place: "home",
          orderLabel: "",
          lastMovedAt: uniform.updated_at,
          search: [code, name, size, homeName, "disponível"].join(" ").toLowerCase(),
        });
      }
    }
  }

  for (const checkout of checkouts) {
    if (checkout.status !== "out") continue;
    const order = orders.find((item) => item.id === checkout.order_id);
    if (!isOpenStreetOrder(order)) continue;
    const uniform = uniforms.find((item) => item.id === checkout.uniform_id);
    const qty = Math.max(1, checkout.quantity);
    for (let index = 0; index < qty; index += 1) {
      const base = `${uniform?.name || "Uniforme"} · ${checkout.size}`;
      const name = qty > 1 ? `${base} · ${index + 1}/${qty}` : base;
      const code = qty > 1 ? `UNI-${checkout.size}-${index + 1}` : `UNI-${checkout.size}`;
      rows.push({
        id: `${checkout.id}:${index}`,
        code,
        name,
        size: checkout.size,
        photo_url: uniform?.photo_url || null,
        columnId: STREET_COLUMN,
        locationName: "Na rua",
        statusLabel: "Na rua",
        place: "street",
        orderLabel: order?.order_number || "",
        lastMovedAt: checkout.checked_out_at,
        search: [code, name, checkout.size, "na rua", order?.order_number || ""].join(" ").toLowerCase(),
      });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.code.localeCompare(b.code, "pt-BR"));
}

export function UniformesPage() {
  const { uniforms, uniformCheckouts, orders, locations } = useAppStore();
  const [filter, setFilter] = useState<FilterId>("all");

  const yardLocations = useMemo(() => orderedAssetYardLocations(locations), [locations]);
  const patio = useMemo(
    () => buildRows(uniforms, uniformCheckouts, orders, locations),
    [uniforms, uniformCheckouts, orders, locations]
  );
  const columns = useMemo(() => boardColumns(yardLocations), [yardLocations]);
  const rows = useMemo(
    () => patio.filter((row) => (filter === "all" ? true : filter === "ready" ? row.place === "home" : row.place === "street")),
    [patio, filter]
  );
  const counts = useMemo(
    () => ({
      all: patio.length,
      ready: patio.filter((row) => row.place === "home").length,
      out: patio.filter((row) => row.place === "street").length,
    }),
    [patio]
  );

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
          O que está em cada local do pátio. Área limpa = disponível para o kit. Na rua = saiu em pedido e ainda não
          voltou. Cadastro consolidado por tamanho fica em{" "}
          <Link to="/gestao/settings" className="underline underline-offset-2">
            Cadastros · Uniformes
          </Link>
          .
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
                <h2 className="truncate text-sm font-semibold">{columnTitle(columnId, yardLocations)}</h2>
                <Badge variant="secondary">{cards.length}</Badge>
              </header>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <p className="px-1 py-8 text-center text-xs text-muted-foreground">Vazio</p>
                ) : (
                  cards.map((row) => <UniformCard key={row.id} row={row} />)
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
                Uniformes não têm ID físico único. Cada peça disponível fica na Área limpa; cada peça em pedido aparece
                na rua com o número do pedido.
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
                  <select className={selectClass} value={row.place} disabled>
                    <option value="home">Disponível</option>
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
                  <select className={selectClass} value={row.place} disabled>
                    <option value="home">{row.place === "home" ? row.locationName : "Área limpa"}</option>
                    <option value="street">Na rua</option>
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
    </div>
  );
}
