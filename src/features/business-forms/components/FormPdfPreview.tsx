import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmbeddedPreview } from "@/shared/ui/EmbeddedPreview";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { FormPdfFile } from "../api/pdf";
import type { FormCulture } from "../model";
// The PDF, its real language and its download, without a note under it on how it is built (2026-10-31).
export function FormPdfPreview({ operationId, load, onForbidden, requestedCulture }: {
    operationId: string;
    load: (signal: AbortSignal) => Promise<FormPdfFile>;
    onForbidden: () => void;
    requestedCulture: FormCulture;
}) {
    const { t, i18n } = useTranslation("forms");
    const [pdf, setPdf] = useState<{
        url: string;
        culture: FormCulture;
        fileName: string | null;
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
    useEffect(() => { const controller = new AbortController(); let url: string | null = null; dismissNotification(operationId); void load(controller.signal).then(file => { if (controller.signal.aborted)
        return; url = URL.createObjectURL(file.blob); setPdf({ url, culture: file.contentLanguage, fileName: file.fileName }); dismissNotification(operationId); }).catch(failure => { if (controller.signal.aborted || errorFeedback(failure).kind === "cancelled")
        return; if (failure instanceof ApiError && failure.status === 403) {
        onForbidden();
        return;
    } setError(failure); if (errorFeedback(failure).kind !== "session") notify({ id: operationId, kind: "error", message: readErrorMessage(failure, t) }); if (failure instanceof ApiError && failure.status === 429)
        restart(failure.retryAfterSeconds ?? 60); }); return () => { controller.abort(); dismissNotification(operationId); if (url)
        URL.revokeObjectURL(url); }; }, [operationId, load, onForbidden, attempt, restart, t]);
    // NI1-A (2026-11-03): the PDF says its language only when it is not the menu's; a fallback names both.
    const menu = i18n.language.startsWith("en") ? "en" : "es";
    const status = !pdf ? null : pdf.culture !== requestedCulture ? t("pdf.fallback", { requested: t("cultureNamesInText." + requestedCulture), actual: t("cultureNamesInText." + pdf.culture) })
        : pdf.culture !== menu ? t("pdf.language", { language: t("cultureNamesInText." + pdf.culture) }) : null;
    return <div className="space-y-3">{pdf ? <>{status ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{status}</p> : null}<EmbeddedPreview url={pdf.url} title={t("pdf.previewTitle")} kind="pdf"/><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={pdf.url} download={pdf.fileName ?? t("pdf.receipt") + ".pdf"}>{t("pdf.download")}</a></Button></div></> : error ? <div role="status" className="space-y-2 text-sm"><p>{t("common:states.loadFailed")}</p>{!(error instanceof ApiError && error.status === 404) ? <DisabledReason reason={cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null}><Button variant="outline" disabled={cooldown.isRunning} onClick={() => { setPdf(null); setError(null); setAttempt(value => value + 1); }}>{t("common:actions.retry")}</Button></DisabledReason> : null}</div> : <Spinner />}</div>;
}
