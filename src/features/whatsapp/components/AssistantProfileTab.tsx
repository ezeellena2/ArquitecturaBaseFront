import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import type { AgentCulture } from "../api/assistantAgent";
import { agentLimits, type DraftProfile, type ProfileField } from "../lib/assistantAgentDraft";
import { profileFieldId } from "./assistantAgentParts";
import { AssistantTextField } from "./AssistantTextField";

/** Perfil (AS1-A): who the assistant is and what it says when it hands off. Each help, in the (i) of its label. */
export function AssistantProfileTab({ profile, errors, culture, original, locked, onChange }: {
  profile: DraftProfile; errors: Readonly<Record<string, string>>; culture: AgentCulture; original: AgentCulture; locked: boolean;
  onChange: <K extends keyof DraftProfile>(field: K, value: DraftProfile[K]) => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const field = (name: ProfileField, multiline = false, help = false) => {
    const props = { id: profileFieldId(name), value: profile[name], maxLength: agentLimits[name], disabled: locked, placeholder: t(`profile.${name}Placeholder`),
      onChange: (event: { target: { value: string } }) => onChange(name, event.target.value) };
    return <FormField label={t(`profile.${name}`)} help={help ? t(`profile.${name}Help`) : undefined} required={name === "name"} error={errors["profile." + name]}>
      {multiline ? <Textarea {...props} rows={2} /> : <Input {...props} />}
    </FormField>;
  };
  return <Surface title={t("profile.title")} padded>
    <div className="grid gap-4 sm:grid-cols-2">{field("name", false, true)}{field("tone", false, true)}</div>
    {field("introduction", true, true)}
    <div className="grid gap-4 sm:grid-cols-2">{field("does", true)}{field("doesNot", true)}</div>
    <AssistantTextField id={profileFieldId("handoffMessage")} label={t("profile.handoffMessage")} help={t("profile.handoffMessageHelp")} value={profile.handoffMessage}
      onChange={value => onChange("handoffMessage", value)} culture={culture} original={original} error={errors["profile.handoffMessage"]}
      maxLength={agentLimits.handoffMessage} placeholder={t("profile.handoffMessagePlaceholder")} multiline disabled={locked} />
  </Surface>;
}
