import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import {
  createRole,
  fetchPermissions,
  fetchRole,
  permissionsQueryKey,
  roleDescriptionMaxLength,
  roleNameMaxLength,
  roleQueryKey,
  updateRole,
  type PermissionGroup,
  type RoleBody,
} from "../api/roles";
import { PermissionAreaLoading, PermissionPicker } from "../components/PermissionPicker";
import { roleActionErrorMessage } from "../errors";
import { allowedPermissions, sameSelection } from "../lib/permissionPicker";
import { isAdminRole } from "../lib/systemRoles";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";

interface Draft {
  name: string;
  description: string;
  permissions: string[];
}

const emptyDraft: Draft = { name: "", description: "", permissions: [] };

/// Un rol se lee con lo que permite de verdad: lo guardado más lo que incluye cada permiso. Un rol viejo con «Administrar
/// usuarios» y sin «Ver usuarios» abre con los dos sin que sea un cambio de nadie, y al guardar se manda lo que permite.
function toDraft(role: RoleListItem, groups: readonly PermissionGroup[]): Draft {
  return { name: role.name, description: role.description ?? "", permissions: allowedPermissions(groups, role.permissions) };
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

/// Conservar mis cambios tras un conflicto de revisión (N2): de lo guardado ahora, con lo que el borrador cambió desde lo
/// sembrado. Los permisos se mezclan de a uno, como cada ajuste en Configuración: quedan los que sumó el borrador, se van
/// los que sacó, y del resto vale lo guardado. Lo que queda suma lo que incluye, como todo lo que el rol permite: un permiso
/// que trajo lo guardado puede incluir uno que el borrador había sacado.
function keepDraftChanges(draft: Draft, seeded: Draft, current: Draft, groups: readonly PermissionGroup[]): Draft {
  return {
    name: draft.name.trim() === seeded.name.trim() ? current.name : draft.name,
    description: draft.description.trim() === seeded.description.trim() ? current.description : draft.description,
    permissions: allowedPermissions(groups, [
      ...current.permissions.filter((code) => draft.permissions.includes(code) || !seeded.permissions.includes(code)),
      ...draft.permissions.filter((code) => !seeded.permissions.includes(code) && !current.permissions.includes(code)),
    ]),
  };
}

/// La comparación de un conflicto de revisión (N2), como la de Configuración (`SettingsReview`): sólo lo distinto entre lo
/// guardado y lo que quedaría al conservar mis cambios (`kept`), lado a lado (LR2-A). Cada permiso que difiere va con su
/// nombre, en el orden del catálogo. Las dos versiones llegan con lo que permiten (`toDraft`): un permiso incluido no es una
/// diferencia si las dos lo permiten.
function RoleReview({ current, kept, groups, disabled, titleRef, onAccept }: {
  current: Draft;
  kept: Draft;
  groups: readonly PermissionGroup[];
  disabled: boolean;
  titleRef: Ref<HTMLHeadingElement>;
  onAccept: (keepDraft: boolean) => void;
}): ReactNode {
  const { t } = useTranslation("roles");
  const names = new Map(groups.flatMap((group) => group.permissions.map((permission) => [permission.code, permission.name] as const)));
  const codes = [...new Set([...names.keys(), ...current.permissions, ...kept.permissions])];
  const text = (value: string) => <CellText text={value === "" ? "—" : value} />;
  const has = (on: boolean) => <CellText text={t(on ? "editor.review.has" : "editor.review.hasNot")} />;
  const changes = [
    ...(current.name.trim() === kept.name.trim() ? [] : [{ key: "name", identity: [t("form.name")],
      lines: [{ key: "value", before: text(current.name.trim()), after: text(kept.name.trim()) }] }]),
    ...(current.description.trim() === kept.description.trim() ? [] : [{ key: "description", identity: [t("form.descriptionLabel")],
      lines: [{ key: "value", before: text(current.description.trim()), after: text(kept.description.trim()) }] }]),
    ...codes.filter((code) => current.permissions.includes(code) !== kept.permissions.includes(code)).map((code) => ({
      key: code, identity: [names.get(code) ?? code],
      lines: [{ key: "value", before: has(current.permissions.includes(code)), after: has(kept.permissions.includes(code)) }],
    })),
  ];

  return (
    <Surface title={t("common:revisionReview.title")} titleRef={titleRef} padded actions={<>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("common:revisionReview.useCurrent")}</Button>
      <Button type="button" disabled={disabled} onClick={() => onAccept(true)}>{t("common:revisionReview.keepMine")}</Button>
    </>}>
      <ComparisonTable columns={{ identity: [{ key: "field", header: t("common:revisionReview.field") }], before: t("common:revisionReview.current"), after: t("common:revisionReview.mine") }} groups={changes} />
    </Surface>
  );
}

