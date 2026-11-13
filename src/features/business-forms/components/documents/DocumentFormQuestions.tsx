import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DataList } from "@/shared/ui/DataList";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { documentFormLimits, documentFormQuestionProblems, isChoiceType, newQuestionKey, proposalQuestionTypes, proposalTypeKey, type DocumentFormQuestion,
  type ProposalQuestionType } from "../../documentFormProposal";
import { administrativeName } from "../../editorModel";
import type { CatalogReadScope } from "../../hooks/useCatalogDraftEditor";
import { useCatalogDetail } from "../../hooks/useCatalogQueries";
import { CatalogQuestionSelector } from "../CatalogQuestionSelector";

const optionLimit = (type: ProposalQuestionType) => type === "multiChoice" ? 20 : 50;

/**
 * «Preguntas (N)» of «Armar formulario con la IA» (DOC6): one question per row with one datum per column (its text, its type with its
 * options or its catalog in grey below, what it read in the first document and whether it is required), edited in a dialog and removed
 * from its row; «Agregar pregunta» adds one. A problem of a question (the page's or the server's) goes under its text. Read only once its
 * draft exists.
 */
export function DocumentFormQuestions({ questions, problems, readOnly, catalogScope, onChange }: {
  questions: readonly DocumentFormQuestion[];
  /** The problem of the list and of each question by its position, in words. */
  problems: { readonly list?: string; readonly byQuestion: Readonly<Record<number, string>> };
  readOnly: boolean;
  catalogScope: CatalogReadScope;
  onChange: (questions: readonly DocumentFormQuestion[]) => void;
}) {
  const { t } = useTranslation(["formDocuments", "forms"]);
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const zone = useRef<HTMLDivElement | null>(null);
  const focusAfterRemoving = (key: string | undefined) => setTimeout(() => (zone.current?.querySelector<HTMLElement>(key ? `[data-question-edit="${key}"]` : "[data-question-add]"))?.focus(), 0);
  const remove = (index: number) => {
    const next = questions.filter((_, position) => position !== index);
    onChange(next);
    focusAfterRemoving((next[index] ?? next[index - 1])?.key);
  };
  const detail = (question: DocumentFormQuestion) => isChoiceType(question.type) ? question.options.filter(option => option.trim()).join(", ")
    : question.type === "catalog" ? question.catalog?.name ?? "" : "";
  const columns: Column<DocumentFormQuestion>[] = [
    { id: "question", header: t("forms:question"), cell: question => {
      const problem = problems.byQuestion[questions.indexOf(question)];
      return <div className="min-w-40 max-w-80 whitespace-normal">
        <span className="break-words font-medium [overflow-wrap:anywhere]">{question.label}</span>
        {problem ? <p role="alert" className="text-sm text-[var(--color-danger)]">{problem}</p> : null}
      </div>;
    } },
    // The type, with its options or its catalog in grey below (UD, exception A).
    { id: "type", header: t("formProposal.columns.type"), cell: question => <div className="min-w-36 max-w-72 whitespace-normal">
      <span>{t("forms:" + proposalTypeKey(question.type))}</span>
      {detail(question) ? <span className="block break-words text-[length:var(--text-caption)] text-[var(--color-content-muted)] [overflow-wrap:anywhere]">{detail(question)}</span> : null}
    </div> },
    // What it read in the first document, only when the proposal says so for some question.
    ...questions.some(question => question.sample) ? [{ id: "sample", header: t("formProposal.columns.sample"),
      cell: (question: DocumentFormQuestion) => <div className="min-w-36 max-w-72 whitespace-normal break-words [overflow-wrap:anywhere]">{question.sample ?? <span className="text-[var(--color-content-muted)]">—</span>}</div> }] : [],
    { id: "required", header: t("forms:required"), cell: question => t(question.required ? "yes" : "no") },
    ...readOnly ? [] : [{ id: "actions", header: t("formProposal.columns.actions"), align: "right" as const, cell: (question: DocumentFormQuestion) => {
      const index = questions.indexOf(question);
      return <div className="flex justify-end gap-1">
        <IconButton size="icon-sm" data-question-edit={question.key} label={`${t("forms:edit")} ${question.label}`} onClick={() => setEditing({ index })}><PencilIcon className="size-4" /></IconButton>
        <IconButton size="icon-sm" label={t("forms:remove", { name: question.label })} onClick={() => remove(index)}><TrashIcon className="size-4" /></IconButton>
      </div>;
    } }],
  ];
  const editedIndex = editing?.index ?? null;
  const full = questions.length >= documentFormLimits.questions;
  return <div ref={zone}>
    <Surface title={t("formProposal.questions", { count: questions.length })} actions={readOnly ? undefined
      : <DisabledReason reason={full ? t("forms:questionLimit", { count: documentFormLimits.questions }) : null}>
        <Button type="button" variant="outline" size="sm" data-question-add disabled={full} onClick={() => setEditing({ index: null })}><PlusIcon className="size-4" aria-hidden="true" />{t("forms:addQuestion")}</Button>
      </DisabledReason>}>
      {problems.list ? <p role="alert" className="border-b border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-danger)]">{problems.list}</p> : null}
      <DataTable columns={columns} rows={questions} rowKey={question => question.key} emptyTitle={t("formProposal.noQuestions")} />
    </Surface>
    {editing ? <QuestionDialog key={editedIndex === null ? "new" : questions[editedIndex]?.key} question={editedIndex === null ? null : questions[editedIndex] ?? null}
      catalogScope={catalogScope} onCancel={() => setEditing(null)}
      onDone={question => { onChange(editedIndex === null ? [...questions, question] : questions.map((item, position) => position === editedIndex ? question : item)); setEditing(null); }} /> : null}
  </div>;
}

