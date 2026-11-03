import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Spinner } from "@/shared/ui/Spinner";
import { AlertTriangleIcon, CheckIcon } from "@/shared/ui/icons";
import { cn } from "@/shared/lib/utils";
import { openCatalogField } from "../catalogFields";
import { catalogOptionPresentation, presentationPartNames } from "../catalogPresentation";
import { normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import { administrativeName } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems, useCatalogPresentationCheck } from "../hooks/useCatalogQueries";
import { usePersonAttributes } from "../hooks/usePersonData";
import { useRecipientMaximum, useRecipientPreview, useRecipientSamples } from "../hooks/useRecipientPreview";
import type { CatalogQuestionPreview, DraftQuestionSource, FormCulture } from "../model";
import { CatalogPresentationSection } from "./CatalogPresentationSection";
import { CatalogQuestionFilterActions, CatalogQuestionFilterSummary, CatalogQuestionFilters } from "./CatalogQuestionFilters";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

// The most options one person can get in the question type: a question of several shows 20, the dropdown 200.
const maximumLimit = (type: "choice" | "multiChoice") => type === "multiChoice" ? 20 : 200;

// CE4-A: the most options one person gets from the filters, against the limit of the question type (20 or 200); with only
// fixed filters everyone sees the same ones. With 0 no one sees any option, which is a warning, not a fit. A failed read
// offers Retry, disabled during the wait of a 429.
function RecipientMaximumState({ maximum, type, byPerson }: { maximum: ReturnType<typeof useRecipientMaximum>; type: "choice" | "multiChoice"; byPerson: boolean }) {
  const { t } = useTranslation("forms");
  if (maximum.failed) return <div role="alert"><p className="text-sm text-[var(--color-danger)]">{t("catalogQuestion.maximum.failed")}</p><DisabledReason reason={maximum.canRetry ? null : t("wait", { count: maximum.waitSeconds })}><Button type="button" variant="link" disabled={!maximum.canRetry} onClick={maximum.retry}>{t("common:actions.retry")}</Button></DisabledReason></div>;
  if (maximum.busy) return <p role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative/><span>{t("catalogQuestion.maximum.calculating")}</span></p>;
  if (!maximum.result) return null;
  const { maximum: count, maximumLabel: group } = maximum.result, limit = maximumLimit(type), fits = count <= limit, ok = count > 0 && fits;
  const fit = t("catalogQuestion.maximum." + (fits ? "fits" : "exceeds") + (type === "multiChoice" ? "Multiple" : "Choice"), { limit });
  const text = count === 0 ? t("catalogQuestion.maximum.none") : !byPerson ? t("catalogQuestion.maximum.shared", { count, fit }) : group ? t("catalogQuestion.maximum.perPerson", { count, group, fit }) : t("catalogQuestion.maximum.perPersonUngrouped", { count, fit });
  const Icon = ok ? CheckIcon : AlertTriangleIcon;
  return <p role="status" className={cn("flex items-start gap-2 text-sm", ok ? "text-[var(--color-success-700)]" : "text-[var(--color-warning-700)]")}><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0"/><span>{text}</span></p>;
}

// ZP1-A (2026-11-02): a zone starts folded and opens by itself when a new error or warning shows in it (`problem` names
// them, empty without one), so the editor can focus the marked control; the person can fold it again until another shows.
function useZoneOpen(problem: string) {
  const [open, setOpen] = useState(problem !== "");
  const [shown, setShown] = useState(problem);
  // Opened while rendering, like the zones of the entry form, so the focus that follows finds the control.
  if (problem !== shown) {
    setShown(problem);
    if (problem) setOpen(true);
  }
  return [open, setOpen] as const;
}

