import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { notify } from "@/shared/ui/notifications";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { AlertTriangleIcon, FlaskIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { assistantAgentKey, fetchAssistantAgent, type AgentCulture, type AssistantAgent } from "../api/assistantAgent";
import { AssistantCaseEditor, type CaseEditorTarget } from "../components/AssistantCaseEditor";
import { caseRowId, fallbackRowId, limitsFieldId, profileFieldId } from "../components/assistantAgentParts";
import { AssistantCasesTab } from "../components/AssistantCasesTab";
import { AssistantConflictReview } from "../components/AssistantConflictReview";
import { AssistantKnowledgeTab } from "../components/AssistantKnowledgeTab";
import { AssistantLimitsTab } from "../components/AssistantLimitsTab";
import { AssistantProfileTab } from "../components/AssistantProfileTab";
import { AssistantTestPanel, type AgentTestDraft } from "../components/AssistantTestPanel";
import { useAssistantAgentEditor, waitSeconds } from "../hooks/useAssistantAgentEditor";
import { caseCount, caseKey, hasIssuesUnder, issuesUnder, newCase, type DraftCase } from "../lib/assistantAgentDraft";

type Tab = "perfil" | "conocimiento" | "casos" | "limites";
const profileOrder = ["name", "tone", "introduction", "does", "doesNot", "handoffMessage"] as const;
const limitsOrder = [["limits.blockedTopics", limitsFieldId.topics], ["limits.cannotPromise", limitsFieldId.cannotPromise], ["limits.maxReplyLength", limitsFieldId.maxReplyLength],
  ["limits.dailyReplyLimit", limitsFieldId.dailyReplyLimit], ["limits.allowedActions", limitsFieldId.allowedActions]] as const;
const casesAddId = "agent-cases-add";

/** «Asistente» of the WhatsApp panel (AS1-A): the main agent, with «Configurar el asistente». A 403 of its read is «No tenés permiso». */
export function AssistantAgentPage() {
  const { data: user } = useCurrentUser();
  return user ? <AssistantAgentScreen key={user.id} actor={user.id} timeZone={user.timeZoneId} /> : null;
}

function AssistantAgentScreen({ actor, timeZone }: { actor: string; timeZone: string }) {
  const { t, i18n } = useTranslation("whatsappAssistant");
  const wait = useCountdown(0);
  // The language is part of the read: the forms and the knowledge come in it. Another language keeps what is in sight while it reads.
  const queryKey = [...assistantAgentKey, actor, i18n.resolvedLanguage ?? "es"] as const;
  const query = useQuery({ queryKey, refetchOnMount: "always", retry: false, refetchOnWindowFocus: false, placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      try { return await fetchAssistantAgent(signal); }
      catch (error) { const feedback = errorFeedback(error); if (feedback.kind === "wait") wait.restart(waitSeconds(feedback.retryAfterSeconds)); throw error; }
    } });
  const [initial, setInitial] = useState<AssistantAgent>();
  if (!initial && query.isSuccess && !query.isPlaceholderData && query.isFetchedAfterMount && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  // The forms, the knowledge and the availability come from the last read (the previous language while the new one arrives); the
  // editor starts once from the first one and keeps its draft.
  if (initial) return <AgentEditorScreen initial={initial} live={query.data ?? initial} queryKey={queryKey} actor={actor} timeZone={timeZone} />;
  // The cause of a failed read is the common notice of the query; here, what failed and its Retry, with the wait of a 429 as its reason.
  return <Page title={t("title")}>{query.isError ? <EmptyState title={t("loadFailed")} action={<DisabledReason reason={wait.isRunning ? t("waitRetry", { count: wait.seconds }) : null}>
    <Button type="button" variant="outline" disabled={wait.isRunning} pending={query.isFetching} onClick={() => void query.refetch()}>{t(query.isFetching ? "retrying" : "retry")}</Button>
  </DisabledReason>} /> : <FormSkeleton zones={[{ rows: 5 }]} />}</Page>;
}

function AgentEditorScreen({ initial, live, queryKey, actor, timeZone }: { initial: AssistantAgent; live: AssistantAgent; queryKey: readonly unknown[]; actor: string; timeZone: string }) {
  const { t, i18n } = useTranslation("whatsappAssistant");
  const culture: AgentCulture = i18n.resolvedLanguage === "en" ? "en" : "es";
  const { has, refetch } = usePermissions();
  const navigate = useNavigate();
  const editor = useAssistantAgentEditor(initial, queryKey);
  const phone = useMediaQuery("(width < 640px)");
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  // A new agent opens in Perfil; one already saved, in Casos, the most used tab. Saving the first time does not change the tab.
  const [defaultTab] = useState<Tab>(() => initial.revision === 0 ? "perfil" : "casos");
  const knowledgeShown = live.knowledge.availability === "Available";
  const tabs: Tab[] = knowledgeShown ? ["perfil", "conocimiento", "casos", "limites"] : ["perfil", "casos", "limites"];
  const requested = params.get("pestana") as Tab | null;
  const tab = requested && tabs.includes(requested) ? requested : defaultTab;
  const showTab = (next: string) => update({ pestana: next === defaultTab ? undefined : next }, { replace: false });
  const [editing, setEditing] = useState<CaseEditorTarget | null>(null);
  const [testing, setTesting] = useState(false);
  const [testDraft, setTestDraft] = useState<AgentTestDraft>({ recipient: null, messages: "" });
  const [discarding, setDiscarding] = useState(false);
  // The field that takes the focus once its tab is on screen.
  const pendingFocus = useRef<{ tab: Tab; id: string } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const { draft, errors } = editor;
  const original = editor.baseline.originalCulture;
  const locked = editor.busy || editor.conflict;

  // On the phone the tabs scroll sideways: the open one stays in sight, also when the address opens another.
  useEffect(() => {
    tabList.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tab]);

  // The tabs stay mounted (hidden): what is typed in one is still there when coming back, and the field of a problem is there to take
  // the focus as soon as its tab opens.
  useEffect(() => {
    const target = pendingFocus.current;
    const element = target?.tab === tab ? document.getElementById(target.id) : null;
    if (!element) return;
    pendingFocus.current = null;
    element.focus();
  });
  // Guardar with problems takes the focus to the first one, in the tab that has it: the tab changes first, then the field.
  const save = async () => {
    const target = focusTarget(await editor.save(), draft.cases);
    if (!target) return;
    if (target.tab === tab) { document.getElementById(target.id)?.focus(); return; }
    pendingFocus.current = target;
    showTab(target.tab);
  };

  const unavailable = live.assistantAvailability.state === "available" ? null : t("availability." + live.assistantAvailability.state);
  const blockedReason = editor.conflict ? t("conflict.saveReason") : null;
  const saveReason = blockedReason ?? (editor.waitSeconds > 0 ? t("waitSave", { count: editor.waitSeconds }) : null);
  const saveButton = (touch: boolean) => <DisabledReason reason={editor.changed ? saveReason : null} className={touch ? "grid w-full" : undefined}>
    <Button type="button" size={touch ? "touch" : "default"} disabled={!editor.changed || !!saveReason || editor.working === "review"} pending={editor.working === "save"}
      onClick={() => void save()}>{t(editor.working === "save" ? "saving" : "save")}</Button>
  </DisabledReason>;
  const discardButton = (touch: boolean) => <DisabledReason reason={editor.changed ? blockedReason : null} className={touch ? "grid w-full" : undefined}>
    <Button type="button" variant="outline" size={touch ? "touch" : "default"} disabled={!editor.changed || editor.busy || !!blockedReason} onClick={() => setDiscarding(true)}>{t("discard")}</Button>
  </DisabledReason>;
  // A 403 of Probar may only mean that reading WhatsApp chats went away (H4): with the permissions read again, the page stays, with
  // the panel closed and Probar off with its reason, as long as it can still configure the assistant.
  const leaveTest = async () => {
    const permissions = (await refetch()).data?.permissions ?? [];
    if (!permissions.includes("whatsapp.configureassistant")) { editor.guard.allowNextNavigation(); void navigate("/sin-permiso"); return; }
    // With both permissions the 403 was about the test (the account stopped being active): the panel stays and says so.
    if (permissions.includes("whatsapp.read")) { notify({ id: "whatsapp:assistant-test", kind: "error", message: t("test.failed") }); return; }
    setTesting(false);
  };
  // The assistant reads the real chat of the account it tests as: Probar is for someone who reads WhatsApp chats (H4).
  const testReason = unavailable ?? (has("whatsapp.read") ? null : t("test.needsChats"));
  const testButton = <DisabledReason reason={testReason}>
    <Button type="button" variant="outline" disabled={!!testReason} onClick={() => setTesting(true)}><FlaskIcon className="size-4" />{t("testAction")}</Button>
  </DisabledReason>;
  const problems = (shown: boolean): ReactNode => shown ? <><AlertTriangleIcon className="size-3.5 text-[var(--color-danger)]" /><span className="sr-only">{" · " + t("tabs.problems")}</span></> : null;
  const keys = Object.keys(errors);
  const editCase = (id: string) => {
    const index = draft.cases.findIndex(item => item.id === id);
    if (index >= 0) setEditing({ kind: "case", item: draft.cases[index]!, number: index + 1 });
  };
  const fallbackErrors = Object.fromEntries(Object.entries(issuesUnder(errors, "fallback")).map(([key, value]) => [key ? "action." + key : "", value]));

  return <Page title={t("title")} status={<span className="text-sm text-[var(--color-content-muted)]">{t("scope")}</span>}
    actions={<>{testButton}{phone ? null : <>{discardButton(false)}{saveButton(false)}</>}</>}>
    <div className="flex flex-col gap-4">
      {editor.baseline.revision === 0 ? <Banner><strong className="font-semibold">{t("unconfigured.title")}</strong> {t("unconfigured.body")}</Banner> : null}
      {editor.conflict ? <AssistantConflictReview draft={draft} review={editor.review} forms={live.forms} culture={culture} working={editor.working === "review"}
        onReview={() => void editor.reviewChanges()} onAccept={editor.acceptReview} /> : null}
      <Tabs value={tab} onValueChange={showTab}>
        <TabsList ref={tabList} aria-label={t("tabs.label")}>
          <TabsTrigger value="perfil">{t("tabs.profile")}{problems(keys.some(key => key.startsWith("profile.")))}</TabsTrigger>
          {knowledgeShown ? <TabsTrigger value="conocimiento">{t("tabs.knowledge")}</TabsTrigger> : null}
          <TabsTrigger value="casos">{t("tabs.cases")}{" "}<Badge variant="secondary">{caseCount(draft, live.forms)}</Badge>{problems(keys.some(key => key.startsWith("case:") || key.startsWith("fallback")))}</TabsTrigger>
          <TabsTrigger value="limites">{t("tabs.limits")}{problems(keys.some(key => key.startsWith("limits.")))}</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil" forceMount hidden={tab !== "perfil"}>
          <AssistantProfileTab profile={draft.profile} errors={errors} culture={culture} original={original} locked={locked} onChange={editor.setProfile} />
        </TabsContent>
        {knowledgeShown ? <TabsContent value="conocimiento" forceMount hidden={tab !== "conocimiento"}><AssistantKnowledgeTab knowledge={live.knowledge} canEdit={has("ai.business.manage")} /></TabsContent> : null}
        <TabsContent value="casos" forceMount hidden={tab !== "casos"}>
          <AssistantCasesTab cases={draft.cases} fallback={draft.fallback} forms={live.forms} errors={errors} culture={culture} original={original} locked={locked}
            canEditForms={has("formtemplates.manage")} addId={casesAddId} addRef={addRef}
            onAdd={() => setEditing({ kind: "case", item: newCase(crypto.randomUUID()), number: null })} onEdit={editCase}
            onEditFallback={() => setEditing({ kind: "fallback", action: draft.fallback })}
            onRemove={id => { editor.removeCase(id); addRef.current?.focus(); }} onMove={editor.moveCase} onActive={editor.setCaseActive} />
        </TabsContent>
        <TabsContent value="limites" forceMount hidden={tab !== "limites"}>
          <AssistantLimitsTab limits={draft.limits} errors={errors} locked={locked} message={editor.message} onChange={editor.setLimits} />
        </TabsContent>
      </Tabs>
    </div>
    {/* On the phone, Descartar and Guardar stay at the bottom while the tab scrolls. */}
    {phone ? <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      {discardButton(true)}{saveButton(true)}
    </div> : null}
    {editing ? <AssistantCaseEditor key={editing.kind === "case" ? editing.item.id : "fallback"} target={editing} forms={live.forms} allowed={draft.limits.allowedActions}
      culture={culture} original={original} errors={editing.kind === "case" ? issuesUnder(errors, caseKey(editing.item.id)) : fallbackErrors}
      attempted={editor.attempted} message={editor.message} focusFallback={addRef}
      onDone={value => { if (editing.kind === "case") editor.putCase(value); else editor.setFallback(value.action); }} onClose={() => setEditing(null)}
      onRemove={id => { editor.removeCase(id); setEditing(null); }} /> : null}
    {testing ? <AssistantTestPanel actor={actor} timeZone={timeZone} unsaved={editor.changed} unavailable={unavailable} draft={testDraft} onDraftChange={setTestDraft}
      onClose={() => setTesting(false)} onForbidden={() => void leaveTest()} /> : null}
    <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title={t("discardTitle")} description={t("discardHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={editor.discard} />
    <ConfirmDialog open={editor.guard.isBlocked} onOpenChange={open => { if (!open) editor.guard.stay(); }} title={t("discardTitle")} description={t("discardHint")}
      confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={editor.guard.leave} />
  </Page>;
}

/** Where the first problem of a save is: the tab and the field, in the order of the screen. */
function focusTarget(keys: readonly string[], cases: readonly DraftCase[]): { tab: Tab; id: string } | null {
  if (!keys.length) return null;
  const profile = profileOrder.find(field => keys.includes("profile." + field));
  if (profile) return { tab: "perfil", id: profileFieldId(profile) };
  const item = cases.find(value => hasIssuesUnder(Object.fromEntries(keys.map(key => [key, true])), caseKey(value.id)));
  if (item) return { tab: "casos", id: caseRowId(item.id) };
  if (keys.some(key => key === "fallback" || key.startsWith("fallback."))) return { tab: "casos", id: fallbackRowId };
  const limit = limitsOrder.find(([key]) => keys.some(value => value === key || value.startsWith(key + "[")));
  return limit ? { tab: "limites", id: limit[1] } : null;
}
