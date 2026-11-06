import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { AlertCircleIcon, AlertTriangleIcon } from "@/shared/ui/icons";
import type { FormPublicationCheck } from "../api/response";

export type PublicationIssue = FormPublicationCheck["issues"][number];
// Rows with a line between them, as in «Campos de…».
export const findingRows = "flex flex-col divide-y divide-[var(--color-border)] [&>*]:px-4 [&>*]:py-3";

// What stops the publication or is worth reviewing: what it is, the concrete detail and where to fix it, at the right from
// 640 px and under the text below. The check before publishing (PU1-A) and a publication that did not go through (EP1-A) share it.
export function Finding({ tone, title, action, children }: { tone: "danger" | "warning"; title: string | null; action?: ReactNode; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertCircleIcon : AlertTriangleIcon;
  return <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
    <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-warning-700)]")} />
    <div className="flex min-w-0 flex-col gap-0.5 text-sm">{title ? <p className="font-medium">{title}</p> : null}{children}</div>
    {action ? <div className="col-start-2 sm:col-start-auto">{action}</div> : null}
  </li>;
}
