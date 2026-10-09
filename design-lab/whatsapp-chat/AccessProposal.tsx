import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";

const permissions = [["readChats", "readChatsHint"], ["send", "sendHint"], ["mode", "modeHint"], ["readContacts", "contactsHint"], ["useAi", "useAiHint"], ["configureAi", "configureAiHint"], ["configureChannel", "channelHint"], ["manageTemplates", "templatesHint"]] as const;
type Role = "admin" | "agent" | "reader";
type Selection = Record<string, boolean>;
const initial: Record<Role, Selection> = { admin: Object.fromEntries(permissions.map(([key]) => [key, true])), agent: { readChats: true, send: true, mode: true, readContacts: true }, reader: { readChats: true } };

export function AccessProposal() {
  const { t } = useTranslation("finalProposal");
  const [role, setRole] = useState<Role>("agent");
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Selection>({ ...initial.agent });
  const dirty = JSON.stringify(saved[role]) !== JSON.stringify(draft);
  const guard = useUnsavedChangesGuard(dirty);
  function change(key: string, checked: boolean) {
    setDraft(previous => ({ ...previous, [key]: checked, ...(key === "readChats" && !checked ? { send: false, mode: false, useAi: false } : {}) }));
  }
  return <Page title={t("permissions")} actions={<><Button variant="outline" disabled={!dirty} onClick={() => setDraft({ ...saved[role] })}>{t("discard")}</Button><Button disabled={!dirty} onClick={() => { setSaved(previous => ({ ...previous, [role]: { ...draft } })); notify({ id: "proposal-permissions", kind: "success", message: t("savedRole") }); }}>{t("save")}</Button></>}>
    <p className="mb-4 text-sm text-[var(--color-content-muted)]">{t("lab")}</p>
    <Surface padded><div className="max-w-sm"><FormField label={t("role")}><NativeSelect value={role} disabled={dirty} onChange={event => { const next = event.target.value as Role; setRole(next); setDraft({ ...saved[next] }); }}>{["admin", "agent", "reader"].map(value => <option key={value} value={value}>{t(value)}</option>)}</NativeSelect></FormField></div><p className="text-sm text-[var(--color-content-muted)]">{t(role === "admin" ? "adminHint" : "roleHint")}</p></Surface>
    <div className="mt-4"><Surface><Table><TableHeader><TableRow><TableHead>{t("permission")}</TableHead><TableHead>{t("description")}</TableHead><TableHead>{t("enabled")}</TableHead></TableRow></TableHeader><TableBody>{permissions.map(([key, hint], index) => <TableRow key={key}><TableRowHeader>{t(key)}</TableRowHeader><TableCell className="min-w-48 max-w-lg whitespace-normal">{t(hint)}</TableCell><TableCell><Checkbox aria-label={t(key)} checked={draft[key] ?? false} disabled={role === "admin" || index >= 5 || (["send", "mode", "useAi"].includes(key) && !draft.readChats)} onCheckedChange={checked => change(key, checked === true)} /></TableCell></TableRow>)}</TableBody></Table></Surface></div>
    <p className="mt-3 text-xs text-[var(--color-content-muted)]">{t("dependent")}</p>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("draftLeave")} description={t("draftLeaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
