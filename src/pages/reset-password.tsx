import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { passwordRecovery, clearPasswordRecovery } = useAuthProfile();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const finish = async () => {
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(data.session));
      setChecking(false);
    };

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    const timeout = window.setTimeout(() => {
      void finish();
    }, 600);

    void finish();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError("Não foi possível salvar a nova senha. Peça um novo link.");
      return;
    }

    clearPasswordRecovery();
    navigate("/", { replace: true });
  }

  const canReset = hasSession || passwordRecovery;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            Y
          </div>
          <CardTitle className="text-2xl">Nova senha</CardTitle>
          <CardDescription>Defina a senha que você vai usar no YOLO OS.</CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-center text-sm text-muted-foreground">Validando o link…</p>
          ) : !canReset ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Este link é inválido ou já expirou. Peça um novo e-mail de redefinição ao administrador.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando…" : "Salvar senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
