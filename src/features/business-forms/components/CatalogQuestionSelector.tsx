import { useId } from "react";
import { useTranslation } from "react-i18next";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Label } from "@/shared/ui/label";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogFieldSourceInput } from "./CatalogFieldSourceInput";
import { CatalogRowMessage } from "./CatalogRow";

// The catalog of a question: the list of a catalog field (2026-10-31, the only piece to choose since DS1-A), with every kind of
// catalog and the unusable ones off, without notes or an (i). Without permission to read catalogs it stays off, with that reason,
// and the question keeps its catalog.
// BI1-A: a question the library standard needs keeps its catalog, with that reason (`lockedReason`) on the control.
export function CatalogQuestionSelector({ scope, value, readOnly, error, selectedName, lockedReason = null, onChange }: { scope: CatalogReadScope; value: string; readOnly: boolean; error?: string; selectedName?: string | null; lockedReason?: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation("forms"), id = useId();
  const canRead = !!scope.actorId && scope.permissions.includes("formcatalogs.read");
  return <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{t("catalogQuestion.catalog")}<span aria-hidden="true"> *</span></Label>
    <DisabledReason reason={canRead ? lockedReason : t("catalogQuestion.requiresRead")} className="grid w-full">
      <CatalogFieldSourceInput anyKind scope={scope} value={canRead && value ? value : null} label={t("catalogQuestion.catalog")} readOnly={readOnly || !canRead || !!lockedReason} selectedName={selectedName} onChange={onChange}
        id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? id + "error" : undefined} data-question-control="catalog" />
    </DisabledReason>
    {error ? <CatalogRowMessage id={id + "error"} error>{error}</CatalogRowMessage> : null}
  </div>;
}
