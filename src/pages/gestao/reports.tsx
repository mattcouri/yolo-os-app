import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { streetAssets, type StreetAssetRow } from "@/lib/ativos-na-rua";
import { useAuthProfile } from "@/lib/auth";
import {
  TYPE_LABEL,
  formatEventDay,
  isClosedOrder,
  locationSummary,
  parseCloseOut,
  startOfDay,
} from "@/lib/separacao";
import { useAppStore } from "@/stores";
import type { Order, OrderItem, SeparationJob } from "@/types/database";

type HistoryRow = {
  id: string;
  orderNumber: string;
  type: string;
  organization: string;
  eventDate: string;
  closedAt: string;
  closedSort: string;
  items: string;
  retorno: string;
  search: string;
};

function closedAtDate(order: Order, job?: SeparationJob | null) {
  const close = parseCloseOut(order.return_description);
  if (close?.closed_at) {
    const date = new Date(close.closed_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (order.updated_at) {
    const date = new Date(order.updated_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (job?.updated_at) {
    const date = new Date(job.updated_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function inClosedRange(date: Date | null, from: string, to: string) {
  if (!from && !to) return true;
  if (!date) return false;
  const time = date.getTime();
  if (from) {
    const start = startOfDay(new Date(`${from}T00:00:00`)).getTime();
    if (time < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setHours(23, 59, 59, 999);
    if (time > end.getTime()) return false;
  }
  return true;
}

function itemLine(item: OrderItem, closeReturned?: number) {
  const qty = Math.max(1, Math.round(item.quantity));
  if (!item.is_returnable) return `${item.name} · ${qty} (fica)`;
  if (closeReturned == null) return `${item.name} · ${qty}`;
  return `${item.name} · ${closeReturned}/${qty} voltaram`;
}

function buildHistoryRows(
  orders: Order[],
  orderItems: OrderItem[],
  jobs: SeparationJob[]
): HistoryRow[] {
  return orders
    .filter((order) => {
      if (order.status === "cancelled") return false;
      const job = jobs.find((row) => row.order_id === order.id);
      return isClosedOrder(order, job);
    })
    .map((order) => {
      const job = jobs.find((row) => row.order_id === order.id);
      const items = orderItems.filter((item) => item.order_id === order.id);
      const close = parseCloseOut(order.return_description);
      const closed = closedAtDate(order, job);
      const event = order.needed_date
        ? formatEventDay(new Date(`${order.needed_date}T00:00:00`))
        : "—";
      const itemText = items
        .map((item) => {
          const line = close?.lines.find((row) => row.item_id === item.id);
          return itemLine(item, line?.returned);
        })
        .join(" · ");
      const returnable = items.filter((item) => item.is_returnable);
      const returned = close
        ? close.lines.reduce((sum, line) => sum + line.returned, 0)
        : 0;
      const sent = close
        ? close.lines.reduce((sum, line) => sum + line.sent, 0)
        : returnable.reduce((sum, item) => sum + Math.max(1, Math.round(item.quantity)), 0);
      const retorno = returnable.length
        ? close
          ? `${returned}/${sent} conferidos`
          : "Encerrado"
        : "Sem retorno";
      const type = TYPE_LABEL[order.order_type] || order.order_type;
      const organization = order.organization || order.recipient_name || "—";
      return {
        id: order.id,
        orderNumber: order.order_number,
        type,
        organization,
        eventDate: event,
        closedAt: closed ? formatEventDay(closed) : "—",
        closedSort: closed?.toISOString() || order.updated_at || "",
        items: itemText || "—",
        retorno,
        search: [
          order.order_number,
          type,
          organization,
          order.recipient_name,
          locationSummary(order, items),
          itemText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    })
    .sort((a, b) => b.closedSort.localeCompare(a.closedSort));
}

export function ReportsPage() {
  const { orders, orderItems, separationJobs, assets, uniforms, uniformCheckouts, deleteClosedOrder } = useAppStore();
  const { isAdmin } = useAuthProfile();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleting, setDeleting] = useState<HistoryRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = useMemo(() => {
    const rows = buildHistoryRows(orders, orderItems, separationJobs);
    if (!from && !to) return rows;
    return rows.filter((row) => {
      const order = orders.find((item) => item.id === row.id);
      const job = separationJobs.find((item) => item.order_id === row.id);
      return inClosedRange(order ? closedAtDate(order, job) : null, from, to);
    });
  }, [orders, orderItems, separationJobs, from, to]);

  const streetRows = useMemo(
    () => streetAssets(orders, orderItems, assets, uniforms, uniformCheckouts),
    [orders, orderItems, assets, uniforms, uniformCheckouts]
  );

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const pad = (value: number) => String(value).padStart(2, "0");
    setFrom(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
    setTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteClosedOrder(deleting.id);
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o pedido.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos encerrados na Separação, com conferência de retorno. Use o filtro de datas para consultar períodos anteriores.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Pedidos encerrados
              </CardTitle>
              <CardDescription>
                O mesmo ID do Acompanhar. Encerrar não apaga o pedido; só o admin pode excluir um registro daqui.
              </CardDescription>
            </div>
            <Badge variant="secondary">{history.length}</Badge>
          </div>
          <div className="flex flex-wrap items-end gap-3 pt-3">
            <div className="space-y-1">
              <Label htmlFor="history-from" className="text-xs">
                De
              </Label>
              <Input
                id="history-from"
                type="date"
                className="h-9 w-[10.5rem]"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="history-to" className="text-xs">
                Até
              </Label>
              <Input
                id="history-to"
                type="date"
                className="h-9 w-[10.5rem]"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={setThisMonth}>
              Este mês
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Todo o período
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            data={history}
            searchKey="search"
            searchPlaceholder="Buscar pedido, cliente, item…"
            emptyMessage="Nenhum pedido encerrado neste período."
            maxHeight="calc(100vh - 420px)"
            columns={[
              {
                key: "orderNumber",
                header: "Pedido",
                width: "w-28",
                sortable: true,
                render: (row: HistoryRow) => (
                  <Link to={`/separacao/${row.id}`} className="font-medium text-primary hover:underline">
                    {row.orderNumber}
                  </Link>
                ),
              },
              {
                key: "type",
                header: "Tipo",
                width: "w-24",
                render: (row: HistoryRow) => <Badge variant="outline">{row.type}</Badge>,
              },
              {
                key: "organization",
                header: "Cliente / evento",
                sortable: true,
                render: (row: HistoryRow) => <span className="truncate">{row.organization}</span>,
              },
              { key: "eventDate", header: "Data do pedido", width: "w-28", sortable: true },
              { key: "closedAt", header: "Encerrado em", width: "w-28", sortable: true },
              {
                key: "items",
                header: "Itens",
                render: (row: HistoryRow) => (
                  <p className="max-w-xs truncate text-xs text-muted-foreground" title={row.items}>
                    {row.items}
                  </p>
                ),
              },
              {
                key: "retorno",
                header: "Retorno",
                width: "w-32",
                render: (row: HistoryRow) => <Badge variant="secondary">{row.retorno}</Badge>,
              },
            ]}
            actions={
              isAdmin
                ? (row) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Excluir registro"
                      onClick={() => {
                        setError(null);
                        setDeleting(row);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Ativos na rua
              </CardTitle>
              <CardDescription>
                Saiu e não volta: marcado sem volta no pedido, ou conferido no encerramento como não retornado.
              </CardDescription>
            </div>
            <Badge variant="secondary">{streetRows.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            data={streetRows}
            searchKey="search"
            searchPlaceholder="Buscar ativo, pedido, endereço…"
            emptyMessage="Nenhum ativo na rua. Itens com volta ficam no calendário de Separação até o retorno."
            maxHeight="calc(100vh - 280px)"
            columns={[
              {
                key: "name",
                header: "Ativo",
                sortable: true,
                render: (row: StreetAssetRow) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.code}</p>
                  </div>
                ),
              },
              {
                key: "kind",
                header: "Tipo",
                width: "w-28",
                render: (row: StreetAssetRow) => (
                  <Badge variant="outline" className="capitalize">
                    {row.kind}
                  </Badge>
                ),
              },
              {
                key: "where",
                header: "Onde",
                sortable: true,
                render: (row: StreetAssetRow) => (
                  <div className="min-w-0">
                    <p className="truncate leading-tight">{row.organization}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.recipient}
                      {row.address && row.address !== "—" ? ` · ${row.address}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "orderNumber",
                header: "Pedido",
                width: "w-28",
                sortable: true,
                render: (row: StreetAssetRow) =>
                  row.orderId ? (
                    <Link to={`/separacao/${row.orderId}`} className="text-primary hover:underline">
                      {row.orderNumber}
                    </Link>
                  ) : (
                    row.orderNumber
                  ),
              },
              { key: "qty", header: "Qtd", width: "w-14" },
              { key: "since", header: "Desde", width: "w-24", sortable: true },
              {
                key: "volta",
                header: "Volta",
                width: "w-28",
                render: (row: StreetAssetRow) => (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    {row.volta}
                  </Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !busy && !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir pedido do histórico?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `O pedido ${deleting.orderNumber} (${deleting.organization}) será removido desta lista. Essa ação não pode ser desfeita.`
                : "O registro será removido desta lista."}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
              {busy ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
