import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { administrativeName } from "../editorModel";
import { useCatalogDetail, useCatalogItems } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

// The detail under «Elegir de un catálogo» (CE1): the source catalog's name, as CatalogQuestionName reads it, and how many of
// its options can be chosen. The detail's count includes the inactive ones, so the active ones are counted apart, as the
// catalog list and the cell's search do. While the name is read it says «…», as a fixed catalog value does.
export function CatalogFieldSourceSummary({ scope, id, className }: { scope: CatalogReadScope; id: string; className?: string }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, id, "global");
  const active = useCatalogItems(scope, id, detail.data?.revision ?? null, { page: 1, pageSize: 1, isActive: true }, "global");
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  if (!detail.data) return detail.isLoading ? <p className={className}>…</p> : null;
  const name = administrativeName(detail.data.name, scope.culture);
  return <p className={className}>{active.data ? t("catalogs.fields.detail.source", { name, count: active.data.totalCount }) : name}</p>;
}
