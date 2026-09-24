import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { createUser, usersQueryKeyRoot, type CreateUserBody, type InvitationChannel } from "../api/users";
import { userFormErrors, type UserFormErrors, type UserFormField } from "../errors";
import { RolesField } from "./RolesField";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { rolesQueryKey } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { PhoneField } from "@/shared/ui/PhoneField";
import { RadioGroupField, type RadioOption } from "@/shared/ui/RadioGroupField";

const emailSchema = z.email();

interface Draft {
  email: string;
  /// Vacío hasta que se elige otro: mientras tanto vale el primero de los habilitados, que llegan después.
  country: string;
  number: string;
  displayName: string;
  roles: string[];
  invite: boolean;
  /// El canal que eligió el admin. Si deja de estar disponible (se borró el correo), vale el otro.
  channel: InvitationChannel | undefined;
  consent: boolean;
}

const emptyDraft: Draft = {
  email: "",
  country: "",
  number: "",
  displayName: "",
  roles: [],
  invite: false,
  channel: undefined,
  consent: false,
};

/// El canal que se usa: el elegido si se puede, y si no, el único que se puede. Con los dos, el correo, que es el
/// primero de la lista. Sin ninguno, ninguno: no hay a dónde mandarla.
function effectiveChannel(
  chosen: InvitationChannel | undefined,
  hasEmail: boolean,
  hasPhone: boolean,
): InvitationChannel | undefined {
  if ((chosen === "Email" && hasEmail) || (chosen === "WhatsApp" && hasPhone)) {
    return chosen;
  }

  return hasEmail ? "Email" : hasPhone ? "WhatsApp" : undefined;
}

