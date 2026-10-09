import type { ReactNode, Ref, UIEventHandler } from "react";

// Shared viewport owns the background, spacing and contained scroll, not fetching or reading state.
export function MessageHistory({ children, label, ref, onScroll }: {
  children: ReactNode;
  label: string;
  ref?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  return <div ref={ref} aria-label={label} className="message-history" onScroll={onScroll}>{children}</div>;
}
