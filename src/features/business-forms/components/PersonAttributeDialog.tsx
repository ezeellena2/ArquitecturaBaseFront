import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { createPersonAttribute, updatePersonAttribute, type PersonAttribute } from "../api/personData";
import { contentReference, contentRequired, ownTexts } from "../editorModel";
import { personDataScopeKey, type PersonDataScope } from "../hooks/usePersonData";
import type { FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

type Names = Readonly<Partial<Record<FormCulture, string>>>;
// The name is one field in the menu language: a new attribute is born in it, and outside the attribute's original it is the
// optional translation, with the original as a reference that is never copied. The draft keeps both languages.
export function PersonAttributeDialog({ scope, attribute, onClose, onReload }: { scope: PersonDataScope; attribute: PersonAttribute | null; onClose: () => void; onReload: () => Promise<unknown> }) {
 const { t } = useTranslation("forms"), client = useQueryClient();
 const culture = scope.culture, original = attribute?.originalCulture ?? scope.culture;
 const [key, setKey] = useState(attribute?.key ?? ""), [name, setName] = useState<Names>({ ...attribute?.name });
 const [type, setType] = useState<PersonAttribute["type"]>(attribute?.type ?? "Catalog"), [sourceCatalogId, setSource] = useState(attribute?.sourceCatalogId ?? null), [isActive, setActive] = useState(attribute?.isActive ?? true);
 const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [confirmValues, setConfirmValues] = useState(false);
 // Rereading after a conflict: the button waits for it and a failed read is said under the conflict, which stays.
 const [reloading, setReloading] = useState(false), [reloadError, setReloadError] = useState<unknown>(null);
 // The server counts the people holding a value only when the type or source changes; once that 400 arrives the confirmation stays for the life of the dialog, shown while the type or source is changed, so a later save never sends it unseen.
 const [removalCount, setRemovalCount] = useState<number | null>(null);
 const mounted = useRef(true), operation = useRef<AbortController | null>(null), nameRef = useRef<HTMLInputElement>(null);
 const restoreFocus = useRestoreFocusOnClose();
 useEffect(() => { mounted.current = true; nameRef.current?.focus(); return () => { mounted.current = false; operation.current?.abort(); }; }, []);
 // A reload after a revision conflict brings the saved attribute: the draft starts again from it in this same dialog (not a remount), so closing still returns the focus to the row that opened it.
 const [loaded, setLoaded] = useState(attribute);
 if (attribute !== loaded) { setLoaded(attribute); setName({ ...attribute?.name }); setType(attribute?.type ?? "Catalog"); setSource(attribute?.sourceCatalogId ?? null); setActive(attribute?.isActive ?? true); setError(null); setReloadError(null); setConfirmValues(false); setRemovalCount(null); }
 // Changing the type or the source of a saved attribute is what can clear the values people have.
 const removalPending = !!attribute && (type !== attribute.type || type === "Catalog" && sourceCatalogId !== attribute.sourceCatalogId);
 // After the first error it validates live: checking the box answers the request to confirm, and back at the saved type and
 // source nothing is cleared, so Tipo and Catálogo are no longer marked.
 const removalAnswered = error instanceof ApiError && error.code === "Forms.PersonAttribute.ValueRemovalNotConfirmed" && (confirmValues || !removalPending);
 const errors = error instanceof ApiError ? error.errors ?? {} : {}, message = (path: string) => removalAnswered && (path === "type" || path === "sourceCatalogId") ? undefined : errors[path]?.join(" ");
 const usedBy = attribute?.usedBy ?? [], inUse = usedBy.length > 0;
 // Without formtemplates.read the forms come unnamed: the dialog says only that it is blocked and by how many, without links.
 const namedUses = usedBy.every(use => use.name !== null);
 // Someone else saved this attribute: saving again needs the current revision, so only reloading (or cancelling) goes on.
 const conflict = error instanceof ApiError && error.code === "Forms.PersonAttribute.RevisionConflict";
 const reload = () => {
  setReloading(true); setReloadError(null);
  void onReload().then(failure => {
   if (!mounted.current) return;
   setReloading(false);
   if (failure) setReloadError(failure); else nameRef.current?.focus();
  });
 };
 const changeType = (next: PersonAttribute["type"]) => { setType(next); setConfirmValues(false); };
 const changeSource = (next: string) => { setSource(next); setConfirmValues(false); };
 const canReadCatalogs = scope.permissions.includes("formcatalogs.read");
 // Only the languages with text travel: an existing translation is kept, a blank one is not sent.
 const names = ownTexts(name), reference = contentReference(name, culture, original);
 async function save() {
  if (operation.current || !scope.permissions.includes("formpersondata.manage")) return;
  const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null);
  try {
   if (attribute) await updatePersonAttribute(attribute.id, { expectedRevision: attribute.revision, name: names, type, sourceCatalogId: type === "Catalog" ? sourceCatalogId : null, position: attribute.position, isActive, ...(confirmValues ? { confirmValueRemoval: true as const } : {}) }, controller.signal);
   else await createPersonAttribute({ key: key.trim(), name: names, type, sourceCatalogId: type === "Catalog" ? sourceCatalogId : null }, controller.signal);
   if (!mounted.current || controller.signal.aborted) return;
   await client.invalidateQueries({ queryKey: personDataScopeKey(scope) });
   if (mounted.current) onClose();
  } catch (failure) {
   if (!mounted.current || controller.signal.aborted) return;
   setError(failure);
   if (failure instanceof ApiError && failure.code === "Forms.PersonAttribute.ValueRemovalNotConfirmed") setRemovalCount(Number(failure.problem.count));
  }
  finally { if (operation.current === controller) operation.current = null; if (mounted.current) setBusy(false); }
 }
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{t(attribute ? "personData.editAttribute" : "personData.addAttribute")}</DialogTitle><DialogDescription>{t("personData.attributeHint")}</DialogDescription></DialogHeader><div className="space-y-4">
  <FormField label={t("name")} required={contentRequired(name, culture, original)} hint={reference ? t("originalText", { language: t("cultures." + original), text: reference }) : undefined} error={localizedIssueMessage(localizedIssue(errors, "name", culture), culture, t)}><Input ref={nameRef} value={name[culture] ?? ""} disabled={busy} maxLength={120} placeholder={culture !== original ? t("missingText") : undefined} onChange={event => setName({ ...name, [culture]: event.target.value })} /></FormField>
  <FormField label={t("catalogs.fields.key")} required error={message("key")} hint={t("catalogs.fields.keyHint")}><Input value={key} readOnly={!!attribute} disabled={busy} maxLength={40} onChange={event => setKey(event.target.value)} /></FormField>
  <FormField label={t("personData.type")} required error={message("type")}><NativeSelect value={type} disabled={busy || inUse} onChange={event => changeType(event.target.value as PersonAttribute["type"])}><option value="Catalog">{t("catalogs.fields.types.catalog")}</option><option value="Text">{t("catalogs.fields.types.text")}</option></NativeSelect></FormField>
  {type === "Catalog" ? canReadCatalogs ? <CatalogQuestionSelector scope={scope} manualOnly value={sourceCatalogId ?? ""} readOnly={busy || inUse} error={message("sourceCatalogId")} onChange={changeSource} /> : <FormField label={t("catalogQuestion.catalog")} required hint={t("catalogQuestion.requiresRead")} error={message("sourceCatalogId")}><Input readOnly value={attribute?.sourceCatalogName ?? ""} /></FormField> : null}
  {removalCount !== null && removalPending ? <CheckboxField label={t("personData.confirmValueRemoval", { count: removalCount })} checked={confirmValues} disabled={busy} onCheckedChange={setConfirmValues} /> : null}
  {attribute ? <CheckboxField label={t("personData.attributeActive")} checked={isActive} disabled={busy || inUse} error={message("isActive")} onCheckedChange={setActive} /> : null}
  {inUse ? <div className="text-sm">{namedUses ? <><p>{t("personData.inUse")}</p><ul className="list-inside list-disc">{usedBy.map(use => <li key={use.definitionId}>{use.name}</li>)}</ul></> : <p>{t("personData.inUseCount", { count: usedBy.length })}</p>}</div> : null}
  {error && !Object.keys(errors).length ? <div className="space-y-2"><p role="alert" className="text-sm text-[var(--color-danger)]">{operationalErrorMessage(error, t, "save")}{reloadError ? " " + readErrorMessage(reloadError, t) : null}</p>{conflict ? <Button type="button" variant="outline" disabled={busy || reloading} onClick={reload}>{t("personData.reloadAttribute")}</Button> : null}</div> : null}
 </div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button><Button type="button" disabled={busy || conflict || !Object.keys(names).length || !key.trim() || type === "Catalog" && !sourceCatalogId} onClick={() => void save()}>{t("common:actions.save")}</Button></DialogFooter></DialogContent></Dialog>;
}
