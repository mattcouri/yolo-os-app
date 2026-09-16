import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckSquare, Printer, Square } from "lucide-react";
import { StageTag, sheetStageTag } from "@/components/separacao/stage-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { useAppStore } from "@/stores";
import { useAuthProfile } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { OrderItem, Profile, Vehicle } from "@/types/database";
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
  locationSummary,
  needsDeliveryDriver,
  needsPickup,
  needsPickupDriver,
  orderDeliveryAt,
  orderEventEnd,
  orderEnd,
  orderPickupAt,
  orderStart,
  toDateTimeLocal,
  tripSummary,
} from "@/lib/separacao";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

function itemMeta(item: OrderItem, kind: "saida" | "retorno") {
  const parts = [item.code];
  if (item.requested_state) parts.push(item.requested_state);
  const isKit = Boolean(item.asset_id || item.code.startsWith("UNI-"));
  if (kind === "saida" && isKit && !item.is_returnable) parts.push("fica na rua");
  return parts.filter(Boolean).join(" · ");
}

function printDateTime(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatSheetDate(date);
}

function ScreenField({
  label,
  printValue,
  children,
  className,
}: {
  label: string;
  printValue: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="print:text-[10px] print:uppercase print:text-muted-foreground">{label}</Label>
      <div className="mt-1.5 print:hidden">{children}</div>
      <p className="mt-0.5 hidden text-sm font-medium print:block">{printValue || "—"}</p>
    </div>
  );
}

function SignOff({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-auto border-t pt-3 print:pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="mt-2 grid grid-cols-[1fr_4.25rem_5rem] gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground">Nome</p>
          <div className="mt-6 border-b border-foreground/50" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Rubrica</p>
          <div className="mt-6 border-b border-foreground/50" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Data</p>
          <div className="mt-6 border-b border-foreground/50" />
        </div>
      </div>
    </div>
  );
}

