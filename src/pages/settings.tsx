import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { CreatableSelect, type SelectOption } from "@/components/ui/creatable-select";
import { useAppStore } from "@/stores";
import { Plus, Pencil, Trash2, MapPin, Package, Box, Warehouse, IceCream, Layers, Thermometer } from "lucide-react";
import type { Location, Product, Asset } from "@/types/database";

const defaultLocationTypes: SelectOption[] = [
  { value: "receiving", label: "Recebimento" },
  { value: "storage", label: "Estoque" },
  { value: "freezer", label: "Freezer" },
  { value: "shipping", label: "Expedição" },
  { value: "other", label: "Outro" },
];

const defaultMaterialTypes: SelectOption[] = [
  { value: "embalagem", label: "Embalagem" },
  { value: "envio", label: "Material de Envio" },
  { value: "insumo", label: "Insumo" },
  { value: "outro", label: "Outro" },
];

const defaultBoxTypes: SelectOption[] = [
  { value: "caixa_media", label: "Caixa Média" },
  { value: "caixa_preta", label: "Caixa Preta" },
  { value: "caixa_grande", label: "Caixa Grande" },
  { value: "cooler", label: "Cooler" },
];

const defaultProductLines: SelectOption[] = [
  { value: "caipi", label: "Caipi" },
  { value: "drinks", label: "Drinks" },
  { value: "cremoso", label: "Cremoso" },
  { value: "frutas", label: "Frutas" },
];

const defaultPackagingTypes: SelectOption[] = [
  { value: "individual", label: "Individual (1 un)" },
  { value: "cartucho_6", label: "Cartucho (6 un)" },
  { value: "caixa_60", label: "Caixa (60 un)" },
  { value: "caixa_bar", label: "Caixa Bar (60 un sem cartucho)" },
];

const getTypeLabel = (types: SelectOption[], value: string) => {
  return types.find((t) => t.value === value)?.label || value;
};

interface ComponentItem {
  product_id: string;
  quantity: number;
}