// A question in a dialog: its text, its type, whether it is required and, by its type, its own options or its catalog. What it read in
// the first document goes on top, to compare. «Listo» keeps it in the page's form; nothing is saved until «Crear borrador».
function QuestionDialog({ question, catalogScope, onCancel, onDone }: { question: DocumentFormQuestion | null; catalogScope: CatalogReadScope; onCancel: () => void;
  onDone: (question: DocumentFormQuestion) => void }) {
  const { t } = useTranslation(["formDocuments", "forms"]);
  const restoreFocus = useRestoreFocusOnClose();
  const [draft, setDraft] = useState<DocumentFormQuestion>(() => question ?? { key: newQuestionKey(), label: "", type: "shortText", required: false, options: [], catalog: null, sample: null });
  const [attempted, setAttempted] = useState(false);
  const fields = useRef<HTMLDivElement | null>(null);
  const optionsId = useId();
  // The name of a catalog chosen here, to show it in the table.
  const chosen = useCatalogDetail(catalogScope, draft.type === "catalog" && draft.catalog && !draft.catalog.name ? draft.catalog.id : "", "global");
  const problems = attempted ? documentFormQuestionProblems(draft) : {};
  const canReadCatalogs = catalogScope.permissions.includes("formcatalogs.read");
  const limit = optionLimit(draft.type);
  const full = isChoiceType(draft.type) && draft.options.length >= limit;
  const done = () => {
    const found = documentFormQuestionProblems(draft);
    if (Object.keys(found).length) {
      setAttempted(true);
      const target = found.label ? "[data-question-control='label']" : found.options ? "[data-question-control='option']" : "[data-question-control='catalog']";
      setTimeout(() => (fields.current?.querySelector<HTMLElement>(target) ?? fields.current?.querySelector<HTMLElement>("button"))?.focus(), 0);
      return;
    }
    const name = draft.catalog && !draft.catalog.name && chosen.data ? administrativeName(chosen.data.name, catalogScope.culture) : draft.catalog?.name ?? "";
    onDone({ ...draft, catalog: draft.type === "catalog" && draft.catalog ? { id: draft.catalog.id, name } : draft.catalog });
  };
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
    <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle>{question ? t("formProposal.editQuestion", { name: question.label }) : t("formProposal.newQuestion")}</DialogTitle></DialogHeader>
      <div ref={fields} className="flex flex-col gap-4">
        {draft.sample ? <DataList items={[{ key: "sample", label: t("formProposal.columns.sample"), value: draft.sample }]} /> : null}
        <FormField label={t("forms:question")} required error={problems.label ? t(problems.label) : undefined}>
          <Input data-question-control="label" maxLength={documentFormLimits.text} value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })} />
        </FormField>
        <FormField label={t("forms:type")}>
          <NativeSelect value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as ProposalQuestionType })}>
            {proposalQuestionTypes.map(type => <option key={type} value={type} disabled={type === "catalog" && !canReadCatalogs && draft.type !== "catalog"}>{t("forms:" + proposalTypeKey(type))}</option>)}
          </NativeSelect>
        </FormField>
        <CheckboxField label={t("forms:required")} checked={draft.required} onCheckedChange={checked => setDraft({ ...draft, required: checked === true })} />
        {isChoiceType(draft.type) ? <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={problems.options ? optionsId : undefined}>
          <legend className="sr-only">{t("formProposal.options")}</legend>
          <span aria-hidden="true" className="text-sm font-medium">{t("formProposal.options")}</span>
          {draft.options.map((option, index) => <div key={index} className="flex items-end gap-2">
            <div className="min-w-0 flex-1"><FormField label={t("forms:option", { number: index + 1 })}>
              <Input data-question-control="option" maxLength={documentFormLimits.text} value={option}
                onChange={event => setDraft({ ...draft, options: draft.options.map((item, position) => position === index ? event.target.value : item) })} />
            </FormField></div>
            <IconButton size="icon-sm" label={t("forms:remove", { name: option.trim() || t("forms:option", { number: index + 1 }) })}
              onClick={() => setDraft({ ...draft, options: draft.options.filter((_, position) => position !== index) })}><TrashIcon className="size-4" /></IconButton>
          </div>)}
          {problems.options ? <p id={optionsId} role="alert" className="text-sm text-[var(--color-danger)]">{t(problems.options)}</p> : null}
          <div><DisabledReason reason={full ? draft.type === "multiChoice" ? t("forms:multiple.optionLimit") : t("forms:optionsLimit", { count: limit }) : null}>
            <Button type="button" variant="outline" disabled={full} data-question-control={draft.options.length ? undefined : "option"}
              onClick={() => setDraft({ ...draft, options: [...draft.options, ""] })}><PlusIcon className="size-4" aria-hidden="true" />{t("forms:addOption")}</Button>
          </DisabledReason></div>
        </fieldset> : null}
        {draft.type === "catalog" ? <CatalogQuestionSelector scope={catalogScope} value={draft.catalog?.id ?? ""} readOnly={false} selectedName={draft.catalog?.name || undefined}
          error={problems.catalogId ? t(problems.catalogId) : undefined} onChange={id => setDraft({ ...draft, catalog: { id, name: id === draft.catalog?.id ? draft.catalog.name : "" } })} /> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={done}>{t("formProposal.done")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
