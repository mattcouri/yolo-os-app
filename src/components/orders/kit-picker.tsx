import { Shirt, Wrench } from "lucide-react";
import type { Asset, EquipmentReservation, Order, Uniform, UniformCheckout, UniformSize } from "@/types/database";
import { UNIFORM_SIZES } from "@/lib/uniforms";
import {
  availableForSizeOnWindow,
  equipmentBlock,
  occupyingUniformOrder,
  uniformFullyBlocked,
} from "@/lib/kit-availability";
import { categoryLabel } from "@/lib/operational-assets";
import { cn } from "@/lib/utils";

export type UniformPick = Partial<Record<UniformSize, number>>;

interface KitPickerProps {
  assets: Asset[];
  uniforms: Uniform[];
  reservations: EquipmentReservation[];
  checkouts: UniformCheckout[];
  orders: Order[];
  reserveFrom: string;
  reserveUntil: string;
  selectedAssetIds: string[];
  returningAssetIds: string[];
  onToggleAsset: (assetId: string, vai: boolean) => void;
  onToggleAssetReturn: (assetId: string, volta: boolean) => void;
  selectedUniforms: Record<string, UniformPick>;
  returningUniformIds: string[];
  onChangeUniform: (uniformId: string, next: UniformPick | null) => void;
  onToggleUniformReturn: (uniformId: string, volta: boolean) => void;
}

function VaiVolta({
  vai,
  volta,
  disabled,
  onVai,
  onVolta,
}: {
  vai: boolean;
  volta: boolean;
  disabled?: boolean;
  onVai: (next: boolean) => void;
  onVolta: (next: boolean) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-primary"
          checked={vai}
          disabled={disabled}
          onChange={(e) => onVai(e.target.checked)}
        />
        vai
      </label>
      <label
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-semibold",
          (!vai || disabled) && "text-muted-foreground"
        )}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-primary"
          checked={vai && volta}
          disabled={disabled || !vai}
          onChange={(e) => onVolta(e.target.checked)}
        />
        volta
      </label>
    </div>
  );
}

