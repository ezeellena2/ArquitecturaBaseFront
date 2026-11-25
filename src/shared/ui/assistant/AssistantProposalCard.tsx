import type { ReactNode } from "react";
import { Badge } from "../badge";

/**
 * A proposal under the answer that brought it (IA1-A): the band names its kind and holds its actions, and the module brings
 * the content. Replaced or already created, it folds to one line with its state and, when there is one, the way to what it
 * created. The data of the content go in `DataList` and a collection in a table (`assistant-proposal-table`), both from edge
 * to edge of the card; `footer` closes it in the tone of the band (TC1-B, TC2-B, 2026-11-25). The verified sources of an
 * answer use it too (TC4-A).
 */
export function AssistantProposalCard({ kind, title, actions, folded, footer, children }: {
  kind: string;
  title: string;
  actions?: ReactNode;
  folded?: { readonly state: string; readonly action?: ReactNode } | null;
  footer?: ReactNode;
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
        <p className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{title}</p>
        {children}
      </div>
      {footer ? <p className="assistant-proposal-foot">{footer}</p> : null}
    </section>
  );
}
