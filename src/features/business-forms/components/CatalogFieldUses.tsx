import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import type { CatalogFieldUsage } from "../api/catalogResponse";
import { groupCatalogFieldUses } from "../catalogFields";

/**
 * Where a field is used: each form question once, with its stage, and a link to it for whoever can open forms. The
 * catalog's own «En WhatsApp» is part of this catalog, not a form, so it is never named like one.
 */
export function CatalogFieldUses({ uses, ownPresentation = false, canOpenForms, onNavigate }: { uses: readonly CatalogFieldUsage[]; ownPresentation?: boolean; canOpenForms: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation("forms");
  const { questions, catalog } = groupCatalogFieldUses(uses);
  return <div className="space-y-2 text-sm text-[var(--color-content)]">
    {questions.length ? <ul className="space-y-1">{questions.map((use, index) => {
      const stage = t("catalogs.fields.usage.stage." + (use.stages.length > 1 ? "both" : use.stages[0]));
      return <li key={index} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* Without formtemplates.read the server names neither the form nor the question: only the stage remains. */}
        <span>{use.formName === null ? t("catalogs.fields.hiddenUse." + use.stages[0]) : t("catalogs.fields.usage.question", { question: use.question, form: use.formName, stage })}</span>
        {canOpenForms && use.definitionId && use.questionId ? <Button variant="link" size="inline" asChild><Link to={"/formularios/" + use.definitionId} state={{ questionFieldId: use.questionId }} aria-label={t("catalogs.fields.usage.goToNamed", { question: use.question, form: use.formName })} onClick={onNavigate}>{t("catalogs.fields.usage.goTo")}</Link></Button> : null}
      </li>;
    })}</ul> : null}
    {ownPresentation || catalog ? <p>{t("catalogs.fields.usage.presentation")}</p> : null}
  </div>;
}
