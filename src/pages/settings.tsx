import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { CreatableSelect, type SelectOption } from "@/components/ui/creatable-select";
import { useAppStore } from "@/stores";
import { Plus, Pencil, Trash2, Copy, MapPin, Package, Box, Warehouse, IceCream, Layers, Wrench, Shirt, Snowflake, Droplets, QrCode, Download, ImagePlus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Location, Product, Asset } from "@/types/database";
import { AtivosPanel } from "@/pages/settings/ativos-panel";
import { UniformesPanel } from "@/pages/settings/uniformes-panel";
import { EmbalagensPanel } from "@/pages/settings/embalagens-panel";
import { cleanLocation, formatBoxOuterMeasures, isBoxAsset, isUniformAsset } from "@/lib/operational-assets";
import { assetYardLocations, orderedAssetYardLocations, productStockLocations } from "@/lib/locations";
import { popBaseQuantity } from "@/lib/assembly";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const LOCATION_TYPES: Location["type"][] = ["receiving", "storage", "freezer", "shipping", "other"];

function asLocationType(value: string): Location["type"] {
  return LOCATION_TYPES.includes(value as Location["type"]) ? (value as Location["type"]) : "other";
}

function nullableText(enabled: boolean, value: string) {
  return enabled ? value || null : null;
}

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
];

const defaultProductLines: SelectOption[] = [
  { value: "caipi", label: "Caipi" },
  { value: "drinks", label: "Drinks" },
  { value: "cremoso", label: "Cremoso" },
  { value: "frutas", label: "Frutas" },
];

const defaultFormats: SelectOption[] = [
  { value: "congelado", label: "Congelado" },
  { value: "liquido", label: "Líquido" },
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

const emptyAssetForm = {
  code: "",
  name: "",
  description: "",
  type: "caixa_media",
  unit_capacity: "",
  length_cm: "",
  width_cm: "",
  height_cm: "",
  photo_url: "",
  location_id: "",
};

function parseCmField(value: string, label: string): number | null | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    alert(`Informe ${label} em centímetros, com um número maior que zero.`);
    return undefined;
  }
  return parsed;
}

