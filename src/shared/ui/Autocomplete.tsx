import { useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/shared/lib/utils";
import { ChevronDownIcon } from "./icons";
import { Input } from "./input";
export interface AutocompleteOption {
  id: string;
  label: string;
  /** A second, muted line: what tells two similar options apart. */
  description?: string | null;
  /** Only in a multiple choice: already chosen. */
  selected?: boolean;
  /** Cannot be chosen now, such as the rest of a multiple choice that reached its maximum. */
  disabled?: boolean;
}
interface Props extends Omit<ComponentProps<"input">, "onChange" | "value" | "onSelect"> {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly AutocompleteOption[];
  onSelect: (id: string) => void;
  footer?: ReactNode;
  /** Above the options, such as how many there are. */
  header?: ReactNode;
  /** In place of the options while they load, fail or match nothing: it keeps the list open and says why. */
  status?: ReactNode;
  /** Choosing toggles an option and keeps the list open; each option shows its box. */
  multiple?: boolean;
  /** A dropdown: the arrow at the end of the field says that a click shows the options before typing. */
  dropdown?: boolean;
}
/** The list lives in a non-modal popover anchored to the field, so a scrolling table or dialog cannot clip it. It opens on a
 * click, typing or the arrows, not on focus: a focus from code (the first error when saving) leaves it closed, so it does
 * not cover the error under the field. */
export function Autocomplete({ value, onValueChange, options, onSelect, footer, header, status, multiple = false, dropdown = false, ...props }: Props) {
  const id = useId(), anchor = useRef<HTMLDivElement>(null), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const expanded = open && !props.disabled && (options.length > 0 || status != null);
  function select(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (!multiple) { setOpen(false); setActive(-1); }
    onSelect(option.id);
  }
  return <PopoverPrimitive.Root open={expanded} onOpenChange={next => { if (!next) { setOpen(false); setActive(-1); } }}>
    <PopoverPrimitive.Anchor asChild><div ref={anchor} className="relative min-w-0">
      <Input {...props} className={cn(dropdown && "peer pr-8", props.className)} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={expanded && options[active] ? `${id}-${active}` : undefined} autoComplete="off" value={value}
        onChange={event => { setActive(-1); setOpen(true); onValueChange(event.target.value); }}
        onClick={event => { setOpen(true); props.onClick?.(event); }} onBlur={event => { setOpen(false); setActive(-1); props.onBlur?.(event); }}
        onKeyDown={event => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && (options.length || status != null)) {
            event.preventDefault(); setOpen(true);
            if (options.length) setActive(index => event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1));
          } else if (event.key === "Enter" && expanded) { event.preventDefault(); select(active); }
          else if (event.key === "Escape") { setOpen(false); setActive(-1); }
          props.onKeyDown?.(event);
        }} />
      {/* The click goes through the arrow to the field, which opens the list. */}
      {dropdown ? <span aria-hidden="true" data-slot="autocomplete-arrow" className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[var(--color-content-muted)] peer-disabled:opacity-50"><ChevronDownIcon className="size-3.5" /></span> : null}
    </div></PopoverPrimitive.Anchor>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content asChild align="start" sideOffset={4} collisionPadding={8} hideWhenDetached
        onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
        onInteractOutside={event => { if (event.target instanceof Node && anchor.current?.contains(event.target)) event.preventDefault(); }}>
        <ul id={`${id}-list`} role="listbox" aria-label={props["aria-label"]} aria-multiselectable={multiple || undefined}
          className="z-50 w-(--radix-popover-trigger-width) min-w-48 max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-md border border-input bg-popover p-1 text-popover-foreground shadow-md">
          {header ? <li role="presentation" className="px-2.5 pt-1 pb-1.5 text-xs text-[var(--color-content-muted)]">{header}</li> : null}
          {options.map((option, index) => <li key={option.id} role="presentation"><button type="button" role="option" id={`${id}-${index}`}
            aria-selected={multiple ? !!option.selected : index === active} aria-disabled={option.disabled || undefined} data-active={index === active || undefined} tabIndex={-1}
            className={cn("flex w-full items-start gap-2 break-words rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[active]:text-accent-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
              !multiple && "aria-selected:bg-accent aria-selected:text-accent-foreground")}
            onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={() => select(index)}>
            {multiple ? <span aria-hidden="true" className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-input text-[0.6875rem] leading-none",
              option.selected && "border-[var(--color-brand-700)] bg-[var(--color-brand-700)] text-white")}>{option.selected ? "✓" : null}</span> : null}
            <span className="min-w-0"><span className="block">{option.label}</span>{option.description ? <span className="block text-xs text-[var(--color-content-muted)]">{option.description}</span> : null}</span>
          </button></li>)}
          {status != null && options.length === 0 ? <li role="presentation" className="px-2.5 py-2 text-sm text-[var(--color-content-muted)]">{status}</li> : null}
          {footer ? <li role="presentation" className="sticky bottom-0 border-t border-input bg-popover px-2.5 py-2 text-right">{footer}</li> : null}
        </ul>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
