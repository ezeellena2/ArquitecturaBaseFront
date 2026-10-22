import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { CatalogListTable, type CatalogListRow } from "@/features/business-forms/components/CatalogListTable";
import { CatalogOriginDialog, type EditableCatalogOrigin } from "@/features/business-forms/components/CatalogOriginDialog";
import { CatalogMetadataFields } from "@/features/business-forms/components/CatalogMetadataFields";
import { CatalogManualItemsEditor } from "@/features/business-forms/components/CatalogManualItemsEditor";
import { CatalogFiltersEditor, type CatalogFilterColumn, type CatalogFiltersEditorValue } from "@/features/business-forms/components/CatalogFiltersEditor";
import type { CatalogManualItemValue } from "@/features/business-forms/catalogItemEdits";

// Component-only simulation until definitive DTO/HTTP examples arrive. No product save or API contract.
export function CatalogComponentsPreview() {
  const { t, i18n } = useTranslation("forms");
  const culture = i18n.language.startsWith("en") ? "en" : "es";
  const [contentCulture, setContentCulture] = useState<"es" | "en">(culture);
  const [metadata, setMetadata] = useState({ name: { es: "Clientes", en: "Customers" }, description: { es: "A quiénes se les entrega o se visita.", en: "People we deliver to or visit." } });
  const [screen, setScreen] = useState<"list" | EditableCatalogOrigin>("list");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<readonly CatalogManualItemValue[]>([
    { value: null, localId: "first", itemId: "first", label: { es: "Pérez Hnos.", en: "" }, detail: { es: "Av. Colón 1234", en: null }, code: "C-001", isActive: true, position: 1 },
    { value: null, localId: "second", itemId: "second", label: { es: "Ferretería Sur", en: "South hardware" }, detail: { es: "Ruta 9 km 4", en: "Route 9 km 4" }, code: "C-002", isActive: true, position: 2 },
  ]);
  const [filters, setFilters] = useState<CatalogFiltersEditorValue>({ textColumn: "name", detailColumn: "role", conditions: [
    { localId: "active", column: "active", operator: "equals", value: "true" },
    { localId: "role", column: "role", operator: "equals", value: "supervisor" },
  ], excludeRecipient: true, sortColumn: "name", sortDescending: false });
  const listRows: CatalogListRow[] = [{ valueType: "Text" as const, id: "first", name: "Clientes", description: culture === "es" ? "A quiénes se les entrega o se visita" : "People we deliver to or visit", origin: "Manual", optionsCount: 46, usageCount: 3, state: "Active", stateReason: null, canEdit: true }];
  const columns: readonly CatalogFilterColumn[] = [
    { key: "name", label: culture === "es" ? "nombre" : "name", operators: [{ key: "contains", label: culture === "es" ? "contiene" : "contains" }] },
    { key: "role", label: culture === "es" ? "rol" : "role", operators: [{ key: "equals", label: culture === "es" ? "es" : "is" }], choices: [{ key: "supervisor", label: "Supervisor" }, { key: "technician", label: culture === "es" ? "Técnico" : "Technician" }] },
    { key: "active", label: culture === "es" ? "activo" : "active", operators: [{ key: "equals", label: culture === "es" ? "es" : "is" }], choices: [{ key: "true", label: t("yes") }, { key: "false", label: t("no") }] },
  ];
  return <Page title={culture === "es" ? "Catálogos · componentes simulados" : "Catalogs · simulated components"} actions={screen === "list" ? <Button onClick={() => setOpen(true)}>{t("catalogs.new")}</Button> : undefined}>
    <Surface padded><div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={culture === "es" ? "Superficie simulada" : "Simulated surface"} options={[
      { key: "list", label: culture === "es" ? "Listado" : "List", pressed: screen === "list", onSelect: () => setScreen("list") },
      { key: "Manual", label: t("catalogs.source.manual"), pressed: screen === "Manual", onSelect: () => setScreen("Manual") },
      { key: "Filters", label: t("catalogs.source.filters"), pressed: screen === "Filters", onSelect: () => setScreen("Filters") },
    ]} /></div></Surface>
    {screen === "list" ? <CatalogListTable page={{ items: listRows, page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }} hasFilters={false} canManage onEdit={() => setScreen("Manual")} onViewUsage={() => {}} onPageChange={() => {}} />
      : screen === "Manual" ? <div className="mt-4 flex flex-col gap-4"><CatalogMetadataFields valueType="Text" {...metadata} culture={contentCulture} canManage onCultureChange={setContentCulture} onChange={change => setMetadata(previous => ({ ...previous, ...change }))} /><CatalogManualItemsEditor valueType="Text" items={items} culture={contentCulture} canManage expandedKey={expanded} onExpand={setExpanded}
        onChange={item => setItems(current => current.map(row => row.localId === item.localId ? item : row))} onMove={() => {}}
        onAdd={() => { const localId = crypto.randomUUID(); setItems(current => [...current, { value: null, localId, itemId: null, label: { es: "", en: "" }, detail: { es: null, en: null }, code: "", isActive: true, position: current.length + 1 }]); setExpanded(localId); }} /></div>
      : <CatalogFiltersEditor view={{ key: "users", label: culture === "es" ? "Usuarios" : "Users" }} columns={columns} value={filters} canManage onChange={setFilters} />}
    {open ? <CatalogOriginDialog onOpenChange={setOpen} onSelect={setScreen} /> : null}
  </Page>;
}
