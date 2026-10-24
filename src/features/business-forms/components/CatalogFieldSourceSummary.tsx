import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { administrativeName } from "../editorModel";
import { useCatalogDetail } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

// The detail under «Elegir de un catálogo» (CE1): the source catalog's name and how many options it has, as CatalogQuestionName reads it.
export function CatalogFieldSourceSummary({ scope, id, className }: { scope: CatalogReadScope; id: string; className?: string }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, id, "global");
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !detail.data || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  const name = administrativeName(detail.data.name, scope.culture);
  return <p className={className}>{detail.data.itemsCount === null ? name : t("catalogs.fields.detail.source", { name, count: detail.data.itemsCount })}</p>;
}
