import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { MessageCard } from "@/shared/ui/MessageCard";
import { AlertTriangleIcon, CheckIcon, ClockIcon, InfoIcon, MapPinIcon } from "@/shared/ui/icons";
import type { ChatFormMetadata } from "../api/formMetadata";

/**
 * W1-A: the location request of a send, a card like the sent form's with the pin and its state in a line, like a reply's: received
 * in green with the tick, waiting with the clock, continued without it with the (i) and expired with the triangle.
 */
export function LocationRequestCard({ form, nowUtc }: { form: ChatFormMetadata; nowUtc?: number }) {
  const { t } = useTranslation("whatsapp");
  // Whether it expired is read once, when the card is drawn; the thread is read again as messages arrive.
  const [now] = useState(() => nowUtc ?? Date.now());
  const location = form.location;
  const state = location && location.state !== "Requested" ? location.state
    : location && Date.parse(location.expiresAtUtc) <= now ? "Expired" : "Requested";
  const Icon = state === "Received" ? CheckIcon : state === "Skipped" ? InfoIcon : state === "Expired" ? AlertTriangleIcon : ClockIcon;
  return <div role="group" aria-label={t("locationRequest.title")}>
    <MessageCard icon={<MapPinIcon className="size-4" />} title={t("locationRequest.title")} description={form.name[form.culture]}>
      <p className={cn("flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm",
        state === "Received" && "bg-[var(--color-success-50)] text-[var(--color-success-700)]")}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t("locationRequest.states." + state)}</p>
    </MessageCard>
  </div>;
}
