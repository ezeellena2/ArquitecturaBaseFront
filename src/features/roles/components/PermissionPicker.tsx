import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PermissionGroup } from "../api/roles";
import {
  areaProgress,
  initialOpenAreas,
  normalizeForSearch,
  pickedSummary,
  toggleArea,
  visibleAreas,
  type AreaSubset,
} from "../lib/permissionPicker";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ChevronRightIcon, SearchIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";

interface PermissionPickerProps {
  groups: readonly PermissionGroup[];
  picked: readonly string[];
  onChange: (picked: string[]) => void;
  /// Admin: se ve todo lo que da, pero no se cambia. Buscar y abrir áreas sigue andando, porque no tocan el rol.
  readOnly?: boolean;
}

/// Acciones del buscador: texto de marca, sin caja.
const linkAction = "h-auto p-0 text-[12.5px] text-[var(--color-brand-700)]";

const focusKeepingLists = ["[data-permission-checkbox]", "[data-area-action]"] as const;
const headerText = "px-4 text-[11px] font-semibold tracking-normal uppercase text-[var(--color-content-heading)]";
const checkTarget = "inline-flex min-h-6 min-w-6 items-center justify-center max-sm:min-h-11 max-sm:min-w-11";

/// Cada sección es un grupo de filas de la misma tabla, incluso cuando está plegada.
function PermissionArea({
  area, picked, open, readOnly, onToggleOpen, onChange,
}: {
  area: AreaSubset;
  picked: readonly string[];
  open: boolean;
  readOnly: boolean;
  onToggleOpen: () => void;
  onChange: (picked: string[]) => void;
}) {
  const { t } = useTranslation("roles");
  const { group, permissions } = area;
  const id = useId();
  const progress = areaProgress(group, picked);

  return (
    <TableBody
      aria-labelledby={`${id}-name`}
      className="[&:not(:last-child)>tr:last-child]:border-b"
    >
      <TableRow className="border-b-[var(--color-border)]/50 bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-muted)]">
        <TableCell colSpan={2} className="p-0">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? permissions.map((permission) => `${id}-row-${permission.code}`).join(" ") : undefined}
            onClick={onToggleOpen}
            className="flex min-h-10 w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)] max-sm:min-h-11"
          >
            <ChevronRightIcon className={cn("size-[15px] shrink-0 text-[var(--color-content-muted)] transition-transform duration-[140ms]", open ? "rotate-90" : "")} />
            <span id={`${id}-name`}>{group.name}</span>
            <span className="text-xs font-normal tabular-nums text-[var(--color-content-muted)]">
              {t("picker.areaProgress", { picked: progress.picked, total: progress.total })}
            </span>
          </button>
        </TableCell>
        <TableCell className="px-4 py-0 text-right">
          <label className={checkTarget}>
            <Checkbox
              aria-label={progress.all ? t("picker.clearAllFor", { area: group.name }) : t("picker.pickAllFor", { area: group.name })}
              data-area-action=""
              checked={progress.all ? true : progress.picked > 0 ? "indeterminate" : false}
              disabled={readOnly}
              onCheckedChange={() => onChange(toggleArea(group, picked))}
            />
          </label>
        </TableCell>
      </TableRow>
      {open ? permissions.map((permission) => (
        <TableRow key={permission.code} id={`${id}-row-${permission.code}`} className="h-11 border-b-[var(--color-border)]/50">
          <TableCell className="px-4 whitespace-normal">
            <label htmlFor={`${id}-${permission.code}`} className="block break-words">{permission.name}</label>
          </TableCell>
          <TableCell className="px-4 whitespace-normal">
            <span id={`${id}-${permission.code}-description`} className="block break-words text-[var(--color-content-muted)]">
              {permission.description}
            </span>
          </TableCell>
          <TableCell className="px-4 text-right">
            <label className={checkTarget}>
              <Checkbox
                id={`${id}-${permission.code}`}
                aria-label={permission.name}
                aria-describedby={`${id}-${permission.code}-description`}
                data-permission-checkbox=""
                checked={picked.includes(permission.code)}
                disabled={readOnly}
                onCheckedChange={(checked) => onChange(
                  checked === true ? [...picked, permission.code] : picked.filter((code) => code !== permission.code),
                )}
              />
            </label>
          </TableCell>
        </TableRow>
      )) : null}
    </TableBody>
  );
}

