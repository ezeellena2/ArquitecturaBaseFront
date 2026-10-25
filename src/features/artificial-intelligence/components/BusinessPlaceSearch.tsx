import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Button } from "@/shared/ui/button";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { searchBusinessPlaces, type BusinessPlace } from "../api/businessPlaces";
interface Props { disabled: boolean; placeId?: string | null; onSelect: (id: string) => void }
export function BusinessPlaceSearch({ disabled, placeId, onSelect }: Props) {
  const { t, i18n } = useTranslation("businessInformation"), navigate = useNavigate();
  const [input, setInput] = useState(""), [result, setResult] = useState<{ input: string; language: string; places: BusinessPlace[] }>();
  const [selected, setSelected] = useState<BusinessPlace>(), [loadingFor, setLoadingFor] = useState<string>(), [failedFor, setFailedFor] = useState<string>();
  const [wait, setWait] = useState(0), [retry, setRetry] = useState(0);
  const paused = useRef(false);
  const query = input.trim(), language = i18n.resolvedLanguage ?? "es";
  const searchKey = `${language}:${query}`;
  useEffect(() => {
    const controller = new AbortController();
    if (disabled || query.length < 3 || paused.current) return () => controller.abort();
    const timer = setTimeout(() => {
      setLoadingFor(searchKey); setFailedFor(undefined);
      void searchBusinessPlaces(query, controller.signal).then(response => {
        if (!controller.signal.aborted) { setResult({ input: query, language, places: response.places }); dismissNotification("business:places"); }
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResult(undefined); setFailedFor(searchKey);
        const feedback = errorFeedback(error);
        if (feedback.kind === "forbidden") { void navigate("/sin-permiso"); return; }
        if (feedback.kind === "session" || feedback.kind === "cancelled") return;
        if (feedback.kind === "wait") { paused.current = true; setWait(Math.max(1, Math.min(86400, feedback.retryAfterSeconds ?? 60))); }
        const configuration = error instanceof ApiError && (error.code === "Ai.Places.NotConfigured" || error.code === "Ai.Places.ConfigurationInvalid");
        notify({ id: "business:places", kind: "error", message: configuration ? t("placeConfigurationError") : feedback.detail && error instanceof ApiError && error.status < 500 ? feedback.detail : t("common:states.loadFailed"),
          description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      }).finally(() => { if (!controller.signal.aborted) setLoadingFor(undefined); });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
    // Expiry never repeats a potentially billable search; retry requires another user action.
  }, [query, language, searchKey, disabled, retry, navigate, t]);
  const waiting = wait > 0;
  useEffect(() => {
    if (!waiting) { paused.current = false; return; }
    const timer = setInterval(() => setWait(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [waiting]);
  useEffect(() => () => dismissNotification("business:places"), []);
  const places = result?.input === query && result.language === language ? result.places : [];
  const loading = !disabled && !waiting && loadingFor === searchKey;
  const failed = failedFor === searchKey;
  const attribution = <span translate="no" className="whitespace-nowrap text-sm font-normal text-[var(--color-content)]">Google Maps</span>;
  return <div className="space-y-2">
    <FormField label={t("searchPlace")} hint={t("searchPlaceHint")}><DisabledReason reason={waiting && !disabled ? t("placeWait", { seconds: wait }) : null} className="grid w-full"><Autocomplete value={input} disabled={disabled || waiting} maxLength={200}
      placeholder={t("searchPlacePlaceholder")} aria-busy={loading} options={places.map(place => ({ id: place.placeId, label: place.label }))}
      footer={attribution}
      onValueChange={value => { setInput(value); setResult(undefined); }} onSelect={id => {
        const place = places.find(item => item.placeId === id);
        if (place) { setSelected(place); setInput(""); setResult(undefined); onSelect(id); }
      }} /></DisabledReason></FormField>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-sm text-[var(--color-content-muted)]">{loading ? t("searchingPlace") : result?.input === query && places.length === 0 ? t("noPlaces") : selected && selected.placeId === placeId ? selected.label : ""}</p>
      {attribution}
    </div>
    {failed && wait === 0 ? <Button variant="outline" disabled={disabled} onClick={() => setRetry(value => value + 1)}>{t("retryPlace")}</Button> : null}
  </div>;
}
