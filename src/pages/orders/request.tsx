import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Plus, Trash2, CheckCircle2, IceCream, Package, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddressSearch } from "@/components/ui/address-search";
import { TimeSelect } from "@/components/ui/time-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KitPicker, type UniformPick } from "@/components/orders/kit-picker";
import { useAppStore } from "@/stores";
import { useAuthProfile } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { FulfillmentMethod, OrderType, PhysicalState, Profile, UniformSize } from "@/types/database";
import { UNIFORM_SIZES } from "@/lib/uniforms";
import { checkoutStaysOut, availableForSizeOnWindow, equipmentBlock } from "@/lib/kit-availability";

const REQUEST_TYPES: { value: OrderType; label: string; hint: string }[] = [
  { value: "venda", label: "Venda", hint: "Cliente paga" },
  { value: "evento", label: "Evento", hint: "Com retorno" },
  { value: "amostra", label: "Amostra", hint: "Cortesia" },
  { value: "solicitacao_interna", label: "Interna", hint: "Uso YOLO" },
];

type LineKind = "pop" | "material";

interface OrderLine {
  id: string;
  kind: LineKind;
  productId: string;
  quantity: string;
  state: "" | PhysicalState;
}

const emptyLine = (kind: LineKind): OrderLine => ({
  id: crypto.randomUUID(),
  kind,
  productId: "",
  quantity: "",
  state: kind === "pop" ? "liquid" : "",
});

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function splitDateTime(value?: string | null) {
  const local = toLocalInput(value);
  if (!local) return { date: "", time: "" };
  return {
    date: local.slice(0, 10),
    time: local.length >= 16 ? local.slice(11, 16) : "",
  };
}

function joinDateTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

const DELIVERY_METHODS: { value: FulfillmentMethod; label: string }[] = [
  { value: "entrega_yolo", label: "Entrega YOLO" },
  { value: "retirada_yolo", label: "Retirada no CD" },
  { value: "uso_interno", label: "Uso interno" },
  { value: "transportadora", label: "Transportadora" },
];

const PICKUP_METHODS: { value: FulfillmentMethod; label: string }[] = [
  { value: "entrega_yolo", label: "Coleta YOLO" },
  { value: "retirada_yolo", label: "Devolução no CD" },
  { value: "uso_interno", label: "Não se aplica" },
  { value: "transportadora", label: "Transportadora" },
];

