import { useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Shirt, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { UNIFORM_SIZES, uniformTotals } from "@/lib/uniforms";
import { useAppStore } from "@/stores";
import type { Uniform } from "@/types/database";

async function uploadPhoto(file: File) {
  if (!isSupabaseConfigured || !supabase) return URL.createObjectURL(file);
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `uniforms/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("asset-files").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("asset-files").getPublicUrl(path).data.publicUrl;
}

const emptyForm = {
  name: "",
  description: "",
  photo_url: "",
  photo_back_url: "",
  qty_p: "0",
  qty_m: "0",
  qty_g: "0",
  qty_gg: "0",
};

function PhotoSlot({
  label,
  url,
  onPick,
}: {
  label: string;
  url: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex flex-1 flex-col items-center gap-1"
    >
      {url ? (
        <img src={url} alt={label} className="h-24 w-full rounded-md border object-cover" />
      ) : (
        <div className="flex h-24 w-full flex-col items-center justify-center rounded-md border bg-muted">
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
        }}
      />
    </button>
  );
}

export function UniformesPanel() {
  const { uniforms, uniformCheckouts, createUniform, updateUniform, deleteUniform } = useAppStore();
  const [form, setForm] = useState(emptyForm);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; item?: Uniform }>({
    open: false,
    mode: "create",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (item: Uniform) => {
    setForm({
      name: item.name,
      description: item.description || "",
      photo_url: item.photo_url || "",
      photo_back_url: item.photo_back_url || "",
      qty_p: String(item.qty_p),
      qty_m: String(item.qty_m),
      qty_g: String(item.qty_g),
      qty_gg: String(item.qty_gg),
    });
    setError("");
    setDialog({ open: true, mode: "edit", item });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Informe o nome da camisa.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      photo_url: form.photo_url || null,
      photo_back_url: form.photo_back_url || null,
      qty_p: Number(form.qty_p) || 0,
      qty_m: Number(form.qty_m) || 0,
      qty_g: Number(form.qty_g) || 0,
      qty_gg: Number(form.qty_gg) || 0,
      is_active: true,
    };
    setSaving(true);
    try {
      if (dialog.mode === "create") await createUniform(payload);
      else if (dialog.item) await updateUniform(dialog.item.id, payload);
      setDialog({ open: false, mode: "create" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Uniformes</CardTitle>
              <CardDescription className="text-xs">
                Controle simples por tamanho. Camisas saem em pedidos de evento e voltam quando o evento fecha.
              </CardDescription>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={openCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo uniforme
            </Button>
          </div>
        </CardHeader>
      </Card>

      {uniforms.length === 0 ? (
        <div className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          <Shirt className="mx-auto mb-2 h-7 w-7 opacity-30" />
          Nenhum uniforme cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {uniforms.map((item) => {
            const sizes = uniformTotals(item, uniformCheckouts);
            const outTotal = sizes.reduce((sum, s) => sum + s.out, 0);
            return (
              <Card key={item.id} className="overflow-hidden">
                <div className="relative grid grid-cols-2 bg-muted">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={`${item.name} frente`} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center">
                      <Shirt className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  {item.photo_back_url ? (
                    <img src={item.photo_back_url} alt={`${item.name} costas`} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center border-l">
                      <Shirt className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  {outTotal > 0 && (
                    <Badge className="absolute right-1 top-1 h-4 px-1 text-[9px]" variant="secondary">
                      {outTotal} fora
                    </Badge>
                  )}
                </div>
                <CardContent className="space-y-1.5 p-2">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-xs font-medium leading-tight">{item.name}</h3>
                      {item.description && (
                        <p className="truncate text-[10px] text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir ${item.name}?`)) deleteUniform(item.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-0.5">
                    {sizes.map((s) => (
                      <div key={s.size} className="rounded border px-0.5 py-0.5 text-center">
                        <div className="text-[9px] font-semibold text-muted-foreground">{s.size}</div>
                        <div className="text-xs font-semibold leading-none">{s.available}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "create" ? "Novo uniforme" : "Editar uniforme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fotos</Label>
              <div className="flex gap-2">
                <PhotoSlot
                  label="Frente"
                  url={form.photo_url}
                  onPick={(file) => {
                    void (async () => {
                      try {
                        const url = await uploadPhoto(file);
                        setForm((p) => ({ ...p, photo_url: url }));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Falha no upload");
                      }
                    })();
                  }}
                />
                <PhotoSlot
                  label="Costas"
                  url={form.photo_back_url}
                  onPick={(file) => {
                    void (async () => {
                      try {
                        const url = await uploadPhoto(file);
                        setForm((p) => ({ ...p, photo_back_url: url }));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Falha no upload");
                      }
                    })();
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Camisa preta YOLO"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Uso em eventos, tecido, observações..."
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade por tamanho</Label>
              <div className="grid grid-cols-4 gap-2">
                {UNIFORM_SIZES.map((size) => {
                  const key = `qty_${size.toLowerCase()}` as "qty_p" | "qty_m" | "qty_g" | "qty_gg";
                  return (
                    <div key={size} className="space-y-1">
                      <div className="text-center text-xs font-medium text-muted-foreground">{size}</div>
                      <Input
                        type="number"
                        min="0"
                        className="h-9 text-center"
                        value={form[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog({ open: false, mode: "create" })}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
