import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createRole, fetchPermissions, permissionsQueryKey, updateRole, type RoleBody } from "../api/roles";
import { roleActionErrorMessage } from "../errors";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

/// Alta y edición de un rol. Sin `role` es un alta (`POST /api/roles`); con `role`, una edición
/// (`PUT /api/roles/{id}`). La pantalla lo monta solo mientras está abierto, así los campos arrancan con los
/// valores del rol que se está editando sin tener que copiarlos en un efecto.
export function RoleFormDialog({ role, onClose }: { role?: RoleListItem; onClose: () => void }) {
  const { t } = useTranslation("roles");
  const queryClient = useQueryClient();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>([...(role?.permissions ?? [])]);
  const [isNameMissing, setIsNameMissing] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const restoreFocus = useRestoreFocusOnClose();

  const groupsQuery = useQuery({ queryKey: permissionsQueryKey, queryFn: fetchPermissions });

  const mutation = useMutation({
    mutationFn: async (body: RoleBody) => {
      if (role) {
        await updateRole(role.id, body);

        return;
      }

      await createRole(body);
    },
    onSuccess: async () => {
      toast.success(role ? t("feedback.updated") : t("feedback.created"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
        // Cambiar los permisos de un rol puede cambiar los propios: el backend ya invalidó su caché.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
      onClose();
    },
    onError: (error) => setFormError(roleActionErrorMessage(error, t)),
  });

  const groups = groupsQuery.data ?? [];

  function togglePermission(code: string, checked: boolean) {
    setPermissions((current) => (checked ? [...current, code] : current.filter((permission) => permission !== code)));
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
          <DialogTitle>{role ? t("form.editTitle", { name: role.name }) : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(undefined);

            const trimmedName = name.trim();

            if (trimmedName === "") {
              setIsNameMissing(true);

              return;
            }

            setIsNameMissing(false);
            mutation.mutate({ name: trimmedName, description: description.trim() || null, permissions });
          }}
        >
          <FormField label={t("form.name")} required error={isNameMissing ? t("form.nameRequired") : undefined}>
            <Input type="text" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>

          <FormField label={t("form.descriptionLabel")} hint={t("form.descriptionHint")}>
            <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </FormField>

          <div className="flex max-h-64 flex-col gap-4 overflow-y-auto">
            {groupsQuery.isPending ? <Skeleton aria-hidden="true" className="h-24" /> : null}
            {groups.map((group) => (
              <fieldset key={group.area} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{group.name}</legend>
                {group.permissions.map((permission) => (
                  <CheckboxField
                    key={permission.code}
                    label={permission.name}
                    checked={permissions.includes(permission.code)}
                    onCheckedChange={(checked) => togglePermission(permission.code, checked)}
                  />
                ))}
              </fieldset>
            ))}
          </div>

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
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
