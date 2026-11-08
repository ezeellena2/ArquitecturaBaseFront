import { useCallback, useState, type ReactNode } from "react";

/// Mientras `keep`, conserva el alto que medía su contenido la última vez: lo que carga ocupa el lugar de lo que va a
/// llegar. Un bloque que se vuelve a leer y en el medio muestra una espera más baja no achica la pantalla, así el scroll
/// no salta arriba (el editor de un catálogo Manual mientras llega la revisión guardada). No dibuja nada propio, y sin
/// haber medido todavía (la primera carga) no retiene nada.
export function KeepHeight({ keep, children }: { keep: boolean; children: ReactNode }) {
  const [height, setHeight] = useState<number>();
  const measure = useCallback((block: HTMLDivElement) => {
    const observer = new ResizeObserver(() => setHeight(block.offsetHeight));
    observer.observe(block);
    return () => observer.disconnect();
  }, []);

  return <div ref={measure} data-slot="keep-height" style={keep && height ? { minHeight: height } : undefined}>{children}</div>;
}
