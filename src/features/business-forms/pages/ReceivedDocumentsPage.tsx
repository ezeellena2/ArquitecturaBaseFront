import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { usePagination } from "@/shared/hooks/usePagination";
import { calendarDateInZone, formatDateInZone, formatDateOnly, formatDateTimeInZone } from "@/shared/lib/dateTime";
import { parseSort } from "@/shared/lib/sort";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FilterPanel } from "@/shared/ui/FilterPanel";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { DocumentIcon, FileIcon, ImageIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { Picker } from "@/shared/ui/Picker";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchReceivedDocuments, receivedDocumentSortFields, type ReceivedDocument, type ReceivedDocumentsQuery } from "../api/receivedDocuments";
import { ReceivedDocumentFacetControl } from "../components/documents/ReceivedDocumentFacetControl";
import { ReceivedDocumentGroups } from "../components/documents/ReceivedDocumentGroups";
import { ReceivedDocumentPanel } from "../components/documents/ReceivedDocumentPanel";
import { receivedDocumentsKey, receivedDocumentForbidden, useReceivedDocumentList, useReceivedDocumentScope } from "../hooks/useReceivedDocuments";
import { useResponsePanelNavigation } from "../hooks/useResponsePanelNavigation";
import { hasReceivedDocumentFilters, isReceivedDocumentId, receivedDocumentDataColumns, receivedDocumentDatum, receivedDocumentKind, receivedDocumentSegments,
  receivedDocumentRowLabel, receivedDocumentsPath, receivedDocumentStateLabel, receivedDocumentStateVariant, searchDigitsMissing, type ReceivedDocumentsFilter } from "../receivedDocuments";
import { receivedDateBoundary } from "../responses";

/**
 * «Documentos recibidos» (DOC5-A): a sheet like the responses', one document per row, with its panel in the place of the quick view
 * (D2). Only «Ver documentos recibidos» opens it, and a 403 takes it away. Each owner (user, menu language and permissions) starts
 * with its own filters.
 */
export function ReceivedDocumentsPage() {
  const scope = useReceivedDocumentScope();
  if (!scope.allowed) return <ForbiddenPage />;
  return <ReceivedDocuments key={scope.owner} />;
}

/** «Recibido» from and to, in the profile's zone: both dates apply together, and an inverted range waits with its message. */
function ReceivedRange({ filter, zone, onApply }: { filter: ReceivedDocumentsFilter; zone: string; onApply: (fromUtc: string | undefined, toUtc: string | undefined) => void }) {
  const { t } = useTranslation("formDocuments");
  const from = filter.receivedFromUtc ? calendarDateInZone(filter.receivedFromUtc, zone) : "";
  const to = filter.receivedToUtc ? calendarDateInZone(new Date(Date.parse(filter.receivedToUtc) - 1).toISOString(), zone) : "";
  const [range, setRange] = useState({ from, to, applied: from + "|" + to });
  if (range.applied !== from + "|" + to) setRange({ from, to, applied: from + "|" + to });
  const inverted = !!range.from && !!range.to && range.from > range.to;
  const change = (nextFrom: string, nextTo: string) => {
    setRange(previous => ({ ...previous, from: nextFrom, to: nextTo }));
    if (!nextFrom || !nextTo || nextFrom <= nextTo) onApply(receivedDateBoundary(nextFrom, zone), receivedDateBoundary(nextTo, zone, true));
  };
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <FormField label={t("receivedFrom")} error={inverted ? t("invalidRange") : undefined}><Input type="date" value={range.from} onChange={event => change(event.target.value, range.to)} /></FormField>
    <FormField label={t("receivedTo")}><Input type="date" value={range.to} onChange={event => change(range.from, event.target.value)} /></FormField>
  </div>;
}

