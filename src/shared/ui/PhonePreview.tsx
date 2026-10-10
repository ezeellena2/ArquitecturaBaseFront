import type { ReactNode } from "react";

// Device frame from the chosen Forms board. Content remains composed from shared controls.
export function PhonePreview({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[32px] border-8 border-[var(--color-content)] bg-[var(--color-surface)]">
    <div className="border-b border-[var(--color-border)] bg-[var(--color-topbar-surface)] px-4 py-4"><p className="break-words text-center text-sm font-semibold">{title}</p></div>
    <div className="flex min-h-[420px] flex-col gap-4 p-4">{children}</div>
  </div>;
}