export function KitPicker({
  assets,
  uniforms,
  reservations,
  checkouts,
  orders,
  reserveFrom,
  reserveUntil,
  selectedAssetIds,
  returningAssetIds,
  onToggleAsset,
  onToggleAssetReturn,
  selectedUniforms,
  returningUniformIds,
  onChangeUniform,
  onToggleUniformReturn,
}: KitPickerProps) {
  const activeUniforms = uniforms.filter((row) => row.is_active !== false);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Wrench className="h-3.5 w-3.5" />
          Equipamentos
        </p>
        {assets.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum equipamento cadastrado.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {assets.map((asset) => {
              const block = equipmentBlock(asset, reservations, reserveFrom, reserveUntil);
              const vai = selectedAssetIds.includes(asset.id);
              const volta = returningAssetIds.includes(asset.id);
              return (
                <div
                  key={asset.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-2.5 transition",
                    block
                      ? "border-dashed bg-muted/70 text-muted-foreground"
                      : vai && !volta
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                        : vai
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary/40"
                  )}
                >
                  {!block && (
                    <VaiVolta
                      vai={vai}
                      volta={volta}
                      onVai={(next) => onToggleAsset(asset.id, next)}
                      onVolta={(next) => onToggleAssetReturn(asset.id, next)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{asset.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {asset.code}
                      {asset.category ? ` · ${categoryLabel(asset.category)}` : ""}
                    </p>
                    {block ? (
                      <p className="mt-0.5 text-[11px] font-medium text-foreground/80">{block.reason}</p>
                    ) : null}
                    {vai && !volta && !block && (
                      <p className="mt-1 text-[10px] font-medium text-amber-800 dark:text-amber-300">Fica na rua</p>
                    )}
                  </div>
                  {asset.photo_url ? (
                    <img src={asset.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shirt className="h-3.5 w-3.5" />
          Uniformes
        </p>
        {activeUniforms.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum uniforme cadastrado.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {activeUniforms.map((uniform) => {
              const blocked = uniformFullyBlocked(uniform, checkouts, orders, reserveFrom, reserveUntil);
              const pick = selectedUniforms[uniform.id] || {};
              const vai = Object.values(pick).some((qty) => (qty || 0) > 0);
              const volta = returningUniformIds.includes(uniform.id);
              const occupy = blocked
                ? occupyingUniformOrder(uniform.id, checkouts, orders, reserveFrom, reserveUntil)
                : null;
              return (
                <div
                  key={uniform.id}
                  className={cn(
                    "rounded-xl border p-2.5 transition",
                    blocked
                      ? "border-dashed bg-muted/70 text-muted-foreground"
                      : vai && !volta
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
                        : vai
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {!blocked && (
                      <VaiVolta
                        vai={vai}
                        volta={volta}
                        onVai={(next) => {
                          if (!next) {
                            onChangeUniform(uniform.id, null);
                            return;
                          }
                          const first = UNIFORM_SIZES.find(
                            (size) =>
                              availableForSizeOnWindow(uniform, size, checkouts, orders, reserveFrom, reserveUntil) > 0
                          );
                          onChangeUniform(uniform.id, first ? { [first]: 1 } : {});
                        }}
                        onVolta={(next) => onToggleUniformReturn(uniform.id, next)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{uniform.name}</p>
                      {uniform.description && (
                        <p className="truncate text-[11px] text-muted-foreground">{uniform.description}</p>
                      )}
                      {blocked ? (
                        <p className="mt-0.5 text-[11px] font-medium text-foreground/80">
                          {occupy || "Indisponível nesta data"}
                        </p>
                      ) : null}
                      {vai && !volta && !blocked && (
                        <p className="mt-1 text-[10px] font-medium text-amber-800 dark:text-amber-300">Fica na rua</p>
                      )}
                    </div>
                    {uniform.photo_url ? (
                      <img src={uniform.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Shirt className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {!blocked && vai && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {UNIFORM_SIZES.map((size) => {
                        const available = availableForSizeOnWindow(
                          uniform,
                          size,
                          checkouts,
                          orders,
                          reserveFrom,
                          reserveUntil
                        );
                        const qty = pick[size] || 0;
                        const sizeMuted = available <= 0;
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={sizeMuted}
                            onClick={() => {
                              const next = { ...pick };
                              if (qty > 0) delete next[size];
                              else next[size] = 1;
                              onChangeUniform(uniform.id, Object.keys(next).length ? next : null);
                            }}
                            className={cn(
                              "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium",
                              sizeMuted
                                ? "cursor-not-allowed opacity-40"
                                : qty > 0
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "hover:border-primary/50"
                            )}
                          >
                            {size}
                            <span className="ml-1 opacity-70">{sizeMuted ? "0" : qty > 0 ? qty : available}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {vai &&
                    UNIFORM_SIZES.some((size) => (pick[size] || 0) > 0) &&
                    UNIFORM_SIZES.some(
                      (size) => availableForSizeOnWindow(uniform, size, checkouts, orders, reserveFrom, reserveUntil) > 1
                    ) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {UNIFORM_SIZES.filter((size) => (pick[size] || 0) > 0).map((size) => {
                          const available = availableForSizeOnWindow(
                            uniform,
                            size,
                            checkouts,
                            orders,
                            reserveFrom,
                            reserveUntil
                          );
                          if (available <= 1) return null;
                          return (
                            <label key={size} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              {size}
                              <input
                                type="number"
                                min={1}
                                max={available}
                                className="h-7 w-12 rounded-md border border-input bg-background px-1 text-center text-xs"
                                value={pick[size] || 1}
                                onChange={(e) => {
                                  const nextQty = Math.min(available, Math.max(1, Number(e.target.value) || 1));
                                  onChangeUniform(uniform.id, { ...pick, [size]: nextQty });
                                }}
                              />
                              <span>/ {available}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