/// La tabla de permisos del editor: las áreas del catálogo, que se
/// abren y se cierran, con un buscador y el filtro "Elegidos". Lo elegido lo guarda la pantalla; la búsqueda,
/// el filtro y qué áreas están abiertas son del momento de editar, así que los guarda el selector y no van en
/// la URL.
///
/// Las áreas abiertas arrancan con `initialOpenAreas`, una sola vez: la pantalla lo monta cuando ya tiene el
/// catálogo y el rol sembrado.
export function PermissionPicker({ groups, picked, onChange, readOnly = false }: PermissionPickerProps): ReactNode {
  const { t } = useTranslation("roles");
  const titleId = useId();

  const [query, setQuery] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [openAreas, setOpenAreas] = useState(() => initialOpenAreas(groups, picked));

  const sectionRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const showAllRef = useRef<HTMLButtonElement>(null);

  // Con "Elegidos" puesto, desmarcar una casilla o "Quitar todos" saca de la vista al mismo control que tenía el
  // foco, y el foco caería en `<body>`: con el teclado se perdería el lugar justo mientras se limpia lo elegido.
  // Antes del cambio se anota qué control era y en qué lugar de su lista estaba; después, si ya no está, el foco
  // pasa al que quedó en ese lugar (el siguiente), o al último si era el último, o a la salida del vacío.
  const focusBeforeChange = useRef<{ element: HTMLElement; list: string; index: number } | null>(null);

  function change(next: string[]) {
    const section = sectionRef.current;
    const active = document.activeElement;

    if (section !== null && active instanceof HTMLElement && section.contains(active)) {
      const list = focusKeepingLists.find((selector) => active.matches(selector));

      if (list !== undefined) {
        const index = [...section.querySelectorAll(list)].indexOf(active);

        focusBeforeChange.current = { element: active, list, index };
      }
    }

    onChange(next);
  }

  // Un efecto y no un cálculo del render: mueve el foco del DOM, que es algo de afuera de React.
  useLayoutEffect(() => {
    const before = focusBeforeChange.current;
    focusBeforeChange.current = null;

    if (before === null || before.element.isConnected) {
      return;
    }

    const candidates = [...(sectionRef.current?.querySelectorAll<HTMLElement>(before.list) ?? [])];

    (candidates[before.index] ?? candidates.at(-1) ?? showAllRef.current ?? searchRef.current)?.focus();
  });

  const areas = visibleAreas(groups, { query, onlyPicked, picked });

  // Una búsqueda de solo espacios no cuenta: ni filtra ni abre las áreas.
  const isSearching = normalizeForSearch(query) !== "";

  // Buscando o con "Elegidos", lo que queda se ve abierto: buscar y tener que abrir cada resultado sería buscar
  // dos veces. Lo que se abre o se cierra mientras tanto vale para cuando se limpie.
  const isFiltering = isSearching || onlyPicked;

  function noMatchReason(): string {
    if (!isSearching) {
      return t("picker.noMatch.nonePicked");
    }

    return onlyPicked
      ? t("picker.noMatch.queryPicked", { query: query.trim() })
      : t("picker.noMatch.query", { query: query.trim() });
  }

  function toggleOpen(area: string) {
    setOpenAreas((current) => (current.includes(area) ? current.filter((item) => item !== area) : [...current, area]));
  }

  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      className="min-w-0"
    >
      <FilterBar className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="sr-only">
          {t("picker.title")}
        </h2>

        {/* Sin debounce: filtra en memoria, sobre un catálogo que ya llegó entero. */}
        <div className="relative w-80 max-w-full">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-[11px] size-[15px] -translate-y-1/2 text-[var(--color-content-muted)]" />
          <Input
            ref={searchRef}
            type="search"
            aria-label={t("picker.searchLabel")}
            placeholder={t("picker.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Es el campo donde un Enter es natural, y adentro del formulario del rol dispararía el Guardar.
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
              }
            }}
            className="pl-8"
          />
        </div>

        <SegmentedControl
          aria-label={t("picker.show")}
          options={[
            { key: "all", label: t("picker.all"), pressed: !onlyPicked, onSelect: () => setOnlyPicked(false) },
            {
              key: "picked",
              label: t("picker.picked", { total: pickedSummary(groups, picked).permissions }),
              pressed: onlyPicked,
              onSelect: () => setOnlyPicked(true),
            },
          ]}
        />

        <span className="ml-auto inline-flex gap-3.5">
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setOpenAreas(groups.map((group) => group.area))}
            className={linkAction}
          >
            {t("picker.expandAll")}
          </Button>
          <Button type="button" variant="link" size="sm" onClick={() => setOpenAreas([])} className={linkAction}>
            {t("picker.collapseAll")}
          </Button>
        </span>
      </FilterBar>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] [&_td:last-child]:pr-4">
        <Table aria-labelledby={titleId} className="min-w-[520px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className={cn(headerText, "w-[34%]")}>{t("picker.columns.name")}</TableHead>
              <TableHead scope="col" className={headerText}>{t("picker.columns.description")}</TableHead>
              <TableHead scope="col" className={cn(headerText, "w-24 text-right")}>{t("picker.columns.assigned")}</TableHead>
            </TableRow>
          </TableHeader>
          {areas.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={3} className="whitespace-normal">
                  <EmptyState
                    title={t("picker.noMatch.title")}
                    description={noMatchReason()}
                    action={
                      <Button
                        ref={showAllRef}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          // El botón se va con el vacío: el foco pasa al buscador, que es donde sigue la búsqueda.
                          searchRef.current?.focus();
                          setQuery("");
                          setOnlyPicked(false);
                        }}
                        className="mt-1"
                      >
                        {t("picker.noMatch.action")}
                      </Button>
                    }
                    className="rounded-none border-0 px-6 py-12"
                    // Como en el tablero: el motivo repite la búsqueda, y con una larga se parte en renglones.
                    descriptionClassName="max-w-[360px]"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          ) : null}

          {areas.map((area) => (
            <PermissionArea
              key={area.group.area}
              area={area}
              picked={picked}
              open={isFiltering || openAreas.includes(area.group.area)}
              readOnly={readOnly}
              onToggleOpen={() => toggleOpen(area.group.area)}
              onChange={change}
            />
          ))}
        </Table>
      </div>
    </section>
  );
}
