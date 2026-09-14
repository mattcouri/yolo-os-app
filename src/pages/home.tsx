import { Link } from "react-router-dom";
import {
  Package,
  ClipboardList,
  DollarSign,
  Settings,
  ArrowRight,
  ArrowDown,
  CheckSquare,
  ArrowLeftRight,
  Grid3X3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  status: string;
}

function ModuleCard({ title, description, icon, to, status }: ModuleCardProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-stretch min-h-[210px] p-6 rounded-2xl bg-card text-card-foreground border shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
    >
      <span className="mb-6 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </span>
      <strong className="text-xl font-semibold">{title}</strong>
      <small className="text-sm text-muted-foreground mt-2">{description}</small>
      <span className="mt-auto pt-5 flex items-center justify-between text-primary text-sm">
        <span>{status}</span>
        <ArrowRight className="w-4 h-4" />
      </span>
    </Link>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  number: string;
}

function ActionCard({ title, description, icon, to, number }: ActionCardProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-stretch p-5 rounded-2xl bg-card text-card-foreground border shadow-sm hover:border-primary/50 hover:shadow-md transition-all"
    >
      <span className="flex items-center justify-between mb-4">
        <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{number}</span>
      </span>
      <strong className="font-semibold">{title}</strong>
      <span className="text-xs text-muted-foreground mt-1">{description}</span>
      <span className="mt-4 flex items-center gap-1 text-primary text-xs">
        Abrir <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}

export function HomePage() {
  const { stock, materialStock, separationJobs, products } = useAppStore();

  const pendingPops = stock.filter((s) => s.status === "analysis");
  const pendingMaterials = materialStock.filter((m) => m.status === "analysis");
  const activeSeparation = stock.filter(
    (s) => s.is_active_separation && s.quantity > 0
  );

  const workQueue = [
    ...pendingPops.map((s) => {
      const product = products.find((p) => p.id === s.product_id);
      return {
        id: s.id,
        name: product?.flavor || product?.name || "Produto",
        detail: `${s.quantity} un · ${s.lot || "Sem lote"}`,
        status: "Conferir",
        icon: <CheckSquare className="w-5 h-5" />,
        to: "/operacoes/preparar",
      };
    }),
    ...pendingMaterials.map((m) => {
      const product = products.find((p) => p.id === m.product_id);
      return {
        id: m.id,
        name: product?.name || "Material",
        detail: `${m.quantity} ${product?.unit || "un"} · ${m.lot || "Sem lote"}`,
        status: "Conferir",
        icon: <CheckSquare className="w-5 h-5" />,
        to: "/operacoes/preparar",
      };
    }),
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="py-8 md:py-14">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          OPERAÇÃO YOLO
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">
          O que vamos fazer agora?
        </h1>
        <p className="text-muted-foreground mt-1">
          Escolha uma ação ou continue uma tarefa abaixo.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <ActionCard
          title="Receber"
          description="Registrar produtos, nota fiscal e caixas de entrada."
          icon={<ArrowDown className="w-5 h-5" />}
          to="/operations/receiving"
          number="01"
        />
        <ActionCard
          title="Preparar"
          description="Conferir, classificar e encaixotar os produtos."
          icon={<CheckSquare className="w-5 h-5" />}
          to="/operacoes/preparar"
          number="02"
        />
        <ActionCard
          title="Movimentar"
          description="Transferir caixas e montar SKUs."
          icon={<ArrowLeftRight className="w-5 h-5" />}
          to="/operations/transfers"
          number="03"
        />
        <ActionCard
          title="Inventariar"
          description="Escanear o estoque físico e enviar diferenças."
          icon={<Grid3X3 className="w-5 h-5" />}
          to="/operations/inventory-count"
          number="04"
        />
      </div>

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Continuar de onde parou</CardTitle>
            <p className="text-sm text-muted-foreground">
              {workQueue.length
                ? `${workQueue.length} tarefa${workQueue.length === 1 ? "" : "s"} aguardando ação`
                : "Nenhuma pendência operacional"}
            </p>
          </div>
          {workQueue.length > 4 && (
            <Link
              to="/operacoes/preparar"
              className="text-sm text-primary hover:underline"
            >
              Ver todas
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {workQueue.length > 0 ? (
            <div className="space-y-2">
              {workQueue.slice(0, 4).map((task) => (
                <Link
                  key={task.id}
                  to={task.to}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors"
                >
                  <span className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {task.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <strong className="block truncate">{task.name}</strong>
                    <small className="text-muted-foreground">{task.detail}</small>
                  </span>
                  <Badge variant="outline">{task.status}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">Tudo em dia por aqui</h3>
              <p className="text-sm">
                Novos recebimentos aparecerão nesta fila.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          {activeSeparation.length} caixas de montagem
        </span>
        <span>Dados de demonstração · alterações apenas nesta sessão</span>
      </div>

      <h2 className="text-lg font-semibold mt-12 mb-4">Módulos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModuleCard
          title="Operações"
          description="Receber, preparar, movimentar e inventariar."
          icon={<Grid3X3 className="w-6 h-6" />}
          to="/operations/actions"
          status="4 ações"
        />
        <ModuleCard
          title="Pedidos"
          description="Solicitações de vendas, amostras e retiradas."
          icon={<Package className="w-6 h-6" />}
          to="/orders"
          status="Ver pedidos"
        />
        <ModuleCard
          title="Financeiro"
          description="Faturamento, recebimentos e pendências."
          icon={<DollarSign className="w-6 h-6" />}
          to="/financial"
          status="Em breve"
        />
        <ModuleCard
          title="Gestão"
          description="Estoque, documentos, cadastros e aprovações."
          icon={<Settings className="w-6 h-6" />}
          to="/inventory"
          status="Visão completa"
        />
      </div>
    </div>
  );
}
