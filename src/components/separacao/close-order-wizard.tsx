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

export function CloseOrderWizard({
  record,
  onClose,
}: {
  record: WizardRecord | null;
  onClose: () => void;
}) {
  const locations = useAppStore((state) => state.locations);
  const closeSeparationOrder = useAppStore((state) => state.closeSeparationOrder);
  const unitsMeta = useMemo(
    () => (record ? expandReturnUnits(record.items) : []),
    [record]
  );
  const [step, setStep] = useState(0);
  const [units, setUnits] = useState<ReturnUnit[]>([]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const dirty = dirtyLocation(locations);
  const clean = cleanLocation(locations);
  const yardLocations = useMemo(() => {
    const rest = locations.filter(
      (location) => location.is_active && location.id !== dirty?.id && location.id !== clean?.id
    );
    return [...(dirty ? [dirty] : []), ...(clean ? [clean] : []), ...rest];
  }, [locations, dirty, clean]);

  useEffect(() => {
    if (!record) return;
    const defaultOk = clean?.id || locations.find((location) => location.is_active)?.id || null;
    const next = expandReturnUnits(record.items).map((row) => ({
      item_id: row.item.id,
      unit_index: row.unitIndex,
      condition: "ok" as const,
      location_id: defaultOk,
    }));
    setUnits(next);
    setStep(0);
    setError("");
  }, [record?.order.id, clean?.id]);

  const totalUnits = unitsMeta.length;
  const isIntro = step === 0;
  const isReview = totalUnits === 0 ? step >= 1 : step === totalUnits + 1;
  const unitStep = !isIntro && !isReview ? step - 1 : -1;
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

  const handleSubmit = async () => {
    if (!record) return;
    const incomplete = units.find((unit, index) => {
      const meta = unitsMeta[index];
      if (!meta) return false;
      return unit.condition !== "lost" && !unit.location_id;
    });
    if (incomplete) {
      setError("Toda peça que voltou precisa de um local.");
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

        {isIntro && (
          <div className="space-y-3 text-sm">
            <p>
              Use a folha de papel da coleta. Vamos conferir <strong>cada peça</strong> que deveria voltar —
              se saíram 3 camisas, conferimos as 3, uma por uma.
            </p>
            {totalUnits === 0 ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground">
                Este pedido não tem itens com volta. Fechar só encerra o evento.
              </p>
            ) : (
              <ul className="space-y-1 rounded-lg border px-3 py-2">
                {record?.items
                  .filter((item) => item.is_returnable)
                  .map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {item.quantity} {item.unit}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
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

        {isReview && (
          <div className="space-y-3">
            <p className="text-sm">Confira o que vai para o pátio de ativos. Depois o pedido sai de Em andamento.</p>
            {unitsMeta.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma peça para devolver.</p>
            ) : (
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
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

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
            <Button type="button" disabled={isSaving} onClick={handleNext}>
              {isIntro && totalUnits === 0 ? "Continuar" : isIntro ? "Começar conferência" : "Próxima peça"}
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