const detailsClassName = "grid w-full max-w-2xl grid-cols-1 gap-3.5";

/// El largo de cada nombre de área mientras carga, para que las bandas no parezcan una sola barra.
const loadingAreaNames = ["w-20", "w-14", "w-28", "w-24", "w-36"];

/// Mantiene el espacio de los datos y de la lista de permisos mientras llegan el rol y el catálogo (ES3): la tabla con su
/// encabezado y unas bandas de área, cerradas, con el lugar de la flecha, la casilla y el nombre (`PermissionAreaLoading`).
function EditorSkeleton(): ReactNode {
  const { t } = useTranslation("roles");

  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Surface padded><div className={detailsClassName}>
        <div className="space-y-2.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-9" /></div>
        <div className="space-y-2.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-16" /></div>
      </div></Surface>
      <Surface>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("picker.permission")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody striped={false}>
            {loadingAreaNames.map((width) => (
              <PermissionAreaLoading key={width} nameWidth={width} />
            ))}
          </TableBody>
        </Table>
      </Surface>
    </div>
  );
}

/// Nombre y descripción, sin panel lateral. Un rol del sistema no cambia de nombre, y Admin tampoco de
/// descripción: los campos siguen a la vista, de solo lectura, en vez de desaparecer. Por qué el nombre de User no se
/// cambia no es obvio y va en la (i) de «Nombre»; el de Admin lo dice la (i) del título, que vale para todo el rol.
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
    <Surface padded><section aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">{t("editor.details")}</h2>
      <div className={detailsClassName}>
        <FormField
          label={t("form.name")}
          required={!isSystemRole}
          help={isSystemRole && !readOnly ? t("form.systemNameHelp") : undefined}
          error={nameError}
        >
          <Input
            type="text"
            autoComplete="off"
            readOnly={isSystemRole}
            maxLength={roleNameMaxLength}
            value={draft.name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </FormField>

        <FormField label={t("form.descriptionLabel")} error={descriptionError}>
          <Textarea
            rows={2}
            readOnly={readOnly}
            maxLength={roleDescriptionMaxLength}
            placeholder={readOnly ? undefined : t("form.descriptionPlaceholder")}
            value={draft.description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className="field-sizing-fixed min-h-0 resize-none"
          />
        </FormField>
      </div>
    </section></Surface>
  );
}

