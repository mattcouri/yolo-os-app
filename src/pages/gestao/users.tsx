import { useEffect, useState } from "react";
import { KeyRound, Mail, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_HINTS, ROLE_LABELS, useAuthProfile } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppRole, Profile } from "@/types/database";

type ManagedUser = Profile & { last_sign_in_at?: string | null };

const emptyForm = {
  full_name: "",
  email: "",
  role: "user" as AppRole,
  password: "",
  active: true,
};

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function adminAction(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (data?.error) throw new Error(String(data.error));
  if (error) throw new Error(error.message);
  return data;
}

export function UsersPage() {
  const { profile: me, canManageUsers } = useAuthProfile();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; item?: ManagedUser }>({
    open: false,
    mode: "create",
  });
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminAction({ action: "list" });
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers && isSupabaseConfigured) void load();
    else setLoading(false);
  }, [canManageUsers]);

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Apenas administradores gerenciam contas e senhas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setDialog({ open: true, mode: "create" });
  };

  const openEdit = (item: ManagedUser) => {
    setForm({
      full_name: item.full_name,
      email: item.email || "",
      role: item.role,
      password: "",
      active: item.active,
    });
    setError("");
    setDialog({ open: true, mode: "edit", item });
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError("Informe o nome.");
      return;
    }
    if (dialog.mode === "create") {
      if (!form.email.trim()) {
        setError("Informe o e-mail.");
        return;
      }
      if (form.password.length < 8) {
        setError("A senha inicial precisa ter pelo menos 8 caracteres.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      if (dialog.mode === "create") {
        await adminAction({
          action: "create",
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          password: form.password,
        });
      } else if (dialog.item) {
        await adminAction({
          action: "update",
          id: dialog.item.id,
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          active: form.active,
        });
      }
      setDialog({ open: false, mode: "create" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">Usuários</CardTitle>
              <CardDescription className="text-xs">
                Contas, papéis, senhas e acesso ao YOLO OS.
              </CardDescription>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={openCreate} disabled={!isSupabaseConfigured}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
              <div key={role} className="rounded-md border bg-muted/40 px-3 py-2">
                <p className="text-xs font-medium">{ROLE_LABELS[role]}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{ROLE_HINTS[role]}</p>
              </div>
            ))}
          </div>
          {!isSupabaseConfigured ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Configure o Supabase para gerenciar contas reais.
            </p>
          ) : (
            <DataTable
              data={users.map((user) => ({
                ...user,
                search: `${user.full_name} ${user.email ?? ""}`,
              }))}
              searchKey="search"
              searchPlaceholder="Buscar por nome ou e-mail..."
              emptyMessage={loading ? "Carregando..." : "Nenhum usuário cadastrado."}
              columns={[
                {
                  key: "full_name",
                  header: "Nome",
                  render: (item) => <span className="font-medium">{item.full_name || "—"}</span>,
                },
                {
                  key: "email",
                  header: "E-mail",
                  render: (item) => <span className="text-xs">{item.email}</span>,
                },
                {
                  key: "role",
                  header: "Papel",
                  width: "w-36",
                  render: (item) => (
                    <Badge variant={item.role === "admin" ? "default" : "secondary"} className="text-xs font-normal">
                      {ROLE_LABELS[item.role]}
                    </Badge>
                  ),
                },
                {
                  key: "active",
                  header: "Status",
                  width: "w-28",
                  render: (item) => (
                    <Badge variant={item.active ? "outline" : "destructive"} className="text-xs font-normal">
                      {item.active ? "Ativo" : "Inativo"}
                    </Badge>
                  ),
                },
                {
                  key: "last_sign_in_at",
                  header: "Último acesso",
                  width: "w-36",
                  render: (item) => (
                    <span className="text-xs text-muted-foreground">
                      {item.last_sign_in_at
                        ? new Date(item.last_sign_in_at).toLocaleString("pt-BR")
                        : "Nunca"}
                    </span>
                  ),
                },
              ]}
              actions={(item) => (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={item.active ? "Desativar" : "Ativar"}
                    onClick={async () => {
                      try {
                        await adminAction({ action: "update", id: item.id, active: !item.active });
                        await load();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro");
                      }
                    }}
                  >
                    {item.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Redefinir senha"
                    onClick={() => {
                      setResetMessage("");
                      setResetUser(item);
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Excluir"
                    disabled={item.id === me?.id}
                    onClick={async () => {
                      if (!confirm(`Excluir ${item.full_name || item.email}?`)) return;
                      try {
                        await adminAction({ action: "delete", id: item.id });
                        await load();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : "Erro");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            />
          )}
          {error && !dialog.open && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "create" ? "Novo usuário" : "Editar usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {dialog.mode === "create" && (
              <div className="space-y-2">
                <Label>Senha inicial</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                  >
                    Gerar
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Papel</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
              >
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{ROLE_HINTS[form.role]}</p>
            </div>
            {dialog.mode === "edit" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Conta ativa
              </label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog({ open: false, mode: "create" })}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetUser}
        onOpenChange={(open) => {
          if (!open) {
            setResetUser(null);
            setResetMessage("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Enviar link de senha
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {resetUser?.full_name || resetUser?.email} vai receber um e-mail em{" "}
            <span className="font-medium text-foreground">{resetUser?.email}</span> com um link para
            criar a nova senha.
          </p>
          {resetMessage && <p className="text-sm text-emerald-600">{resetMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetUser(null)}>
              {resetMessage ? "Fechar" : "Cancelar"}
            </Button>
            {!resetMessage && (
              <Button
                type="button"
                disabled={resetSending || !resetUser?.email}
                onClick={async () => {
                  if (!resetUser?.email) return;
                  setResetSending(true);
                  try {
                    await adminAction({
                      action: "reset_password",
                      id: resetUser.id,
                      redirectTo: `${window.location.origin}/redefinir-senha`,
                    });
                    setResetMessage(`E-mail enviado para ${resetUser.email}.`);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Erro");
                  } finally {
                    setResetSending(false);
                  }
                }}
              >
                {resetSending ? "Enviando…" : "Enviar e-mail"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
