import { Link } from "react-router-dom";
import {
  ArrowDown,
  CheckSquare,
  ArrowLeftRight,
  Grid3X3,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores";

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  number: string;
  badge?: string;
}

function ActionCard({
  title,
  description,
  icon,
  to,
  number,
  badge,
}: ActionCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-stretch p-6 rounded-2xl bg-card text-card-foreground border-2 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.98]"
    >
      <span className="flex items-center justify-between mb-6">
        <span className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </span>
        <span className="text-sm font-bold text-muted-foreground">{number}</span>
      </span>
      <div className="flex items-center gap-2 mb-2">
        <strong className="text-xl font-bold">{title}</strong>
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground flex-1">{description}</p>
      <span className="mt-6 flex items-center gap-2 text-primary text-sm font-medium">
        Abrir
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function OperacoesPage() {
  const { receipts } = useAppStore();

  const pendingPrepare = receipts.filter((receipt) => receipt.status !== "closed").length;

  const prepareBadge = pendingPrepare > 0 ? `${pendingPrepare}` : undefined;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          OPERAÇÕES
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          O que vamos fazer?
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Escolha uma ação operacional.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          title="Receber"
          description="Registrar NF da fábrica (vai a Preparar) ou de fornecedor (entra no estoque)."
          icon={<ArrowDown className="w-7 h-7" />}
          to="/operacoes/receber"
          number="01"
        />
        <ActionCard
          title="Preparar"
          description="Contar, classificar e encaixotar as notas em recebimento."
          icon={<CheckSquare className="w-7 h-7" />}
          to="/operacoes/preparar"
          number="02"
          badge={prepareBadge}
        />
        <ActionCard
          title="Movimentar"
          description="Mover caixas de 100, montar SKUs ou devolver pretas vazias."
          icon={<ArrowLeftRight className="w-7 h-7" />}
          to="/operacoes/movimentar"
          number="03"
        />
        <ActionCard
          title="Inventariar"
          description="Escanear o estoque físico e enviar diferenças para aprovação."
          icon={<Grid3X3 className="w-7 h-7" />}
          to="/operacoes/inventario"
          number="04"
        />
      </div>
    </div>
  );
}
