import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageTag, stageTagFromStatus } from "@/components/separacao/stage-tag";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Box,
  CheckCircle,
} from "lucide-react";
import { useAppStore } from "@/stores";

export function GestaoDashboardPage() {
  const { stock, materialStock, orders, separationJobs, assets } = useAppStore();

  const totalUnits = stock.reduce((sum, s) => sum + s.quantity, 0);
  const boxesInUse = assets.filter(
    (a) => a.type === "caixa_media" && a.status === "in_use"
  ).length;
  const pendingInspection =
    stock.filter((s) => s.status === "analysis").length +
    materialStock.filter((m) => m.status === "analysis").length;
  const openOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  ).length;
  const activeSeparations = separationJobs.filter((j) => j.stage !== "retorno").length;

  const aaaUnits = stock
    .filter((s) => s.grade === "AAA")
    .reduce((sum, s) => sum + s.quantity, 0);
  const bUnits = stock
    .filter((s) => s.grade === "B")
    .reduce((sum, s) => sum + s.quantity, 0);
  const cUnits = stock
    .filter((s) => s.grade === "C")
    .reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do estoque e operações.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total em estoque</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUnits.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">
              unidades de pop disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Caixas em uso</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boxesInUse}</div>
            <p className="text-xs text-muted-foreground">caixas médias ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pedidos abertos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openOrders}</div>
            <p className="text-xs text-muted-foreground">
              {activeSeparations} em separação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Aguardando conferência
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInspection}</div>
            <p className="text-xs text-muted-foreground">
              produtos para classificar
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estoque por classificação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="default" className="w-12 justify-center">
                    AAA
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Premium · loja
                  </span>
                </div>
                <span className="font-semibold">
                  {aaaUnits.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="w-12 justify-center">
                    B
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Segunda linha · ecommerce
                  </span>
                </div>
                <span className="font-semibold">
                  {bUnits.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-12 justify-center">
                    C
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Lote fechado · atacado
                  </span>
                </div>
                <span className="font-semibold">
                  {cUnits.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Separação hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {separationJobs.length === 0 ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="w-5 h-5" />
                <span>Nenhuma separação pendente.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {separationJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {orders.find((order) => order.id === job.order_id)?.order_number || "—"}
                    </span>
                    <StageTag {...stageTagFromStatus(job.stage)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
