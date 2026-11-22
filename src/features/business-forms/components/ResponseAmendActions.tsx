import { useTranslation } from "react-i18next";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon } from "@/shared/ui/icons";
import type { ResponseIssuance } from "../issuance";

// With an issuance (NC1-A), «Corregir» is off with why (an issued or live one is voided and loaded again), and while its reversal
// runs («Anulándose») «Corregir» and «Anular» are off, with the reason inside.
const correctReason = (issuance: ResponseIssuance | undefined, t: (key: string) => string) =>
  issuance?.voiding ? t("issuance.voidingReason") : issuance?.live ? t("issuance.notAmendable") : null;

/**
 * «Corregir» in view, because in a form to read and change, changing is the task (VF1-A, decision 4; it replaces AC1-A here): a
 * button with its text in the band of the full page, and the pencil, first of the title's icons, in the quick view. Only for
 * whoever may change the response now: the server says so in `canAmend` and checks it again.
 */
export function ResponseCorrectAction({ onCorrect, disabled, issuance, compact = false }: {
  onCorrect: () => void; disabled?: boolean; issuance?: ResponseIssuance; compact?: boolean;
}) {
  const { t } = useTranslation("forms");
  const reason = correctReason(issuance, t);
  return compact
    ? <IconButton label={t("detail.correct")} disabledLabel={reason ?? undefined} disabled={disabled || !!reason} onClick={onCorrect}><PencilIcon className="size-4"/></IconButton>
    : <DisabledReason reason={reason}><Button type="button" variant="outline" size="sm" disabled={disabled || !!reason} onClick={onCorrect}>
      <PencilIcon className="size-4"/>{t("detail.correct")}</Button></DisabledReason>;
}

/** ⋮ with «Anular» in red (CW11-A), which says «Anular con nota de crédito» once its issuance is issued (NC1-A). */
export function ResponseAmendActions({ onVoid, disabled, issuance }: { onVoid: () => void; disabled?: boolean; issuance?: ResponseIssuance }) {
  const { t } = useTranslation("forms");
  return <ActionsMenu label={t("detail.moreActions")} disabled={disabled} items={[
    { label: t(issuance?.issued ? "issuance.voidWithCreditNote" : "detail.void"), destructive: true, reason: issuance?.voiding ? t("issuance.voidingReason") : null, onSelect: onVoid },
  ]} />;
}
