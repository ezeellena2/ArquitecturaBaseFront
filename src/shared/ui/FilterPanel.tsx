import { Fragment, useState, type ReactNode } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { IconButton } from "./IconButton";
import { ChevronLeftIcon, ChevronRightIcon, SlidersIcon } from "./icons";

/** One thing that can be filtered: its name in the list, whether it is applied and what is chosen in it. */
export interface FilterPanelSection {
  key: string;
  label: string;
  applied: boolean;
  content: ReactNode;
  /** Takes this filter away; «Quitar» offers it while it is applied. */
  onClear: () => void;
  /** Starts a group after a line, as «Cargó» and «Versión» after the questions of a form. */
  separated?: boolean;
}

/**
 * «Filtros» (board PL1-A): a button that says how many are applied and opens, like «Columnas», what can be filtered on
 * the left and what is chosen in the marked one on the right. The owner applies each change at once: there is no Apply.
 * On the phone it takes the screen: first the list and, touching one, its options, with «‹» to go back and «Listo».
 */
export function FilterPanel({ label, sections, disabled }: { label: string; sections: readonly FilterPanelSection[]; disabled?: boolean }) {
  const { t } = useTranslation();
  const phone = useMediaQuery("(width < 640px)");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // On the phone the button only opens the dialog: closing it gives the focus back to the button.
  const restore = useRestoreFocusOnClose(open && phone);
  const applied = sections.filter(section => section.applied).length;
  const current = sections.find(section => section.key === selected) ?? (phone ? undefined : sections[0]);
  const trigger = <Button type="button" variant="outline" disabled={disabled} onClick={phone ? () => { setSelected(null); setOpen(true); } : undefined}>
    <SlidersIcon className="size-4"/>{label}
    {applied ? <>{" "}<span className="inline-flex size-4 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-[length:var(--text-caption)] font-semibold text-white">{applied}</span></> : null}
  </Button>;
  const list = <ul className="flex flex-col py-1">{sections.map(section => <Fragment key={section.key}>
    {section.separated ? <li role="presentation" className="my-1 h-px bg-[var(--color-border)]"/> : null}
    <li><button type="button" aria-current={section === current ? "true" : undefined} onClick={() => setSelected(section.key)}
      className={cn("flex min-h-8 w-full items-center gap-2 px-3 py-1.5 text-left text-sm outline-none hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-12 max-sm:border-b max-sm:border-[var(--color-border)]",
        section === current && "bg-[var(--color-brand-50)] shadow-[inset_2px_0_0_var(--color-brand-600)]")}>
      <span className={cn("min-w-0 flex-1 truncate", section.applied && "font-semibold")}>{section.label}</span>
      {section.applied ? <>{" "}<span className="size-1.5 shrink-0 rounded-full bg-[var(--color-brand-600)]"><span className="sr-only">{t("filterPanel.applied")}</span></span></> : null}
      <ChevronRightIcon className="size-3.5 shrink-0 text-[var(--color-content-muted)]"/>
    </button></li>
  </Fragment>)}</ul>;
  // Keyed by section, so what is typed in one never stays in the next.
  const pane = (section: FilterPanelSection) => <section key={section.key} aria-label={section.label} className="flex flex-col gap-3 p-3">
    <div className="flex min-h-7.5 items-center gap-1">
      {phone ? <IconButton label={t("filterPanel.back")} onClick={() => setSelected(null)}><ChevronLeftIcon className="size-4"/></IconButton> : null}
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{section.label}</h3>
      {section.applied ? <Button type="button" variant="link" size="inline" onClick={section.onClear}>{t("filterPanel.clear")}</Button> : null}
    </div>
    {section.content}
  </section>;
  if (phone) return <>
    {trigger}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent placement="right" aria-describedby={undefined} onCloseAutoFocus={restore} className="gap-0 overflow-hidden p-0">
        <div className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-4"><DialogTitle>{label}</DialogTitle></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{current ? pane(current) : list}</div>
        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3"><Button type="button" size="touch" className="w-full" onClick={() => setOpen(false)}>{t("filterPanel.done")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
  return <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
    <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align="start" sideOffset={4} collisionPadding={8} aria-label={label}
        className="z-50 flex max-h-[min(34rem,var(--radix-popover-content-available-height))] w-[36rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border border-input bg-popover text-popover-foreground shadow-md outline-none">
        <div className="w-52 shrink-0 overflow-y-auto border-r border-[var(--color-border)]">{list}</div>
        <div className="min-w-0 flex-1 overflow-y-auto">{current ? pane(current) : null}</div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>;
}
