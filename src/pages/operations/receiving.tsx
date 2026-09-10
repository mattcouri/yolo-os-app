import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/stores";

interface ReceiptItem {
  id: string;
  productId: string;
  quantity: string;
  lot: string;
  boxCodes: string;
}

export function ReceivingPage() {
  const navigate = useNavigate();
  const { products, locations, createReceipt } = useAppStore();
  const popProducts = products.filter((p) => p.kind === "pop");
  const materialProducts = products.filter((p) => p.kind === "material");
  const allProducts = [...popProducts, ...materialProducts];
  const receivingLocation = locations.find((l) => l.type === "receiving") || locations[0];

  const [nfNumber, setNfNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [items, setItems] = useState<ReceiptItem[]>([
    { id: "1", productId: popProducts[0]?.id || "", quantity: "", lot: "", boxCodes: "" },
  ]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        productId: popProducts[0]?.id || "",
        quantity: "",
        lot: "",
        boxCodes: "",
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ReceiptItem, value: string) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const getProduct = (productId: string) =>
    allProducts.find((p) => p.id === productId);

  const normalizeBoxCode = (code: string) =>
    code.trim().toUpperCase().replace(/[\s_-]+/g, "-");

  const parseBoxCodes = (codes: string) =>
    codes
      .split(/[,;\r\n]+/)
      .map(normalizeBoxCode)
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nfNumber.trim() || !supplier.trim() || !receiptDate) {
      setError("Preencha os dados da nota fiscal.");
      return;
    }

    if (items.length === 0) {
      setError("Adicione pelo menos um produto.");
      return;
    }

    const usedCodes = new Set<string>();

    for (const item of items) {
      const product = getProduct(item.productId);
      if (!product) {
        setError("Selecione um produto válido.");
        return;
      }

      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Informe uma quantidade válida para ${product.name}.`);
        return;
      }

      if (product.kind === "pop" && !item.lot.trim()) {
        setError(`Informe o lote de ${product.name}.`);
        return;
      }

      const codes = parseBoxCodes(item.boxCodes);
      if (product.kind === "pop" && codes.length === 0) {
        setError(`Informe as caixas de ${product.name}.`);
        return;
      }

      for (const code of codes) {
        if (usedCodes.has(code)) {
          setError(`Caixa repetida neste recebimento: ${code}`);
          return;
        }
        usedCodes.add(code);
      }
    }

    setIsSubmitting(true);

    try {
      const receipt = await createReceipt({
        nf_number: nfNumber.trim(),
        supplier: supplier.trim(),
        receipt_date: receiptDate,
        location_id: receivingLocation.id,
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: Number(item.quantity),
          lot: item.lot.trim() || undefined,
          source_box_codes: parseBoxCodes(item.boxCodes),
        })),
      });

      navigate("/operations/inspection", {
        state: { toast: `Recebimento ${receipt.receipt_number} registrado. Produtos em análise.` },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar recebimento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <Link
        to="/operations/actions"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Operações
      </Link>

      <div className="py-6">
        <h1 className="text-2xl md:text-3xl font-bold">Recebimento</h1>
        <p className="text-muted-foreground mt-1">
          Uma nota fiscal · vários produtos · todas as caixas
        </p>
      </div>

      <div className="bg-primary/10 text-primary rounded-lg p-4 mb-6 text-sm">
        Recebimento em {receivingLocation?.name || "Recebimento"}. Registre todos os
        produtos da mesma nota fiscal. Quantidades ficam em análise até a conferência.
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Documento de entrada</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nf">Número da nota fiscal</Label>
              <Input
                id="nf"
                value={nfNumber}
                onChange={(e) => setNfNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data de recebimento</Label>
              <Input
                id="date"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">2. Produtos e caixas</h2>

          {items.map((item, index) => {
            const product = getProduct(item.productId);
            const isPop = product?.kind === "pop";

            return (
              <Card key={item.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <strong className="text-sm">Item do recebimento</strong>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remover
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Produto / SKU</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={item.productId}
                        onChange={(e) =>
                          updateItem(item.id, "productId", e.target.value)
                        }
                      >
                        {allProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade total</Label>
                      <Input
                        type="number"
                        min="1"
                        step={product?.unit === "un" ? "1" : "0.001"}
                        placeholder="235"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, "quantity", e.target.value)
                        }
                        required
                      />
                      <small className="text-xs text-muted-foreground">
                        Unidade: {product?.unit || "un"}
                      </small>
                    </div>
                    <div className="space-y-2">
                      <Label>Lote</Label>
                      <Input
                        placeholder="Lote do fabricante"
                        value={item.lot}
                        onChange={(e) =>
                          updateItem(item.id, "lot", e.target.value)
                        }
                        required={isPop}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Códigos das caixas retornáveis{" "}
                      <span className="text-muted-foreground">
                        ({isPop ? "obrigatório" : "opcional"})
                      </span>
                    </Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                      placeholder="PRETA-001, PRETA-007, PRETA-030"
                      value={item.boxCodes}
                      onChange={(e) =>
                        updateItem(item.id, "boxCodes", e.target.value)
                      }
                      required={isPop}
                    />
                    <small className="text-xs text-muted-foreground">
                      Digite códigos separados por vírgula ou escaneie com leitor que
                      preenche texto, um código por linha. A quantidade acima é o total
                      do produto em todas estas caixas.
                    </small>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar produto
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/operations/actions")}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : "Registrar recebimento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
