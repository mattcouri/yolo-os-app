import { useState } from "react";
import { Plus, Trash2, Printer, Package, Box, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";

interface PackingRow {
  id: string;
  poolId: string;
  boxId: string;
  quantity: string;
  locationId: string;
}

export function PackingPage() {
  const {
    inspections,
    stock,
    assets,
    locations,
    products,
    fills,
    createFill,
  } = useAppStore();

  const awaitingPacking = stock.filter((s) => s.status === "awaiting_packing");

  const emptyBoxes = assets.filter(
    (a) =>
      a.type === "caixa_media" &&
      a.status === "available" &&
      !stock.some((s) => s.asset_id === a.id && s.quantity > 0)
  );

  const [rows, setRows] = useState<PackingRow[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAwaiting = awaitingPacking.reduce((s, p) => s + p.quantity, 0);

  const addRow = (poolId: string) => {
    const pool = awaitingPacking.find((p) => p.id === poolId);
    if (!pool) return;

    const usedInRows = rows
      .filter((r) => r.poolId === poolId)
      .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const remaining = pool.quantity - usedInRows;

    setRows([
      ...rows,
      {
        id: String(Date.now()),
        poolId,
        boxId: "",
        quantity: String(Math.min(100, Math.max(0, remaining))),
        locationId: pool.location_id,
      },
    ]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateRow = (id: string, field: keyof PackingRow, value: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const normalizeAssetCode = (code: string) =>
    code.trim().toUpperCase().replace(/[\s_-]+/g, "-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (rows.length === 0) {
      setError("Adicione pelo menos uma caixa.");
      return;
    }

    const usedBoxes = new Set<string>();
    const poolTotals: Record<string, number> = {};

    for (const row of rows) {
      const pool = awaitingPacking.find((p) => p.id === row.poolId);
      if (!pool) {
        setError("Classificação sem saldo.");
        return;
      }

      const boxCode = normalizeAssetCode(row.boxId);
      if (!boxCode) {
        setError("Informe o ID da caixa.");
        return;
      }

      const asset = assets.find((a) => a.code === boxCode);
      if (!asset || asset.type !== "caixa_media") {
        setError(`Caixa média não cadastrada: ${boxCode}`);
        return;
      }

      if (usedBoxes.has(boxCode)) {
        setError(`Caixa repetida no lote: ${boxCode}`);
        return;
      }
      usedBoxes.add(boxCode);

      const existingStock = stock.find(
        (s) => s.asset_id === asset.id && s.quantity > 0
      );
      if (existingStock) {
        setError(`Caixa ocupada: ${boxCode}`);
        return;
      }

      const qty = Number(row.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        setError("Cada caixa deve ter entre 1 e 100 pops.");
        return;
      }

      poolTotals[row.poolId] = (poolTotals[row.poolId] || 0) + qty;
      if (poolTotals[row.poolId] > pool.quantity) {
        setError(`Quantidade excede o saldo de ${pool.grade}.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const batchId = `PACK-${String(Date.now()).slice(-6)}`;

      for (const row of rows) {
        const pool = awaitingPacking.find((p) => p.id === row.poolId);
        const boxCode = normalizeAssetCode(row.boxId);
        const asset = assets.find((a) => a.code === boxCode);

        await createFill({
          asset_id: asset!.id,
          inspection_id: pool?.inspection_id || "",
          pool_stock_id: row.poolId,
          quantity: Number(row.quantity),
          location_id: row.locationId,
          batch_id: batchId,
        });
      }

      setRows([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao registrar enchimento"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPoolInfo = (poolId: string) => {
    const pool = awaitingPacking.find((p) => p.id === poolId);
    const usedInRows = rows
      .filter((r) => r.poolId === poolId)
      .reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    return {
      pool,
      remaining: pool ? pool.quantity - usedInRows : 0,
    };
  };

  const getProductInfo = (pool: (typeof stock)[0]) => {
    const inspection = inspections.find((i) => i.id === pool.inspection_id);
    const product = inspection
      ? products.find((p) => p.id === inspection.product_id)
      : undefined;
    return { inspection, product };
  };

  if (awaitingPacking.length === 0) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center">
        <Box className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Nenhum produto para encaixotar</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          Produtos classificados aparecerão aqui após a conferência/inspeção.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="py-6 md:py-8">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          ENCAIXOTAR
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">
          Vincular a caixas físicas
        </h1>
        <p className="text-muted-foreground mt-1">
          {totalAwaiting} unidades aguardando encaixotamento
        </p>
      </div>

      <div className="bg-muted/50 text-sm rounded-lg p-4 mb-6">
        Encha as caixas fisicamente, escaneie os IDs e confirme o conjunto.
        Nenhum saldo muda até confirmar o lote.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Produtos classificados aguardando caixa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {awaitingPacking.map((pool) => {
              const { remaining } = getPoolInfo(pool.id);
              const { product, inspection } = getProductInfo(pool);

              return (
                <Card key={pool.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        variant={
                          pool.grade === "AAA"
                            ? "default"
                            : pool.grade === "B"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {pool.grade}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {remaining} restantes
                      </span>
                    </div>
                    <p className="font-medium text-sm mb-1">
                      {product?.flavor || product?.name || "Produto"}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {inspection?.lot || "Sem lote"} · {pool.quantity} pops
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addRow(pool.id)}
                      disabled={remaining <= 0}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar caixa
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {rows.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Caixas a preencher neste lote
            </h3>
            {rows.map((row, index) => {
              const pool = awaitingPacking.find((p) => p.id === row.poolId);
              const { product } = pool ? getProductInfo(pool) : { product: undefined };

              return (
                <Card key={row.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <strong className="text-sm">
                        Caixa {index + 1} · {pool?.grade} ·{" "}
                        {product?.flavor || "Produto"}
                      </strong>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Escanear ID permanente</Label>
                        <Input
                          placeholder="MEDIA-001"
                          value={row.boxId}
                          onChange={(e) =>
                            updateRow(row.id, "boxId", e.target.value)
                          }
                          list="empty-boxes"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={row.quantity}
                          onChange={(e) =>
                            updateRow(row.id, "quantity", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Destino após encaixotar</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={row.locationId}
                          onChange={(e) =>
                            updateRow(row.id, "locationId", e.target.value)
                          }
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <datalist id="empty-boxes">
          {emptyBoxes.map((box) => (
            <option key={box.id} value={box.code}>
              {box.name}
            </option>
          ))}
        </datalist>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        {rows.length > 0 && (
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? "Confirmando..." : "Confirmar lote de caixas"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </form>
    </div>
  );
}
