import { useState } from "react";
import { Grid3X3, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";
import { productStockLocations } from "@/lib/locations";

export function InventoryCountPage() {
  const {
    inventoryCounts,
    inventoryCountLines,
    stock,
    assets,
    products,
    locations,
    createInventoryCount,
    updateInventoryCount,
  } = useAppStore();

  const productLocations = productStockLocations(locations, true);
  const [selectedLocation, setSelectedLocation] = useState(
    productLocations[0]?.id || locations[0]?.id
  );
  const [activeCount, setActiveCount] = useState<string | null>(null);
  const [error, setError] = useState("");

  const countingCount = inventoryCounts.find((c) => c.status === "counting");
  const pendingApproval = inventoryCounts.filter(
    (c) => c.status === "pending_approval"
  );
  const recentCounts = inventoryCounts.filter(
    (c) => c.status !== "counting" && c.status !== "pending_approval"
  );

  const eligibleStock = stock.filter(
    (s) =>
      s.quantity > 0 &&
      s.status === "available" &&
      s.asset_id &&
      assets.some((a) => a.id === s.asset_id && a.type === "caixa_media")
  );

  const startCount = async () => {
    if (countingCount) {
      setError("Já existe uma contagem em andamento.");
      return;
    }

    try {
      const count = await createInventoryCount(selectedLocation);
      setActiveCount(count.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar contagem");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          CONTAGEM FÍSICA
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">Inventário</h1>
        <p className="text-muted-foreground mt-1">
          Conte um local por vez e compare o físico com o sistema.
        </p>
      </div>

      {!countingCount && !activeCount && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Iniciar uma contagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha o local. O sistema cria uma fotografia do saldo esperado e
              aguarda os códigos encontrados.
            </p>

            <div className="space-y-2">
              <Label>Local a contar</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {productLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}

            <Button onClick={startCount}>Começar inventário</Button>
          </CardContent>
        </Card>
      )}

      {(countingCount || activeCount) && (
        <ActiveCountView
          countId={activeCount || countingCount?.id || ""}
          onFinish={() => setActiveCount(null)}
        />
      )}

      {pendingApproval.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Aprovações de inventário</CardTitle>
            <Badge variant="secondary">{pendingApproval.length}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Ajustes alteram o saldo somente após aprovação.
            </p>
            {pendingApproval.map((count) => {
              const location = locations.find((l) => l.id === count.location_id);
              const lines = inventoryCountLines.filter((l) => l.count_id === count.id);
              const discrepancies = lines.filter((l) => l.issue !== "correct").length;
              return (
                <div
                  key={count.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <strong className="text-sm">
                      {count.count_number} · {location?.name}
                    </strong>
                    <p className="text-xs text-muted-foreground">
                      {discrepancies} divergências · {count.operator_notes || ""}
                    </p>
                  </div>
                  <Button size="sm">Revisar</Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contagens recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCounts.length > 0 ? (
            <div className="space-y-2">
              {recentCounts.slice(0, 5).map((count) => {
                const location = locations.find((l) => l.id === count.location_id);
                const lines = inventoryCountLines.filter(
                  (l) => l.count_id === count.id
                );
                const discrepancies = lines.filter(
                  (l) => l.issue !== "correct"
                ).length;
                return (
                  <div
                    key={count.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {count.count_number} · {location?.name}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {lines.length} caixas lidas · {discrepancies} divergências
                      </p>
                    </div>
                    <Badge
                      variant={
                        count.status === "approved" ? "default" : "secondary"
                      }
                    >
                      {count.status === "approved"
                        ? "Aprovado"
                        : count.status === "rejected"
                        ? "Devolvido"
                        : count.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhum inventário realizado nesta sessão.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveCountView({
  countId,
  onFinish,
}: {
  countId: string;
  onFinish: () => void;
}) {
  const {
    inventoryCounts,
    inventoryCountLines,
    stock,
    assets,
    products,
    locations,
    updateInventoryCount,
  } = useAppStore();

  const count = inventoryCounts.find((c) => c.id === countId);
  const location = locations.find((l) => l.id === count?.location_id);

  const [boxId, setBoxId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [lines, setLines] = useState<
    Array<{
      id: string;
      stockId: string;
      systemQty: number;
      actualQty: number;
      issue: string;
    }>
  >([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const eligibleStock = stock.filter(
    (s) =>
      s.quantity > 0 &&
      s.status === "available" &&
      s.asset_id &&
      s.location_id === count?.location_id &&
      assets.some((a) => a.id === s.asset_id && a.type === "caixa_media")
  );

  const normalizeCode = (code: string) =>
    code.trim().toUpperCase().replace(/[\s_-]+/g, "-");

  const addLine = () => {
    setError("");
    const code = normalizeCode(boxId);
    if (!code) {
      setError("Informe o código da caixa.");
      return;
    }

    if (lines.some((l) => assets.find((a) => a.id === stock.find((s) => s.id === l.stockId)?.asset_id)?.code === code)) {
      setError("Caixa já contada: " + code);
      return;
    }

    const asset = assets.find((a) => a.code === code);
    const stockItem = asset
      ? stock.find(
          (s) =>
            s.asset_id === asset.id &&
            s.quantity > 0 &&
            s.status === "available"
        )
      : null;

    if (!stockItem) {
      setError("Caixa não encontrada no estoque disponível: " + code);
      return;
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > 100) {
      setError("Informe uma quantidade entre 0 e 100.");
      return;
    }

    let issue = "correct";
    if (stockItem.location_id !== count?.location_id) {
      issue = "location_discrepancy";
    } else if (qty !== stockItem.quantity) {
      issue = "quantity_discrepancy";
    }

    setLines([
      ...lines,
      {
        id: String(Date.now()),
        stockId: stockItem.id,
        systemQty: stockItem.quantity,
        actualQty: qty,
        issue,
      },
    ]);

    setBoxId("");
    setQuantity("100");
  };

  const finishCount = async () => {
    const discrepancies = lines.filter((l) => l.issue !== "correct");
    if (discrepancies.length > 0 && !notes.trim()) {
      setError("Descreva o que foi verificado antes de enviar as divergências.");
      return;
    }

    await updateInventoryCount(countId, {
      status: discrepancies.length > 0 ? "pending_approval" : "approved",
      completed_at: new Date().toISOString(),
      operator_notes: notes.trim() || null,
    });

    onFinish();
  };

  const cancelCount = async () => {
    await updateInventoryCount(countId, { status: "rejected" });
    onFinish();
  };

  if (!count) return null;

  const comparison = [
    ...lines.map((l) => {
      const stockItem = stock.find((s) => s.id === l.stockId);
      const asset = assets.find((a) => a.id === stockItem?.asset_id);
      const product = products.find((p) => p.id === stockItem?.product_id);
      return {
        ...l,
        code: asset?.code || "",
        flavor: product?.flavor || product?.name || "",
        systemLocation: stockItem?.location_id || "",
      };
    }),
    ...eligibleStock
      .filter((s) => !lines.some((l) => l.stockId === s.id))
      .map((s) => {
        const asset = assets.find((a) => a.id === s.asset_id);
        const product = products.find((p) => p.id === s.product_id);
        return {
          id: s.id,
          stockId: s.id,
          code: asset?.code || "",
          flavor: product?.flavor || product?.name || "",
          systemQty: s.quantity,
          actualQty: null as number | null,
          systemLocation: s.location_id,
          issue: "not_found",
        };
      }),
  ];

  const correctCount = comparison.filter((l) => l.issue === "correct").length;
  const discrepancyCount = comparison.filter((l) => l.issue !== "correct").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-primary tracking-wider uppercase">
            {count.count_number} · EM CONTAGEM
          </span>
          <h2 className="text-xl font-bold">{location?.name}</h2>
          <p className="text-sm text-muted-foreground">
            Escaneie cada caixa encontrada e informe a quantidade real.
          </p>
        </div>
        <Button variant="outline" onClick={cancelCount}>
          Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Esperadas</p>
            <p className="text-2xl font-bold">{eligibleStock.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Escaneadas</p>
            <p className="text-2xl font-bold">{lines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Sem divergência</p>
            <p className="text-2xl font-bold">{correctCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Para revisar</p>
            <p className="text-2xl font-bold">{discrepancyCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 text-sm rounded-lg p-4">
        Caixas completas começam com 100; caixas parciais e de separação devem ser
        contadas. Escanear uma caixa de outro local identifica uma divergência de
        localização.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adicionar caixa encontrada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label>ID / QR da caixa</Label>
              <Input
                placeholder="MEDIA-001"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLine();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade física</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-destructive text-sm mb-4" role="alert">
              {error}
            </p>
          )}
          <Button onClick={addLine}>Adicionar à contagem</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Resultado provisório</CardTitle>
          <Badge variant="secondary">{comparison.length}</Badge>
        </CardHeader>
        <CardContent>
          {comparison.length > 0 ? (
            <div className="space-y-2">
              {comparison.map((line) => {
                const loc = locations.find((l) => l.id === line.systemLocation);
                return (
                  <div
                    key={line.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {line.code} · {line.flavor}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        Sistema: {line.systemQty} · {loc?.name} · físico:{" "}
                        {line.actualQty === null ? "Não encontrada" : `${line.actualQty} pops`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        line.issue === "correct"
                          ? "default"
                          : line.issue === "not_found"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {line.issue === "correct"
                        ? "Correto"
                        : line.issue === "not_found"
                        ? "Não encontrado"
                        : line.issue === "location_discrepancy"
                        ? "Local divergente"
                        : "Quantidade divergente"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Escaneie a primeira caixa.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Finalizar contagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Observação da conferência</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder="Obrigatória quando houver divergências"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            As divergências serão enviadas à Gestão. O saldo do sistema não será
            alterado agora.
          </p>
          <Button onClick={finishCount}>Finalizar e enviar para aprovação</Button>
        </CardContent>
      </Card>
    </div>
  );
}
