import { useTranslation } from "react-i18next";
import { MessageCard } from "@/shared/ui/MessageCard";
import { AlertTriangleIcon, CheckIcon, ClockIcon, FormIcon, InfoIcon } from "@/shared/ui/icons";
import { FormReplyValues, type FormReplyDisplayRow } from "./FormReplyValues";

// Internal presentation model. The HTTP adapter must supply only authorized historical data.
export type FormReplyPresentation =
  | { readonly state: "Pending" | "Rejected" | "Unrecognized"; readonly name: string | null }
  | { readonly state: "Completed"; readonly name: string; readonly recordNumber: string;
      readonly values: readonly FormReplyDisplayRow[] | null; readonly valuesRevoked?: boolean; readonly messageRemoved?: boolean };

export function FormReplyCard({ reply, preserveViewport }: {
  reply: FormReplyPresentation; preserveViewport?: (change: () => void) => void;
}) {
  const { t } = useTranslation("whatsapp");
  const name = reply.name ?? t("forms.formLabel");
  const completed = reply.state === "Completed";
  const label = completed ? t("forms.reply.savedName", { name, number: reply.recordNumber }) : t("forms.reply.stateName", { name });
  const StateIcon = reply.state === "Pending" ? ClockIcon : reply.state === "Rejected" ? AlertTriangleIcon : InfoIcon;
  return <div role="group" aria-label={label}>
    <MessageCard icon={<FormIcon className="size-4" />} title={name} description={t("forms.reply.label")}>
      {completed ? <>
        {reply.values !== null ? <FormReplyValues rows={reply.values} preserveViewport={preserveViewport} /> : null}
        <p className="flex items-start gap-2 border-t border-[var(--color-border)] bg-[var(--color-success-50)] px-3 py-2 text-sm text-[var(--color-success-700)]"><CheckIcon className="mt-0.5 size-4 shrink-0" />{t("forms.reply.saved", { number: reply.recordNumber })}</p>
        {reply.values === null ? <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><InfoIcon className="mt-0.5 size-4 shrink-0" />{t(reply.valuesRevoked ? "forms.reply.revoked" : "forms.reply.noPermission")}</p> : null}
        {reply.messageRemoved ? <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><InfoIcon className="mt-0.5 size-4 shrink-0" />{t("forms.reply.messageRemoved")}</p> : null}
      </> : <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><span aria-hidden="true"><StateIcon className="mt-0.5 size-4 shrink-0" /></span>{t(reply.state === "Pending" ? "forms.reply.pending" : reply.state === "Rejected" ? "forms.reply.rejected" : "forms.reply.unrecognized")}</p>}
    </MessageCard>
  </div>;
}
