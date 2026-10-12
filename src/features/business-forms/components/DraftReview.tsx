import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { DataTable } from "@/shared/ui/DataTable";
import { Surface } from "@/shared/ui/Surface";
import { createDraftReview, localizedValue, questionEditorType, type DraftReviewRow } from "../editorModel";
import type { DraftChoice, DraftEditorValue, DraftQuestion, FormCulture, FormDefinitionSnapshot, LocalizedText } from "../model";

export function DraftReview({ value, definition, culture, auditSummary, open, onCloseAutoFocus, onOpenChange, onUseCurrent, onResolve }: {
  value: DraftEditorValue; definition: FormDefinitionSnapshot; culture: FormCulture; auditSummary?: string; open: boolean; onCloseAutoFocus?: (event: Event) => void;
  onOpenChange: (open: boolean) => void; onUseCurrent: () => void; onResolve: (choices: Readonly<Record<string, string>>) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose(open);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-3xl" onCloseAutoFocus={onCloseAutoFocus ?? restoreFocus}><DialogHeader><DialogTitle>{t("reviewTitle")}</DialogTitle><DialogDescription>{t("reviewDescription")}</DialogDescription></DialogHeader>
    {auditSummary ? <p className="text-sm text-[var(--color-content-muted)]">{auditSummary}</p> : null}
    <DraftReviewChanges value={value} definition={definition} culture={culture} />
    <p className="text-sm text-[var(--color-content-muted)]">{t("reviewNoSave")}</p>
    <DialogFooter><Button type="button" variant="outline" onClick={() => { onUseCurrent(); onOpenChange(false); }}>{t("useCurrent")}</Button><Button type="button" onClick={() => {
      const review = createDraftReview(value, definition);
      onResolve(Object.fromEntries(review.rows.map(row => [row.id, row.canKeep ? "mine" : "current"])));
      onOpenChange(false);
    }}>{t("keepMine")}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function DraftReviewChanges({ value, definition, culture }: { value: DraftEditorValue; definition: FormDefinitionSnapshot; culture: FormCulture }) {
  const { t } = useTranslation("forms");
  const review = createDraftReview(value, definition);
  const text = (map: LocalizedText) => Object.entries(map).map(([language, label]) => `${new Intl.DisplayNames([culture], { type: "language" }).of(language) ?? language}: ${label}`).join(" · ");
  const identity = (q: DraftQuestion) => q.fieldId ?? `new:${q.localId}`;
  const parent = (row: DraftReviewRow) => [...value.draft.fields, ...review.current.draft.fields].find(q => identity(q) === row.parentId);
  function summary(row: DraftReviewRow, side: "mine" | "current") {
    const item = row[side];
    if (item === null) return t(row.culture ? "translationPending" : "removed");
    if (typeof item === "string") return item || t("translationPending");
    if (Array.isArray(item)) {
      const source = side === "mine" ? value : review.current;
      const question = source.draft.fields.find(q => identity(q) === row.parentId);
      return item.map(id => {
        if (row.kind === "optionOrder" && question?.type === "choice" && !question.source) {
          const option = question.options.find(o => (o.choiceId ?? `new:${o.localId}`) === id);
          return option ? localizedValue(option.label, culture, source.draft.culture) : t("removed");
        }
        const q = source.draft.fields.find(field => identity(field) === id);
        return q ? localizedValue(q.label, culture, source.draft.culture) : t("removed");
      }).join(" → ");
    }
    if ("type" in item) {
      const q = item as DraftQuestion;
      const help = q.help && Object.fromEntries(Object.entries(q.help).filter((entry): entry is [string, string] => entry[1] !== null));
      return [text(q.label), t("types." + questionEditorType(q)), t(q.required ? "required" : "optional"), help ? `${t("help")}: ${text(help)}` : "",
        "maxLength" in q ? `${t("maxLength")}: ${q.maxLength ?? (q.type === "shortText" ? 80 : 600)}` : "",
        q.type === "choice" && !q.source && !review.rows.some(r => r.parentId === row.parentId && r.kind === "option") ? q.options.map(o => text(o.label)).join("; ") : ""].filter(Boolean).join(" · ");
    }
    if ("label" in item && typeof item.label === "object") return text(item.label as LocalizedText);
    return text(item as LocalizedText);
  }
  function title(row: DraftReviewRow) {
    if (row.kind === "field") return localizedValue((row.mine as DraftQuestion | null)?.label ?? (row.current as DraftQuestion).label, culture, value.draft.culture) || t("question");
    if (row.kind === "option" || row.kind === "optionOrder") {
      const question = parent(row);
      const questionLabel = question ? localizedValue(question.label, culture, value.draft.culture) : t("question");
      if (row.kind === "optionOrder") return t("reviewOptionOrder", { question: questionLabel });
      const item = (row.mine ?? row.current) as DraftChoice | string | null;
      const option = question?.type === "choice" && !question.source ? question.options.find(o => (o.choiceId ?? `new:${o.localId}`) === row.optionId) : undefined;
      const optionLabel = option ? localizedValue(option.label, culture, value.draft.culture) : typeof item === "string" ? item : item ? localizedValue(item.label, culture, value.draft.culture) : "";
      return t("reviewOption", { question: questionLabel, option: optionLabel || t("translationPending") });
    }
    if (row.kind === "fieldText") { const question = parent(row); return t("reviewFieldText", { question: question ? localizedValue(question.label, culture, value.draft.culture) : t("question"), field: t(row.property === "help" ? "help" : "question") }); }
    return t(row.kind === "submit" ? "submitLabel" : row.kind === "order" ? "order" : row.kind);
  }
  const rowTitle = (row: DraftReviewRow) => row.culture ? t("localizedChange", { name: title(row), language: t(`cultures.${row.culture}`) }) : title(row);
  return <Surface><DataTable rows={review.rows} rowKey={row => row.id} emptyTitle={t("draft")} columns={[
      { id: "change", header: t("changes"), cell: row => <p className="break-words">{rowTitle(row)}</p> },
      { id: "current", header: t("current"), cell: row => <p className="whitespace-normal break-words">{summary(row, "current")}</p> },
      { id: "mine", header: t("mine"), cell: row => <div className="flex flex-col gap-2"><p className="whitespace-normal break-words">{summary(row, "mine")}</p>{!row.canKeep ? <p className="text-sm text-[var(--color-content-muted)]">{t(row.kind === "prefix" ? "prefixLocked" : "retired")}</p> : null}
      </div> },
    ]} /></Surface>;
}
