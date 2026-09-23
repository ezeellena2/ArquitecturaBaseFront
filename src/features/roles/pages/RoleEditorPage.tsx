import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { createRole, fetchPermissions, permissionsQueryKey, updateRole, type RoleBody } from "../api/roles";
import { PermissionPicker } from "../components/PermissionPicker";
import { RoleSummary } from "../components/RoleSummary";
import { roleActionErrorMessage } from "../errors";
import { sameSelection } from "../lib/permissionPicker";
import { isAdminRole } from "../lib/systemRoles";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { fetchRoles, rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

interface Draft {
  name: string;
  description: string;
  permissions: string[];
}

const emptyDraft: Draft = { name: "", description: "", permissions: [] };

function toDraft(role: RoleListItem): Draft {
  return { name: role.name, description: role.description ?? "", permissions: [...role.permissions] };
}

/// Si hay algo que guardar: se compara lo que se mandaría (recortado) y el conjunto de permisos, no el orden en
/// que se marcaron. Así, volver a dejar todo como estaba deja de ser un cambio.
function isSameDraft(first: Draft, second: Draft): boolean {
  return (
    first.name.trim() === second.name.trim() &&
    first.description.trim() === second.description.trim() &&
    sameSelection(first.permissions, second.permissions)
  );
}

/// Las dos columnas: la de la izquierda, de ancho fijo como en el tablero; en menos de `lg` se apilan.
const columnsClassName = "grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]";

const cardClassName =
  "overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]";

/// Un nombre de solo lectura (los roles del sistema) se ve como tal: apagado, pero legible y seleccionable.
const readOnlyClassName =
  "read-only:bg-[var(--color-surface-muted)] read-only:text-[var(--color-content-muted)] read-only:shadow-none";

/// Mientras llegan el rol y el catálogo: el esqueleto de las dos columnas, para que la pantalla no salte al
/// llenarse.
function EditorSkeleton(): ReactNode {
  return (
    <div aria-hidden="true" className={columnsClassName}>
      <div className={cn(cardClassName, "flex flex-col gap-2.5 p-4")}>
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-9" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-[74px]" />
      </div>
      <div className={cn(cardClassName, "flex flex-col gap-2 p-4")}>
        <Skeleton className="h-9" />
        <Skeleton className="h-[30px]" />
        <Skeleton className="h-[30px]" />
        <Skeleton className="h-[30px]" />
        <Skeleton className="h-[30px]" />
      </div>
    </div>
  );
}

/// La tarjeta "Datos del rol": nombre y descripción. Un rol del sistema no cambia de nombre, y Admin tampoco de
/// descripción: los campos siguen a la vista, de solo lectura, en vez de desaparecer.
function RoleDetails({
  draft,
  nameError,
  isSystemRole,
  readOnly,
  onNameChange,
  onDescriptionChange,
}: {
  draft: Draft;
  nameError: string | undefined;
  isSystemRole: boolean;
  readOnly: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}): ReactNode {
  const { t } = useTranslation("roles");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cardClassName}>
      <div className="flex h-10 items-center border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-4">
        <h2
          id={titleId}
          className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)]"
        >
          {t("editor.details")}
        </h2>
      </div>

      <div className="flex flex-col gap-3.5 p-4">
        <FormField
          label={t("form.name")}
          required={!isSystemRole}
          hint={isSystemRole ? t("editor.systemNameHint") : undefined}
          error={nameError}
        >
          <Input
            type="text"
            autoComplete="off"
            readOnly={isSystemRole}
            value={draft.name}
            onChange={(event) => onNameChange(event.target.value)}
            className={readOnlyClassName}
          />
        </FormField>

        <FormField label={t("form.descriptionLabel")}>
          {/* Tres renglones fijos, como en el tablero: con `field-sizing-content` (lo que trae shadcn) el
              navegador ignora `rows` y el campo crece y achica con cada tecla, empujando la tarjeta de abajo. */}
          <Textarea
            rows={3}
            readOnly={readOnly}
            placeholder={readOnly ? undefined : t("form.descriptionPlaceholder")}
            value={draft.description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className={cn("field-sizing-fixed min-h-0 resize-none", readOnlyClassName)}
          />
        </FormField>
      </div>
    </section>
  );
}

