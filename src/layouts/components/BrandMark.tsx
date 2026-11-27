import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { brandImageUrl, useSystemPresentation } from "@/shared/api/presentation";

/// ME1-A: the band at the top of the main menu carries the installation's logo, as a link home. Without a logo, its name in text
/// (ME6); collapsed, the icon or nothing. While the public presentation arrives the band stays empty, with its height.
export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const brand = useSystemPresentation().data?.brand;
  if (!brand) return null;
  const label = t("layout.brandHome", { name: brand.appName });
  if (collapsed) {
    return brand.iconVersion
      ? <Link to="/" aria-label={label} className="flex rounded-[var(--radius-control)]">
          <img src={brandImageUrl("icon", brand.iconVersion)} alt="" className="block size-7 rounded-[var(--radius-control)] object-contain" />
        </Link>
      : null;
  }
  return <Link to="/" aria-label={label} className="flex min-w-0 items-center rounded-[var(--radius-control)]">
    {brand.logoVersion
      ? <img src={brandImageUrl("logo", brand.logoVersion)} alt="" className="block h-7 w-auto max-w-full object-contain object-left" />
      : <span className="truncate text-sm font-semibold">{brand.appName}</span>}
  </Link>;
}
