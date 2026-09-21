import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Factory, QrCode, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { boxTypeLabel, canSendToFactory, isBoxAsset } from "@/lib/packaging-board";
import { cleanLocation, factoryLocation } from "@/lib/operational-assets";
import { useAppStore } from "@/stores";
import type { Asset } from "@/types/database";

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[\s_]+/g, "-");
}

export function SendFactoryPage() {
  const { assets, stock, locations, sendBoxesToFactory } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scannerInput, setScannerInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  const eligible = useMemo(
    () => assets.filter((asset) => canSendToFactory(asset, stock)).sort((a, b) => a.code.localeCompare(b.code, "pt-BR")),
    [assets, stock]
  );
  const selected = selectedIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is Asset => Boolean(asset));
  const factory = factoryLocation(locations);
  const atFactory = assets.filter(
    (asset) => isBoxAsset(asset) && (asset.status === "at_factory" || asset.location_id === factory?.id)
  ).length;

  const addAsset = (asset: Asset) => {
    if (selectedIds.includes(asset.id)) {
      setMessage(`${asset.code} já está na lista.`);
      return;
    }
    if (!canSendToFactory(asset, stock)) {
      setMessage(`${asset.code} não está vazia ou não é caixa preta/grande.`);
      return;
    }
    setSelectedIds((current) => [...current, asset.id]);
    setMessage("");
    setDone("");
  };

  const addByCode = (raw: string) => {
    const code = normalizeCode(raw);
    if (!code) return;
    const asset = assets.find((item) => item.code === code);
    if (!asset) {
      setMessage(`${code} não cadastrada.`);
      return;
    }
    addAsset(asset);
  };

  const handleSubmit = async () => {
    setError("");
    setSaving(true);
    try {
      await sendBoxesToFactory(selectedIds);
      setDone(`${selectedIds.length} caixa(s) enviada(s) à fábrica.`);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-sm font-semibold text-primary tracking-wider uppercase">Movimentar</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Enviar à fábrica</h1>
        <p className="text-muted-foreground mt-1">
          Caixas pretas e grandes vazias voltam para o local reservado Fábrica.
          O produto só entra de novo no Receber, com a nota fiscal.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prontas para envio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{eligible.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Já na fábrica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{atFactory}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escanear caixas vazias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scannerRef}
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addByCode(scannerInput);
                    setScannerInput("");
                  }
                }}
                placeholder="Escaneie PRETA-… ou GRANDE-…"
                className="h-11 pl-8 font-mono"
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
          {message && <p className="text-sm text-amber-700">{message}</p>}

          {selected.length > 0 && (
            <ul className="border rounded-lg divide-y">
              {selected.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <code className="font-mono">{asset.code}</code>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {isBoxAsset(asset) ? boxTypeLabel(asset.type) : asset.type}
                    </Badge>
                    <span className="text-muted-foreground">
                      {locations.find((location) => location.id === asset.location_id)?.name ||
                        cleanLocation(locations)?.name ||
                        "Pátio"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setSelectedIds((current) => current.filter((id) => id !== asset.id))}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Ou escolha da lista</p>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value=""
              onChange={(e) => {
                const asset = eligible.find((item) => item.id === e.target.value);
                if (asset) addAsset(asset);
              }}
            >
              <option value="">{eligible.length ? "Caixa vazia…" : "Nenhuma caixa vazia pronta"}</option>
              {eligible
                .filter((asset) => !selectedIds.includes(asset.id))
                .map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} · {locations.find((location) => location.id === asset.location_id)?.name || asset.status}
                  </option>
                ))}
            </select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {done && <p className="text-sm text-emerald-700">{done}</p>}

          <Button onClick={() => void handleSubmit()} disabled={saving || selected.length === 0} className="w-full h-11">
            <Factory className="w-4 h-4 mr-2" />
            {saving ? "Enviando…" : `Enviar ${selected.length || ""} à fábrica`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
