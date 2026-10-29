import { cn } from "@/shared/lib/utils";
// Read-only preview; the owner validates the URL and supplies an accessible title.
export function EmbeddedPreview({ url, title, kind = "external", className }: { url: string; title: string; kind?: "external" | "pdf"; className?: string }) {
  return <iframe className={cn("h-[min(30rem,55svh)] w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)} src={url} title={title} sandbox={kind === "pdf" ? undefined : "allow-scripts allow-same-origin allow-forms"} referrerPolicy="no-referrer" />;
}
