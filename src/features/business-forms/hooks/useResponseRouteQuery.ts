import { useSearchParams } from "react-router";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { toggledSort, type SortKind } from "@/shared/lib/sort";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useResponseWorkspace } from "./useResponseWorkspace";
import { responseColumnSelection, responseSortFromParams, responseSortParams, responseTableSort } from "../responses";
import type {
  ResponseColumn,
  ResponseFilter,
  ResponseQuery,
} from "../responses";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function responseQueryFromParams(params: URLSearchParams, filter: ResponseFilter, page = 1, pageSize = 20): ResponseQuery {
  return {
    ...filter,
    page:
      Number.isSafeInteger(page) && page > 0
        ? page
        : 1,
    pageSize:
      Number.isSafeInteger(pageSize) &&
      pageSize > 0 &&
      pageSize <= 100
        ? pageSize
        : 20,
    // OT1-C: every column with one datum; a question, a field of its catalog and a result with their ids.
    ...responseSortFromParams(params),
    versionIds: (params.get("versionIds") ?? "")
      .split(",")
      .filter((value) => guid.test(value)),
    // F2: the tab «Por resolver» is the same sheet with only those responses, also for its panel's ↑ ↓ and the full page. It
    // goes after the filter: the bar copies the query into the private filter, which must not carry it to the other tabs.
    unresolvedActions: params.get("view") === "unresolved" ? true : undefined,
  };
}
export function useResponseRouteQuery(formId: string) {
  const [params] = useSearchParams();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const update = useQueryUpdate();
  const workspace = useResponseWorkspace(formId);
  const query = responseQueryFromParams(params, workspace.filter, pagination.page, pagination.pageSize);
  const setFilter = (
    filter: ResponseFilter,
    versionIds: readonly string[] = query.versionIds ?? [],
    names?: Readonly<Record<string, string>>,
  ) => {
    workspace.setFilter(filter, names);
    update({
      versionIds: versionIds.length ? versionIds.join(",") : undefined,
      page: undefined,
    });
  };
  const setColumns = (
    columns: readonly ResponseColumn[],
    ids: readonly string[],
    resultColumns: readonly { readonly id: string }[] = [],
  ) =>
    update({
      columns: responseColumnSelection(columns, ids, resultColumns) ?? undefined,
    });
  // The same rule as every table (OT1-C): the header toggles, the first touch in the useful direction of the datum, and «Ordenar
  // por» chooses; both go back to the first page. The table names a column by its id; the address carries the server's field and
  // the ids of a question, a field of its catalog or a result.
  const sort = responseTableSort(query);
  const setSort = (next: string) => update({ ...responseSortParams(next), page: undefined });
  const toggleSort = (column: string, kind: SortKind) => setSort(toggledSort(sort, column, kind));
  return {
    query,
    pagination,
    ready: pagination.ready,
    selection: params.get("columns"),
    names: workspace.names,
    setFilter,
    setColumns,
    sort,
    toggleSort,
    setSort,
    params,
  };
}
