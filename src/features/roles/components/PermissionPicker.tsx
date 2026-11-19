import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PermissionGroup, PermissionItem } from "../api/roles";
import { allowedPermissions, areaHelp, areaProgress, areaStartsOpen, changePermission, includedBy, toggleArea } from "../lib/permissionPicker";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { CheckIcon, ChevronRightIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

interface PermissionPickerProps {
  groups: readonly PermissionGroup[];
  /// Lo que el rol permite: lo elegido con lo que incluye (`allowedPermissions`).
  picked: readonly string[];
  /// Lo guardado del rol: un área con algo guardado arranca abierta, aunque después se le quite todo.
  saved: readonly string[];
  onChange: (picked: string[]) => void;
  /// Admin: se lee lo que tiene, con una tilde, y no se cambia.
  readOnly?: boolean;
}

/// Lo que comparten las filas de un área: el catálogo, lo elegido, si se lee o se elige, y cómo cambia.
interface AreaPartProps {
  groups: readonly PermissionGroup[];
  picked: readonly string[];
  readOnly: boolean;
  onChange: (picked: string[]) => void;
}

/// La celda de cada fila: el alto lo pone su contenido, el nombre se corta en renglones a 320 px en lugar de desplazar la
/// tabla de costado, y una casilla no le quita el margen derecho, como hace la tabla con una columna de casillas.
const cellClassName = "whitespace-normal py-0 [&:has([role=checkbox])]:pr-4";

/// La banda del área, con los tokens y las medidas de `TableSectionToggle`: 40 px de alto (44 debajo de `sm`, el mismo
/// corte de la biblioteca), 10 px entre lo que lleva, el nombre en `font-medium` y la flecha de 14 px. No es ese botón
/// porque lleva al frente la casilla del área, y una casilla no puede ir dentro de un botón (roles-y-permisos.md).
const bandClassName = "flex min-h-10 items-center gap-2.5 text-sm text-[var(--color-content)] max-sm:min-h-11";

/// Las zonas para tocar la flecha y la casilla del área, que no se pisan; la etiqueta le pasa el clic a su control.
/// - En escritorio miden 24 px, y los márgenes negativos dejan entre los dibujos los 10 px del `gap-2.5`: la flecha empieza
///   en el borde del contenido, como en `TableSectionToggle`, y el cuadradito a 24 px, donde empieza cada permiso.
/// - En el celular miden 44 × 44 y van una al lado de la otra: la flecha, desde 14 px antes del contenido hasta 30; la
///   casilla, de 30 a 74, con el cuadradito de 44 a 60; el nombre, desde 74. Sin la casilla (Admin), el nombre empieza en
///   44, sobre las tildes.
const arrowTarget = "inline-flex size-6 shrink-0 items-center justify-center -mx-1.25 max-sm:size-11 max-sm:-ml-3.5 max-sm:mr-1";
const checkTarget = "inline-flex size-6 shrink-0 items-center justify-center -mx-1 max-sm:size-11 max-sm:-ml-3.5 max-sm:-mr-2.5";

/// Un permiso empieza donde el cuadradito de la casilla del área, y su nombre, donde el nombre del área: en el celular,
/// los 14 px que la zona de esa casilla deja hasta el nombre. En Admin, que no tiene la casilla del área, la tilde queda
/// debajo del nombre del área.
const permissionRow = "flex min-h-9 items-center gap-2.5 pl-6 max-sm:min-h-11 max-sm:gap-3.5 max-sm:pl-11";

/// Los permisos de un rol (tablero RO3-D del lienzo «Roles y permisos: rediseño», 2026-11-19), igual en escritorio y en el
/// celular: una tabla de una columna, «Permiso», con una banda por área (la flecha, la casilla del área, el nombre y su (i))
/// y, abierta, una fila por permiso con su casilla y su nombre entero. Sin buscador, filtros ni descripciones a la vista: qué
/// permite cada permiso va en la (i) del área.
///
/// Un permiso marcado marca lo que incluye («Administrar usuarios» incluye «Ver usuarios») y lo deja apagado, con el motivo
/// encima (MA1-A); quitarlo deja lo incluido marcado. Lo elegido lo guarda la pantalla; el selector sólo guarda qué áreas
/// abrió o cerró la persona.
export function PermissionPicker({ groups, picked, saved, onChange, readOnly = false }: PermissionPickerProps): ReactNode {
  const { t } = useTranslation("roles");
  const titleId = useId();
  // Las áreas que la persona abrió o cerró; las demás siguen a lo que tienen (`areaStartsOpen`).
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});
  const part = { groups, picked, readOnly, onChange };

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <h2 id={titleId} className="sr-only">
        {t("picker.title")}
      </h2>
      <Surface>
        <Table aria-labelledby={titleId}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("picker.permission")}</TableHead>
            </TableRow>
          </TableHeader>
          {groups.map((group) => {
            // Admin tiene todo: sus áreas empiezan cerradas, y cada una se abre para leer los nombres.
            const open = toggled[group.area] ?? (!readOnly && areaStartsOpen(group, saved, picked));

            return (
              <PermissionArea
                key={group.area}
                group={group}
                open={open}
                onToggle={() => setToggled((current) => ({ ...current, [group.area]: !open }))}
                {...part}
              />
            );
          })}
        </Table>
      </Surface>
    </section>
  );
}

