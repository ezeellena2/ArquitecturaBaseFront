import { Link } from "react-router";
import { Button } from "@/shared/ui/button";
import type { Column } from "@/shared/ui/DataTable";
import { AlertTriangleIcon, FolderIcon, PencilIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { catalogOriginKey } from "../catalogOrigin";
import type { CatalogListRow } from "./CatalogListTable";

/// What a row can do: the page decides it, and the columns need it to draw their cells.
export interface CatalogListActions {
  canManage: boolean;
  onViewUsage: (id: string) => void;
  onEdit: (id: string) => void;
  /** «Carpetas…» of the row (CP2-A), for whoever manages catalogs. */
  onFolders?: (row: CatalogListRow) => void;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/// The columns of the list; the page also gives them to «Ordenar por». Every one with a datum orders in the server (OT1-C), with
/// the backend's field as its id: the origin is the catalog's kind and orders as the segment does (by hand, from the base, from
/// another system), the state puts the active ones first, and an empty count («—») goes last.
export function catalogListColumns(t: Translate, { canManage, onViewUsage, onEdit, onFolders }: CatalogListActions): Column<CatalogListRow>[] {
  return [
    { id: "name", header: t("catalogs.columns.name"), sortable: true, sortKind: "text", cell: row => <Link to={"/catalogos/" + row.id} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{row.name}</Link> },
    // One value: «Usuarios, con filtros» is the same in every catalog of the base and does not tell one row from another (UD3).
    { id: "kind", header: t("catalogs.columns.origin"), sortable: true, sortKind: "state", cell: row => t(catalogOriginKey(row.origin)) },
    { id: "optionsCount", header: t("catalogs.columns.options"), sortable: true, sortKind: "number", numeric: true, cell: row => row.optionsCount ?? "—" },
    { id: "usageCount", header: t("catalogs.columns.usage"), sortable: true, sortKind: "number", cell: row => row.usageCount !== null && row.usageCount > 0
      ? <Button type="button" variant="link" aria-label={t("catalogs.viewUsage", { name: row.name })} onClick={() => onViewUsage(row.id)}>{t("catalogs.usage", { count: row.usageCount })}</Button> : "—" },
    { id: "state", header: t("catalogs.columns.state"), sortable: true, sortKind: "state", cell: row => <div>
      <p className={row.state === "Unavailable" ? "flex items-center gap-1 text-[var(--color-danger)]" : "flex items-center gap-1"}>{row.state === "Unavailable" ? <AlertTriangleIcon className="size-4 shrink-0" /> : <span aria-hidden="true" className={row.state === "Active" ? "inline-block size-2 shrink-0 rounded-full bg-[var(--color-success)]" : "inline-block size-2 shrink-0 rounded-full border border-[var(--color-content-muted)]"} />}{t("catalogs.state." + row.state)}</p>
      {row.stateReason ? <p className="text-xs text-[var(--color-content-muted)]">{row.stateReason}</p> : null}
    </div> },
    { sortable: false, id: "actions", header: t("actionsColumn"), align: "right", cell: row => <RowActions actions={[{
      label: t("edit"), accessibleName: t("catalogs.editNamed", { name: row.name }), icon: PencilIcon,
      // An External catalog is kept by its module and opens read-only from its name: there is nothing to edit.
      hidden: !canManage || !row.canEdit || row.origin === "External", onSelect: () => onEdit(row.id),
    }, {
      label: t("formFolders:item.action"), accessibleName: t("formFolders:item.actionFor", { name: row.name }), icon: FolderIcon,
      hidden: !canManage || !onFolders, onSelect: () => onFolders?.(row),
    }]} /> },
  ];
}
