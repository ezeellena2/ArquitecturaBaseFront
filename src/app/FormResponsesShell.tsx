import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { FormsResponseNavigationContext, type FormsResponseNavigation } from "@/layouts/formsNavigation";
import { isFormsPath } from "@/layouts/navigation";
const ResponseNavigation = lazy(() => import("./FormResponsesNavigation").then(module => ({ default: module.FormResponsesNavigation })));
export function FormResponsesShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const { pathname } = useLocation();
  const canRead = !!user?.permissions.includes("formrecords.read");
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState<{ owner: string; value: FormsResponseNavigation } | null>(null);
  const enabled = canRead && (isFormsPath(pathname) || active);
  const onState = useCallback((value: FormsResponseNavigation) => setLoaded({ owner, value }), [owner]);
  const value: FormsResponseNavigation = loaded?.owner === owner && enabled ? loaded.value : { canRead, items: [], totalCount: 0, hasMore: false, pending: enabled, failed: false, retry: () => setActive(true) };
  return <FormsResponseNavigationContext.Provider value={{ ...value, setActive }}>
    <Suspense fallback={null}>{enabled ? <ResponseNavigation key={owner} onState={onState} /> : null}</Suspense>
    {children}
  </FormsResponseNavigationContext.Provider>;
}
