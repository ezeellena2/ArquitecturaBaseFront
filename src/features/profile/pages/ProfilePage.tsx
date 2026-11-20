import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { LoginMethodsCard } from "../components/LoginMethodsCard";
import { WhatsAppChatCard } from "../components/WhatsAppChatCard";
import { Surface } from "@/shared/ui/Surface";
import { currentUserQueryKey, fetchCurrentUser, useCurrentUser, type CurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { displayNameMaxLength } from "@/shared/api/accountRules";
import { updateProfile, type UpdateProfileBody } from "@/shared/api/profile";
import { isSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Skeleton } from "@/shared/ui/skeleton";
import { timeZoneCity, timeZoneOptions } from "@/shared/lib/timeZones";

interface Draft {
  displayName: string;
  culture: SupportedLanguage;
  timeZoneId: string;
}

/// Las zonas van una debajo de la otra, a todo el ancho, como en Configuración (tablero PF1-A): los datos, los medios de
/// ingreso y el chat de WhatsApp.
const zonesClassName = "flex flex-col gap-4";

/// Lo que el PUT reemplaza tal como estaba guardado cuando se sembró el borrador, con su revisión (N2). Guardar manda esa
/// revisión, y lo que el borrador cambió se mide contra esto.
interface Baseline {
  displayName: string | null;
  culture: string;
  timeZoneId: string;
  revision: number;
}

/// An account in a language the front cannot speak: the language control could not show it.
function cultureOf(culture: string): SupportedLanguage {
  return isSupportedLanguage(culture) ? culture : "es";
}

function draftOf(user: CurrentUser): Draft {
  return { displayName: user.displayName ?? "", culture: cultureOf(user.culture), timeZoneId: user.timeZoneId };
}

function baselineOf(user: CurrentUser): Baseline {
  return { displayName: user.displayName, culture: user.culture, timeZoneId: user.timeZoneId, revision: user.revision };
}

/// El nombre como viaja: vacío es null.
function sentName(draft: Draft): string | null {
  return draft.displayName.trim() || null;
}

/// Conservar mis cambios tras un conflicto de revisión (N2): de lo guardado ahora, con lo que el borrador cambió desde lo
/// sembrado.
function keepDraftChanges(draft: Draft, baseline: Baseline, current: Draft): Draft {
  return {
    displayName: sentName(draft) === baseline.displayName ? current.displayName : draft.displayName,
    culture: draft.culture === cultureOf(baseline.culture) ? current.culture : draft.culture,
    timeZoneId: draft.timeZoneId === baseline.timeZoneId ? current.timeZoneId : draft.timeZoneId,
  };
}

/// Guardar se apaga sin cambios, como en el resto de la app: lo que se compara es lo que viajaría en el PUT.
function hasChanges(draft: Draft, saved: Baseline): boolean {
  return sentName(draft) !== saved.displayName
    || draft.culture !== cultureOf(saved.culture)
    || draft.timeZoneId !== saved.timeZoneId;
}

/// La comparación de un conflicto de revisión (N2), como la de Configuración (`SettingsReview`): sólo lo que difiere
/// entre lo guardado y lo que quedaría al conservar mis cambios (`kept`), lado a lado (LR2-A), y las dos elecciones a la
/// altura de su título.
function ProfileReview({ current, kept, disabled, titleRef, onAccept }: {
  current: CurrentUser;
  kept: Draft;
  disabled: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onAccept: (keepDraft: boolean) => void;
}) {
  const { t } = useTranslation("profile");
  const saved = draftOf(current);
  const text = (value: string) => <CellText text={value === "" ? "—" : value} />;
  const groups = [
    ...(current.displayName === sentName(kept) ? [] : [{ key: "displayName", identity: [t("form.displayName")],
      lines: [{ key: "value", before: text(current.displayName ?? ""), after: text(kept.displayName.trim()) }] }]),
    ...(saved.culture === kept.culture ? [] : [{ key: "culture", identity: [t("form.language")],
      lines: [{ key: "value", before: text(t(`common:language.${saved.culture}`)), after: text(t(`common:language.${kept.culture}`)) }] }]),
    ...(saved.timeZoneId === kept.timeZoneId ? [] : [{ key: "timeZoneId", identity: [t("form.timeZone")],
      // The zone is named as in its list, by its city (DS1-A).
      lines: [{ key: "value", before: text(timeZoneCity(saved.timeZoneId)), after: text(timeZoneCity(kept.timeZoneId)) }] }]),
  ];

  return (
    <Surface title={t("common:revisionReview.title")} titleRef={titleRef} padded actions={<>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("common:revisionReview.useCurrent")}</Button>
      <Button type="button" disabled={disabled} onClick={() => onAccept(true)}>{t("common:revisionReview.keepMine")}</Button>
    </>}>
      <ComparisonTable columns={{ identity: [{ key: "field", header: t("common:revisionReview.field") }], before: t("common:revisionReview.current"), after: t("common:revisionReview.mine") }} groups={groups} />
    </Surface>
  );
}

