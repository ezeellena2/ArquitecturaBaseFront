import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useResponsePanelNavigation({ contextKey, ids, index, page, disabled, loadPage, onNavigate, onPage }: {
  contextKey: string;
  ids: string[];
  index: number;
  page: number;
  disabled: boolean;
  loadPage: (page: number) => Promise<string[]>;
  onNavigate: (id: string, page: number) => void;
  onPage?: (ids: string[], page: number) => void;
}) {
  const current = useRef(contextKey);
  const live = useRef(true);
  const direction = useRef(1);
  const inFlight = useRef<string | null>(null);
  const [motion, setMotion] = useState<{ key: string; busy: boolean; error: unknown }>({ key: contextKey, busy: false, error: null });
  if (motion.key !== contextKey) setMotion({ key: contextKey, busy: false, error: null });
  useLayoutEffect(() => { current.current = contextKey; }, [contextKey]);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const busy = motion.key === contextKey && motion.busy;
  const error = motion.key === contextKey ? motion.error : null;
  const move = async (step: number) => {
    if (disabled || busy || inFlight.current === contextKey || index < 0) return;
    const expected = contextKey;
    inFlight.current = expected;
    direction.current = step;
    setMotion({ key: expected, busy: true, error: null });
    const isCurrent = () => live.current && current.current === expected;
    try {
      let id: string | undefined = ids[index + step];
      let nextPage = page;
      if (!id) {
        nextPage += step;
        const nextIds = await loadPage(nextPage);
        id = step < 0 ? nextIds.at(-1) : nextIds[0];
        if (isCurrent()) onPage?.(nextIds, nextPage);
      }
      if (id && isCurrent()) onNavigate(id, nextPage);
    } catch (failure) {
      if (isCurrent()) setMotion({ key: expected, busy: false, error: failure });
    } finally {
      if (inFlight.current === expected) inFlight.current = null;
      if (isCurrent()) setMotion(previous => ({ ...previous, busy: false }));
    }
  };
  return { busy, error, move, retry: () => { void move(direction.current); }, clearError: () => setMotion({ key: contextKey, busy: false, error: null }) };
}
