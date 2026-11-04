import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWhatsAppChat, whatsAppChatQueryKey, type WhatsAppChat } from "../api/whatsappChat";
import { VerifyDestinationDialog } from "./VerifyDestinationDialog";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { AccountRow, AccountRows } from "@/shared/ui/AccountRows";
import { Button } from "@/shared/ui/button";
import { BellIcon, ExternalLinkIcon, LinkIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

/// La zona «Chat de WhatsApp» de `/perfil` (tablero PF1-A; los estados, en PF2). «Verificado» dice que se puede entrar
/// con el número; acá se ve si el chat con el negocio está vinculado a la cuenta y hasta cuándo pueden llegar los avisos,
/// que es lo que faltaba ver cuando los avisos no llegaban.
///
/// - Sin vincular (el número ya escribió): «Vincular» confirma el número de la cuenta con un código, como siempre, y eso
///   vincula su chat. Un mensaje nunca vincula.
/// - Sin chat (el número nunca escribió) y avisos pausados: «Abrir el chat» abre WhatsApp con el número del negocio. Al
///   volver a la pestaña se lee de nuevo, y aparece «Vincular» o los avisos vuelven.
///
/// Se ve sólo con WhatsApp prendido y el número verificado: sin eso no hay chat que vincular.
export function WhatsAppChatCard({ user }: { user: CurrentUser }) {
  const { t, i18n } = useTranslation("profile");
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isLinking, setIsLinking] = useState(false);

  const { data: methods } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    // Si no llegan, no hay nada que mostrar: los medios de ingreso tampoco ofrecen WhatsApp.
    meta: { silent: true },
  });
  const shown = methods?.whatsapp === true && user.phoneNumber !== null && user.phoneNumberConfirmed;

  const chat = useQuery({
    queryKey: whatsAppChatQueryKey,
    queryFn: getWhatsAppChat,
    enabled: shown,
    // Lo que lo cambia pasa afuera de la app (la persona le escribe al negocio desde WhatsApp): al volver a la pestaña
    // siempre se lee de nuevo.
    staleTime: 0,
    // El error se dice en la zona, con Reintentar: un aviso más lo diría dos veces.
    meta: { silent: true },
  });

  if (!shown || methods === undefined || user.phoneNumber === null) {
    return null;
  }

  const phoneNumber = user.phoneNumber;
  const openChat = methods.whatsappNumber === null ? null : (
    <Button asChild variant="outline">
      <a
        href={`https://wa.me/${methods.whatsappNumber}?text=${encodeURIComponent(t("chat.hello"))}`}
        target="_blank"
        rel="noreferrer"
      >
        {t("chat.open")}
        <ExternalLinkIcon className="size-3.5" />
      </a>
    </Button>
  );

  function rows(data: WhatsAppChat) {
    const linked = data.state === "Linked";
    const link =
      data.state === "Linked" ? (
        <VerificationBadge verified>{t("chat.link.linked")}</VerificationBadge>
      ) : (
        <VerificationBadge verified={false}>
          {data.state === "NotLinked" ? t("chat.link.notLinked") : t("chat.link.noChat")}
        </VerificationBadge>
      );
    const linkAction =
      data.state === "NotLinked" ? (
        <Button type="button" variant="outline" onClick={() => setIsLinking(true)}>
          {t("chat.link.action")}
        </Button>
      ) : data.state === "NoChat" ? openChat : null;
    const notices = !linked ? t("chat.notices.none") : data.noticesUntilUtc === null ? (
      <VerificationBadge verified={false}>{t("chat.notices.paused")}</VerificationBadge>
    ) : t("chat.notices.until", { date: formatDateTimeInZone(data.noticesUntilUtc, i18n.language, user.timeZoneId) });

    return (
      <AccountRows>
        <AccountRow icon={LinkIcon} label={t("chat.link.label")} value={link} action={linkAction} />
        <AccountRow
          icon={BellIcon}
          label={
            <>
              {t("chat.notices.label")}
              <InfoTip text={t("chat.notices.help")} label={t("common:actions.moreInfo", { label: t("chat.notices.label") })} />
            </>
          }
          value={notices}
          muted={!linked}
          action={linked && data.noticesUntilUtc === null ? openChat : null}
        />
      </AccountRows>
    );
  }

  return (
    <Surface title={t("sections.chat")} titleRef={titleRef} help={t("chat.help")}>
      {chat.isPending || (chat.isError && chat.isFetching) ? (
        <div aria-hidden="true" className="flex flex-col gap-2 p-4">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : chat.isError ? (
        <div className="flex flex-col items-start gap-3 p-4">
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {t("common:states.loadFailed")}
          </p>
          <Button type="button" variant="outline" onClick={() => void chat.refetch()}>
            {t("common:actions.retry")}
          </Button>
        </div>
      ) : (
        rows(chat.data)
      )}

      {isLinking ? (
        <VerifyDestinationDialog
          channel="whatsapp"
          countries={methods.whatsappCountries}
          initialPhone={phoneNumber}
          copy={{ title: t("chat.link.title"), success: t("chat.link.success") }}
          // Con el chat vinculado, «Vincular» ya no está: el foco va al título de la zona.
          focusFallback={titleRef}
          onClose={() => {
            setIsLinking(false);
            void queryClient.invalidateQueries({ queryKey: whatsAppChatQueryKey });
          }}
        />
      ) : null}
    </Surface>
  );
}
