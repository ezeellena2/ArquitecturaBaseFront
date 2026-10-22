import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { exportCatalog } from "../api/catalogImports";
import type { CatalogReadScope } from "./useCatalogDraftEditor";

export function useCatalogExport(scope: CatalogReadScope, catalogId: string | null) {
  const { t } = useTranslation("forms");
  const owner = JSON.stringify([scope.actorId, scope.culture, catalogId, [...scope.permissions].sort()]);
  const allowed = !!catalogId && scope.actorId !== null && scope.permissions.includes("formcatalogs.read");
  const current = useRef({ owner, allowed });
  const flight = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ owner: string; busy: boolean; error: unknown }>({ owner, busy: false, error: null });
  if (state.owner !== owner) setState({ owner, busy: false, error: null });
  const feedbackId = "catalogs:export:" + useId();
  useLayoutEffect(() => { current.current = { owner, allowed }; }, [owner, allowed]);
  useEffect(() => () => { flight.current?.abort(); flight.current = null; dismissNotification(feedbackId); }, [owner, allowed, feedbackId]);
  const download = async (template: boolean) => {
    if (!allowed || !catalogId || flight.current) return;
    const controller = new AbortController(); flight.current = controller; setState({ owner, busy: true, error: null });
    const owns = () => !controller.signal.aborted && current.current.owner === owner && current.current.allowed;
    try { const file = await exportCatalog(catalogId, template, controller.signal); if (owns()) savePrivateBlob(file.blob, file.fileName ?? "Catalog.xlsx"); }
    catch (error) { if (owns()) { setState({ owner, busy: true, error }); if (!["cancelled", "session", "forbidden"].includes(errorFeedback(error).kind)) notify({ id: feedbackId, kind: "error", message: readErrorMessage(error, t) }); } }
    finally { if (flight.current === controller) { flight.current = null; if (owns()) setState(value => value.owner === owner ? { ...value, busy: false } : value); } }
  };
  return { busy: state.owner === owner && state.busy, error: state.owner === owner ? state.error : null, download };
}
