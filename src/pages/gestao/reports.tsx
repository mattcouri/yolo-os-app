import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { streetAssets, type StreetAssetRow } from "@/lib/ativos-na-rua";
import { useAppStore } from "@/stores";

export function ReportsPage() {
  const { orders, orderItems, assets, uniforms, uniformCheckouts } = useAppStore();

  const rows = useMemo(
    () => streetAssets(orders, orderItems, assets, uniforms, uniformCheckouts),
    [orders, orderItems, assets, uniforms, uniformCheckouts]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">Onde está o que saiu da base e não tem volta prevista.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Ativos na rua
              </CardTitle>
              <CardDescription>
                Saiu e não volta: marcado sem volta no pedido, ou conferido no encerramento como não retornado.
              </CardDescription>
            </div>
            <Badge variant="secondary">{rows.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <DataTable
            data={rows}
            searchKey="search"
            searchPlaceholder="Buscar ativo, pedido, endereço…"
            emptyMessage="Nenhum ativo na rua. Itens com volta ficam no calendário de Separação até o retorno."
            maxHeight="calc(100vh - 280px)"
            columns={[
              {
                key: "name",
                header: "Ativo",
                sortable: true,
                render: (row: StreetAssetRow) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.code}</p>
                  </div>
                ),
              },
              {
                key: "kind",
                header: "Tipo",
                width: "w-28",
                render: (row: StreetAssetRow) => (
                  <Badge variant="outline" className="capitalize">
                    {row.kind}
                  </Badge>
                ),
              },
              {
                key: "where",
                header: "Onde",
                sortable: true,
                render: (row: StreetAssetRow) => (
                  <div className="min-w-0">
                    <p className="truncate leading-tight">{row.organization}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.recipient}
                      {row.address && row.address !== "—" ? ` · ${row.address}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "orderNumber",
                header: "Pedido",
                width: "w-28",
                sortable: true,
                render: (row: StreetAssetRow) =>
                  row.orderId ? (
                    <Link to={`/separacao/${row.orderId}`} className="text-primary hover:underline">
                      {row.orderNumber}
                    </Link>
                  ) : (
                    row.orderNumber
                  ),
              },
              { key: "qty", header: "Qtd", width: "w-14" },
              { key: "since", header: "Desde", width: "w-24", sortable: true },
              {
                key: "volta",
                header: "Volta",
                width: "w-28",
                render: (row: StreetAssetRow) => (
                  <Badge
                    variant="secondary"
                    className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  >
                    {row.volta}
                  </Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
