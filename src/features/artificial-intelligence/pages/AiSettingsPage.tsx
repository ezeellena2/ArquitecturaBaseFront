import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Page } from "@/shared/ui/Page";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
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
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 4, stacked: true }]} /> :
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
  const keyLabelId = useId();
  const busy = editor.busy || probe.busy;
  const locked = !canManage || busy || editor.recovery !== "none";
  const credential = hasCredential(draft, baseline);
  const savedCredential = baseline.hasCredential && draft.provider === baseline.provider && draft.credentialChange !== "Remove";
  const catalog = useAiModels(draft, baseline, observedRevision, canManage && editor.recovery === "none",
    () => { guard.allowNextNavigation(); void navigate("/sin-permiso"); }, editor.requireReview);
  const selectingModel = !manualModel && !!catalog.models?.length;
  const error = (field: string) => editor.errors[field] ?? probe.errors[field] ?? catalog.errors[field];
  // I7: the saved key cannot be read here; its message goes under the key and «Reemplazar clave», which fixes it, is the one highlighted.
  const keyUnreadable = catalog.credentialUnavailable || probe.credentialUnavailable;
  const keyErrorId = useId();
  function provider(next: AiProvider) { editor.change(changeProvider(draft, next)); setNextProvider(null); setManualModel(false); }
  function replaceKey(replacing: boolean) { editor.change({ replacing, apiKey: "", credentialChange: replacing ? "Replace" : "Keep" }); }
  // La banda lleva el título, el estado del objeto («Sólo lectura») y las acciones: Guardar habilitado ya dice que hay
  // cambios. Cada espera se ve en el botón que se tocó: consultar o reintentar no ponen «Guardando…» en Guardar.
  return <Page title={t("title")} status={!canManage ? <span className="text-xs text-[var(--color-content-muted)]">{t("readOnly")}</span> : undefined}
    actions={canManage ? <><Button variant="outline" disabled={!editor.changed || locked} onClick={editor.discard}>{t("discard")}</Button>
      <Button disabled={!editor.changed || locked} pending={editor.working === "save"} onClick={() => void editor.save()}>{t(editor.working === "save" ? "saving" : "save")}</Button></> : undefined}>
    <div className="flex flex-col gap-5">
      {/* Una cosa, una zona (IA1-A, 2026-11-08): toda la conexión en una superficie, un renglón por dato en el orden en
          que se completa (los modelos se cargan con la clave) y cada botón en el renglón del dato que toca. Probar actúa
          sobre todo junto y va en la banda: su resultado va al Toaster y la espera de un 429 es su motivo, sin textos al
          lado. Que la prueba puede tener costo va en la (i) del título, sólo donde se puede probar. */}
      <Surface title={t("connectionSection")} help={canManage ? t("testHint") : undefined} actions={canManage ?
        <DisabledReason reason={probe.cooldown ? t("cooldown", { count: probe.cooldown }) : null}>
          <Button variant="outline" disabled={locked || !credential || !draft.model.trim() || probe.cooldown > 0} pending={probe.busy} onClick={() => void probe.test()}>
            {t(probe.busy ? "testing" : "test")}</Button>
        </DisabledReason> : undefined}>
        <div className="divide-y divide-[var(--color-border)] px-4">
          <div className="py-3">
            <FormField label={t("provider")} error={error("provider")}><NativeSelect className="sm:w-72" value={draft.provider} disabled={locked} onChange={event => {
              const next = event.target.value as AiProvider;
              if (savedCredential || draft.apiKey) setNextProvider(next); else provider(next);
            }}>{baseline.providers.map(item => <option key={item} value={item}>{item === "Anthropic" ? "Anthropic / Claude" : item}</option>)}</NativeSelect></FormField>
          </div>
          <div className="py-3">
            {/* La clave guardada se nombra sin mostrarse: por qué, en la (i) de su etiqueta. Reemplazarla abre su campo en
                el mismo renglón, con Cancelar al lado. */}
            {savedCredential && !draft.replacing ? <div role="group" aria-labelledby={keyLabelId} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1"><p id={keyLabelId} className="text-sm leading-none font-medium">{t("key")}</p>
                <span className="-my-1 inline-flex"><InfoTip text={t("credentialHint")} label={t("common:actions.moreInfo", { label: t("key") })} /></span></div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm">{t("keyConfigured")}</p>
                {canManage ? <>
                  <Button variant={keyUnreadable ? "default" : "outline"} disabled={locked} aria-describedby={keyUnreadable ? keyErrorId : undefined}
                    onClick={() => replaceKey(true)}>{t("replace")}</Button>
                  <Button variant="destructive-outline" disabled={locked} onClick={() => setRemoving(true)}>{t("remove")}</Button>
                </> : null}
              </div>
              {error("apiKey") ? <p id={keyErrorId} role="alert" className="text-sm text-[var(--color-danger)]">{error("apiKey")}</p> : null}
            </div> : <FormField label={t(savedCredential ? "newKey" : "key")} error={error("apiKey")}
              beside={savedCredential && canManage ? <Button variant="outline" disabled={locked} onClick={() => replaceKey(false)}>{t("cancelReplace")}</Button> : undefined}>
              <Input className="sm:w-72" name="ai-provider-api-key" type="password" value={draft.apiKey} autoComplete="new-password" spellCheck={false} autoCapitalize="none" maxLength={4096} disabled={locked} onChange={event => editor.change({ apiKey: event.target.value, credentialChange: event.target.value ? "Replace" : savedCredential ? "Replace" : "Remove" })} />
            </FormField>}
          </div>
          <div className="flex flex-col gap-2 py-3">
            {/* La espera de un 429 es el motivo de Cargar modelos deshabilitado, no un texto debajo. */}
            <FormField label={t("model")} error={error("model")} required beside={canManage ? <>
              <DisabledReason reason={catalog.cooldown ? t("modelsCooldown", { count: catalog.cooldown }) : null}>
                <Button variant="outline" disabled={locked || !catalog.canLoad} pending={catalog.busy} onClick={() => void catalog.load()}>
                  {t(catalog.busy ? "loadingModels" : catalog.models ? "refreshModels" : "loadModels")}
                </Button>
              </DisabledReason>
              {catalog.models?.length ? <Button variant="muted-link" disabled={locked} onClick={() => setManualModel(previous => !previous)}>{t(manualModel ? "chooseFromCatalog" : "manualModel")}</Button> : null}
            </> : undefined}>
              {selectingModel ? <NativeSelect className="sm:w-72" name="ai-provider-model" value={draft.model} disabled={locked} onChange={event => editor.change({ model: event.target.value })}>
                <option value="">{t("chooseModel")}</option>
                {draft.model && !catalog.models?.some(model => model.id === draft.model) ? <option value={draft.model}>{draft.model} — {t("modelOutsideCatalog")}</option> : null}
                {catalog.models?.map(model => <option key={model.id} value={model.id}>{model.displayName === model.id ? model.id : `${model.displayName} (${model.id})`}</option>)}
              </NativeSelect> : <Input className="sm:w-72" name="ai-provider-model" value={draft.model} maxLength={150} disabled={locked} autoComplete="off" spellCheck={false} autoCapitalize="none" onChange={event => editor.change({ model: event.target.value })} />}
            </FormField>
            {/* Una lista vacía es el resultado de la consulta, no una explicación: queda como estado, sin instrucciones. */}
            {catalog.models?.length === 0 ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("modelsEmpty")}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5 py-3">
            {/* El grupo ya se nombra «Disponibilidad de la conexión»: la etiqueta visible no se lee dos veces. */}
            <p aria-hidden="true" className="text-sm leading-none font-medium">{t("availabilityLabel")}</p>
            <RadioGroupField label={t("availability")} layout="row" value={draft.enabled ? "on" : "off"} onValueChange={value => editor.change({ enabled: value === "on" })} error={error("enabled")}
              options={[{ value: "on", label: t("available"), disabled: locked || !credential }, { value: "off", label: t("paused"), disabled: locked }]} />
          </div>
        </div>
      </Surface>
      {/* El cuerpo explica el estado del guardado; consultar, reintentar y elegir van en la banda, cada uno con su espera. */}
      {editor.recovery !== "none" ? <Surface title={t("reviewSection")} padded actions={<>
        <Button variant="outline" disabled={busy} pending={editor.working === "recover"} onClick={() => void editor.recover()}>{t(editor.working === "recover" ? "consulting" : editor.recovery === "conflict" ? "readCurrent" : "consultSave")}</Button>
        {editor.recovery === "missing" ? <Button disabled={busy} pending={editor.working === "retry"} onClick={() => void editor.save(true)}>{t(editor.working === "retry" ? "saving" : "retrySame")}</Button> : null}
        {editor.review ? <><Button variant="outline" disabled={busy} onClick={() => editor.acceptReview(false)}>{t("useCurrent")}</Button>
          <Button disabled={busy} onClick={() => editor.acceptReview(true)}>{t("keepDraft")}</Button></> : null}
      </>}>
        <p className="text-sm">{t(editor.recovery === "conflict" ? "conflict" : editor.recovery === "missing" ? "missingReceipt" : "uncertain")}</p>
        {editor.review ? <p className="text-sm">{t("currentSummary", { provider: editor.review.provider, model: editor.review.model, credential: t(editor.review.hasCredential ? "configuredKey" : "absentKey"), availability: t(editor.review.enabled ? "available" : "paused") })}</p> : null}
      </Surface> : null}
    </div>
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t("removeTitle")} description={t("removeHint")} confirmLabel={t("remove")} destructive onConfirm={() => editor.change({ credentialChange: "Remove", apiKey: "", replacing: false, enabled: false })} />
    <ConfirmDialog open={nextProvider !== null} onOpenChange={open => { if (!open) setNextProvider(null); }} title={t("providerChangeTitle")} description={t("providerChangeHint")} confirmLabel={t("changeProvider")} onConfirm={() => { if (nextProvider) provider(nextProvider); }} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")} description={t(editor.recovery !== "none" || editor.busy ? "leaveUncertain" : "leaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
