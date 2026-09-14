import { useState, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { AuthProvider, useAuthProfile } from "@/lib/auth";
import { OperationsLayout } from "@/components/layout/operations-layout";
import { ManagementLayout } from "@/components/layout/management-layout";
import { LoginPage } from "@/pages/login";
import { ResetPasswordPage } from "@/pages/reset-password";
import { PortalPage } from "@/pages/portal";
import { OperacoesPage } from "@/pages/operacoes";
import { PrepararPage } from "@/pages/operacoes/preparar";
import { MovimentarPage } from "@/pages/operacoes/movimentar";
import { PedidosPage } from "@/pages/pedidos";
import { FinanceiroPage } from "@/pages/financeiro";
import { GestaoDashboardPage } from "@/pages/gestao";
import { ReceivingPage } from "@/pages/operations/receiving";
import { PrepareReceiptPage } from "@/pages/operations/prepare-receipt";
import { ReceiptsPage } from "@/pages/gestao/receipts";
import { PackagingPage } from "@/pages/gestao/packaging";
import { BatchTransferPage } from "@/pages/operations/transfers";
import { SendFactoryPage } from "@/pages/operations/send-factory";
import { AssemblePage } from "@/pages/operations/assemble";
import { InventoryCountPage } from "@/pages/operations/inventory-count";
import { OrderRequestPage, OrderListPage } from "@/pages/orders/request";
import { SeparationBoardPage, SeparationJobPage } from "@/pages/separation";
import { InventoryPage } from "@/pages/inventory";
import { SettingsPage } from "@/pages/settings";
import { AssetDetailPage } from "@/pages/assets/detail";
import { UsersPage } from "@/pages/gestao/users";
import { useAppStore } from "@/stores";

type AuthState = "checking" | "signed-out" | "signed-in" | "demo";

function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(
    isSupabaseConfigured ? "checking" : "demo"
  );

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setAuthState(data.session ? "signed-in" : "signed-out");
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? "signed-in" : "signed-out");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return authState;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const authState = useAuth();

  if (authState === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Conectando ao YOLO OS…</span>
        </div>
      </div>
    );
  }

  if (authState === "signed-out") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RecoveryRedirect() {
  const { passwordRecovery } = useAuthProfile();
  if (passwordRecovery && window.location.pathname !== "/redefinir-senha") {
    return <Navigate to="/redefinir-senha" replace />;
  }
  return null;
}

function RoleGate({
  children,
  staff = false,
  admin = false,
}: {
  children: ReactNode;
  staff?: boolean;
  admin?: boolean;
}) {
  const { loading, canAccessManagement, canManageUsers } = useAuthProfile();
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Verificando acesso…
      </div>
    );
  }
  if (admin && !canManageUsers) return <Navigate to="/" replace />;
  if (staff && !canAccessManagement) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OperationsRoute({
  children,
  showBack = false,
  backTo = "/",
  backLabel = "Voltar",
  staff = false,
}: {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
  staff?: boolean;
}) {
  return (
    <AuthGate>
      <RoleGate staff={staff}>
        <OperationsLayout showBack={showBack} backTo={backTo} backLabel={backLabel}>
          {children}
        </OperationsLayout>
      </RoleGate>
    </AuthGate>
  );
}

function ManagementRoute({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  return (
    <AuthGate>
      <RoleGate staff admin={admin}>
        <ManagementLayout>{children}</ManagementLayout>
      </RoleGate>
    </AuthGate>
  );
}

export default function App() {
  const fetchAll = useAppStore((state) => state.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <RecoveryRedirect />
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

        {/* Main Portal - No sidebar, touch-first */}
        <Route
          path="/"
          element={
            <OperationsRoute>
              <PortalPage />
            </OperationsRoute>
          }
        />

        {/* Operações flow */}
        <Route
          path="/operacoes"
          element={
            <OperationsRoute showBack backTo="/" backLabel="Portal">
              <OperacoesPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/receber"
          element={
            <OperationsRoute showBack backTo="/operacoes" backLabel="Operações">
              <ReceivingPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/preparar"
          element={
            <OperationsRoute showBack backTo="/operacoes" backLabel="Operações">
              <PrepararPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/preparar/:receiptId"
          element={
            <OperationsRoute showBack backTo="/operacoes/preparar" backLabel="Preparar">
              <PrepareReceiptPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/movimentar"
          element={
            <OperationsRoute showBack backTo="/operacoes" backLabel="Operações">
              <MovimentarPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/movimentar/transferir"
          element={
            <OperationsRoute showBack backTo="/operacoes/movimentar" backLabel="Movimentar">
              <BatchTransferPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/movimentar/montar"
          element={
            <OperationsRoute showBack backTo="/operacoes/movimentar" backLabel="Movimentar">
              <AssemblePage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/movimentar/separar"
          element={<Navigate to="/operacoes/movimentar/montar" replace />}
        />
        <Route
          path="/operacoes/movimentar/fabrica"
          element={
            <OperationsRoute showBack backTo="/operacoes/movimentar" backLabel="Movimentar">
              <SendFactoryPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/inventario"
          element={
            <OperationsRoute showBack backTo="/operacoes" backLabel="Operações">
              <InventoryCountPage />
            </OperationsRoute>
          }
        />

        {/* Pedidos flow */}
        <Route
          path="/pedidos"
          element={
            <OperationsRoute showBack backTo="/" backLabel="Portal">
              <PedidosPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/pedidos/novo"
          element={
            <OperationsRoute showBack backTo="/pedidos" backLabel="Pedidos">
              <OrderRequestPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/pedidos/lista"
          element={
            <OperationsRoute showBack backTo="/pedidos" backLabel="Pedidos">
              <OrderListPage />
            </OperationsRoute>
          }
        />

        {/* Financeiro flow */}
        <Route
          path="/financeiro"
          element={
            <OperationsRoute showBack backTo="/" backLabel="Portal" staff>
              <FinanceiroPage />
            </OperationsRoute>
          }
        />

        {/* Separation Board */}
        <Route
          path="/separacao"
          element={
            <OperationsRoute showBack backTo="/operacoes" backLabel="Operações">
              <SeparationBoardPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/separacao/:orderId"
          element={
            <OperationsRoute showBack backTo="/separacao" backLabel="Separação">
              <SeparationJobPage />
            </OperationsRoute>
          }
        />

        {/* Gestão - Management views with sidebar */}
        <Route
          path="/gestao"
          element={
            <ManagementRoute>
              <GestaoDashboardPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/inventory"
          element={
            <ManagementRoute>
              <InventoryPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/settings"
          element={
            <ManagementRoute>
              <SettingsPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/ativos/:id"
          element={
            <ManagementRoute>
              <AssetDetailPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/receipts"
          element={
            <ManagementRoute>
              <ReceiptsPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/packaging"
          element={
            <ManagementRoute>
              <PackagingPage />
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/movements"
          element={
            <ManagementRoute>
              <div className="text-muted-foreground">Movimentações (em breve)</div>
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/reports"
          element={
            <ManagementRoute>
              <div className="text-muted-foreground">Relatórios (em breve)</div>
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/users"
          element={
            <ManagementRoute admin>
              <UsersPage />
            </ManagementRoute>
          }
        />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
