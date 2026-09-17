import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, QrCode, Package, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";
import { productStockLocations } from "@/lib/locations";
import { factoryLocation } from "@/lib/operational-assets";
import type { Product } from "@/types/database";

const PRODUCT_LINE_LABELS: Record<string, string> = {
  caipi: "Caipi",
  drinks: "Drinks",
  cremoso: "Cremoso",
  frutas: "Frutas",
};

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  embalagem: "Embalagem",
  envio: "Material de Envio",
  insumo: "Insumo",
  outro: "Outro",
};

function productLineLabel(value: string | null | undefined) {
  if (!value) return "";
  return PRODUCT_LINE_LABELS[value] || value;
}

function groupByLine(products: Product[], prefix: string) {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = productLineLabel(product.product_line) || "Outros";
    const list = groups.get(key) || [];
    list.push(product);
    groups.set(key, list);
  }
  const entries = [...groups.entries()];
  return entries.map(([line, items]) => ({
    label: entries.length > 1 ? `${prefix} · ${line}` : prefix,
    items,
  }));
}

function sortCatalog(products: Product[]) {
  return [...products].sort((a, b) => {
    const line = (a.product_line || a.category || "").localeCompare(b.product_line || b.category || "", "pt-BR");
    if (line !== 0) return line;
    return a.code.localeCompare(b.code, "pt-BR");
  });
}

function skuOptionLabel(product: Product) {
  const formatIcon = product.format === "congelado" ? "❄️" : product.format === "liquido" ? "💧" : "";
  const line = productLineLabel(product.product_line);
  const units = product.base_quantity || 1;
  return [formatIcon, `${product.code} - ${product.name}`, line ? `• ${line}` : "", `(${units} un)`]
    .filter(Boolean)
    .join(" ");
}

function materialOptionLabel(product: Product) {
  const category = product.category ? MATERIAL_CATEGORY_LABELS[product.category] || product.category : "";
  return [`📦 ${product.code} - ${product.name}`, category ? `• ${category}` : ""].filter(Boolean).join(" ");
}

interface ReceiptItem {
  id: string;
  productId: string;
  quantity: string;
  lot: string;
}

interface ScannedBox {
  code: string;
  asset: ReturnType<typeof useAppStore.getState>["assets"][0] | null;
  status: "found" | "not_found" | "already_here";
}

function inventoryDestinations(locations: ReturnType<typeof useAppStore.getState>["locations"]) {
  return productStockLocations(locations, true).filter((location) => location.type !== "receiving");
}

function defaultInventoryLocationId(locations: ReturnType<typeof useAppStore.getState>["locations"]) {
  const destinations = inventoryDestinations(locations);
  return (
    destinations.find((location) => location.type === "storage")?.id ||
    destinations[0]?.id ||
    ""
  );
}

