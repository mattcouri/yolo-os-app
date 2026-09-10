import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";
import type { Stock, MaterialStock } from "@/types/database";

const gradeHelp = {
  AAA: "Perfeito. Exportação, e-commerce e varejo. Manter líquido.",
  B: "Imperfeições de formato ou abertura. Eventos e revenda em freezers.",
  C: "Amostras e consumo da equipe. Destino: freezer da cozinha.",
};

interface PendingItem {
  id: string;
  kind: "pop" | "material";
  name: string;
  quantity: number;
  unit: string;
  lot: string | null;
  receiptId: string | null;
  productId: string;
  source: Stock | MaterialStock;
}

export function InspectionPage() {
  const { stock, materialStock, products, locations, inspections, createInspection, fetchStock } = useAppStore();

  const pendingPops = stock.filter(
    (s) => s.status === "analysis" && !stock.some((x) => x.inspection_id === s.id)
  );
  const pendingMaterials = materialStock.filter(
    (m) => m.status === "analysis"
  );

  const getPendingItems = (): PendingItem[] => {
    const items: PendingItem[] = [];

    for (const s of pendingPops) {
      const product = products.find((p) => p.id === s.product_id);
      if (product) {
        items.push({
          id: s.id,
          kind: "pop",
          name: product.flavor || product.name,
          quantity: s.quantity,
          unit: "un",
          lot: s.lot,
          receiptId: s.receipt_id,
          productId: s.product_id,
          source: s,
        });
      }
    }

    for (const m of pendingMaterials) {
      const product = products.find((p) => p.id === m.product_id);
      if (product) {
        items.push({
          id: m.id,
          kind: "material",
          name: product.name,
          quantity: m.quantity,
          unit: product.unit,
          lot: m.lot,
          receiptId: m.receipt_id,
          productId: m.product_id,
          source: m,
        });
      }
    }

    return items;
  };

  const pendingItems = getPendingItems();

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <Link
        to="/operations/actions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Operações
      </Link>

      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          02 / PREPARAR
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">
          Uma etapa de cada vez.
        </h1>
        <p className="text-muted-foreground mt-1">
          Abra uma tarefa para conferir ou continuar o encaixotamento.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 overflow-x-auto">
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full whitespace-nowrap">
          1. Conferir quantidades
        </span>
        <span className="px-3 py-1 whitespace-nowrap">2. Classificar</span>
        <span className="px-3 py-1 whitespace-nowrap">3. Vincular caixas</span>
        <span className="px-3 py-1 whitespace-nowrap">4. Etiquetar</span>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            A fazer{" "}
            <Badge variant="secondary" className="ml-2">
              {pendingItems.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingItems.length > 0 ? (
            <div className="space-y-2">
              {pendingItems.map((item) => (
                <InspectionTaskRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">Tudo em dia por aqui</h3>
              <p className="text-sm">
                Novos recebimentos aparecerão nesta fila.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {inspections.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Conferências anteriores ({inspections.length})
          </summary>
          <Card className="mt-2">
            <CardContent className="pt-6">
              {inspections.map((insp) => {
                const product = products.find((p) => p.id === insp.product_id);
                return (
                  <div
                    key={insp.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {product?.flavor || product?.name}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {insp.lot || "Sem lote"} · {insp.actual_quantity} un conferidos
                      </p>
                    </div>
                    <Link
                      to={`/operations/packing/${insp.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Ver resultado →
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </details>
      )}
    </div>
  );
}

function InspectionTaskRow({ item }: { item: PendingItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors text-left"
      >
        <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <CheckCircle2 className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <strong className="block truncate">{item.name}</strong>
          <small className="text-muted-foreground">
            {item.quantity} {item.unit} · {item.lot || "Sem lote"} ·{" "}
            {item.receiptId || "Exemplo"}
          </small>
        </span>
        <Badge variant="outline">Conferir</Badge>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <InspectionForm item={item} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

function InspectionForm({
  item,
  onClose,
}: {
  item: PendingItem;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { locations, createInspection } = useAppStore();

  const [actual, setActual] = useState(String(item.quantity));
  const [rejected, setRejected] = useState("0");
  const [reason, setReason] = useState("");

  const [countAAA, setCountAAA] = useState(item.kind === "pop" ? String(item.quantity) : "0");
  const [countB, setCountB] = useState("0");
  const [countC, setCountC] = useState("0");

  const [destAAA, setDestAAA] = useState(locations[2]?.id || locations[0]?.id);
  const [destB, setDestB] = useState(locations[2]?.id || locations[0]?.id);
  const [destC, setDestC] = useState(locations[4]?.id || locations[0]?.id);

  const [fifoDate, setFifoDate] = useState(
    (item.source as Stock).fifo_date || new Date().toISOString().split("T")[0]
  );
  const [cleanConfirmed, setCleanConfirmed] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const actualQty = Number(actual);
    const rejectedQty = Number(rejected);

    if (!Number.isFinite(actualQty) || actualQty < 0) {
      setError("Informe uma quantidade válida.");
      return;
    }

    if (!Number.isFinite(rejectedQty) || rejectedQty < 0 || rejectedQty > actualQty) {
      setError("Quantidade rejeitada inválida.");
      return;
    }

    if ((actualQty !== item.quantity || rejectedQty > 0) && !reason.trim()) {
      setError("Explique a diferença ou rejeição.");
      return;
    }

    if (item.kind === "pop") {
      const aaa = Number(countAAA);
      const b = Number(countB);
      const c = Number(countC);

      if (Math.abs(aaa + b + c + rejectedQty - actualQty) > 0.001) {
        setError("AAA + B + C + bloqueados deve ser igual à quantidade contada.");
        return;
      }

      if (!cleanConfirmed) {
        setError("Confirme a lavagem e a limpeza.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const inspection = await createInspection({
        source_stock_id: item.kind === "pop" ? item.id : undefined,
        source_material_id: item.kind === "material" ? item.id : undefined,
        kind: item.kind,
        product_id: item.productId,
        lot: item.lot || undefined,
        receipt_id: item.receiptId || undefined,
        expected_quantity: item.quantity,
        actual_quantity: actualQty,
        rejected_quantity: rejectedQty,
        count_aaa: item.kind === "pop" ? Number(countAAA) : undefined,
        count_b: item.kind === "pop" ? Number(countB) : undefined,
        count_c: item.kind === "pop" ? Number(countC) : undefined,
        destination_aaa: item.kind === "pop" ? destAAA : undefined,
        destination_b: item.kind === "pop" ? destB : undefined,
        destination_c: item.kind === "pop" ? destC : undefined,
        fifo_date: item.kind === "pop" ? fifoDate : undefined,
        reason: reason.trim() || undefined,
        scan_packing: item.kind === "pop",
      });

      if (item.kind === "pop") {
        navigate(`/operations/packing/${inspection.id}`);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar conferência");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-2xl md:w-full bg-background rounded-xl border shadow-lg overflow-auto max-h-[90vh]">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Conferir {item.name}</h2>
              <p className="text-sm text-muted-foreground">
                {item.receiptId || "Exemplo inicial"} · {item.lot || "Sem lote"}
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Conferência física</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Quantidade declarada:{" "}
                <strong>
                  {item.quantity} {item.kind === "pop" ? "pops" : item.unit}
                </strong>
                . A contagem abaixo não altera a nota fiscal.
              </p>
              <div className="space-y-2">
                <Label>Quantidade realmente recebida</Label>
                <Input
                  type="number"
                  min="0"
                  step={item.kind === "pop" || item.unit === "un" ? "1" : "0.001"}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Motivo da divergência ou rejeição</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                  placeholder="Obrigatório se houver diferença ou unidades bloqueadas"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                2. {item.kind === "pop" ? "Classificar e encaixotar" : "Liberar material"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {item.kind === "pop" ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(["AAA", "B", "C"] as const).map((grade) => (
                      <div key={grade} className="space-y-3 p-4 border rounded-lg">
                        <Badge
                          variant={grade === "AAA" ? "default" : grade === "B" ? "secondary" : "outline"}
                        >
                          {grade}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {gradeHelp[grade]}
                        </p>
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              grade === "AAA" ? countAAA : grade === "B" ? countB : countC
                            }
                            onChange={(e) => {
                              if (grade === "AAA") setCountAAA(e.target.value);
                              else if (grade === "B") setCountB(e.target.value);
                              else setCountC(e.target.value);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Destino</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={
                              grade === "AAA" ? destAAA : grade === "B" ? destB : destC
                            }
                            onChange={(e) => {
                              if (grade === "AAA") setDestAAA(e.target.value);
                              else if (grade === "B") setDestB(e.target.value);
                              else setDestC(e.target.value);
                            }}
                          >
                            {locations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cleanConfirmed}
                      onChange={(e) => setCleanConfirmed(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Lavagem, limpeza e contagem concluídas
                  </label>

                  <p className="text-xs text-muted-foreground">
                    Uma caixa por sabor, classe e lote; até 100 pops por caixa. Restante
                    em caixa parcial. Estado inicial: líquido, mesmo quando o destino é
                    um freezer.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sem classificação AAA/B/C e sem divisão em caixas de 100.
                  </p>
                  <div className="space-y-2">
                    <Label>Destino aprovado</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={destAAA}
                      onChange={(e) => setDestAAA(e.target.value)}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Rejeitado / bloqueado</Label>
                <Input
                  type="number"
                  min="0"
                  step={item.kind === "pop" || item.unit === "un" ? "1" : "0.001"}
                  value={rejected}
                  onChange={(e) => setRejected(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Permanece em {locations[0]?.name}, fora do saldo disponível. Não vira
                  classe C automaticamente.
                </p>
              </div>
            </CardContent>
          </Card>

          {item.kind === "pop" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  3. Etiquetas e rastreabilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Data de referência FIFO (padrão: recebimento)</Label>
                  <Input
                    type="date"
                    value={fifoDate}
                    onChange={(e) => setFifoDate(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Não use a data de encaixotamento para reiniciar a idade do produto. O
                  lote original será mantido.
                </p>
              </CardContent>
            </Card>
          )}

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Salvando..."
                : item.kind === "pop"
                ? "Concluir conferência e vincular caixas"
                : "Concluir conferência"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
