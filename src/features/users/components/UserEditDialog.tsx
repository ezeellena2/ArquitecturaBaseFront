import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import {
  fetchUser,
  unlinkUserPhone,
  updateUser,
  userQueryKey,
  usersQueryKeyRoot,
  type UpdateUserBody,
  type UserListItem,
} from "../api/users";
import { userActionErrorMessage, userFormErrors, type UserFormErrors, type UserFormField } from "../errors";
import { userName } from "../identity";
import { LastInvitationStrip } from "./LastInvitationStrip";
import { RolesField } from "./RolesField";
import { UnlinkUserWhatsAppDialog } from "./UnlinkUserWhatsAppDialog";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { displayNameMaxLength } from "@/shared/api/accountRules";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { rolesQueryKey } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { cn } from "@/shared/lib/utils";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { MailIcon, SmartphoneIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { PhoneField } from "@/shared/ui/PhoneField";
import { Skeleton } from "@/shared/ui/skeleton";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

const emailSchema = z.email();

interface DraftValues {
  displayName: string;
  roles: string[];
}

type IconComponent = ComponentType<{ className?: string }>;

/// Lo que comparten las filas de la caja: el margen de la caja y la raya entre una fila y la siguiente.
const rowClass = "mx-3.5 grid gap-x-3 border-[var(--color-border)]/60 [&:not(:first-child)]:border-t";

/// El ícono del medio, en su caja de 32 px: la primera columna de cada fila.
function MethodIcon({ icon: Icon, className }: { icon: IconComponent; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]",
        className,
      )}
    >
      <Icon className="size-[17px]" />
    </span>
  );
}

/// Una fila de "Medios de ingreso" (tablero "Editar usuario · B", punto 1): el ícono, qué medio es arriba de su valor
/// (o de lo que falta), la insignia en una columna propia y la acción con su texto. Las columnas son fijas para que las
/// insignias y las acciones de las dos filas queden alineadas. Una acción sin insignia (agregar) ocupa las dos columnas.
///
/// La insignia y la acción van siempre en el mismo lugar del árbol: así "Desvincular" y "Agregar número" son el mismo
/// botón, y al desvincular el foco se queda en él.
///
/// En un teléfono las cuatro columnas no entran (al valor le quedaban 13 px): por debajo de `sm` la insignia baja
/// debajo del valor y la acción queda a la derecha. El tablero no dibuja el teléfono; desde `sm` es el tablero.
function MethodRow({
  icon,
  label,
  value,
  empty,
  badge,
  action,
}: {
  icon: IconComponent;
  label: string;
  value: string | null;
  /// Lo que se lee cuando falta el valor ("Sin correo").
  empty: string;
  badge: ReactNode;
  action: ReactNode;
}) {
  return (
    <li
      className={cn(
        rowClass,
        "grid-cols-[32px_minmax(0,1fr)_auto] items-center py-2.5 sm:grid-cols-[32px_minmax(0,1fr)_92px_104px]",
      )}
    >
      <MethodIcon icon={icon} className="row-span-2 sm:row-span-1" />
      <span className="col-start-2 row-start-1 flex min-w-0 flex-col gap-px">
        <span className="text-[13px] leading-[18px] font-medium text-[var(--color-content)]">{label}</span>
        {value === null ? (
          <span className="text-[13.5px] leading-5 text-[var(--color-content-muted)]">{empty}</span>
        ) : (
          // Un correo largo se corta con puntos suspensivos; entero, en el `title` y para el lector de pantalla. En un
          // teléfono no hay lugar ni para un número entero: ahí baja de renglón, que cortarlo es perder dígitos.
          <span
            title={value}
            className="text-sm leading-5 text-[var(--color-content)] [overflow-wrap:anywhere] sm:truncate"
          >
            {value}
          </span>
        )}
      </span>
      {badge ? (
        <span className="col-start-2 row-start-2 mt-1 justify-self-start sm:col-start-3 sm:row-start-1 sm:mt-0">
          {badge}
        </span>
      ) : null}
      {action ? (
        <span
          className={cn(
            "col-start-3 row-span-2 row-start-1 justify-self-end sm:row-span-1",
            badge ? "sm:col-start-4" : "sm:col-span-2 sm:col-start-3",
          )}
        >
          {action}
        </span>
      ) : null}
    </li>
  );
}

