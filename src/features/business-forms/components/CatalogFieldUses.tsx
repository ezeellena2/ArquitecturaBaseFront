import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import type { CatalogFieldUsage } from "../api/catalogResponse";
import { groupCatalogFieldUses } from "../catalogFields";

/**
 * Where a field is used: each form question once, in its row (lista de chequeo, 2026-11-11), never as a sentence. The form is
 * the datum and the question its value, with the stage in grey under it and a link to it for whoever can open forms. Without
 * formtemplates.read the server names neither the form nor the question: the row says «Un formulario» and only the stage. The
 * catalog's own «En WhatsApp» is part of this catalog, not a form, so it is never named like one.
 */
export function CatalogFieldUses({ uses, ownPresentation = false, canOpenForms, onNavigate }: { uses: readonly CatalogFieldUsage[]; ownPresentation?: boolean; canOpenForms: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation("forms");
  const { questions, catalog } = groupCatalogFieldUses(uses);
  return <div className="space-y-2 text-sm text-[var(--color-content)]">
    {questions.length ? <DataList items={questions.map((use, index) => {
      const stage = t("catalogs.fields.usage.stage." + (use.stages.length > 1 ? "both" : use.stages[0]));
      const link = canOpenForms && use.definitionId && use.questionId ? <Button variant="link" size="inline" asChild><Link to={"/formularios/" + use.definitionId} state={{ questionFieldId: use.questionId }} aria-label={t("catalogs.fields.usage.goToNamed", { question: use.question, form: use.formName })} onClick={onNavigate}>{t("catalogs.fields.usage.goTo")}</Link></Button> : null;
      return { key: use.definitionId && use.questionId ? use.definitionId + "/" + use.questionId : "hidden/" + index, label: use.formName ?? t("catalogs.fields.usage.hiddenForm"),
        value: use.question === null ? stage : <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="min-w-0 break-words">{use.question}</span>{link}</span>
          <span className="text-[var(--color-content-muted)]">{stage}</span>
        </span> };
    })} /> : null}
    {ownPresentation || catalog ? <p>{t("catalogs.fields.usage.presentation")}</p> : null}
  </div>;
}
