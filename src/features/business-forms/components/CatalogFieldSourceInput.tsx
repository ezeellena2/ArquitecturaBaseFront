import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogPage } from "../hooks/useCatalogQueries";
import { administrativeName } from "../editorModel";

// The source of a field that picks from a catalog, in its row of the fields table: the active catalogs written by hand,
// searched while typing like an option's value. A question's full selector has no room in a cell.
export function CatalogFieldSourceInput({ scope, value, label, readOnly, onChange, ...aria }: { scope: CatalogReadScope; value: string | null; label: string; readOnly: boolean; onChange: (id: string | null) => void; "aria-invalid"?: boolean; "aria-describedby"?: string }) {
  const { t } = useTranslation("forms");
  const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
  const list = useCatalogPage(scope, { page: 1, pageSize: 20, sort: "name", search: settled, kind: "Manual", state: "Active" }, "global");
  const rows = list.data?.items ?? [];
  const current = rows.find(row => row.id === value);
  const detail = useCatalogDetail(scope, value && !current ? value : "", "global");
  const currentName = !value ? "" : current?.name ?? administrativeName(detail.data?.name, scope.culture);
  const options = rows.map(row => ({ id: row.id, label: row.optionsCount === null ? row.name : t("catalogs.fields.detail.source", { name: row.name, count: row.optionsCount }) }));
  return <Autocomplete {...aria} aria-label={label} disabled={readOnly} value={search ?? currentName} options={options}
    onValueChange={next => { setSearch(next); if (!next) onChange(null); }} onBlur={() => setSearch(null)} onSelect={id => { setSearch(null); onChange(id); }} />;
}
