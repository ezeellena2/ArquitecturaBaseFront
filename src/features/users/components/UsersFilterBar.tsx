import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchUserFilterCounts, userFilterCountsQueryKey, type UserFilterKey } from "../api/users";
import type { Filters } from "@/shared/hooks/useFilters";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/shared/ui/dropdown-menu";
import { ChevronDownIcon, SlidersIcon } from "@/shared/ui/icons";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { FilterBar } from "@/shared/ui/FilterBar";

/// Una opción de un desplegable, con su conteo a la derecha. La de cero va deshabilitada: elegirla daría una
/// lista vacía, y el número ya dice por qué. Dejarla apretable es ofrecer un camino que no lleva a ningún lado.
///
/// Es una opción de radio de su grupo, que dice cuál está elegida: la elegida lleva la tilde (OE1-A, 2026-11-03). La
/// de "cualquiera" tiene el valor vacío.
function OptionRow({
  value,
  label,
  count,
  onSelect,
}: {
  value: string;
  label: string;
  count: number | undefined;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuRadioItem value={value} disabled={count === 0} onSelect={onSelect} className="justify-between gap-6">
      <span>{label}</span>
      {count === undefined ? null : (
        <span className="text-xs tabular-nums text-[var(--color-content-muted)]">{count}</span>
      )}
    </DropdownMenuRadioItem>
  );
}

interface UsersFilterBarProps {
  filters: Filters<UserFilterKey>;
  search: string;
  onSearchChange: (value: string) => void;
}

/// La barra de filtros del listado (fundamento visual, "Listados y filtros"): buscador, estado, rol y el
/// resto detrás de "Más filtros", con los chips de lo puesto debajo.
///
/// Cada opción muestra **cuántos traería**, y ese número sale de `/api/users/filter-counts`, que lo calcula
/// con los demás filtros puestos e ignorando el propio. Es lo que hace que elegir una opción no sea una
/// apuesta: el número dice de antemano si hay algo del otro lado.
export function UsersFilterBar({ filters, search, onSearchChange }: UsersFilterBarProps) {
  const { t } = useTranslation("users");
  const { values, active, setFilter, clear } = filters;

  // La misma clave raíz que el listado, así una mutación invalida las dos: unos conteos que sobreviven a un
  // alta describen una lista que ya no existe.
  const { data: counts } = useQuery({
    queryKey: userFilterCountsQueryKey({ ...values, search }),
    queryFn: () => fetchUserFilterCounts({ ...values, search }),
  });

  // En plural: el segmentado filtra un conjunto, no rotula una fila. El singular se queda para la celda.
  const statusOptions = [
    { value: undefined, label: t("filters.status.all"), count: counts?.status.all },
    { value: "true", label: t("filters.status.active"), count: counts?.status.active },
    { value: "false", label: t("filters.status.inactive"), count: counts?.status.inactive },
  ];

  // Sin conteos todavía no hay lista de roles que ofrecer: el catálogo lo trae la misma respuesta.
  const roleOptions = counts?.roles ?? [];
  const createdOptions = counts?.createdWithin ?? [];

  const chipLabels: Record<UserFilterKey, (value: string) => string> = {
    isActive: (value) => (value === "true" ? t("status.active") : t("status.inactive")),
    role: (value) => value,
    createdWithinDays: (value) => t("filters.createdWithin.option", { count: Number(value) }),
  };

  return (
    <FilterBar className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* 320 px, como el tablero: "Buscar por correo, nombre o número" no entra entero en menos. En un celular se
            achica con la fila, que ya se parte en renglones. */}
        <div className="w-80 max-w-full">
          <SearchInput value={search} onChange={onSearchChange} label={t("searchLabel")} />
        </div>

        {/* El estado va como segmentado y no como desplegable: son tres opciones fijas y se elige de un clic
            en vez de dos. */}
        <SegmentedControl
          aria-label={t("filters.status.label")}
          options={statusOptions.map((option) => ({
            key: option.label,
            label: option.label,
            pressed: values.isActive === option.value,
            onSelect: () => setFilter("isActive", option.value),
          }))}
        />

        <DropdownMenu>
          <FilterMenuTrigger
            aria-label={t("filters.role.label")}
          >
            {values.role ?? t("filters.role.any")}
            <ChevronDownIcon aria-hidden="true" className="size-3.5" />
          </FilterMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuRadioGroup value={values.role ?? ""}>
              <OptionRow
                value=""
                label={t("filters.role.any")}
                count={undefined}
                onSelect={() => setFilter("role", undefined)}
              />
              {roleOptions.map((role) => (
                <OptionRow
                  key={role.name}
                  value={role.name}
                  label={role.name}
                  count={role.count}
                  onSelect={() => setFilter("role", role.name)}
                />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <FilterMenuTrigger>
            <SlidersIcon aria-hidden="true" className="size-4" />
            {t("filters.more")}
            {values.createdWithinDays ? (
              <span className="inline-flex size-4 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-[length:var(--text-caption)] font-semibold text-white">
                1
              </span>
            ) : null}
          </FilterMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel className="text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)]">
              {t("columns.createdAtUtc")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={values.createdWithinDays ?? ""}>
              <OptionRow
                value=""
                label={t("filters.createdWithin.any")}
                count={undefined}
                onSelect={() => setFilter("createdWithinDays", undefined)}
              />
              {createdOptions.map((option) => (
                <OptionRow
                  key={option.days}
                  value={String(option.days)}
                  label={t("filters.createdWithin.option", { count: option.days })}
                  count={option.count}
                  onSelect={() => setFilter("createdWithinDays", String(option.days))}
                />
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      {active.length > 0 ? (
        // Los chips no son decoración: son el único lugar donde se lee de un vistazo todo lo que está
        // filtrando, incluido lo que quedó escondido detrás de "Más filtros".
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
          {active.map((key) => (
            <FilterChip
              key={key}
              removeLabel={t("filters.chip.remove", { name: t(`filters.chip.${key}`) })}
              onRemove={() => setFilter(key, undefined)}
            >
              <span>
                <span className="opacity-70">{t(`filters.chip.${key}`)}:</span>{" "}
                <strong className="font-semibold">{chipLabels[key](values[key] ?? "")}</strong>
              </span>
            </FilterChip>
          ))}
          <Button
            type="button"
            variant="muted-link"
            size="inline"
            onClick={clear}
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}
    </FilterBar>
  );
}
