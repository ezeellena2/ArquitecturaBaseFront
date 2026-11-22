import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchUserFilterCounts, userFilterCountsQueryKey, type UserFilterKey, type UserListItem } from "../api/users";
import type { Filters } from "@/shared/hooks/useFilters";
import { Button } from "@/shared/ui/button";
import type { Column } from "@/shared/ui/DataTable";
import { SlidersIcon } from "@/shared/ui/icons";
import { Picker } from "@/shared/ui/Picker";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FilterBar } from "@/shared/ui/FilterBar";

interface UsersFilterBarProps {
  filters: Filters<UserFilterKey>;
  search: string;
  onSearchChange: (value: string) => void;
  /** The columns of the table, for «Ordenar por» (OT1-C). */
  columns: readonly Column<UserListItem>[];
  /** The order in sight: the chosen one or, without one, the server's usual one. */
  sort: string;
  onSortChange: (sort: string) => void;
}

/// La barra de filtros del listado (fundamento visual, "Listados y filtros"): buscador, estado, rol y el
/// resto detrás de "Más filtros", con los chips de lo puesto debajo. Los tres se eligen con la pieza única (DS1-A).
///
/// Los roles y los plazos de "Creado" salen de `/api/users/filter-counts`, que trae también cuántos traería cada
/// opción; esas cantidades no se muestran (FO1-A, 2026-11-03), así que se pide una vez, sin la búsqueda ni los
/// filtros, y no en cada búsqueda (N30).
export function UsersFilterBar({ filters, search, onSearchChange, columns, sort, onSortChange }: UsersFilterBarProps) {
  const { t } = useTranslation("users");
  const { values, active, setFilter, clear } = filters;

  // La misma clave raíz que el listado, así una mutación invalida las dos y un rol nuevo aparece entre las opciones.
  const countsQuery = useQuery({
    queryKey: userFilterCountsQueryKey(),
    queryFn: fetchUserFilterCounts,
  });
  const counts = countsQuery.data;
  // While the options arrive, or if they failed, the open list says so: they are not missing.
  const optionsState = { loading: countsQuery.isPending, failed: countsQuery.isError, onRetry: () => void countsQuery.refetch() };

  // Choosing the one it has changes nothing: it would go back to page 1.
  const choose = (key: UserFilterKey, value: string) => {
    if (value !== (values[key] ?? "")) setFilter(key, value || undefined);
  };

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

        {/* Status, role and "Más filtros" are the only piece to choose with the button of the bar (DS1-A, also the filters
            since 2026-11-22): one option per row, without its count, the chosen one ticked and none off (FO1-A). "Todos" and
            "Cualquier…" go first, apart, and take the filter out. In plural: the filter picks a set, it does not label a row. */}
        <Picker
          trigger="button"
          label={t("filters.status.label")}
          first={{ id: "", label: t("filters.status.all") }}
          options={[
            { id: "true", label: t("filters.status.active") },
            { id: "false", label: t("filters.status.inactive") },
          ]}
          value={values.isActive ?? ""}
          onChange={(status) => choose("isActive", status)}
        />

        <Picker
          trigger="button"
          label={t("filters.role.label")}
          {...optionsState}
          first={{ id: "", label: t("filters.role.any") }}
          options={roleOptions.map((role) => ({ id: role.name, label: role.name }))}
          // The role of the URL is named before its options arrive.
          selectedOptions={values.role ? [{ id: values.role, label: values.role }] : undefined}
          value={values.role ?? ""}
          onChange={(role) => choose("role", role)}
        />

        <Picker
          trigger="button"
          triggerLabel={
            <>
              <SlidersIcon aria-hidden="true" className="size-4" />
              {t("filters.more")}
              {values.createdWithinDays ? (
                <span className="inline-flex size-4 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-[length:var(--text-caption)] font-semibold text-white">
                  1
                </span>
              ) : null}
            </>
          }
          label={t("columns.createdAtUtc")}
          titled
          {...optionsState}
          first={{ id: "", label: t("filters.createdWithin.any") }}
          options={createdOptions.map((option) => ({
            id: String(option.days),
            label: t("filters.createdWithin.option", { count: option.days }),
          }))}
          value={values.createdWithinDays ?? ""}
          onChange={(days) => choose("createdWithinDays", days)}
        />

        {/* Last in the bar, apart from the filters: it takes no rows out, and «Limpiar todo» keeps it (OT1-C). */}
        <SortMenu columns={columns} sort={sort} onSortChange={onSortChange} />
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
