import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { UserDataSectionContext } from "@/shared/hooks/userDataSectionContext";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon, PlusIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { WideTable } from "@/shared/ui/WideTable";
import type { PersonAttribute } from "../api/personData";
import { PersonAttributeDialog } from "../components/PersonAttributeDialog";
import { localizedValue } from "../editorModel";
import { personDataForbidden, personDataScopeKey, usePersonAttributes, usePersonDataPage, type PersonDataScope } from "../hooks/usePersonData";

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
 const [denied, setDenied] = useState(false), [peopleDenied, setPeopleDenied] = useState(false);
 const [editing, setEditing] = useState<PersonAttribute | "new" | null>(null);
 const attributes = usePersonAttributes(scope, !denied);
 const people = usePersonDataPage(scope, { page: pagination.page, pageSize: pagination.pageSize, search: pagination.search, sort: pagination.sort === "-displayName" ? "-displayName" : "displayName" }, !denied && !peopleDenied && pagination.ready);
 const lostAttributes = personDataForbidden(attributes.error), lostPeople = personDataForbidden(people.error);
 if (lostAttributes && !denied) { setDenied(true); setEditing(null); }
 if (lostPeople && !peopleDenied) setPeopleDenied(true);
 useEffect(() => {
  const key = denied ? privateKey : peopleDenied ? [...privateKey, "page"] : null;
  if (key) { void client.cancelQueries({ queryKey: key }); client.removeQueries({ queryKey: key }); }
 }, [denied, peopleDenied, client, privateKey]);
 if (denied || lostAttributes) return <ForbiddenPage />;
 const list = attributes.data?.items ?? [], active = list.filter(attribute => attribute.isActive), canReadPeople = scope.permissions.includes("users.read") && !peopleDenied && !lostPeople;
 const title = (attribute: PersonAttribute) => localizedValue(attribute.name, scope.culture, "es");
 const canEditPeople = !!extension && scope.permissions.includes("users.manage");
 // After a revision conflict the dialog continues from the saved attribute; closing it meanwhile keeps it closed.
 const reloadEditing = async () => { const result = await attributes.refetch(); setEditing(current => current && current !== "new" ? result.data?.items.find(item => item.id === current.id) ?? null : current); };
 return <Page title={t("personData.title")}><div className="flex flex-col gap-4">
  <Surface title={t("personData.section")} actions={<Button type="button" variant="outline" disabled={!attributes.isSuccess || list.length >= 20} onClick={() => setEditing("new")}><PlusIcon className="size-4" />{t("personData.addAttribute")}</Button>}>
   <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("personData.attributeHint")}</p>
   {attributes.isPending ? <Spinner /> : attributes.error && !attributes.data ? <EmptyState embedded title={readErrorMessage(attributes.error, t)} action={<Button variant="outline" onClick={() => void attributes.refetch()}>{t("common:actions.retry")}</Button>} /> : !list.length ? <EmptyState embedded title={t("personData.noAttributes")} /> : <WideTable label={t("personData.attributesTable")}><TableHeader><TableRow>{["attribute", "key", "type", "usage", "actions"].map(key => <TableHead scope="col" key={key}>{t("personData." + key)}</TableHead>)}</TableRow></TableHeader><TableBody>{list.map(attribute => <TableRow key={attribute.id}><TableCell>{title(attribute)}{!attribute.isActive ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.state.Inactive")}</p> : null}</TableCell><TableCell>{attribute.key}</TableCell><TableCell>{attribute.type === "Catalog" ? t("catalogs.fields.types.catalog") + (attribute.sourceCatalogName ? " · " + attribute.sourceCatalogName : "") : t("catalogs.fields.types.text")}</TableCell><TableCell>{attribute.usedBy.map(use => use.name).join(", ") || "—"}</TableCell><TableCell><IconButton label={t("catalogs.editNamed", { name: title(attribute) })} size="icon-sm" onClick={() => setEditing(attribute)}><PencilIcon className="size-4" /></IconButton></TableCell></TableRow>)}</TableBody></WideTable>}
  </Surface>
  {canReadPeople ? <Surface title={t("personData.people")}><FilterBar><SearchInput label={t("personData.searchPeople")} value={pagination.search ?? ""} onChange={pagination.setSearch} /></FilterBar>
   {people.isPending ? <Spinner /> : people.error && !people.data ? <EmptyState embedded title={readErrorMessage(people.error, t)} action={<Button variant="outline" onClick={() => void people.refetch()}>{t("common:actions.retry")}</Button>} /> : !people.data?.items.length ? <EmptyState embedded title={t("personData.noPeople")} /> : <WideTable label={t("personData.people")}><TableHeader><TableRow><TableHead scope="col">{t("personData.person")}</TableHead>{active.map(attribute => <TableHead scope="col" key={attribute.id}>{title(attribute)}</TableHead>)}{canEditPeople ? <TableHead scope="col">{t("actionsColumn")}</TableHead> : null}</TableRow></TableHeader><TableBody>{people.data.items.map(person => <TableRow key={person.userId}><TableCell>{person.displayName ?? t("personData.unnamed")}</TableCell>{active.map(attribute => <TableCell key={attribute.id}>{person.values[attribute.id]?.text || "—"}</TableCell>)}{canEditPeople ? <TableCell><IconButton label={t("personData.editPerson", { name: person.displayName ?? t("personData.unnamed") })} size="icon-sm" onClick={() => extension.openUser(person.userId, () => void client.invalidateQueries({ queryKey: [...privateKey, "page"] }))}><PencilIcon className="size-4" /></IconButton></TableCell> : null}</TableRow>)}</TableBody></WideTable>}
   {people.data ? <Pagination {...people.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
  </Surface> : <p className="text-sm text-[var(--color-content-muted)]">{t("personData.requiresUsersRead")}</p>}
 </div>{editing ? <PersonAttributeDialog scope={scope} attribute={editing === "new" ? null : editing} onReload={reloadEditing} onClose={() => setEditing(null)} /> : null}</Page>;
}
