import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  ImagePlus,
  Pencil,
  Plus,
  QrCode,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreatableSelect } from "@/components/ui/creatable-select";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  ASSET_CATEGORIES,
  CONTROL_METHODS,
  OPERATIONAL_STATUSES,
  TECHNICAL_CATEGORIES,
  VOLTAGE_OPTIONS,
  addMonths,
  categoryLabel,
  categoryToAssetType,
  controlLabel,
  formatAge,
  kitCompleteness,
  statusLabel,
  suggestedAssetCode,
  warrantyStatus,
  isOperationalAsset,
} from "@/lib/operational-assets";
import { useAppStore } from "@/stores";
import type {
  Asset,
  AssetAttachment,
  AssetAttachmentKind,
  AssetComponent,
  AssetComponentCondition,
  AssetControlMethod,
  AssetStatus,
} from "@/types/database";

type ComponentDraft = {
  key: string;
  name: string;
  quantity: number;
  control_method: "individual" | "quantity";
  component_code: string;
  replaceable: boolean;
  notes: string;
  photo_url: string;
  is_present: boolean;
  condition: AssetComponentCondition;
};

type ExtraField = { key: string; label: string; value: string };

const emptyForm = {
  name: "",
  category: "freezer",
  control_method: "individual" as AssetControlMethod,
  code: "",
  acquired_at: "",
  location_id: "",
  status: "available" as AssetStatus,
  photo_url: "",
  description: "",
  brand: "",
  model: "",
  serial_number: "",
  sku_code: "",
  quantity_on_hand: "1",
  purchase_price: "",
  supplier: "",
  nf_number: "",
  warranty_until: "",
  useful_life_months: "",
  voltage: "",
  power_watts: "",
  plug_type: "",
  dimensions: "",
  weight_kg: "",
  capacity: "",
  color: "",
  operating_temp: "",
  handling_notes: "",
  specs: "",
  responsible_name: "",
  notes: "",
  last_maintenance_at: "",
  maintenance_notes: "",
};

function FormSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}

