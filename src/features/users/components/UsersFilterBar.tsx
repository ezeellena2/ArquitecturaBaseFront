import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchUserFilterCounts, userFilterCountsQueryKey, type UserFilterKey } from "../api/users";
import type { Filters } from "@/shared/hooks/useFilters";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { ChevronDownIcon, SlidersIcon } from "@/shared/ui/icons";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";

const control =
  "inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-content-muted)] transition-colors hover:border-[var(--color-content-muted)]/50";

/// Una opción de un desplegable, con su conteo a la derecha. La de cero va deshabilitada: elegirla daría una
/// lista vacía, y el número ya dice por qué. Dejarla apretable es ofrecer un camino que no lleva a ningún lado.
function OptionRow({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      disabled={count === 0}
      onSelect={onSelect}
      className={cn("justify-between gap-6", selected ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]" : "")}
    >
      <span>{label}</span>
      {count === undefined ? null : (
        <span className="text-xs tabular-nums text-[var(--color-content-muted)]">{count}</span>
      )}
    </DropdownMenuItem>
  );
}

interface UsersFilterBarProps {
  filters: Filters<UserFilterKey>;
  search: string;
  onSearchChange: (value: string) => void;
  totalLabel: string;
}

/// La barra de filtros del listado (fundamento visual, "Listados y filtros"): buscador, estado, rol y el
/// resto detrás de "Más filtros", con los chips de lo puesto debajo.
///
/// Cada opción muestra **cuántos traería**, y ese número sale de `/api/users/filter-counts`, que lo calcula
/// con los demás filtros puestos e ignorando el propio. Es lo que hace que elegir una opción no sea una
/// apuesta: el número dice de antemano si hay algo del otro lado.
export function UsersFilterBar({ filters, search, onSearchChange, totalLabel }: UsersFilterBarProps) {
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
    <div className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-60">
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
          <DropdownMenuTrigger
            className={cn(control, values.role ? "text-[var(--color-content)]" : "")}
            aria-label={t("filters.role.label")}
          >
            {values.role ?? t("filters.role.any")}
            <ChevronDownIcon aria-hidden="true" className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <OptionRow
              label={t("filters.role.any")}
              count={undefined}
              selected={!values.role}
              onSelect={() => setFilter("role", undefined)}
            />
            {roleOptions.map((role) => (
              <OptionRow
                key={role.name}
                label={role.name}
                count={role.count}
                selected={values.role === role.name}
                onSelect={() => setFilter("role", role.name)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(control, "text-[var(--color-content)]")}>
            <SlidersIcon aria-hidden="true" className="size-4" />
            {t("filters.more")}
            {values.createdWithinDays ? (
              <span className="inline-flex size-[18px] items-center justify-center rounded-full bg-[var(--color-brand-600)] text-[11px] font-semibold text-white">
                1
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel className="text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-heading)]">
              {t("columns.createdAtUtc")}
            </DropdownMenuLabel>
            <OptionRow
              label={t("filters.createdWithin.any")}
              count={undefined}
              selected={!values.createdWithinDays}
              onSelect={() => setFilter("createdWithinDays", undefined)}
            />
            {createdOptions.map((option) => (
              <OptionRow
                key={option.days}
                label={t("filters.createdWithin.option", { count: option.days })}
                count={option.count}
                selected={values.createdWithinDays === String(option.days)}
                onSelect={() => setFilter("createdWithinDays", String(option.days))}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto text-[13px] text-[var(--color-content-muted)]">{totalLabel}</span>
      </div>

      {active.length > 0 ? (
        // Los chips no son decoración: son el único lugar donde se lee de un vistazo todo lo que está
        // filtrando, incluido lo que quedó escondido detrás de "Más filtros".
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
          {active.map((key) => (
            <span
              key={key}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-50)] py-0 pr-1 pl-2.5 text-[12.5px] text-[var(--color-brand-700)]"
            >
              <span>
                <span className="opacity-70">{t(`filters.chip.${key}`)}:</span>{" "}
                <strong className="font-semibold">{chipLabels[key](values[key] ?? "")}</strong>
              </span>
              <button
                type="button"
                aria-label={t("filters.chip.remove", { name: t(`filters.chip.${key}`) })}
                onClick={() => setFilter(key, undefined)}
                className="inline-flex size-[18px] items-center justify-center rounded-full hover:bg-[var(--color-brand-500)]/20"
              >
                <span aria-hidden="true" className="text-[13px] leading-none">
                  ×
                </span>
              </button>
            </span>
          ))}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={clear}
            className="h-auto p-0 text-[12.5px] text-[var(--color-content-muted)]"
          >
            {t("filters.clearAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
