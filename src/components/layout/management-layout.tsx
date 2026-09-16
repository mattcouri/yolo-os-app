import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Package,
  FileText,
  Box,
  Settings,
  History,
  LayoutDashboard,
  BarChart3,
  Users,
  Grid3X3,
  Wrench,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { ROLE_LABELS, useAuthProfile } from "@/lib/auth";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/gestao" },
  { icon: Package, label: "Inventário", path: "/gestao/inventory" },
  { icon: FileText, label: "Notas Fiscais", path: "/gestao/receipts" },
  { icon: Box, label: "Embalagens", path: "/gestao/packaging" },
  { icon: Wrench, label: "Ativos", path: "/gestao/ativos" },
  { icon: Settings, label: "Cadastros", path: "/gestao/settings" },
  { icon: History, label: "Movimentações", path: "/gestao/movements" },
  { icon: BarChart3, label: "Relatórios", path: "/gestao/reports" },
  { icon: Users, label: "Usuários", path: "/gestao/users" },
];

interface ManagementLayoutProps {
  children: React.ReactNode;
}

export function ManagementLayout({ children }: ManagementLayoutProps) {
  const location = useLocation();
  const { profile, canManageUsers, role } = useAuthProfile();
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
      });
    }
  }, []);

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
  };

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const userEmail =
    profile?.email ||
    session?.user?.email ||
    (isSupabaseConfigured ? undefined : "demo@yolo.local");

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          "flex flex-col border-r bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                Y
              </span>
              <span className="font-semibold">YOLO OS</span>
            </Link>
          )}
          {collapsed && (
            <Link to="/" className="mx-auto">
              <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                Y
              </span>
            </Link>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Grid3X3 className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Operações</span>}
          </Link>

          <div className="pt-4 pb-2">
            {!collapsed && (
              <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Gestão
              </span>
            )}
          </div>

          {navItems
            .filter((item) => item.path !== "/gestao/users" || canManageUsers)
            .map((item) => {
            const isActive =
              item.path === "/gestao"
                ? location.pathname === "/gestao"
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleToggleDarkMode}
          >
            {darkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            {!collapsed && <span className="ml-3">Tema</span>}
          </Button>

          {userEmail && (
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50",
                collapsed && "justify-center"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                {userEmail[0].toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile?.full_name || userEmail.split("@")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {ROLE_LABELS[role]}
                  </p>
                </div>
              )}
              {!collapsed && isSupabaseConfigured && (
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="ml-3">Recolher</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
