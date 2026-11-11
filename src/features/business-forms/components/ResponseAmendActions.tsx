import { useTranslation } from "react-i18next";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";
import { PencilIcon } from "@/shared/ui/icons";

/**
 * ⋮ with «Corregir» (with the pencil) and, after a line, «Anular» in red (AC1-A, 2026-11-11; before, «Corregir» went in
 * view: CW10-A). Only for whoever may change the response now: the server says so in `canAmend` and checks it again.
 */
export function ResponseAmendActions({ onCorrect, onVoid, disabled }: { onCorrect: () => void; onVoid: () => void; disabled?: boolean }) {
  const { t } = useTranslation("forms");
  return <ActionsMenu label={t("detail.moreActions")} disabled={disabled} items={[
    { label: t("detail.correct"), icon: PencilIcon, onSelect: onCorrect },
    { label: t("detail.void"), destructive: true, onSelect: onVoid },
  ]} />;
}
