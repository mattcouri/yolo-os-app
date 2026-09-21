import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores";
import { ProductMark } from "@/components/product-mark";
import { countedForItem, countedQuantity, declaredQuantity, formatVariance, isDirectEntryReceipt, remainingQuantity, varianceQuantity } from "@/lib/receipt-progress";
import type { Receipt, ReceiptItem } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  pending: "Em preparação",
  inspected: "Em preparação",
  closed: "Encerrada",
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function varianceClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

type ReceiptRow = {
  id: string;
  nf: string;
  rec: string;
  supplier: string;
  date: string;
  status: Receipt["status"];
  declared: number;
  counted: number;
  variance: number;
  remaining: number;
  skus: string;
  search: string;
  locked: boolean;
  notes: string | null;
  direct: boolean;
};

export function ReceiptsPage() {
  const {
    receipts,
    receiptItems,
    stock,
    materialStock,
    products,
    inspections,
    assets,
    locations,
    updateReceipt,
    reopenReceipt,
    deleteReceipt,
  } = useAppStore();

  const [editing, setEditing] = useState<Receipt | null>(null);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [deleting, setDeleting] = useState<ReceiptRow | null>(null);
  const [form, setForm] = useState({ nf_number: "", supplier: "", receipt_date: "", notes: "" });
  const [itemForm, setItemForm] = useState<{ id: string; quantity: string; lot: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const toast = (location.state as { toast?: string } | null)?.toast;

  const rows = useMemo<ReceiptRow[]>(
    () =>
      [...receipts]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((receipt) => {
          const items = receiptItems.filter((item) => item.receipt_id === receipt.id);
          const remaining = remainingQuantity(receipt.id, stock, materialStock);
          const counted = countedQuantity(receipt, items, inspections);
          const variance = receipt.variance_quantity ?? varianceQuantity(counted, declaredQuantity(items));
          const locked = receipt.status === "closed"
            || inspections.some((insp) => insp.receipt_id === receipt.id)
            || stock.some((s) => s.receipt_id === receipt.id && s.status !== "analysis" && s.status !== "depleted" && s.quantity > 0);
          const direct = isDirectEntryReceipt(receipt);
          return {
            id: receipt.id,
            nf: receipt.nf_number,
            rec: receipt.receipt_number,
            supplier: receipt.supplier,
            date: receipt.receipt_date,
            status: receipt.status,
            declared: declaredQuantity(items),
            counted,
            variance,
            remaining,
            skus: items
              .map((item) => products.find((p) => p.id === item.product_id)?.code || "")
              .filter(Boolean)
              .join(", "),
            search: `${receipt.nf_number} ${receipt.receipt_number} ${receipt.supplier}`,
            locked,
            notes: receipt.close_notes,
            direct,
          };
        }),
    [receipts, receiptItems, stock, materialStock, products, inspections]
  );

  const editingItems: ReceiptItem[] = editing
    ? receiptItems.filter((item) => item.receipt_id === editing.id)
    : [];
  const editingLocked = editing
    ? rows.find((row) => row.id === editing.id)?.locked ?? false
    : false;

  const openEdit = (row: ReceiptRow) => {
    const receipt = receipts.find((item) => item.id === row.id);
    if (!receipt) return;
    setError("");
    setConfirmReopen(false);
    setEditing(receipt);
    setForm({
      nf_number: receipt.nf_number,
      supplier: receipt.supplier,
      receipt_date: receipt.receipt_date,
      notes: receipt.notes || "",
    });
    setItemForm(
      receiptItems
        .filter((item) => item.receipt_id === receipt.id)
        .map((item) => ({ id: item.id, quantity: String(item.quantity), lot: item.lot || "" }))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError("");
    if (!form.nf_number.trim() || !form.supplier.trim() || !form.receipt_date) {
      setError("Preencha NF, origem e data.");
      return;
    }
    const items = editingLocked
      ? undefined
      : itemForm.map((item) => {
          const quantity = Number(item.quantity);
          return { id: item.id, quantity, lot: item.lot.trim() || null };
        });
    if (items?.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) {
      setError("Informe quantidades válidas em todos os itens.");
      return;
    }
    setSaving(true);
    try {
      await updateReceipt(editing.id, {
        nf_number: form.nf_number.trim(),
        supplier: form.supplier.trim(),
        receipt_date: form.receipt_date,
        notes: form.notes.trim() || null,
        items,
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!editing) return;
    setError("");
    setSaving(true);
    try {
      await reopenReceipt(editing.id);
      setConfirmReopen(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reabrir.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setError("");
    setSaving(true);
    try {
      await deleteReceipt(deleting.id);
      setDeleting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  };

  const deleteImpact = deleting
    ? (() => {
        const relatedStock = stock.filter((s) => s.receipt_id === deleting.id);
        const relatedMaterials = materialStock.filter((m) => m.receipt_id === deleting.id);
        const items = receiptItems.filter((item) => item.receipt_id === deleting.id);
        const units = [...relatedStock, ...relatedMaterials].reduce((sum, row) => sum + row.quantity, 0);
        const byLocation = new Map<string, number>();
        for (const row of [...relatedStock, ...relatedMaterials]) {
          byLocation.set(row.location_id, (byLocation.get(row.location_id) || 0) + row.quantity);
        }
        const inboundCodes = items.flatMap((item) => item.source_box_codes || []);
        const boxIds = new Set([
          ...inboundCodes.map((code) => assets.find((a) => a.code === code)?.id).filter(Boolean) as string[],
          ...relatedStock.map((s) => s.asset_id).filter((id): id is string => Boolean(id)),
        ]);
        return {
          units,
          boxes: boxIds.size,
          locations: [...byLocation.entries()].map(([locationId, quantity]) => ({
            name: locations.find((l) => l.id === locationId)?.name || "Local",
            quantity,
          })),
        };
      })()
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Notas fiscais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notas de fornecedor entram direto no estoque. Notas da fábrica passam por Preparar.
        </p>
      </div>
      {toast && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {toast}
        </p>
      )}
      <DataTable
        data={rows}
        searchKey="search"
        searchPlaceholder="Buscar NF, REC ou fornecedor…"
        columns={[
          { key: "nf", header: "NF", sortable: true, render: (row) => <strong>{row.nf}</strong> },
          { key: "rec", header: "Recebimento", sortable: true },
          { key: "supplier", header: "Fornecedor / origem", sortable: true },
          { key: "date", header: "Data", sortable: true, render: (row) => formatDate(row.date) },
          {
            key: "skus",
            header: "SKUs",
            render: (row) => <span className="text-muted-foreground">{row.skus || "—"}</span>,
          },
          {
            key: "declared",
            header: "Declarado",
            render: (row) => row.declared.toLocaleString("pt-BR"),
          },
          {
            key: "counted",
            header: "Contado",
            render: (row) =>
              row.direct ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                row.counted.toLocaleString("pt-BR")
              ),
          },
          {
            key: "variance",
            header: "Diferença",
            render: (row) =>
              row.direct ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className={`font-medium ${varianceClass(row.variance)}`}>
                  {formatVariance(row.variance)}
                </span>
              ),
          },
          {
            key: "remaining",
            header: "A preparar",
            render: (row) =>
              row.status === "closed" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                row.remaining.toLocaleString("pt-BR")
              ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge variant={row.status === "closed" ? "outline" : "secondary"}>
                {row.direct ? "Recebida" : STATUS_LABEL[row.status] || row.status}
              </Badge>
            ),
          },
        ]}
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {row.status !== "closed" && (
              <Link to={`/operacoes/preparar/${row.id}`} className="text-primary text-xs hover:underline px-1">
                Preparar
              </Link>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(row)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              title="Excluir"
              onClick={() => {
                setError("");
                setDeleting(row);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
        emptyMessage="Nenhuma nota fiscal registrada."
      />

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setConfirmReopen(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {confirmReopen ? (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Reabrir NF {editing?.nf_number}?</DialogTitle>
                <DialogDescription>
                  A nota volta para Preparar. Levas já salvas continuam. A falta volta para análise para contar o que aparecer — inclusive rejeito. Encerre de novo quando a diferença estiver certa.
                </DialogDescription>
              </DialogHeader>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setError(""); setConfirmReopen(false); }}>
                  Voltar
                </Button>
                <Button type="button" disabled={saving} onClick={() => void handleReopen()}>
                  {saving ? "Reabrindo…" : "Reabrir preparação"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Editar nota fiscal</DialogTitle>
              <DialogDescription>
                {editing?.receipt_number}
                {editing && isDirectEntryReceipt(editing)
                  ? " · entrada direta no estoque"
                  : editing?.status === "closed"
                    ? " · preparação encerrada"
                    : editingLocked
                      ? " · itens já preparados não podem ser alterados"
                      : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número da NF</Label>
                <Input value={form.nf_number} onChange={(e) => setForm((current) => ({ ...current, nf_number: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={form.receipt_date} onChange={(e) => setForm((current) => ({ ...current, receipt_date: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Fornecedor / origem</Label>
                <Input value={form.supplier} onChange={(e) => setForm((current) => ({ ...current, supplier: e.target.value }))} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
              </div>
            </div>
            {editingItems.length > 0 && (
              <div className="space-y-2">
                <Label>Itens</Label>
                {itemForm.map((item, index) => {
                  const line = editingItems.find((row) => row.id === item.id);
                  const product = products.find((p) => p.id === line?.product_id);
                  const lineCounted = line ? countedForItem(line, inspections) : 0;
                  const lineVariance = line
                    ? (line.variance_quantity ?? varianceQuantity(lineCounted, line.quantity))
                    : 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="grid grid-cols-[1fr_90px_110px] gap-2 items-end">
                        <p className="text-sm truncate pb-2"><ProductMark product={product} /></p>
                        <div className="space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            min="1"
                            disabled={editingLocked}
                            value={item.quantity}
                            onChange={(e) => setItemForm((current) => current.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Lote</Label>
                          <Input
                            disabled={editingLocked}
                            value={item.lot}
                            onChange={(e) => setItemForm((current) => current.map((row, i) => i === index ? { ...row, lot: e.target.value } : row))}
                          />
                        </div>
                      </div>
                      {editing?.status === "closed" && !isDirectEntryReceipt(editing) && (
                        <p className="text-xs text-muted-foreground">
                          Contado {lineCounted.toLocaleString("pt-BR")}
                          {" · "}diferença{" "}
                          <span className={varianceClass(lineVariance)}>{formatVariance(lineVariance)}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {error && !deleting && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              {editing?.status === "closed" && !isDirectEntryReceipt(editing) && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setError("");
                    setConfirmReopen(true);
                  }}
                >
                  Reabrir preparação
                </Button>
              )}
              <div className="flex gap-2 sm:ml-auto">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
              </div>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir NF {deleting?.nf}?</DialogTitle>
            <DialogDescription>
              Isso apaga o documento {deleting?.rec}, tira as unidades do estoque e libera as caixas para disponível.
            </DialogDescription>
          </DialogHeader>
          {deleteImpact && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <p>
                {deleteImpact.units.toLocaleString("pt-BR")} un saem do estoque
                {deleteImpact.boxes > 0 ? ` · ${deleteImpact.boxes} caixa(s) voltam a disponível` : ""}.
              </p>
              {deleteImpact.locations.map((loc) => (
                <p key={loc.name} className="text-muted-foreground">
                  {loc.name}: −{loc.quantity.toLocaleString("pt-BR")} un
                </p>
              ))}
            </div>
          )}
          {error && deleting && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              {saving ? "Excluindo…" : "Excluir nota"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