function ChecklistTable({
  items,
  checkedIds,
  emptyLabel,
  disabled,
  onToggle,
  kind,
  numbered,
  staticUnchecked,
}: {
  items: OrderItem[];
  checkedIds: string[];
  emptyLabel: string;
  disabled?: boolean;
  onToggle?: (id: string) => void;
  kind: "saida" | "retorno";
  numbered?: boolean;
  staticUnchecked?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }
  const showNumbers = numbered;
  const showStatic = staticUnchecked && !numbered;
  return (
    <div className="overflow-hidden rounded-lg border print:rounded-md">
      <table className="w-full text-sm print:text-[11px]">
        <thead className="bg-muted">
          <tr>
            <th className="w-10 px-3 py-2 text-left print:px-2 print:py-1">{showNumbers ? "#" : "Ok"}</th>
            <th className="px-3 py-2 text-left print:px-2 print:py-1">Item</th>
            <th className="px-3 py-2 text-right print:px-2 print:py-1">Qtd</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const checked = !showStatic && checkedIds.includes(item.id);
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 print:px-2 print:py-1">
                  {showNumbers ? (
                    <span className="tabular-nums text-muted-foreground">{index + 1}</span>
                  ) : showStatic ? (
                    <Square className="h-5 w-5 text-muted-foreground/50" />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="print:hidden"
                        disabled={disabled || !onToggle || checked}
                        onClick={() => onToggle?.(item.id)}
                      >
                        {checked ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <span className="hidden print:inline">{checked ? "☑" : "☐"}</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 print:px-2 print:py-1">
                  <strong>{item.name}</strong>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{itemMeta(item, kind)}</p>
                </td>
                <td className="px-3 py-2 text-right print:px-2 print:py-1">
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

function VehicleSelect({
  value,
  onChange,
  vehicles,
  disabled,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  onRenamed,
}: {
  value: string;
  onChange: (value: string) => void;
  vehicles: Vehicle[];
  disabled?: boolean;
  createVehicle: (name: string) => Promise<Vehicle>;
  updateVehicle: (id: string, name: string) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  onRenamed?: (from: string, to: string) => void;
}) {
  return (
    <CreatableSelect
      value={value}
      onChange={onChange}
      options={vehicles.map((row) => ({ value: row.name, label: row.name }))}
      onCreateOption={async (label) => {
        const row = await createVehicle(label);
        return row.name;
      }}
      onEditOption={async (current, next) => {
        const row = vehicles.find((item) => item.name === current);
        if (!row) return;
        await updateVehicle(row.id, next);
        onRenamed?.(current, next);
      }}
      onDeleteOption={async (current) => {
        const row = vehicles.find((item) => item.name === current);
        if (!row) return;
        await deleteVehicle(row.id);
        if (value === current) onChange("");
      }}
      placeholder="Selecione o veículo..."
      createPlaceholder="Novo veículo..."
      disabled={disabled}
    />
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
    vehicles,
    updateSeparationJob,
    updateOrder,
    dispatchOrderItem,
    fetchVehicles,
    fetchStock,
    fetchMaterialStock,
    fetchAssets,
    createVehicle,
    updateVehicle,
    deleteVehicle,
  } = useAppStore();

  const order = orders.find((row) => row.id === orderId);
  const job = separationJobs.find((row) => row.order_id === orderId);
  const items = orderItems.filter((row) => row.order_id === orderId);
  const checkedItems = items.filter((item) => item.is_checked).map((item) => item.id);

  const [pendingSaidaIds, setPendingSaidaIds] = useState<string[]>([]);
  const [deliveryDriver, setDeliveryDriver] = useState(job?.delivery_driver || "");
  const [pickupDriver, setPickupDriver] = useState(job?.pickup_driver || "");
  const [vehicle, setVehicle] = useState(job?.vehicle || "");
  const [pickupVehicle, setPickupVehicle] = useState(job?.pickup_vehicle || "");
  const [departureAt, setDepartureAt] = useState(
    job?.departure_at ? toDateTimeLocal(new Date(job.departure_at)) : toDateTimeLocal(order ? orderStart(order) : null)
  );
  const [returnAt, setReturnAt] = useState(
    job?.return_at ? toDateTimeLocal(new Date(job.return_at)) : toDateTimeLocal(order ? orderEnd(order) : null)
  );
  const [operationsNotes, setOperationsNotes] = useState(job?.operations_notes || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    void fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    if (!job) return;
    setDeliveryDriver(job.delivery_driver || "");
    setPickupDriver(job.pickup_driver || "");
    setVehicle(job.vehicle || "");
    setPickupVehicle(job.pickup_vehicle || "");
    setDepartureAt(
      job.departure_at
        ? toDateTimeLocal(new Date(job.departure_at))
        : toDateTimeLocal(order ? orderStart(order) : null)
    );
    setReturnAt(
      job.return_at ? toDateTimeLocal(new Date(job.return_at)) : toDateTimeLocal(order ? orderEnd(order) : null)
    );
    setOperationsNotes(job.operations_notes || "");
    setPendingSaidaIds([]);
  }, [job?.id]);

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
  const deliveryDriverRequired = Boolean(order && needsDeliveryDriver(order));
  const pickupDriverRequired = Boolean(order && needsPickupDriver(order, items));
  const returnItems = useMemo(() => items.filter((item) => item.is_returnable), [items]);
  const closed = job ? isClosed(job) : false;
  const queued = job ? isQueued(job) : true;
  const inProgress = Boolean(job && job.stage === "na_rua");
  const programmed = Boolean(job && !closed && !queued && !inProgress);
  const saidaCheckedIds = [...new Set([...checkedItems, ...pendingSaidaIds])];

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

  const trip = tripSummary(order, items);

  const sheetLogistics = () => ({
    delivery_driver: deliveryDriverRequired ? deliveryDriver.trim() : deliveryDriver.trim() || "Não se aplica",
    pickup_driver: pickupDriverRequired ? pickupDriver.trim() : pickupDriver.trim() || "Não se aplica",
    vehicle: vehicle.trim() || null,
    pickup_vehicle: pickupVehicle.trim() || null,
    departure_at: new Date(departureAt).toISOString(),
    return_at: returnAt ? new Date(returnAt).toISOString() : null,
    operations_notes: operationsNotes.trim() || null,
  });

  const validateLogistics = () => {
    if (deliveryDriverRequired && !deliveryDriver.trim()) {
      setError("Informe quem faz a entrega.");
      return false;
    }
    if (pickupDriverRequired && !pickupDriver.trim()) {
      setError("Informe quem faz a coleta YOLO.");
      return false;
    }
    if (deliveryDriverRequired && !departureAt) {
      setError("Confirme o horário de saída / entrega.");
      return false;
    }
    if (pickupDriverRequired && !returnAt) {
      setError("Confirme o horário da coleta.");
      return false;
    }
    return true;
  };

  const handleConfirm = async () => {
    setError("");
    if (!validateLogistics()) return;

    setIsSaving(true);
    try {
      await updateSeparationJob(job.id, {
        ...sheetLogistics(),
        stage: "em_separacao",
      });
      await updateOrder(order.id, { status: "em_separacao" });
      navigate("/separacao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a folha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setError("");
    if (!validateLogistics()) return;

    setIsSaving(true);
    try {
      await updateSeparationJob(job.id, sheetLogistics());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as anotações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeparate = async () => {
    setError("");
    if (!validateLogistics()) return;

    setIsSaving(true);
    try {
      await updateSeparationJob(job.id, {
        ...sheetLogistics(),
        stage: "na_rua",
      });
      await updateOrder(order.id, { status: "na_rua" });
      navigate("/separacao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível separar a folha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaidaToggle = (itemId: string) => {
    if (closed || queued || programmed || !inProgress) return;
    const item = items.find((row) => row.id === itemId);
    if (!item || item.is_checked || pendingSaidaIds.includes(itemId)) return;
    setError("");
    setPendingSaidaIds((current) => [...current, itemId]);
  };

  const handleSaveAndPrint = async () => {
    setError("");
    if (!validateLogistics()) return;

    setIsSaving(true);
    try {
      await Promise.all([fetchStock(), fetchMaterialStock(), fetchAssets()]);
      for (const itemId of pendingSaidaIds) {
        await dispatchOrderItem(order.id, itemId);
      }
      setPendingSaidaIds([]);
      await updateSeparationJob(job.id, sheetLogistics());
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      window.print();
      navigate("/separacao");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a conferência.");
    } finally {
      setIsSaving(false);
    }
  };

  const deliveryPrintDriver = deliveryDriverRequired
    ? deliveryDriver.trim() || "—"
    : "Cliente no CD";
  const pickupPrintDriver = pickupDriverRequired
    ? pickupDriver.trim() && pickupDriver !== "Não se aplica"
      ? pickupDriver.trim()
      : "—"
    : pickupRequired
      ? "Cliente no CD"
      : "—";

  return (
    <div className="mx-auto max-w-3xl pb-16 md:max-w-5xl print:max-w-none print:pb-0">
      <Link
        to="/separacao"
        className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        Separação
      </Link>

      <article className="mt-4 rounded-2xl border bg-card p-5 print:mt-0 print:bg-white print:p-4">
        <header className="flex items-start justify-between gap-4 border-b pb-4 print:pb-3">
          <div>
            <p className="text-2xl font-black tracking-tight print:text-xl">
              YOLO <span className="text-sm font-semibold">OS</span>
            </p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Folha de Separação</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              {TYPE_LABEL[order.order_type] || order.order_type}
            </p>
            <h1 className="mt-2 text-xl font-bold print:mt-1 print:text-lg">{eventTitle(order)}</h1>
            <p className="text-sm font-medium">
              {trip.outbound}
              {trip.inbound ? ` · ${trip.inbound}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">{order.order_number}</p>
            <p className="mt-1 text-3xl font-black tabular-nums leading-none tracking-tight print:text-2xl">
              {formatEventDay(orderStart(order))}
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-muted-foreground">
              {formatEventWeekday(orderStart(order))}
              {formatEventTime(orderStart(order)) ? ` · ${formatEventTime(orderStart(order))}` : ""}
              {orderEventEnd(order) ? `–${formatEventTime(orderEventEnd(order))}` : ""}
            </p>
            <StageTag className="mt-2 px-2 py-0.5 text-[11px]" {...sheetStageTag({ closed, queued, inProgress })} />
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 border-b py-4 text-sm sm:grid-cols-2 print:gap-3 print:py-3">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Solicitante</p>
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
            <p className="text-[11px] uppercase text-muted-foreground">Endereço</p>
            <p className="font-medium">{locationSummary(order, items)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Data</p>
            <p className="font-medium">{formatSheetDate(orderStart(order))}</p>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <p className="text-[11px] uppercase text-muted-foreground">Observações do pedido</p>
              <p>{order.notes}</p>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 border-b py-4 text-sm sm:grid-cols-2 print:gap-3 print:py-3">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Logística</p>
            <p className="font-bold">
              Entrega · {FULFILL_LABEL[order.fulfillment] || trip.outbound} · {formatSheetDate(orderDeliveryAt(order))}
            </p>
            <p className="mt-1 font-bold">
              Coleta ·{" "}
              {pickupRequired && trip.inbound
                ? `${trip.inbound}${orderPickupAt(order) ? ` · ${formatSheetDate(orderPickupAt(order))}` : ""}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evento</p>
            <p className="font-normal">
              Início de Evento · {order.event_start ? formatSheetDate(orderStart(order)) : "—"}
            </p>
            <p className="mt-1 font-normal">
              Fim de Evento · {formatSheetDate(orderEventEnd(order))}
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2">
          <section className="flex flex-col border-b py-4 md:border-b-0 md:border-r md:pr-5 print:border-b-0 print:border-r print:py-3 print:pr-4">
            <h2 className="mb-3 text-base font-bold print:mb-2 print:text-sm">Entrega</h2>
            {deliveryDriverRequired ? (
              <div className="mb-4 grid grid-cols-1 gap-3 print:mb-2 print:gap-2">
                <ScreenField label="Motorista de saída" printValue={deliveryPrintDriver}>
                  <DriverSelect
                    value={deliveryDriver}
                    onChange={setDeliveryDriver}
                    people={people}
                    disabled={closed}
                  />
                </ScreenField>
                <ScreenField label="Data e hora da saída" printValue={printDateTime(departureAt)}>
                  <Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} disabled={closed} />
                </ScreenField>
                <ScreenField label="Veículo" printValue={vehicle.trim() || "—"}>
                  <VehicleSelect
                    value={vehicle}
                    onChange={setVehicle}
                    vehicles={vehicles}
                    disabled={closed}
                    createVehicle={createVehicle}
                    updateVehicle={updateVehicle}
                    deleteVehicle={deleteVehicle}
                    onRenamed={(from, to) => {
                      if (vehicle === from) setVehicle(to);
                      if (pickupVehicle === from) setPickupVehicle(to);
                    }}
                  />
                </ScreenField>
              </div>
            ) : (
              <div className="mb-4 space-y-3 print:mb-2">
                <p className="text-sm text-muted-foreground">
                  {trip.outbound}. Sem motorista nem veículo — o cliente vem ao CD.
                </p>
                <ScreenField label="Data e hora da saída" printValue={printDateTime(departureAt)} className="max-w-sm">
                  <Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} disabled={closed} />
                </ScreenField>
              </div>
            )}
            <h3 className="mb-1 text-sm font-semibold print:text-xs">
              {queued ? `Itens de saída · ${items.length}` : "Checklist de saída"}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground print:hidden">
              {queued
                ? "Quantidade de linhas neste pedido. A conferência entra depois de programar."
                : programmed
                  ? "Lista do que sai neste pedido. A conferência entra depois de separar."
                  : "Marque o que já saiu. Ao salvar e imprimir, o estoque é baixado e o ativo vai para a rua."}
            </p>
            <ChecklistTable
              kind="saida"
              numbered={queued}
              staticUnchecked={programmed}
              items={items}
              checkedIds={saidaCheckedIds}
              emptyLabel="Nenhum item neste pedido."
              disabled={closed || queued || programmed || isSaving}
              onToggle={inProgress ? handleSaidaToggle : undefined}
            />
            {!queued && <SignOff title="Visto do responsável" hint="Após o recebimento da carga." />}
          </section>

          <section className="flex flex-col py-4 md:pl-5 print:py-3 print:pl-4">
            <h2 className="mb-3 text-base font-bold print:mb-2 print:text-sm">Coleta</h2>
            {pickupRequired ? (
              <>
                {pickupDriverRequired ? (
                  <div className="mb-4 grid grid-cols-1 gap-3 print:mb-2 print:gap-2">
                    <ScreenField label="Motorista da coleta" printValue={pickupPrintDriver}>
                      <DriverSelect
                        value={pickupDriver === "Não se aplica" ? "" : pickupDriver}
                        onChange={setPickupDriver}
                        people={people}
                        disabled={closed}
                      />
                    </ScreenField>
                    <ScreenField label="Data e hora da coleta" printValue={printDateTime(returnAt)}>
                      <Input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} disabled={closed} />
                    </ScreenField>
                    <ScreenField label="Veículo" printValue={pickupVehicle.trim() || "—"}>
                      <VehicleSelect
                        value={pickupVehicle}
                        onChange={setPickupVehicle}
                        vehicles={vehicles}
                        disabled={closed}
                        createVehicle={createVehicle}
                        updateVehicle={updateVehicle}
                        deleteVehicle={deleteVehicle}
                        onRenamed={(from, to) => {
                          if (vehicle === from) setVehicle(to);
                          if (pickupVehicle === from) setPickupVehicle(to);
                        }}
                      />
                    </ScreenField>
                  </div>
                ) : (
                  <div className="mb-4 space-y-3 print:mb-2">
                    <p className="text-sm text-muted-foreground">
                      {trip.inbound || "Devolução no CD"}. Sem motorista nem veículo — o cliente devolve no CD.
                    </p>
                    <ScreenField label="Data e hora da coleta" printValue={printDateTime(returnAt)} className="max-w-sm">
                      <Input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} disabled={closed} />
                    </ScreenField>
                  </div>
                )}
                <h3 className="mb-1 text-sm font-semibold print:text-xs">
                  {queued ? `Itens de retorno · ${returnItems.length}` : "Checklist de retorno"}
                </h3>
                <p className="mb-3 text-xs text-muted-foreground print:hidden">
                  {queued
                    ? "Linhas que devem voltar. A conferência entra depois de programar."
                    : "O que deve voltar nesta coleta. A conferência de retorno entra numa etapa seguinte."}
                </p>
                <ChecklistTable
                  kind="retorno"
                  numbered={queued}
                  staticUnchecked={!queued}
                  items={returnItems}
                  checkedIds={[]}
                  emptyLabel="Nenhum item com volta nesta folha."
                  disabled
                />
                {!queued && <SignOff title="Visto do responsável" hint="Após a coleta da carga." />}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sem coleta neste pedido.</p>
                <div className="flex-1" />
              </>
            )}
          </section>
        </div>

        <div className="space-y-1.5 border-t pt-4 print:pt-3">
          <Label>Observações da operação</Label>
          <Textarea
            className="min-h-[64px] print:hidden"
            value={operationsNotes}
            onChange={(e) => setOperationsNotes(e.target.value)}
            disabled={closed}
          />
          <p className="hidden min-h-[2rem] text-sm print:block">{operationsNotes.trim() || "—"}</p>
        </div>

        <footer className="mt-4 hidden justify-between border-t pt-2 text-[10px] text-muted-foreground print:flex">
          <span>Impresso em {new Date().toLocaleString("pt-BR")}</span>
          <strong className="text-foreground">YOLO OS · {order.order_number}</strong>
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
        {!closed && queued && (
          <Button type="button" disabled={isSaving} onClick={() => void handleConfirm()}>
            {isSaving ? "Confirmando…" : "OK · programar"}
          </Button>
        )}
        {!closed && programmed && (
          <Button type="button" variant="outline" disabled={isSaving} onClick={() => void handleSaveNotes()}>
            {isSaving ? "Salvando…" : "Salvar anotações"}
          </Button>
        )}
        {!closed && programmed && (
          <Button type="button" disabled={isSaving} onClick={() => void handleSeparate()}>
            {isSaving ? "Separando…" : "Separar"}
          </Button>
        )}
        {!closed && inProgress && (
          <Button type="button" disabled={isSaving} onClick={() => void handleSaveAndPrint()}>
            <Printer className="mr-2 h-4 w-4" />
            {isSaving ? "Salvando…" : "Salvar e Imprimir"}
          </Button>
        )}
      </div>
    </div>
  );
}
