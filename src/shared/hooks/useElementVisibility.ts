import { useEffect, useRef, useState } from "react";
export function useElementVisibility<T extends HTMLElement>(once = false) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !ref.current || once && visible) return;
    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(entry => entry.isIntersecting));
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once, visible]);
  return { ref, visible };
}
