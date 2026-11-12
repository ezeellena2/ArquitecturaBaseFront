import { Fragment, useId, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { PlusIcon } from "@/shared/ui/icons";

export interface DashboardAddEntry {
  key: string;
  /** From the responses (how many arrived, who loaded, the states) or from a question (a number, a date, a choice). */
  group: "responses" | "questions";
  label: string;
  /** What can be counted with it, in grey under its name. */
  description: string;
  onSelect: () => void;
}

/**
 * «Agregar gráfico» (DOC7-A): what has no card, by its question or by what it shows, with what can be counted with it, and
 * «Volver al automático» once the dashboard was adjusted. With everything on the dashboard and nothing adjusted, it stays off
 * with its reason, in the same place. Without `entries` (the dashboard has not arrived, failed or has no responses) it stays
 * off without one: there is nothing to chart, and the dashboard below says why.
 */
export function DashboardAddMenu({ entries, adjusted = false, onAutomatic, triggerRef, onCloseAutoFocus }: {
  entries?: readonly DashboardAddEntry[];
  adjusted?: boolean;
  onAutomatic?: () => void;
  triggerRef?: Ref<HTMLButtonElement>;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const { t } = useTranslation("forms");
  const menuId = useId();
  const label = <><PlusIcon className="size-4" aria-hidden="true" />{t("dashboard.add")}</>;
  if (!entries) return <Button ref={triggerRef} type="button" variant="outline" disabled>{label}</Button>;
  if (entries.length === 0 && !adjusted)
    return <DisabledReason reason={t("dashboard.addNone")}><Button ref={triggerRef} type="button" variant="outline" disabled>{label}</Button></DisabledReason>;
  const groups = (["responses", "questions"] as const).map(group => ({ group, items: entries.filter(entry => entry.group === group) })).filter(group => group.items.length > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button ref={triggerRef} type="button" variant="outline">{label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-80" onCloseAutoFocus={onCloseAutoFocus}>
        {groups.map(({ group, items }, index) => <Fragment key={group}>
          {index > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuGroup aria-labelledby={`${menuId}-${group}`}>
            <DropdownMenuLabel id={`${menuId}-${group}`} className="text-xs text-[var(--color-content-muted)]">{t(group === "responses" ? "dashboard.addResponses" : "dashboard.addQuestions")}</DropdownMenuLabel>
            {items.map(entry => <DropdownMenuItem key={entry.key} onSelect={entry.onSelect}>
              <span className="flex min-w-0 flex-col">
                <span className="break-words">{entry.label}</span>
                <span className="text-xs text-[var(--color-content-muted)]">{entry.description}</span>
              </span>
            </DropdownMenuItem>)}
          </DropdownMenuGroup>
        </Fragment>)}
        {adjusted && onAutomatic ? <>
          {groups.length ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={onAutomatic}>{t("dashboard.automatic")}</DropdownMenuItem>
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