async function uploadAssetFile(file: File) {
  if (!isSupabaseConfigured || !supabase) {
    return URL.createObjectURL(file);
  }
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `assets/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("asset-files").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("asset-files").getPublicUrl(path).data.publicUrl;
}

function PhotoSlot({
  url,
  onPick,
  onClear,
}: {
  url: string;
  onPick: (file: File) => void;
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
          <img src={url} alt="Foto do ativo" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">Foto</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
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

function printQr(asset: Asset) {
  const win = window.open("", "_blank", "width=420,height=560");
  if (!win) return;
  const svg = document.getElementById(`qr-print-${asset.id}`)?.innerHTML || "";
  win.document.write(`
    <html><head><title>${asset.code}</title>
    <style>
      body { font-family: sans-serif; text-align: center; padding: 24px; }
      h1 { font-size: 18px; margin: 8px 0 4px; }
      p { margin: 0; color: #444; font-size: 13px; }
      .code { font-family: monospace; font-size: 22px; font-weight: 700; margin-top: 12px; }
    </style></head>
    <body>
      <div>${svg}</div>
      <h1>${asset.name}</h1>
      <p>${categoryLabel(asset.category || asset.type)}</p>
      <div class="code">${asset.code}</div>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>
  `);
  win.document.close();
}

export function AtivosPanel() {
  const navigate = useNavigate();
  const {
    assets,
    locations,
    createAsset,
    updateAsset,
    deleteAsset,
    fetchAssetComponents,
    replaceAssetComponents,
    fetchAssetAttachments,
    addAssetAttachment,
    deleteAssetAttachment,
  } = useAppStore();

  const operationalAssets = useMemo(
    () => assets.filter(isOperationalAsset),
    [assets]
  );

  const [categories, setCategories] = useState(ASSET_CATEGORIES);
  const [form, setForm] = useState(emptyForm);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [attachments, setAttachments] = useState<AssetAttachment[]>([]);
  const [extraFields, setExtraFields] = useState<ExtraField[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; item?: Asset }>({
    open: false,
    mode: "create",
  });
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const suggestedCode = suggestedAssetCode(
    form.category,
    operationalAssets.map((a) => a.code)
  );

  const needsTechnical = TECHNICAL_CATEGORIES.has(form.category);
  const isKit = form.control_method === "kit";
  const isQuantity = form.control_method === "quantity";
  const completeness = kitCompleteness(components);
  const ageLabel = formatAge(form.acquired_at || null);
  const warranty = warrantyStatus(form.warranty_until || null);
  const replacementDate =
    form.acquired_at && form.useful_life_months
      ? addMonths(form.acquired_at, Number(form.useful_life_months))
      : null;

  const setField = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setForm({ ...emptyForm, code: suggestedAssetCode("freezer", operationalAssets.map((a) => a.code)) });
    setComponents([]);
    setAttachments([]);
    setExtraFields([]);
    setError("");
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = async (item: Asset) => {
    setForm({
      name: item.name,
      category: item.category || item.type || "other",
      control_method: item.control_method || "individual",
      code: item.code,
      acquired_at: item.acquired_at || "",
      location_id: item.location_id || "",
      status: item.status,
      photo_url: item.photo_url || "",
      description: item.description || "",
      brand: item.brand || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      sku_code: item.sku_code || "",
      quantity_on_hand: String(item.quantity_on_hand ?? 1),
      purchase_price: item.purchase_price != null ? String(item.purchase_price) : "",
      supplier: item.supplier || "",
      nf_number: item.nf_number || "",
      warranty_until: item.warranty_until || "",
      useful_life_months: item.useful_life_months != null ? String(item.useful_life_months) : "",
      voltage: item.voltage || "",
      power_watts: item.power_watts != null ? String(item.power_watts) : "",
      plug_type: item.plug_type || "",
      dimensions: item.dimensions || "",
      weight_kg: item.weight_kg != null ? String(item.weight_kg) : "",
      capacity: item.capacity || "",
      color: item.color || "",
      operating_temp: item.operating_temp || "",
      handling_notes: item.handling_notes || "",
      specs: item.specs || "",
      responsible_name: item.responsible_name || "",
      notes: item.notes || "",
      last_maintenance_at: item.last_maintenance_at || "",
      maintenance_notes: item.maintenance_notes || "",
    });
    setExtraFields(
      Object.entries(item.custom_fields || {}).map(([label, value], i) => ({
        key: String(i),
        label,
        value,
      }))
    );
    setError("");
    setDialog({ open: true, mode: "edit", item });
    const [comps, files] = await Promise.all([
      fetchAssetComponents(item.id),
      fetchAssetAttachments(item.id),
    ]);
    setComponents(
      comps.map((c) => ({
        key: c.id,
        name: c.name,
        quantity: c.quantity,
        control_method: c.control_method,
        component_code: c.component_code || "",
        replaceable: c.replaceable,
        notes: c.notes || "",
        photo_url: c.photo_url || "",
        is_present: c.is_present,
        condition: c.condition,
      }))
    );
    setAttachments(files);
  };

  const duplicateOf = (field: "code" | "serial_number" | "sku_code", value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return assets.some((a) => {
      if (dialog.item && a.id === dialog.item.id) return false;
      const current = (a[field] || "").toString().trim().toLowerCase();
      return current === normalized;
    });
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim() || !form.code.trim()) {
      setError("Nome e ID único são obrigatórios.");
      return;
    }
    if (duplicateOf("code", form.code)) {
      setError("Este ID de ativo já existe.");
      return;
    }
    if (form.serial_number && duplicateOf("serial_number", form.serial_number)) {
      setError("Este número de série já está cadastrado.");
      return;
    }
    if (isQuantity) {
      const sku = (form.sku_code || form.code).trim();
      if (duplicateOf("sku_code", sku)) {
        setError("Este SKU já está cadastrado.");
        return;
      }
    }
    if (isKit && components.some((c) => !c.name.trim())) {
      setError("Cada componente do kit precisa de um nome.");
      return;
    }

    let status = form.status;
    if (isKit && !completeness.complete && status === "available") {
      status = "incomplete";
    }

    const payload: Omit<Asset, "id" | "created_at" | "updated_at"> = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      type: categoryToAssetType(form.category),
      category: form.category,
      control_method: form.control_method,
      location_id: form.location_id || null,
      status,
      is_active: status !== "written_off" && status !== "lost",
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      serial_number: form.serial_number.trim() || null,
      sku_code: isQuantity ? (form.sku_code.trim() || form.code.trim().toUpperCase()) : (form.sku_code.trim() || null),
      quantity_on_hand: isQuantity ? Number(form.quantity_on_hand) || 0 : 1,
      acquired_at: form.acquired_at || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      supplier: form.supplier.trim() || null,
      nf_number: form.nf_number.trim() || null,
      warranty_until: form.warranty_until || null,
      useful_life_months: form.useful_life_months ? Number(form.useful_life_months) : null,
      voltage: needsTechnical ? form.voltage || null : null,
      power_watts: needsTechnical && form.power_watts ? Number(form.power_watts) : null,
      plug_type: needsTechnical ? form.plug_type.trim() || null : null,
      dimensions: form.dimensions.trim() || null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      capacity: form.capacity.trim() || null,
      color: form.color.trim() || null,
      operating_temp: needsTechnical ? form.operating_temp.trim() || null : null,
      handling_notes: form.handling_notes.trim() || null,
      specs: form.specs.trim() || null,
      custom_fields: Object.fromEntries(
        extraFields.filter((f) => f.label.trim()).map((f) => [f.label.trim(), f.value])
      ),
      responsible_name: form.responsible_name.trim() || null,
      notes: form.notes.trim() || null,
      photo_url: form.photo_url || null,
      last_moved_at: dialog.item?.last_moved_at || null,
      last_maintenance_at: form.last_maintenance_at || null,
      maintenance_notes: form.maintenance_notes.trim() || null,
    };

    setSaving(true);
    try {
      let saved: Asset;
      if (dialog.mode === "create") {
        saved = await createAsset(payload);
      } else if (dialog.item) {
        await updateAsset(dialog.item.id, payload);
        saved = { ...dialog.item, ...payload };
      } else {
        throw new Error("Ativo inválido");
      }

      if (isKit) {
        await replaceAssetComponents(
          saved.id,
          components.map((c) => ({
            name: c.name.trim(),
            quantity: c.quantity,
            control_method: c.control_method,
            component_code: c.component_code.trim() || null,
            replaceable: c.replaceable,
            notes: c.notes.trim() || null,
            photo_url: c.photo_url || null,
            is_present: c.is_present,
            condition: c.condition,
            sort_order: 0,
          }))
        );
      } else if (dialog.mode === "edit") {
        await replaceAssetComponents(saved.id, []);
      }

      setDialog({ open: false, mode: "create" });
      navigate(`/gestao/ativos/${saved.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      if (message.includes("idx_assets_serial") || message.toLowerCase().includes("serial")) {
        setError("Número de série duplicado.");
      } else if (message.includes("idx_assets_sku") || message.toLowerCase().includes("sku")) {
        setError("SKU duplicado.");
      } else if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        setError("ID, QR ou número de série já existe.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Ativos</CardTitle>
            <CardDescription className="text-xs">
              Ficha, QR e cadastro. Status e local do pátio ficam em{" "}
              <Link to="/gestao/ativos" className="underline underline-offset-2">
                Gestão · Ativos
              </Link>
              .
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link to="/gestao/ativos">Pátio</Link>
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo ativo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <DataTable
          data={operationalAssets}
          searchKey="name"
          searchPlaceholder="Buscar ativo..."
          emptyMessage="Nenhum ativo cadastrado."
          columns={[
            {
              key: "photo_url",
              header: "",
              width: "w-12",
              render: (item) =>
                item.photo_url ? (
                  <img src={item.photo_url} alt="" className="h-9 w-9 rounded-md object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <ImagePlus className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                ),
            },
            {
              key: "name",
              header: "Nome",
              render: (item) => (
                <button
                  type="button"
                  className="text-left font-medium hover:underline"
                  onClick={() => navigate(`/gestao/ativos/${item.id}`)}
                >
                  {item.name}
                </button>
              ),
            },
            {
              key: "category",
              header: "Categoria",
              width: "w-32",
              render: (item) => (
                <Badge variant="secondary" className="text-xs font-normal">
                  {categoryLabel(item.category || item.type)}
                </Badge>
              ),
            },
            {
              key: "code",
              header: "ID",
              width: "w-28",
              render: (item) => (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{item.code}</code>
              ),
            },
            {
              key: "control_method",
              header: "Controle",
              width: "w-28",
              render: (item) => (
                <span className="text-xs text-muted-foreground">{controlLabel(item.control_method)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "w-36",
              render: (item) => (
                <Badge variant={item.status === "available" ? "default" : "outline"} className="text-xs font-normal">
                  {statusLabel(item.status)}
                </Badge>
              ),
            },
            {
              key: "location_id",
              header: "Local",
              width: "w-32",
              render: (item) => (
                <span className="text-xs text-muted-foreground">
                  {locations.find((l) => l.id === item.location_id)?.name || "—"}
                </span>
              ),
            },
          ]}
          actions={(item) => (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Ficha" onClick={() => navigate(`/gestao/ativos/${item.id}`)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="QR Code" onClick={() => setQrAsset(item)}>
                <QrCode className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Excluir"
                onClick={() => {
                  if (confirm(`Excluir ${item.name}?`)) deleteAsset(item.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        />
      </CardContent>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg">
              {dialog.mode === "create" ? "Novo ativo" : "Editar ativo"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
            <div className="flex gap-3">
              <PhotoSlot
                url={form.photo_url}
                onPick={(file) => {
                  void (async () => {
                    try {
                      setField("photo_url", await uploadAssetFile(file));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Falha no upload");
                    }
                  })();
                }}
                onClear={() => setField("photo_url", "")}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-2">
                  <Label>Nome do item</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="Ex: Freezer horizontal 300L"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Essa foto aparece no pedido quando a equipe marca o equipamento.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <CreatableSelect
                  value={form.category}
                  onChange={(value) => {
                    setField("category", value);
                    if (dialog.mode === "create") {
                      setField("code", suggestedAssetCode(value, operationalAssets.map((a) => a.code)));
                    }
                  }}
                  options={categories}
                  onCreateOption={(value) => {
                    const option = { value, label: value };
                    setCategories((prev) => [...prev, option]);
                    setField("category", value);
                  }}
                  placeholder="Categoria..."
                  createPlaceholder="Nova categoria..."
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de controle</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.control_method}
                  onChange={(e) => setField("control_method", e.target.value)}
                >
                  {CONTROL_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {CONTROL_METHODS.find((m) => m.value === form.control_method)?.hint}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{isQuantity ? "SKU" : "ID único do ativo"}</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value.toUpperCase())}
                  placeholder={suggestedCode}
                  className={duplicateOf("code", form.code) ? "border-red-500" : ""}
                />
                {duplicateOf("code", form.code) && <p className="text-xs text-red-500">ID já existe</p>}
              </div>
              <div className="space-y-2">
                <Label>Data de aquisição</Label>
                <Input type="date" value={form.acquired_at} onChange={(e) => setField("acquired_at", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Local atual</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.location_id}
                  onChange={(e) => setField("location_id", e.target.value)}
                >
                  <option value="">Sem local</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  {OPERATIONAL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isQuantity && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                <div className="space-y-2">
                  <Label>Quantidade disponível</Label>
                  <Input type="number" min="0" value={form.quantity_on_hand} onChange={(e) => setField("quantity_on_hand", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>SKU (se diferente do ID)</Label>
                  <Input value={form.sku_code} onChange={(e) => setField("sku_code", e.target.value.toUpperCase())} placeholder={form.code} />
                </div>
              </div>
            )}

            <FormSection title="Identificação extra">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={form.brand} onChange={(e) => setField("brand", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input value={form.model} onChange={(e) => setField("model", e.target.value)} />
                </div>
                {!isQuantity && (
                  <div className="space-y-2">
                    <Label>Número de série</Label>
                    <Input
                      value={form.serial_number}
                      onChange={(e) => setField("serial_number", e.target.value)}
                      className={form.serial_number && duplicateOf("serial_number", form.serial_number) ? "border-red-500" : ""}
                    />
                    {form.serial_number && duplicateOf("serial_number", form.serial_number) && (
                      <p className="text-xs text-red-500">Série já cadastrada</p>
                    )}
                  </div>
                )}
                <div className="col-span-2 space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setField("description", e.target.value)} />
                </div>
              </div>
            </FormSection>

            {needsTechnical && (
              <FormSection title="Informações técnicas">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Voltagem</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={form.voltage}
                      onChange={(e) => setField("voltage", e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {VOLTAGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Potência (W)</Label>
                    <Input type="number" value={form.power_watts} onChange={(e) => setField("power_watts", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de plugue</Label>
                    <Input value={form.plug_type} onChange={(e) => setField("plug_type", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Capacidade</Label>
                    <Input value={form.capacity} onChange={(e) => setField("capacity", e.target.value)} placeholder="Ex: 300 L / 80 pops" />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura</Label>
                    <Input value={form.operating_temp} onChange={(e) => setField("operating_temp", e.target.value)} placeholder="Ex: -18 °C" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dimensões</Label>
                    <Input value={form.dimensions} onChange={(e) => setField("dimensions", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso (kg)</Label>
                    <Input type="number" value={form.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input value={form.color} onChange={(e) => setField("color", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Cuidados especiais</Label>
                    <Textarea value={form.handling_notes} onChange={(e) => setField("handling_notes", e.target.value)} />
                  </div>
                </div>
              </FormSection>
            )}

            {!needsTechnical && (
              <FormSection title="Medidas e cor">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Dimensões</Label>
                    <Input value={form.dimensions} onChange={(e) => setField("dimensions", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Peso (kg)</Label>
                    <Input type="number" value={form.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input value={form.color} onChange={(e) => setField("color", e.target.value)} />
                  </div>
                </div>
              </FormSection>
            )}

            {isKit && (
              <FormSection title="Componentes do kit" defaultOpen>
                <div className="flex items-center justify-between">
                  <Badge variant={completeness.complete ? "default" : "outline"}>{completeness.label}</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setComponents((prev) => [
                        ...prev,
                        {
                          key: crypto.randomUUID(),
                          name: "",
                          quantity: 1,
                          control_method: "quantity",
                          component_code: "",
                          replaceable: true,
                          notes: "",
                          photo_url: "",
                          is_present: true,
                          condition: "ok",
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Componente
                  </Button>
                </div>
                <div className="space-y-2">
                  {components.map((c) => (
                    <div key={c.key} className="rounded-md border p-2 space-y-2">
                      <div className="grid grid-cols-6 gap-2">
                        <Input
                          className="col-span-3 h-8"
                          placeholder="Nome"
                          value={c.name}
                          onChange={(e) =>
                            setComponents((prev) => prev.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))
                          }
                        />
                        <Input
                          className="h-8"
                          type="number"
                          min="1"
                          value={c.quantity}
                          onChange={(e) =>
                            setComponents((prev) =>
                              prev.map((x) => (x.key === c.key ? { ...x, quantity: Number(e.target.value) || 1 } : x))
                            )
                          }
                        />
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={c.control_method}
                          onChange={(e) =>
                            setComponents((prev) =>
                              prev.map((x) =>
                                x.key === c.key ? { ...x, control_method: e.target.value as "individual" | "quantity" } : x
                              )
                            )
                          }
                        >
                          <option value="quantity">Qtd</option>
                          <option value="individual">Individual</option>
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setComponents((prev) => prev.filter((x) => x.key !== c.key))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {c.control_method === "individual" && (
                          <Input
                            className="h-8"
                            placeholder="ID / QR"
                            value={c.component_code}
                            onChange={(e) =>
                              setComponents((prev) =>
                                prev.map((x) => (x.key === c.key ? { ...x, component_code: e.target.value.toUpperCase() } : x))
                              )
                            }
                          />
                        )}
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={c.condition}
                          onChange={(e) =>
                            setComponents((prev) =>
                              prev.map((x) =>
                                x.key === c.key
                                  ? {
                                      ...x,
                                      condition: e.target.value as AssetComponentCondition,
                                      is_present: e.target.value !== "missing",
                                    }
                                  : x
                              )
                            )
                          }
                        >
                          <option value="ok">Ok</option>
                          <option value="replaced">Substituído</option>
                          <option value="damaged">Danificado</option>
                          <option value="missing">Ausente</option>
                        </select>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={c.replaceable}
                            onChange={(e) =>
                              setComponents((prev) =>
                                prev.map((x) => (x.key === c.key ? { ...x, replaceable: e.target.checked } : x))
                              )
                            }
                          />
                          Substituível
                        </label>
                      </div>
                      <Input
                        className="h-8"
                        placeholder="Observações"
                        value={c.notes}
                        onChange={(e) =>
                          setComponents((prev) => prev.map((x) => (x.key === c.key ? { ...x, notes: e.target.value } : x)))
                        }
                      />
                    </div>
                  ))}
                  {components.length === 0 && (
                    <p className="text-xs text-muted-foreground">Adicione a lista condensada do kit, por exemplo: 1 base, 4 hastes, 1 lona, 1 bag.</p>
                  )}
                </div>
              </FormSection>
            )}

            <FormSection title="Aquisição e garantia">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input value={form.supplier} onChange={(e) => setField("supplier", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Nota fiscal</Label>
                  <Input value={form.nf_number} onChange={(e) => setField("nf_number", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Valor de compra (R$)</Label>
                  <Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setField("purchase_price", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim da garantia</Label>
                  <Input type="date" value={form.warranty_until} onChange={(e) => setField("warranty_until", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vida útil (meses)</Label>
                  <Input type="number" min="1" value={form.useful_life_months} onChange={(e) => setField("useful_life_months", e.target.value)} />
                </div>
                <div className="space-y-2 text-xs text-muted-foreground pt-6">
                  <div>Idade atual: <strong className="text-foreground">{ageLabel}</strong></div>
                  <div>Garantia: <strong className="text-foreground">{warranty.label}</strong></div>
                  <div>Substituição prevista: <strong className="text-foreground">{replacementDate || "—"}</strong></div>
                </div>
              </div>
            </FormSection>

            <FormSection title="Manutenção">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Última manutenção</Label>
                  <Input type="date" value={form.last_maintenance_at} onChange={(e) => setField("last_maintenance_at", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Notas de manutenção</Label>
                  <Textarea value={form.maintenance_notes} onChange={(e) => setField("maintenance_notes", e.target.value)} />
                </div>
              </div>
            </FormSection>

            <FormSection title="Fotos e documentos">
              <div className="space-y-2">
                <input
                  type="file"
                  className="text-sm"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !dialog.item) {
                      if (file && dialog.mode === "create") {
                        setError("Salve o ativo primeiro para anexar mais arquivos, ou use a foto principal.");
                      }
                      return;
                    }
                    try {
                      const url = await uploadAssetFile(file);
                      const saved = await addAssetAttachment({
                        asset_id: dialog.item.id,
                        file_name: file.name,
                        file_url: url,
                        file_type: file.type || null,
                        caption: "",
                        kind: file.type.startsWith("image/") ? "photo" : "document",
                      });
                      setAttachments((prev) => [saved, ...prev]);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Falha no upload");
                    }
                  }}
                />
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs">
                    <a href={file.file_url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                      {file.file_name}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async () => {
                        await deleteAssetAttachment(file.id);
                        setAttachments((prev) => prev.filter((f) => f.id !== file.id));
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Anexos extras ficam na ficha do ativo depois de salvar. Cada arquivo guarda data automaticamente.
                </p>
              </div>
            </FormSection>

            <FormSection title="Observações e campos extras">
              <div className="space-y-2">
                <Label>Instruções operacionais / transporte / montagem</Label>
                <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} className="min-h-[100px]" />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={form.responsible_name} onChange={(e) => setField("responsible_name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Campos extras desta categoria</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExtraFields((prev) => [...prev, { key: crypto.randomUUID(), label: "", value: "" }])
                    }
                  >
                    Campo
                  </Button>
                </div>
                {extraFields.map((field) => (
                  <div key={field.key} className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome do campo"
                      value={field.label}
                      onChange={(e) =>
                        setExtraFields((prev) => prev.map((f) => (f.key === field.key ? { ...f, label: e.target.value } : f)))
                      }
                    />
                    <Input
                      placeholder="Valor"
                      value={field.value}
                      onChange={(e) =>
                        setExtraFields((prev) => prev.map((f) => (f.key === field.key ? { ...f, value: e.target.value } : f)))
                      }
                    />
                  </div>
                ))}
              </div>
            </FormSection>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => setDialog({ open: false, mode: "create" })}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !form.name || !form.code}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrAsset} onOpenChange={(open) => !open && setQrAsset(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR · {qrAsset?.code}</DialogTitle>
          </DialogHeader>
          {qrAsset && (
            <div className="flex flex-col items-center py-4">
              <div id={`qr-print-${qrAsset.id}`} className="rounded-lg border bg-white p-3">
                <QRCodeSVG value={qrAsset.code} size={200} level="H" includeMargin />
              </div>
              <p className="mt-3 font-mono text-lg font-bold">{qrAsset.code}</p>
              <p className="text-sm text-muted-foreground">{qrAsset.name}</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => qrAsset && printQr(qrAsset)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Imprimir etiqueta
            </Button>
            <Button type="button" onClick={() => setQrAsset(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