/// Alta de un usuario (`POST /api/users`, tablero "WhatsApp · Usuarios: alta con teléfono", punto 2): un correo, un
/// número de WhatsApp o los dos, y, si se pide, una invitación por uno de los dos. Lo que carga el admin queda sin
/// verificar hasta que la persona entra con eso.
///
/// Con WhatsApp apagado (`login-methods`), el número y el canal WhatsApp no se ofrecen: el alta es la de siempre, con
/// el correo.
///
/// Por WhatsApp, la invitación es una plantilla que Meta solo deja mandar a quien aceptó recibir mensajes: el admin
/// lo confirma con la casilla del consentimiento, y el backend guarda quién y cuándo.
///
/// La pantalla lo monta solo mientras está abierto, así el formulario arranca vacío cada vez sin tener que
/// resetearlo a mano cuando cambia `open`.
export function UserFormDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<UserFormErrors>({ fields: {} });

  const { data: methods } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    // Si no llegan, el alta sigue con el correo: no hay nada que avisar.
    meta: { silent: true },
  });
  const countries = methods?.whatsapp === true ? methods.whatsappCountries : [];
  const whatsappEnabled = countries.length > 0;
  const country = draft.country || (countries[0] ?? "");

  const hasEmail = draft.email.trim() !== "";
  const hasPhone = whatsappEnabled && draft.number.trim() !== "";
  const channel = effectiveChannel(draft.channel, hasEmail, hasPhone);
  const asksConsent = draft.invite && channel === "WhatsApp";

  // Los campos que están en pantalla: un error de uno que no está va arriba de los botones.
  const visibleFields: UserFormField[] = ["email", "displayName"];

  if (whatsappEnabled) {
    visibleFields.push("phone");
  }

  if (draft.invite) {
    visibleFields.push("channel");
  }

  if (asksConsent) {
    visibleFields.push("consent");
  }

  function change(changes: Partial<Draft>, field?: UserFormField) {
    setDraft((previous) => ({ ...previous, ...changes }));

    // Lo que se corrige deja de estar en error; lo demás sigue marcado hasta el próximo intento.
    if (field !== undefined && errors.fields[field] !== undefined) {
      setErrors((previous) => ({ ...previous, fields: { ...previous.fields, [field]: undefined } }));
    }
  }

  const mutation = useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: async () => {
      toast.success(t("create.success"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        // El alta/edición/borrado cambia el `userCount` de los roles: sin esto, /roles muestra el conteo
        // viejo durante los 30 s de staleTime, y puede ofrecer borrar un rol que todavía tiene gente.
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
      onClose();
    },
    onError: (error) => setErrors(userFormErrors(error, t, visibleFields)),
  });

  function submit() {
    const email = draft.email.trim();

    // El formato se mira acá; que haya un correo o un número, y todo lo demás, lo decide el backend. Con WhatsApp
    // apagado no hay número en pantalla y el correo es obligatorio, como antes de WhatsApp: el "Cargá un correo o un
    // número de WhatsApp." del backend nombraría un campo que no está.
    if ((email !== "" || !whatsappEnabled) && !emailSchema.safeParse(email).success) {
      setErrors({ fields: { email: t("form.emailInvalid") } });

      return;
    }

    setErrors({ fields: {} });
    mutation.mutate({
      email: email || null,
      phone: hasPhone ? { country, number: draft.number.trim() } : null,
      displayName: draft.displayName.trim() || null,
      roles: draft.roles,
      // Sin un canal posible no hay invitación que pedir: el backend contesta que falta el correo o el número.
      invitation:
        draft.invite && channel !== undefined ? { channel, consent: channel === "WhatsApp" && draft.consent } : null,
    });
  }

  const channelOptions: RadioOption[] = [
    {
      value: "Email",
      label: t("invitation.email"),
      disabled: !hasEmail,
      description: hasEmail ? undefined : t("invitation.emailNeeded"),
    },
  ];

  if (whatsappEnabled) {
    channelOptions.push({
      value: "WhatsApp",
      label: t("invitation.whatsApp"),
      disabled: !hasPhone,
      description: hasPhone ? undefined : t("invitation.phoneNeeded"),
    });
  }

  // "Laura aceptó…": con el nombre de pila, como la saluda la plantilla. Sin nombre, "La persona aceptó…".
  const firstName = draft.displayName.trim().split(/\s+/)[0] ?? "";
  const app = t("common:app.name");
  const consentLabel = firstName
    ? t("invitation.consent", { name: firstName, app })
    : t("invitation.consentWithoutName", { app });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {/* Con la invitación abierta, el formulario no entra en una pantalla baja: el diálogo scrollea adentro. */}
      <DialogContent onCloseAutoFocus={restoreFocus} className="max-h-[calc(100svh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>
            {whatsappEnabled ? t("create.description") : t("create.descriptionEmailOnly")}
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <FormField label={t("form.email")} required={!whatsappEnabled} error={errors.fields.email}>
            <Input
              type="email"
              autoComplete="off"
              placeholder={t("form.emailPlaceholder")}
              value={draft.email}
              onChange={(event) => change({ email: event.target.value }, "email")}
            />
          </FormField>

          {whatsappEnabled ? (
            <PhoneField
              label={t("common:phone.label")}
              error={errors.fields.phone}
              countries={countries}
              country={country}
              onCountryChange={(next) => change({ country: next }, "phone")}
              value={draft.number}
              onChange={(event) => change({ number: event.target.value }, "phone")}
            />
          ) : null}

          <FormField label={t("form.displayName")} hint={t("form.displayNameHint")} error={errors.fields.displayName}>
            <Input
              type="text"
              autoComplete="off"
              value={draft.displayName}
              onChange={(event) => change({ displayName: event.target.value }, "displayName")}
            />
          </FormField>

          <RolesField value={draft.roles} onChange={(roles) => change({ roles })} />

          <hr className="border-[var(--color-border)]" />

          {/* Las casillas traen su propio margen interno (la fila se ilumina entera): se lo compensa para que queden
              alineadas con los campos de arriba. */}
          <div className="-mx-2.5 flex flex-col gap-1">
            <CheckboxField
              label={t("invitation.send")}
              checked={draft.invite}
              onCheckedChange={(invite) => change({ invite }, "channel")}
            />

            {draft.invite ? (
              <div className="flex flex-col gap-2 pl-[25px]">
                <RadioGroupField
                  label={t("invitation.channel")}
                  options={channelOptions}
                  value={channel}
                  onValueChange={(next) => change({ channel: next === "WhatsApp" ? "WhatsApp" : "Email" }, "channel")}
                  error={errors.fields.channel}
                />

                {asksConsent ? (
                  <div className="ml-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                    <CheckboxField
                      label={consentLabel}
                      description={t("invitation.consentHint")}
                      error={errors.fields.consent}
                      checked={draft.consent}
                      onCheckedChange={(consent) => change({ consent }, "consent")}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
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
              {draft.invite ? t("create.submitAndInvite") : t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
