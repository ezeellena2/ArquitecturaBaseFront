import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Surface } from "@/shared/ui/Surface";
import {
  aiUsageKey, aiUsageKeyRoot, fetchAiUsage, priceConflictCode, priceLimits, priceRequestFields, saveAiModelPrice,
  type AiModelPrice, type AiModelPriceRequest, type AiModelUsage, type PriceRequestField,
} from "../api/usage";
import {
  changedPriceFields, draftFromPrice, isPriceDraftDirty, keepPriceDraftChanges, priceFields, priceValues, valuesOf,
  type PriceDraft, type PriceField,
} from "../priceDraft";

const requestField: Record<PriceRequestField, PriceField> = { inputUsdPerMillion: "input", outputUsdPerMillion: "output", audioUsdPerMinute: "audio" };

/**
 * «Precios de gpt-6.1-sol» (board «Precios»): the prices of a model that the administrator copies from the provider's list, to
 * estimate every month (PR13). Each one is optional and written with the decimal sign of the language. A price out of range goes
 * under its field; a conflict follows the walk of the editors with a revision (N2): the notice with «Revisar valores actuales», the
 * comparison in the dialog, keep or take what is saved, and Guardar again with the revision read.
 */
export function AiPriceDialog({ month, model, onClose }: { month: string; model: AiModelUsage; onClose: () => void }) {
  const { t, i18n } = useTranslation("usage");
  const language = i18n.language;
  const client = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();
  const [base, setBase] = useState<AiModelPrice | null>(model.price);
  const [draft, setDraft] = useState<PriceDraft>(() => draftFromPrice(model.price, language));
  const [errors, setErrors] = useState<Partial<Record<PriceField, string>>>({});
  const [needsReview, setNeedsReview] = useState(false);
  const [review, setReview] = useState<{ price: AiModelPrice | null }>();
  const [reading, setReading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const active = useRef(true);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const noticeId = `usage:prices:${model.provider}:${model.model}`;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (review) reviewTitle.current?.focus(); }, [review]);
  const baseValues = valuesOf(base);
  const dirty = isPriceDraftDirty(draft, baseValues, language);
  const invalid = (field: PriceField) => t("prices.invalid", {
    max: field === "audio" ? priceLimits.maxUsdPerMinute : priceLimits.maxUsdPerMillionTokens, decimals: priceLimits.maxDecimals,
  });

  async function readCurrent() {
    setReading(true);
    try {
      const usage = await client.fetchQuery({ queryKey: aiUsageKey(month), queryFn: ({ signal }) => fetchAiUsage(month, signal), staleTime: 0, meta: { errorOwner: "local" } });
      if (!active.current) return;
      setReview({ price: usage.models.find(item => item.provider === model.provider && item.model === model.model)?.price ?? null });
      dismissNotification(noticeId);
    } catch (error) {
      if (!active.current) return;
      const feedback = errorFeedback(error);
      if (feedback.kind === "forbidden") { setForbidden(true); void client.invalidateQueries({ queryKey: currentUserQueryKey }); return; }
      if (feedback.kind !== "session" && feedback.kind !== "cancelled") notify({ id: noticeId, kind: "error", message: t("prices.reviewFailed"),
        description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined,
        action: { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } });
    } finally { if (active.current) setReading(false); }
  }

  const mutation = useMutation({
    mutationFn: (request: AiModelPriceRequest) => saveAiModelPrice(request),
    onSuccess: async () => {
      dismissNotification(noticeId);
      notify({ id: noticeId, kind: "success", message: t("prices.saved", { model: model.model }) });
      // A price estimates every month: all of them read again.
      await client.invalidateQueries({ queryKey: aiUsageKeyRoot });
      if (active.current) onClose();
    },
    onError: error => {
      const feedback = errorFeedback(error, { writing: true, fields: priceRequestFields, conflictCodes: [priceConflictCode] });
      if (feedback.kind === "session" || feedback.kind === "cancelled") return;
      // SP2: a dialog that was open answers in its place, and the permissions are read again.
      if (feedback.kind === "forbidden") { if (active.current) setForbidden(true); void client.invalidateQueries({ queryKey: currentUserQueryKey }); return; }
      if (feedback.kind === "fields") {
        if (active.current) setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([field, messages]) => [requestField[field as PriceRequestField], messages.join(" ")])));
        return;
      }
      const review = feedback.kind === "conflict" || feedback.kind === "uncertain";
      if (review && active.current) setNeedsReview(true);
      notify({ id: noticeId, kind: "error",
        message: feedback.kind === "conflict" ? t("prices.conflict", { model: model.model }) : feedback.kind === "uncertain" ? operationalErrorMessage(error, t) : readErrorMessage(error, t),
        action: review && active.current ? { label: t("common:revisionReview.action"), onClick: () => void readCurrent() } : undefined });
    },
  });
  const pending = mutation.isPending;

  const change = (field: PriceField, value: string) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending || reading || needsReview || !dirty) return;
    const result = priceValues(draft, language);
    if ("errors" in result) {
      setErrors(Object.fromEntries(Object.keys(result.errors).map(field => [field, invalid(field as PriceField)])));
      document.getElementById(`usage-price-${priceFields.find(field => field in result.errors)}`)?.focus();
      return;
    }
    setErrors({});
    mutation.mutate({ provider: model.provider, model: model.model, inputUsdPerMillion: result.values.input, outputUsdPerMillion: result.values.output,
      audioUsdPerMinute: result.values.audio, revision: base?.revision ?? null });
  };
  /** Keeps what was edited and takes the rest from what is saved now, or takes it all; the revision is the one read. */
  function acceptReview(keepDraft: boolean) {
    if (!review) return;
    setDraft(keepDraft ? keepPriceDraftChanges(draft, baseValues, review.price, language) : draftFromPrice(review.price, language));
    setBase(review.price);
    setNeedsReview(false); setReview(undefined); setErrors({}); dismissNotification(noticeId);
  }

  const shown = (text: string) => <CellText text={text.trim() === "" ? t("prices.empty") : text} />;
  const kept = review ? keepPriceDraftChanges(draft, baseValues, review.price, language) : undefined;
  const keptValues = kept ? priceValues(kept, language) : undefined;
  // What differs between what is saved and what would stay; a field that is not a price yet differs.
  const reviewFields = !review || !keptValues ? [] : "values" in keptValues ? changedPriceFields(valuesOf(review.price), keptValues.values) : [...priceFields];
  const unit = (text: string) => <span className="text-sm text-[var(--color-content-muted)]">{text}</span>;
  const field = (name: PriceField, label: string, unitText: string, help?: string) => (
    <FormField label={label} help={help} error={errors[name]} beside={unit(unitText)}>
      <Input id={`usage-price-${name}`} inputMode="decimal" autoComplete="off" className="w-24 text-right" readOnly={pending} value={draft[name]}
        onChange={event => change(name, event.target.value)} />
    </FormField>
  );

  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("prices.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("prices.title", { model: model.model })}</DialogTitle></DialogHeader>
        {forbidden ? (
          <>
            <EmptyState embedded title={t("common:errors.forbidden.title")} />
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("common:actions.close")}</Button></DialogFooter>
          </>
        ) : (
          <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
            {field("input", t("prices.input"), t("prices.perMillion"))}
            {field("output", t("prices.output"), t("prices.perMillion"))}
            {field("audio", t("prices.audio"), t("prices.perMinute"), t("prices.audioHelp"))}
            {review ? (
              <Surface title={t("common:revisionReview.title")} titleRef={reviewTitle} headingLevel={3} padded actions={<>
                <Button type="button" variant="outline" size="sm" disabled={pending || reading} onClick={() => acceptReview(false)}>{t("common:revisionReview.useCurrent")}</Button>
                <Button type="button" size="sm" disabled={pending || reading} onClick={() => acceptReview(true)}>{t("common:revisionReview.keepMine")}</Button>
              </>}>
                <ComparisonTable columns={{ identity: [{ key: "field", header: t("common:revisionReview.field") }], before: t("common:revisionReview.current"), after: t("common:revisionReview.mine") }}
                  groups={reviewFields.map(name => ({ key: name, identity: [t(`prices.${name}`)],
                    lines: [{ key: "value", before: shown(draftFromPrice(review.price, language)[name]), after: shown(kept?.[name] ?? "") }] }))} />
              </Surface>
            ) : null}
            <DialogFooter>
              {needsReview ? (
                <Button type="button" variant="outline" pending={reading} disabled={reading || pending} onClick={() => void readCurrent()}>
                  {reading ? t("common:revisionReview.reading") : t("common:revisionReview.action")}
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
              <DisabledReason reason={needsReview && !reading ? t("common:revisionReview.pending") : null}>
                <Button type="submit" pending={pending} disabled={!dirty || needsReview || reading}>{pending ? t("prices.saving") : t("prices.save")}</Button>
              </DisabledReason>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