/// La fila abierta en su campo, al agregar un correo o un número (tablero B, punto 3): el ícono queda en su columna, a
/// la altura del campo, y el campo ocupa el resto.
function FieldRow({ icon, children }: { icon: IconComponent; children: ReactNode }) {
  return (
    <li className={cn(rowClass, "grid-cols-[32px_minmax(0,1fr)] items-start pt-2.5 pb-3")}>
      {/* La etiqueta del campo y su separación: el ícono se centra con la caja de texto, no con el rótulo. */}
      <MethodIcon icon={icon} className="mt-[22px]" />
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/// Edición de un usuario (`PUT /api/users/{id}`, tablero "Editar usuario · B: filas compactas"): el nombre, los roles,
/// sus medios de ingreso y, aparte, la última invitación. El correo y el número que falten se agregan acá mismo, en su
/// fila, y quedan sin verificar hasta que la persona entra con eso; el número que tiene se puede desvincular (punto 5).
///
/// El nombre va en el mismo diálogo que los roles porque el PUT reemplaza los dos campos: mandar solo los
/// roles le borraría el nombre a la persona. Los roles que ya tiene, y si el correo está verificado, salen de
/// `GET /api/users/{id}`.
///
/// Guardar es el único primario. Desvincular y reenviar la invitación actúan en el momento, sin esperar a Guardar.
///
/// La pantalla lo monta solo mientras está abierto, así arranca con lo que trae el detalle.
export function UserEditDialog({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();
  const methodsTitleId = useId();
  const unverifiedNoteId = useId();

  const [draft, setDraft] = useState<DraftValues | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const [addingEmail, setAddingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);
  const [country, setCountry] = useState("");
  const [number, setNumber] = useState("");
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [errors, setErrors] = useState<UserFormErrors>({ fields: {} });
  const emailRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);

  const detailQuery = useQuery({ queryKey: userQueryKey(user.id), queryFn: () => fetchUser(user.id) });
  const { data: methods } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    // Si no llegan, la edición sigue sin ofrecer agregar un número: no hay nada que avisar.
    meta: { silent: true },
  });
  const countries = methods?.whatsapp === true ? methods.whatsappCountries : [];
  const whatsappEnabled = countries.length > 0;
  const effectiveCountry = country || (countries[0] ?? "");

  const detail = detailQuery.data;

  // El borrador arranca con lo que trajo el detalle. Se ajusta durante el render y no con un efecto que copia
  // datos a otro estado (regla de rendimiento del CLAUDE.md del front). Si el detalle se vuelve a consultar
  // (por ejemplo, después de desvincular), el borrador no se pisa: lo que esté escrito a medias es del usuario.
  if (detail && loadedUserId !== detail.id) {
    setLoadedUserId(detail.id);
    setDraft({ displayName: detail.displayName ?? "", roles: [...detail.roles] });
  }

  const phone = detail?.formattedPhoneNumber ?? null;

  // El campo que abrió "Agregar" está en pantalla solo mientras el detalle no trae ese medio. Si el detalle se vuelve a
  // consultar con el diálogo abierto y ya lo trae (la persona vinculó su WhatsApp desde el perfil, otro admin le cargó
  // el correo), el campo se va y en su lugar queda lo que tiene. Lo escrito en él tampoco viaja: el backend
  // reemplazaría un número verificado por uno sin verificar, y un error sobre ese campo no tendría dónde verse. Por eso
  // dibujar, mandar y ubicar los errores leen esta misma condición, y no la marca de "Agregar" sola.
  const isAddingEmail = addingEmail && detail?.email === null;
  const isAddingPhone = addingPhone && phone === null;

  const visibleFields: UserFormField[] = ["displayName"];

  if (isAddingEmail) {
    visibleFields.push("email");
  }

  if (isAddingPhone) {
    visibleFields.push("phone");
  }

  function clearError(field: UserFormField) {
    if (errors.fields[field] !== undefined) {
      setErrors((previous) => ({ ...previous, fields: { ...previous.fields, [field]: undefined } }));
    }
  }

  const mutation = useMutation({
    mutationFn: (body: UpdateUserBody) => updateUser(user.id, body),
    onSuccess: async () => {
      toast.success(t("edit.success"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
        // Si se cambió los roles a sí mismo, sus propios permisos pueden haber cambiado.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
      onClose();
    },
    onError: (error) => setErrors(userFormErrors(error, t, visibleFields)),
  });

  // Desvincular es una acción aparte, que no espera a "Guardar": la confirmación se cierra al confirmar, así que el
  // resultado va a un aviso. El diálogo de edición queda abierto, con el detalle nuevo.
  const unlink = useMutation({
    mutationFn: () => unlinkUserPhone(user.id),
    onSuccess: async () => {
      toast.success(t("unlink.success"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
        // Desvincularse a uno mismo cambia su propio perfil.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
    },
    // El 409 del admin sobre sí mismo sin otro medio de ingreso trae el porqué en el `detail`.
    onError: (error) => toast.error(userActionErrorMessage(error, t)),
  });

  /// El botón "Agregar" se va y en su lugar aparece el campo: el foco pasa al campo, no a `<body>`.
  function startAdding(kind: "email" | "phone") {
    flushSync(() => (kind === "email" ? setAddingEmail(true) : setAddingPhone(true)));
    (kind === "email" ? emailRef : numberRef).current?.focus();
  }

  function submit(values: DraftValues) {
    const newEmail = isAddingEmail ? email.trim() : "";
    const newNumber = isAddingPhone ? number.trim() : "";

    if (newEmail !== "" && !emailSchema.safeParse(newEmail).success) {
      setErrors({ fields: { email: t("form.emailInvalid") } });

      return;
    }

    setErrors({ fields: {} });
    // Lo que no se agregó no viaja: ausente, el backend lo deja como está.
    mutation.mutate({
      displayName: values.displayName.trim() || null,
      roles: values.roles,
      ...(newEmail === "" ? {} : { email: newEmail }),
      ...(newNumber === "" ? {} : { phone: { country: effectiveCountry, number: newNumber } }),
    });
  }

  // Sin correo, el número es lo único con lo que entra. Una cuenta con Google siempre tiene el correo de Google, así
  // que alcanza con mirar el correo: el detalle no dice si hay Google.
  const isOnlyMethod = phone !== null && detail?.email === null;

  // "Sin verificar" se explica al pie de la caja, y la insignia lo lleva como descripción. Con un campo abierto, la
  // explicación es la ayuda del campo (punto 3): lo que se está cargando va a quedar así, y no se repite abajo.
  const emailUnverified = detail?.email != null && !detail.emailConfirmed;
  const phoneUnverified = phone !== null && detail?.phoneNumberConfirmed === false;
  const showsUnverifiedNote = (emailUnverified || phoneUnverified) && !isAddingEmail && !isAddingPhone;

  function badgeFor(verified: boolean) {
    return (
      <VerificationBadge
        verified={verified}
        aria-describedby={!verified && showsUnverifiedNote ? unverifiedNoteId : undefined}
      >
        {verified ? t("methods.verified") : t("methods.unverified")}
      </VerificationBadge>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {/* Con el pie en su banda: el cuerpo scrollea adentro y Guardar queda siempre a la vista. */}
      <DialogContent
        onCloseAutoFocus={restoreFocus}
        className="flex max-h-[min(720px,90svh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="px-[18px] pt-[18px] pr-12">
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>{userName(detail ?? user)}</DialogDescription>
        </DialogHeader>

        {draft === undefined || detail === undefined ? (
          // Sin esta rama, un detalle que falla dejaba dos bloques grises para siempre. Pasa de verdad con dos
          // administradores a la vez: uno elimina la cuenta y el otro abre el diálogo desde un listado viejo.
          detailQuery.isError ? (
            <div className="flex flex-col items-start gap-3 p-[18px]">
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {userActionErrorMessage(detailQuery.error, t)}
              </p>
              <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                {t("common:actions.retry")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-[18px]">
              <Skeleton aria-hidden="true" className="h-9" />
              <Skeleton aria-hidden="true" className="h-24" />
            </div>
          )
        ) : (
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
              <FormField label={t("form.displayName")} error={errors.fields.displayName}>
                <Input
                  type="text"
                  autoComplete="off"
                  maxLength={displayNameMaxLength}
                  value={draft.displayName}
                  onChange={(event) => {
                    setDraft({ ...draft, displayName: event.target.value });
                    clearError("displayName");
                  }}
                />
              </FormField>

              <RolesField value={draft.roles} onChange={(roles) => setDraft({ ...draft, roles })} />

              {/* `shrink-0`: con `overflow-hidden`, un hijo de una columna flexible se deja achicar por debajo de su
                  contenido. Con el reenvío abierto el cuerpo no entraba, y en vez de scrollear, la caja se comía la fila
                  de WhatsApp. */}
              <section
                aria-labelledby={methodsTitleId}
                className="flex shrink-0 flex-col overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <h3
                  id={methodsTitleId}
                  className="flex h-10 shrink-0 items-center border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-3.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--color-content-heading)] uppercase"
                >
                  {t("methods.title")}
                </h3>

                <ul className="flex flex-col">
                  {isAddingEmail ? (
                    <FieldRow icon={MailIcon}>
                      <FormField label={t("form.email")} hint={t("methods.unverifiedHint")} error={errors.fields.email}>
                        <Input
                          ref={emailRef}
                          type="email"
                          autoComplete="off"
                          placeholder={t("form.emailPlaceholder")}
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            clearError("email");
                          }}
                        />
                      </FormField>
                    </FieldRow>
                  ) : (
                    <MethodRow
                      icon={MailIcon}
                      label={t("methods.email")}
                      value={detail.email}
                      empty={t("methods.noEmail")}
                      badge={detail.email === null ? null : badgeFor(detail.emailConfirmed)}
                      action={
                        detail.email === null ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => startAdding("email")}>
                            {t("methods.addEmail")}
                          </Button>
                        ) : null
                      }
                    />
                  )}

                  {isAddingPhone ? (
                    <FieldRow icon={SmartphoneIcon}>
                      <PhoneField
                        ref={numberRef}
                        label={t("common:phone.label")}
                        hint={t("methods.unverifiedHint")}
                        error={errors.fields.phone}
                        countries={countries}
                        country={effectiveCountry}
                        onCountryChange={(next) => {
                          setCountry(next);
                          clearError("phone");
                        }}
                        value={number}
                        onChange={(event) => {
                          setNumber(event.target.value);
                          clearError("phone");
                        }}
                      />
                    </FieldRow>
                  ) : phone !== null || whatsappEnabled ? (
                    // Un número que ya está se muestra siempre, aunque WhatsApp se haya apagado, para poder desvincularlo.
                    // Desvincular va discreto, sin rojo: el rojo aparece recién en la confirmación, que dice qué se pierde.
                    <MethodRow
                      icon={SmartphoneIcon}
                      label={t("methods.whatsApp")}
                      value={phone}
                      empty={t("methods.noPhone")}
                      badge={phone === null ? null : badgeFor(detail.phoneNumberConfirmed)}
                      action={
                        <Button
                          type="button"
                          variant={phone === null ? "outline" : "ghost"}
                          size="sm"
                          // "Desvincular" solo, entre varias filas, no dice qué se desvincula ni de quién.
                          aria-label={phone === null ? undefined : t("methods.unlinkFor", { user: userName(detail) })}
                          onClick={() => (phone === null ? startAdding("phone") : setIsConfirmingUnlink(true))}
                        >
                          {phone === null ? t("methods.addPhone") : t("methods.unlink")}
                        </Button>
                      }
                    />
                  ) : null}
                </ul>

                {/* Justo debajo de la fila de la que habla, y sigue hasta guardar aunque se esté agregando un correo. */}
                {isOnlyMethod ? (
                  <div className="mx-3.5 mb-3.5">
                    <Banner tone="warning">{t("methods.onlyMethod")}</Banner>
                  </div>
                ) : null}

                {showsUnverifiedNote ? (
                  <p
                    id={unverifiedNoteId}
                    className="mx-3.5 border-t border-[var(--color-border)]/60 pt-[9px] pb-[11px] text-[12.5px] leading-[1.45] text-[var(--color-content-muted)]"
                  >
                    {t("methods.unverifiedHint")}
                  </p>
                ) : null}
              </section>

              {detail.lastInvitation === null ? null : (
                <LastInvitationStrip
                  user={detail}
                  invitation={detail.lastInvitation}
                  receivedAt={detailQuery.dataUpdatedAt}
                  whatsappEnabled={whatsappEnabled}
                />
              )}
            </div>

            {/* El pie en su banda, fuera de lo que scrollea. El error de Guardar que no es de un campo (el último
                administrador, la red) va ahí, arriba de los botones: al final del cuerpo, cuando el cuerpo no entraba,
                quedaba debajo del borde y en pantalla no cambiaba nada. En -700 porque el rojo de siempre no llega a
                4.5:1 sobre este fondo. */}
            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-[18px] py-3">
              {errors.form ? (
                <p role="alert" className="mb-2.5 text-sm text-[var(--color-danger-700)]">
                  {errors.form}
                </p>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("common:actions.cancel")}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? t("edit.saving") : t("edit.submit")}
                </Button>
              </DialogFooter>
            </div>
          </form>
        )}

        {isConfirmingUnlink && detail !== undefined && phone !== null ? (
          <UnlinkUserWhatsAppDialog
            name={userName(detail)}
            phone={phone}
            hasEmail={detail.email !== null}
            onConfirm={() => {
              if (!unlink.isPending) {
                unlink.mutate();
              }
            }}
            onClose={() => setIsConfirmingUnlink(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
