import { useEffect, useRef } from "react";
import { useSystemPresentation } from "@/shared/api/presentation";
import i18n, { publicLanguageStorageKey, isSupportedLanguage } from "./index";

// Se monta en el layout público. Una elección explícita de este navegador conserva prioridad.
export function PublicPresentationDefaults() {
  const { data } = useSystemPresentation();
  const applied = useRef(false);
  useEffect(() => {
    if (data && !applied.current) {
      applied.current = true;
      const explicit = globalThis.localStorage?.getItem(publicLanguageStorageKey);
      void i18n.changeLanguage(isSupportedLanguage(explicit) ? explicit : data.defaultCulture);
    }
  }, [data]);
  return null;
}
