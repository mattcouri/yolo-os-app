import { useState } from "react";
import { Droplets, Package, Snowflake } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PhysicalState, Product } from "@/types/database";

export type ProductMarkSource = Pick<Product, "code" | "name" | "kind" | "format"> & { id?: string };

export function productDisplayName(product?: Pick<Product, "name" | "code"> | null) {
  return product?.name?.trim() || product?.code || "—";
}

export function productOptionLabel(product: Pick<Product, "code" | "name">) {
  const name = product.name?.trim();
  if (!name || name === product.code) return product.code;
  return `${product.code} · ${name}`;
}

export function ProductMark({
  product,
  state,
  wrap = false,
  size = "sm",
  className,
}: {
  product?: ProductMarkSource | null;
  state?: PhysicalState | "" | null;
  wrap?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!product) return <span className="text-muted-foreground text-[11px]">—</span>;
  const frozen = state === "frozen" || (!state && product.format === "congelado");
  const liquid = state === "liquid" || (!state && product.format === "liquido");
  const name = productDisplayName(product);
  const md = size === "md";
  const icon = product.kind === "material" ? (
    <Package className={cn("shrink-0 text-muted-foreground", md ? "h-3.5 w-3.5" : "h-3 w-3")} />
  ) : frozen ? (
    <Snowflake className={cn("shrink-0 text-sky-500", md ? "h-3.5 w-3.5" : "h-3 w-3")} />
  ) : liquid ? (
    <Droplets className={cn("shrink-0 text-fuchsia-500", md ? "h-3.5 w-3.5" : "h-3 w-3")} />
  ) : null;
  const sku = (
    <code className={cn("shrink-0 rounded bg-muted px-1 py-px leading-4", md ? "text-xs" : "text-[10px]")}>
      {product.code}
    </code>
  );
  const label = (
    <span
      className={cn(
        "min-w-0 font-medium leading-4",
        md ? "text-[13px]" : "text-[11px]",
        wrap ? "w-full whitespace-normal break-words" : "truncate whitespace-nowrap"
      )}
    >
      {name}
    </span>
  );
  if (wrap) {
    return (
      <span title={name} className={cn("flex min-w-0 flex-col gap-0.5", className)}>
        <span className="inline-flex items-center gap-1">
          {icon}
          {sku}
        </span>
        {label}
      </span>
    );
  }
  return (
    <span title={name} className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {icon}
      {sku}
      {label}
    </span>
  );
}

export function ProductSelect({
  products,
  value,
  onChange,
  placeholder = "Selecionar",
  className,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((product) => product.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full min-w-0 items-center rounded-md border border-input bg-background px-2 text-left",
            className
          )}
        >
          {selected ? (
            <ProductMark product={selected} />
          ) : (
            <span className="text-[11px] text-muted-foreground">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="w-[min(36rem,calc(100vw-1.5rem))] min-w-[var(--radix-popover-trigger-width)] max-h-80 overflow-y-auto p-1"
      >
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className={cn(
              "flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted",
              product.id === value && "bg-muted"
            )}
            onClick={() => {
              onChange(product.id);
              setOpen(false);
            }}
          >
            <ProductMark product={product} size="md" />
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
