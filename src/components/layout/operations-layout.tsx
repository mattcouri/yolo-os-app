import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { ROLE_LABELS, useAuthProfile } from "@/lib/auth";

interface OperationsLayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function OperationsLayout({
  children,
  showBack = false,
  backTo = "/",
  backLabel = "Voltar",
}: OperationsLayoutProps) {
  const { profile, role } = useAuthProfile();
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <Link
                to={backTo}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  Y
                </span>
                <span className="font-semibold hidden sm:inline">
                  YOLO OS
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleDarkMode}
              className="h-9 w-9"
            >
              {darkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            {userEmail && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {profile?.full_name?.split(" ")[0] || userEmail.split("@")[0]}
                  {" · "}
                  {ROLE_LABELS[role]}
                </span>
                {isSupabaseConfigured && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="h-9 w-9"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-8">{children}</main>

      <footer className="fixed bottom-0 left-0 right-0 bg-muted/50 backdrop-blur border-t py-2 px-4 text-center text-xs text-muted-foreground sm:hidden">
        YOLO OS · Operações
      </footer>
    </div>
  );
}