export function OrderRequestPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { profile } = useAuthProfile();
  const {
    products,
    assets,
    equipmentReservations,
    uniforms,
    uniformCheckouts,
    orders,
    orderItems,
    createOrder,
    updatePlacedOrder,
    fetchProducts,
    fetchAssets,
    fetchUniforms,
    fetchEquipmentReservations,
    fetchOrders,
  } = useAppStore();

  const pops = useMemo(
    () => products.filter((p) => p.kind === "pop" && p.is_active !== false),
    [products]
  );
  const materials = useMemo(
    () => products.filter((p) => p.kind === "material" && p.is_active !== false),
    [products]
  );
  const equipmentAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.is_active &&
          a.type !== "caixa_preta" &&
          a.type !== "caixa_media" &&
          a.type !== "caixa_grande" &&
          a.control_method !== "quantity"
      ),
    [assets]
  );

  const [orderType, setOrderType] = useState<OrderType>("venda");
  const [people, setPeople] = useState<Profile[]>([]);
  const [requesterId, setRequesterId] = useState(profile?.id || "");
  const [requesterName, setRequesterName] = useState(profile?.full_name || "");
  const [organization, setOrganization] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [neededDate, setNeededDate] = useState(tomorrowIso);
  const [neededTime, setNeededTime] = useState("10:00");
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("entrega_yolo");
  const [address, setAddress] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [pickupFulfillment, setPickupFulfillment] = useState<FulfillmentMethod>("entrega_yolo");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [returningAssetIds, setReturningAssetIds] = useState<string[]>([]);
  const [selectedUniforms, setSelectedUniforms] = useState<Record<string, UniformPick>>({});
  const [returningUniformIds, setReturningUniformIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [billable, setBillable] = useState<"yes" | "no">("yes");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  const editingOrder = orderId ? orders.find((row) => row.id === orderId) : undefined;
  const isEditing = Boolean(orderId);
  const isEvent = orderType === "evento";
  const isInternal = orderType === "solicitacao_interna";
  const needsAddress = fulfillment !== "uso_interno" && fulfillment !== "retirada_yolo";

  useEffect(() => {
    void fetchProducts();
    void fetchAssets();
    void fetchUniforms();
    void fetchEquipmentReservations();
    void fetchOrders();
  }, [fetchProducts, fetchAssets, fetchUniforms, fetchEquipmentReservations, fetchOrders]);

  useEffect(() => {
    if (profile?.id) {
      setRequesterId((current) => current || profile.id);
      setRequesterName((current) => current || profile.full_name);
    }
  }, [profile]);

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

  useEffect(() => {
    if (orderId) return;
    if (orderType === "venda") {
      setBillable("yes");
      setFulfillment("entrega_yolo");
    } else if (orderType === "evento") {
      setBillable("yes");
      setFulfillment("entrega_yolo");
    } else if (orderType === "amostra") {
      setBillable("no");
      setFulfillment("entrega_yolo");
    } else {
      setBillable("no");
      setFulfillment("uso_interno");
      setOrganization((current) => current || "YOLO");
    }
  }, [orderType, orderId]);

  const pickerReservations = useMemo(
    () => equipmentReservations.filter((row) => row.order_id !== orderId),
    [equipmentReservations, orderId]
  );
  const pickerCheckouts = useMemo(
    () => uniformCheckouts.filter((row) => row.order_id !== orderId),
    [uniformCheckouts, orderId]
  );
  const pickerAssets = useMemo(
    () =>
      equipmentAssets.map((asset) =>
        orderId &&
        asset.status === "in_use" &&
        orderItems.some((item) => item.order_id === orderId && item.asset_id === asset.id)
          ? { ...asset, status: "available" as const }
          : asset
      ),
    [equipmentAssets, orderId, orderItems]
  );

  const eventStart = joinDateTime(eventStartDate, eventStartTime);
  const eventEnd = joinDateTime(eventEndDate, eventEndTime);
  const pickupAt = joinDateTime(pickupDate, pickupTime);

  const reserveFrom = isEvent && eventStart ? eventStart : `${neededDate}T${neededTime || "08:00"}`;
  const reserveUntil =
    isEvent && (pickupAt || eventEnd) ? pickupAt || eventEnd : `${neededDate}T23:59`;

  useEffect(() => {
    if (!editingOrder || hydratedId === editingOrder.id) return;
    setOrderType(editingOrder.order_type);
    setRequesterId(editingOrder.requester_id || "");
    setRequesterName(editingOrder.requester_name);
    setOrganization(editingOrder.organization);
    setRecipient(editingOrder.recipient_name);
    setRecipientContact(editingOrder.recipient_contact);
    setRecipientEmail(editingOrder.recipient_email || "");
    setNeededDate(editingOrder.needed_date);
    setNeededTime(editingOrder.needed_time?.slice(0, 5) || "10:00");
    setFulfillment(editingOrder.fulfillment);
    setPickupFulfillment(editingOrder.pickup_fulfillment || "entrega_yolo");
    setAddress(editingOrder.address || "");
    setEventName(editingOrder.event_name || "");
    const start = splitDateTime(editingOrder.event_start);
    setEventStartDate(start.date);
    setEventStartTime(start.time);
    const end = splitDateTime(editingOrder.event_end);
    setEventEndDate(end.date);
    setEventEndTime(end.time);
    const pickup = splitDateTime(editingOrder.pickup_at);
    setPickupDate(pickup.date);
    setPickupTime(pickup.time);
    setNotes(editingOrder.notes || "");
    setBillable(editingOrder.billable === "no" ? "no" : "yes");
    const items = orderItems.filter((item) => item.order_id === editingOrder.id);
    setLines(
      items
        .filter((item) => item.product_id)
        .map((item) => {
          const product = products.find((row) => row.id === item.product_id);
          return {
            id: item.id,
            kind: (product?.kind === "material" ? "material" : "pop") as LineKind,
            productId: item.product_id || "",
            quantity: String(item.quantity),
            state: (item.requested_state || (product?.kind === "material" ? "" : "liquid")) as OrderLine["state"],
          };
        })
    );
    const equipment = items.filter((item) => item.asset_id);
    setSelectedAssetIds(equipment.map((item) => item.asset_id!));
    setReturningAssetIds(equipment.filter((item) => item.is_returnable).map((item) => item.asset_id!));
    const mine = uniformCheckouts.filter((row) => row.order_id === editingOrder.id && row.status === "out");
    const picks: Record<string, UniformPick> = {};
    const returning: string[] = [];
    for (const checkout of mine) {
      picks[checkout.uniform_id] = {
        ...picks[checkout.uniform_id],
        [checkout.size]: (picks[checkout.uniform_id]?.[checkout.size] || 0) + checkout.quantity,
      };
    }
    for (const uniformId of Object.keys(picks)) {
      if (mine.some((row) => row.uniform_id === uniformId && !checkoutStaysOut(row))) returning.push(uniformId);
    }
    setSelectedUniforms(picks);
    setReturningUniformIds(returning);
    setHydratedId(editingOrder.id);
  }, [editingOrder, hydratedId, orderItems, products, uniformCheckouts]);

  useEffect(() => {
    setSelectedAssetIds((current) => {
      const next = current.filter((id) => {
        const asset = pickerAssets.find((row) => row.id === id);
        return asset ? !equipmentBlock(asset, pickerReservations, reserveFrom, reserveUntil) : false;
      });
      if (next.length === current.length && next.every((id, index) => id === current[index])) return current;
      return next;
    });
    setReturningAssetIds((current) =>
      current.filter((id) => {
        const asset = pickerAssets.find((row) => row.id === id);
        return asset ? !equipmentBlock(asset, pickerReservations, reserveFrom, reserveUntil) : false;
      })
    );
    setSelectedUniforms((current) => {
      const next: Record<string, UniformPick> = {};
      for (const [uniformId, pick] of Object.entries(current)) {
        const uniform = uniforms.find((row) => row.id === uniformId);
        if (!uniform) continue;
        const kept: UniformPick = {};
        for (const size of UNIFORM_SIZES) {
          const qty = pick[size] || 0;
          if (qty <= 0) continue;
          const available = availableForSizeOnWindow(
            uniform,
            size,
            pickerCheckouts,
            orders,
            reserveFrom,
            reserveUntil
          );
          if (available > 0) kept[size] = Math.min(qty, available);
        }
        if (Object.keys(kept).length) next[uniformId] = kept;
      }
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((id) => JSON.stringify(current[id]) === JSON.stringify(next[id]))
      ) {
        return current;
      }
      return next;
    });
  }, [reserveFrom, reserveUntil, pickerAssets, pickerReservations, uniforms, pickerCheckouts, orders]);

  const addLine = (kind: LineKind) => {
    const line = emptyLine(kind);
    if (kind === "pop") line.productId = pops[0]?.id || "";
    if (kind === "material") line.productId = materials[0]?.id || "";
    setLines((current) => [...current, line]);
  };

  const updateLine = (id: string, patch: Partial<OrderLine>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!requesterName.trim()) {
      setError("Selecione o solicitante.");
      return;
    }
    if (!organization.trim() || !recipient.trim() || !recipientContact.trim()) {
      setError("Preencha empresa, quem recebe e o contato.");
      return;
    }
    if (!neededDate || !neededTime) {
      setError("Informe o dia e o horário.");
      return;
    }
    if (needsAddress && !address.trim()) {
      setError("Informe o endereço no Maps.");
      return;
    }
    if (isEvent && (!eventName.trim() || !eventStart || !eventEnd)) {
      setError("Evento precisa de nome, início (dia e hora) e fim (dia e hora).");
      return;
    }
    if (isEvent && !pickupAt) {
      setError("Informe o dia e a hora da retirada.");
      return;
    }
    const equipmentIds = selectedAssetIds.filter((id) => {
      const asset = pickerAssets.find((row) => row.id === id);
      return asset && !equipmentBlock(asset, pickerReservations, reserveFrom, reserveUntil);
    });
    const uniformLines: { uniform_id: string; size: UniformSize; quantity: number; returns: boolean }[] = [];
    for (const [uniformId, pick] of Object.entries(selectedUniforms)) {
      const uniform = uniforms.find((row) => row.id === uniformId);
      if (!uniform) continue;
      for (const size of UNIFORM_SIZES) {
        const qty = pick[size] || 0;
        if (qty <= 0) continue;
        const available = availableForSizeOnWindow(
          uniform,
          size,
          pickerCheckouts,
          orders,
          reserveFrom,
          reserveUntil
        );
        if (qty > available) {
          setError(`${uniform.name} ${size}: só há ${available} disponível${available === 1 ? "" : "is"} nesta data.`);
          return;
        }
        uniformLines.push({
          uniform_id: uniform.id,
          size,
          quantity: qty,
          returns: returningUniformIds.includes(uniform.id),
        });
      }
    }

    if (lines.length === 0 && equipmentIds.length === 0 && uniformLines.length === 0) {
      setError("Adicione um SKU ou marque um equipamento / uniforme.");
      return;
    }

    const items: {
      product_id?: string;
      asset_id?: string;
      name: string;
      code: string;
      quantity: number;
      unit: string;
      requested_state?: PhysicalState;
      is_returnable: boolean;
    }[] = [];

    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Informe quantidade válida em todos os SKUs.");
        return;
      }
      const product = products.find((p) => p.id === line.productId);
      if (!product) {
        setError("Selecione um SKU ou material válido.");
        return;
      }
      items.push({
        product_id: product.id,
        name: product.flavor || product.name,
        code: product.code,
        quantity: qty,
        unit: product.unit || "un",
        requested_state: line.kind === "pop" ? line.state || "liquid" : undefined,
        is_returnable: false,
      });
    }

    for (const assetId of equipmentIds) {
      const asset = equipmentAssets.find((row) => row.id === assetId);
      if (!asset) continue;
      items.push({
        asset_id: asset.id,
        name: asset.name,
        code: asset.code,
        quantity: 1,
        unit: "un",
        is_returnable: returningAssetIds.includes(asset.id),
      });
    }

    for (const line of uniformLines) {
      const uniform = uniforms.find((row) => row.id === line.uniform_id);
      items.push({
        name: `${uniform?.name || "Uniforme"} · ${line.size}`,
        code: `UNI-${line.size}`,
        quantity: line.quantity,
        unit: "un",
        is_returnable: line.returns,
      });
    }

    setIsSubmitting(true);
    try {
      const payload = {
        requester_id: requesterId || undefined,
        requester_name: requesterName.trim(),
        organization: organization.trim(),
        recipient_name: recipient.trim(),
        recipient_contact: recipientContact.trim(),
        recipient_email: recipientEmail.trim() || undefined,
        order_type: orderType,
        needed_date: neededDate,
        needed_time: neededTime,
        fulfillment,
        pickup_fulfillment: isEvent ? pickupFulfillment : undefined,
        address: needsAddress ? address.trim() : undefined,
        event_name: isEvent ? eventName.trim() : undefined,
        event_start: isEvent ? eventStart : undefined,
        event_end: isEvent ? eventEnd : undefined,
        pickup_at: isEvent ? pickupAt || undefined : undefined,
        onsite_contact: isEvent ? recipientContact.trim() : undefined,
        reserve_from: equipmentIds.length || uniformLines.length ? reserveFrom : undefined,
        reserve_until: equipmentIds.length || uniformLines.length ? reserveUntil : undefined,
        billable,
        no_charge_reason: billable === "yes" ? undefined : orderType === "amostra" ? "Amostra" : isInternal ? "Uso interno" : "Evento",
        notes: notes.trim() || undefined,
        items,
        equipment_ids: equipmentIds.length ? equipmentIds : undefined,
        returning_equipment_ids: equipmentIds.filter((id) => returningAssetIds.includes(id)),
        uniforms: uniformLines.length ? uniformLines : undefined,
      };
      const order =
        isEditing && orderId ? await updatePlacedOrder(orderId, payload) : await createOrder(payload);
      navigate("/pedidos/lista", {
        state: {
          toast: isEditing
            ? `${order.order_number} atualizado.`
            : `${order.order_number} enviado para Separação.`,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o pedido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderId && orders.length > 0 && !editingOrder) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Link to="/pedidos/lista" className="text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <Link to="/pedidos/lista" className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" />
        Acompanhar
      </Link>
      <div className="py-5">
        <h1 className="text-2xl font-bold md:text-3xl">
          {isEditing ? `Editar ${editingOrder?.order_number || "pedido"}` : "Nova solicitação"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEditing
            ? "O mesmo ID permanece. Alterações vão para Separação."
            : "Entra direto no quadro de Separação. Estoque só sai quando Operações conferir."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REQUEST_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setOrderType(type.value)}
                  className={`rounded-xl border px-2 py-2.5 text-left transition ${
                    orderType === type.value ? "border-primary bg-primary/10" : "hover:border-primary/40"
                  }`}
                >
                  <span className="block text-sm font-semibold">{type.label}</span>
                  <span className="text-[11px] text-muted-foreground">{type.hint}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Solicitante</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={requesterId || requesterName}
                  onChange={(e) => {
                    const person = people.find((row) => row.id === e.target.value);
                    setRequesterId(person?.id || "");
                    setRequesterName(person?.full_name || e.target.value);
                  }}
                  required
                >
                  <option value="">Selecione</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                  {profile && !people.some((row) => row.id === profile.id) && (
                    <option value={profile.id}>{profile.full_name}</option>
                  )}
                </select>
              </div>
              {(orderType === "venda" || isEvent) && (
                <div className="space-y-1.5">
                  <Label>Cobrar o cliente?</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={billable}
                    onChange={(e) => setBillable(e.target.value as "yes" | "no")}
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quem recebe</p>
            {isEvent && (
              <div className="space-y-1.5">
                <Label>Nome do evento</Label>
                <Input value={eventName} onChange={(e) => setEventName(e.target.value)} required={isEvent} />
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pessoa de contato</Label>
                <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Input value={organization} onChange={(e) => setOrganization(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp / telefone</Label>
                <Input value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
              </div>
            </div>
            {isEvent && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Início · dia</Label>
                  <Input type="date" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} required={isEvent} />
                </div>
                <div className="space-y-1.5">
                  <Label>Início · hora</Label>
                  <TimeSelect value={eventStartTime} onChange={setEventStartTime} required={isEvent} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim · dia</Label>
                  <Input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} required={isEvent} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim · hora</Label>
                  <TimeSelect value={eventEndTime} onChange={setEventEndTime} required={isEvent} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes de Entrega</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Entrega</Label>
                <select
                  className={selectClass}
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value as FulfillmentMethod)}
                >
                  {DELIVERY_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Dia</Label>
                <Input type="date" min={tomorrowIso()} value={neededDate} onChange={(e) => setNeededDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Hora</Label>
                <TimeSelect value={neededTime} onChange={setNeededTime} required />
              </div>
            </div>
            {isEvent && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Retirada</Label>
                  <select
                    className={selectClass}
                    value={pickupFulfillment}
                    onChange={(e) => setPickupFulfillment(e.target.value as FulfillmentMethod)}
                  >
                    {PICKUP_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dia</Label>
                  <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required={isEvent} />
                </div>
                <div className="space-y-1.5">
                  <Label>Hora</Label>
                  <TimeSelect value={pickupTime} onChange={setPickupTime} required={isEvent} />
                </div>
              </div>
            )}
            {needsAddress && <AddressSearch value={address} onChange={setAddress} required />}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que vai · SKUs</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addLine("pop")}>
                  <IceCream className="mr-1 h-3.5 w-3.5" />
                  SKU
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addLine("material")}>
                  <Package className="mr-1 h-3.5 w-3.5" />
                  Material
                </Button>
              </div>
            </div>

            {lines.length === 0 && (
              <p className="py-5 text-center text-sm text-muted-foreground">Inclua os pops e materiais desta solicitação.</p>
            )}

            <div className="space-y-2">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_auto_auto] items-end gap-2 rounded-lg border p-2 sm:grid-cols-[72px_1fr_auto_auto_auto]"
                >
                  <Badge variant="secondary" className="hidden h-8 justify-center sm:flex">
                    {line.kind === "pop" ? "SKU" : "Mat."}
                  </Badge>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={line.productId}
                    onChange={(e) => updateLine(line.id, { productId: e.target.value })}
                  >
                    <option value="">Selecionar</option>
                    {(line.kind === "pop" ? pops : materials).map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.code} · {product.flavor || product.name}
                      </option>
                    ))}
                  </select>
                  {line.kind === "pop" ? (
                    <select
                      className="h-9 w-[108px] rounded-md border border-input bg-background px-2 text-sm"
                      value={line.state}
                      onChange={(e) => updateLine(line.id, { state: e.target.value as PhysicalState })}
                    >
                      <option value="liquid">Líquido</option>
                      <option value="frozen">Congelado</option>
                    </select>
                  ) : (
                    <span className="hidden w-[108px] sm:block" />
                  )}
                  <Input
                    type="number"
                    min="1"
                    className="h-9 w-20"
                    placeholder="Qtd"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que vai · kit</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Marque vai para o que sai. Volta fica ligado por padrão; desmarque se o item permanece com o destinatário — entra em Relatórios → Ativos na rua.
              </p>
            </div>
            <KitPicker
              assets={pickerAssets}
              uniforms={uniforms}
              reservations={pickerReservations}
              checkouts={pickerCheckouts}
              orders={orders}
              reserveFrom={reserveFrom}
              reserveUntil={reserveUntil}
              selectedAssetIds={selectedAssetIds}
              returningAssetIds={returningAssetIds}
              onToggleAsset={(id, next) => {
                setSelectedAssetIds((current) => (next ? [...current, id] : current.filter((row) => row !== id)));
                setReturningAssetIds((current) =>
                  next ? (current.includes(id) ? current : [...current, id]) : current.filter((row) => row !== id)
                );
              }}
              onToggleAssetReturn={(id, next) => {
                setReturningAssetIds((current) =>
                  next ? (current.includes(id) ? current : [...current, id]) : current.filter((row) => row !== id)
                );
                if (next) {
                  setSelectedAssetIds((current) => (current.includes(id) ? current : [...current, id]));
                }
              }}
              selectedUniforms={selectedUniforms}
              returningUniformIds={returningUniformIds}
              onChangeUniform={(id, next) => {
                const hasQty = Boolean(next && Object.values(next).some((qty) => (qty || 0) > 0));
                const alreadyGoing = Boolean(selectedUniforms[id]);
                setSelectedUniforms((current) => {
                  const copy = { ...current };
                  if (!hasQty) delete copy[id];
                  else copy[id] = next!;
                  return copy;
                });
                setReturningUniformIds((current) => {
                  if (!hasQty) return current.filter((row) => row !== id);
                  if (alreadyGoing) return current;
                  return current.includes(id) ? current : [...current, id];
                });
              }}
              onToggleUniformReturn={(id, next) => {
                setReturningUniformIds((current) =>
                  next ? (current.includes(id) ? current : [...current, id]) : current.filter((row) => row !== id)
                );
              }}
            />
            <div className="space-y-1.5 pt-1">
              <Label>Observações para Operações</Label>
              <Textarea
                className="min-h-[72px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Embalagem, acesso, o que volta…"
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/pedidos/lista")}>
            Voltar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : isEditing ? "Salvar pedido" : "Enviar para Separação"}
          </Button>
        </div>
      </form>
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  received: "Recebido",
  a_separar: "A separar",
  em_separacao: "Em separação",
  na_rua: "Na rua",
  retorno: "Retorno",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const TYPE_LABEL: Record<string, string> = {
  venda: "Venda",
  evento: "Evento",
  amostra: "Amostra",
  solicitacao_interna: "Interna",
};

export function OrderListPage() {
  const { orders, orderItems, separationJobs, cancelPlacedOrder } = useAppStore();
  const location = useLocation();
  const toast = (location.state as { toast?: string } | null)?.toast;
  const [deleting, setDeleting] = useState<(typeof orders)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = orders.filter((order) => order.status !== "cancelled");

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await cancelPlacedOrder(deleting.id);
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <Link to="/pedidos" className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" />
        Pedidos
      </Link>
      <div className="flex items-center justify-between py-5">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Acompanhar</h1>
          <p className="mt-1 text-sm text-muted-foreground">O mesmo ID segue até o retorno em Separação. Dá para editar ou excluir o que foi colocado.</p>
        </div>
        <Button asChild>
          <Link to="/pedidos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Link>
        </Button>
      </div>
      {toast && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{toast}</p>
      )}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Nenhum pedido ainda.</p>
            <Button asChild className="mt-4">
              <Link to="/pedidos/novo">Criar o primeiro</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((order) => {
            const items = orderItems.filter((item) => item.order_id === order.id);
            const job = separationJobs.find((row) => row.order_id === order.id);
            const checked = items.filter((item) => item.is_checked).length;
            return (
              <div
                key={order.id}
                className="flex items-center gap-2 rounded-xl border p-3 hover:border-primary/40"
              >
                <Link to={`/separacao/${order.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {order.order_number} · {TYPE_LABEL[order.order_type] || order.order_type} · {order.organization}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(`${order.needed_date}T00:00:00`).toLocaleDateString("pt-BR")} · {order.needed_time} · {checked}/{items.length} conferidos
                    {job?.delivery_driver ? ` · ${job.delivery_driver}` : ""}
                  </p>
                </Link>
                <Badge variant={job?.stage === "na_rua" ? "secondary" : "outline"}>
                  {STAGE_LABEL[job?.stage || order.status] || order.status}
                </Badge>
                <Button asChild variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Editar">
                  <Link to={`/pedidos/${order.id}/editar`} onClick={(e) => e.stopPropagation()}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Editar {order.order_number}</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                  title="Excluir"
                  onClick={() => {
                    setError("");
                    setDeleting(order);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Excluir {order.order_number}</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {deleting?.order_number}?</DialogTitle>
            <DialogDescription>
              Sai da lista e da fila. Libera equipamentos e uniformes deste pedido no sistema. O ID fica cancelado no histórico.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleting(null)}>
              Manter
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
              {busy ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
