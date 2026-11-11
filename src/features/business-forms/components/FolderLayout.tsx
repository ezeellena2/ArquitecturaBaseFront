import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ChevronDownIcon } from "@/shared/ui/icons";
import type { ListingFolders } from "../hooks/useFormFolders";
import { FolderBrowser } from "./FolderBrowser";

/// A listing with its folders (CP1-A): the «Carpetas» panel on the left from 1024 px; narrower (the phone, a tablet with a menu
/// panel open), a selector above the list that opens the same folders in a sheet. The listing goes on the right, as it was.
export function FolderLayout({ folders, children }: { folders: ListingFolders; children: ReactNode }) {
  const { t } = useTranslation("formFolders");
  const [sheetOpen, setSheetOpen] = useState(false);
  const restoreFocus = useRestoreFocusOnClose(sheetOpen);
  return (
    <div className="flex flex-col lg:flex-row lg:items-start lg:gap-4">
      <div className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col">
        <FolderBrowser folders={folders} variant="panel" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 lg:hidden">
          <Button type="button" variant="outline" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
            {t("selector", { name: folders.label ?? t("all") })}<ChevronDownIcon aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
        {children}
      </div>
      {sheetOpen ? (
        <Dialog open onOpenChange={setSheetOpen}>
          <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
            <DialogHeader><DialogTitle>{t("title")}</DialogTitle></DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FolderBrowser folders={folders} variant="sheet" onChosen={() => setSheetOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
