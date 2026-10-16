// Read-only preview; the owner validates the URL and supplies an accessible title.
export function EmbeddedPreview({ url, title }: { url: string; title: string }) {
  return <iframe className="h-[min(480px,55svh)] w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]" src={url} title={title} sandbox="allow-scripts allow-same-origin allow-forms" referrerPolicy="no-referrer" />;
}
