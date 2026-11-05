import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Textarea } from "@/shared/ui/textarea";
import { correctionReasonId, type useEntryCorrectionEditor } from "../hooks/useEntryCorrectionEditor";
import { EntryRecordContext } from "../hooks/useFormEntry";
import { FormEntryForm } from "./FormEntryForm";

/**
 * What a correction shows (CW10-A): the questions as they were, «Antes: …» under what changed and, after a line, the
 * required reason. The catalog lists are those of whoever answered the response.
 */
export function EntryCorrectionFields({ correction, recordId, layout }: {
  correction: ReturnType<typeof useEntryCorrectionEditor>; recordId: string; layout: "page" | "panel";
}) {
  const { t } = useTranslation("formEntries");
  const { editor } = correction;
  const entry = correction.correction?.entry;
  if (!entry || !editor.draft) return null;
  return <div className="flex flex-col gap-4">
    <EntryRecordContext.Provider value={recordId}>
      <FormEntryForm entry={entry} draft={editor.draft} onChange={editor.change} errors={editor.errors} layout={layout} disabled={editor.sending}
        reveal={editor.reveal} before={correction.before}/>
    </EntryRecordContext.Provider>
    <div className="border-t border-[var(--color-border)] pt-4">
      <FormField label={t("correction.reason")} htmlFor={correctionReasonId(recordId)} required error={correction.reasonError ?? undefined}>
        <Textarea id={correctionReasonId(recordId)} value={correction.reason} rows={2} maxLength={500} disabled={editor.sending}
          onChange={event => correction.setReason(event.target.value)}/>
      </FormField>
    </div>
  </div>;
}
