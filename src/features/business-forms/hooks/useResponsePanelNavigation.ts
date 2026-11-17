import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useResponsePanelNavigation({ contextKey, ids, index, page, disabled, loadPage, onNavigate, onPage }: {
  contextKey: string;
  ids: string[];
  index: number;
  page: number;
  disabled: boolean;
  loadPage: (page: number) => Promise<{ ids: string[]; totalCount: number }>;
  onNavigate: (id: string, page: number) => void;
  onPage?: (ids: string[], page: number, totalCount: number) => void;
}) {
  const current = useRef(contextKey);
  const live = useRef(true);
  const direction = useRef(1);
  const inFlight = useRef<string | null>(null);
  const [motion, setMotion] = useState<{ key: string; busy: boolean; error: unknown }>({ key: contextKey, busy: false, error: null });
  if (motion.key !== contextKey) setMotion({ key: contextKey, busy: false, error: null });
  useLayoutEffect(() => { current.current = contextKey; }, [contextKey]);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  // The open response's last place in the list. When it leaves the list while open (F2: resolved in «Por resolver»), `gap` is that
  // place: ↓ goes to the one that now takes it and ↑ to the one before it.
  const [place, setPlace] = useState<{ key: string; index: number } | null>(null);
  if (index >= 0 && (place?.key !== contextKey || place.index !== index)) setPlace({ key: contextKey, index });
  const gap = index < 0 && place?.key === contextKey ? place.index : null;
  const busy = motion.key === contextKey && motion.busy;
  const error = motion.key === contextKey ? motion.error : null;
  const move = async (step: number) => {
    if (disabled || busy || inFlight.current === contextKey || index < 0 && gap === null) return;
    const expected = contextKey;
    inFlight.current = expected;
    direction.current = step;
    setMotion({ key: expected, busy: true, error: null });
    const isCurrent = () => live.current && current.current === expected;
    try {
      let id: string | undefined = ids[index >= 0 ? index + step : (gap ?? 0) - (step < 0 ? 1 : 0)];
      let nextPage = page;
      if (!id) {
        nextPage += step;
        const result = await loadPage(nextPage);
        const nextIds = result.ids;
        id = step < 0 ? nextIds.at(-1) : nextIds[0];
        if (isCurrent()) onPage?.(nextIds, nextPage, result.totalCount);
      }
      if (id && isCurrent()) onNavigate(id, nextPage);
    } catch (failure) {
      if (isCurrent()) setMotion({ key: expected, busy: false, error: failure });
    } finally {
      if (inFlight.current === expected) inFlight.current = null;
      if (isCurrent()) setMotion(previous => ({ ...previous, busy: false }));
    }
  };
  return { busy, error, gap, move, retry: () => { void move(direction.current); }, clearError: () => setMotion({ key: contextKey, busy: false, error: null }) };
}
