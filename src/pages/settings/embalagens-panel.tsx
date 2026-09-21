import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pencil, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatableSelect, type SelectOption } from "@/components/ui/creatable-select";
import {
  EMBALAGEM_CATEGORY,
  formatBoxOuterMeasures,
  isBoxAsset,
  nextSequentialCode,
  sequentialBoxCodes,
} from "@/lib/operational-assets";
import { orderedBoxYardLocations } from "@/lib/locations";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAppStore } from "@/stores";
import type { Asset, Location } from "@/types/database";

const emptyForm = {
  type: "caixa_media",
  quantity: "1",
  code: "",
  description: "",
  unit_capacity: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  photo_url: "",
  location_id: "",
  autoGenerate: true,
};

type BoxForm = typeof emptyForm;

type BoxTypeRow = {
  id: string;
  type: string;
  label: string;
  quantity: number;
  description: string;
  unit_capacity: number | null;
  measures: string;
  photo_url: string;
  search: string;
};

function slugType(label: string) {
  return (
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "caixa"
  );
}

function parseCmField(value: string, label: string): number | null | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    alert(`Informe ${label} em centímetros, com um número maior que zero.`);
    return undefined;
  }
  return parsed;
}

async function uploadBoxPhoto(file: File) {
  if (!isSupabaseConfigured || !supabase) return URL.createObjectURL(file);
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `assets/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("asset-files").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("asset-files").getPublicUrl(path).data.publicUrl;
}

function printQr(code: string, svg: SVGElement | null) {
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const popup = window.open("", "_blank", "width=420,height=520");
  if (!popup) return;
  popup.document.write(
    `<!doctype html><title>${code}</title><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif">${svgData}<p style="font-size:24px;font-family:monospace;font-weight:700">${code}</p></body>`
  );
  popup.document.close();
  popup.focus();
  popup.print();
}

