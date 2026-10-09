import type { TFunction } from "i18next";
import type { AccessEventKind, MessagePurpose } from "../api/chat";

const accessKinds: readonly AccessEventKind[] = ["SignInCode", "VerifyPhoneCode", "Invitation", "AccessRequested", "AccessInstructions"];

// Metadata owns the classification. Text, phone numbers and button titles never decide purpose.
export function accessSummary(t: TFunction<"whatsapp">, kind: AccessEventKind | null | undefined): string {
  return t(kind && accessKinds.includes(kind) ? `access.${kind}` : "access.Unknown");
}

export function previewText(t: TFunction<"whatsapp">, purpose: MessagePurpose | undefined,
  kind: AccessEventKind | null | undefined, body: string | null): string {
  return purpose === "Access" ? accessSummary(t, kind) : body ?? t("textRemoved");
}
