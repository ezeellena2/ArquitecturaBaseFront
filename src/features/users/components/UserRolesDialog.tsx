import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fetchUser, updateUser, userQueryKey, usersQueryKeyRoot, type UserListItem } from "../api/users";
import { userActionErrorMessage } from "../errors";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { fetchRoles, rolesQueryKey } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

interface DraftValues {
  displayName: string;
  roles: string[];
}

/// Edición de un usuario (`PUT /api/users/{id}`): nombre y roles.
///
/// El nombre va en el mismo diálogo que los roles porque el PUT reemplaza los dos campos: mandar solo los
/// roles le borraría el nombre a la persona. Los roles que ya tiene salen de `GET /api/users/{id}`, que es
/// lo único que los sabe (el listado no los trae).
export function UserRolesDialog({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const { has } = usePermissions();
  const canReadRoles = has("roles.read");

  const [draft, setDraft] = useState<DraftValues | undefined>();
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const restoreFocus = useRestoreFocusOnClose();

  const detailQuery = useQuery({ queryKey: userQueryKey(user.id), queryFn: () => fetchUser(user.id) });
  const rolesQuery = useQuery({ queryKey: rolesQueryKey, queryFn: fetchRoles, enabled: canReadRoles });

  const detail = detailQuery.data;

  // El borrador arranca con lo que trajo el detalle. Se ajusta durante el render y no con un efecto que copia
  // datos a otro estado (regla de rendimiento del CLAUDE.md del front). Si el detalle se vuelve a consultar,
  // el borrador no se pisa: lo que esté escrito a medias es del usuario.
  if (detail && loadedUserId !== detail.id) {
    setLoadedUserId(detail.id);
    setDraft({ displayName: detail.displayName ?? "", roles: [...detail.roles] });
  }

  const mutation = useMutation({
    mutationFn: (values: DraftValues) =>
      updateUser(user.id, { displayName: values.displayName.trim() || null, roles: values.roles }),
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
    onError: (error) => setFormError(userActionErrorMessage(error, t)),
  });

  const availableRoles = rolesQuery.data ?? [];

  function toggleRole(name: string, checked: boolean) {
    setDraft((current) =>
      current === undefined
        ? current
        : {
            ...current,
            roles: checked ? [...current.roles, name] : current.roles.filter((role) => role !== name),
          },
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
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>{t("edit.description", { email: user.email })}</DialogDescription>
        </DialogHeader>

        {draft === undefined ? (
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
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(undefined);
              mutation.mutate(draft);
            }}
          >
            <FormField label={t("form.displayName")} hint={t("form.displayNameHint")}>
              <Input
                type="text"
                autoComplete="off"
                value={draft.displayName}
                onChange={(event) => setDraft({ ...draft, displayName: event.target.value })}
              />
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
                    checked={draft.roles.includes(role.name)}
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
                {t("edit.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
