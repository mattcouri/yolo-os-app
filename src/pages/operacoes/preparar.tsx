import { Link } from "react-router-dom";
import { ClipboardCheck, Box, ArrowRight } from "lucide-react";
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
        {badge && <Badge>{badge}</Badge>}
      </span>
      <strong className="text-xl font-bold">{title}</strong>
      <p className="text-sm text-muted-foreground flex-1 mt-2">{description}</p>
      <span className="mt-4 flex items-center gap-2 text-primary text-sm font-medium">
        Iniciar
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function PrepararPage() {
  const { stock, materialStock } = useAppStore();

  const pendingInspection =
    stock.filter((s) => s.status === "analysis").length +
    materialStock.filter((m) => m.status === "analysis").length;

  const awaitingPacking = stock.filter(
    (s) => s.status === "awaiting_packing"
  ).length;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          PREPARAR
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          Preparo de produtos
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Conferência, classificação e encaixotamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SubActionCard
          title="Conferir / Classificar"
          description="Contar, verificar qualidade e definir classe (AAA, B, C) dos produtos recebidos."
          icon={<ClipboardCheck className="w-7 h-7" />}
          to="/operacoes/preparar/inspecao"
          badge={pendingInspection > 0 ? `${pendingInspection} itens` : undefined}
        />
        <SubActionCard
          title="Encaixotar"
          description="Vincular produtos classificados a caixas físicas, definindo destino e lote."
          icon={<Box className="w-7 h-7" />}
          to="/operacoes/preparar/encaixotar"
          badge={awaitingPacking > 0 ? `${awaitingPacking}` : undefined}
        />
      </div>
    </div>
  );
}
