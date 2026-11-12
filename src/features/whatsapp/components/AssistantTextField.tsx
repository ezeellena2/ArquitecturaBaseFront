import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import type { AgentCulture } from "../api/assistantAgent";
import { originalReference, type DraftTexts } from "../lib/assistantAgentDraft";

/**
 * A text that goes out as written (the message when handing off, an exact text, a question): one field in the language of the
 * menu, as the forms since 2026-10-23. In the agent's original language it is the required original; in the other one, the
 * optional translation, empty with «Sin traducir» and the original as the datum under the field, never copied.
 */
export function AssistantTextField({ id, label, help, value, onChange, culture, original, error, maxLength, placeholder, multiline = false, disabled = false }: {
  id: string; label: string; help?: string; value: DraftTexts; onChange: (value: DraftTexts) => void; culture: AgentCulture; original: AgentCulture;
  error?: string; maxLength: number; placeholder: string; multiline?: boolean; disabled?: boolean;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const reference = originalReference(value, culture, original);
  const props = { id, value: value[culture], maxLength, disabled, placeholder: culture !== original ? t("untranslated") : placeholder,
    onChange: (event: { target: { value: string } }) => onChange({ ...value, [culture]: event.target.value }) };
  return <FormField label={label} help={help} required={culture === original} error={error}
    hint={reference ? t("originalText", { language: t("cultures." + original), text: reference }) : undefined}>
    {multiline ? <Textarea {...props} rows={2} /> : <Input {...props} />}
  </FormField>;
}
