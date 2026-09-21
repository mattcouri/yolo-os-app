import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InventoryShortageAlert } from "@/components/inventory-shortage-alert";
import { returnAssetYardLocations } from "@/lib/locations";
import {
  cleanLocation,
  dirtyLocation,
  statusLabel,
} from "@/lib/operational-assets";
import {
  RETURN_UNIT_CONDITIONS,
  expandReturnUnits,
  returnUnitAssetStatus,
  type ReturnUnit,
  type ReturnUnitCondition,
} from "@/lib/separacao";
import { closeStockShortages } from "@/lib/stock-reservations";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAppStore } from "@/stores";
import type { Order, OrderItem, SeparationJob } from "@/types/database";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

type WizardRecord = {
  order: Order;
  job: SeparationJob;
  items: OrderItem[];
};

async function uploadDamagePhoto(file: File) {
  if (!isSupabaseConfigured || !supabase) return URL.createObjectURL(file);
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `returns/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("asset-files").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("asset-files").getPublicUrl(path).data.publicUrl;
}

export function CloseOrderWizard({
  record,
  onClose,
}: {
  record: WizardRecord | null;
  onClose: () => void;
}) {
  const locations = useAppStore((state) => state.locations);
  const products = useAppStore((state) => state.products);
  const stock = useAppStore((state) => state.stock);
  const materialStock = useAppStore((state) => state.materialStock);
  const movements = useAppStore((state) => state.movements);
  const closeSeparationOrder = useAppStore((state) => state.closeSeparationOrder);
  const unitsMeta = useMemo(
    () => (record ? expandReturnUnits(record.items) : []),
    [record]
  );
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<ReturnUnit[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = dirtyLocation(locations);
  const clean = cleanLocation(locations);
  const yardLocations = useMemo(() => returnAssetYardLocations(locations), [locations]);
  const noReturns = unitsMeta.length === 0;
  const stockShortages = useMemo(
    () =>
      record
        ? closeStockShortages(record.order.id, record.items, products, stock, materialStock, movements)
        : [],
    [record, products, stock, materialStock, movements]
  );

  useEffect(() => {
    if (!record) return;
    const defaultOk = clean?.id || yardLocations[0]?.id || null;
    const next = expandReturnUnits(record.items).map((row) => ({
      item_id: row.item.id,
      unit_index: row.unitIndex,
      condition: "ok" as const,
      location_id: defaultOk,
      notes: null,
      photo_url: null,
    }));
    setUnits(next);
    setStep(0);
    setError("");
  }, [record?.order.id, clean?.id]);

  const totalUnits = unitsMeta.length;
  const isReview = noReturns || step >= totalUnits;
  const unitStep = isReview ? -1 : step;
  const currentMeta = unitStep >= 0 ? unitsMeta[unitStep] : null;
  const currentUnit = unitStep >= 0 ? units[unitStep] : null;

  const defaultLocation = (condition: ReturnUnitCondition) => {
    if (condition === "lost") return null;
    if (condition === "ok") return clean?.id || yardLocations[0]?.id || null;
    return dirty?.id || clean?.id || yardLocations[0]?.id || null;
  };

  const patchUnit = (index: number, change: Partial<ReturnUnit>) => {
    setUnits((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  };

  const setCondition = (condition: ReturnUnitCondition) => {
    if (unitStep < 0) return;
    patchUnit(unitStep, { condition, location_id: defaultLocation(condition) });
    setError("");
  };

  const canAdvanceUnit = () => {
    if (!currentUnit) return true;
    if (currentUnit.condition === "damaged") {
      if (!currentUnit.photo_url) {
        setError("Envie uma foto do dano.");
        return false;
      }
      if (!currentUnit.notes?.trim()) {
        setError("Descreva o dano.");
        return false;
      }
    }
    if (currentUnit.condition === "lost") return true;
    if (!currentUnit.location_id) {
      setError("Diga onde esta peça vai ficar.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError("");
    if (currentUnit && !canAdvanceUnit()) return;
    setStep((current) => current + 1);
  };

  const handleDamagePhoto = async (file: File | undefined) => {
    if (!file || unitStep < 0) return;
    setUploading(true);
    setError("");
    try {
      const photo_url = await uploadDamagePhoto(file);
      patchUnit(unitStep, { photo_url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!record) return;
    const incomplete = units.find((unit, index) => {
      const meta = unitsMeta[index];
      if (!meta) return false;
      if (unit.condition === "damaged" && (!unit.photo_url || !unit.notes?.trim())) return true;
      return unit.condition !== "lost" && !unit.location_id;
    });
    if (incomplete) {
      setError("Toda peça danificada precisa de foto e observação, e o que voltou precisa de um local.");
      return;
    }
    if (stockShortages.length) {
      setError("Não dá para fechar: estoque insuficiente para baixar os SKUs.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await closeSeparationOrder(record.order.id, units);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível fechar o pedido.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar pedido</DialogTitle>
          <DialogDescription>
            {record ? `${record.order.order_number} · ${record.order.event_name || record.order.recipient_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {noReturns && (
          <div className="space-y-2 text-sm">
            <p className="rounded-lg border bg-muted/40 px-3 py-2">Este pedido não tem itens com volta.</p>
            <p className="rounded-lg border bg-muted/40 px-3 py-2">Nenhuma peça para devolver.</p>
          </div>
        )}

        {currentMeta && currentUnit && (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Peça {unitStep + 1} de {totalUnits}
            </p>
            <div>
              <h3 className="text-lg font-bold leading-tight">{currentMeta.label}</h3>
              <p className="text-xs text-muted-foreground">{currentMeta.code}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {RETURN_UNIT_CONDITIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCondition(option.value)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left",
                    currentUnit.condition === option.value
                      ? "border-primary bg-primary/10"
                      : "border-input bg-background hover:border-primary/40"
                  )}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  <p className="text-[11px] text-muted-foreground">{option.hint}</p>
                </button>
              ))}
            </div>
            {currentUnit.condition === "damaged" && (
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label htmlFor="damage-photo">Foto do dano</Label>
                  <input
                    id="damage-photo"
                    type="file"
                    accept="image/*"
                    className="mt-1.5 block w-full text-sm"
                    disabled={uploading || isSaving}
                    onChange={(event) => void handleDamagePhoto(event.target.files?.[0])}
                  />
                  {currentUnit.photo_url && (
                    <img
                      src={currentUnit.photo_url}
                      alt="Dano"
                      className="mt-2 max-h-40 w-full rounded-md object-cover"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="damage-notes">Observação</Label>
                  <Textarea
                    id="damage-notes"
                    className="mt-1.5"
                    rows={3}
                    placeholder="O que aconteceu com a peça"
                    value={currentUnit.notes || ""}
                    onChange={(event) => patchUnit(unitStep, { notes: event.target.value })}
                  />
                </div>
              </div>
            )}
            {currentUnit.condition !== "lost" && (
              <div>
                <Label>Onde você está guardando</Label>
                <select
                  className={cn(selectClass, "mt-1.5")}
                  value={currentUnit.location_id || ""}
                  onChange={(event) => patchUnit(unitStep, { location_id: event.target.value || null })}
                >
                  <option value="">Selecione o local</option>
                  {yardLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {isReview && !noReturns && (
          <div className="space-y-3">
            <ul className="divide-y rounded-lg border">
              {unitsMeta.map((meta, index) => {
                const unit = units[index];
                const locationName =
                  yardLocations.find((location) => location.id === unit?.location_id)?.name || "—";
                return (
                  <li key={`${meta.item.id}-${meta.unitIndex}`} className="px-3 py-2 text-sm">
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {unit ? statusLabel(returnUnitAssetStatus(unit.condition)) : "—"}
                      {unit?.condition === "lost" ? "" : ` · ${locationName}`}
                    </p>
                    {unit?.condition === "damaged" && unit.notes && (
                      <p className="mt-1 text-xs">{unit.notes}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <InventoryShortageAlert rows={stockShortages} />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => setStep((current) => current - 1)}>
              Voltar
            </Button>
          )}
          {!isReview && (
            <Button type="button" disabled={isSaving || uploading} onClick={handleNext}>
              {unitStep === totalUnits - 1 ? "Revisar" : "Próxima peça"}
            </Button>
          )}
          {isReview && (
            <Button type="button" disabled={isSaving} onClick={() => void handleSubmit()}>
              {isSaving ? "Fechando…" : "Confirmar e fechar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
