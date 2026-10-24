import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Page } from "@/shared/ui/Page";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Skeleton } from "@/shared/ui/skeleton";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { aiConnectionQueryKey, fetchAiConnection, type AiConnection, type AiProvider } from "../api/aiConnection";
import { changeProvider, hasCredential } from "../model";
import { useAiConnectionEditor } from "../hooks/useAiConnectionEditor";
import { useAiConnectionTest } from "../hooks/useAiConnectionTest";
import { useAiModels } from "../hooks/useAiModels";

export function AiSettingsPage() {
  const { t } = useTranslation("artificialIntelligence");
  const query = useQuery({ queryKey: aiConnectionQueryKey, queryFn: ({ signal }) => fetchAiConnection(signal), refetchOnMount: "always", retry: false });
  const permissions = usePermissions();
  const [initial, setInitial] = useState<AiConnection>();
  if (!initial && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  // Un cambio de permisos desmonta el editor y elimina sus referencias secretas.
  if (initial) return <AiEditor key={permissions.has("ai.manage") ? "manage" : "read"} initial={query.data ?? initial} canManage={permissions.has("ai.manage")} observedRevision={query.data?.revision ?? initial.revision} />;
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <Skeleton className="h-24" /> :
    <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function AiEditor({ initial, canManage, observedRevision }: { initial: AiConnection; canManage: boolean; observedRevision: number }) {
  const { t } = useTranslation("artificialIntelligence");
  const navigate = useNavigate();
  const editor = useAiConnectionEditor(initial);
  const { draft, baseline, guard } = editor;
  const probe = useAiConnectionTest(draft, editor.draftVersion, baseline, observedRevision, () => { guard.allowNextNavigation(); void navigate("/sin-permiso"); }, editor.requireReview);
  const [removing, setRemoving] = useState(false);
  const [nextProvider, setNextProvider] = useState<AiProvider | null>(null);
  const [manualModel, setManualModel] = useState(false);
  const busy = editor.busy || probe.busy;
  const locked = !canManage || busy || editor.recovery !== "none";
  const credential = hasCredential(draft, baseline);
  const savedCredential = baseline.hasCredential && draft.provider === baseline.provider && draft.credentialChange !== "Remove";
  const catalog = useAiModels(draft, baseline, observedRevision, canManage && editor.recovery === "none",
    () => { guard.allowNextNavigation(); void navigate("/sin-permiso"); }, editor.requireReview);
  const selectingModel = !manualModel && !!catalog.models?.length;
  const error = (field: string) => editor.errors[field] ?? probe.errors[field] ?? catalog.errors[field];
  function provider(next: AiProvider) { editor.change(changeProvider(draft, next)); setNextProvider(null); setManualModel(false); }
  return <Page title={t("title")} status={editor.changed ? <span className="text-sm text-[var(--color-content-muted)]">{t("dirty")}</span> : undefined}
    actions={canManage ? <><Button variant="outline" disabled={!editor.changed || locked} onClick={editor.discard}>{t("discard")}</Button>
      <Button disabled={!editor.changed || locked} onClick={() => void editor.save()}>{t(editor.busy ? "saving" : "save")}</Button></> : undefined}>
    <div className="flex flex-col gap-5">
      {!canManage ? <p className="text-sm text-[var(--color-content-muted)]">{t("readOnly")}</p> : null}
      <Surface title={t("providerSection")} padded>
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("installationHint")}</p>
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <FormField label={t("provider")} error={error("provider")}><NativeSelect value={draft.provider} disabled={locked} onChange={event => {
            const next = event.target.value as AiProvider;
            if (savedCredential || draft.apiKey) setNextProvider(next); else provider(next);
          }}>{baseline.providers.map(item => <option key={item} value={item}>{item === "Anthropic" ? "Anthropic / Claude" : item}</option>)}</NativeSelect></FormField>
          <div className="flex flex-col gap-2">
            <FormField label={t("model")} hint={t(selectingModel ? "modelCatalogHint" : catalog.models?.length === 0 ? "modelsEmpty" : "modelHint")} error={error("model")} required>
              {selectingModel ? <NativeSelect name="ai-provider-model" value={draft.model} disabled={locked} onChange={event => editor.change({ model: event.target.value })}>
                <option value="">{t("chooseModel")}</option>
                {draft.model && !catalog.models?.some(model => model.id === draft.model) ? <option value={draft.model}>{draft.model} — {t("modelOutsideCatalog")}</option> : null}
                {catalog.models?.map(model => <option key={model.id} value={model.id}>{model.displayName === model.id ? model.id : `${model.displayName} (${model.id})`}</option>)}
              </NativeSelect> : <Input name="ai-provider-model" value={draft.model} maxLength={150} disabled={locked} autoComplete="off" spellCheck={false} autoCapitalize="none" onChange={event => editor.change({ model: event.target.value })} />}
            </FormField>
            {canManage ? <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={locked || catalog.busy || !catalog.canLoad} onClick={() => void catalog.load()}>
                {catalog.busy ? <Spinner decorative /> : null}{t(catalog.busy ? "loadingModels" : catalog.models ? "refreshModels" : "loadModels")}
              </Button>
              {catalog.models?.length ? <Button variant="muted-link" disabled={locked} onClick={() => setManualModel(previous => !previous)}>{t(manualModel ? "chooseFromCatalog" : "manualModel")}</Button> : null}
            </div> : null}
            {catalog.cooldown ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("modelsCooldown", { count: catalog.cooldown })}</p> : null}
          </div>
        </div>
      </Surface>
      <Surface title={t("credentialSection")} padded>
        <div className="flex max-w-3xl flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium">{t(savedCredential ? "configuredKey" : "absentKey")}</p><p className="mt-1 text-sm text-[var(--color-content-muted)]">{t("credentialHint")}</p></div>
          {savedCredential && canManage ? <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={locked} onClick={() => editor.change({ replacing: !draft.replacing, apiKey: "", credentialChange: draft.replacing ? "Keep" : "Replace" })}>{t(draft.replacing ? "cancelReplace" : "replace")}</Button>
            <Button variant="muted-link" disabled={locked} onClick={() => setRemoving(true)}>{t("remove")}</Button>
          </div> : null}
        </div>
        {!savedCredential || draft.replacing ? <div className="max-w-3xl"><FormField label={t(savedCredential ? "newKey" : "key")} hint={t("keyHint")} error={error("apiKey")}>
          <Input name="ai-provider-api-key" type="password" value={draft.apiKey} autoComplete="new-password" spellCheck={false} autoCapitalize="none" maxLength={4096} disabled={locked} onChange={event => editor.change({ apiKey: event.target.value, credentialChange: event.target.value ? "Replace" : savedCredential ? "Replace" : "Remove" })} />
        </FormField></div> : error("apiKey") ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error("apiKey")}</p> : null}
        {canManage ? <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={locked || !credential || !draft.model.trim() || probe.cooldown > 0} onClick={() => void probe.test()}>
          {probe.busy ? <Spinner decorative /> : null}{t(probe.busy ? "testing" : "test")}</Button><p role="status" className="text-sm text-[var(--color-content-muted)]">{probe.cooldown ? t("cooldown", { count: probe.cooldown }) : t(probe.tested ? "verified" : "unverified")}</p></div> : null}
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("testHint")}</p>
      </Surface>
      <Surface title={t("availabilitySection")} padded>
        <RadioGroupField label={t("availability")} value={draft.enabled ? "on" : "off"} onValueChange={value => editor.change({ enabled: value === "on" })} error={error("enabled")}
          options={[{ value: "on", label: t("available"), description: t("availableHint"), disabled: locked || !credential }, { value: "off", label: t("paused"), description: t("pausedHint"), disabled: locked }]} />
      </Surface>
      {editor.recovery !== "none" ? <Surface title={t("reviewSection")} padded>
        <p className="text-sm">{t(editor.recovery === "conflict" ? "conflict" : editor.recovery === "missing" ? "missingReceipt" : "uncertain")}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void editor.recover()}>{t(editor.recovery === "conflict" ? "readCurrent" : "consultSave")}</Button>
          {editor.recovery === "missing" ? <Button disabled={busy} onClick={() => void editor.save(true)}>{t("retrySame")}</Button> : null}</div>
        {editor.review ? <><p className="text-sm">{t("currentSummary", { provider: editor.review.provider, model: editor.review.model, revision: editor.review.revision, credential: t(editor.review.hasCredential ? "configuredKey" : "absentKey"), availability: t(editor.review.enabled ? "available" : "paused") })}</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => editor.acceptReview(true)}>{t("keepDraft")}</Button><Button variant="outline" disabled={busy} onClick={() => editor.acceptReview(false)}>{t("useCurrent")}</Button></div></> : null}
      </Surface> : null}
    </div>
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t("removeTitle")} description={t("removeHint")} confirmLabel={t("remove")} destructive onConfirm={() => editor.change({ credentialChange: "Remove", apiKey: "", replacing: false, enabled: false })} />
    <ConfirmDialog open={nextProvider !== null} onOpenChange={open => { if (!open) setNextProvider(null); }} title={t("providerChangeTitle")} description={t("providerChangeHint")} confirmLabel={t("changeProvider")} onConfirm={() => { if (nextProvider) provider(nextProvider); }} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")} description={t(editor.recovery !== "none" || editor.busy ? "leaveUncertain" : "leaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
