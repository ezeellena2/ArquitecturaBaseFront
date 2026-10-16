import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { EmbeddedPreview } from "@/shared/ui/EmbeddedPreview";
import { Spinner } from "@/shared/ui/Spinner";
import type { FormPdfFile } from "../api/pdf";
import type { FormCulture } from "../model";
export function FormPdfPreview({ load, onForbidden, requestedCulture, example = false }: {
    load: (signal: AbortSignal) => Promise<FormPdfFile>;
    onForbidden: () => void;
    requestedCulture: FormCulture;
    example?: boolean;
}) {
    const { t } = useTranslation("forms");
    const [pdf, setPdf] = useState<{
        url: string;
        culture: FormCulture;
    } | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    const cooldown = useCountdown(0);
    const { restart } = cooldown;
    const [source, setSource] = useState({ load, onForbidden });
    if (source.load !== load || source.onForbidden !== onForbidden) {
        setSource({ load, onForbidden });
        setPdf(null);
        setError(null);
    }
    useEffect(() => { const controller = new AbortController(); let url: string | null = null; void load(controller.signal).then(file => { if (controller.signal.aborted)
        return; url = URL.createObjectURL(file.blob); setPdf({ url, culture: file.contentLanguage }); }).catch(failure => { if (controller.signal.aborted || errorFeedback(failure).kind === "cancelled")
        return; if (failure instanceof ApiError && failure.status === 403) {
        onForbidden();
        return;
    } setError(failure); if (failure instanceof ApiError && failure.status === 429)
        restart(failure.retryAfterSeconds ?? 60); }); return () => { controller.abort(); if (url)
        URL.revokeObjectURL(url); }; }, [load, onForbidden, attempt, restart]);
    return <div className="space-y-3">{pdf ? <><p role="status" className="text-sm text-[var(--color-content-muted)]">{pdf.culture !== requestedCulture ? t("pdf.fallback", { requested: t("cultures." + requestedCulture), actual: t("cultures." + pdf.culture) }) : t("pdf.language", { language: t("cultures." + pdf.culture) })}</p><EmbeddedPreview url={pdf.url} title={t("pdf.previewTitle")}/></> : error ? <div role="status" className="space-y-2 text-sm"><p>{readErrorMessage(error, t)}</p>{!(error instanceof ApiError && error.status === 404) ? <Button variant="outline" disabled={cooldown.isRunning} onClick={() => { setPdf(null); setError(null); setAttempt(value => value + 1); }}>{t("common:actions.retry")}</Button> : null}{cooldown.isRunning ? <p>{t("wait", { count: cooldown.seconds })}</p> : null}</div> : <Spinner />}<p className="text-xs text-[var(--color-content-muted)]">{t(example ? "pdf.exampleHint" : "pdf.fixedHint")}</p></div>;
}
