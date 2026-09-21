import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { currentUserQueryKey, useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { updateProfile } from "@/shared/api/profile";
import { isSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Skeleton } from "@/shared/ui/skeleton";

interface Draft {
  displayName: string;
  culture: SupportedLanguage;
  timeZoneId: string;
}

/// Los desplegables son `<select>` nativos y no el `Select` de shadcn: la lista de zonas horarias pasa las
/// cuatrocientas opciones, y el nativo trae gratis la búsqueda por teclado del sistema operativo y el
/// selector de rueda del teléfono, que es lo que hace usable una lista así. Las clases son las del `Input`
/// (`shared/ui/input.tsx`) para que los dos controles del formulario se vean igual.
const selectClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40";

/// Las zonas que conoce el navegador (ya vienen ordenadas), más la que tiene guardada el perfil si no está
/// entre ellas. `Intl.supportedValuesOf` devuelve los nombres canónicos de IANA y el backend puede tener
/// guardado un alias: el seed usa `America/Argentina/Buenos_Aires`, que el navegador llama
/// `America/Buenos_Aires`. Sin este agregado, el desplegable arrancaría sin ninguna opción elegida y guardar
/// le cambiaría la zona horaria a la persona sin que lo haya pedido.
function timeZoneOptions(current: string | undefined): string[] {
  const zones = Intl.supportedValuesOf("timeZone");

  return current && !zones.includes(current) ? [current, ...zones].sort() : zones;
}

/// `/perfil` (sección 9 del spec de la Fase 4): nombre, idioma y zona horaria de la propia cuenta. No pide
/// permiso, solo sesión: cualquiera edita el suyo. Se entra desde "Mi perfil", en el menú del usuario.
export function ProfilePage() {
  const { t, i18n } = useTranslation("profile");
  const { data: user, isPending } = useCurrentUser();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: (values: Draft) =>
      updateProfile({
        displayName: values.displayName.trim() || null,
        culture: values.culture,
        timeZoneId: values.timeZoneId,
      }),
    onSuccess: async () => {
      toast.success(t("feedback.saved"));
      // El perfil lo usa medio front (el menú, la barra lateral, las fechas de los listados). Y si cambió el
      // idioma, es esta consulta la que lo aplica: `useProfileLanguageSync` mira el `culture` que llegue acá.
      // Por eso la pantalla no toca i18next por su cuenta: el idioma de la cuenta se aplica en un solo lugar.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });

  // Los valores del formulario salen del perfil, y se ajustan durante el render en vez de copiarlos con un
  // efecto. Mientras el id no cambie no se vuelven a pisar: lo que esté escrito a medias es de la persona
  // (mismo criterio que `UserRolesDialog`).
  if (user && loadedUserId !== user.id) {
    setLoadedUserId(user.id);
    setDraft({
      displayName: user.displayName ?? "",
      // Si la cuenta tuviera un idioma que el front no sabe hablar, el desplegable no lo podría mostrar.
      culture: isSupportedLanguage(user.culture) ? user.culture : "es",
      timeZoneId: user.timeZoneId,
    });
  }

  // La lista no cambia mientras la pantalla está abierta: sin el memo se volvería a armar en cada tecla que
  // se escribe en el nombre.
  const timeZones = useMemo(() => timeZoneOptions(user?.timeZoneId), [user?.timeZoneId]);

  if (!user || !draft) {
    return (
      <div>
        <PageHeader title={t("title")} description={t("description")} />
        {/* Mientras el perfil no llegó, el formulario ocupa su lugar. Si `/api/me` falló no hay nada que
            editar: de ese error se ocupa el aviso global del queryClient, igual que en el tablero. */}
        {isPending ? (
          <div className="flex max-w-lg flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <Skeleton aria-hidden="true" className="h-14" />
            <Skeleton aria-hidden="true" className="h-14" />
            <Skeleton aria-hidden="true" className="h-14" />
          </div>
        ) : null}
      </div>
    );
  }

  const apiError = mutation.error instanceof ApiError ? mutation.error : undefined;
  const fieldErrors = apiError?.errors;
  // Lo que el backend no le atribuyó a ningún campo va arriba del botón; lo que sí, debajo de su campo.
  const formError =
    mutation.isError && !fieldErrors
      ? apiError?.isNetworkError
        ? t("common:errors.network")
        : (apiError?.detail ?? t("common:states.error"))
      : undefined;

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <form
        noValidate
        className="flex max-w-lg flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(draft);
        }}
      >
        {/* El correo es la identidad de la cuenta: se muestra, no se edita. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-[var(--color-content)]">{t("form.email")}</p>
          <p className="text-sm text-[var(--color-content)]">{user.email}</p>
          <p className="text-sm text-[var(--color-content-muted)]">{t("form.emailHint")}</p>
        </div>

        {/* El último ingreso tampoco se edita: es lo que el sistema registró. Llega en UTC y se muestra en la
            zona horaria del perfil, igual que las fechas del listado de usuarios. Va acá y no en el tablero,
            que va vacío a propósito: es un dato de la cuenta, y la cuenta se mira en su pantalla. */}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-[var(--color-content)]">{t("form.lastLogin")}</p>
          <p className="text-sm text-[var(--color-content)]">
            {user.lastLoginAtUtc
              ? formatDateTimeInZone(user.lastLoginAtUtc, i18n.language, user.timeZoneId)
              : t("form.lastLoginNever")}
          </p>
        </div>

        <FormField
          label={t("form.displayName")}
          hint={t("form.displayNameHint")}
          error={fieldErrors?.displayName?.[0]}
        >
          <Input
            type="text"
            autoComplete="name"
            value={draft.displayName}
            onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
          />
        </FormField>

        <FormField label={t("form.language")} hint={t("form.languageHint")} error={fieldErrors?.culture?.[0]}>
          <select
            className={selectClassName}
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
          </select>
        </FormField>

        {/* Los nombres de las zonas no se traducen: son identificadores de IANA, los mismos que guarda el
            backend, y son la forma en que la gente las busca ("Montevideo", "Madrid"). */}
        <FormField label={t("form.timeZone")} hint={t("form.timeZoneHint")} error={fieldErrors?.timeZoneId?.[0]}>
          <select
            className={selectClassName}
            value={draft.timeZoneId}
            onChange={(event) => setDraft({ ...draft, timeZoneId: event.target.value })}
          >
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </FormField>

        {formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {formError}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={mutation.isPending}>
            {t("form.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
