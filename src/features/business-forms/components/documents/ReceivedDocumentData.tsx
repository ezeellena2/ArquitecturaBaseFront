import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { Input } from "@/shared/ui/input";
import { Picker } from "@/shared/ui/Picker";
import { Textarea } from "@/shared/ui/textarea";
import type { ReceivedDocumentValue } from "../../api/receivedDocuments";
import { receivedDocumentErrorKey, receivedDocumentFieldId, receivedDocumentShownData, receivedDocumentValueNeedsLook, type ReceivedDocumentDraft,
  type ReceivedDocumentProblem } from "../../receivedDocuments";
import { ReceivedDocumentOptionSearch } from "./ReceivedDocumentOptionSearch";

/** How a datum was read, next to its name: with doubts, not read, or completed by the server from a catalog (DOC3 and DOC5-A). */
function Mark({ value }: { value: ReceivedDocumentValue }) {
  const { t } = useTranslation("formDocuments");
  if (value.mark === "doubtful") return <Badge variant="warning">{t("marks.doubtful")}</Badge>;
  if (value.mark === "notRead") return <Badge variant="outline">{t("marks.notRead")}</Badge>;
  return value.mark === "completed" ? <Badge variant="outline">{t("marks.completed")}</Badge> : null;
}

/**
 * The data read for the document's form, in the form's order (DOC5-A): editable, a control per type, while the document waits for the
 * team; read, in two columns (`DataList`), otherwise. Each datum carries its mark, and what does not pass a fixed validation says so
 * under it until it is changed, as the server's problem when passing it does. A yes or no is chosen with the only piece to choose
 * (DS1-A, 2026-11-22) between Sí and No. A choice too, among its options (its own, or the ones of the catalog its sender sees), also
 * when it was not read, and «Sin respuesta» first leaves it empty; the options of a catalog question that chooses first by a field
 * go together after a line, each with its group in grey under its name, so two alike («San Martín» of two provinces) can be told
 * apart. Its button says the mark of its label («Revisá»),
 * as the label of its `FormField` names it (`labelledBy`). A catalog choice the server does not list is
 * searched (too many options for its sender, `ReceivedDocumentOptionSearch`), or says why it has none (its sender lacks the datum its
 * catalog filters by), which stops passing it only when it is required. After eight data the rest fold under «Ver los N datos más», except
 * the ones that need a look, which stay in sight; «Ver menos datos» folds them again.
 */
