import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  createRole,
  fetchPermissions,
  permissionsQueryKey,
  roleDescriptionMaxLength,
  roleNameMaxLength,
  updateRole,
  type RoleBody,
} from "../api/roles";
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
  descriptionError,
  isSystemRole,
  readOnly,
  onNameChange,
  onDescriptionChange,
}: {
  draft: Draft;
  nameError: string | undefined;
  descriptionError: string | undefined;
  isSystemRole: boolean;
  readOnly: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
}): ReactNode {
  const { t } = useTranslation("roles");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn(cardClassName, "shrink-0")}>
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
            maxLength={roleNameMaxLength}
            value={draft.name}
            onChange={(event) => onNameChange(event.target.value)}
            className={readOnlyClassName}
          />
        </FormField>

        <FormField label={t("form.descriptionLabel")} error={descriptionError}>
          {/* Tres renglones fijos, como en el tablero: con `field-sizing-content` (lo que trae shadcn) el
              navegador ignora `rows` y el campo crece y achica con cada tecla, empujando la tarjeta de abajo. */}
          <Textarea
            rows={3}
            readOnly={readOnly}
            maxLength={roleDescriptionMaxLength}
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
  // sería sembrar con lo viejo, que es justo lo que se quiere evitar. Por eso se espera a que termine, y a que
  // termine bien: si falla, TanStack deja en `data` lo que había en caché, y sembrar con eso es lo mismo que no
  // haber esperado. Sin siembra, la pantalla muestra el error (o el sin permiso) y "Reintentar" pide de nuevo.
  const hasFreshRoles =
    isEditing && rolesQuery.isSuccess && rolesQuery.isFetchedAfterMount && !rolesQuery.isFetching;
  const freshRole = hasFreshRoles ? rolesQuery.data.find((item) => item.id === roleId) : undefined;

  const [seededRole, setSeededRole] = useState<RoleListItem | undefined>();
  const [draft, setDraft] = useState<Draft | undefined>(isEditing ? undefined : emptyDraft);
  const [nameError, setNameError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
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

  // El guardado sigue aunque la persona se vaya de la pantalla mientras tanto. Lo que es de la pantalla (volver
  // al listado, el error debajo del nombre) va en los callbacks de `mutate`, que TanStack no llama si ya se
  // desmontó; lo de `useMutation` corre siempre, y este ref le dice si la pantalla sigue ahí.
  const isOnScreenRef = useRef(false);

  useEffect(() => {
    isOnScreenRef.current = true;

    return () => {
      isOnScreenRef.current = false;
    };
  }, []);

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
    },
    onError: (error) => {
      // Si la persona se fue mientras se guardaba, no queda formulario donde mostrar el error, y sin un aviso
      // creería que se guardó.
      if (!isOnScreenRef.current) {
        toast.error(roleActionErrorMessage(error, t));
      }
    },
  });

  // Mientras se guarda, salir no pregunta: lo cambiado ya salió, y "no se guardó" no sería cierto.
  const guard = useUnsavedChangesGuard(isDirty && !mutation.isPending);

  // Solo cuentan los errores de antes de tener algo que mostrar. Si un pedido posterior falla (al guardar se
  // vuelven a pedir los roles), la pantalla no se cambia por un cartel y lo escrito sigue ahí.
  const rolesLoadError = isEditing && seededRole === undefined ? rolesQuery.error : null;
  const groupsLoadError = groups === undefined ? groupsQuery.error : null;
  const loadError = rolesLoadError ?? groupsLoadError;
  const apiLoadError = loadError instanceof ApiError ? loadError : undefined;

  // El rol no está: otro administrador lo borró, o el link es de antes. No hay nada que reintentar.
  const isRoleGone = hasFreshRoles && seededRole === undefined && freshRole === undefined;

  if (apiLoadError?.status === 403) {
    return <ForbiddenPage />;
  }

  function showSaveError(error: Error) {
    // Lo que es de un campo va debajo de ese campo; lo demás, arriba de las dos columnas.
    if (error instanceof ApiError && error.code === "Roles.Role.AlreadyExists") {
      setNameError(t("errors.alreadyExists"));

      return;
    }

    // Todos a la vez, no solo el primero. Uno de un campo que la pantalla no tiene (los permisos) va arriba con
    // su propio texto: el `detail` de una validación pide revisar los campos marcados, y no habría ninguno.
    const fieldErrors: Record<string, readonly string[] | undefined> =
      (error instanceof ApiError ? error.errors : undefined) ?? {};
    const { name, description, ...others } = fieldErrors;
    const nameMessage = name?.[0];
    const descriptionMessage = description?.[0];
    const otherMessage = Object.values(others).flat()[0];

    setNameError(nameMessage);
    setDescriptionError(descriptionMessage);

    if (otherMessage !== undefined || (nameMessage === undefined && descriptionMessage === undefined)) {
      setFormError(otherMessage ?? roleActionErrorMessage(error, t));
    }
  }

  function changeDraft(change: Partial<Draft>) {
    setDraft((current) => (current === undefined ? current : { ...current, ...change }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft === undefined || groups === undefined || isAdmin) {
      return;
    }

    setFormError(undefined);
    setDescriptionError(undefined);

    const name = draft.name.trim();

    if (name === "") {
      setNameError(t("form.nameRequired"));

      return;
    }

    setNameError(undefined);

    // Un código que el catálogo ya no declara (sacado del backend, pero todavía guardado en el rol) no tiene
    // casilla ni chip, así que no hay forma de quitarlo, y si viaja el backend rechaza el rol entero. Se limpia
    // al guardar y no al sembrar: sembrando sin él, la pantalla arrancaría con un cambio que nadie hizo.
    const catalog = new Set(groups.flatMap((group) => group.permissions.map((permission) => permission.code)));
    const permissions = draft.permissions.filter((code) => catalog.has(code));

    mutation.mutate(
      { name, description: draft.description.trim() || null, permissions },
      {
        // Solo si la pantalla sigue ahí: a quien se fue mientras se guardaba no se lo trae de vuelta al listado.
        onSuccess: () => {
          // Lo guardado ya no se pierde: la vuelta al listado no tiene por qué preguntar.
          guard.allowNextNavigation();
          void navigate("/roles");
        },
        onError: showSaveError,
      },
    );
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
                áreas abiertas, el nombre y el resumen siguen a la vista. Y nunca más alta que lo que queda de
                pantalla (la barra superior, la banda y el padding de arriba y de abajo): en una notebook, con
                muchos elegidos, el final del resumen quedaba debajo del borde hasta llegar al fondo del selector.
                El que se achica es el resumen, que ya tiene scroll propio; los datos del rol no. */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(3.5rem+1.5rem)] lg:max-h-[calc(100svh-4rem-3.5rem-3rem)]">
              <RoleDetails
                draft={draft}
                nameError={nameError}
                descriptionError={descriptionError}
                isSystemRole={isSystemRole}
                readOnly={isAdmin}
                onNameChange={(name) => {
                  changeDraft({ name });
                  // Escribir es corregir: el error se va y vuelve, si hace falta, al guardar.
                  setNameError(undefined);
                }}
                onDescriptionChange={(description) => {
                  changeDraft({ description });
                  setDescriptionError(undefined);
                }}
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