async function uploadBoxPhoto(file: File) {
  if (!isSupabaseConfigured || !supabase) return URL.createObjectURL(file);
  const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const path = `assets/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("asset-files").upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from("asset-files").getPublicUrl(path).data.publicUrl;
}

function BoxPhotoSlot({
  url,
  onPick,
  onClear,
}: {
  url: string;
  onPick: (file: File) => Promise<void> | void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex w-28 shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border bg-muted"
      >
        {url ? (
          <img src={url} alt="Foto da caixa" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px]">Foto</span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onPick(file);
          event.target.value = "";
        }}
      />
      {url ? (
        <button type="button" className="text-[10px] text-muted-foreground hover:text-destructive" onClick={onClear}>
          Remover
        </button>
      ) : (
        <span className="text-[10px] text-muted-foreground">Clique para enviar</span>
      )}
    </div>
  );
}

function LocationCadastroTable({
  rows,
  locationTypes,
  emptyMessage,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  rows: Location[];
  locationTypes: SelectOption[];
  emptyMessage: string;
  onEdit: (item: Location) => void;
  onDuplicate: (item: Location) => void;
  onDelete: (item: Location) => void;
}) {
  return (
    <DataTable
      data={rows}
      searchKey="name"
      searchPlaceholder="Buscar local..."
      emptyMessage={emptyMessage}
        columns={[
          {
            key: "name",
            header: "Nome",
            render: (item) => (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{item.name}</span>
                {item.system_key && (
                  <Badge variant="outline" className="text-[10px] font-normal">Reservado</Badge>
                )}
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
            key: "requires_box",
            header: "Estoque",
            width: "w-28",
            render: (item) => (
              <span className="text-xs text-muted-foreground">
                {item.purpose === "asset"
                  ? "Ativos"
                  : item.requires_box === false
                    ? "Solto"
                    : "Em caixa"}
              </span>
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
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)} title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(item)} title="Duplicar">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              disabled={Boolean(item.system_key)}
              onClick={() => onDelete(item)}
              title={item.system_key ? "Local reservado do fluxo" : "Excluir"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      />
  );
}

interface ComponentItem {
  product_id: string;
  quantity: number;
}

// Component to show product composition in a popover
function CompositionPopover({ 
  product, 
  allProducts,
  productLines,
  materialTypes 
}: { 
  product: Product; 
  allProducts: Product[];
  productLines: SelectOption[];
  materialTypes: SelectOption[];
}) {
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadComponents = async () => {
    if (components.length > 0) return;
    setLoading(true);
    const { getProductComponents } = useAppStore.getState();
    const comps = await getProductComponents(product.id);
    setComponents(comps);
    setLoading(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={() => {
            setOpen(true);
            loadComponents();
          }}
          className="inline-flex"
        >
          <Badge variant="secondary" className="text-xs font-normal cursor-pointer hover:bg-secondary/80">
            <Layers className="w-3 h-3 mr-1" />
            Composto
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b bg-muted/30">
          <p className="font-medium text-sm">{product.code} - {product.name}</p>
          <p className="text-xs text-muted-foreground">Composição do produto</p>
        </div>
        <div className="p-2 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : components.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum componente cadastrado</p>
          ) : (
            <div className="space-y-1">
              {components.map((comp) => {
                const compProduct = allProducts.find(p => p.id === comp.product_id);
                if (!compProduct) return null;
                const isMaterial = compProduct.kind === "material";
                const isCongelado = compProduct.format === "congelado";
                const isLiquido = compProduct.format === "liquido";
                return (
                  <div key={comp.product_id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      {isMaterial ? (
                        <span className="text-sm">📦</span>
                      ) : isCongelado ? (
                        <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                      ) : isLiquido ? (
                        <Droplets className="w-3.5 h-3.5 text-fuchsia-500" />
                      ) : null}
                      <div>
                        <p className="text-sm font-medium">{compProduct.code}</p>
                        <p className="text-xs text-muted-foreground">{compProduct.name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {comp.quantity} un
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SettingsPage() {
  const { locations, products, assets, fetchLocations, fetchProducts, fetchAssets } = useAppStore();
  const productLocations = useMemo(() => productStockLocations(locations), [locations]);
  const assetLocations = useMemo(() => assetYardLocations(locations), [locations]);
  const boxHomeLocationId =
    cleanLocation(locations)?.id || orderedAssetYardLocations(locations)[0]?.id || "";
  
  const [locationTypes, setLocationTypes] = useState<SelectOption[]>(defaultLocationTypes);
  const [materialTypes, setMaterialTypes] = useState<SelectOption[]>(defaultMaterialTypes);
  const [boxTypes, setBoxTypes] = useState<SelectOption[]>(defaultBoxTypes);
  const [productLines, setProductLines] = useState<SelectOption[]>(defaultProductLines);
  const [formats, setFormats] = useState<SelectOption[]>(defaultFormats);
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    type: Location["type"];
    purpose: Location["purpose"];
    requires_box: boolean;
  }>({
    name: "",
    type: "storage",
    purpose: "product",
    requires_box: true,
  });

  const [productFormData, setProductFormData] = useState({
    code: "",
    name: "",
    flavor: "",
    description: "",
    unit: "un",
    category: "embalagem",
    product_line: "caipi",
    format: "congelado",
    base_quantity: 1,
    is_composite: false,
    min_quantity: 0,
    components: [] as ComponentItem[],
  });

  const [assetFormData, setAssetFormData] = useState(emptyAssetForm);

  // QR Code dialog state
  const [qrDialog, setQrDialog] = useState<{ open: boolean; asset: Asset | null }>({ open: false, asset: null });
  const qrRef = useRef<HTMLDivElement>(null);

  // Component selector state
  const [componentSelector, setComponentSelector] = useState({ productId: "", quantity: 1 });

  // All product components for recursive calculation
  const [allComponents, setAllComponents] = useState<{ parent_product_id: string; child_product_id: string; quantity: number }[]>([]);

  const loadAllComponents = async () => {
    const { getAllProductComponents } = useAppStore.getState();
    const comps = await getAllProductComponents();
    setAllComponents(comps);
  };

  const calculateTotalBaseUnits = (productId: string) =>
    popBaseQuantity(productId, products, allComponents);

  useEffect(() => {
    fetchLocations();
    fetchProducts();
    fetchAssets();
    loadAllComponents();
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

  const handleCreateFormat = (label: string) => {
    const id = label.toLowerCase().replace(/\s+/g, "_");
    if (!formats.find((t) => t.value === id)) {
      setFormats([...formats, { value: id, label }]);
    }
  };

  const handleEditFormat = (value: string, newLabel: string) => {
    setFormats(formats.map((t) =>
      t.value === value ? { ...t, label: newLabel } : t
    ));
  };

  const handleDeleteFormat = (value: string) => {
    setFormats(formats.filter((t) => t.value !== value));
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
        purpose: formData.purpose,
        is_active: true,
        sort_order: locations.length,
        requires_box: formData.purpose === "asset" ? false : formData.requires_box,
        system_key: null,
      });
    } else if (locationDialog.item) {
      await updateLocation(locationDialog.item.id, {
        name: formData.name,
        type: formData.type,
        purpose: formData.purpose,
        requires_box: formData.purpose === "asset" ? false : formData.requires_box,
      });
    }
    
    setLocationDialog({ open: false, mode: "create" });
    setFormData({ name: "", type: "storage", purpose: "product", requires_box: true });
  };

  const handleProductSubmit = async () => {
    const { createProduct, updateProduct, saveProductComponents } = useAppStore.getState();
    
    // Validate code before saving
    if (productDialog.mode === "create") {
      const isTaken = productDialog.kind === "pop" 
        ? isSkuCodeTaken(productFormData.code)
        : isMaterialCodeTaken(productFormData.code);
      const suggested = productDialog.kind === "pop" ? suggestedSkuCode : suggestedMaterialCode;
      
      if (isTaken) {
        alert(`O código "${productFormData.code}" já existe. Use um código diferente.\n\nSugestão: ${suggested}`);
        return;
      }
    }
    
    try {
      let productId: string | undefined;
      
      // Auto-add any pending component selection before saving
      let components = [...(productFormData.components || [])];
      if (componentSelector.productId && productFormData.is_composite) {
        const exists = components.find(c => c.product_id === componentSelector.productId);
        if (!exists) {
          components.push({ product_id: componentSelector.productId, quantity: componentSelector.quantity });
        }
      }
      
      
      if (productDialog.mode === "create") {
        const newProduct = await createProduct({
          code: productFormData.code,
          name: productFormData.name,
          flavor: nullableText(productDialog.kind === "pop", productFormData.flavor),
          description: nullableText(productDialog.kind === "pop", productFormData.description),
          kind: productDialog.kind,
          unit: productFormData.unit,
          category: nullableText(productDialog.kind === "material", productFormData.category),
          product_line: nullableText(productDialog.kind === "pop", productFormData.product_line),
          format: nullableText(productDialog.kind === "pop", productFormData.format),
          base_quantity: productFormData.base_quantity,
          is_composite: components.length > 0,
          min_quantity: productFormData.is_composite ? productFormData.min_quantity : 0,
          is_active: true,
        });
        productId = newProduct?.id;
      } else if (productDialog.item) {
        await updateProduct(productDialog.item.id, {
          code: productFormData.code,
          name: productFormData.name,
          flavor: nullableText(productDialog.kind === "pop", productFormData.flavor),
          description: nullableText(productDialog.kind === "pop", productFormData.description),
          unit: productFormData.unit,
          category: nullableText(productDialog.kind === "material", productFormData.category),
          product_line: nullableText(productDialog.kind === "pop", productFormData.product_line),
          format: nullableText(productDialog.kind === "pop", productFormData.format),
          base_quantity: productFormData.base_quantity,
          is_composite: components.length > 0,
          min_quantity: productFormData.is_composite ? productFormData.min_quantity : 0,
        });
        productId = productDialog.item.id;
      }
      
      // Save components for SKU products
      if (productId && productDialog.kind === "pop" && components.length > 0) {
        await saveProductComponents(productId, components);
      }
      
      // Reload all components to update calculated base quantities
      await loadAllComponents();
      
      setProductDialog({ open: false, mode: "create", kind: "pop" });
      setProductFormData({ 
        code: "", name: "", flavor: "", description: "", unit: "un", 
        category: "embalagem", product_line: "caipi", format: "congelado", base_quantity: 1,
        is_composite: false, min_quantity: 0, components: []
      });
      setComponentSelector({ productId: "", quantity: 1 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar produto";
      if (message.includes("duplicate key") || message.includes("unique constraint")) {
        alert(`Erro: O código "${productFormData.code}" já existe. Use um código diferente.`);
      } else {
        alert(`Erro ao salvar: ${message}`);
      }
    }
  };

  const handleAssetSubmit = async () => {
    const { createAsset, updateAsset } = useAppStore.getState();
    
    // Validate code before saving
    if (assetDialog.mode === "create") {
      const isTaken = assetDialog.assetType === "box" 
        ? isBoxCodeTaken(assetFormData.code)
        : isEquipmentCodeTaken(assetFormData.code);
      const suggested = assetDialog.assetType === "box" ? suggestedBoxCode : suggestedEquipmentCode;
      
      if (isTaken) {
        alert(`O código "${assetFormData.code}" já existe. Use um código diferente.\n\nSugestão: ${suggested}`);
        return;
      }
    }
    
    try {
      const assetName = assetDialog.assetType === "box" ? assetFormData.code : assetFormData.name;
      const parsedCapacity = Number(assetFormData.unit_capacity);
      const unitCapacity =
        assetDialog.assetType === "box" && assetFormData.unit_capacity.trim()
          ? parsedCapacity
          : null;

      if (assetDialog.assetType === "box" && assetFormData.unit_capacity.trim()) {
        if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
          alert("Informe a capacidade em unidades, com um número maior que zero.");
          return;
        }
      }

      const length_cm =
        assetDialog.assetType === "box" ? parseCmField(assetFormData.length_cm, "o comprimento") : null;
      if (length_cm === undefined) return;
      const width_cm =
        assetDialog.assetType === "box" ? parseCmField(assetFormData.width_cm, "a largura") : null;
      if (width_cm === undefined) return;
      const height_cm =
        assetDialog.assetType === "box" ? parseCmField(assetFormData.height_cm, "a altura") : null;
      if (height_cm === undefined) return;
      const dimensions =
        assetDialog.assetType === "box" ? formatBoxOuterMeasures({ length_cm, width_cm, height_cm }) || null : undefined;

      if (assetDialog.assetType === "box" && !assetFormData.location_id) {
        alert("Escolha o local da caixa.");
        return;
      }

      if (assetDialog.mode === "create") {
        await createAsset({
          code: assetFormData.code,
          name: assetName,
          description: assetFormData.description || null,
          type: assetFormData.type as Asset["type"],
          unit_capacity: unitCapacity,
          length_cm,
          width_cm,
          height_cm,
          dimensions,
          photo_url: assetFormData.photo_url || null,
          location_id: assetFormData.location_id || boxHomeLocationId,
          status: "available",
          is_active: true,
        });
      } else if (assetDialog.item) {
        await updateAsset(assetDialog.item.id, {
          code: assetFormData.code,
          name: assetName,
          description: assetFormData.description || null,
          type: assetFormData.type as Asset["type"],
          unit_capacity: unitCapacity,
          length_cm,
          width_cm,
          height_cm,
          dimensions,
          photo_url: assetFormData.photo_url || null,
          location_id: assetFormData.location_id || boxHomeLocationId,
        });
      }
      
      setAssetDialog({ open: false, mode: "create", assetType: "box" });
      setAssetFormData(emptyAssetForm);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar";
      alert(`Erro ao salvar: ${message}`);
    }
  };

  const openEditLocation = (item: Location) => {
    setFormData({
      name: item.name,
      type: item.type,
      purpose: item.purpose === "asset" ? "asset" : "product",
      requires_box: item.requires_box !== false,
    });
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
      format: item.format || "congelado",
      base_quantity: item.base_quantity || 1,
      is_composite: item.is_composite || false,
      min_quantity: item.min_quantity || 0,
      components,
    });
    setComponentSelector({ productId: "", quantity: 1 });
    setProductDialog({ open: true, mode: "edit", kind, item });
  };

  const openEditAsset = (item: Asset, assetType: "box" | "equipment") => {
    setAssetFormData({
      code: item.code,
      name: item.name,
      description: item.description || "",
      type: item.type,
      unit_capacity: item.unit_capacity ? String(item.unit_capacity) : "",
      length_cm: item.length_cm != null ? String(item.length_cm) : "",
      width_cm: item.width_cm != null ? String(item.width_cm) : "",
      height_cm: item.height_cm != null ? String(item.height_cm) : "",
      photo_url: item.photo_url || "",
      location_id: item.location_id || boxHomeLocationId,
    });
    setAssetDialog({ open: true, mode: "edit", assetType, item });
  };

  const handleDelete = async () => {
    const { deleteLocation, deleteProduct, deleteAsset } = useAppStore.getState();
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      if (deleteDialog.type === "location" && deleteDialog.item) {
        await deleteLocation(deleteDialog.item.id);
      } else if (deleteDialog.type === "product" && deleteDialog.item) {
        await deleteProduct(deleteDialog.item.id);
      } else if (deleteDialog.type === "asset" && deleteDialog.item) {
        await deleteAsset(deleteDialog.item.id);
      }
      setDeleteDialog({ open: false, type: "location" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const popProducts = products.filter((p) => p.kind === "pop" && p.is_active);
  const simpleProducts = popProducts.filter((p) => !p.is_composite);
  const compositeProducts = popProducts.filter((p) => p.is_composite);
  const materialProducts = products.filter((p) => p.kind === "material" && p.is_active);
  const boxAssets = assets.filter((a) => a.is_active !== false && isBoxAsset(a));
  const equipmentAssets = assets.filter(
    (a) => a.is_active !== false && !isBoxAsset(a) && !isUniformAsset(a)
  );

  // Helper to generate next sequential code
  const getNextCode = (prefix: string, existingCodes: string[]): string => {
    const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
    let maxNum = 0;
    existingCodes.forEach(code => {
      const match = code.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
  };

  // Suggested codes for each type
  const suggestedSkuCode = getNextCode("YOL", popProducts.map(p => p.code));
  const suggestedMaterialCode = getNextCode("MAT", materialProducts.map(p => p.code));
  const suggestedBoxCode = getNextCode("CX", boxAssets.map(a => a.code));
  const suggestedEquipmentCode = getNextCode("EQ", equipmentAssets.map(a => a.code));

  // Check if code exists
  const isSkuCodeTaken = (code: string) => popProducts.some(p => p.code.toLowerCase() === code.toLowerCase());
  const isMaterialCodeTaken = (code: string) => materialProducts.some(p => p.code.toLowerCase() === code.toLowerCase());
  const isBoxCodeTaken = (code: string) => boxAssets.some(a => a.code.toLowerCase() === code.toLowerCase());
  const isEquipmentCodeTaken = (code: string) => equipmentAssets.some(a => a.code.toLowerCase() === code.toLowerCase());

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
          <TabsTrigger value="ativos" className="text-xs px-2.5 h-7">
            <Wrench className="w-3.5 h-3.5 mr-1" />
            Ativos
          </TabsTrigger>
          <TabsTrigger value="uniformes" className="text-xs px-2.5 h-7">
            <Shirt className="w-3.5 h-3.5 mr-1" />
            Uniformes
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
                  <CardTitle className="text-base font-medium">Produtos e produtos montados</CardTitle>
                  <CardDescription className="text-xs">
                    Locais de estoque de SKUs, materiais e produtos montados
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFormData({ name: "", type: "storage", purpose: "product", requires_box: true });
                    setLocationDialog({ open: true, mode: "create" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo local
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <LocationCadastroTable
                rows={productLocations}
                locationTypes={locationTypes}
                emptyMessage="Nenhum local de produto cadastrado."
                onEdit={openEditLocation}
                onDuplicate={(item) => {
                  setFormData({
                    name: item.name + " (cópia)",
                    type: item.type,
                    purpose: "product",
                    requires_box: item.requires_box !== false,
                  });
                  setLocationDialog({ open: true, mode: "create" });
                }}
                onDelete={(item) => setDeleteDialog({ open: true, type: "location", item })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">Ativos, uniformes e caixas</CardTitle>
                  <CardDescription className="text-xs">
                    Pátio e áreas do fluxo de equipamentos, uniformes e embalagens vai-vem. Fábrica, área suja e área limpa são reservadas. Crie outros locais conforme o pátio.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setFormData({ name: "", type: "other", purpose: "asset", requires_box: false });
                    setLocationDialog({ open: true, mode: "create" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo local
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <LocationCadastroTable
                rows={assetLocations}
                locationTypes={locationTypes}
                emptyMessage="Nenhum local de ativos cadastrado."
                onEdit={openEditLocation}
                onDuplicate={(item) => {
                  setFormData({
                    name: item.name + " (cópia)",
                    type: item.type,
                    purpose: "asset",
                    requires_box: false,
                  });
                  setLocationDialog({ open: true, mode: "create" });
                }}
                onDelete={(item) => setDeleteDialog({ open: true, type: "location", item })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKUs TAB */}
        <TabsContent value="skus" className="space-y-4">
          {/* Simple SKUs Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    SKUs Simples
                    <Badge variant="secondary" className="text-xs font-normal ml-2">{simpleProducts.length}</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Produtos base individuais - picolés, drinks e unidades avulsas
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setProductFormData({ 
                      code: "", name: "", flavor: "", description: "", unit: "un", 
                      category: "embalagem", product_line: "caipi", format: "congelado", base_quantity: 1,
                      is_composite: false, min_quantity: 0, components: []
                    });
                    setComponentSelector({ productId: "", quantity: 1 });
                    setProductDialog({ open: true, mode: "create", kind: "pop" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo SKU Simples
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={simpleProducts}
                searchKey="name"
                searchPlaceholder="Buscar SKU simples..."
                emptyMessage="Nenhum SKU simples cadastrado."
                maxHeight="300px"
                columns={[
                  {
                    key: "name",
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
                    key: "code",
                    header: "SKU",
                    width: "w-32",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    ),
                  },
                  {
                    key: "format",
                    header: "Formato",
                    width: "w-28",
                    render: (item) => {
                      const format = item.format || "";
                      const isCongelado = format === "congelado";
                      const isLiquido = format === "liquido";
                      return (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs font-normal ${
                            isCongelado 
                              ? "bg-sky-100 text-sky-700 hover:bg-sky-100" 
                              : isLiquido 
                              ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100"
                              : ""
                          }`}
                        >
                          {isCongelado && <Snowflake className="w-3 h-3 mr-1" />}
                          {isLiquido && <Droplets className="w-3 h-3 mr-1" />}
                          {getTypeLabel(formats, format)}
                        </Badge>
                      );
                    },
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
                    key: "base_quantity",
                    header: "Qtd Base",
                    width: "w-20",
                    render: (item) => (
                      <span className="text-xs">{item.base_quantity || 1} un</span>
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
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setProductFormData({
                          code: item.code + "-COPIA",
                          name: item.name,
                          flavor: item.flavor || "",
                          description: item.description || "",
                          unit: item.unit || "un",
                          category: "",
                          product_line: item.product_line || "",
                          format: item.format || "congelado",
                          base_quantity: item.base_quantity || 1,
                          is_composite: false,
                          min_quantity: 0,
                          components: []
                        });
                        setComponentSelector({ productId: "", quantity: 1 });
                        setProductDialog({ open: true, mode: "create", kind: "pop" });
                      }}
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "product", item })}
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* Composite SKUs Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    SKUs Compostos
                    <Badge variant="secondary" className="text-xs font-normal ml-2">{compositeProducts.length}</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Kits, cartuchos e combos - produtos formados por outros SKUs e materiais
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setProductFormData({ 
                      code: "", name: "", flavor: "", description: "", unit: "un", 
                      category: "embalagem", product_line: "caipi", format: "congelado", base_quantity: 1,
                      is_composite: true, min_quantity: 0, components: []
                    });
                    setComponentSelector({ productId: "", quantity: 1 });
                    setProductDialog({ open: true, mode: "create", kind: "pop" });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Novo SKU Composto
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={compositeProducts}
                searchKey="name"
                searchPlaceholder="Buscar SKU composto..."
                emptyMessage="Nenhum SKU composto cadastrado."
                maxHeight="300px"
                columns={[
                  {
                    key: "name",
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
                    key: "code",
                    header: "SKU",
                    width: "w-32",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    ),
                  },
                  {
                    key: "format",
                    header: "Formato",
                    width: "w-28",
                    render: (item) => {
                      const format = item.format || "";
                      const isCongelado = format === "congelado";
                      const isLiquido = format === "liquido";
                      return (
                        <Badge 
                          variant="secondary" 
                          className={`text-xs font-normal ${
                            isCongelado 
                              ? "bg-sky-100 text-sky-700 hover:bg-sky-100" 
                              : isLiquido 
                              ? "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100"
                              : ""
                          }`}
                        >
                          {isCongelado && <Snowflake className="w-3 h-3 mr-1" />}
                          {isLiquido && <Droplets className="w-3 h-3 mr-1" />}
                          {getTypeLabel(formats, format)}
                        </Badge>
                      );
                    },
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
                    key: "base_quantity",
                    header: "Qtd Base",
                    width: "w-24",
                    render: (item) => {
                      const calculated = calculateTotalBaseUnits(item.id);
                      return (
                        <span className="text-xs font-medium">{calculated.toLocaleString()} un</span>
                      );
                    },
                  },
                  {
                    key: "min_quantity",
                    header: "Mín.",
                    width: "w-16",
                    render: (item) => (
                      <span className="text-xs">{item.min_quantity || "—"}</span>
                    ),
                  },
                  {
                    key: "composition",
                    header: "Composição",
                    width: "w-28",
                    render: (item) => (
                      <CompositionPopover product={item} allProducts={products} productLines={productLines} materialTypes={materialTypes} />
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
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setProductFormData({
                          code: item.code + "-COPIA",
                          name: item.name,
                          flavor: item.flavor || "",
                          description: item.description || "",
                          unit: item.unit || "un",
                          category: "",
                          product_line: item.product_line || "",
                          format: item.format || "congelado",
                          base_quantity: item.base_quantity || 1,
                          is_composite: true,
                          min_quantity: item.min_quantity || 0,
                          components: []
                        });
                        setComponentSelector({ productId: "", quantity: 1 });
                        setProductDialog({ open: true, mode: "create", kind: "pop" });
                      }}
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "product", item })}
                      title="Excluir"
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
                    setProductFormData({ 
                      code: "", name: "", flavor: "", description: "", unit: "un", 
                      category: "embalagem", product_line: "", format: "", base_quantity: 1,
                      is_composite: false, min_quantity: 0, components: []
                    });
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
                    key: "name",
                    header: "Nome",
                    render: (item) => <span className="font-medium">{item.name}</span>,
                  },
                  {
                    key: "code",
                    header: "Código",
                    width: "w-28",
                    render: (item) => (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    ),
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
                    key: "description",
                    header: "Descrição",
                    width: "w-40",
                    render: (item) => (
                      <span className="text-xs text-muted-foreground">{item.description || "-"}</span>
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
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setProductFormData({
                          code: item.code + "-COPIA",
                          name: item.name,
                          flavor: "",
                          description: "",
                          unit: item.unit || "un",
                          category: item.category || "embalagem",
                          product_line: "",
                          format: "",
                          base_quantity: 1,
                          is_composite: false,
                          min_quantity: 0,
                          components: []
                        });
                        setProductDialog({ open: true, mode: "create", kind: "material" });
                      }}
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, type: "product", item })}
                      title="Excluir"
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
              <DataTable
                tableId="gestao-settings-classificacoes"
                data={[
                  {
                    id: "aaa",
                    grade: "AAA",
                    description: "Produto premium, sem defeitos visíveis",
                    destination: "Loja, e-commerce, varejo",
                  },
                  {
                    id: "b",
                    grade: "B",
                    description: "Segunda linha, defeitos estéticos leves",
                    destination: "Eventos, atacado, freezers",
                  },
                  {
                    id: "c",
                    grade: "C",
                    description: "Lote fechado, consumo rápido necessário",
                    destination: "Amostras, equipe, doações",
                  },
                ]}
                columns={[
                  {
                    key: "grade",
                    header: "Classe",
                    width: "w-20",
                    render: (item) =>
                      item.grade === "AAA" ? (
                        <Badge className="bg-emerald-500 text-xs">AAA</Badge>
                      ) : item.grade === "B" ? (
                        <Badge className="bg-blue-500 text-white text-xs">B</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">C</Badge>
                      ),
                  },
                  { key: "description", header: "Descrição" },
                  {
                    key: "destination",
                    header: "Destino",
                    render: (item) => (
                      <span className="text-muted-foreground">{item.destination}</span>
                    ),
                  },
                ]}
              />
              <p className="text-xs text-muted-foreground mt-3">
                As classificações são fixas no sistema. Para alterar, entre em contato com o administrador.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMBALAGENS VAI-VEM TAB */}
        <TabsContent value="embalagens" className="space-y-4">
          <EmbalagensPanel />
        </TabsContent>

        {/* ATIVOS TAB */}
        <TabsContent value="ativos" className="space-y-4">
          <AtivosPanel />
        </TabsContent>

        <TabsContent value="uniformes" className="space-y-4">
          <UniformesPanel />
        </TabsContent>
      </Tabs>

      {/* Location Dialog */}
      <Dialog open={locationDialog.open} onOpenChange={(open) => setLocationDialog({ ...locationDialog, open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {locationDialog.mode === "create"
                ? formData.purpose === "asset"
                  ? "Novo local de ativos"
                  : "Novo local de produtos"
                : "Editar local"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {formData.purpose === "asset"
                ? "Este local aparece no pátio de ativos, uniformes e caixas."
                : "Este local aparece no estoque de produtos e produtos montados."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Nome</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.purpose === "asset" ? "Ex: Oficina, quarentena, pátio 2" : "Ex: Freezer Principal"}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Tipo</Label>
              <CreatableSelect
                value={formData.type}
                onChange={(value) => setFormData({ ...formData, type: asLocationType(value) })}
                options={locationTypes}
                onCreateOption={handleCreateLocationType}
                onEditOption={handleEditLocationType}
                onDeleteOption={handleDeleteLocationType}
                placeholder="Selecione o tipo..."
                createPlaceholder="Novo tipo..."
              />
            </div>
            {formData.purpose !== "asset" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4"
                checked={formData.requires_box}
                onChange={(e) => setFormData({ ...formData, requires_box: e.target.checked })}
              />
              <span>
                Exige caixa média
                <span className="block text-xs text-muted-foreground">
                  Desmarque para freezer da cozinha e outros estoques soltos. Rejeito ainda pode ir para o lixo no Preparar.
                </span>
              </span>
            </label>
            )}
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
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
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {productDialog.kind === "pop" && (
              <>
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
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm">Número SKU</Label>
                    <div className="relative">
                      <Input
                        id="code"
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value.toUpperCase() })}
                        placeholder={suggestedSkuCode}
                        className={`h-9 pr-8 ${productDialog.mode === "create" && productFormData.code && isSkuCodeTaken(productFormData.code) ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      />
                      {productDialog.mode === "create" && !productFormData.code && (
                        <button
                          type="button"
                          onClick={() => setProductFormData({ ...productFormData, code: suggestedSkuCode })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                          title="Usar código sugerido"
                        >
                          Usar
                        </button>
                      )}
                    </div>
                    {productDialog.mode === "create" && productFormData.code && isSkuCodeTaken(productFormData.code) && (
                      <p className="text-xs text-red-500">Código já existe. Sugestão: {suggestedSkuCode}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Formato</Label>
                    <CreatableSelect
                      value={productFormData.format}
                      onChange={(value) => setProductFormData({ ...productFormData, format: value })}
                      options={formats}
                      onCreateOption={handleCreateFormat}
                      onEditOption={handleEditFormat}
                      onDeleteOption={handleDeleteFormat}
                      placeholder="Selecione..."
                      createPlaceholder="Novo formato..."
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
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productFormData.is_composite}
                      onChange={(e) => setProductFormData({ 
                        ...productFormData, 
                        is_composite: e.target.checked,
                        components: e.target.checked ? productFormData.components : []
                      })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium">Produto composto</span>
                    <span className="text-xs text-muted-foreground">(kit, cartucho, combo)</span>
                  </label>
                </div>
                {productFormData.is_composite && (
                <div className="space-y-2 mt-3">
                  <Label htmlFor="min_quantity" className="text-sm">Estoque mínimo (reposição)</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    min={0}
                    className="h-9"
                    value={productFormData.min_quantity}
                    onChange={(e) =>
                      setProductFormData({
                        ...productFormData,
                        min_quantity: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Abaixo deste saldo em Produtos montados, Separação ganha um pedido interno de reposição.
                  </p>
                </div>
                )}
                {productFormData.is_composite && (
                <div className="border rounded-md p-4 mt-3 bg-muted/20 overflow-hidden">
                  <Label className="text-sm font-medium">Composição (Árvore de Produto)</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Adicione SKUs e materiais que compõem este produto
                  </p>
                  
                  {/* Component selector */}
                  <div className="flex gap-2 mb-3">
                    <select
                      value={componentSelector.productId}
                      onChange={(e) => setComponentSelector({ ...componentSelector, productId: e.target.value })}
                      className="flex-1 min-w-0 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" disabled>Selecione um componente...</option>
                      <optgroup label="SKUs Simples">
                        {simpleProducts
                          .filter(p => p.id !== productDialog.item?.id)
                          .map(p => {
                            const formatIcon = p.format === "congelado" ? "❄️" : p.format === "liquido" ? "💧" : "";
                            const linha = p.product_line ? getTypeLabel(productLines, p.product_line) : "";
                            return (
                              <option key={p.id} value={p.id}>
                                {formatIcon} {p.code} - {p.name} • {linha} ({p.base_quantity || 1} un)
                              </option>
                            );
                          })}
                      </optgroup>
                      <optgroup label="SKUs Compostos">
                        {compositeProducts
                          .filter(p => p.id !== productDialog.item?.id)
                          .map(p => {
                            const formatIcon = p.format === "congelado" ? "❄️" : p.format === "liquido" ? "💧" : "";
                            const linha = p.product_line ? getTypeLabel(productLines, p.product_line) : "";
                            const calcUnits = calculateTotalBaseUnits(p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {formatIcon} {p.code} - {p.name} • {linha} ({calcUnits} un)
                              </option>
                            );
                          })}
                      </optgroup>
                      <optgroup label="Materiais">
                        {materialProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            📦 {p.code} - {p.name} • {getTypeLabel(materialTypes, p.category || "")}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <Input
                      type="number"
                      min="1"
                      value={componentSelector.quantity}
                      onChange={(e) => setComponentSelector({ ...componentSelector, quantity: parseInt(e.target.value) || 1 })}
                      placeholder="Qtd"
                      className="w-20 h-9 flex-shrink-0"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 flex-shrink-0"
                      onClick={() => {
                        if (componentSelector.productId) {
                          const exists = productFormData.components.find(c => c.product_id === componentSelector.productId);
                          if (!exists) {
                            setProductFormData(prev => ({
                              ...prev,
                              is_composite: true,
                              components: [
                                ...prev.components,
                                { product_id: componentSelector.productId, quantity: componentSelector.quantity }
                              ]
                            }));
                            setComponentSelector({ productId: "", quantity: 1 });
                          } else {
                            alert("Este componente já foi adicionado.");
                          }
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Components list */}
                  {productFormData.components.length > 0 && (
                    <div className="border rounded-md divide-y mb-3 overflow-hidden">
                      {productFormData.components.map((comp, idx) => {
                        const product = products.find(p => p.id === comp.product_id);
                        if (!product) return null;
                        const isMaterial = product.kind === "material";
                        const isCongelado = product.format === "congelado";
                        const isLiquido = product.format === "liquido";
                        return (
                          <div key={comp.product_id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                              {isMaterial ? (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  📦 Material
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs flex-shrink-0 ${
                                    isCongelado 
                                      ? "bg-sky-100 text-sky-700" 
                                      : isLiquido 
                                      ? "bg-fuchsia-100 text-fuchsia-700"
                                      : ""
                                  }`}
                                >
                                  {isCongelado && <Snowflake className="w-3 h-3 mr-1" />}
                                  {isLiquido && <Droplets className="w-3 h-3 mr-1" />}
                                  {getTypeLabel(productLines, product.product_line || "")}
                                </Badge>
                              )}
                              <span className="flex-shrink-0">{product.code}</span>
                              <span className="text-muted-foreground flex-shrink-0">-</span>
                              <span className="truncate">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Input
                                type="number"
                                min="1"
                                value={comp.quantity}
                                onChange={(e) => {
                                  setProductFormData(prev => {
                                    const newComponents = [...prev.components];
                                    newComponents[idx] = { ...newComponents[idx], quantity: parseInt(e.target.value) || 1 };
                                    return { ...prev, components: newComponents };
                                  });
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
                                  setProductFormData(prev => {
                                    const newComponents = prev.components.filter((_, i) => i !== idx);
                                    return {
                                      ...prev,
                                      is_composite: newComponents.length > 0,
                                      components: newComponents
                                    };
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
                        Nenhum componente adicionado. Adicione os produtos que formam este kit.
                      </p>
                    </div>
                  )}
                </div>
                )}
              </>
            )}
            {productDialog.kind === "material" && (
              <>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm">Código</Label>
                    <div className="relative">
                      <Input
                        id="code"
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value.toUpperCase() })}
                        placeholder={suggestedMaterialCode}
                        className={`h-9 pr-8 ${productDialog.mode === "create" && productFormData.code && isMaterialCodeTaken(productFormData.code) ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      />
                      {productDialog.mode === "create" && !productFormData.code && (
                        <button
                          type="button"
                          onClick={() => setProductFormData({ ...productFormData, code: suggestedMaterialCode })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                          title="Usar código sugerido"
                        >
                          Usar
                        </button>
                      )}
                    </div>
                    {productDialog.mode === "create" && productFormData.code && isMaterialCodeTaken(productFormData.code) && (
                      <p className="text-xs text-red-500">Código já existe. Sugestão: {suggestedMaterialCode}</p>
                    )}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mat-description" className="text-sm">Descrição</Label>
                  <Input
                    id="mat-description"
                    value={productFormData.description}
                    onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                    placeholder="Ex: Caixa para envio de 10 cartuchos"
                    className="h-9"
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
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setProductDialog({ open: false, mode: "create", kind: "pop" })} className="h-9">
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleProductSubmit} 
              disabled={
                !productFormData.code || 
                !productFormData.name || 
                (productDialog.mode === "create" && (
                  productDialog.kind === "pop" 
                    ? isSkuCodeTaken(productFormData.code) 
                    : isMaterialCodeTaken(productFormData.code)
                ))
              } 
              className="h-9"
            >
              {productDialog.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Dialog */}
      <Dialog open={assetDialog.open} onOpenChange={(open) => setAssetDialog({ ...assetDialog, open })}>
        <DialogContent className="sm:max-w-lg">
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
            {assetDialog.assetType === "box" && (
              <div className="flex items-start gap-4">
                <BoxPhotoSlot
                  url={assetFormData.photo_url}
                  onPick={async (file) => {
                    try {
                      const url = await uploadBoxPhoto(file);
                      setAssetFormData((current) => ({ ...current, photo_url: url }));
                    } catch (error) {
                      alert(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
                    }
                  }}
                  onClear={() => setAssetFormData((current) => ({ ...current, photo_url: "" }))}
                />
                <p className="pt-2 text-xs text-muted-foreground">
                  Foto da caixa para o kanban de ativos e identificação visual.
                </p>
              </div>
            )}
            {assetDialog.assetType === "equipment" && (
              <div className="space-y-2">
                <Label htmlFor="assetName" className="text-sm">Nome</Label>
                <Input
                  id="assetName"
                  value={assetFormData.name}
                  onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })}
                  placeholder="Ex: Freezer Principal"
                  className="h-9"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label htmlFor="assetCode" className="text-sm">Código</Label>
                {(() => {
                  const suggestedCode = assetDialog.assetType === "box" ? suggestedBoxCode : suggestedEquipmentCode;
                  const isCodeTaken = assetDialog.assetType === "box" 
                    ? isBoxCodeTaken(assetFormData.code) 
                    : isEquipmentCodeTaken(assetFormData.code);
                  return (
                    <>
                      <div className="relative">
                        <Input
                          id="assetCode"
                          value={assetFormData.code}
                          onChange={(e) => setAssetFormData({ ...assetFormData, code: e.target.value.toUpperCase() })}
                          placeholder={suggestedCode}
                          className={`h-9 pr-8 ${assetDialog.mode === "create" && assetFormData.code && isCodeTaken ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                        {assetDialog.mode === "create" && !assetFormData.code && (
                          <button
                            type="button"
                            onClick={() => setAssetFormData({ ...assetFormData, code: suggestedCode })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:underline"
                            title="Usar código sugerido"
                          >
                            Usar
                          </button>
                        )}
                      </div>
                      {assetDialog.mode === "create" && assetFormData.code && isCodeTaken && (
                        <p className="text-xs text-red-500">Código já existe. Sugestão: {suggestedCode}</p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assetDescription" className="text-sm">Descrição</Label>
              <Input
                id="assetDescription"
                value={assetFormData.description}
                onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })}
                placeholder={assetDialog.assetType === "box" ? "Ex: Caixa retornável para transporte de fábrica" : "Ex: Freezer principal do estoque"}
                className="h-9"
              />
            </div>
            {assetDialog.assetType === "box" && (
              <div className="space-y-2">
                <Label htmlFor="unitCapacity" className="text-sm">Capacidade (unidades)</Label>
                <Input
                  id="unitCapacity"
                  type="number"
                  min="1"
                  step="1"
                  value={assetFormData.unit_capacity}
                  onChange={(e) => setAssetFormData({ ...assetFormData, unit_capacity: e.target.value })}
                  placeholder="Quantas unidades cabem nesta caixa"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Quantidade máxima de pops ou itens que esta embalagem comporta.
                </p>
              </div>
            )}
            {assetDialog.assetType === "box" && (
              <div className="space-y-2">
                <Label className="text-sm">Medidas externas (cm)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="boxLength" className="text-xs text-muted-foreground">Comprimento</Label>
                    <Input
                      id="boxLength"
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={assetFormData.length_cm}
                      onChange={(e) => setAssetFormData({ ...assetFormData, length_cm: e.target.value })}
                      placeholder="cm"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="boxWidth" className="text-xs text-muted-foreground">Largura</Label>
                    <Input
                      id="boxWidth"
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={assetFormData.width_cm}
                      onChange={(e) => setAssetFormData({ ...assetFormData, width_cm: e.target.value })}
                      placeholder="cm"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="boxHeight" className="text-xs text-muted-foreground">Altura</Label>
                    <Input
                      id="boxHeight"
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={assetFormData.height_cm}
                      onChange={(e) => setAssetFormData({ ...assetFormData, height_cm: e.target.value })}
                      placeholder="cm"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
            {assetDialog.assetType === "box" && (
              <div className="space-y-2">
                <Label className="text-sm">Local</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={assetFormData.location_id}
                  onChange={(e) => setAssetFormData({ ...assetFormData, location_id: e.target.value })}
                >
                  {orderedAssetYardLocations(locations).map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setAssetDialog({ open: false, mode: "create", assetType: "box" });
              setAssetFormData(emptyAssetForm);
            }} className="h-9">
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleAssetSubmit} 
              disabled={
                !assetFormData.code || 
                (assetDialog.assetType === "equipment" && !assetFormData.name) ||
                (assetDialog.mode === "create" && (
                  assetDialog.assetType === "box" 
                    ? isBoxCodeTaken(assetFormData.code) 
                    : isEquipmentCodeTaken(assetFormData.code)
                ))
              } 
              className="h-9"
            >
              {assetDialog.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (deleteBusy) return;
          setDeleteDialog({ ...deleteDialog, open });
          if (!open) setDeleteError(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Confirmar exclusão</DialogTitle>
            <DialogDescription className="text-sm">
              Tem certeza que deseja excluir{" "}
              <span className="font-medium">
                {deleteDialog.item && "code" in deleteDialog.item
                  ? deleteDialog.item.code
                  : deleteDialog.item && "name" in deleteDialog.item
                    ? deleteDialog.item.name
                    : ""}
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={deleteBusy}
              onClick={() => setDeleteDialog({ open: false, type: "location" })}
              className="h-9"
            >
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteBusy} className="h-9">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {deleteBusy ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(open) => setQrDialog({ ...qrDialog, open })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code - {qrDialog.asset?.code}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {qrDialog.asset?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-sm border">
              {qrDialog.asset && (
                <QRCodeSVG
                  value={qrDialog.asset.code}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Escaneie este código para identificar a caixa
            </p>
            <p className="text-lg font-mono font-bold mt-2">{qrDialog.asset?.code}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                if (qrRef.current && qrDialog.asset) {
                  const svg = qrRef.current.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngUrl = canvas.toDataURL('image/png');
                      const link = document.createElement('a');
                      link.download = `qr-${qrDialog.asset?.code}.png`;
                      link.href = pngUrl;
                      link.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                  }
                }
              }}
              className="h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Baixar PNG
            </Button>
            <Button type="button" onClick={() => setQrDialog({ open: false, asset: null })} className="h-9">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
