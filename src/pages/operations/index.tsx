import { Link } from "react-router-dom";
import {
  ArrowDown,
  CheckSquare,
  ArrowLeftRight,
  Grid3X3,
  ArrowRight,
  Package,
  Calendar,
  DollarSign,
  Settings,
} from "lucide-react";

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

export function OperationsPortal() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="py-8 md:py-14">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          YOLO OS
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">Olá, Operador.</h1>
        <p className="text-muted-foreground mt-1">
          Escolha onde você quer trabalhar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

export function OperationsActions() {
  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/operations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mt-6"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Todos os módulos
      </Link>

      <div className="py-6">
        <span className="text-xs font-semibold text-primary tracking-wider uppercase">
          OPERAÇÕES
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-2">O que vamos fazer?</h1>
        <p className="text-muted-foreground mt-1">
          Escolha uma ação operacional.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          description="Escanear o estoque físico e enviar diferenças para aprovação."
          icon={<Grid3X3 className="w-5 h-5" />}
          to="/operations/inventory-count"
          number="04"
        />
      </div>

      <Link
        to="/separation"
        className="mt-6 w-full grid grid-cols-[52px_1fr_auto] gap-4 items-center p-5 text-left bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-colors"
      >
        <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
          <Package className="w-6 h-6" />
        </span>
        <span className="flex flex-col gap-1">
          <strong className="text-lg">Separação de pedidos</strong>
          <small className="text-sm opacity-80">
            Painel da TV · entregas, motoristas, retiradas e retornos
          </small>
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span>0 abertos</span>
          <ArrowRight className="w-4 h-4" />
        </span>
      </Link>
    </div>
  );
}
