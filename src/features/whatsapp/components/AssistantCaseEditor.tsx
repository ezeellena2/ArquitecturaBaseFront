import { useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { IconButton } from "@/shared/ui/IconButton";
import { CloseIcon, LockIcon, PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Picker } from "@/shared/ui/Picker";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { agentActionKinds, type AgentActionKind, type AgentButtonDestination, type AgentCulture, type AgentForm, type AgentInputType } from "../api/assistantAgent";
import { actionSnapshotText, agentLimits, caseSnapshot, destinationKind, newButton, originalReference, validateAction, validateCase, type AgentIssue, type DraftAction, type DraftButton, type DraftCase } from "../lib/assistantAgentDraft";
import { AssistantTextField } from "./AssistantTextField";

/** What the panel edits: an own case (new or with its number in the list) or «Cualquier otra cosa». */
export type CaseEditorTarget = { kind: "case"; item: DraftCase; number: number | null } | { kind: "fallback"; action: DraftAction };
const inputTypes: readonly AgentInputType[] = ["Any", "Text", "Audio"];

/**
 * The editor of a case, at the side (AS2): when, the input type, what to do (only the actions allowed in Límites) and the
 * configuration of the chosen one. «Listo» takes it to the list, which is saved with the screen; «Cancelar» leaves it as it was
 * and «Quitar caso» goes apart, on the left. «Cualquier otra cosa» uses the same editor with its «Cuándo» fixed.
 *
 * The problems of the last save stay at their fields until they are edited; after the first try, what is typed is checked live.
 */
export function AssistantCaseEditor({ target, forms, allowed, culture, original, errors, attempted, message, focusFallback, onDone, onClose, onRemove }: {
  target: CaseEditorTarget; forms: readonly AgentForm[]; allowed: readonly AgentActionKind[]; culture: AgentCulture; original: AgentCulture;
  /** The problems of this case, relative to it: `when`, `action.text` (for «Cualquier otra cosa», `action.*` too). */
  errors: Readonly<Record<string, string>>; attempted: boolean; message: (issue: AgentIssue) => string; focusFallback: RefObject<HTMLElement | null>;
  onDone: (value: DraftCase) => void; onClose: () => void; onRemove: (id: string) => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const ids = useId();
  const restore = useRestoreFocusOnClose(true, focusFallback);
  const fallback = target.kind === "fallback";
  const initial = target.kind === "case" ? target.item : { id: "fallback", when: "", inputType: "Any" as const, isActive: true, action: target.action };
  const [value, setValue] = useState<DraftCase>(initial);
  // What was edited no longer shows the problem of the last save: it is checked again, live, after the first try.
  const [touched, setTouched] = useState<readonly string[]>([]);
  // Adding a button takes the focus to its text; removing one, to «Agregar botón», which always stays.
  const focusNext = useRef<"last" | "add" | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const buttonsRoot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (focusNext.current === "add") add.current?.focus();
    else if (focusNext.current === "last") Array.from(buttonsRoot.current?.querySelectorAll<HTMLInputElement>("input[data-button-title]") ?? []).at(-1)?.focus();
    focusNext.current = null;
  }, [value.action.buttons]);
  const local = attempted ? (fallback ? validateAction(value.action, allowed, original, "action") : validateCase(value, allowed, original, "")) : {};
  const error = (key: string) => local[key] ? message(local[key]) : touched.some(path => key === path || key.startsWith(path + ".") || key.startsWith(path + "[")) ? undefined : errors[key];
  const touch = (path: string) => setTouched(previous => previous.includes(path) ? previous : [...previous, path]);
  const change = (next: Partial<DraftCase>, path: string) => { setValue(previous => ({ ...previous, ...next })); touch(path); };
  const changeAction = (next: Partial<DraftAction>, path: string) => { setValue(previous => ({ ...previous, action: { ...previous.action, ...next } })); touch("action." + path); };
  const action = value.action;
  const kind = action.kind && allowed.includes(action.kind) ? action.kind : undefined;
  const isNew = target.kind === "case" && target.number === null;
  const title = fallback ? t("cases.fallback") : target.number === null ? t("editor.newTitle") : t("editor.title", { number: target.number });
  const done = () => {
    const changed = fallback ? actionSnapshotText(value.action) !== actionSnapshotText(target.action) : caseSnapshot(value) !== caseSnapshot(target.item);
    // Untouched, a new case adds nothing and an existing one keeps the problems the server said about it.
    if (changed) onDone(value);
    onClose();
  };
  const formName = (id: string | null) => forms.find(form => form.definitionId === id)?.name;
  // A form that is no longer offered stays first, named as not available, so the field still says what it keeps (DS1-A).
  const formOptions = (current: string | null) => [...current && !formName(current) ? [{ id: current, name: t("cases.formUnavailable") }] : [], ...forms.map(form => ({ id: form.definitionId, name: form.name }))];

  const whenField = fallback ? <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1">
      <Label htmlFor={ids + "when"}>{t("editor.when")}</Label>
      {/* As the prefix of a form: the lock says why it is fixed. It is not where the panel puts the focus when it opens. */}
      <span className="-my-1 inline-flex"><IconButton size="icon-xs" label={t("editor.whenFixed")} data-info-tip=""><LockIcon className="size-3.5 text-[var(--color-content-muted)]" /></IconButton></span>
    </div>
    <Input id={ids + "when"} readOnly value={t("cases.fallbackWhen")} />
  </div> : <FormField label={t("editor.when")} help={t("editor.whenHelp")} required error={error("when")}>
    <Textarea id={ids + "when"} rows={2} maxLength={agentLimits.when} placeholder={t("editor.whenPlaceholder")} value={value.when} onChange={event => change({ when: event.target.value }, "when")} />
  </FormField>;

  const configuration = () => {
    switch (kind) {
      case "SendForm": return <FormField label={t("editor.form")} help={t("editor.formHelp")} required error={error("action.formDefinitionId")}>
        <Picker id={ids + "form"} label={t("editor.form")} placeholder={t("editor.chooseForm")} value={action.formDefinitionId}
          options={formOptions(action.formDefinitionId).map(form => ({ id: form.id, label: form.name }))} onChange={formDefinitionId => changeAction({ formDefinitionId }, "formDefinitionId")} />
      </FormField>;
      case "ExactText": return <AssistantTextField id={ids + "text"} label={t("editor.text")} help={t("editor.textHelp")} value={action.text} onChange={text => changeAction({ text }, "text")}
        culture={culture} original={original} error={error("action.text")} maxLength={agentLimits.text} placeholder={t("editor.textPlaceholder")} multiline />;
      case "DraftedReply": return <FormField label={t("editor.instructions")} help={t("editor.instructionsHelp")} error={error("action.instructions")}>
        <Textarea id={ids + "instructions"} rows={3} maxLength={agentLimits.instructions} placeholder={t("editor.instructionsPlaceholder")} value={action.instructions}
          onChange={event => changeAction({ instructions: event.target.value }, "instructions")} />
      </FormField>;
      case "Handoff": return <FormField label={t("editor.handoffReason")} help={t("editor.handoffReasonHelp")} required error={error("action.handoffReason")}>
        <Input id={ids + "reason"} maxLength={agentLimits.handoffReason} placeholder={t("editor.handoffReasonPlaceholder")} value={action.handoffReason}
          onChange={event => changeAction({ handoffReason: event.target.value }, "handoffReason")} />
      </FormField>;
      case "AskButtons": return <>
        <AssistantTextField id={ids + "question"} label={t("editor.question")} help={t("editor.questionHelp")} value={action.question} onChange={question => changeAction({ question }, "question")}
          culture={culture} original={original} error={error("action.question")} maxLength={agentLimits.question} placeholder={t("editor.questionPlaceholder")} multiline />
        <div ref={buttonsRoot} role="group" aria-labelledby={ids + "buttons"} aria-describedby={error("action.buttons") ? ids + "buttons-error" : undefined} className="flex flex-col gap-2">
          <GroupLabel id={ids + "buttons"} help={t("editor.buttonsHelp")}>{t("editor.buttons")}</GroupLabel>
          {action.buttons.map((button, index) => <ButtonRow key={button.key} button={button} index={index} count={action.buttons.length} forms={forms} allowed={allowed}
            culture={culture} original={original} error={error} formOptions={formOptions} onChange={next => changeAction({ buttons: action.buttons.map(item => item.key === button.key ? next : item) }, `buttons[${index}]`)}
            onRemove={() => { focusNext.current = "add"; changeAction({ buttons: action.buttons.filter(item => item.key !== button.key) }, "buttons"); }} />)}
          <div className="flex"><DisabledReason reason={action.buttons.length >= agentLimits.buttons ? t("editor.maxButtons") : null}>
            <Button ref={add} type="button" variant="outline" size="sm" disabled={action.buttons.length >= agentLimits.buttons}
              onClick={() => { focusNext.current = "last"; changeAction({ buttons: [...action.buttons, newButton(crypto.randomUUID())] }, "buttons"); }}><PlusIcon className="size-4" />{t("editor.addButton")}</Button>
          </DisabledReason></div>
          {error("action.buttons") ? <p id={ids + "buttons-error"} role="alert" className="text-sm text-[var(--color-danger)]">{error("action.buttons")}</p> : null}
        </div>
      </>;
      default: return null;
    }
  };
  const config = configuration();
  const unmatched = [errors[""], ...Object.entries(errors).filter(([key]) => /^(id|inputType)$/.test(key)).map(([, text]) => text)].filter(Boolean);

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent placement="right" aria-describedby={undefined} onCloseAutoFocus={restore} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
      <div className="flex min-h-14 shrink-0 items-center border-b border-[var(--color-border)] py-2 pr-12 pl-4"><DialogTitle>{title}</DialogTitle></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="flex flex-col gap-4">
        {unmatched.length ? <p role="alert" className="text-sm text-[var(--color-danger)]">{unmatched.join(" ")}</p> : null}
        {whenField}
        {/* The input types go in the shared piece for choosing, like any list (DS1-A, 2026-11-22); choosing the one it has
            changes nothing. */}
        {fallback ? null : <div className="w-full sm:w-72"><FormField label={t("editor.inputType")} help={t("editor.inputTypeHelp")}>
          <Picker label={t("editor.inputType")} value={value.inputType} options={inputTypes.map(type => ({ id: type, label: t("inputTypes." + type) }))}
            onChange={type => { if (type !== value.inputType) change({ inputType: type as typeof value.inputType }, "inputType"); }} />
        </FormField></div>}
        <RadioGroupField label={t("editor.kind")} showLabel variant="cards" value={kind} error={error("action.kind")}
          options={agentActionKinds.filter(option => allowed.includes(option)).map(option => ({ value: option, label: t("actions." + option), help: t("actionHelp." + option) }))}
          onValueChange={next => changeAction({ kind: next as AgentActionKind }, "kind")} />
        {config ? <Surface title={t("actions." + kind)} headingLevel={3} padded>{config}</Surface> : null}
        {fallback ? null : <CheckboxField label={t("editor.active")} help={t("editor.activeHelp")} checked={value.isActive} onCheckedChange={isActive => change({ isActive }, "isActive")} />}
      </div></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-3">
        {target.kind === "case" && !isNew ? <Button type="button" variant="destructive-outline" onClick={() => onRemove(target.item.id)}><TrashIcon className="size-4" />{t("editor.remove")}</Button> : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t("editor.cancel")}</Button>
          <Button type="button" onClick={done}>{t("editor.done")}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}

