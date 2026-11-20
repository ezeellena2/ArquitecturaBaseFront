import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Picker } from "@/shared/ui/Picker";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogPage } from "../hooks/useCatalogQueries";
import { usePickerPages } from "../hooks/usePickerPages";
import { administrativeName } from "../editorModel";

type CatalogRow = NonNullable<ReturnType<typeof useCatalogPage>["data"]>["items"][number];

// The catalog of a field, a person attribute or a question that picks from a catalog, with the only piece to choose (DS1-A): the
// list searches the catalogs in the server, twenty at a time with «Mostrar N más», each one with its active options in grey under
// its name. A field or a person attribute picks among the active catalogs written by hand; a question (`anyKind`) also among the
// Filters ones, and sees the inactive and unavailable ones off, with why (MA1-A). The wait, the failure with «Reintentar» and a
// search that matches nothing are said inside the list. The chosen one may not be in the page: an owner that already reads it
// passes its name (`selectedName`, null while it reads it), so it is not read twice; while the name is read, the field says «…».
// Inside a FormField it takes the field's id and messages; the editor finds it by `data-question-control`.
export function CatalogFieldSourceInput({ scope, value, label, readOnly, anyKind = false, selectedName, onChange, ...field }: { scope: CatalogReadScope; value: string | null; label: string; readOnly: boolean; anyKind?: boolean; selectedName?: string | null; onChange: (id: string) => void; id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "data-question-control"?: string }) {
  const { t } = useTranslation("forms");
  const pages = usePickerPages<CatalogRow>();
  const query = useCatalogPage(scope, { page: pages.page, pageSize: 20, sort: "name", search: pages.settled, ...(anyKind ? {} : { kind: "Manual" as const, state: "Active" as const }) }, "global");
  const list = pages.list(query);
  // The last one chosen keeps its name while another search shows other catalogs.
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const current = [...list.options, ...query.data?.items ?? []].find(row => row.id === value)?.name ?? (picked?.id === value ? picked.name : undefined);
  // Only once the first catalogs arrived is the chosen one known to be outside them.
  const detail = useCatalogDetail(scope, value && query.data && current === undefined && selectedName === undefined ? value : "", "global");
  const currentName = !value ? "" : current ?? selectedName ?? administrativeName(detail.data?.name, scope.culture);
  const unusable = (row: CatalogRow) => row.state === "Active" ? null : row.state === "Unavailable" && row.stateReason ? t("catalogs.unavailableReason") : t("catalogs.state." + row.state);
  return <Picker {...field} label={label} disabled={readOnly} value={value} placeholder={t("catalogQuestion.chooseCatalog")}
    options={list.options.map(row => ({ id: row.id, label: row.name, description: row.optionsCount === null ? null : t("catalogs.fields.sourceOptions", { count: row.optionsCount }), disabledReason: unusable(row) }))}
    selectedOptions={value ? [{ id: value, label: currentName || "…" }] : undefined}
    search={pages.search} onSearchChange={pages.onSearchChange} total={list.total} loading={list.loading} failed={list.failed} onRetry={() => void query.refetch()}
    onLoadMore={list.onLoadMore} loadingMore={list.loadingMore} pageSize={list.pageSize}
    onChange={id => { const row = list.options.find(item => item.id === id); if (row) setPicked({ id, name: row.name }); onChange(id); }} />;
}
