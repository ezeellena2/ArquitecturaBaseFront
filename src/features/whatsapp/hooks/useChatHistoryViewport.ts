import { useLayoutEffect, useRef, type UIEvent } from "react";
import type { TimelineItem } from "../lib/timeline";

export function useChatHistoryViewport(items: readonly TimelineItem[], atBottom: boolean, onAtBottomChange: (recent: boolean) => void) {
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (atBottom && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [items, atBottom]);
  useLayoutEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const node = event.currentTarget;
    onAtBottomChange(node.scrollHeight - node.scrollTop - node.clientHeight < 64);
  }

  async function loadOlder(fetch: () => Promise<unknown>) {
    onAtBottomChange(false);
    const node = viewport.current;
    const height = node?.scrollHeight ?? 0;
    const scrollTop = node?.scrollTop ?? 0;
    const top = node?.getBoundingClientRect().top ?? 0;
    const anchor = node ? Array.from(node.querySelectorAll("article")).find(message => message.getBoundingClientRect().bottom > top) : undefined;
    const anchorTop = anchor?.getBoundingClientRect().top;
    await fetch();
    if (!node || node !== viewport.current) return;
    frame.current = requestAnimationFrame(() => {
      if (node !== viewport.current) return;
      // Keep the visible message anchored: polling may append while history is being prepended.
      node.scrollTop += anchor?.isConnected && anchorTop !== undefined
        ? anchor.getBoundingClientRect().top - anchorTop + node.scrollTop - scrollTop
        : node.scrollHeight - height;
    });
  }
  return { viewport, onScroll, loadOlder };
}
