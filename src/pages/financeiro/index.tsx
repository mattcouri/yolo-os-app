import { DollarSign, FileText, Receipt, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface SubActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  disabled?: boolean;
}

function SubActionCard({
  title,
  description,
  icon,
  to,
  disabled,
}: SubActionCardProps) {
  if (disabled) {
    return (
      <div className="flex flex-col items-stretch min-h-[200px] p-6 rounded-2xl bg-muted/50 text-muted-foreground border-2 border-dashed">
        <span className="flex items-center justify-between mb-6">
          <span className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
            {icon}
          </span>
        </span>
        <strong className="text-xl font-bold">{title}</strong>
        <p className="text-sm flex-1 mt-2">{description}</p>
        <span className="mt-4 text-sm">Em desenvolvimento</span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group flex flex-col items-stretch min-h-[200px] p-6 rounded-2xl bg-card text-card-foreground border-2 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.98]"
    >
      <span className="flex items-center justify-between mb-6">
        <span className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
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

export function FinanceiroPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          FINANCEIRO
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          Controle financeiro
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Faturamento, cobranças e conferência de recebimentos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SubActionCard
          title="Faturamento"
          description="Emitir notas de venda e controlar pedidos faturados."
          icon={<FileText className="w-7 h-7" />}
          to="/financeiro/faturamento"
          disabled
        />
        <SubActionCard
          title="Cobranças"
          description="Ver títulos a receber, vencimentos e baixar pagamentos."
          icon={<Receipt className="w-7 h-7" />}
          to="/financeiro/cobrancas"
          disabled
        />
        <SubActionCard
          title="Conferência"
          description="Conciliar vendas, recebimentos e saldos de clientes."
          icon={<DollarSign className="w-7 h-7" />}
          to="/financeiro/conferencia"
          disabled
        />
      </div>

      <p className="text-center text-sm text-muted-foreground mt-12">
        Este módulo está em desenvolvimento.
      </p>
    </div>
  );
}
