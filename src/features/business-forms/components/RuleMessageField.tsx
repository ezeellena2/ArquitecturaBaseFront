import { useId, useImperativeHandle, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type Ref } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useTranslation } from "react-i18next";
import { cn } from "cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { FormField } from "@/shared/ui/FormField";
import type { FormCulture } from "../model";
import type { RuleEvent } from "../rules";
import { parseRuleMessage, ruleMessageData, ruleMessageDataLabel, ruleMessagePreview, serializeRuleMessage, type RuleMessageData, type RuleMessagePart, type RuleMessageQuestion } from "../ruleMessage";

interface Props {
  label: string;
  help: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  culture: FormCulture;
  original: FormCulture;
  questions: readonly RuleMessageQuestion[];
  choices: Readonly<Record<string, readonly { readonly label: string }[]>>;
  event: RuleEvent;
  /** The form's prefix, for the example number. */
  prefix: string;
  placeholder?: string;
  disabled?: boolean;
}

/** The message of a rule action (board MD1-A): «Agregar dato» puts the number, the reason or a question where the cursor is,
 * as a tag that is erased whole, and «Así llega» shows the message with the examples of the PDF preview. */
export function RuleMessageField({ label, help, hint, error, value, onChange, culture, original, questions, choices, event, prefix, placeholder, disabled }: Props) {
  const { t } = useTranslation("forms");
  const editor = useRef<EditorHandle>(null);
  const arrives = useId();
  const name = (data: RuleMessageData) => ruleMessageDataLabel(data, questions, culture, original, t);
  const preview = value.trim() ? ruleMessagePreview(value, questions, choices, culture, original, prefix, t) : [];
  return <div className="flex flex-col gap-3">
    <FormField label={label} help={help} hint={hint} error={error}
      action={<DataMenu data={ruleMessageData(questions, event)} name={name} disabled={disabled} onChoose={data => editor.current?.insert(data)} />}>
      <MessageEditor ref={editor} value={value} onChange={onChange} culture={culture} name={name} missing={t("rules.missingQuestion")} placeholder={placeholder} disabled={disabled} />
    </FormField>
    {preview.length ? <figure aria-labelledby={arrives} className="m-0 flex flex-col gap-1.5">
      <figcaption id={arrives} className="text-sm font-medium">{t("rules.arrives")}</figcaption>
      <p className="rounded-[var(--radius-control)] border border-[var(--color-border)]/50 bg-[var(--color-surface-muted)] px-2.5 py-1.5 text-sm break-words whitespace-pre-wrap">
        {preview.map((segment, index) => segment.sample ? <strong key={index} className="font-semibold">{segment.text}</strong>
          : segment.missing ? <span key={index} className="text-[var(--color-danger)]">{segment.text}</span> : segment.text)}
      </p>
    </figure> : null}
  </div>;
}

interface EditorHandle { insert: (data: RuleMessageData) => void }
interface EditorProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  culture: FormCulture;
  name: (data: RuleMessageData) => string | null;
  /** The name of a question that is no longer in the form. */
  missing: string;
  placeholder?: string;
  disabled?: boolean;
  ref?: Ref<EditorHandle>;
}
const tagClass = "mx-px rounded-[var(--radius-control)] px-1 text-xs font-medium";
const presentClass = "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]";
const missingClass = "bg-[var(--color-danger)]/10 text-[var(--color-danger)]";
// Chrome cannot put the cursor after a tag that ends the box: a zero-width space after it takes the cursor, and is never saved.
const caretHolder = "​";
const dataOf = (tag: HTMLElement): RuleMessageData => tag.dataset.messageData === "question"
  ? { kind: "question", fieldId: tag.dataset.fieldId! } : { kind: tag.dataset.messageData as "number" | "reason" };