function BoxPhotoSlot({
  url,
  onPick,
  onClear,
}: {
  url: string;
  onPick: (file: File) => Promise<void> | void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex w-28 shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted"
      >
        {url ? (
          <img src={url} alt="Foto da caixa" className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">Foto</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onPick(file);
          event.target.value = "";
        }}
      />
      {url ? (
        <button type="button" className="text-[10px] text-muted-foreground hover:text-destructive" onClick={onClear}>
          Remover
        </button>
      ) : (
        <span className="text-[10px] text-muted-foreground">Clique para enviar</span>
      )}
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  available: { label: "Disponível", variant: "default" },
  in_use: { label: "Em uso", variant: "secondary" },
  with_product: { label: "Com produto", variant: "secondary" },
  empty_ready_return: { label: "Vazia p/ retorno", variant: "outline" },
  at_factory: { label: "Na fábrica", variant: "outline" },
  in_transit: { label: "Em trânsito", variant: "secondary" },
  inspection: { label: "Inspeção", variant: "outline" },
  cleaning: { label: "Limpeza", variant: "outline" },
  damaged: { label: "Danificada", variant: "destructive" },
};

export function EmbalagensPanel() {
  const {
    assets,
    locations,
    boxTypes,
    createAssets,
    updateAsset,
    deleteAsset,
    deleteAssets,
    fetchBoxTypes,
    upsertBoxType,
    renameBoxType,
    deleteBoxType,
  } = useAppStore();
  const homeLocationId = orderedBoxYardLocations(locations)[0]?.id || "";
  const boxes = useMemo(
    () => assets.filter((asset) => asset.is_active !== false && isBoxAsset(asset)),
    [assets]
  );

  useEffect(() => {
    void fetchBoxTypes();
  }, [fetchBoxTypes]);

  const typeOptions: SelectOption[] = useMemo(
    () => boxTypes.map((row) => ({ value: row.value, label: row.label })),
    [boxTypes]
  );

  const typeLabel = (type: string) =>
    boxTypes.find((option) => option.value === type)?.label || type.replace(/_/g, " ");

  const typeRows = useMemo<BoxTypeRow[]>(() => {
    const groups = new Map<string, Asset[]>();
    for (const box of boxes) {
      const list = groups.get(box.type) || [];
      list.push(box);
      groups.set(box.type, list);
    }
    return [...groups.entries()]
      .map(([type, units]) => {
        const sorted = [...units].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
        const sample = sorted[0];
        const label = typeLabel(type);
        return {
          id: type,
          type,
          label,
          quantity: sorted.length,
          description: sample.description || "",
          unit_capacity: sample.unit_capacity ?? null,
          measures: formatBoxOuterMeasures(sample) || "—",
          photo_url: sample.photo_url || "",
          search: `${label} ${type} ${sorted.map((unit) => unit.code).join(" ")}`.toLowerCase(),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [boxes, boxTypes]);

  const [form, setForm] = useState<BoxForm>({ ...emptyForm, location_id: homeLocationId });
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [unitsType, setUnitsType] = useState<string | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitEdit, setUnitEdit] = useState<Asset | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<Asset[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const takenCodes = new Set(boxes.map((box) => box.code.toLowerCase()));
  const quantity = Math.max(0, Math.floor(Number(form.quantity) || 0));
  const previewCodes =
    form.code.trim() && quantity > 0 ? sequentialBoxCodes(form.code.trim().toUpperCase(), quantity) : [];
  const lastPreview = previewCodes.at(-1);
  const colliding = previewCodes.filter((code) => takenCodes.has(code.toLowerCase()));

  const openCreate = (type?: string) => {
    const seedType = type || "caixa_media";
    const ofType = boxes.filter((box) => box.type === seedType);
    const sample = ofType[0];
    const start = nextSequentialCode(sample?.code || "CXG-001", boxes.map((box) => box.code));
    setForm({
      ...emptyForm,
      type: seedType,
      quantity: "1",
      code: start,
      description: sample?.description || "",
      unit_capacity: sample?.unit_capacity ? String(sample.unit_capacity) : "",
      length_cm: sample?.length_cm != null ? String(sample.length_cm) : "",
      width_cm: sample?.width_cm != null ? String(sample.width_cm) : "",
      height_cm: sample?.height_cm != null ? String(sample.height_cm) : "",
      photo_url: sample?.photo_url || "",
      location_id: sample?.location_id || homeLocationId,
      autoGenerate: true,
    });
    setCreateOpen(true);
  };

  const sharedFields = () => {
    const parsedCapacity = Number(form.unit_capacity);
    const unitCapacity = form.unit_capacity.trim()
      ? Number.isInteger(parsedCapacity) && parsedCapacity > 0
        ? parsedCapacity
        : undefined
      : null;
    if (form.unit_capacity.trim() && unitCapacity === undefined) {
      alert("Informe a capacidade em unidades, com um número maior que zero.");
      return null;
    }
    const length_cm = parseCmField(form.length_cm, "o comprimento");
    if (length_cm === undefined) return null;
    const width_cm = parseCmField(form.width_cm, "a largura");
    if (width_cm === undefined) return null;
    const height_cm = parseCmField(form.height_cm, "a altura");
    if (height_cm === undefined) return null;
    if (!form.location_id) {
      alert("Escolha o local da caixa.");
      return null;
    }
    return {
      name: typeLabel(form.type),
      description: form.description || null,
      type: form.type as Asset["type"],
      category: EMBALAGEM_CATEGORY,
      unit_capacity: unitCapacity ?? null,
      length_cm,
      width_cm,
      height_cm,
      dimensions: formatBoxOuterMeasures({ length_cm, width_cm, height_cm }) || null,
      photo_url: form.photo_url || null,
      location_id: form.location_id,
      status: "available" as const,
      is_active: true,
    };
  };

  const handleCreate = async () => {
    const shared = sharedFields();
    if (!shared) return;
    if (!form.code.trim()) {
      alert("Informe o código inicial.");
      return;
    }
    if (quantity < 1) {
      alert("Informe quantas embalagens criar.");
      return;
    }
    const count = form.autoGenerate ? quantity : 1;
    if (count > 500) {
      alert("Crie no máximo 500 unidades de uma vez.");
      return;
    }
    const codes = sequentialBoxCodes(form.code.trim().toUpperCase(), count);
    const clash = codes.filter((code) => takenCodes.has(code.toLowerCase()));
    if (clash.length) {
      alert(`Estes códigos já existem: ${clash.slice(0, 8).join(", ")}${clash.length > 8 ? "…" : ""}`);
      return;
    }
    if (count > 1 && !form.autoGenerate) {
      alert("Para cadastrar várias unidades, aceite a geração sequencial dos códigos.");
      return;
    }
    if (count > 1) {
      const ok = window.confirm(
        `Autogerar ${count} códigos únicos em sequência, de ${codes[0]} até ${codes[codes.length - 1]}?`
      );
      if (!ok) return;
    }
    setCreateBusy(true);
    try {
      await createAssets(codes.map((code) => ({ ...shared, code })));
      setCreateOpen(false);
      setForm({ ...emptyForm, location_id: homeLocationId });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível criar as embalagens.");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleSaveUnit = async () => {
    if (!unitEdit) return;
    const shared = sharedFields();
    if (!shared) return;
    const code = form.code.trim().toUpperCase();
    if (!code) {
      alert("Informe o código.");
      return;
    }
    if (takenCodes.has(code.toLowerCase()) && code.toLowerCase() !== unitEdit.code.toLowerCase()) {
      alert(`O código "${code}" já existe.`);
      return;
    }
    try {
      await updateAsset(unitEdit.id, { ...shared, code });
      setUnitEdit(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  };

  const units = unitsType
    ? boxes
        .filter((box) => box.type === unitsType)
        .sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }))
    : [];
  const selectedUnits = units.filter((unit) => selectedUnitIds.includes(unit.id));

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Embalagens Vai-Vem</CardTitle>
              <CardDescription className="text-xs">
                Poucos tipos, muitas unidades. Cada caixa física continua com código e QR únicos.
              </CardDescription>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={() => openCreate()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo tipo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            tableId="gestao-settings-embalagens-tipos"
            data={typeRows}
            searchKey="search"
            searchPlaceholder="Buscar tipo ou código..."
            emptyMessage="Nenhuma embalagem cadastrada."
            columns={[
              {
                key: "photo_url",
                header: "",
                width: "w-12",
                sortable: false,
                render: (row) =>
                  row.photo_url ? (
                    <img src={row.photo_url} alt="" className="h-9 w-9 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                      —
                    </div>
                  ),
              },
              {
                key: "label",
                header: "Tipo",
                render: (row) => <span className="font-medium">{row.label}</span>,
              },
              {
                key: "description",
                header: "Descrição",
                render: (row) => <span className="text-sm text-muted-foreground">{row.description || "—"}</span>,
              },
              {
                key: "quantity",
                header: "Unidades",
                width: "w-24",
                align: "center",
                render: (row) => <span className="font-medium">{row.quantity}</span>,
              },
              {
                key: "unit_capacity",
                header: "Capacidade",
                width: "w-28",
                render: (row) => (
                  <span className="text-sm">{row.unit_capacity ? `${row.unit_capacity} un` : "—"}</span>
                ),
              },
              {
                key: "measures",
                header: "Medidas",
                width: "w-36",
                render: (row) => <span className="text-sm text-muted-foreground">{row.measures}</span>,
              },
            ]}
            actions={(row) => (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setUnitsType(row.type)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Unidades
              </Button>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Nova embalagem vai-vem</DialogTitle>
            <DialogDescription className="text-sm">
              Cadastre o tipo e a quantidade. Os códigos únicos podem ser gerados em sequência.
            </DialogDescription>
          </DialogHeader>
          <BoxFormFields
            form={form}
            setForm={setForm}
            typeOptions={typeOptions}
            onCreateType={async (label) => {
              const value = slugType(label);
              await upsertBoxType(value, label);
              return value;
            }}
            onRenameType={async (value, label) => {
              await renameBoxType(value, label);
            }}
            onDeleteType={async (value) => {
              await deleteBoxType(value);
            }}
            locations={locations}
            showQuantity
          />
          {quantity > 1 && form.code.trim() ? (
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.autoGenerate}
                onChange={(event) => setForm({ ...form, autoGenerate: event.target.checked })}
              />
              <span>
                Autogerar <strong>{quantity}</strong> códigos únicos em sequência
                {lastPreview ? `, de ${form.code.trim().toUpperCase()} até ${lastPreview}` : ""}?
              </span>
            </label>
          ) : null}
          {colliding.length > 0 ? (
            <p className="text-xs text-destructive">
              Código já existente na sequência: {colliding.slice(0, 6).join(", ")}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-9"
              disabled={createBusy || colliding.length > 0}
              onClick={() => void handleCreate()}
            >
              {createBusy ? "Criando…" : quantity > 1 && form.autoGenerate ? `Criar ${quantity} unidades` : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(unitsType)}
        onOpenChange={(open) => {
          if (!open) {
            setUnitsType(null);
            setSelectedUnitIds([]);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{unitsType ? typeLabel(unitsType) : "Unidades"}</DialogTitle>
            <DialogDescription className="text-sm">
              {units.length} unidade{units.length === 1 ? "" : "s"} com código e QR individuais.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <DataTable
              tableId={`gestao-settings-embalagens-unidades::${unitsType || ""}`}
              data={units}
              searchKey="code"
              searchPlaceholder="Buscar código..."
              emptyMessage="Nenhuma unidade neste tipo."
              maxHeight="50vh"
              selectedIds={selectedUnitIds}
              onSelectedIdsChange={setSelectedUnitIds}
              columns={[
                {
                  key: "code",
                  header: "Código",
                  width: "w-32",
                  render: (item) => (
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{item.code}</code>
                  ),
                },
                {
                  key: "qr",
                  header: "QR",
                  width: "w-20",
                  sortable: false,
                  align: "center",
                  render: (item) => (
                    <button
                      type="button"
                      className="mx-auto block bg-white p-0.5"
                      title="Abrir QR"
                      onClick={() => setQrAsset(item)}
                    >
                      <QRCodeSVG value={item.code} size={40} level="M" includeMargin={false} />
                    </button>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  width: "w-32",
                  render: (item) => {
                    const status = STATUS_MAP[item.status] || { label: item.status, variant: "outline" as const };
                    return (
                      <Badge variant={status.variant} className="text-xs font-normal">
                        {status.label}
                      </Badge>
                    );
                  },
                },
                {
                  key: "location_id",
                  header: "Local",
                  render: (item) => (
                    <span className="text-sm text-muted-foreground">
                      {locations.find((location) => location.id === item.location_id)?.name || "—"}
                    </span>
                  ),
                },
              ]}
              actions={(item) => (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Editar"
                    onClick={() => {
                      setUnitEdit(item);
                      setForm({
                        type: item.type,
                        quantity: "1",
                        code: item.code,
                        description: item.description || "",
                        unit_capacity: item.unit_capacity ? String(item.unit_capacity) : "",
                        length_cm: item.length_cm != null ? String(item.length_cm) : "",
                        width_cm: item.width_cm != null ? String(item.width_cm) : "",
                        height_cm: item.height_cm != null ? String(item.height_cm) : "",
                        photo_url: item.photo_url || "",
                        location_id: item.location_id || homeLocationId,
                        autoGenerate: false,
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="QR Code" onClick={() => setQrAsset(item)}>
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Imprimir QR"
                    onClick={() => {
                      setQrAsset(item);
                      window.setTimeout(() => {
                        printQr(item.code, qrRef.current?.querySelector("svg") || null);
                      }, 80);
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Excluir"
                    onClick={() => setDeleteTargets([item])}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={units.length === 0}
                onClick={() => setSelectedUnitIds(units.map((unit) => unit.id))}
              >
                Selecionar todas
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9"
                disabled={selectedUnitIds.length === 0}
                onClick={() => setSelectedUnitIds([])}
              >
                Limpar seleção
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-9"
                disabled={selectedUnits.length === 0}
                onClick={() => setDeleteTargets(selectedUnits)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Excluir {selectedUnits.length || ""}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-9" onClick={() => unitsType && openCreate(unitsType)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar unidades
              </Button>
              <Button type="button" className="h-9" onClick={() => setUnitsType(null)}>
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(unitEdit)} onOpenChange={(open) => !open && setUnitEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Editar unidade {unitEdit?.code}</DialogTitle>
          </DialogHeader>
          <BoxFormFields
            form={form}
            setForm={setForm}
            typeOptions={typeOptions}
            onCreateType={async (label) => {
              const value = slugType(label);
              await upsertBoxType(value, label);
              return value;
            }}
            onRenameType={async (value, label) => {
              await renameBoxType(value, label);
            }}
            onDeleteType={async (value) => {
              await deleteBoxType(value);
            }}
            locations={locations}
            showQuantity={false}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" onClick={() => setUnitEdit(null)}>
              Cancelar
            </Button>
            <Button type="button" className="h-9" onClick={() => void handleSaveUnit()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrAsset)} onOpenChange={(open) => !open && setQrAsset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5" />
              QR Code — {qrAsset?.code}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            <div ref={qrRef} className="rounded-lg border bg-white p-4">
              {qrAsset ? <QRCodeSVG value={qrAsset.code} size={200} level="H" includeMargin /> : null}
            </div>
            <p className="mt-3 font-mono text-lg font-bold">{qrAsset?.code}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => printQr(qrAsset?.code || "", qrRef.current?.querySelector("svg") || null)}
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                const svg = qrRef.current?.querySelector("svg");
                if (!svg || !qrAsset) return;
                const svgData = new XMLSerializer().serializeToString(svg);
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const img = new Image();
                img.onload = () => {
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx?.drawImage(img, 0, 0);
                  const link = document.createElement("a");
                  link.download = `qr-${qrAsset.code}.png`;
                  link.href = canvas.toDataURL("image/png");
                  link.click();
                };
                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PNG
            </Button>
            <Button type="button" className="h-9" onClick={() => setQrAsset(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargets.length > 0} onOpenChange={(open) => !open && !deleteBusy && setDeleteTargets([])}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {deleteTargets.length === 1
                ? `Excluir ${deleteTargets[0]?.code}?`
                : `Excluir ${deleteTargets.length} unidades?`}
            </DialogTitle>
            <DialogDescription>
              {deleteTargets.length === 1
                ? "A unidade sai do cadastro. Histórico operacional pode manter o código inativo."
                : `${deleteTargets
                    .slice(0, 6)
                    .map((unit) => unit.code)
                    .join(", ")}${deleteTargets.length > 6 ? "…" : ""}. Histórico operacional pode manter os códigos inativos.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-9" disabled={deleteBusy} onClick={() => setDeleteTargets([])}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9"
              disabled={deleteBusy}
              onClick={async () => {
                if (!deleteTargets.length) return;
                setDeleteBusy(true);
                try {
                  const ids = deleteTargets.map((unit) => unit.id);
                  if (ids.length === 1) await deleteAsset(ids[0]);
                  else await deleteAssets(ids);
                  setSelectedUnitIds((current) => current.filter((id) => !ids.includes(id)));
                  setDeleteTargets([]);
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Não foi possível excluir.");
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoxFormFields({
  form,
  setForm,
  typeOptions,
  onCreateType,
  onRenameType,
  onDeleteType,
  locations,
  showQuantity,
}: {
  form: BoxForm;
  setForm: (next: BoxForm) => void;
  typeOptions: SelectOption[];
  onCreateType: (label: string) => Promise<string>;
  onRenameType: (value: string, label: string) => Promise<void>;
  onDeleteType: (value: string) => Promise<void>;
  locations: Location[];
  showQuantity: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-start gap-4">
        <BoxPhotoSlot
          url={form.photo_url}
          onPick={async (file) => {
            try {
              const url = await uploadBoxPhoto(file);
              setForm({ ...form, photo_url: url });
            } catch (error) {
              alert(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
            }
          }}
          onClear={() => setForm({ ...form, photo_url: "" })}
        />
        <p className="pt-2 text-xs text-muted-foreground">Foto do tipo, usada nas unidades criadas agora.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Tipo</Label>
          <CreatableSelect
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value })}
            options={typeOptions}
            onCreateOption={async (label) => {
              try {
                const value = await onCreateType(label);
                setForm({ ...form, type: value });
                return value;
              } catch (error) {
                alert(error instanceof Error ? error.message : "Não foi possível criar o tipo.");
                return form.type;
              }
            }}
            onEditOption={(value, newLabel) => {
              void onRenameType(value, newLabel).catch((error) => {
                alert(error instanceof Error ? error.message : "Não foi possível renomear o tipo.");
              });
            }}
            onDeleteOption={(value) => {
              void onDeleteType(value).catch((error) => {
                alert(error instanceof Error ? error.message : "Não foi possível excluir o tipo.");
              });
            }}
            placeholder="Selecione o tipo..."
            createPlaceholder="Novo tipo..."
          />
        </div>
        {showQuantity ? (
          <div className="space-y-2">
            <Label htmlFor="boxQty" className="text-sm">
              Quantidade de embalagens
            </Label>
            <Input
              id="boxQty"
              type="number"
              min={1}
              step={1}
              className="h-9"
              value={form.quantity}
              onChange={(event) =>
                setForm({ ...form, quantity: event.target.value, autoGenerate: Number(event.target.value) > 1 })
              }
              placeholder="Ex: 60"
            />
          </div>
        ) : (
          <div />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="boxCode" className="text-sm">
          {showQuantity ? "Código inicial" : "Código"}
        </Label>
        <Input
          id="boxCode"
          className="h-9 font-mono"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          placeholder="Ex: CXG-001"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="boxDesc" className="text-sm">
          Descrição
        </Label>
        <Input
          id="boxDesc"
          className="h-9"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Ex: Caixa grande retornável da fábrica"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="boxCap" className="text-sm">
          Capacidade (unidades)
        </Label>
        <Input
          id="boxCap"
          type="number"
          min={1}
          step={1}
          className="h-9"
          value={form.unit_capacity}
          onChange={(event) => setForm({ ...form, unit_capacity: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Medidas externas (cm)</Label>
        <div className="grid grid-cols-3 gap-3">
          <Input
            className="h-9"
            placeholder="Comp."
            value={form.length_cm}
            onChange={(event) => setForm({ ...form, length_cm: event.target.value })}
          />
          <Input
            className="h-9"
            placeholder="Larg."
            value={form.width_cm}
            onChange={(event) => setForm({ ...form, width_cm: event.target.value })}
          />
          <Input
            className="h-9"
            placeholder="Alt."
            value={form.height_cm}
            onChange={(event) => setForm({ ...form, height_cm: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Local</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.location_id}
          onChange={(event) => setForm({ ...form, location_id: event.target.value })}
        >
          {orderedBoxYardLocations(locations).map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
