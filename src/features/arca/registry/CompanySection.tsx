import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { formatCuit } from "../connection/model";
import { arcaCompanyQueryKey, fetchArcaCompany } from "./api";

/// Los datos de la empresa que trajo el padrón, con la CUIT de la conexión: en la zona de la prueba del alta (`embedded`)
/// o como «Empresa» con la conexión activa. Se actualizan con cada prueba.
export function CompanySection({ cuit, embedded = false }: { cuit: string | null; embedded?: boolean }) {
  const { t } = useTranslation("arca");
  const query = useQuery({ queryKey: arcaCompanyQueryKey, queryFn: ({ signal }) => fetchArcaCompany(signal), retry: false });
  const company = query.data;
  const content = query.isPending ? <Skeleton className="h-16" />
    : query.isError ? <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{t("unavailable")}</p>
      <Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button></div>
    : !company?.legalName ? <p className="text-sm text-[var(--color-content-muted)]">{t("registry.empty")}</p>
    : <DataList items={[
      { key: "legalName", label: t("registry.legalName"), value: company.legalName },
      { key: "cuit", label: t("registry.cuit"), value: cuit ? formatCuit(cuit) : "—" },
      { key: "vatCondition", label: t("registry.vatCondition"), value: company.vatCondition ? t(`registry.vat.${company.vatCondition}`) : "—" },
      { key: "fiscalAddress", label: t("registry.fiscalAddress"), value: company.fiscalAddress || "—" },
    ]} />;
  return embedded ? content : <Surface title={t("registry.title")} help={t("registry.help")} padded>{content}</Surface>;
}
