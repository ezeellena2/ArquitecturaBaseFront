import { Fragment, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { summarizeChoices } from "@/shared/lib/summarizeChoices";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { IconButton } from "./IconButton";
import { CheckIcon, ChevronDownIcon, CloseIcon, SearchIcon } from "./icons";
import { Input } from "./input";
import { Skeleton } from "./skeleton";

/** One option of the list. */
export interface PickerOption {
  id: string;
  label: string;
  /** The grey line under the name, which tells two similar options apart; the closed field shows only the name. */
  description?: string | null;
  /** Off, with its reason (MA1-A): it cannot be chosen, and it says why after its name («Baja · Ya está dada de baja.»). */
  disabledReason?: string | null;
  /** A line before it opens a group. */
  separated?: boolean;
  /** More words the search finds it by, such as the identifier of a time zone. */
  keywords?: string;
  /** A drawing before the name, such as the icon of a folder. */
  icon?: ReactNode;
  /** What the closed field says when it is the chosen one, shorter than the name («AR +54»); the reader hears the name. */
  short?: string;
}

interface PickerBase {
  /** The name of the field: it names the button and the list, and it is the title of the list on the phone. */
  label: string;
  options: readonly PickerOption[];
  /** What the field says, in grey, while nothing is chosen («Sin zona»). */
  placeholder?: string;
  /** «Todas», «Sin campo asignado»: the first one, apart behind a line, and out of a search. */
  first?: PickerOption;
  /** Chosen ones that may not be among the options because they came in another page of the server. They go first (LR3-A). */
  selectedOptions?: readonly PickerOption[];
  /** The field of a form, or the button of a listing bar, which keeps its look and opens the same list. */
  trigger?: "field" | "button";
  /** What the button of a bar always says, whatever is chosen («Columnas», «Más filtros»): it names the button, and the
   * label goes on top of the list. */
  triggerLabel?: ReactNode;
  /** 44 px, like `Button size="touch"`: who uses it asks for it on the phone. */
  size?: "default" | "touch";
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** The server searches: the owner keeps what is typed and brings the options that match it. */
  search?: string;
  onSearchChange?: (search: string) => void;
  /** How many options the server has for that search. */
  total?: number;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** The server has more: «Mostrar 50 más», which the down arrow on the last option also asks for. */
  onLoadMore?: () => void;
  loadingMore?: boolean;
  pageSize?: number;
  /** The owner asks the server only while the list is open. */
  onOpenChange?: (open: boolean) => void;
  /** At most this many: the list says «Hasta 5» and, once they are chosen, «Elegiste 5 de 5», and turns the rest off. */
  max?: number;
}

export type PickerProps = PickerBase & (
  | { multiple?: false; value: string | null; onChange: (id: string) => void }
  | { multiple: true; value: readonly string[]; onChange: (ids: string[]) => void }
);

interface Row { option: PickerOption; selected: boolean; disabled: boolean; separated: boolean }

/** With more options than these, the list brings its search. */
const SEARCH_FROM = 10;
const TABBABLE = "a[href], button, input, select, textarea, [tabindex]";

const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();

/** How well an option answers a search, without accents: first the names that start with it, then a word of the name, then
 * anywhere in the name and, last, the grey line or the other words (a country, an identifier). -1 does not answer it. */
function rank(option: PickerOption, needle: string): number {
  const label = fold(option.label);
  if (label.startsWith(needle)) return 0;
  if (label.split(/[\s/-]+/).some(word => word.startsWith(needle))) return 1;
  if (label.includes(needle)) return 2;
  return fold([option.description, option.keywords].filter(Boolean).join(" ")).includes(needle) ? 3 : -1;
}

/** Scrolls only the list, never the page, so the option is seen: centered when the list opens, the least while walking it. */
function reveal(list: HTMLElement | null, option: HTMLElement | null, center: boolean) {
  if (!list || !option) return;
  const top = option.offsetTop, bottom = top + option.offsetHeight;
  if (center) list.scrollTop = top - (list.clientHeight - option.offsetHeight) / 2;
  else if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

const tabbables = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(TABBABLE)]
  .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[hidden], [inert]"));

/** What Tab reaches after the field, inside its dialog if it has one. */
function nextTabbable(from: HTMLElement | null): HTMLElement | null {
  if (!from) return null;
  const all = tabbables(from.closest("[role=dialog]") ?? document.body);
  const index = all.indexOf(from);
  return index < 0 ? null : all[index + 1] ?? null;
}

/**
 * The only piece to choose one or several options from a list (DS1-A and DS2-A, 2026-11-19). Closed, it is a field with its
 * thin arrow that says what is chosen, the same for one and for several; on a listing bar it is that bar's button. Open, a
 * list with the grey line under each name, the tick on the left of the chosen one (OE1-A) and, choosing several, a box,
 * where marking does not close. With more than ten options, or when the server searches, the search goes on top, inside the
 * list, with the focus on it and how many there are under it. On the phone the list takes the screen.
 *
 * The button is named by the label and what is chosen («Roles Encargado de campo, User»), and opens a `listbox` that the
 * arrows walk with `aria-activedescendant`: Enter chooses (choosing several, it marks and stays), Escape closes and gives
 * the focus back to the button, and Tab closes and goes on to the next field. Without a search, a letter goes to the first
 * option that starts with it.
 */
export function Picker(props: PickerProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery("(width < 640px)");
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null), listRef = useRef<HTMLUListElement>(null), searchRef = useRef<HTMLInputElement>(null);
  const leaving = useRef<"next" | "back" | null>(null), typed = useRef({ text: "", at: -Infinity });
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [active, setActive] = useState(-1);
  // On the phone several are marked on a copy that «Listo» applies and the × drops, as the catalog question did.
  const [picked, setPicked] = useState<readonly string[]>([]);

  const multiple = props.multiple === true;
  const values: readonly string[] = props.multiple ? props.value : props.value === null ? [] : [props.value];
  const staged = phone && multiple && open;
  const chosen = new Set(staged ? picked : values);
  const server = props.onSearchChange !== undefined;
  const searchable = server || props.options.length > SEARCH_FROM;
  const search = server ? props.search ?? "" : localSearch;
  const searching = search.trim() !== "";
  const full = multiple && props.max !== undefined && chosen.size >= props.max;
  const others = (props.selectedOptions ?? []).filter(option => !props.options.some(item => item.id === option.id));
  const needle = fold(search.trim());
  const shown = server || !searching ? props.options : props.options.map((option, index) => ({ option, index, rank: rank(option, needle) }))
    .filter(item => item.rank >= 0).sort((a, b) => a.rank - b.rank || a.index - b.index).map(item => item.option);

  const rows: Row[] = [];
  const push = (option: PickerOption, separated: boolean) => rows.push({ option, separated: rows.length > 0 && separated, selected: chosen.has(option.id),
    disabled: !!option.disabledReason || (full && !chosen.has(option.id)) });
  if (props.first && !searching) push(props.first, false);
  if (!searching) others.filter(option => chosen.has(option.id)).forEach((option, index) => push(option, index === 0));
  shown.forEach((option, index) => push(option, index === 0 || !!option.separated));
  const current = rows.length === 0 ? -1 : active < 0 ? 0 : Math.min(active, rows.length - 1);
  const optionId = (index: number) => `${uid}-option-${index}`;

  // What the closed field says: the chosen ones in the order of the list, or the placeholder while there is none.
  const order = [...(props.first ? [props.first] : []), ...others, ...props.options];
  const picks = order.filter(option => values.includes(option.id));
  const empty = picks.length === 0 || (!multiple && props.first !== undefined && props.value === props.first.id);
  const spoken = empty ? props.placeholder ?? props.first?.label ?? "" : picks.map(option => option.label).join(", ");

  // Walking the list keeps the marked option in sight; opening it centers the chosen one (`focusList`).
  useLayoutEffect(() => {
    if (open && current >= 0) reveal(listRef.current, document.getElementById(`${uid}-option-${current}`), false);
  }, [open, current, uid]);

  // Once the list is in the page: the focus to the search or to the list, and the chosen one in sight.
  function focusList(event: Event) {
    event.preventDefault();
    (searchRef.current ?? listRef.current)?.focus();
    // Radix places the list and gives it its height a frame later: the chosen one goes in sight after that.
    const chosen = current >= 0 ? optionId(current) : null;
    requestAnimationFrame(() => requestAnimationFrame(() => reveal(listRef.current, chosen ? document.getElementById(chosen) : null, true)));
  }

  function show() {
    if (props.disabled) return;
    const index = rows.findIndex(row => row.selected);
    setActive(index >= 0 ? index : rows.findIndex(row => !row.disabled));
    setPicked(values);
    setOpen(true);
    props.onOpenChange?.(true);
  }

  function hide() {
    setOpen(false);
    setLocalSearch("");
    if (server && search) props.onSearchChange?.("");
    props.onOpenChange?.(false);
  }

  function choose(row: Row | undefined) {
    if (!row || row.disabled) return;
    const id = row.option.id;
    if (!props.multiple) { props.onChange(id); hide(); return; }
    const base = staged ? picked : props.value;
    const next = base.includes(id) ? base.filter(item => item !== id) : [...base, id];
    if (staged) setPicked(next); else props.onChange(next);
  }

  function done() {
    if (props.multiple) props.onChange([...picked]);
    hide();
  }

  function jumpTo(key: string, time: number) {
    const text = time - typed.current.at < 500 ? typed.current.text + key : key;
    typed.current = { text, at: time };
    const needle = fold(text), start = text.length === 1 ? current + 1 : Math.max(current, 0);
    for (let step = 0; step < rows.length; step++) {
      const index = (start + step) % rows.length;
      if (fold(rows[index].option.label).startsWith(needle)) { setActive(index); return; }
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>) {
    const last = rows.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (current < last) setActive(current + 1);
      else if (props.onLoadMore && !props.loadingMore) props.onLoadMore();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if ((event.key === "Home" || event.key === "End") && !searchable) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : last);
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      setActive(Math.min(last, Math.max(0, current + (event.key === "PageDown" ? 10 : -10))));
    } else if (event.key === "Enter" || (event.key === " " && !searchable)) {
      event.preventDefault();
      choose(rows[current]);
    } else if (!searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      jumpTo(event.key, event.timeStamp);
    }
  }

  // Tab leaves the list from its last control (Shift+Tab, from the first) and goes on, as from a select.
  function leaveWithTab(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const inside = tabbables(event.currentTarget), focused = document.activeElement;
    const edge = event.shiftKey ? inside[0] : inside.at(-1);
    if (inside.length > 1 && focused !== edge && inside.some(element => element === focused)) return;
    event.preventDefault();
    leaving.current = event.shiftKey ? "back" : "next";
    hide();
  }

  const nameId = `${uid}-name`, valueId = `${uid}-value`, listboxId = `${uid}-listbox`;
  const single = !multiple && !empty ? picks[0] : undefined;
  const triggerProps = {
    ref: triggerRef,
    id: props.id,
    type: "button" as const,
    disabled: props.disabled,
    "aria-haspopup": phone ? "dialog" as const : "listbox" as const,
    "aria-expanded": open,
    "aria-controls": open && !phone ? listboxId : undefined,
    "aria-labelledby": props.triggerLabel ? undefined : `${nameId} ${valueId}`,
    "aria-invalid": props["aria-invalid"],
    "aria-describedby": props["aria-describedby"],
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) { event.preventDefault(); show(); }
    },
    onClick: phone ? show : undefined,
  };
  const words = <><span id={nameId} hidden>{props.label}</span><span id={valueId} hidden>{spoken}</span></>;
  const arrow = <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-[var(--color-content-muted)] transition-transform group-aria-expanded:rotate-180"/>;
  const trigger = props.trigger === "button"
    ? <Button {...triggerProps} variant="outline" className={cn("group", props.className)}>
      {props.triggerLabel ? props.triggerLabel : <>{words}<span aria-hidden="true" className="truncate">{single?.short ?? spoken}</span></>}{arrow}
    </Button>
    : <button {...triggerProps} className={cn("group flex w-full min-w-0 items-center gap-2 rounded-md border border-input bg-[var(--color-control-surface)] px-2.5 text-left text-sm outline-none transition-[color,box-shadow]",
      props.size === "touch" ? "h-11" : "h-[var(--height-control)]",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
      "disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:opacity-50", props.className)}>
      {words}
      {single?.icon ? <span aria-hidden="true" className="flex shrink-0">{single.icon}</span> : null}
      {empty ? <span aria-hidden="true" className="min-w-0 flex-1 truncate text-[var(--color-content-muted)]">{spoken}</span>
        : multiple ? <ChoiceSummary labels={picks.map(option => option.label)}/>
          : <span aria-hidden="true" className="min-w-0 flex-1 truncate">{single?.short ?? spoken}</span>}
      {arrow}
    </button>;

  const countText = server
    ? props.total !== undefined && rows.length > 0 && !props.loading ? t("picker.count", { count: props.total }) : null
    : searchable ? searching ? t("picker.countOf", { count: shown.length, total: props.options.length }) : t("picker.count", { count: props.options.length }) : null;
  const limitText = multiple && props.max !== undefined
    ? full ? t("picker.chosenOf", { count: chosen.size, max: props.max }) : t("picker.upTo", { count: props.max }) : null;
  const countRow = countText !== null || limitText !== null
    ? <div className={cn("flex min-h-4 items-center justify-between gap-3 text-xs text-[var(--color-content-muted)]", phone ? "mt-2 first:mt-0" : "mt-1.5 px-1 first:mt-0")}>
      <span role="status">{countText}</span>{limitText ? <span className="shrink-0">{limitText}</span> : null}
    </div> : null;
  const searchBox = searchable
    ? <div className="relative">
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-content-muted)]"/>
      <Input ref={searchRef} role="combobox" aria-expanded="true" aria-controls={listboxId} aria-autocomplete="list"
        aria-activedescendant={current >= 0 ? optionId(current) : undefined} aria-label={t("picker.search", { label: props.label })}
        placeholder={t("actions.search")} autoComplete="off" spellCheck={false} value={search} className="pl-7"
        onChange={event => { setActive(0); if (server) props.onSearchChange?.(event.target.value); else setLocalSearch(event.target.value); }}
        onKeyDown={onListKeyDown}/>
    </div> : null;
  const options = <ul ref={listRef} id={listboxId} role="listbox" aria-label={props.label} aria-multiselectable={multiple || undefined}
    tabIndex={searchable ? undefined : -1} aria-activedescendant={!searchable && current >= 0 ? optionId(current) : undefined}
    onKeyDown={searchable ? undefined : onListKeyDown}
    className={cn("relative min-h-0 flex-1 overflow-y-auto outline-none [scrollbar-width:thin]", phone ? "" : "p-1")}>
    {rows.map((row, index) => <Fragment key={row.option.id}>
      {row.separated ? <li role="presentation" className={phone ? "h-px bg-[var(--color-border)]" : "-mx-1 my-1 h-px bg-[var(--color-border)]"}/> : null}
      <OptionRow row={row} id={optionId(index)} active={index === current} multiple={multiple} touch={phone}
        position={server && props.total !== undefined ? { index: index + 1, size: rows.length - shown.length + props.total } : undefined}
        onHover={() => { if (index !== current) setActive(index); }} onChoose={() => choose(row)}/>
    </Fragment>)}
  </ul>;
  // The state speaks of the options: «Todas» or a chosen one from another page do not hide that they load or failed.
  const state = shown.length > 0 ? null
    : props.loading ? <div role="status" aria-label={t("picker.searching")} className={cn("flex flex-col gap-2", phone ? "p-4" : "px-2.5 py-2")}>
      <Skeleton className="h-3 w-3/4"/><Skeleton className="h-3 w-1/2"/><Skeleton className="h-3 w-2/3"/>
    </div>
      : props.failed ? <div className={cn("flex flex-wrap items-center gap-2 text-sm text-[var(--color-content-muted)]", phone ? "p-4" : "px-2.5 py-2")}>
        {t("picker.failed")}<Button type="button" variant="outline" size="sm" onClick={props.onRetry}>{t("actions.retry")}</Button>
      </div>
        : <p role="status" className={cn("text-sm text-[var(--color-content-muted)]", phone ? "p-4" : "px-2.5 py-2")}>
          {searching ? t("picker.noMatches", { search: search.trim() }) : t("picker.empty")}
        </p>;
  const moreLabel = t(props.loadingMore ? "picker.loadingMore" : "picker.more", { count: props.pageSize ?? 50 });
  // The search and how many there are stay on top, behind a line, while the list scrolls under them.
  // A bar's button that says something else («Más filtros») names the list on top of it; on the phone the title does.
  const heading = props.triggerLabel && !phone
    ? <p className="px-1 pb-1 text-[length:var(--text-caption)] font-semibold tracking-[0.06em] text-[var(--color-content-heading)] uppercase">{props.label}</p> : null;
  const header = heading || searchBox || countRow
    ? <div className={cn("border-b border-[var(--color-border)]", phone ? "p-3" : "p-1.5")}>{heading}{searchBox}{countRow}</div> : null;

  if (phone) return <>
    {trigger}
    <Dialog open={open} onOpenChange={next => { if (!next) hide(); }}>
      <DialogContent placement="right" showCloseButton={false} aria-describedby={undefined} onOpenAutoFocus={focusList}
        className="inset-0 flex h-svh w-screen max-w-none flex-col gap-0 overflow-hidden p-0">
        <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
          <DialogTitle className="min-w-0 flex-1 truncate">{props.label}</DialogTitle>
          <IconButton variant="ghost" label={t("picker.close")} onClick={hide}><CloseIcon className="size-5"/></IconButton>
        </header>
        {header}
        {options}
        {state}
        {props.onLoadMore ? <div className="p-3 text-center">
          <Button type="button" variant="outline" size="touch" pending={props.loadingMore} onClick={props.onLoadMore}>{moreLabel}</Button>
        </div> : null}
        {multiple ? <footer className="border-t border-[var(--color-border)] p-3">
          <Button type="button" size="touch" className="w-full" onClick={done}>{t("picker.done", { count: picked.length })}</Button>
        </footer> : null}
      </DialogContent>
    </Dialog>
  </>;

  return <PopoverPrimitive.Root modal open={open} onOpenChange={next => { if (next) show(); else hide(); }}>
    <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align="start" sideOffset={4} collisionPadding={8} onKeyDown={leaveWithTab} onOpenAutoFocus={focusList}
        onCloseAutoFocus={event => {
          const direction = leaving.current;
          leaving.current = null;
          if (direction !== "next") return;
          event.preventDefault();
          (nextTabbable(triggerRef.current) ?? triggerRef.current)?.focus();
        }}
        className="z-50 flex max-h-[min(28rem,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) min-w-48 flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none">
        {header}
        {options}
        {state}
        {props.onLoadMore ? <div className="border-t border-[var(--color-border)] px-2.5 py-1.5 text-right">
          <Button type="button" variant="link" size="inline" pending={props.loadingMore} onClick={props.onLoadMore}>{moreLabel}</Button>
        </div> : null}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}

