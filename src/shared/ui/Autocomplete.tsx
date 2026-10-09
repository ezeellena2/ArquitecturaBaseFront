import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Input } from "./input";
interface Props extends Omit<ComponentProps<"input">, "onChange" | "value" | "onSelect"> {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { id: string; label: string }[];
  onSelect: (id: string) => void;
  footer?: ReactNode;
}
export function Autocomplete({ value, onValueChange, options, onSelect, footer, ...props }: Props) {
  const id = useId(), [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const expanded = open && !props.disabled && options.length > 0;
  function select(index: number) {
    if (options[index]) { setOpen(false); setActive(-1); onSelect(options[index].id); }
  }
  return <div className="relative min-w-0">
    <Input {...props} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
      aria-activedescendant={expanded && options[active] ? `${id}-${active}` : undefined} autoComplete="off" value={value}
      onChange={event => { setActive(-1); setOpen(true); onValueChange(event.target.value); }}
      onFocus={event => { setOpen(true); props.onFocus?.(event); }} onBlur={event => { setOpen(false); setActive(-1); props.onBlur?.(event); }}
      onKeyDown={event => {
        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
          event.preventDefault(); setOpen(true); setActive(index => event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1));
        } else if (event.key === "Enter" && expanded) { event.preventDefault(); select(active); }
        else if (event.key === "Escape") { setOpen(false); setActive(-1); }
        props.onKeyDown?.(event);
      }} />
    {expanded ? <ul id={`${id}-list`} role="listbox" aria-label={props["aria-label"]} className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-input bg-popover p-1 text-popover-foreground shadow-md">
      {options.map((option, index) => <li key={option.id} role="presentation"><button type="button" role="option" id={`${id}-${index}`} aria-selected={index === active} tabIndex={-1}
        className="w-full break-words rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
        onPointerDown={event => event.preventDefault()} onMouseDown={event => event.preventDefault()} onClick={() => select(index)}>{option.label}</button></li>)}
      {footer ? <li role="presentation" className="sticky bottom-0 border-t border-input bg-popover px-2.5 py-2 text-right">{footer}</li> : null}
    </ul> : null}
  </div>;
}