export function ReceivingPage() {
  const navigate = useNavigate();
  const { products, locations, assets, createReceipt, updateAsset, fetchAssets, fetchProducts, fetchLocations } = useAppStore();
  const activeProducts = products.filter((p) => p.is_active !== false);
  const simpleProducts = sortCatalog(activeProducts.filter((p) => p.kind === "pop" && !p.is_composite));
  const compositeProducts = sortCatalog(activeProducts.filter((p) => p.kind === "pop" && p.is_composite));
  const materialProducts = sortCatalog(activeProducts.filter((p) => p.kind === "material"));
  const allProducts = [...simpleProducts, ...compositeProducts, ...materialProducts];
  const receivingLocation =
    productStockLocations(locations, true).find((l) => l.type === "receiving") ||
    productStockLocations(locations, true)[0] ||
    locations[0];
  const stockDestinations = inventoryDestinations(locations);

  const [nfNumber, setNfNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [receiptOrigin, setReceiptOrigin] = useState<"factory" | "supplier" | "internal">("supplier");
  const [destinationId, setDestinationId] = useState("");
  const isDirect = receiptOrigin !== "factory";
  const destinationName = stockDestinations.find((location) => location.id === destinationId)?.name;
  const defaultProductId = isDirect
    ? materialProducts[0]?.id || ""
    : simpleProducts[0]?.id || compositeProducts[0]?.id || materialProducts[0]?.id || "";
  const [items, setItems] = useState<ReceiptItem[]>([
    { id: "1", productId: defaultProductId, quantity: "", lot: "" },
  ]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // QR Scanner state
  const [scannerInput, setScannerInput] = useState("");
  const [scannedBoxes, setScannedBoxes] = useState<ScannedBox[]>([]);
  const [scannerFocused, setScannerFocused] = useState(false);
  const [showBoxDropdown, setShowBoxDropdown] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  // Available boxes for dropdown (boxes that are at factory or in transit)
  const factory = factoryLocation(locations);
  const availableBoxes = assets.filter(a => 
    (a.type === "caixa_preta" || a.type === "caixa_grande" || a.type === "caixa_media") &&
    (a.status === "at_factory" || a.location_id === factory?.id || a.status === "in_transit" || a.status === "available") &&
    !scannedBoxes.some(b => b.code === a.code)
  );

  useEffect(() => {
    fetchAssets();
    fetchProducts();
    fetchLocations();
  }, [fetchAssets, fetchProducts, fetchLocations]);

  useEffect(() => {
    if (!isDirect) return;
    setDestinationId((current) => current || defaultInventoryLocationId(locations));
  }, [isDirect, locations]);

  useEffect(() => {
    if (!defaultProductId) return;
    setItems((current) => {
      const next = current.map((item) =>
        item.productId ? item : { ...item, productId: defaultProductId }
      );
      return next.some((item, index) => item.productId !== current[index].productId) ? next : current;
    });
  }, [defaultProductId]);

  const normalizeCode = (code: string) =>
    code.trim().toUpperCase().replace(/[\s_]+/g, "-");

  const handleScanInput = (value: string) => {
    setScannerInput(value);
    
    // Auto-process when Enter is pressed or after a short delay (barcode scanner behavior)
    if (value.includes("\n") || value.includes("\r")) {
      const codes = value.split(/[\r\n]+/).map(normalizeCode).filter(Boolean);
      codes.forEach(addScannedBox);
      setScannerInput("");
    }
  };

  const addScannedBox = (code: string) => {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) return;

    // Check if already scanned
    if (scannedBoxes.some(b => b.code === normalizedCode)) {
      return;
    }

    const asset = assets.find(a => a.code === normalizedCode);
    
    let status: ScannedBox["status"] = "not_found";
    if (asset) {
      if (asset.location_id === receivingLocation?.id) {
        status = "already_here";
      } else {
        status = "found";
      }
    }

    setScannedBoxes(prev => [...prev, { code: normalizedCode, asset: asset || null, status }]);
  };

  const removeScannedBox = (code: string) => {
    setScannedBoxes(prev => prev.filter(b => b.code !== code));
  };

  const addBoxFromDropdown = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    
    const normalizedCode = normalizeCode(asset.code);
    if (scannedBoxes.some(b => b.code === normalizedCode)) return;

    setScannedBoxes(prev => [...prev, { 
      code: normalizedCode, 
      asset, 
      status: asset.location_id === receivingLocation?.id ? "already_here" : "found" 
    }]);
  };

  const handleManualAdd = () => {
    const code = normalizeCode(scannerInput);
    if (code) {
      addScannedBox(code);
      setScannerInput("");
      scannerRef.current?.focus();
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: String(Date.now()),
        productId: defaultProductId,
        quantity: "",
        lot: "",
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
    useAppStore.getState().products.find((p) => p.id === productId);

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
      setError(isDirect ? "Adicione pelo menos um material." : "Adicione pelo menos um produto.");
      return;
    }

    if (isDirect && !destinationId) {
      setError("Selecione o local de estoque.");
      return;
    }

    for (const item of items) {
      const productId = item.productId || defaultProductId;
      const product = getProduct(productId);
      if (!product) {
        setError("Selecione um produto válido.");
        return;
      }

      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Informe uma quantidade válida para ${product.name}.`);
        return;
      }

      if (isDirect && product.kind === "pop") {
        setError("Nota de fornecedor não recebe pops. Use origem Fábrica para produto que vai a Preparar.");
        return;
      }

      if (product.kind === "pop" && !item.lot.trim()) {
        setError(`Informe o lote de ${product.name}.`);
        return;
      }
    }

    // Validate boxes for factory receipts
    if (receiptOrigin === "factory" && scannedBoxes.length === 0) {
      setError("Escaneie ou selecione pelo menos uma caixa retornável.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Update scanned boxes: move them to receiving location with "with_product" status
      const boxUpdates = scannedBoxes
        .filter(b => b.status === "found" && b.asset)
        .map(b => updateAsset(b.asset!.id, {
          location_id: receivingLocation.id,
          status: "with_product",
        }));
      
      await Promise.all(boxUpdates);

      // Get box codes from scanned boxes for the receipt
      const allBoxCodes = scannedBoxes.map(b => b.code);

      const destination = isDirect ? destinationId : receivingLocation.id;
      const closeNotes =
        receiptOrigin === "internal"
          ? "Entrada direta — transferência interna"
          : "Entrada direta — fornecedor";

      const receipt = await createReceipt({
        nf_number: nfNumber.trim(),
        supplier: supplier.trim(),
        receipt_date: receiptDate,
        location_id: destination,
        direct: isDirect,
        close_notes: isDirect ? closeNotes : undefined,
        items: items.map((item) => ({
          product_id: item.productId || defaultProductId,
          quantity: Number(item.quantity),
          lot: item.lot.trim() || undefined,
          source_box_codes: receiptOrigin === "factory" ? allBoxCodes : undefined,
        })),
      });

      const boxCount = scannedBoxes.filter(b => b.status === "found").length;
      const message = isDirect
        ? `NF ${receipt.nf_number} registrada. Materiais no estoque.`
        : boxCount > 0
          ? `Recebimento ${receipt.receipt_number} registrado. ${boxCount} caixa(s) movida(s) para recebimento. Produtos em análise.`
          : `Recebimento ${receipt.receipt_number} registrado. Produtos em análise.`;

      navigate(isDirect ? "/gestao/receipts" : "/operacoes/preparar", {
        state: { toast: message },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar recebimento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="py-6">
        <h1 className="text-2xl md:text-3xl font-bold">Recebimento</h1>
        <p className="text-muted-foreground mt-1">
          {isDirect
            ? "Nota de fornecedor · entra no estoque e na lista de NFs"
            : "Uma nota fiscal · vários produtos · todas as caixas"}
        </p>
      </div>

      <div className="bg-primary/10 text-primary rounded-lg p-4 mb-6 text-sm">
        {isDirect
          ? `A nota entra no estoque agora${destinationName ? ` em ${destinationName}` : ""}. Não passa por Preparar.`
          : `Recebimento em ${receivingLocation?.name || "Recebimento"}. Registre todos os produtos da mesma nota fiscal. Quantidades ficam em análise até a conferência.`}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Documento de entrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Origem</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={receiptOrigin}
                  onChange={(e) => {
                    const next = e.target.value as "factory" | "supplier" | "internal";
                    setReceiptOrigin(next);
                    if (next === "factory") {
                      setSupplier((current) => current || "Fábrica");
                      setDestinationId("");
                      setItems([{ id: "1", productId: simpleProducts[0]?.id || compositeProducts[0]?.id || materialProducts[0]?.id || "", quantity: "", lot: "" }]);
                    } else {
                      if (supplier === "Fábrica") setSupplier("");
                      setScannedBoxes([]);
                      setDestinationId(defaultInventoryLocationId(locations));
                      setItems([{ id: "1", productId: materialProducts[0]?.id || "", quantity: "", lot: "" }]);
                    }
                  }}
                >
                  <option value="factory">Fábrica</option>
                  <option value="supplier">Fornecedor</option>
                  <option value="internal">Transferência interna</option>
                </select>
              </div>
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
                <Label htmlFor="supplier">
                  {receiptOrigin === "factory" ? "Fábrica" : receiptOrigin === "internal" ? "Origem" : "Fornecedor"}
                </Label>
                <Input
                  id="supplier"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder={receiptOrigin === "factory" ? "Nome da fábrica" : receiptOrigin === "internal" ? "Local de origem" : "Nome do fornecedor"}
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
            </div>
            {isDirect && (
              <div className="space-y-2">
                <Label htmlFor="destination">Local de estoque</Label>
                <select
                  id="destination"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecione o local...
                  </option>
                  {stockDestinations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Scanner Section - Only for factory receipts */}
        {receiptOrigin === "factory" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              2. Escanear caixas retornáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={scannerRef}
                  value={scannerInput}
                  onChange={(e) => handleScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleManualAdd();
                    }
                  }}
                  onFocus={() => setScannerFocused(true)}
                  onBlur={() => setScannerFocused(false)}
                  placeholder="Escaneie ou digite o código da caixa..."
                  className={`h-12 text-lg font-mono ${scannerFocused ? "ring-2 ring-primary" : ""}`}
                />
                {scannerFocused && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Badge variant="secondary" className="text-xs animate-pulse">
                      Aguardando scan...
                    </Badge>
                  </div>
                )}
              </div>
              <Button type="button" onClick={handleManualAdd} className="h-12 px-6">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {scannedBoxes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {scannedBoxes.length} caixa(s) escaneada(s)
                </Label>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {scannedBoxes.map((box) => (
                    <div
                      key={box.code}
                      className="flex items-center justify-between p-3 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {box.status === "found" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : box.status === "already_here" ? (
                          <Package className="w-5 h-5 text-blue-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        )}
                        <div>
                          <code className="font-mono font-medium">{box.code}</code>
                          {box.asset ? (
                            <p className="text-xs text-muted-foreground">
                              {box.asset.type === "caixa_preta" ? "Caixa Preta" : 
                               box.asset.type === "caixa_media" ? "Caixa Média" :
                               box.asset.type === "caixa_grande" ? "Caixa Grande" : box.asset.type}
                              {box.status === "already_here" && " • Já está no recebimento"}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600">
                              Caixa não cadastrada no sistema
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeScannedBox(box.code)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {scannedBoxes.some(b => b.status === "not_found") && (
                  <p className="text-xs text-amber-600">
                    Caixas não cadastradas serão registradas apenas como texto. Cadastre-as em Configurações → Embalagens para rastreamento completo.
                  </p>
                )}
              </div>
            )}

            {scannedBoxes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Use um leitor de código de barras ou digite manualmente
                </p>
                <p className="text-xs mt-1">
                  As caixas escaneadas serão movidas automaticamente para o recebimento
                </p>
              </div>
            )}

            {/* Box dropdown selector as alternative to scanning */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowBoxDropdown(!showBoxDropdown)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {showBoxDropdown ? "Ocultar" : "Selecionar"} caixas da lista
                <Package className="w-4 h-4" />
              </button>
              
              {showBoxDropdown && (
                <div className="mt-3 space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Selecione caixas cadastradas ({availableBoxes.length} disponíveis)
                  </Label>
                  {availableBoxes.length > 0 ? (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {availableBoxes.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => addBoxFromDropdown(asset.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left border-b last:border-b-0"
                        >
                          <div>
                            <code className="font-mono font-medium">{asset.code}</code>
                            <p className="text-xs text-muted-foreground">
                              {asset.type === "caixa_preta" ? "Caixa Preta" : 
                               asset.type === "caixa_media" ? "Caixa Média" :
                               asset.type === "caixa_grande" ? "Caixa Grande" : asset.type}
                              {asset.description && ` • ${asset.description}`}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {asset.status === "at_factory" || asset.location_id === factory?.id ? "Fábrica" :
                             asset.status === "in_transit" ? "Em trânsito" : "Disponível"}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Nenhuma caixa disponível para seleção.
                      {scannedBoxes.length > 0 && " (todas já foram adicionadas)"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {receiptOrigin === "factory" ? "3. Produtos e caixas" : "2. Materiais"}
          </h2>

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

                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Produto / SKU</Label>
                      <select
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={item.productId || defaultProductId}
                        onChange={(e) =>
                          updateItem(item.id, "productId", e.target.value)
                        }
                      >
                        <option value="" disabled>
                          Selecione um produto...
                        </option>
                        {isDirect ? (
                          materialProducts.length > 0 ? (
                            Object.entries(
                              materialProducts.reduce<Record<string, typeof materialProducts>>((groups, product) => {
                                const key = product.category
                                  ? MATERIAL_CATEGORY_LABELS[product.category] || product.category
                                  : "Outros";
                                (groups[key] ||= []).push(product);
                                return groups;
                              }, {})
                            ).map(([label, groupItems]) => (
                              <optgroup key={label} label={label}>
                                {groupItems.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {materialOptionLabel(p)}
                                  </option>
                                ))}
                              </optgroup>
                            ))
                          ) : (
                            <option value="" disabled>
                              Cadastre materiais em Cadastros
                            </option>
                          )
                        ) : (
                          <>
                            {simpleProducts.length > 0 &&
                              groupByLine(simpleProducts, "SKUs Simples").map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.items.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {skuOptionLabel(p)}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            {compositeProducts.length > 0 &&
                              groupByLine(compositeProducts, "SKUs Compostos").map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                  {group.items.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {skuOptionLabel(p)}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            {materialProducts.length > 0 && (
                              <optgroup label="Materiais">
                                {materialProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {materialOptionLabel(p)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        )}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade total</Label>
                      <Input
                        type="number"
                        min="1"
                        step={product?.unit === "un" ? "1" : "0.001"}
                        className="h-11"
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
                        className="h-11"
                        value={item.lot}
                        onChange={(e) =>
                          updateItem(item.id, "lot", e.target.value)
                        }
                        required={isPop}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar {isDirect ? "material" : "produto"}
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center gap-4 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Registrando..." : isDirect ? "Registrar nota e estoque" : "Registrar recebimento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
