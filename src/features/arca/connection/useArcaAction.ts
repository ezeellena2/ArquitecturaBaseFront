import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";

/// Una acción de la pantalla con su espera en el botón que la disparó. Un 409 de revisión abre «Revisar»; un error de
/// ARCA dice el texto del servidor, y lo demás sigue el contrato de mensajes. `handle` atiende antes lo que va junto a un
/// control, como un certificado que no corresponde.
export function useArcaAction(onConflict: () => void) {
  const { t } = useTranslation("arca");
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  async function run<T>(key: string, action: () => Promise<T>, handle?: (error: unknown) => boolean): Promise<T | undefined> {
    if (pending) return undefined;
    setPending(key);
    try {
      return await action();
    } catch (error) {
      if (handle?.(error)) return undefined;
      const feedback = errorFeedback(error, { writing: true, conflictCodes: ["Arca.Connection.RevisionConflict"] });
      if (feedback.kind === "forbidden") void navigate("/sin-permiso");
      else if (feedback.kind === "conflict") onConflict();
      else if (feedback.kind !== "session" && feedback.kind !== "cancelled") {
        const message = error instanceof ApiError && error.code?.startsWith("Arca.") && error.detail ? error.detail : operationalErrorMessage(error, t);
        notify({ id: "arca:action", kind: "error", message });
      }
      return undefined;
    } finally {
      setPending(null);
    }
  }
  return { pending, run };
}