function ReceivedDocuments() {
  const { t, i18n } = useTranslation("formDocuments");
  const scope = useReceivedDocumentScope();
  const zone = scope.user?.timeZoneId ?? "UTC";
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mobile = useMediaQuery("(width < 640px)");
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true, "-receivedAtUtc");
  const matched = useMatch(receivedDocumentsPath + "/:documentId")?.params.documentId;
  const documentId = isReceivedDocumentId(matched) ? matched : undefined;
  // The private filters live here, never in the address: the page, its size, the order and the open document do.
  const [filter, setFilter] = useState<ReceivedDocumentsFilter>({});
  const [denied, setDenied] = useState(false);
  // The rows of one spreadsheet share the name of their link: each link is described by its «Fila 5».
  const rowLabels = useId();
  const searchValid = !filter.search || !searchDigitsMissing(filter.search);
  const query: ReceivedDocumentsQuery = {
    page: Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1,
    pageSize: Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : presentation.data?.defaultPageSize ?? 20,
    // Every column with a datum orders in the server (OT1-C); a field it does not order by is left out.
    sort: receivedDocumentSortFields.includes(parseSort(pagination.sort)?.field ?? "") ? pagination.sort : undefined,
    search: searchValid ? filter.search?.trim() || undefined : undefined, state: filter.state, definitionId: filter.form?.id, senderUserId: filter.sender?.id,
    receivedFromUtc: filter.receivedFromUtc, receivedToUtc: filter.receivedToUtc,
  };
  const { list, data } = useReceivedDocumentList(query, pagination.ready && !denied);
  const root = receivedDocumentsKey(scope.owner);
  const forbidden = denied || receivedDocumentForbidden(list.error);
  if (forbidden && !denied) setDenied(true);
  useEffect(() => { if (denied) { void client.cancelQueries({ queryKey: root }); client.removeQueries({ queryKey: root }); } }, [denied, client, root]);
  const deny = useCallback(() => setDenied(true), []);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const feedbackId = `form-documents:list:${scope.owner}`;
  const { error: listError } = list;
  useEffect(() => {
    if (!listError) { dismissNotification(feedbackId); return; }
    const failure = errorFeedback(listError);
    if (["forbidden", "session", "cancelled"].includes(failure.kind)) return;
    if (failure.kind === "wait") restart(Math.min(86400, Math.max(1, failure.retryAfterSeconds ?? 60)));
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(listError, t) });
  }, [listError, feedbackId, t, restart]);
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);

  // Closing the panel gives the focus back to its row, or to the page.
  const container = useRef<HTMLDivElement | null>(null);
  const lastDocument = useRef<string | undefined>(documentId);
  useLayoutEffect(() => {
    if (documentId) lastDocument.current = documentId;
    else if (lastDocument.current) { (container.current?.querySelector<HTMLElement>(`[data-document-id="${lastDocument.current}"]`) ?? container.current)?.focus(); lastDocument.current = undefined; }
  }, [documentId]);
  const search = new URLSearchParams(params); search.delete("tab");
  const documentPath = (id: string) => `${receivedDocumentsPath}/${id}${search.size ? "?" + search : ""}`;
  const close = () => navigate({ pathname: receivedDocumentsPath, search: search.toString() });
  const items = data?.items ?? [];
  const index = items.findIndex(item => item.id === documentId);
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;
  const motion = useResponsePanelNavigation({
    contextKey: JSON.stringify([scope.owner, documentId, query]), ids: items.map(item => item.id), index, page: data?.page ?? query.page, disabled: !data || list.isPlaceholderData,
    loadPage: async page => {
      const next = { ...query, page };
      const result = await client.fetchQuery({ queryKey: [...root, "list", next], queryFn: ({ signal }) => fetchReceivedDocuments(next, signal), gcTime: 0, meta: { errorOwner: "local" } });
      return { ids: result.items.map(item => item.id), totalCount: result.totalCount };
    },
    onNavigate: (id, page) => {
      const next = new URLSearchParams(search); if (page === 1) next.delete("page"); else next.set("page", String(page));
      navigate({ pathname: `${receivedDocumentsPath}/${id}`, search: next.toString() }, { replace: true });
    },
  });
  if (forbidden) return <ForbiddenPage />;

  const apply = (next: ReceivedDocumentsFilter) => { setFilter(next); pagination.setPage(1); };
  const date = (value: string) => formatDateTimeInZone(value, i18n.language, zone);
  const dataColumns = receivedDocumentDataColumns(items);
  // Each column's id is the server's field to order by (OT1-C).
  const columns: Column<ReceivedDocument>[] = [
    // The document: its kind and its name, which opens it. A row of a spreadsheet (VC1-A) is its spreadsheet with its «Fila 5» in grey
    // below it, the exception A of one datum per column.
    { id: "document", header: t("columns.document"), sortable: true, sortKind: "text", cell: item => {
      const kind = receivedDocumentKind(item.file.mediaType);
      const Icon = kind === "photo" ? ImageIcon : kind === "file" ? FileIcon : DocumentIcon;
      const row = item.row ? receivedDocumentRowLabel(item.row) : null;
      const label = row ? `${rowLabels}-${item.id}` : undefined;
      return <div className="flex min-w-40 max-w-64 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-[var(--color-content-muted)]" />
        <div className="min-w-0"><Link data-document-id={item.id} to={documentPath(item.id)} aria-describedby={label} className="break-words font-medium text-[var(--color-brand-700)] underline">{item.file.name}</Link>
          {row ? <p id={label} className="break-words text-[var(--color-content-muted)]">{t(row.key, row.values)}</p> : null}</div>
      </div>;
    } },
    { id: "receivedAtUtc", header: t("columns.received"), sortable: true, sortKind: "date", cell: item => <time dateTime={item.receivedAtUtc}>{date(item.receivedAtUtc)}</time> },
    { id: "sender", header: t("columns.sender"), sortable: true, sortKind: "text", cell: item => item.sender.displayName ?? t("unknownPerson") },
    { id: "form", header: t("columns.form"), sortable: true, sortKind: "text", cell: item => item.form?.name ?? "—" },
    // One datum read per column (UD): each question the page's documents bring, by its name. They do not order: they are kept encrypted.
    ...dataColumns.map(label => ({ sortable: false as const, id: "datum:" + label, header: label, cell: (item: ReceivedDocument) => receivedDocumentDatum(item, label) ?? "—" })),
    { id: "state", header: t("columns.state"), sortable: true, sortKind: "state", cell: item => { const label = receivedDocumentStateLabel(item); return <Badge variant={receivedDocumentStateVariant(label)}>{t("states." + label)}</Badge>; } },
    // When a discarded or unclassified one is deleted, in its own column and only when the page has one.
    ...items.some(item => item.deleteAfterUtc) ? [{ id: "deleteAfterUtc", header: t("columns.deletes"), sortable: true as const, sortKind: "date" as const,
      cell: (item: ReceivedDocument) => item.deleteAfterUtc ? <time dateTime={item.deleteAfterUtc}>{formatDateInZone(item.deleteAfterUtc, i18n.language, zone)}</time> : "—" }] : [],
    { id: "record", header: t("columns.record"), sortable: true, sortKind: "text", cell: item => item.record
      ? scope.readsResponses && item.form ? <Link to={`/formularios/${item.form.definitionId}/respuestas/${item.record.recordId}`} className="font-medium text-[var(--color-brand-700)] underline">{item.record.number}</Link> : item.record.number
      : "—" },
  ];
  const filtered = hasReceivedDocumentFilters(filter);
  const fromDay = filter.receivedFromUtc ? formatDateOnly(calendarDateInZone(filter.receivedFromUtc, zone), i18n.language) : null;
  const toDay = filter.receivedToUtc ? formatDateOnly(calendarDateInZone(new Date(Date.parse(filter.receivedToUtc) - 1).toISOString(), zone), i18n.language) : null;
  const chips = [
    ...query.search ? [{ key: "search", label: t("chips.search", { text: query.search }), clear: () => apply({ ...filter, search: undefined }) }] : [],
    ...filter.form ? [{ key: "form", label: t("chips.form", { name: filter.form.name }), clear: () => apply({ ...filter, form: undefined }) }] : [],
    ...filter.sender ? [{ key: "sender", label: t("chips.sender", { name: filter.sender.name }), clear: () => apply({ ...filter, sender: undefined }) }] : [],
    ...fromDay || toDay ? [{ key: "received", label: fromDay && toDay ? t("chips.receivedRange", { from: fromDay, to: toDay }) : fromDay ? t("chips.receivedFrom", { from: fromDay }) : t("chips.receivedTo", { to: toDay }),
      clear: () => apply({ ...filter, receivedFromUtc: undefined, receivedToUtc: undefined }) }] : [],
  ];
  const waitReason = cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null;
  const refreshing = list.isPlaceholderData || list.isError && list.isFetching;
  // The order seen: the chosen one or, without one, the usual one, the last received first.
  const sort = query.sort ?? "-receivedAtUtc";

  return <div ref={container} tabIndex={-1} className="relative h-full min-h-0 outline-none">
    <div inert={mobile && !!documentId} className="h-full overflow-y-auto"><Page title={t("title")} help={data ? t("help") + " " + t("helpRetention", { days: data.discardedRetentionDays }) : t("help")}>
      <FilterBar className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex w-full flex-col gap-1 sm:w-72">
            <SearchInput maxLength={64} value={filter.search ?? ""} label={t("search")} onChange={text => apply({ ...filter, search: text || undefined })} />
            {searchValid ? null : <p role="alert" className="text-xs text-[var(--color-danger)]">{t("searchDigits")}</p>}
          </div>
          {/* The state is the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22), without
              counts (FO1-A): «Todos» first and apart; choosing the one it has changes nothing (it would go back to page 1). */}
          <Picker trigger="button" label={t("segments.label")} first={{ id: "", label: t("segments.all") }}
            options={receivedDocumentSegments.map(key => ({ id: key, label: t("segments." + key) }))} value={filter.state ?? ""}
            onChange={id => { if (id !== (filter.state ?? "")) apply({ ...filter, state: receivedDocumentSegments.find(key => key === id) }); }} />
          {/* The form and the person, with the options the page brings, and when it arrived (DOC5-A). */}
          <FilterPanel label={t("filters")} sections={[
            { key: "form", label: t("columns.form"), applied: !!filter.form, onClear: () => apply({ ...filter, form: undefined }),
              content: <ReceivedDocumentFacetControl label={t("columns.form")} loading={!data && !list.isError} truncated={!!data?.facets.formsTruncated} selected={filter.form}
                onChange={form => apply({ ...filter, form })}
                options={data?.facets.forms.map(form => ({ id: form.definitionId, name: form.name })) ?? []} /> },
            { key: "sender", label: t("columns.sender"), applied: !!filter.sender, onClear: () => apply({ ...filter, sender: undefined }),
              content: <ReceivedDocumentFacetControl label={t("columns.sender")} loading={!data && !list.isError} truncated={!!data?.facets.sendersTruncated} selected={filter.sender}
                onChange={sender => apply({ ...filter, sender })}
                options={data?.facets.senders.map(person => ({ id: person.userId, name: person.displayName ?? t("unknownPerson") })) ?? []} /> },
            { key: "received", label: t("received"), applied: !!filter.receivedFromUtc || !!filter.receivedToUtc,
              onClear: () => apply({ ...filter, receivedFromUtc: undefined, receivedToUtc: undefined }),
              content: <ReceivedRange filter={filter} zone={zone} onApply={(receivedFromUtc, receivedToUtc) => apply({ ...filter, receivedFromUtc, receivedToUtc })} /> },
          ]} />
          {/* Last in the bar, apart from the filters: it takes no rows out (OT1-C). */}
          <SortMenu columns={columns} sort={sort} onSortChange={pagination.setSort} />
        </div>
        {chips.length ? <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
          {chips.map(chip => <FilterChip key={chip.key} removeLabel={t("remove", { name: chip.label })} onRemove={chip.clear}>{chip.label}</FilterChip>)}
          <Button type="button" variant="muted-link" size="inline" onClick={() => apply({})}>{t("clear")}</Button>
        </div> : null}
      </FilterBar>
      {/* DOC6: the similar documents no form takes, above the sheet, for whoever can build a form from them. */}
      {scope.buildsForms && data ? <ReceivedDocumentGroups groups={data.groups} /> : null}
      <Surface>
        <DataTable columns={columns} rows={items} rowKey={item => item.id} selectedRowKey={documentId} onRowClick={item => navigate(documentPath(item.id))}
          isLoading={list.isPending && !data} refreshing={refreshing} hasData={!!data} error={list.error ? t("loadFailed") : undefined}
          onRetry={() => void list.refetch()} retryReason={waitReason} sort={sort} onSortChange={pagination.toggleSort}
          emptyTitle={t(filtered ? "noMatches" : "empty")}
          emptyAction={filtered ? <Button type="button" variant="outline" onClick={() => apply({})}>{t("clear")}</Button> : undefined} />
        {data ? <Pagination page={data.page} pageSize={data.pageSize} totalCount={data.totalCount} totalPages={totalPages} hasPrevious={data.page > 1}
          hasNext={data.page < totalPages} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
      </Surface>
    </Page></div>
    {documentId ? <ReceivedDocumentPanel key={scope.owner} documentId={documentId} onDenied={deny} navigation={{
      selectionId: documentId, previous: index > 0 || index === 0 && (data?.page ?? 1) > 1, next: index >= 0 && (index < items.length - 1 || (data?.page ?? 1) < totalPages),
      busy: motion.busy, position: index >= 0 && data ? (data.page - 1) * data.pageSize + index + 1 : undefined, count: index >= 0 ? data?.totalCount : undefined,
      onMove: direction => { void motion.move(direction); }, onClose: close, error: motion.error, onRetry: motion.error ? motion.retry : undefined,
    }} /> : null}
  </div>;
}
