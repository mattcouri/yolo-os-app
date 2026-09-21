import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, CheckCircle2, Package2, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productStockLocations } from "@/lib/locations";
import {
  ASSEMBLY_DEST,
  assemblyKey,
  findAssemblyBox,
  packingRoomLocation,
  physicalStateOf,
} from "@/lib/assembly";
import { useAppStore } from "@/stores";
import { ProductMark, productDisplayName, productOptionLabel } from "@/components/product-mark";
import type { Asset, Location, Product, Stock } from "@/types/database";

const GRADE_LABEL: Record<string, string> = {
  AAA: "AAA",
  B: "B",
  C: "C",
  blocked: "Rejeito",
  pending: "Análise",
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s_]+/g, "-");
}

function gradeLabel(stock: Stock) {
  if (stock.status === "analysis" || !stock.grade || stock.grade === "pending") return "Análise";
  return GRADE_LABEL[stock.grade] || stock.grade;
}

type MovableBox = {
  stock: Stock;
  asset: Asset;
  product: Product | undefined;
  location: Location | undefined;
};

export function TransfersPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          03 / MOVIMENTAR
        </span>
        <h1 className="text-2xl md:text-3xl font-bold mt-2">
          Caixas no lugar certo.
        </h1>
        <p className="text-muted-foreground mt-1">
          Movimente caixas de 100 ou envie uma para a caixa de montagem.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/operacoes/movimentar/transferir">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                <ArrowLeftRight className="w-5 h-5" />
              </span>
              <strong className="text-lg">Transferir caixas</strong>
              <p className="text-sm text-muted-foreground mt-1">
                Escaneie e escolha o destino, inclusive caixa de montagem.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/operacoes/movimentar/montar">
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="pt-6">
              <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Package2 className="w-5 h-5" />
              </span>
              <strong className="text-lg">Montar SKUs</strong>
              <p className="text-sm text-muted-foreground mt-1">
                Cartuchos, caixas e pallets a partir da caixa de montagem.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

