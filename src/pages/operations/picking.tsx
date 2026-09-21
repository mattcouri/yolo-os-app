import { useState } from "react";
import { Package, PackageMinus, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/stores";
import { ProductMark } from "@/components/product-mark";

export function PickingPage() {
  const {
    stock,
    products,
    locations,
    assets,
    movements,
    updateStock,
    withdrawFromBox,
  } = useAppStore();

  const availableStock = stock.filter(
    (s) =>
      s.quantity > 0 &&
      s.status === "available" &&
      s.asset_id &&
      assets.some((a) => a.id === s.asset_id && a.type === "caixa_media")
  );

  const activeSeparation = availableStock.filter((s) => s.is_active_separation);
  const reserveBoxes = availableStock.filter((s) => !s.is_active_separation);

  const recentWithdrawals = movements
    .filter((m) => m.type === "withdrawal")
    .slice(0, 10);

  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<"open" | "withdraw" | "close" | null>(
    null
  );

  const getBoxInfo = (stockId: string) => {
    const stockItem = stock.find((s) => s.id === stockId);
    if (!stockItem) return null;
    const product = products.find((p) => p.id === stockItem.product_id);
    const location = locations.find((l) => l.id === stockItem.location_id);
    const asset = assets.find((a) => a.id === stockItem.asset_id);
    return { stock: stockItem, product, location, asset };
  };

  const openSeparationBox = async (stockId: string) => {
    const info = getBoxInfo(stockId);
    if (!info) return;

    const existingActive = activeSeparation.find(
      (s) =>
        s.product_id === info.stock.product_id &&
        s.physical_state === info.stock.physical_state &&
        s.id !== stockId
    );

    if (existingActive) {
      alert(
        `Já existe uma caixa de separação para este produto e estado: ${
          getBoxInfo(existingActive.id)?.asset?.code
        }. Encerre-a antes de abrir outra.`
      );
      return;
    }

    await updateStock(stockId, { is_active_separation: true });
    setDialogMode(null);
  };

  const closeSeparationBox = async (stockId: string) => {
    await updateStock(stockId, { is_active_separation: false });
    setDialogMode(null);
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="py-6">
        <h1 className="text-2xl md:text-3xl font-bold">Caixa de separação</h1>
        <p className="text-muted-foreground mt-1">
          Abra, retire unidades e acompanhe o saldo.
        </p>
      </div>

      <div className="bg-muted/50 text-sm rounded-lg p-4 mb-6">
        Uma caixa de separação por produto e estado. Caixas parciais de reserva
        continuam no estoque; só a caixa ativa permite retiradas.
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Em separação</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSeparation.length > 0 ? (
            <div className="space-y-2">
              {activeSeparation.map((s) => {
                const info = getBoxInfo(s.id);
                if (!info) return null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        <ProductMark product={info.product} state={s.physical_state} />
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {info.asset?.code} · {s.quantity} pops · {s.grade} ·{" "}
                        {info.location?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBox(s.id);
                          setDialogMode("withdraw");
                        }}
                      >
                        <PackageMinus className="w-4 h-4 mr-1" />
                        Retirar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBox(s.id);
                          setDialogMode("close");
                        }}
                      >
                        Encerrar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma caixa aberta.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Abrir outra caixa</CardTitle>
        </CardHeader>
        <CardContent>
          {reserveBoxes.length > 0 ? (
            <div className="space-y-2">
              {reserveBoxes.map((s) => {
                const info = getBoxInfo(s.id);
                if (!info) return null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {info.asset?.code} · <ProductMark product={info.product} /> · {s.quantity} pops
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {s.physical_state === "frozen" ? "Congelado" : "Líquido"} ·{" "}
                        {s.grade} · {info.location?.name}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBox(s.id);
                        setDialogMode("open");
                      }}
                    >
                      <PackageOpen className="w-4 h-4 mr-1" />
                      Abrir
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sem caixas disponíveis.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas retiradas</CardTitle>
        </CardHeader>
        <CardContent>
          {recentWithdrawals.length > 0 ? (
            <div className="space-y-2">
              {recentWithdrawals.map((m) => {
                const info = m.stock_id ? getBoxInfo(m.stock_id) : null;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {info?.asset?.code || m.stock_id} · −{m.quantity} pops · saldo{" "}
                        {m.quantity_after}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {m.reason} · {new Date(m.created_at).toLocaleDateString("pt-BR")}{" "}
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nenhuma retirada nesta sessão.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedBox && dialogMode === "open" && (
        <OpenBoxDialog
          stockId={selectedBox}
          onClose={() => setDialogMode(null)}
          onConfirm={() => openSeparationBox(selectedBox)}
        />
      )}

      {selectedBox && dialogMode === "withdraw" && (
        <WithdrawDialog
          stockId={selectedBox}
          onClose={() => setDialogMode(null)}
        />
      )}

      {selectedBox && dialogMode === "close" && (
        <CloseBoxDialog
          stockId={selectedBox}
          onClose={() => setDialogMode(null)}
          onConfirm={() => closeSeparationBox(selectedBox)}
        />
      )}
    </div>
  );
}

function OpenBoxDialog({
  stockId,
  onClose,
  onConfirm,
}: {
  stockId: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { stock, products, locations, assets } = useAppStore();
  const stockItem = stock.find((s) => s.id === stockId);
  const product = products.find((p) => p.id === stockItem?.product_id);
  const location = locations.find((l) => l.id === stockItem?.location_id);
  const asset = assets.find((a) => a.id === stockItem?.asset_id);

  if (!stockItem || !product) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa de separação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            <strong>
              {asset?.code} · <ProductMark product={product} />
            </strong>
          </p>
          <p className="text-sm text-muted-foreground">
            {stockItem.quantity} pops ·{" "}
            {stockItem.physical_state === "frozen" ? "Congelado" : "Líquido"} ·{" "}
            {stockItem.grade} · {location?.name}
          </p>
          <p className="text-sm">
            Uma caixa ativa por produto e estado. Nenhuma quantidade será retirada ao
            abrir.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onConfirm}>Abrir para separação</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  stockId,
  onClose,
}: {
  stockId: string;
  onClose: () => void;
}) {
  const { stock, products, assets, withdrawFromBox } = useAppStore();
  const stockItem = stock.find((s) => s.id === stockId);
  const product = products.find((p) => p.id === stockItem?.product_id);
  const asset = assets.find((a) => a.id === stockItem?.asset_id);

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!stockItem || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > stockItem.quantity) {
      setError("Informe uma quantidade inteira entre 1 e o saldo disponível.");
      return;
    }

    if (!reason.trim()) {
      setError("Informe a finalidade ou referência da retirada.");
      return;
    }

    setIsSubmitting(true);

    try {
      await withdrawFromBox(stockId, qty, reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar retirada");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar de {asset?.code}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <ProductMark product={product} /> ·{" "}
            {stockItem.physical_state === "frozen" ? "Congelado" : "Líquido"} · saldo:{" "}
            <strong>{stockItem.quantity} pops</strong>
          </p>

          <div className="space-y-2">
            <Label>Quantidade retirada</Label>
            <Input
              type="number"
              min="1"
              max={stockItem.quantity}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Finalidade / referência</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Pedido PED-0012, Amostra cliente X"
              required
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Retirada de demonstração, ainda sem pedido ou faturamento. Ao zerar, a
            caixa fica vazia e mantém seu histórico.
          </p>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Confirmar retirada"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseBoxDialog({
  stockId,
  onClose,
  onConfirm,
}: {
  stockId: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { stock, assets } = useAppStore();
  const stockItem = stock.find((s) => s.id === stockId);
  const asset = assets.find((a) => a.id === stockItem?.asset_id);

  if (!stockItem) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar separação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>
            {asset?.code} continuará com <strong>{stockItem.quantity} pops</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Ela deixa de ser a caixa de separação, permitindo abrir outra do mesmo
            produto e estado.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onConfirm}>Encerrar separação</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
