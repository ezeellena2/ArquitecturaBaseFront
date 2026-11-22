import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { FormSkeleton } from "@/shared/ui/FormSkeleton";
import { Surface } from "@/shared/ui/Surface";
import { aiConnectionQueryKey, fetchAiConnection, type AiConnection, type AiProvider } from "../api/aiConnection";
import { changeProvider, hasCredential } from "../model";
import { useAiConnectionEditor } from "../hooks/useAiConnectionEditor";
import { useAiConnectionTest } from "../hooks/useAiConnectionTest";
import { useAiModels } from "../hooks/useAiModels";
import { formatNumber } from "@/shared/lib/numberFormat";

export function AiSettingsPage() {
  const { t } = useTranslation("artificialIntelligence");
  const query = useQuery({ queryKey: aiConnectionQueryKey, queryFn: ({ signal }) => fetchAiConnection(signal), refetchOnMount: "always", retry: false });
  const permissions = usePermissions();
  const [initial, setInitial] = useState<AiConnection>();
  if (!initial && query.isFetchedAfterMount && query.isSuccess && !query.isFetching) setInitial(query.data);
  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  // Un cambio de permisos desmonta el editor y elimina sus referencias secretas.
  if (initial) return <AiEditor key={permissions.has("ai.manage") ? "manage" : "read"} initial={query.data ?? initial} canManage={permissions.has("ai.manage")} observedRevision={query.data?.revision ?? initial.revision} />;
  return <Page title={t("title")}>{query.isFetching || query.isPending ? <FormSkeleton zones={[{ fields: 4, stacked: true }, { fields: 1 }]} /> :
    <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />}</Page>;
}

