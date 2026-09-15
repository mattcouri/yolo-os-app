import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckSquare, Printer, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { useAppStore } from "@/stores";
import { useAuthProfile } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { OrderItem, Profile } from "@/types/database";
import { checkoutMatchesItem } from "@/lib/ativos-na-rua";
import { checkoutStaysOut } from "@/lib/kit-availability";
import {
  FULFILL_LABEL,
  TYPE_LABEL,
  eventTitle,
  formatEventDay,
  formatEventTime,
  formatEventWeekday,
  formatSheetDate,
  isClosed,
  isQueued,
  needsCloseOut,
  needsPickup,
  orderDeliveryAt,
  orderEventEnd,
  orderEnd,
  orderPickupAt,
  orderStart,
  parseCloseOut,
  toDateTimeLocal,
  unreturnedQty,
  type ReturnDest,
  type ReturnLine,
} from "@/lib/separacao";

const DEST_OPTIONS: { value: ReturnDest; label: string }[] = [
  { value: "stock", label: "Volta ao estoque" },
  { value: "inspection", label: "Inspeção / limpeza" },
  { value: "consumed", label: "Consumido / ficou" },
  { value: "missing", label: "Faltou" },
  { value: "damaged", label: "Danificado" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

function itemMeta(item: OrderItem, kind: "saida" | "retorno") {
  const parts = [item.code];
  if (item.requested_state) parts.push(item.requested_state);
  const isKit = Boolean(item.asset_id || item.code.startsWith("UNI-"));
  if (kind === "saida" && isKit && !item.is_returnable) parts.push("fica na rua");
  return parts.filter(Boolean).join(" · ");
}

function ChecklistTable({
  items,
  checkedIds,
  emptyLabel,
  disabled,
  onToggle,
  kind,
}: {
  items: OrderItem[];
  checkedIds: string[];
  emptyLabel: string;
  disabled?: boolean;
  onToggle?: (id: string) => void;
  kind: "saida" | "retorno";
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Ok</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qtd</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const checked = checkedIds.includes(item.id);
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="print:hidden"
                    disabled={disabled || !onToggle}
                    onClick={() => onToggle?.(item.id)}
                  >
                    {checked ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <span className="hidden print:inline">{checked ? "☑" : "☐"}</span>
                </td>
                <td className="px-3 py-2">
                  <strong>{item.name}</strong>
                  <p className="text-xs text-muted-foreground">{itemMeta(item, kind)}</p>
                </td>
                <td className="px-3 py-2 text-right">
                  {item.quantity} {item.unit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DriverSelect({
  value,
  onChange,
  people,
  disabled,
  allowEmpty,
  emptyLabel = "Selecione",
}: {
  value: string;
  onChange: (value: string) => void;
  people: Profile[];
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const extra = value && !people.some((row) => row.full_name === value) ? value : null;
  return (
    <select className={selectClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {!allowEmpty && !value && <option value="">Selecione</option>}
      {people.map((person) => (
        <option key={person.id} value={person.full_name}>
          {person.full_name}
        </option>
      ))}
      {extra && <option value={extra}>{extra}</option>}
    </select>
  );
}

export function SeparationJobPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuthProfile();
  const {
    orders,
    orderItems,
    separationJobs,
    uniforms,
    uniformCheckouts,
    vehicles,
    updateSeparationJob,
    updateOrder,
    updateOrderItem,
    returnUniformsForOrder,
    completeEquipmentForOrder,
    createMovement,
    fetchVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  } = useAppStore();

  const order = orders.find((row) => row.id === orderId);
  const job = separationJobs.find((row) => row.order_id === orderId);
  const items = orderItems.filter((row) => row.order_id === orderId);
  const existingClose = parseCloseOut(order?.return_description || null);

  const [deliveryDriver, setDeliveryDriver] = useState(job?.delivery_driver || "");
  const [pickupDriver, setPickupDriver] = useState(job?.pickup_driver || "");
  const [vehicle, setVehicle] = useState(job?.vehicle || "");
  const [departureAt, setDepartureAt] = useState(
    job?.departure_at ? toDateTimeLocal(new Date(job.departure_at)) : toDateTimeLocal(order ? orderStart(order) : null)
  );
  const [returnAt, setReturnAt] = useState(
    job?.return_at ? toDateTimeLocal(new Date(job.return_at)) : toDateTimeLocal(order ? orderEnd(order) : null)
  );
  const [operationsNotes, setOperationsNotes] = useState(job?.operations_notes || "");
  const [checkedItems, setCheckedItems] = useState<string[]>(items.filter((item) => item.is_checked).map((item) => item.id));
  const [returnChecked, setReturnChecked] = useState<string[]>([]);
  const [closeNotes, setCloseNotes] = useState(existingClose?.notes || "");
  const [returns, setReturns] = useState<Record<string, { returned: string; dest: ReturnDest }>>(() => {
    const initial: Record<string, { returned: string; dest: ReturnDest }> = {};
    for (const item of items) {
      const saved = existingClose?.lines.find((line) => line.item_id === item.id);
      initial[item.id] = {
        returned: saved ? String(saved.returned) : item.is_returnable ? String(item.quantity) : "0",
        dest: saved?.dest || (item.is_returnable ? "inspection" : "consumed"),
      };
    }
    return initial;
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    let cancelled = false;
    const loadPeople = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (profile) setPeople([profile]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, active, created_at, updated_at")
        .eq("active", true)
        .order("full_name");
      if (cancelled) return;
      const rows = (data || []) as Profile[];
      setPeople(rows.length ? rows : profile ? [profile] : []);
    };
    void loadPeople();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const pickupRequired = useMemo(() => (order ? needsPickup(order, items) : false), [order, items]);
  const returnItems = useMemo(() => items.filter((item) => item.is_returnable), [items]);
  const closed = job ? isClosed(job) : false;
  const queued = job ? isQueued(job) : true;
  const showCloseOut = Boolean(order && job && (needsCloseOut(order, job) || !queued) && !closed);

  if (!order || !job) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Link to="/separacao" className="text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const persistChecklist = async () => {
    await Promise.all(
      items.map((item) => updateOrderItem(item.id, { is_checked: checkedItems.includes(item.id) }))
    );
  };

  const handleConfirm = async (print = false) => {
    setError("");
    if (!deliveryDriver.trim()) {
      setError("Informe quem faz a entrega / drop-off.");
      return;
    }
    if (pickupRequired && !pickupDriver.trim()) {
      setError("Informe quem faz a retirada.");
      return;
    }
    if (!departureAt) {
      setError("Confirme o horário de saída / entrega.");
      return;
    }
    if (pickupRequired && !returnAt) {
      setError("Confirme o horário da retirada.");
      return;
    }

    setIsSaving(true);
    try {
      await persistChecklist();
      await updateSeparationJob(job.id, {
        delivery_driver: deliveryDriver.trim(),
        pickup_driver: pickupRequired ? pickupDriver.trim() : pickupDriver.trim() || "Não se aplica",
        vehicle: vehicle.trim() || null,
        departure_at: new Date(departureAt).toISOString(),
        return_at: returnAt ? new Date(returnAt).toISOString() : null,
        operations_notes: operationsNotes.trim() || null,
        stage: "em_separacao",
      });
      await updateOrder(order.id, { status: "em_separacao" });
      if (print) window.print();
      else navigate("/separacao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a folha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseOut = async () => {
    setError("");
    const lines: ReturnLine[] = items.map((item) => {
      const row = returns[item.id];
      const returned = Number(row?.returned);
      return {
        item_id: item.id,
        sent: item.quantity,
        returned: Number.isFinite(returned) ? Math.max(0, returned) : 0,
        dest: row?.dest || "consumed",
      };
    });
    if (lines.some((line) => line.returned > line.sent)) {
      setError("Quantidade que voltou não pode ser maior do que saiu.");
      return;
    }

    setIsSaving(true);
    try {
      await persistChecklist();
      const record = {
        closed_at: new Date().toISOString(),
        notes: closeNotes.trim() || undefined,
        lines,
      };
      await updateOrder(order.id, {
        status: "retorno",
        return_description: JSON.stringify(record),
      });
      await updateSeparationJob(job.id, {
        stage: "retorno",
        operations_notes: [operationsNotes.trim(), closeNotes.trim() && `Encerramento: ${closeNotes.trim()}`]
          .filter(Boolean)
          .join("\n") || null,
      });
      for (const line of lines) {
        if (line.returned <= 0) continue;
        const item = items.find((row) => row.id === line.item_id);
        if (!item) continue;
        await createMovement({
          type: "return",
          order_id: order.id,
          asset_id: item.asset_id || undefined,
          quantity: line.returned,
          reason: `Retorno ${order.order_number}`,
          notes: `${item.name} · ${line.dest} · ${line.returned}/${line.sent}`,
        });
      }
      const stayOutAssetIds = items
        .filter((item) => item.asset_id && unreturnedQty(lines.find((line) => line.item_id === item.id) || { sent: item.quantity, returned: 0 }) > 0)
        .map((item) => item.asset_id!);
      const stayOutUniforms = uniformCheckouts
        .filter((row) => row.order_id === order.id && row.status === "out" && !checkoutStaysOut(row))
        .flatMap((checkout) => {
          const item = items.find((row) => checkoutMatchesItem(checkout, row, uniforms));
          if (!item) return [];
          const leftover = unreturnedQty(lines.find((line) => line.item_id === item.id) || { sent: item.quantity, returned: 0 });
          return leftover > 0 ? [{ id: checkout.id, remaining: leftover }] : [];
        });
      await completeEquipmentForOrder(order.id, stayOutAssetIds);
      await returnUniformsForOrder(order.id, stayOutUniforms);
      navigate("/separacao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível encerrar o evento.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <Link
        to="/separacao"
        className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        Separação
      </Link>

      <article className="mt-4 rounded-2xl border bg-card p-5 print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b pb-4 print:border-black">
          <div>
            <p className="text-2xl font-black tracking-tight">
              YOLO <span className="text-sm font-semibold">OS</span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Folha de operação</p>
            <h1 className="mt-2 text-xl font-bold">{eventTitle(order)}</h1>
            <p className="text-sm text-muted-foreground">
              {TYPE_LABEL[order.order_type] || order.order_type} · {FULFILL_LABEL[order.fulfillment] || order.fulfillment}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{order.order_number}</p>
            <p className="mt-1 text-3xl font-black tabular-nums leading-none tracking-tight">
              {formatEventDay(orderStart(order))}
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-muted-foreground">
              {formatEventWeekday(orderStart(order))}
              {formatEventTime(orderStart(order)) ? ` · ${formatEventTime(orderStart(order))}` : ""}
              {orderEventEnd(order) ? `–${formatEventTime(orderEventEnd(order))}` : ""}
            </p>
            <Badge variant="secondary" className="mt-2">
              {closed ? "Encerrado" : queued ? "Na fila" : "Programado"}
            </Badge>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 border-b py-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Quem pediu</p>
            <p className="font-medium">{order.requester_name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Quem recebe</p>
            <p className="font-medium">
              {order.organization} · {order.recipient_name}
            </p>
            <p className="text-muted-foreground">{order.recipient_contact}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Onde</p>
            <p className="font-medium">{order.address || "Uso interno / retirada no CD"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Quando</p>
            <p className="font-medium">Entrega {formatSheetDate(orderDeliveryAt(order))}</p>
            {order.event_start && <p className="text-muted-foreground">Início {formatSheetDate(orderStart(order))}</p>}
            {orderEventEnd(order) && <p className="text-muted-foreground">Fim {formatSheetDate(orderEventEnd(order))}</p>}
            {orderPickupAt(order) && <p className="text-muted-foreground">Retirada {formatSheetDate(orderPickupAt(order))}</p>}
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase text-muted-foreground">Observações do pedido</p>
              <p>{order.notes}</p>
            </div>
          )}
        </section>

        <section className="border-b py-4 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Motoristas e horários</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Motorista da entrega</Label>
              <DriverSelect
                value={deliveryDriver}
                onChange={setDeliveryDriver}
                people={people}
                disabled={closed}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motorista da retirada{pickupRequired ? "" : " (se houver)"}</Label>
              <DriverSelect
                value={pickupDriver === "Não se aplica" ? "" : pickupDriver}
                onChange={setPickupDriver}
                people={people}
                disabled={closed}
                allowEmpty
                emptyLabel={pickupRequired ? "Selecione" : "Não se aplica"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Horário confirmado de saída / entrega</Label>
              <Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} disabled={closed} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário confirmado de retirada</Label>
              <Input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} disabled={closed} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Veículo</Label>
              <CreatableSelect
                value={vehicle}
                onChange={setVehicle}
                options={vehicles.map((row) => ({ value: row.name, label: row.name }))}
                onCreateOption={async (label) => {
                  const row = await createVehicle(label);
                  return row.name;
                }}
                onEditOption={async (current, next) => {
                  const row = vehicles.find((item) => item.name === current);
                  if (!row) return;
                  await updateVehicle(row.id, next);
                  if (vehicle === current) setVehicle(next);
                }}
                onDeleteOption={async (current) => {
                  const row = vehicles.find((item) => item.name === current);
                  if (!row) return;
                  await deleteVehicle(row.id);
                  if (vehicle === current) setVehicle("");
                }}
                placeholder="Selecione o veículo..."
                createPlaceholder="Novo veículo..."
                disabled={closed}
              />
            </div>
          </div>
        </section>

        <section className="hidden border-b py-4 text-sm print:block">
          <p>
            <strong>Entrega:</strong> {deliveryDriver || "_____________"} · {departureAt || "____/____ ____:____"}
          </p>
          <p>
            <strong>Retirada:</strong> {pickupDriver || "_____________"} · {returnAt || "____/____ ____:____"}
          </p>
          {vehicle && (
            <p>
              <strong>Veículo:</strong> {vehicle}
            </p>
          )}
        </section>

        <section className="py-4 print:break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold">Checklist de saída</h2>
          <p className="mb-3 text-xs text-muted-foreground">Tudo que vai neste pedido. Conferir na montagem / carregamento.</p>
          <ChecklistTable
            kind="saida"
            items={items}
            checkedIds={checkedItems}
            emptyLabel="Nenhum item neste pedido."
            disabled={closed}
            onToggle={(id) =>
              setCheckedItems((current) =>
                current.includes(id) ? current.filter((row) => row !== id) : [...current, id]
              )
            }
          />
        </section>

        <section className="border-t py-4 print:break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold">Checklist de retorno</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Tudo que volta. Conferir na retirada — mesma folha do evento.
            {pickupDriver && pickupDriver !== "Não se aplica" ? ` · ${pickupDriver}` : ""}
          </p>
          <ChecklistTable
            kind="retorno"
            items={returnItems}
            checkedIds={returnChecked}
            emptyLabel="Nenhum item com volta nesta folha."
            disabled={closed}
            onToggle={(id) =>
              setReturnChecked((current) =>
                current.includes(id) ? current.filter((row) => row !== id) : [...current, id]
              )
            }
          />
        </section>

        {showCloseOut && (
          <section className="border-t py-4 print:hidden">
            <h2 className="mb-1 text-sm font-semibold">Encerrar evento / retorno</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              O evento só fecha quando o que voltou está conferido. Equipamentos seguem para inspeção; pops reaproveitáveis voltam ao estoque.
            </p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_72px_1fr] items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">Saiu {item.quantity}</p>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max={item.quantity}
                    className="h-8"
                    value={returns[item.id]?.returned ?? "0"}
                    disabled={closed}
                    onChange={(e) =>
                      setReturns((current) => ({
                        ...current,
                        [item.id]: { ...current[item.id], returned: e.target.value, dest: current[item.id]?.dest || "consumed" },
                      }))
                    }
                  />
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={returns[item.id]?.dest || "consumed"}
                    disabled={closed}
                    onChange={(e) =>
                      setReturns((current) => ({
                        ...current,
                        [item.id]: {
                          ...current[item.id],
                          returned: current[item.id]?.returned || "0",
                          dest: e.target.value as ReturnDest,
                        },
                      }))
                    }
                  >
                    {DEST_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              <Label>Notas do encerramento</Label>
              <Textarea className="min-h-[72px]" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} disabled={closed} />
            </div>
          </section>
        )}

        <div className="space-y-1.5 print:hidden">
          <Label>Observações da operação</Label>
          <Textarea className="min-h-[64px]" value={operationsNotes} onChange={(e) => setOperationsNotes(e.target.value)} disabled={closed} />
        </div>

        <footer className="mt-4 hidden justify-between border-t pt-3 text-xs print:flex">
          <span>Impresso em {new Date().toLocaleString("pt-BR")}</span>
          <strong>
            YOLO OS · {order.order_number}
          </strong>
        </footer>
      </article>

      {error && (
        <p className="mt-4 text-sm text-destructive print:hidden" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={() => navigate("/separacao")}>
          Voltar
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()} disabled={isSaving}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
        {!closed && queued && (
          <Button type="button" disabled={isSaving} onClick={() => void handleConfirm(false)}>
            {isSaving ? "Confirmando…" : "OK · programar"}
          </Button>
        )}
        {!closed && !queued && (
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => void handleConfirm(false)}>
            Salvar folha
          </Button>
        )}
        {!closed && showCloseOut && (
          <Button type="button" disabled={isSaving} onClick={() => void handleCloseOut()}>
            {isSaving ? "Encerrando…" : "Encerrar evento"}
          </Button>
        )}
      </div>
    </div>
  );
}
