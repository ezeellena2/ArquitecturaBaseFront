import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { ChevronDownIcon } from "./icons";
import { IconButton } from "./IconButton";

export interface TreeListItem {
  id: string;
  label: string;
  /// 0 for an entry above the tree («Todos», «Sin carpeta»), 1 for the top of the tree, and one more per level below.
  level: number;
  /// Undefined when it has nothing below; otherwise whether what is below shows.
  expanded?: boolean;
  selected?: boolean;
  /// What acts on the entry (its «…»): it shows when the pointer is over the row or the focus is in it, and always on a touch
  /// screen, so it does not crowd a long list.
  actions?: ReactNode;
  /// Replaces the row while the entry is edited in place, like renaming a folder.
  editor?: ReactNode;
}

// An entry with what is below it: the flat list in order, nested by level so that the levels are read, not only seen (premise
// 5.3). Levels 0 and 1 are the root; each deeper entry goes under the closest shallower one before it.
interface TreeNode { item: TreeListItem; children: TreeNode[] }
function nest(items: readonly TreeListItem[]): TreeNode[] {
  const root: TreeNode[] = [];
  const open: TreeNode[] = [];
  for (const item of items) {
    const node: TreeNode = { item, children: [] };
    const level = Math.max(item.level, 1);
    while (open.length > 0 && Math.max(open[open.length - 1]!.item.level, 1) >= level) open.pop();
    (open.length > 0 ? open[open.length - 1]!.children : root).push(node);
    open.push(node);
  }
  return root;
}

/// A list to choose one entry among levels, like the folders of a listing (CP1-A, 2026-11-03): each row says its name, the arrow
/// folds and unfolds what is below, and the chosen one has the brand tint with a bar at the start (OE1-A). What is below an entry
/// is a list nested in its item, indented: a screen reader says the level. It does not know what the entries are: its owner
/// flattens the visible ones in order, decides what is chosen and puts the actions of each.
export function TreeList({ label, items, onSelect, onToggle }: {
  label: string;
  items: readonly TreeListItem[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}): ReactNode {
  const { t } = useTranslation();
  // The arrow of a level lines up under the name of the one above: each nested list is indented by one arrow.
  const render = (nodes: readonly TreeNode[]): ReactNode => nodes.map(({ item, children }) => (
        <li key={item.id}>
          {item.editor ?? (
            <div className={cn(
              // 44 px to touch on the phone, as the board asks of every target there.
              "group/tree relative flex min-h-7.5 items-center gap-0.5 rounded-[var(--radius-control)] pr-0.5 transition-colors max-sm:min-h-11",
              item.selected
                ? "bg-[var(--color-brand-50)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]"
                : "hover:bg-[var(--color-surface-muted)]",
            )}>
              {/* 44 px to touch the arrow on the phone too (premise 5.7). */}
              {item.level === 0 ? null : item.expanded === undefined ? <span aria-hidden="true" className="size-6 shrink-0 max-sm:size-11" /> : (
                <IconButton size="icon-xs" className="max-sm:size-11" label={t(item.expanded ? "treeList.collapse" : "treeList.expand", { label: item.label })} aria-expanded={item.expanded} onClick={() => onToggle(item.id)}>
                  <ChevronDownIcon className={cn("size-3.5 transition-transform", item.expanded ? "" : "-rotate-90")} />
                </IconButton>
              )}
              <button
                type="button"
                data-tree-id={item.id}
                aria-current={item.selected ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center self-stretch rounded-[var(--radius-control)] py-1 text-left text-sm leading-4 break-words outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  item.level === 0 ? "px-2" : "pr-2",
                  item.selected ? "font-medium text-[var(--color-content)]" : "text-[var(--color-content-muted)] hover:text-[var(--color-content)]",
                )}
              >
                {item.label}
              </button>
              {item.actions ? (
                <span className="flex shrink-0 opacity-0 group-focus-within/tree:opacity-100 group-hover/tree:opacity-100 has-[[data-state=open]]:opacity-100 pointer-coarse:opacity-100">
                  {item.actions}
                </span>
              ) : null}
            </div>
          )}
          {children.length > 0 ? <ul className="flex flex-col gap-0.5 pl-5 max-sm:pl-11">{render(children)}</ul> : null}
        </li>
      ));
  return <ul aria-label={label} className="flex flex-col gap-0.5">{render(nest(items))}</ul>;
}