function AiEditor({ initial, canManage, observedRevision }: { initial: AiConnection; canManage: boolean; observedRevision: number }) {
  const { t, i18n } = useTranslation("artificialIntelligence");
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
      {/* I4: la conexión guardada usa un proveedor que esta versión no conoce; se lee vacía y pausada hasta elegir otro. Qué hacer
          lo lee sólo quien puede hacerlo. */}
      {baseline.unsupportedProvider ? <Banner tone="warning">{canManage ? `${t("unsupportedProvider")} ${t("unsupportedProviderAction")}` : t("unsupportedProvider")}</Banner> : null}
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
            {/* The providers go in the shared piece for choosing, like any list (DS1-A, 2026-11-22). With a key, changing it asks
                first, so the chosen one stays until it is confirmed; choosing the one it has changes nothing. */}
            <div className="w-full sm:w-72"><FormField label={t("provider")} error={error("provider")}>
              <Picker label={t("provider")} disabled={locked} value={draft.provider}
                options={baseline.providers.map(item => ({ id: item, label: item === "Anthropic" ? "Anthropic / Claude" : item }))}
                onChange={item => { if (item === draft.provider) return; if (savedCredential || draft.apiKey) setNextProvider(item as typeof draft.provider); else provider(item as typeof draft.provider); }} />
            </FormField></div>
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
              {/* A model of the list in the Picker (DS1-A): its name and, in grey, its identifier; the saved one that the list does not
                  bring goes first, with «Fuera de la lista». Nothing is chosen for the user. */}
              {selectingModel ? <Picker className="sm:w-72" label={t("model")} placeholder={t("chooseModel")} value={draft.model || null} disabled={locked}
                options={[...draft.model && !catalog.models?.some(model => model.id === draft.model) ? [{ id: draft.model, label: draft.model, description: t("modelOutsideCatalog") }] : [],
                  ...(catalog.models ?? []).map(model => ({ id: model.id, label: model.displayName, description: model.displayName === model.id ? null : model.id }))]}
                onChange={model => editor.change({ model })} /> : <Input className="sm:w-72" name="ai-provider-model" value={draft.model} maxLength={150} disabled={locked} autoComplete="off" spellCheck={false} autoCapitalize="none" onChange={event => editor.change({ model: event.target.value })} />}
            </FormField>
            {/* Una lista vacía es el resultado de la consulta, no una explicación: queda como estado, sin instrucciones. */}
            {catalog.models?.length === 0 ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("modelsEmpty")}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5 py-3">
            {/* The availability goes in the shared piece too (DS1-A, 2026-11-22); without a key it cannot be available. */}
            <div className="w-full sm:w-72"><FormField label={t("availabilityLabel")} error={error("enabled")}>
              <Picker label={t("availability")} disabled={locked} value={draft.enabled ? "on" : "off"} onChange={value => { if ((value === "on") !== draft.enabled) editor.change({ enabled: value === "on" }); }}
                options={[{ id: "on", label: t("available"), disabledReason: credential ? null : t("absentKey") }, { id: "off", label: t("paused") }]} />
            </FormField></div>
          </div>
        </div>
      </Surface>
      {/* RC1-A: cuánto se guardan las conversaciones de Inicio, como un número de Límites: el cuadro corto con su unidad al lado y el
          techo de la instalación en la (i). Se guarda con la conexión: el mismo Guardar, la misma revisión y el mismo 409. */}
      <Surface title={t("privacySection")} help={t("privacyHint")} padded>
        <FormField label={t("retentionDays")} help={t("retentionDaysHelp", { max: formatNumber(baseline.conversationRetentionCeilingDays, i18n.language) })} required
          error={error("conversationRetentionDays")} beside={<span className="text-sm text-[var(--color-content-muted)]">{t("days")}</span>}>
          <Input type="number" inputMode="numeric" step={1} min={1} max={baseline.conversationRetentionCeilingDays} className="w-24" disabled={locked}
            value={draft.retentionDays} onChange={event => editor.change({ retentionDays: event.target.value })} />
        </FormField>
      </Surface>
      {/* El cuerpo explica el estado del guardado; consultar, reintentar y elegir van en la banda, cada uno con su espera. */}
      {editor.recovery !== "none" ? <Surface title={t("reviewSection")} padded actions={<>
        <Button variant="outline" disabled={busy} pending={editor.working === "recover"} onClick={() => void editor.recover()}>{t(editor.working === "recover" ? "consulting" : editor.recovery === "conflict" ? "readCurrent" : "consultSave")}</Button>
        {editor.recovery === "missing" ? <Button disabled={busy} pending={editor.working === "retry"} onClick={() => void editor.save(true)}>{t(editor.working === "retry" ? "saving" : "retrySame")}</Button> : null}
        {editor.review ? <><Button variant="outline" disabled={busy} onClick={() => editor.acceptReview(false)}>{t("useCurrent")}</Button>
          <Button disabled={busy} onClick={() => editor.acceptReview(true)}>{t("keepDraft")}</Button></> : null}
      </>}>
        <p className="text-sm">{t(editor.recovery === "conflict" ? "conflict" : editor.recovery === "missing" ? "missingReceipt" : "uncertain")}</p>
        {editor.review ? <p className="text-sm">{t("currentSummary", { provider: editor.review.provider, model: editor.review.model, credential: t(editor.review.hasCredential ? "configuredKey" : "absentKey"), availability: t(editor.review.enabled ? "available" : "paused"),
          retention: t("retentionSummary", { count: editor.review.conversationRetentionDays, days: formatNumber(editor.review.conversationRetentionDays, i18n.language) }) })}</p> : null}
      </Surface> : null}
    </div>
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t("removeTitle")} description={t("removeHint")} confirmLabel={t("remove")} destructive onConfirm={() => editor.change({ credentialChange: "Remove", apiKey: "", replacing: false, enabled: false })} />
    <ConfirmDialog open={nextProvider !== null} onOpenChange={open => { if (!open) setNextProvider(null); }} title={t("providerChangeTitle")} description={t("providerChangeHint")} confirmLabel={t("changeProvider")} onConfirm={() => { if (nextProvider) provider(nextProvider); }} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")} description={t(editor.recovery !== "none" || editor.busy ? "leaveUncertain" : "leaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
