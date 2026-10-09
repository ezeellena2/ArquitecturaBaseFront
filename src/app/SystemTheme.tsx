import { useEffect } from "react";
import { useSystemPresentation } from "@/shared/api/presentation";
import { appearanceVariables, isAppearance } from "@/shared/lib/appearance";

// One root owns the palette, including anonymous screens and portal content.
export function SystemTheme() {
  const { data } = useSystemPresentation();
  const appearance = data?.appearance;
  useEffect(() => {
    if (!isAppearance(appearance)) return;
    const variables = appearanceVariables(appearance);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value);
    return () => { for (const key of Object.keys(variables)) root.style.removeProperty(key); };
  }, [appearance]);
  return null;
}
