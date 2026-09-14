import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/stores";
import {
  countedQuantity,
  declaredQuantity,
  formatVariance,
  remainingQuantity,
  varianceQuantity,
} from "@/lib/receipt-progress";

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function varianceClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

export function PrepararPage() {
  const { receipts, receiptItems, stock, materialStock, products, inspections } = useAppStore();

  const queue = receipts
    .filter((receipt) => receipt.status !== "closed")
    .map((receipt) => {
      const items = receiptItems.filter((item) => item.receipt_id === receipt.id);
      const remaining = remainingQuantity(receipt.id, stock, materialStock);
      const declared = declaredQuantity(items);
      const counted = countedQuantity(receipt, items, inspections);
      const variance = varianceQuantity(counted, declared);
      return { receipt, items, remaining, declared, counted, variance };
    })
    .sort((a, b) => b.receipt.created_at.localeCompare(a.receipt.created_at));

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="py-6 md:py-8">
        <span className="text-sm font-semibold text-primary tracking-wider uppercase">
          PREPARAR
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">Notas em recebimento</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Conte, classifique e encaixote as notas da fábrica. Notas de fornecedor não passam por aqui.
        </p>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg text-foreground">Nada pendente</h3>
            <p className="text-sm mt-1">Notas da fábrica aguardam conferência aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map(({ receipt, items, remaining, declared, counted, variance }) => {
            const names = items
              .map((item) => products.find((p) => p.id === item.product_id)?.name || products.find((p) => p.id === item.product_id)?.flavor)
              .filter(Boolean)
              .slice(0, 3);
            const boxCount = new Set(
              items.flatMap((item) => item.source_box_codes || [])
            ).size;

            return (
              <Link
                key={receipt.id}
                to={`/operacoes/preparar/${receipt.id}`}
                className="group flex items-stretch gap-4 rounded-2xl border-2 bg-card p-5 shadow-sm hover:border-primary/30 hover:shadow-md active:scale-[0.99] transition-all"
              >
                <span className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-7 h-7" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <strong className="text-xl">NF {receipt.nf_number}</strong>
                    <Badge variant="secondary">{receipt.receipt_number}</Badge>
                  </span>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {receipt.supplier} · {formatDate(receipt.receipt_date)}
                    {names.length ? ` · ${names.join(", ")}` : ""}
                  </p>
                  <p className="text-sm mt-2 flex items-center gap-2 flex-wrap">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    Restam <strong>{remaining.toLocaleString("pt-BR")}</strong> de{" "}
                    {declared.toLocaleString("pt-BR")} · contado {counted.toLocaleString("pt-BR")}
                    {counted > 0 || remaining === 0 ? (
                      <span className={varianceClass(variance)}>
                        · {formatVariance(variance)}
                      </span>
                    ) : null}
                    {boxCount > 0 ? ` · ${boxCount} caixa(s) de entrada` : ""}
                  </p>
                </span>
                <span className="self-center text-primary text-sm font-medium flex items-center gap-1">
                  Continuar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
