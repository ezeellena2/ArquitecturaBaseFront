import { useTranslation } from "react-i18next";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";
import { PencilIcon } from "@/shared/ui/icons";
import type { ResponseIssuance } from "../issuance";

/**
 * ⋮ with «Corregir» (with the pencil) and, after a line, «Anular» in red (AC1-A, 2026-11-11; before, «Corregir» went in
 * view: CW10-A). Only for whoever may change the response now: the server says so in `canAmend` and checks it again.
 * With an issuance (NC1-A), «Anular» says «Anular con nota de crédito» once it is issued, «Corregir» is off with why (an issued
 * or live one is voided and loaded again), and while its reversal runs («Anulándose») both are off, with the reason inside.
 */
export function ResponseAmendActions({ onCorrect, onVoid, disabled, issuance }: { onCorrect: () => void; onVoid: () => void; disabled?: boolean; issuance?: ResponseIssuance }) {
  const { t } = useTranslation("forms");
  const voiding = issuance?.voiding ? t("issuance.voidingReason") : null;
  return <ActionsMenu label={t("detail.moreActions")} disabled={disabled} items={[
    { label: t("detail.correct"), icon: PencilIcon, reason: voiding ?? (issuance?.live ? t("issuance.notAmendable") : null), onSelect: onCorrect },
    { label: t(issuance?.issued ? "issuance.voidWithCreditNote" : "detail.void"), destructive: true, reason: voiding, onSelect: onVoid },
  ]} />;
}
