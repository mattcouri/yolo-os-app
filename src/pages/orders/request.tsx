import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";
import type { OrderType, FulfillmentMethod, PhysicalState } from "@/types/database";

const orderTypes: { value: OrderType; label: string }[] = [
  { value: "venda", label: "Venda" },
  { value: "evento", label: "Evento" },
  { value: "amostra", label: "Amostra" },
  { value: "solicitacao_interna", label: "Solicitação interna" },
  { value: "consignacao", label: "Consignação / reposição" },
  { value: "emprestimo_equipamentos", label: "Empréstimo de equipamentos" },
  { value: "troca_devolucao", label: "Troca / devolução" },
  { value: "doacao_patrocinio", label: "Doação / patrocínio" },
  { value: "material_promocional", label: "Material promocional" },
  { value: "outro", label: "Outro" },
];

const fulfillmentMethods: { value: FulfillmentMethod; label: string }[] = [
  { value: "entrega_yolo", label: "Entrega YOLO" },
  { value: "retirada_yolo", label: "Retirada em YOLO" },
  { value: "uso_interno", label: "Uso dentro da YOLO" },
  { value: "transportadora", label: "Transportadora / terceiro" },
];

interface OrderItem {
  id: string;
  productId: string;
  quantity: string;
  state: string;
}

