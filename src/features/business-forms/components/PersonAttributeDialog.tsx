import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { createPersonAttribute, updatePersonAttribute, type PersonAttribute } from "../api/personData";
import { catalogFieldKeyFromName } from "../catalogFields";
import { contentReference, contentRequired, ownTexts } from "../editorModel";
import { personDataScopeKey, type PersonDataScope } from "../hooks/usePersonData";
import type { FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { CatalogFieldSourceInput } from "./CatalogFieldSourceInput";
import { CatalogRowHelp } from "./CatalogRow";

type Names = Readonly<Partial<Record<FormCulture, string>>>;
// The name is one field in the menu language: a new attribute is born in it, and outside the attribute's original it is the
// optional translation, with the original as a reference that is never copied. The draft keeps both languages.
export function PersonAttributeDialog({ scope, attribute, takenKeys, onClose, onReload }: { scope: PersonDataScope; attribute: PersonAttribute | null;
 /** The keys of the other attributes, which a new one's key does not repeat. */ takenKeys: readonly string[]; onClose: () => void; onReload: () => Promise<unknown> }) {
 const { t } = useTranslation("forms"), client = useQueryClient(), keyId = useId();
 const culture = scope.culture, original = attribute?.originalCulture ?? scope.culture;
 const [key, setKey] = useState(attribute?.key ?? ""), [name, setName] = useState<Names>({ ...attribute?.name });
 // A new attribute's key follows its name, as a catalog field's does, until it is written by hand; a saved one keeps its key.
 const [keyEdited, setKeyEdited] = useState(false);
 const changeName = (text: string) => { setName({ ...name, [culture]: text }); if (!attribute && !keyEdited) setKey(catalogFieldKeyFromName(text, takenKeys)); };
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
 const changeSource = (next: string | null) => { setSource(next); setConfirmValues(false); };
 const canReadCatalogs = scope.permissions.includes("formcatalogs.read");
 // Only the languages with text travel: an existing translation is kept, a blank one is not sent.
 const names = ownTexts(name), reference = contentReference(name, culture, original);
 // Saving validates on the attempt and then live: the name in the attribute's original, a new attribute's key and the catalog
 // of a Catalog attribute. Save is not turned off by them; the first marked control takes the focus.
 const [attempted, setAttempted] = useState(false), [focusMarked, setFocusMarked] = useState<object | null>(null), fieldsRef = useRef<HTMLDivElement>(null);
 const missing = { name: !names[original], key: !attribute && !key.trim(), sourceCatalogId: type === "Catalog" && !sourceCatalogId };
 const required = (path: keyof typeof missing) => attempted && missing[path] ? t("personData.required") : undefined;
 useEffect(() => { if (focusMarked) fieldsRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(); }, [focusMarked]);
 async function save() {
  if (operation.current || !scope.permissions.includes("formpersondata.manage")) return;
  setAttempted(true);
  if (Object.values(missing).some(Boolean)) { setFocusMarked({}); return; }
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
 const keyError = message("key") ?? required("key");
 // No notes in the dialog: the key's help is the tooltip of its (i), and the catalog is the same dropdown as a catalog field's,
 // without its description (2026-10-31).
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{t(attribute ? "personData.editAttribute" : "personData.addAttribute")}</DialogTitle></DialogHeader><div ref={fieldsRef} className="space-y-4">
  <FormField label={t("name")} required={contentRequired(name, culture, original)} hint={reference ? t("originalText", { language: t("cultures." + original), text: reference }) : undefined} error={localizedIssueMessage(localizedIssue(errors, "name", culture), culture, t) ?? required("name")}><Input ref={nameRef} value={name[culture] ?? ""} disabled={busy} maxLength={120} placeholder={culture !== original ? t("missingText") : undefined} onChange={event => changeName(event.target.value)} /></FormField>
  {/* FormField puts its label inside a <label>, where a button does not belong: the (i) goes beside the Label, as in «Campos de…». */}
  <div className="flex flex-col gap-1.5">
   <div className="flex items-center gap-1"><Label htmlFor={keyId}>{t("catalogs.fields.key")}<span aria-hidden="true"> *</span></Label><CatalogRowHelp label={t("catalogs.fields.keyHelp")} text={t("catalogs.fields.keyHint")} /></div>
   <Input id={keyId} value={key} readOnly={!!attribute} disabled={busy} maxLength={40} aria-invalid={keyError ? true : undefined} aria-describedby={keyError ? keyId + "-message" : undefined} onChange={event => { setKey(event.target.value); setKeyEdited(true); }} />
   {keyError ? <p id={keyId + "-message"} role="alert" className="text-sm text-[var(--color-danger)]">{keyError}</p> : null}
  </div>
  <FormField label={t("personData.type")} required error={message("type")}><NativeSelect value={type} disabled={busy || inUse} onChange={event => changeType(event.target.value as PersonAttribute["type"])}><option value="Catalog">{t("catalogs.fields.types.catalog")}</option><option value="Text">{t("catalogs.fields.types.text")}</option></NativeSelect></FormField>
  {type === "Catalog" ? <FormField label={t("catalogQuestion.catalog")} required error={message("sourceCatalogId") ?? required("sourceCatalogId")}>
   {canReadCatalogs ? <CatalogFieldSourceInput scope={scope} value={sourceCatalogId} label={t("catalogQuestion.catalog")} readOnly={busy || inUse} onChange={changeSource} />
    : <DisabledReason reason={t("catalogQuestion.requiresRead")} className="grid w-full"><Input disabled value={attribute?.sourceCatalogName ?? ""} /></DisabledReason>}
  </FormField> : null}
  {removalCount !== null && removalPending ? <CheckboxField label={t("personData.confirmValueRemoval", { count: removalCount })} checked={confirmValues} disabled={busy} onCheckedChange={setConfirmValues} /> : null}
  {attribute ? <CheckboxField label={t("personData.attributeActive")} checked={isActive} disabled={busy || inUse} error={message("isActive")} onCheckedChange={setActive} /> : null}
  {inUse ? <div className="text-sm">{namedUses ? <><p>{t("personData.inUse")}</p><ul className="list-inside list-disc">{usedBy.map(use => <li key={use.definitionId}>{use.name}</li>)}</ul></> : <p>{t("personData.inUseCount", { count: usedBy.length })}</p>}</div> : null}
  {error && !Object.keys(errors).length ? <div className="space-y-2"><p role="alert" className="text-sm text-[var(--color-danger)]">{operationalErrorMessage(error, t, "save")}{reloadError ? " " + readErrorMessage(reloadError, t) : null}</p>{conflict ? <Button type="button" variant="outline" pending={reloading} disabled={busy} onClick={reload}>{t(reloading ? "personData.reloading" : "personData.reloadAttribute")}</Button> : null}</div> : null}
 {/* What waits says so with the common busy button (LC1-A): saving and rereading the attribute. */}
 </div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button><Button type="button" pending={busy} disabled={conflict} onClick={() => void save()}>{t(busy ? "saving" : "common:actions.save")}</Button></DialogFooter></DialogContent></Dialog>;
}
