import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import type { FormStandard } from "../api/library";
import { DocumentFormQuestions } from "../components/documents/DocumentFormQuestions";
import { DocumentFormSources } from "../components/documents/DocumentFormSources";
import { FormStandardAddDialog } from "../components/FormStandardAddDialog";
import { documentFormBody, documentFormChanged, documentFormEdit, documentFormLimits, documentFormProblems, documentFormProposalPath,
  documentFormReadings, documentQuestionIndex, type DocumentFormEdit } from "../documentFormProposal";
import { folderPath, treeOrder } from "../folderTree";
import { useDocumentFormProposal, type DocumentFormAsk } from "../hooks/useDocumentFormProposal";
import { useFolderScope, useFolderTree } from "../hooks/useFormFolders";
import { useFormLibrary } from "../hooks/useFormLibrary";
import { useReceivedDocumentScope } from "../hooks/useReceivedDocuments";
import type { FormCulture } from "../model";
import { documentFormProposalFailureKey, isReceivedDocumentId, receivedDocumentsPath } from "../receivedDocuments";

// The fields of the form, in the order a problem is looked for.
const fieldOrder = ["name", "prefix", "submitLabel", "recognition"] as const;

/**
 * «Armar formulario con la IA» (DOC6, decision 17): the form the assistant proposes from one unclassified document or from a group of
 * similar ones, waited for like a dictation, reviewed and edited here, and created as a draft with the reading on, which opens the editor.
 * It asks for «Revisar documentos» and «Diseñar formularios» besides seeing the inbox; each owner and request starts from scratch.
 */
export function DocumentFormProposalPage() {
  const scope = useReceivedDocumentScope();
  const { requestId } = useParams();
  if (!scope.allowed || !scope.buildsForms) return <ForbiddenPage />;
  if (!isReceivedDocumentId(requestId)) return <Unavailable message={null} />;
  return <DocumentFormProposal key={scope.owner + ":" + requestId} requestId={requestId} />;
}

// A request that is not there, or one the server will not build: what it said, and the way back to the inbox.
function Unavailable({ message }: { message: string | null }) {
  const { t } = useTranslation("formDocuments");
  return <Page title={t("formProposal.title")} backTo={{ to: receivedDocumentsPath, label: t("title") }}>
    <Surface><EmptyState embedded title={message ?? t("formProposal.failure.notFound")}
      action={<Button asChild variant="outline"><Link to={receivedDocumentsPath}>{t("formProposal.goBack")}</Link></Button>} /></Surface>
  </Page>;
}

// «Agregar el estándar» opens the library's «Agregar», with the folders of «Diseñar formularios», read only when it opens.
function StandardAddition({ standard, onClose }: { standard: FormStandard; onClose: () => void }) {
  const tree = useFolderTree(useFolderScope(), "designs");
  const folders = useMemo(() => { const all = tree.data?.folders ?? []; return treeOrder(all).map(entry => ({ id: entry.folder.id, path: folderPath(all, entry.folder.id).join(" / ") })); }, [tree.data]);
  return <FormStandardAddDialog standard={standard} folders={folders} onOpenChange={open => { if (!open) onClose(); }} />;
}