function partsOf(box: HTMLElement): RuleMessagePart[] {
  const parts: RuleMessagePart[] = [];
  const text = (value: string) => {
    if (!value) return;
    const last = parts.at(-1);
    if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + value };
    else parts.push({ kind: "text", text: value });
  };
  const walk = (node: Node) => node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) text((child.textContent ?? "").replaceAll(caretHolder, "").replace(/[{}]/g, ""));
    else if (child instanceof HTMLElement && child.dataset.messageData) parts.push(dataOf(child));
    else if (child.nodeName === "BR") text("\n");
    else { if (child.nodeName === "DIV" && parts.length) text("\n"); walk(child); }
  });
  walk(box);
  return parts;
}
/** The tag next to the cursor, on its left for Backspace and on its right for Delete. */
function tagNextTo(node: Node, offset: number, before: boolean) {
  const sibling = node.nodeType === Node.TEXT_NODE
    ? (before ? (offset === 0 || node.textContent === caretHolder ? node.previousSibling : null) : (offset === (node.textContent?.length ?? 0) ? node.nextSibling : null))
    : node.childNodes[before ? offset - 1 : offset] ?? null;
  return sibling instanceof HTMLElement && sibling.dataset.messageData ? sibling : null;
}

/** A box like the textarea where text and tags mix. It shows `value` again only when it changes from outside: its own edits
 * keep the cursor where it is. */
