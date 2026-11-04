import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/shared/ui/notifications";
import { LoginMethodsCard } from "../components/LoginMethodsCard";
import { WhatsAppChatCard } from "../components/WhatsAppChatCard";
import { Surface } from "@/shared/ui/Surface";
import { currentUserQueryKey, useCurrentUser, type CurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { displayNameMaxLength } from "@/shared/api/accountRules";
import { updateProfile } from "@/shared/api/profile";
import { isSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";

interface Draft {
  displayName: string;
  culture: SupportedLanguage;
  timeZoneId: string;
}

/// Las zonas van una debajo de la otra, a todo el ancho, como en Configuración (tablero PF1-A): los datos, los medios de
/// ingreso y el chat de WhatsApp.
const zonesClassName = "flex flex-col gap-4";

/// Los desplegables son `<select>` nativos y no el `Select` de shadcn: la lista de zonas horarias pasa las
/// cuatrocientas opciones, y el nativo trae gratis la búsqueda por teclado del sistema operativo y el
/// selector de rueda del teléfono, que es lo que hace usable una lista así. `NativeSelect` comparte los
/// tokens de los otros controles del sistema visual.

/// Las zonas que conoce el navegador (ya vienen ordenadas), más la que tiene guardada el perfil si no está
/// entre ellas. `Intl.supportedValuesOf` devuelve los nombres canónicos de IANA y el backend puede tener
/// guardado un alias: el seed usa `America/Argentina/Buenos_Aires`, que el navegador llama
/// `America/Buenos_Aires`. Sin este agregado, el desplegable arrancaría sin ninguna opción elegida y guardar
/// le cambiaría la zona horaria a la persona sin que lo haya pedido.
function timeZoneOptions(current: string | undefined): string[] {
  const zones = Intl.supportedValuesOf("timeZone");

  return current && !zones.includes(current) ? [current, ...zones].sort() : zones;
}

function draftOf(user: CurrentUser): Draft {
  return {
    displayName: user.displayName ?? "",
    // Si la cuenta tuviera un idioma que el front no sabe hablar, el desplegable no lo podría mostrar.
    culture: isSupportedLanguage(user.culture) ? user.culture : "es",
    timeZoneId: user.timeZoneId,
  };
}

/// Guardar se apaga sin cambios, como en el resto de la app: lo que se compara es lo que viajaría en el PUT.
function hasChanges(draft: Draft, user: CurrentUser): boolean {
  const saved = draftOf(user);

  return (draft.displayName.trim() || null) !== (user.displayName ?? null)
    || draft.culture !== saved.culture
    || draft.timeZoneId !== saved.timeZoneId;
}

/// `/perfil` (sección 9 del spec de la Fase 4): nombre, idioma y zona horaria de la propia cuenta. No pide
/// permiso, solo sesión: cualquiera edita el suyo. Se entra desde "Mi perfil", en el menú del usuario.
///
/// Se arma como Configuración (tablero PF1-A, elegido el 2026-11-03): tres zonas, una debajo de la otra. «Datos del
/// perfil» es este formulario; «Medios de ingreso» (`LoginMethodsCard`) dice con qué entra la cuenta y su último ingreso;
/// «Chat de WhatsApp» (`WhatsAppChatCard`), si el chat del número está vinculado y si llegan los avisos.
export function ProfilePage() {
  const { t } = useTranslation("profile");
  const { data: user, isPending } = useCurrentUser();
  const queryClient = useQueryClient();
  const formId = useId();

  const [draft, setDraft] = useState<Draft | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const [loadedCulture, setLoadedCulture] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: (values: Draft) =>
      updateProfile({
        displayName: values.displayName.trim() || null,
        culture: values.culture,
        timeZoneId: values.timeZoneId,
      }),
    onSuccess: async () => {
      notify({ id: "features/profile/pages/ProfilePage:1", kind: "success", message: t("feedback.saved") });
      // El perfil lo usa medio front (el menú, la barra lateral, las fechas de los listados). Y si cambió el
      // idioma, es esta consulta la que lo aplica: `useProfileLanguageSync` mira el `culture` que llegue acá.
      // Por eso la pantalla no toca i18next por su cuenta: el idioma de la cuenta se aplica en un solo lugar.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: (error) => {
      const feedback = errorFeedback(error, { fields: ["displayName", "culture", "timeZoneId"] });
      if (feedback.kind !== "fields" && feedback.kind !== "cancelled") notify({ id: "profile:save:error", kind: "error", message: operationalErrorMessage(error, t) });
    },
  });

  // Los valores del formulario salen del perfil, y se ajustan durante el render en vez de copiarlos con un
  // efecto. Mientras el id no cambie no se vuelven a pisar: lo que esté escrito a medias es de la persona
  // (mismo criterio que `UserEditDialog`).
  if (user && loadedUserId !== user.id) {
    setLoadedUserId(user.id);
    setLoadedCulture(user.culture);
    setDraft(draftOf(user));
  } else if (user && draft && loadedCulture !== user.culture) {
    // El idioma de la cuenta cambió desde afuera de esta pantalla (el menú del usuario, que lo guarda de una).
    // El desplegable tiene que seguirlo: si no, queda contradiciendo a la interfaz y el primer Guardar manda
    // el idioma viejo, que el PUT reemplaza, y devuelve la cuenta al idioma anterior. Se toca solo `culture`,
    // para no pisar el nombre a medio escribir.
    setLoadedCulture(user.culture);
    setDraft({ ...draft, culture: isSupportedLanguage(user.culture) ? user.culture : "es" });
  }

  // La lista no cambia mientras la pantalla está abierta: sin el memo se volvería a armar en cada tecla que
  // se escribe en el nombre.
  const timeZones = useMemo(() => timeZoneOptions(user?.timeZoneId), [user?.timeZoneId]);

  if (!user || !draft) {
    return (
      <Page title={t("title")}>
        {/* Mientras el perfil no llegó, las zonas ocupan su lugar. Si `/api/me` falló no hay nada que editar: de ese
            error se ocupa el aviso global del queryClient, igual que en el tablero. */}
        {isPending ? (
          <div className={zonesClassName}>
            <Surface padded>
              <Skeleton aria-hidden="true" className="h-14" />
            </Surface>
            <Surface padded>
              <Skeleton aria-hidden="true" className="h-14" />
              <Skeleton aria-hidden="true" className="h-14" />
            </Surface>
          </div>
        ) : null}
      </Page>
    );
  }

  const apiError = mutation.error instanceof ApiError ? mutation.error : undefined;
  const fieldErrors = apiError?.errors;

  return (
    <Page title={t("title")}>
      <div className={zonesClassName}>
        {/* Guardar actúa sobre toda la zona: va en su banda, a la altura del título, y envía el formulario por su id,
            como en el editor de roles. */}
        <Surface
          title={t("sections.details")}
          actions={
            <Button type="submit" form={formId} disabled={!hasChanges(draft, user)} pending={mutation.isPending}>
              {mutation.isPending ? t("form.saving") : t("form.submit")}
            </Button>
          }
        >
          <form
            id={formId}
            noValidate
            className="flex flex-wrap gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(draft);
            }}
          >
            {/* Del ancho de lo que llevan, como en Configuración: el idioma y la zona horaria miden lo mismo allá. En el
                celular, todo el ancho. */}
            <div className="w-full sm:w-80">
              <FormField label={t("form.displayName")} error={fieldErrors?.displayName?.[0]}>
                <Input
                  type="text"
                  autoComplete="name"
                  maxLength={displayNameMaxLength}
                  value={draft.displayName}
                  onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
                />
              </FormField>
            </div>

            <div className="w-full sm:w-72">
              <FormField label={t("form.language")} error={fieldErrors?.culture?.[0]}>
                <NativeSelect
                  value={draft.culture}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (isSupportedLanguage(value)) {
                      setDraft({ ...draft, culture: value });
                    }
                  }}
                >
                  {supportedLanguages.map((language) => (
                    <option key={language} value={language}>
                      {t(`common:language.${language}`)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            {/* Los nombres de las zonas no se traducen: son identificadores de IANA, los mismos que guarda el backend, y
                son la forma en que la gente las busca ("Montevideo", "Madrid"). Se leen con espacios en vez de guiones
                bajos, como en Configuración; el valor que viaja no cambia. */}
            <div className="w-full sm:w-96">
              <FormField label={t("form.timeZone")} error={fieldErrors?.timeZoneId?.[0]}>
                <NativeSelect
                  value={draft.timeZoneId}
                  onChange={(event) => setDraft({ ...draft, timeZoneId: event.target.value })}
                >
                  {timeZones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          </form>
        </Surface>

        <LoginMethodsCard user={user} />

        <WhatsAppChatCard user={user} />
      </div>
    </Page>
  );
}
