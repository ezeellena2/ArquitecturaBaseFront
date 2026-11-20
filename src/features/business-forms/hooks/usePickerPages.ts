import { useState } from "react";
import type { PagedResult } from "@/shared/api/pagedResult";
import { useSettledValue } from "@/shared/hooks/useSettledValue";

/** What `usePickerPages` reads of the query of a page: its answer, kept while the next one arrives, and how it goes. */
export interface PickerPagesQuery<T> {
  data?: PagedResult<T>;
  isPlaceholderData: boolean;
  isFetching: boolean;
  isError: boolean;
}

/**
 * The search and the pages of a list the server searches, for the only piece to choose (`Picker`, DS1-A): what is typed waits
 * 300 ms (`settled`), «Mostrar N más» asks for the next page and keeps the options already in sight, and another search starts
 * again from the first page. The owner reads the page it says (`page`, `settled`) and passes that query to `list`, which says
 * what the list shows: the options, or that it waits or failed, how many there are and how to ask for more.
 */
export function usePickerPages<T extends { readonly id: string }>() {
  const [search, setSearch] = useState("");
  const settled = useSettledValue(search.trim());
  const [more, setMore] = useState<{ search: string; page: number; earlier: readonly T[] }>({ search: "", page: 1, earlier: [] });
  const pages = more.search === settled ? more : { search: settled, page: 1, earlier: [] as readonly T[] };
  const list = (query: PickerPagesQuery<T>) => {
    const failed = query.isError && !query.isFetching;
    // The answer of this page and this search: not the one kept while another arrives, nor a failed one being retried.
    const fresh = query.data !== undefined && !query.isPlaceholderData && !query.isError;
    const loaded = fresh ? [...pages.earlier, ...query.data!.items.filter(item => !pages.earlier.some(earlier => earlier.id === item.id))] : pages.earlier;
    const loading = !failed && (search.trim() !== settled || (pages.page === 1 && !fresh));
    const loadingMore = !failed && !loading && pages.page > 1 && !fresh;
    const hasNext = fresh && query.data!.hasNext;
    return {
      options: failed || loading ? [] : loaded,
      loading, failed, loadingMore,
      total: query.data?.totalCount,
      pageSize: fresh ? Math.min(query.data!.pageSize, query.data!.totalCount - loaded.length) : undefined,
      // While the next page arrives its button waits: asking again does not skip a page.
      onLoadMore: hasNext || loadingMore ? () => { if (hasNext) setMore({ search: settled, page: pages.page + 1, earlier: loaded }); } : undefined,
    };
  };
  return { search, onSearchChange: setSearch, settled, page: pages.page, list };
}
