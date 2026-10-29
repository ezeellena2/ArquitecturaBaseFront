import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

// Device frame from the chosen Forms board. Content remains composed from shared controls.
// In a flex column of fixed height the frame takes the remaining space and the screen scrolls;
// `screenClassName` lets that consumer lower the screen's minimum height.
export function PhonePreview({ title, children, screenClassName }: { title: string; children: ReactNode; screenClassName?: string }) {
  return <div className="mx-auto flex min-h-0 w-full max-w-75 flex-1 flex-col overflow-hidden rounded-[2rem] border-8 border-[var(--color-content)] bg-[var(--color-surface)]">
    <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-topbar-surface)] px-4 py-4"><p className="break-words text-center text-sm font-semibold">{title}</p></div>
    <div className={cn("flex min-h-105 flex-1 flex-col gap-4 overflow-y-auto p-4", screenClassName)}>{children}</div>
  </div>;
}
