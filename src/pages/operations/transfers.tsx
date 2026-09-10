import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeftRight, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";

export function TransfersPage() {
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
          03 / MOVIMENTAR
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">
          Caixas no lugar certo.
        </h1>
        <p className="text-muted-foreground mt-1">
          Movimente caixas inteiras ou retire unidades de uma caixa de separação.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/operations/transfers/batch">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                <ArrowLeftRight className="w-5 h-5" />
              </span>
              <strong className="text-lg">Transferir caixas</strong>
              <p className="text-sm text-muted-foreground mt-1">
                Escaneie um grupo de caixas e escolha o destino.
              </p>
              <p className="text-xs text-primary mt-4">LOTE</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/operations/picking">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Package2 className="w-5 h-5" />
              </span>
              <strong className="text-lg">Separar produtos</strong>
              <p className="text-sm text-muted-foreground mt-1">
                Abra uma caixa, registre retiradas e acompanhe o saldo.
              </p>
              <p className="text-xs text-primary mt-4">UNIDADES</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export function BatchTransferPage() {
  const navigate = useNavigate();
  const { stock, locations, assets, products, transferBoxes } = useAppStore();

  const [codes, setCodes] = useState("");
  const [destination, setDestination] = useState(locations[2]?.id || locations[0]?.id);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizeCode = (code: string) =>
    code.trim().toUpperCase().replace(/[\s_-]+/g, "-");

  const parseIds = () =>
    codes
      .split(/[,;\r\n]+/)
      .map(normalizeCode)
      .filter(Boolean);

  const availableStock = stock.filter(
    (s) =>
      s.quantity > 0 &&
      s.status === "available" &&
      s.asset_id &&
      !s.is_active_separation
  );

  const getStockFromCode = (code: string) => {
    const asset = assets.find((a) => a.code === code);
    if (!asset) return null;
    return availableStock.find((s) => s.asset_id === asset.id);
  };

  const previewBoxes = parseIds()
    .map((code) => {
      const stockItem = getStockFromCode(code);
      if (!stockItem) return null;
      const product = products.find((p) => p.id === stockItem.product_id);
      const location = locations.find((l) => l.id === stockItem.location_id);
      return {
        code,
        stock: stockItem,
        product,
        location,
      };
    })
    .filter(Boolean) as Array<{
    code: string;
    stock: (typeof availableStock)[0];
    product: (typeof products)[0] | undefined;
    location: (typeof locations)[0] | undefined;
  }>;

  const totalPops = previewBoxes.reduce((s, b) => s + b.stock.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const ids = parseIds();
    if (ids.length === 0) {
      setError("Escaneie ou digite pelo menos uma caixa.");
      return;
    }

    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      setError("Uma caixa aparece mais de uma vez.");
      return;
    }

    const stockIds: string[] = [];
    for (const code of ids) {
      const stockItem = getStockFromCode(code);
      if (!stockItem) {
        setError(`Caixa sem estoque disponível: ${code}`);
        return;
      }
      if (stockItem.location_id === destination) {
        setError(`Uma das caixas já está no destino. Remova-a do lote.`);
        return;
      }
      stockIds.push(stockItem.id);
    }

    setIsSubmitting(true);

    try {
      await transferBoxes(stockIds, destination);
      navigate("/operations/transfers", {
        state: { toast: `${stockIds.length} caixas transferidas` },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao transferir");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <Link
        to="/operations/transfers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Movimentar
      </Link>

      <div className="py-6">
        <h1 className="text-2xl md:text-3xl font-bold">Transferir caixas</h1>
        <p className="text-muted-foreground mt-1">
          Escaneie as caixas que serão movidas juntas.
        </p>
      </div>

      <div className="bg-muted/50 text-sm rounded-lg p-4 mb-6">
        Escaneie as caixas que serão movidas juntas. O destino muda; a quantidade,
        lote, classificação e estado permanecem iguais.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>IDs das caixas</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y font-mono"
                placeholder={"CX-001\nCX-002\nMEDIA-003"}
                value={codes}
                onChange={(e) => setCodes(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Um código por linha ou separado por vírgulas. Leitor que preenche
                texto; câmera ainda não conectada.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Destino</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {previewBoxes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {previewBoxes.length} caixas · {totalPops} pops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {previewBoxes.map((box) => (
                  <div
                    key={box.code}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <strong className="text-sm">
                        {box.code} · {box.product?.flavor || box.product?.name} ·{" "}
                        {box.stock.quantity} pops
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {box.location?.name} · {box.stock.physical_state} ·{" "}
                        {box.stock.grade}
                        {box.stock.is_active_separation && " · caixa de separação"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/operations/transfers")}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={isSubmitting || previewBoxes.length === 0}>
            {isSubmitting ? "Transferindo..." : "Confirmar transferência do lote"}
          </Button>
        </div>
      </form>
    </div>
  );
}