/// El alta (sin `roleId`) o la edición de un rol. `RoleEditorPage` la monta con una `key` por rol.
///
/// Al editar, el formulario **no** se siembra con el rol que había en el listado: ese puede estar viejo en la
/// caché, y como el PUT reemplaza la lista de permisos entera, guardar un cambio de nombre sobre un snapshot
/// viejo le borraría sin aviso un permiso que otro administrador acaba de agregar. Se piden los roles de
/// nuevo al entrar y se siembra con lo que vuelve.
function RoleEditor({ roleId }: { roleId: string | undefined }): ReactNode {
  const { t } = useTranslation("roles");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formId = useId();

  const isEditing = roleId !== undefined;

  const groupsQuery = useQuery({ queryKey: permissionsQueryKey, queryFn: fetchPermissions });

  const rolesQuery = useQuery({
    queryKey: rolesQueryKey,
    queryFn: fetchRoles,
    enabled: isEditing,
    refetchOnMount: "always",
  });

  // Mientras ese pedido está en vuelo, `rolesQuery.data` sigue siendo lo que había en caché: sembrar con eso
  // sería sembrar con lo viejo, que es justo lo que se quiere evitar. Por eso se espera a que termine.
  const freshRole =
    isEditing && !rolesQuery.isFetching ? rolesQuery.data?.find((item) => item.id === roleId) : undefined;

  const [seededRole, setSeededRole] = useState<RoleListItem | undefined>();
  const [draft, setDraft] = useState<Draft | undefined>(isEditing ? undefined : emptyDraft);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  // Se siembra una sola vez, durante el render y no con un efecto que copia datos a otro estado (regla de
  // rendimiento del CLAUDE.md del front). Lo que se pida después (al guardar se invalidan los roles) ya no pisa
  // lo que la persona está escribiendo.
  if (freshRole && seededRole === undefined) {
    setSeededRole(freshRole);
    setDraft(toDraft(freshRole));
  }

  const groups = groupsQuery.data;
  const isAdmin = seededRole ? isAdminRole(seededRole) : false;
  const isSystemRole = seededRole?.isSystemRole ?? false;
  const isReady = draft !== undefined && groups !== undefined;
  const isDirty = draft !== undefined && !isAdmin && !isSameDraft(draft, seededRole ? toDraft(seededRole) : emptyDraft);

  const guard = useUnsavedChangesGuard(isDirty);

  // El título y la miga siguen al nombre escrito, como en el tablero; Admin no se edita y se llama por su nombre.
  const typedName = draft?.name.trim() ?? "";
  const loadingLabel = t("editor.crumbLoading");

  useBreadcrumbLeaf(
    isEditing ? (draft === undefined ? loadingLabel : typedName || t("editor.crumbUnnamed")) : t("editor.crumbNew"),
  );

  const title = !isEditing
    ? t("editor.createTitle")
    : draft === undefined
      ? loadingLabel
      : isAdmin
        ? typedName
        : t("editor.editTitle", { name: typedName || t("editor.unnamed") });

  const mutation = useMutation({
    mutationFn: async (body: RoleBody) => {
      if (roleId === undefined) {
        await createRole(body);

        return;
      }

      await updateRole(roleId, body);
    },
    onSuccess: async () => {
      toast.success(isEditing ? t("feedback.updated") : t("feedback.created"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
        // Cambiar los permisos de un rol puede cambiar los propios: el backend ya invalidó su caché.
        queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
      ]);
      // Lo guardado ya no se pierde: la vuelta al listado no tiene por qué preguntar.
      guard.allowNextNavigation();
      void navigate("/roles");
    },
    onError: (error) => {
      // Lo que es del nombre va debajo del nombre; lo demás, arriba de las dos columnas.
      const nameMessage =
        error instanceof ApiError
          ? error.code === "Roles.Role.AlreadyExists"
            ? t("errors.alreadyExists")
            : error.errors?.name?.[0]
          : undefined;

      if (nameMessage) {
        setNameError(nameMessage);

        return;
      }

      setFormError(roleActionErrorMessage(error, t));
    },
  });

  // Solo cuentan los errores de antes de tener algo que mostrar. Si un pedido posterior falla (al guardar se
  // vuelven a pedir los roles), la pantalla no se cambia por un cartel y lo escrito sigue ahí.
  const rolesLoadError = isEditing && seededRole === undefined ? rolesQuery.error : null;
  const groupsLoadError = groups === undefined ? groupsQuery.error : null;
  const loadError = rolesLoadError ?? groupsLoadError;
  const apiLoadError = loadError instanceof ApiError ? loadError : undefined;

  // El rol no está: otro administrador lo borró, o el link es de antes. No hay nada que reintentar.
  const isRoleGone =
    isEditing && seededRole === undefined && rolesQuery.isSuccess && !rolesQuery.isFetching && freshRole === undefined;

  if (apiLoadError?.status === 403) {
    return <ForbiddenPage />;
  }

  function changeDraft(change: Partial<Draft>) {
    setDraft((current) => (current === undefined ? current : { ...current, ...change }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft === undefined || isAdmin) {
      return;
    }

    setFormError(undefined);

    const name = draft.name.trim();

    if (name === "") {
      setNameError(t("form.nameRequired"));

      return;
    }

    setNameError(undefined);
    mutation.mutate({ name, description: draft.description.trim() || null, permissions: draft.permissions });
  }

  const status =
    isSystemRole || isDirty ? (
      <>
        {isSystemRole ? <Badge variant="secondary">{t("systemBadge")}</Badge> : null}
        {isDirty ? (
          <span className="text-[12.5px] text-[var(--color-content-muted)]">
            <span aria-hidden="true">· </span>
            {t("editor.unsaved")}
          </span>
        ) : null}
      </>
    ) : undefined;

  const actions = !isReady ? undefined : isAdmin ? (
    // Admin no se cambia: en lugar de los botones, lo que tiene.
    <span className="text-[12.5px] text-[var(--color-content-muted)]">{t("editor.allPermissions")}</span>
  ) : (
    <>
      <Button asChild variant="outline">
        <Link to="/roles">{t("common:actions.cancel")}</Link>
      </Button>
      {/* Está en la banda, afuera del formulario: `form` lo ata a él, y así Enter en el nombre también guarda. */}
      <Button type="submit" form={formId} disabled={mutation.isPending}>
        {mutation.isPending ? t("editor.saving") : t("form.submit")}
      </Button>
    </>
  );

  return (
    <Page backTo={{ to: "/roles", label: t("editor.back") }} title={title} status={status} actions={actions}>
      {loadError ? (
        <EmptyState
          title={t("editor.loadError")}
          description={apiLoadError?.traceId ? t("errorTraceId", { traceId: apiLoadError.traceId }) : undefined}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (rolesLoadError) {
                  void rolesQuery.refetch();
                }

                if (groupsLoadError) {
                  void groupsQuery.refetch();
                }
              }}
            >
              {t("common:actions.retry")}
            </Button>
          }
        />
      ) : isRoleGone ? (
        <EmptyState
          title={t("editor.gone.title")}
          description={t("editor.gone.description")}
          action={
            <Button asChild variant="outline">
              <Link to="/roles">{t("editor.back")}</Link>
            </Button>
          }
        />
      ) : !isReady ? (
        <EditorSkeleton />
      ) : (
        <form id={formId} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          ) : null}

          <div className={columnsClassName}>
            {/* Adherida al scrollear, justo debajo de la banda (56 px) y el padding del cuerpo (24 px): con veinte
                áreas abiertas, el nombre y el resumen siguen a la vista. */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(3.5rem+1.5rem)]">
              <RoleDetails
                draft={draft}
                nameError={nameError}
                isSystemRole={isSystemRole}
                readOnly={isAdmin}
                onNameChange={(name) => {
                  changeDraft({ name });
                  // Escribir es corregir: el error se va y vuelve, si hace falta, al guardar.
                  setNameError(undefined);
                }}
                onDescriptionChange={(description) => changeDraft({ description })}
              />
              <RoleSummary
                groups={groups}
                picked={draft.permissions}
                onRemove={
                  isAdmin
                    ? undefined
                    : (code) => changeDraft({ permissions: draft.permissions.filter((item) => item !== code) })
                }
              />
            </div>

            <PermissionPicker
              groups={groups}
              picked={draft.permissions}
              onChange={(permissions) => changeDraft({ permissions })}
              readOnly={isAdmin}
            />
          </div>
        </form>
      )}

      <ConfirmDialog
        open={guard.isBlocked}
        onOpenChange={(next) => {
          if (!next) {
            guard.stay();
          }
        }}
        title={t("editor.discard.title")}
        description={t("editor.discard.description")}
        confirmLabel={t("editor.discard.confirm")}
        cancelLabel={t("editor.discard.stay")}
        destructive
        onConfirm={guard.leave}
      />
    </Page>
  );
}

/// `/roles/nuevo` y `/roles/{id}`: el alta y la edición de un rol en su propia pantalla (tableros "Roles · Editar
/// un rol" y "Roles · Estados y recorrido"). Con veinte áreas de permisos, un diálogo no tiene dónde crecer.
///
/// Ir de `/roles/abc` a `/roles/def` es la misma ruta con otro parámetro, así que react-router conserva el
/// elemento montado: sin la `key`, la pantalla seguiría con lo sembrado del rol anterior. Con ella, cada rol
/// arranca de cero.
export function RoleEditorPage(): ReactNode {
  const { roleId } = useParams();

  return <RoleEditor key={roleId ?? "new"} roleId={roleId} />;
}
