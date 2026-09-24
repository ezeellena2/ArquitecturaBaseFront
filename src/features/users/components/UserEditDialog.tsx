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
import { RolesField } from "./RolesField";
import { UnlinkUserWhatsAppDialog } from "./UnlinkUserWhatsAppDialog";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { rolesQueryKey } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
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

/// Una fila de "Medios de ingreso": el ícono, qué medio es, su valor (o que falta) y, a la derecha, lo que se puede
/// hacer.
function MethodRow({
  icon: Icon,
  label,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 grow flex-col">
        <span className="text-[13px] font-medium text-[var(--color-content)]">{label}</span>
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/// Edición de un usuario (`PUT /api/users/{id}`, tablero "WhatsApp · Usuarios: alta con teléfono", punto 3): el
/// nombre, los roles y sus medios de ingreso. El correo y el número que falten se agregan acá mismo, y quedan sin
/// verificar hasta que la persona entra con eso; el número que tiene se puede desvincular (punto 4).
///
/// El nombre va en el mismo diálogo que los roles porque el PUT reemplaza los dos campos: mandar solo los
/// roles le borraría el nombre a la persona. Los roles que ya tiene, y si el correo está verificado, salen de
/// `GET /api/users/{id}`.
///
/// La pantalla lo monta solo mientras está abierto, así arranca con lo que trae el detalle.
export function UserEditDialog({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();
  const methodsTitleId = useId();

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

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent onCloseAutoFocus={restoreFocus} className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>{userName(detail ?? user)}</DialogDescription>
        </DialogHeader>

        {draft === undefined || detail === undefined ? (
          // Sin esta rama, un detalle que falla dejaba dos bloques grises para siempre. Pasa de verdad con dos
          // administradores a la vez: uno elimina la cuenta y el otro abre el diálogo desde un listado viejo.
          detailQuery.isError ? (
            <div className="flex flex-col items-start gap-3">
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {userActionErrorMessage(detailQuery.error, t)}
              </p>
              <Button type="button" variant="outline" onClick={() => void detailQuery.refetch()}>
                {t("common:actions.retry")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton aria-hidden="true" className="h-9" />
              <Skeleton aria-hidden="true" className="h-24" />
            </div>
          )
        ) : (
          <form
            noValidate
            className="flex flex-col gap-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <FormField label={t("form.displayName")} error={errors.fields.displayName}>
              <Input
                type="text"
                autoComplete="off"
                value={draft.displayName}
                onChange={(event) => {
                  setDraft({ ...draft, displayName: event.target.value });
                  clearError("displayName");
                }}
              />
            </FormField>

            <RolesField value={draft.roles} onChange={(roles) => setDraft({ ...draft, roles })} />

            <div role="group" aria-labelledby={methodsTitleId} className="flex flex-col gap-2.5">
              <p
                id={methodsTitleId}
                className="text-[11px] font-semibold tracking-[0.06em] text-[var(--color-content-heading)] uppercase"
              >
                {t("methods.title")}
              </p>

              {isAddingEmail ? (
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
              ) : (
                <MethodRow
                  icon={MailIcon}
                  label={t("methods.email")}
                  action={
                    detail.email === null ? (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t("methods.addEmail")}
                        onClick={() => startAdding("email")}
                      >
                        {t("methods.add")}
                      </Button>
                    ) : null
                  }
                >
                  {detail.email === null ? (
                    <span className="text-[13.5px] text-[var(--color-content-muted)]">{t("methods.noEmail")}</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 text-[13.5px] break-all text-[var(--color-content)]">{detail.email}</span>
                      <VerificationBadge verified={detail.emailConfirmed}>
                        {detail.emailConfirmed ? t("methods.verified") : t("methods.unverified")}
                      </VerificationBadge>
                    </span>
                  )}
                </MethodRow>
              )}

              {isAddingPhone ? (
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
              ) : phone !== null || whatsappEnabled ? (
                // Un número que ya está se muestra siempre, aunque WhatsApp se haya apagado, para poder desvincularlo.
                // El botón es el mismo elemento con "Desvincular" y con "Agregar": al desvincular, el foco se queda en él.
                <MethodRow
                  icon={SmartphoneIcon}
                  label={t("methods.whatsApp")}
                  action={
                    phone !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[var(--color-danger)]/45 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 hover:text-[var(--color-danger)]"
                        onClick={() => setIsConfirmingUnlink(true)}
                      >
                        {t("methods.unlink")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t("methods.addPhone")}
                        onClick={() => startAdding("phone")}
                      >
                        {t("methods.add")}
                      </Button>
                    )
                  }
                >
                  {phone === null ? (
                    <span className="text-[13.5px] text-[var(--color-content-muted)]">{t("methods.noPhone")}</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] whitespace-nowrap text-[var(--color-content)]">{phone}</span>
                      <VerificationBadge verified={detail.phoneNumberConfirmed}>
                        {detail.phoneNumberConfirmed ? t("methods.verified") : t("methods.unverified")}
                      </VerificationBadge>
                    </span>
                  )}
                </MethodRow>
              ) : null}

              {isOnlyMethod ? <Banner tone="warning">{t("methods.onlyMethod")}</Banner> : null}

              <p className="text-[12.5px] leading-snug text-[var(--color-content-muted)]">{t("methods.unverifiedHint")}</p>
            </div>

            {errors.form ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {errors.form}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t("edit.submit")}
              </Button>
            </DialogFooter>
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
