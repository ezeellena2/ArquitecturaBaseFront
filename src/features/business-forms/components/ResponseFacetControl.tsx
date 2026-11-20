import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useElementVisibility } from "@/shared/hooks/useElementVisibility";
import { useResponseFacet } from "../hooks/useResponseQueries";
import type { ResponseQuery } from "../responses";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Picker } from "@/shared/ui/Picker";
import { ApiError } from "@/shared/api/ApiError";

const all = "::all";
/** With more options than these the list searches in the server (DS1-A); fewer, as yes or no, are a list to choose from. */
const SEARCH_FROM = 10;
interface FacetOption { id: string; label: string }

/**
 * The filter of a question with options, of Cargó or of Versión in «Filtros» (boards PL2-A and DS1-A): the only piece to choose,
 * with «Todas» first and apart, one option per row, the chosen one ticked and without counts. With more than ten options the
 * search goes inside the list and searches among all of them in the server, twenty at a time with «Mostrar N más». Choosing one
 * closes the list and applies it, with its name for the owner to remember; «Todas» takes the filter away.
 */
export function ResponseFacetControl({ formId, filter, dimension, fieldId, label, selected, selectedLabel, onReadError, onChange }: {
  formId: string;
  filter: ResponseQuery | null;
  dimension: string;
  fieldId?: string;
  label: string;
  selected: string | null;
  /** The name of the chosen one, which a catalog question's column does not have: the owner remembers it when it is chosen. */
  selectedLabel?: string;
  onReadError?: (key: string, error: unknown) => void;
  onChange: (id: string | null, label?: string) => void;
}) {
  const { t } = useTranslation("forms");
  const { ref: visibilityRef, visible } = useElementVisibility<HTMLDivElement>();
  const [search, setSearch] = useState(""), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  // «Mostrar … más» reads the next page and keeps the ones already in sight; another search starts again from the first. The
  // server keeps every option of the responses, ordered by its name, whatever the other filters, so the pages already read stay.
  const [more, setMore] = useState<{ search: string; page: number; earlier: readonly FacetOption[] }>({ search: "", page: 1, earlier: [] });
  const pages = more.search === settled ? more : { search: settled, page: 1, earlier: [] };
  const query = useResponseFacet(formId, filter, dimension, fieldId, pages.page, settled, visible, !onReadError);
  useEffect(() => { onReadError?.(`${dimension}:${fieldId ?? ""}`, query.error); }, [onReadError, dimension, fieldId, query.error]);
  // Whether it has many options is known from the first page without a search, and kept while searching.
  const [many, setMany] = useState(false);
  if (settled === "" && pages.page === 1 && query.data && !query.isPlaceholderData && (query.data.totalCount > SEARCH_FROM) !== many)
    setMany(query.data.totalCount > SEARCH_FROM);
  if (query.error instanceof ApiError && query.error.status === 403)
    return <ForbiddenPage />;
  const text = (option: FacetOption) => dimension === "version" ? t("responses.versionLabel", { version: option.label })
    : option.id === "true" ? t("responses.yes") : option.id === "false" ? t("responses.no")
      : dimension === "actor" && !option.label ? t("responses.unknownPerson") : option.label;
  const loaded = query.data ? [...pages.earlier, ...query.data.items.filter(item => !pages.earlier.some(earlier => earlier.id === item.id))] : pages.earlier;
  const searching = search.trim() !== settled || pages.page === 1 && query.isPlaceholderData && query.isFetching;
  const failed = query.isError && !query.data;
  // A cut or a 429 is retried, after the wait of the 429 as the reason of the disabled Reintentar (`DisabledReason`).
  const retry = failed && query.error instanceof ApiError && (query.error.isNetworkError || query.error.status === 429);
  const loadingMore = pages.page > 1 && query.isPlaceholderData && query.isFetching;
  const chosen = loaded.find(option => option.id === selected);
  return <div ref={visibilityRef}>
    <Picker label={label} first={{ id: all, label: t("responses.all") }} value={selected ?? all}
      options={!query.data || searching || failed ? [] : loaded.map(option => ({ id: option.id, label: text(option) }))}
      selectedOptions={selected === null ? undefined : [{ id: selected, label: selectedLabel ?? (chosen ? text(chosen) : "…") }]}
      {...many ? { search, onSearchChange: setSearch, total: query.data?.totalCount } : {}}
      loading={!failed && (!query.data || searching)} failed={failed} onRetry={retry ? () => query.retry() : undefined}
      retryReason={query.cooldown.isRunning ? t("wait", { count: query.cooldown.seconds }) : null}
      onLoadMore={!searching && query.data?.hasNext ? () => setMore({ search: settled, page: pages.page + 1, earlier: loaded }) : undefined}
      loadingMore={loadingMore} pageSize={query.data ? Math.min(query.data.pageSize, query.data.totalCount - loaded.length) : undefined}
      onChange={id => {
        const next = id === all ? null : id;
        if (next === selected) return;
        const option = loaded.find(item => item.id === next);
        onChange(next, option ? text(option) : undefined);
      }}/>
  </div>;
}
