import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Droplets, Plus, Search, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanColumnHandle, SortableKanbanColumns } from "@/components/kanban-sortable-columns";
import { DataTable } from "@/components/ui/data-table";
import { useAuthProfile } from "@/lib/auth";
import { useAppStore } from "@/stores";
import { isAssemblyBox, popBaseQuantity, stockPopUnits } from "@/lib/assembly";
import { applySavedColumnOrder, KANBAN_BOARDS } from "@/lib/kanban-order";
import { locationsForKind } from "@/lib/locations";
import { reservedPopUnitsForProduct, reservedQuantityForProduct, reservedSkuMap } from "@/lib/stock-reservations";
import type { Asset, Location, MaterialStock, Product, ProductComponent, Stock } from "@/types/database";

type GradeKey = "AAA" | "B" | "C" | "blocked" | "analysis";

const GRADE_LABEL: Record<GradeKey, string> = {
  AAA: "AAA",
  B: "B",
  C: "C",
  blocked: "Rejeito",
  analysis: "Análise",
};

function gradeKey(stock: Stock): GradeKey {
  if (stock.status === "analysis" || !stock.grade || stock.grade === "pending") return "analysis";
  if (stock.grade === "blocked") return "blocked";
  if (stock.grade === "AAA" || stock.grade === "B" || stock.grade === "C") return stock.grade;
  return "analysis";
}

function stateLabel(liquid: number, frozen: number) {
  if (liquid > 0 && frozen > 0) return "Misto";
  if (frozen > 0) return "Congelado";
  return "Líquido";
}

function isRefugo(stock: Stock) {
  return stock.status === "blocked" || stock.grade === "blocked";
}

function isLivePop(stock: Stock) {
  return stock.quantity > 0 && stock.status !== "depleted";
}

function isCountablePop(stock: Stock) {
  return isLivePop(stock) && !isRefugo(stock);
}

