import { useEffect } from "react";
import { brandImageUrl, useSystemPresentation } from "@/shared/api/presentation";
import { appearanceVariables, isAppearance, loadFont } from "@/shared/lib/appearance";
import { setDocumentAppName, setDocumentIcon } from "@/shared/lib/documentTitle";

// One root owns the palette and the font, including anonymous screens and portal content; also the name and the icon of the tab
// (ME4, ME5).
export function SystemTheme() {
  const { data } = useSystemPresentation();
  const appearance = data?.appearance;
  const brand = data?.brand;
  useEffect(() => {
    if (!isAppearance(appearance)) return;
    void loadFont(appearance.font);
    const variables = appearanceVariables(appearance);
    const root = document.documentElement;
    for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value);
    return () => { for (const key of Object.keys(variables)) root.style.removeProperty(key); };
  }, [appearance]);
  useEffect(() => { setDocumentAppName(brand?.appName); }, [brand?.appName]);
  useEffect(() => { setDocumentIcon(brand?.iconVersion ? brandImageUrl("icon", brand.iconVersion) : null); }, [brand?.iconVersion]);
  return null;
}
