import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { localizedValue } from "../editorModel";
import { assignReceives, canReceive, locationContactKinds, questionName, receivesOf } from "../locationContact";
import type { DraftEditorValue, DraftQuestion, FormCulture, FormQuestionReceives } from "../model";
import { questionNumbers } from "../rowsQuestions";

const muted = "text-[var(--color-content-muted)]";

/**
 * «Ubicación y contacto» (W3, UC1-A), after «Preguntas» and «Lectura de documentos»: which text question receives the location or
 * the contact the person shares in the chat while the form is open, one row per datum with its label above (IA1-A). It is saved with
 * the draft, on the question. With a question «Ubicación» the location goes there (W1-A): its row stays in place, off, with the reason
 * over it (MA1-A). Read only (the form cannot be edited), each row says its question or «Ninguna», as the board draws it; while the
 * draft saves or waits for a review (`disabled`) the lists stay, off, so nothing changes place.
 */
export function FormLocationContactZone({ value, onChange, readOnly, disabled = false, culture }: {
  value: DraftEditorValue; onChange: (value: DraftEditorValue) => void; readOnly: boolean; disabled?: boolean; culture: FormCulture;
}) {
  const { t } = useTranslation("forms");
  const phone = useMediaQuery("(max-width: 639px)");
  const fields = value.draft.fields;
  const numbers = questionNumbers(fields);
  const label = (question: DraftQuestion) => localizedValue(question.label, culture, value.draft.culture);
  const number = (question: DraftQuestion) => numbers[fields.indexOf(question)]!;
  // Like every list of questions of the editor: its text and its number, so two with the same text are told apart; without a text yet,
  // «Pregunta 6».
  const name = (question: DraftQuestion) => { const { key, values } = questionName(label(question), number(question)); return t(key, values); };
  const located = fields.find(question => question.type === "location");
  const locatedReason = located ? label(located).trim() ? t("locationContact.locationQuestion", { question: label(located) })
    : t("locationContact.locationQuestionNumber", { number: number(located) }) : null;
  const owner = (kind: FormQuestionReceives) => kind === "location" && located ? located : fields.find(question => receivesOf(question) === kind);
  const rowLabel = (kind: FormQuestionReceives) => t("locationContact.rows." + kind);
  const zone = { title: t("locationContact.title"), help: t("locationContact.help") };
  if (readOnly) return <Surface {...zone}><dl className="flex flex-col divide-y divide-[var(--color-border)]">{locationContactKinds.map(kind => {
    const question = owner(kind);
    return <div key={kind} className="flex flex-col gap-1.5 p-4"><Label asChild><dt>{rowLabel(kind)}</dt></Label>
      <dd className={question ? "text-sm" : "text-sm " + muted}>{question ? name(question) : t("locationContact.none")}</dd></div>;
  })}</dl></Surface>;
  // The texts outside the block and without a condition: WhatsApp does not prefill a question that shows by a condition.
  const candidates = fields.filter(canReceive);
  const size = phone ? "touch" : "default";
  return <Surface {...zone}><div className="flex flex-col divide-y divide-[var(--color-border)]">{locationContactKinds.map(kind => <div key={kind} className="p-4">
    <FormField label={rowLabel(kind)}>{kind === "location" && located
      ? <DisabledReason reason={locatedReason} className="grid w-full sm:w-80">
        <NativeSelect size={size} className="sm:w-80" disabled value={located.localId}><option value={located.localId}>{name(located)}</option></NativeSelect>
      </DisabledReason>
      : <NativeSelect size={size} className="sm:w-80" disabled={disabled} value={owner(kind)?.localId ?? ""} onChange={event => onChange(assignReceives(value, kind, event.target.value || null))}>
        <option value="">{t("locationContact.none")}</option>
        {candidates.map(question => {
          // Taken by another row: off, saying what it receives.
          const other = receivesOf(question), taken = other !== null && other !== kind;
          return <option key={question.localId} value={question.localId} disabled={taken}>{taken ? t("locationContact.taken." + other, { option: name(question) }) : name(question)}</option>;
        })}
      </NativeSelect>}</FormField>
  </div>)}</div></Surface>;
}