function StateMarks({ liquid, frozen, className }: { liquid: number; frozen: number; className?: string }) {
  if (liquid <= 0 && frozen <= 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 ${className || ""}`}>
      {liquid > 0 && (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded bg-fuchsia-100 text-fuchsia-700"
          title="Líquido"
        >
          <Droplets className="h-3 w-3" />
        </span>
      )}
      {frozen > 0 && (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-100 text-sky-700"
          title="Congelado"
        >
          <Snowflake className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}

interface BoxLine {
  id: string;
  code: string;
  quantity: number;
  grade: GradeKey;
  state: string;
  assembly: boolean;
}

interface SkuLocationRow {
  id: string;
  locationId: string;
  locationName: string;
  productId: string;
  sku: string;
  name: string;
  kind: "pop" | "material";
  isComposite: boolean;
  total: number;
  pops: number;
  boxCount: number;
  lots: string;
  liquid: number;
  frozen: number;
  aaa: number;
  b: number;
  c: number;
  blocked: number;
  analysis: number;
  grades: Record<GradeKey, number>;
  boxes: BoxLine[];
  search: string;
}

function emptyGrades(): Record<GradeKey, number> {
  return { AAA: 0, B: 0, C: 0, blocked: 0, analysis: 0 };
}

function buildRows(
  locations: Location[],
  products: Product[],
  assets: Asset[],
  stock: Stock[],
  materialStock: MaterialStock[],
  components: ProductComponent[]
): SkuLocationRow[] {
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name || "—";
  const map = new Map<string, SkuLocationRow>();

  const take = (productId: string, locationId: string, kind: "pop" | "material") => {
    const key = `${locationId}:${productId}:${kind}`;
    const existing = map.get(key);
    if (existing) return existing;
    const product = products.find((p) => p.id === productId);
    const row: SkuLocationRow = {
      id: key,
      locationId,
      locationName: locationName(locationId),
      productId,
      sku: product?.code || "—",
      name: product?.flavor || product?.name || "SKU",
      kind,
      isComposite: Boolean(product?.is_composite),
      total: 0,
      pops: 0,
      boxCount: 0,
      lots: "",
      liquid: 0,
      frozen: 0,
      aaa: 0,
      b: 0,
      c: 0,
      blocked: 0,
      analysis: 0,
      grades: emptyGrades(),
      boxes: [],
      search: "",
    };
    map.set(key, row);
    return row;
  };

  const lotSet = new Map<string, Set<string>>();
  const boxIds = new Map<string, Set<string>>();

  for (const item of stock.filter((s) => s.quantity > 0 && s.status !== "depleted")) {
    const row = take(item.product_id, item.location_id, "pop");
    const grade = gradeKey(item);
    row.total += item.quantity;
    row.pops += stockPopUnits(item, products, components);
    row.grades[grade] += item.quantity;
    if (item.physical_state === "frozen") row.frozen += item.quantity;
    else row.liquid += item.quantity;
    const lots = lotSet.get(row.id) || new Set<string>();
    if (item.lot) lots.add(item.lot);
    lotSet.set(row.id, lots);
    if (item.asset_id) {
      const ids = boxIds.get(row.id) || new Set<string>();
      ids.add(item.asset_id);
      boxIds.set(row.id, ids);
      const asset = assets.find((a) => a.id === item.asset_id);
      row.boxes.push({
        id: item.id,
        code: asset?.code || item.stock_number,
        quantity: item.quantity,
        grade,
        state: item.physical_state === "frozen" ? "Congelado" : "Líquido",
        assembly: isAssemblyBox(item),
      });
    }
  }

  for (const item of materialStock.filter((s) => s.quantity > 0)) {
    const row = take(item.product_id, item.location_id, "material");
    row.total += item.quantity;
    row.grades.analysis += item.status === "analysis" ? item.quantity : 0;
    if (item.status === "available") row.grades.AAA += item.quantity;
    if (item.status === "blocked") row.grades.blocked += item.quantity;
    const lots = lotSet.get(row.id) || new Set<string>();
    if (item.lot) lots.add(item.lot);
    lotSet.set(row.id, lots);
  }

  return [...map.values()]
    .map((row) => {
      const lots = [...(lotSet.get(row.id) || [])].join(", ");
      return {
        ...row,
        boxCount: (boxIds.get(row.id) || new Set()).size,
        lots,
        aaa: row.grades.AAA,
        b: row.grades.B,
        c: row.grades.C,
        blocked: row.grades.blocked,
        analysis: row.grades.analysis,
        boxes: row.boxes.sort((a, b) => a.code.localeCompare(b.code, "pt-BR")),
        search: `${row.sku} ${row.name} ${row.locationName} ${lots}`,
      };
    })
    .sort((a, b) => a.locationName.localeCompare(b.locationName, "pt-BR") || a.sku.localeCompare(b.sku, "pt-BR"));
}

function GradeChips({ grades, kind }: { grades: Record<GradeKey, number>; kind: "pop" | "material" }) {
  const keys: GradeKey[] = kind === "pop" ? ["AAA", "B", "C", "blocked", "analysis"] : ["AAA", "analysis", "blocked"];
  const present = keys.filter((key) => grades[key] > 0);
  if (present.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {present.map((key) => (
        <Badge key={key} variant={key === "analysis" ? "outline" : key === "blocked" ? "destructive" : "secondary"} className="text-[10px] font-normal">
          {kind === "material" && key === "AAA" ? "Disponível" : GRADE_LABEL[key]} {grades[key].toLocaleString("pt-BR")}
        </Badge>
      ))}
    </div>
  );
}

function qtyCell(value: number) {
  if (value <= 0) return <span className="text-muted-foreground">—</span>;
  return value.toLocaleString("pt-BR");
}

type SkuTotalRow = {
  id: string;
  sku: string;
  name: string;
  flavor: string;
  format: string | null;
  kind: "Individual" | "Composto";
  isComposite: boolean;
  quantity: number;
  reserved: number;
  livre: number;
  baseQuantity: number;
  inventoryTotal: number;
  reservedPops: number;
  livrePops: number;
  search: string;
};

function liveSkuStock(item: Stock) {
  return item.quantity > 0 && item.status !== "depleted";
}

function buildSkuTotals(
  products: Product[],
  stock: Stock[],
  components: ProductComponent[],
  reserved: Map<string, number>
): SkuTotalRow[] {
  return products
    .filter((product) => product.kind === "pop")
    .filter((product) => product.is_active || stock.some((item) => item.product_id === product.id && liveSkuStock(item)))
    .map((product) => {
      const rows = stock.filter((item) => item.product_id === product.id && isCountablePop(item));
      const quantity = rows.reduce((sum, item) => sum + item.quantity, 0);
      const reservedQty = reservedQuantityForProduct(reserved, product.id);
      const reservedPops = reservedPopUnitsForProduct(reservedQty, product.id, products, components);
      const kind: SkuTotalRow["kind"] = product.is_composite ? "Composto" : "Individual";
      const flavor = product.flavor?.trim() || "—";
      const name = product.name || "—";
      const format = product.format || null;
      const baseQuantity = popBaseQuantity(product.id, products, components);
      const inventoryTotal = quantity * baseQuantity;
      return {
        id: product.id,
        sku: product.code,
        name,
        flavor,
        format,
        kind,
        isComposite: product.is_composite,
        quantity,
        reserved: reservedQty,
        livre: Math.max(0, quantity - reservedQty),
        baseQuantity,
        inventoryTotal,
        reservedPops,
        livrePops: Math.max(0, inventoryTotal - reservedPops),
        search: `${product.code} ${name} ${flavor} ${kind} ${format || ""}`.toLowerCase(),
      };
    })
    .sort(
      (a, b) =>
        Number(a.isComposite) - Number(b.isComposite) || a.sku.localeCompare(b.sku, "pt-BR")
    );
}

function SkuQuantityCell({
  row,
  canEdit,
  draft,
  onDraft,
  saving,
  onSave,
}: {
  row: SkuTotalRow;
  canEdit: boolean;
  draft: string;
  onDraft: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  if (!canEdit) return <span>{row.quantity.toLocaleString("pt-BR")}</span>;
  const dirty = draft !== String(row.quantity);
  return (
    <Input
      type="number"
      min={0}
      step={1}
      className="mx-auto h-7 w-[5.5rem] text-center text-xs"
      value={draft}
      disabled={saving}
      onChange={(event) => onDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && dirty) onSave();
      }}
    />
  );
}

function SkuTotalsTable() {
  const { products, stock, productComponents, adjustSkuQuantity, orders, orderItems, separationJobs } = useAppStore();
  const { isAdmin } = useAuthProfile();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reserved = useMemo(
    () => reservedSkuMap(orders, separationJobs, orderItems),
    [orders, separationJobs, orderItems]
  );
  const rows = useMemo(
    () => buildSkuTotals(products, stock, productComponents, reserved),
    [products, stock, productComponents, reserved]
  );

  const save = async (row: SkuTotalRow) => {
    const raw = drafts[row.id] ?? String(row.quantity);
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setError("Informe uma quantidade inteira maior ou igual a zero.");
      return;
    }
    setSavingId(row.id);
    setError(null);
    try {
      await adjustSkuQuantity(row.id, next);
      setDrafts((current) => {
        const { [row.id]: _ignored, ...rest } = current;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ajustar a quantidade.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Todos os SKUs</CardTitle>
            <CardDescription>
              Individuais e compostos, com o saldo atual. {isAdmin ? "Admin pode ajustar a quantidade; o sistema grava um movimento de ajuste." : "Somente admin altera quantidade."}
            </CardDescription>
          </div>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        {error ? <p className="pt-2 text-sm text-destructive">{error}</p> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <DataTable
          data={rows}
          searchKey="search"
          searchPlaceholder="Buscar SKU, produto, sabor ou tipo…"
          emptyMessage="Nenhum SKU cadastrado."
          maxHeight="calc(100vh - 280px)"
          actionsHeader="Salvar"
          columns={[
            {
              key: "sku",
              header: "SKU",
              width: "w-28",
              align: "center",
              sortable: true,
              render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
            },
            {
              key: "name",
              header: "Nome do Produto",
              align: "center",
              cellAlign: "left",
              sortable: true,
              render: (row) => (
                <span className="whitespace-normal break-words">{row.name}</span>
              ),
            },
            {
              key: "format",
              header: "Formato",
              width: "w-32",
              align: "center",
              sortable: true,
              render: (row) => {
                const isCongelado = row.format === "congelado";
                const isLiquido = row.format === "liquido";
                if (!row.format) return <span className="text-muted-foreground">—</span>;
                return (
                  <Badge
                    variant="secondary"
                    className={`text-xs font-normal ${
                      isCongelado
                        ? "bg-sky-100 text-sky-700 hover:bg-sky-100"
                        : isLiquido
                          ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100"
                          : ""
                    }`}
                  >
                    {isCongelado && <Snowflake className="mr-1 h-3 w-3" />}
                    {isLiquido && <Droplets className="mr-1 h-3 w-3" />}
                    {isCongelado ? "Congelado" : isLiquido ? "Líquido" : row.format}
                  </Badge>
                );
              },
            },
            {
              key: "flavor",
              header: "Sabor",
              width: "w-32",
              align: "center",
              sortable: true,
            },
            {
              key: "kind",
              header: "Tipo",
              width: "w-28",
              align: "center",
              sortable: true,
              render: (row) => (
                <Badge variant={row.isComposite ? "secondary" : "outline"}>{row.kind}</Badge>
              ),
            },
            {
              key: "quantity",
              header: "Qtd de estoque",
              width: "w-32",
              align: "center",
              sortable: true,
              render: (row) => (
                <SkuQuantityCell
                  row={row}
                  canEdit={isAdmin}
                  draft={drafts[row.id] ?? String(row.quantity)}
                  onDraft={(value) => setDrafts((current) => ({ ...current, [row.id]: value }))}
                  saving={savingId === row.id}
                  onSave={() => void save(row)}
                />
              ),
            },
            {
              key: "reserved",
              header: "Reservado",
              width: "w-24",
              align: "center",
              sortable: true,
              render: (row) => qtyCell(row.reserved),
            },
            {
              key: "livre",
              header: "Livre",
              width: "w-24",
              align: "center",
              sortable: true,
              render: (row) => qtyCell(row.livre),
            },
            {
              key: "baseQuantity",
              header: "Qtd base",
              width: "w-24",
              align: "center",
              sortable: true,
              render: (row) => row.baseQuantity.toLocaleString("pt-BR"),
            },
            {
              key: "inventoryTotal",
              header: "Inventário total",
              width: "w-32",
              align: "center",
              sortable: true,
              render: (row) => row.inventoryTotal.toLocaleString("pt-BR"),
            },
          ]}
          actions={
            isAdmin
              ? (row) => {
                  const draft = drafts[row.id] ?? String(row.quantity);
                  const dirty = draft !== String(row.quantity);
                  const saving = savingId === row.id;
                  return (
                    <Button
                      type="button"
                      variant={dirty ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={!dirty || saving}
                      onClick={() => void save(row)}
                    >
                      {saving ? "…" : "Salvar"}
                    </Button>
                  );
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}

function InventoryKanban({
  title,
  locations,
  rows,
  expanded,
  onToggle,
  header,
  emptyBoard,
  onReorder,
}: {
  title: string;
  locations: Location[];
  rows: SkuLocationRow[];
  expanded: string | null;
  onToggle: (id: string) => void;
  header: (location: Location, cards: SkuLocationRow[]) => { units: number; liquid: number; frozen: number; showState: boolean };
  emptyBoard: string;
  onReorder: (ids: string[]) => void;
}) {
  if (locations.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        <p className="text-sm text-muted-foreground">{emptyBoard}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <SortableKanbanColumns
        columnIds={locations.map((location) => location.id)}
        onReorder={onReorder}
        className="gap-4 pb-2"
      >
        {(columnId, handle) => {
          const location = locations.find((item) => item.id === columnId);
          if (!location) return null;
          const cards = rows.filter((row) => row.locationId === location.id);
          const { units, liquid, frozen, showState } = header(location, cards);
          return (
            <div className="w-64 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <KanbanColumnHandle attributes={handle.attributes} listeners={handle.listeners} />
                  <h3 className="truncate text-sm font-medium">{location.name}</h3>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {showState && <StateMarks liquid={liquid} frozen={frozen} />}
                  <Badge variant="secondary">{units.toLocaleString("pt-BR")} un</Badge>
                </span>
              </div>
              <div className="space-y-2">
                {cards.map((row) => {
                  const open = expanded === row.id;
                  return (
                    <Card
                      key={row.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onToggle(row.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
                            <p className="font-medium truncate">{row.name}</p>
                          </div>
                          <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span>
                            {row.total.toLocaleString("pt-BR")} {row.isComposite ? "SKU" : "un"}
                          </span>
                          <span className="text-muted-foreground">
                            {row.kind === "material"
                              ? row.lots || "Material"
                              : row.isComposite
                                ? `${row.pops.toLocaleString("pt-BR")} pops`
                                : `${row.boxCount} caixa${row.boxCount === 1 ? "" : "s"}`}
                          </span>
                        </div>
                        {row.isComposite && (
                          <Badge variant="outline" className="mt-2 text-[10px] font-normal">Composto</Badge>
                        )}
                        <div className="mt-2">
                          <GradeChips grades={row.grades} kind={row.kind} />
                        </div>
                        {open && <ExpandedDetails row={row} />}
                      </CardContent>
                    </Card>
                  );
                })}
                {cards.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem estoque</p>
                )}
              </div>
            </div>
          );
        }}
      </SortableKanbanColumns>
    </div>
  );
}

function ExpandedDetails({ row }: { row: SkuLocationRow }) {
  const keys: GradeKey[] = row.kind === "pop" ? ["AAA", "B", "C", "blocked", "analysis"] : ["AAA", "analysis", "blocked"];
  const groups = keys.filter((key) => row.grades[key] > 0 || row.boxes.some((box) => box.grade === key));

  return (
    <div className="mt-3 space-y-3 border-t pt-3 text-xs">
      {groups.map((key) => {
        const boxes = row.boxes.filter((box) => box.grade === key);
        const label = row.kind === "material" && key === "AAA" ? "Disponível" : GRADE_LABEL[key];
        return (
          <div key={key}>
            <p className="font-medium">
              {label} · {boxes.length} caixa{boxes.length === 1 ? "" : "s"} · {row.grades[key].toLocaleString("pt-BR")} un
            </p>
            {boxes.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {boxes.map((box) => (
                  <li key={box.id} className="flex justify-between gap-2 font-mono text-muted-foreground">
                    <span>{box.code}</span>
                    <span>
                      {box.quantity.toLocaleString("pt-BR")} un · {box.state}
                      {box.assembly ? " · caixa de montagem" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {row.kind === "pop" && row.boxes.length === 0 && (
        <p className="text-muted-foreground">
          {row.isComposite ? "SKU composto nesta prateleira — sem caixa média." : "Sem caixas médias vinculadas nesta localização."}
        </p>
      )}
      {row.lots && <p className="text-muted-foreground">Lote: {row.lots}</p>}
    </div>
  );
}

type MaterialLineRow = {
  id: string;
  stockId: string | null;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  locationId: string;
  locationName: string;
  search: string;
};

function MaterialTotalsTable() {
  const { products, materialStock, locations, adjustMaterialLine } = useAppStore();
  const materialLocations = useMemo(() => locationsForKind(locations, "material"), [locations]);
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; locationId: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo<MaterialLineRow[]>(() => {
    const locationName = (id: string) => locations.find((item) => item.id === id)?.name || "—";
    const seen = new Set<string>();
    const lines: MaterialLineRow[] = materialStock.map((item) => {
        const product = products.find((row) => row.id === item.product_id);
        seen.add(item.product_id);
        return {
          id: item.id,
          stockId: item.id,
          productId: item.product_id,
          sku: product?.code || "—",
          name: product?.name || "—",
          quantity: item.quantity,
          locationId: item.location_id,
          locationName: locationName(item.location_id),
          search: `${product?.code || ""} ${product?.name || ""} ${locationName(item.location_id)}`.toLowerCase(),
        };
      });
    for (const product of products.filter((item) => item.kind === "material" && item.is_active !== false)) {
      if (seen.has(product.id)) continue;
      lines.push({
        id: `new:${product.id}`,
        stockId: null,
        productId: product.id,
        sku: product.code,
        name: product.name || "—",
        quantity: 0,
        locationId: materialLocations[0]?.id || "",
        locationName: materialLocations[0]?.name || "—",
        search: `${product.code} ${product.name || ""}`.toLowerCase(),
      });
    }
    return lines.sort(
      (a, b) => a.sku.localeCompare(b.sku, "pt-BR") || a.locationName.localeCompare(b.locationName, "pt-BR")
    );
  }, [products, materialStock, locations, materialLocations]);

  const draftOf = (row: MaterialLineRow) =>
    drafts[row.id] || { quantity: String(row.quantity), locationId: row.locationId };

  const save = async (row: MaterialLineRow) => {
    const draft = draftOf(row);
    const next = Number(draft.quantity);
    if (!Number.isFinite(next) || next < 0 || Math.round(next) !== next) {
      setError("Informe uma quantidade inteira maior ou igual a zero.");
      return;
    }
    if (!draft.locationId) {
      setError("Escolha o local do material.");
      return;
    }
    setSavingId(row.id);
    setError(null);
    try {
      await adjustMaterialLine({
        stockId: row.stockId,
        productId: row.productId,
        quantity: next,
        locationId: draft.locationId,
      });
      setDrafts((current) => {
        const { [row.id]: _ignored, ...rest } = current;
        return rest;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o material.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle className="text-base">Todos os materiais</CardTitle>
            <CardDescription>Altere a quantidade e o local de cada linha e salve.</CardDescription>
          </div>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        {error ? <p className="pt-2 text-sm text-destructive">{error}</p> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <DataTable
          data={rows}
          searchKey="search"
          searchPlaceholder="Buscar material ou local…"
          emptyMessage="Nenhum material cadastrado."
          maxHeight="calc(100vh - 280px)"
          actionsHeader="Salvar"
          columns={[
            {
              key: "sku",
              header: "Código",
              width: "w-28",
              align: "center",
              sortable: true,
              render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
            },
            { key: "name", header: "Material", sortable: true },
            {
              key: "locationName",
              header: "Local",
              sortable: true,
              render: (row) => (
                <select
                  className="h-8 max-w-[14rem] rounded-md border border-input bg-background px-2 text-xs"
                  value={draftOf(row).locationId}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.id]: { ...draftOf(row), locationId: event.target.value },
                    }))
                  }
                >
                  {materialLocations.length === 0 ? <option value="">Cadastre um local de material</option> : null}
                  {materialLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                  {row.locationId && !materialLocations.some((location) => location.id === row.locationId) ? (
                    <option value={row.locationId}>{row.locationName}</option>
                  ) : null}
                </select>
              ),
            },
            {
              key: "quantity",
              header: "Quantidade",
              width: "w-28",
              align: "center",
              sortable: true,
              render: (row) => (
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="mx-auto h-8 w-[5.5rem] text-center text-xs"
                  value={draftOf(row).quantity}
                  disabled={savingId === row.id}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.id]: { ...draftOf(row), quantity: event.target.value },
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void save(row);
                  }}
                />
              ),
            },
          ]}
          actions={(row) => {
            const draft = draftOf(row);
            const dirty = draft.quantity !== String(row.quantity) || draft.locationId !== row.locationId;
            const saving = savingId === row.id;
            return (
              <Button
                type="button"
                variant={dirty ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!dirty || saving}
                onClick={() => void save(row)}
              >
                {saving ? "…" : "Salvar"}
              </Button>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

export function MaterialsPage() {
  return <InventoryBoard kind="material" />;
}

export function InventoryPage() {
  return <InventoryBoard kind="sku" />;
}

function InventoryBoard({ kind }: { kind: "sku" | "material" }) {
  const {
    locations,
    products,
    assets,
    stock,
    materialStock,
    productComponents,
    kanbanColumnOrders,
    saveKanbanColumnOrder,
    orders,
    orderItems,
    separationJobs,
  } = useAppStore();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const skuLocations = useMemo(() => {
    const defaults = locationsForKind(locations, "sku");
    const order = applySavedColumnOrder(
      defaults.map((location) => location.id),
      kanbanColumnOrders[KANBAN_BOARDS.inventorySku]
    );
    return order
      .map((id) => defaults.find((location) => location.id === id))
      .filter((location): location is Location => Boolean(location));
  }, [locations, kanbanColumnOrders]);
  const materialLocations = useMemo(() => {
    const defaults = locationsForKind(locations, "material");
    const order = applySavedColumnOrder(
      defaults.map((location) => location.id),
      kanbanColumnOrders[KANBAN_BOARDS.inventoryMaterial]
    );
    return order
      .map((id) => defaults.find((location) => location.id === id))
      .filter((location): location is Location => Boolean(location));
  }, [locations, kanbanColumnOrders]);
  const boardLocations = kind === "material" ? materialLocations : skuLocations;

  const rows = useMemo(
    () => buildRows(locations, products, assets, stock, materialStock, productComponents),
    [locations, products, assets, stock, materialStock, productComponents]
  );
  const filtered = rows.filter((row) => row.search.toLowerCase().includes(search.toLowerCase().trim()));
  const skuRows = filtered.filter((row) => row.kind === "pop");
  const materialRows = filtered.filter((row) => row.kind === "material");
  const listRows = kind === "material" ? materialRows : skuRows;
  const liveMaterials = materialStock.filter((item) => item.quantity > 0 && item.status !== "blocked");
  const totalMaterials = liveMaterials.reduce((sum, item) => sum + item.quantity, 0);
  const analysisMaterials = liveMaterials
    .filter((item) => item.status === "analysis")
    .reduce((sum, item) => sum + item.quantity, 0);
  const availableMaterials = Math.max(0, totalMaterials - analysisMaterials);
  const countable = stock.filter(isCountablePop);
  const popUnits = (item: Stock) => stockPopUnits(item, products, productComponents);
  const totalPops = countable.reduce((sum, item) => sum + popUnits(item), 0);
  const reserved = useMemo(
    () => reservedSkuMap(orders, separationJobs, orderItems),
    [orders, separationJobs, orderItems]
  );
  const reservedPops = useMemo(() => {
    const productIds = new Set<string>();
    for (const key of reserved.keys()) {
      productIds.add(key.slice(0, key.lastIndexOf(":")));
    }
    let total = 0;
    for (const productId of productIds) {
      const product = products.find((row) => row.id === productId);
      if (!product || product.kind === "material") continue;
      const qty = reservedQuantityForProduct(reserved, productId);
      total += reservedPopUnitsForProduct(qty, productId, products, productComponents);
    }
    return total;
  }, [reserved, products, productComponents]);
  const livrePops = Math.max(0, totalPops - reservedPops);
  const totalFrozen = countable
    .filter((item) => item.physical_state === "frozen")
    .reduce((sum, item) => sum + popUnits(item), 0);
  const totalLiquid = countable
    .filter((item) => item.physical_state !== "frozen")
    .reduce((sum, item) => sum + popUnits(item), 0);
  const totalAaa = countable.filter((item) => gradeKey(item) === "AAA").reduce((sum, item) => sum + popUnits(item), 0);
  const totalB = countable.filter((item) => gradeKey(item) === "B").reduce((sum, item) => sum + popUnits(item), 0);
  const totalC = countable.filter((item) => gradeKey(item) === "C").reduce((sum, item) => sum + popUnits(item), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {kind === "material" ? "Materiais" : "Inventário - SKUs"}
          </h1>
          <p className="text-muted-foreground">
            {kind === "material"
              ? "Estoque real de materiais por localização"
              : "Estoque real de SKUs por localização"}
          </p>
        </div>
        <Button asChild>
          <Link to="/operacoes/receber">
            <Plus className="mr-2 h-4 w-4" />
            Novo recebimento
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {kind === "material" ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-3xl">{totalMaterials.toLocaleString("pt-BR")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm">
                <p className="text-xs text-muted-foreground">unidades de material em estoque</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Disponível</CardDescription>
                <CardTitle className="text-3xl">{availableMaterials.toLocaleString("pt-BR")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm">
                <p className="text-xs text-muted-foreground">fora de análise</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Análise</CardDescription>
                <CardTitle className="text-3xl">{analysisMaterials.toLocaleString("pt-BR")}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm">
                <p className="text-xs text-muted-foreground">ainda em conferência</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-3xl">{totalPops.toLocaleString("pt-BR")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-sm">
                <p className="text-xs text-muted-foreground">pops, sem rejeito (unidades + SKUs montados)</p>
                <div className="flex justify-between gap-2 pt-1">
                  <span className="text-muted-foreground">Reservado</span>
                  <span className="font-semibold">{reservedPops.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Livre</span>
                  <span className="font-semibold">{livrePops.toLocaleString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Estado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-fuchsia-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-fuchsia-100">
                      <Droplets className="h-3 w-3" />
                    </span>
                    Líquido
                  </span>
                  <span className="font-semibold">{totalLiquid.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1.5 text-sky-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-100">
                      <Snowflake className="h-3 w-3" />
                    </span>
                    Congelado
                  </span>
                  <span className="font-semibold">{totalFrozen.toLocaleString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Classificação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">AAA</span>
                  <span className="font-semibold">{totalAaa.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">B</span>
                  <span className="font-semibold">{totalB.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">C</span>
                  <span className="font-semibold">{totalC.toLocaleString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Localizações</CardDescription>
            <CardTitle className="text-3xl">{boardLocations.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">áreas cadastradas</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={kind === "material" ? "Buscar material, local ou lote…" : "Buscar SKU, sabor, local ou lote…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-8">
          {boardLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Cadastre localizações em Cadastros.</p>
          ) : (
            kind === "material" ? (
              <InventoryKanban
                title="Materiais"
                locations={materialLocations}
                rows={materialRows}
                expanded={expanded}
                onToggle={(id) => setExpanded(expanded === id ? null : id)}
                onReorder={(ids) => {
                  void saveKanbanColumnOrder(KANBAN_BOARDS.inventoryMaterial, ids);
                }}
                emptyBoard="Nenhum material em estoque."
                header={(_location, cards) => ({
                  units: cards.reduce((sum, row) => sum + row.total, 0),
                  liquid: 0,
                  frozen: 0,
                  showState: false,
                })}
              />
            ) : (
              <InventoryKanban
                title="SKUs e produtos montados"
                locations={skuLocations}
                rows={skuRows}
                expanded={expanded}
                onToggle={(id) => setExpanded(expanded === id ? null : id)}
                onReorder={(ids) => {
                  void saveKanbanColumnOrder(KANBAN_BOARDS.inventorySku, ids);
                }}
                emptyBoard="Nenhum SKU em estoque."
                header={(location) => {
                  const inLocation = countable.filter((item) => item.location_id === location.id);
                  return {
                    units: inLocation.reduce((sum, item) => sum + popUnits(item), 0),
                    liquid: inLocation
                      .filter((item) => item.physical_state !== "frozen")
                      .reduce((sum, item) => sum + popUnits(item), 0),
                    frozen: inLocation
                      .filter((item) => item.physical_state === "frozen")
                      .reduce((sum, item) => sum + popUnits(item), 0),
                    showState: true,
                  };
                }}
              />
            )
          )}
        </TabsContent>

        <TabsContent value="list">
          <DataTable
            data={listRows}
            maxHeight="70vh"
            emptyMessage={
              kind === "material"
                ? "Nenhum material em estoque."
                : "Nenhum estoque registrado. Receba uma nota fiscal para começar."
            }
            columns={[
              { key: "sku", header: "SKU", sortable: true, render: (row) => <span className="font-mono text-xs">{row.sku}</span> },
              { key: "name", header: "Produto", sortable: true },
              { key: "locationName", header: "Local", sortable: true },
              {
                key: "total",
                header: "Un.",
                sortable: true,
                render: (row) => row.total.toLocaleString("pt-BR"),
              },
              {
                key: "boxCount",
                header: "Caixas",
                sortable: true,
              },
              {
                key: "aaa",
                header: "AAA",
                sortable: true,
                render: (row) => qtyCell(row.grades.AAA),
              },
              {
                key: "b",
                header: "B",
                sortable: true,
                render: (row) => qtyCell(row.grades.B),
              },
              {
                key: "c",
                header: "C",
                sortable: true,
                render: (row) => qtyCell(row.grades.C),
              },
              {
                key: "blocked",
                header: "Rejeito",
                sortable: true,
                render: (row) => qtyCell(row.grades.blocked),
              },
              {
                key: "analysis",
                header: "Análise",
                sortable: true,
                render: (row) => qtyCell(row.grades.analysis),
              },
              {
                key: "liquid",
                header: "Estado",
                render: (row) => (row.kind === "pop" ? stateLabel(row.liquid, row.frozen) : "—"),
              },
            ]}
            actions={(row) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setExpanded(expanded === `list:${row.id}` ? null : `list:${row.id}`)}
              >
                {expanded === `list:${row.id}` ? "Ocultar" : "Caixas"}
              </Button>
            )}
          />
          {expanded?.startsWith("list:") && (
            <Card className="mt-3">
              <CardContent className="p-4">
                {(() => {
                  const row = listRows.find((item) => `list:${item.id}` === expanded);
                  if (!row) return null;
                  return (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {row.sku} · {row.name} · {row.locationName}
                      </p>
                      <ExpandedDetails row={row} />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {kind === "material" ? <MaterialTotalsTable /> : <SkuTotalsTable />}
    </div>
  );
}
