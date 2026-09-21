import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CameraQrButton } from "@/components/camera-qr-button";
import { allocateToBoxes } from "@/lib/box-fill";
import { getBoxUnitCapacity, isBoxAsset } from "@/lib/operational-assets";
import { boxTypeLabel } from "@/lib/packaging-board";
import {
  countedForItem,
  countedQuantity,
  declaredQuantity,
  describeBoxPlan,
  formatVariance,
  rejectedQuantity,
  remainingQuantity,
  sourceMaterialForLine,
  sourceStockForLine,
  varianceQuantity,
} from "@/lib/receipt-progress";
import { inferPrepareMode, locationRequiresBox } from "@/lib/stock-placement";
import { productStockLocations } from "@/lib/locations";
import { useAppStore } from "@/stores";
import { Textarea } from "@/components/ui/textarea";
import type { Asset, Location, MaterialStock, Product, ReceiptItem, Stock } from "@/types/database";

type GradeKey = "AAA" | "B" | "C" | "blocked";

const GRADE_CARDS: {
  key: GradeKey;
  label: string;
  help: string;
  variant: "default" | "secondary" | "outline" | "destructive";
}[] = [
  { key: "AAA", label: "AAA", help: "Perfeito. Exportação, e-commerce e varejo. Manter líquido.", variant: "default" },
  { key: "B", label: "B", help: "Imperfeições de formato ou abertura. Eventos e revenda em freezers.", variant: "secondary" },
  { key: "C", label: "C", help: "Amostras e consumo da equipe. Destino: freezer da cozinha.", variant: "outline" },
  { key: "blocked", label: "Rejeito", help: "Fora do saldo disponível. Não vira classe C.", variant: "destructive" },
];

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function varianceClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

function defaultLocation(locations: Location[], grade: GradeKey) {
  if (grade === "C") {
    return locations.find((l) => /cozinha/i.test(l.name))?.id
      || locations.find((l) => l.type === "freezer")?.id
      || locations[0]?.id
      || "";
  }
  if (grade === "blocked") {
    return locations.find((l) => l.type === "receiving")?.id
      || locations[0]?.id
      || "";
  }
  return locations.find((l) => /pack|prepar|embal/i.test(l.name))?.id
    || locations.find((l) => l.type === "storage")?.id
    || locations[0]?.id
    || "";
}

function emptyBoxesOfType(assets: Asset[], stock: Stock[], usedIds: string[], type: string) {
  return assets.filter(
    (a) =>
      isBoxAsset(a) &&
      a.type === type &&
      a.status === "available" &&
      a.is_active !== false &&
      !usedIds.includes(a.id) &&
      !stock.some((s) => s.asset_id === a.id && s.quantity > 0)
  );
}

function typicalBoxCapacity(assets: Asset[], type?: string) {
  const sample = type
    ? assets.find((a) => isBoxAsset(a) && a.type === type)
    : assets.find((a) => isBoxAsset(a));
  return sample ? getBoxUnitCapacity(sample) : 100;
}

function normalizeBoxCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s_]+/g, "-");
}

type LineKind = "pop" | "material";

interface PrepareLine {
  id: string;
  kind: LineKind;
  item: ReceiptItem;
  product: Product;
  remaining: number;
  source: Stock | MaterialStock;
}

