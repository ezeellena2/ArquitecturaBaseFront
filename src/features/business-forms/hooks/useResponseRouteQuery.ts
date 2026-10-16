import { useSearchParams } from "react-router";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useResponseWorkspace } from "./useResponseWorkspace";
import type {
  ResponseColumn,
  ResponseFilter,
  ResponseQuery,
} from "../responses";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function useResponseRouteQuery(formId: string) {
  const [params] = useSearchParams();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const update = useQueryUpdate();
  const workspace = useResponseWorkspace(formId);
  const sort = params.get("sort") ?? "-number";
  const sortFieldId = params.get("sortFieldId") ?? undefined;
  const query: ResponseQuery = {
    ...workspace.filter,
    page:
      Number.isSafeInteger(pagination.page) && pagination.page > 0
        ? pagination.page
        : 1,
    pageSize:
      Number.isSafeInteger(pagination.pageSize) &&
      pagination.pageSize > 0 &&
      pagination.pageSize <= 100
        ? pagination.pageSize
        : 20,
    sort: [
      "number",
      "-number",
      "submittedAtUtc",
      "-submittedAtUtc",
      "actor",
      "-actor",
      "field",
      "-field",
    ].includes(sort)
      ? sort
      : "-number",
    sortFieldId:
      sortFieldId && guid.test(sortFieldId) ? sortFieldId : undefined,
    versionIds: (params.get("versionIds") ?? "")
      .split(",")
      .filter((value) => guid.test(value)),
  };
  const setFilter = (
    filter: ResponseFilter,
    versionIds: readonly string[] = query.versionIds ?? [],
  ) => {
    workspace.setFilter(filter);
    update({
      versionIds: versionIds.length ? versionIds.join(",") : undefined,
      page: undefined,
    });
  };
  const setColumns = (
    columns: readonly ResponseColumn[],
    ids: readonly string[],
  ) =>
    update({
      columns:
        ids.length === columns.length
          ? undefined
          : ids.length
            ? ids.join(",")
            : "none",
    });
  const toggleSort = (field: string) => {
    const dynamic = guid.test(field);
    const current = dynamic
      ? query.sortFieldId === field
        ? query.sort
        : undefined
      : query.sort;
    update({
      sort:
        current === (dynamic ? "field" : field)
          ? `-${dynamic ? "field" : field}`
          : dynamic
            ? "field"
            : field,
      sortFieldId: dynamic ? field : undefined,
      page: undefined,
    });
  };
  return {
    query,
    pagination,
    ready: pagination.ready,
    selection: params.get("columns"),
    setFilter,
    setColumns,
    toggleSort,
    params,
  };
}
