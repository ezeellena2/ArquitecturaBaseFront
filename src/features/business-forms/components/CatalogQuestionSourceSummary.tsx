import { ApiError } from "@/shared/api/ApiError";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "@/shared/lib/dateTime";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail } from "../hooks/useCatalogQueries";
import { usePersonAttributes } from "../hooks/usePersonData";
import { localizedValue } from "../editorModel";
import type { DraftQuestionSource } from "../model";

export function CatalogQuestionSourceSummary({ scope, source, compared }: { scope: CatalogReadScope; source: DraftQuestionSource; compared?: DraftQuestionSource | null }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, source.catalog ?? "", "global");
  const attributes = usePersonAttributes(scope, (source.match ?? []).some(condition => "personAttributeId" in condition));
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !detail.data || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  const fields = detail.data.fields ?? [];
  const name = (id: string) => ["text", "code", "detail", "value"].includes(id) ? t("catalogs.items." + id) : localizedValue(fields.find(field => field.id === id)?.name ?? {}, scope.culture, "es") || t("catalogQuestion.filter.unavailable");
  return <span className="mt-1 block space-y-1 text-xs text-[var(--color-content-muted)]">{(source.match ?? []).map(condition => {
    const field = fields.find(field => field.id === condition.fieldId);
    const peer = compared?.match?.find(item => item.fieldId === condition.fieldId);
    let value: string;
    if ("personAttributeId" in condition) value = localizedValue(attributes.data?.items.find(attribute => attribute.id === condition.personAttributeId)?.name ?? {}, scope.culture, "es") || t("catalogQuestion.filter.personData");
    else value = field?.type === "catalog" ? t("catalogQuestion.review.catalogValue") : field?.type === "boolean" ? t(condition.value === "true" ? "yes" : condition.value === "false" ? "no" : "translationPending") : field?.type === "decimal" && scope.culture === "es" ? (condition.value ?? "").replace(".", ",") : field?.type === "date" && condition.value ? formatDateOnly(condition.value, scope.culture, "numeric") ?? condition.value : condition.value ?? t("translationPending");
    const changed = field?.type === "catalog" && "value" in condition && (!peer || !("value" in peer) || condition.value !== peer.value);
    return <span className="block" key={condition.fieldId}>{name(condition.fieldId)}: {value}{changed ? " · " + t("catalogQuestion.review.changedValue") : ""}</span>;
  })}
    {!(source.match?.length) ? <span className="block">{t("catalogQuestion.review.noFilters")}</span> : null}
    <span className="block">{t(source.presentation ? "catalogQuestion.presentation.own" : "catalogQuestion.presentation.inherit")}</span>
    {source.presentation ? <><span className="block">{t("catalogs.presentation.heading")}: {source.presentation.title.map(name).join(" · ")}</span><span className="block">{t("catalogs.presentation.description")}: {source.presentation.description.map(name).join(" · ") || "—"}</span></> : null}
  </span>;
}
