import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockBoxes = [
  { id: "CX-001", flavor: "Morango", qty: 100, location: "Estoque", grade: "AAA", state: "Líquido" },
  { id: "CX-002", flavor: "Morango", qty: 100, location: "Estoque", grade: "AAA", state: "Líquido" },
  { id: "CX-003", flavor: "Morango", qty: 35, location: "Recebimento 1", grade: "AAA", state: "Líquido" },
  { id: "CX-004", flavor: "Maracujá", qty: 100, location: "Freezer 1", grade: "B", state: "Congelado" },
  { id: "CX-005", flavor: "Maracujá", qty: 42, location: "Freezer 1", grade: "B", state: "Congelado" },
  { id: "CX-006", flavor: "Limão", qty: 235, location: "Recebimento 1", grade: "", state: "Líquido" },
];

const locations = ["Recebimento 1", "Sala de embalagem", "Estoque", "Freezer 1", "Freezer da cozinha"];

export function InventoryPage() {
  const [search, setSearch] = useState("");

  const filteredBoxes = mockBoxes.filter(
    (box) =>
      box.id.toLowerCase().includes(search.toLowerCase()) ||
      box.flavor.toLowerCase().includes(search.toLowerCase())
  );

  const totalPops = mockBoxes.reduce((sum, box) => sum + box.qty, 0);
  const inAnalysis = mockBoxes.filter((box) => !box.grade).reduce((sum, box) => sum + box.qty, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventário</h1>
          <p className="text-muted-foreground">Controle de estoque e movimentação</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo recebimento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total no estoque</CardDescription>
            <CardTitle className="text-3xl">{totalPops.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">pops</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em análise</CardDescription>
            <CardTitle className="text-3xl">{inAnalysis.toLocaleString("pt-BR")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">aguardando classificação</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Caixas completas</CardDescription>
            <CardTitle className="text-3xl">
              {mockBoxes.filter((b) => b.grade && b.qty === 100).length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">100 pops cada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Localizações</CardDescription>
            <CardTitle className="text-3xl">{locations.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">áreas cadastradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar caixa, sabor ou lote…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Kanban</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            {locations.map((location) => {
              const boxesInLocation = filteredBoxes.filter((b) => b.location === location);
              return (
                <div key={location} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">{location}</h3>
                    <Badge variant="secondary">{boxesInLocation.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {boxesInLocation.map((box) => (
                      <Card key={box.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-xs">{box.id}</span>
                            <Badge variant={box.grade ? "default" : "outline"} className="text-xs">
                              {box.grade || "Em análise"}
                            </Badge>
                          </div>
                          <p className="font-medium">{box.flavor}</p>
                          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                            <span>{box.qty} pops</span>
                            <span>{box.state}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {boxesInLocation.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma caixa
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Sabor</th>
                    <th className="p-3 font-medium">Quantidade</th>
                    <th className="p-3 font-medium">Local</th>
                    <th className="p-3 font-medium">Classificação</th>
                    <th className="p-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoxes.map((box) => (
                    <tr key={box.id} className="border-b hover:bg-muted/50 cursor-pointer">
                      <td className="p-3 font-mono text-sm">{box.id}</td>
                      <td className="p-3">{box.flavor}</td>
                      <td className="p-3">{box.qty}</td>
                      <td className="p-3">{box.location}</td>
                      <td className="p-3">
                        <Badge variant={box.grade ? "default" : "outline"}>
                          {box.grade || "Em análise"}
                        </Badge>
                      </td>
                      <td className="p-3">{box.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