export function BatchTransferPage() {
  const {
    stock,
    locations,
    assets,
    products,
    transferBoxes,
    promoteAssemblyBox,
  } = useAppStore();

  const activeLocations = useMemo(
    () => productStockLocations(locations, true),
    [locations]
  );

  const [originId, setOriginId] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerFocused, setScannerFocused] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  const movable = useMemo<MovableBox[]>(() => {
    return stock
      .filter((item) => item.quantity > 0 && item.status !== "depleted" && item.asset_id)
      .map((item) => {
        const asset = assets.find((a) => a.id === item.asset_id);
        if (!asset) return null;
        return {
          stock: item,
          asset,
          product: products.find((p) => p.id === item.product_id),
          location: locations.find((l) => l.id === item.location_id),
        };
      })
      .filter((row): row is MovableBox => Boolean(row))
      .sort((a, b) => a.asset.code.localeCompare(b.asset.code, "pt-BR"));
  }, [stock, assets, products, locations]);

  const inOrigin = movable.filter((row) => !originId || row.stock.location_id === originId);
  const selected = selectedStockIds
    .map((id) => movable.find((row) => row.stock.id === id))
    .filter((row): row is MovableBox => Boolean(row));
  const packing = packingRoomLocation(locations);
  const selectable = inOrigin.filter(
    (row) =>
      !selectedStockIds.includes(row.stock.id) &&
      (destination === ASSEMBLY_DEST || !destination || row.stock.location_id !== destination)
  );
  const totalPops = selected.reduce((sum, row) => sum + row.stock.quantity, 0);
  const destinationOptions = activeLocations.filter((location) => location.id !== originId);

  const assemblyConflict = (row: MovableBox, others: MovableBox[] = selected) => {
    if (destination !== ASSEMBLY_DEST) return "";
    const key = assemblyKey(row.stock);
    if (others.some((item) => assemblyKey(item.stock) === key)) {
      return "Só uma caixa de montagem por produto e estado.";
    }
    const existing = findAssemblyBox(stock, row.stock.product_id, physicalStateOf(row.stock));
    if (existing && existing.quantity > 0 && existing.id !== row.stock.id) {
      const existingAsset = assets.find((item) => item.id === existing.asset_id);
      return `Já existe montagem de ${productDisplayName(row.product)}: ${existingAsset?.code || existing.stock_number}.`;
    }
    return "";
  };

  const addBox = (row: MovableBox) => {
    if (selectedStockIds.includes(row.stock.id)) {
      setMessage(`${row.asset.code} já está na lista.`);
      return false;
    }
    if (destination && destination !== ASSEMBLY_DEST && row.stock.location_id === destination) {
      setMessage(`${row.asset.code} já está no destino.`);
      return false;
    }
    const conflict = assemblyConflict(row);
    if (conflict) {
      setMessage(conflict);
      return false;
    }
    setSelectedStockIds((current) => [...current, row.stock.id]);
    setMessage("");
    setDone("");
    setError("");
    if (!originId) setOriginId(row.stock.location_id);
    return true;
  };

  const addByCode = (raw: string) => {
    const code = normalizeCode(raw);
    if (!code) return;
    const row = movable.find((item) => item.asset.code === code);
    if (!row) {
      setMessage(`${code} não tem produto para transferir.`);
      return;
    }
    if (originId && row.stock.location_id !== originId) {
      setMessage(`${code} está em ${row.location?.name || "outro local"}.`);
      return;
    }
    addBox(row);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (selected.length === 0) {
      setError("Inclua ao menos uma caixa.");
      return;
    }
    if (!destination) {
      setError("Escolha o destino.");
      return;
    }
    if (destination !== ASSEMBLY_DEST && selected.some((row) => row.stock.location_id === destination)) {
      setError("Uma das caixas já está no destino.");
      return;
    }
    if (destination === ASSEMBLY_DEST) {
      if (!packing) {
        setError("Cadastre o Packing Room para usar caixa de montagem.");
        return;
      }
      for (const row of selected) {
        const conflict = assemblyConflict(row, selected.filter((item) => item.stock.id !== row.stock.id));
        if (conflict) {
          setError(conflict);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (destination === ASSEMBLY_DEST && packing) {
        const toMove = selected.filter((row) => row.stock.location_id !== packing.id).map((row) => row.stock.id);
        if (toMove.length) await transferBoxes(toMove, packing.id);
        for (const row of selected) {
          await promoteAssemblyBox(row.stock.id);
        }
        setDone(`${selected.length} caixa(s) na caixa de montagem.`);
      } else {
        await transferBoxes(selectedStockIds, destination);
        setDone(`${selected.length} caixa(s) movida(s) para ${activeLocations.find((l) => l.id === destination)?.name}.`);
      }
      setSelectedStockIds([]);
      setOriginId("");
      setDestination("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao transferir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary tracking-wider uppercase">Movimentar</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Transferir caixas</h1>
        <p className="text-muted-foreground mt-1">
          Caixas de 100 mudam de local. Destino caixa de montagem: uma por produto e estado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">De onde</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={originId}
            onChange={(e) => {
              setOriginId(e.target.value);
              setSelectedStockIds([]);
              setMessage("");
              setDone("");
              if (destination === e.target.value) setDestination("");
            }}
          >
            <option value="">Todos os locais</option>
            {activeLocations.map((location) => {
              const count = movable.filter((row) => row.stock.location_id === location.id).length;
              return (
                <option key={location.id} value={location.id}>
                  {location.name} {count ? `· ${count} caixa${count === 1 ? "" : "s"}` : ""}
                </option>
              );
            })}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escolher caixas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
                placeholder="Escaneie ou digite o código…"
                className={`h-11 pl-8 font-mono ${scannerFocused ? "ring-2 ring-primary" : ""}`}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                addByCode(scannerInput);
                setScannerInput("");
              }}
            >
              Incluir
            </Button>
          </div>
          {scannerFocused && <p className="text-[11px] text-muted-foreground">Aguardando scan…</p>}
          {message && <p className="text-sm text-amber-700">{message}</p>}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Selecionar da lista</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value=""
              onChange={(e) => {
                const row = selectable.find((item) => item.stock.id === e.target.value);
                if (row) addBox(row);
              }}
            >
              <option value="">{selectable.length ? "Escolher caixa…" : "Nenhuma caixa restante"}</option>
              {selectable.map((row) => (
                <option key={row.stock.id} value={row.stock.id}>
                  {row.asset.code} · {row.product ? productOptionLabel(row.product) : "—"} · {gradeLabel(row.stock)} ·{" "}
                  {row.stock.quantity} un
                  {!originId && row.location ? ` · ${row.location.name}` : ""}
                </option>
              ))}
            </select>
          </div>

          {selected.length > 0 && (
            <ul className="border rounded-lg divide-y">
              {selected.map((row) => (
                <li key={row.stock.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="min-w-0">
                      <code className="font-mono text-xs font-medium">{row.asset.code}</code>
                      <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1">
                        {" · "}
                        <ProductMark product={row.product} />
                        {" · "}
                        {gradeLabel(row.stock)}
                        {" · "}
                        {row.stock.quantity.toLocaleString("pt-BR")} un
                      </span>
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setSelectedStockIds((current) => current.filter((id) => id !== row.stock.id))}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destino</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={destination}
            onChange={(e) => {
              const next = e.target.value;
              setDestination(next);
              if (next === ASSEMBLY_DEST) {
                const kept: string[] = [];
                const seen = new Set<string>();
                for (const row of selected) {
                  const key = assemblyKey(row.stock);
                  if (seen.has(key)) continue;
                  const existing = findAssemblyBox(stock, row.stock.product_id, physicalStateOf(row.stock));
                  if (existing && existing.quantity > 0 && existing.id !== row.stock.id) continue;
                  seen.add(key);
                  kept.push(row.stock.id);
                }
                setSelectedStockIds(kept);
              }
            }}
          >
            <option value="">Escolher local…</option>
            <option value={ASSEMBLY_DEST}>Caixa de montagem</option>
            {destinationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          {destination === ASSEMBLY_DEST && (
            <p className="text-xs text-muted-foreground">
              Uma caixa por produto e estado. Elas vão para o packing como caixa de montagem.
            </p>
          )}
          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selected.length} caixa{selected.length === 1 ? "" : "s"} · {totalPops.toLocaleString("pt-BR")} un
            </p>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && <p className="text-sm text-emerald-700">{done}</p>}

      <Button type="submit" disabled={saving || selected.length === 0 || !destination}>
        {saving ? "Transferindo…" : "Confirmar transferência"}
      </Button>
    </form>
    </div>
  );
}
