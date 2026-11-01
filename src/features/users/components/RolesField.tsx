import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/auth/usePermissions";
import { fetchRoles, rolesQueryKey } from "@/shared/api/roles";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { Skeleton } from "@/shared/ui/skeleton";

/// Los roles de una cuenta, en el alta y en la edición. El catálogo sale de `GET /api/roles`, que pide `roles.read`:
/// sin ese permiso no hay qué ofrecer, y el campo queda apagado con ese motivo (`DisabledReason`), sin un texto en su
/// lugar. Muestra los roles que ya tiene: un control apagado conserva su valor legible.
export function RolesField({ value, onChange }: { value: readonly string[]; onChange: (roles: string[]) => void }) {
  const { t } = useTranslation("users");
  const { has } = usePermissions();
  const canReadRoles = has("roles.read");

  const rolesQuery = useQuery({ queryKey: rolesQueryKey, queryFn: fetchRoles, enabled: canReadRoles });
  const availableRoles = rolesQuery.data ?? [];

  if (!canReadRoles) {
    return (
      <FormField label={t("form.roles")}>
        <DisabledReason reason={t("form.rolesNeedPermission")} className="grid w-full">
          <MultiSelect
            options={value.map((role) => ({ value: role, label: role }))}
            value={value}
            onChange={onChange}
            placeholder={t("form.rolesPlaceholder")}
            disabled
          />
        </DisabledReason>
      </FormField>
    );
  }

  if (rolesQuery.isPending) {
    return <Skeleton aria-hidden="true" className="h-9" />;
  }

  if (availableRoles.length === 0) {
    return <p className="text-sm text-[var(--color-content-muted)]">{t("form.rolesEmpty")}</p>;
  }

  return (
    <FormField label={t("form.roles")}>
      <MultiSelect
        options={availableRoles.map((role) => ({
          value: role.name,
          label: role.name,
          description: role.description ?? undefined,
        }))}
        value={value}
        onChange={onChange}
        placeholder={t("form.rolesPlaceholder")}
      />
    </FormField>
  );
}
