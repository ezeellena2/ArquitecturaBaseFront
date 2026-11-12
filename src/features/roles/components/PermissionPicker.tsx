import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PermissionGroup, PermissionItem } from "../api/roles";
import { areaColumns, areaHelp, areaProgress, hasOtherPermissions, toggleArea } from "../lib/permissionPicker";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Checkbox } from "@/shared/ui/checkbox";
import { CheckIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";

interface PermissionPickerProps {
  groups: readonly PermissionGroup[];
  picked: readonly string[];
  onChange: (picked: string[]) => void;
  /// Admin: se lee lo que tiene, con una tilde, y no se cambia.
  readOnly?: boolean;
}

/// Lo que comparten la matriz y las bandas: lo elegido, si se lee o se elige, y cómo cambia.
interface PickerPartProps {
  picked: readonly string[];
  readOnly: boolean;
  onChange: (picked: string[]) => void;
}

/// Desde acá entran las cuatro columnas de la matriz; más angosto, cada área es una banda con sus permisos debajo.
const desktopQuery = "(min-width: 768px)";

/// El blanco de la casilla de un área: 24 px en escritorio y 44 en el celular, aunque el cuadradito mida 16.
const checkTarget = "inline-flex min-h-6 min-w-6 items-center justify-center max-md:min-h-11 max-md:min-w-11";

/// El blanco de una casilla de la matriz, que sólo se ve en escritorio: el cuadradito queda al principio de la celda, debajo
/// del comienzo de su encabezado.
const matrixTarget = "inline-flex min-h-6 min-w-6 items-center";

/// Los permisos de un rol (tablero RO1-A del lienzo «Roles y permisos: rediseño», 2026-11-11). En escritorio, una matriz
/// con una fila por área y las columnas Ver, Administrar y «Otros permisos», como los permisos de DigitalOcean: con todos
/// los módulos son 13 filas y el rol entero entra en una pantalla, así que no hay buscador, filtros ni áreas que se
/// plieguen. En el celular las columnas no entran: cada área es una banda y sus permisos van debajo, con el nombre entero.
///
/// Lo elegido lo guarda la pantalla; el selector no guarda nada propio.
export function PermissionPicker({ groups, picked, onChange, readOnly = false }: PermissionPickerProps): ReactNode {
  const { t } = useTranslation("roles");
  const titleId = useId();
  const desktop = useMediaQuery(desktopQuery);
  const part = { picked, readOnly, onChange };

  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <h2 id={titleId} className="sr-only">
        {t("picker.title")}
      </h2>
      <Surface>
        {desktop ? <PermissionMatrix groups={groups} titleId={titleId} {...part} /> : <PermissionBands groups={groups} titleId={titleId} {...part} />}
      </Surface>
    </section>
  );
}

function PermissionMatrix({ groups, titleId, ...part }: PickerPartProps & { groups: readonly PermissionGroup[]; titleId: string }): ReactNode {
  const { t } = useTranslation("roles");
  // Sin módulos todo es ver o administrar: una columna vacía en todas las filas no diría nada.
  const showOthers = hasOtherPermissions(groups);

  return (
    // `table-fixed` respeta los anchos de los encabezados; sin él, el navegador le daba el sobrante a «Área». El mínimo
    // deja lugar para los otros permisos: más angosto, la tabla se desplaza dentro de su caja.
    <Table aria-labelledby={titleId} className={showOthers ? "min-w-200 table-fixed" : "min-w-140 table-fixed"}>
      <TableHeader>
        <TableRow>
          {part.readOnly ? null : (
            <TableHead scope="col" className="w-11">
              <span className="sr-only">{t("picker.columns.wholeArea")}</span>
            </TableHead>
          )}
          {/* Anchos fijos y la última columna se queda con lo que sobra: sin módulos es «Administrar», y las casillas no
              se van al borde derecho de una pantalla ancha. */}
          <TableHead scope="col" className="w-72">{t("picker.columns.area")}</TableHead>
          <TableHead scope="col" className="w-24">{t("picker.columns.read")}</TableHead>
          <TableHead scope="col" className={showOthers ? "w-30" : undefined}>{t("picker.columns.manage")}</TableHead>
          {showOthers ? <TableHead scope="col">{t("picker.columns.others")}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <MatrixRow key={group.area} group={group} showOthers={showOthers} {...part} />
        ))}
      </TableBody>
    </Table>
  );
}

