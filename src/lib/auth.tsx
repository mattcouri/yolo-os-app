import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AppRole, Profile } from "@/types/database";

interface AuthContextValue {
  loading: boolean;
  profile: Profile | null;
  role: AppRole;
  isAdmin: boolean;
  isSupervisor: boolean;
  isOperator: boolean;
  canAccessManagement: boolean;
  canManageUsers: boolean;
  canChangeRecords: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const demoProfile: Profile = {
  id: "demo",
  full_name: "Demonstração",
  email: "demo@yolo.local",
  role: "admin",
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const RECOVERY_FLAG = "yolo-password-recovery";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState<Profile | null>(isSupabaseConfigured ? null : demoProfile);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(RECOVERY_FLAG) === "1"
  );

  const clearPasswordRecovery = () => {
    sessionStorage.removeItem(RECOVERY_FLAG);
    setPasswordRecovery(false);
  };

  const refreshProfile = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(demoProfile);
      setLoading(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (data && data.active === false) {
      await supabase.auth.signOut();
      setProfile(null);
      setLoading(false);
      return;
    }
    setProfile(
      data
        ? { ...data, email: data.email || user.email || null }
        : {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "",
            email: user.email || null,
            role: "user",
            active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
    );
    setLoading(false);
  };

  useEffect(() => {
    void refreshProfile();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_FLAG, "1");
        setPasswordRecovery(true);
      }
      void refreshProfile();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const role: AppRole = profile?.role || "user";
  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profile,
      role,
      isAdmin: role === "admin",
      isSupervisor: role === "supervisor",
      isOperator: role === "user",
      canAccessManagement: role === "admin" || role === "supervisor",
      canManageUsers: role === "admin",
      canChangeRecords: role === "admin",
      passwordRecovery,
      clearPasswordRecovery,
      refreshProfile,
    }),
    [loading, profile, role, passwordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthProfile() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthProfile must be used within AuthProvider");
  return ctx;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  user: "Usuário",
};

export const ROLE_HINTS: Record<AppRole, string> = {
  admin: "Altera todos os registros, inclusive usuários.",
  supervisor: "Usa todas as funções operacionais e de gestão.",
  user: "Acessa só Operações e Pedidos, na interface simples.",
};
