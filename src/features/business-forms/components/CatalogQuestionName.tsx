import { useCatalogDetail } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

export function CatalogQuestionName({ scope, id }: { scope: CatalogReadScope; id: string }) {
  const detail = useCatalogDetail(scope, id, "global");
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !detail.data) return null;
  return <span>{" · "}{detail.data.name[scope.culture]}</span>;
}
