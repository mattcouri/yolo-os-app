import { Link } from "react-router-dom";
import {
  Grid3X3,
  Package,
  DollarSign,
  BarChart3,
  ArrowRight,
} from "lucide-react";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  status: string;
  color: string;
}

function ModuleCard({
  title,
  description,
  icon,
  to,
  status,
  color,
}: ModuleCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-stretch min-h-[240px] p-8 rounded-3xl bg-card text-card-foreground border-2 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all active:scale-[0.98]"
    >
      <span
        className={`mb-8 w-16 h-16 rounded-2xl flex items-center justify-center ${color}`}
      >
        {icon}
      </span>
      <strong className="text-2xl font-bold">{title}</strong>
      <p className="text-base text-muted-foreground mt-2 flex-1">{description}</p>
      <span className="mt-6 flex items-center justify-between text-primary text-sm font-medium">
        <span>{status}</span>
        <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function PortalPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          YOLO OS
        </span>
        <h1 className="text-4xl md:text-5xl font-bold mt-3">
          Olá, Operador.
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Escolha onde você quer trabalhar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ModuleCard
          title="Operações"
          description="Receber, preparar, movimentar e inventariar. Ações do dia a dia operacional."
          icon={<Grid3X3 className="w-8 h-8" />}
          to="/operacoes"
          status="4 ações"
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        />
        <ModuleCard
          title="Pedidos"
          description="Solicitações de vendas, amostras, eventos e retiradas."
          icon={<Package className="w-8 h-8" />}
          to="/pedidos"
          status="Nova solicitação"
          color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <ModuleCard
          title="Financeiro"
          description="Faturamento, recebimentos e pendências de cobrança."
          icon={<DollarSign className="w-8 h-8" />}
          to="/financeiro"
          status="Em breve"
          color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        />
        <ModuleCard
          title="Gestão"
          description="Estoque, documentos, cadastros, relatórios e aprovações."
          icon={<BarChart3 className="w-8 h-8" />}
          to="/gestao"
          status="Dashboard"
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
      </div>

      <p className="text-center text-sm text-muted-foreground mt-12">
        YOLO · São Paulo · Protótipo de demonstração
      </p>
    </div>
  );
}
