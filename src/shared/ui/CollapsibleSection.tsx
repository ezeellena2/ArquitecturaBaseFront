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
  children: ReactNode;
}

export function CollapsibleSection({ title, open, onOpenChange, expandLabel, collapseLabel, summary, meta, children }: CollapsibleSectionProps) {
  const contentId = useId();
  const description = open ? meta : summary;
  return <Surface title={title} actions={<>
    {description != null ? <span className="text-xs text-muted-foreground">{description}</span> : null}
    <IconButton variant="outline" label={open ? collapseLabel : expandLabel} aria-expanded={open} aria-controls={contentId}
      onClick={() => onOpenChange(!open)}>
      <ChevronDownIcon className={open ? "size-4 rotate-180" : "size-4"} />
    </IconButton>
  </>}>
    <div id={contentId} hidden={!open}>{children}</div>
  </Surface>;
}
