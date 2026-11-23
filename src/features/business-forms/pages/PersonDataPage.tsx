import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { UserDataSectionContext } from "@/shared/hooks/userDataSectionContext";
import { parseSort, sortValue, toggledSort, type SortKind } from "@/shared/lib/sort";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon, PlusIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { WideTable } from "@/shared/ui/WideTable";
import type { PersonAttribute, PersonDataPageQuery, PersonDataRow } from "../api/personData";
import { PersonAttributeDialog } from "../components/PersonAttributeDialog";
import { administrativeName } from "../editorModel";
import { personDataForbidden, personDataScopeKey, usePersonAttributes, usePersonDataPage, type PersonDataScope } from "../hooks/usePersonData";

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// OT1-C: the people order by their name or by a datum, as its cell reads it, with whoever lacks it last. The table names a datum's
// column by its id; the address and the server take `sort=attribute` with `sortAttributeId`. Without one chosen, by name from A to Z.
function peopleTableSort(sort: string | undefined, attributeId: string | null): string {
 const parsed = parseSort(sort);
 if (parsed?.field === "attribute" && attributeId && guid.test(attributeId)) return sortValue(attributeId, parsed.descending);
 return parsed?.field === "displayName" ? sortValue("displayName", parsed.descending) : "displayName";
}
function peopleSortQuery(tableSort: string): Pick<PersonDataPageQuery, "sort" | "sortAttributeId"> {
 const parsed = parseSort(tableSort), descending = !!parsed?.descending;
 return !parsed || parsed.field === "displayName" ? { sort: descending ? "-displayName" : "displayName", sortAttributeId: undefined }
  : { sort: descending ? "-attribute" : "attribute", sortAttributeId: parsed.field };
}