/** An option: the tick or the box on the left, the name, its reason if it is off and the grey line under it. The option is
 * named only by its name; the line and the reason are its description. */
function OptionRow({ row, id, active, multiple, touch, position, onHover, onChoose }: {
  row: Row; id: string; active: boolean; multiple: boolean; touch: boolean; position?: { index: number; size: number };
  onHover: () => void; onChoose: () => void;
}) {
  const { label, description, disabledReason, icon } = row.option;
  const describedBy = [description ? `${id}-description` : null, disabledReason ? `${id}-reason` : null].filter(Boolean).join(" ");
  const markSize = touch ? "size-6" : "mt-0.5 size-4";
  return <li role="option" id={id} aria-labelledby={`${id}-label`} aria-describedby={describedBy || undefined} aria-selected={row.selected}
    aria-disabled={row.disabled || undefined} aria-posinset={position?.index} aria-setsize={position?.size} data-active={active || undefined}
    // The focus stays in the search or the list: a click only chooses.
    onMouseDown={event => event.preventDefault()} onMouseMove={onHover} onClick={onChoose}
    className={cn("flex cursor-default items-start gap-2 select-none data-[active]:bg-accent data-[active]:text-accent-foreground aria-disabled:opacity-50",
      touch ? "min-h-14 items-center gap-3 border-b border-[var(--color-border)] px-4 py-2 text-base" : "rounded-sm px-2 py-1.5 text-sm")}>
    {multiple
      ? <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-[0.25rem] border border-input", markSize,
        row.selected && "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white")}>{row.selected ? <CheckIcon className={touch ? "size-4" : "size-3"}/> : null}</span>
      : <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center", markSize)}>{row.selected ? <CheckIcon className="size-4"/> : null}</span>}
    {icon ? <span aria-hidden="true" className={cn("flex shrink-0", touch ? "" : "mt-0.5")}>{icon}</span> : null}
    <span className="flex min-w-0 flex-col">
      <span className="break-words">
        <span id={`${id}-label`}>{label}</span>
        {disabledReason ? <><span aria-hidden="true" className="text-[var(--color-content-muted)]"> · {disabledReason}</span><span id={`${id}-reason`} hidden>{disabledReason}</span></> : null}
      </span>
      {description ? <span id={`${id}-description`} className={cn("break-words text-[var(--color-content-muted)]", touch ? "text-sm" : "text-xs")}>{description}</span> : null}
    </span>
  </li>;
}

