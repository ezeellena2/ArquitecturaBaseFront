import type { ReactNode } from "react";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../dialog";
import { IconButton } from "../IconButton";
import { ChevronRightIcon } from "../icons";

export function AssistantWorkspace({ panel, panelLabel, showLabel, drawerHelp, currentTitle, expanded, onExpandedChange, drawerOpen, onDrawerOpenChange, children }: {
  panel: ReactNode;
  panelLabel: string;
  showLabel: string;
  drawerHelp: string;
  currentTitle: string;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  drawerOpen: boolean;
  onDrawerOpenChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const restore = useRestoreFocusOnClose(drawerOpen);
  const mobile = useMediaQuery("(max-width: 1023px)");
  return <div className="conversation-workspace">
    {expanded && !mobile ? <aside className="conversation-desktop-panel" aria-label={panelLabel}>{panel}</aside> : null}
    <div className="conversation-main">
      <div className="conversation-thread-toolbar">
        <div className="conversation-desktop-trigger">{!expanded ? <IconButton label={showLabel} onClick={() => onExpandedChange(true)}><ChevronRightIcon /></IconButton> : null}</div>
        <div className="conversation-mobile-trigger"><IconButton label={showLabel} onClick={() => onDrawerOpenChange(true)}><ChevronRightIcon /></IconButton></div>
        <span>{currentTitle}</span>
      </div>
      {children}
    </div>
    <Dialog open={drawerOpen && mobile} onOpenChange={onDrawerOpenChange}>
      <DialogContent className="conversation-drawer" onCloseAutoFocus={restore}>
        <DialogHeader><DialogTitle>{panelLabel}</DialogTitle><DialogDescription className="sr-only">{drawerHelp}</DialogDescription></DialogHeader>
        {panel}
      </DialogContent>
    </Dialog>
  </div>;
}
