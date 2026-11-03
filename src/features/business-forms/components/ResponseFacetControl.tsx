import { useEffect, useState, type MouseEvent, type PointerEvent, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { useElementVisibility } from "@/shared/hooks/useElementVisibility";
import { useResponseFacet } from "../hooks/useResponseQueries";
import type { ResponseQuery } from "../responses";
import { Autocomplete, type AutocompleteOption } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";

const all = "::all";
// The buttons at the foot of the list leave the focus in the field, so the list stays open.
const keepFocus = { onPointerDown: (event: PointerEvent) => event.preventDefault(), onMouseDown: (event: MouseEvent) => event.preventDefault() };
interface FacetOption { id: string; label: string }

/**
 * The combo of a question with options, of Cargó or of Versión in «Filtros» (board PL2-A). Closed it says «Todas» or the chosen
 * one; open, the server's options, without counts nor anything under them, and typing searches among all of them. Choosing one
 * closes the list and applies it, with its name for the owner to remember; «Todas» takes the filter away. Yes or no is not typed.
 */
export function ResponseFacetControl({ formId, filter, dimension, fieldId, label, selected, selectedLabel, searchable = true, onReadError, onChange }: {
  formId: string;
  filter: ResponseQuery | null;
  dimension: string;
  fieldId?: string;
  label: string;
  selected: string | null;
  /** The name of the chosen one, which a catalog question's column does not have: the owner remembers it when it is chosen. */
  selectedLabel?: string;
  searchable?: boolean;
  onReadError?: (key: string, error: unknown) => void;
  onChange: (id: string | null, label?: string) => void;
}) {
  const { t } = useTranslation("forms");
  const { ref: visibilityRef, visible } = useElementVisibility<HTMLDivElement>();
  const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
  // «Mostrar … más» reads the next page and keeps the ones already in sight; another search starts again from the first. The
  // server keeps every option of the responses, ordered by its name, whatever the other filters, so the pages already read stay.
  const [more, setMore] = useState<{ search: string; page: number; earlier: readonly FacetOption[] }>({ search: "", page: 1, earlier: [] });
  const pages = more.search === settled ? more : { search: settled, page: 1, earlier: [] };
  const query = useResponseFacet(formId, filter, dimension, fieldId, pages.page, settled, visible, !onReadError);
  useEffect(() => { onReadError?.(`${dimension}:${fieldId ?? ""}`, query.error); }, [onReadError, dimension, fieldId, query.error]);
  if (query.error instanceof ApiError && query.error.status === 403)
    return <ForbiddenPage />;
  const text = (option: FacetOption) => dimension === "version" ? t("responses.versionLabel", { version: option.label })
    : option.id === "true" ? t("responses.yes") : option.id === "false" ? t("responses.no")
      : dimension === "actor" && !option.label ? t("responses.unknownPerson") : option.label;
  const loaded = query.data ? [...pages.earlier, ...query.data.items.filter(item => !pages.earlier.some(earlier => earlier.id === item.id))] : pages.earlier;
  const searching = (search ?? "") !== settled || pages.page === 1 && query.isPlaceholderData && query.isFetching;
  const failed = query.isError && !query.data;
  const options: AutocompleteOption[] = !query.data || searching || failed ? [] : [
    ...settled ? [] : [{ id: all, label: t("responses.all"), selected: selected === null }],
    ...loaded.map((option, index) => ({ id: option.id, label: text(option), selected: option.id === selected, separated: !settled && index === 0 })),
  ];
  const status = failed ? t("common:states.loadFailed") : searching ? t("searching") : !query.data ? t("common:states.loading")
    : options.length ? undefined : t("responses.noOptions");
  // The wait of a 429 is the reason of the disabled Reintentar (`DisabledReason`), never a text in the list.
  const wait = query.cooldown.isRunning ? t("wait", { count: query.cooldown.seconds }) : null;
  const loadingMore = pages.page > 1 && query.isPlaceholderData && query.isFetching;
  const footer = failed ? query.error instanceof ApiError && (query.error.isNetworkError || query.error.status === 429)
    ? <DisabledReason reason={wait}><Button type="button" variant="outline" size="sm" disabled={query.cooldown.isRunning} {...keepFocus} onClick={() => query.retry()}>{t("common:actions.retry")}</Button></DisabledReason> : undefined
    : !searching && query.data?.hasNext ? <Button type="button" variant="link" size="inline" pending={loadingMore} {...keepFocus}
      onClick={() => setMore({ search: settled, page: pages.page + 1, earlier: loaded })}>
      {loadingMore ? t("common:states.loading") : t("responses.showMore", { count: Math.min(query.data.pageSize, query.data.totalCount - loaded.length) })}</Button> : undefined;
  const chosen = loaded.find(option => option.id === selected);
  const shown = selected === null ? "" : selectedLabel ?? (chosen ? text(chosen) : "…");
  // Touching the field selects what it says, so typing searches instead of adding to the chosen name.
  const selectAll = (event: SyntheticEvent<HTMLInputElement>) => { if (searchable) event.currentTarget.select(); };
  return <div ref={visibilityRef}>
    <Autocomplete aria-label={label} dropdown readOnly={!searchable} maxLength={100} value={search ?? shown} placeholder={t("responses.all")}
      options={options} status={status} footer={footer} onFocus={selectAll} onClick={selectAll}
      onValueChange={setSearch} onBlur={() => setSearch(null)}
      onSelect={id => {
        setSearch(null);
        const next = id === all ? null : id;
        if (next === selected) return;
        const option = loaded.find(item => item.id === next);
        onChange(next, option ? text(option) : undefined);
      }} />
  </div>;
}