/// Un área: su banda y, abierta, sus permisos. Es un grupo de filas nombrado por el área, para el lector de pantalla.
function PermissionArea({ group, open, onToggle, ...part }: AreaPartProps & { group: PermissionGroup; open: boolean; onToggle: () => void }): ReactNode {
  const { t } = useTranslation("roles");
  const arrowId = useId();
  const nameId = useId();
  // Admin lee lo que tiene: sólo esos permisos, cada uno con su tilde.
  const permissions = part.readOnly ? group.permissions.filter((permission) => part.picked.includes(permission.code)) : group.permissions;

  return (
    <TableBody striped={false} aria-labelledby={nameId}>
      <TableRow tone="section" highlightExpanded={false}>
        <TableCell className={cellClassName}>
          <div className={bandClassName}>
            <label className={arrowTarget}>
              <Button
                id={arrowId}
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-expanded={open}
                aria-label={t(open ? "picker.close" : "picker.open", { area: group.name })}
                onClick={onToggle}
              >
                <ChevronRightIcon className={cn("size-3.5 text-[var(--color-content-muted)] transition-transform motion-reduce:transition-none", open ? "rotate-90" : "")} />
              </Button>
            </label>
            {/* Admin no tiene la casilla del área, ni una tilde en su lugar: lo que tiene se lee al abrirla. */}
            {part.readOnly ? null : <AreaCheckbox group={group} groups={part.groups} picked={part.picked} onChange={part.onChange} />}
            {/* El nombre también abre y cierra, con el mouse o un toque: es otra etiqueta de la flecha, que es la que está en el
                recorrido del teclado. Lleva el `py-2` de `TableSectionToggle`, que separa de los bordes un nombre en dos renglones. */}
            <label id={nameId} htmlFor={arrowId} className="min-w-0 cursor-pointer py-2 font-medium">
              {group.name}
            </label>
            <span className="-my-1 inline-flex">
              <InfoTip text={areaHelp(group)} label={t("common:actions.moreInfo", { label: group.name })} />
            </span>
          </div>
        </TableCell>
      </TableRow>
      {open
        ? permissions.map((permission) =>
            part.readOnly ? (
              <ReadPermission key={permission.code} permission={permission} />
            ) : (
              <PermissionChoice key={permission.code} permission={permission} groups={part.groups} picked={part.picked} onChange={part.onChange} />
            ),
          )
        : null}
    </TableBody>
  );
}

/// Elige o quita el área entera: vacía, parcial o completa. La lleva toda área, también la de un solo permiso, para elegirla
/// sin abrirla. Elegir el área suma también lo que incluyen sus permisos.
function AreaCheckbox({ group, groups, picked, onChange }: Omit<AreaPartProps, "readOnly"> & { group: PermissionGroup }): ReactNode {
  const { t } = useTranslation("roles");
  const progress = areaProgress(group, picked);

  return (
    <label className={checkTarget}>
      <Checkbox
        aria-label={t(progress.all ? "picker.clearAllFor" : "picker.pickAllFor", { area: group.name })}
        checked={progress.all ? true : progress.picked > 0 ? "indeterminate" : false}
        onCheckedChange={() => onChange(allowedPermissions(groups, toggleArea(group, picked)))}
      />
    </label>
  );
}

/// Un permiso con su casilla y su nombre entero: tocar el nombre lo marca. Lo que permite es la descripción accesible de la
/// casilla; a la vista va en la (i) del área. Si un permiso marcado lo incluye, queda marcado y apagado con el motivo, que
/// nombra a todos los que lo incluyen.
function PermissionChoice({ permission, groups, picked, onChange }: Omit<AreaPartProps, "readOnly"> & { permission: PermissionItem }): ReactNode {
  const { t, i18n } = useTranslation("roles");
  const descriptionId = useId();
  const checked = picked.includes(permission.code);
  const includers = checked ? includedBy(groups, picked, permission.code) : [];
  // «Lo incluye «X».» con uno; con más, los nombra a todos con la conjunción del idioma: «Lo incluyen «X» y «Y».».
  const reason = includers.length === 0 ? null : t("picker.includedBy", {
    count: includers.length,
    names: new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(includers.map((name) => t("picker.quoted", { name }))),
  });

  return (
    <TableRow>
      <TableCell className={cellClassName}>
        <label className={cn("relative", permissionRow, reason ? "" : "cursor-pointer")}>
          {/* Con motivo, el envoltorio de la casilla se estira sobre la fila, como en `CheckboxField`: la fila entera muestra
              el motivo, anclado en el cuadradito, y un clic no la cambia. */}
          <DisabledReason reason={reason} className="after:absolute after:inset-0">
            <Checkbox
              checked={checked}
              aria-describedby={descriptionId}
              onCheckedChange={(value) => onChange(changePermission(groups, picked, permission.code, value === true))}
            />
          </DisabledReason>
          {permission.name}
        </label>
        <span id={descriptionId} hidden>
          {permission.description}
        </span>
      </TableCell>
    </TableRow>
  );
}

/// Un permiso de Admin: una tilde y su nombre, sin casilla.
function ReadPermission({ permission }: { permission: PermissionItem }): ReactNode {
  return (
    <TableRow>
      <TableCell className={cellClassName}>
        <span className={permissionRow}>
          <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-[var(--color-brand-600)]" />
          {permission.name}
        </span>
      </TableCell>
    </TableRow>
  );
}

/// Una banda cerrada mientras llegan el rol y el catálogo (ES3), con el lugar de la flecha, la casilla y el nombre en las
/// mismas zonas que la banda de verdad. Los bloques sobre la banda son un tinte de su texto (`loading-tint`): el gris de
/// carga casi no se distingue de ella.
export function PermissionAreaLoading({ nameWidth }: { nameWidth: string }): ReactNode {
  return (
    <TableRow tone="section" highlightExpanded={false}>
      <TableCell className={cellClassName}>
        <div className={bandClassName}>
          <span className={arrowTarget} />
          <span className={checkTarget}>
            <Skeleton className="loading-tint size-4" />
          </span>
          <Skeleton className={cn("loading-tint h-3", nameWidth)} />
        </div>
      </TableCell>
    </TableRow>
  );
}