/// `/perfil` (sección 9 del spec de la Fase 4): nombre, idioma y zona horaria de la propia cuenta. No pide
/// permiso, solo sesión: cualquiera edita el suyo. Se entra desde "Mi perfil", en el menú del usuario.
///
/// Se arma como Configuración (tablero PF1-A, elegido el 2026-11-03): tres zonas, una debajo de la otra. «Datos del
/// perfil» es este formulario; «Medios de ingreso» (`LoginMethodsCard`) dice con qué entra la cuenta y su último ingreso;
/// «Chat de WhatsApp» (`WhatsAppChatCard`), si el chat del número está vinculado y si llegan los avisos.
export function ProfilePage() {
  const { t, i18n } = useTranslation("profile");
  const { data: user, isPending } = useCurrentUser();
  const queryClient = useQueryClient();
  const formId = useId();

  const [draft, setDraft] = useState<Draft | undefined>();
  const [baseline, setBaseline] = useState<Baseline | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  // Un 409 de revisión (N2) conserva el borrador y pide releer antes de volver a guardar, como Configuración.
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<CurrentUser | undefined>();
  const [reading, setReading] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const reviewNoticeId = "profile:review";
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(reviewNoticeId); }; }, []);
  // La comparación aparece debajo de los datos, a veces fuera de la vista: cada lectura lleva el foco a su título.
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);

  /// Guarda (N2). Ante un 409 de revisión relee el perfil: si el nombre sigue como en la base (lo único del PUT que avanza
  /// la revisión; el idioma y la zona no), lo que la avanzó no es nada que el borrador pise (una verificación, los roles,
  /// el estado), y guarda una sola vez más con la revisión releída, como el idioma del menú. Si el nombre difiere, la
  /// relectura falla o el reintento vuelve a chocar, queda el 409 y se revisa. Devuelve la revisión con la que guardó.
  async function save({ body, base }: { body: UpdateProfileBody; base: Baseline }): Promise<number> {
    try {
      await updateProfile(body);

      return body.expectedRevision;
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "Users.User.RevisionConflict")) throw error;
      const current = await queryClient
        .fetchQuery({ queryKey: currentUserQueryKey, queryFn: fetchCurrentUser, staleTime: 0, meta: { errorOwner: "local" } })
        .catch(() => undefined);
      if (current === undefined || current.displayName !== base.displayName) throw error;
      await updateProfile({ ...body, expectedRevision: current.revision });

      return current.revision;
    }
  }

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: async (revision, { body }) => {
      // Lo guardado es la base nueva, y también el perfil de la sesión hasta que llegue la relectura: con el perfil viejo
      // un momento en caché, el idioma recién guardado sería distinto del de la base y la pantalla lo seguiría hacia atrás
      // (abajo). La relectura trae la revisión que dejó el guardado, que se adopta con el mismo nombre.
      queryClient.setQueryData<CurrentUser>(currentUserQueryKey, (saved) => saved && { ...saved, displayName: body.displayName, culture: body.culture, timeZoneId: body.timeZoneId });
      if (active.current) setBaseline({ displayName: body.displayName, culture: body.culture, timeZoneId: body.timeZoneId, revision });
      notify({ id: "features/profile/pages/ProfilePage:1", kind: "success", message: t("feedback.saved") });
      // El perfil lo usa medio front (el menú, la barra lateral, las fechas de los listados). Y si cambió el
      // idioma, es esta consulta la que lo aplica: `useProfileLanguageSync` mira el `culture` que llegue acá.
      // Por eso la pantalla no toca i18next por su cuenta: el idioma de la cuenta se aplica en un solo lugar.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: (error) => {
      if (active.current && error instanceof ApiError && error.code === "Users.User.RevisionConflict") {
        setNeedsReview(true);
        notify({ id: reviewNoticeId, kind: "error", message: operationalErrorMessage(error, t),
          action: { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } });

        return;
      }

      const feedback = errorFeedback(error, { fields: ["displayName", "culture", "timeZoneId"] });
      if (feedback.kind !== "fields" && feedback.kind !== "cancelled") notify({ id: "profile:save:error", kind: "error", message: operationalErrorMessage(error, t) });
    },
  });

  // Los valores del formulario salen del perfil, y se ajustan durante el render en vez de copiarlos con un
  // efecto. Mientras el id no cambie no se vuelven a pisar: lo que esté escrito a medias es de la persona
  // (mismo criterio que `UserEditDialog`).
  if (user && loadedUserId !== user.id) {
    setLoadedUserId(user.id);
    setBaseline(baselineOf(user));
    setDraft(draftOf(user));
  } else if (user && draft && baseline) {
    // El idioma de la cuenta cambió desde afuera de esta pantalla (el menú del usuario, que lo guarda de una). El
    // segmentado tiene que seguirlo: si no, queda contradiciendo a la interfaz y el primer Guardar manda el idioma viejo,
    // que el PUT reemplaza, y devuelve la cuenta al idioma anterior. Se toca solo `culture`, para no pisar el nombre a
    // medio escribir. Va aparte de la revisión, porque el idioma no la avanza.
    const followsCulture = user.culture !== baseline.culture;
    // Una lectura nueva con otra revisión pero el mismo nombre (lo único del PUT que la avanza): se verificó un correo o un
    // número, cambiaron los roles, o se acaba de guardar este borrador. Se adopta su revisión, o el próximo Guardar daría
    // un conflicto que no es; si cambió el nombre, se queda la de antes y el 409 lo dice.
    const adoptsRevision = user.revision !== baseline.revision && user.displayName === baseline.displayName;
    if (followsCulture || adoptsRevision) {
      setBaseline({
        ...baseline,
        ...(followsCulture ? { culture: user.culture } : {}),
        ...(adoptsRevision ? { revision: user.revision } : {}),
      });
    }

    if (followsCulture) {
      setDraft({ ...draft, culture: cultureOf(user.culture) });
    }
  }

  /// Relee el perfil para comparar (N2): la lectura reemplaza la de la sesión, y la comparación queda hasta elegir.
  async function readCurrent() {
    if (!active.current) return;
    setReading(true);
    try {
      const current = await queryClient.fetchQuery({ queryKey: currentUserQueryKey, queryFn: fetchCurrentUser, staleTime: 0, meta: { errorOwner: "local" } });
      if (!active.current) return;
      setReview(current);
      dismissNotification(reviewNoticeId);
    } catch (error) {
      if (!active.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind !== "session") notify({ id: reviewNoticeId, kind: "error", message: t("feedback.reviewFailed"),
        description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } });
    } finally {
      if (active.current) setReading(false);
    }
  }

  /// Conservar mis cambios toma de lo guardado lo que el borrador no tocó; usar lo actual lo descarta. En los dos casos, la
  /// revisión pasa a ser la leída.
  function acceptReview(keepDraft: boolean) {
    if (!review || !draft || !baseline) return;
    const current = draftOf(review);
    setDraft(keepDraft ? keepDraftChanges(draft, baseline, current) : current);
    setBaseline(baselineOf(review));
    setNeedsReview(false);
    setReview(undefined);
    dismissNotification(reviewNoticeId);
  }

  // The only list of time zones (DS1-A), keeping the saved one even if the browser spells it another way (the seed's
  // `America/Argentina/Buenos_Aires`): without it the field would start empty and saving would change the person's zone.
  // The memo keeps it from being built again on every key typed in the name.
  const timeZones = useMemo(() => timeZoneOptions(i18n.language, [user?.timeZoneId]), [i18n.language, user?.timeZoneId]);

  if (!user || !draft || !baseline) {
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
        {/* Tras un 409 de revisión, «Revisar valores actuales» va antes de Guardar, que se apaga con el motivo hasta
            elegir, aunque se cierre el aviso (como en Configuración). */}
        <Surface
          title={t("sections.details")}
          actions={<>
            {needsReview ? (
              <Button type="button" variant="outline" pending={reading} disabled={reading || mutation.isPending} onClick={() => void readCurrent()}>
                {reading ? t("common:revisionReview.reading") : t("common:revisionReview.action")}
              </Button>
            ) : null}
            <DisabledReason reason={needsReview && !reading ? t("common:revisionReview.pending") : null}>
              <Button type="submit" form={formId} disabled={!hasChanges(draft, baseline) || needsReview || reading} pending={mutation.isPending}>
                {mutation.isPending ? t("form.saving") : t("form.submit")}
              </Button>
            </DisabledReason>
          </>}
        >
          <form
            id={formId}
            noValidate
            className="flex flex-wrap gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (needsReview || reading) return;
              mutation.mutate({ body: { displayName: sentName(draft), culture: draft.culture, timeZoneId: draft.timeZoneId, expectedRevision: baseline.revision }, base: baseline });
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
              {/* Two fixed options, in sight and one click away (DS1-A). */}
              <FormField label={t("form.language")} error={fieldErrors?.culture?.[0]}>
                <SegmentedControl
                  fullWidth
                  aria-label={t("form.language")}
                  options={supportedLanguages.map((language) => ({
                    key: language,
                    label: t(`common:language.${language}`),
                    pressed: draft.culture === language,
                    onSelect: () => {
                      if (language !== draft.culture) setDraft({ ...draft, culture: language });
                    },
                  }))}
                />
              </FormField>
            </div>

            {/* The city and, in grey, the time of its country and its offset, with the search inside the list (on the
                phone, the list takes the screen). What travels is still the IANA identifier. */}
            <div className="w-full sm:w-96">
              <FormField label={t("form.timeZone")} error={fieldErrors?.timeZoneId?.[0]}>
                <Picker
                  label={t("form.timeZone")}
                  options={timeZones}
                  value={draft.timeZoneId}
                  onChange={(timeZoneId) => setDraft({ ...draft, timeZoneId })}
                />
              </FormField>
            </div>
          </form>
        </Surface>

        {review ? <ProfileReview current={review} kept={keepDraftChanges(draft, baseline, draftOf(review))} disabled={reading || mutation.isPending} titleRef={reviewTitle} onAccept={acceptReview} /> : null}

        <LoginMethodsCard user={user} />

        <WhatsAppChatCard user={user} />
      </div>
    </Page>
  );
}