/// El alta (sin `roleId`) o la edición de un rol. `RoleEditorPage` la monta con una `key` por rol.
///
/// Al editar, el formulario **no** se siembra con lo que había en caché: puede estar viejo, y como el PUT reemplaza
/// la lista de permisos entera, guardar un cambio de nombre sobre un snapshot viejo le borraría sin aviso un permiso
/// que otro administrador acaba de agregar. Se pide el rol de nuevo al entrar (`GET /api/roles/{id}`) y se siembra
/// con lo que vuelve.
function RoleEditor({ roleId }: { roleId: string | undefined }): ReactNode {
  const { t } = useTranslation("roles");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formId = useId();

  const isEditing = roleId !== undefined;

  const groupsQuery = useQuery({ queryKey: permissionsQueryKey, queryFn: fetchPermissions });

  // Sin `roleId` la consulta está apagada: la clave con "new" solo existe para que el hook tenga una.
  const roleQuery = useQuery({
    queryKey: roleQueryKey(roleId ?? "new"),
    queryFn: () => fetchRole(roleId ?? ""),
    enabled: isEditing,
    refetchOnMount: "always",
  });

  // Mientras ese pedido está en vuelo, `roleQuery.data` sigue siendo lo que había en caché: sembrar con eso
  // sería sembrar con lo viejo, que es justo lo que se quiere evitar. Por eso se espera a que termine, y a que
  // termine bien: si falla, TanStack deja en `data` lo que había en caché, y sembrar con eso es lo mismo que no
  // haber esperado. Sin siembra, la pantalla muestra el error (o el sin permiso) y "Reintentar" pide de nuevo.
  const hasFreshRole = isEditing && roleQuery.isSuccess && roleQuery.isFetchedAfterMount && !roleQuery.isFetching;
  // null es el 404: el rol no existe.
  const freshRole = hasFreshRole ? (roleQuery.data ?? undefined) : undefined;

  const [seededRole, setSeededRole] = useState<RoleListItem | undefined>();
  const [draft, setDraft] = useState<Draft | undefined>(isEditing ? undefined : emptyDraft);
  const [nameError, setNameError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  // Un 409 de revisión (N2) conserva el borrador y pide releer antes de volver a guardar, como Configuración.
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<RoleListItem | undefined>();
  const [reading, setReading] = useState(false);
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const reviewNoticeId = `roles:review:${roleId ?? "new"}`;
  useEffect(() => () => dismissNotification(reviewNoticeId), [reviewNoticeId]);
  // La comparación aparece al final del contenido, a veces fuera de la vista: cada lectura lleva el foco a su título.
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);

  const groups = groupsQuery.data;

  // Se siembra una sola vez, durante el render y no con un efecto que copia datos a otro estado (regla de
  // rendimiento del CLAUDE.md del front). Lo que se pida después (al guardar se invalidan los roles) ya no pisa
  // lo que la persona está escribiendo. Espera también al catálogo, que dice qué incluye cada permiso: el borrador
  // arranca con lo que el rol permite de verdad.
  if (freshRole && groups && seededRole === undefined) {
    setSeededRole(freshRole);
    setDraft(toDraft(freshRole, groups));
  }

  // Lo sembrado, con lo que permite: con eso se compara si hay cambios, y un área con algo guardado arranca abierta.
  const seeded = seededRole === undefined || groups === undefined ? emptyDraft : toDraft(seededRole, groups);
  // Tras un conflicto de revisión (N2), lo releído y lo que quedaría al conservar mis cambios, que compara `RoleReview`.
  const reviewed = review === undefined || groups === undefined ? undefined : toDraft(review, groups);
  const kept = reviewed === undefined || draft === undefined || groups === undefined ? undefined : keepDraftChanges(draft, seeded, reviewed, groups);

  // Si conservar mis cambios deja justo lo guardado ahora (saqué «Ver usuarios» y otro sumó «Administrar usuarios», que lo
  // vuelve a incluir), no hay nada que elegir: los dos botones darían lo mismo y la comparación quedaría vacía. Se adopta
  // lo releído, como cuando el reintento guarda solo, y el motivo de lo incluido dice por qué volvió. Durante el render,
  // como la siembra: así vale el borrador de ahora, aunque la lectura la haya pedido el aviso de antes.
  if (review !== undefined && reviewed !== undefined && kept !== undefined && isSameDraft(kept, reviewed)) {
    setDraft(reviewed);
    setSeededRole(review);
    setNeedsReview(false);
    setReview(undefined);
    setNameError(undefined);
    setDescriptionError(undefined);
  }

  const isAdmin = seededRole ? isAdminRole(seededRole) : false;
  const isSystemRole = seededRole?.isSystemRole ?? false;
  const isReady = draft !== undefined && groups !== undefined;
  const isDirty = draft !== undefined && !isAdmin && !isSameDraft(draft, seeded);
  // Un código que el catálogo cargado no declara (sacado del backend, o de un módulo que este navegador todavía no
  // conoce) no tiene casilla, así que no hay forma de quitarlo, y si viaja el backend rechaza el rol entero. Se limpia al
  // guardar y no al sembrar (sembrando sin él, la pantalla arrancaría con un cambio que nadie hizo), y antes se avisa
  // cuáles se pierden (B2).
  const catalog = groups === undefined ? undefined : new Set(groups.flatMap((group) => group.permissions.map((permission) => permission.code)));
  const unknownPermissions = draft === undefined || catalog === undefined ? [] : draft.permissions.filter((code) => !catalog.has(code));

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
    mutationFn: async ({ body, base }: { body: RoleBody; base: RoleListItem | undefined }) => {
      if (roleId === undefined) {
        await createRole(body);

        return;
      }

      try {
        await updateRole(roleId, body, base?.revision ?? 0);
      } catch (error) {
        // 409 de revisión (N2): relee el rol. Si lo que el PUT reemplaza (el nombre, la descripción y los permisos) sigue
        // como cuando se sembró, no hay nada ajeno que pisar y guarda una sola vez más con la revisión releída, como el
        // idioma del menú. Si algo difiere, la relectura falla o el reintento vuelve a chocar, queda el 409 y se revisa.
        if (!(error instanceof ApiError && error.code === "Roles.Role.RevisionConflict")) throw error;
        const current = await queryClient
          .fetchQuery({ queryKey: roleQueryKey(roleId), queryFn: () => fetchRole(roleId), staleTime: 0, meta: { errorOwner: "local" } })
          .catch(() => undefined);
        // Se compara lo que permite cada versión: un rol viejo guardado sin lo incluido no es otra cosa.
        if (!current || !base || !isSameDraft(toDraft(current, groups ?? []), toDraft(base, groups ?? []))) throw error;
        await updateRole(roleId, body, current.revision);
      }
    },
    onSuccess: async () => {
      notify({ id: "features/roles/pages/RoleEditorPage:1", kind: "success", message: isEditing ? t("feedback.updated") : t("feedback.created") });
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
        notify({ id: "features/roles/pages/RoleEditorPage:2", kind: "error", message: roleActionErrorMessage(error, t) });
      }
    },
  });

  // Mientras se guarda, salir no pregunta: lo cambiado ya salió, y "no se guardó" no sería cierto.
  const guard = useUnsavedChangesGuard(isDirty && !mutation.isPending);

  // Solo cuentan los errores de antes de tener algo que mostrar. Si un pedido posterior falla (al guardar se
  // vuelven a pedir los roles), la pantalla no se cambia por un cartel y lo escrito sigue ahí.
  const roleLoadError = isEditing && seededRole === undefined ? roleQuery.error : null;
  const groupsLoadError = groups === undefined ? groupsQuery.error : null;
  const loadError = roleLoadError ?? groupsLoadError;
  const apiLoadError = loadError instanceof ApiError ? loadError : undefined;

  // El rol no está: otro administrador lo borró, o el link es de antes. No hay nada que reintentar.
  const isRoleGone = hasFreshRole && seededRole === undefined && roleQuery.data === null;

  if (apiLoadError?.status === 403) {
    return <ForbiddenPage title={t("title")} backTo={{ to: "/roles", label: t("editor.back") }} />;
  }

  /// Relee el rol para comparar (N2): la lectura queda en caché y la comparación, hasta elegir.
  async function readCurrent() {
    if (roleId === undefined || !isOnScreenRef.current) return;
    setReading(true);
    try {
      const current = await queryClient.fetchQuery({ queryKey: roleQueryKey(roleId), queryFn: () => fetchRole(roleId), staleTime: 0, meta: { errorOwner: "local" } });
      if (!isOnScreenRef.current) return;
      if (current === null) {
        // Lo borraron mientras tanto: no hay con qué comparar ni dónde guardar.
        notify({ id: reviewNoticeId, kind: "error", message: t("editor.gone.title"), description: t("editor.gone.description") });

        return;
      }

      setReview(current);
      dismissNotification(reviewNoticeId);
    } catch (error) {
      if (!isOnScreenRef.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind !== "session") notify({ id: reviewNoticeId, kind: "error", message: t("editor.reviewFailed"),
        description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } });
    } finally {
      if (isOnScreenRef.current) setReading(false);
    }
  }

  /// Conservar mis cambios mezcla lo guardado con lo que cambió el borrador; usar lo actual lo descarta. En los dos casos
  /// lo leído pasa a ser el punto de partida, con su revisión.
  function acceptReview(keepDraft: boolean) {
    if (review === undefined || reviewed === undefined || kept === undefined) return;
    // Conservar deja lo que mostraba la columna «Mi borrador» de la comparación.
    setDraft(keepDraft ? kept : reviewed);
    setSeededRole(review);
    setNeedsReview(false);
    setReview(undefined);
    setNameError(undefined);
    setDescriptionError(undefined);
    dismissNotification(reviewNoticeId);
  }

  function showSaveError(error: Error) {
    if (error instanceof ApiError && error.code === "Roles.Role.RevisionConflict") {
      setNeedsReview(true);
      notify({ id: reviewNoticeId, kind: "error", message: roleActionErrorMessage(error, t),
        action: { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } });

      return;
    }

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
      notify({ id: `roles:save:${roleId ?? "new"}`, kind: "error", message: otherMessage ?? roleActionErrorMessage(error, t) });
    }
  }

  function changeDraft(change: Partial<Draft>) {
    setDraft((current) => (current === undefined ? current : { ...current, ...change }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draft === undefined || groups === undefined || isAdmin || needsReview || reading) {
      return;
    }

    setDescriptionError(undefined);

    const name = draft.name.trim();

    if (name === "") {
      setNameError(t("form.nameRequired"));

      return;
    }

    setNameError(undefined);

    if (unknownPermissions.length > 0) {
      setConfirmingDrop(true);

      return;
    }

    save();
  }

  function save() {
    if (draft === undefined || catalog === undefined) {
      return;
    }

    const permissions = draft.permissions.filter((code) => catalog.has(code));

    mutation.mutate(
      { body: { name: draft.name.trim(), description: draft.description.trim() || null, permissions }, base: seededRole },
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

  // Admin no se cambia: sin botones. Sus áreas arrancan cerradas y la banda no lleva tilde ni casilla: que tiene todos los
  // permisos y que por eso no se cambia lo dice la (i) del título (RO1-A).
  // Tras un 409 de revisión, «Revisar valores actuales» va en la banda antes de Cancelar, y Guardar se apaga con el motivo
  // hasta elegir, aunque se cierre el aviso (como en Configuración).
  const reviewReason = needsReview && !reading ? t("common:revisionReview.pending") : null;
  const actions = !isReady || isAdmin ? undefined : (
    <>
      {needsReview ? (
        <Button type="button" variant="outline" pending={reading} disabled={reading || mutation.isPending} onClick={() => void readCurrent()}>
          {reading ? t("common:revisionReview.reading") : t("common:revisionReview.action")}
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <Link to="/roles">{t("common:actions.cancel")}</Link>
      </Button>
      {/* Está en la banda, afuera del formulario: `form` lo ata a él, y así Enter en el nombre también guarda.
          Sin cambios se deshabilita: habilitado ya dice que hay algo que guardar, sin un «Cambios sin guardar». */}
      <DisabledReason reason={reviewReason}>
        <Button type="submit" form={formId} pending={mutation.isPending} disabled={!isDirty || needsReview || reading}>
          {mutation.isPending ? t("editor.saving") : t("form.submit")}
        </Button>
      </DisabledReason>
    </>
  );

  return (
    <Page backTo={{ to: "/roles", label: t("editor.back") }} title={title} help={isAdmin ? t("editor.adminHelp") : undefined} actions={actions}>
      {loadError ? (
        <EmptyState
          title={t("editor.loadError")}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (roleLoadError) {
                  void roleQuery.refetch();
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
        <form id={formId} noValidate onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-6">

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

          <PermissionPicker
            groups={groups}
            picked={draft.permissions}
            saved={seeded.permissions}
            onChange={(permissions) => changeDraft({ permissions })}
            readOnly={isAdmin}
          />

          {reviewed === undefined || kept === undefined ? null : (
            <RoleReview current={reviewed} kept={kept} groups={groups} disabled={reading || mutation.isPending} titleRef={reviewTitle} onAccept={acceptReview} />
          )}
        </form>
      )}

      <ConfirmDialog
        open={confirmingDrop}
        onOpenChange={setConfirmingDrop}
        title={t("editor.unknownPermissions.title")}
        description={t("editor.unknownPermissions.description", { count: unknownPermissions.length, codes: unknownPermissions.join(", ") })}
        confirmLabel={t("editor.unknownPermissions.confirm")}
        destructive
        onConfirm={save}
      />

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