export function ReceivedDocumentData({ documentId, person, values, draft, problems, server, edit, disabled, onChange, onConflict }: {
  documentId: string;
  /** Who sent it, as the reason of a choice without options names them. */
  person: string;
  values: readonly ReceivedDocumentValue[];
  draft: ReceivedDocumentDraft;
  problems: Readonly<Record<string, ReceivedDocumentProblem>>;
  server: Readonly<Record<string, string>>;
  edit: boolean;
  disabled: boolean;
  onChange: (fieldId: string, value: string) => void;
  /** A conflict the options of a choice answered: the document can no longer be changed. */
  onConflict: (error: unknown) => void;
}) {
  const { t } = useTranslation("formDocuments");
  const [expanded, setExpanded] = useState(false);
  const { shown, hidden, folds } = receivedDocumentShownData(values, expanded, value => receivedDocumentValueNeedsLook(value) || !!problems[value.fieldId] || !!server[value.fieldId]);
  const more = folds ? (
    <div><Button type="button" variant="link" size="inline" onClick={() => setExpanded(!expanded)}>
      {expanded ? t("data.less") : t("data.more", { count: hidden })}
    </Button></div>
  ) : null;
  // A datum read as it is shown: its text (an option or a yes or no by its name), or «—» when nothing was read.
  const read = (value: ReceivedDocumentValue) => value.text ?? value.value ?? "—";
  if (!edit) return <div className="flex flex-col gap-2">
    <DataList items={shown.map(value => ({ key: value.fieldId, label: value.label,
      value: <span className="inline-flex flex-wrap items-center gap-1.5">{read(value)}<Mark value={value} /></span> }))} />
    {more}
  </div>;
  return <div className="flex flex-col gap-3">
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      {shown.map(value => {
        const id = receivedDocumentFieldId(value.fieldId);
        const typed = draft[value.fieldId] ?? "";
        const original = value.value === null ? "" : value.value;
        const unchanged = value.type === "decimal" ? typed.replace(",", ".") === original : typed === original;
        const problem = problems[value.fieldId];
        const error = server[value.fieldId] || (problem ? t("problems." + problem) : value.mark === "invalid" && unchanged ? t(receivedDocumentErrorKey(value.errorCode)) : undefined);
        // The space keeps the name and the mark apart where the label names a control («Moneda No se leyó»); the gap draws it.
        const label = <span className="inline-flex flex-wrap items-center gap-1.5">{value.label} <Mark value={value} /></span>;
        const unavailable = value.type === "choice" ? value.optionsUnavailable : null;
        // Its sender lacks the datum its catalog filters by: its reason in the place of the list, which passing it stops if it is required.
        if (unavailable?.reason === "missingData") {
          const blocked = !!problem || !!server[value.fieldId];
          return <div key={value.fieldId} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5"><GroupLabel id={id + "-label"}>{value.label}</GroupLabel><Mark value={value} /></div>
            <p id={id} tabIndex={-1} role={blocked ? "alert" : undefined}
              className={"text-sm outline-none " + (blocked ? "text-[var(--color-danger)]" : "text-[var(--color-content-muted)]")}>
              {t("data.missingData", { person, datum: unavailable.datum })}
            </p>
            {server[value.fieldId] ? <p role="alert" className="text-sm text-[var(--color-danger)]">{server[value.fieldId]}</p> : null}
          </div>;
        }
        // The option read stays among the options even if its catalog no longer offers it, so the list says what was read.
        const options = value.options ?? [];
        const listed = typed && !options.some(option => option.id === typed) ? [{ id: typed, text: value.text ?? typed, group: null }, ...options] : options;
        const groups = [...new Set(listed.flatMap(option => option.group === null ? [] : [option.group]))];
        const choices = [null, ...groups].flatMap(group => listed.filter(option => option.group === group)
          .map((option, index) => ({ id: option.id, label: option.text, description: option.group, separated: group !== null && index === 0 })));
        const control = unavailable?.reason === "tooMany"
          ? <ReceivedDocumentOptionSearch id={id} documentId={documentId} fieldId={value.fieldId} label={value.label} value={typed}
            text={typed === original ? value.text : null} disabled={disabled} onChange={next => onChange(value.fieldId, next)} onConflict={onConflict} />
          : value.type === "boolean"
          ? <Picker id={id} label={value.label} labelledBy={id + "-label"} value={typed || null} disabled={disabled} placeholder={t("data.choose")}
            onChange={next => { if (next !== typed) onChange(value.fieldId, next); }}
            options={(["true", "false"] as const).map(option => ({ id: option, label: t(option === "true" ? "yes" : "no") }))} />
          : value.type === "choice"
          ? <Picker id={id} label={value.label} labelledBy={id + "-label"} value={typed} disabled={disabled} placeholder={t("data.choose")}
            first={{ id: "", label: t("data.none") }} onChange={next => onChange(value.fieldId, next)} options={choices} />
          : value.type === "longText"
            ? <Textarea id={id} rows={3} value={typed} disabled={disabled} onChange={event => onChange(value.fieldId, event.target.value)} />
            : <Input id={id} value={typed} disabled={disabled} type={value.type === "date" ? "date" : "text"} inputMode={value.type === "decimal" ? "decimal" : undefined}
              className={value.type === "decimal" ? "text-right" : undefined} onChange={event => onChange(value.fieldId, event.target.value)} />;
        return <div key={value.fieldId} className={value.type === "longText" ? "sm:col-span-2" : undefined}>
          <FormField label={label} required={value.required} error={error}>{control}</FormField>
        </div>;
      })}
    </div>
    {more}
  </div>;
}
