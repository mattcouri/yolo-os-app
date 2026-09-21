import { AlertTriangle, Droplets, Snowflake } from "lucide-react";

export type InventoryShortageRow = {
  id: string;
  name: string;
  sku: string;
  state: "" | "liquid" | "frozen";
  qty: number;
  available: number;
};

function StateBar({ state }: { state: InventoryShortageRow["state"] }) {
  if (state === "frozen") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
        <Snowflake className="h-3 w-3" /> Congelado
      </span>
    );
  }
  if (state === "liquid") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-700">
        <Droplets className="h-3 w-3" /> Líquido
      </span>
    );
  }
  return null;
}

export function InventoryShortageAlert({ rows }: { rows: InventoryShortageRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div
      className="flex gap-2 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-2">
        <p className="font-medium">Estoque insuficiente</p>
        <ul className="space-y-2 text-[13px]">
          {rows.map((row) => (
            <li key={row.id} className="space-y-0.5">
              <p className="flex flex-wrap items-center gap-1.5">
                <span>
                  Estoque insuficiente para {row.name} {row.sku}
                </span>
                <StateBar state={row.state} />
              </p>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                Pede {row.qty.toLocaleString("pt-BR")}, tem {row.available.toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