export function CatalogQuestionSettings({ scope, source, type = "choice", questionId = "catalog", definitionId = null, contentCulture = scope.culture, readOnly, error, errors = {}, onCatalogChange, onSourceChange, onPreviewChange, children }: {
  scope: CatalogReadScope; source: DraftQuestionSource; type?: "choice" | "multiChoice"; questionId?: string; definitionId?: string | null; contentCulture?: FormCulture; readOnly: boolean; error?: string; errors?: Readonly<Record<string, readonly string[]>>; children?: ReactNode;
  onCatalogChange: (catalogId: string) => void; onSourceChange?: (source: DraftQuestionSource) => void; onPreviewChange?: (questionId: string, preview: CatalogQuestionPreview | null) => void;
}) {
  const { t } = useTranslation("forms"), { t: content } = useTranslation("forms", { lng: contentCulture });
  const canRead = !!scope.actorId && scope.permissions.includes("formcatalogs.read");
  const detail = useCatalogDetail(scope, onSourceChange ? source.catalog ?? "" : "");
  const catalog = canRead ? detail.data : undefined;
  const fields = useMemo(() => catalog?.fields ?? [], [catalog]);
  const attributes = usePersonAttributes(scope, !!onSourceChange && canRead && fields.some(field => field.isActive && field.role === "filter"));
  const items = useCatalogItems(scope, catalog?.kind === "Manual" ? catalog.id : "", catalog?.revision ?? null, { page: 1, pageSize: 20, isActive: true, sort: "text" });
  // Only a Manual catalog offers the per-person test: with any other one no person stays chosen and no samples are read.
  const preview = useRecipientPreview({ ...scope, culture: contentCulture }, catalog?.kind === "Manual" ? definitionId : null, questionId, type, source);
  const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
  const samples = useRecipientSamples(scope, { page: 1, pageSize: 20, search: settled }, preview.available);
  // Retrying the people says so in the line that offered it, until the answer arrives.
  const [samplesRetrying, setSamplesRetrying] = useState(false);
  const sampleStatus = samples.isFetching || search !== null && search !== settled ? t("searching") : samples.data?.items.length === 0 ? t("personData.noPeople") : undefined;
  // The maximum depends only on the filters of a Manual catalog: no person and no saved form; its label is in the menu language.
  const maximum = useRecipientMaximum(scope, catalog?.kind === "Manual" ? source : null, catalog?.revision ?? null);
  const draftFields = useMemo(() => fields.map(field => openCatalogField(field, "en")), [fields]);
  const draftItems = useMemo(() => (items.data?.items ?? []).map(item => ({ localId: item.id, itemId: item.id, label: item.text, detail: item.detail, code: item.code, value: item.value, isActive: item.isActive, position: item.position, fields: item.fields, fieldTexts: item.fieldTexts })), [items.data]);
  const sourceStamp = JSON.stringify(normalizeCatalogQuestionSource(source));
  const shown = useMemo<CatalogQuestionPreview | null>(() => {
    if (preview.result) return { source: JSON.parse(sourceStamp) as DraftQuestionSource, culture: contentCulture, state: preview.result.state, options: preview.result.options };
    if ((source.match?.length ?? 0) > 0 || !catalog || items.isError || !items.data) return null;
    return { source: JSON.parse(sourceStamp) as DraftQuestionSource, culture: contentCulture, state: "Ready", options: draftItems.filter(item => item.isActive).map(item => ({ id: item.itemId!, ...catalogOptionPresentation(item, source.presentation ?? catalog.presentation, draftFields, catalog.valueType, contentCulture, { yes: content("catalogs.presentation.yes"), no: content("catalogs.presentation.no") }, "en") })) };
  }, [preview.result, sourceStamp, source.match?.length, source.presentation, contentCulture, catalog, items.isError, items.data, draftItems, draftFields, content]);
  useEffect(() => { onPreviewChange?.(questionId, shown); }, [onPreviewChange, questionId, shown]);
  const change = (next: DraftQuestionSource) => { if (!readOnly && canRead) onSourceChange?.(normalizeCatalogQuestionSource(next)); };
  const own = source.presentation != null;
  // «Como en el catálogo» names the parts the catalog sends, in the menu language.
  const inheritedParts = presentationPartNames(catalog?.presentation ?? null, fields, scope.culture, key => t("catalogs.items." + key), t("catalogs.presentation.unavailable"));
  const inherited = [...inheritedParts.title, ...inheritedParts.description].join(" · ");
  // Folded, «En WhatsApp» says the mode and the parts it sends, like the description of «Como en el catálogo».
  const sentParts = own ? presentationPartNames(source.presentation ?? null, fields, scope.culture, key => t("catalogs.items." + key), t("catalogs.presentation.unavailable")) : inheritedParts;
  const presentationSummary = [t(own ? "catalogQuestion.presentation.own" : "catalogQuestion.presentation.inherit"), ...sentParts.title, ...sentParts.description].join(" · ");
  // «Como en el catálogo» uses the detail's check; an own presentation is checked by the server over every active option.
  const ownCheck = useCatalogPresentationCheck(scope, catalog?.kind === "Manual" ? catalog.id : "", catalog?.revision ?? null, source.presentation ?? null);
  const check = own ? ownCheck.data ?? null : catalog?.presentationCheck ?? null;
  // Retry is offered for a retryable failure of the samples or of the preview (network, 5xx, 429); during a 429 wait of the failed
  // read it stays disabled with the wait as its reason. A lost permission on the samples is the preview's denial.
  const offerRetry = samples.retryable || preview.canRetry || preview.waitSeconds > 0, retryWait = samples.isError ? samples.waitSeconds : preview.waitSeconds;
  const retryDisabled = samples.isError ? retryWait > 0 : !preview.canRetry;
  // What each zone holds that needs a look opens it: its errors and, in the filters, the people data, the test with a person
  // and a maximum that fails or warns; in «En WhatsApp», the length check that fails or warns.
  const issues = (prefix: string) => Object.entries(errors).filter(([path]) => path.startsWith(prefix)).map(([path, messages]) => path + ": " + messages.join(" ")).sort();
  const warning = maximum.result && (maximum.result.maximum === 0 || maximum.result.maximum > maximumLimit(type)) ? "maximum " + maximum.result.maximum : "";
  const filtersProblem = [...issues("match"), attributes.isError ? "people data" : "", maximum.failed ? "maximum failed" : warning, preview.error || samples.isError ? "test failed" : "",
    preview.denied || samples.denied ? "test denied" : "", preview.result?.exceedsLimit ? "test exceeds" : ""].filter(Boolean).join("\n");
  const presentationProblem = [...issues("presentation"), own && ownCheck.isError && !ownCheck.isFetching ? "check failed" : "",
    ...(check?.cultures ?? []).filter(entry => entry.titleTooLongCount > 0 || entry.descriptionTooLongCount > 0).map(entry => `${entry.culture} ${entry.titleTooLongCount} ${entry.descriptionTooLongCount}`)].filter(Boolean).join("\n");
  const [filtersOpen, setFiltersOpen] = useZoneOpen(filtersProblem);
  const [presentationOpen, setPresentationOpen] = useZoneOpen(presentationProblem);
  const filtersTitle = t("catalogQuestion.filter.title"), presentationTitle = t("catalogs.presentation.title");
  return <div data-question-control="source" className="space-y-4"><CatalogQuestionSelector scope={scope} value={source.catalog ?? ""} selectedName={onSourceChange ? catalog ? administrativeName(catalog.name, scope.culture) : null : undefined} readOnly={readOnly} error={error} onChange={onCatalogChange}/>{children}
    {onSourceChange && source.catalog && canRead ? catalog ? catalog.kind === "Manual" ? <>
      <CollapsibleSection title={filtersTitle} help={t("catalogQuestion.filter.hint")} open={filtersOpen} onOpenChange={setFiltersOpen} expandLabel={t("catalogQuestion.zones.expand", { name: filtersTitle })} collapseLabel={t("catalogQuestion.zones.collapse", { name: filtersTitle })}
        summary={<CatalogQuestionFilterSummary source={source} fields={fields} scope={scope}/>} actions={!readOnly ? <CatalogQuestionFilterActions source={source} fields={fields} attributes={attributes.data?.items ?? []} attributesLoading={attributes.isLoading} onChange={change}/> : null}>
        <div className="flex flex-col gap-4 p-4"><CatalogQuestionFilters source={source} fields={fields} attributes={attributes.data?.items ?? []} attributesLoading={attributes.isLoading} scope={scope} readOnly={readOnly} errors={errors} onChange={change}/>
        {attributes.isError ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t("catalogQuestion.filter.dataFailed")}</p> : null}
        <FormField label={t("catalogQuestion.preview.asRecipient")}><DisabledReason reason={!definitionId ? t("catalogQuestion.preview.saveFirst") : !preview.complete ? t("catalogQuestion.preview.completeFilters") : null} className="grid w-full"><Autocomplete value={search ?? preview.person?.name ?? ""} options={(samples.data?.items ?? []).map(person => ({ id: person.id, label: person.name }))} disabled={!preview.available || !preview.complete} status={sampleStatus} aria-label={t("catalogQuestion.preview.asRecipient")} onValueChange={text => { setSearch(text); if (!text) { onPreviewChange?.(questionId, null); preview.select(null); } }} onBlur={() => setSearch(null)} onSelect={id => { const person = samples.data?.items.find(person => person.id === id); if (person) { onPreviewChange?.(questionId, null); preview.select(person); setSearch(null); } }}/></DisabledReason></FormField>
        {preview.busy ? <div role="status" className="flex items-center gap-2"><Spinner/><p className="text-sm">{t("catalogQuestion.preview.loading")}</p></div> : samplesRetrying ? <div role="status" className="flex items-center gap-2"><Spinner decorative/><p className="text-sm">{t("searching")}</p></div> : preview.denied || samples.denied ? <p role="alert" className="text-sm">{t("catalogQuestion.preview.denied")}</p> : preview.error || samples.isError ? <div role="alert"><p className="text-sm text-[var(--color-danger)]">{t("catalogQuestion.preview.failed")}</p>{offerRetry ? <DisabledReason reason={retryDisabled ? t("wait", { count: retryWait }) : null}><Button type="button" variant="link" disabled={retryDisabled} onClick={() => { if (samples.isError) { setSamplesRetrying(true); void samples.refetch().finally(() => setSamplesRetrying(false)); } else preview.retry(); }}>{t("common:actions.retry")}</Button></DisabledReason> : null}</div> : preview.result ? <div role="status" className="space-y-1"><p className="text-sm font-medium">{t(preview.result.state === "Ready" ? "catalogQuestion.preview.count" : preview.result.state === "RecipientDataMissing" ? "catalogQuestion.preview.missingData" : "catalogQuestion.preview.unavailable", { count: preview.result.optionCount })}</p>{preview.result.recipient.values.map(value => <p key={value.attributeId} className="text-xs text-[var(--color-content-muted)]">{value.name}: {value.text || "—"}</p>)}{preview.result.exceedsLimit ? <p className="text-sm text-[var(--color-warning-700)]">{t("catalogQuestion.preview.exceeds", { limit: preview.result.limit })}</p> : null}</div> : null}
        <RecipientMaximumState maximum={maximum} type={type} byPerson={(source.match ?? []).some(match => "personAttributeId" in match)}/></div>
      </CollapsibleSection>
      <CollapsibleSection title={presentationTitle} open={presentationOpen} onOpenChange={setPresentationOpen} expandLabel={t("catalogQuestion.zones.expand", { name: presentationTitle })} collapseLabel={t("catalogQuestion.zones.collapse", { name: presentationTitle })} summary={presentationSummary}>
        <div className="flex flex-col gap-4 p-4"><RadioGroupField label={t("catalogQuestion.presentation.mode")} variant="cards" value={own ? "own" : "catalog"} onValueChange={mode => change({ ...source, presentation: mode === "own" ? { title: [...(catalog.presentation?.title ?? ["text"])], description: [...(catalog.presentation?.description ?? ["detail"])] } : null })} options={[{ value: "catalog", disabled: readOnly, label: t("catalogQuestion.presentation.inherit"), description: inherited }, { value: "own", disabled: readOnly, label: t("catalogQuestion.presentation.own") }]}/><CatalogPresentationSection embedded value={source.presentation ?? catalog.presentation} fields={draftFields} items={draftItems} valueType={catalog.valueType} culture={contentCulture} inputCulture="en" readOnly={readOnly || !own} errors={errors} check={check} onChange={presentation => change({ ...source, presentation })}/>
        {own && ownCheck.isFetching ? <div role="status" className="flex items-center gap-2"><Spinner decorative/><p className="text-sm">{t("catalogQuestion.presentation.checking")}</p></div> : null}
        {own && ownCheck.isError && !ownCheck.isFetching ? <div role="alert"><p className="text-sm">{t("catalogQuestion.presentation.checkFailed")}</p><Button type="button" variant="link" onClick={() => void ownCheck.refetch()}>{t("common:actions.retry")}</Button></div> : null}</div>
      </CollapsibleSection>
    </> : null : detail.isError ? <div role="alert"><p className="text-sm">{t("catalogQuestion.preview.catalogFailed")}</p><Button type="button" variant="link" onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button></div> : <Spinner/> : null}
  </div>;
}