/** A button of «Preguntar con botones»: its text, where it leads and, for an exact text, that text under it. */
function ButtonRow({ button, index, count, forms, allowed, culture, original, error, formOptions, onChange, onRemove }: {
  button: DraftButton; index: number; count: number; forms: readonly AgentForm[]; allowed: readonly AgentActionKind[]; culture: AgentCulture; original: AgentCulture;
  error: (key: string) => string | undefined; formOptions: (current: string | null) => { id: string; name: string }[];
  onChange: (button: DraftButton) => void; onRemove: () => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const ids = useId();
  const number = index + 1;
  const path = (name: string) => `action.buttons[${index}].${name}`;
  const titleError = error(path("title")), destinationError = error(path("destination")) ?? error(path("formDefinitionId"));
  const reference = originalReference(button.title, culture, original);
  // What a turned-off action offers is not there: a button that leads to one shows «Elegí a dónde lleva» until it is changed.
  const available = (destination: AgentButtonDestination) => allowed.includes(destinationKind(destination));
  const selected = !button.destination || !available(button.destination) ? "" : button.destination === "SendForm" ? "form:" + (button.formDefinitionId ?? "") : button.destination;
  const choose = (choice: string) => onChange(choice.startsWith("form:") ? { ...button, destination: "SendForm", formDefinitionId: choice.slice(5) || null }
    : choice === "ExactText" || choice === "Handoff" ? { ...button, destination: choice, formDefinitionId: null } : { ...button, destination: null, formDefinitionId: null });
  const described = [titleError ? ids + "title-error" : reference ? ids + "reference" : null].filter(Boolean).join(" ") || undefined;
  return <div className="flex flex-col gap-1.5">
    {/* On the phone the text takes its line and where it leads goes under it, whole; from 640 px, one line. */}
    <div className="flex flex-wrap items-center gap-2">
      <Input data-button-title="" className="sm:w-36 sm:shrink-0" aria-label={t("editor.buttonTitle", { number })} aria-invalid={titleError ? true : undefined} aria-describedby={described}
        maxLength={agentLimits.buttonTitle} placeholder={culture !== original ? t("untranslated") : undefined} value={button.title[culture]}
        onChange={event => onChange({ ...button, title: { ...button.title, [culture]: event.target.value } })} />
      <span aria-hidden="true" className="text-sm text-[var(--color-content-muted)]">→</span>
      <Picker className="min-w-0 flex-1" label={t("editor.buttonDestination", { number })} placeholder={t("editor.chooseDestination")} value={selected || null}
        aria-invalid={destinationError ? true : undefined} aria-describedby={destinationError ? ids + "destination-error" : undefined} onChange={choose}
        options={[...allowed.includes("SendForm") ? formOptions(button.destination === "SendForm" ? button.formDefinitionId : null).map(form => ({ id: "form:" + form.id,
          label: forms.some(item => item.definitionId === form.id) ? t("cases.sendNamed", { form: form.name }) : form.name })) : [],
          ...allowed.includes("ExactText") ? [{ id: "ExactText", label: t("actions.ExactText") }] : [],
          ...allowed.includes("Handoff") ? [{ id: "Handoff", label: t("actions.Handoff") }] : []]} />
      <IconButton size="icon-sm" variant="ghost" label={t("editor.removeButton", { number })} disabled={count <= 1} disabledLabel={t("editor.minButtons")} onClick={onRemove}><CloseIcon className="size-4" /></IconButton>
    </div>
    {titleError ? <p id={ids + "title-error"} role="alert" className="text-sm text-[var(--color-danger)]">{titleError}</p>
      : reference ? <p id={ids + "reference"} className="text-sm text-[var(--color-content-muted)]">{t("originalText", { language: t("cultures." + original), text: reference })}</p> : null}
    {destinationError ? <p id={ids + "destination-error"} role="alert" className="text-sm text-[var(--color-danger)]">{destinationError}</p> : null}
    {button.destination === "ExactText" && available("ExactText") ? <AssistantTextField id={ids + "text"} label={t("editor.buttonText", { number })} value={button.text}
      onChange={text => onChange({ ...button, text })} culture={culture} original={original} error={error(path("text"))} maxLength={agentLimits.text}
      placeholder={t("editor.textPlaceholder")} multiline /> : null}
  </div>;
}
