import { useId, type ReactNode } from "react";
import { IconButton } from "./IconButton";
import { ChevronDownIcon } from "./icons";
import { Surface } from "./Surface";

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandLabel: string;
  collapseLabel: string;
  summary?: ReactNode;
  meta?: ReactNode;
  /// La explicación de la zona: en la (i) junto al título, plegada o no.
  help?: string;
  /// Lo que actúa sobre la zona entera, como «Agregar filtro…»: en la banda sólo mientras está expandida, antes de la flecha.
  actions?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({ title, open, onOpenChange, expandLabel, collapseLabel, summary, meta, help, actions, children }: CollapsibleSectionProps) {
  const contentId = useId();
  const description = open ? meta : summary;
  return <Surface title={title} help={help} actions={<>
    {description != null ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    {open ? actions : null}
    <IconButton variant="outline" label={open ? collapseLabel : expandLabel} aria-expanded={open} aria-controls={contentId}
      onClick={() => onOpenChange(!open)}>
      <ChevronDownIcon className={open ? "size-4 rotate-180" : "size-4"} />
    </IconButton>
  </>}>
    <div id={contentId} hidden={!open}>{children}</div>
  </Surface>;
}
