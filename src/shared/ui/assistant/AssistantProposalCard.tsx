import type { ReactNode } from "react";
import { Badge } from "../badge";

/**
 * A proposal under the answer that brought it (IA1-A): the band names its kind and holds its actions, and the module brings
 * the content. Replaced or already created, it folds to one line with its state and, when there is one, the way to what it
 * created.
 */
export function AssistantProposalCard({ kind, title, summary, actions, folded, children }: {
  kind: string;
  title: string;
  summary?: string;
  actions?: ReactNode;
  folded?: { readonly state: string; readonly action?: ReactNode } | null;
  children?: ReactNode;
}) {
  if (folded)
    return (
      <section className="assistant-proposal" data-folded="true" aria-label={`${kind}: ${title}`}>
        <span className="text-sm font-semibold">{kind}</span>
        <span className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">{title}</span>
        <Badge variant="outline">{folded.state}</Badge>
        {folded.action}
      </section>
    );
  return (
    <section className="assistant-proposal" aria-label={`${kind}: ${title}`}>
      <div className="assistant-proposal-band">
        <h3>{kind}</h3>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="assistant-proposal-body">
        <div className="min-w-0">
          <p className="break-words font-semibold [overflow-wrap:anywhere]">{title}</p>
          {summary ? <p className="text-sm text-[var(--color-content-muted)]">{summary}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
