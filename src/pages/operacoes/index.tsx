import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  CheckSquare,
  ArrowLeftRight,
  Grid3X3,
  ArrowRight,
  Droplets,
  Snowflake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CameraQrButton } from "@/components/camera-qr-button";
import { isAssemblyBox, physicalStateOf, stateLabel } from "@/lib/assembly";
import { ProductMark } from "@/components/product-mark";
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

function AssemblyBoxesPanel() {
  const { stock, products, assets, replaceEmptyAssemblyBox } = useAppStore();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const boxes = stock
    .filter((item) => isAssemblyBox(item))
    .sort((a, b) => {
      const left = products.find((product) => product.id === a.product_id);
      const right = products.find((product) => product.id === b.product_id);
      const leftName = `${left?.name || ""} ${left?.code || ""}`.trim();
      const rightName = `${right?.name || ""} ${right?.code || ""}`.trim();
      return leftName.localeCompare(rightName, "pt-BR");
    });

  return (
    <div className="w-full min-w-0 flex-1 rounded-2xl border bg-card p-4 text-left md:max-w-2xl">
      <p className="text-sm font-semibold">Caixas de Montagem</p>
      {boxes.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Nenhuma aberta.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {boxes.map((item) => {
            const product = products.find((row) => row.id === item.product_id);
            const asset = assets.find((row) => row.id === item.asset_id);
            const empty = item.quantity <= 0;
            const frozen = physicalStateOf(item) === "frozen";
            return (
              <li key={item.id} className="flex h-10 items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <ProductMark product={product} />
                </span>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-xs font-normal ${
                    frozen
                      ? "bg-sky-100 text-sky-700 hover:bg-sky-100"
                      : "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100"
                  }`}
                >
                  {frozen ? <Snowflake className="mr-1 h-3 w-3" /> : <Droplets className="mr-1 h-3 w-3" />}
                  {stateLabel(physicalStateOf(item))}
                </Badge>
                <code className="shrink-0 font-mono text-xs">{asset?.code || item.stock_number}</code>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {empty ? "vazia" : `${item.quantity} un`}
                </span>
                <span className="w-10 shrink-0">
                  <CameraQrButton
                    onResult={(code) => {
                      setError("");
                      setMessage("");
                      void replaceEmptyAssemblyBox(item.id, code)
                        .then(() => setMessage(`${code} é a caixa de montagem agora.`))
                        .catch((err) =>
                          setError(err instanceof Error ? err.message : "Não foi possível trocar a caixa.")
                        );
                    }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
    </div>
  );
}

export function OperacoesPage() {
  const { receipts } = useAppStore();

  const pendingPrepare = receipts.filter((receipt) => receipt.status !== "closed").length;

  const prepareBadge = pendingPrepare > 0 ? `${pendingPrepare}` : undefined;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center">
      <div className="flex flex-col gap-6 py-8 md:flex-row md:items-start md:justify-between md:py-12">
        <div className="text-center md:text-left">
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
        <AssemblyBoxesPanel />
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