function MessageEditor({ id, value, onChange, culture, name, missing, placeholder, disabled, ref, ...aria }: EditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const shown = useRef<string | null>(null);
  const caret = useRef<Range | null>(null);
  // The native listener and the menu read the latest props when they act, not those of the render that created them.
  const latest = useRef({ onChange, culture });
  useLayoutEffect(() => { latest.current = { onChange, culture }; });
  const paint = (tag: HTMLElement) => {
    const label = name(dataOf(tag));
    if (tag.textContent !== (label ?? missing)) tag.textContent = label ?? missing;
    tag.className = cn(tagClass, label === null ? missingClass : presentClass);
  };
  const tag = (data: RuleMessageData) => {
    const element = document.createElement("span");
    element.setAttribute("contenteditable", "false");
    element.dataset.messageData = data.kind;
    if (data.kind === "question") element.dataset.fieldId = data.fieldId;
    paint(element);
    return element;
  };
  const emit = () => {
    const element = box.current!;
    const next = serializeRuleMessage(partsOf(element), latest.current.culture);
    if (!next) element.replaceChildren();
    shown.current = next;
    latest.current.onChange(next);
  };
  /** Where the next insertion goes: the cursor in the box, the last one it had or its end. */
  const place = () => {
    const element = box.current!;
    const selection = document.getSelection();
    const current = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (current && element.contains(current.startContainer)) return current;
    if (caret.current && element.contains(caret.current.startContainer)) return caret.current;
    const end = document.createRange();
    end.selectNodeContents(element);
    end.collapse(false);
    return end;
  };
  const insert = (node: Node, target = place()) => {
    const selection = document.getSelection();
    target.deleteContents();
    target.insertNode(node);
    let after: Node = node;
    if (node instanceof HTMLElement && !node.nextSibling) { after = document.createTextNode(caretHolder); node.after(after); }
    target.setStartAfter(after);
    target.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(target);
    caret.current = target.cloneRange();
  };
  const save = () => {
    const selection = document.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && box.current?.contains(range.startContainer)) caret.current = range.cloneRange();
  };
  // The place is taken before the focus, which can move a browser's cursor to the start of the box.
  useImperativeHandle(ref, () => ({ insert: data => { const target = place(); box.current?.focus(); insert(tag(data), target); emit(); } }));
  useLayoutEffect(() => {
    const element = box.current;
    if (!element || value === shown.current) return;
    element.replaceChildren(...parseRuleMessage(value).map(part => part.kind === "text" ? document.createTextNode(part.text) : tag(part)));
    shown.current = value;
    caret.current = null;
  });
  // A renamed question or another menu language shows in place, without rebuilding the box under the cursor.
  useLayoutEffect(() => { box.current?.querySelectorAll<HTMLElement>("[data-message-data]").forEach(paint); });
  // Braces are kept for the data: typed or pasted, they are left out.
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const typed = (event: InputEvent) => {
      if (!event.data || !/[{}]/.test(event.data)) return;
      event.preventDefault();
      const kept = event.data.replace(/[{}]/g, "");
      if (kept) { insert(document.createTextNode(kept)); emit(); }
    };
    element.addEventListener("beforeinput", typed);
    return () => element.removeEventListener("beforeinput", typed);
  });
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") { event.preventDefault(); insert(document.createTextNode("\n")); emit(); return; }
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const selection = document.getSelection();
    if (!selection?.isCollapsed || !selection.anchorNode) return;
    const found = tagNextTo(selection.anchorNode, selection.anchorOffset, event.key === "Backspace");
    if (!found?.parentNode) return;
    event.preventDefault();
    const parent = found.parentNode, index = Array.prototype.indexOf.call(parent.childNodes, found);
    found.remove();
    const range = document.createRange();
    range.setStart(parent, index);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    emit();
  };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain").replace(/[{}]/g, "");
    if (text) { insert(document.createTextNode(text)); emit(); }
  };
  return <div ref={box} id={id} role="textbox" aria-multiline="true" aria-labelledby={id ? id + "-label" : undefined} {...aria}
    aria-disabled={disabled || undefined} aria-placeholder={placeholder} data-placeholder={placeholder} contentEditable={!disabled} suppressContentEditableWarning
    tabIndex={disabled ? undefined : 0} onInput={emit} onKeyDown={keyDown} onPaste={paste} onBlur={save} onKeyUp={save} onMouseUp={save}
    className={cn("min-h-16 w-full rounded-md border border-input bg-[var(--color-control-surface)] px-3 py-2 text-sm break-words whitespace-pre-wrap transition-[color,box-shadow] outline-none",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30",
      "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]", disabled && "cursor-not-allowed bg-[var(--color-surface-muted)] opacity-50")} />;
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** «Agregar dato»: the list of data with its search box. Choosing gives the cursor back to the message, right after the tag. */
function DataMenu({ data, name, disabled, onChoose }: { data: readonly RuleMessageData[]; name: (data: RuleMessageData) => string | null; disabled?: boolean; onChoose: (data: RuleMessageData) => void }) {
  const { t } = useTranslation("forms");
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const chosen = useRef(false);
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [active, setActive] = useState(0);
  const items = data.map(datum => ({ datum, label: name(datum) ?? "" })).filter(item => fold(item.label).includes(fold(search.trim())));
  const groups = [["response", items.filter(item => item.datum.kind !== "question")], ["questions", items.filter(item => item.datum.kind === "question")]] as const;
  const ordered = groups.flatMap(([, list]) => list);
  const choose = (index: number) => {
    const item = ordered[index];
    if (!item) return;
    chosen.current = true;
    setOpen(false);
    onChoose(item.datum);
  };
  return <PopoverPrimitive.Root open={open} onOpenChange={next => { setOpen(next); setSearch(""); setActive(0); }}>
    <PopoverPrimitive.Trigger asChild><Button type="button" variant="outline" size="sm" disabled={disabled}>{t("rules.addData")}<ChevronDownIcon className="size-4" /></Button></PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal><PopoverPrimitive.Content align="end" sideOffset={4} collisionPadding={8} className="z-50 w-72 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-md"
      onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}
      onCloseAutoFocus={event => { if (chosen.current) { event.preventDefault(); chosen.current = false; } }}>
      <Input ref={input} role="combobox" aria-expanded aria-controls={ordered.length ? id : undefined} aria-autocomplete="list" aria-activedescendant={ordered[active] ? id + "-" + active : undefined}
        aria-label={t("rules.searchData")} placeholder={t("rules.searchData")} value={search} onChange={event => { setSearch(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => ordered.length ? (index + (event.key === "ArrowDown" ? 1 : ordered.length - 1)) % ordered.length : 0); }
          else if (event.key === "Enter") { event.preventDefault(); choose(active); }
        }} />
      {ordered.length ? <div id={id} role="listbox" aria-label={t("rules.addData")} className="mt-1 max-h-72 overflow-y-auto">
        {groups.map(([group, list]) => list.length ? <div key={group} role="group" aria-labelledby={id + "-" + group}>
          <p id={id + "-" + group} className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-[var(--color-content-muted)] uppercase">{t("rules.dataGroups." + group)}</p>
          {list.map(item => {
            const index = ordered.indexOf(item);
            return <div key={item.datum.kind === "question" ? item.datum.fieldId : item.datum.kind} id={id + "-" + index} role="option" aria-selected={index === active}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}
              className={cn("cursor-pointer rounded-md px-2 py-1.5 text-sm", index === active && "bg-[var(--color-surface-muted)]")}>{item.label}</div>;
          })}
        </div> : null)}
      </div> : <p className="px-2 py-2 text-sm text-[var(--color-content-muted)]">{t("rules.noData")}</p>}
    </PopoverPrimitive.Content></PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
