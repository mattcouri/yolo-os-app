import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Printer, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";
import type { SeparationStage } from "@/types/database";

const stages: SeparationStage[] = ["a_separar", "em_separacao", "na_rua", "retorno"];

const stageLabels: Record<SeparationStage, string> = {
  a_separar: "A separar",
  em_separacao: "Em separação",
  na_rua: "Na rua",
  retorno: "Retorno",
};

const stageTones: Record<SeparationStage, string> = {
  a_separar: "border-t-muted-foreground",
  em_separacao: "border-t-yellow-500",
  na_rua: "border-t-blue-500",
  retorno: "border-t-purple-500",
};

const deliveryPeople = [
  "",
  "Carlos · motorista demo",
  "Mariana · operações demo",
  "Transportadora parceira",
  "Solicitante fará o transporte",
  "Cliente fará a retirada",
  "Sem retirada",
];

export function SeparationBoardPage() {
  const { orders, orderItems, separationJobs } = useAppStore();

  const getOrderInfo = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    const job = separationJobs.find((j) => j.order_id === orderId);
    const items = orderItems.filter((i) => i.order_id === orderId);
    const checkedCount = items.filter((i) => i.is_checked).length;
    return { order, job, items, checkedCount };
  };

  const jobsByStage = stages.map((stage) => ({
    stage,
    jobs: separationJobs.filter((j) => j.stage === stage),
  }));

  return (
    <div className="max-w-[1540px] mx-auto pb-12">
      <Link
        to="/operations/actions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Operações
      </Link>

      <div className="flex items-center justify-between py-6">
        <div>
          <span className="text-xs font-semibold text-primary tracking-wider uppercase">
            PAINEL DA OPERAÇÃO
          </span>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Separação</h1>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">{separationJobs.length}</p>
          <p className="text-sm text-muted-foreground">pedidos abertos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {jobsByStage.map(({ stage, jobs }) => (
          <div
            key={stage}
            className={`min-h-[60vh] p-3 bg-muted/50 rounded-2xl border-t-4 ${stageTones[stage]}`}
          >
            <div className="flex items-center justify-between px-2 py-3">
              <h2 className="font-semibold">{stageLabels[stage]}</h2>
              <Badge variant="secondary">{jobs.length}</Badge>
            </div>

            {jobs.length > 0 ? (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const { order, items, checkedCount } = getOrderInfo(job.order_id);
                  if (!order) return null;

                  const hasReturnables = items.some((i) => i.is_returnable);
                  const missing: string[] = [];
                  if (!job.delivery_driver) missing.push("entrega");
                  if (hasReturnables && !job.pickup_driver) missing.push("retirada");

                  return (
                    <Link
                      key={job.id}
                      to={`/separation/${order.id}`}
                      className="block p-4 bg-card rounded-xl border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {order.order_number} · {order.order_type}
                        </span>
                        <span className="text-xs font-bold">{order.needed_time}</span>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{order.organization}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {order.address || "Sem endereço"}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>{order.needed_date}</span>
                        <span>
                          {checkedCount}/{items.length} separados
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entrega</span>
                          <span className="font-medium">
                            {job.delivery_driver || "Definir motorista"}
                          </span>
                        </div>
                        {hasReturnables && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Retirada</span>
                            <span className="font-medium">
                              {job.pickup_driver || "Definir motorista"}
                            </span>
                          </div>
                        )}
                      </div>
                      {missing.length > 0 && (
                        <p className="mt-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                          Falta definir {missing.join(" e ")}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum pedido
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeparationJobPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const {
    orders,
    orderItems,
    separationJobs,
    updateSeparationJob,
    updateOrder,
  } = useAppStore();

  const order = orders.find((o) => o.id === orderId);
  const job = separationJobs.find((j) => j.order_id === orderId);
  const items = orderItems.filter((i) => i.order_id === orderId);

  const [deliveryDriver, setDeliveryDriver] = useState(job?.delivery_driver || "");
  const [pickupDriver, setPickupDriver] = useState(job?.pickup_driver || "");
  const [vehicle, setVehicle] = useState(job?.vehicle || "");
  const [stage, setStage] = useState<SeparationStage>(job?.stage || "a_separar");
  const [departureAt, setDepartureAt] = useState(job?.departure_at || "");
  const [returnAt, setReturnAt] = useState(job?.return_at || "");
  const [operationsNotes, setOperationsNotes] = useState(job?.operations_notes || "");
  const [checkedItems, setCheckedItems] = useState<string[]>(
    items.filter((i) => i.is_checked).map((i) => i.id)
  );

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!order || !job) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Link to="/separation" className="text-primary hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const hasReturnables = items.some((i) => i.is_returnable);
  const returnableItems = items.filter((i) => i.is_returnable);

  const handleSave = async (print = false) => {
    setError("");

    if (!deliveryDriver) {
      setError("Defina o motorista da entrega.");
      return;
    }

    if (hasReturnables && !pickupDriver) {
      setError("Defina o motorista da retirada.");
      return;
    }

    setIsSaving(true);

    try {
      await updateSeparationJob(job.id, {
        delivery_driver: deliveryDriver,
        pickup_driver: pickupDriver,
        vehicle,
        stage,
        departure_at: departureAt || null,
        return_at: returnAt || null,
        operations_notes: operationsNotes || null,
      });

      await updateOrder(order.id, { status: stage });

      if (print) {
        window.print();
      } else {
        navigate("/separation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const friendlyDateTime = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link
        to="/separation"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6 print:hidden"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Painel de separação
      </Link>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        className="mt-6"
      >
        <Card className="print:border-0 print:shadow-none">
          <CardHeader className="border-b print:border-b-2 print:border-black">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-black tracking-tight">
                  YOLO <span className="text-sm font-semibold">OS</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  ORDEM DE SEPARAÇÃO, ENTREGA E RETIRADA
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{order.order_number}</p>
                <Badge variant="secondary">{stageLabels[stage]}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-2 gap-4 pb-4 border-b">
              <div>
                <p className="text-xs text-muted-foreground">Cliente / evento</p>
                <p className="font-semibold">
                  {order.organization} · {order.order_type}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Destinatário</p>
                <p className="font-semibold">
                  {order.recipient_name} · {order.recipient_contact}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-4 border-b text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Onde entregar</p>
                <p className="font-medium">{order.address || "Uso interno"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quando entregar</p>
                <p className="font-medium">
                  {order.needed_date} · {order.needed_time}
                </p>
              </div>
              {order.event_start && (
                <div>
                  <p className="text-xs text-muted-foreground">Evento</p>
                  <p className="font-medium">
                    {friendlyDateTime(order.event_start)} até{" "}
                    {friendlyDateTime(order.event_end)}
                  </p>
                </div>
              )}
              {order.pickup_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Retirada prevista</p>
                  <p className="font-medium">{friendlyDateTime(order.pickup_at)}</p>
                </div>
              )}
            </div>

            <div className="print:hidden">
              <h2 className="text-sm font-semibold mb-4">
                Responsáveis e programação
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Motorista da entrega</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={deliveryDriver}
                    onChange={(e) => setDeliveryDriver(e.target.value)}
                    required
                  >
                    {deliveryPeople.map((p) => (
                      <option key={p} value={p}>
                        {p || "Selecione"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Motorista da retirada</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pickupDriver}
                    onChange={(e) => setPickupDriver(e.target.value)}
                    required={hasReturnables}
                  >
                    {deliveryPeople.map((p) => (
                      <option key={p} value={p}>
                        {p || "Selecione"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Veículo / transporte</Label>
                  <Input
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as SeparationStage)}
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {stageLabels[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Saída prevista</Label>
                  <Input
                    type="datetime-local"
                    value={departureAt}
                    onChange={(e) => setDepartureAt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retorno previsto</Label>
                  <Input
                    type="datetime-local"
                    value={returnAt}
                    onChange={(e) => setReturnAt(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-4">
                1. Separar e conferir a saída
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Sep.</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qtd.</th>
                      <th className="px-3 py-2 text-center print:block hidden">
                        Entregue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCheckedItems((prev) =>
                                prev.includes(item.id)
                                  ? prev.filter((id) => id !== item.id)
                                  : [...prev, item.id]
                              );
                            }}
                            className="print:hidden"
                          >
                            {checkedItems.includes(item.id) ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                          <span className="hidden print:inline">□</span>
                        </td>
                        <td className="px-3 py-2">
                          <strong>{item.name}</strong>
                          <p className="text-xs text-muted-foreground">
                            {item.code}
                            {item.requested_state && ` · ${item.requested_state}`}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-center print:block hidden">
                          □
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="print:block hidden border rounded-lg p-4 space-y-2 text-sm">
              <h2 className="font-semibold">2. Entrega</h2>
              <p>□ Todos os itens entregues</p>
              <p>Horário real: __________</p>
              <p>Recebido por: ____________________</p>
              <p>Assinatura / confirmação: ____________________</p>
            </div>

            {hasReturnables && (
              <div className="print:block hidden border rounded-lg p-4 space-y-4 text-sm">
                <h2 className="font-semibold">3. Retirada e retorno à YOLO</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Item esperado</th>
                      <th className="text-right py-1">Qtd.</th>
                      <th className="py-1">Qtd. voltou</th>
                      <th className="py-1">Conferência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnableItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">
                          <strong>{item.name}</strong>
                          <p className="text-xs text-muted-foreground">{item.code}</p>
                        </td>
                        <td className="text-right py-2">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2 w-20"></td>
                        <td className="py-2 text-xs whitespace-nowrap">
                          □ OK  □ Falta  □ Dano
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <span>□ Tudo recolhido no local</span>
                  <span>Horário da retirada: __________</span>
                  <span>□ Retorno conferido na YOLO</span>
                  <span>Horário de chegada: __________</span>
                </div>
                <p className="text-xs bg-muted p-2 rounded">
                  O evento só termina quando todos os retornos forem conferidos. Pops
                  reaproveitáveis voltam ao estoque; equipamentos e materiais seguem
                  para inspeção e limpeza.
                </p>
              </div>
            )}

            <div className="print:hidden">
              <h2 className="text-sm font-semibold mb-2">Observações da operação</h2>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                value={operationsNotes}
                onChange={(e) => setOperationsNotes(e.target.value)}
              />
            </div>

            <div className="print:block hidden border-t pt-4 flex justify-between text-xs">
              <span>Impresso em {new Date().toLocaleDateString("pt-BR")}</span>
              <strong>YOLO OS · {order.order_number}</strong>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-destructive text-sm mt-4 print:hidden" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-4 mt-6 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/separation")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSaving}
          >
            <Printer className="w-4 h-4 mr-2" />
            Salvar e imprimir
          </Button>
        </div>
      </form>
    </div>
  );
}
