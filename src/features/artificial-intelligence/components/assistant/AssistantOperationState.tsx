import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { isActiveTurn } from "../../assistant/model";
import type { AssistantState, AssistantTurn } from "../../api/assistant";
const repeatable: readonly AssistantState[] = [
  "failed",
  "uncertain",
  "expired",
  "canceled",
];
export function AssistantOperationState({
  turn,
  busy,
  onCancel,
  onRefresh,
  onRepeat,
}: {
  turn: AssistantTurn;
  busy: boolean;
  onCancel: () => void;
  onRefresh: () => void;
  onRepeat: () => void;
}) {
  const { t } = useTranslation("assistant");
  const active = isActiveTurn(turn);
  return (
    <div
      className="flex flex-wrap items-center gap-3 py-3"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {active ? <Spinner decorative /> : null}
      <span>
        {active
          ? t(`stages.${turn.stage || "pending"}`)
          : t(`states.${turn.state}`)}
      </span>
      {active ? (
        <Button
          size="touch"
          variant="outline"
          type="button"
          disabled={busy || !!turn.cancelRequestedAtUtc}
          onClick={onCancel}
        >
          {t(turn.cancelRequestedAtUtc ? "cancelRequested" : "cancel")}
        </Button>
      ) : turn.state === "uncertain" ? (
        <Button
          size="touch"
          variant="outline"
          type="button"
          disabled={busy}
          onClick={onRefresh}
        >
          {t("checkStatus")}
        </Button>
      ) : null}
      {repeatable.includes(turn.state) && turn.question ? (
        <Button
          size="touch"
          variant="outline"
          type="button"
          disabled={busy}
          onClick={onRepeat}
        >
          {t("prepareAgain")}
        </Button>
      ) : null}
    </div>
  );
}
