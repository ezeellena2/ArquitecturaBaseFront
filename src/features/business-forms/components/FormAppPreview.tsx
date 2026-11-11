import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { InfoTip } from "@/shared/ui/InfoTip";
import type { FormEntry } from "../api/entries";
import { appPreviewEntry } from "../appPreview";
import { missingFormTexts } from "../editorModel";
import { carryEntryDraft, initialEntryDraft, type EntryDraft } from "../entryForm";
import type { DraftEditorValue, FormCulture } from "../model";
import { FormEntryForm } from "./FormEntryForm";

// SA2-A (2026-11-09): with «Sólo en la app», the preview next to the editor is the app's «Nueva respuesta» instead of the WhatsApp
// phone: the pieces of loading, in one column and with a box per item of the block. Like the phone it is illustrative (it sends and
// saves nothing, in one language) and says so in the (i) of its heading. What was typed stays while the draft changes. What it
// leaves off says why over the control (MA1-A): a catalog question, whose options come when loading, and the final button.
export function FormAppPreview({ value, culture }: { value: DraftEditorValue; culture: FormCulture }) {
  const { t, i18n } = useTranslation("forms");
  const missing = culture === value.draft.culture ? 0 : missingFormTexts(value, culture);
  const previewCulture = missing ? value.draft.culture : culture;
  const entry = useMemo(() => {
    const content = i18n.getFixedT(previewCulture, "forms");
    return appPreviewEntry(value, previewCulture, { question: content("question"), option: number => content("option", { number }), section: content("sections.title"),
      form: content("new"), submit: content("submitLabel"), catalog: content("appPreviewCatalog") });
  }, [value, previewCulture, i18n]);
  const [state, setState] = useState<{ entry: FormEntry; draft: EntryDraft }>(() => ({ entry, draft: initialEntryDraft(entry) }));
  if (state.entry !== entry) setState({ entry, draft: carryEntryDraft(state.entry, state.draft, entry) });
  // NI1-A (2026-11-03): the heading names the account's language only when it is not the menu's.
  const heading = culture === (i18n.language.startsWith("en") ? "en" : "es") ? t("preview") : t("previewForAccount", { language: t("cultureNamesInText." + culture) });
  return <section aria-label={t("preview")} className="flex min-w-0 flex-col gap-3">
    <div className="flex items-center gap-1"><h2 className="text-xs font-semibold uppercase tracking-wide">{heading}</h2><span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: heading })} text={[t("appPreviewHint"), t("previewMissingHint"), t("previewOnly")].join(" ")} /></span></div>
    {missing ? <Banner>{t("previewFallback", { count: missing, requested: t("cultureNamesInText." + culture), actual: t("cultureNamesInText." + previewCulture) })}</Banner> : null}
    <div lang={previewCulture} className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <FormEntryForm entry={state.entry} draft={state.draft} onChange={draft => setState(current => ({ ...current, draft }))} errors={{}} layout="panel" catalogReason={t("appPreviewCatalog")} />
      <div className="flex justify-end"><DisabledReason reason={t("previewOnly")}><Button type="button" disabled>{state.entry.submitLabel}</Button></DisabledReason></div>
    </div>
  </section>;
}
