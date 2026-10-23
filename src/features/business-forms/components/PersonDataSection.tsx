import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import type { UserDataSectionProps } from "@/shared/hooks/userDataSectionContext";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { PersonAttribute } from "../api/personData";
import { localizedValue } from "../editorModel";
import { usePersonAttributeOptions, usePersonData, type PersonDataScope } from "../hooks/usePersonData";

function PersonCatalogValue({ attribute, scope, value, text, disabled, onChange, ...aria }: { attribute: PersonAttribute; scope: PersonDataScope; value: string | null; text: string; disabled: boolean; onChange: (id: string | null) => void; id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) {
 const { t } = useTranslation("forms");
 const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState(""), [selected, setSelected] = useState<{ id: string; text: string } | null>(null);
 useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
 const options = usePersonAttributeOptions(scope, attribute.id, settled, !disabled);
 const current = options.data?.items.find(option => option.id === value)?.text ?? (selected?.id === value ? selected.text : text);
 return <div><Autocomplete {...aria} aria-label={localizedValue(attribute.name, scope.culture, "es")} value={search ?? current} disabled={disabled || options.isError} options={(options.data?.items ?? []).map(option => ({ id: option.id, label: option.text }))} onValueChange={next => { setSearch(next); if (!next) onChange(null); }} onBlur={() => setSearch(null)} onSelect={id => { const option = options.data?.items.find(option => option.id === id); if (option) { setSelected(option); onChange(id); setSearch(null); } }} footer={options.data?.hasNext ? t("personData.searchMore") : undefined} />{options.error ? <div className="space-y-1"><p className="text-sm text-[var(--color-danger)]">{readErrorMessage(options.error, t)}</p><Button type="button" variant="link" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button></div> : null}</div>;
}

export function PersonDataSection({ userId, disabled, userSaved, onState }: UserDataSectionProps) {
 const { t, i18n } = useTranslation("forms");
 const { data: user } = useCurrentUser();
 const scope: PersonDataScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
 const data = usePersonData(scope, userId);
 const [reloading, setReloading] = useState(false);
 const ready = (data.ready || data.denied || !!data.error && !data.dirty) && !data.conflict;
 useEffect(() => onState({ dirty: data.dirty, busy: data.busy, ready, save: data.save }), [onState, data.dirty, data.busy, ready, data.save]);
 const attributes = data.denied ? [] : (data.attributes.data?.items ?? []).filter(attribute => attribute.isActive);
 if (data.denied) return null;
 if (data.ready && !attributes.length) return null;
 const fieldErrors = data.error instanceof ApiError ? data.error.errors ?? {} : {};
 return <Surface title={t("personData.section")} headingLevel={3} padded>
  {!data.ready && !data.error ? <Spinner /> : <div className="grid gap-4 sm:grid-cols-2">{attributes.map(attribute => {
   const label = localizedValue(attribute.name, scope.culture, "es"), error = fieldErrors["values." + attribute.id]?.join(" ");
   const value = data.values?.[attribute.id] ?? null;
   return <FormField key={JSON.stringify([userId, scope.actorId, scope.culture, scope.permissions, attribute.id])} label={label} error={error}>{attribute.type === "Catalog" ? <PersonCatalogValue attribute={attribute} scope={scope} value={value} text={value ? data.baseline?.values[attribute.id]?.text ?? "" : ""} disabled={disabled || data.busy || !data.ready} onChange={id => data.changeValue(attribute.id, id)} /> : <Input maxLength={300} disabled={disabled || data.busy || !data.ready} value={value ?? ""} onChange={event => data.changeValue(attribute.id, event.target.value || null)} />}</FormField>;
  })}</div>}
  {data.error || data.conflict ? <div className="mt-3 space-y-2"><p role="alert" className="text-sm text-[var(--color-danger)]">{data.conflict ? t("personData.conflict") : data.ready ? t("personData.saveFailed") : readErrorMessage(data.error, t)}{userSaved ? " " + t("personData.userSaved") : ""}</p><Button type="button" variant="outline" disabled={disabled || data.busy} onClick={() => setReloading(true)}>{t("personData.reload")}</Button></div> : null}
  <ConfirmDialog open={reloading} onOpenChange={setReloading} title={t("personData.reload")} description={t("personData.reloadHint")} confirmLabel={t("personData.reload")} onConfirm={() => { setReloading(false); void data.reload(); }} />
 </Surface>;
}
