import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { createUser, usersQueryKeyRoot } from "../api/users";
import { userActionErrorMessage } from "../errors";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { applyApiErrorToForm } from "@/shared/api/formErrors";
import { fetchRoles, rolesQueryKey } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

const schema = z.object({ email: z.email(), displayName: z.string().optional() });

type FormValues = z.infer<typeof schema>;

/// Alta de un usuario (`POST /api/users`). Invitar es dar de alta el correo: la persona entra después con su
/// código, como todos (sección 3 del spec de la Fase 4).
///
/// La pantalla lo monta solo mientras está abierto, así el formulario arranca vacío cada vez sin tener que
/// resetearlo a mano cuando cambia `open`.
export function UserFormDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canReadRoles = has("roles.read");

  const [roles, setRoles] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | undefined>();
  const restoreFocus = useRestoreFocusOnClose();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function setFieldError(field: string, error: { type: string; message: string }) {
    // El backend responde los nombres de campo en camelCase, que acá son las claves de FormValues.
    setError(field as Path<FormValues>, error);
  }

  const rolesQuery = useQuery({ queryKey: rolesQueryKey, queryFn: fetchRoles, enabled: canReadRoles });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createUser({ email: values.email, displayName: values.displayName?.trim() || null, roles }),
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
    onError: (error) => {
      if (error instanceof ApiError && applyApiErrorToForm(error, setFieldError)) {
        return;
      }

      setFormError(userActionErrorMessage(error, t));
    },
  });

  const availableRoles = rolesQuery.data ?? [];

  // El mensaje del backend (`type: "server"`, que pone `applyApiErrorToForm`) gana sobre el genérico de zod:
  // dice qué pasó de verdad. "Ingresá un correo electrónico válido" no explicaría nada si el formato estaba
  // bien y lo que falló fue el largo.
  const emailError = errors.email
    ? errors.email.type === "server"
      ? errors.email.message
      : t("form.emailInvalid")
    : undefined;

  // A `displayName` zod no lo valida (es opcional): cualquier error suyo viene del backend. Sin pintarlo, un
  // 400 sobre este campo dejaba el diálogo abierto sin un solo mensaje, porque `applyApiErrorToForm` ya había
  // devuelto `true` y `formError` nunca se seteaba.
  const displayNameError = errors.displayName?.message;

  function toggleRole(name: string, checked: boolean) {
    setRoles((current) => (checked ? [...current, name] : current.filter((role) => role !== name)));
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
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            setFormError(undefined);
            void handleSubmit((values) => mutation.mutate(values))(event);
          }}
        >
          <FormField label={t("form.email")} required error={emailError}>
            <Input type="email" autoComplete="off" {...register("email")} />
          </FormField>

          <FormField label={t("form.displayName")} hint={t("form.displayNameHint")} error={displayNameError}>
            <Input type="text" autoComplete="off" {...register("displayName")} />
          </FormField>

          {canReadRoles ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("form.roles")}</legend>
              {rolesQuery.isPending ? <Skeleton aria-hidden="true" className="h-10" /> : null}
              {!rolesQuery.isPending && availableRoles.length === 0 ? (
                <p className="text-sm text-[var(--color-content-muted)]">{t("form.rolesEmpty")}</p>
              ) : null}
              {availableRoles.map((role) => (
                <CheckboxField
                  key={role.id}
                  label={role.name}
                  description={role.description ?? undefined}
                  checked={roles.includes(role.name)}
                  onCheckedChange={(checked) => toggleRole(role.name, checked)}
                />
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-[var(--color-content-muted)]">{t("form.rolesNeedPermission")}</p>
          )}

          {formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