/** DS2-A: the chosen names that fit in the field and «y N más» for the rest; the field never grows. It measures on its own
 * width, again when that width changes. */
function ChoiceSummary({ labels }: { labels: readonly string[] }) {
  const { t } = useTranslation();
  const box = useRef<HTMLSpanElement>(null), probe = useRef<HTMLSpanElement>(null);
  const key = labels.join("\n");
  const [summary, setSummary] = useState<{ key: string; names: string; more: string | null } | null>(null);
  useLayoutEffect(() => {
    const container = box.current, measure = probe.current, list = key.split("\n");
    if (!container || !measure) return;
    const update = () => {
      const width = container.clientWidth;
      const next = summarizeChoices(list, text => { measure.textContent = text; return measure.getBoundingClientRect().width <= width; },
        count => t("picker.andMore", { count }));
      setSummary(previous => previous?.key === key && previous.names === next.names && previous.more === next.more ? previous : { key, ...next });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [key, t]);
  const shown = summary?.key === key ? summary : { names: labels.join(", "), more: null };
  return <span ref={box} aria-hidden="true" className="relative flex min-w-0 flex-1 overflow-hidden">
    <span className="truncate">{shown.names}</span>
    {shown.more ? <span className="shrink-0 whitespace-pre">{` ${shown.more}`}</span> : null}
    <span ref={probe} className="invisible absolute top-0 left-0 whitespace-pre"/>
  </span>;
}
