import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogPage } from "../hooks/useCatalogQueries";
import { administrativeName } from "../editorModel";

// The catalog of a field, a person attribute or a question that picks from a catalog: a dropdown that opens on the first
// catalogs and filters them while typing, like an option's value (2026-10-31). A field or a person attribute picks among the
// active catalogs written by hand; a question (`anyKind`) also among the Filters ones, and sees the inactive and unavailable
// ones off, with why. While the list loads, fails (touching it reads again) or matches nothing, the open dropdown says so.
// An owner that already reads the chosen catalog passes its name (`selectedName`, null while it reads it), so it is not read
// twice. Inside a FormField it takes the field's id and messages.
export function CatalogFieldSourceInput({ scope, value, label, readOnly, anyKind = false, selectedName, onChange, ...aria }: { scope: CatalogReadScope; value: string | null; label: string; readOnly: boolean; anyKind?: boolean; selectedName?: string | null; onChange: (id: string | null) => void; id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; "data-question-control"?: string }) {
  const { t } = useTranslation("forms");
  const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
  const list = useCatalogPage(scope, { page: 1, pageSize: 20, sort: "name", search: settled, ...(anyKind ? {} : { kind: "Manual" as const, state: "Active" as const }) }, "global");
  const rows = list.data?.items ?? [];
  const current = rows.find(row => row.id === value);
  // Only once the first catalogs arrived is the chosen one known to be outside them.
  const detail = useCatalogDetail(scope, value && list.data && !current && selectedName === undefined ? value : "", "global");
  const currentName = !value ? "" : current?.name ?? selectedName ?? administrativeName(detail.data?.name, scope.culture);
  const unusable = (row: (typeof rows)[number]) => row.state === "Active" ? null : row.state === "Unavailable" && row.stateReason ? t("catalogs.unavailableReason") : t("catalogs.state." + row.state);
  const options = rows.map(row => ({ id: row.id, disabled: row.state !== "Active",
    label: [row.optionsCount === null ? row.name : t("catalogs.fields.detail.source", { name: row.name, count: row.optionsCount }), unusable(row)].filter(Boolean).join(" · ") }));
  const status = list.isError ? readErrorMessage(list.error, t) : !list.data ? t("common:states.loading") : t(settled.trim() ? "catalogQuestion.noResults" : "catalogQuestion.empty");
  return <Autocomplete {...aria} aria-label={label} dropdown disabled={readOnly} value={search ?? currentName} options={options} status={status}
    onClick={() => { if (list.isError) void list.refetch(); }}
    onValueChange={next => { setSearch(next); if (!next) onChange(null); }} onBlur={() => setSearch(null)} onSelect={id => { setSearch(null); onChange(id); }} />;
}
