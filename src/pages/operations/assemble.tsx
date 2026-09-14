import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Layers, PackageOpen, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assembledLocation,
  assembledOnHand,
  bomNeeds,
  boxCapacity,
  findAssemblyBox,
  isAssemblyBox,
  physicalStateOf,
  stateLabel,
} from "@/lib/assembly";
import { useAppStore } from "@/stores";
import type { PhysicalState, Product } from "@/types/database";

function productLabel(product?: Product | null) {
  return product?.flavor || product?.name || "SKU";
}

export function AssemblePage() {
  const {
    stock,
    products,
    productComponents,
    assets,
    locations,
    assembleSku,
    unbuildSku,
    fetchProductComponents,
  } = useAppStore();

  useEffect(() => {
    void fetchProductComponents();
  }, [fetchProductComponents]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [skuId, setSkuId] = useState("");
  const [skuQty, setSkuQty] = useState("1");
  const [skuState, setSkuState] = useState<PhysicalState>("liquid");
  const [unbuildId, setUnbuildId] = useState("");
  const [unbuildQty, setUnbuildQty] = useState("1");

  const assembled = assembledLocation(locations);
  const composites = useMemo(
    () => products.filter((product) => product.kind === "pop" && product.is_composite && product.is_active),
    [products]
  );
  const assemblyBoxes = useMemo(
    () =>
      stock
        .filter((item) => isAssemblyBox(item) && item.quantity > 0)
        .sort((a, b) => {
          const left = products.find((product) => product.id === a.product_id);
          const right = products.find((product) => product.id === b.product_id);
          return productLabel(left).localeCompare(productLabel(right), "pt-BR");
        }),
    [stock, products]
  );
  const assembledStock = useMemo(
    () =>
      stock.filter(
        (item) =>
          item.location_id === assembled?.id &&
          item.quantity > 0 &&
          item.status !== "depleted" &&
          products.some((product) => product.id === item.product_id && product.is_composite)
      ),
    [stock, assembled?.id, products]
  );

  const selectedSku = products.find((product) => product.id === skuId);
  const selectedNeeds = useMemo(() => {
    if (!selectedSku || !skuQty) return [];
    const qty = Number(skuQty);
    if (!Number.isInteger(qty) || qty <= 0) return [];
    try {
      return bomNeeds(selectedSku.id, qty, products, productComponents).map((need) => {
        const child = products.find((product) => product.id === need.productId);
        const box = need.kind === "unit" ? findAssemblyBox(stock, need.productId, skuState) : null;
        const onHand =
          need.kind === "composite"
            ? assembledOnHand(stock, need.productId, skuState, assembled?.id)
            : box?.quantity || 0;
        return { need, child, onHand };
      });
    } catch {
      return [];
    }
  }, [selectedSku, skuQty, products, productComponents, stock, skuState, assembled?.id]);

  const run = async (action: () => Promise<void>, ok: string) => {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await action();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm font-semibold text-primary tracking-wider uppercase">Movimentar</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Montar SKUs</h1>
        <p className="text-muted-foreground mt-1">
          Tira unidades da caixa de montagem e vira cartucho, caixa ou pallet em Produtos montados.
        </p>
      </div>

      {(error || message) && (
        <p className={`text-sm ${error ? "text-destructive" : "text-emerald-700"}`}>{error || message}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo nas caixas de montagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assemblyBoxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma caixa de montagem aberta.{" "}
              <Link to="/operacoes/movimentar/transferir" className="text-primary hover:underline">
                Escolha uma em Transferir
              </Link>
              .
            </p>
          ) : (
            assemblyBoxes.map((item) => {
              const product = products.find((row) => row.id === item.product_id);
              const asset = assets.find((row) => row.id === item.asset_id);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{productLabel(product)}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {asset?.code} · {item.grade || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StateChip state={physicalStateOf(item)} />
                    <Badge variant="secondary">
                      {item.quantity} / {boxCapacity(item, assets)}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Montar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1">
              <Label>SKU composto</Label>
              <select
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={skuId}
                onChange={(e) => setSkuId(e.target.value)}
              >
                <option value="">Cartucho, caixa, pallet…</option>
                {composites.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} · {product.name}
                    {product.min_quantity > 0 ? ` · mín. ${product.min_quantity}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input
                className="h-11"
                inputMode="numeric"
                value={skuQty}
                onChange={(e) => setSkuQty(e.target.value.replace(/[^\d]/g, ""))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <StateButton state="liquid" current={skuState} onClick={setSkuState} />
            <StateButton state="frozen" current={skuState} onClick={setSkuState} />
          </div>
          {selectedNeeds.length > 0 && (
            <ul className="text-sm space-y-1 rounded-lg bg-muted/60 p-3">
              {selectedNeeds.map(({ need, child, onHand }) => (
                <li key={need.productId} className="flex justify-between gap-2">
                  <span>
                    {need.quantity} × {child?.code} · {productLabel(child)}
                    {need.kind === "unit" ? " (caixa de montagem)" : need.kind === "composite" ? " (montados)" : ""}
                  </span>
                  <span className={onHand < need.quantity ? "text-destructive" : "text-muted-foreground"}>
                    tem {onHand}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            className="h-12 w-full"
            disabled={saving || !skuId}
            onClick={() =>
              void run(
                () => assembleSku(skuId, Number(skuQty), skuState),
                `${skuQty} × ${selectedSku?.code} em Produtos montados.`
              )
            }
          >
            <Layers className="w-4 h-4 mr-2" />
            Montar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos montados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assembledStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Prateleira vazia. Monte o primeiro SKU acima.</p>
          ) : (
            assembledStock.map((item) => {
              const product = products.find((row) => row.id === item.product_id);
              const low = (product?.min_quantity || 0) > 0 && item.quantity < (product?.min_quantity || 0);
              return (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{product?.code} · {product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stateLabel(physicalStateOf(item))} · {item.grade || "—"}
                      {product?.min_quantity ? ` · mínimo ${product.min_quantity}` : ""}
                    </p>
                  </div>
                  <Badge variant={low ? "destructive" : "secondary"}>{item.quantity} un</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium text-sm">Desmontar (exceção)</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Não é o fluxo normal. Unidades voltam para a caixa de montagem do sabor.
          </p>
          <select
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={unbuildId}
            onChange={(e) => setUnbuildId(e.target.value)}
          >
            <option value="">SKU montado…</option>
            {assembledStock.map((item) => {
              const product = products.find((row) => row.id === item.product_id);
              return (
                <option key={item.id} value={item.id}>
                  {product?.code} · {item.quantity} un · {stateLabel(physicalStateOf(item))}
                </option>
              );
            })}
          </select>
          <Input
            className="h-11"
            inputMode="numeric"
            placeholder="Quantidade"
            value={unbuildQty}
            onChange={(e) => setUnbuildQty(e.target.value.replace(/[^\d]/g, ""))}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={saving || !unbuildId}
            onClick={() =>
              void run(() => unbuildSku(unbuildId, Number(unbuildQty)), "SKU desmontado. Unidades na caixa de montagem.")
            }
          >
            <PackageOpen className="w-4 h-4 mr-2" />
            Desmontar
          </Button>
        </div>
      </details>
    </div>
  );
}

function StateChip({ state }: { state: PhysicalState }) {
  return state === "frozen" ? (
    <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
      <Snowflake className="h-3 w-3" /> Congelado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] text-fuchsia-700">
      <Droplets className="h-3 w-3" /> Líquido
    </span>
  );
}

function StateButton({
  state,
  current,
  onClick,
}: {
  state: PhysicalState;
  current: PhysicalState;
  onClick: (state: PhysicalState) => void;
}) {
  const active = current === state;
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className="h-11 flex-1"
      onClick={() => onClick(state)}
    >
      {state === "frozen" ? <Snowflake className="w-4 h-4 mr-2" /> : <Droplets className="w-4 h-4 mr-2" />}
      {stateLabel(state)}
    </Button>
  );
}
