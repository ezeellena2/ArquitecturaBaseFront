import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { IconButton } from "@/shared/ui/IconButton";
import { MoreVerticalIcon, PencilIcon } from "@/shared/ui/icons";

/**
 * «Corregir» and, at the end of «⋯», «Anular» in red (CW10-A and CW11-A). Only for whoever may change the response now:
 * the server says so in `canAmend` and checks it again.
 */
export function ResponseAmendActions({ onCorrect, onVoid, disabled }: { onCorrect: () => void; onVoid: () => void; disabled?: boolean }) {
  const { t } = useTranslation("forms");
  return <div className="flex items-center gap-1">
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onCorrect}><PencilIcon className="size-3.5" aria-hidden="true"/>{t("detail.correct")}</Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><IconButton label={t("detail.moreActions")} disabled={disabled}><MoreVerticalIcon className="size-4" aria-hidden="true"/></IconButton></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onVoid}>{t("detail.void")}</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
