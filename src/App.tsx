import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, LogOut, Wifi, WifiOff } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type AuthState = "checking" | "signed-out" | "signed-in" | "demo";

function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) setError("Não foi possível entrar. Confira o e-mail e a senha.");
    else onSignedIn();
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">Y</div>
        <div>
          <p className="eyebrow">YOLO OS</p>
          <h1>Entrar</h1>
          <p>Use seu acesso interno para abrir a operação.</p>
        </div>
        <label>
          E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button disabled={busy} type="submit">{busy ? "Entrando…" : "Entrar"}</button>
        <small>Contas são criadas e administradas pelo Supabase Auth.</small>
      </form>
    </main>
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(isSupabaseConfigured ? "checking" : "demo");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthState(data.session ? "signed-in" : "signed-out");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthState(nextSession ? "signed-in" : "signed-out");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (authState === "checking") {
    return <main className="loading-page"><span className="spinner" />Conectando ao YOLO OS…</main>;
  }
  if (authState === "signed-out") {
    return <Login onSignedIn={() => setAuthState("signed-in")} />;
  }

  return (
    <div className="app-shell">
      <header className="deployment-bar">
        <span className="deployment-brand">YOLO OS</span>
        <span className={`connection-state ${authState === "demo" ? "demo" : "connected"}`}>
          {authState === "demo" ? <WifiOff size={14} /> : <Wifi size={14} />}
          {authState === "demo" ? "Modo protótipo · Supabase não configurado" : "Supabase conectado"}
        </span>
        <span className="deployment-user">
          <LockKeyhole size={14} /> {session?.user.email ?? "Acesso local"}
        </span>
        {session && (
          <button className="sign-out" onClick={() => supabase?.auth.signOut()} title="Sair">
            <LogOut size={16} /> Sair
          </button>
        )}
      </header>
      <iframe title="YOLO OS — protótipo operacional" src="/prototype/index.html" />
    </div>
  );
}
