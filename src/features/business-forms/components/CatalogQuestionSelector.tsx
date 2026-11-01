import { useId } from "react";
import { useTranslation } from "react-i18next";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Label } from "@/shared/ui/label";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogFieldSourceInput } from "./CatalogFieldSourceInput";
import { CatalogRowHelp, CatalogRowMessage } from "./CatalogRow";

// The catalog of a question: the dropdown of a catalog field (2026-10-31), with every kind of catalog and the unusable ones
// off. When the options are prepared is the help of its (i); without permission to read catalogs it stays off, with that
// reason, and the question keeps its catalog. Emptying the text does not leave the question without a catalog.
export function CatalogQuestionSelector({ scope, value, readOnly, error, selectedName, onChange }: { scope: CatalogReadScope; value: string; readOnly: boolean; error?: string; selectedName?: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation("forms"), id = useId();
  const canRead = !!scope.actorId && scope.permissions.includes("formcatalogs.read");
  return <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1"><Label htmlFor={id}>{t("catalogQuestion.catalog")}<span aria-hidden="true"> *</span></Label><CatalogRowHelp label={t("catalogQuestion.hintLabel")} text={t("catalogQuestion.hint")} /></div>
    <DisabledReason reason={canRead ? null : t("catalogQuestion.requiresRead")} className="grid w-full">
      <CatalogFieldSourceInput anyKind scope={scope} value={canRead && value ? value : null} label={t("catalogQuestion.catalog")} readOnly={readOnly || !canRead} selectedName={selectedName} onChange={next => { if (next) onChange(next); }}
        id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? id + "error" : undefined} data-question-control="catalog" />
    </DisabledReason>
    {error ? <CatalogRowMessage id={id + "error"} error>{error}</CatalogRowMessage> : null}
  </div>;
}
