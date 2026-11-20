import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FilterChip } from "@/shared/ui/FilterChip";
import { Picker } from "@/shared/ui/Picker";
import { SearchInput } from "@/shared/ui/SearchInput";
import type { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { responseFilterLabels, responseHasFilters, type ResponseColumn } from "../responses";
import { ResponseFiltersMenu } from "./ResponseFiltersMenu";

/**
 * The filters of the sheet, which «Respuestas» and «Tablero» share in memory (DOC7-A): the search, the channel and the state in
 * sight, side by side, the channel and the state with the button of the bar of the only piece to choose (DS1-A); the rest in
 * «Filtros», which applies each change at once; what is applied as a chip under the bar with «Limpiar todo», as in Usuarios.
 * What each tab adjusts goes at the end (`trailing`): «Columnas» or the period. `quick` takes the search, the channel and the
 * state into «Filtros» too: the dashboard on the phone keeps its filters behind one button.
 */
export function ResponseFilterBar({ formId, route, columns, loaded, versions, hasApproval, zone, trailing, quick = false }: {
  formId: string;
  route: ReturnType<typeof useResponseRouteQuery>;
  columns: readonly ResponseColumn[];
  /** The sheet that names the questions and the versions arrived. */
  loaded: boolean;
  versions?: readonly { id: string; number: number }[];
  hasApproval: boolean;
  zone: string;
  trailing?: ReactNode;
  quick?: boolean;
}) {
  const { t, i18n } = useTranslation(["forms", "formEntries"]);
  const appliedFilters = responseFilterLabels(route.query, columns, t, i18n.language, zone, versions, route.names);
  const search = !loaded || columns.some(column => column.type === "longText");
  const channel = route.query.enteredInApp == null ? "" : String(route.query.enteredInApp), state = route.query.state ?? "";
  return (
    <FilterBar className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {quick ? null : <>
          {search ? (
            <div className="w-full sm:w-72">
              <SearchInput maxLength={100} value={route.query.search ?? ""} label={t("responses.search")}
                onChange={(text) => route.setFilter({ ...route.query, search: text || undefined })}/>
            </div>
          ) : null}
          {/* «Canal» is one more quick filter (CW6-A): App or WhatsApp. Like the role of Usuarios, «Todos…» goes first and apart and
              takes the filter out; choosing the one already chosen changes nothing, as with a select. */}
          <Picker trigger="button" label={t("formEntries:sheet.channel")} first={{ id: "", label: t("formEntries:sheet.allChannels") }}
            options={[{ id: "true", label: t("formEntries:sheet.channels.app") }, { id: "false", label: t("responses.whatsapp") }]}
            value={channel} onChange={id => { if (id !== channel) route.setFilter({ ...route.query, enteredInApp: id === "" ? undefined : id === "true" }); }}/>
          {/* Voided responses only show with «Estado: Anulada» (CW11-A); the approval states, when the form asks for approval. */}
          <Picker trigger="button" label={t("approvals.state")} first={{ id: "", label: t("approvals.allStates") }}
            options={([...hasApproval ? ["Received", "PendingApproval", "Approved", "Rejected"] as const : [], "Voided"] as const).map(item => ({ id: item, label: t("approvals.states." + item) }))}
            value={state} onChange={id => { if (id !== state) route.setFilter({ ...route.query, state: (id || undefined) as typeof route.query.state }); }}/>
        </>}
        <ResponseFiltersMenu formId={formId} query={route.query} columns={columns} zone={zone} names={route.names} disabled={!loaded} onApply={route.setFilter}
          quick={quick ? { search, hasApproval } : undefined}/>
        {trailing}
      </div>
      {responseHasFilters(route.query) ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
          {appliedFilters.map(filter => <FilterChip key={filter.key} removeLabel={t("responses.remove", { name: filter.label })} onRemove={() => {
            if (filter.key === "version") route.setFilter(route.query, []);
            else if (filter.key === "state") route.setFilter({ ...route.query, state: undefined });
            else if (filter.key === "channel") route.setFilter({ ...route.query, enteredInApp: undefined });
            else if (filter.key === "actor") route.setFilter({ ...route.query, actorIds: [] });
            else if (filter.key === "received") route.setFilter({ ...route.query, receivedFromUtc: undefined, receivedToUtc: undefined });
            else if (filter.key === "search") route.setFilter({ ...route.query, search: undefined });
            else route.setFilter({ ...route.query, conditions: route.query.conditions?.filter(item => item.fieldId !== filter.key) });
          }}>{filter.label}</FilterChip>)}
          <Button type="button" variant="muted-link" size="inline" onClick={() => route.setFilter({}, [])}>{t("responses.clear")}</Button>
        </div>
      ) : null}
    </FilterBar>
  );
}
