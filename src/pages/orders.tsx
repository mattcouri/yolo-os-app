import { Link } from "react-router-dom";
import { ClipboardList, Package, ArrowRight } from "lucide-react";

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

export function OrdersPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="py-8 md:py-14">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          PEDIDOS
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">O que você precisa?</h1>
        <p className="text-muted-foreground mt-1">
          Envie uma solicitação completa diretamente para a equipe de Operações.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModuleCard
          title="Novo pedido"
          description="Venda, evento, amostra, material, equipamento ou solicitação interna."
          icon={<Package className="w-6 h-6" />}
          to="/orders/new"
          status="Formulário único"
        />
        <ModuleCard
          title="Acompanhar pedidos"
          description="Veja o número, prazo e situação das solicitações enviadas."
          icon={<ClipboardList className="w-6 h-6" />}
          to="/orders/list"
          status="Ver todos"
        />
      </div>
    </div>
  );
}