export function SettingsPage() {
  const { locations, products, assets, fetchLocations, fetchProducts, fetchAssets } = useAppStore();
  
  const [locationTypes, setLocationTypes] = useState<SelectOption[]>(defaultLocationTypes);
  const [materialTypes, setMaterialTypes] = useState<SelectOption[]>(defaultMaterialTypes);
  const [boxTypes, setBoxTypes] = useState<SelectOption[]>(defaultBoxTypes);
  const [productLines, setProductLines] = useState<SelectOption[]>(defaultProductLines);
  const [packagingTypes, setPackagingTypes] = useState<SelectOption[]>(defaultPackagingTypes);

  const [locationDialog, setLocationDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    item?: Location;
  }>({ open: false, mode: "create" });

  const [productDialog, setProductDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    kind: "pop" | "material";
    item?: Product;
  }>({ open: false, mode: "create", kind: "pop" });

  const [assetDialog, setAssetDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    assetType: "box" | "equipment";
    item?: Asset;
  }>({ open: false, mode: "create", assetType: "box" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: "location" | "product" | "asset";
    item?: Location | Product | Asset;
  }>({ open: false, type: "location" });

  const [formData, setFormData] = useState({
    name: "",
    type: "storage",
  });

  const [productFormData, setProductFormData] = useState({
    code: "",
    name: "",
    flavor: "",
    description: "",
    unit: "un",
    category: "embalagem",
    product_line: "caipi",
    base_quantity: 1,
    is_composite: false,
    components: [] as ComponentItem[],
  });

  const [assetFormData, setAssetFormData] = useState({
    code: "",
    name: "",
    type: "caixa_media",
  });

  useEffect(() => {
    fetchLocations();
    fetchProducts();
    fetchAssets();
  }, []);

  const handleCreateLocationType = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!locationTypes.find((t) => t.value === id)) {
      setLocationTypes([...locationTypes, { value: id, label }]);
    }
  };

  const handleEditLocationType = (value: string, newLabel: string) => {
    setLocationTypes(locationTypes.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeleteLocationType = (value: string) => {
    setLocationTypes(locationTypes.filter((t) => t.value !== value));
  };

  const handleCreateMaterialType = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!materialTypes.find((t) => t.value === id)) {
      setMaterialTypes([...materialTypes, { value: id, label }]);
    }
  };

  const handleEditMaterialType = (value: string, newLabel: string) => {
    setMaterialTypes(materialTypes.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeleteMaterialType = (value: string) => {
    setMaterialTypes(materialTypes.filter((t) => t.value !== value));
  };

  const handleCreateBoxType = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!boxTypes.find((t) => t.value === id)) {
      setBoxTypes([...boxTypes, { value: id, label }]);
    }
  };

  const handleEditBoxType = (value: string, newLabel: string) => {
    setBoxTypes(boxTypes.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeleteBoxType = (value: string) => {
    setBoxTypes(boxTypes.filter((t) => t.value !== value));
  };

  const handleCreateProductLine = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!productLines.find((t) => t.value === id)) {
      setProductLines([...productLines, { value: id, label }]);
    }
  };

  const handleEditProductLine = (value: string, newLabel: string) => {
    setProductLines(productLines.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeleteProductLine = (value: string) => {
    setProductLines(productLines.filter((t) => t.value !== value));
  };

  const handleCreatePackagingType = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!packagingTypes.find((t) => t.value === id)) {
      setPackagingTypes([...packagingTypes, { value: id, label }]);
    }
  };

  const handleEditPackagingType = (value: string, newLabel: string) => {
    setPackagingTypes(packagingTypes.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeletePackagingType = (value: string) => {
    setPackagingTypes(packagingTypes.filter((t) => t.value !== value));
  };

  const handleLocationSubmit = async () => {
    const { createLocation, updateLocation } = useAppStore.getState();
    
    if (locationDialog.mode === "create") {
      await createLocation({
        name: formData.name,
        type: formData.type,
        is_active: true,
        sort_order: locations.length,
      });
    } else if (locationDialog.item) {
      await updateLocation(locationDialog.item.id, {
        name: formData.name,
        type: formData.type,
      });
    }
    
    setLocationDialog({ open: false, mode: "create" });
    setFormData({ name: "", type: "storage" });
  };

  const handleProductSubmit = async () => {
    const { createProduct, updateProduct, saveProductComponents } = useAppStore.getState();
    
    let productId: string | undefined;
    
    if (productDialog.mode === "create") {
      const newProduct = await createProduct({
        code: productFormData.code,
        name: productFormData.name,
        flavor: productDialog.kind === "pop" ? productFormData.flavor : undefined,
        description: productDialog.kind === "pop" ? productFormData.description : undefined,
        kind: productDialog.kind,
        unit: productFormData.unit,
        category: productDialog.kind === "material" ? productFormData.category : undefined,
        product_line: productDialog.kind === "pop" ? productFormData.product_line : undefined,
        base_quantity: productFormData.base_quantity,
        is_composite: productFormData.components.length > 0,
        is_active: true,
      });
      productId = newProduct?.id;
    } else if (productDialog.item) {
      await updateProduct(productDialog.item.id, {
        code: productFormData.code,
        name: productFormData.name,
        flavor: productDialog.kind === "pop" ? productFormData.flavor : undefined,
        description: productDialog.kind === "pop" ? productFormData.description : undefined,
        unit: productFormData.unit,
        category: productDialog.kind === "material" ? productFormData.category : undefined,
        product_line: productDialog.kind === "pop" ? productFormData.product_line : undefined,
        base_quantity: productFormData.base_quantity,
        is_composite: productFormData.components.length > 0,
      });
      productId = productDialog.item.id;
    }
    
    // Save components for SKU products
    if (productId && productDialog.kind === "pop") {
      await saveProductComponents(productId, productFormData.components);
    }
    
    setProductDialog({ open: false, mode: "create", kind: "pop" });
    setProductFormData({ 
      code: "", name: "", flavor: "", description: "", unit: "un", 
      category: "embalagem", product_line: "caipi", base_quantity: 1,
      is_composite: false, components: []
    });
  };

  const handleAssetSubmit = async () => {
    const { createAsset, updateAsset } = useAppStore.getState();
    
    if (assetDialog.mode === "create") {
      await createAsset({
        code: assetFormData.code,
        name: assetFormData.name,
        type: assetFormData.type as Asset["type"],
        status: "available",
        is_active: true,
      });
    } else if (assetDialog.item) {
      await updateAsset(assetDialog.item.id, {
        code: assetFormData.code,
        name: assetFormData.name,
        type: assetFormData.type as Asset["type"],
      });
    }
    
    setAssetDialog({ open: false, mode: "create", assetType: "box" });
    setAssetFormData({ code: "", name: "", type: "caixa_media" });
  };

  const openEditLocation = (item: Location) => {
    setFormData({ name: item.name, type: item.type as LocationType });
    setLocationDialog({ open: true, mode: "edit", item });
  };

  const openEditProduct = async (item: Product, kind: "pop" | "material") => {
    const { getProductComponents } = useAppStore.getState();
    
    // Load existing components for this product
    let components: ComponentItem[] = [];
    if (kind === "pop" && item.is_composite) {
      components = await getProductComponents(item.id);
    }
    
    setProductFormData({
      code: item.code,
      name: item.name,
      flavor: item.flavor || "",
      description: item.description || "",
      unit: item.unit,
      category: item.category || "embalagem",
      product_line: item.product_line || "caipi",
      base_quantity: item.base_quantity || 1,
      is_composite: item.is_composite || false,
      components,
    });
    setProductDialog({ open: true, mode: "edit", kind, item });
  };

  const openEditAsset = (item: Asset, assetType: "box" | "equipment") => {
    setAssetFormData({
      code: item.code,
      name: item.name,
      type: item.type,
    });
    setAssetDialog({ open: true, mode: "edit", assetType, item });
  };

  const handleDelete = async () => {
    const { deleteLocation, deleteProduct, deleteAsset } = useAppStore.getState();
    
    if (deleteDialog.type === "location" && deleteDialog.item) {
      await deleteLocation(deleteDialog.item.id);
    } else if (deleteDialog.type === "product" && deleteDialog.item) {
      await deleteProduct(deleteDialog.item.id);
    } else if (deleteDialog.type === "asset" && deleteDialog.item) {
      await deleteAsset(deleteDialog.item.id);
    }
    
    setDeleteDialog({ open: false, type: "location" });
  };

  const popProducts = products.filter((p) => p.kind === "pop");
  const materialProducts = products.filter((p) => p.kind === "material");
  const boxAssets = assets.filter((a) => a.type === "caixa_media" || a.type === "caixa_preta");
  const equipmentAssets = assets.filter((a) => a.type === "freezer" || a.type === "carrinho");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os dados básicos do sistema
        </p>
      </div>

      <Tabs defaultValue="estoques" className="space-y-4">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="estoques" className="text-xs px-2.5 h-7">
            <Warehouse className="w-3.5 h-3.5 mr-1" />
            Estoques
          </TabsTrigger>
          <TabsTrigger value="skus" className="text-xs px-2.5 h-7">
            <IceCream className="w-3.5 h-3.5 mr-1" />
            SKUs
          </TabsTrigger>
          <TabsTrigger value="materiais" className="text-xs px-2.5 h-7">
            <Package className="w-3.5 h-3.5 mr-1" />
            Materiais
          </TabsTrigger>
          <TabsTrigger value="embalagens" className="text-xs px-2.5 h-7">
            <Box className="w-3.5 h-3.5 mr-1" />
            Embalagens Vai-Vem
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="text-xs px-2.5 h-7">
            <Thermometer className="w-3.5 h-3.5 mr-1" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="classificacoes" className="text-xs px-2.5 h-7">
            <Layers className="w-3.5 h-3.5 mr-1" />
            Classificações
          </TabsTrigger>
        </TabsList>

        {/* ESTOQUES TAB */}
        <TabsContent value="estoques" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Locais de Estoque</CardTitle>
                  <CardDescription className="text-xs">
                    Áreas onde os produtos podem ser armazenados
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFormData({ name: "", type: "storage" });
                    setLocationDialog({ open: true, mode: "create" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo local
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={locations}
                searchKey="name"
                searchPlaceholder="Buscar local..."
                emptyMessage="Nenhum local cadastrado."
                columns={[
                  {
                    key: "name",
                    header: "Nome",
                    render: (item) => (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "Tipo",
                    width: "w-32",
                    render: (item) => (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {getTypeLabel(locationTypes, item.type)}
                      </Badge>
                    ),
                  },
                  {
                    key: "is_active",
                    header: "Status",
                    width: "w-24",
                    render: (item) => (
                      <Badge variant={item.is_active ? "default" : "outline"} className="text-xs font-normal">
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    ),
                  },
                ]}
                actions={(item) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditLocation(item)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "location", item })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKUs TAB */}
        <TabsContent value="skus" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">SKUs de Produto</CardTitle>
                  <CardDescription className="text-xs">
                    Produtos YOLO Pop disponíveis para venda - configure a árvore de produtos
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setProductFormData({ 
                      code: "", name: "", flavor: "", description: "", unit: "un", 
                      category: "embalagem", product_line: "caipi", base_quantity: 1,
                      is_composite: false, components: []
                    });
                    setProductDialog({ open: true, mode: "create", kind: "pop" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo SKU
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={popProducts}
                searchKey="name"
                searchPlaceholder="Buscar SKU..."
                emptyMessage="Nenhum SKU cadastrado."
                columns={[
                  {
                    key: "code",
                    header: "SKU",
                    width: "w-28",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    ),
                  },
                  {
                    key: "product_line",
                    header: "Linha",
                    width: "w-24",
                    render: (item) => (
                      <Badge variant="outline" className="text-xs font-normal">
                        {getTypeLabel(productLines, item.product_line || "")}
                      </Badge>
                    ),
                  },
                  {
                    key: "flavor",
                    header: "Produto",
                    render: (item) => (
                      <div>
                        <span className="font-medium">{item.name}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground ml-2">{item.description}</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "base_quantity",
                    header: "Qtd Base",
                    width: "w-20",
                    render: (item) => (
                      <span className="text-xs">{item.base_quantity || 1} un</span>
                    ),
                  },
                  {
                    key: "is_composite",
                    header: "Tipo",
                    width: "w-24",
                    render: (item) => (
                      <Badge variant={item.is_composite ? "secondary" : "outline"} className="text-xs font-normal">
                        {item.is_composite ? "Composto" : "Simples"}
                      </Badge>
                    ),
                  },
                  {
                    key: "is_active",
                    header: "Status",
                    width: "w-20",
                    render: (item) => (
                      <Badge variant={item.is_active ? "default" : "outline"} className="text-xs font-normal">
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    ),
                  },
                ]}
                actions={(item) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditProduct(item, "pop")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "product", item })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* MATERIAIS TAB */}
        <TabsContent value="materiais" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Materiais</CardTitle>
                  <CardDescription className="text-xs">
                    Insumos e materiais de embalagem
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setProductFormData({ code: "", name: "", flavor: "", unit: "un", category: "embalagem" });
                    setProductDialog({ open: true, mode: "create", kind: "material" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo material
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={materialProducts}
                searchKey="name"
                searchPlaceholder="Buscar material..."
                emptyMessage="Nenhum material cadastrado."
                columns={[
                  {
                    key: "code",
                    header: "Código",
                    width: "w-28",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    ),
                  },
                  {
                    key: "name",
                    header: "Nome",
                    render: (item) => <span className="font-medium">{item.name}</span>,
                  },
                  {
                    key: "category",
                    header: "Tipo",
                    width: "w-32",
                    render: (item) => (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {getTypeLabel(materialTypes, item.category || "outro")}
                      </Badge>
                    ),
                  },
                  {
                    key: "unit",
                    header: "Unidade",
                    width: "w-20",
                  },
                ]}
                actions={(item) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditProduct(item, "material")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "product", item })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CLASSIFICAÇÕES TAB */}
        <TabsContent value="classificacoes" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Classificações de Qualidade</CardTitle>
              <CardDescription className="text-xs">
                Padrões para classificação de produtos após inspeção
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-9 px-3 text-left font-medium text-muted-foreground w-20">Classe</th>
                      <th className="h-9 px-3 text-left font-medium text-muted-foreground">Descrição</th>
                      <th className="h-9 px-3 text-left font-medium text-muted-foreground">Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/30">
                      <td className="h-10 px-3">
                        <Badge className="bg-emerald-500 text-xs">AAA</Badge>
                      </td>
                      <td className="h-10 px-3">Produto premium, sem defeitos visíveis</td>
                      <td className="h-10 px-3 text-muted-foreground">Loja, e-commerce, varejo</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/30">
                      <td className="h-10 px-3">
                        <Badge className="bg-blue-500 text-white text-xs">B</Badge>
                      </td>
                      <td className="h-10 px-3">Segunda linha, defeitos estéticos leves</td>
                      <td className="h-10 px-3 text-muted-foreground">Eventos, atacado, freezers</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="h-10 px-3">
                        <Badge variant="outline" className="text-xs">C</Badge>
                      </td>
                      <td className="h-10 px-3">Lote fechado, consumo rápido necessário</td>
                      <td className="h-10 px-3 text-muted-foreground">Amostras, equipe, doações</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                As classificações são fixas no sistema. Para alterar, entre em contato com o administrador.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMBALAGENS VAI-VEM TAB */}
        <TabsContent value="embalagens" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Embalagens Vai-Vem</CardTitle>
                  <CardDescription className="text-xs">
                    Caixas retornáveis para armazenamento e transporte
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setAssetFormData({ code: "", name: "", type: "caixa_media" });
                    setAssetDialog({ open: true, mode: "create", assetType: "box" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Nova caixa
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={boxAssets}
                searchKey="code"
                searchPlaceholder="Buscar caixa..."
                emptyMessage="Nenhuma caixa cadastrada."
                columns={[
                  {
                    key: "code",
                    header: "Código",
                    width: "w-32",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                        {item.code}
                      </code>
                    ),
                  },
                  {
                    key: "name",
                    header: "Nome",
                    render: (item) => <span>{item.name}</span>,
                  },
                  {
                    key: "type",
                    header: "Tipo",
                    width: "w-32",
                    render: (item) => (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {getTypeLabel(boxTypes, item.type)}
                      </Badge>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "w-28",
                    render: (item) => (
                      <Badge
                        variant={item.status === "available" ? "default" : "outline"}
                        className="text-xs font-normal"
                      >
                        {item.status === "available"
                          ? "Disponível"
                          : item.status === "in_use"
                          ? "Em uso"
                          : item.status === "at_factory"
                          ? "Na fábrica"
                          : item.status}
                      </Badge>
                    ),
                  },
                ]}
                actions={(item) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditAsset(item, "box")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "asset", item })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* EQUIPAMENTOS TAB */}
        <TabsContent value="equipamentos" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Equipamentos</CardTitle>
                  <CardDescription className="text-xs">
                    Freezers, carrinhos e outros equipamentos para eventos
                  </CardDescription>
                </div>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo equipamento
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={equipmentAssets}
                searchKey="code"
                searchPlaceholder="Buscar equipamento..."
                emptyMessage="Nenhum equipamento cadastrado."
                columns={[
                  {
                    key: "code",
                    header: "Código",
                    width: "w-32",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">
                        {item.code}
                      </code>
                    ),
                  },
                  {
                    key: "name",
                    header: "Nome",
                    render: (item) => <span className="font-medium">{item.name}</span>,
                  },
                  {
                    key: "type",
                    header: "Tipo",
                    width: "w-28",
                    render: (item) => (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {item.type === "freezer" ? "Freezer" : "Carrinho"}
                      </Badge>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    width: "w-28",
                    render: (item) => (
                      <Badge
                        variant={item.status === "available" ? "default" : "outline"}
                        className="text-xs font-normal"
                      >
                        {item.status === "available" ? "Disponível" : item.status}
                      </Badge>
                    ),
                  },
                ]}
                actions={(item) => (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "asset", item })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Location Dialog */}
      <Dialog open={locationDialog.open} onOpenChange={(open) => setLocationDialog({ ...locationDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {locationDialog.mode === "create" ? "Novo Local de Estoque" : "Editar Local"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {locationDialog.mode === "create"
                ? "Adicione um novo local para armazenar produtos."
                : "Atualize as informações do local."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Freezer Principal"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tipo</Label>
              <CreatableSelect
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: value })}
                options={locationTypes}
                onCreateOption={handleCreateLocationType}
                onEditOption={handleEditLocationType}
                onDeleteOption={handleDeleteLocationType}
                placeholder="Selecione o tipo..."
                createPlaceholder="Novo tipo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLocationDialog({ open: false, mode: "create" })} className="h-9">
              Cancelar
            </Button>
            <Button type="button" onClick={handleLocationSubmit} disabled={!formData.name} className="h-9">
              {locationDialog.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productDialog.open} onOpenChange={(open) => setProductDialog({ ...productDialog, open })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {productDialog.mode === "create"
                ? productDialog.kind === "pop"
                  ? "Novo SKU"
                  : "Novo Material"
                : productDialog.kind === "pop"
                ? "Editar SKU"
                : "Editar Material"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {productDialog.kind === "pop" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm">Número SKU</Label>
                    <Input
                      id="code"
                      value={productFormData.code}
                      onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                      placeholder="Ex: YOL-005"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Linha de Produto</Label>
                    <CreatableSelect
                      value={productFormData.product_line}
                      onChange={(value) => setProductFormData({ ...productFormData, product_line: value })}
                      options={productLines}
                      onCreateOption={handleCreateProductLine}
                      onEditOption={handleEditProductLine}
                      onDeleteOption={handleDeleteProductLine}
                      placeholder="Selecione..."
                      createPlaceholder="Nova linha..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pname" className="text-sm">Nome do Produto</Label>
                  <Input
                    id="pname"
                    value={productFormData.name}
                    onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    placeholder="Ex: YOLO Pop · Manga"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="flavor" className="text-sm">Sabor</Label>
                  <Input
                    id="flavor"
                    value={productFormData.flavor}
                    onChange={(e) => setProductFormData({ ...productFormData, flavor: e.target.value })}
                    placeholder="Ex: Manga"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm">Descrição</Label>
                  <Input
                    id="description"
                    value={productFormData.description}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                    placeholder="Ex: Picolé tropical de manga"
                    className="h-9"
                  />
                </div>
                <div className="border-t pt-4 mt-4">
                  <Label className="text-sm font-medium">Composição (Árvore de Produto)</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Adicione SKUs e materiais que compõem este produto
                  </p>
                  
                  {/* Component selector */}
                  <div className="flex gap-2 mb-3">
                    <select
                      id="component-select"
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      defaultValue=""
                    >
                      <option value="" disabled>Selecione um componente...</option>
                      <optgroup label="SKUs">
                        {popProducts
                          .filter(p => p.id !== productDialog.item?.id)
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.code} - {p.name} ({p.base_quantity || 1} un)
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Materiais">
                        {materialProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <Input
                      id="component-qty"
                      type="number"
                      min="1"
                      defaultValue="1"
                      placeholder="Qtd"
                      className="w-20 h-9"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        const select = document.getElementById("component-select") as HTMLSelectElement;
                        const qtyInput = document.getElementById("component-qty") as HTMLInputElement;
                        if (select.value && qtyInput.value) {
                          const exists = productFormData.components.find(c => c.product_id === select.value);
                          if (!exists) {
                            setProductFormData({
                              ...productFormData,
                              is_composite: true,
                              components: [
                                ...productFormData.components,
                                { product_id: select.value, quantity: parseInt(qtyInput.value) || 1 }
                              ]
                            });
                            select.value = "";
                            qtyInput.value = "1";
                          }
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Components list */}
                  {productFormData.components.length > 0 && (
                    <div className="border rounded-md divide-y mb-3">
                      {productFormData.components.map((comp, idx) => {
                        const product = products.find(p => p.id === comp.product_id);
                        if (!product) return null;
                        const isMaterial = product.kind === "material";
                        return (
                          <div key={comp.product_id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant={isMaterial ? "secondary" : "outline"} className="text-xs">
                                {isMaterial ? "Material" : "SKU"}
                              </Badge>
                              <span>{product.code}</span>
                              <span className="text-muted-foreground">-</span>
                              <span>{product.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={comp.quantity}
                                onChange={(e) => {
                                  const newComponents = [...productFormData.components];
                                  newComponents[idx].quantity = parseInt(e.target.value) || 1;
                                  setProductFormData({ ...productFormData, components: newComponents });
                                }}
                                className="w-16 h-7 text-xs"
                              />
                              <span className="text-xs text-muted-foreground">un</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  const newComponents = productFormData.components.filter((_, i) => i !== idx);
                                  setProductFormData({
                                    ...productFormData,
                                    is_composite: newComponents.length > 0,
                                    components: newComponents
                                  });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Summary */}
                  {productFormData.components.length > 0 && (
                    <div className="p-3 bg-muted/50 rounded-md">
                      <p className="text-xs text-muted-foreground">
                        <strong>Resumo:</strong> Este SKU contém {productFormData.components.length} componente(s).
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ao dar baixa neste SKU, o sistema subtrairá automaticamente:
                      </p>
                      <ul className="text-xs text-muted-foreground mt-1 ml-4 list-disc">
                        {productFormData.components.map(comp => {
                          const product = products.find(p => p.id === comp.product_id);
                          if (!product) return null;
                          return (
                            <li key={comp.product_id}>
                              {comp.quantity}× {product.name}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {productFormData.components.length === 0 && (
                    <div className="p-3 bg-muted/30 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">
                        Nenhum componente adicionado. Este é um SKU simples (produto individual).
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            {productDialog.kind === "material" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm">Código</Label>
                  <Input
                    id="code"
                    value={productFormData.code}
                    onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                    placeholder="Ex: MAT-010"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pname" className="text-sm">Nome</Label>
                  <Input
                    id="pname"
                    value={productFormData.name}
                    onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                    placeholder="Ex: Caixa de papelão"
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tipo</Label>
                  <CreatableSelect
                    value={productFormData.category}
                    onChange={(value) => setProductFormData({ ...productFormData, category: value })}
                    options={materialTypes}
                    onCreateOption={handleCreateMaterialType}
                    onEditOption={handleEditMaterialType}
                    onDeleteOption={handleDeleteMaterialType}
                    placeholder="Selecione o tipo..."
                    createPlaceholder="Novo tipo..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm">Unidade</Label>
                  <select
                    id="unit"
                    value={productFormData.unit}
                    onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="L">Litro (L)</option>
                    <option value="m">Metro (m)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="pc">Pacote (pc)</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProductDialog({ open: false, mode: "create", kind: "pop" })} className="h-9">
              Cancelar
            </Button>
            <Button type="button" onClick={handleProductSubmit} disabled={!productFormData.code || !productFormData.name} className="h-9">
              {productDialog.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Dialog */}
      <Dialog open={assetDialog.open} onOpenChange={(open) => setAssetDialog({ ...assetDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {assetDialog.mode === "create"
                ? assetDialog.assetType === "box"
                  ? "Nova Embalagem"
                  : "Novo Equipamento"
                : assetDialog.assetType === "box"
                ? "Editar Embalagem"
                : "Editar Equipamento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assetCode" className="text-sm">Código</Label>
              <Input
                id="assetCode"
                value={assetFormData.code}
                onChange={(e) => setAssetFormData({ ...assetFormData, code: e.target.value })}
                placeholder="Ex: CAIXA-001"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetName" className="text-sm">Nome</Label>
              <Input
                id="assetName"
                value={assetFormData.name}
                onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })}
                placeholder="Ex: Caixa Média 1"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tipo</Label>
              <CreatableSelect
                value={assetFormData.type}
                onChange={(value) => setAssetFormData({ ...assetFormData, type: value })}
                options={assetDialog.assetType === "box" ? boxTypes : [
                  { value: "freezer", label: "Freezer" },
                  { value: "carrinho", label: "Carrinho" },
                ]}
                onCreateOption={assetDialog.assetType === "box" ? handleCreateBoxType : undefined}
                onEditOption={assetDialog.assetType === "box" ? handleEditBoxType : undefined}
                onDeleteOption={assetDialog.assetType === "box" ? handleDeleteBoxType : undefined}
                placeholder="Selecione o tipo..."
                createPlaceholder="Novo tipo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssetDialog({ open: false, mode: "create", assetType: "box" })} className="h-9">
              Cancelar
            </Button>
            <Button type="button" onClick={handleAssetSubmit} disabled={!assetFormData.code || !assetFormData.name} className="h-9">
              {assetDialog.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Confirmar exclusão</DialogTitle>
            <DialogDescription className="text-sm">
              Tem certeza que deseja excluir{" "}
              <span className="font-medium">
                {deleteDialog.item && "name" in deleteDialog.item ? deleteDialog.item.name : ""}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteDialog({ open: false, type: "location" })} className="h-9">
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} className="h-9">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
