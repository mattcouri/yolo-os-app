import { Link } from "react-router-dom";
import { Boxes, Layers, ArrowRight, Factory } from "lucide-react";

interface SubActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}

function SubActionCard({ title, description, icon, to }: SubActionCardProps) {
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
        Iniciar
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function MovimentarPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="py-8 md:py-12 text-center md:text-left">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          MOVIMENTAR
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          Depois do Preparar
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          O produto já está no estoque. Daqui o operador move caixas de 100, monta SKUs na mesa ou devolve pretas vazias.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SubActionCard
          title="Transferir caixas"
          description="Levar caixas de 100 e escolher a caixa de montagem no packing."
          icon={<Boxes className="w-7 h-7" />}
          to="/operacoes/movimentar/transferir"
        />
        <SubActionCard
          title="Montar SKUs"
          description="Montar cartuchos, caixas e pallets a partir da caixa de montagem."
          icon={<Layers className="w-7 h-7" />}
          to="/operacoes/movimentar/montar"
        />
        <SubActionCard
          title="Enviar à fábrica"
          description="Pretas e grandes já vazias e limpas voltam para reabastecer. O produto entra de novo só no Receber."
          icon={<Factory className="w-7 h-7" />}
          to="/operacoes/movimentar/fabrica"
        />
      </div>
    </div>
  );
}
