import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Pencil, Printer, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addMonths,
  categoryLabel,
  controlLabel,
  formatAge,
  kitCompleteness,
  statusLabel,
  warrantyStatus,
} from "@/lib/operational-assets";
import { useAppStore } from "@/stores";
import type { AssetAttachment, AssetComponent } from "@/types/database";

export function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assets, locations, equipmentReservations, fetchAssetComponents, fetchAssetAttachments } = useAppStore();
  const asset = assets.find((a) => a.id === id);
  const [components, setComponents] = useState<AssetComponent[]>([]);
  const [attachments, setAttachments] = useState<AssetAttachment[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchAssetComponents(id).then(setComponents).catch(() => setComponents([]));
    fetchAssetAttachments(id).then(setAttachments).catch(() => setAttachments([]));
  }, [id, fetchAssetComponents, fetchAssetAttachments]);

  if (!asset) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Ativo não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/gestao/ativos")}>Voltar aos ativos</Button>
      </div>
    );
  }

  const location = locations.find((l) => l.id === asset.location_id);
  const warranty = warrantyStatus(asset.warranty_until);
  const completeness = kitCompleteness(components);
  const replacement = asset.acquired_at && asset.useful_life_months
    ? addMonths(asset.acquired_at, asset.useful_life_months)
    : null;
  const reservations = equipmentReservations.filter((r) => r.asset_id === asset.id);
  const printQr = () => {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    const svg = document.getElementById(`asset-qr-${asset.id}`)?.innerHTML || "";
    win.document.write(`
      <html><head><title>${asset.code}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px}.code{font-family:monospace;font-size:22px;font-weight:700;margin-top:12px}</style>
      </head><body><div>${svg}</div><h1>${asset.name}</h1><div class="code">${asset.code}</div>
      <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/gestao/ativos" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Ativos
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(asset.category || asset.type)} · {controlLabel(asset.control_method)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printQr}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir QR
          </Button>
          <Button onClick={() => navigate("/gestao/settings")}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Cadastros
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" />
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {asset.photo_url && (
              <img src={asset.photo_url} alt={asset.name} className="h-36 w-full rounded-md object-cover border" />
            )}
            <div id={`asset-qr-${asset.id}`} className="flex justify-center rounded-md border bg-white p-3">
              <QRCodeSVG value={asset.code} size={140} level="H" includeMargin />
            </div>
            <div className="text-center">
              <code className="text-lg font-bold">{asset.code}</code>
              {asset.serial_number && <p className="text-xs text-muted-foreground">Série {asset.serial_number}</p>}
              {asset.brand && <p className="text-xs text-muted-foreground">{asset.brand} {asset.model}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Local e status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={asset.status === "available" ? "default" : "outline"}>{statusLabel(asset.status)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Local</span>
              <span>{location?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Responsável</span>
              <span>{asset.responsible_name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Última movimentação</span>
              <span>{asset.last_moved_at ? new Date(asset.last_moved_at).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
            {asset.control_method === "quantity" && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Quantidade</span>
                <span>{asset.quantity_on_hand ?? 0}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Idade e garantia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Idade</span>
              <span>{formatAge(asset.acquired_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Garantia</span>
              <Badge variant={warranty.variant}>{warranty.label}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Substituição prevista</span>
              <span>{replacement ? new Date(replacement).toLocaleDateString("pt-BR") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor original</span>
              <span>
                {asset.purchase_price != null
                  ? asset.purchase_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {(asset.voltage || asset.capacity || asset.power_watts || asset.dimensions) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Informações técnicas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-3">
            {asset.voltage && <Spec label="Voltagem" value={asset.voltage} />}
            {asset.power_watts != null && <Spec label="Potência" value={`${asset.power_watts} W`} />}
            {asset.plug_type && <Spec label="Plugue" value={asset.plug_type} />}
            {asset.capacity && <Spec label="Capacidade" value={asset.capacity} />}
            {asset.operating_temp && <Spec label="Temperatura" value={asset.operating_temp} />}
            {asset.dimensions && <Spec label="Dimensões" value={asset.dimensions} />}
            {asset.weight_kg != null && <Spec label="Peso" value={`${asset.weight_kg} kg`} />}
            {asset.color && <Spec label="Cor" value={asset.color} />}
            {asset.handling_notes && <div className="md:col-span-3"><Spec label="Cuidados" value={asset.handling_notes} /></div>}
          </CardContent>
        </Card>
      )}

      {asset.control_method === "kit" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Componentes</CardTitle>
              <Badge variant={completeness.complete ? "default" : "destructive"}>{completeness.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Qtd</th>
                  <th className="py-2 font-medium">ID</th>
                  <th className="py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">{c.quantity}</td>
                    <td className="py-2 font-mono text-xs">{c.component_code || "—"}</td>
                    <td className="py-2">
                      {c.condition === "ok" ? "Ok" : c.condition === "missing" ? "Ausente" : c.condition === "damaged" ? "Danificado" : "Substituído"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!completeness.complete && (
              <p className="mt-3 text-xs text-destructive">
                Kit incompleto: não deve sair como disponível até a conferência de todos os componentes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reservas</CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma reserva neste ativo. Pedidos e eventos usam este mesmo registro.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">De</th>
                  <th className="py-2 font-medium">Até</th>
                  <th className="py-2 font-medium">Responsável</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{r.reserved_from}</td>
                    <td className="py-2">{r.reserved_until}</td>
                    <td className="py-2">{r.holder_name}</td>
                    <td className="py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {(asset.notes || attachments.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Observações e arquivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {asset.notes && <p className="whitespace-pre-wrap">{asset.notes}</p>}
            {attachments.map((file) => (
              <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="block text-primary hover:underline">
                {file.file_name} · {new Date(file.created_at).toLocaleDateString("pt-BR")}
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
