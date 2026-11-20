import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import type { UserDataSectionProps } from "@/shared/hooks/userDataSectionContext";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Picker } from "@/shared/ui/Picker";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { PersonAttribute } from "../api/personData";
import { administrativeName } from "../editorModel";
import { usePersonAttributeOptions, usePersonData, type PersonDataScope } from "../hooks/usePersonData";

/** A catalog datum with the only piece to choose (DS1-A): «Sin <dato>» first, which is no value, and the options of the server,
 * fifty at a time, asked for only while the list is open. The name of the chosen one may not be in the page: it is the saved text
 * or the last one chosen. Its wait, its failure and its retry are said inside the list. */
function PersonCatalogValue({ attribute, scope, value, text, disabled, onChange, ...aria }: { attribute: PersonAttribute; scope: PersonDataScope; value: string | null; text: string; disabled: boolean; onChange: (id: string | null) => void; id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) {
 const { t } = useTranslation("forms");
 const label = administrativeName(attribute.name, scope.culture);
 const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [settled, setSettled] = useState(""), [selected, setSelected] = useState<{ id: string; text: string } | null>(null);
 useEffect(() => { const timer = setTimeout(() => setSettled(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
 const options = usePersonAttributeOptions(scope, attribute.id, settled, open && !disabled);
 const items = options.data?.pages.flatMap(page => page.items) ?? [];
 // While what is typed waits its 300 ms, the list says it searches instead of showing the options of the search before.
 const typing = search.trim() !== settled;
 const current = items.find(option => option.id === value)?.text ?? (selected?.id === value ? selected.text : text);
 return <Picker {...aria} label={label} value={value ?? ""} disabled={disabled} onOpenChange={setOpen}
  first={{ id: "", label: t("personData.none", { label: label.charAt(0).toLocaleLowerCase(scope.culture) + label.slice(1) }) }}
  options={typing ? [] : items.map(option => ({ id: option.id, label: option.text }))} selectedOptions={value ? [{ id: value, label: current }] : undefined}
  search={search} onSearchChange={setSearch} total={options.data?.pages[0]?.totalCount} loading={typing || options.isLoading}
  failed={options.isError} onRetry={() => void options.refetch()} onLoadMore={options.hasNextPage ? () => void options.fetchNextPage() : undefined} loadingMore={options.isFetchingNextPage}
  onChange={id => { const option = items.find(item => item.id === id); if (option) setSelected(option); onChange(id || null); }}/>;
}

export function PersonDataSection({ userId, disabled, userSaved, onState }: UserDataSectionProps) {
 const { t, i18n } = useTranslation("forms");
 const { data: user } = useCurrentUser();
 const scope: PersonDataScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
 const data = usePersonData(scope, userId);
 const [reloading, setReloading] = useState(false);
 // Reloading waits in its confirmation, with «Volviendo a cargar…», and closes it when the data arrive or the read fails.
 const [reloadBusy, setReloadBusy] = useState(false);
 const ready =(data.ready || data.denied || !!data.error && !data.dirty) && !data.conflict;
 useEffect(() => onState({ dirty: data.dirty, busy: data.busy, ready, save: data.save }), [onState, data.dirty, data.busy, ready, data.save]);
 const attributes = data.denied ? [] : (data.attributes.data?.items ?? []).filter(attribute => attribute.isActive);
 if (data.denied) return null;
 if (data.ready && !attributes.length) return null;
 const fieldErrors = data.error instanceof ApiError ? data.error.errors ?? {} : {};
 return <Surface title={t("personData.section")} headingLevel={3} padded>
  {!data.ready && !data.error ? <Spinner /> : <div className="grid gap-4 sm:grid-cols-2">{attributes.map(attribute => {
   const label = administrativeName(attribute.name, scope.culture), error = fieldErrors["values." + attribute.id]?.join(" ");
   const value = data.values?.[attribute.id] ?? null;
   return <FormField key={JSON.stringify([userId, scope.actorId, scope.culture, scope.permissions, attribute.id])} label={label} error={error}>{attribute.type === "Catalog" ? <PersonCatalogValue attribute={attribute} scope={scope} value={value} text={value ? data.baseline?.values[attribute.id]?.text ?? "" : ""} disabled={disabled || data.busy || !data.ready} onChange={id => data.changeValue(attribute.id, id)} /> : <Input maxLength={300} disabled={disabled || data.busy || !data.ready} value={value ?? ""} onChange={event => data.changeValue(attribute.id, event.target.value || null)} />}</FormField>;
  })}</div>}
  {data.error || data.conflict ? <div className="mt-3 space-y-2"><p role="alert" className="text-sm text-[var(--color-danger)]">{data.conflict ? t("personData.conflict") : data.ready ? t("personData.saveFailed") : readErrorMessage(data.error, t)}{userSaved ? " " + t("personData.userSaved") : ""}</p><Button type="button" variant="outline" disabled={disabled || data.busy} onClick={() => setReloading(true)}>{t("personData.reload")}</Button></div> : null}
  <ConfirmDialog open={reloading} onOpenChange={setReloading} title={t("personData.reload")} description={t("personData.reloadHint")} confirmLabel={t("personData.reload")} pending={reloadBusy} pendingLabel={t("personData.reloading")} onConfirm={() => { setReloadBusy(true); void data.reload().finally(() => { setReloadBusy(false); setReloading(false); }); }} />
 </Surface>;
}
