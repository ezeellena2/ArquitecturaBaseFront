import { useCallback, useRef, useState } from "react";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { entryColumns } from "../entryForm";

/**
 * The columns of the zones of a form (CW16): measured on the node that holds them, three on the computer, two on a tablet and
 * one on the phone; until it is measured, the screen's. The panel keeps one column (AR1-A).
 */
export function useEntryColumns(layout: "page" | "panel") {
  const phone = useMediaQuery("(width < 640px)");
  const tablet = useMediaQuery("(width < 1024px)");
  const [widthRem, setWidthRem] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const measured = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const measure = () => setWidthRem(node.clientWidth / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);
  const columns: 1 | 2 | 3 = layout === "panel" ? 1 : widthRem > 0 ? entryColumns(widthRem) : phone ? 1 : tablet ? 2 : 3;
  return { measured, columns, phone };
}
