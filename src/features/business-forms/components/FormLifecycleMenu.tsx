import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { IconButton } from "@/shared/ui/IconButton";
import { BanIcon, RefreshIcon, MoreVerticalIcon } from "@/shared/ui/icons";
import type { FormLifecycle } from "../api/response";
export function FormLifecycleMenu({ lifecycle, blocked, onDeactivate, onReactivate, triggerRef }: { triggerRef?: Ref<HTMLButtonElement>; lifecycle: FormLifecycle; blocked: boolean; onDeactivate: () => void; onReactivate: () => void }) {
 const { t } = useTranslation("forms");
 const deactivated = !!lifecycle.deactivatedAtUtc;
 const allowed = deactivated ? lifecycle.canReactivate : lifecycle.canDeactivate;
 const Icon = deactivated ? RefreshIcon : BanIcon;
 return <DropdownMenu><DropdownMenuTrigger asChild><IconButton ref={triggerRef} label={t("lifecycle.actions")}><MoreVerticalIcon className="size-4" /></IconButton></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={blocked || !allowed} onSelect={deactivated ? onReactivate : onDeactivate}><Icon className="size-4" /><span>{t(deactivated ? "lifecycle.reactivate" : "lifecycle.deactivate")}{!allowed ? <span className="block text-xs">{t("lifecycle.reasons." + (lifecycle.unavailableReason ?? "Unavailable"))}</span> : null}</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
