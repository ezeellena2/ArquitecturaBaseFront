import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";

type Template = { name: string; body: string; language: string; category: string; status: string };
export function TemplatesProposal() {
  const { t } = useTranslation("finalProposal");
  const [rows, setRows] = useState<Template[]>(() => [
    { name: "confirmacion_solicitud", body: t("exampleBody"), language: "es_AR", category: "utility", status: "approved" },
    { name: "aviso_disponibilidad", body: t("exampleBody"), language: "es_AR", category: "utility", status: "pending" },
    { name: "novedades", body: t("exampleBody"), language: "es_AR", category: "marketing", status: "rejected" },
  ]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState("");
  const [category, setCategory] = useState("utility");
  const [language, setLanguage] = useState("es_AR");
  const [error, setError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirty = open && (name.length > 0 || body.length > 0 || examples.length > 0 || category !== "utility" || language !== "es_AR");
  const guard = useUnsavedChangesGuard(dirty);
  const restoreFocus = useRestoreFocusOnClose(open || preview !== null);
  const visible = rows.filter(row => row.name.includes(search.toLowerCase()) && (status === "all" || row.status === status));
  function create() { setName(""); setBody(""); setExamples(""); setCategory("utility"); setLanguage("es_AR"); setError(""); setOpen(true); }
  function submit() {
    if (!name.trim() || !body.trim()) { setError("required"); return; }
    if (!/^[a-z0-9_]+$/.test(name) || rows.some(row => row.name === name)) { setError("templateNameError"); return; }
    const variables = [...new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1])))].sort((a, b) => a - b);
    const samples = examples.split("\n").map(value => value.trim()).filter(Boolean);
    if (variables.some((value, index) => value !== index + 1) || samples.length < variables.length) { setError("examplesError"); return; }
    setRows(previous => [...previous, { name, body, category, language, status: "pending" }]); setOpen(false);
    notify({ id: "proposal-template", kind: "success", message: t("submitted") });
  }
  const rendered = body.replace(/\{\{(\d+)\}\}/g, (match, number: string) => examples.split("\n")[Number(number) - 1]?.trim() || match);
  return <Page title={t("templates")} actions={<Button onClick={create}>{t("newTemplate")}</Button>}>
    <p className="mb-4 text-sm text-[var(--color-content-muted)]">{t("lab")}</p>
    <FilterBar><div className="proposal-filters"><SearchInput value={search} onChange={setSearch} label={t("templateName")} /><FormField label={t("templateStatus")}><NativeSelect value={status} onChange={event => setStatus(event.target.value)}>{["all", "approved", "pending", "rejected"].map(value => <option value={value} key={value}>{t(value)}</option>)}</NativeSelect></FormField></div></FilterBar>
    <Surface>{!visible.length ? <EmptyState embedded title={t(rows.length ? "noMatches" : "emptyTemplates")} description={rows.length ? undefined : t("emptyTemplatesHint")} action={<Button variant="link" onClick={() => { setSearch(""); setStatus("all"); }}>{t("clear")}</Button>} /> : <Table><TableHeader><TableRow><TableHead>{t("templateName")}</TableHead><TableHead>{t("category")}</TableHead><TableHead>{t("language")}</TableHead><TableHead>{t("templateStatus")}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.name}><TableRowHeader>{row.name}</TableRowHeader><TableCell>{t(row.category)}</TableCell><TableCell>{row.language}</TableCell><TableCell>{t(row.status)}</TableCell><TableCell><Button variant="link" size="inline" onClick={() => setPreview(row)} aria-label={`${t("preview")}: ${row.name}`}>{t("preview")}</Button></TableCell></TableRow>)}</TableBody></Table>}</Surface>
    <p className="mt-4 text-xs text-[var(--color-content-muted)]">{t("templateHint")}</p>
    <Dialog open={open || preview !== null} onOpenChange={value => { if (!value) { if (dirty) setDiscardOpen(true); else { setOpen(false); setPreview(null); } } }}><DialogContent onCloseAutoFocus={restoreFocus}><DialogHeader><DialogTitle>{preview ? preview.name : t("newTemplate")}</DialogTitle><DialogDescription>{t(preview ? "previewHint" : "templateHint")}</DialogDescription></DialogHeader>
      {preview ? <><p className="text-sm">{t("templateStatus")}: {t(preview.status)}</p><p className="whitespace-pre-wrap rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 text-sm">{preview.body}</p></> : <div className="flex flex-col gap-4"><FormField label={t("templateName")} error={error === "required" || error === "templateNameError" ? t(error) : undefined}><Input value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="confirmacion_solicitud" maxLength={100} /></FormField><div className="ai-fields"><FormField label={t("language")}><NativeSelect value={language} onChange={e => setLanguage(e.target.value)}><option value="es_AR">Español (Argentina)</option><option value="en_US">English (US)</option></NativeSelect></FormField><FormField label={t("category")}><NativeSelect value={category} onChange={e => setCategory(e.target.value)}>{["utility", "marketing", "authentication"].map(value => <option key={value} value={value}>{t(value)}</option>)}</NativeSelect></FormField></div><FormField label={t("body")} error={error === "required" ? t(error) : undefined}><Textarea value={body} onChange={e => { setBody(e.target.value); setError(""); }} placeholder={t("exampleBody")} maxLength={1024} /></FormField><FormField label={t("examples")} hint={t("examplesHint")} error={error === "examplesError" ? t(error) : undefined}><Textarea value={examples} onChange={e => { setExamples(e.target.value); setError(""); }} placeholder="Martina" /></FormField>{body ? <div><p className="mb-2 text-xs text-[var(--color-content-muted)]">{t("preview")}</p><p className="whitespace-pre-wrap break-words text-sm">{rendered}</p></div> : null}</div>}
      <DialogFooter><Button variant="outline" onClick={() => dirty ? setDiscardOpen(true) : (setOpen(false), setPreview(null))}>{t("close")}</Button>{!preview ? <Button onClick={submit}>{t("submit")}</Button> : null}</DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={discardOpen || guard.isBlocked} onOpenChange={value => { if (!value) { setDiscardOpen(false); guard.stay(); } }} title={t("draftLeave")} description={t("draftLeaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={() => { if (guard.isBlocked) guard.leave(); else { setDiscardOpen(false); setOpen(false); } }} />
  </Page>;
}
