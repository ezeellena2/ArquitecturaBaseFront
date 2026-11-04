import type { ReactNode } from "react";
import { CatalogConditionValue, CatalogFieldName, CatalogName, CatalogPresentationValue } from "./CatalogSourceValues";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Surface } from "@/shared/ui/Surface";
import { createDraftReview, localizedValue, type DraftReviewRow } from "../editorModel";
import { draftReviewLines, type ReviewLabel, type ReviewValue } from "../draftReviewLines";
import type { DraftChoice, DraftEditorValue, DraftQuestion, FormCulture, FormDefinitionSnapshot } from "../model";

export function DraftReview({ value, definition, culture, catalogScope, auditSummary, open, onCloseAutoFocus, onOpenChange, onUseCurrent, onResolve }: {
  value: DraftEditorValue; definition: FormDefinitionSnapshot; culture: FormCulture; catalogScope?:CatalogReadScope; auditSummary?: string; open: boolean; onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void; onUseCurrent: () => void; onResolve: (choices: Readonly<Record<string, string>>) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose(open);
  // The comparison and the two choices, without explanations of what they do or do not save (2026-10-31).
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus ?? restoreFocus}><DialogHeader><DialogTitle>{t("reviewTitle")}</DialogTitle></DialogHeader>
    {auditSummary ? <p className="text-sm text-[var(--color-content-muted)]">{auditSummary}</p> : null}
    <DraftReviewChanges value={value} definition={definition} culture={culture} catalogScope={catalogScope} />
    <DialogFooter><Button type="button" variant="outline" onClick={() => { onUseCurrent(); onOpenChange(false); }}>{t("useCurrent")}</Button><Button type="button" onClick={() => {
      const review = createDraftReview(value, definition);
      onResolve(Object.fromEntries(review.rows.map(row => [row.id, row.canKeep ? "mine" : "current"])));
      onOpenChange(false);
    }}>{t("keepMine")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

// Each change once, the datum in grey and both versions in their own column, with only what differs (LR2-A, 2026-11-03):
// a question lists the data of its editor that changed, a catalog question names its filters and presentation, and an
// order reads numbered, with what moved in bold.
export function DraftReviewChanges({ value, definition, culture, catalogScope }: { value: DraftEditorValue; definition: FormDefinitionSnapshot; culture: FormCulture;catalogScope?:CatalogReadScope }) {
  const { t } = useTranslation("forms");
  const review = createDraftReview(value, definition);
  const catalogs = !!catalogScope?.actorId && catalogScope.permissions.includes("formcatalogs.read");
  const identity = (q: DraftQuestion) => q.fieldId ?? `new:${q.localId}`;
  const parent = (row: DraftReviewRow) => [...value.draft.fields, ...review.current.draft.fields].find(q => identity(q) === row.parentId);
  const muted = (text: string) => <span className="text-[var(--color-content-muted)]">{text}</span>;
  function label(item: ReviewLabel): ReactNode {
    if (item.kind === "key") return t(item.key);
    if (item.kind === "culture") return t(`cultures.${item.culture}`);
    return catalogScope ? <CatalogFieldName scope={catalogScope} catalogId={item.catalogId} fieldId={item.fieldId} /> : null;
  }
  function cell(item: ReviewValue | null): ReactNode {
    if (item === null) return null;
    switch (item.kind) {
      case "text": return item.text;
      case "key": return t(item.key);
      case "missing": return muted(t(item.key));
      case "none": return muted("—");
      case "list": return <ol className="flex flex-col gap-0.5">{item.items.map((entry, index) => <li key={index} className="flex gap-1.5">
        <span aria-hidden="true" className="min-w-3 text-right tabular-nums text-[var(--color-content-muted)]">{index + 1}</span><span className={"min-w-0" + (entry.moved ? " font-semibold" : "")}>{cell(entry.value)}</span></li>)}</ol>;
      case "catalog": return catalogScope ? <CatalogName scope={catalogScope} id={item.catalogId} /> : null;
      case "condition": return catalogScope ? <CatalogConditionValue scope={catalogScope} catalogId={item.catalogId} condition={item.condition} /> : null;
      case "presentation": return !item.parts.length ? muted("—") : catalogScope ? <CatalogPresentationValue scope={catalogScope} catalogId={item.catalogId} parts={item.parts} /> : null;
    }
  }
  function title(row: DraftReviewRow) {
    if (row.kind === "field") return localizedValue((row.mine as DraftQuestion | null)?.label ?? (row.current as DraftQuestion).label, culture, value.draft.culture) || t("question");
    if (row.kind === "option" || row.kind === "optionOrder") {
      const question = parent(row);
      const questionLabel = question ? localizedValue(question.label, culture, value.draft.culture) : t("question");
      if (row.kind === "optionOrder") return t("reviewOptionOrder", { question: questionLabel });
      const item = (row.mine ?? row.current) as DraftChoice | string | null;
      const option = (question?.type === "choice" || question?.type === "multiChoice") && !question.source ? question.options.find(o => (o.choiceId ?? `new:${o.localId}`) === row.optionId) : undefined;
      const optionLabel = option ? localizedValue(option.label, culture, value.draft.culture) : typeof item === "string" ? item : item ? localizedValue(item.label, culture, value.draft.culture) : "";
      return t("reviewOption", { question: questionLabel, option: optionLabel || t("translationPending") });
    }
    if (row.kind === "fieldText") { const question = parent(row); return t("reviewFieldText", { question: question ? localizedValue(question.label, culture, value.draft.culture) : t("question"), field: t(row.property === "help" ? "help" : "question") }); }
    return t(row.kind === "submit" ? "submitLabel" : row.kind === "order" ? "order" : row.kind);
  }
  // NI1-A (2026-11-03): a change names its language only when it is not the menu's.
  const rowTitle = (row: DraftReviewRow) => row.culture && row.culture !== culture ? t("localizedChange", { name: title(row), language: t(`cultures.${row.culture}`) }) : title(row);
  return <Surface><ComparisonTable columns={{ identity: [{ key: "change", header: t("changes") }], label: t("reviewData"), before: t("current"), after: t("mine") }}
    groups={review.rows.map(row => ({ key: row.id, identity: [rowTitle(row)], note: !row.canKeep ? t(row.kind === "prefix" ? "prefixLocked" : "retired") : undefined,
      lines: draftReviewLines(review, row, { culture, catalogs }).map(line => ({ key: line.key, label: line.label ? label(line.label) : undefined, before: cell(line.before), after: cell(line.after) })) }))} /></Surface>;
}
