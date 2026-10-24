import type { ReactNode } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { useTranslation } from "react-i18next";
import type { CatalogField } from "../api/catalogResponse";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItemsById } from "../hooks/useCatalogQueries";
import { usePersonAttributes } from "../hooks/usePersonData";
import { administrativeName } from "../editorModel";
import { presentationPartNames } from "../catalogPresentation";
import { catalogScalarText } from "../catalogValues";
import type { DraftQuestionSource } from "../model";

// The chosen option is read by id, so its label shows even beyond the first page or once it is inactive, never its GUID.
function FixedCatalogValue({ scope, field, value }: { scope: CatalogReadScope; field: CatalogField; value: string }) {
  const option = useCatalogItemsById(scope, field.sourceCatalogId ?? "", [value]).data?.items.find(item => item.id === value);
  return option ? administrativeName(option.text, scope.culture) : null;
}

export function CatalogQuestionSourceSummary({ scope, source, compared }: { scope: CatalogReadScope; source: DraftQuestionSource; compared?: DraftQuestionSource | null }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, source.catalog ?? "", "global");
  const attributes = usePersonAttributes(scope, (source.match ?? []).some(condition => "personAttributeId" in condition));
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !detail.data || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  const fields = detail.data.fields ?? [];
  const unavailable = t("catalogQuestion.filter.unavailable");
  const name = (id: string) => administrativeName(fields.find(field => field.id === id)?.name, scope.culture) || unavailable;
  const parts = source.presentation ? presentationPartNames(source.presentation, fields, scope.culture, key => t("catalogs.items." + key), unavailable) : null;
  return <span className="mt-1 block space-y-1 text-xs text-[var(--color-content-muted)]">{(source.match ?? []).map(condition => {
    const field = fields.find(field => field.id === condition.fieldId);
    const peer = compared?.match?.find(item => item.fieldId === condition.fieldId);
    let value: ReactNode;
    if ("personAttributeId" in condition) value = administrativeName(attributes.data?.items.find(attribute => attribute.id === condition.personAttributeId)?.name, scope.culture) || t("catalogQuestion.filter.personData");
    else value = field?.type === "catalog" ? condition.value ? <FixedCatalogValue scope={scope} field={field} value={condition.value}/> : t("translationPending") : condition.value === null ? t("translationPending") : field && field.type !== "text" ? catalogScalarText(field.type, condition.value, scope.culture, { yes: t("yes"), no: t("no") }) : condition.value;
    const changed = field?.type === "catalog" && "value" in condition && (!peer || !("value" in peer) || condition.value !== peer.value);
    return <span className="block" key={condition.fieldId}>{name(condition.fieldId)}: {value}{changed ? " · " + t("catalogQuestion.review.changedValue") : ""}</span>;
  })}
    {!(source.match?.length) ? <span className="block">{t("catalogQuestion.review.noFilters")}</span> : null}
    <span className="block">{t(source.presentation ? "catalogQuestion.presentation.own" : "catalogQuestion.presentation.inherit")}</span>
    {parts ? <><span className="block">{t("catalogs.presentation.heading")}: {parts.title.join(" · ")}</span><span className="block">{t("catalogs.presentation.description")}: {parts.description.join(" · ") || "—"}</span></> : null}
  </span>;
}