export function OrderRequestPage() {
  const navigate = useNavigate();
  const { products, assets, equipmentReservations, createOrder } = useAppStore();

  const popProducts = products.filter((p) => p.kind === "pop");
  const materialProducts = products.filter((p) => p.kind === "material");
  const equipmentProducts = products.filter((p) => p.kind === "equipment_service");
  const allProducts = [...popProducts, ...materialProducts, ...equipmentProducts];

  const equipmentAssets = assets.filter(
    (a) => a.type === "freezer" || a.type === "carrinho"
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const [requester, setRequester] = useState("");
  const [organization, setOrganization] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientContact, setRecipientContact] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  const [orderType, setOrderType] = useState<OrderType>("venda");
  const [neededDate, setNeededDate] = useState(tomorrowStr);
  const [neededTime, setNeededTime] = useState("");
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>("entrega_yolo");
  const [address, setAddress] = useState("");

  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [onsiteContact, setOnsiteContact] = useState("");
  const [audience, setAudience] = useState("");

  const [reserveFrom, setReserveFrom] = useState("");
  const [reserveUntil, setReserveUntil] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const [items, setItems] = useState<OrderItem[]>([
    { id: "1", productId: popProducts[0]?.id || "", quantity: "1", state: "" },
  ]);
  const [itemNotes, setItemNotes] = useState("");

  const [reference, setReference] = useState("");
  const [returnDescription, setReturnDescription] = useState("");

  const [paymentTerms, setPaymentTerms] = useState("À vista");
  const [billable, setBillable] = useState<"yes" | "no" | "review">("yes");
  const [noChargeReason, setNoChargeReason] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEvent = orderType === "evento";
  const isEquipmentLoan = orderType === "emprestimo_equipamentos";
  const isReturn = orderType === "troca_devolucao";
  const showEquipmentSection = isEvent || isEquipmentLoan;

  const addItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        productId: popProducts[0]?.id || "",
        quantity: "1",
        state: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof OrderItem, value: string) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const getProduct = (productId: string) => allProducts.find((p) => p.id === productId);

  const hasConflict = (assetId: string) => {
    if (!reserveFrom || !reserveUntil) return false;
    return equipmentReservations.some(
      (r) =>
        r.asset_id === assetId &&
        r.status === "active" &&
        reserveFrom < r.reserved_until &&
        reserveUntil > r.reserved_from
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!requester) {
      setError("Selecione o solicitante YOLO.");
      return;
    }

    if (!organization.trim() || !recipient.trim() || !recipientContact.trim()) {
      setError("Preencha o destinatário e o contato de entrega.");
      return;
    }

    if (!neededDate || !neededTime.trim()) {
      setError("Informe a data e a janela de entrega.");
      return;
    }

    if (items.length === 0) {
      setError("Adicione pelo menos um item.");
      return;
    }

    if (fulfillment !== "uso_interno" && !address.trim()) {
      setError("Informe o endereço completo.");
      return;
    }

    if (isEvent && (!eventName || !eventStart || !eventEnd || !pickupAt || !onsiteContact)) {
      setError("Complete os horários e o contato do evento.");
      return;
    }

    if (showEquipmentSection && selectedEquipment.length > 0) {
      if (!reserveFrom || !reserveUntil || reserveFrom >= reserveUntil) {
        setError("Informe um período válido para reservar os equipamentos.");
        return;
      }
    }

    if (isReturn && !reference.trim()) {
      setError("Informe o pedido, nota ou evento de origem.");
      return;
    }

    if (billable !== "yes" && !noChargeReason.trim()) {
      setError("Explique o motivo ou informe o centro de custo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = items.map((item) => {
        const product = getProduct(item.productId);
        return {
          product_id: item.productId,
          name: product?.name || "",
          code: product?.code || "",
          quantity: Number(item.quantity),
          unit: product?.unit || "un",
          requested_state: (item.state || undefined) as PhysicalState | undefined,
          is_returnable: false,
        };
      });

      for (const assetId of selectedEquipment) {
        const asset = equipmentAssets.find((a) => a.id === assetId);
        orderItems.push({
          product_id: undefined,
          asset_id: assetId,
          name: asset?.name || "",
          code: asset?.code || "",
          quantity: 1,
          unit: "un",
          requested_state: undefined,
          is_returnable: true,
        } as any);
      }

      const order = await createOrder({
        requester_name: requester,
        organization: organization.trim(),
        recipient_name: recipient.trim(),
        recipient_contact: recipientContact.trim(),
        recipient_email: recipientEmail.trim() || undefined,
        order_type: orderType,
        needed_date: neededDate,
        needed_time: neededTime.trim(),
        fulfillment,
        address: address.trim() || undefined,
        event_name: eventName.trim() || undefined,
        event_start: eventStart || undefined,
        event_end: eventEnd || undefined,
        pickup_at: pickupAt || undefined,
        onsite_contact: onsiteContact.trim() || undefined,
        audience: audience ? Number(audience) : undefined,
        reserve_from: reserveFrom || undefined,
        reserve_until: reserveUntil || undefined,
        payment_terms: paymentTerms,
        billable,
        no_charge_reason: noChargeReason.trim() || undefined,
        reference: reference.trim() || undefined,
        return_description: returnDescription.trim() || undefined,
        item_notes: itemNotes.trim() || undefined,
        notes: notes.trim() || undefined,
        items: orderItems,
        equipment_ids: selectedEquipment.length > 0 ? selectedEquipment : undefined,
      });

      navigate("/orders/success", { state: { order } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Pedidos
      </Link>

      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          NOVA SOLICITAÇÃO
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">
          Pedido para Operações
        </h1>
        <p className="text-muted-foreground mt-1">
          Preencha quem solicita, quem recebe, o que precisa e quando.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg">1. Solicitante YOLO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label>Quem está solicitando?</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={requester}
                onChange={(e) => setRequester(e.target.value)}
                required
              >
                <option value="">Selecione a pessoa</option>
                <option>Comercial · usuário demo</option>
                <option>Operações · usuário demo</option>
                <option>Gestão · usuário demo</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Esta é a pessoa interna responsável pelo pedido.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Destinatário e contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cliente, empresa ou área</Label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quem vai receber?</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={recipientContact}
                  onChange={(e) => setRecipientContact(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail do destinatário</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Tipo e entrega</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo de pedido</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                >
                  {orderTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Data de entrega / retirada</Label>
                <Input
                  type="date"
                  min={tomorrowStr}
                  value={neededDate}
                  onChange={(e) => setNeededDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Janela de entrega</Label>
                <Input
                  placeholder="Ex.: 09h–12h"
                  value={neededTime}
                  onChange={(e) => setNeededTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Como será atendido?</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value as FulfillmentMethod)}
                >
                  {fulfillmentMethods.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              {fulfillment !== "uso_interno" && (
                <div className="space-y-2">
                  <Label>Endereço completo</Label>
                  <Input
                    placeholder="Rua, número, complemento, cidade"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isEvent && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-lg">4. Dados do evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nome do evento</Label>
                  <Input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Início do evento</Label>
                  <Input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim do evento</Label>
                  <Input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retirada no local</Label>
                  <Input
                    type="datetime-local"
                    value={pickupAt}
                    onChange={(e) => setPickupAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contato no local</Label>
                  <Input
                    value={onsiteContact}
                    onChange={(e) => setOnsiteContact(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Público estimado</Label>
                  <Input
                    type="number"
                    min="0"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isEvent ? "5" : "4"}. Itens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => {
              const product = getProduct(item.productId);
              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end border-b pb-4"
                >
                  <div className="space-y-2">
                    <Label>Item</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={item.productId}
                      onChange={(e) => updateItem(item.id, "productId", e.target.value)}
                    >
                      {allProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      className="w-24"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={item.state}
                      onChange={(e) => updateItem(item.id, "state", e.target.value)}
                    >
                      <option value="">Não se aplica</option>
                      <option value="liquid">Líquido</option>
                      <option value="frozen">Congelado</option>
                    </select>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar item
            </Button>
            <div className="space-y-2">
              <Label>Instruções de separação ou embalagem</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                placeholder="Ex.: sabores variados; 300 pops congelados; caixa com encarte"
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {showEquipmentSection && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-lg">Equipamentos do evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Todos os equipamentos aparecem. Os já reservados no período ficam
                esmaecidos e não podem ser escolhidos.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reservar de</Label>
                  <Input
                    type="datetime-local"
                    value={reserveFrom}
                    onChange={(e) => setReserveFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reservar até</Label>
                  <Input
                    type="datetime-local"
                    value={reserveUntil}
                    onChange={(e) => setReserveUntil(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Inclua o horário previsto de retirada ou devolução.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {equipmentAssets.map((asset) => {
                  const conflict = hasConflict(asset.id);
                  const isSelected = selectedEquipment.includes(asset.id);
                  return (
                    <label
                      key={asset.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                        conflict ? "opacity-50 cursor-not-allowed" : ""
                      } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        disabled={conflict}
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEquipment([...selectedEquipment, asset.id]);
                          } else {
                            setSelectedEquipment(
                              selectedEquipment.filter((id) => id !== asset.id)
                            );
                          }
                        }}
                        className="mt-1"
                      />
                      <div>
                        <strong className="text-sm">{asset.name}</strong>
                        <p className="text-xs text-muted-foreground">
                          {asset.code} · {asset.type}
                          <br />
                          {conflict ? "Reservado no período" : "Disponível no período"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {isReturn && (
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="text-lg">Referência da troca ou devolução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pedido / nota / evento de origem</Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>O que deve voltar?</Label>
                  <Input
                    value={returnDescription}
                    onChange={(e) => setReturnDescription(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Condição comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição de pagamento</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                >
                  <option>À vista</option>
                  <option>7 dias</option>
                  <option>14 dias</option>
                  <option>28 dias</option>
                  <option>Consignação</option>
                  <option>Cortesia / sem cobrança</option>
                  <option>Confirmar com Comercial</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Será cobrado do cliente?</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={billable}
                  onChange={(e) => setBillable(e.target.value as "yes" | "no" | "review")}
                >
                  <option value="yes">Sim</option>
                  <option value="no">Não</option>
                  <option value="review">Precisa confirmar</option>
                </select>
              </div>
            </div>
            {billable !== "yes" && (
              <div className="space-y-2">
                <Label>Motivo / centro de custo</Label>
                <Input
                  placeholder="Amostra, marketing, equipe, patrocínio..."
                  value={noChargeReason}
                  onChange={(e) => setNoChargeReason(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Observações e arquivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Observações finais</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                placeholder="Inclua tudo que Operações precisa saber"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="bg-primary/10 text-sm rounded-lg p-4 border border-primary/20">
          <strong>O pedido entra diretamente na fila de Operações.</strong>
          <p className="text-muted-foreground mt-1">
            Equipamentos selecionados ficam reservados no período informado. Itens
            indisponíveis não podem ser selecionados.
          </p>
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button type="button" variant="outline" onClick={() => navigate("/orders")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar pedido"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function OrderListPage() {
  const { orders, orderItems, separationJobs, products, assets } = useAppStore();

  const getOrderItems = (orderId: string) =>
    orderItems.filter((i) => i.order_id === orderId);

  const getSeparationJob = (orderId: string) =>
    separationJobs.find((j) => j.order_id === orderId);

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Pedidos
      </Link>

      <div className="flex items-center justify-between py-6">
        <div>
          <span className="text-xs font-semibold text-primary tracking-wider uppercase">
            ACOMPANHAMENTO
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">Pedidos</h1>
          <p className="text-muted-foreground mt-1">
            A mesma ordem acompanha solicitação, separação, entrega e retorno.
          </p>
        </div>
        <Link to="/orders/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo pedido
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          {orders.length > 0 ? (
            <div className="space-y-2">
              {orders.map((order) => {
                const items = getOrderItems(order.id);
                const job = getSeparationJob(order.id);
                const checkedCount = items.filter((i) => i.is_checked).length;
                return (
                  <Link
                    key={order.id}
                    to={`/separation/${order.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <strong className="text-sm">
                        {order.order_number} · {order.order_type} · {order.organization}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {order.needed_date} · {order.needed_time} · {checkedCount}/{items.length}{" "}
                        separados
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Entrega: {job?.delivery_driver || "Pendente"} · Retirada:{" "}
                        {job?.pickup_driver || "Pendente"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        order.status === "completed"
                          ? "default"
                          : order.status === "na_rua"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {order.status === "received"
                        ? "Recebido"
                        : order.status === "a_separar"
                        ? "A separar"
                        : order.status === "em_separacao"
                        ? "Em separação"
                        : order.status === "na_rua"
                        ? "Na rua"
                        : order.status === "retorno"
                        ? "Retorno"
                        : order.status === "completed"
                        ? "Concluído"
                        : order.status}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Nenhum pedido aberto.</p>
              <Link to="/orders/new">
                <Button className="mt-4">Criar primeiro pedido</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