function MatrixRow({ group, showOthers, ...part }: PickerPartProps & { group: PermissionGroup; showOthers: boolean }): ReactNode {
  const { read, manage, others } = areaColumns(group);

  return (
    <TableRow>
      {part.readOnly ? null : (
        <TableCell className="pr-0">
          {group.permissions.length > 1 ? <AreaCheckbox group={group} picked={part.picked} onChange={part.onChange} /> : null}
        </TableCell>
      )}
      <TableRowHeader>
        <AreaName group={group} />
      </TableRowHeader>
      <TableCell>{read ? <PermissionMark permission={read} {...part} /> : <NotApplicable />}</TableCell>
      <TableCell>{manage ? <PermissionMark permission={manage} {...part} /> : <NotApplicable />}</TableCell>
      {showOthers ? (
        <TableCell className="whitespace-normal">
          {others.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {others.map((permission) => (
                <NamedPermission key={permission.code} permission={permission} {...part} />
              ))}
            </div>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function PermissionBands({ groups, titleId, ...part }: PickerPartProps & { groups: readonly PermissionGroup[]; titleId: string }): ReactNode {
  return (
    <Table aria-labelledby={titleId}>
      {groups.map((group) => (
        <AreaBand key={group.area} group={group} {...part} />
      ))}
    </Table>
  );
}

/// Un área en el celular: su banda, con su nombre y su (i) a la izquierda y la casilla del área a la derecha, como en el
/// tablero, así los nombres de las áreas quedan alineados; debajo, sus permisos, cada uno de 44 px.
function AreaBand({ group, ...part }: PickerPartProps & { group: PermissionGroup }): ReactNode {
  const nameId = useId();
  const permissions = part.readOnly ? group.permissions.filter((permission) => part.picked.includes(permission.code)) : group.permissions;

  return (
    <TableBody striped={false} aria-labelledby={nameId} className="[&:not(:last-child)>tr:last-child]:border-b">
      <TableRow tone="section" highlightExpanded={false}>
        <TableCell className="whitespace-normal">
          <span className="flex min-h-11 items-center justify-between gap-2">
            <AreaName group={group} id={nameId} />
            {part.readOnly || group.permissions.length < 2 ? null : <AreaCheckbox group={group} picked={part.picked} onChange={part.onChange} />}
          </span>
        </TableCell>
      </TableRow>
      {permissions.map((permission) => (
        <TableRow key={permission.code}>
          <TableCell className="whitespace-normal">
            <NamedPermission permission={permission} {...part} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

/// El nombre del área y su (i), que dice qué permite cada uno de sus permisos.
function AreaName({ group, id }: { group: PermissionGroup; id?: string }): ReactNode {
  const { t } = useTranslation("roles");

  return (
    <span className="inline-flex items-center gap-1">
      <span id={id} className="font-medium">
        {group.name}
      </span>
      <span className="-my-1 inline-flex">
        <InfoTip text={areaHelp(group)} label={t("common:actions.moreInfo", { label: group.name })} />
      </span>
    </span>
  );
}

/// Elige o quita el área entera: vacía, parcial o completa. Sólo la tiene un área de dos o más permisos; en una de uno
/// repetiría la casilla de ese permiso.
function AreaCheckbox({ group, picked, onChange }: { group: PermissionGroup; picked: readonly string[]; onChange: (picked: string[]) => void }): ReactNode {
  const { t } = useTranslation("roles");
  const progress = areaProgress(group, picked);

  return (
    <label className={checkTarget}>
      <Checkbox
        aria-label={progress.all ? t("picker.clearAllFor", { area: group.name }) : t("picker.pickAllFor", { area: group.name })}
        checked={progress.all ? true : progress.picked > 0 ? "indeterminate" : false}
        onCheckedChange={() => onChange(toggleArea(group, picked))}
      />
    </label>
  );
}

/// La casilla de Ver o de Administrar, que se nombra con el permiso («Ver usuarios»): la columna dice sólo «Ver». Lo que
/// permite es su descripción accesible; a la vista va en la (i) del área. En un rol de sólo lectura, una tilde.
function PermissionMark({ permission, picked, readOnly, onChange }: PickerPartProps & { permission: PermissionItem }): ReactNode {
  const descriptionId = useId();
  const checked = picked.includes(permission.code);

  if (readOnly) {
    return checked ? (
      <span className="inline-flex align-middle text-[var(--color-brand-600)]">
        <CheckIcon aria-hidden="true" className="size-4" />
        <span className="sr-only">{permission.name}</span>
      </span>
    ) : null;
  }

  return (
    <>
      <label className={matrixTarget}>
        <Checkbox
          aria-label={permission.name}
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={(value) => onChange(change(picked, permission.code, value === true))}
        />
      </label>
      <span id={descriptionId} hidden>
        {permission.description}
      </span>
    </>
  );
}

/// Un permiso con su nombre a la vista: los de «Otros permisos» y todos los del celular. Tocar el nombre lo marca.
function NamedPermission({ permission, picked, readOnly, onChange }: PickerPartProps & { permission: PermissionItem }): ReactNode {
  const descriptionId = useId();
  const checked = picked.includes(permission.code);

  if (readOnly) {
    return checked ? (
      <span className="inline-flex items-center gap-1.5">
        <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-[var(--color-brand-600)]" />
        {permission.name}
      </span>
    ) : null;
  }

  return (
    <>
      <label className="inline-flex min-h-6 cursor-pointer items-center gap-2 max-md:min-h-11 max-md:w-full max-md:gap-3">
        <Checkbox
          aria-describedby={descriptionId}
          checked={checked}
          onCheckedChange={(value) => onChange(change(picked, permission.code, value === true))}
        />
        {permission.name}
      </label>
      <span id={descriptionId} hidden>
        {permission.description}
      </span>
    </>
  );
}

/// Un guion donde el área no tiene ese permiso: no hay nada que elegir.
function NotApplicable(): ReactNode {
  return (
    <span aria-hidden="true" className="text-[var(--color-content-muted)]">
      —
    </span>
  );
}

function change(picked: readonly string[], code: string, checked: boolean): string[] {
  return checked ? [...picked, code] : picked.filter((item) => item !== code);
}
