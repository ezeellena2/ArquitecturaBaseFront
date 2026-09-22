import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createRole, fetchPermissions, permissionsQueryKey, updateRole, type RoleBody } from "../api/roles";
import { roleActionErrorMessage } from "../errors";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { fetchRoles, rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

interface Draft {
  name: string;
  description: string;
  permissions: string[];
}

/// Alta y edición de un rol. Sin `role` es un alta (`POST /api/roles`); con `role`, una edición
/// (`PUT /api/roles/{id}`). La pantalla lo monta solo mientras está abierto.
///
/// Al editar, el formulario **no** se siembra con el rol que pasó el listado: ese puede estar viejo en la
/// caché, y como el PUT reemplaza la lista de permisos entera, guardar un cambio de nombre sobre un snapshot
/// viejo le borraría sin aviso un permiso que otro administrador acaba de agregar. Se piden los roles de
/// nuevo al abrir y se siembra con lo que vuelve.
export function RoleFormDialog({ role, onClose }: { role?: RoleListItem; onClose: () => void }) {
  const { t } = useTranslation("roles");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();

  const isEditing = role !== undefined;

  const rolesQuery = useQuery({
    queryKey: rolesQueryKey,
    queryFn: fetchRoles,
    enabled: isEditing,
    refetchOnMount: "always",
  });

  // Mientras ese pedido está en vuelo, `rolesQuery.data` sigue siendo lo que había en caché: sembrar con eso
  // sería sembrar con lo viejo, que es justo lo que se quiere evitar. Por eso se espera a que termine.
  const freshRole =
    isEditing && !rolesQuery.isFetching ? rolesQuery.data?.find((item) => item.id === role.id) : undefined;

  const [draft, setDraft] = useState<Draft | undefined>(
    isEditing ? undefined : { name: "", description: "", permissions: [] },
  );
  const [seededRoleId, setSeededRoleId] = useState<string | undefined>();
  const [isNameMissing, setIsNameMissing] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  // Se ajusta durante el render y no con un efecto que copia datos a otro estado (regla de rendimiento del
  // CLAUDE.md del front), igual que `UserRolesDialog`.
  if (freshRole && seededRoleId !== freshRole.id) {
    setSeededRoleId(freshRole.id);
    setDraft({
      name: freshRole.name,
      description: freshRole.description ?? "",
      permissions: [...freshRole.permissions],
    });
  }

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

  // El rol ya no está: otro administrador lo borró entre que se abrió el listado y se abrió este diálogo.
  const isRoleGone = isEditing && !rolesQuery.isFetching && rolesQuery.isSuccess && freshRole === undefined;

  function togglePermission(code: string, checked: boolean) {
    setDraft((current) =>
      current === undefined
        ? current
        : {
            ...current,
            permissions: checked
              ? [...current.permissions, code]
              : current.permissions.filter((permission) => permission !== code),
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
      {/* `p-0` y `gap-0` sobre lo que trae shadcn: el diálogo es una columna con encabezado y pie fijos y un
          cuerpo que scrollea, así que el padding lo pone cada parte. Con permisos de varias áreas, un diálogo
          que crece sin techo deja el botón de guardar abajo de la ventana. */}
      <DialogContent
        onCloseAutoFocus={restoreFocus}
        className="flex max-h-[min(720px,90svh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]"
      >
        <DialogHeader className="px-[18px] pt-[18px] pr-12">
          <DialogTitle>{role ? t("form.editTitle", { name: role.name }) : t("form.createTitle")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>

        {draft === undefined ? (
          rolesQuery.isError || isRoleGone ? (
            <div className="flex flex-col items-start gap-3 p-[18px]">
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {isRoleGone ? t("errors.gone") : roleActionErrorMessage(rolesQuery.error, t)}
              </p>
              {isRoleGone ? null : (
                <Button type="button" variant="outline" onClick={() => void rolesQuery.refetch()}>
                  {t("common:actions.retry")}
                </Button>
              )}
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
              setFormError(undefined);

              const trimmedName = draft.name.trim();

              if (trimmedName === "") {
                setIsNameMissing(true);

                return;
              }

              setIsNameMissing(false);
              mutation.mutate({
                name: trimmedName,
                description: draft.description.trim() || null,
                permissions: draft.permissions,
              });
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] py-4">
            <FormField label={t("form.name")} required error={isNameMissing ? t("form.nameRequired") : undefined}>
              <Input
                type="text"
                autoComplete="off"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </FormField>

            <FormField label={t("form.descriptionLabel")} hint={t("form.descriptionHint")}>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </FormField>

            <div className="flex flex-col gap-2.5">
              {/* Sin este rótulo el diálogo saltaba de "Descripción" a un bloque con los nombres de las áreas,
                  sin decir en ningún lado que eso son los permisos del rol. El contador va al lado y no
                  abajo: es lo que se mira mientras se marcan casillas, y hay que poder leerlo sin scrollear. */}
              <div className="flex items-baseline justify-between gap-2.5">
                <p className="text-sm font-medium text-[var(--color-content)]">{t("form.permissions")}</p>
                <p className="text-[12.5px] text-[var(--color-content-muted)]">
                  {t("form.permissionsPicked", { count: draft.permissions.length })}
                </p>
              </div>

              {groupsQuery.isPending ? <Skeleton aria-hidden="true" className="h-24" /> : null}
              {groups.map((group) => (
                <fieldset key={group.area} className="overflow-hidden rounded-[9px] border border-[var(--color-border)]">
                  {/* El `legend` queda oculto para la vista y la banda visible va aparte, con `aria-hidden`:
                      estilar un `legend` obliga a trucos frágiles, pero es de donde el `fieldset` saca su
                      nombre accesible. Si alguien "limpia" este legend, las cajas se quedan sin nombre para
                      el lector de pantalla; hay un test que se pone en rojo si pasa. */}
                  <legend className="sr-only">{group.name}</legend>
                  <div
                    aria-hidden="true"
                    className="flex h-[34px] items-center border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-3 text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)]"
                  >
                    {group.name}
                  </div>
                  <div className="flex flex-col gap-1 px-3 py-2">
                    {group.permissions.map((permission) => (
                      <CheckboxField
                        key={permission.code}
                        label={permission.name}
                        checked={draft.permissions.includes(permission.code)}
                        onCheckedChange={(checked) => togglePermission(permission.code, checked)}
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {formError}
              </p>
            ) : null}
            </div>

            <DialogFooter className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] px-[18px] py-3">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {t("form.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
