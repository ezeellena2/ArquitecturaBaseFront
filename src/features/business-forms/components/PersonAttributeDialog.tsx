import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { createPersonAttribute, updatePersonAttribute, type PersonAttribute } from "../api/personData";
import { personDataScopeKey, type PersonDataScope } from "../hooks/usePersonData";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

export function PersonAttributeDialog({ scope, attribute, onClose }: { scope: PersonDataScope; attribute: PersonAttribute | null; onClose: () => void }) {
 const { t } = useTranslation("forms"), client = useQueryClient();
 const [key, setKey] = useState(attribute?.key ?? ""), [name, setName] = useState({ es: attribute?.name.es ?? "", en: attribute?.name.en ?? "" });
 const [type, setType] = useState<PersonAttribute["type"]>(attribute?.type ?? "Catalog"), [sourceCatalogId, setSource] = useState(attribute?.sourceCatalogId ?? null), [isActive, setActive] = useState(attribute?.isActive ?? true);
 const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [confirmValues, setConfirmValues] = useState(false);
 const mounted = useRef(true), operation = useRef<AbortController | null>(null), nameRef = useRef<HTMLInputElement>(null);
 const restoreFocus = useRestoreFocusOnClose();
 useEffect(() => { mounted.current = true; nameRef.current?.focus(); return () => { mounted.current = false; operation.current?.abort(); }; }, []);
 const errors = error instanceof ApiError ? error.errors ?? {} : {}, message = (path: string) => errors[path]?.join(" ");
 const inUse = (attribute?.usedBy.length ?? 0) > 0;
 // The server counts the people holding a value only when the type or source changes; the confirmation follows that 400.
 const removalCount = error instanceof ApiError && error.code === "Forms.PersonAttribute.ValueRemovalNotConfirmed" ? Number(error.problem.count) : null;
 const changeType = (next: PersonAttribute["type"]) => { setType(next); setConfirmValues(false); };
 const changeSource = (next: string) => { setSource(next); setConfirmValues(false); };
 const canReadCatalogs = scope.permissions.includes("formcatalogs.read");
 async function save() {
  if (operation.current || !scope.permissions.includes("formpersondata.manage")) return;
  const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null);
  const names = { es: name.es.trim(), ...(name.en.trim() ? { en: name.en.trim() } : {}) };
  try {
   if (attribute) await updatePersonAttribute(attribute.id, { expectedRevision: attribute.revision, name: names, type, sourceCatalogId: type === "Catalog" ? sourceCatalogId : null, position: attribute.position, isActive, ...(confirmValues ? { confirmValueRemoval: true as const } : {}) }, controller.signal);
   else await createPersonAttribute({ key: key.trim(), name: names, type, sourceCatalogId: type === "Catalog" ? sourceCatalogId : null }, controller.signal);
   if (!mounted.current || controller.signal.aborted) return;
   await client.invalidateQueries({ queryKey: personDataScopeKey(scope) });
   if (mounted.current) onClose();
  } catch (failure) { if (mounted.current && !controller.signal.aborted) setError(failure); }
  finally { if (operation.current === controller) operation.current = null; if (mounted.current) setBusy(false); }
 }
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{t(attribute ? "personData.editAttribute" : "personData.addAttribute")}</DialogTitle><DialogDescription>{t("personData.attributeHint")}</DialogDescription></DialogHeader><div className="space-y-4">
  <div className="grid gap-4 sm:grid-cols-2"><FormField label={t("name")} required error={message("name.es") ?? message("name")}><Input ref={nameRef} value={name.es} disabled={busy} maxLength={120} onChange={event => setName({ ...name, es: event.target.value })} /></FormField><FormField label={t("catalogs.fields.englishName")} error={message("name.en")}><Input value={name.en} disabled={busy} maxLength={120} onChange={event => setName({ ...name, en: event.target.value })} /></FormField></div>
  <FormField label={t("catalogs.fields.key")} required error={message("key")} hint={t("catalogs.fields.keyHint")}><Input value={key} readOnly={!!attribute} disabled={busy} maxLength={40} onChange={event => setKey(event.target.value)} /></FormField>
  <FormField label={t("personData.type")} required error={message("type")}><NativeSelect value={type} disabled={busy || inUse} onChange={event => changeType(event.target.value as PersonAttribute["type"])}><option value="Catalog">{t("catalogs.fields.types.catalog")}</option><option value="Text">{t("catalogs.fields.types.text")}</option></NativeSelect></FormField>
  {type === "Catalog" ? canReadCatalogs ? <CatalogQuestionSelector scope={scope} manualOnly value={sourceCatalogId ?? ""} readOnly={busy || inUse} error={message("sourceCatalogId")} onChange={changeSource} /> : <FormField label={t("catalogQuestion.catalog")} required hint={t("catalogQuestion.requiresRead")} error={message("sourceCatalogId")}><Input readOnly value={attribute?.sourceCatalogName ?? ""} /></FormField> : null}
  {removalCount !== null ? <CheckboxField label={t("personData.confirmValueRemoval", { count: removalCount })} checked={confirmValues} disabled={busy} onCheckedChange={setConfirmValues} /> : null}
  {attribute ? <CheckboxField label={t("personData.attributeActive")} checked={isActive} disabled={busy || inUse} error={message("isActive")} onCheckedChange={setActive} /> : null}
  {inUse ? <div className="text-sm"><p>{t("personData.inUse")}</p><ul className="list-inside list-disc">{attribute?.usedBy.map(use => <li key={use.definitionId}>{use.name}</li>)}</ul></div> : null}
  {error && !Object.keys(errors).length ? <p role="alert" className="text-sm text-[var(--color-danger)]">{operationalErrorMessage(error, t, "save")}</p> : null}
 </div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button><Button type="button" disabled={busy || !name.es.trim() || !key.trim() || type === "Catalog" && !sourceCatalogId} onClick={() => void save()}>{t("common:actions.save")}</Button></DialogFooter></DialogContent></Dialog>;
}