export function PersonDataPage() {
 const { data: user } = useCurrentUser(), { i18n } = useTranslation();
 if (!user) return <Spinner />;
 if (!user.permissions.includes("formpersondata.manage")) return <ForbiddenPage />;
 const scope: PersonDataScope = { actorId: user.id, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user.permissions };
 return <PersonDataWorkspace key={JSON.stringify(personDataScopeKey(scope))} scope={scope} />;
}
function PersonDataWorkspace({ scope }: { scope: PersonDataScope }) {
 const { t } = useTranslation("forms"), client = useQueryClient();
 const extension = useContext(UserDataSectionContext);
 const privateKey = useMemo(() => personDataScopeKey(scope), [scope]);
 const system = useSystemPresentation(), pagination = usePagination(system.data?.defaultPageSize, true);
 const [params] = useSearchParams(), update = useQueryUpdate();
 // The header toggles and «Ordenar por» chooses; both go back to the first page and keep the search.
 const sort = peopleTableSort(pagination.sort, params.get("sortAttributeId"));
 const setSort = (next: string) => update({ ...peopleSortQuery(next), page: undefined });
 const toggleSort = (column: string, kind: SortKind) => setSort(toggledSort(sort, column, kind));
 const [denied, setDenied] = useState(false), [peopleDenied, setPeopleDenied] = useState(false);
 const [editing, setEditing] = useState<PersonAttribute | "new" | null>(null);
 const attributes = usePersonAttributes(scope, !denied);
 const people = usePersonDataPage(scope, { page: pagination.page, pageSize: pagination.pageSize, search: pagination.search, ...peopleSortQuery(sort) }, !denied && !peopleDenied && pagination.ready);
 const lostAttributes = personDataForbidden(attributes.error), lostPeople = personDataForbidden(people.error);
 if (lostAttributes && !denied) { setDenied(true); setEditing(null); }
 if (lostPeople && !peopleDenied) setPeopleDenied(true);
 useEffect(() => {
  const key = denied ? privateKey : peopleDenied ? [...privateKey, "page"] : null;
  if (key) { void client.cancelQueries({ queryKey: key }); client.removeQueries({ queryKey: key }); }
 }, [denied, peopleDenied, client, privateKey]);
 if (denied || lostAttributes) return <ForbiddenPage />;
 const list = attributes.data?.items ?? [], active = list.filter(attribute => attribute.isActive), canReadPeople = scope.permissions.includes("users.read") && !peopleDenied && !lostPeople;
 const title = (attribute: PersonAttribute) => administrativeName(attribute.name, scope.culture);
 // The forms are named only with formtemplates.read; without it each use comes unnamed and only how many is shown.
 const usage = (attribute: PersonAttribute) => !attribute.usedBy.length ? "—" : attribute.usedBy.every(use => use.name !== null) ? attribute.usedBy.map(use => use.name).join(", ") : t("personData.usedInForms", { count: attribute.usedBy.length });
 const canEditPeople = !!extension && scope.permissions.includes("users.manage");
 // A person and each datum are one text each; editing the person is an icon and does not order.
 const columns: Column<PersonDataRow>[] = [
  { id: "displayName", header: t("personData.person"), sortable: true, sortKind: "text", cell: person => person.displayName ?? t("personData.unnamed") },
  ...active.map(attribute => ({ id: attribute.id, header: title(attribute), sortable: true as const, sortKind: "text" as const, cell: (person: PersonDataRow) => person.values[attribute.id]?.text || "—" })),
  ...(canEditPeople ? [{ id: "actions", header: t("actionsColumn"), sortable: false as const, cell: (person: PersonDataRow) => <IconButton label={t("personData.editPerson", { name: person.displayName ?? t("personData.unnamed") })} size="icon-sm" onClick={() => extension.openUser(person.userId, () => void client.invalidateQueries({ queryKey: [...privateKey, "page"] }))}><PencilIcon className="size-4" /></IconButton> }] : []),
 ];
 // The server counts the whole filtered set; only the attributes a filter uses are summarized, as in CE4-A.
 const summary = people.data ? [t("personData.peopleCount", { count: people.data.totalCount }), ...active.filter(attribute => attribute.usedBy.length > 0).flatMap(attribute => { const entry = people.data.missing.find(item => item.attributeId === attribute.id); return entry ? [t("personData.missingCount", { count: entry.count, name: title(attribute) })] : []; })].join(" · ") : null;
 // After a revision conflict the dialog continues from the saved attribute; closing it meanwhile keeps it closed. A failed read
 // keeps the cached list, so it changes nothing and returns its error for the dialog to say.
 const reloadEditing = async (): Promise<unknown> => {
  const result = await attributes.refetch();
  if (result.isError) return result.error;
  setEditing(current => current && current !== "new" ? result.data?.items.find(item => item.id === current.id) ?? null : current);
  return null;
 };
 return <Page title={t("personData.title")}><div className="flex flex-col gap-4">
  <Surface title={t("personData.section")} help={t("personData.attributeHint")} actions={<DisabledReason reason={attributes.isSuccess && list.length >= 20 ? t("personData.limit", { count: 20 }) : null}><Button type="button" variant="outline" disabled={!attributes.isSuccess || list.length >= 20} onClick={() => setEditing("new")}><PlusIcon className="size-4" />{t("personData.addAttribute")}</Button></DisabledReason>}>
   {attributes.isPending ? <Spinner /> : attributes.error && !attributes.data ? <EmptyState embedded title={readErrorMessage(attributes.error, t)} action={<Button variant="outline" onClick={() => void attributes.refetch()}>{t("common:actions.retry")}</Button>} /> : !list.length ? <EmptyState embedded title={t("personData.noAttributes")} /> : <WideTable label={t("personData.attributesTable")}><TableHeader><TableRow>{["attribute", "state", "key", "type", "catalog", "usage", "actions"].map(key => <TableHead scope="col" key={key}>{t("personData." + key)}</TableHead>)}</TableRow></TableHeader><TableBody>{list.map(attribute => <TableRow key={attribute.id}>{/* One piece of data per column (UD5): the state and the source catalog go apart. */}<TableCell>{title(attribute)}</TableCell><TableCell>{t(attribute.isActive ? "catalogs.state.Active" : "catalogs.state.Inactive")}</TableCell><TableCell>{attribute.key}</TableCell><TableCell>{t(attribute.type === "Catalog" ? "catalogs.fields.types.catalog" : "catalogs.fields.types.text")}</TableCell><TableCell>{attribute.type === "Catalog" ? attribute.sourceCatalogName ?? "—" : "—"}</TableCell><TableCell>{usage(attribute)}</TableCell><TableCell><IconButton label={t("catalogs.editNamed", { name: title(attribute) })} size="icon-sm" onClick={() => setEditing(attribute)}><PencilIcon className="size-4" /></IconButton></TableCell></TableRow>)}</TableBody></WideTable>}
  </Surface>
  {canReadPeople ? <Surface title={t("personData.people")} actions={summary ? <span className="text-xs text-[var(--color-content-muted)]">{summary}</span> : undefined}><FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput label={t("personData.searchPeople")} value={pagination.search ?? ""} onChange={pagination.setSearch} /></div>
   {/* Last in the bar, apart from the search: it takes no rows out (OT1-C). */}
   <SortMenu columns={columns} sort={sort} onSortChange={setSort} /></div></FilterBar>
   <DataTable columns={columns} rows={people.data?.items ?? []} rowKey={person => person.userId} isLoading={people.isPending} refreshing={people.isPlaceholderData} hasData={!!people.data}
    error={people.error ? readErrorMessage(people.error, t) : undefined} onRetry={() => void people.refetch()} emptyTitle={t("personData.noPeople")} sort={sort} onSortChange={toggleSort} />
   {people.data ? <Pagination {...people.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
  </Surface> : <p className="text-sm text-[var(--color-content-muted)]">{t("personData.requiresUsersRead")}</p>}
 </div>{editing ? <PersonAttributeDialog scope={scope} attribute={editing === "new" ? null : editing} takenKeys={list.map(attribute => attribute.key)} onReload={reloadEditing} onClose={() => setEditing(null)} /> : null}</Page>;
}
