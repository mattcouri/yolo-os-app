import { Link } from "react-router-dom";
import { FilePlus, List, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";

interface SubActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  badge?: string;
}

function SubActionCard({
  title,
  description,
  icon,
  to,
  badge,
}: SubActionCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-stretch min-h-[200px] p-6 rounded-2xl bg-card text-card-foreground border-2 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.98]"
    >
      <span className="flex items-center justify-between mb-6">
        <span className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </span>
      <strong className="text-xl font-bold">{title}</strong>
      <p className="text-sm text-muted-foreground flex-1 mt-2">{description}</p>
      <span className="mt-4 flex items-center gap-2 text-primary text-sm font-medium">
        Abrir
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function PedidosPage() {
  const { orders } = useAppStore();
  const activeOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  );

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          PEDIDOS
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          Solicitações de saída
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Criar e acompanhar pedidos de vendas, amostras e eventos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SubActionCard
          title="Novo pedido"
          description="Abrir uma nova solicitação de venda, amostra, evento ou retirada."
          icon={<FilePlus className="w-7 h-7" />}
          to="/pedidos/novo"
        />
        <SubActionCard
          title="Acompanhar"
          description="Ver todos os pedidos abertos, em separação e históricos."
          icon={<List className="w-7 h-7" />}
          to="/pedidos/lista"
          badge={
            activeOrders.length > 0 ? `${activeOrders.length} abertos` : undefined
          }
        />
      </div>
    </div>
  );
}
