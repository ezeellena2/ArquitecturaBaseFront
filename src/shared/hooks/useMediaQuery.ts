import { useEffect, useState } from "react";

/// Suscribe a un media query (sección 7.2: 768px separa escritorio de móvil). El valor inicial sale de la
/// inicialización perezosa de useState; el efecto solo suscribe a cambios posteriores.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => globalThis.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = globalThis.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener("change", onChange);

    return () => mediaQueryList.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