function DocumentFormProposal({ requestId }: { requestId: string }) {
  const { t, i18n } = useTranslation(["formDocuments", "forms", "common"]);
  const scope = useReceivedDocumentScope();
  const zone = scope.user?.timeZoneId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  useBreadcrumbLeaf(t("formProposal.title"));
  const documentParam = params.get("documento") ?? undefined, topicParam = params.get("tema") ?? undefined;
  const ask = useMemo<DocumentFormAsk | null>(() => isReceivedDocumentId(documentParam) ? { documentId: documentParam }
    : isReceivedDocumentId(topicParam) ? { topicId: topicParam } : null, [documentParam, topicParam]);
  const [denied, setDenied] = useState(false);
  const deny = useCallback(() => setDenied(true), []);
  // Once the server keeps the request, the address names only it: coming back reads it.
  const asked = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  const request = useDocumentFormProposal(requestId, ask, { onAsked: asked, onDenied: deny });
  const proposal = request.proposal;
  const proposed = proposal?.state === "completed" ? proposal.proposal : null;
  const content = proposed?.content;
  const drafted = proposal?.definitionId ?? null;
  const culture: FormCulture = i18n.language === "en" ? "en" : "es";
  const formScope = useMemo(() => ({ actorId: scope.user?.id ?? null, culture, permissions: scope.permissions }), [scope.user?.id, culture, scope.permissions]);

  // The form as it is edited, from the proposal, in memory only.
  const [form, setForm] = useState<{ proposalId: string; edit: DocumentFormEdit } | null>(null);
  if (proposed && content && form?.proposalId !== proposed.id) setForm({ proposalId: proposed.id, edit: documentFormEdit(content) });
  const edit = proposed && form?.proposalId === proposed.id ? form.edit : null;
  const [attempted, setAttempted] = useState(false);
  const [server, setServer] = useState<Readonly<Record<string, string>>>({});
  const change = (next: Partial<DocumentFormEdit>) => {
    if (!edit || !proposed) return;
    setForm({ proposalId: proposed.id, edit: { ...edit, ...next } });
    // What changed no longer has the server's problem; the questions move, so theirs go together.
    setServer(current => Object.fromEntries(Object.entries(current).filter(([path]) => !(path in next) && !(next.questions && path.startsWith("questions")))));
  };
  const local = attempted && edit ? documentFormProblems(edit) : {};
  const problem = (path: string) => server[path] ?? (local[path] ? t(local[path]) : undefined);
  const questionProblems = () => {
    const byQuestion: Record<number, string> = {};
    for (const [path, message] of [...Object.entries(server), ...Object.entries(local).map(([path, key]) => [path, t(key)] as const)]) {
      const index = documentQuestionIndex(path);
      if (index !== null && byQuestion[index] === undefined) byQuestion[index] = message;
    }
    return { list: problem("questions"), byQuestion };
  };

  const dirty = !!edit && !!content && !drafted && documentFormChanged(edit, content);
  const guard = useUnsavedChangesGuard(dirty && !request.creating);
  // A draft created after the person left does not take them from where they went.
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const focusProblem = (paths: readonly string[]) => setTimeout(() => {
    const field = fieldOrder.find(path => paths.includes(path));
    const index = paths.map(documentQuestionIndex).filter((value): value is number => value !== null).sort((a, b) => a - b)[0];
    const key = index === undefined ? undefined : edit?.questions[index]?.key;
    const target = field ? `[data-form-field="${field}"]` : key ? `[data-question-edit="${key}"]` : paths.includes("questions") ? "[data-question-add]" : null;
    if (target) globalThis.document.querySelector<HTMLElement>(target)?.focus();
  }, 0);
  const create = async () => {
    if (!edit || !proposed) return;
    const found = documentFormProblems(edit);
    if (Object.keys(found).length) { setAttempted(true); focusProblem(Object.keys(found)); return; }
    const outcome = await request.create(documentFormBody(requestId, proposed.id, edit), edit.name.trim());
    if (outcome.kind === "created") { if (mounted.current) { guard.allowNextNavigation(); void navigate(`/formularios/${outcome.definitionId}`); } }
    else if (outcome.kind === "problems") { setServer(outcome.fields); setAttempted(true); focusProblem(Object.keys(outcome.fields)); }
  };

  // A similar standard of the library, read only when the proposal names one: «Agregar el estándar» opens its «Agregar».
  const [standardDismissed, setStandardDismissed] = useState(false);
  const [adding, setAdding] = useState<FormStandard | null>(null);
  const suggestion = content?.standard && !drafted && !standardDismissed ? content.standard : null;
  const library = useFormLibrary(formScope, { enabled: !!suggestion, silent: true });
  const standard = suggestion ? library.data?.standards.find(item => item.key === suggestion.key) : undefined;

  if (denied) return <ForbiddenPage />;
  const wait = request.cooldown.isRunning ? t("wait", { count: request.cooldown.seconds }) : null;
  const askError = request.askError;
  if (askError instanceof ApiError && [400, 404, 409].includes(askError.status)) return <Unavailable message={askError.detail ?? null} />;
  // A request the server no longer has, also when it is read again after «Crear borrador» found its proposal gone.
  if (request.readError instanceof ApiError && request.readError.status === 404) return <Unavailable message={null} />;

  const back = { to: receivedDocumentsPath, label: t("title") };
  const reask: DocumentFormAsk | null = proposal?.topic ? { topicId: proposal.topic.id } : proposal?.documents[0] ? { documentId: proposal.documents[0].id } : null;
  // Off, with its reason, only while the proposal is coming: a request that failed or could not be read has nothing to create.
  const createReason = request.creating ? null : wait ?? (proposal?.state === "pending" || !proposal ? t("formProposal.waitReason") : null);
  const actions = drafted ? <Button asChild><Link to={`/formularios/${drafted}`}>{t("formProposal.openDraft")}</Link></Button> : <>
    <Button type="button" variant="outline" onClick={() => void navigate(receivedDocumentsPath)}>{t("common:actions.cancel")}</Button>
    <DisabledReason reason={createReason}>
      <Button type="button" disabled={!!createReason || !edit} pending={request.creating} onClick={() => void create()}>{t(request.creating ? "formProposal.creating" : "formProposal.create")}</Button>
    </DisabledReason>
  </>;
  const leave = <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("common:unsavedChanges.title")}
    description={t("common:unsavedChanges.description")} cancelLabel={t("common:unsavedChanges.cancel")} confirmLabel={t("common:unsavedChanges.confirm")} destructive onConfirm={guard.leave} />;

  // Asking or reading it the first time, or when that failed: the zones that are coming, or why they are not (with nothing to create).
  if (!proposal) {
    const failed = askError ?? request.readError;
    // A 429 (the AI's quota or capacity, or the limit of requests) says the server's text; «Reintentar» waits what it asked, with its reason.
    const failure = failed instanceof ApiError && failed.status === 429 && failed.detail ? failed.detail : t(askError ? "formProposal.askFailed" : "formProposal.loadFailed");
    return <Page title={t("formProposal.title")} backTo={back} help={t("formProposal.help")} actions={failed ? undefined : actions}>
      {failed ? <Surface><EmptyState embedded title={failure} action={<DisabledReason reason={wait}>
        <Button type="button" variant="outline" disabled={!!wait} onClick={askError ? request.retryAsk : request.retryRead}>{t("common:actions.retry")}</Button>
      </DisabledReason>} /></Surface>
        : <Zones proposal={<>{request.asking ? <Working text={t("formProposal.asking")} /> : null}<FormSkeleton zones={formZones} /></>}
          documents={<FormSkeleton zones={[{ rows: 3 }]} />} />}
    </Page>;
  }

  const readOnly = !!drafted;
  const prefixShown = edit?.prefix.trim().toUpperCase() || "…";
  // A draft already created is opened, also when the engine no longer has its request and reads it as failed.
  const notice = drafted ? <Banner>{t("formProposal.drafted")}</Banner>
    : proposal.state === "failed"
    ? <Banner tone="danger" action={reask ? <Button type="button" variant="outline" size="sm" onClick={() => void navigate(documentFormProposalPath(crypto.randomUUID(), reask), { replace: true })}>
        {t("formProposal.askAgain")}</Button> : undefined}>{t(documentFormProposalFailureKey(proposal.failureCode ?? ""))}</Banner>
    : suggestion ? <Banner action={<div className="flex flex-wrap gap-2">
        <DisabledReason reason={standard ? null : library.isError ? t("formProposal.standardLoadFailed") : library.isPending ? t("common:states.loading")
          : t("formProposal.standardUnavailable", { name: suggestion.name })}>
          <Button type="button" size="sm" disabled={!standard} onClick={() => { if (standard) setAdding(standard); }}>{t("formProposal.addStandard")}</Button>
        </DisabledReason>
        {/* The notice leaves with this button: the focus goes to «Nombre», not to the page. */}
        <Button type="button" variant="outline" size="sm" onClick={() => {
          setStandardDismissed(true);
          setTimeout(() => globalThis.document.querySelector<HTMLElement>('[data-form-field="name"]')?.focus(), 0);
        }}>{t("formProposal.buildAnyway")}</Button>
      </div>}>{t("formProposal.standard", { name: suggestion.name })}</Banner>
    : null;
  const stalled = request.readError && proposal.state === "pending"
    ? <Banner tone="warning" action={<DisabledReason reason={wait}><Button type="button" variant="outline" size="sm" disabled={!!wait} onClick={request.retryRead}>{t("common:actions.retry")}</Button></DisabledReason>}>
      {t("formProposal.stalled")}</Banner> : null;
  const failed = proposal.state === "failed";
  // The assistant reads only the first documents (FormDocumentAuthoringPolicy.MaxReadings): the text never claims more.
  const total = proposal.documents.length;
  const waiting = total > documentFormReadings ? t("formProposal.waitingSome", { read: documentFormReadings, total }) : t("formProposal.waiting", { count: total });

  // The proposal on one side and its documents on the other, in every state: what arrives takes the place of the zones that were coming,
  // and the documents do not move. A request that failed says why where the form would go, with nothing to create, unless its draft
  // was created: then it opens it.
  return <Page title={t("formProposal.title")} backTo={back} help={t("formProposal.help")} actions={failed && !drafted ? undefined : actions}>
    <Zones documents={<DocumentFormSources documents={proposal.documents} zone={zone} onDenied={deny} />} proposal={<>
      {stalled ?? notice}
      {proposal.state === "pending" && !stalled ? <Working text={waiting} /> : null}
      {failed ? null : edit ? <>
        <Surface title={t("forms:form")} padded>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("forms:name")} required error={problem("name")}>
              <Input data-form-field="name" maxLength={120} readOnly={readOnly} value={edit.name} onChange={event => change({ name: event.target.value })} />
            </FormField>
            <FormField label={t("forms:prefix")} required help={t("forms:prefixHint", { prefix: prefixShown })} error={problem("prefix")}>
              <Input data-form-field="prefix" maxLength={12} readOnly={readOnly} value={edit.prefix} onChange={event => change({ prefix: event.target.value })} />
            </FormField>
            <FormField label={t("forms:submitLabel")} help={t("forms:submitHint")} error={problem("submitLabel")}>
              <Input data-form-field="submitLabel" maxLength={documentFormLimits.text} readOnly={readOnly} value={edit.submitLabel} onChange={event => change({ submitLabel: event.target.value })} />
            </FormField>
          </div>
          <FormField label={t("formProposal.recognition")} required help={t("formProposal.recognitionHelp")} error={problem("recognition")}>
            <Textarea data-form-field="recognition" maxLength={1000} rows={3} readOnly={readOnly} value={edit.recognition} onChange={event => change({ recognition: event.target.value })} />
          </FormField>
        </Surface>
        <DocumentFormQuestions questions={edit.questions} problems={questionProblems()} readOnly={readOnly} catalogScope={formScope} onChange={questions => change({ questions })} />
      </> : <FormSkeleton zones={formZones} />}
    </>} />
    {adding ? <StandardAddition standard={adding} onClose={() => setAdding(null)} /> : null}
    {leave}
  </Page>;
}

// The zones of the form that is coming: «El formulario» and «Preguntas».
const formZones = [{ fields: 4 }, { rows: 4 }];

// The proposal (its notices, the form and its questions) and, beside it on a wide screen and below it on a narrow one, its documents.
function Zones({ proposal, documents }: { proposal: ReactNode; documents: ReactNode }) {
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
    <div className="flex min-w-0 flex-col gap-4">{proposal}</div>
    <div className="min-w-0">{documents}</div>
  </div>;
}

// What takes a while (asking for the proposal, the assistant building it): the ring and its gerund.
function Working({ text }: { text: string }) {
  return <p role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{text}</p>;
}
