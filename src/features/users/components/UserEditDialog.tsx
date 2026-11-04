import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { notify } from "@/shared/ui/notifications";
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
import { currentUserQueryKey, useCurrentUser } from "@/auth/useCurrentUser";
import { VerifyDestinationDialog } from "@/shared/ui/VerifyDestinationDialog";
import { displayNameMaxLength } from "@/shared/api/accountRules";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { rolesQueryKey } from "@/shared/api/roles";
import { UserDataSectionContext, type UserDataSaveState } from "@/shared/hooks/userDataSectionContext";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Surface } from "@/shared/ui/Surface";
import { AccountRow, AccountRows } from "@/shared/ui/AccountRows";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
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

/// El valor de una fila de "Medios de ingreso": el tooltip común permite consultar el dato completo con mouse y teclado
/// cuando no entra en su columna. En el celular el valor baja de renglón para conservar todos sus caracteres.
function MethodValue({ value }: { value: string }) {
  return (
    <ActionTooltip label={value}>
      <span tabIndex={0} className="min-w-0 [overflow-wrap:anywhere] @md:truncate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]">
        {value}
      </span>
    </ActionTooltip>
  );
}

/// La fila abierta en su campo, al agregar un correo o un número (tablero B, punto 3): el ícono queda en la columna de
/// los íconos de `AccountRow`, a la altura de la caja de texto y no del rótulo, y el campo ocupa el resto.
function FieldRow({ icon: Icon, children }: { icon: IconComponent; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-3 px-4 pt-2.5 pb-3">
      <Icon className="mt-8 size-4 text-[var(--color-content-muted)]" />
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
  const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  const extension = useContext(UserDataSectionContext);
  const extraOwner = useMemo(() => ({ userId: user.id, extension }), [user.id, extension]);
  const currentExtraOwner = useRef(extraOwner), submittedExtraOwner = useRef<object | null>(null);
  useLayoutEffect(() => { currentExtraOwner.current = extraOwner; }, [extraOwner]);
  const extraState = useRef<{ owner: object; value: UserDataSaveState } | null>(null);
  const [extraStatus, setExtraStatus] = useState<{ owner: object | null; busy: boolean; ready: boolean }>({ owner: null, busy: false, ready: false });
  const extraFlags = extraStatus.owner === extraOwner ? extraStatus : { busy: false, ready: false };
  const [savedExtraOwner, setSavedExtraOwner] = useState<object | null>(null);
  const userSaved = savedExtraOwner === extraOwner;
  const onExtraState = useCallback((next: UserDataSaveState) => {
    if (currentExtraOwner.current !== extraOwner) return;
    extraState.current = { owner: extraOwner, value: next };
    setExtraStatus(previous => previous.owner === extraOwner && previous.busy === next.busy && previous.ready === next.ready ? previous : { owner: extraOwner, busy: next.busy, ready: next.ready });
  }, [extraOwner]);

  const [draft, setDraft] = useState<DraftValues | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const [addingEmail, setAddingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [addingPhone, setAddingPhone] = useState(false);
  const [country, setCountry] = useState("");
  const [number, setNumber] = useState("");
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [isLinkingOwnPhone, setIsLinkingOwnPhone] = useState(false);
  const { data: currentUser } = useCurrentUser();
  const isOwnAccount = currentUser?.id === user.id;
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
      if (!isMounted.current || submittedExtraOwner.current !== currentExtraOwner.current) return;
      setSavedExtraOwner(extraOwner);
      const extra = extraState.current?.owner === extraOwner ? extraState.current.value : null;
      const extraSaved = !extra?.dirty || await extra.save();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
        // Si se cambió los roles a sí mismo, sus propios permisos pueden haber cambiado.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
      if (isMounted.current && extraSaved) {
        notify({ id: "features/users/components/UserEditDialog:1", kind: "success", message: t("edit.success") });
        onClose();
      }
    },
    onError: (error) => {
      const next = userFormErrors(error, t, isMounted.current ? visibleFields : []);
      setErrors({ fields: next.fields });
      if (next.form) notify({ id: `users:update:${user.id}`, kind: "error", message: next.form });
    },
  });

  // Desvincular es una acción aparte, que no espera a "Guardar": la confirmación espera abierta la respuesta y el
  // resultado va a un aviso. El diálogo de edición queda abierto, con el detalle nuevo.
  const unlink = useMutation({
    mutationFn: () => unlinkUserPhone(user.id),
    onSuccess: async () => {
      notify({ id: "features/users/components/UserEditDialog:2", kind: "success", message: t("unlink.success") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
        // Desvincularse a uno mismo cambia su propio perfil.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
    },
    // El 409 del admin sobre sí mismo sin otro medio de ingreso trae el porqué en el `detail`.
    onError: (error) => notify({ id: "features/users/components/UserEditDialog:3", kind: "error", message: userActionErrorMessage(error, t) }),
  });

  /// El botón "Agregar" se va y en su lugar aparece el campo: el foco pasa al campo, no a `<body>`.
  function startAdding(kind: "email" | "phone") {
    flushSync(() => (kind === "email" ? setAddingEmail(true) : setAddingPhone(true)));
    (kind === "email" ? emailRef : numberRef).current?.focus();
  }

  function submit(values: DraftValues) {
    if (extension && (!extraFlags.ready || extraFlags.busy)) return;
    const newEmail = isAddingEmail ? email.trim() : "";
    const newNumber = isAddingPhone ? number.trim() : "";

    if (newEmail !== "" && !emailSchema.safeParse(newEmail).success) {
      setErrors({ fields: { email: t("form.emailInvalid") } });

      return;
    }

    setErrors({ fields: {} });
    // Lo que no se agregó no viaja: ausente, el backend lo deja como está.
    submittedExtraOwner.current = extraOwner;
    mutation.mutate({
      displayName: values.displayName.trim() || null,
      roles: values.roles,
      ...(newEmail === "" ? {} : { email: newEmail }),
      ...(newNumber === "" ? {} : { phone: { country: effectiveCountry, number: newNumber } }),
    });
  }

  // "Sin verificar" lleva su explicación como la insignia del listado (`columns.tsx`): en el tooltip, al pasar el mouse
  // o al llegar con el teclado, y como texto del disparador para el lector de pantalla, que en modo exploración no lee
  // la descripción de algo que no recibe foco. Sin una nota al pie de la caja.
  function badgeFor(verified: boolean) {
    return verified ? (
      <VerificationBadge verified>{t("methods.verified")}</VerificationBadge>
    ) : (
      <VerificationBadge verified={false} hint={t("methods.unverifiedHint")}>
        {t("methods.unverified")}
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
        className="flex max-h-[min(45rem,90svh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="px-4.5 pt-4.5 pr-12">
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>{userName(detail ?? user)}</DialogDescription>
        </DialogHeader>

        {draft === undefined || detail === undefined ? (
          // Sin esta rama, un detalle que falla dejaba dos bloques grises para siempre. Pasa de verdad con dos
          // administradores a la vez: uno elimina la cuenta y el otro abre el diálogo desde un listado viejo.
          detailQuery.isError ? (
            <div className="flex flex-col items-start gap-3 p-4.5">
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {t("common:states.loadFailed")}
              </p>
              <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                {t("common:actions.retry")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4.5">
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
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 py-4">
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
              {extension ? <extension.Section userId={user.id} disabled={mutation.isPending} userSaved={userSaved} onState={onExtraState} /> : null}

              {/* `shrink-0`: con `overflow-hidden`, un hijo de una columna flexible se deja achicar por debajo de su
                  contenido. Con el reenvío abierto el cuerpo no entraba, y en vez de scrollear, la caja se comía la fila
                  de WhatsApp. */}
              <Surface title={t("methods.title")} headingLevel={3}>
                {/* Los mismos renglones que Mi perfil (tablero PF1-A, `AccountRows`): en el diálogo, el dato va arriba del
                    valor y la insignia y la acción en sus columnas, alineadas entre filas. La insignia y la acción van
                    siempre en el mismo lugar del árbol: así "Desvincular" y "Agregar número" son el mismo botón, y al
                    desvincular el foco se queda en él. */}
                <AccountRows>
                  {isAddingEmail ? (
                    <FieldRow icon={MailIcon}>
                      <FormField label={t("form.email")} error={errors.fields.email}>
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
                    <AccountRow
                      icon={MailIcon}
                      label={t("methods.email")}
                      value={detail.email === null ? t("methods.noEmail") : <MethodValue value={detail.email} />}
                      muted={detail.email === null}
                      badge={detail.email === null ? undefined : badgeFor(detail.emailConfirmed)}
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
                    // Quitar va en rojo antes de confirmar (`destructive-outline`, aprobado con PF3 el 2026-11-03): la
                    // confirmación dice qué se pierde.
                    <AccountRow
                      icon={SmartphoneIcon}
                      label={t("methods.whatsApp")}
                      value={phone === null ? t("methods.noPhone") : <MethodValue value={phone} />}
                      muted={phone === null}
                      badge={phone === null ? undefined : badgeFor(detail.phoneNumberConfirmed)}
                      action={
                        <div className="flex flex-col items-end gap-1">
                          {isOwnAccount && phone !== null && !detail.phoneNumberConfirmed && whatsappEnabled ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsLinkingOwnPhone(true)}>
                              {t("common:code.verify")}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant={phone === null ? "outline" : "destructive-outline"}
                            size="sm"
                            // "Desvincular" solo, entre varias filas, no dice qué se desvincula ni de quién.
                            aria-label={phone === null ? undefined : t("methods.unlinkFor", { user: userName(detail) })}
                            onClick={() => (phone === null
                              ? isOwnAccount ? setIsLinkingOwnPhone(true) : startAdding("phone")
                              : setIsConfirmingUnlink(true))}
                          >
                            {phone === null ? t("methods.addPhone") : t("methods.unlink")}
                          </Button>
                          </div>
                      }
                    />
                  ) : null}
                </AccountRows>
                {/* Que el número es su único medio de ingreso lo dice la confirmación de «Desvincular». */}
              </Surface>

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
            <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4.5 py-3">
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("common:actions.cancel")}
                </Button>
                <Button type="submit" pending={mutation.isPending} disabled={!!extension && (!extraFlags.ready || extraFlags.busy)}>
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
            isOwnAccount={isOwnAccount}
            pending={unlink.isPending}
            // La confirmación espera abierta y se cierra con la respuesta, también si falla (el porqué va a un aviso).
            onConfirm={() => unlink.mutate(undefined, { onSettled: () => setIsConfirmingUnlink(false) })}
            onClose={() => setIsConfirmingUnlink(false)}
          />
        ) : null}
        {isLinkingOwnPhone ? (
          <VerifyDestinationDialog channel="whatsapp" countries={countries} initialPhone={detail?.phoneNumber ?? undefined}
            // Con el número que ya tiene es «Verificar»; sin número, el alta («Agregar número»), el título de siempre.
            copy={detail?.phoneNumber ? { title: t("profile:verifyWhatsApp.title"), success: t("profile:verifyWhatsApp.success") } : undefined}
            onClose={() => {
            setIsLinkingOwnPhone(false);
            void Promise.all([
              queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
              queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
            ]);
          }} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