export function PrepareReceiptPage() {
  const { receiptId } = useParams();
  const {
    receipts,
    receiptItems,
    stock,
    materialStock,
    products,
    inspections,
  } = useAppStore();

  const [activeLine, setActiveLine] = useState<PrepareLine | null>(null);
  const [closing, setClosing] = useState(false);

  const receipt = receipts.find((r) => r.id === receiptId);
  const items = receiptItems.filter((item) => item.receipt_id === receiptId);
  const remaining = receipt ? remainingQuantity(receipt.id, stock, materialStock) : 0;
  const closed = receipt?.status === "closed";
  const declared = declaredQuantity(items);
  const counted = receipt ? countedQuantity(receipt, items, inspections) : 0;
  const variance = receipt?.variance_quantity ?? varianceQuantity(counted, declared);
  const rejected = receipt ? rejectedQuantity(receipt.id, inspections) : 0;

  const lines: PrepareLine[] = useMemo(() => {
    if (!receipt) return [];
    const result: PrepareLine[] = [];
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) continue;
      if (product.kind === "pop") {
        const source = sourceStockForLine(receipt.id, item.product_id, item.lot, stock);
        if (!source) continue;
        result.push({
          id: source.id,
          kind: "pop",
          item,
          product,
          remaining: source.status === "analysis" ? source.quantity : 0,
          source,
        });
      } else {
        const source = sourceMaterialForLine(receipt.id, item.product_id, item.lot, materialStock);
        if (!source) continue;
        result.push({
          id: source.id,
          kind: "material",
          item,
          product,
          remaining: source.status === "analysis" ? source.quantity : 0,
          source,
        });
      }
    }
    return result;
  }, [receipt, items, products, stock, materialStock]);

  const history = inspections.filter((insp) => insp.receipt_id === receiptId);

  if (!receipt) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-muted-foreground">
        <p>Nota fiscal não encontrada.</p>
        <Link to="/operacoes/preparar" className="text-primary text-sm mt-3 inline-block">
          Voltar para Preparar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">Preparar</span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">NF {receipt.nf_number}</h1>
        <p className="text-muted-foreground mt-1">
          {receipt.receipt_number} · {receipt.supplier} · {formatDate(receipt.receipt_date)}
        </p>
      </div>

      {closed ? (
        <div className="rounded-xl border bg-muted/40 p-4 mb-6 text-sm space-y-1">
          <p className="font-medium text-foreground">Preparação encerrada</p>
          <p>
            Declarado <strong>{declared.toLocaleString("pt-BR")}</strong>
            {" · "}contado <strong>{counted.toLocaleString("pt-BR")}</strong>
            {" · "}diferença{" "}
            <strong className={varianceClass(variance)}>{formatVariance(variance)}</strong>
          </p>
          {rejected > 0 && (
            <p className="text-muted-foreground">
              Rejeito {rejected.toLocaleString("pt-BR")} un (conta como encontrado; não entra no disponível).
            </p>
          )}
          {receipt.close_notes && <p className="text-muted-foreground">{receipt.close_notes}</p>}
        </div>
      ) : (
        <div className="rounded-xl bg-primary/10 text-primary p-4 mb-6 text-sm space-y-1">
          <p>
            Declarado <strong>{declared.toLocaleString("pt-BR")}</strong>
            {" · "}já contado <strong>{counted.toLocaleString("pt-BR")}</strong>
            {" · "}ainda em análise <strong>{remaining.toLocaleString("pt-BR")}</strong>
            {" · "}diferença{" "}
            <strong className={varianceClass(variance)}>{formatVariance(variance)}</strong>
          </p>
          <p className="opacity-80">Salve em levas — não precisa terminar tudo agora. Encerrar trava a conta da NF.</p>
        </div>
      )}

      {lines.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg text-foreground">Nenhum item nesta nota</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => {
            const lineCounted = countedForItem(line.item, inspections);
            const lineVariance = line.item.variance_quantity ?? varianceQuantity(lineCounted, line.item.quantity);
            if (closed) {
              return (
                <div
                  key={line.id}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-card"
                >
                  <span className="flex-1 min-w-0">
                    <strong className="block text-lg truncate">
                      {line.product.name || line.product.code}
                    </strong>
                    <span className="text-sm text-muted-foreground">
                      {line.product.code} · {line.item.lot || "Sem lote"} · declarado{" "}
                      {line.item.quantity.toLocaleString("pt-BR")}
                      {" · "}contado {lineCounted.toLocaleString("pt-BR")}
                    </span>
                  </span>
                  <span className={`text-sm font-medium ${varianceClass(lineVariance)}`}>
                    {formatVariance(lineVariance)}
                  </span>
                </div>
              );
            }
            return (
              <button
                key={line.id}
                type="button"
                onClick={() => setActiveLine(line)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-card text-left hover:border-primary/40 active:scale-[0.99] transition-all"
              >
                <span className="flex-1 min-w-0">
                  <strong className="block text-lg truncate">
                    {line.product.name || line.product.code}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {line.product.code} · {line.item.lot || "Sem lote"} · declarado{" "}
                    {line.item.quantity.toLocaleString("pt-BR")}
                    {" · "}contado {lineCounted.toLocaleString("pt-BR")}
                  </span>
                </span>
                <Badge variant={line.remaining > 0 ? "secondary" : "outline"}>
                  {line.remaining > 0
                    ? `Restam ${line.remaining.toLocaleString("pt-BR")}`
                    : "Contar mais"}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {!closed && (
        <div className="mt-6">
          <Button className="h-12 w-full sm:w-auto" onClick={() => setClosing(true)}>
            Encerrar preparação
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            Levas já salvas ({history.length})
          </summary>
          <Card className="mt-2">
            <CardContent className="pt-4">
              {history.map((insp) => {
                const product = products.find((p) => p.id === insp.product_id);
                return (
                  <div key={insp.id} className="flex justify-between gap-3 py-3 border-b last:border-0 text-sm">
                    <div>
                      <strong>{product?.name || product?.code}</strong>
                      <p className="text-xs text-muted-foreground">
                        {insp.actual_quantity} un · AAA {insp.count_aaa} · B {insp.count_b} · C {insp.count_c}
                        {insp.rejected_quantity > 0 ? ` · rejeito ${insp.rejected_quantity}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{insp.inspection_number}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </details>
      )}

      {activeLine && !closed && (
        <PrepareBatchDialog
          line={activeLine}
          receiptId={receipt.id}
          onClose={() => setActiveLine(null)}
          onSaved={() => setActiveLine(null)}
        />
      )}

      {closing && !closed && (
        <ClosePrepareDialog
          receiptId={receipt.id}
          items={items}
          remaining={remaining}
          declared={declared}
          counted={counted}
          variance={variance}
          rejected={rejected}
          onClose={() => setClosing(false)}
        />
      )}
    </div>
  );
}

function ClosePrepareDialog({
  receiptId,
  items,
  remaining,
  declared,
  counted,
  variance,
  rejected,
  onClose,
}: {
  receiptId: string;
  items: ReceiptItem[];
  remaining: number;
  declared: number;
  counted: number;
  variance: number;
  rejected: number;
  onClose: () => void;
}) {
  const { products, inspections, closeReceipt } = useAppStore();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (variance !== 0 && !notes.trim()) {
      setError("Informe o motivo da diferença em relação à NF.");
      return;
    }
    setSaving(true);
    try {
      await closeReceipt(receiptId, notes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível encerrar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Encerrar preparação</DialogTitle>
            <DialogDescription>
              A conta da NF fica travada. Não dá para contar mais levas nesta nota.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border divide-y text-sm">
            {items.map((item) => {
              const product = products.find((p) => p.id === item.product_id);
              const lineCounted = countedForItem(item, inspections);
              const lineVariance = varianceQuantity(lineCounted, item.quantity);
              return (
                <div key={item.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <strong className="block truncate">{product?.name || product?.code}</strong>
                    <span className="text-xs text-muted-foreground">
                      declarado {item.quantity.toLocaleString("pt-BR")} · contado {lineCounted.toLocaleString("pt-BR")}
                    </span>
                  </span>
                  <span className={`text-sm font-medium shrink-0 ${varianceClass(lineVariance)}`}>
                    {formatVariance(lineVariance)}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between gap-3 px-3 py-2 font-medium">
              <span>
                Total · {declared.toLocaleString("pt-BR")} → {counted.toLocaleString("pt-BR")}
              </span>
              <span className={varianceClass(variance)}>{formatVariance(variance)}</span>
            </div>
          </div>

          {remaining > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Ainda restam {remaining.toLocaleString("pt-BR")} un em análise. Encerrar registra{" "}
              <strong>falta</strong> e tira essas unidades da preparação — elas não entram no estoque.
            </p>
          )}
          {variance > 0 && remaining === 0 && (
            <p className="text-sm text-emerald-800">
              Sobra de {formatVariance(variance)} un já está no estoque.
            </p>
          )}
          {rejected > 0 && (
            <p className="text-xs text-muted-foreground">
              Rejeito {rejected.toLocaleString("pt-BR")} un conta como encontrado vs a NF.
            </p>
          )}

          <div className="space-y-1">
            <Label>{variance !== 0 ? "Motivo da diferença" : "Observação (opcional)"}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={variance !== 0 ? "Por que a contagem difere da NF?" : "Opcional"}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Encerrando…" : "Encerrar nota"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PrepareBatchDialog({
  line,
  receiptId,
  onClose,
  onSaved,
}: {
  line: PrepareLine;
  receiptId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locations, assets, stock, materialStock, receiptItems, createPrepareBatch } = useAppStore();
  const productLocations = useMemo(() => productStockLocations(locations, true), [locations]);

  const [quantities, setQuantities] = useState<Record<GradeKey, string>>({
    AAA: "",
    B: "",
    C: "",
    blocked: "",
  });
  const [destinations, setDestinations] = useState<Record<GradeKey, string>>({
    AAA: defaultLocation(locations, "AAA"),
    B: defaultLocation(locations, "B"),
    C: defaultLocation(locations, "C"),
    blocked: defaultLocation(locations, "blocked"),
  });
  const [boxes, setBoxes] = useState<Record<GradeKey, string[]>>({
    AAA: [],
    B: [],
    C: [],
    blocked: [],
  });
  const [discardBlocked, setDiscardBlocked] = useState(false);
  const [materialQty, setMaterialQty] = useState("");
  const [materialRejected, setMaterialRejected] = useState("0");
  const [destMaterial, setDestMaterial] = useState(defaultLocation(locations, "AAA"));
  const [cleanConfirmed, setCleanConfirmed] = useState(false);
  const [emptied, setEmptied] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const qty = (key: GradeKey) => Number(quantities[key]) || 0;
  const qtyAAA = qty("AAA");
  const qtyB = qty("B");
  const qtyC = qty("C");
  const qtyRejected = qty("blocked");
  const batchTotal = line.kind === "pop" ? qtyAAA + qtyB + qtyC + qtyRejected : Number(materialQty) || 0;
  const receiptRemainingNow = remainingQuantity(receiptId, stock, materialStock);
  const remainingAfter = Math.max(0, line.remaining - batchTotal);
  const receiptRemainingAfter = Math.max(0, receiptRemainingNow - batchTotal);
  const usedBoxIds = [...boxes.AAA, ...boxes.B, ...boxes.C, ...boxes.blocked];

  const inboundCodes = Array.from(
    new Set(
      receiptItems
        .filter((item) => item.receipt_id === receiptId)
        .flatMap((item) => item.source_box_codes || [])
    )
  );
  const inboundAssets = inboundCodes
    .map((code) => assets.find((a) => a.code === code))
    .filter((asset): asset is Asset => {
      if (!asset) return false;
      return asset.status === "with_product" || asset.status === "in_use";
    });

  const gradeBoxes = (key: GradeKey) => {
    const selected = boxes[key]
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is Asset => Boolean(a));
    return allocateToBoxes(qty(key), selected).allocations.filter((row) => row.quantity > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (batchTotal <= 0) {
      setError("Informe o que foi contado nesta leva.");
      return;
    }
    if (line.kind === "pop" && !cleanConfirmed) {
      setError("Confirme a lavagem, limpeza e contagem desta leva.");
      return;
    }

    if (line.kind === "pop") {
      for (const card of GRADE_CARDS) {
        const quantity = qty(card.key);
        if (quantity <= 0) continue;
        const discarded = card.key === "blocked" && discardBlocked;
        const location = locations.find((item) => item.id === destinations[card.key]);
        const mode = inferPrepareMode(card.key, location, discarded);
        if (mode === "boxed") {
          const allocated = allocateToBoxes(
            quantity,
            boxes[card.key].map((id) => assets.find((a) => a.id === id)).filter((a): a is Asset => Boolean(a))
          );
          if (allocated.leftover > 0) {
            setError(`${card.label}: ainda faltam ${allocated.leftover} un para encaixotar.`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    try {
      const emptiedIds = receiptRemainingAfter === 0
        ? inboundAssets.map((a) => a.id)
        : emptied;

      await createPrepareBatch({
        kind: line.kind,
        source_stock_id: line.kind === "pop" ? line.source.id : undefined,
        source_material_id: line.kind === "material" ? line.source.id : undefined,
        product_id: line.product.id,
        lot: line.item.lot || undefined,
        receipt_id: receiptId,
        expected_quantity: line.remaining,
        actual_quantity: batchTotal,
        rejected_quantity: line.kind === "pop" ? qtyRejected : Number(materialRejected) || 0,
        fifo_date: line.kind === "pop" ? (line.source as Stock).fifo_date || undefined : undefined,
        destination_material: line.kind === "material" ? destMaterial : undefined,
        emptied_asset_ids: emptiedIds,
        grades: line.kind === "pop"
          ? GRADE_CARDS.map((card) => {
              const discarded = card.key === "blocked" && discardBlocked;
              const location = locations.find((item) => item.id === destinations[card.key]);
              const mode = inferPrepareMode(card.key, location, discarded);
              return {
                grade: card.key,
                quantity: qty(card.key),
                location_id: mode === "discard" ? "" : destinations[card.key],
                mode,
                boxes: mode === "boxed"
                  ? gradeBoxes(card.key).map((row) => ({ asset_id: row.assetId, quantity: row.quantity }))
                  : [],
              };
            })
          : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a leva.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Preparar {line.product.name || line.product.code}</DialogTitle>
            <DialogDescription>
              {line.product.code} · {line.item.lot || "Sem lote"}
              {line.remaining > 0
                ? ` · restam ${line.remaining.toLocaleString("pt-BR")} un`
                : " · análise zerada — esta leva entra como sobra"}
            </DialogDescription>
          </DialogHeader>

          {line.kind === "pop" ? (
            <>
              <p className="text-sm text-muted-foreground">
                A nota fiscal permanece com {line.item.quantity.toLocaleString("pt-BR")} un declaradas.
                Conte só o que está separando agora.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {GRADE_CARDS.map((card) => {
                  const discarded = card.key === "blocked" && discardBlocked;
                  const location = locations.find((item) => item.id === destinations[card.key]);
                  const mode = inferPrepareMode(card.key, location, discarded);
                  return (
                  <div key={card.key} className="space-y-3 p-4 border rounded-xl bg-card">
                    <Badge variant={card.variant}>{card.label}</Badge>
                    <p className="text-xs text-muted-foreground">{card.help}</p>
                    <div className="space-y-1">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={quantities[card.key]}
                        onChange={(e) => setQuantities((current) => ({ ...current, [card.key]: e.target.value }))}
                      />
                      {mode === "boxed" && (
                        <p className="text-xs text-muted-foreground">
                          {describeBoxPlan(qty(card.key), typicalBoxCapacity(assets))}
                        </p>
                      )}
                      {mode === "loose" && qty(card.key) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Estoque solto neste local — sem caixa.
                        </p>
                      )}
                    </div>
                    {card.key === "blocked" && (
                      <label className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 w-4 h-4"
                          checked={discardBlocked}
                          onChange={(e) => {
                            setDiscardBlocked(e.target.checked);
                            if (e.target.checked) {
                              setBoxes((current) => ({ ...current, blocked: [] }));
                            }
                          }}
                        />
                        <span>Descartar no lixo (sai do estoque, sem caixa)</span>
                      </label>
                    )}
                    {mode === "boxed" && (
                      <GradeBoxPicker
                        quantity={qty(card.key)}
                        selectedIds={boxes[card.key]}
                        usedIds={usedBoxIds}
                        assets={assets}
                        stock={stock}
                        onChange={(ids) => setBoxes((current) => ({ ...current, [card.key]: ids }))}
                      />
                    )}
                    {mode !== "discard" && (
                    <div className="space-y-1">
                      <Label>Destino</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={destinations[card.key]}
                        onChange={(e) => {
                          const next = e.target.value;
                          const nextLocation = locations.find((item) => item.id === next);
                          setDestinations((current) => ({ ...current, [card.key]: next }));
                          if (nextLocation && !locationRequiresBox(nextLocation)) {
                            setBoxes((current) => ({ ...current, [card.key]: [] }));
                          }
                        }}
                      >
                        {productLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}{locationRequiresBox(loc) ? "" : " · solto"}
                          </option>
                        ))}
                      </select>
                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                Desta leva: <strong>{batchTotal.toLocaleString("pt-BR")}</strong> un.
                {batchTotal > line.remaining ? (
                  <>
                    {" "}Sobra desta leva:{" "}
                    <strong>{(batchTotal - line.remaining).toLocaleString("pt-BR")}</strong> un no estoque.
                  </>
                ) : (
                  <>
                    {" "}Depois restam <strong>{remainingAfter.toLocaleString("pt-BR")}</strong> un nesta linha.
                  </>
                )}
              </div>

              {inboundAssets.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Caixas grandes / pretas esvaziadas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Caixas vazias vão automaticamente para limpeza. Se o saldo da nota zerar, as caixas de entrada restantes também entram na limpeza.
                    </p>
                    {receiptRemainingAfter === 0 ? (
                      <p className="text-sm">
                        Esta leva zera a nota. {inboundAssets.length} caixa(s) de entrada irão para “aguardar limpeza”.
                      </p>
                    ) : (
                      inboundAssets.map((asset) => (
                        <label key={asset.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={emptied.includes(asset.id)}
                            onChange={(e) => {
                              setEmptied((current) =>
                                e.target.checked ? [...current, asset.id] : current.filter((id) => id !== asset.id)
                              );
                            }}
                          />
                          {asset.code} · {asset.name}
                        </label>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={cleanConfirmed}
                  onChange={(e) => setCleanConfirmed(e.target.checked)}
                />
                Lavagem, limpeza e contagem desta leva concluídas
              </label>
            </>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Liberar material</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Sem classificação AAA/B/C e sem caixas.</p>
                <div className="space-y-1">
                  <Label>Quantidade desta leva</Label>
                  <Input type="number" min="0" value={materialQty} onChange={(e) => setMaterialQty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Rejeitado</Label>
                  <Input type="number" min="0" value={materialRejected} onChange={(e) => setMaterialRejected(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Destino aprovado</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={destMaterial}
                    onChange={(e) => setDestMaterial(e.target.value)}
                  >
                    {productLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar leva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GradeBoxPicker({
  quantity,
  selectedIds,
  usedIds,
  assets,
  stock,
  onChange,
}: {
  quantity: number;
  selectedIds: string[];
  usedIds: string[];
  assets: Asset[];
  stock: Stock[];
  onChange: (ids: string[]) => void;
}) {
  const { boxTypes, fetchBoxTypes } = useAppStore();
  useEffect(() => {
    void fetchBoxTypes();
  }, [fetchBoxTypes]);
  const typeOptions = boxTypes.length
    ? boxTypes
    : [...new Set(assets.filter((asset) => isBoxAsset(asset)).map((asset) => asset.type))].map((value) => ({
        value,
        label: boxTypeLabel(value),
        sort_order: 50,
        created_at: "",
        updated_at: "",
      }));
  const defaultType =
    typeOptions.find((row) => row.value === "caixa_media")?.value || typeOptions[0]?.value || "caixa_media";
  const [boxType, setBoxType] = useState(defaultType);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerFocused, setScannerFocused] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const scannerRef = useRef<HTMLInputElement>(null);
  const selected = selectedIds
    .map((id) => assets.find((a) => a.id === id))
    .filter((a): a is Asset => Boolean(a));
  const allocated = allocateToBoxes(quantity, selected);
  const available = emptyBoxesOfType(assets, stock, usedIds, boxType);

  const addBox = (asset: Asset) => {
    if (selectedIds.includes(asset.id)) return false;
    const empty = emptyBoxesOfType(assets, stock, usedIds, asset.type);
    if (!empty.some((item) => item.id === asset.id)) return false;
    setBoxType(asset.type);
    onChange([...selectedIds, asset.id]);
    setScanMessage("");
    return true;
  };

  const addByCode = (raw: string) => {
    const code = normalizeBoxCode(raw);
    if (!code) return;
    if (selected.some((asset) => asset.code === code)) {
      setScanMessage(`${code} já está nesta classe.`);
      return;
    }
    const asset = assets.find((a) => a.code === code);
    if (!asset) {
      setScanMessage(`${code} não cadastrada.`);
      return;
    }
    if (!isBoxAsset(asset)) {
      setScanMessage(`${code} não é uma embalagem vai-vem.`);
      return;
    }
    if (asset.type !== boxType) {
      setBoxType(asset.type);
    }
    if (!addBox(asset)) {
      setScanMessage(`${code} não está disponível.`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>Tipo de caixa</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={boxType}
          onChange={(e) => {
            setBoxType(e.target.value);
            setScanMessage("");
          }}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Input
          ref={scannerRef}
          value={scannerInput}
          onChange={(e) => {
            const value = e.target.value;
            setScannerInput(value);
            if (value.includes("\n") || value.includes("\r")) {
              addByCode(value);
              setScannerInput("");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addByCode(scannerInput);
              setScannerInput("");
            }
          }}
          onFocus={() => setScannerFocused(true)}
          onBlur={() => setScannerFocused(false)}
          placeholder="Escaneie ou digite o código..."
          className={`h-10 flex-1 font-mono text-sm ${scannerFocused ? "ring-2 ring-primary" : ""}`}
        />
        <CameraQrButton
          onResult={(value) => {
            addByCode(value);
            setScannerInput("");
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 px-3"
          onClick={() => {
            addByCode(scannerInput);
            setScannerInput("");
          }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {scannerFocused && (
        <p className="text-[11px] text-muted-foreground">Aguardando scan...</p>
      )}
      {scanMessage && <p className="text-[11px] text-amber-600">{scanMessage}</p>}

      {selected.length > 0 && (
        <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
          {allocated.allocations.map((row) => {
            const asset = assets.find((a) => a.id === row.assetId);
            if (!asset) return null;
            return (
              <div key={row.assetId} className="flex items-center justify-between gap-2 px-2 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {row.quantity > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <code className="font-mono text-xs font-medium">{asset.code}</code>
                    <p className="text-[11px] text-muted-foreground">
                      {row.quantity} / {row.capacity} un
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => onChange(selectedIds.filter((id) => id !== row.assetId))}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {quantity > 0 && allocated.leftover > 0 && (
        <Badge variant="destructive" className="text-[11px]">Faltam {allocated.leftover} un</Badge>
      )}

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Selecionar caixas da lista</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          value=""
          onChange={(e) => {
            const asset = available.find((item) => item.id === e.target.value);
            if (asset) addBox(asset);
          }}
        >
          <option value="">
            {available.length > 0
              ? `Escolher ${boxTypeLabel(boxType, typeOptions)} vazia…`
              : `Nenhuma ${boxTypeLabel(boxType, typeOptions)} disponível`}
          </option>
          {available.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.code} · até {getBoxUnitCapacity(asset)} un
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
