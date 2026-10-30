import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDateOnly, formatDateTimeInZone } from "@/shared/lib/dateTime";
import { CheckIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import type { FormEntry, FormEntryQuestion, FormEntrySubmitted } from "../api/entries";
import type { EntryDraft } from "../entryForm";

/**
 * After sending (CW5): what was sent, read from what the person loaded. Whoever only completes forms cannot read the
 * saved response, so the page does not ask for it; the number, state and time come from the send.
 */
export function FormEntrySent({ entry, draft, result, timeZone, actions }: {
  entry: FormEntry; draft: EntryDraft; result: FormEntrySubmitted; timeZone?: string; actions: ReactNode;
}) {
  const { t, i18n } = useTranslation("formEntries");
  const shown = (question: FormEntryQuestion): string => {
    if (question.type === "photo" || question.type === "document") {
      const count = draft.files[question.fieldId]?.length ?? 0;
      return count ? t(question.type === "photo" ? "sent.photos" : "sent.files", { count }) : t("sent.none");
    }
    if (question.type === "choice" || question.type === "multiChoice") {
      const chosen = draft.choices[question.fieldId] ?? [];
      return chosen.length ? chosen.map(option => option.title).join("; ") : t("sent.none");
    }
    const value = draft.values[question.fieldId] ?? "";
    if (!value) return t("sent.none");
    if (question.type === "date") return formatDateOnly(value, i18n.language, "numeric") ?? value;
    if (question.type === "boolean") return t(value === "true" ? "sent.yes" : "sent.no");
    return value;
  };
  return <Surface title={t("sent.title")} actions={actions}>
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--color-border)] px-4 py-3 text-sm">
      <CheckIcon className="size-4 text-[var(--color-brand-700)]"/>
      <span className="font-medium">{t("sent.savedAt", { date: formatDateTimeInZone(result.submittedAtUtc, i18n.language, timeZone) })}</span>
      <span className="text-[var(--color-content-muted)]">{t("sent.version", { name: entry.name, version: entry.versionNumber })}</span>
    </p>
    <dl className="divide-y divide-[var(--color-border)]">
      {entry.questions.map(question => <div key={question.fieldId} className="grid gap-1 px-4 py-2 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
        <dt className="text-[var(--color-content-muted)]">{question.label}</dt>
        <dd className="min-w-0 break-words">{shown(question)}</dd>
      </div>)}
    </dl>
  </Surface>;
}
