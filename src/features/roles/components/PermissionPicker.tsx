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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { EmptyState } from "@/shared/ui/EmptyState";
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

/// Los enlaces de la barra y de cada área ("Expandir todo", "Elegir todos"): texto de marca, sin caja.
const linkAction = "h-auto p-0 text-[12.5px] text-[var(--color-brand-700)]";

/// El separador entre áreas, más suave que el borde de la tarjeta: separa filas, no superficies.
const rowBorder = "border-[var(--color-border)]/80";

/// Las listas de controles que un cambio de lo elegido puede sacar de la vista (con "Elegidos" puesto): las
/// casillas, y el "Elegir todos" / "Quitar todos" de cada área, que lleva la marca `data-area-action`.
const focusKeepingLists = ['[role="checkbox"]', "[data-area-action]"] as const;

/// Una fila de área y, si está abierta, sus permisos. Es un `fieldset` abierta o cerrada: así cada área es un
/// grupo con nombre, y una casilla dice de qué área es aunque haya dos que se llamen parecido.
function PermissionArea({
  area,
  picked,
  open,
  readOnly,
  onToggleOpen,
  onChange,
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

  // Sobre todos los permisos del área, estén o no a la vista.
  const progress = areaProgress(group, picked);

  return (
    <fieldset className={cn("min-w-0 border-b last:border-b-0", rowBorder)}>
      {/* El `legend` queda oculto para la vista y la fila visible va aparte: estilar un `legend` obliga a trucos
          frágiles, pero es de donde el `fieldset` saca su nombre accesible. Si alguien "limpia" este legend, las
          áreas se quedan sin nombre para el lector de pantalla; hay un test que se pone en rojo si pasa. */}
      <legend className="sr-only">{group.name}</legend>

      <div className="flex h-[46px] items-center gap-2.5 px-3.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggleOpen}
          // El contorno de foco va hacia adentro, como en el segmentado: afuera se pisaría con el separador.
          className="flex h-full min-w-0 grow items-center gap-2.5 text-left text-sm font-medium text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)]"
        >
          <ChevronRightIcon
            className={cn(
              "size-[15px] shrink-0 text-[var(--color-content-muted)] transition-transform duration-[140ms]",
              open ? "rotate-90" : "",
            )}
          />
          <span className="truncate">{group.name}</span>
          <Badge
            variant="secondary"
            className={cn(
              "h-[22px] border-0 px-2 tabular-nums",
              progress.picked > 0
                ? "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
                : "bg-[var(--color-surface-header)] text-[var(--color-content-muted)]",
            )}
          >
            {t("picker.areaProgress", { picked: progress.picked, total: progress.total })}
          </Badge>
        </button>

        {readOnly ? null : (
          <Button
            type="button"
            variant="link"
            size="sm"
            // El texto es corto y se repite en cada área; el nombre accesible dice de cuál.
            aria-label={
              progress.all ? t("picker.clearAllFor", { area: group.name }) : t("picker.pickAllFor", { area: group.name })
            }
            data-area-action=""
            onClick={() => onChange(toggleArea(group, picked))}
            className={linkAction}
          >
            {progress.all ? t("picker.clearAll") : t("picker.pickAll")}
          </Button>
        )}
      </div>

      {open ? (
        <div
          className={cn(
            "grid grid-cols-1 gap-x-3 gap-y-0.5 border-t pt-2 pr-3.5 pb-3 pl-[38px] sm:grid-cols-2",
            rowBorder,
          )}
        >
          {permissions.map((permission) => (
            <CheckboxField
              key={permission.code}
              label={permission.name}
              description={permission.description}
              checked={picked.includes(permission.code)}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                onChange(checked ? [...picked, permission.code] : picked.filter((code) => code !== permission.code))
              }
            />
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

/// La tarjeta "Permisos" del editor de un rol (tablero "Roles · Editar un rol"): las áreas del catálogo, que se
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
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3.5">
        <h2 id={titleId} className="mr-2 text-sm font-semibold text-[var(--color-content)]">
          {t("picker.title")}
        </h2>

        {/* Sin debounce: filtra en memoria, sobre un catálogo que ya llegó entero. */}
        <div className="relative w-[280px] max-w-full">
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
      </div>

      {isFiltering && areas.length === 0 ? (
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
    </section>
  );
}
