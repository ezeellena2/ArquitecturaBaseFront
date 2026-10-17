import { ApiError } from "@/shared/api/ApiError";
import { administrativeName } from "../editorModel";
import { useCatalogDetail } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

export function CatalogQuestionName({ scope, id }: { scope: CatalogReadScope; id: string }) {
  const detail = useCatalogDetail(scope, id, "global");
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !detail.data || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  return <span>{" · "}{administrativeName(detail.data.name, scope.culture)}</span>;
}
