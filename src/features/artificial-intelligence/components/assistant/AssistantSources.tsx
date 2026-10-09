import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { sourceDestination } from "../../assistant/model";
import type { AssistantEvidence } from "../../api/assistant";
export function AssistantSources({
  evidences,
  permissions,
  timeZone,
}: {
  evidences: readonly AssistantEvidence[];
  permissions: readonly string[];
  timeZone: string;
}) {
  const { t, i18n } = useTranslation("assistant");
  return evidences.length ? (
    <div className="mt-4 flex flex-col gap-4 border-t border-[var(--color-border)] pt-3">
      <h3 className="font-semibold">{t("sources")}</h3>
      {evidences.map((evidence) => {
        const destination = sourceDestination(
          evidence.destination,
          permissions,
        );
        return (
          <section
            className="min-w-0"
            key={evidence.id}
            aria-label={t(`sourceNames.${evidence.sourceId}`, {
              defaultValue: evidence.sourceId,
            })}
          >
            <p className="font-medium">
              {t(`sourceNames.${evidence.sourceId}`, {
                defaultValue: evidence.sourceId,
              })}
            </p>
            <p className="text-sm text-[var(--color-content-muted)]">
              {t("observedAt", {
                date: formatDateTimeInZone(
                  evidence.observedAtUtc,
                  i18n.language,
                  timeZone,
                ),
              })}
              {!evidence.isComplete ? ` · ${t("partial")}` : ""}
            </p>
            {evidence.rows.map((row, index) => (
              <dl key={row.id ?? index} className="my-2 flex flex-col gap-1">
                {row.values.map((value, valueIndex) => (
                  <div
                    key={valueIndex}
                    className="flex flex-wrap gap-x-2 break-words [overflow-wrap:anywhere]"
                  >
                    <dt className="font-medium">{value.label}</dt>
                    <dd>{value.value}</dd>
                  </div>
                ))}
              </dl>
            ))}
            {destination ? (
              <Button size="touch" variant="link" asChild>
                <Link to={destination}>{t("openSource")}</Link>
              </Button>
            ) : null}
          </section>
        );
      })}
    </div>
  ) : null;
}
