import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, CheckCircle2, Package2, QrCode, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productStockLocations } from "@/lib/locations";
import {
  boxCapacity,
  findAssemblyBox,
  isAssemblyBox,
  isPackingRoom,
  physicalStateOf,
  stateLabel,
} from "@/lib/assembly";
import { useAppStore } from "@/stores";
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
          Movimente caixas de 100 e escolha a caixa de montagem do packing.
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
                Escaneie, escolha o destino e defina a caixa de montagem.
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
    scanEmptyAssemblyBox,
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
  const selectable = inOrigin.filter(
    (row) => !selectedStockIds.includes(row.stock.id) && row.stock.location_id !== destination
  );
  const totalPops = selected.reduce((sum, row) => sum + row.stock.quantity, 0);
  const destinationOptions = activeLocations.filter((location) => location.id !== originId);

  const [assemblyScan, setAssemblyScan] = useState("");
  const [assemblyMessage, setAssemblyMessage] = useState("");
  const [assemblyError, setAssemblyError] = useState("");
  const [assemblySaving, setAssemblySaving] = useState(false);
  const assemblyScannerRef = useRef<HTMLInputElement>(null);

  const assemblyBoxes = useMemo(
    () =>
      stock
        .filter((item) => isAssemblyBox(item))
        .sort((a, b) => {
          const left = products.find((product) => product.id === a.product_id);
          const right = products.find((product) => product.id === b.product_id);
          return (left?.flavor || left?.name || "").localeCompare(right?.flavor || right?.name || "", "pt-BR");
        }),
    [stock, products]
  );

  const packingCandidates = useMemo(() => {
    return stock
      .filter((item) => {
        if (item.quantity <= 0 || item.status === "depleted" || item.status === "analysis") return false;
        if (item.is_active_separation || !item.asset_id) return false;
        const location = locations.find((row) => row.id === item.location_id);
        if (!isPackingRoom(location)) return false;
        const asset = assets.find((row) => row.id === item.asset_id);
        return Boolean(asset && asset.type === "caixa_media");
      })
      .map((item) => {
        const asset = assets.find((row) => row.id === item.asset_id) as Asset;
        const product = products.find((row) => row.id === item.product_id);
        const existing = findAssemblyBox(stock, item.product_id, physicalStateOf(item));
        const existingAsset = existing ? assets.find((row) => row.id === existing.asset_id) : undefined;
        return {
          stock: item,
          asset,
          product,
          blockedBy: existingAsset?.code || existing?.stock_number || null,
        };
      })
      .sort(
        (a, b) =>
          Number(Boolean(a.blockedBy)) - Number(Boolean(b.blockedBy)) ||
          (a.product?.flavor || a.product?.name || "").localeCompare(b.product?.flavor || b.product?.name || "", "pt-BR") ||
          a.asset.code.localeCompare(b.asset.code, "pt-BR")
      );
  }, [stock, locations, assets, products]);
  const packingOpenable = packingCandidates.filter((row) => !row.blockedBy);

  const runAssembly = async (action: () => Promise<void>, ok: string) => {
    setAssemblyError("");
    setAssemblyMessage("");
    setAssemblySaving(true);
    try {
      await action();
      setAssemblyMessage(ok);
    } catch (err) {
      setAssemblyError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setAssemblySaving(false);
    }
  };

  const handleAssemblyScan = async (raw: string) => {
    const code = normalizeCode(raw);
    if (!code) return;
    setAssemblyScan("");
    const asset = assets.find((item) => item.code === code);
    if (!asset) {
      setAssemblyError(`${code} não cadastrada.`);
      return;
    }
    const live = stock.find(
      (item) => item.asset_id === asset.id && (item.quantity > 0 || item.is_active_separation) && item.status !== "analysis"
    );
    if (!live) {
      setAssemblyError(`${code} não tem produto disponível. Traga uma caixa de 100 deste sabor.`);
      return;
    }
    if (live.is_active_separation && live.quantity <= 0) {
      await runAssembly(() => scanEmptyAssemblyBox(live.id), `${code} vazia. Traga a próxima caixa de 100.`);
      return;
    }
    if (live.is_active_separation) {
      setAssemblyMessage(`${code} já é a caixa de montagem (${live.quantity} un).`);
      return;
    }
    await runAssembly(() => promoteAssemblyBox(live.id), `${code} é a caixa de montagem agora.`);
  };

  const addBox = (row: MovableBox) => {
    if (selectedStockIds.includes(row.stock.id)) {
      setMessage(`${row.asset.code} já está na lista.`);
      return false;
    }
    if (destination && row.stock.location_id === destination) {
      setMessage(`${row.asset.code} já está no destino.`);
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
    if (selected.some((row) => row.stock.location_id === destination)) {
      setError("Uma das caixas já está no destino.");
      return;
    }

    setSaving(true);
    try {
      await transferBoxes(selectedStockIds, destination);
      setDone(`${selected.length} caixa(s) movida(s) para ${activeLocations.find((l) => l.id === destination)?.name}.`);
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
          Caixas de 100 mudam de local. No packing, escolha a caixa de montagem de cada sabor.
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
                  {row.asset.code} · {row.product?.flavor || row.product?.code} · {gradeLabel(row.stock)} ·{" "}
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
                      <span className="text-muted-foreground">
                        {" · "}
                        {row.product?.flavor || row.product?.name}
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
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Escolher local…</option>
            {destinationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escolher caixa de montagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Uma por sabor e estado. Só ela pode ter menos de 100. Depois de vazia, escaneie-a e traga a próxima caixa
            de 100.
          </p>

          {assemblyBoxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma aberta ainda.</p>
          ) : (
            <ul className="space-y-2">
              {assemblyBoxes.map((item) => {
                const product = products.find((row) => row.id === item.product_id);
                const asset = assets.find((row) => row.id === item.asset_id);
                const location = locations.find((row) => row.id === item.location_id);
                const empty = item.quantity <= 0;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{product?.flavor || product?.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {asset?.code} · {location?.name || "—"} · {item.grade || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {stateLabel(physicalStateOf(item))}
                      </Badge>
                      <Badge variant={empty ? "destructive" : "secondary"}>
                        {empty ? "Vazia" : `${item.quantity} / ${boxCapacity(item, assets)}`}
                      </Badge>
                      {empty && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={assemblySaving}
                          onClick={() =>
                            void runAssembly(
                              () => scanEmptyAssemblyBox(item.id),
                              `${asset?.code} vazia. Traga a próxima caixa de 100.`
                            )
                          }
                        >
                          Escanear vazia
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={assemblyScannerRef}
                value={assemblyScan}
                onChange={(e) => setAssemblyScan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAssemblyScan(assemblyScan);
                  }
                }}
                placeholder="Escanear caixa média…"
                className="h-12 pl-8 font-mono"
              />
            </div>
            <Button
              type="button"
              className="h-12"
              disabled={assemblySaving}
              onClick={() => void handleAssemblyScan(assemblyScan)}
            >
              Confirmar
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ou escolha uma caixa do packing room</p>
            <select
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
              value=""
              disabled={assemblySaving}
              onChange={(e) => {
                const stockId = e.target.value;
                if (!stockId) return;
                const row = packingOpenable.find((item) => item.stock.id === stockId);
                if (!row) return;
                void runAssembly(
                  () => promoteAssemblyBox(row.stock.id),
                  `${row.asset.code} é a caixa de montagem agora.`
                );
              }}
            >
              <option value="">
                {packingOpenable.length
                  ? "Caixa do packing room…"
                  : packingCandidates.length
                    ? "Já existe montagem para estes sabores"
                    : "Nenhuma caixa no packing room"}
              </option>
              {packingOpenable.map((row) => (
                <option key={row.stock.id} value={row.stock.id}>
                  {row.asset.code} · {row.product?.flavor || row.product?.name} · {row.stock.quantity} un ·{" "}
                  {stateLabel(physicalStateOf(row.stock))}
                  {row.stock.grade ? ` · ${row.stock.grade}` : ""}
                </option>
              ))}
              {packingCandidates
                .filter((row) => row.blockedBy)
                .map((row) => (
                  <option key={row.stock.id} value="" disabled>
                    {row.asset.code} · {row.product?.flavor || row.product?.name} · já tem montagem ({row.blockedBy})
                  </option>
                ))}
            </select>
          </div>

          {assemblyError && <p className="text-sm text-destructive">{assemblyError}</p>}
          {assemblyMessage && <p className="text-sm text-emerald-700">{assemblyMessage}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
