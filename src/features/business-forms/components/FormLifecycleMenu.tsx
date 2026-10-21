import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/shared/ui/dropdown-menu";
import { IconButton } from "@/shared/ui/IconButton";
import { BanIcon, RefreshIcon, MoreVerticalIcon, TrashIcon } from "@/shared/ui/icons";
import type { FormLifecycle } from "../api/response";
export function FormLifecycleMenu({ lifecycle, blocked, onDeactivate, onReactivate, triggerRef, onDelete, canManage, canPublish }: { canManage: boolean; canPublish: boolean; onDelete: () => void; triggerRef?: Ref<HTMLButtonElement>; lifecycle: FormLifecycle; blocked: boolean; onDeactivate: () => void; onReactivate: () => void }) {
 const { t } = useTranslation("forms");
 const deactivated = !!lifecycle.deactivatedAtUtc;
 const allowed = deactivated ? lifecycle.canReactivate : lifecycle.canDeactivate;
 const Icon = deactivated ? RefreshIcon : BanIcon;
 const hasResponses = lifecycle.deletionUnavailableReason === "HasResponses" || lifecycle.responseCount !== null && lifecycle.responseCount > 0;
 const showDelete = canManage && !hasResponses;
 if (!canPublish && !showDelete) return null;
 return <DropdownMenu><DropdownMenuTrigger asChild><IconButton ref={triggerRef} label={t("lifecycle.actions")}><MoreVerticalIcon className="size-4" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end">{canPublish?<DropdownMenuItem aria-disabled={blocked || !allowed || undefined} onSelect={event => { if (blocked || !allowed) event.preventDefault(); else (deactivated ? onReactivate : onDeactivate)(); }}><Icon className="size-4" /><span>{t(deactivated ? "lifecycle.reactivate" : "lifecycle.deactivate")}{!allowed ? <span className="block text-xs">{t("lifecycle.reasons." + (lifecycle.unavailableReason ?? "Unavailable"))}</span> : null}</span></DropdownMenuItem>:null}{showDelete?<>{canPublish?<DropdownMenuSeparator/>:null}<DropdownMenuItem aria-disabled={blocked || !lifecycle.canDelete || undefined} onSelect={event => { if (blocked || !lifecycle.canDelete) event.preventDefault(); else onDelete(); }}><TrashIcon className="size-4"/><span>{t("lifecycle.delete")}{!lifecycle.canDelete?<span className="block text-xs">{t("lifecycle.deletionReasons."+(lifecycle.deletionUnavailableReason??"Unavailable"))}</span>:null}</span></DropdownMenuItem></>:null}{canManage && hasResponses ? <DropdownMenuLabel className="max-w-64 whitespace-normal">{t("lifecycle.deletionReasons.HasResponses")}</DropdownMenuLabel> : null}</DropdownMenuContent></DropdownMenu>;
}
