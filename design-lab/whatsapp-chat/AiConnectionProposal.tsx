import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { notify, dismissNotification } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";

type Scenario = "normal" | "empty" | "loading" | "readOnly" | "denied" | "loadError" | "testError" | "uncertain";
type Profile = { provider: string; model: string; enabled: boolean; hasKey: boolean; tested: boolean };
type Editor = { saved: Profile; draft: Profile; key: string; replacing: boolean; uncertain: boolean };
const scenarios: Scenario[] = ["normal", "empty", "loading", "readOnly", "denied", "loadError", "testError", "uncertain"];
function editor(empty = false): Editor {
  const profile = { provider: "OpenAI", model: "modelo-demo", enabled: !empty, hasKey: !empty, tested: !empty };
  return { saved: profile, draft: { ...profile }, key: "", replacing: false, uncertain: false };
}
function changed(value: Editor) {
  return (["provider", "model", "enabled", "hasKey"] as const).some(field => value.saved[field] !== value.draft[field]) || value.key.length > 0;
}

export function AiConnectionProposal() {
  const { t } = useTranslation("llmProposal");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [current, setCurrent] = useState<Editor>(() => editor());
  const [errors, setErrors] = useState<{ key?: string; model?: string }>({});
  const [removing, setRemoving] = useState(false);
  const [nextProvider, setNextProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = changed(current);
  const guard = useUnsavedChangesGuard(dirty && !busy);
  const restricted = scenario === "readOnly";
  const unavailable = scenario === "denied" || scenario === "loadError" || scenario === "loading";
  const locked = restricted || busy !== null || current.uncertain;
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    for (const action of ["test", "save"]) dismissNotification(`llm-proposal-${action}`);
  }, []);
  function patch(update: Partial<Editor>) { setCurrent(previous => ({ ...previous, ...update })); }
  function field(update: Partial<Profile>) { patch({ draft: { ...current.draft, ...update, tested: false } }); setErrors({}); }
  function resetScenario(next: Scenario) {
    if (timer.current) clearTimeout(timer.current);
    setBusy(null); setRemoving(false); setNextProvider(null);
    setScenario(next); setErrors({}); setCurrent(editor(next === "empty"));
    for (const action of ["test", "save"]) dismissNotification(`llm-proposal-${action}`);
  }
  function validate(testOnly = false) {
    const keyError = current.key && !current.key.startsWith("demo-") ? t("keyError") : !current.key && !current.draft.hasKey && (testOnly || current.draft.enabled) ? t("keyRequired") : undefined;
    const modelError = current.draft.model.trim() ? undefined : t("modelRequired");
    setErrors({ key: keyError, model: modelError }); return !keyError && !modelError;
  }
  function test() {
    setBusy("test");
    timer.current = setTimeout(() => {
      setBusy(null);
      if (scenario === "testError") notify({ id: "llm-proposal-test", kind: "error", message: t("testFailed") });
      else {
        setCurrent(previous => ({ ...previous, draft: { ...previous.draft, tested: true } }));
        notify({ id: "llm-proposal-test", kind: "success", message: t("testSuccess") });
      }
    }, 600);
  }
  function review() {
    setCurrent(previous => ({ ...previous, uncertain: false })); setScenario("normal");
    dismissNotification("llm-proposal-save");
    notify({ id: "llm-proposal-save", kind: "info", message: t("reviewed") });
  }
  function save() {
    if (!validate()) return;
    setBusy("save");
    timer.current = setTimeout(() => {
      setBusy(null);
      if (scenario === "uncertain") {
        patch({ uncertain: true });
        notify({ id: "llm-proposal-save", kind: "warning", message: t("uncertainMessage"), action: { label: t("verify"), onClick: review } });
      } else {
        setCurrent(previous => {
          const saved = { ...previous.draft, hasKey: previous.draft.hasKey || previous.key.length > 0 };
          return { saved, draft: { ...saved }, key: "", replacing: false, uncertain: false };
        });
        notify({ id: "llm-proposal-save", kind: "success", message: t("saved") });
      }
    }, 600);
  }
  function discard() { patch({ draft: { ...current.saved }, key: "", replacing: false, uncertain: false }); setErrors({}); }
  function changeProvider(provider: string) {
    patch({ draft: { ...current.draft, provider, model: "", hasKey: false, enabled: false, tested: false }, key: "", replacing: false });
    setErrors({}); setNextProvider(null);
  }

  return <Page title={t("title")} status={dirty ? <span className="text-xs text-[var(--color-content-muted)]">{t("dirty")}</span> : undefined} actions={unavailable || restricted ? undefined : <>
    <Button variant="outline" disabled={!dirty || locked} onClick={discard}>{t("discard")}</Button>
    <Button disabled={!dirty || locked} onClick={save}>{t(busy === "save" ? "saving" : "save")}</Button>
  </>}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <p className="max-w-xl text-xs text-[var(--color-content-muted)]">{t("connectionLab")}</p>
      <div className="w-64 max-w-full"><FormField label={t("scenario")}><NativeSelect value={scenario} disabled={busy !== null} onChange={event => resetScenario(event.target.value as Scenario)}>{scenarios.map(item => <option key={item} value={item}>{t(item)}</option>)}</NativeSelect></FormField></div>
    </div>
    {unavailable ? <Surface>{scenario === "loading" ? <div className="flex items-center gap-2 p-4" role="status"><Spinner decorative />{t("loading")}</div> : <EmptyState embedded title={t(scenario === "denied" ? "deniedTitle" : "loadingTitle")} description={t(scenario === "denied" ? "permissionHint" : "retryHint")} action={scenario === "loadError" ? <Button variant="outline" onClick={() => setScenario("normal")}>{t("retry")}</Button> : undefined} />}</Surface> : <div className="flex flex-col gap-5">
      {restricted ? <p className="text-sm text-[var(--color-content-muted)]">{t("readonlyHint")}</p> : null}
      <Surface title={t("providerSection")} padded>
        <p className="max-w-3xl text-sm text-[var(--color-content-muted)]">{t("installationHint")}</p>
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <FormField label={t("provider")}><NativeSelect value={current.draft.provider} disabled={locked} onChange={event => current.draft.hasKey || current.key ? setNextProvider(event.target.value) : changeProvider(event.target.value)}>{["OpenAI", "Anthropic", "Google"].map(provider => <option key={provider}>{provider}</option>)}</NativeSelect></FormField>
          <FormField label={t("model")} hint={t("modelIdentifierHint")} error={errors.model}><Input value={current.draft.model} disabled={locked} maxLength={150} placeholder="modelo-demo" onChange={event => field({ model: event.target.value })} /></FormField>
        </div>
      </Surface>
      <Surface title={t("credentialSection")} padded>
        <div className="flex max-w-3xl flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-medium">{t(current.draft.hasKey ? "configuredKey" : "absentKey")}</p><p className="mt-1 text-xs text-[var(--color-content-muted)]">{t("credentialHint")}</p></div>
          {current.draft.hasKey && !restricted ? <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={locked} onClick={() => patch({ replacing: !current.replacing, key: "" })}>{t(current.replacing ? "cancelReplace" : "replace")}</Button><Button variant="muted-link" disabled={locked} onClick={() => setRemoving(true)}>{t("remove")}</Button></div> : null}
        </div>
        {!current.draft.hasKey || current.replacing ? <div className="max-w-3xl"><FormField label={t(current.draft.hasKey ? "newKey" : "key")} hint={t("keyHint")} error={errors.key}><Input type="password" autoComplete="off" value={current.key} placeholder="demo-mi-clave" maxLength={100} disabled={locked} onChange={event => { patch({ key: event.target.value, draft: { ...current.draft, tested: false } }); setErrors({}); }} /></FormField></div> : null}
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={locked} onClick={() => { if (validate(true)) test(); }}>{busy === "test" ? <Spinner /> : null}{t(busy === "test" ? "testing" : "test")}</Button><p className="text-xs text-[var(--color-content-muted)]">{t(current.draft.tested ? "verified" : "unverified")}</p></div>
        <p className="text-xs text-[var(--color-content-muted)]">{t("testDoesNotSave")}</p>
      </Surface>
      <Surface title={t("availabilitySection")} padded>
        <RadioGroupField label={t("connectionAvailability")} value={current.draft.enabled ? "on" : "off"} onValueChange={value => field({ enabled: value === "on" })}
          options={[{ value: "on", label: t("available"), description: t("availableHint"), disabled: locked }, { value: "off", label: t("paused"), description: t("pausedHint"), disabled: locked }]} />
      </Surface>
      {current.uncertain ? <div><Button variant="outline" onClick={review}>{t("verify")}</Button></div> : null}
    </div>}
    <ConfirmDialog open={removing} onOpenChange={setRemoving} title={t("removeTitle")} description={t("removeConnectionHint")} confirmLabel={t("remove")} destructive onConfirm={() => patch({ draft: { ...current.draft, hasKey: false, enabled: false, tested: false }, key: "", replacing: false })} />
    <ConfirmDialog open={nextProvider !== null} onOpenChange={open => { if (!open) setNextProvider(null); }} title={t("providerChangeTitle")} description={t("providerChangeHint")} confirmLabel={t("changeProvider")} onConfirm={() => { if (nextProvider) changeProvider(nextProvider); }} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
