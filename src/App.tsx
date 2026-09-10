import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { OperationsLayout } from "@/components/layout/operations-layout";
import { ManagementLayout } from "@/components/layout/management-layout";
import { LoginPage } from "@/pages/login";
import { PortalPage } from "@/pages/portal";
import { OperacoesPage } from "@/pages/operacoes";
import { PrepararPage } from "@/pages/operacoes/preparar";
import { MovimentarPage } from "@/pages/operacoes/movimentar";
import { PedidosPage } from "@/pages/pedidos";
import { FinanceiroPage } from "@/pages/financeiro";
import { GestaoDashboardPage } from "@/pages/gestao";
import { ReceivingPage } from "@/pages/operations/receiving";
import { InspectionPage } from "@/pages/operations/inspection";
import { PackingPage } from "@/pages/operations/packing";
import { BatchTransferPage } from "@/pages/operations/transfers";
import { PickingPage } from "@/pages/operations/picking";
import { InventoryCountPage } from "@/pages/operations/inventory-count";
import { OrderRequestPage, OrderListPage } from "@/pages/orders/request";
import { SeparationBoardPage, SeparationJobPage } from "@/pages/separation";
import { InventoryPage } from "@/pages/inventory";
import { SettingsPage } from "@/pages/settings";
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

function OperationsRoute({
  children,
  showBack = false,
  backTo = "/",
  backLabel = "Voltar",
}: {
  children: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <AuthGate>
      <OperationsLayout showBack={showBack} backTo={backTo} backLabel={backLabel}>
        {children}
      </OperationsLayout>
    </AuthGate>
  );
}

function ManagementRoute({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ManagementLayout>{children}</ManagementLayout>
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
      <Routes>
        <Route path="/login" element={<LoginPage />} />

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
          path="/operacoes/preparar/inspecao"
          element={
            <OperationsRoute showBack backTo="/operacoes/preparar" backLabel="Preparar">
              <InspectionPage />
            </OperationsRoute>
          }
        />
        <Route
          path="/operacoes/preparar/encaixotar"
          element={
            <OperationsRoute showBack backTo="/operacoes/preparar" backLabel="Preparar">
              <PackingPage />
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
          path="/operacoes/movimentar/separar"
          element={
            <OperationsRoute showBack backTo="/operacoes/movimentar" backLabel="Movimentar">
              <PickingPage />
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
            <OperationsRoute showBack backTo="/" backLabel="Portal">
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
          path="/gestao/receipts"
          element={
            <ManagementRoute>
              <div className="text-muted-foreground">Notas Fiscais (em breve)</div>
            </ManagementRoute>
          }
        />
        <Route
          path="/gestao/packaging"
          element={
            <ManagementRoute>
              <div className="text-muted-foreground">Embalagens (em breve)</div>
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
            <ManagementRoute>
              <div className="text-muted-foreground">Usuários (em breve)</div>
            </ManagementRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
