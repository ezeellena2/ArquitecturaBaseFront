import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { notify, dismissNotification } from "@/shared/ui/notifications";
import { Spinner } from "@/shared/ui/Spinner";

export function AiSuggestionProposal({ fail, missing, onUse, onReveal }: { fail: boolean; missing: boolean; onUse: (value: string) => void; onReveal: () => void }) {
  const { t } = useTranslation("chatProposal");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); dismissNotification("proposal-suggestion"); }, []);
  useEffect(() => { if (text) onReveal(); }, [text, onReveal]);
  function generate() {
    setBusy(true); setText(null);
    timer.current = setTimeout(() => {
      setBusy(false);
      if (fail) notify({ id: "proposal-suggestion", kind: "error", message: t("aiFailed") });
      else setText(t("aiSample"));
    }, 600);
  }
  return <div className="chat-ai">
    {missing ? <p className="text-xs text-[var(--color-content-muted)]">{t("aiMissingHelp")}</p> : <>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" type="button" disabled={busy} onClick={generate}>{busy ? <Spinner /> : null}{t(busy ? "aiGenerating" : "aiSuggest")}</Button><span className="text-xs text-[var(--color-content-muted)]">{t("aiHint")}</span></div>
      {text ? <div className="chat-ai-result"><p className="text-xs font-semibold">{t("aiProposal")}</p><p className="mt-2 text-sm">{text}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" type="button" onClick={() => { onUse(text); setText(null); }}>{t("aiUse")}</Button><Button variant="muted-link" type="button" onClick={() => setText(null)}>{t("aiDiscard")}</Button></div></div> : null}
    </>}
  </div>;
}
